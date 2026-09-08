/* =============================================================================
   renderStraightLine.js  —  "The Line"
   A Straight-Line Leadership page for the TJM dashboard.

   Wired the same way scenes.js / renderClarity.js are:
     • initStraightLineActions({ state, saveData, saveDataQuiet, render })
         → called ONCE at app load (next to initSceneActions). Captures the real
           module-scoped state/save/render and attaches all window.* handlers.
     • renderStraightLineTab({ state })   → returns the page shell (pure).
     • initStraightLineTab({ ... })       → called per-render (like initClarityTab)
           to populate #sl-view and bind the pill tabs.
     • renderStraightLineCard(state)      → the Today-tab entry card (pure).

   No globals are invented. state comes from the shared singleton app.js passes
   in — so persistence flows through the app's own saveDataQuiet into the single
   users/{uid} doc, under state.data.straightLine.

   PURPOSE
   Not a quote shrine. Djukich's argument is that knowing a principle and
   producing from it are different universes. So this runs memory science
   underneath (spaced retrieval + self-reference encoding) and bias-to-action on
   top (declare an outcome with a deadline, catch yourself at the effect in the
   moment, and get confronted with the declarations you didn't produce).

   Fixed navy+gold identity palette in BOTH themes, like the identity/quote hero
   cards — so there is no light-mode rgba issue. Uses 'Newsreader' (already
   loaded for Clarity).
   ============================================================================= */

/* ── captured app dependencies (set by init) ────────────────────────────── */
let _ST = null;      // the shared state singleton
let _SAVE = null;    // saveData
let _SAVEQ = null;   // saveDataQuiet
let _RENDER = null;  // render
let _wired = false;

function _slCapture(deps) {
  if (!deps) return;
  if (deps.state)         _ST = deps.state;
  if (deps.saveData)      _SAVE = deps.saveData;
  if (deps.saveDataQuiet) _SAVEQ = deps.saveDataQuiet;
  if (deps.render)        _RENDER = deps.render;
}
function _slSave() { try { if (_SAVEQ) _SAVEQ(); else if (_SAVE) _SAVE(); } catch (e) { console.warn('[line] save skipped', e); } }
function _slSetTab(tab) {
  if (typeof window !== 'undefined' && typeof window.setTab === 'function') return window.setTab(tab);
  if (_ST) { _ST.activeTab = tab; _ST.moreMenuOpen = false; }
  if (_RENDER) _RENDER();
}

/* ============================ THE DECK ==================================== */
/* All 50 chapters. type:'foundation' chapters frame the system; the rest are the
   distinctions (first term is always the straight-line side). */
