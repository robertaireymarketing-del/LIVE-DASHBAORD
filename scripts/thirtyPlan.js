// ── ROAD TO 30 ──────────────────────────────────────────────────────────────
// Tap the "Until 30" card on Home to open the plan.
//
// Reverse-engineered ladder (work backwards from 30, Paul McKenna style):
//   AT 30 (12 Aug 2027)  →  3 months before (12 May)  →  6 months before (12 Feb)
//   →  each month's 12th between now and the next quarter mark  →  THIS WEEK (Mon–Sun).
//   Today (Nov 2026) that's: 12 Aug · 12 May · 12 Feb · 12 Jan · 12 Dec · this week.
//   The ladder rolls forward by itself as dates pass (ladder() below).
//
// Each rung is a list of rows: headings, text paragraphs and tick-box items (type freely, Enter = new
// item, Backspace on an empty row = delete it). Ticking stamps today's date; tap the
// date to change it or add completion notes.
// Typing saves quietly (debounced, no re-render) so the keyboard stays up.
//
// Data: state.data.thirtyPlan.items = { <rungKey>: [{ id, h (heading?), t (text paragraph?), text, done, doneAt (YYYY-MM-DD), note }] }
//   rungKey: 'life' · 'q:1' (12 May) / 'q:0' (12 Feb) · 'm:0' (12 Dec) … 'm:8' · 'w:<Monday>'
//   Steps whose date has passed drop off the ladder and show in "Past steps" at the bottom
//   (read-only: what you wrote, what you ticked and when, your notes). Nothing carries forward.
//   Weekly checkboxes can have a planned day + time (day 0–6 = Mon–Sun, time "HH:MM") —
//   an implementation intention ("Tue 07:00: write 10 listings"). Shown on the Home card too.
//   Weekly review: on Sunday the This-week step asks 3 questions; if last week has items but
//   no review, the plan asks for it on Mon/Tue. Stored in thirtyPlan.reviews[<weekKey>]
//   = { done, missed, next, at }. Shown under that week in Past steps.
//   Follow-through: bars for the last 8 weeks (% of weekly checkboxes ticked).
//   Old free-text notes (thirtyPlan.notes) convert to rows the first time a step is shown:
//   lines starting with # or ending with : or in CAPITALS become headings.

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

// Months: [start, end) — each ends on the 12th
export function monthRange(i) {
  const start = i === 0 ? PLAN_START : addMonthsKey('2026-11-12', i);
  const end = addMonthsKey('2026-11-12', i + 1);
  return { start, end };
}
export function quarterRange(q) { return { start: monthRange(q * 3).start, end: monthRange(q * 3 + 2).end }; }
export function monthOf(k) {
  if (k < PLAN_START) return -1;
  for (let i = 0; i < 9; i++) if (k < monthRange(i).end) return i;
  return 9; // past the birthday
}
export function weekStart(k) { const d = parseKey(k); return addDaysKey(k, -((d.getDay() + 6) % 7)); }

// The rungs, top (30) to bottom (this week). end = milestone date.
export function ladder(todayKey = localKey()) {
  const m = Math.max(0, monthOf(todayKey));
  if (m > 8) return [];
  const q = Math.floor(m / 3);
  const rungs = [{ key: 'life', end: BIRTHDAY, label: 'AT 30' }];
  for (let qq = 1; qq >= q; qq--) rungs.push({ key: `q:${qq}`, end: quarterRange(qq).end, label: qq === 1 ? '3 MONTHS BEFORE' : '6 MONTHS BEFORE' });
  for (let i = q * 3 + 1; i >= m; i--) { const n = i - m + 1; rungs.push({ key: `m:${i}`, end: monthRange(i).end, label: `${n} MONTH${n > 1 ? 'S' : ''} OUT` }); }
  const ws = weekStart(todayKey);
  rungs.push({ key: `w:${ws}`, end: addDaysKey(ws, 7), label: 'THIS WEEK', week: true });
  return rungs;
}
const rungDate = (r) => r.week ? `by Sun ${fmt(addDaysKey(r.end, -1))}` : fmtY(r.end);

