// ── HEALTH SYNC STATUS ─────────────────────────────────────────────────────
// Card at the top of the Health page that answers "has my sync landed and is
// everything up to date?" at a glance.
//
// Status (worst first):
//   • Checking…           — loadHealthData() in flight (state.healthLoading)
//   • Couldn't connect     — load failed after retries (state.healthLoadError)
//   • No sync yet today    — no healthSync/<today> doc
//   • Last sync X h ago    — today's doc exists but the Shortcut's timestamp is > 3 h old
//   • ✓ All up to date     — today's doc exists and (if timestamped) is < 3 h old
// Below: which of today's fields arrived (weight, body fat, resting, active, food,
// protein, steps, workouts), when the Shortcut last ran (needs a syncedAt field
// from the Shortcut — shown as a tip if missing) and when the app last checked.
//
// The app re-checks automatically when you switch back to it (visibilitychange in
// app.js), so: run the Shortcut → come back → this card updates by itself.
// state.healthSyncChange = 'new' | 'same' after a manual/auto re-check.

const STALE_HOURS = 3;

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60), r = m % 60;
  return r && h < 6 ? `${h} h ${r} min ago` : `${h} h ago`;
}
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function renderHealthSyncStatus(state, todayStr, isLight) {
  const t = (d, l) => (isLight ? l : d);
  const health = state.healthData || [];
  const today = health.find(h => h.date === todayStr) || null;
  const devTime = today && today.syncedAtSource === 'device' && today.syncedAt ? +new Date(today.syncedAt) : null;
  const ageH = devTime ? (Date.now() - devTime) / 3600000 : null;
  const last = [...health].sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  let kind, title, sub;
  if (state.healthLoading && !today) { kind = 'wait'; title = 'Checking for new data…'; sub = 'Fetching the latest from your Health Sync.'; }
  else if (state.healthLoadError) { kind = 'bad'; title = 'Couldn’t connect'; sub = 'Showing the last saved copy. Check your signal and tap Check again.'; }
  else if (!today) {
    kind = 'bad'; title = 'No sync yet today';
    sub = last ? `Last data is from ${new Date(last.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}. Run Health Sync on your phone.` : 'Run Health Sync on your phone.';
  } else if (ageH != null && ageH > STALE_HOURS) {
    kind = 'warn'; title = `Last sync ${hhmm(devTime)}`;
    sub = `${ago(devTime)}. Open Garmin Connect, then run Health Sync to bring it up to date.`;
  } else {
    kind = 'ok'; title = 'All up to date';
    sub = devTime ? `Health Sync ran at ${hhmm(devTime)} (${ago(devTime)}).` : 'Today’s data has arrived.';
  }

  const PAL = {
    ok: { bg: t('#0d2a1a', '#E9F8EF'), bd: t('#27ae60', '#16A34A'), fg: t('#2ecc71', '#15803D'), icon: '✓' },
    warn: { bg: t('#2a1f05', '#FFF6E0'), bd: t('#f39c12', '#D97706'), fg: t('#f5b041', '#B45309'), icon: '!' },
    bad: { bg: t('#2a0d0d', '#FDECEC'), bd: t('#e74c3c', '#DC2626'), fg: t('#ff6b5b', '#B91C1C'), icon: '✕' },
    wait: { bg: t('#101822', '#EEF2F7'), bd: t('#3a5068', '#94A3B8'), fg: t('#a8bfd4', '#334155'), icon: '…' },
  };
  const pal = PAL[kind];
  const txt = t('#FFFFFF', '#0A1628'), mut = t('rgba(255,255,255,0.55)', 'rgba(10,22,40,0.6)');

  // What arrived today
  const has = (v) => v != null && v !== '' && !(typeof v === 'number' && v <= 0);
  const fields = [
    ['Weight', today && has(today.weight)],
    ['Body fat', today && has(today.bodyFat)],
    ['Resting', today && has(today.bmr)],
    ['Active', today && has(today.gymCalories)],
    ['Food', today && has(today.calories)],
    ['Protein', today && has(today.protein)],
    ['Steps', today && has(today.steps)],
    ['Workouts', today && (has(today.workoutCount) || has(today.workoutMinutes) || has(today.workoutCalories))],
  ];
  const chip = ([l, ok]) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;padding:4px 8px;border-radius:20px;
    background:${ok ? t('rgba(46,204,113,0.14)', 'rgba(22,163,74,0.12)') : t('rgba(255,255,255,0.05)', 'rgba(10,22,40,0.06)')};
    color:${ok ? PAL.ok.fg : mut};">${ok ? '✓' : '–'} ${l}</span>`;

  const change = state.healthSyncChange === 'new' ? `<span style="color:${PAL.ok.fg};font-weight:900;">New data received ✓</span> · `
    : state.healthSyncChange === 'same' ? 'No change since the last check · ' : '';
  const checked = state.healthLoadedAt ? `${change}Checked ${ago(state.healthLoadedAt)}` : '';
  const tip = today && !devTime && kind !== 'bad' ? `<div style="font-size:11px;line-height:1.4;margin-top:8px;color:${mut};">Tip: add a <b style="color:${txt}">syncedAt</b> field to the Shortcut (Current Date, ISO 8601) and this card will show exactly when it last ran.</div>` : '';

  return `
  <div style="background:${pal.bg};border:2px solid ${pal.bd};border-radius:14px;padding:14px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="flex:0 0 40px;height:40px;border-radius:50%;background:${pal.bd};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;">${pal.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;font-weight:900;letter-spacing:2px;color:${pal.fg};">HEALTH SYNC</div>
        <div style="font-size:19px;font-weight:900;color:${txt};line-height:1.2;margin-top:2px;">${title}</div>
      </div>
      <button onclick="refreshHealthSync()" ${state.healthLoading ? 'disabled' : ''} style="flex:0 0 auto;height:36px;padding:0 12px;border-radius:10px;border:0;background:#C9A84C;color:#000;font-size:12px;font-weight:900;cursor:pointer;opacity:${state.healthLoading ? 0.5 : 1};">${state.healthLoading ? 'Checking…' : 'Check again'}</button>
    </div>
    <div style="font-size:12px;line-height:1.4;margin-top:8px;color:${txt};opacity:0.85;">${sub}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;">${fields.map(chip).join('')}</div>
    ${checked ? `<div style="font-size:11px;margin-top:8px;color:${mut};">${checked}</div>` : ''}
    ${tip}
  </div>`;
}
