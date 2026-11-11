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

// Collapsed-card summary (used by renderHomeTab)
export function thirtySummary(state, todayKey = localKey()) {
  const rungs = ladder(todayKey);
  const tasks = (r) => rows(state, r.key).filter(x => !x.h && !x.t && String(x.text || '').trim());
  const life = rungs.find(r => r.key === 'life');
  const week = rungs.find(r => r.week);
  const wt = week ? tasks(week) : [];
  const need = life && !rows(state, 'life').length ? 'SET YOUR 30 GOALS' : week && !wt.length ? 'PLAN THIS WEEK' : null;
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
.nh .nh-30-adds { display:flex; gap:8px; padding:6px 0 4px; }
.nh .nh-30-add { flex:1; height:34px; border-radius:9px; border:1px dashed var(--nh-line); background:transparent; font-size:12px; font-weight:800; color:var(--nh-sub) !important; cursor:pointer; }
</style>`;

function renderRow(state, key, x, i) {
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
  const meta = x.done ? `<button class="nh-30-meta" onclick="thirtyDetails('${x.id}')">✓ Done ${x.doneAt ? fmt(x.doneAt) : ''}${x.note ? ' · <span>' + esc(x.note.length > 40 ? x.note.slice(0, 40) + '…' : x.note) + '</span>' : ' · <span>add note</span>'}</button>` : '';
  const det = x.done && open ? `
      <div class="nh-30-det">
        <label for="t30d-${x.id}">COMPLETED ON</label>
        <input id="t30d-${x.id}" type="date" value="${esc(x.doneAt || '')}" onchange="thirtyField('${key}','${x.id}','doneAt',this.value)">
        <label for="t30n-${x.id}">COMPLETION NOTES</label>
        <textarea id="t30n-${x.id}" placeholder="How did it go?" oninput="thirtyField('${key}','${x.id}','note',this.value,true)">${esc(x.note || '')}</textarea>
      </div>` : '';
  return `
    <div class="nh-30-row ${x.done ? 'done' : ''}">
      <button class="nh-30-chk ${x.done ? 'on' : ''}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}" onclick="thirtyTick('${key}','${x.id}')">${x.done ? '✓' : ''}</button>
      <div class="nh-30-main">
        <textarea rows="1" class="nh-30-in" id="t30-${x.id}" placeholder="New item" oninput="thirtyText('${key}','${x.id}',this)" onkeydown="thirtyKey(event,'${key}','${x.id}')">${esc(x.text)}</textarea>
        ${meta}${det}
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
    </div>`;
  }).join('')}</div>`;
  return `<button class="nh-30-hist-btn" onclick="thirtyHist()">${open ? 'Hide past steps ▴' : `Past steps (${past.length}) ▾`}</button>${body}`;
}

export function renderThirtyPlan(state, todayKey = localKey()) {
  const rungs = ladder(todayKey);
  const daysTo = (k) => Math.max(0, Math.round((parseKey(k) - parseKey(todayKey)) / 86400000));
  return `
  <div class="nh-30" onclick="event.stopPropagation()">
    <div class="nh-30-ladder">${rungs.map((r, i) => {
      const days = r.week ? daysTo(r.end) - 1 : daysTo(r.end);
      const list = rows(state, r.key);
      return `
      <div class="nh-30-rung ${i === 0 ? 'top' : ''} ${r.week ? 'now' : ''}">
        <span class="nh-30-node"></span>
        <div class="nh-30-sec-h"><span class="nh-30-sec-t">${r.label}</span><span class="nh-30-sec-s">${rungDate(r)} · ${days} day${days === 1 ? '' : 's'}${r.week ? ' left' : ''}</span></div>
        <div class="nh-30-rows">
          ${list.map((x, j) => renderRow(state, r.key, x, j)).join('')}
          <div class="nh-30-adds">
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 'h')">+ Heading</button>
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 't')">+ Text</button>
            <button class="nh-30-add" onclick="thirtyAdd('${r.key}', 'c')">+ Checkbox</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>
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
    if (soft) saveSoon(); else { saveNow(); rerender(null); }
  };
  // Re-size rows after any re-render of Home
  new MutationObserver(() => { if (state.thirtyOpen) growAll(); })
    .observe(document.body, { childList: true, subtree: true });
}
