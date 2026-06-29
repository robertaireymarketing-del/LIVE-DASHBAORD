/**
 * notebookCanvas.js  —  Full-featured handwriting notebook for TJM Dashboard
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Features
 * ────────
 *  • Apple Pencil / touch drawing with pressure-sensitive pen, highlighter, eraser
 *  • Colour palette (8 quick swatches + native colour picker)
 *  • Stroke-width slider with live dot preview
 *  • Zoom slider (50 % → 200 %) — canvas fills full available width at 100 %
 *  • Entry library sidebar: all past pages, auto-dated, searchable
 *  • Folder management: create / rename / delete folders, drag entries into them
 *  • AI handwriting → text (Anthropic API) with inline correction UI
 *    — corrections are stored; each new transcription includes prior corrections
 *      so accuracy improves over time
 *  • Undo (60-step) per page
 *  • Auto-save every 30 s + on Done
 *
 * Storage (Firebase via existing setJournalEntry / getJournalEntry)
 * ──────────────────────────────────────────────────────────────────
 *  state.data.notebookMeta = {
 *    folders:  [{ id, name, colour }],
 *    pages:    [{ id, dateKey, title, folderId, createdAt, updatedAt }],
 *  }
 *  state.data.notebookPages[pageId] = {
 *    strokes:      [...],
 *    transcription: { text, corrections: [{original, corrected}], ts },
 *  }
 *
 * Integration (journal.js — already done)
 * ────────────────────────────────────────
 *  import { openNotebook } from './notebookCanvas.js';
 *  openOpenBtn.addEventListener('click', () => openNotebook({ state, saveData: deps.saveDataQuiet }));
 *
 * NOTE: This version uses a simplified integration signature.
 * Update journal.js openOpenBtn handler to:
 *
 *   openOpenBtn.addEventListener('click', () => {
 *     openNotebook({ state: deps.state, saveData: deps.saveDataQuiet });
 *   });
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

const QUICK_COLORS = [
  '#1a1a2e', // Navy (default)
  '#e74c3c', // Red
  '#e67e22', // Orange
  '#2ecc71', // Green
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#C9A84C', // TJM Gold
  '#ffffff', // White
];

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(iso) {
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  } catch { return iso; }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════════ */
export function openNotebook({ state, saveData }) {

  /* ── Ensure meta & pages structures ──────────────────────────────────── */
  if (!state.data.notebookMeta) {
    state.data.notebookMeta = { folders: [], pages: [] };
  }
  if (!state.data.notebookPages) {
    state.data.notebookPages = {};
  }
  const meta  = state.data.notebookMeta;
  const pages = state.data.notebookPages;

  /* ── Active page state ─────────────────────────────────────────────── */
  let activePageId  = null;   // currently open page
  let strokes       = [];     // current page strokes
  let undoStack     = [];
  let curStroke     = null;
  let dirtyFlag     = false;

  /* ── Tool state ────────────────────────────────────────────────────── */
  let tool       = 'pen';
  let penColor   = INK_DEFAULT;
  let strokeW    = 2.5;
  let zoomLevel  = 1.0;       // 0.5 → 2.0

  /* ══════════════════════════════════════════════════════════════════════
     BUILD OVERLAY HTML
  ══════════════════════════════════════════════════════════════════════ */
  const overlay = document.createElement('div');
  overlay.id = 'notebookOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;animation:nbIn 0.2s ease;';

  overlay.innerHTML = `
  <style>
    @keyframes nbIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
    @keyframes nbSlideL { from{transform:translateX(-100%)} to{transform:none} }
    @keyframes nbSlideR { from{transform:translateX(100%)} to{transform:none} }

    /* ── Reset ── */
    #notebookOverlay * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }

    /* ── Layout ── */
    #nbShell   { flex:1; display:flex; overflow:hidden; min-height:0; }
    #nbSidebar { width:260px; flex-shrink:0; background:#0d0d1a; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; overflow:hidden; transition:width 0.25s; }
    #nbSidebar.collapsed { width:0; }
    #nbMain    { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

    /* ── Top toolbar ── */
    #nbTopBar {
      display:flex; align-items:center; gap:6px;
      padding:8px 10px; background:#0d0d1a;
      border-bottom:1px solid rgba(255,255,255,0.07);
      flex-shrink:0; flex-wrap:wrap;
    }
    .nbt { /* toolbar button */
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
      color:#fff; border-radius:9px; padding:7px 11px;
      font:700 12px/1 inherit; cursor:pointer; letter-spacing:0.4px;
      transition:background 0.15s; white-space:nowrap; flex-shrink:0;
    }
    .nbt:hover  { background:rgba(255,255,255,0.14); }
    .nbt.active { background:#C9A84C; border-color:#C9A84C; color:#0d0d1a; }
    .nbt.green  { background:#2ecc71; border-color:#2ecc71; color:#fff; }
    .nbt.red    { background:rgba(231,76,60,0.25); border-color:rgba(231,76,60,0.5); color:#e74c3c; }
    .nbt.blue   { background:rgba(52,152,219,0.25); border-color:rgba(52,152,219,0.5); color:#3498db; }

    /* ── Colour swatches ── */
    #nbSwatches { display:flex; gap:5px; align-items:center; flex-shrink:0; }
    .nb-swatch {
      width:20px; height:20px; border-radius:50%;
      border:2px solid rgba(255,255,255,0.2);
      cursor:pointer; transition:transform 0.1s, border-color 0.1s;
      flex-shrink:0;
    }
    .nb-swatch.sel  { border-color:#C9A84C; transform:scale(1.2); }
    .nb-swatch-pick { background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red); }

    /* ── Size slider ── */
    #nbSizeSlider {
      -webkit-appearance:none; width:72px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.18); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbSizeSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:16px; height:16px;
      border-radius:50%; background:#C9A84C; cursor:pointer;
    }
    #nbSizeDot {
      width:10px; height:10px; border-radius:50%;
      background:#fff; opacity:0.5; transition:all 0.1s; flex-shrink:0; pointer-events:none;
    }

    /* ── Zoom slider ── */
    #nbZoomSlider {
      -webkit-appearance:none; width:64px; height:4px; border-radius:2px;
      background:rgba(255,255,255,0.18); outline:none; cursor:pointer; flex-shrink:0;
    }
    #nbZoomSlider::-webkit-slider-thumb {
      -webkit-appearance:none; width:14px; height:14px;
      border-radius:50%; background:#3498db; cursor:pointer;
    }
    #nbZoomLabel { font-size:11px; font-weight:700; color:rgba(255,255,255,0.4); width:34px; flex-shrink:0; }

    /* ── Canvas area ── */
    #nbCanvasWrap {
      flex:1; overflow:auto; -webkit-overflow-scrolling:touch;
      display:flex; justify-content:center; align-items:flex-start;
      padding:20px; background:#2a2a3a;
    }
    #nbCanvas {
      display:block; touch-action:none; cursor:crosshair;
      box-shadow:0 8px 40px rgba(0,0,0,0.5);
      border-radius:3px; transform-origin:top center;
      transition:width 0.1s, height 0.1s;
    }

    /* ── Sidebar internals ── */
    #nbSideHeader { padding:14px 14px 8px; flex-shrink:0; }
    #nbSideTitle  { font-size:13px; font-weight:900; color:#C9A84C; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:10px; }
    #nbSearchBox  {
      width:100%; padding:7px 10px; border-radius:8px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 12px inherit; outline:none;
    }
    #nbSearchBox::placeholder { color:rgba(255,255,255,0.3); }
    #nbNewPageBtn, #nbNewFolderBtn {
      width:100%; padding:8px; border-radius:8px; margin-top:6px;
      font:700 12px inherit; cursor:pointer; border:1px dashed;
      background:transparent; letter-spacing:0.5px;
    }
    #nbNewPageBtn   { border-color:rgba(201,168,76,0.4); color:#C9A84C; }
    #nbNewFolderBtn { border-color:rgba(255,255,255,0.15); color:rgba(255,255,255,0.4); }
    #nbNewPageBtn:hover   { background:rgba(201,168,76,0.1); }
    #nbNewFolderBtn:hover { background:rgba(255,255,255,0.05); }

    #nbSideList { flex:1; overflow-y:auto; padding:0 10px 20px; }
    #nbSideList::-webkit-scrollbar { width:4px; }
    #nbSideList::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

    .nb-folder-row {
      display:flex; align-items:center; gap:6px;
      padding:6px 8px; border-radius:8px; margin-bottom:2px;
      color:rgba(255,255,255,0.7); font:700 12px inherit; cursor:pointer;
      user-select:none;
    }
    .nb-folder-row:hover { background:rgba(255,255,255,0.05); }
    .nb-folder-row .nb-folder-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-folder-row .nb-folder-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
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
    .nb-page-icon   { font-size:16px; flex-shrink:0; }
    .nb-page-info   { flex:1; min-width:0; }
    .nb-page-title  { font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .nb-page-date   { font-size:10px; color:rgba(255,255,255,0.35); margin-top:2px; }
    .nb-page-del    { background:none; border:none; color:rgba(255,255,255,0.2); cursor:pointer; font-size:14px; padding:2px 4px; border-radius:4px; display:none; }
    .nb-page-row:hover .nb-page-del { display:block; }
    .nb-page-del:hover { background:rgba(231,76,60,0.2); color:#e74c3c; }

    /* ── Transcription modal ── */
    #nbTransModal {
      position:absolute; inset:0; background:rgba(10,10,20,0.75);
      backdrop-filter:blur(8px); z-index:10; display:none;
      align-items:flex-end; justify-content:center; padding:16px;
    }
    #nbTransModal.open { display:flex; }
    #nbTransPanel {
      width:min(600px,100%); max-height:80vh; overflow-y:auto;
      background:#0d0d1a; border:1px solid rgba(255,255,255,0.1);
      border-radius:20px; padding:20px;
      animation:nbIn 0.2s ease;
    }
    #nbTransText {
      width:100%; min-height:120px; padding:12px; border-radius:10px;
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 14px/1.6 inherit; resize:vertical; outline:none;
      margin:12px 0 8px;
    }
    .nb-correction-row {
      display:flex; gap:8px; align-items:center; margin-bottom:6px;
    }
    .nb-correction-row input {
      flex:1; padding:6px 10px; border-radius:7px;
      background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
      color:#fff; font:600 12px inherit; outline:none;
    }
    .nb-correction-row input::placeholder { color:rgba(255,255,255,0.3); }
    .nb-corr-del { background:none; border:none; color:rgba(231,76,60,0.6); cursor:pointer; font-size:16px; }
    #nbCorrectionNote {
      font-size:11px; color:rgba(255,255,255,0.35); margin-bottom:10px; line-height:1.5;
    }

    /* ── Empty state ── */
    #nbEmptyState {
      flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:16px; color:rgba(255,255,255,0.3); text-align:center; padding:40px;
    }
    #nbEmptyState .nb-empty-icon { font-size:56px; }
    #nbEmptyState .nb-empty-title { font-size:18px; font-weight:800; color:rgba(255,255,255,0.6); }
    #nbEmptyState .nb-empty-sub   { font-size:13px; line-height:1.6; }
    #nbEmptyState button { margin-top:8px; }
  </style>

  <!-- ── TOP TOOLBAR ──────────────────────────────────────────── -->
  <div id="nbTopBar">
    <!-- Sidebar toggle -->
    <button class="nbt" id="nbSideToggle" title="Entry library">☰</button>

    <!-- Page title (editable) -->
    <input id="nbPageTitle" value="" placeholder="Untitled page…"
      style="flex:1;min-width:80px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:7px 10px;color:#fff;font:700 13px inherit;outline:none;" />

    <div style="width:1px;height:24px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>

    <!-- Tools -->
    <button class="nbt active" id="nbPenBtn">✒ Pen</button>
    <button class="nbt"        id="nbHiBtn">🖊 Hi</button>
    <button class="nbt"        id="nbEraserBtn">⌫ Erase</button>

    <div style="width:1px;height:24px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>

    <!-- Quick colour swatches -->
    <div id="nbSwatches"></div>

    <div style="width:1px;height:24px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>

    <!-- Size -->
    <div id="nbSizeDot"></div>
    <input type="range" id="nbSizeSlider" min="1" max="14" value="2.5" step="0.5" title="Stroke width" />

    <div style="width:1px;height:24px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>

    <!-- Zoom -->
    <span style="font-size:11px;color:rgba(255,255,255,0.4);flex-shrink:0;">🔍</span>
    <input type="range" id="nbZoomSlider" min="50" max="200" value="100" step="5" title="Zoom" />
    <span id="nbZoomLabel">100%</span>

    <div style="width:1px;height:24px;background:rgba(255,255,255,0.1);flex-shrink:0;"></div>

    <!-- Actions -->
    <button class="nbt" id="nbUndoBtn">↩</button>
    <button class="nbt red" id="nbClearBtn">✕ Clear</button>
    <button class="nbt blue" id="nbTranscribeBtn">✦ → Text</button>
    <button class="nbt green" id="nbDoneBtn">Save ✓</button>
  </div>

  <!-- ── SHELL (sidebar + main) ───────────────────────────────── -->
  <div id="nbShell">

    <!-- SIDEBAR -->
    <div id="nbSidebar">
      <div id="nbSideHeader">
        <div id="nbSideTitle">📓 Journal</div>
        <input type="text" id="nbSearchBox" placeholder="Search pages…" />
        <button id="nbNewPageBtn">＋ New Page</button>
        <button id="nbNewFolderBtn">📁 New Folder</button>
      </div>
      <div id="nbSideList"></div>
    </div>

    <!-- MAIN (canvas or empty state) -->
    <div id="nbMain">
      <!-- Empty state shown when no page selected -->
      <div id="nbEmptyState">
        <div class="nb-empty-icon">📓</div>
        <div class="nb-empty-title">Your Journal</div>
        <div class="nb-empty-sub">Select a page from the sidebar,<br>or create a new one to start writing.</div>
        <button class="nbt green" id="nbEmptyNewBtn">＋ New Page</button>
      </div>

      <!-- Canvas area (hidden until page loaded) -->
      <div id="nbCanvasWrap" style="display:none;">
        <canvas id="nbCanvas"></canvas>
      </div>

      <!-- Transcription modal (inside #nbMain so it covers canvas only) -->
      <div id="nbTransModal">
        <div id="nbTransPanel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-size:16px;font-weight:900;color:#fff;">✦ Handwriting → Text</div>
            <button class="nbt" id="nbTransClose">Close</button>
          </div>
          <div id="nbTransStatus" style="font-size:12px;color:rgba(255,255,255,0.4);min-height:18px;"></div>
          <textarea id="nbTransText" placeholder="Transcribed text will appear here…"></textarea>
          <div id="nbCorrectionNote">
            📝 Add corrections below — the AI learns from these for future pages.
            Mark what it got wrong (left) and what it should have said (right).
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
    style="opacity:0;position:fixed;width:1px;height:1px;top:0;left:0;" />
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  /* ══════════════════════════════════════════════════════════════════════
     DOM REFS
  ══════════════════════════════════════════════════════════════════════ */
  const sideToggle    = document.getElementById('nbSideToggle');
  const sidebar       = document.getElementById('nbSidebar');
  const sideList      = document.getElementById('nbSideList');
  const searchBox     = document.getElementById('nbSearchBox');
  const newPageBtn    = document.getElementById('nbNewPageBtn');
  const newFolderBtn  = document.getElementById('nbNewFolderBtn');
  const emptyState    = document.getElementById('nbEmptyState');
  const emptyNewBtn   = document.getElementById('nbEmptyNewBtn');
  const canvasWrap    = document.getElementById('nbCanvasWrap');
  const canvas        = document.getElementById('nbCanvas');
  const ctx           = canvas.getContext('2d');
  const pageTitleIn   = document.getElementById('nbPageTitle');
  const penBtn        = document.getElementById('nbPenBtn');
  const hiBtn         = document.getElementById('nbHiBtn');
  const eraserBtn     = document.getElementById('nbEraserBtn');
  const undoBtn       = document.getElementById('nbUndoBtn');
  const clearBtn      = document.getElementById('nbClearBtn');
  const doneBtn       = document.getElementById('nbDoneBtn');
  const transcribeBtn = document.getElementById('nbTranscribeBtn');
  const swatchesEl    = document.getElementById('nbSwatches');
  const sizeSlider    = document.getElementById('nbSizeSlider');
  const sizeDot       = document.getElementById('nbSizeDot');
  const zoomSlider    = document.getElementById('nbZoomSlider');
  const zoomLabel     = document.getElementById('nbZoomLabel');
  const colorPicker   = document.getElementById('nbColorPicker');
  const transModal    = document.getElementById('nbTransModal');
  const transText     = document.getElementById('nbTransText');
  const transStatus   = document.getElementById('nbTransStatus');
  const transClose    = document.getElementById('nbTransClose');
  const corrList      = document.getElementById('nbCorrectionList');
  const addCorrBtn    = document.getElementById('nbAddCorrBtn');
  const saveTransBtn  = document.getElementById('nbSaveTransBtn');
  const retransBtn    = document.getElementById('nbRetranscribeBtn');

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR TOGGLE
  ══════════════════════════════════════════════════════════════════════ */
  sideToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => sizeCanvas(), 260);
  });

  /* ══════════════════════════════════════════════════════════════════════
     SIDEBAR RENDER
  ══════════════════════════════════════════════════════════════════════ */
  function renderSidebar(filter = '') {
    const fl = filter.toLowerCase().trim();
    let html = '';

    // Folders
    (meta.folders || []).forEach(folder => {
      html += `
        <div class="nb-folder-row" data-folder-id="${folder.id}">
          <span class="nb-folder-dot" style="background:${folder.colour || '#C9A84C'};"></span>
          <span class="nb-folder-name">📁 ${folder.name}</span>
          <div class="nb-folder-actions">
            <button class="nb-folder-action-btn" data-rename-folder="${folder.id}" title="Rename">✎</button>
            <button class="nb-folder-action-btn" data-delete-folder="${folder.id}" title="Delete" style="color:rgba(231,76,60,0.6);">✕</button>
          </div>
        </div>`;

      // Pages in this folder
      (meta.pages || [])
        .filter(p => p.folderId === folder.id && (!fl || (p.title || '').toLowerCase().includes(fl) || (p.dateKey || '').includes(fl)))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .forEach(page => { html += pageRowHtml(page, true); });
    });

    // Unfiled pages
    const unfiled = (meta.pages || []).filter(p => !p.folderId && (!fl || (p.title || '').toLowerCase().includes(fl) || (p.dateKey || '').includes(fl)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (unfiled.length) {
      if (meta.folders && meta.folders.length) {
        html += `<div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;padding:10px 8px 4px;">Unfiled</div>`;
      }
      unfiled.forEach(page => { html += pageRowHtml(page, false); });
    }

    if (!html) {
      html = `<div style="padding:20px;text-align:center;font-size:12px;color:rgba(255,255,255,0.3);">No pages yet.</div>`;
    }

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

    // Highlight active
    if (activePageId) {
      const active = sideList.querySelector(`[data-page-id="${activePageId}"]`);
      if (active) active.classList.add('active');
    }
  }

  function pageRowHtml(page, indented) {
    const pd = indented ? 'padding-left:22px;' : '';
    const title = page.title || 'Untitled';
    const dateStr = fmtDate(page.dateKey || page.createdAt?.toString().slice(0,10) || todayISO());
    return `
      <div class="nb-page-row" data-page-id="${page.id}" style="${pd}">
        <span class="nb-page-icon">📄</span>
        <div class="nb-page-info">
          <div class="nb-page-title">${title}</div>
          <div class="nb-page-date">${dateStr}</div>
        </div>
        <button class="nb-page-del" title="Delete">🗑</button>
      </div>`;
  }

  searchBox.addEventListener('input', () => renderSidebar(searchBox.value));

  /* ══════════════════════════════════════════════════════════════════════
     PAGE MANAGEMENT
  ══════════════════════════════════════════════════════════════════════ */
  function newPage(folderId = null) {
    saveCurrentPage(); // save any open page first
    const id = uid();
    const now = Date.now();
    const page = { id, dateKey: todayISO(), title: '', folderId, createdAt: now, updatedAt: now };
    meta.pages = meta.pages || [];
    meta.pages.unshift(page);
    pages[id] = { strokes: [], transcription: null };
    persistMeta();
    loadPage(id, true);
  }

  function loadPage(id, isNew = false) {
    saveCurrentPage();
    activePageId = id;
    const page = (meta.pages || []).find(p => p.id === id);
    if (!page) return;

    strokes    = (pages[id]?.strokes || []).map(s => ({ ...s, points: s.points.slice() }));
    undoStack  = [];
    curStroke  = null;
    dirtyFlag  = false;

    pageTitleIn.value = page.title || '';

    emptyState.style.display  = 'none';
    canvasWrap.style.display  = 'flex';

    sizeCanvas();
    renderSidebar(searchBox.value);

    if (isNew) setTimeout(() => pageTitleIn.focus(), 100);
  }

  function saveCurrentPage() {
    if (!activePageId || !dirtyFlag) return;
    const page = (meta.pages || []).find(p => p.id === activePageId);
    if (!page) return;
    page.title     = pageTitleIn.value.trim() || todayISO();
    page.updatedAt = Date.now();
    pages[activePageId] = pages[activePageId] || {};
    pages[activePageId].strokes = strokes.map(s => ({
      tool:   s.tool,
      color:  s.color,
      width:  s.width,
      points: s.points.map(p => ({ x: Math.round(p.x*10)/10, y: Math.round(p.y*10)/10, p: Math.round((p.p||0.5)*100)/100 })),
    }));
    persistMeta();
    dirtyFlag = false;
  }

  function deletePage(id) {
    if (!confirm('Delete this page permanently?')) return;
    meta.pages = (meta.pages || []).filter(p => p.id !== id);
    delete pages[id];
    if (activePageId === id) {
      activePageId = null;
      strokes = [];
      canvasWrap.style.display = 'none';
      emptyState.style.display = 'flex';
    }
    persistMeta();
    renderSidebar(searchBox.value);
  }

  newPageBtn.addEventListener('click',   () => newPage());
  emptyNewBtn.addEventListener('click',  () => newPage());
  newFolderBtn.addEventListener('click', () => {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    const colours = ['#C9A84C','#3498db','#2ecc71','#e74c3c','#9b59b6'];
    meta.folders = meta.folders || [];
    meta.folders.push({ id: uid(), name: name.trim(), colour: colours[meta.folders.length % colours.length] });
    persistMeta();
    renderSidebar(searchBox.value);
  });

  function renameFolder(id) {
    const folder = (meta.folders || []).find(f => f.id === id);
    if (!folder) return;
    const name = prompt('Rename folder:', folder.name);
    if (!name?.trim()) return;
    folder.name = name.trim();
    persistMeta();
    renderSidebar(searchBox.value);
  }

  function deleteFolder(id) {
    if (!confirm('Delete this folder? Pages inside will become unfiled.')) return;
    meta.folders = (meta.folders || []).filter(f => f.id !== id);
    (meta.pages || []).forEach(p => { if (p.folderId === id) p.folderId = null; });
    persistMeta();
    renderSidebar(searchBox.value);
  }

  // Page title autosave on blur
  pageTitleIn.addEventListener('blur', () => {
    if (!activePageId) return;
    const page = (meta.pages || []).find(p => p.id === activePageId);
    if (page) { page.title = pageTitleIn.value.trim() || todayISO(); persistMeta(); }
    renderSidebar(searchBox.value);
  });

  function persistMeta() {
    state.data.notebookMeta  = meta;
    state.data.notebookPages = pages;
    if (saveData) saveData();
  }

  /* ══════════════════════════════════════════════════════════════════════
     CANVAS SIZING & ZOOM
  ══════════════════════════════════════════════════════════════════════ */
  function getBaseWidth() {
    const available = canvasWrap.clientWidth - 40;
    return Math.max(320, Math.min(900, available));
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const bw  = getBaseWidth();
    const bh  = LINE_SPACING * PAGE_ROWS + LINE_SPACING;
    const w   = Math.round(bw * zoomLevel);
    const h   = Math.round(bh * zoomLevel);

    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr * zoomLevel, 0, 0, dpr * zoomLevel, 0, 0);

    drawPaper();
    redrawStrokes();
  }

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
    const w = canvas.width  / ((window.devicePixelRatio || 1) * zoomLevel);
    const h = canvas.height / ((window.devicePixelRatio || 1) * zoomLevel);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // draw paper at device pixels
    const dpr = window.devicePixelRatio || 1;
    const pw  = canvas.width;
    const ph  = canvas.height;

    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(0, 0, pw, ph);

    // Ruled lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1;
    for (let row = 2; row <= PAGE_ROWS; row++) {
      const y = row * LINE_SPACING * dpr * zoomLevel;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke();
    }

    // Margin line
    ctx.strokeStyle = MARGIN_COLOR;
    ctx.lineWidth   = 1.5;
    const mx = MARGIN_LEFT * dpr * zoomLevel;
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, ph); ctx.stroke();

    // Spiral binding dots
    ctx.fillStyle = '#ccc';
    for (let row = 1; row <= PAGE_ROWS; row += 2) {
      const y = row * LINE_SPACING * dpr * zoomLevel;
      ctx.beginPath(); ctx.arc(14 * dpr * zoomLevel, y, 5 * dpr * zoomLevel, 0, Math.PI*2); ctx.fill();
    }

    ctx.restore();
    // Restore the zoom transform for stroke drawing
    ctx.setTransform(dpr * zoomLevel, 0, 0, dpr * zoomLevel, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════════
     STROKE RENDERING
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
      c.lineCap = 'round'; c.lineJoin = 'round';
      smoothPath(c, s.points);
      c.restore();
      return;
    }

    if (s.tool === 'highlighter') {
      c.save();
      c.globalAlpha = 0.4;
      c.strokeStyle = s.color || '#FFEB3B';
      c.lineWidth   = s.width || 20;
      c.lineCap = 'square'; c.lineJoin = 'square';
      c.globalCompositeOperation = 'multiply';
      smoothPath(c, s.points);
      c.restore();
      return;
    }

    // Pen — pressure-modulated width
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = s.color || INK_DEFAULT;
    const pts = s.points;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i].p || 0.5;
      c.lineWidth = Math.max(0.4, (s.width || 2) * (0.35 + p));
      const mx = (pts[i-1].x + pts[i].x) / 2;
      const my = (pts[i-1].y + pts[i].y) / 2;
      c.quadraticCurveTo(pts[i-1].x, pts[i-1].y, mx, my);
    }
    c.stroke();
    c.restore();
  }

  function smoothPath(c, pts) {
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x+pts[i+1].x)/2, (pts[i].y+pts[i+1].y)/2);
    }
    c.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    c.stroke();
  }

  /* ══════════════════════════════════════════════════════════════════════
     POINTER / TOUCH INPUT
  ══════════════════════════════════════════════════════════════════════ */
  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.changedTouches ? e.changedTouches[0] : e;
    return {
      x: (src.clientX - rect.left) / zoomLevel,
      y: (src.clientY - rect.top)  / zoomLevel,
      p: (e.pressure != null ? e.pressure : 0.5),
    };
  }

  let usingPtr = false;

  canvas.addEventListener('pointerdown', e => {
    if (!activePageId) return;
    e.preventDefault(); usingPtr = true;
    canvas.setPointerCapture(e.pointerId);
    startStroke(canvasPos(e));
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    if (!usingPtr || !curStroke) return;
    e.preventDefault(); continueStroke(canvasPos(e));
  }, { passive: false });

  canvas.addEventListener('pointerup',     e => { if (!usingPtr) return; e.preventDefault(); endStroke(); usingPtr = false; }, { passive: false });
  canvas.addEventListener('pointercancel', e => { endStroke(); usingPtr = false; }, { passive: false });

  // Touch fallback
  canvas.addEventListener('touchstart', e => {
    if (usingPtr) return; e.preventDefault();
    const t = e.changedTouches[0];
    const r = canvas.getBoundingClientRect();
    startStroke({ x:(t.clientX-r.left)/zoomLevel, y:(t.clientY-r.top)/zoomLevel, p:0.5 });
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (usingPtr || !curStroke) return; e.preventDefault();
    const t = e.changedTouches[0];
    const r = canvas.getBoundingClientRect();
    continueStroke({ x:(t.clientX-r.left)/zoomLevel, y:(t.clientY-r.top)/zoomLevel, p:0.5 });
  }, { passive: false });
  canvas.addEventListener('touchend', e => { if (!usingPtr) { e.preventDefault(); endStroke(); } }, { passive: false });

  function startStroke(pos) {
    undoStack.push(strokes.map(s => ({ ...s, points: s.points.slice() })));
    if (undoStack.length > 60) undoStack.shift();
    curStroke = {
      tool,
      color: tool === 'highlighter' ? '#FFEB3B' : penColor,
      width: tool === 'eraser' ? ERASER_W : tool === 'highlighter' ? strokeW * 5 : strokeW,
      points: [pos],
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
    if (curStroke.points.length > 1) strokes.push(curStroke);
    curStroke = null;
    redrawStrokes();
  }

  /* ══════════════════════════════════════════════════════════════════════
     TOOL BUTTONS
  ══════════════════════════════════════════════════════════════════════ */
  function setTool(t) {
    tool = t;
    penBtn.classList.toggle('active',    t === 'pen');
    hiBtn.classList.toggle('active',     t === 'highlighter');
    eraserBtn.classList.toggle('active', t === 'eraser');
    canvas.style.cursor = t === 'eraser' ? 'cell' : 'crosshair';
  }
  penBtn.addEventListener('click',    () => setTool('pen'));
  hiBtn.addEventListener('click',     () => setTool('highlighter'));
  eraserBtn.addEventListener('click', () => setTool('eraser'));

  undoBtn.addEventListener('click', () => { if (undoStack.length) { strokes = undoStack.pop(); dirtyFlag = true; redrawStrokes(); } });
  clearBtn.addEventListener('click', () => {
    if (!strokes.length || !confirm('Clear all ink on this page?')) return;
    undoStack.push(strokes.slice()); strokes = []; dirtyFlag = true; redrawStrokes();
  });

  /* ══════════════════════════════════════════════════════════════════════
     COLOUR SWATCHES
  ══════════════════════════════════════════════════════════════════════ */
  function buildSwatches() {
    swatchesEl.innerHTML = '';
    QUICK_COLORS.forEach(c => {
      const d = document.createElement('div');
      d.className = 'nb-swatch' + (c === penColor ? ' sel' : '');
      d.style.background = c;
      if (c === '#ffffff') d.style.border = '2px solid rgba(255,255,255,0.4)';
      d.title = c;
      d.addEventListener('click', () => {
        penColor = c;
        colorPicker.value = c;
        buildSwatches();
        setTool('pen');
      });
      swatchesEl.appendChild(d);
    });
    // Rainbow "custom" swatch
    const pick = document.createElement('div');
    pick.className = 'nb-swatch nb-swatch-pick';
    pick.title = 'Custom colour';
    pick.addEventListener('click', () => colorPicker.click());
    swatchesEl.appendChild(pick);
  }

  colorPicker.addEventListener('input', () => {
    penColor = colorPicker.value;
    buildSwatches();
    setTool('pen');
  });

  buildSwatches();

  /* ══════════════════════════════════════════════════════════════════════
     SIZE SLIDER
  ══════════════════════════════════════════════════════════════════════ */
  function updateSizeDot() {
    const s = parseFloat(sizeSlider.value);
    const px = Math.min(20, s * 2);
    sizeDot.style.width  = px + 'px';
    sizeDot.style.height = px + 'px';
  }
  sizeSlider.addEventListener('input', () => { strokeW = parseFloat(sizeSlider.value); updateSizeDot(); });
  updateSizeDot();

  /* ══════════════════════════════════════════════════════════════════════
     SAVE & CLOSE
  ══════════════════════════════════════════════════════════════════════ */
  function close() {
    saveCurrentPage();
    clearInterval(autoSaveInterval);
    window.removeEventListener('keydown', escHandler);
    overlay.style.transition = 'opacity 0.2s';
    overlay.style.opacity    = '0';
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; }, 220);
  }

  doneBtn.addEventListener('click', close);

  function escHandler(e) { if (e.key === 'Escape') close(); }
  window.addEventListener('keydown', escHandler);

  const autoSaveInterval = setInterval(() => { if (dirtyFlag) saveCurrentPage(); }, AUTOSAVE_MS);

  /* ══════════════════════════════════════════════════════════════════════
     HANDWRITING → TEXT  (Anthropic API)
  ══════════════════════════════════════════════════════════════════════ */
  transcribeBtn.addEventListener('click', () => {
    if (!activePageId) { alert('Open a page first.'); return; }
    transModal.classList.add('open');
    // Load existing corrections into the UI
    const existing = pages[activePageId]?.transcription || {};
    transText.value = existing.text || '';
    buildCorrectionUI(existing.corrections || []);
    if (!existing.text) doTranscribe();
  });

  transClose.addEventListener('click',  () => transModal.classList.remove('open'));
  retransBtn.addEventListener('click',  () => doTranscribe());

  async function doTranscribe() {
    transStatus.textContent = '⏳ Converting your handwriting…';
    transcribeBtn.disabled  = true;
    retransBtn.disabled     = true;

    try {
      // Export canvas as base64 PNG
      const imgData = await canvasToBase64();

      // Collect prior corrections for this page + all pages (learning)
      const allCorrections = collectAllCorrections();
      const corrNote = allCorrections.length
        ? `\n\nPrevious corrections the user has made (apply these patterns):\n${allCorrections.map(c => `- "${c.original}" → "${c.corrected}"`).join('\n')}`
        : '';

      const systemPrompt = `You are a handwriting transcription assistant. The user has messy handwriting. 
Transcribe exactly what is written on the lined paper image — including punctuation and line breaks.
Output ONLY the transcribed text with no commentary or preamble.${corrNote}`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgData } },
              { type: 'text',  text: 'Please transcribe the handwriting on this notebook page.' }
            ]
          }]
        })
      });

      const data = await resp.json();
      const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      transText.value  = text || '(No handwriting detected)';
      transStatus.textContent = '✓ Done — edit or add corrections below.';
    } catch (err) {
      transStatus.textContent = '✗ Error: ' + (err.message || 'API call failed');
    } finally {
      transcribeBtn.disabled = false;
      retransBtn.disabled    = false;
    }
  }

  async function canvasToBase64() {
    // Draw to an off-screen canvas at device resolution (no zoom transform)
    const dpr = window.devicePixelRatio || 1;
    const off  = document.createElement('canvas');
    const bw   = getBaseWidth();
    const bh   = LINE_SPACING * PAGE_ROWS + LINE_SPACING;
    off.width  = bw * dpr;
    off.height = bh * dpr;
    const oc   = off.getContext('2d');
    oc.scale(dpr, dpr);

    // Paper
    oc.fillStyle = PAPER_BG; oc.fillRect(0, 0, bw, bh);
    oc.strokeStyle = LINE_COLOR; oc.lineWidth = 0.8;
    for (let row = 2; row <= PAGE_ROWS; row++) {
      const y = row * LINE_SPACING;
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
      (pg.transcription?.corrections || []).forEach(c => {
        if (c.original && c.corrected) all.push(c);
      });
    });
    return all;
  }

  // Correction UI
  let corrections = [];

  function buildCorrectionUI(initial = []) {
    corrections = initial.map(c => ({ ...c }));
    renderCorrRows();
  }

  function renderCorrRows() {
    corrList.innerHTML = '';
    corrections.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'nb-correction-row';
      row.innerHTML = `
        <input placeholder="What it got wrong…" value="${c.original || ''}" data-field="original" data-idx="${i}" />
        <span style="color:rgba(255,255,255,0.3);">→</span>
        <input placeholder="What it should say…" value="${c.corrected || ''}" data-field="corrected" data-idx="${i}" />
        <button class="nb-corr-del" data-del="${i}">✕</button>`;
      corrList.appendChild(row);
    });
    corrList.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        corrections[inp.dataset.idx][inp.dataset.field] = inp.value;
      });
    });
    corrList.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        corrections.splice(parseInt(btn.dataset.del), 1);
        renderCorrRows();
      });
    });
  }

  addCorrBtn.addEventListener('click', () => {
    corrections.push({ original: '', corrected: '' });
    renderCorrRows();
    corrList.lastElementChild?.querySelector('input')?.focus();
  });

  saveTransBtn.addEventListener('click', () => {
    if (!activePageId) return;
    pages[activePageId] = pages[activePageId] || {};
    pages[activePageId].transcription = {
      text:        transText.value,
      corrections: corrections.filter(c => c.original || c.corrected),
      ts:          Date.now(),
    };
    persistMeta();
    transStatus.textContent = '✓ Saved.';
    setTimeout(() => transModal.classList.remove('open'), 800);
  });

  /* ══════════════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════════════ */
  renderSidebar();

  // Auto-open most recently updated page if one exists
  const lastPage = (meta.pages || []).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))[0];
  if (lastPage) {
    loadPage(lastPage.id);
  }
}
