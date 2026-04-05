// scripts/renderVisionTab.js
// Vision Board Tab — daily visualisation with AI-distilled statements
// Integrates with Firebase Firestore + Anthropic API

// API key stored in localStorage — never in code
const LS_KEY = 'tjm_anthropic_key';
function getApiKey() { return localStorage.getItem(LS_KEY) || ''; }
function saveApiKey(k) { localStorage.setItem(LS_KEY, k.trim()); }

// Firebase modular imports (v9)
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, writeBatch } from './firebase.js';

/* ─────────────────────────────────────────────────────────────────────
   ROOM CONFIGURATION
───────────────────────────────────────────────────────────────────── */
export const DEFAULT_ROOMS = [
  { id: 'health',        label: 'Health & Body',        emoji: '🏋️', desc: 'Body, fitness, energy and vitality' },
  {
    id: 'business', label: 'Business & Wealth', emoji: '💼', isFolder: true,
    defaultSubRooms: [
      { id: 'biz_wealth', label: 'Wealth & Finances',      emoji: '💰', desc: 'Net worth, income and financial freedom' },
      { id: 'biz_tjm',    label: 'The Jewellery Merchant', emoji: '💍', desc: 'Brand, scale and global impact' },
      { id: 'biz_vinted', label: 'Vinted',                 emoji: '👗', desc: 'Reselling income and pipeline' },
      { id: 'biz_total',  label: 'Total Picture',          emoji: '🗺️', desc: 'AI-synthesised command centre — all rooms blended', isTotalPicture: true },
    ]
  },
  { id: 'lifestyle',     label: 'Lifestyle & Home',     emoji: '🏠', desc: 'Where you live and how you spend your days' },
  { id: 'relationships', label: 'Relationships',        emoji: '🤝', desc: 'The people who matter most' },
  { id: 'legacy',        label: 'Legacy & Impact',      emoji: '🌍', desc: 'The mark you leave on the world' },
  { id: 'identity',      label: 'Identity & Character', emoji: '🧠', desc: 'Who you are becoming' },
];

/* ─────────────────────────────────────────────────────────────────────
   MODULE STATE
───────────────────────────────────────────────────────────────────── */
let _deps = null;
let _view = 'overview';   // 'overview' | 'folder' | 'room'
let _folderId = null;
let _room = null;         // { id, label, emoji }
let _statement = '';
let _entries = [];
let _showEntries = false;
let _distilling = false;
let _saving = false;
let _editId = null;
let _customSubRooms = []; // user-added ventures under business folder

// Total Picture state
let _tp_data       = null;   // { vision, currentReality, objectives, weeklyRoadmap, amendments, generatedAt }
let _tp_generating = false;
let _tp_amending   = false;
let _tp_amendDraft = '';

// Weekly review + accountability state
let _weeklyReview = null;       // { answers, ts }
let _realityCheck = '';         // AI-generated gap analysis
let _focusPlan = '';            // AI-generated 30-day focus
let _loadingRealityCheck = false;
let _loading30Day = false;
let _showReviewBanner = false;
let _overdueRooms = new Set();  // room ids where weekly review is overdue

/* ─────────────────────────────────────────────────────────────────────
   COLOUR TOKENS (light / dark aware)
───────────────────────────────────────────────────────────────────── */
function colors() {
  const light = document.body.classList.contains('light');
  return {
    heading:      light ? '#0A1628' : '#FFFFFF',
    subheading:   light ? '#1B3A6B' : 'rgba(255,255,255,0.7)',
    muted:        light ? '#8899B0' : 'rgba(255,255,255,0.4)',
    cardBg:       light ? '#FFFFFF' : 'rgba(255,255,255,0.04)',
    cardBorder:   light ? '#CDD4E0' : 'rgba(255,255,255,0.08)',
    cardHover:    light ? '#F0F4FA' : 'rgba(255,255,255,0.07)',
    inputBg:      light ? '#F0F4FA' : 'rgba(255,255,255,0.06)',
    inputBorder:  light ? '#CDD4E0' : 'rgba(255,255,255,0.12)',
    inputText:    light ? '#0A1628' : '#FFFFFF',
    statementBg:  light ? '#FFFBF0' : 'rgba(201,168,76,0.07)',
    statementBdr: light ? '#C9A84C' : 'rgba(201,168,76,0.4)',
    statementTxt: light ? '#5C4A00' : 'rgba(255,245,210,0.95)',
    emptyTxt:     light ? '#8899B0' : 'rgba(255,255,255,0.25)',
    gold:         light ? '#B8962E' : '#C9A84C',
    goldBtn:      light ? '#1B3A6B' : '#C9A84C',
    goldBtnTxt:   light ? '#FFFFFF' : '#0A1628',
    dangerTxt:    light ? '#C0392B' : '#FF6B6B',
    divider:      light ? '#E4E9F2' : 'rgba(255,255,255,0.06)',
    pageBg:       light ? '#F0F4FA' : 'transparent',
    backBtn:      light ? '#1B3A6B' : 'rgba(255,255,255,0.15)',
    backBtnTxt:   light ? '#FFFFFF' : 'rgba(255,255,255,0.8)',
    streakPip:    light ? '#C9A84C' : '#C9A84C',
    folderBadge:  light ? '#E8EFF8' : 'rgba(255,255,255,0.08)',
    folderBadgeTxt: light ? '#1B3A6B' : 'rgba(255,255,255,0.5)',
  };
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN ENTRY — called by app.js tab switch
───────────────────────────────────────────────────────────────────── */
export async function renderVisionTab(deps) {
  _deps = deps;
  _view = 'overview';
  _folderId = null;
  _room = null;
  await _loadCustomSubRooms();
  await _loadAllRoomReviewStatus();
  _paintOverview();
}

/* ─────────────────────────────────────────────────────────────────────
   OVERVIEW — all room cards
───────────────────────────────────────────────────────────────────── */
function _paintOverview() {
  const c = colors();
  const panel = _panel();
  if (!panel) return;

  // Inject keyframes once
  if (!document.getElementById('vision-overdue-styles')) {
    const style = document.createElement('style');
    style.id = 'vision-overdue-styles';
    style.textContent = `
      @keyframes visionOverduePulse {
        0%,100% { border-color: rgba(231,76,60,0.5); box-shadow: none; }
        50%      { border-color: rgba(231,76,60,1);   box-shadow: 0 0 12px rgba(231,76,60,0.4); }
      }
      @keyframes visionDotPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:0.4; transform:scale(1.4); }
      }
    `;
    document.head.appendChild(style);
  }

  const roomsWithMeta = DEFAULT_ROOMS.map(r => {
    if (r.isFolder) {
      const subs = [...r.defaultSubRooms, ..._customSubRooms];
      return { ...r, count: subs.length };
    }
    return r;
  });

  panel.innerHTML = `
    <div class="vision-page" style="background:${c.pageBg};min-height:100%;padding:24px 20px 80px;">
      <div class="vision-header" style="margin-bottom:28px;">
        <div style="font-size:22px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;">
          🔮 Vision Board
        </div>
        <div style="font-size:12px;color:${c.muted};letter-spacing:1px;margin-top:4px;font-weight:600;">
          Write your future. Distil it to clarity.
        </div>
      </div>

      <div class="vision-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${roomsWithMeta.map(r => _roomCard(r, c)).join('')}
      </div>
    </div>
  `;

  // Attach card listeners
  panel.querySelectorAll('[data-vision-room]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.visionRoom;
      const room = DEFAULT_ROOMS.find(r => r.id === id);
      if (room && room.isFolder) {
        _openFolder(room);
      } else {
        const flatRoom = _findRoom(id);
        if (flatRoom) _openRoom(flatRoom);
      }
    });
  });
}

function _roomCard(r, c) {
  const isFolder = !!r.isFolder;
  const isOverdue = !isFolder && _overdueRooms.has(r.id);

  // For folders, check if any sub-room is overdue
  const folderOverdue = isFolder && (
    [...(r.defaultSubRooms || []), ..._customSubRooms].some(s => _overdueRooms.has(s.id))
  );
  const needsAttention = isOverdue || folderOverdue;

  return `
    <div
      data-vision-room="${r.id}"
      class="vision-card${needsAttention ? ' vision-overdue' : ''}"
      style="
        background:${c.cardBg};
        border:1px solid ${needsAttention ? 'rgba(231,76,60,0.7)' : c.cardBorder};
        border-radius:14px;
        padding:18px 14px 16px;
        cursor:pointer;
        transition:all .18s ease;
        position:relative;
        overflow:hidden;
        ${needsAttention ? 'animation:visionOverduePulse 1.6s ease-in-out infinite;' : ''}
      "
      onmouseover="this.style.background='${c.cardHover}';this.style.borderColor='${needsAttention ? 'rgba(231,76,60,1)' : c.gold}'"
      onmouseout="this.style.background='${c.cardBg}';this.style.borderColor='${needsAttention ? 'rgba(231,76,60,0.7)' : c.cardBorder}'"
    >
      ${needsAttention ? `<div style="position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#e74c3c;animation:visionDotPulse 1.6s ease-in-out infinite;"></div>` : ''}
      <div style="font-size:28px;margin-bottom:10px;">${r.emoji}</div>
      <div style="font-size:12px;font-weight:900;letter-spacing:1.5px;color:${needsAttention ? '#e74c3c' : c.heading};text-transform:uppercase;line-height:1.3;margin-bottom:6px;">${r.label}</div>
      <div style="font-size:11px;color:${c.muted};font-weight:600;line-height:1.4;">${r.desc || ''}</div>
      ${isFolder
        ? `<div style="margin-top:10px;font-size:10px;font-weight:800;letter-spacing:1px;color:${folderOverdue ? '#e74c3c' : c.folderBadgeTxt};background:${folderOverdue ? 'rgba(231,76,60,0.1)' : c.folderBadge};border-radius:6px;padding:3px 8px;display:inline-block;">${folderOverdue ? '⚠ REVIEW DUE' : r.count + ' ROOMS →'}</div>`
        : isOverdue
          ? `<div style="margin-top:10px;font-size:10px;color:#e74c3c;font-weight:900;letter-spacing:1px;">⚠ REVIEW DUE</div>`
          : `<div style="margin-top:10px;font-size:10px;color:${c.gold};font-weight:800;letter-spacing:1px;">ENTER →</div>`
      }
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────
   FOLDER VIEW — Business & Wealth sub-rooms
───────────────────────────────────────────────────────────────────── */
function _openFolder(folder) {
  _view = 'folder';
  _folderId = folder.id;
  const c = colors();
  const panel = _panel();
  if (!panel) return;

  const subs = [...folder.defaultSubRooms, ..._customSubRooms];

  panel.innerHTML = `
    <div class="vision-page" style="background:${c.pageBg};min-height:100%;padding:24px 20px 80px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
        <button id="vision-back" style="${_backBtnStyle(c)}">← Back</button>
        <div>
          <div style="font-size:18px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;">${folder.emoji} ${folder.label}</div>
          <div style="font-size:11px;color:${c.muted};letter-spacing:1px;font-weight:600;">Select a room to enter</div>
        </div>
      </div>

      <div class="vision-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        ${subs.map(r => _roomCard({ ...r, desc: r.desc || '' }, c)).join('')}
      </div>

      <button id="vision-add-venture" style="
        width:100%;padding:14px;
        background:${c.cardBg};border:1.5px dashed ${c.cardBorder};
        border-radius:14px;color:${c.muted};
        font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;
        cursor:pointer;margin-top:4px;transition:all .18s;
      "
      onmouseover="this.style.borderColor='${c.gold}';this.style.color='${c.gold}'"
      onmouseout="this.style.borderColor='${c.cardBorder}';this.style.color='${c.muted}'"
      >+ Add New Venture</button>
    </div>
  `;

  panel.querySelector('#vision-back').addEventListener('click', () => {
    _view = 'overview';
    _paintOverview();
  });

  panel.querySelectorAll('[data-vision-room]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.visionRoom;
      const room = _findRoom(id);
      if (room) _openRoom(room);
    });
  });

  panel.querySelector('#vision-add-venture').addEventListener('click', _showAddVentureModal);
}

/* ─────────────────────────────────────────────────────────────────────
   ROOM VIEW — vision statement + entry form
───────────────────────────────────────────────────────────────────── */
async function _openRoom(room) {
  // Total Picture is a special read-only AI room — route separately
  if (room.id === 'biz_total') { await _openTotalPicture(); return; }

  _view = 'room';
  _room = room;
  _showEntries = false;
  _editId = null;

  const c = colors();
  const panel = _panel();
  if (!panel) return;

  // Loading state
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:200px;">
      <div style="color:${c.muted};font-size:13px;font-weight:700;letter-spacing:2px;">LOADING…</div>
    </div>
  `;

  // Load from Firebase
  await _loadRoomData(room.id);

  // Check if Sunday review is due
  const today = new Date();
  const isSunday = today.getDay() === 0;
  const lastReviewTs = _weeklyReview?.ts || 0;
  const daysSinceReview = (Date.now() - lastReviewTs) / (1000 * 60 * 60 * 24);
  _showReviewBanner = isSunday || daysSinceReview >= 7;

  _paintRoom(c);
}

