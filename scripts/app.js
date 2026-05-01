import { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from './firebase.js';
import { STOIC_QUOTES, BATCH_COLOURS, RETENTION_SCIENCE, VAULT_STAGES, VAULT_SOURCES, VAULT_CATS, VAULT_STAGE_COLORS, VAULT_CAT_COLORS, VINTED_STAGES } from './constants.js';
import { renderJournalTab } from './renderJournal.js';
import { initJournalTab } from './journal.js';
import { state, defaultSettings } from './state.js';
import { createStorage } from './storage.js';
import { createHelpers } from './helpers.js';
import { createCRMHelpers, initCRMActions } from './crmActions.js';
import { initProjectActions } from './projectActions.js';
import { initDayPlannerActions } from './dayPlannerActions.js';
import { initBatchActions } from './batchActions.js';
import { initBatchEditorUI } from './batchActions.js';
import { initPanicButton } from './panicButton.js';
import { renderTodayTab as renderTodayTabExternal } from './renderTodayTab.js';
import { renderMarchTab as renderMarchTabExternal } from './renderMarchTab.js';
import { renderProgressTab as renderProgressTabExternal } from './renderProgressTab.js';
import { renderCRMTab as renderCRMTabExternal, renderVaultTab as renderVaultTabExternal } from './renderExtras.js';
import { renderVintedTab as renderVintedTabExternal, renderNottinghamTab as renderNottinghamTabExternal } from './renderProjects.js';
import { renderFireTab as renderFireTabExternal } from './renderFireTab.js';
import { renderRoadmapTab as renderRoadmapTabExternal } from './renderRoadmapTab.js';
import { renderVisionTab as renderVisionTabExternal } from './renderVisionTab.js';
import { renderWeeklyTab as renderWeeklyTabExternal, initWeeklyTab as initWeeklyTabExternal } from './renderWeeklyTab.js';
import { renderDayPlannerModal as renderDayPlannerModalExternal, renderEmbeddedDayPlanner as renderEmbeddedDayPlannerExternal, renderTimePickerModal as renderTimePickerModalExternal, renderWeekPlanModal as renderWeekPlanModalExternal, renderDatePickerModal as renderDatePickerModalExternal, renderSoldModal as renderSoldModalExternal } from './renderModals.js';
import { renderRetentionModal as renderRetentionModalExternal, renderPastDaysModal as renderPastDaysModalExternal, renderMonthTargetsModal as renderMonthTargetsModalExternal, renderChallengeModal as renderChallengeModalExternal } from './renderMoreModals.js';

// ── Online/offline tracking ────────────────────────────────────────────────
let isOnline = navigator.onLine;
window.addEventListener('online', () => { isOnline = true; render(); });
window.addEventListener('offline', () => { isOnline = false; render(); });

// ── Data helpers (pure getters) ────────────────────────────────────────────
const {
  getToday, getAllDays, normalizeDateKey, getDayByDate,
  getWeekKey, getNextWeekKey, getTodayDayKey, isSunday,
  getSettings, getProjectFronts, getTJMBatches, getVintedItems,
  getNottinghamData, getIdentityLock, getMissionTargets,
  getDayNumber, getDailyQuote,
  getLatestWeight, getLatestBodyFat, getLatestWeightDate, getLatestBodyFatDate,
  getStartLeanMass, getCurrentLeanMass, getDerivedTargetWeight,
  getTodayData, getStreak, formatSyncLabel, getCurrentBmr,
  getMonthDaysRemaining, getMonthStats, getMonthTargets,
  syncCalendarToDataMonth, getDaysRemaining, vaultTimeAgo,
} = createHelpers({ state, defaultSettings, STOIC_QUOTES });

const crmHelpers = createCRMHelpers({ state, getToday });
const {
  getCRMLeads, getCRMWeekStart, getCRMMonthStart,
  isLeadOverdue, isLeadDueToday, getOverdueDays, formatFollowUpDate, getCRMComparison,
  getCRMNeedsAction, getCRMHotLeads,
  getCRMNewLeadsThisWeek, getCRMNewLeadsLastWeek,
  getCRMSalesThisWeek, getCRMSalesLastWeek,
  getCRMRevenueThisWeek, getCRMRevenueLastWeek,
  getCRMNewLeadsThisMonth, getCRMNewLeadsLastMonth,
  getCRMSalesThisMonth, getCRMSalesLastMonth,
  getCRMRevenueThisMonth, getCRMRevenueLastMonth,
  getDMsSentThisWeek, getDMsSentLastWeek, getDMsSentThisMonth, getDMsSentLastMonth,
} = crmHelpers;

// ── Storage ────────────────────────────────────────────────────────────────
const { saveData, saveDataQuiet, loadData, loadHealthData, updateDayField, recalculateMarchStats, updateSettings } = createStorage({
  state, defaultSettings, render, getSettings, db, auth, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit,
});

// ── Misc helpers used in render ────────────────────────────────────────────
function getVaultIdeas() { return state.data.vaultIdeas || []; }
function vaultStaleCount(){ return getVaultIdeas().filter(i=>i.stage==='Raw'&&(Date.now()-i.createdAt)>7*86400000).length; }
function navigateCalendar(delta) {
  let m = state.calendarMonth + delta, y = state.calendarYear;
  if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
  state.calendarMonth = m; state.calendarYear = y; state.selectedEditDate = null; render();
}

// ── Small render helpers (used by tab renders) ─────────────────────────────
function renderLogin() {
  return `
  <div class="login-container">
  <div class="login-logo">TJM</div>
  <div class="login-subtitle">90-Day Challenge Dashboard</div>
  <button class="login-btn" onclick="handleLogin()">
  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
  Sign in with Google
  </button>
  </div>`;
}

function renderInputCard(field, label, value, type, unit) {
  return `
  <div class="input-card">
  <div class="input-label">${label}</div>
  <div class="input-value">${value ?? '—'}</div>
  <div class="input-row">
  <input type="${type}" id="input-${field}" class="day-input" placeholder="${unit}">
  <button class="log-btn" onclick="logInput('${field}')">Log</button>
  </div>
  </div>`;
}

function renderEditPanel() {
  const date = state.selectedEditDate;
  const dayData = getDayByDate(date) || {};
  return `
  <div class="edit-panel">
  <div class="edit-panel-title">Edit: ${date}</div>
  <div class="edit-toggles">
  ${['gym','retention','meditation','live'].map(f => `
  <button class="edit-toggle ${dayData[f] ? 'active' : ''}" onclick="editDayToggle('${f}')">
  ${f.charAt(0).toUpperCase()+f.slice(1)} ${dayData[f] ? '✓' : '○'}
  </button>`).join('')}
  </div>
  <div class="edit-inputs">
  ${[['sales','Sales','number'],['revenue','Revenue £','number'],['dmsSent','DMs Sent','number'],['warmLeads','Warm Leads','number']].map(([f,l,t]) => `
  <div class="edit-input-row">
  <label>${l}</label>
  <input type="${t}" value="${dayData[f]||''}" onchange="editDayInput('${f}',this.value)" class="edit-input">
  </div>`).join('')}
  </div>
  </div>`;
}

function renderStatCard(value, target, label, lastMonthVal, expected) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const onTrack = expected !== undefined ? value >= expected * 0.9 : null;
  const lmDiff = lastMonthVal !== undefined && lastMonthVal !== null ? value - lastMonthVal : null;
  return `
  <div class="stat-card">
  <div class="stat-value">${value}</div>
  <div class="stat-label">${label}</div>
  <div class="stat-target">Target: ${target}</div>
  <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
  <div class="stat-pct">${pct}%</div>
  ${onTrack !== null ? `<div class="stat-pace ${onTrack?'on-track':'behind'}">${onTrack?'✓ On pace':'⚠ Behind'}</div>` : ''}
  ${lmDiff !== null ? `<div class="stat-lm" style="color:${lmDiff>=0?'#2ecc71':'#e74c3c'}">${lmDiff>=0?'+':''}${lmDiff} vs last mo</div>` : ''}
  </div>`;
}

