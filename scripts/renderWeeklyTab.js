// renderWeeklyTab.js — 📅 Weekly Planner Tab

const WK_COLORS = [
  { id:'gold',   hex:'#C9A84C' },
  { id:'green',  hex:'#4caf7d' },
  { id:'blue',   hex:'#5b8dd9' },
  { id:'red',    hex:'#d95b5b' },
  { id:'purple', hex:'#9b59b6' },
  { id:'orange', hex:'#e07b39' },
  { id:'teal',   hex:'#1abc9c' },
  { id:'gray',   hex:'#aaa89f' },
];

function wkGetISOWeek(d) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay() || 7));
  const y = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return Math.ceil((((u - y) / 86400000) + 1) / 7);
}
function wkGetMonday(offset) {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - (d.getDay()===0 ? 6 : d.getDay()-1) + (offset||0)*7);
  return d;
}
function wkGetKey(offset) {
  const m = wkGetMonday(offset);
  return m.getFullYear()+'-W'+String(wkGetISOWeek(m)).padStart(2,'0');
}
function wkLoadAll() { try { return JSON.parse(localStorage.getItem('weekly_state')||'{}'); } catch { return {}; } }
function wkSaveAll(all) { localStorage.setItem('weekly_state', JSON.stringify(all)); }
function wkGetWS(offset) {
  const a=wkLoadAll(), k=wkGetKey(offset);
  if (!a[k]) a[k]={objectives:[],days:[{},{},{},{},{},{},{}]};
  while (a[k].days.length<7) a[k].days.push({});
  return a[k];
}
function wkSaveWS(ws, offset) { const a=wkLoadAll(); a[wkGetKey(offset)]=ws; wkSaveAll(a); }

function wkApplyCarryOver(offset) {
  const a=wkLoadAll(), thisKey=wkGetKey(offset), prevKey=wkGetKey(offset-1);
  const prevWS=a[prevKey]; if (!prevWS) return;
  const unfinished=(prevWS.objectives||[]).filter(o=>!o.done);
  if (!unfinished.length) return;
  if (!a[thisKey]) a[thisKey]={objectives:[],days:[{},{},{},{},{},{},{}]};
  if ((a[thisKey].objectives||[]).some(o=>o._carriedOver)) return;
  const carried=unfinished.map(o=>({...o,done:false,_carriedOver:true}));
  a[thisKey].objectives=[...carried,...(a[thisKey].objectives||[])];
  wkSaveAll(a);
}

function wkSwatchesHtml(selected, onclick) {
  return WK_COLORS.map(c =>
    `<div class="wk-swatch${c.id===selected?' selected':''}" style="background:${c.hex}"
      data-color="${c.id}" onclick="${onclick}('${c.id}',this)"></div>`
  ).join('');
}

// Safe HTML escape
function wkEsc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

