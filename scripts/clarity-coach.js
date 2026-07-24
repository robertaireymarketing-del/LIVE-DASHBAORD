// ═══════════════════════════════════════════════════════════════
// clarity-coach — serverless proxy for the Clarity AI coach.
//
// The Anthropic API key NEVER reaches the browser. The browser posts a
// small structured payload here; this function builds the coaching system
// prompt (kept server-side so the endpoint can't be used as a general-
// purpose LLM), calls Anthropic, validates the JSON, and returns it.
//
// Netlify:  place at  netlify/functions/clarity-coach.js
//           endpoint  /.netlify/functions/clarity-coach
// Env var:  ANTHROPIC_API_KEY   (required)
//           CLARITY_MODEL       (optional, default claude-sonnet-5)
// ═══════════════════════════════════════════════════════════════

const MODEL = process.env.CLARITY_MODEL || 'claude-sonnet-5';
const ALLOWED_MODELS = ['claude-sonnet-5','claude-haiku-4-5-20251001','claude-opus-4-8'];
const MAX_TRANSCRIPT = 24;      // messages
const MAX_CHARS = 4000;         // per message
const MAX_EXCERPTS = 5;

// ── Category coaching briefs ──────────────────────────────────────
const BRIEFS = {
  Self: {
    explore: 'identity, beliefs, emotions, personal standards, confidence, avoidance, internal conflict, and alignment between values and behaviour',
    directions: ['What does this reveal about how you see yourself?','Is this belief helping you or limiting you?','What are you reluctant to admit?','What would the man you are becoming do differently?']
  },
  Business: {
    explore: 'commercial priorities, revenue-generating activity, value creation, bottlenecks, focus, opportunity cost, and business fundamentals',
    directions: ['Does this directly help the business grow?','What is the actual commercial consequence?','What important work is being displaced?','What would matter most if resources were limited?']
  },
  Leadership: {
    explore: 'clarity, responsibility, communication, delegation, standards, decision-making, accountability, and the example being set',
    directions: ['What standard are you currently modelling?','Have your expectations been clearly communicated?','Are you leading the issue or merely reacting to it?','What decision are you avoiding as the leader?']
  },
  Marketing: {
    explore: 'audience, positioning, message clarity, attention, trust, differentiation, consistency, and content effectiveness',
    directions: ['Who is this specifically intended for?','What problem or desire does the message speak to?','Is the message clear enough to be understood instantly?','Are you creating content or creating demand?']
  },
  Sales: {
    explore: 'offers, objections, follow-up, customer understanding, confidence, conversion, sales activity, and avoidance of rejection',
    directions: ['What is actually preventing the sale?','Have you clearly communicated the value?','Is this a lead problem, an offer problem or an execution problem?','Are you avoiding an action because it may involve rejection?']
  },
  Customers: {
    explore: 'customer needs, trust, experience, retention, feedback, communication, loyalty, and perceived value',
    directions: ['What is the customer likely experiencing?','What would make this easier or more reassuring for them?','Are you solving the problem from your perspective or theirs?','What would make them return or recommend the business?']
  },
  Systems: {
    explore: 'repeatability, process clarity, automation, documentation, friction, handoffs, measurement, and dependency on individuals',
    directions: ['Why does this currently rely on memory or motivation?','Where is the recurring friction?','Can this be turned into a checklist, trigger or automated process?','What would make the correct action easier to repeat?']
  },
  Finance: {
    explore: 'cash flow, profitability, spending, return on investment, risk, pricing, financial discipline, and trade-offs',
    directions: ['What is the real financial effect of this?','Is this an investment, a necessary cost or avoidable spending?','What return should this produce?','Are the numbers supporting the story being told?'],
    extra: 'Never invent financial facts, figures or numbers the user has not supplied. If a number matters and is missing, ask for it.'
  },
  Vision: {
    explore: 'desired future, long-term direction, ambition, identity, purpose, scale, alignment, and sacrifice',
    directions: ['What does the successful version of this look like?','Why does this future matter to you?','Is your present behaviour aligned with that vision?','What must become true for the vision to become credible?']
  },
  Strategy: {
    explore: 'choices, trade-offs, leverage, sequencing, competitive advantage, resource allocation, priorities, and what not to do',
    directions: ['What are you choosing not to do?','Where is the greatest leverage?','Is this a strategy or simply a collection of tasks?','What must happen first for the rest to become easier?']
  },
  Execution: {
    explore: 'next actions, pace, completion, priorities, blockers, deadlines, focus, and movement from thinking to doing',
    directions: ['What is the next visible action?','What specifically is stopping completion?','Is the task unclear, uncomfortable or genuinely impossible?','What can be finished today rather than merely advanced?']
  },
  Habits: {
    explore: 'cues, routines, rewards, environment, consistency, identity reinforcement, friction, and relapse patterns',
    directions: ['What usually happens immediately before this behaviour?','What reward are you seeking?','How is the environment making this easier or harder?','What smaller behaviour could become the reliable minimum?']
  },
  Discipline: {
    explore: 'excuses, standards, discomfort, impulse control, delayed gratification, personal responsibility, consistency, and acting despite emotion',
    directions: ['Is that a genuine limitation or a preferred excuse?','What feeling are you unwilling to experience?','What would action look like even if motivation did not arrive?','What standard are you accepting through this behaviour?']
  }
};