function _paintRoom(c) {
  c = c || colors();
  const panel = _panel();
  if (!panel || !_room) return;

  const fromFolder = _folderId !== null;
  const hasStatement = _statement && _statement.trim().length > 0;
  const todayStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const entryCount = _entries.length;

  panel.innerHTML = `
    <div class="vision-page" style="background:${c.pageBg};min-height:100%;padding:24px 20px 80px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <button id="vision-back" style="${_backBtnStyle(c)}">← Back</button>
        <div>
          <div style="font-size:18px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;">${_room.emoji} ${_room.label}</div>
          <div style="font-size:11px;color:${c.muted};letter-spacing:1px;font-weight:600;">${todayStr}</div>
        </div>
      </div>

      <!-- Vision Statement -->
      <div style="
        background:${c.statementBg};
        border:1.5px solid ${c.statementBdr};
        border-radius:14px;
        padding:18px 16px;
        margin-bottom:20px;
      ">
        <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.gold};text-transform:uppercase;margin-bottom:10px;">✦ Your Vision</div>
        ${hasStatement
          ? `<div id="vision-statement-text" style="font-size:14px;line-height:1.75;color:${c.statementTxt};font-weight:600;">${_nl2br(_statement)}</div>`
          : `<div style="font-size:13px;color:${c.emptyTxt};font-weight:600;font-style:italic;line-height:1.6;">Your vision will crystallise here as you write. Add your first entry below to begin.</div>`
        }
        ${hasStatement ? `
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
            <button id="vision-redisil" style="${_smallBtnStyle(c, false)}"
              ${_distilling ? 'disabled' : ''}>
              ${_distilling ? '⟳ Distilling…' : '⟳ Re-distil'}
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Weekly Review Banner -->
      ${_showReviewBanner ? `
        <div style="
          background:linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05));
          border:1.5px solid ${c.gold};
          border-radius:14px;
          padding:16px;
          margin-bottom:16px;
          display:flex;align-items:center;gap:14px;
        ">
          <div style="font-size:28px;flex-shrink:0;">📋</div>
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${c.gold};text-transform:uppercase;margin-bottom:3px;">Weekly Review Due</div>
            <div style="font-size:12px;color:${c.subheading};font-weight:600;line-height:1.5;">
              ${_weeklyReview ? 'Time for your weekly check-in — update your reality to keep this sharp.' : 'Complete your first weekly review to unlock your Reality Check & 30-Day Focus.'}
            </div>
          </div>
          <button id="vision-start-review" style="
            background:${c.goldBtn};color:${c.goldBtnTxt};
            border:none;border-radius:10px;
            padding:10px 14px;font-size:11px;font-weight:900;
            letter-spacing:1px;text-transform:uppercase;
            cursor:pointer;white-space:nowrap;flex-shrink:0;
          ">Start →</button>
        </div>
      ` : `
        <button id="vision-start-review" style="
          width:100%;padding:10px;
          background:transparent;border:1px dashed ${c.cardBorder};
          border-radius:10px;color:${c.muted};
          font-size:10px;font-weight:800;letter-spacing:1.5px;
          text-transform:uppercase;cursor:pointer;margin-bottom:16px;
          transition:all .18s;
        "
        onmouseover="this.style.borderColor='${c.gold}';this.style.color='${c.gold}'"
        onmouseout="this.style.borderColor='${c.cardBorder}';this.style.color='${c.muted}'"
        >📋 ${_weeklyReview ? 'Update Weekly Review' : 'Do Weekly Review'}</button>
      `}

      <!-- Reality Check -->
      ${hasStatement ? `
        <div style="
          background:${c.cardBg};
          border:1px solid ${c.cardBorder};
          border-radius:14px;
          padding:18px 16px;
          margin-bottom:14px;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;">🔍 Reality Check</div>
            ${_weeklyReview ? `<button id="vision-refresh-reality" style="${_smallBtnStyle(c, false)}" ${_loadingRealityCheck ? 'disabled' : ''}>${_loadingRealityCheck ? '⟳ Analysing…' : '⟳ Refresh'}</button>` : ''}
          </div>
          ${_loadingRealityCheck
            ? `<div style="font-size:12px;color:${c.muted};font-weight:600;font-style:italic;">Analysing the gap…</div>`
            : _realityCheck
              ? `<div style="font-size:13px;line-height:1.75;color:${c.subheading};font-weight:600;">${_nl2br(_realityCheck)}</div>
                 ${_weeklyReview ? `<div style="font-size:10px;color:${c.muted};margin-top:10px;font-weight:700;">Last review: ${_fmtDate(_weeklyReview.ts)}</div>` : ''}`
              : `<div style="font-size:12px;color:${c.emptyTxt};font-weight:600;font-style:italic;line-height:1.6;">
                  Complete a weekly review and your reality check will appear here — an honest comparison of where you are vs who your vision says you are.
                </div>`
          }
        </div>

        <!-- 30-Day Focus -->
        <div style="
          background:${c.cardBg};
          border:1px solid ${c.cardBorder};
          border-radius:14px;
          padding:18px 16px;
          margin-bottom:20px;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;">🎯 Monthly Focus</div>
            ${_weeklyReview ? `<button id="vision-refresh-focus" style="${_smallBtnStyle(c, false)}" ${_loading30Day ? 'disabled' : ''}>${_loading30Day ? '⟳ Building…' : '⟳ Refresh'}</button>` : ''}
          </div>
          ${_loading30Day
            ? `<div style="font-size:12px;color:${c.muted};font-weight:600;font-style:italic;">Building your monthly plan…</div>`
            : (() => {
                if (!_focusPlan) return `<div style="font-size:12px;color:${c.emptyTxt};font-weight:600;font-style:italic;line-height:1.6;">Complete a weekly review to unlock your monthly plan — a calendar-month objective broken into 4 focused weeks with guidance to overcome what's holding you back.</div>`;
                let plan;
                try { plan = JSON.parse(_focusPlan); } catch(e) { plan = null; }
                if (!plan || !plan.weeks) return `<div style="font-size:13px;line-height:1.75;color:${c.subheading};font-weight:600;">${_nl2br(_focusPlan)}</div>`;

                const weekColors = ['#4A90D9','#C9A84C','#2ECC71','#9B59B6'];
                const weekLabels = ['WEEK 1 — FOUNDATIONS','WEEK 2 — MOMENTUM','WEEK 3 — PUSH','WEEK 4 — LOCK IN'];

                return `
                  <!-- Month Objective -->
                  <div style="
                    background:${c.statementBg};
                    border:1.5px solid ${c.statementBdr};
                    border-radius:12px;
                    padding:14px 16px;
                    margin-bottom:16px;
                  ">
                    <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${c.gold};text-transform:uppercase;margin-bottom:6px;">THIS MONTH'S OBJECTIVE</div>
                    <div style="font-size:13px;font-weight:800;color:${c.statementTxt};line-height:1.5;">${_escHtml(plan.monthObjective)}</div>
                  </div>

                  <!-- Week cards -->
                  <div style="display:flex;flex-direction:column;gap:10px;">
                    ${plan.weeks.map((w, i) => `
                      <div style="
                        border-left:3px solid ${weekColors[i] || c.gold};
                        border-radius:0 10px 10px 0;
                        background:${c.cardBg};
                        border-top:1px solid ${c.cardBorder};
                        border-right:1px solid ${c.cardBorder};
                        border-bottom:1px solid ${c.cardBorder};
                        padding:12px 14px;
                      ">
                        <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${weekColors[i] || c.gold};text-transform:uppercase;margin-bottom:5px;">${weekLabels[i] || 'WEEK ' + w.week}</div>
                        <div style="font-size:13px;font-weight:800;color:${c.heading};margin-bottom:8px;line-height:1.4;">${_escHtml(w.focus)}</div>
                        <ul style="margin:0 0 10px 0;padding-left:16px;">
                          ${(w.actions || []).map(act => `<li style="font-size:12px;color:${c.subheading};font-weight:600;line-height:1.55;margin-bottom:3px;">${_escHtml(act)}</li>`).join('')}
                        </ul>
                        ${w.challenge ? `
                          <div style="
                            background:rgba(255,100,100,0.07);
                            border:1px solid rgba(255,100,100,0.2);
                            border-radius:8px;
                            padding:9px 11px;
                            font-size:11px;color:${c.subheading};font-weight:600;line-height:1.55;
                          ">
                            <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:${c.dangerTxt};text-transform:uppercase;">⚠ Watch for: </span>${_escHtml(w.challenge)}
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                `;
              })()
          }
        </div>
      ` : ''}

      <!-- Entry Composer -->
      <div style="
        background:${c.cardBg};
        border:1px solid ${c.cardBorder};
        border-radius:14px;
        padding:18px 16px;
        margin-bottom:16px;
      ">
        <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;margin-bottom:12px;">Write Today's Vision</div>
        <div style="font-size:11px;color:${c.muted};margin-bottom:10px;font-weight:600;font-style:italic;">Write in present tense, as if it's already real. "I wake up in…", "I have…", "I am…"</div>
        <textarea
          id="vision-entry-input"
          placeholder="I wake up every morning with total clarity about my purpose…"
          style="
            width:100%;min-height:120px;
            background:${c.inputBg};
            border:1px solid ${c.inputBorder};
            border-radius:10px;
            color:${c.inputText};
            font-size:14px;line-height:1.7;
            padding:12px 14px;
            font-family:inherit;font-weight:600;
            resize:vertical;box-sizing:border-box;
            outline:none;
          "
        ></textarea>
        <button
          id="vision-submit"
          style="
            margin-top:12px;width:100%;
            background:${c.goldBtn};color:${c.goldBtnTxt};
            border:none;border-radius:10px;
            padding:13px;font-size:12px;font-weight:900;
            letter-spacing:2px;text-transform:uppercase;
            cursor:pointer;transition:opacity .15s;
          "
          ${_saving ? 'disabled' : ''}
        >${_saving ? 'SAVING…' : 'SAVE & DISTIL VISION'}</button>
      </div>

      <!-- Entries toggle -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${_showEntries ? '12px' : '0'};">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:${c.muted};text-transform:uppercase;">
          ${entryCount} ${entryCount === 1 ? 'Entry' : 'Entries'} Saved
        </div>
        <div style="display:flex;gap:8px;">
          ${entryCount > 0 ? `<button id="vision-toggle-entries" style="${_smallBtnStyle(c, false)}">${_showEntries ? 'Hide Entries' : 'View & Edit'}</button>` : ''}
          <button id="vision-reset" style="${_smallBtnStyle(c, true)}">Reset Room</button>
        </div>
      </div>

      <!-- Entries list -->
      ${_showEntries ? _renderEntriesList(c) : ''}
    </div>

    <!-- Add Venture Modal Slot -->
    <div id="vision-modal-slot"></div>
  `;

  _attachRoomListeners(fromFolder);
}