export function renderWeeklyTab() {
  if (window._weeklyOffset===undefined) window._weeklyOffset=0;
  if (!window._weeklyObjColor)  window._weeklyObjColor='gold';
  if (!window._weeklyDayColors) window._weeklyDayColors={};

  const offset=window._weeklyOffset;
  if (offset===0) wkApplyCarryOver(0);

  const mon    = wkGetMonday(offset);
  const sun    = new Date(mon); sun.setDate(sun.getDate()+6);
  const today  = new Date(); today.setHours(0,0,0,0);
  const wkNum  = wkGetISOWeek(mon);
  const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const monStr = mon.toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase();
  const sunStr = sun.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}).toUpperCase();

  const ws   = wkGetWS(offset);
  const objs = ws.objectives||[];
  const done = objs.filter(o=>o.done).length;
  const pct  = objs.length ? Math.round(done/objs.length*100) : 0;

  // Task completion across all 7 days
  const allTasks   = ws.days.reduce((acc,d)=>acc.concat(d.tasks||[]),[]);
  const tasksDone  = allTasks.filter(t=>t.done).length;
  const tasksTotal = allTasks.length;
  const taskPct    = tasksTotal ? Math.round(tasksDone/tasksTotal*100) : 0;

  // Wins (unplanned achievements)
  const wins = ws.wins||[];

  // Archive
  const archive     = ws.archive||{tasks:[],objectives:[]};
  const archTasks   = archive.tasks||[];
  const archObjs    = archive.objectives||[];

  // Sunday & current-week flags
  const isSunday      = today.getDay() === 0;
  const isCurrentWeek = offset === 0;

  // Today's index in our Mon-based DAYS array (Mon=0 … Sun=6)
  const todayDayIdx = isCurrentWeek
    ? (today.getDay()===0 ? 6 : today.getDay()-1)
    : -1;

  // ── Objectives HTML ─────────────────────────────────────────────────────────
  const objsHtml = objs.length===0
    ? `<div class="wk-empty">No objectives yet — tap "+ Add" to get started</div>`
    : objs.map((obj,i) => {
        const c       = WK_COLORS.find(c=>c.id===obj.color)||WK_COLORS[0];
        const outcome = obj._review?.outcome;
        // Flash if it's Sunday on current week and not yet reviewed
        const flash   = isSunday && isCurrentWeek && !obj._reviewed;

        let rowCls  = 'wk-obj-row';
        if (flash)                                    rowCls += ' wk-sunday-flash';
        if (outcome==='failed')                        rowCls += ' wk-obj-failed';
        else if (outcome==='completed' || obj.done)   rowCls += ' wk-obj-completed-bright';

        const barColor  = outcome==='failed'                       ? '#d95b5b'
                        : (outcome==='completed' || obj.done)      ? '#4caf7d'
                        : c.hex;
        const nameColor = outcome==='failed'                       ? 'color:#d95b5b;'
                        : (outcome==='completed' || obj.done)      ? 'color:#4caf7d;'
                        : '';
        const chkStyle  = outcome==='failed'                       ? 'background:#d95b5b;border-color:#d95b5b;'
                        : (outcome==='completed' || obj.done)      ? 'background:#4caf7d;border-color:#4caf7d;'
                        : '';

        const isChecked = obj.done || outcome==='completed';

        return `
        <div class="${rowCls}" id="wkObjRow${i}">
          <div class="wk-obj-bar" style="background:${barColor}"></div>
          <div class="wk-obj-chk${isChecked?' checked':''}" style="${chkStyle}" onclick="weeklyToggleObj(${i})"></div>
          <div class="wk-obj-body">
            <div class="wk-obj-name" style="${nameColor}">${wkEsc(obj.name)}</div>
            <div class="wk-obj-meta">
              ${obj.tag ? `<span class="wk-obj-tag" style="background:${c.hex}18;color:${c.hex}">${wkEsc(obj.tag)}</span>` : ''}
              ${obj._carriedOver ? `<span class="wk-carried">↩ carried over</span>` : ''}
              ${obj._reviewed    ? `<span class="wk-badge wk-badge-reviewed" onclick="weeklyOpenReview(${i})" style="cursor:pointer;">✓ reviewed</span>` : ''}
              ${outcome==='failed'     ? `<span class="wk-badge wk-badge-failed">✗ Failed</span>` : ''}
              ${outcome==='completed'  ? `<span class="wk-badge wk-badge-completed">✓ Completed</span>` : ''}
              ${outcome==='duplicated' ? `<span class="wk-badge wk-badge-duplicated">↗ Next week</span>` : ''}
            </div>
          </div>
          <div class="wk-obj-actions">
            ${isCurrentWeek && !obj._reviewed
              ? `<div class="wk-obj-review-btn" onclick="weeklyOpenReview(${i})">Review</div>`
              : ''}
            <div class="wk-obj-edit" onclick="weeklyStartEditObj(${i})">✎</div>
            <div class="wk-obj-del"  onclick="weeklyDeleteObj(${i})">✕</div>
          </div>
        </div>`;
      }).join('');

  // ── Day block builder ────────────────────────────────────────────────────────
  const renderDayBlock = (i, isPast=false) => {
    const dayData = ws.days[i];
    const date    = new Date(mon); date.setDate(date.getDate()+i);
    const isToday = date.getTime()===today.getTime();
    const dateStr = date.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
    const tasks   = dayData.tasks||[];
    const focus   = dayData.focus||'';
    const doneCt  = tasks.filter(t=>t.done).length;

    const renderTaskItem = (task, ti) => {
      const tc=WK_COLORS.find(c=>c.id===task.color)||WK_COLORS[7];
      return `
      <div class="wk-task-item${task.done?' done':''}"
        data-day="${i}" data-task="${ti}"
        ontouchstart="wkTouchStart(event,${i},${ti})"
        ondragstart="weeklyDragStart(event,${i},${ti})"
        ondragend="weeklyDragEnd(event)"
        draggable="true">
        <span class="wk-task-handle">⠿</span>
        <div class="wk-task-dot" style="background:${tc.hex}"></div>
        <div class="wk-task-chk${task.done?' checked':''}" onclick="weeklyToggleTask(${i},${ti})"></div>
        <span class="wk-task-name">${wkEsc(task.name)}</span>
        <span class="wk-task-edit" onclick="weeklyStartEditTask(${i},${ti})">✎</span>
        <span class="wk-task-del"  onclick="weeklyDeleteTask(${i},${ti})">✕</span>
      </div>`;
    };

    const amTasks = tasks.map((t,ti)=>({t,ti})).filter(({t})=>(t.period||'am')==='am');
    const pmTasks = tasks.map((t,ti)=>({t,ti})).filter(({t})=>t.period==='pm');
    const amHtml  = amTasks.map(({t,ti})=>renderTaskItem(t,ti)).join('');
    const pmHtml  = pmTasks.map(({t,ti})=>renderTaskItem(t,ti)).join('');

    const swHtml = WK_COLORS.map(c=>
      `<div class="wk-swatch" style="background:${c.hex}" data-color="${c.id}"
        onclick="weeklyPickDayColor(${i},'${c.id}',this)"></div>`
    ).join('');

    return `
    <div class="wk-day-block${isToday?' today':''}${isPast?' wk-collapsed':''}" id="wkDay${i}">
      <div class="wk-day-header${isPast?' wk-past-header':''}"${isPast?` onclick="weeklyTogglePastDay(${i})"`:''}> 
        <span class="wk-day-name">${DAYS[i]}</span>
        <span class="wk-day-date">${dateStr}</span>
        ${!isPast ? `<span class="wk-focus-badge" onclick="weeklyToggleFocus(event,${i})">${wkEsc(focus)||'+ Focus'}</span>` : ''}
        <span class="wk-task-count">${tasks.length>0 ? doneCt+'/'+tasks.length : ''}</span>
        ${!isPast ? `<span class="wk-day-add-btn" onclick="weeklyToggleDayForm(${i})">+ Task</span>` : ''}
        ${isPast ? `<span class="wk-collapse-chevron" id="wkChevron${i}">›</span>` : ''}
        ${!isPast ? `<div class="wk-focus-popup" id="wkFocusPop${i}">
          <input type="text" id="wkFocusInp${i}" value="${wkEsc(focus)}" placeholder="Focus area..."
            onkeydown="if(event.key==='Enter')weeklySaveFocus(${i});if(event.key==='Escape')weeklyCloseFocus(${i})" />
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="wk-btn-sm wk-btn-cancel" onclick="weeklyCloseFocus(${i})">Cancel</button>
            <button class="wk-btn-sm wk-btn-save"   onclick="weeklySaveFocus(${i})">Save</button>
          </div>
        </div>` : ''}
      </div>
      <div class="wk-day-body" id="wkBody${i}">

        <!-- AM drop zone -->
        <div class="wk-period-zone" id="wkZoneAM${i}" data-day="${i}" data-period="am"
          ondragover="event.preventDefault();weeklyZoneDragOver(event,${i},'am')"
          ondragleave="weeklyZoneDragLeave(${i},'am')"
          ondrop="weeklyZoneDrop(event,${i},'am')">
          <div class="wk-period-divider"><span class="wk-period-header">AM</span></div>
          ${amTasks.length===0 ? '<div class="wk-day-empty">Nothing yet</div>' : ''}
          ${amHtml}
        </div>

        <!-- PM drop zone -->
        <div class="wk-period-divider"><span class="wk-period-header pm">PM</span></div>
        <div class="wk-period-zone" id="wkZonePM${i}" data-day="${i}" data-period="pm"
          ondragover="event.preventDefault();weeklyZoneDragOver(event,${i},'pm')"
          ondragleave="weeklyZoneDragLeave(${i},'pm')"
          ondrop="weeklyZoneDrop(event,${i},'pm')">
          ${pmTasks.length===0 ? '<div class="wk-day-empty">Nothing yet</div>' : ''}
          ${pmHtml}
        </div>

        <!-- Add form -->
        <div class="wk-day-form" id="wkDayForm${i}">
          <input class="wk-day-form-inp" type="text" id="wkDayInp${i}" placeholder="New task..."
            onkeydown="if(event.key==='Enter')weeklyAddTask(${i});if(event.key==='Escape')weeklyToggleDayForm(${i})" />
          <div class="wk-day-form-row" style="margin-bottom:8px;">
            <button class="wk-period-toggle active" id="wkPeriodAM${i}" onclick="weeklySetPeriod(${i},'am',this)">AM</button>
            <button class="wk-period-toggle"        id="wkPeriodPM${i}" onclick="weeklySetPeriod(${i},'pm',this)">PM</button>
            <div style="flex:1;"></div>
            <div class="wk-swatches" id="wkDaySw${i}">${swHtml}</div>
          </div>
          <div class="wk-day-form-row">
            <button class="wk-btn-sm wk-btn-cancel" onclick="weeklyToggleDayForm(${i})">Cancel</button>
            <button class="wk-btn-sm wk-btn-save"   onclick="weeklyAddTask(${i})">Add</button>
          </div>
        </div>

      </div>
    </div>`;
  };

  // ── Ordered day blocks: today first, past days pushed below ─────────────────
  let topDaysHtml = '';
  let pastDaysSectionHtml = '';

  if (isCurrentWeek && todayDayIdx > 0) {
    // Today + future
    for (let i = todayDayIdx; i < 7; i++) topDaysHtml += renderDayBlock(i);
    // Past days section
    let pastInner = '';
    for (let i = 0; i < todayDayIdx; i++) pastInner += renderDayBlock(i, true);
    pastDaysSectionHtml = `
      <div class="wk-past-label">↑ Past Days</div>
      <div class="wk-day-grid wk-past-grid">${pastInner}</div>`;
  } else {
    for (let i = 0; i < 7; i++) topDaysHtml += renderDayBlock(i);
  }

  // ── Uncompleted tasks section (current week — tasks flash red on Sundays) ──────
  let uncompletedHtml = '';
  if (isCurrentWeek) {
    const incomplete = [];
    ws.days.forEach((dayData, di) => {
      (dayData.tasks||[]).forEach((task, ti) => {
        if (!task.done) incomplete.push({ di, ti, task });
      });
    });

    if (incomplete.length > 0) {
      const incRows = incomplete.map(({ di, ti, task }) => {
        const tc = WK_COLORS.find(c=>c.id===task.color)||WK_COLORS[7];
        return `
        <div class="wk-inc-row" id="wkInc_${di}_${ti}">
          <div class="wk-task-dot" style="background:${tc.hex};flex-shrink:0;"></div>
          <div class="wk-inc-info">
            <span class="wk-inc-name">${wkEsc(task.name)}</span>
            <span class="wk-inc-day">${DAYS[di]}</span>
          </div>
          <div class="wk-inc-actions">
            <button class="wk-btn-sm wk-btn-cancel wk-inc-btn" onclick="weeklyMarkIncompleteTaskDone(${di},${ti})" title="Mark done">✓</button>
            <button class="wk-btn-sm wk-btn-save   wk-inc-btn" onclick="weeklyDuplicateTaskNextWeek(${di},${ti})">→ Mon</button>
            <button class="wk-btn-sm wk-btn-cancel wk-inc-btn wk-inc-del" onclick="weeklyDeleteIncompleteTask(${di},${ti})" title="Delete">✕</button>
          </div>
        </div>`;
      }).join('');

      uncompletedHtml = `
      <div class="wk-divider"></div>
      <div class="wk-sec" style="margin-bottom:12px;">
        <span class="wk-sec-label" style="color:#d95b5b;">⚠ Uncompleted Tasks</span>
        <button class="wk-sec-btn wk-btn-blue" onclick="weeklyDuplicateAllTasksNextWeek()">Dup All → Mon</button>
      </div>
      <div class="wk-inc-list" id="wkIncList">${incRows}</div>`;
    }
  }

  // ── Objective add-form swatches ──────────────────────────────────────────────
  const objSwatches = WK_COLORS.map(c=>
    `<div class="wk-swatch lg${c.id===(window._weeklyObjColor||'gold')?' selected':''}"
      style="background:${c.hex}" data-color="${c.id}"
      onclick="weeklyPickObjColor('${c.id}',this)"></div>`
  ).join('');

  // ── Full render ──────────────────────────────────────────────────────────────
  return `
<style>
  /* ── Reset / root ── */
  #wk-root *{box-sizing:border-box;margin:0;padding:0;}
  #wk-root{padding:0 0 40px;}

  /* ── Typography helpers ── */
  #wk-root .wk-eyebrow{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;}
  #wk-root .wk-title{font-family:'Bebas Neue','Impact',sans-serif;font-size:34px;color:#1a1917;letter-spacing:.06em;line-height:1;margin-bottom:4px;}

  /* ── Nav row ── */
  #wk-root .wk-nav-row{display:flex;flex-direction:column;margin-bottom:18px;}
  #wk-root .wk-week-nav{display:flex;gap:8px;margin-top:10px;}

  /* ── Prev / Next buttons — bigger & bolder ── */
  #wk-root .wk-nav-btn{
    flex:1;
    font-family:'DM Mono',monospace;
    font-size:11px;
    font-weight:700;
    color:#1a1917;
    border:2px solid #1a1917;
    background:#fff;
    padding:9px 16px;
    border-radius:8px;
    cursor:pointer;
    text-transform:uppercase;
    letter-spacing:.08em;
    -webkit-tap-highlight-color:transparent;
    min-height:40px;
  }
  #wk-root .wk-nav-btn:active{background:#1a1917;color:#fff;}

  /* ── Progress bar ── */
  #wk-root .wk-stats-row{display:flex;align-items:stretch;gap:0;margin-bottom:18px;background:#fff;border:1px solid #e5e3dc;border-radius:10px;overflow:hidden;}
  #wk-root .wk-stat-block{flex:1;padding:10px 12px;}
  #wk-root .wk-stat-divider{width:1px;background:#e5e3dc;flex-shrink:0;}
  #wk-root .wk-stat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
  #wk-root .wk-stat-label{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;}
  #wk-root .wk-stat-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:#1a1917;}
  #wk-root .wk-prog-track{width:100%;height:4px;background:#e5e3dc;border-radius:3px;overflow:hidden;margin-bottom:5px;}
  #wk-root .wk-prog-fill{height:100%;border-radius:3px;}
  #wk-root .wk-stat-pct{font-family:'Bebas Neue','Impact',sans-serif;font-size:18px;line-height:1;letter-spacing:.04em;}

  /* ── Things I Got Done ── */
  #wk-root .wk-win-list{display:flex;flex-direction:column;gap:4px;margin-bottom:4px;}
  #wk-root .wk-win-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:#fff;border:1px solid #e5e3dc;}
  #wk-root .wk-win-dot{font-size:13px;color:#C9A84C;flex-shrink:0;}
  #wk-root .wk-win-text{flex:1;font-size:14px;font-weight:500;color:#1a1917;min-width:0;}
  #wk-root .wk-win-del{font-size:14px;color:#d8d5cc;cursor:pointer;padding:4px 5px;min-width:28px;min-height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-win-del:active{color:#c0392b;background:#fdf0ef;}

  /* ── Section header ── */
  #wk-root .wk-sec{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #e5e3dc;margin-bottom:10px;}
  #wk-root .wk-sec-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#6b6860;text-transform:uppercase;letter-spacing:.12em;}
  #wk-root .wk-sec-btn{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#fff;border:none;background:#C9A84C;padding:9px 18px;border-radius:7px;cursor:pointer;text-transform:uppercase;-webkit-tap-highlight-color:transparent;min-height:40px;}
  #wk-root .wk-sec-btn:active{opacity:.8;}
  #wk-root .wk-btn-blue{background:#5b8dd9 !important;font-size:10px !important;padding:8px 14px !important;}

  /* ── Sunday flash animation ── */
  @keyframes wk-flash-red {
    0%,100% { border-color:#e5e3dc; box-shadow:none; }
    50%      { border-color:#d95b5b; box-shadow:0 0 0 3px rgba(217,91,91,.18); }
  }
  #wk-root .wk-sunday-flash { animation:wk-flash-red 1.8s ease-in-out infinite; }

  /* ── Objective rows ── */
  #wk-root .wk-obj-list{display:flex;flex-direction:column;gap:4px;margin-bottom:22px;}
  #wk-root .wk-obj-row{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border-radius:8px;background:#fff;border:1.5px solid #e5e3dc;position:relative;transition:border-color .15s;}
  #wk-root .wk-obj-row.done{opacity:.45;}
  #wk-root .wk-obj-bar{width:3px;border-radius:2px;align-self:stretch;flex-shrink:0;min-height:18px;}
  #wk-root .wk-obj-chk{width:20px;height:20px;min-width:20px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:1px;background:#fff;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-obj-chk.checked::after{content:'';width:9px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-obj-body{flex:1;min-width:0;}
  #wk-root .wk-obj-name{font-size:13px;font-weight:600;color:#1a1917;line-height:1.4;}

  /* Status overrides */
  #wk-root .wk-obj-failed          { border-color:#d95b5b !important; opacity:1 !important; }
  #wk-root .wk-obj-completed-bright{ border-color:#4caf7d !important; opacity:1 !important; }
  #wk-root .wk-obj-failed .wk-obj-name,
  #wk-root .wk-obj-completed-bright .wk-obj-name { text-decoration:none !important; }
  #wk-root .wk-obj-row.done .wk-obj-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-obj-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:5px;}
  #wk-root .wk-obj-tag{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-carried{font-family:'DM Mono',monospace;font-size:9px;color:#aaa89f;font-style:italic;}

  /* Review + status badges */
  #wk-root .wk-badge{font-family:'DM Mono',monospace;font-size:9px;font-weight:600;padding:2px 7px;border-radius:3px;text-transform:uppercase;letter-spacing:.07em;}
  #wk-root .wk-badge-reviewed  {color:#aaa89f;background:#f2f1ed;}
  #wk-root .wk-badge-failed    {color:#d95b5b;background:rgba(217,91,91,.12);}
  #wk-root .wk-badge-completed {color:#4caf7d;background:rgba(76,175,125,.12);}
  #wk-root .wk-badge-duplicated{color:#5b8dd9;background:rgba(91,141,217,.12);}

  #wk-root .wk-obj-actions{display:flex;gap:4px;flex-shrink:0;align-items:flex-start;}
  #wk-root .wk-obj-edit,#wk-root .wk-obj-del{font-size:15px;color:#aaa89f;cursor:pointer;padding:4px 7px;border-radius:4px;-webkit-tap-highlight-color:transparent;min-width:30px;min-height:30px;display:flex;align-items:center;justify-content:center;}
  #wk-root .wk-obj-edit:active{color:#5b8dd9;background:#eef3fc;}
  #wk-root .wk-obj-del:active{color:#c0392b;background:#fdf0ef;}

  /* Sunday "Review" button on each objective */
  #wk-root .wk-obj-review-btn{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:#fff;background:#d95b5b;border:none;padding:6px 10px;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;min-height:32px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-obj-review-btn:active{opacity:.8;}

  #wk-root .wk-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:8px 4px;text-transform:uppercase;letter-spacing:.08em;}

  /* ── Add / Edit objective form ── */
  #wk-root .wk-obj-form{display:none;background:#fff;border:1px solid #e5e3dc;border-radius:10px;padding:14px;margin-bottom:10px;}
  #wk-root .wk-obj-form.open{display:block;}
  #wk-root .wk-inline-edit{background:#f7f6f2;border:1px solid #C9A84C;border-radius:8px;padding:12px;margin-bottom:4px;}
  #wk-root .wk-form-inp{width:100%;border:1px solid #e5e3dc;border-radius:7px;padding:10px 12px;font-size:15px;font-weight:500;font-family:inherit;color:#1a1917;background:#f7f6f2;outline:none;margin-bottom:12px;-webkit-appearance:none;}
  #wk-root .wk-form-inp:focus{border-color:#C9A84C;}
  #wk-root .wk-form-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;display:block;}
  #wk-root .wk-form-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;}
  #wk-root .wk-tag-inp{flex:1;border:1px solid #e5e3dc;border-radius:7px;padding:9px 10px;font-size:13px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1917;background:#f7f6f2;outline:none;min-width:80px;-webkit-appearance:none;}
  #wk-root .wk-tag-inp:focus{border-color:#C9A84C;}

  /* ── Swatches ── */
  #wk-root .wk-swatches{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
  #wk-root .wk-swatch{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;-webkit-tap-highlight-color:transparent;flex-shrink:0;}
  #wk-root .wk-swatch.lg{width:28px;height:28px;}
  #wk-root .wk-swatch.selected{border-color:#1a1917;}

  /* ── Buttons ── */
  #wk-root .wk-btn-save{background:#C9A84C;color:#fff;border:none;border-radius:7px;padding:10px 20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-save:active{opacity:.8;}
  #wk-root .wk-btn-cancel{background:none;border:1px solid #e5e3dc;color:#aaa89f;border-radius:7px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-cancel:active{background:#f2f1ed;}
  #wk-root .wk-btn-sm{padding:7px 12px !important;min-height:34px !important;font-size:10px !important;border-radius:5px !important;}

  /* ── Past days section ── */
  #wk-root .wk-past-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.12em;margin:20px 0 10px;display:flex;align-items:center;gap:10px;}
  #wk-root .wk-past-label::before,
  #wk-root .wk-past-label::after{content:'';flex:1;height:1px;background:#e5e3dc;}
  #wk-root .wk-past-grid .wk-day-block{opacity:.72;}

  /* ── Collapsed past day blocks ── */
  #wk-root .wk-day-block.wk-collapsed .wk-day-body{display:none;}
  #wk-root .wk-past-header{cursor:pointer;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-collapse-chevron{font-size:18px;color:#aaa89f;margin-left:auto;flex-shrink:0;line-height:1;transition:transform .2s;}
  #wk-root .wk-day-block.wk-collapsed .wk-collapse-chevron{transform:rotate(0deg);}
  #wk-root .wk-day-block:not(.wk-collapsed) .wk-collapse-chevron{transform:rotate(90deg);}

  /* ── Day blocks ── */
  #wk-root .wk-day-grid{display:flex;flex-direction:column;gap:6px;}
  #wk-root .wk-day-block{background:#fff;border:1px solid #e5e3dc;border-radius:10px;overflow:visible;position:relative;}
  #wk-root .wk-day-block.today{border-color:#4caf7d;border-width:2px;background:#fff;}
  #wk-root .wk-day-block.drag-over{box-shadow:0 0 0 2.5px #C9A84C;border-color:#C9A84C;}
  #wk-root .wk-day-header{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #e5e3dc;position:relative;}
  #wk-root .wk-day-block.today .wk-day-header{background:#4caf7d;border-bottom-color:#4caf7d;}
  #wk-root .wk-day-name{font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:#4a4845;text-transform:uppercase;letter-spacing:.1em;width:30px;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-name{color:#fff;}
  #wk-root .wk-day-date{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-date{color:rgba(255,255,255,.75);}
  #wk-root .wk-focus-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;background:#f2f1ed;padding:4px 8px;border-radius:4px;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-focus-badge{background:rgba(255,255,255,.22);color:#fff;}
  #wk-root .wk-task-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;margin-left:auto;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-task-count{color:rgba(255,255,255,.8);}
  #wk-root .wk-day-add-btn{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;color:#fff;background:#C9A84C;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;min-height:28px;}
  #wk-root .wk-day-block.today .wk-day-add-btn{background:rgba(255,255,255,.25);color:#fff;}
  #wk-root .wk-day-add-btn:active{opacity:.8;}
  #wk-root .wk-focus-popup{display:none;position:absolute;background:#fff;border:1px solid #e5e3dc;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.12);padding:12px;z-index:300;top:46px;left:14px;min-width:200px;max-width:270px;}
  #wk-root .wk-focus-popup.open{display:block;}
  #wk-root .wk-focus-popup input{width:100%;border:1px solid #e5e3dc;border-radius:5px;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;outline:none;text-transform:uppercase;-webkit-appearance:none;}
  #wk-root .wk-focus-popup input:focus{border-color:#C9A84C;}
  #wk-root .wk-day-body{padding:6px 12px 10px;display:flex;flex-direction:column;gap:4px;}
  #wk-root .wk-day-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:4px 6px;text-transform:uppercase;letter-spacing:.08em;}

  /* ── AM/PM zones ── */
  #wk-root .wk-period-zone{border-radius:6px;padding:2px;transition:background .12s,box-shadow .12s;min-height:28px;}
  #wk-root .wk-period-zone.drop-target{background:rgba(201,168,76,.08);box-shadow:inset 0 0 0 1.5px #C9A84C;}
  #wk-root .wk-period-header{font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:#aaa89f;text-transform:uppercase;letter-spacing:.14em;padding:2px 6px 3px;}
  #wk-root .wk-period-divider{display:flex;align-items:center;gap:8px;margin:4px 0 3px;}
  #wk-root .wk-period-divider::before{content:'';flex:1;height:1px;background:#e5e3dc;}
  #wk-root .wk-period-divider::after{content:'';flex:1;height:1px;background:#e5e3dc;}
  #wk-root .wk-period-header.pm{color:#aaa89f;padding:0;}
  #wk-root .wk-day-block.today .wk-period-divider::before,
  #wk-root .wk-day-block.today .wk-period-divider::after{background:rgba(76,175,125,.3);}

  /* AM/PM toggle buttons */
  #wk-root .wk-period-toggle{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:5px 12px;border-radius:5px;border:1px solid #e5e3dc;background:#fff;color:#aaa89f;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:30px;}
  #wk-root .wk-period-toggle.active{background:#C9A84C;border-color:#C9A84C;color:#fff;}
  #wk-root .wk-period-toggle:active{opacity:.8;}

  /* ── Task items ── */
  #wk-root .wk-task-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;border:1px solid transparent;user-select:none;}
  #wk-root .wk-task-item:active{background:#f2f1ed;}
  #wk-root .wk-task-item.dragging{opacity:.35;background:#f7f6f2;}
  #wk-root .wk-task-handle{font-size:13px;color:#d8d5cc;line-height:1;padding:0 2px;cursor:grab;flex-shrink:0;}
  #wk-root .wk-task-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  #wk-root .wk-task-chk{width:18px;height:18px;min-width:18px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-task-chk.checked{background:#C9A84C;border-color:#C9A84C;}
  #wk-root .wk-task-chk.checked::after{content:'';width:8px;height:4px;border-left:1.5px solid #fff;border-bottom:1.5px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-task-name{flex:1;font-size:12px;font-weight:500;color:#1a1917;min-width:0;}
  #wk-root .wk-task-item.done .wk-task-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-task-edit,#wk-root .wk-task-del{font-size:13px;color:#d8d5cc;cursor:pointer;padding:3px 5px;-webkit-tap-highlight-color:transparent;min-width:26px;min-height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;}
  #wk-root .wk-task-edit:active{color:#5b8dd9;background:#eef3fc;}
  #wk-root .wk-task-del:active{color:#c0392b;background:#fdf0ef;}

  /* ── Inline day form ── */
  #wk-root .wk-day-form{display:none;padding:10px;background:#f7f6f2;border-radius:7px;border:1px solid #e5e3dc;margin-top:4px;}
  #wk-root .wk-day-form.open{display:block;}
  #wk-root .wk-day-form-inp{width:100%;border:none;background:transparent;font-size:14px;font-weight:500;font-family:inherit;color:#1a1917;outline:none;padding:2px 0 8px;-webkit-appearance:none;}
  #wk-root .wk-day-form-inp::placeholder{color:#aaa89f;}
  #wk-root .wk-day-form-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

  /* ── Touch drag ghost ── */
  #wk-drag-ghost{position:fixed;pointer-events:none;z-index:9999;background:#fff;border:1px solid #C9A84C;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:#1a1917;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:.92;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;}

  #wk-root .wk-divider{height:1px;background:#e5e3dc;margin:20px 0;}

  /* ── Uncompleted tasks section ── */
  #wk-root .wk-inc-list{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
  #wk-root .wk-inc-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:#fff;border:1px solid #f5c0c0;transition:opacity .25s;}
  #wk-root .wk-inc-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}
  #wk-root .wk-inc-name{font-size:14px;font-weight:500;color:#1a1917;}
  #wk-root .wk-inc-day{font-family:'DM Mono',monospace;font-size:10px;color:#aaa89f;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-inc-actions{display:flex;gap:4px;flex-shrink:0;}
  #wk-root .wk-inc-btn{padding:5px 9px !important;min-height:30px !important;font-size:10px !important;border-radius:4px !important;}
  #wk-root .wk-inc-del{color:#d95b5b !important;border-color:#d95b5b !important;}

  /* ── Archive section ── */
  #wk-root .wk-archive-header{display:flex;align-items:center;gap:8px;padding:10px 0;cursor:pointer;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-archive-count{font-family:'DM Mono',monospace;font-size:10px;font-weight:600;color:#fff;background:#aaa89f;border-radius:10px;padding:1px 7px;min-width:20px;text-align:center;}
  #wk-root .wk-archive-body{margin-bottom:16px;}
  #wk-root .wk-archive-sub{font-family:'DM Mono',monospace;font-size:10px;font-weight:600;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;}
  #wk-root .wk-archive-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;background:#f7f6f2;border:1px solid #e5e3dc;margin-bottom:4px;}
  #wk-root .wk-archive-icon{font-size:13px;color:#aaa89f;flex-shrink:0;}
  #wk-root .wk-archive-info{flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  #wk-root .wk-archive-name{font-size:13px;font-weight:500;color:#6b6860;text-decoration:line-through;}
  #wk-root .wk-archive-tag{font-family:'DM Mono',monospace;font-size:9px;color:#aaa89f;text-transform:uppercase;letter-spacing:.07em;}
  #wk-root .wk-archive-del{font-size:13px;color:#d8d5cc;cursor:pointer;padding:4px 5px;min-width:26px;min-height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-archive-del:active{color:#c0392b;background:#fdf0ef;}
  #wk-root .wk-archive-unarchive{font-size:14px;color:#5b8dd9;cursor:pointer;padding:4px 5px;min-width:26px;min-height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-archive-unarchive:active{background:#eef3fc;}

  /* ── Review modal overlay ── */
  #wkReviewOverlay{
    display:none;position:fixed;inset:0;
    background:rgba(0,0,0,.52);
    z-index:2000;
    align-items:flex-end;
    justify-content:center;
  }
  #wkReviewOverlay.open{display:flex;}
  #wkReviewModal{
    background:#fff;
    border-radius:20px 20px 0 0;
    width:100%;max-width:520px;
    max-height:90vh;overflow-y:auto;
    padding:24px 20px 44px;
  }
  .wkrm-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;}
  .wkrm-title{font-size:18px;font-weight:700;color:#1a1917;line-height:1.3;flex:1;margin-right:12px;}
  .wkrm-close{background:#f2f1ed;border:none;font-size:16px;color:#6b6860;cursor:pointer;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;}
  .wkrm-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#6b6860;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;display:block;}
  .wkrm-textarea{width:100%;border:1px solid #e5e3dc;border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;color:#1a1917;background:#f7f6f2;outline:none;resize:vertical;min-height:80px;margin-bottom:16px;-webkit-appearance:none;}
  .wkrm-textarea:focus{border-color:#C9A84C;}
  .wkrm-slider-wrap{margin-bottom:16px;}
  .wkrm-effort-display{font-family:'Bebas Neue','Impact',sans-serif;font-size:52px;color:#C9A84C;text-align:center;line-height:1;margin:2px 0 4px;}
  .wkrm-effort-sub{font-family:'DM Mono',monospace;font-size:10px;color:#aaa89f;text-align:center;margin-bottom:8px;}
  .wkrm-slider{width:100%;accent-color:#C9A84C;margin:4px 0;}
  .wkrm-slider-ends{display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:10px;color:#aaa89f;margin-top:4px;}
  .wkrm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px;padding-top:18px;border-top:1px solid #e5e3dc;}
  .wkrm-btn{flex:1;min-width:88px;padding:14px 8px;border:none;border-radius:10px;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;cursor:pointer;min-height:48px;-webkit-tap-highlight-color:transparent;}
  .wkrm-btn.complete {background:#4caf7d;color:#fff;}
  .wkrm-btn.fail     {background:#d95b5b;color:#fff;}
  .wkrm-btn.duplicate{background:#5b8dd9;color:#fff;}
  .wkrm-btn.clear    {background:none;border:1.5px solid #e5e3dc;color:#aaa89f;flex:0 0 auto;min-width:auto;padding:14px 16px;}
  .wkrm-btn:active{opacity:.8;}
  /* Read-only reviewed view */
  .wkrm-ro-block{background:#f7f6f2;border-radius:10px;padding:13px 15px;margin-bottom:10px;border:1px solid #e5e3dc;}
  .wkrm-ro-lbl{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;display:block;}
  .wkrm-ro-val{font-size:14px;font-weight:500;color:#1a1917;white-space:pre-wrap;word-break:break-word;}
  .wkrm-effort-big{font-family:'Bebas Neue','Impact',sans-serif;font-size:40px;color:#C9A84C;line-height:1;}
  .wkrm-outcome-pill{display:inline-flex;align-items:center;padding:5px 14px;border-radius:20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;}
  .wkrm-outcome-pill.completed {background:rgba(76,175,125,.15);color:#4caf7d;}
  .wkrm-outcome-pill.failed    {background:rgba(217,91,91,.15);color:#d95b5b;}
  .wkrm-outcome-pill.duplicated{background:rgba(91,141,217,.15);color:#5b8dd9;}
  .wkrm-edit-btn{width:100%;margin-top:16px;padding:12px;border:1.5px solid #e5e3dc;border-radius:8px;background:none;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:#6b6860;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;-webkit-tap-highlight-color:transparent;}
  .wkrm-edit-btn:active{background:#f2f1ed;}
</style>

<div id="wk-root">
  <div class="wk-nav-row">
    <div class="wk-eyebrow">Week ${wkNum}</div>
    <div class="wk-title">${monStr} – ${sunStr}</div>
    <div class="wk-week-nav">
      <button class="wk-nav-btn" onclick="weeklyShift(-1)">← Prev</button>
      <button class="wk-nav-btn" onclick="weeklyShift(1)">Next →</button>
    </div>
  </div>

  <div class="wk-stats-row">
    <div class="wk-stat-block">
      <div class="wk-stat-top">
        <span class="wk-stat-label">Objectives</span>
        <span class="wk-stat-count">${done}/${objs.length}</span>
      </div>
      <div class="wk-prog-track"><div class="wk-prog-fill" style="width:${pct}%;background:#C9A84C"></div></div>
      <div class="wk-stat-pct" style="color:#C9A84C">${pct}%</div>
    </div>
    <div class="wk-stat-divider"></div>
    <div class="wk-stat-block">
      <div class="wk-stat-top">
        <span class="wk-stat-label">Tasks</span>
        <span class="wk-stat-count">${tasksDone}/${tasksTotal}</span>
      </div>
      <div class="wk-prog-track"><div class="wk-prog-fill" style="width:${taskPct}%;background:#5b8dd9"></div></div>
      <div class="wk-stat-pct" style="color:#5b8dd9">${taskPct}%</div>
    </div>
  </div>

  <div class="wk-sec">
    <span class="wk-sec-label">Weekly Objectives</span>
    <button class="wk-sec-btn" onclick="weeklyToggleObjForm()">+ Add</button>
  </div>

  <div class="wk-obj-form" id="wkObjForm">
    <input type="text" class="wk-form-inp" id="wkObjInput" placeholder="Objective..." />
    <span class="wk-form-label">Colour</span>
    <div class="wk-swatches" id="wkObjSwatches" style="margin-bottom:12px;">${objSwatches}</div>
    <div class="wk-form-row">
      <input type="text" class="wk-tag-inp" id="wkObjTag" placeholder="Tag (e.g. Health)" />
      <button class="wk-btn-cancel" onclick="weeklyToggleObjForm()">Cancel</button>
      <button class="wk-btn-save"   onclick="weeklySaveObj()">Save</button>
    </div>
  </div>

  <div class="wk-obj-list">${objsHtml}</div>

  <!-- Things I Got Done -->
  <div class="wk-sec" style="margin-top:18px;">
    <span class="wk-sec-label">Things I Got Done</span>
    <button class="wk-sec-btn" onclick="weeklyToggleWinForm()">+ Add</button>
  </div>
  <div class="wk-obj-form" id="wkWinForm">
    <input type="text" class="wk-form-inp" id="wkWinInput" placeholder="Something you achieved this week..." />
    <div class="wk-form-row" style="justify-content:flex-end;">
      <button class="wk-btn-cancel" onclick="weeklyToggleWinForm()">Cancel</button>
      <button class="wk-btn-save"   onclick="weeklySaveWin()">Add</button>
    </div>
  </div>
  <div class="wk-win-list" id="wkWinList">
    ${wins.length===0
      ? `<div class="wk-empty">Nothing logged yet — add things you got done this week</div>`
      : wins.map((w,i)=>`
        <div class="wk-win-row" id="wkWin${i}">
          <span class="wk-win-dot">★</span>
          <span class="wk-win-text">${wkEsc(w.text)}</span>
          <span class="wk-win-del" onclick="weeklyDeleteWin(${i})">✕</span>
        </div>`).join('')
    }
  </div>

  <div class="wk-divider"></div>

  <div class="wk-sec" style="margin-bottom:12px;">
    <span class="wk-sec-label">Weekly Plan</span>
  </div>

  <div class="wk-day-grid">${topDaysHtml}</div>
  ${pastDaysSectionHtml}
  ${uncompletedHtml}

  ${(archTasks.length > 0 || archObjs.length > 0) ? `
  <div class="wk-divider"></div>
  <div class="wk-archive-header" onclick="weeklyToggleArchive()">
    <span class="wk-sec-label" style="color:#aaa89f;">🗄 Archive</span>
    <span class="wk-archive-count">${archTasks.length + archObjs.length}</span>
    <span class="wk-collapse-chevron" id="wkArchiveChevron" style="margin-left:auto;">›</span>
  </div>
  <div class="wk-archive-body" id="wkArchiveBody" style="display:none;">
    ${archObjs.length > 0 ? `
    <div class="wk-archive-sub">Objectives</div>
    ${archObjs.map((o,i)=>`
      <div class="wk-archive-row">
        <span class="wk-archive-icon">◎</span>
        <div class="wk-archive-info">
          <span class="wk-archive-name">${wkEsc(o.name)}</span>
          ${o.tag ? `<span class="wk-archive-tag">${wkEsc(o.tag)}</span>` : ''}
        </div>
        <span class="wk-archive-unarchive" onclick="weeklyUnarchiveObj(${i})" title="Restore objective">↩</span>
        <span class="wk-archive-del" onclick="weeklyConfirmDeleteArchive('obj',${i},'${wkEsc(o.name)}')" title="Delete permanently">✕</span>
      </div>`).join('')}` : ''}
    ${archTasks.length > 0 ? `
    <div class="wk-archive-sub" style="margin-top:${archObjs.length>0?'12px':'0'};">Tasks</div>
    ${archTasks.map((t,i)=>`
      <div class="wk-archive-row">
        <span class="wk-archive-icon">·</span>
        <div class="wk-archive-info">
          <span class="wk-archive-name">${wkEsc(t.name)}</span>
          <span class="wk-archive-tag">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][t.dayIdx]||''}</span>
        </div>
        <span class="wk-archive-unarchive" onclick="weeklyUnarchiveTask(${i})" title="Restore task">↩</span>
        <span class="wk-archive-del" onclick="weeklyConfirmDeleteArchive('task',${i},'${wkEsc(t.name)}')" title="Delete permanently">✕</span>
      </div>`).join('')}` : ''}
  </div>` : ''}
</div>

<!-- Confirmation modal (archive objective / permanently delete from archive) -->
<div id="wkConfirmOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.52);z-index:2001;align-items:center;justify-content:center;" onclick="weeklyConfirmCancel(event)">
  <div id="wkConfirmModal" onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:calc(100% - 48px);max-width:340px;padding:24px 20px;box-shadow:0 8px 40px rgba(0,0,0,.22);">
    <div id="wkConfirmTitle" style="font-size:17px;font-weight:700;color:#1a1917;margin-bottom:8px;"></div>
    <div id="wkConfirmBody"  style="font-size:14px;color:#6b6860;margin-bottom:22px;line-height:1.4;"></div>
    <div style="display:flex;gap:8px;">
      <button onclick="weeklyConfirmCancel()" style="flex:1;padding:13px;border:2px solid #d8d5cc;border-radius:10px;background:#f7f6f2;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#1a1917;text-transform:uppercase;cursor:pointer;letter-spacing:.06em;">Cancel</button>
      <button id="wkConfirmActionBtn" style="flex:1;padding:13px;border:none;border-radius:10px;background:#1a1917;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;cursor:pointer;letter-spacing:.06em;"></button>
    </div>
  </div>
</div>

<!-- Review modal — outside #wk-root so position:fixed works cleanly -->
<div id="wkReviewOverlay" onclick="weeklyCloseReviewOverlay(event)">
  <div id="wkReviewModal" onclick="event.stopPropagation()">
    <div class="wkrm-header">
      <div class="wkrm-title" id="wkReviewTitle"></div>
      <button class="wkrm-close" onclick="weeklyCloseReviewBtn()">✕</button>
    </div>
    <div id="wkReviewBody"></div>
  </div>
</div>`;
}