const CONTROLS = {
  deeper:    'The user pressed GO DEEPER. Ask a question that explores the underlying belief, emotion, motive or root cause beneath what they have just said.',
  challenge: 'The user pressed CHALLENGE ME. Question an assumption, excuse, contradiction or unsupported conclusion in what they have said. Be direct, never insulting.',
  pattern:   'The user pressed FIND THE PATTERN. Compare what they have said in this reflection with the earlier messages and any supplied previous entries. Only assert a pattern that the supplied material actually supports; if the evidence is not there, say so plainly and ask a question that would reveal whether a pattern exists.',
  wrap:      'The user pressed WRAP UP. Stop asking questions and produce the final summary.'
};

function baseRules(){
  return [
    'You are a calm, highly perceptive executive coach helping one person think more clearly and reach a concrete decision. You are not a therapist and you do not diagnose, treat or offer medical or mental-health care.',
    '',
    'Rules you must follow:',
    '- Ask ONE question at a time. Never stack multiple questions.',
    '- Respond to the person\'s actual words, not a generic script.',
    '- Notice vague language ("tired", "stressed", "busy", "I don\'t know", "I\'ll try harder") and ask for specificity, context or a concrete example rather than accepting it as the root issue.',
    '- Notice contradictions and challenge unsupported conclusions.',
    '- Distinguish facts from interpretations and feelings.',
    '- Encourage ownership without dismissing genuine difficulty.',
    '- Avoid praise, flattery, lectures and long paragraphs.',
    '- Never repeat an earlier question in slightly different wording.',
    '- Move steadily toward a useful conclusion; most reflections resolve within 3-6 follow-up questions, but finish sooner if clarity has been reached.',
    '- Occasionally reflect back one concise observation before your question.',
    '- Never claim a pattern unless the supplied previous entries actually support it.',
    '- Be direct but never shaming or insulting.'
  ].join('\n');
}

function buildSystem(category, question, excerpts, control, wantSummary){
  const brief = BRIEFS[category] || null;
  let s = baseRules();
  s += '\n\nThe reflection question is: "' + question + '"';
  if(brief){
    s += '\nCategory: ' + category + '. For this category, explore ' + brief.explore + '.';
    s += '\nUseful directions (inspiration, not a script — adapt to what they actually say):\n- ' + brief.directions.join('\n- ');
    if(brief.extra) s += '\n' + brief.extra;
  }
  if(excerpts && excerpts.length){
    s += '\n\nRelevant previous entries from this person (use only to spot genuine recurrence; never invent):\n';
    excerpts.forEach(function(x,i){ s += (i+1)+'. ['+(x.date||'')+'] answer: '+(x.answer||'')+' | decision: '+(x.decision||'')+'\n'; });
  } else {
    s += '\n\nNo previous entries were supplied. Do not claim any pattern across time.';
  }
  if(control && CONTROLS[control]) s += '\n\n' + CONTROLS[control];

  if(wantSummary){
    s += '\n\nProduce the final summary now. Respond with ONLY a JSON object, no markdown, no code fences, in exactly this shape:\n'
      + '{"whatISaid":"concise summary of their situation in their own language","whatIRealised":"the central insight uncovered","pattern":"short pattern observation, or null if the evidence does not support one","decision":"I will ...","remember":"one short sentence capturing the lesson"}\n'
      + 'The decision must be within their control, specific, realistic, observable, connected to the insight, and ideally attached to a time, place or trigger. It must begin with "I will".';
  } else {
    s += '\n\nRespond with ONLY a JSON object, no markdown, no code fences, in exactly this shape:\n'
      + '{"observation":"optional one-sentence reflection on what they said, or null","question":"your single follow-up question","readyToWrap":false,"reasonForWrap":null}\n'
      + 'Set readyToWrap to true only when the reflection has reached a real insight and a decision is within reach.';
  }
  return s;
}

