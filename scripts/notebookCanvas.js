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
const MARGIN_LEFT  = 60;
const PAPER_BG     = '#fdfcf7';
const LINE_COLOR   = '#c8d8e8';
const MARGIN_COLOR = '#e8a0a0';
const INK_DEFAULT  = '#1a1a2e';
const ERASER_W     = 36;
const PAGE_ROWS    = 45;
const AUTOSAVE_MS  = 30_000;
const API_ENDPOINT = '/.netlify/functions/anthropic-proxy';

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

  let tool      = 'pen';
  let penColor  = INK_DEFAULT;
  let strokeW   = 2.5;
  let zoomLevel = 1.0;
  let tbCollapsed = false;   // toolbar collapsed state

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
      display:flex; flex-direction:column; overflow:hidden;
      transition:width 0.22s ease;
    }
    #nbSidebar.collapsed { width:0; }
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

    /* ── Sidebar ── */
    #nbSideHeader { padding:12px 12px 6px; flex-shrink:0; }
    #nbSideTitle  { font-size:12px; font-weight:900; color:#C9A84C; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:8px; }
    #nbSearchBox  {
      width:100%; padding:6px 10px; border-radius:7px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 12px inherit; outline:none;
    }
    #nbSearchBox::placeholder { color:rgba(255,255,255,0.3); }
    #nbNewPageBtn, #nbNewFolderBtn {
      width:100%; padding:7px; border-radius:7px; margin-top:5px;
      font:700 11px inherit; cursor:pointer; border:1px dashed;
      background:transparent; letter-spacing:0.3px;
    }
    #nbNewPageBtn   { border-color:rgba(201,168,76,0.45); color:#C9A84C; }
    #nbNewFolderBtn { border-color:rgba(255,255,255,0.18); color:rgba(255,255,255,0.5); }
    #nbNewPageBtn:hover   { background:rgba(201,168,76,0.1); }
    #nbNewFolderBtn:hover { background:rgba(255,255,255,0.05); }
    #nbSideList { flex:1; overflow-y:auto; padding:0 8px 16px; }
    #nbSideList::-webkit-scrollbar { width:3px; }
    #nbSideList::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

    .nb-folder-row {
      display:flex; align-items:center; gap:5px;
      padding:5px 7px; border-radius:7px; margin-bottom:2px;
      color:rgba(255,255,255,0.7); font:700 11px inherit; cursor:pointer; user-select:none;
    }
    .nb-folder-row:hover { background:rgba(255,255,255,0.05); }
    .nb-folder-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-folder-dot  { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .nb-folder-actions { display:none; gap:3px; }
    .nb-folder-row:hover .nb-folder-actions { display:flex; }
    .nb-folder-action-btn {
      background:none; border:none; color:rgba(255,255,255,0.35);
      cursor:pointer; font-size:10px; padding:2px 4px; border-radius:3px;
    }
    .nb-folder-action-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }

    .nb-page-row {
      display:flex; align-items:center; gap:5px;
      padding:7px 9px; border-radius:9px; margin-bottom:2px;
      background:rgba(255,255,255,0.03); border:1px solid transparent;
      cursor:pointer; transition:background 0.1s;
    }
    .nb-page-row:hover  { background:rgba(255,255,255,0.07); }
    .nb-page-row.active { background:rgba(201,168,76,0.12); border-color:rgba(201,168,76,0.3); }
    .nb-page-icon  { font-size:14px; flex-shrink:0; }
    .nb-page-info  { flex:1; min-width:0; }
    .nb-page-title { font-size:11px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-page-date  { font-size:9px; color:rgba(255,255,255,0.35); margin-top:2px; }
    .nb-page-del   { background:none; border:none; color:rgba(255,255,255,0.2); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:3px; display:none; }
    .nb-page-row:hover .nb-page-del { display:block; }
    .nb-page-del:hover { background:rgba(231,76,60,0.2); color:#e74c3c; }

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
        <canvas id="nbCanvas"></canvas>
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
            <button class="nbt green" id="nbSaveTransBtn">Save ✓</button>
            <button class="nbt blue"  id="nbRetranscribeBtn">↻ Re-transcribe</button>
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
  const panBtn        = $('nbPanBtn');
  const undoBtn       = $('nbUndoBtn');
  const clearBtn      = $('nbClearBtn');
  const doneBtn       = $('nbDoneBtn');
  const transcribeBtn = $('nbTranscribeBtn');

  const penBtn2       = $('nbPenBtn2');
  const hiBtn2        = $('nbHiBtn2');
  const eraserBtn2    = $('nbEraserBtn2');
  const panBtn2       = $('nbPanBtn2');
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
  const retransBtn    = $('nbRetranscribeBtn');

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
  sideToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(sizeCanvas, 250);
  });

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
    strokes   = (pages[id]?.strokes||[]).map(s=>({...s,points:s.points.slice()}));
    undoStack = []; curStroke = null; dirtyFlag = false;
    pageTitleIn.value = page.title||'';
    emptyState.style.display = 'none';
    canvasWrap.style.display = 'flex';
    sizeCanvas();
    renderSidebar(searchBox.value);
    if (isNew) setTimeout(()=>pageTitleIn.focus(), 120);
  }

  function saveCurrentPage() {
    if (!activePageId||!dirtyFlag) return;
    const page = (meta.pages||[]).find(p=>p.id===activePageId);
    if (!page) return;
    page.title     = pageTitleIn.value.trim()||todayISO();
    page.updatedAt = Date.now();
    pages[activePageId] = pages[activePageId]||{};
    pages[activePageId].strokes = strokes.map(s=>({
      tool:s.tool, color:s.color, width:s.width,
      points:s.points.map(p=>({ x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10 })),
    }));
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
    ctx.setTransform(dpr*zoomLevel, 0, 0, dpr*zoomLevel, 0, 0);
    drawPaper();
    redrawStrokes();
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
  function drawPaper() {
    const dpr   = window.devicePixelRatio||1;
    const scale = dpr*zoomLevel;
    const pw    = canvas.width;
    const ph    = canvas.height;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(0,0,pw,ph);

    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1;
    for (let row=2; row<=PAGE_ROWS; row++) {
      const y = row*LINE_SPACING*scale;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(pw,y); ctx.stroke();
    }

    ctx.strokeStyle = MARGIN_COLOR;
    ctx.lineWidth   = 1.5;
    const mx = MARGIN_LEFT*scale;
    ctx.beginPath(); ctx.moveTo(mx,0); ctx.lineTo(mx,ph); ctx.stroke();

    ctx.fillStyle = '#ccc';
    for (let row=1; row<=PAGE_ROWS; row+=2) {
      const y = row*LINE_SPACING*scale;
      ctx.beginPath(); ctx.arc(14*scale, y, 5*scale, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
    ctx.setTransform(dpr*zoomLevel, 0, 0, dpr*zoomLevel, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE RENDERING — uniform width, no pressure
  ══════════════════════════════════════════════════════════════════════ */
  function redrawStrokes() {
    drawPaper();
    strokes.forEach(s => renderStroke(ctx,s));
  }

  function renderStroke(c,s) {
    if (!s.points||s.points.length<2) return;
    c.save();
    c.lineCap='round'; c.lineJoin='round';

    if (s.tool==='eraser') {
      c.globalCompositeOperation='destination-out';
      c.strokeStyle='rgba(0,0,0,1)';
      c.lineWidth=s.width;
      smoothPath(c,s.points);
    } else if (s.tool==='highlighter') {
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
     COORDINATE HELPER
  ══════════════════════════════════════════════════════════════════════ */
  function canvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x:(clientX-rect.left)/zoomLevel, y:(clientY-rect.top)/zoomLevel };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PINCH-TO-ZOOM — raw touch events on canvasWrap (separate from drawing)
     This avoids all conflict with pointer events used for drawing.
  ══════════════════════════════════════════════════════════════════════ */
  let pinchDist0 = 0;
  let pinchZoom0 = 1;
  let pinchMidX  = 0;
  let pinchMidY  = 0;
  let isPinching = false;

  function getTouchDist(t0, t1) {
    const dx=t0.clientX-t1.clientX, dy=t0.clientY-t1.clientY;
    return Math.sqrt(dx*dx+dy*dy);
  }

  // canvasWrap handles pinch; we set touch-action:none on it
  // so the browser doesn't intercept the gesture
  canvasWrap.style.touchAction = 'none';

  canvasWrap.addEventListener('touchstart', e => {
    if (e.touches.length===2) {
      // Two-finger pinch start
      e.preventDefault();
      isPinching = true;
      if (curStroke) { curStroke=null; redrawStrokes(); } // abort any stroke
      pinchDist0 = getTouchDist(e.touches[0], e.touches[1]);
      pinchZoom0 = zoomLevel;
      pinchMidX  = (e.touches[0].clientX+e.touches[1].clientX)/2;
      pinchMidY  = (e.touches[0].clientY+e.touches[1].clientY)/2;
    }
    // 1-finger touches handled by pointer events on canvas
  }, { passive:false });

  canvasWrap.addEventListener('touchmove', e => {
    if (isPinching && e.touches.length===2) {
      e.preventDefault();
      const d    = getTouchDist(e.touches[0], e.touches[1]);
      const midX = (e.touches[0].clientX+e.touches[1].clientX)/2;
      const midY = (e.touches[0].clientY+e.touches[1].clientY)/2;
      if (pinchDist0>0) applyZoom(pinchZoom0*(d/pinchDist0), midX, midY);
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
    if (!isDrawPointer(e)) { e.preventDefault(); return; } // palm rejection
    if (tool==='pan') return; // pan mode: let canvasWrap scroll
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    startStroke(canvasPos(e.clientX, e.clientY));
  }, { passive:false });

  canvas.addEventListener('pointermove', e => {
    if (!curStroke || isPinching) return;
    if (!isDrawPointer(e)) { e.preventDefault(); return; }
    e.preventDefault();
    continueStroke(canvasPos(e.clientX, e.clientY));
  }, { passive:false });

  canvas.addEventListener('pointerup', e => {
    if (curStroke) { e.preventDefault(); endStroke(); }
  }, { passive:false });

  canvas.addEventListener('pointercancel', () => {
    if (curStroke) { curStroke=null; redrawStrokes(); }
  });

  /* ══════════════════════════════════════════════════════════════════════
     STROKE LIFECYCLE
  ══════════════════════════════════════════════════════════════════════ */
  function startStroke(pos) {
    undoStack.push(strokes.map(s=>({...s,points:s.points.slice()})));
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
     TOOL BUTTONS
  ══════════════════════════════════════════════════════════════════════ */
  function setTool(t) {
    tool = t;
    [penBtn,penBtn2].forEach(b=>b&&b.classList.toggle('active',t==='pen'));
    [hiBtn,hiBtn2].forEach(b=>b&&b.classList.toggle('active',t==='highlighter'));
    [eraserBtn,eraserBtn2].forEach(b=>b&&b.classList.toggle('active',t==='eraser'));
    [panBtn,panBtn2].forEach(b=>b&&b.classList.toggle('active',t==='pan'));
    canvas.style.cursor = t==='eraser'?'cell':t==='pan'?'grab':'crosshair';
  }

  penBtn.addEventListener('click',    ()=>setTool('pen'));
  hiBtn.addEventListener('click',     ()=>setTool('highlighter'));
  eraserBtn.addEventListener('click', ()=>setTool('eraser'));
  panBtn.addEventListener('click',    ()=>setTool(tool==='pan'?'pen':'pan'));
  penBtn2.addEventListener('click',    ()=>setTool('pen'));
  hiBtn2.addEventListener('click',     ()=>setTool('highlighter'));
  eraserBtn2.addEventListener('click', ()=>setTool('eraser'));
  panBtn2.addEventListener('click',    ()=>setTool(tool==='pan'?'pen':'pan'));

  undoBtn.addEventListener('click', ()=>{
    if (undoStack.length) { strokes=undoStack.pop(); dirtyFlag=true; redrawStrokes(); }
  });
  clearBtn.addEventListener('click', ()=>{
    if (!strokes.length||!confirm('Clear all ink on this page?')) return;
    undoStack.push(strokes.slice()); strokes=[]; dirtyFlag=true; redrawStrokes();
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

      let resp;
      try {
        resp = await fetch(API_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body });
        if (!resp.ok) throw new Error('proxy '+resp.status);
      } catch {
        resp = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{ 'Content-Type':'application/json','anthropic-version':'2023-06-01' },
          body,
        });
      }

      if (!resp.ok) throw new Error('API error '+resp.status+': '+(await resp.text().catch(()=>'')).slice(0,200));
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
    oc.scale(scale, scale);

    // Paper background
    oc.fillStyle = PAPER_BG;
    oc.fillRect(0, 0, bw, bh);

    // Ruled lines
    oc.strokeStyle = LINE_COLOR; oc.lineWidth = 0.8;
    for (let row = 2; row <= PAGE_ROWS; row++) {
      const y = row * LINE_SPACING;
      oc.beginPath(); oc.moveTo(0, y); oc.lineTo(bw, y); oc.stroke();
    }

    // Margin line
    oc.strokeStyle = MARGIN_COLOR; oc.lineWidth = 1.5;
    oc.beginPath(); oc.moveTo(MARGIN_LEFT, 0); oc.lineTo(MARGIN_LEFT, bh); oc.stroke();

    // Strokes
    strokes.forEach(s => renderStroke(oc, s));

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
     INIT
  ══════════════════════════════════════════════════════════════════════ */
  renderSidebar();
  const lastPage=(meta.pages||[]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
  if (lastPage) loadPage(lastPage.id);
}