function _renderEntriesList(c) {
  if (_entries.length === 0) return '';
  const sorted = [..._entries].sort((a, b) => b.ts - a.ts);
  return `
    <div style="margin-top:4px;display:flex;flex-direction:column;gap:10px;">
      ${sorted.map(e => `
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:12px;padding:14px 14px 12px;
        ">
          ${_editId === e.id ? `
            <textarea id="vision-edit-input-${e.id}" style="
              width:100%;min-height:80px;
              background:${c.inputBg};border:1px solid ${c.inputBorder};
              border-radius:8px;color:${c.inputText};
              font-size:13px;line-height:1.65;padding:10px 12px;
              font-family:inherit;font-weight:600;resize:vertical;
              box-sizing:border-box;outline:none;
            ">${_escHtml(e.text)}</textarea>
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button data-save-edit="${e.id}" style="${_smallBtnStyle(c, false)}">Save Edit</button>
              <button data-cancel-edit style="${_smallBtnStyle(c, true)}">Cancel</button>
            </div>
          ` : `
            <div style="font-size:13px;line-height:1.65;color:${c.subheading};font-weight:600;margin-bottom:10px;">${_nl2br(_escHtml(e.text))}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-size:10px;color:${c.muted};font-weight:700;letter-spacing:1px;">${_fmtDate(e.ts)}</div>
              <div style="display:flex;gap:8px;">
                <button data-edit-entry="${e.id}" style="${_smallBtnStyle(c, false)}">Edit</button>
                <button data-delete-entry="${e.id}" style="${_smallBtnStyle(c, true)}">Delete</button>
              </div>
            </div>
          `}
        </div>
      `).join('')}
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────────────────────────────── */
function _attachRoomListeners(fromFolder) {
  const panel = _panel();
  if (!panel) return;
  const c = colors();

  // Back
  panel.querySelector('#vision-back')?.addEventListener('click', () => {
    if (fromFolder) {
      const folder = DEFAULT_ROOMS.find(r => r.id === _folderId);
      if (folder) { _openFolder(folder); return; }
    }
    _view = 'overview';
    _paintOverview();
  });

  // Submit entry
  panel.querySelector('#vision-submit')?.addEventListener('click', async () => {
    const ta = panel.querySelector('#vision-entry-input');
    const text = (ta?.value || '').trim();
    if (!text) { _toast('Write something first.', c); return; }
    _saving = true;
    _paintRoom();
    await _saveEntry(text);
    _saving = false;
    _distilling = true;
    _paintRoom();
    await _doDistil();
    _distilling = false;
    _paintRoom();
  });

  // Re-distil
  panel.querySelector('#vision-redisil')?.addEventListener('click', async () => {
    if (_distilling) return;
    _distilling = true;
    _paintRoom();
    await _doDistil();
    _distilling = false;
    _paintRoom();
  });

  // Weekly Review
  panel.querySelector('#vision-start-review')?.addEventListener('click', async () => {
    await _showWeeklyReviewModal();
  });

  // Refresh Reality Check
  panel.querySelector('#vision-refresh-reality')?.addEventListener('click', async () => {
    if (_loadingRealityCheck) return;
    _loadingRealityCheck = true;
    _paintRoom();
    await _doRealityCheck();
    _loadingRealityCheck = false;
    _paintRoom();
  });

  // Refresh 30-Day Focus
  panel.querySelector('#vision-refresh-focus')?.addEventListener('click', async () => {
    if (_loading30Day) return;
    _loading30Day = true;
    _paintRoom();
    await _do30DayFocus();
    _loading30Day = false;
    _paintRoom();
  });

  // Toggle entries
  panel.querySelector('#vision-toggle-entries')?.addEventListener('click', () => {
    _showEntries = !_showEntries;
    _paintRoom();
  });

  // Reset room
  panel.querySelector('#vision-reset')?.addEventListener('click', () => {
    _showResetConfirm(c);
  });

  // Entry actions (delegated)
  panel.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-entry]');
    const delBtn  = e.target.closest('[data-delete-entry]');
    const saveBtn = e.target.closest('[data-save-edit]');
    const cancelBtn = e.target.closest('[data-cancel-edit]');

    if (editBtn) {
      _editId = editBtn.dataset.editEntry;
      _showEntries = true;
      _paintRoom();
    }
    if (delBtn) {
      _deleteEntry(delBtn.dataset.deleteEntry);
    }
    if (saveBtn) {
      const id = saveBtn.dataset.saveEdit;
      const ta = panel.querySelector(`#vision-edit-input-${id}`);
      const newText = (ta?.value || '').trim();
      if (newText) _updateEntry(id, newText);
      _editId = null;
    }
    if (cancelBtn) {
      _editId = null;
      _paintRoom();
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────
   ADD VENTURE MODAL
───────────────────────────────────────────────────────────────────── */
function _showAddVentureModal() {
  const c = colors();
  const slot = document.querySelector('#vision-modal-slot') || _panel();

  const overlay = document.createElement('div');
  overlay.id = 'vision-add-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);
    display:flex;align-items:flex-end;justify-content:center;
    z-index:9999;padding:0;
  `;
  overlay.innerHTML = `
    <div style="
      background:${document.body.classList.contains('light') ? '#FFFFFF' : '#0E1C34'};
      border-radius:20px 20px 0 0;padding:28px 24px 48px;
      width:100%;max-width:480px;
    ">
      <div style="font-size:14px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;margin-bottom:4px;">+ New Venture</div>
      <div style="font-size:11px;color:${c.muted};margin-bottom:20px;font-weight:600;">Add a new business or project room</div>
      <input id="venture-emoji" placeholder="Emoji (e.g. 🏠)" maxlength="4" style="
        width:60px;background:${c.inputBg};border:1px solid ${c.inputBorder};
        border-radius:8px;color:${c.inputText};font-size:20px;
        padding:10px;box-sizing:border-box;margin-bottom:12px;text-align:center;outline:none;
      ">
      <input id="venture-name" placeholder="Venture name (e.g. Nottingham Insurance)" style="
        width:100%;background:${c.inputBg};border:1px solid ${c.inputBorder};
        border-radius:8px;color:${c.inputText};font-size:14px;font-weight:600;
        padding:12px 14px;box-sizing:border-box;margin-bottom:16px;outline:none;
        font-family:inherit;
      ">
      <div style="display:flex;gap:10px;">
        <button id="venture-cancel" style="flex:1;padding:13px;background:${c.cardBg};border:1px solid ${c.cardBorder};border-radius:10px;color:${c.subheading};font-size:12px;font-weight:800;letter-spacing:1px;cursor:pointer;">CANCEL</button>
        <button id="venture-save" style="flex:2;padding:13px;background:${c.goldBtn};color:${c.goldBtnTxt};border:none;border-radius:10px;font-size:12px;font-weight:900;letter-spacing:2px;cursor:pointer;text-transform:uppercase;">ADD ROOM</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#venture-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#venture-save').addEventListener('click', async () => {
    const emoji = (overlay.querySelector('#venture-emoji').value.trim() || '🏢');
    const name  = overlay.querySelector('#venture-name').value.trim();
    if (!name) return;
    const newRoom = {
      id:    'custom_' + Date.now(),
      label: name,
      emoji: emoji,
      desc:  '',
    };
    _customSubRooms.push(newRoom);
    await _saveCustomSubRooms();
    overlay.remove();
    // Re-open folder
    const folder = DEFAULT_ROOMS.find(r => r.isFolder);
    if (folder) _openFolder(folder);
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/* ─────────────────────────────────────────────────────────────────────
   RESET CONFIRM
───────────────────────────────────────────────────────────────────── */
function _showResetConfirm(c) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);
    display:flex;align-items:center;justify-content:center;
    z-index:9999;padding:24px;
  `;
  overlay.innerHTML = `
    <div style="
      background:${document.body.classList.contains('light') ? '#FFFFFF' : '#0E1C34'};
      border-radius:16px;padding:28px 24px;max-width:340px;width:100%;
    ">
      <div style="font-size:28px;text-align:center;margin-bottom:12px;">⚠️</div>
      <div style="font-size:14px;font-weight:900;color:${c.heading};text-align:center;margin-bottom:8px;">Reset This Room?</div>
      <div style="font-size:12px;color:${c.muted};text-align:center;line-height:1.6;margin-bottom:22px;font-weight:600;">
        This will permanently delete all entries and the vision statement for <strong>${_room?.label}</strong>. This cannot be undone.
      </div>
      <div style="display:flex;gap:10px;">
        <button id="reset-cancel" style="flex:1;padding:13px;background:${c.cardBg};border:1px solid ${c.cardBorder};border-radius:10px;color:${c.subheading};font-size:12px;font-weight:800;letter-spacing:1px;cursor:pointer;">CANCEL</button>
        <button id="reset-confirm" style="flex:1;padding:13px;background:#C0392B;border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer;text-transform:uppercase;">RESET</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#reset-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#reset-confirm').addEventListener('click', async () => {
    overlay.remove();
    await _resetRoom();
  });
}

