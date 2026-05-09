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

  function toNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

  function sortWeightEntries(entries, direction = "desc") {
    return [...(entries || [])].sort((left, right) => {
      const dateDelta = new Date(left.date) - new Date(right.date);
      const createdDelta = (left.createdAt || 0) - (right.createdAt || 0);
      const delta = dateDelta || createdDelta;
      return direction === "asc" ? delta : -delta;
    });
  }

  function formatShortDate(dateKey) {
    return getDateFromKey(dateKey).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function getDailyWeightSeries(entries, limit = 12) {
    const sorted = sortWeightEntries(entries, "asc").slice(-limit);
    const unit = sorted[sorted.length - 1]?.unit || "lb";

    return {
      labels: sorted.map((entry) => formatShortDate(entry.date)),
      values: sorted.map((entry) => toNumber(entry.weight)),
      unit,
      label: "Daily",
    };
  }

  function getRollingWeightAverageSeries(entries, limit = 12) {
    const sorted = sortWeightEntries(entries, "asc");
    const unit = sorted[sorted.length - 1]?.unit || "lb";
    const points = sorted.map((entry, index) => {
      const currentDate = getDateFromKey(entry.date);
      const windowStart = new Date(currentDate);
      windowStart.setDate(currentDate.getDate() - 6);

      const windowValues = sorted
        .slice(0, index + 1)
        .filter((candidate) => {
          const candidateDate = getDateFromKey(candidate.date);
          return candidateDate >= windowStart && candidateDate <= currentDate;
        })
        .map((candidate) => toNumber(candidate.weight))
        .filter((value) => value !== null);

      const average =
        windowValues.length > 0
          ? windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length
          : null;

      return {
        label: formatShortDate(entry.date),
        value: average,
      };
    }).slice(-limit);

    return {
      labels: points.map((point) => point.label),
      values: points.map((point) => point.value),
      unit,
      label: "7-day average",
    };
  }

  function getLatestWeightEntry(entries) {
    return sortWeightEntries(entries, "desc")[0] || null;
  }

  const api = {
    calculateStreak,
    getDailyWeightSeries,
    getLatestWeightEntry,
    getMonthCalendar,
    getRecentDateOptions,
    getRollingWeightAverageSeries,
    normalizeGoalDays,
    normalizeGoalValue,
    setGoalCompletion,
    sortWeightEntries,
    toggleGoalCompletion,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.PolarisLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
