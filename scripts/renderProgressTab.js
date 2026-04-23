export function renderProgressTab(deps) {
  const { state, BATCH_COLOURS, getTodayData, getIdentityLock, getMissionTargets, getProjectFronts, getTJMBatches, getLatestWeight, getLatestBodyFat, getSettings, isSunday, getTodayDayKey, getWeekKey, getToday, getMonthStats, getMonthDaysRemaining, getMonthTargets, getDerivedTargetWeight, getCurrentLeanMass, getStartLeanMass } = deps;

  const settings = getSettings();
  const bfLossRate = settings.bfLossRate || 0.75;
  const targetWeight    = getDerivedTargetWeight();
  const currentWeight   = getLatestWeight();
  const currentBF       = getLatestBodyFat();
  const currentLeanMass = getCurrentLeanMass();
  const startLeanMass   = getStartLeanMass();
  const leanMassChange  = +(currentLeanMass - startLeanMass).toFixed(1);

  const weightPct = Math.min(100, Math.max(0, ((settings.startWeight - currentWeight) / (settings.startWeight - targetWeight)) * 100));
  const bfPct    = Math.min(100, Math.max(0, ((settings.startBodyFat - currentBF) / (settings.startBodyFat - settings.targetBodyFat)) * 100));
  const weightToLose = Math.max(0, currentWeight - targetWeight);
  const bfToLose     = Math.max(0, currentBF - settings.targetBodyFat);

  const targetMode = settings.targetMode || 'date';
  let effectiveTargetBF = settings.targetBodyFat || 14;
  let effectiveDeadline = settings.deadline;
  if (targetMode === 'date' && settings.deadline) {
    const weeksAvail = Math.max(0, (new Date(settings.deadline) - new Date()) / (7 * 86400000));
    effectiveTargetBF = +Math.max(0, currentBF - bfLossRate * weeksAvail).toFixed(1);
  } else if (targetMode === 'bf' && settings.targetBodyFat) {
    const weeksNeeded = Math.max(0, currentBF - settings.targetBodyFat) / bfLossRate;
    const d = new Date(); d.setDate(d.getDate() + Math.ceil(weeksNeeded * 7));
    effectiveDeadline = d.toISOString().slice(0,10);
  }

  const allSync = [...(state.healthData || [])].filter(h => h.bodyFat).sort((a,b) => a.date.localeCompare(b.date));
  const sevenDaysAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
  const recentSync   = allSync.filter(h => h.date >= sevenDaysAgo);
  const startDate = settings.startDate || '2026-03-16';
  const sinceStart = allSync.filter(h => h.date >= startDate);

  let pace7d = null;
  if (recentSync.length >= 2) {
    const first = recentSync[0], last = recentSync[recentSync.length-1];
    const days = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (days >= 1) pace7d = (first.bodyFat - last.bodyFat) / (days / 7);
  }

  let paceOverall = null;
  if (sinceStart.length >= 2) {
    const first = sinceStart[0], last = sinceStart[sinceStart.length-1];
    const days = (new Date(last.date) - new Date(first.date)) / 86400000;
    if (days >= 3) paceOverall = (first.bodyFat - last.bodyFat) / (days / 7);
  }

  let blendedPace = null;
  let paceLabel = bfLossRate + '%/wk (target — building data)';
  let paceSource = 'target';
  let hasEnoughData = false;

  if (pace7d !== null && paceOverall !== null) {
    blendedPace = +(pace7d * 0.6 + paceOverall * 0.4).toFixed(3);
    paceLabel = blendedPace.toFixed(2) + '%/wk (60% 7d + 40% overall)';
    paceSource = 'blended';
    hasEnoughData = true;
  } else if (paceOverall !== null) {
    blendedPace = +paceOverall.toFixed(3);
    paceLabel = blendedPace.toFixed(2) + '%/wk (overall avg)';
    paceSource = 'overall';
    hasEnoughData = true;
  } else if (pace7d !== null) {
    blendedPace = +pace7d.toFixed(3);
    paceLabel = blendedPace.toFixed(2) + '%/wk (7d avg)';
    paceSource = '7d';
    hasEnoughData = true;
  }

  const effectivePace   = (blendedPace !== null && blendedPace > 0) ? blendedPace : bfLossRate;
  const isGaining       = blendedPace !== null && blendedPace < -0.05;
  const effectiveWtPace = +(currentWeight * effectivePace / 100).toFixed(2);
  const targetWtPace    = +(currentWeight * bfLossRate / 100).toFixed(2);

  const weeksToGoal    = effectivePace > 0 ? bfToLose / effectivePace : 999;
  const projectedDate  = new Date();
  projectedDate.setDate(projectedDate.getDate() + Math.ceil(weeksToGoal * 7));
  const projectedDateStr  = projectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const projectedWeeks    = weeksToGoal < 999 ? Math.ceil(weeksToGoal) : '—';
  const expectedWeightAtGoal = +(currentLeanMass / (1 - settings.targetBodyFat / 100)).toFixed(1);
  const weeklyTargetWeight   = +(currentWeight - (currentWeight * bfLossRate / 100)).toFixed(1);

  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Steps (week / month) ────────────────────────────────────────────────
  const weekStartDate = new Date(todayStr + 'T00:00:00');
  const dowToday      = weekStartDate.getDay();
  const daysBackToMon = dowToday === 0 ? 6 : dowToday - 1;
  weekStartDate.setDate(weekStartDate.getDate() - daysBackToMon);
  const thisWeekStartStr   = weekStartDate.toISOString().slice(0, 10);
  const thisWeekData       = (state.healthData || []).filter(h => h.date >= thisWeekStartStr && h.date <= todayStr);
  const weekManualSteps    = Object.entries(state.data?.days || {})
    .filter(([d]) => d >= thisWeekStartStr && d <= todayStr)
    .reduce((s, [, d]) => s + (d.manualSteps || 0), 0);
  const weekSteps          = thisWeekData.reduce((s, h) => s + (h.steps || 0), 0) + weekManualSteps;

  const lastWeekMonDate = new Date(weekStartDate); lastWeekMonDate.setDate(weekStartDate.getDate() - 7);
  const lastWeekMonStr  = lastWeekMonDate.toISOString().slice(0, 10);
  const lastWeekSamePointDate = new Date(lastWeekMonDate); lastWeekSamePointDate.setDate(lastWeekMonDate.getDate() + daysBackToMon);
  const lastWeekSamePointStr  = lastWeekSamePointDate.toISOString().slice(0, 10);
  const lastWeekSamePointData = (state.healthData || []).filter(h => h.date >= lastWeekMonStr && h.date <= lastWeekSamePointStr);
  const lastWeekSameSteps     = lastWeekSamePointData.reduce((s, h) => s + (h.steps || 0), 0);
  const weekStepsDelta        = lastWeekSameSteps > 0 ? weekSteps - lastWeekSameSteps : null;

  const monthPrefix   = todayStr.slice(0, 7);
  const monthHealthData = (state.healthData || []).filter(h => h.date.startsWith(monthPrefix));
  const monthManualSteps = Object.entries(state.data?.days || {})
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((s, [, d]) => s + (d.manualSteps || 0), 0);
  const monthSteps    = monthHealthData.reduce((s, h) => s + (h.steps || 0), 0) + monthManualSteps;
  const stepsMonthDay = parseInt(todayStr.slice(8, 10));
  const lastMonthYear = todayStr.slice(0,7) === `${new Date().getFullYear()}-01`
    ? `${new Date().getFullYear()-1}-12`
    : (() => { const d = new Date(todayStr.slice(0,7)+'-01'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
  const lastMonthSamePointStr  = `${lastMonthYear}-${String(stepsMonthDay).padStart(2,'0')}`;
  const lastMonthSamePointData = (state.healthData || []).filter(h => h.date.startsWith(lastMonthYear) && h.date <= lastMonthSamePointStr);
  const lastMonthSameSteps     = lastMonthSamePointData.reduce((s, h) => s + (h.steps || 0), 0);
  const monthStepsDelta        = lastMonthSameSteps > 0 ? monthSteps - lastMonthSameSteps : null;

  // ── Weight / BF week & month change ────────────────────────────────────
  const todayDate    = new Date();
  const dayOfWeek2   = todayDate.getDay();
  const lastSunday   = new Date(todayDate);
  lastSunday.setDate(todayDate.getDate() - (dayOfWeek2 === 0 ? 7 : dayOfWeek2));
  const lastSundayStr  = lastSunday.toISOString().slice(0,10);
  const monthStartStr  = todayStr.slice(0,7) + '-01';
  const sortedHealth   = [...(state.healthData || [])].sort((a,b) => a.date.localeCompare(b.date));
  const weekBaseEntry  = sortedHealth.filter(h => h.weight  && h.date <= lastSundayStr).slice(-1)[0];
  const monthBaseEntry = sortedHealth.filter(h => h.weight  && h.date <= monthStartStr).slice(-1)[0];
  const latestEntry    = sortedHealth.filter(h => h.weight).slice(-1)[0];
  const latestBFEntry  = sortedHealth.filter(h => h.bodyFat).slice(-1)[0];
  const manualDaysSorted    = Object.entries(state.data?.days || {}).sort((a,b) => b[0].localeCompare(a[0]));
  const latestWeightDayEntry = manualDaysSorted.find(([_, d]) => d.weight);
  const latestBFDayEntry     = manualDaysSorted.find(([_, d]) => d.bodyFat);

  const formatSyncDate = (ds) => {
    if (!ds) return null;
    const today     = new Date().toISOString().slice(0,10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    if (ds === today)     return 'Today';
    if (ds === yesterday) return 'Yesterday';
    const [y,m,d] = ds.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${months[parseInt(m)-1]}`;
  };
  const weightSyncLabel = formatSyncDate(latestEntry?.date || latestWeightDayEntry?.[0] || settings.startDate);
  const bfSyncLabel     = formatSyncDate(latestBFEntry?.date || latestBFDayEntry?.[0] || settings.startDate);
  const weightChangeWeek  = latestEntry && weekBaseEntry  ? +(latestEntry.weight  - weekBaseEntry.weight).toFixed(1)  : null;
  const weightChangeMonth = latestEntry && monthBaseEntry ? +(latestEntry.weight  - monthBaseEntry.weight).toFixed(1) : null;
  const bfChangeWeek      = latestBFEntry && weekBaseEntry  ? +(latestBFEntry.bodyFat - weekBaseEntry.bodyFat).toFixed(2)  : null;
  const bfChangeMonth     = latestBFEntry && monthBaseEntry ? +(latestBFEntry.bodyFat - monthBaseEntry.bodyFat).toFixed(2) : null;

  // ── Sparklines ──────────────────────────────────────────────────────────
  const last30Health = [...(state.healthData || [])].sort((a,b) => a.date.localeCompare(b.date)).slice(-30);
  function sparkline(values, color) {
    const valid = values.filter(v => v != null);
    if (valid.length < 2) return '';
    const min = Math.min(...valid), max = Math.max(...valid), range = max - min || 1;
    const w = 280, h = 50;
    const pts = values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - (((v ?? min) - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:50px;display:block;"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${(values.length-1)/(Math.max(values.length-1,1))*w}" cy="${h-(((valid[valid.length-1]??min)-min)/range)*h}" r="4" fill="${color}"/></svg>`;
  }
  const weights   = last30Health.map(h => h.weight);
  const bodyFats  = last30Health.map(h => h.bodyFat);
  const stepsList = last30Health.map(h => h.steps);
  const calsList  = last30Health.map(h => h.calories);

  const generateWeekMarkers = (n) => n > 0 ? Array.from({length:n+1},()=>'<div class="week-marker"></div>').join('') : '';
  const totalBfWeeks = Math.ceil((settings.startBodyFat - settings.targetBodyFat) / bfLossRate);

  const changeLabel = (val, unit, lowerIsBetter) => {
    if (val === null) return '<span style="color:rgba(255,255,255,0.3);">—</span>';
    const good  = lowerIsBetter ? val < 0 : val > 0;
    const color = val === 0 ? 'rgba(255,255,255,0.4)' : good ? '#2ecc71' : '#e74c3c';
    return `<span style="color:${color};font-weight:700;">${val > 0 ? '+' : ''}${val}${unit}</span>`;
  };

  // ── Calorie Tracker week navigation ─────────────────────────────────────
  if (state.calorieWeekOffset === undefined) state.calorieWeekOffset = 0;
  const calWeekOffset = state.calorieWeekOffset || 0;
  const isCurrentWeek = calWeekOffset === 0;

  const refDate    = new Date(todayStr + 'T12:00:00');
  const refDow     = refDate.getDay();
  const refToMon   = refDow === 0 ? 6 : refDow - 1;
  const thisMonday = new Date(refDate);
  thisMonday.setDate(refDate.getDate() - refToMon + (calWeekOffset * 7));

  const CAL_DAY_NAMES   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const CAL_MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const calWeekDates = Array.from({length:7}, (_, i) => {
    const d = new Date(thisMonday); d.setDate(thisMonday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const formatCalDay = (ds) => {
    const d   = new Date(ds + 'T12:00:00');
    const dow = d.getDay();
    return `${CAL_DAY_NAMES[dow === 0 ? 6 : dow - 1]} ${d.getDate()} ${CAL_MONTH_NAMES[d.getMonth()]}`;
  };

  const calWeekLabel = (() => {
    const s = new Date(calWeekDates[0] + 'T12:00:00');
    const e = new Date(calWeekDates[6] + 'T12:00:00');
    const sameMonth = s.getMonth() === e.getMonth();
    return sameMonth
      ? `${s.getDate()}–${e.getDate()} ${CAL_MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`
      : `${s.getDate()} ${CAL_MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${CAL_MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
  })();

  let calWeeklyTotal = 0;
  let calWeeklyDays  = 0;

  const calDayData = calWeekDates.map(ds => {
    const sync       = (state.healthData || []).find(h => h.date === ds) || null;
    const dayEntry   = state.data?.days?.[ds] || {};
    const bmr        = sync?.bmr || settings.defaultBmr || 2085;
    const activeEnergy   = sync?.gymCalories || 0;
    const gymEntry       = dayEntry.gymCalEntry    || 0;
    const treadmillEntry = dayEntry.treadmillCal   || 0;
    const dietaryCal     = sync?.calories          || 0;
    const totalBurn      = bmr + activeEnergy + gymEntry + treadmillEntry;
    const deficit        = dietaryCal > 0 ? totalBurn - dietaryCal : null;
    const isToday        = ds === todayStr;
    const isFuture       = ds > todayStr;
    const hasSyncBmr     = !!sync?.bmr;
    const protein        = sync?.protein || null;
    if (deficit !== null) { calWeeklyTotal += deficit; calWeeklyDays++; }
    return { ds, bmr, activeEnergy, gymEntry, treadmillEntry, dietaryCal, totalBurn, deficit, isToday, isFuture, hasSyncBmr, protein };
  });

  // ── Build calorie day cards ─────────────────────────────────────────────
  const isLight = state.theme === 'light';
  const tx = (dark, light) => isLight ? light : dark;

  // ── Shared inner content renderer (used by both full and expandable compact cards) ──
  function renderCalDayInnerContent(day) {
    const deficitColor  = day.deficit === null ? tx('rgba(255,255,255,0.3)','rgba(0,0,0,0.25)') : day.deficit > 0 ? '#2ecc71' : '#e74c3c';
    const deficitAmt    = day.deficit === null ? '—' : (day.deficit > 0 ? '−' : '+') + Math.abs(Math.round(day.deficit)).toLocaleString() + ' kcal';
    const deficitStatus = day.deficit === null ? 'RESULT' : day.deficit > 0 ? 'DEFICIT' : 'SURPLUS';
    const subText       = tx('rgba(255,255,255,0.3)', 'rgba(0,0,0,0.35)');
    const dividerCol    = tx('rgba(255,255,255,0.07)', 'rgba(0,0,0,0.08)');
    const resultLabel   = tx('rgba(255,255,255,0.5)', 'rgba(0,0,0,0.45)');
    const resultSub     = tx('rgba(255,255,255,0.35)', 'rgba(0,0,0,0.35)');
    const inputBg       = tx('rgba(0,0,0,0.25)', 'rgba(52,152,219,0.06)');
    const inputBorder   = tx('rgba(52,152,219,0.3)', 'rgba(52,152,219,0.45)');
    const notSyncedCol  = tx('rgba(255,255,255,0.25)', 'rgba(0,0,0,0.25)');
    const syncLabelCol  = tx('rgba(255,255,255,0.3)', 'rgba(0,0,0,0.3)');

    return `


      <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(46,204,113,0.8);margin-bottom:7px;">BURN</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:7px;">
        <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.14);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(46,204,113,0.7);letter-spacing:1px;margin-bottom:3px;">BMR</div>
          <div style="font-size:17px;font-weight:700;color:#2ecc71;">${Math.round(day.bmr).toLocaleString()}<span style="font-size:9px;font-weight:400;color:rgba(46,204,113,0.55);"> kcal</span></div>
          <div style="font-size:9px;color:${subText};margin-top:2px;">${day.hasSyncBmr ? 'sync' : 'default'}</div>
        </div>
        <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.14);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(46,204,113,0.7);letter-spacing:1px;margin-bottom:3px;">ACTIVE ENERGY</div>
          <div style="font-size:17px;font-weight:700;color:#2ecc71;">${Math.round(day.activeEnergy).toLocaleString()}<span style="font-size:9px;font-weight:400;color:rgba(46,204,113,0.55);"> kcal</span></div>
          <div style="font-size:9px;color:${subText};margin-top:2px;">${day.activeEnergy > 0 ? 'sync' : 'no sync'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="background:rgba(52,152,219,0.05);border:1px solid rgba(52,152,219,0.15);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(52,152,219,0.8);letter-spacing:1px;margin-bottom:6px;">GYM CALORIES</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <input type="number" id="cal-gymCalEntry-${day.ds}" placeholder="0" value="${day.gymEntry || ''}" style="width:100%;min-width:0;background:${inputBg};border:1px solid ${inputBorder};border-radius:6px;color:#3498db;padding:5px 7px;font-size:13px;font-weight:700;outline:none;">
            <button onclick="logManualCalories('${day.ds}','gymCalEntry')" style="background:rgba(52,152,219,0.18);border:1px solid rgba(52,152,219,0.35);border-radius:6px;color:#3498db;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">LOG</button>
          </div>
        </div>
        <div style="background:rgba(52,152,219,0.05);border:1px solid rgba(52,152,219,0.15);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(52,152,219,0.8);letter-spacing:1px;margin-bottom:6px;">TREADMILL</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <input type="number" id="cal-treadmillCal-${day.ds}" placeholder="0" value="${day.treadmillEntry || ''}" style="width:100%;min-width:0;background:${inputBg};border:1px solid ${inputBorder};border-radius:6px;color:#3498db;padding:5px 7px;font-size:13px;font-weight:700;outline:none;">
            <button onclick="logManualCalories('${day.ds}','treadmillCal')" style="background:rgba(52,152,219,0.18);border:1px solid rgba(52,152,219,0.35);border-radius:6px;color:#3498db;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">LOG</button>
          </div>
        </div>
      </div>
      <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(231,76,60,0.8);margin-bottom:7px;">EAT</div>
      <div style="background:rgba(231,76,60,0.05);border:1px solid rgba(231,76,60,0.14);border-radius:8px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9px;font-weight:800;color:rgba(231,76,60,0.7);letter-spacing:1px;margin-bottom:3px;">DIETARY CALORIES</div>
          <div style="font-size:18px;font-weight:700;color:${day.dietaryCal > 0 ? '#e74c3c' : notSyncedCol};">
            ${day.dietaryCal > 0 ? Math.round(day.dietaryCal).toLocaleString() + '<span style="font-size:10px;font-weight:400;color:rgba(231,76,60,0.55);"> kcal</span>' : 'Not synced yet'}
          </div>
        </div>
        <div style="font-size:9px;color:${syncLabelCol};">${day.dietaryCal > 0 ? 'sync' : 'awaiting'}</div>
      </div>
      ${day.protein !== null ? `<div style="background:rgba(155,89,182,0.05);border:1px solid rgba(155,89,182,0.14);border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9px;font-weight:800;color:rgba(155,89,182,0.8);letter-spacing:1px;margin-bottom:2px;">PROTEIN</div>
          <div style="font-size:18px;font-weight:700;color:#9b59b6;">${Math.round(day.protein)}<span style="font-size:10px;font-weight:400;color:rgba(155,89,182,0.6);"> g</span></div>
        </div>
        <div style="font-size:9px;color:${syncLabelCol};">sync</div>
      </div>` : ''}
      <div style="border-top:1px solid ${dividerCol};padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:${resultLabel};">DAILY ${deficitStatus}</div>
          <div style="font-size:10px;color:${resultSub};margin-top:3px;">${Math.round(day.totalBurn).toLocaleString()} burn − ${day.dietaryCal > 0 ? Math.round(day.dietaryCal).toLocaleString() : '?'} eaten</div>
        </div>
        <div style="font-size:24px;font-weight:900;color:${deficitColor};">${deficitAmt}</div>
      </div>`;
  }

  function renderCalDayCardFull(day) {
    const borderCol  = day.isToday ? 'rgba(212,175,55,0.55)' : 'rgba(255,255,255,0.09)';
    const cardBg     = tx('rgba(255,255,255,0.03)', 'rgba(0,0,0,0.02)');
    const dayNameCol = day.isToday ? '#D4AF37' : tx('#fff', '#111');

    return `
    <div style="background:${cardBg};border:1px solid ${borderCol};border-left:3px solid ${borderCol};border-radius:12px;padding:14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:900;color:${dayNameCol};letter-spacing:0.3px;">${formatCalDay(day.ds)}</span>
        ${day.isToday ? '<span style="font-size:9px;font-weight:900;color:#D4AF37;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);border-radius:6px;padding:2px 8px;letter-spacing:1px;">TODAY</span>' : ''}
      </div>
      ${renderCalDayInnerContent(day)}
    </div>`;
  }

  function renderCalDayCardCompact(day) {
    // Solid dark colours — hardcoded so text is always legible in both light and dark page modes
    const deficitColor = day.deficit === null ? '#5a7a8a' : day.deficit > 0 ? '#2ecc71' : '#e74c3c';
    const deficitAmt   = day.deficit === null ? 'No data' : (day.deficit > 0 ? '−' : '+') + Math.abs(Math.round(day.deficit)).toLocaleString() + ' kcal';
    const proteinDisp  = day.protein != null ? Math.round(day.protein) + 'g' : null;
    const expandId     = `cal-expand-${day.ds}`;
    const arrowId      = `cal-arrow-${day.ds}`;

    return `
    <div style="background:#12202e;border:1px solid #1e3a52;border-left:3px solid #1e3a52;border-radius:10px;margin-bottom:6px;overflow:hidden;">
      <div
        onclick="(function(){
          var el=document.getElementById('${expandId}');
          var arrow=document.getElementById('${arrowId}');
          var isOpen=el.style.display!=='none';
          el.style.display=isOpen?'none':'block';
          arrow.textContent=isOpen?'▼':'▲';
          arrow.style.color=isOpen?'#4a6480':'#C9A84C';
        })()"
        style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;"
      >
        <span style="font-size:13px;font-weight:700;color:#a8bfd4;">${formatCalDay(day.ds)}</span>
        <div style="display:flex;align-items:center;gap:12px;">
          ${proteinDisp ? `<span style="font-size:11px;font-weight:700;color:#9b59b6;">${proteinDisp} <span style="font-size:9px;color:#6a3a8a;">protein</span></span>` : ''}
          <span style="font-size:13px;font-weight:800;color:${deficitColor};">${deficitAmt}</span>
          <span id="${arrowId}" style="font-size:9px;color:#4a6480;transition:color 0.2s;flex-shrink:0;">▼</span>
        </div>
      </div>
      <div id="${expandId}" style="display:none;padding:0 14px 14px 14px;border-top:1px solid #1a3348;background:#0f1c2a;">
        <div style="height:10px;"></div>
        ${renderCalDayInnerContent(day)}
      </div>
    </div>`;
  }

  function renderCalDayCardFuture(day) {
    const cardBg    = tx('rgba(255,255,255,0.01)', 'rgba(0,0,0,0.01)');
    const borderCol = tx('rgba(255,255,255,0.04)', 'rgba(0,0,0,0.05)');
    const labelCol  = tx('rgba(255,255,255,0.2)', 'rgba(0,0,0,0.18)');
    return `
    <div style="background:${cardBg};border:1px solid ${borderCol};border-radius:10px;padding:11px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;opacity:0.5;">
      <span style="font-size:13px;font-weight:700;color:${labelCol};">${formatCalDay(day.ds)}</span>
      <span style="font-size:11px;color:${labelCol};">—</span>
    </div>`;
  }

  // Today first (full card), past days compact below, future days dimmed at bottom
  const todayCard   = calDayData.filter(d => d.isToday).map(renderCalDayCardFull).join('');
  const pastCards   = calDayData.filter(d => !d.isToday && !d.isFuture).reverse().map(renderCalDayCardCompact).join('');
  const futureCards = calDayData.filter(d => d.isFuture && (d.gymEntry > 0 || d.treadmillEntry > 0)).map(renderCalDayCardFuture).join('');
  const weekTotalColor  = calWeeklyDays === 0 ? 'rgba(255,255,255,0.3)' : calWeeklyTotal > 0 ? '#2ecc71' : '#e74c3c';
  const weekTotalBg     = calWeeklyDays === 0 ? 'rgba(255,255,255,0.03)' : calWeeklyTotal > 0 ? 'rgba(46,204,113,0.07)' : 'rgba(231,76,60,0.07)';
  const weekTotalBorder = calWeeklyDays === 0 ? 'rgba(255,255,255,0.09)' : calWeeklyTotal > 0 ? 'rgba(46,204,113,0.22)' : 'rgba(231,76,60,0.22)';
  const weekTotalAmt    = calWeeklyDays === 0 ? '—' : (calWeeklyTotal > 0 ? '−' : '+') + Math.abs(Math.round(calWeeklyTotal)).toLocaleString() + ' kcal';
  const weekTotalLabel  = calWeeklyDays === 0 ? '' : calWeeklyTotal > 0 ? 'DEFICIT' : 'SURPLUS';

  const weekTotalHtml = `<div style="background:#0f1c2a;border:1px solid ${weekTotalBorder};border-left:4px solid ${weekTotalColor};border-radius:12px;padding:14px 16px;margin-bottom:8px;margin-top:4px;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.5);letter-spacing:1.5px;margin-bottom:3px;">WEEK TOTAL</div><div style="font-size:10px;color:rgba(255,255,255,0.35);">${calWeeklyDays} of 7 days with dietary data</div></div><div style="text-align:right;"><div style="font-size:28px;font-weight:900;color:${weekTotalColor};letter-spacing:-0.5px;">${weekTotalAmt}</div>${weekTotalLabel ? `<div style="font-size:10px;font-weight:700;color:${weekTotalColor};margin-top:1px;">${weekTotalLabel}</div>` : ''}</div></div></div>`;

  const calDayCardsHtml = todayCard + weekTotalHtml + pastCards + futureCards;

  // ── Main return ─────────────────────────────────────────────────────────
  return `

    <!-- ══ MONTHLY CALENDAR PROJECTION ══ -->
    ${(() => {
      const MN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const now = new Date(todayStr + 'T12:00:00');
      const yr  = now.getFullYear();
      const mo  = now.getMonth();
      const moStr       = todayStr.slice(0, 7);
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      const monthLabel  = MN[mo].toUpperCase() + ' ' + yr;

      const pad = n => String(n).padStart(2,'0');
      const calWeeks = [];
      let day = 1;
      while (day <= daysInMonth) {
        const start    = day;
        const end      = Math.min(day + 6, daysInMonth);
        const startStr = yr + '-' + pad(mo+1) + '-' + pad(start);
        const endStr   = yr + '-' + pad(mo+1) + '-' + pad(end);
        calWeeks.push({ start, end, startStr, endStr });
        day += 7;
      }

      const syncAll = [...(state.healthData || [])]
        .filter(h => h.date.startsWith(moStr))
        .sort((a, b) => a.date.localeCompare(b.date));

      const weekData = calWeeks.map((wk) => {
        const entries   = syncAll.filter(h => h.date >= wk.startStr && h.date <= wk.endStr);
        const actual    = entries.length > 0 ? entries[entries.length - 1] : null;
        const isPast    = wk.endStr < todayStr;
        const isCurrent = wk.startStr <= todayStr && wk.endStr >= todayStr;
        const isFuture  = wk.startStr > todayStr;
        // Always project to END of each week so partial weeks are handled correctly.
        // e.g. a 2-day final week: daysAhead/7 = 2/7 fraction → proportionally smaller drop.
        const daysAhead  = Math.max(0, (new Date(wk.endStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000);
        const wksAhead   = daysAhead / 7;
        // Future projections use the user's TARGET pace (bfLossRate), not actual pace
        const projWtPace = currentWeight * bfLossRate / 100;
        const projBF     = +(currentBF     - bfLossRate * wksAhead).toFixed(1);
        const projWt     = +(currentWeight - projWtPace * wksAhead).toFixed(1);
        // For the current week, always show a projected end-of-week figure
        // (current value minus target pace scaled to remaining days in week)
        const projEndBF = +(currentBF     - bfLossRate * (daysAhead / 7)).toFixed(1);
        const projEndWt = +(currentWeight - projWtPace * (daysAhead / 7)).toFixed(1);
        const dispBF    = isCurrent ? projEndBF : (actual?.bodyFat != null ? +actual.bodyFat.toFixed(1) : (isPast ? null : projBF));
        const dispWt    = isCurrent ? projEndWt : (actual?.weight  != null ? +actual.weight.toFixed(1)  : (isPast ? null : projWt));
        const locked    = actual != null && !isCurrent;
        return { ...wk, actual, isPast, isCurrent, isFuture, dispBF, dispWt, locked };
      });

      // YOU ARE HERE block — inserted before the current week
      const youAreHereStatusEl = (() => {
        if (blendedPace === null) return '';
        if (blendedPace < -0.05) {
          return '<span style="font-size:9px;font-weight:800;color:#e74c3c;background:#1f0a0a;border:1px solid #5a1a1a;border-radius:4px;padding:2px 7px;white-space:nowrap;">▲ GAINED</span>';
        } else if (blendedPace < bfLossRate * 0.55) {
          return '<span style="font-size:9px;font-weight:800;color:#f39c12;background:#1f1500;border:1px solid #7a4a00;border-radius:4px;padding:2px 7px;white-space:nowrap;">~ SLOW</span>';
        } else {
          return '<span style="font-size:9px;font-weight:800;color:#2ecc71;background:#0a1f14;border:1px solid #1a5a2a;border-radius:4px;padding:2px 7px;white-space:nowrap;">✓ ON TRACK</span>';
        }
      })();

      const youAreHereHtml =
        '<div style="background:#0d2a1a;border:2px solid #27ae60;border-radius:12px;padding:14px 16px;margin-bottom:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<div>' +
              '<div style="font-size:8px;font-weight:900;letter-spacing:2px;color:#27ae60;margin-bottom:4px;">📍 YOU ARE HERE</div>' +
              '<div style="font-size:10px;font-weight:700;color:#4a9a6a;">Today · ' + todayStr.split('-').reverse().join('/') + '</div>' +
            '</div>' +
            youAreHereStatusEl +
          '</div>' +
          '<div style="display:flex;gap:12px;">' +
            '<div style="text-align:center;">' +
              '<div style="font-size:9px;font-weight:900;color:rgba(39,174,96,0.7);letter-spacing:1px;margin-bottom:2px;">WEIGHT</div>' +
              '<div style="font-size:20px;font-weight:900;color:#2ecc71;letter-spacing:-0.5px;">' + currentWeight + '<span style="font-size:10px;font-weight:600;color:#4a9a6a;"> lb</span></div>' +
            '</div>' +
            '<div style="text-align:center;">' +
              '<div style="font-size:9px;font-weight:900;color:rgba(39,174,96,0.7);letter-spacing:1px;margin-bottom:2px;">BODY FAT</div>' +
              '<div style="font-size:20px;font-weight:900;color:#2ecc71;letter-spacing:-0.5px;">' + currentBF + '<span style="font-size:10px;font-weight:600;color:#4a9a6a;">%</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      // For each week, find the sync entry for exactly 7 days before wk.endStr.
      // This gives a true 7-day comparison regardless of calendar week boundaries.
      const allSync = [...(state.healthData || [])].filter(h => h.bodyFat != null);

      const getBFExact7DaysBefore = (endStr) => {
        const d = new Date(endStr + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        const target = d.toISOString().slice(0, 10);
        // Find the closest entry on exactly that date
        const exact = allSync.find(h => h.date === target);
        if (exact) return exact.bodyFat;
        // If no exact match, find the nearest entry within ±1 day
        const near = allSync
          .filter(h => Math.abs((new Date(h.date + 'T12:00:00') - new Date(target + 'T12:00:00')) / 86400000) <= 1)
          .sort((a, b) => Math.abs(new Date(a.date) - new Date(target + 'T12:00:00')) - Math.abs(new Date(b.date) - new Date(target + 'T12:00:00')));
        return near[0]?.bodyFat ?? null;
      };

      const weekRows = weekData.map((wk) => {
        const insertMarker = wk.isCurrent;  // marker goes just before THIS WEEK
        const wkLabel = MN[mo] + ' ' + wk.start + (wk.start !== wk.end ? '–' + wk.end : '');

        const cardBg      = wk.isCurrent ? '#1a2e42'  : wk.isFuture ? '#101822' : '#12202e';
        const cardBorder  = wk.isCurrent ? '#C9A84C'  : wk.locked    ? '#1e3a52' : '#172030';
        const borderWidth = wk.isCurrent ? '2px' : '1px';
        const cardOpacity = wk.isFuture ? 'opacity:0.7;' : '';
        const dateLabelColor = wk.isCurrent ? '#D4AF37' : wk.locked ? '#a8bfd4' : '#5a7a94';
        const innerBg     = wk.isCurrent ? '#0f1c2a' : '#0b1520';
        const innerBorder = wk.isCurrent ? '#2a4a6a' : '#162030';
        const goldVal     = '#D4AF37';
        const projVal     = '#5a7a94';
        const noDataV     = '#2a3a4a';
        const wtColor     = wk.isCurrent ? '#5dade2' : wk.locked ? goldVal : wk.isFuture ? projVal : noDataV;
        const bfColor     = wk.isCurrent ? '#5dade2' : wk.locked ? goldVal : wk.isFuture ? projVal : noDataV;
        const wtDisp      = wk.dispWt != null ? wk.dispWt + ' lb' : '—';
        const bfDisp      = wk.dispBF != null ? wk.dispBF + '%'   : '—';
        const projSubLabel = wk.isCurrent ? '<div style="font-size:8px;font-weight:700;color:rgba(93,173,226,0.55);letter-spacing:0.8px;margin-top:3px;">PROJ. END OF WEEK</div>' : '';

        const badge = wk.isCurrent
          ? '<span style="font-size:8px;font-weight:900;color:#D4AF37;background:#1a2e10;border:1px solid #C9A84C;border-radius:4px;padding:2px 7px;letter-spacing:1px;margin-right:6px;">THIS WEEK</span>'
          : wk.locked
            ? '<span style="font-size:8px;font-weight:700;color:#4a9a6a;background:#0a1f14;border:1px solid #1e5a34;border-radius:4px;padding:2px 7px;letter-spacing:1px;margin-right:6px;">🔒 LOCKED</span>'
            : wk.isFuture
              ? '<span style="font-size:8px;font-weight:700;color:#3a6a8a;background:#0a1824;border:1px solid #1a4060;border-radius:4px;padding:2px 7px;letter-spacing:1px;margin-right:6px;">~ PROJECTED</span>'
              : '<span style="font-size:8px;font-weight:700;color:#3a4a5a;background:#0a1520;border:1px solid #1a2a3a;border-radius:4px;padding:2px 7px;letter-spacing:1px;margin-right:6px;">NO DATA</span>';

        let statusEl = '';
        if (wk.locked && wk.actual?.bodyFat != null) {
          // Compare this week's BF to the previous week's BF for a real week-on-week change
          const prevBF      = getBFExact7DaysBefore(wk.endStr);
          const bfChange    = prevBF != null ? prevBF - wk.actual.bodyFat : null; // positive = lost BF

          if (bfChange === null) {
            // No previous week to compare — skip status
            statusEl = '';
          } else if (bfChange < 0) {
            // BF went UP — gained
            statusEl = '<span style="font-size:9px;font-weight:800;color:#e74c3c;background:#1f0a0a;border:1px solid #5a1a1a;border-radius:4px;padding:2px 7px;white-space:nowrap;">▲ GAINED</span>';
          } else if (bfChange < 0.4) {
            // Lost less than 0.4% — slow progress
            statusEl = '<span style="font-size:9px;font-weight:800;color:#f39c12;background:#1f1500;border:1px solid #7a4a00;border-radius:4px;padding:2px 7px;white-space:nowrap;">~ SLOW</span>';
          } else {
            // Lost 0.4%+ — on track
            statusEl = '<span style="font-size:9px;font-weight:800;color:#2ecc71;background:#0a1f14;border:1px solid #1a5a2a;border-radius:4px;padding:2px 7px;white-space:nowrap;">✓ ON TRACK</span>';
          }
        }

        const card = `
        <div style="background:${cardBg};border:${borderWidth} solid ${cardBorder};border-radius:12px;padding:14px;margin-bottom:8px;${cardOpacity}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
              ${badge}
              <span style="font-size:13px;font-weight:800;color:${dateLabelColor};">${wkLabel}</span>
            </div>
            ${statusEl}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:${innerBg};border:1px solid ${innerBorder};border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:900;color:rgba(201,168,76,0.6);letter-spacing:1.5px;margin-bottom:4px;">WEIGHT</div>
              <div style="font-size:22px;font-weight:900;color:${wtColor};letter-spacing:-0.5px;">${wtDisp}</div>
              ${projSubLabel}
            </div>
            <div style="background:${innerBg};border:1px solid ${innerBorder};border-radius:8px;padding:10px 12px;">
              <div style="font-size:9px;font-weight:900;color:rgba(201,168,76,0.6);letter-spacing:1.5px;margin-bottom:4px;">BODY FAT</div>
              <div style="font-size:22px;font-weight:900;color:${bfColor};letter-spacing:-0.5px;">${bfDisp}</div>
              ${projSubLabel}
            </div>
          </div>
        </div>`;

        return (insertMarker ? youAreHereHtml : '') + card;
      }).join('');

      const paceNote = !hasEnoughData
        ? 'Using target pace for projections — actual pace builds after a few days of sync data'
        : 'Pace: ' + effectivePace.toFixed(2) + '% BF/wk (' + (paceSource === 'blended' ? '60% 7d · 40% overall' : paceSource === 'overall' ? 'overall avg' : '7d avg') + ')';

      const actualPaceNote = !hasEnoughData
        ? 'Actual pace building...'
        : 'Actual: ' + effectivePace.toFixed(2) + '%/wk (' + (paceSource === 'blended' ? '7d+overall' : paceSource) + ')';

      return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;margin-bottom:8px;">
        <div class="section-title" style="margin-bottom:0;">${monthLabel}</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="text-align:right;">
            <div style="font-size:8px;font-weight:900;letter-spacing:1.5px;color:rgba(201,168,76,0.7);margin-bottom:3px;">TARGET PACE</div>
            <div style="display:flex;align-items:center;gap:4px;">
              <input
                type="number" step="0.05" min="0.1" max="3"
                value="${bfLossRate}"
                onchange="updateSetting('bfLossRate', parseFloat(this.value))"
                style="width:56px;background:#1a2e42 !important;border:1px solid #C9A84C;border-radius:6px;color:#D4AF37 !important;-webkit-text-fill-color:#D4AF37 !important;padding:5px 8px;font-size:13px;font-weight:900;outline:none;text-align:center;"
              >
              <span style="font-size:11px;font-weight:700;color:#C9A84C;">%/wk</span>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        ${weekRows}
        <div style="font-size:10px;color:rgba(255,255,255,0.35);padding:4px 2px 0;font-weight:600;">${actualPaceNote} · projections use target pace above</div>
      </div>`;
    })()}





    <!-- ══ HERO STRIP — top of page ══ -->
    <div class="body-hero-strip">
      <div>
        <div style="font-size:11px;font-weight:900;letter-spacing:2.5px;color:#C9A84C;margin-bottom:8px;">BODY FAT</div>
        <div style="font-size:46px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px;">${currentBF}<span style="font-size:22px;color:rgba(255,255,255,0.7);font-weight:700;">%</span></div>
        <div style="font-size:14px;font-weight:900;color:#C9A84C;margin-top:8px;">→ ${settings.targetBodyFat}% target</div>
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:4px;">${bfToLose.toFixed(1)}% to go${bfSyncLabel ? ` · ${bfSyncLabel}` : ''}</div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:900;letter-spacing:2.5px;color:#C9A84C;margin-bottom:8px;">WEIGHT</div>
        <div style="font-size:46px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px;">${currentWeight}<span style="font-size:22px;color:rgba(255,255,255,0.7);font-weight:700;">lb</span></div>
        <div style="font-size:14px;font-weight:900;color:#C9A84C;margin-top:8px;">→ ${targetWeight}lb target</div>
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.75);margin-top:4px;">${weightToLose.toFixed(1)}lb to go${weightSyncLabel ? ` · ${weightSyncLabel}` : ''}</div>
      </div>
    </div>

    <!-- ══ PROGRESS BARS ══ -->
    <div class="progress-section body-dark-card" style="margin-bottom:8px;margin-top:10px;">
      <div class="progress-label"><span style="color:#fff;font-weight:900;">Body Fat Progress</span><span style="color:#C9A84C;font-weight:900;">${bfPct.toFixed(1)}%</span></div>
      <div class="progress-bar-container">
        <div class="big-progress-bar"><div class="big-progress-fill" style="width:${bfPct}%;"></div></div>
        <div class="week-markers">${generateWeekMarkers(totalBfWeeks)}</div>
      </div>
      <div class="progress-milestones"><span>${settings.startBodyFat}%</span><span>${paceLabel}</span><span>${settings.targetBodyFat}%</span></div>
    </div>
    <div class="progress-section body-dark-card" style="margin-bottom:16px;">
      <div class="progress-label"><span style="color:#fff;font-weight:900;">Weight Progress</span><span style="color:#C9A84C;font-weight:900;">${weightPct.toFixed(1)}%</span></div>
      <div class="progress-bar-container">
        <div class="big-progress-bar"><div class="big-progress-fill" style="width:${weightPct}%;"></div></div>
      </div>
      <div class="progress-milestones"><span>${settings.startWeight} lb</span><span>${(settings.startWeight - currentWeight).toFixed(1)} lb lost</span><span>${targetWeight} lb</span></div>
    </div>

    <!-- ══ SETTINGS ══ -->
    <button class="settings-toggle" onclick="toggleSettings()">${state.showSettings ? '✕ Close Settings' : '⚙ Edit Goals & Settings'}</button>
    ${state.showSettings ? `
      <div class="settings-panel">
        <div class="settings-title">CHALLENGE SETTINGS</div>
        ${[
          {key:'startWeight',  label:'Start Weight',    unit:'lb'},
          {key:'startBodyFat', label:'Start Body Fat',  unit:'%'},
          {key:'defaultBmr',   label:'Default BMR',     unit:'kcal'},
          {key:'bfLossRate',   label:'BF Loss Rate /wk',unit:'%'},
        ].map(f => `
          <div class="settings-row">
            <span class="settings-label">${f.label}</span>
            <div class="settings-input-row">
              <input type="number" step="any" class="settings-input" value="${settings[f.key]}" onchange="updateSetting('${f.key}', this.value)">
              <span class="settings-unit">${f.unit}</span>
            </div>
          </div>
        `).join('')}
        <div class="settings-row">
          <span class="settings-label">Start Date</span>
          <div class="settings-input-row">
            <input type="date" class="settings-input" value="${settings.startDate || '2026-03-16'}" onchange="updateSetting('startDate', this.value)">
          </div>
        </div>
        <div style="margin-top:12px;margin-bottom:4px;">
          <div style="font-size:9px;letter-spacing:2px;color:rgba(212,175,55,0.7);margin-bottom:8px;">SET TARGET BY</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
            <button onclick="updateSetting('targetMode','date')" style="padding:8px;border-radius:8px;border:1px solid ${(settings.targetMode||'date')==='date'?'rgba(212,175,55,0.6)':'rgba(255,255,255,0.1)'};background:${(settings.targetMode||'date')==='date'?'rgba(212,175,55,0.12)':'transparent'};color:${(settings.targetMode||'date')==='date'?'#D4AF37':'rgba(255,255,255,0.4)'};font-size:11px;font-weight:600;cursor:pointer;">📅 End Date</button>
            <button onclick="updateSetting('targetMode','bf')"   style="padding:8px;border-radius:8px;border:1px solid ${settings.targetMode==='bf'?'rgba(212,175,55,0.6)':'rgba(255,255,255,0.1)'};background:${settings.targetMode==='bf'?'rgba(212,175,55,0.12)':'transparent'};color:${settings.targetMode==='bf'?'#D4AF37':'rgba(255,255,255,0.4)'};font-size:11px;font-weight:600;cursor:pointer;">🎯 BF Target</button>
          </div>
          ${(settings.targetMode||'date') === 'date' ? `
            <div class="settings-row" style="margin-bottom:0;">
              <span class="settings-label">End Date</span>
              <div class="settings-input-row">
                <input type="date" class="settings-input" value="${settings.deadline || ''}" onchange="updateSetting('deadline', this.value)">
              </div>
            </div>
            ${settings.deadline ? (() => {
              const weeks = Math.max(0, (new Date(settings.deadline) - new Date()) / (7 * 86400000));
              const reachableBF = +(currentBF - (settings.bfLossRate || 0.75) * weeks).toFixed(1);
              return `<div style="margin-top:6px;padding:8px 10px;background:rgba(212,175,55,0.07);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.5);">At ${settings.bfLossRate||0.75}%/wk you'll reach <span style="color:#D4AF37;font-weight:700;">${reachableBF}% BF</span> by ${new Date(settings.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>`;
            })() : ''}
          ` : `
            <div class="settings-row" style="margin-bottom:0;">
              <span class="settings-label">Target BF %</span>
              <div class="settings-input-row">
                <input type="number" step="0.1" class="settings-input" value="${settings.targetBodyFat || 14}" onchange="updateSetting('targetBodyFat', this.value)">
                <span class="settings-unit">%</span>
              </div>
            </div>
            ${settings.targetBodyFat ? (() => {
              const bfToLoseCalc  = Math.max(0, currentBF - settings.targetBodyFat);
              const weeksNeeded   = bfToLoseCalc / (settings.bfLossRate || 0.75);
              const endDate       = new Date(); endDate.setDate(endDate.getDate() + Math.ceil(weeksNeeded * 7));
              return `<div style="margin-top:6px;padding:8px 10px;background:rgba(212,175,55,0.07);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.5);">At ${settings.bfLossRate||0.75}%/wk you'll reach <span style="color:#D4AF37;font-weight:700;">${settings.targetBodyFat}%</span> by <span style="color:#D4AF37;font-weight:700;">${endDate.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span></div>`;
            })() : ''}
          `}
        </div>
        <div class="settings-row" style="background:rgba(212,175,55,0.06);border-radius:8px;padding:10px;margin-top:8px;">
          <span class="settings-label" style="color:rgba(212,175,55,0.8);font-size:12px;">⚡ Target weight auto-calculates from your BF target & lean mass.</span>
        </div>
      </div>
    ` : ''}

    <!-- ══ GOAL PROJECTION ══ -->
    <div class="body-dark-card" style="background:linear-gradient(145deg,#1e1e1e,#161616);border:1px solid rgba(255,255,255,0.07);border-left:4px solid rgba(201,168,76,0.5);border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
      <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:rgba(201,168,76,0.85);margin-bottom:14px;text-transform:uppercase;">🎯 GOAL PROJECTION</div>
      ${isGaining ? `
        <div style="background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);border-radius:10px;padding:12px;text-align:center;margin-bottom:10px;">
          <div style="font-size:18px;margin-bottom:4px;">⚠️</div>
          <div style="font-size:13px;font-weight:700;color:#e74c3c;">Currently Gaining BF</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">Projection paused — get back into deficit to resume</div>
        </div>
      ` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.7);letter-spacing:1.5px;margin-bottom:3px;">TARGET BF</div>
          <div style="font-size:28px;font-weight:900;color:#D4AF37;">${effectiveTargetBF}<span style="font-size:14px;font-weight:600;">%</span></div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.7);letter-spacing:1.5px;margin-bottom:3px;">EXPECTED WEIGHT</div>
          <div style="font-size:28px;font-weight:900;color:#D4AF37;">${expectedWeightAtGoal}<span style="font-size:14px;font-weight:600;">lb</span></div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.65);letter-spacing:1.5px;margin-bottom:4px;">PROJECTED DATE</div>
          <div style="font-size:14px;font-weight:700;color:${isGaining ? 'rgba(255,255,255,0.3)' : '#fff'};">${isGaining ? '—' : projectedDateStr}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.7);letter-spacing:1.5px;margin-bottom:3px;">WEEKS TO GO</div>
          <div style="font-size:28px;font-weight:900;color:${isGaining ? 'rgba(255,255,255,0.3)' : '#fff'};">${isGaining ? '—' : projectedWeeks}</div>
        </div>
      </div>
      <div style="background:rgba(201,168,76,0.07);border:1px solid rgba(201,168,76,0.2);border-radius:10px;padding:12px;">
        <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.8);margin-bottom:5px;letter-spacing:1.5px;">THIS WEEK'S TARGET WEIGHT</div>
        <div style="font-size:18px;font-weight:700;color:#D4AF37;">${weeklyTargetWeight} lb <span style="font-size:11px;font-weight:400;color:rgba(255,255,255,0.4);">based on ${bfLossRate}%/wk BF loss</span></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);margin-top:10px;">Pace: ${paceLabel}${!hasEnoughData ? ' · Building data — check back in a few days' : ''}</div>
    </div>

    <!-- ══ LEAN MASS ══ -->
    <div class="body-dark-card" style="background:linear-gradient(145deg,#1e1e1e,#161616);border:1px solid rgba(46,204,113,0.25);border-left:4px solid rgba(46,204,113,0.6);border-radius:14px;padding:16px;margin-bottom:16px;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.55);">START LEAN MASS</div>
          <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.3px;">${startLeanMass} lb</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.55);">CHANGE</div>
          <div style="font-size:18px;font-weight:700;color:${leanMassChange >= 0 ? '#2ecc71' : '#e74c3c'};">${leanMassChange >= 0 ? '+' : ''}${leanMassChange} lb</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;letter-spacing:1.5px;color:rgba(46,204,113,0.8);">CURRENT LEAN</div>
          <div style="font-size:22px;font-weight:900;color:#2ecc71;letter-spacing:-0.3px;">${currentLeanMass} lb</div>
        </div>
      </div>
    </div>

    <!-- ══ CALORIE TRACKER ══ -->
    <div class="section-title">Calorie Tracker</div>

    <!-- Week navigation -->
    <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 12px;margin-bottom:14px;gap:8px;">
      <button onclick="setCalorieWeekOffset(${calWeekOffset - 1})" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:7px 14px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;">← Prev</button>
      <div style="text-align:center;flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${calWeekLabel}</div>
        ${isCurrentWeek ? '<div style="font-size:9px;color:#C9A84C;font-weight:700;letter-spacing:1px;margin-top:2px;">CURRENT WEEK</div>' : ''}
      </div>
      <button
        onclick="${isCurrentWeek ? '' : `setCalorieWeekOffset(${calWeekOffset + 1})`}"
        ${isCurrentWeek ? 'disabled' : ''}
        style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:${isCurrentWeek ? 'rgba(255,255,255,0.25)' : '#fff'};padding:7px 14px;font-size:13px;font-weight:700;${isCurrentWeek ? 'cursor:not-allowed;opacity:0.4;' : 'cursor:pointer;'}flex-shrink:0;">Next →</button>
    </div>

    <!-- Day cards -->
    ${calDayCardsHtml}



    <!-- ══ WEEKLY & MONTHLY CHANGES ══ -->
    <div class="section-title">Changes</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="stat-card" style="padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">WEIGHT · SINCE SUN</div>
        <div style="font-size:26px;font-weight:900;">${changeLabel(weightChangeWeek, 'lb', true)}</div>
        ${weekBaseEntry ? `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:4px;">from ${weekBaseEntry.weight.toFixed(1)}lb on ${lastSundayStr.slice(5).replace('-','/')}</div>` : '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:4px;">no data from last Sun yet</div>'}
      </div>
      <div class="stat-card" style="padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">WEIGHT · SINCE 1ST</div>
        <div style="font-size:18px;">${changeLabel(weightChangeMonth, 'lb', true)}</div>
        ${monthBaseEntry ? `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:4px;">from ${monthBaseEntry.weight.toFixed(1)}lb on ${monthStartStr.slice(5).replace('-','/')}</div>` : '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:4px;">no data from 1st yet</div>'}
      </div>
      <div class="stat-card" style="padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">BODY FAT · SINCE SUN</div>
        <div style="font-size:18px;">${changeLabel(bfChangeWeek, '%', true)}</div>
        ${weekBaseEntry?.bodyFat ? `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:4px;">from ${weekBaseEntry.bodyFat.toFixed(1)}% on ${lastSundayStr.slice(5).replace('-','/')}</div>` : '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:4px;">no data from last Sun yet</div>'}
      </div>
      <div class="stat-card" style="padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">BODY FAT · SINCE 1ST</div>
        <div style="font-size:18px;">${changeLabel(bfChangeMonth, '%', true)}</div>
        ${monthBaseEntry?.bodyFat ? `<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:4px;">from ${monthBaseEntry.bodyFat.toFixed(1)}% on ${monthStartStr.slice(5).replace('-','/')}</div>` : '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-top:4px;">no data from 1st yet</div>'}
      </div>
    </div>

    <!-- ══ STEPS ══ -->
    <div class="section-title">Steps</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
      <div class="stat-card" style="padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(52,152,219,0.9);letter-spacing:1.5px;margin-bottom:5px;">THIS WEEK</div>
        ${(() => {
          const weekGoal = 70000;
          if (!weekSteps) return '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">No sync data</div><div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);margin-top:3px;">Finish iOS Shortcut</div>';
          const weekPct    = Math.min(100, Math.round((weekSteps / weekGoal) * 100));
          const weekPctCol = weekPct >= 100 ? '#2ecc71' : weekPct >= 70 ? '#C9A84C' : '#e74c3c';
          const delta      = weekStepsDelta !== null
            ? '<div style="font-size:11px;font-weight:800;color:' + (weekStepsDelta >= 0 ? '#2ecc71' : '#e74c3c') + ';margin-top:4px;">' + (weekStepsDelta >= 0 ? '▲' : '▼') + ' ' + Math.abs(weekStepsDelta).toLocaleString() + ' vs last wk</div>'
            : '';
          return '<div style="font-size:22px;font-weight:700;color:#3498db;">' + weekSteps.toLocaleString() + '<span style="font-size:13px;color:rgba(52,152,219,0.6);font-weight:600;"> / 70k</span></div>' +
            '<div style="height:5px;background:rgba(255,255,255,0.1);border-radius:3px;margin:7px 0;overflow:hidden;"><div style="height:100%;width:' + weekPct + '%;background:#3498db;border-radius:3px;transition:width 0.4s;"></div></div>' +
            '<div style="font-size:11px;font-weight:700;color:' + weekPctCol + ';margin-top:2px;">' + weekPct + '% of weekly goal</div>' + delta;
        })()}
      </div>
      <div class="stat-card" style="padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:900;color:rgba(52,152,219,0.9);letter-spacing:1.5px;margin-bottom:5px;">THIS MONTH</div>
        ${(() => {
          const now2 = new Date();
          const daysInMonth = new Date(now2.getFullYear(), now2.getMonth()+1, 0).getDate();
          const monthGoal   = 10000 * daysInMonth;
          if (!monthSteps) return '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">No sync data</div><div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);margin-top:3px;">Finish iOS Shortcut</div>';
          const moPct    = Math.min(100, Math.round((monthSteps / monthGoal) * 100));
          const moPctCol = moPct >= 100 ? '#2ecc71' : moPct >= 70 ? '#C9A84C' : '#e74c3c';
          const moGoalK  = Math.round(monthGoal / 1000);
          const delta    = monthStepsDelta !== null
            ? '<div style="font-size:11px;font-weight:800;color:' + (monthStepsDelta >= 0 ? '#2ecc71' : '#e74c3c') + ';margin-top:4px;">' + (monthStepsDelta >= 0 ? '▲' : '▼') + ' ' + Math.abs(monthStepsDelta).toLocaleString() + ' vs last mo</div>'
            : '';
          return '<div style="font-size:22px;font-weight:700;color:#3498db;">' + monthSteps.toLocaleString() + '<span style="font-size:13px;color:rgba(52,152,219,0.6);font-weight:600;"> / ' + moGoalK + 'k</span></div>' +
            '<div style="height:5px;background:rgba(255,255,255,0.1);border-radius:3px;margin:7px 0;overflow:hidden;"><div style="height:100%;width:' + moPct + '%;background:#3498db;border-radius:3px;transition:width 0.4s;"></div></div>' +
            '<div style="font-size:11px;font-weight:700;color:' + moPctCol + ';margin-top:2px;">' + moPct + '% of monthly goal</div>' + delta;
        })()}
      </div>
    </div>

    <!-- ══ MANUAL STEPS LOG ══ -->
    ${(() => {
      const manualEntries = Object.entries(state.data?.days || {})
        .filter(([, d]) => d.manualSteps > 0)
        .sort(([a], [b]) => b.localeCompare(a));

      // ── helpers ──────────────────────────────────────────────────────────
      const DN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

      const fmtDate = (ds) => {
        const d = new Date(ds + 'T12:00:00');
        return DN[d.getDay()] + ' ' + d.getDate() + ' ' + MN[d.getMonth()];
      };

      // Monday ISO string for a given date string
      const getMonday = (ds) => {
        const d = new Date(ds + 'T12:00:00');
        const dow = d.getDay();
        d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        return d.toISOString().slice(0, 10);
      };

      // "14 Apr – 20 Apr" label for a Monday string
      const fmtWeek = (monStr) => {
        const mon = new Date(monStr + 'T12:00:00');
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        return mon.getDate() + ' ' + MN[mon.getMonth()] + ' – ' + sun.getDate() + ' ' + MN[sun.getMonth()];
      };

      // "April 2026" label for a YYYY-MM string
      const fmtMonth = (ym) => {
        const [y, m] = ym.split('-');
        return ['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(m)-1] + ' ' + y;
      };

      const todayMonth = todayStr.slice(0, 7);
      const todayMonday = getMonday(todayStr);

      // ── build month → week → day hierarchy ───────────────────────────────
      const months = {};
      manualEntries.forEach(([ds, dayData]) => {
        const ym  = ds.slice(0, 7);
        const wk  = getMonday(ds);
        if (!months[ym])       months[ym]     = {};
        if (!months[ym][wk])   months[ym][wk] = [];
        months[ym][wk].push([ds, dayData]);
      });
      const sortedMonths = Object.keys(months).sort((a, b) => b.localeCompare(a));

      // ── render individual day row ─────────────────────────────────────────
      const renderDay = ([ds, dayData]) => {
        const expandId = 'msteps-expand-' + ds;
        const arrowId  = 'msteps-arrow-'  + ds;
        return (
          '<div style="background:#1a2b3c;border:1px solid #1e3a52;border-left:2px solid #2980b9;border-radius:8px;margin-top:5px;overflow:hidden;">' +
            '<div onclick="(function(){' +
              'var el=document.getElementById(\'' + expandId + '\');' +
              'var ar=document.getElementById(\'' + arrowId + '\');' +
              'var op=el.style.display!==\'none\';' +
              'el.style.display=op?\'none\':\'block\';' +
              'ar.textContent=op?\'▼\':\'▲\';' +
              'ar.style.color=op?\'#4a6480\':\'#3498db\';' +
            '})()" style="padding:9px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">' +
              '<span style="font-size:12px;font-weight:700;color:#cdd8e3;">' + fmtDate(ds) + '</span>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:13px;font-weight:800;color:#3498db;">' + Math.round(dayData.manualSteps).toLocaleString() + '<span style="font-size:9px;color:#5b9ec9;"> steps</span></span>' +
                '<span id="' + arrowId + '" style="font-size:9px;color:#4a6480;transition:color 0.2s;">▼</span>' +
              '</div>' +
            '</div>' +
            '<div id="' + expandId + '" style="display:none;padding:10px 12px 12px;border-top:1px solid #1a3348;background:#0f1c2a;">' +
              '<div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:#3498db;margin-bottom:8px;">EDIT · ' + fmtDate(ds).toUpperCase() + '</div>' +
              '<div style="display:flex;gap:6px;align-items:center;">' +
                '<input type="number" id="cal-manualSteps-' + ds + '" placeholder="Steps" value="' + (dayData.manualSteps || '') + '" style="flex:1;background:#1a2e42 !important;border:1px solid #2980b9 !important;border-radius:8px;color:#fff !important;-webkit-text-fill-color:#fff !important;padding:8px 10px;font-size:14px;font-weight:700;outline:none;">' +
                '<button onclick="logManualCalories(\'' + ds + '\',\'manualSteps\')" style="background:#1a4a6e;border:1px solid #2980b9;border-radius:8px;color:#5dade2;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;">SAVE</button>' +
                '<button onclick="(function(){var inp=document.getElementById(\'cal-manualSteps-' + ds + '\');inp.value=0;logManualCalories(\'' + ds + '\',\'manualSteps\');})()" style="background:#3d1a1a;border:1px solid #c0392b;border-radius:8px;color:#e74c3c;padding:8px 10px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;">DEL</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      };

      // ── render week group ─────────────────────────────────────────────────
      const renderWeek = (wk, entries) => {
        const wkTotal  = entries.reduce((s, [, d]) => s + (d.manualSteps || 0), 0);
        const wkId     = 'msteps-wk-' + wk;
        const wkArrId  = 'msteps-wkarr-' + wk;
        const isThisWk = wk === todayMonday;
        return (
          '<div style="background:#0f1c2a;border:1px solid #1a3348;border-radius:8px;margin-top:6px;overflow:hidden;">' +
            '<div onclick="(function(){' +
              'var el=document.getElementById(\'' + wkId + '\');' +
              'var ar=document.getElementById(\'' + wkArrId + '\');' +
              'var op=el.style.display!==\'none\';' +
              'el.style.display=op?\'none\':\'block\';' +
              'ar.textContent=op?\'▼\':\'▲\';' +
              'ar.style.color=op?\'#4a6480\':\'#3498db\';' +
            '})()" style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">' +
              '<div style="display:flex;align-items:center;gap:6px;">' +
                (isThisWk ? '<span style="font-size:7px;font-weight:900;color:#3498db;background:#0d2035;border:1px solid #2980b9;border-radius:3px;padding:1px 5px;letter-spacing:1px;">THIS WEEK</span>' : '') +
                '<span style="font-size:11px;font-weight:700;color:#a8bfd4;">' + fmtWeek(wk) + '</span>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:12px;font-weight:800;color:#3498db;">' + wkTotal.toLocaleString() + '<span style="font-size:9px;color:#5b9ec9;"> steps</span></span>' +
                '<span id="' + wkArrId + '" style="font-size:9px;color:#4a6480;">▼</span>' +
              '</div>' +
            '</div>' +
            '<div id="' + wkId + '" style="display:none;padding:0 8px 8px;">' +
              entries.map(renderDay).join('') +
            '</div>' +
          '</div>'
        );
      };

      // ── render month group ────────────────────────────────────────────────
      const monthsHtml = sortedMonths.map((ym) => {
        const weekMap    = months[ym];
        const sortedWks  = Object.keys(weekMap).sort((a, b) => b.localeCompare(a));
        const moTotal    = sortedWks.reduce((s, wk) => s + weekMap[wk].reduce((ss, [, d]) => ss + (d.manualSteps || 0), 0), 0);
        const moId       = 'msteps-mo-' + ym;
        const moArrId    = 'msteps-moarr-' + ym;
        const isThisMo   = ym === todayMonth;
        const weeksCount = sortedWks.length;
        return (
          '<div style="background:#111e2d;border:1px solid #1e3a52;border-radius:10px;margin-top:8px;overflow:hidden;">' +
            '<div onclick="(function(){' +
              'var el=document.getElementById(\'' + moId + '\');' +
              'var ar=document.getElementById(\'' + moArrId + '\');' +
              'var op=el.style.display!==\'none\';' +
              'el.style.display=op?\'none\':\'block\';' +
              'ar.textContent=op?\'▼\':\'▲\';' +
              'ar.style.color=op?\'#4a6480\':\'#3498db\';' +
            '})()" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                (isThisMo ? '<span style="font-size:7px;font-weight:900;color:#3498db;background:#0d2035;border:1px solid #2980b9;border-radius:3px;padding:2px 6px;letter-spacing:1px;">THIS MONTH</span>' : '') +
                '<div>' +
                  '<div style="font-size:13px;font-weight:800;color:#cdd8e3;">' + fmtMonth(ym) + '</div>' +
                  '<div style="font-size:9px;color:#4a6480;margin-top:1px;">' + weeksCount + ' week' + (weeksCount !== 1 ? 's' : '') + '</div>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;">' +
                '<div style="text-align:right;">' +
                  '<div style="font-size:15px;font-weight:900;color:#3498db;">' + moTotal.toLocaleString() + '</div>' +
                  '<div style="font-size:9px;color:#5b9ec9;">steps</div>' +
                '</div>' +
                '<span id="' + moArrId + '" style="font-size:9px;color:#4a6480;margin-left:2px;">▼</span>' +
              '</div>' +
            '</div>' +
            '<div id="' + moId + '" style="display:none;padding:0 10px 10px;">' +
              sortedWks.map(wk => renderWeek(wk, weekMap[wk])).join('') +
            '</div>' +
          '</div>'
        );
      }).join('');

      // ── section minimise ──────────────────────────────────────────────────
      const sectionOpen = localStorage.getItem('mstepsOpen') !== 'false';
      const bodyDisplay = sectionOpen ? 'block' : 'none';
      const hdrArrow    = sectionOpen ? '▲' : '▼';

      return `
      <div style="background:#111e2d;border-radius:12px;margin-bottom:16px;border:1px solid #1a2e42;overflow:hidden;">
        <style>
          #manual-step-date, #manual-step-count {
            color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;
            background: #1a2e42 !important; border-color: #2980b9 !important;
          }
          #manual-step-date::placeholder, #manual-step-count::placeholder { color: #4a6480 !important; }
          #manual-step-date::-webkit-calendar-picker-indicator { filter:invert(1) opacity(0.5); cursor:pointer; }
          #manual-step-date::-webkit-datetime-edit,
          #manual-step-date::-webkit-datetime-edit-fields-wrapper,
          #manual-step-date::-webkit-datetime-edit-text,
          #manual-step-date::-webkit-datetime-edit-month-field,
          #manual-step-date::-webkit-datetime-edit-day-field,
          #manual-step-date::-webkit-datetime-edit-year-field { color:#ffffff !important; }
          [id^="cal-manualSteps-"] {
            color:#ffffff !important; -webkit-text-fill-color:#ffffff !important;
            background:#1a2e42 !important;
          }
        </style>

        <!-- Section header / minimise -->
        <div onclick="(function(){
          var body=document.getElementById('msteps-body');
          var arr=document.getElementById('msteps-hdr-arrow');
          var open=body.style.display!=='none';
          body.style.display=open?'none':'block';
          arr.textContent=open?'▼':'▲';
          localStorage.setItem('mstepsOpen', String(!open));
        })()" style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:11px;">👟</span>
            <span style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:#3498db;">MANUAL STEPS</span>
            ${manualEntries.length > 0 ? `<span style="font-size:9px;color:#4a6480;">${manualEntries.length} entr${manualEntries.length === 1 ? 'y' : 'ies'}</span>` : ''}
          </div>
          <span id="msteps-hdr-arrow" style="font-size:10px;color:#4a6480;">${hdrArrow}</span>
        </div>

        <!-- Body -->
        <div id="msteps-body" style="display:${bodyDisplay};padding:0 14px 14px;border-top:1px solid #1a2e42;">

          <!-- Add entry -->
          <div style="display:flex;gap:6px;align-items:center;padding-top:12px;margin-bottom:4px;">
            <input type="date" id="manual-step-date" value="${todayStr}" max="${todayStr}"
              style="flex:1;min-width:0;border-radius:8px;padding:9px 10px;font-size:12px;font-weight:600;outline:none;color-scheme:dark;">
            <input type="number" id="manual-step-count" placeholder="Steps"
              style="width:88px;flex-shrink:0;border-radius:8px;padding:9px 10px;font-size:13px;font-weight:700;outline:none;">
            <button onclick="(function(){
              var date=document.getElementById('manual-step-date').value;
              var steps=parseInt(document.getElementById('manual-step-count').value);
              if(!date||!steps||steps<1)return;
              var inp=document.getElementById('cal-manualSteps-'+date);
              if(!inp){inp=document.createElement('input');inp.type='number';inp.id='cal-manualSteps-'+date;inp.style.display='none';document.body.appendChild(inp);}
              inp.value=steps;
              logManualCalories(date,'manualSteps');
              document.getElementById('manual-step-count').value='';
            })()" style="background:#1a4a6e;border:1px solid #2980b9;border-radius:8px;color:#5dade2;padding:9px 14px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;flex-shrink:0;">ADD</button>
          </div>

          <!-- Month → Week → Day groups -->
          ${monthsHtml}
          ${manualEntries.length === 0 ? '<div style="font-size:12px;color:#4a6480;text-align:center;padding:14px 0 4px;">No manual entries yet</div>' : ''}
        </div>
      </div>`;
    })()}

        <!-- ══ LATEST SYNC ══ -->
    ${(() => {
      const sorted      = [...(state.healthData||[])].sort((a,b)=>b.date.localeCompare(a.date));
      const todayHealth = sorted[0];
      if (!todayHealth) return `<div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;"><div style="font-size:24px;margin-bottom:8px;">⏳</div><div style="font-size:13px;color:rgba(255,255,255,0.5);">No sync data yet. Data arrives at midnight.</div></div>`;
      const isTodaySync = todayHealth.date === todayStr;
      const netCal      = (todayHealth.calories||0) > 0 ? ((todayHealth.bmr||0) + (todayHealth.gymCalories||0) - (todayHealth.calories||0)) : null;
      return `
        <div class="section-title">Latest Sync <span style="font-size:10px;color:rgba(255,255,255,0.3);font-weight:400;margin-left:6px;">${isTodaySync ? 'TODAY' : todayHealth.date} · AUTO · MIDNIGHT</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
          <div class="stat-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.7);letter-spacing:1px;">WEIGHT</div>
            <div style="font-size:18px;font-weight:700;color:#D4AF37;">${todayHealth.weight?.toFixed(1)||'—'}<span style="font-size:10px;"> lb</span></div>
          </div>
          <div class="stat-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.7);letter-spacing:1px;">BODY FAT</div>
            <div style="font-size:18px;font-weight:700;color:#D4AF37;">${todayHealth.bodyFat?.toFixed(1)||'—'}<span style="font-size:10px;">%</span></div>
          </div>
          <div class="stat-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(52,152,219,0.8);letter-spacing:1px;">STEPS</div>
            <div style="font-size:18px;font-weight:700;color:#3498db;">${todayHealth.steps?Math.round(todayHealth.steps).toLocaleString():'—'}</div>
          </div>
          <div class="stat-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(231,76,60,0.85);letter-spacing:1px;">CALORIES</div>
            <div style="font-size:18px;font-weight:700;color:#e74c3c;">${todayHealth.calories?Math.round(todayHealth.calories):'—'}<span style="font-size:10px;"> kcal</span></div>
          </div>
          <div class="stat-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(46,204,113,0.85);letter-spacing:1px;">ACTIVE CAL</div>
            <div style="font-size:18px;font-weight:700;color:#2ecc71;">${todayHealth.gymCalories?Math.round(todayHealth.gymCalories):'—'}<span style="font-size:10px;"> kcal</span></div>
          </div>
          <div class="stat-card body-dark-card" style="padding:12px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.8);letter-spacing:1px;">BMR</div>
            <div style="font-size:18px;font-weight:700;color:#fff;">${todayHealth.bmr?Math.round(todayHealth.bmr):'—'}<span style="font-size:10px;color:rgba(255,255,255,0.6);"> kcal</span></div>
          </div>
        </div>
        ${netCal !== null ? `<div class="stat-card" style="padding:12px;text-align:center;margin-bottom:12px;background:${netCal>0?'rgba(46,204,113,0.1)':'rgba(231,76,60,0.1)'};border-color:${netCal>0?'rgba(46,204,113,0.3)':'rgba(231,76,60,0.3)'};">
          <div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.65);letter-spacing:1px;">TODAY'S NET DEFICIT</div>
          <div style="font-size:22px;font-weight:700;color:${netCal>0?'#2ecc71':'#e74c3c'};">${netCal>0?'+':''}${Math.round(netCal).toLocaleString()} kcal</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);">${Math.round(todayHealth.bmr||0)} BMR + ${Math.round(todayHealth.gymCalories||0)} active − ${Math.round(todayHealth.calories||0)} eaten</div>
        </div>` : ''}
      `;
    })()}

    <!-- ══ SYNC LOG ══ -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div class="section-title" style="margin-bottom:0;">Sync Log</div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);" id="syncLogToggleLabel">${localStorage.getItem('syncLogHidden')==='true' ? 'Show' : 'Hide'}</span>
        <div onclick="(function(){const h=localStorage.getItem('syncLogHidden')==='true';localStorage.setItem('syncLogHidden',!h);document.getElementById('syncLogEntries').style.display=h?'flex':'none';document.getElementById('syncLogToggleLabel').textContent=h?'Hide':'Show';const sw=document.getElementById('syncLogSwitch');sw.style.background=h?'#C9A84C':'rgba(255,255,255,0.15)';sw.querySelector('span').style.transform=h?'translateX(18px)':'translateX(2px)';})()" id="syncLogSwitch" style="width:38px;height:22px;border-radius:11px;background:${localStorage.getItem('syncLogHidden')==='true' ? 'rgba(255,255,255,0.15)' : '#C9A84C'};position:relative;transition:background 0.2s;cursor:pointer;">
          <span style="position:absolute;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform 0.2s;transform:${localStorage.getItem('syncLogHidden')==='true' ? 'translateX(2px)' : 'translateX(18px)'};display:block;"></span>
        </div>
      </label>
    </div>
    <div id="syncLogEntries" style="display:${localStorage.getItem('syncLogHidden')==='true' ? 'none' : 'flex'};flex-direction:column;gap:6px;">
      ${[...(state.healthData||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14).map(h => {
        let fmtDate = h.date || '—';
        if (h.date && h.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dt     = new Date(h.date + 'T12:00:00');
          const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          fmtDate = days[dt.getDay()] + ' ' + dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
        }
        return `
        <div class="stat-card body-dark-card" style="padding:14px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:14px;font-weight:800;color:#fff;">${fmtDate}</span>
            <span style="font-size:15px;font-weight:900;color:#C9A84C;">${h.weight?h.weight.toFixed(1)+'lb':'—'}</span>
          </div>
          <div style="display:flex;gap:12px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);flex-wrap:wrap;">
            <span>BF <span style="color:#C9A84C;">${h.bodyFat?h.bodyFat.toFixed(1)+'%':'—'}</span></span>
            <span>Steps <span style="color:#3498db;">${h.steps?Math.round(h.steps).toLocaleString():'—'}</span></span>
            <span>Cal <span style="color:#e74c3c;">${h.calories?Math.round(h.calories):'—'}</span></span>
            <span>Active <span style="color:#2ecc71;">${h.gymCalories?Math.round(h.gymCalories)+'kcal':'—'}</span></span>
          </div>
        </div>`;
      }).join('')}
      ${(state.healthData||[]).length === 0 ? '<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:13px;padding:20px;">No synced data yet</div>' : ''}
    </div>
  `;
}
