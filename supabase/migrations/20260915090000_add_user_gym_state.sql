-- Per-user cloud backup/sync of the app's local state (equipment profiles,
-- workout history, settings, nutrition log) so a signed-in user can pick up
-- their progress on a second device. One row per user, keyed by auth.uid();
-- unlike `exercises` (a shared catalog, intentionally world-readable) this
-- table is private to its owner.
CREATE TABLE public.user_gym_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_gym_state TO authenticated;

ALTER TABLE public.user_gym_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own state" ON public.user_gym_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own state" ON public.user_gym_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own state" ON public.user_gym_state
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own state" ON public.user_gym_state
  FOR DELETE USING (auth.uid() = user_id);
