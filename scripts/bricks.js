// ── 500 BRICKS ─────────────────────────────────────────────────────────────
// 500 days. One brick a day. Lay it or lose it.
// Data model:  state.data.bricks = { startDate: 'YYYY-MM-DD', logs: { 'YYYY-MM-DD': {...} } }
// A brick counts as LAID when that day's log has any activity > 0.

const DEFAULT_START = '2026-07-19'; // Sunday 19 July 2026
const TOTAL_BRICKS  = 500;

const METRICS = ['vinted', 'website', 'ebay', 'recorded', 'posted', 'engaged'];

// ── Data helpers ───────────────────────────────────────────────────────────
function getBricks(state) {
  if (!state.data) return { startDate: DEFAULT_START, logs: {} };
  if (!state.data.bricks) state.data.bricks = { startDate: DEFAULT_START, logs: {} };
  if (!state.data.bricks.startDate) state.data.bricks.startDate = DEFAULT_START;
  if (!state.data.bricks.logs) state.data.bricks.logs = {};
  return state.data.bricks;
}

function emptyLog() {
  return { vinted: 0, website: 0, ebay: 0, recorded: 0, posted: 0, engaged: 0 };
}

function getLog(state, dateKey) {
  const b = getBricks(state);
  return { ...emptyLog(), ...(b.logs[dateKey] || {}) };
}

function logTotal(log) {
  return METRICS.reduce((sum, m) => sum + (Number(log[m]) || 0), 0);
}

function isLaid(state, dateKey) {
  const b = getBricks(state);
  const log = b.logs[dateKey];
  return !!log && logTotal(log) > 0;
}

