-- Web Push support for the in-session rest timer, so a device gets notified
-- when rest ends even if the screen is locked (the app's own JS is suspended
-- in that state, so a client-side timer can't fire a notification itself —
-- this needs a server-sent push instead).
--
-- Like `exercises`, these are intentionally world-writable / no-auth-required
-- (the app is usable fully signed-out): `device_id` is a client-generated
-- random UUID that acts as an unguessable bearer token rather than a proper
-- foreign key to a signed-in user. Anon/authenticated clients can write their
-- own rows but never read any back — only the edge function (via the service
-- role key, which bypasses RLS) needs to read subscriptions and due
-- notifications, so there's no SELECT grant here to avoid leaking other
-- devices' push endpoints/keys.
CREATE TABLE public.push_subscriptions (
  device_id text PRIMARY KEY,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register a push subscription" ON public.push_subscriptions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update a push subscription" ON public.push_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can remove a push subscription" ON public.push_subscriptions
  FOR DELETE USING (true);

-- One pending rest-timer notification per device. `fire_at` cascades away
-- with the subscription it belongs to (a stale/unsubscribed device has
-- nothing to deliver to), and the edge function deletes each row once it's
-- handled it (sent or skipped), so this table is naturally almost-empty.
CREATE TABLE public.rest_timer_notifications (
  device_id text PRIMARY KEY REFERENCES public.push_subscriptions(device_id) ON DELETE CASCADE,
  fire_at timestamptz NOT NULL,
  title text NOT NULL DEFAULT 'Rest complete',
  body text NOT NULL DEFAULT 'Time to lift — back to Forge.',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, UPDATE, DELETE ON public.rest_timer_notifications TO anon, authenticated;

ALTER TABLE public.rest_timer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can schedule a rest notification" ON public.rest_timer_notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can reschedule a rest notification" ON public.rest_timer_notifications
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can cancel a rest notification" ON public.rest_timer_notifications
  FOR DELETE USING (true);

-- Poll for due notifications and hand them to the `send-rest-notifications`
-- edge function. Supabase's pg_cron build supports sub-minute intervals;
-- fall back to the standard 5-field '* * * * *' (once a minute) if this
-- instance's pg_cron rejects the interval form.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- One-time manual step (never commit the key itself): the SQL editor's role
-- isn't a superuser, so a plain `ALTER DATABASE ... SET` for a custom GUC
-- like `app.settings.*` fails with "permission denied to set parameter" —
-- Supabase Vault is the supported way to feed a secret into a cron job. From
-- the SQL editor, run:
--   SELECT vault.create_secret('<service-role-key>', 'service_role_key');
-- (Vault is enabled by default on every Supabase project.)
SELECT cron.schedule(
  'send-rest-notifications',
  '15 seconds',
  $$
  SELECT net.http_post(
    url := 'https://edezkhncpfuzrmxqkxkb.supabase.co/functions/v1/send-rest-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
