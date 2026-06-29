/**
 * notebookCanvas.js  —  Full-featured handwriting notebook for TJM Dashboard
 * ═══════════════════════════════════════════════════════════════════════════
 * Fixes in this version
 * ─────────────────────
 *  1. Page title is always white & readable on dark toolbar
 *  2. Two-finger pinch → zoom + pan (no accidental drawing during pinch)
 *     One-finger on canvasWrap with "Pan" mode button also works
 *  3. Stroke thickness slider fixed (continuous, no step glitch)
 *  4. Pressure sensitivity removed — uniform pen width
 *  5. API call routed through Netlify proxy to fix CORS/load-failed error
 */

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════ */
const LINE_SPACING  = 36;
const MARGIN_LEFT   = 60;
const PAPER_BG      = '#fdfcf7';
const LINE_COLOR    = '#c8d8e8';
const MARGIN_COLOR  = '#e8a0a0';
const INK_DEFAULT   = '#1a1a2e';
const ERASER_W      = 36;
const PAGE_ROWS     = 45;
const AUTOSAVE_MS   = 30_000;
// Netlify proxy endpoint — matches your existing anthropic-proxy function
const API_ENDPOINT  = '/.netlify/functions/anthropic-proxy';

const QUICK_COLORS = [
  '#1a1a2e', '#e74c3c', '#e67e22', '#2ecc71',
  '#3498db', '#9b59b6', '#C9A84C', '#ffffff',
];

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function fmtDate(iso) {
  try {
    const d = new Date((iso||'').length === 10 ? iso + 'T12:00:00' : iso);
    return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  } catch { return iso || ''; }
}

