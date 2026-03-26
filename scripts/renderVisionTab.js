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
  _paintOverview();
}

/* ─────────────────────────────────────────────────────────────────────
   OVERVIEW — all room cards
───────────────────────────────────────────────────────────────────── */
function _paintOverview() {
  const c = colors();
  const panel = _panel();
  if (!panel) return;

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
  return `
    <div
      data-vision-room="${r.id}"
      class="vision-card"
      style="
        background:${c.cardBg};
        border:1px solid ${c.cardBorder};
        border-radius:14px;
        padding:18px 14px 16px;
        cursor:pointer;
        transition:all .18s ease;
        position:relative;
        overflow:hidden;
      "
      onmouseover="this.style.background='${c.cardHover}';this.style.borderColor='${c.gold}'"
      onmouseout="this.style.background='${c.cardBg}';this.style.borderColor='${c.cardBorder}'"
    >
      <div style="font-size:28px;margin-bottom:10px;">${r.emoji}</div>
      <div style="font-size:12px;font-weight:900;letter-spacing:1.5px;color:${c.heading};text-transform:uppercase;line-height:1.3;margin-bottom:6px;">${r.label}</div>
      <div style="font-size:11px;color:${c.muted};font-weight:600;line-height:1.4;">${r.desc || ''}</div>
      ${isFolder ? `<div style="margin-top:10px;font-size:10px;font-weight:800;letter-spacing:1px;color:${c.folderBadgeTxt};background:${c.folderBadge};border-radius:6px;padding:3px 8px;display:inline-block;">${r.count} ROOMS →</div>` : `<div style="margin-top:10px;font-size:10px;color:${c.gold};font-weight:800;letter-spacing:1px;">ENTER →</div>`}
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
  try {
    const db = _db(); const uid = _uid();
    if (!db || !uid) return;

    // Load statement doc
    const stmtRef = doc(db, 'users', uid, 'visionRooms', roomId);
    const stmtSnap = await getDoc(stmtRef);
    if (stmtSnap.exists()) {
      _statement = stmtSnap.data().statement || '';
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
   HELPERS
───────────────────────────────────────────────────────────────────── */
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
