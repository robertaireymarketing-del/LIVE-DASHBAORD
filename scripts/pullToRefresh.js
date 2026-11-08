// ── Pull to refresh ─────────────────────────────────────────────────────────
// Home-screen web apps on iPhone have no built-in pull-to-refresh, so this adds
// one. Pull down from the very top of the page past the threshold and let go:
// it does the same as the ↻ button in the header (clears the service-worker
// caches so you get the latest deploy, then reloads).
//
// Only starts when the page is scrolled to the top, and ignores pulls that begin
// inside something that is itself scrolled (a modal, a list), or when two
// fingers are used, so normal scrolling is unaffected.
(function () {
  const THRESHOLD = 80;   // px of finger travel needed to trigger
  const MAX_PULL = 130;   // px — indicator stops moving after this

  const style = document.createElement('style');
  style.textContent = `
    #ptr-indicator {
      position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 6px);
      width: 40px; height: 40px; margin-left: -20px; border-radius: 50%;
      background: #1c1c1c; border: 1px solid #333; box-shadow: 0 4px 14px rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; pointer-events: none; opacity: 0;
      transform: translateY(-60px); transition: opacity 0.15s;
    }
    body.light #ptr-indicator { background: #ffffff; border-color: #CDD4E0; box-shadow: 0 4px 14px rgba(10,22,40,0.15); }
    #ptr-indicator svg { width: 20px; height: 20px; transition: transform 0.15s; }
    #ptr-indicator.ready svg { transform: rotate(180deg); }
    #ptr-indicator.spinning svg { animation: ptrSpin 0.8s linear infinite; }
    @keyframes ptrSpin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const ind = document.createElement('div');
  ind.id = 'ptr-indicator';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v14"/><path d="M6 12l6 6 6-6"/></svg>`;
  const spinnerSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>`;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(ind));
  if (document.body) document.body.appendChild(ind);

  let startY = null, startX = null, pull = 0, active = false, refreshing = false;

  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  function insideScrolled(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 2) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollTop > 0) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function render() {
    const p = Math.min(pull, MAX_PULL);
    ind.style.opacity = String(Math.min(1, p / 40));
    ind.style.transform = `translateY(${p * 0.6 - 20}px)`;
    ind.classList.toggle('ready', pull >= THRESHOLD);
  }

  function reset() {
    startY = null; pull = 0; active = false;
    ind.style.transition = 'opacity 0.2s, transform 0.2s';
    ind.style.opacity = '0';
    ind.style.transform = 'translateY(-60px)';
    ind.classList.remove('ready');
    setTimeout(() => { ind.style.transition = 'opacity 0.15s'; }, 220);
  }

  async function doRefresh() {
    refreshing = true;
    ind.classList.remove('ready');
    ind.classList.add('spinning');
    ind.innerHTML = spinnerSvg;
    ind.style.opacity = '1';
    ind.style.transform = 'translateY(30px)';
    try {
      if ('serviceWorker' in navigator) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      }
    } catch (e) { /* reload anyway */ }
    window.location.reload();
  }

  window.addEventListener('touchstart', (e) => {
    if (refreshing || e.touches.length !== 1 || !atTop() || insideScrolled(e.target)) { startY = null; return; }
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; pull = 0; active = false;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (startY === null || refreshing) return;
    if (e.touches.length !== 1) { reset(); return; }
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (!active && Math.abs(dx) > Math.abs(dy)) { startY = null; return; } // sideways swipe, not a pull
    if (dy <= 0 || !atTop()) { if (active) reset(); else startY = null; return; }
    active = true;
    pull = dy * 0.6; // resistance
    render();
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (startY === null || refreshing) return;
    if (active && pull >= THRESHOLD) doRefresh(); else reset();
  }, { passive: true });

  window.addEventListener('touchcancel', () => { if (!refreshing) reset(); }, { passive: true });
})();
