export function initBatchActions(deps) {

const { state, saveData, saveDataQuiet, render } = deps;

let newBatchSteps = [];
let newBatchStepIdx = 0;
let batchSwipeX = 0;
let autoSaveTimer = null;

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveDataQuiet(), 800);
}

function flushEditStep(batchId) {
  const si = state.editBatchStepIdx || 0;
  const b = (state.data.tjmBatches || []).find(b => b.id === batchId);
  if (!b || !b.steps || !b.steps[si]) return;
  const nameEl = document.getElementById(`be-step-name-${batchId}-${si}`);
  const notesEl = document.getElementById(`be-step-notes-${batchId}-${si}`);
  const hidden = document.getElementById(`be-drum-hidden-${batchId}`);
  const deadlineEl = document.getElementById(`be-step-deadline-${batchId}-${si}`);
  if (nameEl) b.steps[si].name = nameEl.value;
  if (notesEl) b.steps[si].notes = notesEl.value;
  if (hidden) b.steps[si].timeBlock = parseInt(hidden.value) || 30;
  if (deadlineEl) b.steps[si].deadline = deadlineEl.value || '';
}

function renderNewStepSlide() {
  const container = document.getElementById('new-steps-slider');
  if (!container) return;
  const total = newBatchSteps.length;
  if (total === 0) { container.innerHTML = ''; return; }
  const si = newBatchStepIdx;
  const s = newBatchSteps[si];
  const drumId = `new-drum-${si}`;
  const hiddenId = `new-drum-hidden-${si}`;
  container.innerHTML = `
<div class="step-editor-nav">
  <button class="step-editor-arrow" onclick="navNewStep(-1)" ${si===0?'disabled':''}>&#8249;</button>
  <div style="text-align:center;">
    <div style="font-size:13px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.7);">STEP ${si+1} OF ${total}</div>
    <div class="step-nav-dots" style="display:flex;gap:5px;margin-top:5px;justify-content:center;">
      ${newBatchSteps.map((_,i)=>`<div class="step-nav-dot${i===si?' active':''}"></div>`).join('')}
    </div>
  </div>
  <button class="step-editor-arrow" onclick="navNewStep(1)" ${si===total-1?'disabled':''}>&#8250;</button>
</div>
<div class="batch-step-item">
  <input class="batch-editor-input" id="new-step-name-${si}" placeholder="Step name"
    value="${(s.name||'').replace(/"/g,'&quot;')}" style="margin-bottom:8px;"
    oninput="syncNewStep(${si},'name',this.value)">
  <div class="batch-editor-label">Time Block</div>
  <div style="margin:6px 0 8px;" id="new-drum-wrap-${si}"></div>
  <input class="batch-editor-input" id="new-step-notes-${si}" placeholder="Notes (optional)"
    value="${(s.notes||'').replace(/"/g,'&quot;')}" oninput="syncNewStep(${si},'notes',this.value)">
  <button class="step-delete-btn" onclick="removeNewBatchStep(${si})">🗑 Delete This Step</button>
</div>`;
  setTimeout(() => {
    const wrap = document.getElementById(`new-drum-wrap-${si}`);
    if (wrap) wrap.innerHTML = window.buildDrum(drumId, hiddenId, s.timeBlock || 30);
    setTimeout(() => window.initDrum(drumId, s.timeBlock || 30), 20);
  }, 20);
}

