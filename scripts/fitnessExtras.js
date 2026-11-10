// ── FITNESS EXTRAS (Home page) ─────────────────────────────────────────────
// Four additions to the Home page that target the things most likely to derail
// the cut, rather than measuring it again:
//
//  1. DON'T MISS TWICE (banner, top of Home)
//     Looks at Gym and Diet (same done/missed logic as the Home habit cards) for
//     every day since the cut started (settings.cutStart, default 9 Nov 2026).
//       • Missed yesterday, today not done   → amber: today is the one that counts,
//         with a minimum version of the day. Gym: if it was the only miss in that
//         Mon–Sun week it's framed as the PPL rest day.
//       • Missed 2+ days running, not done   → red RESTART DAY: no making up, no
//         waiting for Monday, just the minimum today.
//       • Missed yesterday, today done        → green: "didn't miss twice ✓".
//     Why: Lally et al. (2010): missing a single day didn't hurt habit formation;
//     the damage is a run of misses. Lapses snowball, so the second miss is the
//     one to stop.
//
//  2. SLEEP (card)
//     Last night = health sync sleepMinutes for TODAY's date (night ending today),
//     or a manual entry (days[date].sleepManual, hours), manual wins.
//     Bed-by = wake time − sleep goal − 15 min to fall asleep
//     (settings.wakeTime default 04:00, settings.sleepGoalH default 8).
//     Why: Nedeltcheva et al. (2010): same calorie deficit, 5.5 h vs 8.5 h in bed,
//     the short sleepers lost 55% less fat and 60% more lean mass.
//
//  3. STEPS (card)
//     Today vs a daily floor (settings.stepFloor, default 8,000), and the last 7
//     complete days vs the 21 days before. A drop of more than 15% flags falling
//     NEAT (non-exercise movement), which quietly shrinks the deficit on a hard
//     cut (Levine et al. 1999; Rosenbaum & Leibel 2010 on adaptive thermogenesis).
//
//  4. WAIST (card, under Weight & Body Fat)
//     Weekly tape measure (days[date].waist, inches), due on Sundays. Over ~4 weeks
//     it's compared with the scale's body-fat reading: bioimpedance swings with
//     hydration, waist circumference tracks abdominal fat far more steadily.
//
// All styles scoped under .nh and reuse its CSS variables (see renderHomeTab.js).

