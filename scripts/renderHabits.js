// ── Habit Tracker ───────────────────────────────────────────────────────────
// Standalone page, launched from the Journal tab's "Habit Tracker" button.
// Data lives in state.data.habits = { items:[{id,name,emoji,createdAt}], log:{ 'YYYY-MM-DD': {habitId:true} }, view:'3' }
// Rule: any ELIGIBLE past day (>= habit createdAt, < today) that isn't ticked = MISS (red).
//       Today stays neutral until ticked. Days before a habit existed are greyed out.
// All colours are hardcoded hex so the page reads correctly in the dashboard's light mode.

// ── Palette (hardcoded, light-mode safe) ───────────────────────────────────
const C = {
  ink:      '#0A1628',
  muted:    '#6B7A90',
  faint:    '#9AA7B8',
  line:     '#E2E8F0',
  lineStrong:'#CDD4E0',
  card:     '#FFFFFF',
  panel:    '#F7F9FC',
  gold:     '#C9A84C',
  navy:     '#1B3A6B',
  done:     '#22A35A',
  doneEdge: '#1B8A4B',
  miss:     '#E74C3C',
  missSoft: '#F6C9C4',
  open:     '#FFFFFF',
  openEdge: '#C3CEDC',
  grey:     '#EEF2F6',
  amber:    '#F39C12',
  amberBg:  '#FDF3E0',
  amberEdge:'#E9C27A',
};

const VIEWS = [
  ['3', '3-Day'], ['7', '7-Day'], ['30', '30-Day'], ['month', 'This Month'],
  ['60', '60-Day'], ['90', '90-Day'], ['365', 'Year'], ['all', 'All-Time'],
];

