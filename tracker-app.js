const { useEffect, useRef, useState } = React;

const STORAGE_KEY = "polaris-lite-v1";

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

function formatShortDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
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

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function createWeightForm(date = getLocalDateKey()) {
  return {
    id: "",
    date,
    weight: "",
    unit: "lb",
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
    // ignore storage write failures
  }
}

function convertWeight(value, fromUnit, toUnit) {
  if (value === null) {
    return null;
  }

  if (fromUnit === toUnit) {
    return value;
  }

  return fromUnit === "lb" ? value / 2.20462 : value * 2.20462;
}

function getSortedWeightEntries(entries, direction = "desc") {
  return [...entries].sort((left, right) => {
    const dateDelta = new Date(left.date) - new Date(right.date);
    const createdDelta = (left.createdAt || 0) - (right.createdAt || 0);
    const delta = dateDelta || createdDelta;
    return direction === "asc" ? delta : -delta;
  });
}

function calculateWeightChange(entries, entryId) {
  const sorted = getSortedWeightEntries(entries, "asc");
  const index = sorted.findIndex((entry) => entry.id === entryId);
  if (index <= 0) {
    return null;
  }

  const current = sorted[index];
  const previous = sorted[index - 1];
  const currentValue = toNumber(current.weight);
  const previousValue = convertWeight(toNumber(previous.weight), previous.unit, current.unit);

  if (currentValue === null || previousValue === null) {
    return null;
  }

  return currentValue - previousValue;
}

function calculateSevenDayAverage(entries, entryId) {
  const current = entries.find((entry) => entry.id === entryId);
  if (!current) {
    return null;
  }

  const currentDate = getDateFromKey(current.date);
  const startDate = new Date(currentDate);
  startDate.setDate(currentDate.getDate() - 6);

  const values = entries
    .filter((entry) => {
      const date = getDateFromKey(entry.date);
      return date >= startDate && date <= currentDate;
    })
    .map((entry) => convertWeight(toNumber(entry.weight), entry.unit, current.unit))
    .filter((value) => value !== null);

  return values.length >= 3 ? average(values) : null;
}

function calculateWeightTrend(entries) {
  const sorted = getSortedWeightEntries(entries, "asc");
  if (sorted.length < 3) {
    return "Stable";
  }

  const latest = sorted[sorted.length - 1];
  const latestValue = toNumber(latest.weight);
  const baseline = sorted
    .slice(-5, -1)
    .map((entry) => convertWeight(toNumber(entry.weight), entry.unit, latest.unit))
    .filter((value) => value !== null);

  if (latestValue === null || !baseline.length) {
    return "Stable";
  }

  const delta = latestValue - average(baseline);
  if (delta <= -0.6) {
    return "Trending down";
  }
  if (delta >= 0.6) {
    return "Trending up";
  }
  return "Stable";
}