function localKey(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const parseKey = (k) => new Date(k + 'T12:00:00');
function addDaysKey(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return localKey(d); }
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const mondayOf = (k) => addDaysKey(k, -((parseKey(k).getDay() + 6) % 7));
const fmtDay = (k) => parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const hm = (mins) => { const m = Math.round(Math.abs(mins)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const toMins = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const toHHMM = (mins) => { const m = ((Math.round(mins) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export const FITNESS_CSS = `<style id="fitness-extras-css">
/* Don't miss twice */
.nh .fx-miss { border-radius:18px; padding:14px 16px; border:2px solid; }
.nh .fx-miss.amber { background:rgba(245,197,66,0.12); border-color:var(--nh-gold); }
.nh .fx-miss.red { background:rgba(239,68,68,0.14); border-color:var(--nh-red); animation:fxPulse 1.6s ease-in-out infinite; }
.nh .fx-miss.green { background:rgba(34,197,94,0.12); border-color:var(--nh-green); }
@keyframes fxPulse { 0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow:0 0 18px 2px rgba(239,68,68,0.45); } }
@media (prefers-reduced-motion: reduce) { .nh .fx-miss.red { animation:none; } }
.nh .fx-miss-k { font-size:11px; font-weight:900; letter-spacing:2px; }
.nh .fx-miss.amber .fx-miss-k { color:var(--nh-gold) !important; }
.nh .fx-miss.red .fx-miss-k { color:var(--nh-red) !important; }
.nh .fx-miss.green .fx-miss-k { color:var(--nh-green) !important; }
.nh .fx-miss-h { font-size:20px; font-weight:900; margin-top:4px; line-height:1.2; color:var(--nh-text) !important; }
.nh .fx-miss-row { margin-top:10px; padding-top:10px; border-top:1px solid var(--nh-line); }
.nh .fx-miss-row:first-of-type { border-top:0; padding-top:0; }
.nh .fx-miss-t { font-size:14px; line-height:1.4; color:var(--nh-sub) !important; }
.nh .fx-miss-t b { color:var(--nh-text) !important; }
.nh .fx-miss-min { margin-top:6px; font-size:14px; font-weight:800; line-height:1.4; color:var(--nh-text) !important; }
.nh .fx-miss-min span { font-size:10px; font-weight:900; letter-spacing:1.5px; margin-right:6px; color:var(--nh-muted) !important; }
.nh .fx-miss-why { font-size:11.5px; line-height:1.4; margin-top:10px; color:var(--nh-muted) !important; }

/* Shared card bits */
.nh .fx-card { padding:16px 18px; }
.nh .fx-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.nh .fx-btn { height:36px; padding:0 12px; border-radius:10px; border:1px solid var(--nh-line); background:transparent; font-size:13px; font-weight:800; color:var(--nh-sub) !important; }
.nh .fx-big { font-size:40px; font-weight:900; line-height:1; letter-spacing:-1px; margin-top:10px; font-variant-numeric:tabular-nums; color:var(--nh-text) !important; }
.nh .fx-big span { font-size:15px; letter-spacing:0; margin-left:3px; color:var(--nh-muted) !important; }
.nh .fx-big.ok { color:var(--nh-green) !important; }
.nh .fx-big.close { color:var(--nh-gold) !important; }
.nh .fx-big.low { color:var(--nh-red) !important; }
.nh .fx-s { font-size:13px; line-height:1.45; margin-top:6px; color:var(--nh-sub) !important; }
.nh .fx-s b { color:var(--nh-text) !important; }
.nh .fx-why { font-size:11.5px; line-height:1.4; margin-top:10px; color:var(--nh-muted) !important; }
.nh .fx-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
.nh .fx-tile { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; }
.nh .fx-tile.hot { border-color:var(--nh-gold); background:rgba(245,197,66,0.1); }
.nh .fx-tile.warn { border-color:var(--nh-red); background:rgba(239,68,68,0.1); }
.nh .fx-tile-k { font-size:10px; font-weight:900; letter-spacing:1.5px; color:var(--nh-muted) !important; }
.nh .fx-tile-v { font-size:22px; font-weight:900; margin-top:4px; letter-spacing:-0.5px; font-variant-numeric:tabular-nums; color:var(--nh-text) !important; }
.nh .fx-tile-v span { font-size:12px; letter-spacing:0; color:var(--nh-muted) !important; }
.nh .fx-tile-s { font-size:11.5px; font-weight:700; margin-top:2px; line-height:1.35; color:var(--nh-muted) !important; }
.nh .fx-bar { height:8px; border-radius:4px; background:var(--nh-line); overflow:hidden; margin-top:10px; }
.nh .fx-bar > i { display:block; height:100%; border-radius:4px; }
.nh .fx-nights { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-top:12px; align-items:end; }
.nh .fx-night { display:flex; flex-direction:column; align-items:center; gap:4px; }
.nh .fx-night i { display:block; width:100%; max-width:26px; border-radius:5px 5px 2px 2px; min-height:3px; }
.nh .fx-night span { font-size:10px; font-weight:800; color:var(--nh-muted) !important; }
.nh .fx-night em { font-style:normal; font-size:9.5px; font-weight:800; color:var(--nh-sub) !important; }
.nh .fx-form { display:flex; gap:8px; margin-top:12px; align-items:flex-end; flex-wrap:wrap; }
.nh .fx-form label { flex:1; min-width:110px; display:flex; flex-direction:column; gap:4px; font-size:11px; font-weight:800; letter-spacing:0.5px; color:var(--nh-muted) !important; }
.nh .fx-form input { height:44px; border-radius:10px; border:1px solid var(--nh-line); background:transparent; padding:0 10px; font-size:16px; font-family:inherit; color:var(--nh-text); width:100%; }
.nh .fx-form button { height:44px; padding:0 16px; border-radius:12px; border:0; background:var(--nh-gold); color:#000 !important; font-size:14px; font-weight:900; }
.nh .fx-flag { margin-top:10px; padding:9px 11px; border-radius:10px; font-size:13px; line-height:1.4; font-weight:700; }
.nh .fx-flag.ok { background:rgba(34,197,94,0.12); color:var(--nh-green) !important; }
.nh .fx-flag.warn { background:rgba(245,197,66,0.12); color:var(--nh-gold) !important; }
.nh .fx-flag.bad { background:rgba(239,68,68,0.12); color:var(--nh-red) !important; }
.nh .fx-flag b, .nh .fx-flag span { color:inherit !important; }
.nh .fx-due { font-size:10px; font-weight:900; letter-spacing:1px; padding:4px 9px; border-radius:20px; background:var(--nh-gold); color:#000 !important; white-space:nowrap; }
.nh .fx-due.done { background:#16A34A; color:#fff !important; }
.nh .fx-due.idle { background:var(--nh-line); color:var(--nh-muted) !important; }
.nh .fx-link { background:none; border:0; padding:0; margin-top:8px; font-size:12px; font-weight:800; text-decoration:underline; color:var(--nh-muted) !important; }
</style>`;

// ── 1. Don't miss twice ────────────────────────────────────────────────────
export function renderMissBanner({ todayKey, cutStart, gymDone, dietDone }) {
  const yesterday = addDaysKey(todayKey, -1);
  const runEndingYesterday = (fn) => {
    let n = 0;
    for (let k = yesterday; k >= cutStart && n < 60; k = addDaysKey(k, -1)) { if (fn(k)) break; n++; }
    return n;
  };
  const habits = [
    { name: 'Gym', fn: gymDone, min: 'Get in the gym for 20 minutes. Any session counts, even if it\'s light.' },
    { name: 'Diet', fn: dietDone, min: 'Log everything you eat today, even if it goes over target. Hit your protein.' },
  ].map(h => {
    const misses = runEndingYesterday(h.fn);
    const today = h.fn(todayKey);
    let rest = false;
    if (h.name === 'Gym' && misses === 1) {
      // Only miss in yesterday's Mon–Sun week → treat as the PPL rest day
      const mon = mondayOf(yesterday);
      let wk = 0;
      for (let k = mon > cutStart ? mon : cutStart; k <= yesterday; k = addDaysKey(k, 1)) if (!h.fn(k)) wk++;
      rest = wk === 1;
    }
    return { ...h, misses, today, rest };
  });

  const open = habits.filter(h => h.misses >= 1 && !h.today && !h.rest);
  const restDue = habits.filter(h => h.rest && !h.today);
  const recovered = habits.filter(h => h.misses >= 1 && h.today);

  if (open.length) {
    const red = open.some(h => h.misses >= 2);
    const rows = open.map(h => `
      <div class="fx-miss-row">
        <div class="fx-miss-t">${h.misses >= 2
          ? `<b>${h.name}</b> missed <b>${h.misses} days running</b> (since ${fmtDay(addDaysKey(yesterday, -(h.misses - 1)))}). Don't make it up and don't wait for Monday. Today just has to happen.`
          : `<b>${h.name}</b> missed yesterday. One miss doesn't matter. Two in a row is how the last lapse started.`}</div>
        <div class="fx-miss-min"><span>MINIMUM</span>${h.min}</div>
      </div>`).join('');
    return `
    <section class="fx-miss ${red ? 'red' : 'amber'}" aria-label="Don't miss twice">
      <div class="fx-miss-k">${red ? 'RESTART DAY' : "DON'T MISS TWICE"}</div>
      <div class="fx-miss-h">${red ? 'Today you restart.' : 'Today is the one that counts.'}</div>
      ${rows}
      ${restDue.length ? `<div class="fx-miss-t" style="margin-top:10px;">Gym: yesterday was your rest day, so today you train.</div>` : ''}
      <div class="fx-miss-why">One missed day makes no measurable difference to building a habit (Lally et al. 2010). A run of missed days does. This banner clears once today is done.</div>
    </section>`;
  }
  if (restDue.length) {
    return `
    <section class="fx-miss amber" aria-label="Rest day used">
      <div class="fx-miss-k">REST DAY USED</div>
      <div class="fx-miss-h">Yesterday was rest. Today you train.</div>
      <div class="fx-miss-min" style="margin-top:8px;"><span>MINIMUM</span>${habits[0].min}</div>
    </section>`;
  }
  if (recovered.length) {
    return `
    <section class="fx-miss green" aria-label="Back on track">
      <div class="fx-miss-k">DIDN'T MISS TWICE ✓</div>
      <div class="fx-miss-h">${recovered.map(h => h.name).join(' and ')} back on track after ${recovered.some(h => h.misses >= 2) ? 'a few days off' : 'one miss'}.</div>
    </section>`;
  }
  return '';
}

// ── 2. Sleep ────────────────────────────────────────────────────────────────
export function renderSleepCard({ state, settings, todayKey, days, health }) {
  const goalH = Number(settings.sleepGoalH) > 0 ? Number(settings.sleepGoalH) : 8;
  const wake = settings.wakeTime || '04:00';
  const goalM = goalH * 60;
  const bedM = toMins(wake) - goalM - 15; // 15 min to fall asleep
  const bedBy = toHHMM(bedM);
  const syncFor = (k) => health.find(e => e.date === k) || {};
  const sleepFor = (k) => {
    const man = Number((days[k] || {}).sleepManual);
    if (man > 0) return { m: Math.round(man * 60), src: 'manual' };
    const s = Number(syncFor(k).sleepMinutes);
    return s > 0 ? { m: s, src: 'sync' } : null;
  };
  const cls = (m) => m == null ? '' : m >= goalM - 30 ? 'ok' : m >= goalM - 90 ? 'close' : 'low';
  const col = (m) => ({ ok: 'var(--nh-green)', close: 'var(--nh-gold)', low: 'var(--nh-red)' })[cls(m)] || 'var(--nh-line)';

  const last = sleepFor(todayKey);
  const nights = Array.from({ length: 7 }, (_, i) => addDaysKey(todayKey, i - 6));
  const vals = nights.map(k => sleepFor(k));
  const have = vals.filter(Boolean);
  const avg = have.length ? Math.round(have.reduce((a, v) => a + v.m, 0) / have.length) : null;
  const debt = have.reduce((a, v) => a + Math.max(0, goalM - v.m), 0);
  const maxM = Math.max(goalM + 60, ...have.map(v => v.m));

  // Tonight
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const bedNorm = ((bedM % 1440) + 1440) % 1440;
  const wakeM = toMins(wake);
  let untilBed = bedNorm - nowM;
  if (untilBed < -720) untilBed += 1440;
  let tonight;
  const pastBed = untilBed <= 0 && (nowM >= bedNorm || nowM < wakeM);
  if (pastBed) tonight = `<div class="fx-flag bad">Past your bedtime (${bedBy}). Phone down, lights off. Every extra hour counts tomorrow.</div>`;
  else if (untilBed <= 180) tonight = `<div class="fx-flag warn">Bed by <b>${bedBy}</b>, in <b>${hm(untilBed)}</b>. Start winding down: dim lights, no phone in bed.</div>`;
  else tonight = `<div class="fx-s">Tonight: in bed by <b>${bedBy}</b> for ${goalH}h before your <b>${wake}</b> alarm.</div>`;

  const editOpen = !!state.fxSleepEdit;
  const needEntry = !last || state.fxSleepEntry;
  const shortcutTip = !health.some(e => Number(e.sleepMinutes) > 0)
    ? `<div class="fx-why">To fill this automatically: in the Health Sync Shortcut, add Sleep (Asleep) for last night and send it as <b style="color:var(--nh-text)">sleepMinutes</b>. Until then, type it in each morning.</div>` : '';

  return `
  <section class="nh-card fx-card" aria-label="Sleep">
    <div class="fx-top">
      <div class="nh-kicker">SLEEP · LAST NIGHT</div>
      <button class="fx-btn" onclick="fxToggleSleepEdit()">${editOpen ? 'Close' : 'Goal'}</button>
    </div>
    ${last ? `<div class="fx-big ${cls(last.m)}">${Math.floor(last.m / 60)}<span>h</span> ${String(last.m % 60).padStart(2, '0')}<span>m</span></div>
      <div class="fx-s">${last.m >= goalM ? `Goal hit (${goalH}h) ✓` : `${hm(goalM - last.m)} short of ${goalH}h`} · ${last.src === 'manual' ? 'typed in' : 'from Garmin'}</div>`
      : `<div class="fx-s" style="margin-top:10px;">No sleep logged for last night yet.</div>`}
    ${needEntry ? `
    <div class="fx-form">
      <label>Hours slept last night<input id="fx-sleep-h" type="number" inputmode="decimal" step="0.25" min="0" max="16" placeholder="e.g. 7.5" value="${last && last.src === 'manual' ? (last.m / 60) : ''}"></label>
      <button onclick="fxSaveSleep()">Save</button>
    </div>` : `<button class="fx-link" onclick="fxSleepEntry()">${last.src === 'manual' ? 'Change' : 'Wrong? Type it in'}</button>`}
    <div class="fx-nights" aria-hidden="true">${nights.map((k, i) => {
      const v = vals[i];
      const h = v ? Math.max(4, Math.round((v.m / maxM) * 54)) : 3;
      return `<div class="fx-night"><em>${v ? (v.m / 60).toFixed(1) : '–'}</em><i style="height:${h}px;background:${v ? col(v.m) : 'var(--nh-line)'};"></i><span>${parseKey(k).toLocaleDateString('en-GB', { weekday: 'narrow' })}</span></div>`;
    }).join('')}</div>
    <div class="fx-grid">
      <div class="fx-tile"><div class="fx-tile-k">7-NIGHT AVERAGE</div><div class="fx-tile-v">${avg != null ? (avg / 60).toFixed(1) : '—'}<span> h</span></div><div class="fx-tile-s">${have.length}/7 nights logged</div></div>
      <div class="fx-tile ${debt >= 300 ? 'warn' : debt >= 120 ? 'hot' : ''}"><div class="fx-tile-k">SHORT THIS WEEK</div><div class="fx-tile-v">${have.length ? hm(debt) : '—'}</div><div class="fx-tile-s">vs ${goalH}h a night</div></div>
    </div>
    <div style="margin-top:10px;">${tonight}</div>
    ${editOpen ? `
    <div class="fx-form">
      <label>Alarm time<input id="fx-wake" type="time" value="${wake}"></label>
      <label>Sleep goal (h)<input id="fx-goal-h" type="number" inputmode="decimal" step="0.25" min="5" max="10" value="${goalH}"></label>
      <button onclick="fxSaveSleepSettings()">Save</button>
    </div>` : ''}
    ${shortcutTip}
    <div class="fx-why">Same calorie deficit, two weeks: people sleeping 5.5 h instead of 8.5 h lost 55% less fat and 60% more muscle (Nedeltcheva et al. 2010).</div>
  </section>`;
}

// ── 3. Steps ────────────────────────────────────────────────────────────────
export function renderStepsCard({ state, settings, todayKey, health }) {
  const floor = Number(settings.stepFloor) > 0 ? Number(settings.stepFloor) : 8000;
  const stepsFor = (k) => { const e = health.find(x => x.date === k); return e && Number(e.steps) > 0 ? Math.round(Number(e.steps)) : null; };
  const today = stepsFor(todayKey);
  const range = (from, to) => { const out = []; for (let i = from; i <= to; i++) { const v = stepsFor(addDaysKey(todayKey, -i)); if (v != null) out.push(v); } return out; };
  const r7 = range(1, 7), r21 = range(8, 28);
  const mean = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const avg7 = mean(r7), prior = mean(r21);
  const hit7 = r7.filter(v => v >= floor).length;
  const pct = today != null ? Math.min(100, (today / floor) * 100) : 0;
  const dropping = avg7 != null && prior != null && r7.length >= 5 && r21.length >= 10 && avg7 < prior * 0.85;
  const editOpen = !!state.fxStepsEdit;
  const barCol = today == null ? 'var(--nh-line)' : today >= floor ? 'var(--nh-green)' : pct >= 60 ? 'var(--nh-gold)' : 'var(--nh-red)';

  return `
  <section class="nh-card fx-card" aria-label="Steps">
    <div class="fx-top">
      <div class="nh-kicker">STEPS · TODAY</div>
      <button class="fx-btn" onclick="fxToggleStepsEdit()">${editOpen ? 'Close' : 'Floor'}</button>
    </div>
    <div class="fx-big ${today != null && today >= floor ? 'ok' : ''}">${today != null ? today.toLocaleString() : '—'}<span>/ ${floor.toLocaleString()}</span></div>
    <div class="fx-bar"><i style="width:${pct}%;background:${barCol};"></i></div>
    <div class="fx-s">${today == null ? 'No steps synced yet today.' : today >= floor ? 'Floor hit ✓' : `${(floor - today).toLocaleString()} to go · updates as you sync`}</div>
    <div class="fx-grid">
      <div class="fx-tile ${dropping ? 'warn' : ''}"><div class="fx-tile-k">LAST 7 DAYS</div><div class="fx-tile-v">${avg7 != null ? avg7.toLocaleString() : '—'}<span> /day</span></div><div class="fx-tile-s">floor hit on ${hit7}/${r7.length || 7} days</div></div>
      <div class="fx-tile"><div class="fx-tile-k">3 WEEKS BEFORE</div><div class="fx-tile-v">${prior != null ? prior.toLocaleString() : '—'}<span> /day</span></div><div class="fx-tile-s">${prior == null ? 'Needs 10+ days of history' : avg7 != null ? `${avg7 >= prior ? '+' : ''}${Math.round(((avg7 - prior) / prior) * 100)}% this week` : ''}</div></div>
    </div>
    ${dropping ? `<div class="fx-flag warn">Your movement outside the gym is down ${Math.round((1 - avg7 / prior) * 100)}%. That's normal on a hard cut, but it eats into your deficit without showing up as a missed workout. Walk it back up to ${prior.toLocaleString()}.</div>` : ''}
    ${editOpen ? `
    <div class="fx-form">
      <label>Daily step floor<input id="fx-step-floor" type="number" inputmode="numeric" step="500" min="2000" max="30000" value="${floor}"></label>
      <button onclick="fxSaveStepFloor()">Save</button>
    </div>` : ''}
    <div class="fx-why">On a long cut, everyday movement (fidgeting, walking, standing) drops without you noticing, and that's one of the main reasons fat loss slows down (Rosenbaum & Leibel 2010). A daily step floor stops that.</div>
  </section>`;
}

// ── 4. Waist ────────────────────────────────────────────────────────────────
export function renderWaistCard({ state, todayKey, days, bfByDate }) {
  const entries = Object.keys(days).filter(k => Number((days[k] || {}).waist) > 0 && k <= todayKey).sort()
    .map(k => ({ k, v: +Number(days[k].waist).toFixed(2) }));
  const latest = entries[entries.length - 1] || null;
  const isSun = parseKey(todayKey).getDay() === 0;
  const loggedToday = latest && latest.k === todayKey;
  const sinceLast = latest ? daysBetween(latest.k, todayKey) : null;
  let due, dueCls;
  if (!latest) { due = 'TAKE A BASELINE'; dueCls = ''; }
  else if (loggedToday) { due = 'DONE TODAY ✓'; dueCls = 'done'; }
  else if (isSun || sinceLast >= 8) { due = 'DUE TODAY'; dueCls = ''; }
  else { const nextSun = addDaysKey(todayKey, 7 - parseKey(todayKey).getDay()); due = `NEXT · ${fmtDay(nextSun).toUpperCase()}`; dueCls = 'idle'; }
  const showForm = !!state.fxWaistEntry || (!loggedToday && dueCls !== 'idle');

  // ~4-week comparison: latest vs the earliest entry in the last 35 days (≥ 21 days apart)
  let check = '';
  const base = latest ? entries.find(e => daysBetween(e.k, latest.k) <= 35 && daysBetween(e.k, latest.k) >= 21) : null;
  const bfNear = (k) => {
    const vs = Object.keys(bfByDate).filter(d => Math.abs(daysBetween(d, k)) <= 3).map(d => +bfByDate[d]);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  if (latest && base) {
    const dw = +(latest.v - base.v).toFixed(2);
    const b0 = bfNear(base.k), b1 = bfNear(latest.k);
    const dbf = b0 != null && b1 != null ? +(b1 - b0).toFixed(1) : null;
    const span = Math.round(daysBetween(base.k, latest.k) / 7);
    const head = `Over ${span} weeks: waist <b>${dw > 0 ? '+' : ''}${dw} in</b>${dbf != null ? `, scale body fat <b>${dbf > 0 ? '+' : ''}${dbf}%</b>` : ''}.`;
    if (dw <= -0.5 && (dbf == null || dbf <= -0.5)) check = `<div class="fx-flag ok">${head} Both agree: you're losing fat ✓</div>`;
    else if (dw <= -0.5) check = `<div class="fx-flag ok">${head} Your waist is shrinking, so the fat loss is real and the scale's body-fat reading is behind (water). Trust the tape.</div>`;
    else if (dw >= 0.25) check = `<div class="fx-flag bad">${head} Waist is going up. Check your 7-day deficit and food logging before trusting the scale.</div>`;
    else if (dbf != null && dbf <= -1) check = `<div class="fx-flag warn">${head} The scale says fat is down but your waist hasn't moved. That's probably a water swing, so give it another week before you believe the drop.</div>`;
    else check = `<div class="fx-flag warn">${head} Not much change yet. If it's still flat in 2 weeks while you're hitting your deficit, you've stalled.</div>`;
  } else if (entries.length) {
    check = `<div class="fx-s">The scale cross-check unlocks after 3 weeks of Sunday measurements (${entries.length} so far).</div>`;
  }

  // Sparkline of the last 10 entries
  const pts = entries.slice(-10);
  let spark = '';
  if (pts.length >= 2) {
    const lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
    const W = 300, H = 56, pad = 6, rng = hi - lo || 1;
    const xy = pts.map((p, i) => [pad + (i / (pts.length - 1)) * (W - pad * 2), pad + (1 - (p.v - lo) / rng) * (H - pad * 2)]);
    spark = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;margin-top:12px;" aria-hidden="true">
      <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--nh-gold)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${xy.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--nh-gold)"/>`).join('')}
    </svg>`;
  }
  const first = entries[0];
  const total = latest && first && first.k !== latest.k ? +(latest.v - first.v).toFixed(2) : null;

  return `
  <section class="nh-card fx-card" aria-label="Waist">
    <div class="fx-top">
      <div class="nh-kicker">WAIST · WEEKLY</div>
      <span class="fx-due ${dueCls}">${due}</span>
    </div>
    ${latest ? `<div class="fx-big">${latest.v}<span>in</span></div>
      <div class="fx-s">${loggedToday ? 'Measured today' : `Last measured ${fmtDay(latest.k)}`}${total != null ? ` · <b>${total > 0 ? '+' : ''}${total} in</b> since ${fmtDay(first.k)}` : ''}</div>`
      : `<div class="fx-s" style="margin-top:10px;">No waist measurements yet. Take one today as your starting point, then every Sunday.</div>`}
    ${spark}
    ${showForm ? `
    <div class="fx-form">
      <label>Waist at belly button (inches)<input id="fx-waist" type="number" inputmode="decimal" step="0.25" min="20" max="70" placeholder="e.g. 40.5" value="${loggedToday ? latest.v : ''}"></label>
      <button onclick="fxSaveWaist()">Save</button>
    </div>
    <div class="fx-why">Measure the same way every time: first thing in the morning, after the toilet, before you eat. Tape level across your belly button, snug but not pressing in, and read it at the end of a normal breath out.</div>` : `<button class="fx-link" onclick="fxWaistEntry()">${loggedToday ? 'Change today\'s' : 'Measure now'}</button>`}
    ${check}
    <div class="fx-why">Smart-scale body fat moves with how hydrated you are and can be several percent out. Your waist measurement tracks belly fat much more steadily, so it's the check on the scale.</div>
  </section>`;
}

// ── Actions ─────────────────────────────────────────────────────────────────
export function initFitnessExtras({ state, saveData, render, getSettings }) {
  const setDay = (field, value) => {
    const k = localKey();
    const d = (state.data.days && state.data.days[k]) || {};
    state.data.days = { ...(state.data.days || {}), [k]: { ...d, [field]: value } };
    state.days = state.data.days;
    saveData(); render();
  };
  const setSettings = (patch) => {
    state.data.settings = { ...(getSettings ? getSettings() : (state.data.settings || {})), ...patch };
    saveData(); render();
  };
  const val = (id) => parseFloat(document.getElementById(id)?.value);

  window.fxToggleSleepEdit = () => { state.fxSleepEdit = !state.fxSleepEdit; render(); };
  window.fxSleepEntry = () => { state.fxSleepEntry = true; render(); };
  window.fxSaveSleep = () => {
    const h = val('fx-sleep-h');
    if (!(h > 0 && h <= 16)) { alert('Enter the hours you slept, e.g. 7.5'); return; }
    state.fxSleepEntry = false;
    setDay('sleepManual', +h.toFixed(2));
  };
  window.fxSaveSleepSettings = () => {
    const wake = document.getElementById('fx-wake')?.value;
    const g = val('fx-goal-h');
    if (!/^\d{2}:\d{2}$/.test(wake || '')) { alert('Pick your alarm time.'); return; }
    if (!(g >= 5 && g <= 10)) { alert('Sleep goal should be between 5 and 10 hours.'); return; }
    state.fxSleepEdit = false;
    setSettings({ wakeTime: wake, sleepGoalH: g });
  };
  window.fxToggleStepsEdit = () => { state.fxStepsEdit = !state.fxStepsEdit; render(); };
  window.fxSaveStepFloor = () => {
    const f = val('fx-step-floor');
    if (!(f >= 2000 && f <= 30000)) { alert('Enter a floor between 2,000 and 30,000.'); return; }
    state.fxStepsEdit = false;
    setSettings({ stepFloor: Math.round(f) });
  };
  window.fxWaistEntry = () => { state.fxWaistEntry = true; render(); };
  window.fxSaveWaist = () => {
    const w = val('fx-waist');
    if (!(w >= 20 && w <= 70)) { alert('Enter your waist in inches, e.g. 40.5'); return; }
    state.fxWaistEntry = false;
    setDay('waist', +w.toFixed(2));
  };
}
