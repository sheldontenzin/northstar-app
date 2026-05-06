const { useEffect, useRef, useState } = React;

const STORAGE_KEY = "polaris-lite-v3";
const WEIGHT_GOAL_MIN = 135;
const WEIGHT_GOAL_MAX = 137;
const CELEBRATION_MESSAGES = [
  "Sheldon, this is what the fuck happens when you stop waiting to feel ready.",
  "You kept saying you wanted change. Now you're finally acting like it.",
  "Sheldon, look at the proof. You actually did the hard shit.",
  "This wasn't motivation. This was discipline.",
  "You didn't magically become confident. You built evidence.",
  "Sheldon, every day you didn't quit brought you here.",
  "This is what happens when you stop lying to yourself and follow through.",
  "You're becoming dangerous because you're starting to trust your own word.",
  "Most people say they want change. Very few actually endure it.",
  "Sheldon, you're finally becoming someone who can rely on herself.",
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createWeightForm(date = getLocalDateKey()) {
  return {
    id: "",
    date,
    weight: "",
  };
}

function normalizeWeightEntry(entry) {
  return {
    id: entry?.id || makeId("weight"),
    date: entry?.date || getLocalDateKey(),
    weight: entry?.weight ?? "",
    unit: entry?.unit === "kg" ? "kg" : "lb",
    createdAt: entry?.createdAt || Date.now(),
    updatedAt: entry?.updatedAt || Date.now(),
  };
}

function loadAppState() {
  const fallback = {
    weightEntries: [],
    deepWorkDays: {},
    workoutDays: {},
  };

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem("polaris-lite-v2") ||
      window.localStorage.getItem("polaris-lite-v1") ||
      window.localStorage.getItem("planner-tracker-v2") ||
      window.localStorage.getItem("planner-tracker-v1");

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      weightEntries: Array.isArray(parsed?.weightEntries) ? parsed.weightEntries.map(normalizeWeightEntry) : [],
      deepWorkDays: parsed?.deepWorkDays && typeof parsed.deepWorkDays === "object" ? parsed.deepWorkDays : {},
      workoutDays: parsed?.workoutDays && typeof parsed.workoutDays === "object" ? parsed.workoutDays : {},
    };
  } catch (error) {
    return fallback;
  }
}

function saveAppState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore storage failures
  }
}

function getSortedWeightEntries(entries, direction = "desc") {
  return [...entries].sort((left, right) => {
    const dateDelta = new Date(left.date) - new Date(right.date);
    const createdDelta = (left.createdAt || 0) - (right.createdAt || 0);
    const delta = dateDelta || createdDelta;
    return direction === "asc" ? delta : -delta;
  });
}

function getWeightChartSeries(entries) {
  const sorted = getSortedWeightEntries(entries, "asc").slice(-12);
  const unit = sorted[sorted.length - 1]?.unit || "lb";

  return {
    labels: sorted.map((entry) => formatShortDate(entry.date)),
    values: sorted.map((entry) => toNumber(entry.weight)),
    unit,
  };
}

function getWeightGoalMessage(entry) {
  if (!entry) {
    return `Goal range: ${WEIGHT_GOAL_MIN}-${WEIGHT_GOAL_MAX} lb`;
  }

  const weight = toNumber(entry.weight);
  if (weight === null) {
    return `Goal range: ${WEIGHT_GOAL_MIN}-${WEIGHT_GOAL_MAX} lb`;
  }

  if (weight > WEIGHT_GOAL_MAX) {
    return `Goal range: ${WEIGHT_GOAL_MIN}-${WEIGHT_GOAL_MAX} lb · ${(weight - WEIGHT_GOAL_MAX).toFixed(1)} lb to reach the top of range`;
  }

  if (weight < WEIGHT_GOAL_MIN) {
    return `Goal range: ${WEIGHT_GOAL_MIN}-${WEIGHT_GOAL_MAX} lb · ${(WEIGHT_GOAL_MIN - weight).toFixed(1)} lb to enter the range`;
  }

  return `Goal range: ${WEIGHT_GOAL_MIN}-${WEIGHT_GOAL_MAX} lb · You're in range`;
}

