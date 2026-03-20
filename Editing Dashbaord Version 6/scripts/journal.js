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
  const openMorningBtn = document.getElementById('journalOpenMorningBtn');
  const openEveningBtn = document.getElementById('journalOpenEveningBtn');
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

  let currentDate = new Date(((deps.state.journalDate) || deps.getToday()) + 'T12:00:00');

  const morningFields = {
    rested: document.getElementById('journal-rested-range'), sharpness: document.getElementById('journal-sharpness-range'), calm: document.getElementById('journal-calm-range'), motivation: document.getElementById('journal-motivation-range'), clarity: document.getElementById('journal-clarity-range'), drive: document.getElementById('journal-drive-range'),
    identity: document.getElementById('journal-identity'), purpose: document.getElementById('journal-purpose'), stateConfidence: document.getElementById('journal-stateConfidence'), mission: document.getElementById('journal-mission'), priority1: document.getElementById('journal-priority1'), priority2: document.getElementById('journal-priority2'), priority3: document.getElementById('journal-priority3'), obstacles: document.getElementById('journal-obstacles')
  };
  const eveningFields = {
    execution: document.getElementById('journal-execution-range'), discipline: document.getElementById('journal-discipline-range'), dopamine: document.getElementById('journal-dopamine-range'), physical: document.getElementById('journal-physical-range'), builder: document.getElementById('journal-builder-range'), sleepprep: document.getElementById('journal-sleepprep-range'),
    missionDebrief: document.getElementById('journal-eveningMissionDebrief'), biggestWin: document.getElementById('journal-eveningBiggestWin'), biggestLesson: document.getElementById('journal-eveningBiggestLesson'), identityReflection: document.getElementById('journal-eveningIdentityReflection'), improveTomorrow: document.getElementById('journal-eveningImproveTomorrow')
  };

  const morningBindings = [['rested','journal-rested-val'],['sharpness','journal-sharpness-val'],['calm','journal-calm-val'],['motivation','journal-motivation-val'],['clarity','journal-clarity-val'],['drive','journal-drive-val']];
  const eveningBindings = [['execution','journal-execution-val'],['discipline','journal-discipline-val'],['dopamine','journal-dopamine-val'],['physical','journal-physical-val'],['builder','journal-builder-val'],['sleepprep','journal-sleepprep-val']];

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

  function updateBestVersionPercent(){
    const morning=Number(morningScoreValue.textContent||0);
    const evening=Number(eveningScoreValue.textContent||0);
    const percent=Math.round(((morning+evening)/60)*100);
    const colour = percent >= 97 ? '#D4AF37' : percent >= 88 ? '#2ecc71' : percent >= 80 ? '#3498db' : percent >= 70 ? '#1abc9c' : percent >= 60 ? '#f39c12' : '#e74c3c';
    const status = percent >= 97 ? 'LEGENDARY' : percent >= 88 ? 'ELITE' : percent >= 80 ? 'STRONG' : percent >= 70 ? 'ABOVE AVERAGE' : percent >= 60 ? 'AVERAGE' : 'BELOW AVERAGE';
    const barWidth = Math.min(100, percent);
    bestVersionScore.innerHTML =
      `<div style="width:100%;">` +
      `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;">` +
      `<span style="font-size:30px;font-weight:900;color:${colour};letter-spacing:-0.5px;">${status}</span>` +
      `<span style="font-size:15px;font-weight:800;color:${colour};opacity:0.8;">${morning+evening}/${60}</span>` +
      `</div>` +
      `<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-bottom:3px;">` +
      `<div style="height:100%;width:${barWidth}%;background:${colour};border-radius:2px;transition:width 0.4s;"></div>` +
      `</div>` +
      `<div style="font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;">DAILY STANDARD</div>` +
      `</div>`;
  }

  function computeMorningScore(){ const total=Number(morningFields.rested.value)+Number(morningFields.sharpness.value)+Number(morningFields.calm.value)+Number(morningFields.motivation.value)+Number(morningFields.clarity.value)+Number(morningFields.drive.value); morningScoreValue.textContent=total; updateBestVersionPercent(); return total; }
  function computeEveningScore(){ const total=Number(eveningFields.execution.value)+Number(eveningFields.discipline.value)+Number(eveningFields.dopamine.value)+Number(eveningFields.physical.value)+Number(eveningFields.builder.value)+Number(eveningFields.sleepprep.value); eveningScoreValue.textContent=total; updateBestVersionPercent(); return total; }
  function evaluateMorningCompletion(){ const complete=[morningFields.identity,morningFields.purpose,morningFields.stateConfidence,morningFields.mission,morningFields.priority1,morningFields.priority2,morningFields.priority3,morningFields.obstacles].every(el=>isFilled(el.value)); morningCard.classList.toggle('complete-block', complete); morningBadge.textContent=complete?'Complete':'In progress'; morningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }
  function evaluateEveningCompletion(){ const complete=[eveningFields.missionDebrief,eveningFields.biggestWin,eveningFields.biggestLesson,eveningFields.identityReflection,eveningFields.improveTomorrow].every(el=>isFilled(el.value)); eveningCard.classList.toggle('complete-block', complete); eveningBadge.textContent=complete?'Complete':'In progress'; eveningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }

  function saveMorning(){
    const complete = evaluateMorningCompletion();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const existing = getJournalEntry(keyFromDate(currentDate),'morning') || {};
    const payload={rested:morningFields.rested.value,sharpness:morningFields.sharpness.value,calm:morningFields.calm.value,motivation:morningFields.motivation.value,clarity:morningFields.clarity.value,drive:morningFields.drive.value,identity:morningFields.identity.value,purpose:morningFields.purpose.value,stateConfidence:morningFields.stateConfidence.value,mission:morningFields.mission.value,priority1:morningFields.priority1.value,priority2:morningFields.priority2.value,priority3:morningFields.priority3.value,obstacles:morningFields.obstacles.value,score:computeMorningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
    setJournalEntry(keyFromDate(currentDate),'morning',payload);
    morningSavedPill.textContent = `Saved ${timeStr}`;
    morningSavedPill.style.display='inline';
    setTimeout(()=>morningSavedPill.style.display='none',2500);
    entryStatus.textContent='Saved morning entry for '+fullDate.textContent;
    updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
  }

  function saveEvening(){
    const complete = evaluateEveningCompletion();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    const existing = getJournalEntry(keyFromDate(currentDate),'evening') || {};
    const payload={execution:eveningFields.execution.value,discipline:eveningFields.discipline.value,dopamine:eveningFields.dopamine.value,physical:eveningFields.physical.value,builder:eveningFields.builder.value,sleepprep:eveningFields.sleepprep.value,missionDebrief:eveningFields.missionDebrief.value,biggestWin:eveningFields.biggestWin.value,biggestLesson:eveningFields.biggestLesson.value,identityReflection:eveningFields.identityReflection.value,improveTomorrow:eveningFields.improveTomorrow.value,score:computeEveningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
    setJournalEntry(keyFromDate(currentDate),'evening',payload);
    eveningSavedPill.textContent = `Saved ${timeStr}`;
    eveningSavedPill.style.display='inline';
    setTimeout(()=>eveningSavedPill.style.display='none',2500);
    entryStatus.textContent='Saved evening entry for '+fullDate.textContent;
    updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
  }

  function loadMorning(){ const data=getJournalEntry(keyFromDate(currentDate),'morning')||{}; morningFields.rested.value=data.rested??3; morningFields.sharpness.value=data.sharpness??3; morningFields.calm.value=data.calm??3; morningFields.motivation.value=data.motivation??3; morningFields.clarity.value=data.clarity??3; morningFields.drive.value=data.drive??3; morningFields.identity.value=data.identity??''; morningFields.purpose.value=data.purpose??''; morningFields.stateConfidence.value=data.stateConfidence??''; morningFields.mission.value=data.mission??''; morningFields.priority1.value=data.priority1??''; morningFields.priority2.value=data.priority2??''; morningFields.priority3.value=data.priority3??''; morningFields.obstacles.value=data.obstacles??''; morningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = morningFields[key].value; }); computeMorningScore(); evaluateMorningCompletion(); }

  function loadEvening(){ const data=getJournalEntry(keyFromDate(currentDate),'evening')||{}; eveningFields.execution.value=data.execution??3; eveningFields.discipline.value=data.discipline??3; eveningFields.dopamine.value=data.dopamine??3; eveningFields.physical.value=data.physical??3; eveningFields.builder.value=data.builder??3; eveningFields.sleepprep.value=data.sleepprep??3; eveningFields.missionDebrief.value=data.missionDebrief??''; eveningFields.biggestWin.value=data.biggestWin??''; eveningFields.biggestLesson.value=data.biggestLesson??''; eveningFields.identityReflection.value=data.identityReflection??''; eveningFields.improveTomorrow.value=data.improveTomorrow??''; eveningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = eveningFields[key].value; }); computeEveningScore(); evaluateEveningCompletion();
    const morningEl = document.getElementById('journalTodayMissionReminder');
    if (morningEl) {
      const morningData = getJournalEntry(keyFromDate(currentDate), 'morning') || {};
      if (morningData.mission && morningData.mission.trim()) {
        morningEl.style.display = 'block';
        morningEl.textContent = '📋 Today\'s mission: "' + morningData.mission.trim() + '"';
      } else { morningEl.style.display = 'none'; }
    }
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

  if (jumpTodayBtn) {
    jumpTodayBtn.addEventListener('click', () => {
      currentDate = new Date(deps.getToday() + 'T12:00:00');
      formatDateDisplay(currentDate);
      loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
      updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
    });
  }

  // ── Monthly objectives in journal (read-only reference) ────────────────
  function updateJournalMonthObjectives() {
    const el = document.getElementById('journalMonthObjectives');
    if (!el) return;

    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const monthObjs = deps.state.data.monthObjectives?.[monthKey] || [];

    if (!monthObjs.length) { el.innerHTML = ''; return; }

    const MONTH_CAT_LABELS = { tjm: 'TJM', vinted: 'Vinted', notts: 'Nottingham', other: 'Other' };
    const MONTH_CAT_COLOURS = { tjm: '#C9A84C', vinted: '#27ae60', notts: '#3498db', other: '#9b59b6' };

    const fmtShort = d => {
      if (!d) return '';
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    el.innerHTML = `
    <div style="margin-bottom:10px;">
      <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:8px;text-transform:uppercase;">Monthly Objectives</div>
      ${monthObjs.map((obj, i) => {
        const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Other';
        const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
        const nowD = new Date(); nowD.setHours(0,0,0,0);
        const daysLeft = obj.deadline ? Math.ceil((new Date(obj.deadline + 'T00:00:00') - nowD) / 86400000) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0 && !obj.done;
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;border:1px solid ${obj.done?'rgba(46,204,113,0.25)':isOverdue?'rgba(231,76,60,0.2)':'rgba(255,255,255,0.08)'};background:${obj.done?'rgba(26,92,58,0.3)':'rgba(255,255,255,0.02)'};margin-bottom:5px;">
          <div style="width:16px;height:16px;flex-shrink:0;border-radius:4px;border:1.5px solid ${obj.done?'rgba(46,204,113,0.6)':catColor+'55'};background:${obj.done?'rgba(46,204,113,0.15)':'transparent'};color:${obj.done?'#2ecc71':catColor};font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:900;">${obj.done?'✓':''}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:${obj.done?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.9)'};${obj.done?'text-decoration:line-through;':''}line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${obj.text}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
            <span style="font-size:8px;font-weight:900;letter-spacing:0.8px;color:${catColor};opacity:0.8;">${catLabel.toUpperCase()}</span>
            ${obj.deadline ? `<span style="font-size:9px;color:${isOverdue?'#e74c3c':'rgba(255,255,255,0.3)'};font-weight:${isOverdue?'800':'600'};">${isOverdue?'⚠':''}${fmtShort(obj.deadline)}</span>` : ''}
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
    loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
    updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
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
    loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
    updateStreakDisplay(); updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();
  });

  formatDateDisplay(currentDate);
  loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
  updateStreakDisplay(); updateLauncherButtons();
  updateJournalMonthObjectives(); updateJournalWeekObjectives(); updateWeekMission();

}
