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

// ═══════════════════════════════════════════════════════════════
// AI COACH — client half. Chooses which past entries are relevant,
// trims the transcript, calls the Netlify function. Nothing secret
// lives here; the API key is only ever read server-side.
// ═══════════════════════════════════════════════════════════════

const STOP = new Set(('the a an and or but if then than that this these those of to in on for with without at by from as is are was were be been being it its i me my mine you your we our they them he she his her not no do does did doing done have has had having will would should could can cam about into over under again more most some such only own same so too very just now what when where which who whom why how all any both each few other own out up down off very s t don should now').split(' '));

function tokenise(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
    .filter(function(w){ return w.length>3 && !STOP.has(w); });
}

// ── Which previous entries are worth showing the coach? ───────────
// Same question first, then same category, ranked by word overlap with
// what the user has written this session. Small and relevant, never the
// whole journal.
function pickRelevantEntries(entries, questionId, category, currentText, max){
  const cap = max || 4;
  const all = (entries||[]).filter(function(e){ return e && (e.answer || e.decision); });
  if(!all.length) return [];

  const words = new Set(tokenise(currentText));
  function score(e){
    let s = 0;
    if(e.questionId === questionId) s += 100;
    if(e.category === category)     s += 25;
    const ew = tokenise((e.answer||'') + ' ' + (e.decision||''));
    let overlap = 0;
    for(let i=0;i<ew.length;i++){ if(words.has(ew[i])) overlap++; }
    s += Math.min(overlap, 20) * 2;
    const ageDays = (Date.now() - (e.ts||0)) / 864e5;
    s -= Math.min(ageDays / 30, 12);           // gently prefer recent
    return s;
  }

  return all.slice()
    .map(function(e){ return { e:e, s:score(e) }; })
    .filter(function(x){ return x.s > 0; })
    .sort(function(a,b){ return b.s - a.s; })
    .slice(0, cap)
    .map(function(x){
      const d = new Date(x.e.ts||Date.now());
      return {
        date: d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
        answer: String(x.e.answer||'').slice(0,400),
        decision: String(x.e.decision||'').slice(0,300)
      };
    });
}

// ── Keep the transcript short: opening answer + the recent exchange ──
function trimTranscript(messages, keep){
  const k = keep || 10;
  const msgs = (messages||[]).filter(function(m){ return m && m.content && String(m.content).trim(); })
                             .map(function(m){ return { role: m.role==='assistant'?'assistant':'user', content: String(m.content) }; });
  if(msgs.length <= k+1) return msgs;
  return [msgs[0]].concat(msgs.slice(-k));
}

// ── Call the Netlify function (the API key lives only there) ─────
const COACH_ENDPOINT = '/.netlify/functions/clarity-coach';

async function post(payload){
  const url = (typeof window!=='undefined' && window.CLARITY_ENDPOINT) || COACH_ENDPOINT;
  let res;
  try {
    res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  } catch(e){
    throw new Error('Could not reach the coach. Check your connection.');
  }

  let data = null;
  try { data = await res.json(); } catch(e){ data = null; }

  if(!res.ok){
    if(res.status === 404) throw new Error('Coach endpoint not found — is the Netlify function deployed?');
    throw new Error((data && data.error) ? data.error : ('Request failed ('+res.status+')'));
  }
  return data;
}

// ── Public: one coaching turn ─────────────────────────────────────
async function askCoach({ category, question, messages, control, excerpts, model }){
  const data = await post({
    mode: 'coach',
    category: category,
    question: question,
    control: control || null,
    transcript: trimTranscript(messages),
    excerpts: excerpts || [],
    model: model || undefined
  });
  if(!data || !data.question) throw new Error('The coach returned nothing usable. Try again.');
  return {
    observation: data.observation || null,
    question: data.question,
    readyToWrap: data.readyToWrap === true,
    reasonForWrap: data.reasonForWrap || null,
    usage: data.usage || null
  };
}

// ── Public: final summary ─────────────────────────────────────────
async function askSummary({ category, question, messages, excerpts, model }){
  const data = await post({
    mode: 'summary',
    category: category,
    question: question,
    transcript: trimTranscript(messages, 14),
    excerpts: excerpts || [],
    model: model || undefined
  });
  const s = data && data.summary;
  if(!s || (!s.whatIRealised && !s.decision)) throw new Error('The summary came back incomplete. Try again.');
  return {
    whatISaid:     s.whatISaid || '',
    whatIRealised: s.whatIRealised || '',
    pattern:       s.pattern || null,
    decision:      s.decision || '',
    remember:      s.remember || '',
    usage: data.usage || null
  };
}

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

