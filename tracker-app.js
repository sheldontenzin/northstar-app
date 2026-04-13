const { useEffect, useRef, useState } = React;

const STORAGE_KEY = "planner-tracker-v1";
const CALORIE_TARGET = 1300;
const STEP_TARGET = 6000;
const WEEKLY_WORKOUT_TARGET = 3;
const RECENT_TREND_DAYS = 10;

const HABITS = [
  { id: "deepWork", label: "Deep Work", target: 60, unit: "min" },
  { id: "learning", label: "Learning", target: 20, unit: "min" },
  { id: "creativeWriting", label: "Creative Writing", target: 30, unit: "min" },
];

const NORTH_STAR_GOALS = [
  "Build a startup",
  "Get lean & strong",
  "Master a valuable skill",
  "Write consistently (my book)",
];

const MOOD_OPTIONS = [
  { value: 1, emoji: "🥺", label: "Tender" },
  { value: 2, emoji: "🌷", label: "Soft" },
  { value: 3, emoji: "☁️", label: "Steady" },
  { value: 4, emoji: "✨", label: "Bright" },
  { value: 5, emoji: "💗", label: "Radiant" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getWeekStartDate(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

function getWeekStartKey(date = new Date()) {
  return getLocalDateKey(getWeekStartDate(date));
}

function getWeekDates(weekStartKey) {
  const start = getDateFromKey(weekStartKey);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return getLocalDateKey(date);
  });
}

function getRecentDateKeys(days = RECENT_TREND_DAYS) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return getLocalDateKey(date);
  });
}

function createEmptyDayLog() {
  return {
    calories: "",
    steps: "",
    weight: "",
    mood: "",
    sleep: "",
    habits: HABITS.reduce((accumulator, habit) => {
      accumulator[habit.id] = {
        target: habit.target,
        logged: "",
        unit: habit.unit,
      };
      return accumulator;
    }, {}),
  };
}

function normalizeDayLog(dayLog) {
  const rawHabits = dayLog && typeof dayLog.habits === "object" ? dayLog.habits : {};

  return {
    calories: dayLog?.calories ?? "",
    steps: dayLog?.steps ?? "",
    weight: dayLog?.weight ?? "",
    mood: dayLog?.mood ?? "",
    sleep: dayLog?.sleep ?? "",
    habits: HABITS.reduce((accumulator, habit) => {
      const existingHabit = rawHabits[habit.id];

      if (typeof existingHabit === "boolean") {
        accumulator[habit.id] = {
          target: habit.target,
          logged: existingHabit ? String(habit.target) : "",
          unit: habit.unit,
        };
        return accumulator;
      }

      accumulator[habit.id] = {
        target: Number(existingHabit?.target) || habit.target,
        logged: existingHabit?.logged ?? "",
        unit: typeof existingHabit?.unit === "string" ? existingHabit.unit : habit.unit,
      };
      return accumulator;
    }, {}),
  };
}

function normalizeWeekLog(weekLog) {
  return {
    workoutsCompleted: Math.max(0, Number(weekLog?.workoutsCompleted) || 0),
  };
}

function loadTrackerState() {
  const fallback = {
    dailyLogs: {},
    weeklyLogs: {},
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const dailyLogs = {};
    const weeklyLogs = {};

    if (parsed && typeof parsed.dailyLogs === "object") {
      Object.entries(parsed.dailyLogs).forEach(([dateKey, dayLog]) => {
        dailyLogs[dateKey] = normalizeDayLog(dayLog);
      });
    }

    if (parsed && typeof parsed.weeklyLogs === "object") {
      Object.entries(parsed.weeklyLogs).forEach(([weekKey, weekLog]) => {
        weeklyLogs[weekKey] = normalizeWeekLog(weekLog);
      });
    }

    return { dailyLogs, weeklyLogs };
  } catch (error) {
    return fallback;
  }
}