const SLL_DECK = [
  { id:'ch1',  ch:1,  type:'foundation', name:'Inner Stance',
    essence:"Where you come from — not where you want to go — determines your results. Change the stance and you change what's even possible to see and do.",
    apply:"What stance are you operating from right now — a key to your castle, or your jail cell?" },
  { id:'ch2',  ch:2,  type:'foundation', name:'The Circular World',
    essence:"The circle is going round and round: same patterns, same complaints, arriving nowhere. Motion without progress.",
    apply:"Where in TJM or the shop are you circling — busy, but back where you started?" },
  { id:'ch3',  ch:3,  type:'foundation', name:'The Zigzag World',
    essence:"The zigzag starts and stops, gets distracted, changes direction. It never draws a straight line from A to B.",
    apply:"What did you start and abandon this week before it produced?" },
  { id:'ch4',  ch:4,  type:'foundation', name:'Straight-Line People',
    essence:"They move directly from where they are to where they intend to be. They cause results and take others with them.",
    apply:"Name one straight line you can walk today, start to finish, no zigzag." },
  { id:'ch5',  ch:5,  sl:'Creating', trap:'Wanting',
    essence:"Wanting keeps the thing in the future, away from you. Creating means you cause it into being now.",
    apply:"What are you 'wanting' that you could start creating today instead?" },
  { id:'ch6',  ch:6,  sl:'Stop Stopping', trap:'Stopping',
    essence:"You don't need more starting. You need to stop stopping. The stops are the whole problem.",
    apply:"Where do you keep stopping — and what would not-stopping look like today?" },
  { id:'ch7',  ch:7,  type:'foundation', name:'What Distinguishes a Leader',
    essence:"A straight-line leader causes results and is a stand for others producing them too — not by managing, by being the cause.",
    apply:"Whose result are you a stand for today?" },
  { id:'ch8',  ch:8,  sl:'A Decision to Make', trap:'A Problem',
    essence:"There are no problems — only decisions you haven't made yet. A 'problem' is a decision in disguise.",
    apply:"Restate your biggest 'problem' right now as the decision you're avoiding." },
  { id:'ch9',  ch:9,  sl:'What I Live', trap:'What I Know',
    essence:"It's never what you know. Knowledge just sits in the recesses of your mind. What does you good is what you live. Separate the two ruthlessly.",
    apply:"Name one thing you KNOW you should be doing in the business — and to what degree do you LIVE it?" },
  { id:'ch10', ch:10, sl:'Choose to', trap:'Want to',
    essence:"'Want to' is weak and waits on a feeling. 'Choose to' is a stand you take whether the feeling shows up or not.",
    apply:"Turn one 'I want to' into 'I choose to' right now — and act on it." },
  { id:'ch11', ch:11, sl:"Won't", trap:"Can't",
    essence:"'Can't' is almost always 'won't' in disguise. Tell the truth about which it is — the truth returns your power.",
    apply:"Say it plainly: is it that you can't, or that you won't?" },
  { id:'ch12', ch:12, sl:'Truthful About Where You Are', trap:'Lying About It',
    essence:"You can't leave a place you won't admit you're standing in. Radical honesty about your position is the start line.",
    apply:"Where are you actually — not where you'd like to be seen — on your top priority?" },
  { id:'ch13', ch:13, sl:'Serving', trap:'Pleasing',
    essence:"Pleasing bends to keep people comfortable. Serving tells them what actually moves them forward, even when it's unwelcome.",
    apply:"Where are you pleasing someone when serving them means saying the hard thing?" },
  { id:'ch14', ch:14, sl:'A Created World', trap:'A Reported-on World',
    essence:"Reporters describe what already is. Creators call into being what isn't there yet. Choose which you're being.",
    apply:"Are you reporting on TJM's situation today, or creating its next state?" },
  { id:'ch15', ch:15, sl:'A Project', trap:'A Dream',
    essence:"A dream floats with no edges. A project has a deadline, defined actions, and a next step you can take now.",
    apply:"Take one 'dream' for the business and give it a deadline and a next action." },
  { id:'ch16', ch:16, sl:'Concern', trap:'Worry',
    essence:"Worry spins in place and produces nothing. Concern converts straight into a corrective action.",
    apply:"Turn today's worry into a single concrete corrective action." },
  { id:'ch17', ch:17, sl:'Musts', trap:'Shoulds',
    essence:"A 'should' is optional and quietly never happens. A 'must' gets done. Promote the right things.",
    apply:"Name one 'should' that has to become a 'must' today." },
  { id:'ch18', ch:18, sl:"I'm Responsible", trap:"It's Their Fault",
    essence:"Responsibility is where all your power lives. Blame feels justified and hands your power away.",
    apply:"Where are you assigning fault — and what does taking full responsibility unlock?" },
  { id:'ch19', ch:19, sl:'Growth Choices', trap:'Safe Choices',
    essence:"Safe choices keep you small and comfortable. Growth choices are exactly where the expansion is.",
    apply:"What's the growth choice you're avoiding because the safe one is easier?" },
  { id:'ch20', ch:20, sl:'Only Results Count', trap:'Content with Insight',
    essence:"Collecting insight feels like progress and produces nothing. You're not a walking library. Only results count.",
    apply:"What result — not realisation — will you produce before today ends?" },
  { id:'ch21', ch:21, sl:'The Valley of Death', trap:'Optimistic Denial',
    essence:"Denial skips the hard middle. Every real result makes you walk through the valley — face it rather than pretend it away.",
    apply:"What hard middle are you avoiding by staying optimistic on the surface?" },
  { id:'ch22', ch:22, sl:'Productivity', trap:'Busyness',
    essence:"Busyness is motion. Productivity is the result. They are not the same, and busyness often hides the absence of results.",
    apply:"Cross off one busy task today that isn't producing anything real." },
  { id:'ch23', ch:23, sl:'Commitment', trap:'Trying',
    essence:"'Trying' has failure built in as permission. Commitment leaves no exit — you're either doing it or you're not.",
    apply:"Where are you 'trying' — and what does full commitment look like instead?" },
  { id:'ch24', ch:24, sl:'Owner', trap:'Victim',
    essence:"Owners cause outcomes. Victims wait for rescue and complain meanwhile. Complaining is a poor substitute for a result.",
    apply:"Where are you being the victim of a circumstance you could own?" },
  { id:'ch25', ch:25, sl:'The Same', trap:'Separate',
    essence:"Seeing yourself as separate breeds blame and distance. Seeing yourself as the same — in it together — closes the gap and makes leadership possible.",
    apply:"Who are you holding at a distance that you'd lead better by standing with?" },
  { id:'ch26', ch:26, sl:'Agreements', trap:'Expectations',
    essence:"Unspoken expectations quietly breed resentment. Clear agreements create accountability both ways.",
    apply:"Where do you have an expectation of someone that was never made an agreement?" },
  { id:'ch27', ch:27, sl:'Radical Self-Honesty', trap:'Being Insincere',
    essence:"You only move as fast as you're willing to be honest with yourself. Insincerity is a brake you can't see.",
    apply:"What's the thing you already know but haven't let yourself say plainly?" },
  { id:'ch28', ch:28, sl:'Realistic Optimism', trap:'Unrealistic Pessimism',
    essence:"See the situation clearly AND expect to win. Pessimism is just talking yourself out of the action in advance.",
    apply:"Where are you pre-losing something in your head before you've acted?" },
  { id:'ch29', ch:29, sl:'Being Bold', trap:'Being Arrogant',
    essence:"Bold acts and risks and can be wrong. Arrogant protects an image and risks nothing. They look similar and aren't.",
    apply:"What's the bold move you'd make today if protecting your image were off the table?" },
  { id:'ch30', ch:30, sl:'Discomfort and Pain', trap:'Chaos',
    essence:"Chosen discomfort is the price of growth and worth paying. Chaos is avoidable disorder that produces nothing. Don't confuse them.",
    apply:"What productive discomfort are you dodging by staying in comfortable chaos?" },
  { id:'ch31', ch:31, sl:'Purpose Management', trap:'Time Management',
    essence:"Managing the clock is not the same as managing what matters. Organise around purpose, not just hours.",
    apply:"Does your next block of time serve your purpose, or just fill the calendar?" },
  { id:'ch32', ch:32, sl:'Extreme Self-Care', trap:'Selfishness',
    essence:"Caring for yourself so you can produce and serve at full power isn't selfish — running yourself down is.",
    apply:"What's one act of self-care today that makes you more able to produce, not less?" },
  { id:'ch33', ch:33, sl:'Choose to', trap:'How to',
    essence:"'I don't know how' is usually a stall. Choose to, commit to the outcome, and the 'how' shows up along the way.",
    apply:"Where is 'I don't know how yet' standing in for 'I haven't chosen to'?" },
  { id:'ch34', ch:34, sl:'Kind', trap:'Nice',
    essence:"Nice avoids the hard truth to stay liked. Kind tells the truth because it serves the person.",
    apply:"Where would being kind today mean risking not being seen as nice?" },
  { id:'ch35', ch:35, sl:'Positive No', trap:'Rejection',
    essence:"A clean, grounded 'no' protects your 'yes'. It isn't rejection — it's a boundary that keeps your line straight.",
    apply:"What do you need to give a clear 'no' to so your real yes has room?" },
  { id:'ch36', ch:36, sl:'Confrontation', trap:'Tolerance',
    essence:"Tolerating what doesn't work is a slow leak that drains the whole system. Confront it directly and early.",
    apply:"What are you tolerating right now that you should confront today?" },
  { id:'ch37', ch:37, sl:'Language that Creates Reality', trap:'Language that Describes Reality',
    essence:"Your words either report the past or generate the future. Speak the outcome into existence, don't just narrate the situation.",
    apply:"Rephrase one thing you've been describing into language that creates what you want." },
  { id:'ch38', ch:38, sl:'Commitment', trap:'Involvement',
    essence:"With bacon and eggs, the chicken is involved — the pig is committed. Know which one you actually are on this.",
    apply:"On your top priority, are you the chicken or the pig? Be honest." },
  { id:'ch39', ch:39, sl:'I Contribute', trap:'I Deserve',
    essence:"'Deserving' waits with its hand out for a reward. Contributing creates value first and lets results follow.",
    apply:"Where are you waiting to be given something you could earn by contributing first?" },
  { id:'ch40', ch:40, sl:'Corrective Actions', trap:'Protective Actions',
    essence:"Protecting your image and position stalls you. Correcting your course — even when it exposes a mistake — moves you.",
    apply:"What course-correction are you avoiding because it means admitting something?" },
  { id:'ch41', ch:41, sl:'Now', trap:'Later',
    essence:"'Later' is where actions go to die. If it can be done now, now is the straight line.",
    apply:"What's one thing on 'later' that you'll do now, before anything else?" },
  { id:'ch42', ch:42, sl:'Childlike', trap:'Childish',
    essence:"Childlike is open, curious, playful, willing. Childish is reactive, entitled, sulking. One fuels you, one stalls you.",
    apply:"Where could a childlike stance beat the childish reaction you're tempted by?" },
  { id:'ch43', ch:43, sl:'Playing to Win', trap:'Playing Not to Lose',
    essence:"Playing not to lose is a defensive crouch that guarantees a small game. Play to win — go for the result.",
    apply:"Where are you playing not to lose in TJM instead of playing to win?" },
  { id:'ch44', ch:44, sl:'Investment', trap:'Cost',
    essence:"Framed as a cost, you avoid it. Framed as an investment in the outcome, you evaluate it properly.",
    apply:"What 'cost' you're resisting is actually an investment in the result you want?" },
  { id:'ch45', ch:45, sl:'Core Actions', trap:'Surface Actions',
    essence:"Surface actions look productive and touch nothing. Core actions move the needle. Do the core ones first.",
    apply:"What's the one core action today that would make the surface stuff irrelevant?" },
  { id:'ch46', ch:46, sl:'Focus', trap:'Spray',
    essence:"Spraying effort across everything produces nothing. Focus concentrates force on one point until it gives.",
    apply:"If you could only move ONE thing forward today, which gets your focus?" },
  { id:'ch47', ch:47, sl:'How it Can Be Done', trap:"Why it Can't Be Done",
    essence:"The reasons it can't be done are always available and always useless. Hunt for how it can be done instead.",
    apply:"Take the thing you've decided 'can't' work and find the first way it can." },
  { id:'ch48', ch:48, sl:'Caring', trap:'Stressing',
    essence:"Stressing is self-indulgent noise that helps no one. Caring channels the same energy straight into action.",
    apply:"Where are you stressing about something instead of caring enough to act on it?" },
  { id:'ch49', ch:49, sl:'Creating Perfection', trap:'Making a Living',
    essence:"Aim past merely getting by. Create something excellent — that's the standard that builds the biggest and best.",
    apply:"Where are you settling for 'making a living' when you could be creating excellence?" },
  { id:'ch50', ch:50, type:'foundation', name:'Waking Up to the Contrasts',
    essence:"The distinctions only work when you catch yourself in the live moment and consciously choose the straight-line side. That's the whole practice.",
    apply:"Catch yourself once today, mid-drift, and deliberately choose the straight line." }
];

