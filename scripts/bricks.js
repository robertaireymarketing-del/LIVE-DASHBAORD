// ── 500 BRICKS ─────────────────────────────────────────────────────────────
// 500 days. One brick a day. Lay it or lose it.
// Data model:  state.data.bricks = { startDate: 'YYYY-MM-DD', logs: { 'YYYY-MM-DD': {...} } }
//
// A brick counts as LAID when that day scores >= 2 POINTS.
// Points = the core needle-movers only: items listed (vinted+website+ebay)
//          + videos recorded + videos posted + customers engaged.
// BONUS (emails sent, live minutes) is tracked + totalled but does NOT score points.
//
// NOTE ON COLOURS: app.css contains `body.light p, body.light span, body.light div
// { color: inherit; }` which has higher specificity than a plain class selector and
// will repaint white text navy. Every colour here is therefore hardcoded + !important.

const DEFAULT_START = '2026-07-19'; // Sunday 19 July 2026
const TOTAL_BRICKS  = 500;
const PER_ROW       = 10;
const POINTS_PER_DAY = 2;           // minimum points to lay a brick
const GOLD = '#C9A84C';

// Point-scoring metrics (the core tasks).
const METRICS = ['vinted', 'website', 'ebay', 'recorded', 'posted', 'engaged'];
// Bonus metrics — tracked + totalled, but never counted toward the daily 2 points.
const BONUS   = ['emails', 'live'];
const ALL_FIELDS = [...METRICS, ...BONUS];

// Daily expected rate — the two accountability targets that rise by 1 per day.
const DAILY_RATE = { listed: 1, posted: 1 };

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ── Data helpers ───────────────────────────────────────────────────────────
function getBricks(state) {
  if (!state.data) return { startDate: DEFAULT_START, logs: {} };
  if (!state.data.bricks) state.data.bricks = { startDate: DEFAULT_START, logs: {} };
  if (!state.data.bricks.startDate) state.data.bricks.startDate = DEFAULT_START;
  if (!state.data.bricks.logs) state.data.bricks.logs = {};
  return state.data.bricks;
}

function emptyLog() {
  return { vinted: 0, website: 0, ebay: 0, recorded: 0, posted: 0, engaged: 0, emails: 0, live: 0 };
}

function getLog(state, dateKey) {
  const b = getBricks(state);
  return { ...emptyLog(), ...(b.logs[dateKey] || {}) };
}

// Points = core metrics only. Bonus fields are excluded on purpose.
function pointsTotal(log) {
  return METRICS.reduce((sum, m) => sum + (Number(log[m]) || 0), 0);
}

function isLaid(state, dateKey) {
  const b = getBricks(state);
  const log = b.logs[dateKey];
  return !!log && pointsTotal(log) >= POINTS_PER_DAY;
}

function pad2(n) { return String(n).padStart(2, '0'); }

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

