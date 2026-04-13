// renderWeeklyTab.js — 📅 Weekly Planner Tab

const WK_COLORS = [
  { id: 'gold',   hex: '#C9A84C' },
  { id: 'green',  hex: '#4caf7d' },
  { id: 'blue',   hex: '#5b8dd9' },
  { id: 'red',    hex: '#d95b5b' },
  { id: 'purple', hex: '#9b59b6' },
  { id: 'orange', hex: '#e07b39' },
  { id: 'teal',   hex: '#1abc9c' },
  { id: 'gray',   hex: '#aaa89f' },
];

function wkGetISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const y = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - y) / 86400000) + 1) / 7);
}
function wkGetMonday(offset) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) + (offset || 0) * 7);
  return d;
}
function wkGetKey(offset) {
  const m = wkGetMonday(offset);
  return m.getFullYear() + '-W' + String(wkGetISOWeek(m)).padStart(2, '0');
}
function wkLoadAll() { try { return JSON.parse(localStorage.getItem('weekly_state') || '{}'); } catch { return {}; } }
function wkSaveAll(all) { localStorage.setItem('weekly_state', JSON.stringify(all)); }
function wkGetWS(offset) {
  const a = wkLoadAll(), k = wkGetKey(offset);
  if (!a[k]) a[k] = { objectives: [], days: [{},{},{},{},{},{},{}] };
  while (a[k].days.length < 7) a[k].days.push({});
  return a[k];
}
function wkSaveWS(ws, offset) {
  const a = wkLoadAll(); a[wkGetKey(offset)] = ws; wkSaveAll(a);
}

// Carry over unfinished objectives from previous week into current week (once only)
function wkApplyCarryOver(offset) {
  const a       = wkLoadAll();
  const thisKey = wkGetKey(offset);
  const prevKey = wkGetKey(offset - 1);
  const prevWS  = a[prevKey];
  if (!prevWS) return;
  const unfinished = (prevWS.objectives || []).filter(o => !o.done);
  if (!unfinished.length) return;
  if (!a[thisKey]) a[thisKey] = { objectives: [], days: [{},{},{},{},{},{},{}] };
  const already = (a[thisKey].objectives || []).some(o => o._carriedOver);
  if (already) return;
  const carried = unfinished.map(o => ({ ...o, done: false, _carriedOver: true }));
  a[thisKey].objectives = [...carried, ...(a[thisKey].objectives || [])];
  wkSaveAll(a);
}

