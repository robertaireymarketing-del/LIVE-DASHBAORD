// Pure data-getter factory — no render, no saveData.
// Usage: const { getToday, getSettings, ... } = createHelpers({ state, defaultSettings, STOIC_QUOTES });

export function createHelpers({ state, defaultSettings, STOIC_QUOTES }) {

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getAllDays() {
    const dataDays = state.data?.days;
    if (dataDays && typeof dataDays === 'object') return dataDays;
    const rootDays = state.days;
    if (rootDays && typeof rootDays === 'object') return rootDays;
    return {};
  }

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

  function getDayByDate(dateStr) {
    const norm = normalizeDateKey(dateStr);
    const days = getAllDays();
    if (days[norm]) return days[norm];
    for (const [key, value] of Object.entries(days)) {
      if (normalizeDateKey(key) === norm) return value;
    }
    return null;
  }

  function getWeekKey(date = new Date()) {
    const d = new Date(date); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const w1 = new Date(d.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
    return d.getFullYear() + '-W' + String(wn).padStart(2,'0');
  }

  function getNextWeekKey() { const d = new Date(); d.setDate(d.getDate() + 7); return getWeekKey(d); }
  function getTodayDayKey() { return ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]; }
  function isSunday() { return new Date().getDay() === 0; }

  function getSettings() { return state.data?.settings || defaultSettings; }

  function getProjectFronts() {
    return state.data.projectFronts || {
      tjm:    { name:'TJM', status:'priority', weekPlans:{} },
      vinted: { name:'Vinted', status:'pipeline', weekPlans:{} },
      notts:  { name:'Nottingham Insurance', status:'engine', weekPlans:{} },
      _other: { name:'Other', status:'pipeline', weekPlans:{} }
    };
  }

  function getTJMBatches()     { return (state.data.tjmBatches || []).filter(b => b.status !== 'archived'); }
  function getVintedItems()    { return state.data.vintedItems || []; }
  function getNottinghamData() {
    return state.data.nottinghamInsurance || {
      goal: 'Build a profitable lead generation site targeting protection insurance in Nottingham, generating passive affiliate income.',
      tasks: []
    };
  }
  function getIdentityLock() {
    return state.data.identityLock || {
      headline: 'BUILD THE MAN. BUILD THE BODY. BUILD THE BUSINESSES.',
      coreIdentity: 'I am a stoic, disciplined, masculine man. I stay in shape, lead calmly, execute hard things, and build real businesses with consistency.',
      dailyCommand: 'Advance the front. Do not drift.'
    };
  }
  function getMissionTargets() {
    return state.data.missionTargets || [
      { id:'1', icon:'£', title:'Business',  description:'£10k/month after tax from TJM by Aug 2026.', deadline:'2026-08-01' },
      { id:'2', icon:'⊕', title:'Physique',  description:'220 lbs at 13% body fat with strength, sharpness, and control.', deadline:'2026-08-01' },
      { id:'3', icon:'A', title:'Identity',  description:'Disciplined leader. Calm under pressure. Ruthless executor.', deadline:'' }
    ];
  }

  function getDayNumber() {
    const todayStr = getToday();
    const startStr = getSettings().startDate || '2026-03-01';
    const today = new Date(todayStr + 'T12:00:00');
    const start = new Date(startStr + 'T12:00:00');
    return Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
  }

  function getDailyQuote() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    return STOIC_QUOTES[dayOfYear % STOIC_QUOTES.length];
  }

  function getLatestWeight() {
    const settings = getSettings();
    const syncEntries = (state.healthData || []).filter(h => h.weight).sort((a,b) => b.date.localeCompare(a.date));
    if (syncEntries.length) return +syncEntries[0].weight.toFixed(1);
    const days = getAllDays();
    const sortedDays = Object.entries(days).filter(([_, d]) => d.weight).sort((a, b) => b[0].localeCompare(a[0]));
    return sortedDays[0]?.[1]?.weight || settings.startWeight;
  }

  function getLatestBodyFat() {
    const settings = getSettings();
    const syncEntries = (state.healthData || []).filter(h => h.bodyFat).sort((a,b) => b.date.localeCompare(a.date));
    if (syncEntries.length) return +syncEntries[0].bodyFat.toFixed(1);
    const days = getAllDays();
    const sortedDays = Object.entries(days).filter(([_, d]) => d.bodyFat).sort((a, b) => b[0].localeCompare(a[0]));
    return sortedDays[0]?.[1]?.bodyFat || settings.startBodyFat;
  }

  function getLatestWeightDate() {
    const syncEntries = (state.healthData || []).filter(h => h.weight).sort((a,b) => b.date.localeCompare(a.date));
    if (syncEntries.length) return { date: syncEntries[0].date, ts: syncEntries[0].syncedAt, source: 'sync' };
    const days = getAllDays();
    const sortedDays = Object.entries(days).filter(([_, d]) => d.weight).sort((a, b) => b[0].localeCompare(a[0]));
    return sortedDays[0] ? { date: sortedDays[0][0], ts: sortedDays[0][1].weightSavedAt || null, source: 'manual' } : null;
  }

  function getLatestBodyFatDate() {
    const syncEntries = (state.healthData || []).filter(h => h.bodyFat).sort((a,b) => b.date.localeCompare(a.date));
    if (syncEntries.length) return { date: syncEntries[0].date, ts: syncEntries[0].syncedAt, source: 'sync' };
    const days = getAllDays();
    const sortedDays = Object.entries(days).filter(([_, d]) => d.bodyFat).sort((a, b) => b[0].localeCompare(a[0]));
    return sortedDays[0] ? { date: sortedDays[0][0], ts: sortedDays[0][1].bfSavedAt || null, source: 'manual' } : null;
  }

  function getStartLeanMass() {
    const s = getSettings();
    return +(s.startWeight * (1 - s.startBodyFat / 100)).toFixed(1);
  }

  function getCurrentLeanMass() {
    const w  = getLatestWeight();
    const bf = getLatestBodyFat();
    return +(w * (1 - bf / 100)).toFixed(1);
  }

  function getDerivedTargetWeight() {
    const targetBF = getSettings().targetBodyFat;
    return +(getCurrentLeanMass() / (1 - targetBF / 100)).toFixed(1);
  }

  function getTodayData() {
    const today = getToday();
    return getDayByDate(today) || {
      gym: false, retention: false, meditation: false, weight: null, bodyFat: null,
      calories: null, gymCalories: null, treadmillCalories: null, dailyBmr: null,
      live: false, sales: 0, warmLeads: 0, dmsSent: 0, salesPost: false, growthPost: false,
      objectives: [{ text: '', done: false }, { text: '', done: false }, { text: '', done: false }]
    };
  }

  function getStreak(field) {
    const days = getAllDays();
    const sortedDays = Object.keys(days).sort().reverse();
    let streak = 0;
    for (const day of sortedDays) {
      if (days[day]?.[field]) streak++;
      else break;
    }
    return streak;
  }

  function formatSyncLabel(info) {
    if (!info) return 'No data yet';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let datePart;
    if (info.date === today) datePart = 'today';
    else if (info.date === yesterday) datePart = 'yesterday';
    else { const d = new Date(info.date); datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
    if (info.ts) {
      const t = new Date(info.ts);
      return `Updated ${datePart} at ${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Updated ${datePart}`;
  }

  function getCurrentBmr() {
    const todayData = getTodayData();
    return todayData.dailyBmr || getSettings().defaultBmr;
  }

  function getMonthDaysRemaining() {
    const today = new Date();
    const y = state.calendarYear, m = state.calendarMonth;
    const lastDay = new Date(y, m + 1, 0);
    if (today.getFullYear() === y && today.getMonth() === m) {
      return Math.max(0, lastDay.getDate() - today.getDate());
    }
    return 0;
  }

  function getMonthStats() {
    const y = state.calendarYear, m = state.calendarMonth;
    const prefix = `${y}-${String(m+1).padStart(2,'0')}`;
    const stats = { lives: 0, sales: 0, revenue: 0, warmLeads: 0, dmsSent: 0, gymDays: 0, retentionDays: 0 };
    Object.entries(getAllDays()).forEach(([date, d]) => {
      const norm = normalizeDateKey(date);
      if (!String(norm).startsWith(prefix)) return;
      if (d.live) stats.lives++;
      if (d.gym) stats.gymDays++;
      if (d.retention) stats.retentionDays++;
      stats.sales    += d.sales    || 0;
      stats.revenue  += d.revenue  || 0;
      stats.warmLeads += d.warmLeads || 0;
      stats.dmsSent  += d.dmsSent  || 0;
    });
    return stats;
  }

  function getMonthTargets(y, m) {
    const key = `${y}-${String(m+1).padStart(2,'0')}`;
    const stored = state.data?.monthTargets?.[key];
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return {
      lives:     stored?.lives     ?? 20,
      sales:     stored?.sales     ?? 10,
      gym:       stored?.gym       ?? daysInMonth,
      retention: stored?.retention ?? daysInMonth
    };
  }

  function syncCalendarToDataMonth() {
    const entries = Object.keys(state.data?.days || {})
      .map(normalizeDateKey)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (!entries.length) return;
    const currentPrefix = `${state.calendarYear}-${String(state.calendarMonth+1).padStart(2,'0')}`;
    const hasCurrentMonthData = entries.some(d => d.startsWith(currentPrefix));
    if (hasCurrentMonthData) return;
    const latest = entries[entries.length - 1];
    const [yy, mm] = latest.split('-');
    state.calendarYear = Number(yy);
    state.calendarMonth = Number(mm) - 1;
  }

  function getDaysRemaining() {
    const today = new Date();
    const deadline = new Date(getSettings().deadline);
    return Math.max(0, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)));
  }

  return {
    getToday, getAllDays, normalizeDateKey, getDayByDate,
    getWeekKey, getNextWeekKey, getTodayDayKey, isSunday,
    getSettings, getProjectFronts, getTJMBatches, getVintedItems,
    getNottinghamData, getIdentityLock, getMissionTargets,
    getDayNumber, getDailyQuote,
    getLatestWeight, getLatestBodyFat, getLatestWeightDate, getLatestBodyFatDate,
    getStartLeanMass, getCurrentLeanMass, getDerivedTargetWeight,
    getTodayData, getStreak, formatSyncLabel, getCurrentBmr,
    getMonthDaysRemaining, getMonthStats, getMonthTargets,
    syncCalendarToDataMonth, getDaysRemaining,
  };
}
