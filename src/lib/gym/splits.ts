import { MUSCLES } from "./data";
import { recommendedMuscles } from "./recommendations";
import type { Rotation } from "./schedule";
import { weekIndex } from "./schedule";
import type { Muscle, Workout } from "./types";
import type { FocusGroup } from "./volume";

export type SplitTemplateId = "full_body" | "upper_lower" | "push_pull_legs" | "bro_split";

export interface SplitDay {
  /** Stable id within a template, e.g. "upper" / "push". */
  id: string;
  label: string;
  /** Target muscle groups for this day. Empty means "whichever's been trained least" (full body). */
  muscles: Muscle[];
}

export interface SplitTemplate {
  id: SplitTemplateId;
  label: string;
  description: string;
  /** Preselected training frequency when a user first picks this template. */
  suggestedDaysPerWeek: number;
  /** The repeating sequence of day-types this split rotates through. */
  days: SplitDay[];
}

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: "full_body",
    label: "Full Body",
    description: "Every session trains the whole body, rotating whichever muscles rested longest.",
    suggestedDaysPerWeek: 3,
    days: [{ id: "full", label: "Full Body", muscles: [] }],
  },
  {
    id: "upper_lower",
    label: "Upper / Lower",
    description: "Alternate upper and lower body sessions.",
    suggestedDaysPerWeek: 4,
    days: [
      { id: "upper", label: "Upper Body", muscles: ["Chest", "Back", "Shoulders", "Arms"] },
      { id: "lower", label: "Lower Body", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
    ],
  },
  {
    id: "push_pull_legs",
    label: "Push / Pull / Legs",
    description: "The classic 3-day rotation — repeat it for a 6-day week.",
    suggestedDaysPerWeek: 6,
    days: [
      { id: "push", label: "Push", muscles: ["Chest", "Shoulders", "Arms"] },
      { id: "pull", label: "Pull", muscles: ["Back", "Arms"] },
      { id: "legs", label: "Legs", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
    ],
  },
  {
    id: "bro_split",
    label: "Bro Split",
    description: "One major muscle group takes center stage each day.",
    suggestedDaysPerWeek: 5,
    days: [
      { id: "chest", label: "Chest", muscles: ["Chest"] },
      { id: "back", label: "Back", muscles: ["Back"] },
      { id: "shoulders", label: "Shoulders", muscles: ["Shoulders"] },
      { id: "legs", label: "Legs", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
      { id: "arms", label: "Arms", muscles: ["Arms"] },
    ],
  },
];

export const splitTemplateById = (id: SplitTemplateId): SplitTemplate =>
  SPLIT_TEMPLATES.find((t) => t.id === id) ?? SPLIT_TEMPLATES[0]!;

export interface ScheduleSlot {
  /** Day of week this slot is suggested for: 0 = Sunday ... 6 = Saturday (matches Date#getDay). */
  dow: number;
  /** A SplitDay.id within the owning template. */
  dayId: string;
}

/** `schedule` is one slot per training day/week, ordered Monday-first;
 *  `cyclePosition` indexes the next session and only advances when a
 *  scheduled session is finished or skipped. See lib/gym/schedule.ts for
 *  the calendar fields (`anchor`, `dayOverrides`). */
export interface WeeklyScheme extends Rotation {
  templateId: SplitTemplateId;
}

/** Cyclically assigns a template's day-types across the chosen weekdays, Monday-first. */
export function buildSchedule(templateId: SplitTemplateId, dows: number[]): ScheduleSlot[] {
  const template = splitTemplateById(templateId);
  const sorted = [...new Set(dows)].sort((a, b) => weekIndex(a) - weekIndex(b));
  return sorted.map((dow, i) => ({ dow, dayId: template.days[i % template.days.length]!.id }));
}

/** Best starting slot for a freshly-created schedule: the next slot due today or later. */
export function initialCyclePosition(schedule: ScheduleSlot[]): number {
  if (!schedule.length) return 0;
  const today = weekIndex(new Date().getDay());
  const idx = schedule.findIndex((s) => weekIndex(s.dow) >= today);
  return idx === -1 ? 0 : idx;
}

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** Monday-first display order, matching the rest of the app's calendar/streak UI. */
export const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function splitDayLabel(templateId: SplitTemplateId, dayId: string): string {
  return splitTemplateById(templateId).days.find((d) => d.id === dayId)?.label ?? dayId;
}

/** Concrete target muscles for a scheduled slot — full-body days fall back to
 *  least-recently-trained. Takes a plain `templateId` rather than a whole
 *  `WeeklyScheme` so it's reusable for the multi-week Program concept in
 *  lib/gym/programs.ts, which schedules slots the same way but isn't itself
 *  a WeeklyScheme. */
export function musclesForSlot(
  templateId: SplitTemplateId,
  slot: ScheduleSlot,
  workouts: Workout[],
  focus: FocusGroup[] = [],
): Muscle[] {
  const template = splitTemplateById(templateId);
  const day = template.days.find((d) => d.id === slot.dayId);
  if (!day) return [];
  if (day.muscles.length) return day.muscles;
  return recommendedMuscles(MUSCLES, workouts, 3, focus).map((r) => r.muscle);
}
