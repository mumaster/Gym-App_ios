-- Let a device actually move and cancel its own rest notification.
--
-- The tables from 20260917200000_add_push_notifications.sql have RLS with
-- INSERT/UPDATE/DELETE policies but, on purpose, no SELECT policy (no device
-- may read another's push endpoint). PostgreSQL also applies SELECT policies
-- to an UPDATE or DELETE whose WHERE clause reads a column, though, so the
-- app's `update … where device_id = …` and `delete … where device_id = …`
-- matched no rows — silently, without an error. A rest notification could
-- be inserted but never moved or cancelled: after Skip rest, Undo or +30 s
-- the push still came at the original time, and a rest started before the
-- previous push had fired kept that earlier time. The same applied to
-- re-saving a push subscription whose endpoint had changed.
--
-- These functions do the write as their owner (SECURITY DEFINER), scoped to
-- the one device id passed in, so the tables keep having no SELECT policy.
-- The device id stays the bearer token it was before: whoever knows it could
-- already insert for it.

CREATE OR REPLACE FUNCTION public.schedule_rest_notification(p_device_id text, p_fire_at timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.rest_timer_notifications (device_id, fire_at)
  VALUES (p_device_id, p_fire_at)
  ON CONFLICT (device_id) DO UPDATE SET fire_at = EXCLUDED.fire_at, created_at = now();
$$;

CREATE OR REPLACE FUNCTION public.cancel_rest_notification(p_device_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rest_timer_notifications WHERE device_id = p_device_id;
$$;

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_device_id text,
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.push_subscriptions (device_id, endpoint, p256dh, auth, updated_at)
  VALUES (p_device_id, p_endpoint, p_p256dh, p_auth, now())
  ON CONFLICT (device_id) DO UPDATE
    SET endpoint = EXCLUDED.endpoint,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.schedule_rest_notification(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_rest_notification(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_rest_notification(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_rest_notification(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO anon, authenticated;
