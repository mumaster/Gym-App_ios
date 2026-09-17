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
    const deviceId = getDeviceId();
    const row = {
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth: json.keys["auth"],
      updated_at: new Date().toISOString(),
    };
    // A plain UPDATE, falling back to INSERT when nothing matched, instead
    // of `.upsert()`: its `ON CONFLICT DO UPDATE` needs a SELECT policy to
    // check the conflicting row's visibility, which this table deliberately
    // doesn't grant (that would let any client read every device's push
    // endpoint/keys). UPDATE ... RETURNING needs no such policy.
    const { data: updated, error: updateError } = await supabase
      .from("push_subscriptions")
      .update(row)
      .eq("device_id", deviceId)
      .select("device_id");
    if (updateError) return { ok: false, reason: `Supabase: ${updateError.message}` };
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("push_subscriptions")
        .insert({ device_id: deviceId, ...row });
      if (insertError) {
        // Lost a race with a concurrent call that inserted first (e.g. the
        // notify toggle fired twice) — the row exists now, so fall back to
        // an update rather than erroring out on a spurious conflict.
        if (insertError.code !== "23505")
          return { ok: false, reason: `Supabase: ${insertError.message}` };
        const { error: retryError } = await supabase
          .from("push_subscriptions")
          .update(row)
          .eq("device_id", deviceId);
        if (retryError) return { ok: false, reason: `Supabase: ${retryError.message}` };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Schedules a server-sent push for when the current rest period ends. */
export async function scheduleRestNotification(secondsFromNow: number): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const fire_at = new Date(Date.now() + secondsFromNow * 1000).toISOString();
    // Same UPDATE-then-INSERT reasoning as ensurePushSubscription above.
    const { data: updated, error: updateError } = await supabase
      .from("rest_timer_notifications")
      .update({ fire_at })
      .eq("device_id", deviceId)
      .select("device_id");
    if (updateError) {
      console.error("scheduleRestNotification:", updateError.message);
      return;
    }
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("rest_timer_notifications")
        .insert({ device_id: deviceId, fire_at });
      if (insertError && insertError.code === "23505") {
        // Same race as ensurePushSubscription: a concurrent call inserted
        // first, so make sure this call's fire_at (the most recent one) wins.
        const { error: retryError } = await supabase
          .from("rest_timer_notifications")
          .update({ fire_at })
          .eq("device_id", deviceId);
        if (retryError) console.error("scheduleRestNotification:", retryError.message);
      } else if (insertError) {
        console.error("scheduleRestNotification:", insertError.message);
      }
    }
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