// ── Date helpers (local, noon-anchored to dodge timezone drift) ─────────────
function atNoon(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; }
function ymd(d) {
  const x = atNoon(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function parseYmd(s) { return atNoon(new Date(s + 'T12:00:00')); }
function addDays(d, n) { const x = atNoon(d); x.setDate(x.getDate() + n); return x; }
function todayStr() { return ymd(new Date()); }
function diffDays(aStr, bStr) { return Math.round((parseYmd(aStr) - parseYmd(bStr)) / 86400000); }
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── State access ────────────────────────────────────────────────────────────
function getHabits(state) {
  const h = state.data && state.data.habits;
  if (!h) return { items: [], log: {}, view: '3' };
  return { items: h.items || [], log: h.log || {}, view: h.view || '3' };
}
function isDone(H, habitId, dStr) { return !!(H.log[dStr] && H.log[dStr][habitId]); }

// status for one habit on one day: 'pre' | 'future' | 'done' | 'open' | 'miss'
function dayStatus(H, habit, dStr, tStr) {
  if (dStr < habit.createdAt) return 'pre';
  if (dStr > tStr) return 'future';
  if (isDone(H, habit.id, dStr)) return 'done';
  if (dStr === tStr) return 'open';
  return 'miss';
}

// current streak: consecutive done ending today, or ending yesterday if today not yet done
function currentStreak(H, habit, tStr) {
  let cursor = parseYmd(tStr);
  if (!isDone(H, habit.id, tStr)) cursor = addDays(cursor, -1);
  let s = 0;
  for (let i = 0; i < 2000; i++) {
    const k = ymd(cursor);
    if (k < habit.createdAt) break;
    if (isDone(H, habit.id, k)) { s++; cursor = addDays(cursor, -1); } else break;
  }
  return s;
}
function longestStreak(H, habit, tStr) {
  let cursor = parseYmd(habit.createdAt);
  let best = 0, run = 0;
  const guard = diffDays(tStr, habit.createdAt) + 2;
  for (let i = 0; i < Math.min(guard, 4000); i++) {
    const k = ymd(cursor);
    if (k > tStr) break;
    if (isDone(H, habit.id, k)) { run++; if (run > best) best = run; } else run = 0;
    cursor = addDays(cursor, 1);
  }
  return best;
}

// settled days = eligible days in [start..min(end, yesterday)]  (today excluded — the day isn't over)
function settledRange(habit, startStr, endStr, tStr) {
  const yStr = ymd(addDays(parseYmd(tStr), -1));
  const from = startStr > habit.createdAt ? startStr : habit.createdAt;
  const to = endStr < yStr ? endStr : yStr;
  const out = [];
  if (to < from) return out;
  let cursor = parseYmd(from);
  while (ymd(cursor) <= to) { out.push(ymd(cursor)); cursor = addDays(cursor, 1); }
  return out;
}
function completionPct(H, habit, startStr, endStr, tStr) {
  const days = settledRange(habit, startStr, endStr, tStr);
  if (!days.length) return null;
  const done = days.filter(d => isDone(H, habit.id, d)).length;
  return Math.round((done / days.length) * 100);
}
// count of distinct runs of 2+ consecutive misses in the settled range
function slipRuns(H, habit, startStr, endStr, tStr) {
  const days = settledRange(habit, startStr, endStr, tStr);
  let runs = 0, run = 0;
  for (const d of days) {
    if (!isDone(H, habit.id, d)) { run++; if (run === 2) runs++; } else run = 0;
  }
  return runs;
}
// at risk RIGHT NOW: today not done yet, and yesterday was an eligible miss
function atRisk(H, habit, tStr) {
  if (isDone(H, habit.id, tStr)) return false;
  const yStr = ymd(addDays(parseYmd(tStr), -1));
  if (yStr < habit.createdAt) return false;
  return !isDone(H, habit.id, yStr);
}

function rangeFor(view, items, tStr) {
  const t = parseYmd(tStr);
  if (view === 'month') {
    const first = new Date(t.getFullYear(), t.getMonth(), 1, 12, 0, 0, 0);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0, 12, 0, 0, 0);
    return { start: ymd(first), end: ymd(last) };
  }
  if (view === 'all') {
    let earliest = tStr;
    items.forEach(h => { if (h.createdAt && h.createdAt < earliest) earliest = h.createdAt; });
    return { start: earliest, end: tStr };
  }
  const n = parseInt(view, 10) || 3;
  return { start: ymd(addDays(t, -(n - 1))), end: tStr };
}
function daysBetween(startStr, endStr) {
  const out = [];
  let cursor = parseYmd(startStr);
  while (ymd(cursor) <= endStr) { out.push(ymd(cursor)); cursor = addDays(cursor, 1); }
  return out;
}

// ── Square sizing by column count ───────────────────────────────────────────
function sizing(n) {
  if (n <= 7)   return { sq: 40, gap: 8,  labels: true,  round: 10, font: 15 };
  if (n <= 14)  return { sq: 30, gap: 6,  labels: true,  round: 8,  font: 12 };
  if (n <= 31)  return { sq: 22, gap: 4,  labels: true,  round: 6,  font: 0 };
  if (n <= 62)  return { sq: 16, gap: 3,  labels: false, round: 4,  font: 0 };
  if (n <= 95)  return { sq: 13, gap: 2,  labels: false, round: 3,  font: 0 };
  if (n <= 200) return { sq: 11, gap: 2,  labels: false, round: 2,  font: 0 };
  return { sq: 9, gap: 1, labels: false, round: 2, font: 0 };
}

function squareStyle(status, s) {
  const base = `width:${s.sq}px;height:${s.sq}px;border-radius:${s.round}px;flex:0 0 auto;box-sizing:border-box;`;
  switch (status) {
    case 'done':   return base + `background:${C.done};border:1px solid ${C.doneEdge};cursor:pointer;`;
    case 'miss':   return base + `background:${C.miss};border:1px solid ${C.miss};cursor:pointer;`;
    case 'open':   return base + `background:${C.open};border:1.5px dashed ${C.openEdge};cursor:pointer;`;
    case 'pre':    return base + `background:${C.grey};border:1px solid ${C.grey};`;
    default:       return base + `background:${C.grey};border:1px dashed ${C.line};`; // future
  }
}

const LABEL_W = 132;

// ── Grid ────────────────────────────────────────────────────────────────────
function buildGrid(H, tStr) {
  const { start, end } = rangeFor(H.view, H.items, tStr);
  const days = daysBetween(start, end);
  const s = sizing(days.length);
  const col = s.sq + s.gap;

  if (!H.items.length) {
    return `<div style="padding:34px 18px;text-align:center;color:${C.muted};font-size:13px;font-weight:600;">
      No habits yet. Add your first one above to start building the chain.</div>`;
  }

  // header row (dates)
  let header = `<div style="display:flex;align-items:flex-end;">
    <div style="position:sticky;left:0;z-index:3;background:${C.card};width:${LABEL_W}px;flex:0 0 ${LABEL_W}px;"></div>`;
  days.forEach((d, i) => {
    const dt = parseYmd(d);
    const isToday = d === tStr;
    const showDate = s.labels;
    const firstOfMonth = dt.getDate() === 1;
    const label = showDate
      ? `<div style="font-size:9px;font-weight:800;color:${isToday ? C.gold : C.faint};line-height:1.1;text-align:center;">
           <div>${WD[dt.getDay()][0]}</div><div>${dt.getDate()}</div></div>`
      : (firstOfMonth
          ? `<div style="font-size:8px;font-weight:800;color:${C.faint};text-align:center;line-height:1;">${MO[dt.getMonth()]}</div>`
          : `<div style="height:1px;"></div>`);
    header += `<div style="width:${s.sq}px;margin-right:${s.gap}px;flex:0 0 auto;display:flex;justify-content:center;align-items:flex-end;min-height:${s.labels ? 26 : 12}px;">${label}</div>`;
  });
  header += `</div>`;

  // habit rows
  const rows = H.items.map(habit => {
    const risk = atRisk(H, habit, tStr);
    const streak = currentStreak(H, habit, tStr);
    const labelBg = risk ? C.amberBg : C.card;
    const nameColor = risk ? '#B9770E' : C.ink;
    const streakChip = streak > 0
      ? `<span style="font-size:10px;font-weight:900;color:${C.done};">🔥${streak}</span>`
      : `<span style="font-size:10px;font-weight:800;color:${C.faint};">0</span>`;
    let cells = '';
    days.forEach(d => {
      const st = dayStatus(H, habit, d, tStr);
      const clickable = (st === 'done' || st === 'miss' || st === 'open');
      const onclick = clickable ? ` onclick="habitToggle('${habit.id}','${d}')"` : '';
      const check = (st === 'done' && s.sq >= 22) ? `<span style="color:#fff;font-size:${Math.round(s.sq * 0.5)}px;font-weight:900;line-height:${s.sq}px;">✓</span>` : '';
      cells += `<div${onclick} title="${d}" style="${squareStyle(st, s)}margin-right:${s.gap}px;display:flex;align-items:center;justify-content:center;">${check}</div>`;
    });
    return `<div style="display:flex;align-items:center;margin-top:${s.gap}px;">
      <div style="position:sticky;left:0;z-index:2;background:${labelBg};width:${LABEL_W}px;flex:0 0 ${LABEL_W}px;padding:6px 8px 6px 2px;border-right:1px solid ${C.line};">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="font-size:14px;line-height:1;">${habit.emoji || '✅'}</span>
          <span style="font-size:12px;font-weight:800;color:${nameColor};line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:${LABEL_W - 34}px;">${habit.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          ${risk ? `<span style="font-size:9px;font-weight:900;color:${C.amber};">⚠ AT RISK</span>` : streakChip}
        </div>
      </div>
      <div style="display:flex;align-items:center;">${cells}</div>
    </div>`;
  }).join('');

  const totalW = LABEL_W + days.length * col + 8;
  return `<div id="habit-grid-scroll" style="overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:6px 0 4px;max-width:100%;">
    <div style="min-width:${totalW}px;">${header}${rows}</div>
  </div>`;
}

// ── Alert banner (his #1 priority) ──────────────────────────────────────────
function buildAlert(H, tStr) {
  const risky = H.items.filter(h => atRisk(H, h, tStr));
  if (!risky.length) return '';
  const names = risky.map(h => `${h.emoji || '✅'} ${h.name}`).join(', ');
  return `<div style="background:${C.amberBg};border:1.5px solid ${C.amberEdge};border-radius:14px;padding:14px 16px;margin-bottom:16px;">
    <div style="font-size:11px;font-weight:900;letter-spacing:1.5px;color:#B9770E;text-transform:uppercase;margin-bottom:4px;">⚠ Act today — chain about to break</div>
    <div style="font-size:13px;font-weight:700;color:${C.ink};line-height:1.5;">You missed <b>${names}</b> yesterday. Do ${risky.length > 1 ? 'them' : 'it'} today so you never miss two days running.</div>
  </div>`;
}

// ── Metrics ─────────────────────────────────────────────────────────────────
function buildMetrics(H, tStr) {
  if (!H.items.length) return '';
  const { start, end } = rangeFor(H.view, H.items, tStr);
  const viewLabel = (VIEWS.find(v => v[0] === H.view) || ['', ''])[1];

  // average daily completion across settled days in range
  const dayKeys = daysBetween(start, ymd(addDays(parseYmd(tStr), -1))).filter(d => d >= start && d <= end);
  let pctSum = 0, pctDays = 0;
  const weekdayMiss = [0, 0, 0, 0, 0, 0, 0], weekdayElig = [0, 0, 0, 0, 0, 0, 0];
  dayKeys.forEach(d => {
    const active = H.items.filter(h => d >= h.createdAt);
    if (!active.length) return;
    const done = active.filter(h => isDone(H, h.id, d)).length;
    pctSum += done / active.length; pctDays++;
    const wd = parseYmd(d).getDay();
    active.forEach(h => { weekdayElig[wd]++; if (!isDone(H, h.id, d)) weekdayMiss[wd]++; });
  });
  const avgPct = pctDays ? Math.round((pctSum / pctDays) * 100) : null;

  const totalSlips = H.items.reduce((a, h) => a + slipRuns(H, h, start, end, tStr), 0);
  const riskCount = H.items.filter(h => atRisk(H, h, tStr)).length;

  // most-missed weekday
  let worstWd = null, worstRate = -1;
  for (let i = 0; i < 7; i++) {
    if (weekdayElig[i] >= 2) {
      const r = weekdayMiss[i] / weekdayElig[i];
      if (r > worstRate) { worstRate = r; worstWd = i; }
    }
  }

  const stat = (val, label, color) => `
    <div style="flex:1 1 0;min-width:96px;background:${C.panel};border:1px solid ${C.line};border-radius:12px;padding:12px 10px;text-align:center;">
      <div style="font-size:24px;font-weight:900;color:${color};line-height:1;">${val}</div>
      <div style="font-size:9px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:${C.muted};margin-top:5px;line-height:1.2;">${label}</div>
    </div>`;

  const cards = `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
    ${stat(avgPct === null ? '—' : avgPct + '%', 'Avg daily completion', avgPct === null ? C.faint : (avgPct >= 80 ? C.done : avgPct >= 50 ? C.amber : C.miss))}
    ${stat(totalSlips, 'Times missed 2+ in a row', totalSlips === 0 ? C.done : C.miss)}
    ${stat(riskCount, 'At risk right now', riskCount === 0 ? C.done : C.amber)}
    ${stat(worstWd === null ? '—' : WD[worstWd], 'Weakest weekday', worstWd === null ? C.faint : C.ink)}
  </div>`;

  // per-habit breakdown
  const rows = H.items.map(h => {
    const cs = currentStreak(H, h, tStr);
    const ls = longestStreak(H, h, tStr);
    const pc = completionPct(H, h, start, end, tStr);
    const sl = slipRuns(H, h, start, end, tStr);
    const risk = atRisk(H, h, tStr);
    const pcColor = pc === null ? C.faint : (pc >= 80 ? C.done : pc >= 50 ? C.amber : C.miss);
    return `<tr style="border-top:1px solid ${C.line};">
      <td style="padding:9px 8px;font-size:12px;font-weight:800;color:${risk ? '#B9770E' : C.ink};">${h.emoji || '✅'} ${h.name}${risk ? ' <span style="color:' + C.amber + ';font-size:10px;">⚠</span>' : ''}</td>
      <td style="padding:9px 6px;text-align:center;font-size:12px;font-weight:900;color:${cs > 0 ? C.done : C.faint};">${cs}</td>
      <td style="padding:9px 6px;text-align:center;font-size:12px;font-weight:700;color:${C.muted};">${ls}</td>
      <td style="padding:9px 6px;text-align:center;font-size:12px;font-weight:900;color:${pcColor};">${pc === null ? '—' : pc + '%'}</td>
      <td style="padding:9px 6px;text-align:center;font-size:12px;font-weight:800;color:${sl > 0 ? C.miss : C.faint};">${sl}</td>
    </tr>`;
  }).join('');

  const table = `<div style="overflow-x:auto;max-width:100%;">
    <table style="width:100%;border-collapse:collapse;min-width:340px;">
      <thead><tr>
        <th style="text-align:left;padding:0 8px 6px;font-size:9px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">Habit</th>
        <th style="text-align:center;padding:0 6px 6px;font-size:9px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">Streak</th>
        <th style="text-align:center;padding:0 6px 6px;font-size:9px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">Best</th>
        <th style="text-align:center;padding:0 6px 6px;font-size:9px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">Done</th>
        <th style="text-align:center;padding:0 6px 6px;font-size:9px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;color:${C.muted};">Slips</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  return `<div style="background:${C.card};border:1px solid ${C.lineStrong};border-radius:16px;padding:16px;margin-top:16px;">
    <div style="font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:${C.navy};margin-bottom:12px;">Insights · ${viewLabel}</div>
    ${cards}
    ${table}
    <div style="font-size:10px;color:${C.faint};font-weight:600;margin-top:10px;line-height:1.5;">"Done" and "Slips" cover settled days only (today isn't counted until the day is over). A slip = a run of 2+ missed days.</div>
  </div>`;
}

// ── Add / edit UI ───────────────────────────────────────────────────────────
function buildAddBar(state) {
  const editing = state.habitEditing;
  if (editing) {
    const H = getHabits(state);
    const h = H.items.find(x => x.id === editing);
    if (h) {
      return `<div style="background:${C.card};border:1.5px solid ${C.gold};border-radius:14px;padding:12px;margin-bottom:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input id="habit-edit-emoji" value="${h.emoji || ''}" maxlength="2" placeholder="🙂" style="width:46px;flex:0 0 auto;box-sizing:border-box;text-align:center;padding:11px 4px;border:1px solid ${C.lineStrong};border-radius:10px;font-size:16px;background:${C.panel};color:${C.ink};" />
        <input id="habit-edit-name" value="${h.name.replace(/"/g, '&quot;')}" style="flex:1 1 120px;min-width:0;box-sizing:border-box;padding:11px 12px;border:1px solid ${C.lineStrong};border-radius:10px;font-size:14px;background:${C.panel};color:${C.ink};" />
        <button onclick="habitEditSave('${h.id}')" style="padding:11px 16px;background:${C.gold};border:none;border-radius:10px;color:#1A1204;font-size:13px;font-weight:900;cursor:pointer;">Save</button>
        <button onclick="habitEditCancel()" style="padding:11px 14px;background:${C.panel};border:1px solid ${C.lineStrong};border-radius:10px;color:${C.muted};font-size:13px;font-weight:800;cursor:pointer;">Cancel</button>
      </div>`;
    }
  }
  return `<div style="background:${C.card};border:1px solid ${C.lineStrong};border-radius:14px;padding:12px;margin-bottom:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
    <input id="habit-new-emoji" maxlength="2" placeholder="🙂" style="width:46px;flex:0 0 auto;box-sizing:border-box;text-align:center;padding:11px 4px;border:1px solid ${C.lineStrong};border-radius:10px;font-size:16px;background:${C.panel};color:${C.ink};" />
    <input id="habit-new-name" placeholder="New habit (e.g. Reading, Cold shower)" onkeydown="if(event.key==='Enter')habitAdd()" style="flex:1 1 120px;min-width:0;box-sizing:border-box;padding:11px 12px;border:1px solid ${C.lineStrong};border-radius:10px;font-size:14px;background:${C.panel};color:${C.ink};" />
    <button onclick="habitAdd()" style="padding:11px 18px;background:${C.navy};border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:900;cursor:pointer;">+ Add</button>
  </div>`;
}

// ── Manage list (edit / delete) ─────────────────────────────────────────────
function buildManage(state, H) {
  if (!H.items.length) return '';
  const del = state.habitDeleteConfirm;
  const rows = H.items.map(h => {
    if (del === h.id) {
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid ${C.missSoft};border-radius:10px;background:#FDECEA;margin-top:6px;">
        <span style="flex:1;font-size:12px;font-weight:800;color:${C.ink};">Delete "${h.name}" and all its history?</span>
        <button onclick="habitDeleteConfirm('${h.id}')" style="padding:7px 12px;background:${C.miss};border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:900;cursor:pointer;">Delete</button>
        <button onclick="habitDeleteCancel()" style="padding:7px 12px;background:${C.panel};border:1px solid ${C.lineStrong};border-radius:8px;color:${C.muted};font-size:12px;font-weight:800;cursor:pointer;">Keep</button>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid ${C.line};border-radius:10px;background:${C.panel};margin-top:6px;">
      <span style="font-size:15px;">${h.emoji || '✅'}</span>
      <span style="flex:1;font-size:12px;font-weight:800;color:${C.ink};">${h.name}</span>
      <button onclick="habitEditStart('${h.id}')" style="padding:6px 10px;background:${C.card};border:1px solid ${C.lineStrong};border-radius:8px;color:${C.navy};font-size:12px;font-weight:800;cursor:pointer;">Edit</button>
      <button onclick="habitDeleteAsk('${h.id}')" style="padding:6px 10px;background:${C.card};border:1px solid ${C.missSoft};border-radius:8px;color:${C.miss};font-size:12px;font-weight:800;cursor:pointer;">Delete</button>
    </div>`;
  }).join('');
  const openState = state.habitManageOpen ? 'block' : 'none';
  return `<div style="margin-top:16px;">
    <button onclick="habitToggleManage()" style="width:100%;padding:11px;background:${C.card};border:1px solid ${C.lineStrong};border-radius:12px;color:${C.muted};font-size:12px;font-weight:800;cursor:pointer;">${state.habitManageOpen ? 'Hide' : 'Manage'} habits (edit / delete)</button>
    <div style="display:${openState};">${rows}</div>
  </div>`;
}

