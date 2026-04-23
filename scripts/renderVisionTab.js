// scripts/renderVisionTab.js
// Vision Tab — Personal & Business goal architecture with AI refinement
// Clean rebuild — working backwards for personal, working forwards for business

const LS_KEY = 'tjm_anthropic_key';
function getApiKey()    { return localStorage.getItem(LS_KEY) || ''; }
function saveApiKey(k)  { localStorage.setItem(LS_KEY, k.trim()); }

import { doc, getDoc, setDoc } from './firebase.js';

/* ─────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────── */

const PERSONAL_SECTIONS = [
  {
    id: 'oneYear',
    label: '1 Year From Now',
    emoji: '🌟',
    prompt: 'In one year from now, how will your life look? Your health, mind, relationships, energy — paint the full picture.',
  },
  {
    id: 'sixMonths',
    label: '6 Months From Now',
    emoji: '🎯',
    prompt: 'To achieve your 1-year vision, in 6 months from now you need to...',
  },
  {
    id: 'threeMonths',
    label: '3 Months From Now',
    emoji: '📅',
    prompt: 'In 3 months from now, to be on track you need to...',
  },
  {
    id: 'oneMonth',
    label: '1 Month From Now',
    emoji: '🗓️',
    prompt: 'In 1 month from now, you need to...',
  },
  {
    id: 'thisWeek',
    label: 'This Week',
    emoji: '⚡',
    prompt: 'This week, the most important things you need to do are...',
  },
  {
    id: 'today',
    label: 'Today',
    emoji: '🔥',
    prompt: 'Today, you need to...',
  },
];

/* ─────────────────────────────────────────────────────────────────────
   MODULE STATE
───────────────────────────────────────────────────────────────────── */

let _deps         = null;
let _activeTab    = 'personal'; // 'personal' | 'business'
let _personalData = null;
let _businessData = null;
let _undoStack    = [];          // max 20 snapshots
let _refining     = {};          // { sectionId: bool }

/* ─────────────────────────────────────────────────────────────────────
   DEFAULT DATA SHAPES
───────────────────────────────────────────────────────────────────── */

function _defaultPersonal() {
  const d = {};
  PERSONAL_SECTIONS.forEach(s => { d[s.id] = { refined: '', summary: '', history: [] }; });
  return d;
}

function _defaultBusiness() {
  return {
    oneYear: { refined: '', summary: '', history: [] },
    steps: [
      { id: 'step_1', title: 'The first step is to...', locked: false, refined: '', summary: '', history: [], deadline: '' },
      { id: 'step_2', title: 'The next step is to...', locked: false, refined: '', summary: '', history: [], deadline: '' },
      { id: 'step_3', title: 'The next step is to...', locked: false, refined: '', summary: '', history: [], deadline: '' },
    ],
  };
}

/* ─────────────────────────────────────────────────────────────────────
   COLOUR TOKENS
───────────────────────────────────────────────────────────────────── */

function colors() {
  const light = document.body.classList.contains('light');
  return {
    heading:         light ? '#0A1628'              : '#FFFFFF',
    subheading:      light ? '#1B3A6B'              : 'rgba(255,255,255,0.7)',
    muted:           light ? '#8899B0'              : 'rgba(255,255,255,0.4)',
    cardBg:          light ? '#FFFFFF'              : 'rgba(255,255,255,0.04)',
    cardBorder:      light ? '#CDD4E0'              : 'rgba(255,255,255,0.08)',
    inputBg:         light ? '#F0F4FA'              : 'rgba(255,255,255,0.06)',
    inputBorder:     light ? '#CDD4E0'              : 'rgba(255,255,255,0.12)',
    inputText:       light ? '#0A1628'              : '#FFFFFF',
    statementBg:     light ? '#FFFBF0'              : 'rgba(201,168,76,0.07)',
    statementBdr:    light ? '#C9A84C'              : 'rgba(201,168,76,0.4)',
    statementTxt:    light ? '#5C4A00'              : 'rgba(255,245,210,0.95)',
    emptyTxt:        light ? '#8899B0'              : 'rgba(255,255,255,0.25)',
    gold:            light ? '#B8962E'              : '#C9A84C',
    goldBtn:         light ? '#1B3A6B'              : '#C9A84C',
    goldBtnTxt:      light ? '#FFFFFF'              : '#0A1628',
    addStepBtn:      light ? '#1B3A6B'              : '#C9A84C',  // always vivid
    addStepBtnTxt:   light ? '#FFFFFF'              : '#0A1628',
    dangerTxt:       light ? '#C0392B'              : '#FF6B6B',
    pageBg:          light ? '#F0F4FA'              : 'transparent',
    toggleBg:        light ? '#E4E9F2'              : 'rgba(255,255,255,0.08)',
    toggleActive:    light ? '#1B3A6B'              : '#C9A84C',
    toggleActiveTxt: light ? '#FFFFFF'              : '#0A1628',
    toggleInactive:  light ? 'transparent'          : 'transparent',
    toggleInactiveTxt: light ? '#8899B0'            : 'rgba(255,255,255,0.5)',
    undoBg:          light ? '#FFFFFF'              : 'rgba(30,30,40,0.95)',
    undoBorder:      light ? '#CDD4E0'              : 'rgba(255,255,255,0.15)',
  };
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN ENTRY
───────────────────────────────────────────────────────────────────── */

export async function renderVisionTab(deps) {
  _deps = deps;
  await _loadData();
  _paint();
}

/* ─────────────────────────────────────────────────────────────────────
   FIREBASE — LOAD & SAVE
───────────────────────────────────────────────────────────────────── */

async function _loadData() {
  try {
    const { db, user } = _deps;
    if (!db || !user?.uid) {
      _personalData = _defaultPersonal();
      _businessData = _defaultBusiness();
      return;
    }
    const uid = user.uid;

    const [pSnap, bSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'vision', 'personal')),
      getDoc(doc(db, 'users', uid, 'vision', 'business')),
    ]);

    _personalData = pSnap.exists() ? pSnap.data() : _defaultPersonal();
    _businessData = bSnap.exists() ? bSnap.data() : _defaultBusiness();

    // Ensure all personal sections exist (forward-compatible)
    PERSONAL_SECTIONS.forEach(s => {
      if (!_personalData[s.id]) _personalData[s.id] = { refined: '', history: [] };
    });

    // Ensure business shape
    if (!_businessData.oneYear) _businessData.oneYear = { refined: '', history: [] };
    if (!_businessData.steps)   _businessData.steps   = _defaultBusiness().steps;

  } catch (e) {
    console.warn('[Vision] Load error:', e);
    _personalData = _defaultPersonal();
    _businessData = _defaultBusiness();
  }
}