// ── module-level UI state (transient, not persisted) ──────────────
let _editingId = null;      // entry being inline-edited
let _deleteId  = null;      // entry awaiting delete confirmation
let _openSession = null;    // entry id whose saved session is expanded

// ── helpers ───────────────────────────────────────────────────────
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function qById(id){ for(let i=0;i<QUESTIONS.length;i++) if(QUESTIONS[i].id===id) return QUESTIONS[i]; return null; }
function todaysQuestion(){ const day=Math.floor(Date.now()/864e5); return QUESTIONS[day % QUESTIONS.length]; }
function currentQuestion(state){ return qById(state.clarityQuestionId) || todaysQuestion(); }
function getEntries(state){ return (state.data && state.data.clarity && state.data.clarity.entries) || []; }
function entriesFor(state, qid){ return getEntries(state).filter(function(e){ return e.questionId===qid; }).sort(function(a,b){ return (b.ts||0)-(a.ts||0); }); }
function fmtDate(ts){ return new Date(ts||Date.now()).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}); }
function coach(state){
  if(!state.clarityCoach) state.clarityCoach = { active:false, messages:[], loading:false, error:null, draft:'', summary:null, readyToWrap:false, usedPrevious:false };
  return state.clarityCoach;
}
function usePrevious(state){
  const s = state.data && state.data.clarity && state.data.clarity.settings;
  return s ? s.usePrevious !== false : true;   // default on
}

