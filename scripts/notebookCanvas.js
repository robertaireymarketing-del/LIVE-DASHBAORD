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
  let penColor  = INK_DEFAULT;
  let strokeW   = 2.5;
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
      /* touch-action managed by JS */
    }
    #nbCanvas {
      display:block; flex-shrink:0;
      box-shadow:0 6px 32px rgba(0,0,0,0.5);
      border-radius:3px;
      /* touch-action:none set in JS */
      cursor:crosshair;
      will-change:transform;
    }

    /* ══ SIDEBAR — all text hardcoded white so light-mode body styles can't override ══ */

    /* Sidebar wrapper — dark background always */
    #nbSidebar, #nbSidebar * { color:#ffffff !important; }

    /* Persistent toggle tab — sits on the right edge of the sidebar, always visible */
    #nbSideTab {
      position:absolute; top:50%; transform:translateY(-50%);
      right:-20px; width:20px; height:48px;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.12);
      border-left:none; border-radius:0 6px 6px 0;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; z-index:10; flex-shrink:0;
      font-size:10px; color:#fff !important;
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
    .nb-folder-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#ffffff !important; }
    .nb-folder-dot  { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
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
      cursor:pointer; transition:background 0.1s;
    }
    .nb-page-row:hover  { background:rgba(255,255,255,0.10) !important; }
    .nb-page-row.active { background:rgba(201,168,76,0.18) !important; border-color:rgba(201,168,76,0.4) !important; }
    .nb-page-icon  { font-size:14px; flex-shrink:0; }
    .nb-page-info  { flex:1; min-width:0; }
    .nb-page-title { font-size:11px; font-weight:700; color:#ffffff !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-page-date  { font-size:9px; color:rgba(255,255,255,0.5) !important; margin-top:2px; }
    .nb-page-del   { background:none !important; border:none !important; color:rgba(255,255,255,0.3) !important; cursor:pointer; font-size:12px; padding:2px 4px; border-radius:3px; display:none; }
    .nb-page-row:hover .nb-page-del { display:block; }
    .nb-page-del:hover { background:rgba(231,76,60,0.25) !important; color:#ff6b6b !important; }

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
      <button class="nbt"        id="nbPanBtn" title="Pan mode — use one finger to scroll">✋</button>
      <div class="nb-div"></div>

      <!-- Colours -->
      <div id="nbSwatches"></div>
      <div class="nb-div"></div>

      <!-- Size — fixed container so dot resize never causes reflow -->
      <div id="nbSizeGroup">
        <div id="nbSizeDotWrap"><div id="nbSizeDot"></div></div>
        <input type="range" id="nbSizeSlider" min="1" max="20" value="2.5" step="0.1" />
        <span id="nbSizeVal">2.5</span>
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
        <!-- Wrapper that sizes to match the canvas, text boxes live inside here -->
        <div id="nbCanvasLayer" style="position:relative;flex-shrink:0;">
          <canvas id="nbCanvas"></canvas>
          <!-- Text boxes inserted here by JS -->
        </div>
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
  function renderSidebar(filter='') {
    const fl = filter.toLowerCase().trim();
    let html = '';

    (meta.folders||[]).forEach(folder => {
      html += `<div class="nb-folder-row" data-folder-id="${folder.id}">
        <span class="nb-folder-dot" style="background:${folder.colour||'#C9A84C'};"></span>
        <span class="nb-folder-name">📁 ${folder.name}</span>
        <div class="nb-folder-actions">
          <button class="nb-folder-action-btn" data-rename-folder="${folder.id}">✎</button>
          <button class="nb-folder-action-btn" data-delete-folder="${folder.id}" style="color:rgba(231,76,60,0.7);">✕</button>
        </div>
      </div>`;
      (meta.pages||[])
        .filter(p => p.folderId===folder.id && matchFilter(p,fl))
        .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))
        .forEach(p => { html += pageRowHtml(p,true); });
    });

    const unfiled = (meta.pages||[])
      .filter(p => !p.folderId && matchFilter(p,fl))
      .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));
    if (unfiled.length && (meta.folders||[]).length)
      html += `<div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;padding:9px 7px 3px;">Unfiled</div>`;
    unfiled.forEach(p => { html += pageRowHtml(p,false); });

    if (!html) html = `<div style="padding:18px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);">No pages yet.</div>`;

    sideList.innerHTML = html;

    sideList.querySelectorAll('.nb-page-row').forEach(el => {
      el.addEventListener('click', () => loadPage(el.dataset.pageId));
      el.querySelector('.nb-page-del').addEventListener('click', e => { e.stopPropagation(); deletePage(el.dataset.pageId); });
    });
    sideList.querySelectorAll('[data-rename-folder]').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); renameFolder(btn.dataset.renameFolder); }));
    sideList.querySelectorAll('[data-delete-folder]').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); deleteFolder(btn.dataset.deleteFolder); }));

    if (activePageId) {
      const el = sideList.querySelector(`[data-page-id="${activePageId}"]`);
      if (el) el.classList.add('active');
    }
  }

  function matchFilter(p,fl) { return !fl || (p.title||'').toLowerCase().includes(fl) || (p.dateKey||'').includes(fl); }

  function pageRowHtml(page, indented) {
    return `<div class="nb-page-row" data-page-id="${page.id}" style="${indented?'padding-left:20px;':''}">
      <span class="nb-page-icon">📄</span>
      <div class="nb-page-info">
        <div class="nb-page-title">${page.title||'Untitled'}</div>
        <div class="nb-page-date">${fmtDate(page.dateKey||todayISO())}</div>
      </div>
      <button class="nb-page-del">🗑</button>
    </div>`;
  }

  searchBox.addEventListener('input', () => renderSidebar(searchBox.value));

  /* ══════════════════════════════════════════════════════════════════════
     PAGE MANAGEMENT
  ══════════════════════════════════════════════════════════════════════ */
  function newPage(folderId=null) {
    saveCurrentPage();
    const id=uid(), now=Date.now();
    meta.pages = meta.pages||[];
    meta.pages.unshift({ id, dateKey:todayISO(), title:'', folderId, createdAt:now, updatedAt:now });
    pages[id] = { strokes:[], transcription:null };
    persistMeta();
    loadPage(id, true);
  }

  function loadPage(id, isNew=false) {
    saveCurrentPage();
    activePageId = id;
    const page = (meta.pages||[]).find(p=>p.id===id);
    if (!page) return;
    strokes   = (pages[id]?.strokes||[]).map(s=>({...s, points:s.points?s.points.slice():undefined, id:s.tool==='shape'?(s.id||uid()):s.id}));
    textBoxes = (pages[id]?.textBoxes||[]).map(tb=>({...tb}));
    paperStyle = pages[id]?.paperStyle || 'lined';
    selectedTB = null;
    selectedShape = null;
    curShapePreview = null;
    undoStack = []; curStroke = null; dirtyFlag = false;
    pageTitleIn.value = page.title||'';
    emptyState.style.display = 'none';
    canvasWrap.style.display = 'flex';
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
        tool:s.tool, color:s.color, width:s.width,
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
  function drawPaperOnContext(c, w, h, scale, style) {
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

    c.restore();
  }

  function drawPaper() {
    const dpr   = window.devicePixelRatio||1;
    const scale = dpr*zoomLevel;
    const pw    = canvas.width;
    const ph    = canvas.height;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    drawPaperOnContext(ctx, pw, ph, scale, paperStyle);
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
    if (e.touches.length===2) {
      // Two-finger pinch + pan start
      e.preventDefault();
      isPinching = true;
      if (curStroke) { curStroke=null; redrawStrokes(); } // abort any stroke
      if (curShapePreview) { curShapePreview=null; redrawStrokes(); } // abort any shape
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

  canvas.addEventListener('pointerdown', e => {
    if (!activePageId || isPinching) return;
    if (tool==='pan' || tool==='select') return; // pan/select mode: let canvasWrap scroll, no drawing
    if (tool==='pen' || tool==='highlighter') {
      // Tapping directly on an existing shape selects it for editing instead
      // of drawing a stroke on top of it. This must work for finger taps too
      // (not just the Pencil) since tapping-to-select is the normal touch
      // gesture — only actual drawing should be palm-rejected to touch.
      const pos = canvasPos(e.clientX, e.clientY);
      const hit = hitTestShape(pos);
      if (hit) { e.preventDefault(); selectShape(hit.id); return; }
    }
    if (!isDrawPointer(e)) { e.preventDefault(); return; } // palm rejection (drawing only)
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (tool==='shape') { startShape(canvasPos(e.clientX, e.clientY)); return; }
    startStroke(canvasPos(e.clientX, e.clientY));
  }, { passive:false });

  canvas.addEventListener('pointermove', e => {
    if (isPinching) return;
    if (!isDrawPointer(e)) { e.preventDefault(); return; }
    if (curShapePreview) { e.preventDefault(); continueShape(canvasPos(e.clientX, e.clientY)); return; }
    if (!curStroke) return;
    e.preventDefault();
    continueStroke(canvasPos(e.clientX, e.clientY));
  }, { passive:false });

  canvas.addEventListener('pointerup', e => {
    if (curShapePreview) { e.preventDefault(); endShape(); return; }
    if (curStroke) { e.preventDefault(); endStroke(); }
  }, { passive:false });

  canvas.addEventListener('pointercancel', () => {
    if (curShapePreview) { curShapePreview=null; redrawStrokes(); }
    if (curStroke) { curStroke=null; redrawStrokes(); }
  });

  /* ══════════════════════════════════════════════════════════════════════
     STROKE LIFECYCLE
  ══════════════════════════════════════════════════════════════════════ */
  function snapshotStrokes() {
    return strokes.map(s => s.points ? {...s, points:s.points.slice()} : {...s});
  }

  function startStroke(pos) {
    undoStack.push(snapshotStrokes());
    if (undoStack.length>60) undoStack.shift();
    curStroke = {
      tool,
      color: tool==='highlighter' ? '#FFEB3B' : penColor,
      width: tool==='eraser' ? ERASER_W : tool==='highlighter' ? strokeW*5 : strokeW,
      points:[pos],
    };
    dirtyFlag = true;
  }

  function continueStroke(pos) {
    if (!curStroke) return;
    curStroke.points.push(pos);
    redrawStrokes();
    renderStroke(ctx, curStroke);
  }

  function endStroke() {
    if (!curStroke) return;
    if (curStroke.points.length>1) strokes.push(curStroke);
    curStroke = null;
    redrawStrokes();
  }

  /* ══════════════════════════════════════════════════════════════════════
     SHAPE LIFECYCLE — drag corner-to-corner, committed as a stroke
     with tool:'shape' so it persists/undoes/erases like ink.
  ══════════════════════════════════════════════════════════════════════ */
  function startShape(pos) {
    undoStack.push(snapshotStrokes());
    if (undoStack.length>60) undoStack.shift();
    curShapePreview = {
      id:uid(), tool:'shape', kind:shapeKind, filled:shapeFilled,
      color:penColor, width:strokeW,
      x0:pos.x, y0:pos.y, x1:pos.x, y1:pos.y,
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
     SHAPE SELECTION ENGINE
     Shapes live as bitmap-rendered entries in strokes[], but once selected
     they get an HTML overlay (.nb-shape-wrap) positioned over their bounding
     box inside #nbCanvasLayer — same pattern as text boxes — so you can drag
     to move and grab corner handles to resize. The overlay is rebuilt from
     the shape's stored coordinates each time and removed on deselect.
  ══════════════════════════════════════════════════════════════════════ */
  function findShape(id) { return strokes.find(s => s.tool==='shape' && s.id===id); }

  // Distance from point p to segment a-b
  function distToSegment(p, a, b) {
    const dx=b.x-a.x, dy=b.y-a.y;
    const lenSq = dx*dx+dy*dy;
    let t = lenSq>0 ? ((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx=a.x+t*dx, cy=a.y+t*dy;
    return Math.hypot(p.x-cx, p.y-cy);
  }

  // Hit-test in logical canvas coordinates. Filled shapes hit anywhere inside
  // their bounds; outline shapes only hit near the actual stroke line, so you
  // can still draw normally inside an unfilled circle/rectangle.
  function hitTestShape(pos) {
    const PAD = 14; // generous touch tolerance, in logical px
    for (let i=strokes.length-1; i>=0; i--) {
      const s = strokes[i];
      if (s.tool!=='shape') continue;
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

  function setShapeWrapGeometry(wrap, s) {
    const x0=Math.min(s.x0,s.x1), x1=Math.max(s.x0,s.x1);
    const y0=Math.min(s.y0,s.y1), y1=Math.max(s.y0,s.y1);
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
    ssFillToggle.textContent = s.filled ? '◼ Filled' : '◻ Outline';
    ssFillToggle.classList.toggle('active', s.filled);
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
    strokes = strokes.filter(s => !(s.tool==='shape' && s.id===id));
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
    let startX, startY, sx0, sy0, sx1, sy1, dragging=false;

    function begin(clientX, clientY) {
      dragging=true; startX=clientX; startY=clientY;
      sx0=s.x0; sy0=s.y0; sx1=s.x1; sy1=s.y1;
    }
    function move(clientX, clientY) {
      if (!dragging) return;
      const dx=(clientX-startX)/zoomLevel, dy=(clientY-startY)/zoomLevel;
      s.x0=sx0+dx; s.y0=sy0+dy; s.x1=sx1+dx; s.y1=sy1+dy;
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
    let startX, startY, sx0, sy0, sx1, sy1, resizing=false;

    function begin(clientX, clientY) {
      resizing=true; startX=clientX; startY=clientY;
      sx0=s.x0; sy0=s.y0; sx1=s.x1; sy1=s.y1;
    }
    function move(clientX, clientY) {
      if (!resizing) return;
      const dx=(clientX-startX)/zoomLevel, dy=(clientY-startY)/zoomLevel;
      // Work in normalized (min/max) space, then move the edge matching this corner
      let x0=Math.min(sx0,sx1), x1=Math.max(sx0,sx1);
      let y0=Math.min(sy0,sy1), y1=Math.max(sy0,sy1);
      if (corner.includes('w')) x0 += dx; else x1 += dx;
      if (corner.includes('n')) y0 += dy; else y1 += dy;
      // Keep a minimum size so the shape never inverts/collapses
      if (x1-x0 < 8) { if (corner.includes('w')) x0=x1-8; else x1=x0+8; }
      if (y1-y0 < 8) { if (corner.includes('n')) y0=y1-8; else y1=y0+8; }
      s.x0=x0; s.y0=y0; s.x1=x1; s.y1=y1;
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
    s.filled = !s.filled;
    ssFillToggle.textContent = s.filled ? '◼ Filled' : '◻ Outline';
    ssFillToggle.classList.toggle('active', s.filled);
  }));
  ssDuplicate.addEventListener('click', () => {
    if (!selectedShape) return;
    const s = findShape(selectedShape);
    if (!s) return;
    const ns = { ...s, id:uid(), x0:s.x0+20, y0:s.y0+20, x1:s.x1+20, y1:s.y1+20 };
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
    tool = 'pen';
    [penBtn,penBtn2].forEach(b=>b&&b.classList.toggle('active',true));
    [hiBtn,hiBtn2,eraserBtn,eraserBtn2,shapeBtn,shapeBtn2,panBtn,panBtn2]
      .forEach(b=>b&&b.classList.remove('active'));
    canvas.style.cursor = 'crosshair';
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
      if ((tool==='pen' || tool==='highlighter') && activePageId) {
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
