const STORAGE_KEY = 'training-webapp-state-v2';
const PREVIOUS_KEYS = ['training-webapp-state-v2', 'training-webapp-state-v1'];

const SEEDED_DATA = {
  currentDay: 2,
  timerDefault: 90,
  sessions: [
    {
      date: '2026-07-17',
      dayId: 1,
      notes: '',
      exercises: {
        'Kniebeuge oder Hackenschmidt': {
          sets: [
            { weight: 'ohne Zusatzgewicht', reps: '6–8', done: true },
            { weight: 'ohne Zusatzgewicht', reps: '6–8', done: true },
            { weight: 'ohne Zusatzgewicht', reps: '6–8', done: true },
            { weight: 'ohne Zusatzgewicht', reps: '6–8', done: true }
          ],
          note: ''
        },
        'Bankdrücken': {
          sets: [
            { weight: '12,5', reps: '6–8', done: true },
            { weight: '12,5', reps: '6–8', done: true },
            { weight: '12,5', reps: '6–8', done: true },
            { weight: '12,5', reps: '6–8', done: true }
          ],
          note: ''
        },
        'Klimmzüge oder Latzug': {
          sets: [
            { weight: '59', reps: '8–10', done: true },
            { weight: '59', reps: '8–10', done: true },
            { weight: '59', reps: '8–10', done: true },
            { weight: '59', reps: '8–10', done: true }
          ],
          note: ''
        },
        'Schulterdrücken': {
          sets: [
            { weight: '15', reps: '8–10', done: true },
            { weight: '15', reps: '8–10', done: true },
            { weight: '15', reps: '8–10', done: true }
          ],
          note: ''
        },
        'Rudern sitzend': {
          sets: [
            { weight: '59', reps: '10', done: true },
            { weight: '59', reps: '10', done: true },
            { weight: '59', reps: '10', done: true }
          ],
          note: ''
        },
        'Plank': {
          sets: [
            { weight: '', reps: '60 Sekunden', done: true },
            { weight: '', reps: '60 Sekunden', done: true },
            { weight: '', reps: '60 Sekunden', done: true }
          ],
          note: ''
        }
      }
    }
  ]
};

const state = {
  plan: null,
  timerSeconds: 90,
  timerHandle: null,
  activeExercise: null,
  data: loadState()
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadState() {
  for (const key of PREVIOUS_KEYS) {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (stored) return migrateState(stored);
    } catch {}
  }
  return deepClone(SEEDED_DATA);
}

