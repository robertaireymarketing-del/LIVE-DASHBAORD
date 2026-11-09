// ── SLEEP PAGE ─────────────────────────────────────────────────────────────
// For nights you can't sleep. Opened from More → 🌙 Sleep.
//
// Design rules (all deliberate):
//  • Near-black screen, dim red/amber text only — avoids the blue light that
//    suppresses melatonin, and keeps your eyes dark-adapted.
//  • No clock, no numbers, no targets, no progress. Checking the time and
//    "trying" to sleep both make it worse (sleep-effort / clock-watching).
//  • The app header and nav fade away while you're here; the screen dims itself
//    further after 45 s without a touch.
//
// Three steps, in the order that works best:
//  1. UNLOAD  — write tomorrow's to-dos. Scullin et al. (2018): 5 min writing a
//               specific to-do list before bed → fell asleep ~9 min faster than
//               journalling completed tasks. Lines save as reminders due tomorrow,
//               so your goals are handled and your brain can let go.
//  2. BREATHE — slow breathing, 4 s in / 6 s out (~6 breaths a minute, long
//               exhale). Slow, exhale-weighted breathing shifts the body toward
//               parasympathetic ("rest") mode.
//  3. DRIFT   — cognitive shuffle (Beaudoin): a letter, then one unrelated
//               easy-to-picture word every 12 s to imagine. Mimics the random
//               imagery of falling asleep and blocks worry loops. Optional low
//               brown noise that fades out on its own.
//  + After 20 minutes: the core CBT-I rule (stimulus control) — if you're still
//    wide awake, get up, sit somewhere dim, come back when sleepy.

const WORDS = {
  B: ['bread', 'balloon', 'beach', 'bicycle', 'blanket', 'boat', 'bell', 'butterfly', 'bucket', 'branch', 'bubble', 'bridge'],
  C: ['candle', 'cloud', 'cat', 'canoe', 'cherry', 'cottage', 'cup', 'cliff', 'carpet', 'cushion', 'cake', 'compass'],
  F: ['feather', 'fern', 'fire', 'fox', 'field', 'flag', 'fountain', 'fog', 'flower', 'forest', 'fish', 'fence'],
  H: ['harbour', 'hat', 'honey', 'hill', 'horse', 'hammock', 'heron', 'hedge', 'hut', 'hay', 'harp', 'hearth'],
  L: ['lake', 'lantern', 'leaf', 'lemon', 'lighthouse', 'lamb', 'ladder', 'log', 'lily', 'lane', 'lavender', 'loaf'],
  M: ['moon', 'meadow', 'mountain', 'mug', 'moss', 'mitten', 'map', 'maple', 'mist', 'marble', 'mill', 'melon'],
  P: ['pebble', 'pillow', 'pine', 'pond', 'peach', 'path', 'piano', 'pumpkin', 'puddle', 'pier', 'parcel', 'pear'],
  R: ['river', 'rain', 'rope', 'robin', 'rose', 'rowboat', 'rug', 'rock', 'reed', 'ribbon', 'raft', 'roof'],
  S: ['snow', 'shell', 'sand', 'sail', 'star', 'stream', 'sheep', 'scarf', 'swing', 'stone', 'spoon', 'seed'],
  T: ['tree', 'tent', 'teapot', 'tide', 'tulip', 'torch', 'tower', 'twig', 'tractor', 'towel', 'trail', 'toast'],
  W: ['wave', 'window', 'willow', 'wool', 'well', 'wheat', 'wagon', 'whale', 'woods', 'wind', 'wreath', 'walnut'],
};