function todayISO() { return new Date().toISOString().slice(0,10); }

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════════ */
export function openNotebook({ state, saveData }) {

  /* ── Ensure Firebase data structures exist ────────────────────────────── */
  if (!state.data.notebookMeta)  state.data.notebookMeta  = { folders:[], pages:[] };
  if (!state.data.notebookPages) state.data.notebookPages = {};
  const meta  = state.data.notebookMeta;
  const pages = state.data.notebookPages;

  /* ── Active page state ──────────────────────────────────────────────── */
  let activePageId = null;
  let strokes      = [];
  let undoStack    = [];
  let curStroke    = null;
  let dirtyFlag    = false;

  /* ── Tool / view state ──────────────────────────────────────────────── */
  let tool      = 'pen';   // 'pen' | 'highlighter' | 'eraser' | 'pan'
  let penColor  = INK_DEFAULT;
  let strokeW   = 2.5;     // logical pixels (no pressure multiplier)
  let zoomLevel = 1.0;     // 0.5 → 3.0
  let panX      = 0;       // canvas scroll offsets (applied to canvasWrap.scrollLeft/Top)
  let panY      = 0;

  /* ══════════════════════════════════════════════════════════════════════
     HTML
  ══════════════════════════════════════════════════════════════════════ */
  const overlay = document.createElement('div');
  overlay.id = 'notebookOverlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99998;',
    'display:flex;flex-direction:column;',
    'background:#1a1a2e;',
    'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;',
    'animation:nbIn 0.2s ease;',
  ].join('');

  overlay.innerHTML = `
  <style>
    @keyframes nbIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    #notebookOverlay *, #notebookOverlay *::before, #notebookOverlay *::after {
      box-sizing:border-box; -webkit-tap-highlight-color:transparent;
    }

    /* ── Layout ── */
    #nbShell   { flex:1; display:flex; overflow:hidden; min-height:0; }
    #nbSidebar { width:260px; flex-shrink:0; background:#0d0d1a; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; overflow:hidden; transition:width 0.25s ease; }
    #nbSidebar.collapsed { width:0; overflow:hidden; }
    #nbMain    { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; position:relative; }

    /* ── Top toolbar ── */
    #nbTopBar {
      display:flex; align-items:center; gap:5px;
      padding:8px 10px; background:#0d0d1a;
      border-bottom:1px solid rgba(255,255,255,0.07);
      flex-shrink:0; flex-wrap:wrap; min-height:50px;
    }
    .nbt {
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14);
      color:#fff; border-radius:9px; padding:7px 10px;
      font:700 11px/1 inherit; cursor:pointer; letter-spacing:0.4px;
      transition:background 0.15s,border-color 0.15s; white-space:nowrap; flex-shrink:0;
      -webkit-tap-highlight-color:transparent;
    }
    .nbt:hover   { background:rgba(255,255,255,0.15); }
    .nbt.active  { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a; }
    .nbt.green   { background:#27ae60; border-color:#27ae60; color:#fff; }
    .nbt.red     { background:rgba(231,76,60,0.22); border-color:rgba(231,76,60,0.5); color:#e74c3c; }
    .nbt.blue    { background:rgba(52,152,219,0.22); border-color:rgba(52,152,219,0.5); color:#74b9e8; }
    .nbt:disabled { opacity:0.4; cursor:not-allowed; }

    /* ── Page title input — always white text ── */
    #nbPageTitle {
      flex:1; min-width:80px; max-width:220px;
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.18);
      border-radius:9px; padding:7px 10px;
      color:#ffffff !important;
      caret-color:#C9A84C;
      font:700 13px/1 inherit;
      outline:none;
    }
    #nbPageTitle::placeholder { color:rgba(255,255,255,0.35); }

    /* ── Divider ── */
    .nb-div { width:1px; height:22px; background:rgba(255,255,255,0.1); flex-shrink:0; }

    /* ── Colour swatches ── */
    #nbSwatches { display:flex; gap:4px; align-items:center; flex-shrink:0; }
    .nb-swatch {
      width:20px; height:20px; border-radius:50%;
      border:2px solid rgba(255,255,255,0.18);
      cursor:pointer; transition:transform 0.12s,border-color 0.12s; flex-shrink:0;
    }
    .nb-swatch.sel   { border-color:#C9A84C; transform:scale(1.25); }
    .nb-swatch-pick  { background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red); border-color:rgba(255,255,255,0.3); }

    /* ── Size slider ── */
    #nbSizeSlider {
      -webkit-appearance:none; width:80px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.2); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbSizeSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:18px; height:18px;
      border-radius:50%; background:#C9A84C; cursor:pointer;
      border:2px solid #0d0d1a;
    }
    #nbSizeDot {
      width:10px; height:10px; border-radius:50%;
      background:#fff; opacity:0.55; transition:all 0.12s; flex-shrink:0; pointer-events:none;
    }
    #nbSizeVal { font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); width:24px; flex-shrink:0; text-align:center; }

    /* ── Zoom ── */
    #nbZoomSlider {
      -webkit-appearance:none; width:70px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.2); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbZoomSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:16px; height:16px;
      border-radius:50%; background:#3498db; cursor:pointer;
      border:2px solid #0d0d1a;
    }
    #nbZoomLabel { font-size:10px; font-weight:700; color:rgba(255,255,255,0.4); width:34px; flex-shrink:0; }

    /* ── Canvas area ── */
    #nbCanvasWrap {
      flex:1; overflow:auto; -webkit-overflow-scrolling:touch;
      display:flex; justify-content:flex-start; align-items:flex-start;
      padding:20px; background:#2a2a3a;
      /* Allow browser scroll when in pan mode; blocked otherwise by JS */
    }
    #nbCanvas {
      display:block;
      box-shadow:0 8px 40px rgba(0,0,0,0.5);
      border-radius:3px;
      flex-shrink:0;
      /* touch-action set dynamically */
    }

    /* ── Sidebar ── */
    #nbSideHeader  { padding:14px 14px 8px; flex-shrink:0; }
    #nbSideTitle   { font-size:13px; font-weight:900; color:#C9A84C; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px; }
    #nbSearchBox   {
      width:100%; padding:7px 10px; border-radius:8px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 12px inherit; outline:none;
    }
    #nbSearchBox::placeholder { color:rgba(255,255,255,0.3); }
    #nbNewPageBtn,#nbNewFolderBtn {
      width:100%; padding:8px; border-radius:8px; margin-top:6px;
      font:700 12px inherit; cursor:pointer; border:1px dashed;
      background:transparent; letter-spacing:0.4px;
    }
    #nbNewPageBtn   { border-color:rgba(201,168,76,0.45); color:#C9A84C; }
    #nbNewFolderBtn { border-color:rgba(255,255,255,0.18); color:rgba(255,255,255,0.45); }
    #nbNewPageBtn:hover   { background:rgba(201,168,76,0.1); }
    #nbNewFolderBtn:hover { background:rgba(255,255,255,0.05); }
    #nbSideList { flex:1; overflow-y:auto; padding:0 10px 20px; }
    #nbSideList::-webkit-scrollbar { width:4px; }
    #nbSideList::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

    .nb-folder-row {
      display:flex; align-items:center; gap:6px;
      padding:6px 8px; border-radius:8px; margin-bottom:2px;
      color:rgba(255,255,255,0.7); font:700 12px inherit; cursor:pointer; user-select:none;
    }
    .nb-folder-row:hover { background:rgba(255,255,255,0.05); }
    .nb-folder-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-folder-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .nb-folder-actions { display:none; gap:4px; }
    .nb-folder-row:hover .nb-folder-actions { display:flex; }
    .nb-folder-action-btn {
      background:none; border:none; color:rgba(255,255,255,0.35);
      cursor:pointer; font-size:11px; padding:2px 4px; border-radius:4px;
    }
    .nb-folder-action-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }

    .nb-page-row {
      display:flex; align-items:center; gap:6px;
      padding:8px 10px; border-radius:10px; margin-bottom:3px;
      background:rgba(255,255,255,0.03); border:1px solid transparent;
      cursor:pointer; transition:background 0.1s;
    }
    .nb-page-row:hover  { background:rgba(255,255,255,0.07); }
    .nb-page-row.active { background:rgba(201,168,76,0.12); border-color:rgba(201,168,76,0.3); }
    .nb-page-icon { font-size:15px; flex-shrink:0; }
    .nb-page-info { flex:1; min-width:0; }
    .nb-page-title { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-page-date  { font-size:10px; color:rgba(255,255,255,0.35); margin-top:2px; }
    .nb-page-del   { background:none; border:none; color:rgba(255,255,255,0.2); cursor:pointer; font-size:13px; padding:2px 5px; border-radius:4px; display:none; }
    .nb-page-row:hover .nb-page-del { display:block; }
    .nb-page-del:hover { background:rgba(231,76,60,0.2); color:#e74c3c; }

    /* ── Empty state ── */
    #nbEmptyState {
      flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:14px; color:rgba(255,255,255,0.3); text-align:center; padding:40px;
    }
    #nbEmptyState .nb-empty-icon  { font-size:52px; }
    #nbEmptyState .nb-empty-title { font-size:17px; font-weight:800; color:rgba(255,255,255,0.6); }
    #nbEmptyState .nb-empty-sub   { font-size:13px; line-height:1.6; }

    /* ── Transcription modal ── */
    #nbTransModal {
      position:absolute; inset:0; background:rgba(10,10,20,0.8);
      backdrop-filter:blur(8px); z-index:20; display:none;
      align-items:flex-end; justify-content:center; padding:16px;
    }
    #nbTransModal.open { display:flex; }
    #nbTransPanel {
      width:min(600px,100%); max-height:82vh; overflow-y:auto;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.12);
      border-radius:20px; padding:20px; animation:nbIn 0.2s ease;
    }
    #nbTransText {
      width:100%; min-height:120px; padding:12px; border-radius:10px;
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
      color:#fff; font:600 14px/1.7 inherit; resize:vertical; outline:none; margin:12px 0 8px;
    }
    .nb-correction-row { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
    .nb-correction-row input {
      flex:1; padding:6px 10px; border-radius:7px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 12px inherit; outline:none;
    }
    .nb-correction-row input::placeholder { color:rgba(255,255,255,0.3); }
    .nb-corr-del { background:none; border:none; color:rgba(231,76,60,0.6); cursor:pointer; font-size:16px; padding:0 4px; }
    #nbCorrectionNote { font-size:11px; color:rgba(255,255,255,0.35); margin-bottom:10px; line-height:1.5; }
  </style>

  <!-- ══ TOP TOOLBAR ══════════════════════════════════════════════════ -->
  <div id="nbTopBar">
    <button class="nbt" id="nbSideToggle" title="Pages sidebar">☰</button>

    <input id="nbPageTitle" placeholder="Untitled page…" value="" autocomplete="off" spellcheck="false" />

    <div class="nb-div"></div>

    <button class="nbt active" id="nbPenBtn">✒ Pen</button>
    <button class="nbt"        id="nbHiBtn">🖊 Hi</button>
    <button class="nbt"        id="nbEraserBtn">⌫ Erase</button>
    <button class="nbt"        id="nbPanBtn" title="Pan/scroll mode (or use two fingers)">✋ Pan</button>

    <div class="nb-div"></div>

    <div id="nbSwatches"></div>

    <div class="nb-div"></div>

    <!-- Thickness -->
    <div id="nbSizeDot"></div>
    <input type="range" id="nbSizeSlider" min="1" max="20" value="2.5" step="0.1" title="Stroke thickness" />
    <span id="nbSizeVal">2.5</span>

    <div class="nb-div"></div>

    <!-- Zoom -->
    <span style="font-size:11px;color:rgba(255,255,255,0.4);flex-shrink:0;">🔍</span>
    <input type="range" id="nbZoomSlider" min="50" max="300" value="100" step="5" title="Zoom" />
    <span id="nbZoomLabel">100%</span>

    <div class="nb-div"></div>

    <button class="nbt"        id="nbUndoBtn">↩</button>
    <button class="nbt red"    id="nbClearBtn">✕ Clear</button>
    <button class="nbt blue"   id="nbTranscribeBtn">✦ → Text</button>
    <button class="nbt green"  id="nbDoneBtn">Save ✓</button>
  </div>

  <!-- ══ SHELL ════════════════════════════════════════════════════════ -->
  <div id="nbShell">

    <!-- SIDEBAR -->
    <div id="nbSidebar">
      <div id="nbSideHeader">
        <div id="nbSideTitle">📓 Journal</div>
        <input type="text" id="nbSearchBox" placeholder="Search pages…" autocomplete="off" />
        <button id="nbNewPageBtn">＋ New Page</button>
        <button id="nbNewFolderBtn">📁 New Folder</button>
      </div>
      <div id="nbSideList"></div>
    </div>

    <!-- MAIN -->
    <div id="nbMain">
      <div id="nbEmptyState">
        <div class="nb-empty-icon">📓</div>
        <div class="nb-empty-title">Your Journal</div>
        <div class="nb-empty-sub">Select a page from the sidebar<br>or create a new one.</div>
        <button class="nbt green" id="nbEmptyNewBtn">＋ New Page</button>
      </div>

      <div id="nbCanvasWrap" style="display:none;">
        <canvas id="nbCanvas"></canvas>
      </div>

      <!-- Transcription modal -->
      <div id="nbTransModal">
        <div id="nbTransPanel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-size:16px;font-weight:900;color:#fff;">✦ Handwriting → Text</div>
            <button class="nbt" id="nbTransClose">Close</button>
          </div>
          <div id="nbTransStatus" style="font-size:12px;color:rgba(255,255,255,0.45);min-height:18px;"></div>
          <textarea id="nbTransText" placeholder="Transcribed text will appear here…"></textarea>
          <div id="nbCorrectionNote">
            📝 Add corrections below — the AI learns from these over time.
            Left = what it got wrong · Right = what it should say.
          </div>
          <div id="nbCorrectionList"></div>
          <button class="nbt" id="nbAddCorrBtn" style="margin-bottom:12px;">＋ Add correction</button>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="nbt green" id="nbSaveTransBtn">Save text ✓</button>
            <button class="nbt blue"  id="nbRetranscribeBtn">↻ Re-transcribe</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Hidden colour picker -->
  <input type="color" id="nbColorPicker" value="#1a1a2e"
    style="opacity:0;position:fixed;width:1px;height:1px;top:0;left:0;pointer-events:none;" />
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  /* ══════════════════════════════════════════════════════════════════════
     DOM REFS
  ══════════════════════════════════════════════════════════════════════ */
  const sideToggle    = overlay.querySelector('#nbSideToggle');
  const sidebar       = overlay.querySelector('#nbSidebar');
  const sideList      = overlay.querySelector('#nbSideList');
  const searchBox     = overlay.querySelector('#nbSearchBox');
  const newPageBtn    = overlay.querySelector('#nbNewPageBtn');
  const newFolderBtn  = overlay.querySelector('#nbNewFolderBtn');
  const emptyState    = overlay.querySelector('#nbEmptyState');
  const emptyNewBtn   = overlay.querySelector('#nbEmptyNewBtn');
  const canvasWrap    = overlay.querySelector('#nbCanvasWrap');
  const canvas        = overlay.querySelector('#nbCanvas');
  const ctx           = canvas.getContext('2d');
  const pageTitleIn   = overlay.querySelector('#nbPageTitle');
  const penBtn        = overlay.querySelector('#nbPenBtn');
  const hiBtn         = overlay.querySelector('#nbHiBtn');
  const eraserBtn     = overlay.querySelector('#nbEraserBtn');
  const panBtn        = overlay.querySelector('#nbPanBtn');
  const undoBtn       = overlay.querySelector('#nbUndoBtn');
  const clearBtn      = overlay.querySelector('#nbClearBtn');
  const doneBtn       = overlay.querySelector('#nbDoneBtn');
  const transcribeBtn = overlay.querySelector('#nbTranscribeBtn');
  const swatchesEl    = overlay.querySelector('#nbSwatches');
  const sizeSlider    = overlay.querySelector('#nbSizeSlider');
  const sizeDot       = overlay.querySelector('#nbSizeDot');
  const sizeVal       = overlay.querySelector('#nbSizeVal');
  const zoomSlider    = overlay.querySelector('#nbZoomSlider');
  const zoomLabel     = overlay.querySelector('#nbZoomLabel');
  const colorPicker   = overlay.querySelector('#nbColorPicker');
  const transModal    = overlay.querySelector('#nbTransModal');
  const transText     = overlay.querySelector('#nbTransText');
  const transStatus   = overlay.querySelector('#nbTransStatus');
  const transClose    = overlay.querySelector('#nbTransClose');
  const corrList      = overlay.querySelector('#nbCorrectionList');
  const addCorrBtn    = overlay.querySelector('#nbAddCorrBtn');
  const saveTransBtn  = overlay.querySelector('#nbSaveTransBtn');
  const retransBtn    = overlay.querySelector('#nbRetranscribeBtn');

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR TOGGLE
  ══════════════════════════════════════════════════════════════════════ */
  sideToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(sizeCanvas, 280);
  });

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR RENDER
  ══════════════════════════════════════════════════════════════════════ */
  function renderSidebar(filter='') {
    const fl = filter.toLowerCase().trim();
    let html = '';

    (meta.folders||[]).forEach(folder => {
      html += `
        <div class="nb-folder-row" data-folder-id="${folder.id}">
          <span class="nb-folder-dot" style="background:${folder.colour||'#C9A84C'};"></span>
          <span class="nb-folder-name">📁 ${folder.name}</span>
          <div class="nb-folder-actions">
            <button class="nb-folder-action-btn" data-rename-folder="${folder.id}" title="Rename">✎</button>
            <button class="nb-folder-action-btn" data-delete-folder="${folder.id}" title="Delete" style="color:rgba(231,76,60,0.7);">✕</button>
          </div>
        </div>`;
      (meta.pages||[])
        .filter(p => p.folderId===folder.id && matchFilter(p,fl))
        .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))
        .forEach(p => { html += pageRowHtml(p, true); });
    });

    const unfiled = (meta.pages||[]).filter(p => !p.folderId && matchFilter(p,fl))
      .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));
    if (unfiled.length && (meta.folders||[]).length) {
      html += `<div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;padding:10px 8px 4px;">Unfiled</div>`;
    }
    unfiled.forEach(p => { html += pageRowHtml(p, false); });

    if (!html) html = `<div style="padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.3);">No pages yet.</div>`;

    sideList.innerHTML = html;

    sideList.querySelectorAll('.nb-page-row').forEach(el => {
      el.addEventListener('click', () => loadPage(el.dataset.pageId));
      el.querySelector('.nb-page-del').addEventListener('click', e => { e.stopPropagation(); deletePage(el.dataset.pageId); });
    });
    sideList.querySelectorAll('[data-rename-folder]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); renameFolder(btn.dataset.renameFolder); });
    });
    sideList.querySelectorAll('[data-delete-folder]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteFolder(btn.dataset.deleteFolder); });
    });

    if (activePageId) {
      const el = sideList.querySelector(`[data-page-id="${activePageId}"]`);
      if (el) el.classList.add('active');
    }
  }

  function matchFilter(page, fl) {
    if (!fl) return true;
    return (page.title||'').toLowerCase().includes(fl) || (page.dateKey||'').includes(fl);
  }

  function pageRowHtml(page, indented) {
    const title   = page.title || 'Untitled';
    const dateStr = fmtDate(page.dateKey || todayISO());
    const indent  = indented ? 'padding-left:22px;' : '';
    return `
      <div class="nb-page-row" data-page-id="${page.id}" style="${indent}">
        <span class="nb-page-icon">📄</span>
        <div class="nb-page-info">
          <div class="nb-page-title">${title}</div>
          <div class="nb-page-date">${dateStr}</div>
        </div>
        <button class="nb-page-del" title="Delete page">🗑</button>
      </div>`;
  }

  searchBox.addEventListener('input', () => renderSidebar(searchBox.value));

  /* ══════════════════════════════════════════════════════════════════════
     PAGE MANAGEMENT
  ══════════════════════════════════════════════════════════════════════ */
  function newPage(folderId=null) {
    saveCurrentPage();
    const id  = uid();
    const now = Date.now();
    const page = { id, dateKey:todayISO(), title:'', folderId, createdAt:now, updatedAt:now };
    meta.pages = meta.pages||[];
    meta.pages.unshift(page);
    pages[id] = { strokes:[], transcription:null };
    persistMeta();
    loadPage(id, true);
  }

  function loadPage(id, isNew=false) {
    saveCurrentPage();
    activePageId = id;
    const page = (meta.pages||[]).find(p => p.id===id);
    if (!page) return;

    strokes   = (pages[id]?.strokes||[]).map(s => ({ ...s, points:s.points.slice() }));
    undoStack = [];
    curStroke = null;
    dirtyFlag = false;

    pageTitleIn.value = page.title || '';
    emptyState.style.display   = 'none';
    canvasWrap.style.display   = 'flex';
    sizeCanvas();
    renderSidebar(searchBox.value);

    if (isNew) setTimeout(() => pageTitleIn.focus(), 120);
  }

  function saveCurrentPage() {
    if (!activePageId || !dirtyFlag) return;
    const page = (meta.pages||[]).find(p => p.id===activePageId);
    if (!page) return;
    page.title     = pageTitleIn.value.trim() || todayISO();
    page.updatedAt = Date.now();
    pages[activePageId] = pages[activePageId]||{};
    pages[activePageId].strokes = strokes.map(s => ({
      tool:   s.tool,
      color:  s.color,
      width:  s.width,
      points: s.points.map(p => ({ x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10 })),
    }));
    persistMeta();
    dirtyFlag = false;
  }

  function deletePage(id) {
    if (!confirm('Delete this page permanently?')) return;
    meta.pages = (meta.pages||[]).filter(p => p.id!==id);
    delete pages[id];
    if (activePageId===id) {
      activePageId = null; strokes = [];
      canvasWrap.style.display = 'none';
      emptyState.style.display = 'flex';
    }
    persistMeta(); renderSidebar(searchBox.value);
  }

  newPageBtn.addEventListener('click',   () => newPage());
  emptyNewBtn.addEventListener('click',  () => newPage());
  newFolderBtn.addEventListener('click', () => {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    const cols = ['#C9A84C','#3498db','#2ecc71','#e74c3c','#9b59b6'];
    meta.folders = meta.folders||[];
    meta.folders.push({ id:uid(), name:name.trim(), colour:cols[meta.folders.length % cols.length] });
    persistMeta(); renderSidebar(searchBox.value);
  });

  function renameFolder(id) {
    const f = (meta.folders||[]).find(x => x.id===id); if (!f) return;
    const n = prompt('Rename folder:', f.name); if (!n?.trim()) return;
    f.name = n.trim(); persistMeta(); renderSidebar(searchBox.value);
  }
  function deleteFolder(id) {
    if (!confirm('Delete folder? Pages inside become unfiled.')) return;
    meta.folders = (meta.folders||[]).filter(x => x.id!==id);
    (meta.pages||[]).forEach(p => { if (p.folderId===id) p.folderId=null; });
    persistMeta(); renderSidebar(searchBox.value);
  }

  pageTitleIn.addEventListener('blur', () => {
    if (!activePageId) return;
    const page = (meta.pages||[]).find(p => p.id===activePageId);
    if (page) { page.title = pageTitleIn.value.trim()||todayISO(); persistMeta(); }
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
    const dpr = window.devicePixelRatio || 1;
    const bw  = getBaseWidth();
    const bh  = LINE_SPACING * PAGE_ROWS + LINE_SPACING;
    const w   = Math.round(bw  * zoomLevel);
    const h   = Math.round(bh  * zoomLevel);

    canvas.width        = w * dpr;
    canvas.height       = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';

    // Reset transform then apply DPR + zoom together
    ctx.setTransform(dpr * zoomLevel, 0, 0, dpr * zoomLevel, 0, 0);
    drawPaper();
    redrawStrokes();
  }

  /* ══════════════════════════════════════════════════════════════════════
     ZOOM SLIDER
  ══════════════════════════════════════════════════════════════════════ */
  zoomSlider.addEventListener('input', () => {
    zoomLevel = parseInt(zoomSlider.value) / 100;
    zoomLabel.textContent = zoomSlider.value + '%';
    sizeCanvas();
  });

  window.addEventListener('resize', () => { if (activePageId) sizeCanvas(); });

  /* ══════════════════════════════════════════════════════════════════════
     PAPER DRAWING
  ══════════════════════════════════════════════════════════════════════ */
  function drawPaper() {
    // Work in logical (pre-zoom) coordinates because the ctx transform handles zoom+DPR
    const bw = getBaseWidth();
    const bh = LINE_SPACING * PAGE_ROWS + LINE_SPACING;

    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    const dpr = window.devicePixelRatio||1;
    const pw  = canvas.width;
    const ph  = canvas.height;

    // Paper background
    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(0, 0, pw, ph);

    const scale = dpr * zoomLevel;

    // Ruled lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1;
    for (let row=2; row<=PAGE_ROWS; row++) {
      const y = row * LINE_SPACING * scale;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(pw,y); ctx.stroke();
    }

    // Red margin line
    ctx.strokeStyle = MARGIN_COLOR;
    ctx.lineWidth   = 1.5;
    const mx = MARGIN_LEFT * scale;
    ctx.beginPath(); ctx.moveTo(mx,0); ctx.lineTo(mx,ph); ctx.stroke();

    // Spiral binding dots
    ctx.fillStyle = '#ccc';
    for (let row=1; row<=PAGE_ROWS; row+=2) {
      const y = row * LINE_SPACING * scale;
      ctx.beginPath(); ctx.arc(14*scale, y, 5*scale, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
    // Re-apply zoom transform for subsequent stroke drawing
    ctx.setTransform(dpr*zoomLevel, 0, 0, dpr*zoomLevel, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE RENDERING  (NO pressure sensitivity — uniform width)
  ══════════════════════════════════════════════════════════════════════ */
  function redrawStrokes() {
    drawPaper();
    strokes.forEach(s => renderStroke(ctx, s));
  }

  function renderStroke(c, s) {
    if (!s.points || s.points.length < 2) return;

    if (s.tool === 'eraser') {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = 'rgba(0,0,0,1)';
      c.lineWidth   = s.width;
      c.lineCap     = 'round'; c.lineJoin = 'round';
      smoothPath(c, s.points);
      c.restore();
      return;
    }

    if (s.tool === 'highlighter') {
      c.save();
      c.globalAlpha  = 0.38;
      c.strokeStyle  = s.color || '#FFEB3B';
      c.lineWidth    = s.width || 22;
      c.lineCap      = 'square'; c.lineJoin = 'square';
      c.globalCompositeOperation = 'multiply';
      smoothPath(c, s.points);
      c.restore();
      return;
    }

    // Pen — UNIFORM width (pressure removed)
    c.save();
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.lineWidth   = s.width || strokeW;   // flat, no pressure multiplier
    c.strokeStyle = s.color || INK_DEFAULT;
    c.globalCompositeOperation = 'source-over';
    smoothPath(c, s.points);
    c.restore();
  }

  function smoothPath(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i=1; i<pts.length-1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke();
  }

  /* ══════════════════════════════════════════════════════════════════════
     COORDINATE HELPER
  ══════════════════════════════════════════════════════════════════════ */
  function canvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoomLevel,
      y: (clientY - rect.top)  / zoomLevel,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PINCH-TO-ZOOM STATE
  ══════════════════════════════════════════════════════════════════════ */
  let pinchActive   = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchPointers  = {};   // pointerId → {x,y}

  function pinchDist() {
    const pts = Object.values(pinchPointers);
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  /* ══════════════════════════════════════════════════════════════════════
     POINTER EVENTS (drawing + pinch)
  ══════════════════════════════════════════════════════════════════════ */
  function updateTouchAction() {
    // In pan mode or when more than 1 finger: let browser handle scrolling
    if (tool === 'pan') {
      canvas.style.touchAction = 'pan-x pan-y';
      canvasWrap.style.touchAction = 'auto';
    } else {
      canvas.style.touchAction = 'none';
      canvasWrap.style.touchAction = 'none';
    }
  }
  updateTouchAction();

  canvas.addEventListener('pointerdown', onPtrDown, { passive: false });
  canvas.addEventListener('pointermove', onPtrMove, { passive: false });
  canvas.addEventListener('pointerup',   onPtrUp,   { passive: false });
  canvas.addEventListener('pointercancel', onPtrUp, { passive: false });

  function onPtrDown(e) {
    if (!activePageId) return;
    pinchPointers[e.pointerId] = { x:e.clientX, y:e.clientY };

    const numPointers = Object.keys(pinchPointers).length;

    if (numPointers >= 2) {
      // Two+ fingers → pinch zoom, abort any ongoing stroke
      e.preventDefault();
      if (curStroke) { curStroke = null; redrawStrokes(); }
      pinchActive    = true;
      pinchStartDist = pinchDist();
      pinchStartZoom = zoomLevel;
      return;
    }

    if (tool === 'pan') { return; } // let canvasWrap scroll handle it

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pos = canvasPos(e.clientX, e.clientY);
    startStroke(pos);
  }

  function onPtrMove(e) {
    pinchPointers[e.pointerId] = { x:e.clientX, y:e.clientY };

    if (pinchActive) {
      e.preventDefault();
      const numPointers = Object.keys(pinchPointers).length;
      if (numPointers >= 2) {
        const dist = pinchDist();
        if (pinchStartDist > 0) {
          let newZoom = pinchStartZoom * (dist / pinchStartDist);
          newZoom = Math.min(3, Math.max(0.5, newZoom));
          zoomLevel = newZoom;
          zoomSlider.value    = Math.round(newZoom * 100);
          zoomLabel.textContent = Math.round(newZoom * 100) + '%';
          sizeCanvas();
        }
      }
      return;
    }

    if (tool === 'pan' || !curStroke) return;
    e.preventDefault();
    const pos = canvasPos(e.clientX, e.clientY);
    continueStroke(pos);
  }

  function onPtrUp(e) {
    delete pinchPointers[e.pointerId];
    const numPointers = Object.keys(pinchPointers).length;

    if (numPointers < 2) {
      if (pinchActive) { pinchActive = false; return; }
    }

    if (curStroke) {
      e.preventDefault();
      endStroke();
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE LIFECYCLE
  ══════════════════════════════════════════════════════════════════════ */
  function startStroke(pos) {
    undoStack.push(strokes.map(s => ({ ...s, points:s.points.slice() })));
    if (undoStack.length > 60) undoStack.shift();
    curStroke = {
      tool,
      color: tool==='highlighter' ? '#FFEB3B' : penColor,
      width: tool==='eraser' ? ERASER_W : tool==='highlighter' ? strokeW*5 : strokeW,
      points: [pos],
    };
    dirtyFlag = true;
  }

  function continueStroke(pos) {
    if (!curStroke) return;
    curStroke.points.push(pos);
    // Incremental redraw: clear and redraw everything including current stroke
    redrawStrokes();
    renderStroke(ctx, curStroke);
  }

  function endStroke() {
    if (!curStroke) return;
    if (curStroke.points.length > 1) strokes.push(curStroke);
    curStroke = null;
    redrawStrokes();
  }

  /* ══════════════════════════════════════════════════════════════════════
     TOOL BUTTONS
  ══════════════════════════════════════════════════════════════════════ */
  function setTool(t) {
    tool = t;
    penBtn.classList.toggle('active',    t==='pen');
    hiBtn.classList.toggle('active',     t==='highlighter');
    eraserBtn.classList.toggle('active', t==='eraser');
    panBtn.classList.toggle('active',    t==='pan');
    canvas.style.cursor = t==='eraser' ? 'cell' : t==='pan' ? 'grab' : 'crosshair';
    updateTouchAction();
  }

  penBtn.addEventListener('click',    () => setTool('pen'));
  hiBtn.addEventListener('click',     () => setTool('highlighter'));
  eraserBtn.addEventListener('click', () => setTool('eraser'));
  panBtn.addEventListener('click',    () => setTool(tool==='pan' ? 'pen' : 'pan'));

  undoBtn.addEventListener('click', () => {
    if (undoStack.length) { strokes = undoStack.pop(); dirtyFlag=true; redrawStrokes(); }
  });
  clearBtn.addEventListener('click', () => {
    if (!strokes.length || !confirm('Clear all ink on this page?')) return;
    undoStack.push(strokes.slice()); strokes=[]; dirtyFlag=true; redrawStrokes();
  });

  /* ══════════════════════════════════════════════════════════════════════
     COLOUR SWATCHES
  ══════════════════════════════════════════════════════════════════════ */
  function buildSwatches() {
    swatchesEl.innerHTML = '';
    QUICK_COLORS.forEach(c => {
      const d = document.createElement('div');
      d.className  = 'nb-swatch' + (c===penColor ? ' sel' : '');
      d.style.background = c;
      if (c==='#ffffff') d.style.border = '2px solid rgba(255,255,255,0.35)';
      d.title = c;
      d.addEventListener('click', () => {
        penColor = c; colorPicker.value = c;
        buildSwatches(); setTool('pen');
      });
      swatchesEl.appendChild(d);
    });
    // Custom colour picker swatch
    const pick = document.createElement('div');
    pick.className = 'nb-swatch nb-swatch-pick';
    pick.title = 'Custom colour';
    pick.addEventListener('click', () => colorPicker.click());
    swatchesEl.appendChild(pick);
  }

  colorPicker.addEventListener('input', () => {
    penColor = colorPicker.value;
    buildSwatches(); setTool('pen');
  });
  buildSwatches();

  /* ══════════════════════════════════════════════════════════════════════
     SIZE SLIDER  (fixed: continuous, no step glitch)
  ══════════════════════════════════════════════════════════════════════ */
  function applySize() {
    strokeW = parseFloat(sizeSlider.value);
    const display = strokeW.toFixed(1);
    sizeVal.textContent = display;
    // Live dot preview
    const dotPx = Math.min(22, Math.max(4, strokeW * 2));
    sizeDot.style.width  = dotPx + 'px';
    sizeDot.style.height = dotPx + 'px';
    sizeDot.style.background = penColor !== '#ffffff' ? penColor : '#aaa';
  }

  sizeSlider.addEventListener('input', applySize);
  sizeSlider.addEventListener('change', applySize); // catch final value on iOS
  applySize();

  /* ══════════════════════════════════════════════════════════════════════
     SAVE & CLOSE
  ══════════════════════════════════════════════════════════════════════ */
  function close() {
    saveCurrentPage();
    clearInterval(autoSaveInterval);
    window.removeEventListener('keydown', escHandler);
    window.removeEventListener('resize', onResize);
    overlay.style.transition = 'opacity 0.2s';
    overlay.style.opacity    = '0';
    setTimeout(() => { overlay.remove(); document.body.style.overflow=''; }, 230);
  }

  doneBtn.addEventListener('click', close);

  function escHandler(e) { if (e.key==='Escape' && !transModal.classList.contains('open')) close(); }
  window.addEventListener('keydown', escHandler);

  function onResize() { if (activePageId) sizeCanvas(); }
  window.addEventListener('resize', onResize);

  const autoSaveInterval = setInterval(() => { if (dirtyFlag) saveCurrentPage(); }, AUTOSAVE_MS);

  /* ══════════════════════════════════════════════════════════════════════
     HANDWRITING → TEXT
     Routes through your existing Netlify proxy to avoid CORS.
     If the proxy isn't available it falls back to a direct fetch
     (works in dev / non-Netlify environments).
  ══════════════════════════════════════════════════════════════════════ */
  transcribeBtn.addEventListener('click', () => {
    if (!activePageId) { alert('Open a page first.'); return; }
    transModal.classList.add('open');
    const existing = pages[activePageId]?.transcription || {};
    transText.value = existing.text || '';
    buildCorrectionUI(existing.corrections || []);
    if (!existing.text) doTranscribe();
  });

  transClose.addEventListener('click', () => transModal.classList.remove('open'));
  retransBtn.addEventListener('click', doTranscribe);

  async function doTranscribe() {
    transStatus.textContent  = '⏳ Converting your handwriting…';
    transcribeBtn.disabled   = true;
    retransBtn.disabled      = true;

    try {
      const imgData        = await canvasToBase64();
      const allCorrections = collectAllCorrections();
      const corrNote       = allCorrections.length
        ? '\n\nPrevious corrections (apply these):\n' +
          allCorrections.map(c => `"${c.original}" → "${c.corrected}"`).join('\n')
        : '';

      const body = JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system:     `You are a handwriting transcription assistant. The user has messy handwriting. ` +
                    `Transcribe exactly what is written on the lined paper image — including punctuation and line breaks. ` +
                    `Output ONLY the transcribed text with no commentary or preamble.${corrNote}`,
        messages: [{
          role: 'user',
          content: [
            { type:'image', source:{ type:'base64', media_type:'image/png', data:imgData } },
            { type:'text',  text:'Please transcribe the handwriting on this notebook page.' },
          ],
        }],
      });

      // Try Netlify proxy first (production), fall back to direct (local dev)
      let resp;
      try {
        resp = await fetch(API_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body });
        if (!resp.ok) throw new Error('proxy ' + resp.status);
      } catch (proxyErr) {
        console.warn('[Notebook] Proxy failed, trying direct API:', proxyErr.message);
        resp = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'anthropic-version':'2023-06-01' },
          body,
        });
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(()=>'');
        throw new Error(`API error ${resp.status}: ${errText.slice(0,200)}`);
      }

      const data = await resp.json();
      const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
      transText.value = text || '(No handwriting detected)';
      transStatus.textContent = '✓ Done — edit or add corrections below.';
    } catch (err) {
      console.error('[Notebook] Transcription error:', err);
      transStatus.textContent = '✗ ' + (err.message || 'Unknown error');
    } finally {
      transcribeBtn.disabled = false;
      retransBtn.disabled    = false;
    }
  }

  async function canvasToBase64() {
    const dpr = window.devicePixelRatio || 1;
    const bw  = getBaseWidth();
    const bh  = LINE_SPACING * PAGE_ROWS + LINE_SPACING;
    const off = document.createElement('canvas');
    off.width  = bw * dpr;
    off.height = bh * dpr;
    const oc = off.getContext('2d');
    oc.scale(dpr, dpr);

    // Paper
    oc.fillStyle = PAPER_BG; oc.fillRect(0,0,bw,bh);
    oc.strokeStyle = LINE_COLOR; oc.lineWidth = 0.8;
    for (let row=2; row<=PAGE_ROWS; row++) {
      const y = row*LINE_SPACING;
      oc.beginPath(); oc.moveTo(0,y); oc.lineTo(bw,y); oc.stroke();
    }
    oc.strokeStyle = MARGIN_COLOR; oc.lineWidth = 1.5;
    oc.beginPath(); oc.moveTo(MARGIN_LEFT,0); oc.lineTo(MARGIN_LEFT,bh); oc.stroke();

    // Strokes
    strokes.forEach(s => renderStroke(oc, s));

    return new Promise(res => {
      off.toBlob(blob => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      }, 'image/png', 0.92);
    });
  }

  function collectAllCorrections() {
    const all = [];
    Object.values(pages).forEach(pg => {
      (pg.transcription?.corrections||[]).forEach(c => {
        if (c.original && c.corrected) all.push(c);
      });
    });
    return all;
  }

  /* ── Correction UI ────────────────────────────────────────── */
  let corrections = [];

  function buildCorrectionUI(initial=[]) {
    corrections = initial.map(c=>({...c}));
    renderCorrRows();
  }

  function renderCorrRows() {
    corrList.innerHTML = '';
    corrections.forEach((c,i) => {
      const row = document.createElement('div');
      row.className = 'nb-correction-row';
      row.innerHTML = `
        <input placeholder="What it got wrong…" value="${c.original||''}" data-field="original" data-idx="${i}" />
        <span style="color:rgba(255,255,255,0.3);">→</span>
        <input placeholder="What it should say…" value="${c.corrected||''}" data-field="corrected" data-idx="${i}" />
        <button class="nb-corr-del" data-del="${i}">✕</button>`;
      corrList.appendChild(row);
    });
    corrList.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        corrections[parseInt(inp.dataset.idx)][inp.dataset.field] = inp.value;
      });
    });
    corrList.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        corrections.splice(parseInt(btn.dataset.del),1); renderCorrRows();
      });
    });
  }

  addCorrBtn.addEventListener('click', () => {
    corrections.push({original:'',corrected:''});
    renderCorrRows();
    corrList.lastElementChild?.querySelector('input')?.focus();
  });

  saveTransBtn.addEventListener('click', () => {
    if (!activePageId) return;
    pages[activePageId] = pages[activePageId]||{};
    pages[activePageId].transcription = {
      text:        transText.value,
      corrections: corrections.filter(c=>c.original||c.corrected),
      ts:          Date.now(),
    };
    persistMeta();
    transStatus.textContent = '✓ Saved.';
    setTimeout(() => transModal.classList.remove('open'), 700);
  });

  /* ══════════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════════ */
  renderSidebar();

  // Auto-open the most recently updated page
  const lastPage = (meta.pages||[]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
  if (lastPage) loadPage(lastPage.id);
}