async function _savePersonal() {
  try {
    const { db, user } = _deps;
    if (!db || !user?.uid) return;
    await setDoc(doc(db, 'users', user.uid, 'vision', 'personal'), _personalData);
  } catch (e) {
    console.warn('[Vision] Save personal error:', e);
  }
}

async function _saveBusiness() {
  try {
    const { db, user } = _deps;
    if (!db || !user?.uid) return;
    await setDoc(doc(db, 'users', user.uid, 'vision', 'business'), _businessData);
  } catch (e) {
    console.warn('[Vision] Save business error:', e);
  }
}

/* ─────────────────────────────────────────────────────────────────────
   UNDO
───────────────────────────────────────────────────────────────────── */

function _pushUndo(description) {
  _undoStack.push({
    description,
    personal: JSON.parse(JSON.stringify(_personalData)),
    business: JSON.parse(JSON.stringify(_businessData)),
  });
  if (_undoStack.length > 20) _undoStack.shift();
}

async function _undo() {
  if (!_undoStack.length) return;
  const snap = _undoStack.pop();
  _personalData = snap.personal;
  _businessData = snap.business;
  await Promise.all([_savePersonal(), _saveBusiness()]);
  _toast(`↩ Undone: ${snap.description}`, colors());
  _paint();
}

/* ─────────────────────────────────────────────────────────────────────
   AI REFINE
───────────────────────────────────────────────────────────────────── */

