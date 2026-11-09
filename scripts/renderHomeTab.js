// ── NEW HOME ───────────────────────────────────────────────────────────────
// The previous home page lives on as the 'oldhome' tab (renderTodayTab.js),
// reachable from the More menu.
//
// Order, top to bottom:
//   1. Shop lease countdown (ends 24 Sep 2031 — 5 years from 24 Sep 2026)
//   2. 30th birthday countdown (12 Aug 2027)
//   3. Weight: current, 7-day trend, target for Sunday
//   4. Gym + Diet daily checks (flash red until done, green once done)
//      with Mon–Sun streak dots
//
// Data:
//   Weight   → state.healthData (health sync), fallback state.data.days[*].weight
//   Gym      → AUTO: health sync has a workout that day (Garmin → Apple Health →
//              Shortcut → healthSync/<date>.workoutMinutes / workoutCount).
//              Done when workoutMinutes >= GYM_MIN_MINUTES, or workoutCount >= 1
//              if the Shortcut only sends a count.
//   Diet     → AUTO: health sync has dietary calories that day (calories > 0).
//   Neither can be ticked for TODAY by hand. Past days can be overridden from the
//   "Edit a past day" panel (two-step confirm) → days[date].gymOverride /
//   dietOverride = 'done' | 'missed' (null/absent = use the sync).
//   Days before LEGACY_CUTOFF still honour the old manual ticks (days[date].gym,
//   days[date].dietManual) so earlier history isn't wiped.
//
// All styles are scoped under .nh. Colours use CSS variables + !important
// because app.css has `body.light p, span, div { color: inherit; }`.

const LEASE_START = '2026-09-24';
const LEASE_END = '2031-09-24';
const BIRTHDAY_30 = '2027-08-12';
const GYM_MIN_MINUTES = 20;
const LEGACY_CUTOFF = '2026-11-09'; // manual ticks only count before this date

