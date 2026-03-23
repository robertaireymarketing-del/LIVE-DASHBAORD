export function renderMarchTab(deps) {

const { state, BATCH_COLOURS, getTodayData, getIdentityLock, getMissionTargets, getProjectFronts, getTJMBatches, getLatestWeight, getLatestBodyFat, getSettings, isSunday, getTodayDayKey, getWeekKey, getToday, getDayByDate, getMonthStats, getMonthDaysRemaining, getMonthTargets, getDerivedTargetWeight, getCurrentLeanMass, getStartLeanMass, getStreak, renderInputCard, renderStatCard, renderEditPanel, getJournalEntry } = deps;

// Helper: get word rating using the same WDS formula as the journal page
function getJournalWordRating(dateStr) {
  if (!getJournalEntry || !getDayByDate) return null;

  const day = getDayByDate(dateStr) || {};
  const morning = getJournalEntry(dateStr, 'morning');
  const evening = getJournalEntry(dateStr, 'evening');

  // Check if any data exists at all
  const hasHabits = day.gym || day.retention || day.meditation;
  const hasMorning = morning && Object.keys(morning).some(k => typeof morning[k] === 'number' && morning[k] > 0);
  const hasEvening = evening && Object.keys(evening).some(k => typeof evening[k] === 'number' && evening[k] > 0);
  if (!hasHabits && !hasMorning && !hasEvening) return null;

  const round1 = n => Math.round(Number(n || 0) * 10) / 10;
  const scale = (raw, rawMax, targetMax) => rawMax > 0 ? round1((Number(raw || 0) / rawMax) * targetMax) : 0;
  const g = (obj, key) => Number(obj?.[key] ?? 0);

  // Tier 1: habits (40pts max) — gym 15, retention 10, meditation 5, sleep 10
  const sleepRaw = g(evening, 'sleepprep');
  const tier1 = round1(
    (day.gym ? 15 : 0) +
    (day.retention ? 10 : 0) +
    (day.meditation ? 5 : 0) +
    Math.min(10, sleepRaw * 2)
  );

  // Tier 2: evening journal (40pts weighted from 30 raw)
  const eveningRaw = round1(['execution','discipline','dopamine','physical','builder','sleepprep'].reduce((s,k) => s + g(evening, k), 0));
  const tier2 = scale(eveningRaw, 30, 40);

  // Tier 3: morning journal (20pts weighted from 30 raw)
  const morningRaw = round1(['rested','sharpness','calm','motivation','clarity','drive'].reduce((s,k) => s + g(morning, k), 0));
  const tier3 = scale(morningRaw, 30, 20);

  const total = round1(tier1 + tier2 + tier3);
  const pct = Math.round((total / 100) * 100);

  if (pct >= 95) return { label: 'LEGENDARY', colour: '#D4AF37' };
  if (pct >= 90) return { label: 'ELITE',      colour: '#2ecc71' };
  if (pct >= 80) return { label: 'STRONG',     colour: '#3498db' };
  if (pct >= 70) return { label: 'ABOVE AVG',  colour: '#1abc9c' };
  if (pct >= 60) return { label: 'AVERAGE',    colour: '#f39c12' };
  if (pct >= 50) return { label: 'WEAK',       colour: '#e67e22' };
  return           { label: 'POOR',       colour: '#e74c3c' };
}

const y = state.calendarYear, m = state.calendarMonth;

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const monthName = monthNames[m];

const daysInMonth = new Date(y, m + 1, 0).getDate();

const firstDayOfWeek = new Date(y, m, 1).getDay(); // 0=Sun

// shift so Mon=0

const startOffset = (firstDayOfWeek + 6) % 7;

const today = getToday();

const ms = getMonthStats();

const daysLeft = getMonthDaysRemaining();

const isCurrentMonth = (new Date().getFullYear() === y && new Date().getMonth() === m);

// Build calendar cells

const dayHeaders = ['M','T','W','T','F','S','S'].map(d =>

`<div class="calendar-day-header">${d}</div>`).join('');

let cells = '';

for (let i = 0; i < startOffset; i++) {

cells += `<div class="calendar-day empty"></div>`;

}

for (let day = 1; day <= daysInMonth; day++) {

const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

const dayData = getDayByDate(dateStr) || {};

const isToday = dateStr === today;

const isFuture = dateStr > today;

const isSelected = state.selectedEditDate === dateStr;

// Habit tracking for colour

const didLive = !!dayData.live;

const didRetention = !!dayData.retention;

const didGym = !!dayData.gym;

const didMeditate = !!dayData.meditation;

// Core habits = retention + gym + meditation only (live is bonus, not core)
const coreHabitCount = [didRetention, didGym, didMeditate].filter(Boolean).length;

const isPast = !isFuture && !isToday;

// Colour based on CORE habit count (only for past/today days with any data)
const hasAnyData = coreHabitCount > 0 || didLive || (dayData.sales || 0) > 0;

let habitBg = '';

let habitBorder = '';

if (!isFuture && hasAnyData) {

if (coreHabitCount === 0) { habitBg = 'rgba(231,76,60,0.18)'; habitBorder = 'rgba(231,76,60,0.45)'; }

else if (coreHabitCount === 1) { habitBg = 'rgba(243,156,18,0.18)'; habitBorder = 'rgba(243,156,18,0.5)'; }

else if (coreHabitCount === 2) { habitBg = 'rgba(243,156,18,0.22)'; habitBorder = 'rgba(243,156,18,0.55)'; }

else if (coreHabitCount === 3) { habitBg = 'rgba(39,174,96,0.22)'; habitBorder = 'rgba(39,174,96,0.55)'; }

}

// Emoji row: retention, gym, meditation — plus gold star if live done
const hasAny = didRetention || didGym || didMeditate || didLive || (dayData.sales||0)>0;

const emojiGrid = hasAny ? `

<div style="display:flex;justify-content:center;gap:1px;margin-top:2px;flex-wrap:wrap;">

<span style="font-size:8px;line-height:1.4;opacity:${didRetention?1:0.15};">${didRetention?'🩸':'·'}</span>

<span style="font-size:8px;line-height:1.4;opacity:${didGym?1:0.15};">${didGym?'🏋️':'·'}</span>

<span style="font-size:8px;line-height:1.4;opacity:${didMeditate?1:0.15};">${didMeditate?'🧘':'·'}</span>

${didLive?'<span style="font-size:8px;line-height:1.4;" title="Live stream done">⭐</span>':''}

</div>` : '';

const baseStyle = habitBg ? `background:${habitBg};border-color:${habitBorder};` : '';

const todayStyle = isToday ? 'border:2px solid #D4AF37;color:#D4AF37;font-weight:700;' : '';

const selectedStyle = isSelected ? 'background:rgba(212,175,55,0.3);border:2px solid #D4AF37;' : '';

const morning = getJournalEntry(dateStr, 'morning');
const evening = getJournalEntry(dateStr, 'evening');
const bothComplete = morning?.complete && evening?.complete;
const journalRating = (!isFuture && bothComplete) ? getJournalWordRating(dateStr) : null;

// ── WORD RATING: dominant element, day number secondary ──
const ratingHtml = journalRating
  ? `<span style="display:block;font-size:13px;font-weight:900;letter-spacing:0.3px;color:${journalRating.colour};line-height:1;margin-top:1px;white-space:nowrap;text-shadow:0 0 12px ${journalRating.colour}80;">${journalRating.label}</span>`
  : '';

cells += `<button class="calendar-day${isFuture?' future':''}${isSelected?' selected':''}"

style="min-height:76px;${baseStyle}${todayStyle}${selectedStyle}"

onclick="selectEditDate('${dateStr}')" ${isFuture ? 'disabled' : ''}>

<span class="cal-day-num" style="font-size:${journalRating ? '10px' : '12px'};opacity:${journalRating ? '0.5' : '1'};">${day}</span>

${ratingHtml}

${emojiGrid}

</button>`;

}

// Month-specific targets

const monthTargets = getMonthTargets(y, m);

const livesTarget = monthTargets.lives;

const salesTarget = monthTargets.sales;

const gymTarget = monthTargets.gym;

const retentionTarget = monthTargets.retention;

// Last-month comparison — only for current month, compare stats at same day of month

let lastMonthComparisons = null;

if (isCurrentMonth) {

const today = new Date();

const todayDayOfMonth = today.getDate(); // e.g. 16

const lastM = m === 0 ? 11 : m - 1;

const lastY = m === 0 ? y - 1 : y;

const lastPrefix = `${lastY}-${String(lastM+1).padStart(2,'0')}`;

const lastMonthCutoff = `${lastPrefix}-${String(todayDayOfMonth).padStart(2,'0')}`;

const lm = { lives: 0, sales: 0, gymDays: 0, retentionDays: 0 };

Object.entries((state.data && state.data.days) || state.days || {}).forEach(([date, d]) => {

if (date.startsWith(lastPrefix) && date <= lastMonthCutoff) {

if (d.live) lm.lives++;

if (d.gym) lm.gymDays++;

if (d.retention) lm.retentionDays++;

lm.sales += d.sales || 0;

}

});

lastMonthComparisons = lm;

}

const lm = lastMonthComparisons;

// On-track pace

const daysElapsed = isCurrentMonth ? (daysInMonth - daysLeft) : daysInMonth;

const pacePct = daysInMonth > 0 ? daysElapsed / daysInMonth : 0;

const livesExpected = isCurrentMonth ? +(livesTarget * pacePct).toFixed(1) : undefined;

const salesExpected = isCurrentMonth ? +(salesTarget * pacePct).toFixed(1) : undefined;

const gymExpected = isCurrentMonth ? +(gymTarget * pacePct).toFixed(1) : undefined;

const retExpected = isCurrentMonth ? +(retentionTarget * pacePct).toFixed(1) : undefined;

// Body progress for month

const mSettings = getSettings();

const mCurrentWeight = getLatestWeight();

const mCurrentBF = getLatestBodyFat();

const mMonthPrefix = `${y}-${String(m+1).padStart(2,'0')}`;

const mHealthSorted = [...(state.healthData||[])].filter(h => h.date.startsWith(mMonthPrefix)).sort((a,b)=>a.date.localeCompare(b.date));

const mFirstEntry = mHealthSorted[0];

const mStartWeight = mFirstEntry?.weight || mSettings.startWeight || mCurrentWeight;

const mStartBF = mFirstEntry?.bodyFat || mSettings.startBodyFat || mCurrentBF;

const weeksInMon = daysInMonth / 7;

const weeksElapsed = daysElapsed / 7;

const mEndTargetWeight = +(mStartWeight - (weeksInMon * 1.4)).toFixed(1);

const mEndTargetBF = +(mStartBF - (weeksInMon * 0.75)).toFixed(1);

const mWtChange = mFirstEntry ? +(mCurrentWeight - mStartWeight).toFixed(1) : null;

const mBFChange = mFirstEntry ? +(mCurrentBF - mStartBF).toFixed(1) : null;

const mExpectedWtNow = +(mStartWeight - (weeksElapsed * 1.4)).toFixed(1);

const mExpectedBFNow = +(mStartBF - (weeksElapsed * 0.75)).toFixed(1);

const mWtVsExpected = (isCurrentMonth && mFirstEntry) ? +(mCurrentWeight - mExpectedWtNow).toFixed(1) : null;

const mBFVsExpected = (isCurrentMonth && mFirstEntry) ? +(mCurrentBF - mExpectedBFNow).toFixed(2) : null;

return `

${isCurrentMonth ? `

<div class="countdown">

<span class="countdown-num">${daysLeft}</span>

<span class="countdown-label">DAYS LEFT IN ${monthName.toUpperCase()}</span>

</div>` : ''}

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">

<div style="font-size:11px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.35);">${monthName.toUpperCase()} ${y} TARGETS</div>

<button onclick="openMonthTargets()" style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:20px;padding:6px 14px;color:#C9A84C;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">✎ Set Targets</button>

</div>

<div class="stats-grid">

${renderStatCard(ms.lives, livesTarget, 'LIVES', lm?.lives, livesExpected)}

${renderStatCard(ms.sales, salesTarget, 'SALES', lm?.sales, salesExpected)}

${renderStatCard(ms.gymDays, gymTarget, 'GYM DAYS', lm?.gymDays, gymExpected)}

${renderStatCard(ms.retentionDays, retentionTarget, 'RETENTION', lm?.retentionDays, retExpected)}

<div class="stat-card body-dark-card" style="background:linear-gradient(145deg,#1a1200,#2a1f00);border:1px solid rgba(201,168,76,0.4);border-left:4px solid #C9A84C;cursor:pointer;" onclick="openRetentionModal()">

<div class="stat-value" style="color:#D4AF37;">${getStreak('retention')}</div>

<div class="stat-label">🩸 CURRENT STREAK</div>

<div style="font-size:10px;color:rgba(212,175,55,0.6);margin-top:4px;">tap to explore →</div>

</div>

<div class="stat-card"><div class="stat-value">£${ms.revenue || 0}</div><div class="stat-label">REVENUE</div></div>

<div class="stat-card"><div class="stat-value">${ms.warmLeads || 0}</div><div class="stat-label">WARM LEADS</div></div>

<div class="stat-card"><div class="stat-value">${ms.dmsSent || 0}</div><div class="stat-label">DMs SENT</div></div>

</div>

<div class="section-title">Body Progress — ${monthName}</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">

<div class="stat-card body-dark-card" style="padding:14px;">

<div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">WEIGHT</div>

<div style="font-size:24px;font-weight:900;color:#fff;line-height:1;">${mCurrentWeight}<span style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;"> lb</span></div>

${mWtChange !== null ? `<div style="font-size:12px;font-weight:700;color:${mWtChange <= 0 ? '#2ecc71' : '#e74c3c'};margin-top:4px;">${mWtChange > 0 ? '+' : ''}${mWtChange} lb since 1st</div>` : '<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">No month data yet</div>'}

<div style="height:1px;background:rgba(255,255,255,0.08);margin:8px 0;"></div>

<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:2px;">Month-end target</div>

<div style="font-size:16px;font-weight:800;color:#C9A84C;">${mEndTargetWeight} lb</div>

${mWtVsExpected !== null ? `<div style="font-size:9px;font-weight:900;color:${mWtVsExpected <= 0.5 ? (mWtVsExpected <= -1 ? '#2ecc71' : '#C9A84C') : '#e74c3c'};background:${mWtVsExpected <= 0.5 ? (mWtVsExpected <= -1 ? 'rgba(46,204,113,0.12)' : 'rgba(201,168,76,0.1)') : 'rgba(231,76,60,0.12)'};border:1px solid ${mWtVsExpected <= 0.5 ? (mWtVsExpected <= -1 ? 'rgba(46,204,113,0.25)' : 'rgba(201,168,76,0.25)') : 'rgba(231,76,60,0.25)'};border-radius:20px;padding:3px 8px;display:inline-block;margin-top:6px;letter-spacing:0.5px;">${mWtVsExpected <= 0.5 ? (mWtVsExpected <= -1 ? '\u{1F525} ' + Math.abs(mWtVsExpected) + 'lb ahead' : '✓ ON PACE') : '⚠ ' + mWtVsExpected + 'lb behind'}</div>` : ''}

</div>

<div class="stat-card body-dark-card" style="padding:14px;">

<div style="font-size:10px;font-weight:900;color:rgba(201,168,76,0.75);letter-spacing:1.5px;margin-bottom:6px;">BODY FAT</div>

<div style="font-size:24px;font-weight:900;color:#fff;line-height:1;">${mCurrentBF}<span style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;"> %</span></div>

${mBFChange !== null ? `<div style="font-size:12px;font-weight:700;color:${mBFChange <= 0 ? '#2ecc71' : '#e74c3c'};margin-top:4px;">${mBFChange > 0 ? '+' : ''}${mBFChange}% since 1st</div>` : '<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">No month data yet</div>'}

<div style="height:1px;background:rgba(255,255,255,0.08);margin:8px 0;"></div>

<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:2px;">Month-end target</div>

<div style="font-size:16px;font-weight:800;color:#C9A84C;">${mEndTargetBF}%</div>

${mBFVsExpected !== null ? `<div style="font-size:9px;font-weight:900;color:${mBFVsExpected <= 0.05 ? (mBFVsExpected <= -0.1 ? '#2ecc71' : '#C9A84C') : '#e74c3c'};background:${mBFVsExpected <= 0.05 ? (mBFVsExpected <= -0.1 ? 'rgba(46,204,113,0.12)' : 'rgba(201,168,76,0.1)') : 'rgba(231,76,60,0.12)'};border:1px solid ${mBFVsExpected <= 0.05 ? (mBFVsExpected <= -0.1 ? 'rgba(46,204,113,0.25)' : 'rgba(201,168,76,0.25)') : 'rgba(231,76,60,0.25)'};border-radius:20px;padding:3px 8px;display:inline-block;margin-top:6px;letter-spacing:0.5px;">${mBFVsExpected <= 0.05 ? (mBFVsExpected <= -0.1 ? '\u{1F525} ' + Math.abs(mBFVsExpected) + '% ahead' : '✓ ON PACE') : '⚠ ' + mBFVsExpected + '% behind'}</div>` : ''}

</div>

</div>

<div class="section-title">Edit Past Days</div>

<div class="cal-nav">

<button class="cal-nav-btn" onclick="navigateCalendar(-1)">‹</button>

<span class="cal-nav-title">${monthName} ${y}</span>

<button class="cal-nav-btn" onclick="navigateCalendar(1)">›</button>

</div>

<div class="calendar-grid">

${dayHeaders}

${cells}

</div>

${(() => {

// Build retention streak chain for visible month

const streakDays = [];

for (let d = 1; d <= daysInMonth; d++) {

const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

streakDays.push({ ds, ret: !!((getDayByDate(ds)||{}).retention), future: ds > today });

}

// Find streak runs

let html = '<div style="margin-bottom:10px;">';

html += '<div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#C9A84C;margin-bottom:8px;">🔗 RETENTION STREAK</div>';

html += '<div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center;">';

let currentRun = 0;

streakDays.forEach(({ds, ret, future}, i) => {

const prevRet = i > 0 ? streakDays[i-1].ret : false;

const nextRet = i < streakDays.length-1 ? streakDays[i+1]?.ret : false;

if (ret) {

currentRun++;

const isStart = !prevRet;

const isEnd = !nextRet;

const br = isStart ? '5px 2px 2px 5px' : isEnd ? '2px 5px 5px 2px' : '2px';

html += `<div title="✓ Retained ${ds}" style="height:12px;flex:1;min-width:8px;max-width:14px;border-radius:${br};background:linear-gradient(90deg,#1a7a3a,#2ecc71);box-shadow:0 1px 6px rgba(46,204,113,0.5);"></div>`;

} else {

currentRun = 0;

if (future) {

html += `<div title="${ds}" style="height:12px;flex:1;min-width:8px;max-width:14px;border-radius:2px;background:rgba(255,255,255,0.07);"></div>`;

} else {

html += `<div title="✗ Missed ${ds}" style="height:12px;flex:1;min-width:8px;max-width:14px;border-radius:2px;background:linear-gradient(90deg,#8B0000,#e74c3c);box-shadow:0 1px 4px rgba(231,76,60,0.4);"></div>`;

}

}

});

html += '</div></div>';

return html;

})()}

<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">

<span style="font-size:11px;color:rgba(255,255,255,0.4);">🩸 Retention &nbsp; 🏋️ Gym &nbsp; 🧘 Meditation &nbsp; 📷 Live</span>

</div>

${state.selectedEditDate ? renderEditPanel() : ''}

`;

}
