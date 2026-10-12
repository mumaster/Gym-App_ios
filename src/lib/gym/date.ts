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

/** The `logged_at` for food added to the day `key`: right now for today (or
 *  no day), else noon local time of that day, so it lands on that day in
 *  every time zone. This is how meals are logged ahead for future days. */
export function loggedAtForDay(key?: string): string {
  if (!key || key === dayKeyFromDate(new Date())) return new Date().toISOString();
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).toISOString();
}
