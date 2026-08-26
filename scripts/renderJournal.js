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
            <div onclick="toggleJournalDay('${f.key}')" class="${viewedData[f.key]?'jd-card-active':'jd-card-inactive'}" style="border-radius:16px;padding:16px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:all 0.2s;border:2px solid;">
              <span style="font-size:28px;line-height:1;">${f.emoji}</span>
              <span class="jd-icon" style="font-size:24px;font-weight:900;color:${viewedData[f.key]?'#ffffff':'#C8D6E5'}!important;">${viewedData[f.key]?'✓':'○'}</span>
              <span style="font-size:11px;font-weight:900;letter-spacing:1px;color:${viewedData[f.key]?'#ffffff':'#0A1628'}!important;">${f.label}</span>
              <span class="jd-streak" style="font-size:10px;font-weight:700;color:${viewedData[f.key]?'#ffffff':'#7b92aa'}!important;">${streak(f.key)} day streak</span>
            </div>`).join('')}
          </div>`;
        })()}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
          <button class="journal-launch-btn" id="journalOpenMorningBtn">Morning Journal<small>Set today's frog, the block you'll kill it in, and the plan</small></button>
          <button class="journal-launch-btn" id="journalOpenEveningBtn">Evening Reflection<small>Open execution, reflection, and reset for tomorrow</small></button>
        </div>
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

        <!-- ── STOIC PRINCIPLE OF THE DAY ──────────────────────────────── -->
        <div id="journalStoicBlock" style="border-radius:14px;padding:20px 22px;margin-bottom:4px;">
          <div id="journalStoicLabel" style="font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;">Stoic Principle of the Day</div>
          <div id="journalStoicName" style="font-size:22px;font-weight:900;letter-spacing:0.5px;line-height:1;"></div>
          <div id="journalStoicMeaning" style="font-size:12px;font-weight:600;color:rgba(201,168,76,0.7);letter-spacing:1px;text-transform:uppercase;margin-top:4px;margin-bottom:14px;"></div>
          <div id="journalStoicQuote" style="font-size:14px;font-style:italic;line-height:1.65;border-left:2px solid rgba(201,168,76,0.4);padding-left:14px;margin-bottom:6px;"></div>
          <div id="journalStoicAttr" style="font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:16px;padding-left:14px;"></div>
          <div id="journalStoicApplication" style="font-size:13px;line-height:1.75;color:rgba(255,255,255,0.6);padding:14px 16px;background:rgba(201,168,76,0.06);border-radius:10px;border-left:2px solid rgba(201,168,76,0.3);margin-top:4px;font-style:italic;"></div>
        </div>

        <!-- ── THIS WEEK'S OUTCOMES (the spine — read-only) ────────────── -->
        <div>
          <h2>This Week's Outcomes</h2>
          <div class="journal-prompt" style="margin-bottom:10px;">The 3 outcomes that make this week a win. Today's frog should serve one of them. Set these in the Planner.</div>
          <div id="journalMorningWeekSpine" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>

        <!-- ── THE FROG (the one needle-mover) ────────────────────────── -->
        <div>
          <h2>The Frog 🐸</h2>
          <div class="journal-prompt">The one task that, if it's the only thing you finish today, makes the day a win. Eat it first — before the shop, before your phone, before anything reactive.</div>
          <textarea class="journal-textarea" id="journal-daysFocus" placeholder="Today's frog is..."></textarea>
        </div>

        <!-- ── THE BLOCK (when it gets killed) ────────────────────────── -->
        <div>
          <h2>Kill It In This Block</h2>
          <div class="journal-prompt">Name the time block you do the frog in — the first protected block of the day. Deciding it now is what stops 6am-you having to decide it later.</div>
          <input class="journal-input" type="text" id="journal-frogBlock" placeholder="e.g. 6:30–8:00, before the shop" />
        </div>

        <!-- ── TODAY'S PRIORITIES (the rest of the plan) ──────────────── -->
        <div>
          <h2>Everything Else, Queued</h2>
          <div class="journal-prompt" style="margin-bottom:10px;">The rest of today's plan, pulled from your planner. The frog comes first — this is what fills the blocks after it.</div>
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

        <!-- ── DAILY CLOSE-OUT (the accountability loop) ──────────────── -->
        <div id="journalCloseOutBlock" style="border-left:3px solid #C9A84C;border-radius:14px;padding:20px 22px;margin-bottom:4px;">
          <div style="font-size:9px;font-weight:900;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:12px;">Daily Close-Out</div>
          <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:6px;">This morning's frog</div>
          <div id="journalEveningFrogDisplay" style="font-size:15px;font-weight:800;line-height:1.4;margin-bottom:16px;"></div>
          <div style="margin-bottom:16px;">
            <div class="journal-prompt" style="margin-bottom:8px;">Did you kill the frog?</div>
            <select class="journal-input" id="journal-frogKilled">
              <option value="">—</option>
              <option value="yes">Yes — ate it first</option>
              <option value="late">Yes — but not first</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <div class="journal-prompt" style="margin-bottom:8px;">If it survived, what got in the way?</div>
            <input class="journal-input" type="text" id="journal-frogBlocker" placeholder="What stopped the frog getting done..." />
          </div>
          <div>
            <div class="journal-prompt" style="margin-bottom:8px;">Did you protect your blocks?</div>
            <select class="journal-input" id="journal-blocksProtected">
              <option value="">—</option>
              <option value="yes">Yes — held the line</option>
              <option value="partly">Partly</option>
              <option value="no">No — the day ran me</option>
            </select>
          </div>
        </div>

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
        <div><h2>3 Most Important Tasks Tomorrow</h2><div class="journal-prompt">Task 1 is tomorrow's frog — the one needle-mover you'll eat first.</div><div style="display:flex;flex-direction:column;gap:8px;">
          <input class="journal-input" type="text" id="journal-tomorrowTask1" placeholder="1 — Tomorrow's frog (the one needle-mover)..." />
          <input class="journal-input" type="text" id="journal-tomorrowTask2" placeholder="2 — Next most important task..." />
          <input class="journal-input" type="text" id="journal-tomorrowTask3" placeholder="3 — Third most important task..." />
        </div></div>
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

  </div>`;
}