const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function fromText(t) {
  return String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const h = /^#/.test(l) || /:$/.test(l) || (/[A-Z]/.test(l) && l === l.toUpperCase() && l.length < 40);
    const text = h ? l.replace(/^#+\s*/, '').replace(/:$/, '') : l.replace(/^([-*•]|\[ ?\])\s*/, '');
    return { id: uid(), h, text, done: false, doneAt: null, note: '' };
  });
}
// Rows for a rung (converts old free text on first read)
function rows(state, key) {
  const plan = state.data?.thirtyPlan;
  if (!plan) return [];
  if (!plan.items) plan.items = {};
  if (!Array.isArray(plan.items[key]) && plan.notes && String(plan.notes[key] || '').trim()) plan.items[key] = fromText(plan.notes[key]);
  return plan.items[key] || [];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const whenTxt = (x) => x.day == null && !x.time ? '' : [x.day != null && x.day !== '' ? DAYS[+x.day] : '', x.time || ''].filter(Boolean).join(' ');
const dow = (k) => (parseKey(k).getDay() + 6) % 7;
function reviews(state) { return state.data?.thirtyPlan?.reviews || {}; }
const boxesOf = (list) => (list || []).filter(x => !x.h && !x.t && String(x.text || '').trim());
// Which week (if any) is waiting for its review: this week on Sunday, last week on Mon/Tue
function reviewDue(state, todayKey) {
  const ws = weekStart(todayKey), r = reviews(state);
  const items = state.data?.thirtyPlan?.items || {};
  if (dow(todayKey) === 6 && !r[ws]?.at) return ws;
  const prev = addDaysKey(ws, -7);
  if (dow(todayKey) <= 1 && !r[prev]?.at && boxesOf(items['w:' + prev]).length) return prev;
  return null;
}

// Collapsed-card summary (used by renderHomeTab)
export function thirtySummary(state, todayKey = localKey()) {
  const rungs = ladder(todayKey);
  const tasks = (r) => rows(state, r.key).filter(x => !x.h && !x.t && String(x.text || '').trim());
  const life = rungs.find(r => r.key === 'life');
  const week = rungs.find(r => r.week);
  const wt = week ? tasks(week) : [];
  const due = reviewDue(state, todayKey);
  const need = due ? (due === weekStart(todayKey) ? 'WEEKLY REVIEW' : 'REVIEW LAST WEEK')
    : life && !rows(state, 'life').length ? 'SET YOUR 30 GOALS' : week && !wt.length ? 'PLAN THIS WEEK' : null;
  const all = rungs.flatMap(tasks);
  return { m: monthOf(todayKey), total: rungs.length, need, wN: wt.length, wDone: wt.filter(x => x.done).length, n: all.length, done: all.filter(x => x.done).length };
}
export function thirtySummaryLine(sum) {
  if (sum.m > 8 || !sum.total) return '';
  return ['Road to 30', sum.wN ? `This week ${sum.wDone}/${sum.wN} done` : '', sum.n ? `${sum.done}/${sum.n} overall` : ''].filter(Boolean).join(' · ');
}

export const THIRTY_CSS = `<style id="thirty-css">
.nh .nh-bday-tap { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-30-foot { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-30-foot-t { font-size:12px; font-weight:800; color:var(--nh-sub) !important; line-height:1.4; }
.nh .nh-30-chev { font-size:16px; font-weight:900; color:var(--nh-gold) !important; transition:transform .2s; }
.nh .nh-30-chev.open { transform:rotate(180deg); }
.nh .nh-30-need { font-size:10px; font-weight:900; letter-spacing:1px; padding:5px 9px; border-radius:20px; background:var(--nh-gold); color:#000 !important; white-space:nowrap; animation:nhFlash 1.6s ease-in-out infinite; }
.nh .nh-30 { margin-top:16px; }
.nh .nh-30-ladder { position:relative; display:flex; flex-direction:column; gap:18px; padding-left:22px; }
.nh .nh-30-ladder::before { content:''; position:absolute; left:6px; top:6px; bottom:6px; width:2px; background:linear-gradient(var(--nh-gold), var(--nh-line)); border-radius:1px; }
.nh .nh-30-rung { position:relative; }
.nh .nh-30-node { position:absolute; left:-22px; top:2px; width:14px; height:14px; border-radius:50%; border:2px solid var(--nh-gold); background:var(--nh-card, #fff); }
.nh .nh-30-rung.top .nh-30-node, .nh .nh-30-rung.now .nh-30-node { background:var(--nh-gold); }
.nh .nh-30-rung.now .nh-30-node { box-shadow:0 0 0 4px rgba(201,168,76,0.25); }
.nh .nh-30-sec-h { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:8px; }
.nh .nh-30-sec-t { font-size:11px; font-weight:900; letter-spacing:1.5px; color:var(--nh-text) !important; }
.nh .nh-30-sec-s { font-size:11px; font-weight:700; color:var(--nh-muted) !important; text-align:right; }
.nh .nh-30-rows { display:flex; flex-direction:column; border:1px solid var(--nh-line); border-radius:12px; padding:4px 10px; }
.nh .nh-30-row { display:flex; align-items:flex-start; gap:8px; padding:4px 0; }
.nh .nh-30-row.h { padding-top:10px; }
.nh .nh-30-chk { flex:0 0 24px; height:24px; margin-top:6px; border-radius:7px; border:2px solid var(--nh-line); background:transparent; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:900; color:#fff !important; cursor:pointer; padding:0; }
.nh .nh-30-chk.on { background:var(--nh-green); border-color:var(--nh-green); }
.nh .nh-30-main { flex:1; min-width:0; }
.nh .nh-30-in { display:block; width:100%; box-sizing:border-box; border:0 !important; background:transparent !important; color:var(--nh-text) !important; font:inherit; font-size:15px; line-height:1.4; padding:6px 0; resize:none; overflow:hidden; -webkit-appearance:none; appearance:none; }
.nh .nh-30-in:focus { outline:none; }
.nh .nh-30-in::placeholder { color:var(--nh-muted); opacity:0.8; }
.nh .nh-30-row.t .nh-30-in { font-size:14px; color:var(--nh-sub) !important; }
.nh .nh-30-row.h .nh-30-in { font-size:11px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; color:var(--nh-gold) !important; }
.nh .nh-30-row.done .nh-30-in { text-decoration:line-through; color:var(--nh-muted) !important; }
.nh .nh-30-meta { display:inline-block; font-size:11px; font-weight:800; color:var(--nh-green) !important; margin-bottom:4px; cursor:pointer; background:none; border:0; padding:0; text-align:left; line-height:1.4; }
.nh .nh-30-meta span { color:var(--nh-muted) !important; font-weight:700; }
.nh .nh-30-det { display:flex; flex-direction:column; gap:6px; margin:4px 0 8px; padding:8px; border-radius:10px; background:rgba(127,127,127,0.08); }
.nh .nh-30-det label { font-size:10px; font-weight:900; letter-spacing:1.2px; color:var(--nh-muted) !important; }
.nh .nh-30-det input, .nh .nh-30-det textarea { width:100%; box-sizing:border-box; border:1px solid var(--nh-line) !important; border-radius:8px; background:transparent !important; color:var(--nh-text) !important; font:inherit; font-size:14px; padding:8px 10px; -webkit-appearance:none; appearance:none; }
.nh .nh-30-det textarea { min-height:60px; resize:vertical; }
.nh .nh-30-x { flex:0 0 28px; height:28px; margin-top:4px; border:0; background:transparent; font-size:16px; color:var(--nh-muted) !important; cursor:pointer; padding:0; }
.nh .nh-30-hist-btn { width:100%; margin-top:18px; height:40px; border-radius:10px; border:1px solid var(--nh-line); background:transparent; font-size:13px; font-weight:800; color:var(--nh-sub) !important; cursor:pointer; }
.nh .nh-30-hist { display:flex; flex-direction:column; gap:14px; margin-top:12px; }
.nh .nh-30-past { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; opacity:0.92; }
.nh .nh-30-past-h { display:flex; justify-content:space-between; gap:8px; font-size:11px; font-weight:900; letter-spacing:1.2px; color:var(--nh-text) !important; margin-bottom:6px; }
.nh .nh-30-past-h span { color:var(--nh-muted) !important; letter-spacing:0; font-weight:700; }
.nh .nh-30-pr { font-size:14px; line-height:1.4; padding:3px 0; color:var(--nh-text) !important; white-space:pre-wrap; word-break:break-word; }
.nh .nh-30-pr.h { font-size:11px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; color:var(--nh-gold) !important; padding-top:8px; }
.nh .nh-30-pr.t { color:var(--nh-sub) !important; }
.nh .nh-30-pr.c { display:flex; gap:8px; }
.nh .nh-30-pr.c b { flex:0 0 18px; font-weight:900; }
.nh .nh-30-pr.c.done b { color:var(--nh-green) !important; } .nh .nh-30-pr.c.miss b { color:var(--nh-muted) !important; }
.nh .nh-30-pr.c.miss { color:var(--nh-muted) !important; }
.nh .nh-30-pr small { display:block; font-size:11px; font-weight:700; color:var(--nh-muted) !important; }
.nh .nh-30-metas { display:flex; flex-wrap:wrap; gap:4px 12px; }
.nh .nh-30-meta.when { color:var(--nh-muted) !important; font-weight:700; }
.nh .nh-30-meta.when.set { color:var(--nh-gold) !important; font-weight:800; }
.nh .nh-30-det select, .nh .nh-30-det input[type=time] { flex:1; min-width:0; height:38px; border:1px solid var(--nh-line) !important; border-radius:8px; background:transparent !important; color:var(--nh-text) !important; font:inherit; font-size:14px; padding:0 8px; -webkit-appearance:none; appearance:none; }
.nh .nh-30-rev { border:1px solid var(--nh-gold); border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
.nh .nh-30-rev-h { font-size:12px; font-weight:900; letter-spacing:1.2px; color:var(--nh-gold) !important; }
.nh .nh-30-rev label { font-size:10px; font-weight:900; letter-spacing:1.2px; color:var(--nh-muted) !important; margin-top:4px; }
.nh .nh-30-rev textarea { width:100%; box-sizing:border-box; min-height:52px; border:1px solid var(--nh-line) !important; border-radius:8px; background:transparent !important; color:var(--nh-text) !important; font:inherit; font-size:14px; padding:8px 10px; resize:vertical; -webkit-appearance:none; appearance:none; }
.nh .nh-30-rev-sum { font-size:12px; font-weight:700; color:var(--nh-sub) !important; }
.nh .nh-30-trend { margin-top:20px; }
.nh .nh-30-bars { display:flex; align-items:flex-end; gap:6px; height:78px; margin-top:8px; }
.nh .nh-30-bar { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:3px; min-width:0; }
.nh .nh-30-bar i { display:block; width:100%; max-width:30px; border-radius:5px 5px 2px 2px; min-height:3px; }
.nh .nh-30-bar i.cur { background:transparent !important; border:2px dashed var(--nh-gold); box-sizing:border-box; }
.nh .nh-30-bar b { font-size:10px; font-weight:900; color:var(--nh-text) !important; }
.nh .nh-30-bar span { font-size:9px; font-weight:700; color:var(--nh-muted) !important; white-space:nowrap; }
.nh .nh-30-tip { font-size:12px; line-height:1.4; margin-top:8px; color:var(--nh-sub) !important; }
.nh .nh-30-home { margin-top:12px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-30-home-h { display:flex; justify-content:space-between; font-size:10px; font-weight:900; letter-spacing:1.5px; color:var(--nh-muted) !important; margin-bottom:4px; }
.nh .nh-30-hrow { display:flex; align-items:center; gap:10px; padding:5px 0; }
.nh .nh-30-hrow .nh-30-chk { margin-top:0; }
.nh .nh-30-hrow-t { flex:1; min-width:0; font-size:14px; font-weight:700; line-height:1.3; color:var(--nh-text) !important; }
.nh .nh-30-hrow.done .nh-30-hrow-t { text-decoration:line-through; color:var(--nh-muted) !important; }
.nh .nh-30-hrow-w { font-size:11px; font-weight:800; color:var(--nh-muted) !important; white-space:nowrap; }
.nh .nh-30-hrow-w.today { color:var(--nh-gold) !important; }
.nh .nh-30-adds { display:flex; gap:8px; padding:6px 0 4px; }
.nh .nh-30-add { flex:1; height:34px; border-radius:9px; border:1px dashed var(--nh-line); background:transparent; font-size:12px; font-weight:800; color:var(--nh-sub) !important; cursor:pointer; }
</style>`;

function renderRow(state, key, x, i, isWeek = false) {
  if (x.t) return `
    <div class="nh-30-row t">
      <div class="nh-30-main"><textarea rows="1" class="nh-30-in" id="t30-${x.id}" placeholder="Write anything…" oninput="thirtyText('${key}','${x.id}',this)" onkeydown="thirtyKey(event,'${key}','${x.id}')">${esc(x.text)}</textarea></div>
      <button class="nh-30-x" aria-label="Delete text" onclick="thirtyDel('${key}','${x.id}')">✕</button>
    </div>`;
  if (x.h) return `
    <div class="nh-30-row h">
      <div class="nh-30-main"><textarea rows="1" class="nh-30-in" id="t30-${x.id}" placeholder="Heading" oninput="thirtyText('${key}','${x.id}',this)" onkeydown="thirtyKey(event,'${key}','${x.id}')">${esc(x.text)}</textarea></div>
      <button class="nh-30-x" aria-label="Delete heading" onclick="thirtyDel('${key}','${x.id}')">✕</button>
    </div>`;
  const open = state.thirtyOpenItem === x.id;
  const when = whenTxt(x);
  const whenBtn = isWeek ? `<button class="nh-30-meta when ${when ? 'set' : ''}" onclick="thirtyDetails('${x.id}')">${when ? '🗓 ' + esc(when) : '+ day/time'}</button>` : '';
  const meta = x.done ? `<button class="nh-30-meta" onclick="thirtyDetails('${x.id}')">✓ Done ${x.doneAt ? fmt(x.doneAt) : ''}${x.note ? ' · <span>' + esc(x.note.length > 40 ? x.note.slice(0, 40) + '…' : x.note) + '</span>' : ' · <span>add note</span>'}</button>` : '';
  const whenDet = isWeek ? `
        <label>WHEN WILL YOU DO IT?</label>
        <div style="display:flex;gap:6px;">
          <select id="t30w-${x.id}" onchange="thirtyField('${key}','${x.id}','day',this.value)"><option value="">Day</option>${DAYS.map((d, n) => `<option value="${n}" ${x.day !== '' && x.day != null && +x.day === n ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <input id="t30t-${x.id}" type="time" value="${esc(x.time || '')}" onchange="thirtyField('${key}','${x.id}','time',this.value)">
        </div>` : '';
  const det = open && (x.done || isWeek) ? `
      <div class="nh-30-det">${whenDet}${x.done ? `
        <label for="t30d-${x.id}">COMPLETED ON</label>
        <input id="t30d-${x.id}" type="date" value="${esc(x.doneAt || '')}" onchange="thirtyField('${key}','${x.id}','doneAt',this.value)">
        <label for="t30n-${x.id}">COMPLETION NOTES</label>
        <textarea id="t30n-${x.id}" placeholder="How did it go?" oninput="thirtyField('${key}','${x.id}','note',this.value,true)">${esc(x.note || '')}</textarea>` : ''}
      </div>` : '';
  return `
    <div class="nh-30-row ${x.done ? 'done' : ''}">
      <button class="nh-30-chk ${x.done ? 'on' : ''}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}" onclick="thirtyTick('${key}','${x.id}')">${x.done ? '✓' : ''}</button>
      <div class="nh-30-main">
        <textarea rows="1" class="nh-30-in" id="t30-${x.id}" placeholder="New item" oninput="thirtyText('${key}','${x.id}',this)" onkeydown="thirtyKey(event,'${key}','${x.id}')">${esc(x.text)}</textarea>
        <div class="nh-30-metas">${whenBtn}${meta}</div>${det}
      </div>
      <button class="nh-30-x" aria-label="Delete item" onclick="thirtyDel('${key}','${x.id}')">✕</button>
    </div>`;
}

// Steps whose date has passed (newest first)
function keyEnd(k) {
  if (k === 'life') return BIRTHDAY;
  const [t, v] = k.split(':');
  return t === 'q' ? quarterRange(+v).end : t === 'm' ? monthRange(+v).end : t === 'w' ? addDaysKey(v, 7) : null;
}
function pastSteps(state, todayKey) {
  const items = state.data?.thirtyPlan?.items || {};
  const live = new Set(ladder(todayKey).map(r => r.key));
  return Object.keys(items)
    .filter(k => !live.has(k) && Array.isArray(items[k]) && items[k].some(x => String(x.text || '').trim()))
    .map(k => ({ k, end: keyEnd(k) })).filter(x => x.end && x.end <= todayKey)
    .sort((a, b) => b.end.localeCompare(a.end) || (a.k.startsWith('w') ? 1 : -1));
}
function renderHistory(state, todayKey) {
  const past = pastSteps(state, todayKey);
  if (!past.length) return '';
  const open = !!state.thirtyHistOpen;
  const body = !open ? '' : `<div class="nh-30-hist">${past.map(({ k, end }) => {
    const list = state.data.thirtyPlan.items[k].filter(x => String(x.text || '').trim());
    const boxes = list.filter(x => !x.h && !x.t);
    const title = k.startsWith('w:') ? `WEEK OF ${fmt(k.slice(2)).toUpperCase()}` : `BY ${fmtY(end).toUpperCase()}`;
    return `<div class="nh-30-past">
      <div class="nh-30-past-h">${title}${boxes.length ? `<span>${boxes.filter(x => x.done).length}/${boxes.length} done</span>` : ''}</div>
      ${list.map(x => x.h ? `<div class="nh-30-pr h">${esc(x.text)}</div>`
        : x.t ? `<div class="nh-30-pr t">${esc(x.text)}</div>`
        : `<div class="nh-30-pr c ${x.done ? 'done' : 'miss'}"><b>${x.done ? '✓' : '–'}</b><div>${esc(x.text)}${x.done ? `<small>Done ${x.doneAt ? fmt(x.doneAt) : ''}${x.note ? ' · ' + esc(x.note) : ''}</small>` : ''}</div></div>`).join('')}
      ${(() => { const rv = k.startsWith('w:') ? reviews(state)[k.slice(2)] : null; if (!rv || !(rv.done || rv.missed || rv.next)) return '';
        return `<div class="nh-30-pr h">Review</div>${rv.done ? `<div class="nh-30-pr t"><b>Done:</b> ${esc(rv.done)}</div>` : ''}${rv.missed ? `<div class="nh-30-pr t"><b>Didn’t:</b> ${esc(rv.missed)}</div>` : ''}${rv.next ? `<div class="nh-30-pr t"><b>Next priority:</b> ${esc(rv.next)}</div>` : ''}`; })()}
    </div>`;
  }).join('')}</div>`;
  return `<button class="nh-30-hist-btn" onclick="thirtyHist()">${open ? 'Hide past steps ▴' : `Past steps (${past.length}) ▾`}</button>${body}`;
}

function renderReview(state, wk, todayKey) {
  const rv = reviews(state)[wk] || {};
  const boxes = boxesOf(state.data?.thirtyPlan?.items?.['w:' + wk]);
  const done = boxes.filter(x => x.done).length;
  const last = wk !== weekStart(todayKey);
  const ta = (f, ph) => `<textarea id="t30r-${f}" placeholder="${ph}" oninput="thirtyReview('${wk}','${f}',this.value)">${esc(rv[f] || '')}</textarea>`;
  return `<div class="nh-30-rev">
    <div class="nh-30-rev-h">${last ? 'REVIEW LAST WEEK' : 'WEEKLY REVIEW'} · W/C ${fmt(wk).toUpperCase()}</div>
    ${boxes.length ? `<div class="nh-30-rev-sum">${done} of ${boxes.length} ticked (${Math.round(done / boxes.length * 100)}%)</div>` : ''}
    <label>WHAT GOT DONE?</label>${ta('done', 'Wins, progress…')}
    <label>WHAT DIDN’T, AND WHY?</label>${ta('missed', 'Be honest — too much planned, blocked, avoided?')}
    <label>ONE PRIORITY FOR NEXT WEEK</label>${ta('next', 'The one thing that moves you closest to 30')}
    <div style="display:flex;justify-content:flex-end;margin-top:4px;"><button class="nh-30-add" style="flex:0 0 auto;padding:0 16px;border-style:solid;background:#C9A84C;color:#000 !important;border-color:#C9A84C;" onclick="thirtyReviewDone('${wk}')">Save review</button></div>
  </div>`;
}
function weekStats(state, todayKey) {
  const items = state.data?.thirtyPlan?.items || {};
  const cur = weekStart(todayKey);
  const out = [];
  for (let n = 7; n >= 0; n--) {
    const wk = addDaysKey(cur, -7 * n);
    const b = boxesOf(items['w:' + wk]);
    out.push({ wk, n: b.length, done: b.filter(x => x.done).length, cur: n === 0 });
  }
  return out;
}
function renderTrend(state, todayKey) {
  const st = weekStats(state, todayKey);
  const past = st.filter(w => !w.cur && w.n);
  if (!past.length && !st[st.length - 1].n) return '';
  const pct = (w) => w.n ? Math.round(w.done / w.n * 100) : null;
  const col = (p) => p == null ? 'var(--nh-line)' : p >= 80 ? 'var(--nh-green)' : p >= 60 ? 'var(--nh-gold)' : 'var(--nh-red)';
  const avg = past.length ? Math.round(past.reduce((a, w) => a + w.done / w.n, 0) / past.length * 100) : null;
  const last3 = past.slice(-3);
  const tip = past.length >= 2 && avg < 60 ? `Averaging ${avg}%. You’re planning more than you’re doing — put fewer checkboxes in each week.`
    : last3.length === 3 && last3.every(w => w.done === w.n) ? '100% three weeks running. Stretch the weeks a bit more.'
    : avg != null ? `Average ${avg}% over ${past.length} week${past.length === 1 ? '' : 's'}. 60–90% is the sweet spot.` : '';
  return `<div class="nh-30-trend">
    <div class="nh-30-sec-h"><span class="nh-30-sec-t">WEEKLY FOLLOW-THROUGH</span><span class="nh-30-sec-s">% of checkboxes ticked</span></div>
    <div class="nh-30-bars">${st.map(w => { const p = pct(w); return `<div class="nh-30-bar">
      <b>${p == null ? '' : p + '%'}</b>
      <i class="${w.cur ? 'cur' : ''}" style="height:${p == null ? 3 : Math.max(4, p * 0.48)}px;background:${col(p)}"></i>
      <span>${w.cur ? 'Now' : fmt(w.wk)}</span></div>`; }).join('')}</div>
    ${tip ? `<div class="nh-30-tip">${tip}</div>` : ''}
  </div>`;
}

// This week's checkboxes on the Home card (closed state)
export function renderThirtyWeekHome(state, todayKey = localKey()) {
  const wk = weekStart(todayKey);
  const boxes = boxesOf(rows(state, 'w:' + wk));
  if (!boxes.length) return '';
  const t = dow(todayKey);
  const order = boxes.slice().sort((a, b) => (a.done - b.done) || ((a.day === '' || a.day == null ? 9 : +a.day) - (b.day === '' || b.day == null ? 9 : +b.day)) || String(a.time || '').localeCompare(String(b.time || '')));
  return `<div class="nh-30-home" onclick="event.stopPropagation()">
    <div class="nh-30-home-h"><span>THIS WEEK</span><span>${boxes.filter(x => x.done).length}/${boxes.length} done</span></div>
    ${order.map(x => { const w = whenTxt(x); return `<div class="nh-30-hrow ${x.done ? 'done' : ''}">
      <button class="nh-30-chk ${x.done ? 'on' : ''}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}" onclick="thirtyTick('w:${wk}','${x.id}')">${x.done ? '✓' : ''}</button>
      <span class="nh-30-hrow-t">${esc(x.text)}</span>${w ? `<span class="nh-30-hrow-w ${+x.day === t && x.day !== '' && x.day != null ? 'today' : ''}">${+x.day === t && x.day !== '' && x.day != null ? 'Today' + (x.time ? ' ' + esc(x.time) : '') : esc(w)}</span>` : ''}
    </div>`; }).join('')}
  </div>`;
}

export function renderThirtyPlan(state, todayKey = localKey()) {
  const rungs = ladder(todayKey);
  const daysTo = (k) => Math.max(0, Math.round((parseKey(k) - parseKey(todayKey)) / 86400000));
  const due = reviewDue(state, todayKey);
  return `
  <div class="nh-30" onclick="event.stopPropagation()">
    ${due ? renderReview(state, due, todayKey) : ''}
    <div class="nh-30-ladder">${rungs.map((r, i) => {
      const days = r.week ? daysTo(r.end) - 1 : daysTo(r.end);
      const list = rows(state, r.key);
      return `
      <div class="nh-30-rung ${i === 0 ? 'top' : ''} ${r.week ? 'now' : ''}">
        <span class="nh-30-node"></span>
        <div class="nh-30-sec-h"><span class="nh-30-sec-t">${r.label}</span><span class="nh-30-sec-s">${rungDate(r)} · ${r.week && days === 0 ? 'last day' : `${days} day${days === 1 ? '' : 's'}${r.week ? ' left' : ''}`}</span></div>
        <div class="nh-30-rows">
          ${list.map((x, j) => renderRow(state, r.key, x, j, !!r.week)).join('')}
          <div class="nh-30-adds">
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 'h')">+ Heading</button>
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 't')">+ Text</button>
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 'c')">+ Checkbox</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>
    ${renderTrend(state, todayKey)}
    ${renderHistory(state, todayKey)}
  </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────
export function initThirtyPlan({ state, saveData, saveDataQuiet, render }) {
  const quiet = saveDataQuiet || saveData;
  let timer = null;
  const saveSoon = () => { clearTimeout(timer); timer = setTimeout(() => quiet(), 800); };
  const saveNow = () => { clearTimeout(timer); quiet(); };
  const grow = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const growAll = () => document.querySelectorAll('.nh-30-in').forEach(grow);
  const list = (key) => {
    if (!state.data.thirtyPlan || typeof state.data.thirtyPlan !== 'object') state.data.thirtyPlan = {};
    const plan = state.data.thirtyPlan;
    if (!plan.items) plan.items = {};
    if (!Array.isArray(plan.items[key])) plan.items[key] = rows(state, key).slice();
    return plan.items[key];
  };
  const item = (key, id) => list(key).find(x => x.id === id);
  const rerender = (focusId, atEnd = true) => {
    render();
    setTimeout(() => {
      growAll();
      const el = focusId && document.getElementById('t30-' + focusId);
      if (el) { el.focus({ preventScroll: false }); if (atEnd) { const n = el.value.length; el.setSelectionRange(n, n); } }
    }, 0);
  };
  const newRow = (kind) => ({ id: uid(), h: kind === 'h', t: kind === 't', text: '', done: false, doneAt: null, note: '' });

  window.toggleThirtyPlan = () => {
    state.thirtyOpen = !state.thirtyOpen; state.thirtyOpenItem = null;
    render(); if (state.thirtyOpen) setTimeout(growAll, 0);
  };
  const reviewObj = (wk) => {
    if (!state.data.thirtyPlan || typeof state.data.thirtyPlan !== 'object') state.data.thirtyPlan = {};
    const p = state.data.thirtyPlan; if (!p.reviews) p.reviews = {};
    if (!p.reviews[wk]) p.reviews[wk] = { done: '', missed: '', next: '', at: null };
    return p.reviews[wk];
  };
  window.thirtyReview = (wk, f, v) => { reviewObj(wk)[f] = v; saveSoon(); };
  window.thirtyReviewDone = (wk) => {
    const r = reviewObj(wk);
    ['done', 'missed', 'next'].forEach(f => { const el = document.getElementById('t30r-' + f); if (el) r[f] = el.value; });
    r.at = Date.now(); saveNow(); render();
  };
  window.thirtyHist = () => { state.thirtyHistOpen = !state.thirtyHistOpen; render(); };
  window.thirtyAdd = (key, kind) => { const r = newRow(kind); list(key).push(r); saveNow(); rerender(r.id); };
  // Text paragraphs keep line breaks; headings and checkboxes are single-line
  window.thirtyText = (key, id, el) => { const x = item(key, id); if (!x) return; x.text = x.t ? el.value : el.value.replace(/\n/g, ' '); grow(el); saveSoon(); };
  window.thirtyKey = (e, key, id) => {
    const l = list(key), i = l.findIndex(x => x.id === id); if (i < 0) return;
    if (e.key === 'Enter' && !l[i].t) {
      e.preventDefault();
      const r = newRow('c'); l.splice(i + 1, 0, r); saveNow(); rerender(r.id);
    } else if (e.key === 'Backspace' && !e.target.value) {
      e.preventDefault();
      l.splice(i, 1); saveNow();
      const prev = l[i - 1]; rerender(prev ? prev.id : null);
    }
  };
  window.thirtyDel = (key, id) => {
    const l = list(key), i = l.findIndex(x => x.id === id); if (i < 0) return;
    const x = l[i];
    if ((x.text || x.note) && !confirm('Delete this ' + (x.h ? 'heading' : x.t ? 'text' : 'item') + '?')) return;
    l.splice(i, 1); saveNow(); rerender(null);
  };
  window.thirtyTick = (key, id) => {
    const x = item(key, id); if (!x) return;
    x.done = !x.done;
    if (x.done) { x.doneAt = localKey(); state.thirtyOpenItem = null; }
    else { x.doneAt = null; if (state.thirtyOpenItem === id) state.thirtyOpenItem = null; }
    saveNow(); rerender(null);
  };
  window.thirtyDetails = (id) => {
    state.thirtyOpenItem = state.thirtyOpenItem === id ? null : id;
    render();
    setTimeout(() => { growAll(); const n = document.getElementById('t30n-' + id); if (n && state.thirtyOpenItem === id && !n.value) n.focus(); }, 0);
  };
  window.thirtyField = (key, id, f, v, soft = false) => {
    const x = item(key, id); if (!x) return;
    x[f] = f === 'doneAt' ? (v || localKey()) : v;
    if (f === 'day' || f === 'time') { saveNow(); render(); setTimeout(growAll, 0); return; }
    if (soft) saveSoon(); else { saveNow(); rerender(null); }
  };
  // Re-size rows after any re-render of Home
  new MutationObserver(() => { if (state.thirtyOpen) growAll(); })
    .observe(document.body, { childList: true, subtree: true });
}