function calculateMeditationStats(entries) {
  const totalSessions = entries.length;
  const totalMinutes = entries.reduce((total, entry) => total + (toNumber(entry.durationMinutes) || 0), 0);
  const dates = [...new Set(entries.map((entry) => entry.date))].sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let running = 0;

  dates.forEach((dateKey, index) => {
    if (index === 0) {
      running = 1;
    } else {
      const previous = getDateFromKey(dates[index - 1]);
      previous.setDate(previous.getDate() + 1);
      running = getLocalDateKey(previous) === dateKey ? running + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, running);
  });

  if (dates.length > 0) {
    currentStreak = 1;
    for (let index = dates.length - 1; index > 0; index -= 1) {
      const previous = getDateFromKey(dates[index - 1]);
      previous.setDate(previous.getDate() + 1);
      if (getLocalDateKey(previous) === dates[index]) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return {
    totalSessions,
    totalMinutes,
    currentStreak,
    longestStreak,
  };
}

function getWeightChartSeries(entries) {
  const sorted = getSortedWeightEntries(entries, "asc").slice(-12);
  const latestUnit = sorted[sorted.length - 1]?.unit || "lb";

  return {
    labels: sorted.map((entry) => formatShortDate(entry.date)),
    values: sorted.map((entry) => convertWeight(toNumber(entry.weight), entry.unit, latestUnit)),
    unit: latestUnit,
  };
}

function SegmentedNav({ activeView, onChange }) {
  return (
    <div className="segmented-nav" role="tablist" aria-label="Tracker navigation">
      {["weight", "meditation"].map((view) => (
        <button
          key={view}
          type="button"
          className={`segmented-nav__item ${activeView === view ? "active" : ""}`}
          onClick={() => onChange(view)}
        >
          {view === "weight" ? "Weight" : "Meditation"}
        </button>
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
    gradient.addColorStop(0, "rgba(92, 186, 183, 0.28)");
    gradient.addColorStop(1, "rgba(92, 186, 183, 0.02)");

    chartRef.current = new window.Chart(context, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: "#4da8a8",
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.38,
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
            ticks: { color: "#7d8f95", font: { size: 11 } },
          },
          y: {
            grid: { color: "rgba(136, 156, 163, 0.16)" },
            ticks: {
              color: "#7d8f95",
              font: { size: 11 },
              callback(value) {
                return `${value}`;
              },
            },
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

function WeightScreen({
  entries,
  form,
  formError,
  latestWeight,
  trend,
  onFormChange,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
}) {
  const sortedEntries = getSortedWeightEntries(entries, "desc");
  const chartSeries = getWeightChartSeries(entries);
  const latestAverage = latestWeight ? calculateSevenDayAverage(entries, latestWeight.id) : null;

  return (
    <section className="screen-grid">
      <article className="card card-feature">
        <div className="feature-copy">
          <p className="eyebrow">Weight tracker</p>
          <h2>Steady, simple, and neutral.</h2>
          <p>
            Your graph is the focus here. Just log the date and weight, then let the app quietly show the shape of things.
          </p>
        </div>

        <div className="metric-row">
          <div className="metric-pill">
            <span>Latest</span>
            <strong>{latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "--"}</strong>
          </div>
          <div className="metric-pill">
            <span>7-day average</span>
            <strong>{latestAverage === null ? "--" : `${latestAverage.toFixed(1)} ${latestWeight.unit}`}</strong>
          </div>
          <div className="metric-pill">
            <span>Trend</span>
            <strong>{trend}</strong>
          </div>
        </div>

        <WeightChart labels={chartSeries.labels} values={chartSeries.values} unit={chartSeries.unit} />
      </article>

      <div className="screen-side">
        <article className="card card-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">New entry</p>
              <h3>{form.id ? "Edit weight entry" : "Add weight entry"}</h3>
            </div>
            {form.id ? (
              <button type="button" className="ghost-button" onClick={onCancelEdit}>
                Cancel
              </button>
            ) : null}
          </div>

          <div className="form-stack">
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
            </label>
            <label className="field">
              <span>Weight</span>
              <div className="weight-input-row">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.weight}
                  onChange={(event) => onFormChange("weight", event.target.value)}
                  placeholder="145.2"
                />
                <div className="inline-toggle">
                  <button
                    type="button"
                    className={form.unit === "lb" ? "active" : ""}
                    onClick={() => onFormChange("unit", "lb")}
                  >
                    lb
                  </button>
                  <button
                    type="button"
                    className={form.unit === "kg" ? "active" : ""}
                    onClick={() => onFormChange("unit", "kg")}
                  >
                    kg
                  </button>
                </div>
              </div>
            </label>
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}

          <button type="button" className="primary-button" onClick={onSave}>
            {form.id ? "Save entry" : "Add entry"}
          </button>
        </article>

        <article className="card card-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Recent history</p>
              <h3>Latest weight logs</h3>
            </div>
          </div>

          {sortedEntries.length ? (
            <div className="list-stack">
              {sortedEntries.map((entry) => {
                const change = calculateWeightChange(entries, entry.id);
                const directionClass =
                  change === null ? "" : change > 0 ? "warm" : change < 0 ? "cool" : "";

                return (
                  <article key={entry.id} className="history-item">
                    <div>
                      <p className="history-date">{formatLongDate(entry.date)}</p>
                      <strong className="history-main">{entry.weight} {entry.unit}</strong>
                    </div>
                    <div className="history-side">
                      <span className={`history-change ${directionClass}`}>
                        {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} ${entry.unit}`}
                      </span>
                      <div className="history-actions">
                        <button type="button" className="text-button" onClick={() => onEdit(entry)}>Edit</button>
                        <button type="button" className="text-button danger" onClick={() => onDelete(entry.id)}>Delete</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-copy">No weight entries yet. Add one neutral data point.</p>
          )}
        </article>
      </div>
    </section>
  );
}

function MeditationScreen({
  entries,
  form,
  formError,
  stats,
  onFormChange,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
}) {
  const sortedEntries = [...entries].sort((left, right) => {
    const dateDelta = new Date(right.date) - new Date(left.date);
    return dateDelta || (right.createdAt || 0) - (left.createdAt || 0);
  });

  return (
    <section className="screen-grid meditation-grid">
      <article className="card card-feature meditation-feature">
        <div className="feature-copy">
          <p className="eyebrow">Meditation tracker</p>
          <h2>Beginner-friendly and quiet.</h2>
          <p>
            Log the session, note what mattered, and let the history feel like a gentle trail instead of a performance dashboard.
          </p>
        </div>

        <div className="metric-row">
          <div className="metric-pill lavender">
            <span>Total sessions</span>
            <strong>{stats.totalSessions}</strong>
          </div>
          <div className="metric-pill mint">
            <span>Total minutes</span>
            <strong>{stats.totalMinutes}</strong>
          </div>
          <div className="metric-pill sky">
            <span>Current streak</span>
            <strong>{stats.currentStreak}</strong>
          </div>
        </div>

        <div className="reflection-card">
          <p className="eyebrow">Gentle reminder</p>
          <p>Meditation is not about having no thoughts. It is about noticing and returning.</p>
        </div>
      </article>

      <div className="screen-side">
        <article className="card card-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">New session</p>
              <h3>{form.id ? "Edit meditation session" : "Log meditation"}</h3>
            </div>
            {form.id ? (
              <button type="button" className="ghost-button" onClick={onCancelEdit}>
                Cancel
              </button>
            ) : null}
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
                placeholder="10 minutes"
              />
            </label>
            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => onFormChange("notes", event.target.value)}
                placeholder="What did I notice?"
              />
            </label>
          </div>

          {formError ? <p className="form-error">{formError}</p> : null}

          <button type="button" className="primary-button" onClick={onSave}>
            {form.id ? "Save session" : "Add session"}
          </button>
        </article>

        <article className="card card-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">History</p>
              <h3>Recent sessions</h3>
            </div>
          </div>

          {sortedEntries.length ? (
            <div className="list-stack">
              {sortedEntries.map((entry) => (
                <article key={entry.id} className="history-item meditation-item">
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
      </div>
    </section>
  );
}

function App() {
  const [appState, setAppState] = useState(loadAppState);
  const [activeView, setActiveView] = useState("weight");
  const [weightForm, setWeightForm] = useState(createWeightForm());
  const [meditationForm, setMeditationForm] = useState(createMeditationForm());
  const [weightFormError, setWeightFormError] = useState("");
  const [meditationFormError, setMeditationFormError] = useState("");

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  const latestWeight = getSortedWeightEntries(appState.weightEntries, "desc")[0] || null;
  const weightTrend = calculateWeightTrend(appState.weightEntries);
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
  }

  function handleEditWeight(entry) {
    setWeightForm({
      id: entry.id,
      date: entry.date,
      weight: entry.weight,
      unit: entry.unit,
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
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="topbar">
        <div>
          <p className="topbar__label">Polaris</p>
          <h1>Soft tracking for weight and meditation.</h1>
        </div>
        <SegmentedNav activeView={activeView} onChange={setActiveView} />
      </header>

      <section className="hero-panel">
        <div className="hero-panel__left">
          <p className="eyebrow">Today</p>
          <h2>{formatLongDate(getLocalDateKey())}</h2>
          <p>
            A calm place to log two simple things: how your body is trending and how often you return to stillness.
          </p>
        </div>

        <div className="hero-panel__right">
          <div className="glance-card">
            <span>Weight trend</span>
            <strong>{weightTrend}</strong>
          </div>
          <div className="glance-card lavender">
            <span>Meditation streak</span>
            <strong>{meditationStats.currentStreak} days</strong>
          </div>
          <div className="glance-card mint">
            <span>Total minutes</span>
            <strong>{meditationStats.totalMinutes}</strong>
          </div>
        </div>
      </section>

      {activeView === "weight" ? (
        <WeightScreen
          entries={appState.weightEntries}
          form={weightForm}
          formError={weightFormError}
          latestWeight={latestWeight}
          trend={weightTrend}
          onFormChange={handleWeightFormChange}
          onSave={handleSaveWeight}
          onEdit={handleEditWeight}
          onDelete={handleDeleteWeight}
          onCancelEdit={resetWeightForm}
        />
      ) : (
        <MeditationScreen
          entries={appState.meditationEntries}
          form={meditationForm}
          formError={meditationFormError}
          stats={meditationStats}
          onFormChange={handleMeditationFormChange}
          onSave={handleSaveMeditation}
          onEdit={handleEditMeditation}
          onDelete={handleDeleteMeditation}
          onCancelEdit={resetMeditationForm}
        />
      )}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