// ── View switcher ───────────────────────────────────────────────────────────
function buildSwitcher(H) {
  const btns = VIEWS.map(([v, label]) => {
    const active = H.view === v;
    const txt = active ? '#ffffff' : C.muted;
    return `<button onclick="habitSetView('${v}')" style="padding:8px 12px;border-radius:9px;border:1px solid ${active ? C.navy : C.lineStrong};background:${active ? C.navy : C.card} !important;color:${txt} !important;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;flex:0 0 auto;">${label}</button>`;
  }).join('');
  return `<div style="display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;margin-bottom:14px;max-width:100%;">${btns}</div>`;
}

// ── Full body (rebuildable) ─────────────────────────────────────────────────
function buildBody(state) {
  const H = getHabits(state);
  const tStr = todayStr();
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <button onclick="setTab('journal')" style="padding:9px 14px;background:${C.card};border:1px solid ${C.lineStrong};border-radius:10px;color:${C.navy};font-size:13px;font-weight:800;cursor:pointer;">← Journal</button>
      <div>
        <div style="font-size:20px;font-weight:900;color:${C.ink};letter-spacing:0.3px;line-height:1;">Habit Tracker</div>
        <div style="font-size:11px;font-weight:700;color:${C.muted};margin-top:3px;">Never miss two days in a row.</div>
      </div>
    </div>
    ${buildAlert(H, tStr)}
    ${buildAddBar(state)}
    ${buildSwitcher(H)}
    <div style="background:${C.card};border:1px solid ${C.lineStrong};border-radius:16px;padding:12px 12px 10px;">
      ${buildGrid(H, tStr)}
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid ${C.line};">
        ${legend(C.done, 'Done')}
        ${legend(C.miss, 'Missed')}
        ${legendDashed(C.openEdge, 'Today — tap to tick')}
        ${legend(C.grey, 'Before habit / upcoming')}
      </div>
      <div style="font-size:10px;color:${C.faint};font-weight:600;margin-top:8px;">Tap any square — including past days — to correct a day.</div>
    </div>
    ${buildMetrics(H, tStr)}
    ${buildManage(state, H)}
    <div style="height:20px;"></div>
  `;
}
function legend(color, label) {
  return `<div style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:4px;background:${color};border:1px solid ${color};"></span><span style="font-size:11px;font-weight:700;color:${C.muted};">${label}</span></div>`;
}
function legendDashed(edge, label) {
  return `<div style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;border-radius:4px;background:#fff;border:1.5px dashed ${edge};"></span><span style="font-size:11px;font-weight:700;color:${C.muted};">${label}</span></div>`;
}