const SLEEP_CSS = `<style id="sleep-css">
body.sleep-mode { background:#000 !important; }
body.sleep-mode .header, body.sleep-mode .quote-card, body.sleep-mode .panic-trigger, body.sleep-mode .saving-badge { display:none !important; }
body.sleep-mode .bottom-nav-app { opacity:0.18; transition:opacity 0.6s; filter:grayscale(1); }
body.sleep-mode .bottom-nav-app:active, body.sleep-mode .bottom-nav-app:hover { opacity:0.6; }
.slp { --amber:#B8733A; --dim:#6E4524; --faint:#3A2414; --line:#24160C;
  min-height:calc(100vh - 140px); display:flex; flex-direction:column; gap:22px; padding:20px 4px 40px;
  color:var(--amber); font-family:-apple-system, BlinkMacSystemFont, sans-serif; transition:opacity 2s ease; }
.slp.deep { opacity:0.35; }
.slp * { box-sizing:border-box; color:inherit; }
.slp button { font-family:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.slp-title { font-size:22px; font-weight:600; letter-spacing:0.2px; color:var(--amber) !important; }
.slp-sub { font-size:15px; line-height:1.55; margin-top:6px; color:var(--dim) !important; }
.slp-steps { display:flex; gap:8px; }
.slp-step { flex:1; height:44px; border-radius:22px; border:1px solid var(--line); background:transparent; font-size:14px; color:var(--dim) !important; }
.slp-step.on { border-color:var(--dim); color:var(--amber) !important; background:#0d0805; }
.slp-card { border:1px solid var(--line); border-radius:20px; padding:20px 18px; background:#060403; }
.slp-h { font-size:17px; font-weight:600; color:var(--amber) !important; }
.slp-p { font-size:15px; line-height:1.6; margin-top:8px; color:var(--dim) !important; }
.slp textarea { width:100%; min-height:150px; margin-top:14px; padding:14px; border-radius:14px; border:1px solid var(--line);
  background:#000; color:var(--amber) !important; font-size:16px; line-height:1.6; font-family:inherit; resize:none; outline:none; }
.slp textarea::placeholder { color:var(--faint); }
.slp-btn { width:100%; height:50px; margin-top:12px; border-radius:25px; border:1px solid var(--dim); background:transparent;
  font-size:15px; color:var(--amber) !important; }
.slp-btn.ghost { border-color:var(--line); color:var(--dim) !important; }
.slp-ok { font-size:14px; margin-top:12px; color:var(--dim) !important; text-align:center; }

/* Breathing: 10 s cycle = 4 s in, 6 s out (~6 breaths/min) */
.slp-breath { position:relative; width:240px; height:240px; margin:26px auto 6px; }
.slp-orb { position:absolute; inset:0; margin:auto; width:240px; height:240px; border-radius:50%;
  background:radial-gradient(circle, rgba(184,115,58,0.28) 0%, rgba(184,115,58,0.08) 55%, rgba(184,115,58,0) 70%);
  animation:slpBreath 10s ease-in-out infinite; }
.slp-ring { position:absolute; inset:0; margin:auto; width:120px; height:120px; border-radius:50%; border:1px solid var(--dim);
  animation:slpRing 10s ease-in-out infinite; }
@keyframes slpBreath { 0% { transform:scale(0.45); } 40% { transform:scale(1); } 100% { transform:scale(0.45); } }
@keyframes slpRing { 0% { transform:scale(0.9); opacity:0.5; } 40% { transform:scale(1.8); opacity:0.9; } 100% { transform:scale(0.9); opacity:0.5; } }
.slp-cue { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:17px; letter-spacing:2px; }
.slp-cue span { position:absolute; color:var(--amber) !important; }
.slp-cue .in { animation:slpIn 10s linear infinite; }
.slp-cue .out { animation:slpOut 10s linear infinite; }
@keyframes slpIn { 0%,36% { opacity:0.9; } 40%,100% { opacity:0; } }
@keyframes slpOut { 0%,38% { opacity:0; } 42%,95% { opacity:0.9; } 100% { opacity:0; } }
@media (prefers-reduced-motion: reduce) { .slp-orb, .slp-ring { animation-duration:14s; } }

/* Cognitive shuffle */
.slp-letter { font-size:15px; letter-spacing:3px; text-align:center; margin-top:18px; color:var(--dim) !important; }
.slp-word { font-size:34px; font-weight:300; text-align:center; margin:18px 0 8px; min-height:44px; color:var(--amber) !important; transition:opacity 1.2s ease; }
.slp-word.fade { opacity:0; }

.slp-sound { display:flex; gap:8px; margin-top:14px; }
.slp-sound button { flex:1; height:44px; border-radius:22px; border:1px solid var(--line); background:transparent; font-size:14px; color:var(--dim) !important; }
.slp-sound button.on { border-color:var(--dim); color:var(--amber) !important; background:#0d0805; }

.slp-awake { border:1px dashed var(--dim); border-radius:20px; padding:18px; }
.slp-goal { font-size:14px; line-height:1.6; text-align:center; color:var(--faint) !important; padding:0 12px; }
</style>`;