/* ============================ STORAGE ==================================== */
const SLL_INTERVALS = [0, 1, 3, 7, 16, 35, 90]; // days by box (index 0 = due today)

/* ephemeral scaffold used only if state.data isn't loaded yet (pre-login render) */
function _slEmpty() {
  return { cards:{}, declarations:[], interventions:[], ledger:{}, lastDaily:null, todayCh:null, _view:'line', _draft:{}, _ephemeral:true };
}

function _slData() {
  const st = _ST;
  if (!st || !st.data) {
    // not loaded yet — return a throwaway so renders don't crash; nothing persists
    if (!_slData._eph) { _slData._eph = _slEmpty(); _slSeed(_slData._eph); }
    return _slData._eph;
  }
  if (!st.data.straightLine) st.data.straightLine = {};
  const d = st.data.straightLine;
  d.cards = d.cards || {};
  d.declarations = d.declarations || [];
  d.interventions = d.interventions || [];
  d.ledger = d.ledger || {};
  if (d.lastDaily === undefined) d.lastDaily = null;
  if (d.todayCh === undefined) d.todayCh = null;
  _slSeed(d);
  return d;
}
function _slSeed(d) {
  d.cards = d.cards || {};
  SLL_DECK.forEach(card => {
    if (!d.cards[card.id]) d.cards[card.id] = { box:0, due:0, seen:false, reps:0, myMeaning:'', myExample:'' };
  });
}

function _slToday() { return new Date().toISOString().slice(0, 10); }
function _slNow() { return Date.now(); }
function _slDeckIndexById(id) { return SLL_DECK.findIndex(c => c.id === id); }
function _slDueDaysToTs(days) { return _slNow() + days * 86400000; }

/* today's distinction — stable across reloads within a day, rotates by date */
function _slTodaysCard() {
  const d = _slData();
  const today = _slToday();
  if (d.lastDaily !== today || d.todayCh == null) {
    const dayNum = Math.floor(Date.parse(today) / 86400000);
    d.todayCh = ((dayNum % SLL_DECK.length) + SLL_DECK.length) % SLL_DECK.length;
    d.lastDaily = today;
    if (!d._ephemeral) _slSave();
  }
  return SLL_DECK[d.todayCh] || SLL_DECK[0];
}

function _slDueCards() {
  const d = _slData();
  const now = _slNow();
  return SLL_DECK.filter(c => {
    const s = d.cards[c.id];
    return !s || !s.seen || (s.due || 0) <= now;
  });
}

