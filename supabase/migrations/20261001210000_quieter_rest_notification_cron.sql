-- Cut the log volume of the rest-notification cron job (Logs Ingest was over
-- the quota). The job from 20260917200000_add_push_notifications.sql called
-- the send-rest-notifications edge function every 6 seconds, around the
-- clock: ~14,400 calls a day, each logging the cron statement (the whole
-- http_post command), the edge function's boot and request, and the
-- function's own API query — even though a notification is only due a few
-- times per workout.
--
-- 1. The check for due notifications now happens in the database first; the
--    edge function is only called when something is due.
-- 2. The cron command is one short function call, so the line pg_cron logs
--    for every run is short too (cron.log_statement is on by default and
--    can only be turned off with the Supabase CLI; see below).
-- 3. pg_cron's run history (cron.job_run_details, one row per run) is
--    trimmed daily so the table doesn't grow forever.
--
-- Optional, to also drop pg_cron's per-run log line (needs the Supabase
-- CLI and takes effect after a database restart):
--   supabase --experimental postgres-config update --config cron.log_statement=false

CREATE OR REPLACE FUNCTION public.dispatch_due_rest_notifications()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rest_timer_notifications WHERE fire_at <= now()) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://edezkhncpfuzrmxqkxkb.supabase.co/functions/v1/send-rest-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Only the cron job (running as the database owner) calls this; the app's
-- roles must not be able to trigger it through the API.
REVOKE ALL ON FUNCTION public.dispatch_due_rest_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_due_rest_notifications() FROM anon, authenticated;

-- Same job name: cron.schedule replaces the existing job's command.
SELECT cron.schedule(
  'send-rest-notifications',
  '6 seconds',
  'SELECT public.dispatch_due_rest_notifications()'
);

-- Keep a day of run history (enough to check the job works).
SELECT cron.schedule(
  'purge-cron-run-history',
  '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day'$$
);
