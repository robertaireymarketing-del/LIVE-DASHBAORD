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
    s += '\n\nProduce the final summary now. Reply in EXACTLY this format and nothing else. '
      + 'Put each label at the very start of its own line, in capitals, followed by a colon. A value may run onto more lines until the next label.\n\n'
      + 'WHAT_I_SAID: a concise summary of their situation in their own language\n'
      + 'WHAT_I_REALISED: the central insight uncovered\n'
      + 'PATTERN: a short pattern observation, or the single word none if the evidence does not support one\n'
      + 'DECISION: I will ...\n'
      + 'REMEMBER: one short sentence capturing the lesson\n\n'
      + 'The DECISION must be within their control, specific, realistic, observable, connected to the insight, ideally attached to a time, place or trigger, and must begin with "I will". '
      + 'Do not write anything before WHAT_I_SAID or after the REMEMBER line. Do not use JSON, markdown, asterisks, bullet points or code fences.';
  } else {
    s += '\n\nReply in EXACTLY this format and nothing else. Put each label at the very start of its own line, in capitals, followed by a colon:\n\n'
      + 'OBSERVATION: one short sentence reflecting what they just said, or the single word none\n'
      + 'QUESTION: your single follow-up question\n\n'
      + 'Ask ONE question only. Do not write anything before OBSERVATION or after the question. Do not use JSON, markdown, asterisks or code fences.';
  }
  return s;
}

