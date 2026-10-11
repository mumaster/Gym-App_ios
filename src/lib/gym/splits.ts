import { MUSCLES } from "./data";
import { recommendedMuscles } from "./recommendations";
import type { Rotation } from "./schedule";
import { CARDIO_DAY_ID, isCardioSlot, weekIndex } from "./schedule";
import type { CardioFinisher, CardioPlanDay, DayWorkout, Muscle, Workout } from "./types";
import { FOCUS_GROUPS, focusMuscles, type FocusGroup } from "./volume";

export type SplitTemplateId =
  | "full_body"
  | "upper_lower"
  | "upper_focus"
  | "lower_focus"
  | "push_pull_legs"
  | "bro_split"
  | "hybrid"
  | "hybrid_days";

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

const FULL_DAY: SplitDay = { id: "full", label: "Full Body", muscles: [] };
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
const PUSH_DAY: SplitDay = { id: "push", label: "Push", muscles: ["Chest", "Shoulders", "Arms"] };
const PULL_DAY: SplitDay = { id: "pull", label: "Pull", muscles: ["Back", "Arms"] };
const LEGS_DAY: SplitDay = {
  id: "legs",
  label: "Legs",
  muscles: ["Quads", "Hamstrings", "Glutes", "Calves"],
};
const CHEST_DAY: SplitDay = { id: "chest", label: "Chest", muscles: ["Chest"] };
const BACK_DAY: SplitDay = { id: "back", label: "Back", muscles: ["Back"] };
const SHOULDERS_DAY: SplitDay = { id: "shoulders", label: "Shoulders", muscles: ["Shoulders"] };
const ARMS_DAY: SplitDay = { id: "arms", label: "Arms", muscles: ["Arms"] };
/** A day of cardio only, logged rather than generated: no muscles, and the
 *  slot carries what's planned (`ScheduleSlot.cardio`). */
const CARDIO_DAY: SplitDay = { id: CARDIO_DAY_ID, label: "Cardio", muscles: [] };

/** Every kind of day the app can train, whichever split a plan started from:
 *  a slot can be changed to any of them (`dayTypeOptions`). The ids and
 *  labels match the templates' own days; a template's version of a day wins
 *  where it differs (the hybrid split's "Upper + Cardio"). */
export const DAY_TYPES: readonly SplitDay[] = [
  FULL_DAY,
  UPPER_DAY,
  LOWER_DAY,
  PUSH_DAY,
  PULL_DAY,
  LEGS_DAY,
  CHEST_DAY,
  BACK_DAY,
  SHOULDERS_DAY,
  ARMS_DAY,
  CARDIO_DAY,
];

/** What a new cardio day plans: 30 minutes of moderate running, like the
 *  hybrid split's cardio days (and for the same reason, see below). */
