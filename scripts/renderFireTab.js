// renderFireTab.js — 🔥 FIRE Tab

export function renderFireTab(deps) {
  const { state, getTodayData, getSettings, getMonthStats } = deps;

  const settings      = getSettings();
  const startDate     = settings.startDate || '2026-03-16';
  const today         = new Date().toISOString().slice(0, 10);
  const challengeDays = settings.challengeDays || 90;
  const dayNum        = Math.max(1, Math.floor((new Date(today) - new Date(startDate)) / 86400000) + 1);
  const daysGone      = Math.min(dayNum - 1, challengeDays);
  const daysLeft      = Math.max(0, challengeDays - daysGone);
  const todayData     = getTodayData();
  const monthStats    = getMonthStats ? getMonthStats() : (state.data?.marchStats || {});

  const perSecond            = 333.33 / 86400;
  const now                  = new Date();
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const lostToday            = (perSecond * secondsSinceMidnight).toFixed(2);
  const birthday30           = new Date('2028-01-01');
  const daysUntil30          = Math.max(0, Math.floor((birthday30 - now) / 86400000));

  const hour = now.getHours();
  let firstStep, firstStepSub;
  if (!todayData.gym) {
    firstStep    = 'Get to the gym.';
    firstStepSub = "You said daily gym. It's not done yet. Everything starts with keeping your word to yourself — 30 minutes is enough. Go now.";
  } else if (!todayData.live && hour >= 15) {
    firstStep    = 'Go live on TikTok right now.';
    firstStepSub = "You've done the gym. The next £ you make today comes from a live. Open the app. Hit go live. The first 30 seconds are the hardest — after that it's easy.";
  } else if ((monthStats.sales || 0) === 0 && hour >= 10) {
    firstStep    = 'DM your 3 warmest leads.';
    firstStepSub = "No sale yet this month. Open the CRM, find your hottest leads, and send a personal message in the next 5 minutes. That's it. One action. Go.";
  } else if (hour < 9) {
    firstStep    = 'Block the next 2 hours for TJM.';
    firstStepSub = "The morning is your most valuable time. Before the world pulls at you — close everything else and work on the one thing that moves TJM forward today.";
  } else {
    firstStep    = 'Create one piece of content right now.';
    firstStepSub = "Film it, post it. One TikTok. One reel. One sales post. You don't need it to be perfect — you need it to exist. Do it in the next 10 minutes.";
  }

  const dreamLines = [
    "Your own front door. A home that's yours.",
    "Warda next to you — not worrying, not waiting — just living.",
    "An income that doesn't stop when you do.",
    "No alarm set by someone else. No shift. No ceiling.",
    "Every idea you've ever had — the resources to actually build it.",
    "Complete control over your time, your income, your life.",
  ];

  const consequences = [
    "Still working the family shop at 35.",
    "Watching someone else live in the home you pictured.",
    "The ideas you had — built by someone else, for someone else's dream.",
    "Warda watching you play small, year after year.",
    "Never knowing how far you could have actually gone.",
  ];

  return `
<style>
  /* All selectors scoped under #fire-root to beat dashboard specificity */
  #fire-root {
    padding: 0 0 40px 0;
    font-family: inherit;
  }

  /* ── SHARED CARD BASE ── */
  #fire-root .fc {
    border-radius: 12px !important;
    margin-bottom: 12px !important;
    padding: 22px !important;
    position: relative !important;
    overflow: hidden !important;
    background: #0d0d0d !important;
  }

  /* ── EYEBROW ── */
  #fire-root .fe {
    font-size: 9px !important;
    font-weight: 900 !important;
    letter-spacing: 4px !important;
    text-transform: uppercase !important;
    margin-bottom: 10px !important;
    display: block !important;
  }
  #fire-root .fe-orange { color: #FF6B00 !important; }
  #fire-root .fe-red    { color: #FF2020 !important; }
  #fire-root .fe-green  { color: #00D46A !important; }

  /* ── HERO ── */
  #fire-root .fc-hero {
    border: 2px solid #FF6B00 !important;
  }
  #fire-root .fc-hero::before {
    content: '' !important;
    position: absolute !important;
    top: 0; left: 0; right: 0 !important;
    height: 3px !important;
    background: linear-gradient(90deg, #FF6B00, #FFD000, #FF6B00) !important;
  }
  #fire-root .fh-headline {
    font-size: 26px !important;
    font-weight: 900 !important;
    color: #FFFFFF !important;
    line-height: 1.2 !important;
    letter-spacing: -0.5px !important;
    margin-bottom: 18px !important;
    text-transform: uppercase !important;
  }
  #fire-root .fh-headline span { color: #FF6B00 !important; }
  #fire-root .fd-list {
    list-style: none !important;
    padding: 0 !important; margin: 0 !important;
    display: flex !important; flex-direction: column !important; gap: 8px !important;
  }
  #fire-root .fd-item {
    display: flex !important; align-items: flex-start !important; gap: 10px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #CCCCCC !important;
    line-height: 1.4 !important;
  }
  #fire-root .fd-item::before {
    content: '▶' !important;
    color: #FF6B00 !important;
    font-size: 9px !important;
    flex-shrink: 0 !important;
    margin-top: 3px !important;
  }

  /* ── COST ── */
  #fire-root .fc-cost {
    border: 2px solid #FF2020 !important;
    text-align: center !important;
  }
  #fire-root .fc-cost::before {
    content: '' !important;
    position: absolute !important;
    top: 0; left: 0; right: 0 !important;
    height: 3px !important;
    background: #FF2020 !important;
  }
  #fire-root .cost-label {
    font-size: 10px !important;
    font-weight: 800 !important;
    letter-spacing: 2px !important;
    color: #888888 !important;
    text-transform: uppercase !important;
    margin-bottom: 6px !important;
    display: block !important;
  }
  #fire-root .cost-number {
    font-size: 60px !important;
    font-weight: 900 !important;
    color: #FF2020 !important;
    letter-spacing: -2px !important;
    line-height: 1 !important;
    margin-bottom: 10px !important;
    display: block !important;
    font-variant-numeric: tabular-nums !important;
    animation: fireCostPulse 2s ease-in-out infinite !important;
    text-shadow: 0 0 30px rgba(255,32,32,0.5) !important;
  }
  #fire-root .cost-sub {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #666666 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    line-height: 1.6 !important;
    display: block !important;
  }
  #fire-root .cost-sub b { color: #AAAAAA !important; }

  /* ── URGENCY GRID ── */
  #fire-root .fu-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 10px !important;
    margin-bottom: 12px !important;
  }
  #fire-root .fu-card {
    background: #0d0d0d !important;
    border: 1px solid #252525 !important;
    border-radius: 10px !important;
    padding: 16px !important;
    text-align: center !important;
  }
  #fire-root .fu-val {
    font-size: 38px !important;
    font-weight: 900 !important;
    line-height: 1 !important;
    margin-bottom: 6px !important;
    letter-spacing: -1px !important;
    display: block !important;
  }
  #fire-root .fu-val.amber { color: #FFB300 !important; }
  #fire-root .fu-val.red   { color: #FF2020 !important; text-shadow: 0 0 20px rgba(255,32,32,0.4) !important; }
  #fire-root .fu-val.green { color: #00D46A !important; }
  #fire-root .fu-lbl {
    font-size: 8px !important;
    font-weight: 900 !important;
    letter-spacing: 2px !important;
    color: #555555 !important;
    text-transform: uppercase !important;
    display: block !important;
  }

  /* ── CONSEQUENCE ── */
  #fire-root .fc-cons {
    border: 2px solid #FF2020 !important;
    border-left: 5px solid #FF2020 !important;
  }
  #fire-root .cons-headline {
    font-size: 14px !important;
    font-weight: 900 !important;
    color: #FFFFFF !important;
    margin-bottom: 16px !important;
    line-height: 1.35 !important;
    text-transform: uppercase !important;
    display: block !important;
  }
  #fire-root .cons-list {
    list-style: none !important;
    padding: 0 !important; margin: 0 !important;
    display: flex !important; flex-direction: column !important; gap: 10px !important;
  }
  #fire-root .cons-item {
    display: flex !important; align-items: flex-start !important; gap: 10px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #999999 !important;
    line-height: 1.4 !important;
  }
  #fire-root .cons-item::before {
    content: '✗' !important;
    color: #FF2020 !important;
    font-weight: 900 !important;
    font-size: 15px !important;
    flex-shrink: 0 !important;
    line-height: 1.2 !important;
  }

  /* ── FIRST STEP ── */
  #fire-root .fc-step {
    background: #001508 !important;
    border: 2px solid #00D46A !important;
  }
  #fire-root .fc-step::before {
    content: '' !important;
    position: absolute !important;
    top: 0; left: 0; right: 0 !important;
    height: 3px !important;
    background: #00D46A !important;
    box-shadow: 0 0 14px rgba(0,212,106,0.7) !important;
  }
  #fire-root .step-headline {
    font-size: 24px !important;
    font-weight: 900 !important;
    color: #FFFFFF !important;
    margin-bottom: 10px !important;
    line-height: 1.15 !important;
    text-transform: uppercase !important;
    display: block !important;
  }
  #fire-root .step-sub {
    font-size: 13px !important;
    font-weight: 600 !important;
    color: #AAAAAA !important;
    line-height: 1.65 !important;
    display: block !important;
  }

  /* ── MANTRA ── */
  #fire-root .fc-mantra {
    border: 1px solid #252525 !important;
    border-left: 4px solid #FF6B00 !important;
  }
  #fire-root .mantra-text {
    font-size: 15px !important;
    font-weight: 800 !important;
    color: #FFFFFF !important;
    line-height: 1.55 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.3px !important;
    display: block !important;
  }
  #fire-root .mantra-text span { color: #FF6B00 !important; }

  @keyframes fireCostPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
</style>

<div id="fire-root">

  <!-- DREAM -->
  <div class="fc fc-hero">
    <span class="fe fe-orange">🔥 This is what you're building</span>
    <div class="fh-headline">You don't want a job.<br>You want a <span>life.</span></div>
    <ul class="fd-list">
      ${dreamLines.map(l => `<li class="fd-item">${l}</li>`).join('')}
    </ul>
  </div>

  <!-- COST -->
  <div class="fc fc-cost">
    <span class="fe fe-red">💸 Cost of inaction today</span>
    <span class="cost-label">Since midnight you have lost</span>
    <span class="cost-number" id="fire-lost-counter">£${lostToday}</span>
    <span class="cost-sub">£10k/month = <b>£333 every single day.</b><br>That clock never stops. Neither should you.</span>
  </div>

  <!-- URGENCY GRID -->
  <div class="fu-grid">
    <div class="fu-card">
      <span class="fu-val amber">${daysGone}</span>
      <span class="fu-lbl">Days Gone</span>
    </div>
    <div class="fu-card">
      <span class="fu-val ${daysLeft < 30 ? 'red' : 'amber'}">${daysLeft}</span>
      <span class="fu-lbl">Days Left</span>
    </div>
    <div class="fu-card">
      <span class="fu-val red">${daysUntil30}</span>
      <span class="fu-lbl">Days to Age 30</span>
    </div>
    <div class="fu-card">
      <span class="fu-val green">${monthStats.sales || 0}</span>
      <span class="fu-lbl">Sales This Month</span>
    </div>
  </div>

  <!-- CONSEQUENCE -->
  <div class="fc fc-cons">
    <span class="fe fe-red">⚠ If you stay comfortable</span>
    <span class="cons-headline">This is the life waiting for the version of you who doesn't act.</span>
    <ul class="cons-list">
      ${consequences.map(c => `<li class="cons-item">${c}</li>`).join('')}
    </ul>
  </div>

  <!-- FIRST STEP -->
  <div class="fc fc-step">
    <span class="fe fe-green">✅ Your next move — right now</span>
    <span class="step-headline">${firstStep}</span>
    <span class="step-sub">${firstStepSub}</span>
  </div>

  <!-- MANTRA -->
  <div class="fc fc-mantra">
    <span class="mantra-text">"The life you want is on the other side of the action you keep putting off. <span>Do it now.</span>"</span>
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