function localKey(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parseKey(k) { return new Date(k + 'T12:00:00'); }

function addDaysKey(k, n) {
  const d = parseKey(k); d.setDate(d.getDate() + n);
  return localKey(d);
}

// Calendar-accurate years / months / days between today and a target date
function ymdUntil(targetKey, fromKey) {
  const from = parseKey(fromKey);
  const to = parseKey(targetKey);
  if (to <= from) return { y: 0, m: 0, d: 0, totalDays: 0, past: true };
  let y = to.getFullYear() - from.getFullYear();
  let m = to.getMonth() - from.getMonth();
  let d = to.getDate() - from.getDate();
  if (d < 0) {
    m -= 1;
    // days in the month before the target month
    d += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (m < 0) { y -= 1; m += 12; }
  const totalDays = Math.round((to - from) / 86400000);
  return { y, m, d, totalDays, past: false };
}

function weekDates(todayKey) {
  const t = parseKey(todayKey);
  const dow = (t.getDay() + 6) % 7; // Mon=0
  const mon = addDaysKey(todayKey, -dow);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(mon, i));
}

const HOME_CSS = `<style id="new-home-css">
.nh {
  --nh-card:#151515; --nh-line:#262626; --nh-text:#FFFFFF; --nh-sub:#B5B5B5; --nh-muted:#9A9A9A;
  --nh-gold:#F5C542; --nh-green:#22C55E; --nh-red:#EF4444; --nh-wcol:#4FA3FF; --nh-bcol:#FF8A3D;
  display:flex; flex-direction:column; gap:14px; width:100%; color:var(--nh-text);
}
body.light .nh {
  --nh-card:#FFFFFF; --nh-line:#CDD4E0; --nh-text:#0A1628; --nh-sub:#3D4B60; --nh-muted:#5B6778;
  --nh-gold:#8B6914; --nh-green:#15803D; --nh-red:#DC2626; --nh-wcol:#1D63C9; --nh-bcol:#C2410C;
}
.nh * { box-sizing:border-box; }
.nh button { font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-card { background:var(--nh-card); border:1px solid var(--nh-line); border-radius:18px; }
.nh .nh-kicker { font-size:11px; font-weight:900; letter-spacing:2.5px; color:var(--nh-muted) !important; }

/* 1. Lease countdown — "Ember": deep brown-black card, orange numerals.
   Same look in both themes (it's the page's hero). */
.nh .nh-lease { background:#160B07 !important; border:1px solid rgba(255,106,43,0.35); border-radius:20px; padding:18px 16px 16px; color:#fff; }
.nh .nh-lease-head { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.nh .nh-lease-title { font-size:22px; font-weight:900; letter-spacing:-0.3px; line-height:1.1; color:#FFFFFF !important; }
.nh .nh-lease-chip { font-size:11px; font-weight:800; letter-spacing:1px; color:#FF8A5C !important; border:1px solid rgba(255,106,43,0.45); border-radius:20px; padding:5px 10px; white-space:nowrap; }
.nh .nh-lease-units { display:grid; grid-template-columns:repeat(3,1fr); margin-top:16px; }
.nh .nh-lease-unit + .nh-lease-unit { border-left:1px solid rgba(255,106,43,0.2); padding-left:14px; }
.nh .nh-lease-num { font-size:52px; font-weight:900; letter-spacing:-2px; line-height:1; color:#FF6A2B !important; font-variant-numeric:tabular-nums; }
.nh .nh-lease-lbl { font-size:11px; font-weight:800; letter-spacing:1.5px; margin-top:4px; color:#C9A797 !important; }
.nh .nh-lease-sub { font-size:13px; margin-top:12px; color:#C9A797 !important; }
.nh .nh-lease-track { display:flex; gap:8px; margin-top:18px; }
.nh .nh-lease-yr { flex:1; display:flex; gap:3px; }
.nh .nh-seg-q { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,0.1); overflow:hidden; position:relative; }
.nh .nh-seg-q > i { position:absolute; inset:0 auto 0 0; background:#FF6A2B; }
.nh .nh-seg-q.current { background:rgba(255,106,43,0.25); box-shadow:0 0 0 1.5px rgba(255,106,43,0.6); overflow:visible; }
.nh .nh-seg-q.current > i { border-radius:3px; }
.nh .nh-lease-ends { display:flex; justify-content:space-between; font-size:10px; font-weight:700; margin-top:7px; color:#9C7F72 !important; }
.nh .nh-lease-stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
.nh .nh-lease-stat { background:rgba(255,255,255,0.04); border-radius:12px; padding:10px 12px; }
.nh .nh-lease-stat.hot { background:rgba(255,106,43,0.1); }
.nh .nh-lease-stat-k { font-size:10px; font-weight:900; letter-spacing:1.5px; color:#9C7F72 !important; }
.nh .nh-lease-stat.hot .nh-lease-stat-k { color:#FF8A5C !important; }
.nh .nh-lease-stat-v { font-size:15px; font-weight:900; margin-top:4px; line-height:1.25; color:#FFFFFF !important; }
.nh .nh-lease-stat-s { font-size:11px; margin-top:2px; color:#9C7F72 !important; }

/* 2. Birthday countdown */
.nh .nh-bday { padding:20px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.nh .nh-bday .nh-kicker { font-size:13px; }
.nh .nh-bday-main { font-size:28px; font-weight:900; margin-top:6px; color:var(--nh-text) !important; letter-spacing:-0.5px; line-height:1.1; }
.nh .nh-bday-sub { font-size:14px; margin-top:4px; color:var(--nh-muted) !important; }
.nh .nh-bday-days { text-align:right; }
.nh .nh-bday-days b { display:block; font-size:48px; font-weight:900; line-height:1; color:var(--nh-gold) !important; font-variant-numeric:tabular-nums; letter-spacing:-1.5px; }
.nh .nh-bday-days span { font-size:11px; font-weight:900; letter-spacing:2px; color:var(--nh-muted) !important; }

/* 3. Weight */
.nh .nh-weight { padding:16px 18px; }
.nh .nh-w-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.nh .nh-w-now { font-size:40px; font-weight:900; line-height:1; margin-top:6px; letter-spacing:-1px; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-w-now span { font-size:16px; color:var(--nh-muted) !important; letter-spacing:0; margin-left:2px; }
.nh .nh-w-asof { font-size:12px; margin-top:4px; color:var(--nh-muted) !important; }
.nh .nh-w-delta { font-size:14px; font-weight:900; padding:6px 10px; border-radius:10px; white-space:nowrap; }
.nh .nh-w-delta.down { color:var(--nh-green) !important; background:rgba(34,197,94,0.12); }
.nh .nh-w-delta.up { color:var(--nh-red) !important; background:rgba(239,68,68,0.12); }
.nh .nh-w-delta.flat { color:var(--nh-muted) !important; background:rgba(127,127,127,0.12); }
.nh .nh-w-chart { margin:14px 0 4px; }
.nh .nh-w-days { display:grid; grid-template-columns:repeat(7,1fr); font-size:12px; font-weight:800; text-align:center; color:var(--nh-muted) !important; }
.nh .nh-w-comp { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:14px; }
.nh .nh-w-comp-tile { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; }
.nh .nh-w-comp-k { font-size:10px; font-weight:900; letter-spacing:1.5px; color:var(--nh-muted) !important; }
.nh .nh-w-comp-v { font-size:22px; font-weight:900; margin-top:4px; letter-spacing:-0.5px; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-w-comp-v span { font-size:12px; color:var(--nh-muted) !important; letter-spacing:0; margin-left:2px; }
.nh .nh-w-comp-d { font-size:11px; font-weight:800; margin-top:2px; }
.nh .nh-legend { display:flex; flex-direction:column; gap:5px; margin-top:8px; }
.nh .nh-legend { gap:10px; margin-top:10px; }
.nh .nh-leg { display:flex; align-items:flex-start; gap:10px; font-size:14px; line-height:1.4; color:var(--nh-sub) !important; }
.nh .nh-leg span { color:var(--nh-sub) !important; }
.nh .nh-leg .nh-leg-name { font-weight:800; color:var(--nh-sub) !important; }
.nh .nh-leg b { font-size:18px; font-weight:900; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-leg em { white-space:nowrap; font-style:normal; font-size:13px; font-weight:700; color:var(--nh-muted) !important; }
.nh .nh-leg i { width:12px; height:12px; border-radius:50%; flex-shrink:0; margin-top:6px; }
.nh .nh-leg-key { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; color:var(--nh-muted) !important; margin-top:2px; }
.nh .nh-vs { margin-top:4px; padding:6px 10px; border-radius:10px; font-size:13px; font-weight:800; }
.nh .nh-vs b { font-size:15px; }
.nh .nh-vs.ahead { background:rgba(34,197,94,0.14); color:var(--nh-green) !important; }
.nh .nh-vs.behind { background:rgba(239,68,68,0.14); color:var(--nh-red) !important; }
.nh .nh-vs.ahead b, .nh .nh-vs.behind b { color:inherit !important; }
.nh .nh-cal-nav { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.nh .nh-cal-nav button { width:44px; height:44px; border-radius:12px; border:1px solid var(--nh-line); background:transparent; font-size:22px; font-weight:900; color:var(--nh-text) !important; }
.nh .nh-cal-nav button:disabled { opacity:0.3; cursor:default; }
.nh .nh-cal-title { font-size:16px; font-weight:900; color:var(--nh-text) !important; text-align:center; }
.nh .nh-cal-title em { font-style:normal; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--nh-gold) !important; margin-left:4px; }
.nh .nh-w-target { margin-top:14px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-goal { border:1px solid var(--nh-line); border-radius:14px; padding:12px 14px; margin-bottom:14px; }
.nh .nh-goal-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.nh .nh-goal-title { font-size:15px; font-weight:700; color:var(--nh-text) !important; }
.nh .nh-goal-title b { color:var(--nh-bcol) !important; font-weight:900; }
.nh .nh-goal-edit { height:36px; padding:0 12px; border-radius:10px; border:1px solid var(--nh-line); background:transparent; font-size:13px; font-weight:800; color:var(--nh-sub) !important; }
.nh .nh-goal-sub { font-size:13px; line-height:1.45; margin-top:6px; color:var(--nh-sub) !important; }
.nh .nh-goal-sub b, .nh .nh-goal-pace b { color:var(--nh-text) !important; }
.nh .nh-goal-pace { font-size:13px; line-height:1.45; margin-top:4px; color:var(--nh-sub) !important; }
.nh .nh-goal-eta { font-size:13px; margin-top:6px; padding:8px 10px; border-radius:10px; background:rgba(255,138,61,0.12); color:var(--nh-text) !important; }
.nh .nh-goal-eta b { color:var(--nh-bcol) !important; }
.nh .nh-def { margin-top:10px; padding:12px; border-radius:12px; border:1px solid var(--nh-line); }
.nh .nh-def-vs { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px; }
.nh .nh-def-col { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; }
.nh .nh-def-col.ok { background:#16A34A; border-color:#16A34A; }
.nh .nh-def-col.close { background:rgba(245,197,66,0.16); border-color:var(--nh-gold); }
.nh .nh-def-col.low { background:rgba(239,68,68,0.16); border-color:var(--nh-red); }
.nh .nh-def-col.ok .nh-def-k, .nh .nh-def-col.ok .nh-def-v, .nh .nh-def-col.ok .nh-def-s { color:#FFFFFF !important; }
.nh .nh-def-k { font-size:10px; font-weight:900; letter-spacing:1.5px; color:var(--nh-muted) !important; }
.nh .nh-def-v { font-size:30px; font-weight:900; letter-spacing:-1px; margin-top:4px; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-def-v span { font-size:14px; letter-spacing:0; color:var(--nh-muted) !important; }
.nh .nh-def-s { font-size:12px; line-height:1.4; margin-top:3px; color:var(--nh-muted) !important; }
.nh .nh-def-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-top:10px; padding:8px 10px; border-radius:10px; font-size:13px; font-weight:700; }
.nh .nh-def-row b { font-size:15px; font-weight:900; }
.nh .nh-def-row.ok { background:rgba(34,197,94,0.14); color:var(--nh-green) !important; }
.nh .nh-def-row.close { background:rgba(245,197,66,0.14); color:var(--nh-gold) !important; }
.nh .nh-def-row.low { background:rgba(239,68,68,0.14); color:var(--nh-red) !important; }
.nh .nh-def-row span, .nh .nh-def-row b { color:inherit !important; }
.nh .nh-def-eat { font-size:13px; margin-top:8px; color:var(--nh-sub) !important; }
.nh .nh-def-eat b { font-size:15px; color:var(--nh-text) !important; }
.nh .nh-def-warn { font-size:12px; line-height:1.4; margin-top:6px; padding:8px 10px; border-radius:10px; background:rgba(245,197,66,0.12); color:var(--nh-gold) !important; }
.nh .nh-rec-toggle { display:flex; align-items:center; gap:8px; width:100%; min-height:44px; padding:8px 12px; border-radius:12px; border:1px solid var(--nh-line); background:transparent; text-align:left; }
.nh .nh-rec-toggle-l { font-size:13px; font-weight:800; color:var(--nh-sub) !important; flex-shrink:0; }
.nh .nh-rec-pills { display:flex; gap:6px; flex:1; justify-content:flex-end; flex-wrap:wrap; }
.nh .nh-rec-pill { font-size:10px; font-weight:900; letter-spacing:1px; padding:4px 8px; border-radius:20px; background:var(--nh-line); color:var(--nh-muted) !important; white-space:nowrap; }
.nh .nh-rec-pill.earned { background:#16A34A; color:#fff !important; }
.nh .nh-rec-pill.on { background:var(--nh-bcol); color:#000 !important; }
.nh .nh-rec-chev { font-size:14px; color:var(--nh-muted) !important; width:12px; text-align:center; }
.nh .nh-recs { margin-bottom:14px; display:flex; flex-direction:column; gap:8px; }
.nh .nh-rec { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; }
.nh .nh-rec.earned { border-color:#16A34A; background:rgba(34,197,94,0.1); }
.nh .nh-rec.active { border-color:var(--nh-bcol); background:rgba(255,138,61,0.12); }
.nh .nh-rec-h { font-size:15px; font-weight:900; color:var(--nh-text) !important; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.nh .nh-rec-h em { font-style:normal; font-size:10px; font-weight:900; letter-spacing:1.5px; padding:3px 8px; border-radius:20px; background:var(--nh-line); color:var(--nh-muted) !important; }
.nh .nh-rec.earned .nh-rec-h em { background:#16A34A; color:#fff !important; }
.nh .nh-rec ul { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:4px; }
.nh .nh-rec li { display:flex; gap:8px; font-size:12.5px; line-height:1.35; color:var(--nh-sub) !important; }
.nh .nh-rec li span { width:14px; flex-shrink:0; font-weight:900; }
.nh .nh-rec li.ok span { color:var(--nh-green) !important; }
.nh .nh-rec li.no span { color:var(--nh-red) !important; }
.nh .nh-rec ul.alt li { font-size:12px; opacity:0.85; }
.nh .nh-rec-alt { font-size:11px; font-weight:800; margin-top:8px; color:var(--nh-muted) !important; }
.nh .nh-rec-s { font-size:13px; line-height:1.45; margin-top:6px; color:var(--nh-sub) !important; }
.nh .nh-rec-btn { width:100%; height:44px; margin-top:10px; border-radius:12px; border:0; background:#16A34A; color:#fff !important; font-size:14px; font-weight:900; }
.nh .nh-rec-btn.ghost { background:transparent; border:1px solid var(--nh-line); color:var(--nh-sub) !important; }
.nh .nh-goal-form { display:grid; grid-template-columns:1fr; gap:8px; margin-top:10px; }
.nh .nh-goal-form label { display:flex; flex-direction:column; gap:4px; font-size:11px; font-weight:800; letter-spacing:0.5px; color:var(--nh-muted) !important; }
.nh .nh-goal-form input { height:42px; border-radius:10px; border:1px solid var(--nh-line); background:transparent; padding:0 10px; font-size:15px; font-family:inherit; color:var(--nh-text); }
.nh .nh-goal-form button { grid-column:1 / -1; height:44px; border-radius:12px; border:0; background:var(--nh-bcol); color:#000 !important; font-size:14px; font-weight:900; }
.nh .nh-w-target-head { font-size:14px; font-weight:800; color:var(--nh-sub) !important; }
.nh .nh-w-target-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
.nh .nh-w-target-cell { border:1px solid var(--nh-line); border-radius:12px; padding:10px 12px; position:relative; transition:background 0.2s; }
/* Target hit: whole box goes green with a tick */
.nh .nh-w-target-cell.hit { background:#16A34A; border-color:#16A34A; }
.nh .nh-w-target-cell.hit::after { content:'✓'; position:absolute; top:8px; right:10px; width:24px; height:24px; border-radius:50%; background:#FFFFFF; color:#16A34A; font-size:14px; font-weight:900; display:flex; align-items:center; justify-content:center; }
.nh .nh-w-target-cell.hit .nh-w-target-k.is-w,
.nh .nh-w-target-cell.hit .nh-w-target-k.is-b,
.nh .nh-w-target-cell.hit .nh-w-target-val,
.nh .nh-w-target-cell.hit .nh-w-target-gap.good,
.nh .nh-w-target-cell.hit .nh-w-target-from { color:#FFFFFF !important; }
.nh .nh-w-target-k { font-size:10px; font-weight:900; letter-spacing:1.5px; }
.nh .nh-w-target-k.is-w { color:var(--nh-wcol) !important; }
.nh .nh-w-target-k.is-b { color:var(--nh-bcol) !important; }
.nh .nh-w-target-gap.good { color:var(--nh-green) !important; }
.nh .nh-w-target-gap.bad { color:var(--nh-red) !important; }
.nh .nh-w-target-from { font-size:11px; font-weight:600; margin-top:4px; color:var(--nh-muted) !important; }
.nh .nh-w-target-lbl { font-size:13px; font-weight:700; color:var(--nh-sub) !important; }
.nh .nh-w-target-val { font-size:20px; font-weight:900; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-w-target-gap { font-size:12px; font-weight:800; margin-top:2px; }
.nh .nh-empty { font-size:13px; font-style:italic; color:var(--nh-muted) !important; padding:6px 0; }

/* 4. Gym / Diet */
.nh .nh-habits { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.nh .nh-habit { border:0; border-radius:18px; padding:16px 14px 14px; text-align:left; min-height:132px; display:flex; flex-direction:column; justify-content:space-between; color:#fff; }
.nh .nh-habit.todo { background:#E11D2E; animation:nhFlash 1s ease-in-out infinite; }
.nh .nh-habit.done { background:#16A34A; animation:none; }
@keyframes nhFlash {
  0%,100% { background:#E11D2E; box-shadow:0 0 0 0 rgba(255,40,40,0.0); }
  50%     { background:#FF4D4D; box-shadow:0 0 22px 4px rgba(255,40,40,0.55); }
}
@media (prefers-reduced-motion: reduce) { .nh .nh-habit.todo { animation:none; } }
.nh .nh-habit-name { font-size:22px; font-weight:900; letter-spacing:-0.3px; color:#FFFFFF !important; }
.nh .nh-habit-state { font-size:11px; font-weight:900; letter-spacing:1.8px; margin-top:4px; color:rgba(255,255,255,0.92) !important; }
.nh .nh-dots { display:flex; gap:5px; margin-top:14px; }
.nh .nh-dot { width:12px; height:12px; border-radius:50%; border:2px solid rgba(255,255,255,0.55); flex-shrink:0; }
.nh .nh-dot.hit { background:#FFFFFF; border-color:#FFFFFF; }
.nh .nh-dot.miss { background:rgba(0,0,0,0.35); border-color:rgba(0,0,0,0.35); }
.nh .nh-dot.today { outline:2px solid #FFFFFF; outline-offset:2px; }
.nh .nh-dot.future { opacity:0.45; }
.nh .nh-habit-src { font-size:12px; font-weight:700; margin-top:6px; color:rgba(255,255,255,0.92) !important; line-height:1.3; }
.nh .nh-edit-link { width:100%; height:44px; background:transparent; border:1px solid var(--nh-line); border-radius:14px; font-size:13px; font-weight:700; color:var(--nh-muted) !important; }
.nh .nh-edit { padding:14px; }
.nh .nh-edit-nav { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.nh .nh-edit-nav button { width:44px; height:44px; border-radius:12px; border:1px solid var(--nh-line); background:transparent; font-size:18px; font-weight:900; color:var(--nh-text) !important; }
.nh .nh-edit-nav button:disabled { opacity:0.3; cursor:default; }
.nh .nh-edit-date { font-size:16px; font-weight:900; color:var(--nh-text) !important; text-align:center; }
.nh .nh-edit-row { margin-top:14px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-edit-row-top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
.nh .nh-edit-name { font-size:15px; font-weight:900; color:var(--nh-text) !important; }
.nh .nh-edit-sync { font-size:12px; color:var(--nh-muted) !important; text-align:right; }
.nh .nh-seg { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:10px; }
.nh .nh-seg button { height:42px; border-radius:10px; border:1.5px solid var(--nh-line); background:transparent; font-size:13px; font-weight:800; color:var(--nh-sub) !important; }
.nh .nh-seg button.on { background:var(--nh-text); border-color:var(--nh-text); color:var(--nh-card) !important; }
.nh .nh-seg button.pending { border-color:var(--nh-gold); color:var(--nh-gold) !important; border-style:dashed; }
.nh .nh-confirm { display:flex; gap:8px; align-items:center; margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(245,197,66,0.12); border:1px solid var(--nh-gold); }
.nh .nh-confirm-text { flex:1; font-size:13px; font-weight:700; color:var(--nh-text) !important; line-height:1.3; }
.nh .nh-confirm button { height:40px; padding:0 14px; border-radius:10px; border:0; font-size:13px; font-weight:900; }
.nh .nh-confirm .yes { background:var(--nh-gold); color:#000 !important; }
.nh .nh-confirm .no { background:transparent; border:1px solid var(--nh-line); color:var(--nh-sub) !important; }
.nh .nh-habit-foot { font-size:11px; font-weight:800; margin-top:6px; color:rgba(255,255,255,0.88) !important; }
</style>`;

export function renderHomeTab(deps) {
  const { state } = deps;
  const todayKey = localKey();
  // Normalise day keys (some older entries are e.g. 2026-7-4) to YYYY-MM-DD
  const days = {};
  Object.entries(state.data?.days || {}).forEach(([k, v]) => {
    const m = String(k).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) days[`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`] = v;
  });
  const health = [...(state.healthData || [])].sort((a, b) => a.date.localeCompare(b.date));

  // ── 1. Lease countdown ──────────────────────────────────────────────────
  const lease = ymdUntil(LEASE_END, todayKey);
  const passed = ymdUntil(todayKey, LEASE_START); // time elapsed since the lease started
  const leaseTotal = Math.round((parseKey(LEASE_END) - parseKey(LEASE_START)) / 86400000);
  const passedPct = Math.min(100, Math.max(0, (passed.totalDays / leaseTotal) * 100));
  // Lease quarters (20 × 3 months from 24 Sep 2026)
  const addMonthsKey = (k, n) => { const d = parseKey(k); d.setMonth(d.getMonth() + n); return localKey(d); };
  let qIdx = 0;
  while (qIdx < 19 && addMonthsKey(LEASE_START, 3 * (qIdx + 1)) <= todayKey) qIdx++;
  const qStart = addMonthsKey(LEASE_START, 3 * qIdx);
  const qEnd = addMonthsKey(LEASE_START, 3 * (qIdx + 1));
  const qLeft = ymdUntil(qEnd, todayKey);
  const qWeeks = Math.floor(qLeft.d / 7), qDays = qLeft.d % 7;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const qLeftTxt = qLeft.past ? 'Quarter complete'
    : [qLeft.m ? plural(qLeft.m, 'month') : '', qWeeks ? plural(qWeeks, 'week') : '', qDays || (!qLeft.m && !qWeeks) ? plural(qDays, 'day') : ''].filter(Boolean).join(' ');
  const segFill = (q) => {
    const a = parseKey(addMonthsKey(LEASE_START, 3 * q)), b = parseKey(addMonthsKey(LEASE_START, 3 * (q + 1))), t = parseKey(todayKey);
    if (t >= b) return 100; if (t <= a) return 0;
    return Math.max(4, ((t - a) / (b - a)) * 100);
  };
  // Full words, no abbreviations
  const passedWeeks = Math.floor(passed.d / 7), passedDays = passed.d % 7;
  const passedTxt = passed.totalDays === 0 ? 'Starts today'
    : [passed.y ? plural(passed.y, 'year') : '', passed.m ? plural(passed.m, 'month') : '',
       passedWeeks ? plural(passedWeeks, 'week') : '', passedDays || (!passed.y && !passed.m && !passedWeeks) ? plural(passedDays, 'day') : ''].filter(Boolean).join(' ');
  const qEndLabel = parseKey(qEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const leaseSection = `
  <section class="nh-lease" aria-label="Shop lease countdown">
    <div class="nh-lease-head">
      <div class="nh-lease-title">Shop lease</div>
      <span class="nh-lease-chip">Q${qIdx + 1} / 20</span>
    </div>
    <div class="nh-lease-units">
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.y}</div><div class="nh-lease-lbl">YEAR${lease.y === 1 ? '' : 'S'}</div></div>
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.m}</div><div class="nh-lease-lbl">MONTH${lease.m === 1 ? '' : 'S'}</div></div>
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.d}</div><div class="nh-lease-lbl">DAY${lease.d === 1 ? '' : 'S'}</div></div>
    </div>
    <div class="nh-lease-sub">24 Sep 2031 · Dad retires · ${lease.totalDays.toLocaleString()} days</div>
    <div class="nh-lease-track" role="img" aria-label="${passedPct.toFixed(1)}% of the lease gone, quarter ${qIdx + 1} of 20">
      ${[0, 1, 2, 3, 4].map(y => `<div class="nh-lease-yr">${[0, 1, 2, 3].map(qq => { const q = y * 4 + qq; return `<span class="nh-seg-q ${q === qIdx ? 'current' : ''}"><i style="width:${segFill(q)}%;"></i></span>`; }).join('')}</div>`).join('')}
    </div>
    <div class="nh-lease-ends" aria-hidden="true"><span>Sep 26</span><span>Sep 31</span></div>
    <div class="nh-lease-stats">
      <div class="nh-lease-stat">
        <div class="nh-lease-stat-k">GONE</div>
        <div class="nh-lease-stat-v">${passedTxt}</div>
        <div class="nh-lease-stat-s">${passed.totalDays.toLocaleString()} days · ${passedPct.toFixed(1)}%</div>
      </div>
      <div class="nh-lease-stat hot">
        <div class="nh-lease-stat-k">LEFT THIS QUARTER</div>
        <div class="nh-lease-stat-v">${qLeftTxt}</div>
        <div class="nh-lease-stat-s">Ends ${qEndLabel}</div>
      </div>
    </div>
  </section>`;

  // ── 2. 30th birthday countdown ──────────────────────────────────────────
  const bday = ymdUntil(BIRTHDAY_30, todayKey);
  const bdayMain = bday.past ? 'You made it to 30' :
    [bday.y ? `${bday.y} year${bday.y === 1 ? '' : 's'}` : '',
     `${bday.m} month${bday.m === 1 ? '' : 's'}`,
     `${bday.d} day${bday.d === 1 ? '' : 's'}`].filter(Boolean).join(' ');
  const bdaySection = `
  <section class="nh-card nh-bday" aria-label="30th birthday countdown">
    <div>
      <div class="nh-kicker">UNTIL 30</div>
      <div class="nh-bday-main">${bdayMain}</div>
      <div class="nh-bday-sub">12 Aug 2027</div>
    </div>
    <div class="nh-bday-days"><b>${bday.totalDays.toLocaleString()}</b><span>DAYS</span></div>
  </section>`;

  // ── 3. Weight ───────────────────────────────────────────────────────────
  // Merge health sync weights with any manual day weights (sync wins per date)
  const weightByDate = {};
  Object.entries(days).forEach(([k, d]) => { if (d && d.weight) weightByDate[k] = +d.weight; });
  health.forEach(h => { if (h.weight) weightByDate[h.date] = +h.weight; });
  const weightDates = Object.keys(weightByDate).sort();
  const latestKey = weightDates.filter(k => k <= todayKey).slice(-1)[0];
  const current = latestKey ? +weightByDate[latestKey].toFixed(1) : null;

  const last7 = Array.from({ length: 7 }, (_, i) => addDaysKey(todayKey, i - 6));
  const series = last7.map(k => (weightByDate[k] != null ? +weightByDate[k] : null));
  const baseKey = weightDates.filter(k => k <= addDaysKey(todayKey, -7)).slice(-1)[0]
    || weightDates.find(k => k >= last7[0]);
  const base7 = baseKey ? weightByDate[baseKey] : null;
  const delta7 = current != null && base7 != null ? +(current - base7).toFixed(1) : null;

  // ── Body-fat goal model (recomputed on every render → updates daily) ─────
  // Goal: GOAL_BF % body fat (settings.bfGoal, default 13). No deadline — the pace
  // is the fastest that research supports for keeping lean mass, and it slows
  // automatically as you get leaner:
  //   Loss rate (% of body weight per week) by current body fat:
  //     ≥ 25% → 1.0%/wk   (top of the 0.5–1.0%/wk range, Helms et al. 2014)
  //     18%   → 0.7%/wk   (Garthe et al. 2011: 0.7%/wk kept more lean mass than 1.4%)
  //     ≤ 13% → 0.5%/wk   (bottom of range: leaner = more muscle at risk)
  //     linear in between.
  // Method:
  //   1. Smoothed "now": least-squares trend over the last 14 days, evaluated at
  //      today (falls back to 7-day mean, then latest) — smooths scale/water noise.
  //   2. Fat-free mass (FFM) = smoothed weight × (1 − smoothed BF%), held constant.
  //   3. Step forward day by day: weight falls at the rate for the current BF%;
  //      BF% = (weight − FFM) ÷ weight. Stops at the goal BF%.
  //   So weight & BF targets always agree, and everything is re-worked daily.
  const settings = (deps.getSettings && deps.getSettings()) || {};
  const GOAL_BF = +(settings.bfGoal || 13);
  const ratePct = (bf) => bf >= 25 ? 1.0 : bf >= 18 ? 0.7 + (bf - 18) * (0.3 / 7) : bf > 13 ? 0.5 + (bf - 13) * (0.2 / 5) : 0.5;
  const thisWeek = weekDates(todayKey);
  // Weeks run Mon–Sun. Once today is Sunday and today's weigh-in is in, the week is
  // closed, so the next target is NEXT Sunday.
  const isSunday = parseKey(todayKey).getDay() === 0;
  const rolled = isSunday && weightByDate[todayKey] != null;
  const targetSunKey = rolled ? addDaysKey(todayKey, 7) : thisWeek[6];

  const bfByDate = {};
  Object.entries(days).forEach(([k, d]) => { if (d && d.bodyFat) bfByDate[k] = +d.bodyFat; });
  health.forEach(h => { if (h.bodyFat) bfByDate[h.date] = +h.bodyFat; });
  const bfDates = Object.keys(bfByDate).sort();

  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
  function smoothedNow(byDate, ref = todayKey) {
    const keys = Object.keys(byDate).filter(k => k <= ref).sort();
    if (!keys.length) return null;
    const win = keys.filter(k => k > addDaysKey(ref, -14));
    if (win.length >= 3 && daysBetween(win[0], win[win.length - 1]) >= 4) {
      const xs = win.map(k => daysBetween(ref, k)), ys = win.map(k => +byDate[k]);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      const slope = den ? xs.reduce((a, x, j) => a + (x - mx) * (ys[j] - my), 0) / den : 0;
      return my + slope * (0 - mx); // value at today
    }
    const w7 = keys.filter(k => k > addDaysKey(ref, -7));
    if (w7.length) return w7.reduce((a, k) => a + +byDate[k], 0) / w7.length;
    return +byDate[keys[keys.length - 1]];
  }
  const wNow = smoothedNow(weightByDate);
  const bfNowS = smoothedNow(bfByDate);
  const goal = (() => {
    if (wNow == null || bfNowS == null) return null;
    const ffm = wNow * (1 - bfNowS / 100);
    const goalWeight = ffm / (1 - GOAL_BF / 100);
    // Day-by-day path from today; path[d] = weight d days from now
    const path = [wNow];
    let w = wNow;
    for (let d = 1; d <= 1200; d++) {
      const bf = (w - ffm) / w * 100;
      if (bf <= GOAL_BF + 0.01 || w <= goalWeight + 0.05) break; // reached goal (float-safe)
      w = Math.max(goalWeight, w * Math.pow(1 - ratePct(bf) / 100, 1 / 7));
      path.push(w);
    }
    const daysToGoal = path.length - 1;
    const wAt = (k) => { const d = daysBetween(todayKey, k); return d <= 0 ? wNow : path[Math.min(d, daysToGoal)]; };
    const bfAt = (k) => { const ww = wAt(k); return (ww - ffm) / ww * 100; };
    const rateNow = ratePct(bfNowS);
    return {
      ffm, goalWeight, fatToLose: Math.max(0, wNow - goalWeight), wAt, bfAt, daysToGoal,
      rateNow, lbPerWeekNow: wNow * rateNow / 100, etaKey: addDaysKey(todayKey, daysToGoal),
    };
  })();
  // ── Daily deficit suggestion ────────────────────────────────────────────
  // Target: today's pace (lb/week) × 3,500 kcal per lb of fat ÷ 7. Since the plan
  // assumes the weight lost is fat (lean mass held), 3,500 kcal/lb is the right
  // energy value. Recomputed daily with the goal model, so it tapers as you lean out.
  // Actual: same maths as the Health page calorie tracker — burn = BMR (sync, else
  // settings.defaultBmr, else 2085) + active energy (sync) + manual gym/treadmill
  // entries; deficit = burn − eaten, only on days with dietary calories synced.
  const KCAL_PER_LB_FAT = 3500;
  const deficit = (() => {
    if (!goal) return null;
    const target = Math.round(goal.lbPerWeekNow * KCAL_PER_LB_FAT / 7);
    const rows = [];
    for (let i = 1; i <= 7; i++) { // last 7 complete days (yesterday back)
      const k = addDaysKey(todayKey, -i);
      const h = health.find(e => e.date === k) || {};
      const dd = days[k] || {};
      const eaten = Number(h.calories) || 0;
      if (eaten <= 0) continue;
      const burn = (Number(h.bmr) || settings.defaultBmr || 2085) + (Number(h.gymCalories) || 0) + (Number(dd.gymCalEntry) || 0) + (Number(dd.treadmillCal) || 0);
      rows.push({ burn, eaten, def: burn - eaten });
    }
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const avgDef = avg(rows.map(r => r.def));
    const avgBurn = avg(rows.map(r => r.burn));
    const eatTarget = avgBurn != null ? Math.round((avgBurn - target) / 10) * 10 : null;
    const bmrNow = ([...health].filter(e => e.date <= todayKey && Number(e.bmr) > 0).sort((a, b) => b.date.localeCompare(a.date))[0] || {}).bmr || settings.defaultBmr || 2085; // latest synced BMR
    // Today — same maths as the Health page's calorie card for today
    const hT = health.find(e => e.date === todayKey) || {};
    const dT = days[todayKey] || {};
    const eatenT = Number(hT.calories) || 0;
    const burnT = (Number(hT.bmr) || settings.defaultBmr || 2085) + (Number(hT.gymCalories) || 0) + (Number(dT.gymCalEntry) || 0) + (Number(dT.treadmillCal) || 0);
    const today = { eaten: Math.round(eatenT), burn: Math.round(burnT), def: eatenT > 0 ? Math.round(burnT - eatenT) : null };
    return { today, target, weekly: target * 7, n: rows.length, avgDef: avgDef != null ? Math.round(avgDef) : null, avgBurn: avgBurn != null ? Math.round(avgBurn) : null, eatTarget, belowBmr: eatTarget != null && eatTarget < bmrNow, bmrNow: Math.round(bmrNow) };
  })();

  // ── Refeeds & diet breaks — EARNED, based on actual progress only ─────────
  // Plan: from CUT_START (settings.cutStart, default 9 Nov 2026 restart), the same
  // pace model is run day by day from your smoothed weight/BF on that date, pausing
  // on diet-break days. "On track" = today's smoothed weight is at or below that
  // plan (+1 lb tolerance for scale noise).
  // Adherence = last 7 cutting days: food logged on ≥ 5, average deficit ≥ 85% of
  // target (refeed/break days excluded).
  // REFEED DAY (max 2 per Mon–Sun week) needs: body fat < 20% · on track · adherent.
  // DIET BREAK (1 week at maintenance) needs: ≥ 8 weeks cutting since start/last
  //   break · on track · adherent.
  //   Early break if STALLED: ≥ 4 weeks cutting · 21-day weight trend < 25% of the
  //   target pace · 14-day adherence (food logged ≥ 10 days, avg deficit ≥ 90% of
  //   target). That pattern = adaptation / burn overestimate, not slacking.
  const CUT_START = settings.cutStart || '2026-11-09';
  const breaks = (state.data?.dietBreaks || []).filter(b => b && b.start && b.end);
  const isBreakDay = (k) => breaks.some(b => k >= b.start && k <= b.end);
  const activeBreak = breaks.find(b => todayKey >= b.start && todayKey <= b.end) || null;
  const isRefeed = (k) => !!(days[k] && days[k].refeed);
  const dayDef = (k) => {
    const h = health.find(e => e.date === k) || {}; const dd = days[k] || {};
    const eaten = Number(h.calories) || 0; if (eaten <= 0) return null;
    return (Number(h.bmr) || settings.defaultBmr || 2085) + (Number(h.gymCalories) || 0) + (Number(dd.gymCalEntry) || 0) + (Number(dd.treadmillCal) || 0) - eaten;
  };
  function slopePerWeek(byDate, nDays) {
    const ks = Object.keys(byDate).filter(k => k <= todayKey && k > addDaysKey(todayKey, -nDays)).sort();
    if (ks.length < 4 || daysBetween(ks[0], ks[ks.length - 1]) < nDays * 0.5) return null;
    const xs = ks.map(k => daysBetween(todayKey, k)), ys = ks.map(k => +byDate[k]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    return den ? 7 * xs.reduce((a, x, j) => a + (x - mx) * (ys[j] - my), 0) / den : null;
  }
  const rec = (() => {
    if (!goal || !deficit) return null;
    // Plan path from cut start (pauses on break days)
    const w0 = smoothedNow(weightByDate, CUT_START) ?? (weightDates.find(k => k >= CUT_START) ? weightByDate[weightDates.find(k => k >= CUT_START)] : null);
    const bf0 = smoothedNow(bfByDate, CUT_START) ?? (bfDates.find(k => k >= CUT_START) ? bfByDate[bfDates.find(k => k >= CUT_START)] : null);
    let planToday = null;
    if (w0 != null && bf0 != null && todayKey >= CUT_START) {
      const ffm0 = w0 * (1 - bf0 / 100), gw0 = ffm0 / (1 - GOAL_BF / 100);
      let w = w0;
      for (let k = addDaysKey(CUT_START, 1); k <= todayKey; k = addDaysKey(k, 1)) {
        if (isBreakDay(k)) continue;
        const bf = (w - ffm0) / w * 100;
        if (bf <= GOAL_BF) break;
        w = Math.max(gw0, w * Math.pow(1 - ratePct(bf) / 100, 1 / 7));
      }
      planToday = w;
    }
    const behind = planToday != null ? wNow - planToday : null; // + = behind plan
    const onTrack = behind != null && behind <= 1.0;
    // Cutting weeks since start or end of last finished break
    const lastEnd = breaks.filter(b => b.end < todayKey).map(b => b.end).sort().slice(-1)[0];
    const cutFrom = lastEnd && lastEnd > CUT_START ? lastEnd : CUT_START;
    let cutDays = 0;
    for (let k = addDaysKey(cutFrom, 1); k <= todayKey; k = addDaysKey(k, 1)) if (!isBreakDay(k)) cutDays++;
    const cutWeeks = cutDays / 7;
    // Adherence
    const adher = (n) => {
      const ds = [];
      for (let i = 1, seen = 0; seen < n && i <= n + 14; i++) {
        const k = addDaysKey(todayKey, -i);
        if (k < CUT_START) break;
        if (isBreakDay(k) || isRefeed(k)) continue;
        seen++; const d = dayDef(k); if (d != null) ds.push(d);
      }
      return { logged: ds.length, avg: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null };
    };
    const a7 = adher(7), a14 = adher(14);
    const tgt = deficit.target;
    const adherent7 = a7.logged >= 5 && a7.avg != null && a7.avg >= tgt * 0.85;
    const adherent14 = a14.logged >= 10 && a14.avg != null && a14.avg >= tgt * 0.9;
    const slope21 = slopePerWeek(weightByDate, 21); // lb/week (negative = losing)
    const stalled = slope21 != null && -slope21 < goal.lbPerWeekNow * 0.25;
    // This week's refeeds
    const refeedsThisWeek = thisWeek.filter(k => isRefeed(k)).length;
    const conds = {
      onTrack: { ok: onTrack, txt: behind == null ? 'On track vs plan: not enough data yet' : onTrack ? `On track vs plan (${behind <= 0 ? Math.abs(behind).toFixed(1) + ' lb ahead' : behind.toFixed(1) + ' lb behind, within 1 lb'})` : `${behind.toFixed(1)} lb behind plan` },
      adherent: { ok: adherent7, txt: a7.logged < 5 ? `Food logged on ${a7.logged}/7 days (need 5)` : `7-day avg deficit ${Math.round(a7.avg).toLocaleString()} vs ${Math.round(tgt * 0.85).toLocaleString()} needed` },
    };
    const refeed = {
      conds: [
        { ok: bfNowS < 20, txt: bfNowS < 20 ? `Body fat under 20% (${bfNowS.toFixed(1)}%)` : `Unlocks under 20% body fat (now ${bfNowS.toFixed(1)}%)` },
        conds.onTrack, conds.adherent,
        { ok: refeedsThisWeek < 2, txt: `${refeedsThisWeek}/2 refeeds used this week` },
      ],
    };
    refeed.earned = refeed.conds.every(c => c.ok) && !activeBreak && !isRefeed(todayKey);
    const normal = {
      conds: [{ ok: cutWeeks >= 8, txt: `${cutWeeks.toFixed(1)} of 8 weeks cutting${lastEnd ? ' since last break' : ''}` }, conds.onTrack, conds.adherent],
    };
    const stall = {
      conds: [
        { ok: cutWeeks >= 4, txt: `${cutWeeks.toFixed(1)} of 4 weeks cutting` },
        { ok: stalled, txt: slope21 == null ? 'Weight trend: need 3 weeks of data' : `21-day trend ${slope21 > 0 ? '+' : ''}${slope21.toFixed(2)} lb/wk (stall = slower than ${(goal.lbPerWeekNow * 0.25).toFixed(2)})` },
        { ok: adherent14, txt: a14.logged < 10 ? `Food logged ${a14.logged}/14 days (need 10)` : `14-day avg deficit ${Math.round(a14.avg).toLocaleString()} vs ${Math.round(tgt * 0.9).toLocaleString()} needed` },
      ],
    };
    const brk = {
      earned: !activeBreak && (normal.conds.every(c => c.ok) || stall.conds.every(c => c.ok)),
      why: normal.conds.every(c => c.ok) ? 'scheduled' : stall.conds.every(c => c.ok) ? 'stall' : null,
      conds: normal.conds, stallConds: stall.conds,
    };
    return { planToday, behind, onTrack, cutWeeks, refeed, brk, activeBreak, refeedToday: isRefeed(todayKey), stalled };
  })();
  // Today's mode: refeed day or diet-break week → deficit target is 0 (maintenance)
  const recMode = rec && rec.activeBreak ? 'break' : rec && rec.refeedToday ? 'refeed' : null;
  if (deficit && recMode) { deficit.cutTarget = deficit.target; deficit.target = 0; }

  const sundayTarget = goal ? +(recMode === 'break' ? wNow : goal.wAt(targetSunKey)).toFixed(1) : null;
  const gap = current != null && sundayTarget != null ? +(current - sundayTarget).toFixed(1) : null;

  const fmtAsOf = (k) => {
    if (!k) return '';
    if (k === todayKey) return 'Today';
    if (k === addDaysKey(todayKey, -1)) return 'Yesterday';
    return parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Calendar-month chart: weight + body fat. Scroll months with ‹ ›
  // (state.homeChartMonth = offset from this month; negative = past).
  //  • Past months: actual readings only.
  //  • This month: actual to date (solid) + projection to month end (dashed).
  //  • Future months: projection only (dashed).
  // Projection = least-squares trend over the last 28 days of readings, anchored on
  // the latest reading (needs ≥ 3 readings spanning ≥ 5 days). A ~4-week regression
  // smooths daily water swings far better than first-vs-last.
  function chart() {
    const now = parseKey(todayKey);
    const allKeys = Object.keys(weightByDate).concat(Object.keys(bfByDate)).sort();
    const firstKey = allKeys[0] || todayKey;
    const minOff = (parseKey(firstKey).getFullYear() - now.getFullYear()) * 12 + (parseKey(firstKey).getMonth() - now.getMonth());
    const maxOff = 12;
    const mOff = Math.max(minOff, Math.min(maxOff, state.homeChartMonth || 0));
    const mDate = new Date(now.getFullYear(), now.getMonth() + mOff, 1, 12);
    const mStart = localKey(mDate);
    const nDays = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
    const mEnd = addDaysKey(mStart, nDays - 1);
    const dayIdx = (k) => Math.round((parseKey(k) - parseKey(mStart)) / 86400000); // can be <0 / >nDays-1
    const todayIdx = dayIdx(todayKey);
    const monthLabel = mDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const monthShort = mDate.toLocaleDateString('en-GB', { month: 'short' });

    function build(byDate) {
      const keys = Object.keys(byDate).sort();
      const actual = keys.filter(k => k >= mStart && k <= mEnd && k <= todayKey).map(k => ({ i: dayIdx(k), v: +byDate[k], k }));
      const win = keys.filter(k => k >= addDaysKey(todayKey, -27) && k <= todayKey);
      let slope = null;
      if (win.length >= 3) {
        const xs = win.map(k => Math.round((parseKey(k) - now) / 86400000));
        if (xs[xs.length - 1] - xs[0] >= 5) {
          const ys = win.map(k => +byDate[k]);
          const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
          const num = xs.reduce((a, x, j) => a + (x - mx) * (ys[j] - my), 0);
          const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
          slope = den ? num / den : null; // per day
        }
      }
      const latestKey = keys.filter(k => k <= todayKey).slice(-1)[0];
      const anchor = latestKey ? { i: dayIdx(latestKey), v: +byDate[latestKey] } : null;
      const valAt = (i) => anchor.v + slope * (i - anchor.i);
      let proj = [];
      if (anchor && slope != null && mEnd > latestKey) {
        const i0 = Math.max(anchor.i, 0);
        proj = [{ i: i0, v: valAt(i0) }, { i: nDays - 1, v: valAt(nDays - 1) }];
      }
      const last = actual[actual.length - 1] || null;
      return { actual, proj, slope, last, end: proj.length ? proj[1].v : null, start: proj.length ? proj[0].v : null };
    }
    const W = build(weightByDate), B = build(bfByDate);

    const nav = `
    <div class="nh-cal-nav">
      <button onclick="homeChartShift(-1)" ${mOff <= minOff ? 'disabled' : ''} aria-label="Previous month">‹</button>
      <div class="nh-cal-title">${monthLabel}${mOff === 0 ? '' : mOff > 0 ? ' <em>projected</em>' : ''}</div>
      <button onclick="homeChartShift(1)" ${mOff >= maxOff ? 'disabled' : ''} aria-label="Next month">›</button>
    </div>`;
    if (W.actual.length + B.actual.length + W.proj.length + B.proj.length === 0) {
      return nav + `<div class="nh-empty">${mOff > 0 ? 'Not enough recent data to project this month.' : 'No weight or body fat readings this month.'}</div>`;
    }

    const VW = 320, VH = 260, padL = 36, padR = 44, padT = 14, padB = 14;
    const x = (i) => padL + (i / (nDays - 1)) * (VW - padL - padR);
    // Weekly target markers: the on-target path (same rule as "Target by Sunday")
    // at every Sunday in this month after the base weigh-in, plus month end.
    const tgtPath = (fn) => {
      if (mOff < 0) return [];
      const pts = [];
      for (let i = 0; i < nDays; i++) {
        const k = addDaysKey(mStart, i);
        if (k <= todayKey) continue;
        if (parseKey(k).getDay() === 0 || i === nDays - 1) pts.push({ i, v: fn(k), sunday: parseKey(k).getDay() === 0 });
      }
      return pts;
    };
    W.tgt = goal ? tgtPath(goal.wAt) : [];
    B.tgt = goal ? tgtPath(goal.bfAt) : [];
    const scaler = (ser) => {
      const vals = ser.actual.map(p => p.v).concat(ser.proj.map(p => p.v)).concat((ser.tgt || []).map(p => p.v));
      if (!vals.length) return null;
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const pad = Math.max((hi - lo) * 0.15, 0.5); lo -= pad; hi += pad;
      return { lo, hi, y: (v) => padT + (1 - (v - lo) / (hi - lo)) * (VH - padT - padB) };
    };
    const sw = scaler(W), sb = scaler(B);
    const WC = 'var(--nh-wcol)', BC = 'var(--nh-bcol)';
    const path = (pts, sc) => pts.map(p => `${x(p.i).toFixed(1)},${sc.y(p.v).toFixed(1)}`).join(' ');
    const line = (ser, sc, col) => !sc ? '' : `
      ${ser.actual.length > 1 ? `<polyline points="${path(ser.actual, sc)}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>` : ''}
      ${ser.proj.length ? `<polyline points="${path(ser.proj, sc)}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" opacity="0.85"></polyline>` : ''}
      ${ser.actual.map(p => `<circle cx="${x(p.i).toFixed(1)}" cy="${sc.y(p.v).toFixed(1)}" r="${p === ser.last ? 4 : 2.2}" fill="${col}"></circle>`).join('')}
      ${ser.proj.length ? `<circle cx="${x(nDays - 1).toFixed(1)}" cy="${sc.y(ser.end).toFixed(1)}" r="3.5" fill="none" stroke="${col}" stroke-width="2"></circle>` : ''}`;
    // Target markers: faint dotted path + diamonds at each Sunday (hollow square at month end)
    const targets = (ser, sc, col) => {
      if (!sc || !ser.tgt || !ser.tgt.length) return '';
      const pts = ser.tgt.map(p => `${x(p.i).toFixed(1)},${sc.y(p.v).toFixed(1)}`).join(' ');
      const mk = ser.tgt.map(p => {
        const cx = x(p.i), cy = sc.y(p.v);
        return p.sunday
          ? `<rect x="${(cx - 4.5).toFixed(1)}" y="${(cy - 4.5).toFixed(1)}" width="9" height="9" transform="rotate(45 ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="var(--nh-card)" stroke="${col}" stroke-width="2"></rect>`
          : `<rect x="${(cx - 4).toFixed(1)}" y="${(cy - 4).toFixed(1)}" width="8" height="8" fill="var(--nh-card)" stroke="${col}" stroke-width="2" opacity="0.8"></rect>`;
      }).join('');
      return `${ser.tgt.length > 1 ? `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round" opacity="0.7"></polyline>` : ''}${mk}`;
    };
    // 6 evenly spaced ticks per side, with faint horizontal gridlines
    const TICKS = 6;
    const tickVals = (sc) => Array.from({ length: TICKS }, (_, j) => sc.hi - (j / (TICKS - 1)) * (sc.hi - sc.lo));
    const gridLines = Array.from({ length: TICKS }, (_, j) => { const y = padT + (j / (TICKS - 1)) * (VH - padT - padB); return `<line x1="${padL}" x2="${VW - padR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--nh-line)" stroke-width="1" opacity="0.6"></line>`; }).join('');
    const axis = (sc, side, col, fmt) => !sc ? '' : tickVals(sc).map(v => `<text x="${side === 'l' ? 0 : VW}" y="${(sc.y(v) + 4).toFixed(1)}" text-anchor="${side === 'l' ? 'start' : 'end'}" font-size="12" font-weight="800" fill="${col}">${fmt(v)}</text>`).join('');
    // Value labels on the latest reading and the projected month-end point
    const tag = (ser, sc, col, fmt, below) => {
      if (!sc) return '';
      const out = [];
      if (ser.last) out.push(`<text x="${x(ser.last.i).toFixed(1)}" y="${(sc.y(ser.last.v) + (below ? 20 : -10)).toFixed(1)}" text-anchor="${ser.last.i > nDays * 0.8 ? 'end' : ser.last.i < 3 ? 'start' : 'middle'}" font-size="12" font-weight="900" fill="${col}" stroke="var(--nh-card)" stroke-width="3" paint-order="stroke">${fmt(ser.last.v)}</text>`);
      if (ser.proj.length) out.push(`<text x="${x(nDays - 1).toFixed(1)}" y="${(sc.y(ser.end) + (below ? 20 : -10)).toFixed(1)}" text-anchor="end" font-size="12" font-weight="900" fill="${col}" stroke="var(--nh-card)" stroke-width="3" paint-order="stroke">${fmt(ser.end)}</text>`);
      return out.join('');
    };
    const weekLines = [7, 14, 21, 28].filter(d => d < nDays).map(d => `<line x1="${x(d).toFixed(1)}" x2="${x(d).toFixed(1)}" y1="${padT}" y2="${VH - padB}" stroke="var(--nh-line)" stroke-width="1"></line>`).join('');
    const todayLine = todayIdx >= 0 && todayIdx < nDays ? `<line x1="${x(todayIdx).toFixed(1)}" x2="${x(todayIdx).toFixed(1)}" y1="${padT - 4}" y2="${VH - padB}" stroke="var(--nh-muted)" stroke-width="1" stroke-dasharray="2 3"></line>` : '';

    // On-target month end = where the 13% goal path says you should be
    const onTarget = { Weight: goal ? goal.wAt(mEnd) : null, 'Body fat': goal ? goal.bfAt(mEnd) : null };
    const legend = (label, ser, col, unit) => {
      const f = (v) => v.toFixed(1) + unit;
      // Projection vs on-target (this month and future months only)
      let vs = '';
      const tgt = onTarget[label];
      if (mOff >= 0 && tgt != null && ser.end != null) {
        const diff = +(ser.end - tgt).toFixed(1); // lower is better for both
        const cls = diff <= 0 ? 'ahead' : 'behind';
        const txt = diff === 0 ? 'exactly on target' : diff < 0 ? `${Math.abs(diff)}${unit} ahead` : `${diff}${unit} behind`;
        vs = `<div class="nh-vs ${cls}">On target: <b>${f(tgt)}</b> · ${txt}</div>`;
      }
      let body;
      if (mOff < 0) {
        body = ser.actual.length
          ? `<b>${f(ser.actual[0].v)}</b> → <b>${f(ser.last.v)}</b> <em>(${ser.last.v - ser.actual[0].v > 0 ? '+' : ''}${(ser.last.v - ser.actual[0].v).toFixed(1)}${unit})</em>`
          : 'no readings';
      } else if (mOff > 0) {
        body = ser.proj.length ? `<b>${f(ser.start)}</b> → <b>${f(ser.end)}</b> by ${nDays} ${monthShort}` : 'not enough data to project';
      } else {
        body = !ser.last ? 'no readings this month'
          : `<b>${f(ser.last.v)}</b>${ser.end != null ? ` → <b>${f(ser.end)}</b> by ${nDays} ${monthShort}` : ' · not enough data to project'}`;
      }
      const wk = mOff >= 0 && ser.slope != null ? ` <em>(${ser.slope * 7 > 0 ? '+' : ''}${(ser.slope * 7).toFixed(1)}${unit}/wk)</em>` : '';
      return `<div class="nh-leg"><i style="background:${col};"></i><span><span class="nh-leg-name">${label}</span> ${body}${wk}${vs}</span></div>`;
    };
    return nav + `
    <svg viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" role="img" aria-label="Weight and body fat, ${monthLabel}" style="display:block;">
      ${weekLines}${todayLine}
      ${gridLines}
      ${axis(sw, 'l', WC, v => v.toFixed(1))}${axis(sb, 'r', BC, v => v.toFixed(1) + '%')}
      ${targets(B, sb, BC)}${targets(W, sw, WC)}
      ${line(B, sb, BC)}${line(W, sw, WC)}
      ${tag(B, sb, BC, v => v.toFixed(1) + '%', false)}${tag(W, sw, WC, v => v.toFixed(1), true)}
    </svg>
    <div class="nh-w-days" aria-hidden="true" style="position:relative;height:16px;display:block;">
      ${[1, 8, 15, 22, 29].map(d => `<span style="position:absolute;left:${(x(d - 1) / VW * 100).toFixed(2)}%;transform:translateX(-50%);">${d}</span>`).join('')}
    </div>
    <div class="nh-legend">
      ${legend('Weight', W, WC, ' lb')}
      ${legend('Body fat', B, BC, '%')}
      ${mOff >= 0 && (W.tgt.length || B.tgt.length) ? `<div class="nh-leg-key"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="none" stroke="currentColor" stroke-width="2"></rect></svg> Weekly target (each Sunday) · solid = actual · dashed = trend</div>` : ''}
    </div>`;
  }

  const deltaCls = delta7 == null ? 'flat' : delta7 < 0 ? 'down' : delta7 > 0 ? 'up' : 'flat';
  // Body fat + fat-free mass (FFM = weight × (1 − BF%)). BF from the sync, else manual day entries.
  const bfKey = bfDates.filter(k => k <= todayKey).slice(-1)[0];
  const bfNow = bfKey ? +bfByDate[bfKey] : null;
  const bfBaseKey = bfDates.filter(k => k <= addDaysKey(todayKey, -7)).slice(-1)[0] || bfDates.find(k => k >= last7[0]);
  const bfBase = bfBaseKey && bfBaseKey !== bfKey ? +bfByDate[bfBaseKey] : null;
  const bfDelta = bfNow != null && bfBase != null ? +(bfNow - bfBase).toFixed(1) : null;
  // FFM uses the weight closest to (on or before) each BF reading's date
  const weightOnOrBefore = (k) => { const wk = weightDates.filter(x => x <= k).slice(-1)[0]; return wk ? +weightByDate[wk] : null; };
  const ffmAt = (bk) => { if (!bk) return null; const w = weightOnOrBefore(bk); return w != null ? +(w * (1 - bfByDate[bk] / 100)).toFixed(1) : null; };
  const ffmNow = ffmAt(bfKey);
  const ffmBase = bfBase != null ? ffmAt(bfBaseKey) : null;
  const ffmDelta = ffmNow != null && ffmBase != null ? +(ffmNow - ffmBase).toFixed(1) : null;
  // Colour: BF down = good; FFM up/flat = good (keeping muscle on a cut)
  const dCol = (v, goodWhenDown) => v == null || v === 0 ? 'var(--nh-muted)' : ((v < 0) === goodWhenDown ? 'var(--nh-green)' : 'var(--nh-red)');
  const dTxt = (v, unit) => v == null ? 'No 7-day comparison yet' : `${v > 0 ? '+' : ''}${v}${unit} · 7d`;
  const compSection = `
    <div class="nh-w-comp">
      <div class="nh-w-comp-tile">
        <div class="nh-w-comp-k">BODY FAT</div>
        <div class="nh-w-comp-v">${bfNow != null ? bfNow.toFixed(1) : '—'}<span>%</span></div>
        <div class="nh-w-comp-d" style="color:${dCol(bfDelta, true)} !important;">${bfNow != null ? dTxt(bfDelta, '%') : 'No body fat synced'}</div>
      </div>
      <div class="nh-w-comp-tile">
        <div class="nh-w-comp-k">FAT-FREE MASS</div>
        <div class="nh-w-comp-v">${ffmNow != null ? ffmNow : '—'}<span>lb</span></div>
        <div class="nh-w-comp-d" style="color:${dCol(ffmDelta, false)} !important;">${ffmNow != null ? dTxt(ffmDelta, ' lb') : 'Needs weight + body fat'}</div>
      </div>
    </div>`;
  const deltaTxt = delta7 == null ? '— 7d' : `${delta7 > 0 ? '+' : ''}${delta7} lb · 7d`;
  const bfTarget = goal ? +(recMode === 'break' ? bfNowS : goal.bfAt(targetSunKey)).toFixed(1) : null;
  const bfGap = bfNow != null && bfTarget != null ? +(bfNow - bfTarget).toFixed(1) : null;
  const bfGapHtml = bfGap == null ? '' : bfGap <= 0
    ? `<div class="nh-w-target-gap good">Hit ✓ (${Math.abs(bfGap)}% under)</div>`
    : `<div class="nh-w-target-gap bad">${bfGap}% to go</div>`;
  const gapHtml = gap == null ? '' : gap <= 0
    ? `<div class="nh-w-target-gap good">Hit ✓ (${Math.abs(gap)} lb under)</div>`
    : `<div class="nh-w-target-gap bad">${gap} lb to go</div>`;

  const weightSection = `
  <section class="nh-card nh-weight" aria-label="Weight">
    <div class="nh-w-top">
      <div>
        <div class="nh-kicker">WEIGHT</div>
        <div class="nh-w-now">${current != null ? current : '—'}<span>lb</span></div>
        <div class="nh-w-asof">${current != null ? 'Last weigh-in: ' + fmtAsOf(latestKey) : 'No weight synced yet'}</div>
      </div>
      <div class="nh-w-delta ${deltaCls}">${deltaTxt}</div>
    </div>
    ${compSection}
    <div class="nh-w-chart" data-swipe-months="1">${chart()}</div>
    <div class="nh-w-target">
      <div class="nh-goal">
        <div class="nh-goal-top">
          <div class="nh-goal-title">Goal: <b>${GOAL_BF}% body fat</b></div>
          <button class="nh-goal-edit" onclick="toggleHomeGoalEdit()">${state.homeGoalEdit ? 'Close' : 'Edit'}</button>
        </div>
        ${goal ? `<div class="nh-goal-sub">≈ <b>${goal.goalWeight.toFixed(1)} lb</b> at your current lean mass (${goal.ffm.toFixed(1)} lb) · <b>${goal.fatToLose.toFixed(1)} lb</b> of fat to lose</div>
        <div class="nh-goal-pace">Pace now: <b>${goal.rateNow.toFixed(2)}% of body weight/week</b> (≈ ${goal.lbPerWeekNow.toFixed(1)} lb) · slows as you get leaner to protect muscle</div>
        <div class="nh-goal-eta">On pace you reach ${GOAL_BF}% around <b>${parseKey(goal.etaKey).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b> · ${Math.round(goal.daysToGoal / 7)} weeks${goal.daysToGoal > 56 ? ` · <span style="white-space:nowrap">~${Math.floor(goal.daysToGoal / 56)} diet break${Math.floor(goal.daysToGoal / 56) === 1 ? '' : 's'} would add ${Math.floor(goal.daysToGoal / 56)} wk</span>` : ''}</div>
        ${deficit ? `
        <div class="nh-def">
          <div class="nh-def-vs">
            <div class="nh-def-col">
              <div class="nh-def-k">${recMode ? (recMode === 'break' ? 'DIET BREAK' : 'REFEED DAY') : 'TARGET DEFICIT'}</div>
              <div class="nh-def-v">${deficit.target.toLocaleString()}</div>
              <div class="nh-def-s">${recMode ? 'kcal · eat at maintenance' : 'kcal today'}</div>
            </div>
            <div class="nh-def-col ${deficit.today.def == null ? '' : deficit.today.def >= deficit.target ? 'ok' : deficit.today.def >= 0 ? 'close' : 'low'}">
              <div class="nh-def-k">TODAY'S DEFICIT</div>
              <div class="nh-def-v">${deficit.today.def == null ? '—' : (deficit.today.def < 0 ? '+' : '') + Math.abs(deficit.today.def).toLocaleString()}</div>
              <div class="nh-def-s">${deficit.today.def == null ? 'no food synced yet' : deficit.today.def < 0 ? 'kcal surplus' : deficit.today.def >= deficit.target ? 'kcal · on target ✓' : `kcal · ${(deficit.target - deficit.today.def).toLocaleString()} to go`}</div>
            </div>
          </div>
          <div class="nh-def-s">Today: burned ${deficit.today.burn.toLocaleString()} − eaten ${deficit.today.eaten.toLocaleString()} kcal, same figures as the Health page. Updates as you sync.</div>
          <div class="nh-def-s">${deficit.weekly.toLocaleString()} kcal/week · ${goal.lbPerWeekNow.toFixed(1)} lb of fat × 3,500 ÷ 7 · updates daily</div>
          ${deficit.avgDef != null ? `
          <div class="nh-def-row ${deficit.avgDef >= deficit.target ? 'ok' : deficit.avgDef >= deficit.target * 0.8 ? 'close' : 'low'}">
            <span>Your last 7 days</span>
            <b>${deficit.avgDef >= 0 ? '' : '+'}${Math.abs(deficit.avgDef).toLocaleString()} kcal ${deficit.avgDef >= 0 ? 'deficit' : 'surplus'}/day</b>
          </div>
          <div class="nh-def-s">Average of ${deficit.n} day${deficit.n === 1 ? '' : 's'} with food logged · ${deficit.avgDef >= deficit.target ? 'on pace ✓' : `${(deficit.target - deficit.avgDef).toLocaleString()} kcal/day short`}</div>
          <div class="nh-def-eat">On a typical day you burn ~${deficit.avgBurn.toLocaleString()} kcal → eat about <b>${(recMode ? deficit.avgBurn : deficit.eatTarget).toLocaleString()} kcal</b>${recMode ? ' (maintenance — extra from carbs)' : ''}</div>
          ${deficit.belowBmr && !recMode ? `<div class="nh-def-warn">That's below your BMR (${deficit.bmrNow.toLocaleString()} kcal). Fine short-term at this body fat, but keep protein high and lift heavy. Don't go lower.</div>` : ''}` : `<div class="nh-def-s">Sync your food (dietary calories) to compare your actual deficit.</div>`}
        </div>` : ''}` : `<div class="nh-goal-sub">Needs weight and body fat readings to work out your targets.</div>`}
        ${state.homeGoalEdit ? `
        <div class="nh-goal-form">
          <label>Body fat goal (%)<input id="home-goal-bf" type="number" inputmode="decimal" step="0.5" min="5" max="40" value="${GOAL_BF}"></label>
          <button onclick="homeSaveGoal()">Save goal</button>
        </div>` : ''}
      </div>
      ${rec ? (() => {
        const list = (cs) => cs.map(c => `<li class="${c.ok ? 'ok' : 'no'}"><span>${c.ok ? '✓' : '✗'}</span>${c.txt}</li>`).join('');
        if (rec.activeBreak) {
          const dayN = daysBetween(rec.activeBreak.start, todayKey) + 1, len = daysBetween(rec.activeBreak.start, rec.activeBreak.end) + 1;
          return `<div class="nh-rec active"><div class="nh-rec-h">Diet break · day ${dayN} of ${len}</div>
            <div class="nh-rec-s">Eat at maintenance (~${deficit && deficit.avgBurn ? deficit.avgBurn.toLocaleString() : '—'} kcal), extra calories mostly from carbs, keep protein 180–200 g and keep lifting. Weekly targets are paused: just hold your weight.</div>
            <button class="nh-rec-btn ghost" onclick="homeEndDietBreak()">End break early</button></div>`;
        }
        const rf = rec.refeedToday
          ? `<div class="nh-rec active"><div class="nh-rec-h">Refeed day ✓</div><div class="nh-rec-s">Eat at maintenance today, extra from carbs. Best on a heavy training day.</div><button class="nh-rec-btn ghost" onclick="homeUndoRefeed()">Undo</button></div>`
          : `<div class="nh-rec ${rec.refeed.earned ? 'earned' : ''}"><div class="nh-rec-h">Refeed day <em>${rec.refeed.earned ? 'EARNED' : 'LOCKED'}</em></div><ul>${list(rec.refeed.conds)}</ul>${rec.refeed.earned ? `<button class="nh-rec-btn" onclick="homeTakeRefeed()">Take refeed today</button>` : ''}</div>`;
        const bk = `<div class="nh-rec ${rec.brk.earned ? 'earned' : ''}"><div class="nh-rec-h">Diet break week <em>${rec.brk.earned ? (rec.brk.why === 'stall' ? 'EARNED · STALL' : 'EARNED') : 'LOCKED'}</em></div>
          <ul>${list(rec.brk.conds)}</ul>
          <div class="nh-rec-alt">Or early, if you've stalled despite hitting your deficit:</div><ul class="alt">${list(rec.brk.stallConds)}</ul>
          ${rec.brk.earned ? `<button class="nh-rec-btn" onclick="homeStartDietBreak()">Start 7-day diet break</button>` : ''}</div>`;
        // Collapsible: compact one-line summary by default; remembered per device
        let open = state.homeRecOpen;
        if (open === undefined) { try { open = localStorage.getItem('homeRecOpen') === '1'; } catch (e) { open = false; } }
        const pill = (label, earned, on) => `<span class="nh-rec-pill ${on ? 'on' : earned ? 'earned' : ''}">${label} ${on ? '· TODAY' : earned ? '✓' : '🔒'}</span>`;
        const summary = `<button class="nh-rec-toggle" onclick="toggleHomeRec()" aria-expanded="${open}">
          <span class="nh-rec-toggle-l">Refeeds & breaks</span>
          <span class="nh-rec-pills">${pill('Refeed', rec.refeed.earned, rec.refeedToday)}${pill('Break', rec.brk.earned, false)}</span>
          <span class="nh-rec-chev">${open ? '▾' : '▸'}</span>
        </button>`;
        return `<div class="nh-recs">${summary}${open ? rf + bk : (rec.refeedToday ? rf : '')}</div>`;
      })() : ''}
      <div class="nh-w-target-head">Target by Sun ${parseKey(targetSunKey).getDate()} ${parseKey(targetSunKey).toLocaleDateString('en-GB', { month: 'short' })}</div>
      <div class="nh-w-target-grid">
        <div class="nh-w-target-cell ${gap != null && gap <= 0 ? 'hit' : ''}">
          <div class="nh-w-target-k is-w">WEIGHT</div>
          <div class="nh-w-target-val">${sundayTarget != null ? sundayTarget + ' lb' : '—'}</div>
          ${gapHtml}
          <div class="nh-w-target-from">on the path to ${GOAL_BF}% · updates daily</div>
        </div>
        <div class="nh-w-target-cell ${bfGap != null && bfGap <= 0 ? 'hit' : ''}">
          <div class="nh-w-target-k is-b">BODY FAT</div>
          <div class="nh-w-target-val">${bfTarget != null ? bfTarget.toFixed(1) + '%' : '—'}</div>
          ${bfGapHtml}
          <div class="nh-w-target-from">on the path to ${GOAL_BF}% · updates daily</div>
        </div>
      </div>
    </div>
  </section>`;

  // ── 4. Gym + Diet ───────────────────────────────────────────────────────
  const dayData = (k) => days[k] || {};
  const syncFor = (k) => health.find(e => e.date === k) || null;
  const syncCals = (k) => { const h = syncFor(k); return h && Number(h.calories) > 0 ? Number(h.calories) : 0; };
  const syncWorkout = (k) => {
    const h = syncFor(k);
    const mins = h && Number(h.workoutMinutes) > 0 ? Math.round(Number(h.workoutMinutes)) : 0;
    const count = h && Number(h.workoutCount) > 0 ? Number(h.workoutCount) : 0;
    const type = h && h.workoutType ? String(h.workoutType) : '';
    const hit = mins >= GYM_MIN_MINUTES || (mins === 0 && count >= 1);
    return { mins, count, type, hit };
  };
  const gymSyncDone = (k) => syncWorkout(k).hit;
  const dietSyncDone = (k) => syncCals(k) > 0;
  const legacyGym = (k) => k < LEGACY_CUTOFF && !!dayData(k).gym;
  const legacyDiet = (k) => k < LEGACY_CUTOFF && !!dayData(k).dietManual;
  const resolve = (k, ov, auto, legacy) => {
    const o = dayData(k)[ov];
    if (k !== todayKey && o === 'done') return true;
    if (k !== todayKey && o === 'missed') return false;
    return auto(k) || legacy(k);
  };
  const gymDone = (k) => resolve(k, 'gymOverride', gymSyncDone, legacyGym);
  const dietDone = (k) => resolve(k, 'dietOverride', dietSyncDone, legacyDiet);

  function dots(fn) {
    return thisWeek.map(k => {
      const cls = k > todayKey ? 'future' : fn(k) ? 'hit' : k === todayKey ? '' : 'miss';
      return `<span class="nh-dot ${cls} ${k === todayKey ? 'today' : ''}"></span>`;
    }).join('');
  }
  const weekCount = (fn) => thisWeek.filter(k => k <= todayKey && fn(k)).length;
  const elapsed = thisWeek.filter(k => k <= todayKey).length;

  const wToday = syncWorkout(todayKey);
  const gymToday = gymDone(todayKey);
  const gymSrc = wToday.mins > 0
    ? `Garmin · ${wToday.mins} min${wToday.type ? ' · ' + wToday.type : ''}${wToday.hit ? '' : ` (needs ${GYM_MIN_MINUTES})`}`
    : wToday.count > 0 ? `Garmin · ${wToday.count} workout${wToday.count === 1 ? '' : 's'}` : 'No workout synced yet';
  const calsToday = syncCals(todayKey);
  const dietToday = dietDone(todayKey);
  const dietSrc = calsToday > 0 ? `Synced · ${Math.round(calsToday).toLocaleString()} kcal` : 'No calories synced yet';

  const habitsSection = `
  <section class="nh-habits">
    <div class="nh-habit ${gymToday ? 'done' : 'todo'}" role="status" aria-label="Gym ${gymToday ? 'done' : 'not done'}">
      <div>
        <div class="nh-habit-name">Gym</div>
        <div class="nh-habit-state">${gymToday ? 'DONE ✓' : 'NOT DONE'}</div>
        <div class="nh-habit-src">${gymSrc}</div>
      </div>
      <div>
        <div class="nh-dots" aria-hidden="true">${dots(gymDone)}</div>
        <div class="nh-habit-foot">${weekCount(gymDone)}/${elapsed} this week</div>
      </div>
    </div>
    <div class="nh-habit ${dietToday ? 'done' : 'todo'}" role="status" aria-label="Diet ${dietToday ? 'done' : 'not done'}">
      <div>
        <div class="nh-habit-name">Diet</div>
        <div class="nh-habit-state">${dietToday ? 'DONE ✓' : 'NOT DONE'}</div>
        <div class="nh-habit-src">${dietSrc}</div>
      </div>
      <div>
        <div class="nh-dots" aria-hidden="true">${dots(dietDone)}</div>
        <div class="nh-habit-foot">${weekCount(dietDone)}/${elapsed} this week</div>
      </div>
    </div>
  </section>`;

  // ── 5. Edit a past day (overrides) ──────────────────────────────────────
  const yesterday = addDaysKey(todayKey, -1);
  const oldest = addDaysKey(todayKey, -60);
  let editDate = state.homeEditDate && state.homeEditDate < todayKey ? state.homeEditDate : yesterday;
  if (editDate < oldest) editDate = oldest;
  const pending = state.homePending || null; // { habit:'gym'|'diet', val:'auto'|'done'|'missed', date }
  const editLabel = parseKey(editDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  function editRow(habit) {
    const ovKey = habit === 'gym' ? 'gymOverride' : 'dietOverride';
    const cur = dayData(editDate)[ovKey] === 'done' ? 'done' : dayData(editDate)[ovKey] === 'missed' ? 'missed' : 'auto';
    let syncTxt;
    if (habit === 'gym') {
      const w = syncWorkout(editDate);
      syncTxt = w.mins > 0 ? `Sync: ${w.mins} min${w.type ? ' · ' + w.type : ''}` : w.count > 0 ? `Sync: ${w.count} workout${w.count === 1 ? '' : 's'}` : 'Sync: no workout';
      if (legacyGym(editDate)) syncTxt += ' · old manual tick';
    } else {
      const c = syncCals(editDate);
      syncTxt = c > 0 ? `Sync: ${Math.round(c).toLocaleString()} kcal` : 'Sync: no calories';
      if (legacyDiet(editDate)) syncTxt += ' · old manual tick';
    }
    const autoResult = habit === 'gym' ? (gymSyncDone(editDate) || legacyGym(editDate)) : (dietSyncDone(editDate) || legacyDiet(editDate));
    const isPending = pending && pending.habit === habit && pending.date === editDate;
    const btn = (val, label) => {
      const cls = isPending ? (pending.val === val ? 'pending' : '') : (cur === val ? 'on' : '');
      return `<button class="${cls}" onclick="homePickOverride('${habit}','${val}','${editDate}')">${label}</button>`;
    };
    const valLabel = { auto: `use the sync (${autoResult ? 'done' : 'missed'})`, done: 'DONE', missed: 'MISSED' };
    return `
    <div class="nh-edit-row">
      <div class="nh-edit-row-top">
        <div class="nh-edit-name">${habit === 'gym' ? 'Gym' : 'Diet'}</div>
        <div class="nh-edit-sync">${syncTxt}</div>
      </div>
      <div class="nh-seg" role="group" aria-label="${habit} for ${editLabel}">
        ${btn('auto', 'Auto')}${btn('done', 'Done')}${btn('missed', 'Missed')}
      </div>
      ${isPending ? `
      <div class="nh-confirm">
        <div class="nh-confirm-text">Set ${habit === 'gym' ? 'Gym' : 'Diet'} on ${editLabel} to ${valLabel[pending.val]}?</div>
        <button class="no" onclick="homeCancelOverride()">Cancel</button>
        <button class="yes" onclick="homeConfirmOverride()">Confirm</button>
      </div>` : ''}
    </div>`;
  }

  const editSection = !state.homeEditOpen ? `
  <button class="nh-edit-link" onclick="toggleHomeEdit()">Edit a past day</button>` : `
  <section class="nh-card nh-edit" aria-label="Edit a past day">
    <div class="nh-edit-nav">
      <button onclick="homeEditShift(-1)" ${editDate <= oldest ? 'disabled' : ''} aria-label="Previous day">‹</button>
      <div class="nh-edit-date">${editLabel}</div>
      <button onclick="homeEditShift(1)" ${editDate >= yesterday ? 'disabled' : ''} aria-label="Next day">›</button>
    </div>
    ${editRow('gym')}
    ${editRow('diet')}
    <button class="nh-edit-link" style="margin-top:14px;" onclick="toggleHomeEdit()">Close</button>
  </section>`;

  return HOME_CSS + `
  <div class="nh">
    ${leaseSection}
    ${bdaySection}
    ${habitsSection}
    ${editSection}
    ${weightSection}
  </div>`;
}
