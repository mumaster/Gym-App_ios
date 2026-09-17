/** Local calendar-day key (not UTC) for a Date object directly. */
export function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local calendar-day key (not UTC), so an entry logged at 11pm stays on that day. */
export function dayKey(iso: string): string {
  return dayKeyFromDate(new Date(iso));
}

/** A new Date shifted by `delta` calendar days (negative goes back). */
export function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}