/* ─────────────────────────────────────────────────────────────────────
   FIREBASE OPERATIONS
───────────────────────────────────────────────────────────────────── */
function _db() { return _deps?.db || window.db; }
function _uid() { return (_deps?.user || window.currentUser)?.uid; }

async function _loadRoomData(roomId) {
  _statement = '';
  _entries = [];
  _weeklyReview = null;
  _realityCheck = '';
  _focusPlan = '';
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;

    // Load statement doc (also holds realityCheck, focusPlan, weeklyReview)
    const stmtRef = doc(db, 'users', uid, 'visionRooms', roomId);
    const stmtSnap = await getDoc(stmtRef);
    if (stmtSnap.exists()) {
      const data = stmtSnap.data();
      _statement    = data.statement    || '';
      _realityCheck = data.realityCheck || '';
      _focusPlan    = data.focusPlan    || '';
      _weeklyReview = data.weeklyReview || null;
    }

    // Load entries
    const entriesRef = collection(db, 'users', uid, 'visionRooms', roomId, 'entries');
    const entriesQ = query(entriesRef, orderBy('ts', 'desc'));
    const entriesSnap = await getDocs(entriesQ);
    _entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('[Vision] loadRoomData error:', err);
  }
}

async function _saveEntry(text) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    const entriesRef = collection(db, 'users', uid, 'visionRooms', _room.id, 'entries');
    const ref = await addDoc(entriesRef, { text, ts: Date.now() });
    _entries.unshift({ id: ref.id, text, ts: Date.now() });
  } catch (err) {
    console.error('[Vision] saveEntry error:', err);
  }
}

async function _updateEntry(id, newText) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    const entryRef = doc(db, 'users', uid, 'visionRooms', _room.id, 'entries', id);
    await updateDoc(entryRef, { text: newText });
    const idx = _entries.findIndex(e => e.id === id);
    if (idx >= 0) _entries[idx].text = newText;
    _showEntries = true;
    _paintRoom();
  } catch (err) {
    console.error('[Vision] updateEntry error:', err);
  }
}

async function _deleteEntry(id) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    const entryRef = doc(db, 'users', uid, 'visionRooms', _room.id, 'entries', id);
    await deleteDoc(entryRef);
    _entries = _entries.filter(e => e.id !== id);
    _showEntries = true;
    _paintRoom();
  } catch (err) {
    console.error('[Vision] deleteEntry error:', err);
  }
}

async function _saveStatement(statement) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    const roomRef = doc(db, 'users', uid, 'visionRooms', _room.id);
    await setDoc(roomRef, { statement }, { merge: true });
    _statement = statement;
  } catch (err) {
    console.error('[Vision] saveStatement error:', err);
  }
}

async function _saveRealityCheck(text) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    await setDoc(doc(db, 'users', uid, 'visionRooms', _room.id), { realityCheck: text }, { merge: true });
    _realityCheck = text;
  } catch (err) { console.error('[Vision] saveRealityCheck error:', err); }
}

async function _saveFocusPlan(text) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    await setDoc(doc(db, 'users', uid, 'visionRooms', _room.id), { focusPlan: text }, { merge: true });
    _focusPlan = text;
  } catch (err) { console.error('[Vision] saveFocusPlan error:', err); }
}

async function _saveWeeklyReview(review) {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;
    await setDoc(doc(db, 'users', uid, 'visionRooms', _room.id), { weeklyReview: review }, { merge: true });
    _weeklyReview = review;
  } catch (err) { console.error('[Vision] saveWeeklyReview error:', err); }
}

async function _resetRoom() {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_room) return;

    const entriesRef = collection(db, 'users', uid, 'visionRooms', _room.id, 'entries');
    const snap = await getDocs(entriesRef);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'users', uid, 'visionRooms', _room.id));
    await batch.commit();

    _entries = [];
    _statement = '';
    _realityCheck = '';
    _focusPlan = '';
    _weeklyReview = null;
    _showReviewBanner = false;
    _showEntries = false;
    _paintRoom();
  } catch (err) {
    console.error('[Vision] resetRoom error:', err);
  }
}

async function _loadCustomSubRooms() {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;
    const snap = await getDoc(doc(db, 'users', uid, 'visionConfig', 'customRooms'));
    if (snap.exists()) {
      _customSubRooms = snap.data().rooms || [];
    } else {
      _customSubRooms = [];
    }
  } catch (err) {
    console.error('[Vision] loadCustomSubRooms error:', err);
    _customSubRooms = [];
  }
}

async function _saveCustomSubRooms() {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;
    await setDoc(doc(db, 'users', uid, 'visionConfig', 'customRooms'), { rooms: _customSubRooms });
  } catch (err) {
    console.error('[Vision] saveCustomSubRooms error:', err);
  }
}

