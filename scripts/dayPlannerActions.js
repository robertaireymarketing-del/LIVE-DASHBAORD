// Day planner, week objectives, time picker, batch steps, streams,
// identity/mission/weekplan, past days, retention log editing.
// Call once after render is defined: initDayPlannerActions({ state, saveData, saveDataQuiet, render, ... })

export function initDayPlannerActions({
  state, saveData, saveDataQuiet, render,
  getWeekKey, getNextWeekKey, getTodayDayKey, isSunday,
  getProjectFronts, getMissionTargets, BATCH_COLOURS,
}) {

  // ── Internal helpers ───────────────────────────────────────────────────
  async function autoSaveDayDraft() {
    if (!state.dayPlannerDraft || !state.dayPlannerDay) return;
    const activeDay = state.dayPlannerDay;
    const weekOffset = state.dayPlannerWeekOffset || 0;
    let weekKey;
    if (weekOffset === 0) {
      weekKey = getWeekKey();
    } else {
      const now = new Date(); const curDay = now.getDay(); const daysToMon = curDay===0?6:curDay-1;
      const mon = new Date(now); mon.setDate(now.getDate()-daysToMon+(weekOffset*7)); mon.setHours(0,0,0,0);
      weekKey = getWeekKey(mon);
    }
    if (!state.data.projectFronts) state.data.projectFronts = getProjectFronts();
    ['tjm','vinted','notts','_other'].forEach(fk => {
      const tasks = (state.dayPlannerDraft[fk] || [])
        .filter(t => { const text = typeof t === 'object' ? t.text : t; return text && String(text).trim(); })
        .map(t => typeof t === 'object' ? t : { text: t, start:'', end:'' });
      if (!state.data.projectFronts[fk]) state.data.projectFronts[fk] = { name: fk === '_other' ? 'Other' : fk, status:'pipeline', weekPlans:{} };
      if (!state.data.projectFronts[fk].weekPlans) state.data.projectFronts[fk].weekPlans = {};
      if (!state.data.projectFronts[fk].weekPlans[weekKey]) state.data.projectFronts[fk].weekPlans[weekKey] = {};
      state.data.projectFronts[fk].weekPlans[weekKey][activeDay] = tasks;
    });
    if (!state.data.dayBatchPlan) state.data.dayBatchPlan = {};
    if (!state.data.dayBatchPlan[weekKey]) state.data.dayBatchPlan[weekKey] = {};
    if (!state.data.dayBatchPlan[weekKey][activeDay]) state.data.dayBatchPlan[weekKey][activeDay] = {};
    state.data.dayBatchPlan[weekKey][activeDay]._batch = state.dayPlannerDraft._batch || [];
    state.data.dayBatchPlan[weekKey][activeDay]._streams = state.dayPlannerDraft._streams || [];
    await saveData();
  }

  function getUnscheduledSteps() {
    const draftKeys = new Set();
    const doneKeys = new Set();
    (state.dayPlannerDraft?._batch||[]).forEach(s => draftKeys.add(`${s.batchId}:${s.stepIdx}`));
    Object.values(state.data.dayBatchPlan||{}).forEach(weekData =>
      Object.values(weekData).forEach(dayData =>
        (dayData._batch||[]).forEach(s => { if (s.done) doneKeys.add(`${s.batchId}:${s.stepIdx}`); })
      )
    );
    const steps = [];
    (state.data.tjmBatches||[]).filter(b=>b.status!=='done'&&b.status!=='archived').forEach(b=>{
      const colour = BATCH_COLOURS.find(c=>c.id===(b.colour||'gold'))||BATCH_COLOURS[0];
      (b.steps||[]).forEach((s,si)=>{
        const key = `${b.id}:${si}`;
        if(!s.completedAt && !draftKeys.has(key) && !doneKeys.has(key))
          steps.push({ batchId:b.id, batchName:b.name, stepIdx:si, stepName:s.name, timeBlock:s.timeBlock||30, hex:colour.hex, colourId:b.colour||'gold', deadline:s.deadline||'' });
      });
    });
    steps.sort((a,b) => {
      if(!a.deadline && !b.deadline) return 0;
      if(!a.deadline) return 1; if(!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });
    return steps;
  }

  function getAllTimedItems(excludeBatchIdx) {
    const items = [];
    (state.dayPlannerDraft?._batch||[]).forEach((s, si) => {
      if(si !== excludeBatchIdx && s.startTime) items.push({ start: s.startTime, dur: s.timeBlock||30, name: s.stepName });
    });
    (state.dayPlannerDraft?._streams||[]).forEach(s => {
      if(s.start) { const [sh,sm]=s.start.split(':').map(Number); const [eh,em]=(s.end||'00:00').split(':').map(Number); items.push({ start: s.start, dur: (eh*60+em)-(sh*60+sm)||60, name: s.topic||'Livestream' }); }
    });
    ['tjm','vinted','notts','_other'].forEach(fk => {
      (state.dayPlannerDraft?.[fk]||[]).forEach(t => {
        if(t.start) { const [sh,sm]=t.start.split(':').map(Number); const [eh,em]=(t.end||'00:00').split(':').map(Number); items.push({ start: t.start, dur: (eh*60+em)-(sh*60+sm)||30, name: t.text }); }
      });
    });
    return items;
  }

  // ── Month rollover helper ──────────────────────────────────────────────
  function rolloverMonthObjectives() {
    const now = new Date();
    const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    if (!state.data.monthObjectives) state.data.monthObjectives = {};

    // Find any incomplete objectives from previous months — carry forward to current month
    const currentObjs = state.data.monthObjectives[currentMonthKey] || [];
    const currentIds = new Set(currentObjs.map(o => o.id));
    let didAdd = false;

    Object.entries(state.data.monthObjectives).forEach(([mk, objs]) => {
      if (mk >= currentMonthKey) return; // skip current and future
      (objs || []).forEach(obj => {
        if (!obj.done && !currentIds.has(obj.id)) {
          // carry forward — keep original deadline so it shows as overdue
          if (!state.data.monthObjectives[currentMonthKey]) state.data.monthObjectives[currentMonthKey] = [];
          state.data.monthObjectives[currentMonthKey].push({ ...obj });
          currentIds.add(obj.id);
          didAdd = true;
        }
      });
    });

    if (didAdd) saveDataQuiet();
  }

  // ── Batch step rollover helper ─────────────────────────────────────────
  // Runs once per calendar day. Scans the previous 7 days for batch steps
  // that were scheduled but not marked done, and carries them into today's
  // plan so they surface automatically in the planner.
  async function rolloverIncompleteBatchSteps() {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayISO = today.toISOString().split('T')[0];

    // Only run once per calendar day
    if (state.data.lastBatchRolloverDate === todayISO) return 0;

    const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
    const todayDayKey = DAY_KEYS[today.getDay()];
    const todayWeekKey = getWeekKey(today);

    // Ensure today's plan structure exists
    if (!state.data.dayBatchPlan) state.data.dayBatchPlan = {};
    if (!state.data.dayBatchPlan[todayWeekKey]) state.data.dayBatchPlan[todayWeekKey] = {};
    if (!state.data.dayBatchPlan[todayWeekKey][todayDayKey]) {
      state.data.dayBatchPlan[todayWeekKey][todayDayKey] = { _batch: [], _streams: [] };
    }
    const todayBatch = state.data.dayBatchPlan[todayWeekKey][todayDayKey]._batch || [];
    const todayKeys = new Set(todayBatch.map(s => `${s.batchId}:${s.stepIdx}`));

    // Build a set of all globally-completed step keys (completedAt on the batch step itself)
    const globallyDoneKeys = new Set();
    (state.data.tjmBatches || []).forEach(b =>
      (b.steps || []).forEach((s, si) => { if (s.completedAt) globallyDoneKeys.add(`${b.id}:${si}`); })
    );

    let rolledOver = 0;

    // Check past 7 days
    for (let daysBack = 1; daysBack <= 7; daysBack++) {
      const past = new Date(today);
      past.setDate(today.getDate() - daysBack);
      const pastDayKey = DAY_KEYS[past.getDay()];
      const pastWeekKey = getWeekKey(past);

      const pastBatch = state.data.dayBatchPlan?.[pastWeekKey]?.[pastDayKey]?._batch || [];
      const incomplete = pastBatch.filter(s =>
        !s.done &&
        !globallyDoneKeys.has(`${s.batchId}:${s.stepIdx}`) &&
        !todayKeys.has(`${s.batchId}:${s.stepIdx}`)
      );

      for (const step of incomplete) {
        const key = `${step.batchId}:${step.stepIdx}`;
        todayBatch.push({ ...step, done: false, startTime: '', rolledOver: true, rolledOverFrom: pastDayKey });
        todayKeys.add(key);
        rolledOver++;
      }
    }

    if (rolledOver > 0) {
      state.data.dayBatchPlan[todayWeekKey][todayDayKey]._batch = todayBatch;
    }

    state.data.lastBatchRolloverDate = todayISO;
    if (rolledOver > 0) {
      await saveData();
    } else {
      saveDataQuiet();
    }

    return rolledOver;
  }


  function getObjectiveBaseDate() {
    return state.objModalDate ? new Date(state.objModalDate) : new Date();
  }

  function wireMonthDeadlineDisplay() {
    const dlInput = document.getElementById('new-month-obj-deadline');
    const dlDisplay = document.getElementById('new-month-obj-deadline-display');
    if (dlInput && dlDisplay) {
      dlInput.addEventListener('change', () => {
        if (dlInput.value) {
          const dt = new Date(dlInput.value + 'T00:00:00');
          dlDisplay.textContent = '📅 ' + dt.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
          dlDisplay.style.color = '#C9A84C';
          dlDisplay.style.fontWeight = '800';
        } else {
          dlDisplay.textContent = '📅 Set deadline (optional)';
          dlDisplay.style.color = 'rgba(255,255,255,0.3)';
          dlDisplay.style.fontWeight = '400';
        }
      });
    }
  }

  function initEmbeddedDayPlanner() {
    rolloverIncompleteBatchSteps(); // fire-and-forget — updates Firebase in background
    if (state.dayPlannerDraft && state.dayPlannerDay) return; // already initialised
    const weekKey = getWeekKey();
    const fronts = getProjectFronts();
    const activeDay = getTodayDayKey();
    const draft = {};
    ['tjm','vinted','notts','_other'].forEach(fk => {
      const plan = fronts[fk]?.weekPlans?.[weekKey] || {};
      const t = plan[activeDay];
      draft[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
    });
    draft._batch = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._batch || [])];
    draft._streams = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._streams || [])];
    state.dayPlannerDay = activeDay;
    state.dayPlannerDraft = draft;
    state.dayPlannerWeekOffset = 0;
    state.dayPlannerStreamForm = false;
    state.dayPlannerStreamDraft = null;
  }

  window.openObjectivesModal = (tab) => {
    rolloverMonthObjectives();
    state.objectivesModalOpen = true;
    state.objModalTab = tab || 'weekly';
    state.objModalDate = state.objModalDate || new Date().toISOString();
    if ((tab || 'weekly') === 'weekly') initEmbeddedDayPlanner();
    render();
    setTimeout(wireMonthDeadlineDisplay, 50);
  };

  window.closeObjectivesModal = (e) => {
    if (e.target === e.currentTarget) { state.objectivesModalOpen = false; render(); }
  };

  window.closeObjectivesModalBtn = () => {
    state.objectivesModalOpen = false; render();
  };

  window.switchObjTab = (tab) => {
    state.objModalTab = tab;
    if (tab === 'weekly') initEmbeddedDayPlanner();
    render();
    if (tab === 'monthly') setTimeout(wireMonthDeadlineDisplay, 50);
  };

  window.shiftObjectivesPeriod = (offset) => {
    const base = getObjectiveBaseDate();
    if ((state.objModalTab || 'weekly') === 'monthly') {
      base.setDate(1);
      base.setMonth(base.getMonth() + offset);
    } else {
      base.setDate(base.getDate() + (offset * 7));
    }
    state.objModalDate = base.toISOString();
    render();
    if ((state.objModalTab || 'weekly') === 'monthly') setTimeout(wireMonthDeadlineDisplay, 50);
  };

  window.jumpObjectivesToToday = () => {
    state.objModalDate = new Date().toISOString();
    render();
    if ((state.objModalTab || 'weekly') === 'monthly') setTimeout(wireMonthDeadlineDisplay, 50);
  };

  window.selectMonthObjCat = (cat) => {
    document.querySelectorAll('[id^="moc-"]').forEach(b => b.classList.toggle('selected', b.id === 'moc-'+cat));
    const hidden = document.getElementById('new-month-obj-cat');
    if (hidden) hidden.value = cat;
    const customWrap = document.getElementById('new-month-obj-custom-wrap');
    if (customWrap) customWrap.style.display = cat === 'other' ? '' : 'none';
  };

  window.selectWeekObjCat = (cat) => {
    document.querySelectorAll('[id^="woc-"]').forEach(b => b.classList.toggle('selected', b.id === 'woc-'+cat));
    const hidden = document.getElementById('new-week-obj-cat');
    if (hidden) hidden.value = cat;
    const customWrap = document.getElementById('new-week-obj-custom-wrap');
    if (customWrap) customWrap.style.display = cat === 'other' ? '' : 'none';
  };

  // ── Monthly Objectives CRUD ────────────────────────────────────────────
  window.addMonthObj = async (monthKey) => {
    const textEl = document.getElementById('new-month-obj-text');
    const catEl = document.getElementById('new-month-obj-cat');
    const customEl = document.getElementById('new-month-obj-custom');
    const deadlineEl = document.getElementById('new-month-obj-deadline');
    const text = textEl?.value?.trim();
    if (!text) { textEl?.focus(); return; }
    const cat = catEl?.value || 'tjm';
    const categoryCustom = cat === 'other' ? (customEl?.value?.trim() || '') : '';
    const deadline = deadlineEl?.value || '';
    if (!state.data.monthObjectives) state.data.monthObjectives = {};
    if (!state.data.monthObjectives[monthKey]) state.data.monthObjectives[monthKey] = [];
    state.data.monthObjectives[monthKey].push({
      id: 'mo_' + Date.now(),
      text,
      category: cat,
      categoryCustom,
      deadline,
      done: false,
      doneAt: null,
      createdAt: Date.now(),
    });
    await saveData();
    render();
  };

  window.toggleMonthObj = async (monthKey, i) => {
    const objs = state.data.monthObjectives?.[monthKey];
    if (!objs || !objs[i]) return;
    objs[i].done = !objs[i].done;
    objs[i].doneAt = objs[i].done ? Date.now() : null;
    await saveData();
    render();
  };

  window.removeMonthObj = async (monthKey, i) => {
    const objs = state.data.monthObjectives?.[monthKey];
    if (!objs) return;
    objs.splice(i, 1);
    await saveData();
    render();
  };

  // ── Day Planner ────────────────────────────────────────────────────────
  window.openDayPlanner = async () => {
    await rolloverIncompleteBatchSteps();
    const weekKey = getWeekKey();
    const fronts = getProjectFronts();
    const activeDay = getTodayDayKey();
    const draft = {};
    ['tjm','vinted','notts','_other'].forEach(fk => {
      const plan = fronts[fk]?.weekPlans?.[weekKey] || {};
      const t = plan[activeDay];
      draft[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
    });
    draft._batch = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._batch || [])];
    draft._streams = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._streams || [])];
    state.dayPlannerOpen = true;
    state.dayPlannerDay = activeDay;
    state.dayPlannerDraft = draft;
    state.dayPlannerWeekOffset = 0;
    state.dayPlannerStreamForm = false;
    state.dayPlannerStreamDraft = null;
    // Close objectives modal if open
    state.objectivesModalOpen = false;
    render();
  };

  window.closeDayPlanner = (e) => { if (e.target.classList.contains('week-plan-overlay')) { state.dayPlannerOpen = false; render(); } };
  window.closeDayPlannerBtn = () => { state.dayPlannerOpen = false; render(); };

  window.navPlanWeek = async (dir) => {
    await autoSaveDayDraft();
    state.dayPlannerWeekOffset = (state.dayPlannerWeekOffset || 0) + dir;
    state.dayPlannerDraft = null;
    render();
  };

  // ── Week Objectives ────────────────────────────────────────────────────
  window.editMonthObj = (monthKey, i) => { state.monthObjEditing = `${monthKey}:${i}`; render(); };
  window.cancelMonthObjEdit = () => { state.monthObjEditing = null; render(); };
  window.saveMonthObjEdit = async (monthKey, i) => {
    const obj = state.data.monthObjectives?.[monthKey]?.[i];
    if (!obj) return;
    const text = document.getElementById(`edit-month-obj-text-${i}`)?.value?.trim();
    const deadline = document.getElementById(`edit-month-obj-deadline-${i}`)?.value || '';
    if (text) obj.text = text;
    obj.deadline = deadline;
    await saveData();
    state.monthObjEditing = null;
    render();
  };

  window.editWeekObj = (weekKey, i) => { state.weekObjEditing = `${weekKey}:${i}`; render(); };
  window.cancelWeekObjEdit = () => { state.weekObjEditing = null; render(); };
  window.saveWeekObjEdit = async (weekKey, i) => {
    const obj = state.data.weekObjectives?.[weekKey]?.[i];
    if (!obj) return;
    const text = document.getElementById(`edit-week-obj-text-${i}`)?.value?.trim();
    const deadline = document.getElementById(`edit-week-obj-deadline-${i}`)?.value || '';
    if (text) obj.text = text;
    obj.deadline = deadline;
    await saveData();
    state.weekObjEditing = null;
    render();
  };

  window.addWeekObj = async (weekKey) => {
    const inp = document.getElementById(`new-week-obj-${weekKey}`);
    const catEl = document.getElementById('new-week-obj-cat');
    const customEl = document.getElementById('new-week-obj-custom');
    const text = inp?.value?.trim();
    if (!text) return;
    const cat = catEl?.value || 'tjm';
    const categoryCustom = cat === 'other' ? (customEl?.value?.trim() || '') : '';
    const deadline = document.getElementById('new-week-obj-deadline')?.value || '';
    if (!state.data.weekObjectives) state.data.weekObjectives = {};
    if (!Array.isArray(state.data.weekObjectives[weekKey])) state.data.weekObjectives[weekKey] = [];
    state.data.weekObjectives[weekKey].push({ text, done: false, category: cat, categoryCustom, deadline, createdAt: Date.now() });
    await saveData(); render();
  };

  window.toggleWeekObj = async (weekKey, i) => {
    if (!state.data.weekObjectives?.[weekKey]) return;
    state.data.weekObjectives[weekKey][i].done = !state.data.weekObjectives[weekKey][i].done;
    await saveData(); render();
  };

  window.removeWeekObj = async (weekKey, i) => {
    if (!state.data.weekObjectives?.[weekKey]) return;
    state.data.weekObjectives[weekKey].splice(i, 1);
    await saveData(); render();
  };

  // ── Day Planner – Day Switching & Tasks ───────────────────────────────
  window.switchPlanDay = async (day) => {
    await autoSaveDayDraft();
    state.dayPlannerDay = day;
    const weekOffset = state.dayPlannerWeekOffset || 0;
    const fronts = getProjectFronts();
    const now = new Date(); const curDay = now.getDay(); const daysToMon = curDay===0?6:curDay-1;
    const mon = new Date(now); mon.setDate(now.getDate()-daysToMon+(weekOffset*7)); mon.setHours(0,0,0,0);
    const td = new Date(mon); td.setDate(td.getDate()+3-(td.getDay()+6)%7);
    const w1=new Date(td.getFullYear(),0,4);
    const wn=1+Math.round(((td-w1)/86400000-3+(w1.getDay()+6)%7)/7);
    const wk=td.getFullYear()+'-W'+String(wn).padStart(2,'0');
    const draft = {};
    ['tjm','vinted','notts','_other'].forEach(fk => {
      const plan = fronts[fk]?.weekPlans?.[wk] || {};
      const t = plan[day];
      draft[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
    });
    draft._batch = [...(state.data.dayBatchPlan?.[wk]?.[day]?._batch || [])];
    draft._streams = [...(state.data.dayBatchPlan?.[wk]?.[day]?._streams || [])];
    state.dayPlannerDraft = draft;
    state.dayPlannerStreamForm = false;
    render();
  };

  window.addDraftTask = (fk) => { if (!state.dayPlannerDraft) state.dayPlannerDraft = {}; if (!state.dayPlannerDraft[fk]) state.dayPlannerDraft[fk] = []; state.dayPlannerDraft[fk].push({ text:'', start:'', end:'' }); render(); };
  window.removeDraftTask = (fk, ti) => { if (state.dayPlannerDraft?.[fk]) { state.dayPlannerDraft[fk].splice(ti, 1); render(); } };
  window.updateDraftTask = (fk, ti, val, field) => {
    if (!state.dayPlannerDraft?.[fk]) return;
    const existing = state.dayPlannerDraft[fk][ti];
    const obj = typeof existing === 'object' ? existing : { text: existing||'', start:'', end:'' };
    obj[field || 'text'] = val;
    state.dayPlannerDraft[fk][ti] = obj;
  };

  window.saveDayPlan = async (weekKey) => {
    const activeDay = state.dayPlannerDay || getTodayDayKey();
    if (!state.data.projectFronts) state.data.projectFronts = getProjectFronts();
    ['tjm','vinted','notts','_other'].forEach(fk => {
      const tasks = (state.dayPlannerDraft?.[fk] || [])
        .filter(t => { const text = typeof t === 'object' ? t.text : t; return text && String(text).trim(); })
        .map(t => typeof t === 'object' ? t : { text: t, start:'', end:'' });
      if (!state.data.projectFronts[fk]) state.data.projectFronts[fk] = { name: fk === '_other' ? 'Other' : fk, status:'pipeline', weekPlans:{} };
      if (!state.data.projectFronts[fk].weekPlans) state.data.projectFronts[fk].weekPlans = {};
      if (!state.data.projectFronts[fk].weekPlans[weekKey]) state.data.projectFronts[fk].weekPlans[weekKey] = {};
      state.data.projectFronts[fk].weekPlans[weekKey][activeDay] = tasks;
    });
    if (!state.data.dayBatchPlan) state.data.dayBatchPlan = {};
    if (!state.data.dayBatchPlan[weekKey]) state.data.dayBatchPlan[weekKey] = {};
    if (!state.data.dayBatchPlan[weekKey][activeDay]) state.data.dayBatchPlan[weekKey][activeDay] = {};
    state.data.dayBatchPlan[weekKey][activeDay]._batch = state.dayPlannerDraft?._batch || [];
    state.data.dayBatchPlan[weekKey][activeDay]._streams = state.dayPlannerDraft?._streams || [];
    await saveData();
    state.dayPlannerOpen = false; render();
  };

  // ── Batch Steps ────────────────────────────────────────────────────────
  window.assignBatchStep = (idx) => {
    const step = getUnscheduledSteps()[idx];
    if(!step) return;
    if(!state.dayPlannerDraft) state.dayPlannerDraft = {};
    if(!state.dayPlannerDraft._batch) state.dayPlannerDraft._batch = [];
    state.dayPlannerDraft._batch.push({ ...step, done: false, startTime: '' });
    render();
  };

  window.updateBatchStepTime = (si, startTime, durationMins) => {
    if(!state.dayPlannerDraft?._batch?.[si]) return;
    state.dayPlannerDraft._batch[si].startTime = startTime;
    const card = document.querySelector(`[data-batch-si="${si}"]`);
    if(card) {
      const endSpan = card.querySelector('.batch-end-time');
      if(endSpan && startTime) {
        const [sh,sm] = startTime.split(':').map(Number);
        const totalMins = sh*60+sm+durationMins;
        endSpan.textContent = '→ '+String(Math.floor(totalMins/60)%24).padStart(2,'0')+':'+String(totalMins%60).padStart(2,'0');
      }
    }
  };

  window.removeBatchFromDraft = (si) => { if(state.dayPlannerDraft?._batch) { state.dayPlannerDraft._batch.splice(si, 1); render(); } };
  window.markWeekBatchStepDone = async (batchId, stepIdx, draftIdx) => {
    if(state.dayPlannerDraft?._batch?.[draftIdx]) state.dayPlannerDraft._batch[draftIdx].done = true;
    await markBatchStepComplete(batchId, stepIdx);
  };

  window.navBatchStep = (id, dir) => {
    const b = (state.data.tjmBatches||[]).find(b=>b.id===id);
    if(!b) return;
    const current = state.batchViewStep?.[id] ?? (b.currentStepIdx||0);
    const next = Math.max(0, Math.min((b.steps||[]).length-1, current+dir));
    if(!state.batchViewStep) state.batchViewStep = {};
    state.batchViewStep[id] = next; render();
  };

  async function markBatchStepComplete(id, stepIdx) {
    const batches = state.data.tjmBatches||[];
    const b = batches.find(b=>b.id===id);
    if(!b||!b.steps?.[stepIdx]) return;
    b.steps[stepIdx].completedAt = Date.now();
    const nextIncomplete = b.steps.findIndex((s,i) => i > stepIdx && !s.completedAt);
    if(nextIncomplete === -1 && b.steps.every(s=>s.completedAt)) { b.status = 'done'; }
    else if(nextIncomplete !== -1) { b.currentStepIdx = nextIncomplete; }
    state.data.tjmBatches = batches;
    await saveData(); render();
  }

  window.markBatchStepComplete = markBatchStepComplete;

  async function unmarkBatchStep(id, stepIdx) {
    const batches = state.data.tjmBatches||[];
    const b = batches.find(b=>b.id===id);
    if(!b||!b.steps?.[stepIdx]) return;
    b.steps[stepIdx].completedAt = null;
    if(b.status === 'done') b.status = 'scheduled';
    if((b.currentStepIdx||0) > stepIdx) b.currentStepIdx = stepIdx;
    state.data.tjmBatches = batches;
    await saveData(); render();
  }

  window.unmarkBatchStep = unmarkBatchStep;
  window.unmarkWeekBatchStepDone = async (draftIdx) => {
    const step = state.dayPlannerDraft?._batch?.[draftIdx];
    if(!step) return;
    state.dayPlannerDraft._batch[draftIdx].done = false;
    await unmarkBatchStep(step.batchId, step.stepIdx);
  };

  window.toggleBatchStepDoneToday = async (batchId, draftIdx) => {
    const weekKey = getWeekKey();
    const todayDayKey = getTodayDayKey();
    if(!state.data.dayBatchPlan?.[weekKey]?.[todayDayKey]?._batch?.[draftIdx]) return;
    const stepEntry = state.data.dayBatchPlan[weekKey][todayDayKey]._batch[draftIdx];
    stepEntry.done = !stepEntry.done;
    if(stepEntry.done) { await markBatchStepComplete(batchId, stepEntry.stepIdx); }
    else { await unmarkBatchStep(batchId, stepEntry.stepIdx); }
  };

  window.toggleFrontDone = async (key) => {
    const today = new Date().toISOString().split('T')[0];
    if (!state.data.frontsDone) state.data.frontsDone = {};
    if (!state.data.frontsDone[today]) state.data.frontsDone[today] = {};
    state.data.frontsDone[today][key] = !state.data.frontsDone[today][key];
    await saveData(); render();
  };

  // ── Streams ────────────────────────────────────────────────────────────
  window.toggleStreamForm = () => {
    state.dayPlannerStreamForm = !state.dayPlannerStreamForm;
    if(state.dayPlannerStreamForm) state.dayPlannerStreamDraft = state.dayPlannerStreamDraft || { start:'17:00', end:'18:30', topic:'' };
    if(!state.dayPlannerDraft) {
      const weekKey = getWeekKey();
      const activeDay = getTodayDayKey();
      const fronts = getProjectFronts();
      const draft = {};
      ['tjm','vinted','notts','_other'].forEach(fk => {
        const plan = fronts[fk]?.weekPlans?.[weekKey] || {};
        const t = plan[activeDay];
        draft[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
      });
      draft._batch = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._batch || [])];
      draft._streams = [...(state.data.dayBatchPlan?.[weekKey]?.[activeDay]?._streams || [])];
      state.dayPlannerDraft = draft;
    }
    render();
  };

  window.cancelStreamForm = () => { state.dayPlannerStreamForm = false; render(); };
  window.addStreamToDraft = () => {
    const topic = document.getElementById('stream-topic')?.value?.trim() || 'Livestream';
    const s = state.dayPlannerStreamDraft || {};
    let end = s.end || '';
    if(s.start && !end) {
      const [sh,sm] = s.start.split(':').map(Number);
      const endM = sh*60+sm+60;
      end = String(Math.floor(endM/60)%24).padStart(2,'0')+':'+String(endM%60).padStart(2,'0');
    }
    if(!state.dayPlannerDraft) state.dayPlannerDraft = {};
    if(!state.dayPlannerDraft._streams) state.dayPlannerDraft._streams = [];
    state.dayPlannerDraft._streams.push({ topic, start: s.start||'', end });
    state.dayPlannerStreamForm = false; state.dayPlannerStreamDraft = null; render();
  };
  window.removeStreamFromDraft = (si) => { if(state.dayPlannerDraft?._streams) { state.dayPlannerDraft._streams.splice(si,1); render(); } };

  // ── Time Picker ────────────────────────────────────────────────────────
  window.openTimePicker = (fk, ti, field) => {
    let existing = '';
    if(fk === '_streams') {
      if(!state.dayPlannerStreamDraft) state.dayPlannerStreamDraft = { start:'17:00', end:'18:30' };
      existing = state.dayPlannerStreamDraft[field] || '17:00';
    } else if(fk === '_batchStep') {
      existing = state.dayPlannerDraft?._batch?.[ti]?.startTime || '09:00';
    } else {
      const task = state.dayPlannerDraft?.[fk]?.[ti];
      existing = typeof task === 'object' ? (field==='start'?task.start:task.end) : '';
    }
    const [h, m] = existing ? existing.split(':') : ['09','00'];
    const minute = ['00','05','10','15','20','25','30','35','40','45','50','55'].includes(m) ? m : '00';
    state.timePickerOpen = { fk, ti, field, hour: h||'09', minute };
    render();
    setTimeout(() => {
      const ITEM = 52;
      const hours = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));
      const mins = ['00','05','10','15','20','25','30','35','40','45','50','55'];
      const hEl = document.getElementById('tp-hours');
      const mEl = document.getElementById('tp-mins');
      if (hEl) hEl.scrollTop = hours.indexOf(h||'09') * ITEM;
      if (mEl) mEl.scrollTop = mins.indexOf(minute) * ITEM;
      [['tp-hours', h||'09'], ['tp-mins', minute]].forEach(([colId, val]) => {
        document.querySelectorAll('#'+colId+' [data-val]').forEach(item => {
          const active = item.dataset.val === val;
          item.style.color = active ? '#C9A84C' : 'rgba(255,255,255,0.45)';
          item.style.fontWeight = active ? '800' : '500';
          item.style.fontSize = active ? '24px' : '20px';
        });
      });
    }, 30);
  };

  window.closeTimePicker = () => { state.timePickerOpen = null; render(); };
  window.onTpScroll = (el, type) => {
    if (!state.timePickerOpen) return;
    clearTimeout(el._snapTimer);
    el._snapTimer = setTimeout(() => {
      const ITEM = 52;
      const idx = Math.round(el.scrollTop / ITEM);
      el.scrollTo({ top: idx * ITEM, behavior: 'smooth' });
      const items = type === 'hour'
        ? Array.from({length:24}, (_,i) => String(i).padStart(2,'0'))
        : ['00','05','10','15','20','25','30','35','40','45','50','55'];
      const val = items[Math.max(0, Math.min(idx, items.length-1))];
      if (type === 'hour') state.timePickerOpen.hour = val;
      else state.timePickerOpen.minute = val;
      const disp = document.getElementById('tp-display');
      if (disp) disp.textContent = state.timePickerOpen.hour + ':' + state.timePickerOpen.minute;
      const colId = type === 'hour' ? 'tp-hours' : 'tp-mins';
      document.querySelectorAll('#' + colId + ' [data-val]').forEach(item => {
        const active = item.dataset.val === val;
        item.style.color = active ? '#C9A84C' : 'rgba(255,255,255,0.3)';
        item.style.fontWeight = active ? '800' : '500';
        item.style.fontSize = active ? '24px' : '20px';
      });
      if(state.timePickerOpen?.fk === '_batchStep') {
        const { ti, hour: h2, minute: m2 } = state.timePickerOpen;
        const step = state.dayPlannerDraft?._batch?.[ti];
        const conflictEl = document.getElementById('tp-conflict');
        const setBtn = document.getElementById('tp-set-btn');
        if(step && conflictEl) {
          const startMins = parseInt(h2)*60 + parseInt(m2);
          const endMins = startMins + (step.timeBlock||30);
          const conflict = getAllTimedItems(ti).find(item => {
            const [ih,im] = item.start.split(':').map(Number);
            return startMins < (ih*60+im+item.dur) && endMins > (ih*60+im);
          });
          if(conflict) {
            conflictEl.style.display = 'block';
            conflictEl.textContent = '⚠️ Clashes with "' + conflict.name + '" at ' + conflict.start;
            if(setBtn) { setBtn.style.background='rgba(255,255,255,0.15)'; setBtn.style.color='rgba(255,255,255,0.4)'; setBtn.style.cursor='not-allowed'; }
          } else {
            conflictEl.style.display = 'none';
            if(setBtn) { setBtn.style.background='#C9A84C'; setBtn.style.color='#000'; setBtn.style.cursor='pointer'; }
          }
        }
      }
    }, 80);
  };

  window.confirmTimePicker = () => {
    if (!state.timePickerOpen) return;
    const { fk, ti, field, hour, minute } = state.timePickerOpen;
    if(fk === '_streams') {
      if(!state.dayPlannerStreamDraft) state.dayPlannerStreamDraft = {};
      state.dayPlannerStreamDraft[field] = hour + ':' + minute;
    } else if(fk === '_batchStep') {
      const step = state.dayPlannerDraft?._batch?.[ti];
      if(step) {
        const startTime = hour + ':' + minute;
        const startMins = parseInt(hour)*60 + parseInt(minute);
        const endMins = startMins + (step.timeBlock||30);
        const conflict = getAllTimedItems(ti).find(item => {
          const [ih,im] = item.start.split(':').map(Number);
          return startMins < (ih*60+im+item.dur) && endMins > (ih*60+im);
        });
        if(conflict) {
          state.timePickerOpen = null;
          state.batchStepConflict = { si: ti, msg: `Clashes with "${conflict.name}" at ${conflict.start}` };
          render(); return;
        }
        state.batchStepConflict = null;
        state.dayPlannerDraft._batch[ti].startTime = startTime;
      }
    } else {
      window.updateDraftTask(fk, ti, hour + ':' + minute, field);
    }
    state.timePickerOpen = null; render();
  };

  window.selectTpHour = () => {};
  window.selectTpMin = () => {};
  window.updateTpDisplay = () => {};

  // ── Past Days ──────────────────────────────────────────────────────────
  window.openPastDays = () => { state.pastDaysOpen = true; render(); };
  window.closePastDays = () => { state.pastDaysOpen = false; state.pastDayEditing = null; render(); };
  window.openPastDayEdit = (dateStr) => {
    state.pastDayEditing = dateStr; render();
    setTimeout(()=>{ const el=document.querySelector('.past-days-modal [id^="pdov-'+dateStr+'"]'); if(el)el.scrollIntoView({behavior:'smooth',block:'center'}); },100);
  };
  window.closePastDayEdit = () => { state.pastDayEditing = null; render(); };
  window.savePastDayOverrides = async (dateStr) => {
    if (!state.data.days[dateStr]) state.data.days[dateStr] = {};
    const d = state.data.days[dateStr];
    if (!d._overridden) d._overridden = {};
    const fields = ['sales','revenue','warmLeads','dmsSent','weight','bodyFat','calories','bmr'];
    fields.forEach(k => {
      const el = document.getElementById(`pdov-${dateStr}-${k}`);
      if (!el) return;
      const raw = el.value.trim();
      if (raw === '') { delete d._overridden[k]; }
      else { const val = parseFloat(raw); if (!isNaN(val)) d._overridden[k] = val; }
    });
    const hasOverrides = Object.keys(d._overridden).filter(k => k !== '_lastEdited').length > 0;
    if (!hasOverrides) { delete d._overridden; }
    else { d._overridden._lastEdited = new Date().toISOString(); }
    state.pastDayEditing = null;
    await saveData();
  };
  window.clearPastDayOverrides = async (dateStr) => {
    const d = state.data.days[dateStr];
    if (d) { delete d._overridden; state.pastDayEditing = null; await saveData(); }
    else { state.pastDayEditing = null; render(); }
  };

  // ── Retention Log Editing ──────────────────────────────────────────────
  window.editRetentionLog = (date) => {
    const entry = state.data.retentionLog?.[date] || {};
    state.retentionEditingDate = date;
    state.retentionEditDraft = { ...entry };
    render();
  };
  window.updateRetentionEditSlider = (date, key, val) => {
    state.retentionEditDraft = { ...(state.retentionEditDraft || {}), [key]: parseInt(val) };
    const el = document.getElementById(`re-${date}-${key}`);
    if (el) el.textContent = val + '/10';
  };
  window.updateRetentionEditNote = (date, val) => {
    state.retentionEditDraft = { ...(state.retentionEditDraft || {}), notes: val };
  };
  window.saveRetentionEdit = async (date) => {
    if (!state.data.retentionLog) state.data.retentionLog = {};
    state.data.retentionLog[date] = { ...state.data.retentionLog[date], ...state.retentionEditDraft };
    state.retentionEditingDate = null; state.retentionEditDraft = null;
    await saveData(); render();
  };

  // ── Identity Lock ──────────────────────────────────────────────────────
  window.cancelIdentityEdit = () => { state.identityEditing = false; render(); };
  window.editIdentity = () => { state.identityEditing = true; render(); };
  window.saveIdentity = async () => {
    const h = document.getElementById('id-headline')?.value;
    const c = document.getElementById('id-core')?.value;
    const d = document.getElementById('id-command')?.value;
    state.data.identityLock = { headline: h||'', coreIdentity: c||'', dailyCommand: d||'' };
    state.identityEditing = false;
    await saveData(); render();
  };

  // ── Mission Targets ────────────────────────────────────────────────────
  window.editMission = (i) => { state.missionEditingIdx = i; render(); };
  window.cancelMissionEdit = () => { state.missionEditingIdx = null; render(); };
  window.saveMission = async (i) => {
    const title = document.getElementById(`m-title-${i}`)?.value;
    const desc = document.getElementById(`m-desc-${i}`)?.value;
    const deadline = document.getElementById(`m-deadline-${i}`)?.value;
    const missions = getMissionTargets();
    missions[i] = { ...missions[i], title: title||missions[i].title, description: desc||missions[i].description, deadline: deadline !== undefined ? deadline : missions[i].deadline };
    state.data.missionTargets = missions;
    state.missionEditingIdx = null;
    await saveData(); render();
  };

  // ── Week Plan Modal ────────────────────────────────────────────────────
  window.openWeekPlan = (key) => {
    const fronts = getProjectFronts();
    const weekKey = isSunday() ? getNextWeekKey() : getWeekKey();
    state.weekPlanDraft = { ...(fronts[key]?.weekPlans?.[weekKey] || {}) };
    state.weekPlanObjPanelOpen = false;
    state.weekPlanModal = key; render();
  };
  window.toggleWpObjPanel = () => { state.weekPlanObjPanelOpen = !state.weekPlanObjPanelOpen; render(); };
  window.closeWeekPlan = (e) => { if (e.target.classList.contains('week-plan-overlay')) { state.weekPlanModal = null; render(); } };
  window.saveWeekPlan = async (key) => {
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    const plan = {};
    days.forEach(d => { const v = document.getElementById(`wp-${d}`)?.value; if (v) plan[d] = v; });
    const weekKey = isSunday() ? getNextWeekKey() : getWeekKey();
    if (!state.data.projectFronts) state.data.projectFronts = getProjectFronts();
    if (!state.data.projectFronts[key]) state.data.projectFronts[key] = { name: key, status:'pipeline', weekPlans:{} };
    if (!state.data.projectFronts[key].weekPlans) state.data.projectFronts[key].weekPlans = {};
    state.data.projectFronts[key].weekPlans[weekKey] = plan;
    state.weekPlanModal = null;
    await saveData(); render();
  };

  // ── Misc ───────────────────────────────────────────────────────────────
  window.autoResizeTextarea = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

}
