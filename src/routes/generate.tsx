import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  CalendarClock,
  ChevronRight,
  Flame,
  Heart,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Settings2,
  Snowflake,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { AdjustWeekSheet } from "../components/gym/AdjustWeekSheet";
import { CardioWeekCard } from "../components/gym/CardioWeekCard";
import { AnatomyMap, SUGGESTED_COLOR } from "../components/gym/AnatomyMap";
import { DumbbellLoader } from "../components/gym/DumbbellLoader";
import { MissedSessionBanner } from "../components/gym/MissedSessionBanner";
import { ProgramBuilderSheet } from "../components/gym/ProgramBuilderSheet";
import { RotationWeekStrip } from "../components/gym/RotationWeekStrip";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { SegmentedTabs } from "../components/gym/SegmentedTabs";
import { SwitchRow } from "../components/gym/SwitchRow";
import { SwapSheet } from "../components/gym/SwapSheet";
import { WeeklyPlanSheet } from "../components/gym/WeeklyPlanSheet";
import { WorkoutTemplatesSheet } from "../components/gym/WorkoutTemplatesSheet";
import { EQUIPMENT, MUSCLES, TARGET_MUSCLE_GROUP, exerciseById } from "../lib/gym/data";
import { estimateMinutes, generateWorkout } from "../lib/gym/generator";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../lib/gym/numericInput";
import {
  PAIRINGS,
  REGIONS,
  musclesFromRegions,
  regionById,
  regionsForMuscles,
  targetsFromRegions,
  type RegionId,
} from "../lib/gym/anatomy";
import { plateStep } from "../lib/gym/plates";
import { currentProgramWeek } from "../lib/gym/programs";
import { recommendedMuscles } from "../lib/gym/recommendations";
import { suggestWeight } from "../lib/gym/progression";
import { crossEstimate, heavierHint, withKnownLifts } from "../lib/gym/startWeight";
import { todaysCheckIn } from "../lib/gym/readiness";
import { plannedDate } from "../lib/gym/schedule";
import {
  musclesForSlot,
  splitDayLabel,
  splitTemplateById,
  type ScheduleSlot,
  type SplitTemplateId,
} from "../lib/gym/splits";
import { haptic, useGym } from "../lib/gym/store";
import { formatLoad, isBodyweightExercise, latestBodyKg } from "../lib/gym/load";
import { focusMuscles } from "../lib/gym/volume";
import type { Exercise, Muscle, PlannedExercise, TargetMuscle } from "../lib/gym/types";
import { ExerciseDetailSheet } from "../components/gym/ExerciseDetailSheet";
import { chip } from "../components/gym/ui";

/** With a program or weekly plan the tab has two sub-tabs: the plan (the
 *  default) and building your own. Without one there are no tabs and the
 *  page is the builder. */
const WORKOUT_TABS = ["plan", "build"] as const;
type WorkoutTab = (typeof WORKOUT_TABS)[number];

export const Route = createFileRoute("/generate")({
  validateSearch: (search: Record<string, unknown>): { tab?: "build" } =>
    search["tab"] === "build" ? { tab: "build" } : {},
  head: () => ({
    meta: [
      { title: "Generate Workout — Forge" },
      {
        name: "description",
        content:
          "Pick your time, gym equipment and target muscles and get a personal-trainer grade session in seconds.",
      },
      { property: "og:title", content: "Generate Workout — Forge" },
      {
        property: "og:description",
        content: "Time-, equipment- and muscle-aware workout generation for the gym floor.",
      },
    ],
  }),
  component: WorkoutHome,
});

const SHORTCUTS = [30, 45, 60];