// ── Deps objects ───────────────────────────────────────────────────────────
function getJournalEntry(dateKey, session) {
  const fb = state.data?.journal?.[dateKey]?.[session];
  if (fb) return fb;
  try { const raw = localStorage.getItem((session === 'morning' ? 'morningJournal-' : 'eveningJournal-') + dateKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const renderTabDeps = {
  state, BATCH_COLOURS,
  getTodayData, getIdentityLock, getMissionTargets, getProjectFronts, getTJMBatches,
  getLatestWeight, getLatestBodyFat, getLatestWeightDate, getLatestBodyFatDate,
  formatSyncLabel, getSettings, isSunday, getTodayDayKey, getWeekKey, getToday, getDayByDate,
  getMonthStats, getMonthDaysRemaining, getMonthTargets,
  getDerivedTargetWeight, getCurrentLeanMass, getStartLeanMass, getStreak,
  renderInputCard, renderStatCard, renderEditPanel, getJournalEntry,
  renderEmbeddedDayPlanner: () => renderEmbeddedDayPlannerExternal(renderModalDeps),
};

const renderCRMDeps = {
  state, ...crmHelpers, getTodayData,
  renderDatePickerModal: () => renderDatePickerModalExternal({ state }),
  renderSoldModal: () => renderSoldModalExternal({ state }),
};

const renderVaultDeps = { state, getVaultIdeas, vaultStaleCount, VAULT_STAGES, VAULT_SOURCES, VAULT_CATS, VAULT_STAGE_COLORS, VAULT_CAT_COLORS, vaultTimeAgo };
const renderProjectsDeps = { state, VINTED_STAGES, getVintedItems, getNottinghamData, getProjectFronts, getWeekKey, isSunday, getNextWeekKey, getTodayDayKey };
const renderModalDeps = { state, getProjectFronts, getTodayDayKey, BATCH_COLOURS };
const renderMoreModalDeps = { state, getStreak, RETENTION_SCIENCE, getToday, getSettings, getDayNumber, getMonthTargets };

function renderTodayTab() { return renderTodayTabExternal(renderTabDeps); }
function renderMarchTab() { return renderMarchTabExternal(renderTabDeps); }
function renderProgressTab() { return renderProgressTabExternal(renderTabDeps); }
function renderCRMTab() { return renderCRMTabExternal(renderCRMDeps); }
function renderVaultTab() { return renderVaultTabExternal(renderVaultDeps); }
function renderVintedTab() { return renderVintedTabExternal(renderProjectsDeps); }
function renderNottinghamTab() { return renderNottinghamTabExternal(renderProjectsDeps); }
function renderFireTab() { return renderFireTabExternal(renderTabDeps); }
function renderRoadmapTab() { return renderRoadmapTabExternal(); }
function renderPlannerTab() { return renderWeeklyTabExternal(); }
function renderDayPlannerModal() { return renderDayPlannerModalExternal(renderModalDeps); }
function renderTimePickerModal() { return renderTimePickerModalExternal(renderModalDeps); }
function renderWeekPlanModal() { return renderWeekPlanModalExternal(renderModalDeps); }
function renderRetentionModal() { return renderRetentionModalExternal(renderMoreModalDeps); }
function renderPastDaysModal() { return renderPastDaysModalExternal(renderMoreModalDeps); }
function renderMonthTargetsModal() { return renderMonthTargetsModalExternal(renderMoreModalDeps); }
function renderChallengeModal() { return renderChallengeModalExternal(renderMoreModalDeps); }

// ── Bottom nav (6 tabs — permanent on every page) ─────────────────────────
function renderBottomNav() {
  const moreActive = state.moreMenuOpen || ['march','vault','crm','vinted','notts','roadmap','fire'].includes(state.activeTab);
  const crmAlert = getCRMNeedsAction() > 0;
  return `
  <nav class="bottom-nav-app">
    <button data-tab="today"    class="bottom-nav-app-btn ${state.activeTab==='today'?'active':''}"    onclick="setTab('today')"><span class="nav-icon">🏠</span>Today</button>
    <button data-tab="journal"  class="bottom-nav-app-btn ${state.activeTab==='journal'?'active':''}"  onclick="setTab('journal')"><span class="nav-icon">📓</span>Journal</button>
    <button data-tab="planner"  class="bottom-nav-app-btn ${state.activeTab==='planner'?'active':''}"  onclick="setTab('planner')"><span class="nav-icon">✏️</span>Planner</button>
    <button data-tab="progress" class="bottom-nav-app-btn ${state.activeTab==='progress'?'active':''}" onclick="setTab('progress')"><span class="nav-icon">❤️</span>Health</button>
    <button data-tab="vision"   class="bottom-nav-app-btn ${state.activeTab==='vision'?'active':''}"   onclick="setTab('vision')"><span class="nav-icon">🗺️</span>Vision</button>
    <button data-tab="more"     class="bottom-nav-app-btn ${moreActive?'active':''} ${crmAlert?'crm-nav-alert':''}" onclick="toggleMoreMenu()" style="position:relative;"><span class="nav-icon">⋯</span>More${crmAlert?'<span class="crm-nav-dot"></span>':''}</button>
  </nav>`;
}

// ── Main render ────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  document.body.className = state.theme === 'light' ? 'light' : '';
  if (!state.user) { app.innerHTML = renderLogin(); return; }
  if (!state.data) { app.innerHTML = '<div class="loading">Loading your data...</div>'; return; }
  if (state.dayPlannerOpen) { app.innerHTML = renderDayPlannerModal() + renderBottomNav(); return; }

  try {
    const quote = getDailyQuote();
    app.innerHTML = `
    <style>
      @keyframes crmPulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
      @keyframes crmDotPop { 0%,100%{transform:scale(1);} 50%{transform:scale(1.4);} }
      /* Kill cached ::before icon rules — icons are now inline spans */
      .bottom-nav-app-btn::before { content: none !important; display: none !important; }
      .nav-icon { font-size: 18px; line-height: 1; display: block; }
      .crm-nav-dot {
        position:absolute;top:4px;right:10px;
        width:8px;height:8px;border-radius:50%;
        background:#e74c3c;
        animation:crmDotPop 1.2s ease-in-out infinite;
        box-shadow:0 0 6px rgba(231,76,60,0.8);
      }
      .crm-nav-alert { animation:crmPulse 1.2s ease-in-out infinite; color:#e74c3c !important; }
      .crm-sheet-alert { border-color:rgba(231,76,60,0.6) !important; color:#e74c3c !important; animation:crmPulse 1.2s ease-in-out infinite; }
      .crm-sheet-badge {
        display:inline-flex;align-items:center;justify-content:center;
        background:#e74c3c;color:#fff;
        font-size:10px;font-weight:900;
        width:18px;height:18px;border-radius:50%;
        margin-left:6px;vertical-align:middle;
      }
    </style>
    ${state.saving ? '<div class="saving-badge">Saving...</div>' : ''}
    <div class="header">
    <div class="logo" style="font-size:20px;letter-spacing:2px;">My Dashboard</div>
    <div style="display:flex;align-items:center;gap:8px;">
    ${!isOnline ? `<div style="display:flex;align-items:center;gap:5px;background:rgba(243,156,18,0.12);border:1px solid rgba(243,156,18,0.3);border-radius:20px;padding:5px 10px;">
    <div style="width:6px;height:6px;border-radius:50%;background:#f39c12;"></div>
    <span style="font-size:10px;font-weight:800;color:#f39c12;letter-spacing:0.5px;">OFFLINE</span>
    </div>` : ''}
    <button class="theme-btn" onclick="(async()=>{if('serviceWorker' in navigator){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));const reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.unregister();}window.location.reload(true);})()" title="Refresh app" style="font-size:14px;padding:6px 10px;">↻</button>
    <button class="theme-btn" onclick="toggleTheme()">${state.theme === 'light' ? '🌙 Dark' : '☀️ Light'}</button>
    <div class="day-badge" onclick="openChallengeSetup()" style="cursor:pointer;">DAY ${getDayNumber()}/${getSettings().challengeDays||90}</div>
    </div>
    </div>
    <button class="panic-trigger" onclick="openPanic()" style="margin-bottom:12px;margin-top:4px;${['today','journal','planner','progress','vision'].includes(state.activeTab) ? 'display:none;' : ''}"><span>🆘</span> PANIC BUTTON</button>
    ${(state.activeTab === 'today' || state.activeTab === 'journal') ? `
    <div class="quote-card">
    <div class="quote-icon">✦</div>
    <div class="quote-text">"${quote.text}"</div>
    <div class="quote-author">— ${quote.author}</div>
    <div class="quote-interpretation" id="quote-interpretation-el">${quote.interpretation}</div>
    </div>` : ''}

    <div class="content">
    ${(() => { try {
      if (state.activeTab !== 'today') return '';
      return renderTodayTab();
    } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">TODAY ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'march' ? renderMarchTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">MAR ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'progress' ? renderProgressTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">BODY ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'crm' ? renderCRMTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">CRM ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'vault' ? renderVaultTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">IDEAS ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'vinted' ? renderVintedTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">VINTED ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'notts' ? renderNottinghamTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">NOTTS ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'journal' ? renderJournalTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">JOURNAL ERROR: '+ e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'fire' ? renderFireTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">FIRE ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'roadmap' ? renderRoadmapTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">ROADMAP ERROR: ' + e.message + '</div>'; }})()}
    ${(() => { try { return state.activeTab === 'planner' ? renderPlannerTab() : ''; } catch(e) { return '<div style="color:#e74c3c;padding:20px;font-size:12px;">PLANNER ERROR: ' + e.message + '</div>'; }})()}
    ${state.activeTab === 'vision' ? '<div id="tab-vision" style="min-height:100%;"></div>' : ''}
    </div>
    <div class="mobile-more-sheet ${state.moreMenuOpen ? 'open' : ''}">
      <div class="mobile-more-sheet-grid">
        <button class="mobile-more-sheet-btn ${state.activeTab==='march'?'active':''}" onclick="setTab('march');toggleMoreMenu()">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()]}</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='vault'?'active':''}" onclick="setTab('vault');toggleMoreMenu()">Ideas</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='crm'?'active':''} ${getCRMNeedsAction()>0?'crm-sheet-alert':''}" onclick="setTab('crm');toggleMoreMenu()">CRM${getCRMNeedsAction()>0?` <span class="crm-sheet-badge">${getCRMNeedsAction()}</span>`:''}</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='fire'?'active':''}" onclick="setTab('fire');toggleMoreMenu()">🖊️ Fire</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='vinted'?'active':''}" onclick="setTab('vinted');toggleMoreMenu()">Vinted</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='notts'?'active':''}" onclick="setTab('notts');toggleMoreMenu()">Notts</button>
        <button class="mobile-more-sheet-btn ${state.activeTab==='roadmap'?'active':''}" onclick="setTab('roadmap');toggleMoreMenu()">🗺 Map</button>
        <button class="mobile-more-sheet-btn danger" onclick="handleLogout()">Sign Out</button>
      </div>
    </div>
    <div class="mobile-more-backdrop ${state.moreMenuOpen ? 'open' : ''}" onclick="toggleMoreMenu()"></div>
    ${renderBottomNav()}
    ${state.retentionModal ? renderRetentionModal() : ''}
    ${state.weekPlanModal ? renderWeekPlanModal() : ''}
    ${state.dayPlannerOpen ? renderDayPlannerModal() : ''}
    ${state.pastDaysOpen ? renderPastDaysModal() : ''}
    ${state.monthTargetsOpen ? renderMonthTargetsModal() : ''}
    ${state.challengeSetupOpen ? renderChallengeModal() : ''}
    ${state.crmDatePicker ? renderDatePickerModal() : ''}
    ${state.crmSoldModal ? renderSoldModal() : ''}
    ${state.frontTaskDeleteConfirm ? (() => {
      const { taskText } = state.frontTaskDeleteConfirm;
      return `
    <div onclick="cancelFrontTaskDelete()" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div onclick="event.stopPropagation()" style="background:#1c1c1e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size:32px;margin-bottom:14px;">🗑️</div>
        <div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:8px;">Remove this task?</div>
        <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.55);margin-bottom:20px;line-height:1.4;">"${taskText}"</div>
        <div style="display:flex;gap:10px;">
          <button onclick="cancelFrontTaskDelete()" style="flex:1;padding:13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:rgba(255,255,255,0.7);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
          <button onclick="confirmFrontTaskDelete()" style="flex:1;padding:13px;background:rgba(231,76,60,0.15);border:1.5px solid rgba(231,76,60,0.5);border-radius:12px;color:#e74c3c;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;">Remove</button>
        </div>
      </div>
    </div>`;
    })() : ''}
    ${state.reminderDeleteConfirm ? (() => {
      const isArchived = state.reminderDeleteConfirm.source === 'archived';
      const rem = isArchived
        ? (state.data.remindersArchived || []).find(r => r.id === state.reminderDeleteConfirm.id)
        : (state.data.reminders || []).find(r => r.id === state.reminderDeleteConfirm.id);
      return `
    <div onclick="cancelReminderDelete()" style="position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div onclick="event.stopPropagation()" style="background:#1c1c1e;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size:32px;margin-bottom:14px;">${isArchived ? '🗑️' : '📦'}</div>
        <div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:8px;">${isArchived ? 'Delete permanently?' : 'Archive this reminder?'}</div>
        ${rem ? `<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.55);margin-bottom:6px;line-height:1.4;">"${rem.text}"</div>` : ''}
        <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:22px;">${isArchived ? 'This cannot be undone.' : 'It will be moved to your archive where you can delete it later.'}</div>
        <div style="display:flex;gap:10px;">
          <button onclick="cancelReminderDelete()" style="flex:1;padding:13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:rgba(255,255,255,0.7);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
          <button onclick="confirmReminderDelete()" style="flex:1;padding:13px;background:rgba(231,76,60,0.15);border:1.5px solid rgba(231,76,60,0.5);border-radius:12px;color:#e74c3c;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;">${isArchived ? 'Delete' : 'Archive'}</button>
        </div>
      </div>
    </div>`;
    })() : ''}
    ${state.stepConfirm ? `
    <div class="step-confirm-overlay">
    <div class="step-confirm-modal">
    <div class="step-confirm-icon">✅</div>
    <div class="step-confirm-title">Step Complete!</div>
    <div class="step-confirm-sub">${state.stepConfirm.currentName}</div>
    ${state.stepConfirm.isLast
      ? `<div class="step-confirm-next">🎉 That's the last step — batch complete!</div>
      <button class="step-confirm-btn-done" onclick="confirmStepComplete()">Mark Batch Done</button>`
      : `<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-bottom:6px;letter-spacing:1px;">NEXT UP</div>
      <div class="step-confirm-next">${state.stepConfirm.nextName}</div>
      <button class="step-confirm-btn" onclick="confirmStepComplete()">→ Advance to Next Step</button>`
    }
    <button onclick="cancelStepConfirm()" style="margin-top:10px;width:100%;background:none;border:none;color:rgba(255,255,255,0.25);font-size:12px;cursor:pointer;padding:8px;font-family:inherit;">Cancel</button>
    </div>
    </div>` : ''}
    `;

    if (state.activeTab === 'journal') setTimeout(() => { try { initJournalTab({ state, getToday, saveDataQuiet, getWeekKey, getDayByDate, getJournalEntry }); } catch(e) { console.error('Journal init error:', e); } }, 0);
    if (state.activeTab === 'planner') setTimeout(() => { try { initWeeklyTabExternal(); } catch(e) { console.error('Weekly init error:', e); } }, 0);
    if (state.activeTab === 'vision') setTimeout(() => { try { renderVisionTabExternal({ db, user: state.user }); } catch(e) { console.error('Vision init error:', e); } }, 0);

    // ── AI-tailored quote interpretation ──────────────────────────────────
    if (state.activeTab === 'today' || state.activeTab === 'journal') {
      setTimeout(async () => {
        try {
          const el = document.getElementById('quote-interpretation-el');
          if (!el) return;

          const today = getToday();
          const cacheKey = 'quote_interpretation_' + today;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) { el.textContent = cached; return; }

          // Gather this month's objectives from all buckets
          const now = new Date();
          const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
          const allBuckets = state.data && state.data.monthObjectives ? state.data.monthObjectives : {};
          const monthObjs = Object.entries(allBuckets).flatMap(([, objs]) =>
            (objs || []).filter(o => o.deadline && o.deadline.startsWith(monthKey))
          );
          const monthObjList = monthObjs.length
            ? monthObjs.map(o => '- ' + o.text + (o.done ? ' (completed)' : '')).join('\n')
            : null;

          // Gather this week's objectives from state
          const weekObjs = (() => {
            try {
              const wk = getWeekKey();
              return (state.data && state.data.weekObjectives && state.data.weekObjectives[wk]) || [];
            } catch { return []; }
          })();
          const weekObjList = weekObjs.length
            ? weekObjs.map(o => '- ' + (o.text || o) + (o.done ? ' (completed)' : '')).join('\n')
            : null;

          const contextBlock = [
            monthObjList ? 'Monthly objectives:\n' + monthObjList : null,
            weekObjList  ? "This week's objectives:\n" + weekObjList  : null,
          ].filter(Boolean).join('\n\n');

          const prompt = contextBlock
            ? 'You are writing a short, punchy motivational interpretation of a stoic quote for someone\'s personal dashboard. Connect the quote\'s wisdom directly to their current objectives — monthly and weekly.\n\nQuote: "' + quote.text + '" — ' + quote.author + '\n\n' + contextBlock + '\n\nWrite 2-3 sentences max. Be direct and personal — speak to the person, not about them. Reference their actual objectives by name where natural. No preamble, no labels, just the interpretation text itself.'
            : 'You are writing a short, punchy motivational interpretation of a stoic quote for someone\'s personal dashboard. They are building an online jewellery brand called TJM and working toward financial independence.\n\nQuote: "' + quote.text + '" — ' + quote.author + '\n\nWrite 2-3 sentences max. Be direct and personal — speak to the person, not about them. No preamble, no labels, just the interpretation text itself.';

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              messages: [{ role: 'user', content: prompt }]
            })
          });
          const data = await res.json();
          const text = data && data.content && data.content[0] && data.content[0].text ? data.content[0].text.trim() : null;
          if (text) {
            el.textContent = text;
            sessionStorage.setItem(cacheKey, text);
          }
        } catch(e) {
          console.warn('Quote interpretation update failed:', e);
        }
      }, 0);
    }
  } catch(e) {
    app.innerHTML = '<div style="color:#e74c3c;padding:20px;font-size:13px;"><strong>Render error:</strong><br>' + e.message + '<br><br><small>' + e.stack + '</small></div>';
  }
}