function esc(v = '') { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function renderSleepTab({ state }) {
  const step = state.sleepStep || 'unload';
  const s = window.__sleep || {};
  const awake20 = s.openedAt && (Date.now() - s.openedAt) > 20 * 60 * 1000;
  const sound = s.sound || null; // null | 30 | 60

  const steps = `
  <div class="slp-steps" role="tablist">
    <button class="slp-step ${step === 'unload' ? 'on' : ''}" onclick="sleepStep('unload')">1 · Unload</button>
    <button class="slp-step ${step === 'breathe' ? 'on' : ''}" onclick="sleepStep('breathe')">2 · Breathe</button>
    <button class="slp-step ${step === 'drift' ? 'on' : ''}" onclick="sleepStep('drift')">3 · Drift</button>
  </div>`;

  let body = '';
  if (step === 'unload') {
    body = `
    <div class="slp-card">
      <div class="slp-h">Put tomorrow somewhere safe</div>
      <div class="slp-p">Write down what's on your mind for tomorrow, one thing per line. Be specific. It'll be saved as reminders for tomorrow, so it's handled and you don't have to hold it any more.</div>
      <textarea id="sleep-dump" placeholder="e.g. Call supplier about chains&#10;List 5 silver pieces&#10;Gym 4:30">${esc(s.draft || '')}</textarea>
      ${s.saved ? `<div class="slp-ok">Saved for tomorrow. It's handled.</div>` : ''}
      <button class="slp-btn" onclick="sleepSaveDump()">${s.saved ? 'Save more' : 'Save for tomorrow'}</button>
      <button class="slp-btn ghost" onclick="sleepStep('breathe')">Nothing on my mind → breathe</button>
    </div>`;
  } else if (step === 'breathe') {
    body = `
    <div class="slp-card" style="text-align:center;">
      <div class="slp-h">Breathe with the light</div>
      <div class="slp-p">In through your nose as it grows. Slowly out through your mouth as it shrinks, a little longer out than in. Let your jaw and shoulders drop.</div>
      <div class="slp-breath" aria-hidden="true">
        <div class="slp-orb"></div><div class="slp-ring"></div>
        <div class="slp-cue"><span class="in">in</span><span class="out">out</span></div>
      </div>
      <div class="slp-p" style="font-size:13px;">Around ten breaths, then move on whenever you like.</div>
      <button class="slp-btn ghost" onclick="sleepStep('drift')">Next → drift</button>
    </div>`;
  } else {
    body = `
    <div class="slp-card" style="text-align:center;">
      <div class="slp-h">Picture each word</div>
      <div class="slp-p">Close your eyes when you're ready. Imagine each word for a few seconds: its colour, its texture. They're random on purpose; don't link them or make a story. If you lose track, just start picturing anything beginning with the letter.</div>
      <div class="slp-letter" id="sleep-letter">${s.letter ? 'words starting with ' + s.letter : ''}</div>
      <div class="slp-word" id="sleep-word">${s.word || ''}</div>
      <button class="slp-btn ghost" onclick="sleepNewLetter()">New letter</button>
      <div class="slp-sound" role="group" aria-label="Brown noise">
        <button class="${!sound ? 'on' : ''}" onclick="sleepSound(0)">Silence</button>
        <button class="${sound === 30 ? 'on' : ''}" onclick="sleepSound(30)">Noise · 30m</button>
        <button class="${sound === 60 ? 'on' : ''}" onclick="sleepSound(60)">Noise · 60m</button>
      </div>
      <div class="slp-p" style="font-size:13px;">Soft brown noise that fades out by itself. Keep the volume low.</div>
    </div>`;
  }

  const awake = awake20 ? `
  <div class="slp-awake">
    <div class="slp-h">Still wide awake? That's fine.</div>
    <div class="slp-p">Get up for a little while. Sit somewhere dim and do something dull: read paper, stretch gently. No screens, no food. Come back to bed only when you feel sleepy. This keeps your bed linked with sleep, not with lying awake.</div>
  </div>` : '';

  return SLEEP_CSS + `
  <div class="slp" id="sleep-root" ontouchstart="sleepWake()" onclick="sleepWake()">
    <div>
      <div class="slp-title">Can't sleep</div>
      <div class="slp-sub">No clock here, nothing to achieve. You don't need to fall asleep. Just rest and follow along.</div>
    </div>
    ${steps}
    ${body}
    ${awake}
    <div class="slp-goal">Resting quietly still helps you recover. One rough night won't undo your progress. Tomorrow's gym session, food and work will still happen.</div>
  </div>`;
}

export function initSleepTab({ state, saveData, render }) {
  const S = (window.__sleep = window.__sleep || {});
  if (!S.openedAt) S.openedAt = Date.now();
  document.body.classList.add('sleep-mode');

  // Dim deeper after 45 s without a touch
  clearTimeout(S.dimT);
  const root = document.getElementById('sleep-root');
  const arm = () => { clearTimeout(S.dimT); S.dimT = setTimeout(() => { const r = document.getElementById('sleep-root'); if (r) r.classList.add('deep'); }, 45000); };
  window.sleepWake = () => { const r = document.getElementById('sleep-root'); if (r) r.classList.remove('deep'); arm(); };
  arm();

  // Re-render once at 20 min to show the "still awake" card (only if still here)
  clearTimeout(S.awakeT);
  const left = 20 * 60 * 1000 - (Date.now() - S.openedAt);
  if (left > 0) S.awakeT = setTimeout(() => { if (state.activeTab === 'sleep') render(); }, left + 500);

  // Keep the dump draft between re-renders
  const ta = document.getElementById('sleep-dump');
  if (ta) ta.addEventListener('input', () => { S.draft = ta.value; S.saved = false; });

  window.sleepStep = (st) => { state.sleepStep = st; render(); };

  window.sleepSaveDump = () => {
    const el = document.getElementById('sleep-dump');
    const lines = (el ? el.value : '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { if (el) el.focus(); return; }
    const t = new Date(); t.setDate(t.getDate() + 1);
    const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const now = Date.now();
    const items = lines.map((text, i) => ({ id: 'rem_' + (now + i), text, deadline: tomorrow, done: false, createdAt: now + i, source: 'sleep' }));
    state.data.reminders = [...items, ...(state.data.reminders || [])];
    S.draft = ''; S.saved = true;
    saveData(); render();
  };

  // ── Cognitive shuffle ──
  const letters = Object.keys(WORDS);
  const pickLetter = () => { S.letter = letters[Math.floor(Math.random() * letters.length)]; S.pool = [...WORDS[S.letter]].sort(() => Math.random() - 0.5); S.word = ''; };
  const nextWord = () => {
    if (!S.pool || !S.pool.length) pickLetter();
    const w = S.pool.shift();
    const el = document.getElementById('sleep-word');
    if (!el) { S.word = w; return; }
    el.classList.add('fade');
    setTimeout(() => { S.word = w; el.textContent = w; el.classList.remove('fade'); const l = document.getElementById('sleep-letter'); if (l) l.textContent = 'words starting with ' + S.letter; }, 1200);
  };
  clearInterval(S.wordI);
  if (state.sleepStep === 'drift') {
    if (!S.letter) pickLetter();
    if (!S.word) nextWord();
    S.wordI = setInterval(() => { if (state.activeTab !== 'sleep' || state.sleepStep !== 'drift') { clearInterval(S.wordI); return; } nextWord(); }, 12000);
  }
  window.sleepNewLetter = () => { pickLetter(); nextWord(); };

  // ── Brown noise (Web Audio, generated — no files) with fade-out ──
  window.sleepSound = async (mins) => {
    stopNoise();
    if (!mins) { S.sound = null; render(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = S.ctx || (S.ctx = new Ctx());
      if (ctx.state === 'suspended') await ctx.resume();
      const len = ctx.sampleRate * 8;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const gain = ctx.createGain(); const now = ctx.currentTime; const total = mins * 60;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 8);                 // fade in
      gain.gain.setValueAtTime(0.35, now + total - 300);
      gain.gain.linearRampToValueAtTime(0.0001, now + total);           // fade out over last 5 min
      src.connect(lp).connect(gain).connect(ctx.destination);
      src.start(); src.stop(now + total + 1);
      S.src = src; S.sound = mins;
      // Keep the (black) screen on while the noise plays so iOS doesn't cut the audio
      try { if ('wakeLock' in navigator) S.lock = await navigator.wakeLock.request('screen'); } catch (e) {}
      clearTimeout(S.soundT);
      S.soundT = setTimeout(() => { stopNoise(); S.sound = null; if (state.activeTab === 'sleep') render(); }, (total + 2) * 1000);
    } catch (e) { S.sound = null; }
    render();
  };
  function stopNoise() {
    try { if (S.src) S.src.stop(); } catch (e) {}
    S.src = null;
    try { if (S.lock) S.lock.release(); } catch (e) {}
    S.lock = null;
    clearTimeout(S.soundT);
  }
  window.sleepStopAll = stopNoise;
}

// Called when leaving the tab
export function leaveSleepTab() {
  document.body.classList.remove('sleep-mode');
  const S = window.__sleep || {};
  clearTimeout(S.dimT); clearTimeout(S.awakeT); clearInterval(S.wordI);
  // Noise keeps playing if you navigate away on purpose? No — stop it to be safe.
  if (window.sleepStopAll) window.sleepStopAll();
  S.sound = null; S.openedAt = null; S.saved = false;
}
