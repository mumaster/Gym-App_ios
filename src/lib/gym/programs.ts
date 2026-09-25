import { advanceRotation, type Rotation } from "./schedule";
import type { SplitTemplateId } from "./splits";

export type ProgramWeekType = "build" | "deload";

export interface ProgramWeek {
  type: ProgramWeekType;
  /** Multiplier on the progressive-overload suggested weight generated
   *  during this week (see generator.ts's `intensityMultiplier`). */
  intensity: number;
  /** Multiplier on working sets per exercise (generator.ts's
   *  `volumeMultiplier`). */
  volume: number;
}

export interface ProgramPreset {
  id: string;
  label: string;
  description: string;
  weeks: ProgramWeek[];
}

/**
 * Deload weeks, from the deloading research rather than round numbers:
 *
 * - How often/long: a Delphi consensus of strength and physique coaches
 *   (Bell et al., Sports Med Open 2023) puts deloads every 4–6 weeks for
 *   5–7 days, and a survey of 246 athletes (Bell et al., Sports Med Open
 *   2024) found 6.4 ± 1.7 days every 5.6 ± 2.3 weeks. So the waves are 4, 5
 *   and 6 weeks long, each ending in a one-week deload (the old 3-week wave
 *   deloaded more often than that).
 * - What changes: both describe cutting volume (fewer sets) and load while
 *   keeping training frequency. Bell et al.'s practical guide (Strength Cond
 *   J 2025) gives a 40–60% volume cut for moderate recovery needs and about
 *   a 10% load drop, so a deload keeps half the sets (the midpoint) at 90%
 *   of the suggested weight. Coleman et al. (PeerJ 2024) found stopping
 *   training entirely for a week cost some strength, which is why this is a
 *   reduced week rather than a week off.
 *
 * Build weeks change nothing: load increases come from the sourced double-
 * progression rule in progression.ts. The old build weeks also multiplied
 * the weight by up to 1.16 on top of that, adding load twice with no source.
 */
const BUILD_WEEK: ProgramWeek = { type: "build", intensity: 1, volume: 1 };
export const DELOAD_WEEK: ProgramWeek = { type: "deload", intensity: 0.9, volume: 0.5 };

const wave = (buildWeeks: number): ProgramWeek[] => [
  ...Array.from({ length: buildWeeks }, () => BUILD_WEEK),
  DELOAD_WEEK,
];

export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    id: "wave_4",
    label: "4-Week Wave",
    description: "Three build weeks, then a deload week — the shortest recommended cycle.",
    weeks: wave(3),
  },
  {
    id: "wave_5",
    label: "5-Week Wave",
    description: "Four build weeks, then a deload week — close to what most athletes use.",
    weeks: wave(4),
  },
  {
    id: "wave_6",
    label: "6-Week Wave",
    description: "Five build weeks, then a deload week — the longest recommended cycle.",
    weeks: wave(5),
  },
];

export const programPresetById = (id: string): ProgramPreset =>
  PROGRAM_PRESETS.find((p) => p.id === id) ?? PROGRAM_PRESETS[0]!;

/** Same rotation shape as WeeklyScheme (`schedule` Monday-first,
 *  `cyclePosition` = next session within the current week, plus the
 *  calendar fields from lib/gym/schedule.ts), bounded by `weeks`. */
export interface Program extends Rotation {
  id: string;
  name: string;
  templateId: SplitTemplateId;
  weeks: ProgramWeek[];
  /** Index into `weeks` for the week currently being trained. */
  currentWeek: number;
}

export const currentProgramWeek = (program: Program): ProgramWeek =>
  program.weeks[program.currentWeek] ?? program.weeks[0]!;

/** Advances a program's cursor by one finished or skipped session — rolls
 *  into the next week (wrapping back to week 0, so a finished wave restarts
 *  rather than dead-ending) once the current week's schedule is exhausted. */
export function advanceProgram(program: Program, today = new Date()): Program {
  const { rotation, wrapped } = advanceRotation(program, today);
  return wrapped
    ? { ...rotation, currentWeek: (program.currentWeek + 1) % program.weeks.length }
    : rotation;
}
