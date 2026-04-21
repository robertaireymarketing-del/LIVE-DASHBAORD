// Extracted modal render functions for lower-token AI edits.

export function renderDayPlannerModal({state, getProjectFronts, getTodayDayKey, BATCH_COLOURS}) {
      if (!state.dayPlannerOpen) return '';
      const weekOffset = state.dayPlannerWeekOffset || 0;
      const fronts = getProjectFronts();
      const days = ['mon','tue','wed','thu','fri','sat','sun'];
      const dayLabels = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
      const activeDay = state.dayPlannerDay || getTodayDayKey();

      const now = new Date();
      const curDay = now.getDay();
      const daysToMon = curDay === 0 ? 6 : curDay - 1;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysToMon + (weekOffset * 7));
      thisMonday.setHours(0,0,0,0);
      const tempD = new Date(thisMonday);
      tempD.setDate(tempD.getDate() + 3 - (tempD.getDay()+6)%7);
      const w1 = new Date(tempD.getFullYear(),0,4);
      const wn = 1 + Math.round(((tempD-w1)/86400000 - 3 + (w1.getDay()+6)%7)/7);
      const weekKey = tempD.getFullYear() + '-W' + String(wn).padStart(2,'0');
      const dayDates = {};
      days.forEach((d, i) => { const dt = new Date(thisMonday); dt.setDate(thisMonday.getDate() + i); dayDates[d] = dt; });
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fmt = d => d.getDate() + ' ' + MONTHS[d.getMonth()];
      const endSunday = new Date(thisMonday); endSunday.setDate(thisMonday.getDate() + 6);
      const weekLabel = fmt(thisMonday) + ' – ' + fmt(endSunday);
      const isCurrentWeek = weekOffset === 0;
      const isPastWeek = weekOffset < 0;
      const todayISO = new Date().toISOString().slice(0,10);

      const rawObj = state.data.weekObjectives?.[weekKey];
      const weekObjectives = Array.isArray(rawObj) ? rawObj : (rawObj ? [{text:rawObj, done:false}] : []);

      // Load tasks for active day — now includes _batch and _streams
      const allKeys = ['_batch','_streams','tjm','vinted','notts','_other'];
      const dayTasks = {};
      allKeys.forEach(fk => {
        if(fk === '_batch' || fk === '_streams') {
          const saved = state.data.dayBatchPlan?.[weekKey]?.[activeDay]?.[fk] || [];
          dayTasks[fk] = [...saved];
        } else {
          const plan = fronts[fk]?.weekPlans?.[weekKey] || {};
          const t = plan[activeDay];
          dayTasks[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
        }
      });
      const draft = state.dayPlannerDraft || dayTasks;

      // ── UNSCHEDULED BATCH STEPS ──────────────────────────────────
      // Only exclude steps already in draft or explicitly done:true — incomplete past-day steps reappear
      const draftStepKeys = new Set();
      (draft._batch||[]).forEach(s => draftStepKeys.add(`${s.batchId}:${s.stepIdx}`));
      const doneStepKeys = new Set();
      Object.values(state.data.dayBatchPlan||{}).forEach(weekData => {
        Object.values(weekData).forEach(dayData => {
          (dayData._batch||[]).forEach(s => { if (s.done) doneStepKeys.add(`${s.batchId}:${s.stepIdx}`); });
        });
      });
      const unscheduledSteps = [];
      (state.data.tjmBatches||[]).filter(b=>b.status!=='done'&&b.status!=='archived').forEach(b=>{
        const colour = BATCH_COLOURS.find(c=>c.id===(b.colour||'gold'))||BATCH_COLOURS[0];
        (b.steps||[]).forEach((s,si)=>{
          const key = `${b.id}:${si}`;
          if(!s.completedAt && !draftStepKeys.has(key) && !doneStepKeys.has(key)) {
            unscheduledSteps.push({ batchId:b.id, batchName:b.name, stepIdx:si, stepName:s.name, timeBlock:s.timeBlock||30, hex:colour.hex, colourId:b.colour||'gold', deadline:s.deadline||'' });
          }
        });
      });
      // Sort by step deadline — most urgent first, no deadline last
      unscheduledSteps.sort((a,b) => {
        if(!a.deadline && !b.deadline) return 0;
        if(!a.deadline) return 1;
        if(!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });

      // ── LIVESTREAM form state ─────────────────────────────────────
      const showStreamForm = state.dayPlannerStreamForm;

      return `<div style="min-height:100vh;width:100%;background:#141414;">
        <div style="background:#141414;border-bottom:1px solid rgba(255,255,255,0.07);padding:14px 24px;position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;">
          <button class="planner-back-btn" onclick="closeDayPlannerBtn()" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 18px;color:rgba(255,255,255,0.8);font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">← Back</button>
          <div style="text-align:center;">
            <div class="week-plan-project" style="margin-bottom:2px;">WEEK PLAN</div>
            <div class="week-plan-title" style="font-size:16px;">${weekLabel}</div>
          </div>
          <div style="width:100px;display:flex;justify-content:flex-end;">
            <button class="week-save-btn" style="margin:0;padding:9px 18px;font-size:13px;border-radius:10px;width:auto;" onclick="saveDayPlan('${weekKey}')">Save</button>
          </div>
        </div>
        <div style="width:100%;padding:0 40px 60px;">
          <div style="padding:20px 0 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <button onclick="navPlanWeek(-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px 14px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:14px;font-family:inherit;">‹ Prev</button>
              <div style="font-size:11px;font-weight:800;color:${isCurrentWeek?'#C9A84C':isPastWeek?'rgba(255,255,255,0.3)':'rgba(155,89,182,0.9)'};letter-spacing:1px;">${isCurrentWeek?'THIS WEEK':isPastWeek?'PAST WEEK':'FUTURE WEEK'}</div>
              <button onclick="navPlanWeek(1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:7px 14px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:14px;font-family:inherit;">Next ›</button>
            </div>
            <div style="margin-bottom:14px;">
              <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:10px;">THIS WEEK'S MAIN OBJECTIVES</div>
              ${weekObjectives.map((obj, oi) => `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border:1px solid ${obj.done?'rgba(46,204,113,0.2)':'rgba(255,255,255,0.08)'};border-radius:12px;padding:12px 14px;">
                  <button onclick="toggleWeekObj('${weekKey}',${oi})" style="width:28px;height:28px;flex-shrink:0;border-radius:8px;border:2px solid ${obj.done?'#2ecc71':'rgba(255,255,255,0.25)'};background:${obj.done?'rgba(46,204,113,0.2)':'transparent'};color:#2ecc71;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;">${obj.done?'✓':''}</button>
                  ${state.weekObjEditing===oi+'-'+weekKey
                    ? `<input id="week-obj-edit-${oi}" value="${obj.text.replace(/"/g,'&quot;')}" style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;color:#fff;font-size:15px;font-weight:600;font-family:inherit;outline:none;" onkeydown="if(event.key==='Enter')saveWeekObjEdit('${weekKey}',${oi});if(event.key==='Escape')cancelWeekObjEdit();">
                      <button onclick="saveWeekObjEdit('${weekKey}',${oi})" style="background:#C9A84C;border:none;border-radius:7px;padding:6px 12px;color:#000;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;">Save</button>`
                    : `<span onclick="editWeekObj('${weekKey}',${oi})" style="flex:1;font-size:16px;font-weight:${obj.done?'600':'700'};color:${obj.done?'rgba(255,255,255,0.4)':'#fff'};${obj.done?'text-decoration:line-through;':''}line-height:1.4;cursor:text;" title="Click to edit">${obj.text}</span>`}
                  <button onclick="removeWeekObj('${weekKey}',${oi})" style="background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.2);border-radius:7px;padding:4px 8px;color:#e74c3c;font-size:13px;cursor:pointer;" title="Delete">✕</button>
                </div>`).join('')}
              <div style="display:flex;gap:8px;margin-top:6px;">
                <input id="new-week-obj-${weekKey}" class="week-day-input" style="flex:1;padding:11px 14px;font-size:14px;" placeholder="Add an objective..." onkeydown="if(event.key==='Enter'){addWeekObj('${weekKey}');event.preventDefault();}">
                <button onclick="addWeekObj('${weekKey}')" style="background:rgba(201,168,76,0.15);border:1.5px solid rgba(201,168,76,0.35);border-radius:10px;padding:11px 16px;color:#C9A84C;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;">+ Add</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
              ${days.map(d => {
                const dt = dayDates[d];
                const isToday = dt.toISOString().slice(0,10) === todayISO;
                const isActive = d === activeDay;
                return `<button onclick="switchPlanDay('${d}')" style="padding:5px 2px;border-radius:8px;border:1.5px solid ${isActive?'rgba(201,168,76,0.4)':isToday?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)'};background:${isActive?'rgba(201,168,76,0.12)':isToday?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.03)'};color:${isActive?'#C9A84C':isToday?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.35)'};cursor:pointer;font-family:inherit;text-align:center;line-height:1.4;width:100%;">
                  <div style="font-size:8px;opacity:0.7;">${dt.getDate()} ${MONTHS[dt.getMonth()]}</div>
                  <div style="font-size:10px;font-weight:800;">${d.charAt(0).toUpperCase()+d.slice(1,3)}${isToday?'·':''}</div>
                </button>`;
              }).join('')}
            </div>
          </div>

          <!-- ── DAY HEADER ── -->
          <div>
          <div style="padding:12px 0 0;display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:13px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,0.5);">${dayLabels[activeDay].toUpperCase()} · ${fmt(dayDates[activeDay])}</div>
            <button onclick="toggleStreamForm()" style="background:rgba(52,152,219,0.12);border:1px solid rgba(52,152,219,0.3);border-radius:8px;padding:7px 12px;color:#3498db;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">📡 Add Livestream</button>
          </div>

          <!-- ── LIVESTREAM QUICK-ADD ── -->
          ${showStreamForm ? `
          <div style="margin:10px 20px 0;background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-radius:12px;padding:14px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(52,152,219,0.8);margin-bottom:10px;">📡 LIVESTREAM</div>
            <input class="week-day-input" id="stream-topic" placeholder="Topic / hook..." style="margin-bottom:8px;border-color:rgba(52,152,219,0.2);">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
              <button onclick="openTimePicker('_streams',-1,'start')" style="flex:1;background:${state.dayPlannerStreamDraft?.start?'rgba(52,152,219,0.18)':'rgba(52,152,219,0.08)'};border:1px solid rgba(52,152,219,0.35);border-radius:8px;padding:12px;color:#3498db;font-size:${state.dayPlannerStreamDraft?.start?'18px':'13px'};font-weight:${state.dayPlannerStreamDraft?.start?'800':'400'};cursor:pointer;font-family:inherit;text-align:left;">${state.dayPlannerStreamDraft?.start||'Set start time...'}</button>
              ${state.dayPlannerStreamDraft?.start ? (() => {
                const [sh,sm] = state.dayPlannerStreamDraft.start.split(':').map(Number);
                const endM = sh*60+sm+60;
                const endStr = String(Math.floor(endM/60)%24).padStart(2,'0')+':'+String(endM%60).padStart(2,'0');
                return `<span style="font-size:14px;font-weight:800;color:#3498db;white-space:nowrap;">→ ${endStr}</span><span style="font-size:11px;color:rgba(52,152,219,0.5);white-space:nowrap;">· 1h</span>`;
              })() : `<span style="font-size:12px;color:rgba(52,152,219,0.4);white-space:nowrap;">· 1h live</span>`}
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="addStreamToDraft()" style="flex:1;background:#3498db;border:none;border-radius:8px;padding:10px;color:#000;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;">Add to ${dayLabels[activeDay]}</button>
              <button onclick="cancelStreamForm()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;font-family:inherit;">Cancel</button>
            </div>
          </div>` : ''}


          <!-- ── TASKS PER FRONT (includes batch steps) ── -->
          <!-- ── MANUAL TASKS PER FRONT ── -->
          <div class="planner-columns">
          <div style="min-width:0;overflow:hidden;width:100%;"><!-- LEFT COLUMN -->
          ${(draft._streams||[]).length > 0 ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(52,152,219,0.7);margin-bottom:8px;">LIVESTREAMS</div>
            ${(draft._streams||[]).map((s, si) => {
              const [sh,sm] = (s.start||'17:00').split(':').map(Number);
              const endM = sh*60+sm+60;
              const autoEnd = s.end || (String(Math.floor(endM/60)%24).padStart(2,'0')+':'+String(endM%60).padStart(2,'0'));
              return `<div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-left:3px solid #3498db;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
                <div>
                  <div style="font-size:14px;font-weight:800;color:#fff;">📡 ${s.topic||'Livestream'}</div>
                  <div style="font-size:13px;color:#3498db;font-weight:700;margin-top:3px;">${s.start||'17:00'} → ${autoEnd} · 1h</div>
                </div>
                <button onclick="removeStreamFromDraft(${si})" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);border-radius:7px;padding:5px 10px;color:#e74c3c;font-size:13px;cursor:pointer;">✕</button>
              </div>`;
            }).join('')}
          </div>` : ''}
          ${['tjm','vinted','notts','_other'].map(fk => {
            const frontNames = { tjm:'TJM', vinted:'Vinted', notts:'Nottingham Insurance', _other:'Other Tasks' };
            const frontColors = { tjm:'rgba(201,168,76,0.6)', vinted:'rgba(52,152,219,0.6)', notts:'rgba(46,204,113,0.6)', _other:'rgba(155,89,182,0.6)' };
            const tasks = draft[fk] || [];
            // Batch steps assigned to this project front (not for _other — that's manual-only)
            const batchStepsForFront = fk === '_other' ? [] : (draft._batch||[]).map((s,si)=>({...s,si})).filter(s => {
              const batch = (state.data.tjmBatches||[]).find(b=>b.id===s.batchId);
              return (batch?.project||'tjm') === fk;
            });
            return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:${frontColors[fk]};margin-bottom:8px;">${frontNames[fk].toUpperCase()}</div>
                ${batchStepsForFront.map(s => {
                  const hex = BATCH_COLOURS.find(c=>c.id===s.colourId)?.hex || '#C9A84C';
                  const mins = s.timeBlock||30;
                  const timeStr = mins<60?mins+'m':Math.floor(mins/60)+'h'+(mins%60?mins%60+'m':'');
                  // Calculate end time from start time + duration
                  let endTimeStr = '';
                  if(s.startTime) {
                    const [sh,sm] = s.startTime.split(':').map(Number);
                    const totalMins = sh*60+sm+mins;
                    endTimeStr = String(Math.floor(totalMins/60)%24).padStart(2,'0')+':'+String(totalMins%60).padStart(2,'0');
                  }
                  return `<div class="day-task-card day-task-batch" data-batch-si="${s.si}" style="border-left-color:${hex};background:${hex}10;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:${s.done?'0':'8px'};">
                      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                        <div style="width:8px;height:8px;border-radius:50%;background:${hex};flex-shrink:0;${s.done?'opacity:0.4':''}"></div>
                        <div style="min-width:0;">
                          <div style="font-size:14px;font-weight:700;color:${s.done?'rgba(255,255,255,0.3)':'#fff'};${s.done?'text-decoration:line-through;':''}white-space:normal;word-break:break-word;">${s.stepName}</div>
                          <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px;">${s.batchName} · ⏱ ${timeStr}${s.rolledOver ? ` <span style="color:#e67e22;font-weight:900;font-size:9px;letter-spacing:0.5px;background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:1px 5px;">↩ ROLLED OVER</span>` : ''}</div>
                        </div>
                      </div>
                      <div style="display:flex;gap:6px;flex-shrink:0;">
                        ${!s.done
                          ? `<button onclick="markWeekBatchStepDone('${s.batchId}',${s.stepIdx},${s.si},'${weekKey}')" style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:7px;padding:6px 8px;color:#2ecc71;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">✓</button>`
                          : `<button onclick="unmarkWeekBatchStepDone(${s.si})" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;padding:6px 8px;color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">↩</button>`}
                        <button onclick="removeBatchFromDraft(${s.si})" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:6px 8px;color:rgba(255,255,255,0.3);font-size:13px;cursor:pointer;flex-shrink:0;">✕</button>
                      </div>
                    </div>
                    ${!s.done ? `
                    <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
                      <button onclick="openTimePicker('_batchStep',${s.si},'start')" style="flex:1;min-width:0;background:${s.startTime?hex+'22':'rgba(255,255,255,0.05)'};border:1px solid ${s.startTime?hex+'55':'rgba(255,255,255,0.1)'};border-radius:8px;padding:10px 12px;color:${s.startTime?'#fff':'rgba(255,255,255,0.3)'};font-size:${s.startTime?'15px':'13px'};font-weight:${s.startTime?'800':'400'};cursor:pointer;font-family:inherit;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.startTime||'Set start time...'}</button>
                      ${endTimeStr ? `<span style="font-size:13px;font-weight:800;color:${hex};white-space:nowrap;flex-shrink:0;">→ ${endTimeStr} <span style="font-size:11px;color:rgba(255,255,255,0.35);">· ${timeStr}</span></span>` : `<span style="font-size:12px;color:rgba(255,255,255,0.25);white-space:nowrap;flex-shrink:0;">⏱ ${timeStr}</span>`}
                    </div>
                    ${state.batchStepConflict?.si===s.si ? `<div style="font-size:11px;color:#e74c3c;font-weight:700;margin-top:6px;">⚠️ ${state.batchStepConflict.msg}</div>` : ''}` : ''}
                  </div>`;
                }).join('')}
                ${tasks.map((task, ti) => {
                  const taskText = typeof task === 'object' ? task.text : task;
                  const startTime = typeof task === 'object' ? (task.start||'') : '';
                  const endTime = typeof task === 'object' ? (task.end||'') : '';
                  const dur = startTime && endTime ? (() => { const [sh,sm]=startTime.split(':').map(Number); const [eh,em]=endTime.split(':').map(Number); const mins=(eh*60+em)-(sh*60+sm); return mins>0?`${Math.floor(mins/60)?Math.floor(mins/60)+'h ':''}${mins%60?mins%60+'m':''}`.trim():''; })() : '';
                  return `<div style="margin-bottom:8px;">
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                      <input class="week-day-input" style="flex:1;padding:9px 12px;" value="${taskText.replace(/"/g,'&quot;')}" placeholder="Task..." oninput="updateDraftTask('${fk}',${ti},this.value,'text')">
                      <button onclick="removeDraftTask('${fk}',${ti})" style="background:rgba(231,76,60,0.12);border:1.5px solid rgba(231,76,60,0.35);border-radius:8px;padding:0;color:#e74c3c;cursor:pointer;font-size:16px;font-weight:700;flex-shrink:0;width:40px;height:40px;min-width:40px;display:flex;align-items:center;justify-content:center;position:relative;z-index:3;touch-action:manipulation;-webkit-tap-highlight-color:transparent;">✕</button>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;">
                      <button onclick="openTimePicker('${fk}',${ti},'start')" style="flex:1;background:${startTime?'rgba(201,168,76,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${startTime?'rgba(201,168,76,0.3)':'rgba(255,255,255,0.1)'};border-radius:8px;padding:9px 10px;color:${startTime?'#C9A84C':'rgba(255,255,255,0.25)'};font-size:13px;font-weight:${startTime?'700':'400'};cursor:pointer;font-family:inherit;text-align:center;">${startTime||'Start'}</button>
                      <span style="color:rgba(255,255,255,0.2);font-size:14px;font-weight:300;">→</span>
                      <button onclick="openTimePicker('${fk}',${ti},'end')" style="flex:1;background:${endTime?'rgba(201,168,76,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${endTime?'rgba(201,168,76,0.3)':'rgba(255,255,255,0.1)'};border-radius:8px;padding:9px 10px;color:${endTime?'#C9A84C':'rgba(255,255,255,0.25)'};font-size:13px;font-weight:${endTime?'700':'400'};cursor:pointer;font-family:inherit;text-align:center;">${endTime||'End'}</button>
                      ${dur ? `<span style="font-size:12px;font-weight:800;color:#C9A84C;white-space:nowrap;min-width:36px;text-align:right;">${dur}</span>` : `<span style="min-width:36px;"></span>`}
                    </div>
                  </div>`;
                }).join('')}
                <button onclick="addDraftTask('${fk}')" style="width:100%;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;padding:8px;font-size:12px;color:rgba(255,255,255,0.3);cursor:pointer;font-family:inherit;">+ Add task</button>
              </div>`;
          }).join('')}
          </div>

          <!-- RIGHT COLUMN: Unscheduled Batch Steps -->
          <div style="min-width:0;overflow:hidden;">
          <!-- ── UNSCHEDULED BATCH STEPS PANEL ── -->
          ${unscheduledSteps.length > 0 ? `
          <div style="padding:12px 0 0;">
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:8px;">UNSCHEDULED BATCH STEPS</div>
            <div style="overflow-y:auto;padding-right:2px;">
              ${unscheduledSteps.map((s, i) => {
                const mins = s.timeBlock||30;
                const timeStr = mins<60?mins+'m':Math.floor(mins/60)+'h'+(mins%60?mins%60+'m':'');
                return `<div class="batch-step-pick" style="border-left:3px solid ${s.hex};flex-direction:column;align-items:stretch;gap:8px;cursor:default;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;">
                      <div style="width:22px;height:22px;border-radius:50%;background:${s.hex};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;">${s.stepIdx+1}</div>
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div class="batch-step-pick-name">${s.stepName||'Unnamed step'}</div>
                      <div class="batch-step-pick-batch">${s.batchName} · ⏱ ${timeStr}${s.deadline ? (() => { const dl=new Date(s.deadline); dl.setHours(0,0,0,0); const now=new Date(); now.setHours(0,0,0,0); const d=Math.ceil((dl-now)/86400000); const col=d<=1?'#e74c3c':d<=3?'#e67e22':'rgba(255,255,255,0.4)'; return ` · <span style="color:${col};font-weight:800;">${d<0?'OVERDUE':d===0?'TODAY':d===1?'TOMORROW':d+'d'}</span>`; })() : ''}</div>
                    </div>
                    <button onclick="assignBatchStep(${i})" style="background:${s.hex};border:none;border-radius:8px;padding:9px 16px;color:#000;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;">+ Add</button>
                  </div>
                  <div id="batch-conflict-${i}" style="display:none;font-size:11px;color:#e74c3c;font-weight:700;"></div>
                </div>`;
              }).join('')}
            </div>
          </div>` : '<div style="padding:12px 0 0;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;">All steps scheduled ✓</div>'}
          </div>

          </div><!-- end columns -->
          <div style="padding:16px 0 32px;">
            <button class="week-save-btn" style="margin:0;width:100%;" onclick="saveDayPlan('${weekKey}')">Save ${dayLabels[activeDay]}</button>
          </div>
        </div>
        </div>
      </div>
      ${state.timePickerOpen ? renderTimePickerModal() : ''}
      ${state.taskDeleteConfirm ? `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;" onclick="if(event.target===this)cancelRemoveDraftTask()">
        <div style="background:#141e30;border:1px solid rgba(255,255,255,0.14);border-radius:18px;padding:26px 22px;max-width:340px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
          <div style="font-size:19px;font-weight:900;color:#fff;margin-bottom:8px;">Remove task?</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:22px;line-height:1.55;">"${state.taskDeleteConfirm.text.replace(/"/g,'&quot;')}" will be moved to your task archive — not deleted permanently.</div>
          <div style="display:flex;gap:10px;">
            <button onclick="confirmRemoveDraftTask()" style="flex:1;background:#e74c3c;border:none;border-radius:11px;padding:14px;color:#fff;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;">Archive Task</button>
            <button onclick="cancelRemoveDraftTask()" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:11px;padding:14px;color:rgba(255,255,255,0.65);font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
          </div>
        </div>
      </div>` : ''}`;
    
}

export function renderEmbeddedDayPlanner({state, getProjectFronts, getTodayDayKey, BATCH_COLOURS}) {
      const weekOffset = state.dayPlannerWeekOffset || 0;
      const fronts = getProjectFronts();
      const days = ['mon','tue','wed','thu','fri','sat','sun'];
      const dayLabels = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
      const activeDay = state.dayPlannerDay || getTodayDayKey();

      const now = new Date();
      const curDay = now.getDay();
      const daysToMon = curDay === 0 ? 6 : curDay - 1;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysToMon + (weekOffset * 7));
      thisMonday.setHours(0,0,0,0);
      const tempD = new Date(thisMonday);
      tempD.setDate(tempD.getDate() + 3 - (tempD.getDay()+6)%7);
      const w1 = new Date(tempD.getFullYear(),0,4);
      const wn = 1 + Math.round(((tempD-w1)/86400000 - 3 + (w1.getDay()+6)%7)/7);
      const weekKey = tempD.getFullYear() + '-W' + String(wn).padStart(2,'0');
      const dayDates = {};
      days.forEach((d, i) => { const dt = new Date(thisMonday); dt.setDate(thisMonday.getDate() + i); dayDates[d] = dt; });
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fmt = d => d.getDate() + ' ' + MONTHS[d.getMonth()];
      const endSunday = new Date(thisMonday); endSunday.setDate(thisMonday.getDate() + 6);
      const weekLabel = fmt(thisMonday) + ' – ' + fmt(endSunday);
      const isCurrentWeek = weekOffset === 0;
      const isPastWeek = weekOffset < 0;
      const todayISO = new Date().toISOString().slice(0,10);

      const allKeys = ['_batch','_streams','tjm','vinted','notts','_other'];
      const dayTasks = {};
      allKeys.forEach(fk => {
        if(fk === '_batch' || fk === '_streams') {
          const saved = state.data.dayBatchPlan?.[weekKey]?.[activeDay]?.[fk] || [];
          dayTasks[fk] = [...saved];
        } else {
          const plan = fronts[fk]?.weekPlans?.[weekKey] || {};
          const t = plan[activeDay];
          dayTasks[fk] = Array.isArray(t) ? [...t] : (t ? [t] : []);
        }
      });
      const draft = state.dayPlannerDraft || dayTasks;

      const draftStepKeys = new Set();
      (draft._batch||[]).forEach(s => draftStepKeys.add(`${s.batchId}:${s.stepIdx}`));
      const doneStepKeys = new Set();
      Object.values(state.data.dayBatchPlan||{}).forEach(weekData => {
        Object.values(weekData).forEach(dayData => {
          (dayData._batch||[]).forEach(s => { if (s.done) doneStepKeys.add(`${s.batchId}:${s.stepIdx}`); });
        });
      });
      const unscheduledSteps = [];
      (state.data.tjmBatches||[]).filter(b=>b.status!=='done'&&b.status!=='archived').forEach(b=>{
        const colour = BATCH_COLOURS.find(c=>c.id===(b.colour||'gold'))||BATCH_COLOURS[0];
        (b.steps||[]).forEach((s,si)=>{
          const key = `${b.id}:${si}`;
          if(!s.completedAt && !draftStepKeys.has(key) && !doneStepKeys.has(key)) {
            unscheduledSteps.push({ batchId:b.id, batchName:b.name, stepIdx:si, stepName:s.name, timeBlock:s.timeBlock||30, hex:colour.hex, colourId:b.colour||'gold', deadline:s.deadline||'' });
          }
        });
      });
      unscheduledSteps.sort((a,b) => {
        if(!a.deadline && !b.deadline) return 0;
        if(!a.deadline) return 1;
        if(!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });

      const showStreamForm = state.dayPlannerStreamForm;

      return `
      <div style="border-top:1px solid rgba(255,255,255,0.1);margin:20px 0 0;padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);">PLAN YOUR WEEK</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button onclick="navPlanWeek(-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 12px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:13px;font-family:inherit;">‹</button>
            <span style="font-size:11px;font-weight:800;color:${isCurrentWeek?'#C9A84C':isPastWeek?'rgba(255,255,255,0.3)':'rgba(155,89,182,0.9)'};letter-spacing:0.5px;">${weekLabel}</span>
            <button onclick="navPlanWeek(1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:5px 12px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:13px;font-family:inherit;">›</button>
          </div>
        </div>

        <!-- Day selector -->
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px;">
          ${days.map(d => {
            const dt = dayDates[d];
            const isToday = dt.toISOString().slice(0,10) === todayISO;
            const isActive = d === activeDay;
            return `<button onclick="switchPlanDay('${d}')" style="padding:5px 2px;border-radius:8px;border:1.5px solid ${isActive?'rgba(201,168,76,0.4)':isToday?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.08)'};background:${isActive?'rgba(201,168,76,0.12)':isToday?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.03)'};color:${isActive?'#C9A84C':isToday?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.35)'};cursor:pointer;font-family:inherit;text-align:center;line-height:1.4;width:100%;">
              <div style="font-size:8px;opacity:0.7;">${dt.getDate()} ${MONTHS[dt.getMonth()]}</div>
              <div style="font-size:10px;font-weight:800;">${d.charAt(0).toUpperCase()+d.slice(1,3)}${isToday?'·':''}</div>
            </button>`;
          }).join('')}
        </div>

        <!-- Day header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:13px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,0.5);">${dayLabels[activeDay].toUpperCase()} · ${fmt(dayDates[activeDay])}</div>
          <button onclick="toggleStreamForm()" style="background:rgba(52,152,219,0.12);border:1px solid rgba(52,152,219,0.3);border-radius:8px;padding:6px 10px;color:#3498db;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">📡 Add Livestream</button>
        </div>

        <!-- Livestream quick-add -->
        ${showStreamForm ? `
        <div style="margin-bottom:10px;background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-radius:12px;padding:14px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(52,152,219,0.8);margin-bottom:10px;">📡 LIVESTREAM</div>
          <input class="week-day-input" id="stream-topic" placeholder="Topic / hook..." style="margin-bottom:8px;border-color:rgba(52,152,219,0.2);">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <button onclick="openTimePicker('_streams',-1,'start')" style="flex:1;background:${state.dayPlannerStreamDraft?.start?'rgba(52,152,219,0.18)':'rgba(52,152,219,0.08)'};border:1px solid rgba(52,152,219,0.35);border-radius:8px;padding:12px;color:#3498db;font-size:${state.dayPlannerStreamDraft?.start?'18px':'13px'};font-weight:${state.dayPlannerStreamDraft?.start?'800':'400'};cursor:pointer;font-family:inherit;text-align:left;">${state.dayPlannerStreamDraft?.start||'Set start time...'}</button>
            ${state.dayPlannerStreamDraft?.start ? (() => {
              const [sh,sm] = state.dayPlannerStreamDraft.start.split(':').map(Number);
              const endM = sh*60+sm+60;
              const endStr = String(Math.floor(endM/60)%24).padStart(2,'0')+':'+String(endM%60).padStart(2,'0');
              return `<span style="font-size:14px;font-weight:800;color:#3498db;white-space:nowrap;">→ ${endStr}</span><span style="font-size:11px;color:rgba(52,152,219,0.5);white-space:nowrap;">· 1h</span>`;
            })() : `<span style="font-size:12px;color:rgba(52,152,219,0.4);white-space:nowrap;">· 1h live</span>`}
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="addStreamToDraft()" style="flex:1;background:#3498db;border:none;border-radius:8px;padding:10px;color:#000;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;">Add to ${dayLabels[activeDay]}</button>
            <button onclick="cancelStreamForm()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;font-family:inherit;">Cancel</button>
          </div>
        </div>` : ''}

        <!-- Task columns -->
        <div class="planner-columns">
        <div style="min-width:0;overflow:hidden;width:100%;">
        ${(draft._streams||[]).length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(52,152,219,0.7);margin-bottom:8px;">LIVESTREAMS</div>
          ${(draft._streams||[]).map((s, si) => {
            const [sh,sm] = (s.start||'17:00').split(':').map(Number);
            const endM = sh*60+sm+60;
            const autoEnd = s.end || (String(Math.floor(endM/60)%24).padStart(2,'0')+':'+String(endM%60).padStart(2,'0'));
            return `<div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,0.25);border-left:3px solid #3498db;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:14px;font-weight:800;color:#fff;">📡 ${s.topic||'Livestream'}</div>
                <div style="font-size:13px;color:#3498db;font-weight:700;margin-top:3px;">${s.start||'17:00'} → ${autoEnd} · 1h</div>
              </div>
              <button onclick="removeStreamFromDraft(${si})" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);border-radius:7px;padding:5px 10px;color:#e74c3c;font-size:13px;cursor:pointer;">✕</button>
            </div>`;
          }).join('')}
        </div>` : ''}
        ${['tjm','vinted','notts','_other'].map(fk => {
          const frontNames = { tjm:'TJM', vinted:'Vinted', notts:'Nottingham Insurance', _other:'Other Tasks' };
          const frontColors = { tjm:'rgba(201,168,76,0.6)', vinted:'rgba(52,152,219,0.6)', notts:'rgba(46,204,113,0.6)', _other:'rgba(155,89,182,0.6)' };
          const tasks = draft[fk] || [];
          const batchStepsForFront = fk === '_other' ? [] : (draft._batch||[]).map((s,si)=>({...s,si})).filter(s => {
            const batch = (state.data.tjmBatches||[]).find(b=>b.id===s.batchId);
            return (batch?.project||'tjm') === fk;
          });
          return `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:${frontColors[fk]};margin-bottom:8px;">${frontNames[fk].toUpperCase()}</div>
              ${batchStepsForFront.map(s => {
                const hex = BATCH_COLOURS.find(c=>c.id===s.colourId)?.hex || '#C9A84C';
                const mins = s.timeBlock||30;
                const timeStr = mins<60?mins+'m':Math.floor(mins/60)+'h'+(mins%60?mins%60+'m':'');
                let endTimeStr = '';
                if(s.startTime) {
                  const [sh,sm] = s.startTime.split(':').map(Number);
                  const totalMins = sh*60+sm+mins;
                  endTimeStr = String(Math.floor(totalMins/60)%24).padStart(2,'0')+':'+String(totalMins%60).padStart(2,'0');
                }
                return `<div class="day-task-card day-task-batch" data-batch-si="${s.si}" style="border-left-color:${hex};background:${hex}10;margin-bottom:8px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:${s.done?'0':'8px'};">
                    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                      <div style="width:8px;height:8px;border-radius:50%;background:${hex};flex-shrink:0;${s.done?'opacity:0.4':''}"></div>
                      <div style="min-width:0;">
                        <div style="font-size:14px;font-weight:700;color:${s.done?'rgba(255,255,255,0.3)':'#fff'};${s.done?'text-decoration:line-through;':''}white-space:normal;word-break:break-word;">${s.stepName}</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px;">${s.batchName} · ⏱ ${timeStr}${s.rolledOver ? ` <span style="color:#e67e22;font-weight:900;font-size:9px;letter-spacing:0.5px;background:rgba(230,126,34,0.12);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:1px 5px;">↩ ROLLED OVER</span>` : ''}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                      ${!s.done
                        ? `<button onclick="markWeekBatchStepDone('${s.batchId}',${s.stepIdx},${s.si},'${weekKey}')" style="background:rgba(46,204,113,0.12);border:1px solid rgba(46,204,113,0.3);border-radius:7px;padding:6px 8px;color:#2ecc71;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">✓</button>`
                        : `<button onclick="unmarkWeekBatchStepDone(${s.si})" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;padding:6px 8px;color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">↩</button>`}
                      <button onclick="removeBatchFromDraft(${s.si})" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:6px 8px;color:rgba(255,255,255,0.3);font-size:13px;cursor:pointer;flex-shrink:0;">✕</button>
                    </div>
                  </div>
                  ${!s.done ? `
                  <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
                    <button onclick="openTimePicker('_batchStep',${s.si},'start')" style="flex:1;min-width:0;background:${s.startTime?hex+'22':'rgba(255,255,255,0.05)'};border:1px solid ${s.startTime?hex+'55':'rgba(255,255,255,0.1)'};border-radius:8px;padding:10px 12px;color:${s.startTime?'#fff':'rgba(255,255,255,0.3)'};font-size:${s.startTime?'15px':'13px'};font-weight:${s.startTime?'800':'400'};cursor:pointer;font-family:inherit;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.startTime||'Set start time...'}</button>
                    ${endTimeStr ? `<span style="font-size:13px;font-weight:800;color:${hex};white-space:nowrap;flex-shrink:0;">→ ${endTimeStr} <span style="font-size:11px;color:rgba(255,255,255,0.35);">· ${timeStr}</span></span>` : `<span style="font-size:12px;color:rgba(255,255,255,0.25);white-space:nowrap;flex-shrink:0;">⏱ ${timeStr}</span>`}
                  </div>
                  ${state.batchStepConflict?.si===s.si ? `<div style="font-size:11px;color:#e74c3c;font-weight:700;margin-top:6px;">⚠️ ${state.batchStepConflict.msg}</div>` : ''}` : ''}
                </div>`;
              }).join('')}
              ${tasks.map((task, ti) => {
                const taskText = typeof task === 'object' ? task.text : task;
                const startTime = typeof task === 'object' ? (task.start||'') : '';
                const endTime = typeof task === 'object' ? (task.end||'') : '';
                const dur = startTime && endTime ? (() => { const [sh,sm]=startTime.split(':').map(Number); const [eh,em]=endTime.split(':').map(Number); const mins=(eh*60+em)-(sh*60+sm); return mins>0?`${Math.floor(mins/60)?Math.floor(mins/60)+'h ':''}${mins%60?mins%60+'m':''}`.trim():''; })() : '';
                return `<div style="margin-bottom:8px;">
                  <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
                    <input class="week-day-input" style="flex:1;padding:9px 12px;" value="${taskText.replace(/"/g,'&quot;')}" placeholder="Task..." oninput="updateDraftTask('${fk}',${ti},this.value,'text')">
                    <button onclick="removeDraftTask('${fk}',${ti})" style="background:rgba(231,76,60,0.12);border:1.5px solid rgba(231,76,60,0.35);border-radius:8px;padding:0;color:#e74c3c;cursor:pointer;font-size:16px;font-weight:700;flex-shrink:0;width:40px;height:40px;min-width:40px;display:flex;align-items:center;justify-content:center;position:relative;z-index:3;touch-action:manipulation;-webkit-tap-highlight-color:transparent;">✕</button>
                  </div>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <button onclick="openTimePicker('${fk}',${ti},'start')" style="flex:1;background:${startTime?'rgba(201,168,76,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${startTime?'rgba(201,168,76,0.3)':'rgba(255,255,255,0.1)'};border-radius:8px;padding:9px 10px;color:${startTime?'#C9A84C':'rgba(255,255,255,0.25)'};font-size:13px;font-weight:${startTime?'700':'400'};cursor:pointer;font-family:inherit;text-align:center;">${startTime||'Start'}</button>
                    <span style="color:rgba(255,255,255,0.2);font-size:14px;font-weight:300;">→</span>
                    <button onclick="openTimePicker('${fk}',${ti},'end')" style="flex:1;background:${endTime?'rgba(201,168,76,0.1)':'rgba(255,255,255,0.04)'};border:1px solid ${endTime?'rgba(201,168,76,0.3)':'rgba(255,255,255,0.1)'};border-radius:8px;padding:9px 10px;color:${endTime?'#C9A84C':'rgba(255,255,255,0.25)'};font-size:13px;font-weight:${endTime?'700':'400'};cursor:pointer;font-family:inherit;text-align:center;">${endTime||'End'}</button>
                    ${dur ? `<span style="font-size:12px;font-weight:800;color:#C9A84C;white-space:nowrap;min-width:36px;text-align:right;">${dur}</span>` : `<span style="min-width:36px;"></span>`}
                  </div>
                </div>`;
              }).join('')}
              <button onclick="addDraftTask('${fk}')" style="width:100%;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;padding:8px;font-size:12px;color:rgba(255,255,255,0.3);cursor:pointer;font-family:inherit;">+ Add task</button>
            </div>`;
        }).join('')}
        </div>

        <!-- Unscheduled batch steps -->
        <div style="min-width:0;overflow:hidden;">
        ${unscheduledSteps.length > 0 ? `
        <div style="padding:12px 0 0;">
          <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:8px;">UNSCHEDULED BATCH STEPS</div>
          <div style="overflow-y:auto;padding-right:2px;">
            ${unscheduledSteps.map((s, i) => {
              const mins = s.timeBlock||30;
              const timeStr = mins<60?mins+'m':Math.floor(mins/60)+'h'+(mins%60?mins%60+'m':'');
              return `<div class="batch-step-pick" style="border-left:3px solid ${s.hex};flex-direction:column;align-items:stretch;gap:8px;cursor:default;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;">
                    <div style="width:22px;height:22px;border-radius:50%;background:${s.hex};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#000;">${s.stepIdx+1}</div>
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div class="batch-step-pick-name">${s.stepName||'Unnamed step'}</div>
                    <div class="batch-step-pick-batch">${s.batchName} · ⏱ ${timeStr}${s.deadline ? (() => { const dl=new Date(s.deadline); dl.setHours(0,0,0,0); const now=new Date(); now.setHours(0,0,0,0); const d=Math.ceil((dl-now)/86400000); const col=d<=1?'#e74c3c':d<=3?'#e67e22':'rgba(255,255,255,0.4)'; return ` · <span style="color:${col};font-weight:800;">${d<0?'OVERDUE':d===0?'TODAY':d===1?'TOMORROW':d+'d'}</span>`; })() : ''}</div>
                  </div>
                  <button onclick="assignBatchStep(${i})" style="background:${s.hex};border:none;border-radius:8px;padding:9px 16px;color:#000;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;white-space:nowrap;">+ Add</button>
                </div>
                <div id="batch-conflict-${i}" style="display:none;font-size:11px;color:#e74c3c;font-weight:700;"></div>
              </div>`;
            }).join('')}
          </div>
        </div>` : '<div style="padding:12px 0 0;color:rgba(255,255,255,0.2);font-size:13px;font-style:italic;">All steps scheduled ✓</div>'}
        </div>
        </div><!-- end columns -->

        <div style="padding:16px 0 8px;">
          <button class="week-save-btn" style="margin:0;width:100%;" onclick="saveDayPlan('${weekKey}')">Save ${dayLabels[activeDay]}</button>
        </div>

        ${(() => {
          const archived = state.data.archivedTasks || [];
          if (!archived.length) return '';
          const FRONT_NAMES = { tjm: 'TJM', vinted: 'Vinted', notts: 'Notts', _other: 'Other' };
          const isOpen = state.archivedTasksOpen;
          return `
          <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;">
            <button onclick="toggleArchivedTasks()" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:12px 16px;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:space-between;">
              <span>📦 Archived Tasks (${archived.length})</span>
              <span style="font-size:11px;">${isOpen ? '▲ Hide' : '▼ Show'}</span>
            </button>
            ${isOpen ? `
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
              ${archived.map((t, i) => {
                const txt = t.text || '';
                const front = FRONT_NAMES[t.frontKey] || t.frontKey || '';
                const date = t.archivedAt ? new Date(t.archivedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '';
                return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                  <div style="min-width:0;">
                    <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.5);text-decoration:line-through;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${txt}</div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:2px;">${front}${date ? ' · ' + date : ''}</div>
                  </div>
                  <button onclick="restoreArchivedTask(${i})" style="flex-shrink:0;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.25);border-radius:8px;padding:6px 12px;color:#2ecc71;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;">↩ Restore</button>
                </div>`;
              }).join('')}
            </div>` : ''}
          </div>`;
        })()}

      </div>
      ${state.taskDeleteConfirm ? `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;" onclick="if(event.target===this)cancelRemoveDraftTask()">
        <div style="background:#141e30;border:1px solid rgba(255,255,255,0.14);border-radius:18px;padding:26px 22px;max-width:340px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
          <div style="font-size:19px;font-weight:900;color:#fff;margin-bottom:8px;">Remove task?</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:22px;line-height:1.55;">"${state.taskDeleteConfirm.text.replace(/"/g,'&quot;')}" will be moved to your task archive — not deleted permanently.</div>
          <div style="display:flex;gap:10px;">
            <button onclick="confirmRemoveDraftTask()" style="flex:1;background:#e74c3c;border:none;border-radius:11px;padding:14px;color:#fff;font-size:15px;font-weight:900;cursor:pointer;font-family:inherit;">Archive Task</button>
            <button onclick="cancelRemoveDraftTask()" style="flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);border-radius:11px;padding:14px;color:rgba(255,255,255,0.65);font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
          </div>
        </div>
      </div>` : ''}`;
}

export function renderTimePickerModal({state}) {
      const { fk, ti, field, hour, minute } = state.timePickerOpen;
      const hours = Array.from({length:24}, (_,i) => String(i).padStart(2,'0'));
      const minutes = ['00','05','10','15','20','25','30','35','40','45','50','55'];
      const ITEM_H = 52; // px per item

      const hIdx = hours.indexOf(hour);
      const mIdx = minutes.indexOf(minute);

      return `<div class="tp-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:20px;" onclick="if(event.target===this)closeTimePicker()">
        <div class="tp-modal" style="background:#181818;border:1px solid rgba(201,168,76,0.2);border-radius:24px;width:100%;max-width:380px;" onclick="event.stopPropagation()">
          <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:12px auto 0;"></div>

          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.07);">
            <div>
              <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(201,168,76,0.6);">${field==='start'?'START TIME':'END TIME'}</div>
              <div style="font-size:28px;font-weight:800;color:#C9A84C;letter-spacing:-0.5px;margin-top:2px;" id="tp-display">${hour}:${minute}</div>
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="closeTimePicker()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 18px;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
              <button id="tp-set-btn" onclick="confirmTimePicker()" style="background:#C9A84C;border:none;border-radius:12px;padding:10px 20px;color:#000;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">Set</button>
            </div>
          </div>
          <div id="tp-conflict" style="display:none;padding:8px 20px;font-size:12px;font-weight:700;color:#e74c3c;"></div>

          <!-- Picker drums -->
          <div style="position:relative;display:flex;align-items:center;height:${ITEM_H*5}px;padding:0 20px;margin-top:4px;">
            <!-- Highlight bar -->
            <div style="position:absolute;left:20px;right:20px;top:50%;transform:translateY(-50%);height:${ITEM_H}px;background:rgba(201,168,76,0.1);border-top:1.5px solid rgba(201,168,76,0.35);border-bottom:1.5px solid rgba(201,168,76,0.35);border-radius:10px;pointer-events:none;z-index:1;"></div>
            <!-- Top fade -->
            <div style="position:absolute;left:20px;right:20px;top:0;height:${ITEM_H*2}px;background:linear-gradient(to bottom,#181818 10%,transparent);pointer-events:none;z-index:2;border-radius:14px 14px 0 0;"></div>
            <!-- Bottom fade -->
            <div style="position:absolute;left:20px;right:20px;bottom:0;height:${ITEM_H*2}px;background:linear-gradient(to top,#181818 10%,transparent);pointer-events:none;z-index:2;border-radius:0 0 14px 14px;"></div>

            <!-- Hours column -->
            <div id="tp-hours" style="flex:1;height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;"
              onscroll="onTpScroll(this,'hour')">
              <div style="height:${ITEM_H*2}px;"></div>
              ${hours.map(h => `<div data-val="${h}" style="height:${ITEM_H}px;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;font-size:22px;font-weight:700;color:rgba(255,255,255,0.45);transition:color 0.15s,font-size 0.15s;font-family:inherit;" id="tph-${h}">${h}</div>`).join('')}
              <div style="height:${ITEM_H*2}px;"></div>
            </div>

            <div style="font-size:28px;font-weight:800;color:rgba(201,168,76,0.5);padding:0 12px;position:relative;z-index:3;">:</div>

            <!-- Minutes column -->
            <div id="tp-mins" style="flex:1;height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;"
              onscroll="onTpScroll(this,'minute')">
              <div style="height:${ITEM_H*2}px;"></div>
              ${minutes.map(m => `<div data-val="${m}" style="height:${ITEM_H}px;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;font-size:22px;font-weight:700;color:rgba(255,255,255,0.45);transition:color 0.15s,font-size 0.15s;font-family:inherit;" id="tpm-${m}">${m}</div>`).join('')}
              <div style="height:${ITEM_H*2}px;"></div>
            </div>
          </div>

          <div id="tp-init" data-hIdx="${hIdx}" data-mIdx="${mIdx}" data-hour="${hour}" data-minute="${minute}" style="display:none;"></div>
        </div>
      </div>`;
    
}

export function renderWeekPlanModal({state, getProjectFronts}) {
      if (!state.weekPlanModal) return '';
      const key = state.weekPlanModal;
      const fronts = getProjectFronts();
      const f = fronts[key] || { name: key, weekPlans: {} };
      const weekKey = isSunday() ? getNextWeekKey() : getWeekKey();
      const todayKey = getTodayDayKey();
      const plan = state.weekPlanDraft || f.weekPlans?.[weekKey] || {};
      const days = ['mon','tue','wed','thu','fri','sat','sun'];
      const labels = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };

      // ── Monthly objectives reference panel ──────────────────────────────
      const now = new Date();
      const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
      const monthObjs = state.data?.monthObjectives?.[monthKey] || [];
      const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const monthLabel = MONTH_NAMES[now.getMonth()] + ' ' + now.getFullYear();
      const CAT_COLOURS = { tjm:'#C9A84C', vinted:'#27ae60', notts:'#3498db', other:'#9b59b6' };
      const CAT_LABELS  = { tjm:'TJM', vinted:'Vinted', notts:'Nottingham', other:'Other' };
      const isObjPanelOpen = state.weekPlanObjPanelOpen || false;

      const monthObjsHtml = monthObjs.length === 0
        ? `<div style="font-size:12px;font-style:italic;color:rgba(255,255,255,0.3);padding:8px 0;">No monthly objectives set for ${monthLabel}</div>`
        : monthObjs.map(obj => {
            const catColour = CAT_COLOURS[obj.category] || '#C9A84C';
            const catLabel  = obj.categoryCustom || CAT_LABELS[obj.category] || 'Other';
            const nowD = new Date(); nowD.setHours(0,0,0,0);
            const daysLeft = obj.deadline ? Math.ceil((new Date(obj.deadline+'T00:00:00') - nowD) / 86400000) : null;
            const isOverdue = daysLeft !== null && daysLeft < 0 && !obj.done;
            return `<div class="wp-month-obj-item" style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.07);">
              <div style="width:14px;height:14px;flex-shrink:0;margin-top:2px;border-radius:3px;border:1.5px solid ${obj.done?'rgba(46,204,113,0.6)':catColour+'55'};background:${obj.done?'rgba(46,204,113,0.15)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:${obj.done?'#2ecc71':catColour};">${obj.done?'✓':''}</div>
              <div style="flex:1;min-width:0;">
                <div class="wp-month-obj-text" style="font-size:13px;font-weight:700;color:${obj.done?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.9)'};${obj.done?'text-decoration:line-through;':''}line-height:1.3;">${obj.text}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
                  <span class="wp-month-obj-cat" style="font-size:9px;font-weight:900;letter-spacing:0.8px;color:${catColour};">${catLabel.toUpperCase()}</span>
                  ${obj.deadline ? `<span style="font-size:9px;font-weight:700;color:${isOverdue?'#e74c3c':obj.done?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.35)'};">${isOverdue?'⚠ OVERDUE':daysLeft===0?'DUE TODAY':daysLeft===1?'DUE TOMORROW':daysLeft+'d left'}</span>` : ''}
                  ${obj.done ? `<span style="font-size:9px;font-weight:900;color:#2ecc71;">DONE</span>` : ''}
                </div>
              </div>
            </div>`;
          }).join('');

      const monthObjPanel = `
        <div class="wp-month-obj-panel" style="margin-bottom:14px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;">
          <button class="wp-month-obj-toggle" onclick="window.toggleWpObjPanel()" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:rgba(255,255,255,0.04);border:none;cursor:pointer;font:inherit;color:rgba(255,255,255,0.75);text-align:left;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);">Monthly Objectives</span>
              <span style="font-size:10px;font-weight:900;color:#C9A84C;">${monthLabel.toUpperCase()}</span>
              ${monthObjs.length > 0 ? `<span style="font-size:10px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:20px;padding:2px 8px;color:#C9A84C;font-weight:900;">${monthObjs.filter(o=>o.done).length}/${monthObjs.length}</span>` : ''}
            </div>
            <span style="font-size:14px;color:rgba(255,255,255,0.4);transition:transform 0.2s;${isObjPanelOpen?'transform:rotate(180deg)':''}">▾</span>
          </button>
          ${isObjPanelOpen ? `<div style="padding:4px 14px 10px;">${monthObjsHtml}</div>` : ''}
        </div>`;

      return `<div class="week-plan-overlay" onclick="closeWeekPlan(event)">
        <div class="week-plan-modal" onclick="event.stopPropagation()">
          <div class="week-plan-handle"></div>
          <div class="week-plan-header">
            <div class="week-plan-project">${f.name.toUpperCase()} · WEEK PLAN</div>
            <div class="week-plan-title">${isSunday() ? 'Planning Next Week' : 'This Week'}</div>
          </div>
          ${monthObjPanel}
          ${days.map(d => `
            <div class="week-day-row">
              <div class="week-day-label">
                ${labels[d]}${d === todayKey && !isSunday() ? ` <span class="week-day-today-dot"></span> TODAY` : ''}
              </div>
              <textarea class="week-day-input ${d === todayKey && !isSunday() ? 'today-input' : ''}"
                rows="2" id="wp-${d}" placeholder="What's the move on ${labels[d]}?">${plan[d] || ''}</textarea>
            </div>`).join('')}
          <button class="week-save-btn" onclick="saveWeekPlan('${key}')">Lock In Week Plan</button>
        </div>
      </div>`;
    
}

// ── CRM Modals ─────────────────────────────────────────────────────────────
export function renderDatePickerModal({ state }) {
  const id = state.crmDatePicker;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = [];
  for (let i = 1; i <= 60; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    days.push({ label: d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear(), value: d.toISOString().split('T')[0] });
  }
  const itemsHtml = days.map((d, idx) =>
    `<div class="scroll-picker-item" id="dpitem-${idx}" data-val="${d.value}" onclick="pickScrollDate('${id}','${d.value}')">${d.label}</div>`
  ).join('');
  return `<div class="crm-date-picker-overlay" onclick="closeCRMDatePicker()">
    <div class="crm-date-picker-modal" onclick="event.stopPropagation()">
      <div class="crm-date-picker-header">
        <button class="crm-date-picker-cancel" onclick="closeCRMDatePicker()">Cancel</button>
        <div class="crm-date-picker-title">Follow-up Date</div>
        <button style="background:none;border:none;color:#D4AF37;font-size:14px;font-weight:600;cursor:pointer;" onclick="confirmScrollDate('${id}')">Done</button>
      </div>
      <div class="crm-date-options" style="margin-bottom:16px;">
        <button class="crm-date-option" onclick="setCRMFollowUp('${id}', 1)">Tomorrow</button>
        <button class="crm-date-option" onclick="setCRMFollowUp('${id}', 3)">+3 Days</button>
        <button class="crm-date-option" onclick="setCRMFollowUp('${id}', 7)">+1 Week</button>
        <button class="crm-date-option" onclick="setCRMFollowUp('${id}', 14)">+2 Weeks</button>
      </div>
      <div style="font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.3);text-align:center;margin-bottom:4px;">OR SCROLL TO PICK A DATE</div>
      <div class="scroll-picker-wrap">
        <div class="scroll-picker-fade-top"></div>
        <div class="scroll-picker-highlight"></div>
        <div class="scroll-picker-fade-bot"></div>
        <div class="scroll-picker-list" id="scrollPickerList">${itemsHtml}</div>
      </div>
    </div>
  </div>`;
}

export function renderSoldModal({ state }) {
  const id = state.crmSoldModal;
  return `<div class="crm-sold-overlay" onclick="closeSoldModal()">
    <div class="crm-sold-modal" onclick="event.stopPropagation()">
      <div class="crm-sold-title">🎉 Mark as Sold</div>
      <div class="crm-sold-sub">Enter the sale details to record this win</div>
      <div class="crm-sold-field"><label class="crm-sold-label">JEWELLERY ITEM</label><input class="crm-sold-input" id="sold-item" placeholder="e.g. Sterling Silver Pendant" oninput="updateSoldProfit()"></div>
      <div class="crm-sold-field"><label class="crm-sold-label">SALE PRICE (£)</label><input class="crm-sold-input" id="sold-price" type="number" placeholder="e.g. 69.99" oninput="updateSoldProfit()"></div>
      <div class="crm-sold-field"><label class="crm-sold-label">COST OF GOODS (£)</label><input class="crm-sold-input" id="sold-cog" type="number" placeholder="e.g. 12.00" oninput="updateSoldProfit()"></div>
      <div class="crm-sold-profit"><span class="crm-sold-profit-label">PROFIT</span><span class="crm-sold-profit-value" id="sold-profit-display">£—</span></div>
      <button class="crm-sold-confirm" onclick="confirmSold('${id}')">✓ Confirm Sale</button>
      <button class="crm-sold-cancel" onclick="closeSoldModal()">Cancel</button>
    </div>
  </div>`;
}
