// CRM query helpers + all CRM window actions.

// Pure query helpers — call createCRMHelpers({ state, getToday }) to get them.
export function createCRMHelpers({ state, getToday }) {
  function getCRMLeads()        { return state.data?.crmLeads || []; }
  function getCRMWeekStart()    { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)).toISOString().split('T')[0]; }
  function getCRMMonthStart()   { return getToday().slice(0, 7) + '-01'; }
  function getCRMLastWeekStart(){ const d = new Date(getCRMWeekStart()); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }
  function getCRMLastWeekEnd()  { const d = new Date(getCRMWeekStart()); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }
  function getCRMLastMonthStart(){ const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0].slice(0, 7) + '-01'; }
  function getCRMLastMonthEnd() { const d = new Date(getCRMMonthStart()); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }

  function isLeadOverdue(lead)    { return lead.followUp && lead.followUp < getToday() && !['sold','cold'].includes(lead.status); }
  function isLeadDueToday(lead)   { return lead.followUp === getToday() && !['sold','cold'].includes(lead.status); }
  function getOverdueDays(lead)   { if (!lead.followUp) return 0; return Math.ceil((new Date(getToday()) - new Date(lead.followUp)) / (1000*60*60*24)); }
  function formatFollowUpDate(dateStr) { if (!dateStr) return ''; const date = new Date(dateStr); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return date.getDate() + ' ' + months[date.getMonth()]; }
  function getCRMComparison(current, previous) { const diff = current - previous; if (diff === 0) return { text: '—', cls: '' }; return diff > 0 ? { text: '+' + diff, cls: 'up' } : { text: '' + diff, cls: 'down' }; }

  function getCRMNeedsAction()        { const today = getToday(); return getCRMLeads().filter(l => (l.followUp && l.followUp < today || l.followUp === today) && !['sold','cold'].includes(l.status)).length; }
  function getCRMHotLeads()           { return getCRMLeads().filter(l => l.temp === 'hot').length; }
  function getCRMNewLeadsThisWeek()   { return getCRMLeads().filter(l => l.dateAdded >= getCRMWeekStart()).length; }
  function getCRMNewLeadsLastWeek()   { const s=getCRMLastWeekStart(),e=getCRMLastWeekEnd(); return getCRMLeads().filter(l => l.dateAdded>=s&&l.dateAdded<=e).length; }
  function getCRMSalesThisWeek()      { return getCRMLeads().filter(l => l.status==='sold'&&l.saleDate&&l.saleDate>=getCRMWeekStart()).length; }
  function getCRMSalesLastWeek()      { const s=getCRMLastWeekStart(),e=getCRMLastWeekEnd(); return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=s&&l.saleDate<=e).length; }
  function getCRMRevenueThisWeek()    { return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=getCRMWeekStart()).reduce((sum,l)=>sum+(l.saleAmount||0),0); }
  function getCRMRevenueLastWeek()    { const s=getCRMLastWeekStart(),e=getCRMLastWeekEnd(); return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=s&&l.saleDate<=e).reduce((sum,l)=>sum+(l.saleAmount||0),0); }
  function getCRMNewLeadsThisMonth()  { return getCRMLeads().filter(l=>l.dateAdded>=getCRMMonthStart()).length; }
  function getCRMNewLeadsLastMonth()  { const s=getCRMLastMonthStart(),e=getCRMLastMonthEnd(); return getCRMLeads().filter(l=>l.dateAdded>=s&&l.dateAdded<=e).length; }
  function getCRMSalesThisMonth()     { return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=getCRMMonthStart()).length; }
  function getCRMSalesLastMonth()     { const s=getCRMLastMonthStart(),e=getCRMLastMonthEnd(); return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=s&&l.saleDate<=e).length; }
  function getCRMRevenueThisMonth()   { return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=getCRMMonthStart()).reduce((sum,l)=>sum+(l.saleAmount||0),0); }
  function getCRMRevenueLastMonth()   { const s=getCRMLastMonthStart(),e=getCRMLastMonthEnd(); return getCRMLeads().filter(l=>l.status==='sold'&&l.saleDate&&l.saleDate>=s&&l.saleDate<=e).reduce((sum,l)=>sum+(l.saleAmount||0),0); }
  function getDMsSentThisWeek()       { const days=state.data?.days||{}; const ws=getCRMWeekStart(); return Object.entries(days).filter(([d])=>d>=ws).reduce((s,[,d])=>s+(d.dmsSent||0),0); }
  function getDMsSentLastWeek()       { const days=state.data?.days||{}; const s=getCRMLastWeekStart(),e=getCRMLastWeekEnd(); return Object.entries(days).filter(([d])=>d>=s&&d<=e).reduce((sum,[,d])=>sum+(d.dmsSent||0),0); }
  function getDMsSentThisMonth()      { const days=state.data?.days||{}; const ms=getCRMMonthStart(); return Object.entries(days).filter(([d])=>d>=ms).reduce((s,[,d])=>s+(d.dmsSent||0),0); }
  function getDMsSentLastMonth()      { const days=state.data?.days||{}; const s=getCRMLastMonthStart(),e=getCRMLastMonthEnd(); return Object.entries(days).filter(([d])=>d>=s&&d<=e).reduce((sum,[,d])=>sum+(d.dmsSent||0),0); }

  return {
    getCRMLeads, getCRMWeekStart, getCRMMonthStart, getCRMLastWeekStart, getCRMLastWeekEnd, getCRMLastMonthStart, getCRMLastMonthEnd,
    isLeadOverdue, isLeadDueToday, getOverdueDays, formatFollowUpDate, getCRMComparison,
    getCRMNeedsAction, getCRMHotLeads,
    getCRMNewLeadsThisWeek, getCRMNewLeadsLastWeek,
    getCRMSalesThisWeek, getCRMSalesLastWeek,
    getCRMRevenueThisWeek, getCRMRevenueLastWeek,
    getCRMNewLeadsThisMonth, getCRMNewLeadsLastMonth,
    getCRMSalesThisMonth, getCRMSalesLastMonth,
    getCRMRevenueThisMonth, getCRMRevenueLastMonth,
    getDMsSentThisWeek, getDMsSentLastWeek, getDMsSentThisMonth, getDMsSentLastMonth,
  };
}