function renderEditStepSlide(batchId) {
  const b = (state.data.tjmBatches || []).find(b => b.id === batchId);
  if (!b) return;
  const steps = b.steps || [];
  const container = document.getElementById(`be-steps-slider-${batchId}`);
  if (!container) return;
  const si = state.editBatchStepIdx || 0;
  const total = steps.length;
  if (total === 0) {
    container.innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;padding:12px;">No steps yet — tap Add Step below</div>`;
    return;
  }
  const s = steps[si] || {};
  const drumId = `be-drum-${batchId}`;
  const hiddenId = `be-drum-hidden-${batchId}`;
  container.innerHTML = `
<div class="step-editor-nav">
  <button class="step-editor-arrow" onclick="navEditStep('${batchId}',-1)" ${si===0?'disabled':''}>&#8249;</button>
  <div style="text-align:center;">
    <div style="font-size:13px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.7);">STEP ${si+1} OF ${total}</div>
    <div class="step-nav-dots" style="display:flex;gap:5px;margin-top:5px;justify-content:center;">
      ${steps.map((_,i)=>`<div class="step-nav-dot${i===si?' active':''}"></div>`).join('')}
    </div>
  </div>
  <button class="step-editor-arrow" onclick="navEditStep('${batchId}',1)" ${si===total-1?'disabled':''}>&#8250;</button>
</div>
<div class="batch-step-item">
  <input class="batch-editor-input" id="be-step-name-${batchId}-${si}" placeholder="Step name"
    value="${(s.name||'').replace(/"/g,'&quot;')}" style="margin-bottom:8px;"
    oninput="liveEditStep('${batchId}',${si},'name',this.value)">
  <div class="batch-editor-label">Time Block</div>
  <div style="margin:6px 0 8px;" id="be-drum-wrap-${batchId}"></div>
  <div class="batch-editor-label" style="margin-top:4px;">Step Deadline (optional)</div>
  ${b.deadline?`<div style="font-size:11px;color:rgba(231,76,60,0.7);font-weight:700;margin-bottom:4px;">Batch due: ${(d=>{if(!d)return'';const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();})(b.deadline)}</div>`:''}
  <div style="position:relative;cursor:pointer;" onclick="document.getElementById('be-step-deadline-${batchId}-${si}').showPicker&&document.getElementById('be-step-deadline-${batchId}-${si}').showPicker()">
    <input type="date" id="be-step-deadline-${batchId}-${si}" value="${(s.deadline||'').toString()}" max="${b.deadline||''}"
      style="position:absolute;inset:0;opacity:0;cursor:pointer;width:calc(100% - 50px);height:100%;z-index:2;"
      onchange="autoSaveStepDeadline('${batchId}',${si},this.value)">
    <div style="display:flex;gap:8px;align-items:stretch;">
      <div id="be-step-deadline-display-${batchId}-${si}" style="flex:1;padding:11px 14px;background:${s.deadline?'rgba(231,76,60,0.06)':'rgba(255,255,255,0.04)'};border:1px solid ${s.deadline?'rgba(231,76,60,0.25)':'rgba(255,255,255,0.1)'};border-radius:8px;font-size:15px;font-weight:${s.deadline?'800':'400'};color:${s.deadline?'rgba(231,76,60,0.85)':'rgba(255,255,255,0.3)'};pointer-events:none;">
        ${s.deadline?'📅 '+(d=>{const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();})(s.deadline):'Click to set step deadline...'}
      </div>
      ${s.deadline?`<button onclick="event.stopPropagation();autoSaveStepDeadline('${batchId}',${si},'')" style="background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:8px;padding:0 14px;color:#e74c3c;font-size:18px;font-weight:700;cursor:pointer;pointer-events:all;z-index:3;position:relative;">×</button>`:''}
    </div>
  </div>
  <input class="batch-editor-input" id="be-step-notes-${batchId}-${si}" placeholder="Notes (optional)"
    value="${(s.notes||'').replace(/"/g,'&quot;')}" style="margin-top:8px;"
    oninput="liveEditStep('${batchId}',${si},'notes',this.value)">
  <button class="step-delete-btn" onclick="removeBatchStep('${batchId}',${si})">🗑 Delete This Step</button>
</div>`;
  setTimeout(() => {
    const wrap = document.getElementById(`be-drum-wrap-${batchId}`);
    if (wrap) wrap.innerHTML = window.buildDrum(drumId, hiddenId, s.timeBlock || 30);
    setTimeout(() => window.initDrum(drumId, s.timeBlock || 30), 20);
  }, 20);
}