function clean(str){
  return String(str==null?'':str).replace(/```json/gi,'').replace(/```/g,'').trim();
}

function extractJSON(text){
  const t = clean(text);
  try { return JSON.parse(t); } catch(e){}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a>=0 && b>a){ try { return JSON.parse(t.slice(a,b+1)); } catch(e){} }
  return null;
}

function respond(status, obj){
  return {
    statusCode: status,
    headers: {
      'Content-Type':'application/json',
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'Content-Type',
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Cache-Control':'no-store'
    },
    body: JSON.stringify(obj)
  };
}

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return respond(200, {ok:true});
  if(event.httpMethod !== 'POST')   return respond(405, {error:'Method not allowed'});

  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return respond(500, {error:'Server is missing ANTHROPIC_API_KEY. Add it in your host dashboard and redeploy.'});

  let payload;
  try { payload = JSON.parse(event.body||'{}'); }
  catch(e){ return respond(400, {error:'Bad JSON body'}); }

  const wantSummary = payload.mode === 'summary';
  const category = String(payload.category||'').slice(0,40);
  const question = String(payload.question||'').slice(0,400);
  const control  = payload.control ? String(payload.control).slice(0,20) : null;
  if(!question) return respond(400, {error:'Missing question'});

  const transcript = Array.isArray(payload.transcript) ? payload.transcript.slice(-MAX_TRANSCRIPT) : [];
  if(!transcript.length) return respond(400, {error:'Empty transcript'});
  const messages = transcript.map(function(m){
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content||'').slice(0, MAX_CHARS) };
  }).filter(function(m){ return m.content.trim().length; });
  if(!messages.length) return respond(400, {error:'Empty transcript'});
  if(messages[0].role !== 'user') messages.unshift({role:'user', content:'(continuing)'});
  if(messages[messages.length-1].role === 'assistant') messages.push({role:'user', content: wantSummary ? 'Please wrap up now.' : 'Continue.'});

  const excerpts = (Array.isArray(payload.excerpts) ? payload.excerpts : []).slice(0, MAX_EXCERPTS).map(function(x){
    return { date:String(x.date||'').slice(0,20), answer:String(x.answer||'').slice(0,400), decision:String(x.decision||'').slice(0,300) };
  });

  const model = ALLOWED_MODELS.indexOf(payload.model) >= 0 ? payload.model : MODEL;
  const system = buildSystem(category, question, excerpts, control, wantSummary);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: model,
        max_tokens: wantSummary ? 700 : 320,
        temperature: 0.7,
        system: system,
        messages: messages
      })
    });

    if(!r.ok){
      const detail = await r.text();
      return respond(502, {error:'Anthropic API error ('+r.status+')', detail: detail.slice(0,400)});
    }

    const data = await r.json();
    const text = (data.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n');
    const parsed = extractJSON(text);
    if(!parsed) return respond(502, {error:'Could not parse the coach response. Try again.', raw:String(text).slice(0,300)});

    if(wantSummary){
      const out = {
        whatISaid:     String(parsed.whatISaid||'').slice(0,1200),
        whatIRealised: String(parsed.whatIRealised||'').slice(0,1200),
        pattern:       parsed.pattern ? String(parsed.pattern).slice(0,800) : null,
        decision:      String(parsed.decision||'').slice(0,500),
        remember:      String(parsed.remember||'').slice(0,300)
      };
      if(!out.whatIRealised && !out.decision) return respond(502, {error:'Incomplete summary. Try again.'});
      if(out.decision && !/^i will/i.test(out.decision.trim())) out.decision = 'I will ' + out.decision.trim().replace(/^I\s+/i,'');
      return respond(200, { mode:'summary', summary: out, usage: data.usage||null });
    }

    const q = String(parsed.question||'').slice(0,600);
    if(!q) return respond(502, {error:'The coach returned no question. Try again.'});
    return respond(200, {
      mode:'coach',
      observation: parsed.observation ? String(parsed.observation).slice(0,600) : null,
      question: q,
      readyToWrap: parsed.readyToWrap === true,
      reasonForWrap: parsed.reasonForWrap ? String(parsed.reasonForWrap).slice(0,300) : null,
      usage: data.usage || null
    });

  } catch(err){
    return respond(500, {error:'Request failed: ' + (err && err.message ? err.message : 'unknown')});
  }
};
