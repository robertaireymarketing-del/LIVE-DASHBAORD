// ═══════════════════════════════════════════════════════════════
// news — the daily News edition for the dashboard (More → 📰 News).
//
// Two actions, called one after the other by the page so each stays well
// inside Netlify's 10 s function limit:
//
//   POST { action:'feeds' }
//     → fetches a fixed set of RSS feeds server-side (no CORS), returns the
//       last ~48 h of stories, de-duplicated.
//
//   POST { action:'feeds', set:'ai' }  → same, but AI/tool sources, last 7 days.
//   POST { action:'airank', items, liked, disliked, tried }
//     → the weekly "AI for TJM" picks: what's new + one thing to try in TJM.
//
//   POST { action:'brief', part:'intro'|'story'|'learn'|'ai'|'close', ... }
//     → one section of the spoken daily briefing (~20-30 min in total). The page
//       asks for every section in parallel, so each call stays short enough for
//       Netlify's time limit. 'story' also reads the article itself so the
//       deep-dive is based on what the piece actually says.
//
//   POST { action:'rank', items:[{id,title,summary,source}], liked:[], disliked:[], seen:[titles] }
//     → asks Claude to pick the stories that actually affect Robert's life and
//       goals, score them, tag them and say in one line why each matters.
//       The profile + rules live HERE (server-side) so the endpoint can't be
//       used as a general-purpose LLM.
//
// Env:  ANTHROPIC_API_KEY  (already set for clarity-coach)
//       NEWS_MODEL         (optional — default tries Haiku, then Sonnet)
// ═══════════════════════════════════════════════════════════════