export const DEFAULT_CARDIO_DAY: CardioFinisher = {
  activity: "run",
  effort: "moderate",
  minutes: 30,
};

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: "full_body",
    label: "Full Body",
    description: "Every session trains the whole body, rotating whichever muscles rested longest.",
    suggestedDaysPerWeek: 3,
    days: [FULL_DAY],
  },
  {
    id: "upper_lower",
    label: "Upper / Lower",
    description: "Alternate upper and lower body sessions.",
    suggestedDaysPerWeek: 4,
    days: [UPPER_DAY, LOWER_DAY],
  },
  {
    id: "upper_focus",
    label: "Upper focus (3:1)",
    description:
      "Three upper body sessions for every lower body one, so each upper muscle is trained about 3 times a week.",
    suggestedDaysPerWeek: 4,
    // The week repeats, so the order is a rotation of the same ring; putting the
    // odd day third spaces the three main days 1/3/3 days apart on Mon/Tue/Thu/Fri
    // instead of 1/2/4 (the app's own spacing choice, not a published number).
    days: [UPPER_DAY, UPPER_DAY, LOWER_DAY, UPPER_DAY],
  },
  {
    id: "lower_focus",
    label: "Lower focus (3:1)",
    description:
      "Three lower body sessions for every upper body one, so each lower muscle is trained about 3 times a week.",
    suggestedDaysPerWeek: 4,
    days: [LOWER_DAY, LOWER_DAY, UPPER_DAY, LOWER_DAY],
  },
  {
    id: "push_pull_legs",
    label: "Push / Pull / Legs",
    description: "The classic 3-day rotation — repeat it for a 6-day week.",
    suggestedDaysPerWeek: 6,
    days: [PUSH_DAY, PULL_DAY, LEGS_DAY],
  },
  {
    id: "bro_split",
    label: "Bro Split",
    description: "One major muscle group takes center stage each day.",
    suggestedDaysPerWeek: 5,
    days: [CHEST_DAY, BACK_DAY, SHOULDERS_DAY, LEGS_DAY, ARMS_DAY],
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
    days: [UPPER_DAY, LOWER_DAY],
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
  /** A SplitDay.id: one of the owning template's days, or any other day type
   *  the slot was changed to (`DAY_TYPES`). */
  dayId: string;
  /** What a cardio day (`dayId` "cardio") plans; absent on every other day. */
  cardio?: CardioFinisher | undefined;
  /** The workout saved for this day, started as is every week instead of
   *  generating one (lifting days only; dayWorkouts.ts). */
  workout?: DayWorkout | undefined;
  /** Programs only: the workout pre-generated for each program week (index =
   *  week). Wins over `workout` for its week (dayWorkouts.ts). */
  weekWorkouts?: (DayWorkout | null)[] | undefined;
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
 *  choice for that day, else the template's default. A cardio day's own
 *  session isn't this (`cardioDayPlan`). */
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

/** Id prefix of the cardio-plan days that are a rotation's cardio days (the
 *  session itself, logged to complete the slot); a hybrid plan's cardio after
 *  lifting has `plan-` ids. Home leaves the former out of its "+ cardio" line
 *  and cardio hero, since the slot is the session. */
export const SLOT_CARDIO_PREFIX = "slot-";

/** A rotation's own cardio as weekly cardio-plan days, so it counts toward
 *  planned cardio minutes and a day's calories the way the cardio plan does
 *  (cardio.ts): a hybrid plan's cardio after lifting and the cardio days
 *  (`dayId` "cardio"). On the slot's usual weekday; ids are stable per slot. */
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
    const day = cardioDayPlan(slot);
    if (day) {
      out.push({ id: `${SLOT_CARDIO_PREFIX}${i}`, dow: slot.dow, ...day });
      return;
    }
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

/** The template's distinct day types, in first-seen order (a 3:1 split repeats one). */
export function distinctDays(templateId: SplitTemplateId): SplitDay[] {
  const seen = new Set<string>();
  return splitTemplateById(templateId).days.filter((d) => !seen.has(d.id) && !!seen.add(d.id));
}

/** A day type by id, whichever split it came from. */
export const dayTypeById = (dayId: string): SplitDay | undefined =>
  DAY_TYPES.find((d) => d.id === dayId);

/** A slot's day: the template's own version first (the hybrid split's "upper"
 *  is "Upper + Cardio"), else the catalog's. Undefined for an unknown id. */
export function findDay(templateId: SplitTemplateId, dayId: string): SplitDay | undefined {
  return splitTemplateById(templateId).days.find((d) => d.id === dayId) ?? dayTypeById(dayId);
}

/** The day types a slot of this split can be changed to: the split's own
 *  first (see `distinctDays`), then every other day type, cardio last. */
export function dayTypeOptions(templateId: SplitTemplateId): SplitDay[] {
  const own = distinctDays(templateId);
  const ids = new Set(own.map((d) => d.id));
  return [...own, ...DAY_TYPES.filter((d) => !ids.has(d.id))];
}

/** What a cardio slot plans: its own choice, else the default. Null for any
 *  other kind of day. */
export function cardioDayPlan(slot: ScheduleSlot | undefined): CardioFinisher | null {
  if (!slot || !isCardioSlot(slot)) return null;
  return slot.cardio ?? DEFAULT_CARDIO_DAY;
}

/** The slot changed to another day type, if the split or the catalog has it
 *  (else the slot as it was): same weekday, a cardio day gets its default
 *  (or keeps the plan it had) and any other day drops cardio. `keep` is a
 *  cardio plan to carry over when the new day is cardio. */
export function withDayType(
  templateId: SplitTemplateId,
  slot: ScheduleSlot,
  dayId: string,
  keep?: CardioFinisher,
): ScheduleSlot {
  if (!findDay(templateId, dayId)) return slot;
  const { cardio: _own, workout, weekWorkouts, ...rest } = slot;
  // A saved workout belongs to the day type it was made for.
  const kept =
    dayId === slot.dayId
      ? { ...(workout ? { workout } : {}), ...(weekWorkouts ? { weekWorkouts } : {}) }
      : {};
  if (dayId !== CARDIO_DAY_ID) return { ...rest, ...kept, dayId };
  const prior = slot.dayId === CARDIO_DAY_ID ? slot.cardio : undefined;
  return { ...rest, dayId, cardio: { ...(prior ?? keep ?? DEFAULT_CARDIO_DAY) } };
}

/** A schedule with the picked day type applied per weekday (picks keyed by `dow`);
 *  any day type of the split or the catalog is allowed, and unknown ids are
 *  ignored so a stale pick can't produce a slot nothing knows. `previous` is
 *  the schedule being edited: a weekday that stays a cardio day keeps what
 *  it had planned. */
export function applyDayPicks(
  templateId: SplitTemplateId,
  schedule: ScheduleSlot[],
  picks: Record<number, string>,
  previous: ScheduleSlot[] = [],
): ScheduleSlot[] {
  return schedule.map((slot) => {
    const pick = picks[slot.dow];
    const before = previous.find((p) => p.dow === slot.dow);
    const next = pick ? withDayType(templateId, slot, pick, before?.cardio) : slot;
    // A weekday that keeps its day type keeps the workout saved for it.
    return before && before.dayId === next.dayId && (before.workout || before.weekWorkouts)
      ? {
          ...next,
          ...(before.workout ? { workout: before.workout } : {}),
          ...(before.weekWorkouts ? { weekWorkouts: before.weekWorkouts } : {}),
        }
      : next;
  });
}

/** Changes which day type one slot of a rotation trains, to any day type of
 *  its split or the catalog (splits.ts). Its weekday and the rotation's
 *  progress (cursor, week, done days) stay. */
export function withSlotDay<R extends { templateId: SplitTemplateId; schedule: ScheduleSlot[] }>(
  r: R,
  index: number,
  dayId: string,
): R {
  const slot = r.schedule[index];
  if (!slot) return r;
  const next = withDayType(r.templateId, slot, dayId);
  if (next === slot) return r;
  return { ...r, schedule: r.schedule.map((s, i) => (i === index ? next : s)) };
}

/** Sets what a cardio slot plans; any other slot is left alone. */
export function withSlotCardio<R extends { schedule: ScheduleSlot[] }>(
  r: R,
  index: number,
  cardio: CardioFinisher,
): R {
  const slot = r.schedule[index];
  if (!slot || !cardioDayPlan(slot)) return r;
  return {
    ...r,
    schedule: r.schedule.map((s, i) => (i === index ? { ...s, cardio: { ...cardio } } : s)),
  };
}

/** Moves a rotation past its cardio slot once it's been logged, the way
 *  finishing a scheduled session does (`doneOn` is the day it was done). A
 *  rotation whose next session isn't a cardio day is left as it was. */
export function withCardioSlotDone<R extends Rotation>(
  r: R,
  advance: (r: R, doneOn: Date) => R,
  doneOn: Date,
): R {
  return isCardioSlot(r.schedule[r.cyclePosition]) ? advance(r, doneOn) : r;
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
  return findDay(templateId, dayId)?.label ?? dayId;
}

/** Concrete target muscles for a scheduled slot — full-body days fall back to
 *  least-recently-trained, a cardio day trains none. Takes a plain `templateId` rather than a whole
 *  `WeeklyScheme` so it's reusable for the multi-week Program concept in
 *  lib/gym/programs.ts, which schedules slots the same way but isn't itself
 *  a WeeklyScheme. */
export function musclesForSlot(
  templateId: SplitTemplateId,
  slot: ScheduleSlot,
  workouts: Workout[],
  focus: FocusGroup[] = [],
): Muscle[] {
  const day = findDay(templateId, slot.dayId);
  if (!day || isCardioSlot(slot)) return [];
  if (day.muscles.length) return day.muscles;
  const ranked = recommendedMuscles(MUSCLES, workouts, MUSCLES.length, focus).map((r) => r.muscle);
  // A full-body day still leans on the user's growth focus: two focus muscles
  // first, then the most-due of the rest (otherwise untrained ties fall to the
  // first muscles in the list, i.e. chest/back/arms, whatever the focus is).
  const focused = focusMuscles(focus);
  const groupOf = (m: Muscle) => FOCUS_GROUPS.find((g) => g.muscles.includes(m))?.id;
  const focusRanked = ranked.filter((m) => focused.has(m));
  // spread across focus groups (glutes AND legs) before doubling up in one
  const spread = focusRanked.filter(
    (m, i) => focusRanked.findIndex((x) => groupOf(x) === groupOf(m)) === i,
  );
  const picks = [
    ...[...spread, ...focusRanked.filter((m) => !spread.includes(m))].slice(0, 2),
    ...ranked.filter((m) => !focused.has(m)),
  ];
  return picks.slice(0, 3);
}
