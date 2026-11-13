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
//   POST { action:'rank', items:[{id,title,summary,source}], liked:[], disliked:[] }
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

const TAGS = ['Money', 'Business', 'Retail', 'Jewellery', 'Tech & AI', 'Health', 'Nottingham', 'UK', 'World'];

const PROFILE = [
  'Robert, 29, lives in Nottingham, UK, with his family. Engaged; hoping to move out and eventually buy a home.',
  'Founder of TJM (The Jewellery Merchant), a small online jewellery brand: new hallmarked silver, pre-owned silver sold on Vinted, Pandora charms, his own website, product photography, email marketing and TikTok lives/short video. He has a part-time assistant who edits and posts content.',
  'Also works daily in his father\'s long-established independent jewellery shop.',
  'Qualified accountant by background, so comfortable with numbers, tax and finance detail.',
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
  const capped = items.filter(it => (perSrc[it.source] = (perSrc[it.source] || 0) + 1) <= per).slice(0, 110);
  capped.forEach((it, i) => { it.id = (ai ? 'a' : 's') + i; });
  return respond(200, { items: capped, failed, fetchedAt: Date.now() });
}

// ── Ranking with Claude ────────────────────────────────────────────
function buildPrompt(items, liked, disliked) {
  let s = 'You are the editor of a private daily news briefing for one person. You choose the few stories that will actually affect his life, money, business or health, and you explain each in one plain line.\n\n';
  s += 'WHO HE IS:\n' + PROFILE + '\n\n';
  s += 'HOW TO CHOOSE:\n'
    + '- Score every story 0-10 for real, practical impact on HIM: would knowing this change a decision he makes about money, TJM, pricing, platforms, tax, his health, or where he lives? High scores need a concrete link, not a vague "the economy matters".\n'
    + '- Prefer actionable and opportunity-creating stories (a rule change he must follow, a cost going up, a platform shift, a trend he can sell into, a tool he can use).\n'
    + '- Big world or political events score high ONLY when they have a clear knock-on for him (e.g. prices, rates, supply of silver/gold, UK consumer spending). Horse-race politics, celebrity, crime, outrage and disaster coverage with no effect on him score 0-2.\n'
    + '- Learn from his feedback below: lean toward the kind of story he marked useful, away from the kind he marked not useful. Judge by topic and type of story, not exact wording.\n\n';
  if (liked.length) s += 'HE MARKED THESE USEFUL:\n' + liked.map(x => '+ [' + x.tag + '] ' + x.t).join('\n') + '\n\n';
  if (disliked.length) s += 'HE MARKED THESE NOT USEFUL:\n' + disliked.map(x => '- [' + x.tag + '] ' + x.t).join('\n') + '\n\n';
  s += 'OUTPUT: Return only the 12 highest-scoring stories with score 5 or more (fewer is fine — never pad). One per line, best first, exactly:\n'
    + 'ID | SCORE | TAG | WHY\n'
    + 'TAG must be one of: ' + TAGS.join(', ') + '.\n'
    + 'WHY is max 22 words, addressed to him ("you"), saying specifically how it affects him or what he could do. No hype.\n'
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
    const score = Math.max(0, Math.min(10, parseFloat(p[1]) || 0));
    const tg = TAGS.find(t => t.toLowerCase() === p[2].toLowerCase()) || 'UK';
    const why = p.slice(3).join(' | ').slice(0, 220);
    seen.add(id);
    out.push({ id, score, tag: tg, why });
  });
  return out;
}

async function callClaude(key, model, system, user, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens || 900, system, messages: [{ role: 'user', content: user }] }),
  });
  const raw = await r.text();
  if (!r.ok) { const e = new Error('Anthropic ' + r.status + ': ' + raw.slice(0, 200)); e.status = r.status; throw e; }
  const data = JSON.parse(raw);
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

