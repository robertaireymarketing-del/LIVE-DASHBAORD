export function initJournalTab(deps) {
const dayName = document.getElementById('journalDayName');
if (!dayName) return;
const fullDate = document.getElementById('journalFullDate');
const datePicker = document.getElementById('journalDatePicker');
const calendarBtn = document.getElementById('journalCalendarBtn');
const prevDayBtn = document.getElementById('journalPrevDayBtn');
const nextDayBtn = document.getElementById('journalNextDayBtn');
const entryStatus = document.getElementById('journalEntryStatus');
const bestVersionScore = document.getElementById('journalBestVersionScore');
const morningAveragesNote = document.getElementById('journalMorningAveragesNote');
const eveningAveragesNote = document.getElementById('journalEveningAveragesNote');
const openMorningBtn = document.getElementById('journalOpenMorningBtn');
const openEveningBtn = document.getElementById('journalOpenEveningBtn');
const streakEl = document.getElementById('journalStreak');
const weekMissionEl = document.getElementById('journalWeekMission');
const jumpTodayBtn = document.getElementById('journalJumpToday');
const morningCard = document.getElementById('journalMorningCard');
const morningBadge = document.getElementById('journalMorningCompletionBadge');
const morningSavedPill = document.getElementById('journalMorningSavedPill');
const morningScoreValue = document.getElementById('journalMorningScoreValue');
const eveningCard = document.getElementById('journalEveningCard');
const eveningBadge = document.getElementById('journalEveningCompletionBadge');
const eveningSavedPill = document.getElementById('journalEveningSavedPill');
const eveningScoreValue = document.getElementById('journalEveningScoreValue');

let currentDate = new Date(((deps.state.journalDate) || deps.getToday()) + 'T12:00:00');
let tjmSalesActive = false;

const morningFields = {
  rested: document.getElementById('journal-rested-range'), sharpness: document.getElementById('journal-sharpness-range'), calm: document.getElementById('journal-calm-range'), motivation: document.getElementById('journal-motivation-range'), clarity: document.getElementById('journal-clarity-range'), drive: document.getElementById('journal-drive-range'),
  identity: document.getElementById('journal-identity'), purpose: document.getElementById('journal-purpose'), stateConfidence: document.getElementById('journal-stateConfidence'), mission: document.getElementById('journal-mission'), priority1: document.getElementById('journal-priority1'), priority2: document.getElementById('journal-priority2'), priority3: document.getElementById('journal-priority3'), obstacles: document.getElementById('journal-obstacles')
};

const eveningFields = {
  execution: document.getElementById('journal-execution-range'), discipline: document.getElementById('journal-discipline-range'), dopamine: document.getElementById('journal-dopamine-range'), physical: document.getElementById('journal-physical-range'), builder: document.getElementById('journal-builder-range'), sleepprep: document.getElementById('journal-sleepprep-range'),
  missionDebrief: document.getElementById('journal-eveningMissionDebrief'), biggestWin: document.getElementById('journal-eveningBiggestWin'), biggestLesson: document.getElementById('journal-eveningBiggestLesson'), identityReflection: document.getElementById('journal-eveningIdentityReflection'), improveTomorrow: document.getElementById('journal-eveningImproveTomorrow')
};

const morningBindings = [['rested','journal-rested-val'],['sharpness','journal-sharpness-val'],['calm','journal-calm-val'],['motivation','journal-motivation-val'],['clarity','journal-clarity-val'],['drive','journal-drive-val']];
const eveningBindings = [['execution','journal-execution-val'],['discipline','journal-discipline-val'],['dopamine','journal-dopamine-val'],['physical','journal-physical-val'],['builder','journal-builder-val'],['sleepprep','journal-sleepprep-val']];

const keyFromDate = d => d.toISOString().split('T')[0];
const isFilled = v => String(v || '').trim().length > 0;
const isToday = () => keyFromDate(currentDate) === deps.getToday();

// ── TJM SALES TOGGLE ──────────────────────────────────────────────────────────
const tjmToggleBtn = document.getElementById('journalTjmSalesToggle');
if (tjmToggleBtn) {
  tjmToggleBtn.addEventListener('click', () => {
    tjmSalesActive = !tjmSalesActive;
    tjmToggleBtn.dataset.active = tjmSalesActive ? 'true' : 'false';
    tjmToggleBtn.textContent = tjmSalesActive ? 'YES ✓' : 'NO';
    tjmToggleBtn.style.background   = tjmSalesActive ? 'rgba(46,204,113,0.15)' : 'rgba(201,168,76,0.08)';
    tjmToggleBtn.style.borderColor  = tjmSalesActive ? 'rgba(46,204,113,0.4)'  : 'rgba(201,168,76,0.4)';
    tjmToggleBtn.style.color        = tjmSalesActive ? '#2ecc71' : '#C9A84C';
    updateBestVersionPercent();
  });
}

const formatDateDisplay = d => {
  dayName.textContent = d.toLocaleDateString('en-GB',{weekday:'long'});
  fullDate.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  datePicker.value = keyFromDate(d);
  deps.state.journalDate = keyFromDate(d);
  if (jumpTodayBtn) jumpTodayBtn.style.display = isToday() ? 'none' : 'flex';
};

const getStartOfWeek = d => { const x = new Date(d); const day = x.getDay(); const diff = day === 0 ? -6 : 1 - day; x.setHours(12,0,0,0); x.setDate(x.getDate()+diff); return x; };
const getDateKeyFromOffset = (base, offset) => { const x = new Date(base); x.setHours(12,0,0,0); x.setDate(x.getDate()+offset); return keyFromDate(x); };
const average = vals => { const valid = vals.filter(v => typeof v === 'number'); return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null; };
const formatAvg = (avg,max) => avg === null ? '--' : `${avg.toFixed(1)}/${max}`;

function getJournalEntry(dateKey, session) {
  const fb = deps.state.data?.journal?.[dateKey]?.[session];
  if (fb) return fb;
  try { const raw = localStorage.getItem((session === 'morning' ? 'morningJournal-' : 'eveningJournal-') + dateKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function setJournalEntry(dateKey, session, payload) {
  if (!deps.state.data.journal) deps.state.data.journal = {};
  if (!deps.state.data.journal[dateKey]) deps.state.data.journal[dateKey] = {};
  deps.state.data.journal[dateKey][session] = payload;
  deps.saveDataQuiet();
}

const getStoredScore = (prefix, key) => {
  const session = prefix.startsWith('morning') ? 'morning' : 'evening';
  const entry = getJournalEntry(key, session);
  return (entry && typeof entry.score === 'number') ? entry.score : null;
};

function computeJournalStreak() {
  let streak = 0;
  const today = deps.getToday();
  let check = new Date(today + 'T12:00:00');
  check.setDate(check.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const key = keyFromDate(check);
    const m = getJournalEntry(key, 'morning');
    const e = getJournalEntry(key, 'evening');
    if (m?.complete && e?.complete) { streak++; check.setDate(check.getDate() - 1); } else { break; }
  }
  return streak;
}

function updateStreakDisplay() {
  if (!streakEl) return;
  const streak = computeJournalStreak();
  const today = deps.getToday();
  const todayM = getJournalEntry(today, 'morning');
  const todayE = getJournalEntry(today, 'evening');
  const todayMComplete = !!todayM?.complete;
  const todayEComplete = !!todayE?.complete;
  const bothComplete = todayMComplete && todayEComplete;
  const warning = (!todayMComplete || !todayEComplete);
  const warningHtml = warning ? `<span style="color:#e74c3c;margin-left:6px;" title="${!todayMComplete ? 'Morning journal incomplete' : 'Evening journal incomplete'}">⚠️</span>` : '';
  streakEl.innerHTML = `<span style="font-size:22px;font-weight:900;color:${bothComplete ? '#2ecc71' : '#C9A84C'};">${streak}</span><span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);margin-left:4px;">day streak</span>${warningHtml}`;
}

function updateWeekMission() {
  if (!weekMissionEl || !deps.getWeekKey) return;
  const weekKey = deps.getWeekKey(currentDate);
  const raw = deps.state.data.weekObjectives?.[weekKey];
  const objs = Array.isArray(raw) ? raw : (raw ? [{text:raw,done:false}] : []);
  if (!objs.length) {
    weekMissionEl.innerHTML = `<span style="opacity:0.4;font-style:italic;">No objectives set for this week</span>`;
  } else {
    weekMissionEl.innerHTML = objs.map(o =>
      `<div class="journal-mission-obj${o.done?' done':''}"><span class="journal-mission-tick">${o.done ? '✓' : '◯'}</span><span class="journal-mission-text">${o.text}</span></div>`
    ).join('');
  }
}

function computeHistoricalAverages(){
  const currentWeekStart = getStartOfWeek(currentDate);
  const lastWeekMorning=[], lastWeekEvening=[];
  for(let i=0;i<7;i++){ const key=getDateKeyFromOffset(currentWeekStart,i-7); lastWeekMorning.push(getStoredScore('morningJournal-',key)); lastWeekEvening.push(getStoredScore('eveningJournal-',key)); }
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 12, 0, 0, 0);
  const monthMorning=[], monthEvening=[];
  const cursor=new Date(monthStart);
  while(cursor<=currentDate){ const key=keyFromDate(cursor); monthMorning.push(getStoredScore('morningJournal-',key)); monthEvening.push(getStoredScore('eveningJournal-',key)); cursor.setDate(cursor.getDate()+1); }
  return { morningLastWeek: average(lastWeekMorning), eveningLastWeek: average(lastWeekEvening), morningMonth: average(monthMorning), eveningMonth: average(monthEvening) };
}

function updateAverageNotes(){
  const avgs=computeHistoricalAverages();
  morningAveragesNote.textContent=`Vs last week: ${formatAvg(avgs.morningLastWeek,30)} · Vs month: ${formatAvg(avgs.morningMonth,30)}`;
  eveningAveragesNote.textContent=`Vs last week: ${formatAvg(avgs.eveningLastWeek,30)} · Vs month: ${formatAvg(avgs.eveningMonth,30)}`;
}

// ── SCORE BREAKDOWN MODAL ─────────────────────────────────────────────────────
function showScoreBreakdownModal(data) {
  const existing = document.getElementById('scoreBreakdownModal');
  if (existing) existing.remove();

  const isLight = deps.state.theme === 'light';
  const bg          = isLight ? '#ffffff'              : '#1a1f2e';
  const border      = isLight ? 'rgba(0,0,0,0.08)'    : 'rgba(255,255,255,0.06)';
  const labelColor  = isLight ? '#1a1f2e'              : 'rgba(255,255,255,0.85)';
  const subColor    = isLight ? 'rgba(0,0,0,0.45)'     : 'rgba(255,255,255,0.35)';
  const dimColor    = isLight ? 'rgba(0,0,0,0.3)'      : 'rgba(255,255,255,0.25)';
  const closeBg     = isLight ? 'rgba(0,0,0,0.06)'     : 'rgba(255,255,255,0.08)';
  const closeColor  = isLight ? '#444'                 : 'rgba(255,255,255,0.6)';
  const overlayBg   = isLight ? 'rgba(0,0,0,0.3)'      : 'rgba(0,0,0,0.6)';
  const barBg       = isLight ? 'rgba(0,0,0,0.08)'     : 'rgba(255,255,255,0.08)';
  const dividerBg   = isLight ? 'rgba(0,0,0,0.08)'     : 'rgba(255,255,255,0.08)';

  const { status, colour, totalScore, pillarScore, tier2Score, tier3Score, tjmScore,
          pillars, tier2Items, tier3Items, tjmDone, anyHardPillarFailed, meditationMissed, gymConsecutiveMiss } = data;

  const pillarRows = pillars.map(p =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${border};">
      <div>
        <div style="font-size:13px;font-weight:700;color:${labelColor};">${p.label}</div>
        ${p.note ? `<div style="font-size:10px;font-weight:600;color:${p.done?'rgba(46,204,113,0.7)':'#e74c3c'};margin-top:1px;">${p.note}</div>` : ''}
      </div>
      <span style="font-size:12px;font-weight:800;padding:2px 10px;border-radius:8px;background:${p.done?'rgba(46,204,113,0.15)':'rgba(231,76,60,0.15)'};color:${p.done?'#2ecc71':'#e74c3c'};">${p.done?'✓ Done':'✗ Missed'}</span>
    </div>`
  ).join('');

  const actionRows = tier2Items.map(p =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${border};">
      <span style="font-size:13px;font-weight:700;color:${labelColor};">${p.label}</span>
      <span style="font-size:12px;font-weight:800;color:#C9A84C;">${p.value}/5</span>
    </div>`
  ).join('');

  const stateRows = tier3Items.map(p =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${border};">
      <span style="font-size:13px;font-weight:700;color:${labelColor};">${p.label}</span>
      <span style="font-size:12px;font-weight:800;color:${subColor};">${p.value}/5</span>
    </div>`
  ).join('');

  let capNoteHtml = '';
  if (gymConsecutiveMiss) {
    capNoteHtml = `<div style="margin-top:10px;padding:10px 14px;border-radius:10px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);font-size:12px;font-weight:700;color:#e74c3c;line-height:1.5;">⚠️ <strong>Gym missed 2 days in a row</strong> — word capped at SURRENDER regardless of score.</div>`;
  } else if (anyHardPillarFailed) {
    capNoteHtml = `<div style="margin-top:10px;padding:10px 14px;border-radius:10px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);font-size:12px;font-weight:700;color:#e74c3c;line-height:1.5;">⚠️ <strong>Non-negotiable pillar missed</strong> (Retention or Sleep) — word capped at SURRENDER.</div>`;
  } else if (meditationMissed) {
    capNoteHtml = `<div style="margin-top:10px;padding:10px 14px;border-radius:10px;background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);font-size:12px;font-weight:700;color:#f39c12;line-height:1.5;">⚠️ <strong>Meditation missed</strong> — word capped at AVERAGE max. Hit all 4 pillars to unlock ADVANCING and above.</div>`;
  }

  // ── Word bands reference table ─────────────────────────────────────────────
  const bands = [
    { word: 'SOVEREIGN',  range: '90–100', cond: 'All pillars + meditation hit',                               c: '#D4AF37' },
    { word: 'LOCKED IN',  range: '80–89',  cond: 'All pillars + meditation hit',                               c: '#2ecc71' },
    { word: 'ADVANCING',  range: '67–79',  cond: 'All pillars + meditation hit',                               c: '#3498db' },
    { word: 'AVERAGE',    range: '53–66',  cond: 'Gym / Retention / Sleep hit (meditation optional)',          c: '#f39c12' },
    { word: 'RETREATING', range: '35–52',  cond: 'Gym / Retention / Sleep hit, poor execution',               c: '#e67e22' },
    { word: 'SURRENDER',  range: 'Below 35', cond: 'Or: Retention/Sleep missed, or Gym missed 2 days in a row', c: '#e74c3c' },
  ];

  const bandsRows = bands.map(b =>
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid ${border};">
      <span style="font-size:11px;font-weight:900;min-width:80px;color:${b.c};">${b.word}</span>
      <span style="font-size:11px;font-weight:700;min-width:52px;color:${subColor};">${b.range}</span>
      <span style="font-size:11px;font-weight:600;color:${dimColor};flex:1;line-height:1.4;">${b.cond}</span>
    </div>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'scoreBreakdownModal';
  modal.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:${overlayBg};backdrop-filter:blur(4px);`;
  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:${bg};border-radius:20px 20px 0 0;padding:24px 20px 36px;max-height:88vh;overflow-y:auto;">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div>
          <div style="font-size:26px;font-weight:900;color:${colour};letter-spacing:-0.5px;">${status}</div>
          <div style="font-size:13px;font-weight:700;color:${subColor};margin-top:2px;">Score breakdown · ${totalScore}/100</div>
        </div>
        <button id="closeScoreModal" style="background:${closeBg};border:none;border-radius:50%;width:34px;height:34px;font-size:18px;color:${closeColor};cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <div style="height:5px;background:${barBg};border-radius:3px;overflow:hidden;margin-bottom:22px;">
        <div style="height:100%;width:${Math.min(100,totalScore)}%;background:${colour};border-radius:3px;"></div>
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${subColor};text-transform:uppercase;">Tier 1 · Pillars</span>
          <span style="font-size:14px;font-weight:900;color:${anyHardPillarFailed||gymConsecutiveMiss?'#e74c3c':'#2ecc71'};">${pillarScore}/35</span>
        </div>
        ${pillarRows}
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${subColor};text-transform:uppercase;">Tier 2 · Controllable Actions</span>
          <span style="font-size:14px;font-weight:900;color:#C9A84C;">${tier2Score}/40</span>
        </div>
        ${actionRows}
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${subColor};text-transform:uppercase;">Tier 3 · State &amp; Feeling</span>
          <span style="font-size:14px;font-weight:900;color:${subColor};">${tier3Score}/20</span>
        </div>
        ${stateRows}
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
          <span style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${subColor};text-transform:uppercase;">Bonus · TJM Sales Action</span>
          <span style="font-size:14px;font-weight:900;color:${tjmDone?'#2ecc71':subColor};">${tjmScore}/5</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid ${border};">
          <span style="font-size:13px;font-weight:700;color:${labelColor};">Sales action taken today</span>
          <span style="font-size:12px;font-weight:800;padding:2px 10px;border-radius:8px;background:${tjmDone?'rgba(46,204,113,0.15)':'rgba(0,0,0,0.06)'};color:${tjmDone?'#2ecc71':subColor};">${tjmDone?'✓ Yes':'✗ No'}</span>
        </div>
      </div>

      ${capNoteHtml}

      <div style="margin-top:22px;padding-top:16px;border-top:2px solid ${dividerBg};">
        <div style="font-size:10px;font-weight:900;letter-spacing:1.5px;color:${subColor};text-transform:uppercase;margin-bottom:10px;">Word Bands Reference</div>
        ${bandsRows}
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('closeScoreModal').addEventListener('click', () => modal.remove());
}

function updateBestVersionPercent(){
  const dateKey = keyFromDate(currentDate);
  const todayData = deps.state.data?.days?.[dateKey] || {};

  // Yesterday for consecutive gym check
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayData = deps.state.data?.days?.[keyFromDate(yesterday)] || {};

  const gymDone            = !!todayData.gym;
  const gymMissedYesterday = !yesterdayData.gym;
  const gymConsecutiveMiss = !gymDone && gymMissedYesterday;

  const retentionDone = !!todayData.retention;
  const meditateDone  = !!todayData.meditation;
  const sleepOnTime   = Number(eveningFields.sleepprep?.value || 0) >= 4;

  const gymPts       = gymDone ? 10 : 0;
  const retentionPts = retentionDone ? 10 : 0;
  const sleepPts     = sleepOnTime ? 10 : 0;
  const meditatePts  = meditateDone ? 5 : 0;
  const pillarScore  = gymPts + retentionPts + sleepPts + meditatePts;

  const anyHardPillarFailed = !retentionDone || !sleepOnTime;
  const meditationMissed    = !meditateDone;

  const pillars = [
    { label: 'Gym (10pts)',                        done: gymDone,       note: gymConsecutiveMiss ? '⚠ 2nd missed day — SURRENDER' : (!gymDone ? '1 rest day allowed' : '') },
    { label: 'Retention (10pts)',                  done: retentionDone  },
    { label: 'Sleep on time — prep ≥ 4/5 (10pts)', done: sleepOnTime   },
    { label: 'Meditation (5pts)',                  done: meditateDone,  note: !meditateDone ? 'caps word at AVERAGE max' : '' },
  ];

  // ── TIER 2: Controllable Actions (40pts) ─────────────────────────────────
  const tier2Items = [
    { label: 'Mission Execution',     value: Number(eveningFields.execution?.value  || 0) },
    { label: 'Self Discipline',       value: Number(eveningFields.discipline?.value || 0) },
    { label: 'Dopamine Discipline',   value: Number(eveningFields.dopamine?.value   || 0) },
    { label: 'Physical Standard',     value: Number(eveningFields.physical?.value   || 0) },
    { label: 'Builder / CEO Mindset', value: Number(eveningFields.builder?.value    || 0) },
    { label: 'Goal Clarity (AM)',     value: Number(morningFields.clarity?.value    || 0) },
  ];
  const tier2Raw   = tier2Items.reduce((s,i) => s + i.value, 0);
  const tier2Score = Math.round((tier2Raw / 30) * 40);

  // ── TIER 3: State & Feeling (20pts) ──────────────────────────────────────
  const tier3Items = [
    { label: 'Rested',           value: Number(morningFields.rested?.value     || 0) },
    { label: 'Mental Sharpness', value: Number(morningFields.sharpness?.value  || 0) },
    { label: 'Calmness',         value: Number(morningFields.calm?.value       || 0) },
    { label: 'Motivation',       value: Number(morningFields.motivation?.value || 0) },
    { label: 'Sex Drive',        value: Number(morningFields.drive?.value      || 0) },
  ];
  const tier3Raw   = tier3Items.reduce((s,i) => s + i.value, 0);
  const tier3Score = Math.round((tier3Raw / 25) * 20);

  // ── TJM SALES (5pts) ─────────────────────────────────────────────────────
  const tjmDone  = tjmSalesActive;
  const tjmScore = tjmDone ? 5 : 0;

  const totalScore = pillarScore + tier2Score + tier3Score + tjmScore;

  // ── WORD LABEL ─────────────────────────────────────────────────────────────
  let status, colour;
  if (gymConsecutiveMiss || anyHardPillarFailed || totalScore < 35) {
    status = 'SURRENDER'; colour = '#e74c3c';
  } else if (meditationMissed) {
    if      (totalScore >= 53) { status = 'AVERAGE';    colour = '#f39c12'; }
    else if (totalScore >= 35) { status = 'RETREATING'; colour = '#e67e22'; }
    else                       { status = 'SURRENDER';  colour = '#e74c3c'; }
  } else if (totalScore >= 90) { status = 'SOVEREIGN';  colour = '#D4AF37'; }
  else if   (totalScore >= 80) { status = 'LOCKED IN';  colour = '#2ecc71'; }
  else if   (totalScore >= 67) { status = 'ADVANCING';  colour = '#3498db'; }
  else if   (totalScore >= 53) { status = 'AVERAGE';    colour = '#f39c12'; }
  else if   (totalScore >= 35) { status = 'RETREATING'; colour = '#e67e22'; }
  else                         { status = 'SURRENDER';  colour = '#e74c3c'; }

  // ── PILLAR BADGES ─────────────────────────────────────────────────────────
  const badgePillars = [
    { label: 'Gym',       done: gymDone && !gymConsecutiveMiss },
    { label: 'Retention', done: retentionDone },
    { label: 'Meditate',  done: meditateDone  },
    { label: 'Sleep',     done: sleepOnTime   },
    { label: 'TJM',       done: tjmDone       },
  ];
  const pillarHtml = badgePillars.map(p =>
    `<span style="font-size:9px;font-weight:800;letter-spacing:0.5px;padding:2px 7px;border-radius:10px;` +
    `background:${p.done?'rgba(46,204,113,0.15)':'rgba(231,76,60,0.15)'};` +
    `color:${p.done?'#2ecc71':'#e74c3c'};` +
    `border:1px solid ${p.done?'rgba(46,204,113,0.3)':'rgba(231,76,60,0.3)'};">` +
    `${p.done?'✓':'✗'} ${p.label}</span>`
  ).join('');

  const breakdownHtml =
    `<span style="font-size:9px;color:rgba(255,255,255,0.25);font-weight:700;">` +
    `Pillars ${pillarScore}/35 · Actions ${tier2Score}/40 · State ${tier3Score}/20 · TJM ${tjmScore}/5` +
    `</span>`;

  const scoreSnapshot = { status, colour, totalScore, pillarScore, tier2Score, tier3Score, tjmScore,
    pillars, tier2Items, tier3Items, tjmDone, anyHardPillarFailed, meditationMissed, gymConsecutiveMiss };

  bestVersionScore.style.cursor = 'pointer';
  bestVersionScore.title = 'Tap to see full breakdown';
  bestVersionScore.onclick = () => showScoreBreakdownModal(scoreSnapshot);

  bestVersionScore.innerHTML =
    `<div style="width:100%;">` +
      `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;">` +
        `<span style="font-size:30px;font-weight:900;color:${colour};letter-spacing:-0.5px;">${status}</span>` +
        `<span style="font-size:15px;font-weight:800;color:${colour};opacity:0.8;">${totalScore}/100</span>` +
        `<span style="font-size:10px;color:rgba(255,255,255,0.2);font-weight:600;margin-left:auto;">tap for breakdown ↗</span>` +
      `</div>` +
      `<div style="height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;margin-bottom:8px;">` +
        `<div style="height:100%;width:${Math.min(100,totalScore)}%;background:${colour};border-radius:2px;transition:width 0.4s;"></div>` +
      `</div>` +
      `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px;">${pillarHtml}</div>` +
      `${breakdownHtml}` +
      `<div style="font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-top:5px;">DAILY STANDARD</div>` +
    `</div>`;
}

function computeMorningScore(){ const total=Number(morningFields.rested.value)+Number(morningFields.sharpness.value)+Number(morningFields.calm.value)+Number(morningFields.motivation.value)+Number(morningFields.clarity.value)+Number(morningFields.drive.value); morningScoreValue.textContent=total; updateBestVersionPercent(); return total; }
function computeEveningScore(){ const total=Number(eveningFields.execution.value)+Number(eveningFields.discipline.value)+Number(eveningFields.dopamine.value)+Number(eveningFields.physical.value)+Number(eveningFields.builder.value)+Number(eveningFields.sleepprep.value); eveningScoreValue.textContent=total; updateBestVersionPercent(); return total; }

function evaluateMorningCompletion(){ const complete=[morningFields.identity,morningFields.purpose,morningFields.stateConfidence,morningFields.mission,morningFields.priority1,morningFields.priority2,morningFields.priority3,morningFields.obstacles].every(el=>isFilled(el.value)); morningCard.classList.toggle('complete-block', complete); morningBadge.textContent=complete?'Complete':'In progress'; morningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }
function evaluateEveningCompletion(){ const complete=[eveningFields.missionDebrief,eveningFields.biggestWin,eveningFields.biggestLesson,eveningFields.identityReflection,eveningFields.improveTomorrow].every(el=>isFilled(el.value)); eveningCard.classList.toggle('complete-block', complete); eveningBadge.textContent=complete?'Complete':'In progress'; eveningBadge.classList.toggle('is-complete', complete); updateLauncherButtons(); return complete; }

function saveMorning(){
  const complete = evaluateMorningCompletion();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const existing = getJournalEntry(keyFromDate(currentDate),'morning') || {};
  const payload={rested:morningFields.rested.value,sharpness:morningFields.sharpness.value,calm:morningFields.calm.value,motivation:morningFields.motivation.value,clarity:morningFields.clarity.value,drive:morningFields.drive.value,identity:morningFields.identity.value,purpose:morningFields.purpose.value,stateConfidence:morningFields.stateConfidence.value,mission:morningFields.mission.value,priority1:morningFields.priority1.value,priority2:morningFields.priority2.value,priority3:morningFields.priority3.value,obstacles:morningFields.obstacles.value,score:computeMorningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
  setJournalEntry(keyFromDate(currentDate),'morning',payload);
  morningSavedPill.textContent = `Saved ${timeStr}`;
  morningSavedPill.style.display='inline';
  setTimeout(()=>morningSavedPill.style.display='none',2500);
  entryStatus.textContent='Saved morning entry for '+fullDate.textContent;
  updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
}

function saveEvening(){
  const complete = evaluateEveningCompletion();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const existing = getJournalEntry(keyFromDate(currentDate),'evening') || {};
  const payload={execution:eveningFields.execution.value,discipline:eveningFields.discipline.value,dopamine:eveningFields.dopamine.value,physical:eveningFields.physical.value,builder:eveningFields.builder.value,sleepprep:eveningFields.sleepprep.value,tjmSalesAction:tjmSalesActive,missionDebrief:eveningFields.missionDebrief.value,biggestWin:eveningFields.biggestWin.value,biggestLesson:eveningFields.biggestLesson.value,identityReflection:eveningFields.identityReflection.value,improveTomorrow:eveningFields.improveTomorrow.value,score:computeEveningScore(),complete,savedAt:timeStr,firstSavedAt:existing.firstSavedAt||timeStr};
  setJournalEntry(keyFromDate(currentDate),'evening',payload);
  eveningSavedPill.textContent = `Saved ${timeStr}`;
  eveningSavedPill.style.display='inline';
  setTimeout(()=>eveningSavedPill.style.display='none',2500);
  entryStatus.textContent='Saved evening entry for '+fullDate.textContent;
  updateAverageNotes(); updateBestVersionPercent(); updateStreakDisplay(); updateLauncherButtons();
}

function loadTjmToggle(active) {
  tjmSalesActive = !!active;
  if (tjmToggleBtn) {
    tjmToggleBtn.dataset.active   = tjmSalesActive ? 'true' : 'false';
    tjmToggleBtn.textContent      = tjmSalesActive ? 'YES ✓' : 'NO';
    tjmToggleBtn.style.background  = tjmSalesActive ? 'rgba(46,204,113,0.15)' : 'rgba(201,168,76,0.08)';
    tjmToggleBtn.style.borderColor = tjmSalesActive ? 'rgba(46,204,113,0.4)'  : 'rgba(201,168,76,0.4)';
    tjmToggleBtn.style.color       = tjmSalesActive ? '#2ecc71' : '#C9A84C';
  }
}

function loadMorning(){ const data=getJournalEntry(keyFromDate(currentDate),'morning')||{}; morningFields.rested.value=data.rested??3; morningFields.sharpness.value=data.sharpness??3; morningFields.calm.value=data.calm??3; morningFields.motivation.value=data.motivation??3; morningFields.clarity.value=data.clarity??3; morningFields.drive.value=data.drive??3; morningFields.identity.value=data.identity??''; morningFields.purpose.value=data.purpose??''; morningFields.stateConfidence.value=data.stateConfidence??''; morningFields.mission.value=data.mission??''; morningFields.priority1.value=data.priority1??''; morningFields.priority2.value=data.priority2??''; morningFields.priority3.value=data.priority3??''; morningFields.obstacles.value=data.obstacles??''; morningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = morningFields[key].value; }); computeMorningScore(); evaluateMorningCompletion(); }

function loadEvening(){ const data=getJournalEntry(keyFromDate(currentDate),'evening')||{}; eveningFields.execution.value=data.execution??3; eveningFields.discipline.value=data.discipline??3; eveningFields.dopamine.value=data.dopamine??3; eveningFields.physical.value=data.physical??3; eveningFields.builder.value=data.builder??3; eveningFields.sleepprep.value=data.sleepprep??3; eveningFields.missionDebrief.value=data.missionDebrief??''; eveningFields.biggestWin.value=data.biggestWin??''; eveningFields.biggestLesson.value=data.biggestLesson??''; eveningFields.identityReflection.value=data.identityReflection??''; eveningFields.improveTomorrow.value=data.improveTomorrow??''; eveningBindings.forEach(([key,valId])=>{ document.getElementById(valId).textContent = eveningFields[key].value; }); loadTjmToggle(data.tjmSalesAction); computeEveningScore(); evaluateEveningCompletion();
  const morningEl = document.getElementById('journalTodayMissionReminder');
  if (morningEl) {
    const morningData = getJournalEntry(keyFromDate(currentDate), 'morning') || {};
    if (morningData.mission && morningData.mission.trim()) {
      morningEl.style.display = 'block';
      morningEl.textContent = '📋 Today\'s mission: "' + morningData.mission.trim() + '"';
    } else {
      morningEl.style.display = 'none';
    }
  }
}

function updateLauncherButtons() {
  const mComplete = morningBadge.classList.contains('is-complete');
  const eComplete = eveningBadge.classList.contains('is-complete');
  openMorningBtn.classList.toggle('launch-complete', mComplete);
  openEveningBtn.classList.toggle('launch-complete', eComplete);
  const morningOpen = !morningCard.classList.contains('journal-collapsed');
  const eveningOpen = !eveningCard.classList.contains('journal-collapsed');
  openMorningBtn.innerHTML = morningOpen
    ? `${mComplete?'✓ ':''}Morning Journal — Open<small>Tap to collapse</small>`
    : `${mComplete?'✓ ':''}Morning Journal<small>${mComplete?'Completed · tap to review':'Open readiness, identity, mission, and priorities'}</small>`;
  openEveningBtn.innerHTML = eveningOpen
    ? `${eComplete?'✓ ':''}Evening Reflection — Open<small>Tap to collapse</small>`
    : `${eComplete?'✓ ':''}Evening Reflection<small>${eComplete?'Completed · tap to review':'Open execution, reflection, and reset for tomorrow'}</small>`;
}

function toggleMorning(){
  if(morningCard.classList.contains('journal-collapsed')) {
    morningCard.classList.remove('journal-collapsed');
    setTimeout(() => morningCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  } else {
    saveMorning();
    morningCard.classList.add('journal-collapsed');
  }
  updateLauncherButtons();
}

function toggleEvening(){
  if(eveningCard.classList.contains('journal-collapsed')) {
    eveningCard.classList.remove('journal-collapsed');
    setTimeout(() => eveningCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  } else {
    saveEvening();
    eveningCard.classList.add('journal-collapsed');
  }
  updateLauncherButtons();
}

morningBindings.forEach(([key,valId])=>{ const range=morningFields[key]; const val=document.getElementById(valId); range.addEventListener('input', ()=>{ val.textContent=range.value; computeMorningScore(); }); });
eveningBindings.forEach(([key,valId])=>{ const range=eveningFields[key]; const val=document.getElementById(valId); range.addEventListener('input', ()=>{ val.textContent=range.value; computeEveningScore(); }); });

Object.values(morningFields).forEach(el=>el.addEventListener('input', evaluateMorningCompletion));
Object.values(eveningFields).forEach(el=>el.addEventListener('input', evaluateEveningCompletion));

document.getElementById('journalCollapseMorningBtn').addEventListener('click', toggleMorning);
document.getElementById('journalCollapseMorningBtnBottom').addEventListener('click', toggleMorning);
document.getElementById('journalCollapseEveningBtn').addEventListener('click', toggleEvening);
document.getElementById('journalCollapseEveningBtnBottom').addEventListener('click', toggleEvening);

openMorningBtn.addEventListener('click', () => {
  if (morningCard.classList.contains('journal-collapsed')) { toggleMorning(); } else { saveMorning(); toggleMorning(); }
});
openEveningBtn.addEventListener('click', () => {
  if (eveningCard.classList.contains('journal-collapsed')) { toggleEvening(); } else { saveEvening(); toggleEvening(); }
});

if (jumpTodayBtn) {
  jumpTodayBtn.addEventListener('click', () => {
    currentDate = new Date(deps.getToday() + 'T12:00:00');
    formatDateDisplay(currentDate);
    loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
    updateStreakDisplay(); updateJournalWeekObjectives(); updateWeekMission();
  });
}

function updateJournalWeekObjectives() {
  const el = document.getElementById('journalWeekObjectives');
  if (!el) return;
  const weekKey = deps.getWeekKey ? deps.getWeekKey(currentDate) : null;
  el.innerHTML = (weekKey && window._weekObjsHtml) ? window._weekObjsHtml(deps.state.data.weekObjectives, weekKey, true) : '';
  const wmEl = document.getElementById('journalWeekMission');
  if (wmEl) wmEl.style.display = 'none';
}

function navigateDay(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  formatDateDisplay(currentDate);
  loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
  updateStreakDisplay(); updateJournalWeekObjectives(); updateWeekMission();
}

prevDayBtn.addEventListener('click', () => navigateDay(-1));
nextDayBtn.addEventListener('click', () => navigateDay(1));

calendarBtn.addEventListener('click', () => {
  if (datePicker.showPicker) { try { datePicker.showPicker(); } catch(e) { datePicker.click(); } }
  else { datePicker.click(); }
});

datePicker.addEventListener('change', e => {
  currentDate = new Date(e.target.value + 'T12:00:00');
  formatDateDisplay(currentDate);
  loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
  updateStreakDisplay(); updateJournalWeekObjectives(); updateWeekMission();
});

formatDateDisplay(currentDate);
loadMorning(); loadEvening(); updateAverageNotes(); updateBestVersionPercent();
updateStreakDisplay(); updateLauncherButtons(); updateJournalWeekObjectives(); updateWeekMission();
}
