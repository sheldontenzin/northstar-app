(function attachPolarisLogic(globalScope) {
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

  function shiftDateKey(dateKey, offsetDays) {
    const date = getDateFromKey(dateKey);
    date.setDate(date.getDate() + offsetDays);
    return getLocalDateKey(date);
  }

  function normalizeGoalValue(value) {
    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }

    if (value === false || value === "false" || value === 0 || value === "0") {
      return false;
    }

    return undefined;
  }

  function normalizeGoalDays(goalDays) {
    if (!goalDays || typeof goalDays !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(goalDays).flatMap(([key, value]) => {
        const normalized = normalizeGoalValue(value);
        return normalized === undefined ? [] : [[key, normalized]];
      })
    );
  }

  function getRecentDateOptions(days = 7, baseDate = new Date()) {
    const normalizedBase = new Date(baseDate);
    normalizedBase.setHours(0, 0, 0, 0);

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(normalizedBase);
      date.setDate(normalizedBase.getDate() - index);
      const key = getLocalDateKey(date);

      let label = date.toLocaleDateString(undefined, { weekday: "short" });
      if (index === 0) {
        label = "Today";
      } else if (index === 1) {
        label = "Yesterday";
      }

      return {
        key,
        label,
        short: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      };
    });
  }

  function getMonthCalendar(baseDate = new Date(), goalDays = {}) {
    const normalizedGoalDays = normalizeGoalDays(goalDays);
    const current = new Date(baseDate);
    current.setHours(0, 0, 0, 0);

    const year = current.getFullYear();
    const month = current.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const leadingDays = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells = [];

    for (let index = 0; index < leadingDays; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const key = getLocalDateKey(date);
      cells.push({
        key,
        label: String(day),
        isFuture: date > current,
        isCompleted: normalizedGoalDays[key] === true,
      });
    }

    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }

    return {
      monthLabel: current.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      weeks,
    };
  }

  function calculateStreak(goalDays, referenceDateKey = getLocalDateKey()) {
    const normalizedGoalDays = normalizeGoalDays(goalDays);

    if (!normalizedGoalDays) {
      return 0;
    }

    const getDayState = (dateKey) => {
      if (!Object.prototype.hasOwnProperty.call(normalizedGoalDays, dateKey)) {
        return "unanswered";
      }

      return normalizedGoalDays[dateKey] === true ? "yes" : "no";
    };

    const referenceState = getDayState(referenceDateKey);

    if (referenceState === "no") {
      return 0;
    }

    let streak = 0;
    let currentKey =
      referenceState === "yes" ? referenceDateKey : shiftDateKey(referenceDateKey, -1);

    while (getDayState(currentKey) === "yes") {
      streak += 1;
      currentKey = shiftDateKey(currentKey, -1);
    }

    return streak;
  }

  function setGoalCompletion(goalDays, dateKey, value) {
    return {
      ...normalizeGoalDays(goalDays),
      [dateKey]: Boolean(value),
    };
  }

  function toggleGoalCompletion(goalDays, dateKey) {
    const normalizedGoalDays = normalizeGoalDays(goalDays);
    return {
      ...normalizedGoalDays,
      [dateKey]: normalizedGoalDays?.[dateKey] === true ? false : true,
    };
  }

  const api = {
    calculateStreak,
    getMonthCalendar,
    getRecentDateOptions,
    normalizeGoalDays,
    normalizeGoalValue,
    setGoalCompletion,
    toggleGoalCompletion,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.PolarisLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