function renderDatePickerModal() { return renderDatePickerModalExternal({ state }); }
function renderSoldModal() { return renderSoldModalExternal({ state }); }

// ── Init all action modules ────────────────────────────────────────────────
initBatchActions({ state, saveData, saveDataQuiet, render });
initBatchEditorUI({ state, saveData, saveDataQuiet, render, BATCH_COLOURS });
initCRMActions({ state, saveData, render, getToday, crmHelpers });
initPanicButton({ state, saveData, render, getStreak, getTodayData, getToday });
initProjectActions({ state, saveData, render, getVintedItems, getNottinghamData, VINTED_STAGES });
initDayPlannerActions({ state, saveData, saveDataQuiet, render, getWeekKey, getNextWeekKey, getTodayDayKey, isSunday, getProjectFronts, getMissionTargets, BATCH_COLOURS });

// ── Core window functions ──────────────────────────────────────────────────
window.handleLogin = async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error('Login failed:', e); } };
window.handleLogout = async () => { await signOut(auth); state.user = null; state.data = null; render(); };
window.setTab = (tab) => { state.activeTab = tab; state.selectedEditDate = null; state.moreMenuOpen = false; render(); };
window.toggleMoreMenu = () => { state.moreMenuOpen = !state.moreMenuOpen; render(); };
window.toggleObjectivesCollapsed = () => { state.objectivesCollapsed = !state.objectivesCollapsed; render(); };
window.toggleBatchesCollapsed    = () => { state.batchesCollapsed    = !state.batchesCollapsed;    render(); };
window._weekObjsHtml = function(weekObjectivesData, weekKey, clickable) {
  const raw = weekObjectivesData?.[weekKey];
  const objs = Array.isArray(raw) ? raw : (raw ? [{text: raw, done: false}] : []);
  if (!objs.length) return '';
  const WEEK_CAT_LABELS = { tjm:'TJM', vinted:'Vinted', notts:'Nottingham Insurance', other:'Other' };
  const WEEK_CAT_COLOURS = { tjm:'#3B82F6', vinted:'#14B8A6', notts:'#EF4444', other:'#8B5CF6' };
  const items = objs.map((obj, i) => {
    const done = !!obj.done;
    const category = obj.category || '';
    const categoryCustom = obj.categoryCustom || '';
    const catLabel = category ? (categoryCustom || WEEK_CAT_LABELS[category] || 'Other') : '';
    const catColor = WEEK_CAT_COLOURS[category] || '#6ba3d6';
    const tickEl = clickable
      ? `<button class="week-objective-tick${done?' done':''}" onclick="toggleWeekObj('${weekKey}',${i})" style="cursor:pointer;border:none;background:transparent;padding:0;">${done ? '✓' : ''}</button>`
      : `<div class="week-objective-tick${done?' done':''}">${done ? '✓' : ''}</div>`;
    return `<div class="week-objective-item${done ? ' done' : ''}">${tickEl}<div style="flex:1;min-width:0;">${category ? `<div style="font-size:9px;font-weight:900;letter-spacing:1.2px;color:${catColor};margin-bottom:4px;">${catLabel.toUpperCase()}</div>` : ''}<div class="week-objective-text">${obj.text}</div></div></div>`;
  }).join('');
  return `<div class="week-objectives-block"><div class="week-objectives-label">🎯 THIS WEEK'S OBJECTIVES</div>${items}</div>`;
};
window.navigateCalendar = (delta) => navigateCalendar(delta);
window.toggleTheme = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tjm_theme', state.theme);
  document.body.className = state.theme === 'light' ? 'light' : '';
  render();
};
window.toggleToday = (field) => { updateDayField(getToday(), field, !getTodayData()[field]); };
window.toggleJournalDay = (dateKey, field) => {
  // Toggle the field directly in state — avoid full render() which causes journal re-init glitches
  if (!state.data.days) state.data.days = {};
  if (!state.data.days[dateKey]) state.data.days[dateKey] = {};
  state.data.days[dateKey][field] = !state.data.days[dateKey][field];
  saveDataQuiet();
  // Re-render just the habit grid in-place
  const grid = document.getElementById('journal-habit-grid');
  if (!grid) return;
  const days = state.data.days || {};
  const sorted = Object.keys(days).sort().reverse();
  const viewedData = days[dateKey] || {};
  function streak(f) {
    let s = 0;
    const today = new Date().toISOString().slice(0,10);
    for (const d of sorted) {
      if (d === today && !days[d]?.[f]) continue; // today not done yet — don't break streak
      if (days[d]?.[f]) s++;
      else break;
    }
    return s;
  }
  const fields = [
    { key: 'gym',        label: 'GYM',       emoji: '🏋️' },
    { key: 'retention',  label: 'RETENTION',  emoji: '🩸' },
    { key: 'meditation', label: 'MEDITATION', emoji: '🧘' },
  ];
  grid.innerHTML = fields.map(f => `
    <div onclick="toggleJournalDay('${dateKey}','${f.key}')" class="${viewedData[f.key]?'jd-card-active':'jd-card-inactive'}" style="border-radius:16px;padding:16px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.2s;border:2px solid;">
      <span style="font-size:28px;line-height:1;">${f.emoji}</span>
      <span class="jd-icon" style="font-size:24px;font-weight:900;color:${viewedData[f.key]?'#ffffff':'#C8D6E5'}!important;">${viewedData[f.key]?'✓':'○'}</span>
      <span style="font-size:11px;font-weight:900;letter-spacing:1px;color:${viewedData[f.key]?'#ffffff':'#0A1628'}!important;">${f.label}</span>
      <span class="jd-streak" style="font-size:10px;font-weight:700;color:${viewedData[f.key]?'#ffffff':'#7b92aa'}!important;">${streak(f.key)} day streak</span>
    </div>`).join('');
};
window.logInput = (field) => {
  const input = document.getElementById(`input-${field}`);
  if (input?.value) {
    const val = ['weight','bodyFat','revenue'].includes(field) ? parseFloat(input.value) : parseInt(input.value);
    updateDayField(getToday(), field, val); input.value = '';
  }
};
window.toggleObjective = (i) => {
  const todayData = getTodayData();
  const objs = [...(todayData.objectives || [])];
  if (objs[i]?.text) { objs[i] = { ...objs[i], done: !objs[i].done }; updateDayField(getToday(), 'objectives', objs); }
};
window.saveObjective = (i) => {
  const input = document.getElementById(`obj-input-${i}`);
  if (input?.value.trim()) {
    const todayData = getTodayData();
    const objs = [...(todayData.objectives || [{text:'',done:false},{text:'',done:false},{text:'',done:false}])];
    objs[i] = { text: input.value.trim(), done: false };
    updateDayField(getToday(), 'objectives', objs);
  }
};
window.selectEditDate = (date) => { state.selectedEditDate = date; render(); };
window.editDayToggle = (field) => { updateDayField(state.selectedEditDate, field, !(state.data.days?.[state.selectedEditDate]?.[field])); };
window.editDayInput = (field, value) => {
  const val = ['weight','bodyFat','revenue'].includes(field) ? parseFloat(value) || null : parseInt(value) || 0;
  updateDayField(state.selectedEditDate, field, val);
};
window.toggleSettings = () => { state.showSettings = !state.showSettings; render(); };
window.updateSetting = (field, value) => {
  const stringFields = ['deadline','startDate','targetMode'];
  updateSettings(field, stringFields.includes(field) ? value : parseFloat(value));
};
window.setCalorieWeekOffset = (offset) => { state.calorieWeekOffset = offset; render(); };
window.changeHealthMonth = (delta) => {
  if (state.healthMonthOffset === undefined) state.healthMonthOffset = 0;
  state.healthMonthOffset = (state.healthMonthOffset || 0) + delta;
  render();
};
window.logManualCalories = (dateStr, field) => {
  const input = document.getElementById(`cal-${field}-${dateStr}`);
  if (input) { const val = parseFloat(input.value) || 0; updateDayField(dateStr, field, val); }
};