function saveCurrentEditStep(batchId) { flushEditStep(batchId); }

function collectSteps(batchId) {
  saveCurrentEditStep(batchId);
  const b = (state.data.tjmBatches || []).find(b => b.id === batchId);
  return (b?.steps || []).filter(s => s.name);
}

function collectNewSteps() {
  if (newBatchSteps.length > 0) {
    const hidden = document.getElementById(`new-drum-hidden-${newBatchStepIdx}`);
    const nameEl = document.getElementById(`new-step-name-${newBatchStepIdx}`);
    const notesEl = document.getElementById(`new-step-notes-${newBatchStepIdx}`);
    if (hidden && newBatchSteps[newBatchStepIdx]) newBatchSteps[newBatchStepIdx].timeBlock = parseInt(hidden.value) || 30;
    if (nameEl) newBatchSteps[newBatchStepIdx].name = nameEl.value || '';
    if (notesEl) newBatchSteps[newBatchStepIdx].notes = notesEl.value || '';
  }
  return newBatchSteps.filter(s => s.name).map((s,i) => ({
    id: 's'+Date.now()+i, name: s.name, timeBlock: s.timeBlock||30, notes: s.notes||'', completedAt: null
  }));
}

window.liveEditStep = (batchId, si, field, val) => {
  const b = (state.data.tjmBatches || []).find(b => b.id === batchId);
  if (b?.steps?.[si]) b.steps[si][field] = val;
  scheduleAutoSave();
};

window.syncNewStep = (si, field, val) => {
  if (newBatchSteps[si]) newBatchSteps[si][field] = val;
};

window.navNewStep = (dir) => {
  const hidden = document.getElementById(`new-drum-hidden-${newBatchStepIdx}`);
  const nameEl = document.getElementById(`new-step-name-${newBatchStepIdx}`);
  const notesEl = document.getElementById(`new-step-notes-${newBatchStepIdx}`);
  if (hidden && newBatchSteps[newBatchStepIdx]) newBatchSteps[newBatchStepIdx].timeBlock = parseInt(hidden.value) || 30;
  if (nameEl) newBatchSteps[newBatchStepIdx].name = nameEl.value || '';
  if (notesEl) newBatchSteps[newBatchStepIdx].notes = notesEl.value || '';
  newBatchStepIdx = Math.max(0, Math.min(newBatchSteps.length - 1, newBatchStepIdx + dir));
  renderNewStepSlide();
};

window.navEditStep = async (batchId, dir) => {
  flushEditStep(batchId);
  await saveData();
  const b = (state.data.tjmBatches || []).find(b => b.id === batchId);
  const maxIdx = (b?.steps?.length || 1) - 1;
  state.editBatchStepIdx = Math.max(0, Math.min(maxIdx, (state.editBatchStepIdx || 0) + dir));
  renderEditStepSlide(batchId);
};

window.addNewBatchStep = () => {
  const hidden = document.getElementById(`new-drum-hidden-${newBatchStepIdx}`);
  const nameEl = document.getElementById(`new-step-name-${newBatchStepIdx}`);
  const notesEl = document.getElementById(`new-step-notes-${newBatchStepIdx}`);
  if (newBatchSteps.length > 0) {
    if (hidden && newBatchSteps[newBatchStepIdx]) newBatchSteps[newBatchStepIdx].timeBlock = parseInt(hidden.value) || 30;
    if (nameEl) newBatchSteps[newBatchStepIdx].name = nameEl.value || '';
    if (notesEl) newBatchSteps[newBatchStepIdx].notes = notesEl.value || '';
  }
  newBatchSteps.push({ name:'', timeBlock:30, notes:'' });
  newBatchStepIdx = newBatchSteps.length - 1;
  renderNewStepSlide();
};

