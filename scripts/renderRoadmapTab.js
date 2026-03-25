export function renderRoadmapTab() {

return `

<style>
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
.rm-milestone-table { width:100%;border-collapse:collapse;font-size:12px; }
.rm-milestone-table th { font-size:9px;font-weight:900;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08); }
.rm-milestone-table td { padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.04); }
.rm-milestone-table tr.rm-current td { background:rgba(201,168,76,0.06); }
.rm-milestone-table tr.rm-target td { background:rgba(201,168,76,0.12);font-weight:700; }
.rm-milestone-table tr:last-child td { border-bottom:none; }
.rm-mo { font-size:10px;color:rgba(255,255,255,0.35); }
.rm-tjm { color:#5B9BD5; }
.rm-vinted { color:#4CAF79; }
.rm-total { color:#D4AF37;font-weight:700; }
.rm-bar-wrap { }
.rm-bar { height:3px;border-radius:2px;background:linear-gradient(90deg,#C9A84C,#D4AF37);margin-top:5px; }
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
.rm-strong { color:#fff; }
</style>

<!-- HERO BANNER -->
<div class="rm-hero-wrap" style="background:linear-gradient(145deg,#111008,#0a0a0a);border:1px solid rgba(201,168,76,0.25);border-radius:12px;padding:20px;margin-bottom:24px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%);pointer-events:none;"></div>
  <div style="font-size:9px;font-weight:900;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:10px;">TJM + Vinted — 12 Month Plan</div>
  <div class="rm-hero-text-main" style="font-size:26px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:4px;">£10k/<span style="color:#D4AF37;">Month</span></div>
  <div class="rm-hero-sub" style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:16px;">Two income streams. One number to hit. 12 months.</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);border-radius:4px;padding:5px 10px;font-size:10px;font-weight:700;color:#D4AF37;letter-spacing:0.5px;">TJM Target: £8k profit/mo</div>
    <div style="background:rgba(76,175,121,0.1);border:1px solid rgba(76,175,121,0.2);border-radius:4px;padding:5px 10px;font-size:10px;font-weight:700;color:#4CAF79;letter-spacing:0.5px;">Vinted Target: £6k profit/mo</div>
  </div>
</div>

<!-- SECTION 1: THE MATH -->
<div class="rm-section">
  <div class="rm-section-label">Section 01</div>
  <div class="rm-section-title">The Numbers</div>
  <div class="rm-math-grid">
    <div class="rm-math-card">
      <div class="rm-math-label">Business profit needed (Ltd Co)</div>
      <div class="rm-math-value">£14k</div>
      <div class="rm-math-sub">per month gross</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label">After corp tax + dividends</div>
      <div class="rm-math-value">~£10k</div>
      <div class="rm-math-sub">take-home</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label">TJM — Orders needed/day</div>
      <div class="rm-math-value">7–8</div>
      <div class="rm-math-sub">at £75 AOV, 47.5% margin → £8k profit</div>
    </div>
    <div class="rm-math-card">
      <div class="rm-math-label">Vinted — Sales needed/day</div>
      <div class="rm-math-value">11–12</div>
      <div class="rm-math-sub">at £20 avg, 55% margin → £6k profit</div>
    </div>
    <div class="rm-math-card full highlight">
      <div class="rm-math-label">Gap to close from today</div>
      <div class="rm-math-value">£13,500/month profit</div>
      <div class="rm-math-sub">= +£1,125 profit per month, every month for 12 months</div>
    </div>
  </div>
  <div class="rm-note">⚠️ Verify exact tax position with your accountant. £14k→£10k assumes basic-rate dividends above personal allowance salary. Corp tax at 25% main rate.</div>
</div>

<!-- SECTION 2: MILESTONES -->
<div class="rm-section">
  <div class="rm-section-label">Section 02</div>
  <div class="rm-section-title">Monthly Profit Milestones</div>
  <table class="rm-milestone-table">
    <thead>
      <tr>
        <th>Mo</th><th>TJM</th><th>Vinted</th><th>Combined</th><th style="width:60px"></th>
      </tr>
    </thead>
    <tbody>
      <tr class="rm-current"><td class="rm-mo">Now</td><td class="rm-tjm">£200</td><td class="rm-vinted">£0</td><td class="rm-total">£200</td><td><div class="rm-bar" style="width:1%"></div></td></tr>
      <tr><td class="rm-mo">M1</td><td class="rm-tjm">£400</td><td class="rm-vinted">£300</td><td class="rm-total">£700</td><td><div class="rm-bar" style="width:5%"></div></td></tr>
      <tr><td class="rm-mo">M2</td><td class="rm-tjm">£700</td><td class="rm-vinted">£600</td><td class="rm-total">£1,300</td><td><div class="rm-bar" style="width:9%"></div></td></tr>
      <tr><td class="rm-mo">M3</td><td class="rm-tjm">£1,100</td><td class="rm-vinted">£1,000</td><td class="rm-total">£2,100</td><td><div class="rm-bar" style="width:15%"></div></td></tr>
      <tr><td class="rm-mo">M4</td><td class="rm-tjm">£1,700</td><td class="rm-vinted">£1,500</td><td class="rm-total">£3,200</td><td><div class="rm-bar" style="width:23%"></div></td></tr>
      <tr><td class="rm-mo">M5</td><td class="rm-tjm">£2,400</td><td class="rm-vinted">£2,000</td><td class="rm-total">£4,400</td><td><div class="rm-bar" style="width:31%"></div></td></tr>
      <tr><td class="rm-mo">M6</td><td class="rm-tjm">£3,200</td><td class="rm-vinted">£2,500</td><td class="rm-total">£5,700</td><td><div class="rm-bar" style="width:41%"></div></td></tr>
      <tr><td class="rm-mo">M7</td><td class="rm-tjm">£4,200</td><td class="rm-vinted">£3,000</td><td class="rm-total">£7,200</td><td><div class="rm-bar" style="width:51%"></div></td></tr>
      <tr><td class="rm-mo">M8</td><td class="rm-tjm">£5,200</td><td class="rm-vinted">£3,800</td><td class="rm-total">£9,000</td><td><div class="rm-bar" style="width:64%"></div></td></tr>
      <tr><td class="rm-mo">M9</td><td class="rm-tjm">£6,000</td><td class="rm-vinted">£4,500</td><td class="rm-total">£10,500</td><td><div class="rm-bar" style="width:75%"></div></td></tr>
      <tr><td class="rm-mo">M10</td><td class="rm-tjm">£6,800</td><td class="rm-vinted">£5,200</td><td class="rm-total">£12,000</td><td><div class="rm-bar" style="width:86%"></div></td></tr>
      <tr><td class="rm-mo">M11</td><td class="rm-tjm">£7,500</td><td class="rm-vinted">£5,700</td><td class="rm-total">£13,200</td><td><div class="rm-bar" style="width:94%"></div></td></tr>
      <tr class="rm-target"><td class="rm-mo">M12</td><td class="rm-tjm">£8,000</td><td class="rm-vinted">£6,000</td><td class="rm-total">£14,000</td><td><div class="rm-bar" style="width:100%"></div></td></tr>
    </tbody>
  </table>
</div>

<!-- SECTION 3: PHASES -->
<div class="rm-section">
  <div class="rm-section-label">Section 03</div>
  <div class="rm-section-title">Daily Tasks by Phase</div>
  <p style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:16px;">Tap each phase to expand your daily actions.</p>

  <!-- PHASE 1 -->
  <div class="rm-phase rm-open" id="rmPhase1">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase1').classList.toggle('rm-open')">
      <div class="rm-phase-num">01</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#5B9BD5;">Foundation</div>
        <div class="rm-phase-title">Build the Machine</div>
        <div class="rm-phase-months">Months 1–2</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target">£700 → £1,300</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm">— TJM Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Go live on TikTok (5pm–6:30pm) <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">5x per week minimum. This is your #1 revenue driver right now.</span></div><div class="rm-time">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Post 1 sales content piece<span class="rm-task-note">Product shot + price + clear CTA. Simple. Repeat daily.</span></div><div class="rm-time">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Post 1 growth/value piece<span class="rm-task-note">Education, story, behind-the-scenes. Builds the audience that buys.</span></div><div class="rm-time">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Send 10 DMs to warm leads<span class="rm-task-note">Anyone who watched your live, commented or followed in last 7 days.</span></div><div class="rm-time">20 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Add 1 product to Shopify with full copy + photos<span class="rm-task-note">Proper title, description, tags, SEO slug. No half-done listings.</span></div><div class="rm-time">15 min</div></div>
      <div class="rm-stream-head va">— VA Daily Tasks (Brief this week)</div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Edit + schedule 2 TikTok posts from raw footage <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Reply to all TikTok/Instagram comments within 2 hours <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Log every new lead/enquiry into CRM <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Photograph + basic edit 10 Vinted items per day <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-stream-head vinted">— Vinted Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">List 10 items (until all current stock is live)<span class="rm-task-note">Goal: 100+ listings live by end of Month 1. You have the stock — this is just execution.</span></div><div class="rm-time">30 min</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Reply to all buyer messages within 1 hour <span class="rm-badge-va">VA assists</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Package + ship sold items daily (batch at post office)</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Note what sells and at what price<span class="rm-task-note">This data tells you what to restock. Don't skip it.</span></div></div>
    </div>
  </div>

  <!-- PHASE 2 -->
  <div class="rm-phase" id="rmPhase2">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase2').classList.toggle('rm-open')">
      <div class="rm-phase-num">02</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#4CAF79;">Momentum</div>
        <div class="rm-phase-title">Turn Up the Dial</div>
        <div class="rm-phase-months">Months 3–5</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target">£2,100 → £4,400</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm">— TJM Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">TikTok Live every weekday <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">You now have a track record — protect it. Consistency builds algorithmic trust.</span></div><div class="rm-time">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">1 sales post — start testing formats<span class="rm-task-note">Rotate: bundles, urgency, social proof, before/after. Track which converts best.</span></div><div class="rm-time">10 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">15+ DM follow-ups per day<span class="rm-task-note">Prioritise anyone who engaged in last 7 days. Use a script — vary the opener.</span></div><div class="rm-time">25 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Weekly email to your list (even if 50 people — start now)<span class="rm-task-note">You write the angle, VA formats and sends. One revenue email per week.</span></div><div class="rm-time">20 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Add 2 new products to Shopify per week</div><div class="rm-time">30 min/wk</div></div>
      <div class="rm-stream-head va">— VA Daily Tasks (Expand their role)</div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Edit + schedule 3 TikTok posts per day <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Repurpose 1 TikTok as Instagram Reel daily <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">CRM updated daily — new leads, follow-up dates logged <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">Vinted pipeline: VA now manages all listing (15+ items/day) <span class="rm-badge-va">VA leads</span></div></div>
      <div class="rm-stream-head vinted">— Vinted Daily Tasks</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">VA leads listing (15+ items/day) — Robert reviews pricing weekly <span class="rm-badge-va">VA leads</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Target: 150+ active listings live by end of Month 3<span class="rm-task-note">More listings = more surface area = more passive sales while you sleep.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Restock order placed when live listings drop below 100</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Ship daily or batch every 2 days</div><div class="rm-time">15 min</div></div>
    </div>
  </div>

  <!-- PHASE 3 -->
  <div class="rm-phase" id="rmPhase3">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase3').classList.toggle('rm-open')">
      <div class="rm-phase-num">03</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#D4AF37;">Scale</div>
        <div class="rm-phase-title">Systemise Everything</div>
        <div class="rm-phase-months">Months 6–9</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target">£5,700 → £10,500</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm">— TJM Daily Tasks (Robert's time drops)</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Live 5x/week <span class="rm-badge-nn">Non-negotiable</span><span class="rm-task-note">Robert's one remaining daily job is the live stream + DM closing. Everything else delegated.</span></div><div class="rm-time">90 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Close DMs from live — 20+ per day, use urgency and social proof</div><div class="rm-time">30 min</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Weekly: review sales data — identify top 20% SKUs, reorder stock</div><div class="rm-time">20 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Monthly: launch 1 new product line or bundle offer</div></div>
      <div class="rm-task"><div class="rm-dot purple"></div><div class="rm-task-text">VA handles 100% of content scheduling, CRM, email sends <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-stream-head vinted">— Vinted (VA-Led)</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">VA fully manages listing pipeline end-to-end <span class="rm-badge-va">VA</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Target: 400+ active listings maintained<span class="rm-task-note">At 2% daily sell-through on 400 listings = 8 sales/day. The maths works at volume.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Robert: weekly audit only — sell-through, pricing, profit vs target</div><div class="rm-time">15 min/wk</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Monthly restock placed from Vinted profits (self-funding)</div></div>
    </div>
  </div>

  <!-- PHASE 4 -->
  <div class="rm-phase" id="rmPhase4">
    <div class="rm-phase-header" onclick="document.getElementById('rmPhase4').classList.toggle('rm-open')">
      <div class="rm-phase-num">04</div>
      <div class="rm-phase-text">
        <div class="rm-phase-badge" style="color:#CF6679;">Optimise</div>
        <div class="rm-phase-title">Hit the Number</div>
        <div class="rm-phase-months">Months 10–12</div>
      </div>
      <div class="rm-phase-right">
        <div class="rm-phase-target">£12,000 → £14,000</div>
        <div class="rm-phase-chevron">▾</div>
      </div>
    </div>
    <div class="rm-phase-body">
      <div class="rm-stream-head tjm">— TJM: Focus Shifts to AOV + Conversion</div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Introduce £100–150 products and bundle deals on live<span class="rm-task-note">You don't need more orders — you need bigger orders. Push AOV from £75 to £95+.</span></div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Email list becomes a weekly revenue channel — "drop" style sends</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Shopify organic traffic starting to contribute (SEO from 5+ months of listings)</div></div>
      <div class="rm-task"><div class="rm-dot blue"></div><div class="rm-task-text">Review: what's driving 80% of revenue? Double it. Cut the rest.</div></div>
      <div class="rm-stream-head vinted">— Vinted: Move Up the Value Chain</div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Shift sourcing toward branded/hallmarked higher-margin pieces</div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">Push average selling price from £20 → £30+<span class="rm-task-note">Same volume, 50% more revenue. That's the Vinted lever at this stage.</span></div></div>
      <div class="rm-task"><div class="rm-dot green"></div><div class="rm-task-text">VA handles 95% — Robert reviews P&L weekly, nothing more</div></div>
    </div>
  </div>
</div>

<!-- SECTION 4: WEEKLY REVIEW -->
<div class="rm-section">
  <div class="rm-section-label">Section 04</div>
  <div class="rm-section-title">Weekly Review — Every Sunday (30 min)</div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text">TJM: Live viewers → DMs generated → conversion to sales. Is the funnel moving?</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text">TJM: Revenue vs monthly milestone — on track, behind, or ahead?</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text">Vinted: Active listings / items sold / avg sale price / weekly profit</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text">VA brief for next week — content themes, restock needs, priorities</div></div>
  <div class="rm-task"><div class="rm-dot gold"></div><div class="rm-task-text">Personal energy check — what drained you most? Can it be delegated or cut?</div></div>
</div>

<!-- SECTION 5: METRICS -->
<div class="rm-section">
  <div class="rm-section-label">Section 05</div>
  <div class="rm-section-title">Metrics to Track</div>
  <div class="rm-metrics-grid">
    <div class="rm-metric-card">
      <div class="rm-metric-title">TJM Funnel (weekly)</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Live viewers</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Profile visits</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>DMs sent</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Sales closed</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Avg order value</div>
    </div>
    <div class="rm-metric-card">
      <div class="rm-metric-title">Vinted (weekly)</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Active listings</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Items sold</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Avg sale price</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Weekly profit</div>
      <div class="rm-metric-item"><span style="color:#C9A84C;font-size:10px;">→</span>Sell-through rate</div>
    </div>
    <div class="rm-metric-card full">
      <div class="rm-metric-title">The one number that tells you everything</div>
      <div class="rm-metric-item" style="font-size:13px;color:#D4AF37;padding:8px 0;">Combined monthly profit vs milestone target — above or below the line?</div>
      <div class="rm-metric-item rm-metric-item-muted" style="font-size:11px;color:rgba(255,255,255,0.3);">If behind by more than 20% two months in a row → review the plan, don't just push harder.</div>
    </div>
  </div>
</div>

<!-- SECTION 6: TRUTHS -->
<div class="rm-section">
  <div class="rm-section-label">Section 06</div>
  <div class="rm-section-title">The Uncomfortable Truths</div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text"><strong class="rm-strong">TikTok lives are the only lever that matters in Months 1–6.</strong> Everything else is supporting cast. Skip lives = skip revenue.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text"><strong class="rm-strong">The VA is currently a bottleneck, not an asset.</strong> Brief them properly this week. 30 minutes of clarity now saves months of confusion.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text"><strong class="rm-strong">Vinted is a volume game.</strong> 10 listings won't move the needle. 400 listings maintained consistently will. Get the stock live fast.</div></div>
  <div class="rm-truth"><div class="rm-dot red" style="margin-top:6px;"></div><div class="rm-task-text"><strong class="rm-strong">The milestones are not straight lines.</strong> Months 1–3 will feel slow. Months 6–9 is where compounding kicks in. Stay in the process.</div></div>
  <div class="rm-truth"><div class="rm-dot gold" style="margin-top:6px;"></div><div class="rm-task-text" style="color:#D4AF37;"><strong>Your biggest competitive advantage is already doing this at 4:30am</strong> when everyone else hasn't started. The plan works — if the execution does.</div></div>
</div>

`;

}
