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
      await setDoc(doc(db, 'users', state.user.uid), state.data);
    } catch (e) {
      console.error('Save failed:', e);
    }
    state.saving = false;
    render();
  }

  async function saveDataQuiet() {
    if (!state.user || !state.data) return;
    state.data.days = state.data.days || state.days || {};
    state.days = state.data.days;
    try {
      await setDoc(doc(db, 'users', state.user.uid), state.data);
    } catch (e) {
      console.error('Quiet save failed:', e);
    }
  }

  async function loadData() {
    if (!state.user) return;
    try {
      const docSnap = await getDoc(doc(db, 'users', state.user.uid));
      if (docSnap.exists()) {
        state.data = docSnap.data();
        state.data.days = state.data.days || {};
        state.days = state.data.days;
      } else {
        state.data = {
          days: {},
          settings: defaultSettings,
          overrides: {},
          marchStats: { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0 }
        };
        await saveData();
      }
    } catch (e) {
      console.error('Load failed:', e);
      state.data = {
        days: {},
        settings: defaultSettings,
        overrides: {},
        marchStats: { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0 }
      };
    }
    render();
  }

  async function loadHealthData() {
    try {
      console.log('[HealthSync] Starting load from healthSync collection...');
      const q = query(collection(db, 'healthSync'), orderBy('date', 'desc'), limit(90));
      const snap = await getDocs(q);
      console.log(`[HealthSync] Got ${snap.docs.length} document(s) from Firestore`);

      if (snap.docs.length === 0) {
        console.warn('[HealthSync] No documents found. Check: (1) iOS Shortcut is writing to healthSync/<date>, (2) Firestore rules allow reads, (3) correct Firebase project is connected.');
      }

      state.healthData = snap.docs.map(d => {
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
          date: parse(raw.date) || d.id,
          weight: parseNum(raw.weight),
          bodyFat: parseNum(raw.bodyFat),
          bmr: (rawBmr && rawBmr > 0) ? rawBmr : null,
          steps: parseNum(raw.steps),
          calories: parseNum(raw.calories),
          gymCalories: parseNum(raw.gymCalories),
          // d.updateTime is not available on modular SDK snapshot docs — use metadata instead
          syncedAt: d.metadata?.hasPendingWrites === false ? Date.now() : null,
        };
        console.log(`[HealthSync] Doc ${d.id}:`, entry);
        return entry;
      });

      console.log(`[HealthSync] Loaded ${state.healthData.length} entries. Most recent:`, state.healthData[0] || 'none');

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
    }
    render();
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
