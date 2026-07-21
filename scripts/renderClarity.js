// ═══════════════════════════════════════════════════════════════
// renderClarity.js — Clarity: one question, one answer, one decision.
// A thinking tool for the 2–10 minute gaps. Sharpen the blade.
//
// Exports:
//   renderClarityCard(state)          → full-width card for the Today tab
//   renderClarityTab({ state })       → the full Clarity page (a tab)
//   initClarityTab({ state, saveData, saveDataQuiet, render })
//                                     → wires events after each render
//
// Storage: everything lives in state.data.clarity.entries and is written
// by the app's existing saveDataQuiet() into the user's Firestore doc.
// Colours are hardcoded navy (#0A1628) + gold (#C9A84C) so the surface is
// identical in light and dark mode, matching the identity/quote hero cards.
// ═══════════════════════════════════════════════════════════════

// ── Question bank — 10 per category, curated. Edit freely. ────────
const QUESTIONS = [
  // ── Self ──
  {id:"self-avoid",    cat:"Self", text:"What am I avoiding right now, and what is it costing me?"},
  {id:"self-remove",   cat:"Self", text:"If I removed one habit from my life this week, which would change the most?"},
  {id:"self-effort",   cat:"Self", text:"Where am I performing effort instead of making progress?"},
  {id:"self-become",   cat:"Self", text:"What would the person I'm trying to become do about today's biggest problem?"},
  {id:"self-lie",      cat:"Self", text:"What story do I keep telling myself that isn't actually true?"},
  {id:"self-energy",   cat:"Self", text:"What gives me energy and what drains it — and is my day arranged around that?"},
  {id:"self-proud",    cat:"Self", text:"If today were filmed, what would I be proud of and what would I hide?"},
  {id:"self-enough",   cat:"Self", text:"What would \u201cenough\u201d look like, and would I recognise it if I hit it?"},
  {id:"self-fear",     cat:"Self", text:"What am I afraid people would find out — and what would I do if they already knew?"},
  {id:"self-advice",   cat:"Self", text:"What advice do I give others that I'm not taking myself?"},

  // ── Business ──
  {id:"biz-bottleneck",cat:"Business", text:"What is TJM's single biggest bottleneck right now?"},
  {id:"biz-onething",  cat:"Business", text:"If TJM could do only one thing for the next 30 days, what should it be?"},
  {id:"biz-die",       cat:"Business", text:"What part of the business am I keeping alive that I should let die?"},
  {id:"biz-competitor",cat:"Business", text:"What would I change if a serious competitor launched tomorrow?"},
  {id:"biz-unfair",    cat:"Business", text:"What's TJM's unfair advantage — and am I leaning into it or hiding it?"},
  {id:"biz-stall",     cat:"Business", text:"If growth stalled for six months, what would I discover was the real cause?"},
  {id:"biz-buy",       cat:"Business", text:"If I were buying TJM today, what's the first thing I'd fix?"},
  {id:"biz-remarkable",cat:"Business", text:"What would make a customer tell a friend about TJM without being asked?"},
  {id:"biz-simplify",  cat:"Business", text:"What am I overcomplicating that a simpler business would just do?"},
  {id:"biz-quit",      cat:"Business", text:"If TJM had to be profitable this month or shut, what would I do differently?"},

  // ── Leadership ──
  {id:"lead-hold",     cat:"Leadership", text:"Where am I holding a task someone else should own?"},
  {id:"lead-standard", cat:"Leadership", text:"Who around me needs a clearer standard from me?"},
  {id:"lead-tolerate", cat:"Leadership", text:"What am I tolerating that I shouldn't be?"},
  {id:"lead-example",  cat:"Leadership", text:"What behaviour am I modelling that I'd hate to see copied?"},
  {id:"lead-clarity",  cat:"Leadership", text:"Does everyone I work with know exactly what winning looks like this month?"},
  {id:"lead-hardconv", cat:"Leadership", text:"What hard conversation am I putting off, and what does the delay cost?"},
  {id:"lead-trust",    cat:"Leadership", text:"Where am I withholding trust that's slowing everything down?"},
  {id:"lead-credit",   cat:"Leadership", text:"When did I last give real credit — and who's overdue?"},
  {id:"lead-delegate", cat:"Leadership", text:"What decision am I making that I should be delegating?"},
  {id:"lead-led",      cat:"Leadership", text:"If I led the way I want to be led, what would I do differently today?"},

  // ── Marketing ──
  {id:"mkt-choose",    cat:"Marketing", text:"Why would someone choose TJM over the jeweller they already trust?"},
  {id:"mkt-onlyi",     cat:"Marketing", text:"What's the one piece of content only I could make?"},
  {id:"mkt-mirror",    cat:"Marketing", text:"Where is my marketing describing the product instead of the customer?"},
  {id:"mkt-remember",  cat:"Marketing", text:"What do I want someone to remember ten seconds after seeing TJM?"},
  {id:"mkt-scroll",    cat:"Marketing", text:"What would make someone stop scrolling — and am I doing it in the first three seconds?"},
  {id:"mkt-story",     cat:"Marketing", text:"What's the true story behind TJM that I've been too shy to tell?"},
  {id:"mkt-belief",    cat:"Marketing", text:"What belief do I need to change in a customer's head before they'll buy?"},
  {id:"mkt-channel",   cat:"Marketing", text:"Which channel would I go all-in on if I could only keep one?"},
  {id:"mkt-proof",     cat:"Marketing", text:"What proof do I have that TJM delivers — and am I actually showing it?"},
  {id:"mkt-boring",    cat:"Marketing", text:"What \u201cboring\u201d content actually drives sales that I keep avoiding making?"},

  // ── Sales ──
  {id:"sales-object",  cat:"Sales", text:"What objection kills the most sales — and how do I answer it before it's raised?"},
  {id:"sales-aov",     cat:"Sales", text:"What would raise my average order value without a discount?"},
  {id:"sales-lost",    cat:"Sales", text:"Who bought once and never came back — and why?"},
  {id:"sales-ask",     cat:"Sales", text:"Where in the conversation am I failing to actually ask for the sale?"},
  {id:"sales-dream",   cat:"Sales", text:"What does my customer really want the jewellery to say about them?"},
  {id:"sales-friction",cat:"Sales", text:"What's the most friction-filled step between \u201cinterested\u201d and \u201cpaid\u201d?"},
  {id:"sales-followup",cat:"Sales", text:"Which warm leads have I never followed up — and why not?"},
  {id:"sales-price",   cat:"Sales", text:"Am I underpricing out of fear — and what would happen if I raised it 20%?"},
  {id:"sales-trust",   cat:"Sales", text:"What makes a stranger trust me enough to spend hundreds of pounds?"},
  {id:"sales-no",      cat:"Sales", text:"What am I saying yes to in a sale that I should say no to?"},

  // ── Customers ──
  {id:"cust-wish",     cat:"Customers", text:"What does my best customer wish existed that I don't offer?"},
  {id:"cust-doubt",    cat:"Customers", text:"What moment in the buying experience causes the most doubt?"},
  {id:"cust-call",     cat:"Customers", text:"If I called five recent customers today, what would I ask them?"},
  {id:"cust-ideal",    cat:"Customers", text:"Who exactly is my ideal customer — and am I building for them or for everyone?"},
  {id:"cust-return",   cat:"Customers", text:"What would make a one-time buyer become a repeat customer?"},
  {id:"cust-complaint",cat:"Customers", text:"What's the complaint I hear most — and have I actually fixed it?"},
  {id:"cust-delight",  cat:"Customers", text:"Where could I surprise a customer for almost no cost?"},
  {id:"cust-quiet",    cat:"Customers", text:"At what point do interested customers go quiet, and what happens there?"},
  {id:"cust-words",    cat:"Customers", text:"What words do customers use for what they want — and do I use them back?"},
  {id:"cust-fire",     cat:"Customers", text:"Which type of customer should I stop trying to serve?"},

  // ── Systems ──
  {id:"sys-redo",      cat:"Systems", text:"What do I redo every week that should be done once?"},
  {id:"sys-pileup",    cat:"Systems", text:"Where does work pile up waiting on me specifically?"},
  {id:"sys-gone",      cat:"Systems", text:"What would break if I disappeared for two weeks?"},
  {id:"sys-checklist", cat:"Systems", text:"What task keeps going wrong that a simple checklist would fix?"},
  {id:"sys-memory",    cat:"Systems", text:"What am I holding in my head that should be written down?"},
  {id:"sys-handoff",   cat:"Systems", text:"What could I hand to someone else if it were documented?"},
  {id:"sys-slowest",   cat:"Systems", text:"What's the slowest step in getting a product from idea to sold?"},
  {id:"sys-tools",     cat:"Systems", text:"Which tool or app is creating more work than it saves?"},
  {id:"sys-rule",      cat:"Systems", text:"What decision do I remake daily that I could settle once as a rule?"},
  {id:"sys-measure",   cat:"Systems", text:"What part of the business runs on guesswork that should run on numbers?"},

  // ── Finance ──
  {id:"fin-number",    cat:"Finance", text:"What number, watched daily, would change my decisions the most?"},
  {id:"fin-habit",     cat:"Finance", text:"Where am I spending money out of habit rather than return?"},
  {id:"fin-cut",       cat:"Finance", text:"What would I cut first if revenue halved — and why haven't I already?"},
  {id:"fin-margin",    cat:"Finance", text:"Do I actually know my margin per product — and where is it thinnest?"},
  {id:"fin-runway",    cat:"Finance", text:"How long could TJM survive with no new sales — and does that scare me enough?"},
  {id:"fin-invest",    cat:"Finance", text:"What's the highest-return place I could put £100 right now?"},
  {id:"fin-profit",    cat:"Finance", text:"Am I chasing revenue when I should be chasing profit?"},
  {id:"fin-owed",      cat:"Finance", text:"What money is owed to me that I haven't chased?"},
  {id:"fin-fixed",     cat:"Finance", text:"What's a cost I've accepted as fixed that actually isn't?"},
  {id:"fin-pay",       cat:"Finance", text:"Am I paying myself in a way that's sustainable, or starving the founder?"},

  // ── Vision ──
  {id:"vis-best",      cat:"Vision", text:"What does TJM look like the day it becomes the best in the UK?"},
  {id:"vis-outlive",   cat:"Vision", text:"What am I building that outlives me?"},
  {id:"vis-tenyr",     cat:"Vision", text:"Zooming out ten years — what am I doing today that won't matter?"},
  {id:"vis-famous",    cat:"Vision", text:"What do I want TJM to be famous for?"},
  {id:"vis-legacy",    cat:"Vision", text:"When people describe TJM in 20 years, what one word do I want them to use?"},
  {id:"vis-impossible",cat:"Vision", text:"What would I attempt if I knew it couldn't fail?"},
  {id:"vis-north",     cat:"Vision", text:"What's the one goal that, if hit, makes all the others easier?"},
  {id:"vis-whyme",     cat:"Vision", text:"Why am I the right person to build this — and do I believe it?"},
  {id:"vis-sacrifice", cat:"Vision", text:"What am I willing to sacrifice for this vision, and what am I not?"},
  {id:"vis-win",       cat:"Vision", text:"What does winning look like so clearly I'd know it on sight?"},

  // ── Strategy ──
  {id:"strat-moat",    cat:"Strategy", text:"What advantage do I have that's genuinely hard to copy?"},
  {id:"strat-terms",   cat:"Strategy", text:"Where am I competing on someone else's terms instead of my own?"},
  {id:"strat-bet",     cat:"Strategy", text:"What's the smallest bet with the biggest upside right now?"},
  {id:"strat-stop",    cat:"Strategy", text:"What could I stop doing entirely with no real downside?"},
  {id:"strat-leverage",cat:"Strategy", text:"Where would a little more effort produce a lot more result?"},
  {id:"strat-wrong",   cat:"Strategy", text:"What would have to be true for my current plan to be wrong?"},
  {id:"strat-onemove", cat:"Strategy", text:"If I could only make one move this quarter, what would it be?"},
  {id:"strat-avoid",   cat:"Strategy", text:"What are competitors all doing that I should deliberately not do?"},
  {id:"strat-timing",  cat:"Strategy", text:"Why is now the right time for this — or is it?"},
  {id:"strat-constraint",cat:"Strategy", text:"What single constraint, if removed, unlocks the most growth?"},

  // ── Execution ──
  {id:"exec-next",     cat:"Execution", text:"What's the next physical action on the thing I keep postponing?"},
  {id:"exec-didnt",    cat:"Execution", text:"What did I plan last week that didn't happen — and why?"},
  {id:"exec-done",     cat:"Execution", text:"What would \u201cdone today\u201d actually look like?"},
  {id:"exec-domino",   cat:"Execution", text:"What's the first domino that makes everything else easier?"},
  {id:"exec-ship",     cat:"Execution", text:"What's 80% finished that I should just ship?"},
  {id:"exec-three",    cat:"Execution", text:"What three things, if done today, make it a win?"},
  {id:"exec-distract", cat:"Execution", text:"What's the most legitimate-looking distraction I keep choosing?"},
  {id:"exec-speed",    cat:"Execution", text:"Where am I being slow when fast and imperfect would win?"},
  {id:"exec-block",    cat:"Execution", text:"What's blocking me right now — and is it real or imagined?"},
  {id:"exec-know",     cat:"Execution", text:"How will I know at the end of today whether I actually moved forward?"},

  // ── Habits ──
  {id:"hab-year",      cat:"Habits", text:"What small daily action, repeated for a year, would change everything?"},
  {id:"hab-protect",   cat:"Habits", text:"Which habit am I proud of — and how do I protect it?"},
  {id:"hab-auto",      cat:"Habits", text:"What am I doing on autopilot that deserves a second look?"},
  {id:"hab-keystone",  cat:"Habits", text:"What single habit, if I nailed it, would pull the others up with it?"},
  {id:"hab-trigger",   cat:"Habits", text:"What triggers my worst habit — and can I remove the trigger?"},
  {id:"hab-stack",     cat:"Habits", text:"What new habit could I attach to something I already do daily?"},
  {id:"hab-environment",cat:"Habits", text:"How could I change my environment so the right thing is the easy thing?"},
  {id:"hab-skip",      cat:"Habits", text:"When I skip the important thing, what am I doing instead?"},
  {id:"hab-identity",  cat:"Habits", text:"What does someone who's already succeeded do every morning that I don't?"},
  {id:"hab-tiny",      cat:"Habits", text:"What's the smallest version of a good habit I could never fail to do?"},

  // ── Discipline ──
  {id:"disc-watch",    cat:"Discipline", text:"What am I doing when no one is watching?"},
  {id:"disc-negotiate",cat:"Discipline", text:"Where am I negotiating with myself instead of just acting?"},
  {id:"disc-slip",     cat:"Discipline", text:"What standard have I quietly let slip?"},
  {id:"disc-comfort",  cat:"Discipline", text:"What comfortable choice am I making that my future self will resent?"},
  {id:"disc-hard",     cat:"Discipline", text:"What's the hard thing I know I should do today?"},
  {id:"disc-excuse",   cat:"Discipline", text:"What's my favourite excuse — and is it actually true?"},
  {id:"disc-urge",     cat:"Discipline", text:"What urge do I need to ride out rather than obey right now?"},
  {id:"disc-promise",  cat:"Discipline", text:"What did I promise myself and then break — and why?"},
  {id:"disc-cost",     cat:"Discipline", text:"What does giving in cost me that I keep forgetting in the moment?"},
  {id:"disc-rule",     cat:"Discipline", text:"What personal rule would take today's decision out of willpower entirely?"},
];
const CATS = QUESTIONS.reduce((a,q)=>{ if(a.indexOf(q.cat)<0)a.push(q.cat); return a; }, []);