async function actionRank(payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return respond(500, { error: 'Server is missing ANTHROPIC_API_KEY.' });
  const items = (Array.isArray(payload.items) ? payload.items : []).slice(0, 120).map(x => ({
    id: String(x.id || '').slice(0, 8), title: String(x.title || '').slice(0, 220),
    summary: String(x.summary || '').slice(0, 200), source: String(x.source || '').slice(0, 40),
  })).filter(x => x.id && x.title);
  if (!items.length) return respond(400, { error: 'No stories to rank.' });
  const clean = arr => (Array.isArray(arr) ? arr : []).slice(0, 40).map(x => ({ t: String(x.t || '').slice(0, 160), tag: String(x.tag || '').slice(0, 20) })).filter(x => x.t);
  const { system, user } = buildPrompt(items, clean(payload.liked), clean(payload.disliked));
  const ids = new Set(items.map(x => x.id));

  const models = [process.env.NEWS_MODEL, 'claude-haiku-4-5-20251001', 'claude-sonnet-5'].filter(Boolean);
  let lastErr = null;
  for (const m of models) {
    try {
      const text = await callClaude(key, m, system, user);
      const ranked = parseRanked(text, ids);
      if (ranked.length) return respond(200, { ranked, model: m });
      console.error('[news rank] unparsed reply:', text.slice(0, 800));
      lastErr = new Error('The AI reply couldn\'t be read. It said: "' + text.replace(/\s+/g, ' ').slice(0, 160) + '"');
    } catch (e) {
      lastErr = e;
      // Only fall through to the next model when this one isn't available.
      if (e.status && e.status !== 404 && e.status !== 400) break;
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
  const models = [process.env.NEWS_MODEL, 'claude-haiku-4-5-20251001', 'claude-sonnet-5'].filter(Boolean);
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
      if (e.status && e.status !== 404 && e.status !== 400) break;
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
      user: 'Today is ' + p.dateLabel + '. Write the opening, about ' + words + ' words. Greet him by name, then give a quick spoken rundown of what\'s coming: one sentence per story below, saying why it is worth his attention. End by saying there\'s a short lesson and a quick recall quiz at the end. Do not go into detail yet.\n\nToday\'s stories, in order:\n' + heads };
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
    part: clip(payload.part, 10), words: payload.words, dateLabel: clip(payload.dateLabel, 40),
    headlines: (Array.isArray(payload.headlines) ? payload.headlines : []).slice(0, 12).map(h => ({ title: clip(h.title, 220), why: clip(h.why, 220) })),
    story: payload.story ? { title: clip(payload.story.title, 220), source: clip(payload.story.source, 40), why: clip(payload.story.why, 220), summary: clip(payload.story.summary, 400), link: clip(payload.story.link, 500) } : null,
    ai: payload.ai ? { title: clip(payload.ai.title, 220), what: clip(payload.ai.what, 260), try: clip(payload.ai.try, 320) } : null,
    avoid: (Array.isArray(payload.avoid) ? payload.avoid : []).slice(0, 20).map(x => clip(x, 60)),
  };
  if (p.part === 'story' && p.story && /^https?:\/\//.test(p.story.link)) p.article = await articleText(p.story.link);
  const pr = briefPrompt(p);
  if (!pr) return respond(400, { error: 'Unknown briefing part' });
  const words = Math.max(120, Math.min(650, parseInt(p.words, 10) || 400));
  const models = [process.env.NEWS_BRIEF_MODEL, 'claude-haiku-4-5-20251001', 'claude-sonnet-5'].filter(Boolean);
  let lastErr = null;
  for (const m of models) {
    try {
      let text = (await callClaude(key, m, pr.system, pr.user, Math.round(words * 1.9) + 80)).trim();
      let lesson = null;
      const lm = text.match(/\n?\s*LESSON:\s*(.+)\s*$/i);
      if (lm) { lesson = lm[1].trim().slice(0, 60); text = text.slice(0, lm.index).trim(); }
      text = text.replace(/[*#_`]/g, '').replace(/^\s*[-•]\s+/gm, '').trim();
      if (text) return respond(200, { text, lesson, model: m, hadArticle: !!p.article });
      lastErr = new Error('Empty section');
    } catch (e) {
      lastErr = e;
      if (e.status && e.status !== 404 && e.status !== 400) break;
    }
  }
  return respond(502, { error: String(lastErr && lastErr.message || 'Briefing failed').slice(0, 300) });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return respond(200, { ok: true });
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch (e) { return respond(400, { error: 'Bad JSON body' }); }
  try {
    if (payload.action === 'feeds') return await actionFeeds(payload.set);
    if (payload.action === 'airank') return await actionAiRank(payload);
    if (payload.action === 'brief') return await actionBrief(payload);
    if (payload.action === 'rank') return await actionRank(payload);
    return respond(400, { error: 'Unknown action' });
  } catch (e) {
    console.error('[news]', e);
    return respond(500, { error: String(e.message || e).slice(0, 300) });
  }
};