function saveTrackerState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // ignore
  }
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatAverage(value, digits = 1, suffix = "") {
  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(digits)}${suffix}`;
}

function getHabitStreak(dailyLogs, todayKey, habitId) {
  let streak = 0;
  let cursor = getDateFromKey(todayKey);
  const habitDefinition = HABITS.find((habit) => habit.id === habitId);

  while (true) {
    const key = getLocalDateKey(cursor);
    const entry = dailyLogs[key];
    const logged = toNumber(entry?.habits?.[habitId]?.logged);

    if (!entry || !habitDefinition || logged === null || logged < habitDefinition.target) {
      return streak;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
}

function getWeeklySummary(dailyLogs, weekKey) {
  const weekDates = getWeekDates(weekKey);
  const sleepValues = [];
  const moodValues = [];
  const calorieValues = [];

  weekDates.forEach((dateKey) => {
    const entry = dailyLogs[dateKey];
    if (!entry) {
      return;
    }

    const sleep = toNumber(entry.sleep);
    const mood = toNumber(entry.mood);
    const calories = toNumber(entry.calories);

    if (sleep !== null) sleepValues.push(sleep);
    if (mood !== null) moodValues.push(mood);
    if (calories !== null) calorieValues.push(calories);
  });

  return {
    averageSleep: average(sleepValues),
    averageMood: average(moodValues),
    averageCalories: average(calorieValues),
  };
}

function getTrendSeries(dailyLogs, field) {
  const dateKeys = getRecentDateKeys();
  return {
    labels: dateKeys.map((dateKey) => formatShortDate(dateKey)),
    values: dateKeys.map((dateKey) => {
      const value = toNumber(dailyLogs[dateKey]?.[field]);
      return value === null ? null : value;
    }),
  };
}

function getCompletionStats(todayLog, workoutsCompleted) {
  const calories = toNumber(todayLog.calories);
  const steps = toNumber(todayLog.steps);

  const habitsProgressed = HABITS.filter((habit) => {
    const logged = toNumber(todayLog.habits[habit.id]?.logged);
    return logged !== null && logged > 0;
  }).length;

  const habitsCompleted = HABITS.filter((habit) => {
    const logged = toNumber(todayLog.habits[habit.id]?.logged);
    return logged !== null && logged >= habit.target;
  }).length;

  return {
    caloriesGoalHit: calories !== null && calories <= CALORIE_TARGET,
    stepsGoalHit: steps !== null && steps >= STEP_TARGET,
    habitsProgressed,
    habitsCompleted,
    habitsComplete: habitsCompleted === HABITS.length,
    workoutsComplete: workoutsCompleted >= WEEKLY_WORKOUT_TARGET,
  };
}

function getEncouragementMessage(stats) {
  const completedCount = [
    stats.caloriesGoalHit,
    stats.stepsGoalHit,
    stats.habitsComplete,
    stats.workoutsComplete,
  ].filter(Boolean).length;

  if (completedCount === 4) {
    return "Everything is lining up beautifully today. Keep protecting this gentle momentum.";
  }

  if (stats.habitsComplete && stats.stepsGoalHit) {
    return "Such a good rhythm. You’re building proof that your routines are becoming second nature.";
  }

  if (stats.caloriesGoalHit) {
    return "Your nutrition target is feeling steady today. That kind of quiet consistency really adds up.";
  }

  if (stats.habitsProgressed > 0) {
    return "Progress still counts. A little momentum today is still you showing up for yourself.";
  }

  return "Start with the gentlest next step. One tiny action can soften the whole day into motion.";
}

function formatMoodValue(value) {
  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)} / 5`;
}