function stripFences(str){
  return String(str==null?'':str)
    .replace(/^\uFEFF/, '')          // stray BOM
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

// Scan for the first balanced { ... } starting at `start`, respecting string
// literals and escapes so a brace inside a string never fools us. Returns the
// closing index when complete, plus the open-string / open-brace state so a
// truncated tail can be repaired.
function scanObject(t, start){
  let depth = 0, inStr = false, esc = false;
  for(let i = start; i < t.length; i++){
    const ch = t[i];
    if(inStr){
      if(esc) esc = false;
      else if(ch === '\\') esc = true;
      else if(ch === '"') inStr = false;
      continue;
    }
    if(ch === '"'){ inStr = true; continue; }
    if(ch === '{') depth++;
    else if(ch === '}'){ depth--; if(depth === 0) return { end:i, complete:true, inStr:false, depth:0 }; }
  }
  return { end:t.length-1, complete:false, inStr, depth };
}

// Close an object that got cut off by max_tokens: drop a dangling escape,
// close an open string, strip a trailing comma, then add the missing braces.
function repairTruncated(fragment, inStr, depth){
  let s = fragment.replace(/\\$/, '');
  if(inStr) s += '"';
  s = s.replace(/,\s*$/, '');
  for(let i = 0; i < (depth || 1); i++) s += '}';
  return s;
}

// Escape raw control characters that appear *inside* string literals (a real
// newline in a value is the single most common thing that breaks otherwise-
// valid model JSON), and strip trailing commas.
function sanitizeJson(t){
  let out = '', inStr = false, esc = false;
  for(let i = 0; i < t.length; i++){
    const ch = t[i], code = t.charCodeAt(i);
    if(inStr){
      if(esc){ out += ch; esc = false; continue; }
      if(ch === '\\'){ out += ch; esc = true; continue; }
      if(ch === '"'){ out += ch; inStr = false; continue; }
      if(code < 0x20){
        out += (ch === '\n') ? '\\n' : (ch === '\r') ? '\\r' : (ch === '\t') ? '\\t'
             : '\\u' + code.toString(16).padStart(4, '0');
        continue;
      }
      out += ch; continue;
    }
    if(ch === '"'){ inStr = true; }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');   // drop trailing commas
}

function tryParse(s){ try { return JSON.parse(s); } catch(e){ return undefined; } }

function parseLoose(text){
  const t = stripFences(text);
  if(!t) return null;
  let r;
  r = tryParse(t);               if(r !== undefined) return r;   // 1) clean parse
  r = tryParse(sanitizeJson(t)); if(r !== undefined) return r;   //    + sanitised
  const a = t.indexOf('{');
  if(a < 0) return null;
  const scan = scanObject(t, a);
  if(scan.complete){                                             // 2) first balanced object
    const slice = t.slice(a, scan.end + 1);
    r = tryParse(slice);               if(r !== undefined) return r;
    r = tryParse(sanitizeJson(slice)); if(r !== undefined) return r;
  }
  const repaired = repairTruncated(t.slice(a), scan.inStr, scan.depth);
  r = tryParse(repaired);               if(r !== undefined) return r;   // 3) repair truncation
  r = tryParse(sanitizeJson(repaired)); if(r !== undefined) return r;
  const b = t.lastIndexOf('}');                                  // 4) last-ditch outer slice
  if(b > a){
    r = tryParse(t.slice(a, b + 1));               if(r !== undefined) return r;
    r = tryParse(sanitizeJson(t.slice(a, b + 1))); if(r !== undefined) return r;
  }
  return null;
}

// Schema-aware salvage: pull individual fields straight out of the text even
// when the JSON as a whole won't parse. As long as the field we need is a
// well-formed quoted string, we recover it regardless of other breakage.
function jsonField(t, key){
  const m = t.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
  if(!m) return null;
  return tryParse('"' + m[1] + '"') ?? m[1];
}
function jsonBool(t, key){
  const m = t.match(new RegExp('"' + key + '"\\s*:\\s*(true|false)'));
  return m ? (m[1] === 'true') : null;
}
function salvage(text, wantSummary){
  const t = stripFences(text);
  if(wantSummary){
    const decision = jsonField(t, 'decision');
    const whatIRealised = jsonField(t, 'whatIRealised');
    if(!decision && !whatIRealised) return null;
    return {
      whatISaid:     jsonField(t, 'whatISaid') || '',
      whatIRealised: whatIRealised || '',
      pattern:       jsonField(t, 'pattern'),
      decision:      decision || '',
      remember:      jsonField(t, 'remember') || ''
    };
  }
  const question = jsonField(t, 'question');
  if(!question) return null;
  return {
    observation:   jsonField(t, 'observation'),
    question:      question,
    readyToWrap:   jsonBool(t, 'readyToWrap') === true,
    reasonForWrap: jsonField(t, 'reasonForWrap')
  };
}

// ── Labelled-format parser (primary; far more robust than JSON) ────
// The model is asked to reply as  LABEL: value  lines. There are no quotes or
// braces to escape, so newlines/quotes/braces inside a value can't break it.
const COACH_LABELS   = [{key:'observation',label:'OBSERVATION'},{key:'question',label:'QUESTION'}];
const SUMMARY_LABELS = [{key:'whatISaid',label:'WHAT_I_SAID'},{key:'whatIRealised',label:'WHAT_I_REALISED'},{key:'pattern',label:'PATTERN'},{key:'decision',label:'DECISION'},{key:'remember',label:'REMEMBER'}];

function escapeRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function parseLabeled(text, labels){
  // strip defensive markdown (bold/backticks/heading marks) the model shouldn't add
  const t = String(text==null?'':text)
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/^#{1,6}[ \t]*/gm, '');
  const alt = labels.map(function(l){ return escapeRe(l.label); }).join('|');
  const out = {};
  for(let i = 0; i < labels.length; i++){
    const l = labels[i];
    const re = new RegExp('(?:^|\\n)[ \\t]*' + escapeRe(l.label) + '[ \\t]*:[ \\t]*([\\s\\S]*?)(?=\\n[ \\t]*(?:' + alt + ')[ \\t]*:|$)', 'i');
    const m = t.match(re);
    out[l.key] = m ? m[1].trim() : '';
  }
  return out;
}

// Returns the same shapes the handler already expects, or null if unusable.
function parseReply(text, wantSummary){
  if(wantSummary){
    const lab = parseLabeled(text, SUMMARY_LABELS);
    if((lab.decision && lab.decision.trim()) || (lab.whatIRealised && lab.whatIRealised.trim())){
      return {
        whatISaid:     lab.whatISaid || '',
        whatIRealised: lab.whatIRealised || '',
        pattern:       (lab.pattern && !/^none\.?$/i.test(lab.pattern.trim())) ? lab.pattern : null,
        decision:      lab.decision || '',
        remember:      lab.remember || ''
      };
    }
    const j = parseLoose(text) || salvage(text, true);   // JSON fallback
    if(j) return { whatISaid:j.whatISaid||'', whatIRealised:j.whatIRealised||'', pattern:j.pattern||null, decision:j.decision||'', remember:j.remember||'' };
    return null;
  }
  const lab = parseLabeled(text, COACH_LABELS);
  let question = (lab.question || '').trim();
  let observation = (lab.observation || '').trim();
  if(!question){                                          // JSON fallback
    const j = parseLoose(text) || salvage(text, false);
    if(j){ question = String(j.question||'').trim(); observation = j.observation ? String(j.observation).trim() : ''; }
  }
  if(!question) return null;
  if(/^none\.?$/i.test(observation)) observation = '';
  return { observation: observation || null, question: question, readyToWrap: false, reasonForWrap: null };
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
  let messages = transcript.map(function(m){
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content||'').slice(0, MAX_CHARS) };
  }).filter(function(m){ return m.content.trim().length; });
  if(!messages.length) return respond(400, {error:'Empty transcript'});
  if(messages[0].role !== 'user') messages.unshift({role:'user', content:'(continuing)'});

  // The Messages API requires roles to alternate — merge any consecutive pair.
  const alternating = [];
  for(let i=0;i<messages.length;i++){
    const last = alternating[alternating.length-1];
    if(last && last.role === messages[i].role) last.content += '\n\n' + messages[i].content;
    else alternating.push({ role: messages[i].role, content: messages[i].content });
  }
  messages = alternating;

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
        max_tokens: wantSummary ? 1024 : 600,
        system: system,
        messages: messages
      })
    });

    if(!r.ok){
      const raw = await r.text();
      let msg = raw;
      try { const j = JSON.parse(raw); if(j && j.error && j.error.message) msg = j.error.message; } catch(e){}
      console.error('[clarity-coach] upstream ' + r.status + ': ' + raw.slice(0,500));
      return respond(502, {error:'Anthropic '+r.status+': '+String(msg).slice(0,300), detail: raw.slice(0,400)});
    }

    const data = await r.json();
    const stopReason = data.stop_reason || null;
    const text = (data.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('\n');
    let parsed = parseReply(text, wantSummary);   // labelled format first, JSON fallback inside
    if(!parsed){
      console.error('[clarity-coach] parse failed. stop_reason=' + stopReason + ' text=' + String(text).slice(0,500));
      return respond(502, {
        error: stopReason === 'max_tokens'
          ? 'The coach reply was cut short. Try again.'
          : 'Could not parse the coach response. Try again.',
        stop_reason: stopReason,
        raw: String(text).slice(0,400)
      });
    }

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
