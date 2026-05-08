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

  function calculateStreak(goalDays, referenceDateKey = getLocalDateKey()) {
    let streak = 0;
    let currentKey = referenceDateKey;

    while (goalDays && goalDays[currentKey] === true) {
      streak += 1;
      currentKey = shiftDateKey(currentKey, -1);
    }

    return streak;
  }

  function setGoalCompletion(goalDays, dateKey, value) {
    return {
      ...(goalDays || {}),
      [dateKey]: Boolean(value),
    };
  }

  const api = {
    calculateStreak,
    getRecentDateOptions,
    setGoalCompletion,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.PolarisLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
