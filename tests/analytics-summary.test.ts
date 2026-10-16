import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsSummary, parseExpenseDate } from "../apps/mobile/utils/analytics-summary";
import { startOfWeek } from "../apps/mobile/utils/analytics-period";

const now = new Date(2026, 9, 14);
const week = startOfWeek(now);
const month = new Date(2026, 9, 1);
const expenses = [
  { id: "a", amount: 10, date: "14/10/2026", categoryId: "food", currency: "EUR" },
  { id: "b", amount: 20, date: "2026-10-12", categoryId: "food", currency: "EUR" },
  { id: "c", amount: 5, date: "2026-09-20", categoryId: "travel", currency: "EUR" },
  { id: "d", amount: 30, date: "2026-10-13", categoryId: "food", currency: "USD" },
];

test("analytics groups week, month and all time by currency and category", () => {
  assert.equal(parseExpenseDate("14/10/2026").getDate(), 14);
  const weekly = buildAnalyticsSummary(expenses, "EUR", "week", week, month, now);
  assert.equal(weekly.count, 2);
  assert.equal(weekly.total, 30);
  assert.deepEqual(weekly.breakdown, [["food", 30]]);
  assert.equal(weekly.trend.at(-1)?.amount, 30);

  const monthly = buildAnalyticsSummary(expenses, "EUR", "month", week, month, now);
  assert.equal(monthly.total, 30);
  assert.equal(monthly.trend.at(-2)?.amount, 5);
  const allTime = buildAnalyticsSummary(expenses, "EUR", "all", week, month, now);
  assert.equal(allTime.total, 35);
  assert.deepEqual(allTime.breakdown, [["food", 30], ["travel", 5]]);
  assert.equal(buildAnalyticsSummary(expenses, "USD", "month", week, month, now).total, 30);
});
