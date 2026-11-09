// ── SHOP LEASE JOURNEY ─────────────────────────────────────────────────────
// Tap the Shop lease card on Home to open it. Inside:
//   • Quarterly check-in (mandatory): one per lease quarter, 20 in total.
//     Where I am in personal life, where I am in business, plans for the
//     quarter ahead. Flashes red on the card until the current quarter's
//     check-in is written. Missed past quarters can be filled in late.
//   • Journal entries: pick any date, optional title, free text.
//   • Timeline grouped by lease quarter, newest first. Only the current
//     quarter is open by default; entries show a 2-line preview until tapped.
//   • Every entry can be edited or deleted (two-step confirm).
//
// Data: state.data.leaseJournal = [{ id, date, kind:'note'|'checkin', q,
//   title, text, personal, business, plans, createdAt, updatedAt }]
//   q = lease quarter index (0–19), -1 = before the lease, worked out from date.
// In-progress typing is kept in state.leaseDraft + localStorage('leaseDraft')
// so a background re-render (health sync, saves) never wipes what you typed.

export const LEASE_START = '2026-09-24';
export const LEASE_END = '2031-09-24';
const QUARTERS = 20;

function localKey(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function parseKey(k) { return new Date(k + 'T12:00:00'); }
function addMonthsKey(k, n) { const d = parseKey(k); d.setMonth(d.getMonth() + n); return localKey(d); }
function esc(v = '') {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmtLong = (k) => parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (k) => parseKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtYear = (k) => parseKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function quarterStart(q) { return addMonthsKey(LEASE_START, 3 * q); }
export function quarterEnd(q) { return addMonthsKey(LEASE_START, 3 * (q + 1)); }
export function quarterOf(dateKey) {
  if (!dateKey || dateKey < LEASE_START) return -1;
  let q = 0;
  while (q < QUARTERS - 1 && quarterEnd(q) <= dateKey) q++;
  return q;
}
function quarterRange(q) {
  if (q < 0) return 'Before 24 Sep 2026';
  // quarter end date is the first day of the next quarter, so show the day before
  const e = parseKey(quarterEnd(q)); e.setDate(e.getDate() - 1);
  return `${fmtShort(quarterStart(q))} – ${fmtYear(localKey(e))}`;
}

function entries(state) {
  const list = Array.isArray(state.data?.leaseJournal) ? state.data.leaseJournal : [];
  return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
}
function checkinFor(list, q) { return list.find(e => e.kind === 'checkin' && e.q === q); }

// Summary for the collapsed card (used by renderHomeTab)
export function leaseJourneyStatus(state, todayKey = localKey()) {
  const list = entries(state);
  const curQ = quarterOf(todayKey);
  const due = curQ >= 0 && !checkinFor(list, curQ);
  const missed = [];
  for (let q = 0; q < curQ; q++) if (!checkinFor(list, q)) missed.push(q);
  return { count: list.length, curQ, due, missed };
}

export const LEASE_JOURNEY_CSS = `<style id="lease-journey-css">
.nh .nh-lease-tap { cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-lease-foot { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,106,43,0.2); }
.nh .nh-lease-foot-t { font-size:12px; font-weight:800; color:#C9A797 !important; }
.nh .nh-lease-foot-c { font-size:16px; font-weight:900; color:#FF8A5C !important; transition:transform .2s; }
.nh .nh-lease-foot-c.open { transform:rotate(180deg); }
.nh .nh-lj-due-pill { font-size:10px; font-weight:900; letter-spacing:1px; padding:5px 9px; border-radius:20px; background:#EF4444; color:#fff !important; animation:nhFlash 1.6s ease-in-out infinite; white-space:nowrap; }
.nh .nh-lj { margin-top:14px; display:flex; flex-direction:column; gap:12px; }
.nh .nh-lj-due { border-radius:14px; padding:14px; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.6); }
.nh .nh-lj-due.done { background:rgba(34,197,94,0.1); border-color:rgba(34,197,94,0.45); }
.nh .nh-lj-due-h { font-size:14px; font-weight:900; color:#FFFFFF !important; }
.nh .nh-lj-due-s { font-size:12px; line-height:1.4; margin-top:4px; color:#E7CFC4 !important; }
.nh .nh-lj-due.done .nh-lj-due-h { color:#4ADE80 !important; }
.nh .nh-lj-late { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.nh .nh-lj-btn { height:40px; padding:0 14px; border-radius:10px; border:0; font-size:13px; font-weight:900; background:#FF6A2B !important; color:#000 !important; cursor:pointer; }
.nh .nh-lj-btn.red { background:#EF4444 !important; color:#fff !important; margin-top:10px; }
.nh .nh-lj-btn.ghost { background:transparent !important; border:1px solid rgba(255,106,43,0.5); color:#FF8A5C !important; }
.nh .nh-lj-btn.small { height:32px; padding:0 10px; font-size:12px; }
.nh .nh-lj-btn.danger { background:transparent !important; border:1px solid rgba(239,68,68,0.6); color:#F87171 !important; }
.nh .nh-lj-actions { display:flex; gap:8px; }
.nh .nh-lj-actions .nh-lj-btn { flex:1; }
.nh .nh-lj-form { background:rgba(255,255,255,0.05); border:1px solid rgba(255,106,43,0.3); border-radius:14px; padding:14px; display:flex; flex-direction:column; gap:10px; }
.nh .nh-lj-form-h { font-size:15px; font-weight:900; color:#FFFFFF !important; }
.nh .nh-lj-q { font-size:12px; font-weight:800; color:#FF8A5C !important; }
.nh .nh-lj-q.warn { color:#F87171 !important; }
.nh .nh-lj-lbl { font-size:10px; font-weight:900; letter-spacing:1.4px; color:#C9A797 !important; margin-bottom:5px; display:block; }
.nh .nh-lj-in { width:100%; border-radius:10px; border:1px solid rgba(255,106,43,0.25) !important; background:#0E0704 !important; color:#FFFFFF !important; padding:11px 12px; font:inherit; font-size:15px; -webkit-appearance:none; appearance:none; }
.nh .nh-lj-in::placeholder { color:rgba(255,255,255,0.35) !important; }
.nh textarea.nh-lj-in { min-height:110px; line-height:1.5; resize:vertical; }
.nh input[type=date].nh-lj-in { color-scheme:dark; min-height:44px; }
.nh .nh-lj-row { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
.nh .nh-lj-confirm { font-size:12px; font-weight:800; color:#F87171 !important; width:100%; text-align:right; }
.nh .nh-lj-qh { display:flex; justify-content:space-between; align-items:center; gap:8px; width:100%; background:transparent; border:0; padding:8px 0; cursor:pointer; text-align:left; border-bottom:1px solid rgba(255,106,43,0.18); }
.nh .nh-lj-qh-t { font-size:13px; font-weight:900; letter-spacing:0.5px; color:#FFFFFF !important; }
.nh .nh-lj-qh-s { font-size:11px; font-weight:700; color:#9C7F72 !important; margin-top:2px; }
.nh .nh-lj-qh-c { font-size:12px; font-weight:900; color:#FF8A5C !important; white-space:nowrap; }
.nh .nh-lj-tl { position:relative; margin:10px 0 4px 6px; padding-left:20px; display:flex; flex-direction:column; gap:10px; }
.nh .nh-lj-tl::before { content:''; position:absolute; left:4px; top:6px; bottom:6px; width:2px; background:rgba(255,106,43,0.25); border-radius:1px; }
.nh .nh-lj-item { position:relative; background:rgba(255,255,255,0.04); border-radius:12px; padding:10px 12px; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-lj-item::before { content:''; position:absolute; left:-20px; top:14px; width:10px; height:10px; border-radius:50%; background:#160B07; border:2px solid #FF6A2B; }
.nh .nh-lj-item.ci { background:rgba(255,106,43,0.1); border:1px solid rgba(255,106,43,0.35); }
.nh .nh-lj-item.ci::before { background:#FF6A2B; width:12px; height:12px; left:-21px; top:13px; }
.nh .nh-lj-meta { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.nh .nh-lj-date { font-size:11px; font-weight:800; letter-spacing:0.5px; color:#C9A797 !important; }
.nh .nh-lj-tag { font-size:9px; font-weight:900; letter-spacing:1.2px; padding:3px 7px; border-radius:20px; background:#FF6A2B; color:#000 !important; }
.nh .nh-lj-title { font-size:15px; font-weight:900; margin-top:4px; line-height:1.3; color:#FFFFFF !important; }
.nh .nh-lj-body { font-size:13px; line-height:1.5; margin-top:4px; color:#E7CFC4 !important; white-space:pre-wrap; word-break:break-word; }
.nh .nh-lj-item:not(.open) .nh-lj-body { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.nh .nh-lj-sec + .nh-lj-sec { margin-top:10px; }
.nh .nh-lj-sec-k { font-size:9px; font-weight:900; letter-spacing:1.4px; margin-top:8px; color:#FF8A5C !important; }
.nh .nh-lj-item-foot { display:flex; justify-content:flex-end; margin-top:10px; }
.nh .nh-lj-empty { font-size:12px; color:#9C7F72 !important; padding:6px 0 2px; }
</style>`;

const CI_FIELDS = [
  ['personal', 'PERSONAL LIFE — WHERE I AM NOW', 'Health, relationships, home, money, how I feel…'],
  ['business', 'BUSINESS LIFE — WHERE I AM NOW', 'The shop, TJM, numbers, what’s working and what isn’t…'],
  ['plans', 'PLANS & GOALS FOR THE QUARTER AHEAD', 'What I’m going to do in the next 3 months…'],
];

function renderForm(state, list, todayKey) {
  const f = state.leaseForm;
  const d = state.leaseDraft || {};
  const isCI = f.mode === 'checkin';
  const q = quarterOf(d.date);
  const clash = isCI && q >= 0 ? list.find(e => e.kind === 'checkin' && e.q === q && e.id !== f.id) : null;
  const qTxt = !isCI ? '' : q < 0
    ? `<div class="nh-lj-q warn">This date is before the lease started. Pick a date from 24 Sep 2026.</div>`
    : clash ? `<div class="nh-lj-q warn">Q${q + 1} already has a check-in (${fmtShort(clash.date)}). Edit that one instead, or pick another date.</div>`
    : `<div class="nh-lj-q">Counts as the Q${q + 1} check-in · ${quarterRange(q)}</div>`;
  const inp = (field) => `oninput="leaseDraftInput('${field}', this.value)"`;
  const confirming = f.id && state.leaseDelete === f.id;
  return `
  <div class="nh-lj-form" onclick="event.stopPropagation()">
    <div class="nh-lj-form-h">${f.id ? 'Edit' : 'New'} ${isCI ? 'quarterly check-in' : 'entry'}</div>
    <div>
      <label class="nh-lj-lbl" for="lj-date">DATE</label>
      <input id="lj-date" class="nh-lj-in" type="date" value="${esc(d.date || todayKey)}" onchange="leaseDraftInput('date', this.value, true)">
    </div>
    ${qTxt}
    ${isCI ? CI_FIELDS.map(([k, lbl, ph]) => `
    <div>
      <label class="nh-lj-lbl" for="lj-${k}">${lbl}</label>
      <textarea id="lj-${k}" class="nh-lj-in" placeholder="${esc(ph)}" ${inp(k)}>${esc(d[k] || '')}</textarea>
    </div>`).join('') : `
    <div>
      <label class="nh-lj-lbl" for="lj-title">TITLE (OPTIONAL)</label>
      <input id="lj-title" class="nh-lj-in" type="text" placeholder="e.g. Signed the lease" value="${esc(d.title || '')}" ${inp('title')}>
    </div>
    <div>
      <label class="nh-lj-lbl" for="lj-text">WHAT HAPPENED</label>
      <textarea id="lj-text" class="nh-lj-in" placeholder="Write it down while it's fresh…" ${inp('text')}>${esc(d.text || '')}</textarea>
    </div>`}
    ${confirming ? `<div class="nh-lj-confirm">Delete this ${isCI ? 'check-in' : 'entry'} for good?</div>` : ''}
    <div class="nh-lj-row">
      ${f.id ? (confirming
        ? `<button class="nh-lj-btn ghost" onclick="leaseDeleteCancel()">Keep it</button><button class="nh-lj-btn danger" onclick="leaseDeleteConfirm()">Yes, delete</button>`
        : `<button class="nh-lj-btn danger" onclick="leaseDeleteAsk()">Delete</button>`) : ''}
      ${confirming ? '' : `<button class="nh-lj-btn ghost" onclick="leaseFormCancel()">Cancel</button>
      <button class="nh-lj-btn" onclick="leaseFormSave()">Save</button>`}
    </div>
  </div>`;
}

function renderItem(state, e) {
  const open = !!(state.leaseItemOpen && state.leaseItemOpen[e.id]);
  const isCI = e.kind === 'checkin';
  const body = isCI
    ? [['personal', 'PERSONAL LIFE'], ['business', 'BUSINESS LIFE'], ['plans', 'PLANS & GOALS FOR THE QUARTER']]
        .map(([k, lbl]) => e[k] ? `<div class="nh-lj-sec"><div class="nh-lj-sec-k">${lbl}</div><div class="nh-lj-body">${esc(e[k])}</div></div>` : '').join('')
    : (e.text ? `<div class="nh-lj-body">${esc(e.text)}</div>` : '');
  // Collapsed check-ins show just the plans line as a preview
  const preview = isCI && !open ? `<div class="nh-lj-body">${esc(e.plans || e.business || e.personal || '')}</div>` : body;
  const title = isCI ? `Q${e.q + 1} check-in` : (e.title || '');
  return `
  <div class="nh-lj-item ${isCI ? 'ci' : ''} ${open ? 'open' : ''}" role="button" tabindex="0" aria-expanded="${open}" onclick="event.stopPropagation(); leaseToggleItem('${e.id}')">
    <div class="nh-lj-meta">
      <span class="nh-lj-date">${fmtLong(e.date)}</span>
      ${isCI ? '<span class="nh-lj-tag">CHECK-IN</span>' : ''}
    </div>
    ${title ? `<div class="nh-lj-title">${esc(title)}</div>` : ''}
    ${preview}
    ${open ? `<div class="nh-lj-item-foot"><button class="nh-lj-btn ghost small" onclick="event.stopPropagation(); leaseOpenForm('${isCI ? 'checkin' : 'note'}','${e.id}')">Edit</button></div>` : ''}
  </div>`;
}

// Expanded journey panel (rendered inside the lease card)
export function renderLeaseJourney(state, todayKey = localKey()) {
  const list = entries(state);
  const st = leaseJourneyStatus(state, todayKey);
  const cur = st.curQ;

  // Check-in banner
  let banner = '';
  if (cur >= 0) {
    const ci = checkinFor(list, cur);
    const late = st.missed.length ? `
      <div class="nh-lj-due-s" style="margin-top:10px;">Missed: fill these in late if you can.</div>
      <div class="nh-lj-late">${st.missed.map(q => `<button class="nh-lj-btn ghost small" onclick="event.stopPropagation(); leaseOpenForm('checkin', null, ${q})">Q${q + 1} check-in</button>`).join('')}</div>` : '';
    banner = ci ? `
    <div class="nh-lj-due done">
      <div class="nh-lj-due-h">✓ Q${cur + 1} check-in done · ${fmtShort(ci.date)}</div>
      <div class="nh-lj-due-s">Next one opens ${fmtYear(quarterEnd(cur))}.</div>${late}
    </div>` : `
    <div class="nh-lj-due">
      <div class="nh-lj-due-h">Q${cur + 1} check-in due · ${quarterRange(cur)}</div>
      <div class="nh-lj-due-s">Where you are right now in your personal life and in business, and your plans and goals for the quarter ahead.</div>
      ${state.leaseForm && state.leaseForm.mode === 'checkin' ? '' : `<button class="nh-lj-btn red" onclick="event.stopPropagation(); leaseOpenForm('checkin', null, ${cur})">Write Q${cur + 1} check-in</button>`}${late}
    </div>`;
  }

  const form = state.leaseForm ? renderForm(state, list, todayKey) : `
  <div class="nh-lj-actions">
    <button class="nh-lj-btn" onclick="event.stopPropagation(); leaseOpenForm('note')">+ New entry</button>
  </div>`;

  // Timeline grouped by quarter, newest quarter first
  const groups = {};
  list.forEach(e => { const q = typeof e.q === 'number' ? e.q : quarterOf(e.date); (groups[q] = groups[q] || []).push(e); });
  if (cur >= 0 && !groups[cur]) groups[cur] = [];
  const qs = Object.keys(groups).map(Number).sort((a, b) => b - a);
  const qOpen = state.leaseQOpen || {};
  const timeline = qs.map(q => {
    const items = groups[q];
    const open = qOpen[q] !== undefined ? qOpen[q] : q === cur;
    const n = items.length;
    return `
    <div>
      <button class="nh-lj-qh" onclick="event.stopPropagation(); leaseToggleQuarter(${q}, ${open ? 0 : 1})" aria-expanded="${open}">
        <div>
          <div class="nh-lj-qh-t">${q < 0 ? 'Before the lease' : `QUARTER ${q + 1}${q === cur ? ' · NOW' : ''}`}</div>
          <div class="nh-lj-qh-s">${quarterRange(q)}</div>
        </div>
        <span class="nh-lj-qh-c">${n} ${n === 1 ? 'entry' : 'entries'} ${open ? '▴' : '▾'}</span>
      </button>
      ${open ? (n ? `<div class="nh-lj-tl">${items.map(e => renderItem(state, e)).join('')}</div>` : `<div class="nh-lj-empty">Nothing logged this quarter yet.</div>`) : ''}
    </div>`;
  }).join('');

  return `
  <div class="nh-lj" onclick="event.stopPropagation()">
    ${banner}
    ${form}
    <div>${timeline}</div>
  </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────
export function initLeaseJourney({ state, saveData, render }) {
  const persistDraft = () => {
    try {
      if (state.leaseDraft && state.leaseForm) localStorage.setItem('leaseDraft', JSON.stringify({ form: state.leaseForm, draft: state.leaseDraft }));
      else localStorage.removeItem('leaseDraft');
    } catch (e) {}
  };
  const list = () => (Array.isArray(state.data.leaseJournal) ? state.data.leaseJournal : (state.data.leaseJournal = []));

  // Restore an unsaved draft after an app reload
  try {
    const saved = JSON.parse(localStorage.getItem('leaseDraft') || 'null');
    if (saved && saved.form && saved.draft) { state.leaseForm = saved.form; state.leaseDraft = saved.draft; state.leaseOpen = true; }
  } catch (e) {}

  window.toggleLeaseJourney = () => { state.leaseOpen = !state.leaseOpen; render(); };

  window.leaseOpenForm = (mode, id = null, q = null) => {
    state.leaseOpen = true;
    state.leaseDelete = null;
    const same = state.leaseForm && state.leaseForm.mode === mode && (state.leaseForm.id || null) === (id || null) && state.leaseDraft;
    if (!same) {
      const e = id ? list().find(x => x.id === id) : null;
      let date = localKey();
      // Late check-in for a past quarter: default to that quarter's last day
      if (!e && mode === 'checkin' && q !== null && q !== quarterOf(date)) {
        const end = parseKey(quarterEnd(q)); end.setDate(end.getDate() - 1); date = localKey(end);
      }
      state.leaseDraft = e ? { date: e.date, title: e.title || '', text: e.text || '', personal: e.personal || '', business: e.business || '', plans: e.plans || '' }
                           : { date, title: '', text: '', personal: '', business: '', plans: '' };
      state.leaseForm = { mode, id: id || null };
    }
    persistDraft();
    render();
    setTimeout(() => {
      const el = document.getElementById(mode === 'checkin' ? 'lj-personal' : 'lj-text');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  // No render on typing (render rebuilds the DOM); only date changes re-render
  window.leaseDraftInput = (field, value, rerender = false) => {
    if (!state.leaseDraft) state.leaseDraft = {};
    state.leaseDraft[field] = value;
    persistDraft();
    if (rerender) render();
  };

  window.leaseFormCancel = () => {
    state.leaseForm = null; state.leaseDraft = null; state.leaseDelete = null;
    persistDraft(); render();
  };

  window.leaseFormSave = () => {
    const f = state.leaseForm; if (!f) return;
    const d = { ...(state.leaseDraft || {}) };
    // Read straight from the fields too, in case an input event was missed
    ['date', 'title', 'text', 'personal', 'business', 'plans'].forEach(k => {
      const el = document.getElementById('lj-' + k); if (el) d[k] = el.value;
    });
    const trim = (s) => String(s || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) { alert('Pick a date for this entry.'); return; }
    const q = quarterOf(d.date);
    let rec;
    if (f.mode === 'checkin') {
      if (q < 0) { alert('A check-in needs a date from 24 Sep 2026 onwards.'); return; }
      if (list().some(e => e.kind === 'checkin' && e.q === q && e.id !== f.id)) { alert(`Q${q + 1} already has a check-in. Edit that one instead.`); return; }
      if (!trim(d.personal) || !trim(d.business) || !trim(d.plans)) { alert('Fill in all three parts: personal life, business life, and plans for the quarter ahead.'); return; }
      rec = { kind: 'checkin', date: d.date, q, personal: trim(d.personal), business: trim(d.business), plans: trim(d.plans) };
    } else {
      if (!trim(d.text) && !trim(d.title)) { alert('Write something before saving.'); return; }
      rec = { kind: 'note', date: d.date, q, title: trim(d.title), text: trim(d.text) };
    }
    const now = Date.now();
    const arr = list();
    if (f.id) {
      const i = arr.findIndex(e => e.id === f.id);
      if (i >= 0) arr[i] = { ...arr[i], ...rec, updatedAt: now };
    } else {
      const id = 'lj_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
      arr.push({ id, ...rec, createdAt: now, updatedAt: now });
      state.leaseItemOpen = { ...(state.leaseItemOpen || {}), [id]: true };
    }
    // Make sure the quarter it landed in is open
    state.leaseQOpen = { ...(state.leaseQOpen || {}), [q]: true };
    state.leaseForm = null; state.leaseDraft = null; state.leaseDelete = null;
    persistDraft();
    saveData();
  };

  window.leaseDeleteAsk = () => { state.leaseDelete = state.leaseForm?.id || null; render(); };
  window.leaseDeleteCancel = () => { state.leaseDelete = null; render(); };
  window.leaseDeleteConfirm = () => {
    const id = state.leaseDelete; if (!id) return;
    state.data.leaseJournal = list().filter(e => e.id !== id);
    state.leaseForm = null; state.leaseDraft = null; state.leaseDelete = null;
    persistDraft();
    saveData();
  };

  window.leaseToggleItem = (id) => {
    state.leaseItemOpen = { ...(state.leaseItemOpen || {}), [id]: !(state.leaseItemOpen && state.leaseItemOpen[id]) };
    render();
  };
  window.leaseToggleQuarter = (q, open) => {
    state.leaseQOpen = { ...(state.leaseQOpen || {}), [q]: !!open };
    render();
  };
}