export function renderWeeklyTab() {
  if (window._weeklyOffset === undefined) window._weeklyOffset = 0;
  if (!window._weeklyObjColor)  window._weeklyObjColor  = 'gold';
  if (!window._weeklyDayColors) window._weeklyDayColors = {};

  const offset = window._weeklyOffset;
  if (offset === 0) wkApplyCarryOver(0);

  const mon    = wkGetMonday(offset);
  const sun    = new Date(mon); sun.setDate(sun.getDate() + 6);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const wkNum  = wkGetISOWeek(mon);
  const DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const monStr = mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
  const sunStr = sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  const ws   = wkGetWS(offset);
  const objs = ws.objectives || [];
  const done = objs.filter(o => o.done).length;
  const pct  = objs.length ? Math.round(done / objs.length * 100) : 0;

  const objsHtml = objs.length === 0
    ? `<div class="wk-empty">No objectives yet — tap "+ Add" to get started</div>`
    : objs.map((obj, i) => {
        const c       = WK_COLORS.find(c => c.id === obj.color) || WK_COLORS[0];
        const carried = obj._carriedOver ? `<span class="wk-carried">↩ carried over</span>` : '';
        return `
        <div class="wk-obj-row${obj.done ? ' done' : ''}">
          <div class="wk-obj-bar" style="background:${c.hex}"></div>
          <div class="wk-obj-chk${obj.done ? ' checked' : ''}"
            style="${obj.done ? `background:${c.hex};border-color:${c.hex}` : ''}"
            onclick="weeklyToggleObj(${i})"></div>
          <div class="wk-obj-body">
            <div class="wk-obj-name">${obj.name}</div>
            <div class="wk-obj-meta">
              ${obj.tag ? `<span class="wk-obj-tag" style="background:${c.hex}18;color:${c.hex}">${obj.tag}</span>` : ''}
              ${carried}
            </div>
          </div>
          <div class="wk-obj-del" onclick="weeklyDeleteObj(${i})">✕</div>
        </div>`;
      }).join('');

  const daysHtml = ws.days.map((dayData, i) => {
    const date    = new Date(mon); date.setDate(date.getDate() + i);
    const isToday = date.getTime() === today.getTime();
    const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const tasks   = dayData.tasks || [];
    const focus   = dayData.focus || '';
    const doneCt  = tasks.filter(t => t.done).length;

    const tasksHtml = tasks.map((task, ti) => {
      const tc = WK_COLORS.find(c => c.id === task.color) || WK_COLORS[7];
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

    const swHtml = WK_COLORS.map(c =>
      `<div class="wk-swatch" style="background:${c.hex}" data-color="${c.id}" onclick="weeklyPickDayColor(${i},'${c.id}',this)"></div>`
    ).join('');

    return `
    <div class="wk-day-block${isToday ? ' today' : ''}"
      ondragover="event.preventDefault();this.classList.add('drag-over')"
      ondragleave="this.classList.remove('drag-over')"
      ondrop="weeklyDrop(event,${i})">
      <div class="wk-day-header">
        <span class="wk-day-name">${DAYS[i]}</span>
        <span class="wk-day-date">${dateStr}</span>
        <span class="wk-focus-badge" onclick="weeklyToggleFocus(event,${i})">${focus || '+ Focus'}</span>
        <span class="wk-task-count">${tasks.length > 0 ? doneCt + '/' + tasks.length : ''}</span>
        <span class="wk-day-add-btn" onclick="weeklyToggleDayForm(${i})">+ Task</span>
        <div class="wk-focus-popup" id="wkFocusPop${i}">
          <input type="text" id="wkFocusInp${i}" value="${(focus||'').replace(/"/g,'&quot;')}" placeholder="Focus area..."
            onkeydown="if(event.key==='Enter')weeklySaveFocus(${i});if(event.key==='Escape')weeklyCloseFocus(${i})" />
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="wk-btn-sm wk-btn-cancel" onclick="weeklyCloseFocus(${i})">Cancel</button>
            <button class="wk-btn-sm wk-btn-save" onclick="weeklySaveFocus(${i})">Save</button>
          </div>
        </div>
      </div>
      <div class="wk-day-body">
        ${tasks.length === 0 ? '<div class="wk-day-empty">No tasks</div>' : ''}
        ${tasksHtml}
        <div class="wk-day-form" id="wkDayForm${i}">
          <input class="wk-day-form-inp" type="text" id="wkDayInp${i}" placeholder="New task..."
            onkeydown="if(event.key==='Enter')weeklyAddTask(${i});if(event.key==='Escape')weeklyToggleDayForm(${i})" />
          <div class="wk-day-form-row">
            <div class="wk-swatches" id="wkDaySw${i}">${swHtml}</div>
            <button class="wk-btn-sm wk-btn-cancel" onclick="weeklyToggleDayForm(${i})">Cancel</button>
            <button class="wk-btn-sm wk-btn-save" onclick="weeklyAddTask(${i})">Add</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const objSwatches = WK_COLORS.map(c =>
    `<div class="wk-swatch lg${c.id === (window._weeklyObjColor||'gold') ? ' selected' : ''}"
      style="background:${c.hex}" data-color="${c.id}"
      onclick="weeklyPickObjColor('${c.id}',this)"></div>`
  ).join('');

  return `
<style>
  #wk-root *{box-sizing:border-box;margin:0;padding:0;}
  #wk-root{padding:0 0 40px;}
  #wk-root .wk-eyebrow{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;}
  #wk-root .wk-title{font-family:'Bebas Neue','Impact',sans-serif;font-size:34px;color:#1a1917;letter-spacing:.06em;line-height:1;margin-bottom:4px;}
  #wk-root .wk-nav-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
  #wk-root .wk-week-nav{display:flex;gap:6px;}
  #wk-root .wk-nav-btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;border:1px solid #e5e3dc;background:#fff;padding:8px 14px;border-radius:6px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;-webkit-tap-highlight-color:transparent;min-height:40px;}
  #wk-root .wk-nav-btn:active{background:#f5edda;color:#C9A84C;}
  #wk-root .wk-progress{display:flex;align-items:center;gap:10px;margin-bottom:22px;}
  #wk-root .wk-prog-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;}
  #wk-root .wk-prog-track{flex:1;height:4px;background:#e5e3dc;border-radius:2px;overflow:hidden;}
  #wk-root .wk-prog-fill{height:100%;background:#C9A84C;border-radius:2px;}
  #wk-root .wk-prog-count{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#C9A84C;min-width:30px;text-align:right;}
  #wk-root .wk-sec{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #e5e3dc;margin-bottom:10px;}
  #wk-root .wk-sec-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#6b6860;text-transform:uppercase;letter-spacing:.12em;}
  #wk-root .wk-sec-btn{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#fff;border:none;background:#C9A84C;padding:9px 18px;border-radius:7px;cursor:pointer;text-transform:uppercase;letter-spacing:.08em;-webkit-tap-highlight-color:transparent;min-height:40px;}
  #wk-root .wk-sec-btn:active{opacity:.8;}
  #wk-root .wk-obj-list{display:flex;flex-direction:column;gap:4px;margin-bottom:22px;}
  #wk-root .wk-obj-row{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:8px;background:#fff;border:1px solid #e5e3dc;position:relative;}
  #wk-root .wk-obj-row.done{opacity:.45;}
  #wk-root .wk-obj-bar{width:4px;border-radius:2px;align-self:stretch;flex-shrink:0;min-height:22px;}
  #wk-root .wk-obj-chk{width:24px;height:24px;min-width:24px;border-radius:5px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:1px;background:#fff;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-obj-chk.checked::after{content:'';width:11px;height:6px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-obj-body{flex:1;min-width:0;}
  #wk-root .wk-obj-name{font-size:15px;font-weight:600;color:#1a1917;line-height:1.4;}
  #wk-root .wk-obj-row.done .wk-obj-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-obj-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:5px;}
  #wk-root .wk-obj-tag{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-carried{font-family:'DM Mono',monospace;font-size:9px;color:#aaa89f;font-style:italic;}
  #wk-root .wk-obj-del{font-size:16px;color:#aaa89f;cursor:pointer;padding:4px 8px;border-radius:4px;-webkit-tap-highlight-color:transparent;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;}
  #wk-root .wk-obj-del:active{color:#c0392b;background:#fdf0ef;}
  #wk-root .wk-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:8px 4px;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-obj-form{display:none;background:#fff;border:1px solid #e5e3dc;border-radius:10px;padding:14px;margin-bottom:10px;}
  #wk-root .wk-obj-form.open{display:block;}
  #wk-root .wk-form-inp{width:100%;border:1px solid #e5e3dc;border-radius:7px;padding:10px 12px;font-size:15px;font-weight:500;font-family:inherit;color:#1a1917;background:#f7f6f2;outline:none;margin-bottom:12px;-webkit-appearance:none;}
  #wk-root .wk-form-inp:focus{border-color:#C9A84C;}
  #wk-root .wk-form-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;display:block;}
  #wk-root .wk-form-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;}
  #wk-root .wk-tag-inp{flex:1;border:1px solid #e5e3dc;border-radius:7px;padding:9px 10px;font-size:13px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1917;background:#f7f6f2;outline:none;min-width:80px;-webkit-appearance:none;}
  #wk-root .wk-tag-inp:focus{border-color:#C9A84C;}
  #wk-root .wk-swatches{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
  #wk-root .wk-swatch{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;-webkit-tap-highlight-color:transparent;flex-shrink:0;}
  #wk-root .wk-swatch.lg{width:28px;height:28px;}
  #wk-root .wk-swatch.selected{border-color:#1a1917;}
  #wk-root .wk-btn-save{background:#C9A84C;color:#fff;border:none;border-radius:7px;padding:10px 20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-save:active{opacity:.8;}
  #wk-root .wk-btn-cancel{background:none;border:1px solid #e5e3dc;color:#aaa89f;border-radius:7px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.1em;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-cancel:active{background:#f2f1ed;}
  #wk-root .wk-btn-sm{padding:7px 12px !important;min-height:34px !important;font-size:10px !important;border-radius:5px !important;}
  #wk-root .wk-day-grid{display:flex;flex-direction:column;gap:6px;}
  #wk-root .wk-day-block{background:#fff;border:1px solid #e5e3dc;border-radius:12px;overflow:visible;position:relative;}
  #wk-root .wk-day-block.today{border-color:#b6e4c8;background:#eaf7ef;}
  #wk-root .wk-day-block.drag-over{box-shadow:0 0 0 2px #C9A84C;border-color:#C9A84C;}
  #wk-root .wk-day-header{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #e5e3dc;position:relative;}
  #wk-root .wk-day-block.today .wk-day-header{border-bottom-color:#b6e4c8;}
  #wk-root .wk-day-name{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:#4a4845;text-transform:uppercase;letter-spacing:.1em;width:34px;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-name{color:#2a7a4b;}
  #wk-root .wk-day-date{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-date{color:#4a9c6a;}
  #wk-root .wk-focus-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;background:#f2f1ed;padding:5px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-focus-badge{background:rgba(42,122,75,.12);color:#2a7a4b;}
  #wk-root .wk-task-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;margin-left:auto;flex-shrink:0;}
  #wk-root .wk-day-add-btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#fff;background:#C9A84C;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;min-height:32px;}
  #wk-root .wk-day-add-btn:active{opacity:.8;}
  #wk-root .wk-focus-popup{display:none;position:absolute;background:#fff;border:1px solid #e5e3dc;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.12);padding:12px;z-index:300;top:46px;left:14px;min-width:200px;max-width:270px;}
  #wk-root .wk-focus-popup.open{display:block;}
  #wk-root .wk-focus-popup input{width:100%;border:1px solid #e5e3dc;border-radius:5px;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;outline:none;text-transform:uppercase;letter-spacing:.08em;-webkit-appearance:none;}
  #wk-root .wk-focus-popup input:focus{border-color:#C9A84C;}
  #wk-root .wk-day-body{padding:8px 14px 12px;display:flex;flex-direction:column;gap:4px;}
  #wk-root .wk-day-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:4px 6px;text-transform:uppercase;letter-spacing:.08em;}
  #wk-root .wk-task-item{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:7px;border:1px solid transparent;cursor:grab;}
  #wk-root .wk-task-item:active{background:#f2f1ed;}
  #wk-root .wk-task-item.dragging{opacity:.4;}
  #wk-root .wk-task-handle{font-size:13px;color:#aaa89f;line-height:1;padding:0 2px;cursor:grab;}
  #wk-root .wk-task-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  #wk-root .wk-task-chk{width:20px;height:20px;min-width:20px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-task-chk.checked{background:#C9A84C;border-color:#C9A84C;}
  #wk-root .wk-task-chk.checked::after{content:'';width:9px;height:5px;border-left:1.5px solid #fff;border-bottom:1.5px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-task-name{flex:1;font-size:14px;font-weight:500;color:#1a1917;min-width:0;}
  #wk-root .wk-task-item.done .wk-task-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-task-del{font-size:15px;color:#aaa89f;cursor:pointer;padding:4px 6px;-webkit-tap-highlight-color:transparent;min-width:30px;min-height:30px;display:flex;align-items:center;justify-content:center;border-radius:4px;}
  #wk-root .wk-task-del:active{color:#c0392b;background:#fdf0ef;}
  #wk-root .wk-day-form{display:none;padding:10px;background:#f7f6f2;border-radius:7px;border:1px solid #e5e3dc;margin-top:4px;}
  #wk-root .wk-day-form.open{display:block;}
  #wk-root .wk-day-form-inp{width:100%;border:none;background:transparent;font-size:14px;font-weight:500;font-family:inherit;color:#1a1917;outline:none;padding:2px 0 8px;-webkit-appearance:none;}
  #wk-root .wk-day-form-inp::placeholder{color:#aaa89f;}
  #wk-root .wk-day-form-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
  #wk-root .wk-divider{height:1px;background:#e5e3dc;margin:20px 0;}
</style>

<div id="wk-root">
  <div class="wk-nav-row">
    <div>
      <div class="wk-eyebrow">Week ${wkNum}</div>
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
      <button class="wk-btn-save" onclick="weeklySaveObj()">Save</button>
    </div>
  </div>
  <div class="wk-obj-list">${objsHtml}</div>
  <div class="wk-divider"></div>
  <div class="wk-sec" style="margin-bottom:12px;">
    <span class="wk-sec-label">Weekly Plan</span>
  </div>
  <div class="wk-day-grid">${daysHtml}</div>
</div>`;
}

// All window functions defined here — called by app.js after render
// (innerHTML does not execute <script> tags, so we init from outside)
export function initWeeklyTab() {
  if (window._weeklyOffset === undefined) window._weeklyOffset = 0;
  if (!window._weeklyObjColor)  window._weeklyObjColor  = 'gold';
  if (!window._weeklyDayColors) window._weeklyDayColors = {};
  if (!window._weeklyDrag)      window._weeklyDrag      = null;

  const rerender = () => { if (typeof setTab === 'function') setTab('planner'); };

  window.weeklyShift = (dir) => { window._weeklyOffset = (window._weeklyOffset||0) + dir; rerender(); };

  window.weeklyToggleObjForm = () => {
    const f = document.getElementById('wkObjForm'); if (!f) return;
    const opening = !f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) document.getElementById('wkObjInput')?.focus();
    else { document.getElementById('wkObjInput').value=''; document.getElementById('wkObjTag').value=''; }
  };

  window.weeklyPickObjColor = (colorId, el) => {
    window._weeklyObjColor = colorId;
    document.querySelectorAll('#wkObjSwatches .wk-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
  };

  window.weeklySaveObj = () => {
    const name = (document.getElementById('wkObjInput')?.value||'').trim();
    const tag  = (document.getElementById('wkObjTag')?.value||'').trim();
    if (!name) return;
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives.push({ name, tag, color: window._weeklyObjColor||'gold', done: false });
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyToggleObj = (i) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives[i].done = !ws.objectives[i].done;
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyDeleteObj = (i) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.objectives.splice(i, 1);
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyToggleDayForm = (dayIdx) => {
    const f = document.getElementById('wkDayForm' + dayIdx); if (!f) return;
    const opening = !f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) document.getElementById('wkDayInp' + dayIdx)?.focus();
  };

  window.weeklyPickDayColor = (dayIdx, colorId, el) => {
    window._weeklyDayColors[dayIdx] = colorId;
    document.querySelectorAll('#wkDaySw' + dayIdx + ' .wk-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
  };

  window.weeklyAddTask = (dayIdx) => {
    const name = (document.getElementById('wkDayInp' + dayIdx)?.value||'').trim();
    if (!name) return;
    const ws = wkGetWS(window._weeklyOffset);
    if (!ws.days[dayIdx].tasks) ws.days[dayIdx].tasks = [];
    ws.days[dayIdx].tasks.push({ name, color: window._weeklyDayColors[dayIdx]||'gold', done: false });
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyToggleTask = (dayIdx, taskIdx) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks[taskIdx].done = !ws.days[dayIdx].tasks[taskIdx].done;
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyDeleteTask = (dayIdx, taskIdx) => {
    const ws = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks.splice(taskIdx, 1);
    wkSaveWS(ws, window._weeklyOffset); rerender();
  };

  window.weeklyToggleFocus = (e, dayIdx) => {
    e.stopPropagation();
    const popup = document.getElementById('wkFocusPop' + dayIdx); if (!popup) return;
    const opening = !popup.classList.contains('open');
    document.querySelectorAll('.wk-focus-popup.open').forEach(p => p.classList.remove('open'));
    if (opening) { popup.classList.add('open'); popup.querySelector('input')?.focus(); }
  };

  window.weeklyCloseFocus = (dayIdx) => {
    document.getElementById('wkFocusPop' + dayIdx)?.classList.remove('open');
  };

  window.weeklySaveFocus = (dayIdx) => {
    const val = (document.getElementById('wkFocusInp' + dayIdx)?.value||'').trim();
    const ws  = wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].focus = val;
    wkSaveWS(ws, window._weeklyOffset);
    weeklyCloseFocus(dayIdx); rerender();
  };

  window.weeklyDragStart = (e, dayIdx, taskIdx) => {
    window._weeklyDrag = { fromDay: dayIdx, taskIndex: taskIdx };
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  };

  window.weeklyDragEnd = (e) => { e.target.classList.remove('dragging'); };

  window.weeklyDrop = (e, toDay) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const drag = window._weeklyDrag; if (!drag) return;
    const { fromDay, taskIndex } = drag;
    if (fromDay === toDay) { window._weeklyDrag = null; return; }
    const ws   = wkGetWS(window._weeklyOffset);
    const task = ws.days[fromDay].tasks.splice(taskIndex, 1)[0];
    if (!ws.days[toDay].tasks) ws.days[toDay].tasks = [];
    ws.days[toDay].tasks.push(task);
    wkSaveWS(ws, window._weeklyOffset);
    window._weeklyDrag = null; rerender();
  };
}
