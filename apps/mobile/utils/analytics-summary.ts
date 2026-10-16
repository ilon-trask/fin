import type { Expense } from "../types/entities";
import { addDays, isInWeek, weekLabel } from "./analytics-period";

export type AnalyticsPeriod = "week" | "month" | "all";

type DatedExpense = { expense: Expense; date: Date };

// Older expenses used day/month/year dates instead of ISO dates.
export function parseExpenseDate(value: string): Date {
  const legacy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  return legacy
    ? new Date(Number(legacy[3]), Number(legacy[2]) - 1, Number(legacy[1]))
    : new Date(value);
}

function isInPeriod(date: Date, period: AnalyticsPeriod, week: Date, month: Date): boolean {
  if (period === "all") return true;
  if (period === "week") return isInWeek(date, week);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function spendingTrend(
  expenses: DatedExpense[],
  period: AnalyticsPeriod,
  selectedWeek: Date,
  selectedMonth: Date,
  now: Date,
) {
  return Array.from({ length: 6 }, (_, index) => {
    if (period === "week") {
      const week = addDays(selectedWeek, (index - 5) * 7);
      const amount = expenses.reduce((sum, { expense, date }) =>
        isInWeek(date, week) ? sum + expense.amount : sum, 0);
      return {
        label: week.toLocaleDateString("default", { day: "numeric", month: "short" }),
        accessibleLabel: weekLabel(week),
        amount,
      };
    }

    const end = period === "month" ? selectedMonth : now;
    const month = new Date(end.getFullYear(), end.getMonth() - 5 + index, 1);
    const amount = expenses.reduce((sum, { expense, date }) =>
      date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
        ? sum + expense.amount : sum, 0);
    return {
      label: month.toLocaleString("default", { month: "short" }),
      accessibleLabel: month.toLocaleString("default", { month: "long", year: "numeric" }),
      amount,
    };
  });
}

export function buildAnalyticsSummary(
  expenses: Expense[],
  currency: string,
  period: AnalyticsPeriod,
  selectedWeek: Date,
  selectedMonth: Date,
  now: Date,
) {
  const currencyExpenses = expenses
    .filter((expense) => (expense.currency ?? "") === currency)
    .map((expense) => ({ expense, date: parseExpenseDate(expense.date) }));
  const currentExpenses = currencyExpenses.filter(({ date }) =>
    isInPeriod(date, period, selectedWeek, selectedMonth));
  const total = currentExpenses.reduce((sum, { expense }) => sum + expense.amount, 0);
  const byCategory = new Map<string, number>();
  for (const { expense } of currentExpenses) {
    byCategory.set(expense.categoryId, (byCategory.get(expense.categoryId) ?? 0) + expense.amount);
  }

  return {
    count: currentExpenses.length,
    total,
    breakdown: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    trend: spendingTrend(currencyExpenses, period, selectedWeek, selectedMonth, now),
  };
}
