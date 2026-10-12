# Usage statistics

Anonymous event log in the app's own Supabase project. No third party.

## What is collected

- **Basic** (on by default, can be switched off in Settings → Usage statistics): event name,
  a few coarse properties (screen, feature, step number, exercise ids from the catalog, counts),
  app version, language, browser/PWA, and a random id that exists only until the app is closed.
- **Detailed** (opt-in): additionally a random install id kept on the device (to see whether
  people come back) and a few finer properties (`detail` argument of `track`).
- **Never**: weights, reps, calories, food, names, notes, email, user id, IP, screen recordings.
  `sanitizeProps` in `src/lib/gym/analytics.ts` drops keys that look like such data; the test
  `analytics.test.ts` pins it. Keep new events inside this rule.

## Events

`screen.viewed`, `tour.step_viewed` / `tour.completed` / `tour.skipped`, `workout.generated` /
`started` / `finished` / `cancelled`, `exercise.swapped` (session and generated plan),
`feature.used {feature}`, `error.js`. Add new ones with `track(name, props, detail?)`.

## Setup (once, by hand, like the other migrations)

1. Run `supabase/migrations/20261012180000_add_analytics.sql` in the Supabase SQL editor.
2. Make yourself admin (opens Settings → Usage dashboard, `/analytics`):
   `INSERT INTO public.analytics_admins (user_id) SELECT id FROM auth.users WHERE email = '…';`
3. For Claude: it reads the numbers with `SELECT public.analytics_summary_data(30);` (and plain
   SQL on `app_events`) through a read-only connection or the Supabase MCP connector. The table
   holds no personal data. Never put the service-role key in the repo or a chat.

## Before going public (TODO)

This setup is meant for a small group of testers. When the app goes public, revisit:

- **Consent / ePrivacy.** The anonymous level relies on the exemption for first-party,
  aggregated statistics with no personal data. Detailed uses a device id and is opt-in only.
  With a public audience, get a proper legal check, add a privacy policy, and consider an
  explicit first-launch choice instead of "basic on by default".
- **Privacy text** describing exactly what is collected (Settings copy is a start, not enough).
- **Abuse.** The table accepts inserts from anyone with the public key (size-limited). Consider
  rate limiting through an edge function.
- **Capacity.** Supabase free plan limits (500 MB database, bandwidth); retention is 180 days.
- Re-check the free-tier numbers in `/mnt/project-files/analytics/analytics-research.md`.
