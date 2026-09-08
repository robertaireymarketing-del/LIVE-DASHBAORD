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
  { id:"ch1", ch:1, type:"foundation", name:"Inner Stance", essence:"Where you come from — not where you want to go — determines your results.", deep:"Your inner stance is the place you operate from before you do anything — owner or victim, cause or effect. Change the stance and the same task, same day, same obstacle produces a completely different outcome.", effect:"You blame the circumstances, wait to feel ready, or explain why today didn't work — all signs of coming from the wrong stance.", move:"Before the next task, consciously choose the stance you're operating from, the way you'd pick which door to walk through.", mine:"The difference between a TJM day that moves and one that doesn't is rarely the to-do list — it's the stance you sat down with. Set it on purpose before you open the laptop.", apply:"What stance are you operating from right now — a key to your castle, or your jail cell?" },
  { id:"ch2", ch:2, type:"foundation", name:"The Circular World", essence:"The circle is motion without progress — same patterns, same complaints, arriving nowhere.", deep:"In the circle you're busy, even sincere, but you keep revisiting the same problems and end each week roughly where you started. It feels like effort; it produces laps, not distance.", effect:"You keep re-researching, re-planning, or re-deciding the same thing, or having the same frustration on repeat.", move:"Name the loop out loud, then take one action that breaks out of it instead of going round again.", mine:"If you've 'been meaning to' fix the same TJM bottleneck for weeks — pricing, a supplier, the listing backlog — that's a circle. Break it with one concrete move today.", apply:"Where in TJM or the shop are you circling — busy, but back where you started?" },
  { id:"ch3", ch:3, type:"foundation", name:"The Zigzag World", essence:"The zigzag starts, stops, and changes direction — it never draws a straight line to the outcome.", deep:"Zigzagging is chasing the newest idea, abandoning what you started, and scattering energy across ten half-finished things. Motion looks impressive, but nothing reaches done.", effect:"Lots of started projects, few finished ones; a new tactic every week; a trail of things dropped when they got hard or boring.", move:"Pick the one line that matters and walk it to completion before starting anything else.", mine:"TJM will grow faster from finishing three things than starting fifteen. When a shiny new channel tempts you mid-task, that's the zigzag.", apply:"What did you start and abandon this week before it produced?" },
  { id:"ch4", ch:4, type:"foundation", name:"Straight-Line People", essence:"They move directly from where they are to where they intend to be — and take others with them.", deep:"A straight-line person decides the outcome and goes at it without the detours of doubt, blame, or delay. They're not more talented — they just refuse to zigzag.", effect:"The opposite: hesitating, hedging, waiting for certainty, letting the day set the agenda.", move:"Decide the outcome first, then take the most direct action available, however small.", mine:"The founders who build the biggest brands aren't the cleverest — they're the straightest. That's the person you're training yourself to be with this page.", apply:"Name one straight line you can walk today, start to finish, no zigzag." },
  { id:"ch5", ch:5, sl:"Creating", trap:"Wanting", essence:"Wanting keeps the thing in the future, away from you; creating causes it into being now.", deep:"Wanting is passive — you sit in desire and wait for the moment. Creating is active — you take the actions that bring the thing into existence, whether or not conditions are perfect.", effect:"You talk about what you want for the business, picture it, plan it — but the wanting never converts into building.", move:"Ask 'what would I do right now if I were creating this, not wanting it?' — then do that.", mine:"You want TJM to be the biggest online jeweller. Wanting writes a vision doc; creating ships the next ten listings today.", apply:"What are you 'wanting' that you could start creating today instead?" },
  { id:"ch6", ch:6, sl:"Stop Stopping", trap:"Stopping", essence:"You don't need more starting — you need to stop stopping. The stops are the problem.", deep:"You already start plenty. The problem is the stops: the quit points where momentum dies. Progress is mostly about removing the stops, not adding more bursts of effort.", effect:"You begin well then stall — at the boring bit, the hard bit, the unsure bit — and the thing sits half-done.", move:"Find your usual stop point and pre-decide to push through it just once.", mine:"How many TJM tasks die at 80%? The item shot but not listed, the video filmed but not posted. Stop stopping there.", apply:"Where do you keep stopping — and what would not-stopping look like today?" },
  { id:"ch7", ch:7, type:"foundation", name:"What Distinguishes a Leader", essence:"A leader causes results and is a stand for others producing them too.", deep:"Leadership here isn't a title — it's being the cause, and holding others as capable of being the cause. You lead by the stance you take, not the authority you hold.", effect:"Managing tasks and chasing people, rather than setting a standard and standing for it.", move:"Decide what result you're a stand for today — yours or someone else's — and hold it without wavering.", mine:"As TJM grows and you bring in help — a VA, a photographer — leadership is holding them as owners, not just handing out tasks.", apply:"Whose result are you a stand for today?" },
  { id:"ch8", ch:8, sl:"A Decision to Make", trap:"A Problem", essence:"There are no problems — only decisions you haven't made yet.", deep:"What we call a 'problem' is usually a decision we're avoiding. The weight isn't the situation; it's the unmade choice sitting on top of it. Make the decision and the problem dissolves into action.", effect:"You describe something as a stubborn 'problem' and keep turning it over, when really you just haven't decided.", move:"Rename the problem as the specific decision you're dodging, then make it.", mine:"'My supplier situation is a problem' is really 'I haven't decided to replace them.' Make the call.", apply:"Restate your biggest 'problem' right now as the decision you're avoiding." },
  { id:"ch9", ch:9, sl:"What I Live", trap:"What I Know", essence:"It's never what you know — what does you good is what you live.", deep:"Knowledge sits inert in your head and changes nothing. Only what you actually live — enact, embody, do — produces results. Most people substitute knowing for living and wonder why nothing moves.", effect:"You've read the books, you know the principles, you can explain them — but your days don't reflect them.", move:"Take one thing you already know you should do and live it today, even badly.", mine:"You know exactly what would grow TJM. This whole page exists to close the gap between that knowing and your living it.", apply:"Name one thing you KNOW you should be doing in the business — and to what degree do you LIVE it?" },
  { id:"ch10", ch:10, sl:"Choose to", trap:"Want to", essence:"'Want to' waits on a feeling; 'choose to' is a stand you take regardless.", deep:"'Want to' is conditional — it needs the mood to be right. 'Choose to' is a decision that stands whether or not you feel like it. Commitment lives in choosing, not wanting.", effect:"You do things when you feel like it and skip them when you don't — your output rides your mood.", move:"Convert one 'I want to' into 'I choose to,' and act on it before the feeling arrives.", mine:"'I want to post content daily' collapses the first flat morning. 'I choose to' posts anyway.", apply:"Turn one 'I want to' into 'I choose to' right now — and act on it." },
  { id:"ch11", ch:11, sl:"Won't", trap:"Can't", essence:"'Can't' is almost always 'won't' in disguise — tell the truth about which.", deep:"'Can't' sounds like a fact about the world; usually it's a choice you're hiding from yourself. Naming it 'won't' returns your power, because a won't is something you can change.", effect:"You say 'I can't' about things that are really 'I won't pay the price' or 'I won't risk it.'", move:"Every time you catch a 'can't,' test it: truly impossible, or unwilling? Say the true one.", mine:"'I can't afford ads yet' is often 'I won't commit the budget.' Different sentence, different power.", apply:"Say it plainly: is it that you can't, or that you won't?" },
  { id:"ch12", ch:12, sl:"Truthful About Where You Are", trap:"Lying About It", essence:"You can't leave a place you won't admit you're standing in.", deep:"Progress starts from an honest read of your actual position. Dressing up where you are — to yourself or others — freezes you there, because you can't navigate from a false location.", effect:"You round the numbers up, tell yourself it's 'nearly there,' or avoid looking at the real state of things.", move:"State your real position on the thing that matters — plainly, no spin — then move from there.", mine:"With your accountant's eye, look at TJM's real numbers, not the flattering version. The straight line starts from the true figure.", apply:"Where are you actually — not where you'd like to be seen — on your top priority?" },
  { id:"ch13", ch:13, sl:"Serving", trap:"Pleasing", essence:"Pleasing keeps people comfortable; serving moves them forward.", deep:"Pleasing bends to be liked and avoids friction. Serving does what actually helps, even when it's unwelcome. They often look alike and lead to opposite places.", effect:"You soften the truth, say yes to keep the peace, or avoid the hard conversation to stay liked.", move:"Ask 'am I doing this to be liked, or to actually help?' — and choose serving.", mine:"In the shop and with customers, serving sometimes means telling someone the piece isn't right for them. That builds more trust than pleasing.", apply:"Where are you pleasing someone when serving them means saying the hard thing?" },
  { id:"ch14", ch:14, sl:"A Created World", trap:"A Reported-on World", essence:"Reporters describe what is; creators call into being what isn't yet.", deep:"You can spend your life narrating reality — what's happening, what others did — or generating it by declaring and building what doesn't exist. One is commentary; the other is creation.", effect:"You catch yourself describing the situation, the market, the competition — instead of making your own move in it.", move:"Swap one piece of commentary today for one act of creation.", mine:"Don't just report on the jewellery market and where TJM sits in it. Create TJM's position by building it.", apply:"Are you reporting on TJM's situation today, or creating its next state?" },
  { id:"ch15", ch:15, sl:"A Project", trap:"A Dream", essence:"A dream floats; a project has a deadline, actions, and a next step.", deep:"A dream is a feeling with no edges. A project is a dream given structure — a due date, defined actions, and something you can do today. Dreams inspire; projects deliver.", effect:"Your big ambitions live as vague 'somedays' with no dates or next actions attached.", move:"Take one dream and give it a deadline and the very next action.", mine:"'Biggest online jeweller' is a dream until it's a project: this quarter's target, this week's actions, today's next step.", apply:"Take one 'dream' for the business and give it a deadline and a next action." },
  { id:"ch16", ch:16, sl:"Concern", trap:"Worry", essence:"Worry spins and produces nothing; concern converts into a corrective action.", deep:"Worry is anxiety on a loop — it burns energy and changes nothing. Concern takes the same care and channels it into a specific action that addresses the thing.", effect:"You lie awake turning a problem over, or ruminate at your desk, without doing anything about it.", move:"Turn the worry into one corrective action and take it now; if there's no action, drop it.", mine:"Worried about cash flow, a delivery, a bad review? Concern does the one thing that helps and lets the rest go.", apply:"Turn today's worry into a single concrete corrective action." },
  { id:"ch17", ch:17, sl:"Musts", trap:"Shoulds", essence:"A 'should' is optional and never happens; a 'must' gets done.", deep:"Shoulds are wishes with no teeth — they slide from day to day. Musts are non-negotiable, and the mind finds a way to deliver them. What you make a must, you do.", effect:"Your list is full of 'I really should' items that quietly roll over week after week.", move:"Promote one 'should' to a 'must' and treat it as non-negotiable today.", mine:"'I should sort the product photography' becomes real the day it's a must with a slot in the day.", apply:"Name one 'should' that has to become a 'must' today." },
  { id:"ch18", ch:18, sl:"I'm Responsible", trap:"It's Their Fault", essence:"Responsibility is where your power lives; blame hands it away.", deep:"Blame feels justified and satisfying, but it puts the cause of your results outside you, where you can't touch it. Taking responsibility — even for what isn't your fault — is the only place you can act from.", effect:"You explain a bad result by pointing at other people, the platform, the algorithm, the economy.", move:"Take full responsibility for one outcome you've been blaming elsewhere, and find your move.", mine:"'Instagram killed my reach' may be true, but it's powerless. 'What's my move given that?' is where TJM grows.", apply:"Where are you assigning fault — and what does taking full responsibility unlock?" },
  { id:"ch19", ch:19, sl:"Growth Choices", trap:"Safe Choices", essence:"Safe choices keep you small; growth choices are where you expand.", deep:"The safe option protects what you have and avoids discomfort — and quietly keeps you where you are. Growth choices carry risk and stretch, and they're the only ones that make you bigger.", effect:"You default to the comfortable, low-risk option and call it being sensible.", move:"Where you're torn, take the choice that grows you, not the one that protects you.", mine:"Staying purely in the safety of the family shop is the safe choice. Building TJM is the growth choice — that's why it's the one.", apply:"What's the growth choice you're avoiding because the safe one is easier?" },
  { id:"ch20", ch:20, sl:"Only Results Count", trap:"Content with Insight", essence:"Insight feels like progress and produces nothing — only results count.", deep:"It's easy to mistake realisations, plans, and learning for achievement. They're not. A result is something that exists in the world. Djukich is blunt: you're not a walking library.", effect:"You finish a book, a course, or a planning session feeling productive — with nothing actually produced.", move:"Before today ends, produce one real result — not a realisation.", mine:"A day of 'learning about e-commerce' with no listing shipped is a day at zero. Results are pieces sold, not insights collected.", apply:"What result — not realisation — will you produce before today ends?" },
  { id:"ch21", ch:21, sl:"The Valley of Death", trap:"Optimistic Denial", essence:"Denial skips the hard middle; every real result makes you walk through the valley.", deep:"Between deciding and achieving there's a hard, ugly middle — the valley — where it's tempting to pretend everything's fine or quit. Optimistic denial avoids it; producing means walking through it.", effect:"You gloss over the difficult stretch, tell yourself it's fine, and avoid the grind the outcome requires.", move:"Name the hard middle you're avoiding and take the next step into it.", mine:"Scaling TJM has a valley — the unglamorous grind of volume, ops, and problems. Walking it is the price of the far side.", apply:"What hard middle are you avoiding by staying optimistic on the surface?" },
  { id:"ch22", ch:22, sl:"Productivity", trap:"Busyness", essence:"Busyness is motion; productivity is the result. They're not the same.", deep:"Busyness fills time and feels virtuous; it often hides the absence of results. Productivity is measured only by what got produced. You can be flat-out busy and produce nothing.", effect:"You end a packed day tired but can't point to anything that actually moved the needle.", move:"Cut one busy task that produces nothing, and put that time on a core action.", mine:"Tidying the spreadsheet and reorganising folders feels busy. Shooting and shipping stock is productive.", apply:"Cross off one busy task today that isn't producing anything real." },
  { id:"ch23", ch:23, sl:"Commitment", trap:"Trying", essence:"'Trying' has failure built in as permission; commitment leaves no exit.", deep:"'I'll try' pre-installs an excuse — it's a hedge that expects to fail. Commitment removes the exit: you're doing it, full stop, and you find a way. The word you choose shapes the result.", effect:"You 'give it a go,' 'see how it lands,' 'try your best' — language already braced for not-quite.", move:"Replace 'I'll try' with 'I will,' and mean it, on one thing today.", mine:"'I'll try to post daily' vs 'I post daily.' The second builds the TJM audience; the first fades in a week.", apply:"Where are you 'trying' — and what does full commitment look like instead?" },
  { id:"ch24", ch:24, sl:"Owner", trap:"Victim", essence:"Owners cause outcomes; victims wait for rescue and complain.", deep:"The owner acts on the situation; the victim is acted upon and narrates why it's unfair. Complaining is a poor substitute for a result — it feels like doing something while nothing changes.", effect:"You find yourself explaining, complaining, or waiting for conditions to improve before you move.", move:"Take the owner's move on the thing you've been a victim of — act, don't wait.", mine:"As a solo founder there's no one coming to fix it — which is the point. Every TJM result is yours to own.", apply:"Where are you being the victim of a circumstance you could own?" },
  { id:"ch25", ch:25, sl:"The Same", trap:"Separate", essence:"Separateness breeds blame and distance; seeing yourself as the same closes the gap.", deep:"When you hold others as separate — different, opposed, beneath you — you create distance and blame. Seeing yourself as fundamentally the same as them dissolves the gap and makes real influence possible.", effect:"You write people off, feel above or against them, or relate to them as obstacles.", move:"Pick someone you're holding at a distance and relate to them as the same as you.", mine:"Customers, suppliers, even competitors — leading in the jewellery space is easier when you meet people as equals, not as threats.", apply:"Who are you holding at a distance that you'd lead better by standing with?" },
  { id:"ch26", ch:26, sl:"Agreements", trap:"Expectations", essence:"Unspoken expectations breed resentment; clear agreements create accountability.", deep:"An expectation is a demand you never voiced — so when it's not met, you resent someone for breaking a rule they never agreed to. An agreement is explicit, mutual, and something both sides can be held to.", effect:"You're quietly annoyed someone didn't do what you assumed — but you never actually agreed it.", move:"Turn one silent expectation into a spoken, explicit agreement.", mine:"With a VA or supplier, don't expect — agree. Deadlines, standards, deliverables, said out loud.", apply:"Where do you have an expectation of someone that was never made an agreement?" },
  { id:"ch27", ch:27, sl:"Radical Self-Honesty", trap:"Being Insincere", essence:"You only move as fast as you're honest with yourself.", deep:"Every place you shade the truth to yourself is a brake you can't see. Radical self-honesty — about your effort, your avoidance, your real position — is what lets you move at full speed.", effect:"You tell yourself comfortable half-truths about why something isn't done or working.", move:"Say the one honest thing about yourself you've been avoiding, plainly.", mine:"Honest question for TJM: is it slow because of the market, or because you've been avoiding the hard task? Answer straight.", apply:"What's the thing you already know but haven't let yourself say plainly?" },
  { id:"ch28", ch:28, sl:"Realistic Optimism", trap:"Unrealistic Pessimism", essence:"See it clearly and expect to win; pessimism talks you out of acting in advance.", deep:"Realistic optimism holds two things at once: a clear-eyed view of the situation and a genuine expectation of success. Pessimism dresses as 'being realistic' but is really pre-emptive surrender.", effect:"You decide it won't work before you've tried, and call that wisdom.", move:"Look at the thing clearly, then back yourself and take the shot.", mine:"'The jewellery market's saturated' pre-loses. Clear-eyed and backing yourself is how challengers win it.", apply:"Where are you pre-losing something in your head before you've acted?" },
  { id:"ch29", ch:29, sl:"Being Bold", trap:"Being Arrogant", essence:"Bold acts and risks; arrogant protects an image and risks nothing.", deep:"Boldness puts something on the line and can be wrong. Arrogance protects a self-image and avoids exposure. They can look alike, but one moves you and the other guards you.", effect:"You avoid a move because being wrong would dent how you're seen.", move:"Make the bold move you'd make if protecting your image were off the table.", mine:"Pitching TJM, going bigger, putting yourself on camera — bold. Staying safe to protect the ego is the trap.", apply:"What's the bold move you'd make today if protecting your image were off the table?" },
  { id:"ch30", ch:30, sl:"Discomfort and Pain", trap:"Chaos", essence:"Chosen discomfort is the price of growth; chaos is avoidable disorder that produces nothing.", deep:"Growth requires a specific, chosen discomfort — the hard rep, the hard task. Chaos is different: scattered, avoidable disorder you drift into. Don't dodge productive pain by staying busy in comfortable chaos.", effect:"You avoid the one hard thing by staying frantically busy with low-value mess.", move:"Trade the comfortable chaos for the one uncomfortable action that actually matters.", mine:"Firefighting little TJM admin all day is comfortable chaos. The uncomfortable, growth-making task is the one you're avoiding.", apply:"What productive discomfort are you dodging by staying in comfortable chaos?" },
  { id:"ch31", ch:31, sl:"Purpose Management", trap:"Time Management", essence:"Managing the clock isn't the same as managing what matters.", deep:"Time management optimises the schedule; purpose management asks whether what's in the schedule matters at all. A perfectly organised day of the wrong things is still the wrong day.", effect:"You're efficient at tasks that don't serve your actual purpose.", move:"Check your next block against your purpose, not just your calendar — is it the right thing?", mine:"A neatly time-blocked day that never touches TJM's growth is well-managed time and mismanaged purpose.", apply:"Does your next block of time serve your purpose, or just fill the calendar?" },
  { id:"ch32", ch:32, sl:"Extreme Self-Care", trap:"Selfishness", essence:"Caring for yourself so you can produce and serve isn't selfish.", deep:"Running yourself into the ground doesn't help anyone — it just makes you less capable. Extreme self-care (sleep, training, recovery) keeps you able to produce at full power. It's fuel, not indulgence.", effect:"You skip sleep, training, or rest to 'work harder,' and produce worse for it.", move:"Do one act of self-care that makes you more capable, not less — and don't feel guilty.", mine:"You already train and care about your health — protect that. A strong, rested you builds TJM faster than a depleted one.", apply:"What's one act of self-care today that makes you more able to produce, not less?" },
  { id:"ch33", ch:33, sl:"Choose to", trap:"How to", essence:"'I don't know how' is usually a stall — choose to, and the how shows up.", deep:"Waiting until you know how is a respectable-looking way to avoid committing. Once you genuinely choose the outcome, the how tends to reveal itself as you move. Commitment precedes clarity.", effect:"You delay because you 'need to figure out how first' — indefinitely.", move:"Commit to the outcome first; work the 'how' out in motion.", mine:"You didn't know 'how' to build TJM when you started — you chose to, and figured it out. Same on every new piece.", apply:"Where is 'I don't know how yet' standing in for 'I haven't chosen to'?" },
  { id:"ch34", ch:34, sl:"Kind", trap:"Nice", essence:"Nice avoids the hard truth to be liked; kind tells it because it serves.", deep:"Nice is about you being comfortable and liked. Kind is about them actually being helped, even when the truth stings. Real kindness sometimes looks less nice in the moment.", effect:"You hold back honest feedback or a hard truth to keep things pleasant.", move:"Say the kind-but-not-nice thing where it would actually help someone.", mine:"With staff, suppliers, or a customer, kindness is the honest steer — not the comfortable dodge.", apply:"Where would being kind today mean risking not being seen as nice?" },
  { id:"ch35", ch:35, sl:"Positive No", trap:"Rejection", essence:"A clean 'no' protects your 'yes' — it isn't rejection.", deep:"Saying no to what doesn't serve your line isn't unkind or a rejection of the person — it's a boundary that keeps your yes meaningful. Without clean nos, your commitments dilute to nothing.", effect:"You say yes to things that pull you off-line because no feels harsh.", move:"Give one clear, grounded no so your real priorities have room.", mine:"Every yes to a distraction is a no to TJM. Protect the line with a clean no.", apply:"What do you need to give a clear 'no' to so your real yes has room?" },
  { id:"ch36", ch:36, sl:"Confrontation", trap:"Tolerance", essence:"Tolerating what doesn't work is a slow leak — confront it.", deep:"What you tolerate, you get more of. Quietly putting up with a problem drains the whole system over time. Confrontation — direct, early, unflinching — stops the leak.", effect:"You put up with a broken process, a bad fit, or underperformance, hoping it sorts itself out.", move:"Confront one thing you've been tolerating, directly and now.", mine:"The supplier who's always late, the process that keeps breaking — tolerating it bleeds TJM slowly. Address it.", apply:"What are you tolerating right now that you should confront today?" },
  { id:"ch37", ch:37, sl:"Language that Creates Reality", trap:"Language that Describes Reality", essence:"Your words either report the past or generate the future.", deep:"Language isn't just description — it's generative. 'I am building X' and 'this is done by Friday' bring futures into being. Speaking only about how things are keeps you stuck in how things are.", effect:"Your talk is all commentary on the current state, never declaration of the next one.", move:"Rephrase one description into a declaration that creates what you want.", mine:"Stop saying 'TJM is small.' Start saying 'TJM is becoming the biggest' — and speak your targets as commitments.", apply:"Rephrase one thing you've been describing into language that creates what you want." },
  { id:"ch38", ch:38, sl:"Commitment", trap:"Involvement", essence:"With bacon and eggs, the chicken is involved — the pig is committed.", deep:"Involvement contributes something and keeps its options; commitment puts itself fully on the line with no way out. Know which one you actually are on the thing that matters.", effect:"You're 'involved' in your goal — dabbling, hedging — rather than all-in.", move:"On your top priority, be the pig, not the chicken — go all in.", mine:"Are you involved in TJM or committed to it? The independence you want demands the pig.", apply:"On your top priority, are you the chicken or the pig? Be honest." },
  { id:"ch39", ch:39, sl:"I Contribute", trap:"I Deserve", essence:"'Deserving' waits for reward; contributing creates value first.", deep:"The deserving mindset stands with its hand out, waiting for what it's owed. The contributing mindset creates value first and lets results follow. Markets pay contribution, not entitlement.", effect:"You feel owed success, recognition, or sales you haven't yet earned by contributing.", move:"Create value first today, without waiting to be rewarded for it.", mine:"TJM doesn't owe you customers. Contribute — great products, service, content — and the results come.", apply:"Where are you waiting to be given something you could earn by contributing first?" },
  { id:"ch40", ch:40, sl:"Corrective Actions", trap:"Protective Actions", essence:"Protecting your image stalls you; correcting your course moves you.", deep:"A protective action defends your ego or position — it hides mistakes and avoids exposure. A corrective action fixes the actual course, even if it means admitting you were wrong. Only one gets you there.", effect:"You defend a bad decision or hide an error to save face, instead of correcting it.", move:"Take the course-correction you've been avoiding because it means admitting something.", mine:"If a TJM strategy isn't working, correct it openly. Protecting the original call costs more than the climbdown.", apply:"What course-correction are you avoiding because it means admitting something?" },
  { id:"ch41", ch:41, sl:"Now", trap:"Later", essence:"'Later' is where actions go to die — do it now.", deep:"Later is rarely a real time; it's a soft way of not doing. Things that can be done now and get pushed to later mostly evaporate. Now is the straight line.", effect:"You defer small, doable actions to a 'later' that never comes.", move:"Do one thing you'd have put off, right now, before anything else.", mine:"That customer reply, that listing, that call — 'later' kills them. Do the now-able TJM task now.", apply:"What's one thing on 'later' that you'll do now, before anything else?" },
  { id:"ch42", ch:42, sl:"Childlike", trap:"Childish", essence:"Childlike is open and curious; childish is reactive and entitled.", deep:"Childlike is the good version — playful, curious, willing, unselfconscious. Childish is the trap — sulking, reactive, entitled. Same root, opposite fuel.", effect:"You react, sulk, or take things personally instead of staying open and playful.", move:"Meet the next setback childlike — curious and willing — not childish.", mine:"A bad sales day met childishly is a sulk; met childlike, it's 'huh, what can I learn and try next?'", apply:"Where could a childlike stance beat the childish reaction you're tempted by?" },
  { id:"ch43", ch:43, sl:"Playing to Win", trap:"Playing Not to Lose", essence:"Playing not to lose guarantees a small game; play to win.", deep:"Playing not to lose is defensive — you protect what you have and avoid mistakes, and you stay small. Playing to win means going for the result, accepting you might lose, and playing a bigger game.", effect:"You make cautious moves designed to avoid loss rather than bold ones aimed at winning.", move:"Where you're playing safe, make the move you'd make to actually win.", mine:"Playing not to lose keeps TJM ticking over. Playing to win is what makes it the biggest.", apply:"Where are you playing not to lose in TJM instead of playing to win?" },
  { id:"ch44", ch:44, sl:"Investment", trap:"Cost", essence:"Framed as a cost you avoid it; framed as an investment you evaluate it properly.", deep:"The same spend — money, time, energy — reads as a loss when you call it a cost and as a lever when you call it an investment. The frame changes the decision. Ask what return it buys.", effect:"You reflexively avoid spending, treating every outlay as a loss to minimise.", move:"Reframe one 'cost' you're resisting as an investment and judge it by its return.", mine:"Ads, better photography, a VA — as costs they feel like leaks; as investments in TJM's growth, they're obvious.", apply:"What 'cost' you're resisting is actually an investment in the result you want?" },
  { id:"ch45", ch:45, sl:"Core Actions", trap:"Surface Actions", essence:"Surface actions look busy; core actions move the needle.", deep:"Surface actions are the easy, visible, low-impact tasks that fill a day. Core actions are the few that actually drive results — usually harder and less comfortable. Do the core ones first.", effect:"You clear the easy surface tasks and never reach the one that matters.", move:"Identify today's single core action and do it before the surface stuff.", mine:"Tweaking the site font is surface. Getting product in front of buyers is core. Core first.", apply:"What's the one core action today that would make the surface stuff irrelevant?" },
  { id:"ch46", ch:46, sl:"Focus", trap:"Spray", essence:"Spraying effort everywhere produces nothing; focus concentrates force.", deep:"Spread thin across everything, your effort has no impact anywhere. Focus concentrates your force on one point until it gives. Intensity on one thing beats a light touch on ten.", effect:"You dip into many things a little and finish none with real force.", move:"Pick the one thing to move today and put your full force on it.", mine:"TJM across five channels half-heartedly loses to one channel done with full focus. Pick the point.", apply:"If you could only move ONE thing forward today, which gets your focus?" },
  { id:"ch47", ch:47, sl:"How it Can Be Done", trap:"Why it Can't Be Done", essence:"The reasons it can't be done are always available and always useless.", deep:"For anything worthwhile, reasons it can't work are endless and easy to find — they change nothing. The useful question is how it can be done. Hunt for the how, not the why-not.", effect:"You list the obstacles, conclude it's not possible, and stop there.", move:"Take the thing you've decided can't work and find the first way it can.", mine:"'Can't compete with the big jewellers' is a dead end. 'How can a sharper, faster TJM win a slice?' opens the door.", apply:"Take the thing you've decided 'can't' work and find the first way it can." },
  { id:"ch48", ch:48, sl:"Caring", trap:"Stressing", essence:"Stressing is self-indulgent noise; caring channels into action.", deep:"Stress is caring gone useless — the same energy, spinning, helping no one. Caring takes that energy and points it at the action that actually addresses the thing. Care hard; stress not at all.", effect:"You're wound up about something without doing the thing that would resolve it.", move:"Channel the stress into the one action caring would take, and take it.", mine:"Stressing about a TJM deadline changes nothing. Caring ships the work early.", apply:"Where are you stressing about something instead of caring enough to act on it?" },
  { id:"ch49", ch:49, sl:"Creating Perfection", trap:"Making a Living", essence:"Aim past getting by — create something excellent.", deep:"Making a living is a low bar — survival, ticking over. Creating perfection is aiming at excellence, the standard that actually builds something great. The bar you set is the ceiling you hit.", effect:"You settle for 'good enough to get by' and call it realism.", move:"Raise the bar on one thing from adequate to excellent.", mine:"'Biggest AND best' means best. Don't build a TJM that merely earns — build one that's excellent.", apply:"Where are you settling for 'making a living' when you could be creating excellence?" },
  { id:"ch50", ch:50, type:"foundation", name:"Waking Up to the Contrasts", essence:"The distinctions only work when you catch yourself mid-moment and choose the straight-line side.", deep:"All fifty distinctions are useless as theory. Their power is in the live moment — catching yourself drifting to the trap side and consciously choosing the straight line. That noticing, repeated, is the entire practice.", effect:"You know all the distinctions intellectually but don't catch yourself in real time.", move:"Once today, catch yourself mid-drift and deliberately pick the straight-line side.", mine:"This page's whole job is to make that catching automatic — so 'be the cause' runs by itself while you build TJM.", apply:"Catch yourself once today, mid-drift, and deliberately choose the straight line." },
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
.sl-r-block{margin-top:13px;}
.sl-r-block.mine{margin-top:15px;padding-top:13px;border-top:1.5px solid var(--border) !important;}
.sl-r-h{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent) !important;-webkit-text-fill-color:var(--accent) !important;margin-bottom:4px;}
.sl-r-block.mine .sl-r-h{color:var(--good) !important;-webkit-text-fill-color:var(--good) !important;}
.sl-r-t{font-size:14.5px;line-height:1.5;color:var(--dim) !important;-webkit-text-fill-color:var(--dim) !important;}
.sl-r-block.mine .sl-r-t{color:var(--ink) !important;-webkit-text-fill-color:var(--ink) !important;}
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
function _slRevealHTML(card) {
  const head = card.type === 'foundation'
    ? `<div class="sl-essence">${_slEsc(card.essence)}</div>`
    : `<div class="sl-essence"><b style="color:var(--accent);-webkit-text-fill-color:var(--accent)">${_slEsc(card.sl)}</b> is the straight line. ${_slEsc(card.essence)}</div>`;
  const block = (h, t) => t ? `<div class="sl-r-block"><div class="sl-r-h">${h}</div><div class="sl-r-t">${_slEsc(t)}</div></div>` : '';
  return `<div class="sl-reveal">${head}` +
    block('What it really means', card.deep) +
    block(card.type === 'foundation' ? 'How the trap shows up' : 'At the effect, it looks like', card.effect) +
    block('The straight-line move', card.move) +
    (card.mine ? `<div class="sl-r-block mine"><div class="sl-r-h">In your world</div><div class="sl-r-t">${_slEsc(card.mine)}</div></div>` : '') +
    `</div>`;
}

function _slFlip(id) {
  const card = SLL_DECK[_slDeckIndexById(id)];
  const slot = document.getElementById('sl-reveal-slot');
  const ctr = document.getElementById('sl-recall-controls');
  if (!card || !slot || !ctr) return;
  slot.innerHTML = _slRevealHTML(card);
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
