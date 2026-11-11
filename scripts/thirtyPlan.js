// ── ROAD TO 30 ──────────────────────────────────────────────────────────────
// Tap the "Until 30" card on Home to open the plan.
//
// Reverse-engineered ladder (work backwards from 30, Paul McKenna style):
//   AT 30 (12 Aug 2027)  →  3 months before (12 May)  →  6 months before (12 Feb)
//   →  each month's 12th between now and the next quarter mark  →  THIS WEEK (Mon–Sun).
//   Today (Nov 2026) that's: 12 Aug · 12 May · 12 Feb · 12 Jan · 12 Dec · this week.
//   The ladder rolls forward by itself as dates pass (ladder() below).
//
// Each rung is just a free-text box — write your own headings and notes.
// Saved as you type (debounced, quiet save — no re-render, so the keyboard stays up).
//
// Data: state.data.thirtyPlan.notes = { 'life': text, 'q:1': text, 'm:0': text, 'w:2026-11-09': text }
//   q = quarter mark (0 → 12 Feb, 1 → 12 May) · m = month index (0 → 12 Dec … 8 → 12 Aug)
//   w = Monday of the week. (Older structured goals in thirtyPlan.goals are left untouched.)

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

function notes(state) { return state.data?.thirtyPlan?.notes || {}; }
const filled = (t) => !!String(t || '').trim();

// Collapsed-card summary (used by renderHomeTab)
export function thirtySummary(state, todayKey = localKey()) {
  const n = notes(state);
  const rungs = ladder(todayKey);
  const life = rungs.find(r => r.key === 'life');
  const week = rungs.find(r => r.week);
  const need = rungs.length && !filled(n.life) ? 'SET YOUR 30 GOALS' : week && !filled(n[week.key]) ? 'PLAN THIS WEEK' : null;
  return { m: monthOf(todayKey), done: rungs.filter(r => filled(n[r.key])).length, total: rungs.length, need, life };
}
export function thirtySummaryLine(sum) {
  if (sum.m > 8 || !sum.total) return '';
  return `Road to 30 · ${sum.done} of ${sum.total} steps written`;
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
.nh .nh-30-txt { display:block; width:100%; box-sizing:border-box; min-height:88px; border-radius:12px; border:1px solid var(--nh-line) !important; background:transparent !important; color:var(--nh-text) !important; padding:10px 12px; font:inherit; font-size:15px; line-height:1.45; resize:none; overflow:hidden; -webkit-appearance:none; appearance:none; }
.nh .nh-30-txt:focus { outline:none; border-color:var(--nh-gold) !important; }
.nh .nh-30-txt::placeholder { color:var(--nh-muted); opacity:0.8; }
</style>`;

export function renderThirtyPlan(state, todayKey = localKey()) {
  const n = notes(state);
  const rungs = ladder(todayKey);
  const daysTo = (k) => Math.max(0, Math.round((parseKey(k) - parseKey(todayKey)) / 86400000));
  return `
  <div class="nh-30" onclick="event.stopPropagation()">
    <div class="nh-30-ladder">${rungs.map((r, i) => {
      const days = r.week ? daysTo(r.end) - 1 : daysTo(r.end);
      const ph = i === 0 ? 'Who are you at 30?' : r.week ? 'This week…' : `By ${fmt(r.end)}…`;
      return `
      <div class="nh-30-rung ${i === 0 ? 'top' : ''} ${r.week ? 'now' : ''}">
        <span class="nh-30-node"></span>
        <div class="nh-30-sec-h"><span class="nh-30-sec-t">${r.label}</span><span class="nh-30-sec-s">${rungDate(r)} · ${days} day${days === 1 ? '' : 's'}${r.week ? ' left' : ''}</span></div>
        <textarea class="nh-30-txt" data-key="${r.key}" placeholder="${esc(ph)}" oninput="thirtyNote(this)">${esc(n[r.key] || '')}</textarea>
      </div>`;
    }).join('')}</div>
  </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────
export function initThirtyPlan({ state, saveData, saveDataQuiet, render }) {
  const quiet = saveDataQuiet || saveData;
  let timer = null;
  const grow = (el) => { el.style.height = 'auto'; el.style.height = Math.max(88, el.scrollHeight + 2) + 'px'; };
  const growAll = () => document.querySelectorAll('.nh-30-txt').forEach(grow);

  window.toggleThirtyPlan = () => {
    state.thirtyOpen = !state.thirtyOpen; render();
    if (state.thirtyOpen) setTimeout(growAll, 0);
  };
  window.thirtyNote = (el) => {
    if (!state.data.thirtyPlan || typeof state.data.thirtyPlan !== 'object') state.data.thirtyPlan = {};
    if (!state.data.thirtyPlan.notes) state.data.thirtyPlan.notes = {};
    state.data.thirtyPlan.notes[el.dataset.key] = el.value;
    grow(el);
    clearTimeout(timer);
    timer = setTimeout(() => quiet(), 800);
  };
  // Re-size boxes after any re-render of Home
  new MutationObserver(() => { if (state.thirtyOpen) growAll(); })
    .observe(document.body, { childList: true, subtree: true });
}