// ── Public: render ──────────────────────────────────────────────────────────
export function renderHabitsTab({ state }) {
  return `<div id="habit-root" style="width:100%;max-width:760px;margin:0 auto;box-sizing:border-box;min-width:0;overflow-x:hidden;">${buildBody(state)}</div>`;
}

// ── Public: init (wires window handlers, runs after each render) ────────────
export function initHabitsTab({ state, saveData, saveDataQuiet, render }) {
  function ensure() {
    if (!state.data.habits) state.data.habits = { items: [], log: {}, view: '3' };
    if (!state.data.habits.items) state.data.habits.items = [];
    if (!state.data.habits.log) state.data.habits.log = {};
    if (!state.data.habits.view) state.data.habits.view = '3';
    return state.data.habits;
  }

  function refresh() {
    const root = document.getElementById('habit-root');
    if (!root) return;
    // preserve in-progress input + scroll positions across the rebuild
    const nn = document.getElementById('habit-new-name');
    const ne = document.getElementById('habit-new-emoji');
    const en = document.getElementById('habit-edit-name');
    const ee = document.getElementById('habit-edit-emoji');
    const keep = { nn: nn ? nn.value : null, ne: ne ? ne.value : null, en: en ? en.value : null, ee: ee ? ee.value : null };
    const grid = document.getElementById('habit-grid-scroll');
    const keepLeft = grid ? grid.scrollLeft : null;
    const pageY = window.scrollY;

    root.innerHTML = buildBody(state);

    const nn2 = document.getElementById('habit-new-name'); if (nn2 && keep.nn != null) nn2.value = keep.nn;
    const ne2 = document.getElementById('habit-new-emoji'); if (ne2 && keep.ne != null) ne2.value = keep.ne;
    const en2 = document.getElementById('habit-edit-name'); if (en2 && keep.en != null) en2.value = keep.en;
    const ee2 = document.getElementById('habit-edit-emoji'); if (ee2 && keep.ee != null) ee2.value = keep.ee;
    const grid2 = document.getElementById('habit-grid-scroll');
    if (grid2) grid2.scrollLeft = (keepLeft != null ? keepLeft : grid2.scrollWidth);
    window.scrollTo(0, pageY);
  }

  window.habitToggle = (habitId, dStr) => {
    const H = ensure();
    if (!H.log[dStr]) H.log[dStr] = {};
    if (H.log[dStr][habitId]) { delete H.log[dStr][habitId]; if (!Object.keys(H.log[dStr]).length) delete H.log[dStr]; }
    else H.log[dStr][habitId] = true;
    saveDataQuiet();
    refresh();
  };

  window.habitSetView = (v) => { const H = ensure(); H.view = v; saveDataQuiet(); refresh(); };

  window.habitAdd = () => {
    const nameEl = document.getElementById('habit-new-name');
    const emojiEl = document.getElementById('habit-new-emoji');
    const name = (nameEl && nameEl.value || '').trim();
    if (!name) { if (nameEl) nameEl.focus(); return; }
    const emoji = (emojiEl && emojiEl.value || '').trim().slice(0, 2);
    const H = ensure();
    H.items.push({ id: 'h_' + Date.now().toString(36), name, emoji: emoji || '✅', createdAt: todayStr() });
    saveDataQuiet();
    refresh();
  };

  window.habitEditStart = (id) => { state.habitEditing = id; state.habitManageOpen = true; refresh(); };
  window.habitEditCancel = () => { state.habitEditing = null; refresh(); };
  window.habitEditSave = (id) => {
    const nameEl = document.getElementById('habit-edit-name');
    const emojiEl = document.getElementById('habit-edit-emoji');
    const name = (nameEl && nameEl.value || '').trim();
    const emoji = (emojiEl && emojiEl.value || '').trim().slice(0, 2);
    const H = ensure();
    const h = H.items.find(x => x.id === id);
    if (h && name) { h.name = name; h.emoji = emoji || '✅'; }
    state.habitEditing = null;
    saveDataQuiet();
    refresh();
  };

  window.habitToggleManage = () => { state.habitManageOpen = !state.habitManageOpen; state.habitEditing = null; refresh(); };
  window.habitDeleteAsk = (id) => { state.habitDeleteConfirm = id; refresh(); };
  window.habitDeleteCancel = () => { state.habitDeleteConfirm = null; refresh(); };
  window.habitDeleteConfirm = (id) => {
    const H = ensure();
    H.items = H.items.filter(x => x.id !== id);
    Object.keys(H.log).forEach(d => { if (H.log[d][id]) { delete H.log[d][id]; if (!Object.keys(H.log[d]).length) delete H.log[d]; } });
    state.habitDeleteConfirm = null;
    saveDataQuiet();
    refresh();
  };

  // initial: scroll the grid to today (far right)
  const grid = document.getElementById('habit-grid-scroll');
  if (grid) grid.scrollLeft = grid.scrollWidth;
}
