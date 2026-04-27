const { useEffect, useRef, useState } = React;

const STORAGE_KEY = "polaris-lite-v2";

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

function createMeditationForm(date = getLocalDateKey()) {
  return {
    id: "",
    date,
    durationMinutes: "",
    notes: "",
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

function normalizeMeditationEntry(entry) {
  return {
    id: entry?.id || makeId("meditation"),
    date: entry?.date || getLocalDateKey(),
    durationMinutes: entry?.durationMinutes ?? "",
    notes: entry?.notes ?? "",
    createdAt: entry?.createdAt || Date.now(),
    updatedAt: entry?.updatedAt || Date.now(),
  };
}

function loadAppState() {
  const fallback = {
    weightEntries: [],
    meditationEntries: [],
  };

  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem("polaris-lite-v1") ||
      window.localStorage.getItem("planner-tracker-v2") ||
      window.localStorage.getItem("planner-tracker-v1");

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      weightEntries: Array.isArray(parsed?.weightEntries) ? parsed.weightEntries.map(normalizeWeightEntry) : [],
      meditationEntries: Array.isArray(parsed?.meditationEntries)
        ? parsed.meditationEntries.map(normalizeMeditationEntry)
        : [],
    };
  } catch (error) {
    return fallback;
  }
}

function saveAppState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore
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

function calculateMeditationStats(entries) {
  return {
    totalSessions: entries.length,
    totalMinutes: entries.reduce((total, entry) => total + (toNumber(entry.durationMinutes) || 0), 0),
  };
}

