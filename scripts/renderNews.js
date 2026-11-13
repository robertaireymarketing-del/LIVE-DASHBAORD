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
// Data: state.data.news = {
//   usage:   { date:'YYYY-MM-DD', secs },
//   edition: { date, items:[{id,title,link,source,summary,tag,score,why,v}], generatedAt, model },
//   votes:   [{ t, tag, src, v:1|-1, d }]   (newest first, capped)
// }

const DAILY_SECS = 5 * 60;
const MAX_STORIES = 10;
const ENDPOINT = '/.netlify/functions/news';

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
function secsLeft(state) { return DAILY_SECS - (news(state).usage.secs || 0); }

// ── What it has learned from your votes ────────────────────────────────────
function learned(votes) {
  const tag = {}, src = {};
  votes.slice(0, 200).forEach(x => {
    if (x.tag) tag[x.tag] = (tag[x.tag] || 0) + x.v;
    if (x.src) src[x.src] = (src[x.src] || 0) + x.v;
  });
  return { tag, src };
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
    const { items } = await post({ action: 'feeds' });
    if (!items || !items.length) throw new Error('No stories came back from the feeds. Try again in a minute.');

    const liked = n.votes.filter(x => x.v > 0).slice(0, 40).map(x => ({ t: x.t, tag: x.tag }));
    const disliked = n.votes.filter(x => x.v < 0).slice(0, 40).map(x => ({ t: x.t, tag: x.tag }));
    let ranked, model = null;
    try {
      const r = await post({ action: 'rank', items: items.map(({ id, title, summary, source }) => ({ id, title, summary, source })), liked, disliked });
      ranked = r.ranked; model = r.model;
    } catch (e) {
      ranked = fallbackRank(items);
      N.note = 'The AI editor was unavailable, so today\'s picks are by keyword only. (' + e.message + ')';
    }

    const byId = Object.fromEntries(items.map(it => [it.id, it]));
    const L = learned(n.votes);
    const picked = ranked
      .map(r => { const it = byId[r.id]; return it ? { id: r.id, title: it.title, link: it.link, source: it.source, summary: it.summary, ts: it.ts, tag: r.tag, why: r.why, score: r.score } : null; })
      .filter(Boolean)
      .map(it => ({ ...it, rank: it.score + adjust(it, L) }))
      .filter(it => it.rank >= 5)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, MAX_STORIES);

    n.edition = { date: todayKey(), items: picked, generatedAt: Date.now(), model, note: N.note || null };
    saveDataQuiet();
  } catch (e) {
    N.error = e.message || String(e);
  }
  N.loading = false;
  if (state.activeTab === 'news') render();
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
body.light .nws { --card:#fff; --line:rgba(10,22,40,0.1); --mut:rgba(10,22,40,0.6); --faint:rgba(10,22,40,0.45); --gold:#B08D2E; }
body.light .nws-title, body.light .nws-h { color:#0A1628; }
body.light .nws-why { color:#5a4610; }
body.light .nws-list { color:#0A1628; }
body.light .nws-btn { color:#fff; }
</style>`;

function learnedChips(votes) {
  const L = learned(votes);
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
  const n = news(state);
  const left = secsLeft(state);
  const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;

  // ── Locked for the day ──
  if (left <= 0) {
    const likedToday = (ed ? ed.items : []).filter(it => it.v > 0);
    return `${NEWS_CSS}<div class="nws">
      <div class="nws-head"><div><div class="nws-title">📰 News</div><div class="nws-sub">Today's 5 minutes are used.</div></div></div>
      <div class="nws-card nws-gate">
        <div class="big">🔒</div>
        <div class="lbl">Locked until midnight</div>
        <p>Tomorrow's edition unlocks in <b>${untilMidnight()}</b>. You've got what matters for today, so get back to the work that actually moves things.</p>
      </div>
      ${likedToday.length ? `<div class="nws-card"><div class="nws-tag" style="display:inline-block;">Useful today</div>
        <ul class="nws-list">${likedToday.map(it => `<li>${esc(it.title)}</li>`).join('')}</ul></div>` : ''}
      ${n.votes.length ? `<div class="nws-card"><div class="nws-note">What it's learned from your ${n.votes.length} vote${n.votes.length === 1 ? '' : 's'}:</div>${learnedChips(n.votes)}</div>` : ''}
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
    else if (ed) status = `<p>${ed.items.length ? `${ed.items.length} stor${ed.items.length === 1 ? 'y' : 'ies'} worth your time today.` : 'Nothing today cleared the bar for affecting you. That\'s a good day.'} Built ${ago(ed.generatedAt)}.</p>`;
    return `${NEWS_CSS}<div class="nws">
      ${header}
      <div class="nws-card nws-gate">
        <div class="big">${fmt(left)}</div>
        <div class="lbl">${started ? 'left today' : 'per day'}</div>
        ${status}
        <button class="nws-btn" onclick="newsStart()" ${ed && !N.loading ? '' : 'disabled'}>${started ? 'Resume' : 'Start'}</button>
        <p style="font-size:12px;">The clock runs while you read here or in an article you open. It pauses if you switch to another page in the dashboard.</p>
      </div>
      ${n.votes.length ? `<div class="nws-card"><div class="nws-note">Tuned to you from ${n.votes.length} vote${n.votes.length === 1 ? '' : 's'}:</div>${learnedChips(n.votes)}</div>` : ''}
    </div>`;
  }

  // ── Reading ──
  const items = ed ? ed.items : [];
  const stories = items.map(it => `
    <div class="nws-card nws-story">
      <div class="nws-meta"><span class="nws-tag">${esc(it.tag)}</span><span>${esc(it.source)}</span>${it.ts ? `<span>· ${ago(it.ts)}</span>` : ''}</div>
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
    ${stories || `<div class="nws-card nws-gate"><p>Nothing today cleared the bar for affecting you. That's a good day — close this and get on.</p></div>`}
    <button class="nws-btn ghost" onclick="newsDone()">I'm done for today</button>
  </div>`;
}

// ── Behaviour ──────────────────────────────────────────────────────────────
export function initNewsTab({ state, saveDataQuiet, render }) {
  const n = news(state);   // re-read inside handlers too: state.data can be swapped by a reload
  const ed = n.edition && n.edition.date === todayKey() ? n.edition : null;
  if (!ed && !N.loading && !N.error && secsLeft(state) > 0) buildEdition(state, saveDataQuiet, render);

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
  N.running = false; N.lastTick = null;
  clearInterval(N.timer);
  if (saveDataQuiet) saveDataQuiet();
}
