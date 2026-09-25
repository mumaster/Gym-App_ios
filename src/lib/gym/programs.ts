import { advanceRotation, type Rotation } from "./schedule";
import type { SplitTemplateId } from "./splits";

export type ProgramWeekType = "build" | "deload";

export interface ProgramWeek {
  type: ProgramWeekType;
  /** Multiplier applied to progressive-overload suggested weights generated
   *  during this week (see generator.ts's `intensityMultiplier`) — 1 for a
   *  normal week, >1 to progressively overload across a wave, <1 to deload. */
  intensity: number;
}

export interface ProgramPreset {
  id: string;
  label: string;
  description: string;
  weeks: ProgramWeek[];
}

/**
 * Wave-periodization presets: a run of build weeks at progressively higher
 * intensity, closing on a deload week that drops volume/load to let fatigue
 * dissipate before the next wave — the "5/3/1-style" progression + deload
 * structure from the roadmap, without requiring a manually-tracked training
 * max per lift (this app has no such concept). Intensity scales whatever
 * lib/gym/progression.ts already suggests from actual logged performance,
 * rather than being computed from a percentage-of-1RM table.
 */
export const PROGRAM_PRESETS: ProgramPreset[] = [
  {
    id: "wave_3",
    label: "3-Week Wave",
    description: "Two build weeks, then a deload — a short cycle for faster feedback.",
    weeks: [
      { type: "build", intensity: 1 },
      { type: "build", intensity: 1.075 },
      { type: "deload", intensity: 0.6 },
    ],
  },
  {
    id: "wave_4",
    label: "4-Week Wave",
    description: "Three build weeks of increasing intensity, then a deload before repeating.",
    weeks: [
      { type: "build", intensity: 1 },
      { type: "build", intensity: 1.05 },
      { type: "build", intensity: 1.1 },
      { type: "deload", intensity: 0.6 },
    ],
  },
  {
    id: "wave_6",
    label: "6-Week Wave",
    description: "Five build weeks stepping up gradually, then a deload — a longer, steadier ramp.",
    weeks: [
      { type: "build", intensity: 1 },
      { type: "build", intensity: 1.04 },
      { type: "build", intensity: 1.08 },
      { type: "build", intensity: 1.12 },
      { type: "build", intensity: 1.16 },
      { type: "deload", intensity: 0.6 },
    ],
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