async function _loadAllRoomReviewStatus() {
  _overdueRooms = new Set();
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;

    const today = new Date();
    const isSunday = today.getDay() === 0;

    // Collect all flat room IDs (non-folders)
    const allRoomIds = [];
    for (const r of DEFAULT_ROOMS) {
      if (r.isFolder) {
        [...(r.defaultSubRooms || []), ..._customSubRooms].forEach(s => allRoomIds.push(s.id));
      } else {
        allRoomIds.push(r.id);
      }
    }

    // Check each room's last review timestamp
    await Promise.all(allRoomIds.map(async (roomId) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid, 'visionRooms', roomId));
        if (!snap.exists()) {
          // Never had a review — always overdue
          _overdueRooms.add(roomId);
          return;
        }
        const review = snap.data().weeklyReview;
        if (!review) { _overdueRooms.add(roomId); return; }
        const daysSince = (Date.now() - (review.ts || 0)) / (1000 * 60 * 60 * 24);
        if (isSunday || daysSince >= 7) _overdueRooms.add(roomId);
      } catch (e) { /* skip room on error */ }
    }));
  } catch (err) {
    console.error('[Vision] loadAllRoomReviewStatus error:', err);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   API KEY PROMPT (one-time setup, stored in localStorage)
───────────────────────────────────────────────────────────────────── */
function _promptForApiKey() {
  return new Promise((resolve) => {
    const c = colors();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.8);
      display:flex;align-items:center;justify-content:center;
      z-index:99999;padding:24px;
    `;
    overlay.innerHTML = `
      <div style="
        background:${document.body.classList.contains('light') ? '#FFFFFF' : '#0E1C34'};
        border-radius:16px;padding:28px 24px;max-width:360px;width:100%;
      ">
        <div style="font-size:22px;text-align:center;margin-bottom:12px;">🔑</div>
        <div style="font-size:14px;font-weight:900;color:${c.heading};text-align:center;margin-bottom:8px;letter-spacing:1px;">Anthropic API Key</div>
        <div style="font-size:12px;color:${c.muted};text-align:center;line-height:1.6;margin-bottom:20px;font-weight:600;">
          Required for AI distillation. One-time setup — stored only on this device, never in your code.
        </div>
        <input
          id="api-key-input"
          type="password"
          placeholder="sk-ant-api03-..."
          style="
            width:100%;background:${c.inputBg};border:1px solid ${c.inputBorder};
            border-radius:10px;color:${c.inputText};font-size:13px;font-weight:600;
            padding:12px 14px;box-sizing:border-box;margin-bottom:16px;
            outline:none;font-family:monospace;
          "
        >
        <div style="display:flex;gap:10px;">
          <button id="api-key-cancel" style="flex:1;padding:13px;background:transparent;border:1px solid ${c.cardBorder};border-radius:10px;color:${c.muted};font-size:12px;font-weight:800;cursor:pointer;">Cancel</button>
          <button id="api-key-save" style="flex:2;padding:13px;background:${c.goldBtn};color:${c.goldBtnTxt};border:none;border-radius:10px;font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer;text-transform:uppercase;">Save Key</button>
        </div>
        <div style="font-size:10px;color:${c.muted};text-align:center;margin-top:12px;font-weight:600;">
          Get your key at console.anthropic.com → API Keys
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#api-key-cancel').addEventListener('click', () => {
      overlay.remove(); resolve('');
    });
    overlay.querySelector('#api-key-save').addEventListener('click', () => {
      const val = overlay.querySelector('#api-key-input').value.trim();
      overlay.remove(); resolve(val);
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   AI DISTILLATION
───────────────────────────────────────────────────────────────────── */
async function _doDistil() {
  if (_entries.length === 0) return;

  // Check for API key — prompt if missing
  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await _promptForApiKey();
    if (!apiKey) { _distilling = false; _paintRoom(); return; }
    saveApiKey(apiKey);
  }

  try {
    const allText = [..._entries]
      .sort((a, b) => a.ts - b.ts)
      .map((e, i) => `Entry ${i + 1}: ${e.text}`)
      .join('\n\n');

    const systemPrompt = `You are a vision distillation assistant. Your role is to synthesise a person's raw visualisation journal entries into a single, powerful, present-tense Vision Statement. 

Rules:
- Write entirely in present tense ("I am", "I have", "I wake up in")
- Be specific and vivid — use details from the entries
- Write as one flowing piece of prose, 3–6 sentences
- Make it emotionally compelling, not generic
- Do not mention the number of entries or reference the process
- Return only the Vision Statement text, nothing else`;

    const userPrompt = `These are my visualisation journal entries for: ${_room?.label || 'this area of my life'}.

${allText}

Distil these into a single, powerful Vision Statement.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await res.json();
    const newStatement = data?.content?.[0]?.text?.trim() || '';
    if (newStatement) {
      await _saveStatement(newStatement);
    }
  } catch (err) {
    console.error('[Vision] distil error:', err);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   HEALTH DATA AUTO-PULL
   Reads directly from state.healthData (already loaded in memory by
   the app — same array used by renderProgressTab). Computes:
     latestWeight    — most recent synced weight (lbs)
     latestBodyFat   — most recent synced body fat %
     weeklySteps     — total steps over the last 7 days
     weightDelta     — weight change vs 7 days ago (negative = lost)
     bodyFatDelta    — body fat % change vs 7 days ago (negative = lost)
───────────────────────────────────────────────────────────────────── */
async function _fetchHealthData() {
  try {
    const healthData = _deps && _deps.state && _deps.state.healthData;
    if (!healthData || healthData.length === 0) return null;

    // Sort entries newest first
    const sorted = [...healthData].sort((a, b) => b.date.localeCompare(a.date));

    // Latest weight & body fat (most recent entry that has the value)
    const latestWeightEntry  = sorted.find(h => h.weight  != null) || null;
    const latestBodyFatEntry = sorted.find(h => h.bodyFat != null) || null;
    const latestWeight  = latestWeightEntry  ? latestWeightEntry.weight  : null;
    const latestBodyFat = latestBodyFatEntry ? latestBodyFatEntry.bodyFat : null;

    // 7-day comparison — find the oldest entry that's within 5–10 days ago
    // to give a meaningful "vs last week" delta
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const tenDaysAgo   = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

    const weekOldEntries = sorted.filter(h => h.date >= tenDaysAgo && h.date <= sevenDaysAgo);
    const weekOldWeightEntry  = weekOldEntries.find(h => h.weight  != null) || null;
    const weekOldBodyFatEntry = weekOldEntries.find(h => h.bodyFat != null) || null;

    const weightDelta  = (latestWeight  != null && weekOldWeightEntry)
      ? +(latestWeight  - weekOldWeightEntry.weight).toFixed(1)  : null;
    const bodyFatDelta = (latestBodyFat != null && weekOldBodyFatEntry)
      ? +(latestBodyFat - weekOldBodyFatEntry.bodyFat).toFixed(2) : null;

    // Steps: sum entries from the last 7 calendar days
    const recentEntries = sorted.filter(h => h.date >= sevenDaysAgo && h.steps != null);
    const weeklySteps   = recentEntries.length > 0
      ? Math.round(recentEntries.reduce(function(sum, h) { return sum + h.steps; }, 0))
      : null;

    return { latestWeight, latestBodyFat, weeklySteps, weightDelta, bodyFatDelta };
  } catch (err) {
    console.warn('[Vision] _fetchHealthData error:', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   WEEKLY REVIEW MODAL
───────────────────────────────────────────────────────────────────── */
async function _showWeeklyReviewModal() {
  const c = colors();
  const isLight = document.body.classList.contains('light');
  const isHealthRoom = _room?.id === 'health';

  // Auto-pull health data for the health room
  let healthData = null;
  if (isHealthRoom) {
    healthData = await _fetchHealthData();
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);
    display:flex;align-items:flex-end;justify-content:center;
    z-index:99999;padding:0;
  `;

  const prevAnswers = _weeklyReview?.answers || {};

  // ── Health-specific questions ──────────────────────────────────────
  const healthQuestions = [
    { key: 'gymSessions',    label: '1. How many gym sessions did you complete this week?',                        hint: 'Be specific — how many and what did you do?' },
    { key: 'extraActivity',  label: '2. Did you do any extra walks or runs on top of that?',                      hint: 'Distance, frequency, anything that counts.' },
    { key: 'perfectDays',    label: '3. How many days did you maintain a perfect diet?',                          hint: 'Out of 7. Be honest.' },
    { key: 'dietSlipUp',     label: '4. Where did your diet slip up — what was the situation?',                   hint: 'Be specific — what, when, why?' },
    { key: 'sleep',          label: '5. How has your sleep been this week — are you getting enough and waking up rested?', hint: 'Average hours, quality, energy on waking.' },
    { key: 'niggles',        label: '6. Did you notice any soreness, fatigue or physical niggles this week?',    hint: 'Anything your body is telling you.' },
    { key: 'dietPattern',    label: '7. Were your diet slip-ups linked to a pattern — e.g. weekends, stress, being out?', hint: 'Patterns are what to fix, not one-offs.' },
    { key: 'missedHabit',    label: '8. What\'s the one thing you didn\'t do this week that would have made the biggest difference?', hint: 'Be specific and honest.' },
    { key: 'improvements',   label: '9. What specific improvements are you committing to for the week ahead?',   hint: 'Concrete commitments, not wishes.' },
  ];

  // ── Generic questions (all other rooms) ───────────────────────────
  const genericQuestions = [
    { key: 'actions',   label: '1. What did you actually do this week towards this vision?', hint: 'Specific actions, not intentions.' },
    { key: 'results',   label: '2. What results or outputs did you produce?',                hint: 'Numbers, evidence, proof.' },
    { key: 'avoided',   label: '3. What did you avoid, delay or make excuses about?',       hint: 'Be honest — no one else is reading this.' },
    { key: 'obstacle',  label: '5. What\'s your single biggest obstacle right now?',        hint: 'The real one, not the easy answer.' },
  ];

  const questions = isHealthRoom ? healthQuestions : genericQuestions;

  // ── Auto-pulled health metrics banner ─────────────────────────────
  const healthBanner = (isHealthRoom && healthData) ? (() => {
    const fmt = (delta, unit, lowerIsBetter) => {
      if (delta == null) return '';
      const improved = lowerIsBetter ? delta < 0 : delta > 0;
      const colour   = improved ? '#2ecc71' : (delta === 0 ? 'rgba(255,255,255,0.5)' : '#e74c3c');
      const arrow    = delta < 0 ? '▼' : (delta > 0 ? '▲' : '—');
      return `<span style="font-size:11px;font-weight:800;color:${colour};margin-left:6px;">${arrow} ${Math.abs(delta)}${unit} vs last wk</span>`;
    };

    const rows = [
      healthData.weeklySteps   != null
        ? `<div style="font-size:13px;font-weight:800;color:${c.heading};">👟 ${Number(healthData.weeklySteps).toLocaleString()} steps <span style="font-size:10px;font-weight:600;color:${c.muted};">7-day total</span></div>`
        : null,
      healthData.latestWeight  != null
        ? `<div style="font-size:13px;font-weight:800;color:${c.heading};">⚖️ ${healthData.latestWeight.toFixed(1)} lbs${fmt(healthData.weightDelta, 'lbs', true)}</div>`
        : null,
      healthData.latestBodyFat != null
        ? `<div style="font-size:13px;font-weight:800;color:${c.heading};">📊 ${healthData.latestBodyFat.toFixed(1)}% body fat${fmt(healthData.bodyFatDelta, '%', true)}</div>`
        : null,
    ].filter(Boolean);

    if (rows.length === 0) return '';
    return `
      <div style="
        background:rgba(201,168,76,0.08);
        border:1px solid rgba(201,168,76,0.3);
        border-radius:12px;padding:12px 16px;margin-bottom:20px;
      ">
        <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${c.gold};text-transform:uppercase;margin-bottom:10px;">📥 Auto-Pulled This Week</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${rows.join('')}
        </div>
      </div>
    `;
  })() : '';

  overlay.innerHTML = `
    <div style="
      background:${isLight ? '#FFFFFF' : '#0E1C34'};
      border-radius:20px 20px 0 0;
      padding:28px 24px 48px;
      width:100%;max-width:520px;
      max-height:90vh;overflow-y:auto;
    ">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:28px;margin-bottom:8px;">📋</div>
        <div style="font-size:15px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;">Weekly Review</div>
        <div style="font-size:11px;color:${c.muted};font-weight:600;margin-top:4px;">${_room?.label} — Be brutally honest.</div>
      </div>

      ${healthBanner}

      ${questions.map(q => `
        <div style="margin-bottom:18px;">
          <div style="font-size:11px;font-weight:900;color:${c.subheading};letter-spacing:1px;margin-bottom:4px;">${q.label}</div>
          <div style="font-size:10px;color:${c.muted};font-weight:600;margin-bottom:8px;font-style:italic;">${q.hint}</div>
          <textarea
            id="review-${q.key}"
            style="
              width:100%;min-height:72px;
              background:${c.inputBg};border:1px solid ${c.inputBorder};
              border-radius:10px;color:${c.inputText};
              font-size:13px;line-height:1.65;padding:10px 12px;
              font-family:inherit;font-weight:600;
              resize:vertical;box-sizing:border-box;outline:none;
            "
            placeholder="…"
          >${_escHtml(prevAnswers[q.key] || '')}</textarea>
        </div>
      `).join('')}

      <div style="margin-bottom:22px;">
        <div style="font-size:11px;font-weight:900;color:${c.subheading};letter-spacing:1px;margin-bottom:8px;">${isHealthRoom ? '10.' : '4.'} Honest effort rating this week (1–10)</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `
            <button
              data-effort="${n}"
              class="effort-btn"
              style="
                width:40px;height:40px;border-radius:8px;
                background:${prevAnswers.effort == n ? c.goldBtn : c.inputBg};
                border:1.5px solid ${prevAnswers.effort == n ? c.gold : c.inputBorder};
                color:${prevAnswers.effort == n ? c.goldBtnTxt : c.inputText};
                font-size:13px;font-weight:900;cursor:pointer;
                transition:all .15s;
              "
            >${n}</button>
          `).join('')}
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button id="review-cancel" style="flex:1;padding:14px;background:${c.cardBg};border:1px solid ${c.cardBorder};border-radius:10px;color:${c.muted};font-size:12px;font-weight:800;letter-spacing:1px;cursor:pointer;">CANCEL</button>
        <button id="review-submit" style="flex:2;padding:14px;background:${c.goldBtn};color:${c.goldBtnTxt};border:none;border-radius:10px;font-size:12px;font-weight:900;letter-spacing:2px;cursor:pointer;text-transform:uppercase;">SAVE & ANALYSE →</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Effort selector
  let selectedEffort = prevAnswers.effort || null;
  overlay.querySelectorAll('.effort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEffort = parseInt(btn.dataset.effort);
      overlay.querySelectorAll('.effort-btn').forEach(b => {
        const active = parseInt(b.dataset.effort) === selectedEffort;
        b.style.background = active ? c.goldBtn : c.inputBg;
        b.style.borderColor = active ? c.gold : c.inputBorder;
        b.style.color = active ? c.goldBtnTxt : c.inputText;
      });
    });
  });

  overlay.querySelector('#review-cancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#review-submit').addEventListener('click', async () => {
    // Collect answers for whichever question set was shown
    const answers = { effort: selectedEffort, ts: Date.now() };
    const activeQuestions = isHealthRoom ? healthQuestions : genericQuestions;
    activeQuestions.forEach(q => {
      answers[q.key] = overlay.querySelector(`#review-${q.key}`)?.value?.trim() || '';
    });

    // Attach auto-pulled health data so AI can use it
    if (isHealthRoom && healthData) {
      answers._healthData = {
        weeklySteps:   healthData.weeklySteps   != null ? healthData.weeklySteps   : null,
        latestWeight:  healthData.latestWeight  != null ? healthData.latestWeight  : null,
        latestBodyFat: healthData.latestBodyFat != null ? healthData.latestBodyFat : null,
        weightDelta:   healthData.weightDelta   != null ? healthData.weightDelta   : null,
        bodyFatDelta:  healthData.bodyFatDelta  != null ? healthData.bodyFatDelta  : null,
      };
    }

    overlay.remove();
    await _saveWeeklyReview({ answers, ts: Date.now() });
    _showReviewBanner = false;
    if (_room) _overdueRooms.delete(_room.id);

    // Trigger both AI analyses
    _loadingRealityCheck = true;
    _loading30Day = true;
    _paintRoom();
    await Promise.all([_doRealityCheck(), _do30DayFocus()]);
    _loadingRealityCheck = false;
    _loading30Day = false;
    _paintRoom();
    _toast('Review saved — analysis complete.', colors());
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

/* ─────────────────────────────────────────────────────────────────────
   AI — REALITY CHECK
───────────────────────────────────────────────────────────────────── */
async function _doRealityCheck() {
  if (!_statement || !_weeklyReview) return;

  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await _promptForApiKey();
    if (!apiKey) return;
    saveApiKey(apiKey);
  }

  try {
    const a = _weeklyReview.answers || {};
    const isHealthRoom = _room?.id === 'health';

    let reviewText;
    if (isHealthRoom) {
      // Health-specific field mapping
      const hd = a._healthData || {};
      const autoData = [
        hd.weeklySteps   != null ? `Steps this week (auto-tracked): ${Number(hd.weeklySteps).toLocaleString()}` : '',
        hd.latestWeight  != null ? `Current weight (auto-tracked): ${hd.latestWeight.toFixed(1)} lbs${hd.weightDelta != null ? ' (' + (hd.weightDelta > 0 ? '+' : '') + hd.weightDelta + 'lbs vs last week)' : ''}` : '',
        hd.latestBodyFat != null ? `Body fat % (auto-tracked): ${hd.latestBodyFat.toFixed(1)}%${hd.bodyFatDelta != null ? ' (' + (hd.bodyFatDelta > 0 ? '+' : '') + hd.bodyFatDelta + '% vs last week)' : ''}` : '',
      ].filter(Boolean);

      reviewText = [
        autoData.length ? `AUTO-TRACKED DATA:\n${autoData.join('\n')}` : '',
        a.gymSessions  ? `Gym sessions completed: ${a.gymSessions}`   : '',
        a.extraActivity? `Extra walks/runs: ${a.extraActivity}`        : '',
        a.perfectDays  ? `Days on perfect diet: ${a.perfectDays}`     : '',
        a.dietSlipUp   ? `Diet slip-up details: ${a.dietSlipUp}`      : '',
        a.sleep        ? `Sleep this week: ${a.sleep}`                 : '',
        a.niggles      ? `Soreness/niggles: ${a.niggles}`             : '',
        a.dietPattern  ? `Diet pattern noticed: ${a.dietPattern}`     : '',
        a.missedHabit  ? `Biggest missed habit: ${a.missedHabit}`     : '',
        a.improvements ? `Commitments for next week: ${a.improvements}`: '',
        a.effort       ? `Effort rating: ${a.effort}/10`               : '',
      ].filter(Boolean).join('\n');
    } else {
      reviewText = [
        a.actions   ? `Actions taken: ${a.actions}`     : '',
        a.results   ? `Results produced: ${a.results}`  : '',
        a.avoided   ? `Avoided/delayed: ${a.avoided}`   : '',
        a.effort    ? `Effort rating: ${a.effort}/10`    : '',
        a.obstacle  ? `Biggest obstacle: ${a.obstacle}` : '',
      ].filter(Boolean).join('\n');
    }

    const system = isHealthRoom
      ? `You are Robert's brutally honest but deeply believing health mentor. He has given you his physical vision — the body and health he is building — and his honest weekly review including real tracked data on his steps, weight and body fat.

Your job: call out the gap with complete honesty. Name exactly where he is falling short, where discipline slipped, where he is making excuses. Be specific to HIS numbers and HIS situation — never generic.

But you also know what he is genuinely capable of. So after calling out the gap, remind him what is actually possible for him — grounded belief, not hype.

Write 3–5 sentences as a direct personal message to Robert. No bullet points. No headers. Just truth.`
      : `You are Robert's brutally honest but deeply believing mentor. He has given you his vision — who he is becoming — and his honest weekly review of where he actually is right now. 

Your job: call out the gap with complete honesty. No sugarcoating. No softening. Name exactly where he is falling short, where he is making excuses, where he is playing small. Be specific to HIS situation — never generic. 

But you also know what he is genuinely capable of. You have seen it in his vision. So after calling out the gap, remind him what is actually possible for him — not with empty hype, but with grounded belief. 

Write 3-5 sentences as a direct personal message to Robert. No bullet points. No headers. Just truth.`;

    const user = `My vision for ${_room?.label}:\n${_statement}\n\nMy weekly review:\n${reviewText}\n\nGive me my Reality Check.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 350,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim() || '';
    if (text) await _saveRealityCheck(text);
  } catch (err) {
    console.error('[Vision] realityCheck error:', err);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   AI — MONTHLY + WEEKLY FOCUS PLAN
───────────────────────────────────────────────────────────────────── */
async function _do30DayFocus() {
  if (!_statement || !_weeklyReview) return;

  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await _promptForApiKey();
    if (!apiKey) return;
    saveApiKey(apiKey);
  }

  try {
    const a = _weeklyReview.answers || {};
    const isHealthRoom = _room?.id === 'health';

    // ── Month timing — always deadline = last day of current month ──
    const now          = new Date();
    const monthName    = now.toLocaleString('en-GB', { month: 'long' });
    const year         = now.getFullYear();
    const todayStr     = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const deadlineStr  = lastDayOfMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const daysRemaining = Math.ceil((lastDayOfMonth - now) / 86400000);
    const weeksRemaining = Math.ceil(daysRemaining / 7);

    // Which week of the month are we in? (1–4)
    const dayOfMonth    = now.getDate();
    const currentWeekNum = Math.min(4, Math.ceil(dayOfMonth / 7));
    const weeksToGenerate = Math.max(1, Math.min(4, weeksRemaining));

    let reviewText;
    if (isHealthRoom) {
      const hd = a._healthData || {};
      const autoData = [
        hd.weeklySteps   != null ? `Steps this week (auto-tracked): ${Number(hd.weeklySteps).toLocaleString()}` : '',
        hd.latestWeight  != null ? `Current weight (auto-tracked): ${hd.latestWeight.toFixed(1)} lbs${hd.weightDelta != null ? ' (' + (hd.weightDelta > 0 ? '+' : '') + hd.weightDelta + 'lbs vs last week)' : ''}` : '',
        hd.latestBodyFat != null ? `Body fat % (auto-tracked): ${hd.latestBodyFat.toFixed(1)}%${hd.bodyFatDelta != null ? ' (' + (hd.bodyFatDelta > 0 ? '+' : '') + hd.bodyFatDelta + '% vs last week)' : ''}` : '',
      ].filter(Boolean);

      reviewText = [
        autoData.length ? `AUTO-TRACKED DATA:\n${autoData.join('\n')}` : '',
        a.gymSessions  ? `Gym sessions this week: ${a.gymSessions}`    : '',
        a.extraActivity? `Extra walks/runs: ${a.extraActivity}`         : '',
        a.perfectDays  ? `Days on perfect diet: ${a.perfectDays}/7`    : '',
        a.dietSlipUp   ? `Diet slip-up: ${a.dietSlipUp}`               : '',
        a.sleep        ? `Sleep quality: ${a.sleep}`                    : '',
        a.niggles      ? `Physical niggles: ${a.niggles}`              : '',
        a.dietPattern  ? `Diet pattern: ${a.dietPattern}`              : '',
        a.missedHabit  ? `Biggest missed habit: ${a.missedHabit}`      : '',
        a.improvements ? `Commitments: ${a.improvements}`              : '',
        a.effort       ? `Effort rating: ${a.effort}/10`                : '',
      ].filter(Boolean).join('\n');
    } else {
      reviewText = [
        a.actions   ? `Actions taken this week: ${a.actions}`     : '',
        a.results   ? `Results produced: ${a.results}`            : '',
        a.avoided   ? `Avoided/delayed: ${a.avoided}`             : '',
        a.effort    ? `Effort rating: ${a.effort}/10`              : '',
        a.obstacle  ? `Biggest obstacle right now: ${a.obstacle}` : '',
      ].filter(Boolean).join('\n');
    }

    const healthPlanNote = isHealthRoom ? `
- Actions must be physical and measurable: specific gym session counts, diet targets (e.g. "5/7 days perfect diet"), exact training focus
- Reference the auto-tracked data (steps, weight, body fat deltas) when setting the month objective — make it specific to where Robert actually is right now
- If he is losing body fat week on week, acknowledge the momentum and push the target further; if gaining, confront that directly
- The challenge field must address real patterns he mentioned (diet slippage, missed sessions, weekends, etc)` : '';

    // Build week template string dynamically based on weeks remaining
    const weekTemplates = Array.from({ length: weeksToGenerate }, (_, i) => {
      const wkNum = currentWeekNum + i;
      return `{ "week": ${wkNum}, "focus": "...", "actions": ["...", "...", "..."], "challenge": "..." }`;
    }).join(',\n    ');

    const system = `You are a sharp, direct coach creating a structured plan to take someone from TODAY to the end of this calendar month.

You must respond with ONLY a valid JSON object — no markdown, no backticks, no explanation. Exactly this structure:

{
  "monthObjective": "One bold, specific, measurable objective to achieve by the end of ${monthName}. Must reference where Robert is TODAY and what he will achieve by ${deadlineStr}.",
  "weeks": [
    ${weekTemplates}
  ]
}

Rules:
- TODAY is ${todayStr}. The DEADLINE is ${deadlineStr} (last day of ${monthName}). There are ${daysRemaining} days and ${weeksToGenerate} week(s) remaining in the month.
- We are currently in week ${currentWeekNum} of the month — only generate ${weeksToGenerate} week(s) (from week ${currentWeekNum} to the end of the month). Do NOT generate weeks that have already passed.
- Each week should build on the previous — the final week locks in results before the month-end deadline
- Actions must be concrete and measurable, not vague ("4 gym sessions this week" not "train more")
- The challenge field must directly reference their stated patterns and give a concrete coping strategy${healthPlanNote}
- Return ONLY the JSON. Nothing else.`;

    const user = `Month: ${monthName} ${year}
Today: ${todayStr}
Month-end deadline: ${deadlineStr}
Days remaining: ${daysRemaining}
Weeks remaining: ${weeksToGenerate} (starting at week ${currentWeekNum} of the month)
Room: ${_room?.label}

My vision:\n${_statement}\n\nMy current reality:\n${reviewText}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || '';
    if (!raw) return;

    // Parse and validate JSON
    try {
      const clean = raw.replace(/^```json|^```|```$/gm, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed.monthObjective && Array.isArray(parsed.weeks)) {
        await _saveFocusPlan(JSON.stringify(parsed));
      }
    } catch (parseErr) {
      console.error('[Vision] 30dayFocus parse error:', parseErr, raw);
    }
  } catch (err) {
    console.error('[Vision] 30dayFocus error:', err);
  }
}


/* ─────────────────────────────────────────────────────────────────────
   TOTAL PICTURE — AI-synthesised business & wealth command centre
───────────────────────────────────────────────────────────────────── */

async function _openTotalPicture() {
  _view = 'room';
  _room = { id: 'biz_total', label: 'Total Picture', emoji: '🗺️' };
  const c = colors();
  const panel = _panel();
  if (!panel) return;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:200px;">
      <div style="color:${c.muted};font-size:13px;font-weight:700;letter-spacing:2px;">LOADING…</div>
    </div>
  `;

  await _tpLoad();

  // Auto-refresh if never generated or older than 24h
  const age = _tp_data?.generatedAt ? (Date.now() - _tp_data.generatedAt) : Infinity;
  if (!_tp_data?.vision || age > 24 * 60 * 60 * 1000) {
    _tp_generating = true;
    _paintTotalPicture();
    await _tpGenerate();
    _tp_generating = false;
  }

  _paintTotalPicture();
}

async function _tpLoad() {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;
    const snap = await getDoc(doc(db, 'users', uid, 'visionRooms', 'biz_total'));
    _tp_data = snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('[Vision] tpLoad error:', err);
    _tp_data = null;
  }
}

async function _tpSave() {
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid || !_tp_data) return;
    await setDoc(doc(db, 'users', uid, 'visionRooms', 'biz_total'), _tp_data, { merge: true });
  } catch (err) {
    console.error('[Vision] tpSave error:', err);
  }
}

async function _tpLoadAllRoomsData() {
  const db = _db(); const uid = _uid();
  if (!db || !uid) return [];
  const bizFolder = DEFAULT_ROOMS.find(r => r.isFolder);
  if (!bizFolder) return [];
  const subs = [...bizFolder.defaultSubRooms, ..._customSubRooms].filter(r => r.id !== 'biz_total');
  const rooms = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'visionRooms', sub.id));
      const data = snap.exists() ? snap.data() : {};
      rooms.push({
        label:       sub.label,
        emoji:       sub.emoji,
        statement:   data.statement    || '',
        realityCheck:data.realityCheck || '',
        weeklyReview:data.weeklyReview?.answers || null,
      });
    } catch (e) {
      rooms.push({ label: sub.label, emoji: sub.emoji, statement: '', realityCheck: '', weeklyReview: null });
    }
  }));
  return rooms;
}

