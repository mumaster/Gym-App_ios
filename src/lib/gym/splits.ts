import { MUSCLES } from "./data";
import { recommendedMuscles } from "./recommendations";
import type { Rotation } from "./schedule";
import { weekIndex } from "./schedule";
import type { CardioFinisher, CardioPlanDay, Muscle, Workout } from "./types";
import type { FocusGroup } from "./volume";

export type SplitTemplateId =
  "full_body" | "upper_lower" | "upper_focus" | "lower_focus" | "push_pull_legs" | "bro_split" | "hybrid" | "hybrid_days";

export interface SplitDay {
  /** Stable id within a template, e.g. "upper" / "push". */
  id: string;
  label: string;
  /** Target muscle groups for this day. Empty means "whichever's been trained least" (full body). */
  muscles: Muscle[];
  /** Cardio done after the lifting on this day (hybrid template only); the
   *  default a plan starts from, changeable per plan. */
  cardio?: CardioFinisher;
}

export interface SplitTemplate {
  id: SplitTemplateId;
  label: string;
  description: string;
  /** Preselected training frequency when a user first picks this template. */
  suggestedDaysPerWeek: number;
  /** The repeating sequence of day-types this split rotates through. */
  days: SplitDay[];
  /** Cardio on days of its own, between the lifting days (hybrid_days only):
   *  the starting cardio plan, one entry per cardio day. */
  cardioDays?: CardioFinisher[];
}

const UPPER_DAY: SplitDay = {
  id: "upper",
  label: "Upper Body",
  muscles: ["Chest", "Back", "Shoulders", "Arms"],
};
const LOWER_DAY: SplitDay = {
  id: "lower",
  label: "Lower Body",
  muscles: ["Quads", "Hamstrings", "Glutes", "Calves"],
};

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
    id: "upper_focus",
    label: "Upper focus (3:1)",
    description:
      "Three upper body sessions for every lower body one, so each upper muscle is trained about 3 times a week.",
    suggestedDaysPerWeek: 4,
    days: [UPPER_DAY, UPPER_DAY, UPPER_DAY, LOWER_DAY],
  },
  {
    id: "lower_focus",
    label: "Lower focus (3:1)",
    description:
      "Three lower body sessions for every upper body one, so each lower muscle is trained about 3 times a week.",
    suggestedDaysPerWeek: 4,
    days: [LOWER_DAY, LOWER_DAY, LOWER_DAY, UPPER_DAY],
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
  {
    id: "hybrid",
    label: "Hybrid",
    description: "Upper and lower body sessions, each ending with a block of cardio.",
    suggestedDaysPerWeek: 4,
    days: [
      {
        id: "upper",
        label: "Upper + Cardio",
        muscles: ["Chest", "Back", "Shoulders", "Arms"],
        cardio: { activity: "run", effort: "moderate", minutes: 20 },
      },
      {
        id: "lower",
        label: "Lower + Cardio",
        muscles: ["Quads", "Hamstrings", "Glutes", "Calves"],
        cardio: { activity: "cycle", effort: "easy", minutes: 20 },
      },
    ],
  },
  {
    id: "hybrid_days",
    label: "Hybrid · cardio days",
    description: "Upper and lower body days, with a cardio day in between.",
    suggestedDaysPerWeek: 3,
    days: [
      { id: "upper", label: "Upper Body", muscles: ["Chest", "Back", "Shoulders", "Arms"] },
      { id: "lower", label: "Lower Body", muscles: ["Quads", "Hamstrings", "Glutes", "Calves"] },
    ],
    // 30 minutes: the interference with strength grows with the cardio's
    // length and frequency (Wilson et al. 2012, see below), and two such days
    // alongside three lifting days stay near WHO's 150 minutes with the
    // lifting. A run, then an easy ride, so the legs get a low-impact day.
    cardioDays: [
      { activity: "run", effort: "moderate", minutes: 30 },
      { activity: "cycle", effort: "easy", minutes: 30 },
    ],
  },
];

