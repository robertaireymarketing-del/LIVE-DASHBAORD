// renderWeeklyTab.js — 📅 Weekly Planner Tab

export function renderWeeklyTab() {

  const COLORS = [
    { id: 'gold',   hex: '#C9A84C' },
    { id: 'green',  hex: '#4caf7d' },
    { id: 'blue',   hex: '#5b8dd9' },
    { id: 'red',    hex: '#d95b5b' },
    { id: 'purple', hex: '#9b59b6' },
    { id: 'orange', hex: '#e07b39' },
    { id: 'teal',   hex: '#1abc9c' },
    { id: 'gray',   hex: '#aaa89f' },
  ];

  function getISOWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function getMondayOf(offset) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) + offset * 7);
    return d;
  }

  const weekOffset = (window._weeklyOffset || 0);
  const mon = getMondayOf(weekOffset);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekNum = getISOWeek(mon);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const monStr = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  const sunStr = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  // Load from localStorage
  let ws = {};
  try {
    const all = JSON.parse(localStorage.getItem('weekly_state') || '{}');
    const key = `${mon.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    ws = all[key] || { objectives: [], days: [{},{},{},{},{},{},{}] };
    if (!Array.isArray(ws.days)) ws.days = [{},{},{},{},{},{},{}];
    while (ws.days.length < 7) ws.days.push({});
  } catch(e) { ws = { objectives: [], days: [{},{},{},{},{},{},{}] }; }

  const objs = ws.objectives || [];
  const done = objs.filter(o => o.done).length;
  const pct = objs.length ? Math.round(done / objs.length * 100) : 0;

  // ── Build objectives HTML ────────────────────────────────────────────────
  const objsHtml = objs.length === 0
    ? `<div class="wk-empty">No objectives yet — add one above</div>`
    : objs.map((obj, i) => {
        const c = COLORS.find(c => c.id === obj.color) || COLORS[0];
        return `
        <div class="wk-obj-row${obj.done ? ' done' : ''}">
          <div class="wk-obj-bar" style="background:${c.hex}"></div>
          <div class="wk-obj-chk${obj.done ? ' checked' : ''}" onclick="weeklyToggleObj(${i})" style="${obj.done ? `background:${c.hex};border-color:${c.hex}` : ''}"></div>
          <div class="wk-obj-body">
            <div class="wk-obj-name">${obj.name}</div>
            ${obj.tag ? `<span class="wk-obj-tag" style="background:${c.hex}18;color:${c.hex}">${obj.tag}</span>` : ''}
          </div>
          <div class="wk-obj-del" onclick="weeklyDeleteObj(${i})">✕</div>
        </div>`;
      }).join('');

  // ── Build days HTML ──────────────────────────────────────────────────────
  const daysHtml = ws.days.map((dayData, i) => {
    const date = new Date(mon); date.setDate(date.getDate() + i);
    const isToday = date.getTime() === today.getTime();
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const tasks = dayData.tasks || [];
    const focus = dayData.focus || '';
    const doneCount = tasks.filter(t => t.done).length;

    const tasksHtml = tasks.length === 0
      ? `<div class="wk-day-empty">No tasks</div>`
      : tasks.map((task, ti) => {
          const tc = COLORS.find(c => c.id === task.color) || COLORS[7];
          return `
          <div class="wk-task-item${task.done ? ' done' : ''}" draggable="true"
            ondragstart="weeklyDragStart(event,${i},${ti})"
            ondragend="weeklyDragEnd(event)">
            <span class="wk-task-handle">⠿</span>
            <div class="wk-task-dot" style="background:${tc.hex}"></div>
            <div class="wk-task-chk${task.done ? ' checked' : ''}" onclick="weeklyToggleTask(${i},${ti})"></div>
            <span class="wk-task-name">${task.name}</span>
            <span class="wk-task-del" onclick="weeklyDeleteTask(${i},${ti})">✕</span>
          </div>`;
        }).join('');

    return `
    <div class="wk-day-block${isToday ? ' today' : ''}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="weeklyDrop(event,${i})">
      <div class="wk-day-header">
        <span class="wk-day-name">${dayNames[i]}</span>
        <span class="wk-day-date">${dateStr}</span>
        <span class="wk-focus-badge" onclick="weeklyToggleFocus(event,${i})">${focus || '+ Focus'}</span>
        <span class="wk-task-count">${tasks.length > 0 ? doneCount + '/' + tasks.length : ''}</span>
        <span class="wk-day-add" onclick="weeklyToggleDayForm(${i})">+ Task</span>
        <div class="wk-focus-popup" id="wkFocusPopup${i}">
          <input type="text" id="wkFocusInput${i}" value="${focus}" placeholder="Focus area..."
            onkeydown="if(event.key==='Enter')weeklySaveFocus(${i});if(event.key==='Escape')weeklyCloseFocus(${i})" />
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="wk-btn-cancel" onclick="weeklyCloseFocus(${i})">Cancel</button>
            <button class="wk-btn-save" onclick="weeklySaveFocus(${i})">Save</button>
          </div>
        </div>
      </div>
      <div class="wk-day-body" id="wkDayBody${i}">
        ${tasksHtml}
        <div class="wk-day-form" id="wkDayForm${i}">
          <input type="text" id="wkDayInput${i}" placeholder="New task..."
            onkeydown="if(event.key==='Enter')weeklyAddTask(${i});if(event.key==='Escape')weeklyToggleDayForm(${i})" />
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;">
            <div class="wk-swatches" id="wkSwatches${i}">
              ${COLORS.map(c => `<div class="wk-swatch" style="background:${c.hex}" data-color="${c.id}" onclick="weeklyPickColor(${i},'${c.id}',this)"></div>`).join('')}
            </div>
            <button class="wk-btn-cancel" onclick="weeklyToggleDayForm(${i})">Cancel</button>
            <button class="wk-btn-save" onclick="weeklyAddTask(${i})">Add</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // ── Color swatches for obj form ──────────────────────────────────────────
  const objSwatches = COLORS.map(c =>
    `<div class="wk-swatch lg" style="background:${c.hex}" data-color="${c.id}" onclick="weeklyPickObjColor('${c.id}',this)"></div>`
  ).join('');

  return `
<style>
  #wk-root *{box-sizing:border-box;margin:0;padding:0;}
  #wk-root{padding:0 0 40px;font-family:inherit;}

  /* Header */
  #wk-root .wk-eyebrow{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;}
  #wk-root .wk-title{font-family:'Bebas Neue','Impact',sans-serif;font-size:34px;color:#1a1917;letter-spacing:.06em;line-height:1;margin-bottom:4px;}
  #wk-root .wk-nav-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
  #wk-root .wk-week-nav{display:flex;gap:6px;}
  #wk-root .wk-nav-btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;border:1px solid #e5e3dc;background:#fff;padding:5px 12px;border-radius:5px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-nav-btn:hover{color:#C9A84C;border-color:#e8d9a8;}

  /* Progress */
  #wk-root .wk-progress{display:flex;align-items:center;gap:10px;margin-bottom:22px;}
  #wk-root .wk-prog-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;}
  #wk-root .wk-prog-track{flex:1;height:4px;background:#e5e3dc;border-radius:2px;overflow:hidden;}
  #wk-root .wk-prog-fill{height:100%;background:#C9A84C;border-radius:2px;transition:width .3s ease;}
  #wk-root .wk-prog-count{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#C9A84C;min-width:30px;text-align:right;}

  /* Section header */
  #wk-root .wk-sec{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #e5e3dc;margin-bottom:10px;}
  #wk-root .wk-sec-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#6b6860;text-transform:uppercase;letter-spacing:.12em;}
  #wk-root .wk-sec-btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;border:1px solid #e5e3dc;background:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-sec-btn:hover{color:#C9A84C;border-color:#e8d9a8;background:#f5edda;}

  /* Objectives */
  #wk-root .wk-obj-list{display:flex;flex-direction:column;gap:4px;margin-bottom:22px;}
  #wk-root .wk-obj-row{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border-radius:8px;background:#fff;border:1px solid #e5e3dc;position:relative;transition:box-shadow .12s;}
  #wk-root .wk-obj-row:hover{box-shadow:0 1px 5px rgba(0,0,0,.07);}
  #wk-root .wk-obj-row.done{opacity:.45;}
  #wk-root .wk-obj-bar{width:4px;border-radius:2px;align-self:stretch;flex-shrink:0;min-height:20px;}
  #wk-root .wk-obj-chk{width:18px;height:18px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:all .15s;background:#fff;}
  #wk-root .wk-obj-chk.checked::after{content:'';width:9px;height:5px;border-left:1.5px solid #fff;border-bottom:1.5px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-obj-body{flex:1;min-width:0;}
  #wk-root .wk-obj-name{font-size:15px;font-weight:600;color:#1a1917;line-height:1.4;}
  #wk-root .wk-obj-row.done .wk-obj-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-obj-tag{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.08em;margin-top:5px;display:inline-block;}
  #wk-root .wk-obj-del{font-size:13px;color:#aaa89f;cursor:pointer;opacity:0;padding:2px 5px;border-radius:3px;transition:all .1s;margin-top:2px;}
  #wk-root .wk-obj-row:hover .wk-obj-del{opacity:1;}
  #wk-root .wk-obj-del:hover{color:#c0392b;background:#fdf0ef;}
  #wk-root .wk-empty{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;padding:8px 4px;text-transform:uppercase;letter-spacing:.08em;}

  /* Add objective form */
  #wk-root .wk-obj-form{display:none;background:#fff;border:1px solid #e5e3dc;border-radius:10px;padding:14px;margin-bottom:10px;}
  #wk-root .wk-obj-form.open{display:block;}
  #wk-root .wk-obj-form input[type=text]{width:100%;border:1px solid #e5e3dc;border-radius:7px;padding:9px 12px;font-size:15px;font-weight:500;font-family:inherit;color:#1a1917;background:#f7f6f2;outline:none;margin-bottom:10px;}
  #wk-root .wk-obj-form input[type=text]:focus{border-color:#C9A84C;}
  #wk-root .wk-form-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;}
  #wk-root .wk-form-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;}

  /* Swatches */
  #wk-root .wk-swatches{display:flex;gap:6px;align-items:center;}
  #wk-root .wk-swatch{width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s;flex-shrink:0;}
  #wk-root .wk-swatch:hover{transform:scale(1.15);}
  #wk-root .wk-swatch.selected{border-color:#1a1917;}
  #wk-root .wk-swatch.lg{width:24px;height:24px;}

  /* Buttons */
  #wk-root .wk-btn-save{background:#C9A84C;color:#fff;border:none;border-radius:7px;padding:8px 18px;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;cursor:pointer;}
  #wk-root .wk-btn-save:hover{opacity:.85;}
  #wk-root .wk-btn-cancel{background:none;border:1px solid #e5e3dc;color:#aaa89f;border-radius:7px;padding:8px 14px;font-family:'DM Mono',monospace;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.1em;cursor:pointer;}
  #wk-root .wk-btn-cancel:hover{background:#f2f1ed;}
  #wk-root .wk-tag-input{flex:1;border:1px solid #e5e3dc;border-radius:7px;padding:7px 10px;font-size:13px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1917;background:#f7f6f2;outline:none;min-width:80px;}
  #wk-root .wk-tag-input:focus{border-color:#C9A84C;}

  /* Days */
  #wk-root .wk-day-grid{display:flex;flex-direction:column;gap:6px;}
  #wk-root .wk-day-block{background:#fff;border:1px solid #e5e3dc;border-radius:12px;overflow:visible;transition:box-shadow .15s;position:relative;}
  #wk-root .wk-day-block.today{border-color:#b6e4c8;background:#eaf7ef;}
  #wk-root .wk-day-block.drag-over{box-shadow:0 0 0 2px #C9A84C;border-color:#C9A84C;}

  #wk-root .wk-day-header{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #e5e3dc;user-select:none;position:relative;}
  #wk-root .wk-day-block.today .wk-day-header{border-bottom-color:#b6e4c8;}
  #wk-root .wk-day-name{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:#4a4845;text-transform:uppercase;letter-spacing:.1em;width:36px;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-name{color:#2a7a4b;}
  #wk-root .wk-day-date{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-date{color:#4a9c6a;}
  #wk-root .wk-focus-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;background:#f2f1ed;padding:3px 10px;border-radius:3px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;transition:all .1s;}
  #wk-root .wk-day-block.today .wk-focus-badge{background:rgba(42,122,75,.12);color:#2a7a4b;}
  #wk-root .wk-focus-badge:hover{background:#f5edda;color:#C9A84C;}
  #wk-root .wk-task-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;margin-left:auto;}
  #wk-root .wk-day-add{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;cursor:pointer;padding:3px 8px;border-radius:3px;transition:all .1s;}
  #wk-root .wk-day-add:hover{color:#C9A84C;background:#f5edda;}

  /* Focus popup */
  #wk-root .wk-focus-popup{display:none;position:absolute;background:#fff;border:1px solid #e5e3dc;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);padding:10px;z-index:200;top:42px;left:50px;min-width:180px;}
  #wk-root .wk-focus-popup.open{display:block;}
  #wk-root .wk-focus-popup input{width:100%;border:1px solid #e5e3dc;border-radius:5px;padding:6px 10px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;outline:none;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-focus-popup input:focus{border-color:#C9A84C;}

  /* Day body & tasks */
  #wk-root .wk-day-body{padding:8px 14px 12px;display:flex;flex-direction:column;gap:4px;}
  #wk-root .wk-day-empty{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;padding:4px 6px;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-task-item{display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:7px;border:1px solid transparent;cursor:grab;transition:background .1s;}
  #wk-root .wk-task-item:hover{background:#f2f1ed;border-color:#e5e3dc;}
  #wk-root .wk-task-item.dragging{opacity:.4;cursor:grabbing;}
  #wk-root .wk-task-handle{font-size:13px;color:#aaa89f;opacity:0;cursor:grab;line-height:1;padding:0 2px;}
  #wk-root .wk-task-item:hover .wk-task-handle{opacity:1;}
  #wk-root .wk-task-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  #wk-root .wk-task-chk{width:16px;height:16px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff;transition:all .15s;}
  #wk-root .wk-task-chk.checked{background:#C9A84C;border-color:#C9A84C;}
  #wk-root .wk-task-chk.checked::after{content:'';width:8px;height:5px;border-left:1.5px solid #fff;border-bottom:1.5px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-task-name{flex:1;font-size:14px;font-weight:500;color:#1a1917;min-width:0;}
  #wk-root .wk-task-item.done .wk-task-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-task-del{font-size:12px;color:#aaa89f;opacity:0;cursor:pointer;padding:2px 5px;border-radius:3px;transition:all .1s;}
  #wk-root .wk-task-item:hover .wk-task-del{opacity:1;}
  #wk-root .wk-task-del:hover{color:#c0392b;background:#fdf0ef;}

  /* Inline add form */
  #wk-root .wk-day-form{display:none;padding:8px 10px;background:#f7f6f2;border-radius:7px;border:1px solid #e5e3dc;margin-top:4px;}
  #wk-root .wk-day-form.open{display:block;}
  #wk-root .wk-day-form input[type=text]{width:100%;border:none;background:transparent;font-size:14px;font-weight:500;font-family:inherit;color:#1a1917;outline:none;margin-bottom:2px;}
  #wk-root .wk-day-form input::placeholder{color:#aaa89f;}

  /* Divider */
  #wk-root .wk-divider{height:1px;background:#e5e3dc;margin:20px 0;}
</style>

<div id="wk-root">

  <div class="wk-nav-row">
    <div>
      <div class="wk-eyebrow">Week ${weekNum}</div>
      <div class="wk-title">${monStr} – ${sunStr}</div>
    </div>
    <div class="wk-week-nav">
      <button class="wk-nav-btn" onclick="weeklyShift(-1)">← Prev</button>
      <button class="wk-nav-btn" onclick="weeklyShift(1)">Next →</button>
    </div>
  </div>

  <div class="wk-progress">
    <span class="wk-prog-label">Objectives</span>
    <div class="wk-prog-track"><div class="wk-prog-fill" style="width:${pct}%"></div></div>
    <span class="wk-prog-count">${done}/${objs.length}</span>
  </div>

  <!-- OBJECTIVES -->
  <div class="wk-sec">
    <span class="wk-sec-label">Weekly Objectives</span>
    <button class="wk-sec-btn" onclick="weeklyToggleObjForm()">+ Add</button>
  </div>

  <div class="wk-obj-form" id="wkObjForm">
    <input type="text" id="wkObjInput" placeholder="Objective..." />
    <div class="wk-form-label">Colour</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;" id="wkObjSwatches">${objSwatches}</div>
    <div class="wk-form-row">
      <input type="text" class="wk-tag-input" id="wkObjTag" placeholder="Tag (e.g. Health)" />
      <button class="wk-btn-cancel" onclick="weeklyToggleObjForm()">Cancel</button>
      <button class="wk-btn-save" onclick="weeklySaveObj()">Save</button>
    </div>
  </div>

  <div class="wk-obj-list">${objsHtml}</div>

  <div class="wk-divider"></div>

  <!-- WEEKLY PLAN -->
  <div class="wk-sec" style="margin-bottom:12px;">
    <span class="wk-sec-label">Weekly Plan</span>
  </div>

  <div class="wk-day-grid">${daysHtml}</div>

</div>

<script>
(function(){

  const WK_COLORS = [
    {id:'gold',hex:'#C9A84C'},{id:'green',hex:'#4caf7d'},{id:'blue',hex:'#5b8dd9'},
    {id:'red',hex:'#d95b5b'},{id:'purple',hex:'#9b59b6'},{id:'orange',hex:'#e07b39'},
    {id:'teal',hex:'#1abc9c'},{id:'gray',hex:'#aaa89f'},
  ];

  if (!window._weeklyOffset) window._weeklyOffset = 0;
  if (!window._weeklyObjColor) window._weeklyObjColor = 'gold';
  if (!window._weeklyDayColors) window._weeklyDayColors = {};
  if (!window._weeklyDrag) window._weeklyDrag = null;

  function getISOWeek(d){
    const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
    const y=new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date-y)/86400000)+1)/7);
  }
  function getMonday(offset){
    const d=new Date();d.setHours(0,0,0,0);
    d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1)+offset*7);
    return d;
  }
  function getWeekKey(offset){
    const m=getMonday(offset);
    return m.getFullYear()+'-W'+String(getISOWeek(m)).padStart(2,'0');
  }
  function loadAll(){ try{return JSON.parse(localStorage.getItem('weekly_state')||'{}')}catch{return{}} }
  function saveAll(all){ localStorage.setItem('weekly_state',JSON.stringify(all)); }
  function getWS(){ const a=loadAll(),k=getWeekKey(window._weeklyOffset); if(!a[k])a[k]={objectives:[],days:[{},{},{},{},{},{},{}]};while(a[k].days.length<7)a[k].days.push({});return a[k]; }
  function saveWS(ws){ const a=loadAll(); a[getWeekKey(window._weeklyOffset)]=ws; saveAll(a); }

  // Expose all functions globally so onclick handlers work
  window.weeklyShift = function(dir){ window._weeklyOffset=(window._weeklyOffset||0)+dir; if(typeof setTab==='function')setTab('planner'); else window.location.reload(); };

  window.weeklyToggleObjForm = function(){
    const f=document.getElementById('wkObjForm');
    if(!f)return;
    const open=f.classList.toggle('open');
    if(open){document.getElementById('wkObjInput').focus();}
    else{document.getElementById('wkObjInput').value='';document.getElementById('wkObjTag').value='';}
  };

  window.weeklyPickObjColor = function(colorId, el){
    window._weeklyObjColor=colorId;
    document.querySelectorAll('#wkObjSwatches .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };

  window.weeklySaveObj = function(){
    const name=(document.getElementById('wkObjInput')?.value||'').trim();
    const tag=(document.getElementById('wkObjTag')?.value||'').trim();
    if(!name)return;
    const ws=getWS();
    ws.objectives.push({name,tag,color:window._weeklyObjColor||'gold',done:false});
    saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyToggleObj = function(i){
    const ws=getWS(); ws.objectives[i].done=!ws.objectives[i].done; saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyDeleteObj = function(i){
    const ws=getWS(); ws.objectives.splice(i,1); saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyToggleDayForm = function(dayIdx){
    const f=document.getElementById('wkDayForm'+dayIdx);
    if(!f)return;
    const open=f.classList.toggle('open');
    if(open){document.getElementById('wkDayInput'+dayIdx)?.focus();}
  };

  window.weeklyPickColor = function(dayIdx, colorId, el){
    window._weeklyDayColors[dayIdx]=colorId;
    document.querySelectorAll('#wkSwatches'+dayIdx+' .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };

  window.weeklyAddTask = function(dayIdx){
    const input=document.getElementById('wkDayInput'+dayIdx);
    const name=(input?.value||'').trim();
    if(!name)return;
    const ws=getWS();
    if(!ws.days[dayIdx].tasks)ws.days[dayIdx].tasks=[];
    ws.days[dayIdx].tasks.push({name,color:window._weeklyDayColors[dayIdx]||'gold',done:false});
    saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyToggleTask = function(dayIdx, taskIdx){
    const ws=getWS();
    ws.days[dayIdx].tasks[taskIdx].done=!ws.days[dayIdx].tasks[taskIdx].done;
    saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyDeleteTask = function(dayIdx, taskIdx){
    const ws=getWS();
    ws.days[dayIdx].tasks.splice(taskIdx,1);
    saveWS(ws);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  window.weeklyToggleFocus = function(e, dayIdx){
    e.stopPropagation();
    const popup=document.getElementById('wkFocusPopup'+dayIdx);
    if(!popup)return;
    const opening=!popup.classList.contains('open');
    document.querySelectorAll('.wk-focus-popup.open').forEach(p=>p.classList.remove('open'));
    if(opening){popup.classList.add('open');popup.querySelector('input')?.focus();}
  };

  window.weeklyCloseFocus = function(dayIdx){
    document.getElementById('wkFocusPopup'+dayIdx)?.classList.remove('open');
  };

  window.weeklySaveFocus = function(dayIdx){
    const val=(document.getElementById('wkFocusInput'+dayIdx)?.value||'').trim();
    const ws=getWS(); ws.days[dayIdx].focus=val; saveWS(ws);
    weeklyCloseFocus(dayIdx);
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  // Drag & drop
  window.weeklyDragStart = function(e, dayIdx, taskIdx){
    window._weeklyDrag={fromDay:dayIdx,taskIndex:taskIdx};
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
  };
  window.weeklyDragEnd = function(e){ e.target.classList.remove('dragging'); };
  window.weeklyDrop = function(e, toDay){
    e.preventDefault();
    const el=e.currentTarget; el.classList.remove('drag-over');
    const drag=window._weeklyDrag; if(!drag)return;
    const {fromDay,taskIndex}=drag;
    if(fromDay===toDay){window._weeklyDrag=null;return;}
    const ws=getWS();
    const task=ws.days[fromDay].tasks.splice(taskIndex,1)[0];
    if(!ws.days[toDay].tasks)ws.days[toDay].tasks=[];
    ws.days[toDay].tasks.push(task);
    saveWS(ws); window._weeklyDrag=null;
    if(typeof setTab==='function')setTab('planner'); else window.location.reload();
  };

  // Close focus popups when clicking outside
  document.addEventListener('click',function(e){
    document.querySelectorAll('.wk-focus-popup.open').forEach(p=>{
      if(!p.contains(e.target)&&!e.target.classList.contains('wk-focus-badge'))p.classList.remove('open');
    });
  });

  // Mark first swatch as selected by default
  const firstObjSwatch=document.querySelector('#wkObjSwatches .wk-swatch');
  if(firstObjSwatch)firstObjSwatch.classList.add('selected');

})();
<\/script>
`;
}