async function _tpGenerate() {
  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await _promptForApiKey();
    if (!apiKey) return;
    saveApiKey(apiKey);
  }
  try {
    const rooms = await _tpLoadAllRoomsData();
    const now = new Date();
    const monthName = now.toLocaleString('en-GB', { month: 'long' });
    const year = now.getFullYear();

    const contextStr = rooms.map(r => {
      const parts = [`${r.emoji} ${r.label}`];
      if (r.statement)    parts.push(`Vision: ${r.statement}`);
      if (r.realityCheck) parts.push(`Reality Check: ${r.realityCheck}`);
      if (r.weeklyReview) {
        const a = r.weeklyReview;
        if (a.actions)  parts.push(`Recent Actions: ${a.actions}`);
        if (a.results)  parts.push(`Results: ${a.results}`);
        if (a.avoided)  parts.push(`Avoided/Delayed: ${a.avoided}`);
        if (a.obstacle) parts.push(`Biggest Obstacle: ${a.obstacle}`);
        if (a.effort)   parts.push(`Effort: ${a.effort}/10`);
      }
      return parts.join('\n');
    }).join('\n\n---\n\n');

    const amendments    = _tp_data?.amendments || [];
    const amendmentStr  = amendments.length > 0
      ? `\n\nAmendments from Robert:\n${amendments.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
      : '';

    const system = `You are a sharp strategic coach building an AI-powered command centre for Robert's business and wealth. You have data from all his business vision rooms. Synthesise this into a clear, actionable Total Picture.

Respond with ONLY a valid JSON object — no markdown, no backticks, no explanation. Exactly this structure:

{
  "vision": "2–4 sentence synthesis of Robert's overall business and wealth vision — what he is building and why. Present tense, vivid, specific to his actual ventures.",
  "currentReality": "2–4 sentence honest summary of where Robert is right now across his business and wealth — reference his reality checks and reviews. What's working and what's not.",
  "objectives": [
    "Specific measurable objective for ${monthName} — action verb + concrete outcome",
    "Specific measurable objective for ${monthName}",
    "Specific measurable objective for ${monthName}",
    "Specific measurable objective for ${monthName}",
    "Specific measurable objective for ${monthName}"
  ],
  "weeklyRoadmap": {
    "month": "${monthName} ${year}",
    "weeks": [
      { "week": 1, "focus": "Single most important focus for Week 1 (one bold sentence)", "actions": ["Specific action 1", "Specific action 2", "Specific action 3"] },
      { "week": 2, "focus": "…", "actions": ["…", "…", "…"] },
      { "week": 3, "focus": "…", "actions": ["…", "…", "…"] },
      { "week": 4, "focus": "…", "actions": ["…", "…", "…"] }
    ]
  }
}

Rules: Be brutally specific to Robert's actual businesses. Objectives must be achievable this calendar month. Actions must be concrete, not generic. Build the roadmap week by week with momentum. Return ONLY valid JSON.`;

    const user = `Month: ${monthName} ${year}\n\nBusiness & Wealth room data:\n\n${contextStr}${amendmentStr}\n\nBuild the Total Picture.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1400,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await res.json();
    const raw  = data?.content?.[0]?.text?.trim() || '';
    if (!raw) return;

    const clean  = raw.replace(/^```json|^```|```$/gm, '').trim();
    const parsed = JSON.parse(clean);

    // Preserve existing checkbox state
    const prevMap = {};
    (_tp_data?.objectives || []).forEach(o => { prevMap[o.text] = o.checked; });
    const objectives = (parsed.objectives || []).map(text => ({
      text,
      checked: prevMap[text] || false,
    }));

    _tp_data = {
      ...(_tp_data || {}),
      vision:        parsed.vision        || '',
      currentReality:parsed.currentReality|| '',
      objectives,
      weeklyRoadmap: parsed.weeklyRoadmap || null,
      amendments:    _tp_data?.amendments || [],
      generatedAt:   Date.now(),
    };

    await _tpSave();
  } catch (err) {
    console.error('[Vision] tpGenerate error:', err);
  }
}

