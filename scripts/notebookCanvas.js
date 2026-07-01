/**
 * notebookCanvas.js  —  TJM Handwriting Journal
 * ═══════════════════════════════════════════════
 * This version fixes:
 *  1. Size dot no longer causes toolbar jitter (uses transform:scale, fixed container)
 *  2. Pinch-to-zoom rebuilt on raw touch events on canvasWrap, separate from drawing
 *  3. Palm rejection — drawing only accepts Apple Pencil (pointerType='pen');
 *     finger touches on the canvas are ignored while writing
 *  4. Toolbar collapse button — tap ‹ to hide, › to restore
 *  5. All toolbar text is white and readable
 */

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════ */
const LINE_SPACING = 36;
const GRID_SPACING = 28;   // squared/graph paper cell size
const MARGIN_LEFT  = 60;
const PAPER_BG     = '#fdfcf7';
const LINE_COLOR   = '#c8d8e8';
const MARGIN_COLOR = '#e8a0a0';
const INK_DEFAULT  = '#1a1a2e';
const ERASER_W     = 36;
const PAGE_ROWS    = 45;
const AUTOSAVE_MS  = 30_000;
const API_ENDPOINT = '/.netlify/functions/anthropic-proxy';

const PAPER_STYLES = [
  { id:'lined',  label:'Lined',  icon:'☰' },
  { id:'plain',  label:'Plain',  icon:'▭' },
  { id:'squared',label:'Squared',icon:'▦' },
  { id:'dotted', label:'Dotted', icon:'⠿' },
];

const QUICK_COLORS = [
  '#1a1a2e','#e74c3c','#e67e22','#2ecc71',
  '#3498db','#9b59b6','#C9A84C','#ffffff',
];