/**
 * The hybrid template: strength and cardio in one session, cardio last.
 *
 * Whether it's sound: adding cardio to strength training doesn't reduce
 * gains in muscle size or maximal strength (Held et al., Sports Med 2026;
 * Schumann et al., Sports Med 2022 — see cardio.ts), including when both
 * are done in one session. What the evidence does say about one session:
 *
 * - Order. Strength before cardio gave 6.9% more lower-body dynamic strength
 *   than the reverse, with no difference in muscle growth, aerobic capacity
 *   or body fat (Eddens et al., Sports Med 2018, 48:177–188). So cardio is
 *   always the last thing in the session, never the warm-up block.
 * - Dose. In Wilson et al.'s meta-analysis (J Strength Cond Res 2012,
 *   26:2293–2307) the interference grew with how long and how often the
 *   cardio was (r −0.29 to −0.75 for duration), and running, unlike cycling,
 *   reduced strength and muscle gains. The newer reviews above found no
 *   effect of modality, so nothing is ruled out, but the defaults take the
 *   safer side: 20 minutes, a moderate run after upper body, and an easy
 *   ride (no impact) after legs that were just trained.
 *
 * Read from the papers' abstracts (Eddens via the Northumbria repository,
 * Wilson via PEDro), the rest as cited in cardio.ts.
 */
export const templateHasCardio = (id: SplitTemplateId) =>
  splitTemplateById(id).days.some((d) => d.cardio);

/** Weekdays tried, in order, for the cardio days of a hybrid_days plan: the
 *  days between the lifting days of a Mon/Wed/Fri week come first. */
const CARDIO_DAY_PREFERENCE = [2, 4, 6, 0, 3, 5, 1];
export const HYBRID_DAY_PREFIX = "hybrid-";

/** The cardio-plan days a template adds on weekdays free of lifting. */
export function separateCardioDays(
  templateId: SplitTemplateId,
  liftingDows: number[],
): CardioPlanDay[] {
  const defaults = splitTemplateById(templateId).cardioDays ?? [];
  const free = CARDIO_DAY_PREFERENCE.filter((d) => !liftingDows.includes(d));
  return defaults.flatMap((c, i) =>
    free[i] === undefined ? [] : [{ id: `${HYBRID_DAY_PREFIX}${i}`, dow: free[i]!, ...c }],
  );
}

/** A cardio plan with the previous hybrid_days cardio days replaced by the
 *  chosen template's (none for other templates). Days of the user's own plan
 *  are kept. */
export function withSeparateCardioDays(
  plan: CardioPlanDay[],
  templateId: SplitTemplateId,
  liftingDows: number[],
): CardioPlanDay[] {
  return [
    ...plan.filter((d) => !d.id.startsWith(HYBRID_DAY_PREFIX)),
    ...separateCardioDays(templateId, liftingDows),
  ];
}

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
  /** Day id → this plan's cardio for that day, replacing the template's
   *  default (hybrid plans). */
  cardio?: Record<string, CardioFinisher> | undefined;
}

/** The cardio planned after the lifting on a slot, or null: the plan's own
 *  choice for that day, else the template's default. */
export function slotCardio(
  templateId: SplitTemplateId,
  slot: ScheduleSlot | undefined,
  overrides?: Record<string, CardioFinisher>,
): CardioFinisher | null {
  if (!slot) return null;
  const day = splitTemplateById(templateId).days.find((d) => d.id === slot.dayId);
  if (!day?.cardio) return null;
  return overrides?.[slot.dayId] ?? day.cardio;
}

/** A template's per-day cardio with a plan's choices applied, for every day
 *  that has cardio. */
export function templateCardio(
  templateId: SplitTemplateId,
  overrides?: Record<string, CardioFinisher>,
): Record<string, CardioFinisher> {
  const out: Record<string, CardioFinisher> = {};
  for (const day of splitTemplateById(templateId).days) {
    if (day.cardio) out[day.id] = overrides?.[day.id] ?? day.cardio;
  }
  return out;
}

/** A hybrid plan's cardio as weekly cardio-plan days, so it counts toward
 *  planned cardio minutes and a day's calories the way the cardio plan does
 *  (cardio.ts). On the slot's usual weekday; ids are stable per slot. */
export function rotationCardioPlan(
  r: {
    templateId: SplitTemplateId;
    schedule: ScheduleSlot[];
    cardio?: Record<string, CardioFinisher> | undefined;
  } | null,
): CardioPlanDay[] {
  if (!r) return [];
  const out: CardioPlanDay[] = [];
  r.schedule.forEach((slot, i) => {
    const c = slotCardio(r.templateId, slot, r.cardio);
    if (c) out.push({ id: `plan-${i}`, dow: slot.dow, ...c });
  });
  return out;
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
