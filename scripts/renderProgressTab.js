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
  const weekSteps          = thisWeekData.reduce((s, h) => s + (h.steps || 0), 0);

  const lastWeekMonDate = new Date(weekStartDate); lastWeekMonDate.setDate(weekStartDate.getDate() - 7);
  const lastWeekMonStr  = lastWeekMonDate.toISOString().slice(0, 10);
  const lastWeekSamePointDate = new Date(lastWeekMonDate); lastWeekSamePointDate.setDate(lastWeekMonDate.getDate() + daysBackToMon);
  const lastWeekSamePointStr  = lastWeekSamePointDate.toISOString().slice(0, 10);
  const lastWeekSamePointData = (state.healthData || []).filter(h => h.date >= lastWeekMonStr && h.date <= lastWeekSamePointStr);
  const lastWeekSameSteps     = lastWeekSamePointData.reduce((s, h) => s + (h.steps || 0), 0);
  const weekStepsDelta        = lastWeekSameSteps > 0 ? weekSteps - lastWeekSameSteps : null;

  const monthPrefix   = todayStr.slice(0, 7);
  const monthHealthData = (state.healthData || []).filter(h => h.date.startsWith(monthPrefix));
  const monthSteps    = monthHealthData.reduce((s, h) => s + (h.steps || 0), 0);
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
    if (deficit !== null) { calWeeklyTotal += deficit; calWeeklyDays++; }
    return { ds, bmr, activeEnergy, gymEntry, treadmillEntry, dietaryCal, totalBurn, deficit, isToday, isFuture, hasSyncBmr };
  });

  // ── Build calorie day cards ─────────────────────────────────────────────
  function renderCalDayCard(day) {
    const borderCol    = day.isToday ? 'rgba(212,175,55,0.55)' : day.isFuture ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)';
    const deficitColor = day.deficit === null ? 'rgba(255,255,255,0.3)' : day.deficit > 0 ? '#2ecc71' : '#e74c3c';
    const deficitAmt   = day.deficit === null ? '—' : (day.deficit > 0 ? '−' : '+') + Math.abs(Math.round(day.deficit)).toLocaleString() + ' kcal';
    const deficitStatus = day.deficit === null ? '' : day.deficit > 0 ? 'DEFICIT' : 'SURPLUS';

    if (day.isFuture) {
      return `
      <div style="background:rgba(255,255,255,0.02);border:1px solid ${borderCol};border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;opacity:0.4;">
        <span style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.5);">${formatCalDay(day.ds)}</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.25);">Future</span>
      </div>`;
    }

    return `
    <div style="background:rgba(255,255,255,0.03);border:1px solid ${borderCol};border-left:3px solid ${borderCol};border-radius:12px;padding:14px;margin-bottom:8px;">

      <!-- Day header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:900;color:${day.isToday ? '#D4AF37' : '#fff'};letter-spacing:0.3px;">${formatCalDay(day.ds)}</span>
        ${day.isToday ? '<span style="font-size:9px;font-weight:900;color:#D4AF37;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);border-radius:6px;padding:2px 8px;letter-spacing:1px;">TODAY</span>' : ''}
      </div>

      <!-- BURN label -->
      <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(46,204,113,0.8);margin-bottom:7px;">BURN</div>

      <!-- BMR + Active (from sync) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:7px;">
        <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.12);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(46,204,113,0.65);letter-spacing:1px;margin-bottom:3px;">BMR</div>
          <div style="font-size:17px;font-weight:700;color:#2ecc71;">${Math.round(day.bmr).toLocaleString()}<span style="font-size:9px;font-weight:400;color:rgba(46,204,113,0.55);"> kcal</span></div>
          <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">${day.hasSyncBmr ? 'sync' : 'default'}</div>
        </div>
        <div style="background:rgba(46,204,113,0.05);border:1px solid rgba(46,204,113,0.12);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(46,204,113,0.65);letter-spacing:1px;margin-bottom:3px;">ACTIVE ENERGY</div>
          <div style="font-size:17px;font-weight:700;color:#2ecc71;">${Math.round(day.activeEnergy).toLocaleString()}<span style="font-size:9px;font-weight:400;color:rgba(46,204,113,0.55);"> kcal</span></div>
          <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px;">${day.activeEnergy > 0 ? 'sync' : 'no sync'}</div>
        </div>
      </div>

      <!-- Gym + Treadmill (manual inputs) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="background:rgba(52,152,219,0.05);border:1px solid rgba(52,152,219,0.15);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(52,152,219,0.75);letter-spacing:1px;margin-bottom:6px;">GYM CALORIES</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <input type="number" id="cal-gymCalEntry-${day.ds}" placeholder="0" value="${day.gymEntry || ''}" style="width:100%;min-width:0;background:rgba(0,0,0,0.3);border:1px solid rgba(52,152,219,0.25);border-radius:6px;color:#3498db;padding:5px 7px;font-size:13px;font-weight:700;outline:none;">
            <button onclick="logManualCalories('${day.ds}','gymCalEntry')" style="background:rgba(52,152,219,0.18);border:1px solid rgba(52,152,219,0.35);border-radius:6px;color:#3498db;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">LOG</button>
          </div>
        </div>
        <div style="background:rgba(52,152,219,0.05);border:1px solid rgba(52,152,219,0.15);border-radius:8px;padding:9px;">
          <div style="font-size:9px;font-weight:800;color:rgba(52,152,219,0.75);letter-spacing:1px;margin-bottom:6px;">TREADMILL</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <input type="number" id="cal-treadmillCal-${day.ds}" placeholder="0" value="${day.treadmillEntry || ''}" style="width:100%;min-width:0;background:rgba(0,0,0,0.3);border:1px solid rgba(52,152,219,0.25);border-radius:6px;color:#3498db;padding:5px 7px;font-size:13px;font-weight:700;outline:none;">
            <button onclick="logManualCalories('${day.ds}','treadmillCal')" style="background:rgba(52,152,219,0.18);border:1px solid rgba(52,152,219,0.35);border-radius:6px;color:#3498db;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">LOG</button>
          </div>
        </div>
      </div>

      <!-- EAT label -->
      <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(231,76,60,0.8);margin-bottom:7px;">EAT</div>

      <!-- Dietary calories (from sync) -->
      <div style="background:rgba(231,76,60,0.05);border:1px solid rgba(231,76,60,0.12);border-radius:8px;padding:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9px;font-weight:800;color:rgba(231,76,60,0.65);letter-spacing:1px;margin-bottom:3px;">DIETARY CALORIES</div>
          <div style="font-size:18px;font-weight:700;color:${day.dietaryCal > 0 ? '#e74c3c' : 'rgba(255,255,255,0.25)'};">
            ${day.dietaryCal > 0 ? Math.round(day.dietaryCal).toLocaleString() + '<span style="font-size:10px;font-weight:400;color:rgba(231,76,60,0.55);"> kcal</span>' : 'Not synced yet'}
          </div>
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.3);">${day.dietaryCal > 0 ? 'sync' : 'awaiting'}</div>
      </div>

      <!-- Daily result -->
      <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.5);">DAILY ${deficitStatus || 'RESULT'}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:3px;">
            ${Math.round(day.totalBurn).toLocaleString()} burn − ${day.dietaryCal > 0 ? Math.round(day.dietaryCal).toLocaleString() : '?'} eaten
          </div>
        </div>
        <div style="font-size:24px;font-weight:900;color:${deficitColor};">${deficitAmt}</div>
      </div>

    </div>`;
  }

  const calDayCardsHtml = calDayData.map(renderCalDayCard).join('');

  const weekTotalColor  = calWeeklyDays === 0 ? 'rgba(255,255,255,0.3)' : calWeeklyTotal > 0 ? '#2ecc71' : '#e74c3c';
  const weekTotalBg     = calWeeklyDays === 0 ? 'rgba(255,255,255,0.03)' : calWeeklyTotal > 0 ? 'rgba(46,204,113,0.07)' : 'rgba(231,76,60,0.07)';
  const weekTotalBorder = calWeeklyDays === 0 ? 'rgba(255,255,255,0.09)' : calWeeklyTotal > 0 ? 'rgba(46,204,113,0.22)' : 'rgba(231,76,60,0.22)';
  const weekTotalAmt    = calWeeklyDays === 0 ? '—' : (calWeeklyTotal > 0 ? '−' : '+') + Math.abs(Math.round(calWeeklyTotal)).toLocaleString() + ' kcal';
  const weekTotalLabel  = calWeeklyDays === 0 ? '' : calWeeklyTotal > 0 ? 'DEFICIT' : 'SURPLUS';

  // ── Main return ─────────────────────────────────────────────────────────
  return `

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

    <!-- Weekly total -->
    <div style="background:${weekTotalBg};border:1px solid ${weekTotalBorder};border-radius:14px;padding:16px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.6);letter-spacing:1.5px;">WEEK TOTAL</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:3px;">${calWeeklyDays} of 7 days with dietary data</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:30px;font-weight:900;color:${weekTotalColor};">${weekTotalAmt}</div>
          ${weekTotalLabel ? `<div style="font-size:11px;font-weight:700;color:${weekTotalColor};margin-top:1px;">${weekTotalLabel}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- ══ 4-WEEK PROJECTION ══ -->
    ${(() => {
      const rows = [1,2,3,4].map(w => {
        const actualBf    = +(currentBF     - effectivePace * w).toFixed(1);
        const actualWt    = +(currentWeight - effectiveWtPace * w).toFixed(1);
        const targetBf    = +(currentBF     - bfLossRate * w).toFixed(1);
        const targetWt    = +(currentWeight - targetWtPace * w).toFixed(1);
        const onTrack     = hasEnoughData ? (effectivePace >= bfLossRate * 0.8) : null;
        const statusColor = isGaining ? '#e74c3c' : onTrack === null ? 'rgba(255,255,255,0.3)' : onTrack ? '#2ecc71' : '#e74c3c';
        const statusIcon  = isGaining ? '⚠️' : onTrack === null ? '—' : onTrack ? '✅' : '⚠️';
        const statusText  = isGaining ? 'Gaining' : onTrack === null ? 'Est.' : onTrack ? 'On track' : 'Behind';
        return { w, actualBf, actualWt, targetBf, targetWt, statusColor, statusIcon, statusText };
      });
      return `
      <div class="section-title" style="margin-top:4px;">4-Week Projection</div>
      <div style="background:linear-gradient(145deg,#1a1a1a,#141414);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:16px;box-shadow:0 4px 16px rgba(0,0,0,0.4);">
        <div style="display:grid;grid-template-columns:60px 1fr 1fr 64px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.3);">
          <div></div>
          <div style="font-size:10px;font-weight:900;color:#C9A84C;letter-spacing:1.5px;text-align:center;">YOUR PACE</div>
          <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.6);letter-spacing:1.5px;text-align:center;">TARGET</div>
          <div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.6);letter-spacing:1.5px;text-align:center;">STATUS</div>
        </div>
        ${rows.map((r, i) => `
        <div style="display:grid;grid-template-columns:60px 1fr 1fr 64px;padding:12px 14px;${i < 3 ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}align-items:center;">
          <div>
            <div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.8);letter-spacing:1px;">WK ${r.w}</div>
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.55);margin-top:2px;">${(() => { const d = new Date(); d.setDate(d.getDate() + r.w*7); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); })()}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:17px;font-weight:700;color:#D4AF37;">${r.actualWt}<span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);"> lb</span></div>
            <div style="font-size:12px;color:rgba(212,175,55,0.7);">${r.actualBf}<span style="font-size:10px;">%</span></div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:17px;font-weight:700;color:rgba(255,255,255,0.75);">${r.targetWt}<span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.45);"> lb</span></div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);">${r.targetBf}<span style="font-size:10px;">%</span></div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:16px;">${r.statusIcon}</div>
            <div style="font-size:9px;color:${r.statusColor};margin-top:2px;">${r.statusText}</div>
          </div>
        </div>`).join('')}
        <div style="padding:10px 14px 12px;font-size:11px;color:rgba(255,255,255,0.45);border-top:1px solid rgba(255,255,255,0.07);">
          ${!hasEnoughData ? '* Using target pace — builds after a few days of data' : `Pace: ${effectivePace.toFixed(2)}% BF/wk (${paceSource === 'blended' ? '60% 7d · 40% overall' : paceSource === 'overall' ? 'overall avg' : '7d avg'}) vs ${bfLossRate}% target`}
        </div>
      </div>`;
    })()}

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
