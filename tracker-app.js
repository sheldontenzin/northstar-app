const { useEffect, useRef, useState } = React;

const STORAGE_KEY = "planner-tracker-v2";
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

const STUCK_STATES = [
  "In bed",
  "Doomscrolling",
  "Overwhelmed",
  "Avoiding work",
  "Don't know what to do",
  "Tired but guilty",
  "Panicking about the future",
];

const MEDITATION_TYPES = [
  "breath",
  "mindfulness",
  "mantra",
  "body scan",
  "walking",
  "unguided",
  "guided",
  "other",
];

const STARTUP_CATEGORIES = [
  "Customer discovery",
  "Building",
  "Shipping",
  "Sales",
  "Learning",
  "Distribution",
  "Recruiting",
  "Programs/applications",
];

const SAVE_DAY_ACTIONS = [
  { id: "cleanup", label: "5-minute cleanup", timer: 5 },
  { id: "startup", label: "5-minute startup task", timer: 5 },
  { id: "tomorrow", label: "Write tomorrow's first task" },
  { id: "accountability", label: "Send accountability text" },
  { id: "meditate", label: "Meditate for 3 minutes", timer: 3 },
  { id: "weight", label: "Log weight" },
  { id: "session", label: "Join/start a work session", timer: 25 },
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

function formatFullDate(dateKey) {
  return getDateFromKey(dateKey).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

function createEmptyMomentumEntry(dateKey = getLocalDateKey()) {
  return {
    id: `momentum-${dateKey}`,
    date: dateKey,
    gotOutOfBed: false,
    phoneAway: false,
    completedFocusBlock: false,
    plannedTomorrow: false,
    sentAccountability: false,
    meditated: false,
    loggedWeight: false,
    firstBlockBeforeEntertainment: false,
    firstBlockMinutes: 5,
    firstBlockTask: "",
    entertainmentUnlocked: false,
    saveDayComplete: false,
    saveDayLastAction: "",
  };
}

function createEmptyWeightForm(dateKey = getLocalDateKey()) {
  return {
    id: "",
    date: dateKey,
    weight: "",
    unit: "lb",
    notes: "",
  };
}

function createEmptyMeditationForm(dateKey = getLocalDateKey()) {
  return {
    id: "",
    date: dateKey,
    durationMinutes: "",
    type: "breath",
    moodBefore: "",
    moodAfter: "",
    notes: "",
    insight: "",
  };
}

function createEmptyStartupForm(dateKey = getLocalDateKey()) {
  return {
    id: "",
    date: dateKey,
    category: STARTUP_CATEGORIES[0],
    actionCompleted: "",
    evidence: "",
    nextAction: "",
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

function normalizeMomentumEntry(entry, dateKey) {
  return {
    ...createEmptyMomentumEntry(dateKey),
    ...entry,
    id: entry?.id || `momentum-${dateKey}`,
    date: entry?.date || dateKey,
    firstBlockMinutes: Number(entry?.firstBlockMinutes) || 5,
    firstBlockTask: entry?.firstBlockTask ?? "",
    saveDayLastAction: entry?.saveDayLastAction ?? "",
  };
}

function normalizeWeightEntry(entry) {
  return {
    id: entry?.id || makeId("weight"),
    date: entry?.date || getLocalDateKey(),
    weight: entry?.weight ?? "",
    unit: entry?.unit === "kg" ? "kg" : "lb",
    notes: entry?.notes ?? "",
    createdAt: entry?.createdAt || Date.now(),
    updatedAt: entry?.updatedAt || Date.now(),
  };
}

function normalizeMeditationEntry(entry) {
  return {
    id: entry?.id || makeId("meditation"),
    date: entry?.date || getLocalDateKey(),
    durationMinutes: entry?.durationMinutes ?? "",
    type: MEDITATION_TYPES.includes(entry?.type) ? entry.type : "breath",
    moodBefore: entry?.moodBefore ?? "",
    moodAfter: entry?.moodAfter ?? "",
    notes: entry?.notes ?? "",
    insight: entry?.insight ?? "",
    createdAt: entry?.createdAt || Date.now(),
    updatedAt: entry?.updatedAt || Date.now(),
  };
}

function normalizeStartupEntry(entry) {
  return {
    id: entry?.id || makeId("startup"),
    date: entry?.date || getLocalDateKey(),
    category: STARTUP_CATEGORIES.includes(entry?.category) ? entry.category : STARTUP_CATEGORIES[0],
    actionCompleted: entry?.actionCompleted ?? "",
    evidence: entry?.evidence ?? "",
    nextAction: entry?.nextAction ?? "",
    createdAt: entry?.createdAt || Date.now(),
    updatedAt: entry?.updatedAt || Date.now(),
  };
}

function loadTrackerState() {
  const fallback = {
    dailyLogs: {},
    weeklyLogs: {},
    momentumEntries: {},
    weightEntries: [],
    meditationEntries: [],
    startupEntries: [],
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem("planner-tracker-v1");
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const dailyLogs = {};
    const weeklyLogs = {};
    const momentumEntries = {};

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

    if (parsed && typeof parsed.momentumEntries === "object") {
      Object.entries(parsed.momentumEntries).forEach(([dateKey, entry]) => {
        momentumEntries[dateKey] = normalizeMomentumEntry(entry, dateKey);
      });
    }

    return {
      dailyLogs,
      weeklyLogs,
      momentumEntries,
      weightEntries: Array.isArray(parsed?.weightEntries) ? parsed.weightEntries.map(normalizeWeightEntry) : [],
      meditationEntries: Array.isArray(parsed?.meditationEntries) ? parsed.meditationEntries.map(normalizeMeditationEntry) : [],
      startupEntries: Array.isArray(parsed?.startupEntries) ? parsed.startupEntries.map(normalizeStartupEntry) : [],
    };
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

function formatMoodValue(value) {
  if (value === null) {
    return "No data";
  }

  return `${value.toFixed(1)} / 5`;
}

function formatDelta(value, unit) {
  if (value === null) {
    return "—";
  }

  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(1)} ${unit}`;
}

function formatTimer(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
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

function calculateSelfTrustScore(entry) {
  const total = 7;
  const kept = [
    entry.gotOutOfBed,
    entry.phoneAway,
    entry.completedFocusBlock,
    entry.plannedTomorrow,
    entry.sentAccountability,
    entry.meditated,
    entry.loggedWeight,
  ].filter(Boolean).length;

  return {
    kept,
    total,
    label: `You kept ${kept}/${total} promises today.`,
  };
}

function getSelfTrustMessage(score, previousScore) {
  if (previousScore.kept === 0 && score.kept < 4) {
    return "Recovery day: do 5 minutes. Never miss twice.";
  }

  if (score.kept === 0) {
    return "Start with one promise today.";
  }

  if (score.kept >= 5) {
    return "This is self-trust built in small, visible ways.";
  }

  return "Keep the next promise small enough to keep.";
}

function getEncouragementMessage(stats, selfTrustScore, meditationStats) {
  const completedCount = [
    stats.caloriesGoalHit,
    stats.stepsGoalHit,
    stats.habitsComplete,
    stats.workoutsComplete,
  ].filter(Boolean).length;

  if (selfTrustScore.kept >= 5) {
    return "You do not need a dramatic day to trust yourself. Quiet follow-through is enough.";
  }

  if (meditationStats.currentStreak >= 3) {
    return "Your meditation streak is becoming a place to return to, not another thing to prove.";
  }

  if (completedCount >= 3) {
    return "Momentum is already here. Protect the next small block and let the day stay simple.";
  }

  if (stats.habitsProgressed > 0) {
    return "Progress still counts. Starting imperfectly is still starting.";
  }

  return "You do not need to rescue the whole week. Just begin the next honest step.";
}

function getRescueProtocol(stateLabel) {
  const protocols = {
    "In bed": {
      intro: "Make the transition tiny and physical first.",
      steps: [
        "Sit up",
        "Put both feet on the floor",
        "Move to any chair, table, or desk",
        "Open one task",
        "Start a 5-minute timer",
      ],
      timer: 5,
    },
    Doomscrolling: {
      intro: "Reduce stimulation before asking for focus.",
      steps: [
        "Put phone across the room",
        "Close entertainment tabs",
        "Pick one tiny task",
        "Start a 10-minute timer",
      ],
      timer: 10,
    },
    Overwhelmed: {
      intro: "Shrink the horizon until it fits in your hands.",
      steps: [
        "Open a blank note",
        "Write the one thing that matters most next",
        "Ignore the rest for 10 minutes",
        "Start a 10-minute timer",
      ],
      timer: 10,
    },
    "Avoiding work": {
      intro: "Remove the negotiation and touch the work once.",
      steps: [
        "Open the work file or tab",
        "Write one ugly sentence or bullet",
        "Set a 5-minute timer",
        "Stay only until the timer ends",
      ],
      timer: 5,
    },
    "Don't know what to do": {
      intro: "Clarity comes after contact, not before.",
      steps: [
        "Pick the project that matters most",
        "Write the next visible action",
        "If it still feels big, make it smaller once",
        "Start a 5-minute timer",
      ],
      timer: 5,
    },
    "Tired but guilty": {
      intro: "Aim for a light-touch win that keeps the chain alive.",
      steps: [
        "Choose one 5-minute task",
        "Do it sitting down with zero extra pressure",
        "Stop when the timer ends",
        "Plan tomorrow's first task before you leave",
      ],
      timer: 5,
    },
    "Panicking about the future": {
      intro: "Come back to evidence, not spirals.",
      steps: [
        "Take one slow breath in and out",
        "Name one thing in your control today",
        "Do one action that creates proof",
        "Start a 10-minute timer",
      ],
      timer: 10,
    },
  };

  return protocols[stateLabel] || protocols.Overwhelmed;
}

function generateTinyMove(task, makeSmaller = false) {
  const cleanedTask = (task || "").trim();
  const lower = cleanedTask.toLowerCase();

  if (!cleanedTask) {
    return [];
  }

  if (makeSmaller) {
    if (lower.includes("message 5") || lower.includes("message five")) {
      return ["Find 1 person to message"];
    }
    if (lower.includes("message")) {
      return ["Open LinkedIn"];
    }
    if (lower.includes("apply")) {
      return ["Open the application tab"];
    }
    if (lower.includes("research")) {
      return ["Search one specific question"];
    }
    if (lower.includes("landing page") || lower.includes("build") || lower.includes("project")) {
      return ["Open the project"];
    }
    if (lower.includes("write")) {
      return ["Write one ugly sentence"];
    }
    if (lower.includes("study")) {
      return ["Open your notes"];
    }
    if (lower.includes("open")) {
      return ["Open laptop"];
    }
    return ["Open laptop"];
  }

  if (lower.includes("startup") || lower.includes("business") || lower.includes("users")) {
    return [
      "Open the project",
      "Write 3 bullet points",
      "Message 1 person",
      "Draft the first ugly version",
      "Spend 5 minutes researching",
      "Write tomorrow's first task",
    ];
  }

  if (lower.includes("exam") || lower.includes("study") || lower.includes("class")) {
    return [
      "Open your notes",
      "Pick one topic",
      "Review for 5 minutes",
      "Write 3 recall questions",
      "Plan tomorrow's first study block",
    ];
  }

  if (lower.includes("job") || lower.includes("application") || lower.includes("career")) {
    return [
      "Open your resume",
      "Find 1 role to review",
      "Write 3 bullets that fit the role",
      "Draft the first ugly version",
      "Message 1 person",
    ];
  }

  return [
    "Open the project",
    "Write 3 bullet points",
    "Draft the first ugly version",
    "Spend 5 minutes researching",
    "Write tomorrow's first task",
  ];
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
    const total = dateDelta || createdDelta;
    return direction === "asc" ? total : -total;
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
  const earlier = sorted
    .slice(-5, -1)
    .map((entry) => convertWeight(toNumber(entry.weight), entry.unit, latest.unit))
    .filter((value) => value !== null);

  if (latestValue === null || earlier.length === 0) {
    return "Stable";
  }

  const delta = latestValue - average(earlier);
  if (delta >= 0.6) {
    return "Trending up";
  }
  if (delta <= -0.6) {
    return "Trending down";
  }
  return "Stable";
}

function getWeightChartSeries(entries) {
  const sorted = getSortedWeightEntries(entries, "asc").slice(-10);
  const latestUnit = sorted[sorted.length - 1]?.unit || "lb";

  return {
    labels: sorted.map((entry) => formatShortDate(entry.date)),
    values: sorted.map((entry) => convertWeight(toNumber(entry.weight), entry.unit, latestUnit)),
    unit: latestUnit,
  };
}

function calculateMeditationStats(entries) {
  const totalSessions = entries.length;
  const totalMinutes = entries.reduce((total, entry) => total + (toNumber(entry.durationMinutes) || 0), 0);
  const moodChanges = entries
    .map((entry) => {
      const before = toNumber(entry.moodBefore);
      const after = toNumber(entry.moodAfter);
      return before !== null && after !== null ? after - before : null;
    })
    .filter((value) => value !== null);

  const dates = [...new Set(entries.map((entry) => entry.date))].sort();
  let longestStreak = 0;
  let currentStreak = 0;
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

  const typeCounts = entries.reduce((accumulator, entry) => {
    accumulator[entry.type] = (accumulator[entry.type] || 0) + 1;
    return accumulator;
  }, {});

  const mostCommonType = Object.entries(typeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || "—";

  return {
    totalSessions,
    totalMinutes,
    currentStreak,
    longestStreak,
    averageMoodChange: average(moodChanges),
    mostCommonType,
  };
}

function getMeditationChartSeries(entries) {
  const sorted = [...entries]
    .sort((left, right) => new Date(left.date) - new Date(right.date))
    .slice(-10);

  return {
    labels: sorted.map((entry) => formatShortDate(entry.date)),
    values: sorted.map((entry) => toNumber(entry.durationMinutes)),
  };
}

function getLatestWeightEntry(entries) {
  return getSortedWeightEntries(entries, "desc")[0] || null;
}

function getLatestStartupNextAction(entries) {
  const sorted = [...entries].sort((left, right) => {
    const dateDelta = new Date(right.date) - new Date(left.date);
    return dateDelta || (right.createdAt || 0) - (left.createdAt || 0);
  });

  return sorted.find((entry) => entry.nextAction.trim()) || null;
}

function getMomentumEntry(state, dateKey) {
  return normalizeMomentumEntry(state.momentumEntries[dateKey], dateKey);
}

function TimerChip({ activeTimer }) {
  if (!activeTimer) {
    return null;
  }

  return (
    <div className="timer-chip-live" role="status" aria-live="polite">
      <span className="timer-dot" aria-hidden="true" />
      <span>{activeTimer.label}</span>
      <strong>{formatTimer(activeTimer.secondsLeft)}</strong>
    </div>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="section-kicker">Momentum System</p>
            <h2 className="section-title">{title}</h2>
            {subtitle ? <p className="section-description">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RescueFlowModal({ selectedState, checkedSteps, onClose, onSelectState, onToggleStep, onStartTimer, activeTimer }) {
  const protocol = selectedState ? getRescueProtocol(selectedState) : null;

  return (
    <ModalShell
      title="I'm Stuck"
      subtitle="The goal is not to feel amazing first. The goal is to get you from stuck to started."
      onClose={onClose}
    >
      <div className="option-grid">
        {STUCK_STATES.map((stateLabel) => (
          <button
            key={stateLabel}
            type="button"
            className={`option-chip ${selectedState === stateLabel ? "active" : ""}`}
            onClick={() => onSelectState(stateLabel)}
          >
            {stateLabel}
          </button>
        ))}
      </div>

      {protocol ? (
        <div className="rescue-panel">
          <p className="status-copy">{protocol.intro}</p>
          <div className="check-list">
            {protocol.steps.map((step, index) => (
              <label key={step} className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(checkedSteps[index])}
                  onChange={() => onToggleStep(index)}
                />
                <span>{step}</span>
              </label>
            ))}
          </div>
          <div className="timer-row">
            {[5, 10, 25].map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="soft-button"
                onClick={() => onStartTimer(minutes, `${minutes}-minute reset`)}
              >
                Start {minutes}-minute timer
              </button>
            ))}
          </div>
          <TimerChip activeTimer={activeTimer} />
        </div>
      ) : (
        <p className="empty-state">Pick the state that feels closest. The rescue protocol will meet you there.</p>
      )}
    </ModalShell>
  );
}

function SaveDayModal({ onClose, onChooseAction }) {
  return (
    <ModalShell
      title="Save the Day"
      subtitle="You do not need a perfect comeback. Pick one action that keeps the chain alive."
      onClose={onClose}
    >
      <div className="option-grid save-grid">
        {SAVE_DAY_ACTIONS.map((action) => (
          <button key={action.id} type="button" className="save-action" onClick={() => onChooseAction(action)}>
            {action.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
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
          <input id="weight-input" type="number" inputMode="decimal" min="0" step="0.1" value={todayLog.weight} onChange={(event) => onMetricChange("weight", event.target.value)} placeholder="neutral daily note" />
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

function FirstBlockCard({ momentumEntry, onChange, onStartTimer }) {
  const complete = momentumEntry.firstBlockBeforeEntertainment;

  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">First Block Before Entertainment</p>
          <h2 className="section-title">Start with one focused block before the day drifts.</h2>
        </div>
      </div>

      <div className="binary-row">
        <button type="button" className={`binary-pill ${complete ? "active" : ""}`} onClick={() => onChange("firstBlockBeforeEntertainment", true)}>
          Yes
        </button>
        <button type="button" className={`binary-pill ${!complete ? "active" : ""}`} onClick={() => onChange("firstBlockBeforeEntertainment", false)}>
          No
        </button>
      </div>

      <div className="choice-grid">
        {[5, 10, 25, 50].map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={`choice-pill ${momentumEntry.firstBlockMinutes === minutes ? "active" : ""}`}
            onClick={() => onChange("firstBlockMinutes", minutes)}
          >
            {minutes} min
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="first-block-task">What did I work on?</label>
        <input
          id="first-block-task"
          type="text"
          value={momentumEntry.firstBlockTask}
          onChange={(event) => onChange("firstBlockTask", event.target.value)}
          placeholder="One real task, written simply"
        />
      </div>

      <div className="binary-row binary-row-compact">
        <button type="button" className={`binary-pill ${momentumEntry.entertainmentUnlocked ? "active" : ""}`} onClick={() => onChange("entertainmentUnlocked", true)}>
          Entertainment unlocked
        </button>
        <button type="button" className={`binary-pill ${!momentumEntry.entertainmentUnlocked ? "active" : ""}`} onClick={() => onChange("entertainmentUnlocked", false)}>
          Not yet
        </button>
      </div>

      <div className="timer-row">
        {[5, 10, 25].map((minutes) => (
          <button key={minutes} type="button" className="soft-button" onClick={() => onStartTimer(minutes, `${minutes}-minute first block`)}>
            Start {minutes}-minute timer
          </button>
        ))}
      </div>

      <p className={`status-copy ${complete ? "success" : ""}`}>
        {complete
          ? "Entertainment unlocked. You kept a promise to yourself."
          : "Start with 5 minutes. You do not need to save the whole day."}
      </p>
    </section>
  );
}

function SelfTrustCard({ momentumEntry, score, message, onToggle }) {
  const items = [
    { key: "gotOutOfBed", label: "Got out of bed" },
    { key: "phoneAway", label: "Phone away during first block" },
    { key: "completedFocusBlock", label: "Completed one focused block" },
    { key: "plannedTomorrow", label: "Planned tomorrow's first task" },
    { key: "sentAccountability", label: "Sent accountability update" },
    { key: "meditated", label: "Meditated" },
    { key: "loggedWeight", label: "Logged weight" },
  ];

  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Daily Self-Trust</p>
          <h2 className="section-title">{score.label}</h2>
          <p className="section-description">{message}</p>
        </div>
      </div>

      <div className="check-list trust-list">
        {items.map((item) => (
          <label key={item.key} className="check-row">
            <input type="checkbox" checked={momentumEntry[item.key]} onChange={() => onToggle(item.key)} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function TinyMoveCard({ task, suggestions, selectedSuggestion, onTaskChange, onGenerate, onSelectSuggestion, onMakeSmaller }) {
  return (
    <section className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Next Tiny Move</p>
          <h2 className="section-title">Turn a heavy task into the smallest useful action.</h2>
        </div>
      </div>

      <div className="field">
        <label htmlFor="tiny-move-input">Big task or goal</label>
        <input
          id="tiny-move-input"
          type="text"
          value={task}
          onChange={(event) => onTaskChange(event.target.value)}
          placeholder="Example: build my startup, study for exam, apply to jobs"
        />
      </div>

      <div className="button-row">
        <button type="button" className="hero-link" onClick={onGenerate}>
          Generate tiny moves
        </button>
        <button type="button" className="soft-button" onClick={onMakeSmaller} disabled={!selectedSuggestion && suggestions.length === 0}>
          Make it smaller
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div className="suggestion-list">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={`suggestion-chip ${selectedSuggestion === suggestion ? "active" : ""}`}
              onClick={() => onSelectSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-state">Give the task a name, then let the app shrink it into something startable.</p>
      )}

      {selectedSuggestion ? (
        <p className="status-copy">Smallest useful action right now: <strong>{selectedSuggestion}</strong></p>
      ) : null}
    </section>
  );
}

function WeightTracker({
  form,
  entries,
  trend,
  latestWeight,
  chartSeries,
  formError,
  onFormChange,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
}) {
  const sortedEntries = getSortedWeightEntries(entries, "desc");

  return (
    <section id="weight-tracker" className="card section-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Weight Tracking</p>
          <h2 className="section-title">Neutral data, held lightly.</h2>
          <p className="section-description">
            {latestWeight ? `${latestWeight.weight} ${latestWeight.unit} · ${trend}` : "No weight entries yet. Add one neutral data point."}
          </p>
        </div>
      </div>

      <div className="form-grid form-grid-weight">
        <div className="field">
          <label htmlFor="weight-date">Date</label>
          <input id="weight-date" type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="weight-value">Weight</label>
          <input id="weight-value" type="number" min="0" step="0.1" value={form.weight} onChange={(event) => onFormChange("weight", event.target.value)} placeholder="145.2" />
        </div>
        <div className="field">
          <label htmlFor="weight-unit">Unit</label>
          <select id="weight-unit" value={form.unit} onChange={(event) => onFormChange("unit", event.target.value)}>
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="weight-notes">Notes</label>
          <input id="weight-notes" type="text" value={form.notes} onChange={(event) => onFormChange("notes", event.target.value)} placeholder="high sodium, post-workout, poor sleep" />
        </div>
      </div>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="button-row">
        <button type="button" className="hero-link" onClick={onSave}>
          {form.id ? "Save weight edit" : "Add weight entry"}
        </button>
        {form.id ? (
          <button type="button" className="soft-button" onClick={onCancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </div>

      <div className="summary-grid three-up">
        <article className="mini-card">
          <p className="mini-label">Latest weight</p>
          <p className="mini-value">{latestWeight ? `${latestWeight.weight} ${latestWeight.unit}` : "--"}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Trend</p>
          <p className="mini-value">{trend}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Entries</p>
          <p className="mini-value">{entries.length}</p>
        </article>
      </div>

      {chartSeries.values.some((value) => value !== null) ? (
        <div className="chart-section">
          <TrendChart
            title="Weight trend"
            subtitle={`Recent entries (${chartSeries.unit})`}
            labels={chartSeries.labels}
            values={chartSeries.values}
            color="#d975a0"
          />
        </div>
      ) : null}

      {sortedEntries.length > 0 ? (
        <div className="table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Unit</th>
                <th>Change</th>
                <th>7-day avg</th>
                <th>Notes</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const change = calculateWeightChange(entries, entry.id);
                const averageValue = calculateSevenDayAverage(entries, entry.id);

                return (
                  <tr key={entry.id}>
                    <td>{formatFullDate(entry.date)}</td>
                    <td>{entry.weight || "—"}</td>
                    <td>{entry.unit}</td>
                    <td>{formatDelta(change, entry.unit)}</td>
                    <td>{averageValue === null ? "—" : `${averageValue.toFixed(1)} ${entry.unit}`}</td>
                    <td>{entry.notes || "—"}</td>
                    <td className="table-actions">
                      <button type="button" className="table-button" onClick={() => onEdit(entry)}>Edit</button>
                      <button type="button" className="table-button table-button-danger" onClick={() => onDelete(entry.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">No weight entries yet. Add one neutral data point.</p>
      )}
    </section>
  );
}

function MeditationJourney({
  form,
  entries,
  stats,
  chartSeries,
  formError,
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
    <section id="meditation-journey" className="card section-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Meditation Journey</p>
          <h2 className="section-title">Meditation is not about having no thoughts. It is about noticing and returning.</h2>
        </div>
      </div>

      <div className="summary-grid stats-grid">
        <article className="mini-card">
          <p className="mini-label">Total sessions</p>
          <p className="mini-value">{stats.totalSessions}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Total minutes</p>
          <p className="mini-value">{stats.totalMinutes}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Current streak</p>
          <p className="mini-value">{stats.currentStreak}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Longest streak</p>
          <p className="mini-value">{stats.longestStreak}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Avg. mood change</p>
          <p className="mini-value">{stats.averageMoodChange === null ? "—" : `${stats.averageMoodChange.toFixed(1)}`}</p>
        </article>
        <article className="mini-card">
          <p className="mini-label">Most common type</p>
          <p className="mini-value">{stats.mostCommonType}</p>
        </article>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="meditation-date">Date</label>
          <input id="meditation-date" type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="meditation-duration">Duration in minutes</label>
          <input id="meditation-duration" type="number" min="1" step="1" value={form.durationMinutes} onChange={(event) => onFormChange("durationMinutes", event.target.value)} placeholder="10" />
        </div>
        <div className="field">
          <label htmlFor="meditation-type">Type</label>
          <select id="meditation-type" value={form.type} onChange={(event) => onFormChange("type", event.target.value)}>
            {MEDITATION_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mood-before">Mood before</label>
          <input id="mood-before" type="number" min="1" max="10" step="1" value={form.moodBefore} onChange={(event) => onFormChange("moodBefore", event.target.value)} placeholder="1-10" />
        </div>
        <div className="field">
          <label htmlFor="mood-after">Mood after</label>
          <input id="mood-after" type="number" min="1" max="10" step="1" value={form.moodAfter} onChange={(event) => onFormChange("moodAfter", event.target.value)} placeholder="1-10" />
        </div>
        <div className="field field-wide">
          <label htmlFor="meditation-notes">Notes</label>
          <textarea id="meditation-notes" rows="3" value={form.notes} onChange={(event) => onFormChange("notes", event.target.value)} placeholder="What did I notice?" />
        </div>
        <div className="field field-wide">
          <label htmlFor="meditation-insight">Insight of the day</label>
          <input id="meditation-insight" type="text" value={form.insight} onChange={(event) => onFormChange("insight", event.target.value)} placeholder="What do I want to carry into the day?" />
        </div>
      </div>

      <div className="reflection-prompt">
        <p>Reflection prompt</p>
        <span>What did I notice? What pulled my attention? How did I return? What do I want to carry into the day?</span>
      </div>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="button-row">
        <button type="button" className="hero-link" onClick={onSave}>
          {form.id ? "Save session edit" : "Add meditation session"}
        </button>
        {form.id ? (
          <button type="button" className="soft-button" onClick={onCancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </div>

      {chartSeries.values.some((value) => value !== null) ? (
        <div className="chart-section">
          <TrendChart
            title="Meditation minutes"
            subtitle="Recent sessions"
            labels={chartSeries.labels}
            values={chartSeries.values}
            color="#c98db2"
          />
        </div>
      ) : null}

      {sortedEntries.length > 0 ? (
        <div className="entry-list">
          {sortedEntries.map((entry) => (
            <article key={entry.id} className="entry-card">
              <div className="entry-top">
                <div>
                  <h3>{formatFullDate(entry.date)} · {entry.durationMinutes || 0} min</h3>
                  <p className="progress-meta">{entry.type} · Mood {entry.moodBefore || "—"} → {entry.moodAfter || "—"}</p>
                </div>
                <div className="table-actions">
                  <button type="button" className="table-button" onClick={() => onEdit(entry)}>Edit</button>
                  <button type="button" className="table-button table-button-danger" onClick={() => onDelete(entry.id)}>Delete</button>
                </div>
              </div>
              <p>{entry.notes || "No notes added."}</p>
              {entry.insight ? <p className="entry-highlight">Insight: {entry.insight}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">No sessions yet. Start with 3 minutes.</p>
      )}
    </section>
  );
}

function StartupProgressBoard({
  form,
  entries,
  formError,
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
    <section id="startup-board" className="card section-card float-card">
      <div className="section-head">
        <div>
          <p className="section-kicker">Startup Progress Board</p>
          <h2 className="section-title">Log real proof, then name the next move.</h2>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="startup-date">Date</label>
          <input id="startup-date" type="date" value={form.date} onChange={(event) => onFormChange("date", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="startup-category">Category</label>
          <select id="startup-category" value={form.category} onChange={(event) => onFormChange("category", event.target.value)}>
            {STARTUP_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor="startup-action">Action completed</label>
          <input id="startup-action" type="text" value={form.actionCompleted} onChange={(event) => onFormChange("actionCompleted", event.target.value)} placeholder="Messaged 3 potential users" />
        </div>
        <div className="field field-wide">
          <label htmlFor="startup-evidence">Evidence / proof link or note</label>
          <input id="startup-evidence" type="text" value={form.evidence} onChange={(event) => onFormChange("evidence", event.target.value)} placeholder="Link, screenshot note, or simple proof" />
        </div>
        <div className="field field-wide">
          <label htmlFor="startup-next-action">Next action</label>
          <input id="startup-next-action" type="text" value={form.nextAction} onChange={(event) => onFormChange("nextAction", event.target.value)} placeholder="Ask 1 person to pay" />
        </div>
      </div>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="button-row">
        <button type="button" className="hero-link" onClick={onSave}>
          {form.id ? "Save progress edit" : "Log startup progress"}
        </button>
        {form.id ? (
          <button type="button" className="soft-button" onClick={onCancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </div>

      {sortedEntries.length > 0 ? (
        <div className="entry-list">
          {sortedEntries.map((entry) => (
            <article key={entry.id} className="entry-card">
              <div className="entry-top">
                <div>
                  <h3>{entry.category}</h3>
                  <p className="progress-meta">{formatFullDate(entry.date)}</p>
                </div>
                <div className="table-actions">
                  <button type="button" className="table-button" onClick={() => onEdit(entry)}>Edit</button>
                  <button type="button" className="table-button table-button-danger" onClick={() => onDelete(entry.id)}>Delete</button>
                </div>
              </div>
              <p><strong>Done:</strong> {entry.actionCompleted}</p>
              {entry.evidence ? <p><strong>Proof:</strong> {entry.evidence}</p> : null}
              {entry.nextAction ? <p className="entry-highlight"><strong>Next:</strong> {entry.nextAction}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">No progress entries yet. Log one real action, no matter how small.</p>
      )}
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
        <p className="trend-empty">Add a few entries to unlock this trend line.</p>
      )}
    </article>
  );
}

function App() {
  const [trackerState, setTrackerState] = useState(loadTrackerState);
  const [todayKey, setTodayKey] = useState(getLocalDateKey());
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [selectedStuckState, setSelectedStuckState] = useState("");
  const [checkedRescueSteps, setCheckedRescueSteps] = useState({});
  const [showSaveDayModal, setShowSaveDayModal] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [tinyMoveTask, setTinyMoveTask] = useState("");
  const [tinyMoveSuggestions, setTinyMoveSuggestions] = useState([]);
  const [selectedTinyMove, setSelectedTinyMove] = useState("");
  const [weightForm, setWeightForm] = useState(createEmptyWeightForm());
  const [weightFormError, setWeightFormError] = useState("");
  const [meditationForm, setMeditationForm] = useState(createEmptyMeditationForm());
  const [meditationFormError, setMeditationFormError] = useState("");
  const [startupForm, setStartupForm] = useState(createEmptyStartupForm());
  const [startupFormError, setStartupFormError] = useState("");

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

  useEffect(() => {
    if (!activeTimer) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveTimer((current) => {
        if (!current) {
          return current;
        }

        if (current.secondsLeft <= 1) {
          return null;
        }

        return {
          ...current,
          secondsLeft: current.secondsLeft - 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeTimer]);

  useEffect(() => {
    setWeightForm((current) => ({ ...current, date: todayKey || current.date }));
    setMeditationForm((current) => ({ ...current, date: todayKey || current.date }));
    setStartupForm((current) => ({ ...current, date: todayKey || current.date }));
  }, [todayKey]);

  const weekKey = getWeekStartKey();
  const todayLog = normalizeDayLog(trackerState.dailyLogs[todayKey]);
  const currentWeekLog = normalizeWeekLog(trackerState.weeklyLogs[weekKey]);
  const momentumEntry = getMomentumEntry(trackerState, todayKey);
  const previousMomentumEntry = getMomentumEntry(trackerState, getLocalDateKey(new Date(Date.now() - 86400000)));
  const completionStats = getCompletionStats(todayLog, currentWeekLog.workoutsCompleted);
  const weeklySummary = getWeeklySummary(trackerState.dailyLogs, weekKey);
  const selfTrustScore = calculateSelfTrustScore(momentumEntry);
  const previousScore = calculateSelfTrustScore(previousMomentumEntry);
  const selfTrustMessage = getSelfTrustMessage(selfTrustScore, previousScore);
  const meditationStats = calculateMeditationStats(trackerState.meditationEntries);
  const encouragement = getEncouragementMessage(completionStats, selfTrustScore, meditationStats);
  const latestWeight = getLatestWeightEntry(trackerState.weightEntries);
  const weightTrend = calculateWeightTrend(trackerState.weightEntries);
  const latestStartupNextAction = getLatestStartupNextAction(trackerState.startupEntries);
  const weightSeries = getWeightChartSeries(trackerState.weightEntries);
  const sleepSeries = getTrendSeries(trackerState.dailyLogs, "sleep");
  const moodSeries = getTrendSeries(trackerState.dailyLogs, "mood");
  const meditationSeries = getMeditationChartSeries(trackerState.meditationEntries);

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

  function updateMomentumField(field, value) {
    setTrackerState((currentState) => {
      const nextEntry = getMomentumEntry(currentState, todayKey);
      nextEntry[field] = value;

      return {
        ...currentState,
        momentumEntries: {
          ...currentState.momentumEntries,
          [todayKey]: nextEntry,
        },
      };
    });
  }

  function toggleMomentumField(field) {
    updateMomentumField(field, !momentumEntry[field]);
  }

  function startTimer(minutes, label) {
    setActiveTimer({
      label,
      secondsLeft: minutes * 60,
    });
  }

  function handleGenerateTinyMoves() {
    const suggestions = generateTinyMove(tinyMoveTask, false);
    setTinyMoveSuggestions(suggestions);
    setSelectedTinyMove(suggestions[0] || "");
  }

  function handleMakeTaskSmaller() {
    const source = selectedTinyMove || tinyMoveTask;
    const suggestions = generateTinyMove(source, true);
    if (suggestions.length > 0) {
      setTinyMoveSuggestions(suggestions);
      setSelectedTinyMove(suggestions[0]);
    }
  }

  function handleChooseSaveDayAction(action) {
    if (action.timer) {
      startTimer(action.timer, action.label);
    }

    if (action.id === "tomorrow") {
      updateMomentumField("plannedTomorrow", true);
      scrollToSection("startup-board");
    }

    if (action.id === "accountability") {
      updateMomentumField("sentAccountability", true);
    }

    if (action.id === "meditate") {
      updateMomentumField("meditated", true);
      scrollToSection("meditation-journey");
    }

    if (action.id === "weight") {
      updateMomentumField("loggedWeight", true);
      scrollToSection("weight-tracker");
    }

    if (action.id === "session" || action.id === "startup") {
      scrollToSection("startup-board");
    }

    updateMomentumField("saveDayComplete", true);
    updateMomentumField("saveDayLastAction", action.label);
    setShowSaveDayModal(false);
  }

  function handleRescueStepToggle(index) {
    setCheckedRescueSteps((current) => ({
      ...current,
      [index]: !current[index],
    }));
  }

  function handleWeightFormChange(field, value) {
    setWeightForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetWeightForm() {
    setWeightForm(createEmptyWeightForm(todayKey));
    setWeightFormError("");
  }

  function handleSaveWeightEntry() {
    const weightValue = toNumber(weightForm.weight);
    if (!weightForm.date || weightValue === null || weightValue <= 0) {
      setWeightFormError("Add a valid date and weight.");
      return;
    }

    const nextEntry = normalizeWeightEntry({
      ...weightForm,
      weight: weightValue,
      updatedAt: Date.now(),
      createdAt: weightForm.id
        ? trackerState.weightEntries.find((entry) => entry.id === weightForm.id)?.createdAt || Date.now()
        : Date.now(),
    });

    setTrackerState((currentState) => {
      const filtered = currentState.weightEntries.filter((entry) => entry.id !== nextEntry.id);
      const nextEntries = [...filtered, nextEntry];
      const nextMomentumEntries = { ...currentState.momentumEntries };

      if (nextEntry.date === todayKey) {
        const nextMomentum = getMomentumEntry(currentState, todayKey);
        nextMomentum.loggedWeight = true;
        nextMomentumEntries[todayKey] = nextMomentum;
      }

      return {
        ...currentState,
        weightEntries: nextEntries,
        momentumEntries: nextMomentumEntries,
      };
    });

    resetWeightForm();
  }

  function handleEditWeightEntry(entry) {
    setWeightForm({
      id: entry.id,
      date: entry.date,
      weight: entry.weight,
      unit: entry.unit,
      notes: entry.notes,
    });
    setWeightFormError("");
  }

  function handleDeleteWeightEntry(entryId) {
    setTrackerState((currentState) => ({
      ...currentState,
      weightEntries: currentState.weightEntries.filter((entry) => entry.id !== entryId),
    }));

    if (weightForm.id === entryId) {
      resetWeightForm();
    }
  }

  function handleMeditationFormChange(field, value) {
    setMeditationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetMeditationForm() {
    setMeditationForm(createEmptyMeditationForm(todayKey));
    setMeditationFormError("");
  }

  function handleSaveMeditationEntry() {
    const durationMinutes = toNumber(meditationForm.durationMinutes);
    const moodBefore = meditationForm.moodBefore === "" ? "" : Number(meditationForm.moodBefore);
    const moodAfter = meditationForm.moodAfter === "" ? "" : Number(meditationForm.moodAfter);

    if (!meditationForm.date || durationMinutes === null || durationMinutes <= 0) {
      setMeditationFormError("Add a valid date and duration.");
      return;
    }

    if ((moodBefore !== "" && (moodBefore < 1 || moodBefore > 10)) || (moodAfter !== "" && (moodAfter < 1 || moodAfter > 10))) {
      setMeditationFormError("Mood before and after should be between 1 and 10.");
      return;
    }

    const nextEntry = normalizeMeditationEntry({
      ...meditationForm,
      durationMinutes,
      moodBefore,
      moodAfter,
      updatedAt: Date.now(),
      createdAt: meditationForm.id
        ? trackerState.meditationEntries.find((entry) => entry.id === meditationForm.id)?.createdAt || Date.now()
        : Date.now(),
    });

    setTrackerState((currentState) => {
      const filtered = currentState.meditationEntries.filter((entry) => entry.id !== nextEntry.id);
      const nextMomentumEntries = { ...currentState.momentumEntries };

      if (nextEntry.date === todayKey) {
        const nextMomentum = getMomentumEntry(currentState, todayKey);
        nextMomentum.meditated = true;
        nextMomentumEntries[todayKey] = nextMomentum;
      }

      return {
        ...currentState,
        meditationEntries: [...filtered, nextEntry],
        momentumEntries: nextMomentumEntries,
      };
    });

    resetMeditationForm();
  }

  function handleEditMeditationEntry(entry) {
    setMeditationForm({
      id: entry.id,
      date: entry.date,
      durationMinutes: entry.durationMinutes,
      type: entry.type,
      moodBefore: entry.moodBefore,
      moodAfter: entry.moodAfter,
      notes: entry.notes,
      insight: entry.insight,
    });
    setMeditationFormError("");
  }

  function handleDeleteMeditationEntry(entryId) {
    setTrackerState((currentState) => ({
      ...currentState,
      meditationEntries: currentState.meditationEntries.filter((entry) => entry.id !== entryId),
    }));

    if (meditationForm.id === entryId) {
      resetMeditationForm();
    }
  }

  function handleStartupFormChange(field, value) {
    setStartupForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetStartupForm() {
    setStartupForm(createEmptyStartupForm(todayKey));
    setStartupFormError("");
  }

  function handleSaveStartupEntry() {
    if (!startupForm.date || !startupForm.actionCompleted.trim()) {
      setStartupFormError("Add a date and one real action completed.");
      return;
    }

    const nextEntry = normalizeStartupEntry({
      ...startupForm,
      updatedAt: Date.now(),
      createdAt: startupForm.id
        ? trackerState.startupEntries.find((entry) => entry.id === startupForm.id)?.createdAt || Date.now()
        : Date.now(),
    });

    setTrackerState((currentState) => ({
      ...currentState,
      startupEntries: [
        ...currentState.startupEntries.filter((entry) => entry.id !== nextEntry.id),
        nextEntry,
      ],
    }));

    resetStartupForm();
  }

  function handleEditStartupEntry(entry) {
    setStartupForm({
      id: entry.id,
      date: entry.date,
      category: entry.category,
      actionCompleted: entry.actionCompleted,
      evidence: entry.evidence,
      nextAction: entry.nextAction,
    });
    setStartupFormError("");
  }

  function handleDeleteStartupEntry(entryId) {
    setTrackerState((currentState) => ({
      ...currentState,
      startupEntries: currentState.startupEntries.filter((entry) => entry.id !== entryId),
    }));

    if (startupForm.id === entryId) {
      resetStartupForm();
    }
  }

  const heroGoalsHit = [
    completionStats.caloriesGoalHit,
    completionStats.stepsGoalHit,
    completionStats.habitsComplete,
    completionStats.workoutsComplete,
  ].filter(Boolean).length;

  return (
    <main className="tracker-app">
      <div className="shell">
        <section className="card hero-card">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="hero-top">
            <div className="eyebrow">{formatLongDate(getDateFromKey(todayKey))}</div>
            <div className="hero-actions">
              <button type="button" className="hero-link" onClick={() => setShowRescueModal(true)}>I'm Stuck</button>
              <button type="button" className="hero-link hero-link-soft" onClick={() => setShowSaveDayModal(true)}>Save the Day</button>
            </div>
          </div>

          <div className="hero-copy">
            <h1>Planner</h1>
            <p>Practical structure for going from stuck to started, and from started to accountable.</p>
          </div>

          <TimerChip activeTimer={activeTimer} />

          <div className="hero-stats hero-stats-momentum">
            <article className="hero-stat">
              <p className="hero-stat-label">Self-trust</p>
              <p className="hero-stat-value">{selfTrustScore.kept}/7</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">First block</p>
              <p className="hero-stat-value">{momentumEntry.firstBlockBeforeEntertainment ? `${momentumEntry.firstBlockMinutes}m` : "Not yet"}</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">Latest weight</p>
              <p className="hero-stat-value">{latestWeight ? `${latestWeight.weight}${latestWeight.unit}` : "--"}</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">Meditation streak</p>
              <p className="hero-stat-value">{meditationStats.currentStreak}</p>
            </article>
            <article className="hero-stat hero-stat-wide">
              <p className="hero-stat-label">Startup next action</p>
              <p className="hero-stat-value hero-stat-text">{latestStartupNextAction?.nextAction || "Log one real action today"}</p>
            </article>
            <article className="hero-stat">
              <p className="hero-stat-label">Goals hit today</p>
              <p className="hero-stat-value">{heroGoalsHit}/4</p>
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
              {momentumEntry.saveDayComplete ? (
                <p className="feedback-badge">Day saved. You kept the chain alive.</p>
              ) : null}
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
            <TinyMoveCard
              task={tinyMoveTask}
              suggestions={tinyMoveSuggestions}
              selectedSuggestion={selectedTinyMove}
              onTaskChange={setTinyMoveTask}
              onGenerate={handleGenerateTinyMoves}
              onSelectSuggestion={setSelectedTinyMove}
              onMakeSmaller={handleMakeTaskSmaller}
            />
          </div>

          <div className="stack">
            <FirstBlockCard momentumEntry={momentumEntry} onChange={updateMomentumField} onStartTimer={startTimer} />
            <SelfTrustCard momentumEntry={momentumEntry} score={selfTrustScore} message={selfTrustMessage} onToggle={toggleMomentumField} />
            <WeeklyTracker
              workoutsCompleted={currentWeekLog.workoutsCompleted}
              summary={weeklySummary}
              onAdjust={adjustWorkoutCount}
              completionStats={completionStats}
            />
          </div>
        </div>

        <div className="layout-grid">
          <div className="stack">
            <WeightTracker
              form={weightForm}
              entries={trackerState.weightEntries}
              trend={weightTrend}
              latestWeight={latestWeight}
              chartSeries={weightSeries}
              formError={weightFormError}
              onFormChange={handleWeightFormChange}
              onSave={handleSaveWeightEntry}
              onEdit={handleEditWeightEntry}
              onDelete={handleDeleteWeightEntry}
              onCancelEdit={resetWeightForm}
            />
          </div>

          <div className="stack">
            <StartupProgressBoard
              form={startupForm}
              entries={trackerState.startupEntries}
              formError={startupFormError}
              onFormChange={handleStartupFormChange}
              onSave={handleSaveStartupEntry}
              onEdit={handleEditStartupEntry}
              onDelete={handleDeleteStartupEntry}
              onCancelEdit={resetStartupForm}
            />
          </div>
        </div>

        <MeditationJourney
          form={meditationForm}
          entries={trackerState.meditationEntries}
          stats={meditationStats}
          chartSeries={meditationSeries}
          formError={meditationFormError}
          onFormChange={handleMeditationFormChange}
          onSave={handleSaveMeditationEntry}
          onEdit={handleEditMeditationEntry}
          onDelete={handleDeleteMeditationEntry}
          onCancelEdit={resetMeditationForm}
        />

        <section className="card section-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Trends</p>
              <h2 className="section-title">Recent signals for sleep and mood.</h2>
            </div>
          </div>

          <div className="chart-list chart-list-two">
            <TrendChart title="Sleep" subtitle="Last 10 days" labels={sleepSeries.labels} values={sleepSeries.values} color="#c98db2" suggestedMax={10} />
            <TrendChart title="Mood" subtitle="Last 10 days" labels={moodSeries.labels} values={moodSeries.values} color="#d975a0" suggestedMax={5} />
          </div>

          <p className="footer-note">
            Entries are stored only in your browser with localStorage. A new date automatically starts a fresh daily log while preserving your history.
          </p>
        </section>
      </div>

      {showRescueModal ? (
        <RescueFlowModal
          selectedState={selectedStuckState}
          checkedSteps={checkedRescueSteps}
          onClose={() => setShowRescueModal(false)}
          onSelectState={(stateLabel) => {
            setSelectedStuckState(stateLabel);
            setCheckedRescueSteps({});
          }}
          onToggleStep={handleRescueStepToggle}
          onStartTimer={startTimer}
          activeTimer={activeTimer}
        />
      ) : null}

      {showSaveDayModal ? (
        <SaveDayModal
          onClose={() => setShowSaveDayModal(false)}
          onChooseAction={handleChooseSaveDayAction}
        />
      ) : null}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