// ── module-level UI state for inline edit/delete (not persisted) ──
let _editingId = null;
let _deleteId  = null;

// ── helpers ───────────────────────────────────────────────────────
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function qById(id){ for(let i=0;i<QUESTIONS.length;i++) if(QUESTIONS[i].id===id) return QUESTIONS[i]; return null; }
function todaysQuestion(){ const day=Math.floor(Date.now()/864e5); return QUESTIONS[day % QUESTIONS.length]; }
function currentQuestion(state){ return qById(state.clarityQuestionId) || todaysQuestion(); }
function getEntries(state){ return (state.data && state.data.clarity && state.data.clarity.entries) || []; }
function entriesFor(state, qid){ return getEntries(state).filter(function(e){ return e.questionId===qid; }).sort(function(a,b){ return (b.ts||0)-(a.ts||0); }); }
function fmtDate(ts){ return new Date(ts||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }

// ── shared styles (hardcoded navy + gold; identical light/dark) ───
const CLARITY_CSS = `
.clarity-surface{ font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif; }
.clarity-surface *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
.clarity-surface .cl-eyebrow{ font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#C9A84C;font-weight:900; }

/* ── Today card ── */
.clarity-card{
  background:#0A1628;border:1px solid rgba(201,168,76,0.22);border-left:4px solid #C9A84C;
  border-radius:14px;padding:20px 22px;margin-bottom:16px;cursor:pointer;
  transition:transform .12s ease,box-shadow .2s ease;
}
.clarity-card:active{ transform:scale(.99); }
.clarity-card .cl-card-top{ display:flex;align-items:center;justify-content:space-between;margin-bottom:14px; }
.clarity-card .cl-card-cat{ font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,0.7);font-weight:800; }
.clarity-card .cl-card-q{ color:#fff;font-size:19px;font-weight:600;line-height:1.36;letter-spacing:-.01em;margin:0 0 14px; }
.clarity-card .cl-card-edge{ height:1px;width:40px;background:#C9A84C;opacity:.7;margin-bottom:14px; }
.clarity-card .cl-card-cta{ font-size:12.5px;font-weight:800;letter-spacing:.06em;color:#C9A84C; }

/* ── Full page ── */
.clarity-page{
  background:#0A1628;border:1px solid rgba(201,168,76,0.18);border-radius:16px;
  padding:20px 20px 36px;min-height:66vh;color:#fff;
}
.clarity-page .cl-tabs{ display:flex;gap:22px;border-bottom:1px solid rgba(255,255,255,0.09);margin-bottom:8px; }
.clarity-page .cl-tab{ background:none;border:none;font-family:inherit;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.4);font-weight:800;padding:4px 0 12px;cursor:pointer;position:relative; }
.clarity-page .cl-tab.active{ color:#fff; }
.clarity-page .cl-tab.active::after{ content:"";position:absolute;left:0;bottom:-1px;width:16px;height:2px;background:#C9A84C; }

.clarity-page .cl-think{ padding-top:26px; }
.clarity-page .cl-cat{ margin-bottom:18px; }
.clarity-page .cl-q{ color:#fff;font-size:26px;font-weight:600;line-height:1.3;letter-spacing:-.01em;margin:0 0 18px;animation:clSettle .6s cubic-bezier(.22,.61,.36,1); }
.clarity-page .cl-edge{ height:1px;width:44px;background:#C9A84C;opacity:.7;transform-origin:left center;margin-bottom:28px; }
.clarity-page .cl-edge.hone{ animation:clHone 1.1s cubic-bezier(.5,0,.1,1); }
.clarity-page .cl-answer{ width:100%;background:none;border:none;outline:none;color:#fff;font-family:inherit;font-size:18px;line-height:1.72;font-weight:400;resize:none;min-height:150px;margin-bottom:30px; }
.clarity-page .cl-answer::placeholder{ color:rgba(255,255,255,0.34);font-style:italic; }
.clarity-page .cl-decwrap{ margin-bottom:28px; }
.clarity-page .cl-decwrap .cl-eyebrow{ display:block;margin-bottom:12px; }
.clarity-page .cl-decision{ width:100%;background:none;border:none;outline:none;color:#fff;font-family:inherit;font-size:18px;line-height:1.5;font-weight:500;padding-bottom:11px;border-bottom:1px solid rgba(255,255,255,0.16); }
.clarity-page .cl-decision::placeholder{ color:rgba(255,255,255,0.34);font-style:italic; }
.clarity-page .cl-decision:focus{ border-bottom-color:#C9A84C; }
.clarity-page .cl-saverow{ display:flex;align-items:center;gap:16px;min-height:30px;flex-wrap:wrap; }
.clarity-page .cl-save{ background:#C9A84C;color:#0A1628;border:none;font-family:inherit;font-size:12.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;padding:13px 28px;border-radius:8px;cursor:pointer;transition:opacity .3s,transform .1s; }
.clarity-page .cl-save:active{ transform:scale(.97); }
.clarity-page .cl-save:disabled{ background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);cursor:default; }
.clarity-page .cl-hint{ font-size:12.5px;color:rgba(255,255,255,0.45); }
.clarity-page .cl-flash{ font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#C9A84C;font-weight:800;opacity:0;transition:opacity .4s; }
.clarity-page .cl-flash.show{ opacity:1; }

.clarity-page .cl-htoggle{ margin-top:48px;display:flex;align-items:center;gap:10px;background:none;border:none;font-family:inherit;font-size:13px;letter-spacing:.03em;color:rgba(255,255,255,0.45);padding:14px 0;cursor:pointer;user-select:none;width:100%;text-align:left; }
.clarity-page .cl-caret{ display:inline-block;font-size:10px;color:#C9A84C;transition:transform .28s ease; }
.clarity-page .cl-htoggle.open .cl-caret{ transform:rotate(90deg); }
.clarity-page .cl-hlist{ overflow:hidden;max-height:0;transition:max-height .4s ease; }
.clarity-page .cl-hlist.open{ max-height:12000px; }
.clarity-page .cl-entry{ padding:22px 0;border-top:1px solid rgba(255,255,255,0.08); }
.clarity-page .cl-entry:first-child{ border-top:none; }
.clarity-page .cl-edate{ font-size:12px;letter-spacing:.05em;color:rgba(255,255,255,0.4);margin-bottom:12px; }
.clarity-page .cl-eans{ font-size:17px;line-height:1.62;color:rgba(255,255,255,0.9);margin-bottom:14px;white-space:pre-wrap; }
.clarity-page .cl-eans.empty{ color:rgba(255,255,255,0.4);font-style:italic; }
.clarity-page .cl-edec{ display:flex;gap:11px;align-items:baseline;font-size:17px;line-height:1.5;color:#fff; }
.clarity-page .cl-edec .cl-mk{ color:#C9A84C;flex:none; }
.clarity-page .cl-empty{ font-size:13.5px;color:rgba(255,255,255,0.45);padding:14px 0;line-height:1.6; }

/* ── edit / delete controls ── */
.clarity-page .cl-erow{ display:flex;gap:18px;align-items:center;margin-top:14px; }
.clarity-page .cl-elink{ background:none;border:none;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,0.4);cursor:pointer;padding:2px 0; }
.clarity-page .cl-elink:active{ opacity:.55; }
.clarity-page .cl-elink.del{ color:rgba(231,76,60,0.85); }
.clarity-page .cl-eedit-ans{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:inherit;font-size:16px;line-height:1.6;padding:12px;resize:vertical;min-height:90px;margin-bottom:10px;outline:none; }
.clarity-page .cl-eedit-dec{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:inherit;font-size:16px;padding:11px 12px;margin-bottom:12px;outline:none; }
.clarity-page .cl-eedit-ans:focus,.clarity-page .cl-eedit-dec:focus{ border-color:#C9A84C; }
.clarity-page .cl-esave{ background:#C9A84C;color:#0A1628;border:none;font-family:inherit;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:6px;cursor:pointer; }
.clarity-page .cl-esave.del{ background:rgba(231,76,60,0.92);color:#fff; }
.clarity-page .cl-confirm{ display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:14px;color:rgba(255,255,255,0.75); }

.clarity-page .cl-sechead{ padding:26px 0 18px; }
.clarity-page .cl-sechead h2{ font-size:24px;font-weight:600;margin:0;letter-spacing:-.01em;color:#fff; }
.clarity-page .cl-sechead p{ font-size:13px;color:rgba(255,255,255,0.5);margin:8px 0 0;line-height:1.6; }
.clarity-page .cl-catrow,.clarity-page .cl-qrow{ display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0;border-top:1px solid rgba(255,255,255,0.08);cursor:pointer; }
.clarity-page .cl-catrow:active,.clarity-page .cl-qrow:active{ opacity:.6; }
.clarity-page .cl-catname{ font-size:19px;font-weight:500;color:#fff; }
.clarity-page .cl-catcount{ font-size:12px;color:rgba(255,255,255,0.4); }
.clarity-page .cl-qtext{ font-size:17px;line-height:1.45;font-weight:400;color:rgba(255,255,255,0.92);flex:1; }
.clarity-page .cl-qbadge{ font-size:11px;color:#C9A84C;flex:none;font-weight:700; }
.clarity-page .cl-back{ display:inline-flex;align-items:center;gap:9px;background:none;border:none;font-family:inherit;font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:.03em;padding:16px 0 4px;cursor:pointer; }
.clarity-page .cl-back .cl-ar{ color:#C9A84C; }
.clarity-page .cl-fq{ font-size:18px;font-weight:600;line-height:1.35;margin:22px 0 4px;letter-spacing:-.01em;color:#fff;cursor:pointer; }
.clarity-page .cl-fq .cl-eyebrow{ display:block;margin-bottom:9px; }

@keyframes clSettle{ from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }
@keyframes clHone{ 0%{transform:scaleX(1);opacity:.7;} 35%{transform:scaleX(9);opacity:1;} 100%{transform:scaleX(1);opacity:.7;} }
@media (prefers-reduced-motion:reduce){
  .clarity-page .cl-q,.clarity-page .cl-edge{ animation:none!important; }
}
`;

// ── Today card ────────────────────────────────────────────────────
export function renderClarityCard(state){
  const q = todaysQuestion();
  return `
  <div class="clarity-surface">
    <style>${CLARITY_CSS}</style>
    <div class="clarity-card" onclick="setTab('clarity')">
      <div class="cl-card-top">
        <span class="cl-eyebrow">Clarity</span>
        <span class="cl-card-cat">${esc(q.cat)}</span>
      </div>
      <div class="cl-card-q">${esc(q.text)}</div>
      <div class="cl-card-edge"></div>
      <div class="cl-card-cta">Think it through &rarr;</div>
    </div>
  </div>`;
}

// ── One entry: static / editing / delete-confirm ──────────────────
function entryHTML(e){
  const id = e.id;
  if(_deleteId === id){
    return `
    <div class="cl-entry" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <div class="cl-confirm">Delete this entry?
        <button class="cl-esave del" onclick="clarityConfirmDelete('${esc(id)}')">Delete</button>
        <button class="cl-elink" onclick="clarityCancelDelete('${esc(id)}')">Cancel</button>
      </div>
    </div>`;
  }
  if(_editingId === id){
    return `
    <div class="cl-entry editing" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <textarea class="cl-eedit-ans" id="cl-eans-${esc(id)}" placeholder="Your thinking…">${esc(e.answer||'')}</textarea>
      <input class="cl-eedit-dec" id="cl-edec-${esc(id)}" value="${esc(e.decision||'')}" placeholder="I will…" />
      <div class="cl-erow">
        <button class="cl-esave" onclick="claritySaveEdit('${esc(id)}')">Save</button>
        <button class="cl-elink" onclick="clarityCancelEdit('${esc(id)}')">Cancel</button>
      </div>
    </div>`;
  }
  return `
    <div class="cl-entry" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <div class="cl-eans ${e.answer?'':'empty'}">${e.answer?esc(e.answer):'(no notes)'}</div>
      ${e.decision?`<div class="cl-edec"><span class="cl-mk">&rarr;</span><span>${esc(e.decision)}</span></div>`:''}
      <div class="cl-erow">
        <button class="cl-elink" onclick="clarityEditEntry('${esc(id)}')">Edit</button>
        <button class="cl-elink del" onclick="clarityDeleteEntry('${esc(id)}')">Delete</button>
      </div>
    </div>`;
}
function historyListHTML(state, qid){
  const es = entriesFor(state, qid);
  if(!es.length) return `<div class="cl-empty">No entries yet. This is the first time you've thought about this one.</div>`;
  return es.map(entryHTML).join('');
}
function historyFeedInner(state){
  const all = getEntries(state).slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  if(!all.length) return `<div class="cl-empty">Nothing yet. Open today's question and make your first decision.</div>`;
  return all.map(function(e){
    return `<div class="cl-fq" onclick="clarityOpen('${esc(e.questionId)}')"><span class="cl-eyebrow">${esc((e.category||'').toString())}</span>${esc(e.questionText||'')}</div>${entryHTML(e)}`;
  }).join('');
}

// ── Views ─────────────────────────────────────────────────────────
function thinkView(state){
  const q = currentQuestion(state);
  const es = entriesFor(state, q.id);
  const label = es.length ? `Previous entries (${es.length})` : 'Previous entries';
  return `
    <div class="cl-think">
      <div class="cl-cat cl-eyebrow">${esc(q.cat)}</div>
      <h1 class="cl-q">${esc(q.text)}</h1>
      <div class="cl-edge" id="cl-edge"></div>
      <textarea class="cl-answer" id="cl-answer" placeholder="Think it through…"></textarea>
      <div class="cl-decwrap">
        <span class="cl-eyebrow">Decision</span>
        <input class="cl-decision" id="cl-decision" placeholder="I will…" />
      </div>
      <div class="cl-saverow">
        <button class="cl-save" id="cl-save" disabled>Save</button>
        <span class="cl-hint" id="cl-hint">Finish with a decision</span>
        <span class="cl-flash" id="cl-flash">Saved · back to work</span>
      </div>
      <button class="cl-htoggle" id="cl-htoggle"><span class="cl-caret">▸</span><span id="cl-hlabel">${label}</span></button>
      <div class="cl-hlist" id="cl-hlist">${historyListHTML(state, q.id)}</div>
    </div>`;
}
function browseView(state){
  if(!state.clarityBrowseCat){
    const rows = CATS.map(function(cat){
      const n = QUESTIONS.filter(function(q){return q.cat===cat;}).length;
      return `<div class="cl-catrow" onclick="clarityBrowse('${esc(cat)}')"><span class="cl-catname">${esc(cat)}</span><span class="cl-catcount">${n}</span></div>`;
    }).join('');
    return `<div class="cl-sechead"><h2>Browse</h2><p>Pick a category, then a question. Your thinking stays hidden until you ask for it.</p></div>${rows}`;
  }
  const cat = state.clarityBrowseCat;
  const rows = QUESTIONS.filter(function(q){return q.cat===cat;}).map(function(q){
    const n = entriesFor(state, q.id).length;
    return `<div class="cl-qrow" onclick="clarityOpen('${esc(q.id)}')"><span class="cl-qtext">${esc(q.text)}</span>${n?`<span class="cl-qbadge">${n}</span>`:''}</div>`;
  }).join('');
  return `<div class="cl-sechead"><h2>${esc(cat)}</h2></div><button class="cl-back" onclick="clarityBrowseBack()"><span class="cl-ar">←</span> All categories</button>${rows}`;
}
function historyView(state){
  return `<div class="cl-sechead"><h2>History</h2><p>Everything you've decided, newest first. Tap Edit or Delete on any entry.</p></div><div id="cl-histfeed">${historyFeedInner(state)}</div>`;
}

// ── Full page ─────────────────────────────────────────────────────
export function renderClarityTab({ state }){
  _editingId = null; _deleteId = null; // clear stale inline-edit state on full render
  const view = state.clarityView || 'today';
  let body = '';
  if(view==='browse') body = browseView(state);
  else if(view==='history') body = historyView(state);
  else body = thinkView(state);
  return `
  <div class="clarity-surface">
    <style>${CLARITY_CSS}</style>
    <div class="clarity-page">
      <div class="cl-tabs">
        <button class="cl-tab ${view==='today'?'active':''}" onclick="clarityNav('today')">Today</button>
        <button class="cl-tab ${view==='browse'?'active':''}" onclick="clarityNav('browse')">Browse</button>
        <button class="cl-tab" onclick="clarityRandom()">Random</button>
        <button class="cl-tab ${view==='history'?'active':''}" onclick="clarityNav('history')">History</button>
      </div>
      ${body}
    </div>
  </div>`;
}

// ── Init / events (re-run after every render) ─────────────────────
export function initClarityTab(deps){
  const { state, saveDataQuiet, render } = deps;

  function resetDraft(){ state.clarityDraft = { answer:'', decision:'' }; }

  // rebuild whichever entry lists are on screen, in place (no full render)
  function clarityRefresh(){
    const list = document.getElementById('cl-hlist');
    if(list){
      const wasOpen = list.classList.contains('open');
      const q = currentQuestion(state);
      list.innerHTML = historyListHTML(state, q.id);
      if(wasOpen) list.classList.add('open');
      const lbl = document.getElementById('cl-hlabel');
      if(lbl){ const n = entriesFor(state, q.id).length; lbl.textContent = n ? 'Previous entries ('+n+')' : 'Previous entries'; }
      const tog = document.getElementById('cl-htoggle');
      if(tog) tog.classList.toggle('open', wasOpen);
    }
    const feed = document.getElementById('cl-histfeed');
    if(feed) feed.innerHTML = historyFeedInner(state);
  }

  // ── navigation ──
  window.clarityNav = function(v){
    if(v==='today'){ state.clarityQuestionId=null; resetDraft(); }
    if(v!=='browse'){ state.clarityBrowseCat=null; }
    state.clarityView=v; render();
  };
  window.clarityRandom = function(){
    const cur = currentQuestion(state).id;
    let q; do{ q=QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)]; }while(q.id===cur && QUESTIONS.length>1);
    state.clarityQuestionId=q.id; state.clarityView='today'; resetDraft(); render();
  };
  window.clarityBrowse = function(cat){ state.clarityBrowseCat=cat; render(); };
  window.clarityBrowseBack = function(){ state.clarityBrowseCat=null; render(); };
  window.clarityOpen = function(qid){ state.clarityQuestionId=qid; state.clarityView='today'; resetDraft(); render(); };
  window.clarityToggleHistory = function(){
    const list=document.getElementById('cl-hlist'), tog=document.getElementById('cl-htoggle');
    if(!list||!tog) return;
    const open=list.classList.toggle('open'); tog.classList.toggle('open', open);
  };

  // ── edit / delete (in-place, preserves writing draft + open state) ──
  window.clarityEditEntry = function(id){ _editingId=id; _deleteId=null; clarityRefresh();
    const t=document.getElementById('cl-eans-'+id); if(t){ t.focus(); }
  };
  window.clarityCancelEdit = function(id){ _editingId=null; clarityRefresh(); };
  window.claritySaveEdit = function(id){
    const ansEl=document.getElementById('cl-eans-'+id);
    const decEl=document.getElementById('cl-edec-'+id);
    const decision=(decEl&&decEl.value.trim())||'';
    if(!decision){ if(decEl){ decEl.style.borderColor='rgba(231,76,60,0.9)'; decEl.focus(); } return; }
    const entries=(state.data&&state.data.clarity&&state.data.clarity.entries)||[];
    const e=entries.find(function(x){return x.id===id;});
    if(e){ e.answer=(ansEl&&ansEl.value.trim())||''; e.decision=decision; e.editedAt=Date.now(); }
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    _editingId=null; clarityRefresh();
  };
  window.clarityDeleteEntry = function(id){ _deleteId=id; _editingId=null; clarityRefresh(); };
  window.clarityCancelDelete = function(id){ _deleteId=null; clarityRefresh(); };
  window.clarityConfirmDelete = function(id){
    if(state.data&&state.data.clarity&&Array.isArray(state.data.clarity.entries)){
      state.data.clarity.entries = state.data.clarity.entries.filter(function(x){return x.id!==id;});
    }
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    _deleteId=null; clarityRefresh();
  };

  // ── think-view wiring only ──
  if((state.clarityView||'today')!=='today') return;
  const ans=document.getElementById('cl-answer');
  const dec=document.getElementById('cl-decision');
  const save=document.getElementById('cl-save');
  const hint=document.getElementById('cl-hint');
  const tog=document.getElementById('cl-htoggle');
  if(!ans||!dec||!save) return;

  function autogrow(t){ if(!t)return; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
  function updateSave(){
    const has = dec.value.trim().length>0;
    save.disabled = !has;
    if(hint) hint.style.display = has ? 'none' : 'inline';
  }

  const draft = state.clarityDraft || (state.clarityDraft={answer:'',decision:''});
  ans.value = draft.answer || '';
  dec.value = draft.decision || '';
  autogrow(ans);
  updateSave();

  ans.oninput = function(){ draft.answer = ans.value; autogrow(ans); };
  dec.oninput = function(){ draft.decision = dec.value; updateSave(); };
  dec.onkeydown = function(e){ if(e.key==='Enter'){ e.preventDefault(); if(!save.disabled) doSave(); } };
  if(tog) tog.onclick = window.clarityToggleHistory;

  function doSave(){
    const decision = dec.value.trim(); if(!decision) return;
    const q = currentQuestion(state);
    state.data.clarity = state.data.clarity || { entries: [] };
    state.data.clarity.entries = state.data.clarity.entries || [];
    state.data.clarity.entries.push({
      id: 'cl'+Date.now().toString(36),
      questionId: q.id, questionText: q.text, category: q.cat,
      answer: ans.value.trim(), decision: decision, ts: Date.now()
    });
    if(typeof saveDataQuiet==='function') saveDataQuiet();

    const edge=document.getElementById('cl-edge');
    if(edge){ edge.classList.remove('hone'); void edge.offsetWidth; edge.classList.add('hone'); }
    const flash=document.getElementById('cl-flash');
    if(flash){ flash.classList.add('show'); setTimeout(function(){ if(flash) flash.classList.remove('show'); }, 2600); }

    ans.value=''; dec.value=''; draft.answer=''; draft.decision=''; autogrow(ans); updateSave();

    // refresh the (collapsed) history list + count
    const list=document.getElementById('cl-hlist'), lbl=document.getElementById('cl-hlabel');
    if(list){ list.classList.remove('open'); list.innerHTML = historyListHTML(state, q.id); }
    if(tog) tog.classList.remove('open');
    if(lbl){ const n=entriesFor(state, q.id).length; lbl.textContent = n ? 'Previous entries ('+n+')' : 'Previous entries'; }
  }

  save.onclick = doSave;
}

// ── AI hooks for a later version (intentionally not implemented) ──
// state.data.clarity.entries is enough to add, with no migration:
//   • follow-up questions   → send current answer to your Anthropic proxy
//   • recurring patterns    → group entries by questionId over time
//   • summarise thinking    → feed entriesFor(state, qid) to the model
//   • compare answers       → diff latest vs earlier entries for a question
//   • remind of decisions   → surface the last decision when a question reopens
