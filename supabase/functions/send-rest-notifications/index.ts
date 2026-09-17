// Invoked on a schedule by the pg_cron job set up in
// supabase/migrations/20260917200000_add_push_notifications.sql. Finds any
// rest timers whose fire_at has passed, sends a Web Push notification to the
// matching device's subscription, and clears the row either way. A
// subscription the push service reports as gone (404/410 — the user revoked
// permission, uninstalled the app, etc.) is deleted too, so the client
// re-subscribes next time notifications are turned back on.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:support@forge.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: due, error } = await supabase
    .from("rest_timer_notifications")
    .select("device_id, title, body")
    .lte("fire_at", new Date().toISOString());
  if (error) return new Response(error.message, { status: 500 });
  if (!due?.length) return new Response("ok");

  await Promise.all(
    due.map(async (row) => {
      const { data: sub } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("device_id", row.device_id)
        .maybeSingle();

      if (sub) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: row.title, body: row.body }),
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("device_id", row.device_id);
          }
        }
      }
      await supabase.from("rest_timer_notifications").delete().eq("device_id", row.device_id);
    }),
  );

  return new Response("ok");
});
