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

// The check-in used to scale suggested weights by fixed percentages
// (−10% / −5% / +2.5% for scores 1 / 2 / 5). No study supports adjusting
// load from a general how-do-you-feel score, so it was removed: load is now
// autoregulated from logged RPE instead (see progression.ts's
// `rpeAdjustedWeight`), the method the autoregulation research actually
// tested. The check-in itself stays as a daily wellness log.
