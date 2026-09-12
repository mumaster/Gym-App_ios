-- Finer-grained muscle targeting: each exercise lists the specific muscle heads
-- it emphasises (e.g. "Triceps", "Upper Chest"), in addition to the coarse
-- primary_muscle group. Existing rows default to an empty array; the app falls
-- back to a group-derived default until the row is re-saved.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS muscle_targets text[] NOT NULL DEFAULT '{}';
