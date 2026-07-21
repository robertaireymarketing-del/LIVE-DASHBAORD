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

// ── Question bank (curated; edit freely) ──────────────────────────
const QUESTIONS = [
  {id:"self-avoid",     cat:"Self",       text:"What am I avoiding right now, and what is it costing me?"},
  {id:"self-remove",    cat:"Self",       text:"If I removed one habit from my life this week, which would change the most?"},
  {id:"self-effort",    cat:"Self",       text:"Where am I performing effort instead of making progress?"},
  {id:"self-become",    cat:"Self",       text:"What would the person I'm trying to become do about today's biggest problem?"},
  {id:"biz-bottleneck", cat:"Business",   text:"What is TJM's single biggest bottleneck right now?"},
  {id:"biz-onething",   cat:"Business",   text:"If TJM could do only one thing for the next 30 days, what should it be?"},
  {id:"biz-die",        cat:"Business",   text:"What part of the business am I keeping alive that I should let die?"},
  {id:"biz-competitor", cat:"Business",   text:"What would I change if a serious competitor launched tomorrow?"},
  {id:"lead-hold",      cat:"Leadership", text:"Where am I holding a task someone else should own?"},
  {id:"lead-standard",  cat:"Leadership", text:"Who around me needs a clearer standard from me?"},
  {id:"lead-tolerate",  cat:"Leadership", text:"What am I tolerating that I shouldn't be?"},
  {id:"mkt-choose",     cat:"Marketing",  text:"Why would someone choose TJM over the jeweller they already trust?"},
  {id:"mkt-onlyi",      cat:"Marketing",  text:"What's the one piece of content only I could make?"},
  {id:"mkt-mirror",     cat:"Marketing",  text:"Where is my marketing describing the product instead of the customer?"},
  {id:"sales-object",   cat:"Sales",      text:"What objection kills the most sales — and how do I answer it before it's raised?"},
  {id:"sales-aov",      cat:"Sales",      text:"What would raise my average order value without a discount?"},
  {id:"sales-lost",     cat:"Sales",      text:"Who bought once and never came back — and why?"},
  {id:"cust-wish",      cat:"Customers",  text:"What does my best customer wish existed that I don't offer?"},
  {id:"cust-doubt",     cat:"Customers",  text:"What moment in the buying experience causes the most doubt?"},
  {id:"cust-call",      cat:"Customers",  text:"If I called five recent customers today, what would I ask them?"},
  {id:"sys-redo",       cat:"Systems",    text:"What do I redo every week that should be done once?"},
  {id:"sys-pileup",     cat:"Systems",    text:"Where does work pile up waiting on me specifically?"},
  {id:"sys-gone",       cat:"Systems",    text:"What would break if I disappeared for two weeks?"},
  {id:"fin-number",     cat:"Finance",    text:"What number, watched daily, would change my decisions the most?"},
  {id:"fin-habit",      cat:"Finance",    text:"Where am I spending money out of habit rather than return?"},
  {id:"fin-cut",        cat:"Finance",    text:"What would I cut first if revenue halved — and why haven't I already?"},
  {id:"vis-best",       cat:"Vision",     text:"What does TJM look like the day it becomes the best in the UK?"},
  {id:"vis-outlive",    cat:"Vision",     text:"What am I building that outlives me?"},
  {id:"vis-tenyr",      cat:"Vision",     text:"Zooming out ten years — what am I doing today that won't matter?"},
  {id:"strat-moat",     cat:"Strategy",   text:"What advantage do I have that's genuinely hard to copy?"},
  {id:"strat-terms",    cat:"Strategy",   text:"Where am I competing on someone else's terms instead of my own?"},
  {id:"strat-bet",      cat:"Strategy",   text:"What's the smallest bet with the biggest upside right now?"},
  {id:"exec-next",      cat:"Execution",  text:"What's the next physical action on the thing I keep postponing?"},
  {id:"exec-didnt",     cat:"Execution",  text:"What did I plan last week that didn't happen — and why?"},
  {id:"exec-done",      cat:"Execution",  text:"What would \u201cdone today\u201d actually look like?"},
  {id:"hab-year",       cat:"Habits",     text:"What small daily action, repeated for a year, would change everything?"},
  {id:"hab-protect",    cat:"Habits",     text:"Which habit am I proud of — and how do I protect it?"},
  {id:"hab-auto",       cat:"Habits",     text:"What am I doing on autopilot that deserves a second look?"},
  {id:"disc-watch",     cat:"Discipline", text:"What am I doing when no one is watching?"},
  {id:"disc-negotiate", cat:"Discipline", text:"Where am I negotiating with myself instead of just acting?"},
  {id:"disc-slip",      cat:"Discipline", text:"What standard have I quietly let slip?"},
];
const CATS = QUESTIONS.reduce((a,q)=>{ if(a.indexOf(q.cat)<0)a.push(q.cat); return a; }, []);

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
.clarity-page .cl-hlist.open{ max-height:9000px; }
.clarity-page .cl-entry{ padding:22px 0;border-top:1px solid rgba(255,255,255,0.08); }
.clarity-page .cl-entry:first-child{ border-top:none; }
.clarity-page .cl-edate{ font-size:12px;letter-spacing:.05em;color:rgba(255,255,255,0.4);margin-bottom:12px; }
.clarity-page .cl-eans{ font-size:17px;line-height:1.62;color:rgba(255,255,255,0.9);margin-bottom:14px;white-space:pre-wrap; }
.clarity-page .cl-eans.empty{ color:rgba(255,255,255,0.4);font-style:italic; }
.clarity-page .cl-edec{ display:flex;gap:11px;align-items:baseline;font-size:17px;line-height:1.5;color:#fff; }
.clarity-page .cl-edec .cl-mk{ color:#C9A84C;flex:none; }
.clarity-page .cl-empty{ font-size:13.5px;color:rgba(255,255,255,0.45);padding:14px 0;line-height:1.6; }

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

// ── History list markup (prebuilt, collapsed) ─────────────────────
function entryHTML(e){
  return `
    <div class="cl-entry">
      <div class="cl-edate">${esc(fmtDate(e.ts))}</div>
      <div class="cl-eans ${e.answer?'':'empty'}">${e.answer?esc(e.answer):'(no notes)'}</div>
      ${e.decision?`<div class="cl-edec"><span class="cl-mk">&rarr;</span><span>${esc(e.decision)}</span></div>`:''}
    </div>`;
}
function historyListHTML(state, qid){
  const es = entriesFor(state, qid);
  if(!es.length) return `<div class="cl-empty">No entries yet. This is the first time you've thought about this one.</div>`;
  return es.map(entryHTML).join('');
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
  const all = getEntries(state).slice().sort(function(a,b){ return (b.ts||0)-(a.ts||0); });
  if(!all.length) return `<div class="cl-sechead"><h2>History</h2><p>Everything you've decided, newest first.</p></div><div class="cl-empty">Nothing yet. Open today's question and make your first decision.</div>`;
  const items = all.map(function(e){
    return `<div class="cl-fq" onclick="clarityOpen('${esc(e.questionId)}')"><span class="cl-eyebrow">${esc((e.category||'').toString())}</span>${esc(e.questionText||'')}</div>${entryHTML(e)}`;
  }).join('');
  return `<div class="cl-sechead"><h2>History</h2><p>Everything you've decided, newest first.</p></div>${items}`;
}

// ── Full page ─────────────────────────────────────────────────────
export function renderClarityTab({ state }){
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

  // navigation handlers — set once, safe to reset each call
  function resetDraft(){ state.clarityDraft = { answer:'', decision:'' }; }
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

  // think-view wiring only
  if((state.clarityView||'today')!=='today') return;
  const ans=document.getElementById('cl-answer');
  const dec=document.getElementById('cl-decision');
  const save=document.getElementById('cl-save');
  const hint=document.getElementById('cl-hint');
  const tog=document.getElementById('cl-htoggle');
  if(!ans||!dec||!save) return;

  const draft = state.clarityDraft || (state.clarityDraft={answer:'',decision:''});
  ans.value = draft.answer || '';
  dec.value = draft.decision || '';
  autogrow(ans);

  function autogrow(t){ if(!t)return; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
  function updateSave(){
    const has = dec.value.trim().length>0;
    save.disabled = !has;
    if(hint) hint.style.display = has ? 'none' : 'inline';
  }
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

    // hone the edge + flash, without a full re-render (keeps focus/scroll)
    const edge=document.getElementById('cl-edge');
    if(edge){ edge.classList.remove('hone'); void edge.offsetWidth; edge.classList.add('hone'); }
    const flash=document.getElementById('cl-flash');
    if(flash){ flash.classList.add('show'); setTimeout(function(){ if(flash) flash.classList.remove('show'); }, 2600); }

    // reset fields + draft
    ans.value=''; dec.value=''; draft.answer=''; draft.decision=''; autogrow(ans); updateSave();

    // refresh the (still-collapsed) history list + count
    const list=document.getElementById('cl-hlist'), lbl=document.getElementById('cl-hlabel');
    if(list){ list.classList.remove('open'); list.innerHTML = historyListHTML(state, q.id); }
    if(tog) tog.classList.remove('open');
    if(lbl){ const n=entriesFor(state, q.id).length; lbl.textContent = n ? 'Previous entries ('+n+')' : 'Previous entries'; }
  }

  save.onclick = doSave;
}

// ── AI hooks for a later version (intentionally not implemented) ──
// The data in state.data.clarity.entries is enough to add, with no migration:
//   • follow-up questions   → send current answer to your Anthropic proxy
//   • recurring patterns    → group entries by questionId over time
//   • summarise thinking    → feed entriesFor(state, qid) to the model
//   • compare answers       → diff latest vs earlier entries for a question
//   • remind of decisions   → surface the last decision when a question reopens
