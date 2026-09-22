import { dayKey } from "./date";

export type ReadinessScore = 1 | 2 | 3 | 4 | 5;

export interface ReadinessCheckIn {
  /** ISO timestamp when logged. */
  date: string;
  score: ReadinessScore;
}

/** Emoji only — the label text itself is translated, see lib/gym/i18n.ts's
 *  `readiness` namespace (keyed 1-5, same as this). */
export const READINESS_EMOJI: Record<ReadinessScore, string> = {
  1: "🥵",
  2: "😣",
  3: "😐",
  4: "🙂",
  5: "💪",
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

/** Which transparent, user-facing note (if any) explains why the suggestion
 *  was adjusted — a kind rather than the text itself, since this is a plain
 *  lib file with no access to the app's translations; the caller maps this
 *  to localized copy (see lib/gym/i18n.ts's `progression` namespace). */
export type ReadinessNoteKind = "trimmedLot" | "trimmedLittle" | "nudgedUp" | null;

export function readinessNoteKind(score: ReadinessScore | undefined): ReadinessNoteKind {
  switch (score) {
    case 1:
      return "trimmedLot";
    case 2:
      return "trimmedLittle";
    case 5:
      return "nudgedUp";
    default:
      return null;
  }
}