// ── Retention modal ────────────────────────────────────────────────────────
window.openRetentionModal = () => {
  const today = getToday();
  const existing = state.data.retentionLog?.[today];
  state.retentionFeelings = existing ? { ...existing } : { energy:5, focus:5, mood:5, confidence:5, libido:5, notes:'' };
  state.retentionModal = true; state.retentionExpanded = false; state.retentionViewDay = null; render();
};
window.retentionNavDay = (dir) => { const streak = getStreak('retention'); const current = state.retentionViewDay !== null ? state.retentionViewDay : streak; state.retentionViewDay = Math.max(1, current + dir); state.retentionExpanded = false; render(); };
window.retentionJumpDay = (day) => { state.retentionViewDay = day; state.retentionExpanded = false; render(); };
window.closeRetentionModal = (e) => { if (e.target.classList.contains('retention-overlay')) { state.retentionModal = false; render(); } };
window.closeRetentionModalBtn = () => { state.retentionModal = false; render(); };
window.toggleRetentionExpand = () => { state.retentionExpanded = !state.retentionExpanded; render(); };
window.updateRetentionSlider = (key, val) => { state.retentionFeelings = { ...(state.retentionFeelings || {}), [key]: parseInt(val) }; const el = document.getElementById('rv-' + key); if (el) el.textContent = val + '/10'; };
window.updateRetentionNote = (val) => { state.retentionFeelings = { ...(state.retentionFeelings || {}), notes: val }; };
window.saveRetentionFeelings = async () => {
  const today = getToday();
  const streak = getStreak('retention');
  if (!state.data.retentionLog) state.data.retentionLog = {};
  state.data.retentionLog[today] = { ...state.retentionFeelings, streakDay: streak, savedAt: Date.now() };
  await saveData(); state.retentionModal = false; render();
  setTimeout(() => { const el = document.createElement('div'); el.style.cssText='position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:9999;'; el.textContent='✓ Logged!'; document.body.appendChild(el); setTimeout(()=>el.remove(),2000); }, 100);
};