const FEEDS = [
  // Money, economy, business
  { src: 'BBC Business',      url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { src: 'Guardian Business', url: 'https://www.theguardian.com/uk/business/rss' },
  { src: 'Guardian Money',    url: 'https://www.theguardian.com/uk/money/rss' },
  { src: 'Bank of England',   url: 'https://www.bankofengland.co.uk/rss/news' },
  // Retail, e-commerce, jewellery
  { src: 'Retail Gazette',    url: 'https://www.retailgazette.co.uk/feed/' },
  { src: 'Modern Retail',     url: 'https://www.modernretail.co/feed/' },
  { src: 'Prof. Jeweller',    url: 'https://www.professionaljeweller.com/feed/' },
  // Nottingham Insurance: insurance, mortgages, property, landlords
  { src: 'Guardian Property', url: 'https://www.theguardian.com/money/property/rss' },
  { src: 'Guardian Insurance', url: 'https://www.theguardian.com/money/insurance/rss' },
  { src: 'Guardian Mortgages', url: 'https://www.theguardian.com/money/mortgages/rss' },
  { src: 'FCA',               url: 'https://www.fca.org.uk/news/rss.xml' },
  { src: 'Mortgage Strategy', url: 'https://www.mortgagestrategy.co.uk/feed/' },
  { src: 'Property Ind. Eye', url: 'https://www.propertyindustryeye.com/feed/' },
  { src: 'Landlord Today',    url: 'https://www.landlordtoday.co.uk/rss' },
  // Tech & AI
  { src: 'BBC Technology',    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { src: 'TechCrunch',        url: 'https://techcrunch.com/feed/' },
  // Life
  { src: 'BBC Health',        url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { src: 'BBC Nottingham',    url: 'https://feeds.bbci.co.uk/news/england/nottingham/rss.xml' },
  // The wider world — included so genuinely big events can surface, but the
  // ranking only keeps them when they have a real knock-on for him.
  { src: 'BBC UK',            url: 'https://feeds.bbci.co.uk/news/uk/rss.xml' },
  { src: 'BBC World',         url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
];

// Weekly "AI for TJM" — practical AI releases and tools, last 7 days.
const AI_FEEDS = [
  { src: 'OpenAI',          url: 'https://openai.com/news/rss.xml' },
  { src: 'Google AI',       url: 'https://blog.google/technology/ai/rss/' },
  { src: 'TechCrunch AI',   url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { src: 'The Verge AI',    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { src: 'Simon Willison',  url: 'https://simonwillison.net/atom/everything/' },
  { src: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/' },
  { src: 'BBC Technology',  url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { src: 'Shopify',         url: 'https://www.shopify.com/news/feed' },
  { src: 'Modern Retail',   url: 'https://www.modernretail.co/feed/' },
];
const AI_KINDS = ['Tool', 'Feature', 'Model', 'Platform', 'Tactic'];

const TAGS = ['Money', 'Business', 'Retail', 'Jewellery', 'Insurance', 'Property', 'Tech & AI', 'Health', 'Nottingham', 'UK', 'World'];
const SECS = ['TJM', 'NI', 'YOU'];

const PROFILE = [
  'Robert, 29, lives in Nottingham, UK, with his family. Engaged; hoping to move out and eventually buy a home.',
  'Founder of TJM (The Jewellery Merchant), a small online jewellery brand: new hallmarked silver, pre-owned silver sold on Vinted, Pandora charms, his own website, product photography, email marketing and TikTok lives/short video. He has a part-time assistant who edits and posts content.',
  'Also works daily in his father\'s long-established independent jewellery shop.',
  'Side business: Nottingham Insurance — building a website and social audience (SEO articles, Instagram, TikTok, Facebook) to generate insurance leads from landlords, homebuyers and homeowners in Nottingham. Run by his assistant; his fiancée, who works for a mortgage company, handles the leads. Unregulated lead generation first, FCA regulation and a mortgage business later. Self-funding, under £500 personal investment.',
  'News focus: UK first. US or other foreign stories only when they directly affect him.',
  'Qualified accountant by background, so comfortable with numbers, tax and finance detail.',
  'Daily habits he tracks: gym, diet, meditation, and "retention". IMPORTANT: in all of his habit data, "retention" ALWAYS means semen retention — the personal discipline of no porn and no masturbation — never customer retention. Only talk about customer retention when the topic is explicitly TJM customers.',
  'Steps and walking: he works in the shop through the day, so NEVER suggest a lunchtime walk or a walk during the working day. His options for extra steps are (1) time on the treadmill straight after his weights session if he has time, or (2) the walking treadmill/walking pad in the evening. Suggest those, nothing else, when steps come up.',
  'Goals: a £2,000/month salary from TJM as soon as possible; TJM over £10,000/month revenue by August 2027; financial and location freedom; daily gym and good health.',
  'Things that genuinely affect him: UK interest rates, mortgages, inflation and consumer spending; gold and silver prices; UK small-business tax, VAT and rules for online sellers; marketplace and platform changes (Vinted, eBay, Etsy, TikTok Shop, Shopify, Instagram, Google); postage and Royal Mail; retail and e-commerce trends; AI tools a one-person business can use; jewellery industry news; evidence-based health and fitness; Nottingham local news.',
].join('\n');

function respond(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(obj),
  };
}

// ── RSS / Atom parsing (tiny, dependency-free) ─────────────────────
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/g, "'").replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8230;|&hellip;/g, '…').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')            // tags that were entity-escaped inside <description>
    .replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? m[1] : '';
}
function parseFeed(xml, src) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode(tag(b, 'title'));
    let link = decode(tag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    const summary = decode(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 320);
    const when = decode(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date'));
    const ts = Date.parse(when) || 0;
    if (title && link) out.push({ title: title.slice(0, 220), link, summary, source: src, ts });
  }
  return out;
}
async function fetchFeed(f) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(f.url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (dashboard news reader)', Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return parseFeed(await r.text(), f.src);
  } finally { clearTimeout(t); }
}
function normTitle(t) { return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 7).join(' '); }

async function actionFeeds(set) {
  const ai = set === 'ai';
  const list = ai ? AI_FEEDS : FEEDS;
  const results = await Promise.allSettled(list.map(fetchFeed));
  const failed = [];
  let all = [];
  results.forEach((r, i) => { if (r.status === 'fulfilled') all = all.concat(r.value.slice(0, 30)); else failed.push(list[i].src); });
  all.sort((a, b) => b.ts - a.ts);
  // AI: last 7 days, widened to 14 if that's thin.
  let cutoff = Date.now() - (ai ? 7 * 24 : 48) * 3600 * 1000;
  if (ai && all.filter(it => !it.ts || it.ts >= cutoff).length < 15) cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  const seen = new Set();
  const items = [];
  for (const it of all) {
    if (it.ts && it.ts < cutoff) continue;
    const k = normTitle(it.title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    items.push(it);
  }
  // Keep the prompt small.
  const perSrc = {};
  const per = ai ? 18 : 12;
  const capped = items.filter(it => (perSrc[it.source] = (perSrc[it.source] || 0) + 1) <= per).slice(0, ai ? 110 : 140);
  capped.forEach((it, i) => { it.id = (ai ? 'a' : 's') + i; });
  return respond(200, { items: capped, failed, fetchedAt: Date.now() });
}

// ── Ranking with Claude ────────────────────────────────────────────
function buildPrompt(items, liked, disliked, seen, rated, norel) {
  let s = 'You are the editor of a private daily news briefing for one person. You choose the few stories that will actually affect his life, money, business or health, and you explain each in one plain line.\n\n';
  s += 'WHO HE IS:\n' + PROFILE + '\n\n';
  s += 'THREE SECTIONS — put every story you keep into exactly one:\n'
    + '- TJM: relevant to his online jewellery business — jewellery, silver and gold prices, retail and consumer spending, e-commerce and marketplaces (Vinted, eBay, Etsy, TikTok Shop, Shopify, Amazon), postage, small-business tax and rules, selling online, marketing.\n'
    + '- NI: relevant to Nottingham Insurance, his insurance lead-generation side business for landlords, homebuyers and homeowners — home, buildings, landlord and life insurance, mortgages and rates, the housing and rental market, landlord rules and rental reform, FCA rules on insurance and lead generation, Nottingham property, and the questions those people are asking (useful as content ideas).\n'
    + '- YOU: genuinely interesting or useful to him personally — health, fitness and nutrition science, AI and tech, personal finance, Nottingham, self-improvement, and major UK or world events with a real effect on him.\n\n'
    + 'UK FIRST: he is in Nottingham, England. Strongly prefer UK stories. Include a US or other non-UK story only when it directly affects him (e.g. a platform he sells on changing worldwide, silver prices, a major AI tool he can use in the UK). US-only business, politics, regulation, retail or property news scores 0-2.\n\n';
  s += 'HOW TO CHOOSE:\n'
    + '- Score every story 0-10 for real, practical impact on HIM: would knowing this change a decision he makes about money, TJM, pricing, platforms, tax, his health, or where he lives? High scores need a concrete link, not a vague "the economy matters".\n'
    + '- Prefer actionable and opportunity-creating stories (a rule change he must follow, a cost going up, a platform shift, a trend he can sell into, a tool he can use).\n'
    + '- Big world or political events score high ONLY when they have a clear knock-on for him (e.g. prices, rates, supply of silver/gold, UK consumer spending). Horse-race politics, celebrity, crime, outrage and disaster coverage with no effect on him score 0-2.\n'
    + '- Learn from his feedback below: lean toward the kind of story he marked useful, away from the kind he marked not useful. Judge by topic and type of story, not exact wording.\n\n';
  if (liked.length) s += 'HE MARKED THESE USEFUL:\n' + liked.map(x => '+ [' + x.tag + '] ' + x.t).join('\n') + '\n\n';
  if (disliked.length) s += 'HE MARKED THESE NOT USEFUL:\n' + disliked.map(x => '- [' + x.tag + '] ' + x.t).join('\n') + '\n\n';
  if (rated && rated.length) s += 'HE RATED THESE STORIES OUT OF 10 AFTER HEARING THEM IN HIS BRIEFING (how relevant and interesting they were to him). Treat 8-10 as strongly wanted, 1-4 as not wanted, and judge by topic and type of story:\n' + rated.map(x => x.r + '/10 [' + x.tag + '] ' + x.t).join('\n') + '\n\n';
  if (norel && norel.length) s += 'HE COULD NOT SEE THE RELEVANCE OF THESE — the link you claimed was too weak, generic or a stretch. Each shows the story and the WHY you gave. Do not pick stories with this kind of tenuous link again; a similar story only qualifies if it has a direct, concrete effect on him:\n' + norel.map(x => '? [' + (x.sec || x.tag) + '] ' + x.t + (x.why ? '  (you said: ' + x.why + ')' : '')).join('\n') + '\n\n';
  if (seen && seen.length) s += 'HE HAS ALREADY SEEN THESE STORIES (earlier editions, or he marked them seen):\n' + seen.map(t => '* ' + t).join('\n') + '\n'
    + 'Leave out any story about the same event or announcement as one of these, even from a different outlet or with a different headline. Only include a follow-up if it reports a major new development, and then say in WHY what is new.\n\n';
  s += 'OUTPUT: Return up to 6 stories per section (up to 18 in total), only those scoring 5 or more — fewer is fine, never pad. One per line, best first within each section, exactly:\n'
    + 'ID | SECTION | SCORE | TAG | WHY\n'
    + 'SECTION must be TJM, NI or YOU. TAG must be one of: ' + TAGS.join(', ') + '.\n'
    + 'WHY is max 30 words, addressed to him ("you"): the concrete mechanism and the specific effect on him or his business, then what to do or watch if there is one. If you cannot name a concrete effect, the story scores 4 or less and is left out. Never use vague filler like "worth watching", "a reminder that", "backdrop", "could affect", "signals", "keep an eye on". No hype.\n'
    + 'Plain lines only: no table, no header row, no leading pipe, no numbering, no other text.';
  const list = items.map(it => it.id + ' | ' + it.source + ' | ' + it.title + (it.summary ? ' — ' + it.summary.slice(0, 160) : '')).join('\n');
  return { system: s, user: 'Today\'s stories:\n' + list };
}

// Tolerant line splitter: copes with markdown tables (leading/trailing pipes),
// bullets, numbering, bold and separator rows. Returns [id, ...fields] or null.
function splitRow(line, ids) {
  let l = String(line || '').replace(/\*\*|`/g, '').trim();
  if (!l || /^[|\s:-]+$/.test(l)) return null;                 // table separator row
  l = l.replace(/^[-•*]\s+/, '').replace(/^\d+[.)]\s+/, '').replace(/^\|/, '').replace(/\|\s*$/, '');
  const p = l.split('|').map(x => x.trim());
  if (p.length < 4) return null;
  const m = p[0].match(/([as]\d{1,3})/i);
  const id = m ? m[1].toLowerCase() : '';
  if (!ids.has(id)) return null;
  return [id, ...p.slice(1)];
}

function parseRanked(text, ids) {
  const out = [];
  const seen = new Set();
  String(text || '').split('\n').forEach(line => {
    const p = splitRow(line, ids);
    if (!p) return;
    const id = p[0];
    if (seen.has(id)) return;
    // ID | SECTION | SCORE | TAG | WHY  (older ID | SCORE | TAG | WHY still accepted)
    let sec = null;
    if (SECS.includes(String(p[1]).toUpperCase())) { sec = String(p[1]).toUpperCase(); p.splice(1, 1); }
    if (p.length < 4) return;
    const score = Math.max(0, Math.min(10, parseFloat(p[1]) || 0));
    const tg = TAGS.find(t => t.toLowerCase() === p[2].toLowerCase()) || 'UK';
    const why = p.slice(3).join(' | ').slice(0, 220);
    seen.add(id);
    out.push({ id, score, tag: tg, why, sec });
  });
  return out;
}

// Thinking is switched off: these are short formatting jobs, and on models that
// think by default the thinking can eat the whole token budget and leave an
// empty answer. If a model rejects the thinking flag, retry once without it.
// An empty answer throws, so the caller moves on to the next model.
// ── Cost tracking ──────────────────────────────────────────────────
// USD per million tokens (standard API list prices, Nov 2026). Unknown models
// are priced as Sonnet so the running total errs high rather than low.
const PRICES = {
  'claude-haiku-5-5':          { in: 0.10, out: 0.50, inLong: 0.50, outLong: 2.50 },
  'claude-haiku-4-5-20251001': { in: 1,    out: 5 },
  'claude-sonnet-5-5':         { in: 2,    out: 10 },
  'claude-sonnet-5':           { in: 2,    out: 10 },
};
let USAGE = { usd: 0, calls: 0 };    // reset per request in the handler
function addUsage(model, u) {
  if (!u) return;
  const p = PRICES[model] || { in: 2, out: 10 };
  const inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const long = p.inLong && inTok > 100000;
  USAGE.usd += (inTok * (long ? p.inLong : p.in) + (u.output_tokens || 0) * (long ? p.outLong : p.out)) / 1e6;
  USAGE.calls += 1;
}

async function callClaude(key, model, system, user, maxTokens) {
  const send = async (withThinkingOff) => {
    const body = { model, max_tokens: maxTokens || 1500, system, messages: [{ role: 'user', content: user }] };
    if (withThinkingOff) body.thinking = { type: 'disabled' };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    if (!r.ok) { const e = new Error('Anthropic ' + r.status + ' (' + model + '): ' + raw.slice(0, 200)); e.status = r.status; e.raw = raw; throw e; }
    const parsed = JSON.parse(raw);
    addUsage(model, parsed.usage);
    return parsed;
  };
  let data;
  try { data = await send(true); }
  catch (e) {
    if (e.status === 400 && /thinking/i.test(e.raw || '')) data = await send(false);
    else throw e;
  }
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) {
    const e = new Error('Empty reply from ' + model + ' (stop: ' + (data.stop_reason || '?') + ', blocks: ' + (data.content || []).map(b => b.type).join(',') + ')');
    e.empty = true; throw e;
  }
  return text;
}

// Current models first; older names kept as fallbacks. Override with NEWS_MODEL.
const MODELS = (envName) => [process.env[envName], 'claude-haiku-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-sonnet-5'].filter(Boolean);
// Stop trying other models only for problems that no model would fix.
const fatal = (e) => e && (e.status === 401 || e.status === 403 || e.status === 429);

// ── Second pass: a sharper "why it matters to you" per story ────────
// Reads the article and writes the line with a stronger model. It can also
// return DROP when there is no real, concrete link — then the story is removed.
const EXPLAIN_MODELS = () => [process.env.NEWS_EXPLAIN_MODEL, 'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-haiku-5-5', 'claude-haiku-4-5-20251001'].filter(Boolean);
const SECTION_DESC = {
  TJM: 'his online jewellery business TJM (silver and gold jewellery, Pandora charms, Vinted/eBay/website/TikTok sales, product photos, content)',
  NI: 'Nottingham Insurance, his insurance lead-generation side business for landlords, homebuyers and homeowners in Nottingham (content and SEO to win leads; his fiancée handles the leads)',
  YOU: 'him personally — money, health and fitness, AI tools, Nottingham life, his plans to move out and buy a home',
};

async function actionExplain(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(500, { error: 'Server is missing ANTHROPIC_API_KEY.' });
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  const st = payload.story || {};
  const sec = ['TJM', 'NI', 'YOU'].includes(st.sec) ? st.sec : 'YOU';
  const story = { title: clip(st.title, 220), source: clip(st.source, 40), summary: clip(st.summary, 400), why: clip(st.why, 240), link: clip(st.link, 500) };
  if (!story.title) return respond(400, { error: 'No story' });
  const norel = (Array.isArray(payload.norel) ? payload.norel : []).slice(0, 12).map(x => '- ' + clip(x.t, 140) + (x.why ? ' (the line was: ' + clip(x.why, 180) + ')' : '')).join('\n');
  const liked = (Array.isArray(payload.liked) ? payload.liked : []).slice(0, 12).map(x => '+ ' + clip(x.t, 140)).join('\n');
  const article = /^https?:\/\//.test(story.link) ? await articleText(story.link) : '';

  const system = 'You write the single "why this matters to you" line under a news story in one man\'s private news page. He is sharp, busy and impatient with vague relevance claims.\n\nWHO HE IS:\n' + PROFILE + '\n\n'
    + 'This story was filed under: ' + sec + ' = ' + SECTION_DESC[sec] + '.\n\n'
    + 'THE LINE MUST:\n'
    + '- Be addressed to him ("you"), 20-40 words, plain British English.\n'
    + '- Name the concrete mechanism from the story (a price, rule, rate, platform change, trend, number) AND the specific effect on him, his margins, his customers, his content, his money or his health.\n'
    + '- End with what to do or decide, or the specific thing to watch for and what it would mean — only if there genuinely is one.\n'
    + '- Use facts from the article only. No invented numbers.\n'
    + '- Never use filler: "worth watching", "a reminder that", "backdrop", "could affect", "signals", "keep an eye on", "in today\'s", "it\'s important to".\n\n'
    + 'BAD (too vague): "JLR\'s loss points to weak UK consumer demand, a backdrop worth watching for spending on gifts and jewellery."\n'
    + 'BAD (a stretch): "UK-EU food trade deal is a reminder that trade rules shift and could ease some of your supplier friction." (he does not import food or plants)\n'
    + 'GOOD: "Silver is up about 9% this month, so your next restock of 925 chains costs more. Check the margin on anything under £30 before reordering, or nudge those prices up now."\n'
    + 'GOOD: "Landlords now need X by April — exactly the question your Nottingham landlord audience will be Googling. A short explainer post this week could rank before the rush."\n\n'
    + 'If, after reading the article, there is NO direct, concrete effect on him in this section, reply with exactly: DROP\n'
    + (norel ? 'He could NOT see the relevance of these earlier picks — don\'t make links this weak:\n' + norel + '\n\n' : '')
    + (liked ? 'He found these useful:\n' + liked + '\n\n' : '')
    + 'Reply with the line only (or DROP). No quotes, no label, no markdown.';
  const user = 'HEADLINE: ' + story.title + '\nSOURCE: ' + story.source + '\nFEED SUMMARY: ' + story.summary + '\nFIRST DRAFT OF THE LINE (improve on it, or DROP): ' + story.why
    + '\n\nARTICLE TEXT (may be partial or empty):\n' + (article || '(not available — rely on the headline and summary, and keep the claim modest)');

  let lastErr = null;
  for (const m of EXPLAIN_MODELS()) {
    try {
      let text = (await callClaude(key, m, system, user, 220)).replace(/^["'“]|["'”]$/g, '').replace(/^(why[^:]*:|line:)\s*/i, '').trim();
      if (/^DROP\b/i.test(text)) return respond(200, { drop: true, model: m });
      if (text) return respond(200, { why: text.slice(0, 320), model: m, hadArticle: !!article });
    } catch (e) {
      lastErr = e;
      if (fatal(e)) break;
    }
  }
  return respond(502, { error: String(lastErr && lastErr.message || 'Explain failed').slice(0, 300) });
}

async function actionRank(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(500, { error: 'Server is missing ANTHROPIC_API_KEY.' });
  const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 140).map(x => ({
    id: String(x.id || '').slice(0, 8), title: String(x.title || '').slice(0, 220),
    summary: String(x.summary || '').slice(0, 200), source: String(x.source || '').slice(0, 40),
  })).filter(x => x.id && x.title);
  if (!items.length) return respond(400, { error: 'No stories to rank.' });
  const clean = arr => (Array.isArray(arr) ? arr : []).slice(0, 40).map(x => ({ t: String(x.t || '').slice(0, 160), tag: String(x.tag || '').slice(0, 20) })).filter(x => x.t);
  const seen = (Array.isArray(payload.seen) ? payload.seen : []).slice(0, 80).map(t => String(t || '').slice(0, 160)).filter(Boolean);
  const rated = (Array.isArray(payload.rated) ? payload.rated : []).slice(0, 40).map(x => ({ t: String(x.t || '').slice(0, 160), tag: String(x.tag || '').slice(0, 20), r: Math.max(1, Math.min(10, parseInt(x.r, 10) || 0)) })).filter(x => x.t && x.r);
  const norel = (Array.isArray(payload.norel) ? payload.norel : []).slice(0, 30).map(x => ({ t: String(x.t || '').slice(0, 160), tag: String(x.tag || '').slice(0, 20), sec: String(x.sec || '').slice(0, 6), why: String(x.why || '').slice(0, 220) })).filter(x => x.t);
  const { system, user } = buildPrompt(items, clean(payload.liked), clean(payload.disliked), seen, rated, norel);
  const ids = new Set(items.map(x => x.id));

  const models = MODELS('NEWS_MODEL');
  let lastErr = null;
  for (const m of models) {
    try {
      const text = await callClaude(key, m, system, user, 2600);
      const ranked = parseRanked(text, ids);
      if (ranked.length) return respond(200, { ranked, model: m });
      console.error('[news rank] unparsed reply:', text.slice(0, 800));
      lastErr = new Error('The AI reply couldn\'t be read. It said: "' + text.replace(/\s+/g, ' ').slice(0, 160) + '"');
    } catch (e) {
      lastErr = e;
      // Only fall through to the next model when this one isn't available.
      if (fatal(e)) break;
    }
  }
  return respond(502, { error: String(lastErr && lastErr.message || 'Ranking failed').slice(0, 300) });
}

// ── Weekly AI-for-TJM ranking ──────────────────────────────────────
function buildAiPrompt(items, liked, disliked, tried) {
  let s = 'You write a short weekly "AI for my business" briefing for one person. Your job is to stop him feeling he is falling behind on AI, by showing him only the few things from this week he can actually use now, each with one concrete thing to try.\n\n';
  s += 'WHO HE IS:\n' + PROFILE + '\nHe is comfortable with ChatGPT/Claude-style chat tools and builds small web apps with AI help. He is not a developer by trade and has a part-time assistant for content.\n\n';
  s += 'HOW TO CHOOSE:\n'
    + '- Pick the 3 to 5 most useful items. Always return at least 3: on a quiet week, choose the most practical ones available. Prefer things a one-person UK online jewellery business could start using THIS WEEK: new tools, new features in tools he likely uses, model releases that change what is possible, marketplace/e-commerce AI features, or a proven practical tactic.\n'
    + '- Skip: funding rounds, valuations, lawsuits, company drama, chip/stock news, research papers, enterprise-only or US-only products, speculation about AGI, and anything that only matters to developers.\n'
    + '- Favour things that save him time or make money: product photos and descriptions, listings (website, Vinted, eBay, Etsy, TikTok Shop), short video and TikTok lives, customer service, email marketing, ads, bookkeeping, planning, and getting more out of his assistant.\n'
    + '- Learn from his feedback below.\n\n';
  if (liked.length) s += 'HE FOUND THESE USEFUL BEFORE:\n' + liked.map(x => '+ ' + x.t).join('\n') + '\n\n';
  if (disliked.length) s += 'HE FOUND THESE NOT USEFUL:\n' + disliked.map(x => '- ' + x.t).join('\n') + '\n\n';
  if (tried.length) s += 'THINGS HE HAS ALREADY TRIED (don\'t repeat the same suggestion):\n' + tried.map(x => '* ' + x.t).join('\n') + '\n\n';
  s += 'OUTPUT: one item per line, most useful first, exactly:\n'
    + 'ID | KIND | WHAT | TRY\n'
    + 'KIND is one of: ' + AI_KINDS.join(', ') + '.\n'
    + 'WHAT: max 22 words, plain English: what is new and what it does. No hype words.\n'
    + 'TRY: max 30 words, addressed to him ("you"), one specific 15-30 minute experiment in TJM, naming the tool and the exact task (e.g. "Paste 5 Vinted listings into X and ask it to rewrite the titles for search; compare views next week").\n'
    + 'Plain lines only: no table, no header row, no leading pipe, no numbering, no other text.';
  const list = items.map(it => it.id + ' | ' + it.source + ' | ' + it.title + (it.summary ? ' — ' + it.summary.slice(0, 180) : '')).join('\n');
  return { system: s, user: 'This week\'s AI stories:\n' + list };
}

function parseAi(text, ids) {
  const out = [];
  const seen = new Set();
  String(text || '').split('\n').forEach(line => {
    const p = splitRow(line, ids);
    if (!p) return;
    const id = p[0];
    if (seen.has(id)) return;
    const kind = AI_KINDS.find(k => k.toLowerCase() === p[1].toLowerCase()) || 'Tool';
    seen.add(id);
    out.push({ id, kind, what: p[2].slice(0, 220), try: p.slice(3).join(' | ').slice(0, 300) });
  });
  return out.slice(0, 5);
}

async function actionAiRank(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(500, { error: 'Server is missing ANTHROPIC_API_KEY.' });
  const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 120).map(x => ({
    id: String(x.id || '').slice(0, 8), title: String(x.title || '').slice(0, 220),
    summary: String(x.summary || '').slice(0, 220), source: String(x.source || '').slice(0, 40),
  })).filter(x => x.id && x.title);
  if (!items.length) return respond(400, { error: 'No stories to rank.' });
  const clean = arr => (Array.isArray(arr) ? arr : []).slice(0, 30).map(x => ({ t: String(x.t || '').slice(0, 200) })).filter(x => x.t);
  const { system, user } = buildAiPrompt(items, clean(payload.liked), clean(payload.disliked), clean(payload.tried));
  const ids = new Set(items.map(x => x.id));
  const models = MODELS('NEWS_MODEL');
  let lastErr = null;
  for (const m of models) {
    try {
      const text = await callClaude(key, m, system, user);
      const ranked = parseAi(text, ids);
      if (ranked.length) return respond(200, { ranked, model: m });
      console.error('[news airank] unparsed reply:', text.slice(0, 800));
      lastErr = new Error('The AI reply couldn\'t be read (' + items.length + ' stories sent). It said: "' + text.replace(/\s+/g, ' ').slice(0, 160) + '"');
    } catch (e) {
      lastErr = e;
      if (fatal(e)) break;
    }
  }
  return respond(502, { error: String(lastErr && lastErr.message || 'Ranking failed').slice(0, 300) });
}

// ── Spoken daily briefing ──────────────────────────────────────────
async function articleText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', Accept: 'text/html' } });
    if (!r.ok) return '';
    const html = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
    const paras = (html.match(/<p[\s>][\s\S]*?<\/p>/gi) || []).map(decode).filter(x => x.length > 60);
    return paras.join('\n').slice(0, 9000);
  } catch (e) { return ''; } finally { clearTimeout(t); }
}

const SPOKEN_RULES = [
  'This text will be read aloud by a text-to-speech app while he commutes or eats breakfast. Write for the ear:',
  '- Plain flowing prose, conversational, like a sharp, well-informed friend briefing him. British English.',
  '- No markdown, no headings, no bullet points, no emojis, no URLs, no brackets, no tables.',
  '- Short-to-medium sentences. Say numbers the way you would say them out loud ("two point five billion pounds").',
  '- Accuracy first: only state facts about the news that appear in the material given. Background and explanation must be well-established general knowledge. If a detail is not in the material, don\'t invent it — say what is known and what to watch for.',
  '- No hype, no fear-mongering, no filler like "in today\'s fast-paced world". Be direct and specific.',
].join('\n');

function briefPrompt(p) {
  const who = 'WHO HE IS:\n' + PROFILE + '\n\n' + SPOKEN_RULES + '\n\n';
  const words = Math.max(120, Math.min(650, parseInt(p.words, 10) || 400));
  const heads = (p.headlines || []).map((h, i) => (i + 1) + '. ' + h.title + (h.why ? ' — ' + h.why : '')).join('\n');
  if (p.part === 'intro') {
    return { system: 'You are writing the opening of Robert\'s personal daily audio briefing.\n\n' + who,
      user: 'Today is ' + p.dateLabel + '. Write the opening of the news section, about ' + words + ' words. '
        + (p.noGreeting ? 'He has already been greeted and has just heard his mindset segments, so do NOT greet him; begin with "Now, today\'s news." ' : 'Greet him by name. ')
        + 'Then give a quick spoken rundown of what\'s coming: one sentence per story below, saying why it is worth his attention. End by saying there\'s a short lesson and a quick recall quiz at the end. Do not go into detail yet.\n\nToday\'s stories, in order:\n' + heads };
  }
  if (p.part === 'story') {
    const st = p.story || {};
    return { system: 'You are writing one segment of Robert\'s personal daily audio briefing: a deep dive on a single story that educates him, not just informs him.\n\n' + who,
      user: 'Write about ' + words + ' words on this story. Do NOT start with "story one" or any numbering, and do not greet him — the segment is introduced for you. Structure it naturally as spoken prose:\n'
        + '1) What happened, clearly and concretely.\n2) The background he needs to really understand it — explain any concept, mechanism or term as if teaching a smart person who is not a specialist (e.g. how something works, why it happens, the history in a sentence or two).\n'
        + '3) Why it matters to him specifically — his money, TJM, his plans, his health — and, if there is one, a practical thing he could do or watch for.\n'
        + '4) One sentence on what would change the picture, or the other side of the argument, so he thinks rather than just absorbs.\n\n'
        + 'HEADLINE: ' + (st.title || '') + '\nSOURCE: ' + (st.source || '') + '\nWHY IT WAS PICKED FOR HIM: ' + (st.why || '') + '\nFEED SUMMARY: ' + (st.summary || '')
        + '\n\nARTICLE TEXT (may be partial or empty):\n' + (p.article || '(not available — work from the headline and summary only, and keep factual claims to what they say)') };
  }
  if (p.part === 'stoic') {
    const q = p.stoic || {};
    return { system: 'You are writing the Stoic wisdom segment that opens Robert\'s personal daily audio briefing. It should leave him calmer, clearer and more resolved for the day — practical philosophy, not a lecture.\n\n' + who,
      user: 'About ' + words + ' words, based on today\'s quote. Do not greet him. Start by reading the quote and saying who said it. Then: a little about the person and the situation they were writing from, kept to well-established facts; what the idea really means, in plain language; then apply it concretely to four parts of his life — the man he is becoming (character, discipline, how he treats the people closest to him), as a leader (leading his small team and himself), growing TJM, and his health and habits. Finish with one specific way to practise it today, something he can actually do before tonight. You may quote other Stoics only with short, well-known lines you are sure of; otherwise paraphrase.\n\n'
        + 'QUOTE: "' + (q.text || '') + '" — ' + (q.author || '') + '\nHIS DASHBOARD\'S TAKE ON IT (use as a starting point, don\'t just repeat it): ' + (q.interpretation || '') };
  }
  if (p.part === 'sll') {
    const c = p.sll || {};
    const title = c.name || ((c.sl || '') + (c.trap ? ' versus ' + c.trap : ''));
    return { system: 'You are writing the Straight Line Leadership segment of Robert\'s personal daily audio briefing. He is working through Dusan Djukich\'s book Straight-Line Leadership, one principle a day, and wants to turn it into action, not just understanding.\n\n' + who
        + '\nDo not quote the book or claim exact wording from it; explain the ideas in your own words.\n',
      user: 'About ' + words + ' words on today\'s principle. Do not greet him. Begin with "Today\'s Straight Line principle is" and name it. Explain the distinction clearly with an everyday example; describe exactly how the wrong side shows up in a normal day of his — the self-talk, the behaviour, the moment it happens; then apply the straight-line side to leading his small team, to TJM sales and content, and to his own standards. Make it direct and a little challenging. End by putting today\'s question to him and telling him the one move to make today.\n\n'
        + 'PRINCIPLE: ' + title + '\nESSENCE: ' + (c.essence || '') + '\nDEEPER: ' + (c.deep || '') + '\nHOW THE WRONG SIDE SHOWS UP: ' + (c.effect || '') + '\nTHE MOVE: ' + (c.move || '') + '\nFOR HIM: ' + (c.mine || '') + '\nTODAY\'S QUESTION: ' + (c.apply || '') };
  }
  if (p.part === 'success') {
    return { system: 'You are writing the "success habit" segment of Robert\'s personal daily audio briefing.\n\n' + who
        + '\nAccuracy rule: only attribute habits, practices and facts to a person when they are well documented (their own books, interviews, biographies). Never invent quotes; if you are not sure of exact wording, paraphrase and say "he has said that" or "she describes". If you are unsure about a detail, leave it out.\n',
      user: 'About ' + words + ' words. Pick ONE specific, well-documented habit, practice or principle used by someone genuinely and verifiably successful — a founder, retailer, investor, athlete, creator or leader — that would help Robert a lot right now, given his goals and his stated struggle with strong starts followed by inconsistency. Vary the kind of person and the area over time (sales, focus, consistency, leadership, money, health, learning, decision-making). Do not use any of these recent picks: ' + ((p.avoid || []).join('; ') || 'none') + '.\n'
        + 'Do not greet him. Start with "Today\'s success habit comes from" and name the person. Say who they are and what they built, describe the habit exactly as they practise it, explain why it works (cite the mechanism or research where there is solid evidence), then give him a concrete way to adapt it to his life and TJM this week, starting today, and how he will know it is working. On the very last line, write TOPIC: followed by the habit and the person in under eight words (this line will be removed before reading).' };
  }
  if (p.part === 'retention') {
    const r = p.ret || {};
    return { system: 'You are writing the semen retention check-in segment of Robert\'s personal daily audio briefing. He practises semen retention (no porn, no masturbation) as a discipline and tracks his streak on his dashboard. He wants direct, science-based reasoning, not hype or motivational fluff.\n\n' + who
        + '\nEVIDENCE RULES — be honest about what is and isn\'t known:\n'
        + '- Well supported: quitting porn and compulsive habits frees time and attention; practising delayed gratification and urge control builds self-trust; better sleep, less late-night phone use and less dopamine-chasing help focus and mood.\n'
        + '- Weak or limited: a small 2003 study (Jiang et al.) found a testosterone rise peaking around day 7 of abstinence before returning to baseline; it is a single small study, so present it as such. Do not claim large lasting testosterone gains.\n'
        + '- Not supported: energy transmutation, myelin or "full neurological rewiring", magnetism, special powers. Never state these as fact. If they come up, say plainly that the evidence isn\'t there.\n'
        + '- Treat the real benefit as character and self-control: keeping a promise to himself, every day.\n',
      user: 'About ' + words + ' words. Do not greet him. Open with where he is today: his streak is ' + (r.streak || 0) + ' day' + (r.streak === 1 ? '' : 's') + (r.tickedToday ? ' (already ticked today)' : '') + ', and he ticked it on ' + (r.last14 || 0) + ' of the last 14 days. '
        + (r.streak ? 'Acknowledge the run plainly, without overpraising. ' : 'If the streak is zero or broken, no shame and no lecture: reset calmly and focus on today. ')
        + 'Then: one honest, evidence-based benefit worth remembering today; then three specific, practical tips for staying on track today — e.g. trigger management (phone out of the bedroom, app blockers, no scrolling in bed), what to do in the first two minutes of an urge (urge surfing, cold water on the face, push-ups, leave the room), how to use the extra drive on training and TJM work, and what to do after a slip so one slip doesn\'t become a week. Vary the tips day to day. If his check-ins below show a pattern (low energy, high urges, a note about a trigger), speak to it directly. End with one sentence on why keeping this promise matters for the man he is becoming.\n\n'
        + 'HIS RECENT CHECK-INS (newest first; "urges" is his libido score):\n' + ((r.log || []).join('\n') || '(none logged)') };
  }
  if (p.part === 'goals') {
    return { system: 'You are writing the "what you\'re working towards" segment of Robert\'s personal daily audio briefing. It reminds him of his own goals so he starts the day pointed at them. He wrote these goals himself in his Road to 30 plan: a reverse-engineered ladder from his 30th birthday (12 August 2027) back to this week.\n\n' + who,
      user: 'Today is ' + (p.dateLabel || '') + '. About ' + words + ' words. Do not greet him. Use HIS words and goals below — do not invent goals he hasn\'t written. Start with the big picture: what he wants to be true at 30, in a few sentences. Then walk down the ladder briefly, saying the next milestone and how many weeks away it is. Then focus on THIS WEEK: what is done, what isn\'t, and which unticked item matters most today and why. Be honest if he is behind — say so plainly and what to do about it today. Items marked [x] are done, [ ] are not. If the plan is empty or thin, say so and tell him to write this week\'s steps today, using the goals from his profile as a starting point. End with one clear instruction for today.\n\n'
        + 'HIS ROAD TO 30 PLAN:\n' + (p.goals || '(empty)') };
  }
  if (p.part === 'gym') {
    const g = p.gym || {};
    return { system: 'You are writing the gym and body progress segment of Robert\'s personal daily audio briefing. It is built from the live stats on his dashboard\'s home page. He wants direct, evidence-based coaching: numbers, what they mean, what to do.\n\n' + who
        + '\nAccuracy: only use numbers that appear in the home page text below. Do not invent figures. If a figure is missing, skip it. Round sensibly when speaking.\n',
      user: (p.weekly ? 'It is Sunday, so frame this as the week: how the week went for training, food, sleep and steps, and what next week needs. ' : '') + 'About ' + words + ' words. Do not greet him. His gym streak is ' + (g.streak || 0) + ' day' + (g.streak === 1 ? '' : 's') + ' and he trained on ' + (g.last14 || 0) + ' of the last 14 days. Using the home page stats below, cover: where his weight and body fat are versus his goal and the projected pace, and whether he is on track; his calorie deficit this week and what that pace means for results; sleep, steps and waist trends if shown; and any don\'t-miss-twice warning. Explain the why briefly where it helps (e.g. why weekly averages beat single weigh-ins, why sleep affects fat loss and hunger). Then give him today\'s two or three specific actions for training, food and recovery. Tie it back to his goal for 30 in one sentence. No lift-by-lift advice; he logs workouts in a separate app.\n\n'
        + 'HIS HOME PAGE STATS (as shown on his dashboard today):\n' + (p.home || '(not available — say the stats could not be read today and keep this short and general)') };
  }
  if (p.part === 'tjm') {
    return { system: 'You are writing a "TJM playbook" segment of Robert\'s personal daily audio briefing: one practical, specific play to grow TJM, with steps he can take today. He loves practical tips and concrete steps, not theory — but only steps that fit where the business actually is right now.\n\n' + who
        + '\nRules: be specific to a small UK online jewellery business selling hallmarked silver, pre-owned silver on Vinted, and Pandora charms through its own website, Vinted, eBay, email and TikTok. Name exact actions, numbers, scripts or templates where useful. Only cite statistics or case studies you are confident are real; otherwise give the reasoning instead. No generic advice like "post consistently" without saying exactly how.\n'
        + '\nSTART FROM WHERE HE IS — this matters more than anything else:\n'
        + '- Read "WHERE TJM IS RIGHT NOW" and his plan for this week first. Work out his current stage and his real bottleneck.\n'
        + '- The play must be the next logical step from that position. Never assume things he does not have yet: no ads before there are listings and proof they sell, no email automation before there is a list, no scaling, hiring or new channels before the basics are producing sales. If a play needs something that is not in place, give the step that builds that missing piece instead.\n'
        + '- Prefer plays that unblock or speed up what is already on his plan this week over brand-new projects. If the best play would compete with his plan, say what to drop or move, or pick something smaller.\n'
        + '- Size it to his real time: a few focused blocks around a full day in the shop, plus his part-time assistant for repetitive work.\n'
        + (p.now ? '' : '- He has not described where TJM is right now, so keep the play to fundamentals that are valid at any early stage, and say in one sentence at the start that filling in "TJM right now" on the briefing page would make these plays sharper.\n'),
      user: 'About ' + words + ' words. Do not greet him. Suggested area for today: ' + (p.focus || 'sales') + ' — use it only if it fits his current stage; otherwise pick the area that matters most for his bottleneck right now. Pick ONE play. Do not repeat these recent plays: ' + ((p.avoid || []).join('; ') || 'none') + '.\n'
        + 'Structure, as spoken prose: open with one or two sentences saying where he is right now and why this play is the right next step from there (refer to specifics from the context below, not generalities); name the play in one line; why it works (the mechanism: buyer psychology, maths or platform behaviour); the exact steps to do it today or this week, numbered out loud as first, second, third, with any wording he can use word for word, and how it fits around what is already on his plan; how long it takes; what result to look for and when to judge it; what it sets up next once it works; and one common mistake to avoid. If part of it can be handed to his assistant, say exactly what to hand over.\n'
        + 'On the very last line, write TOPIC: followed by the play in under eight words (this line will be removed before reading).\n\n'
        + 'WHERE TJM IS RIGHT NOW (written by him' + (p.nowAge ? ', updated ' + p.nowAge : '') + '):\n' + (p.now || '(not filled in)') + '\n\n'
        + 'HIS PLAN THIS WEEK (Road to 30 weekly steps; [x] = done):\n' + (p.weekPlan || '(nothing written for this week)') + '\n\n'
        + 'HIS GOALS (for context):\n' + (p.goals || '') };
  }
  if (p.part === 'followup') {
    return { system: 'You are writing the "yesterday\'s follow-through" segment of Robert\'s personal daily audio briefing. Its job is accountability: what he said he would do yesterday versus what he actually did. Direct and honest, never harsh or shaming. He wants science-based reasoning, not motivational fluff.\n\n' + who,
      user: 'About ' + words + ' words. Do not greet him. Using only the data below, say plainly what got done and what didn\'t yesterday. Credit what was done in one sentence, no gushing. For anything planned and missed, ask the useful question — was it too big, scheduled at a bad time, blocked, or avoided — and say exactly when it should happen now (today, at a specific time, or moved to a named day this week). If nothing was planned for a specific time, say so and explain briefly why writing a day and time next to a task (an implementation intention) roughly doubles follow-through in studies, and tell him to do that for today. Finish with one line linking yesterday to today.\n\n'
        + 'DATA:\n' + (p.follow || '(nothing recorded)') };
  }
  if (p.part === 'top3') {
    return { system: 'You are writing the "today\'s top three" segment near the end of Robert\'s personal daily audio briefing. It decides the three things that matter most today so he starts the day with them already chosen.\n\n' + who,
      user: 'About ' + words + ' words. Do not greet him. Choose exactly three things for today from his own plan below — prefer what is planned for today, then what slipped yesterday, then the open weekly items that move him most toward his goals. At least one should grow TJM revenue. '
        + (p.sunday ? 'It is Sunday: one of the three should be writing next week\'s Road to 30 steps with a day and time for each, and one should be recovery or time with family. ' : '')
        + 'Say each one as a clear action with when he will do it, and one sentence on why it is in the top three. Keep it tight. End with: "Do the first one before you open anything else."\n'
        + 'On the very last line, write TOP: followed by the three actions separated by " | " (each under 12 words; this line is removed before reading).\n\n'
        + 'HIS PLAN:\n' + (p.top || '(empty)') + '\n\nYESTERDAY:\n' + (p.follow || '') };
  }
  if (p.part === 'weekreview') {
    return { system: 'You are writing the "week in review" segment of Robert\'s Sunday audio briefing. Honest, numbers-first, direct. He wants science-based reasoning, not motivational narrative.\n\n' + who
        + '\nOnly use numbers that appear in the data below. Do not invent figures.\n',
      user: 'About ' + words + ' words. Do not greet him. Give him his week in numbers: gym, retention, meditation, his Road to 30 steps ticked against planned, and how that compares with earlier weeks. Then the pattern behind the numbers — which days slipped and what they have in common, if anything. If he wrote his own review, use his words and build on them. Mention which parts of his briefings he rated highest this week, if given. Then the single biggest lesson from this week, and the one thing to change next week. Be honest if it was a weak week; say what a strong week would have looked like in numbers.\n\n'
        + 'THIS WEEK:\n' + (p.week || '(no data)') };
  }
  if (p.part === 'weeknext') {
    return { system: 'You are writing the "setting up next week" segment of Robert\'s Sunday audio briefing. It helps him plan next week\'s Road to 30 steps so the week is decided before it starts.\n\n' + who,
      user: 'About ' + words + ' words. Do not greet him. Start from his next milestone on the ladder and how many weeks are left to it. Propose five to seven specific steps for next week that would put him on track — a mix of TJM revenue work, training and body, and life — each with a suggested day and time. Use his own goals and wording; build on what was missed this week rather than starting over; keep the total realistic for a week where he also works in his father\'s shop daily. If he already has steps planned for next week, review them instead and tighten them. Tell him to put them into the This-week step of his Road to 30 plan today, with the day and time on each.\n\n'
        + 'NEXT WEEK AND HIS PLAN:\n' + (p.next || '') + '\n\nTHIS WEEK FOR CONTEXT:\n' + (p.week || '') };
  }
  if (p.part === 'weekclose') {
    return { system: 'You are writing the closing segment of Robert\'s Sunday audio briefing.\n\n' + who,
      user: 'About ' + words + ' words. Do not greet him. Ask him three reflection questions, one at a time, with a pause after each ("Take a moment."): what got done this week, what didn\'t and why, and the one priority that moves him closest to 30 next week. Tell him to write his answers into the weekly review in his Road to 30 plan today. Then a short, grounded sign-off for the week — rest, family and getting ready for Monday. No motivational clichés.' };
  }
  if (p.part === 'learn') {
    return { system: 'You are writing the "lesson of the day" segment of Robert\'s personal daily audio briefing. Its job is to sharpen his thinking and build lasting knowledge.\n\n' + who,
      user: 'Pick ONE durable idea that connects to today\'s stories and is useful to someone building a business and his own finances — e.g. a concept from economics, finance, accounting, pricing, marketing, consumer psychology, negotiation, decision-making, or the science of habits and health. Avoid repeating these recent topics: ' + ((p.avoid || []).join('; ') || 'none') + '.\n'
        + 'Write about ' + words + ' words: start with "Today\'s lesson is" and name the idea; explain it clearly with one vivid everyday example; show how it applies to one of today\'s stories; then give him one specific way to use it in TJM or his life this week. On the very last line, write LESSON: followed by the idea\'s name in under six words (this line will be removed before reading).\n\nToday\'s stories:\n' + heads };
  }
  if (p.part === 'ai') {
    const a = p.ai || {};
    return { system: 'You are writing a short segment of Robert\'s personal daily audio briefing about using AI in his business.\n\n' + who,
      user: 'About ' + words + ' words. Remind him of this week\'s AI experiment he hasn\'t tried yet, explain briefly what the tool or feature does, and talk him through exactly how to do the experiment today, step by step in spoken form, and what result would tell him it\'s worth keeping. Don\'t start with a greeting.\n\nWHAT\'S NEW: ' + (a.title || '') + ' — ' + (a.what || '') + '\nTHE EXPERIMENT: ' + (a.try || '') };
  }
  if (p.part === 'close') {
    return { system: 'You are writing the closing segment of Robert\'s personal daily audio briefing. It uses active recall, because testing yourself makes information stick far better than re-reading.\n\n' + who,
      user: 'About ' + words + ' words. First, a quick recall quiz: ask three short questions about today\'s stories below, one at a time. After each question write "Have a think." then on the next sentence give the answer. Questions must be answerable from the story lines below. Then give him one reflection question to think about on his way in, linked to his goals. End with a brief, grounded sign-off — no motivational clichés.\n\nToday\'s stories:\n' + heads };
  }
  return null;
}

async function actionBrief(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(500, { error: 'Server is missing ANTHROPIC_API_KEY.' });
  const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
  const p = {
    part: clip(payload.part, 16), words: payload.words, dateLabel: clip(payload.dateLabel, 40),
    headlines: (Array.isArray(payload.headlines) ? payload.headlines : []).slice(0, 12).map(h => ({ title: clip(h.title, 220), why: clip(h.why, 220) })),
    story: payload.story ? { title: clip(payload.story.title, 220), source: clip(payload.story.source, 40), why: clip(payload.story.why, 220), summary: clip(payload.story.summary, 400), link: clip(payload.story.link, 500) } : null,
    noGreeting: !!payload.noGreeting,
    stoic: payload.stoic ? { text: clip(payload.stoic.text, 400), author: clip(payload.stoic.author, 60), interpretation: clip(payload.stoic.interpretation, 500) } : null,
    sll: payload.sll ? { name: clip(payload.sll.name, 80), sl: clip(payload.sll.sl, 60), trap: clip(payload.sll.trap, 60), essence: clip(payload.sll.essence, 300), deep: clip(payload.sll.deep, 600), effect: clip(payload.sll.effect, 400), move: clip(payload.sll.move, 300), mine: clip(payload.sll.mine, 400), apply: clip(payload.sll.apply, 300) } : null,
    ai: payload.ai ? { title: clip(payload.ai.title, 220), what: clip(payload.ai.what, 260), try: clip(payload.ai.try, 320) } : null,
    avoid: (Array.isArray(payload.avoid) ? payload.avoid : []).slice(0, 30).map(x => clip(x, 60)),
    ret: payload.ret ? { streak: Math.max(0, parseInt(payload.ret.streak, 10) || 0), tickedToday: !!payload.ret.tickedToday, last14: Math.max(0, parseInt(payload.ret.last14, 10) || 0), log: (Array.isArray(payload.ret.log) ? payload.ret.log : []).slice(0, 7).map(x => clip(x, 320)) } : null,
    gym: payload.gym ? { streak: Math.max(0, parseInt(payload.gym.streak, 10) || 0), last14: Math.max(0, parseInt(payload.gym.last14, 10) || 0) } : null,
    goals: clip(payload.goals, 5000),
    home: clip(payload.home, 7000),
    focus: clip(payload.focus, 80),
    now: clip(payload.now, 3000), nowAge: clip(payload.nowAge, 40), weekPlan: clip(payload.weekPlan, 2000),
    follow: clip(payload.follow, 3000),
    top: clip(payload.top, 3000),
    week: clip(payload.week, 6000),
    next: clip(payload.next, 6000),
    sunday: !!payload.sunday,
    weekly: !!payload.weekly,
  };
  if (p.part === 'story' && p.story && /^https?:\/\//.test(p.story.link)) p.article = await articleText(p.story.link);
  const pr = briefPrompt(p);
  if (!pr) return respond(400, { error: 'Unknown briefing part' });
  const rated = (Array.isArray(payload.rated) ? payload.rated : []).slice(0, 25)
    .map(x => ({ t: clip(x.t, 160), r: Math.max(1, Math.min(10, parseInt(x.r, 10) || 0)) })).filter(x => x.t && x.r);
  if (rated.length) pr.system += '\n\nHOW HE RATED PAST SEGMENTS OF THIS KIND (out of 10, for how relevant and interesting they were to him):\n'
    + rated.map(x => x.r + '/10 — ' + x.t).join('\n')
    + '\nLean toward what he rated 8-10 (in subject, angle, depth and how practical it is) and away from what he rated 1-4. Do not mention these ratings in the script.';
  const words = Math.max(120, Math.min(650, parseInt(p.words, 10) || 400));
  const models = MODELS('NEWS_BRIEF_MODEL');
  let lastErr = null;
  for (const m of models) {
    try {
      let text = (await callClaude(key, m, pr.system, pr.user, Math.round(words * 1.9) + 80)).trim();
      let lesson = null, top = null;
      const tm = text.match(/\n?\s*TOP:\s*(.+)\s*$/i);
      if (tm) { top = tm[1].split('|').map(x => x.trim().replace(/^\d+[.)]\s*/, '')).filter(Boolean).slice(0, 3); text = text.slice(0, tm.index).trim(); }
      const lm = text.match(/\n?\s*(?:LESSON|TOPIC):\s*(.+)\s*$/i);
      if (lm) { lesson = lm[1].trim().slice(0, 60); text = text.slice(0, lm.index).trim(); }
      text = text.replace(/[*#_`]/g, '').replace(/^\s*[-•]\s+/gm, '').trim();
      if (text) return respond(200, { text, lesson, top, model: m, hadArticle: !!p.article });
      lastErr = new Error('Empty section');
    } catch (e) {
      lastErr = e;
      if (fatal(e)) break;
    }
  }
  return respond(502, { error: String(lastErr && lastErr.message || 'Briefing failed').slice(0, 300) });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return respond(200, { ok: true });
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) { return respond(400, { error: 'Bad JSON body' }); }
  USAGE = { usd: 0, calls: 0 };
  const withCost = (res) => {
    if (!USAGE.calls || !res || !res.body) return res;
    try { const b = JSON.parse(res.body); b.cost = { usd: USAGE.usd, calls: USAGE.calls, action: String(payload.action || '') }; res.body = JSON.stringify(b); } catch (e) {}
    return res;
  };
  try {
    return withCost(await route());
  } catch (e) {
    console.error('[news]', e);
    return withCost(respond(500, { error: String(e.message || e).slice(0, 300) }));
  }
  async function route() {
    if (payload.action === 'feeds') return await actionFeeds(payload.set);
    if (payload.action === 'airank') return await actionAiRank(payload);
    if (payload.action === 'brief') return await actionBrief(payload);
    if (payload.action === 'rank') return await actionRank(payload);
    if (payload.action === 'explain') return await actionExplain(payload);
    return respond(400, { error: 'Unknown action' });
  }
};