function Navigation({ activeView, onChange }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "weight", label: "Weight" },
    { id: "meditation", label: "Meditation" },
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

    chartRef.current = new window.Chart(context, {
      type: "line",
      data: {
        labels,
        datasets: [
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
            ticks: { color: "#839297", font: { size: 11 } },
          },
          y: {
            grid: { color: "rgba(131, 146, 151, 0.14)" },
            ticks: { color: "#839297", font: { size: 11 } },
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

function HomeScreen({ latestWeight, meditationStats, onOpen }) {
  return (
    <section className="home">
      <article className="card intro-card intro-card-hero">
        <p className="eyebrow">Polaris</p>
        <h1>A quiet place to track weight and meditation.</h1>
        <p className="intro-copy">
          Two simple trackers. Plenty of space. Nothing extra to manage.
        </p>
      </article>

      <div className="home-grid">
        <button type="button" className="card home-card" onClick={() => onOpen("weight")}>
          <p className="eyebrow">Weight</p>
          <h2>{latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "Add your first entry"}</h2>
          <p>{latestWeight ? `Latest log from ${formatLongDate(latestWeight.date)}` : "Track weight over time with one simple graph."}</p>
        </button>

        <button type="button" className="card home-card" onClick={() => onOpen("meditation")}>
          <p className="eyebrow">Meditation</p>
          <h2>{meditationStats.totalSessions ? `${meditationStats.totalSessions} sessions` : "Start with 3 minutes"}</h2>
          <p>
            {meditationStats.totalSessions
              ? `${meditationStats.totalMinutes} total minutes logged`
              : "Log a session with a date, duration, and optional note."}
          </p>
        </button>
      </div>
    </section>
  );
}

function WeightScreen({ entries, form, formError, onFormChange, onSave, onEdit, onDelete }) {
  const sortedEntries = getSortedWeightEntries(entries, "desc");
  const chartSeries = getWeightChartSeries(entries);

  return (
    <section className="tracker-screen">
      <article className="card screen-card screen-card-large">
        <div className="section-head">
          <div>
            <p className="eyebrow">Weight</p>
            <h2>Weight over time</h2>
          </div>
        </div>

        <WeightChart labels={chartSeries.labels} values={chartSeries.values} unit={chartSeries.unit} />
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

function MeditationScreen({ entries, form, formError, stats, onFormChange, onSave, onEdit, onDelete }) {
  const sortedEntries = [...entries].sort((left, right) => {
    const dateDelta = new Date(right.date) - new Date(left.date);
    return dateDelta || (right.createdAt || 0) - (left.createdAt || 0);
  });

  return (
    <section className="tracker-screen">
      <article className="card screen-card screen-card-large">
        <div className="section-head">
          <div>
            <p className="eyebrow">Meditation</p>
            <h2>Simple session history</h2>
          </div>
          <p className="subtle-stat">{stats.totalSessions ? `${stats.totalSessions} sessions` : ""}</p>
        </div>

        {sortedEntries.length ? (
          <div className="list-stack">
            {sortedEntries.map((entry) => (
              <article key={entry.id} className="history-item history-item-notes">
                <div>
                  <p className="history-date">{formatLongDate(entry.date)}</p>
                  <strong className="history-main">{entry.durationMinutes} min</strong>
                  {entry.notes ? <p className="history-note">{entry.notes}</p> : null}
                </div>
                <div className="history-actions">
                  <button type="button" className="text-button" onClick={() => onEdit(entry)}>Edit</button>
                  <button type="button" className="text-button danger" onClick={() => onDelete(entry.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">No sessions yet. Start with 3 minutes.</p>
        )}
      </article>

      <article className="card panel-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">New session</p>
            <h3>{form.id ? "Edit session" : "Add meditation session"}</h3>
          </div>
        </div>

        <div className="form-stack">
          <label className="field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
          </label>
          <label className="field">
            <span>Duration</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.durationMinutes}
              onChange={(event) => onFormChange("durationMinutes", event.target.value)}
              placeholder="10"
            />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <textarea
              rows="4"
              value={form.notes}
              onChange={(event) => onFormChange("notes", event.target.value)}
              placeholder="Anything you want to remember"
            />
          </label>
        </div>

        {formError ? <p className="form-error">{formError}</p> : null}

        <button type="button" className="primary-button" onClick={onSave}>
          {form.id ? "Save session" : "Add session"}
        </button>
      </article>
    </section>
  );
}

function App() {
  const [appState, setAppState] = useState(loadAppState);
  const [activeView, setActiveView] = useState("home");
  const [weightForm, setWeightForm] = useState(createWeightForm());
  const [meditationForm, setMeditationForm] = useState(createMeditationForm());
  const [weightFormError, setWeightFormError] = useState("");
  const [meditationFormError, setMeditationFormError] = useState("");

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  const latestWeight = getSortedWeightEntries(appState.weightEntries, "desc")[0] || null;
  const meditationStats = calculateMeditationStats(appState.meditationEntries);

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

  function handleMeditationFormChange(field, value) {
    setMeditationForm((current) => ({ ...current, [field]: value }));
  }

  function resetMeditationForm() {
    setMeditationForm(createMeditationForm());
    setMeditationFormError("");
  }

  function handleSaveMeditation() {
    const durationMinutes = toNumber(meditationForm.durationMinutes);
    if (!meditationForm.date || durationMinutes === null || durationMinutes <= 0) {
      setMeditationFormError("Please add a valid date and duration.");
      return;
    }

    const nextEntry = normalizeMeditationEntry({
      ...meditationForm,
      durationMinutes,
      createdAt: meditationForm.id
        ? appState.meditationEntries.find((entry) => entry.id === meditationForm.id)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    });

    setAppState((current) => ({
      ...current,
      meditationEntries: [...current.meditationEntries.filter((entry) => entry.id !== nextEntry.id), nextEntry],
    }));

    resetMeditationForm();
    setActiveView("meditation");
  }

  function handleEditMeditation(entry) {
    setMeditationForm({
      id: entry.id,
      date: entry.date,
      durationMinutes: entry.durationMinutes,
      notes: entry.notes,
    });
    setMeditationFormError("");
    setActiveView("meditation");
  }

  function handleDeleteMeditation(id) {
    setAppState((current) => ({
      ...current,
      meditationEntries: current.meditationEntries.filter((entry) => entry.id !== id),
    }));

    if (meditationForm.id === id) {
      resetMeditationForm();
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="topbar__label">Polaris</p>
        </div>
        <Navigation activeView={activeView} onChange={setActiveView} />
      </header>

      {activeView === "home" ? (
        <HomeScreen latestWeight={latestWeight} meditationStats={meditationStats} onOpen={setActiveView} />
      ) : null}

      {activeView === "weight" ? (
        <WeightScreen
          entries={appState.weightEntries}
          form={weightForm}
          formError={weightFormError}
          onFormChange={handleWeightFormChange}
          onSave={handleSaveWeight}
          onEdit={handleEditWeight}
          onDelete={handleDeleteWeight}
        />
      ) : null}

      {activeView === "meditation" ? (
        <MeditationScreen
          entries={appState.meditationEntries}
          form={meditationForm}
          formError={meditationFormError}
          stats={meditationStats}
          onFormChange={handleMeditationFormChange}
          onSave={handleSaveMeditation}
          onEdit={handleEditMeditation}
          onDelete={handleDeleteMeditation}
        />
      ) : null}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
