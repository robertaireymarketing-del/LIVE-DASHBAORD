// scenes.js — Scenes tab
// A scene = { id, name, rows:[string], collapsed:bool }, stored in state.data.scenes
// Each scene renders as a growing bullet list. Rows can be added / edited / removed,
// scenes can be renamed, reordered (up/down), and collapsed/expanded.

let confirmDeleteId = null; // module-scoped transient UI state (not persisted)
let colorPickerId = null;   // which scene's colour picker is open (transient)

// Colour-coding palette
const SCENE_COLOURS = ['#3B82F6', '#14B8A6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// ── HTML escape for values placed into attributes ──────────────────────────
function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Actions (registered on window, matching the app's pattern) ─────────────
export function initSceneActions({ state, saveDataQuiet, render }) {
  function getScenes() {
    if (!state.data.scenes) state.data.scenes = [];
    return state.data.scenes;
  }
  function findScene(id) { return getScenes().find(s => s.id === id); }

  // Pull any in-progress text from the DOM back into state before a re-render,
  // so unsaved keystrokes are never lost when the UI rebuilds.
  function syncFromDOM() {
    const scenes = getScenes();
    document.querySelectorAll('.scene-card').forEach(card => {
      const id = card.getAttribute('data-scene');
      const s = scenes.find(x => x.id === id);
      if (!s) return;
      const nameEl = card.querySelector('.scene-name-input');
      if (nameEl) s.name = nameEl.value;
      const rowEls = card.querySelectorAll('.scene-row-input');
      if (rowEls.length) s.rows = Array.from(rowEls).map(el => el.value); // skip when collapsed (0 inputs)
    });
  }

  window.addScene = () => {
    syncFromDOM();
    getScenes().push({ id: 's_' + Date.now(), name: 'New Scene', rows: [''], collapsed: false, color: null });
    render(); saveDataQuiet();
    setTimeout(() => {
      const els = document.querySelectorAll('.scene-name-input');
      const el = els[els.length - 1]; // newest is now last in the list
      if (el) { el.focus(); el.select(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 30);
  };

  window.renameScene = (id, value) => {
    const s = findScene(id); if (!s) return;
    s.name = value;
    saveDataQuiet(); // onchange/blur — no re-render, so focus is never disturbed
  };

  window.toggleSceneCollapse = (id) => {
    syncFromDOM();
    const s = findScene(id); if (!s) return;
    s.collapsed = !s.collapsed;
    render(); saveDataQuiet();
  };

  window.moveScene = (id, dir) => {
    syncFromDOM();
    const sc = getScenes();
    const i = sc.findIndex(s => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= sc.length) return;
    [sc[i], sc[j]] = [sc[j], sc[i]];
    render(); saveDataQuiet();
  };

  window.askDeleteScene    = (id) => { syncFromDOM(); colorPickerId = null; confirmDeleteId = id; render(); };
  window.cancelDeleteScene = ()   => { confirmDeleteId = null; render(); };
  window.confirmDeleteScene = (id) => {
    state.data.scenes = getScenes().filter(s => s.id !== id);
    confirmDeleteId = null;
    render(); saveDataQuiet();
  };

  window.toggleSceneColor = (id) => { syncFromDOM(); confirmDeleteId = null; colorPickerId = (colorPickerId === id ? null : id); render(); };
  window.setSceneColor = (id, color) => {
    const s = findScene(id); if (!s) return;
    s.color = color || null;
    colorPickerId = null;
    render(); saveDataQuiet();
  };

  window.addSceneRow = (id, afterIdx) => {
    syncFromDOM();
    const s = findScene(id); if (!s) return;
    if (!Array.isArray(s.rows)) s.rows = [];
    const insertAt = (afterIdx === undefined || afterIdx === null) ? s.rows.length : afterIdx + 1;
    s.rows.splice(insertAt, 0, '');
    render(); saveDataQuiet();
    setTimeout(() => {
      const els = document.querySelectorAll(`[data-scene="${id}"] .scene-row-input`);
      const t = els[insertAt];
      if (t) t.focus();
    }, 30);
  };

  window.updateSceneRow = (id, idx, value) => {
    const s = findScene(id); if (!s) return;
    if (!Array.isArray(s.rows)) s.rows = [];
    s.rows[idx] = value;
    saveDataQuiet(); // onchange/blur — no re-render
  };

  window.removeSceneRow = (id, idx) => {
    syncFromDOM();
    const s = findScene(id); if (!s) return;
    s.rows.splice(idx, 1);
    if (s.rows.length === 0) s.rows.push(''); // always keep at least one line to type into
    render(); saveDataQuiet();
  };

  window.sceneRowKeydown = (id, idx, ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); window.addSceneRow(id, idx); } // Enter = new line below
  };
}

// ── Render ──────────────────────────────────────────────────────────────────
export function renderScenesTab({ state }) {
  const scenes = (state.data && state.data.scenes) || [];

  const styles = `<style>
    .scenes-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;}
    .scenes-title{font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px;}
    .scenes-sub{font-size:12px;font-weight:700;color:rgba(255,255,255,0.4);margin-top:2px;}
    .scene-new-btn{background:#3B82F6;color:#fff;border:none;border-radius:12px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;}
    .scene-new-btn.big{margin-top:16px;padding:13px 20px;}
    .scene-new-btn:active{opacity:0.85;}
    .scenes-list{display:flex;flex-direction:column;gap:12px;}
    .scene-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:16px;overflow:hidden;}
    .scene-header{display:flex;align-items:center;gap:8px;padding:12px;}
    .scene-toggle{background:rgba(255,255,255,0.06);border:none;color:rgba(255,255,255,0.75);font-size:20px;line-height:1;cursor:pointer;width:40px;height:40px;border-radius:11px;font-family:inherit;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
    .scene-toggle:active{background:rgba(255,255,255,0.14);}
    .scene-name-input{flex:1;min-width:0;background:transparent;border:none;color:#fff;font-size:16px;font-weight:800;font-family:inherit;padding:4px 2px;outline:none;}
    .scene-name-input:focus{background:rgba(255,255,255,0.06);border-radius:8px;padding:4px 8px;}
    .scene-count{font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);flex-shrink:0;white-space:nowrap;}
    .scene-controls{display:flex;align-items:center;gap:4px;flex-shrink:0;}
    .scene-ctrl{background:rgba(255,255,255,0.06);border:none;color:rgba(255,255,255,0.7);width:30px;height:30px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;}
    .scene-ctrl:disabled{opacity:0.25;cursor:default;}
    .scene-ctrl.danger{color:#e74c3c;}
    .scene-ctrl:active{background:rgba(255,255,255,0.12);}
    .scene-color-btn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0;}
    .scene-color-dot{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.35);box-sizing:border-box;}
    .scene-colorbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 12px 12px;}
    .scene-colorbar-label{font-size:11px;font-weight:800;letter-spacing:0.6px;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-right:2px;}
    .scene-swatch{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;flex-shrink:0;}
    .scene-swatch.selected{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,0.4);}
    .scene-swatch.none{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-size:12px;display:flex;align-items:center;justify-content:center;}
    .scene-confirm{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);}
    .scene-confirm-yes{background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.5);color:#e74c3c;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}
    .scene-confirm-no{background:rgba(255,255,255,0.06);border:none;color:rgba(255,255,255,0.6);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;}
    .scene-body{padding:4px 12px 12px;border-top:1px solid rgba(255,255,255,0.06);}
    .scene-row{display:flex;align-items:center;gap:8px;padding:2px 0;}
    .scene-bullet{color:#3B82F6;font-size:16px;flex-shrink:0;width:10px;text-align:center;}
    .scene-row-input{flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-size:15px;font-family:inherit;padding:8px 2px;outline:none;}
    .scene-row-input:focus{border-bottom-color:#3B82F6;}
    .scene-row-remove{background:none;border:none;color:rgba(255,255,255,0.25);font-size:13px;cursor:pointer;padding:6px;flex-shrink:0;font-family:inherit;}
    .scene-row-remove:active{color:#e74c3c;}
    .scene-addrow{margin-top:8px;background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);border-radius:10px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;width:100%;font-family:inherit;}
    .scene-addrow:active{background:rgba(255,255,255,0.09);}
    .scenes-empty{text-align:center;padding:60px 20px;}
    .scenes-empty-emoji{font-size:44px;margin-bottom:12px;}
    .scenes-empty-title{font-size:18px;font-weight:900;color:#fff;margin-bottom:6px;}
    .scenes-empty-sub{font-size:13px;color:rgba(255,255,255,0.45);}
    body.light .scenes-title,body.light .scene-name-input,body.light .scenes-empty-title{color:#1c1c1e;}
    body.light .scene-card{background:#ffffff;border-color:rgba(0,0,0,0.08);box-shadow:0 1px 3px rgba(0,0,0,0.06);}
    body.light .scene-name-input:focus{background:rgba(0,0,0,0.04);}
    body.light .scene-body{border-top-color:rgba(0,0,0,0.08);}
    body.light .scene-row-input{color:#1c1c1e;border-bottom-color:rgba(0,0,0,0.1);}
    body.light .scene-row-input::placeholder{color:rgba(0,0,0,0.3);}
    body.light .scene-row-remove{color:rgba(0,0,0,0.3);}
    body.light .scenes-sub,body.light .scenes-empty-sub,body.light .scene-count{color:rgba(0,0,0,0.45);}
    body.light .scene-toggle{background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.6);}
    body.light .scene-ctrl{background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.6);}
    body.light .scene-ctrl.danger{color:#e74c3c;}
    body.light .scene-color-btn{background:rgba(0,0,0,0.05);}
    body.light .scene-color-dot{border-color:rgba(0,0,0,0.3);}
    body.light .scene-colorbar-label{color:rgba(0,0,0,0.45);}
    body.light .scene-swatch.selected{border-color:#1c1c1e;box-shadow:0 0 0 2px #fff;}
    body.light .scene-swatch.none{background:rgba(0,0,0,0.06);color:rgba(0,0,0,0.55);}
    body.light .scene-addrow{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.2);color:rgba(0,0,0,0.55);}
    body.light .scene-confirm{color:rgba(0,0,0,0.6);}
    body.light .scene-confirm-no{background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.6);}
  </style>`;

  const header = `
    <div class="scenes-head">
      <div>
        <div class="scenes-title">Scenes</div>
        <div class="scenes-sub">${scenes.length} scene${scenes.length === 1 ? '' : 's'}</div>
      </div>
      <button class="scene-new-btn" onclick="addScene()">＋ New Scene</button>
    </div>`;

  if (!scenes.length) {
    return styles + header + `
      <div class="scenes-empty">
        <div class="scenes-empty-emoji">🎬</div>
        <div class="scenes-empty-title">No scenes yet</div>
        <div class="scenes-empty-sub">Create a scene and start adding lines.</div>
        <button class="scene-new-btn big" onclick="addScene()">＋ Create your first scene</button>
      </div>`;
  }

  const cards = scenes.map((s, i) => {
    const rows = Array.isArray(s.rows) ? s.rows : [];
    const collapsed = !!s.collapsed;
    const filled = rows.filter(r => r && r.trim()).length;
    const confirming = confirmDeleteId === s.id;
    const picking = colorPickerId === s.id;
    const color = s.color || null;

    const body = collapsed ? '' : `
      <div class="scene-body">
        ${rows.map((r, ri) => `
          <div class="scene-row">
            <span class="scene-bullet"${color ? ` style="color:${color}"` : ''}>•</span>
            <input class="scene-row-input" type="text" value="${esc(r)}" placeholder="Write a line..."
              onchange="updateSceneRow('${s.id}',${ri},this.value)"
              onkeydown="sceneRowKeydown('${s.id}',${ri},event)">
            <button class="scene-row-remove" onclick="removeSceneRow('${s.id}',${ri})" title="Remove line">✕</button>
          </div>`).join('')}
        <button class="scene-addrow" onclick="addSceneRow('${s.id}')">＋ Add line</button>
      </div>`;

    const controls = confirming
      ? `<div class="scene-confirm">
           <span>Delete?</span>
           <button class="scene-confirm-yes" onclick="confirmDeleteScene('${s.id}')">Delete</button>
           <button class="scene-confirm-no" onclick="cancelDeleteScene()">Cancel</button>
         </div>`
      : `<button class="scene-color-btn" onclick="toggleSceneColor('${s.id}')" title="Colour code"><span class="scene-color-dot" style="${color ? `background:${color};border-color:${color};` : ''}"></span></button>
         <button class="scene-ctrl" onclick="moveScene('${s.id}',-1)" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
         <button class="scene-ctrl" onclick="moveScene('${s.id}',1)" ${i === scenes.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
         <button class="scene-ctrl danger" onclick="askDeleteScene('${s.id}')" title="Delete scene">🗑</button>`;

    const colorBar = picking ? `
        <div class="scene-colorbar">
          <span class="scene-colorbar-label">Colour</span>
          ${SCENE_COLOURS.map(c => `<button class="scene-swatch${color === c ? ' selected' : ''}" style="background:${c}" onclick="setSceneColor('${s.id}','${c}')" title="${c}"></button>`).join('')}
          <button class="scene-swatch none" onclick="setSceneColor('${s.id}','')" title="No colour">✕</button>
        </div>` : '';

    const cardStyle = color ? ` style="box-shadow: inset 4px 0 0 0 ${color}, 0 1px 3px rgba(0,0,0,0.06);"` : '';

    return `
      <div class="scene-card" data-scene="${s.id}"${cardStyle}>
        <div class="scene-header">
          <button class="scene-toggle" onclick="toggleSceneCollapse('${s.id}')">${collapsed ? '▸' : '▾'}</button>
          <input class="scene-name-input" type="text" value="${esc(s.name)}" placeholder="Scene name"
            onchange="renameScene('${s.id}',this.value)">
          ${collapsed ? `<span class="scene-count">${filled} line${filled === 1 ? '' : 's'}</span>` : ''}
          <div class="scene-controls">${controls}</div>
        </div>
        ${colorBar}
        ${body}
      </div>`;
  }).join('');

  return styles + header + `<div class="scenes-list">${cards}</div>`;
}
