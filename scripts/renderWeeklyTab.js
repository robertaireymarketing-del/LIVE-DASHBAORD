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

// ── Shared swatch builder ─────────────────────────────────────────────────
function wkSwatchesHtml(selected, onclick) {
  return WK_COLORS.map(c =>
    `<div class="wk-swatch${c.id===selected?' selected':''}" style="background:${c.hex}"
      data-color="${c.id}" onclick="${onclick}('${c.id}',this)"></div>`
  ).join('');
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

  // ── Objectives ────────────────────────────────────────────────────────────
  const objsHtml = objs.length===0
    ? `<div class="wk-empty">No objectives yet — tap "+ Add" to get started</div>`
    : objs.map((obj,i) => {
        const c=WK_COLORS.find(c=>c.id===obj.color)||WK_COLORS[0];
        return `
        <div class="wk-obj-row${obj.done?' done':''}" id="wkObjRow${i}">
          <div class="wk-obj-bar" style="background:${c.hex}"></div>
          <div class="wk-obj-chk${obj.done?' checked':''}"
            style="${obj.done?`background:${c.hex};border-color:${c.hex}`:''}"
            onclick="weeklyToggleObj(${i})"></div>
          <div class="wk-obj-body">
            <div class="wk-obj-name">${obj.name}</div>
            <div class="wk-obj-meta">
              ${obj.tag?`<span class="wk-obj-tag" style="background:${c.hex}18;color:${c.hex}">${obj.tag}</span>`:''}
              ${obj._carriedOver?`<span class="wk-carried">↩ carried over</span>`:''}
            </div>
          </div>
          <div class="wk-obj-actions">
            <div class="wk-obj-edit" onclick="weeklyStartEditObj(${i})">✎</div>
            <div class="wk-obj-del"  onclick="weeklyDeleteObj(${i})">✕</div>
          </div>
        </div>`;
      }).join('');

  // ── Days ──────────────────────────────────────────────────────────────────
  const daysHtml = ws.days.map((dayData,i) => {
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
        <span class="wk-task-name">${task.name}</span>
        <span class="wk-task-edit" onclick="weeklyStartEditTask(${i},${ti})">✎</span>
        <span class="wk-task-del"  onclick="weeklyDeleteTask(${i},${ti})">✕</span>
      </div>`;
    };

    // Split into AM / PM (tasks without period default to 'am')
    const amTasks = tasks.map((t,ti)=>({t,ti})).filter(({t})=>(t.period||'am')==='am');
    const pmTasks = tasks.map((t,ti)=>({t,ti})).filter(({t})=>t.period==='pm');

    const amHtml  = amTasks.map(({t,ti})=>renderTaskItem(t,ti)).join('');
    const pmHtml  = pmTasks.map(({t,ti})=>renderTaskItem(t,ti)).join('');

    const swHtml=WK_COLORS.map(c=>
      `<div class="wk-swatch" style="background:${c.hex}" data-color="${c.id}"
        onclick="weeklyPickDayColor(${i},'${c.id}',this)"></div>`
    ).join('');

    return `
    <div class="wk-day-block${isToday?' today':''}" id="wkDay${i}">
      <div class="wk-day-header">
        <span class="wk-day-name">${DAYS[i]}</span>
        <span class="wk-day-date">${dateStr}</span>
        <span class="wk-focus-badge" onclick="weeklyToggleFocus(event,${i})">${focus||'+ Focus'}</span>
        <span class="wk-task-count">${tasks.length>0?doneCt+'/'+tasks.length:''}</span>
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
      <div class="wk-day-body" id="wkBody${i}">

        <!-- AM drop zone -->
        <div class="wk-period-zone" id="wkZoneAM${i}" data-day="${i}" data-period="am"
          ondragover="event.preventDefault();weeklyZoneDragOver(event,${i},'am')"
          ondragleave="weeklyZoneDragLeave(${i},'am')"
          ondrop="weeklyZoneDrop(event,${i},'am')">
          <div class="wk-period-header">AM</div>
          ${amTasks.length===0?'<div class="wk-day-empty">Nothing yet</div>':''}
          ${amHtml}
        </div>

        <!-- PM drop zone -->
        <div class="wk-period-divider"><span class="wk-period-header pm">PM</span></div>
        <div class="wk-period-zone" id="wkZonePM${i}" data-day="${i}" data-period="pm"
          ondragover="event.preventDefault();weeklyZoneDragOver(event,${i},'pm')"
          ondragleave="weeklyZoneDragLeave(${i},'pm')"
          ondrop="weeklyZoneDrop(event,${i},'pm')">
          ${pmTasks.length===0?'<div class="wk-day-empty">Nothing yet</div>':''}
          ${pmHtml}
        </div>

        <!-- Add form -->
        <div class="wk-day-form" id="wkDayForm${i}">
          <input class="wk-day-form-inp" type="text" id="wkDayInp${i}" placeholder="New task..."
            onkeydown="if(event.key==='Enter')weeklyAddTask(${i});if(event.key==='Escape')weeklyToggleDayForm(${i})" />
          <div class="wk-day-form-row" style="margin-bottom:8px;">
            <button class="wk-period-toggle active" id="wkPeriodAM${i}" onclick="weeklySetPeriod(${i},'am',this)">AM</button>
            <button class="wk-period-toggle" id="wkPeriodPM${i}" onclick="weeklySetPeriod(${i},'pm',this)">PM</button>
            <div style="flex:1;"></div>
            <div class="wk-swatches" id="wkDaySw${i}">${swHtml}</div>
          </div>
          <div class="wk-day-form-row">
            <button class="wk-btn-sm wk-btn-cancel" onclick="weeklyToggleDayForm(${i})">Cancel</button>
            <button class="wk-btn-sm wk-btn-save" onclick="weeklyAddTask(${i})">Add</button>
          </div>
        </div>

      </div>
    </div>`;
  }).join('');

  const objSwatches=WK_COLORS.map(c=>
    `<div class="wk-swatch lg${c.id===(window._weeklyObjColor||'gold')?' selected':''}"
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
  #wk-root .wk-sec-btn{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:#fff;border:none;background:#C9A84C;padding:9px 18px;border-radius:7px;cursor:pointer;text-transform:uppercase;-webkit-tap-highlight-color:transparent;min-height:40px;}
  #wk-root .wk-sec-btn:active{opacity:.8;}

  /* Objectives */
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
  #wk-root .wk-obj-actions{display:flex;gap:4px;flex-shrink:0;align-items:flex-start;}
  #wk-root .wk-obj-edit,#wk-root .wk-obj-del{font-size:15px;color:#aaa89f;cursor:pointer;padding:4px 7px;border-radius:4px;-webkit-tap-highlight-color:transparent;min-width:30px;min-height:30px;display:flex;align-items:center;justify-content:center;}
  #wk-root .wk-obj-edit:active{color:#5b8dd9;background:#eef3fc;}
  #wk-root .wk-obj-del:active{color:#c0392b;background:#fdf0ef;}
  #wk-root .wk-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:8px 4px;text-transform:uppercase;letter-spacing:.08em;}

  /* Add/Edit obj form */
  #wk-root .wk-obj-form{display:none;background:#fff;border:1px solid #e5e3dc;border-radius:10px;padding:14px;margin-bottom:10px;}
  #wk-root .wk-obj-form.open{display:block;}
  #wk-root .wk-inline-edit{background:#f7f6f2;border:1px solid #C9A84C;border-radius:8px;padding:12px;margin-bottom:4px;}
  #wk-root .wk-form-inp{width:100%;border:1px solid #e5e3dc;border-radius:7px;padding:10px 12px;font-size:15px;font-weight:500;font-family:inherit;color:#1a1917;background:#f7f6f2;outline:none;margin-bottom:12px;-webkit-appearance:none;}
  #wk-root .wk-form-inp:focus{border-color:#C9A84C;}
  #wk-root .wk-form-label{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;display:block;}
  #wk-root .wk-form-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px;}
  #wk-root .wk-tag-inp{flex:1;border:1px solid #e5e3dc;border-radius:7px;padding:9px 10px;font-size:13px;font-weight:500;font-family:'DM Mono',monospace;color:#1a1917;background:#f7f6f2;outline:none;min-width:80px;-webkit-appearance:none;}
  #wk-root .wk-tag-inp:focus{border-color:#C9A84C;}

  /* Swatches */
  #wk-root .wk-swatches{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
  #wk-root .wk-swatch{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;-webkit-tap-highlight-color:transparent;flex-shrink:0;}
  #wk-root .wk-swatch.lg{width:28px;height:28px;}
  #wk-root .wk-swatch.selected{border-color:#1a1917;}

  /* Buttons */
  #wk-root .wk-btn-save{background:#C9A84C;color:#fff;border:none;border-radius:7px;padding:10px 20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-save:active{opacity:.8;}
  #wk-root .wk-btn-cancel{background:none;border:1px solid #e5e3dc;color:#aaa89f;border-radius:7px;padding:10px 14px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:42px;}
  #wk-root .wk-btn-cancel:active{background:#f2f1ed;}
  #wk-root .wk-btn-sm{padding:7px 12px !important;min-height:34px !important;font-size:10px !important;border-radius:5px !important;}

  /* Day blocks */
  #wk-root .wk-day-grid{display:flex;flex-direction:column;gap:6px;}
  #wk-root .wk-day-block{background:#fff;border:1px solid #e5e3dc;border-radius:12px;overflow:visible;position:relative;}
  #wk-root .wk-day-block.today{border-color:#b6e4c8;background:#eaf7ef;}
  #wk-root .wk-day-block.drag-over{box-shadow:0 0 0 2.5px #C9A84C;border-color:#C9A84C;}
  #wk-root .wk-day-header{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #e5e3dc;position:relative;}
  #wk-root .wk-day-block.today .wk-day-header{border-bottom-color:#b6e4c8;}
  #wk-root .wk-day-name{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:#4a4845;text-transform:uppercase;letter-spacing:.1em;width:34px;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-name{color:#2a7a4b;}
  #wk-root .wk-day-date{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-day-date{color:#4a9c6a;}
  #wk-root .wk-focus-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;color:#aaa89f;background:#f2f1ed;padding:5px 10px;border-radius:4px;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;}
  #wk-root .wk-day-block.today .wk-focus-badge{background:rgba(42,122,75,.12);color:#2a7a4b;}
  #wk-root .wk-task-count{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#aaa89f;margin-left:auto;flex-shrink:0;}
  #wk-root .wk-day-add-btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:#fff;background:#C9A84C;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;flex-shrink:0;min-height:32px;}
  #wk-root .wk-day-add-btn:active{opacity:.8;}
  #wk-root .wk-focus-popup{display:none;position:absolute;background:#fff;border:1px solid #e5e3dc;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.12);padding:12px;z-index:300;top:46px;left:14px;min-width:200px;max-width:270px;}
  #wk-root .wk-focus-popup.open{display:block;}
  #wk-root .wk-focus-popup input{width:100%;border:1px solid #e5e3dc;border-radius:5px;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;outline:none;text-transform:uppercase;-webkit-appearance:none;}
  #wk-root .wk-focus-popup input:focus{border-color:#C9A84C;}
  #wk-root .wk-day-body{padding:8px 14px 12px;display:flex;flex-direction:column;gap:4px;}
  #wk-root .wk-day-empty{font-family:'DM Mono',monospace;font-size:11px;color:#aaa89f;padding:4px 6px;text-transform:uppercase;letter-spacing:.08em;}

  /* AM/PM zone drop targets */
  #wk-root .wk-period-zone{border-radius:6px;padding:2px;transition:background .12s,box-shadow .12s;min-height:32px;}
  #wk-root .wk-period-zone.drop-target{background:rgba(201,168,76,.08);box-shadow:inset 0 0 0 1.5px #C9A84C;}
  #wk-root .wk-period-header{font-family:'DM Mono',monospace;font-size:9px;font-weight:700;color:#aaa89f;text-transform:uppercase;letter-spacing:.14em;padding:2px 6px 4px;}
  #wk-root .wk-period-divider{display:flex;align-items:center;gap:8px;margin:6px 0 4px;}
  #wk-root .wk-period-divider::before{content:'';flex:1;height:1px;background:#e5e3dc;}
  #wk-root .wk-period-divider::after{content:'';flex:1;height:1px;background:#e5e3dc;}
  #wk-root .wk-period-header.pm{color:#aaa89f;padding:0;}
  #wk-root .wk-day-block.today .wk-period-divider::before,
  #wk-root .wk-day-block.today .wk-period-divider::after{background:#b6e4c8;}

  /* AM/PM toggle in add form */
  #wk-root .wk-period-toggle{font-family:'DM Mono',monospace;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:5px 12px;border-radius:5px;border:1px solid #e5e3dc;background:#fff;color:#aaa89f;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:30px;}
  #wk-root .wk-period-toggle.active{background:#C9A84C;border-color:#C9A84C;color:#fff;}
  #wk-root .wk-period-toggle:active{opacity:.8;}

  /* Tasks */
  #wk-root .wk-task-item{display:flex;align-items:center;gap:9px;padding:9px 8px;border-radius:7px;border:1px solid transparent;user-select:none;}
  #wk-root .wk-task-item:active{background:#f2f1ed;}
  #wk-root .wk-task-item.dragging{opacity:.35;background:#f7f6f2;}
  #wk-root .wk-task-handle{font-size:14px;color:#d8d5cc;line-height:1;padding:0 2px;cursor:grab;flex-shrink:0;}
  #wk-root .wk-task-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
  #wk-root .wk-task-chk{width:20px;height:20px;min-width:20px;border-radius:4px;border:1.5px solid #d8d5cc;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff;-webkit-tap-highlight-color:transparent;}
  #wk-root .wk-task-chk.checked{background:#C9A84C;border-color:#C9A84C;}
  #wk-root .wk-task-chk.checked::after{content:'';width:9px;height:5px;border-left:1.5px solid #fff;border-bottom:1.5px solid #fff;transform:rotate(-45deg) translateY(-1px);display:block;}
  #wk-root .wk-task-name{flex:1;font-size:14px;font-weight:500;color:#1a1917;min-width:0;}
  #wk-root .wk-task-item.done .wk-task-name{text-decoration:line-through;color:#aaa89f;}
  #wk-root .wk-task-edit,#wk-root .wk-task-del{font-size:14px;color:#d8d5cc;cursor:pointer;padding:4px 5px;-webkit-tap-highlight-color:transparent;min-width:28px;min-height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;flex-shrink:0;}
  #wk-root .wk-task-edit:active{color:#5b8dd9;background:#eef3fc;}
  #wk-root .wk-task-del:active{color:#c0392b;background:#fdf0ef;}

  /* Inline add/edit form inside day */
  #wk-root .wk-day-form{display:none;padding:10px;background:#f7f6f2;border-radius:7px;border:1px solid #e5e3dc;margin-top:4px;}
  #wk-root .wk-day-form.open{display:block;}
  #wk-root .wk-day-form-inp{width:100%;border:none;background:transparent;font-size:14px;font-weight:500;font-family:inherit;color:#1a1917;outline:none;padding:2px 0 8px;-webkit-appearance:none;}
  #wk-root .wk-day-form-inp::placeholder{color:#aaa89f;}
  #wk-root .wk-day-form-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}

  /* Touch drag ghost */
  #wk-drag-ghost{position:fixed;pointer-events:none;z-index:9999;background:#fff;border:1px solid #C9A84C;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:#1a1917;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:.92;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;}

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

// ── initWeeklyTab — called by app.js via setTimeout after each render ───────
export function initWeeklyTab() {
  if (window._weeklyOffset===undefined) window._weeklyOffset=0;
  if (!window._weeklyObjColor)  window._weeklyObjColor='gold';
  if (!window._weeklyDayColors) window._weeklyDayColors={};
  if (!window._weeklyDrag)      window._weeklyDrag=null;

  const rerender = () => { if (typeof setTab==='function') setTab('planner'); };

  // ── Week navigation ───────────────────────────────────────────────────────
  window.weeklyShift = (dir) => { window._weeklyOffset=(window._weeklyOffset||0)+dir; rerender(); };

  // ── Add objective form ────────────────────────────────────────────────────
  window.weeklyToggleObjForm = () => {
    const f=document.getElementById('wkObjForm'); if (!f) return;
    const opening=!f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) document.getElementById('wkObjInput')?.focus();
    else { document.getElementById('wkObjInput').value=''; document.getElementById('wkObjTag').value=''; }
  };
  window.weeklyPickObjColor = (colorId,el) => {
    window._weeklyObjColor=colorId;
    document.querySelectorAll('#wkObjSwatches .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };
  window.weeklySaveObj = () => {
    const name=(document.getElementById('wkObjInput')?.value||'').trim();
    const tag =(document.getElementById('wkObjTag')?.value||'').trim();
    if (!name) return;
    const ws=wkGetWS(window._weeklyOffset);
    ws.objectives.push({name,tag,color:window._weeklyObjColor||'gold',done:false});
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  // ── Edit objective inline ─────────────────────────────────────────────────
  window.weeklyStartEditObj = (i) => {
    const ws=wkGetWS(window._weeklyOffset);
    const obj=ws.objectives[i];
    if (!obj) return;
    const c=WK_COLORS.find(c=>c.id===obj.color)||WK_COLORS[0];
    const row=document.getElementById('wkObjRow'+i);
    if (!row) return;

    const swatches=WK_COLORS.map(cc=>
      `<div class="wk-swatch lg${cc.id===obj.color?' selected':''}" style="background:${cc.hex}"
        data-color="${cc.id}" onclick="wkEditObjPickColor('${cc.id}',this)"></div>`
    ).join('');

    row.innerHTML=`
      <div class="wk-obj-bar" id="wkEditBar${i}" style="background:${c.hex}"></div>
      <div class="wk-inline-edit" style="flex:1;">
        <input class="wk-form-inp" id="wkEditObjName${i}" value="${obj.name.replace(/"/g,'&quot;')}" placeholder="Objective..." style="margin-bottom:10px;" />
        <span class="wk-form-label">Colour</span>
        <div class="wk-swatches" id="wkEditObjSw${i}" style="margin-bottom:10px;">${swatches}</div>
        <input class="wk-tag-inp" id="wkEditObjTag${i}" value="${(obj.tag||'').replace(/"/g,'&quot;')}" placeholder="Tag (e.g. Health)" style="width:100%;margin-bottom:10px;" />
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="wk-btn-cancel wk-btn-sm" onclick="weeklyRerender()">Cancel</button>
          <button class="wk-btn-save wk-btn-sm" onclick="weeklySaveEditObj(${i})">Save</button>
        </div>
      </div>`;

    window._wkEditObjColor=obj.color;

    window.wkEditObjPickColor=(colorId,el)=>{
      window._wkEditObjColor=colorId;
      document.querySelectorAll(`#wkEditObjSw${i} .wk-swatch`).forEach(s=>s.classList.remove('selected'));
      el.classList.add('selected');
      const bar=document.getElementById('wkEditBar'+i);
      if (bar) bar.style.background=WK_COLORS.find(c=>c.id===colorId)?.hex||'#C9A84C';
    };

    document.getElementById('wkEditObjName'+i)?.focus();
  };

  window.weeklySaveEditObj = (i) => {
    const name=(document.getElementById('wkEditObjName'+i)?.value||'').trim();
    const tag =(document.getElementById('wkEditObjTag'+i)?.value||'').trim();
    if (!name) return;
    const ws=wkGetWS(window._weeklyOffset);
    ws.objectives[i]={...ws.objectives[i],name,tag,color:window._wkEditObjColor||ws.objectives[i].color};
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  window.weeklyRerender = () => rerender();

  // ── Objective toggle/delete ───────────────────────────────────────────────
  window.weeklyToggleObj = (i) => {
    const ws=wkGetWS(window._weeklyOffset);
    ws.objectives[i].done=!ws.objectives[i].done;
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };
  window.weeklyDeleteObj = (i) => {
    const ws=wkGetWS(window._weeklyOffset);
    ws.objectives.splice(i,1);
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  // ── Add task form ─────────────────────────────────────────────────────────
  window.weeklyToggleDayForm = (dayIdx) => {
    const f=document.getElementById('wkDayForm'+dayIdx); if (!f) return;
    const opening=!f.classList.contains('open');
    f.classList.toggle('open');
    if (opening) {
      // Reset period toggle to AM on open
      document.getElementById('wkPeriodAM'+dayIdx)?.classList.add('active');
      document.getElementById('wkPeriodPM'+dayIdx)?.classList.remove('active');
      window._weeklyDayPeriods = window._weeklyDayPeriods||{};
      window._weeklyDayPeriods[dayIdx]='am';
      document.getElementById('wkDayInp'+dayIdx)?.focus();
    }
  };
  window.weeklySetPeriod = (dayIdx, period, el) => {
    window._weeklyDayPeriods = window._weeklyDayPeriods||{};
    window._weeklyDayPeriods[dayIdx]=period;
    document.getElementById('wkPeriodAM'+dayIdx)?.classList.toggle('active', period==='am');
    document.getElementById('wkPeriodPM'+dayIdx)?.classList.toggle('active', period==='pm');
  };
  window.weeklyPickDayColor = (dayIdx,colorId,el) => {
    window._weeklyDayColors[dayIdx]=colorId;
    document.querySelectorAll('#wkDaySw'+dayIdx+' .wk-swatch').forEach(s=>s.classList.remove('selected'));
    el.classList.add('selected');
  };
  window.weeklyAddTask = (dayIdx) => {
    const name=(document.getElementById('wkDayInp'+dayIdx)?.value||'').trim();
    if (!name) return;
    const period=(window._weeklyDayPeriods||{})[dayIdx]||'am';
    const ws=wkGetWS(window._weeklyOffset);
    if (!ws.days[dayIdx].tasks) ws.days[dayIdx].tasks=[];
    ws.days[dayIdx].tasks.push({name,color:window._weeklyDayColors[dayIdx]||'gold',done:false,period});
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  // ── Edit task inline ──────────────────────────────────────────────────────
  window.weeklyStartEditTask = (dayIdx, taskIdx) => {
    const ws=wkGetWS(window._weeklyOffset);
    const task=ws.days[dayIdx]?.tasks?.[taskIdx];
    if (!task) return;

    const el=document.querySelector(`.wk-task-item[data-day="${dayIdx}"][data-task="${taskIdx}"]`);
    if (!el) return;

    const swatches=WK_COLORS.map(c=>
      `<div class="wk-swatch${c.id===task.color?' selected':''}" style="background:${c.hex}"
        data-color="${c.id}" onclick="wkEditTaskPickColor(${dayIdx},${taskIdx},'${c.id}',this)"></div>`
    ).join('');

    const period=task.period||'am';
    el.draggable=false;
    el.innerHTML=`
      <div style="flex:1;">
        <input class="wk-day-form-inp" id="wkEditTaskInp${dayIdx}_${taskIdx}"
          value="${task.name.replace(/"/g,'&quot;')}" placeholder="Task..."
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
          <button class="wk-btn-save wk-btn-sm" onclick="weeklySaveEditTask(${dayIdx},${taskIdx})">Save</button>
        </div>
      </div>`;

    window._wkEditTaskColors  = window._wkEditTaskColors||{};
    window._wkEditTaskPeriods = window._wkEditTaskPeriods||{};
    window._wkEditTaskColors[`${dayIdx}_${taskIdx}`]  = task.color;
    window._wkEditTaskPeriods[`${dayIdx}_${taskIdx}`] = period;

    window.wkEditTaskPickColor=(d,t,colorId,swEl)=>{
      window._wkEditTaskColors[`${d}_${t}`]=colorId;
      document.querySelectorAll(`#wkEditTaskSw${d}_${t} .wk-swatch`).forEach(s=>s.classList.remove('selected'));
      swEl.classList.add('selected');
    };
    window.wkEditTaskPeriod=(d,t,p,btn)=>{
      window._wkEditTaskPeriods[`${d}_${t}`]=p;
      document.getElementById(`wkEditPeriodAM${d}_${t}`)?.classList.toggle('active',p==='am');
      document.getElementById(`wkEditPeriodPM${d}_${t}`)?.classList.toggle('active',p==='pm');
    };

    document.getElementById(`wkEditTaskInp${dayIdx}_${taskIdx}`)?.focus();
  };

  window.weeklySaveEditTask = (dayIdx, taskIdx) => {
    const name=(document.getElementById(`wkEditTaskInp${dayIdx}_${taskIdx}`)?.value||'').trim();
    if (!name) return;
    const ws=wkGetWS(window._weeklyOffset);
    const key=`${dayIdx}_${taskIdx}`;
    ws.days[dayIdx].tasks[taskIdx]={
      ...ws.days[dayIdx].tasks[taskIdx],
      name,
      color:(window._wkEditTaskColors||{})[key]||ws.days[dayIdx].tasks[taskIdx].color,
      period:(window._wkEditTaskPeriods||{})[key]||ws.days[dayIdx].tasks[taskIdx].period||'am',
    };
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  // ── Task toggle/delete ────────────────────────────────────────────────────
  window.weeklyToggleTask = (dayIdx,taskIdx) => {
    const ws=wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks[taskIdx].done=!ws.days[dayIdx].tasks[taskIdx].done;
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };
  window.weeklyDeleteTask = (dayIdx,taskIdx) => {
    const ws=wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].tasks.splice(taskIdx,1);
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };

  // ── Focus badge ───────────────────────────────────────────────────────────
  window.weeklyToggleFocus = (e,dayIdx) => {
    e.stopPropagation();
    const popup=document.getElementById('wkFocusPop'+dayIdx); if (!popup) return;
    const opening=!popup.classList.contains('open');
    document.querySelectorAll('.wk-focus-popup.open').forEach(p=>p.classList.remove('open'));
    if (opening){popup.classList.add('open');popup.querySelector('input')?.focus();}
  };
  window.weeklyCloseFocus = (dayIdx) => { document.getElementById('wkFocusPop'+dayIdx)?.classList.remove('open'); };
  window.weeklySaveFocus = (dayIdx) => {
    const val=(document.getElementById('wkFocusInp'+dayIdx)?.value||'').trim();
    const ws=wkGetWS(window._weeklyOffset);
    ws.days[dayIdx].focus=val;
    wkSaveWS(ws,window._weeklyOffset);
    weeklyCloseFocus(dayIdx); rerender();
  };

  // ── Mouse drag — zone aware (AM/PM + cross-day) ───────────────────────────
  window.weeklyDragStart = (e,dayIdx,taskIdx) => {
    window._weeklyDrag={fromDay:dayIdx,taskIndex:taskIdx};
    setTimeout(()=>e.target.classList.add('dragging'),0);
    e.dataTransfer.effectAllowed='move';
  };
  window.weeklyDragEnd = (e) => {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
  };
  window.weeklyZoneDragOver = (e,dayIdx,period) => {
    e.stopPropagation();
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
    document.getElementById(`wkZone${period==='am'?'AM':'PM'}${dayIdx}`)?.classList.add('drop-target');
  };
  window.weeklyZoneDragLeave = (dayIdx,period) => {
    document.getElementById(`wkZone${period==='am'?'AM':'PM'}${dayIdx}`)?.classList.remove('drop-target');
  };
  window.weeklyZoneDrop = (e,toDay,toPeriod) => {
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.wk-period-zone.drop-target').forEach(z=>z.classList.remove('drop-target'));
    const drag=window._weeklyDrag; if (!drag) return;
    const {fromDay,taskIndex}=drag; window._weeklyDrag=null;
    const ws=wkGetWS(window._weeklyOffset);
    const task=ws.days[fromDay].tasks[taskIndex];
    if (!task) return;
    if (fromDay===toDay && task.period===toPeriod) return; // no change
    ws.days[fromDay].tasks.splice(taskIndex,1);
    if (!ws.days[toDay].tasks) ws.days[toDay].tasks=[];
    ws.days[toDay].tasks.push({...task,period:toPeriod});
    wkSaveWS(ws,window._weeklyOffset); rerender();
  };
  // keep weeklyDrop as no-op (zones handle everything)
  window.weeklyDrop = (e) => { e.preventDefault(); };

  // ── Touch drag (mobile) ───────────────────────────────────────────────────
  let touchDragData=null;
  let touchGhost=null;
  let lastHighlighted=null;

  function createGhost(name) {
    const g=document.createElement('div'); g.id='wk-drag-ghost'; g.textContent=name;
    document.body.appendChild(g); return g;
  }
  function removeGhost() { document.getElementById('wk-drag-ghost')?.remove(); touchGhost=null; }
  function clearHighlight() {
    if (lastHighlighted){lastHighlighted.classList.remove('drop-target','drag-over');lastHighlighted=null;}
  }
  function getZoneAtPoint(x,y) {
    const els=document.elementsFromPoint(x,y);
    for (const el of els) {
      if (el.classList?.contains('wk-period-zone')) return el;
      const p=el.closest?.('.wk-period-zone'); if (p) return p;
    }
    return null;
  }

  window.wkTouchStart = (e,dayIdx,taskIdx) => {
    const touch=e.touches[0];
    touchDragData={fromDay:dayIdx,taskIndex:taskIdx,startX:touch.clientX,startY:touch.clientY,active:false};
    touchDragData.timer=setTimeout(()=>{
      if (!touchDragData) return;
      const ws=wkGetWS(window._weeklyOffset);
      const task=ws.days[dayIdx]?.tasks?.[taskIdx]; if (!task) return;
      touchDragData.active=true;
      touchGhost=createGhost(task.name);
      touchGhost.style.left=(touchDragData.startX-20)+'px';
      touchGhost.style.top=(touchDragData.startY-30)+'px';
      const orig=document.querySelector(`.wk-task-item[data-day="${dayIdx}"][data-task="${taskIdx}"]`);
      if (orig) orig.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(40);
    },350);
  };

  document.addEventListener('touchmove',(e)=>{
    if (!touchDragData?.active){
      if (touchDragData){
        const t=e.touches[0];
        if (Math.abs(t.clientX-touchDragData.startX)>8||Math.abs(t.clientY-touchDragData.startY)>8){
          clearTimeout(touchDragData.timer); touchDragData=null;
        }
      }
      return;
    }
    e.preventDefault();
    const touch=e.touches[0];
    if (touchGhost){touchGhost.style.left=(touch.clientX-20)+'px';touchGhost.style.top=(touch.clientY-30)+'px';}
    clearHighlight();
    const zone=getZoneAtPoint(touch.clientX,touch.clientY);
    if (zone){zone.classList.add('drop-target');lastHighlighted=zone;}
  },{passive:false});

  document.addEventListener('touchend',(e)=>{
    if (!touchDragData) return;
    clearTimeout(touchDragData.timer);
    if (!touchDragData.active){touchDragData=null;return;}
    const touch=e.changedTouches[0];
    const zone=getZoneAtPoint(touch.clientX,touch.clientY);
    clearHighlight(); removeGhost();
    document.querySelectorAll('.wk-task-item.dragging').forEach(el=>el.classList.remove('dragging'));
    const {fromDay,taskIndex}=touchDragData; touchDragData=null;
    if (!zone) return;
    const toDay=parseInt(zone.dataset.day);
    const toPeriod=zone.dataset.period;
    if (isNaN(toDay)||!toPeriod) return;
    const ws=wkGetWS(window._weeklyOffset);
    const task=ws.days[fromDay].tasks[taskIndex]; if (!task) return;
    if (fromDay===toDay&&task.period===toPeriod) return;
    ws.days[fromDay].tasks.splice(taskIndex,1);
    if (!ws.days[toDay].tasks) ws.days[toDay].tasks=[];
    ws.days[toDay].tasks.push({...task,period:toPeriod});
    wkSaveWS(ws,window._weeklyOffset);
    if (navigator.vibrate) navigator.vibrate(30);
    rerender();
  });

  // Close focus popups on outside tap
  document.addEventListener('click',(e)=>{
    document.querySelectorAll('.wk-focus-popup.open').forEach(p=>{
      if (!p.contains(e.target)&&!e.target.classList.contains('wk-focus-badge')) p.classList.remove('open');
    });
  });
}
