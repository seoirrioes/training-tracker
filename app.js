const STORAGE_KEY = 'training-webapp-state-v1';
const SEEDED_DATA = {
  currentDay: 2,
  sessions: [
    {
      date: '2026-07-17',
      day: 1,
      notes: '',
      exercises: {
        'Kniebeuge oder Hackenschmidt': { weight: 'ohne Zusatzgewicht', repsDone: '6–8', note: '' },
        'Bankdrücken': { weight: '12,5', repsDone: '6–8', note: '' },
        'Klimmzüge oder Latzug': { weight: '59', repsDone: '8–10', note: '' },
        'Schulterdrücken': { weight: '15', repsDone: '8–10', note: '' },
        'Rudern sitzend': { weight: '59', repsDone: '10', note: '' },
        'Plank': { weight: '', repsDone: '60 Sekunden', note: '' },
      },
    },
  ],
};

const state = {
  plan: null,
  selectedDay: 1,
  timerSeconds: 90,
  timerHandle: null,
  activeExercise: null,
  data: loadState(),
};

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      if (!stored.sessions?.length) return JSON.parse(JSON.stringify(SEEDED_DATA));
      return stored;
    }
    return JSON.parse(JSON.stringify(SEEDED_DATA));
  } catch {
    return JSON.parse(JSON.stringify(SEEDED_DATA));
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function formatTimer(total) {
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function getCurrentSession() {
  const date = document.getElementById('trainingDate').value;
  const day = Number(document.getElementById('daySelect').value);
  let session = state.data.sessions.find(s => s.date === date && s.day === day);
  if (!session) {
    session = { date, day, notes: '', exercises: {} };
    state.data.sessions.push(session);
  }
  return session;
}

function getExerciseHistory(name) {
  const sessions = [...state.data.sessions].sort((a,b) => (a.date < b.date ? 1 : -1));
  const items = [];
  for (const s of sessions) {
    if (s.exercises?.[name]) items.push({ date: s.date, ...s.exercises[name] });
  }
  return items.slice(0, 5);
}

function getLastExerciseEntry(name) {
  return getExerciseHistory(name)[0] || null;
}

async function init() {
  const res = await fetch('plan.json');
  state.plan = await res.json();
  state.selectedDay = state.data.currentDay || 1;
  setupControls();
  renderDayOptions();
  document.getElementById('trainingDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('daySelect').value = String(state.selectedDay);
  render();
}

function setupControls() {
  document.getElementById('daySelect').addEventListener('change', render);
  document.getElementById('trainingDate').addEventListener('change', render);
  document.getElementById('sessionNotes').addEventListener('input', e => {
    const session = getCurrentSession();
    session.notes = e.target.value;
    saveState();
  });
  document.getElementById('saveSessionBtn').addEventListener('click', () => {
    saveCurrentSession();
    alert('Training gespeichert.');
  });
  document.getElementById('completeDayBtn').addEventListener('click', () => {
    saveCurrentSession();
    state.selectedDay = state.selectedDay === 4 ? 1 : state.selectedDay + 1;
    state.data.currentDay = state.selectedDay;
    saveState();
    document.getElementById('daySelect').value = String(state.selectedDay);
    render();
    alert('Training abgeschlossen. Nächster Trainingstag gesetzt.');
  });
  document.querySelectorAll('.timerPreset').forEach(btn => btn.addEventListener('click', () => {
    state.timerSeconds = Number(btn.dataset.seconds);
    updateTimerDisplay();
  }));
  document.getElementById('startTimerBtn').addEventListener('click', startTimer);
  document.getElementById('pauseTimerBtn').addEventListener('click', pauseTimer);
  document.getElementById('resetTimerBtn').addEventListener('click', resetTimer);
}

function renderDayOptions() {
  const select = document.getElementById('daySelect');
  select.innerHTML = '';
  for (const day of state.plan.days) {
    const option = document.createElement('option');
    option.value = day.id;
    option.textContent = `Tag ${day.id}`;
    select.appendChild(option);
  }
}

function render() {
  state.selectedDay = Number(document.getElementById('daySelect').value || state.selectedDay);
  const day = state.plan.days.find(d => d.id === state.selectedDay);
  const session = getCurrentSession();
  document.getElementById('dayTitle').textContent = day.name;
  document.getElementById('dayMeta').textContent = [day.cardio, day.notes].filter(Boolean).join(' · ');
  document.getElementById('sessionNotes').value = session.notes || '';

  const list = document.getElementById('exerciseList');
  list.innerHTML = '';
  for (const exercise of day.exercises) {
    const saved = session.exercises?.[exercise.name] || {};
    const lastEntry = getLastExerciseEntry(exercise.name);
    const prefilledWeight = saved.weight ?? lastEntry?.weight ?? '';
    const prefilledReps = saved.repsDone ?? lastEntry?.repsDone ?? exercise.reps;
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.innerHTML = `
      <div class="exercise-top">
        <div>
          <div class="exercise-title">${exercise.name}</div>
          <div class="exercise-meta">${exercise.sets} Sätze · ${exercise.reps} Wdh.</div>
        </div>
        <button class="secondary historyBtn">Verlauf</button>
      </div>
      <div class="exercise-grid">
        <div>
          <label>Gewicht (kg)</label>
          <input type="text" class="weightInput" value="${prefilledWeight}" placeholder="z. B. 60" />
        </div>
        <div>
          <label>Ist-Wdh.</label>
          <input type="text" class="repsInput" value="${prefilledReps}" placeholder="z. B. 8/8/7/6" />
        </div>
        <div>
          <label>Notiz</label>
          <input type="text" class="noteInput" value="${saved.note ?? ''}" placeholder="z. B. schwer / sauber" />
        </div>
      </div>
      ${lastEntry ? `<div class="exercise-meta" style="margin-top:10px">Letzter Wert: ${lastEntry.weight || '—'} · Wdh.: ${lastEntry.repsDone || '—'} · ${lastEntry.date}</div>` : ''}
    `;
    const [weightInput, repsInput, noteInput] = card.querySelectorAll('input');
    [weightInput, repsInput, noteInput].forEach(input => input.addEventListener('change', () => {
      const session = getCurrentSession();
      session.exercises[exercise.name] = {
        weight: weightInput.value,
        repsDone: repsInput.value,
        note: noteInput.value,
      };
      saveState();
    }));
    card.querySelector('.historyBtn').addEventListener('click', () => {
      state.activeExercise = exercise.name;
      renderHistory(exercise.name);
    });
    list.appendChild(card);
  }
  updateTimerDisplay();
  if (state.activeExercise) renderHistory(state.activeExercise);
}

function renderHistory(name) {
  const history = getExerciseHistory(name);
  const box = document.getElementById('historyBox');
  document.getElementById('historyHint').textContent = `Verlauf: ${name}`;
  box.innerHTML = history.length ? history.map(item => `
    <div class="history-item">
      <strong>${item.date}</strong><br>
      Gewicht: ${item.weight || '—'}<br>
      Wdh.: ${item.repsDone || '—'}<br>
      Notiz: ${item.note || '—'}
    </div>
  `).join('') : '<div class="hint">Noch kein Verlauf vorhanden.</div>';
}

function saveCurrentSession() {
  getCurrentSession();
  saveState();
}

function updateTimerDisplay() {
  document.getElementById('timerDisplay').textContent = formatTimer(state.timerSeconds);
}

function startTimer() {
  if (state.timerHandle) return;
  state.timerHandle = setInterval(() => {
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      state.timerSeconds = 0;
      updateTimerDisplay();
      alert('Pause vorbei.');
      return;
    }
    state.timerSeconds -= 1;
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  if (!state.timerHandle) return;
  clearInterval(state.timerHandle);
  state.timerHandle = null;
}

function resetTimer() {
  pauseTimer();
  state.timerSeconds = 90;
  updateTimerDisplay();
}

init();
