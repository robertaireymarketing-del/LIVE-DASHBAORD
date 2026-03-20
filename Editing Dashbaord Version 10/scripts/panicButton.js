
export function initPanicButton(deps) {
  const { state, saveData, render, getStreak, getTodayData, getToday } = deps;

  const panicUrgeConfig = {
    horniness: {
      header: 'FIGHTING HORNINESS', headerClass: 'horniness', timerClass: 'horniness',
      actions: [
        { emoji: '🚿', text: 'Cold shower. Now. Full cold, 2 minutes.' },
        { emoji: '💪', text: 'Drop and do 30 pushups. Go.' },
        { emoji: '🧊', text: 'Hold ice cubes in your hands for 60 seconds.' },
        { emoji: '🚶', text: 'Leave the room. Walk outside for 5 minutes.' },
        { emoji: '📞', text: 'Call Warda. Have a real conversation.' },
        { emoji: '💧', text: 'Splash cold water on your face 10 times.' },
        { emoji: '⬇️', text: 'Plank position. Hold for 90 seconds.' },
        { emoji: '🏃', text: '20 burpees. Make yourself tired.' }
      ],
      mantras: [
        '"The urge is temporary. Your regret will last all day."',
        '"You are not your urges. You are the one who decides."',
        '"Every time you resist, you get stronger. Every time you give in, it gets harder."',
        '"Is 5 seconds of pleasure worth losing 7 days of progress?"',
        '"The man who conquers himself is greater than one who conquers a thousand armies."',
        '"Your future self is begging you to hold the line."',
        '"This feeling will pass whether you act on it or not. Choose wisely."',
        '"Discipline is choosing between what you want now and what you want most."'
      ],
      stakesLabel: 'CURRENT STREAK', question: 'Is this worth resetting to Day 1?', slipText: 'I relapsed', successEmoji: '💪', successText: 'You beat it.', successSub: 'The urge has passed. Streak protected.'
    },
    procrastination: {
      header: 'FIGHTING PROCRASTINATION', headerClass: 'procrastination', timerClass: 'procrastination',
      actions: [
        { emoji: '📵', text: 'Phone in another room. Now.' },
        { emoji: '✏️', text: 'Write down the ONE next action. Just one.' },
        { emoji: '⏱️', text: '2 minute rule: Start the task for just 2 mins.' },
        { emoji: '🔇', text: 'Close every tab. Every single one.' },
        { emoji: '🎧', text: 'Put on focus music. No lyrics.' },
        { emoji: '🚶', text: 'Stand up. Walk for 60 seconds. Sit back down and start.' },
        { emoji: '📝', text: 'Type the ugliest first draft possible. Just begin.' },
        { emoji: '🎯', text: 'Set a 10-minute timer. Work until it ends.' }
      ],
      mantras: [
        '"Action creates clarity. Thinking creates anxiety."',
        '"You don’t need motivation. You need movement."',
        '"The task is rarely as painful as avoiding it."',
        '"Momentum beats mood every time."',
        '"Your future is being built by what you do next, not what you plan next."',
        '"Stop negotiating with weakness."',
        '"Done is a thousand times better than delayed."',
        '"Win the next 10 minutes. That’s all."'
      ],
      stakesLabel: 'TIME BEING WASTED', question: 'Will avoidance make this easier later?', slipText: 'I avoided it', successEmoji: '⚡', successText: 'You moved.', successSub: 'Momentum regained. Keep the engine running.'
    },
    hunger: {
      header: 'FIGHTING FAKE HUNGER', headerClass: 'hunger', timerClass: 'hunger',
      actions: [
        { emoji: '💧', text: 'Drink a full glass of water first.' },
        { emoji: '🚶', text: 'Walk for 5 minutes before deciding.' },
        { emoji: '☕', text: 'Have a zero-calorie drink and wait 10 minutes.' },
        { emoji: '🪥', text: 'Brush your teeth. Close the kitchen.' },
        { emoji: '📵', text: 'Get away from food content immediately.' },
        { emoji: '🫁', text: 'Take 10 slow breaths. Cravings peak and pass.' },
        { emoji: '🍽️', text: 'Ask: would I eat chicken and rice right now?' },
        { emoji: '📝', text: 'Name the feeling. Stress? Boredom? Fatigue?' }
      ],
      mantras: [
        '"You’re not hungry. You’re bored. Find something to do."',
        '"Nothing tastes as good as being lean feels."',
        '"Your body has plenty of stored fuel. Let it use it."',
        '"This craving will pass in 20 minutes. Outlast it."',
        '"You didn’t come this far to blow it on a snack."',
        '"Discipline weighs ounces. Regret weighs tons."',
        '"The fridge is not the answer to whatever you’re feeling."'
      ],
      stakesLabel: 'WEIGHT LOSS PROGRESS', question: 'Are you actually hungry, or just bored?', slipText: 'I ate', successEmoji: '🔥', successText: 'Craving crushed.', successSub: 'That wasn’t real hunger. You’re still in deficit. Keep going.'
    }
  };

  let panicCurrentUrge = null;
  let panicTimerInterval = null;
  let panicTimeLeft = 600;
  let panicHoldInterval = null;
  let panicHoldTime = 0;
  const PANIC_HOLD_DURATION = 10;
  const PANIC_SLIP_PHRASE = "I'm a weak pathetic man who can't master his mind. I quit on my future self and give in.";

  function getPanicStats() {
    const stored = localStorage.getItem('panicButtonStats');
    return stored ? JSON.parse(stored) : { wins: 0, slips: 0 };
  }
  function savePanicStats(stats) {
    localStorage.setItem('panicButtonStats', JSON.stringify(stats));
  }
  function updatePanicWinDisplay() {
    const stats = getPanicStats();
    document.getElementById('panicWinCount').textContent = stats.wins;
    const total = stats.wins + stats.slips;
    document.getElementById('panicWinRate').textContent = total > 0 ? Math.round((stats.wins / total) * 100) + '%' : '--';
    const motivationEl = document.getElementById('panicWinMotivation');
    motivationEl.textContent = stats.wins > 0
      ? `You've beaten this ${stats.wins} time${stats.wins > 1 ? 's' : ''} before. You can do it again.`
      : 'This is your first battle. Make it a win.';
  }
  function startPanicTimer() {
    clearInterval(panicTimerInterval);
    panicTimerInterval = setInterval(() => {
      panicTimeLeft--;
      updatePanicTimerDisplay();
      if (panicTimeLeft <= 0) clearInterval(panicTimerInterval);
    }, 1000);
  }
  function updatePanicTimerDisplay() {
    const mins = Math.floor(panicTimeLeft / 60);
    const secs = panicTimeLeft % 60;
    document.getElementById('panicTimerValue').textContent = mins + ':' + secs.toString().padStart(2, '0');
    document.getElementById('panicTimerBar').style.width = ((panicTimeLeft / 600) * 100) + '%';
  }
  async function confirmPanicSlip() {
    clearInterval(panicTimerInterval);
    const stats = getPanicStats();
    stats.slips++;
    savePanicStats(stats);
    if (panicCurrentUrge === 'horniness') {
      const today = getToday();
      if (!state.data.days) state.data.days = {};
      if (!state.data.days[today]) state.data.days[today] = {};
      state.data.days[today].retention = false;
      state.data.days[today].retentionReset = true;
      await saveData();
      render();
    }
    window.closePanic();
    if (panicCurrentUrge === 'horniness') alert('Logged. Streak reset to Day 1. Tomorrow you start again.');
    else if (panicCurrentUrge === 'procrastination') alert('Logged. Now close this and do the thing. No more excuses.');
    else alert('Logged. Track it honestly. One slip does not break the deficit.');
  }

  window.openPanic = function() {
    document.getElementById('panicOverlay').classList.remove('hidden');
    document.getElementById('panicSelection').style.display = 'flex';
    document.getElementById('panicActionScreen').classList.remove('active');
    document.getElementById('panicSlipModal').classList.remove('active');
    document.getElementById('panicSuccessScreen').classList.remove('active');
    document.getElementById('panicTimerContainer').classList.add('hidden');
    document.getElementById('panicTimerText').classList.add('hidden');
    panicCurrentUrge = null;
    clearInterval(panicTimerInterval);
    clearInterval(panicHoldInterval);
  };
  window.closePanic = function() {
    document.getElementById('panicOverlay').classList.add('hidden');
    clearInterval(panicTimerInterval);
    clearInterval(panicHoldInterval);
  };
  window.selectPanicUrge = function(urge) {
    panicCurrentUrge = urge;
    const config = panicUrgeConfig[urge];
    document.getElementById('panicSelection').style.display = 'none';
    document.getElementById('panicActionScreen').classList.add('active');
    document.getElementById('panicTimerContainer').classList.remove('hidden');
    document.getElementById('panicTimerText').classList.remove('hidden');
    document.getElementById('panicTimerBar').className = 'panic-timer-bar ' + config.timerClass;
    document.getElementById('panicUrgeHeader').textContent = config.header;
    document.getElementById('panicUrgeHeader').className = 'panic-urge-header ' + config.headerClass;
    document.getElementById('panicStakesLabel').textContent = config.stakesLabel;
    if (urge === 'horniness') {
      const streak = getStreak('retention');
      document.getElementById('panicStakesValue').innerHTML = streak + ' <span>days</span>';
    } else if (urge === 'hunger') {
      const startWeight = 230.4;
      const currentWeight = getTodayData().weight || startWeight;
      const lost = (startWeight - currentWeight).toFixed(1);
      document.getElementById('panicStakesValue').innerHTML = lost + ' <span>lbs lost</span>';
    } else {
      document.getElementById('panicStakesValue').innerHTML = '? <span>hours</span>';
    }
    document.getElementById('panicQuestionText').textContent = config.question;
    document.getElementById('panicSlipBtn').textContent = config.slipText;
    updatePanicWinDisplay();
    panicTimeLeft = 600;
    updatePanicTimerDisplay();
    startPanicTimer();
    window.newPanicAction();
    window.newPanicMantra();
  };
  window.newPanicAction = function() {
    if (!panicCurrentUrge) return;
    const actions = panicUrgeConfig[panicCurrentUrge].actions;
    const action = actions[Math.floor(Math.random() * actions.length)];
    document.getElementById('panicActionEmoji').textContent = action.emoji;
    document.getElementById('panicActionText').textContent = action.text;
  };
  window.newPanicMantra = function() {
    if (!panicCurrentUrge) return;
    const mantras = panicUrgeConfig[panicCurrentUrge].mantras;
    const mantra = mantras[Math.floor(Math.random() * mantras.length)];
    document.getElementById('panicMantraText').textContent = mantra;
  };
  window.panicSurvived = function() {
    clearInterval(panicTimerInterval);
    const stats = getPanicStats();
    stats.wins++;
    savePanicStats(stats);
    const config = panicUrgeConfig[panicCurrentUrge];
    document.getElementById('panicActionScreen').classList.remove('active');
    document.getElementById('panicSlipModal').classList.remove('active');
    document.getElementById('panicSuccessScreen').classList.add('active');
    document.getElementById('panicSuccessEmoji').textContent = config.successEmoji;
    document.getElementById('panicSuccessText').textContent = config.successText;
    document.getElementById('panicSuccessSub').textContent = config.successSub + ' Total wins: ' + stats.wins;
  };
  window.showPanicSlipModal = function() {
    document.getElementById('panicActionScreen').classList.remove('active');
    document.getElementById('panicSlipModal').classList.add('active');
    document.getElementById('panicSlipInput').value = '';
    document.getElementById('panicSlipInput').classList.remove('match');
    document.getElementById('panicSlipHoldBtn').classList.remove('ready');
    document.getElementById('panicHoldText').textContent = 'Type the phrase first';
    document.getElementById('panicHoldProgress').style.width = '0%';
  };
  window.hidePanicSlipModal = function() {
    document.getElementById('panicSlipModal').classList.remove('active');
    document.getElementById('panicActionScreen').classList.add('active');
  };
  window.checkPanicSlipPhrase = function() {
    const input = document.getElementById('panicSlipInput').value.trim();
    const btn = document.getElementById('panicSlipHoldBtn');
    const inputEl = document.getElementById('panicSlipInput');
    if (input.toLowerCase() === PANIC_SLIP_PHRASE.toLowerCase()) {
      btn.classList.add('ready');
      inputEl.classList.add('match');
      document.getElementById('panicHoldText').textContent = 'Hold for 10 seconds to confirm';
    } else {
      btn.classList.remove('ready');
      inputEl.classList.remove('match');
      document.getElementById('panicHoldText').textContent = 'Type the phrase first';
    }
  };
  window.startPanicHold = function() {
    const btn = document.getElementById('panicSlipHoldBtn');
    if (!btn.classList.contains('ready')) return;
    panicHoldTime = 0;
    document.getElementById('panicHoldProgress').style.width = '0%';
    panicHoldInterval = setInterval(() => {
      panicHoldTime += 0.1;
      const pct = (panicHoldTime / PANIC_HOLD_DURATION) * 100;
      document.getElementById('panicHoldProgress').style.width = pct + '%';
      document.getElementById('panicHoldText').textContent = 'Hold... ' + (PANIC_HOLD_DURATION - Math.floor(panicHoldTime)) + 's';
      if (panicHoldTime >= PANIC_HOLD_DURATION) {
        clearInterval(panicHoldInterval);
        confirmPanicSlip();
      }
    }, 100);
  };
  window.endPanicHold = function() {
    clearInterval(panicHoldInterval);
    document.getElementById('panicHoldProgress').style.width = '0%';
    if (document.getElementById('panicSlipHoldBtn').classList.contains('ready')) {
      document.getElementById('panicHoldText').textContent = 'Hold for 10 seconds to confirm';
    }
  };
}
