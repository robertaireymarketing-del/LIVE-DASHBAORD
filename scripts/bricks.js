// ── 500 BRICKS ─────────────────────────────────────────────────────────────
// 500 days. One brick a day. Lay it or lose it.
// Data model:  state.data.bricks = { startDate: 'YYYY-MM-DD', logs: { 'YYYY-MM-DD': {...} } }
// A brick counts as LAID when that day's log has any activity > 0.
//
// NOTE ON COLOURS: app.css contains `body.light p, body.light span, body.light div
// { color: inherit; }` which has higher specificity than a plain class selector and
// will repaint white text navy. Every colour here is therefore hardcoded + !important.

const DEFAULT_START = '2026-07-19'; // Sunday 19 July 2026
const TOTAL_BRICKS  = 500;
const PER_ROW       = 10;

const METRICS = ['vinted', 'website', 'ebay', 'recorded', 'posted', 'engaged'];

// Daily expected rate — each of these should rise by 1 per day.
const DAILY_RATE = { listed: 1, recorded: 1, posted: 1, engaged: 1 };

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
  const todayIdx = dayIndexOf(b.startDate, tk);         // 0-based
  const started = todayIdx >= 0;
  const brickNo = Math.min(TOTAL_BRICKS, todayIdx + 1); // 1-based, today's brick

  let laid = 0, missed = 0, streak = 0;
  const totals = emptyLog();

  const elapsed = started ? Math.min(todayIdx + 1, TOTAL_BRICKS) : 0; // days counted so far, incl. today
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

  // Streak counts back from today. Today not being laid *yet* doesn't break it.
  let cursor = todayIdx;
  if (started && !isLaid(state, tk)) cursor -= 1;
  while (cursor >= 0) {
    if (isLaid(state, dateKeyFor(b.startDate, cursor))) { streak++; cursor--; } else break;
  }

  return {
    startDate: b.startDate, todayIdx, started, brickNo, laid, missed, streak, totals, elapsed,
    todayLaid: started && isLaid(state, tk),
    remaining: Math.max(0, TOTAL_BRICKS - laid),
    daysToStart: started ? 0 : Math.abs(todayIdx),
    pct: Math.round((laid / TOTAL_BRICKS) * 100),
    listedTotal: totals.vinted + totals.website + totals.ebay,
    expected: {
      listed:   elapsed * DAILY_RATE.listed,
      recorded: elapsed * DAILY_RATE.recorded,
      posted:   elapsed * DAILY_RATE.posted,
      engaged:  elapsed * DAILY_RATE.engaged,
    },
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
  background:#000000 !important; border:2px solid #FFFFFF !important; border-radius:0 !important;
  padding:18px 18px 16px; margin-bottom:16px; cursor:pointer;
  width:100%; box-sizing:border-box; -webkit-tap-highlight-color:transparent;
}
body.light .bricks-band { border-color:#000000 !important; }
.bricks-band:active { transform:scale(0.995); }
.bricks-band-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.bricks-band-kicker, body.light .bricks-band-kicker { font-size:26px !important; font-weight:900 !important; letter-spacing:-0.5px; color:#FFFFFF !important; line-height:1; }
.bricks-band-sub, body.light .bricks-band-sub { font-size:10px !important; font-weight:900 !important; letter-spacing:2.5px; color:#8A8A8A !important; margin-top:6px; }
.bricks-band-count { display:flex; align-items:baseline; }
.bricks-band-count-num, body.light .bricks-band-count-num { font-size:34px !important; font-weight:900 !important; color:#FFFFFF !important; line-height:1; letter-spacing:-1px; font-variant-numeric:tabular-nums; }
.bricks-band-count-den, body.light .bricks-band-count-den { font-size:13px !important; font-weight:900 !important; color:#6E6E6E !important; }
.bricks-band-bar { height:8px; background:#000000 !important; border:1.5px solid #4A4A4A !important; margin:14px 0 12px; }
.bricks-band-bar-fill { height:100%; background:#FFFFFF !important; }
.bricks-band-bottom { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.bricks-band-status, body.light .bricks-band-status { font-size:10px !important; font-weight:900 !important; letter-spacing:1.6px; color:#8A8A8A !important; }
.bricks-band-status.is-open, body.light .bricks-band-status.is-open { color:#FFFFFF !important; }
.bricks-band-cta, body.light .bricks-band-cta { font-size:10px !important; font-weight:900 !important; letter-spacing:1.6px; color:#000000 !important; background:#FFFFFF !important; padding:5px 10px; }
</style>`;

// ── FULL PAGE ──────────────────────────────────────────────────────────────
export function renderBricksTab(state) {
  const b = getBricks(state);
  const s = getBrickStats(state);
  const tk = todayKey();
  const light = state.theme === 'light';

  // Which day are we editing? Defaults to today (or day 1 if not started).
  const viewKey = state.bricksViewDate || (s.started ? tk : b.startDate);
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

  // ── Wall — built from the ground up. Row 0 (bricks 1-10) sits at the bottom.
  // The container is column-reverse, so DOM order ascending = visual bottom-up,
  // and the default scroll position lands on the foundation.
  const rowCount = Math.ceil(TOTAL_BRICKS / PER_ROW);
  let wall = '';
  for (let r = 0; r < rowCount; r++) {
    let row = '';
    for (let c = 0; c < PER_ROW; c++) {
      const i = r * PER_ROW + c;
      if (i >= TOTAL_BRICKS) break;
      const k = dateKeyFor(b.startDate, i);
      let cls = 'brx-brick';
      if (isLaid(state, k)) cls += ' is-laid';
      else if (k < tk) cls += ' is-missed';
      else if (k === tk) cls += ' is-today';
      if (k === viewKey) cls += ' is-view';
      row += `<button class="${cls}" onclick="brickSelect('${k}')" title="Brick ${i + 1} &mdash; ${fmtDateShort(k)}">${i + 1}</button>`;
    }
    wall += `<div class="brx-row">${row}</div>`;
  }

  // ── Totals vs expected ───────────────────────────────────────────────────
  const totalBox = (val, label, exp) => {
    const diff = val - exp;
    const fill = exp > 0 ? Math.min(100, Math.round((val / exp) * 100)) : (val > 0 ? 100 : 0);
    const chip = diff < 0
      ? `<span class="brx-chip is-behind">&minus;${Math.abs(diff)} BEHIND</span>`
      : `<span class="brx-chip">${diff > 0 ? '+' + diff + ' AHEAD' : 'ON PACE'}</span>`;
    return `
    <div class="brx-total ${diff < 0 ? 'is-behind' : ''}">
      <div class="brx-total-num">${val}</div>
      <div class="brx-total-lbl">${label}</div>
      <div class="brx-total-bar"><div class="brx-total-bar-fill" style="width:${fill}%;"></div></div>
      <div class="brx-total-foot"><span class="brx-total-exp">${exp} EXPECTED</span>${chip}</div>
    </div>`;
  };

  const plainBox = (val, label) => `
    <div class="brx-mini"><div class="brx-mini-num">${val}</div><div class="brx-mini-lbl">${label}</div></div>`;

  return `
${BRICKS_PAGE_CSS}
<div class="brx-page ${light ? 'is-light' : ''}">

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
    <div class="brx-block-title" style="margin-bottom:6px;">THE WALL</div>
    <div class="brx-block-date" style="margin-bottom:14px;">GROUND UP &mdash; BRICK 001 BOTTOM LEFT</div>
    <div class="brx-wall">${wall}</div>
    <div class="brx-legend">
      <span><i class="brx-key is-laid"></i>LAID</span>
      <span><i class="brx-key is-today"></i>TODAY</span>
      <span><i class="brx-key is-missed"></i>MISSED</span>
      <span><i class="brx-key"></i>AHEAD</span>
    </div>
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:6px;">TOTALS TO DATE</div>
    <div class="brx-block-date" style="margin-bottom:14px;">EXPECTED &mdash; 1 PER DAY, ${s.elapsed} DAY${s.elapsed === 1 ? '' : 'S'} ELAPSED</div>
    <div class="brx-totals">
      ${totalBox(s.listedTotal, 'ITEMS LISTED', s.expected.listed)}
      ${totalBox(s.totals.recorded, 'VIDEOS RECORDED', s.expected.recorded)}
      ${totalBox(s.totals.posted, 'VIDEOS POSTED', s.expected.posted)}
      ${totalBox(s.totals.engaged, 'CUSTOMERS ENGAGED', s.expected.engaged)}
    </div>
    <div class="brx-group-label" style="margin-top:18px;">LISTINGS BY PLATFORM</div>
    <div class="brx-minis">
      ${plainBox(s.totals.vinted, 'VINTED')}
      ${plainBox(s.totals.website, 'WEBSITE')}
      ${plainBox(s.totals.ebay, 'EBAY')}
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
/* Every colour hardcoded + !important — app.css light-mode rules
   (body.light div/span/p { color: inherit }) outrank plain class selectors. */
.brx-page { padding-bottom:90px; }

.brx-head { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
.brx-back { background:transparent !important; border:2px solid #FFFFFF !important; color:#FFFFFF !important; font-family:inherit; font-size:10px !important; font-weight:900 !important; letter-spacing:1.5px; padding:7px 11px; cursor:pointer; border-radius:0 !important; }
.brx-page.is-light .brx-back { border-color:#000000 !important; color:#000000 !important; }
.brx-head-title { font-size:12px !important; font-weight:900 !important; letter-spacing:3px; color:#8A8A8A !important; }
.brx-page.is-light .brx-head-title { color:#5A5A5A !important; }

/* Hero — always black block, always white type, both themes */
.brx-hero { background:#000000 !important; border:2px solid #FFFFFF !important; padding:24px 20px; margin-bottom:12px; }
.brx-page.is-light .brx-hero { border-color:#000000 !important; }
.brx-hero-num { font-size:76px !important; font-weight:900 !important; color:#FFFFFF !important; line-height:0.9; letter-spacing:-4px; font-variant-numeric:tabular-nums; }
.brx-hero-den { font-size:10px !important; font-weight:900 !important; letter-spacing:3px; color:#8A8A8A !important; margin-top:10px; }
.brx-hero-bar { height:10px; background:#000000 !important; border:1.5px solid #4A4A4A !important; margin:16px 0 10px; }
.brx-hero-bar-fill { height:100%; background:#FFFFFF !important; }
.brx-hero-meta { font-size:10px !important; font-weight:900 !important; letter-spacing:1.8px; color:#8A8A8A !important; }

.brx-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
.brx-stat { border:2px solid #FFFFFF !important; padding:14px 10px; text-align:center; }
.brx-stat-num { font-size:26px !important; font-weight:900 !important; color:#FFFFFF !important; line-height:1; font-variant-numeric:tabular-nums; }
.brx-stat-lbl { font-size:9px !important; font-weight:900 !important; letter-spacing:1.8px; color:#8A8A8A !important; margin-top:7px; }
.brx-page.is-light .brx-stat { border-color:#000000 !important; }
.brx-page.is-light .brx-stat-num { color:#000000 !important; }
.brx-page.is-light .brx-stat-lbl { color:#5A5A5A !important; }

.brx-block { border:2px solid #FFFFFF !important; padding:18px 16px; margin-bottom:12px; }
.brx-block-head { border-bottom:2px solid #FFFFFF !important; padding-bottom:12px; margin-bottom:16px; }
.brx-block-title { font-size:15px !important; font-weight:900 !important; letter-spacing:1.5px; color:#FFFFFF !important; }
.brx-block-date { font-size:10px !important; font-weight:900 !important; letter-spacing:1.5px; color:#8A8A8A !important; margin-top:5px; text-transform:uppercase; }
.brx-page.is-light .brx-block { border-color:#000000 !important; }
.brx-page.is-light .brx-block-head { border-bottom-color:#000000 !important; }
.brx-page.is-light .brx-block-title { color:#000000 !important; }
.brx-page.is-light .brx-block-date { color:#5A5A5A !important; }

.brx-group-label { font-size:9px !important; font-weight:900 !important; letter-spacing:2.5px; color:#8A8A8A !important; margin:16px 0 8px; }
.brx-page.is-light .brx-group-label { color:#5A5A5A !important; }
.brx-counter-grid { display:flex; flex-direction:column; gap:8px; }
.brx-counter { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1.5px solid #4A4A4A !important; padding:9px 9px 9px 13px; }
.brx-page.is-light .brx-counter { border-color:#BDBDBD !important; }
.brx-counter-label { font-size:11px !important; font-weight:900 !important; letter-spacing:1.2px; color:#FFFFFF !important; }
.brx-page.is-light .brx-counter-label { color:#000000 !important; }
.brx-counter-ctrl { display:flex; align-items:center; gap:0; flex-shrink:0; }
.brx-step { width:38px; height:38px; background:#000000 !important; border:2px solid #FFFFFF !important; color:#FFFFFF !important; font-family:inherit; font-size:18px !important; font-weight:900 !important; cursor:pointer; border-radius:0 !important; line-height:1; display:flex; align-items:center; justify-content:center; }
.brx-step:active { background:#FFFFFF !important; color:#000000 !important; }
.brx-step:disabled { opacity:0.25; cursor:default; }
.brx-page.is-light .brx-step { background:#FFFFFF !important; border-color:#000000 !important; color:#000000 !important; }
.brx-page.is-light .brx-step:active { background:#000000 !important; color:#FFFFFF !important; }
.brx-counter-val { min-width:46px; text-align:center; font-size:19px !important; font-weight:900 !important; color:#FFFFFF !important; font-variant-numeric:tabular-nums; }
.brx-page.is-light .brx-counter-val { color:#000000 !important; }

.brx-verdict { margin-top:18px; border:2px solid #4A4A4A !important; padding:13px; text-align:center; font-size:11px !important; font-weight:900 !important; letter-spacing:1.5px; color:#8A8A8A !important; }
.brx-verdict.is-laid { background:#FFFFFF !important; border-color:#FFFFFF !important; color:#000000 !important; }
.brx-page.is-light .brx-verdict { border-color:#BDBDBD !important; color:#5A5A5A !important; }
.brx-page.is-light .brx-verdict.is-laid { background:#000000 !important; border-color:#000000 !important; color:#FFFFFF !important; }
.brx-clear { width:100%; margin-top:8px; background:transparent !important; border:none; color:#8A8A8A !important; font-family:inherit; font-size:11px !important; font-weight:700 !important; padding:8px; cursor:pointer; text-decoration:underline; }
.brx-page.is-light .brx-clear { color:#5A5A5A !important; }
.brx-locked { text-align:center; padding:26px 0; font-size:11px !important; font-weight:900 !important; letter-spacing:1.5px; color:#8A8A8A !important; }
.brx-page.is-light .brx-locked { color:#5A5A5A !important; }

/* ── The Wall — column-reverse means DOM order ascending renders bottom-up,
      and the default scroll position sits on the foundation. ── */
.brx-wall { display:flex; flex-direction:column-reverse; gap:3px; max-height:340px; overflow-y:auto; padding:2px; }
.brx-row { display:grid; grid-template-columns:repeat(10,1fr); gap:3px; flex-shrink:0; }
.brx-brick {
  height:19px; padding:0; border:1.5px solid #4A4A4A !important; background:transparent !important;
  color:#6E6E6E !important; font-family:inherit; font-size:8px !important; font-weight:900 !important;
  cursor:pointer; border-radius:0 !important; font-variant-numeric:tabular-nums;
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.brx-brick.is-laid { background:#FFFFFF !important; border-color:#FFFFFF !important; color:#000000 !important; }
.brx-brick.is-missed { background:transparent !important; border-color:#3A3A3A !important; border-style:dotted !important; color:#3A3A3A !important; }
.brx-brick.is-today { border-color:#FFFFFF !important; border-width:2.5px !important; color:#FFFFFF !important; }
.brx-brick.is-view { outline:2px solid #FFFFFF !important; outline-offset:2px; }
.brx-page.is-light .brx-brick { border-color:#BDBDBD !important; color:#9A9A9A !important; }
.brx-page.is-light .brx-brick.is-laid { background:#000000 !important; border-color:#000000 !important; color:#FFFFFF !important; }
.brx-page.is-light .brx-brick.is-missed { border-color:#D5D5D5 !important; color:#C5C5C5 !important; }
.brx-page.is-light .brx-brick.is-today { border-color:#000000 !important; color:#000000 !important; }
.brx-page.is-light .brx-brick.is-view { outline-color:#000000 !important; }

.brx-legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; font-size:9px !important; font-weight:900 !important; letter-spacing:1.2px; color:#8A8A8A !important; }
.brx-legend span { display:flex; align-items:center; gap:6px; color:#8A8A8A !important; }
.brx-key { width:14px; height:9px; border:1.5px solid #4A4A4A !important; display:inline-block; }
.brx-key.is-laid { background:#FFFFFF !important; border-color:#FFFFFF !important; }
.brx-key.is-today { border-color:#FFFFFF !important; border-width:2px !important; }
.brx-key.is-missed { border-style:dotted !important; border-color:#3A3A3A !important; }
.brx-page.is-light .brx-legend, .brx-page.is-light .brx-legend span { color:#5A5A5A !important; }
.brx-page.is-light .brx-key { border-color:#BDBDBD !important; }
.brx-page.is-light .brx-key.is-laid { background:#000000 !important; border-color:#000000 !important; }
.brx-page.is-light .brx-key.is-today { border-color:#000000 !important; }
.brx-page.is-light .brx-key.is-missed { border-color:#D5D5D5 !important; }

/* ── Totals vs expected ── */
.brx-totals { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.brx-total { border:1.5px solid #4A4A4A !important; padding:12px 10px; }
.brx-total.is-behind { border-color:#FFFFFF !important; border-width:2px !important; }
.brx-total-num { font-size:26px !important; font-weight:900 !important; color:#FFFFFF !important; letter-spacing:-0.5px; line-height:1; font-variant-numeric:tabular-nums; }
.brx-total-lbl { font-size:9px !important; font-weight:900 !important; letter-spacing:1.3px; color:#8A8A8A !important; margin-top:6px; }
.brx-total-bar { height:5px; background:transparent !important; border:1px solid #4A4A4A !important; margin:9px 0 7px; }
.brx-total-bar-fill { height:100%; background:#FFFFFF !important; }
.brx-total-foot { display:flex; flex-direction:column; gap:5px; align-items:flex-start; }
.brx-total-exp { font-size:8px !important; font-weight:900 !important; letter-spacing:1px; color:#6E6E6E !important; }
.brx-chip { font-size:8px !important; font-weight:900 !important; letter-spacing:1px; color:#FFFFFF !important; border:1.5px solid #FFFFFF !important; padding:3px 6px; }
.brx-chip.is-behind { background:#FFFFFF !important; color:#000000 !important; border-color:#FFFFFF !important; }
.brx-page.is-light .brx-total { border-color:#BDBDBD !important; }
.brx-page.is-light .brx-total.is-behind { border-color:#000000 !important; }
.brx-page.is-light .brx-total-num { color:#000000 !important; }
.brx-page.is-light .brx-total-lbl { color:#5A5A5A !important; }
.brx-page.is-light .brx-total-bar { border-color:#BDBDBD !important; }
.brx-page.is-light .brx-total-bar-fill { background:#000000 !important; }
.brx-page.is-light .brx-total-exp { color:#7A7A7A !important; }
.brx-page.is-light .brx-chip { color:#000000 !important; border-color:#000000 !important; }
.brx-page.is-light .brx-chip.is-behind { background:#000000 !important; color:#FFFFFF !important; }

.brx-minis { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.brx-mini { border:1.5px solid #4A4A4A !important; padding:11px 8px; text-align:center; }
.brx-mini-num { font-size:20px !important; font-weight:900 !important; color:#FFFFFF !important; line-height:1; font-variant-numeric:tabular-nums; }
.brx-mini-lbl { font-size:8px !important; font-weight:900 !important; letter-spacing:1.2px; color:#8A8A8A !important; margin-top:5px; }
.brx-page.is-light .brx-mini { border-color:#BDBDBD !important; }
.brx-page.is-light .brx-mini-num { color:#000000 !important; }
.brx-page.is-light .brx-mini-lbl { color:#5A5A5A !important; }

.brx-start-row { display:flex; gap:8px; }
.brx-date-input { flex:1; background:#000000 !important; border:2px solid #FFFFFF !important; color:#FFFFFF !important; font-family:inherit; font-size:14px !important; font-weight:800 !important; padding:11px; border-radius:0 !important; }
.brx-reset { background:#000000 !important; border:2px solid #FFFFFF !important; color:#FFFFFF !important; font-family:inherit; font-size:10px !important; font-weight:900 !important; letter-spacing:1.2px; padding:11px 14px; cursor:pointer; border-radius:0 !important; }
.brx-start-note { font-size:10px !important; font-weight:800 !important; color:#8A8A8A !important; margin-top:10px; letter-spacing:0.5px; }
.brx-page.is-light .brx-date-input { background:#FFFFFF !important; border-color:#000000 !important; color:#000000 !important; }
.brx-page.is-light .brx-reset { background:#FFFFFF !important; border-color:#000000 !important; color:#000000 !important; }
.brx-page.is-light .brx-start-note { color:#5A5A5A !important; }
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