// ── styles (hardcoded navy + gold; identical light/dark) ──────────
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
  padding:20px 20px calc(40px + env(safe-area-inset-bottom, 0px));
  min-height:66vh;color:#fff;
}
.clarity-page .cl-tabs{ display:flex;gap:22px;border-bottom:1px solid rgba(255,255,255,0.09);margin-bottom:8px;overflow-x:auto; }
.clarity-page .cl-tab{ background:none;border:none;font-family:inherit;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.4);font-weight:800;padding:4px 0 12px;cursor:pointer;position:relative;white-space:nowrap; }
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
.clarity-page .cl-saverow{ display:flex;align-items:center;gap:14px;min-height:30px;flex-wrap:wrap; }
.clarity-page .cl-save{ background:#C9A84C;color:#0A1628;border:none;font-family:inherit;font-size:12.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;padding:13px 28px;border-radius:8px;cursor:pointer;transition:opacity .3s,transform .1s; }
.clarity-page .cl-save:active{ transform:scale(.97); }
.clarity-page .cl-save:disabled{ background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);cursor:default; }
.clarity-page .cl-dig{ background:none;border:1px solid rgba(201,168,76,0.55);color:#C9A84C;font-family:inherit;font-size:12.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;padding:12px 22px;border-radius:8px;cursor:pointer; }
.clarity-page .cl-dig:disabled{ border-color:rgba(255,255,255,0.12);color:rgba(255,255,255,0.3);cursor:default; }
.clarity-page .cl-dig:active:not(:disabled){ transform:scale(.97); }
.clarity-page .cl-hint{ font-size:12.5px;color:rgba(255,255,255,0.45); }
.clarity-page .cl-flash{ font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#C9A84C;font-weight:800;opacity:0;transition:opacity .4s; }
.clarity-page .cl-flash.show{ opacity:1; }

/* ── Coach ── */
.clarity-page .cl-coach{ margin-top:34px;padding-top:26px;border-top:1px solid rgba(201,168,76,0.25); }
.clarity-page .cl-coach-head{ display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;flex-wrap:wrap; }
.clarity-page .cl-mem{ font-size:11.5px;color:rgba(255,255,255,0.45);display:flex;align-items:center;gap:7px; }
.clarity-page .cl-mem b{ color:#C9A84C;font-weight:700; }
.clarity-page .cl-msg{ margin:22px 0; }
.clarity-page .cl-msg.coach .cl-obs{ font-size:15px;line-height:1.6;color:rgba(255,255,255,0.6);margin-bottom:10px;font-style:italic; }
.clarity-page .cl-msg.coach .cl-cq{ font-size:19px;line-height:1.45;color:#fff;font-weight:500;padding-left:14px;border-left:2px solid #C9A84C; }
.clarity-page .cl-msg.me{ padding-left:14px;border-left:2px solid rgba(255,255,255,0.14); }
.clarity-page .cl-msg.me .cl-mytext{ font-size:16.5px;line-height:1.6;color:rgba(255,255,255,0.82);white-space:pre-wrap; }
.clarity-page .cl-reply{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;font-family:inherit;font-size:16.5px;line-height:1.6;padding:13px;resize:none;min-height:74px;outline:none;margin-top:18px; }
.clarity-page .cl-reply:focus{ border-color:#C9A84C; }
.clarity-page .cl-reply::placeholder{ color:rgba(255,255,255,0.32); }
.clarity-page .cl-ctrls{ display:flex;flex-wrap:wrap;gap:8px;margin-top:14px; }
.clarity-page .cl-ctrl{ background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.8);font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.03em;padding:11px 15px;border-radius:20px;cursor:pointer;min-height:42px; }
.clarity-page .cl-ctrl:active{ opacity:.6; }
.clarity-page .cl-ctrl.send{ background:#C9A84C;border-color:#C9A84C;color:#0A1628;font-weight:800; }
.clarity-page .cl-ctrl.wrap{ border-color:rgba(201,168,76,0.5);color:#C9A84C; }
.clarity-page .cl-ctrl:disabled{ opacity:.4;cursor:default; }
.clarity-page .cl-thinking{ display:flex;align-items:center;gap:9px;font-size:13px;color:rgba(255,255,255,0.5);margin:20px 0; }
.clarity-page .cl-dot{ width:5px;height:5px;border-radius:50%;background:#C9A84C;animation:clPulse 1.2s infinite; }
.clarity-page .cl-dot:nth-child(2){ animation-delay:.2s; } .clarity-page .cl-dot:nth-child(3){ animation-delay:.4s; }
.clarity-page .cl-err{ background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.4);border-radius:10px;padding:14px;margin:18px 0;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.85); }
.clarity-page .cl-err b{ color:#e74c3c;display:block;margin-bottom:6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase; }
.clarity-page .cl-err .cl-safe{ font-size:12.5px;color:rgba(255,255,255,0.55);margin-top:8px; }

/* ── Summary ── */
.clarity-page .cl-sum{ margin-top:30px;background:rgba(201,168,76,0.07);border:1px solid rgba(201,168,76,0.3);border-radius:14px;padding:22px 20px; }
.clarity-page .cl-sum h3{ font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#C9A84C;font-weight:900;margin:0 0 18px; }
.clarity-page .cl-field{ margin-bottom:20px; }
.clarity-page .cl-field label{ display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-weight:800;margin-bottom:8px; }
.clarity-page .cl-field textarea,.clarity-page .cl-field input{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:9px;color:#fff;font-family:inherit;font-size:16px;line-height:1.6;padding:12px;resize:vertical;outline:none; }
.clarity-page .cl-field textarea:focus,.clarity-page .cl-field input:focus{ border-color:#C9A84C; }
.clarity-page .cl-field.decision input{ font-weight:600;border-color:rgba(201,168,76,0.45); }

/* ── History / entries ── */
.clarity-page .cl-htoggle{ margin-top:48px;display:flex;align-items:center;gap:10px;background:none;border:none;font-family:inherit;font-size:13px;letter-spacing:.03em;color:rgba(255,255,255,0.45);padding:14px 0;cursor:pointer;user-select:none;width:100%;text-align:left; }
.clarity-page .cl-caret{ display:inline-block;font-size:10px;color:#C9A84C;transition:transform .28s ease; }
.clarity-page .cl-htoggle.open .cl-caret{ transform:rotate(90deg); }
.clarity-page .cl-hlist{ overflow:hidden;max-height:0;transition:max-height .4s ease; }
.clarity-page .cl-hlist.open{ max-height:20000px; }
.clarity-page .cl-entry{ padding:22px 0;border-top:1px solid rgba(255,255,255,0.08); }
.clarity-page .cl-entry:first-child{ border-top:none; }
.clarity-page .cl-edate{ font-size:12px;letter-spacing:.05em;color:rgba(255,255,255,0.4);margin-bottom:12px;display:flex;align-items:center;gap:10px; }
.clarity-page .cl-tagai{ font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;border:1px solid rgba(201,168,76,0.45);border-radius:4px;padding:2px 6px;font-weight:800; }
.clarity-page .cl-eans{ font-size:17px;line-height:1.62;color:rgba(255,255,255,0.9);margin-bottom:14px;white-space:pre-wrap; }
.clarity-page .cl-eans.empty{ color:rgba(255,255,255,0.4);font-style:italic; }
.clarity-page .cl-edec{ display:flex;gap:11px;align-items:baseline;font-size:17px;line-height:1.5;color:#fff; }
.clarity-page .cl-edec .cl-mk{ color:#C9A84C;flex:none; }
.clarity-page .cl-empty{ font-size:13.5px;color:rgba(255,255,255,0.45);padding:14px 0;line-height:1.6; }
.clarity-page .cl-erow{ display:flex;gap:18px;align-items:center;margin-top:14px;flex-wrap:wrap; }
.clarity-page .cl-elink{ background:none;border:none;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,0.4);cursor:pointer;padding:4px 0;min-height:32px; }
.clarity-page .cl-elink:active{ opacity:.55; }
.clarity-page .cl-elink.del{ color:rgba(231,76,60,0.85); }
.clarity-page .cl-elink.ses{ color:#C9A84C; }
.clarity-page .cl-eedit-ans{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:inherit;font-size:16px;line-height:1.6;padding:12px;resize:vertical;min-height:90px;margin-bottom:10px;outline:none; }
.clarity-page .cl-eedit-dec{ width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-family:inherit;font-size:16px;padding:11px 12px;margin-bottom:12px;outline:none; }
.clarity-page .cl-eedit-ans:focus,.clarity-page .cl-eedit-dec:focus{ border-color:#C9A84C; }
.clarity-page .cl-esave{ background:#C9A84C;color:#0A1628;border:none;font-family:inherit;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:10px 18px;border-radius:6px;cursor:pointer;min-height:40px; }
.clarity-page .cl-esave.del{ background:rgba(231,76,60,0.92);color:#fff; }
.clarity-page .cl-confirm{ display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:14px;color:rgba(255,255,255,0.75); }
.clarity-page .cl-ses{ margin-top:16px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:10px; }
.clarity-page .cl-ses .cl-sesq{ font-size:15px;line-height:1.5;color:#fff;font-weight:500;padding-left:12px;border-left:2px solid #C9A84C;margin:14px 0 8px; }
.clarity-page .cl-ses .cl-sesa{ font-size:15px;line-height:1.6;color:rgba(255,255,255,0.72);padding-left:12px;border-left:2px solid rgba(255,255,255,0.12);white-space:pre-wrap; }
.clarity-page .cl-ses .cl-sumline{ margin-top:14px; }
.clarity-page .cl-ses .cl-sumline b{ display:block;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:5px;font-weight:800; }
.clarity-page .cl-ses .cl-sumline span{ font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88); }

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
.clarity-page .cl-toggle{ display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 0;border-top:1px solid rgba(255,255,255,0.08);margin-top:8px; }
.clarity-page .cl-toggle .cl-tlabel{ font-size:15px;color:#fff; }
.clarity-page .cl-toggle .cl-tsub{ font-size:12.5px;color:rgba(255,255,255,0.45);margin-top:4px;line-height:1.5; }
.clarity-page .cl-switch{ flex:none;width:50px;height:29px;border-radius:15px;border:none;cursor:pointer;position:relative;background:rgba(255,255,255,0.14);transition:background .2s; }
.clarity-page .cl-switch.on{ background:#C9A84C; }
.clarity-page .cl-switch::after{ content:"";position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;background:#fff;transition:transform .2s; }
.clarity-page .cl-switch.on::after{ transform:translateX(21px); }

@keyframes clSettle{ from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }
@keyframes clHone{ 0%{transform:scaleX(1);opacity:.7;} 35%{transform:scaleX(9);opacity:1;} 100%{transform:scaleX(1);opacity:.7;} }
@keyframes clPulse{ 0%,100%{opacity:.25;} 50%{opacity:1;} }
@media (prefers-reduced-motion:reduce){
  .clarity-page .cl-q,.clarity-page .cl-edge,.clarity-page .cl-dot{ animation:none!important; }
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

// ── Saved session viewer ──────────────────────────────────────────
function sessionHTML(e){
  const s = e.session; if(!s) return '';
  const msgs = (s.messages||[]).map(function(m){
    if(m.role==='assistant'){
      return (m.observation?`<div class="cl-sesa" style="font-style:italic;margin-bottom:6px;">${esc(m.observation)}</div>`:'')
           + `<div class="cl-sesq">${esc(m.content)}</div>`;
    }
    return `<div class="cl-sesa">${esc(m.content)}</div>`;
  }).join('');
  const sum = s.summary || {};
  const line = function(lbl,val){ return val ? `<div class="cl-sumline"><b>${esc(lbl)}</b><span>${esc(val)}</span></div>` : ''; };
  return `<div class="cl-ses">
    ${msgs}
    ${line('What I said', sum.whatISaid)}
    ${line('What I realised', sum.whatIRealised)}
    ${line('The pattern', sum.pattern)}
    ${line('Remember', sum.remember)}
    ${s.usedPrevious?`<div class="cl-sumline"><span style="font-size:12px;color:rgba(255,255,255,0.4);">Previous entries were used in this session.</span></div>`:''}
  </div>`;
}

// ── One entry ─────────────────────────────────────────────────────
function entryHTML(e){
  const id = e.id;
  if(_deleteId === id){
    return `<div class="cl-entry" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <div class="cl-confirm">Delete this entry?
        <button class="cl-esave del" onclick="clarityConfirmDelete('${esc(id)}')">Delete</button>
        <button class="cl-elink" onclick="clarityCancelDelete('${esc(id)}')">Cancel</button>
      </div></div>`;
  }
  if(_editingId === id){
    return `<div class="cl-entry editing" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <textarea class="cl-eedit-ans" id="cl-eans-${esc(id)}" placeholder="Your thinking…">${esc(e.answer||'')}</textarea>
      <input class="cl-eedit-dec" id="cl-edec-${esc(id)}" value="${esc(e.decision||'')}" placeholder="I will…" />
      <div class="cl-erow">
        <button class="cl-esave" onclick="claritySaveEdit('${esc(id)}')">Save</button>
        <button class="cl-elink" onclick="clarityCancelEdit('${esc(id)}')">Cancel</button>
      </div></div>`;
  }
  const hasSession = !!(e.session && (e.session.messages||[]).length);
  return `<div class="cl-entry" data-entry="${esc(id)}">
      <div class="cl-edate">${esc(fmtDate(e.ts))}${hasSession?'<span class="cl-tagai">Deep dive</span>':''}</div>
      <div class="cl-eans ${e.answer?'':'empty'}">${e.answer?esc(e.answer):'(no notes)'}</div>
      ${e.decision?`<div class="cl-edec"><span class="cl-mk">&rarr;</span><span>${esc(e.decision)}</span></div>`:''}
      <div class="cl-erow">
        <button class="cl-elink" onclick="clarityEditEntry('${esc(id)}')">Edit</button>
        <button class="cl-elink del" onclick="clarityDeleteEntry('${esc(id)}')">Delete</button>
        ${hasSession?`<button class="cl-elink ses" onclick="clarityToggleSession('${esc(id)}')">${_openSession===id?'Hide session':'View session'}</button>`:''}
      </div>
      ${hasSession && _openSession===id ? sessionHTML(e) : ''}
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

// ── Coach panel ───────────────────────────────────────────────────
function coachHTML(state){
  const c = coach(state);
  if(!c.active) return '';
  const msgs = c.messages.map(function(m){
    if(m.role==='assistant'){
      return `<div class="cl-msg coach">${m.observation?`<div class="cl-obs">${esc(m.observation)}</div>`:''}<div class="cl-cq">${esc(m.content)}</div></div>`;
    }
    return `<div class="cl-msg me"><div class="cl-mytext">${esc(m.content)}</div></div>`;
  }).join('');

  const loading = c.loading ? `<div class="cl-thinking"><span class="cl-dot"></span><span class="cl-dot"></span><span class="cl-dot"></span> Thinking…</div>` : '';
  const err = c.error ? `<div class="cl-err"><b>Couldn't reach the coach</b>${esc(c.error)}
      <div class="cl-safe">Nothing you've written has been lost. Retry, or carry on and save without AI.</div>
      <div class="cl-erow"><button class="cl-esave" onclick="clarityRetry()">Retry</button>
      <button class="cl-elink" onclick="clarityDismissError()">Dismiss</button></div></div>` : '';

  // once a summary exists, the conversation is finished
  if(c.summary){
    const s = c.summary;
    return `<div class="cl-coach">
      ${msgs}
      <div class="cl-sum">
        <h3>Your reflection</h3>
        <div class="cl-field"><label>What I said</label><textarea id="cl-s-said" rows="3">${esc(s.whatISaid||'')}</textarea></div>
        <div class="cl-field"><label>What I realised</label><textarea id="cl-s-real" rows="3">${esc(s.whatIRealised||'')}</textarea></div>
        <div class="cl-field"><label>The pattern</label><textarea id="cl-s-pat" rows="2" placeholder="${s.pattern?'':'No pattern claimed — not enough history yet.'}">${esc(s.pattern||'')}</textarea></div>
        <div class="cl-field decision"><label>My decision</label><input id="cl-s-dec" value="${esc(s.decision||'')}" placeholder="I will…" /></div>
        <div class="cl-field"><label>Remember</label><input id="cl-s-rem" value="${esc(s.remember||'')}" /></div>
        <div class="cl-erow">
          <button class="cl-esave" onclick="claritySaveReflection()">Save reflection</button>
          <button class="cl-elink" onclick="clarityDiscardCoach()">Discard session</button>
        </div>
      </div></div>`;
  }

  const busy = c.loading ? 'disabled' : '';
  return `<div class="cl-coach">
    <div class="cl-coach-head">
      <span class="cl-eyebrow">Deep dive</span>
      ${c.usedPrevious?`<span class="cl-mem"><b>◆</b> Using your previous entries</span>`:''}
    </div>
    ${msgs}
    ${loading}
    ${err}
    ${c.messages.length && !c.loading ? `<textarea class="cl-reply" id="cl-reply" placeholder="Answer honestly…">${esc(c.draft||'')}</textarea>` : ''}
    <div class="cl-ctrls">
      ${c.messages.length && !c.loading ? `<button class="cl-ctrl send" onclick="clarityReply()">Send</button>` : ''}
      <button class="cl-ctrl" ${busy} onclick="clarityControl('deeper')">Go Deeper</button>
      <button class="cl-ctrl" ${busy} onclick="clarityControl('challenge')">Challenge Me</button>
      <button class="cl-ctrl" ${busy} onclick="clarityControl('pattern')">Find the Pattern</button>
      <button class="cl-ctrl wrap" ${busy} onclick="clarityControl('wrap')">Wrap Up</button>
    </div>
    <div class="cl-erow"><button class="cl-elink" onclick="clarityDiscardCoach()">End session</button></div>
  </div>`;
}

// ── Views ─────────────────────────────────────────────────────────
function thinkView(state){
  const q = currentQuestion(state);
  const c = coach(state);
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
        ${!c.active?`<button class="cl-dig" id="cl-dig" disabled>Dig deeper</button>`:''}
        <span class="cl-hint" id="cl-hint">Finish with a decision</span>
        <span class="cl-flash" id="cl-flash">Saved · back to work</span>
      </div>
      ${coachHTML(state)}
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
    const on = usePrevious(state);
    return `<div class="cl-sechead"><h2>Browse</h2><p>Pick a category, then a question. Your thinking stays hidden until you ask for it.</p></div>${rows}
      <div class="cl-toggle">
        <div><div class="cl-tlabel">Use previous entries to improve coaching</div>
        <div class="cl-tsub">When on, a few relevant past entries are shared with the coach so it can spot genuine patterns. When off, each session starts fresh.</div></div>
        <button class="cl-switch ${on?'on':''}" onclick="clarityTogglePrevious()" aria-label="Use previous entries"></button>
      </div>`;
  }
  const cat = state.clarityBrowseCat;
  const rows = QUESTIONS.filter(function(q){return q.cat===cat;}).map(function(q){
    const n = entriesFor(state, q.id).length;
    return `<div class="cl-qrow" onclick="clarityOpen('${esc(q.id)}')"><span class="cl-qtext">${esc(q.text)}</span>${n?`<span class="cl-qbadge">${n}</span>`:''}</div>`;
  }).join('');
  return `<div class="cl-sechead"><h2>${esc(cat)}</h2></div><button class="cl-back" onclick="clarityBrowseBack()"><span class="cl-ar">←</span> All categories</button>${rows}`;
}
function historyView(state){
  return `<div class="cl-sechead"><h2>History</h2><p>Everything you've decided, newest first. Tap Edit, Delete, or View session.</p></div><div id="cl-histfeed">${historyFeedInner(state)}</div>`;
}

// ── Full page ─────────────────────────────────────────────────────
export function renderClarityTab({ state }){
  _editingId = null; _deleteId = null;
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
  const c = coach(state);

  function resetDraft(){ state.clarityDraft = { answer:'', decision:'' }; }
  function resetCoach(){
    state.clarityCoach = { active:false, messages:[], loading:false, error:null, draft:'', summary:null, readyToWrap:false, usedPrevious:false, lastOp:null };
  }
  // capture anything typed before a re-render wipes the DOM
  function capture(){
    const r = document.getElementById('cl-reply'); if(r) c.draft = r.value;
    const a = document.getElementById('cl-answer'); const d = document.getElementById('cl-decision');
    const dr = state.clarityDraft || (state.clarityDraft={answer:'',decision:''});
    if(a) dr.answer = a.value; if(d) dr.decision = d.value;
  }
  function excerptsFor(q){
    if(!usePrevious(state)) return [];
    const dr = state.clarityDraft || {};
    const text = [dr.answer||''].concat(c.messages.map(function(m){return m.content;})).join(' ');
    return pickRelevantEntries(getEntries(state), q.id, q.cat, text, 4);
  }

  // rebuild entry lists in place (keeps writing + scroll)
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
    capture();
    if(v==='today'){ state.clarityQuestionId=null; resetDraft(); resetCoach(); }
    if(v!=='browse'){ state.clarityBrowseCat=null; }
    state.clarityView=v; render();
  };
  window.clarityRandom = function(){
    const cur = currentQuestion(state).id;
    let q; do{ q=QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)]; }while(q.id===cur && QUESTIONS.length>1);
    state.clarityQuestionId=q.id; state.clarityView='today'; resetDraft(); resetCoach(); render();
  };
  window.clarityBrowse = function(cat){ state.clarityBrowseCat=cat; render(); };
  window.clarityBrowseBack = function(){ state.clarityBrowseCat=null; render(); };
  window.clarityOpen = function(qid){ state.clarityQuestionId=qid; state.clarityView='today'; resetDraft(); resetCoach(); render(); };
  window.clarityToggleHistory = function(){
    const list=document.getElementById('cl-hlist'), tog=document.getElementById('cl-htoggle');
    if(!list||!tog) return;
    const open=list.classList.toggle('open'); tog.classList.toggle('open', open);
  };
  window.clarityTogglePrevious = function(){
    state.data.clarity = state.data.clarity || { entries: [] };
    state.data.clarity.settings = state.data.clarity.settings || {};
    state.data.clarity.settings.usePrevious = !usePrevious(state);
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    render();
  };

  // ── entry edit / delete / session ──
  window.clarityEditEntry = function(id){ _editingId=id; _deleteId=null; clarityRefresh();
    const t=document.getElementById('cl-eans-'+id); if(t) t.focus();
  };
  window.clarityCancelEdit = function(){ _editingId=null; clarityRefresh(); };
  window.claritySaveEdit = function(id){
    const ansEl=document.getElementById('cl-eans-'+id);
    const decEl=document.getElementById('cl-edec-'+id);
    const decision=(decEl&&decEl.value.trim())||'';
    if(!decision){ if(decEl){ decEl.style.borderColor='rgba(231,76,60,0.9)'; decEl.focus(); } return; }
    const entries=getEntries(state);
    const e=entries.find(function(x){return x.id===id;});
    if(e){ e.answer=(ansEl&&ansEl.value.trim())||''; e.decision=decision; e.editedAt=Date.now(); }
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    _editingId=null; clarityRefresh();
  };
  window.clarityDeleteEntry = function(id){ _deleteId=id; _editingId=null; clarityRefresh(); };
  window.clarityCancelDelete = function(){ _deleteId=null; clarityRefresh(); };
  window.clarityConfirmDelete = function(id){
    if(state.data&&state.data.clarity&&Array.isArray(state.data.clarity.entries)){
      state.data.clarity.entries = state.data.clarity.entries.filter(function(x){return x.id!==id;});
    }
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    _deleteId=null; if(_openSession===id) _openSession=null; clarityRefresh();
  };
  window.clarityToggleSession = function(id){ _openSession = (_openSession===id) ? null : id; clarityRefresh(); };

  // ── the coach ──
  async function runCoach(control){
    const q = currentQuestion(state);
    c.loading = true; c.error = null; c.lastOp = { type:'coach', control: control||null };
    render();
    try {
      const r = await askCoach({
        category: q.cat, question: q.text,
        messages: c.messages, control: control || null,
        excerpts: excerptsFor(q)
      });
      c.messages.push({ role:'assistant', content:r.question, observation:r.observation, mode:control||null, ts:Date.now() });
      c.readyToWrap = r.readyToWrap;
    } catch(err){
      c.error = (err && err.message) ? err.message : 'Something went wrong.';
    }
    c.loading = false; render();
  }
  async function runSummary(){
    const q = currentQuestion(state);
    c.loading = true; c.error = null; c.lastOp = { type:'summary' };
    render();
    try {
      c.summary = await askSummary({
        category: q.cat, question: q.text,
        messages: c.messages, excerpts: excerptsFor(q)
      });
    } catch(err){
      c.error = (err && err.message) ? err.message : 'Something went wrong.';
    }
    c.loading = false; render();
  }

  window.clarityDigDeeper = function(){
    capture();
    const dr = state.clarityDraft || {};
    const opening = (dr.answer||'').trim();
    if(!opening) return;
    const q = currentQuestion(state);
    c.active = true; c.summary = null; c.error = null; c.draft='';
    c.messages = [{ role:'user', content: opening, ts:Date.now() }];
    c.usedPrevious = excerptsFor(q).length > 0;
    runCoach(null);
  };
  window.clarityReply = function(){
    capture();
    const text = (c.draft||'').trim();
    if(!text || c.loading) return;
    c.messages.push({ role:'user', content:text, ts:Date.now() });
    c.draft = '';
    runCoach(null);
  };
  window.clarityControl = function(mode){
    if(c.loading) return;
    capture();
    const text = (c.draft||'').trim();
    if(text){ c.messages.push({ role:'user', content:text, ts:Date.now() }); c.draft=''; }
    if(mode==='wrap') runSummary(); else runCoach(mode);
  };
  window.clarityRetry = function(){
    if(!c.lastOp) { c.error=null; render(); return; }
    if(c.lastOp.type==='summary') runSummary(); else runCoach(c.lastOp.control);
  };
  window.clarityDismissError = function(){ c.error=null; render(); };
  window.clarityDiscardCoach = function(){ capture(); resetCoach(); render(); };

  window.claritySaveReflection = function(){
    const g = function(id){ const el=document.getElementById(id); return el ? el.value.trim() : ''; };
    const decision = g('cl-s-dec');
    if(!decision){ const el=document.getElementById('cl-s-dec'); if(el){ el.style.borderColor='rgba(231,76,60,0.9)'; el.focus(); } return; }
    const q = currentQuestion(state);
    const opening = (c.messages[0] && c.messages[0].content) || (state.clarityDraft && state.clarityDraft.answer) || '';
    state.data.clarity = state.data.clarity || { entries: [] };
    state.data.clarity.entries = state.data.clarity.entries || [];
    state.data.clarity.entries.push({
      id: 'cl'+Date.now().toString(36),
      questionId: q.id, questionText: q.text, category: q.cat,
      answer: opening, decision: decision, ts: Date.now(),
      session: {
        messages: c.messages.slice(),
        summary: { whatISaid:g('cl-s-said'), whatIRealised:g('cl-s-real'), pattern:g('cl-s-pat')||null, decision:decision, remember:g('cl-s-rem') },
        usedPrevious: !!c.usedPrevious,
        completedAt: Date.now()
      }
    });
    if(typeof saveDataQuiet==='function') saveDataQuiet();
    resetCoach(); resetDraft(); render();
  };

  // ── think-view wiring ──
  if((state.clarityView||'today')!=='today') return;
  const ans=document.getElementById('cl-answer');
  const dec=document.getElementById('cl-decision');
  const save=document.getElementById('cl-save');
  const hint=document.getElementById('cl-hint');
  const tog=document.getElementById('cl-htoggle');
  const dig=document.getElementById('cl-dig');
  const reply=document.getElementById('cl-reply');

  if(reply){ reply.oninput = function(){ c.draft = reply.value; }; }
  if(!ans||!dec||!save) return;

  function autogrow(t){ if(!t)return; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
  function updateSave(){
    const has = dec.value.trim().length>0;
    save.disabled = !has;
    if(hint) hint.style.display = has ? 'none' : 'inline';
    if(dig) dig.disabled = ans.value.trim().length < 3;
  }

  const draft = state.clarityDraft || (state.clarityDraft={answer:'',decision:''});
  ans.value = draft.answer || '';
  dec.value = draft.decision || '';
  autogrow(ans);
  updateSave();

  ans.oninput = function(){ draft.answer = ans.value; autogrow(ans); updateSave(); };
  dec.oninput = function(){ draft.decision = dec.value; updateSave(); };
  dec.onkeydown = function(e){ if(e.key==='Enter'){ e.preventDefault(); if(!save.disabled) doSave(); } };
  if(tog) tog.onclick = window.clarityToggleHistory;
  if(dig) dig.onclick = window.clarityDigDeeper;

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
    const list=document.getElementById('cl-hlist'), lbl=document.getElementById('cl-hlabel');
    if(list){ list.classList.remove('open'); list.innerHTML = historyListHTML(state, q.id); }
    if(tog) tog.classList.remove('open');
    if(lbl){ const n=entriesFor(state, q.id).length; lbl.textContent = n ? 'Previous entries ('+n+')' : 'Previous entries'; }
  }

  save.onclick = doSave;
}