function WorkoutHome() {
  const navigate = useNavigate();
  const { tab = "plan" } = Route.useSearch();
  const navigateTab = Route.useNavigate();
  const t = useTranslation();
  const locale = useLocale();
  const {
    profiles,
    activeProfileId,
    activeWorkout,
    workouts,
    knownLifts,
    update,
    startWorkout,
    hydrated,
    supersetsEnabled,
    warmupsEnabled,
    growthFocus,
    lovedExerciseIds,
    toggleLovedExercise,
    avoidedExerciseIds,
    weeklyScheme,
    program,
    workoutTemplates,
    readinessLog,
    avatarId,
    weightLog,
    nutritionProfile,
  } = useGym();
  const [duration, setDuration] = useState(45);
  const [customInput, setCustomInput] = useState("45");
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [proposal, setProposal] = useState<RegionId | null>(null);
  const [focus, setFocus] = useState<TargetMuscle[]>([]);
  const [plan, setPlan] = useState<PlannedExercise[] | null>(null);
  const [variation, setVariation] = useState(0);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  /** Exercise whose page is open (tapped in the plan). */
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [programSheetOpen, setProgramSheetOpen] = useState(false);
  const [adjustWeekOpen, setAdjustWeekOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  /**
   * True when the current muscle selection came straight from a PT-designed
   * flow (a recommended-muscles nudge or a scheduled split day) rather than
   * free manual tapping. Those combos are deliberately >2 groups (a Push day
   * is Chest+Shoulders+Triceps, a Legs day is 4 groups) so the "too many
   * muscle groups" warning below only applies to the manual case it was
   * actually meant for — any manual tap reverts to that case.
   */
  const [curatedSelection, setCuratedSelection] = useState(false);
  /**
   * True only when the current selection is exactly today's scheduled split
   * day, untouched — distinct from `curatedSelection` above, since applying
   * the "Recommended today" nudge is curated but isn't "the schedule". Only
   * sessions started with this true advance the weekly scheme's rotation.
   */
  const [followingSchedule, setFollowingSchedule] = useState(false);
  /** Same idea as `followingSchedule`, for an active multi-week Program's
   *  next scheduled day — mutually exclusive with it in practice, since a
   *  session is started from at most one scheduling source. */
  const [followingProgram, setFollowingProgram] = useState(false);

  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const muscles = musclesFromRegions(regions);

  // every specific muscle the selected map regions cover
  const regionTargets = targetsFromRegions(regions);
  const activeGroups = [...new Set(regionTargets.map((t) => TARGET_MUSCLE_GROUP[t]))];
  // per group: honour the user's focus picks, otherwise train the whole group
  const targetsFor = (rs: RegionId[], fs: TargetMuscle[]): TargetMuscle[] => {
    const all = targetsFromRegions(rs);
    const groups = [...new Set(all.map((t) => TARGET_MUSCLE_GROUP[t]))];
    return groups.flatMap((g) => {
      const inGroup = all.filter((t) => TARGET_MUSCLE_GROUP[t] === g);
      const picked = inGroup.filter((t) => fs.includes(t));
      return picked.length ? picked : inGroup;
    });
  };
  const targets = targetsFor(regions, focus);
  // groups with more than one head to drill into, for the Focus chips
  const focusGroups = activeGroups
    .map((g) => ({ group: g, heads: regionTargets.filter((t) => TARGET_MUSCLE_GROUP[t] === g) }))
    .filter((x) => x.heads.length > 1);

  const toggleFocus = (t: TargetMuscle) => {
    haptic(12);
    setFocus((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  /** Selecting a single region triggers the trainer pairing proposal. */
  const toggleRegion = (id: RegionId) => {
    haptic(12);
    setCuratedSelection(false);
    setFollowingSchedule(false);
    setFollowingProgram(false);
    setRegions((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      if (next.length === 1 && next[0] === id && PAIRINGS[id]) setProposal(id);
      else setProposal(null);
      return next;
    });
  };

  const acceptProposal = () => {
    if (!proposal) return;
    const pair = PAIRINGS[proposal]!;
    haptic([20, 30]);
    setFollowingSchedule(false);
    setFollowingProgram(false);
    setRegions((cur) => (cur.includes(pair.with) ? cur : [...cur, pair.with]));
    setProposal(null);
  };

  const todayCheckIn = todaysCheckIn(readinessLog);
  const todayReadiness = todayCheckIn?.score;

  /** What a plan was built from. A plan only shows while its inputs still
   *  match: change the time, a muscle, the gear or supersets and it goes,
   *  and the button goes back to Generate, so the plan on screen and the
   *  "Start workout" under it always match what's selected above. */
  const inputKey = (rs: RegionId[], fs: TargetMuscle[]) =>
    JSON.stringify([
      [...rs].sort(),
      [...fs].sort(),
      duration,
      profile.id,
      profile.active_equipment_ids.length,
      supersetsEnabled,
      warmupsEnabled,
    ]);
  const [planKey, setPlanKey] = useState<string | null>(null);
  const shownPlan = plan && planKey === inputKey(regions, focus) ? plan : null;
  const planRef = useRef<HTMLDivElement>(null);
  const [scrollToPlan, setScrollToPlan] = useState(0);
  useEffect(() => {
    if (!scrollToPlan) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = planRef.current;
    if (!el) return;
    // Just under the sticky header, measured rather than assumed: it's
    // taller with the sub-tabs, and the status-bar inset varies.
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    window.scrollTo({
      top: window.scrollY + el.getBoundingClientRect().top - headerBottom - 12,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [scrollToPlan]);

  /** Builds a plan from the current selection, or from `from` — a split day
   *  sets its muscles and builds in the same tap, before state has caught up. */
  const build = (
    nextVariation: number,
    from?: { regions: RegionId[]; focus?: TargetMuscle[]; followingProgram: boolean },
  ) => {
    haptic(25);
    setVariation(nextVariation);
    const rs = from?.regions ?? regions;
    const fs = from ? (from.focus ?? []) : focus;
    const week =
      (from?.followingProgram ?? followingProgram) && program ? currentProgramWeek(program) : null;
    setPlanKey(inputKey(rs, fs));
    setPlan(
      generateWorkout({
        duration,
        equipment: profile.active_equipment_ids,
        targets: targetsFor(rs, fs),
        variation: nextVariation,
        supersets: supersetsEnabled,
        warmups: warmupsEnabled,
        focusMuscles: [...focusMuscles(growthFocus)],
        loved: lovedExerciseIds,
        avoided: avoidedExerciseIds,
        history: workouts,
        knownLifts,
        profile,
        bodyKg: latestBodyKg(weightLog, nutritionProfile),
        ...(week ? { intensityMultiplier: week.intensity, volumeMultiplier: week.volume } : {}),
      }),
    );
  };

  // Generation itself is instant — the delay here is purely to make the
  // "Generate workout" button feel like it's actually building the session
  // rather than just flipping content in place. Only that button gets this;
  // Shuffle (regenerating an already-visible plan) stays immediate.
  const [generating, setGenerating] = useState(false);
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(generateTimeoutRef.current ?? undefined), []);

  // Builds, then brings the plan into view: it used to appear below the
  // fold, and the button only changed its label, so nothing seemed to happen.
  const generate = (from?: {
    regions: RegionId[];
    focus?: TargetMuscle[];
    followingProgram: boolean;
  }) => {
    if (generating) return;
    haptic(15);
    setGenerating(true);
    clearTimeout(generateTimeoutRef.current ?? undefined);
    generateTimeoutRef.current = setTimeout(() => {
      build(0, from);
      setGenerating(false);
      setScrollToPlan((n) => n + 1);
    }, 1500);
  };
  const shuffle = () => build(variation + 1);
  /** The builder's Generate: an own session, never the plan's day, even
   *  when the map still holds the muscles a "Build {day} day" filled in. */
  const generateOwn = () => {
    setFollowingSchedule(false);
    setFollowingProgram(false);
    generate({ regions, focus, followingProgram: false });
  };

  const move = (index: number, delta: number) => {
    setPlan((cur) => {
      if (!cur) return cur;
      const to = index + delta;
      if (to < 0 || to >= cur.length) return cur;
      const next = [...cur];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved!);
      haptic(12);
      return next;
    });
  };

  const proposalPair = proposal ? PAIRINGS[proposal] : undefined;

  // Muscles that have gone longest without a logged working set — nudges toward
  // a sane weekly split instead of always training the same favourites.
  const recommended = recommendedMuscles(MUSCLES, workouts, 2, growthFocus);
  const applyRecommendation = () => {
    haptic([20, 30]);
    setCuratedSelection(true);
    setFollowingSchedule(false);
    setFollowingProgram(false);
    setRegions(regionsForMuscles(recommended.map((r) => r.muscle)));
    setProposal(null);
  };

  const scheduledSlot = weeklyScheme?.schedule[weeklyScheme.cyclePosition];
  const scheduledDayLabel =
    weeklyScheme && scheduledSlot
      ? splitDayLabel(weeklyScheme.templateId, scheduledSlot.dayId)
      : "";

  /** A split day's button fills in its muscles and builds the plan in the
   *  same tap, then shows it — it used to only tick muscles on the map,
   *  off screen, so "Start Push day" seemed to do nothing. */
  const buildSplitDay = (
    templateId: SplitTemplateId,
    slot: ScheduleSlot,
    source: "program" | "weeklyScheme",
  ) => {
    setCuratedSelection(true);
    setFollowingSchedule(source === "weeklyScheme");
    setFollowingProgram(source === "program");
    const rs = regionsForMuscles(
      musclesForSlot(templateId, slot, workouts, growthFocus),
      slot.dayId,
    );
    setRegions(rs);
    setFocus([]);
    setProposal(null);
    generate({ regions: rs, followingProgram: source === "program" });
  };

  const startScheduledDay = () => {
    if (!weeklyScheme || !scheduledSlot) return;
    buildSplitDay(weeklyScheme.templateId, scheduledSlot, "weeklyScheme");
  };

  const programWeek = program ? currentProgramWeek(program) : null;
  const scheduledProgramSlot = program?.schedule[program.cyclePosition];
  const programDayLabel =
    program && scheduledProgramSlot
      ? splitDayLabel(program.templateId, scheduledProgramSlot.dayId)
      : "";

  const startProgramDay = () => {
    if (!program || !scheduledProgramSlot) return;
    buildSplitDay(program.templateId, scheduledProgramSlot, "program");
  };

  const start = () => {
    if (!shownPlan) return;
    haptic([20, 40, 20]);
    startWorkout({
      plan: shownPlan,
      duration_minutes: duration,
      target_muscles: muscles,
      fromScheduledDay: followingSchedule,
      fromProgramDay: followingProgram,
    });
    navigate({ to: "/session" });
  };

  /** Start a saved template's exact plan, same as `repeat` below but from a
   *  named template rather than a specific past session. */
  const startTemplate = (
    templatePlan: PlannedExercise[],
    templateDuration: number,
    templateMuscles: Muscle[],
  ) => {
    haptic([20, 40, 20]);
    startWorkout({
      plan: templatePlan,
      duration_minutes: templateDuration,
      target_muscles: templateMuscles,
    });
    navigate({ to: "/session" });
  };

  /** Re-run a finished session's exact plan without touching the generator. */
  const repeat = (w: (typeof workouts)[number]) => {
    haptic([20, 40, 20]);
    startWorkout({
      plan: w.plan,
      duration_minutes: w.duration_minutes,
      target_muscles: w.target_muscles,
    });
    navigate({ to: "/session" });
  };

  const hasPlan = !!(program || weeklyScheme);
  /** The program or weekly-plan card, or the prompt to set one up. */
  /** One-tap starts: the last three sessions (the first is "Repeat last
   *  workout") and saved templates, in one row instead of two sections. */
  const quickStarts: {
    key: string;
    icon: "repeat" | "template";
    eyebrow: string;
    title: string;
    detail: string;
    start: () => void;
  }[] = [
    ...workouts.slice(0, 3).map((w, i) => ({
      key: w.id,
      icon: "repeat" as const,
      eyebrow:
        i === 0
          ? t.generate.lastWorkout
          : new Date(w.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
      title: w.target_muscles.join(" · ") || t.generate.fullBody,
      detail: t.generate.exerciseCount(w.plan.length, estimateMinutes(w.plan)),
      start: () => repeat(w),
    })),
    ...workoutTemplates.slice(0, 6).map((tpl) => ({
      key: tpl.id,
      icon: "template" as const,
      eyebrow: t.generate.template,
      title: tpl.name,
      detail: t.generate.exerciseCount(tpl.plan.length, estimateMinutes(tpl.plan)),
      start: () => startTemplate(tpl.plan, tpl.duration_minutes, tpl.target_muscles),
    })),
  ];
  /** Sub-tabs only once there's a plan to put on the first one. */
  const tabbed = hydrated && hasPlan;
  const setTab = (next: WorkoutTab) => {
    setProposal(null);
    void navigateTab({ search: next === "plan" ? {} : { tab: next }, replace: true });
    window.scrollTo({ top: 0 });
  };
  const showBuilder = !tabbed || tab === "build";
  /** A plan shows on the tab it was built from: a split day's on My plan,
   *  the builder's on Build your own. */
  const planOrigin: WorkoutTab = followingProgram || followingSchedule ? "plan" : "build";
  const planHere = shownPlan && (!tabbed || planOrigin === tab) ? shownPlan : null;

  /** Session length: the builder's first row, and on My plan right above
   *  "Build {day} day", since the time you have differs from day to day.
   *  One value for both (the two never show at once). Changing it hides a
   *  plan built for another length, like every other input (inputKey). */
  const durationPicker = (
    <div className="flex items-center gap-2">
      {SHORTCUTS.map((d) => (
        <button
          key={d}
          onClick={() => {
            haptic(12);
            setDuration(d);
            setCustomInput(String(d));
          }}
          className={`tap-target min-h-[40px] flex-1 rounded-full text-[15px] font-semibold transition-colors ${
            duration === d ? chip.on : "bg-secondary text-secondary-foreground"
          }`}
        >
          {d}m
        </button>
      ))}
      <label
        className={`tap-target flex min-h-[40px] w-[5.5rem] shrink-0 items-center gap-1 rounded-full px-3 ${
          SHORTCUTS.includes(duration) ? "bg-muted" : chip.on
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          aria-label={t.generate.minutes}
          value={customInput}
          onFocus={selectOnFocus}
          onChange={(e) => {
            const raw = e.target.value;
            if (!DECIMAL_INPUT_RE.test(raw)) return;
            setCustomInput(raw);
            const n = Math.round(parseDecimal(raw));
            if (raw !== "" && Number.isFinite(n) && n > 0) {
              setDuration(Math.min(180, n));
            }
          }}
          onBlur={() => {
            const clamped = Math.max(5, Math.min(180, Math.round(parseDecimal(customInput) || 45)));
            setDuration(clamped);
            setCustomInput(String(clamped));
          }}
          className="tabular w-full min-w-0 bg-transparent text-center text-[16px] font-bold text-foreground outline-none"
        />
        <span className="text-[12px] font-semibold text-muted-foreground">min</span>
      </label>
    </div>
  );

  const planCard = (
    <>
      <Card className="mb-4 p-4">
        {program && programWeek ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-primary-text">
                  {programWeek.type === "deload" ? (
                    <Snowflake className="size-3.5" />
                  ) : (
                    <Flame className="size-3.5" />
                  )}
                  {t.generate.weekOf(
                    program.currentWeek + 1,
                    program.weeks.length,
                    programWeek.type === "deload",
                  )}
                </p>
                <p className="mt-1 truncate text-[17px] font-bold">
                  {t.generate.nextDay(programDayLabel)}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {program.name === splitTemplateById(program.templateId).label
                    ? program.name
                    : `${program.name} · ${splitTemplateById(program.templateId).label}`}
                </p>
                {programWeek.type === "deload" ? (
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    {t.generate.deloadExplain}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setProgramSheetOpen(true)}
                aria-label={t.generate.editProgram}
                className="tap-target flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Settings2 className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex gap-1">
              {program.weeks.map((w, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < program.currentWeek
                      ? "bg-primary/40"
                      : i === program.currentWeek
                        ? "bg-primary"
                        : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <RotationWeekStrip rotation={program} templateId={program.templateId} />
            <MissedSessionBanner
              kind="program"
              rotation={program}
              dayLabel={programDayLabel}
              onDoToday={startProgramDay}
            />

            <p className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t.generate.sessionLength}
            </p>
            {durationPicker}
            <button
              onClick={startProgramDay}
              className="glow mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95"
            >
              <Zap className="size-4" /> {t.generate.startDayType(programDayLabel)}
            </button>
            <button
              onClick={() => setAdjustWeekOpen(true)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-[13px] font-bold text-muted-foreground active:scale-95"
            >
              <CalendarClock className="size-3.5" /> {t.schedule.adjustWeek}
            </button>
          </>
        ) : weeklyScheme ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-text">
                  {splitTemplateById(weeklyScheme.templateId).label}
                </p>
                <p className="mt-1 truncate text-[17px] font-bold">
                  {t.generate.nextDay(scheduledDayLabel)}
                </p>
                {scheduledSlot ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t.generate.suggestedDay(
                      t.common.dow[plannedDate(weeklyScheme, weeklyScheme.cyclePosition).getDay()]!,
                    )}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setPlanSheetOpen(true)}
                aria-label={t.generate.editWeeklyPlan}
                className="tap-target flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Settings2 className="size-4" />
              </button>
            </div>

            <RotationWeekStrip rotation={weeklyScheme} templateId={weeklyScheme.templateId} />
            <MissedSessionBanner
              kind="weeklyScheme"
              rotation={weeklyScheme}
              dayLabel={scheduledDayLabel}
              onDoToday={startScheduledDay}
            />

            <p className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t.generate.sessionLength}
            </p>
            {durationPicker}
            <button
              onClick={startScheduledDay}
              className="glow mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95"
            >
              <Zap className="size-4" /> {t.generate.startDayType(scheduledDayLabel)}
            </button>
            <button
              onClick={() => setAdjustWeekOpen(true)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-[13px] font-bold text-muted-foreground active:scale-95"
            >
              <CalendarClock className="size-3.5" /> {t.schedule.adjustWeek}
            </button>
            <button
              onClick={() => setProgramSheetOpen(true)}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-[13px] font-bold text-muted-foreground active:scale-95"
            >
              <Flame className="size-3.5" /> {t.generate.buildProgramInstead}
            </button>
          </>
        ) : (
          <>
            {/* Text full width, the two choices side by side under it, like
                the cardio card's buttons below it: stacked beside the text
                they squeezed it to four lines. */}
            <p className="text-[16px] font-semibold">{t.generate.planYourTraining}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {t.generate.planYourTrainingDesc}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setPlanSheetOpen(true)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-2xl bg-muted text-[14px] font-bold text-secondary-foreground active:scale-95"
              >
                {t.generate.weeklyPlan}
              </button>
              <button
                onClick={() => setProgramSheetOpen(true)}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-2xl text-[14px] font-bold active:scale-95 ${chip.on}`}
              >
                {t.generate.program}
              </button>
            </div>
          </>
        )}
      </Card>
    </>
  );

  return (
    <Screen
      title={t.generate.title}
      fitWhenShort={tabbed && tab === "plan" && !planHere}
      toolbar={
        tabbed ? (
          <SegmentedTabs
            tabs={WORKOUT_TABS}
            value={tab}
            onChange={setTab}
            labels={t.generate.tabs}
          />
        ) : undefined
      }
    >
      {hydrated && activeWorkout ? (
        <Card className="mb-4 p-4 glow" onClick={() => navigate({ to: "/session" })}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-text">
                {t.generate.sessionInProgress}
              </p>
              <p className="mt-1 text-[17px] font-bold">
                {t.generate.sessionTitle(
                  activeWorkout.plan.length,
                  activeWorkout.completed_sets.length,
                )}
              </p>
            </div>
            <ChevronRight className="size-6 text-primary-text" />
          </div>
        </Card>
      ) : null}

      {/* My plan: the program or weekly plan, then this week's cardio (hidden
          while a split day's plan shows under the card, so its Start bar
          stays last on the page). */}
      {tabbed && tab === "plan" ? (
        <>
          {planCard}
          {planHere ? null : <CardioWeekCard compact />}
        </>
      ) : null}

      {/* Build your own: one row of one-tap starts, then the builder. */}
      {showBuilder ? (
        <>
          {hydrated && !activeWorkout && quickStarts.length > 0 ? (
            <>
              <div className="flex items-end justify-between gap-2">
                <SectionLabel>{t.generate.quickStart}</SectionLabel>
                {workoutTemplates.length ? (
                  <button
                    onClick={() => setTemplatesOpen(true)}
                    className="mb-1.5 text-[13px] font-semibold text-primary-text"
                  >
                    {t.common.manage}
                  </button>
                ) : null}
              </div>
              <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
                {quickStarts.map((q, i) => (
                  <button
                    key={q.key}
                    onClick={q.start}
                    className={`glass w-[14.5rem] shrink-0 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.985] ${
                      i === 0 ? "ring-1 ring-primary/50" : ""
                    }`}
                  >
                    <p
                      className={`flex items-center gap-1 truncate text-[11px] font-semibold uppercase tracking-wider ${
                        i === 0 ? "text-primary-text" : "text-muted-foreground"
                      }`}
                    >
                      {q.icon === "template" ? (
                        <Bookmark className="size-3 shrink-0" />
                      ) : (
                        <Repeat className="size-3 shrink-0" />
                      )}
                      <span className="truncate">{q.eyebrow}</span>
                    </p>
                    <p className="mt-1 truncate text-[15px] font-semibold">{q.title}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{q.detail}</p>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {tabbed ? null : <SectionLabel>{t.generate.buildYourOwn}</SectionLabel>}
          {/* Time, equipment and the two switches as one grouped list, like an
          iOS settings card, instead of four blocks. */}
          <Card className={`divide-y divide-border p-0 ${tabbed ? "mt-3" : ""}`}>
            <div className="px-4 py-3">{durationPicker}</div>
            <div className="flex items-center gap-2 py-2.5 pl-4 pr-2">
              {profiles.length > 1 ? (
                <div className="no-scrollbar -my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        haptic(12);
                        update({ activeProfileId: p.id });
                      }}
                      className={`tap-target min-h-[36px] shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold ${
                        p.id === profile.id ? chip.on : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{profile.name}</p>
              )}
              {/* The profile's own screen lists and edits the gear. */}
              <Link
                to="/equipment"
                aria-label={`${t.generate.editEquipment} · ${t.generate.equipmentSummary(profile.active_equipment_ids.length)}`}
                className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Settings2 className="size-4" />
              </Link>
            </div>
            <SwitchRow
              label={t.generate.supersets}
              desc={t.generate.supersetsDesc}
              ariaLabel={t.generate.enableSupersets}
              on={supersetsEnabled}
              onToggle={() => {
                haptic(12);
                update({ supersetsEnabled: !supersetsEnabled });
              }}
            />
            <SwitchRow
              label={t.generate.warmups}
              desc={t.generate.warmupsDesc}
              ariaLabel={t.generate.warmups}
              on={warmupsEnabled}
              onToggle={() => {
                haptic(12);
                update({ warmupsEnabled: !warmupsEnabled });
              }}
            />
          </Card>

          {hydrated && !weeklyScheme && !program && workouts.length > 0 && regions.length === 0 ? (
            <Card className="mt-3 p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold uppercase tracking-widest text-primary-text">
                    {t.generate.recommendedToday}
                  </p>
                  <p className="mt-1 text-[15px] leading-snug">
                    {recommended
                      .map((r) => t.generate.setsThisWeek(r.muscle, r.done, r.target))
                      .join(" · ")}
                  </p>
                </div>
                <button
                  onClick={applyRecommendation}
                  className="tap-target min-h-[36px] shrink-0 rounded-full bg-primary/10 px-3.5 text-[13px] font-bold text-primary-text ring-1 ring-inset ring-primary/50 active:scale-95"
                >
                  {t.generate.use}
                </button>
              </div>
            </Card>
          ) : null}

          <SectionLabel>{t.generate.muscleMap}</SectionLabel>

          {/* A pop-up pinned to the top of the screen, not a card in the page:
          in the page it pushed the map (and everything under it) down when it
          appeared and back up when dismissed. Above the sticky header (z-30),
          below sheets (z-50); only the banner itself takes taps. */}
          {proposalPair ? (
            <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4">
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto flex w-full max-w-xl animate-[banner-down_0.25s_ease-out] flex-col gap-2 rounded-2xl border p-3 motion-reduce:animate-none"
                style={{
                  // Solid: any translucency let the page title and cards
                  // underneath read through the sentence.
                  backgroundColor: "var(--background)",
                  borderColor: `color-mix(in oklch, ${SUGGESTED_COLOR} 55%, transparent)`,
                  boxShadow: `0 8px 28px oklch(0 0 0 / 30%), 0 0 24px color-mix(in oklch, ${SUGGESTED_COLOR} 25%, transparent)`,
                }}
              >
                {/* Sentence and ✕ on one row, Add on its own: side by side, the
                Dutch "+ Triceps toevoegen" squeezed the sentence to a word a line. */}
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 size-5 shrink-0" style={{ color: SUGGESTED_COLOR }} />
                  <p className="min-w-0 flex-1 pt-0.5 text-[13.5px] leading-snug">
                    {t.generate.pairSuggestion(
                      regionById(proposal!).label,
                      regionById(proposalPair.with).label,
                      proposalPair.relation.includes("·")
                        ? t.generate.pairSuggestionFor(proposalPair.relation.split("·")[1]!.trim())
                        : "",
                    )}
                  </p>
                  <button
                    onClick={() => setProposal(null)}
                    aria-label={t.generate.dismissSuggestion}
                    className="tap-target grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <button
                  onClick={acceptProposal}
                  className="tap-target flex min-h-[36px] items-center gap-1 self-end rounded-full px-3.5 text-[13px] font-bold"
                  style={{ backgroundColor: SUGGESTED_COLOR, color: "oklch(0.2 0.05 90)" }}
                >
                  <Plus className="size-3.5" strokeWidth={3} />
                  {t.generate.addMuscle(regionById(proposalPair.with).label)}
                </button>
              </div>
            </div>
          ) : null}

          <Card className="p-4">
            <AnatomyMap
              selected={regions}
              suggested={proposalPair?.with ?? null}
              onToggle={toggleRegion}
            />
          </Card>

          {focusGroups.length ? (
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                {t.generate.focusOptional}
              </p>
              <div className="space-y-2">
                {focusGroups.map(({ group, heads }) => (
                  <div key={group} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 shrink-0 text-[13px] font-semibold text-muted-foreground">
                      {group}
                    </span>
                    {heads.map((t) => {
                      const on = focus.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleFocus(t)}
                          className={`tap-target min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                            on ? chip.on : "glass text-secondary-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {muscles.length > 2 && !curatedSelection ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive-text" />
              <p className="text-[14px] leading-snug text-foreground">
                {t.generate.warningTooManyGroups}
              </p>
            </div>
          ) : null}

          {lovedExerciseIds.length ? (
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <Heart className="size-3.5 fill-current text-primary-text" />
                {t.generate.alwaysIncluded}
              </p>
              <div className="flex flex-wrap gap-2">
                {lovedExerciseIds.map((id) => {
                  const ex = exerciseById(id);
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        haptic(12);
                        toggleLovedExercise(id);
                      }}
                      className="tap-target flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary/10 px-3 text-[14px] font-semibold text-primary-text"
                    >
                      {ex?.name ?? id}
                      <X className="size-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Sticky: the form above is about three screens tall, so the button
          stays in reach just above the tab bar (whose pill top sits
          --tab-bar-clearance + 4rem up) until you scroll down to its place.
          Once a plan matches the selection, the Start bar below takes over. */}
          {/* Floats only once there's a selection to build from: before that,
          on a program user's first screen it was a second big green button
          under "Build Push day", covering the card it sat over. */}
          {planHere ? null : (
            <div
              className={`${regions.length || generating ? "sticky" : "static"} bottom-[calc(var(--tab-bar-clearance)+4.625rem)] z-20 mt-3`}
            >
              {regions.length || generating ? <div aria-hidden className="dock-backdrop" /> : null}
              <button
                onClick={generateOwn}
                disabled={generating}
                className="glow flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985] disabled:active:scale-100"
              >
                {generating ? (
                  <>
                    <DumbbellLoader size={26} className="text-primary-foreground" />
                    {t.generate.buildingSession}
                  </>
                ) : (
                  <>
                    <Zap className="size-5" />
                    {t.generate.generateWorkout}
                  </>
                )}
              </button>
            </div>
          )}
        </>
      ) : null}

      {planHere ? (
        <>
          <div
            ref={planRef}
            className="mb-1.5 mt-4 flex items-center justify-between gap-3 px-1"
            data-plan-header
          >
            <p className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t.generate.yourPlan(estimateMinutes(planHere), planHere.length)}
            </p>
            <button
              onClick={() => {
                haptic(12);
                setSavingTemplate(true);
              }}
              className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-primary-text"
            >
              <Bookmark className="size-3.5" /> {t.generate.save}
            </button>
          </div>
          <div className="space-y-2">
            {planHere.map((p, i) => {
              const ex = exerciseById(p.exercise_id);
              if (!ex) return null;
              const loved = lovedExerciseIds.includes(p.exercise_id);
              return (
                <Card key={`${p.exercise_id}-${i}`} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="tabular w-6 text-[17px] font-bold text-primary-text">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setInfoExercise(ex)}
                          aria-label={t.exercises.openExercise(ex.name)}
                          className="min-w-0 flex-1 text-left text-[17px] font-semibold leading-tight active:opacity-70"
                        >
                          {ex.name}
                        </button>
                        <button
                          onClick={() => {
                            haptic(12);
                            toggleLovedExercise(p.exercise_id);
                            setPlan((cur) =>
                              cur
                                ? cur.map((q) =>
                                    q.exercise_id === p.exercise_id ? { ...q, loved: !loved } : q,
                                  )
                                : cur,
                            );
                          }}
                          aria-label={loved ? t.generate.unlove(ex.name) : t.generate.love(ex.name)}
                          aria-pressed={loved}
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                            loved ? "text-primary-text" : "text-muted-foreground"
                          }`}
                        >
                          <Heart className={`size-4 ${loved ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <p
                        onClick={() => setInfoExercise(ex)}
                        className="mt-0.5 cursor-pointer text-[13px] text-muted-foreground"
                      >
                        {p.warmup_sets ? t.generate.warmupPrefix(p.warmup_sets) : ""}
                        {p.superset_group !== undefined
                          ? t.generate.supersetLabel(
                              p.superset_group,
                              p.superset_slot ?? "",
                              p.target_sets,
                            )
                          : t.generate.setsByReps(p.target_sets, p.target_reps)}{" "}
                        · {p.rest_seconds ? t.generate.restSuffix(p.rest_seconds) : ""}
                        {ex.muscle_targets[0] ?? ex.primary_muscle}
                      </p>
                      {p.suggested_weight != null &&
                      (p.suggested_weight !== 0 || isBodyweightExercise(ex)) ? (
                        <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-primary-text">
                          <TrendingUp className="size-3.5" />{" "}
                          {p.suggested_basis
                            ? t.generate.estimatedWeight(
                                formatLoad(p.suggested_weight, false, t.session.bw),
                                p.suggested_reps,
                                p.suggested_basis === "rough",
                              )
                            : t.generate.suggestedWeight(
                                formatLoad(
                                  p.suggested_weight,
                                  isBodyweightExercise(ex),
                                  t.session.bw,
                                ),
                                p.suggested_reps,
                              )}
                        </p>
                      ) : null}
                      {(() => {
                        // Your own numbers say heavier (startWeight.ts):
                        // only for a suggestion from this exercise's history.
                        if (p.suggested_basis || p.suggested_weight == null || !p.suggested_reps)
                          return null;
                        const hint = heavierHint(
                          ex,
                          workouts,
                          { weight: p.suggested_weight, reps: p.suggested_reps },
                          plateStep(ex, profile),
                        );
                        return hint ? (
                          <p className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-foreground">
                            <ArrowUp className="size-3.5 text-primary-text" />{" "}
                            {t.generate.couldGoHeavier(
                              formatLoad(hint.weight, false, t.session.bw),
                              hint.reps,
                            )}
                          </p>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={t.generate.moveUp}
                        className="tap-target flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === planHere.length - 1}
                        aria-label={t.generate.moveDown}
                        className="tap-target flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        onClick={() => setSwapIndex(i)}
                        aria-label={t.generate.swapExercise}
                        className="tap-target flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                      >
                        <Repeat className="size-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {/* Last on the page, so as a sticky element it stays pinned just
              above the tab bar from the top of the page to the bottom: Start
              is always one tap away once a plan is ready. */}
          <div className="sticky bottom-[calc(var(--tab-bar-clearance)+4.625rem)] z-20 mt-4 flex gap-2">
            <div aria-hidden className="dock-backdrop" />
            <button
              onClick={shuffle}
              className="glass-strong flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
              style={{ backgroundColor: "var(--background)" }}
            >
              <RefreshCw className="size-5" /> {t.generate.shuffle}
            </button>
            <button
              onClick={start}
              className="glow flex min-h-[52px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
            >
              <Play className="size-5" /> {t.generate.startWorkout}
            </button>
          </div>
        </>
      ) : null}

      {/* Without a plan, the offer to set one up and this week's cardio
          come after the builder, and not while a generated plan is showing
          above its Start bar. */}
      {hydrated && !hasPlan && !shownPlan ? (
        <div className="mt-6">
          <SectionLabel>{t.generate.thisWeek}</SectionLabel>
          {planCard}
          <CardioWeekCard compact />
        </div>
      ) : null}

      <ExerciseDetailSheet exercise={infoExercise} onClose={() => setInfoExercise(null)} />
      <SwapSheet
        exerciseId={swapIndex !== null ? (plan?.[swapIndex]?.exercise_id ?? null) : null}
        pairedExerciseId={(() => {
          const group = swapIndex !== null ? plan?.[swapIndex]?.superset_group : undefined;
          if (group === undefined) return null;
          return (
            plan?.find((p, i) => i !== swapIndex && p.superset_group === group)?.exercise_id ?? null
          );
        })()}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          setPlan((cur) =>
            cur
              ? cur.map((p, i) => {
                  if (i !== swapIndex) return p;
                  const {
                    suggested_weight: _dropped,
                    suggested_reps: _droppedReps,
                    suggested_basis: _droppedBasis,
                    ...rest
                  } = p;
                  const suggestion = suggestWeight(
                    ex.id,
                    workouts,
                    p.target_reps,
                    plateStep(ex, profile),
                    t.progression,
                    isBodyweightExercise(ex) ? latestBodyKg(weightLog, nutritionProfile) : null,
                  );
                  // Never done: a starting weight from a related exercise.
                  const estimate = suggestion
                    ? null
                    : crossEstimate(
                        ex,
                        withKnownLifts(workouts, knownLifts),
                        p.target_reps,
                        plateStep(ex, profile),
                      );
                  const pick = suggestion ?? estimate;
                  return {
                    ...rest,
                    exercise_id: ex.id,
                    ...(pick ? { suggested_weight: pick.weight, suggested_reps: pick.reps } : {}),
                    ...(estimate && estimate.basis !== "personal"
                      ? { suggested_basis: estimate.basis }
                      : {}),
                  };
                })
              : cur,
          );
          setSwapIndex(null);
          haptic(20);
        }}
      />

      <WeeklyPlanSheet open={planSheetOpen} onClose={() => setPlanSheetOpen(false)} />
      <ProgramBuilderSheet open={programSheetOpen} onClose={() => setProgramSheetOpen(false)} />
      <AdjustWeekSheet
        open={adjustWeekOpen}
        onClose={() => setAdjustWeekOpen(false)}
        kind={program ? "program" : "weeklyScheme"}
        onEditUsualDays={() => {
          setAdjustWeekOpen(false);
          if (program) setProgramSheetOpen(true);
          else setPlanSheetOpen(true);
        }}
      />
      <WorkoutTemplatesSheet
        open={templatesOpen || savingTemplate}
        onClose={() => {
          setTemplatesOpen(false);
          setSavingTemplate(false);
        }}
        draft={
          savingTemplate && shownPlan
            ? { plan: shownPlan, duration_minutes: duration, target_muscles: muscles }
            : null
        }
        onStart={startTemplate}
      />
    </Screen>
  );
}
