import { supabase } from "../../integrations/supabase/client";

/** Public VAPID key for Forge's Web Push subscriptions — safe to expose client-side. */
const VAPID_PUBLIC_KEY =
  "BD47i2d3Ha3sEfA6tQKzTgMi4AjtvPmDIQey9eRnBgEN-7kad3u9Lu5RZp0_K-5WXxzsNJt_z9QM_29GzOWP2Ks";

const DEVICE_ID_KEY = "forge.push-device-id.v1";

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
export async function ensurePushSubscription(): Promise<PushSubscribeResult> {
  if (typeof window === "undefined") return { ok: false, reason: "no window" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no service worker support" };
  if (!("PushManager" in window)) return { ok: false, reason: "no Push API support" };
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
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
    const { error } = await supabase.from("push_subscriptions").upsert({
      device_id: getDeviceId(),
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth: json.keys["auth"],
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, reason: `Supabase: ${error.message}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Schedules a server-sent push for when the current rest period ends. */
export async function scheduleRestNotification(secondsFromNow: number): Promise<void> {
  try {
    const { error } = await supabase.from("rest_timer_notifications").upsert({
      device_id: getDeviceId(),
      fire_at: new Date(Date.now() + secondsFromNow * 1000).toISOString(),
    });
    if (error) console.error("scheduleRestNotification:", error.message);
  } catch (err) {
    console.error("scheduleRestNotification:", err);
  }
}

/** Cancels this device's pending rest notification, if any (rest ended, was skipped, or workout stopped). */
export async function cancelRestNotification(): Promise<void> {
  try {
    const { error } = await supabase
      .from("rest_timer_notifications")
      .delete()
      .eq("device_id", getDeviceId());
    if (error) console.error("cancelRestNotification:", error.message);
  } catch (err) {
    console.error("cancelRestNotification:", err);
  }
}
