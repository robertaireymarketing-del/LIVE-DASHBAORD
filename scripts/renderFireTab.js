// ============================================================
// FIRE TAB — Daily ignition page for Robert Airey / TJM
// ============================================================

window.renderFireTab = function (container) {
  // Days remaining to £10k/month milestone (target: 30th birthday)
  // Robert is 28 — approximate target date: ~2 years out
  const TARGET_DATE = new Date("2028-01-01");
  const now = new Date();
  const daysLeft = Math.ceil((TARGET_DATE - now) / (1000 * 60 * 60 * 24));

  // Challenge end date
  const CHALLENGE_END = new Date("2026-06-13");
  const challengeDays = Math.max(0, Math.ceil((CHALLENGE_END - now) / (1000 * 60 * 60 * 24)));

  const affirmations = [
    "I wake at 4:30 when others are still asleep. This is not suffering — this is selection.",
    "I don't wait to feel motivated. I move. The fire follows the action.",
    "My body is a statement of intent. Every session is a vote for the man I'm becoming.",
    "£10,000 a month is not a fantasy. It is a deadline I am honouring today.",
    "TJM is not just a business. It is the physical proof that I do not accept average.",
    "Marcus Aurelius didn't wait for perfect conditions. He served his duty. So do I.",
    "Every live, every listing, every rep — compounding silently toward something they'll call overnight success.",
    "Warda, my legacy, my future — they all depend on who I choose to be in this exact moment.",
    "I am not managed by my moods. I am built on my decisions.",
    "The man who gets to £10k a month is the man who showed up on the days he didn't feel like it.",
  ];

  const consequences = [
    "Still in the family shop at 32 — watching someone younger build what you designed in your head.",
    "240lbs. Still telling yourself you'll start properly on Monday.",
    "TJM — that thing you almost built. The idea that almost happened.",
    "The moment you realise the window closed while you were waiting to feel ready.",
  ];

  let currentAffirmation = 0;
  let currentConsequence = 0;

  container.innerHTML = `
    <div class="fire-tab" id="fireTabRoot">

      <!-- BACKGROUND EMBERS -->
      <div class="fire-embers" id="fireEmbers"></div>

      <!-- SECTION 1: IDENTITY ANCHOR -->
      <section class="fire-section fire-identity" data-reveal>
        <div class="fire-eyebrow">WHO YOU ARE</div>
        <h1 class="fire-name">ROBERT AIREY</h1>
        <p class="fire-identity-line">
          Entrepreneur. Builder. The man who chose the hard road.<br>
          You don't run on mood. You run on <span class="fire-gold">mission.</span>
        </p>
        <div class="fire-rule"></div>
        <blockquote class="fire-stoic">
          "You have power over your mind — not outside events. Realise this, and you will find strength."
          <cite>— Marcus Aurelius</cite>
        </blockquote>
      </section>

      <!-- SECTION 2: THE REAL GOAL -->
      <section class="fire-section fire-mission" data-reveal>
        <div class="fire-eyebrow">THE MISSION THAT ACTUALLY MATTERS</div>
        <div class="fire-twin-goals">
          <div class="fire-goal-card fire-goal-money">
            <div class="fire-goal-label">INCOME TARGET</div>
            <div class="fire-goal-big">£10k</div>
            <div class="fire-goal-sub">per month</div>
            <div class="fire-goal-when">Before you turn 30</div>
            <div class="fire-goal-days">${daysLeft.toLocaleString()} days to make it real</div>
          </div>
          <div class="fire-goal-card fire-goal-body">
            <div class="fire-goal-label">BODY TARGET</div>
            <div class="fire-goal-big">220lb</div>
            <div class="fire-goal-sub">at 14% body fat</div>
            <div class="fire-goal-when">The next version of you</div>
            <div class="fire-goal-days">${challengeDays} days left in this challenge</div>
          </div>
        </div>
        <p class="fire-mission-note">
          The £400M vision is real. But <em>this</em> is the goal that changes your daily life.<br>
          This is what freedom actually feels like. This is what you're building toward <strong>right now.</strong>
        </p>
      </section>

      <!-- SECTION 3: COST OF INACTION -->
      <section class="fire-section fire-consequence" data-reveal>
        <div class="fire-eyebrow">WHAT INACTION ACTUALLY LOOKS LIKE</div>
        <div class="fire-consequence-box" id="consequenceBox">
          <div class="fire-consequence-icon">⚠</div>
          <p class="fire-consequence-text" id="consequenceText">${consequences[0]}</p>
        </div>
        <button class="fire-btn-ghost" id="nextConsequence">Show me another reality to avoid →</button>
      </section>

      <!-- SECTION 4: AFFIRMATIONS -->
      <section class="fire-section fire-affirmations" data-reveal>
        <div class="fire-eyebrow">IDENTITY STATEMENT</div>
        <div class="fire-affirmation-wrap">
          <div class="fire-affirmation-text" id="affirmationText">${affirmations[0]}</div>
          <div class="fire-affirmation-nav">
            <button class="fire-aff-btn" id="prevAff">←</button>
            <span class="fire-aff-count" id="affCount">1 / ${affirmations.length}</span>
            <button class="fire-aff-btn" id="nextAff">→</button>
          </div>
        </div>
      </section>

      <!-- SECTION 5: IGNITE — THE NOW ACTION -->
      <section class="fire-section fire-ignite" data-reveal>
        <div class="fire-eyebrow">RIGHT NOW</div>
        <div class="fire-now-wrap">
          <div class="fire-now-label">The next 30 minutes. One thing.</div>
          <div class="fire-now-input-wrap">
            <input type="text" class="fire-now-input" id="fireNowInput" 
              placeholder="What are you doing next? (e.g. photograph 5 Vinted items)" />
          </div>
          <button class="fire-ignite-btn" id="fireIgniteBtn">
            <span class="fire-ignite-icon">🔥</span>
            <span>LOCK IN & GO</span>
          </button>
          <div class="fire-locked-msg" id="fireLockedMsg" style="display:none;">
            <div class="fire-locked-inner">
              <div class="fire-locked-check">✓</div>
              <div class="fire-locked-text" id="fireLockedText"></div>
              <div class="fire-locked-sub">Stop reading. Close this tab. Start.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <div class="fire-footer">
        The difference between who you are and who you want to be is what you do today.
      </div>

    </div>

    <style>
      /* ===== FIRE TAB STYLES ===== */
      .fire-tab {
        position: relative;
        min-height: 100%;
        background: #0a0a0a;
        color: #e8e0d0;
        font-family: 'Georgia', serif;
        overflow-x: hidden;
        padding-bottom: 80px;
      }

      /* Ember particles */
      .fire-embers {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }
      .ember {
        position: absolute;
        bottom: -10px;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: #c9a84c;
        opacity: 0;
        animation: riseEmber linear infinite;
      }
      @keyframes riseEmber {
        0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
        10%  { opacity: 0.8; }
        90%  { opacity: 0.3; }
        100% { transform: translateY(-100vh) translateX(var(--drift)) scale(0.2); opacity: 0; }
      }

      /* Section base */
      .fire-section {
        position: relative;
        z-index: 1;
        max-width: 780px;
        margin: 0 auto;
        padding: 60px 32px 40px;
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      .fire-section.revealed {
        opacity: 1;
        transform: translateY(0);
      }

      .fire-eyebrow {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        letter-spacing: 4px;
        color: #c9a84c;
        text-transform: uppercase;
        margin-bottom: 18px;
        opacity: 0.8;
      }

      /* ---- IDENTITY ---- */
      .fire-identity { padding-top: 80px; }
      .fire-name {
        font-family: 'Georgia', serif;
        font-size: clamp(48px, 10vw, 88px);
        font-weight: 700;
        letter-spacing: -1px;
        color: #fff;
        margin: 0 0 20px;
        line-height: 1;
      }
      .fire-identity-line {
        font-size: 18px;
        line-height: 1.7;
        color: #b8b0a0;
        margin-bottom: 32px;
      }
      .fire-gold { color: #c9a84c; font-style: italic; }
      .fire-rule {
        width: 60px;
        height: 2px;
        background: #c9a84c;
        margin: 32px 0;
        opacity: 0.6;
      }
      .fire-stoic {
        border-left: 2px solid #c9a84c44;
        margin: 0;
        padding: 16px 24px;
        font-size: 15px;
        font-style: italic;
        color: #888;
        line-height: 1.8;
      }
      .fire-stoic cite {
        display: block;
        margin-top: 10px;
        font-size: 12px;
        letter-spacing: 1px;
        color: #c9a84c;
        font-style: normal;
      }

      /* ---- MISSION ---- */
      .fire-mission { background: #0d0d0d; border-radius: 4px; }
      .fire-twin-goals {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin: 24px 0;
      }
      @media(max-width: 500px) { .fire-twin-goals { grid-template-columns: 1fr; } }
      .fire-goal-card {
        background: #111;
        border: 1px solid #222;
        border-radius: 4px;
        padding: 28px 24px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .fire-goal-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 2px;
        background: #c9a84c;
      }
      .fire-goal-label {
        font-family: 'Courier New', monospace;
        font-size: 9px;
        letter-spacing: 3px;
        color: #666;
        margin-bottom: 12px;
      }
      .fire-goal-big {
        font-size: clamp(40px, 8vw, 60px);
        font-weight: 700;
        color: #c9a84c;
        line-height: 1;
        margin-bottom: 4px;
      }
      .fire-goal-sub {
        font-size: 13px;
        color: #888;
        margin-bottom: 16px;
      }
      .fire-goal-when {
        font-size: 12px;
        color: #fff;
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .fire-goal-days {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: #c9a84c;
        opacity: 0.7;
      }
      .fire-mission-note {
        font-size: 15px;
        color: #888;
        line-height: 1.8;
        text-align: center;
        margin-top: 24px;
      }
      .fire-mission-note em { color: #c9a84c; font-style: italic; }
      .fire-mission-note strong { color: #e8e0d0; }

      /* ---- CONSEQUENCE ---- */
      .fire-consequence-box {
        background: #110a0a;
        border: 1px solid #3a1a1a;
        border-left: 3px solid #8b2222;
        border-radius: 4px;
        padding: 32px 28px;
        display: flex;
        gap: 20px;
        align-items: flex-start;
        margin: 24px 0 16px;
      }
      .fire-consequence-icon {
        font-size: 24px;
        flex-shrink: 0;
        opacity: 0.6;
      }
      .fire-consequence-text {
        font-size: 17px;
        line-height: 1.7;
        color: #c0a0a0;
        margin: 0;
        font-style: italic;
        transition: opacity 0.4s ease;
      }
      .fire-btn-ghost {
        background: none;
        border: none;
        color: #555;
        font-size: 12px;
        letter-spacing: 1px;
        cursor: pointer;
        padding: 4px 0;
        transition: color 0.2s;
        font-family: 'Courier New', monospace;
      }
      .fire-btn-ghost:hover { color: #c9a84c; }

      /* ---- AFFIRMATIONS ---- */
      .fire-affirmations { text-align: center; }
      .fire-affirmation-wrap {
        background: #111;
        border: 1px solid #1e1e1e;
        border-radius: 4px;
        padding: 48px 32px 32px;
        margin-top: 24px;
        position: relative;
      }
      .fire-affirmation-wrap::before {
        content: '"';
        position: absolute;
        top: 16px; left: 24px;
        font-size: 60px;
        color: #c9a84c;
        opacity: 0.15;
        line-height: 1;
        font-family: Georgia, serif;
      }
      .fire-affirmation-text {
        font-size: clamp(16px, 3vw, 21px);
        line-height: 1.7;
        color: #d8d0c0;
        font-style: italic;
        min-height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.3s ease;
        margin-bottom: 28px;
      }
      .fire-affirmation-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }
      .fire-aff-btn {
        background: #1a1a1a;
        border: 1px solid #333;
        color: #888;
        width: 36px; height: 36px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        display: flex; align-items: center; justify-content: center;
      }
      .fire-aff-btn:hover { border-color: #c9a84c; color: #c9a84c; }
      .fire-aff-count {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: #555;
        letter-spacing: 2px;
      }

      /* ---- IGNITE ---- */
      .fire-ignite {
        background: linear-gradient(180deg, #0a0a0a 0%, #0e0900 100%);
        border-top: 1px solid #1a1400;
      }
      .fire-now-wrap {
        margin-top: 24px;
        text-align: center;
      }
      .fire-now-label {
        font-size: 13px;
        letter-spacing: 2px;
        color: #666;
        text-transform: uppercase;
        margin-bottom: 20px;
        font-family: 'Courier New', monospace;
      }
      .fire-now-input-wrap { margin-bottom: 20px; }
      .fire-now-input {
        width: 100%;
        max-width: 500px;
        background: #111;
        border: 1px solid #333;
        border-radius: 4px;
        color: #e8e0d0;
        font-size: 16px;
        font-family: Georgia, serif;
        padding: 16px 20px;
        text-align: center;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .fire-now-input:focus { border-color: #c9a84c; }
      .fire-now-input::placeholder { color: #444; font-style: italic; }

      .fire-ignite-btn {
        background: linear-gradient(135deg, #c9a84c, #a8832a);
        border: none;
        border-radius: 4px;
        color: #0a0a0a;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 4px;
        padding: 18px 48px;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }
      .fire-ignite-btn:hover {
        background: linear-gradient(135deg, #dbb85c, #c9a84c);
        transform: translateY(-2px);
        box-shadow: 0 8px 30px #c9a84c33;
      }
      .fire-ignite-btn:active { transform: translateY(0); }
      .fire-ignite-icon { font-size: 18px; }

      .fire-locked-msg {
        margin-top: 32px;
        animation: fadeInUp 0.5s ease forwards;
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .fire-locked-inner {
        background: #0d1a0a;
        border: 1px solid #1a3a14;
        border-left: 3px solid #4a9a3a;
        border-radius: 4px;
        padding: 28px 32px;
        display: inline-block;
        text-align: left;
        max-width: 500px;
      }
      .fire-locked-check {
        color: #4a9a3a;
        font-size: 24px;
        margin-bottom: 10px;
      }
      .fire-locked-text {
        font-size: 18px;
        color: #d0e8d0;
        font-style: italic;
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .fire-locked-sub {
        font-family: 'Courier New', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: #4a9a3a;
        text-transform: uppercase;
      }

      /* ---- FOOTER ---- */
      .fire-footer {
        position: relative;
        z-index: 1;
        text-align: center;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: #333;
        padding: 40px 32px 20px;
        text-transform: uppercase;
      }
    </style>
  `;

  // ---- EMBER PARTICLES ----
  const emberContainer = document.getElementById("fireEmbers");
  for (let i = 0; i < 18; i++) {
    const e = document.createElement("div");
    e.classList.add("ember");
    const left = Math.random() * 100;
    const duration = 6 + Math.random() * 10;
    const delay = Math.random() * 12;
    const drift = (Math.random() - 0.5) * 80;
    const size = 1.5 + Math.random() * 3;
    e.style.cssText = `
      left: ${left}%;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      --drift: ${drift}px;
      width: ${size}px;
      height: ${size}px;
      opacity: ${0.3 + Math.random() * 0.5};
    `;
    emberContainer.appendChild(e);
  }

  // ---- SCROLL REVEAL ----
  const sections = container.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  sections.forEach((s, i) => {
    s.style.transitionDelay = `${i * 0.08}s`;
    observer.observe(s);
  });

  // ---- CONSEQUENCE CYCLING ----
  document.getElementById("nextConsequence").addEventListener("click", () => {
    currentConsequence = (currentConsequence + 1) % consequences.length;
    const el = document.getElementById("consequenceText");
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = consequences[currentConsequence];
      el.style.opacity = 1;
    }, 300);
  });

  // ---- AFFIRMATION NAVIGATION ----
  function updateAffirmation() {
    const el = document.getElementById("affirmationText");
    el.style.opacity = 0;
    setTimeout(() => {
      el.textContent = affirmations[currentAffirmation];
      document.getElementById("affCount").textContent = `${currentAffirmation + 1} / ${affirmations.length}`;
      el.style.opacity = 1;
    }, 250);
  }
  document.getElementById("nextAff").addEventListener("click", () => {
    currentAffirmation = (currentAffirmation + 1) % affirmations.length;
    updateAffirmation();
  });
  document.getElementById("prevAff").addEventListener("click", () => {
    currentAffirmation = (currentAffirmation - 1 + affirmations.length) % affirmations.length;
    updateAffirmation();
  });

  // Auto-cycle affirmations every 8 seconds
  const affInterval = setInterval(() => {
    currentAffirmation = (currentAffirmation + 1) % affirmations.length;
    updateAffirmation();
  }, 8000);

  // ---- IGNITE BUTTON ----
  document.getElementById("fireIgniteBtn").addEventListener("click", () => {
    const task = document.getElementById("fireNowInput").value.trim();
    const lockedMsg = document.getElementById("fireLockedMsg");
    const lockedText = document.getElementById("fireLockedText");

    if (!task) {
      document.getElementById("fireNowInput").focus();
      document.getElementById("fireNowInput").style.borderColor = "#c9a84c";
      return;
    }

    lockedText.textContent = `"${task}"`;
    lockedMsg.style.display = "block";
    document.getElementById("fireIgniteBtn").style.display = "none";
    document.getElementById("fireNowInput").disabled = true;

    // Scroll to the locked message
    lockedMsg.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Cleanup on tab switch
  return () => {
    clearInterval(affInterval);
    observer.disconnect();
  };
};