function migrateState(stored) {
  const next = {
    currentDay: stored.currentDay || 1,
    timerDefault: stored.timerDefault || 90,
    sessions: []
  };

  for (const session of stored.sessions || []) {
    const migrated = {
      date: session.date,
      dayId: session.dayId || session.day || 1,
      notes: session.notes || '',
      exercises: {}
    };

    for (const [name, exercise] of Object.entries(session.exercises || {})) {
      if (Array.isArray(exercise.sets)) {
        migrated.exercises[name] = {
          sets: exercise.sets.map(set => ({
            weight: set.weight || '',
            reps: set.reps || '',
            done: Boolean(set.done)
          })),
          note: exercise.note || ''
        };
      } else {
        const weight = exercise.weight || '';
        const reps = exercise.repsDone || '';
        migrated.exercises[name] = {
          sets: [{ weight, reps, done: Boolean(weight || reps) }],
          note: exercise.note || ''
        };
      }
    }

    next.sessions.push(migrated);
  }

  return next.sessions.length ? next : deepClone(SEEDED_DATA);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function $(id) {
  return document.getElementById(id);
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatTimer(total) {
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function updateTimerDisplay() {
  $('timerDisplay').textContent = formatTimer(state.timerSeconds);
}

function startTimer() {
  if (state.timerHandle) return;
  state.timerHandle = setInterval(() => {
    state.timerSeconds -= 1;
    if (state.timerSeconds <= 0) {
      state.timerSeconds = 0;
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      updateTimerDisplay();
      alert('Pause vorbei.');
      return;
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  if (!state.timerHandle) return;
  clearInterval(state.timerHandle);
  state.timerHandle = null;
}

function resetTimer(seconds = state.data.timerDefault || 90) {
  pauseTimer();
  state.timerSeconds = seconds;
  updateTimerDisplay();
}

function getSelectedDayId() {
  return Number($('daySelect').value || state.data.currentDay || 1);
}

function getDay(dayId) {
  return state.plan.days.find(day => day.id === dayId);
}

function ensureSession(date, dayId) {
  let session = state.data.sessions.find(s => s.date === date && s.dayId === dayId);
  if (!session) {
    session = { date, dayId, notes: '', exercises: {} };
    state.data.sessions.push(session);
  }
  return session;
}

function getCurrentSession() {
  return ensureSession($('trainingDate').value, getSelectedDayId());
}

function getExerciseHistory(name) {
  return [...state.data.sessions]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter(session => session.exercises?.[name])
    .slice(0, 6)
    .map(session => ({ date: session.date, ...session.exercises[name] }));
}

function getLastExerciseEntry(name) {
  return getExerciseHistory(name)[0] || null;
}

function normalizeExerciseData(exerciseName, setCount, targetReps) {
  const session = getCurrentSession();
  const existing = session.exercises[exerciseName];
  if (existing?.sets?.length === setCount) return existing;

  const last = getLastExerciseEntry(exerciseName);
  const sets = Array.from({ length: setCount }, (_, index) => ({
    weight: existing?.sets?.[index]?.weight || last?.sets?.[index]?.weight || last?.sets?.[0]?.weight || '',
    reps: existing?.sets?.[index]?.reps || last?.sets?.[index]?.reps || targetReps || '',
    done: existing?.sets?.[index]?.done || false
  }));

  const data = { sets, note: existing?.note || '' };
  session.exercises[exerciseName] = data;
  return data;
}

function countExerciseDone(exerciseData) {
  return (exerciseData.sets || []).filter(set => set.done).length;
}

function countWorkoutDone(session, day) {
  return day.exercises.reduce((sum, exercise) => {
    const data = normalizeExerciseData(exercise.name, exercise.sets, exercise.reps);
    return sum + countExerciseDone(data);
  }, 0);
}

function countWorkoutTotal(day) {
  return day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
}

function renderDayOptions() {
  const select = $('daySelect');
  select.innerHTML = '';
  for (const day of state.plan.days) {
    const option = document.createElement('option');
    option.value = day.id;
    option.textContent = `Tag ${day.id}`;
    select.appendChild(option);
  }
  select.value = String(state.data.currentDay || 1);
}

function renderSummary(day, session) {
  $('dayTitle').textContent = day.name;
  $('dayMeta').textContent = [day.cardio, day.notes].filter(Boolean).join(' · ');
  $('exerciseCount').textContent = day.exercises.length;
  const done = countWorkoutDone(session, day);
  const total = countWorkoutTotal(day);
  $('progressText').textContent = `${done}/${total} Sätze erledigt`;
  $('progressFill').style.width = `${Math.round((done / total) * 100) || 0}%`;
}

function renderHistory(name) {
  state.activeExercise = name;
  $('historyHint').textContent = `Verlauf: ${name}`;
  const box = $('historyBox');
  const history = getExerciseHistory(name);
  box.innerHTML = history.length ? history.map(item => {
    const compact = (item.sets || []).map((set, idx) => `S${idx + 1}: ${set.weight || '–'} · ${set.reps || '–'}`).join('<br>');
    return `<div class="history-item"><strong>${item.date}</strong><br>${compact}${item.note ? `<br>Notiz: ${item.note}` : ''}</div>`;
  }).join('') : '<div class="hint">Noch kein Verlauf vorhanden.</div>';
}

function saveCurrentSession() {
  const session = getCurrentSession();
  session.notes = $('sessionNotes').value;
  saveState();
}

function clearExerciseData(exerciseName, setCount, targetReps) {
  const session = getCurrentSession();
  session.exercises[exerciseName] = {
    sets: Array.from({ length: setCount }, () => ({ weight: '', reps: targetReps || '', done: false })),
    note: ''
  };
  saveState();
}

function resetWorkout() {
  const day = getDay(getSelectedDayId());
  const session = getCurrentSession();
  for (const exercise of day.exercises) {
    session.exercises[exercise.name] = {
      sets: Array.from({ length: exercise.sets }, () => ({ weight: '', reps: exercise.reps || '', done: false })),
      note: ''
    };
  }
  session.notes = '';
  $('sessionNotes').value = '';
  saveState();
  render();
}

function renderExercises(day) {
  const list = $('exerciseList');
  list.innerHTML = '';
  const session = getCurrentSession();

  for (const exercise of day.exercises) {
    const data = normalizeExerciseData(exercise.name, exercise.sets, exercise.reps);
    const last = getLastExerciseEntry(exercise.name);
    const doneCount = countExerciseDone(data);

    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.innerHTML = `
      <div class="exercise-top">
        <div>
          <div class="exercise-title">${exercise.name}</div>
          <div class="exercise-meta">${exercise.sets} Sätze · Ziel: ${exercise.reps}</div>
        </div>
        <div class="exercise-actions">
          <span class="exercise-pill ${doneCount === exercise.sets ? 'done' : ''}">${doneCount}/${exercise.sets}</span>
          <button class="secondary historyBtn">Verlauf</button>
        </div>
      </div>
      ${last ? `<div class="last-row">Letztes Training: ${last.date} · ${(last.sets || []).map((set, idx) => `S${idx + 1} ${set.weight || '–'} / ${set.reps || '–'}`).join(' · ')}</div>` : ''}
      <div class="set-table">
        <div class="set-head">Satz</div>
        <div class="set-head">Gewicht</div>
        <div class="set-head">Wdh.</div>
        <div class="set-head">Erledigt</div>
      </div>
    `;

    const table = card.querySelector('.set-table');

    data.sets.forEach((set, index) => {
      const row = document.createElement('div');
      row.className = `set-row ${set.done ? 'is-done' : ''}`;
      row.innerHTML = `
        <div class="set-cell full"><div class="set-label">Satz ${index + 1}</div></div>
        <div class="set-cell"><label>Gewicht</label><input class="weightInput" type="text" value="${set.weight || ''}" placeholder="kg"></div>
        <div class="set-cell"><label>Wdh.</label><input class="repsInput" type="text" value="${set.reps || ''}" placeholder="Wdh."></div>
        <div class="set-cell"><label>Erledigt</label><button class="doneBtn ${set.done ? 'done' : ''}">${set.done ? '✓' : '○'}</button></div>
        <div class="set-cell"><label>Reset</label><button class="resetSetBtn">↺</button></div>
      `;

      const weightInput = row.querySelector('.weightInput');
      const repsInput = row.querySelector('.repsInput');
      const doneBtn = row.querySelector('.doneBtn');
      const resetSetBtn = row.querySelector('.resetSetBtn');

      const persist = () => {
        data.sets[index].weight = weightInput.value.trim();
        data.sets[index].reps = repsInput.value.trim();
        session.exercises[exercise.name] = data;
        saveState();
      };

      weightInput.addEventListener('change', persist);
      repsInput.addEventListener('change', persist);
      doneBtn.addEventListener('click', () => {
        data.sets[index].weight = weightInput.value.trim();
        data.sets[index].reps = repsInput.value.trim();
        data.sets[index].done = !data.sets[index].done;
        session.exercises[exercise.name] = data;
        saveState();
        if (data.sets[index].done) {
          resetTimer(state.data.timerDefault || 90);
          startTimer();
        }
        render();
        renderHistory(exercise.name);
      });

      resetSetBtn.addEventListener('click', () => {
        data.sets[index] = { weight: '', reps: exercise.reps || '', done: false };
        session.exercises[exercise.name] = data;
        saveState();
        render();
        renderHistory(exercise.name);
      });

      table.appendChild(row);
    });

    const footer = document.createElement('div');
    footer.className = 'exercise-footer';
    footer.innerHTML = `
      <div>
        <label>Notiz</label>
        <input class="noteInput" type="text" value="${data.note || ''}" placeholder="z. B. Satz 3 schwerer, Hüfte okay">
      </div>
      <div class="footer-actions">
        <button class="ghost fillLastBtn">Letzte Werte übernehmen</button>
        <button class="ghost resetExerciseBtn">Übung zurücksetzen</button>
        <button class="ghost markExerciseBtn">Übung fertig</button>
      </div>
    `;

    footer.querySelector('.historyBtn');
    const noteInput = footer.querySelector('.noteInput');
    noteInput.addEventListener('change', () => {
      data.note = noteInput.value.trim();
      session.exercises[exercise.name] = data;
      saveState();
    });

    footer.querySelector('.fillLastBtn').addEventListener('click', () => {
      if (!last?.sets?.length) return;
      data.sets = data.sets.map((set, idx) => ({
        ...set,
        weight: last.sets[idx]?.weight || last.sets[0]?.weight || set.weight,
        reps: last.sets[idx]?.reps || last.sets[0]?.reps || set.reps
      }));
      session.exercises[exercise.name] = data;
      saveState();
      render();
    });

    footer.querySelector('.resetExerciseBtn').addEventListener('click', () => {
      clearExerciseData(exercise.name, exercise.sets, exercise.reps);
      render();
      renderHistory(exercise.name);
    });

    footer.querySelector('.markExerciseBtn').addEventListener('click', () => {
      data.sets = data.sets.map(set => ({ ...set, done: true }));
      session.exercises[exercise.name] = data;
      saveState();
      render();
      renderHistory(exercise.name);
    });

    card.querySelector('.historyBtn').addEventListener('click', () => renderHistory(exercise.name));
    card.appendChild(footer);
    list.appendChild(card);
  }
}

function render() {
  const day = getDay(getSelectedDayId());
  const session = getCurrentSession();
  $('sessionNotes').value = session.notes || '';
  renderSummary(day, session);
  renderExercises(day);
  updateTimerDisplay();
  if (state.activeExercise) renderHistory(state.activeExercise);
}

async function init() {
  const res = await fetch(`plan.json?v=3`);
  state.plan = await res.json();
  renderDayOptions();
  $('trainingDate').value = todayISO();
  $('daySelect').value = String(state.data.currentDay || 1);
  $('sessionNotes').addEventListener('change', saveCurrentSession);
  $('daySelect').addEventListener('change', () => {
    state.data.currentDay = getSelectedDayId();
    saveState();
    render();
  });
  $('trainingDate').addEventListener('change', render);
  $('saveSessionBtn').addEventListener('click', () => {
    saveCurrentSession();
    alert('Training gespeichert.');
  });
  $('resetWorkoutBtn').addEventListener('click', () => {
    if (!confirm('Aktuelles Training wirklich zurücksetzen?')) return;
    resetWorkout();
  });
  $('completeDayBtn').addEventListener('click', () => {
    saveCurrentSession();
    state.data.currentDay = state.data.currentDay === 4 ? 1 : state.data.currentDay + 1;
    saveState();
    $('daySelect').value = String(state.data.currentDay);
    render();
    alert('Training abgeschlossen. Nächster Trainingstag gesetzt.');
  });
  document.querySelectorAll('.timerPreset').forEach(btn => btn.addEventListener('click', () => {
    state.data.timerDefault = Number(btn.dataset.seconds);
    saveState();
    resetTimer(state.data.timerDefault);
  }));
  $('startTimerBtn').addEventListener('click', startTimer);
  $('pauseTimerBtn').addEventListener('click', pauseTimer);
  $('resetTimerBtn').addEventListener('click', () => resetTimer());
  resetTimer(state.data.timerDefault || 90);
  render();
}

init();