async function _tpRegenerateRoadmap(amendment) {
  if (!amendment.trim()) return;
  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await _promptForApiKey();
    if (!apiKey) return;
    saveApiKey(apiKey);
  }

  // Append amendment
  _tp_data = {
    ...(_tp_data || {}),
    amendments: [...(_tp_data?.amendments || []), amendment.trim()],
  };

  try {
    const now        = new Date();
    const monthName  = now.toLocaleString('en-GB', { month: 'long' });
    const year       = now.getFullYear();
    const current    = _tp_data.weeklyRoadmap ? JSON.stringify(_tp_data.weeklyRoadmap) : 'None yet';
    const allAmends  = (_tp_data.amendments || []).map((a, i) => `${i + 1}. ${a}`).join('\n');

    const system = `You are a strategic coach refining a monthly roadmap for Robert based on his corrections. Return ONLY a valid JSON object — no markdown, no explanation:

{
  "month": "${monthName} ${year}",
  "weeks": [
    { "week": 1, "focus": "…", "actions": ["…", "…", "…"] },
    { "week": 2, "focus": "…", "actions": ["…", "…", "…"] },
    { "week": 3, "focus": "…", "actions": ["…", "…", "…"] },
    { "week": 4, "focus": "…", "actions": ["…", "…", "…"] }
  ]
}

Rules: Incorporate ALL amendments — they override the original. Keep what works, refine the rest. Actions must be concrete. Return ONLY valid JSON.`;

    const user = `Current roadmap:\n${current}\n\nRobert's amendments:\n${allAmends}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data   = await res.json();
    const raw    = data?.content?.[0]?.text?.trim() || '';
    if (!raw) return;
    const clean  = raw.replace(/^```json|^```|```$/gm, '').trim();
    const parsed = JSON.parse(clean);
    _tp_data.weeklyRoadmap = parsed;
    await _tpSave();
  } catch (err) {
    console.error('[Vision] tpRegenerateRoadmap error:', err);
  }
}

