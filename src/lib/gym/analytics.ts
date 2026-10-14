// Anonymous usage statistics (docs/analytics.md). Events go to one insert-only
// Supabase table; nothing here ever throws or blocks the UI.
//
// Levels (GymState.analyticsLevel):
//   off      nothing is sent.
//   basic    anonymous events with a random id that lives only until the app
//            is closed. The default.
//   detailed opt-in: also a random install id kept on the device, so a
//            returning person can be recognised, plus finer properties.
//
// Never put health or personal values in an event (weights, reps, food,
// calories, names, notes, email, user id). `sanitizeProps` drops keys that
// look like that as a last line of defence; the test pins it.
import { CURRENT_VERSION } from "./changelog";

export type AnalyticsLevel = "off" | "basic" | "detailed";
export type EventProps = Record<string, string | number | boolean>;

export type EventRow = {
  name: string;
  props: EventProps;
  session_id: string;
  install_id: string | null;
  app_version: number;
  lang: "en" | "nl";
  platform: "pwa" | "browser";
};

const INSTALL_ID_KEY = "forge.analytics.id.v1";
const MAX_QUEUE = 200;
const BATCH = 25;
const FLUSH_MS = 10_000;
const MAX_STRING = 120;
const MAX_KEYS = 12;

/** Property keys that must never leave the device. */
const FORBIDDEN_KEY =
  /weight|(^|_)kg|reps|kcal|calor|protein|carb|sugar|fat|food|meal|ingredient|email|mail|user|name|note|allerg|barcode|password|token|bodyfat|height|(^|_)age($|_)|birth/i;

export function sanitizeProps(props: Record<string, unknown> | undefined): EventProps {
  const out: EventProps = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    if (FORBIDDEN_KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, MAX_STRING);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

type Context = { level: AnalyticsLevel; lang: "en" | "nl" };
let ctx: Context = { level: "off", lang: "en" };
let queue: EventRow[] = [];
let sessionId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const newId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
};

function installId(): string | null {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function platform(): "pwa" | "browser" {
  try {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    return standalone ? "pwa" : "browser";
  } catch {
    return "browser";
  }
}

/** Called by GymProvider once the saved state is loaded, and on every change. */
export function configureAnalytics(next: Context): void {
  ctx = next;
  if (next.level === "off") {
    queue = [];
    forgetInstall();
  } else if (next.level === "basic") {
    forgetInstall();
  }
}

function forgetInstall(): void {
  try {
    localStorage.removeItem(INSTALL_ID_KEY);
  } catch {
    /* nothing stored */
  }
}

/** The row for an event under the current settings, or null when off. */
export function buildRow(
  name: string,
  props?: Record<string, unknown>,
  detail?: Record<string, unknown>,
): EventRow | null {
  if (ctx.level === "off") return null;
  sessionId ??= newId();
  const merged = ctx.level === "detailed" ? { ...props, ...detail } : props;
  return {
    name: name.slice(0, 60),
    props: sanitizeProps(merged),
    session_id: sessionId,
    install_id: ctx.level === "detailed" ? installId() : null,
    app_version: CURRENT_VERSION,
    lang: ctx.lang,
    platform: platform(),
  };
}

/** Record an event. `detail` is only added at the detailed level. */
export function track(
  name: string,
  props?: Record<string, unknown>,
  detail?: Record<string, unknown>,
): void {
  try {
    const row = buildRow(name, props, detail);
    if (!row) return;
    queue.push(row);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (queue.length >= BATCH) flushEvents();
    else if (!timer) timer = setTimeout(flushEvents, FLUSH_MS);
  } catch {
    /* analytics must never break the app */
  }
}

/** Send what is waiting. keepalive lets it finish while the app is closing. */
export function flushEvents(): void {
  try {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) {
      queue = [];
      return;
    }
    const batch = queue.splice(0, BATCH);
    const headers: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
    // Legacy anon keys are JWTs; the new publishable keys are not.
    if (key.startsWith("eyJ")) headers["Authorization"] = `Bearer ${key}`;
    fetch(`${url}/rest/v1/app_events`, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
      keepalive: true,
    })
      .then((res) => {
        // A rejected batch (e.g. the table isn't migrated yet) is dropped, not retried forever.
        if (!res.ok) return;
      })
      .catch(() => {
        // Offline: put the batch back (bounded) for the next flush.
        queue = [...batch, ...queue].slice(-MAX_QUEUE);
      });
    if (queue.length > 0) timer = setTimeout(flushEvents, FLUSH_MS);
  } catch {
    /* analytics must never break the app */
  }
}

/** Test helper: forget queued events and the session id. */
export function resetAnalyticsForTests(): void {
  queue = [];
  sessionId = null;
  ctx = { level: "off", lang: "en" };
  if (timer) clearTimeout(timer);
  timer = null;
}

export const queuedEventCount = (): number => queue.length;