// ── Challenge & month targets ──────────────────────────────────────────────
window.openChallengeSetup = () => { state.challengeSetupOpen = true; render(); };
window.closeChallengeSetup = () => { state.challengeSetupOpen = false; render(); };
window.openMonthTargets = () => { state.monthTargetsOpen = true; render(); };
window.closeMonthTargets = () => { state.monthTargetsOpen = false; render(); };
window.saveMonthTargets = (key) => {
  const lives = parseInt(document.getElementById(`mt-${key}-lives`)?.value) || 0;
  const sales = parseInt(document.getElementById(`mt-${key}-sales`)?.value) || 0;
  const gym = parseInt(document.getElementById(`mt-${key}-gym`)?.value) || 0;
  const retention = parseInt(document.getElementById(`mt-${key}-retention`)?.value) || 0;
  if (!state.data.monthTargets) state.data.monthTargets = {};
  state.data.monthTargets[key] = { lives, sales, gym, retention };
  saveData();
  const btn = event.target; const orig = btn.textContent;
  btn.textContent = '✓ Saved'; btn.style.background='rgba(46,204,113,0.15)'; btn.style.borderColor='rgba(46,204,113,0.4)'; btn.style.color='#2ecc71';
  setTimeout(() => { btn.textContent = orig; btn.style.background=''; btn.style.borderColor=''; btn.style.color=''; }, 1500);
};
window.setChallengePreset = (days) => {
  if (!state.data.settings) state.data.settings = getSettings();
  state.data.settings.challengeDays = days;
  const el = document.getElementById('challenge-days'); if (el) el.value = days; render();
};
window.saveChallengeSetup = async () => {
  const startVal = document.getElementById('challenge-start')?.value;
  const daysVal = parseInt(document.getElementById('challenge-days')?.value);
  if (!state.data.settings) state.data.settings = getSettings();
  if (startVal) state.data.settings.startDate = startVal;
  if (daysVal) state.data.settings.challengeDays = daysVal;
  state.challengeSetupOpen = false;
  await saveData(); render();
};

