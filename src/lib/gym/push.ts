import { supabase } from "../../integrations/supabase/client";

/** Public VAPID key for Forge's Web Push subscriptions — safe to expose client-side. */
const VAPID_PUBLIC_KEY =
  "BD47i2d3Ha3sEfA6tQKzTgMi4AjtvPmDIQey9eRnBgEN-7kad3u9Lu5RZp0_K-5WXxzsNJt_z9QM_29GzOWP2Ks";

const DEVICE_ID_KEY = "forge.push-device-id.v1";
/** The endpoint this device last re-registered after its row went missing
 *  (see restoreSubscription). */
const RESTORED_KEY = "forge.push-restored.v1";

/** Postgres foreign_key_violation: `rest_timer_notifications.device_id`
 *  references `push_subscriptions`, so this means the device has no
 *  subscription row on the server. */
const FK_VIOLATION = "23503";

type DbError = { code?: string; message: string } | null;
/** PostgREST: no function with that name (the migration adding it,
 *  20261001200000_rest_notification_rpcs.sql, isn't applied yet). */
const NO_FUNCTION = "PGRST202";
/** Whether the RPCs below exist on the server: unknown until the first call. */
let rpcAvailable: boolean | null = null;

/**
 * Writes go through SECURITY DEFINER functions rather than the tables:
 * the tables have no SELECT policy (no device may read another's push
 * endpoint), and PostgreSQL applies SELECT policies to an UPDATE or DELETE
 * whose WHERE reads a column, so `update/delete … where device_id = …`
 * silently matched nothing. Skip rest, Undo and +30 s never reached the
 * server, and the push came at the original time. Returns null when the
 * functions don't exist yet, so the caller can use the old table writes.
 */
async function rpc(fn: string, args: Record<string, unknown>): Promise<{ error: DbError } | null> {
  if (rpcAvailable === false) return null;
  // The generated Supabase types don't know these functions yet.
  const call = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ error: DbError }>;
  const { error } = await call(fn, args);
  if (error?.code === NO_FUNCTION) {
    rpcAvailable = false;
    return null;
  }
  rpcAvailable = true;
  return { error };
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushSubscribeResult = { ok: true } | { ok: false; reason: string };

/**
 * Subscribes this device for Web Push (if not already) and upserts the
 * subscription to Supabase, so the server can notify it even while the
 * screen is off. Push is a best-effort enhancement on top of the in-app rest
 * timer, not a requirement (e.g. it only actually works on iOS for a PWA
 * added to the Home Screen) — callers can ignore a failure result, but it's
 * returned rather than swallowed so the caller can surface it if useful.
 */
export async function ensurePushSubscription({ renew = false }: { renew?: boolean } = {}): Promise<
  PushSubscribeResult & { endpoint?: string }