// Monday-start week bounds for a date. Returns { mon, sun } as YYYY-MM-DD.
function weekBounds(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const f = x => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  return { mon: f(mon), sun: f(sun) };
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

  // Accumulate EVERY day's log (not just laid days) — a day with 1 point still
  // contributes to the running totals and to the deficit you must make up.
  for (let i = 0; i < elapsed; i++) {
    const k = dateKeyFor(b.startDate, i);
    const log = getLog(state, k);
    ALL_FIELDS.forEach(m => { totals[m] += Number(log[m]) || 0; });
    if (isLaid(state, k)) laid++;
    else if (k !== tk) missed++;
  }

  // Streak counts back from today. Today not being laid *yet* doesn't break it.
  let cursor = todayIdx;
  if (started && !isLaid(state, tk)) cursor -= 1;
  while (cursor >= 0) {
    if (isLaid(state, dateKeyFor(b.startDate, cursor))) { streak++; cursor--; } else break;
  }

  const listedTotal = totals.vinted + totals.website + totals.ebay;
  // Total points = every core metric summed. Guaranteed to match the parts.
  const totalPoints = listedTotal + totals.recorded + totals.posted + totals.engaged;

  return {
    startDate: b.startDate, todayIdx, started, brickNo, laid, missed, streak, totals, elapsed,
    todayLaid: started && isLaid(state, tk),
    remaining: Math.max(0, TOTAL_BRICKS - laid),
    daysToStart: started ? 0 : Math.abs(todayIdx),
    pct: Math.round((laid / TOTAL_BRICKS) * 100),
    listedTotal,
    totalPoints,
    expected: {
      points: elapsed * POINTS_PER_DAY,
      listed: elapsed * DAILY_RATE.listed,
      posted: elapsed * DAILY_RATE.posted,
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
  const viewPoints = pointsTotal(log);
  const isFuture = viewKey > tk;

  const counter = (field, label, step = 1) => `
  <div class="brx-counter">
    <div class="brx-counter-label">${label}</div>
    <div class="brx-counter-ctrl">
      <button class="brx-step" onclick="brickStep('${field}',${-step})" ${isFuture ? 'disabled' : ''}>&minus;</button>
      <div class="brx-counter-val">${log[field] || 0}</div>
      <button class="brx-step" onclick="brickStep('${field}',${step})" ${isFuture ? 'disabled' : ''}>+</button>
    </div>
  </div>`;

  // ── The Wall — a calendar. Earliest month at top, each row is a Monday→Sunday
  // week, each calendar month is its own outlined block. Gold = a day you still
  // owe from a week that has already closed.
  const startD = new Date(b.startDate + 'T12:00:00');
  const lastD  = new Date(dateKeyFor(b.startDate, TOTAL_BRICKS - 1) + 'T12:00:00');
  let mCur = new Date(startD.getFullYear(), startD.getMonth(), 1, 12);
  const mEnd = new Date(lastD.getFullYear(), lastD.getMonth(), 1, 12);

  let wall = '';
  while (mCur <= mEnd) {
    const y = mCur.getFullYear(), m = mCur.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const firstDow = (new Date(y, m, 1, 12).getDay() + 6) % 7; // Mon=0
    let cells = '';
    let monthReal = 0, monthLaid = 0;

    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell is-empty"></div>`;

    for (let day = 1; day <= dim; day++) {
      const dk = `${y}-${pad2(m + 1)}-${pad2(day)}`;
      const idx = dayIndexOf(b.startDate, dk);
      if (idx < 0 || idx >= TOTAL_BRICKS) { cells += `<div class="cal-cell is-empty"></div>`; continue; }
      monthReal++;
      const laid = isLaid(state, dk);
      if (laid) monthLaid++;
      const wb = weekBounds(dk);
      const weekPast = wb.sun < tk;
      const weekNow  = wb.mon <= tk && tk <= wb.sun;

      let cls = 'cal-cell';
      if (laid) cls += ' is-laid';
      else if (dk < tk) cls += ' is-missed';
      else if (dk === tk) cls += ' is-today';
      if (weekPast) cls += ' is-weekpast';
      else if (weekNow) cls += ' is-weeknow';
      if (dk === viewKey) cls += ' is-view';

      cells += `<button class="${cls}" onclick="brickSelect('${dk}')" title="Brick ${idx + 1} &mdash; ${fmtDateShort(dk)}">${idx + 1}</button>`;
    }

    const totalCells = firstDow + dim;
    const trail = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trail; i++) cells += `<div class="cal-cell is-empty"></div>`;

    wall += `
      <div class="cal-month">
        <div class="cal-month-head"><span>${MONTHS_SHORT[m]} ${y}</span><span class="cal-month-count">${monthLaid}/${monthReal}</span></div>
        <div class="cal-dow"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        <div class="cal-grid">${cells}</div>
      </div>`;

    mCur.setMonth(mCur.getMonth() + 1);
  }

  // ── Totals vs expected ───────────────────────────────────────────────────
  const totalBox = (val, label, exp, hero = false) => {
    const diff = val - exp;
    const fill = exp > 0 ? Math.min(100, Math.round((val / exp) * 100)) : (val > 0 ? 100 : 0);
    let chip;
    if (diff < 0) {
      chip = `<span class="brx-chip is-behind">${hero ? 'MAKE UP ' + Math.abs(diff) : '&minus;' + Math.abs(diff) + ' BEHIND'}</span>`;
    } else {
      chip = `<span class="brx-chip">${diff > 0 ? '+' + diff + ' AHEAD' : 'ON PACE'}</span>`;
    }
    return `
    <div class="brx-total ${hero ? 'is-hero' : ''} ${diff < 0 ? 'is-behind' : ''}">
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
    <div class="brx-group-label">ITEMS LISTED &mdash; PICK PLATFORM</div>
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

    <div class="brx-group-label">BONUS &mdash; DOESN&rsquo;T SCORE POINTS</div>
    <div class="brx-counter-grid">
      ${counter('emails', 'SALES EMAILS')}
      ${counter('live', 'LIVE MINUTES', 5)}
    </div>

    <div class="brx-verdict ${viewPoints >= POINTS_PER_DAY ? 'is-laid' : ''}">
      ${viewPoints >= POINTS_PER_DAY
        ? `&#9632;&nbsp; BRICK LAID &mdash; ${viewPoints} POINT${viewPoints === 1 ? '' : 'S'}`
        : `&#9633;&nbsp; ${viewPoints}/${POINTS_PER_DAY} POINTS &mdash; ${POINTS_PER_DAY - viewPoints} MORE TO LAY THIS BRICK`}
    </div>
    ${viewPoints > 0 || (log.emails || 0) > 0 || (log.live || 0) > 0 ? `<button class="brx-clear" onclick="brickClearDay()">Clear this day</button>` : ''}
    `}
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:6px;">THE WALL</div>
    <div class="brx-block-date" style="margin-bottom:14px;">MON &rarr; SUN &middot; ONE BOX PER MONTH &middot; GOLD = OWED</div>
    <div class="cal-wall">${wall}</div>
    <div class="brx-legend">
      <span><i class="cal-key is-laid"></i>LAID</span>
      <span><i class="cal-key is-today"></i>TODAY</span>
      <span><i class="cal-key is-owed"></i>OWED</span>
      <span><i class="cal-key"></i>AHEAD</span>
    </div>
  </div>

  <div class="brx-block">
    <div class="brx-block-title" style="margin-bottom:6px;">TOTALS TO DATE</div>
    <div class="brx-block-date" style="margin-bottom:14px;">TARGET &mdash; 2 POINTS/DAY &middot; ${s.elapsed} DAY${s.elapsed === 1 ? '' : 'S'} ELAPSED</div>
    <div class="brx-totals">
      ${totalBox(s.totalPoints, 'TOTAL POINTS', s.expected.points, true)}
    </div>
    <div class="brx-totals" style="margin-top:8px;">
      ${totalBox(s.listedTotal, 'ITEMS LISTED', s.expected.listed)}
      ${totalBox(s.totals.posted, 'VIDEOS POSTED', s.expected.posted)}
    </div>

    <div class="brx-group-label" style="margin-top:18px;">ALSO TRACKED</div>
    <div class="brx-minis cols2">
      ${plainBox(s.totals.recorded, 'VIDEOS RECORDED')}
      ${plainBox(s.totals.engaged, 'CUSTOMERS ENGAGED')}
      ${plainBox(s.totals.emails, 'SALES EMAILS')}
      ${plainBox(s.totals.live, 'LIVE MINUTES')}
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

/* ── The Wall — calendar. Month blocks, Monday→Sunday rows. ── */
.cal-wall { display:flex; flex-direction:column; gap:12px; max-height:440px; overflow-y:auto; padding:2px; }
.cal-month { border:2px solid #FFFFFF !important; padding:11px 11px 12px; }
.brx-page.is-light .cal-month { border-color:#000000 !important; }
.cal-month-head { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:9px; }
.cal-month-head span:first-child { font-size:12px !important; font-weight:900 !important; letter-spacing:1.6px; color:#FFFFFF !important; }
.brx-page.is-light .cal-month-head span:first-child { color:#000000 !important; }
.cal-month-count { font-size:10px !important; font-weight:900 !important; letter-spacing:1px; color:#8A8A8A !important; font-variant-numeric:tabular-nums; }
.brx-page.is-light .cal-month-count { color:#5A5A5A !important; }
.cal-dow { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; margin-bottom:4px; }
.cal-dow span { text-align:center; font-size:8px !important; font-weight:900 !important; letter-spacing:0.5px; color:#6E6E6E !important; }
.brx-page.is-light .cal-dow span { color:#9A9A9A !important; }
.cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
.cal-cell {
  height:26px; padding:0; border:1.5px solid #4A4A4A !important; background:transparent !important;
  color:#6E6E6E !important; font-family:inherit; font-size:8px !important; font-weight:900 !important;
  cursor:pointer; border-radius:0 !important; font-variant-numeric:tabular-nums;
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.cal-cell.is-empty { border-color:transparent !important; background:transparent !important; cursor:default; }
.cal-cell.is-laid { background:#FFFFFF !important; border-color:#FFFFFF !important; color:#000000 !important; }
.cal-cell.is-missed { background:transparent !important; border-color:#3A3A3A !important; border-style:dotted !important; color:#3A3A3A !important; }
.cal-cell.is-today { border-color:#FFFFFF !important; border-width:2.5px !important; color:#FFFFFF !important; }
/* Week has closed: unlaid days you still owe glow gold; laid days keep a gold ring. */
.cal-cell.is-weekpast.is-missed { border-color:${GOLD} !important; color:${GOLD} !important; }
.cal-cell.is-weekpast.is-laid { box-shadow:inset 0 0 0 1.5px ${GOLD}; }
.cal-cell.is-weeknow:not(.is-laid):not(.is-today) { border-color:#7A6A34 !important; }
.cal-cell.is-view { outline:2px solid #FFFFFF !important; outline-offset:2px; }
.brx-page.is-light .cal-cell { border-color:#BDBDBD !important; color:#9A9A9A !important; }
.brx-page.is-light .cal-cell.is-empty { border-color:transparent !important; }
.brx-page.is-light .cal-cell.is-laid { background:#000000 !important; border-color:#000000 !important; color:#FFFFFF !important; }
.brx-page.is-light .cal-cell.is-missed { border-color:#D5D5D5 !important; color:#C5C5C5 !important; }
.brx-page.is-light .cal-cell.is-today { border-color:#000000 !important; color:#000000 !important; }
.brx-page.is-light .cal-cell.is-weekpast.is-missed { border-color:${GOLD} !important; color:#A9842A !important; }
.brx-page.is-light .cal-cell.is-view { outline-color:#000000 !important; }

.brx-legend { display:flex; flex-wrap:wrap; gap:14px; margin-top:14px; font-size:9px !important; font-weight:900 !important; letter-spacing:1.2px; color:#8A8A8A !important; }
.brx-legend span { display:flex; align-items:center; gap:6px; color:#8A8A8A !important; }
.cal-key { width:14px; height:11px; border:1.5px solid #4A4A4A !important; display:inline-block; box-sizing:border-box; }
.cal-key.is-laid { background:#FFFFFF !important; border-color:#FFFFFF !important; }
.cal-key.is-today { border-color:#FFFFFF !important; border-width:2px !important; }
.cal-key.is-owed { border-color:${GOLD} !important; border-style:dotted !important; }
.brx-page.is-light .brx-legend, .brx-page.is-light .brx-legend span { color:#5A5A5A !important; }
.brx-page.is-light .cal-key { border-color:#BDBDBD !important; }
.brx-page.is-light .cal-key.is-laid { background:#000000 !important; border-color:#000000 !important; }
.brx-page.is-light .cal-key.is-today { border-color:#000000 !important; }
.brx-page.is-light .cal-key.is-owed { border-color:${GOLD} !important; }

/* ── Totals vs expected ── */
.brx-totals { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
.brx-total { border:1.5px solid #4A4A4A !important; padding:12px 10px; }
.brx-total.is-hero { grid-column:1 / -1; }
.brx-total.is-hero .brx-total-num { font-size:34px !important; }
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
.brx-minis.cols2 { grid-template-columns:repeat(2,1fr); }
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
    if (!ALL_FIELDS.includes(field)) return;
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