function _slGrade(id, grade) { // 'again' | 'good' | 'easy'
  const d = _slData();
  const s = d.cards[id];
  if (!s) return;
  s.seen = true;
  s.reps = (s.reps || 0) + 1;
  if (grade === 'again') s.box = 0;
  else if (grade === 'good') s.box = Math.min(s.box + 1, SLL_INTERVALS.length - 1);
  else if (grade === 'easy') s.box = Math.min(s.box + 2, SLL_INTERVALS.length - 1);
  const days = SLL_INTERVALS[s.box] || 0;
  s.due = grade === 'again' ? _slNow() + 20 * 60000 : _slDueDaysToTs(days);
  _slSave();
}

/* ============================ HELPERS ==================================== */
function _slEsc(x) {
  return String(x == null ? '' : x)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _slUid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function _slFmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(undefined, { day:'numeric', month:'short' }); }
  catch(e){ return iso; }
}

function _slEvidence() {
  const d = _slData();
  const days = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const dt = new Date(now); dt.setDate(now.getDate() - i);
    days.push(dt.toISOString().slice(0,10));
  }
  let cause = 0, logged = 0;
  days.forEach(day => { const l = d.ledger[day]; if (l && l.score) { logged++; if (l.score === 'cause') cause++; } });
  const openDecls = d.declarations.filter(x => x.status === 'open');
  const overdue = openDecls.filter(x => x.deadline && x.deadline < _slToday());
  const kept = d.declarations.filter(x => x.status === 'kept').length;
  const broken = d.declarations.filter(x => x.status === 'broken').length;
  const seen = SLL_DECK.filter(c => d.cards[c.id] && d.cards[c.id].seen).length;
  return { cause, logged, openDecls, overdue, kept, broken, seenCount: seen, total: SLL_DECK.length };
}