> {
  if (typeof window === "undefined") return { ok: false, reason: "no window" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no service worker support" };
  if (!("PushManager" in window)) return { ok: false, reason: "no Push API support" };
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    // `renew` swaps a subscription the push service no longer accepts for a
    // fresh one (a new endpoint and keys).
    if (subscription && renew) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) {
      return { ok: false, reason: "subscription missing endpoint/keys" };
    }
    const deviceId = getDeviceId();
    const viaRpc = await rpc("save_push_subscription", {
      p_device_id: deviceId,
      p_endpoint: json.endpoint,
      p_p256dh: json.keys["p256dh"],
      p_auth: json.keys["auth"],
    });
    if (viaRpc) {
      if (viaRpc.error) return { ok: false, reason: `Supabase: ${viaRpc.error.message}` };
      return { ok: true, endpoint: json.endpoint };
    }
    // Without the function (migration not applied): insert, which works for
    // a new device; an existing row can't be changed this way (see rpc).
    const { error: insertError } = await supabase.from("push_subscriptions").insert({
      device_id: deviceId,
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth: json.keys["auth"],
      updated_at: new Date().toISOString(),
    });
    if (insertError && insertError.code !== "23505")
      return { ok: false, reason: `Supabase: ${insertError.message}` };
    return { ok: true, endpoint: json.endpoint };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Puts this device's subscription row back after it went missing. That
 * happens when the server dropped it because the push service answered
 * 404/410 for its endpoint (see send-rest-notifications), when the first
 * save never succeeded, or when cleared storage gave the device a new id.
 * The first time, the existing subscription is simply saved again. If the
 * row goes missing again for that same endpoint, the push service is
 * rejecting it, so it's replaced with a fresh subscription.
 */
async function restoreSubscription(): Promise<PushSubscribeResult> {
  let restored: string | null = null;
  try {
    restored = localStorage.getItem(RESTORED_KEY);
  } catch {
    // Storage blocked: just save the existing subscription again.
  }
  let current: string | null = null;
  try {
    const registration = await navigator.serviceWorker.ready;
    current = (await registration.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    // No service worker/Push API: ensurePushSubscription reports why.
  }
  const result = await ensurePushSubscription({
    renew: current !== null && current === restored,
  });
  if (result.ok && result.endpoint) {
    try {
      localStorage.setItem(RESTORED_KEY, result.endpoint);
    } catch {
      // Not critical: the next recovery re-saves instead of renewing.
    }
  }
  return result;
}

/** Sets this device's rest notification to `fire_at` (insert or move). */
async function writeRestNotification(deviceId: string, fire_at: string): Promise<DbError> {
  const viaRpc = await rpc("schedule_rest_notification", {
    p_device_id: deviceId,
    p_fire_at: fire_at,
  });
  if (viaRpc) return viaRpc.error;
  // Without the function: an insert only works while no row is pending.
  const { error } = await supabase
    .from("rest_timer_notifications")
    .insert({ device_id: deviceId, fire_at });
  return error;
}

/** Rest-notification writes run one after another, in the order they were
 *  made: Skip right after logging a set would otherwise send its cancel
 *  while the schedule is still on its way, and the schedule could land last. */
let restWrites: Promise<unknown> = Promise.resolve();
function inOrder<T>(write: () => Promise<T>): Promise<T> {
  const next = restWrites.then(write, write);
  restWrites = next.catch(() => undefined);
  return next;
}

/** Schedules a server-sent push for when the current rest period ends. */
export function scheduleRestNotification(secondsFromNow: number): Promise<PushSubscribeResult> {
  // The end time is fixed now, not when the queued write runs.
  const fire_at = new Date(Date.now() + secondsFromNow * 1000).toISOString();
  return inOrder(() => writeRestEnd(fire_at));
}

async function writeRestEnd(fire_at: string): Promise<PushSubscribeResult> {
  try {
    const deviceId = getDeviceId();
    let error = await writeRestNotification(deviceId, fire_at);
    if (error?.code === FK_VIOLATION) {
      // No subscription row for this device on the server: put it back
      // and try once more, rather than failing on every rest.
      const restored = await restoreSubscription();
      if (!restored.ok) return restored;
      error = await writeRestNotification(deviceId, fire_at);
    }
    // 23505 only comes from the fallback insert: a push is already pending
    // and can't be moved without the migration. Not something to report.
    if (error && error.code !== "23505") return { ok: false, reason: `Supabase: ${error.message}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Cancels this device's pending rest notification, if any (rest ended, was skipped, or workout stopped). */
export function cancelRestNotification(): Promise<void> {
  return inOrder(removeRestEnd);
}

async function removeRestEnd(): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const viaRpc = await rpc("cancel_rest_notification", { p_device_id: deviceId });
    const error = viaRpc
      ? viaRpc.error
      : (await supabase.from("rest_timer_notifications").delete().eq("device_id", deviceId)).error;
    if (error) console.error("cancelRestNotification:", error.message);
  } catch (err) {
    console.error("cancelRestNotification:", err);
  }
}

/** Tells the service worker which language to use for the server-sent rest
 *  push, whose own title/body are fixed English. Best-effort. */
export async function syncRestNotificationCopy(title: string, body: string): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "forge:rest-copy", title, body });
  } catch {
    /* the push falls back to its own copy */
  }
}
