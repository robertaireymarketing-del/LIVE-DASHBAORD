export function initJournalTab(deps) {

  const dayName = document.getElementById('journalDayName');
  if (!dayName) return;

  const fullDate = document.getElementById('journalFullDate');
  const datePicker = document.getElementById('journalDatePicker');
  const calendarBtn = document.getElementById('journalCalendarBtn');
  const prevDayBtn = document.getElementById('journalPrevDayBtn');
  const nextDayBtn = document.getElementById('journalNextDayBtn');
  const entryStatus = document.getElementById('journalEntryStatus');
  const bestVersionScore = document.getElementById('journalBestVersionScore');
  const morningAveragesNote = document.getElementById('journalMorningAveragesNote');
  const eveningAveragesNote = document.getElementById('journalEveningAveragesNote');
  const streakEl = document.getElementById('journalStreak');
  const weekMissionEl = document.getElementById('journalWeekMission');
  const jumpTodayBtn = document.getElementById('journalJumpToday');
  const morningCard = document.getElementById('journalMorningCard');
  const morningBadge = document.getElementById('journalMorningCompletionBadge');
  const morningSavedPill = document.getElementById('journalMorningSavedPill');
  const morningScoreValue = document.getElementById('journalMorningScoreValue');
  const eveningCard = document.getElementById('journalEveningCard');
  const eveningBadge = document.getElementById('journalEveningCompletionBadge');
  const eveningSavedPill = document.getElementById('journalEveningSavedPill');
  const eveningScoreValue = document.getElementById('journalEveningScoreValue');
  const openCard = document.getElementById('journalOpenCard');
  const openBadge = document.getElementById('journalOpenCompletionBadge');
  const openSavedPill = document.getElementById('journalOpenSavedPill');
  const openMorningBtn = document.getElementById('journalOpenMorningBtn');
  const openEveningBtn = document.getElementById('journalOpenEveningBtn');
  const openOpenBtn = document.getElementById('journalOpenOpenBtn');

  let currentDate = new Date(((deps.state.journalDate) || deps.getToday()) + 'T12:00:00');

  const morningFields = {
    rested: document.getElementById('journal-rested-range'), sharpness: document.getElementById('journal-sharpness-range'), calm: document.getElementById('journal-calm-range'), motivation: document.getElementById('journal-motivation-range'), clarity: document.getElementById('journal-clarity-range'), drive: document.getElementById('journal-drive-range'),
    powerfulSelf: document.getElementById('journal-powerfulSelf'), mostImportantAction: document.getElementById('journal-mostImportantAction'), loseGain: document.getElementById('journal-loseGain'), unstoppable: document.getElementById('journal-unstoppable')
  };
  const eveningFields = {
    execution: document.getElementById('journal-execution-range'), discipline: document.getElementById('journal-discipline-range'), dopamine: document.getElementById('journal-dopamine-range'), physical: document.getElementById('journal-physical-range'), builder: document.getElementById('journal-builder-range'), sleepprep: document.getElementById('journal-sleepprep-range'),
    proud: document.getElementById('journal-proud'), learned: document.getElementById('journal-learned'), release: document.getElementById('journal-release'), alignment: document.getElementById('journal-alignment'),
    grateful1: document.getElementById('journal-grateful1'), grateful2: document.getElementById('journal-grateful2'), grateful3: document.getElementById('journal-grateful3'), grateful4: document.getElementById('journal-grateful4'), grateful5: document.getElementById('journal-grateful5'), grateful6: document.getElementById('journal-grateful6')
  };

  const morningBindings = [['rested','journal-rested-val'],['sharpness','journal-sharpness-val'],['calm','journal-calm-val'],['motivation','journal-motivation-val'],['clarity','journal-clarity-val'],['drive','journal-drive-val']];
  const eveningBindings = [['execution','journal-execution-val'],['discipline','journal-discipline-val'],['dopamine','journal-dopamine-val'],['physical','journal-physical-val'],['builder','journal-builder-val'],['sleepprep','journal-sleepprep-val']];
  const openTextField = document.getElementById('journal-openText');

  const keyFromDate = d => d.toISOString().split('T')[0];
  const isFilled = v => String(v || '').trim().length > 0;
  const isToday = () => keyFromDate(currentDate) === deps.getToday();

  const formatDateDisplay = d => {
    dayName.textContent = d.toLocaleDateString('en-GB',{weekday:'long'});
    fullDate.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    datePicker.value = keyFromDate(d);
    deps.state.journalDate = keyFromDate(d);
    if (jumpTodayBtn) jumpTodayBtn.style.display = isToday() ? 'none' : 'flex';
  };

  const getStartOfWeek = d => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setHours(12,0,0,0); x.setDate(x.getDate()+diff); return x; };
  const getDateKeyFromOffset = (base, offset) => { const x = new Date(base); x.setHours(12,0,0,0); x.setDate(x.getDate()+offset); return keyFromDate(x); };
  const average = vals => { const valid = vals.filter(v => typeof v === 'number'); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null; };
  const formatAvg = (avg,max) => avg === null ? '--' : `${avg.toFixed(1)}/${max}`;

  function getJournalEntry(dateKey, session) {
    const fb = deps.state.data?.journal?.[dateKey]?.[session];
    if (fb) return fb;
    try { const raw = localStorage.getItem((session === 'morning' ? 'morningJournal-' : 'eveningJournal-') + dateKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function setJournalEntry(dateKey, session, payload) {
    if (!deps.state.data.journal) deps.state.data.journal = {};
    if (!deps.state.data.journal[dateKey]) deps.state.data.journal[dateKey] = {};
    deps.state.data.journal[dateKey][session] = payload;
    deps.saveDataQuiet();
  }

  const getStoredScore = (prefix, key) => {
    const session = prefix.startsWith('morning') ? 'morning' : 'evening';
    const entry = getJournalEntry(key, session);
    return (entry && typeof entry.score === 'number') ? entry.score : null;
  };

  function computeJournalStreak() {
    let streak = 0;
    const today = deps.getToday();
    let check = new Date(today + 'T12:00:00');
    check.setDate(check.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const key = keyFromDate(check);
      const m = getJournalEntry(key, 'morning');
      const e = getJournalEntry(key, 'evening');
      if (m?.complete && e?.complete) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else { break; }
    }
    return streak;
  }

  function updateStreakDisplay() {
    if (!streakEl) return;
    const streak = computeJournalStreak();
    const today = deps.getToday();
    const todayM = getJournalEntry(today, 'morning');
    const todayE = getJournalEntry(today, 'evening');
    const todayMComplete = !!todayM?.complete;
    const todayEComplete = !!todayE?.complete;
    const bothComplete = todayMComplete && todayEComplete;
    const warning = (!todayMComplete || !todayEComplete);
    const warningHtml = warning
      ? `<span style="color:#e74c3c;margin-left:6px;" title="${!todayMComplete ? 'Morning journal incomplete' : 'Evening journal incomplete'}">⚠️</span>`
      : '';
    streakEl.innerHTML = `<span style="font-size:22px;font-weight:900;color:${bothComplete ? '#2ecc71' : '#C9A84C'};">${streak}</span><span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);margin-left:4px;">day streak</span>${warningHtml}`;
  }

  function updateWeekMission() {
    if (!weekMissionEl || !deps.getWeekKey) return;
    const weekKey = deps.getWeekKey(currentDate);
    const raw = deps.state.data.weekObjectives?.[weekKey];
    const objs = Array.isArray(raw) ? raw : (raw ? [{text:raw,done:false}] : []);
    if (!objs.length) {
      weekMissionEl.innerHTML = `<span style="opacity:0.4;font-style:italic;">No objectives set for this week</span>`;
    } else {
      weekMissionEl.innerHTML = objs.map(o =>
        `<div class="journal-mission-obj${o.done?' done':''}">` +
        `<span class="journal-mission-tick">${o.done ? '✓' : '◯'}</span>` +
        `<span class="journal-mission-text">${o.text}</span>` +
        `</div>`
      ).join('');
    }
  }

  function computeHistoricalAverages(){
    const currentWeekStart = getStartOfWeek(currentDate);
    const lastWeekMorning=[], lastWeekEvening=[];
    for(let i=0;i<7;i++){ const key=getDateKeyFromOffset(currentWeekStart,i-7); lastWeekMorning.push(getStoredScore('morningJournal-',key)); lastWeekEvening.push(getStoredScore('eveningJournal-',key)); }
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12, 0, 0, 0);
    const monthMorning=[], monthEvening=[];
    const cursor=new Date(monthStart);
    while(cursor<=currentDate){ const key=keyFromDate(cursor); monthMorning.push(getStoredScore('morningJournal-',key)); monthEvening.push(getStoredScore('eveningJournal-',key)); cursor.setDate(cursor.getDate()+1); }
    return { morningLastWeek: average(lastWeekMorning), eveningLastWeek: average(lastWeekEvening), morningMonth: average(monthMorning), eveningMonth: average(monthEvening) };
  }

  function updateAverageNotes(){
    const avgs=computeHistoricalAverages();
    morningAveragesNote.textContent=`Vs last week: ${formatAvg(avgs.morningLastWeek,30)} · Vs month: ${formatAvg(avgs.morningMonth,30)}`;
    eveningAveragesNote.textContent=`Vs last week: ${formatAvg(avgs.eveningLastWeek,30)} · Vs month: ${formatAvg(avgs.eveningMonth,30)}`;
  }

  function getDayHabitData(dateKey) {
    return deps.state.data?.days?.[dateKey] || {};
  }

  function round1(num) {
    return Math.round(Number(num || 0) * 10) / 10;
  }

  function formatScore(score, max) {
    const val = round1(score);
    const isInt = Math.abs(val - Math.round(val)) < 0.05;
    return `${isInt ? Math.round(val) : val.toFixed(1)}/${max}`;
  }

  function scaleScore(raw, rawMax, targetMax) {
    return rawMax > 0 ? round1((Number(raw || 0) / rawMax) * targetMax) : 0;
  }

  function getTier1Breakdown(dateKey = keyFromDate(currentDate)) {
    const day = getDayHabitData(dateKey);
    const sleepRaw = Number(eveningFields.sleepprep?.value ?? getJournalEntry(dateKey, 'evening')?.sleepprep ?? 0);
    const sleepPoints = Math.min(10, sleepRaw * 2);
    const rows = [
      ['Gym', day.gym ? 15 : 0, 15, day.gym ? 'Ticked on Today page' : 'Not ticked on Today page'],
      ['Retention', day.retention ? 10 : 0, 10, day.retention ? 'Ticked on Today page' : 'Not ticked on Today page'],
      ['Meditation', day.meditation ? 5 : 0, 5, day.meditation ? 'Ticked on Today page' : 'Not ticked on Today page'],
      ['Sleep', sleepPoints, 10, `Evening sleep prep ${sleepRaw}/5 × 2`],
    ];
    const total = round1(rows.reduce((sum, [, score]) => sum + Number(score || 0), 0));
    return { rows, total, max: 40 };
  }

  function getMorningBreakdown(dateKey = keyFromDate(currentDate)) {
    const rows = [
      ['Rested', Number(morningFields.rested?.value ?? getJournalEntry(dateKey, 'morning')?.rested ?? 0), 5],
      ['Sharpness', Number(morningFields.sharpness?.value ?? getJournalEntry(dateKey, 'morning')?.sharpness ?? 0), 5],
      ['Calm', Number(morningFields.calm?.value ?? getJournalEntry(dateKey, 'morning')?.calm ?? 0), 5],
      ['Motivation', Number(morningFields.motivation?.value ?? getJournalEntry(dateKey, 'morning')?.motivation ?? 0), 5],
      ['Clarity', Number(morningFields.clarity?.value ?? getJournalEntry(dateKey, 'morning')?.clarity ?? 0), 5],
      ['Drive', Number(morningFields.drive?.value ?? getJournalEntry(dateKey, 'morning')?.drive ?? 0), 5],
    ];
    const rawTotal = round1(rows.reduce((sum, [, score]) => sum + Number(score || 0), 0));
    const weightedTotal = scaleScore(rawTotal, 30, 15);
    return { rows, rawTotal, weightedTotal, rawMax: 30, max: 15 };
  }

  function getEveningBreakdown(dateKey = keyFromDate(currentDate)) {
    const rows = [
      ['Execution', Number(eveningFields.execution?.value ?? getJournalEntry(dateKey, 'evening')?.execution ?? 0), 5],
      ['Discipline', Number(eveningFields.discipline?.value ?? getJournalEntry(dateKey, 'evening')?.discipline ?? 0), 5],
      ['Dopamine control', Number(eveningFields.dopamine?.value ?? getJournalEntry(dateKey, 'evening')?.dopamine ?? 0), 5],
      ['Physical standard', Number(eveningFields.physical?.value ?? getJournalEntry(dateKey, 'evening')?.physical ?? 0), 5],
      ['Builder actions', Number(eveningFields.builder?.value ?? getJournalEntry(dateKey, 'evening')?.builder ?? 0), 5],
      ['Sleep prep', Number(eveningFields.sleepprep?.value ?? getJournalEntry(dateKey, 'evening')?.sleepprep ?? 0), 5],
    ];
    const rawTotal = round1(rows.reduce((sum, [, score]) => sum + Number(score || 0), 0));
    const weightedTotal = scaleScore(rawTotal, 30, 45);
    return { rows, rawTotal, weightedTotal, rawMax: 30, max: 45 };
  }

  function getWeightedScores(dateKey = keyFromDate(currentDate)) {
    const tier1 = getTier1Breakdown(dateKey);
    const tier2 = getEveningBreakdown(dateKey);
    const tier3 = getMorningBreakdown(dateKey);
    const total = round1(tier1.total + tier2.weightedTotal + tier3.weightedTotal);
    return { tier1, tier2, tier3, total, max: 100 };
  }

  function getPerformanceTier(score){
    const percent = Math.round((Number(score || 0) / 100) * 100);
    const colour = percent >= 95 ? '#D4AF37' : percent >= 90 ? '#2ecc71' : percent >= 80 ? '#3498db' : percent >= 70 ? '#1abc9c' : percent >= 60 ? '#f39c12' : percent >= 50 ? '#e67e22' : '#e74c3c';
    const status = percent >= 95 ? 'LEGENDARY' : percent >= 90 ? 'ELITE' : percent >= 80 ? 'STRONG' : percent >= 70 ? 'ABOVE AVERAGE' : percent >= 60 ? 'AVERAGE' : percent >= 50 ? 'WEAK' : 'POOR';
    return { percent, colour, status };
  }

  function getCombinedAverageForRange(startDate, endDate){
    const totals = [];
    const cursor = new Date(startDate);
    cursor.setHours(12,0,0,0);
    const finish = new Date(endDate);
    finish.setHours(12,0,0,0);
    while (cursor <= finish) {
      const key = keyFromDate(cursor);
      const total = getWeightedScores(key).total;
      if (typeof total === 'number' && !Number.isNaN(total)) totals.push(total);
      cursor.setDate(cursor.getDate() + 1);
    }
    return totals.length ? round1(totals.reduce((a,b) => a + b, 0) / totals.length) : null;
  }

  function ensureBestVersionModal(){
    let modal = document.getElementById('journalBestVersionModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'journalBestVersionModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,10,20,0.52);backdrop-filter:blur(10px);z-index:9999;display:none;align-items:flex-end;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div id="journalBestVersionPanel" style="width:min(720px,100%);max-height:88vh;overflow:auto;background:#ffffff;border:1px solid rgba(15,23,42,0.10);border-radius:24px;padding:20px 18px 18px;box-shadow:0 20px 60px rgba(0,0,0,0.22);color:#0f172a;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <div>
            <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:rgba(15,23,42,0.45);text-transform:uppercase;">Overall ranking breakdown</div>
            <div id="journalBestVersionModalDate" style="font-size:24px;font-weight:900;line-height:1.1;margin-top:6px;color:#0f172a;">Today</div>
            <div style="font-size:12px;color:rgba(15,23,42,0.62);margin-top:4px;">Your weighted 100-point daily standard</div>
          </div>
          <button type="button" id="journalBestVersionCloseBtn" style="background:#f8fafc;border:1px solid rgba(15,23,42,0.10);color:#0f172a;border-radius:12px;padding:10px 12px;font:inherit;font-weight:800;cursor:pointer;">Close</button>
        </div>
        <div id="journalBestVersionModalBody"></div>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeBestVersionModal();
    });
    document.body.appendChild(modal);
    const closeBtn = document.getElementById('journalBestVersionCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeBestVersionModal);
    return modal;
  }

  function closeBestVersionModal(){
    const modal = document.getElementById('journalBestVersionModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function openBestVersionModal(){
    const scores = getWeightedScores();
    const { tier1, tier2, tier3, total } = scores;
    const { percent, colour, status } = getPerformanceTier(total);
    const modal = ensureBestVersionModal();
    const body = document.getElementById('journalBestVersionModalBody');
    const dateLabel = document.getElementById('journalBestVersionModalDate');
    if (!body || !dateLabel) return;

    dateLabel.textContent = fullDate.textContent;

    const lastWeekStart = getStartOfWeek(currentDate);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12, 0, 0, 0);
    const lastWeekCombined = getCombinedAverageForRange(lastWeekStart, lastWeekEnd);
    const monthCombined = getCombinedAverageForRange(monthStart, currentDate);
    const vsLastWeek = lastWeekCombined === null ? null : round1(total - lastWeekCombined);
    const vsMonth = monthCombined === null ? null : round1(total - monthCombined);

    const tiers = [
      ['Legendary', '95–100', '95–100 / 100'],
      ['Elite', '90–94.9', '90–94.9 / 100'],
      ['Strong', '80–89.9', '80–89.9 / 100'],
      ['Above average', '70–79.9', '70–79.9 / 100'],
      ['Average', '60–69.9', '60–69.9 / 100'],
      ['Weak', '50–59.9', '50–59.9 / 100'],
      ['Poor', '< 50', '0–49.9 / 100'],
    ];

    const fmtDelta = (val) => {
      if (val === null || Number.isNaN(val)) return '--';
      const rounded = round1(val);
      return `${rounded > 0 ? '+' : ''}${Math.abs(rounded - Math.round(rounded)) < 0.05 ? Math.round(rounded) : rounded.toFixed(1)}`;
    };
    const avgTone = (val) => val === null ? 'rgba(15,23,42,0.45)' : (val >= 0 ? '#16a34a' : '#dc2626');
    const cardStyle = 'background:#ffffff;border:1px solid rgba(15,23,42,0.10);border-radius:18px;padding:14px;';
    const muted = 'rgba(15,23,42,0.58)';
    const faint = 'rgba(15,23,42,0.08)';
    const divider = 'rgba(15,23,42,0.08)';

    const renderRows = (rows, options = {}) => rows.map(([label, score, max, note], idx) => `
      <div style="padding:${idx === 0 ? '0 0 10px' : '10px 0'};border-top:${idx === 0 ? 'none' : `1px solid ${divider}`};">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a;">${label}</div>
            <div style="font-size:12px;color:${muted};margin-top:2px;">${note || `${Math.round((Number(score || 0) / Number(max || 1)) * 100)}% of max`}</div>
          </div>
          <div style="text-align:right;white-space:nowrap;">
            <div style="font-size:18px;font-weight:900;color:#0f172a;">${formatScore(score, max)}</div>
          </div>
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px;">
        <div style="grid-column:1/-1;${cardStyle}">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;">Current rank</div>
              <div style="font-size:34px;font-weight:900;color:${colour};line-height:1.05;margin-top:6px;">${status}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:28px;font-weight:900;color:${colour};">${formatScore(total, 100)}</div>
              <div style="font-size:12px;color:${muted};">${percent}% daily standard</div>
            </div>
          </div>
          <div style="height:8px;background:${faint};border-radius:999px;overflow:hidden;margin-top:14px;">
            <div style="height:100%;width:${Math.min(100, percent)}%;background:${colour};border-radius:999px;"></div>
          </div>
        </div>
        <div style="${cardStyle}">
          <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;">Vs last week</div>
          <div style="font-size:28px;font-weight:900;color:${avgTone(vsLastWeek)};margin-top:8px;">${fmtDelta(vsLastWeek)}</div>
          <div style="font-size:12px;color:${muted};">Average ${lastWeekCombined === null ? '--' : formatScore(lastWeekCombined, 100)}</div>
        </div>
        <div style="${cardStyle}">
          <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;">Vs month</div>
          <div style="font-size:28px;font-weight:900;color:${avgTone(vsMonth)};margin-top:8px;">${fmtDelta(vsMonth)}</div>
          <div style="font-size:12px;color:${muted};">Average ${monthCombined === null ? '--' : formatScore(monthCombined, 100)}</div>
        </div>
      </div>

      <div style="${cardStyle}margin-bottom:14px;">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;margin-bottom:10px;">Weighted tier totals</div>
        ${renderRows([
          ['Tier 1 habits', tier1.total, 40, 'Gym 15 + retention 10 + meditation 5 + sleep from evening score'],
          ['Tier 2 evening rating', tier2.weightedTotal, 45, `Scaled from evening journal ${formatScore(tier2.rawTotal, 30)}`],
          ['Tier 3 morning rating', tier3.weightedTotal, 15, `Scaled from morning journal ${formatScore(tier3.rawTotal, 30)}`],
          ['Overall total', total, 100, '40% tier 1 · 45% tier 2 · 15% tier 3'],
        ])}
      </div>

      <div style="${cardStyle}margin-bottom:14px;">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;margin-bottom:10px;">Tier 1 habits breakdown</div>
        ${renderRows(tier1.rows)}
      </div>

      <div style="${cardStyle}margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;">Tier 2 evening breakdown</div>
          <div style="font-size:12px;color:${muted};">${formatScore(tier2.rawTotal, 30)} raw → ${formatScore(tier2.weightedTotal, 45)} weighted</div>
        </div>
        ${renderRows(tier2.rows)}
      </div>

      <div style="${cardStyle}margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
          <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;">Tier 3 morning breakdown</div>
          <div style="font-size:12px;color:${muted};">${formatScore(tier3.rawTotal, 30)} raw → ${formatScore(tier3.weightedTotal, 15)} weighted</div>
        </div>
        ${renderRows(tier3.rows)}
      </div>

      <div style="${cardStyle}">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${muted};text-transform:uppercase;margin-bottom:12px;">Ranking ladder</div>
        ${tiers.map(([name, pctRange, scoreRange], idx) => `
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:${idx===0?'0 0 10px':'10px 0'};border-top:${idx===0?'none':`1px solid ${divider}`};">
            <div style="font-size:14px;font-weight:${name.toUpperCase() === status ? '900' : '700'};color:${name.toUpperCase() === status ? colour : '#0f172a'};">${name}</div>
            <div style="font-size:12px;color:${muted};">${pctRange}</div>
            <div style="font-size:12px;color:#0f172a;font-weight:700;">${scoreRange}</div>
          </div>
        `).join('')}
      </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function updateBestVersionPercent(){
    const total = getWeightedScores().total;
    const { percent, colour, status } = getPerformanceTier(total);
    const barWidth = Math.min(100, percent);
    bestVersionScore.style.cursor = 'pointer';
    bestVersionScore.setAttribute('role', 'button');
    bestVersionScore.setAttribute('tabindex', '0');
    bestVersionScore.setAttribute('aria-label', 'Open overall ranking breakdown');
    bestVersionScore.title = 'Tap to view ranking breakdown';
    bestVersionScore.innerHTML =
      `<div style="width:100%;">` +
      `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;flex-wrap:wrap;">` +
      `<span style="font-size:30px;font-weight:900;color:${colour};letter-spacing:-0.5px;">${status}</span>` +
      `<span style="font-size:15px;font-weight:800;color:${colour};opacity:0.85;">${formatScore(total, 100)}</span>` +
      `</div>` +
      `<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-bottom:3px;">` +
      `<div style="height:100%;width:${barWidth}%;background:${colour};border-radius:2px;transition:width 0.4s;"></div>` +
      `</div>` +
      `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">` +
      `<div style="font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Weighted daily standard</div>` +
      `<div style="font-size:10px;font-weight:800;color:rgba(255,255,255,0.38);text-transform:uppercase;letter-spacing:1px;">Tap for detail</div>` +
      `</div>` +
      `</div>`;
  }
  function computeMorningScore(){ const total=Number(morningFields.rested.value)+Number(morningFields.sharpness.value)+Number(morningFields.calm.value)+Number(morningFields.motivation.value)+Number(morningFields.clarity.value)+Number(morningFields.drive.value); morningScoreValue.textContent=total; updateBestVersionPercent(); return total; }
  function computeEveningScore(){ const total=Number(eveningFields.execution.value)+Number(eveningFields.discipline.value)+Number(eveningFields.dopamine.value)+Number(eveningFields.physical.value)+Number(eveningFields.builder.value)+Number(eveningFields.sleepprep.value); eveningScoreValue.textContent=total; updateBestVersionPercent(); return total; }
  function evaluateMorningCompletion(){ const complete=[morningFields.powerfulSelf,morningFields.mostImportantAction,morningFields.loseGain,morningFields.unstoppable].every(el=>isFilled(el.value)); morningCard.classList.toggle('complete-block', complete); morningBadge.textContent=complete?'Complete':'In progress'; morningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }
  function evaluateEveningCompletion(){ const textComplete=[eveningFields.proud,eveningFields.learned,eveningFields.release,eveningFields.alignment].every(el=>isFilled(el.value)); const gratitudeComplete=[eveningFields.grateful1,eveningFields.grateful2,eveningFields.grateful3,eveningFields.grateful4,eveningFields.grateful5,eveningFields.grateful6].some(el=>isFilled(el.value)); const complete=textComplete&&gratitudeComplete; eveningCard.classList.toggle('complete-block', complete); eveningBadge.textContent=complete?'Complete':'In progress'; eveningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }

  // ── Morning Launch Overlay ─────────────────────────────────────────────
  // ── 30 Stoic Principles (rotate daily) ────────────────────────────────
  const STOIC_PRINCIPLES = [
    { name:'AMOR FATI', meaning:'Love of Fate', quote:'Do not seek for things to happen the way you want them to; wish that what happens, happens as it does — and you will have a tranquil flow of life.', attr:'Epictetus', application:'The slow rebuild of TJM, the uncertainty with the shop, the early low-view days — love all of it. This resistance is not against you. It is building you. Go into today\'s work with total acceptance and total fire.' },
    { name:'MEMENTO MORI', meaning:'Remember You Will Die', quote:'Think of yourself as dead. You have lived your life. Now take what is left and live it properly.', attr:'Marcus Aurelius', application:'The window to build TJM is not infinite. The life you\'re building with Warda, the freedom you want — none of it happens automatically. Use this morning fully. Every hour is a resource you\'ll never get back.' },
    { name:'DICHOTOMY OF CONTROL', meaning:'Know What Is Yours', quote:'Make the best use of what is in your power, and take the rest as it happens.', attr:'Epictetus', application:'You can\'t control the algorithm, the views, or who buys today. You can control your camera, your effort, your standard, and whether you show up. Put everything into what is yours. Release the rest.' },
    { name:'PREMEDITATIO MALORUM', meaning:'Premeditation of Adversity', quote:'Let us prepare our minds as if we had come to the very end of life. Let us postpone nothing.', attr:'Seneca', application:'What if the shop lease falls through? What if today\'s content doesn\'t land? Prepare for it now. Let those possibilities sharpen your urgency to build TJM into something that needs nothing external to survive.' },
    { name:'THE OBSTACLE IS THE WAY', meaning:'Resistance Becomes the Path', quote:'The impediment to action advances action. What stands in the way becomes the way.', attr:'Marcus Aurelius', application:'The friction of rebuilding your audience, the slow follower regrowth, the discipline required — these are the path. Every creator who pushed through this phase is now ahead. You are on that path right now.' },
    { name:'THE INNER CITADEL', meaning:'Your Mind is Unbreakable', quote:'You have power over your mind, not outside events. Realise this, and you will find strength.', attr:'Marcus Aurelius', application:'The algorithm doesn\'t decide your worth. The view count doesn\'t decide your momentum. Your commitment to your standard does. Nothing outside can break what you build inside. Hold the citadel today.' },
    { name:'VOLUNTARY DISCOMFORT', meaning:'Choose Hardship Before It Chooses You', quote:'Set aside a certain number of days during which you shall be content with the scantiest and cheapest fare.', attr:'Seneca', application:'The early alarm, the gym, the cold discipline of your routine — you\'ve already chosen the harder path that most avoid. That choice is your edge. Honour it fully today.' },
    { name:'EQUANIMITY', meaning:'Unshakeable Calm', quote:'Be like the promontory against which the waves continually break, but which stands firm and tames the fury of the water around it.', attr:'Marcus Aurelius', application:'One bad content day, a slow sales week, an obstacle in the shop — meet it with the same calm you\'d bring to a win. Steadiness over time is what builds empires. Be the rock.' },
    { name:'VIRTUE IS THE ONLY GOOD', meaning:'Character Above All', quote:'Just as it is a crime to break up the united life of man, so it is a crime to break up the moral order.', attr:'Marcus Aurelius', application:'Build TJM the right way — honest reviews, real education, genuine value to your audience. Your reputation is the only asset that compounds without limit. Protect it with everything you do today.' },
    { name:'THE VIEW FROM ABOVE', meaning:'See the Bigger Picture', quote:'Look down from above on the countless herds of men and their countless solemnities, and the infinitely varied voyagings in storms and calms.', attr:'Marcus Aurelius', application:'Zoom out. You are building a brand that could be global. The life with Warda, the financial freedom, the TJM you envision — today\'s action is one brick in that structure. Lay it perfectly.' },
    { name:'SYMPATHEIA', meaning:'Everything is Connected', quote:'We are all working together for one great end. Some of us knowingly and purposefully, others without knowing it.', attr:'Marcus Aurelius', application:'Your audience is out there right now, buying jewellery from brands that don\'t deserve their trust. Your knowledge, your 30+ years of family expertise, is exactly what they need. Your content connects you to them.' },
    { name:'TRANQUILITY THROUGH DISCIPLINE', meaning:'Discipline is Peace', quote:'If you want to improve, be content to be thought foolish and stupid about externals.', attr:'Epictetus', application:'Your routine — the gym, the deep work block, the treadmill thinking time — is not a cage. It is the architecture of your power. Honour every part of it today and feel the calm that discipline creates.' },
    { name:'THE EXAMINED LIFE', meaning:'Know Yourself Daily', quote:'Waste no more time arguing what a good man should be. Be one.', attr:'Marcus Aurelius', application:'Who do you need to be today to close this journal tonight with full pride? Define it with complete honesty right now — and then go live it without compromise.' },
    { name:'RESPOND, DON\'T REACT', meaning:'The Pause is Power', quote:'Between stimulus and response there is a space. In that space is our power to choose our response.', attr:'Viktor Frankl', application:'When a video underperforms, when something in the shop disrupts the day, when the phone pulls at you — pause. That gap between trigger and response is where your power lives. Use it today.' },
    { name:'TEMPERANCE', meaning:'Master Your Appetites', quote:'I begin to be a friend to myself. That was indeed a great benefit; certainly such a man is never alone.', attr:'Seneca', application:'Appetite for distraction, for scrolling, for the easy path — these are the enemy of TJM. The man who governs his impulses governs his outcomes. Master the small urges today and the big wins follow.' },
    { name:'THE MORNING MEDITATION', meaning:'Set Your Compass First', quote:'In the morning when you rise unwillingly, let this thought be present: I am rising to the work of a human being.', attr:'Marcus Aurelius', application:'You rose before most of the world. You\'ve already won the first battle. Now use this journal to set your compass precisely — then walk straight toward it without deviation.' },
    { name:'TIME IS IRREPLACEABLE', meaning:'Spend It Like a Man', quote:'It is not that we have a short time to live, but that we waste a good deal of it.', attr:'Seneca', application:'Every hour you spend in distraction is an hour TJM doesn\'t exist, an hour the life with Warda doesn\'t get closer. Your time today is the most valuable resource you will ever have. Spend it accordingly.' },
    { name:'SELF-MASTERY', meaning:'Command Yourself First', quote:'No man is free who is not master of himself.', attr:'Epictetus', application:'TJM will grow as fast as you do. Master your habits, your focus, your creative output, your body — and the brand follows the man. Every act of self-command today is an investment in the brand.' },
    { name:'ACT WITHOUT ATTACHMENT', meaning:'Do the Work, Release the Outcome', quote:'Confine yourself to the present.', attr:'Marcus Aurelius', application:'Film the video. Write the content. Record the post. Then release it — without obsessing over the numbers. Your job is the work and the standard. The outcome will follow the standard, not the anxiety.' },
    { name:'SIMPLICITY', meaning:'Strip Away the Unnecessary', quote:'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', attr:'Marcus Aurelius', application:'What is the one thing that moves TJM forward today? Strip everything else. Do that one thing with total focus and total quality. Complexity is the enemy of execution.' },
    { name:'COURAGE IN ADVERSITY', meaning:'Hardship Reveals the Man', quote:'How long are you going to wait before you demand the best for yourself?', attr:'Epictetus', application:'The dormant account, the low views, the rebuild — that is adversity. Right now is the moment to demand the absolute best from yourself. Don\'t wait for conditions to improve. Create them.' },
    { name:'DUTY', meaning:'Show Up Whether You Feel It or Not', quote:'Do not indulge in dreams of what you do not have, but count the blessings you actually possess.', attr:'Marcus Aurelius', application:'You have a duty to the version of yourself that decided TJM was the path. You have a duty to Warda, to the future you\'re building. Show up for that man today — not because you feel like it, but because it\'s who you are.' },
    { name:'THE BODY AS A TOOL', meaning:'Build It. Command It.', quote:'First say to yourself what you would be; and then do what you have to do.', attr:'Epictetus', application:'The gym is not vanity — it is the engine that drives your clarity, your confidence, and your output on camera. Build it like TJM depends on it. Because it does.' },
    { name:'CHARACTER OVER REPUTATION', meaning:'What You Are Matters More Than What They Think', quote:'If it is not right, do not do it; if it is not true, do not say it.', attr:'Marcus Aurelius', application:'Forget what the metrics say today. Ask instead: am I the man I set out to be? Build that character with absolute consistency and the reputation — the followers, the sales, the brand — will catch up.' },
    { name:'PHILOSOPHY AS PRACTICE', meaning:'Wisdom Without Action is Nothing', quote:'Don\'t explain your philosophy. Embody it.', attr:'Epictetus', application:'The discipline, the routine, the standard — none of it counts unless you live it today. Don\'t think about the man you want to become. Be him. Right now. In every choice this day presents.' },
    { name:'PROGRESS NOT PERFECTION', meaning:'The Direction is What Counts', quote:'Begin at once to live, and count each separate day as a separate life.', attr:'Seneca', application:'Every video doesn\'t need to be perfect. Every day doesn\'t need to be flawless. What matters is that you move forward. One piece of content today beats a perfect plan that never executes.' },
    { name:'THE POWER OF HABIT', meaning:'You Become What You Repeatedly Do', quote:'First we make our habits, then our habits make us.', attr:'Seneca', application:'Your morning routine, your gym session, your deep work block — these are not just habits. They are the architecture of TJM\'s success. Every time you honour them, you compound the man you\'re becoming.' },
    { name:'FACING FEAR', meaning:'Walk Toward What You Avoid', quote:'Do the thing you fear and the death of fear is certain.', attr:'Epictetus', application:'The fear of being on camera, of being judged, of putting yourself fully out there with TJM — walk toward it today. That fear is the exact wall between you and the life you are building. Walk through it.' },
    { name:'LIVING FULLY', meaning:'All In, Every Day', quote:'Perfection of character is this: to live each day as if it were your last, without frenzy, without apathy, without pretense.', attr:'Marcus Aurelius', application:'This day — the shop, TJM, the life you\'re building with Warda — deserves your absolute full presence. Not 80%. Not when you feel ready. All of it, right now.' },
    { name:'THE LONG GAME', meaning:'Compound Every Day', quote:'He suffers more than necessary, who suffers before it is necessary.', attr:'Seneca', application:'You are not building TJM for this month. You are building it for the next decade. Each day of discipline, each video, each standard held — it is a compound investment. Trust the process. Keep going.' },
  ];

  function getDayPrinciple() {
    const today = deps.getToday();
    const dayOfYear = Math.floor((new Date(today + 'T12:00:00') - new Date(new Date(today + 'T12:00:00').getFullYear() + '-01-01T12:00:00')) / 86400000);
    return STOIC_PRINCIPLES[dayOfYear % STOIC_PRINCIPLES.length];
  }

  function renderStoicPrinciple() {
    const nameEl = document.getElementById('journalStoicName');
    const meaningEl = document.getElementById('journalStoicMeaning');
    const quoteEl = document.getElementById('journalStoicQuote');
    const attrEl = document.getElementById('journalStoicAttr');
    if (!nameEl) return;
    const p = getDayPrinciple();
    nameEl.textContent = p.name;
    meaningEl.textContent = p.meaning;
    quoteEl.textContent = '\u201C' + p.quote + '\u201D';
    attrEl.textContent = '\u2014 ' + p.attr;
    const appEl = document.getElementById('journalStoicApplication');
    if (appEl && p.application) appEl.textContent = p.application;

    const isLight = document.body.classList.contains('light');

    // ── Theme: The Lock block ──────────────────────────────────────────
    const lockBlock = document.getElementById('journalLockBlock');
    const lockIntro = document.getElementById('journalLockIntro');
    const lockItems = document.querySelectorAll('.journal-lock-item-text');
    const lockDeclaration = document.getElementById('journalLockDeclaration');
    if (lockBlock) {
      lockBlock.style.background = isLight ? '#ffffff' : '#050A14';
      lockBlock.style.border = isLight ? '1px solid rgba(201,168,76,0.35)' : '1px solid rgba(201,168,76,0.2)';
      lockBlock.style.borderLeft = '3px solid #C9A84C';
    }
    if (lockIntro) lockIntro.style.color = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)';
    lockItems.forEach(el => { el.style.color = isLight ? '#0A1628' : 'rgba(255,255,255,0.88)'; });
    if (lockDeclaration) {
      lockDeclaration.style.borderTop = isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)';
    }

    // ── Theme: Stoic Principle block ───────────────────────────────────
    const stoicBlock = document.getElementById('journalStoicBlock');
    const stoicLabel = document.getElementById('journalStoicLabel');
    if (stoicBlock) {
      stoicBlock.style.background = isLight ? '#f8f9fb' : 'rgba(255,255,255,0.02)';
      stoicBlock.style.border = isLight ? '1px solid #CDD4E0' : '1px solid rgba(255,255,255,0.08)';
    }
    if (stoicLabel) stoicLabel.style.color = isLight ? '#8899B0' : 'rgba(255,255,255,0.3)';
    if (nameEl) nameEl.style.color = isLight ? '#0A1628' : '#ffffff';
    if (quoteEl) quoteEl.style.color = isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
    if (attrEl) attrEl.style.color = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.22)';
  }

  const STOIC_QUOTES = [
    { text: "You have power over your mind, not outside events. Realise this, and you will find strength.", attr: "Marcus Aurelius" },
    { text: "Waste no more time arguing what a good man should be. Be one.", attr: "Marcus Aurelius" },
    { text: "The impediment to action advances action. What stands in the way becomes the way.", attr: "Marcus Aurelius" },
    { text: "Begin at once to live, and count each separate day as a separate life.", attr: "Seneca" },
    { text: "Do not indulge in dreams of what you do not have, but count the blessings you actually possess.", attr: "Marcus Aurelius" },
    { text: "Confine yourself to the present.", attr: "Marcus Aurelius" },
    { text: "How long are you going to wait before you demand the best for yourself?", attr: "Epictetus" },
  ];

  function showMorningLaunchOverlay(payload) {
    // Only fire on today's entry, and only once per day
    if (!isToday()) return;
    const todayKey = keyFromDate(currentDate);
    const alreadyShown = sessionStorage.getItem('launchOverlayShown_' + todayKey);
    if (alreadyShown) return;
    sessionStorage.setItem('launchOverlayShown_' + todayKey, '1');

    const quote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];
    const action = (payload.mostImportantAction || '').trim();
    const dateKey = keyFromDate(currentDate);
    const dayData = deps.state.data?.days?.[dateKey] || {};
    const rawTasks = Array.isArray(dayData.tasks) ? dayData.tasks : [];
    const priorities = rawTasks.map(t => typeof t === 'string' ? t : (t.text || t.title || t.name || '')).filter(Boolean);

    // Build overlay
    const overlay = document.createElement('div');
    overlay.id = 'morningLaunchOverlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99999;',
      'background:#050A14;color:#ffffff;',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'padding:24px;overflow:auto;',
      'animation:launchFadeIn 0.35s ease forwards;',
    ].join('');
    overlay.className = 'force-dark';

    const COUNTDOWN_SECS = 60;

    overlay.innerHTML = `
      <style>
        @keyframes launchFadeIn { from { opacity:0; transform:scale(1.04); } to { opacity:1; transform:scale(1); } }
        @keyframes launchPulse { 0%,100% { box-shadow:0 0 0 0 rgba(201,168,76,0.35); } 50% { box-shadow:0 0 0 18px rgba(201,168,76,0); } }
        @keyframes launchBarShrink { from { width:100%; } to { width:0%; } }
        #launchGetUpBtn { animation: launchPulse 2s ease-in-out infinite; }
      </style>

      <div style="width:min(520px,100%);display:flex;flex-direction:column;gap:20px;text-align:center;">

        <!-- Header -->
        <div>
          <div style="font-size:10px;font-weight:900;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:10px;">Morning Protocol Complete</div>
          <div style="font-size:42px;font-weight:900;color:#ffffff;line-height:1;letter-spacing:-1px;">GET UP.<br><span style="color:#C9A84C;">RIGHT NOW.</span></div>
          <div style="font-size:14px;color:rgba(255,255,255,0.45);margin-top:10px;">The bed is done. The day begins.</div>
        </div>

        <!-- Most Important Action -->
        ${action ? `
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:14px;padding:16px 18px;text-align:left;">
          <div style="font-size:9px;font-weight:900;letter-spacing:2.5px;color:#C9A84C;text-transform:uppercase;margin-bottom:8px;">Most Important Action Today</div>
          <div style="font-size:16px;font-weight:800;color:#ffffff;line-height:1.4;">"${action}"</div>
        </div>` : ''}

        <!-- Priorities -->
        ${priorities.length ? `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px 18px;text-align:left;">
          <div style="font-size:9px;font-weight:900;letter-spacing:2.5px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:10px;">Today's Priorities</div>
          ${priorities.map((p,i) => `
            <div style="display:flex;gap:12px;align-items:flex-start;${i>0?'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);':''}">
              <div style="width:22px;height:22px;flex-shrink:0;border-radius:6px;background:#C9A84C;color:#050A14;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;">${i+1}</div>
              <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.85);line-height:1.4;padding-top:2px;">${p}</div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Stoic quote -->
        <div style="padding:0 8px;">
          <div style="font-size:13px;font-style:italic;color:rgba(255,255,255,0.38);line-height:1.6;">"${quote.text}"</div>
          <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.22);margin-top:6px;letter-spacing:1px;">— ${quote.attr}</div>
        </div>

        <!-- CTA button -->
        <div>
          <button id="launchGetUpBtn" type="button" style="
            width:100%;padding:18px 24px;
            background:#C9A84C;color:#050A14;
            border:none;border-radius:14px;
            font-size:18px;font-weight:900;letter-spacing:0.5px;
            cursor:pointer;font-family:inherit;
          ">I'M UP — LET'S GET IT</button>
        </div>

        <!-- Countdown bar -->
        <div>
          <div id="launchCountdownText" style="font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:6px;">Closing in <span id="launchCountdownNum">${COUNTDOWN_SECS}</span>s — put the phone down</div>
          <div style="height:3px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
            <div id="launchCountdownBar" style="height:100%;width:100%;background:rgba(201,168,76,0.5);border-radius:99px;animation:launchBarShrink ${COUNTDOWN_SECS}s linear forwards;"></div>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Vibrate on mobile (pattern: buzz buzz buzz)
    if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 200]);

    function closeOverlay() {
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = '';
      }, 300);
      clearInterval(countdownInterval);
    }

    document.getElementById('launchGetUpBtn').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    // Countdown
    let remaining = COUNTDOWN_SECS;
    const numEl = document.getElementById('launchCountdownNum');
    const countdownInterval = setInterval(() => {
      remaining--;
      if (numEl) numEl.textContent = remaining;
      if (remaining <= 0) closeOverlay();
    }, 1000);
  }

  function saveMorning(){
    const complete = evaluateMorningCompletion();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const existing = getJournalEntry(keyFromDate(currentDate),'morning') || {};
    const payload={rested:morningFields.rested.value,sharpness:morningFields.sharpness.value,calm:morningFields.calm.value,motivation:morningFields.motivation.value,clarity:morningFields.clarity.value,drive:morningFields.drive.value,powerfulSelf:morningFields.powerfulSelf.value,mostImportantAction:morningFields.mostImportantAction.value,loseGain:morningFields.loseGain.value,unstoppable:morningFields.unstoppable.value,score:computeMorningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
    setJournalEntry(keyFromDate(currentDate),'morning',payload);
    morningSavedPill.textContent = `Saved ${timeStr}`;
    morningSavedPill.style.display='inline';
    setTimeout(()=>morningSavedPill.style.display='none',2500);
    entryStatus.textContent='Saved morning entry for '+fullDate.textContent;
    updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
    if (complete) setTimeout(() => showMorningLaunchOverlay(payload), 400);
  }

  function saveEvening(){
    const complete = evaluateEveningCompletion();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const existing = getJournalEntry(keyFromDate(currentDate),'evening') || {};
    const payload={execution:eveningFields.execution.value,discipline:eveningFields.discipline.value,dopamine:eveningFields.dopamine.value,physical:eveningFields.physical.value,builder:eveningFields.builder.value,sleepprep:eveningFields.sleepprep.value,proud:eveningFields.proud.value,learned:eveningFields.learned.value,release:eveningFields.release.value,alignment:eveningFields.alignment.value,grateful1:eveningFields.grateful1.value,grateful2:eveningFields.grateful2.value,grateful3:eveningFields.grateful3.value,grateful4:eveningFields.grateful4.value,grateful5:eveningFields.grateful5.value,grateful6:eveningFields.grateful6.value,score:computeEveningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
    setJournalEntry(keyFromDate(currentDate),'evening',payload);
    eveningSavedPill.textContent = `Saved ${timeStr}`;
    eveningSavedPill.style.display='inline';
    setTimeout(()=>eveningSavedPill.style.display='none',2500);
    entryStatus.textContent='Saved evening entry for '+fullDate.textContent;
    updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
  }

  function loadMorning(){ const data=getJournalEntry(keyFromDate(currentDate),'morning')||{}; morningFields.rested.value=data.rested??3; morningFields.sharpness.value=data.sharpness??3; morningFields.calm.value=data.calm??3; morningFields.motivation.value=data.motivation??3; morningFields.clarity.value=data.clarity??3; morningFields.drive.value=data.drive??3; morningFields.powerfulSelf.value=data.powerfulSelf??''; morningFields.mostImportantAction.value=data.mostImportantAction??''; morningFields.loseGain.value=data.loseGain??''; morningFields.unstoppable.value=data.unstoppable??''; morningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = morningFields[key].value; }); computeMorningScore(); evaluateMorningCompletion(); renderDayPriorities(); }

  function renderDayPriorities() {
    const el = document.getElementById('journalDayPrioritiesDisplay');
    if (!el) return;
    const dateKey = keyFromDate(currentDate);
    const dayData = deps.state.data?.days?.[dateKey] || {};
    // Tasks may be stored as an array under 'tasks', or as individual entries — adjust path if needed
    const tasks = Array.isArray(dayData.tasks) ? dayData.tasks : [];
    const isLight = document.body.classList.contains('light');
    if (!tasks.length) {
      el.innerHTML = `<div style="font-size:13px;font-style:italic;color:${isLight?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.25)'};">No tasks added to the planner for today.</div>`;
      return;
    }
    el.innerHTML = tasks.map((t, i) => {
      const text = typeof t === 'string' ? t : (t.text || t.title || t.name || JSON.stringify(t));
      const done = t.done || t.complete || t.completed || false;
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:10px;background:${isLight?(done?'rgba(46,204,113,0.06)':'#fff'):(done?'rgba(46,204,113,0.06)':'rgba(255,255,255,0.03)')};border:1px solid ${isLight?(done?'rgba(46,204,113,0.3)':'#CDD4E0'):(done?'rgba(46,204,113,0.25)':'rgba(255,255,255,0.08)')};${done?'opacity:0.55;':''}">
        <div style="width:18px;height:18px;flex-shrink:0;border-radius:5px;background:${done?'rgba(46,204,113,0.2)':'transparent'};border:1.5px solid ${done?'#2ecc71':'rgba(201,168,76,0.4)'};color:#2ecc71;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:900;margin-top:1px;">${done?'✓':''}</div>
        <div style="font-size:14px;font-weight:700;color:${isLight?(done?'rgba(0,0,0,0.35)':'#0A1628'):(done?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.88)')};line-height:1.4;${done?'text-decoration:line-through;':''}">${text}</div>
      </div>`;
    }).join('');
  }

  function loadEvening(){ const data=getJournalEntry(keyFromDate(currentDate),'evening')||{}; eveningFields.execution.value=data.execution??3; eveningFields.discipline.value=data.discipline??3; eveningFields.dopamine.value=data.dopamine??3; eveningFields.physical.value=data.physical??3; eveningFields.builder.value=data.builder??3; eveningFields.sleepprep.value=data.sleepprep??3; eveningFields.proud.value=data.proud??''; eveningFields.learned.value=data.learned??''; eveningFields.release.value=data.release??''; eveningFields.alignment.value=data.alignment??''; eveningFields.grateful1.value=data.grateful1??''; eveningFields.grateful2.value=data.grateful2??''; eveningFields.grateful3.value=data.grateful3??''; eveningFields.grateful4.value=data.grateful4??''; eveningFields.grateful5.value=data.grateful5??''; eveningFields.grateful6.value=data.grateful6??''; eveningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = eveningFields[key].value; }); computeEveningScore(); evaluateEveningCompletion(); }

  // ── Open Journal ───────────────────────────────────────────────────────
  function autoExpandOpenTextarea() {
    if (!openTextField) return;
    openTextField.style.height = 'auto';
    openTextField.style.height = Math.max(160, openTextField.scrollHeight) + 'px';
  }

  function evaluateOpenCompletion() {
    if (!openCard || !openTextField || !openBadge) return false;
    const hasContent = openTextField.value.trim().length > 0;
    openCard.classList.toggle('open-complete', hasContent);
    if (hasContent) {
      openBadge.textContent = 'Done';
      openBadge.classList.add('is-complete');
    } else {
      openBadge.textContent = 'Optional';
      openBadge.classList.remove('is-complete');
    }
    updateLauncherButtonsOpen();
    return hasContent;
  }

  function saveOpen() {
    if (!openTextField) return;
    const hasContent = openTextField.value.trim().length > 0;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const existing = getJournalEntry(keyFromDate(currentDate),'open') || {};
    const payload = { text: openTextField.value, hasContent, savedAt: timeStr, firstSavedAt: existing.firstSavedAt || timeStr };
    setJournalEntry(keyFromDate(currentDate),'open', payload);
    if (openSavedPill) {
      openSavedPill.textContent = `Saved ${timeStr}`;
      openSavedPill.style.display = 'inline';
      setTimeout(() => openSavedPill.style.display = 'none', 2500);
    }
    evaluateOpenCompletion();
  }

  function loadOpen() {
    if (!openTextField) return;
    const data = getJournalEntry(keyFromDate(currentDate),'open') || {};
    openTextField.value = data.text || '';
    setTimeout(autoExpandOpenTextarea, 0);
    evaluateOpenCompletion();
  }

  function toggleOpen() {
    if (!openCard) return;
    if (openCard.classList.contains('journal-collapsed')) {
      openCard.classList.remove('journal-collapsed');
      setTimeout(() => { openCard.scrollIntoView({ behavior:'smooth', block:'start' }); autoExpandOpenTextarea(); }, 30);
    } else {
      saveOpen();
      openCard.classList.add('journal-collapsed');
    }
    updateLauncherButtonsOpen();
  }

  function updateLauncherButtonsOpen() {
    if (!openOpenBtn || !openCard || !openTextField) return;
    const hasContent = openTextField.value.trim().length > 0;
    const isOpen = !openCard.classList.contains('journal-collapsed');
    openOpenBtn.classList.toggle('launch-complete', hasContent);
    openOpenBtn.innerHTML = isOpen
      ? `${hasContent ? '✓ ' : ''}Open Journal — Open<small>Tap to collapse</small>`
      : `${hasContent ? '✓ ' : ''}Open Journal<small>${hasContent ? 'Written today · tap to review' : 'Optional free-write — blank canvas for anything on your mind'}</small>`;
  }

  if (openTextField) {
    openTextField.addEventListener('input', () => { autoExpandOpenTextarea(); evaluateOpenCompletion(); });
  }
  if (document.getElementById('journalCollapseOpenBtn')) {
    document.getElementById('journalCollapseOpenBtn').addEventListener('click', toggleOpen);
  }
  if (document.getElementById('journalCollapseOpenBtnBottom')) {
    document.getElementById('journalCollapseOpenBtnBottom').addEventListener('click', toggleOpen);
  }
  if (openOpenBtn) {
    openOpenBtn.addEventListener('click', () => {
      if (openCard.classList.contains('journal-collapsed')) { toggleOpen(); }
      else { saveOpen(); toggleOpen(); }
    });
  }

  function updateLauncherButtons() {
    const mComplete = morningBadge.classList.contains('is-complete');
    const eComplete = eveningBadge.classList.contains('is-complete');
    openMorningBtn.classList.toggle('launch-complete', mComplete);
    openEveningBtn.classList.toggle('launch-complete', eComplete);
    const morningOpen = !morningCard.classList.contains('journal-collapsed');
    const eveningOpen = !eveningCard.classList.contains('journal-collapsed');
    openMorningBtn.innerHTML = morningOpen
      ? `${mComplete?'✓ ':''}Morning Journal — Open<small>Tap to collapse</small>`
      : `${mComplete?'✓ ':''}Morning Journal<small>${mComplete?'Completed · tap to review':'Open readiness, identity, mission, and priorities'}</small>`;
    openEveningBtn.innerHTML = eveningOpen
      ? `${eComplete?'✓ ':''}Evening Reflection — Open<small>Tap to collapse</small>`
      : `${eComplete?'✓ ':''}Evening Reflection<small>${eComplete?'Completed · tap to review':'Open execution, reflection, and reset for tomorrow'}</small>`;
    updateLauncherButtonsOpen();
  }

  function toggleMorning(){
    if(morningCard.classList.contains('journal-collapsed')) {
      morningCard.classList.remove('journal-collapsed');
      setTimeout(() => morningCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    } else {
      saveMorning();
      morningCard.classList.add('journal-collapsed');
    }
    updateLauncherButtons();
  }

  function toggleEvening(){
    if(eveningCard.classList.contains('journal-collapsed')) {
      eveningCard.classList.remove('journal-collapsed');
      setTimeout(() => eveningCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    } else {
      saveEvening();
      eveningCard.classList.add('journal-collapsed');
    }
    updateLauncherButtons();
  }

  morningBindings.forEach(([key,valId])=>{ const range=morningFields[key]; const val=document.getElementById(valId); range.addEventListener('input', ()=>{ val.textContent=range.value; computeMorningScore(); }); });
  eveningBindings.forEach(([key,valId])=>{ const range=eveningFields[key]; const val=document.getElementById(valId); range.addEventListener('input', ()=>{ val.textContent=range.value; computeEveningScore(); }); });
  Object.values(morningFields).forEach(el=>el.addEventListener('input', evaluateMorningCompletion));
  Object.values(eveningFields).forEach(el=>el.addEventListener('input', evaluateEveningCompletion));

  document.getElementById('journalCollapseMorningBtn').addEventListener('click', toggleMorning);
  document.getElementById('journalCollapseMorningBtnBottom').addEventListener('click', toggleMorning);
  document.getElementById('journalCollapseEveningBtn').addEventListener('click', toggleEvening);
  document.getElementById('journalCollapseEveningBtnBottom').addEventListener('click', toggleEvening);

  openMorningBtn.addEventListener('click', () => {
    if (morningCard.classList.contains('journal-collapsed')) { toggleMorning(); }
    else { saveMorning(); toggleMorning(); }
  });
  openEveningBtn.addEventListener('click', () => {
    if (eveningCard.classList.contains('journal-collapsed')) { toggleEvening(); }
    else { saveEvening(); toggleEvening(); }
  });

  if (bestVersionScore) {
    bestVersionScore.addEventListener('click', openBestVersionModal);
    bestVersionScore.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openBestVersionModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBestVersionModal();
  });

  if (jumpTodayBtn) {
    jumpTodayBtn.addEventListener('click', () => {
      currentDate = new Date(deps.getToday() + 'T12:00:00');
      formatDateDisplay(currentDate);
      loadMorning(); loadEvening(); loadOpen(); updateAverageNotes(); updateBestVersionPercent();
      updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
    });
  }

  // ── Monthly objectives in journal (read-only reference) ────────────────
  function updateJournalMonthObjectives() {
    const el = document.getElementById('journalMonthObjectives');
    if (!el) return;

    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const allMonthObjs = deps.state.data.monthObjectives?.[monthKey] || [];
    // Exclude objectives rolled over from previous months (createdAt before this month)
    const monthObjs = allMonthObjs.filter(obj => !obj.createdAt || obj.createdAt >= monthStart);

    if (!monthObjs.length) { el.innerHTML = ''; return; }

    const MONTH_CAT_LABELS = { tjm: 'TJM', vinted: 'Vinted', notts: 'Nottingham', personal: 'Personal', other: 'Other' };
    const MONTH_CAT_COLOURS = { tjm: '#3B82F6', vinted: '#14B8A6', notts: '#EF4444', personal: '#C9A84C', other: '#8B5CF6' };

    const isLight = document.body.classList.contains('light');

    const fmtShort = d => {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    el.innerHTML = `
    <div style="margin-bottom:10px;">
      <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${isLight?'#8899B0':'rgba(255,255,255,0.3)'};margin-bottom:8px;text-transform:uppercase;">Monthly Objectives</div>
      ${monthObjs.map((obj, i) => {
        const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Other';
        const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
        const nowD = new Date(); nowD.setHours(0,0,0,0);
        const daysLeft = obj.deadline ? Math.ceil((new Date(obj.deadline + 'T00:00:00') - nowD) / 86400000) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0 && !obj.done;
        const textColor = isLight
          ? (obj.done ? 'rgba(0,0,0,0.35)' : '#0A1628')
          : (obj.done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)');
        const cardBg = isLight
          ? (obj.done ? 'rgba(46,204,113,0.06)' : '#fff')
          : (obj.done ? 'rgba(26,92,58,0.3)' : 'rgba(255,255,255,0.02)');
        const cardBorder = isLight
          ? (obj.done ? 'rgba(46,204,113,0.3)' : isOverdue ? 'rgba(231,76,60,0.25)' : '#CDD4E0')
          : (obj.done ? 'rgba(46,204,113,0.25)' : isOverdue ? 'rgba(231,76,60,0.2)' : 'rgba(255,255,255,0.08)');
        const deadlineColor = isLight
          ? (isOverdue ? '#e74c3c' : 'rgba(0,0,0,0.4)')
          : (isOverdue ? '#e74c3c' : 'rgba(255,255,255,0.3)');
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid ${cardBorder};background:${cardBg};margin-bottom:5px;border-left:3px solid ${obj.done?'#2ecc71':catColor};">
          <div style="width:16px;height:16px;flex-shrink:0;border-radius:4px;border:1.5px solid ${obj.done?'rgba(46,204,113,0.6)':catColor+'55'};background:${obj.done?'rgba(46,204,113,0.15)':'transparent'};color:${obj.done?'#2ecc71':catColor};font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:900;">${obj.done?'✓':''}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:${textColor};${obj.done?'text-decoration:line-through;':''}line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${obj.text}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
            <span style="font-size:8px;font-weight:900;letter-spacing:0.8px;color:${catColor};opacity:0.9;">${catLabel.toUpperCase()}</span>
            ${obj.deadline ? `<span style="font-size:9px;color:${deadlineColor};font-weight:${isOverdue?'800':'600'};">${isOverdue?'⚠':''}${fmtShort(obj.deadline)}</span>` : ''}
            ${obj.done ? `<span style="font-size:9px;color:#2ecc71;font-weight:800;">DONE</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // ── Weekly objectives in journal ───────────────────────────────────────
  function updateJournalWeekObjectives() {
    const el = document.getElementById('journalWeekObjectives');
    if (!el) return;
    const weekKey = deps.getWeekKey ? deps.getWeekKey(currentDate) : null;
    el.innerHTML = (weekKey && window._weekObjsHtml) ? window._weekObjsHtml(deps.state.data.weekObjectives, weekKey, true) : '';
    const wmEl = document.getElementById('journalWeekMission');
    if (wmEl) wmEl.style.display = 'none';
  }

  function navigateDay(delta) {
    currentDate.setDate(currentDate.getDate() + delta);
    formatDateDisplay(currentDate);
    loadMorning(); loadEvening(); loadOpen(); updateAverageNotes(); updateBestVersionPercent();
    updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
    if (window.refreshJournalHabitGrid) window.refreshJournalHabitGrid(keyFromDate(currentDate));
  }

  prevDayBtn.addEventListener('click', () => navigateDay(-1));
  nextDayBtn.addEventListener('click', () => navigateDay(1));
  calendarBtn.addEventListener('click', () => {
    if (datePicker.showPicker) { try { datePicker.showPicker(); } catch(e) { datePicker.click(); } }
    else { datePicker.click(); }
  });
  datePicker.addEventListener('change', e => {
    currentDate = new Date(e.target.value + 'T12:00:00');
    formatDateDisplay(currentDate);
    loadMorning(); loadEvening(); loadOpen(); updateAverageNotes(); updateBestVersionPercent();
    updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
    if (window.refreshJournalHabitGrid) window.refreshJournalHabitGrid(keyFromDate(currentDate));
  });

  // ── Journal Month Calendar ─────────────────────────────────────────────
  function getJournalWordRating(dateStr) {
    if (!deps.getDayByDate) return null;
    const day = deps.getDayByDate(dateStr) || {};
    const morning = getJournalEntry(dateStr, 'morning');
    const evening = getJournalEntry(dateStr, 'evening');
    const hasHabits = day.gym || day.retention || day.meditation;
    const hasMorning = morning && Object.keys(morning).some(k => typeof morning[k] === 'number' && morning[k] > 0);
    const hasEvening = evening && Object.keys(evening).some(k => typeof evening[k] === 'number' && evening[k] > 0);
    if (!hasHabits && !hasMorning && !hasEvening) return null;
    const round1 = n => Math.round(Number(n || 0) * 10) / 10;
    const scale = (raw, rawMax, targetMax) => rawMax > 0 ? round1((Number(raw || 0) / rawMax) * targetMax) : 0;
    const g = (obj, key) => Number(obj?.[key] ?? 0);
    const sleepRaw = g(evening, 'sleepprep');
    const tier1 = round1((day.gym ? 15 : 0) + (day.retention ? 10 : 0) + (day.meditation ? 5 : 0) + Math.min(10, sleepRaw * 2));
    const eveningRaw = round1(['execution','discipline','dopamine','physical','builder','sleepprep'].reduce((s,k) => s + g(evening, k), 0));
    const tier2 = scale(eveningRaw, 30, 45);
    const morningRaw = round1(['rested','sharpness','calm','motivation','clarity','drive'].reduce((s,k) => s + g(morning, k), 0));
    const tier3 = scale(morningRaw, 30, 15);
    const pct = Math.round(round1(tier1 + tier2 + tier3));
    if (pct >= 95) return { label: 'LEGENDARY', colour: '#D4AF37', pct };
    if (pct >= 90) return { label: 'ELITE',      colour: '#2ecc71', pct };
    if (pct >= 80) return { label: 'STRONG',     colour: '#3498db', pct };
    if (pct >= 70) return { label: 'ABOVE AVG',  colour: '#1abc9c', pct };
    if (pct >= 60) return { label: 'AVERAGE',    colour: '#f39c12', pct };
    if (pct >= 50) return { label: 'WEAK',       colour: '#e67e22', pct };
    return           { label: 'POOR',       colour: '#e74c3c', pct };
  }

  function renderJournalCalendar() {
    const calContainer = document.getElementById('journal-cal-section');
    if (!calContainer) return;
    const y = deps.state.calendarYear, m = deps.state.calendarMonth;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
    const today = deps.getToday();
    const dayHeaders = ['M','T','W','T','F','S','S'].map(d => `<div class="calendar-day-header">${d}</div>`).join('');
    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += `<div class="calendar-day empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayData = (deps.getDayByDate ? deps.getDayByDate(dateStr) : null) || {};
      const isT = dateStr === today, isFuture = dateStr > today, isSel = deps.state.selectedEditDate === dateStr;
      const didRetention = !!dayData.retention, didGym = !!dayData.gym, didMeditate = !!dayData.meditation, didLive = !!dayData.live;
      const coreCount = [didRetention, didGym, didMeditate].filter(Boolean).length;
      const hasAnyData = coreCount > 0 || didLive || (dayData.sales || 0) > 0;
      let habitBg = '', habitBorder = '';
      if (!isFuture && hasAnyData) {
        if (coreCount === 0)      { habitBg = 'rgba(231,76,60,0.18)';  habitBorder = 'rgba(231,76,60,0.45)'; }
        else if (coreCount === 1) { habitBg = 'rgba(243,156,18,0.18)'; habitBorder = 'rgba(243,156,18,0.5)'; }
        else if (coreCount === 2) { habitBg = 'rgba(243,156,18,0.22)'; habitBorder = 'rgba(243,156,18,0.55)'; }
        else                      { habitBg = 'rgba(39,174,96,0.22)';  habitBorder = 'rgba(39,174,96,0.55)'; }
      }
      const emojiGrid = hasAnyData ? `<div style="display:flex;justify-content:center;gap:1px;margin-top:2px;flex-wrap:wrap;max-width:100%;overflow:hidden;"><span style="font-size:8px;line-height:1.4;opacity:${didRetention?1:0.15};">${didRetention?'🩸':'·'}</span><span style="font-size:8px;line-height:1.4;opacity:${didGym?1:0.15};">${didGym?'🏋️':'·'}</span><span style="font-size:8px;line-height:1.4;opacity:${didMeditate?1:0.15};">${didMeditate?'🧘':'·'}</span>${didLive?'<span style="font-size:8px;line-height:1.4;" title="Live">⭐</span>':''}</div>` : '';
      const morning = getJournalEntry(dateStr, 'morning');
      const evening = getJournalEntry(dateStr, 'evening');
      const bothComplete = morning?.complete && evening?.complete;
      const jr = (!isFuture && bothComplete) ? getJournalWordRating(dateStr) : null;
      const ratingHtml = jr ? `<span style="display:block;font-size:9px;font-weight:900;letter-spacing:0.2px;color:${jr.colour};line-height:1.1;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 0 8px ${jr.colour}80;">${jr.label}</span><span style="display:block;font-size:11px;font-weight:900;color:${jr.colour};line-height:1.1;opacity:0.9;">${jr.pct}<span style="font-size:7px;opacity:0.65;">/100</span></span>` : '';
      const baseStyle = habitBg ? `background:${habitBg};border-color:${habitBorder};` : '';
      const todayStyle = isT ? 'border:2px solid #D4AF37;color:#D4AF37;font-weight:700;' : '';
      const selStyle = isSel ? 'background:rgba(212,175,55,0.3);border:2px solid #D4AF37;' : '';
      cells += `<button class="calendar-day${isFuture?' future':''}${isSel?' selected':''}" style="min-height:72px;width:100%;box-sizing:border-box;overflow:hidden;${baseStyle}${todayStyle}${selStyle}" onclick="selectEditDate('${dateStr}')" ${isFuture?'disabled':''}><span class="cal-day-num" style="font-size:${jr?'9px':'11px'};opacity:${jr?'0.5':'1'};">${day}</span>${ratingHtml}${emojiGrid}</button>`;
    }
    calContainer.innerHTML = `
      <div class="section-title" style="margin-top:24px;">Month Overview</div>
      <div class="cal-nav" style="box-sizing:border-box;width:100%;">
        <button class="cal-nav-btn" onclick="navigateCalendar(-1)">‹</button>
        <span class="cal-nav-title">${monthNames[m]} ${y}</span>
        <button class="cal-nav-btn" onclick="navigateCalendar(1)">›</button>
      </div>
      <div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);width:100%;box-sizing:border-box;gap:2px;padding:0;overflow:hidden;">
        ${dayHeaders}${cells}
      </div>`;
  }

  // Inject calendar container after openCard and render it
  if (openCard && !document.getElementById('journal-cal-section')) {
    const calDiv = document.createElement('div');
    calDiv.id = 'journal-cal-section';
    openCard.insertAdjacentElement('afterend', calDiv);
  }
  renderJournalCalendar();

  formatDateDisplay(currentDate);
  renderStoicPrinciple();
  loadMorning(); loadEvening(); loadOpen(); updateAverageNotes(); updateBestVersionPercent();
  updateStreakDisplay(); updateLauncherButtons();
  updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();

}
