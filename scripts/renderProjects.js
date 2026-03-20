export function renderVintedTab(deps) {
  const {
    state,
    VINTED_STAGES,
    getVintedItems,
    getNottinghamData,
    getProjectFronts,
    getWeekKey,
    isSunday,
    getNextWeekKey,
    getTodayDayKey
  } = deps;
      const items = getVintedItems();
      const stageGroups = {};
      VINTED_STAGES.forEach(s => stageGroups[s] = []);
      items.forEach(item => { const s = item.stage || VINTED_STAGES[0]; if (stageGroups[s]) stageGroups[s].push(item); });
      const totalActive = items.filter(i => i.stage !== 'Sold / Awaiting Ship').length;
      const totalListed = stageGroups['Listed'].length;
      const totalSold = stageGroups['Sold / Awaiting Ship'].length;
      return `
        <div class="vinted-header">
          <div class="vinted-title">Vinted Pipeline</div>
          <div class="vinted-subtitle">Move items through stages to track progress</div>
        </div>
        <div class="vinted-summary">
          <div class="vinted-sum-card"><div class="vinted-sum-val">${totalActive}</div><div class="vinted-sum-lbl">In Pipeline</div></div>
          <div class="vinted-sum-card"><div class="vinted-sum-val">${totalListed}</div><div class="vinted-sum-lbl">Listed</div></div>
          <div class="vinted-sum-card"><div class="vinted-sum-val">${totalSold}</div><div class="vinted-sum-lbl">Sold</div></div>
        </div>
        <div class="vinted-add-row">
          <input class="vinted-add-input" id="vinted-new-item" placeholder='Add item (e.g. Gold Chain 18")'>
          <button class="vinted-add-submit" onclick="addVintedItem()">Add</button>
        </div>
        <div class="vinted-columns">
          ${VINTED_STAGES.map(stage => {
            const stageItems = stageGroups[stage] || [];
            const stageIdx = VINTED_STAGES.indexOf(stage);
            const isLast = stageIdx === VINTED_STAGES.length - 1;
            return `
              <div class="vinted-column">
                <div class="vinted-col-header">
                  <div class="vinted-col-name">${stage}</div>
                  <div class="vinted-col-count">${stageItems.length}</div>
                </div>
                ${stageItems.length === 0 ? `<div style="font-size:12px;color:rgba(255,255,255,0.15);padding:8px 2px;font-style:italic;">Empty</div>` : ''}
                ${stageItems.map(item => `
                  <div class="vinted-item">
                    <div class="vinted-item-name">${item.name}</div>
                    <div class="vinted-item-actions">
                      ${stageIdx > 0 ? `<button class="vinted-back-btn" onclick="moveVintedItem('${item.id}',-1)">←</button>` : ''}
                      ${!isLast ? `<button class="vinted-advance-btn" onclick="moveVintedItem('${item.id}',1)">${stageIdx === VINTED_STAGES.length-2 ? '✓ Sold' : 'Advance →'}</button>` : ''}
                      <button class="vinted-delete-btn" onclick="deleteVintedItem('${item.id}')">✕</button>
                    </div>
                  </div>`).join('')}
              </div>`;
          }).join('')}
        </div>`;
    }

export function renderNottinghamTab(deps) {
  const {
    state,
    VINTED_STAGES,
    getVintedItems,
    getNottinghamData,
    getProjectFronts,
    getWeekKey,
    isSunday,
    getNextWeekKey,
    getTodayDayKey
  } = deps;
      const data = getNottinghamData();
      const tasks = data.tasks || [];
      return `
        <div class="vinted-header">
          <div class="vinted-title">Nottingham Insurance</div>
          <div class="vinted-subtitle">nottinghaminsurance.co.uk</div>
        </div>
        <div class="cc-section-title">Project Goal</div>
        ${state.nottsGoalEditing ? `
          <div class="cc-card" style="padding:16px;margin-bottom:16px;">
            <textarea class="identity-edit-area" rows="4" id="notts-goal-input">${data.goal || ''}</textarea>
            <div style="display:flex;gap:8px;">
              <button class="identity-save-btn" onclick="saveNottsGoal()">Save</button>
              <button class="identity-edit-btn" onclick="cancelNottsGoal()">Cancel</button>
            </div>
          </div>` : `
          <div class="cc-card notts-goal-card" style="margin-bottom:16px;">
            <div class="notts-goal-label">OVERALL GOAL</div>
            <div class="notts-goal-text">${data.goal || 'Tap edit to set your project goal.'}</div>
            <button class="notts-edit-btn" onclick="editNottsGoal()">✎ Edit Goal</button>
          </div>`}
        <div class="cc-section-title">Task Checklist</div>
        <div class="cc-card notts-task-card">
          ${tasks.length === 0 ? `<div style="font-size:13px;color:rgba(255,255,255,0.2);padding:8px 0;font-style:italic;">No tasks yet — add one below</div>` : ''}
          ${tasks.map((t,i) => `
            <div class="notts-task-row">
              <div class="notts-check ${t.done?'done':''}" onclick="toggleNottsTask(${i})">${t.done?'✓':''}</div>
              <div class="notts-task-text ${t.done?'done':''}">${t.text}</div>
              <button onclick="deleteNottsTask(${i})" style="background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;font-size:14px;padding:0 4px;">✕</button>
            </div>`).join('')}
          <div class="notts-add-row" style="margin-top:12px;">
            <input class="notts-add-input" id="notts-task-input" placeholder="Add a task..." onkeydown="if(event.key==='Enter')addNottsTask()">
            <button class="notts-add-submit" onclick="addNottsTask()">Add</button>
          </div>
        </div>`;
    }