// ── initWeeklyTab — called by app.js after each render ──────────────────────
export function initWeeklyTab() {
  if (window._weeklyOffset===undefined) window._weeklyOffset=0;
  if (!window._weeklyObjColor)  window._weeklyObjColor='gold';
  if (!window._weeklyDayColors) window._weeklyDayColors={};
  if (!window._weeklyDrag)      window._weeklyDrag=null;

  const rerender = () => { if (typeof setTab==='function') setTab('planner'); };

  // ── Week navigation ───────────────────────────────────────────────────────
  window.weeklyShift = (dir) => {
    window._weeklyOffset = (window._weeklyOffset||0) + dir;
    rerender();
  };

  // ── Things I Got Done ────────────────────────────────────────────────────
  window.weeklyToggleWinForm = () => {
    const f = document.getElementById('wkWinForm'); if (!f) return;
    const opening = !f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) document.getElementById('wkWinInput')?.focus();
    else document.getElementById('wkWinInput').value = '';
  };
  window.weeklySaveWin = () => {
    const text = (document.getElementById('wkWinInput')?.value||'').trim();
    if (!text) return;
    const ws = wkGetWS(window._weeklyOffset);
    if (!ws.wins) ws.wins = [];
    ws.wins.push({ text, addedAt: Date.now() });
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };
  window.weeklyDeleteWin = (i) => {
    const ws = wkGetWS(window._weeklyOffset);
    (ws.wins||[]).splice(i, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  // ── Past day collapse toggle ──────────────────────────────────────────────
  window.weeklyTogglePastDay = (i) => {
    document.getElementById('wkDay'+i)?.classList.toggle('wk-collapsed');
  };

  // ── Add objective ─────────────────────────────────────────────────────────
  window.weeklyToggleObjForm = () => {
    const f = document.getElementById('wkObjForm'); if (!f) return;
    const opening = !f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) document.getElementById('wkObjInput')?.focus();
    else {
      document.getElementById('wkObjInput').value = '';
      document.getElementById('wkObjTag').value   = '';
    }
  };
  window.weeklyPickObjColor = (colorId, el) => {
    window._weeklyObjColor = colorId;
    document.querySelectorAll('#wkObjSwatches .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };
  window.weeklySaveObj = () => {
    const name = (document.getElementById('wkObjInput')?.value||'').trim();
    const tag  = (document.getElementById('wkObjTag')?.value||'').trim();
    if (!name) return;
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives.push({ name, tag, color:window._weeklyObjColor||'gold', done:false });
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  // ── Edit objective inline ─────────────────────────────────────────────────
  window.weeklyStartEditObj = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    const c   = WK_COLORS.find(c=>c.id===obj.color)||WK_COLORS[0];
    const row = document.getElementById('wkObjRow'+i); if (!row) return;

    const swatches = WK_COLORS.map(cc=>
      `<div class="wk-swatch lg${cc.id===obj.color?' selected':''}" style="background:${cc.hex}"
        data-color="${cc.id}" onclick="wkEditObjPickColor('${cc.id}',this)"></div>`
    ).join('');

    row.innerHTML = `
      <div class="wk-obj-bar" id="wkEditBar${i}" style="background:${c.hex}"></div>
      <div class="wk-inline-edit" style="flex:1;">
        <input class="wk-form-inp" id="wkEditObjName${i}"
          value="${wkEsc(obj.name)}" placeholder="Objective..."
          style="margin-bottom:10px;" />
        <span class="wk-form-label">Colour</span>
        <div class="wk-swatches" id="wkEditObjSw${i}" style="margin-bottom:10px;">${swatches}</div>
        <input class="wk-tag-inp" id="wkEditObjTag${i}"
          value="${wkEsc(obj.tag||'')}" placeholder="Tag (e.g. Health)"
          style="width:100%;margin-bottom:10px;" />
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="wk-btn-cancel wk-btn-sm" onclick="weeklyRerender()">Cancel</button>
          <button class="wk-btn-save   wk-btn-sm" onclick="weeklySaveEditObj(${i})">Save</button>
        </div>
      </div>`;

    window._wkEditObjColor = obj.color;

    window.wkEditObjPickColor = (colorId, el) => {
      window._wkEditObjColor = colorId;
      document.querySelectorAll(`#wkEditObjSw${i} .wk-swatch`).forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');
      const bar = document.getElementById('wkEditBar'+i);
      if (bar) bar.style.background = WK_COLORS.find(c=>c.id===colorId)?.hex||'#C9A84C';
    };

    document.getElementById('wkEditObjName'+i)?.focus();
  };

  window.weeklySaveEditObj = (i) => {
    const name = (document.getElementById('wkEditObjName'+i)?.value||'').trim();
    const tag  = (document.getElementById('wkEditObjTag'+i)?.value||'').trim();
    if (!name) return;
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives[i] = { ...ws.objectives[i], name, tag, color:window._wkEditObjColor||ws.objectives[i].color };
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  window.weeklyRerender = () => rerender();

  // ── Objective toggle / delete ─────────────────────────────────────────────
  window.weeklyToggleObj = (i) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives[i].done = !ws.objectives[i].done;
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };
  window.weeklyDeleteObj = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    wkShowConfirm(
      'Archive this objective?',
      obj.name,
      'Archive',
      '#1a1917',
      () => weeklyConfirmArchiveObj(i)
    );
  };
  window.weeklyConfirmCancel = (e) => {
    if (e && e.target?.id !== 'wkConfirmOverlay' && e.type === 'click') return;
    document.getElementById('wkConfirmOverlay').style.display = 'none';
  };

  function wkShowConfirm(title, body, actionLabel, actionBg, onConfirm) {
    document.getElementById('wkConfirmTitle').textContent       = title;
    document.getElementById('wkConfirmBody').textContent        = body;
    const btn = document.getElementById('wkConfirmActionBtn');
    btn.textContent       = actionLabel;
    btn.style.background  = actionBg;
    btn.style.color       = '#fff';
    btn.onclick           = () => {
      document.getElementById('wkConfirmOverlay').style.display = 'none';
      onConfirm();
    };
    document.getElementById('wkConfirmOverlay').style.display = 'flex';
  }

  window.weeklyConfirmArchiveObj = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    if (!ws.archive)            ws.archive            = { tasks:[], objectives:[] };
    if (!ws.archive.objectives) ws.archive.objectives = [];
    ws.archive.objectives.push({ ...obj, archivedAt: Date.now() });
    ws.objectives.splice(i, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  window.weeklyConfirmDeleteArchive = (type, i, name) => {
    wkShowConfirm(
      'Delete permanently?',
      `"${name}" will be removed forever.`,
      'Delete',
      '#d95b5b',
      () => {
        const ws = wkGetWS(window._weeklyOffset);
        if (type === 'obj')  (ws.archive?.objectives||[]).splice(i, 1);
        if (type === 'task') (ws.archive?.tasks||[]).splice(i, 1);
        wkSaveWS(ws, window._weeklyOffset);
        rerender();
      }
    );
  };

  // Keep legacy names as no-ops in case called elsewhere
  window.weeklyDeleteArchiveObj  = (i) => weeklyConfirmDeleteArchive('obj',  i, '');
  window.weeklyDeleteArchiveTask = (i) => weeklyConfirmDeleteArchive('task', i, '');

  window.weeklyUnarchiveObj = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = (ws.archive?.objectives||[])[i]; if (!obj) return;
    const { archivedAt, ...restored } = obj;
    ws.objectives.push({ ...restored, done: false });
    ws.archive.objectives.splice(i, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };
  window.weeklyUnarchiveTask = (i) => {
    const ws   = wkGetWS(window._weeklyOffset);
    const task = (ws.archive?.tasks||[])[i]; if (!task) return;
    const { archivedAt, dayIdx, ...restored } = task;
    const targetDay = dayIdx !== undefined ? dayIdx : 0;
    if (!ws.days[targetDay].tasks) ws.days[targetDay].tasks = [];
    ws.days[targetDay].tasks.push({ ...restored, done: false });
    ws.archive.tasks.splice(i, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  window.weeklyToggleArchive = () => {
    const body    = document.getElementById('wkArchiveBody');
    const chevron = document.getElementById('wkArchiveChevron');
    if (!body) return;
    const open = body.style.display === 'none';
    body.style.display    = open ? 'block' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
  };

  // ── Sunday review modal ───────────────────────────────────────────────────

  // Internal: renders content into #wkReviewBody
  function wkBuildReviewBody(obj, i, forceEdit) {
    const bodyEl = document.getElementById('wkReviewBody');
    if (!bodyEl) return;
    const r = obj._review || {};

    if (obj._reviewed && !forceEdit) {
      // ── Read-only view ──
      const outcomeLabel = {
        completed : '✓ Completed',
        failed    : '✗ Failed',
        duplicated: '↗ Carried to next week',
      }[r.outcome] || r.outcome || '—';

      bodyEl.innerHTML = `
        ${r.whyNot ? `
        <div class="wkrm-ro-block">
          <span class="wkrm-ro-lbl">Why you didn't achieve it</span>
          <div class="wkrm-ro-val">${wkEsc(r.whyNot)}</div>
        </div>` : ''}
        <div class="wkrm-ro-block">
          <span class="wkrm-ro-lbl">Effort this week</span>
          <div class="wkrm-effort-big">${r.effort!==undefined ? r.effort : '—'}<span style="font-size:20px;color:#aaa89f;">/10</span></div>
        </div>
        ${r.whatBetter ? `
        <div class="wkrm-ro-block">
          <span class="wkrm-ro-lbl">What you'll do differently</span>
          <div class="wkrm-ro-val">${wkEsc(r.whatBetter)}</div>
        </div>` : ''}
        <div class="wkrm-ro-block">
          <span class="wkrm-ro-lbl">Outcome</span>
          <div class="wkrm-outcome-pill ${r.outcome||''}">${outcomeLabel}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="wkrm-edit-btn" style="flex:1;margin-top:0;" onclick="wkEditReviewForm(${i})">Edit Review</button>
          <button class="wkrm-edit-btn" style="flex:0 0 auto;margin-top:0;color:#d95b5b;border-color:#d95b5b;" onclick="weeklyClearReview(${i})">✕ Clear</button>
        </div>`;
    } else {
      // ── Editable form ──
      const effort = r.effort !== undefined ? r.effort : 5;
      bodyEl.innerHTML = `
        <span class="wkrm-label">Why didn't you achieve this?</span>
        <textarea class="wkrm-textarea" id="wkReviewWhyNot"
          placeholder="Be honest with yourself...">${wkEsc(r.whyNot||'')}</textarea>

        <div class="wkrm-slider-wrap">
          <span class="wkrm-label">Effort this week</span>
          <div class="wkrm-effort-display" id="wkReviewSliderVal">${effort}</div>
          <div class="wkrm-effort-sub">out of 10</div>
          <input type="range" class="wkrm-slider" id="wkReviewSlider"
            min="0" max="10" value="${effort}"
            oninput="document.getElementById('wkReviewSliderVal').textContent=this.value" />
          <div class="wkrm-slider-ends">
            <span>0 — No effort</span>
            <span>10 — Full send</span>
          </div>
        </div>

        <span class="wkrm-label">What will you do differently next week? <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#aaa89f;">(optional)</span></span>
        <textarea class="wkrm-textarea" id="wkReviewWhatBetter"
          placeholder="Next week I will...">${wkEsc(r.whatBetter||'')}</textarea>

        <div class="wkrm-actions">
          <button class="wkrm-btn complete"  onclick="weeklySaveReview('completed')">✓ Completed</button>
          <button class="wkrm-btn fail"      onclick="weeklySaveReview('failed')">✗ Failed</button>
          <button class="wkrm-btn duplicate" onclick="weeklySaveReview('duplicated')">↗ Next Week</button>
          <button class="wkrm-btn clear"     onclick="weeklyClearReview(window._wkReviewIdx)">✕</button>
        </div>`;
    }
  }

  window.weeklyOpenReview = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    window._wkReviewIdx = i;
    const titleEl = document.getElementById('wkReviewTitle');
    if (titleEl) titleEl.textContent = obj.name;
    wkBuildReviewBody(obj, i, false);
    document.getElementById('wkReviewOverlay')?.classList.add('open');
  };

  window.wkEditReviewForm = (i) => {
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    wkBuildReviewBody(obj, i, true);
  };

  window.weeklyCloseReviewOverlay = (e) => {
    if (e.target.id === 'wkReviewOverlay') weeklyCloseReviewBtn();
  };
  window.weeklyCloseReviewBtn = () => {
    document.getElementById('wkReviewOverlay')?.classList.remove('open');
    window._wkReviewIdx = null;
  };

  window.weeklyClearReview = (i) => {
    if (i === null || i === undefined) return;
    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;
    delete obj._reviewed;
    delete obj._review;
    obj.done = false;
    wkSaveWS(ws, window._weeklyOffset);
    weeklyCloseReviewBtn();
    rerender();
  };

  window.weeklySaveReview = (outcome) => {
    const i = window._wkReviewIdx;
    if (i === null || i === undefined) return;
    const whyNot     = (document.getElementById('wkReviewWhyNot')?.value||'').trim();
    const effort     = parseInt(document.getElementById('wkReviewSlider')?.value||'5', 10);
    const whatBetter = (document.getElementById('wkReviewWhatBetter')?.value||'').trim();

    const ws  = wkGetWS(window._weeklyOffset);
    const obj = ws.objectives[i]; if (!obj) return;

    obj._reviewed = true;
    obj._review   = { whyNot, effort, whatBetter, outcome, reviewedAt: Date.now() };

    if (outcome === 'completed') { obj.done = true;  }
    if (outcome === 'failed')    { obj.done = false; }
    if (outcome === 'duplicated') {
      const nextWS = wkGetWS(window._weeklyOffset + 1);
      nextWS.objectives.push({
        name: obj.name,
        tag:  obj.tag || '',
        color:obj.color || 'gold',
        done: false,
        _carriedOver: true,
        _fromReview:  true,
      });
      wkSaveWS(nextWS, window._weeklyOffset + 1);
    }

    wkSaveWS(ws, window._weeklyOffset);
    weeklyCloseReviewBtn();
    rerender();
  };

  // ── Uncompleted task handlers (Sunday) ────────────────────────────────────
  window.weeklyMarkIncompleteTaskDone = (di, ti) => {
    const ws = wkGetWS(window._weeklyOffset);
    if (ws.days[di]?.tasks?.[ti]) ws.days[di].tasks[ti].done = true;
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  window.weeklyDeleteIncompleteTask = (di, ti) => {
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[di]?.tasks?.[ti]; if (!task) return;
    if (!ws.archive)       ws.archive       = { tasks:[], objectives:[] };
    if (!ws.archive.tasks) ws.archive.tasks = [];
    ws.archive.tasks.push({ ...task, dayIdx: di, archivedAt: Date.now() });
    ws.days[di].tasks.splice(ti, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  window.weeklyDuplicateTaskNextWeek = (di, ti) => {
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[di]?.tasks?.[ti]; if (!task) return;
    const nextWS = wkGetWS(window._weeklyOffset + 1);
    if (!nextWS.days[0].tasks) nextWS.days[0].tasks = [];
    nextWS.days[0].tasks.push({ ...task, done:false, period:'am' });
    wkSaveWS(nextWS, window._weeklyOffset + 1);
    // Soft visual feedback — fade row without full rerender
    const row = document.getElementById(`wkInc_${di}_${ti}`);
    if (row) { row.style.opacity = '0.35'; row.style.pointerEvents = 'none'; }
  };

  window.weeklyDuplicateAllTasksNextWeek = () => {
    const ws     = wkGetWS(window._weeklyOffset);
    const nextWS = wkGetWS(window._weeklyOffset + 1);
    if (!nextWS.days[0].tasks) nextWS.days[0].tasks = [];
    ws.days.forEach(dayData => {
      (dayData.tasks||[]).forEach(task => {
        if (!task.done) nextWS.days[0].tasks.push({ ...task, done:false, period:'am' });
      });
    });
    wkSaveWS(nextWS, window._weeklyOffset + 1);
    rerender();
  };

  // ── Add task form ─────────────────────────────────────────────────────────
  window.weeklyToggleDayForm = (dayIdx) => {
    const f = document.getElementById('wkDayForm'+dayIdx); if (!f) return;
    const opening = !f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) {
      document.getElementById('wkPeriodAM'+dayIdx)?.classList.add('active');
      document.getElementById('wkPeriodPM'+dayIdx)?.classList.remove('active');
      window._weeklyDayPeriods = window._weeklyDayPeriods||{};
      window._weeklyDayPeriods[dayIdx] = 'am';
      document.getElementById('wkDayInp'+dayIdx)?.focus();
    }
  };
  window.weeklySetPeriod = (dayIdx, period) => {
    window._weeklyDayPeriods = window._weeklyDayPeriods||{};
    window._weeklyDayPeriods[dayIdx] = period;
    document.getElementById('wkPeriodAM'+dayIdx)?.classList.toggle('active', period==='am');
    document.getElementById('wkPeriodPM'+dayIdx)?.classList.toggle('active', period==='pm');
  };
  window.weeklyPickDayColor = (dayIdx, colorId, el) => {
    window._weeklyDayColors[dayIdx] = colorId;
    document.querySelectorAll('#wkDaySw'+dayIdx+' .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };
  window.weeklyAddTask = (dayIdx) => {
    const name = (document.getElementById('wkDayInp'+dayIdx)?.value||'').trim();
    if (!name) return;
    const period = (window._weeklyDayPeriods||{})[dayIdx]||'am';
    const ws = wkGetWS(window._weeklyOffset);
    if (!ws.days[dayIdx].tasks) ws.days[dayIdx].tasks = [];
    ws.days[dayIdx].tasks.push({ name, color:window._weeklyDayColors[dayIdx]||'gold', done:false, period });
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  // ── Edit task inline ──────────────────────────────────────────────────────
  window.weeklyStartEditTask = (dayIdx, taskIdx) => {
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[dayIdx]?.tasks?.[taskIdx]; if (!task) return;
    const el   = document.querySelector(`.wk-task-item[data-day="${dayIdx}"][data-task="${taskIdx}"]`);
    if (!el) return;

    const swatches = WK_COLORS.map(c=>
      `<div class="wk-swatch${c.id===task.color?' selected':''}" style="background:${c.hex}"
        data-color="${c.id}" onclick="wkEditTaskPickColor(${dayIdx},${taskIdx},'${c.id}',this)"></div>`
    ).join('');

    const period = task.period||'am';
    el.draggable = false;
    el.innerHTML = `
      <div style="flex:1;">
        <input class="wk-day-form-inp" id="wkEditTaskInp${dayIdx}_${taskIdx}"
          value="${wkEsc(task.name)}" placeholder="Task..."
          style="padding:4px 0 8px;border-bottom:1px solid #e5e3dc;"
          onkeydown="if(event.key==='Enter')weeklySaveEditTask(${dayIdx},${taskIdx});if(event.key==='Escape')weeklyRerender()" />
        <div class="wk-day-form-row" style="margin-top:8px;margin-bottom:8px;">
          <button class="wk-period-toggle${period==='am'?' active':''}" id="wkEditPeriodAM${dayIdx}_${taskIdx}"
            onclick="wkEditTaskPeriod(${dayIdx},${taskIdx},'am',this)">AM</button>
          <button class="wk-period-toggle${period==='pm'?' active':''}" id="wkEditPeriodPM${dayIdx}_${taskIdx}"
            onclick="wkEditTaskPeriod(${dayIdx},${taskIdx},'pm',this)">PM</button>
          <div style="flex:1;"></div>
          <div class="wk-swatches" id="wkEditTaskSw${dayIdx}_${taskIdx}">${swatches}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="wk-btn-cancel wk-btn-sm" onclick="weeklyRerender()">Cancel</button>
          <button class="wk-btn-save   wk-btn-sm" onclick="weeklySaveEditTask(${dayIdx},${taskIdx})">Save</button>
        </div>
      </div>`;

    window._wkEditTaskColors  = window._wkEditTaskColors||{};
    window._wkEditTaskPeriods = window._wkEditTaskPeriods||{};
    window._wkEditTaskColors[`${dayIdx}_${taskIdx}`]  = task.color;
    window._wkEditTaskPeriods[`${dayIdx}_${taskIdx}`] = period;

    window.wkEditTaskPickColor = (d, t, colorId, swEl) => {
      window._wkEditTaskColors[`${d}_${t}`] = colorId;
      document.querySelectorAll(`#wkEditTaskSw${d}_${t} .wk-swatch`).forEach(s=>s.classList.remove('selected'));
      swEl.classList.add('selected');
    };
    window.wkEditTaskPeriod = (d, t, p) => {
      window._wkEditTaskPeriods[`${d}_${t}`] = p;
      document.getElementById(`wkEditPeriodAM${d}_${t}`)?.classList.toggle('active', p==='am');
      document.getElementById(`wkEditPeriodPM${d}_${t}`)?.classList.toggle('active', p==='pm');
    };

    document.getElementById(`wkEditTaskInp${dayIdx}_${taskIdx}`)?.focus();
  };

  window.weeklySaveEditTask = (dayIdx, taskIdx) => {
    const name = (document.getElementById(`wkEditTaskInp${dayIdx}_${taskIdx}`)?.value||'').trim();
    if (!name) return;
    const ws  = wkGetWS(window._weeklyOffset);
    const key = `${dayIdx}_${taskIdx}`;
    ws.days[dayIdx].tasks[taskIdx] = {
      ...ws.days[dayIdx].tasks[taskIdx],
      name,
      color:  (window._wkEditTaskColors||{})[key]  || ws.days[dayIdx].tasks[taskIdx].color,
      period: (window._wkEditTaskPeriods||{})[key] || ws.days[dayIdx].tasks[taskIdx].period || 'am',
    };
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  // ── Task toggle / delete ──────────────────────────────────────────────────
  window.weeklyToggleTask = (dayIdx, taskIdx) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks[taskIdx].done = !ws.days[dayIdx].tasks[taskIdx].done;
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };
  window.weeklyDeleteTask = (dayIdx, taskIdx) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks.splice(taskIdx, 1);
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };

  // ── Focus badge ───────────────────────────────────────────────────────────
  window.weeklyToggleFocus = (e, dayIdx) => {
    e.stopPropagation();
    const popup   = document.getElementById('wkFocusPop'+dayIdx); if (!popup) return;
    const opening = !popup.classList.contains('open');
    document.querySelectorAll('.wk-focus-popup.open').forEach(p=>p.classList.remove('open'));
    if (opening) { popup.classList.add('open'); popup.querySelector('input')?.focus(); }
  };
  window.weeklyCloseFocus = (dayIdx) => {
    document.getElementById('wkFocusPop'+dayIdx)?.classList.remove('open');
  };
  window.weeklySaveFocus = (dayIdx) => {
    const val = (document.getElementById('wkFocusInp'+dayIdx)?.value||'').trim();
    const ws  = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].focus = val;
    wkSaveWS(ws, window._weeklyOffset);
    weeklyCloseFocus(dayIdx);
    rerender();
  };

  // ── Mouse drag — zone-aware (AM/PM + cross-day) ───────────────────────────
  window.weeklyDragStart = (e, dayIdx, taskIdx) => {
    window._weeklyDrag = { fromDay:dayIdx, taskIndex:taskIdx };
    setTimeout(()=>e.target.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  };
  window.weeklyDragEnd = (e) => {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
  };
  window.weeklyZoneDragOver = (e, dayIdx, period) => {
    e.stopPropagation();
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
    document.getElementById(`wkZone${period==='am'?'AM':'PM'}${dayIdx}`)?.classList.add('drop-target');
  };
  window.weeklyZoneDragLeave = (dayIdx, period) => {
    document.getElementById(`wkZone${period==='am'?'AM':'PM'}${dayIdx}`)?.classList.remove('drop-target');
  };
  window.weeklyZoneDrop = (e, toDay, toPeriod) => {
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
    const drag = window._weeklyDrag; if (!drag) return;
    const { fromDay, taskIndex } = drag; window._weeklyDrag = null;
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[fromDay].tasks[taskIndex]; if (!task) return;
    if (fromDay===toDay && task.period===toPeriod) return;
    ws.days[fromDay].tasks.splice(taskIndex, 1);
    if (!ws.days[toDay].tasks) ws.days[toDay].tasks = [];
    ws.days[toDay].tasks.push({ ...task, period:toPeriod });
    wkSaveWS(ws, window._weeklyOffset);
    rerender();
  };
  window.weeklyDrop = (e) => { e.preventDefault(); };

  // ── Touch drag (mobile) ───────────────────────────────────────────────────
  let touchDragData  = null;
  let touchGhost     = null;
  let lastHighlighted = null;

  function createGhost(name) {
    const g = document.createElement('div');
    g.id = 'wk-drag-ghost'; g.textContent = name;
    document.body.appendChild(g); return g;
  }
  function removeGhost() { document.getElementById('wk-drag-ghost')?.remove(); touchGhost = null; }
  function clearHighlight() {
    if (lastHighlighted) {
      lastHighlighted.classList.remove('drop-target','drag-over');
      lastHighlighted = null;
    }
  }
  function getZoneAtPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (el.classList?.contains('wk-period-zone')) return el;
      const p = el.closest?.('.wk-period-zone'); if (p) return p;
    }
    return null;
  }

  window.wkTouchStart = (e, dayIdx, taskIdx) => {
    const touch = e.touches[0];
    touchDragData = { fromDay:dayIdx, taskIndex:taskIdx, startX:touch.clientX, startY:touch.clientY, active:false };
    touchDragData.timer = setTimeout(()=>{
      if (!touchDragData) return;
      const ws   = wkGetWS(window._weeklyOffset);
      const task = ws.days[dayIdx]?.tasks?.[taskIdx]; if (!task) return;
      touchDragData.active = true;
      touchGhost = createGhost(task.name);
      touchGhost.style.left = (touchDragData.startX-20)+'px';
      touchGhost.style.top  = (touchDragData.startY-30)+'px';
      const orig = document.querySelector(`.wk-task-item[data-day="${dayIdx}"][data-task="${taskIdx}"]`);
      if (orig) orig.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(40);
    }, 350);
  };

  document.addEventListener('touchmove', (e) => {
    if (!touchDragData?.active) {
      if (touchDragData) {
        const t = e.touches[0];
        if (Math.abs(t.clientX-touchDragData.startX)>8 || Math.abs(t.clientY-touchDragData.startY)>8) {
          clearTimeout(touchDragData.timer); touchDragData = null;
        }
      }
      return;
    }
    e.preventDefault();
    const touch = e.touches[0];
    if (touchGhost) {
      touchGhost.style.left = (touch.clientX-20)+'px';
      touchGhost.style.top  = (touch.clientY-30)+'px';
    }
    clearHighlight();
    const zone = getZoneAtPoint(touch.clientX, touch.clientY);
    if (zone) { zone.classList.add('drop-target'); lastHighlighted = zone; }
  }, { passive:false });

  document.addEventListener('touchend', (e) => {
    if (!touchDragData) return;
    clearTimeout(touchDragData.timer);
    if (!touchDragData.active) { touchDragData = null; return; }
    const touch = e.changedTouches[0];
    const zone  = getZoneAtPoint(touch.clientX, touch.clientY);
    clearHighlight(); removeGhost();
    document.querySelectorAll('.wk-task-item.dragging').forEach(el=>el.classList.remove('dragging'));
    const { fromDay, taskIndex } = touchDragData; touchDragData = null;
    if (!zone) return;
    const toDay    = parseInt(zone.dataset.day);
    const toPeriod = zone.dataset.period;
    if (isNaN(toDay)||!toPeriod) return;
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[fromDay].tasks[taskIndex]; if (!task) return;
    if (fromDay===toDay && task.period===toPeriod) return;
    ws.days[fromDay].tasks.splice(taskIndex, 1);
    if (!ws.days[toDay].tasks) ws.days[toDay].tasks = [];
    ws.days[toDay].tasks.push({ ...task, period:toPeriod });
    wkSaveWS(ws, window._weeklyOffset);
    if (navigator.vibrate) navigator.vibrate(30);
    rerender();
  });

  // Close focus popups on outside tap
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.wk-focus-popup.open').forEach(p => {
      if (!p.contains(e.target) && !e.target.classList.contains('wk-focus-badge'))
        p.classList.remove('open');
    });
  });
}