function _paintTotalPicture() {
  const c     = colors();
  const panel = _panel();
  if (!panel) return;
  const d       = _tp_data;
  const hasData = d && d.vision;
  const monthLabel = d?.weeklyRoadmap?.month
    || new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  panel.innerHTML = `
    <div class="vision-page" style="background:${c.pageBg};min-height:100%;padding:24px 20px 80px;">

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <button id="tp-back" style="${_backBtnStyle(c)}">← Back</button>
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🗺️ Total Picture</div>
          <div style="font-size:10px;color:${c.muted};letter-spacing:1px;font-weight:600;">AI-synthesised from all your business rooms</div>
        </div>
        <button id="tp-refresh" style="
          background:${c.goldBtn};color:${c.goldBtnTxt};
          border:none;border-radius:8px;
          font-size:10px;font-weight:900;letter-spacing:1px;
          padding:8px 12px;cursor:pointer;white-space:nowrap;flex-shrink:0;
          opacity:${_tp_generating ? '0.6' : '1'};
        " ${_tp_generating ? 'disabled' : ''}>${_tp_generating ? '⟳ Generating…' : '⟳ Refresh'}</button>
      </div>

      ${_tp_generating ? `
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:14px;padding:40px 16px;text-align:center;
        ">
          <div style="font-size:28px;margin-bottom:14px;">🗺️</div>
          <div style="font-size:12px;font-weight:900;letter-spacing:2px;color:${c.muted};text-transform:uppercase;">Synthesising your rooms…</div>
          <div style="font-size:11px;color:${c.muted};margin-top:8px;font-weight:600;line-height:1.6;">Pulling vision, reality checks & weekly reviews from all business rooms</div>
        </div>

      ` : !hasData ? `
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:14px;padding:40px 16px;text-align:center;
        ">
          <div style="font-size:32px;margin-bottom:12px;">🗺️</div>
          <div style="font-size:13px;font-weight:900;letter-spacing:1px;color:${c.heading};margin-bottom:8px;">No picture yet</div>
          <div style="font-size:12px;color:${c.muted};font-weight:600;line-height:1.6;margin-bottom:20px;">
            Add vision entries and weekly reviews to your business rooms, then generate your Total Picture.
          </div>
          <button id="tp-generate-now" style="
            background:${c.goldBtn};color:${c.goldBtnTxt};border:none;
            border-radius:10px;padding:12px 24px;
            font-size:12px;font-weight:900;letter-spacing:1px;cursor:pointer;text-transform:uppercase;
          ">Generate Now →</button>
        </div>

      ` : `

        <!-- 0. OVERALL VISION -->
        <div style="
          background:${c.statementBg};border:1.5px solid ${c.statementBdr};
          border-radius:14px;padding:18px 16px;margin-bottom:14px;
        ">
          <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.gold};text-transform:uppercase;margin-bottom:10px;">✦ 0 — Overall Vision & Goal</div>
          <div style="font-size:14px;line-height:1.75;color:${c.statementTxt};font-weight:600;">${_nl2br(_escHtml(d.vision || ''))}</div>
        </div>

        <!-- 1. WHERE I AM NOW -->
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:14px;padding:18px 16px;margin-bottom:14px;
        ">
          <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;margin-bottom:10px;">🔍 1 — Where I Am Now</div>
          <div style="font-size:13px;line-height:1.75;color:${c.subheading};font-weight:600;">${_nl2br(_escHtml(d.currentReality || ''))}</div>
        </div>

        <!-- 2. MONTHLY OBJECTIVES -->
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:14px;padding:18px 16px;margin-bottom:14px;
        ">
          <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;margin-bottom:14px;">
            📋 2 — ${monthLabel.toUpperCase()} OBJECTIVES
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${(d.objectives || []).map((obj, i) => `
              <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
                <input
                  type="checkbox"
                  data-tp-obj="${i}"
                  ${obj.checked ? 'checked' : ''}
                  style="width:18px;height:18px;margin-top:3px;flex-shrink:0;accent-color:${c.gold};cursor:pointer;"
                >
                <span style="
                  font-size:13px;font-weight:600;line-height:1.55;
                  color:${obj.checked ? c.muted : c.subheading};
                  ${obj.checked ? 'text-decoration:line-through;opacity:0.55;' : ''}
                ">${_escHtml(obj.text)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 3. WEEKLY ROADMAP -->
        <div style="
          background:${c.cardBg};border:1px solid ${c.cardBorder};
          border-radius:14px;padding:18px 16px;margin-bottom:14px;
        ">
          <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;margin-bottom:14px;">
            🗓️ 3 — Weekly Roadmap — ${monthLabel.toUpperCase()}
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
            ${(d.weeklyRoadmap?.weeks || []).map(w => `
              <div style="border:1px solid ${c.cardBorder};border-radius:10px;padding:14px;">
                <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
                  <div style="
                    background:${c.goldBtn};color:${c.goldBtnTxt};
                    border-radius:6px;padding:3px 10px;
                    font-size:10px;font-weight:900;letter-spacing:1px;
                    white-space:nowrap;flex-shrink:0;margin-top:1px;
                  ">WK ${w.week}</div>
                  <div style="font-size:12px;font-weight:800;color:${c.heading};line-height:1.45;">${_escHtml(w.focus || '')}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;padding-left:2px;">
                  ${(w.actions || []).map(a => `
                    <div style="display:flex;align-items:flex-start;gap:8px;">
                      <div style="color:${c.gold};font-size:11px;font-weight:900;margin-top:2px;flex-shrink:0;">→</div>
                      <div style="font-size:12px;color:${c.subheading};font-weight:600;line-height:1.5;">${_escHtml(a)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Amendment box -->
          <div style="border-top:1px solid ${c.divider};padding-top:16px;">
            <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${c.muted};text-transform:uppercase;margin-bottom:8px;">✏️ Amend the Roadmap</div>
            <textarea
              id="tp-amendment"
              placeholder="Tell AI what to change — e.g. 'Push week 3 TikTok content to week 4, I have a trade show week 3' or 'Focus more on Vinted in week 2'…"
              style="
                width:100%;min-height:80px;
                background:${c.inputBg};border:1px solid ${c.inputBorder};
                border-radius:10px;color:${c.inputText};
                font-size:13px;line-height:1.65;padding:10px 12px;
                font-family:inherit;font-weight:600;resize:vertical;
                box-sizing:border-box;outline:none;
              "
              ${_tp_amending ? 'disabled' : ''}
            >${_escHtml(_tp_amendDraft)}</textarea>
            <button id="tp-amend-submit" style="
              margin-top:10px;width:100%;
              background:${c.goldBtn};color:${c.goldBtnTxt};
              border:none;border-radius:10px;
              padding:12px;font-size:11px;font-weight:900;
              letter-spacing:2px;text-transform:uppercase;cursor:pointer;
              opacity:${_tp_amending ? '0.6' : '1'};
            " ${_tp_amending ? 'disabled' : ''}>${_tp_amending ? '⟳ Updating Roadmap…' : 'SUBMIT AMENDMENT →'}</button>
          </div>
        </div>

        ${d.generatedAt ? `
          <div style="font-size:10px;color:${c.muted};text-align:center;font-weight:600;letter-spacing:1px;">
            Last generated ${_fmtDate(d.generatedAt)}
          </div>
        ` : ''}
      `}
    </div>
  `;

  // Back
  panel.querySelector('#tp-back')?.addEventListener('click', () => {
    const folder = DEFAULT_ROOMS.find(r => r.isFolder);
    if (folder) _openFolder(folder);
  });

  // Refresh
  panel.querySelector('#tp-refresh')?.addEventListener('click', async () => {
    if (_tp_generating) return;
    _tp_generating = true;
    _paintTotalPicture();
    await _tpGenerate();
    _tp_generating = false;
    _paintTotalPicture();
    _toast('Total Picture refreshed.', colors());
  });

  // Generate now (empty state)
  panel.querySelector('#tp-generate-now')?.addEventListener('click', async () => {
    _tp_generating = true;
    _paintTotalPicture();
    await _tpGenerate();
    _tp_generating = false;
    _paintTotalPicture();
  });

  // Objective checkboxes
  panel.querySelectorAll('[data-tp-obj]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const idx = parseInt(cb.dataset.tpObj);
      if (!_tp_data?.objectives?.[idx]) return;
      _tp_data.objectives[idx].checked = cb.checked;
      await _tpSave();
      _paintTotalPicture();
    });
  });

  // Amendment submit
  panel.querySelector('#tp-amend-submit')?.addEventListener('click', async () => {
    if (_tp_amending) return;
    const ta   = panel.querySelector('#tp-amendment');
    const text = (ta?.value || '').trim();
    if (!text) { _toast('Write your amendment first.', colors()); return; }
    _tp_amendDraft = text;
    _tp_amending   = true;
    _paintTotalPicture();
    await _tpRegenerateRoadmap(text);
    _tp_amendDraft = '';
    _tp_amending   = false;
    _paintTotalPicture();
    _toast('Roadmap updated with your amendment.', colors());
  });
}


function _panel() {
  return document.getElementById('tab-vision')
      || document.getElementById('vision-tab')
      || document.querySelector('[data-tab="vision"]');
}

function _findRoom(id) {
  for (const r of DEFAULT_ROOMS) {
    if (r.id === id) return r;
    if (r.isFolder) {
      const sub = r.defaultSubRooms?.find(s => s.id === id)
               || _customSubRooms.find(s => s.id === id);
      if (sub) return sub;
    }
  }
  return null;
}

function _backBtnStyle(c) {
  return `
    background:${c.backBtn};border:none;border-radius:8px;
    color:${c.backBtnTxt};font-size:11px;font-weight:800;
    letter-spacing:1px;padding:8px 12px;cursor:pointer;
    white-space:nowrap;flex-shrink:0;
  `;
}

function _smallBtnStyle(c, danger) {
  return `
    background:transparent;
    border:1px solid ${danger ? c.dangerTxt : c.cardBorder};
    border-radius:7px;color:${danger ? c.dangerTxt : c.subheading};
    font-size:10px;font-weight:800;letter-spacing:1px;
    padding:5px 10px;cursor:pointer;white-space:nowrap;
  `;
}

function _nl2br(str) {
  return str.replace(/\n/g, '<br>');
}

function _escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _toast(msg, c) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
    background:${c.goldBtn};color:${c.goldBtnTxt};
    padding:10px 20px;border-radius:10px;font-size:12px;font-weight:800;
    letter-spacing:1px;z-index:99999;pointer-events:none;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