async function _refineWithAI(newDraft, existingRefined, history) {
  const key = getApiKey();
  console.log('[Vision] _refineWithAI called, key present:', !!key, 'key length:', key.length);
  if (!key) {
    _toast('No API key found — add your Anthropic key in Settings', colors());
    console.warn('[Vision] No API key found in localStorage');
    return null;
  }

  const historyBlock = (history && history.length > 0)
    ? `\n\nPrevious raw drafts from this person (oldest → newest — use these to understand the full depth of what they want):\n${history.map((h, i) => `Draft ${i + 1}: "${h.text}"`).join('\n')}`
    : '';

  const existingBlock = existingRefined
    ? `\n\nCurrent refined statement (your previous best version — now make it richer, more vivid, more real):\n"${existingRefined}"`
    : '';

  const prompt = `You are a master of subconscious reprogramming through precision language. Your job is to take someone's raw vision and forge it into a first-person affirmation so vivid and emotionally true that after reading it once, they close their eyes and live it.

ABOUT THIS PERSON:
- They are based in England, UK. Use £ for any currency references, not $ or €.
- They are building toward complete time and financial freedom — never working for anyone else, only building their own legacy
- Their internal voice at their best is calm, certain, and quietly aggressive — the tone of someone who already knows
- They want to feel: energetic, certain, clear, confident, and challenged
- They are still becoming the best version of themselves — reference that identity, not any external figure

YOUR RULES:
1. Write in FIRST PERSON PRESENT TENSE only — "I am", "I walk", "I feel", "I have". Not "you will" or "one day". It is happening NOW.
2. Paint ONE vivid scene — the specific moment this vision is real and being lived. Not a declaration. A lived experience the mind can step inside.
3. Write ONE single punchy paragraph. No lists. No headers. No line breaks within it. A single wave of language that builds and lands.
4. Use SENSORY detail — what they see, what they feel in their chest and body, what the room or environment looks like, the quality of the silence or the sound around them. Make it physical.
5. Pull out every emotion they mention in their draft and amplify it into a bodily sensation — not "I feel proud" but "there is a quiet fire in my chest that needs no audience".
6. Weave in their core drive: the freedom from ever being owned by someone else's clock or vision. The arrival feels earned because of what it cost.
7. ONLY reference specific details they actually mention — names, places, businesses, relationships. Don't invent. If they mention it, make it vivid. If they don't, keep it universal.
8. Voice: calm authority. No hype. No cheerleading. The certainty of someone standing in something they built.
9. After the main paragraph, add a single blank line, then write one ANCHOR LINE — under 12 words, punchy, unforgettable — the sentence they repeat in the gym, the mirror, the quiet moment before sleep.

COMBINING RULE — THIS IS CRITICAL:
Your job is NOT to rewrite the latest draft. Your job is to read EVERY draft the person has ever written — including this new one — extract every meaningful detail, emotion, image, and desire across all of them, and forge them into one single evolving vision that contains the best of everything they have ever expressed. Each submission adds new raw material. Nothing valuable is lost. The vision gets richer, more specific, more real with every iteration — like a sculpture gaining detail, not a photo being retaken. If they mentioned something in draft 1 and never again, it still belongs in the vision if it mattered. If they mentioned something repeatedly, it is clearly important — make it vivid. The refined statement should always feel more complete and more true than the last version.${existingBlock}${historyBlock}

${newDraft ? `Latest draft (new raw material to absorb and combine with everything above): "${newDraft}"` : `A draft was just deleted. Regenerate the vision using ONLY the remaining drafts listed above. Do not include any content that is not represented in those drafts.`}

OUTPUT FORMAT:
[Single paragraph vision statement combining ALL drafts]

[Anchor line]

Nothing else. No preamble. No labels. No quotation marks. Just the paragraph, a blank line, then the anchor.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    console.log('[Vision] Scene API response status:', res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Vision] Scene API HTTP error:', res.status, errText);
      return null;
    }
    const data = await res.json();
    console.log('[Vision] Scene API data:', JSON.stringify(data).slice(0, 200));
    if (data.error) {
      console.warn('[Vision] Scene API error:', data.error);
      return null;
    }
    const text = data.content?.[0]?.text?.trim();
    console.log('[Vision] Scene result length:', text?.length);
    return text || null;
  } catch (e) {
    console.warn('[Vision] AI refine error:', e);
    return null;
  }
}


/* ─────────────────────────────────────────────────────────────────────
   VIEW MODE STATE (scene | summary per section)
───────────────────────────────────────────────────────────────────── */

let _viewMode = {}; // sectionId → 'scene' | 'summary'  (default: 'summary')

/* ─────────────────────────────────────────────────────────────────────
   AI SUMMARY (stripped-back, 4-5 sentences)
───────────────────────────────────────────────────────────────────── */

async function _refineWithAISummary(newDraft, existingRefined, history) {
  const key = getApiKey();
  if (!key) return null;

  const historyBlock = (history && history.length > 0)
    ? `\n\nAll previous drafts (oldest → newest):\n${history.map((h, i) => `Draft ${i + 1}: "${h.text}"`).join('\n')}`
    : '';

  const existingBlock = existingRefined
    ? `\n\nCurrent summary (improve and build on this):\n"${existingRefined}"`
    : '';

  const prompt = `You are distilling someone's vision into its clearest possible form. Read every draft they have written and produce a stripped-back, first-person present-tense summary — no imagery, no scene-painting, no metaphor. Just the core truth of what they are building and who they are becoming, stated with total clarity and calm authority.

CONTEXT: This person is based in England, UK. Use £ for any currency references, not $ or €.

RULES:
1. First person present tense only. "I am", "I have", "I build", "I lead". Not "I will" or "one day".
2. 4 to 5 sentences maximum. Every sentence must earn its place. No filler, no preamble.
3. No scene-painting. No sensory detail. No imagery. Just clear, direct statements of fact about who they are and what they have built.
4. Strong, active language. Avoid weak words: never use "strive", "try", "committed to", "working towards", "hope to".
5. Combine ALL drafts — extract every meaningful intention and desire, fold them into the summary. Nothing valuable is lost.
6. After the summary, add one blank line, then one ANCHOR LINE — under 12 words, unforgettable, the sentence they repeat to themselves.${existingBlock}${historyBlock}

${newDraft ? `Latest draft: "${newDraft}"` : `A draft was removed. Rebuild the summary from only the remaining drafts above.`}

OUTPUT FORMAT:
[4-5 sentence summary]

[Anchor line]

Nothing else. No labels. No preamble. No quotation marks.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Vision] Summary API HTTP error:', res.status, errText);
      return null;
    }
    const data = await res.json();
    if (data.error) { console.warn('[Vision] Summary API error:', data.error); return null; }
    return data.content?.[0]?.text?.trim() || null;
  } catch (e) {
    console.warn('[Vision] Summary refine error:', e);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   RENDER REFINED STATEMENT (shared)
───────────────────────────────────────────────────────────────────── */

function _renderRefined(sectionId, refined, summary, draftCount, c) {
  const hasScene   = !!refined;
  const hasSummary = !!summary;
  if (!hasScene && !hasSummary) return '';

  const mode     = _viewMode[sectionId] || 'summary';
  const content  = mode === 'scene' ? refined : summary;
  const parts    = (content || '').split(/\n\n+/);
  const para     = parts[0] || '';
  const anchor   = parts[1] || '';

  const anchorHtml = anchor ? `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid ${c.statementBdr};">
      <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${c.gold};text-transform:uppercase;margin-bottom:6px;">⚡ Anchor</div>
      <div style="font-size:14px;font-weight:900;color:${c.gold};line-height:1.5;letter-spacing:0.5px;font-style:italic;">${_escHtml(anchor)}</div>
    </div>` : '';

  const draftHtml = draftCount > 0
    ? `<div style="font-size:10px;color:${c.muted};margin-top:10px;font-weight:600;letter-spacing:0.5px;">${draftCount} draft${draftCount > 1 ? 's' : ''} — getting sharper each time</div>`
    : '';

  const btnBase = `flex:1;padding:8px;border:none;border-radius:7px;font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .15s;`;
  const activeStyle   = `${btnBase}background:${c.goldBtn};color:${c.goldBtnTxt};`;
  const inactiveStyle = `${btnBase}background:transparent;color:${c.muted};border:1px solid ${c.cardBorder};`;

  return `
    <div style="background:${c.statementBg};border:1.5px solid ${c.statementBdr};border-radius:12px;padding:16px 16px 14px;margin-bottom:14px;">
      <!-- Toggle row -->
      <div style="display:flex;gap:6px;margin-bottom:14px;">
        <button class="vision-mode-btn" data-section="${sectionId}" data-mode="summary"
          style="${mode === 'summary' ? activeStyle : inactiveStyle}">📋 Summary</button>
        <button class="vision-mode-btn" data-section="${sectionId}" data-mode="scene"
          style="${mode === 'scene' ? activeStyle : inactiveStyle}">🎬 Scene</button>
      </div>
      <!-- Content -->
      ${para ? `<div style="font-size:13px;font-weight:700;color:${c.statementTxt};line-height:1.8;">${_escHtml(para)}</div>` : `<div style="font-size:12px;color:${c.muted};font-style:italic;">Generating ${mode}…</div>`}
      ${anchorHtml}
      ${draftHtml}
    </div>
  `;
}

function _clearVisionBtn(sectionId, isStep, c) {
  return `<button
    class="vision-clear-btn"
    data-section="${sectionId}"
    data-is-step="${isStep ? '1' : '0'}"
    style="
      margin-top:6px;width:100%;padding:9px;border:none;border-radius:10px;
      background:transparent;border:1px solid ${c.dangerTxt}55;
      color:${c.dangerTxt};font-size:10px;font-weight:900;letter-spacing:2px;
      text-transform:uppercase;cursor:pointer;
    "
  >✕ Clear Entire Vision & Start Fresh</button>`;
}

// Which sections have their history panel open
let _historyOpen = {};

function _renderHistory(sectionId, history, c) {
  if (!history || history.length === 0) return '';
  const isOpen = !!_historyOpen[sectionId];
  const rows = history.map((entry, i) => {
    const date = new Date(entry.ts).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid ${c.cardBorder};">
        <div style="flex:1;">
          <div style="font-size:11px;color:${c.muted};font-weight:700;margin-bottom:4px;letter-spacing:0.5px;">${date}</div>
          <div style="font-size:12px;color:${c.subheading};font-weight:600;line-height:1.6;">${_escHtml(entry.text)}</div>
        </div>
        <button
          class="vision-delete-draft"
          data-section="${sectionId}"
          data-index="${i}"
          style="flex-shrink:0;background:transparent;border:1px solid ${c.dangerTxt}44;border-radius:7px;color:${c.dangerTxt};font-size:10px;font-weight:900;padding:4px 8px;cursor:pointer;margin-top:2px;"
        >✕</button>
      </div>
    `;
  }).join('');

  return `
    <div style="margin-bottom:14px;">
      <button class="vision-history-toggle" data-section="${sectionId}"
        style="background:transparent;border:none;padding:0;font-size:10px;font-weight:800;letter-spacing:1px;color:${c.muted};text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:6px;"
      >${isOpen ? '▾' : '▸'} ${history.length} previous draft${history.length > 1 ? 's' : ''}</button>
      ${isOpen ? `<div style="margin-top:10px;padding:0 4px;">${rows}</div>` : ''}
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN PAINT
───────────────────────────────────────────────────────────────────── */

function _paint() {
  const panel = _panel();
  if (!panel) return;
  const c = colors();

  panel.innerHTML = `
    <div style="min-height:100%;padding:20px 16px 100px;background:${c.pageBg};">

      <!-- Header -->
      <div style="margin-bottom:20px;">
        <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:${c.heading};text-transform:uppercase;">🗺️ Vision</div>
        <div style="font-size:11px;color:${c.muted};letter-spacing:1px;font-weight:600;margin-top:3px;">Build clarity. Work backwards. Execute forwards.</div>
      </div>

      <!-- Toggle -->
      <div style="display:flex;background:${c.toggleBg};border-radius:10px;padding:3px;gap:3px;margin-bottom:24px;">
        <button id="vision-toggle-personal" style="
          flex:1;padding:10px;border:none;border-radius:8px;
          font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;
          transition:all .18s ease;
          background:${_activeTab === 'personal' ? c.toggleActive : c.toggleInactive};
          color:${_activeTab === 'personal' ? c.toggleActiveTxt : c.toggleInactiveTxt};
        ">👤 Personal</button>
        <button id="vision-toggle-business" style="
          flex:1;padding:10px;border:none;border-radius:8px;
          font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;
          transition:all .18s ease;
          background:${_activeTab === 'business' ? c.toggleActive : c.toggleInactive};
          color:${_activeTab === 'business' ? c.toggleActiveTxt : c.toggleInactiveTxt};
        ">💼 Business</button>
      </div>

      <!-- Content -->
      <div id="vision-content">
        ${_activeTab === 'personal' ? _renderPersonal(c) : _renderBusiness(c)}
      </div>

    </div>

    <!-- Undo bar (floating) -->
    ${_undoStack.length ? `
      <div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:auto;">
        <button id="vision-undo-btn" style="
          background:${c.undoBg};border:1.5px solid ${c.undoBorder};border-radius:10px;
          color:${c.subheading};font-size:11px;font-weight:800;letter-spacing:1px;
          padding:10px 18px;cursor:pointer;
          box-shadow:0 4px 24px rgba(0,0,0,0.35);
          white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;
        ">↩ Undo: ${_escHtml(_undoStack[_undoStack.length - 1].description)}</button>
      </div>
    ` : ''}
  `;

  // Toggle listeners
  panel.querySelector('#vision-toggle-personal')?.addEventListener('click', () => {
    _activeTab = 'personal';
    _paint();
  });
  panel.querySelector('#vision-toggle-business')?.addEventListener('click', () => {
    _activeTab = 'business';
    _paint();
  });

  // Undo
  panel.querySelector('#vision-undo-btn')?.addEventListener('click', _undo);

  // Section listeners
  if (_activeTab === 'personal') _attachPersonalListeners(panel, c);
  else                           _attachBusinessListeners(panel, c);
}

/* ─────────────────────────────────────────────────────────────────────
   PERSONAL — RENDER
───────────────────────────────────────────────────────────────────── */

function _renderPersonal(c) {
  return PERSONAL_SECTIONS.map((s, i) => {
    const data    = _personalData?.[s.id] || { refined: '', history: [] };
    const isFirst = i === 0;
    const draftCount = data.history?.length || 0;

    return `
      <div class="vision-section" data-section-id="${s.id}" style="
        background:${c.cardBg};
        border:1px solid ${isFirst ? c.statementBdr : c.cardBorder};
        border-radius:16px;padding:20px 16px;margin-bottom:14px;
      ">

        <!-- Heading -->
        <div style="
          font-size:10px;font-weight:900;letter-spacing:2.5px;
          color:${isFirst ? c.gold : c.muted};
          text-transform:uppercase;margin-bottom:${data.refined ? '12px' : '14px'};
        ">${s.emoji} ${s.label}</div>

        <!-- Refined statement -->
        ${_renderRefined(s.id, data.refined, data.summary || '', draftCount, c)}

        <!-- Draft history -->
        ${_renderHistory(s.id, data.history, c)}

        <!-- Clear vision -->
        ${data.refined ? _clearVisionBtn(s.id, false, c) : ''}

        <!-- Draft textarea -->
        <textarea
          id="vision-personal-input-${s.id}"
          placeholder="${s.prompt}"
          rows="3"
          style="
            width:100%;min-height:80px;background:${c.inputBg};
            border:1px solid ${c.inputBorder};border-radius:10px;
            color:${c.inputText};font-size:13px;font-weight:600;line-height:1.6;
            padding:12px 14px;resize:vertical;box-sizing:border-box;
            font-family:inherit;outline:none;
          "
        ></textarea>

        <!-- Submit -->
        <button
          id="vision-personal-submit-${s.id}"
          data-section="${s.id}"
          style="
            margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;
            background:${c.goldBtn};color:${c.goldBtnTxt};
            font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;
            cursor:pointer;transition:opacity .18s;
          "
        >${data.refined ? '⟳ Refine Vision' : '✦ Distil My Vision'}</button>

        <!-- Refining indicator -->
        <div id="vision-personal-refining-${s.id}" style="display:none;text-align:center;padding:8px;font-size:11px;color:${c.muted};font-weight:600;font-style:italic;letter-spacing:0.5px;">
          AI is distilling your vision…
        </div>

      </div>
    `;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────
   PERSONAL — LISTENERS
───────────────────────────────────────────────────────────────────── */

function _attachPersonalListeners(panel, c) {
  PERSONAL_SECTIONS.forEach(s => {
    const submitBtn  = panel.querySelector(`#vision-personal-submit-${s.id}`);
    const textarea   = panel.querySelector(`#vision-personal-input-${s.id}`);
    const refiningEl = panel.querySelector(`#vision-personal-refining-${s.id}`);

    submitBtn?.addEventListener('click', async () => {
      const draft = textarea?.value?.trim();
      if (!draft) { _toast('Write something first', c); return; }

      if (refiningEl) refiningEl.style.display = 'block';
      if (submitBtn)  { submitBtn.disabled = true; submitBtn.textContent = '⟳ Distilling…'; }

      _pushUndo(`Edit ${s.label}`);

      // Capture current state before async call
      const currentRefined  = _personalData[s.id].refined  || '';
      const currentHistory  = _personalData[s.id].history  || [];

      const [aiScene, aiSummary] = await Promise.all([
        _refineWithAI(draft, currentRefined, currentHistory),
        _refineWithAISummary(draft, _personalData[s.id].summary || '', currentHistory),
      ]);

      _personalData[s.id].history = [...currentHistory, { text: draft, ts: Date.now() }];
      if (aiScene)   _personalData[s.id].refined = aiScene;
      if (aiSummary) _personalData[s.id].summary = aiSummary;

      if (aiScene || aiSummary) {
        _toast('Vision distilled ✦', c);
      } else {
        _toast('AI unavailable — check your API key in Settings', colors());
      }

      await _savePersonal();
      _paint();
    });
  });

  // Scene / Summary mode toggle — personal
  panel.querySelectorAll('.vision-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _viewMode[btn.dataset.section] = btn.dataset.mode;
      _paint();
    });
  });

  // History toggle & delete — personal
  panel.querySelectorAll('.vision-history-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.section;
      _historyOpen[sid] = !_historyOpen[sid];
      _paint();
    });
  });

  // Clear entire vision
  panel.querySelectorAll('.vision-clear-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.section;
      if (!confirm('Clear your entire vision for this section?\n\nAll drafts and the refined vision will be permanently removed. You can undo this immediately after.')) return;
      _pushUndo(`Clear vision: ${sid}`);
      _personalData[sid].refined = '';
      _personalData[sid].summary = '';
      _personalData[sid].history = [];
      await _savePersonal();
      _toast('Vision cleared — start fresh', c);
      _paint();
    });
  });

  panel.querySelectorAll('.vision-delete-draft').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.section;
      const idx = parseInt(btn.dataset.index, 10);
      const section = _personalData[sid];
      if (!section) return;
      const entry = section.history[idx];
      if (!entry) return;
      const preview = entry.text.length > 60 ? entry.text.slice(0, 60) + '…' : entry.text;
      if (!confirm(`Delete this draft entry?

"${preview}"

You can undo this.`)) return;
      _pushUndo(`Delete draft from ${sid}`);
      section.history = section.history.filter((_, i) => i !== idx);
      // Regenerate refined from remaining drafts, or clear if none left
      if (section.history.length === 0) {
        section.refined = '';
        await _savePersonal();
        _toast('Draft deleted — vision cleared', c);
        _paint();
      } else {
        await _savePersonal();
        _toast('Draft deleted — regenerating vision…', c);
        const combined = section.history.map((h, i) => `Draft ${i + 1}: "${h.text}"`).join('\n');
        const [aiScene, aiSummary] = await Promise.all([
          _refineWithAI('', '', section.history),
          _refineWithAISummary('', '', section.history),
        ]);
        if (aiScene)   { _personalData[sid].refined = aiScene; }
        if (aiSummary) { _personalData[sid].summary = aiSummary; }
        if (aiScene || aiSummary) await _savePersonal();
        _paint();
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────────────────
   BUSINESS — RENDER
───────────────────────────────────────────────────────────────────── */

function _renderBusiness(c) {
  const oneYear = _businessData?.oneYear || { refined: '', history: [] };
  const steps   = _businessData?.steps   || [];
  const oyCount = oneYear.history?.length || 0;

  return `
    <!-- 1-Year Business Vision -->
    <div style="
      background:${c.cardBg};border:1.5px solid ${c.statementBdr};
      border-radius:16px;padding:20px 16px;margin-bottom:20px;
    ">
      <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.gold};text-transform:uppercase;margin-bottom:${oneYear.refined ? '12px' : '14px'};">
        🏆 1 Year From Now — Your Business
      </div>

      ${_renderRefined('biz_oneyear', oneYear.refined, oneYear.summary || '', oyCount, c)}

      ${_renderHistory('biz_oneyear', oneYear.history, c)}

      ${oneYear.refined ? _clearVisionBtn('biz_oneyear', false, c) : ''}

      <textarea id="vision-biz-oneyear-input" placeholder="In one year from now, how will your business look? Revenue, reach, brand, team, impact — paint the full picture." rows="3" style="
        width:100%;min-height:80px;background:${c.inputBg};border:1px solid ${c.inputBorder};
        border-radius:10px;color:${c.inputText};font-size:13px;font-weight:600;line-height:1.6;
        padding:12px 14px;resize:vertical;box-sizing:border-box;font-family:inherit;outline:none;
      "></textarea>

      <button id="vision-biz-oneyear-submit" style="
        margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;
        background:${c.goldBtn};color:${c.goldBtnTxt};
        font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;cursor:pointer;
      ">${oneYear.refined ? '⟳ Refine Vision' : '✦ Distil My Vision'}</button>
      <div id="vision-biz-oneyear-refining" style="display:none;text-align:center;padding:8px;font-size:11px;color:${c.muted};font-weight:600;font-style:italic;">
        AI is distilling your vision…
      </div>
    </div>

    <!-- Steps heading -->
    <div style="font-size:10px;font-weight:900;letter-spacing:2.5px;color:${c.muted};text-transform:uppercase;margin-bottom:12px;">
      → The Path Forward — Step by Step
    </div>

    <!-- Step cards -->
    <div id="vision-steps-container">
      ${steps.map((step, i) => _renderStep(step, i, c)).join('')}
    </div>

    <!-- Add Step -->
    <button id="vision-add-step" style="
      width:100%;padding:16px;margin-top:8px;border:none;border-radius:14px;
      background:${c.addStepBtn};color:${c.addStepBtnTxt};
      font-size:14px;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;
      cursor:pointer;transition:opacity .18s;
      box-shadow:0 4px 16px rgba(0,0,0,0.2);
    ">+ ADD STEP</button>
  `;
}

/* ─────────────────────────────────────────────────────────────────────
   BUSINESS — STEP CARD
───────────────────────────────────────────────────────────────────── */

function _renderStep(step, index, c) {
  const draftCount = step.history?.length || 0;

  // Deadline / progress bar
  let progressHtml = '';
  if (step.deadline) {
    const now         = Date.now();
    const deadlineTs  = new Date(step.deadline + 'T23:59:59').getTime();
    const daysLeft    = Math.ceil((deadlineTs - now) / 86400000);
    const isPast      = daysLeft < 0;
    const isUrgent    = !isPast && daysLeft <= 14;
    const barCol      = isPast ? '#e74c3c' : isUrgent ? '#C9A84C' : '#2ecc71';

    // Progress: assume a 90-day window from now back; how far through are we?
    const windowDays  = 90;
    const elapsed     = windowDays - Math.max(0, daysLeft);
    const pct         = Math.min(100, Math.max(2, Math.round((elapsed / windowDays) * 100)));
    const deadlineStr = new Date(step.deadline + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    progressHtml = `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:10px;font-weight:800;color:${c.muted};">🏁 ${deadlineStr}</div>
          <div style="font-size:10px;font-weight:900;color:${barCol};">
            ${isPast ? '⚠ OVERDUE' : isUrgent ? daysLeft + ' days left — close' : daysLeft + ' days left'}
          </div>
        </div>
        <div style="height:6px;background:${c.cardBorder};border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barCol};border-radius:4px;transition:width 0.4s ease;"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="vision-step-card" data-step-id="${step.id}" style="
      background:${c.cardBg};border:1px solid ${c.cardBorder};
      border-radius:16px;padding:20px 16px;margin-bottom:14px;
    ">

      <!-- Step header row -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">

        <!-- Step number badge -->
        <div style="
          width:28px;height:28px;border-radius:50%;flex-shrink:0;
          background:${c.goldBtn};color:${c.goldBtnTxt};
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:900;
        ">${index + 1}</div>

        <!-- Title — editable or locked -->
        ${step.locked
          ? `<div style="flex:1;font-size:13px;font-weight:800;color:${c.heading};line-height:1.4;word-break:break-word;">${_escHtml(step.title)}</div>`
          : `<input
              id="vision-step-title-${step.id}"
              type="text"
              value="${_escHtml(step.title)}"
              placeholder="The next step is to..."
              style="
                flex:1;background:${c.inputBg};border:1px solid ${c.inputBorder};
                border-radius:8px;color:${c.inputText};font-size:13px;font-weight:800;
                padding:7px 10px;outline:none;font-family:inherit;
              "
            >`
        }

        <!-- Lock / unlock -->
        <button
          class="vision-step-lock-btn"
          data-step-id="${step.id}"
          title="${step.locked ? 'Unlock to edit title' : 'Lock title (read-only)'}"
          style="
            background:transparent;border:1px solid ${c.cardBorder};border-radius:8px;
            color:${c.muted};font-size:14px;padding:5px 8px;cursor:pointer;flex-shrink:0;
          "
        >${step.locked ? '🔒' : '🔓'}</button>

        <!-- Delete -->
        <button
          class="vision-step-delete-btn"
          data-step-id="${step.id}"
          title="Delete this step"
          style="
            background:transparent;border:1px solid ${c.dangerTxt}33;border-radius:8px;
            color:${c.dangerTxt};font-size:11px;font-weight:900;padding:5px 9px;cursor:pointer;flex-shrink:0;
          "
        >✕</button>
      </div>

      <!-- Progress bar (if deadline set) -->
      ${progressHtml}

      <!-- Refined vision for this step -->
      ${_renderRefined(step.id, step.refined, step.summary || '', draftCount, c)}

      <!-- Draft history -->
      ${_renderHistory(step.id, step.history, c)}

      <!-- Deadline picker -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="font-size:10px;font-weight:800;letter-spacing:1px;color:${c.muted};text-transform:uppercase;white-space:nowrap;flex-shrink:0;">🏁 Target date:</div>
        <input
          type="date"
          id="vision-step-deadline-${step.id}"
          value="${step.deadline || ''}"
          style="
            flex:1;background:${c.inputBg};border:1px solid ${c.inputBorder};
            border-radius:8px;color:${c.inputText};font-size:12px;font-weight:700;
            padding:7px 10px;outline:none;font-family:inherit;
          "
        >
      </div>

      <!-- Clear vision -->
      ${step.refined ? _clearVisionBtn(step.id, true, c) : ''}

      <!-- Draft textarea -->
      <textarea
        id="vision-step-input-${step.id}"
        placeholder="Describe your vision for this step — what does completion look like?"
        rows="3"
        style="
          width:100%;min-height:80px;background:${c.inputBg};border:1px solid ${c.inputBorder};
          border-radius:10px;color:${c.inputText};font-size:13px;font-weight:600;line-height:1.6;
          padding:12px 14px;resize:vertical;box-sizing:border-box;font-family:inherit;outline:none;
        "
      ></textarea>

      <!-- Submit -->
      <button
        class="vision-step-submit-btn"
        data-step-id="${step.id}"
        style="
          margin-top:10px;width:100%;padding:11px;border:none;border-radius:10px;
          background:${c.goldBtn};color:${c.goldBtnTxt};
          font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;cursor:pointer;
        "
      >${step.refined ? '⟳ Refine Vision' : '✦ Distil My Vision'}</button>

      <div id="vision-step-refining-${step.id}" style="display:none;text-align:center;padding:8px;font-size:11px;color:${c.muted};font-weight:600;font-style:italic;">
        AI is distilling your vision…
      </div>

    </div>
  `;
}

/* ─────────────────────────────────────────────────────────────────────
   BUSINESS — LISTENERS
───────────────────────────────────────────────────────────────────── */

function _attachBusinessListeners(panel, c) {

  // ── 1-year vision ──
  panel.querySelector('#vision-biz-oneyear-submit')?.addEventListener('click', async () => {
    const ta         = panel.querySelector('#vision-biz-oneyear-input');
    const refiningEl = panel.querySelector('#vision-biz-oneyear-refining');
    const submitBtn  = panel.querySelector('#vision-biz-oneyear-submit');
    const draft      = ta?.value?.trim();
    if (!draft) { _toast('Write something first', c); return; }

    if (refiningEl) refiningEl.style.display = 'block';
    if (submitBtn)  { submitBtn.disabled = true; submitBtn.textContent = '⟳ Distilling…'; }

    _pushUndo('Edit Business 1 Year Vision');

    const currentRefined = _businessData.oneYear.refined  || '';
    const currentHistory = _businessData.oneYear.history  || [];

    const [aiScene, aiSummary] = await Promise.all([
      _refineWithAI(draft, currentRefined, currentHistory),
      _refineWithAISummary(draft, _businessData.oneYear.summary || '', currentHistory),
    ]);

    _businessData.oneYear.history = [...currentHistory, { text: draft, ts: Date.now() }];
    if (aiScene)   _businessData.oneYear.refined = aiScene;
    if (aiSummary) _businessData.oneYear.summary = aiSummary;

    if (aiScene || aiSummary) {
      _toast('Vision distilled ✦', c);
    } else {
      _toast('AI unavailable — check your API key in Settings', colors());
    }

    await _saveBusiness();
    _paint();
  });

  // ── Per-step listeners ──
  (_businessData.steps || []).forEach(step => {

    // Title autosave on blur (only when unlocked)
    const titleInput = panel.querySelector(`#vision-step-title-${step.id}`);
    if (titleInput) {
      titleInput.addEventListener('blur', async () => {
        if (titleInput.value !== step.title) {
          _pushUndo(`Rename step ${step.title.slice(0, 20)}`);
          step.title = titleInput.value;
          await _saveBusiness();
        }
      });
    }

    // Deadline change
    const deadlineInput = panel.querySelector(`#vision-step-deadline-${step.id}`);
    if (deadlineInput) {
      deadlineInput.addEventListener('change', async () => {
        _pushUndo(`Set deadline on step ${step.title.slice(0, 20)}`);
        step.deadline = deadlineInput.value;
        await _saveBusiness();
        _paint(); // repaint to show/update progress bar
      });
    }
  });

  // ── Lock / unlock ──
  panel.querySelectorAll('.vision-step-lock-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const step = _businessData.steps.find(s => s.id === btn.dataset.stepId);
      if (!step) return;

      // Save any in-flight title edit before locking
      if (!step.locked) {
        const titleInput = panel.querySelector(`#vision-step-title-${step.id}`);
        if (titleInput && titleInput.value !== step.title) {
          step.title = titleInput.value;
        }
      }

      _pushUndo(`${step.locked ? 'Unlock' : 'Lock'} step: ${step.title.slice(0, 25)}`);
      step.locked = !step.locked;
      await _saveBusiness();
      _paint();
    });
  });

  // ── Delete step ──
  panel.querySelectorAll('.vision-step-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const step  = _businessData.steps.find(s => s.id === btn.dataset.stepId);
      if (!step) return;
      const label = step.title.length > 50 ? step.title.slice(0, 50) + '…' : step.title;

      if (!confirm(`Delete this step?\n\n"${label}"\n\nAll vision entries for this step will be removed.\nYou can undo this immediately after.`)) return;

      _pushUndo(`Delete step: ${label.slice(0, 30)}`);
      _businessData.steps = _businessData.steps.filter(s => s.id !== step.id);
      await _saveBusiness();
      _toast('Step deleted — tap Undo to restore', c);
      _paint();
    });
  });

  // ── Submit vision for step ──
  panel.querySelectorAll('.vision-step-submit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const step       = _businessData.steps.find(s => s.id === btn.dataset.stepId);
      if (!step) return;
      const ta         = panel.querySelector(`#vision-step-input-${step.id}`);
      const refiningEl = panel.querySelector(`#vision-step-refining-${step.id}`);
      const draft      = ta?.value?.trim();
      if (!draft) { _toast('Write something first', c); return; }

      if (refiningEl) refiningEl.style.display = 'block';
      btn.disabled    = true;
      btn.textContent = '⟳ Distilling…';

      _pushUndo(`Edit step: ${step.title.slice(0, 25)}`);

      const idx = _businessData.steps.findIndex(s => s.id === step.id);
      if (idx === -1) return;

      const currentRefined = _businessData.steps[idx].refined  || '';
      const currentHistory = _businessData.steps[idx].history  || [];

      const [aiScene, aiSummary] = await Promise.all([
        _refineWithAI(draft, currentRefined, currentHistory),
        _refineWithAISummary(draft, _businessData.steps[idx].summary || '', currentHistory),
      ]);

      _businessData.steps[idx].history = [...currentHistory, { text: draft, ts: Date.now() }];
      if (aiScene)   _businessData.steps[idx].refined = aiScene;
      if (aiSummary) _businessData.steps[idx].summary = aiSummary;

      if (aiScene || aiSummary) {
        _toast('Vision distilled ✦', c);
      } else {
        _toast('AI unavailable — check your API key in Settings', colors());
      }

      await _saveBusiness();
      _paint();
    });
  });

  // ── Scene / Summary mode toggle — business ──
  panel.querySelectorAll('.vision-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _viewMode[btn.dataset.section] = btn.dataset.mode;
      _paint();
    });
  });

  // ── Clear entire vision — business ──
  panel.querySelectorAll('.vision-clear-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.section;
      if (!confirm('Clear your entire vision for this section?\n\nAll drafts and the refined vision will be permanently removed. You can undo this immediately after.')) return;
      _pushUndo(`Clear vision: ${sid}`);
      if (sid === 'biz_oneyear') {
        _businessData.oneYear.refined = '';
        _businessData.oneYear.summary = '';
        _businessData.oneYear.history = [];
      } else {
        const stepIdx = _businessData.steps.findIndex(s => s.id === sid);
        if (stepIdx !== -1) { _businessData.steps[stepIdx].refined = ''; _businessData.steps[stepIdx].summary = ''; _businessData.steps[stepIdx].history = []; }
      }
      await _saveBusiness();
      _toast('Vision cleared — start fresh', c);
      _paint();
    });
  });

  // ── History toggle & delete — business ──
  panel.querySelectorAll('.vision-history-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.section;
      _historyOpen[sid] = !_historyOpen[sid];
      _paint();
    });
  });

  panel.querySelectorAll('.vision-delete-draft').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.section;
      const idx = parseInt(btn.dataset.index, 10);

      if (sid === 'biz_oneyear') {
        const entry = _businessData.oneYear.history[idx];
        if (!entry) return;
        const preview = entry.text.length > 60 ? entry.text.slice(0, 60) + '…' : entry.text;
        if (!confirm(`Delete this draft entry?\n\n"${preview}"\n\nYou can undo this.`)) return;
        _pushUndo('Delete business draft');
        _businessData.oneYear.history = _businessData.oneYear.history.filter((_, i) => i !== idx);
        await _saveBusiness();
        if (_businessData.oneYear.history.length === 0) {
          _businessData.oneYear.refined = '';
          _toast('Draft deleted — vision cleared', c);
          _paint();
        } else {
          _toast('Draft deleted — regenerating vision…', c);
          _paint();
          const [aiScene, aiSummary] = await Promise.all([
            _refineWithAI('', '', _businessData.oneYear.history),
            _refineWithAISummary('', '', _businessData.oneYear.history),
          ]);
          if (aiScene)   _businessData.oneYear.refined = aiScene;
          if (aiSummary) _businessData.oneYear.summary = aiSummary;
          if (aiScene || aiSummary) await _saveBusiness();
          _paint();
        }
      } else {
        const stepIdx = _businessData.steps.findIndex(s => s.id === sid);
        if (stepIdx === -1) return;
        const step = _businessData.steps[stepIdx];
        const entry = step.history[idx];
        if (!entry) return;
        const preview = entry.text.length > 60 ? entry.text.slice(0, 60) + '…' : entry.text;
        if (!confirm(`Delete this draft entry?\n\n"${preview}"\n\nYou can undo this.`)) return;
        _pushUndo('Delete step draft');
        _businessData.steps[stepIdx].history = step.history.filter((_, i) => i !== idx);
        await _saveBusiness();
        if (_businessData.steps[stepIdx].history.length === 0) {
          _businessData.steps[stepIdx].refined = '';
          _toast('Draft deleted — vision cleared', c);
          _paint();
        } else {
          _toast('Draft deleted — regenerating vision…', c);
          _paint();
          const [aiScene, aiSummary] = await Promise.all([
            _refineWithAI('', '', _businessData.steps[stepIdx].history),
            _refineWithAISummary('', '', _businessData.steps[stepIdx].history),
          ]);
          if (aiScene)   _businessData.steps[stepIdx].refined = aiScene;
          if (aiSummary) _businessData.steps[stepIdx].summary = aiSummary;
          if (aiScene || aiSummary) await _saveBusiness();
          _paint();
        }
      }
    });
  });

  // ── Add step ──
  panel.querySelector('#vision-add-step')?.addEventListener('click', async () => {
    _pushUndo('Add new step');
    const newStep = {
      id:       `step_${Date.now()}`,
      title:    'The next step is to...',
      locked:   false,
      refined:  '',
      summary:  '',
      history:  [],
      deadline: '',
    };
    _businessData.steps.push(newStep);
    await _saveBusiness();
    _paint();
    // Scroll to the new step
    setTimeout(() => {
      const p = _panel();
      if (p) p.scrollTop = p.scrollHeight;
    }, 80);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────── */

function _panel() {
  return document.getElementById('tab-vision')
      || document.getElementById('vision-tab')
      || document.querySelector('[data-tab="vision"]');
}

function _escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _toast(msg, c) {
  const t       = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
    background:${c.goldBtn};color:${c.goldBtnTxt};
    padding:10px 20px;border-radius:10px;font-size:12px;font-weight:800;
    letter-spacing:1px;z-index:99999;pointer-events:none;white-space:nowrap;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
