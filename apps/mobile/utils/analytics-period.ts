// Use local calendar days so weeks remain Monday–Sunday across DST changes.
export function startOfWeek(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function isInWeek(date: Date, weekStart: Date) {
  return date >= weekStart && date < addDays(weekStart, 7);
}

export function weekLabel(start: Date) {
  const end = addDays(start, 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const first = `${start.getDate()}${sameMonth ? "" : ` ${start.toLocaleString("default", { month: "short" })}`}${sameYear ? "" : ` ${start.getFullYear()}`}`;
  return `${first}–${end.getDate()} ${end.toLocaleString("default", { month: "short" })} ${end.getFullYear()}`;
}