function ProgressBar({ title, value, target, unit, inverse = false }) {
  const numericValue = toNumber(value);
  const ratio = numericValue === null ? 0 : Math.min(numericValue / target, 1);
  const isComplete = numericValue !== null && (inverse ? numericValue <= target : numericValue >= target);
  const isWarning = inverse && numericValue !== null && numericValue > target;

  let meta = `Target: ${target.toLocaleString()} ${unit}`;
  if (numericValue !== null && inverse && numericValue > target) {
    meta = `${(numericValue - target).toLocaleString()} ${unit} over target`;
  } else if (numericValue !== null && !inverse && numericValue < target) {
    meta = `${(target - numericValue).toLocaleString()} ${unit} to go`;
  } else if (numericValue !== null && inverse) {
    meta = "In range";
  }

  return (
    <article className={`progress-card ${isComplete ? "complete" : ""} ${isWarning ? "warning" : ""}`}>
      <div className="progress-top">
        <div>
          <p className="progress-title">{title}</p>
          <p className="progress-meta">{meta}</p>
        </div>
        <p className="progress-value">
          {numericValue === null ? "--" : numericValue.toLocaleString()} {unit}
        </p>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div
          className={`progress-fill ${isWarning ? "warning" : ""}`}
          style={{ width: `${Math.max(ratio * 100, numericValue !== null ? 8 : 0)}%` }}
        />
      </div>
    </article>
  );
}

function DailyTracker({ todayLog, onMetricChange }) {
  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Daily Tracking</p>
          <h2 className="section-title">Health and focus, logged in seconds.</h2>
        </div>
      </div>

      <div className="progress-list">
        <ProgressBar title="Calories" value={todayLog.calories} target={CALORIE_TARGET} unit="kcal" inverse />
        <ProgressBar title="Steps" value={todayLog.steps} target={STEP_TARGET} unit="steps" />
      </div>

      <div className="daily-grid">
        <div className="field">
          <label htmlFor="calories-input">Calories</label>
          <input id="calories-input" type="number" inputMode="numeric" min="0" step="10" value={todayLog.calories} onChange={(event) => onMetricChange("calories", event.target.value)} placeholder="1300" />
        </div>
        <div className="field">
          <label htmlFor="steps-input">Steps</label>
          <input id="steps-input" type="number" inputMode="numeric" min="0" step="100" value={todayLog.steps} onChange={(event) => onMetricChange("steps", event.target.value)} placeholder="6000" />
        </div>
        <div className="field">
          <label htmlFor="weight-input">Weight</label>
          <input id="weight-input" type="number" inputMode="decimal" min="0" step="0.1" value={todayLog.weight} onChange={(event) => onMetricChange("weight", event.target.value)} placeholder="lbs" />
        </div>
        <div className="field">
          <label htmlFor="sleep-input">Sleep</label>
          <input id="sleep-input" type="number" inputMode="decimal" min="0" step="0.1" value={todayLog.sleep} onChange={(event) => onMetricChange("sleep", event.target.value)} placeholder="hours" />
        </div>
      </div>

      <div className="field mood-field">
        <label>Mood</label>
        <div className="mood-row" role="radiogroup" aria-label="Mood">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`mood-button ${Number(todayLog.mood) === option.value ? "active" : ""}`}
              onClick={() => onMetricChange("mood", String(option.value))}
              aria-pressed={Number(todayLog.mood) === option.value}
            >
              <span className="mood-emoji" aria-hidden="true">{option.emoji}</span>
              <span className="mood-label">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="input-help">Tap the feeling that best fits today.</p>
      </div>
    </section>
  );
}

function getHabitStatus(habit, todayLog) {
  const logged = toNumber(todayLog.habits[habit.id]?.logged);
  if (logged === null || logged <= 0) return "not-started";
  if (logged >= habit.target) return "completed";
  return "in-progress";
}

