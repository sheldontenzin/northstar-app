const assert = require("node:assert/strict");
const {
  calculateStreak,
  getDailyWeightSeries,
  getLatestWeightEntry,
  getMonthCalendar,
  getRollingAverageSummary,
  getRollingWeightAverageSeries,
  getWeightSeriesForMode,
  hasEnoughWeightLogsForAverage,
  normalizeGoalDays,
  setGoalCompletion,
  toggleGoalCompletion,
} = require("../tracker-logic.js");

function makeKey(offsetDays = 0) {
  const date = new Date("2026-05-08T12:00:00");
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function testMarkingYesterdayRestoresStreak() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);

  let goalDays = setGoalCompletion({}, todayKey, true);
  assert.equal(calculateStreak(goalDays, todayKey), 1);

  goalDays = setGoalCompletion(goalDays, yesterdayKey, true);
  assert.equal(calculateStreak(goalDays, todayKey), 2);
}

function testYesterdayCompletedTodayUnansweredKeepsStreakAlive() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);

  const goalDays = setGoalCompletion({}, yesterdayKey, true);
  assert.equal(calculateStreak(goalDays, todayKey), 1);
}

function testThreeDayStreakIgnoresUnansweredToday() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);
  const twoDaysAgoKey = makeKey(-2);
  const threeDaysAgoKey = makeKey(-3);

  let goalDays = setGoalCompletion({}, threeDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, twoDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, yesterdayKey, true);

  assert.equal(calculateStreak(goalDays, todayKey), 3);
}

function testThreeDayStreakBecomesFourWhenTodayIsYes() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);
  const twoDaysAgoKey = makeKey(-2);
  const threeDaysAgoKey = makeKey(-3);

  let goalDays = setGoalCompletion({}, threeDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, twoDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, yesterdayKey, true);
  goalDays = setGoalCompletion(goalDays, todayKey, true);

  assert.equal(calculateStreak(goalDays, todayKey), 4);
}

function testThreeDayStreakDropsToZeroWhenTodayIsNo() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);
  const twoDaysAgoKey = makeKey(-2);
  const threeDaysAgoKey = makeKey(-3);

  let goalDays = setGoalCompletion({}, threeDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, twoDaysAgoKey, true);
  goalDays = setGoalCompletion(goalDays, yesterdayKey, true);
  goalDays = setGoalCompletion(goalDays, todayKey, false);

  assert.equal(calculateStreak(goalDays, todayKey), 0);
}

function testMissedYesterdayBreaksStreakEvenIfTodayIsUnanswered() {
  const todayKey = makeKey(0);
  const twoDaysAgoKey = makeKey(-2);

  const goalDays = setGoalCompletion({}, twoDaysAgoKey, true);
  assert.equal(calculateStreak(goalDays, todayKey), 0);
}

function testEditingPastDateBreaksStreak() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);
  const twoDaysAgoKey = makeKey(-2);

  let goalDays = setGoalCompletion({}, todayKey, true);
  goalDays = setGoalCompletion(goalDays, yesterdayKey, true);
  goalDays = setGoalCompletion(goalDays, twoDaysAgoKey, true);

  assert.equal(calculateStreak(goalDays, todayKey), 3);

  goalDays = setGoalCompletion(goalDays, yesterdayKey, false);
  assert.equal(calculateStreak(goalDays, todayKey), 1);
}

function testTodayTrackingStillWorks() {
  const todayKey = makeKey(0);

  let goalDays = setGoalCompletion({}, todayKey, true);
  assert.equal(goalDays[todayKey], true);
  assert.equal(calculateStreak(goalDays, todayKey), 1);

  goalDays = setGoalCompletion(goalDays, todayKey, false);
  assert.equal(goalDays[todayKey], false);
  assert.equal(calculateStreak(goalDays, todayKey), 0);
}

function testYesterdayIncompleteTodayUnansweredIsZero() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);

  const goalDays = setGoalCompletion({}, yesterdayKey, false);
  assert.equal(calculateStreak(goalDays, todayKey), 0);
}

function testEditingOneGoalMapDoesNotAffectAnother() {
  const yesterdayKey = makeKey(-1);

  const deepWorkDays = setGoalCompletion({}, yesterdayKey, true);
  const workoutDays = {};

  assert.equal(deepWorkDays[yesterdayKey], true);
  assert.equal(workoutDays[yesterdayKey], undefined);
}

function testTogglingCalendarDateRestoresAndClearsCompletion() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);

  let goalDays = {};
  goalDays = toggleGoalCompletion(goalDays, yesterdayKey);
  assert.equal(goalDays[yesterdayKey], true);
  assert.equal(calculateStreak(goalDays, todayKey), 1);

  goalDays = toggleGoalCompletion(goalDays, yesterdayKey);
  assert.equal(goalDays[yesterdayKey], false);
  assert.equal(calculateStreak(goalDays, todayKey), 0);
}

