// renderFireTab.js — 🔥 FIRE Tab
// Bold, aggressive, masculine. No soft colours.

export function renderFireTab(deps) {
  const { state, getTodayData, getSettings, getStreak, getMonthStats } = deps;

  const settings       = getSettings();
  const startDate      = settings.startDate || '2026-03-16';
  const today          = new Date().toISOString().slice(0, 10);
  const challengeDays  = settings.challengeDays || 90;
  const dayNum         = Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1);
  const daysGone       = Math.min(dayNum - 1, challengeDays);
  const daysLeft       = Math.max(0, challengeDays - daysGone);

  const todayData  = getTodayData();
  const monthStats = getMonthStats ? getMonthStats() : (state.data?.marchStats || {});

  const perSecond            = 333.33 / 86400;
  const now                  = new Date();
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const lostToday            = (perSecond * secondsSinceMidnight).toFixed(2);

  const birthday30  = new Date('2028-01-01');
  const daysUntil30 = Math.max(0, Math.floor((birthday30 - now) / 86400000));

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

  const dreamLines = [
    'Your own front door. A home that\'s yours.',
    'Warda next to you — not worrying, not waiting — just living.',
    'An income that doesn\'t stop when you do.',
    'No alarm set by someone else. No shift. No ceiling.',
    'Every idea you\'ve ever had — the resources to actually build it.',
    'Complete control over your time, your income, your life.',
  ];

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

  /* ─── HERO — black with blazing orange border ─── */
  .fire-hero {
    background: #0a0a0a;
    border: 2px solid #FF6B00;
    border-radius: 12px;
    padding: 26px 22px;
    margin-bottom: 12px;
    position: relative;
    overflow: hidden;
  }
  body.light .fire-hero {
    background: #111;
    border-color: #FF6B00;
  }
  .fire-hero::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #FF6B00, #FFD000, #FF6B00);
  }
  .fire-eyebrow {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .fire-eyebrow.orange { color: #FF6B00; }
  .fire-eyebrow.red    { color: #FF2020; }
  .fire-eyebrow.green  { color: #00D46A; }

  .fire-hero-headline {
    font-size: 26px;
    font-weight: 900;
    color: #FFFFFF;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin-bottom: 18px;
    text-transform: uppercase;
  }
  .fire-hero-headline span { color: #FF6B00; }

  .fire-dream-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .fire-dream-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #CCCCCC;
    line-height: 1.4;
  }
  .fire-dream-item::before {
    content: '▶';
    color: #FF6B00;
    font-size: 9px;
    flex-shrink: 0;
    margin-top: 3px;
  }

  /* ─── COST COUNTER ─── */
  .fire-cost-block {
    background: #0a0a0a;
    border: 2px solid #FF2020;
    border-radius: 12px;
    padding: 22px 20px;
    margin-bottom: 12px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  body.light .fire-cost-block {
    background: #111;
    border-color: #FF2020;
  }
  .fire-cost-block::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #FF2020;
  }
  .fire-cost-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
  }
  .fire-cost-number {
    font-size: 58px;
    font-weight: 900;
    color: #FF2020;
    letter-spacing: -2px;
    line-height: 1;
    margin-bottom: 10px;
    font-variant-numeric: tabular-nums;
    animation: firePulse 2s ease-in-out infinite;
    text-shadow: 0 0 30px rgba(255, 32, 32, 0.4);
  }
  .fire-cost-sub {
    font-size: 11px;
    font-weight: 600;
    color: #666;
    line-height: 1.6;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .fire-cost-sub strong { color: #aaa; }

  /* ─── URGENCY GRID ─── */
  .fire-urgency-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
  }
  .fire-urgency-card {
    background: #0a0a0a;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 16px;
    text-align: center;
  }
  body.light .fire-urgency-card {
    background: #111;
    border-color: #333;
  }
  .fire-urgency-value {
    font-size: 36px;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 5px;
    letter-spacing: -1px;
  }
  .fire-urgency-value.amber { color: #FFB300; }
  .fire-urgency-value.red   { color: #FF2020; text-shadow: 0 0 20px rgba(255,32,32,0.35); }
  .fire-urgency-value.green { color: #00D46A; }
  .fire-urgency-label {
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 2.5px;
    color: #555;
    text-transform: uppercase;
  }

  /* ─── CONSEQUENCE ─── */
  .fire-consequence-block {
    background: #0a0a0a;
    border: 2px solid #FF2020;
    border-left: 5px solid #FF2020;
    border-radius: 12px;
    padding: 22px;
    margin-bottom: 12px;
  }
  body.light .fire-consequence-block {
    background: #111;
  }
  .fire-consequence-headline {
    font-size: 15px;
    font-weight: 900;
    color: #FFFFFF;
    margin-bottom: 16px;
    line-height: 1.35;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .fire-consequence-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .fire-consequence-item {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #999;
    line-height: 1.4;
  }
  .fire-consequence-item::before {
    content: '✗';
    color: #FF2020;
    font-weight: 900;
    font-size: 14px;
    flex-shrink: 0;
    line-height: 1.3;
  }

  /* ─── FIRST STEP ─── */
  .fire-step-block {
    background: #001a0d;
    border: 2px solid #00D46A;
    border-radius: 12px;
    padding: 22px;
    margin-bottom: 12px;
    position: relative;
    overflow: hidden;
  }
  body.light .fire-step-block {
    background: #001a0d;
    border-color: #00D46A;
  }
  .fire-step-block::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: #00D46A;
    box-shadow: 0 0 12px rgba(0, 212, 106, 0.6);
  }
  .fire-step-headline {
    font-size: 24px;
    font-weight: 900;
    color: #FFFFFF;
    margin-bottom: 10px;
    line-height: 1.15;
    letter-spacing: -0.3px;
    text-transform: uppercase;
  }
  .fire-step-sub {
    font-size: 13px;
    font-weight: 600;
    color: #999;
    line-height: 1.65;
  }

  /* ─── MANTRA ─── */
  .fire-mantra {
    background: #0a0a0a;
    border: 1px solid #333;
    border-left: 4px solid #FF6B00;
    border-radius: 12px;
    padding: 22px;
    text-align: left;
  }
  body.light .fire-mantra {
    background: #111;
    border-color: #333;
    border-left-color: #FF6B00;
  }
  .fire-mantra-text {
    font-size: 15px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1.55;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .fire-mantra-text span {
    color: #FF6B00;
  }

  @keyframes firePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.55; }
  }
</style>

<div class="fire-tab">

  <div class="fire-hero">
    <div class="fire-eyebrow orange">🔥 This is what you're building</div>
    <div class="fire-hero-headline">You don't want a job.<br>You want a <span>life.</span></div>
    <ul class="fire-dream-list">
      ${dreamLines.map(l => `<li class="fire-dream-item">${l}</li>`).join('')}
    </ul>
  </div>

  <div class="fire-cost-block">
    <div class="fire-eyebrow red">💸 Cost of inaction today</div>
    <div class="fire-cost-label">Since midnight you have lost</div>
    <div class="fire-cost-number" id="fire-lost-counter">£${lostToday}</div>
    <div class="fire-cost-sub">
      £10k/month = <strong>£333 every single day.</strong><br>
      That clock never stops. Neither should you.
    </div>
  </div>

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

  <div class="fire-consequence-block">
    <div class="fire-eyebrow red">⚠ If you stay comfortable</div>
    <div class="fire-consequence-headline">This is the life waiting for the version of you who doesn't act.</div>
    <ul class="fire-consequence-list">
      ${consequences.map(c => `<li class="fire-consequence-item">${c}</li>`).join('')}
    </ul>
  </div>

  <div class="fire-step-block">
    <div class="fire-eyebrow green">✅ Your next move — right now</div>
    <div class="fire-step-headline">${firstStep}</div>
    <div class="fire-step-sub">${firstStepSub}</div>
  </div>

  <div class="fire-mantra">
    <div class="fire-mantra-text">
      "The life you want is on the other side of the action you keep putting off. <span>Do it now.</span>"
    </div>
  </div>

</div>

<script>
  (function() {
    const perSecond = 333.33 / 86400;
    function tick() {
      const n    = new Date();
      const secs = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
      const el   = document.getElementById('fire-lost-counter');
      if (el) el.textContent = '£' + (perSecond * secs).toFixed(2);
    }
    tick();
    setInterval(tick, 1000);
  })();
<\/script>
  `;
}
