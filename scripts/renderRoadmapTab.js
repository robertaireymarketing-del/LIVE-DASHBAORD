export function renderRoadmapTab() {

return `

<style>
/* ── CORE LAYOUT ── */
.rm-section { margin-bottom: 24px; }
.rm-section-label { font-size:9px;font-weight:900;letter-spacing:3px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px; }
.rm-section-title { font-size:18px;font-weight:900;color:#fff;letter-spacing:0.5px;margin-bottom:16px; }
.rm-math-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px; }
.rm-math-card { background:#1a1a1a;border:1px solid rgba(201,168,76,0.2);border-radius:8px;padding:14px; }
.rm-math-card.full { grid-column:1/-1; }
.rm-math-card.highlight { border-color:#C9A84C;background:rgba(201,168,76,0.08); }
.rm-math-label { font-size:9px;font-weight:900;letter-spacing:1.5px;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:6px; }
.rm-math-value { font-size:22px;font-weight:900;color:#D4AF37;line-height:1; }
.rm-math-sub { font-size:11px;color:rgba(255,255,255,0.35);margin-top:3px; }
.rm-note { background:#141414;border-left:2px solid #C9A84C;padding:10px 14px;border-radius:0 6px 6px 0;font-size:11px;color:rgba(255,255,255,0.4);line-height:1.5; }
.rm-milestone-wrap { overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:6px; }
.rm-milestone-table { width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed; }
.rm-milestone-table col.c-mo      { width:13%; }
.rm-milestone-table col.c-tjm     { width:22%; }
.rm-milestone-table col.c-vinted  { width:22%; }
.rm-milestone-table col.c-combined{ width:27%; }
.rm-milestone-table col.c-bar     { width:16%; }
.rm-milestone-table th { font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;text-align:left;padding:8px 8px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap;overflow:hidden; }
.rm-milestone-table td { padding:8px 8px;border-bottom:1px solid rgba(255,255,255,0.04);overflow:hidden; }
.rm-milestone-table tr.rm-current td { background:rgba(201,168,76,0.06); }
.rm-milestone-table tr.rm-target td { background:rgba(201,168,76,0.12);font-weight:700; }
.rm-milestone-table tr:last-child td { border-bottom:none; }
.rm-mo { font-size:10px;color:rgba(255,255,255,0.35); }
.rm-tjm { color:#5B9BD5; }
.rm-vinted { color:#4CAF79; }
.rm-total { color:#D4AF37;font-weight:700; }
.rm-bar-wrap { }
.rm-bar { height:3px;border-radius:2px;background:linear-gradient(90deg,#C9A84C,#D4AF37);margin-top:5px;transition:width 0.3s ease; }
/* ── PROJECTED ROWS (cascade) ── */
.rm-milestone-table tr.rm-projected td.rm-edit-tjm,
.rm-milestone-table tr.rm-projected td.rm-edit-vinted { opacity:0.65;font-style:italic; }
/* ── MOBILE TABLE ── */
@media (max-width:480px) {
  .rm-milestone-table { font-size:11px; }
  .rm-milestone-table th,.rm-milestone-table td { padding:7px 6px; }
  .rm-milestone-table col.c-mo      { width:15%; }
  .rm-milestone-table col.c-tjm     { width:25%; }
  .rm-milestone-table col.c-vinted  { width:25%; }
  .rm-milestone-table col.c-combined{ width:35%; }
  .rm-milestone-table col.c-bar     { width:0;display:none; }
  .rm-milestone-table th.th-bar,
  .rm-milestone-table td.td-bar      { display:none; }
}
.rm-phase { border:1px solid rgba(201,168,76,0.18);border-radius:10px;overflow:hidden;margin-bottom:10px; }
.rm-phase-header { padding:16px;display:flex;align-items:flex-start;gap:12px;cursor:pointer;background:#141414;-webkit-tap-highlight-color:transparent; }
.rm-phase-num { font-size:28px;font-weight:900;color:rgba(255,255,255,0.08);line-height:1;min-width:28px; }
.rm-phase-text { flex:1; }
.rm-phase-badge { font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px; }
.rm-phase-title { font-size:16px;font-weight:900;color:#fff;letter-spacing:0.3px; }
.rm-phase-months { font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px; }
.rm-phase-right { text-align:right; }
.rm-phase-target { font-size:11px;color:#C9A84C;font-weight:700;margin-bottom:4px; }
.rm-phase-chevron { font-size:16px;color:rgba(255,255,255,0.3);transition:transform 0.25s ease; }
.rm-phase.rm-open .rm-phase-chevron { transform:rotate(180deg); }
.rm-phase-body { display:none;padding:0 16px 16px;background:#141414; }
.rm-phase.rm-open .rm-phase-body { display:block; }
.rm-stream-head { font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;padding:14px 0 8px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:10px; }
.rm-stream-head.tjm { color:#5B9BD5; }
.rm-stream-head.vinted { color:#4CAF79; }
.rm-stream-head.va { color:#B97CF5; }
.rm-task { display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;line-height:1.45; }
.rm-task:last-child { border-bottom:none; }
.rm-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px; }
.rm-dot.blue { background:#5B9BD5; }
.rm-dot.green { background:#4CAF79; }
.rm-dot.purple { background:#B97CF5; }
.rm-dot.gold { background:#C9A84C; }
.rm-dot.red { background:#CF6679; }
.rm-task-text { color:rgba(255,255,255,0.85);flex:1; }
.rm-task-note { display:block;font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px;line-height:1.45; }
.rm-badge-nn { display:inline-block;background:rgba(207,102,121,0.15);border:1px solid rgba(207,102,121,0.3);color:#CF6679;font-size:9px;font-weight:900;letter-spacing:1px;padding:1px 6px;border-radius:3px;text-transform:uppercase;margin-left:6px;vertical-align:middle; }
.rm-badge-va { display:inline-block;background:rgba(185,124,245,0.1);border:1px solid rgba(185,124,245,0.2);color:#B97CF5;font-size:9px;font-weight:900;letter-spacing:1px;padding:1px 6px;border-radius:3px;text-transform:uppercase;margin-left:6px;vertical-align:middle; }
.rm-time { background:rgba(91,155,213,0.1);border:1px solid rgba(91,155,213,0.2);color:#5B9BD5;font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;white-space:nowrap;flex-shrink:0;margin-top:3px; }
.rm-metrics-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
.rm-metric-card { background:#1a1a1a;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:12px; }
.rm-metric-card.full { grid-column:1/-1; }
.rm-metric-title { font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:8px; }
.rm-metric-item { font-size:12px;color:rgba(255,255,255,0.75);padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:6px; }
.rm-metric-item:last-child { border-bottom:none; }
.rm-truth { padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5; }
.rm-truth:last-child { border-bottom:none; }

/* ── EDIT SYSTEM ── */
.rm-edit-bar {
  display:flex;align-items:center;gap:8px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);
  border-radius:8px;padding:9px 14px;margin-bottom:18px;font-size:11px;color:rgba(255,255,255,0.5);
}
.rm-edit-bar-dot { width:6px;height:6px;border-radius:50%;background:#C9A84C;animation:rmPulse 2s infinite; }
@keyframes rmPulse { 0%,100%{opacity:1}50%{opacity:0.4} }
.rm-edit-bar strong { color:#D4AF37;font-weight:700; }
.rm-calc-tag {
  display:inline-block;font-size:8px;font-weight:900;letter-spacing:1px;color:rgba(201,168,76,0.5);
  text-transform:uppercase;vertical-align:middle;margin-left:4px;
}

[contenteditable="true"] {
  outline: none;
  cursor: text;
  border-radius: 3px;
  transition: background 0.15s, box-shadow 0.15s;
}
[contenteditable="true"]:hover {
  background: rgba(201,168,76,0.07);
}
[contenteditable="true"]:focus {
  background: rgba(201,168,76,0.12);
  box-shadow: 0 0 0 1.5px rgba(201,168,76,0.4);
}
/* Milestone table edit cells */
.rm-edit-tjm[contenteditable="true"],
.rm-edit-vinted[contenteditable="true"] {
  padding: 2px 4px;
  border-radius: 3px;
  min-width: 30px;
  display: inline-block;
}
/* Time chips editable */
.rm-time[contenteditable="true"] {
  cursor: text;
}
/* Calculated (non-editable) combined cells */
.rm-calc-combined {
  pointer-events: none;
  opacity: 0.9;
}

/* ── LIGHT MODE OVERRIDES ── */
body.light .rm-section-label { color:rgba(0,0,0,0.4); }
body.light .rm-section-title { color:#111; }
body.light .rm-math-card { background:#f5f5f5;border-color:rgba(201,168,76,0.35); }
body.light .rm-math-card.highlight { background:rgba(201,168,76,0.1);border-color:#C9A84C; }
body.light .rm-math-label { color:rgba(0,0,0,0.45); }
body.light .rm-math-sub { color:rgba(0,0,0,0.45); }
body.light .rm-note { background:#f0f0f0;color:rgba(0,0,0,0.55); }
body.light .rm-milestone-table th { color:rgba(0,0,0,0.4);border-bottom-color:rgba(0,0,0,0.1); }
body.light .rm-milestone-table td { border-bottom-color:rgba(0,0,0,0.06); }
body.light .rm-mo { color:rgba(0,0,0,0.4); }
body.light .rm-phase { border-color:rgba(201,168,76,0.3); }
body.light .rm-phase-header { background:#f5f5f5; }
body.light .rm-phase-num { color:rgba(0,0,0,0.1); }
body.light .rm-phase-title { color:#111; }
body.light .rm-phase-months { color:rgba(0,0,0,0.4); }
body.light .rm-phase-chevron { color:rgba(0,0,0,0.3); }
body.light .rm-phase-body { background:#f5f5f5; }
body.light .rm-stream-head { border-bottom-color:rgba(0,0,0,0.08); }
body.light .rm-task { border-bottom-color:rgba(0,0,0,0.06); }
body.light .rm-task-text { color:rgba(0,0,0,0.85); }
body.light .rm-task-note { color:rgba(0,0,0,0.45); }
body.light .rm-truth { border-bottom-color:rgba(0,0,0,0.06); }
body.light .rm-truth .rm-task-text strong { color:#111 !important; }
body.light .rm-metric-card { background:#f5f5f5;border-color:rgba(0,0,0,0.08); }
body.light .rm-metric-title { color:rgba(0,0,0,0.4); }
body.light .rm-metric-item { color:rgba(0,0,0,0.75);border-bottom-color:rgba(0,0,0,0.06); }
body.light .rm-hero-text-main { color:#111 !important; }
body.light .rm-hero-sub { color:rgba(0,0,0,0.5) !important; }
body.light .rm-hero-wrap { background:linear-gradient(145deg,#fdf9ee,#f5f0e0) !important;border-color:rgba(201,168,76,0.4) !important; }
body.light .rm-strong { color:#111 !important; }
body.light .rm-metric-item-muted { color:rgba(0,0,0,0.4) !important; }
body.light .rm-edit-bar { background:rgba(201,168,76,0.06);color:rgba(0,0,0,0.45); }
body.light [contenteditable="true"]:hover { background:rgba(201,168,76,0.08); }
body.light [contenteditable="true"]:focus { background:rgba(201,168,76,0.15);box-shadow:0 0 0 1.5px rgba(201,168,76,0.5); }
.rm-strong { color:#fff; }
</style>

<!-- EDIT HINT BAR -->
<div class="rm-edit-bar">
  <div class="rm-edit-bar-dot"></div>
  <span><strong>Fully editable.</strong> Tap any text, number, or time block to edit it. Milestone table updates totals &amp; phase targets automatically.</span>
</div>

<!-- HERO BANNER -->
<div class="rm-hero-wrap" style="background:linear-gradient(145deg,#111008,#0a0a0a);border:1px solid rgba(201,168,76,0.25);border-radius:12px;padding:20px;margin-bottom:24px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%);pointer-events:none;"></div>
  <div style="font-size:9px;font-weight:900;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:10px;" contenteditable="true">TJM + Vinted — 12 Month Plan</div>
  <div class="rm-hero-text-main" style="font-size:26px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px;" contenteditable="true">£10k/<span style="color:#D4AF37;">Month</span></div>
  <div class="rm-hero-sub" style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:16px;" contenteditable="true">Two income streams. One number to hit. 12 months.</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:4px;padding:5px 10px;font-size:10px;font-weight:700;color:#D4AF37;letter-spacing:0.5px;" contenteditable="true">TJM Target: £8k profit/mo</div>
    <div style="background:rgba(76,175,121,0.1);border:1px solid rgba(76,175,121,0.2);border-radius:4px;padding:5px 10px;font-size:10px;font-weight:700;color:#4CAF79;letter-spacing:0.5px;" contenteditable="true">Vinted Target: £6k profit/mo</div>
  </div>
</div>

<!-- SECTION 1: THE MATH -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 01</div>
  <div class="rm-section-title" contenteditable="true">The Numbers</div>
  <div class="rm-math-grid">
    <div class="rm-math-card">
      <div class="rm-math-label" contenteditable="true">Business profit needed (Ltd Co)</div>
      <div class="rm-math-value" contenteditable="true">£14k</div>
      <div class="rm-math-sub" contenteditable="true">per month gross</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label" contenteditable="true">After corp tax + dividends</div>
      <div class="rm-math-value" contenteditable="true">~£10k</div>
      <div class="rm-math-sub" contenteditable="true">take-home</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label" contenteditable="true">TJM — Orders needed/day</div>
      <div class="rm-math-value" contenteditable="true">7–8</div>
      <div class="rm-math-sub" contenteditable="true">at £75 AOV, 47.5% margin → £8k profit</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label" contenteditable="true">Vinted — Sales needed/day</div>
      <div class="rm-math-value" contenteditable="true">11–12</div>
      <div class="rm-math-sub" contenteditable="true">at £20 avg, 55% margin → £6k profit</div>
    </div>
    <div class="rm-math-card full highlight">
      <div class="rm-math-label" contenteditable="true">Gap to close from today</div>
      <div class="rm-math-value" contenteditable="true">£13,500/month profit</div>
      <div class="rm-math-sub" contenteditable="true">= +£1,125 profit per month, every month for 12 months</div>
    </div>
  </div>
  <div class="rm-note" contenteditable="true">⚠️ Verify exact tax position with your accountant. £14k→£10k assumes basic-rate dividends above personal allowance salary. Corp tax at 25% main rate.</div>
</div>

<!-- SECTION 2: MILESTONES -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 02</div>
  <div class="rm-section-title" contenteditable="true">Monthly Profit Milestones</div>
  <div class="rm-milestone-wrap">
  <table class="rm-milestone-table">
    <colgroup>
      <col class="c-mo"><col class="c-tjm"><col class="c-vinted"><col class="c-combined"><col class="c-bar">
    </colgroup>
    <thead>
      <tr>
        <th contenteditable="true">Mo</th>
        <th contenteditable="true">TJM</th>
        <th contenteditable="true">Vinted</th>
        <th>Combined <span class="rm-calc-tag">auto</span></th>
        <th class="th-bar"></th>
      </tr>
    </thead>
    <tbody id="rm-milestone-tbody">
      <tr class="rm-current" data-month="0" data-def-tjm="200" data-def-vint="0">
        <td class="rm-mo" contenteditable="true">Now</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£200</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£0</td>
        <td class="rm-total rm-calc-combined">£200</td>
        <td class="td-bar"><div class="rm-bar" style="width:1%"></div></td>
      </tr>
      <tr data-month="1" data-def-tjm="400" data-def-vint="300">
        <td class="rm-mo" contenteditable="true">M1</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£400</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£300</td>
        <td class="rm-total rm-calc-combined">£700</td>
        <td class="td-bar"><div class="rm-bar" style="width:5%"></div></td>
      </tr>
      <tr data-month="2" data-def-tjm="700" data-def-vint="600">
        <td class="rm-mo" contenteditable="true">M2</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£700</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£600</td>
        <td class="rm-total rm-calc-combined">£1,300</td>
        <td class="td-bar"><div class="rm-bar" style="width:9%"></div></td>
      </tr>
      <tr data-month="3" data-def-tjm="1100" data-def-vint="1000">
        <td class="rm-mo" contenteditable="true">M3</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£1,100</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£1,000</td>
        <td class="rm-total rm-calc-combined">£2,100</td>
        <td class="td-bar"><div class="rm-bar" style="width:15%"></div></td>
      </tr>
      <tr data-month="4" data-def-tjm="1700" data-def-vint="1500">
        <td class="rm-mo" contenteditable="true">M4</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£1,700</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£1,500</td>
        <td class="rm-total rm-calc-combined">£3,200</td>
        <td class="td-bar"><div class="rm-bar" style="width:23%"></div></td>
      </tr>
      <tr data-month="5" data-def-tjm="2400" data-def-vint="2000">
        <td class="rm-mo" contenteditable="true">M5</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£2,400</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£2,000</td>
        <td class="rm-total rm-calc-combined">£4,400</td>
        <td class="td-bar"><div class="rm-bar" style="width:31%"></div></td>
      </tr>
      <tr data-month="6" data-def-tjm="3200" data-def-vint="2500">
        <td class="rm-mo" contenteditable="true">M6</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£3,200</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£2,500</td>
        <td class="rm-total rm-calc-combined">£5,700</td>
        <td class="td-bar"><div class="rm-bar" style="width:41%"></div></td>
      </tr>
      <tr data-month="7" data-def-tjm="4200" data-def-vint="3000">
        <td class="rm-mo" contenteditable="true">M7</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£4,200</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£3,000</td>
        <td class="rm-total rm-calc-combined">£7,200</td>
        <td class="td-bar"><div class="rm-bar" style="width:51%"></div></td>
      </tr>
      <tr data-month="8" data-def-tjm="5200" data-def-vint="3800">
        <td class="rm-mo" contenteditable="true">M8</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£5,200</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£3,800</td>
        <td class="rm-total rm-calc-combined">£9,000</td>
        <td class="td-bar"><div class="rm-bar" style="width:64%"></div></td>
      </tr>
      <tr data-month="9" data-def-tjm="6000" data-def-vint="4500">
        <td class="rm-mo" contenteditable="true">M9</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£6,000</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£4,500</td>
        <td class="rm-total rm-calc-combined">£10,500</td>
        <td class="td-bar"><div class="rm-bar" style="width:75%"></div></td>
      </tr>
      <tr data-month="10" data-def-tjm="6800" data-def-vint="5200">
        <td class="rm-mo" contenteditable="true">M10</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£6,800</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£5,200</td>
        <td class="rm-total rm-calc-combined">£12,000</td>
        <td class="td-bar"><div class="rm-bar" style="width:86%"></div></td>
      </tr>
      <tr data-month="11" data-def-tjm="7500" data-def-vint="5700">
        <td class="rm-mo" contenteditable="true">M11</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£7,500</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£5,700</td>
        <td class="rm-total rm-calc-combined">£13,200</td>
        <td class="td-bar"><div class="rm-bar" style="width:94%"></div></td>
      </tr>
      <tr class="rm-target" data-month="12" data-def-tjm="8000" data-def-vint="6000">
        <td class="rm-mo" contenteditable="true">M12</td>
        <td class="rm-tjm rm-edit-tjm" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'tjm')">£8,000</td>
        <td class="rm-vinted rm-edit-vinted" contenteditable="true" oninput="if(window.rmCascade)window.rmCascade(this,'vint')">£6,000</td>
        <td class="rm-total rm-calc-combined">£14,000</td>
        <td class="td-bar"><div class="rm-bar" style="width:100%"></div></td>
      </tr>
    </tbody>
  </table>
  </div>
</div>

<!-- SECTION 3: PHASES -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 03</div>
  <div class="rm-section-title" contenteditable="true">Daily Tasks by Phase</div>
  <p style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:16px;" contenteditable="true">Tap each phase to expand your daily actions.</p>

  <!-- PHASE 1 -->
  <div class="rm-phase rm-open" id="rmPhase1">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase1').classList.toggle('rm-open')">
      <div class="rm-phase-num" contenteditable="true" onclick="event.stopPropagation()">01</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#5B9BD5;" contenteditable="true" onclick="event.stopPropagation()">Foundation</div>
        <div class="rm-phase-title" contenteditable="true" onclick="event.stopPropagation()">Build the Machine</div>
        <div class="rm-phase-months" contenteditable="true" onclick="event.stopPropagation()">Months 1–2</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target" id="rmPhase1Target">£700 → £1,300</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm" contenteditable="true">— TJM Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Go live on TikTok (5pm–6:30pm) <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">5x per week minimum. This is your #1 revenue driver right now.</span></div><div class="rm-time" contenteditable="true">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Post 1 sales content piece<span class="rm-task-note">Product shot + price + clear CTA. Simple. Repeat daily.</span></div><div class="rm-time" contenteditable="true">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Post 1 growth/value piece<span class="rm-task-note">Education, story, behind-the-scenes. Builds the audience that buys.</span></div><div class="rm-time" contenteditable="true">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Send 10 DMs to warm leads<span class="rm-task-note">Anyone who watched your live, commented or followed in last 7 days.</span></div><div class="rm-time" contenteditable="true">20 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Add 1 product to Shopify with full copy + photos<span class="rm-task-note">Proper title, description, tags, SEO slug. No half-done listings.</span></div><div class="rm-time" contenteditable="true">15 min</div></div>
      <div class="rm-stream-head va" contenteditable="true">— VA Daily Tasks (Brief this week)</div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Edit + schedule 2 TikTok posts from raw footage <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Reply to all TikTok/Instagram comments within 2 hours <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Log every new lead/enquiry into CRM <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Photograph + basic edit 10 Vinted items per day <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-stream-head vinted" contenteditable="true">— Vinted Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">List 10 items (until all current stock is live)<span class="rm-task-note">Goal: 100+ listings live by end of Month 1. You have the stock — this is just execution.</span></div><div class="rm-time" contenteditable="true">30 min</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Reply to all buyer messages within 1 hour <span class="rm-badge-va">VA assists</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Package + ship sold items daily (batch at post office)</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Note what sells and at what price<span class="rm-task-note">This data tells you what to restock. Don't skip it.</span></div></div>
    </div>
  </div>

  <!-- PHASE 2 -->
  <div class="rm-phase" id="rmPhase2">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase2').classList.toggle('rm-open')">
      <div class="rm-phase-num" contenteditable="true" onclick="event.stopPropagation()">02</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#4CAF79;" contenteditable="true" onclick="event.stopPropagation()">Momentum</div>
        <div class="rm-phase-title" contenteditable="true" onclick="event.stopPropagation()">Turn Up the Dial</div>
        <div class="rm-phase-months" contenteditable="true" onclick="event.stopPropagation()">Months 3–5</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target" id="rmPhase2Target">£2,100 → £4,400</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm" contenteditable="true">— TJM Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">TikTok Live every weekday <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">You now have a track record — protect it. Consistency builds algorithmic trust.</span></div><div class="rm-time" contenteditable="true">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">1 sales post — start testing formats<span class="rm-task-note">Rotate: bundles, urgency, social proof, before/after. Track which converts best.</span></div><div class="rm-time" contenteditable="true">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">15+ DM follow-ups per day<span class="rm-task-note">Prioritise anyone who engaged in last 7 days. Use a script — vary the opener.</span></div><div class="rm-time" contenteditable="true">25 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Weekly email to your list (even if 50 people — start now)<span class="rm-task-note">You write the angle, VA formats and sends. One revenue email per week.</span></div><div class="rm-time" contenteditable="true">20 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Add 2 new products to Shopify per week</div><div class="rm-time" contenteditable="true">30 min/wk</div></div>
      <div class="rm-stream-head va" contenteditable="true">— VA Daily Tasks (Expand their role)</div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Edit + schedule 3 TikTok posts per day <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Repurpose 1 TikTok as Instagram Reel daily <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">CRM updated daily — new leads, follow-up dates logged <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">Vinted pipeline: VA now manages all listing (15+ items/day) <span class="rm-badge-va">VA leads</span></div></div>
      <div class="rm-stream-head vinted" contenteditable="true">— Vinted Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">VA leads listing (15+ items/day) — Robert reviews pricing weekly <span class="rm-badge-va">VA leads</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Target: 150+ active listings live by end of Month 3<span class="rm-task-note">More listings = more surface area = more passive sales while you sleep.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Restock order placed when live listings drop below 100</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Ship daily or batch every 2 days</div><div class="rm-time" contenteditable="true">15 min</div></div>
    </div>
  </div>

  <!-- PHASE 3 -->
  <div class="rm-phase" id="rmPhase3">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase3').classList.toggle('rm-open')">
      <div class="rm-phase-num" contenteditable="true" onclick="event.stopPropagation()">03</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#D4AF37;" contenteditable="true" onclick="event.stopPropagation()">Scale</div>
        <div class="rm-phase-title" contenteditable="true" onclick="event.stopPropagation()">Systemise Everything</div>
        <div class="rm-phase-months" contenteditable="true" onclick="event.stopPropagation()">Months 6–9</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target" id="rmPhase3Target">£5,700 → £10,500</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm" contenteditable="true">— TJM Daily Tasks (Robert's time drops)</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Live 5x/week <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">Robert's one remaining daily job is the live stream + DM closing. Everything else delegated.</span></div><div class="rm-time" contenteditable="true">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Close DMs from live — 20+ per day, use urgency and social proof</div><div class="rm-time" contenteditable="true">30 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Weekly: review sales data — identify top 20% SKUs, reorder stock</div><div class="rm-time" contenteditable="true">20 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Monthly: launch 1 new product line or bundle offer</div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text" contenteditable="true">VA handles 100% of content scheduling, CRM, email sends <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-stream-head vinted" contenteditable="true">— Vinted (VA-Led)</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">VA fully manages listing pipeline end-to-end <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Target: 400+ active listings maintained<span class="rm-task-note">At 2% daily sell-through on 400 listings = 8 sales/day. The maths works at volume.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Robert: weekly audit only — sell-through, pricing, profit vs target</div><div class="rm-time" contenteditable="true">15 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Monthly restock placed from Vinted profits (self-funding)</div></div>
    </div>
  </div>

  <!-- PHASE 4 -->
  <div class="rm-phase" id="rmPhase4">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase4').classList.toggle('rm-open')">
      <div class="rm-phase-num" contenteditable="true" onclick="event.stopPropagation()">04</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#CF6679;" contenteditable="true" onclick="event.stopPropagation()">Optimise</div>
        <div class="rm-phase-title" contenteditable="true" onclick="event.stopPropagation()">Hit the Number</div>
        <div class="rm-phase-months" contenteditable="true" onclick="event.stopPropagation()">Months 10–12</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target" id="rmPhase4Target">£12,000 → £14,000</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm" contenteditable="true">— TJM: Focus Shifts to AOV + Conversion</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Introduce £100–150 products and bundle deals on live<span class="rm-task-note">You don't need more orders — you need bigger orders. Push AOV from £75 to £95+.</span></div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Email list becomes a weekly revenue channel — "drop" style sends</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Shopify organic traffic starting to contribute (SEO from 5+ months of listings)</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text" contenteditable="true">Review: what's driving 80% of revenue? Double it. Cut the rest.</div></div>
      <div class="rm-stream-head vinted" contenteditable="true">— Vinted: Move Up the Value Chain</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Shift sourcing toward branded/hallmarked higher-margin pieces</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">Push average selling price from £20 → £30+<span class="rm-task-note">Same volume, 50% more revenue. That's the Vinted lever at this stage.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text" contenteditable="true">VA handles 95% — Robert reviews P&amp;L weekly, nothing more</div></div>
    </div>
  </div>
</div>

<!-- SECTION 4: WEEKLY REVIEW -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 04</div>
  <div class="rm-section-title" contenteditable="true">Weekly Review — Every Sunday (30 min)</div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text" contenteditable="true">TJM: Live viewers → DMs generated → conversion to sales. Is the funnel moving?</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text" contenteditable="true">TJM: Revenue vs monthly milestone — on track, behind, or ahead?</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text" contenteditable="true">Vinted: Active listings / items sold / avg sale price / weekly profit</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text" contenteditable="true">VA brief for next week — content themes, restock needs, priorities</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text" contenteditable="true">Personal energy check — what drained you most? Can it be delegated or cut?</div></div>
</div>

<!-- SECTION 5: METRICS -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 05</div>
  <div class="rm-section-title" contenteditable="true">Metrics to Track</div>
  <div class="rm-metrics-grid">
    <div class="rm-metric-card">
      <div class="rm-metric-title" contenteditable="true">TJM Funnel (weekly)</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Live viewers</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Profile visits</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">DMs sent</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Sales closed</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Avg order value</span></div>
    </div>
    <div class="rm-metric-card">
      <div class="rm-metric-title" contenteditable="true">Vinted (weekly)</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Active listings</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Items sold</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Avg sale price</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Weekly profit</span></div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span><span contenteditable="true">Sell-through rate</span></div>
    </div>
    <div class="rm-metric-card full">
      <div class="rm-metric-title" contenteditable="true">The one number that tells you everything</div>
      <div class="rm-metric-item" style="font-size:13px;color:#D4AF37;padding:8px 0;" contenteditable="true">Combined monthly profit vs milestone target — above or below the line?</div>
      <div class="rm-metric-item rm-metric-item-muted" style="font-size:11px;color:rgba(255,255,255,0.3);" contenteditable="true">If behind by more than 20% two months in a row → review the plan, don't just push harder.</div>
    </div>
  </div>
</div>

<!-- SECTION 6: TRUTHS -->
<div class="rm-section">
  <div class="rm-section-label" contenteditable="true">Section 06</div>
  <div class="rm-section-title" contenteditable="true">The Uncomfortable Truths</div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text" contenteditable="true"><strong class="rm-strong">TikTok lives are the only lever that matters in Months 1–6.</strong> Everything else is supporting cast. Skip lives = skip revenue.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text" contenteditable="true"><strong class="rm-strong">The VA is currently a bottleneck, not an asset.</strong> Brief them properly this week. 30 minutes of clarity now saves months of confusion.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text" contenteditable="true"><strong class="rm-strong">Vinted is a volume game.</strong> 10 listings won't move the needle. 400 listings maintained consistently will. Get the stock live fast.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text" contenteditable="true"><strong class="rm-strong">The milestones are not straight lines.</strong> Months 1–3 will feel slow. Months 6–9 is where compounding kicks in. Stay in the process.</div></div>
  <div class="rm-truth"><div class="rm-dot gold" style="margin-top:6px;"></div><div class="rm-task-text" style="color:#D4AF37;" contenteditable="true"><strong>Your biggest competitive advantage is already doing this at 4:30am</strong> when everyone else hasn't started. The plan works — if the execution does.</div></div>
</div>

<!-- INIT TRIGGER: onerror fires even from innerHTML, unlike <script> tags -->
<img src="__rm_no_load__" onerror="this.remove();(function(){

  /* ── RECALC: combined totals + bars + phase target labels ── */
  window.rmRecalc = function() {
    var tbody = document.getElementById('rm-milestone-tbody');
    if (!tbody) return;
    var rows = tbody.querySelectorAll('tr[data-month]');
    var maxComb = 1;
    var data = [];

    rows.forEach(function(row) {
      var tjmEl  = row.querySelector('.rm-edit-tjm');
      var vintEl = row.querySelector('.rm-edit-vinted');
      var combEl = row.querySelector('.rm-calc-combined');
      var barEl  = row.querySelector('.rm-bar');
      if (!tjmEl || !vintEl || !combEl) return;
      var tjm  = parseFloat(tjmEl.textContent.replace(/[^0-9.]/g,''))  || 0;
      var vint = parseFloat(vintEl.textContent.replace(/[^0-9.]/g,'')) || 0;
      var comb = tjm + vint;
      data.push({ combEl: combEl, barEl: barEl, comb: comb });
      if (comb > maxComb) maxComb = comb;
    });

    data.forEach(function(d) {
      d.combEl.textContent = '\u00a3' + d.comb.toLocaleString('en-GB');
      if (d.barEl) {
        var pct = maxComb > 0 ? Math.round((d.comb / maxComb) * 100) : 0;
        d.barEl.style.width = pct + '%';
      }
    });

    var phaseMap = {
      rmPhase1Target: [1, 2],
      rmPhase2Target: [3, 5],
      rmPhase3Target: [6, 9],
      rmPhase4Target: [10, 12]
    };
    Object.keys(phaseMap).forEach(function(targetId) {
      var targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      var months = phaseMap[targetId];
      var startRow = tbody.querySelector('tr[data-month=\"' + months[0] + '\"]');
      var endRow   = tbody.querySelector('tr[data-month=\"' + months[1] + '\"]');
      if (!startRow || !endRow) return;
      var startComb = startRow.querySelector('.rm-calc-combined');
      var endComb   = endRow.querySelector('.rm-calc-combined');
      if (startComb && endComb) {
        targetEl.textContent = startComb.textContent + ' \u2192 ' + endComb.textContent;
      }
    });
  };

  /* ── CASCADE: project future months when a cell is edited ── */
  window.rmCascade = function(cell, stream) {
    var tbody = document.getElementById('rm-milestone-tbody');
    if (!tbody) return;

    var editedRow = cell.closest('tr[data-month]');
    if (!editedRow) { window.rmRecalc(); return; }

    var editedMonth = parseInt(editedRow.getAttribute('data-month'), 10);
    var editedVal   = parseFloat(cell.textContent.replace(/[^0-9.]/g,'')) || 0;

    /* Default value for this stream at this month (stored on the row as data-attr) */
    var defKey  = stream === 'tjm' ? 'data-def-tjm' : 'data-def-vint';
    var defBase = parseFloat(editedRow.getAttribute(defKey)) || 0;

    /* Can't cascade if the default base is zero (Vinted 'Now' row = £0) */
    var canCascade = defBase > 0;

    /* Walk forward from editedMonth+1 to 12 */
    var allRows = tbody.querySelectorAll('tr[data-month]');
    allRows.forEach(function(row) {
      var month = parseInt(row.getAttribute('data-month'), 10);
      if (month <= editedMonth) return;

      if (canCascade) {
        var defFuture = parseFloat(row.getAttribute(defKey)) || 0;
        /* Project: scale the default future value by ratio of newVal / defaultBase */
        var projected = Math.round((editedVal * (defFuture / defBase)) / 50) * 50;
        projected = Math.max(0, projected);

        var targetCell = stream === 'tjm'
          ? row.querySelector('.rm-edit-tjm')
          : row.querySelector('.rm-edit-vinted');

        if (targetCell) {
          targetCell.textContent = '\u00a3' + projected.toLocaleString('en-GB');
          /* Mark as projected so user knows it was auto-filled */
          row.classList.add('rm-projected');
        }
      }
    });

    window.rmRecalc();
  };

  /* ── KEYBOARD: Enter confirms + blurs on single-line fields ── */
  document.querySelectorAll('[contenteditable=\"true\"]').forEach(function(el) {
    var multiline = el.classList.contains('rm-task-text') ||
                    el.classList.contains('rm-task-note') ||
                    el.classList.contains('rm-note');
    if (!multiline) {
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
    }
  });

  /* ── ACCORDION: stop phase toggle when clicking editable children ── */
  document.querySelectorAll('.rm-phase-body [contenteditable=\"true\"]').forEach(function(el) {
    el.addEventListener('click', function(e) { e.stopPropagation(); });
  });

})()" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;">

`;

}