window.removeNewBatchStep = (si) => {
  newBatchSteps.splice(si, 1);
  newBatchStepIdx = Math.max(0, Math.min(newBatchSteps.length - 1, newBatchStepIdx));
  renderNewStepSlide();
};

window.addBatchStep = (id) => {
  flushEditStep(id);
  const batches = state.data.tjmBatches || [];
  const b = batches.find(b => b.id === id);
  if (!b) return;
  if (!b.steps) b.steps = [];
  b.steps.push({ id:'s'+Date.now(), name:'', timeBlock:30, notes:'', completedAt:null });
  state.data.tjmBatches = batches;
  state.editBatchStepIdx = b.steps.length - 1;
  renderEditStepSlide(id);
};

window.removeBatchStep = async (id, si) => {
  flushEditStep(id);
  const batches = state.data.tjmBatches || [];
  const b = batches.find(b => b.id === id);
  if (!b || !b.steps) return;
  b.steps.splice(si, 1);
  if ((b.currentStepIdx || 0) >= b.steps.length) b.currentStepIdx = Math.max(0, b.steps.length - 1);
  state.data.tjmBatches = batches;
  state.editBatchStepIdx = Math.max(0, Math.min(b.steps.length - 1, si));
  await saveData();
  renderEditStepSlide(id);
};

window.saveBatch = async (id) => {
  flushEditStep(id);
  const allBatches = state.data.tjmBatches || [];
  const idx = allBatches.findIndex(b => b.id === id);
  if (idx === -1) return;
  const projEl = document.getElementById(`be-proj-${id}`);
  const proj = projEl?.dataset?.selected || allBatches[idx].project || 'tjm';
  const steps = collectSteps(id);
  // ── FIX: read deadline directly from state (not DOM) so cleared values are respected ──
  const deadlineVal = allBatches[idx].deadline ?? '';
  allBatches[idx] = { ...allBatches[idx],
    name: document.getElementById(`be-name-${id}`)?.value || allBatches[idx].name,
    project: proj,
    projectCustom: proj==='other' ? (document.getElementById(`be-proj-custom-${id}`)?.value || '') : '',
    status: document.getElementById(`be-status-${id}`)?.value || allBatches[idx].status,
    colour: document.getElementById(`be-colour-hidden-${id}`)?.value || allBatches[idx].colour || 'gold',
    focus: document.getElementById(`be-focus-${id}`)?.value || '',
    deadline: deadlineVal,
    steps,
  };
  state.data.tjmBatches = allBatches;
  state.batchEditing = null;
  await saveData();
  render();
};

window.deleteBatch = async (id) => {
  if (!confirm('Delete this batch? This cannot be undone.')) return;
  state.data.tjmBatches = (state.data.tjmBatches || []).filter(b => b.id !== id);
  await saveData();
  render();
};

window.archiveBatch = async (id) => {
  const batches = state.data.tjmBatches || [];
  const b = batches.find(b => b.id === id);
  if (b) b.status = 'archived';
  state.data.tjmBatches = batches;
  await saveData();
  render();
};

window.startAddBatch = () => { newBatchSteps = []; newBatchStepIdx = 0; state.batchAdding = true; state.batchEditing = null; render(); };
window.cancelAddBatch = () => { state.batchAdding = false; render(); };

window.addNewBatch = async () => {
  const name = document.getElementById('new-batch-name')?.value;
  if (!name) return;
  const proj = document.getElementById('new-batch-proj')?.value || 'tjm';
  const steps = collectNewSteps();
  const newBatch = {
    id: 'b' + Date.now(), name,
    project: proj,
    projectCustom: proj==='other' ? (document.getElementById('new-batch-proj-custom')?.value || '') : '',
    status: document.getElementById('new-batch-status')?.value || 'planning',
    colour: document.getElementById('new-batch-colour')?.value || 'gold',
    focus: document.getElementById('new-batch-focus')?.value || '',
    deadline: '',
    steps, currentStepIdx: 0, createdAt: Date.now(),
  };
  if (!state.data.tjmBatches) state.data.tjmBatches = [];
  state.data.tjmBatches.push(newBatch);
  state.batchAdding = false;
  await saveData();
  render();
};

