/**
 * notebookCanvas.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Apple Pencil / touch notebook overlay for the Open Journal button.
 *
 * INTEGRATION — in journal.js, replace the openOpenBtn click handler with:
 *
 *   import { openNotebook } from './notebookCanvas.js';
 *
 *   if (openOpenBtn) {
 *     openOpenBtn.addEventListener('click', () => {
 *       openNotebook({
 *         dateKey:        keyFromDate(currentDate),
 *         getEntry:       () => getJournalEntry(keyFromDate(currentDate), 'open'),
 *         saveEntry:      (strokes, textFallback) => {
 *           const now = new Date();
 *           const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
 *           const existing = getJournalEntry(keyFromDate(currentDate), 'open') || {};
 *           setJournalEntry(keyFromDate(currentDate), 'open', {
 *             text:          textFallback || existing.text || '',
 *             strokes:       strokes,
 *             hasContent:    strokes.length > 0 || !!(textFallback || existing.text || '').trim(),
 *             savedAt:       timeStr,
 *             firstSavedAt:  existing.firstSavedAt || timeStr,
 *           });
 *           evaluateOpenCompletion();
 *         },
 *       });
 *     });
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Constants ───────────────────────────────────────────────────────────── */
const LINE_SPACING   = 36;   // px between ruled lines
const MARGIN_LEFT    = 64;   // px — red margin line x-position
const PAPER_BG       = '#fdfcf7';
const LINE_COLOR     = '#c8d8e8';
const MARGIN_COLOR   = '#e8a0a0';
const INK_COLOR      = '#1a1a2e';      // default pen colour (dark navy)
const HIGHLIGHTER_CLR = 'rgba(255,235,59,0.45)';
const ERASER_RADIUS  = 18;

