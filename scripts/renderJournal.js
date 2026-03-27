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
        <div id="journalMonthObjectives"></div>
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
          <button class="journal-launch-btn" id="journalOpenMorningBtn">Morning Journal<small>Open readiness, identity, mission, and priorities</small></button>
          <button class="journal-launch-btn" id="journalOpenEveningBtn">Evening Reflection<small>Open execution, reflection, and reset for tomorrow</small></button>
        </div>
        <button class="journal-launch-btn journal-open-launch" id="journalOpenOpenBtn" style="border-left:4px solid rgba(39,174,96,0.6);text-align:left;width:100%;padding:24px 26px;">Open Journal<small>Optional free-write — blank canvas for anything on your mind</small></button>
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
        <div><h2>Identity</h2><div class="journal-prompt">I am showing up today as...</div><textarea class="journal-textarea" id="journal-identity" placeholder="...a focused, disciplined man who executes without hesitation and leads from the front."></textarea></div>
        <div><h2>Purpose</h2><div class="journal-prompt">The man I am becoming needs me to... because...</div><textarea class="journal-textarea" id="journal-purpose" placeholder="...show up fully today and execute without excuses... because every day I do compounds into the version of me I'm building."></textarea></div>
        <div><h2>State & Confidence</h2><div class="journal-prompt">Today I move like a man who... and nothing will shake my state today because...</div><textarea class="journal-textarea" id="journal-stateConfidence" placeholder="...has already decided to win... and nothing will shake my state today because I know who I am and what I'm here to do."></textarea></div>
        <div class="journal-mission"><h2>Mission</h2><div class="journal-prompt">Today's mission is...</div><textarea class="journal-textarea" id="journal-mission" placeholder="...to record and publish the next batch of high-performing videos for The Jewellery Merchant."></textarea></div>
        <div><h2>Top 3 Priorities</h2><div class="journal-priorities">
          <div class="journal-priority"><div class="journal-number">1</div><input class="journal-input" type="text" id="journal-priority1" placeholder="I will get done today..." /></div>
          <div class="journal-priority"><div class="journal-number">2</div><input class="journal-input" type="text" id="journal-priority2" placeholder="I will get done today..." /></div>
          <div class="journal-priority"><div class="journal-number">3</div><input class="journal-input" type="text" id="journal-priority3" placeholder="I will get done today..." /></div>
        </div></div>
        <div><h2>Obstacle Forecast</h2><div class="journal-prompt">The one thing I will not let stop me today is...</div><textarea class="journal-textarea" id="journal-obstacles" placeholder="...scrolling and low-value distractions pulling me away from deep work."></textarea></div>
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
          ${[
            ['Mission Execution','execution'],['Self Discipline','discipline'],['Dopamine Discipline','dopamine'],['Physical Standard','physical'],['Builder / CEO Mindset','builder'],['Sleep Prep','sleepprep']
          ].map(([label,key]) => `
          <div class="journal-score-row"><div class="journal-score-top"><span>${label}</span><span class="journal-score-value" id="journal-${key}-val">3</span></div><div class="journal-range-wrap"><div class="journal-range-ticks"><span></span><span></span><span></span><span></span><span></span><span></span></div><input class="journal-range" type="range" min="0" max="5" step="1" value="3" id="journal-${key}-range"></div></div>
          `).join('')}
          <div class="journal-score-total"><div class="journal-score-total-label">Execution Score</div><div class="journal-score-total-value"><span id="journalEveningScoreValue">15</span><span style="font-size:14px;color:inherit;font-weight:600;opacity:.6;"> / 30</span></div></div>
          <div class="journal-note" id="journalEveningAveragesNote">Vs last week: -- · Vs month: --</div>
        </div>
        <div><h2>Mission Debrief</h2><div class="journal-prompt">Today's mission was... and I...</div><div id="journalTodayMissionReminder" style="display:none;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;font-weight:700;color:#C9A84C;letter-spacing:0.2px;"></div><textarea class="journal-textarea" id="journal-eveningMissionDebrief" placeholder="...to record the video batch... and I executed fully, getting all 3 done before midday."></textarea></div>
        <div><h2>Biggest Win</h2><div class="journal-prompt">Today I moved forward by...</div><textarea class="journal-textarea" id="journal-eveningBiggestWin" placeholder="...staying locked in during deep work and not breaking focus until the session was done."></textarea></div>
        <div><h2>Biggest Lesson</h2><div class="journal-prompt">Today taught me that...</div><textarea class="journal-textarea" id="journal-eveningBiggestLesson" placeholder="...I work best when I go straight into deep work after the gym with no phone in between."></textarea></div>
        <div><h2>Identity Reflection</h2><div class="journal-prompt">Today I showed up as the man I'm becoming when... and I fell short when...</div><textarea class="journal-textarea" id="journal-eveningIdentityReflection" placeholder="...I pushed through resistance and executed without excuses... and I fell short when I let scrolling eat into my evening wind-down."></textarea></div>
        <div><h2>Improve Tomorrow</h2><div class="journal-prompt">Tomorrow I will...</div><textarea class="journal-textarea" id="journal-eveningImproveTomorrow" placeholder="...start recording immediately at 8am, phone face down, no messages until the first session is done."></textarea></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
          <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.3);text-align:center;letter-spacing:0.5px;">✓ Auto-saves when you collapse</div>
          <button class="journal-toggle-btn" id="journalCollapseEveningBtnBottom">Collapse Evening Reflection</button>
        </div>
      </div>
    </div>

    <div class="journal-card journal-open-card journal-collapsed" id="journalOpenCard">
      <div class="journal-section-head">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <h2>Open Journal</h2>
          <span class="journal-status-badge" id="journalOpenCompletionBadge">Optional</span>
        </div>
        <div class="journal-section-actions">
          <span class="journal-saved-pill" id="journalOpenSavedPill">Saved</span>
          <button class="journal-toggle-btn" id="journalCollapseOpenBtn">Collapse</button>
        </div>
      </div>
      <div class="journal-collapsible-content">
        <div>
          <div class="journal-prompt" style="font-size:14px;font-weight:600;opacity:0.7;">Free-write anything — thoughts, ideas, gratitude, problems, stream of consciousness. No structure required.</div>
          <textarea class="journal-textarea" id="journal-openText" placeholder="Start writing…" style="min-height:160px;resize:none;overflow:hidden;line-height:1.6;"></textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
          <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.3);text-align:center;letter-spacing:0.5px;">✓ Auto-saves when you collapse</div>
          <button class="journal-toggle-btn" id="journalCollapseOpenBtnBottom">Collapse Open Journal</button>
        </div>
      </div>
    </div>

  </div>`;
}