window.completeStep = (id) => {
  const batches = state.data.tjmBatches || [];
  const b = batches.find(b => b.id === id);
  if (!b) return;
  const steps = b.steps || [];
  const idx = b.currentStepIdx || 0;
  const isLast = idx >= steps.length - 1;
  state.stepConfirm = { batchId:id, stepIdx:idx, isLast, currentName:steps[idx]?.name||'', nextName:steps[idx+1]?.name||'' };
  render();
};

window.confirmStepComplete = async () => {
  const sc = state.stepConfirm;
  if (!sc) return;
  const batches = state.data.tjmBatches || [];
  const b = batches.find(b => b.id === sc.batchId);
  if (b) {
    const steps = b.steps || [];
    if (steps[sc.stepIdx]) steps[sc.stepIdx].completedAt = Date.now();
    if (sc.isLast) b.status = 'done';
    else b.currentStepIdx = sc.stepIdx + 1;
    b.steps = steps;
  }
  state.data.tjmBatches = batches;
  state.stepConfirm = null;
  await saveData();
  render();
};

window.cancelStepConfirm = () => { state.stepConfirm = null; render(); };

window.batchSwipeStart = (e) => { batchSwipeX = e.touches[0].clientX; };
window.batchSwipeEnd = (e, batchId) => {
  const dx = e.changedTouches[0].clientX - batchSwipeX;
  if (Math.abs(dx) < 40) return;
  window.navBatchStep(batchId, dx < 0 ? 1 : -1);
};

// expose for external use
window.renderEditStepSlide = renderEditStepSlide;
}

