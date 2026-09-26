/**
 * Where you are inside the running workout — which exercise, which superset
 * round, and a rest countdown in progress — kept in localStorage so it
 * survives iOS closing the app in the background (opening the camera or a
 * music app is enough). The logged sets already live in the store; this is
 * the part that used to be memory-only, so a relaunch dropped you back on
 * exercise 1 with the rest timer gone.
 *
 * Keyed by the workout's id, so a finished or cancelled session's leftovers
 * are simply ignored by the next one.
 */

export interface SessionPos {
  block: number;
  slot: number;
  round: number;
}

export interface SessionResume {
  workoutId: string;
  pos: SessionPos;
  /** A running rest: its wall-clock end and length, for the progress bar. */
  rest: { endsAt: number; duration: number } | null;
  /** Where to go when that rest finishes (the next exercise or round). */
  afterRest: SessionPos | null;
  /** The rest bar's "Next: …" line. */
  restNext: string | null;
}

const KEY = "forge.session.resume.v1";

export function loadSessionResume(workoutId: string): SessionResume | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SessionResume;
    return saved.workoutId === workoutId ? saved : null;
  } catch {
    return null;
  }
}

export function saveSessionResume(value: SessionResume) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked — resuming is a convenience, not critical.
  }
}

export function clearSessionResume() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
