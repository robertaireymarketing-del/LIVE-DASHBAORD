export function renderRetentionModal(deps) {
  const { state, getStreak, RETENTION_SCIENCE } = deps;

  function getScienceForDay(day) {
    return RETENTION_SCIENCE.find(s => day >= s.range[0] && day <= s.range[1]) || RETENTION_SCIENCE[RETENTION_SCIENCE.length - 1];
  }


      if (!state.retentionModal) return '';
      const streak = getStreak('retention');
      const viewDay = state.retentionViewDay !== null ? state.retentionViewDay : streak;
      const isFutureDay = viewDay > streak;
      const science = getScienceForDay(viewDay);
      const expanded = state.retentionExpanded || false;
      const feelings = state.retentionFeelings || { energy:5, focus:5, mood:5, confidence:5, libido:5, notes:'' };
      const history = Object.entries(state.data.retentionLog || {}).sort((a,b) => b[0].localeCompare(a[0])).slice(0,10);
      const sliders = [
        {key:'energy', label:'⚡ Energy', emoji:'⚡'},
        {key:'focus', label:'🎯 Focus', emoji:'🎯'},
        {key:'mood', label:'😌 Mood', emoji:'😌'},
        {key:'confidence', label:'🦁 Confidence', emoji:'🦁'},
        {key:'libido', label:'🔥 Libido', emoji:'🔥'}
      ];

      return `<div class="retention-overlay" onclick="closeRetentionModal(event)">
        <div class="retention-modal" onclick="event.stopPropagation()">
          <div class="retention-modal-handle"></div>
          <div class="retention-modal-header">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;">
              <div>
                <div class="retention-modal-day">${isFutureDay ? '🔮 DAY '+viewDay+' · FUTURE INSIGHT' : 'DAY '+viewDay+' · SEMEN RETENTION'}</div>
                <div class="retention-modal-title" style="${isFutureDay?'color:#9b59b6;':''}">${science.title}</div>
                <div class="retention-modal-phase">${science.phase}</div>
              </div>
              <button onclick="closeRetentionModalBtn()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:34px;height:34px;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:12px;line-height:1;">✕</button>
            </div>
            <!-- Day navigation -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;background:rgba(255,255,255,0.04);border-radius:12px;padding:8px 12px;">
              <button onclick="retentionNavDay(-1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 12px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:16px;font-family:inherit;">&lt;</button>
              <div style="text-align:center;">
                <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:2px;">BROWSING DAY</div>
                <div style="font-size:20px;font-weight:800;color:${isFutureDay?'#9b59b6':'#C9A84C'};">${viewDay}</div>
                ${isFutureDay ? `<div style="font-size:10px;color:rgba(155,89,182,0.7);margin-top:1px;">+${viewDay-streak} days from now</div>` : viewDay===streak ? `<div style="font-size:10px;color:rgba(201,168,76,0.6);margin-top:1px;">YOU ARE HERE</div>` : `<div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:1px;">PAST</div>`}
              </div>
              <button onclick="retentionNavDay(1)" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 12px;color:rgba(255,255,255,0.5);cursor:pointer;font-size:16px;font-family:inherit;">&gt;</button>
            </div>
            <!-- Quick jump milestones -->
            <div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px;">
              ${[1,7,14,21,30,60,90].map(d => `<button onclick="retentionJumpDay(${d})" style="flex-shrink:0;padding:5px 10px;border-radius:8px;border:1px solid ${viewDay===d?'rgba(201,168,76,0.5)':d<=streak?'rgba(46,204,113,0.3)':'rgba(155,89,182,0.25)'};background:${viewDay===d?'rgba(201,168,76,0.12)':d<=streak?'rgba(46,204,113,0.06)':'rgba(155,89,182,0.06)'};color:${viewDay===d?'#C9A84C':d<=streak?'#2ecc71':'rgba(155,89,182,0.8)'};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Day ${d}</button>`).join('')}
            </div>
          </div>

          <div class="retention-section">
            <div class="retention-section-title">What's Happening Right Now</div>
            <div class="retention-bullets">
              ${science.bullets.map(b => `<div class="retention-bullet"><span class="retention-bullet-icon">${b.icon}</span><span class="retention-bullet-text">${b.text}</span></div>`).join('')}
            </div>
            <button class="retention-expand-btn" onclick="toggleRetentionExpand()">
              ${expanded ? '▲ Hide Deep Dive' : '▼ The Science — Deep Dive'}
            </button>
            ${expanded ? `<div class="retention-deep-dive"><div class="retention-deep-text">${science.deep}</div></div>` : ''}
          </div>

          <div class="retention-divider"></div>

          ${isFutureDay ? `
          <div class="retention-section">
            <div style="background:rgba(155,89,182,0.08);border:1px solid rgba(155,89,182,0.2);border-radius:14px;padding:16px;text-align:center;">
              <div style="font-size:20px;margin-bottom:8px;">🔮</div>
              <div style="font-size:13px;font-weight:700;color:rgba(155,89,182,0.9);margin-bottom:6px;">This is your Day ${viewDay}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);line-height:1.6;">You're currently on Day ${streak}. Keep going and you'll unlock this phase in <strong style="color:rgba(155,89,182,0.8);">${viewDay-streak} day${viewDay-streak===1?'':'s'}</strong>.</div>
            </div>
          </div>` : `
          <div class="retention-section">
            <div class="retention-section-title">How Do You Actually Feel Today?</div>
            <div class="slider-group">
              ${sliders.map(s => `
                <div class="slider-row">
                  <div class="slider-label-row">
                    <span class="slider-label">${s.label}</span>
                    <span class="slider-val" id="rv-${s.key}">${feelings[s.key]}/10</span>
                  </div>
                  <input type="range" min="1" max="10" value="${feelings[s.key]}" class="slider-track"
                    oninput="updateRetentionSlider('${s.key}', this.value)">
                </div>`).join('')}
            </div>
            <div style="margin-top:14px;">
              <div class="retention-section-title" style="margin-bottom:8px;">Notes (optional)</div>
              <textarea class="retention-notes" rows="3" placeholder="Anything you want to remember about how today felt..."
                onchange="updateRetentionNote(this.value)">${feelings.notes || ''}</textarea>
            </div>
            <button class="retention-save-btn" onclick="saveRetentionFeelings()">Save Today's Log</button>
          </div>`}

          ${!isFutureDay && history.length > 0 ? `
          <div class="retention-divider"></div>
          <div class="retention-section">
            <div class="retention-section-title">Past Entries</div>
            ${history.map(([date, entry]) => {
              const dayNum = entry.streakDay || '?';
              const isEditing = state.retentionEditingDate === date;
              const editData = state.retentionEditDraft || entry;
              return isEditing ? `
                <div class="retention-hist-entry">
                  <div class="retention-hist-date" style="margin-bottom:12px;">DAY ${dayNum} · ${date} <span style="color:#C9A84C;">— Editing</span></div>
                  ${['energy','focus','mood','confidence','libido'].map(k => `
                    <div class="slider-row" style="margin-bottom:10px;">
                      <div class="slider-label-row">
                        <span class="slider-label">${k.charAt(0).toUpperCase()+k.slice(1)}</span>
                        <span class="slider-val" id="re-${date}-${k}">${editData[k]||5}/10</span>
                      </div>
                      <input type="range" min="1" max="10" value="${editData[k]||5}" class="slider-track"
                        oninput="updateRetentionEditSlider('${date}','${k}',this.value)">
                    </div>`).join('')}
                  <textarea class="retention-notes" rows="2" placeholder="Notes..."
                    onchange="updateRetentionEditNote('${date}',this.value)">${editData.notes||''}</textarea>
                  <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="retention-save-btn" style="margin-top:0;" onclick="saveRetentionEdit('${date}')">Save Changes</button>
                    <button onclick="state.retentionEditingDate=null;render();" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 16px;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
                  </div>
                </div>` : `
                <div class="retention-hist-entry">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div class="retention-hist-date">DAY ${dayNum} · ${date}</div>
                    <button onclick="editRetentionLog('${date}')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);cursor:pointer;font-family:inherit;">✎ Edit</button>
                  </div>
                  <div class="retention-hist-bars">
                    ${['energy','focus','mood','confidence','libido'].map(k => `
                      <div class="retention-hist-bar">
                        <div style="height:40px;display:flex;align-items:flex-end;width:100%;">
                          <div class="retention-hist-bar-fill" style="height:${(entry[k]||5)*10}%;min-height:4px;"></div>
                        </div>
                        <div class="retention-hist-bar-lbl">${k.slice(0,3).toUpperCase()}</div>
                        <div style="font-size:9px;color:rgba(212,175,55,0.7);font-weight:700;">${entry[k]||5}</div>
                      </div>`).join('')}
                  </div>
                  ${entry.notes ? `<div class="retention-hist-notes">"${entry.notes}"</div>` : ''}
                </div>`;
            }).join('')}
          </div>` : ''}
        </div>
      </div>`;
    
}

export function renderPastDaysModal(deps) {
  const { state, getToday } = deps;

  function normalizeDateKey(key) {
    if (!key) return '';
    const str = String(key).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const simple = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (simple) {
      const [, y, m, d] = simple;
      return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    const isoLike = str.match(/^(\d{4}-\d{1,2}-\d{1,2})/);
    if (isoLike) return normalizeDateKey(isoLike[1]);
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return str;
  }

      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const today  = getToday();
      // Collect the last 60 days that have any data, most recent first — normalise keys first
      const allDays = Object.entries(state.data?.days || {})
        .map(([d, v]) => [normalizeDateKey(d), v])
        .filter(([d]) => d && d < today)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 60); // cap at 60 days back

      // Group into weeks
      function getWeekLabel(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = d.getDay();
        const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mon = new Date(d); mon.setDate(d.getDate() - daysToMon);
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        const fmt = dt => `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
        return `${fmt(mon)} – ${fmt(sun)}`;
      }

      // Group days into weeks
      const weeks = [];
      const seenWeeks = {};
      allDays.forEach(([dateStr, dayData]) => {
        const wl = getWeekLabel(dateStr);
        if (!seenWeeks[wl]) { seenWeeks[wl] = []; weeks.push({ label: wl, days: seenWeeks[wl] }); }
        seenWeeks[wl].push([dateStr, dayData]);
      });

      const noData = allDays.length === 0;

      const habitIcons = { gym:'🏋️', retention:'🩸', meditation:'🧘', live:'📷' };

      // Helper: get weekKey (Mon ISO date) and dayKey from a dateStr
      function getWeekKeyAndDayKey(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const dow = d.getDay(); // 0=Sun
        const daysToMon = dow === 0 ? 6 : dow - 1;
        const mon = new Date(d); mon.setDate(d.getDate() - daysToMon);
        const wk = mon.toISOString().slice(0,10);
        const dk = ['sun','mon','tue','wed','thu','fri','sat'][dow];
        return { wk, dk };
      }

      // Build sorted health array once for delta lookups
      const sortedHealth = [...(state.healthData||[])].sort((a,b)=>a.date.localeCompare(b.date));

      const weekHTML = weeks.map(week => {
        const daysHTML = week.days.map(([dateStr, d]) => {
          const dateObj  = new Date(dateStr + 'T12:00:00');
          const dayLabel = `${DAYS[dateObj.getDay()]} ${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]}`;
          const habits = Object.entries(habitIcons).filter(([k]) => d[k]).map(([,v]) => v).join(' ');
          const objs = (d.objectives || []).filter(o => o.text);
          const syncEntry = sortedHealth.find(h => h.date === dateStr);
          const ov = d._overridden || {};

          // Overrides take precedence; fall back to day data (never trust d[k] if it was mutated)
          // For sales/leads: use override if present, else raw day field
          const sales      = ov.sales      !== undefined ? ov.sales      : (d.sales      || 0);
          const revenue    = ov.revenue    !== undefined ? ov.revenue    : (d.revenue    || 0);
          const warmLeads  = ov.warmLeads  !== undefined ? ov.warmLeads  : (d.warmLeads  || 0);
          const dmsSent    = ov.dmsSent    !== undefined ? ov.dmsSent    : (d.dmsSent    || 0);
          const dispWeight = ov.weight     !== undefined ? ov.weight     : syncEntry?.weight;
          const dispBF     = ov.bodyFat    !== undefined ? ov.bodyFat    : syncEntry?.bodyFat;
          const dispCals   = ov.calories   !== undefined ? ov.calories   : syncEntry?.calories;
          const dispBMR    = ov.bmr        !== undefined ? ov.bmr        : syncEntry?.bmr;
          const dispAct    = syncEntry?.gymCalories || 0;
          const hasOverrides = Object.keys(ov).filter(k => k !== '_lastEdited').length > 0;
          const ovMark     = `<span style="font-size:9px;color:#e67e22;margin-left:3px;vertical-align:middle;" title="Manually overridden">✏</span>`;

          // Weight delta vs previous synced day
          const prevSync = sortedHealth.filter(h => h.date < dateStr && h.weight).slice(-1)[0];
          const wtDelta = (dispWeight && prevSync?.weight)
            ? (dispWeight - prevSync.weight) : null;
          const wtDeltaStr = wtDelta !== null
            ? `<span style="color:${wtDelta<=0?'#2ecc71':'#e74c3c'};font-weight:800;margin-left:4px;">(${wtDelta>0?'+':''}${wtDelta.toFixed(1)}lb)</span>` : '';

          // Daily calorie deficit: burn - eaten
          const dayDeficit = (dispBMR || dispCals)
            ? ((dispBMR||0) + dispAct) - (dispCals||0) : null;
          const deficitStr = dayDeficit !== null && dispCals > 0
            ? `<span style="color:${dayDeficit>=0?'#2ecc71':'#e74c3c'};font-weight:800;">${dayDeficit>=0?'−':'+'}${Math.abs(Math.round(dayDeficit)).toLocaleString()} kcal ${dayDeficit>=0?'deficit':'surplus'}</span>` : null;

          // Weekly planner tasks for this day
          const { wk, dk } = getWeekKeyAndDayKey(dateStr);
          const fronts = state.data?.projectFronts || {};
          const frontColors = { tjm:'#C9A84C', vinted:'#3498db', notts:'#2ecc71', _other:'#9b59b6' };
          const frontNames = { tjm:'TJM', vinted:'Vinted', notts:'Notts Insurance', _other:'Other' };
          const plannerTasks = [];
          ['tjm','vinted','notts','_other'].forEach(fk => {
            const tasks = fronts[fk]?.weekPlans?.[wk]?.[dk] || [];
            tasks.forEach(t => {
              const text = typeof t === 'object' ? t.text : t;
              if (text && text.trim()) plannerTasks.push({ text: text.trim(), front: fk });
            });
          });
          // Batch steps for this day
          const batchSteps = (state.data?.dayBatchPlan?.[wk]?.[dk]?._batch || []);

          return `
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,${hasOverrides?'0.18':'0.07'});border-radius:14px;padding:14px 16px;margin-bottom:10px;">

              <!-- Header: date + habits + edit emoji -->
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div style="font-size:14px;font-weight:900;color:#D4AF37;">${dayLabel}</div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="font-size:15px;">${habits || ''}</div>
                  <button onclick="${state.pastDayEditing===dateStr?'closePastDayEdit()':'openPastDayEdit(\''+dateStr+'\')'}" style="background:${state.pastDayEditing===dateStr?'rgba(230,126,34,0.2)':'rgba(255,255,255,0.05)'};border:1px solid ${state.pastDayEditing===dateStr?'rgba(230,126,34,0.4)':'rgba(255,255,255,0.1)'};border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;flex-shrink:0;" title="${hasOverrides?'Figures overridden — tap to edit':'Tap to override figures'}">${hasOverrides?'✏️':'📝'}</button>
                </div>
              </div>

              <!-- Sales + Leads row -->
              ${(sales || revenue || warmLeads || dmsSent) ? `
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px;">
                ${(sales || revenue) ? `<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,${(ov.sales!==undefined||ov.revenue!==undefined)?'0.5':'0.2'});border-radius:8px;padding:7px 10px;">
                  <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(201,168,76,0.6);margin-bottom:2px;">SALES${(ov.sales!==undefined||ov.revenue!==undefined)?ovMark:''}</div>
                  <div style="font-size:13px;font-weight:800;color:#C9A84C;">${sales} sale${sales!==1?'s':''}${revenue?` · <span style="color:#fff;">£${revenue}</span>`:''}
                  </div></div>` : ''}
                ${warmLeads ? `<div style="background:rgba(52,152,219,0.08);border:1px solid rgba(52,152,219,${ov.warmLeads!==undefined?'0.5':'0.2'});border-radius:8px;padding:7px 10px;">
                  <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(52,152,219,0.6);margin-bottom:2px;">WARM LEADS${ov.warmLeads!==undefined?ovMark:''}</div>
                  <div style="font-size:13px;font-weight:800;color:#3498db;">${warmLeads} lead${warmLeads!==1?'s':''}</div>
                </div>` : ''}
                ${dmsSent ? `<div style="background:rgba(155,89,182,0.08);border:1px solid rgba(155,89,182,${ov.dmsSent!==undefined?'0.5':'0.2'});border-radius:8px;padding:7px 10px;">
                  <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(155,89,182,0.6);margin-bottom:2px;">DMs SENT${ov.dmsSent!==undefined?ovMark:''}</div>
                  <div style="font-size:13px;font-weight:800;color:#9b59b6;">${dmsSent} DM${dmsSent!==1?'s':''}</div>
                </div>` : ''}
              </div>` : ''}

              <!-- Health row -->
              ${(syncEntry || ov.weight !== undefined || ov.bodyFat !== undefined) ? `
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,${(ov.weight!==undefined||ov.bodyFat!==undefined||ov.calories!==undefined||ov.bmr!==undefined)?'0.15':'0.07'});border-radius:8px;padding:8px 10px;margin-bottom:${(objs.length||plannerTasks.length||batchSteps.length)?'10px':'0'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                  <div style="font-size:12px;color:rgba(255,255,255,0.5);">
                    ${dispWeight ? `⚖️ <span style="color:#fff;font-weight:700;">${dispWeight.toFixed(1)}lb</span>${ov.weight!==undefined?ovMark:''}${wtDeltaStr}` : ''}
                    ${dispBF ? `<span style="margin-left:8px;">🔬 <span style="font-weight:700;">${dispBF.toFixed(1)}%</span>${ov.bodyFat!==undefined?ovMark:''}</span>` : ''}
                  </div>
                  ${deficitStr ? `<div style="font-size:11px;">${deficitStr}${(ov.calories!==undefined||ov.bmr!==undefined)?ovMark:''}</div>` : ''}
                </div>
              </div>` : ''}

              <!-- Today-view objectives -->
              ${objs.length ? `
              <div style="margin-bottom:${(plannerTasks.length||batchSteps.length)?'8px':'0'};">
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.25);margin-bottom:5px;">TODAY TASKS</div>
                <div style="display:flex;flex-direction:column;gap:3px;">
                  ${objs.map(o=>`<div style="font-size:12px;color:${o.done?'rgba(46,204,113,0.8)':'rgba(255,255,255,0.35)'};display:flex;align-items:flex-start;gap:6px;"><span style="flex-shrink:0;margin-top:1px;">${o.done?'✓':'○'}</span><span style="${o.done?'text-decoration:line-through;':''}">${o.text}</span></div>`).join('')}
                </div>
              </div>` : ''}

              <!-- Weekly planner tasks -->
              ${plannerTasks.length ? `
              <div style="margin-bottom:${batchSteps.length?'8px':'0'};">
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.25);margin-bottom:5px;">PLANNED TASKS</div>
                <div style="display:flex;flex-direction:column;gap:3px;">
                  ${plannerTasks.map(t=>`<div style="font-size:12px;color:rgba(255,255,255,0.5);display:flex;align-items:flex-start;gap:6px;"><span style="width:6px;height:6px;border-radius:50%;background:${frontColors[t.front]};flex-shrink:0;margin-top:4px;"></span><span>${t.text}</span></div>`).join('')}
                </div>
              </div>` : ''}

              <!-- Batch steps -->
              ${batchSteps.length ? `
              <div style="margin-bottom:10px;">
                <div style="font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.25);margin-bottom:5px;">BATCH STEPS</div>
                <div style="display:flex;flex-direction:column;gap:3px;">
                  ${batchSteps.map(s=>`<div style="font-size:12px;color:${s.done?'rgba(46,204,113,0.7)':'rgba(255,255,255,0.4)'};display:flex;align-items:flex-start;gap:6px;"><span style="flex-shrink:0;margin-top:1px;">${s.done?'✓':'○'}</span><span style="${s.done?'text-decoration:line-through;':''}">${s.stepName||s.name||'Step'}</span></div>`).join('')}
                </div>
              </div>` : ''}

              <!-- Edit / Override toggle -->
              ${(() => {
                const ov = d._overridden || {};
                const hasOverrides = Object.keys(ov).length > 0;
                const isEditing = state.pastDayEditing === dateStr;
                const ovBadge = hasOverrides ? `<span style="font-size:9px;font-weight:800;color:#e67e22;background:rgba(230,126,34,0.15);border:1px solid rgba(230,126,34,0.3);border-radius:10px;padding:2px 7px;margin-left:6px;">✏ EDITED</span>` : '';
                if (isEditing) {
                  const syncW  = syncEntry?.weight;
                  const syncBF = syncEntry?.bodyFat;
                  const syncCal= syncEntry?.calories;
                  const syncBMR= syncEntry?.bmr;
                  // coloured chip field: accent colour, label, field key, current value, step
                  const chip = (accent, label, key, val, step='1') => {
                    const isOv = ov[key] !== undefined;
                    return `<div style="background:${accent}12;border:1.5px solid ${isOv ? accent : accent+'44'};border-radius:10px;padding:10px 12px;position:relative;">
                      <div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:${accent};margin-bottom:6px;display:flex;align-items:center;gap:4px;">${label}${isOv?`<span style="font-size:9px;background:${accent}22;border-radius:8px;padding:1px 5px;">✏ EDITED</span>`:''}</div>
                      <input id="pdov-${dateStr}-${key}" type="number" step="${step}" value="${val!==null&&val!==undefined?val:''}" placeholder="—"
                        style="width:100%;background:transparent;border:none;border-bottom:1.5px solid ${accent}55;padding:4px 0 3px;color:#fff;font-size:16px;font-weight:800;font-family:inherit;outline:none;box-sizing:border-box;">
                    </div>`;
                  };
                  return `
                    <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;margin-top:8px;">
                      <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:#e67e22;margin-bottom:10px;">✏ OVERRIDE VALUES</div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                        ${chip('#C9A84C','SALES',       'sales',     d.sales,     '1')}
                        ${chip('#C9A84C','REVENUE (£)', 'revenue',   d.revenue,   '0.01')}
                        ${chip('#3498db','WARM LEADS',  'warmLeads', d.warmLeads, '1')}
                        ${chip('#9b59b6','DMs SENT',    'dmsSent',   d.dmsSent,   '1')}
                        ${chip('#2ecc71','WEIGHT (lb)', 'weight',    ov.weight!==undefined?ov.weight:syncW,      '0.1')}
                        ${chip('#2ecc71','BODY FAT (%)', 'bodyFat',  ov.bodyFat!==undefined?ov.bodyFat:syncBF,  '0.1')}
                        ${chip('#e74c3c','EATEN (kcal)','calories',  ov.calories!==undefined?ov.calories:syncCal,'1')}
                        ${chip('#e67e22','BMR (kcal)',  'bmr',       ov.bmr!==undefined?ov.bmr:syncBMR,         '1')}
                      </div>
                      <div style="display:flex;gap:8px;">
                        <button onclick="savePastDayOverrides('${dateStr}')" style="flex:1;background:#C9A84C;border:none;border-radius:8px;padding:10px;color:#000;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;">Save</button>
                        <button onclick="clearPastDayOverrides('${dateStr}')" style="background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.3);border-radius:8px;padding:10px 12px;color:#e74c3c;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;">Clear All</button>
                        <button onclick="closePastDayEdit()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 12px;color:rgba(255,255,255,0.4);font-size:12px;cursor:pointer;font-family:inherit;">Cancel</button>
                      </div>
                    </div>`;
                } else {
                  return hasOverrides
                    ? `<div style="margin-top:2px;font-size:10px;color:#e67e22;font-weight:700;letter-spacing:0.5px;">✏ ${Object.keys(ov).filter(k=>k!=='_lastEdited').length} field${Object.keys(ov).filter(k=>k!=='_lastEdited').length!==1?'s':''} overridden</div>`
                    : '';
                }
              })()}

            </div>`;
        }).join('');
        return `
          <div style="margin-bottom:6px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.25);padding:8px 0 6px;">WK · ${week.label.toUpperCase()}</div>
            ${daysHTML}
          </div>`;
      }).join('');

      return `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closePastDays()">
          <div class="past-days-modal" style="background:#141414;border:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;width:100%;max-width:480px;height:80vh;display:flex;flex-direction:column;">
            <div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:12px auto 0;flex-shrink:0;"></div>
            <div style="padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(201,168,76,0.7);margin-bottom:3px;">HISTORY</div>
                <div style="font-size:17px;font-weight:800;color:#fff;">Previous Days</div>
              </div>
              <button onclick="closePastDays()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:34px;height:34px;color:rgba(255,255,255,0.6);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="flex:1;overflow-y:auto;padding:12px 16px 32px;">
              ${noData
                ? `<div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,0.25);font-size:13px;font-style:italic;">No past days logged yet</div>`
                : weekHTML}
            </div>
          </div>
        </div>`;
    
}

export function renderMonthTargetsModal(deps) {
  const { state, getMonthTargets } = deps;


      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const now = new Date();
      // Build 4 months: current + next 3
      const months = [];
      for (let i = 0; i < 4; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push({ y: d.getFullYear(), m: d.getMonth(), label: monthNames[d.getMonth()] + ' ' + d.getFullYear() });
      }
      return `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeMonthTargets()">
          <div class="month-targets-modal" style="background:#141414;border:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;padding-bottom:env(safe-area-inset-bottom,16px);">
            <div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:12px auto 0;"></div>
            <div style="padding:20px 20px 8px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(201,168,76,0.7);margin-bottom:4px;">MONTHLY TARGETS</div>
                <div style="font-size:17px;font-weight:800;color:#fff;">Set Goals Per Month</div>
              </div>
              <button onclick="closeMonthTargets()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:34px;height:34px;color:rgba(255,255,255,0.6);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
            </div>
            <div style="padding:16px 20px 24px;display:flex;flex-direction:column;gap:16px;">
              ${months.map(({ y, m, label }) => {
                const t = getMonthTargets(y, m);
                const key = `${y}-${String(m+1).padStart(2,'0')}`;
                const inp = (id, lbl, val, max) => `
                  <div>
                    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);margin-bottom:5px;letter-spacing:0.5px;">${lbl}</div>
                    <input type="number" min="0" max="${max}" value="${val}" id="mt-${key}-${id}"
                      style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;color:#fff;font-size:15px;font-weight:700;text-align:center;font-family:inherit;outline:none;">
                  </div>`;
                return `
                  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:900;letter-spacing:2px;color:rgba(201,168,76,0.75);margin-bottom:12px;">${label.toUpperCase()}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                      ${inp('lives', 'LIVES', t.lives, 31)}
                      ${inp('sales', 'SALES', t.sales, 999)}
                      ${inp('gym', 'GYM DAYS', t.gym, 31)}
                      ${inp('retention', 'RETENTION DAYS', t.retention, 31)}
                    </div>
                    <button onclick="saveMonthTargets('${key}')"
                      style="width:100%;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:11px;color:#C9A84C;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">
                      Save ${label.split(' ')[0]}
                    </button>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    
}

export function renderChallengeModal(deps) {
  const { getSettings, getDayNumber } = deps;


      const settings = getSettings();
      const currentStart = settings.startDate || '2026-03-01';
      const currentDays = settings.challengeDays || 90;
      const presets = [7, 14, 30, 60, 90];
      return `<div class="challenge-overlay" onclick="if(event.target.classList.contains('challenge-overlay'))closeChallengeSetup()">
        <div class="challenge-modal">
          <div class="challenge-handle"></div>
          <div style="padding:20px 20px 16px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:rgba(201,168,76,0.7);margin-bottom:4px;">CHALLENGE SETUP</div>
              <div style="font-size:18px;font-weight:800;color:#fff;">DAY ${getDayNumber()} / ${currentDays}</div>
            </div>
            <button onclick="closeChallengeSetup()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;width:34px;height:34px;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>
          <div style="padding:20px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:10px;">QUICK SELECT</div>
            <div style="display:flex;gap:8px;margin-bottom:20px;">
              ${presets.map(d => `<button onclick="setChallengePreset(${d})" style="flex:1;padding:10px 4px;border-radius:10px;border:1.5px solid ${currentDays===d?'rgba(201,168,76,0.5)':'rgba(255,255,255,0.1)'};background:${currentDays===d?'rgba(201,168,76,0.12)':'rgba(255,255,255,0.04)'};color:${currentDays===d?'#C9A84C':'rgba(255,255,255,0.5)'};font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">${d}d</button>`).join('')}
            </div>
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:8px;">START DATE</div>
            <input type="date" id="challenge-start" value="${currentStart}" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px;color:#fff;font-size:14px;font-family:inherit;outline:none;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:800;letter-spacing:2px;color:rgba(255,255,255,0.3);margin-bottom:8px;">CHALLENGE LENGTH (DAYS)</div>
            <input type="number" id="challenge-days" value="${currentDays}" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px;color:#fff;font-size:14px;font-family:inherit;outline:none;margin-bottom:20px;">
            <button onclick="saveChallengeSetup()" style="width:100%;background:#C9A84C;color:#000;border:none;border-radius:14px;padding:15px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">Save Challenge</button>
          </div>
        </div>
      </div>`;
    
}

