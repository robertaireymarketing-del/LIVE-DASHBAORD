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
//   Gym      → state.data.days[date].gym (same field as the old Discipline toggle)
//   Diet     → auto-done when health sync has dietary calories for that date
//              (healthData[].calories > 0). If not synced, tapping sets a manual
//              state.data.days[date].dietManual flag.
//
// All styles are scoped under .nh. Colours use CSS variables + !important
// because app.css has `body.light p, span, div { color: inherit; }`.

const LEASE_START = '2026-09-24';
const LEASE_END = '2031-09-24';
const BIRTHDAY_30 = '2027-08-12';

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
  --nh-gold:#F5C542; --nh-green:#22C55E; --nh-red:#EF4444;
  display:flex; flex-direction:column; gap:14px; width:100%; color:var(--nh-text);
}
body.light .nh {
  --nh-card:#FFFFFF; --nh-line:#CDD4E0; --nh-text:#0A1628; --nh-sub:#3D4B60; --nh-muted:#5B6778;
  --nh-gold:#8B6914; --nh-green:#15803D; --nh-red:#DC2626;
}
.nh * { box-sizing:border-box; }
.nh button { font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.nh .nh-card { background:var(--nh-card); border:1px solid var(--nh-line); border-radius:18px; }
.nh .nh-kicker { font-size:11px; font-weight:900; letter-spacing:2.5px; color:var(--nh-muted) !important; }

/* 1. Lease countdown — bright & bold, same in both themes (compact) */
.nh .nh-lease { background:linear-gradient(160deg,#FF3B30 0%,#FF6A00 100%) !important; border:0; border-radius:16px; padding:11px 12px 10px; color:#fff; }
.nh .nh-lease-title { font-size:22px; font-weight:900; letter-spacing:-0.3px; line-height:1.1; color:#FFFFFF !important; }
.nh .nh-lease .nh-kicker { font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.85) !important; }
.nh .nh-lease-units { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-top:7px; }
.nh .nh-lease-unit { background:rgba(0,0,0,0.22); border-radius:10px; padding:6px 4px 5px; text-align:center; display:flex; align-items:baseline; justify-content:center; gap:5px; }
.nh .nh-lease-num { font-size:26px; font-weight:900; line-height:1; letter-spacing:-1px; color:#FFFFFF !important; font-variant-numeric:tabular-nums; }
.nh .nh-lease-lbl { font-size:9px; font-weight:900; letter-spacing:1.5px; color:rgba(255,255,255,0.9) !important; }
.nh .nh-lease-passed { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,0.3); }
.nh .nh-lease-passed-val { font-size:14px; font-weight:900; color:#FFFFFF !important; }
.nh .nh-lease-track { position:relative; height:8px; margin-top:10px; }
.nh .nh-lease-bar { position:absolute; inset:0; background:rgba(0,0,0,0.25); border-radius:4px; overflow:hidden; }
.nh .nh-lease-bar div { height:100%; background:#FFFFFF; border-radius:4px; }
.nh .nh-tick { position:absolute; top:0; width:1px; height:8px; background:rgba(0,0,0,0.35); transform:translateX(-0.5px); }
.nh .nh-tick.year { top:-3px; width:2px; height:14px; background:#FFFFFF; border-radius:1px; transform:translateX(-1px); box-shadow:0 0 0 1px rgba(0,0,0,0.15); }
.nh .nh-lease-years { position:relative; height:12px; margin-top:5px; }
.nh .nh-lease-years span { position:absolute; top:0; transform:translateX(-50%); font-size:9px; font-weight:800; color:rgba(255,255,255,0.9) !important; }
.nh .nh-lease-years span:first-child { transform:none; }
.nh .nh-lease-years span:last-child { transform:translateX(-100%); }
.nh .nh-lease-foot { display:flex; justify-content:space-between; gap:8px; margin-top:6px; font-size:10px; font-weight:700; color:rgba(255,255,255,0.92) !important; }

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
.nh .nh-w-days { display:grid; grid-template-columns:repeat(7,1fr); font-size:10px; font-weight:800; text-align:center; color:var(--nh-muted) !important; }
.nh .nh-w-target { display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--nh-line); }
.nh .nh-w-target-lbl { font-size:13px; font-weight:700; color:var(--nh-sub) !important; }
.nh .nh-w-target-val { font-size:20px; font-weight:900; color:var(--nh-text) !important; font-variant-numeric:tabular-nums; }
.nh .nh-w-target-gap { font-size:12px; font-weight:800; margin-top:2px; text-align:right; }
.nh .nh-empty { font-size:13px; font-style:italic; color:var(--nh-muted) !important; padding:6px 0; }

/* 4. Gym / Diet */
.nh .nh-habits { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.nh .nh-habit { border:0; border-radius:18px; padding:16px 14px 14px; text-align:left; min-height:132px; display:flex; flex-direction:column; justify-content:space-between; color:#fff; }
.nh .nh-habit:disabled { opacity:1; cursor:default; }
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
  const passedTxt = [passed.y ? `${passed.y}y` : '', passed.y || passed.m ? `${passed.m}m` : '', `${passed.d}d`].filter(Boolean).join(' ');
  const leaseSection = `
  <section class="nh-lease" aria-label="Shop lease countdown">
    <div class="nh-lease-title">Shop lease ends</div>
    <div class="nh-lease-units">
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.y}</div><div class="nh-lease-lbl">YEAR${lease.y === 1 ? '' : 'S'}</div></div>
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.m}</div><div class="nh-lease-lbl">MONTH${lease.m === 1 ? '' : 'S'}</div></div>
      <div class="nh-lease-unit"><div class="nh-lease-num">${lease.d}</div><div class="nh-lease-lbl">DAY${lease.d === 1 ? '' : 'S'}</div></div>
    </div>
    <div class="nh-lease-foot"><span>24 Sep 2031 · Dad retires</span><span>${lease.totalDays.toLocaleString()} days left</span></div>
    <div class="nh-lease-passed">
      <div class="nh-kicker">PASSED SINCE 24 SEP 2026</div>
      <div class="nh-lease-passed-val">${passedTxt}</div>
    </div>
    <div class="nh-lease-track" role="img" aria-label="${passedPct.toFixed(1)}% of the lease gone">
      <div class="nh-lease-bar"><div style="width:${Math.max(passedPct, 0.8)}%;"></div></div>
      ${Array.from({ length: 19 }, (_, i) => i + 1).map(q => `<span class="nh-tick ${q % 4 === 0 ? 'year' : ''}" style="left:${(q / 20) * 100}%;"></span>`).join('')}
    </div>
    <div class="nh-lease-years" aria-hidden="true">
      ${[0, 1, 2, 3, 4, 5].map(y => `<span style="left:${y * 20}%;">${y === 0 ? 'Sep 26' : y === 5 ? 'Sep 31' : 'Y' + y}</span>`).join('')}
    </div>
    <div class="nh-lease-foot"><span>${passed.totalDays.toLocaleString()} days gone</span><span>${passedPct.toFixed(1)}% of 5 years</span></div>
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

  // Sunday target — same pace as the Health page: last Sunday's weight × (1 − bfLossRate/100)
  const settings = (deps.getSettings && deps.getSettings()) || {};
  const lossRate = settings.bfLossRate || 0.75;
  const thisWeek = weekDates(todayKey);
  const lastSunKey = addDaysKey(thisWeek[0], -1);
  const weekBaseKey = weightDates.filter(k => k <= lastSunKey).slice(-1)[0]
    || weightDates.find(k => k >= thisWeek[0]);
  const weekBase = weekBaseKey ? weightByDate[weekBaseKey] : null;
  const sundayTarget = weekBase != null ? +(weekBase * (1 - lossRate / 100)).toFixed(1) : null;
  const gap = current != null && sundayTarget != null ? +(current - sundayTarget).toFixed(1) : null;

  const fmtAsOf = (k) => {
    if (!k) return '';
    if (k === todayKey) return 'Today';
    if (k === addDaysKey(todayKey, -1)) return 'Yesterday';
    return parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  function chart() {
    const pts = series.map((v, i) => ({ v, i })).filter(p => p.v != null);
    if (pts.length < 2) return `<div class="nh-empty">Need at least 2 weigh-ins this week to show the trend.</div>`;
    const vals = pts.map(p => p.v).concat(sundayTarget != null ? [sundayTarget] : []);
    const min = Math.min(...vals) - 0.3, max = Math.max(...vals) + 0.3, range = max - min || 1;
    const W = 320, H = 70, pad = 8;
    const x = i => pad + (i / 6) * (W - pad * 2);
    const y = v => pad + (1 - (v - min) / range) * (H - pad * 2);
    const line = pts.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const colour = delta7 != null && delta7 > 0 ? 'var(--nh-red)' : 'var(--nh-green)';
    const tgt = sundayTarget != null
      ? `<line x1="${pad}" x2="${W - pad}" y1="${y(sundayTarget).toFixed(1)}" y2="${y(sundayTarget).toFixed(1)}" stroke="var(--nh-gold)" stroke-width="1.5" stroke-dasharray="4 4"></line>` : '';
    return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Weight over the last 7 days" style="display:block;">
      ${tgt}
      <polyline points="${line}" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${pts.map(p => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.i === 6 ? 5 : 3.5}" fill="${colour}"></circle>`).join('')}
    </svg>`;
  }

  const dayLetters = last7.map(k => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][parseKey(k).getDay()]);
  const deltaCls = delta7 == null ? 'flat' : delta7 < 0 ? 'down' : delta7 > 0 ? 'up' : 'flat';
  const deltaTxt = delta7 == null ? '— 7d' : `${delta7 > 0 ? '+' : ''}${delta7} lb · 7d`;
  const gapHtml = gap == null ? '' : gap <= 0
    ? `<div class="nh-w-target-gap" style="color:var(--nh-green) !important;">Hit ✓ (${Math.abs(gap)} lb under)</div>`
    : `<div class="nh-w-target-gap" style="color:var(--nh-red) !important;">${gap} lb to go</div>`;

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
    <div class="nh-w-chart">${chart()}</div>
    <div class="nh-w-days">${dayLetters.map(l => `<span>${l}</span>`).join('')}</div>
    <div class="nh-w-target">
      <div class="nh-w-target-lbl">Target by Sunday</div>
      <div>
        <div class="nh-w-target-val">${sundayTarget != null ? sundayTarget + ' lb' : '—'}</div>
        ${gapHtml}
      </div>
    </div>
  </section>`;

  // ── 4. Gym + Diet ───────────────────────────────────────────────────────
  const dayData = (k) => days[k] || {};
  const syncCals = (k) => { const h = health.find(e => e.date === k); return h && Number(h.calories) > 0 ? Number(h.calories) : 0; };
  const gymDone = (k) => !!dayData(k).gym;
  const dietDone = (k) => syncCals(k) > 0 || !!dayData(k).dietManual;

  function dots(fn) {
    return thisWeek.map(k => {
      const cls = k > todayKey ? 'future' : fn(k) ? 'hit' : k === todayKey ? '' : 'miss';
      return `<span class="nh-dot ${cls} ${k === todayKey ? 'today' : ''}"></span>`;
    }).join('');
  }
  const weekCount = (fn) => thisWeek.filter(k => k <= todayKey && fn(k)).length;
  const elapsed = thisWeek.filter(k => k <= todayKey).length;

  const gymToday = gymDone(todayKey);
  const calsToday = syncCals(todayKey);
  const dietToday = dietDone(todayKey);
  const dietState = calsToday > 0 ? `SYNCED · ${Math.round(calsToday).toLocaleString()} KCAL`
    : dietToday ? 'MARKED DONE' : 'NOT SYNCED YET';

  const habitsSection = `
  <section class="nh-habits">
    <button class="nh-habit ${gymToday ? 'done' : 'todo'}" onclick="toggleToday('gym')" aria-pressed="${gymToday}">
      <div>
        <div class="nh-habit-name">Gym</div>
        <div class="nh-habit-state">${gymToday ? 'DONE ✓' : 'TAP WHEN DONE'}</div>
      </div>
      <div>
        <div class="nh-dots" aria-hidden="true">${dots(gymDone)}</div>
        <div class="nh-habit-foot">${weekCount(gymDone)}/${elapsed} this week</div>
      </div>
    </button>
    <button class="nh-habit ${dietToday ? 'done' : 'todo'}" ${calsToday > 0 ? 'disabled' : `onclick="toggleHomeDiet()"`} aria-pressed="${dietToday}">
      <div>
        <div class="nh-habit-name">Diet</div>
        <div class="nh-habit-state">${dietState}</div>
      </div>
      <div>
        <div class="nh-dots" aria-hidden="true">${dots(dietDone)}</div>
        <div class="nh-habit-foot">${weekCount(dietDone)}/${elapsed} this week</div>
      </div>
    </button>
  </section>`;

  return HOME_CSS + `
  <div class="nh">
    ${leaseSection}
    ${bdaySection}
    ${weightSection}
    ${habitsSection}
  </div>`;
}