// ── Reminders ──────────────────────────────────────────────────────────────
window.addReminder = () => {
  const textEl = document.getElementById('new-reminder-text');
  const deadlineEl = document.getElementById('new-reminder-deadline');
  const text = textEl?.value?.trim();
  if (!text) { textEl?.focus(); return; }
  const isChecklist = state.newReminderType === 'checklist';
  const reminder = {
    id: 'rem_' + Date.now(),
    text,
    deadline: deadlineEl?.value || null,
    done: false,
    createdAt: Date.now(),
    ...(isChecklist ? { type: 'checklist', items: [] } : {})
  };
  if (!state.data.reminders) state.data.reminders = [];
  state.data.reminders = [reminder, ...state.data.reminders];
  state.newReminderType = 'reminder';
  saveData();
};
window.toggleReminder = (id) => {
  if (!state.data.reminders) return;
  state.data.reminders = state.data.reminders.map(r => r.id === id ? { ...r, done: !r.done } : r);
  saveData();
};
window.deleteReminder = (id) => {
  state.reminderDeleteConfirm = { id, source: 'active' };
  render();
};
window.deleteArchivedReminder = (id) => {
  state.reminderDeleteConfirm = { id, source: 'archived' };
  render();
};
window.confirmReminderDelete = () => {
  const { id, source } = state.reminderDeleteConfirm || {};
  if (!id) return;
  if (source === 'active') {
    const rem = (state.data.reminders || []).find(r => r.id === id);
    if (rem) {
      if (!state.data.remindersArchived) state.data.remindersArchived = [];
      state.data.remindersArchived = [{ ...rem, archivedAt: Date.now() }, ...state.data.remindersArchived];
      state.data.reminders = state.data.reminders.filter(r => r.id !== id);
    }
  } else {
    state.data.remindersArchived = (state.data.remindersArchived || []).filter(r => r.id !== id);
  }
  state.reminderDeleteConfirm = null;
  saveData();
};
window.cancelReminderDelete = () => { state.reminderDeleteConfirm = null; render(); };
window.toggleRemindersArchive = () => { state.remindersArchiveOpen = !state.remindersArchiveOpen; render(); };

