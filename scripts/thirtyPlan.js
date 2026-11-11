// ── ROAD TO 30 ──────────────────────────────────────────────────────────────
// Tap the "Until 30" card on Home to open the plan.
//
// Periods (aligned to the birthday, 12 Aug 2027):
//   Q1 = 9 Nov 2026 – 11 Feb 2027 (the extra days before the 12th go here)
//   Q2 = 12 Feb – 11 May 2027 · Q3 = 12 May – 11 Aug 2027
//   9 months, each 12th → 11th (Month 1 starts 9 Nov).
//
// Reverse-engineered ladder (work backwards from 30, Paul McKenna style):
//   AT 30 (12 Aug 2027)  →  3 months before (12 May)  →  6 months before (12 Feb)
//   →  each month's 12th between now and the next quarter mark  →  THIS WEEK (Mon–Sun).
//   Today (Nov 2026) that's: 12 Aug · 12 May · 12 Feb · 12 Jan · 12 Dec · this week.
//   The ladder rolls forward by itself as dates pass (ladder() below).
// Levels: 'life' · 'q' (p = 0–2, ends 12 Feb / 12 May / 12 Aug) · 'm' (p = 0–8, ends on
//   the 12th) · 'w' (p = Monday's date key). Each goal can link to ANY goal on a rung
//   above it (parentId) — "what has to be true by then so that this happens?".
//   Children inherit the parent's area.
//
// Progress (0–1):
//   • done → 1
//   • measurable (start → target, current) → (current − start) ÷ (target − start), clamped.
//     Works for "down" goals too (e.g. weight 246 → 205).
//   • otherwise, the average progress of its children (if any)
//   • otherwise unmeasured (a simple tick goal)
// On track = progress vs share of the period gone:
//   ≥ expected − 10% → ON TRACK · ≥ −25% → BEHIND · lower → OFF TRACK
//   Tick goals: open; BEHIND once 75% of the period has gone; MISSED once it ends.
//
// Data: state.data.thirtyPlan = { goals: [{ id, level, p, parentId, area, title,
//   unit, start, target, current, done, createdAt, updatedAt }] }
// Unsaved form typing lives in state.thirtyDraft + localStorage('thirtyDraft').

export const PLAN_START = '2026-11-09';
export const BIRTHDAY = '2027-08-12';