/* ============================ STYLES ==================================== */
const SLL_CSS = `
/* Deep-azure bold theme. A fixed LIGHT surface in both app themes (the page is
   painted, so the app's dark mode can't strand light text on a light design).
   Every colour is pinned with !important + -webkit-text-fill-color so the app's
   global light-mode cascade cannot override it. */
.sl-scope{--page:#F4F7FB;--ink:#121B24;--dim:#4C5766;--faint:#828E9C;--border:#DBE3EC;
  --card:#FFFFFF;--field:#EEF3F8;--hero:#075985;--hero-kick:#7DD3FC;--hero-dim:#4C87AC;
  --hero-ess:#B3DCF0;--accent:#0369A1;--accent2:#0284C7;--on:#FFFFFF;--good:#127A50;--bad:#C1121F;
  font-family:'Helvetica Neue',Arial,system-ui,sans-serif;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;}
.sl-scope *{box-sizing:border-box;-webkit-text-fill-color:currentColor !important;}
.sl-scope.sl-page{background:var(--page) !important;padding:20px 16px 30px;border-radius:14px;}
.sl-h{font-size:22px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;color:var(--ink) !important;}
.sl-rule{width:44px;height:4px;background:var(--accent) !important;border-radius:2px;margin:8px 0 5px;}
.sl-sub{font-size:12px;color:var(--faint) !important;-webkit-text-fill-color:var(--faint) !important;margin-bottom:2px;}
.sl-tabs{display:flex;gap:6px;margin:16px 0 16px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;}
.sl-tab{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;padding:9px 12px;
  border-radius:8px;border:1.5px solid var(--border) !important;background:transparent !important;color:var(--dim) !important;
  -webkit-text-fill-color:var(--dim) !important;cursor:pointer;flex:0 0 auto;}
.sl-tab.active{background:var(--accent) !important;border-color:var(--accent) !important;color:var(--on) !important;-webkit-text-fill-color:var(--on) !important;}
.sl-card{background:var(--card) !important;border:1.5px solid var(--border) !important;border-radius:12px;padding:20px;margin:0 0 16px 0;}
.sl-card.hero{background:var(--hero) !important;border-color:var(--hero) !important;}
.sl-kicker{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;margin-bottom:11px;}
.sl-card.hero .sl-kicker{color:var(--hero-kick) !important;-webkit-text-fill-color:var(--hero-kick) !important;}
.sl-hword{font-size:37px;font-weight:800;letter-spacing:-.02em;line-height:.98;text-transform:uppercase;color:var(--on) !important;-webkit-text-fill-color:var(--on) !important;}
.sl-sub2{margin-top:6px;font-size:18px;font-weight:800;text-transform:uppercase;}
.sl-sub2 .vs{font-size:12px;font-weight:700;letter-spacing:.12em;color:var(--hero-dim) !important;-webkit-text-fill-color:var(--hero-dim) !important;}
.sl-sub2 .trap{color:var(--hero-dim) !important;-webkit-text-fill-color:var(--hero-dim) !important;text-decoration:line-through;text-decoration-thickness:2px;}
.sl-vs{font-size:22px;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;line-height:1.1;}
.sl-vs .sl-slword{color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;}
.sl-vs .sl-trap{color:var(--faint) !important;-webkit-text-fill-color:var(--faint) !important;text-decoration:line-through;text-decoration-thickness:2px;}
.sl-essence{font-size:15px;line-height:1.5;color:var(--dim) !important;-webkit-text-fill-color:var(--dim) !important;margin-top:12px;}
.sl-card.hero .sl-essence{color:var(--hero-ess) !important;-webkit-text-fill-color:var(--hero-ess) !important;margin-top:15px;}
.sl-apply{font-size:15px;line-height:1.45;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;font-weight:500;margin-top:13px;}
.sl-card.hero .sl-apply{color:var(--on) !important;-webkit-text-fill-color:var(--on) !important;}
.sl-label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;margin:16px 0 7px;}
.sl-input,.sl-textarea{width:100%;background:var(--field) !important;border:1.5px solid var(--border) !important;border-radius:8px;
  color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;font-family:inherit;font-size:15px;line-height:1.4;padding:12px 13px;outline:none;-webkit-appearance:none;appearance:none;}
.sl-input:focus,.sl-textarea:focus{border-color:var(--accent) !important;}
.sl-textarea{resize:vertical;min-height:48px;}
.sl-textarea.big{min-height:60px;font-size:16px;}
.sl-input::placeholder,.sl-textarea::placeholder{color:var(--faint) !important;-webkit-text-fill-color:var(--faint) !important;opacity:1;}
.sl-row{display:flex;gap:8px;flex-wrap:wrap;}
.sl-btn{font-family:inherit;font-weight:800;font-size:13px;letter-spacing:.05em;text-transform:uppercase;border-radius:8px;padding:13px 15px;
  border:1.5px solid var(--border) !important;background:var(--field) !important;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;cursor:pointer;-webkit-tap-highlight-color:transparent;}
.sl-btn:active{transform:translateY(1px);}
.sl-btn.gold{background:var(--accent) !important;border-color:var(--accent) !important;color:var(--on) !important;-webkit-text-fill-color:var(--on) !important;}
.sl-btn.ghost{background:transparent !important;border-color:var(--accent) !important;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;}
.sl-btn.wide{width:100%;}
.sl-btn.now{background:var(--field) !important;border-color:var(--border) !important;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;}
.sl-btn.now .em{color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;}
.sl-card.hero .sl-btn.gold{background:var(--on) !important;border-color:var(--on) !important;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;}
.sl-card.hero .sl-btn.now{background:transparent !important;border-color:#3E7EA0 !important;color:#CDE8F7 !important;-webkit-text-fill-color:#CDE8F7 !important;}
.sl-card.hero .sl-btn.now .em{color:#7DD3FC !important;-webkit-text-fill-color:#7DD3FC !important;}
.sl-meter{display:flex;align-items:baseline;gap:10px;margin:0 0 4px 0;}
.sl-meter .big{font-size:40px;font-weight:800;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;line-height:1;}
.sl-meter .small{font-size:13px;color:var(--dim) !important;-webkit-text-fill-color:var(--dim) !important;}
.sl-bar{height:8px;border-radius:99px;background:var(--field) !important;overflow:hidden;margin:8px 0;border:1px solid var(--border) !important;}
.sl-bar > i{display:block;height:100%;background:var(--accent) !important;}
.sl-pill{display:inline-block;font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px;border:1.5px solid var(--border) !important;color:var(--dim) !important;-webkit-text-fill-color:var(--dim) !important;margin:0 6px 6px 0;}
.sl-pill.warn{border-color:#E6B2AB !important;color:var(--bad) !important;-webkit-text-fill-color:var(--bad) !important;}
.sl-pill.good{border-color:#A8D6BF !important;color:var(--good) !important;-webkit-text-fill-color:var(--good) !important;}
.sl-card.hero .sl-pill{border-color:#3E7EA0 !important;color:#CDE8F7 !important;-webkit-text-fill-color:#CDE8F7 !important;}
.sl-card.hero .sl-pill.good{border-color:#5FB89A !important;color:#BDF0DA !important;-webkit-text-fill-color:#BDF0DA !important;}
.sl-card.hero .sl-pill.warn{border-color:#D9928A !important;color:#FAD4CF !important;-webkit-text-fill-color:#FAD4CF !important;}
.sl-decl{border:1.5px solid var(--border) !important;border-radius:10px;padding:13px 14px;margin:0 0 10px 0;background:var(--field) !important;}
.sl-decl.overdue{border-color:#E6B2AB !important;}
.sl-decl .out{font-size:16px;font-weight:600;color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;margin:0 0 3px 0;}
.sl-decl .meta{font-size:12px;color:var(--faint) !important;-webkit-text-fill-color:var(--faint) !important;}
.sl-decl .na{font-size:15px;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;margin:6px 0 0 0;}
.sl-reveal{border-top:1.5px dashed var(--border) !important;margin-top:14px;padding-top:14px;}
.sl-muted{color:var(--faint) !important;-webkit-text-fill-color:var(--faint) !important;font-size:13px;text-transform:none;font-weight:400;letter-spacing:0;}
.sl-center{text-align:center;}
.sl-empty{text-align:center;color:var(--dim) !important;-webkit-text-fill-color:var(--dim) !important;padding:26px 10px;font-size:16px;}
.sl-score-row{display:flex;gap:8px;}
.sl-score-row .sl-btn{flex:1;text-align:center;}
.sl-score-row .cause.on{background:var(--good) !important;border-color:var(--good) !important;color:#fff !important;-webkit-text-fill-color:#fff !important;}
.sl-score-row .mixed.on{background:var(--accent) !important;border-color:var(--accent) !important;color:#fff !important;-webkit-text-fill-color:#fff !important;}
.sl-score-row .effect.on{background:var(--bad) !important;border-color:var(--bad) !important;color:#fff !important;-webkit-text-fill-color:#fff !important;}
`;
function _slInjectCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sl-styles')) return;
  const s = document.createElement('style');
  s.id = 'sl-styles';
  s.textContent = SLL_CSS;
  document.head.appendChild(s);
}

function _slHeadline(card) {
  if (card.type === 'foundation') return `<div class="sl-hword">${_slEsc(card.name)}</div>`;
  return `<div class="sl-hword">${_slEsc(card.sl)}</div>` +
         `<div class="sl-sub2"><span class="vs">NOT</span> <span class="trap">${_slEsc(card.trap)}</span></div>`;
}

/* ===================== TODAY-TAB ENTRY CARD ============================== */
export function renderStraightLineCard(state) {
  if (state && !_ST) _ST = state;
  _slInjectCSS();
  const card = _slTodaysCard();
  const ev = _slEvidence();
  const due = _slDueCards().length;
  const overdue = ev.overdue.length;
  return `
  <div class="sl-scope">
    <div class="sl-card hero" id="sl-today-card">
      <div class="sl-kicker">The Line · Ch ${card.ch}</div>
      ${_slHeadline(card)}
      <div class="sl-essence">${_slEsc(card.essence)}</div>
      <div class="sl-row" style="margin-top:16px">
        <button class="sl-btn gold" onclick="slOpenPage('line')">Walk today's line</button>
        <button class="sl-btn now" onclick="slOpenPage('now')">⟶ Straight-line <span class="em">now</span></button>
      </div>
      <div style="margin-top:12px">
        ${due ? `<span class="sl-pill">${due} to recall</span>` : `<span class="sl-pill good">recall clear</span>`}
        ${overdue ? `<span class="sl-pill warn">${overdue} declaration${overdue>1?'s':''} overdue</span>` : ``}
        <span class="sl-pill">cause ${ev.cause}/${ev.logged||0} of last 20</span>
      </div>
    </div>
  </div>`;
}

