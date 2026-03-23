// renderFireTab.js — 🔥 FIRE Tab
// Visionary motivation: WHY → COST OF INACTION → FIRST STEP

export function renderFireTab(deps) {
  const { state, getTodayData, getSettings, getStreak, getMonthStats } = deps;

  // ── Compute urgency numbers ───────────────────────────────────────────────
  const settings      = getSettings();
  const startDate     = settings.startDate || '2026-03-16';
  const today         = new Date().toISOString().slice(0, 10);
  const challengeDays = settings.challengeDays || 90;
  const dayNum        = Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1);
  const daysGone      = Math.min(dayNum - 1, challengeDays);
  const daysLeft      = Math.max(0, challengeDays - daysGone);

  const todayData  = getTodayData();
  const monthStats = getMonthStats ? getMonthStats() : (state.data?.marchStats || {});

  // Cost of inaction — £10k/month = £333.33/day = £0.003858/second
  const perSecond           = 333.33 / 86400;
  const now                 = new Date();
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const lostToday           = (perSecond * secondsSinceMidnight).toFixed(2);

  // Days until approximate 30th birthday
  const birthday30   = new Date('2028-01-01');
  const daysUntil30  = Math.max(0, Math.floor((birthday30 - now) / 86400000));

  // ── Dynamic First Step ─────────────────────────────────────────────────────
  const hour = now.getHours();
  let firstStep, firstStepSub;

  if (!todayData.gym) {
    firstStep    = 'Get to the gym.';
    firstStepSub = 'You said daily gym. It\'s not done yet. Everything starts with keeping your word to yourself — 30 minutes is enough. Go now.';
  } else if (!todayData.live && hour >= 15) {
    firstStep    = 'Go live on TikTok right now.';
    firstStepSub = 'You\'ve done the gym. The next £ you make today comes from a live. Open the app. Hit go live. The first 30 seconds are the hardest — after that it\'s easy.';
  } else if ((monthStats.sales || 0) === 0 && hour >= 10) {
    firstStep    = 'DM your 3 warmest leads.';
    firstStepSub = 'No sale yet this month. Open the CRM, find your hottest leads, and send a personal message in the next 5 minutes. That\'s it. One action. Go.';
  } else if (hour < 9) {
    firstStep    = 'Block the next 2 hours for TJM.';
    firstStepSub = 'The morning is your most valuable time. Before the world pulls at you — close everything else and work on the one thing that moves TJM forward today.';
  } else {
    firstStep    = 'Create one piece of content right now.';
    firstStepSub = 'Film it, post it. One TikTok. One reel. One sales post. You don\'t need it to be perfect — you need it to exist. Do it in the next 10 minutes.';
  }

  // ── Dream lines ────────────────────────────────────────────────────────────
  const dreamLines = [
    'Your own front door. A home that\'s yours.',
    'Warda next to you — not worrying, not waiting — just living.',
    'An income that doesn\'t stop when you do.',
    'No alarm set by someone else. No shift. No ceiling.',
    'Every idea you\'ve ever had — the resources to actually build it.',
    'Complete control over your time, your income, your life.',
  ];

  // ── Consequence lines ──────────────────────────────────────────────────────
  const consequences = [
    'Still working the family shop at 35.',
    'Watching someone else live in the home you pictured.',
    'The ideas you had — built by someone else, for someone else\'s dream.',
    'Warda watching you play small, year after year.',
    'Never knowing how far you could have actually gone.',
  ];

  return `
<style>
  .fire-tab {
    padding: 0 0 40px 0;
    font-family: inherit;
  }

  /* ── HERO ── */
  .fire-hero {
    background: linear-gradient(160deg, #0d0d0d 0%, #1a0a00 60%, #2a1000 100%);
    border: 1px solid rgba(255,140,0,0.18);
    border-radius: 16px;
    padding: 28px 24px 24px;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }
  .fire-hero::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #ff6a00, #ffb347, #ff6a00, transparent);
    opacity: 0.6;
  }
  .fire-hero-eyebrow {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #ff8c00;
    text-transform: uppercase;
    margin-bottom: 10px;
    opacity: 0.8;
  }
  .fire-hero-headline {
    font-size: 22px;
    font-weight: 900;
    color: #fff;
    line-height: 1.25;
    letter-spacing: -0.3px;
    margin-bottom: 18px;
  }
  .fire-hero-headline span { color: #ffb347; }
  .fire-dream-list {
    list-style: none;
    padding: 0; margin: 0;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .fire-dream-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: rgba(255,255,255,0.72);
    line-height: 1.4;
  }
  .fire-dream-item::before {
    content: '→';
    color: #ff8c00;
    font-weight: 900;
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* ── COST COUNTER ── */
  .fire-cost-block {
    background: linear-gradient(135deg, #0d0d0d 0%, #1a0500 100%);
    border: 1px solid rgba(231,76,60,0.3);
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
    text-align: center;
  }
  .fire-cost-eyebrow {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #e74c3c;
    text-transform: uppercase;
    margin-bottom: 6px;
    opacity: 0.8;
  }
  .fire-cost-label {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    margin-bottom: 8px;
    letter-spacing: 0.3px;
  }
  .fire-cost-number {
    font-size: 52px;
    font-weight: 900;
    color: #e74c3c;
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 10px;
    font-variant-numeric: tabular-nums;
    animation: firePulse 3s ease-in-out infinite;
  }
  .fire-cost-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.32);
    line-height: 1.6;
  }
  .fire-cost-sub strong { color: rgba(255,255,255,0.58); }

  /* ── URGENCY GRID ── */
  .fire-urgency-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .fire-urgency-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .fire-urgency-value {
    font-size: 30px;
    font-weight: 900;
    color: #fff;
    line-height: 1;
    margin-bottom: 5px;
    letter-spacing: -0.5px;
  }
  .fire-urgency-value.amber { color: #ffb347; }
  .fire-urgency-value.red   { color: #e74c3c; }
  .fire-urgency-value.green { color: #2ecc71; }
  .fire-urgency-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.28);
    text-transform: uppercase;
  }

  /* ── CONSEQUENCE ── */
  .fire-consequence-block {
    background: rgba(231,76,60,0.04);
    border: 1px solid rgba(231,76,60,0.18);
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
  }
  .fire-consequence-eyebrow {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #e74c3c;
    text-transform: uppercase;
    margin-bottom: 12px;
    opacity: 0.8;
  }
  .fire-consequence-headline {
    font-size: 15px;
    font-weight: 800;
    color: rgba(255,255,255,0.85);
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .fire-consequence-list {
    list-style: none;
    padding: 0; margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fire-consequence-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 12.5px;
    color: rgba(255,255,255,0.45);
    line-height: 1.4;
  }
  .fire-consequence-item::before {
    content: '✗';
    color: #e74c3c;
    font-weight: 900;
    flex-shrink: 0;
  }

  /* ── FIRST STEP ── */
  .fire-step-block {
    background: linear-gradient(135deg, #0a1a0a 0%, #0d2a0d 100%);
    border: 1px solid rgba(46,204,113,0.28);
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }
  .fire-step-block::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #2ecc71, transparent);
  }
  .fire-step-eyebrow {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #2ecc71;
    text-transform: uppercase;
    margin-bottom: 10px;
    opacity: 0.8;
  }
  .fire-step-headline {
    font-size: 21px;
    font-weight: 900;
    color: #fff;
    margin-bottom: 10px;
    line-height: 1.2;
    letter-spacing: -0.3px;
  }
  .fire-step-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.52);
    line-height: 1.65;
  }

  /* ── MANTRA ── */
  .fire-mantra {
    background: linear-gradient(135deg, #0d0d0d, #1a1200);
    border: 1px solid rgba(255,180,0,0.1);
    border-radius: 14px;
    padding: 24px;
    text-align: center;
  }
  .fire-mantra-text {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
    line-height: 1.65;
    font-style: italic;
  }
  .fire-mantra-text span {
    color: #ffb347;
    font-style: normal;
    font-weight: 900;
  }

  @keyframes firePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.65; }
  }
</style>

<div class="fire-tab">

  <!-- THE DREAM -->
  <div class="fire-hero">
    <div class="fire-hero-eyebrow">🔥 This is what you're building</div>
    <div class="fire-hero-headline">You don't want a job.<br>You want a <span>life.</span></div>
    <ul class="fire-dream-list">
      ${dreamLines.map(l => `<li class="fire-dream-item">${l}</li>`).join('')}
    </ul>
  </div>

  <!-- LIVE COST COUNTER -->
  <div class="fire-cost-block">
    <div class="fire-cost-eyebrow">💸 The cost of today</div>
    <div class="fire-cost-label">Since midnight, inaction has already cost you</div>
    <div class="fire-cost-number" id="fire-lost-counter">£${lostToday}</div>
    <div class="fire-cost-sub">
      Your £10k/month target = <strong>£333 every single day.</strong><br>
      That clock never stops. Neither should you.
    </div>
  </div>

  <!-- URGENCY STATS -->
  <div class="fire-urgency-row">
    <div class="fire-urgency-card">
      <div class="fire-urgency-value amber">${daysGone}</div>
      <div class="fire-urgency-label">Days Gone</div>
    </div>
    <div class="fire-urgency-card">
      <div class="fire-urgency-value ${daysLeft < 30 ? 'red' : 'amber'}">${daysLeft}</div>
      <div class="fire-urgency-label">Days Left</div>
    </div>
    <div class="fire-urgency-card">
      <div class="fire-urgency-value red">${daysUntil30}</div>
      <div class="fire-urgency-label">Days to Age 30</div>
    </div>
    <div class="fire-urgency-card">
      <div class="fire-urgency-value green">${monthStats.sales || 0}</div>
      <div class="fire-urgency-label">Sales This Month</div>
    </div>
  </div>

  <!-- THE CONSEQUENCE -->
  <div class="fire-consequence-block">
    <div class="fire-consequence-eyebrow">⚠ If you stay comfortable</div>
    <div class="fire-consequence-headline">This is the life waiting for the version of you who doesn't act.</div>
    <ul class="fire-consequence-list">
      ${consequences.map(c => `<li class="fire-consequence-item">${c}</li>`).join('')}
    </ul>
  </div>

  <!-- THE FIRST STEP -->
  <div class="fire-step-block">
    <div class="fire-step-eyebrow">✅ Your next move — right now</div>
    <div class="fire-step-headline">${firstStep}</div>
    <div class="fire-step-sub">${firstStepSub}</div>
  </div>

  <!-- MANTRA -->
  <div class="fire-mantra">
    <div class="fire-mantra-text">
      "The life you want is on the other side of the action<br>
      you keep putting off. <span>Do it now.</span>"
    </div>
  </div>

</div>

<script>
  (function() {
    const perSecond = 333.33 / 86400;
    function tick() {
      const n    = new Date();
      const secs = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      const lost = (perSecond * secs).toFixed(2);
      const el   = document.getElementById('fire-lost-counter');
      if (el) el.textContent = '£' + lost;
    }
    tick();
    setInterval(tick, 1000);
  })();
<\/script>
  `;
}