function getLowestWeight(entries) {
  const weights = entries.map((entry) => toNumber(entry.weight)).filter((value) => value !== null);
  return weights.length ? Math.min(...weights) : null;
}

function getRecentConsistency(deepWorkDays, days = 14) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    const key = getLocalDateKey(date);
    return {
      key,
      short: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      done: Boolean(deepWorkDays[key]),
    };
  });
}

function pickCelebrationMessage() {
  return CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)];
}

function Navigation({ activeView, onChange }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "weight", label: "Weight" },
  ];

  return (
    <nav className="nav" aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav__item ${activeView === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function ConfettiOverlay({ active }) {
  if (!active) {
    return null;
  }

  const pieces = Array.from({ length: 26 }, (_, index) => ({
    id: index,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.35}s`,
    duration: `${2.2 + Math.random() * 1.6}s`,
    rotate: `${Math.random() * 320}deg`,
    color: ["#63b4b1", "#dff4f0", "#f1f0ff", "#eaf7f1", "#ffd87c"][index % 5],
  }));

  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

function WeightChart({ labels, values, unit }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const hasData = values.some((value) => value !== null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart || !hasData) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const context = canvasRef.current.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(92, 186, 183, 0.22)");
    gradient.addColorStop(1, "rgba(92, 186, 183, 0.02)");
    const finiteValues = values.filter((value) => value !== null);
    const rangeMin = Math.min(...finiteValues, WEIGHT_GOAL_MIN);
    const rangeMax = Math.max(...finiteValues, WEIGHT_GOAL_MAX);
    const padding = Math.max(2, (rangeMax - rangeMin) * 0.3);
    const suggestedMin = Math.floor(rangeMin - padding);
    const suggestedMax = Math.ceil(rangeMax + padding);

    chartRef.current = new window.Chart(context, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: labels.map(() => WEIGHT_GOAL_MIN),
            borderColor: "rgba(95, 183, 180, 0.24)",
            borderWidth: 1.5,
            borderDash: [6, 6],
            pointRadius: 0,
          },
          {
            data: labels.map(() => WEIGHT_GOAL_MAX),
            borderColor: "rgba(95, 183, 180, 0.24)",
            borderWidth: 1.5,
            borderDash: [6, 6],
            pointRadius: 0,
          },
          {
            data: values,
            borderColor: "#59aaa8",
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            spanGaps: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label(context) {
                return `${context.parsed.y.toFixed(1)} ${unit}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "rgba(255, 255, 255, 0.7)", font: { size: 11 } },
          },
          y: {
            min: suggestedMin,
            max: suggestedMax,
            grid: { color: "rgba(255, 255, 255, 0.12)" },
            ticks: { color: "rgba(255, 255, 255, 0.72)", font: { size: 11 } },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [labels, values, unit, hasData]);

  if (!window.Chart || !hasData) {
    return <p className="empty-copy">No weight entries yet. Add one neutral data point.</p>;
  }

  return (
    <div className="weight-chart">
      <canvas ref={canvasRef} />
    </div>
  );
}

function HomeScreen({
  latestWeight,
  deepWorkToday,
  workoutToday,
  deepWorkConsistency,
  workoutConsistency,
  onOpenWeight,
  onSetDeepWork,
  onSetWorkout,
}) {
  return (
    <section className="home">
      <article className="card intro-card intro-card-hero">
        <p className="eyebrow">Polaris</p>
        <h1>Track weight and keep the day alive.</h1>
        <p className="intro-copy">
          Weight progress on one side. No-zero-days consistency on the other.
        </p>
      </article>

      <div className="home-grid">
        <button type="button" className="card home-card" onClick={onOpenWeight}>
          <p className="eyebrow">Weight</p>
          <h2>{latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "Add your first entry"}</h2>
          <p>
            {latestWeight ? `Latest log from ${formatLongDate(latestWeight.date)}` : "Track weight over time with one simple graph."}
          </p>
        </button>

        <article className="card home-card deep-work-card">
          <p className="eyebrow">Deep work / no zero days</p>
          <h2>Did you work on something today?</h2>
          <div className="consistency-actions">
            <button
              type="button"
              className={`consistency-button ${deepWorkToday ? "active" : ""}`}
              onClick={() => onSetDeepWork(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={`consistency-button ${deepWorkToday === false ? "inactive-active" : ""}`}
              onClick={() => onSetDeepWork(false)}
            >
              No
            </button>
          </div>
          <div className="consistency-row" aria-label="Recent deep work consistency">
            {deepWorkConsistency.map((day) => (
              <div key={day.key} className="consistency-day">
                <span className={`consistency-dot ${day.done ? "done" : ""}`} />
                <small>{day.short}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="card home-card deep-work-card">
          <p className="eyebrow">Workout / no zero days</p>
          <h2>Did you do your workout today?</h2>
          <p className="consistency-copy">push-up progressions + pull-ups</p>
          <div className="consistency-actions">
            <button
              type="button"
              className={`consistency-button ${workoutToday ? "active" : ""}`}
              onClick={() => onSetWorkout(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={`consistency-button ${workoutToday === false ? "inactive-active" : ""}`}
              onClick={() => onSetWorkout(false)}
            >
              No
            </button>
          </div>
          <div className="consistency-row" aria-label="Recent workout consistency">
            {workoutConsistency.map((day) => (
              <div key={day.key} className="consistency-day">
                <span className={`consistency-dot ${day.done ? "done" : ""}`} />
                <small>{day.short}</small>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function WeightScreen({
  entries,
  form,
  formError,
  latestWeight,
  celebration,
  onFormChange,
  onSave,
  onEdit,
  onDelete,
}) {
  const sortedEntries = getSortedWeightEntries(entries, "desc");
  const chartSeries = getWeightChartSeries(entries);
  const goalMessage = getWeightGoalMessage(latestWeight);

  return (
    <section className="tracker-screen">
      <ConfettiOverlay active={celebration.active} />

      {celebration.active ? (
        <div className="celebration-banner" role="status" aria-live="polite">
          <p>New low logged</p>
          <strong>{celebration.message}</strong>
        </div>
      ) : null}

      <article className="card screen-card screen-card-large">
        <div className="section-head">
          <div>
            <p className="eyebrow">Weight</p>
            <h2>Weight over time</h2>
          </div>
        </div>

        <WeightChart labels={chartSeries.labels} values={chartSeries.values} unit={chartSeries.unit} />
        <p className="goal-note">{goalMessage}</p>
      </article>

      <article className="card panel-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">New entry</p>
            <h3>{form.id ? "Edit weight entry" : "Add weight entry"}</h3>
          </div>
        </div>

        <div className="form-stack">
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
          </label>
          <label className="field">
            <span>Weight</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={form.weight}
              onChange={(event) => onFormChange("weight", event.target.value)}
              placeholder="145.2"
            />
          </label>
        </div>

        {formError ? <p className="form-error">{formError}</p> : null}

        <button type="button" className="primary-button" onClick={onSave}>
          {form.id ? "Save entry" : "Add entry"}
        </button>
      </article>

      {sortedEntries.length ? (
        <article className="card panel-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Recent</p>
              <h3>Recent entries</h3>
            </div>
          </div>

          <div className="list-stack">
            {sortedEntries.slice(0, 6).map((entry) => (
              <article key={entry.id} className="history-item">
                <div>
                  <p className="history-date">{formatLongDate(entry.date)}</p>
                  <strong className="history-main">{entry.weight} {entry.unit}</strong>
                </div>
                <div className="history-actions">
                  <button type="button" className="text-button" onClick={() => onEdit(entry)}>Edit</button>
                  <button type="button" className="text-button danger" onClick={() => onDelete(entry.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function App() {
  const [appState, setAppState] = useState(loadAppState);
  const [activeView, setActiveView] = useState("home");
  const [weightForm, setWeightForm] = useState(createWeightForm());
  const [weightFormError, setWeightFormError] = useState("");
  const [celebration, setCelebration] = useState({ active: false, message: "" });

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useEffect(() => {
    if (!celebration.active) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCelebration({ active: false, message: "" });
    }, 4200);

    return () => window.clearTimeout(timeoutId);
  }, [celebration]);

  const latestWeight = getSortedWeightEntries(appState.weightEntries, "desc")[0] || null;
  const todayKey = getLocalDateKey();
  const deepWorkToday = todayKey in appState.deepWorkDays ? Boolean(appState.deepWorkDays[todayKey]) : null;
  const workoutToday = todayKey in appState.workoutDays ? Boolean(appState.workoutDays[todayKey]) : null;
  const deepWorkConsistency = getRecentConsistency(appState.deepWorkDays);
  const workoutConsistency = getRecentConsistency(appState.workoutDays);

  function handleWeightFormChange(field, value) {
    setWeightForm((current) => ({ ...current, [field]: value }));
  }

  function resetWeightForm() {
    setWeightForm(createWeightForm());
    setWeightFormError("");
  }

  function handleSaveWeight() {
    const weightValue = toNumber(weightForm.weight);
    if (!weightForm.date || weightValue === null || weightValue <= 0) {
      setWeightFormError("Please add a valid date and weight.");
      return;
    }

    const previousLowest = getLowestWeight(
      appState.weightEntries.filter((entry) => entry.id !== weightForm.id)
    );

    const nextEntry = normalizeWeightEntry({
      ...weightForm,
      weight: weightValue,
      unit: appState.weightEntries[0]?.unit || "lb",
      createdAt: weightForm.id
        ? appState.weightEntries.find((entry) => entry.id === weightForm.id)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    });

    setAppState((current) => ({
      ...current,
      weightEntries: [...current.weightEntries.filter((entry) => entry.id !== nextEntry.id), nextEntry],
    }));

    if (previousLowest === null || weightValue < previousLowest) {
      setCelebration({
        active: true,
        message: pickCelebrationMessage(),
      });
    }

    resetWeightForm();
    setActiveView("weight");
  }

  function handleEditWeight(entry) {
    setWeightForm({
      id: entry.id,
      date: entry.date,
      weight: entry.weight,
    });
    setWeightFormError("");
    setActiveView("weight");
  }

  function handleDeleteWeight(id) {
    setAppState((current) => ({
      ...current,
      weightEntries: current.weightEntries.filter((entry) => entry.id !== id),
    }));

    if (weightForm.id === id) {
      resetWeightForm();
    }
  }

  function handleSetDeepWork(value) {
    setAppState((current) => ({
      ...current,
      deepWorkDays: {
        ...current.deepWorkDays,
        [todayKey]: value,
      },
    }));
  }

  function handleSetWorkout(value) {
    setAppState((current) => ({
      ...current,
      workoutDays: {
        ...current.workoutDays,
        [todayKey]: value,
      },
    }));
  }

  return (
    <main className="app-shell">
      <div className="bg-orb bg-orb-one" aria-hidden="true" />
      <div className="bg-orb bg-orb-two" aria-hidden="true" />
      <div className="bg-orb bg-orb-three" aria-hidden="true" />
      <div className="bg-orb bg-orb-four" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <p className="topbar__label">
            <span className="brand-star" aria-hidden="true">✦</span>
            <span>Polaris</span>
          </p>
        </div>
        <Navigation activeView={activeView} onChange={setActiveView} />
      </header>

      {activeView === "home" ? (
        <HomeScreen
          latestWeight={latestWeight}
          deepWorkToday={deepWorkToday}
          workoutToday={workoutToday}
          deepWorkConsistency={deepWorkConsistency}
          workoutConsistency={workoutConsistency}
          onOpenWeight={() => setActiveView("weight")}
          onSetDeepWork={handleSetDeepWork}
          onSetWorkout={handleSetWorkout}
        />
      ) : null}

      {activeView === "weight" ? (
        <WeightScreen
          entries={appState.weightEntries}
          form={weightForm}
          formError={weightFormError}
          latestWeight={latestWeight}
          celebration={celebration}
          onFormChange={handleWeightFormChange}
          onSave={handleSaveWeight}
          onEdit={handleEditWeight}
          onDelete={handleDeleteWeight}
        />
      ) : null}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