/* ===================== FULL PAGE SHELL =================================== */
export function renderStraightLineTab(deps) {
  if (deps && deps.state && !_ST) _ST = deps.state;
  _slInjectCSS();
  const d = _slData();
  const view = d._view || 'line';
  return `
  <div class="sl-scope sl-page">
    <div class="sl-h">The Line</div>
    <div class="sl-rule"></div>
    <div class="sl-sub">Separate what you know from what you live — Djukich, Ch 9</div>
    <div class="sl-tabs" id="sl-tabs">
      <button class="sl-tab ${view==='line'?'active':''}" data-v="line">Today</button>
      <button class="sl-tab ${view==='now'?'active':''}" data-v="now">Now</button>
      <button class="sl-tab ${view==='recall'?'active':''}" data-v="recall">Recall</button>
      <button class="sl-tab ${view==='ledger'?'active':''}" data-v="ledger">Ledger</button>
      <button class="sl-tab ${view==='progress'?'active':''}" data-v="progress">Evidence</button>
    </div>
    <div id="sl-view"></div>
  </div>`;
}

/* ===================== PER-RENDER INIT (like initClarityTab) ============= */
export function initStraightLineTab(deps) {
  _slCapture(deps);
  _slWire();
  _slInjectCSS();
  const tabs = document.getElementById('sl-tabs');
  if (tabs) {
    tabs.querySelectorAll('.sl-tab').forEach(b => {
      b.addEventListener('click', () => {
        _slData()._view = b.dataset.v;
        tabs.querySelectorAll('.sl-tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        _slRenderView();
      });
    });
  }
  _slRenderView();
}

/* ===================== LOAD-TIME INIT (like initSceneActions) ============ */
export function initStraightLineActions(deps) {
  _slCapture(deps);
  _slWire();
}

/* attach window handlers once (inline onclick targets) */
function _slWire() {
  if (_wired || typeof window === 'undefined') return;
  _wired = true;
  window.slOpenPage = (view) => { _slData()._view = view || 'line'; _slSetTab('straightline'); };
  window.slDeclare = _slDeclare;
  window.slLogNow = _slLogNow;
  window.slFlip = _slFlip;
  window.slGradeCard = _slGradeCard;
  window.slScore = _slScore;
  window.slSaveLedgerNote = _slSaveLedgerNote;
  window.slCloseDecl = _slCloseDecl;
}

function _slRenderView() {
  const host = document.getElementById('sl-view');
  if (!host) return;
  const view = _slData()._view || 'line';
  if (view === 'line') host.innerHTML = _slViewLine();
  else if (view === 'now') host.innerHTML = _slViewNow();
  else if (view === 'recall') host.innerHTML = _slViewRecall();
  else if (view === 'ledger') host.innerHTML = _slViewLedger();
  else if (view === 'progress') host.innerHTML = _slViewProgress();
}
function _slSyncTab(v) {
  const tabs = document.getElementById('sl-tabs');
  if (tabs) tabs.querySelectorAll('.sl-tab').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}

/* ---- VIEW: THE LINE (daily declaration) -------------------------------- */
function _slDraft(k, v) {
  const d = _slData();
  d._draft = d._draft || {};
  if (v !== undefined) { d._draft[k] = v; return v; }
  return d._draft[k] || '';
}
function _slViewLine() {
  const card = _slTodaysCard();
  return `
    <div class="sl-card hero">
      <div class="sl-kicker">Ch ${card.ch}${card.type==='foundation'?' · Foundation':''}</div>
      ${_slHeadline(card)}
      <div class="sl-essence">${_slEsc(card.essence)}</div>
      <div class="sl-apply">${_slEsc(card.apply)}</div>
    </div>
    <div class="sl-card">
      <div class="sl-label">1 · Where are you at the effect right now?</div>
      <textarea id="sl-l-sit" class="sl-textarea" placeholder="The real situation — no dressing it up.">${_slEsc(_slDraft('sit'))}</textarea>
      <div class="sl-label">2 · The outcome you're committing to</div>
      <textarea id="sl-l-out" class="sl-textarea" placeholder="Not a wish. The result, stated as done.">${_slEsc(_slDraft('out'))}</textarea>
      <div class="sl-label">By when</div>
      <input id="sl-l-dl" type="date" class="sl-input" value="${_slEsc(_slDraft('dl'))}" />
      <div class="sl-label" style="color:var(--accent)">3 · The next action — do this first</div>
      <textarea id="sl-l-na" class="sl-textarea big" placeholder="The single move that starts the straight line.">${_slEsc(_slDraft('na'))}</textarea>
      <div class="sl-row" style="margin-top:14px">
        <button class="sl-btn gold wide" onclick="slDeclare()">Declare it</button>
      </div>
      <div class="sl-muted sl-center" style="margin-top:8px">A commitment with no deadline is interest wearing a costume.</div>
    </div>`;
}
function _slDeclare() {
  const sit = (document.getElementById('sl-l-sit')||{}).value || '';
  const out = (document.getElementById('sl-l-out')||{}).value || '';
  const dl  = (document.getElementById('sl-l-dl') ||{}).value || '';
  const na  = (document.getElementById('sl-l-na') ||{}).value || '';
  if (!out.trim() && !na.trim()) { alert('Declare an outcome or a next action first.'); return; }
  const d = _slData();
  const card = _slTodaysCard();
  d.declarations.unshift({
    id:_slUid(), date:_slToday(), ch:card.ch,
    situation:sit.trim(), outcome:out.trim(), deadline:dl||null,
    nextAction:na.trim(), status:'open', closedAt:null
  });
  d._draft = {};
  d._view = 'ledger';
  _slSave();
  const host = document.getElementById('sl-view');
  if (host) host.innerHTML = _slViewLedger();
  _slSyncTab('ledger');
}

/* ---- VIEW: STRAIGHT-LINE NOW ------------------------------------------- */
function _slViewNow() {
  const d = _slData();
  const recent = (d.interventions||[]).slice(0,5);
  return `
    <div class="sl-card" style="border-color:#E6B2AB;border-width:2px">
      <div class="sl-kicker" style="color:#C1121F;-webkit-text-fill-color:#C1121F">Caught yourself drifting?</div>
      <div class="sl-vs" style="font-size:22px">Name it. Redraw the line. Move.</div>
      <div class="sl-label">Where am I being the effect, right now?</div>
      <textarea id="sl-n-eff" class="sl-textarea" placeholder="The story I'm telling myself this second."></textarea>
      <div class="sl-label" style="color:var(--accent)">Straight line from here — the very next move</div>
      <textarea id="sl-n-sl" class="sl-textarea big" placeholder="What does the cause do right now?"></textarea>
      <button class="sl-btn gold wide" style="margin-top:12px" onclick="slLogNow()">Log &amp; go</button>
      <div class="sl-muted sl-center" style="margin-top:8px">Being the cause happens in the moment, not at 9pm.</div>
    </div>
    ${recent.length ? `<div class="sl-card">
      <div class="sl-label">Recent catches</div>
      ${recent.map(x=>`<div class="sl-decl">
        <div class="meta">${_slEsc(new Date(x.ts).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</div>
        <div class="out" style="font-size:15px;color:var(--dim)">${_slEsc(x.effect||'—')}</div>
        <div class="na">⟶ ${_slEsc(x.straightLine||'—')}</div>
      </div>`).join('')}
    </div>` : ''}`;
}
function _slLogNow() {
  const eff = (document.getElementById('sl-n-eff')||{}).value || '';
  const sl  = (document.getElementById('sl-n-sl') ||{}).value || '';
  if (!sl.trim() && !eff.trim()) { alert('Write the straight line first.'); return; }
  const d = _slData();
  d.interventions.unshift({ id:_slUid(), ts:_slNow(), effect:eff.trim(), straightLine:sl.trim() });
  _slSave();
  const host = document.getElementById('sl-view');
  if (host) host.innerHTML = _slViewNow();
}

/* ---- VIEW: RECALL ------------------------------------------------------- */
function _slViewRecall() {
  const due = _slDueCards();
  if (!due.length) {
    const d = _slData();
    const next = SLL_DECK.map(c=>(d.cards[c.id]||{}).due||0).filter(x=>x>_slNow()).sort((a,b)=>a-b)[0];
    const when = next ? _slFmtDate(new Date(next).toISOString()) : '';
    return `<div class="sl-card"><div class="sl-empty">
      Recall is clear.<br><span class="sl-muted">${when?('Next card returns '+when+'.'):'Every distinction is scheduled.'}</span>
      </div></div>`;
  }
  const card = due[0];
  const s = _slData().cards[card.id];
  const firstTime = !s.seen;
  return `
    <div class="sl-card" id="sl-recall-card" data-id="${card.id}">
      <div class="sl-kicker">Ch ${card.ch} · ${due.length} due</div>
      ${card.type==='foundation'
        ? `<div class="sl-vs" style="font-size:20px">${_slEsc(card.name)}</div>
           <div class="sl-apply" style="font-style:normal;color:var(--dim)">In your own words — what is this, and how do you live it?</div>`
        : `<div class="sl-vs" style="font-size:22px"><span class="sl-slword">${_slEsc(card.sl)}</span>
             <span class="sl-muted" style="font-size:15px">vs</span>
             <span class="sl-trap">${_slEsc(card.trap)}</span></div>
           <div class="sl-apply" style="font-style:normal;color:var(--dim)">Which side is the straight line — and what does it mean? Say it before you flip.</div>`}
      <div id="sl-reveal-slot"></div>
      <div class="sl-row" id="sl-recall-controls" style="margin-top:16px">
        <button class="sl-btn gold wide" onclick="slFlip('${card.id}')">Flip</button>
      </div>
    </div>
    ${firstTime ? `<div class="sl-card">
      <div class="sl-label">First time — encode it (this is what makes it yours)</div>
      <textarea id="sl-enc-mean" class="sl-textarea" placeholder="What it means to me — one line, then stop.">${_slEsc(s.myMeaning||'')}</textarea>
      <div class="sl-label">One example from TJM or the shop</div>
      <textarea id="sl-enc-ex" class="sl-textarea" placeholder="A real moment this applies to.">${_slEsc(s.myExample||'')}</textarea>
    </div>` : (s.myMeaning || s.myExample) ? `<div class="sl-card">
      <div class="sl-label">Your encoding</div>
      ${s.myMeaning?`<div class="sl-essence">“${_slEsc(s.myMeaning)}”</div>`:''}
      ${s.myExample?`<div class="sl-muted" style="margin-top:6px">e.g. ${_slEsc(s.myExample)}</div>`:''}
    </div>`:''}`;
}
function _slFlip(id) {
  const card = SLL_DECK[_slDeckIndexById(id)];
  const slot = document.getElementById('sl-reveal-slot');
  const ctr = document.getElementById('sl-recall-controls');
  if (!card || !slot || !ctr) return;
  const answer = card.type==='foundation'
    ? `<div class="sl-essence">${_slEsc(card.essence)}</div>`
    : `<div class="sl-essence"><b style="color:var(--accent)">${_slEsc(card.sl)}</b> is the straight line. ${_slEsc(card.essence)}</div>`;
  slot.innerHTML = `<div class="sl-reveal">${answer}</div>`;
  ctr.innerHTML = `
    <button class="sl-btn" style="flex:1" onclick="slGradeCard('${id}','again')">Again</button>
    <button class="sl-btn gold" style="flex:1" onclick="slGradeCard('${id}','good')">Good</button>
    <button class="sl-btn ghost" style="flex:1;border-color:var(--accent)" onclick="slGradeCard('${id}','easy')">Easy</button>`;
}
function _slGradeCard(id, grade) {
  const mean = document.getElementById('sl-enc-mean');
  const ex = document.getElementById('sl-enc-ex');
  if (mean || ex) {
    const s = _slData().cards[id];
    if (s) {
      if (mean) s.myMeaning = (mean.value||'').trim().slice(0,240);
      if (ex) s.myExample = (ex.value||'').trim().slice(0,240);
    }
  }
  _slGrade(id, grade);
  const host = document.getElementById('sl-view');
  if (host) host.innerHTML = _slViewRecall();
}

/* ---- VIEW: THE LEDGER --------------------------------------------------- */
function _slViewLedger() {
  const d = _slData();
  const today = _slToday();
  const l = d.ledger[today] || {};
  const open = d.declarations.filter(x => x.status === 'open');
  const overdueSet = new Set(open.filter(x => x.deadline && x.deadline < today).map(x=>x.id));
  return `
    <div class="sl-card">
      <div class="sl-kicker">Tonight's honest read</div>
      <div class="sl-vs" style="font-size:20px">Today, was I the cause?</div>
      <div class="sl-score-row" style="margin-top:12px">
        <button class="sl-btn cause ${l.score==='cause'?'on':''}" onclick="slScore('cause')">Cause</button>
        <button class="sl-btn mixed ${l.score==='mixed'?'on':''}" onclick="slScore('mixed')">Mixed</button>
        <button class="sl-btn effect ${l.score==='effect'?'on':''}" onclick="slScore('effect')">At the effect</button>
      </div>
      <div class="sl-label">Where exactly (optional)</div>
      <textarea id="sl-led-note" class="sl-textarea" placeholder="One line of truth.">${_slEsc(l.note||'')}</textarea>
      <button class="sl-btn ghost wide" style="margin-top:10px" onclick="slSaveLedgerNote()">Save note</button>
    </div>
    <div class="sl-card">
      <div class="sl-label">Open declarations — did you produce them?</div>
      ${open.length ? open.map(x => `
        <div class="sl-decl ${overdueSet.has(x.id)?'overdue':''}">
          <div class="out">${_slEsc(x.outcome || x.nextAction || '—')}</div>
          <div class="meta">declared ${_slFmtDate(x.date)}${x.deadline?` · due ${_slFmtDate(x.deadline)}`:''}${overdueSet.has(x.id)?' · <span style="color:#E8956F">overdue</span>':''} · Ch ${x.ch}</div>
          ${x.nextAction?`<div class="na">⟶ ${_slEsc(x.nextAction)}</div>`:''}
          <div class="sl-row" style="margin-top:10px">
            <button class="sl-btn" style="flex:1" onclick="slCloseDecl('${x.id}','kept')">Produced it</button>
            <button class="sl-btn ghost" style="flex:1" onclick="slCloseDecl('${x.id}','broken')">Didn't</button>
          </div>
        </div>`).join('') : `<div class="sl-empty">No open declarations. Walk a line on the Today view.</div>`}
    </div>`;
}
function _slScore(v) {
  const d = _slData();
  const today = _slToday();
  d.ledger[today] = d.ledger[today] || {};
  d.ledger[today].score = v;
  _slSave();
  const host = document.getElementById('sl-view');
  if (host) host.innerHTML = _slViewLedger();
}
function _slSaveLedgerNote() {
  const d = _slData();
  const today = _slToday();
  d.ledger[today] = d.ledger[today] || {};
  d.ledger[today].note = ((document.getElementById('sl-led-note')||{}).value || '').trim();
  _slSave();
}
function _slCloseDecl(id, status) {
  const d = _slData();
  const x = d.declarations.find(z => z.id === id);
  if (!x) return;
  x.status = status; x.closedAt = _slToday();
  _slSave();
  const host = document.getElementById('sl-view');
  if (host) host.innerHTML = _slViewLedger();
}

/* ---- VIEW: EVIDENCE ----------------------------------------------------- */
function _slViewProgress() {
  const ev = _slEvidence();
  const causePct = ev.logged ? Math.round((ev.cause/ev.logged)*100) : 0;
  const seenPct = Math.round((ev.seenCount/ev.total)*100);
  const keptTotal = ev.kept + ev.broken;
  const keptPct = keptTotal ? Math.round((ev.kept/keptTotal)*100) : 0;
  return `
    <div class="sl-card">
      <div class="sl-kicker">Who you're becoming — the evidence</div>
      <div class="sl-meter"><span class="big">${ev.cause}<span style="font-size:22px;color:var(--faint)">/${ev.logged||0}</span></span>
        <span class="small">days operating as the cause,<br>of the last 20 you logged</span></div>
      <div class="sl-bar"><i style="width:${causePct}%"></i></div>
    </div>
    <div class="sl-card">
      <div class="sl-label">Declarations kept</div>
      <div class="sl-meter"><span class="big">${keptPct}%</span>
        <span class="small">${ev.kept} produced · ${ev.broken} not${ev.overdue.length?` · ${ev.overdue.length} overdue right now`:''}</span></div>
      <div class="sl-bar"><i style="width:${keptPct}%"></i></div>
      <div class="sl-muted" style="margin-top:8px">Commitment leaves no exit. This number is the truth about that.</div>
    </div>
    <div class="sl-card">
      <div class="sl-label">Distinctions in active recall</div>
      <div class="sl-meter"><span class="big">${ev.seenCount}<span style="font-size:22px;color:var(--faint)">/${ev.total}</span></span>
        <span class="small">encoded and scheduled</span></div>
      <div class="sl-bar"><i style="width:${seenPct}%"></i></div>
    </div>
    ${ev.overdue.length ? `<div class="sl-card" style="border-color:#5A2A2A">
      <div class="sl-label" style="color:#E8956F">Confront these — declared, not produced, past due</div>
      ${ev.overdue.map(x=>`<div class="sl-decl overdue">
        <div class="out">${_slEsc(x.outcome||x.nextAction||'—')}</div>
        <div class="meta">due ${_slFmtDate(x.deadline)} · Ch ${x.ch}</div>
      </div>`).join('')}
    </div>`:''}`;
}
