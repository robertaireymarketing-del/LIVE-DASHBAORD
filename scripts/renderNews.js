// ── NEWS PAGE ──────────────────────────────────────────────────────────────
// More → 📰 News. A once-a-day, 5-minute news edition, picked for YOU.
//
// Design rules (all deliberate):
//  • One edition per day. It's built the first time you open the page that day
//    and doesn't change after — a finished paper, not an endless feed, so there's
//    nothing to keep refreshing.
//  • 5 minutes a day, total, across all your devices (stored in Firestore).
//    The clock only starts when you tap Start, keeps running while you're reading
//    an article you opened from here, and pauses if you go to another page in the
//    dashboard. At 0:00 the page locks until midnight.
//  • Stories are ranked by how much they actually affect your money, TJM, health
//    and life — not by how loud they are. Each one says why it matters to you.
//  • 👍 / 👎 on any story teaches it. Your votes go into tomorrow's ranking (as
//    examples for the AI editor) and also nudge whole topics and sources up or down.
//
//  • 👁 No repeats. Every story that makes an edition is remembered for 3 weeks
//    and won't appear again. "Seen it" on a story hides it from today straight
//    away (for ones you already caught elsewhere). The seen list is also given to
//    the AI editor, so the same event from a different outlet is skipped too —
//    unless there's a genuinely new development.
//
//  • 🤖 AI for TJM — a separate weekly edition (Sunday to Sunday), outside the
//    5-minute limit: 3–5 AI releases/tools you can use now, each with one
//    specific thing to try in TJM and a "Tried it" tick. The point is that this
//    is the whole list — nothing else to keep up with that week.
//
//  • 🎧 Daily audio briefing — a 20–30 minute spoken script built from today's
//    edition: intro, a deep dive on each story (what happened, the background,
//    why it matters to you, the other side), this week's untried AI experiment,
//    a lesson of the day, and a recall quiz. One Copy button → paste into
//    Speechify. Also outside the 5-minute limit (you're listening, not scrolling).
//
// Data: state.data.news = {
//   usage:   { date:'YYYY-MM-DD', secs },
//   edition: { date, items:[{id,title,link,source,summary,tag,score,why,v}], generatedAt, model },
//   votes:   [{ t, tag, src, v:1|-1, d }]   (newest first, capped)
//   seen:    [{ t, k, u, d, m }]  stories already shown (m:1 = you tapped Seen it); kept SEEN_DAYS
//   ai:      { week, items:[{id,title,link,source,ts,kind,what,try,v,done}], generatedAt, model, note },
//   aiVotes: [{ t, v }],  aiTried: [{ t, d }]
//   aiSaved: [{ key, title, link, source, kind, what, try, savedAt, done }]  (kept across weeks)
//   briefing: { date, text, words, builtAt, failed }, lessons: [names] (newest first)
//   briefRatings: [{ d, k, key, t, tag, src, r }]  your 1–10 ratings of briefing sections (newest first)
//     k = stoic | sll | success | story | ai | lesson | quiz. Story ratings tune the daily
//     ranking (sent to the AI editor + nudge topics/sources); every kind is sent back to
//     the writer of that section so tomorrow's leans toward what you rated highly.
// }

import { STOIC_QUOTES } from './constants.js';
import { getTodaysSllCard } from './renderStraightLine.js';

const DAILY_SECS = 5 * 60;
const MAX_STORIES = 10;
const ENDPOINT = '/.netlify/functions/news';
const SEEN_DAYS = 21;
const SEEN_MAX = 300;

