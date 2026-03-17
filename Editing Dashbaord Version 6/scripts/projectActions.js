// Vinted, Nottingham, and Vault window actions.
// Called once after render is defined: initProjectActions({ state, saveData, render, getVintedItems, getNottinghamData, VINTED_STAGES })

export function initProjectActions({ state, saveData, render, getVintedItems, getNottinghamData, VINTED_STAGES }) {

  // ── Vinted Pipeline ────────────────────────────────────────────────────
  window.addVintedItem = async () => {
    const input = document.getElementById('vinted-new-item');
    const name = input?.value?.trim();
    if (!name) return;
    if (!state.data.vintedItems) state.data.vintedItems = [];
    state.data.vintedItems.push({ id: 'v' + Date.now(), name, stage: 'Available Stock', addedAt: Date.now() });
    input.value = '';
    await saveData(); render();
  };

  window.moveVintedItem = async (id, dir) => {
    const items = getVintedItems();
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const currentStageIdx = VINTED_STAGES.indexOf(items[idx].stage);
    items[idx].stage = VINTED_STAGES[Math.max(0, Math.min(VINTED_STAGES.length - 1, currentStageIdx + dir))];
    state.data.vintedItems = items;
    await saveData(); render();
  };

  window.deleteVintedItem = async (id) => {
    state.data.vintedItems = getVintedItems().filter(i => i.id !== id);
    await saveData(); render();
  };

  // ── Nottingham Insurance ───────────────────────────────────────────────
  window.editNottsGoal   = () => { state.nottsGoalEditing = true; render(); };
  window.cancelNottsGoal = () => { state.nottsGoalEditing = false; render(); };

  window.saveNottsGoal = async () => {
    const val = document.getElementById('notts-goal-input')?.value;
    if (!state.data.nottinghamInsurance) state.data.nottinghamInsurance = getNottinghamData();
    state.data.nottinghamInsurance.goal = val || '';
    state.nottsGoalEditing = false;
    await saveData(); render();
  };

  window.addNottsTask = async () => {
    const input = document.getElementById('notts-task-input');
    const text = input?.value?.trim();
    if (!text) return;
    if (!state.data.nottinghamInsurance) state.data.nottinghamInsurance = getNottinghamData();
    if (!state.data.nottinghamInsurance.tasks) state.data.nottinghamInsurance.tasks = [];
    state.data.nottinghamInsurance.tasks.push({ text, done: false, addedAt: Date.now() });
    input.value = '';
    await saveData(); render();
  };

  window.toggleNottsTask = async (i) => {
    if (!state.data.nottinghamInsurance) state.data.nottinghamInsurance = getNottinghamData();
    const tasks = state.data.nottinghamInsurance.tasks || [];
    if (tasks[i]) tasks[i].done = !tasks[i].done;
    state.data.nottinghamInsurance.tasks = tasks;
    await saveData(); render();
  };

  window.deleteNottsTask = async (i) => {
    if (!state.data.nottinghamInsurance) state.data.nottinghamInsurance = getNottinghamData();
    state.data.nottinghamInsurance.tasks = (state.data.nottinghamInsurance.tasks || []).filter((_,idx) => idx !== i);
    await saveData(); render();
  };

  // ── Vault / Ideas ──────────────────────────────────────────────────────
  window.setVaultStage     = (s) => { state.vaultStage = s; state.vaultExpanded = null; render(); };
  window.toggleVaultExpand = (id) => { state.vaultExpanded = state.vaultExpanded === id ? null : id; render(); };

  window.vaultStartCapture = () => {
    state.vaultCapturing = true; state.vaultVAOn = false; render();
    setTimeout(() => document.getElementById('vault-title')?.focus(), 50);
  };
  window.vaultCancelCapture = () => { state.vaultCapturing = false; state.vaultVAOn = false; render(); };

  window.vaultToggleVA = () => {
    state.vaultVAOn = !state.vaultVAOn;
    const toggle = document.getElementById('vault-va-toggle');
    const wrap   = document.getElementById('vault-va-notes-wrap');
    if (toggle) {
      toggle.style.background  = state.vaultVAOn ? '#D4AF37' : '#222';
      toggle.style.borderColor = state.vaultVAOn ? '#D4AF37' : '#333';
      const dot = toggle.querySelector('div');
      if (dot) dot.style.left = state.vaultVAOn ? '18px' : '2px';
    }
    if (wrap) wrap.style.display = state.vaultVAOn ? 'block' : 'none';
  };

  window.vaultSaveIdea = async () => {
    const title = document.getElementById('vault-title')?.value.trim();
    if (!title) return;
    const idea = {
      id: Date.now().toString(), title,
      source:   document.getElementById('vault-source')?.value   || 'Video',
      category: document.getElementById('vault-category')?.value || 'TJM',
      spark:    document.getElementById('vault-spark')?.value.trim()  || '',
      action:   document.getElementById('vault-action')?.value.trim() || '',
      vaFlag:   state.vaultVAOn,
      vaNotes:  document.getElementById('vault-va-notes')?.value.trim() || '',
      stage: 'Raw', createdAt: Date.now()
    };
    state.data.vaultIdeas = [idea, ...(state.data.vaultIdeas || [])];
    state.vaultCapturing = false; state.vaultVAOn = false; state.vaultStage = 'Raw';
    await saveData(); render();
  };

  window.moveVaultStage = async (id, stage) => {
    const ideas = [...(state.data.vaultIdeas || [])];
    const idx = ideas.findIndex(i => i.id === id);
    if (idx !== -1) { ideas[idx] = { ...ideas[idx], stage }; state.data.vaultIdeas = ideas; }
    state.vaultExpanded = null;
    await saveData(); render();
  };

  window.deleteVaultIdea = async (id) => {
    state.data.vaultIdeas = (state.data.vaultIdeas || []).filter(i => i.id !== id);
    if (state.vaultExpanded === id) state.vaultExpanded = null;
    await saveData(); render();
  };
}
