import assert from "node:assert/strict";
import test from "node:test";
import { addDays, isInWeek, startOfWeek } from "../apps/mobile/utils/analytics-period";

test("weeks start on Monday and include Sunday across a year boundary", () => {
  const start = startOfWeek(new Date(2027, 0, 3, 18));
  assert.equal(start.getTime(), new Date(2026, 11, 28).getTime());
  assert.equal(isInWeek(new Date(2026, 11, 27, 23, 59), start), false);
  assert.equal(isInWeek(new Date(2026, 11, 28), start), true);
  assert.equal(isInWeek(new Date(2027, 0, 3, 23, 59, 59), start), true);
  assert.equal(isInWeek(new Date(2027, 0, 4), start), false);
  assert.equal(isInWeek(new Date("invalid"), start), false);
});

test("week navigation follows calendar days across daylight saving changes", () => {
  const start = new Date(2026, 9, 19);
  const next = addDays(start, 7);
  assert.equal(next.getTime(), new Date(2026, 9, 26).getTime());
  assert.equal(addDays(next, -7).getTime(), start.getTime());
  assert.equal(startOfWeek(new Date(2026, 9, 25, 23, 59)).getTime(), start.getTime());
  assert.equal(isInWeek(new Date(2026, 9, 25, 23, 59), start), true);
  assert.equal(isInWeek(next, start), false);
});
