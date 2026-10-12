-- Anonymous usage statistics (docs/analytics.md). One insert-only table: the
-- app can write events but nothing can read them back through the public API.
-- Apply by hand in the Supabase SQL editor, like the other migrations.
--
-- No user id, no email, no health values: just an event name, a few coarse
-- properties, a random per-launch session id and (only for people who opted
-- in to detailed statistics) a random install id.
CREATE TABLE public.app_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  props jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) < 1024),
  session_id text NOT NULL CHECK (char_length(session_id) <= 40),
  install_id text CHECK (install_id IS NULL OR char_length(install_id) <= 40),
  app_version int,
  lang text CHECK (lang IN ('en', 'nl')),
  platform text CHECK (platform IN ('pwa', 'browser'))
);
CREATE INDEX app_events_ts_idx ON public.app_events (ts);
CREATE INDEX app_events_name_ts_idx ON public.app_events (name, ts);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.app_events TO anon, authenticated;
CREATE POLICY "Anyone can add an event" ON public.app_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
-- No SELECT/UPDATE/DELETE policy on purpose.

-- Who may open the in-app admin page. Add yourself once, by hand:
--   INSERT INTO public.analytics_admins (user_id)
--   SELECT id FROM auth.users WHERE email = 'you@example.com';
CREATE TABLE public.analytics_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.analytics_admins ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.is_analytics_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.analytics_admins WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_analytics_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_analytics_admin() TO authenticated;

-- The numbers behind the admin page. No access check: only the database
-- owner and the service role can run it (this is also what Claude calls with
-- a read-only/service connection). The app goes through analytics_summary.
CREATE FUNCTION public.analytics_summary_data(p_days int DEFAULT 14) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (
    SELECT * FROM public.app_events
    WHERE ts > now() - make_interval(days => GREATEST(1, LEAST(p_days, 180)))
  )
  SELECT jsonb_build_object(
    'days', GREATEST(1, LEAST(p_days, 180)),
    'events', (SELECT count(*) FROM e),
    'sessions', (SELECT count(DISTINCT session_id) FROM e),
    'installs', (SELECT count(DISTINCT install_id) FROM e),
    'per_day', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'sessions', n) ORDER BY d), '[]')
      FROM (SELECT ts::date AS d, count(DISTINCT session_id) AS n FROM e GROUP BY 1) x),
    'setup_funnel', (SELECT coalesce(jsonb_agg(jsonb_build_object('tour', tour, 'step', step, 'sessions', n) ORDER BY tour, step), '[]')
      FROM (SELECT props->>'tour' AS tour, (props->>'step')::int AS step, count(DISTINCT session_id) AS n
            FROM e WHERE name = 'tour.step_viewed' GROUP BY 1, 2) x),
    'workouts', (SELECT coalesce(jsonb_object_agg(name, n), '{}')
      FROM (SELECT name, count(*) AS n FROM e WHERE name LIKE 'workout.%' GROUP BY 1) x),
    'swaps', (SELECT coalesce(jsonb_agg(jsonb_build_object('exercise', ex, 'count', n) ORDER BY n DESC), '[]')
      FROM (SELECT props->>'from_id' AS ex, count(*) AS n FROM e WHERE name = 'exercise.swapped'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x),
    'features', (SELECT coalesce(jsonb_agg(jsonb_build_object('feature', f, 'count', n, 'sessions', s) ORDER BY n DESC), '[]')
      FROM (SELECT props->>'feature' AS f, count(*) AS n, count(DISTINCT session_id) AS s FROM e
            WHERE name = 'feature.used' GROUP BY 1 ORDER BY 2 DESC) x),
    'screens', (SELECT coalesce(jsonb_agg(jsonb_build_object('screen', sc, 'count', n) ORDER BY n DESC), '[]')
      FROM (SELECT props->>'screen' AS sc, count(*) AS n FROM e WHERE name = 'screen.viewed'
            GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x),
    'errors', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'message', m, 'version', v, 'count', n) ORDER BY n DESC), '[]')
      FROM (SELECT name, left(props->>'message', 120) AS m, app_version AS v, count(*) AS n FROM e
            WHERE name LIKE 'error.%' GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 15) x),
    'versions', (SELECT coalesce(jsonb_agg(jsonb_build_object('version', v, 'sessions', n) ORDER BY v DESC), '[]')
      FROM (SELECT app_version AS v, count(DISTINCT session_id) AS n FROM e GROUP BY 1) x),
    'returning', (SELECT count(*) FROM (SELECT install_id FROM e WHERE install_id IS NOT NULL
      GROUP BY 1 HAVING count(DISTINCT ts::date) > 1) x)
  );
$$;
REVOKE ALL ON FUNCTION public.analytics_summary_data(int) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.analytics_summary(p_days int DEFAULT 14) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_analytics_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN public.analytics_summary_data(p_days);
END;
$$;
REVOKE ALL ON FUNCTION public.analytics_summary(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_summary(int) TO authenticated;

-- Keep 180 days (pg_cron is already used for the rest notifications).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-app-events',
      '23 3 * * *',
      $job$DELETE FROM public.app_events WHERE ts < now() - interval '180 days'$job$
    );
  END IF;
END $$;