function dateKeyFor(startDate, index) { // index is 0-based
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + index);
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function dayIndexOf(startDate, dateKey) { // 0-based; negative if before start
  const a = new Date(startDate + 'T12:00:00');
  const b = new Date(dateKey + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

function fmtDate(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Aggregate stats ────────────────────────────────────────────────────────
export function getBrickStats(state) {
  const b = getBricks(state);
  const tk = todayKey();
  const todayIdx = dayIndexOf(b.startDate, tk);        // 0-based
  const started = todayIdx >= 0;
  const brickNo = Math.min(TOTAL_BRICKS, todayIdx + 1); // 1-based, today's brick

  let laid = 0, missed = 0, streak = 0;
  const totals = emptyLog();

  const elapsed = started ? Math.min(todayIdx + 1, TOTAL_BRICKS) : 0;
  for (let i = 0; i < elapsed; i++) {
    const k = dateKeyFor(b.startDate, i);
    if (isLaid(state, k)) {
      laid++;
      const log = getLog(state, k);
      METRICS.forEach(m => { totals[m] += Number(log[m]) || 0; });
    } else if (k !== tk) {
      missed++;
    }
  }

  // streak counts back from today (today only breaks it if it's been missed AND is over)
  let cursor = todayIdx;
  if (started && !isLaid(state, tk)) cursor -= 1; // today not laid yet — don't break the streak
  while (cursor >= 0) {
    if (isLaid(state, dateKeyFor(b.startDate, cursor))) { streak++; cursor--; } else break;
  }

  return {
    startDate: b.startDate, todayIdx, started, brickNo, laid, missed, streak, totals,
    todayLaid: started && isLaid(state, tk),
    remaining: Math.max(0, TOTAL_BRICKS - laid),
    daysToStart: started ? 0 : Math.abs(todayIdx),
    pct: Math.round((laid / TOTAL_BRICKS) * 100),
    listedTotal: totals.vinted + totals.website + totals.ebay,
  };
}

// ── TODAY TAB SECTION ──────────────────────────────────────────────────────
export function renderBricksSection(state) {
  const s = getBrickStats(state);
  const barPct = Math.max(0.6, (s.laid / TOTAL_BRICKS) * 100);

  const statusLine = !s.started
    ? `STARTS IN ${s.daysToStart} DAY${s.daysToStart === 1 ? '' : 'S'}`
    : s.todayLaid ? 'TODAY&rsquo;S BRICK &mdash; LAID' : 'TODAY&rsquo;S BRICK &mdash; NOT LAID';

  return `
<div class="bricks-band" onclick="setTab('bricks')">
  <div class="bricks-band-top">
    <div>
      <div class="bricks-band-kicker">500 BRICKS</div>
      <div class="bricks-band-sub">${s.started ? 'DAY ' + s.brickNo + ' OF 500' : 'BEGINS ' + fmtDateShort(s.startDate).toUpperCase()}</div>
    </div>
    <div class="bricks-band-count">
      <span class="bricks-band-count-num">${String(s.laid).padStart(3, '0')}</span>
      <span class="bricks-band-count-den">/500</span>
    </div>
  </div>

  <div class="bricks-band-bar"><div class="bricks-band-bar-fill" style="width:${barPct}%;"></div></div>

  <div class="bricks-band-bottom">
    <div class="bricks-band-status ${s.started && !s.todayLaid ? 'is-open' : ''}">${statusLine}</div>
    <div class="bricks-band-cta">LAY IT &rarr;</div>
  </div>
</div>`;
}

export const BRICKS_SECTION_CSS = `<style id="bricks-band-css">
.bricks-band {
  background:#000000; border:2px solid #FFFFFF; border-radius:0;
  padding:18px 18px 16px; margin-bottom:16px; cursor:pointer;
  width:100%; box-sizing:border-box; -webkit-tap-highlight-color:transparent;
}
body.light .bricks-band { border-color:#000000; }
.bricks-band:active { transform:scale(0.995); }
.bricks-band-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.bricks-band-kicker { font-size:26px; font-weight:900; letter-spacing:-0.5px; color:#FFFFFF; line-height:1; }
.bricks-band-sub { font-size:10px; font-weight:900; letter-spacing:2.5px; color:#8A8A8A; margin-top:6px; }
.bricks-band-count { display:flex; align-items:baseline; }
.bricks-band-count-num { font-size:34px; font-weight:900; color:#FFFFFF; line-height:1; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.bricks-band-count-den { font-size:13px; font-weight:900; color:#6E6E6E; }
.bricks-band-bar { height:8px; background:#000000; border:1.5px solid #4A4A4A; margin:14px 0 12px; }
.bricks-band-bar-fill { height:100%; background:#FFFFFF; }
.bricks-band-bottom { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.bricks-band-status { font-size:10px; font-weight:900; letter-spacing:1.6px; color:#8A8A8A; }
.bricks-band-status.is-open { color:#FFFFFF; }
.bricks-band-cta { font-size:10px; font-weight:900; letter-spacing:1.6px; color:#000000; background:#FFFFFF; padding:5px 10px; }
</style>`;

// ── FULL PAGE ──────────────────────────────────────────────────────────────
export function renderBricksTab(state) {
  const b = getBricks(state);
  const s = getBrickStats(state);
  const tk = todayKey();

  // Which day are we editing? Defaults to today (or day 1 if not started).
  let viewKey = state.bricksViewDate || (s.started ? tk : b.startDate);
  const viewIdx = dayIndexOf(b.startDate, viewKey);
  const log = getLog(state, viewKey);
  const viewTotal = logTotal(log);
  const isFuture = viewKey > tk;

  const counter = (field, label) => `
  <div class="brx-counter">
    <div class="brx-counter-label">${label}</div>
    <div class="brx-counter-ctrl">
      <button class="brx-step" onclick="brickStep('${field}',-1)" ${isFuture ? 'disabled' : ''}>&minus;</button>
      <div class="brx-counter-val">${log[field] || 0}</div>
      <button class="brx-step" onclick="brickStep('${field}',1)" ${isFuture ? 'disabled' : ''}>+</button>
    </div>
  </div>`;

  // ── Wall ─────────────────────────────────────────────────────────────────
  let wall = '';
  for (let i = 0; i < TOTAL_BRICKS; i++) {
    const k = dateKeyFor(b.startDate, i);
    let cls = 'brx-brick';
    if (isLaid(state, k)) cls += ' is-laid';
    else if (k < tk) cls += ' is-missed';
    else if (k === tk) cls += ' is-today';
    if (k === viewKey) cls += ' is-view';
    wall += `<button class="${cls}" onclick="brickSelect('${k}')" title="Brick ${i + 1} — ${fmtDateShort(k)}"></button>`;
  }

  return `
${BRICKS_PAGE_CSS}
<div class="brx-page">

  <div class="brx-head">
    <button class="brx-back" onclick="setTab('today')">&larr; BACK</button>
    <div class="brx-head-title">500 BRICKS</div>
  </div>

  <div class="brx-hero">
    <div class="brx-hero-num">${String(s.laid).padStart(3, '0')}</div>
    <div class="brx-hero-den">BRICKS LAID OF 500</div>
    <div class="brx-hero-bar"><div class="brx-hero-bar-fill" style="width:${Math.max(0.5, s.pct)}%;"></div></div>
    <div class="brx-hero-meta">${s.started ? 'DAY ' + s.brickNo : 'STARTS IN ' + s.daysToStart + ' DAY' + (s.daysToStart === 1 ? '' : 'S')} &nbsp;&bull;&nbsp; ${s.remaining} TO GO</div>
  </div>

  <div class="brx-stats">
    <div class="brx-stat"><div class="brx-stat-num">${s.streak}</div><div class="brx-stat-lbl">STREAK</div></div>
    <div class="brx-stat"><div class="brx-stat-num">${s.missed}</div><div class="brx-stat-lbl">MISSED</div></div>
    <div class="brx-stat"><div class="brx-stat-num">${s.pct}%</div><div class="brx-stat-lbl">OF WALL</div></div>
  </div>

  <div class="brx-block">
    <div class="brx-block-head">
      <div class="brx-block-title">${viewIdx >= 0 && viewIdx < TOTAL_BRICKS ? 'BRICK ' + String(viewIdx + 1).padStart(3, '0') : 'OUTSIDE THE 500'}</div>
      <div class="brx-block-date">${fmtDate(viewKey)}${viewKey === tk ? ' &middot; TODAY' : ''}</div>
    </div>

    ${isFuture ? `<div class="brx-locked">THIS BRICK IS NOT YOURS YET.</div>` : `
    <div class="brx-group-label">ITEMS LISTED</div>
    <div class="brx-counter-grid">
      ${counter('vinted', 'VINTED')}
      ${counter('website', 'WEBSITE')}
      ${counter('ebay', 'EBAY')}
    </div>

    <div class="brx-group-label">SALES VIDEOS</div>
    <div class="brx-counter-grid">
      ${counter('recorded', 'RECORDED')}
      ${counter('posted', 'POSTED')}
    </div>

    <div class="brx-group-label">OUTREACH</div>
    <div class="brx-counter-grid">
      ${counter('engaged', 'CUSTOMERS ENGAGED')}
    </div>

    <div class="brx-verdict ${viewTotal > 0 ? 'is-laid' : ''}">
      ${viewTotal > 0
        ? `&#9632;&nbsp; BRICK LAID &mdash; ${viewTotal} ACTION${viewTotal === 1 ? '' : 'S'}`
        : `&#9633;&nbsp; NOTHING LOGGED. NO BRICK.`}
    </div>
    ${viewTotal > 0 ? `<button class="brx-clear" onclick="brickClearDay()">Clear this day</button>` : ''}
    `}
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:14px;">THE WALL</div>
    <div class="brx-wall">${wall}</div>
    <div class="brx-legend">
      <span><i class="brx-key is-laid"></i>LAID</span>
      <span><i class="brx-key is-today"></i>TODAY</span>
      <span><i class="brx-key is-missed"></i>MISSED</span>
      <span><i class="brx-key"></i>AHEAD</span>
    </div>
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:14px;">TOTALS TO DATE</div>
    <div class="brx-totals">
      <div class="brx-total"><span>${s.listedTotal}</span>ITEMS LISTED</div>
      <div class="brx-total"><span>${s.totals.vinted}</span>VINTED</div>
      <div class="brx-total"><span>${s.totals.website}</span>WEBSITE</div>
      <div class="brx-total"><span>${s.totals.ebay}</span>EBAY</div>
      <div class="brx-total"><span>${s.totals.recorded}</span>VIDEOS RECORDED</div>
      <div class="brx-total"><span>${s.totals.posted}</span>VIDEOS POSTED</div>
      <div class="brx-total"><span>${s.totals.engaged}</span>CUSTOMERS ENGAGED</div>
    </div>
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:10px;">START DATE</div>
    <div class="brx-start-row">
      <input type="date" class="brx-date-input" value="${b.startDate}" onchange="brickSetStart(this.value)">
      <button class="brx-reset" onclick="brickSetStart('${DEFAULT_START}')">RESET</button>
    </div>
    <div class="brx-start-note">Brick 500 lands ${fmtDate(dateKeyFor(b.startDate, TOTAL_BRICKS - 1))}.</div>
  </div>

</div>`;
}

const BRICKS_PAGE_CSS = `<style id="bricks-page-css">
.brx-page { --ink:#FFFFFF; --paper:#000000; --mute:#8A8A8A; --line:#4A4A4A; padding-bottom:90px; }
body.light .brx-page { --ink:#000000; --paper:#FFFFFF; --mute:#5A5A5A; --line:#BDBDBD; }

.brx-head { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
.brx-back { background:transparent; border:2px solid var(--ink); color:var(--ink); font-family:inherit; font-size:10px; font-weight:900; letter-spacing:1.5px; padding:7px 11px; cursor:pointer; border-radius:0; }
.brx-head-title { font-size:12px; font-weight:900; letter-spacing:3px; color:var(--mute); }

.brx-hero { background:#000000; border:2px solid var(--ink); padding:24px 20px; margin-bottom:12px; }
body.light .brx-hero { border-color:#000000; }
.brx-hero-num { font-size:76px; font-weight:900; color:#FFFFFF; line-height:0.9; letter-spacing:-4px; font-variant-numeric:tabular-nums; }
.brx-hero-den { font-size:10px; font-weight:900; letter-spacing:3px; color:#8A8A8A; margin-top:10px; }
.brx-hero-bar { height:10px; background:#000000; border:1.5px solid #4A4A4A; margin:16px 0 10px; }
.brx-hero-bar-fill { height:100%; background:#FFFFFF; }
.brx-hero-meta { font-size:10px; font-weight:900; letter-spacing:1.8px; color:#8A8A8A; }

.brx-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
.brx-stat { border:2px solid var(--ink); padding:14px 10px; text-align:center; }
.brx-stat-num { font-size:26px; font-weight:900; color:var(--ink); line-height:1; font-variant-numeric:tabular-nums; }
.brx-stat-lbl { font-size:9px; font-weight:900; letter-spacing:1.8px; color:var(--mute); margin-top:7px; }

.brx-block { border:2px solid var(--ink); padding:18px 16px; margin-bottom:12px; }
.brx-block-head { border-bottom:2px solid var(--ink); padding-bottom:12px; margin-bottom:16px; }
.brx-block-title { font-size:15px; font-weight:900; letter-spacing:1.5px; color:var(--ink); }
.brx-block-date { font-size:10px; font-weight:900; letter-spacing:1.5px; color:var(--mute); margin-top:5px; text-transform:uppercase; }

.brx-group-label { font-size:9px; font-weight:900; letter-spacing:2.5px; color:var(--mute); margin:16px 0 8px; }
.brx-group-label:first-of-type { margin-top:0; }
.brx-counter-grid { display:flex; flex-direction:column; gap:8px; }
.brx-counter { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1.5px solid var(--line); padding:9px 9px 9px 13px; }
.brx-counter-label { font-size:11px; font-weight:900; letter-spacing:1.2px; color:var(--ink); }
.brx-counter-ctrl { display:flex; align-items:center; gap:0; flex-shrink:0; }
.brx-step { width:38px; height:38px; background:var(--paper); border:2px solid var(--ink); color:var(--ink); font-family:inherit; font-size:18px; font-weight:900; cursor:pointer; border-radius:0; line-height:1; display:flex; align-items:center; justify-content:center; }
.brx-step:active { background:var(--ink); color:var(--paper); }
.brx-step:disabled { opacity:0.25; cursor:default; }
.brx-counter-val { min-width:46px; text-align:center; font-size:19px; font-weight:900; color:var(--ink); font-variant-numeric:tabular-nums; }

.brx-verdict { margin-top:18px; border:2px solid var(--line); padding:13px; text-align:center; font-size:11px; font-weight:900; letter-spacing:1.5px; color:var(--mute); }
.brx-verdict.is-laid { background:var(--ink); border-color:var(--ink); color:var(--paper); }
.brx-clear { width:100%; margin-top:8px; background:transparent; border:none; color:var(--mute); font-family:inherit; font-size:11px; font-weight:700; padding:8px; cursor:pointer; text-decoration:underline; }
.brx-locked { text-align:center; padding:26px 0; font-size:11px; font-weight:900; letter-spacing:1.5px; color:var(--mute); }

.brx-wall { display:grid; grid-template-columns:repeat(10,1fr); gap:3px; max-height:300px; overflow-y:auto; padding:2px; }
.brx-brick { height:15px; padding:0; border:1.5px solid var(--line); background:transparent; cursor:pointer; border-radius:0; }
.brx-brick.is-laid { background:var(--ink); border-color:var(--ink); }
.brx-brick.is-missed { background:transparent; border-color:var(--line); border-style:dotted; opacity:0.45; }
.brx-brick.is-today { border-color:var(--ink); border-width:2.5px; }
.brx-brick.is-view { outline:2px solid var(--ink); outline-offset:2px; }
.brx-legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; font-size:9px; font-weight:900; letter-spacing:1.2px; color:var(--mute); }
.brx-legend span { display:flex; align-items:center; gap:6px; }
.brx-key { width:14px; height:9px; border:1.5px solid var(--line); display:inline-block; }
.brx-key.is-laid { background:var(--ink); border-color:var(--ink); }
.brx-key.is-today { border-color:var(--ink); border-width:2px; }
.brx-key.is-missed { border-style:dotted; opacity:0.45; }

.brx-totals { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.brx-total { border:1.5px solid var(--line); padding:12px 10px; font-size:9px; font-weight:900; letter-spacing:1.3px; color:var(--mute); }
.brx-total span { display:block; font-size:24px; font-weight:900; color:var(--ink); letter-spacing:-0.5px; margin-bottom:5px; font-variant-numeric:tabular-nums; }
.brx-total:first-child { grid-column:1 / -1; }

.brx-start-row { display:flex; gap:8px; }
.brx-date-input { flex:1; background:var(--paper); border:2px solid var(--ink); color:var(--ink); font-family:inherit; font-size:14px; font-weight:800; padding:11px; border-radius:0; }
.brx-reset { background:var(--paper); border:2px solid var(--ink); color:var(--ink); font-family:inherit; font-size:10px; font-weight:900; letter-spacing:1.2px; padding:11px 14px; cursor:pointer; border-radius:0; }
.brx-start-note { font-size:10px; font-weight:800; color:var(--mute); margin-top:10px; letter-spacing:0.5px; }
</style>`;

// ── ACTIONS ────────────────────────────────────────────────────────────────
export function initBricksActions({ state, saveData, saveDataQuiet, render }) {
  let saveTimer = null;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { saveDataQuiet(); } catch (e) { console.warn('Bricks save failed:', e); } }, 700);
  };

  const currentViewKey = () => {
    const b = getBricks(state);
    return state.bricksViewDate || (dayIndexOf(b.startDate, todayKey()) >= 0 ? todayKey() : b.startDate);
  };

  window.brickStep = (field, delta) => {
    if (!METRICS.includes(field)) return;
    const b = getBricks(state);
    const key = currentViewKey();
    if (key > todayKey()) return;
    const log = { ...emptyLog(), ...(b.logs[key] || {}) };
    log[field] = Math.max(0, (Number(log[field]) || 0) + delta);
    log.updatedAt = Date.now();
    b.logs[key] = log;
    render();
    persist();
  };

  window.brickSelect = (dateKey) => {
    state.bricksViewDate = dateKey;
    render();
    setTimeout(() => {
      const el = document.querySelector('.brx-block-head');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  };

  window.brickClearDay = () => {
    const b = getBricks(state);
    delete b.logs[currentViewKey()];
    render();
    persist();
  };

  window.brickSetStart = (value) => {
    if (!value) return;
    const b = getBricks(state);
    b.startDate = value;
    state.bricksViewDate = null;
    try { saveData(); } catch (e) { console.warn('Bricks start save failed:', e); render(); }
  };
}
