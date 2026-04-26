export function renderTodayTab(deps) {

const { state, BATCH_COLOURS, getTodayData, getIdentityLock, getMissionTargets, getProjectFronts, getTJMBatches, getLatestWeight, getLatestBodyFat, getLatestWeightDate, getLatestBodyFatDate, formatSyncLabel, getSettings, isSunday, getTodayDayKey, getWeekKey, getToday, getMonthStats, getMonthDaysRemaining, getMonthTargets, getDerivedTargetWeight, getCurrentLeanMass, getStartLeanMass, getStreak, renderInputCard, renderEmbeddedDayPlanner } = deps;

const todayData = getTodayData();
const identity = getIdentityLock();
const missions = getMissionTargets();
const fronts = getProjectFronts();
const batches = getTJMBatches();
const currentWeight = getLatestWeight();
const currentBF = getLatestBodyFat();
const settings = getSettings();
const bfLossRate = settings.bfLossRate || 0.75;

const now = new Date();
const dayOfWeek = now.getDay();
const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
const mondayDate = new Date(now); mondayDate.setDate(now.getDate() - daysToMon);
const mondayStr = mondayDate.toISOString().slice(0,10);
const thisWeekEntries = (state.healthData||[]).filter(h => h.date >= mondayStr).sort((a,b)=>a.date.localeCompare(b.date));
const objectiveBaseDate = state.objModalDate ? new Date(state.objModalDate) : new Date();
const objectiveMonthKey = objectiveBaseDate.getFullYear() + '-' + String(objectiveBaseDate.getMonth()+1).padStart(2,'0');
const objectiveTodayKey = now.toISOString().slice(0,10);
const objectiveDayOfWeek = objectiveBaseDate.getDay();
const objectiveDaysToMon = objectiveDayOfWeek === 0 ? 6 : objectiveDayOfWeek - 1;
const objectiveMondayDate = new Date(objectiveBaseDate); objectiveMondayDate.setDate(objectiveBaseDate.getDate() - objectiveDaysToMon);
const objectiveWeekKey = getWeekKey(objectiveBaseDate);
const objectiveWeekEndDate = new Date(objectiveMondayDate); objectiveWeekEndDate.setDate(objectiveMondayDate.getDate() + 6);
const isCurrentObjectiveMonth = objectiveMonthKey === (now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'));
const isCurrentObjectiveWeek = objectiveWeekKey === getWeekKey(now);
const weekBaseEntry = thisWeekEntries[0];
const weekBaseWeight = weekBaseEntry?.weight || currentWeight;
const weekBaseBF = weekBaseEntry?.bodyFat || currentBF;
const weekTarget = +(weekBaseBF - bfLossRate).toFixed(1);
const weekTargetWeight = +(weekBaseWeight - 1.4).toFixed(1);

// ── Month key & helpers ────────────────────────────────────────────────
const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
const todayKey = objectiveTodayKey;
const MONTH_CAT_LABELS = {
  tjm: 'TJM',
  vinted: 'Vinted',
  notts: 'Nottingham Insurance',
  personal: 'Personal',
  other: 'Other'
};
const MONTH_CAT_COLOURS = {
  tjm: '#3B82F6',
  vinted: '#14B8A6',
  notts: '#EF4444',
  personal: '#C9A84C',
  other: '#8B5CF6'
};
const WEEK_CAT_LABELS = {
  tjm: 'TJM',
  vinted: 'Vinted',
  notts: 'Nottingham Insurance',
  other: 'Other'
};
const WEEK_CAT_COLOURS = {
  tjm: '#3B82F6',
  vinted: '#14B8A6',
  notts: '#EF4444',
  other: '#8B5CF6'
};
// Shared brand colours used in Today's Fronts manual tasks (non-batch)
const FRONT_COLOURS = {
  tjm: '#3B82F6',
  vinted: '#14B8A6',
  notts: '#EF4444',
  _other: '#8B5CF6'
};

function escAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getMonthCalendarData(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const cells = [];

  for (let i = 0; i < mondayIndex; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, iso, isToday: iso === todayKey });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  return {
    monthLabel: baseDate.toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase(),
    weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    cells
  };
}

function buildMonthObjectiveCalendar(monthObjs, baseDate = objectiveBaseDate) {
  const cal = getMonthCalendarData(baseDate);
  const countsByDay = {};
  const doneByDay = {};

  (monthObjs || []).forEach(obj => {
    if (!obj.deadline) return;
    countsByDay[obj.deadline] = (countsByDay[obj.deadline] || 0) + 1;
    if (obj.done) doneByDay[obj.deadline] = (doneByDay[obj.deadline] || 0) + 1;
  });

  return `
    <div class="obj-month-calendar-card">
      <div class="obj-month-calendar-head">
        <div class="obj-month-calendar-title">${cal.monthLabel}</div>
        <div class="obj-month-calendar-legend">
          <span><span class="obj-dot obj-dot--today"></span>Today</span>
          <span><span class="obj-dot obj-dot--deadline"></span>Deadline</span>
        </div>
      </div>
      <div class="obj-month-calendar-grid obj-month-calendar-grid--labels">
        ${cal.weekDays.map(label => `<div class="obj-month-calendar-label">${label}</div>`).join('')}
      </div>
      <div class="obj-month-calendar-grid">
        ${cal.cells.map(cell => {
          if (!cell) return `<div class="obj-month-calendar-cell obj-month-calendar-cell--empty"></div>`;
          const total = countsByDay[cell.iso] || 0;
          const done = doneByDay[cell.iso] || 0;
          const hasDeadline = total > 0;
          return `
            <div class="obj-month-calendar-cell ${cell.isToday ? 'is-today' : ''} ${hasDeadline ? 'has-deadline' : ''}">
              <div class="obj-month-calendar-day">${cell.day}</div>
              ${hasDeadline
                ? `<div class="obj-month-calendar-meta">${done}/${total}</div>`
                : `<div class="obj-month-calendar-meta obj-month-calendar-meta--empty">—</div>`}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function getMonthObjProgress(objId) {
  const linked = (state.data.tjmBatches || []).filter(b => b.monthlyObjId === objId);
  if (!linked.length) return null;
  let total = 0, done = 0;
  linked.forEach(b => { total += (b.steps||[]).length; done += (b.steps||[]).filter(s=>s.completedAt).length; });
  return total > 0 ? { pct: Math.round((done/total)*100), done, total } : null;
}

function fmtDeadlineShort(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const sundayPrompt = isSunday() ? `
<div class="week-plan-prompt">
<div class="week-plan-prompt-text">📋 It's Sunday — time to plan your week ahead</div>
<button class="week-plan-prompt-btn" onclick="openWeekPlan('tjm')">Plan Week</button>
</div>` : '';

// ── Identity Lock removed ─────────────────────────────────────────────
// ── Body stats removed ────────────────────────────────────────────────
// ── Mission targets ────────────────────────────────────────────────────
const missionSection = `
<div class="cc-section-title">Mission Targets</div>
<div class="cc-card mission-card" style="padding:0;">
${missions.map((m, i) => {
  const daysLeft = m.deadline ? Math.max(0, Math.ceil((new Date(m.deadline) - new Date()) / 86400000)) : null;
  return state.missionEditingIdx === i ? `
  <div class="mission-edit-row">
  <div class="identity-core-label" style="margin-bottom:4px;">TITLE</div>
  <input class="mission-edit-input" id="m-title-${i}" value="${m.title}" placeholder="Title">
  <div class="identity-core-label" style="margin-bottom:4px;margin-top:6px;">DESCRIPTION</div>
  <input class="mission-edit-input" id="m-desc-${i}" value="${m.description}" placeholder="Description">
  <div class="identity-core-label" style="margin-bottom:4px;margin-top:6px;">DEADLINE</div>
  <input class="mission-edit-input" type="date" id="m-deadline-${i}" value="${m.deadline||''}">
  <div style="display:flex;gap:8px;margin-top:8px;">
  <button class="mission-save-btn" onclick="saveMission(${i})">Save</button>
  <button class="identity-edit-btn" onclick="cancelMissionEdit()">Cancel</button>
  </div>
  </div>` : `
  <div class="mission-row" onclick="editMission(${i})">
  <div class="mission-icon">${m.icon}</div>
  <div style="flex:1;">
  <div class="mission-title">${m.title}</div>
  <div class="mission-desc">${m.description}</div>
  ${m.deadline ? `<div style="margin-top:8px;display:flex;align-items:baseline;gap:8px;">
  <span style="font-size:22px;font-weight:900;color:#C9A84C;letter-spacing:-0.5px;">${daysLeft}</span>
  <span style="font-size:12px;font-weight:800;color:#C9A84C;letter-spacing:1px;text-transform:uppercase;">days remaining</span>
  <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.3);">&middot; ${new Date(m.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
  </div>` : ''}
  </div>
  </div>`;
}).join('')}
</div>`;

// ── Plan My Objectives banner (above monthly objectives) ───────────────
const planMyObjBanner = `
<div class="plan-obj-banner" style="background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.07));border:1.5px solid rgba(201,168,76,0.4);border-radius:14px;padding:16px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
<div>
<div style="font-size:15px;font-weight:800;color:#C9A84C;margin-bottom:3px;">Plan My Objectives</div>
<div class="plan-obj-banner-sub" style="font-size:12px;color:rgba(255,255,255,0.4);">Set monthly goals &amp; weekly targets</div>
</div>
<button onclick="openObjectivesModal('weekly')" style="background:#C9A84C;border:none;border-radius:10px;padding:14px 28px;color:#000;font-size:16px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;letter-spacing:0.5px;box-shadow:0 0 0 3px rgba(201,168,76,0.3);">Open →</button>
</div>`;

// ── Monthly objectives ─────────────────────────────────────────────────
const monthObjs = state.data.monthObjectives?.[monthKey] || [];
const monthDoneCount = monthObjs.filter(o => o.done).length;
const monthOverallPct = monthObjs.length > 0 ? Math.round((monthDoneCount / monthObjs.length) * 100) : 0;
const monthlyObjsSection = monthObjs.length > 0 ? `
<div class="cc-section-title" style="display:flex;align-items:center;justify-content:space-between;">
  <span>Monthly Objectives</span>
  <button onclick="openObjectivesModal('monthly')" style="background:transparent;border:1px solid rgba(201,168,76,0.35);border-radius:8px;padding:4px 12px;color:#C9A84C;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">+ Edit</button>
</div>
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
  <div class="month-obj-progress-track" style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
    <div style="height:100%;width:${monthOverallPct}%;background:linear-gradient(90deg,#C9A84C,#e8c96a);border-radius:3px;transition:width 0.4s;"></div>
  </div>
  <span class="month-obj-score" style="font-size:12px;font-weight:900;color:#C9A84C;min-width:40px;text-align:right;">${monthDoneCount}/${monthObjs.length}</span>
</div>
<div style="margin-bottom:14px;">
${monthObjs.map((obj, i) => {
  const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Personal';
  const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
  const progress = getMonthObjProgress(obj.id);
  let deadlineHtml = '';
  if (obj.deadline) {
    const dl = new Date(obj.deadline + 'T00:00:00');
    const nowD = new Date(); nowD.setHours(0,0,0,0);
    const daysLeft = Math.ceil((dl - nowD) / 86400000);
    const isOverdue = daysLeft < 0 && !obj.done;
    deadlineHtml = `<span class="month-obj-deadline${isOverdue?' month-obj-deadline-overdue':''}" style="font-size:10px;font-weight:700;color:${isOverdue?'#e74c3c':obj.done?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.35)'};${isOverdue?'background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);border-radius:20px;padding:2px 8px;':''}margin-left:4px;">${isOverdue?'⚠ OVERDUE · ':''}${fmtDeadlineShort(obj.deadline)}</span>`;
  }
  return `
  <div onclick="toggleMonthObj('${monthKey}',${i})" class="month-obj-card${obj.done?' month-obj-card-done':''}" style="border:1.5px solid ${obj.done ? 'rgba(46,204,113,0.35)' : catColor+'33'};background:${obj.done?'rgba(26,92,58,0.55)':'rgba(255,255,255,0.02)'};border-radius:14px;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${obj.done?'#2ecc71':catColor};cursor:pointer;transition:all 0.2s;">
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <div style="width:22px;height:22px;flex-shrink:0;margin-top:1px;border-radius:6px;border:2px solid ${obj.done?'rgba(46,204,113,0.7)':catColor+'88'};background:${obj.done?'rgba(46,204,113,0.2)':'transparent'};color:${obj.done?'#2ecc71':catColor};font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:900;">${obj.done?'✓':''}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:${catColor};">${catLabel.toUpperCase()}</span>
          ${deadlineHtml}
          ${obj.done?`<span style="font-size:9px;font-weight:800;color:#2ecc71;background:rgba(46,204,113,0.15);padding:2px 7px;border-radius:20px;margin-left:2px;">DONE</span>`:''}
        </div>
        <div class="month-obj-title${obj.done?' obj-done-item-text':''}" style="font-size:16px;font-weight:800;color:${obj.done?'rgba(255,255,255,0.45)':'#fff'};${obj.done?'text-decoration:line-through;':''}line-height:1.3;">${obj.text}</div>
        ${progress ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:9px;">
          <div class="month-obj-sub-track" style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${progress.pct}%;background:${obj.done?'rgba(46,204,113,0.7)':catColor};border-radius:3px;transition:width 0.4s;box-shadow:0 0 6px ${catColor}66;"></div>
          </div>
          <span style="font-size:12px;font-weight:900;color:${obj.done?'rgba(46,204,113,0.7)':catColor};min-width:36px;text-align:right;">${progress.pct}%</span>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}).join('')}
</div>` : '';

// ── Weekly objectives — soft blue tint to differentiate from monthly ───
const weekKey = getWeekKey();
const weekObjs = state.data.weekObjectives?.[weekKey] || [];
const weeklyObjsSection = weekObjs.length > 0 ? `
<div class="cc-section-title" style="display:flex;align-items:center;justify-content:space-between;">
  <span>This Week's Objectives</span>
  <button onclick="openObjectivesModal('weekly')" style="background:transparent;border:1px solid rgba(100,163,214,0.4);border-radius:8px;padding:4px 12px;color:#6ba3d6;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">+ Edit</button>
</div>
<div style="margin-bottom:14px;">
${weekObjs.map((obj, i) => {
  const text = typeof obj === 'string' ? obj : obj.text;
  const done = typeof obj === 'object' ? !!obj.done : false;
  const category = typeof obj === 'object' ? (obj.category || '') : '';
  const categoryCustom = typeof obj === 'object' ? (obj.categoryCustom || '') : '';
  const catLabel = category ? (categoryCustom || WEEK_CAT_LABELS[category] || 'Other') : '';
  const catColor = WEEK_CAT_COLOURS[category] || '#6ba3d6';
  return `
  <div onclick="toggleWeekObj('${weekKey}',${i})" class="week-obj-card${done?' week-obj-card-done':''}" style="border:1.5px solid ${done?'rgba(46,204,113,0.3)':category?catColor+'33':'rgba(100,163,214,0.2)'};background:${done?'rgba(26,92,58,0.45)':category?catColor+'10':'rgba(100,163,214,0.04)'};border-radius:12px;padding:12px 16px;margin-bottom:6px;border-left:3px solid ${done?'#2ecc71':category?catColor:'rgba(100,163,214,0.55)'};cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.2s;">
    <div style="width:20px;height:20px;flex-shrink:0;border-radius:5px;border:2px solid ${done?'rgba(46,204,113,0.7)':category?catColor+'66':'rgba(100,163,214,0.55)'};background:${done?'rgba(46,204,113,0.15)':'transparent'};color:${done?'#2ecc71':category?catColor:'#6ba3d6'};font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:900;">${done?'✓':''}</div>
    <div style="flex:1;min-width:0;">
      ${category ? `<div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:${catColor};margin-bottom:4px;">${catLabel.toUpperCase()}</div>` : ''}
      <div class="week-obj-title${done?' obj-done-item-text':''}" style="font-size:14px;font-weight:700;color:${done?'rgba(255,255,255,0.4)':'#fff'};${done?'text-decoration:line-through;':''}line-height:1.3;">${text}</div>
    </div>
  </div>`;
}).join('')}
</div>` : '';

// ── Today's Plan (reads from planner localStorage) ────────────────────────
const planDayIdx = (now.getDay() + 6) % 7;
const planMon = new Date(now); planMon.setHours(0,0,0,0);
planMon.setDate(now.getDate() - (now.getDay()===0 ? 6 : now.getDay()-1));
const planU = new Date(Date.UTC(planMon.getFullYear(), planMon.getMonth(), planMon.getDate()));
planU.setUTCDate(planU.getUTCDate() + 4 - (planU.getUTCDay()||7));
const planY1 = new Date(Date.UTC(planU.getUTCFullYear(),0,1));
const planWn = Math.ceil((((planU-planY1)/86400000)+1)/7);
const planWkKey = planMon.getFullYear()+'-W'+String(planWn).padStart(2,'0');
let planTasks = [];
try { const wkAll = JSON.parse(localStorage.getItem('weekly_state')||'{}'); planTasks = wkAll[planWkKey]?.days?.[planDayIdx]?.tasks || []; } catch {}
const planAmTasks = planTasks.map((t,i)=>({t,i})).filter(({t})=>(t.period||'am')==='am');
const planPmTasks = planTasks.map((t,i)=>({t,i})).filter(({t})=>t.period==='pm');
function renderPlanTask(t, i) {
  const done = !!t.done;
  return `
  <div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #E8EEF5;${done?'opacity:0.5;':''}">
    <button onclick="togglePlannerTask('${planWkKey}',${planDayIdx},${i})" style="width:24px;height:24px;flex-shrink:0;border-radius:7px;border:2px solid ${done?'#2ecc71':'#C8D6E5'};background:${done?'rgba(46,204,113,0.2)':'#ffffff'};color:${done?'#2ecc71':'transparent'};font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">${done?'✓':''}</button>
    <div style="flex:1;font-size:15px;font-weight:700;color:${done?'#9aaabf':'#0A1628'};${done?'text-decoration:line-through;':''}line-height:1.3;">${t.name}</div>
    ${t.rolledOver?`<span style="font-size:10px;color:rgba(255,255,255,0.3);flex-shrink:0;font-weight:700;">↩ rolled</span>`:''}
  </div>`;
}
const frontsSection = `
<div class="cc-section-title">Today's Plan</div>
<div class="cc-card" style="padding:0;overflow:hidden;margin-bottom:4px;">
  ${planTasks.length === 0 ? `
    <div style="padding:18px 20px;text-align:center;color:rgba(255,255,255,0.22);font-size:13px;font-style:italic;">Nothing planned for today — add tasks in the Planner tab</div>
  ` : `
    ${planAmTasks.length > 0 ? `
      <div style="padding:10px 16px 4px;font-size:10px;font-weight:900;letter-spacing:2px;color:#7b92aa;">AM</div>
      ${planAmTasks.map(({t,i}) => renderPlanTask(t,i)).join('')}
    ` : ''}
    ${planPmTasks.length > 0 ? `
      <div style="padding:10px 16px 4px;font-size:10px;font-weight:900;letter-spacing:2px;color:#7b92aa;">PM</div>
      ${planPmTasks.map(({t,i}) => renderPlanTask(t,i)).join('')}
    ` : ''}
    ${planAmTasks.length === 0 && planPmTasks.length === 0 ? `
      <div style="padding:18px 20px;text-align:center;color:rgba(255,255,255,0.22);font-size:13px;font-style:italic;">Nothing planned for today — add tasks in the Planner tab</div>
    ` : ''}
  `}
</div>`;

// ── Active Batches ─────────────────────────────────────────────────────
const PROJECT_LABELS = { tjm: 'TJM', vinted: 'Vinted', notts: 'Nottingham', other: 'Other' };
const batchesSection = `
<div class="cc-section-title">Active Batches</div>
${batches.map((b, i) => {
  const isEditing = state.batchEditing === b.id;
  const steps = b.steps || [];
  const currentIdx = b.currentStepIdx || 0;
  const currentStep = steps[currentIdx];
  const isDone = b.status === 'done';
  const projKey = b.project || 'tjm';
  const projLabel = b.projectCustom || PROJECT_LABELS[projKey] || projKey;
  const colour = BATCH_COLOURS.find(c=>c.id===(b.colour||'gold')) || BATCH_COLOURS[0];
  const hex = colour.hex;
  const completedSteps = steps.filter(s=>s.completedAt).length;
  const progressPct = steps.length>0 ? Math.round((completedSteps/steps.length)*100) : 0;

  const linkedMonthObj = b.monthlyObjId ? (() => {
    for (const [mk, objs] of Object.entries(state.data.monthObjectives || {})) {
      const obj = (objs||[]).find(o => o.id === b.monthlyObjId);
      if (obj) return obj;
    }
    return null;
  })() : null;

  return `
  <div class="cc-card batch-card" style="border-color:${hex}55;background:linear-gradient(160deg,${hex}33 0%,${hex}18 60%,${hex}0a 100%);">
  <div class="batch-accent-bar" style="background:linear-gradient(90deg,${hex},${hex}66);"></div>
  <div class="batch-card-inner">
  ${isEditing ? `
  <div class="batch-editor">
  <div class="batch-editor-field"><div class="batch-editor-label">Batch Name</div>
  <input class="batch-editor-input" id="be-name-${b.id}" value="${b.name || ''}" oninput="batchFieldAutoSave('${b.id}','name',this.value)"></div>
  <div class="batch-editor-field"><div class="batch-editor-label">Project</div>
  <div class="batch-proj-btns" id="be-proj-${b.id}">
  ${['tjm','vinted','notts','other'].map(p => `<button class="batch-proj-btn ${(b.project||'tjm')===p?'selected':''}" onclick="selectBatchProj('${b.id}','${p}')">${PROJECT_LABELS[p]}</button>`).join('')}
  </div>
  <div id="be-proj-custom-wrap-${b.id}" style="margin-top:6px;${(b.project||'tjm')==='other'?'':'display:none;'}">
  <input class="batch-editor-input" id="be-proj-custom-${b.id}" placeholder="Enter project name" value="${b.projectCustom||''}">
  </div>
  </div>
  <div class="batch-editor-field"><div class="batch-editor-label">Link to Monthly Objective (optional)</div>
  <select class="batch-editor-select" id="be-monthobj-${b.id}" onchange="batchFieldAutoSave('${b.id}','monthlyObjId',this.value)">
    <option value="">— None —</option>
    ${(state.data.monthObjectives?.[monthKey]||[]).map(o => `<option value="${o.id}" ${b.monthlyObjId===o.id?'selected':''}>${o.text}</option>`).join('')}
  </select></div>
  <div class="batch-editor-field"><div class="batch-editor-label">Status</div>
  <select class="batch-editor-select" id="be-status-${b.id}" onchange="batchFieldAutoSave('${b.id}','status',this.value)">
  ${['planning','building','scheduled'].map(s=>`<option value="${s}" ${(b.status||'planning')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
  </select></div>
  <div class="batch-editor-field"><div class="batch-editor-label">Colour</div>
  <div class="batch-colour-swatches" id="be-colour-${b.id}">
  ${BATCH_COLOURS.map(c=>`<div class="batch-colour-swatch${(b.colour||'gold')===c.id?' selected':''}" data-colour="${c.id}" style="background:${c.hex};" onclick="selectBatchColour('${b.id}','${c.id}')" title="${c.label}"></div>`).join('')}
  </div>
  <input type="hidden" id="be-colour-hidden-${b.id}" value="${b.colour||'gold'}">
  </div>
  <div class="batch-editor-field"><div class="batch-editor-label">Focus / Overview</div>
  <textarea class="batch-editor-input batch-focus-textarea" id="be-focus-${b.id}" placeholder="What this batch is about — brain dump everything here..." oninput="autoResizeTextarea(this);batchFieldAutoSave('${b.id}','focus',this.value)">${b.focus||''}</textarea></div>
  <div class="batch-editor-field">
  <div class="batch-editor-label">Batch Deadline (optional)</div>
  <div style="display:flex;gap:8px;align-items:stretch;">
  <div style="position:relative;cursor:pointer;flex:1;" onclick="document.getElementById('be-deadline-${b.id}').showPicker&&document.getElementById('be-deadline-${b.id}').showPicker()">
  <input type="date" id="be-deadline-${b.id}" value="${b.deadline||''}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;" onchange="autoSaveBatchDeadline('${b.id}',this.value)">
  <div style="padding:11px 14px;background:${b.deadline?'rgba(231,76,60,0.08)':'rgba(255,255,255,0.04)'};border:1px solid ${b.deadline?'rgba(231,76,60,0.35)':'rgba(255,255,255,0.1)'};border-radius:8px;font-size:15px;font-weight:${b.deadline?'800':'400'};color:${b.deadline?'#e74c3c':'rgba(255,255,255,0.3)'};pointer-events:none;">
  ${b.deadline?'📅 '+ (d=>{if(!d)return'';const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();})(b.deadline):'Click to set deadline...'}
  </div>
  </div>
  ${b.deadline?`<button onclick="autoSaveBatchDeadline('${b.id}','')" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:8px;padding:0 14px;color:#e74c3c;font-size:18px;font-weight:700;cursor:pointer;flex-shrink:0;" title="Clear deadline">×</button>`:''}
  </div>
  </div>
  <div class="batch-editor-field">
  <div class="batch-editor-label">Steps Chain</div>
  <div id="be-steps-slider-${b.id}"></div>
  <button class="batch-add-step-btn batch-add-step-btn--big" onclick="addBatchStep('${b.id}')">＋ Add New Step</button>
  </div>
  <div style="display:flex;gap:8px;margin-top:4px;">
  <button class="batch-editor-save" onclick="saveBatch('${b.id}')" style="flex:1;padding:16px;font-size:16px;font-weight:900;letter-spacing:0.5px;">&#128190; Save Batch</button>
  <button class="batch-edit-btn" onclick="cancelBatchEdit()">Cancel</button>
  </div>
  </div>
  ` : `
  <div class="batch-header">
  <div class="batch-name">${b.name}</div>
  <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
  ${linkedMonthObj ? `<span style="font-size:9px;font-weight:800;letter-spacing:0.5px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:#C9A84C;padding:2px 8px;border-radius:20px;">🎯 ${linkedMonthObj.text.length>22?linkedMonthObj.text.slice(0,22)+'…':linkedMonthObj.text}</span>` : ''}
  <span class="batch-proj-badge ${projKey}">${projLabel}</span>
  <span class="batch-status-badge ${b.status||'planning'}">${b.status||'planning'}</span>
  </div>
  </div>
  ${b.focus ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:4px;line-height:1.4;">${b.focus}</div>` : ''}
  ${steps.length > 0 ? `
  <div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px;">
  <div class="batch-progress-bar" style="flex:1;margin:0;">
  <div class="batch-progress-fill" style="width:${progressPct}%;background:linear-gradient(90deg,${hex},${hex}aa);"></div>
  </div>
  <div style="font-size:14px;font-weight:900;color:${hex};min-width:40px;text-align:right;">${progressPct}%</div>
  </div>
  <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:6px;">${completedSteps} of ${steps.length} steps complete</div>
  ${b.deadline ? (() => {
    const nw = new Date(); nw.setHours(0,0,0,0);
    const dl = new Date(b.deadline); dl.setHours(0,0,0,0);
    const created = new Date(b.createdAt||Date.now()-30*86400000); created.setHours(0,0,0,0);
    const totalDays = Math.max(1, Math.ceil((dl - created) / 86400000));
    const daysLeft = Math.ceil((dl - nw) / 86400000);
    const elapsed = Math.max(0, Math.min(100, Math.round(((totalDays - Math.max(0,daysLeft)) / totalDays) * 100)));
    const isOverdue = daysLeft < 0;
    const fillColour = isOverdue ? '#8B1A1A' : daysLeft <= 3 ? '#C0392B' : daysLeft <= 7 ? '#A04000' : daysLeft <= 14 ? '#C9A84C' : '#1B5E7A';
    const statusLabel = isOverdue ? 'OVERDUE' : daysLeft === 0 ? 'DUE TODAY' : daysLeft <= 3 ? daysLeft+'d — CRITICAL' : daysLeft <= 7 ? daysLeft+'d — URGENT' : daysLeft <= 14 ? daysLeft+'d — SOON' : daysLeft+'d remaining';
    const fmtShort=d=>{const dt=new Date(d+'T00:00:00');const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+' '+ord(dt.getDate())+' '+months[dt.getMonth()];};
    const fmtFull=d=>{const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+' '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();};
    return `<div style="margin-bottom:10px;border:1.5px solid ${fillColour}44;border-radius:10px;padding:12px 14px;background:${isOverdue?'rgba(139,26,26,0.12)':daysLeft<=3?'rgba(192,57,43,0.08)':daysLeft<=7?'rgba(160,64,0,0.08)':'rgba(255,255,255,0.03)'};">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
    <div style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.4);text-transform:uppercase;">Deadline</div>
    <div style="font-size:11px;font-weight:900;color:${fillColour};letter-spacing:0.5px;padding:3px 10px;background:${fillColour}22;border-radius:20px;border:1px solid ${fillColour}44;">${statusLabel}</div>
    </div>
    <div style="font-size:16px;font-weight:900;color:${fillColour};margin-bottom:10px;letter-spacing:-0.2px;">${fmtFull(b.deadline)}</div>
    <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;position:relative;">
    <div style="height:100%;width:${elapsed}%;background:linear-gradient(90deg,${fillColour}99,${fillColour});border-radius:4px;transition:width 0.6s ease;box-shadow:0 0 8px ${fillColour}66;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;">
    <div style="font-size:10px;color:rgba(255,255,255,0.35);">${fmtShort(b.createdAt?new Date(b.createdAt).toISOString().slice(0,10):new Date(Date.now()-totalDays*86400000).toISOString().slice(0,10))}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.35);">${daysLeft > 0 ? daysLeft+' days left' : daysLeft === 0 ? 'Due today' : Math.abs(daysLeft)+' days overdue'}</div>
    </div>
    </div>`;
  })() : ''}
  ` : ''}
  ${steps.length > 0 ? (() => {
    const viewIdx = Math.min(state.batchViewStep?.[b.id] ?? (b.currentStepIdx||0), steps.length-1);
    const viewStep = steps[viewIdx];
    const isComplete = !!viewStep.completedAt;
    const timeStr = viewStep.timeBlock ? (viewStep.timeBlock<60?viewStep.timeBlock+'m':Math.floor(viewStep.timeBlock/60)+'h'+(viewStep.timeBlock%60?viewStep.timeBlock%60+'m':'')) : null;
    return `
    <div class="batch-step-swipe" data-bid="${b.id}" ontouchstart="batchSwipeStart(event,'${b.id}')" ontouchend="batchSwipeEnd(event,'${b.id}')" style="background:${isComplete?'rgba(46,204,113,0.07)':hex+'12'};border:1.5px solid ${isComplete?'rgba(46,204,113,0.25)':hex+'44'};border-radius:14px;padding:16px 14px 12px;margin-bottom:10px;transition:all 0.25s ease;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="display:flex;align-items:center;gap:8px;">
    <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${isComplete?'rgba(46,204,113,0.7)':hex};">STEP ${viewIdx+1} OF ${steps.length}</div>
    ${isComplete ? '<span style="font-size:10px;font-weight:800;color:#2ecc71;background:rgba(46,204,113,0.15);padding:2px 8px;border-radius:20px;">DONE</span>' : ''}
    </div>
    <div style="display:flex;gap:4px;">
    <button onclick="navBatchStep('${b.id}',-1)" ${viewIdx===0?'disabled':''} style="width:36px;height:36px;border-radius:50%;border:1.5px solid ${viewIdx===0?'rgba(255,255,255,0.08)':hex+'66'};background:${viewIdx===0?'rgba(255,255,255,0.02)':hex+'18'};color:${viewIdx===0?'rgba(255,255,255,0.2)':hex};font-size:20px;cursor:${viewIdx===0?'default':'pointer'};display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-weight:300;">‹</button>
    <button onclick="navBatchStep('${b.id}',1)" ${viewIdx===steps.length-1?'disabled':''} style="width:36px;height:36px;border-radius:50%;border:1.5px solid ${viewIdx===steps.length-1?'rgba(255,255,255,0.08)':hex+'66'};background:${viewIdx===steps.length-1?'rgba(255,255,255,0.02)':hex+'18'};color:${viewIdx===steps.length-1?'rgba(255,255,255,0.2)':hex};font-size:20px;cursor:${viewIdx===steps.length-1?'default':'pointer'};display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-weight:300;">›</button>
    </div>
    </div>
    <div style="font-size:17px;font-weight:800;color:${isComplete?'rgba(255,255,255,0.35)':'#fff'};${isComplete?'text-decoration:line-through;':''}margin-bottom:6px;line-height:1.3;">${viewStep.name||'Unnamed step'}</div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    ${timeStr?`<span style="font-size:12px;color:${isComplete?'rgba(46,204,113,0.5)':hex};font-weight:700;">⏱ ${timeStr}</span>`:''}
    ${viewStep.notes?`<span style="font-size:11px;color:rgba(255,255,255,0.3);">${viewStep.notes}</span>`:''}
    </div>
    <div style="display:flex;gap:6px;margin-top:12px;">
    ${isComplete
      ? `<button onclick="unmarkBatchStep('${b.id}',${viewIdx})" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:9px;padding:10px;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">↩ Mark Incomplete</button>`
      : `<button onclick="markBatchStepComplete('${b.id}',${viewIdx})" style="flex:1;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);border-radius:9px;padding:10px;color:#2ecc71;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">✓ Mark Complete</button>`}
    </div>
    <div style="display:flex;gap:4px;justify-content:center;margin-top:10px;">
    ${steps.map((_,i)=>`<div style="width:${i===viewIdx?'18px':'6px'};height:6px;border-radius:3px;background:${steps[i].completedAt?'rgba(46,204,113,0.7)':i===viewIdx?hex:'rgba(255,255,255,0.15)'};transition:all 0.2s;"></div>`).join('')}
    </div>
    </div>`;
  })() : ''}
  <div class="batch-actions">
  <button class="batch-edit-btn" onclick="editBatch('${b.id}')">✎ Edit</button>
  ${isDone ? `<button class="batch-archive-btn" onclick="archiveBatch('${b.id}')">Archive</button>` : ''}
  <button class="batch-delete-btn" onclick="deleteBatch('${b.id}')">✕</button>
  </div>
  `}
  </div>
  </div>`;
}).join('')}

${state.batchAdding ? `
<div class="cc-card batch-card">
<div class="batch-editor">
<div class="batch-editor-field"><div class="batch-editor-label">Batch Name</div>
<input class="batch-editor-input" id="new-batch-name" placeholder="e.g. Spring Sale Video Batch"></div>
<div class="batch-editor-field"><div class="batch-editor-label">Project</div>
<div class="batch-proj-btns" id="new-proj-btns">
${['tjm','vinted','notts','other'].map(p => `<button class="batch-proj-btn ${p==='tjm'?'selected':''}" onclick="selectNewBatchProj('${p}')">${PROJECT_LABELS[p]}</button>`).join('')}
</div>
<div id="new-proj-custom-wrap" style="margin-top:6px;display:none;">
<input class="batch-editor-input" id="new-batch-proj-custom" placeholder="Enter project name">
</div>
<input type="hidden" id="new-batch-proj" value="tjm">
</div>
<div class="batch-editor-field"><div class="batch-editor-label">Link to Monthly Objective (optional)</div>
<select class="batch-editor-select" id="new-batch-monthobj">
  <option value="">— None —</option>
  ${(state.data.monthObjectives?.[monthKey]||[]).map(o => `<option value="${o.id}">${o.text}</option>`).join('')}
</select></div>
<div class="batch-editor-field"><div class="batch-editor-label">Status</div>
<select class="batch-editor-select" id="new-batch-status">
<option value="planning">Planning</option>
<option value="building">Building</option>
<option value="scheduled">Scheduled</option>
</select></div>
<div class="batch-editor-field"><div class="batch-editor-label">Colour</div>
<div class="batch-colour-swatches" id="new-colour-swatches">
${BATCH_COLOURS.map((c,ci)=>`<div class="batch-colour-swatch${ci===0?' selected':''}" data-colour="${c.id}" style="background:${c.hex};" onclick="selectNewBatchColour('${c.id}')" title="${c.label}"></div>`).join('')}
</div>
<input type="hidden" id="new-batch-colour" value="gold">
</div>
<div class="batch-editor-field"><div class="batch-editor-label">Focus / Overview</div>
<textarea class="batch-editor-input batch-focus-textarea" id="new-batch-focus" placeholder="What this batch is about — brain dump everything here..." oninput="autoResizeTextarea(this)"></textarea></div>
<div class="batch-editor-field">
<div class="batch-editor-label">Steps Chain</div>
<div id="new-steps-slider"></div>
<button class="batch-add-step-btn batch-add-step-btn--big" onclick="addNewBatchStep()">＋ Add New Step</button>
</div>
<div style="display:flex;gap:8px;margin-top:4px;">
<button class="batch-editor-save" onclick="addNewBatch()" style="flex:1;padding:16px;font-size:16px;font-weight:900;letter-spacing:0.5px;">&#128190; Save Batch</button>
<button class="batch-edit-btn" onclick="cancelAddBatch()">Cancel</button>
</div>
</div>
</div>` : ''}
<button class="batch-add-btn" onclick="startAddBatch()">+ Add Batch</button>`;

// ── Habits & Sales ─────────────────────────────────────────────────────
const habitsSection = `
<div class="cc-section-title">Discipline Status</div>
<div class="toggle-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
${['gym', 'retention', 'meditation'].map(field => `
<div class="toggle-card ${todayData[field] ? 'active' : ''}" onclick="toggleToday('${field}')" style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
<span class="toggle-icon">${todayData[field] ? '✓' : '○'}</span>
<span class="toggle-label">${field.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
<span class="streak-badge">${getStreak(field)} day streak</span>
</div>`).join('')}
</div>`;

const salesSection = `
<div class="cc-section-title">Sales & Outreach</div>
<div class="input-grid">
${renderInputCard('sales', 'SALES', todayData.sales, 'number', 'sales')}
${renderInputCard('revenue', 'REVENUE (£)', todayData.revenue, 'number', '£')}
${renderInputCard('dmsSent', 'DMs SENT', todayData.dmsSent, 'number', 'DMs')}
${renderInputCard('warmLeads', 'WARM LEADS', todayData.warmLeads, 'number', 'leads')}
</div>`;

// ── Objectives Modal ───────────────────────────────────────────────────
const activeObjTab = state.objModalTab || 'weekly';
const modalMonthObjs = state.data.monthObjectives?.[objectiveMonthKey] || [];
const modalWeekObjs = state.data.weekObjectives?.[objectiveWeekKey] || [];
const objectiveMonthLabel = objectiveBaseDate.toLocaleString('en-GB',{month:'long',year:'numeric'}).toUpperCase();
const objectiveWeekLabel = `WEEK OF ${objectiveMondayDate.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase()}${objectiveWeekEndDate.getMonth() !== objectiveMondayDate.getMonth() ? ' → ' + objectiveWeekEndDate.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase() : ''}`;
const periodNav = `
<div class="obj-period-nav" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;">
  <button onclick="shiftObjectivesPeriod(-1)" class="obj-period-btn" style="width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#fff;font-size:18px;font-weight:900;cursor:pointer;">←</button>
  <div style="flex:1;text-align:center;min-width:0;">
    <div class="obj-period-label" style="font-size:11px;font-weight:900;letter-spacing:1.6px;color:rgba(255,255,255,0.35);margin-bottom:4px;">${activeObjTab === 'monthly' ? 'PLANNING MONTH' : 'PLANNING WEEK'}</div>
    <div class="obj-period-value" style="font-size:16px;font-weight:900;color:#fff;letter-spacing:0.5px;">${activeObjTab === 'monthly' ? objectiveMonthLabel : objectiveWeekLabel}</div>
  </div>
  <button onclick="shiftObjectivesPeriod(1)" class="obj-period-btn" style="width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#fff;font-size:18px;font-weight:900;cursor:pointer;">→</button>
</div>
<div style="display:flex;justify-content:center;margin:-4px 0 16px;">
  <button onclick="jumpObjectivesToToday()" class="obj-jump-today-btn" style="background:${(activeObjTab === 'monthly' ? isCurrentObjectiveMonth : isCurrentObjectiveWeek) ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.04)'};border:1px solid ${(activeObjTab === 'monthly' ? isCurrentObjectiveMonth : isCurrentObjectiveWeek) ? 'rgba(46,204,113,0.35)' : 'rgba(255,255,255,0.1)'};border-radius:999px;padding:8px 14px;color:${(activeObjTab === 'monthly' ? isCurrentObjectiveMonth : isCurrentObjectiveWeek) ? '#2ecc71' : 'rgba(255,255,255,0.55)'};font-size:11px;font-weight:900;letter-spacing:0.8px;cursor:pointer;">${(activeObjTab === 'monthly' ? isCurrentObjectiveMonth : isCurrentObjectiveWeek) ? 'VIEWING CURRENT PERIOD' : 'JUMP TO CURRENT PERIOD'}</button>
</div>`;

const monthlyObjModalContent = `
<div style="margin-bottom:16px;">
  <div class="obj-month-heading">
    ${objectiveMonthLabel}
  </div>
  ${modalMonthObjs.length === 0 ? `<div class="obj-empty-state">No monthly objectives yet — add one below</div>` : ''}
  ${modalMonthObjs.map((obj, i) => {
    const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Personal';
    const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
    const dl = obj.deadline ? new Date(obj.deadline + 'T00:00:00') : null;
    const dayStart = new Date();
    dayStart.setHours(0,0,0,0);
    const daysLeft = dl ? Math.ceil((dl.getTime() - dayStart.getTime()) / 86400000) : null;
    const isOverdue = daysLeft !== null && daysLeft < 0 && !obj.done;
    const isEditing = state.monthObjEditing === `${objectiveMonthKey}:${i}`;
    return `
    <div style="border:1.5px solid ${obj.done?'rgba(46,204,113,0.3)':isOverdue?'rgba(231,76,60,0.3)':catColor+'33'};border-radius:12px;padding:12px 14px;margin-bottom:8px;background:${obj.done?'rgba(26,92,58,0.4)':isOverdue?'rgba(231,76,60,0.05)':'rgba(255,255,255,0.02)'};display:flex;align-items:${isEditing ? 'flex-start' : 'center'};gap:10px;">
      <button onclick="toggleMonthObj('${objectiveMonthKey}',${i})" style="width:24px;height:24px;flex-shrink:0;border-radius:6px;border:2px solid ${obj.done?'rgba(46,204,113,0.7)':catColor+'66'};background:${obj.done?'rgba(46,204,113,0.2)':'transparent'};color:${obj.done?'#2ecc71':catColor};font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">${obj.done?'✓':''}</button>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${isEditing ? '10px' : '2px'};">
          <span style="font-size:9px;font-weight:900;letter-spacing:1px;color:${catColor};">${catLabel.toUpperCase()}</span>
          ${obj.deadline ? `<span style="font-size:10px;color:${isOverdue?'#e74c3c':'rgba(255,255,255,0.35)'};font-weight:${isOverdue?'800':'600'};">${isOverdue?'⚠ OVERDUE · ':''}${fmtDeadlineShort(obj.deadline)}</span>` : ''}
        </div>
        ${isEditing ? `
          <input id="edit-month-obj-text-${i}" class="batch-editor-input" value="${escAttr(obj.text || '')}" placeholder="Objective title" style="margin-bottom:10px;">
          <div style="position:relative;" onclick="document.getElementById('edit-month-obj-deadline-${i}').showPicker&&document.getElementById('edit-month-obj-deadline-${i}').showPicker()">
            <input type="date" id="edit-month-obj-deadline-${i}" value="${obj.deadline || ''}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;">
            <div style="padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:14px;color:${obj.deadline ? '#C9A84C' : 'rgba(255,255,255,0.3)'};font-weight:${obj.deadline ? '800' : '400'};cursor:pointer;">${obj.deadline ? '📅 ' + fmtDeadlineShort(obj.deadline) : '📅 Set deadline (optional)'}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button onclick="saveMonthObjEdit('${objectiveMonthKey}',${i})" style="flex:1;background:#C9A84C;border:none;border-radius:8px;padding:10px 12px;color:#000;font-size:13px;font-weight:900;cursor:pointer;">Save</button>
            <button onclick="cancelMonthObjEdit()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:rgba(255,255,255,0.7);font-size:13px;font-weight:800;cursor:pointer;">Cancel</button>
          </div>
        ` : `<div style="font-size:15px;font-weight:700;color:${obj.done?'rgba(255,255,255,0.4)':'#fff'};${obj.done?'text-decoration:line-through;':''}line-height:1.3;">${obj.text}</div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <button onclick="editMonthObj('${objectiveMonthKey}',${i})" style="width:28px;height:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:rgba(255,255,255,0.75);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✎</button>
        <button onclick="removeMonthObj('${objectiveMonthKey}',${i})" style="width:28px;height:28px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.2);border-radius:7px;color:rgba(231,76,60,0.6);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
    </div>`;
  }).join('')}
</div>
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:12px;">ADD OBJECTIVE</div>
  <input class="batch-editor-input" id="new-month-obj-text" placeholder="e.g. 10 TJM Sales" style="margin-bottom:10px;">
  <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
    ${['tjm','vinted','notts','personal'].map(cat => `<button onclick="selectMonthObjCat('${cat}')" id="moc-${cat}" class="batch-proj-btn month-cat-btn ${cat==='tjm'?'selected':''}" data-cat="${cat}" style="font-size:12px;">${MONTH_CAT_LABELS[cat]}</button>`).join('')}
    <input type="hidden" id="new-month-obj-cat" value="tjm">
  </div>
  <div id="new-month-obj-custom-wrap" style="display:none;margin-bottom:10px;">
    <input class="batch-editor-input" id="new-month-obj-custom" placeholder="Custom category name">
  </div>
  <div style="position:relative;margin-bottom:12px;" onclick="document.getElementById('new-month-obj-deadline').showPicker&&document.getElementById('new-month-obj-deadline').showPicker()">
    <input type="date" id="new-month-obj-deadline" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;">
    <div id="new-month-obj-deadline-display" style="padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:14px;color:rgba(255,255,255,0.3);cursor:pointer;">📅 Set deadline (optional)</div>
  </div>
  <button onclick="addMonthObj('${objectiveMonthKey}')" style="width:100%;background:#C9A84C;border:none;border-radius:10px;padding:13px;color:#000;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;">+ Add Objective</button>
</div>
${buildMonthObjectiveCalendar(modalMonthObjs, objectiveBaseDate)}`;

const weeklyMonthReferenceSection = `
<div style="margin-bottom:18px;background:linear-gradient(180deg, rgba(201,168,76,0.12), rgba(255,255,255,0.03));border:1px solid rgba(201,168,76,0.22);border-radius:16px;padding:14px 14px 10px;box-shadow:0 10px 24px rgba(0,0,0,0.12);">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
    <div>
      <div style="font-size:10px;font-weight:900;letter-spacing:1.4px;color:#C9A84C;margin-bottom:4px;">MONTHLY OBJECTIVES FOR THIS MONTH</div>
      <div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:0.3px;">${objectiveMonthLabel}</div>
    </div>
    <button onclick="switchObjTab('monthly')" style="background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.35);border-radius:999px;padding:7px 11px;color:#C9A84C;font-size:10px;font-weight:900;letter-spacing:0.8px;cursor:pointer;">OPEN MONTH</button>
  </div>
  <div style="font-size:11px;color:rgba(255,255,255,0.5);font-weight:700;margin-bottom:6px;">Use these as your top-down targets while you set this week’s priorities.</div>
  ${modalMonthObjs.length === 0 ? `<div style="padding:10px 0 12px;color:rgba(255,255,255,0.32);font-size:12px;font-style:italic;">No monthly objectives set for this month yet</div>` : modalMonthObjs.map(obj => {
    const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Personal';
    const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
    const deadlineLabel = obj.deadline ? fmtDeadlineShort(obj.deadline) : '';
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);opacity:${obj.done ? '0.6' : '1'};">
        <div style="width:10px;height:10px;border-radius:999px;background:${obj.done ? '#2ecc71' : catColor};margin-top:5px;flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="font-size:9px;font-weight:900;letter-spacing:1px;color:${catColor};">${catLabel.toUpperCase()}</span>
            ${deadlineLabel ? `<span style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:700;">${deadlineLabel}</span>` : ''}
            ${obj.done ? `<span style="font-size:10px;color:#2ecc71;font-weight:800;letter-spacing:0.5px;">DONE</span>` : ''}
          </div>
          <div style="font-size:13px;font-weight:700;color:#fff;line-height:1.35;${obj.done ? 'text-decoration:line-through;' : ''}">${obj.text}</div>
        </div>
      </div>`;
  }).join('')}
</div>`;

const weeklyObjModalContent = `
<div style="margin-bottom:16px;">
  ${weeklyMonthReferenceSection}
  <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:10px;">${objectiveWeekLabel}</div>
  ${modalWeekObjs.length === 0 ? `<div style="text-align:center;padding:20px 0;color:rgba(255,255,255,0.25);font-size:13px;font-style:italic;">No weekly objectives yet — add one below</div>` : ''}
  ${modalWeekObjs.map((obj, i) => {
    const item = typeof obj === 'object' ? obj : { text: obj, done: false };
    const text = item.text || '';
    const done = !!item.done;
    const category = item.category || '';
    const categoryCustom = item.categoryCustom || '';
    const catLabel = category ? (categoryCustom || WEEK_CAT_LABELS[category] || 'Other') : '';
    const catColor = WEEK_CAT_COLOURS[category] || '#6ba3d6';
    const hasDeadline = !!item.deadline;
    const isEditing = state.weekObjEditing === `${objectiveWeekKey}:${i}`;
    return `
    <div style="border:1.5px solid ${done?'rgba(46,204,113,0.3)':category?catColor+'33':'rgba(255,255,255,0.1)'};border-radius:12px;padding:12px 14px;margin-bottom:8px;background:${done?'rgba(26,92,58,0.4)':category?catColor+'10':'rgba(255,255,255,0.02)'};display:flex;align-items:${isEditing ? 'flex-start' : 'center'};gap:10px;">
      <button onclick="toggleWeekObj('${objectiveWeekKey}',${i})" style="width:24px;height:24px;flex-shrink:0;border-radius:6px;border:2px solid ${done?'rgba(46,204,113,0.7)':category?catColor+'66':'rgba(201,168,76,0.5)'};background:${done?'rgba(46,204,113,0.2)':'transparent'};color:${done?'#2ecc71':category?catColor:'#C9A84C'};font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">${done?'✓':''}</button>
      <div style="flex:1;min-width:0;">
        ${(category || hasDeadline) ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${isEditing ? '10px' : '4px'};">${category ? `<span style="font-size:9px;font-weight:900;letter-spacing:1px;color:${catColor};">${catLabel.toUpperCase()}</span>` : ''}${hasDeadline ? `<span style="font-size:10px;color:rgba(255,255,255,0.35);font-weight:600;">${fmtDeadlineShort(item.deadline)}</span>` : ''}</div>` : ''}
        ${isEditing ? `
          <input id="edit-week-obj-text-${i}" class="batch-editor-input" value="${escAttr(text)}" placeholder="Objective title" style="margin-bottom:10px;">
          <div style="position:relative;" onclick="document.getElementById('edit-week-obj-deadline-${i}').showPicker&&document.getElementById('edit-week-obj-deadline-${i}').showPicker()">
            <input type="date" id="edit-week-obj-deadline-${i}" value="${item.deadline || ''}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;">
            <div style="padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:14px;color:${item.deadline ? '#C9A84C' : 'rgba(255,255,255,0.3)'};font-weight:${item.deadline ? '800' : '400'};cursor:pointer;">${item.deadline ? '📅 ' + fmtDeadlineShort(item.deadline) : '📅 Set deadline (optional)'}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button onclick="saveWeekObjEdit('${objectiveWeekKey}',${i})" style="flex:1;background:#C9A84C;border:none;border-radius:8px;padding:10px 12px;color:#000;font-size:13px;font-weight:900;cursor:pointer;">Save</button>
            <button onclick="cancelWeekObjEdit()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:rgba(255,255,255,0.7);font-size:13px;font-weight:800;cursor:pointer;">Cancel</button>
          </div>
        ` : `<div style="font-size:15px;font-weight:700;color:${done?'rgba(255,255,255,0.4)':'#fff'};${done?'text-decoration:line-through;':''}line-height:1.3;">${text}</div>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
        <button onclick="editWeekObj('${objectiveWeekKey}',${i})" style="width:28px;height:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;color:rgba(255,255,255,0.75);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✎</button>
        <button onclick="removeWeekObj('${objectiveWeekKey}',${i})" style="width:28px;height:28px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.2);border-radius:7px;color:rgba(231,76,60,0.6);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
    </div>`;
  }).join('')}
</div>
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;">
  <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:12px;">ADD OBJECTIVE</div>
  <input class="batch-editor-input" id="new-week-obj-${objectiveWeekKey}" placeholder="e.g. Complete Spring batch" style="margin-bottom:10px;">
  <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
    ${['tjm','vinted','notts','other'].map(cat => `<button onclick="selectWeekObjCat('${cat}')" id="woc-${cat}" class="batch-proj-btn month-cat-btn ${cat==='tjm'?'selected':''}" data-cat="${cat}" style="font-size:12px;">${WEEK_CAT_LABELS[cat]}</button>`).join('')}
    <input type="hidden" id="new-week-obj-cat" value="tjm">
  </div>
  <div id="new-week-obj-custom-wrap" style="display:none;margin-bottom:10px;">
    <input class="batch-editor-input" id="new-week-obj-custom" placeholder="Custom category name">
  </div>
  <div style="position:relative;margin-bottom:12px;" onclick="document.getElementById('new-week-obj-deadline').showPicker&&document.getElementById('new-week-obj-deadline').showPicker()">
    <input type="date" id="new-week-obj-deadline" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;">
    <div style="padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:14px;color:rgba(255,255,255,0.3);cursor:pointer;">📅 Set deadline (optional)</div>
  </div>
  <button onclick="addWeekObj('${objectiveWeekKey}')" style="width:100%;background:#C9A84C;border:none;border-radius:10px;padding:13px;color:#000;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;">+ Add Objective</button>
</div>
${renderEmbeddedDayPlanner()}`;

const objectivesModal = state.objectivesModalOpen ? `
<div onclick="closeObjectivesModal(event)" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-end;justify-content:center;">
  <div onclick="event.stopPropagation()" class="obj-modal-inner" style="background:#1a1a1a;border-radius:20px 20px 0 0;width:100%;max-width:600px;max-height:88vh;overflow-y:auto;padding:24px 20px 44px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:0.5px;">Plan My Objectives</div>
      <button onclick="closeObjectivesModalBtn()" style="background:rgba(255,255,255,0.08);border:none;border-radius:8px;width:34px;height:34px;color:rgba(255,255,255,0.6);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:20px;background:rgba(255,255,255,0.05);border-radius:10px;padding:4px;">
      <button onclick="switchObjTab('monthly')" style="flex:1;padding:10px;border-radius:8px;border:none;background:${activeObjTab==='monthly'?'#C9A84C':'transparent'};color:${activeObjTab==='monthly'?'#000':'rgba(255,255,255,0.5)'};font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.2s;letter-spacing:0.5px;">Monthly</button>
      <button onclick="switchObjTab('weekly')" style="flex:1;padding:10px;border-radius:8px;border:none;background:${activeObjTab==='weekly'?'#C9A84C':'transparent'};color:${activeObjTab==='weekly'?'#000':'rgba(255,255,255,0.5)'};font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.2s;letter-spacing:0.5px;">This Week</button>
    </div>
    ${periodNav}
    ${activeObjTab === 'monthly' ? monthlyObjModalContent : weeklyObjModalContent}
  </div>
</div>` : '';

// ── CSS injected once per render — light mode fixes for objectives ─────
const injectedCSS = `<style id="obj-light-mode-css">
/* Banner */
body.light .plan-obj-banner { background: linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.06)) !important; border-color: rgba(201,168,76,0.5) !important; }
body.light .plan-obj-banner-sub { color: rgba(10,22,40,0.62) !important; }
/* Progress */
body.light .month-obj-progress-track { background: rgba(10,22,40,0.10) !important; }
body.light .obj-done-item-text { color: rgba(10,22,40,0.42) !important; text-decoration: line-through !important; }
/* Modal shell */
body.light .obj-modal-inner { background: #F8FAFC !important; color: #0A1628 !important; border: 1px solid #D8E0EC !important; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18) !important; }
body.light .obj-modal-inner input, body.light .obj-modal-inner textarea, body.light .obj-modal-inner select, body.light .obj-modal-inner .batch-editor-input { background: #FFFFFF !important; border: 1px solid #CDD4E0 !important; color: #0A1628 !important; }
body.light .obj-modal-inner input::placeholder, body.light .obj-modal-inner textarea::placeholder { color: #7B8798 !important; }
/* Modal headings / empty state */
body.light .obj-month-heading { font-size: 11px; font-weight: 800; letter-spacing: 1.4px; color: #5B6B82 !important; margin-bottom: 12px; }
body.light .obj-empty-state { text-align: center; padding: 20px 0; color: #6B7A90 !important; font-size: 13px; font-style: italic; }
/* Tab switcher */
body.light .obj-modal-inner [onclick*="switchObjTab"] { color: #66758C !important; }
body.light .obj-modal-inner [onclick*="switchObjTab"][style*="background:#C9A84C"] { color: #000 !important; }
body.light .obj-modal-inner div[style*="display:flex;gap:6px;margin-bottom:20px;background:rgba(255,255,255,0.05);border-radius:10px;padding:4px;"] { background: #EAF0F7 !important; }
/* Close button */
body.light .obj-modal-inner button[onclick="closeObjectivesModalBtn()"] { background: #EEF3F8 !important; color: #516176 !important; border: 1px solid #D8E0EC !important; }
body.light .obj-period-label { color: #6B7A90 !important; }
body.light .obj-period-value { color: #0A1628 !important; }
body.light .obj-period-btn, body.light .obj-jump-today-btn { background: #FFFFFF !important; border-color: #D8E0EC !important; color: #516176 !important; }
/* Cards inside modal */
body.light .obj-modal-inner div[style*="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px;"] { background: #FFFFFF !important; border: 1px solid #D8E0EC !important; }
body.light .obj-modal-inner div[style*="border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;"] { background: #FFFFFF !important; border-color: #D8E0EC !important; }
/* Date display */
body.light #new-month-obj-deadline-display { background: #FFFFFF !important; border: 1px solid #CDD4E0 !important; color: #516176 !important; }
/* Monthly objective add buttons */
body.light .month-cat-btn { background: #FFFFFF !important; border: 1px solid #CDD4E0 !important; color: #516176 !important; }
body.light .month-cat-btn[data-cat="tjm"].selected { background: rgba(59,130,246,0.12) !important; border-color: rgba(59,130,246,0.45) !important; color: #2563EB !important; }
body.light .month-cat-btn[data-cat="vinted"].selected { background: rgba(20,184,166,0.12) !important; border-color: rgba(20,184,166,0.45) !important; color: #0F766E !important; }
body.light .month-cat-btn[data-cat="notts"].selected { background: rgba(239,68,68,0.12) !important; border-color: rgba(239,68,68,0.45) !important; color: #DC2626 !important; }
body.light .month-cat-btn[data-cat="personal"].selected { background: rgba(201,168,76,0.16) !important; border-color: rgba(201,168,76,0.5) !important; color: #A47C1B !important; }
/* Calendar */
.obj-month-calendar-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 14px; margin-bottom: 14px; }
.obj-month-calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.obj-month-calendar-title { font-size: 13px; font-weight: 900; letter-spacing: 1px; color: rgba(255,255,255,0.88); }
.obj-month-calendar-legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 700; }
.obj-dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 5px; }
.obj-dot--today { background: #C9A84C; }
.obj-dot--deadline { background: #60A5FA; }
.obj-month-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.obj-month-calendar-grid--labels { margin-bottom: 8px; }
.obj-month-calendar-label { text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: rgba(255,255,255,0.35); text-transform: uppercase; }
.obj-month-calendar-cell { min-height: 62px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.025); padding: 8px; display: flex; flex-direction: column; justify-content: space-between; }
.obj-month-calendar-cell--empty { background: transparent; border: none; }
.obj-month-calendar-cell.is-today { border-color: rgba(201,168,76,0.6); box-shadow: inset 0 0 0 1px rgba(201,168,76,0.25); }
.obj-month-calendar-cell.has-deadline { background: rgba(96,165,250,0.08); }
.obj-month-calendar-day { font-size: 13px; font-weight: 800; color: #fff; }
.obj-month-calendar-meta { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.5); }
.obj-month-calendar-meta--empty { color: rgba(255,255,255,0.22); }
body.light .obj-month-calendar-card { background: #FFFFFF !important; border: 1px solid #D8E0EC !important; }
body.light .obj-month-calendar-title { color: #0A1628 !important; }
body.light .obj-month-calendar-legend { color: #6B7A90 !important; }
body.light .obj-month-calendar-label { color: #7B8798 !important; }
body.light .obj-month-calendar-cell { background: #F8FAFC !important; border-color: #D8E0EC !important; }
body.light .obj-month-calendar-cell.has-deadline { background: rgba(59,130,246,0.08) !important; }
body.light .obj-month-calendar-cell.is-today { border-color: rgba(201,168,76,0.7) !important; box-shadow: inset 0 0 0 1px rgba(201,168,76,0.35) !important; }
body.light .obj-month-calendar-day { color: #0A1628 !important; }
body.light .obj-month-calendar-meta { color: #5B6B82 !important; }
body.light .obj-month-calendar-meta--empty { color: #AAB4C4 !important; }
body.light .fronts-empty-state { color: rgba(10,22,40,0.35) !important; }
</style>`;

// ── Objectives group (monthly + weekly) with collapse toggle ──────────
const objectivesVisible = state.objectivesCollapsed !== true;
// Only show objectives whose deadline falls within the currently viewed month
const navMonthObjs = (state.data.monthObjectives?.[objectiveMonthKey] || []).filter(obj =>
  obj.deadline && obj.deadline.startsWith(objectiveMonthKey)
);
const navMonthDoneCount = navMonthObjs.filter(o => o.done).length;
const navMonthOverallPct = navMonthObjs.length > 0 ? Math.round((navMonthDoneCount / navMonthObjs.length) * 100) : 0;
const hasAnyObjectives = navMonthObjs.length > 0 || weekObjs.length > 0;
const objectivesGroupSection = `
<div style="margin-bottom:4px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${objectivesVisible ? '10px' : '4px'};">
    <div class="cc-section-title" style="margin-bottom:0;">Objectives</div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button onclick="openObjectivesModal('monthly')" style="background:transparent;border:1px solid rgba(201,168,76,0.35);border-radius:8px;padding:4px 12px;color:#C9A84C;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">+ Edit</button>
      <button onclick="toggleObjectivesCollapsed()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:4px 12px;color:rgba(255,255,255,0.5);font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">${objectivesVisible ? '▲ Hide' : '▼ Show'}</button>
    </div>
  </div>
  ${objectivesVisible ? `
    ${planMyObjBanner}
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:14px;margin-top:4px;">
      <button onclick="shiftObjectivesPeriod(-1)" style="width:36px;height:36px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:10px;color:#fff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">←</button>
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px;line-height:1.1;">${objectiveBaseDate.toLocaleString('en-GB',{month:'long'})} Objectives</div>
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4);letter-spacing:1px;">${objectiveBaseDate.getFullYear()}</div>
      </div>
      <button onclick="shiftObjectivesPeriod(1)" style="width:36px;height:36px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:10px;color:#fff;font-size:18px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;">→</button>
    </div>
    ${hasAnyObjectives ? `
      ${navMonthObjs.length > 0 ? `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div class="month-obj-progress-track" style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${navMonthOverallPct}%;background:linear-gradient(90deg,#C9A84C,#e8c96a);border-radius:3px;transition:width 0.4s;"></div>
          </div>
          <span class="month-obj-score" style="font-size:12px;font-weight:900;color:#C9A84C;min-width:40px;text-align:right;">${navMonthDoneCount}/${navMonthObjs.length}</span>
        </div>
        <div style="margin-bottom:10px;">${navMonthObjs.map((obj, i) => {
          const catLabel = obj.categoryCustom || MONTH_CAT_LABELS[obj.category] || 'Personal';
          const catColor = MONTH_CAT_COLOURS[obj.category] || '#C9A84C';
          const progress = getMonthObjProgress(obj.id);
          const objIdx = (state.data.monthObjectives?.[objectiveMonthKey] || []).findIndex(o => o.id === obj.id);
          const isReviewing = state.objReviewing?.monthKey === objectiveMonthKey && state.objReviewing?.idx === objIdx;
          const draft = isReviewing ? (state.objReviewDraft || {}) : {};
          const hasReview = !!obj.review?.outcome;
          const reviewColor = obj.review?.outcome === 'completed' ? '#2ecc71' : '#e74c3c';
          const reviewBg   = obj.review?.outcome === 'completed' ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)';
          const titleColor  = obj.review?.outcome === 'uncompleted' ? '#e74c3c' : obj.done ? '#9aaabf' : '#0A1628';
          const titleStrike = (obj.done || obj.review?.outcome === 'uncompleted') ? 'text-decoration:line-through;' : '';
          // Checkbox icon: green tick if completed review, red cross if uncompleted review, else normal
          const checkIcon  = obj.review?.outcome === 'completed' ? '✓' : obj.review?.outcome === 'uncompleted' ? '✕' : obj.done ? '✓' : '';
          const checkBorder = obj.review?.outcome === 'completed' ? '#2ecc71' : obj.review?.outcome === 'uncompleted' ? '#e74c3c' : catColor;
          const checkBg    = obj.review?.outcome === 'completed' ? 'rgba(46,204,113,0.15)' : obj.review?.outcome === 'uncompleted' ? 'rgba(231,76,60,0.1)' : '#F0F6FF';
          const checkColor  = obj.review?.outcome === 'completed' ? '#2ecc71' : obj.review?.outcome === 'uncompleted' ? '#e74c3c' : catColor;
          let deadlineHtml = '';
          if (obj.deadline) {
            const dl = new Date(obj.deadline + 'T00:00:00');
            const nowD = new Date(); nowD.setHours(0,0,0,0);
            const daysLeft = Math.ceil((dl - nowD) / 86400000);
            // Only show overdue warning if no review has been set yet
            const isOverdue = daysLeft < 0 && !hasReview;
            deadlineHtml = `<span style="font-size:10px;font-weight:700;color:${isOverdue?'#e74c3c':'#7b92aa'};${isOverdue?'background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:20px;padding:2px 8px;':''}margin-left:4px;">${isOverdue?'⚠ OVERDUE · ':''}${fmtDeadlineShort(obj.deadline)}</span>`;
          }
          return `
          <div class="month-obj-card${obj.done?' month-obj-card-done':''}" style="background:#ffffff;border:1.5px solid ${obj.done?'#2ecc71':catColor+'55'};border-radius:14px;padding:14px 16px;margin-bottom:8px;border-left:3px solid ${obj.done?'#2ecc71':catColor};">
            <div onclick="openObjReview('${objectiveMonthKey}',${objIdx})" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
              <div style="width:22px;height:22px;flex-shrink:0;margin-top:1px;border-radius:6px;border:2px solid ${checkBorder};background:${checkBg};color:${checkColor};font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:900;">${checkIcon}</div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                  <span style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:${catColor};">${catLabel.toUpperCase()}</span>
                  ${deadlineHtml}
                  ${obj.done?`<span style="font-size:9px;font-weight:800;color:#2ecc71;background:rgba(46,204,113,0.15);padding:2px 7px;border-radius:20px;margin-left:2px;">DONE</span>`:''}
                </div>
                <div style="font-size:16px;font-weight:800;color:${titleColor};${titleStrike}line-height:1.3;">${obj.text}</div>
                ${progress ? `
                <div style="display:flex;align-items:center;gap:8px;margin-top:9px;">
                  <div style="flex:1;height:5px;background:#E8EEF5;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${progress.pct}%;background:${obj.done?'#2ecc71':catColor};border-radius:3px;"></div>
                  </div>
                  <span style="font-size:12px;font-weight:900;color:${catColor};min-width:36px;text-align:right;">${progress.pct}%</span>
                </div>` : ''}
                ${hasReview && !isReviewing ? `padding:8px 10px;background:${reviewBg};border-radius:8px;border-left:3px solid ${reviewColor};">
                  <div style="font-size:11px;font-weight:700;color:${reviewColor};margin-bottom:4px;">${obj.review.outcome === 'completed' ? '✓ Completed' : '✗ Not completed'}</div>
                  ${obj.review.response ? `<div style="font-size:12px;color:${reviewColor};line-height:1.4;font-style:italic;margin-bottom:${obj.review.lessons?'6px':'0'};">"${obj.review.response}"</div>` : ''}
                  ${obj.review.lessons ? `<div style="font-size:11px;color:${reviewColor};opacity:0.8;line-height:1.4;font-style:italic;border-top:1px solid ${reviewColor}22;padding-top:5px;margin-top:2px;">💡 ${obj.review.lessons}</div>` : ''}
                </div>` : ''}
              </div>
              <div style="font-size:18px;color:#C8D6E5;flex-shrink:0;margin-top:2px;">${isReviewing?'▲':'▼'}</div>
            </div>
            ${isReviewing ? `
            <div style="margin-top:14px;padding-top:14px;border-top:1.5px solid #E8EEF5;" onclick="event.stopPropagation()">
              <div style="display:flex;gap:8px;margin-bottom:14px;">
                <button onclick="setObjReviewOutcome('completed')" style="flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;background:${draft.outcome==='completed'?'#1A5C3A':'#F0F6FF'};border:2px solid ${draft.outcome==='completed'?'#2ecc71':'#C8D6E5'};color:${draft.outcome==='completed'?'#ffffff':'#0A1628'};">✓ Completed</button>
                <button onclick="setObjReviewOutcome('uncompleted')" style="flex:1;padding:11px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;background:${draft.outcome==='uncompleted'?'rgba(231,76,60,0.1)':'#F0F6FF'};border:2px solid ${draft.outcome==='uncompleted'?'#e74c3c':'#C8D6E5'};color:${draft.outcome==='uncompleted'?'#e74c3c':'#0A1628'};">✗ Not Completed</button>
              </div>
              ${draft.outcome ? `
              <div style="margin-bottom:12px;">
                <div style="font-size:11px;font-weight:800;color:#516176;margin-bottom:6px;letter-spacing:0.3px;">${draft.outcome === 'completed' ? 'What went well to allow you to successfully complete this objective?' : 'Why were you unsuccessful in completing this objective?'}</div>
                <textarea id="obj-review-response-${objIdx}" style="width:100%;padding:12px;background:#ffffff;border:1.5px solid #C8D6E5;border-radius:10px;font-size:14px;color:#0A1628;font-family:inherit;resize:none;min-height:80px;box-sizing:border-box;line-height:1.5;" placeholder="Write your reflection..." oninput="autoResizeTextarea(this)">${escAttr(draft.response||'')}</textarea>
              </div>
              <div style="margin-bottom:14px;">
                <div style="font-size:11px;font-weight:800;color:#516176;margin-bottom:6px;letter-spacing:0.3px;">What lessons did you learn, and how will you implement them going forward?</div>
                <textarea id="obj-review-lessons-${objIdx}" style="width:100%;padding:12px;background:#ffffff;border:1.5px solid #C8D6E5;border-radius:10px;font-size:14px;color:#0A1628;font-family:inherit;resize:none;min-height:80px;box-sizing:border-box;line-height:1.5;" placeholder="Lessons learned..." oninput="autoResizeTextarea(this)">${escAttr(draft.lessons||'')}</textarea>
              </div>
              <div style="display:flex;gap:8px;">
                <button onclick="saveObjReview('${objectiveMonthKey}',${objIdx})" style="flex:1;background:#1D4ED8;border:2px solid #1D4ED8;border-radius:10px;padding:12px;color:#ffffff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;">Save Review</button>
                <button onclick="closeObjReview()" style="background:#F0F4FA;border:1.5px solid #C8D6E5;border-radius:10px;padding:12px 18px;color:#516176;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
              </div>` : `<div style="text-align:center;padding:8px 0;color:#9aaabf;font-size:13px;">Select completed or not completed above</div>`}
            </div>` : ''}
          </div>`;
        }).join('')}</div>
      ` : `<div style="text-align:center;padding:10px 0 6px;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;">No objectives with a deadline in ${objectiveBaseDate.toLocaleString('en-GB',{month:'long'})}</div>`}
      ${weekObjs.length > 0 ? `
        <div style="font-size:10px;font-weight:900;letter-spacing:1.4px;color:rgba(100,163,214,0.7);margin-bottom:8px;margin-top:${monthObjs.length > 0 ? '6px' : '4px'};">THIS WEEK</div>
        <div style="margin-bottom:8px;">${weekObjs.map((obj, i) => {
          const text = typeof obj === 'string' ? obj : obj.text;
          const done = typeof obj === 'object' ? !!obj.done : false;
          const category = typeof obj === 'object' ? (obj.category || '') : '';
          const categoryCustom = typeof obj === 'object' ? (obj.categoryCustom || '') : '';
          const catLabel = category ? (categoryCustom || WEEK_CAT_LABELS[category] || 'Other') : '';
          const catColor = WEEK_CAT_COLOURS[category] || '#6ba3d6';
          return `
          <div onclick="toggleWeekObj('${weekKey}',${i})" class="week-obj-card${done?' week-obj-card-done':''}" style="border:1.5px solid ${done?'rgba(46,204,113,0.3)':category?catColor+'33':'rgba(100,163,214,0.2)'};background:${done?'rgba(26,92,58,0.45)':category?catColor+'10':'rgba(100,163,214,0.04)'};border-radius:12px;padding:12px 16px;margin-bottom:6px;border-left:3px solid ${done?'#2ecc71':category?catColor:'rgba(100,163,214,0.55)'};cursor:pointer;display:flex;align-items:center;gap:12px;transition:all 0.2s;">
            <div style="width:20px;height:20px;flex-shrink:0;border-radius:5px;border:2px solid ${done?'rgba(46,204,113,0.7)':category?catColor+'66':'rgba(100,163,214,0.55)'};background:${done?'rgba(46,204,113,0.15)':'transparent'};color:${done?'#2ecc71':category?catColor:'#6ba3d6'};font-size:12px;display:flex;align-items:center;justify-content:center;font-weight:900;">${done?'✓':''}</div>
            <div style="flex:1;min-width:0;">
              ${category ? `<div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:${catColor};margin-bottom:4px;">${catLabel.toUpperCase()}</div>` : ''}
              <div class="week-obj-title${done?' obj-done-item-text':''}" style="font-size:14px;font-weight:700;color:${done?'rgba(255,255,255,0.4)':'#fff'};${done?'text-decoration:line-through;':''}line-height:1.3;">${text}</div>
            </div>
          </div>`;
        }).join('')}</div>
      ` : ''}
    ` : `<div style="text-align:center;padding:14px 0 6px;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;">No objectives set yet — use the planner above</div>`}
  ` : ''}
</div>`;

// ── Batches section with collapse toggle ──────────────────────────────
const batchesVisible = state.batchesCollapsed !== true;
const batchesGroupSection = `
<div style="margin-bottom:4px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${batchesVisible ? '10px' : '4px'};">
    <div class="cc-section-title" style="margin-bottom:0;">Active Batches</div>
    <button onclick="toggleBatchesCollapsed()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:4px 12px;color:rgba(255,255,255,0.5);font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">${batchesVisible ? '▲ Hide' : '▼ Show'}</button>
  </div>
  ${batchesVisible ? batchesSection.replace('<div class="cc-section-title">Active Batches</div>', '') : ''}
</div>`;

// ── Reminders ──────────────────────────────────────────────────────────────
const todayStr = now.toISOString().slice(0, 10);
const reminders = state.data.reminders || [];
const remindersArchived = state.data.remindersArchived || [];
// Show both due-today AND overdue in the top banner
const urgentReminders = reminders.filter(r => !r.done && r.deadline && r.deadline <= todayStr);

const dueTodayBanner = urgentReminders.length > 0 ? `
<div style="background:linear-gradient(135deg,rgba(59,130,246,0.22),rgba(59,130,246,0.08));border:2px solid rgba(59,130,246,0.65);border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 0 24px rgba(59,130,246,0.18);">
  <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:#3B82F6;margin-bottom:12px;">🔔 REMINDERS DUE</div>
  ${urgentReminders.map(r => {
    const isOverdue = r.deadline < todayStr;
    return `
  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(59,130,246,0.18);">
    <button onclick="toggleReminder('${r.id}')" style="width:26px;height:26px;flex-shrink:0;border-radius:7px;border:2.5px solid rgba(59,130,246,0.7);background:transparent;color:transparent;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;transition:all 0.15s;"></button>
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:800;color:#0A1628;line-height:1.3;">${r.text}</div>
      ${isOverdue ? `<div style="font-size:11px;font-weight:800;color:#1D4ED8;margin-top:2px;">⚠ Overdue · ${fmtDeadlineShort(r.deadline)}</div>` : `<div style="font-size:11px;font-weight:700;color:#2563EB;margin-top:2px;">Due today</div>`}
    </div>
    <button onclick="toggleReminder('${r.id}')" style="background:#1D4ED8;border:none;border-radius:10px;padding:9px 16px;color:#fff;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">✓ Done</button>
  </div>`;
  }).join('')}
</div>` : '';

const remindersSection = `
<div class="cc-section-title" style="color:inherit;">Reminders</div>
<div style="background:#ffffff;border:1.5px solid #D8E0EC;border-radius:16px;overflow:hidden;margin-bottom:4px;" class="reminders-card-root">
  ${reminders.length === 0 ? `
    <div style="padding:18px 20px;text-align:center;color:#9aaabf;font-size:13px;font-style:italic;">No reminders yet — add one below</div>
  ` : reminders.map(r => {
    const rIsToday = r.deadline === todayStr;
    const rIsOverdue = r.deadline && r.deadline < todayStr && !r.done;
    const deadlineColor = r.done ? '#b0bec5' : rIsToday ? '#e74c3c' : rIsOverdue ? '#e74c3c' : '#7b92aa';
    const deadlineLabel = r.deadline
      ? (rIsToday ? '📅 Due today' : rIsOverdue ? `⚠ Overdue · ${fmtDeadlineShort(r.deadline)}` : fmtDeadlineShort(r.deadline))
      : '';
    const isEditing = state.reminderEditing === r.id;
    const isChecklist = r.type === 'checklist';
    const isExpanded = state.reminderExpanded === r.id;

    if (isEditing) return `
    <div style="padding:14px 16px;border-bottom:1px solid #E8EEF5;background:#F0F6FF;">
      <input class="batch-editor-input" id="reminder-edit-text-${r.id}" value="${r.text.replace(/"/g,'&quot;')}" style="margin-bottom:10px;background:#fff;border:1.5px solid #aac0d8;color:#0A1628;font-size:15px;">
      <div style="position:relative;margin-bottom:10px;" onclick="document.getElementById('reminder-edit-deadline-${r.id}').showPicker&&document.getElementById('reminder-edit-deadline-${r.id}').showPicker()">
        <input type="date" id="reminder-edit-deadline-${r.id}" value="${r.deadline||''}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;" onchange="updateReminderEditDeadlineDisplay('${r.id}',this.value)">
        <div id="reminder-edit-deadline-display-${r.id}" style="padding:10px 14px;background:#fff;border:1.5px solid #aac0d8;border-radius:8px;font-size:13px;color:${r.deadline?'#8B6914':'#9aaabf'};font-weight:${r.deadline?'700':'400'};pointer-events:none;">${r.deadline?'📅 '+fmtDeadlineShort(r.deadline):'📅 Set deadline (optional)'}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="saveReminderEdit('${r.id}')" style="flex:1;background:#1D4ED8;border:2px solid #1D4ED8;border-radius:10px;padding:11px;color:#ffffff;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;letter-spacing:0.3px;">Save</button>
        <button onclick="cancelReminderEdit()" style="background:#E8EEF5;border:1.5px solid #D0DAE8;border-radius:10px;padding:11px 18px;color:#516176;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
      </div>
    </div>`;

    if (isChecklist) {
      const items = r.items || [];
      const doneCount = items.filter(it => it.done).length;
      return `
      <div style="border-bottom:1px solid #E8EEF5;${r.done?'opacity:0.48;':''}">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:#0A1628;line-height:1.3;">📋 ${r.text}</div>
            <div style="font-size:11px;color:#7b92aa;margin-top:2px;font-weight:700;">${doneCount}/${items.length} items${doneCount===items.length&&items.length>0?' · All done ✓':''}</div>
            ${deadlineLabel ? `<div style="font-size:11px;font-weight:700;color:${deadlineColor};margin-top:3px;">${deadlineLabel}</div>` : ''}
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
            <button onclick="toggleReminderExpand('${r.id}')" style="background:#EEF5FF;border:1.5px solid #C5D8EE;border-radius:8px;padding:6px 12px;color:#3B82F6;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">${isExpanded?'▲':'▼'}</button>
            <button onclick="editReminder('${r.id}')" style="width:28px;height:28px;background:#F0F6FF;border:1.5px solid #C5D8EE;border-radius:7px;color:#516176;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✎</button>
            <button onclick="deleteReminder('${r.id}')" style="width:28px;height:28px;background:#FFF0F0;border:1.5px solid #FFCDD2;border-radius:7px;color:#e74c3c;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
        </div>
        ${isExpanded ? `
        <div style="padding:0 16px 14px;">
          ${items.length === 0 ? `<div style="font-size:13px;color:#9aaabf;font-style:italic;padding:4px 0 10px;">No items yet — add one below</div>` : ''}
          ${items.map((it, itemIdx) => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #F0F4FA;">
            <button onclick="toggleChecklistItem('${r.id}',${itemIdx})" style="width:22px;height:22px;flex-shrink:0;border-radius:6px;border:2px solid ${it.done?'#2ecc71':'#C8D6E5'};background:${it.done?'rgba(46,204,113,0.15)':'#fff'};color:${it.done?'#2ecc71':'transparent'};font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">${it.done?'✓':''}</button>
            <span style="flex:1;font-size:14px;font-weight:600;color:${it.done?'#9aaabf':'#0A1628'};${it.done?'text-decoration:line-through;':''}line-height:1.3;">${it.text}</span>
            <button onclick="deleteChecklistItem('${r.id}',${itemIdx})" style="width:24px;height:24px;flex-shrink:0;background:#FFF0F0;border:1.5px solid #FFCDD2;border-radius:6px;color:#e74c3c;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>`).join('')}
          <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #E8EEF5;">
            <input id="checklist-add-${r.id}" class="batch-editor-input" placeholder="Add item..." style="flex:1;background:#fff;border:1.5px solid #C8D6E5;color:#0A1628;font-size:14px;margin:0;" onkeydown="if(event.key==='Enter')addChecklistItem('${r.id}')">
            <button onclick="addChecklistItem('${r.id}')" style="background:#1D4ED8;border:2px solid #1D4ED8;border-radius:10px;padding:10px 16px;color:#ffffff;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">+ Add</button>
          </div>
        </div>` : ''}
      </div>`;
    }

    return `
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #E8EEF5;${r.done ? 'opacity:0.48;' : ''}">
      <button onclick="toggleReminder('${r.id}')" style="width:24px;height:24px;flex-shrink:0;border-radius:7px;border:2px solid ${r.done?'#2ecc71':'#aac0d8'};background:${r.done?'rgba(46,204,113,0.15)':'#fff'};color:${r.done?'#2ecc71':'transparent'};font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">${r.done?'✓':''}</button>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:${r.done?'#9aaabf':'#0A1628'};${r.done?'text-decoration:line-through;':''}line-height:1.3;">${r.text}</div>
        ${deadlineLabel ? `<div style="font-size:11px;font-weight:700;color:${deadlineColor};margin-top:3px;">${deadlineLabel}</div>` : ''}
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
        <button onclick="addReminderToPlanner('${r.id}')" title="Add to today's planner" style="background:#EEF5FF;border:1.5px solid #C5D8EE;border-radius:8px;padding:6px 10px;color:#3B82F6;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;letter-spacing:0.3px;">📋 Plan</button>
        <button onclick="editReminder('${r.id}')" style="width:28px;height:28px;background:#F0F6FF;border:1.5px solid #C5D8EE;border-radius:7px;color:#516176;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✎</button>
        <button onclick="deleteReminder('${r.id}')" style="width:28px;height:28px;background:#FFF0F0;border:1.5px solid #FFCDD2;border-radius:7px;color:#e74c3c;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
    </div>`;
  }).join('')}
  <div style="padding:14px 16px;background:#F8FAFC;border-top:1.5px solid #E8EEF5;">
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button onclick="toggleNewReminderType('reminder')" style="flex:1;padding:9px;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;background:${state.newReminderType!=='checklist'?'#1D4ED8':'#F0F4FA'};border:2px solid ${state.newReminderType!=='checklist'?'#1D4ED8':'#C8D6E5'};color:${state.newReminderType!=='checklist'?'#ffffff':'#516176'};">📝 Reminder</button>
      <button onclick="toggleNewReminderType('checklist')" style="flex:1;padding:9px;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;background:${state.newReminderType==='checklist'?'#1D4ED8':'#F0F4FA'};border:2px solid ${state.newReminderType==='checklist'?'#1D4ED8':'#C8D6E5'};color:${state.newReminderType==='checklist'?'#ffffff':'#516176'};">📋 Checklist</button>
    </div>
    <input class="batch-editor-input" id="new-reminder-text" placeholder="${state.newReminderType==='checklist'?'Checklist name (e.g. Shopping List)...':'New reminder...'}" style="margin-bottom:10px;background:#fff;border:1.5px solid #C8D6E5;color:#0A1628;font-size:15px;" onkeydown="if(event.key==='Enter')addReminder()">
    <div style="display:flex;gap:8px;align-items:center;">
      <div style="flex:1;position:relative;cursor:pointer;" onclick="document.getElementById('new-reminder-deadline').showPicker&&document.getElementById('new-reminder-deadline').showPicker()">
        <input type="date" id="new-reminder-deadline" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;" onchange="updateReminderDeadlineDisplay(this.value)">
        <div id="new-reminder-deadline-display" style="padding:10px 14px;background:#fff;border:1.5px solid #C8D6E5;border-radius:8px;font-size:13px;color:#9aaabf;pointer-events:none;">📅 Set deadline (optional)</div>
      </div>
      <button onclick="addReminder()" style="background:#C9A84C;border:none;border-radius:10px;padding:10px 22px;color:#000;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0;">+ Add</button>
    </div>
  </div>
</div>
${remindersArchived.length > 0 ? `
<div style="margin-bottom:4px;">
  <button onclick="toggleRemindersArchive()" style="width:100%;background:#F0F4FA;border:1.5px solid #D8E0EC;border-radius:12px;padding:11px 16px;color:#6B7A90;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between;letter-spacing:0.3px;">
    <span>📦 Archived Reminders (${remindersArchived.length})</span>
    <span style="font-size:10px;">${state.remindersArchiveOpen ? '▲ Hide' : '▼ Show'}</span>
  </button>
  ${state.remindersArchiveOpen ? `
  <div style="background:#fff;border:1.5px solid #D8E0EC;border-radius:12px;margin-top:6px;overflow:hidden;">
    ${remindersArchived.map(r => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #EDF1F7;opacity:0.55;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:#6B7A90;text-decoration:line-through;line-height:1.3;">${r.text}</div>
        ${r.deadline ? `<div style="font-size:11px;color:#9aaabf;margin-top:2px;">${fmtDeadlineShort(r.deadline)}</div>` : ''}
      </div>
      <button onclick="deleteArchivedReminder('${r.id}')" style="width:28px;height:28px;flex-shrink:0;background:#FFF0F0;border:1.5px solid #FFCDD2;border-radius:7px;color:#e74c3c;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Delete permanently">✕</button>
    </div>`).join('')}
  </div>` : ''}
</div>` : ''}`;

// ── ORDER: Due-Today Banner → Habits → Reminders → Today's Fronts → Objectives (collapsible) → Batches (collapsible) ──
return injectedCSS + dueTodayBanner + frontsSection + remindersSection + objectivesGroupSection + batchesGroupSection + `
<div style="margin-top:16px;margin-bottom:8px;">
<button onclick="openPastDays()" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;">
📅 Review Previous Days
</button>
</div>` + objectivesModal;

}