function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function fmtDate(iso) {
  try {
    const d = new Date((iso||'').length===10 ? iso+'T12:00:00' : iso);
    return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  } catch { return iso||''; }
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════════ */
export function openNotebook({ state, saveData }) {

  if (!state.data.notebookMeta)  state.data.notebookMeta  = { folders:[], pages:[] };
  if (!state.data.notebookPages) state.data.notebookPages = {};
  const meta  = state.data.notebookMeta;
  const pages = state.data.notebookPages;

  // MIGRATION: older notebooks predate the `order` field (pages were just
  // sorted by updatedAt desc in the sidebar). Backfill `order` once, per
  // folder group, preserving that same visual order so nothing jumps around
  // the first time this loads.
  (function migratePageOrder() {
    meta.pages = meta.pages||[];
    const needsMigration = meta.pages.some(p => p.order===undefined);
    if (!needsMigration) return;
    const groups = {};
    meta.pages.forEach(p => {
      const key = p.folderId||'__unfiled__';
      (groups[key] = groups[key]||[]).push(p);
    });
    Object.values(groups).forEach(group => {
      group.sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));
      group.forEach((p,i) => { p.order = i; });
    });
  })();

  let activePageId = null;
  let strokes      = [];
  let undoStack    = [];
  let curStroke    = null;
  let dirtyFlag    = false;
  let paperStyle   = 'lined';  // 'lined' | 'plain' | 'squared' | 'dotted' — per page

  let textBoxes   = [];   // { id, x, y, w, h, rotation, text, font, size, color, bold, italic }
  let selectedTB  = null; // id of selected text box
  let selectedShape = null; // id of selected shape stroke

  let tool      = 'pen';
  let toolBeforeSelect = 'pen'; // restored when deselecting a shape/text box
  let penColor  = INK_DEFAULT;
  let strokeW   = 1.8;
  let zoomLevel = 1.0;
  let tbCollapsed = false;   // toolbar collapsed state

  // Shape drawing state
  let shapeKind   = 'rect';  // 'rect' | 'square' | 'circle' | 'line' | 'triangle'
  let shapeFilled = false;   // fill vs outline
  let curShapePreview = null; // { kind, filled, color, width, x0,y0,x1,y1 } while dragging

  /* ══════════════════════════════════════════════════════════════════════
     HTML
  ══════════════════════════════════════════════════════════════════════ */
  const overlay = document.createElement('div');
  overlay.id = 'notebookOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;animation:nbIn 0.18s ease;';

  overlay.innerHTML = `
  <style>
    @keyframes nbIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
    #notebookOverlay *, #notebookOverlay *::before, #notebookOverlay *::after {
      box-sizing:border-box; -webkit-tap-highlight-color:transparent;
    }

    /* ── Shell ── */
    #nbShell  { flex:1; display:flex; overflow:hidden; min-height:0; }
    #nbSidebar{
      width:256px; flex-shrink:0; background:#0d0d1a;
      border-right:1px solid rgba(255,255,255,0.07);
      display:flex; flex-direction:column; overflow:visible;
      transition:width 0.22s ease;
      position:relative;
    }
    #nbSidebar.collapsed { width:0; }
    /* When collapsed, clip the sidebar content but not the tab */
    #nbSidebar.collapsed > :not(#nbSideTab) { overflow:hidden; opacity:0; pointer-events:none; }
    #nbMain   { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; position:relative; }

    /* ══ TOOLBAR ══ */
    #nbToolbarOuter {
      flex-shrink:0; background:#0d0d1a;
      border-bottom:1px solid rgba(255,255,255,0.07);
      display:flex; flex-direction:column;
      transition:max-height 0.22s ease, padding 0.22s ease;
      overflow:hidden;
    }
    /* Full toolbar row */
    #nbToolbarFull {
      display:flex; align-items:center; flex-wrap:wrap;
      gap:5px; padding:7px 8px;
    }
    /* Collapsed toolbar row — always visible */
    #nbToolbarMin {
      display:flex; align-items:center;
      gap:6px; padding:5px 8px;
    }
    /* Hide full bar when collapsed */
    #nbToolbarOuter.tb-collapsed #nbToolbarFull { display:none; }

    /* ── All toolbar text white ── */
    #nbToolbarOuter, #nbToolbarOuter * { color:#fff; }

    /* ── Buttons ── */
    .nbt {
      background:rgba(255,255,255,0.09); border:1px solid rgba(255,255,255,0.15);
      color:#fff !important; border-radius:8px; padding:6px 10px;
      font:700 11px/1 inherit; cursor:pointer; letter-spacing:0.3px;
      transition:background 0.12s; white-space:nowrap; flex-shrink:0;
      user-select:none;
    }
    .nbt:hover   { background:rgba(255,255,255,0.16); }
    .nbt.active  { background:#C9A84C !important; border-color:#C9A84C; color:#0d0d1a !important; }
    .nbt.green   { background:#27ae60; border-color:#27ae60; }
    .nbt.red     { background:rgba(231,76,60,0.2); border-color:rgba(231,76,60,0.5); color:#ff8080 !important; }
    .nbt.blue    { background:rgba(52,152,219,0.2); border-color:rgba(52,152,219,0.45); color:#7ec8f5 !important; }
    .nbt:disabled{ opacity:0.38; cursor:not-allowed; }
    .nb-div { width:1px; height:20px; background:rgba(255,255,255,0.09); flex-shrink:0; }

    /* ── Page title ── */
    #nbPageTitle {
      flex:1; min-width:70px; max-width:200px;
      background:rgba(255,255,255,0.09); border:1px solid rgba(255,255,255,0.18);
      border-radius:8px; padding:6px 10px;
      color:#fff !important; caret-color:#C9A84C;
      font:700 12px/1 inherit; outline:none;
    }
    #nbPageTitle::placeholder { color:rgba(255,255,255,0.3); }

    /* ── Colour swatches ── */
    #nbSwatches { display:flex; gap:4px; align-items:center; flex-shrink:0; }
    .nb-swatch {
      width:18px; height:18px; border-radius:50%;
      border:2px solid rgba(255,255,255,0.18);
      cursor:pointer; flex-shrink:0;
      transition:transform 0.1s, border-color 0.1s;
    }
    .nb-swatch.sel   { border-color:#C9A84C; transform:scale(1.22); }
    .nb-swatch-pick  { background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red); }

    /* ── Size slider — fixed-width container, dot uses transform so it never causes reflow ── */
    #nbSizeGroup { display:flex; align-items:center; gap:5px; flex-shrink:0; }
    #nbSizeDotWrap {
      width:20px; height:20px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; pointer-events:none;
    }
    #nbSizeDot {
      width:20px; height:20px; border-radius:50%;
      background:#fff; opacity:0.55;
      transform:scale(0.25);   /* start small, updated via transform only */
      transition:transform 0.1s, background 0.1s;
      flex-shrink:0;
    }
    #nbSizeSlider {
      -webkit-appearance:none; width:80px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.2); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbSizeSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:16px; height:16px;
      border-radius:50%; background:#C9A84C; cursor:pointer;
      border:2px solid #0d0d1a;
    }
    #nbSizeVal {
      font-size:10px; font-weight:700; color:#fff !important;
      width:26px; flex-shrink:0; text-align:left;
    }

    /* ── Zoom ── */
    #nbZoomGroup { display:flex; align-items:center; gap:5px; flex-shrink:0; }
    #nbZoomSlider {
      -webkit-appearance:none; width:70px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.2); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbZoomSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:14px; height:14px;
      border-radius:50%; background:#3498db; cursor:pointer;
      border:2px solid #0d0d1a;
    }
    #nbZoomLabel {
      font-size:10px; font-weight:700; color:#fff !important;
      width:34px; flex-shrink:0; text-align:left;
    }
    .nb-zoom-icon { font-size:12px; flex-shrink:0; }

    /* ── Collapse toggle ── */
    #nbTbCollapseBtn {
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
      color:#fff !important; border-radius:6px; padding:4px 8px;
      font:700 12px/1 inherit; cursor:pointer; flex-shrink:0;
      user-select:none;
    }
    /* Min bar items */
    #nbMinTools { display:flex; align-items:center; gap:5px; flex-shrink:0; }

    /* ── Canvas area ── */
    #nbCanvasWrap {
      flex:1; overflow:scroll; -webkit-overflow-scrolling:touch;
      display:flex; justify-content:flex-start; align-items:flex-start;
      padding:20px; background:#2a2a3a;
      position:relative;
      /* touch-action managed by JS */
    }
    #nbCanvas {
      display:block; flex-shrink:0;
      border-radius:3px;
      /* touch-action:none set in JS */
      cursor:crosshair;
      will-change:transform;
    }

    /* ── PAGE-TURN STAGE ──────────────────────────────────────────────
       Two-layer slide animation. The live canvas (#nbPageStage) slides OUT,
       the incoming page div (#nbPageStageIncoming) slides IN behind it.
       Both use only translateX — cheapest possible GPU composite, no
       rasterization, no 3D matrix math. The "page turn" feel comes from
       the offset timing, the shadow edge, and the easing curve.        */
    #nbPageStage {
      display: flex; flex-shrink: 0;
      position: relative;
      z-index: 1;
      will-change: transform;
      /* Paper stack on the right — layered box-shadows simulate page edges */
      box-shadow:
        2px 0 0 0px #f0ede4,
        3px 0 0 1px #e8e4d8,
        5px 0 0 2px #ddd8cb,
        7px 0 0 3px #d4cfbf,
        9px 0 0 4px #cbc5b4,
        11px 0 0 5px #c0baa8,
        0 6px 32px rgba(0,0,0,0.5);
    }
    /* Spine shadow on left edge */
    #nbPageStage::before {
      content:''; position:absolute; inset:0; pointer-events:none;
      border-left: 3px solid rgba(0,0,0,0.18);
      border-radius: 3px; z-index: 1;
    }
    /* Shadow that sweeps across the page as it slides away, reinforcing
       the direction of travel. Pointer-events none so it never blocks input. */
    #nbPageStage::after {
      content:''; position:absolute; inset:0; pointer-events:none;
      opacity:0; border-radius:3px;
      background: linear-gradient(90deg, transparent 60%, rgba(0,0,0,0.22) 100%);
    }

    /* Incoming page — sits BEHIND the outgoing page in the stacking context.
       Slides in from the opposite direction, slightly slower (lag = depth). */
    #nbPageStageIncoming {
      position: absolute; top: 20px; left: 20px;
      display: none;
      will-change: transform;
      background: #fdfcf7; border-radius: 3px;
      box-shadow: 0 6px 32px rgba(0,0,0,0.5);
      pointer-events: none; overflow: hidden;
      z-index: 0;
    }

    /* Edge swipe-hint arrows */
    .nb-swipe-hint {
      position: absolute; top: 50%; transform: translateY(-50%);
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(0,0,0,0.35); color: rgba(255,255,255,0.55);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 900; pointer-events: none;
      opacity: 0; transition: opacity 0.2s ease; z-index: 20;
    }
    .nb-swipe-hint-left  { left: 8px; }
    .nb-swipe-hint-right { right: 8px; }
    .nb-swipe-hint.nb-show { opacity: 1; }

    /* ══ SIDEBAR — all text hardcoded white so light-mode body styles can't override ══ */

    /* Sidebar wrapper — dark background always */
    #nbSidebar, #nbSidebar * { color:#ffffff !important; }

    /* Persistent toggle tab — sits on the right edge of the sidebar, always visible */
    #nbSideTab {
      position:absolute; top:50%; transform:translateY(-50%);
      right:-28px; width:28px; height:64px;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.12);
      border-left:none; border-radius:0 8px 8px 0;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; z-index:10; flex-shrink:0;
      font-size:13px; color:#fff !important;
      user-select:none;
    }
    #nbSideTab:hover { background:#1a1a3a; }

    #nbSideHeader { padding:12px 12px 6px; flex-shrink:0; }

    #nbSideTitle {
      font-size:12px; font-weight:900;
      color:#C9A84C !important;
      letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px;
    }

    #nbSearchBox {
      width:100%; padding:6px 10px; border-radius:7px;
      background:rgba(255,255,255,0.12) !important;
      border:1px solid rgba(255,255,255,0.2) !important;
      color:#ffffff !important;
      font:600 12px inherit; outline:none;
    }
    #nbSearchBox::placeholder { color:rgba(255,255,255,0.4) !important; }

    #nbNewPageBtn, #nbNewFolderBtn {
      width:100%; padding:7px; border-radius:7px; margin-top:5px;
      font:700 11px inherit; cursor:pointer; border:1px dashed;
      background:transparent !important; letter-spacing:0.3px;
    }
    #nbNewPageBtn   { border-color:rgba(201,168,76,0.55) !important; color:#C9A84C !important; }
    #nbNewFolderBtn { border-color:rgba(255,255,255,0.3) !important; color:#ffffff !important; }
    #nbNewPageBtn:hover   { background:rgba(201,168,76,0.15) !important; }
    #nbNewFolderBtn:hover { background:rgba(255,255,255,0.08) !important; }

    #nbSideList { flex:1; overflow-y:auto; padding:0 8px 16px; }
    #nbSideList::-webkit-scrollbar { width:3px; }
    #nbSideList::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }

    .nb-folder-row {
      display:flex; align-items:center; gap:5px;
      padding:5px 7px; border-radius:7px; margin-bottom:2px;
      color:#ffffff !important; font:700 11px inherit; cursor:pointer; user-select:none;
    }
    .nb-folder-row:hover { background:rgba(255,255,255,0.08) !important; }
    .nb-folder-chevron {
      font-size:12px; color:rgba(255,255,255,0.4) !important;
      flex-shrink:0; width:10px; text-align:center;
      transition:transform 0.18s ease;
    }
    .nb-folder-collapsed .nb-folder-chevron { transform:none; }
    .nb-folder-count {
      font-size:9px; font-weight:700;
      background:rgba(255,255,255,0.12);
      color:rgba(255,255,255,0.5) !important;
      border-radius:8px; padding:1px 5px; flex-shrink:0;
    }
    .nb-folder-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#ffffff !important; }
    .nb-folder-dot  { width:9px; height:9px; border-radius:50%; flex-shrink:0; transition:transform 0.15s; }
    .nb-folder-dot:hover { transform:scale(1.4); }
    .nb-folder-actions { display:none; gap:3px; }
    .nb-folder-row:hover .nb-folder-actions { display:flex; }
    .nb-folder-action-btn {
      background:none !important; border:none !important;
      color:rgba(255,255,255,0.5) !important;
      cursor:pointer; font-size:10px; padding:2px 4px; border-radius:3px;
    }
    .nb-folder-action-btn:hover { background:rgba(255,255,255,0.12) !important; color:#ffffff !important; }

    .nb-page-row {
      display:flex; align-items:center; gap:5px;
      padding:7px 9px; border-radius:9px; margin-bottom:2px;
      background:rgba(255,255,255,0.05) !important;
      border:1px solid rgba(255,255,255,0.06) !important;
      border-top:2px solid transparent; border-bottom:2px solid transparent;
      cursor:pointer; transition:background 0.1s;
    }
    .nb-page-row:hover  { background:rgba(255,255,255,0.10) !important; }
    .nb-page-row.active { background:rgba(201,168,76,0.18) !important; border-color:rgba(201,168,76,0.4) !important; }
    .nb-page-info  { flex:1; min-width:0; }
    .nb-page-title {
      font-size:11px; font-weight:700; color:#ffffff !important;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .nb-page-title[contenteditable="true"] {
      white-space:nowrap; overflow:visible; text-overflow:clip;
      color:#ffffff !important;
    }
    .nb-page-date  { font-size:9px; color:rgba(255,255,255,0.5) !important; margin-top:2px; }

    /* Colour dot — always visible, tappable */
    .nb-page-colour-dot {
      flex-shrink:0; cursor:pointer;
      transition:transform 0.15s;
    }
    .nb-page-colour-dot:hover { transform:scale(1.35); }

    /* Rename + delete button group */
    .nb-page-actions { display:none; gap:2px; align-items:center; }
    .nb-page-row:hover .nb-page-actions { display:flex; }
    .nb-page-action-btn {
      background:none !important; border:none !important;
      color:rgba(255,255,255,0.35) !important;
      cursor:pointer; font-size:11px; padding:2px 5px;
      border-radius:4px; line-height:1;
    }
    .nb-page-action-btn:hover { background:rgba(255,255,255,0.12) !important; color:#fff !important; }
    .nb-page-del:hover { background:rgba(231,76,60,0.25) !important; color:#ff6b6b !important; }

    /* Drag handle */
    .nb-page-handle {
      flex-shrink:0; color:rgba(255,255,255,0.28) !important;
      font-size:13px; cursor:grab; touch-action:none;
      padding:2px 1px; margin-left:-2px;
    }
    .nb-page-handle:active { cursor:grabbing; color:rgba(255,255,255,0.6) !important; }

    /* Pinned pages — gold left border accent, star always visible */
    .nb-page-row.nb-page-pinned {
      border-left-color: rgba(201,168,76,0.55) !important;
    }
    .nb-page-row.nb-page-pinned .nb-page-pin {
      display:block !important;
      color:#C9A84C !important;
    }
    /* Pin star: hidden until hover normally, shown if already pinned */
    .nb-page-pin { display:none; }
    .nb-page-row:hover .nb-page-pin { display:block; }


    .nb-page-row.nb-drop-above  { border-top-color:#C9A84C !important; }
    .nb-page-row.nb-drop-below  { border-bottom-color:#C9A84C !important; }
    .nb-folder-row.nb-drop-into { background:rgba(201,168,76,0.28) !important; outline:1px dashed rgba(201,168,76,0.7); }
    #nbSideList.nb-drop-into { outline:1px dashed rgba(201,168,76,0.5); outline-offset:-4px; border-radius:8px; }
    .nb-page-row-dragging { opacity:0.35; }

    /* Floating ghost row that follows the pointer while dragging */
    .nb-page-row-ghost {
      position:fixed; z-index:99999; pointer-events:none;
      opacity:0.92; transform:rotate(-1.5deg) scale(1.03);
      box-shadow:0 10px 28px rgba(0,0,0,0.5) !important;
      background:#2f2f42 !important;
    }
    .nb-page-row-ghost .nb-page-actions { display:none !important; }

    /* "No pages" empty message inside sidebar */
    #nbSideList > div { color:#ffffff !important; }

    /* ── Empty state ── */
    #nbEmptyState {
      flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:12px; text-align:center; padding:40px;
    }
    .nb-empty-icon  { font-size:48px; }
    .nb-empty-title { font-size:16px; font-weight:800; color:rgba(255,255,255,0.6); }
    .nb-empty-sub   { font-size:12px; line-height:1.6; color:rgba(255,255,255,0.3); }

    /* ── Transcription modal ── */
    #nbTransModal {
      position:absolute; inset:0; background:rgba(10,10,20,0.82);
      backdrop-filter:blur(8px); z-index:20; display:none;
      align-items:flex-end; justify-content:center; padding:14px;
    }
    #nbTransModal.open { display:flex; }
    #nbTransPanel {
      width:min(580px,100%); max-height:84vh; overflow-y:auto;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.12);
      border-radius:18px; padding:18px; animation:nbIn 0.18s ease;
    }
    #nbTransText {
      width:100%; min-height:110px; padding:10px; border-radius:8px;
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
      color:#fff; font:600 13px/1.7 inherit; resize:vertical; outline:none; margin:10px 0 7px;
    }
    .nb-correction-row { display:flex; gap:7px; align-items:center; margin-bottom:5px; }
    .nb-correction-row input {
      flex:1; padding:5px 9px; border-radius:6px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 11px inherit; outline:none;
    }
    .nb-correction-row input::placeholder { color:rgba(255,255,255,0.3); }
    .nb-corr-del { background:none; border:none; color:rgba(231,76,60,0.65); cursor:pointer; font-size:15px; padding:0 3px; }
    #nbCorrectionNote { font-size:10px; color:rgba(255,255,255,0.35); margin-bottom:9px; line-height:1.5; }

    /* ── Text boxes on canvas ── */
    .nb-textbox-wrap {
      position:absolute; min-width:140px; min-height:60px;
      user-select:none; box-sizing:border-box;
      display:flex; flex-direction:column;
      transform-origin:50% 50%;
    }

    /* Drag handle bar at the top — this is the ONLY drag zone */
    .nb-textbox-drag {
      width:100%; height:32px; flex-shrink:0;
      background:rgba(201,168,76,0.18);
      border:1px solid rgba(201,168,76,0.35);
      border-bottom:none;
      border-radius:6px 6px 0 0;
      display:flex; align-items:center; justify-content:space-between;
      padding:0 8px; cursor:grab; touch-action:none;
    }
    .nb-textbox-drag:active { cursor:grabbing; }
    .nb-textbox-wrap.selected .nb-textbox-drag {
      background:rgba(201,168,76,0.28);
      border-color:rgba(201,168,76,0.6);
    }
    .nb-drag-dots {
      font-size:13px; color:rgba(201,168,76,0.7); letter-spacing:2px;
      pointer-events:none; line-height:1;
    }
    .nb-textbox-del {
      width:28px; height:28px; border-radius:50%;
      background:#e74c3c; border:2px solid rgba(255,255,255,0.8);
      color:#fff; font-size:13px; font-weight:900;
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      line-height:1; padding:0; flex-shrink:0;
      touch-action:manipulation;
    }

    /* Text content area */
    .nb-textbox-border {
      flex:1; min-height:0;
      border:1px solid rgba(201,168,76,0.35);
      border-radius:0 0 6px 6px; overflow:hidden;
      background:rgba(255,255,255,0.92);
    }
    .nb-textbox-wrap.selected .nb-textbox-border { border-color:rgba(201,168,76,0.7); border-width:2px; }
    .nb-textbox-inner {
      width:100%; height:100%; padding:8px 10px;
      outline:none; background:transparent;
      white-space:pre-wrap; word-break:break-word;
      line-height:1.6; cursor:text; overflow-y:auto;
    }

    /* Resize handle — large 40×40 touch target in bottom-right */
    .nb-textbox-resize {
      position:absolute; bottom:0; right:0;
      width:40px; height:40px; cursor:se-resize;
      touch-action:none;
      display:flex; align-items:flex-end; justify-content:flex-end;
      padding:4px;
    }
    .nb-textbox-resize::after {
      content:'';
      display:block; width:16px; height:16px;
      background:linear-gradient(135deg, transparent 50%, #C9A84C 50%);
      border-radius:0 0 4px 0;
    }

    /* Rotate handle — floats above the drag bar, large touch target */
    .nb-textbox-rotate {
      position:absolute; top:-38px; left:50%;
      width:40px; height:40px; margin-left:-20px;
      cursor:grab; touch-action:none;
      display:flex; align-items:center; justify-content:center;
      opacity:0; pointer-events:none;
      transition:opacity 0.12s;
    }
    .nb-textbox-wrap.selected .nb-textbox-rotate {
      opacity:1; pointer-events:auto;
    }
    .nb-textbox-rotate:active { cursor:grabbing; }
    .nb-textbox-rotate-dot {
      width:22px; height:22px; border-radius:50%;
      background:#C9A84C; border:2px solid rgba(255,255,255,0.85);
      display:flex; align-items:center; justify-content:center;
      font-size:12px; color:#0d0d1a; line-height:1;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    }
    /* Stem connecting rotate dot to the box */
    .nb-textbox-rotate::before {
      content:''; position:absolute; left:50%; bottom:6px;
      width:2px; height:14px; background:rgba(201,168,76,0.5);
      transform:translateX(-50%);
    }

    /* ── Floating style toolbar ── */
    #nbTextStyleBar {
      position:absolute; z-index:30;
      display:none; align-items:center; gap:5px; flex-wrap:wrap;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:6px 8px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
    }
    #nbTextStyleBar.visible { display:flex; }
    .nb-ts-select {
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      color:#fff; border-radius:6px; padding:4px 6px;
      font:600 11px inherit; outline:none; cursor:pointer; flex-shrink:0;
    }
    .nb-ts-select option { background:#0d0d1a; color:#fff; }
    .nb-ts-btn {
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      color:#fff; border-radius:6px; padding:4px 8px;
      font:700 12px/1 inherit; cursor:pointer; flex-shrink:0;
    }
    .nb-ts-btn.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a; }
    .nb-ts-btn:hover  { background:rgba(255,255,255,0.18); }
    .nb-ts-color {
      width:22px; height:22px; border-radius:50%;
      border:2px solid rgba(255,255,255,0.3); cursor:pointer; flex-shrink:0;
    }
    #nbTsColorPicker { opacity:0; position:fixed; width:1px; height:1px; top:-10px; left:-10px; pointer-events:none; }

    /* ── Shape picker popover ── */
    #nbShapePicker {
      position:absolute; z-index:31; top:54px; left:8px;
      display:none; flex-direction:column; gap:8px;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
      width:200px;
    }
    #nbShapePicker, #nbShapePicker * { color:#fff !important; }
    #nbShapePicker.visible { display:flex; }
    #nbShapeGrid { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; }
    .nb-shape-opt {
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      border-radius:7px; padding:7px 0; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      color:#fff !important; font-size:17px;
    }
    .nb-shape-opt.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a !important; }
    .nb-shape-row { display:flex; align-items:center; gap:6px; }
    .nb-shape-label { font-size:10px; font-weight:700; color:rgba(255,255,255,0.5) !important; letter-spacing:0.3px; }
    #nbShapeFillToggle {
      flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      color:#fff !important; border-radius:7px; padding:6px 0; font:700 11px inherit; cursor:pointer;
    }
    #nbShapeFillToggle.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a !important; }

    /* ── Paper style picker popover ── */
    #nbPaperPicker {
      position:absolute; z-index:31; top:54px; left:8px;
      display:none; flex-direction:column; gap:8px;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
      width:200px;
    }
    #nbPaperPicker, #nbPaperPicker * { color:#fff !important; }
    #nbPaperPicker.visible { display:flex; }
    #nbPaperGrid { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; }
    .nb-paper-opt {
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15);
      border-radius:7px; padding:8px 4px; cursor:pointer;
      display:flex; flex-direction:column; align-items:center; gap:3px;
      color:#fff !important; font-size:16px;
    }
    .nb-paper-opt span.nb-paper-name { font-size:10px; font-weight:700; }
    .nb-paper-opt.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a !important; }
  </style>

  <style>
    /* ── Shape selection overlay — sits over a committed shape, lets you
       drag to move and grab corner handles to resize ── */
    .nb-shape-wrap {
      position:absolute; box-sizing:border-box;
      border:1.5px dashed rgba(201,168,76,0.55);
      border-radius:2px;
      touch-action:none; cursor:move;
    }
    .nb-shape-wrap.selected { border-color:#C9A84C; border-width:2px; }
    .nb-shape-handle {
      position:absolute; width:32px; height:32px; margin:-16px;
      display:flex; align-items:center; justify-content:center;
      touch-action:none;
    }
    .nb-shape-handle::after {
      content:''; display:block; width:14px; height:14px;
      background:#C9A84C; border:2px solid #0d0d1a; border-radius:50%;
    }
    .nb-shape-handle.nw { top:0; left:0; cursor:nwse-resize; }
    .nb-shape-handle.ne { top:0; left:100%; cursor:nesw-resize; }
    .nb-shape-handle.sw { top:100%; left:0; cursor:nesw-resize; }
    .nb-shape-handle.se { top:100%; left:100%; cursor:nwse-resize; }
    .nb-shape-del {
      position:absolute; top:-34px; right:-4px;
      width:28px; height:28px; border-radius:50%;
      background:#e74c3c; border:2px solid rgba(255,255,255,0.8);
      color:#fff; font-size:13px; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      line-height:1; padding:0; cursor:pointer;
      touch-action:manipulation;
    }

    /* ── Floating shape style toolbar (shown when a shape is selected) ── */
    #nbShapeStyleBar {
      position:absolute; z-index:30;
      display:none; align-items:center; gap:5px; flex-wrap:wrap;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:6px 8px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
    }
    #nbShapeStyleBar, #nbShapeStyleBar * { color:#fff !important; }
    #nbShapeStyleBar.visible { display:flex; }
    #nbShapeStyleBar .nb-ts-btn.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a !important; }
  </style>

  <!-- ════ TOOLBAR ════════════════════════════════════════════════════ -->
  <div id="nbToolbarOuter">

    <!-- Full toolbar (hidden when collapsed) -->
    <div id="nbToolbarFull">
      <!-- Sidebar toggle + page title -->
      <button class="nbt" id="nbSideToggle">☰</button>
      <input id="nbPageTitle" placeholder="Untitled page…" value="" autocomplete="off" spellcheck="false" />
      <div class="nb-div"></div>

      <!-- Drawing tools -->
      <button class="nbt active" id="nbPenBtn">✒ Pen</button>
      <button class="nbt"        id="nbHiBtn">🖊 Hi</button>
      <button class="nbt"        id="nbEraserBtn">⌫ Erase</button>
      <button class="nbt"        id="nbShapeBtn">▱ Shape</button>
      <button class="nbt"        id="nbAddTextBtn">🆃 Text Box</button>
      <button class="nbt"        id="nbPanBtn" title="Select tool — tap any stroke or shape to move/resize/delete it, or drag empty space to scroll">✋</button>
      <div class="nb-div"></div>

      <!-- Colours -->
      <div id="nbSwatches"></div>
      <div class="nb-div"></div>

      <!-- Size — fixed container so dot resize never causes reflow -->
      <div id="nbSizeGroup">
        <div id="nbSizeDotWrap"><div id="nbSizeDot"></div></div>
        <input type="range" id="nbSizeSlider" min="1" max="20" value="1.8" step="0.1" />
        <span id="nbSizeVal">1.8</span>
      </div>
      <div class="nb-div"></div>

      <!-- Zoom -->
      <div id="nbZoomGroup">
        <span class="nb-zoom-icon">🔍</span>
        <input type="range" id="nbZoomSlider" min="50" max="300" value="100" step="5" />
        <span id="nbZoomLabel">100%</span>
      </div>
      <div class="nb-div"></div>

      <!-- Paper style -->
      <button class="nbt" id="nbPaperBtn" title="Change paper style">☰ Paper</button>
      <div class="nb-div"></div>

      <!-- Actions -->
      <button class="nbt"       id="nbUndoBtn">↩ Undo</button>
      <button class="nbt red"   id="nbClearBtn">✕</button>
      <button class="nbt blue"  id="nbTranscribeBtn">✦ Text</button>
      <button class="nbt green" id="nbDoneBtn">Save ✓</button>
    </div>

    <!-- Minimal bar — always visible, shows collapse toggle + key tools -->
    <div id="nbToolbarMin">
      <button id="nbTbCollapseBtn" title="Collapse/expand toolbar">▲</button>
      <!-- In collapsed state, show compact tools -->
      <div id="nbMinTools" style="display:none;">
        <button class="nbt active" id="nbPenBtn2">✒</button>
        <button class="nbt"        id="nbHiBtn2">🖊</button>
        <button class="nbt"        id="nbEraserBtn2">⌫</button>
        <button class="nbt"        id="nbShapeBtn2">▱</button>
        <button class="nbt"        id="nbAddTextBtn2">🆃</button>
        <button class="nbt"        id="nbPanBtn2">✋</button>
        <div class="nb-div"></div>
        <div id="nbSwatches2" style="display:flex;gap:3px;align-items:center;flex-shrink:0;"></div>
        <div class="nb-div"></div>
        <button class="nbt green" id="nbDoneBtn2">Save ✓</button>
      </div>
    </div>
  </div>

  <!-- ════ SHELL ════════════════════════════════════════════════════ -->
  <div id="nbShell">
    <!-- Sidebar -->
    <div id="nbSidebar">
      <!-- Toggle tab — always visible on the right edge even when collapsed -->
      <div id="nbSideTab" title="Toggle sidebar">‹</div>
      <div id="nbSideHeader">
        <div id="nbSideTitle">📓 Journal</div>
        <input type="text" id="nbSearchBox" placeholder="Search…" autocomplete="off" />
        <button id="nbNewPageBtn">＋ New Page</button>
        <button id="nbNewFolderBtn">📁 Folder</button>
      </div>
      <div id="nbSideList"></div>
    </div>

    <!-- Main -->
    <div id="nbMain">
      <div id="nbEmptyState">
        <div class="nb-empty-icon">📓</div>
        <div class="nb-empty-title">Your Journal</div>
        <div class="nb-empty-sub">Select a page or create a new one.</div>
        <button class="nbt green" id="nbEmptyNewBtn" style="margin-top:8px;">＋ New Page</button>
      </div>

      <div id="nbCanvasWrap" style="display:none;">
        <!-- Perspective stage — the page-turn animation transforms THIS, leaving
             nbCanvasLayer's own sizing (used by sizeCanvas/text boxes) untouched.
             nbCanvasWrap itself keeps handling scroll/pan/zoom exactly as before. -->
        <div id="nbPageStage">
          <!-- Wrapper that sizes to match the canvas, text boxes live inside here -->
          <div id="nbCanvasLayer" style="position:relative;flex-shrink:0;">
            <canvas id="nbCanvas"></canvas>
            <!-- Text boxes inserted here by JS -->
          </div>
        </div>
        <!-- Incoming-page layer, used only during the turn animation -->
        <div id="nbPageStageIncoming"></div>
        <div class="nb-swipe-hint nb-swipe-hint-left"  id="nbSwipeHintPrev">‹</div>
        <div class="nb-swipe-hint nb-swipe-hint-right" id="nbSwipeHintNext">›</div>
      </div>

      <!-- Paper style picker (shown when Paper button is tapped) -->
      <div id="nbPaperPicker">
        <div class="nb-shape-label">PAPER STYLE</div>
        <div id="nbPaperGrid"></div>
      </div>

      <!-- Shape picker (shown when Shape tool is active) -->
      <div id="nbShapePicker">
        <div class="nb-shape-label">SHAPE</div>
        <div id="nbShapeGrid">
          <div class="nb-shape-opt active" data-shape="rect" title="Rectangle">▭</div>
          <div class="nb-shape-opt" data-shape="square" title="Square">▢</div>
          <div class="nb-shape-opt" data-shape="circle" title="Circle / Ellipse">◯</div>
          <div class="nb-shape-opt" data-shape="triangle" title="Triangle">△</div>
          <div class="nb-shape-opt" data-shape="line" title="Straight line">╱</div>
        </div>
        <div class="nb-shape-row">
          <button id="nbShapeFillToggle">◻ Outline</button>
        </div>
      </div>

      <!-- Floating shape style toolbar (shown when a shape is selected) -->
      <div id="nbShapeStyleBar">
        <div class="nb-ts-color" id="nbSsColorSwatch" title="Shape colour"></div>
        <input type="color" id="nbSsColorPicker" value="#1a1a2e" />
        <input type="range" id="nbSsWidthSlider" min="1" max="20" value="2.5" step="0.1" style="width:60px;" title="Line thickness" />
        <button class="nb-ts-btn" id="nbSsFillToggle">◻ Outline</button>
        <div class="nb-div"></div>
        <button class="nb-ts-btn" id="nbSsDuplicate" title="Duplicate">⧉</button>
        <button class="nb-ts-btn" id="nbSsDelete" title="Delete shape" style="color:#e74c3c;">✕</button>
      </div>

      <!-- Floating text style toolbar (shown when a text box is selected) -->
      <div id="nbTextStyleBar">
        <select class="nb-ts-select" id="nbTsFontFamily">
          <option value="-apple-system,sans-serif">System</option>
          <option value="Georgia,serif">Georgia</option>
          <option value="'Times New Roman',serif">Times New Roman</option>
          <option value="'Courier New',monospace">Courier New</option>
          <option value="Arial,sans-serif">Arial</option>
          <option value="Verdana,sans-serif">Verdana</option>
          <option value="'Trebuchet MS',sans-serif">Trebuchet</option>
        </select>
        <select class="nb-ts-select" id="nbTsFontSize">
          <option value="10">10</option><option value="12">12</option>
          <option value="14" selected>14</option><option value="16">16</option>
          <option value="18">18</option><option value="20">20</option>
          <option value="24">24</option><option value="28">28</option>
          <option value="32">32</option><option value="36">36</option>
          <option value="48">48</option>
        </select>
        <button class="nb-ts-btn" id="nbTsBold" title="Bold"><b>B</b></button>
        <button class="nb-ts-btn" id="nbTsItalic" title="Italic"><i>I</i></button>
        <div class="nb-ts-color" id="nbTsColorSwatch" title="Text colour"></div>
        <input type="color" id="nbTsColorPicker" value="#1a1a2e" />
        <div class="nb-div"></div>
        <button class="nb-ts-btn" id="nbTsResetRotate" title="Reset rotation">⟲ 0°</button>
        <div class="nb-div"></div>
        <button class="nb-ts-btn" id="nbTsDuplicate" title="Duplicate">⧉</button>
        <button class="nb-ts-btn" id="nbTsDelete" title="Delete text box" style="color:#e74c3c;">✕</button>
      </div>

      <!-- Transcription modal -->
      <div id="nbTransModal">
        <div id="nbTransPanel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-size:15px;font-weight:900;color:#fff;">✦ Handwriting → Text</div>
            <button class="nbt" id="nbTransClose">Close</button>
          </div>
          <div id="nbTransStatus" style="font-size:11px;color:rgba(255,255,255,0.45);min-height:16px;"></div>
          <textarea id="nbTransText" placeholder="Transcribed text will appear here…"></textarea>
          <div id="nbCorrectionNote">
            📝 Add corrections — the AI learns from these each time you transcribe.
          </div>
          <div id="nbCorrectionList"></div>
          <button class="nbt" id="nbAddCorrBtn" style="margin-bottom:10px;">＋ Add correction</button>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            <button class="nbt green"  id="nbSaveTransBtn">Save ✓</button>
            <button class="nbt blue"   id="nbRetranscribeBtn">↻ Re-transcribe</button>
            <button class="nbt" id="nbPasteToPageBtn" style="background:rgba(201,168,76,0.2);border-color:rgba(201,168,76,0.5);color:#C9A84C;">📋 Paste to page</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <input type="color" id="nbColorPicker" value="#1a1a2e"
    style="opacity:0;position:fixed;width:1px;height:1px;top:-10px;left:-10px;pointer-events:none;" />
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  /* ══════════════════════════════════════════════════════════════════════
     DOM REFS
  ══════════════════════════════════════════════════════════════════════ */
  const $ = id => overlay.querySelector('#' + id);

  const sideToggle    = $('nbSideToggle');
  const sidebar       = $('nbSidebar');
  const sideList      = $('nbSideList');
  const searchBox     = $('nbSearchBox');
  const newPageBtn    = $('nbNewPageBtn');
  const newFolderBtn  = $('nbNewFolderBtn');
  const emptyState    = $('nbEmptyState');
  const emptyNewBtn   = $('nbEmptyNewBtn');
  const canvasWrap    = $('nbCanvasWrap');
  const pageStage     = $('nbPageStage');
  const pageIncoming  = $('nbPageStageIncoming');
  const swipeHintPrev = $('nbSwipeHintPrev');
  const swipeHintNext = $('nbSwipeHintNext');
  const canvas        = $('nbCanvas');
  const ctx           = canvas.getContext('2d');
  const pageTitleIn   = $('nbPageTitle');

  const tbOuter       = $('nbToolbarOuter');
  const tbFull        = $('nbToolbarFull');
  const tbMin         = $('nbToolbarMin');
  const tbCollapseBtn = $('nbTbCollapseBtn');
  const minTools      = $('nbMinTools');

  const penBtn        = $('nbPenBtn');
  const hiBtn         = $('nbHiBtn');
  const eraserBtn     = $('nbEraserBtn');
  const shapeBtn       = $('nbShapeBtn');
  const addTextBtn     = $('nbAddTextBtn');
  const panBtn        = $('nbPanBtn');
  const undoBtn       = $('nbUndoBtn');
  const clearBtn      = $('nbClearBtn');
  const doneBtn       = $('nbDoneBtn');
  const transcribeBtn = $('nbTranscribeBtn');

  const penBtn2       = $('nbPenBtn2');
  const hiBtn2        = $('nbHiBtn2');
  const eraserBtn2    = $('nbEraserBtn2');
  const shapeBtn2      = $('nbShapeBtn2');
  const addTextBtn2    = $('nbAddTextBtn2');
  const panBtn2        = $('nbPanBtn2');
  const doneBtn2      = $('nbDoneBtn2');

  const swatchesEl    = $('nbSwatches');
  const swatchesEl2   = $('nbSwatches2');
  const sizeSlider    = $('nbSizeSlider');
  const sizeDot       = $('nbSizeDot');
  const sizeVal       = $('nbSizeVal');
  const zoomSlider    = $('nbZoomSlider');
  const zoomLabel     = $('nbZoomLabel');
  const colorPicker   = $('nbColorPicker');

  const transModal    = $('nbTransModal');
  const transText     = $('nbTransText');
  const transStatus   = $('nbTransStatus');
  const transClose    = $('nbTransClose');
  const corrList      = $('nbCorrectionList');
  const addCorrBtn    = $('nbAddCorrBtn');
  const saveTransBtn  = $('nbSaveTransBtn');
  const retransBtn      = $('nbRetranscribeBtn');
  const pasteToPageBtn  = $('nbPasteToPageBtn');
  const canvasLayer     = $('nbCanvasLayer');
  const textStyleBar    = $('nbTextStyleBar');
  const tsFontFamily    = $('nbTsFontFamily');
  const tsFontSize      = $('nbTsFontSize');
  const tsBold          = $('nbTsBold');
  const tsItalic        = $('nbTsItalic');
  const tsColorSwatch   = $('nbTsColorSwatch');
  const tsColorPicker   = $('nbTsColorPicker');
  const tsDuplicate     = $('nbTsDuplicate');
  const tsDelete        = $('nbTsDelete');
  const tsResetRotate   = $('nbTsResetRotate');

  const shapePicker      = $('nbShapePicker');
  const shapeGrid         = $('nbShapeGrid');
  const shapeFillToggle   = $('nbShapeFillToggle');

  const shapeStyleBar     = $('nbShapeStyleBar');
  const ssColorSwatch     = $('nbSsColorSwatch');
  const ssColorPicker     = $('nbSsColorPicker');
  const ssWidthSlider     = $('nbSsWidthSlider');
  const ssFillToggle      = $('nbSsFillToggle');
  const ssDuplicate       = $('nbSsDuplicate');
  const ssDelete          = $('nbSsDelete');

  const paperBtn    = $('nbPaperBtn');
  const paperPicker = $('nbPaperPicker');
  const paperGrid   = $('nbPaperGrid');

  /* ══════════════════════════════════════════════════════════════════════
     TOOLBAR COLLAPSE
  ══════════════════════════════════════════════════════════════════════ */
  tbCollapseBtn.addEventListener('click', () => {
    tbCollapsed = !tbCollapsed;
    tbOuter.classList.toggle('tb-collapsed', tbCollapsed);
    tbCollapseBtn.textContent = tbCollapsed ? '▼' : '▲';
    minTools.style.display    = tbCollapsed ? 'flex' : 'none';
    setTimeout(sizeCanvas, 50);
  });

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR TOGGLE
  ══════════════════════════════════════════════════════════════════════ */
  const sideTab = $('nbSideTab');

  function toggleSidebar() {
    const isNowCollapsed = !sidebar.classList.contains('collapsed');
    sidebar.classList.toggle('collapsed', isNowCollapsed);
    // Arrow points right (open) when collapsed, left (close) when open
    if (sideTab) sideTab.textContent = isNowCollapsed ? '›' : '‹';
    setTimeout(sizeCanvas, 250);
  }

  sideToggle.addEventListener('click', toggleSidebar);
  if (sideTab) sideTab.addEventListener('click', toggleSidebar);

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR RENDER
  ══════════════════════════════════════════════════════════════════════ */
  function pagesInGroup(folderId) {
    return (meta.pages||[])
      .filter(p => (p.folderId||null)===(folderId||null))
      .sort((a,b) => {
        // Pinned pages float to the top within their group
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return (a.order||0) - (b.order||0);
      });
  }

  // The full notebook sequence — folders in their array order, each folder's
  // pages in `order`, then unfiled pages in `order`. This mirrors the
  // sidebar's visual structure exactly and is NOT affected by search filter,
  // so swiping always walks the real notebook regardless of what's typed in
  // the search box. This is the single source of truth for swipe next/prev.
  function notebookSequence() {
    const seq = [];
    (meta.folders||[]).forEach(folder => { pagesInGroup(folder.id).forEach(p => seq.push(p.id)); });
    pagesInGroup(null).forEach(p => seq.push(p.id));
    return seq;
  }

  function renderSidebar(filter='') {
    const fl = filter.toLowerCase().trim();
    let html = '';

    (meta.folders||[]).forEach(folder => {
      const col       = folder.colour || '#C9A84C';
      const collapsed = collapsedFolders.has(folder.id);
      const chevron   = collapsed ? '›' : '⌄';
      const pageCount = pagesInGroup(folder.id).length;
      const countBadge = collapsed && pageCount
        ? `<span class="nb-folder-count">${pageCount}</span>` : '';
      html += `<div class="nb-folder-row${collapsed?' nb-folder-collapsed':''}" data-folder-id="${folder.id}">
        <span class="nb-folder-chevron">${chevron}</span>
        <span class="nb-folder-dot" data-colour-folder="${folder.id}" title="Set colour" style="background:${col};cursor:pointer;"></span>
        <span class="nb-folder-name">📁 ${folder.name}</span>
        ${countBadge}
        <div class="nb-folder-actions">
          <button class="nb-folder-action-btn" data-rename-folder="${folder.id}">✎</button>
          <button class="nb-folder-action-btn" data-delete-folder="${folder.id}" style="color:rgba(231,76,60,0.7);">✕</button>
        </div>
      </div>`;
      if (!collapsed) {
        pagesInGroup(folder.id)
          .filter(p => matchFilter(p,fl))
          .forEach(p => { html += pageRowHtml(p,true); });
      }
    });

    const unfiled = pagesInGroup(null).filter(p => matchFilter(p,fl));
    if (unfiled.length && (meta.folders||[]).length)
      html += `<div class="nb-unfiled-label" style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;padding:9px 7px 3px;">Unfiled</div>`;
    unfiled.forEach(p => { html += pageRowHtml(p,false); });

    if (!html) html = `<div style="padding:18px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);">No pages yet.</div>`;

    sideList.innerHTML = html;

    sideList.querySelectorAll('.nb-page-row').forEach(el => {
      el.addEventListener('click', e => { if (dragState) return; loadPage(el.dataset.pageId); });
      el.querySelector('.nb-page-del').addEventListener('click', e => { e.stopPropagation(); deletePage(el.dataset.pageId); });
      el.querySelector('.nb-page-handle').addEventListener('pointerdown', e => startPageDrag(e, el));
      el.querySelector('.nb-page-rename').addEventListener('click', e => { e.stopPropagation(); renamePage(el.dataset.pageId); });
      el.querySelector('.nb-page-colour-dot').addEventListener('click', e => { e.stopPropagation(); pickPageColour(el.dataset.pageId, e.currentTarget); });
      el.querySelector('.nb-page-pin').addEventListener('click', e => { e.stopPropagation(); togglePin(el.dataset.pageId); });
    });
    sideList.querySelectorAll('[data-rename-folder]').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); renameFolder(btn.dataset.renameFolder); }));
    sideList.querySelectorAll('[data-delete-folder]').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); deleteFolder(btn.dataset.deleteFolder); }));
    sideList.querySelectorAll('[data-colour-folder]').forEach(dot =>
      dot.addEventListener('click', e => { e.stopPropagation(); pickFolderColour(dot.dataset.colourFolder, dot); }));
    sideList.querySelectorAll('.nb-folder-row').forEach(row => {
      row.addEventListener('click', e => {
        // Don't toggle if clicking an action button or colour dot
        if (e.target.closest('.nb-folder-actions') || e.target.closest('[data-colour-folder]')) return;
        const id = row.dataset.folderId;
        if (collapsedFolders.has(id)) collapsedFolders.delete(id);
        else collapsedFolders.add(id);
        renderSidebar(searchBox.value);
      });
    });

    if (activePageId) {
      const el = sideList.querySelector(`[data-page-id="${activePageId}"]`);
      if (el) {
        el.classList.add('active');
        // If the page has a colour, tint the active row's left border with it
        const page = (meta.pages||[]).find(p=>p.id===activePageId);
        if (page?.colour) el.style.borderLeftColor = page.colour;
      }
    }
    // Apply subtle left tint to all coloured rows (not just active)
    sideList.querySelectorAll('.nb-page-row').forEach(el => {
      const page = (meta.pages||[]).find(p=>p.id===el.dataset.pageId);
      if (page?.colour && el.dataset.pageId !== activePageId) {
        el.style.borderLeftColor = page.colour + '88'; // 53% opacity tint
      }
    });
  }

  function matchFilter(p,fl) { return !fl || (p.title||'').toLowerCase().includes(fl) || (p.dateKey||'').includes(fl); }

  function pageRowHtml(page, indented) {
    const col = page.colour || null;
    const dotStyle = col
      ? `background:${col};width:8px;height:8px;border-radius:50%;flex-shrink:0;`
      : `width:8px;height:8px;border-radius:50%;flex-shrink:0;border:1px dashed rgba(255,255,255,0.25);`;
    const pinIcon  = page.pinned ? '★' : '☆';
    const pinTitle = page.pinned ? 'Unpin page' : 'Pin to top';
    const pinStyle = page.pinned ? 'color:#C9A84C !important;' : '';
    return `<div class="nb-page-row${page.pinned?' nb-page-pinned':''}" data-page-id="${page.id}" style="${indented?'padding-left:20px;':''}">
      <span class="nb-page-handle" title="Drag to reorder / move to folder">⠿</span>
      <span class="nb-page-colour-dot" data-colour-page="${page.id}" title="Set colour" style="${dotStyle}"></span>
      <div class="nb-page-info">
        <div class="nb-page-title">${page.title||'Untitled'}</div>
        <div class="nb-page-date">${fmtDate(page.dateKey||todayISO())}</div>
      </div>
      <div class="nb-page-actions">
        <button class="nb-page-action-btn nb-page-pin" data-pin-page="${page.id}" title="${pinTitle}" style="${pinStyle}">${pinIcon}</button>
        <button class="nb-page-action-btn nb-page-rename" data-rename-page="${page.id}" title="Rename">✎</button>
        <button class="nb-page-action-btn nb-page-del" title="Delete">🗑</button>
      </div>
    </div>`;
  }

  /* ── DRAG-TO-REORDER / DRAG-TO-REFILE ──────────────────────────────────
     Dragging a page row's handle lets you drop it:
       - onto another page row → reorders within that row's group (folder or
         unfiled), inserting before/after based on drop position
       - onto a folder header → refiles into that folder, appended at the end
       - onto the "Unfiled" label / empty space below the list → unfiles it
     This directly rewrites `folderId`/`order`, which is also what drives
     swipe sequence — so reordering here IS reordering the notebook. */
  let dragState = null; // { pageId, ghostEl, lastTargetEl }
  const collapsedFolders = new Set(); // folder ids that are currently collapsed

  function startPageDrag(e, rowEl) {
    e.preventDefault();
    e.stopPropagation();
    const pageId = rowEl.dataset.pageId;
    const rect = rowEl.getBoundingClientRect();
    const ghost = rowEl.cloneNode(true);
    ghost.classList.add('nb-page-row-ghost');
    ghost.style.width = rect.width+'px';
    document.body.appendChild(ghost);
    rowEl.classList.add('nb-page-row-dragging');

    dragState = {
      pageId, ghostEl: ghost, rowEl,
      offsetX: e.clientX-rect.left, offsetY: e.clientY-rect.top,
      lastTargetEl: null, lastTargetPos: null,
    };
    positionGhost(e.clientX, e.clientY);

    const move = ev => onPageDragMove(ev);
    const up   = ev => endPageDrag(ev, move, up);
    window.addEventListener('pointermove', move, { passive:false });
    window.addEventListener('pointerup', up, { passive:false });
    window.addEventListener('pointercancel', up, { passive:false });
  }

  function positionGhost(clientX, clientY) {
    if (!dragState) return;
    dragState.ghostEl.style.left = (clientX-dragState.offsetX)+'px';
    dragState.ghostEl.style.top  = (clientY-dragState.offsetY)+'px';
  }

  const SIDEBAR_SCROLL_EDGE = 36;
  function autoScrollSidebar(clientY) {
    const r = sideList.getBoundingClientRect();
    if (clientY < r.top+SIDEBAR_SCROLL_EDGE)        sideList.scrollTop -= 10;
    else if (clientY > r.bottom-SIDEBAR_SCROLL_EDGE) sideList.scrollTop += 10;
  }

  function onPageDragMove(e) {
    if (!dragState) return;
    e.preventDefault();
    positionGhost(e.clientX, e.clientY);
    autoScrollSidebar(e.clientY);

    // Clear previous highlight
    if (dragState.lastTargetEl) dragState.lastTargetEl.classList.remove('nb-drop-above','nb-drop-below','nb-drop-into');
    dragState.lastTargetEl = null; dragState.lastTargetPos = null;

    dragState.ghostEl.style.visibility = 'hidden';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    dragState.ghostEl.style.visibility = 'visible';
    if (!under) return;

    const folderRow = under.closest('.nb-folder-row');
    if (folderRow) {
      folderRow.classList.add('nb-drop-into');
      dragState.lastTargetEl = folderRow; dragState.lastTargetPos = 'into-folder';
      return;
    }
    const pageRow = under.closest('.nb-page-row');
    if (pageRow && pageRow.dataset.pageId !== dragState.pageId) {
      const r = pageRow.getBoundingClientRect();
      const above = (e.clientY - r.top) < r.height/2;
      pageRow.classList.add(above ? 'nb-drop-above' : 'nb-drop-below');
      dragState.lastTargetEl = pageRow; dragState.lastTargetPos = above ? 'above' : 'below';
      return;
    }
    // Dropping on the "Unfiled" section label, or empty space in the
    // sidebar list below all rows, unfiles the page.
    const unfiledLabel = under.closest('.nb-unfiled-label');
    if (unfiledLabel || under===sideList) {
      sideList.classList.add('nb-drop-into');
      dragState.lastTargetEl = sideList; dragState.lastTargetPos = 'unfile';
    }
  }

  function endPageDrag(e, moveHandler, upHandler) {
    window.removeEventListener('pointermove', moveHandler);
    window.removeEventListener('pointerup', upHandler);
    window.removeEventListener('pointercancel', upHandler);
    if (!dragState) return;
    const { pageId, ghostEl, rowEl, lastTargetEl, lastTargetPos } = dragState;
    if (lastTargetEl) lastTargetEl.classList.remove('nb-drop-above','nb-drop-below','nb-drop-into');
    ghostEl.remove();
    rowEl && rowEl.classList.remove('nb-page-row-dragging');
    dragState = null;

    const page = (meta.pages||[]).find(p=>p.id===pageId);
    if (!page || !lastTargetEl) return;

    if (lastTargetPos === 'into-folder') {
      const folderId = lastTargetEl.dataset.folderId;
      page.folderId = folderId;
      page.order = nextOrderInGroup(folderId);
    } else if (lastTargetPos === 'unfile') {
      page.folderId = null;
      page.order = nextOrderInGroup(null);
    } else {
      const targetId = lastTargetEl.dataset.pageId;
      const target = (meta.pages||[]).find(p=>p.id===targetId);
      if (!target) return;
      page.folderId = target.folderId||null;
      reorderRelativeTo(page, target, lastTargetPos==='above');
    }
    page.updatedAt = Date.now();
    persistMeta();
    renderSidebar(searchBox.value);
  }

  // Insert `page` immediately before/after `target` within target's group,
  // renumbering that group's order field to keep it clean (0,1,2,...).
  function reorderRelativeTo(page, target, before) {
    const group = pagesInGroup(target.folderId).filter(p => p.id!==page.id);
    const idx = group.findIndex(p => p.id===target.id);
    const insertAt = before ? idx : idx+1;
    group.splice(insertAt, 0, page);
    group.forEach((p,i) => { p.order = i; });
  }

  searchBox.addEventListener('input', () => renderSidebar(searchBox.value));

  /* ══════════════════════════════════════════════════════════════════════
     PAGE MANAGEMENT
     Pages carry a manual `order` (float) that drives BOTH sidebar position
     and swipe-between-pages sequence — dragging a row in the sidebar is the
     single source of truth for "where is this page in the notebook".
  ══════════════════════════════════════════════════════════════════════ */
  function nextOrderInGroup(folderId) {
    const siblings = (meta.pages||[]).filter(p => (p.folderId||null)===(folderId||null));
    if (!siblings.length) return 0;
    return Math.max(...siblings.map(p => p.order||0)) + 1;
  }

  function newPage(folderId=null) {
    saveCurrentPage();
    const id=uid(), now=Date.now();
    meta.pages = meta.pages||[];
    meta.pages.push({ id, dateKey:todayISO(), title:'', folderId, order:nextOrderInGroup(folderId), createdAt:now, updatedAt:now });
    pages[id] = { strokes:[], transcription:null };
    persistMeta();
    loadPage(id, true);
  }

  // Set true only while finishSwipe is actively staging its own unfold-in
  // animation immediately after calling loadPage — lets loadPage's defensive
  // reset below stay on for every other caller (sidebar click, new page)
  // without it clobbering the swipe animation's own transform handoff.
  let suppressStageReset = false;

  function loadPage(id, isNew=false) {
    saveCurrentPage();
    activePageId = id;
    const page = (meta.pages||[]).find(p=>p.id===id);
    if (!page) return;
    strokes   = (pages[id]?.strokes||[]).map(s=>({...s, points:s.points?s.points.slice():undefined, id:s.id||uid()}));
    textBoxes = (pages[id]?.textBoxes||[]).map(tb=>({...tb}));
    paperStyle = pages[id]?.paperStyle || 'lined';
    selectedTB = null;
    selectedShape = null;
    curShapePreview = null;
    undoStack = []; curStroke = null; dirtyFlag = false;
    pageTitleIn.value = page.title||'';
    emptyState.style.display = 'none';
    canvasWrap.style.display = 'flex';
    // Always land flat — guards against any stale mid-swipe transform if a
    // page load happens via a path other than the swipe gesture's own cleanup
    // (e.g. tapping a sidebar row while a swipe spring is in progress).
    if (pageStage && !suppressStageReset) {
      pageStage.style.transition = '';
      pageStage.style.transform  = '';
    }
    if (pageIncoming && !suppressStageReset) {
      pageIncoming.style.display    = 'none';
      pageIncoming.style.transform  = '';
      pageIncoming.style.transition = '';
    }
    if (pageStage?._shadowEl && !suppressStageReset) pageStage._shadowEl.style.opacity = 0;
    sizeCanvas();
    renderSidebar(searchBox.value);
    syncPaperStyleUI();
    if (isNew) setTimeout(()=>pageTitleIn.focus(), 120);
  }

  function saveCurrentPage() {
    if (!activePageId||!dirtyFlag) return;
    const page = (meta.pages||[]).find(p=>p.id===activePageId);
    if (!page) return;
    page.title     = pageTitleIn.value.trim()||todayISO();
    page.updatedAt = Date.now();
    pages[activePageId] = pages[activePageId]||{};
    pages[activePageId].strokes = strokes.map(s => {
      if (s.tool==='shape') {
        return {
          id:s.id||uid(), tool:'shape', kind:s.kind, filled:s.filled, color:s.color, width:s.width,
          x0:Math.round(s.x0*10)/10, y0:Math.round(s.y0*10)/10,
          x1:Math.round(s.x1*10)/10, y1:Math.round(s.y1*10)/10,
        };
      }
      return {
        id:s.id||uid(), tool:s.tool, color:s.color, width:s.width,
        points:s.points.map(p=>({ x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10 })),
      };
    });
    pages[activePageId].textBoxes = textBoxes.map(tb=>({...tb}));
    pages[activePageId].paperStyle = paperStyle;
    persistMeta();
    dirtyFlag = false;
  }

  function deletePage(id) {
    if (!confirm('Delete this page permanently?')) return;
    meta.pages = (meta.pages||[]).filter(p=>p.id!==id);
    delete pages[id];
    if (activePageId===id) {
      activePageId=null; strokes=[];
      canvasWrap.style.display='none';
      emptyState.style.display='flex';
    }
    persistMeta(); renderSidebar(searchBox.value);
  }

  newPageBtn.addEventListener('click',   ()=>newPage());
  emptyNewBtn.addEventListener('click',  ()=>newPage());
  newFolderBtn.addEventListener('click', ()=>{
    const name=prompt('Folder name:'); if (!name?.trim()) return;
    const cols=['#C9A84C','#3498db','#2ecc71','#e74c3c','#9b59b6'];
    meta.folders=meta.folders||[];
    meta.folders.push({ id:uid(), name:name.trim(), colour:cols[meta.folders.length%cols.length] });
    persistMeta(); renderSidebar(searchBox.value);
  });

  function renameFolder(id) {
    const f=(meta.folders||[]).find(x=>x.id===id); if (!f) return;
    const n=prompt('Rename folder:',f.name); if (!n?.trim()) return;
    f.name=n.trim(); persistMeta(); renderSidebar(searchBox.value);
  }
  function deleteFolder(id) {
    if (!confirm('Delete folder? Pages become unfiled.')) return;
    meta.folders=(meta.folders||[]).filter(x=>x.id!==id);
    (meta.pages||[]).forEach(p=>{ if(p.folderId===id) p.folderId=null; });
    persistMeta(); renderSidebar(searchBox.value);
  }

  function togglePin(id) {
    const page = (meta.pages||[]).find(p=>p.id===id); if (!page) return;
    page.pinned = !page.pinned;
    persistMeta(); renderSidebar(searchBox.value);
  }

  function renamePage(id) {
    const page = (meta.pages||[]).find(p=>p.id===id); if (!page) return;
    // Find the title element in the sidebar and make it inline-editable
    const row = sideList.querySelector(`[data-page-id="${id}"]`); if (!row) return;
    const titleEl = row.querySelector('.nb-page-title'); if (!titleEl) return;
    const current = page.title || '';
    titleEl.contentEditable = 'true';
    titleEl.textContent = current;
    titleEl.style.outline = '1px solid rgba(201,168,76,0.6)';
    titleEl.style.borderRadius = '3px';
    titleEl.style.padding = '0 2px';
    titleEl.focus();
    // Select all text
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    sel.removeAllRanges(); sel.addRange(range);
    function commit() {
      const newTitle = titleEl.textContent.trim() || todayISO();
      titleEl.contentEditable = 'false';
      titleEl.style.outline = '';
      titleEl.style.borderRadius = '';
      titleEl.style.padding = '';
      page.title = newTitle;
      // Keep toolbar title in sync if this is the open page
      if (activePageId === id && pageTitleIn) pageTitleIn.value = newTitle;
      persistMeta(); renderSidebar(searchBox.value);
    }
    titleEl.addEventListener('blur', commit, { once: true });
    titleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      if (e.key === 'Escape') { titleEl.textContent = current; titleEl.blur(); }
    }, { once: true });
  }

  // Colour swatches available for page colour-coding
  const PAGE_COLOURS = [
    '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
    '#3498db','#9b59b6','#e91e63','#795548','#607d8b',
  ];
  let colourPopover = null;

  function pickPageColour(id, dotEl) {
    // Close any existing popover
    if (colourPopover) { colourPopover.remove(); colourPopover = null; }
    const page = (meta.pages||[]).find(p=>p.id===id); if (!page) return;

    const pop = document.createElement('div');
    pop.style.cssText = `
      position:fixed; z-index:99999;
      background:#1e1e2e; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:8px 10px;
      box-shadow:0 8px 28px rgba(0,0,0,0.55);
      display:flex; flex-wrap:wrap; gap:7px; width:156px;
    `;
    // Position below the dot
    const r = dotEl.getBoundingClientRect();
    pop.style.top  = (r.bottom + 6) + 'px';
    pop.style.left = (r.left - 8)   + 'px';

    PAGE_COLOURS.forEach(col => {
      const sw = document.createElement('div');
      sw.style.cssText = `
        width:20px; height:20px; border-radius:50%; background:${col};
        cursor:pointer; flex-shrink:0;
        box-shadow: ${page.colour===col ? '0 0 0 2px #fff, 0 0 0 4px '+col : 'none'};
        transition: transform 0.1s;
      `;
      sw.title = col;
      sw.addEventListener('click', e => {
        e.stopPropagation();
        page.colour = col;
        persistMeta(); renderSidebar(searchBox.value);
        pop.remove(); colourPopover = null;
      });
      sw.addEventListener('pointerenter', () => { sw.style.transform = 'scale(1.2)'; });
      sw.addEventListener('pointerleave', () => { sw.style.transform = ''; });
      pop.appendChild(sw);
    });

    // Clear option
    const clear = document.createElement('div');
    clear.title = 'Remove colour';
    clear.style.cssText = `
      width:20px; height:20px; border-radius:50%; cursor:pointer;
      flex-shrink:0; border:1px dashed rgba(255,255,255,0.35);
      display:flex; align-items:center; justify-content:center;
      color:rgba(255,255,255,0.45); font-size:10px;
      transition: transform 0.1s;
    `;
    clear.textContent = '✕';
    clear.addEventListener('click', e => {
      e.stopPropagation();
      delete page.colour;
      persistMeta(); renderSidebar(searchBox.value);
      pop.remove(); colourPopover = null;
    });
    pop.appendChild(clear);

    document.body.appendChild(pop);
    colourPopover = pop;

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('pointerdown', function close(e) {
        if (!pop.contains(e.target)) { pop.remove(); colourPopover = null; document.removeEventListener('pointerdown', close); }
      });
    }, 10);
  }

  function pickFolderColour(id, dotEl) {
    if (colourPopover) { colourPopover.remove(); colourPopover = null; }
    const folder = (meta.folders||[]).find(f=>f.id===id); if (!folder) return;
    const current = folder.colour || '#C9A84C';

    const pop = document.createElement('div');
    pop.style.cssText = `
      position:fixed; z-index:99999;
      background:#1e1e2e; border:1px solid rgba(255,255,255,0.15);
      border-radius:10px; padding:8px 10px;
      box-shadow:0 8px 28px rgba(0,0,0,0.55);
      display:flex; flex-wrap:wrap; gap:7px; width:156px;
    `;
    const r = dotEl.getBoundingClientRect();
    pop.style.top  = (r.bottom + 6) + 'px';
    pop.style.left = (r.left - 8)   + 'px';

    const FOLDER_COLOURS = ['#C9A84C','#e74c3c','#e67e22','#f1c40f','#2ecc71',
                            '#1abc9c','#3498db','#9b59b6','#e91e63','#607d8b'];
    FOLDER_COLOURS.forEach(col => {
      const sw = document.createElement('div');
      sw.style.cssText = `
        width:20px; height:20px; border-radius:50%; background:${col};
        cursor:pointer; flex-shrink:0;
        box-shadow:${current===col ? '0 0 0 2px #fff, 0 0 0 4px '+col : 'none'};
        transition:transform 0.1s;
      `;
      sw.addEventListener('click', e => {
        e.stopPropagation();
        folder.colour = col;
        persistMeta(); renderSidebar(searchBox.value);
        pop.remove(); colourPopover = null;
      });
      sw.addEventListener('pointerenter', () => { sw.style.transform = 'scale(1.2)'; });
      sw.addEventListener('pointerleave', () => { sw.style.transform = ''; });
      pop.appendChild(sw);
    });

    document.body.appendChild(pop);
    colourPopover = pop;
    setTimeout(() => {
      document.addEventListener('pointerdown', function close(e) {
        if (!pop.contains(e.target)) { pop.remove(); colourPopover = null; document.removeEventListener('pointerdown', close); }
      });
    }, 10);
  }

  pageTitleIn.addEventListener('blur',()=>{
    if (!activePageId) return;
    const page=(meta.pages||[]).find(p=>p.id===activePageId);
    if (page) { page.title=pageTitleIn.value.trim()||todayISO(); persistMeta(); }
    renderSidebar(searchBox.value);
  });

  function persistMeta() {
    state.data.notebookMeta  = meta;
    state.data.notebookPages = pages;
    if (saveData) saveData();
  }

  /* ══════════════════════════════════════════════════════════════════════
     CANVAS SIZING
  ══════════════════════════════════════════════════════════════════════ */
  function getBaseWidth() {
    return Math.max(320, Math.min(960, canvasWrap.clientWidth - 40));
  }

  function sizeCanvas() {
    if (!activePageId) return;
    const dpr = window.devicePixelRatio||1;
    const bw  = getBaseWidth();
    const bh  = LINE_SPACING*PAGE_ROWS + LINE_SPACING;
    const w   = Math.round(bw*zoomLevel);
    const h   = Math.round(bh*zoomLevel);
    canvas.width        = w*dpr;
    canvas.height       = h*dpr;
    canvas.style.width  = w+'px';
    canvas.style.height = h+'px';
    // Keep the canvasLayer overlay the same size so text boxes stay aligned
    if (canvasLayer) {
      canvasLayer.style.width  = w+'px';
      canvasLayer.style.height = h+'px';
    }
    ctx.setTransform(dpr*zoomLevel, 0, 0, dpr*zoomLevel, 0, 0);
    drawPaper();
    redrawStrokes();
    // Re-position text boxes to match new zoom (full rebuild only on page load)
    if (canvasLayer && canvasLayer.querySelector('.nb-textbox-wrap')) {
      reposAllTextBoxes();
    } else {
      renderAllTextBoxDOMs();
    }
    reposSelectedShapeOverlay();
  }

  /* ══════════════════════════════════════════════════════════════════════
     ZOOM
  ══════════════════════════════════════════════════════════════════════ */
  function applyZoom(newZoom, pivotClientX, pivotClientY) {
    newZoom = Math.min(3, Math.max(0.5, newZoom));
    // Preserve scroll position relative to the pivot point
    if (pivotClientX !== undefined) {
      const wrapRect = canvasWrap.getBoundingClientRect();
      const oldScrollX = canvasWrap.scrollLeft;
      const oldScrollY = canvasWrap.scrollTop;
      const pivotX = pivotClientX - wrapRect.left + oldScrollX; // px in scroll space
      const pivotY = pivotClientY - wrapRect.top  + oldScrollY;
      const ratio  = newZoom / zoomLevel;
      zoomLevel = newZoom;
      sizeCanvas();
      canvasWrap.scrollLeft = pivotX * ratio - (pivotClientX - wrapRect.left);
      canvasWrap.scrollTop  = pivotY * ratio - (pivotClientY - wrapRect.top);
    } else {
      zoomLevel = newZoom;
      sizeCanvas();
    }
    zoomSlider.value      = Math.round(newZoom*100);
    zoomLabel.textContent = Math.round(newZoom*100)+'%';
  }

  zoomSlider.addEventListener('input', () => {
    applyZoom(parseInt(zoomSlider.value)/100);
  });

  window.addEventListener('resize', ()=>{ if (activePageId) sizeCanvas(); });

  /* ══════════════════════════════════════════════════════════════════════
     PAPER DRAWING
  ══════════════════════════════════════════════════════════════════════ */
  function drawPaperOnContext(c, w, h, scale, style, pageNum) {
    c.save();
    c.fillStyle = PAPER_BG;
    c.fillRect(0,0,w,h);

    if (style==='lined') {
      c.strokeStyle = LINE_COLOR;
      c.lineWidth   = 1;
      for (let row=2; row<=PAGE_ROWS; row++) {
        const y = row*LINE_SPACING*scale;
        c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke();
      }
      c.strokeStyle = MARGIN_COLOR;
      c.lineWidth   = 1.5;
      const mx = MARGIN_LEFT*scale;
      c.beginPath(); c.moveTo(mx,0); c.lineTo(mx,h); c.stroke();

      c.fillStyle = '#ccc';
      for (let row=1; row<=PAGE_ROWS; row+=2) {
        const y = row*LINE_SPACING*scale;
        c.beginPath(); c.arc(14*scale, y, 5*scale, 0, Math.PI*2); c.fill();
      }
    } else if (style==='squared') {
      c.strokeStyle = LINE_COLOR;
      c.lineWidth   = 1;
      for (let y=GRID_SPACING*scale; y<h; y+=GRID_SPACING*scale) {
        c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke();
      }
      for (let x=GRID_SPACING*scale; x<w; x+=GRID_SPACING*scale) {
        c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke();
      }
    } else if (style==='dotted') {
      c.fillStyle = '#c0c8d8';
      const r = 1.3*scale;
      for (let y=GRID_SPACING*scale; y<h; y+=GRID_SPACING*scale) {
        for (let x=GRID_SPACING*scale; x<w; x+=GRID_SPACING*scale) {
          c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
        }
      }
    }
    // 'plain' — background only, no lines/dots/margin

    // Page number watermark in top-right, drawn in pixel space (scale already applied)
    if (pageNum) {
      const fontSize = Math.round(13 * scale);
      c.font = `400 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;
      c.fillStyle = 'rgba(160,170,185,0.55)';
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillText(pageNum, w - 18*scale, 14*scale);
    }

    c.restore();
  }

  function drawPaper() {
    const dpr   = window.devicePixelRatio||1;
    const scale = dpr*zoomLevel;
    const pw    = canvas.width;
    const ph    = canvas.height;

    const pageNum = activePageId ? (notebookSequence().indexOf(activePageId) + 1) : 0;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    drawPaperOnContext(ctx, pw, ph, scale, paperStyle, pageNum || undefined);
    ctx.restore();
    ctx.setTransform(dpr*zoomLevel, 0, 0, dpr*zoomLevel, 0, 0);
  }

  // Draws just the paper's line/grid/dot art (no background fill) in LOGICAL
  // (unscaled) coordinates — i.e. the same coordinate space strokes use. Used
  // to redraw ruling under an eraser stroke after the ink there is wiped, so
  // erasing reveals blank-but-ruled paper instead of removing the lines too.
  // `bounds`, if given, restricts which rows/columns/dots are iterated to
  // those overlapping {minX,minY,maxX,maxY} — keeps the small eraser patch
  // canvas cheap instead of looping the whole page on every redraw.
  function drawPaperLinesLogical(c, bw, bh, style, bounds) {
    const minX = bounds ? Math.max(0, bounds.minX) : 0;
    const maxX = bounds ? Math.min(bw, bounds.maxX) : bw;
    const minY = bounds ? Math.max(0, bounds.minY) : 0;
    const maxY = bounds ? Math.min(bh, bounds.maxY) : bh;

    if (style==='lined') {
      c.strokeStyle = LINE_COLOR;
      c.lineWidth   = 1;
      const rowLo = Math.max(2, Math.floor(minY/LINE_SPACING));
      const rowHi = Math.min(PAGE_ROWS, Math.ceil(maxY/LINE_SPACING));
      for (let row=rowLo; row<=rowHi; row++) {
        const y = row*LINE_SPACING;
        c.beginPath(); c.moveTo(minX,y); c.lineTo(maxX,y); c.stroke();
      }
      if (MARGIN_LEFT>=minX-2 && MARGIN_LEFT<=maxX+2) {
        c.strokeStyle = MARGIN_COLOR;
        c.lineWidth   = 1.5;
        c.beginPath(); c.moveTo(MARGIN_LEFT,minY); c.lineTo(MARGIN_LEFT,maxY); c.stroke();
      }
      c.fillStyle = '#ccc';
      const dotLo = Math.max(1, Math.floor(minY/LINE_SPACING));
      const dotHi = Math.min(PAGE_ROWS, Math.ceil(maxY/LINE_SPACING));
      for (let row=dotLo; row<=dotHi; row+=2) {
        if (14<minX-6 || 14>maxX+6) continue;
        const y = row*LINE_SPACING;
        c.beginPath(); c.arc(14, y, 5, 0, Math.PI*2); c.fill();
      }
    } else if (style==='squared') {
      c.strokeStyle = LINE_COLOR;
      c.lineWidth   = 1;
      const yLo = Math.max(GRID_SPACING, Math.floor(minY/GRID_SPACING)*GRID_SPACING);
      for (let y=yLo; y<=maxY; y+=GRID_SPACING) {
        c.beginPath(); c.moveTo(minX,y); c.lineTo(maxX,y); c.stroke();
      }
      const xLo = Math.max(GRID_SPACING, Math.floor(minX/GRID_SPACING)*GRID_SPACING);
      for (let x=xLo; x<=maxX; x+=GRID_SPACING) {
        c.beginPath(); c.moveTo(x,minY); c.lineTo(x,maxY); c.stroke();
      }
    } else if (style==='dotted') {
      c.fillStyle = '#c0c8d8';
      const yLo = Math.max(GRID_SPACING, Math.floor(minY/GRID_SPACING)*GRID_SPACING);
      const xLo = Math.max(GRID_SPACING, Math.floor(minX/GRID_SPACING)*GRID_SPACING);
      for (let y=yLo; y<=maxY; y+=GRID_SPACING) {
        for (let x=xLo; x<=maxX; x+=GRID_SPACING) {
          c.beginPath(); c.arc(x,y,1.3,0,Math.PI*2); c.fill();
        }
      }
    }
    // 'plain' — nothing to redraw beyond the background
  }

  /* ══════════════════════════════════════════════════════════════════════
     ERASER — reveals paper (including ruling) rather than cutting a
     transparent hole through to the app's dark background.
     Technique: build a small offscreen "patch" canvas covering the eraser
     stroke's bounding box, paint paper background + ruling into it, then use
     destination-in compositing with the actual stroke shape to mask the
     patch down to just the round-capped stroke silhouette. That patch is
     then drawn onto the real canvas with source-over, so only the area the
     eraser actually swept through gets replaced — and what's revealed is
     blank ruled paper, not a flat colour wipe.
  ══════════════════════════════════════════════════════════════════════ */
  function eraseWithPaperPatch(c, s) {
    const pad = (s.width||ERASER_W)/2 + 2;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    s.points.forEach(p => {
      if (p.x<minX) minX=p.x; if (p.x>maxX) maxX=p.x;
      if (p.y<minY) minY=p.y; if (p.y>maxY) maxY=p.y;
    });
    minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
    const pw = Math.max(1, Math.ceil(maxX-minX));
    const ph = Math.max(1, Math.ceil(maxY-minY));
    if (!isFinite(pw) || !isFinite(ph) || pw>4000 || ph>4000) return; // sanity guard

    const patch = document.createElement('canvas');
    patch.width = pw; patch.height = ph;
    const pc = patch.getContext('2d');

    // 1) Paint paper background + ruling, offset into the patch's local space
    pc.save();
    pc.translate(-minX, -minY);
    pc.fillStyle = PAPER_BG;
    pc.fillRect(minX, minY, pw, ph);
    drawPaperLinesLogical(pc, getBaseWidth(), LINE_SPACING*PAGE_ROWS+LINE_SPACING, paperStyle, {minX,minY,maxX,maxY});
    pc.restore();

    // 2) Mask the patch down to just the stroke's round-capped silhouette
    pc.save();
    pc.translate(-minX, -minY);
    pc.globalCompositeOperation = 'destination-in';
    pc.strokeStyle = '#000';
    pc.lineWidth = s.width;
    pc.lineCap = 'round'; pc.lineJoin = 'round';
    smoothPath(pc, s.points);
    pc.restore();

    // 3) Stamp the masked patch onto the real canvas at its logical position
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.drawImage(patch, minX, minY, pw, ph);
    c.restore();
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE RENDERING — uniform width, no pressure
  ══════════════════════════════════════════════════════════════════════ */
  function redrawStrokes() {
    drawPaper();
    strokes.forEach(s => renderStroke(ctx,s));
  }

  function renderStroke(c,s) {
    if (s.tool==='shape') { renderShape(c,s); return; }
    if (!s.points||s.points.length<2) return;

    if (s.tool==='eraser') {
      eraseWithPaperPatch(c, s);
      return;
    }

    c.save();
    c.lineCap='round'; c.lineJoin='round';

    if (s.tool==='highlighter') {
      c.globalAlpha=0.38;
      c.strokeStyle=s.color||'#FFEB3B';
      c.lineWidth=s.width||22;
      c.lineCap='square'; c.lineJoin='square';
      c.globalCompositeOperation='multiply';
      smoothPath(c,s.points);
    } else {
      c.lineWidth=s.width||strokeW;
      c.strokeStyle=s.color||INK_DEFAULT;
      c.globalCompositeOperation='source-over';
      smoothPath(c,s.points);
    }
    c.restore();
  }

  function smoothPath(c,pts) {
    c.beginPath(); c.moveTo(pts[0].x,pts[0].y);
    for (let i=1; i<pts.length-1; i++) {
      c.quadraticCurveTo(pts[i].x,pts[i].y, (pts[i].x+pts[i+1].x)/2, (pts[i].y+pts[i+1].y)/2);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke();
  }

  /* ══════════════════════════════════════════════════════════════════════
     SHAPE RENDERING — rect/square/circle/triangle/line, fill or outline
  ══════════════════════════════════════════════════════════════════════ */
  function renderShape(c, s) {
    const x0=s.x0, y0=s.y0;
    let x1=s.x1, y1=s.y1;
    if (s.kind==='square') {
      // Force equal width/height, keeping the drag's signs
      const sz = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
      x1 = x0 + (x1<x0 ? -sz : sz);
      y1 = y0 + (y1<y0 ? -sz : sz);
    }
    const x = Math.min(x0,x1), y = Math.min(y0,y1);
    const w = Math.abs(x1-x0), h = Math.abs(y1-y0);

    c.save();
    c.lineCap='round'; c.lineJoin='round';
    c.lineWidth = s.width || strokeW;
    c.strokeStyle = s.color || INK_DEFAULT;
    c.fillStyle = s.color || INK_DEFAULT;
    c.globalCompositeOperation='source-over';

    c.beginPath();
    if (s.kind==='circle') {
      const cx=(x0+x1)/2, cy=(y0+y1)/2;
      c.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI*2);
    } else if (s.kind==='triangle') {
      c.moveTo((x0+x1)/2, y0);
      c.lineTo(x1, y1);
      c.lineTo(x0, y1);
      c.closePath();
    } else if (s.kind==='line') {
      c.moveTo(x0,y0); c.lineTo(x1,y1);
    } else {
      // rect / square
      c.rect(x,y,w,h);
    }

    if (s.kind==='line') {
      c.stroke();
    } else if (s.filled) {
      c.fill();
      if (s.width>0.4) c.stroke(); // thin outline so edge stays crisp when filled
    } else {
      c.stroke();
    }
    c.restore();
  }

  /* ══════════════════════════════════════════════════════════════════════
     COORDINATE HELPER
  ══════════════════════════════════════════════════════════════════════ */
  function canvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x:(clientX-rect.left)/zoomLevel, y:(clientY-rect.top)/zoomLevel };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PINCH-TO-ZOOM + TWO-FINGER PAN — raw touch events on canvasWrap
     (separate from drawing, which uses pointer events with palm rejection)
  ══════════════════════════════════════════════════════════════════════ */
  let pinchDist0 = 0;
  let pinchZoom0 = 1;
  let pinchMidX  = 0;
  let pinchMidY  = 0;
  let isPinching = false;

  let panStartMidX   = 0;
  let panStartMidY   = 0;
  let panStartScrollX = 0;
  let panStartScrollY = 0;

  function getTouchDist(t0, t1) {
    const dx=t0.clientX-t1.clientX, dy=t0.clientY-t1.clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }
  function getTouchMid(t0, t1) {
    return { x:(t0.clientX+t1.clientX)/2, y:(t0.clientY+t1.clientY)/2 };
  }

  // canvasWrap handles pinch/pan; we set touch-action:none on it
  // so the browser doesn't intercept the gesture
  canvasWrap.style.touchAction = 'none';

  canvasWrap.addEventListener('touchstart', e => {
    // PALM GUARD: while the Pencil is actively drawing (curStroke/curShapePreview
    // is live), a resting palm can register as a second 'touchstart' and make
    // e.touches.length hit 2. We must NOT treat that as a pinch gesture — that
    // would abort the in-progress stroke and feel like the line "glitching out"
    // mid-write. A deliberate two-finger pinch can't happen while the Pencil
    // tip is actually down, so if a stroke/shape is active we ignore extra
    // touch points entirely instead of starting a pinch / killing the stroke.
    if (curStroke || curShapePreview) return;
    if (e.touches.length===2) {
      // If an edge-swipe page-turn was in progress, a second finger joining
      // hands off to pinch/pan instead — cancel the swipe cleanly (springs
      // the page back flat) so it doesn't get stuck mid-fold.
      if (swipeState) { finishSwipe(false); }
      // Two-finger pinch + pan start
      e.preventDefault();
      isPinching = true;
      isOneFingerPanning = false; // hand off to two-finger pinch/pan instead
      pinchDist0 = getTouchDist(e.touches[0], e.touches[1]);
      pinchZoom0 = zoomLevel;
      const mid  = getTouchMid(e.touches[0], e.touches[1]);
      pinchMidX  = mid.x;
      pinchMidY  = mid.y;
      panStartMidX    = mid.x;
      panStartMidY    = mid.y;
      panStartScrollX = canvasWrap.scrollLeft;
      panStartScrollY = canvasWrap.scrollTop;
    }
    // 1-finger touches handled by pointer events on canvas
  }, { passive:false });

  canvasWrap.addEventListener('touchmove', e => {
    if (isPinching && e.touches.length===2) {
      e.preventDefault();
      const d    = getTouchDist(e.touches[0], e.touches[1]);
      const mid  = getTouchMid(e.touches[0], e.touches[1]);
      const midX = mid.x, midY = mid.y;

      // Pinch zoom (only meaningful when finger spread has changed)
      if (pinchDist0>0) applyZoom(pinchZoom0*(d/pinchDist0), midX, midY);

      // Two-finger pan — move scroll opposite to the midpoint's drag delta
      const dx = midX - panStartMidX;
      const dy = midY - panStartMidY;
      canvasWrap.scrollLeft = panStartScrollX - dx;
      canvasWrap.scrollTop  = panStartScrollY - dy;
      // Re-anchor the pan baseline to the post-zoom scroll position so
      // panning and zooming compose smoothly within the same gesture
      panStartMidX    = midX;
      panStartMidY    = midY;
      panStartScrollX = canvasWrap.scrollLeft;
      panStartScrollY = canvasWrap.scrollTop;
    }
  }, { passive:false });

  canvasWrap.addEventListener('touchend', e => {
    if (e.touches.length<2) isPinching = false;
  }, { passive:true });

  /* ── One-finger pan (Select/hand tool) ────────────────────────────
     touch-action:none on canvas/canvasWrap means the browser never scrolls
     natively, so when the hand tool is active and a drag starts on empty
     canvas (no shape/ink hit), we drive canvasWrap's scroll manually here. */
  let panFingerStartX=0, panFingerStartY=0, panFingerStartScrollX=0, panFingerStartScrollY=0, isOneFingerPanning=false;

  function beginOneFingerPan(e) {
    isOneFingerPanning = true;
    panFingerStartX = e.clientX; panFingerStartY = e.clientY;
    panFingerStartScrollX = canvasWrap.scrollLeft;
    panFingerStartScrollY = canvasWrap.scrollTop;
    if (e.pointerType!=='touch') canvas.setPointerCapture(e.pointerId);
  }

  canvas.addEventListener('pointermove', e => {
    if (!isOneFingerPanning) return;
    e.preventDefault();
    canvasWrap.scrollLeft = panFingerStartScrollX - (e.clientX-panFingerStartX);
    canvasWrap.scrollTop  = panFingerStartScrollY - (e.clientY-panFingerStartY);
  }, { passive:false });
  canvas.addEventListener('pointerup',     () => { isOneFingerPanning=false; });
  canvas.addEventListener('pointercancel', () => { isOneFingerPanning=false; });

  /* ══════════════════════════════════════════════════════════════════════
     SWIPE-TO-TURN-PAGE
     Touch drag anywhere on the canvas — touch pointers are already fully
     blocked from drawing (palm rejection), so any horizontal touch drag is
     unambiguously a page-turn gesture. Direction is determined after a few
     pixels of movement so accidental vertical scrolls don't trigger it.
     Works in any tool mode (pen, eraser, pan — doesn't matter, touch never
     draws). The Pencil is explicitly excluded (always draws/selects).
  ══════════════════════════════════════════════════════════════════════ */
  const SWIPE_LOCK_DIST    = 12;   // px before we decide horizontal vs vertical
  const SWIPE_COMMIT_DIST  = 80;   // px of horizontal drag to commit the turn
  const SWIPE_COMMIT_VEL   = 0.4;  // px/ms — fast flick commits even if short

  let swipeState = null;
  // { pointerId, startX, startY, startT, lastX, lastT, pageW, edge, targetId, locked }

  function notebookNeighbors() {
    const seq = notebookSequence();
    const idx = seq.indexOf(activePageId);
    return {
      seq, idx,
      prevId: idx > 0 ? seq[idx-1] : null,
      nextId: (idx >= 0 && idx < seq.length-1) ? seq[idx+1] : null,
    };
  }

  function showSwipeHints() {
    const { prevId, nextId } = notebookNeighbors();
    swipeHintPrev.classList.toggle('nb-show', !!prevId);
    swipeHintNext.classList.toggle('nb-show', !!nextId);
  }
  function hideSwipeHints() {
    swipeHintPrev.classList.remove('nb-show');
    swipeHintNext.classList.remove('nb-show');
  }

  // Listen on the canvas element itself — it's always the touch target,
  // and we're already blocking touch from drawing there, so no conflict.
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return; // Pencil/mouse never swipe
    if (!activePageId || isPinching || dragState) return;
    if (curStroke || curShapePreview || isOneFingerPanning) return;
    if (tool === 'pan') return; // pan tool owns finger drag for canvas scrolling
    // Start tracking; don't commit to swipe yet — wait until we see which
    // direction the finger is actually moving (SWIPE_LOCK_DIST pixels).
    swipeState = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY, startT: performance.now(),
      lastX: e.clientX, lastT: performance.now(),
      pageW: canvas.getBoundingClientRect().width,
      locked: false, edge: null, targetId: null,
    };
  }, { passive: true }); // passive: we only preventDefault once direction is locked

  canvas.addEventListener('pointermove', e => {
    if (!swipeState || e.pointerId !== swipeState.pointerId) return;
    const dx = e.clientX - swipeState.startX;
    const dy = e.clientY - swipeState.startY;
    swipeState.lastX = e.clientX;
    swipeState.lastT = performance.now();

    if (!swipeState.locked) {
      // Haven't decided direction yet
      if (Math.abs(dx) < SWIPE_LOCK_DIST && Math.abs(dy) < SWIPE_LOCK_DIST) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        // Primarily vertical — this is a scroll gesture, abandon swipe
        swipeState = null;
        return;
      }
      // Primarily horizontal — lock in as a swipe
      const edge = dx < 0 ? 'right' : 'left'; // dragging left = going forward (right edge)
      const { prevId, nextId } = notebookNeighbors();
      let targetId = edge === 'right' ? nextId : prevId;
      // Swiping forward past the last page creates a new one — like turning
      // to a blank page at the end of a real notebook.
      const isNewPage = (edge === 'right' && !nextId);
      if (!targetId && !isNewPage) { swipeState = null; return; }
      if (edge === 'left' && !prevId)  { swipeState = null; return; } // already at start, no back
      swipeState.locked = true;
      swipeState.edge = edge;
      swipeState.targetId = targetId; // null if isNewPage — finishSwipe handles it
      swipeState.isNewPage = isNewPage;
      swipeState.currentX = e.clientX;
      swipeState.rafPending = false;
      // Capture the pointer so we keep getting events even if the finger
      // slides off the canvas edge mid-swipe.
      try { canvas.setPointerCapture(e.pointerId); } catch(_) {}
      // Shadow overlay on outgoing page — gradient points toward the direction
      // of travel so it darkens the leading (leaving) edge
      ensureShadowEl();
      const grad = edge === 'right'
        ? 'linear-gradient(90deg, transparent 50%, rgba(0,0,0,0.3) 100%)'
        : 'linear-gradient(270deg, transparent 50%, rgba(0,0,0,0.3) 100%)';
      pageStage._shadowEl.style.background = grad;
      pageStage._shadowEl.style.opacity = 0;
      pageStage.style.transition = 'none';
      pageIncoming.style.transition = 'none';
      pageIncoming.style.display = 'block';
      pageIncoming.style.width  = swipeState.pageW + 'px';
      pageIncoming.style.height = canvas.getBoundingClientRect().height + 'px';
      // Render the target page's paper style onto pageIncoming so it looks
      // like a real lined (or squared/dotted/plain) page being revealed,
      // not just a blank white rectangle.
      const targetPaperStyle = isNewPage ? paperStyle : (pages[targetId]?.paperStyle || 'lined');
      const targetPageNum = isNewPage
        ? notebookSequence().length + 1
        : notebookSequence().indexOf(targetId) + 1;
      const pw = Math.round(swipeState.pageW);
      const ph = Math.round(parseFloat(pageIncoming.style.height));
      const dpr = Math.min(window.devicePixelRatio||1, 2); // cap at 2x for speed
      const oc = document.createElement('canvas');
      oc.width = pw * dpr; oc.height = ph * dpr;
      const oc2 = oc.getContext('2d');
      oc2.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPaperOnContext(oc2, pw, ph, 1, targetPaperStyle, targetPageNum);
      pageIncoming.style.backgroundImage = `url(${oc.toDataURL()})`;
      pageIncoming.style.backgroundSize  = '100% 100%';
      pageIncoming.style.backgroundColor = PAPER_BG;
      // Start incoming page from its parallax-offset rest position
      const incomingStart = edge === 'right' ? swipeState.pageW * 0.28 : -swipeState.pageW * 0.28;
      pageIncoming.style.transform = `translateX(${incomingStart}px)`;
      showSwipeHints();
    }

    // Locked into swipe — track finger position; rAF drives the actual DOM write
    e.preventDefault();
    swipeState.currentX = e.clientX;
    if (!swipeState.rafPending) {
      swipeState.rafPending = true;
      requestAnimationFrame(updateSwipeFrame);
    }
  }, { passive: false });

  function updateSwipeFrame() {
    if (!swipeState?.locked) return;
    swipeState.rafPending = false;
    const travel = swipeState.currentX - swipeState.startX;
    // Resist dragging the wrong way (feels physical)
    const raw = swipeState.edge === 'right' ? Math.min(0, travel) : Math.max(0, travel);
    const px = raw; // negative = outgoing slides left, positive = slides right
    const progress = Math.min(1, Math.abs(px) / swipeState.pageW);

    // Outgoing page slides fully off
    pageStage.style.transform = `translateX(${px}px)`;
    // Shadow darkens proportionally to progress
    pageStage.style.setProperty('--swipe-shadow', progress);
    // Incoming page starts 28% behind and catches up (parallax lag)
    const incomingOffset = swipeState.edge === 'right'
      ? swipeState.pageW * (1 - progress) * 0.28
      : -swipeState.pageW * (1 - progress) * 0.28;
    pageIncoming.style.transform = `translateX(${incomingOffset}px)`;
    // Fade shadow on outgoing page
    const shadowOpacity = progress * 0.28;
    pageStage.style.setProperty('--shadow-opacity', shadowOpacity);
    if (pageStage._shadowEl) pageStage._shadowEl.style.opacity = shadowOpacity;
  }

  function resetSwipeStage() {
    pageStage.style.transform = '';
    pageStage.style.transition = '';
    pageIncoming.style.transform = '';
    pageIncoming.style.transition = '';
    pageIncoming.style.display = 'none';
    if (pageStage._shadowEl) pageStage._shadowEl.style.opacity = 0;
    hideSwipeHints();
  }

  // Lazily create a shadow overlay div on pageStage for the slide shadow
  // (can't use ::after because CSS custom properties don't animate opacity
  // on pseudo-elements in all WebKit versions)
  function ensureShadowEl() {
    if (pageStage._shadowEl) return;
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; inset:0; pointer-events:none; border-radius:3px;
      opacity:0; z-index:10; transition:none;
    `;
    // Direction set at swipe-lock time
    pageStage.appendChild(el);
    pageStage._shadowEl = el;
  }

  const EASE_OUT_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';
  const EASE_SPRING    = 'cubic-bezier(0.34, 1.4, 0.64, 1)'; // slight overshoot = alive

  function finishSwipe(commit) {
    if (!swipeState) return;
    const s = swipeState;
    swipeState = null;
    if (!s.locked) return;

    const dt   = Math.max(1, s.lastT - s.startT);
    const dist  = Math.abs(s.lastX - s.startX);
    const vel   = dist / dt;
    const shouldCommit = commit && (dist >= SWIPE_COMMIT_DIST || vel >= SWIPE_COMMIT_VEL);

    // Duration scales with remaining distance — a fast flick that's 80% done
    // takes much less time to finish than one barely started.
    const remaining = shouldCommit
      ? (s.pageW - dist) / s.pageW   // fraction left to travel
      : dist / s.pageW;               // fraction to spring back
    const dur = Math.max(160, Math.round(remaining * 380));
    const durS = dur / 1000;
    const easing = shouldCommit ? EASE_OUT_QUART : EASE_SPRING;

    if (shouldCommit) {
      // Slide outgoing page fully off
      const offscreen = s.edge === 'right' ? -s.pageW * 1.05 : s.pageW * 1.05;
      pageStage.style.transition = `transform ${durS}s ${easing}`;
      pageStage.style.transform  = `translateX(${offscreen}px)`;
      // Incoming page slides to position 0
      pageIncoming.style.transition = `transform ${durS}s ${easing}`;
      pageIncoming.style.transform  = 'translateX(0px)';
      if (pageStage._shadowEl) {
        pageStage._shadowEl.style.transition = `opacity ${durS}s ease`;
        pageStage._shadowEl.style.opacity = 0;
      }
      setTimeout(() => {
        suppressStageReset = true;
        if (s.isNewPage) { newPage(); } else { loadPage(s.targetId); }
        suppressStageReset = false;
        // New page lands at translateX(0) — slide in from the same side the
        // old page exited, for a continuous feel
        const fromSide = s.edge === 'right' ? s.pageW * 0.15 : -s.pageW * 0.15;
        pageStage.style.transition = 'none';
        pageStage.style.transform  = `translateX(${fromSide}px)`;
        pageIncoming.style.display = 'none';
        if (pageStage._shadowEl) pageStage._shadowEl.style.opacity = 0;
        hideSwipeHints();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          pageStage.style.transition = `transform 0.28s ${EASE_SPRING}`;
          pageStage.style.transform  = 'translateX(0px)';
          setTimeout(resetSwipeStage, 300);
        }));
      }, dur + 16);
    } else {
      // Spring back to rest
      pageStage.style.transition = `transform ${durS}s ${EASE_SPRING}`;
      pageStage.style.transform  = 'translateX(0px)';
      const incomingRest = s.edge === 'right' ? s.pageW * 0.28 : -s.pageW * 0.28;
      pageIncoming.style.transition = `transform ${durS}s ${EASE_SPRING}`;
      pageIncoming.style.transform  = `translateX(${incomingRest}px)`;
      if (pageStage._shadowEl) {
        pageStage._shadowEl.style.transition = `opacity ${durS}s ease`;
        pageStage._shadowEl.style.opacity = 0;
      }
      setTimeout(resetSwipeStage, dur + 16);
    }
  }

  canvas.addEventListener('pointerup',     e => { if (swipeState?.pointerId === e.pointerId) finishSwipe(true); },  { passive: true });
  canvas.addEventListener('pointercancel', e => { if (swipeState?.pointerId === e.pointerId) finishSwipe(false); }, { passive: true });

  /* ══════════════════════════════════════════════════════════════════════
     DRAWING — Pointer Events on canvas
     PALM REJECTION: only accept pointerType='pen' (Apple Pencil)
     or 'mouse'. Ignore pointerType='touch' (fingers / palm).
  ══════════════════════════════════════════════════════════════════════ */
  // canvas itself: touch-action none so we control everything
  canvas.style.touchAction = 'none';

  function isDrawPointer(e) {
    // Accept pen (Apple Pencil) always.
    // Accept mouse (desktop / stylus apps that report mouse).
    // Reject touch (fingers, palm) to prevent accidental marks.
    return e.pointerType==='pen' || e.pointerType==='mouse';
  }

  // How far (logical px) the pointer may move and still count as a "tap"
  // for tap-to-select, rather than a deliberate stroke.
  const TAP_MOVE_THRESHOLD = 4;

  canvas.addEventListener('pointerdown', e => {
    if (!activePageId || isPinching) return;
    // PALM GUARD: if a Pencil stroke or shape-drag is already in progress,
    // any *other* pointer that lands (a resting palm reported as pointerType
    // 'touch') must be fully ignored — it should never hit-test a shape,
    // select something, or otherwise touch state. Without this, a palm
    // landing mid-stroke could yank the current selection out from under
    // the Pencil and make the line look like it glitches.
    if (curStroke || curShapePreview) { if (!isDrawPointer(e)) e.preventDefault(); return; }
    if (tool==='select') return; // a text box or shape is already selected — let its own handlers run
    if (tool==='pan') {
      // Tap-to-select still applies in hand mode since there's no drawing
      // to protect there — only a deliberate tap can land here.
      const pos = canvasPos(e.clientX, e.clientY);
      const hit = hitTestShape(pos);
      if (hit) { e.preventDefault(); selectShape(hit.id); return; }
      // No hit — start a manual one-finger pan (touch-action:none means the
      // browser won't scroll natively, so we drive canvasWrap's scroll here).
      beginOneFingerPan(e);
      return;
    }
    if (!isDrawPointer(e)) { e.preventDefault(); return; } // palm rejection (drawing only)
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    // NOTE: we no longer hit-test-and-select on pointerdown for pen/highlighter.
    // Handwriting routinely starts a new stroke right next to (or touching)
    // ink from a moment ago, and the old "tap to select" hit-test would treat
    // that as grabbing the existing stroke and silently swallow the new one
    // (looked like "every other stroke" failing to draw). Instead we always
    // start the stroke here, and pointerup below decides — based on how far
    // it actually moved — whether this was a tiny tap (select) or a real
    // stroke (commit the ink).
    if (tool==='shape') { startShape(canvasPos(e.clientX, e.clientY), e.pointerId); return; }
    startStroke(canvasPos(e.clientX, e.clientY), e.pointerId);
  }, { passive:false });

  canvas.addEventListener('pointermove', e => {
    if (isPinching) return;
    if (curShapePreview) {
      if (e.pointerId!==curShapePreview.pointerId) return; // ignore other pointers (palm) mid-shape
      e.preventDefault(); continueShape(canvasPos(e.clientX, e.clientY)); return;
    }
    if (curStroke) {
      if (e.pointerId!==curStroke.pointerId) return; // ignore other pointers (palm) mid-stroke
      e.preventDefault();
      // Use coalesced events so we capture every sample the Pencil produced
      // since the last frame, not just the single throttled pointermove —
      // this is what makes fast strokes render smoothly instead of jagged.
      const events = (typeof e.getCoalescedEvents==='function') ? e.getCoalescedEvents() : null;
      if (events && events.length) {
        for (const ev of events) continueStroke(canvasPos(ev.clientX, ev.clientY));
      } else {
        continueStroke(canvasPos(e.clientX, e.clientY));
      }
      renderCurStroke();
      return;
    }
    if (!isDrawPointer(e)) { e.preventDefault(); return; }
  }, { passive:false });

  canvas.addEventListener('pointerup', e => {
    if (curShapePreview) {
      if (e.pointerId!==curShapePreview.pointerId) return; // a palm lifting shouldn't end the shape
      e.preventDefault(); endShape(); return;
    }
    if (curStroke) {
      if (e.pointerId!==curStroke.pointerId) return; // a palm lifting shouldn't end the stroke
      e.preventDefault(); endStroke();
    }
  }, { passive:false });

  canvas.addEventListener('pointercancel', e => {
    if (curShapePreview && e.pointerId===curShapePreview.pointerId) { curShapePreview=null; redrawStrokes(); }
    if (curStroke && e.pointerId===curStroke.pointerId) { curStroke=null; redrawStrokes(); }
  });

  /* ══════════════════════════════════════════════════════════════════════
     STROKE LIFECYCLE
  ══════════════════════════════════════════════════════════════════════ */
  function snapshotStrokes() {
    return strokes.map(s => s.points ? {...s, points:s.points.slice()} : {...s});
  }

  function startStroke(pos, pointerId) {
    undoStack.push(snapshotStrokes());
    if (undoStack.length>60) undoStack.shift();
    curStroke = {
      id:uid(), tool,
      color: tool==='highlighter' ? '#FFEB3B' : penColor,
      width: tool==='eraser' ? ERASER_W : tool==='highlighter' ? strokeW*5 : strokeW,
      points:[pos],
      pointerId,
    };
    dirtyFlag = true;
  }

  function continueStroke(pos) {
    if (!curStroke) return;
    curStroke.points.push(pos);
  }

  function renderCurStroke() {
    if (!curStroke) return;
    redrawStrokes();
    renderStroke(ctx, curStroke);
  }

  function strokeTravelDistance(pts) {
    let d = 0;
    for (let i=1;i<pts.length;i++) {
      const dx=pts[i].x-pts[i-1].x, dy=pts[i].y-pts[i-1].y;
      d += Math.hypot(dx,dy);
    }
    return d;
  }

  function endStroke() {
    if (!curStroke) return;
    const s = curStroke;
    curStroke = null;
    // Decide tap-to-select vs. a real stroke AFTER the fact, based on how far
    // it actually traveled. This replaces the old pointerdown hit-test, which
    // fired before any movement happened and would silently swallow new
    // strokes that merely started near existing ink (handwriting constantly
    // does this) — that was the "every other stroke missing" bug.
    const traveled = strokeTravelDistance(s.points);
    if (traveled < TAP_MOVE_THRESHOLD && (s.tool==='pen' || s.tool==='highlighter')) {
      // It was a tap, not a stroke — undo the speculative undo-snapshot we
      // pushed in startStroke (nothing was actually drawn) and, if the tap
      // landed on existing ink/shape, select it.
      undoStack.pop();
      const hit = hitTestShape(s.points[0]);
      if (hit) selectShape(hit.id);
      redrawStrokes();
      return;
    }
    if (s.points.length>1) strokes.push(s);
    redrawStrokes();
  }

  /* ══════════════════════════════════════════════════════════════════════
     SHAPE LIFECYCLE — drag corner-to-corner, committed as a stroke
     with tool:'shape' so it persists/undoes/erases like ink.
  ══════════════════════════════════════════════════════════════════════ */
  function startShape(pos, pointerId) {
    undoStack.push(snapshotStrokes());
    if (undoStack.length>60) undoStack.shift();
    curShapePreview = {
      id:uid(), tool:'shape', kind:shapeKind, filled:shapeFilled,
      color:penColor, width:strokeW,
      x0:pos.x, y0:pos.y, x1:pos.x, y1:pos.y,
      pointerId,
    };
    dirtyFlag = true;
  }

  function continueShape(pos) {
    if (!curShapePreview) return;
    curShapePreview.x1 = pos.x;
    curShapePreview.y1 = pos.y;
    redrawStrokes();
    renderStroke(ctx, curShapePreview);
  }

  function endShape() {
    if (!curShapePreview) return;
    const s = curShapePreview;
    curShapePreview = null;
    // Only commit if the shape has a meaningful size (avoid accidental taps)
    if (Math.abs(s.x1-s.x0) > 3 || Math.abs(s.y1-s.y0) > 3) {
      strokes.push(s);
      redrawStrokes();
      selectShape(s.id);
    } else {
      redrawStrokes();
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE SELECTION ENGINE (Select tool — the hand button)
     Both shapes and ink strokes (pen/highlighter) live as bitmap-rendered
     entries in strokes[]. Once selected (by tapping with the Select tool
     active) they get an HTML overlay (.nb-shape-wrap) positioned over their
     bounding box inside #nbCanvasLayer — same pattern as text boxes — so you
     can drag to move and grab corner handles to resize. Ink strokes resize
     by scaling all their points proportionally around the box origin.
  ══════════════════════════════════════════════════════════════════════ */
  function findShape(id) { return strokes.find(s => s.id===id); }

  // Distance from point p to segment a-b
  function distToSegment(p, a, b) {
    const dx=b.x-a.x, dy=b.y-a.y;
    const lenSq = dx*dx+dy*dy;
    let t = lenSq>0 ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx=a.x+t*dx, cy=a.y+t*dy;
    return Math.hypot(p.x-cx, p.y-cy);
  }

  // Bounding box of an ink stroke's points, in logical coordinates
  function inkBounds(s) {
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    s.points.forEach(p => { if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x; if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y; });
    return {x0,y0,x1,y1};
  }

  // Hit-test in logical canvas coordinates against shapes AND ink strokes.
  // Filled shapes hit anywhere inside their bounds; outline shapes and ink
  // strokes only hit near the actual line, with generous touch tolerance.
  function hitTestShape(pos) {
    const PAD = 14; // generous touch tolerance, in logical px
    for (let i=strokes.length-1; i>=0; i--) {
      const s = strokes[i];
      if (s.tool==='eraser') continue; // eraser strokes aren't selectable objects
      if (s.tool!=='shape') {
        // Ink stroke (pen / highlighter) — hit near any segment of its path
        if (!s.points || s.points.length<2) continue;
        const halfW = (s.width||strokeW)/2;
        for (let j=0;j<s.points.length-1;j++) {
          if (distToSegment(pos, s.points[j], s.points[j+1]) <= PAD+halfW) return s;
        }
        continue;
      }
      const x0=Math.min(s.x0,s.x1), x1=Math.max(s.x0,s.x1);
      const y0=Math.min(s.y0,s.y1), y1=Math.max(s.y0,s.y1);
      if (s.kind==='line') {
        if (distToSegment(pos, {x:s.x0,y:s.y0}, {x:s.x1,y:s.y1}) <= PAD) return s;
        continue;
      }
      const inBounds = pos.x>=x0-PAD && pos.x<=x1+PAD && pos.y>=y0-PAD && pos.y<=y1+PAD;
      if (!inBounds) continue;
      if (s.filled) return s; // anywhere inside the bounding box counts
      // Outline-only: must be near an edge
      const w=x1-x0, h=y1-y0;
      if (s.kind==='circle') {
        const cx=(x0+x1)/2, cy=(y0+y1)/2, rx=w/2||1, ry=h/2||1;
        const nx=(pos.x-cx)/rx, ny=(pos.y-cy)/ry;
        const edgeDist = Math.abs(Math.hypot(nx,ny)-1) * Math.min(rx,ry);
        if (edgeDist <= PAD) return s;
      } else if (s.kind==='triangle') {
        const pts = [{x:(x0+x1)/2,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
        for (let j=0;j<3;j++) if (distToSegment(pos, pts[j], pts[(j+1)%3]) <= PAD) return s;
      } else {
        // rect/square — near any of the 4 edges
        const corners = [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
        for (let j=0;j<4;j++) if (distToSegment(pos, corners[j], corners[(j+1)%4]) <= PAD) return s;
      }
    }
    return null;
  }

  function buildShapeOverlay(s) {
    canvasLayer.querySelector(`[data-shapeid="${s.id}"]`)?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'nb-shape-wrap';
    wrap.dataset.shapeid = s.id;
    setShapeWrapGeometry(wrap, s);

    const delBtn = document.createElement('button');
    delBtn.className = 'nb-shape-del';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('pointerdown', e => e.stopPropagation());
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteShape(s.id); });
    wrap.appendChild(delBtn);

    ['nw','ne','sw','se'].forEach(corner => {
      const h = document.createElement('div');
      h.className = `nb-shape-handle ${corner}`;
      wrap.appendChild(h);
      makeShapeCornerResizable(h, wrap, s, corner);
    });

    canvasLayer.appendChild(wrap);
    makeShapeDraggable(wrap, s);
    return wrap;
  }

  // Returns {x0,y0,x1,y1} bounding box in logical coords for either a shape
  // (x0/y0/x1/y1 fields) or an ink stroke (points[] array).
  function strokeBoundsOf(s) {
    if (s.tool==='shape') {
      return { x0:Math.min(s.x0,s.x1), x1:Math.max(s.x0,s.x1), y0:Math.min(s.y0,s.y1), y1:Math.max(s.y0,s.y1) };
    }
    const b = inkBounds(s);
    const pad = (s.width||strokeW)/2; // include stroke thickness so the box fully encloses the ink
    return { x0:b.x0-pad, x1:b.x1+pad, y0:b.y0-pad, y1:b.y1+pad };
  }

  function setShapeWrapGeometry(wrap, s) {
    const { x0, x1, y0, y1 } = strokeBoundsOf(s);
    wrap.style.left   = (x0*zoomLevel)+'px';
    wrap.style.top    = (y0*zoomLevel)+'px';
    wrap.style.width  = Math.max(8,(x1-x0)*zoomLevel)+'px';
    wrap.style.height = Math.max(8,(y1-y0)*zoomLevel)+'px';
  }

  function positionShapeStyleBar(wrap) {
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const mr = canvasLayer.getBoundingClientRect();
    let top  = wr.top - mr.top - 50;
    let left = wr.left - mr.left;
    if (top < 4) top = wr.bottom - mr.top + 6;
    shapeStyleBar.style.top  = Math.max(4, top)+'px';
    shapeStyleBar.style.left = Math.max(4, left)+'px';
  }

  function syncShapeStyleBar(s) {
    ssColorSwatch.style.background = s.color;
    ssColorPicker.value = s.color.startsWith('#') ? s.color : '#1a1a2e';
    ssWidthSlider.value = s.width;
    ssFillToggle.style.display = s.tool==='shape' ? '' : 'none';
    if (s.tool==='shape') {
      ssFillToggle.textContent = s.filled ? '◼ Filled' : '◻ Outline';
      ssFillToggle.classList.toggle('active', s.filled);
    }
  }

  function selectShape(id) {
    if (selectedShape) {
      canvasLayer.querySelector(`[data-shapeid="${selectedShape}"]`)?.classList.remove('selected');
    }
    selectedShape = id;
    if (id) {
      if (selectedTB) selectTextBox(null); // mutual exclusion with text box selection
      const s = findShape(id);
      if (!s) { selectedShape=null; return; }
      if (tool!=='select') toolBeforeSelect = tool;
      tool = 'select';
      [penBtn,penBtn2,hiBtn,hiBtn2,eraserBtn,eraserBtn2,shapeBtn,shapeBtn2,panBtn,panBtn2]
        .forEach(b=>b&&b.classList.remove('active'));
      shapePicker.classList.remove('visible');
      paperPicker.classList.remove('visible');
      let wrap = canvasLayer.querySelector(`[data-shapeid="${id}"]`);
      if (!wrap) wrap = buildShapeOverlay(s);
      wrap.classList.add('selected');
      syncShapeStyleBar(s);
      positionShapeStyleBar(wrap);
      shapeStyleBar.classList.add('visible');
    } else {
      canvasLayer.querySelectorAll('.nb-shape-wrap').forEach(el=>el.remove());
      shapeStyleBar.classList.remove('visible');
      restoreDrawingToolIfIdle();
    }
  }

  function deleteShape(id) {
    strokes = strokes.filter(s => s.id!==id);
    canvasLayer.querySelector(`[data-shapeid="${id}"]`)?.remove();
    if (selectedShape===id) { selectedShape=null; shapeStyleBar.classList.remove('visible'); }
    dirtyFlag = true;
    redrawStrokes();
  }

  function reposSelectedShapeOverlay() {
    if (!selectedShape) return;
    const s = findShape(selectedShape);
    const wrap = canvasLayer.querySelector(`[data-shapeid="${selectedShape}"]`);
    if (s && wrap) setShapeWrapGeometry(wrap, s);
  }

  /* ── Drag — move the whole shape ──────────────────────────────── */
  function makeShapeDraggable(wrap, s) {
    let startX, startY, snapStart, dragging=false;

    function begin(clientX, clientY) {
      dragging=true; startX=clientX; startY=clientY;
      snapStart = s.tool==='shape'
        ? { x0:s.x0, y0:s.y0, x1:s.x1, y1:s.y1 }
        : { points: s.points.map(p=>({x:p.x,y:p.y})) };
    }
    function move(clientX, clientY) {
      if (!dragging) return;
      const dx=(clientX-startX)/zoomLevel, dy=(clientY-startY)/zoomLevel;
      if (s.tool==='shape') {
        s.x0=snapStart.x0+dx; s.y0=snapStart.y0+dy;
        s.x1=snapStart.x1+dx; s.y1=snapStart.y1+dy;
      } else {
        s.points = snapStart.points.map(p => ({ x:p.x+dx, y:p.y+dy }));
      }
      setShapeWrapGeometry(wrap, s);
      positionShapeStyleBar(wrap);
      dirtyFlag=true;
      redrawStrokes();
    }

    wrap.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || e.target.closest('.nb-shape-handle,.nb-shape-del')) return;
      begin(e.touches[0].clientX, e.touches[0].clientY);
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    wrap.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      move(e.touches[0].clientX, e.touches[0].clientY);
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    wrap.addEventListener('touchend',    () => { dragging=false; }, { passive:true });
    wrap.addEventListener('touchcancel', () => { dragging=false; }, { passive:true });

    wrap.addEventListener('pointerdown', e => {
      if (e.pointerType==='touch' || e.target.closest('.nb-shape-handle,.nb-shape-del')) return;
      wrap.setPointerCapture(e.pointerId);
      begin(e.clientX, e.clientY);
      e.stopPropagation();
    });
    wrap.addEventListener('pointermove', e => {
      if (e.pointerType==='touch') return;
      move(e.clientX, e.clientY);
    });
    wrap.addEventListener('pointerup',     () => { dragging=false; });
    wrap.addEventListener('pointercancel', () => { dragging=false; });
  }

  /* ── Corner resize — drags one corner, keeping the opposite corner fixed ── */
  function makeShapeCornerResizable(handle, wrap, s, corner) {
    let startX, startY, startBounds, startPoints, resizing=false;

    function begin(clientX, clientY) {
      resizing=true; startX=clientX; startY=clientY;
      startBounds = strokeBoundsOf(s);
      if (s.tool!=='shape') startPoints = s.points.map(p=>({x:p.x,y:p.y}));
    }
    function move(clientX, clientY) {
      if (!resizing) return;
      const dx=(clientX-startX)/zoomLevel, dy=(clientY-startY)/zoomLevel;
      let { x0, y0, x1, y1 } = startBounds;
      if (corner.includes('w')) x0 += dx; else x1 += dx;
      if (corner.includes('n')) y0 += dy; else y1 += dy;
      // Keep a minimum size so the box never inverts/collapses
      if (x1-x0 < 8) { if (corner.includes('w')) x0=x1-8; else x1=x0+8; }
      if (y1-y0 < 8) { if (corner.includes('n')) y0=y1-8; else y1=y0+8; }

      if (s.tool==='shape') {
        s.x0=x0; s.y0=y0; s.x1=x1; s.y1=y1;
      } else {
        // Scale every point proportionally from the old bounding box into the
        // new one, so the stroke's shape is preserved while it resizes.
        const ow = startBounds.x1-startBounds.x0 || 1;
        const oh = startBounds.y1-startBounds.y0 || 1;
        const nw = x1-x0, nh = y1-y0;
        s.points = startPoints.map(p => ({
          x: x0 + (p.x-startBounds.x0)/ow * nw,
          y: y0 + (p.y-startBounds.y0)/oh * nh,
        }));
      }
      setShapeWrapGeometry(wrap, s);
      positionShapeStyleBar(wrap);
      dirtyFlag=true;
      redrawStrokes();
    }

    handle.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      begin(e.touches[0].clientX, e.touches[0].clientY);
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    handle.addEventListener('touchmove', e => {
      if (!resizing || e.touches.length !== 1) return;
      move(e.touches[0].clientX, e.touches[0].clientY);
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    handle.addEventListener('touchend',    () => { resizing=false; }, { passive:true });
    handle.addEventListener('touchcancel', () => { resizing=false; }, { passive:true });

    handle.addEventListener('pointerdown', e => {
      if (e.pointerType==='touch') return;
      handle.setPointerCapture(e.pointerId);
      begin(e.clientX, e.clientY);
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });
    handle.addEventListener('pointermove', e => {
      if (e.pointerType==='touch') return;
      move(e.clientX, e.clientY);
    });
    handle.addEventListener('pointerup',     () => { resizing=false; });
    handle.addEventListener('pointercancel', () => { resizing=false; });
  }

  /* ── Shape style bar events ───────────────────────────────────── */
  function withSelectedShape(fn) {
    if (!selectedShape) return;
    const s = findShape(selectedShape);
    if (!s) return;
    fn(s);
    dirtyFlag = true;
    redrawStrokes();
  }

  ssColorSwatch.addEventListener('click', () => ssColorPicker.click());
  ssColorPicker.addEventListener('input', () => {
    ssColorSwatch.style.background = ssColorPicker.value;
    withSelectedShape(s => s.color = ssColorPicker.value);
  });
  ssWidthSlider.addEventListener('input', () => withSelectedShape(s => s.width = parseFloat(ssWidthSlider.value)));
  ssFillToggle.addEventListener('click', () => withSelectedShape(s => {
    if (s.tool!=='shape') return;
    s.filled = !s.filled;
    ssFillToggle.textContent = s.filled ? '◼ Filled' : '◻ Outline';
    ssFillToggle.classList.toggle('active', s.filled);
  }));
  ssDuplicate.addEventListener('click', () => {
    if (!selectedShape) return;
    const s = findShape(selectedShape);
    if (!s) return;
    const ns = s.tool==='shape'
      ? { ...s, id:uid(), x0:s.x0+20, y0:s.y0+20, x1:s.x1+20, y1:s.y1+20 }
      : { ...s, id:uid(), points:s.points.map(p=>({x:p.x+20,y:p.y+20})) };
    strokes.push(ns);
    dirtyFlag = true;
    redrawStrokes();
    selectShape(ns.id);
  });
  ssDelete.addEventListener('click', () => { if (selectedShape) deleteShape(selectedShape); });

  /* ══════════════════════════════════════════════════════════════════════
     TOOL BUTTONS
  ══════════════════════════════════════════════════════════════════════ */
  function setTool(t) {
    tool = t;
    [penBtn,penBtn2].forEach(b=>b&&b.classList.toggle('active',t==='pen'));
    [hiBtn,hiBtn2].forEach(b=>b&&b.classList.toggle('active',t==='highlighter'));
    [eraserBtn,eraserBtn2].forEach(b=>b&&b.classList.toggle('active',t==='eraser'));
    [shapeBtn,shapeBtn2].forEach(b=>b&&b.classList.toggle('active',t==='shape'));
    [panBtn,panBtn2].forEach(b=>b&&b.classList.toggle('active',t==='pan'));
    canvas.style.cursor = t==='eraser'?'cell':t==='pan'?'grab':t==='shape'?'crosshair':'crosshair';
    shapePicker.classList.toggle('visible', t==='shape');
    paperPicker.classList.remove('visible');
    // Selecting any drawing tool deselects any active text box / shape
    if (t!=='select') { selectTextBox(null); selectShape(null); }
  }

  // Called from selectTextBox(null)/selectShape(null) when deselecting. If
  // nothing else is selected, drops out of 'select' mode back to the pen so
  // canvas taps resume working (selecting a shape/text box forces tool to
  // 'select' to block drawing while editing — without this, deselecting left
  // the canvas stuck ignoring all pointer input, including taps meant to
  // reselect a shape). Sets state directly rather than calling setTool() to
  // avoid recursing back into selectTextBox(null)/selectShape(null).
  function restoreDrawingToolIfIdle() {
    if (selectedTB || selectedShape) return; // mid mutual-exclusion handoff
    if (tool!=='select') return;
    setTool(toolBeforeSelect || 'pen');
  }

  penBtn.addEventListener('click',    ()=>setTool('pen'));
  hiBtn.addEventListener('click',     ()=>setTool('highlighter'));
  eraserBtn.addEventListener('click', ()=>setTool('eraser'));
  shapeBtn.addEventListener('click',  ()=>setTool(tool==='shape'?'pen':'shape'));
  panBtn.addEventListener('click',    ()=>setTool(tool==='pan'?'pen':'pan'));
  penBtn2.addEventListener('click',    ()=>setTool('pen'));
  hiBtn2.addEventListener('click',     ()=>setTool('highlighter'));
  eraserBtn2.addEventListener('click', ()=>setTool('eraser'));
  shapeBtn2.addEventListener('click',  ()=>setTool(tool==='shape'?'pen':'shape'));
  panBtn2.addEventListener('click',    ()=>setTool(tool==='pan'?'pen':'pan'));

  /* ── Shape picker popover ─────────────────────────────────────────── */
  shapeGrid.querySelectorAll('.nb-shape-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      shapeKind = opt.dataset.shape;
      shapeGrid.querySelectorAll('.nb-shape-opt').forEach(o=>o.classList.toggle('active', o===opt));
    });
  });
  function syncShapeFillToggle() {
    shapeFillToggle.textContent = shapeFilled ? '◼ Filled' : '◻ Outline';
    shapeFillToggle.classList.toggle('active', shapeFilled);
  }
  shapeFillToggle.addEventListener('click', () => {
    shapeFilled = !shapeFilled;
    syncShapeFillToggle();
  });
  syncShapeFillToggle();

  /* ── Paper style picker popover ───────────────────────────────────── */
  PAPER_STYLES.forEach(ps => {
    const opt = document.createElement('div');
    opt.className = 'nb-paper-opt' + (ps.id===paperStyle ? ' active' : '');
    opt.dataset.paper = ps.id;
    opt.innerHTML = `<span>${ps.icon}</span><span class="nb-paper-name">${ps.label}</span>`;
    opt.addEventListener('click', () => {
      paperStyle = ps.id;
      dirtyFlag = true;
      syncPaperStyleUI();
      sizeCanvas();
      paperPicker.classList.remove('visible');
    });
    paperGrid.appendChild(opt);
  });

  function syncPaperStyleUI() {
    paperGrid.querySelectorAll('.nb-paper-opt').forEach(o => o.classList.toggle('active', o.dataset.paper===paperStyle));
  }

  paperBtn.addEventListener('click', () => {
    paperPicker.classList.toggle('visible');
    shapePicker.classList.remove('visible');
  });

  /* ── Add Text Box button — drops a box at the current visible centre ── */
  function addTextBoxAtCenter() {
    if (!activePageId) { alert('Open a page first.'); return; }
    const scrollX = canvasWrap.scrollLeft / zoomLevel;
    const scrollY = canvasWrap.scrollTop  / zoomLevel;
    const visW = canvasWrap.clientWidth  / zoomLevel;
    const bw = getBaseWidth();
    const defaultW = Math.min(400, Math.round(bw * 0.6));
    const startX = Math.max(0, scrollX + Math.max(10,(visW-defaultW)/2));
    const startY = scrollY + LINE_SPACING * 2;
    createTextBox(startX, startY, '');
  }
  addTextBtn.addEventListener('click', addTextBoxAtCenter);
  addTextBtn2.addEventListener('click', addTextBoxAtCenter);

  undoBtn.addEventListener('click', ()=>{
    if (undoStack.length) {
      strokes=undoStack.pop(); dirtyFlag=true;
      if (selectedShape && !findShape(selectedShape)) selectShape(null);
      redrawStrokes();
      reposSelectedShapeOverlay();
    }
  });
  clearBtn.addEventListener('click', ()=>{
    if (!strokes.length||!confirm('Clear all ink on this page?')) return;
    undoStack.push(strokes.slice()); strokes=[]; dirtyFlag=true;
    selectShape(null);
    redrawStrokes();
  });

  /* ══════════════════════════════════════════════════════════════════════
     COLOUR SWATCHES — built for both full and mini toolbars
  ══════════════════════════════════════════════════════════════════════ */
  function buildSwatches() {
    [swatchesEl, swatchesEl2].forEach(container => {
      if (!container) return;
      container.innerHTML = '';
      QUICK_COLORS.forEach(c => {
        const d = document.createElement('div');
        d.className = 'nb-swatch'+(c===penColor?' sel':'');
        d.style.background = c;
        if (c==='#ffffff') d.style.border='2px solid rgba(255,255,255,0.35)';
        d.addEventListener('click', ()=>{ penColor=c; colorPicker.value=c; buildSwatches(); setTool('pen'); });
        container.appendChild(d);
      });
      const pick = document.createElement('div');
      pick.className = 'nb-swatch nb-swatch-pick';
      pick.addEventListener('click', ()=>colorPicker.click());
      container.appendChild(pick);
    });
    // Update size dot colour too
    sizeDot.style.background = penColor==='#ffffff'?'#aaa':penColor;
  }

  colorPicker.addEventListener('input', ()=>{ penColor=colorPicker.value; buildSwatches(); setTool('pen'); });
  buildSwatches();

  /* ══════════════════════════════════════════════════════════════════════
     SIZE SLIDER
     FIX: dot uses transform:scale() inside a fixed-size wrapper,
     so it NEVER causes the surrounding flex items to shift/jitter.
  ══════════════════════════════════════════════════════════════════════ */
  function applySize() {
    strokeW = parseFloat(sizeSlider.value);
    sizeVal.textContent = strokeW.toFixed(1);
    // Scale 1px→0.05, 20px→1.0 (transform does not affect layout)
    const s = Math.min(1, Math.max(0.05, strokeW/20));
    sizeDot.style.transform = `scale(${s})`;
    sizeDot.style.background = penColor==='#ffffff'?'#aaa':penColor;
  }

  sizeSlider.addEventListener('input',  applySize);
  sizeSlider.addEventListener('change', applySize);
  applySize();

  /* ══════════════════════════════════════════════════════════════════════
     SAVE & CLOSE
  ══════════════════════════════════════════════════════════════════════ */
  function close() {
    saveCurrentPage();
    clearInterval(autoSaveInterval);
    window.removeEventListener('keydown', escHandler);
    window.removeEventListener('resize', onResize);
    overlay.style.transition='opacity 0.2s';
    overlay.style.opacity='0';
    setTimeout(()=>{ overlay.remove(); document.body.style.overflow=''; }, 230);
  }
  doneBtn.addEventListener('click', close);
  doneBtn2.addEventListener('click', close);

  function escHandler(e) { if (e.key==='Escape'&&!transModal.classList.contains('open')) close(); }
  window.addEventListener('keydown', escHandler);
  function onResize() { if (activePageId) sizeCanvas(); }
  window.addEventListener('resize', onResize);

  const autoSaveInterval = setInterval(()=>{ if (dirtyFlag) saveCurrentPage(); }, AUTOSAVE_MS);

  /* ══════════════════════════════════════════════════════════════════════
     TRANSCRIPTION
  ══════════════════════════════════════════════════════════════════════ */
  transcribeBtn.addEventListener('click', ()=>{
    if (!activePageId) { alert('Open a page first.'); return; }
    transModal.classList.add('open');
    const ex = pages[activePageId]?.transcription||{};
    transText.value = ex.text||'';
    buildCorrectionUI(ex.corrections||[]);
    if (!ex.text) doTranscribe();
  });
  transClose.addEventListener('click', ()=>transModal.classList.remove('open'));
  retransBtn.addEventListener('click', doTranscribe);

  async function doTranscribe() {
    transStatus.textContent = '⏳ Converting handwriting…';
    transcribeBtn.disabled = retransBtn.disabled = true;
    try {
      const imgData = await canvasToBase64();
      const allCorr = collectAllCorrections();
      const corrNote = allCorr.length
        ? '\n\nPrevious corrections — apply these patterns:\n'+allCorr.map(c=>`"${c.original}" → "${c.corrected}"`).join('\n')
        : '';
      const body = JSON.stringify({
        model:'claude-sonnet-4-6', max_tokens:1000,
        system:`You are a handwriting transcription assistant. The user has messy handwriting. `+
               `Transcribe exactly what is written on the lined paper. Output ONLY the transcribed text.${corrNote}`,
        messages:[{ role:'user', content:[
          { type:'image', source:{ type:'base64', media_type:'image/jpeg', data:imgData } },
          { type:'text',  text:'Please transcribe the handwriting on this notebook page.' },
        ]}],
      });

      // Call via Netlify proxy (your env var: notebookkey)
      const resp = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!resp.ok) {
        let errMsg = 'HTTP ' + resp.status;
        try {
          const errData = await resp.json();
          errMsg = errData.error || JSON.stringify(errData).slice(0, 200);
        } catch { /* ignore parse error */ }
        if (resp.status === 404) errMsg = 'Proxy not found — make sure netlify/functions/anthropic-proxy.js is deployed.';
        if (resp.status === 500) errMsg = 'Proxy error — check that "notebookkey" is set in Netlify environment variables.';
        throw new Error(errMsg);
      }
      const data = await resp.json();
      const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      transText.value = text||'(No handwriting detected)';
      transStatus.textContent = '✓ Done — edit below or add corrections.';
    } catch(err) {
      console.error('[Notebook] Transcription error:',err);
      transStatus.textContent = '✗ '+( err.message||'Unknown error');
    } finally {
      transcribeBtn.disabled = retransBtn.disabled = false;
    }
  }

  async function canvasToBase64() {
    // Export at a fixed width of 800px max — enough for Claude to read handwriting
    // without blowing past the API's image size limit or timing out the function.
    const EXPORT_W = 800;
    const bh = LINE_SPACING * PAGE_ROWS + LINE_SPACING;
    const bw = getBaseWidth();
    const scale = EXPORT_W / bw;
    const exportH = Math.round(bh * scale);

    const off = document.createElement('canvas');
    off.width  = EXPORT_W;
    off.height = exportH;
    const oc = off.getContext('2d');

    // Paper background — drawn at full export resolution to match drawPaper's scaling approach
    drawPaperOnContext(oc, EXPORT_W, exportH, scale, paperStyle);

    // Strokes (drawn in logical coordinate space, so scale the context first)
    oc.save();
    oc.scale(scale, scale);
    strokes.forEach(s => renderStroke(oc, s));
    oc.restore();

    // Export as JPEG at 85% quality — much smaller than PNG for this use case
    return new Promise(res => {
      off.toBlob(blob => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.readAsDataURL(blob);
      }, 'image/jpeg', 0.85);
    });
  }

  function collectAllCorrections() {
    const all=[];
    Object.values(pages).forEach(pg=>(pg.transcription?.corrections||[]).forEach(c=>{ if (c.original&&c.corrected) all.push(c); }));
    return all;
  }

  let corrections=[];
  function buildCorrectionUI(initial=[]) { corrections=initial.map(c=>({...c})); renderCorrRows(); }
  function renderCorrRows() {
    corrList.innerHTML='';
    corrections.forEach((c,i)=>{
      const row=document.createElement('div'); row.className='nb-correction-row';
      row.innerHTML=`<input placeholder="What it got wrong…" value="${c.original||''}" data-field="original" data-idx="${i}" /><span style="color:rgba(255,255,255,0.3);">→</span><input placeholder="What it should say…" value="${c.corrected||''}" data-field="corrected" data-idx="${i}" /><button class="nb-corr-del" data-del="${i}">✕</button>`;
      corrList.appendChild(row);
    });
    corrList.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>corrections[+inp.dataset.idx][inp.dataset.field]=inp.value));
    corrList.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click',()=>{ corrections.splice(+btn.dataset.del,1); renderCorrRows(); }));
  }
  addCorrBtn.addEventListener('click',()=>{ corrections.push({original:'',corrected:''}); renderCorrRows(); corrList.lastElementChild?.querySelector('input')?.focus(); });
  saveTransBtn.addEventListener('click',()=>{
    if (!activePageId) return;
    pages[activePageId]=pages[activePageId]||{};
    pages[activePageId].transcription={ text:transText.value, corrections:corrections.filter(c=>c.original||c.corrected), ts:Date.now() };
    persistMeta(); transStatus.textContent='✓ Saved.';
    setTimeout(()=>transModal.classList.remove('open'),700);
  });

  /* ══════════════════════════════════════════════════════════════════════
     TEXT BOX ENGINE
     Text boxes are HTML divs overlaying the canvas inside #nbCanvasLayer.
     They are stored as plain objects in textBoxes[] and persisted per page.
  ══════════════════════════════════════════════════════════════════════ */

  // Default style for new text boxes
  const TB_DEFAULTS = { font:'-apple-system,sans-serif', size:16, color:'#1a1a2e', bold:false, italic:false, rotation:0 };

  function createTextBox(x, y, text='') {
    const id = uid();
    // Default width = 60% of logical page width, generous height
    const bw = getBaseWidth();
    const defaultW = Math.min(400, Math.round(bw * 0.6));
    const defaultH = 120;
    const tb = { id, x, y, w:defaultW, h:defaultH, text, ...TB_DEFAULTS };
    textBoxes.push(tb);
    dirtyFlag = true;
    buildTextBoxDOM(tb);
    selectTextBox(id);
    // Scroll so the text box is visible
    const wrap = canvasLayer.querySelector(`[data-tbid="${id}"]`);
    if (wrap) wrap.scrollIntoView({ behavior:'smooth', block:'nearest' });
    return tb;
  }

  function buildTextBoxDOM(tb) {
    const existing = canvasLayer.querySelector(`[data-tbid="${tb.id}"]`);
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.className = 'nb-textbox-wrap';
    wrap.dataset.tbid = tb.id;
    setWrapGeometry(wrap, tb);

    // ── Drag handle bar at top ──────────────────────────────────
    const dragBar = document.createElement('div');
    dragBar.className = 'nb-textbox-drag';

    const dots = document.createElement('span');
    dots.className = 'nb-drag-dots';
    dots.textContent = '⠿⠿⠿';

    const delBtn = document.createElement('button');
    delBtn.className = 'nb-textbox-del';
    delBtn.innerHTML = '✕';
    delBtn.addEventListener('pointerdown', e => e.stopPropagation());
    delBtn.addEventListener('click', e => { e.stopPropagation(); deleteTextBox(tb.id); });

    dragBar.appendChild(dots);
    dragBar.appendChild(delBtn);

    // ── Text content ─────────────────────────────────────────────
    const border = document.createElement('div');
    border.className = 'nb-textbox-border';

    const inner = document.createElement('div');
    inner.className = 'nb-textbox-inner';
    inner.contentEditable = 'true';
    inner.spellcheck = false;
    inner.style.cssText = applyTbStyle(tb);
    inner.textContent = tb.text;
    inner.addEventListener('pointerdown', e => e.stopPropagation());
    inner.addEventListener('touchstart',  e => e.stopPropagation(), { passive:true });
    inner.addEventListener('input', () => { tb.text = inner.textContent; dirtyFlag = true; });
    inner.addEventListener('focus', () => selectTextBox(tb.id));

    border.appendChild(inner);

    // ── Resize handle (large touch target, bottom-right) ─────────
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'nb-textbox-resize';

    // ── Rotate handle (floats above the drag bar) ────────────────
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'nb-textbox-rotate';
    const rotateDot = document.createElement('div');
    rotateDot.className = 'nb-textbox-rotate-dot';
    rotateDot.textContent = '⟳';
    rotateHandle.appendChild(rotateDot);
    rotateHandle.addEventListener('pointerdown', e => e.stopPropagation());
    rotateHandle.addEventListener('touchstart', e => e.stopPropagation(), { passive:true });

    wrap.appendChild(dragBar);
    wrap.appendChild(border);
    wrap.appendChild(resizeHandle);
    wrap.appendChild(rotateHandle);
    canvasLayer.appendChild(wrap);

    // Select when tapping drag bar or border
    [dragBar, border].forEach(el => {
      el.addEventListener('pointerdown', e => {
        if (e.target === delBtn) return;
        selectTextBox(tb.id);
      });
    });

    makeDraggable(dragBar, wrap, tb);
    makeResizable(resizeHandle, wrap, tb);
    makeRotatable(rotateHandle, wrap, tb);
  }

  function setWrapGeometry(wrap, tb) {
    wrap.style.left   = (tb.x * zoomLevel) + 'px';
    wrap.style.top    = (tb.y * zoomLevel) + 'px';
    wrap.style.width  = (tb.w * zoomLevel) + 'px';
    // Height includes drag bar (32px) + content area
    wrap.style.height = ((tb.h + 32) * zoomLevel) + 'px';
    wrap.style.transform = `rotate(${tb.rotation||0}deg)`;
  }

  function applyTbStyle(tb) {
    return [
      `font-family:${tb.font}`,
      `font-size:${tb.size}px`,
      `color:${tb.color}`,
      `font-weight:${tb.bold?'bold':'normal'}`,
      `font-style:${tb.italic?'italic':'normal'}`,
    ].join(';');
  }

  function applyStyleToSelectedTB() {
    if (!selectedTB) return;
    const tb = textBoxes.find(t=>t.id===selectedTB);
    if (!tb) return;
    const wrap = canvasLayer.querySelector(`[data-tbid="${tb.id}"]`);
    const inner = wrap?.querySelector('.nb-textbox-inner');
    if (inner) inner.style.cssText = applyTbStyle(tb);
    dirtyFlag = true;
  }

  function selectTextBox(id) {
    // Deselect previous
    if (selectedTB) {
      const prev = canvasLayer.querySelector(`[data-tbid="${selectedTB}"]`);
      prev?.classList.remove('selected');
    }
    selectedTB = id;
    if (id) {
      if (selectedShape) selectShape(null); // mutual exclusion with shape selection
      // Switch to 'select' mode directly (not via setTool, to avoid re-triggering
      // selectTextBox(null) recursively) so canvas pointer events don't draw ink
      // while a text box is active.
      if (tool!=='select') toolBeforeSelect = tool;
      tool = 'select';
      [penBtn,penBtn2,hiBtn,hiBtn2,eraserBtn,eraserBtn2,shapeBtn,shapeBtn2,panBtn,panBtn2]
        .forEach(b=>b&&b.classList.remove('active'));
      shapePicker.classList.remove('visible');
      paperPicker.classList.remove('visible');
      const wrap = canvasLayer.querySelector(`[data-tbid="${id}"]`);
      wrap?.classList.add('selected');
      const tb = textBoxes.find(t=>t.id===id);
      if (tb) syncStyleBar(tb);
      positionStyleBar(wrap);
      textStyleBar.classList.add('visible');
    } else {
      textStyleBar.classList.remove('visible');
      restoreDrawingToolIfIdle();
    }
  }

  function deleteTextBox(id) {
    textBoxes = textBoxes.filter(t=>t.id!==id);
    canvasLayer.querySelector(`[data-tbid="${id}"]`)?.remove();
    if (selectedTB===id) { selectedTB=null; textStyleBar.classList.remove('visible'); }
    dirtyFlag = true;
  }

  function renderAllTextBoxDOMs() {
    canvasLayer.querySelectorAll('.nb-textbox-wrap').forEach(el=>el.remove());
    textBoxes.forEach(tb => buildTextBoxDOM(tb));
  }

  // When zoom changes, re-position existing text box wraps without full rebuild
  function reposAllTextBoxes() {
    textBoxes.forEach(tb => {
      const wrap = canvasLayer.querySelector(`[data-tbid="${tb.id}"]`);
      if (wrap) setWrapGeometry(wrap, tb);
    });
  }

  // Deselect when tapping empty canvas background (shape selection is handled
  // earlier, in the canvas pointerdown handler, which stops propagation via
  // preventDefault when it hits a shape — but pointerdown still bubbles, so we
  // guard here by re-checking hitTestShape to avoid immediately deselecting).
  canvasLayer.addEventListener('pointerdown', e => {
    if (e.target === canvas || e.target === canvasLayer) {
      if ((tool==='pen' || tool==='highlighter' || tool==='pan') && activePageId) {
        const pos = canvasPos(e.clientX, e.clientY);
        if (hitTestShape(pos)) return; // already handled by canvas pointerdown above
      }
      selectTextBox(null);
      selectShape(null);
    }
  });

  /* ── Style bar sync ────────────────────────────────────────────── */
  function syncStyleBar(tb) {
    tsFontFamily.value   = tb.font;
    tsFontSize.value     = String(tb.size);
    tsBold.classList.toggle('active',   tb.bold);
    tsItalic.classList.toggle('active', tb.italic);
    tsColorSwatch.style.background = tb.color;
    tsColorPicker.value = tb.color.startsWith('#') ? tb.color : '#1a1a2e';
    tsResetRotate.textContent = `⟲ ${Math.round(tb.rotation||0)}°`;
  }

  function positionStyleBar(wrap) {
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const mr = canvasLayer.getBoundingClientRect();
    let top  = wr.top - mr.top - 50;
    let left = wr.left - mr.left;
    if (top < 4) top = wr.bottom - mr.top + 6;
    textStyleBar.style.top  = Math.max(4, top)+'px';
    textStyleBar.style.left = Math.max(4, left)+'px';
  }

  /* ── Style bar events ──────────────────────────────────────────── */
  function withSelectedTB(fn) {
    const tb = textBoxes.find(t=>t.id===selectedTB);
    if (tb) { fn(tb); applyStyleToSelectedTB(); }
  }

  tsFontFamily.addEventListener('change', () => withSelectedTB(tb => tb.font = tsFontFamily.value));
  tsFontSize.addEventListener('change', () => withSelectedTB(tb => { tb.size = parseInt(tsFontSize.value); }));
  tsBold.addEventListener('click',   () => withSelectedTB(tb => { tb.bold   = !tb.bold;   tsBold.classList.toggle('active',tb.bold); }));
  tsItalic.addEventListener('click', () => withSelectedTB(tb => { tb.italic = !tb.italic; tsItalic.classList.toggle('active',tb.italic); }));

  tsColorSwatch.addEventListener('click', () => tsColorPicker.click());
  tsColorPicker.addEventListener('input', () => {
    tsColorSwatch.style.background = tsColorPicker.value;
    withSelectedTB(tb => tb.color = tsColorPicker.value);
  });

  tsDuplicate.addEventListener('click', () => {
    const tb = textBoxes.find(t=>t.id===selectedTB);
    if (!tb) return;
    const newTb = { ...tb, id:uid(), x:tb.x+20, y:tb.y+20 };
    textBoxes.push(newTb);
    dirtyFlag = true;
    buildTextBoxDOM(newTb);
    selectTextBox(newTb.id);
  });

  tsDelete.addEventListener('click', () => { if (selectedTB) deleteTextBox(selectedTB); });

  tsResetRotate.addEventListener('click', () => withSelectedTB(tb => {
    tb.rotation = 0;
    const wrap = canvasLayer.querySelector(`[data-tbid="${tb.id}"]`);
    if (wrap) setWrapGeometry(wrap, tb);
  }));

  /* ── Drag — finger/touch/pencil all work on the drag bar ─────── */
  // Rotates a screen-space delta into the box's local (unrotated) coordinate
  // space, so dragging/resizing still feels natural when the box is rotated.
  function rotateDelta(dx, dy, rotationDeg) {
    const rad = -((rotationDeg||0) * Math.PI/180);
    return {
      x: dx*Math.cos(rad) - dy*Math.sin(rad),
      y: dx*Math.sin(rad) + dy*Math.cos(rad),
    };
  }

  function makeDraggable(dragBar, wrap, tb) {
    let startX, startY, startTbX, startTbY, dragging=false;

    // Use raw touch events so finger drag always works regardless of pointerType filters
    dragBar.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      dragging=true; startX=t.clientX; startY=t.clientY;
      startTbX=tb.x; startTbY=tb.y;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    dragBar.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      const t = e.touches[0];
      const d = rotateDelta((t.clientX-startX)/zoomLevel, (t.clientY-startY)/zoomLevel, tb.rotation);
      tb.x = Math.max(0, startTbX+d.x);
      tb.y = Math.max(0, startTbY+d.y);
      setWrapGeometry(wrap, tb);
      if (selectedTB===tb.id) positionStyleBar(wrap);
      dirtyFlag=true;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    dragBar.addEventListener('touchend',    () => { dragging=false; }, { passive:true });
    dragBar.addEventListener('touchcancel', () => { dragging=false; }, { passive:true });

    // Pointer events for mouse/Apple Pencil drag (pencil on the drag bar)
    dragBar.addEventListener('pointerdown', e => {
      if (e.pointerType==='touch') return; // handled by touch events above
      dragging=true; dragBar.setPointerCapture(e.pointerId);
      startX=e.clientX; startY=e.clientY;
      startTbX=tb.x; startTbY=tb.y;
      e.stopPropagation();
    });

    dragBar.addEventListener('pointermove', e => {
      if (!dragging || e.pointerType==='touch') return;
      const d = rotateDelta((e.clientX-startX)/zoomLevel, (e.clientY-startY)/zoomLevel, tb.rotation);
      tb.x = Math.max(0, startTbX+d.x);
      tb.y = Math.max(0, startTbY+d.y);
      setWrapGeometry(wrap, tb);
      if (selectedTB===tb.id) positionStyleBar(wrap);
      dirtyFlag=true;
    });

    dragBar.addEventListener('pointerup',     () => { dragging=false; });
    dragBar.addEventListener('pointercancel', () => { dragging=false; });
  }

  /* ── Resize — large 40×40 touch target in bottom-right corner ─── */
  function makeResizable(handle, wrap, tb) {
    let startX, startY, startW, startH, resizing=false;

    handle.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      resizing=true; startX=t.clientX; startY=t.clientY;
      startW=tb.w; startH=tb.h;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('touchmove', e => {
      if (!resizing || e.touches.length !== 1) return;
      const t = e.touches[0];
      const d = rotateDelta((t.clientX-startX)/zoomLevel, (t.clientY-startY)/zoomLevel, tb.rotation);
      tb.w = Math.max(120, startW+d.x);
      tb.h = Math.max(40,  startH+d.y);
      setWrapGeometry(wrap, tb);
      dirtyFlag=true;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('touchend',    () => { resizing=false; }, { passive:true });
    handle.addEventListener('touchcancel', () => { resizing=false; }, { passive:true });

    // Pointer fallback for mouse
    handle.addEventListener('pointerdown', e => {
      if (e.pointerType==='touch') return;
      resizing=true; handle.setPointerCapture(e.pointerId);
      startX=e.clientX; startY=e.clientY;
      startW=tb.w; startH=tb.h;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('pointermove', e => {
      if (!resizing || e.pointerType==='touch') return;
      const d = rotateDelta((e.clientX-startX)/zoomLevel, (e.clientY-startY)/zoomLevel, tb.rotation);
      tb.w = Math.max(120, startW+d.x);
      tb.h = Math.max(40,  startH+d.y);
      setWrapGeometry(wrap, tb);
      dirtyFlag=true;
    });

    handle.addEventListener('pointerup',     () => { resizing=false; });
    handle.addEventListener('pointercancel', () => { resizing=false; });
  }

  /* ── Rotate — drag the handle around the box's centre ─────────
     Angle is computed from the box centre (in screen space) to the
     finger/pointer, with an offset captured at drag-start so the box
     doesn't jump to match the pointer angle the instant you touch down. */
  function rotateAngleFor(wrap, clientX, clientY) {
    const r = wrap.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    return Math.atan2(clientY-cy, clientX-cx) * 180/Math.PI;
  }

  function makeRotatable(handle, wrap, tb) {
    let startAngle=0, startRotation=0, rotating=false;

    handle.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      rotating=true;
      startAngle = rotateAngleFor(wrap, t.clientX, t.clientY);
      startRotation = tb.rotation||0;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('touchmove', e => {
      if (!rotating || e.touches.length !== 1) return;
      const t = e.touches[0];
      const angle = rotateAngleFor(wrap, t.clientX, t.clientY);
      tb.rotation = normalizeAngle(startRotation + (angle-startAngle));
      setWrapGeometry(wrap, tb);
      if (selectedTB===tb.id) { positionStyleBar(wrap); tsResetRotate.textContent = `⟲ ${tb.rotation}°`; }
      dirtyFlag=true;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('touchend',    () => { rotating=false; }, { passive:true });
    handle.addEventListener('touchcancel', () => { rotating=false; }, { passive:true });

    // Pointer fallback for mouse / Apple Pencil
    handle.addEventListener('pointerdown', e => {
      if (e.pointerType==='touch') return;
      rotating=true; handle.setPointerCapture(e.pointerId);
      startAngle = rotateAngleFor(wrap, e.clientX, e.clientY);
      startRotation = tb.rotation||0;
      e.stopPropagation(); e.preventDefault();
    }, { passive:false });

    handle.addEventListener('pointermove', e => {
      if (!rotating || e.pointerType==='touch') return;
      const angle = rotateAngleFor(wrap, e.clientX, e.clientY);
      tb.rotation = normalizeAngle(startRotation + (angle-startAngle));
      setWrapGeometry(wrap, tb);
      if (selectedTB===tb.id) { positionStyleBar(wrap); tsResetRotate.textContent = `⟲ ${tb.rotation}°`; }
      dirtyFlag=true;
    });

    handle.addEventListener('pointerup',     () => { rotating=false; });
    handle.addEventListener('pointercancel', () => { rotating=false; });
  }

  function normalizeAngle(deg) {
    deg = deg % 360;
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    return Math.round(deg);
  }

  /* ── Paste-to-page button ───────────────────────────────────────── */
  pasteToPageBtn.addEventListener('click', () => {
    if (!activePageId) return;
    const text = transText.value.trim();
    if (!text) { transStatus.textContent = '⚠ No text to paste.'; return; }
    // Place at the current visible scroll position so it's immediately visible
    const scrollX = canvasWrap.scrollLeft / zoomLevel;
    const scrollY = canvasWrap.scrollTop  / zoomLevel;
    const startX = scrollX + (MARGIN_LEFT / zoomLevel) + 10;
    const startY = scrollY + LINE_SPACING * 2;
    createTextBox(startX, startY, text);
    transModal.classList.remove('open');
  });

  /* ══════════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════════ */
  renderSidebar();
  const lastPage=(meta.pages||[]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
  if (lastPage) loadPage(lastPage.id);
}