// ── Archive prompt (shown after marking a reminder done) ──────────────────
window.markReminderDoneAndPrompt = (id) => {
  if (!state.data.reminders) return;
  state.data.reminders = state.data.reminders.map(r => r.id === id ? { ...r, done: true } : r);
  state.reminderArchivePrompt = id;
  saveData();
  render();
};
window.confirmArchiveReminder = (id) => {
  const rem = (state.data.reminders || []).find(r => r.id === id);
  if (rem) {
    if (!state.data.remindersArchived) state.data.remindersArchived = [];
    state.data.remindersArchived = [{ ...rem, archivedAt: Date.now() }, ...state.data.remindersArchived];
    state.data.reminders = state.data.reminders.filter(r => r.id !== id);
  }
  state.reminderArchivePrompt = null;
  saveData();
  render();
};
window.dismissArchivePrompt = () => { state.reminderArchivePrompt = null; render(); };

// ── Archived reminder delete confirmation ─────────────────────────────────
window.promptDeleteArchivedReminder = (id) => { state.archivedDeleteConfirm = id; render(); };
window.executeDeleteArchivedReminder = (id) => {
  state.data.remindersArchived = (state.data.remindersArchived || []).filter(r => r.id !== id);
  state.archivedDeleteConfirm = null;
  saveData();
  render();
};
window.cancelDeleteArchivedReminder = () => { state.archivedDeleteConfirm = null; render(); };
window.updateReminderDeadlineDisplay = (val) => {
  const el = document.getElementById('new-reminder-deadline-display');
  if (!el) return;
  if (val) {
    const dt = new Date(val + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const ord = n => n + (n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
    el.textContent = '📅 ' + ord(dt.getDate()) + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
    el.style.color = '#C9A84C';
  } else {
    el.textContent = '📅 Set deadline (optional)';
    el.style.color = 'rgba(255,255,255,0.3)';
  }
};

window.editReminder = (id) => {
  const rem = (state.data.reminders || []).find(r => r.id === id);
  if (!rem) return;
  state.reminderEditing = id;
  state.reminderEditDraft = { text: rem.text, deadline: rem.deadline || '' };
  render();
};
window.saveReminderEdit = (id) => {
  const textEl = document.getElementById(`reminder-edit-text-${id}`);
  const deadlineEl = document.getElementById(`reminder-edit-deadline-${id}`);
  const text = textEl?.value?.trim();
  if (!text) return;
  state.data.reminders = (state.data.reminders || []).map(r =>
    r.id === id ? { ...r, text, deadline: deadlineEl?.value || null } : r
  );
  state.reminderEditing = null;
  state.reminderEditDraft = {};
  saveData();
};
window.cancelReminderEdit = () => { state.reminderEditing = null; state.reminderEditDraft = {}; render(); };
window.updateReminderEditDeadlineDisplay = (id, val) => {
  const el = document.getElementById(`reminder-edit-deadline-display-${id}`);
  if (!el) return;
  if (val) {
    const dt = new Date(val + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const ord = n => n + (n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
    el.textContent = '📅 ' + ord(dt.getDate()) + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
    el.style.color = '#8B6914';
  } else {
    el.textContent = '📅 Set deadline (optional)';
    el.style.color = '#9aaabf';
  }
};
window.addReminderToPlanner = (id) => {
  const rem = (state.data.reminders || []).find(r => r.id === id);
  if (!rem) return;

  // Weekly planner stores in localStorage under 'weekly_state', NOT Firebase.
  // Day index: Mon=0 ... Sun=6  (same as (getDay()+6)%7)
  const today = new Date(); today.setHours(0,0,0,0);
  const dayIdx = (today.getDay() + 6) % 7;

  // Replicate wkGetKey(0) — ISO week number key e.g. '2026-W17'
  const mon = new Date(today);
  mon.setDate(today.getDate() - (today.getDay()===0 ? 6 : today.getDay()-1));
  const u = new Date(Date.UTC(mon.getFullYear(), mon.getMonth(), mon.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay()||7));
  const y1 = new Date(Date.UTC(u.getUTCFullYear(),0,1));
  const wn = Math.ceil((((u-y1)/86400000)+1)/7);
  const weekKey = mon.getFullYear()+'-W'+String(wn).padStart(2,'0');

  let all = {};
  try { all = JSON.parse(localStorage.getItem('weekly_state')||'{}'); } catch {}
  if (!all[weekKey]) all[weekKey] = { objectives:[], days:[{},{},{},{},{},{},{}] };
  while (all[weekKey].days.length < 7) all[weekKey].days.push({});

  const dayData = all[weekKey].days[dayIdx];
  if (!dayData.tasks) dayData.tasks = [];

  if (dayData.tasks.some(t => t.name === rem.text)) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#f39c12;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:9999;white-space:nowrap;';
    el.textContent = 'Already in today\'s planner';
    document.body.appendChild(el); setTimeout(()=>el.remove(),2000);
    return;
  }

  dayData.tasks.push({ name: rem.text, done: false, period: 'am' });
  localStorage.setItem('weekly_state', JSON.stringify(all));

  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:9999;white-space:nowrap;';
  el.textContent = '✓ Added to today\'s planner!';
  document.body.appendChild(el); setTimeout(()=>el.remove(),2000);
};

window.togglePlannerTask = (weekKey, dayIdx, taskIdx) => {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('weekly_state')||'{}'); } catch {}
  const task = all[weekKey]?.days?.[dayIdx]?.tasks?.[taskIdx];
  if (!task) return;
  all[weekKey].days[dayIdx].tasks[taskIdx] = { ...task, done: !task.done };
  localStorage.setItem('weekly_state', JSON.stringify(all));
  render();
};

window.toggleNewReminderType = (type) => { state.newReminderType = type; render(); };
window.toggleReminderExpand  = (id) => { state.reminderExpanded = state.reminderExpanded === id ? null : id; render(); };
window.addChecklistItem = (id) => {
  const input = document.getElementById(`checklist-add-${id}`);
  const text = input?.value?.trim();
  if (!text) return;
  state.data.reminders = (state.data.reminders || []).map(r => {
    if (r.id !== id) return r;
    const items = [...(r.items || []), { id: 'ci_' + Date.now(), text, done: false }];
    return { ...r, items };
  });
  saveData();
};
window.toggleChecklistItem = (remId, itemIdx) => {
  state.data.reminders = (state.data.reminders || []).map(r => {
    if (r.id !== remId) return r;
    const items = (r.items || []).map((it, i) => i === itemIdx ? { ...it, done: !it.done } : it);
    const done = items.length > 0 && items.every(it => it.done);
    return { ...r, items, done };
  });
  saveData();
};
window.deleteChecklistItem = (remId, itemIdx) => {
  state.data.reminders = (state.data.reminders || []).map(r => {
    if (r.id !== remId) return r;
    const items = (r.items || []).filter((_, i) => i !== itemIdx);
    return { ...r, items };
  });
  saveData();
};

window.toggleCompletedTasks = () => { state.completedTasksOpen = !state.completedTasksOpen; render(); };

// ── Monthly Objective Review ───────────────────────────────────────────────
window.openObjReview = (monthKey, idx) => {
  if (state.objReviewing?.monthKey === monthKey && state.objReviewing?.idx === idx) {
    state.objReviewing = null; state.objReviewDraft = {}; render(); return;
  }
  const obj = state.data.monthObjectives?.[monthKey]?.[idx];
  if (!obj) return;
  const existing = obj.review || {};
  state.objReviewing = { monthKey, idx };
  state.objReviewDraft = {
    outcome: existing.outcome || (obj.done ? 'completed' : null),
    response: existing.response || '',
    lessons: existing.lessons || ''
  };
  render();
};
window.setObjReviewOutcome = (outcome) => {
  state.objReviewDraft = { ...state.objReviewDraft, outcome };
  render();
};
window.saveObjReview = (monthKey, idx) => {
  const responseEl = document.getElementById(`obj-review-response-${idx}`);
  const lessonsEl  = document.getElementById(`obj-review-lessons-${idx}`);
  const response = responseEl?.value?.trim() || '';
  const lessons  = lessonsEl?.value?.trim()  || '';
  const outcome  = state.objReviewDraft.outcome;
  if (!state.data.monthObjectives?.[monthKey]?.[idx]) return;
  state.data.monthObjectives[monthKey][idx] = {
    ...state.data.monthObjectives[monthKey][idx],
    done: outcome === 'completed',
    review: { outcome, response, lessons }
  };
  state.objReviewing = null; state.objReviewDraft = {};
  saveData();
};
window.closeObjReview = () => { state.objReviewing = null; state.objReviewDraft = {}; render(); };

// ── Today's Fronts — edit & delete ────────────────────────────────────────
window.deleteFrontTask = (key, taskText, taskIdx) => {
  state.frontTaskDeleteConfirm = { key, taskText, taskIdx };
  render();
};
window.confirmFrontTaskDelete = () => {
  const { key, taskIdx } = state.frontTaskDeleteConfirm || {};
  const wk = getWeekKey();
  const dk = getTodayDayKey();
  const tasks = state.data.projectFronts?.[key]?.weekPlans?.[wk]?.[dk];
  if (Array.isArray(tasks)) {
    state.data.projectFronts[key].weekPlans[wk][dk] = tasks.filter((_, i) => i !== taskIdx);
  }
  state.frontTaskDeleteConfirm = null;
  saveData();
};
window.cancelFrontTaskDelete = () => { state.frontTaskDeleteConfirm = null; render(); };
window.editFrontTask = (key, oldText, taskIdx) => {
  state.frontTaskEditing = { key, oldText, taskIdx };
  render();
};
window.saveFrontTaskEdit = (key, oldText, taskIdx) => {
  const newText = document.getElementById('front-task-edit-input')?.value?.trim();
  if (!newText) return;
  const wk = getWeekKey();
  const dk = getTodayDayKey();
  const tasks = state.data.projectFronts?.[key]?.weekPlans?.[wk]?.[dk];
  if (Array.isArray(tasks)) {
    state.data.projectFronts[key].weekPlans[wk][dk] = tasks.map((t, i) => {
      if (i !== taskIdx) return t;
      return typeof t === 'object' ? { ...t, text: newText } : newText;
    });
  }
  state.frontTaskEditing = null;
  saveData();
};
window.cancelFrontTaskEdit = () => { state.frontTaskEditing = null; render(); };

// ── Auth listener ──────────────────────────────────────────────────────────
window.state = state;
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) { await loadData(); syncCalendarToDataMonth(); await loadHealthData(); }
  render();
});
