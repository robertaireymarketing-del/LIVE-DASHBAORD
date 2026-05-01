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
      <style>
        .jd-card-active span { color: #ffffff !important; font-weight: 800 !important; }
        .jd-card-active { background: #1A5C3A !important; border-color: #2ecc71 !important; }
        .jd-card-inactive { background: #ffffff !important; border-color: #C8D6E5 !important; }
        .jd-card-inactive span { color: #0A1628 !important; }
        .jd-card-inactive .jd-streak { color: #7b92aa !important; }
        .jd-card-inactive .jd-icon { color: #C8D6E5 !important; }
      </style>
      <div class="journal-launch-grid">
        ${(() => {
          const days = window.state?.data?.days || {};
          const sorted = Object.keys(days).sort().reverse();
          // Use the journal's currently viewed date, falling back to today
          const viewedDate = window.state?.journalDate || new Date().toISOString().slice(0,10);
          const viewedData = days[viewedDate] || {};
          function streak(field) {
            const cursor = new Date();
            cursor.setHours(12, 0, 0, 0);
            const todayStr = cursor.toISOString().slice(0, 10);
            if (!days[todayStr]?.[field]) cursor.setDate(cursor.getDate() - 1);
            let s = 0;
            for (let i = 0; i < 400; i++) {
              const key = cursor.toISOString().slice(0, 10);
              if (days[key]?.[field]) { s++; cursor.setDate(cursor.getDate() - 1); }
              else break;
            }
            return s;
          }
          const fields = [
            { key: 'gym',       label: 'GYM',       emoji: '🏋️' },
            { key: 'retention', label: 'RETENTION',  emoji: '🩸' },
            { key: 'meditation',label: 'MEDITATION', emoji: '🧘' },
          ];
          return `<div id="journal-habit-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px;">
            ${fields.map(f => `
            <div onclick="toggleJournalDay('${viewedDate}','${f.key}')" class="${viewedData[f.key]?'jd-card-active':'jd-card-inactive'}" style="border-radius:16px;padding:16px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.2s;border:2px solid;">
              <span style="font-size:28px;line-height:1;">${f.emoji}</span>
              <span class="jd-icon" style="font-size:24px;font-weight:900;color:${viewedData[f.key]?'#ffffff':'#C8D6E5'}!important;">${viewedData[f.key]?'✓':'○'}</span>
              <span style="font-size:11px;font-weight:900;letter-spacing:1px;color:${viewedData[f.key]?'#ffffff':'#0A1628'}!important;">${f.label}</span>
              <span class="jd-streak" style="font-size:10px;font-weight:700;color:${viewedData[f.key]?'#ffffff':'#7b92aa'}!important;">${streak(f.key)} day streak</span>
            </div>`).join('')}
          </div>`;
        })()}
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

        <!-- ── THE LOCK ─────────────────────────────────────────────────── -->
        <div id="journalLockBlock" style="border-left:3px solid #C9A84C;border-radius:14px;padding:20px 22px;margin-bottom:4px;">
          <div id="journalLockLabel" style="font-size:9px;font-weight:900;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:12px;">The Lock</div>
          <div id="journalLockIntro" style="font-size:13px;font-weight:700;line-height:1.5;margin-bottom:10px;font-style:italic;">I am a man of total standard. These things do not exist in my world:</div>
          <div id="journalLockItems" style="display:flex;flex-direction:column;gap:7px;margin-bottom:12px;">
            ${[
              ['🚫','No porn. No masturbation.'],
              ['🚫','No food outside my diet.'],
              ['🚫','No skipping the gym.'],
              ['🚫','No mindless scrolling.'],
            ].map(([icon, text]) => `
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:12px;opacity:0.6;">${icon}</span>
                <span class="journal-lock-item-text" style="font-size:14px;font-weight:800;letter-spacing:0.1px;">${text}</span>
              </div>
            `).join('')}
          </div>
          <div id="journalLockDeclaration" style="font-size:12px;font-weight:700;color:rgba(201,168,76,0.7);letter-spacing:0.3px;padding-top:10px;font-style:italic;">The question never arises. It is already decided. I am already that man.</div>
        </div>

        <!-- ── STOIC PRINCIPLE OF THE DAY ──────────────────────────────── -->
        <div id="journalStoicBlock" style="border-radius:14px;padding:20px 22px;margin-bottom:4px;">
          <div id="journalStoicLabel" style="font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;">Stoic Principle of the Day</div>
          <div id="journalStoicName" style="font-size:22px;font-weight:900;letter-spacing:0.5px;line-height:1;"></div>
          <div id="journalStoicMeaning" style="font-size:12px;font-weight:600;color:rgba(201,168,76,0.7);letter-spacing:1px;text-transform:uppercase;margin-top:4px;margin-bottom:14px;"></div>
          <div id="journalStoicQuote" style="font-size:14px;font-style:italic;line-height:1.65;border-left:2px solid rgba(201,168,76,0.4);padding-left:14px;margin-bottom:6px;"></div>
          <div id="journalStoicAttr" style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:16px;padding-left:14px;"></div>
          <div id="journalStoicApplication" style="font-size:13px;line-height:1.75;color:rgba(255,255,255,0.6);padding:14px 16px;background:rgba(201,168,76,0.06);border-radius:10px;border-left:2px solid rgba(201,168,76,0.3);margin-top:4px;font-style:italic;"></div>
        </div>

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
        <div><h2>Most Powerful Self</h2><div class="journal-prompt">What is the most powerful version of myself that I can step into today?</div><textarea class="journal-textarea" id="journal-powerfulSelf" placeholder="The most powerful version of me today is..."></textarea></div>
        <div><h2>Most Important Action</h2><div class="journal-prompt">What is the single most important action I can take today that will move me closer to my biggest dream?</div><textarea class="journal-textarea" id="journal-mostImportantAction" placeholder="The one action that moves everything forward is..."></textarea></div>
        <div><h2>Lose &amp; Gain</h2><div class="journal-prompt">What will I lose if I don't show up as my most powerful self today — and what will I gain if I do?</div><textarea class="journal-textarea" id="journal-loseGain" placeholder="If I don't show up fully today I lose... but if I do, I gain..."></textarea></div>
        <div><h2>Unstoppable Evidence</h2><div class="journal-prompt">What evidence will I create today that proves I am unstoppable in achieving my dreams?</div><textarea class="journal-textarea" id="journal-unstoppable" placeholder="By the end of today I will have proven it by..."></textarea></div>
        <div>
          <h2>Today's Priorities</h2>
          <div class="journal-prompt" style="margin-bottom:10px;">Pulled from your planner for today.</div>
          <div id="journalDayPrioritiesDisplay" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
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
        <div><h2>Most Proud</h2><div class="journal-prompt">What am I most proud of about how I showed up today?</div><textarea class="journal-textarea" id="journal-proud" placeholder="Today I showed up powerfully when I..."></textarea></div>
        <div><h2>Biggest Learning</h2><div class="journal-prompt">What did I learn today that will make me even more effective tomorrow?</div><textarea class="journal-textarea" id="journal-learned" placeholder="Today taught me that..."></textarea></div>
        <div><h2>Release &amp; Intention</h2><div class="journal-prompt">What can I release from today, and what intention will I set for a powerful tomorrow?</div><textarea class="journal-textarea" id="journal-release" placeholder="I release... and tomorrow I intend to..."></textarea></div>
        <div><h2>Alignment</h2><div class="journal-prompt">How did my actions today align with the person I am becoming and the life I am creating?</div><textarea class="journal-textarea" id="journal-alignment" placeholder="Today I moved toward the man I'm becoming by..."></textarea><div style="font-size:11px;font-weight:700;color:rgba(201,168,76,0.6);letter-spacing:0.3px;margin-top:8px;font-style:italic;">Acknowledge · Extract the lesson · Affirm commitment</div></div>
        <div>
          <h2>Gratitude</h2>
          <div class="journal-prompt" style="margin-bottom:12px;">What are you grateful for today? Complete at least one.</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input class="journal-input" type="text" id="journal-grateful1" placeholder="I am grateful for..." />
            <input class="journal-input" type="text" id="journal-grateful2" placeholder="I am grateful for..." />
            <input class="journal-input" type="text" id="journal-grateful3" placeholder="I am grateful for..." />
            <input class="journal-input" type="text" id="journal-grateful4" placeholder="I am grateful for..." />
            <input class="journal-input" type="text" id="journal-grateful5" placeholder="I am grateful for..." />
            <input class="journal-input" type="text" id="journal-grateful6" placeholder="I am grateful for..." />
          </div>
        </div>
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