/* ── Entry point ─────────────────────────────────────────────────────────── */
export function openNotebook({ dateKey, getEntry, saveEntry }) {

  // Pull any existing strokes from Firebase entry
  const existing  = getEntry() || {};
  const initStrokes = Array.isArray(existing.strokes) ? existing.strokes : [];

  // Prevent scroll on body while open
  document.body.style.overflow = 'hidden';

  /* ── Build overlay ─────────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'notebookOverlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:99998;',
    'display:flex;flex-direction:column;',
    'background:#f0f0ec;',
    'animation:nbFadeIn 0.22s ease forwards;',
  ].join('');

  overlay.innerHTML = `
    <style>
      @keyframes nbFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      #nbToolbar { display:flex; align-items:center; gap:6px; padding:10px 14px; background:#1a1a2e; flex-shrink:0; }
      #nbTitle   { flex:1; font-size:13px; font-weight:800; color:rgba(255,255,255,0.5); letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .nb-tool-btn {
        background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
        color:#fff; border-radius:10px; padding:8px 12px; font:800 12px/1 -apple-system,sans-serif;
        cursor:pointer; letter-spacing:0.5px; transition:background 0.15s, border-color 0.15s;
        -webkit-tap-highlight-color:transparent; flex-shrink:0;
      }
      .nb-tool-btn.active { background:#C9A84C; border-color:#C9A84C; color:#1a1a2e; }
      .nb-tool-btn:active { opacity:0.75; }
      #nbDoneBtn { background:#2ecc71; border-color:#2ecc71; color:#fff; padding:9px 18px; font-size:13px; }
      #nbClearBtn { background:rgba(231,76,60,0.2); border-color:rgba(231,76,60,0.5); color:#e74c3c; }
      #nbUndoBtn { background:rgba(255,255,255,0.07); }
      #nbCanvasWrap {
        flex:1; overflow:auto; -webkit-overflow-scrolling:touch;
        display:flex; justify-content:center;
        padding:16px 0 24px;
        background:#d0cfc9;
      }
      #nbCanvas {
        display:block; touch-action:none; cursor:crosshair;
        box-shadow:0 4px 24px rgba(0,0,0,0.30);
        border-radius:2px;
      }
      #nbPenSwatch {
        width:22px; height:22px; border-radius:50%;
        border:2px solid rgba(255,255,255,0.4);
        cursor:pointer; flex-shrink:0;
      }
      #nbColorPicker { opacity:0; position:absolute; width:1px; height:1px; }
      #nbSizeDot {
        width:10px; height:10px; border-radius:50%;
        background:#fff; opacity:0.6; flex-shrink:0; pointer-events:none;
      }
      #nbStrokeSizeInput {
        -webkit-appearance:none; height:4px; border-radius:2px;
        background:rgba(255,255,255,0.2); outline:none; cursor:pointer;
        width:70px; flex-shrink:0;
      }
      #nbStrokeSizeInput::-webkit-slider-thumb {
        -webkit-appearance:none; width:16px; height:16px;
        border-radius:50%; background:#C9A84C; cursor:pointer;
      }
      #nbPageLabel {
        font-size:10px; font-weight:700; color:rgba(255,255,255,0.3);
        letter-spacing:1px; flex-shrink:0;
      }
    </style>

    <!-- Toolbar -->
    <div id="nbToolbar">
      <!-- Left: title + page -->
      <div id="nbTitle">📓 OPEN JOURNAL &nbsp;·&nbsp; <span id="nbDateLabel"></span></div>

      <!-- Tools -->
      <button class="nb-tool-btn active" id="nbPenBtn"   title="Pen">✒</button>
      <button class="nb-tool-btn"        id="nbHiBtn"    title="Highlighter">🖊</button>
      <button class="nb-tool-btn"        id="nbEraserBtn" title="Eraser">⌫</button>

      <!-- Colour swatch (pen mode) -->
      <div style="position:relative;">
        <div id="nbPenSwatch" title="Pen colour"></div>
        <input type="color" id="nbColorPicker" value="#1a1a2e" />
      </div>

      <!-- Stroke size -->
      <input type="range" id="nbStrokeSizeInput" min="1" max="12" value="2" step="0.5" title="Stroke size" />

      <!-- Undo / Clear / Page info / Done -->
      <button class="nb-tool-btn" id="nbUndoBtn">↩ Undo</button>
      <button class="nb-tool-btn" id="nbClearBtn">✕ Clear</button>
      <span id="nbPageLabel">Pg <span id="nbPageNum">1</span></span>
      <button class="nb-tool-btn" id="nbDoneBtn">Save ✓</button>
    </div>

    <!-- Canvas scroll area -->
    <div id="nbCanvasWrap">
      <canvas id="nbCanvas"></canvas>
    </div>
  `;

  document.body.appendChild(overlay);

  /* ── DOM refs ──────────────────────────────────────────────────────────── */
  const canvas      = document.getElementById('nbCanvas');
  const ctx         = canvas.getContext('2d');
  const wrap        = document.getElementById('nbCanvasWrap');
  const penBtn      = document.getElementById('nbPenBtn');
  const hiBtn       = document.getElementById('nbHiBtn');
  const eraserBtn   = document.getElementById('nbEraserBtn');
  const undoBtn     = document.getElementById('nbUndoBtn');
  const clearBtn    = document.getElementById('nbClearBtn');
  const doneBtn     = document.getElementById('nbDoneBtn');
  const swatch      = document.getElementById('nbPenSwatch');
  const colorPicker = document.getElementById('nbColorPicker');
  const sizeSlider  = document.getElementById('nbStrokeSizeInput');
  const dateLabel   = document.getElementById('nbDateLabel');

  /* ── Date label ────────────────────────────────────────────────────────── */
  if (dateKey) {
    try {
      const d = new Date(dateKey + 'T12:00:00');
      dateLabel.textContent = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
    } catch { dateLabel.textContent = dateKey; }
  }

  /* ── Canvas sizing — A4-ish portrait, min 100% viewport width on mobile ── */
  function getCanvasWidth() {
    const vw = wrap.clientWidth - 32;
    return Math.max(320, Math.min(794, vw)); // A4 width in px at 96dpi
  }
  const PAGE_ROWS = 40; // lines per page (one tall page = 40 × 36px = 1440px)

  function sizeCanvas() {
    const w = getCanvasWidth();
    const h = LINE_SPACING * PAGE_ROWS + LINE_SPACING; // a little padding bottom
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    drawPaper();
    redrawStrokes();
  }

  /* ── Paper rendering ───────────────────────────────────────────────────── */
  function drawPaper() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // Background
    ctx.fillStyle = PAPER_BG;
    ctx.fillRect(0, 0, w, h);

    // Ruled lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 0.8;
    for (let y = LINE_SPACING * 2; y < h; y += LINE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Red margin
    ctx.strokeStyle = MARGIN_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, 0);
    ctx.lineTo(MARGIN_LEFT, h);
    ctx.stroke();

    // Spiral dots (left binding effect)
    ctx.fillStyle = '#bbb';
    for (let y = LINE_SPACING; y < h; y += LINE_SPACING * 2) {
      ctx.beginPath();
      ctx.arc(12, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Page header line
    ctx.strokeStyle = '#b0c4d8';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, LINE_SPACING + 12);
    ctx.lineTo(w, LINE_SPACING + 12);
    ctx.stroke();
  }

  /* ── Stroke state ──────────────────────────────────────────────────────── */
  let strokes    = initStrokes.slice(); // array of completed stroke objects
  let undoStack  = [];                  // each entry is a full strokes snapshot
  let curStroke  = null;                // { tool, color, width, points: [{x,y,p}] }
  let tool       = 'pen';              // 'pen' | 'highlighter' | 'eraser'
  let penColor   = INK_COLOR;
  let strokeWidth = 2;

  /* ── Redraw all strokes over the paper ────────────────────────────────── */
  function redrawStrokes() {
    drawPaper(); // re-draw paper first (clears canvas)
    for (const s of strokes) {
      renderStroke(ctx, s);
    }
  }

  function renderStroke(c, s) {
    if (!s.points || s.points.length < 2) return;

    if (s.tool === 'eraser') {
      // Eraser: cut a white path through existing ink
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = 'rgba(0,0,0,1)';
      c.lineWidth   = s.width;
      c.lineCap     = 'round';
      c.lineJoin    = 'round';
      _drawSmoothPath(c, s.points);
      c.restore();
      return;
    }

    if (s.tool === 'highlighter') {
      c.save();
      c.globalAlpha = 0.45;
      c.strokeStyle = '#FFEB3B';
      c.lineWidth   = s.width || 18;
      c.lineCap     = 'round';
      c.lineJoin    = 'round';
      c.globalCompositeOperation = 'multiply';
      _drawSmoothPath(c, s.points);
      c.restore();
      return;
    }

    // Pen — pressure-sensitive width via point.p
    c.save();
    c.strokeStyle = s.color || INK_COLOR;
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.globalCompositeOperation = 'source-over';

    const pts = s.points;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], curr = pts[i];
      const p    = curr.p || 0.5;                        // pressure 0‒1
      c.lineWidth = Math.max(0.5, (s.width || 2) * (0.4 + p * 0.9));
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      c.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    c.stroke();
    c.restore();
  }

  function _drawSmoothPath(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i+1].x) / 2;
      const my = (pts[i].y + pts[i+1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
    c.stroke();
  }

  /* ── Pointer helpers ───────────────────────────────────────────────────── */
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / (rect.width  * (window.devicePixelRatio || 1));
    const scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));
    // Use first touch or pointer
    const src = e.changedTouches ? e.changedTouches[0] : e;
    return {
      x: (src.clientX - rect.left),
      y: (src.clientY - rect.top),
      p: e.pressure !== undefined ? e.pressure : 0.5,
    };
  }

  /* ── Pointer events (Apple Pencil prefers pointerdown/move/up) ─────────── */
  canvas.addEventListener('pointerdown', onDown, { passive: false });
  canvas.addEventListener('pointermove', onMove, { passive: false });
  canvas.addEventListener('pointerup',   onUp,   { passive: false });
  canvas.addEventListener('pointercancel', onUp, { passive: false });

  // Also support touch for non-Pencil fallback
  canvas.addEventListener('touchstart',  onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',    onTouchEnd,   { passive: false });

  let usingPointerEvents = false;

  function onDown(e) {
    e.preventDefault();
    usingPointerEvents = true;
    canvas.setPointerCapture(e.pointerId);
    startStroke(getCanvasPos(e));
  }
  function onMove(e) {
    if (!usingPointerEvents) return;
    e.preventDefault();
    if (curStroke) continueStroke(getCanvasPos(e));
  }
  function onUp(e) {
    if (!usingPointerEvents) return;
    e.preventDefault();
    endStroke();
    usingPointerEvents = false;
  }

  function onTouchStart(e) {
    if (usingPointerEvents) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    startStroke({ x: t.clientX - canvas.getBoundingClientRect().left, y: t.clientY - canvas.getBoundingClientRect().top, p: 0.5 });
  }
  function onTouchMove(e) {
    if (usingPointerEvents) return;
    e.preventDefault();
    if (!curStroke) return;
    const t = e.changedTouches[0];
    continueStroke({ x: t.clientX - canvas.getBoundingClientRect().left, y: t.clientY - canvas.getBoundingClientRect().top, p: 0.5 });
  }
  function onTouchEnd(e) {
    if (usingPointerEvents) return;
    e.preventDefault();
    endStroke();
  }

  function startStroke(pos) {
    undoStack.push(strokes.map(s => ({ ...s, points: s.points.slice() })));
    if (undoStack.length > 60) undoStack.shift();
    curStroke = {
      tool,
      color:  tool === 'pen' ? penColor : (tool === 'highlighter' ? HIGHLIGHTER_CLR : '#fff'),
      width:  tool === 'eraser' ? ERASER_RADIUS * 2 : (tool === 'highlighter' ? parseInt(sizeSlider.value) * 4 : parseFloat(sizeSlider.value)),
      points: [pos],
    };
  }

  function continueStroke(pos) {
    if (!curStroke) return;
    curStroke.points.push(pos);

    // Live preview — redraw strokes + current
    redrawStrokes();
    renderStroke(ctx, curStroke);
  }

  function endStroke() {
    if (!curStroke) return;
    if (curStroke.points.length > 1) strokes.push(curStroke);
    curStroke = null;
    redrawStrokes();
  }

  /* ── Toolbar actions ───────────────────────────────────────────────────── */
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

  // Colour picker
  swatch.style.background = penColor;
  swatch.addEventListener('click', () => colorPicker.click());
  colorPicker.addEventListener('input', () => {
    penColor = colorPicker.value;
    swatch.style.background = penColor;
    if (tool !== 'pen') setTool('pen');
  });

  // Size slider dot preview
  const sizeDot = document.getElementById('nbSizeDot');
  sizeSlider.addEventListener('input', () => {
    if (sizeDot) {
      const sz = parseFloat(sizeSlider.value);
      sizeDot.style.width  = Math.min(22, sz * 2.5) + 'px';
      sizeDot.style.height = Math.min(22, sz * 2.5) + 'px';
    }
  });

  // Undo
  undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    strokes = undoStack.pop();
    redrawStrokes();
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    if (strokes.length === 0) return;
    if (!confirm('Clear all ink on this page?')) return;
    undoStack.push(strokes.slice());
    strokes = [];
    redrawStrokes();
  });

  /* ── Save & close ──────────────────────────────────────────────────────── */
  function closeNotebook(save) {
    if (save) {
      // Compact stroke data: drop pressure on pen strokes to save space only for rendering
      const compacted = strokes.map(s => ({
        tool:   s.tool,
        color:  s.color,
        width:  s.width,
        points: s.points.map(p => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, p: Math.round((p.p || 0.5) * 100) / 100 })),
      }));
      saveEntry(compacted, existing.text || '');
    }
    overlay.style.transition = 'opacity 0.2s';
    overlay.style.opacity    = '0';
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, 220);
  }

  doneBtn.addEventListener('click', () => closeNotebook(true));

  // Back button / escape
  document.addEventListener('keydown', escHandler);
  function escHandler(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escHandler);
      closeNotebook(false);
    }
  }

  /* ── Init ──────────────────────────────────────────────────────────────── */
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
}