function localKey(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function parseKey(k) { return new Date(k + 'T12:00:00'); }
function addMonthsKey(k, n) { const d = parseKey(k); d.setMonth(d.getMonth() + n); return localKey(d); }
function addDaysKey(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return localKey(d); }
function esc(v = '') {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmt = (k) => parseKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtY = (k) => parseKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const num = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;
const fmtNum = (v) => v == null ? '—' : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(+(+v).toFixed(1)));

// Months: [start, end) — end is exclusive
export function monthRange(i) {
  const start = i === 0 ? PLAN_START : addMonthsKey('2026-11-12', i);
  const end = addMonthsKey('2026-11-12', i + 1);
  return { start, end };
}
export function quarterRange(q) { return { start: monthRange(q * 3).start, end: monthRange(q * 3 + 2).end }; }
const lifeRange = () => ({ start: PLAN_START, end: BIRTHDAY });
function rangeLabel(r) { return `${fmt(r.start)} – ${fmtY(addDaysKey(r.end, -1))}`; }
export function monthOf(k) {
  if (k < PLAN_START) return -1;
  for (let i = 0; i < 9; i++) if (k < monthRange(i).end) return i;
  return 9; // past the birthday
}
function elapsed(r, k) {
  const s = parseKey(r.start), e = parseKey(r.end), t = parseKey(k);
  return Math.min(1, Math.max(0, (t - s + 86400000 * 0.5) / (e - s)));
}

export const AREAS = {
  business: { label: 'Business', col: '#3B82F6' },
  health: { label: 'Health & body', col: '#22C55E' },
  money: { label: 'Money', col: '#EAB308' },
  family: { label: 'Family & Warda', col: '#EC4899' },
  personal: { label: 'Personal', col: '#8B5CF6' },
};

function goals(state) {
  const g = state.data?.thirtyPlan?.goals;
  return Array.isArray(g) ? g : [];
}
export function weekStart(k) { const d = parseKey(k); return addDaysKey(k, -((d.getDay() + 6) % 7)); }
// Milestones are "by" dates, so a quarter/month milestone counts from when you set it
// (not from the start of its month) — that's what makes "on track" work going backwards.
function rangeFor(g) {
  if (g.level === 'life') return lifeRange();
  if (g.level === 'w') return { start: g.p, end: addDaysKey(g.p, 7) };
  const r = g.level === 'q' ? quarterRange(g.p) : monthRange(g.p);
  const made = g.createdAt ? localKey(new Date(g.createdAt)) : r.start;
  const start = made < r.start ? (made < PLAN_START ? PLAN_START : made) : r.start;
  return { start: start < r.end ? start : r.start, end: r.end };
}
function children(all, g) { return all.filter(c => c.parentId === g.id); }

// The rungs, top (30) to bottom (this week). end = milestone date (exclusive range end).
export function ladder(todayKey = localKey()) {
  const m = Math.max(0, monthOf(todayKey));
  if (m > 8) return [];
  const q = Math.floor(m / 3);
  const rungs = [{ level: 'life', p: null, end: BIRTHDAY, label: 'AT 30' }];
  for (let qq = 1; qq >= q; qq--) rungs.push({ level: 'q', p: qq, end: quarterRange(qq).end, label: qq === 1 ? '3 MONTHS BEFORE' : '6 MONTHS BEFORE' });
  for (let i = q * 3 + 1; i >= m; i--) { const n = i - m + 1; rungs.push({ level: 'm', p: i, end: monthRange(i).end, label: `${n} MONTH${n > 1 ? 'S' : ''} OUT` }); }
  const ws = weekStart(todayKey);
  rungs.push({ level: 'w', p: ws, end: addDaysKey(ws, 7), label: 'THIS WEEK' });
  return rungs;
}
const inRung = (g, r) => g.level === r.level && (r.level === 'life' || g.p === r.p);
const rungDate = (r) => r.level === 'w' ? `by Sun ${fmt(addDaysKey(r.end, -1))}` : fmtY(r.end);
const pv = (p) => p == null ? 'null' : typeof p === 'string' ? `'${p}'` : p;

function progress(all, g, seen = new Set()) {
  if (g.done) return 1;
  if (seen.has(g.id)) return null; seen.add(g.id);
  const s = num(g.start), t = num(g.target), c = num(g.current);
  if (s != null && t != null && t !== s) return Math.min(1, Math.max(0, ((c ?? s) - s) / (t - s)));
  const kids = children(all, g);
  const ps = kids.map(k => progress(all, k, seen)).map(p => p == null ? 0 : p);
  if (ps.length) return ps.reduce((a, b) => a + b, 0) / ps.length;
  return null;
}
function status(all, g, todayKey) {
  const r = rangeFor(g);
  if (g.done) return 'done';
  if (todayKey < r.start) return 'upcoming';
  const exp = elapsed(r, todayKey);
  const p = progress(all, g);
  if (todayKey >= r.end) return p != null && p >= 0.999 ? 'done' : 'missed';
  if (p == null) return exp >= 0.75 ? 'behind' : 'open';
  const d = p - exp;
  return d >= -0.1 ? 'on' : d >= -0.25 ? 'behind' : 'off';
}
const STATUS = {
  on: ['ON TRACK', 'on'], behind: ['BEHIND', 'behind'], off: ['OFF TRACK', 'off'], missed: ['MISSED', 'off'],
  done: ['DONE ✓', 'on'], open: ['IN PROGRESS', 'open'], upcoming: ['UPCOMING', 'open'],
};

// Collapsed-card summary (used by renderHomeTab)
export function thirtySummary(state, todayKey = localKey()) {
  const all = goals(state);
  const rungs = ladder(todayKey);
  const count = (list) => list.reduce((a, g) => { const s = status(all, g, todayKey); a[s] = (a[s] || 0) + 1; return a; }, {});
  const week = rungs.find(r => r.level === 'w');
  const next = rungs.filter(r => r.level === 'm').slice(-1)[0] || rungs.filter(r => r.level === 'q').slice(-1)[0] || rungs[0];
  const wGoals = week ? all.filter(g => inRung(g, week)) : [];
  const nGoals = next ? all.filter(g => inRung(g, next)) : [];
  const empty = rungs.find(r => !all.some(g => inRung(g, r)));
  const need = !empty ? null : empty.level === 'life' ? 'SET YOUR 30 GOALS' : empty.level === 'w' ? 'PLAN THIS WEEK' : `PLAN ${fmt(empty.end).toUpperCase()}`;
  return { m: monthOf(todayKey), next, nc: count(nGoals), nN: nGoals.length, wN: wGoals.length, wDone: wGoals.filter(g => status(all, g, todayKey) === 'done').length, need, life: all.filter(g => g.level === 'life').length };
}
export function thirtySummaryLine(sum) {
  if (sum.m > 8 || !sum.next) return '';
  const c = sum.nc, parts = [];
  if (c.done) parts.push(`${c.done} done`);
  if (c.on) parts.push(`${c.on} on track`);
  if (c.open) parts.push(`${c.open} in progress`);
  if (c.behind) parts.push(`<b class="w">${c.behind} behind</b>`);
  if (c.off || c.missed) parts.push(`<b class="r">${(c.off || 0) + (c.missed || 0)} off track</b>`);
  return [sum.nN ? `By ${fmt(sum.next.end)}: ${parts.join(' · ')}` : '', sum.wN ? `This week ${sum.wDone}/${sum.wN} done` : ''].filter(Boolean).join(' · ');
}

export const THIRTY_CSS = `<style id="thirty-css">
.nh .nh-bday-tap { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-30-foot { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-30-foot-t { font-size:12px; font-weight:800; color:var(--nh-sub) !important; line-height:1.4; }
.nh .nh-30-foot-t b.w { color:var(--nh-gold) !important; } .nh .nh-30-foot-t b.r { color:var(--nh-red) !important; }
.nh .nh-30-chev { font-size:16px; font-weight:900; color:var(--nh-gold) !important; transition:transform .2s; }
.nh .nh-30-chev.open { transform:rotate(180deg); }
.nh .nh-30-need { font-size:10px; font-weight:900; letter-spacing:1px; padding:5px 9px; border-radius:20px; background:var(--nh-gold); color:#000 !important; white-space:nowrap; animation:nhFlash 1.6s ease-in-out infinite; }
.nh .nh-30 { margin-top:14px; display:flex; flex-direction:column; gap:16px; }
.nh .nh-30-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.nh .nh-30-q { display:flex; flex-direction:column; gap:4px; }
.nh .nh-30-q-l { font-size:10px; font-weight:900; letter-spacing:1.2px; color:var(--nh-muted) !important; }
.nh .nh-30-q.cur .nh-30-q-l { color:var(--nh-gold) !important; }
.nh .nh-30-ms { display:grid; grid-template-columns:repeat(3,1fr); gap:3px; }
.nh .nh-30-m { height:30px; border-radius:7px; border:1px solid var(--nh-line); background:transparent; font-size:11px; font-weight:900; color:var(--nh-muted) !important; cursor:pointer; position:relative; overflow:hidden; padding:0; }
.nh .nh-30-m i { position:absolute; left:0; top:0; bottom:0; background:rgba(245,197,66,0.22); }
.nh .nh-30-m span { position:relative; color:inherit !important; }
.nh .nh-30-m.past { color:var(--nh-sub) !important; }
.nh .nh-30-m.cur { border-color:var(--nh-gold); color:var(--nh-text) !important; }
.nh .nh-30-m.sel { outline:2px solid var(--nh-gold); outline-offset:1px; }
.nh .nh-30-m .dot { position:absolute; top:3px; right:3px; width:5px; height:5px; border-radius:50%; background:var(--nh-green); }
.nh .nh-30-sec-h { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:8px; }
.nh .nh-30-sec-t { font-size:11px; font-weight:900; letter-spacing:1.5px; color:var(--nh-text) !important; }
.nh .nh-30-sec-s { font-size:11px; font-weight:700; color:var(--nh-muted) !important; text-align:right; }
.nh .nh-30-list { display:flex; flex-direction:column; gap:8px; }
.nh .nh-30-g { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; border-left:4px solid var(--a); cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-30-g-top { display:flex; align-items:flex-start; gap:10px; }
.nh .nh-30-chk { flex:0 0 26px; height:26px; border-radius:8px; border:2px solid var(--nh-line); background:transparent; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; color:#fff !important; cursor:pointer; padding:0; }
.nh .nh-30-chk.on { background:var(--nh-green); border-color:var(--nh-green); }
.nh .nh-30-g-main { flex:1; min-width:0; }
.nh .nh-30-g-title { font-size:15px; font-weight:800; line-height:1.3; color:var(--nh-text) !important; word-break:break-word; }
.nh .nh-30-g.done .nh-30-g-title { text-decoration:line-through; color:var(--nh-muted) !important; }
.nh .nh-30-g-sub { font-size:11px; font-weight:700; margin-top:3px; color:var(--nh-muted) !important; }
.nh .nh-30-pill { flex:0 0 auto; font-size:9px; font-weight:900; letter-spacing:1px; padding:4px 7px; border-radius:20px; white-space:nowrap; }
.nh .nh-30-pill.on { background:rgba(34,197,94,0.16); color:var(--nh-green) !important; }
.nh .nh-30-pill.behind { background:rgba(245,197,66,0.18); color:var(--nh-gold) !important; }
.nh .nh-30-pill.off { background:rgba(239,68,68,0.16); color:var(--nh-red) !important; }
.nh .nh-30-pill.open { background:var(--nh-line); color:var(--nh-muted) !important; }
.nh .nh-30-bar { position:relative; height:7px; border-radius:4px; background:var(--nh-line); margin-top:8px; }
.nh .nh-30-bar > i { position:absolute; left:0; top:0; bottom:0; border-radius:4px; background:var(--a); }
.nh .nh-30-bar > b { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--nh-text); opacity:0.55; border-radius:1px; }
.nh .nh-30-nums { display:flex; justify-content:space-between; font-size:11px; font-weight:700; margin-top:4px; color:var(--nh-muted) !important; }
.nh .nh-30-det { margin-top:10px; padding-top:10px; border-top:1px dashed var(--nh-line); display:flex; flex-direction:column; gap:8px; }
.nh .nh-30-upd { display:flex; gap:8px; align-items:center; }
.nh .nh-30-in { flex:1; min-width:0; height:40px; border-radius:10px; border:1px solid var(--nh-line) !important; background:transparent !important; color:var(--nh-text) !important; padding:0 12px; font:inherit; font-size:15px; -webkit-appearance:none; appearance:none; }
.nh select.nh-30-in { padding-right:8px; }
.nh textarea.nh-30-in { height:auto; min-height:60px; padding:10px 12px; line-height:1.4; resize:vertical; }
.nh .nh-30-btn { height:40px; padding:0 14px; border-radius:10px; border:0; font-size:13px; font-weight:900; background:#C9A84C !important; color:#000 !important; cursor:pointer; white-space:nowrap; }
.nh .nh-30-btn.ghost { background:transparent !important; border:1px solid var(--nh-line); color:var(--nh-text) !important; }
.nh .nh-30-btn.danger { background:transparent !important; border:1px solid var(--nh-red); color:var(--nh-red) !important; }
.nh .nh-30-btn.small { height:32px; padding:0 10px; font-size:12px; }
.nh .nh-30-add { width:100%; height:38px; border-radius:10px; border:1px dashed var(--nh-line); background:transparent; font-size:13px; font-weight:800; color:var(--nh-sub) !important; cursor:pointer; margin-top:8px; }
.nh .nh-30-empty { font-size:12px; line-height:1.4; color:var(--nh-muted) !important; }
.nh .nh-30-form { border:1px solid var(--nh-gold); border-radius:14px; padding:12px; display:flex; flex-direction:column; gap:10px; }
.nh .nh-30-form-h { font-size:14px; font-weight:900; color:var(--nh-text) !important; }
.nh .nh-30-lbl { font-size:10px; font-weight:900; letter-spacing:1.3px; margin-bottom:4px; display:block; color:var(--nh-muted) !important; }
.nh .nh-30-row { display:flex; gap:8px; } .nh .nh-30-row > * { flex:1; min-width:0; }
.nh .nh-30-hint { font-size:11px; line-height:1.4; color:var(--nh-muted) !important; }
.nh .nh-30-areas { display:flex; flex-wrap:wrap; gap:6px; }
.nh .nh-30-area { height:32px; padding:0 10px; border-radius:20px; border:1px solid var(--nh-line); background:transparent; font-size:12px; font-weight:800; color:var(--nh-sub) !important; cursor:pointer; }
.nh .nh-30-area.sel { background:var(--a); border-color:var(--a); color:#fff !important; }
.nh .nh-30-actions { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; align-items:center; }
.nh .nh-30-confirm { font-size:12px; font-weight:800; color:var(--nh-red) !important; margin-right:auto; }
.nh .nh-30-back { align-self:flex-start; }
.nh .nh-30-intro { font-size:12px; line-height:1.45; color:var(--nh-sub) !important; }
.nh .nh-30-ladder { position:relative; display:flex; flex-direction:column; gap:18px; padding-left:22px; }
.nh .nh-30-ladder::before { content:''; position:absolute; left:6px; top:6px; bottom:6px; width:2px; background:linear-gradient(var(--nh-gold), var(--nh-line)); border-radius:1px; }
.nh .nh-30-rung { position:relative; }
.nh .nh-30-node { position:absolute; left:-22px; top:2px; width:14px; height:14px; border-radius:50%; border:2px solid var(--nh-gold); background:var(--nh-card, #fff); }
.nh .nh-30-rung.top .nh-30-node { background:var(--nh-gold); }
.nh .nh-30-rung.now .nh-30-node { background:var(--nh-gold); box-shadow:0 0 0 4px rgba(201,168,76,0.25); }
.nh .nh-30-q-ask { font-size:12px; line-height:1.4; font-style:italic; margin-bottom:8px; color:var(--nh-sub) !important; }
</style>`;

function areaCol(a) { return (AREAS[a] || AREAS.personal).col; }

function renderGoal(state, all, g, todayKey, next = null) {
  const st = status(all, g, todayKey);
  const [pl, pc] = STATUS[st];
  const p = progress(all, g);
  const r = rangeFor(g);
  const exp = elapsed(r, todayKey);
  const measurable = num(g.start) != null && num(g.target) != null && num(g.target) !== num(g.start);
  const kids = children(all, g);
  const parent = g.parentId ? all.find(x => x.id === g.parentId) : null;
  const open = !!(state.thirtyOpenGoal === g.id);
  const tickable = !measurable && !kids.length;
  const pre = /^[£$€]$/.test(g.unit || '');
  const unit = g.unit && !pre ? ' ' + esc(g.unit) : '';
  const val = (v) => (pre ? esc(g.unit) : '') + fmtNum(v) + unit;
  const sub = [
    parent ? `↳ ${esc(parent.title)}` : (g.level === 'life' ? esc((AREAS[g.area] || AREAS.personal).label) : ''),
    kids.length ? `${kids.filter(k => status(all, k, todayKey) === 'done').length}/${kids.length} steps done` : '',
  ].filter(Boolean).join(' · ');
  const bar = p != null && !(tickable) ? `
      <div class="nh-30-bar"><i style="width:${Math.round(p * 100)}%"></i>${todayKey >= r.start && todayKey < r.end ? `<b style="left:calc(${(exp * 100).toFixed(1)}% - 1px)" title="where you should be"></b>` : ''}</div>
      <div class="nh-30-nums"><span>${measurable ? `${val(num(g.current) ?? num(g.start))} of ${val(num(g.target))}` : `${Math.round(p * 100)}% from ${kids.length} steps`}</span><span>${Math.round(p * 100)}% · should be ${Math.round(exp * 100)}%</span></div>` : '';
  const det = open ? `
      <div class="nh-30-det" onclick="event.stopPropagation()">
        ${measurable ? `
        <div class="nh-30-upd">
          <input id="t30-upd-${g.id}" class="nh-30-in" type="number" inputmode="decimal" step="any" placeholder="Now: ${val(num(g.current) ?? num(g.start))}">
          <button class="nh-30-btn" onclick="thirtyUpdate('${g.id}')">Update</button>
        </div>
        <div class="nh-30-hint">Started at ${val(num(g.start))} → target ${val(num(g.target))} by ${g.level === 'w' ? fmtY(addDaysKey(r.end, -1)) : fmtY(r.end)}${g.updatedAt ? ` · last updated ${fmt(localKey(new Date(g.updatedAt)))}` : ''}</div>` : ''}
        ${g.why ? `<div class="nh-30-hint"><b style="color:var(--nh-text)">Why:</b> ${esc(g.why)}</div>` : ''}
        <div class="nh-30-actions">
          ${!tickable ? `<button class="nh-30-btn ghost small" onclick="thirtyToggleDone('${g.id}')">${g.done ? 'Mark not done' : 'Mark done'}</button>` : ''}
          ${next ? `<button class="nh-30-btn ghost small" onclick="thirtyOpenForm('${next.level}', null, '${g.id}', ${pv(next.p)})">+ Step ${next.level === 'w' ? 'this week' : 'by ' + fmt(next.end)}</button>` : ''}
          <button class="nh-30-btn ghost small" onclick="thirtyOpenForm('${g.level}', '${g.id}')">Edit</button>
        </div>
      </div>` : '';
  return `
    <div class="nh-30-g ${g.done ? 'done' : ''}" style="--a:${areaCol(g.area)}" role="button" tabindex="0" aria-expanded="${open}" onclick="event.stopPropagation(); thirtyOpenGoal('${g.id}')">
      <div class="nh-30-g-top">
        ${tickable ? `<button class="nh-30-chk ${g.done ? 'on' : ''}" aria-label="${g.done ? 'Mark not done' : 'Mark done'}" onclick="event.stopPropagation(); thirtyToggleDone('${g.id}')">${g.done ? '✓' : ''}</button>` : ''}
        <div class="nh-30-g-main">
          <div class="nh-30-g-title">${esc(g.title)}</div>
          ${sub ? `<div class="nh-30-g-sub">${sub}</div>` : ''}
        </div>
        <span class="nh-30-pill ${pc}">${pl}</span>
      </div>
      ${bar}
      ${det}
    </div>`;
}

function renderForm(state, all, todayKey) {
  const f = state.thirtyForm;
  const d = state.thirtyDraft || {};
  const lvl = f.level;
  const rungs = ladder(todayKey);
  const idx = rungs.findIndex(r => r.level === lvl && (lvl === 'life' || r.p === f.p));
  const above = idx > 0 ? rungs.slice(0, idx) : (lvl === 'life' ? [] : rungs.filter(r => r.level !== 'w' && r.level !== lvl));
  const groups = above.map(r => ({ r, gs: all.filter(g => inRung(g, r) && g.id !== f.id) })).filter(x => x.gs.length);
  const parent = d.parentId ? all.find(g => g.id === d.parentId) : null;
  const area = parent ? parent.area : (d.area || 'business');
  const rung = rungs[idx];
  const per = rung ? `${rung.label.toLowerCase()} · ${rungDate(rung)}` : '';
  const inp = (k) => `oninput="thirtyDraftInput('${k}', this.value)"`;
  const confirming = f.id && state.thirtyDelete === f.id;
  const ph = lvl === 'life' ? 'e.g. TJM turning over £20k a month' : lvl === 'q' ? 'e.g. TJM website relaunched with 200 products'
    : lvl === 'm' ? 'e.g. Photograph and list 60 products' : 'e.g. Shoot and edit 15 product photos';
  return `
  <div class="nh-30-form" onclick="event.stopPropagation()">
    <div class="nh-30-form-h">${f.id ? 'Edit' : 'New'} ${lvl === 'life' ? 'goal for 30' : lvl === 'w' ? 'goal for this week' : 'milestone'} <span style="font-weight:700;color:var(--nh-muted)">· ${per}</span></div>
    <div><label class="nh-30-lbl" for="t30-title">GOAL</label>
      <input id="t30-title" class="nh-30-in" type="text" placeholder="${ph}" value="${esc(d.title || '')}" ${inp('title')}></div>
    ${groups.length ? `<div><label class="nh-30-lbl" for="t30-parent">THIS MAKES IT HAPPEN</label>
      <select id="t30-parent" class="nh-30-in" onchange="thirtyDraftInput('parentId', this.value, true)">
        <option value="">— not linked —</option>
        ${groups.map(({ r, gs }) => `<optgroup label="${r.label} · ${rungDate(r)}">${gs.map(g => `<option value="${g.id}" ${d.parentId === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</optgroup>`).join('')}
      </select></div>` : ''}
    ${!parent ? `<div><span class="nh-30-lbl">AREA</span><div class="nh-30-areas">
      ${Object.entries(AREAS).map(([k, a]) => `<button class="nh-30-area ${area === k ? 'sel' : ''}" style="--a:${a.col}" onclick="thirtyDraftInput('area', '${k}', true)">${a.label}</button>`).join('')}
    </div></div>` : ''}
    <div><span class="nh-30-lbl">MEASURE IT (OPTIONAL, BUT IT'S HOW "ON TRACK" WORKS)</span>
      <div class="nh-30-row">
        <input id="t30-start" class="nh-30-in" type="number" inputmode="decimal" step="any" placeholder="Start" value="${esc(d.start ?? '')}" ${inp('start')}>
        <input id="t30-target" class="nh-30-in" type="number" inputmode="decimal" step="any" placeholder="Target" value="${esc(d.target ?? '')}" ${inp('target')}>
        <input id="t30-unit" class="nh-30-in" type="text" placeholder="Unit (£, lb…)" value="${esc(d.unit || '')}" ${inp('unit')}>
      </div>
      ${f.id && num(d.start) != null ? `<div style="margin-top:8px"><label class="nh-30-lbl" for="t30-current">WHERE YOU ARE NOW</label><input id="t30-current" class="nh-30-in" type="number" inputmode="decimal" step="any" value="${esc(d.current ?? '')}" ${inp('current')}></div>` : ''}
      <div class="nh-30-hint" style="margin-top:6px">Leave blank for a tick-box goal.${lvl !== 'w' ? ' Without a number, progress comes from the steps linked under it.' : ''}</div>
    </div>
    ${lvl === 'life' ? `<div><label class="nh-30-lbl" for="t30-why">WHY IT MATTERS (OPTIONAL)</label>
      <textarea id="t30-why" class="nh-30-in" placeholder="What changes when you hit this?" ${inp('why')}>${esc(d.why || '')}</textarea></div>` : ''}
    <div class="nh-30-actions">
      ${confirming ? `<span class="nh-30-confirm">Delete this goal?</span>
        <button class="nh-30-btn ghost" onclick="thirtyDelCancel()">Keep</button>
        <button class="nh-30-btn danger" onclick="thirtyDelConfirm()">Delete</button>` : `
        ${f.id ? `<button class="nh-30-btn danger" onclick="thirtyDelAsk()" style="margin-right:auto">Delete</button>` : ''}
        <button class="nh-30-btn ghost" onclick="thirtyFormCancel()">Cancel</button>
        <button class="nh-30-btn" onclick="thirtyFormSave()">Save</button>`}
    </div>
  </div>`;
}

export function renderThirtyPlan(state, todayKey = localKey()) {
  const all = goals(state);
  const rungs = ladder(todayKey);
  const f = state.thirtyForm;
  const daysTo = (k) => Math.max(0, Math.round((parseKey(k) - parseKey(todayKey)) / 86400000));
  const list = (arr, next) => arr.map(g => renderGoal(state, all, g, todayKey, next)).join('');
  const formIn = (r) => f && f.level === r.level && (r.level === 'life' || f.p === r.p);
  const formPlaced = f && rungs.some(formIn);

  const ask = (r, i) => {
    if (r.level === 'life') return 'It’s 12 Aug 2027 and the year went brilliantly. What’s true? Business, health, money, family, personal. Make them measurable where you can.';
    const up = rungs[i - 1];
    const upTxt = up.level === 'life' ? 'your 30 goals land' : `you hit ${fmt(up.end)}`;
    return r.level === 'w' ? `What will you get done this week so ${upTxt}?` : `What has to be true by ${fmt(r.end)} so ${upTxt}?`;
  };

  const rungHtml = rungs.map((r, i) => {
    const gs = all.filter(g => inRung(g, r));
    const next = rungs[i + 1] || null;
    const days = r.level === 'w' ? daysTo(r.end) - 1 : daysTo(r.end);
    return `
    <div class="nh-30-rung ${i === 0 ? 'top' : ''} ${r.level === 'w' ? 'now' : ''}">
      <span class="nh-30-node"></span>
      <div class="nh-30-sec-h"><span class="nh-30-sec-t">${r.label}</span><span class="nh-30-sec-s">${rungDate(r)} · ${days} day${days === 1 ? '' : 's'}${r.level === 'w' ? ' left' : ''}</span></div>
      ${!gs.length || formIn(r) ? `<div class="nh-30-q-ask">${ask(r, i)}</div>` : ''}
      <div class="nh-30-list">${list(gs, next)}${formIn(r) ? renderForm(state, all, todayKey) : ''}</div>
      ${f ? '' : `<button class="nh-30-add" onclick="event.stopPropagation(); thirtyOpenForm('${r.level}', null, null, ${pv(r.p)})">+ ${r.level === 'life' ? 'Goal for 30' : r.level === 'w' ? 'This week' : 'Milestone by ' + fmt(r.end)}</button>`}
    </div>`;
  }).join('');

  return `
  <div class="nh-30" onclick="event.stopPropagation()">
    <div class="nh-30-intro">Work backwards. Start with who you are at 30, then ask what has to be true 3 months before, and keep stepping back to this week. Tap a goal to add the step before it.</div>
    ${f && !formPlaced ? renderForm(state, all, todayKey) : ''}
    <div class="nh-30-ladder">${rungHtml}</div>
  </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────
export function initThirtyPlan({ state, saveData, render }) {
  const plan = () => {
    if (!state.data.thirtyPlan || !Array.isArray(state.data.thirtyPlan.goals)) state.data.thirtyPlan = { goals: [] };
    return state.data.thirtyPlan;
  };
  const persist = () => {
    try {
      if (state.thirtyForm && state.thirtyDraft) localStorage.setItem('thirtyDraft', JSON.stringify({ form: state.thirtyForm, draft: state.thirtyDraft }));
      else localStorage.removeItem('thirtyDraft');
    } catch (e) {}
  };
  try {
    const saved = JSON.parse(localStorage.getItem('thirtyDraft') || 'null');
    if (saved && saved.form && saved.draft) { state.thirtyForm = saved.form; state.thirtyDraft = saved.draft; state.thirtyOpen = true; }
  } catch (e) {}

  window.toggleThirtyPlan = () => { state.thirtyOpen = !state.thirtyOpen; if (!state.thirtyOpen) state.thirtySel = null; render(); };
  window.thirtySelect = (i) => { state.thirtySel = i; render(); };
  window.thirtyOpenGoal = (id) => { state.thirtyOpenGoal = state.thirtyOpenGoal === id ? null : id; render(); };

  window.thirtyOpenForm = (level, id = null, parentId = null, p = null) => {
    state.thirtyOpen = true; state.thirtyDelete = null;
    const all = plan().goals;
    const g = id ? all.find(x => x.id === id) : null;
    const par = parentId ? all.find(x => x.id === parentId) : null;
    if (level === 'w' && p == null) p = weekStart(localKey());
    state.thirtyForm = { level, id: id || null, p: level === 'life' ? null : (g ? g.p : p) };
    state.thirtyDraft = g ? { title: g.title, parentId: g.parentId || '', area: g.area, start: g.start ?? '', target: g.target ?? '', unit: g.unit || '', current: g.current ?? '', why: g.why || '' }
      : { title: '', parentId: par ? par.id : '', area: par ? par.area : 'business', start: '', target: '', unit: '', current: '', why: '' };
    persist(); render();
    setTimeout(() => { const el = document.getElementById('t30-title'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (!g) el.focus({ preventScroll: true }); } }, 60);
  };
  window.thirtyDraftInput = (k, v, rerender = false) => {
    if (!state.thirtyDraft) state.thirtyDraft = {};
    state.thirtyDraft[k] = v; persist();
    if (rerender) {
      // keep typed text before re-rendering
      ['title', 'start', 'target', 'unit', 'current', 'why'].forEach(f => { const el = document.getElementById('t30-' + f); if (el) state.thirtyDraft[f] = el.value; });
      persist(); render();
    }
  };
  window.thirtyFormCancel = () => { state.thirtyForm = null; state.thirtyDraft = null; state.thirtyDelete = null; persist(); render(); };
  window.thirtyFormSave = () => {
    const f = state.thirtyForm; if (!f) return;
    const d = { ...(state.thirtyDraft || {}) };
    ['title', 'start', 'target', 'unit', 'current', 'why', 'parent'].forEach(k => { const el = document.getElementById('t30-' + k); if (el) d[k === 'parent' ? 'parentId' : k] = el.value; });
    const title = String(d.title || '').trim();
    if (!title) { alert('Give the goal a name.'); return; }
    const s = num(d.start), t = num(d.target);
    if ((s == null) !== (t == null)) { alert('For a measurable goal, fill in both Start and Target. Or leave both blank for a tick-box goal.'); return; }
    if (s != null && s === t) { alert('Start and Target can’t be the same number.'); return; }
    const all = plan().goals;
    const par = d.parentId ? all.find(g => g.id === d.parentId) : null;
    const now = Date.now();
    const rec = { level: f.level, p: f.p, parentId: par ? par.id : null, area: par ? par.area : (d.area || 'business'), title,
      start: s, target: t, unit: String(d.unit || '').trim(), why: String(d.why || '').trim() };
    if (f.id) {
      const i = all.findIndex(g => g.id === f.id);
      if (i >= 0) {
        const cur = num(d.current);
        all[i] = { ...all[i], ...rec, current: s == null ? null : (cur != null ? cur : (all[i].current ?? s)), updatedAt: now };
        // area change on a parent flows down to its children
        const flow = (pid, seen = new Set()) => all.filter(c => c.parentId === pid && !seen.has(c.id)).forEach(c => { seen.add(c.id); c.area = all[i].area; flow(c.id, seen); });
        flow(f.id);
      }
    } else {
      const id = 't30_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
      all.push({ id, ...rec, current: s, done: false, createdAt: now, updatedAt: now });
    }
    state.thirtyForm = null; state.thirtyDraft = null; persist(); saveData();
  };
  window.thirtyDelAsk = () => { state.thirtyDelete = state.thirtyForm?.id || null; render(); };
  window.thirtyDelCancel = () => { state.thirtyDelete = null; render(); };
  window.thirtyDelConfirm = () => {
    const id = state.thirtyDelete; if (!id) return;
    const p = plan();
    p.goals = p.goals.filter(g => g.id !== id);
    p.goals.forEach(g => { if (g.parentId === id) g.parentId = null; }); // children stay, just unlinked
    state.thirtyForm = null; state.thirtyDraft = null; state.thirtyDelete = null; state.thirtyOpenGoal = null;
    persist(); saveData();
  };
  window.thirtyToggleDone = (id) => {
    const g = plan().goals.find(x => x.id === id); if (!g) return;
    g.done = !g.done; g.updatedAt = Date.now(); saveData();
  };
  window.thirtyUpdate = (id) => {
    const el = document.getElementById('t30-upd-' + id);
    const v = el ? num(el.value) : null;
    if (v == null) { alert('Enter where you are now.'); return; }
    const g = plan().goals.find(x => x.id === id); if (!g) return;
    g.current = v; g.updatedAt = Date.now();
    const s = num(g.start), t = num(g.target);
    if (s != null && t != null && (t > s ? v >= t : v <= t)) g.done = true;
    saveData();
  };
}