function HabitChecklist({ todayLog, dailyLogs, todayKey, onHabitLogChange }) {
  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Habits</p>
          <h2 className="section-title">Progress counts, even before the full target is hit.</h2>
        </div>
      </div>

      <div className="habit-list">
        {HABITS.map((habit) => {
          const status = getHabitStatus(habit, todayLog);
          const streak = getHabitStreak(dailyLogs, todayKey, habit.id);
          const loggedValue = todayLog.habits[habit.id]?.logged ?? "";
          const statusLabel =
            status === "completed"
              ? "Completed"
              : status === "in-progress"
                ? "In progress"
                : "Not started";

          return (
            <article key={habit.id} className={`habit-item ${status}`}>
              <span className={`habit-status habit-status-${status}`} aria-hidden="true" />
              <span className="habit-copy">
                <span className="habit-name">{habit.label}</span>
                <span className="habit-detail">Target: {habit.target} {habit.unit}</span>
                <span className="habit-progress-copy">
                  Logged: {loggedValue === "" ? "0" : loggedValue} {habit.unit} of {habit.target} {habit.unit}
                </span>
              </span>
              <div className="habit-controls">
                <label className="habit-input-wrap">
                  <span className="habit-input-label">{statusLabel}</span>
                  <input
                    className="habit-input"
                    type="number"
                    min="0"
                    step="5"
                    inputMode="numeric"
                    value={loggedValue}
                    onChange={(event) => onHabitLogChange(habit.id, event.target.value)}
                    aria-label={`${habit.label} logged minutes`}
                  />
                </label>
                <span className="streak-pill">{streak} day streak</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WeeklyTracker({ workoutsCompleted, summary, onAdjust, completionStats }) {
  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Weekly Tracking</p>
          <h2 className="section-title">Strength and consistency across the week.</h2>
        </div>
      </div>

      <div className="weekly-meter">
        <div className="week-controls">
          <div>
            <p className="mini-label">Weightlifting workouts</p>
            <p className="weekly-count">{workoutsCompleted} / {WEEKLY_WORKOUT_TARGET}</p>
          </div>
          <div className="stepper-group">
            <button type="button" className="stepper" onClick={() => onAdjust(-1)} disabled={workoutsCompleted <= 0}>−</button>
            <button type="button" className="stepper" onClick={() => onAdjust(1)}>+</button>
          </div>
        </div>

        <div className="completion-strip">
          <span className={`completion-pill ${completionStats.workoutsComplete ? "complete" : ""}`}>
            {completionStats.workoutsComplete ? "Weekly workout goal hit" : "Goal in progress"}
          </span>
          <span className="completion-pill">Weekly reset every Monday</span>
        </div>
      </div>

      <div className="summary-grid three-up">
        <article className="mini-card">
          <p className="mini-label">Avg. Sleep</p>
          <p className="mini-value">{formatAverage(summary.averageSleep, 1, " hrs")}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Avg. Mood</p>
          <p className="mini-value">{formatMoodValue(summary.averageMood)}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Avg. Calories</p>
          <p className="mini-value">{formatAverage(summary.averageCalories, 0, " kcal")}</p>
        </article>
      </div>
    </section>
  );
}

function NorthStar() {
  return (
    <section className="card north-star-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">North Star</p>
          <h2 className="section-title">Small reminders of what you are building toward.</h2>
          <p className="section-description">Gentle direction, kept visible.</p>
        </div>
      </div>

      <div className="north-star-list">
        {NORTH_STAR_GOALS.map((goal) => (
          <div key={goal} className="north-star-item">
            <span className="north-star-icon" aria-hidden="true">🎯</span>
            <span className="north-star-text">{goal}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendChart({ title, subtitle, labels, values, color, suggestedMax }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const hasData = values.some((value) => value !== null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart || !hasData) return undefined;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: `${color}22`,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 4,
            pointBackgroundColor: color,
            spanGaps: true,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#8c6d76", font: { size: 11 } },
          },
          y: {
            beginAtZero: false,
            suggestedMax,
            grid: { color: "rgba(156, 111, 129, 0.12)" },
            ticks: { color: "#8c6d76", font: { size: 11 } },
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
  }, [labels, values, color, hasData, suggestedMax]);

  return (
    <article className="chart-card float-card">
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          <p className="progress-meta">{subtitle}</p>
        </div>
      </div>

      {!window.Chart ? (
        <p className="trend-empty">Charts are unavailable right now, but your tracking data is still saved.</p>
      ) : hasData ? (
        <div className="chart-wrap">
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <p className="trend-empty">Add a few days of entries to unlock this trend line.</p>
      )}
    </article>
  );
}

function App() {
  const [trackerState, setTrackerState] = useState(loadTrackerState);
  const [todayKey, setTodayKey] = useState(getLocalDateKey());

  useEffect(() => {
    saveTrackerState(trackerState);
  }, [trackerState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextTodayKey = getLocalDateKey();
      setTodayKey((currentKey) => (currentKey === nextTodayKey ? currentKey : nextTodayKey));
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const weekKey = getWeekStartKey();
  const todayLog = normalizeDayLog(trackerState.dailyLogs[todayKey]);
  const currentWeekLog = normalizeWeekLog(trackerState.weeklyLogs[weekKey]);
  const completionStats = getCompletionStats(todayLog, currentWeekLog.workoutsCompleted);
  const weeklySummary = getWeeklySummary(trackerState.dailyLogs, weekKey);
  const encouragement = getEncouragementMessage(completionStats);
  const weightSeries = getTrendSeries(trackerState.dailyLogs, "weight");
  const sleepSeries = getTrendSeries(trackerState.dailyLogs, "sleep");
  const moodSeries = getTrendSeries(trackerState.dailyLogs, "mood");

  function updateDailyField(field, value) {
    setTrackerState((currentState) => {
      const nextDayLog = normalizeDayLog(currentState.dailyLogs[todayKey]);
      nextDayLog[field] = value;

      return {
        ...currentState,
        dailyLogs: {
          ...currentState.dailyLogs,
          [todayKey]: nextDayLog,
        },
      };
    });
  }

  function updateHabitLog(habitId, value) {
    setTrackerState((currentState) => {
      const nextDayLog = normalizeDayLog(currentState.dailyLogs[todayKey]);
      nextDayLog.habits[habitId] = {
        ...nextDayLog.habits[habitId],
        logged: value,
      };

      return {
        ...currentState,
        dailyLogs: {
          ...currentState.dailyLogs,
          [todayKey]: nextDayLog,
        },
      };
    });
  }

  function adjustWorkoutCount(delta) {
    setTrackerState((currentState) => {
      const nextWeekLog = normalizeWeekLog(currentState.weeklyLogs[weekKey]);
      nextWeekLog.workoutsCompleted = Math.max(0, nextWeekLog.workoutsCompleted + delta);

      return {
        ...currentState,
        weeklyLogs: {
          ...currentState.weeklyLogs,
          [weekKey]: nextWeekLog,
        },
      };
    });
  }

  return (
    <main className="tracker-app">
      <div className="shell">
        <section className="card hero-card">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="hero-top">
            <div className="eyebrow">{formatLongDate(getDateFromKey(todayKey))}</div>
            <div className="hero-actions">
              <a className="hero-link" href="#daily-tracker">Log today</a>
            </div>
          </div>

          <div className="hero-copy">
            <h1>Planner</h1>
            <p>Track the basics, keep your habits visible, and hold space for the bigger goals that make the day feel meaningful.</p>
          </div>

          <div className="hero-stats">
            <article className="hero-stat">
              <p className="hero-stat-label">Goals hit today</p>
              <p className="hero-stat-value">
                {[completionStats.caloriesGoalHit, completionStats.stepsGoalHit, completionStats.habitsComplete, completionStats.workoutsComplete].filter(Boolean).length} / 4
              </p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">Habits progressed today</p>
              <p className="hero-stat-value">{completionStats.habitsProgressed} / {HABITS.length}</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">North star goals</p>
              <p className="hero-stat-value">{NORTH_STAR_GOALS.length}</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">Avg. mood</p>
              <p className="hero-stat-value">{formatMoodValue(weeklySummary.averageMood)}</p>
            </article>
          </div>
        </section>

        <section className="feedback-card">
          <div className="nova-wrap">
            <div className="nova-avatar" aria-hidden="true">
              <div className="nova-halo" />
              <div className="nova-figure">
                <div className="nova-hair" />
                <div className="nova-face">
                  <span className="nova-eye nova-eye-left" />
                  <span className="nova-eye nova-eye-right" />
                  <span className="nova-mouth" />
                </div>
                <div className="nova-neck" />
                <div className="nova-body">
                  <div className="nova-bra" />
                  <div className="nova-pants" />
                </div>
              </div>
            </div>

            <div className="nova-bubble">
              <p className="feedback-title">From Nova</p>
              <p className="feedback-copy">{encouragement}</p>
            </div>
          </div>
        </section>

        <NorthStar />

        <div className="layout-grid">
          <div className="stack">
            <div id="daily-tracker">
              <DailyTracker todayLog={todayLog} onMetricChange={updateDailyField} />
            </div>
            <HabitChecklist
              todayLog={todayLog}
              dailyLogs={trackerState.dailyLogs}
              todayKey={todayKey}
              onHabitLogChange={updateHabitLog}
            />
          </div>

          <div className="stack">
            <WeeklyTracker
              workoutsCompleted={currentWeekLog.workoutsCompleted}
              summary={weeklySummary}
              onAdjust={adjustWorkoutCount}
              completionStats={completionStats}
            />

            <section className="card section-card float-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Completion</p>
                  <h2 className="section-title">Quick read on today’s goals.</h2>
                </div>
              </div>

              <div className="completion-strip">
                <span className={`completion-pill ${completionStats.caloriesGoalHit ? "complete" : ""}`}>
                  Calories {completionStats.caloriesGoalHit ? "on target" : "in progress"}
                </span>
                <span className={`completion-pill ${completionStats.stepsGoalHit ? "complete" : ""}`}>
                  Steps {completionStats.stepsGoalHit ? "complete" : "in progress"}
                </span>
                <span className={`completion-pill ${completionStats.habitsComplete ? "complete" : ""}`}>
                  Habits {completionStats.habitsComplete ? "goal hit" : `${completionStats.habitsProgressed} progressed`}
                </span>
              </div>

              <div className="summary-grid three-up">
                <article className="mini-card">
                  <p className="mini-label">Weight today</p>
                  <p className="mini-value">{toNumber(todayLog.weight) === null ? "--" : `${Number(todayLog.weight).toFixed(1)}`}</p>
                </article>
                <article className="mini-card">
                  <p className="mini-label">Sleep today</p>
                  <p className="mini-value">{toNumber(todayLog.sleep) === null ? "--" : `${Number(todayLog.sleep).toFixed(1)}h`}</p>
                </article>
                <article className="mini-card">
                  <p className="mini-label">Mood today</p>
                  <p className="mini-value">{toNumber(todayLog.mood) === null ? "--" : `${todayLog.mood}/5`}</p>
                </article>
              </div>
            </section>
          </div>
        </div>

        <section className="card section-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Trends</p>
              <h2 className="section-title">Recent signals for weight, sleep, and mood.</h2>
            </div>
          </div>

          <div className="chart-list">
            <TrendChart title="Weight" subtitle="Last 10 days" labels={weightSeries.labels} values={weightSeries.values} color="#e48dac" />
            <TrendChart title="Sleep" subtitle="Last 10 days" labels={sleepSeries.labels} values={sleepSeries.values} color="#c98db2" suggestedMax={10} />
            <TrendChart title="Mood" subtitle="Last 10 days" labels={moodSeries.labels} values={moodSeries.values} color="#d975a0" suggestedMax={5} />
          </div>

          <p className="footer-note">
            Entries are stored only in your browser with localStorage. A new date automatically starts a fresh daily log while preserving your history.
          </p>
        </section>
      </div>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
