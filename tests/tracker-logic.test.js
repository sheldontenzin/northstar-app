const assert = require("node:assert/strict");
const {
  calculateStreak,
  setGoalCompletion,
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

testMarkingYesterdayRestoresStreak();
testEditingPastDateBreaksStreak();
testTodayTrackingStillWorks();

console.log("tracker-logic tests passed");