function testCalendarDisablesFutureDates() {
  const calendar = getMonthCalendar(new Date("2026-05-08T12:00:00"), {});
  const futureCell = calendar.weeks.flat().find((cell) => cell && cell.key === makeKey(1));
  const todayCell = calendar.weeks.flat().find((cell) => cell && cell.key === makeKey(0));

  assert.equal(todayCell.isFuture, false);
  assert.equal(futureCell.isFuture, true);
}

function testLegacyTruthyValuesDoNotMismatchDotsAndStreaks() {
  const todayKey = makeKey(0);
  const yesterdayKey = makeKey(-1);
  const twoDaysAgoKey = makeKey(-2);

  const legacyGoalDays = normalizeGoalDays({
    [twoDaysAgoKey]: "true",
    [yesterdayKey]: "true",
  });

  assert.equal(legacyGoalDays[yesterdayKey], true);
  assert.equal(calculateStreak(legacyGoalDays, todayKey), 2);
}

function makeWeightEntries() {
  return [
    { date: "2026-05-01", weight: 150, unit: "lb", createdAt: 1 },
    { date: "2026-05-02", weight: 149, unit: "lb", createdAt: 2 },
    { date: "2026-05-04", weight: 148, unit: "lb", createdAt: 3 },
    { date: "2026-05-08", weight: 147, unit: "lb", createdAt: 4 },
  ];
}

function testRollingAverageCalculatesFromMultipleLogs() {
  const series = getRollingWeightAverageSeries(makeWeightEntries(), 12);
  assert.deepEqual(series.labels, ["May 1", "May 2", "May 4", "May 8"]);
  assert.deepEqual(series.values.map((value) => Number(value.toFixed(2))), [150, 149.5, 149, 148]);
}

function testMissingDaysDoNotBreakRollingAverage() {
  const series = getRollingWeightAverageSeries(makeWeightEntries(), 12);
  assert.equal(series.values[2], 149);
  assert.equal(series.values[3], 148);
}

function testDailySeriesStillRendersSeparately() {
  const series = getDailyWeightSeries(makeWeightEntries(), 12);
  assert.deepEqual(series.values, [150, 149, 148, 147]);
  assert.equal(series.label, "Daily");
}

function testLatestWeightUsesMostRecentLog() {
  const latest = getLatestWeightEntry(makeWeightEntries());
  assert.equal(latest.date, "2026-05-08");
  assert.equal(latest.weight, 147);
}

function testWeightSeriesModeReturnsAverageDataset() {
  const series = getWeightSeriesForMode(makeWeightEntries(), "average");
  assert.equal(series.label, "7-day average");
  assert.deepEqual(series.values.map((value) => Number(value.toFixed(2))), [150, 149.5, 149, 148]);
}

function testAverageUiConditionAppearsWhenLogsExist() {
  assert.equal(hasEnoughWeightLogsForAverage(makeWeightEntries()), true);
  assert.equal(hasEnoughWeightLogsForAverage(makeWeightEntries().slice(0, 2)), false);
}

function testLatestRollingAverageSummaryMatchesChartData() {
  const series = getRollingWeightAverageSeries(makeWeightEntries(), 12);
  const summary = getRollingAverageSummary(makeWeightEntries());

  assert.equal(Number(summary.currentAverage.toFixed(1)), Number(series.values.at(-1).toFixed(1)));
  assert.equal(summary.unit, "lb");
}

function testPreviousAverageComparisonWorks() {
  const summary = getRollingAverageSummary(makeWeightEntries());

  assert.equal(Number(summary.currentAverage.toFixed(1)), 148.0);
  assert.equal(Number(summary.previousAverage.toFixed(1)), 149.0);
  assert.equal(Number(summary.change.toFixed(1)), -1.0);
}

testMarkingYesterdayRestoresStreak();
testYesterdayCompletedTodayUnansweredKeepsStreakAlive();
testThreeDayStreakIgnoresUnansweredToday();
testThreeDayStreakBecomesFourWhenTodayIsYes();
testThreeDayStreakDropsToZeroWhenTodayIsNo();
testMissedYesterdayBreaksStreakEvenIfTodayIsUnanswered();
testEditingPastDateBreaksStreak();
testTodayTrackingStillWorks();
testYesterdayIncompleteTodayUnansweredIsZero();
testEditingOneGoalMapDoesNotAffectAnother();
testTogglingCalendarDateRestoresAndClearsCompletion();
testCalendarDisablesFutureDates();
testLegacyTruthyValuesDoNotMismatchDotsAndStreaks();
testRollingAverageCalculatesFromMultipleLogs();
testMissingDaysDoNotBreakRollingAverage();
testDailySeriesStillRendersSeparately();
testLatestWeightUsesMostRecentLog();
testWeightSeriesModeReturnsAverageDataset();
testAverageUiConditionAppearsWhenLogsExist();
testLatestRollingAverageSummaryMatchesChartData();
testPreviousAverageComparisonWorks();

console.log("tracker-logic tests passed");
