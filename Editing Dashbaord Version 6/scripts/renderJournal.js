export function renderJournalTab() {

return `

<div class="journal-shell">

<div class="journal-header-card">

<div class="journal-nav">

<button class="journal-nav-btn" id="journalPrevDayBtn" aria-label="Previous day">←</button>

<div>

<div class="journal-day-name" id="journalDayName">Monday</div>

<div class="journal-full-date" id="journalFullDate">16 March 2026</div>

</div>

<button class="journal-nav-btn" id="journalNextDayBtn" aria-label="Next day">→</button>

<div style="position:relative;display:inline-block;">

<button class="journal-calendar-btn" id="journalCalendarBtn" aria-label="Choose date">📅</button>

<input class="journal-hidden-date-input" type="date" id="journalDatePicker" />

</div>

</div>

<div class="journal-meta">

<div id="journalWeekObjectives"></div>

<div id="journalBestVersionScore" style="display:flex;align-items:baseline;flex-wrap:wrap;gap:4px;margin-bottom:4px;"></div>

<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px;">

<div id="journalStreak" style="display:flex;align-items:center;gap:4px;"></div>

<button id="journalJumpToday" style="display:none;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);border-radius:20px;padding:4px 12px;color:#C9A84C;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;">↩ Today</button>

</div>

<div id="journalWeekMission" class="journal-week-mission"></div>

<div id="journalEntryStatus" style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;"></div>

</div>

</div>

<div class="journal-home">

<div class="journal-launch-grid">

<button class="journal-launch-btn" id="journalOpenMorningBtn">Morning Journal<small>Open readiness, identity, mission, and priorities</small></button>

<button class="journal-launch-btn" id="journalOpenEveningBtn">Evening Reflection<small>Open execution, reflection, and reset for tomorrow</small></button>

</div>

</div>

<div class="journal-card journal-collapsed" id="journalMorningCard">

<div class="journal-section-head">

<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">

<h2>Morning Journal</h2>

<span class="journal-status-badge" id="journalMorningCompletionBadge">In progress</span>

</div>

<div class="journal-section-actions">

<span class="journal-saved-pill" id="journalMorningSavedPill">Saved</span>

<button class="journal-toggle-btn" id="journalCollapseMorningBtn">Collapse</button>

</div>

</div>

<div class="journal-collapsible-content">

<div>

<h2>Morning Readiness Scan</h2>

<div class="journal-prompt">Score how you're feeling right now (0 = very low, 5 = excellent).</div>

${[

['Rested','rested'],['Mental Sharpness','sharpness'],['Calmness','calm'],['Motivation','motivation'],['Goal Clarity','clarity'],['Sex Drive','drive']

].map(([label,key]) => `

<div class="journal-score-row"><div class="journal-score-top"><span>${label}</span><span class="journal-score-value" id="journal-${key}-val">3</span></div><div class="journal-range-wrap"><div class="journal-range-ticks"><span></span><span></span><span></span><span></span><span></span><span></span></div><input class="journal-range" type="range" min="0" max="5" step="1" value="3" id="journal-${key}-range"></div></div>

`).join('')}

<div class="journal-score-total"><div class="journal-score-total-label">Morning Score Total (Readiness)</div><div class="journal-score-total-value"><span id="journalMorningScoreValue">18</span><span style="font-size:14px;color:inherit;font-weight:600;opacity:.6;"> / 30</span></div></div>

<div class="journal-note" id="journalMorningAveragesNote">Vs last week: -- · Vs month: --</div>

<div class="journal-note">These scores can later calculate weekly and monthly averages.</div>

</div>

<div><h2>Identity</h2><div class="journal-prompt">Who am I today?</div><textarea class="journal-textarea" id="journal-identity" placeholder="I am disciplined, focused, and aligned with the man I am becoming."></textarea></div>

<div><h2>Purpose</h2><div class="journal-prompt">Why does today matter for my future?</div><textarea class="journal-textarea" id="journal-purpose" placeholder="Because every focused day compounds toward freedom, strength, and the future I want to build."></textarea></div>

<div><h2>State &amp; Confidence</h2><div class="journal-prompt">How will I show up today, and why am I going to win?</div><textarea class="journal-textarea" id="journal-stateConfidence" placeholder="I will show up calm, sharp, and decisive, and I will win because I know what matters and I will act on it."></textarea></div>

<div class="journal-mission"><h2>Mission</h2><div class="journal-prompt">What single outcome today would move my mission forward the most?</div><textarea class="journal-textarea" id="journal-mission" placeholder="Plan and record the next batch of high-performing videos for The Jewellery Merchant."></textarea></div>

<div><h2>Top 3 Priorities</h2><div class="journal-priorities">

<div class="journal-priority"><div class="journal-number">1</div><input class="journal-input" type="text" id="journal-priority1" placeholder="Example: Write the hooks for 5 new videos" /></div>

<div class="journal-priority"><div class="journal-number">2</div><input class="journal-input" type="text" id="journal-priority2" placeholder="Example: Record the first 3 videos before 10am" /></div>

<div class="journal-priority"><div class="journal-number">3</div><input class="journal-input" type="text" id="journal-priority3" placeholder="Example: Review yesterday's content and note one improvement" /></div>

</div></div>

<div><h2>Obstacle Forecast</h2><div class="journal-prompt">What could derail me today?</div><textarea class="journal-textarea" id="journal-obstacles" placeholder="Scrolling, overthinking, low energy after eating, or getting pulled into low-value tasks."></textarea></div>

<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">

<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.3);text-align:center;letter-spacing:0.5px;">✓ Auto-saves when you collapse</div>

<button class="journal-toggle-btn" id="journalCollapseMorningBtnBottom">Collapse Morning Journal</button>

</div>

</div>

</div>

<div class="journal-card journal-collapsed" id="journalEveningCard">

<div class="journal-section-head">

<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">

<h2>Evening Reflection</h2>

<span class="journal-status-badge" id="journalEveningCompletionBadge">In progress</span>

</div>

<div class="journal-section-actions">

<span class="journal-saved-pill" id="journalEveningSavedPill">Saved</span>

<button class="journal-toggle-btn" id="journalCollapseEveningBtn">Collapse</button>

</div>

</div>

<div class="journal-collapsible-content">

<div>

<h2>Evening Execution Scan</h2>

<div class="journal-prompt">Rate the five core standards that determine whether you are becoming the man you intend to be (0 = failed standard, 5 = elite standard).</div>

<div class="journal-note">Score each metric on what you actually lived today, not what you meant to do.</div>

<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;">

<div>

<div style="font-size:13px;font-weight:800;color:var(--text, rgba(255,255,255,0.9));">TJM Sales Action</div>

<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">Did you take a sales action today? (post, live, DM follow-up)</div>

</div>

<button id="journalTjmSalesToggle" data-active="false" style="min-width:64px;padding:6px 14px;border-radius:20px;border:1px solid rgba(201,168,76,0.4);background:rgba(201,168,76,0.08);color:#C9A84C;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.5px;transition:all 0.2s;">NO</button>

</div>

${[

['Mission Execution','execution'],['Self Discipline','discipline'],['Dopamine Discipline','dopamine'],['Physical Standard','physical'],['Builder / CEO Mindset','builder'],['Sleep Prep','sleepprep']

].map(([label,key]) => `

<div class="journal-score-row"><div class="journal-score-top"><span>${label}</span><span class="journal-score-value" id="journal-${key}-val">3</span></div><div class="journal-range-wrap"><div class="journal-range-ticks"><span></span><span></span><span></span><span></span><span></span><span></span></div><input class="journal-range" type="range" min="0" max="5" step="1" value="3" id="journal-${key}-range"></div></div>

`).join('')}

<div class="journal-score-total"><div class="journal-score-total-label">Execution Score</div><div class="journal-score-total-value"><span id="journalEveningScoreValue">15</span><span style="font-size:14px;color:inherit;font-weight:600;opacity:.6;"> / 30</span></div></div>

<div class="journal-note" id="journalEveningAveragesNote">Vs last week: -- · Vs month: --</div>

</div>

<div><h2>Mission Debrief</h2><div class="journal-prompt">Did you complete today's mission?</div><div id="journalTodayMissionReminder" style="display:none;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;font-weight:700;color:#C9A84C;letter-spacing:0.2px;"></div><textarea class="journal-textarea" id="journal-eveningMissionDebrief" placeholder="Example: I completed recording the video batch and prepared tomorrow's content."></textarea></div>

<div><h2>Biggest Win</h2><div class="journal-prompt">What moved your life forward today?</div><textarea class="journal-textarea" id="journal-eveningBiggestWin" placeholder="Example: I stayed disciplined and completed deep work even when I felt resistance."></textarea></div>

<div><h2>Biggest Lesson</h2><div class="journal-prompt">What did today teach you?</div><textarea class="journal-textarea" id="journal-eveningBiggestLesson" placeholder="Example: I work best when I start deep work immediately after the gym."></textarea></div>

<div><h2>Identity Reflection</h2><div class="journal-prompt">Did I act like the man I'm becoming today?</div><textarea class="journal-textarea" id="journal-eveningIdentityReflection" placeholder="Example: Yes. I stayed disciplined and focused even when I wanted to procrastinate."></textarea></div>

<div><h2>Improve Tomorrow</h2><div class="journal-prompt">What will tomorrow's version of you do better?</div><textarea class="journal-textarea" id="journal-eveningImproveTomorrow" placeholder="Example: Start recording immediately at 8am and avoid checking messages."></textarea></div>

<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">

<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.3);text-align:center;letter-spacing:0.5px;">✓ Auto-saves when you collapse</div>

<button class="journal-toggle-btn" id="journalCollapseEveningBtnBottom">Collapse Evening Reflection</button>

</div>

</div>

</div>

</div>`;

}