export function initBatchEditorUI({ state, saveData, saveDataQuiet, render, BATCH_COLOURS }) {

const DRUM_TIMES = Array.from({length:36},(_,i)=>(i+1)*5);
function fmtMins(m){ return m<60?m+'m':Math.floor(m/60)+'h'+(m%60?m%60+'m':''); }

window.autoSaveBatchDeadline = async (batchId, value) => {
  const batches = state.data.tjmBatches||[];
  const b = batches.find(b=>b.id===batchId);
  if(!b) return;
  // ── FIX: always set to empty string when cleared, never undefined ──
  b.deadline = value || '';
  state.data.tjmBatches = batches;
  // ── FIX: sync the hidden input so saveBatch reads the correct value ──
  const deadlineInput = document.getElementById(`be-deadline-${batchId}`);
  if (deadlineInput) deadlineInput.value = value || '';
  await saveDataQuiet();
  const display = document.querySelector(`#be-deadline-${batchId}`)?.parentElement?.querySelector('[style*="pointer-events:none"]');
  if(display) {
    const fmt = d=>{if(!d)return'Click to set deadline...';const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return '📅 '+days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();};
    display.textContent = fmt(value);
    display.style.color = value ? '#e74c3c' : 'rgba(255,255,255,0.3)';
    display.style.fontWeight = value ? '800' : '400';
    display.style.background = value ? 'rgba(231,76,60,0.08)' : 'rgba(255,255,255,0.04)';
    display.style.border = `1px solid ${value?'rgba(231,76,60,0.35)':'rgba(255,255,255,0.1)'}`;
  }
  const reminder = document.querySelector('.be-batch-due-reminder');
  if(reminder) {
    const fmt2 = d=>{if(!d)return'';const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();};
    reminder.textContent = value ? 'Batch due: '+fmt2(value) : '';
    reminder.style.display = value ? '' : 'none';
  }
};

window.autoSaveStepDeadline = async (batchId, stepIdx, value) => {
  const batches = state.data.tjmBatches||[];
  const b = batches.find(b=>b.id===batchId);
  if(!b||!b.steps?.[stepIdx]) return;
  b.steps[stepIdx].deadline = value || '';
  state.data.tjmBatches = batches;
  await saveDataQuiet();
  const stepDisplay = document.querySelector(`#be-step-deadline-display-${batchId}-${stepIdx}`);
  if(stepDisplay) {
    const fmt = d=>{if(!d)return'Click to set step deadline...';const dt=new Date(d+'T00:00:00');const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];const months=['January','February','March','April','May','June','July','August','September','October','November','December'];const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');return '📅 '+days[dt.getDay()]+', '+ord(dt.getDate())+' '+months[dt.getMonth()]+' '+dt.getFullYear();};
    stepDisplay.textContent = fmt(value);
    stepDisplay.style.color = value ? 'rgba(231,76,60,0.85)' : 'rgba(255,255,255,0.3)';
    stepDisplay.style.fontWeight = value ? '800' : '400';
    stepDisplay.style.border = `1px solid ${value?'rgba(231,76,60,0.25)':'rgba(255,255,255,0.1)'}`;
  }
};

window.editBatch = (id) => {
  state.batchEditing = id; state.batchAdding = false; state.editBatchStepIdx = 0;
  render();
  setTimeout(()=>{ window.renderEditStepSlide?.(id); document.querySelectorAll('.batch-focus-textarea').forEach(el=>window.autoResizeTextarea?.(el)); }, 50);
};

window.cancelBatchEdit = () => { state.batchEditing = null; render(); };

window.selectBatchColour = (batchId, colourId) => {
  document.querySelectorAll(`#be-colour-${batchId} .batch-colour-swatch`).forEach(el=>el.classList.toggle('selected', el.dataset.colour===colourId));
  const hidden = document.getElementById(`be-colour-hidden-${batchId}`);
  if(hidden) hidden.value = colourId;
  const hex = BATCH_COLOURS.find(c=>c.id===colourId)?.hex || '#C9A84C';
  const card = document.querySelector(`#be-colour-${batchId}`)?.closest('.batch-card');
  if(card) {
    card.style.borderColor = hex+'55';
    card.style.background = `linear-gradient(160deg,${hex}33 0%,${hex}18 60%,${hex}0a 100%)`;
    const bar = card.querySelector('.batch-accent-bar');
    if(bar) bar.style.background = `linear-gradient(90deg,${hex},${hex}66)`;
  }
  if(state.data.dayBatchPlan) {
    Object.values(state.data.dayBatchPlan).forEach(weekData =>
      Object.values(weekData).forEach(dayData =>
        (dayData._batch||[]).forEach(s => { if(s.batchId === batchId) { s.colourId = colourId; s.hex = hex; } })
      )
    );
  }
};

window.selectNewBatchColour = (colourId) => {
  document.querySelectorAll('#new-colour-swatches .batch-colour-swatch').forEach(el=>el.classList.toggle('selected', el.dataset.colour===colourId));
  const hidden = document.getElementById('new-batch-colour');
  if(hidden) hidden.value = colourId;
  const hex = BATCH_COLOURS.find(c=>c.id===colourId)?.hex || '#C9A84C';
  const card = document.getElementById('new-colour-swatches')?.closest('.batch-card');
  if(card) {
    card.style.borderColor = hex+'30';
    card.style.background = `linear-gradient(160deg,${hex}0d 0%,transparent 55%)`;
    const bar = card.querySelector('.batch-accent-bar');
    if(bar) bar.style.background = `linear-gradient(90deg,${hex},${hex}66)`;
  }
};

window.selectBatchProj = (id, proj) => {
  const labels = {tjm:'TJM',vinted:'Vinted',notts:'Nottingham',other:'Other'};
  document.querySelectorAll(`#be-proj-${id} .batch-proj-btn`).forEach(b=>b.classList.toggle('selected', b.textContent===labels[proj]));
  const wrap = document.getElementById(`be-proj-custom-wrap-${id}`);
  if(wrap) wrap.style.display = proj==='other'?'':'none';
};

window.selectNewBatchProj = (proj) => {
  const labels = {tjm:'TJM',vinted:'Vinted',notts:'Nottingham',other:'Other'};
  document.querySelectorAll('#new-proj-btns .batch-proj-btn').forEach(b=>b.classList.toggle('selected', b.textContent===labels[proj]));
  const inp = document.getElementById('new-batch-proj'); if(inp) inp.value = proj;
  const wrap = document.getElementById('new-proj-custom-wrap');
  if(wrap) wrap.style.display = proj==='other'?'':'none';
};

window._buildDrum = function buildDrum(drumId, hiddenId, defaultMins) {
  const items = DRUM_TIMES.map((m,i)=>`<div class="drum-item${m===defaultMins?' active':''}" data-idx="${i}" data-mins="${m}" onclick="drumTap('${drumId}',${i})">${fmtMins(m)}</div>`).join('');
  return `<div class="drum-wrap">
  <div class="drum-fade-top"></div>
  <div class="drum-line"></div>
  <div class="drum-scroll" id="${drumId}" onscroll="onDrumScroll('${drumId}','${hiddenId}')">${items}</div>
  <div class="drum-fade-bot"></div>
</div>
<input type="hidden" id="${hiddenId}" value="${defaultMins}">`;
};

window.initDrum = function initDrum(drumId, mins) {
  const drum = document.getElementById(drumId);
  if(!drum) return;
  const idx = DRUM_TIMES.indexOf(mins);
  if(idx>=0) { drum._programmatic = true; drum.scrollTop = idx*40; setTimeout(()=>{ drum._programmatic = false; }, 400); }
};

window.onDrumScroll = (drumId, hiddenId) => {
  const drum = document.getElementById(drumId);
  if(!drum||drum._programmatic) return;
  clearTimeout(drum._scrollTimer);
  drum._scrollTimer = setTimeout(()=>{
    const idx = Math.max(0, Math.min(DRUM_TIMES.length-1, Math.round(drum.scrollTop/40)));
    drum.scrollTo({top: idx*40, behavior:'smooth'});
    const mins = DRUM_TIMES[idx];
    const hidden = document.getElementById(hiddenId);
    if(hidden) hidden.value = mins;
    drum.querySelectorAll('.drum-item').forEach((el,i)=>el.classList.toggle('active', i===idx));
  }, 150);
};

window.expandDrum = (drumId, hiddenId, currentMins, pillEl) => {
  const container = pillEl.parentElement;
  if(!container) return;
  container.innerHTML = window._buildDrum(drumId, hiddenId, currentMins);
  setTimeout(()=>{
    const drum = document.getElementById(drumId);
    if(drum) { drum._programmatic = true; drum.scrollTop = DRUM_TIMES.indexOf(currentMins)*40; setTimeout(()=>{ drum._programmatic = false; }, 400); }
  }, 20);
};

window.drumTap = (drumId, idx) => {
  const drum = document.getElementById(drumId);
  if(!drum) return;
  drum._programmatic = true;
  drum.scrollTo({top: idx*40, behavior:'smooth'});
  drum.querySelectorAll('.drum-item').forEach((el,i)=>el.classList.toggle('active', i===idx));
  const hidden = document.getElementById(drumId.replace('be-drum-','be-drum-hidden-').replace('new-drum-','new-drum-hidden-'));
  if(hidden) hidden.value = DRUM_TIMES[idx];
  clearTimeout(drum._lockTimer);
  drum._lockTimer = setTimeout(()=>{ drum._programmatic = false; }, 600);
};

window.initDrums = function initDrums(batchId) {
  const b = (state.data.tjmBatches||[]).find(b=>b.id===batchId);
  if(!b) return;
  const si = state.editBatchStepIdx||0;
  const s = (b.steps||[])[si];
  if(s) setTimeout(()=>window.initDrum(`be-drum-${batchId}`, s.timeBlock||30), 50);
};

}