const N = (typeof window !== 'undefined') ? (window.__news = window.__news || {}) : {};

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmt(secs) { secs = Math.max(0, Math.ceil(secs)); return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`; }
function ago(ts) { if (!ts) return ''; const h = Math.round((Date.now() - ts) / 3600000); return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; }

function news(state) {
  state.data.news = state.data.news || {};
  const n = state.data.news;
  n.votes = n.votes || [];
  if (!n.usage || n.usage.date !== todayKey()) n.usage = { date: todayKey(), secs: 0 };
  return n;
}
// ── Already seen ───────────────────────────────────────────────────────────
function normTitle(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 7).join(' '); }
function normLink(u) { return String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase().slice(0, 200); }
function seenList(state) {
  const n = news(state);
  const cutoff = Date.now() - SEEN_DAYS * 86400000;
  n.seen = (n.seen || []).filter(x => x && Date.parse(x.d) >= cutoff).slice(0, SEEN_MAX);
  return n.seen;
}
function seenMatcher(list) {
  const k = new Set(list.map(x => x.k).filter(Boolean));
  const u = new Set(list.map(x => x.u).filter(Boolean));
  return it => k.has(normTitle(it.title)) || u.has(normLink(it.link));
}
function addSeen(state, it, manual) {
  const list = seenList(state);
  const k = normTitle(it.title), u = normLink(it.link);
  const i = list.findIndex(x => (k && x.k === k) || (u && x.u === u));
  if (i >= 0) { if (manual) list[i].m = 1; return; }
  list.unshift({ t: String(it.title || '').slice(0, 160), k, u, d: todayKey(), m: manual ? 1 : 0 });
  if (list.length > SEEN_MAX) list.length = SEEN_MAX;
}
function removeSeen(state, it) {
  const n = news(state);
  const k = normTitle(it.title), u = normLink(it.link);
  n.seen = seenList(state).filter(x => !((k && x.k === k) || (u && x.u === u)));
}
function visibleItems(ed) { return ed ? ed.items.filter(it => !it.seen) : []; }

function secsLeft(state) { return DAILY_SECS - (news(state).usage.secs || 0); }

// ── What it has learned from your votes ────────────────────────────────────
function learned(votes, ratings) {
  const tag = {}, src = {};
  votes.slice(0, 200).forEach(x => {
    if (x.tag) tag[x.tag] = (tag[x.tag] || 0) + x.v;
    if (x.src) src[x.src] = (src[x.src] || 0) + x.v;
  });
  // A 10/10 counts like a 👍, a 1/10 like a 👎, 5–6 is roughly neutral.
  (ratings || []).filter(x => x.k === 'story').slice(0, 150).forEach(x => {
    const v = (x.r - 5.5) / 4.5;
    if (x.tag) tag[x.tag] = (tag[x.tag] || 0) + v;
    if (x.src) src[x.src] = (src[x.src] || 0) + v;
  });
  return { tag, src };
}
function ratingsOf(state, kind, max = 25) {
  return (news(state).briefRatings || []).filter(x => x.k === kind).slice(0, max).map(x => ({ t: x.t, r: x.r }));
}
function adjust(item, L) {
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  return clamp((L.tag[item.tag] || 0) * 0.4, 2) + clamp((L.src[item.source] || 0) * 0.2, 1);
}

// Fallback when the AI editor can't be reached: simple keyword relevance.
const KEYWORDS = [
  [/interest rate|bank of england|mortgage|inflation|base rate/i, 'Money', 7],
  [/\bsilver\b|\bgold\b|jewel|pandora|hallmark|diamond/i, 'Jewellery', 8],
  [/vinted|etsy|ebay|tiktok shop|shopify|amazon|marketplace|online seller/i, 'Business', 8],
  [/retail|high street|consumer spending|shoppers|christmas trading|black friday/i, 'Retail', 7],
  [/\btax\b|hmrc|vat|budget|small business|self-employed|sole trader/i, 'Money', 7],
  [/royal mail|postage|parcel|delivery/i, 'Business', 6],
  [/\bai\b|chatgpt|openai|anthropic|claude|artificial intelligence/i, 'Tech & AI', 6],
  [/nottingham/i, 'Nottingham', 6],
  [/exercise|sleep|diet|fitness|weight|protein/i, 'Health', 5],
];
function fallbackRank(items) {
  return items.map(it => {
    const hay = it.title + ' ' + (it.summary || '');
    const hit = KEYWORDS.find(([re]) => re.test(hay));
    return hit ? { id: it.id, score: hit[2], tag: hit[1], why: '' } : null;
  }).filter(Boolean);
}

async function post(body) {
  let res;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw new Error('Could not reach the news service. Check your connection.'); }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 404) throw new Error('News function not found — has the latest deploy finished?');
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

async function buildEdition(state, saveDataQuiet, render) {
  if (N.loading) return;
  N.loading = true; N.error = null; N.note = null;
  if (state.activeTab === 'news') render();
  try {
    const n = news(state);
    const { items: fetched } = await post({ action: 'feeds' });
    if (!fetched || !fetched.length) throw new Error('No stories came back from the feeds. Try again in a minute.');
    // Drop anything you've already had in an edition or marked as seen.
    const seen = seenList(state);
    const wasSeen = seenMatcher(seen);
    const items = fetched.filter(it => !wasSeen(it));
    if (!items.length) throw new Error('Every story in the feeds right now is one you\'ve already seen. Try again later today.');
    const seenTitles = seen.slice(0, 80).map(x => x.t);

    const liked = n.votes.filter(x => x.v > 0).slice(0, 40).map(x => ({ t: x.t, tag: x.tag }));
    const disliked = n.votes.filter(x => x.v < 0).slice(0, 40).map(x => ({ t: x.t, tag: x.tag }));
    const rated = (n.briefRatings || []).filter(x => x.k === 'story').slice(0, 40).map(x => ({ t: x.t, tag: x.tag, r: x.r }));
    let ranked, model = null;
    try {
      const r = await post({ action: 'rank', items: items.map(({ id, title, summary, source }) => ({ id, title, summary, source })), liked, disliked, rated, seen: seenTitles });
      ranked = r.ranked; model = r.model;
    } catch (e) {
      ranked = fallbackRank(items);
      N.note = 'The AI editor was unavailable, so today\'s picks are by keyword only. (' + e.message + ')';
    }

    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const L = learned(n.votes, n.briefRatings);
    const picked = ranked
      .map(r => { const it = byId[r.id]; return it ? { id: r.id, title: it.title, link: it.link, source: it.source, summary: it.summary, ts: it.ts, tag: r.tag, why: r.why, score: r.score } : null; })
      .filter(Boolean)
      .map(it => ({ ...it, rank: it.score + adjust(it, L) }))
      .filter(it => it.rank >= 5)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, MAX_STORIES);

    n.edition = { date: todayKey(), items: picked, generatedAt: Date.now(), model, note: N.note || null };
    picked.forEach(it => addSeen(state, it, false));   // in today's edition = won't come back tomorrow
    saveDataQuiet();
  } catch (e) {
    N.error = e.message || String(e);
  }
  N.loading = false;
  if (state.activeTab === 'news') render();
}

// ── Weekly AI for TJM ──────────────────────────────────────────────────────
function weekKey() {                         // Sunday-to-Sunday week, keyed by its Sunday
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function aiEdition(state) { const n = news(state); return n.ai && n.ai.week === weekKey() ? n.ai : null; }

async function buildAi(state, saveDataQuiet, render) {
  if (N.aiLoading) return;
  N.aiLoading = true; N.aiError = null;
  if (state.activeTab === 'news') render();
  try {
    const n = news(state);
    n.aiVotes = n.aiVotes || []; n.aiTried = n.aiTried || [];
    const { items } = await post({ action: 'feeds', set: 'ai' });
    if (!items || !items.length) throw new Error('No AI stories came back from the feeds. Try again in a minute.');
    const r = await post({
      action: 'airank',
      items: items.map(({ id, title, summary, source }) => ({ id, title, summary, source })),
      liked: n.aiVotes.filter(x => x.v > 0).slice(0, 30),
      disliked: n.aiVotes.filter(x => x.v < 0).slice(0, 30),
      tried: n.aiTried.slice(0, 30),
    });
    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const picked = (r.ranked || []).map(x => { const it = byId[x.id]; return it ? { id: x.id, title: it.title, link: it.link, source: it.source, ts: it.ts, kind: x.kind, what: x.what, try: x.try } : null; }).filter(Boolean);
    n.ai = { week: weekKey(), items: picked, generatedAt: Date.now(), model: r.model || null };
    saveDataQuiet();
  } catch (e) {
    N.aiError = e.message || String(e);
  }
  N.aiLoading = false;
  if (state.activeTab === 'news') render();
}

function aiKey(it) { return (it.link || it.title || '').slice(0, 300); }
function aiSaved(state) { const n = news(state); n.aiSaved = n.aiSaved || []; return n.aiSaved; }
function isSaved(state, it) { const k = aiKey(it); return aiSaved(state).some(x => x.key === k); }

function renderAiSaved(state) {
  const list = aiSaved(state);
  const cards = list.map((it, idx) => `
    <div class="nws-card nws-story ${it.done ? 'nws-done' : ''}">
      <div class="nws-meta"><span class="nws-tag">${esc(it.kind || 'Tool')}</span><span>${esc(it.source || '')}</span><span>· saved ${new Date(it.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
      <a class="nws-h" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
      ${it.what ? `<div class="nws-sum">${esc(it.what)}</div>` : ''}
      ${it.try ? `<div class="nws-try"><div class="nws-try-l">Try this in TJM</div>${esc(it.try)}</div>` : ''}
      <div class="nws-acts">
        <button class="nws-vote tried ${it.done ? 'on' : ''}" onclick="newsSavedTried(${idx})">${it.done ? '✅ Tried' : '☐ Tried it'}</button>
        <button class="nws-vote" onclick="newsSavedRemove(${idx})">Remove</button>
      </div>
    </div>`).join('');
  return `${NEWS_CSS}<div class="nws">
    <button class="nws-back" onclick="newsView('ai')">← AI for TJM</button>
    <div class="nws-head"><div><div class="nws-title">📁 Saved</div><div class="nws-sub">${list.length ? `${list.length} saved · ${list.filter(x => x.done).length} tried` : 'Nothing saved yet'} · AI ideas to come back to</div></div></div>
    ${cards || `<div class="nws-card nws-gate"><p>Tap 📁 Save on any AI for TJM item and it'll live here until you remove it.</p></div>`}
  </div>`;
}

function aiEntryCard(state) {
  const ed = aiEdition(state);
  const done = ed ? ed.items.filter(i => i.done).length : 0;
  const sub = ed ? (ed.items.length ? `Tried ${done} of ${ed.items.length} this week` : 'Nothing worth your time this week') : 'This week\'s edition is ready to build';
  return `<button class="nws-card nws-ai-entry" onclick="newsAiOpen()">
    <div><div class="nws-ai-t">🤖 AI for TJM · this week</div><div class="nws-note">${esc(sub)} · doesn't use your 5 minutes</div></div>
    <div class="nws-ai-arrow">→</div>
  </button>`;
}

function renderAi(state) {
  const ed = aiEdition(state);
  const back = `<button class="nws-back" onclick="newsAiClose()">← News</button>`;
  let body = '';
  if (N.aiLoading) body = `<div class="nws-card nws-gate"><p>Reading this week's AI news and picking what you can actually use…</p><div class="nws-spin"></div></div>`;
  else if (!ed && N.aiError) body = `<div class="nws-card nws-gate"><div class="nws-err">${esc(N.aiError)}</div><button class="nws-btn ghost" onclick="newsAiRetry()">Try again</button></div>`;
  else if (ed && !ed.items.length) body = `<div class="nws-card nws-gate"><p>Nothing released this week is worth changing how you work. You're not missing anything.</p></div>`;
  else if (ed) {
    const done = ed.items.filter(i => i.done).length;
    body = `<div class="nws-bar"><div style="width:${(done / ed.items.length) * 100}%"></div></div>` + ed.items.map(it => `
      <div class="nws-card nws-story ${it.done ? 'nws-done' : ''}">
        <div class="nws-meta"><span class="nws-tag">${esc(it.kind)}</span><span>${esc(it.source)}</span>${it.ts ? `<span>· ${ago(it.ts)}</span>` : ''}</div>
        <a class="nws-h" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
        <div class="nws-sum">${esc(it.what)}</div>
        <div class="nws-try"><div class="nws-try-l">Try this in TJM</div>${esc(it.try)}</div>
        <div class="nws-acts">
          <button class="nws-vote tried ${it.done ? 'on' : ''}" onclick="newsAiTried('${it.id}')">${it.done ? '✅ Tried' : '☐ Tried it'}</button>
          <button class="nws-vote save ${isSaved(state, it) ? 'on' : ''}" onclick="newsAiSave('${it.id}')">${isSaved(state, it) ? '📁 Saved' : '📁 Save'}</button>
          <button class="nws-vote up ${it.v > 0 ? 'on' : ''}" onclick="newsAiVote('${it.id}',1)">👍</button>
          <button class="nws-vote down ${it.v < 0 ? 'on' : ''}" onclick="newsAiVote('${it.id}',-1)">👎</button>
        </div>
      </div>`).join('') + `<div class="nws-note" style="text-align:center;padding:6px 10px;">That's everything worth knowing this week. Trying one of these properly puts you ahead of people reading about fifty.</div>`;
  }
  return `${NEWS_CSS}<div class="nws">
    <div style="display:flex;justify-content:space-between;align-items:center;">${back}<button class="nws-back" onclick="newsView('aisaved')">📁 Saved (${aiSaved(state).length})</button></div>
    <div class="nws-head"><div><div class="nws-title">🤖 AI for TJM</div><div class="nws-sub">Week of ${new Date(weekKey()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · what's new that you can use now, and one thing to try with each</div></div></div>
    ${body}
  </div>`;
}

// ── Daily audio briefing ───────────────────────────────────────────────────
const WPM = 160;                               // typical TTS speed at 1x
function briefing(state) { const n = news(state); return n.briefing && n.briefing.date === todayKey() ? n.briefing : null; }

async function postRetry(body) {
  try { return await post(body); } catch (e) { return await post(body); }
}

async function buildBriefing(state, saveDataQuiet, render) {
  if (N.briefLoading) return;
  N.briefLoading = true; N.briefError = null; N.briefDone = 0; N.briefTotal = 0; N.copied = false;
  if (state.activeTab === 'news') render();
  try {
    const n = news(state);
    while (N.loading) await new Promise(r => setTimeout(r, 400));   // daily edition already building
    if (!(n.edition && n.edition.date === todayKey())) {
      N.briefStage = 'Picking today\'s stories…';
      if (state.activeTab === 'news') render();
      await buildEdition(state, saveDataQuiet, render);
    }
    const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;
    if (!ed) throw new Error(N.error || 'Couldn\'t build today\'s edition.');

    const stories = visibleItems(ed).slice(0, 6);
    const headlines = stories.map(it => ({ title: it.title, why: it.why }));
    const per = stories.length ? Math.max(300, Math.min(480, Math.round(2700 / stories.length))) : 0;
    const ai = (aiEdition(state)?.items || []).find(i => !i.done) || null;
    const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    // Same Stoic quote the dashboard shows today (journal quote card)
    const now = new Date();
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const stoic = STOIC_QUOTES[doy % STOIC_QUOTES.length];
    let sll = null;
    try { sll = getTodaysSllCard(state); } catch (e) {}

    const R = k => ratingsOf(state, k);
    const jobs = [
      { key: 'stoic', body: { part: 'stoic', words: 620, stoic, rated: R('stoic') } },
      ...(sll ? [{ key: 'sll', body: { part: 'sll', words: 620, sll, rated: R('sll') } }] : []),
      { key: 'success', body: { part: 'success', words: 620, avoid: (n.successUsed || []).slice(0, 30), rated: R('success') } },
      { key: 'intro', body: { part: 'intro', words: 170, dateLabel, headlines, noGreeting: true } },
      ...stories.map((st, i) => ({ key: 'story' + i, st, i, body: { part: 'story', words: per, story: st, rated: R('story') } })),
      ...(ai ? [{ key: 'ai', body: { part: 'ai', words: 230, ai, rated: R('ai') } }] : []),
      { key: 'learn', body: { part: 'learn', words: stories.length >= 4 ? 550 : 650, headlines, avoid: (n.lessons || []).slice(0, 20), rated: R('lesson') } },
      { key: 'close', body: { part: 'close', words: 380, headlines, rated: R('quiz') } },
    ];
    N.briefTotal = jobs.length; N.briefStage = 'Writing your briefing…';
    if (state.activeTab === 'news') render();

    const out = await Promise.all(jobs.map(j => postRetry({ action: 'brief', ...j.body })
      .then(r => { N.briefDone++; updateBriefProgress(); return { ...j, ok: true, text: r.text, lesson: r.lesson }; })
      .catch(e => { N.briefDone++; updateBriefProgress(); return { ...j, ok: false, err: e.message }; })));

    const get = k => out.find(o => o.key === k);
    const parts = [];
    parts.push(`Good morning Robert. It's ${dateLabel}. We'll start with your mindset: a piece of Stoic wisdom, today's Straight Line principle, and a success habit worth stealing. Then the news that matters to you, a lesson, and a quick quiz.`);
    const st = get('stoic');
    if (st.ok) parts.push('First, your Stoic wisdom for today.\n\n' + st.text);
    else parts.push(`First, your Stoic wisdom for today. ${stoic.author} wrote: ${stoic.text} ${stoic.interpretation}`);
    const sl = get('sll');
    if (sl && sl.ok) parts.push('Next, your Straight Line principle.\n\n' + sl.text);
    else if (sll) parts.push(`Next, your Straight Line principle: ${sll.name || sll.sl}. ${sll.essence} ${sll.mine} ${sll.apply}`);
    const sc = get('success');
    if (sc.ok) parts.push('Now, a success habit worth stealing.\n\n' + sc.text);
    const intro = get('intro');
    parts.push(intro.ok ? intro.text : `Now, today's news.`);
    stories.forEach((st, i) => {
      const o = get('story' + i);
      const lead = `Story ${i + 1} of ${stories.length}. From ${st.source}. ${st.title}.`;
      parts.push(lead + '\n\n' + (o.ok ? o.text : (st.why || st.summary || '')));
    });
    const a = get('ai');
    if (a && a.ok) parts.push('Now, this week\'s AI experiment.\n\n' + a.text);
    const l = get('learn');
    if (l.ok) parts.push(l.text);
    const c = get('close');
    if (c.ok) parts.push('Time for your recall quiz.\n\n' + c.text);

    const text = parts.join('\n\n\n');
    const failed = out.filter(o => !o.ok).length;
    n.briefing = { date: todayKey(), text, words: text.split(/\s+/).filter(Boolean).length, builtAt: Date.now(), failed };
    if (l.ok && l.lesson) n.lessons = [l.lesson, ...(n.lessons || []).filter(x => x !== l.lesson)].slice(0, 40);
    if (sc.ok && sc.lesson) n.successUsed = [sc.lesson, ...(n.successUsed || []).filter(x => x !== sc.lesson)].slice(0, 60);
    saveDataQuiet();
  } catch (e) {
    N.briefError = e.message || String(e);
  }
  N.briefLoading = false; N.briefStage = null;
  if (state.activeTab === 'news') render();
}
function updateBriefProgress() {
  const el = document.getElementById('brief-progress');
  if (el) el.textContent = `Writing section ${Math.min(N.briefDone + 1, N.briefTotal)} of ${N.briefTotal}…`;
  const b = document.getElementById('brief-bar');
  if (b && N.briefTotal) b.style.width = `${(N.briefDone / N.briefTotal) * 100}%`;
}

// ── Script summary: what's in it, how long each part is, and where it starts ──
// Worked out from the script text itself (sections are joined by blank lines and
// each opens with a fixed lead-in), so it also works for briefings built earlier.
function firstSentence(t, max = 170) {
  const x = String(t || '').replace(/\s+/g, ' ').trim();
  const m = x.match(/^.{20,}?[.!?](?=\s|$)/);
  const out = m ? m[0] : x;
  return out.length > max ? out.slice(0, max - 1).trim() + '…' : out;
}
function briefSections(b, ed) {
  const parts = String(b.text || '').split(/\n\n\n+/).map(x => x.trim()).filter(Boolean);
  const words = t => t.split(/\s+/).filter(Boolean).length;
  const strip = (t, re) => t.replace(re, '').trim();
  const out = [];
  parts.forEach((t, i) => {
    let icon = '•', label = 'Section', gist = '', kind = null;
    let m;
    if (i === 0 && /^Good morning/i.test(t)) { icon = '👋'; label = 'Welcome'; gist = 'What\'s coming up today.'; }
    else if (/^First, your Stoic wisdom/i.test(t)) { icon = '🏛'; label = 'Stoic wisdom'; kind = 'stoic'; gist = firstSentence(strip(t, /^First, your Stoic wisdom for today\.\s*/i)); }
    else if (/^Next, your Straight Line principle/i.test(t)) { icon = '📏'; label = 'Straight Line principle'; kind = 'sll'; gist = firstSentence(strip(t, /^Next, your Straight Line principle[.:]?\s*/i)); }
    else if (/^Now, a success habit/i.test(t)) { icon = '🏆'; label = 'Success habit'; kind = 'success'; gist = firstSentence(strip(t, /^Now, a success habit worth stealing\.\s*/i)); }
    else if ((m = t.match(/^Story (\d+) of (\d+)\. From (.+?)\. ([\s\S]+?)\n\n([\s\S]*)$/))) {
      const title = m[4].replace(/\.$/, '');
      const st = ed && ed.items.find(x => x.title === title || x.title + '.' === m[4]);
      icon = '📰'; label = `Story ${m[1]} · ${m[3]}`;
      gist = `<b>${esc(title)}</b>` + ((st && st.why) ? `<br>${esc(st.why)}` : (m[5] ? `<br>${esc(firstSentence(m[5]))}` : ''));
      out.push({ icon, label, html: gist, words: words(t), text: t, kind: 'story', title, tag: st && st.tag, src: m[3] });
      return;
    }
    else if (/^Now, this week's AI experiment/i.test(t)) { icon = '🤖'; label = 'AI experiment'; kind = 'ai'; gist = firstSentence(strip(t, /^Now, this week's AI experiment\.\s*/i)); }
    else if (/^Today's lesson is/i.test(t)) { icon = '🧠'; label = 'Lesson of the day'; kind = 'lesson'; gist = firstSentence(t); }
    else if (/^Time for your recall quiz/i.test(t)) { icon = '❓'; label = 'Recall quiz & sign-off'; kind = 'quiz'; gist = 'Three questions on today\'s stories, a reflection question for the day, then the sign-off.'; }
    else if (/^Now, today's news/i.test(t) || i <= 4 && /today's news/i.test(t.slice(0, 120))) { icon = '🗞'; label = 'News rundown'; gist = 'A quick run-through of today\'s stories before the deep dives.'; }
    else gist = firstSentence(t);
    out.push({ icon, label, html: esc(gist), words: words(t), text: t, kind, title: kind === 'quiz' ? 'Recall quiz and sign-off' : gist });
  });
  let at = 0;
  out.forEach(sct => { sct.start = at; at += sct.words / WPM; });
  return out;
}
function secKey(b, sct) { return b.date + '|' + sct.kind + '|' + String(sct.title || '').slice(0, 80); }
function renderBriefSummary(b, ed, ratings) {
  const secs = briefSections(b, ed);
  const mine = {};
  (ratings || []).forEach(x => { if (x.d === b.date) mine[x.key] = x.r; });
  const rated = secs.filter(x => x.kind && mine[secKey(b, x)]).length;
  const rateable = secs.filter(x => x.kind).length;
  if (!secs.length) return '';
  const mm = x => { const v = Math.round(x); return v < 1 ? '<1 min' : v + ' min'; };
  const rows = secs.map((sct, idx) => {
    const cur = sct.kind ? mine[secKey(b, sct)] : null;
    const rate = sct.kind ? `<div class="nws-rate">${[1,2,3,4,5,6,7,8,9,10].map(v => `<button class="${cur === v ? 'on' : ''} ${cur && v <= cur ? 'fill' : ''}" onclick="newsRate(${idx},${v})">${v}</button>`).join('')}</div>` : '';
    return `<div class="nws-secw">
    <details class="nws-sec">
      <summary>
        <span class="nws-sec-ic">${sct.icon}</span>
        <span class="nws-sec-main"><span class="nws-sec-l">${esc(sct.label)}</span><span class="nws-sec-g">${sct.html}</span></span>
        <span class="nws-sec-t">${Math.floor(sct.start)}:00<br><span>${mm(sct.words / WPM)}</span></span>
      </summary>
      <div class="nws-script">${esc(sct.text).replace(/\n/g, '<br>')}</div>
    </details>${rate}</div>`; }).join('');
  return `<div class="nws-card nws-sum-card">
    <div class="nws-sum-h">What's in it<span>${secs.length} sections · tap one to read it</span></div>
    <div class="nws-note" style="margin-bottom:4px;">Rate each part out of 10 for how relevant and interesting it was${rated ? ` · ${rated} of ${rateable} rated` : ''}. Tomorrow's picks and writing lean toward what scores high.</div>
    ${rows}
  </div>`;
}

function briefEntryCard(state) {
  const b = briefing(state);
  const sub = b ? `Ready · about ${Math.round(b.words / WPM)} minutes · tap to copy` : 'About 35–40 minutes · mindset first, then the news';
  return `<button class="nws-card nws-ai-entry" onclick="newsView('brief')">
    <div><div class="nws-ai-t">🎧 Today's audio briefing</div><div class="nws-note">${esc(sub)}</div></div>
    <div class="nws-ai-arrow">→</div>
  </button>`;
}

function renderBrief(state) {
  const b = briefing(state);
  const back = `<button class="nws-back" onclick="newsView(null)">← News</button>`;
  let body;
  if (N.briefLoading) {
    body = `<div class="nws-card nws-gate">
      <p id="brief-progress">${esc(N.briefStage || 'Writing your briefing…')}</p>
      <div class="nws-bar" style="margin-top:14px;"><div id="brief-bar" style="width:${N.briefTotal ? (N.briefDone / N.briefTotal) * 100 : 3}%"></div></div>
      <p style="font-size:12px;">Takes about half a minute. Every section is written at the same time; each story gets read in full and turned into a proper explainer.</p>
    </div>`;
  } else if (!b) {
    body = `<div class="nws-card nws-gate">
      <div class="big">🎧</div>
      <p>A 35–40 minute spoken briefing. It opens with your mindset — today's Stoic wisdom, your Straight Line principle and a success habit — then today's stories: what happened, the background you need to understand it, why it matters to you, this week's AI experiment, a lesson of the day and a quick recall quiz.</p>
      ${N.briefError ? `<div class="nws-err">${esc(N.briefError)}</div>` : ''}
      <button class="nws-btn" onclick="newsBriefBuild()">${N.briefError ? 'Try again' : 'Build today\'s briefing'}</button>
    </div>`;
  } else {
    const mins = Math.round(b.words / WPM);
    body = `<div class="nws-card nws-gate">
      <div class="big">${mins} min</div>
      <div class="lbl">${b.words.toLocaleString()} words · at normal speed</div>
      <button class="nws-btn" onclick="newsBriefCopy()">${N.copied ? '✓ Copied — paste into Speechify' : 'Copy briefing'}</button>
      ${N.copyFail ? `<div class="nws-err">Couldn't copy automatically — open "Read the script" below, select all and copy.</div>` : ''}
      ${b.failed ? `<div class="nws-note" style="margin-top:10px;">${b.failed} section${b.failed === 1 ? '' : 's'} couldn't be written, so ${b.failed === 1 ? 'it was' : 'they were'} shortened. <a href="#" onclick="newsBriefBuild();return false;" style="color:var(--gold);">Rebuild</a></div>` : ''}
    </div>
    ${renderBriefSummary(b, news(state).edition && news(state).edition.date === todayKey() ? news(state).edition : null, news(state).briefRatings)}
    <details class="nws-card nws-preview"><summary>Read the whole script</summary><div class="nws-script">${esc(b.text).replace(/\n/g, '<br>')}</div></details>`;
  }
  return `${NEWS_CSS}<div class="nws">
    ${back}
    <div class="nws-head"><div><div class="nws-title">🎧 Daily briefing</div><div class="nws-sub">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · copy it, paste into Speechify, press play</div></div></div>
    ${body}
  </div>`;
}

// ── Render ─────────────────────────────────────────────────────────────────
const NEWS_CSS = `<style id="news-css">
.nws { --gold:#D4AF37; --card:#111214; --line:rgba(255,255,255,0.08); --mut:rgba(255,255,255,0.55); --faint:rgba(255,255,255,0.35);
  display:flex; flex-direction:column; gap:14px; padding:4px 0 40px; }
.nws * { box-sizing:border-box; }
.nws-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
.nws-title { font-size:24px; font-weight:800; letter-spacing:0.3px; color:#fff; }
.nws-sub { font-size:13px; color:var(--mut); margin-top:4px; line-height:1.45; }
.nws-clock { font-variant-numeric:tabular-nums; font-size:22px; font-weight:800; color:var(--gold); white-space:nowrap; }
.nws-clock.low { color:#e74c3c; }
.nws-bar { height:4px; border-radius:2px; background:rgba(255,255,255,0.08); overflow:hidden; }
.nws-bar > div { height:100%; background:var(--gold); transition:width 1s linear; }
.nws-bar > div.low { background:#e74c3c; }
.nws-card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; }
.nws-gate { text-align:center; padding:26px 18px; }
.nws-gate .big { font-size:44px; font-weight:800; color:var(--gold); font-variant-numeric:tabular-nums; }
.nws-gate .lbl { font-size:12px; letter-spacing:1.5px; color:var(--mut); text-transform:uppercase; margin-top:4px; }
.nws-gate p { font-size:14px; color:var(--mut); line-height:1.55; margin:14px 0 0; }
.nws-btn { width:100%; margin-top:16px; padding:15px; border-radius:12px; border:none; background:var(--gold); color:#000; font-size:16px; font-weight:800; letter-spacing:0.5px; cursor:pointer; font-family:inherit; }
.nws-btn[disabled] { opacity:0.4; cursor:default; }
.nws-btn.ghost { background:transparent; color:var(--gold); border:1px solid rgba(212,175,55,0.4); }
.nws-story { display:flex; flex-direction:column; gap:8px; }
.nws-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px; color:var(--faint); }
.nws-tag { font-size:10px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; color:var(--gold); border:1px solid rgba(212,175,55,0.35); border-radius:20px; padding:2px 8px; }
.nws-h { font-size:16px; font-weight:700; line-height:1.35; color:#fff; text-decoration:none; }
.nws-why { font-size:14px; line-height:1.5; color:#e9dcae; border-left:2px solid var(--gold); padding-left:10px; }
.nws-sum { font-size:13px; line-height:1.5; color:var(--mut); }
.nws-acts { display:flex; gap:8px; margin-top:2px; }
.nws-vote { flex:1; padding:9px 0; border-radius:10px; border:1px solid var(--line); background:transparent; color:var(--mut); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; }
.nws-vote.up.on { background:rgba(46,204,113,0.14); border-color:rgba(46,204,113,0.5); color:#2ecc71; }
.nws-vote.down.on { background:rgba(231,76,60,0.12); border-color:rgba(231,76,60,0.45); color:#e74c3c; }
.nws-seen { margin-left:auto; background:none; border:1px solid var(--line); border-radius:20px; color:var(--mut); font-size:11px; font-weight:700; padding:3px 9px; cursor:pointer; font-family:inherit; }
.nws-hidden { display:flex; flex-direction:column; gap:8px; }
.nws-hidden-row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; color:var(--mut); line-height:1.4; }
.nws-undo { background:none; border:none; color:var(--gold); font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; padding:0; }
.nws-read { flex:1.2; padding:9px 0; border-radius:10px; border:1px solid rgba(212,175,55,0.4); color:var(--gold); font-size:13px; font-weight:700; text-align:center; text-decoration:none; }
.nws-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.nws-chip { font-size:11px; font-weight:700; border-radius:20px; padding:4px 9px; }
.nws-chip.more { color:#2ecc71; background:rgba(46,204,113,0.1); }
.nws-chip.less { color:#e74c3c; background:rgba(231,76,60,0.1); }
.nws-note { font-size:12px; color:var(--faint); line-height:1.5; }
.nws-err { font-size:13px; color:#e74c3c; line-height:1.5; margin-top:12px; }
.nws-list { margin:10px 0 0; padding-left:18px; font-size:14px; line-height:1.55; color:#ddd; }
.nws-spin { width:22px; height:22px; border:2px solid rgba(212,175,55,0.25); border-top-color:var(--gold); border-radius:50%; margin:16px auto 0; animation:nwsSpin 0.9s linear infinite; }
@keyframes nwsSpin { to { transform:rotate(360deg); } }
.nws-ai-entry { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; text-align:left; cursor:pointer; font-family:inherit; border-color:rgba(212,175,55,0.3); }
.nws-ai-t { font-size:15px; font-weight:800; color:var(--gold); margin-bottom:3px; }
.nws-ai-arrow { font-size:20px; color:var(--gold); }
.nws-back { align-self:flex-start; background:none; border:none; color:var(--gold); font-size:14px; font-weight:700; padding:4px 0; cursor:pointer; font-family:inherit; }
.nws-try { font-size:14px; line-height:1.5; color:#e9dcae; background:rgba(212,175,55,0.07); border:1px solid rgba(212,175,55,0.22); border-radius:10px; padding:10px 12px; }
.nws-try-l { font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--gold); margin-bottom:4px; }
.nws-vote.tried { flex:1.6; }
.nws-vote.tried.on { background:rgba(212,175,55,0.14); border-color:rgba(212,175,55,0.5); color:var(--gold); }
.nws-done { opacity:0.65; }
.nws-vote.save { flex:1.3; }
.nws-vote.save.on { background:rgba(212,175,55,0.14); border-color:rgba(212,175,55,0.5); color:var(--gold); }
body.light .nws-try { color:#5a4610; }
.nws-sum-card { display:flex; flex-direction:column; padding:14px 14px 6px; }
.nws-sum-h { font-size:15px; font-weight:800; color:var(--gold); margin-bottom:6px; display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
.nws-sum-h span { font-size:11px; font-weight:600; color:var(--faint); }
.nws-secw { border-top:1px solid var(--line); }
.nws-secw:first-of-type { border-top:none; }
.nws-rate { display:flex; gap:3px; margin:0 0 10px 32px; }
.nws-rate button { flex:1; min-width:0; padding:6px 0; border-radius:7px; border:1px solid var(--line); background:transparent; color:var(--faint); font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; cursor:pointer; font-family:inherit; }
.nws-rate button.fill { background:rgba(212,175,55,0.12); border-color:rgba(212,175,55,0.3); color:var(--gold); }
.nws-rate button.on { background:var(--gold); border-color:var(--gold); color:#000; }
.nws-sec > summary { list-style:none; display:flex; gap:10px; align-items:flex-start; padding:10px 0; cursor:pointer; }
.nws-sec > summary::-webkit-details-marker { display:none; }
.nws-sec-ic { font-size:18px; line-height:1.2; width:22px; text-align:center; flex-shrink:0; }
.nws-sec-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.nws-sec-l { font-size:11px; font-weight:800; letter-spacing:0.8px; text-transform:uppercase; color:var(--gold); }
.nws-sec-g { font-size:13px; line-height:1.45; color:var(--mut); }
.nws-sec-g b { color:#fff; font-weight:700; }
body.light .nws-sec-g b { color:#0A1628; }
.nws-sec-t { font-size:12px; font-weight:800; color:var(--mut); text-align:right; font-variant-numeric:tabular-nums; flex-shrink:0; line-height:1.35; }
.nws-sec-t span { font-size:10px; font-weight:600; color:var(--faint); }
.nws-sec[open] .nws-script { margin:0 0 12px 32px; font-size:13px; }
.nws-preview summary { cursor:pointer; font-size:14px; font-weight:700; color:var(--gold); }
.nws-script { margin-top:12px; font-size:14px; line-height:1.65; color:#ddd; }
body.light .nws-script { color:#0A1628; }
body.light .nws { --card:#fff; --line:rgba(10,22,40,0.1); --mut:rgba(10,22,40,0.6); --faint:rgba(10,22,40,0.45); --gold:#B08D2E; }
body.light .nws-title, body.light .nws-h { color:#0A1628; }
body.light .nws-why { color:#5a4610; }
body.light .nws-list { color:#0A1628; }
body.light .nws-btn { color:#fff; }
</style>`;

function learnedChips(votes, ratings) {
  const L = learned(votes, ratings);
  const tags = Object.entries(L.tag).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  if (!tags.length) return '';
  const more = tags.filter(([, v]) => v > 0).slice(0, 4);
  const less = tags.filter(([, v]) => v < 0).slice(-4).reverse();
  return `<div class="nws-chips">
    ${more.map(([t]) => `<span class="nws-chip more">More ${esc(t)}</span>`).join('')}
    ${less.map(([t]) => `<span class="nws-chip less">Less ${esc(t)}</span>`).join('')}
  </div>`;
}

function untilMidnight() {
  const now = new Date(); const m = new Date(now); m.setHours(24, 0, 0, 0);
  const mins = Math.round((m - now) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function renderNewsTab({ state }) {
  if (N.view === 'ai') return renderAi(state);
  if (N.view === 'brief') return renderBrief(state);
  if (N.view === 'aisaved') return renderAiSaved(state);
  const n = news(state);
  const left = secsLeft(state);
  const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;

  // ── Locked for the day ──
  if (left <= 0) {
    const likedToday = visibleItems(ed).filter(it => it.v > 0);
    return `${NEWS_CSS}<div class="nws">
      <div class="nws-head"><div><div class="nws-title">📰 News</div><div class="nws-sub">Today's 5 minutes are used.</div></div></div>
      <div class="nws-card nws-gate">
        <div class="big">🔒</div>
        <div class="lbl">Locked until midnight</div>
        <p>Tomorrow's edition unlocks in <b>${untilMidnight()}</b>. You've got what matters for today, so get back to the work that actually moves things.</p>
      </div>
      ${briefEntryCard(state)}
      ${aiEntryCard(state)}
      ${likedToday.length ? `<div class="nws-card"><div class="nws-tag" style="display:inline-block;">Useful today</div>
        <ul class="nws-list">${likedToday.map(it => `<li>${esc(it.title)}</li>`).join('')}</ul></div>` : ''}
      ${n.votes.length ? `<div class="nws-card"><div class="nws-note">What it's learned from your ${n.votes.length} vote${n.votes.length === 1 ? '' : 's'}:</div>${learnedChips(n.votes, n.briefRatings)}</div>` : ''}
    </div>`;
  }

  const low = left <= 60;
  const clock = `<div class="nws-clock ${low ? 'low' : ''}" id="news-clock">${fmt(left)}</div>`;
  const header = `<div class="nws-head">
      <div><div class="nws-title">📰 News</div><div class="nws-sub">Today's edition · picked for your money, TJM, health and life</div></div>
      ${clock}
    </div>
    <div class="nws-bar"><div id="news-bar" class="${low ? 'low' : ''}" style="width:${(left / DAILY_SECS) * 100}%"></div></div>`;

  // ── Gate: not started (or paused) ──
  if (!N.running) {
    const started = left < DAILY_SECS;
    let status = '';
    if (N.loading) status = `<p>Building today's edition — reading the feeds and picking what affects you…</p><div class="nws-spin"></div>`;
    else if (N.error && !ed) status = `<div class="nws-err">${esc(N.error)}</div><button class="nws-btn ghost" onclick="newsRetry()">Try again</button>`;
    else if (ed) { const c = visibleItems(ed).length; status = `<p>${c ? `${c} stor${c === 1 ? 'y' : 'ies'} worth your time today.` : 'Nothing today cleared the bar for affecting you. That\'s a good day.'} Built ${ago(ed.generatedAt)}. Stories you've already had are left out.</p>`; }
    return `${NEWS_CSS}<div class="nws">
      ${header}
      <div class="nws-card nws-gate">
        <div class="big">${fmt(left)}</div>
        <div class="lbl">${started ? 'left today' : 'per day'}</div>
        ${status}
        <button class="nws-btn" onclick="newsStart()" ${ed && !N.loading ? '' : 'disabled'}>${started ? 'Resume' : 'Start'}</button>
        <p style="font-size:12px;">The clock runs while you read here or in an article you open. It pauses if you switch to another page in the dashboard.</p>
      </div>
      ${briefEntryCard(state)}
      ${aiEntryCard(state)}
      ${n.votes.length ? `<div class="nws-card"><div class="nws-note">Tuned to you from ${n.votes.length} vote${n.votes.length === 1 ? '' : 's'}:</div>${learnedChips(n.votes, n.briefRatings)}</div>` : ''}
    </div>`;
  }

  // ── Reading ──
  const items = visibleItems(ed);
  const hidden = ed ? ed.items.filter(it => it.seen) : [];
  const stories = items.map(it => `
    <div class="nws-card nws-story">
      <div class="nws-meta"><span class="nws-tag">${esc(it.tag)}</span><span>${esc(it.source)}</span>${it.ts ? `<span>· ${ago(it.ts)}</span>` : ''}<button class="nws-seen" onclick="newsSeen('${it.id}')">👁 Seen it</button></div>
      <a class="nws-h" href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a>
      ${it.why ? `<div class="nws-why">${esc(it.why)}</div>` : ''}
      ${it.summary ? `<div class="nws-sum">${esc(it.summary.length > 220 ? it.summary.slice(0, 220) + '…' : it.summary)}</div>` : ''}
      <div class="nws-acts">
        <button class="nws-vote up ${it.v > 0 ? 'on' : ''}" onclick="newsVote('${it.id}',1)">👍 Useful</button>
        <button class="nws-vote down ${it.v < 0 ? 'on' : ''}" onclick="newsVote('${it.id}',-1)">👎 Not for me</button>
        <a class="nws-read" href="${esc(it.link)}" target="_blank" rel="noopener">Read →</a>
      </div>
    </div>`).join('');

  return `${NEWS_CSS}<div class="nws">
    ${header}
    ${ed && ed.note ? `<div class="nws-note">${esc(ed.note)}</div>` : ''}
    ${stories || `<div class="nws-card nws-gate"><p>${hidden.length ? 'You\'ve already seen everything in today\'s edition. Close this and get on.' : 'Nothing today cleared the bar for affecting you. That\'s a good day — close this and get on.'}</p></div>`}
    ${hidden.length ? `<div class="nws-card nws-hidden"><div class="nws-note">Marked as already seen — these won't come back:</div>
      ${hidden.map(it => `<div class="nws-hidden-row"><span>${esc(it.title)}</span><button class="nws-undo" onclick="newsUnseen('${it.id}')">Undo</button></div>`).join('')}</div>` : ''}
    <button class="nws-btn ghost" onclick="newsDone()">I'm done for today</button>
  </div>`;
}

// ── Behaviour ──────────────────────────────────────────────────────────────
export function initNewsTab({ state, saveDataQuiet, render }) {
  const n = news(state);   // re-read inside handlers too: state.data can be swapped by a reload
  const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;
  if (!N.view && !ed && !N.loading && !N.error && secsLeft(state) > 0) buildEdition(state, saveDataQuiet, render);
  if (N.view === 'ai' && !aiEdition(state) && !N.aiLoading && !N.aiError) buildAi(state, saveDataQuiet, render);

  // Counting: wall-clock between ticks, so time spent in an article you opened
  // from here (app in background) still counts when you come back.
  const flush = () => {
    if (!N.running || !N.lastTick) return;
    const now = Date.now();
    const d = Math.min((now - N.lastTick) / 1000, 15 * 60);
    N.lastTick = now;
    const u = news(state).usage;
    u.secs = Math.min(DAILY_SECS, (u.secs || 0) + d);
  };
  N.flush = flush;

  const tick = () => {
    if (state.activeTab !== 'news' || !N.running) { clearInterval(N.timer); return; }
    flush();
    const left = secsLeft(state);
    const c = document.getElementById('news-clock');
    const b = document.getElementById('news-bar');
    if (c) { c.textContent = fmt(left); c.classList.toggle('low', left <= 60); }
    if (b) { b.style.width = `${(left / DAILY_SECS) * 100}%`; b.classList.toggle('low', left <= 60); }
    if (Date.now() - (N.lastSave || 0) > 15000) { N.lastSave = Date.now(); saveDataQuiet(); }
    if (left <= 0) { N.running = false; clearInterval(N.timer); saveDataQuiet(); render(); }
  };
  clearInterval(N.timer);
  if (N.running) { if (!N.lastTick) N.lastTick = Date.now(); N.timer = setInterval(tick, 1000); }

  if (!N.visBound) {
    N.visBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && N.running && state.activeTab === 'news') { tick(); }
      if (document.visibilityState === 'hidden' && N.running) { saveDataQuiet(); }
    });
  }

  window.newsStart = () => {
    if (secsLeft(state) <= 0) return;
    N.running = true; N.lastTick = Date.now(); N.lastSave = Date.now();
    render();
  };
  window.newsDone = () => {
    flush(); N.running = false; clearInterval(N.timer);
    news(state).usage.secs = DAILY_SECS;          // done means done — locks for today
    saveDataQuiet(); render();
  };
  window.newsAiOpen = () => { N.view = 'ai'; render(); window.scrollTo(0, 0); };
  window.newsView = (v) => { N.view = v; N.copied = false; N.copyFail = false; render(); window.scrollTo(0, 0); };
  window.newsBriefBuild = () => { buildBriefing(state, saveDataQuiet, render); };
  window.newsBriefCopy = async () => {
    const b = briefing(state); if (!b) return;
    let ok = false;
    try { await navigator.clipboard.writeText(b.text); ok = true; } catch (e) {}
    if (!ok) {                                   // older iOS fallback
      const ta = document.createElement('textarea');
      ta.value = b.text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, ta.value.length);
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    N.copied = ok; N.copyFail = !ok;
    render();
  };
  window.newsAiClose = () => { N.view = null; render(); window.scrollTo(0, 0); };
  window.newsAiRetry = () => { N.aiError = null; buildAi(state, saveDataQuiet, render); };
  const aiItem = (id) => { const e = aiEdition(state); return e ? e.items.find(x => x.id === id) : null; };
  window.newsAiTried = (id) => {
    const n = news(state); const it = aiItem(id); if (!it) return;
    it.done = !it.done;
    const sv = aiSaved(state).find(x => x.key === aiKey(it)); if (sv) sv.done = it.done;
    n.aiTried = (n.aiTried || []).filter(x => x.t !== it.try);
    if (it.done) n.aiTried.unshift({ t: it.try, d: todayKey() });
    n.aiTried = n.aiTried.slice(0, 60);
    saveDataQuiet(); render();
  };
  window.newsAiSave = (id) => {
    const it = aiItem(id); if (!it) return;
    const list = aiSaved(state); const k = aiKey(it);
    const i = list.findIndex(x => x.key === k);
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ key: k, title: it.title, link: it.link, source: it.source, kind: it.kind, what: it.what, try: it.try, savedAt: Date.now(), done: !!it.done });
    saveDataQuiet(); render();
  };
  window.newsSavedTried = (idx) => {
    const x = aiSaved(state)[idx]; if (!x) return;
    x.done = !x.done;
    const it = (aiEdition(state)?.items || []).find(i => aiKey(i) === x.key); if (it) it.done = x.done;
    saveDataQuiet(); render();
  };
  window.newsSavedRemove = (idx) => {
    aiSaved(state).splice(idx, 1);
    saveDataQuiet(); render();
  };
  window.newsAiVote = (id, v) => {
    const n = news(state); const it = aiItem(id); if (!it) return;
    it.v = it.v === v ? 0 : v;
    const key = it.title + ' — ' + it.what;
    n.aiVotes = (n.aiVotes || []).filter(x => x.t !== key);
    if (it.v) n.aiVotes.unshift({ t: key, v: it.v });
    n.aiVotes = n.aiVotes.slice(0, 120);
    saveDataQuiet(); render();
  };
  window.newsRate = (idx, v) => {
    const n = news(state); const b = briefing(state); if (!b) return;
    const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;
    const sct = briefSections(b, ed)[idx]; if (!sct || !sct.kind) return;
    const key = secKey(b, sct);
    n.briefRatings = n.briefRatings || [];
    const old = n.briefRatings.find(x => x.key === key);
    n.briefRatings = n.briefRatings.filter(x => x.key !== key);
    if (!old || old.r !== v) n.briefRatings.unshift({ d: b.date, k: sct.kind, key, t: String(sct.title || '').replace(/<[^>]+>/g, '').slice(0, 160), tag: sct.tag || '', src: sct.src || '', r: v });
    n.briefRatings = n.briefRatings.slice(0, 400);
    const y = window.scrollY; saveDataQuiet(); render(); window.scrollTo(0, y);
  };
  window.newsSeen = (id) => {
    const e = news(state).edition; if (!e) return;
    const it = e.items.find(x => x.id === id); if (!it) return;
    it.seen = true;
    addSeen(state, it, true);
    flush(); saveDataQuiet(); render();
  };
  window.newsUnseen = (id) => {
    const e = news(state).edition; if (!e) return;
    const it = e.items.find(x => x.id === id); if (!it) return;
    it.seen = false;
    // Still in today's edition, so keep it remembered (just not as one you hid).
    removeSeen(state, it); addSeen(state, it, false);
    flush(); saveDataQuiet(); render();
  };
  window.newsRetry = () => { N.error = null; buildEdition(state, saveDataQuiet, render); };
  window.newsVote = (id, v) => {
    const n = news(state);
    const e = n.edition; if (!e) return;
    const it = e.items.find(x => x.id === id); if (!it) return;
    it.v = it.v === v ? 0 : v;                    // tap again to undo
    n.votes = n.votes.filter(x => x.t !== it.title);
    if (it.v) n.votes.unshift({ t: it.title, tag: it.tag, src: it.source, v: it.v, d: todayKey() });
    n.votes = n.votes.slice(0, 300);
    flush(); saveDataQuiet(); render();
  };
}

// Called when you switch to another dashboard page: count up to now, pause.
export function leaveNewsTab({ saveDataQuiet } = {}) {
  if (N.flush) N.flush();
  N.running = false; N.lastTick = null; N.view = null;
  clearInterval(N.timer);
  if (saveDataQuiet) saveDataQuiet();
}
