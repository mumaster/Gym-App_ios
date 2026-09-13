import { dayKey } from "./date";

export type ReadinessScore = 1 | 2 | 3 | 4 | 5;

export interface ReadinessCheckIn {
  /** ISO timestamp when logged. */
  date: string;
  score: ReadinessScore;
}

export const READINESS_LABELS: Record<ReadinessScore, { emoji: string; label: string }> = {
  1: { emoji: "🥵", label: "Wiped out" },
  2: { emoji: "😣", label: "Rough" },
  3: { emoji: "😐", label: "Okay" },
  4: { emoji: "🙂", label: "Good" },
  5: { emoji: "💪", label: "Great" },
};

/** Today's check-in, if one has already been logged. */
export function todaysCheckIn(log: ReadinessCheckIn[]): ReadinessCheckIn | undefined {
  const key = dayKey(new Date().toISOString());
  return log.find((c) => dayKey(c.date) === key);
}

/**
 * Multiplier applied to suggested working weight based on how the user says
 * they're feeling. Deliberately conservative — this trims or nudges load, it
 * never changes set/rep counts or session length.
 */
export function readinessWeightFactor(score: ReadinessScore | undefined): number {
  switch (score) {
    case 1:
      return 0.9;
    case 2:
      return 0.95;
    case 5:
      return 1.025;
    default:
      return 1;
  }
}

/** Transparent, user-facing explanation for why the suggestion was adjusted. */
export function readinessNote(score: ReadinessScore | undefined): string | null {
  switch (score) {
    case 1:
      return "Trimmed a good bit — you checked in wiped out today.";
    case 2:
      return "Trimmed a little for today's readiness.";
    case 5:
      return "Nudged up — you're feeling great today.";
    default:
      return null;
  }
}
