function normalizeDateKey(key) {
  if (!key) return '';
  const str = String(key).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const simple = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (simple) {
    const [, y, m, d] = simple;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  const isoLike = str.match(/^(\d{4}-\d{1,2}-\d{1,2})/);
  if (isoLike) return normalizeDateKey(isoLike[1]);
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return str;
}

export function createStorage({
  state,
  defaultSettings,
  render,
  getSettings,
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
}) {
  async function saveData() {
    if (!state.user || !state.data) return;
    state.data.days = state.data.days || state.days || {};
    state.days = state.data.days;
    state.saving = true;
    render();
    try {
      await setDoc(doc(db, 'users', state.user.uid), state.data, { merge: true });
    } catch (e) {
      console.error('Save failed:', e);
    }
    // Full-state cache for instant paint on next open
    try { localStorage.setItem('tjm_state_cache', JSON.stringify(state.data)); } catch(e) {}
    state.saving = false;
    render();
  }

  async function saveDataQuiet() {
    if (!state.user || !state.data) return;
    state.data.days = state.data.days || state.days || {};
    state.days = state.data.days;

    // ── Local backup (belt-and-braces) ──────────────────────
    try {
      localStorage.setItem('tjm_state_cache', JSON.stringify(state.data));
      localStorage.setItem('tjm_backup_journal', JSON.stringify(state.data.journal || {}));
      localStorage.setItem('tjm_backup_days', JSON.stringify(state.data.days || {}));
      localStorage.setItem('tjm_backup_at', new Date().toISOString());
    } catch(e) { /* storage full — non-fatal */ }
    // ────────────────────────────────────────────────────────

    try {
      await setDoc(doc(db, 'users', state.user.uid), state.data, { merge: true });
    } catch (e) {
      console.error('Quiet save failed:', e);
    }
  }

  async function loadData() {
    if (!state.user) return;

    // ── Optimistic paint: show cached data instantly while Firestore loads ──
    // Health sync data is cached too — the Home Gym/Diet cards depend on it, and
    // without it every refresh painted Diet red until the healthSync fetch landed.
    try {
      const hc = localStorage.getItem('tjm_health_cache');
      if (hc && !(state.healthData && state.healthData.length)) state.healthData = JSON.parse(hc) || [];
    } catch (e) { /* bad cache — the network load will fill it */ }
    try {
      const cached = localStorage.getItem('tjm_state_cache');
      if (cached && !state.data) {
        state.data = JSON.parse(cached);
        state.data.days = state.data.days || {};
        state.days = state.data.days;
        render(); // paint immediately — fresh data replaces this a moment later
      }
    } catch (e) { /* bad/absent cache — ignore, fall through to network */ }

    try {
      const docSnap = await getDoc(doc(db, 'users', state.user.uid));
      if (docSnap.exists()) {
        state.data = docSnap.data();
        state.data.days = state.data.days || {};
        state.days = state.data.days;
        try { localStorage.setItem('tjm_state_cache', JSON.stringify(state.data)); } catch(e) {}
      } else {
        state.data = {
          days: {},
          journal: {},
          settings: defaultSettings,
          overrides: {},
          marchStats: { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0 }
        };
        await saveData();
      }
    } catch (e) {
      console.error('Load failed:', e);
      // ── Restore from local backup if available ──
      // If optimistic paint already populated state.data from cache, KEEP it —
      // the old code overwrote a full snapshot with a days+journal-only stub.
      if (!state.data) {
        // Prefer the full-state cache (covers planner: projectFronts, dayBatchPlan, etc.)
        try {
          const fullCache = localStorage.getItem('tjm_state_cache');
          if (fullCache) state.data = JSON.parse(fullCache);
        } catch (_) { /* corrupt cache — fall through to partial backup */ }

        // Legacy partial fallback (days + journal only) if no full cache exists
        if (!state.data) {
          const backupJournal = localStorage.getItem('tjm_backup_journal');
          const backupDays = localStorage.getItem('tjm_backup_days');
          state.data = {
            days: backupDays ? JSON.parse(backupDays) : {},
            journal: backupJournal ? JSON.parse(backupJournal) : {},
            settings: defaultSettings,
            overrides: {},
            marchStats: { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0 }
          };
        }
      }
      state.data.days = state.data.days || {};
      state.days = state.data.days;
    }
    render();
  }

  async function loadHealthData(attempt = 1) {
    try {
      console.log('[HealthSync] Starting load from healthSync collection...');
      // Load the WHOLE collection. The old query (orderBy('date') + limit(90)) silently
      // dropped history: Firestore's orderBy skips any doc without a 'date' field, and
      // 90 docs isn't 90 days if the Shortcut ever writes more than one doc per day.
      // One small doc per day ≈ 365 docs/year, which is fine to read in one go.
      const snap = await getDocs(collection(db, 'healthSync'));
      console.log(`[HealthSync] Got ${snap.docs.length} document(s) from Firestore`);

      if (snap.docs.length === 0) {
        console.warn('[HealthSync] No documents found. Check: (1) iOS Shortcut is writing to healthSync/<date>, (2) Firestore rules allow reads, (3) correct Firebase project is connected.');
      }

      // Normalise any date string to YYYY-MM-DD (handles 2026-7-4, 2026-07-04T07:12:00,
      // 04/07/2026 (UK), "4 Jul 2026", Firestore timestamps).
      const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
      const pad = (n) => String(n).padStart(2, '0');
      const normDate = (v) => {
        if (v == null || v === '') return null;
        if (typeof v === 'object' && typeof v.toDate === 'function') v = v.toDate();
        if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
        const str = String(v).trim();
        let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
        m = str.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); // UK day/month/year
        if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
        m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
        if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
        const t = new Date(str);
        return isNaN(t) ? null : `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
      };

      const rawEntries = snap.docs.map(d => {
        const raw = d.data();
        const parse = (v) => {
          if (v === null || v === undefined) return null;
          if (typeof v === 'object' && v.stringValue !== undefined) return v.stringValue;
          if (typeof v === 'object' && v.doubleValue !== undefined) return v.doubleValue;
          return v;
        };
        const parseNum = (v) => {
          const s = parse(v);
          if (s === null || s === undefined) return null;
          const n = parseFloat(String(s).replace(/[^0-9.-]/g, ''));
          return isNaN(n) ? null : n;
        };
        const rawBmr = parseNum(raw.bmr);
        // Note: bmr >= 500 guard removed — was silently dropping valid low BMR values
        const entry = {
          date: normDate(raw.date && typeof raw.date === 'object' && typeof raw.date.toDate === 'function' ? raw.date : parse(raw.date)) || normDate(d.id) || String(parse(raw.date) || d.id),
          weight: parseNum(raw.weight),
          bodyFat: parseNum(raw.bodyFat),
          bmr: (rawBmr && rawBmr > 0) ? rawBmr : null,
          steps: parseNum(raw.steps),
          // Dietary energy — accept any field name the iOS Shortcut might use
          calories: parseNum(raw.calories) ?? parseNum(raw.dietaryEnergy) ?? parseNum(raw.dietaryCalories) ?? parseNum(raw.energy) ?? parseNum(raw.dietary_energy) ?? parseNum(raw.food),
          // Active energy — accept any field name the iOS Shortcut might use
          gymCalories: parseNum(raw.gymCalories) ?? parseNum(raw.activeEnergy) ?? parseNum(raw.activeCalories) ?? parseNum(raw.active_energy) ?? parseNum(raw.exerciseCalories),
          // Workouts (Garmin → Apple Health → Shortcut). Total workout minutes for the day,
          // plus a count. Accepts any field name the iOS Shortcut might use.
          workoutMinutes: parseNum(raw.workoutMinutes) ?? parseNum(raw.workoutDuration) ?? parseNum(raw.workout_minutes) ?? parseNum(raw.workoutMins),
          workoutCount: parseNum(raw.workoutCount) ?? parseNum(raw.workouts) ?? parseNum(raw.workout_count),
          // Workout calories (energy burned in the day's workouts only — not all-day active energy)
          workoutCalories: parseNum(raw.workoutCalories) ?? parseNum(raw.workoutEnergy) ?? parseNum(raw.workoutKcal) ?? parseNum(raw.workout_calories) ?? parseNum(raw.workoutActiveEnergy),
          workoutType: parse(raw.workoutType) ?? parse(raw.workoutTypes) ?? null,
          // Protein — accept any field name the iOS Shortcut might use
          protein: parseNum(raw.protein) ?? parseNum(raw.dietaryProtein) ?? parseNum(raw.dietary_protein) ?? parseNum(raw.proteinGrams),
          // d.updateTime is not available on modular SDK snapshot docs. Prefer a REAL
          // timestamp written by the iOS Shortcut (any of syncedAt / syncTime / timestamp /
          // time) so we can show WHEN the reading was actually taken. Accepts an ISO string,
          // epoch seconds, or epoch millis. If the doc carries no timestamp we fall back to
          // load-time — that only marks when the dashboard last pulled, not the measurement.
          syncedAt: (() => {
            const rawTs = parse(raw.syncedAt) ?? parse(raw.syncTime) ?? parse(raw.timestamp) ?? parse(raw.time);
            if (rawTs !== null && rawTs !== undefined && rawTs !== '') {
              const n = Number(rawTs);
              if (!Number.isNaN(n) && n > 0) return n < 1e12 ? n * 1000 : n; // secs → ms
              const t = new Date(rawTs).getTime();
              if (!Number.isNaN(t)) return t;
            }
            return d.metadata?.hasPendingWrites === false ? Date.now() : null;
          })(),
          // 'device' = real time the Shortcut stamped; 'load' = fallback (app-load time only)
          syncedAtSource: ((parse(raw.syncedAt) ?? parse(raw.syncTime) ?? parse(raw.timestamp) ?? parse(raw.time)) != null) ? 'device' : 'load',
        };
        console.log(`[HealthSync] Doc ${d.id}:`, entry);
        return entry;
      });

      // One entry per day: if several docs share a date, merge them field by field,
      // preferring the most recently synced non-empty value.
      const byDate = {};
      rawEntries
        .sort((a, b) => (a.syncedAt || 0) - (b.syncedAt || 0))
        .forEach(e => {
          const cur = byDate[e.date] || (byDate[e.date] = { date: e.date });
          Object.entries(e).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') cur[k] = v; });
        });
      state.healthData = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date)); // newest first, as before

      console.log(`[HealthSync] Loaded ${state.healthData.length} entries. Most recent:`, state.healthData[0] || 'none');
      try { localStorage.setItem('tjm_health_cache', JSON.stringify(state.healthData)); } catch (e) { /* storage full — non-fatal */ }

      state.days = state.data?.days || state.days || {};
      const todayStr = new Date().toISOString().slice(0,10);
      const todayHealth = state.healthData.find(h => h.date === todayStr);
      if (todayHealth && state.data) {
        const day = state.data.days?.[todayStr] || {};
        if (!day.weight && todayHealth.weight) day.weight = todayHealth.weight;
        if (!day.bodyFat && todayHealth.bodyFat) day.bodyFat = todayHealth.bodyFat;
        if (!day.dailyBmr && todayHealth.bmr) day.dailyBmr = todayHealth.bmr;
        if (!day.calories && todayHealth.calories) day.calories = todayHealth.calories;
        state.data.days = state.data.days || {};
        state.data.days[todayStr] = day;
        state.days = state.data.days;
        console.log('[HealthSync] Auto-filled today\'s day entry from sync data.');
      } else {
        console.log(`[HealthSync] No entry for today (${todayStr}) — nothing auto-filled.`);
      }
    } catch (e) {
      console.error('[HealthSync] Load FAILED:', e);
      console.error('[HealthSync] This is likely a Firestore permissions error or wrong Firebase project. Check your firebase.js config and Firestore rules.');
      // A dropped connection on load used to leave Home without sync data until a
      // manual refresh. Retry a couple of times before giving up (cache still shows).
      if (attempt < 3) { setTimeout(() => loadHealthData(attempt + 1), 3000 * attempt); return; }
    }
    // This resolves a second or two AFTER first paint. A render() here tears
    // down the DOM and blows away scroll position and focus — do not do it
    // while the user is in the journal. Health data doesn't feed this tab
    // anyway; the next natural render will pick it up.
    if (state.activeTab !== 'journal') render();
  }

  function recalculateMarchStats() {
    const startDate = getSettings().startDate || defaultSettings.startDate;
    const challengeStats = { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0 };
    Object.entries(state.data.days || {}).forEach(([rawDate, dayData]) => {
      const date = normalizeDateKey(rawDate);
      if (date >= startDate) {
        if (dayData.live) challengeStats.lives++;
        if (dayData.gym) challengeStats.gymDays++;
        challengeStats.sales += dayData.sales || 0;
        challengeStats.revenue += dayData.revenue || 0;
        challengeStats.warmLeads += dayData.warmLeads || 0;
        challengeStats.dmsSent += dayData.dmsSent || 0;
      }
    });
    state.data.marchStats = challengeStats;
  }

  function updateDayField(dateStr, field, value) {
    const dayData = state.data.days?.[dateStr] || {};
    const newDayData = { ...dayData, [field]: value };
    if (field === 'weight') newDayData.weightSavedAt = Date.now();
    if (field === 'bodyFat') newDayData.bfSavedAt = Date.now();
    state.data.days = { ...state.data.days, [dateStr]: newDayData };
    state.days = state.data.days;
    recalculateMarchStats();
    saveData();
    render();
  }

  function updateSettings(field, value) {
    state.data.settings = { ...getSettings(), [field]: value };
    saveData();
    render();
  }

  return {
    saveData,
    saveDataQuiet,
    loadData,
    loadHealthData,
    updateDayField,
    recalculateMarchStats,
    updateSettings,
  };
}