// Window action registrations — call initCRMActions({ state, saveData, render, getToday, crmHelpers })
export function initCRMActions({ state, saveData, render, getToday, crmHelpers }) {
  const { getCRMLeads, getCRMWeekStart } = crmHelpers;

  // ── Sold confirmation (from confirmSold modal) ──────────────────────────
  window.confirmSold = async (id) => {
    const item  = document.getElementById('sold-item')?.value.trim() || '';
    const price = parseFloat(document.getElementById('sold-price')?.value) || 0;
    const cog   = parseFloat(document.getElementById('sold-cog')?.value)   || 0;
    if (!item || price <= 0) { alert('Please fill in the jewellery item and sale price.'); return; }
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return;
    leads[idx] = { ...leads[idx], status:'sold', lastContact:getToday(), followUp:null, saleItem:item, saleAmount:price, cogAmount:cog, saleDate:getToday() };
    state.data.crmLeads = leads;
    const today = getToday();
    const todayDay = { ...(state.data.days?.[today] || {}) };
    todayDay.sales   = (todayDay.sales   || 0) + 1;
    todayDay.revenue = +((todayDay.revenue || 0) + price).toFixed(2);
    state.data.days  = { ...(state.data.days || {}), [today]: todayDay };
    state.crmSoldModal = null;
    await saveData(); render();
  };

  // ── Date picker scroll helpers ─────────────────────────────────────────
  window.pickScrollDate    = (_id, val) => { state.crmScrollDate = val; };
  window.confirmScrollDate = async (id) => {
    if (!state.crmScrollDate) { if (typeof window.closeCRMDatePicker === 'function') window.closeCRMDatePicker(); return; }
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx !== -1) { leads[idx] = { ...leads[idx], followUp: state.crmScrollDate }; state.data.crmLeads = leads; }
    state.crmDatePicker = null; state.crmScrollDate = null;
    await saveData(); render();
  };
  window.setCRMFollowUp = async (id, days) => {
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return;
    const d = new Date(); d.setDate(d.getDate() + days);
    leads[idx] = { ...leads[idx], followUp: d.toISOString().split('T')[0] };
    state.data.crmLeads = leads; state.crmDatePicker = null;
    await saveData(); render();
  };
  window.updateCRMLeadNotes = async (id, notes) => {
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return;
    leads[idx] = { ...leads[idx], notes };
    state.data.crmLeads = leads; await saveData();
  };

  // ── Filter & expand ────────────────────────────────────────────────────
  window.setCRMFilter     = (f) => { state.crmFilter = f; render(); };
  window.toggleCRMExpand  = (id) => { state.crmExpanded = state.crmExpanded === id ? null : id; render(); };
  window.openCRMDatePicker= (id) => { state.crmDatePicker = id; render(); };
  window.closeCRMDatePicker = () => { state.crmDatePicker = null; render(); };

  // ── Add lead ───────────────────────────────────────────────────────────
  window.addCRMLead = async () => {
    const dm  = document.getElementById('crm-dm-username');
    const u   = document.getElementById('crm-username');
    const n   = document.getElementById('crm-name');
    const dmVal = dm?.value.trim() || '';
    const uVal  = u?.value.trim()  ? (u.value.trim().startsWith('@') ? u.value.trim() : '@' + u.value.trim()) : '';
    if (!dmVal && !uVal) return;
    const d = new Date(); d.setDate(d.getDate() + 3);
    const leads = [...(state.data.crmLeads || [])];
    leads.unshift({ id: Date.now().toString(), dmUsername: dmVal, username: uVal, name: n?.value.trim()||'', status:'new', temp:null, dateAdded:getToday(), lastContact:getToday(), followUp:d.toISOString().split('T')[0], notes:'', saleAmount:null, saleDate:null, saleItem:null, cogAmount:null });
    state.data.crmLeads = leads;
    if (dm) dm.value = ''; if (u) u.value = ''; if (n) n.value = '';
    await saveData(); render();
  };

  // ── Lead status & temp ─────────────────────────────────────────────────
  window.setCRMLeadStatus = async (id, status) => {
    if (status === 'sold') { state.crmSoldModal = id; render(); return; }
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return;
    const d = new Date(); d.setDate(d.getDate() + (status === 'requested' ? 7 : 3));
    const followUp = ['sold','cold'].includes(status) ? null : d.toISOString().split('T')[0];
    const temp     = status === 'replied' ? leads[idx].temp : null;
    leads[idx] = { ...leads[idx], status, lastContact: getToday(), followUp, temp };
    state.data.crmLeads = leads; await saveData(); render();
  };
  window.setCRMLeadTemp = async (id, temp) => {
    const leads = [...(state.data.crmLeads || [])];
    const idx   = leads.findIndex(l => l.id === id);
    if (idx === -1) return;
    leads[idx] = { ...leads[idx], temp };
    state.data.crmLeads = leads; await saveData(); render();
  };

  // ── Sold modal helpers ─────────────────────────────────────────────────
  window.updateSoldProfit = () => {
    const price = parseFloat(document.getElementById('sold-price')?.value) || 0;
    const cog   = parseFloat(document.getElementById('sold-cog')?.value)   || 0;
    const el    = document.getElementById('sold-profit-display');
    if (el) el.textContent = '£' + (price - cog).toFixed(2);
  };
  window.closeSoldModal = () => { state.crmSoldModal = null; render(); };
}
