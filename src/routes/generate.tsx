import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
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
  Timer,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { AnatomyMap, SUGGESTED_COLOR } from "../components/gym/AnatomyMap";
import { DumbbellLoader } from "../components/gym/DumbbellLoader";
import { ProfileAvatar } from "../components/gym/ProfileAvatar";
import { ProgramBuilderSheet } from "../components/gym/ProgramBuilderSheet";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { SwapSheet } from "../components/gym/SwapSheet";
import { WeeklyPlanSheet } from "../components/gym/WeeklyPlanSheet";
import { WorkoutTemplatesSheet } from "../components/gym/WorkoutTemplatesSheet";
import { EQUIPMENT, MUSCLES, TARGET_MUSCLE_GROUP, exerciseById } from "../lib/gym/data";
import { estimateMinutes, generateWorkout } from "../lib/gym/generator";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../lib/gym/numericInput";
import {
  DEFAULT_REGION,
  PAIRINGS,
  REGIONS,
  musclesFromRegions,
  regionById,
  targetsFromRegions,
  type RegionId,
} from "../lib/gym/anatomy";
import { plateStep } from "../lib/gym/plates";
import { currentProgramWeek } from "../lib/gym/programs";
import { recommendedMuscles } from "../lib/gym/recommendations";
import { suggestWeight } from "../lib/gym/progression";
import { READINESS_LABELS, todaysCheckIn, type ReadinessScore } from "../lib/gym/readiness";
import { DOW_LABELS, musclesForSlot, splitDayLabel, splitTemplateById } from "../lib/gym/splits";
import { haptic, useGym } from "../lib/gym/store";
import type { Muscle, PlannedExercise, TargetMuscle } from "../lib/gym/types";

export const Route = createFileRoute("/generate")({
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
  const {
    profiles,
    activeProfileId,
    activeWorkout,
    workouts,
    update,
    startWorkout,
    hydrated,
    supersetsEnabled,
    lovedExerciseIds,
    toggleLovedExercise,
    avoidedExerciseIds,
    weeklyScheme,
    program,
    workoutTemplates,
    readinessLog,
    setTodayReadiness,
    avatarId,
  } = useGym();
  const [duration, setDuration] = useState(45);
  const [customInput, setCustomInput] = useState("45");
  const [regions, setRegions] = useState<RegionId[]>([]);
  const [proposal, setProposal] = useState<RegionId | null>(null);
  const [focus, setFocus] = useState<TargetMuscle[]>([]);
  const [plan, setPlan] = useState<PlannedExercise[] | null>(null);
  const [variation, setVariation] = useState(0);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [programSheetOpen, setProgramSheetOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [readinessEditing, setReadinessEditing] = useState(false);
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
  const targets: TargetMuscle[] = activeGroups.flatMap((g) => {
    const inGroup = regionTargets.filter((t) => TARGET_MUSCLE_GROUP[t] === g);
    const picked = inGroup.filter((t) => focus.includes(t));
    return picked.length ? picked : inGroup;
  });
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

  const toggleMuscle = (m: Muscle) => {
    const owned = REGIONS.filter((r) => r.muscle === m).map((r) => r.id);
    if (owned.some((id) => regions.includes(id))) {
      haptic(12);
      setCuratedSelection(false);
      setFollowingSchedule(false);
      setFollowingProgram(false);
      setRegions((cur) => cur.filter((id) => !owned.includes(id)));
      setProposal(null);
      return;
    }
    toggleRegion(DEFAULT_REGION[m]);
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

  const build = (nextVariation: number) => {
    haptic(25);
    setVariation(nextVariation);
    const week = followingProgram && program ? currentProgramWeek(program) : null;
    setPlan(
      generateWorkout({
        duration,
        equipment: profile.active_equipment_ids,
        targets,
        variation: nextVariation,
        supersets: supersetsEnabled,
        loved: lovedExerciseIds,
        avoided: avoidedExerciseIds,
        history: workouts,
        profile,
        ...(todayReadiness !== undefined ? { readinessScore: todayReadiness } : {}),
        ...(week ? { intensityMultiplier: week.intensity } : {}),
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

  // first press builds; pressing "Regenerate" again advances to a fresh pick
  const generate = () => {
    if (generating) return;
    haptic(15);
    setGenerating(true);
    const nextVariation = plan ? variation + 1 : 0;
    generateTimeoutRef.current = setTimeout(() => {
      build(nextVariation);
      setGenerating(false);
    }, 1500);
  };
  const shuffle = () => build(variation + 1);

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
  const recommended = recommendedMuscles(MUSCLES, workouts);
  const applyRecommendation = () => {
    haptic([20, 30]);
    setCuratedSelection(true);
    setFollowingSchedule(false);
    setFollowingProgram(false);
    setRegions(recommended.map((r) => DEFAULT_REGION[r.muscle]));
    setProposal(null);
  };

  const scheduledSlot = weeklyScheme?.schedule[weeklyScheme.cyclePosition];
  const scheduledDayLabel =
    weeklyScheme && scheduledSlot
      ? splitDayLabel(weeklyScheme.templateId, scheduledSlot.dayId)
      : "";

  const startScheduledDay = () => {
    if (!weeklyScheme || !scheduledSlot) return;
    haptic([20, 30]);
    setCuratedSelection(true);
    setFollowingSchedule(true);
    setFollowingProgram(false);
    const targetMuscles = musclesForSlot(weeklyScheme.templateId, scheduledSlot, workouts);
    setRegions(targetMuscles.map((m) => DEFAULT_REGION[m]));
    setProposal(null);
  };

  const programWeek = program ? currentProgramWeek(program) : null;
  const scheduledProgramSlot = program?.schedule[program.cyclePosition];
  const programDayLabel =
    program && scheduledProgramSlot
      ? splitDayLabel(program.templateId, scheduledProgramSlot.dayId)
      : "";

  const startProgramDay = () => {
    if (!program || !scheduledProgramSlot) return;
    haptic([20, 30]);
    setCuratedSelection(true);
    setFollowingSchedule(false);
    setFollowingProgram(true);
    const targetMuscles = musclesForSlot(program.templateId, scheduledProgramSlot, workouts);
    setRegions(targetMuscles.map((m) => DEFAULT_REGION[m]));
    setProposal(null);
  };

  const start = () => {
    if (!plan) return;
    haptic([20, 40, 20]);
    startWorkout({
      plan,
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

  return (
    <Screen
      title="Workout"
      subtitle="Build a session around today's constraints"
      action={
        <button
          onClick={() => {
            haptic(12);
            navigate({ to: "/settings" });
          }}
          aria-label="Settings"
          className="flex items-center justify-center rounded-full"
        >
          <ProfileAvatar avatarId={avatarId} size={40} />
        </button>
      }
    >
      {hydrated && activeWorkout ? (
        <Card className="mb-4 p-4 glow" onClick={() => navigate({ to: "/session" })}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                Session in progress
              </p>
              <p className="mt-1 text-lg font-bold">
                {activeWorkout.plan.length} exercises · {activeWorkout.completed_sets.length} sets
                logged
              </p>
            </div>
            <ChevronRight className="size-6 text-primary" />
          </div>
        </Card>
      ) : null}

      {hydrated && !activeWorkout && workouts.length > 0 ? (
        <div className="mb-4">
          <Card className="p-4 glow" onClick={() => repeat(workouts[0]!)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-primary">
                  <Repeat className="size-3.5" /> Repeat last workout
                </p>
                <p className="mt-1 truncate text-lg font-bold">
                  {workouts[0]!.target_muscles.join(" · ") || "Full body"}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {workouts[0]!.plan.length} exercises · ~{estimateMinutes(workouts[0]!.plan)} min
                </p>
              </div>
              <Play className="size-6 shrink-0 text-primary" />
            </div>
          </Card>
          {workouts.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
              {workouts.slice(1, 4).map((w) => (
                <button
                  key={w.id}
                  onClick={() => repeat(w)}
                  className="glass shrink-0 rounded-2xl px-4 py-2 text-left"
                >
                  <p className="text-[13px] font-semibold">
                    {w.target_muscles.join(" · ") || "Full body"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {w.completed_sets.filter((s) => s.set_type === "working").length} sets ·{" "}
                    {new Date(w.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hydrated && !activeWorkout ? (
        <div className="mb-4">
          <SectionLabel>Readiness</SectionLabel>
          <Card className="p-4">
            {todayCheckIn && !readinessEditing ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[28px] leading-none">
                    {READINESS_LABELS[todayCheckIn.score].emoji}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                      Today's readiness
                    </p>
                    <p className="mt-0.5 text-[16px] font-bold">
                      {READINESS_LABELS[todayCheckIn.score].label}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    haptic(12);
                    setReadinessEditing(true);
                  }}
                  className="min-h-[36px] shrink-0 rounded-full bg-secondary px-3.5 text-[13px] font-bold text-secondary-foreground active:scale-95"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[16px] font-semibold">
                  <Activity className="size-4 text-primary" /> How are you feeling today?
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  We'll nudge today's suggested weights to match.
                </p>
                <div className="mt-3 flex justify-between gap-1.5">
                  {([1, 2, 3, 4, 5] as ReadinessScore[]).map((score) => (
                    <button
                      key={score}
                      onClick={() => {
                        haptic([15, 25]);
                        setTodayReadiness(score);
                        setReadinessEditing(false);
                      }}
                      aria-label={READINESS_LABELS[score].label}
                      className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-muted text-center active:scale-95"
                    >
                      <span className="text-[22px] leading-none">
                        {READINESS_LABELS[score].emoji}
                      </span>
                      <span className="text-[10px] font-semibold leading-tight text-muted-foreground">
                        {READINESS_LABELS[score].label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      <SectionLabel>Available time</SectionLabel>
      <Card className="p-4">
        <div className="mb-3 flex justify-center gap-2 overflow-x-auto no-scrollbar">
          {SHORTCUTS.map((d) => (
            <button
              key={d}
              onClick={() => {
                haptic(12);
                setDuration(d);
                setCustomInput(String(d));
              }}
              className={`min-h-[44px] shrink-0 rounded-full px-5 text-[15px] font-semibold transition-colors ${
                duration === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {d}m
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
          <span className="text-[15px] font-semibold text-muted-foreground">Minutes</span>
          <input
            type="text"
            inputMode="numeric"
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
              const clamped = Math.max(
                5,
                Math.min(180, Math.round(parseDecimal(customInput) || 45)),
              );
              setDuration(clamped);
              setCustomInput(String(clamped));
            }}
            className="tabular h-11 w-full min-w-0 flex-1 rounded-xl bg-background px-3 text-center text-lg font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Timer className="size-4 text-primary" />
          {duration <= 30
            ? "Short session: heavy compounds, 60s rest, superset-friendly."
            : duration <= 45
              ? "Medium session: compounds plus a couple of accessories."
              : "Long session: warm-up, main lifts and full isolation work."}
        </p>
      </Card>

      <SectionLabel>Equipment profile</SectionLabel>
      <Card className="p-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                haptic(12);
                update({ activeProfileId: p.id });
              }}
              className={`min-h-[44px] shrink-0 rounded-full px-5 text-[15px] font-semibold ${
                p.id === profile.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          {profile.active_equipment_ids
            .map((id) => EQUIPMENT.find((e) => e.id === id)?.label)
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Card>

      <SectionLabel>{program ? "Your program" : "This week"}</SectionLabel>
      <Card className="mb-4 p-4">
        {program && programWeek ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-widest text-primary">
                  {programWeek.type === "deload" ? (
                    <Snowflake className="size-3.5" />
                  ) : (
                    <Flame className="size-3.5" />
                  )}
                  Week {program.currentWeek + 1} of {program.weeks.length}
                  {programWeek.type === "deload" ? " · Deload" : ""}
                </p>
                <p className="mt-1 truncate text-[18px] font-bold">Next: {programDayLabel}</p>
                <p className="text-[13px] text-muted-foreground">
                  {program.name} · {splitTemplateById(program.templateId).label}
                </p>
              </div>
              <button
                onClick={() => setProgramSheetOpen(true)}
                aria-label="Edit program"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
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

            <div className="mt-3 flex justify-between gap-1">
              {program.schedule.map((slot, i) => {
                const isNext = i === program.cyclePosition;
                const label = splitDayLabel(program.templateId, slot.dayId);
                return (
                  <div
                    key={i}
                    className={`min-w-0 flex-1 rounded-xl py-2 text-center ${
                      isNext ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        isNext ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {DOW_LABELS[slot.dow]}
                    </p>
                    <p className="truncate px-0.5 text-[11px] font-semibold">{label}</p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={startProgramDay}
              className="glow mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-95"
            >
              <Zap className="size-4" /> Start {programDayLabel} day
            </button>
          </>
        ) : weeklyScheme ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                  {splitTemplateById(weeklyScheme.templateId).label}
                </p>
                <p className="mt-1 truncate text-[18px] font-bold">Next: {scheduledDayLabel}</p>
                {scheduledSlot ? (
                  <p className="text-[13px] text-muted-foreground">
                    Suggested {DOW_LABELS[scheduledSlot.dow]}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => setPlanSheetOpen(true)}
                aria-label="Edit weekly plan"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Settings2 className="size-4" />
              </button>
            </div>

            <div className="mt-3 flex justify-between gap-1">
              {weeklyScheme.schedule.map((slot, i) => {
                const isNext = i === weeklyScheme.cyclePosition;
                const label = splitDayLabel(weeklyScheme.templateId, slot.dayId);
                return (
                  <div
                    key={i}
                    className={`min-w-0 flex-1 rounded-xl py-2 text-center ${
                      isNext ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        isNext ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {DOW_LABELS[slot.dow]}
                    </p>
                    <p className="truncate px-0.5 text-[11px] font-semibold">{label}</p>
                  </div>
                );
              })}
            </div>

            <button
              onClick={startScheduledDay}
              className="glow mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-95"
            >
              <Zap className="size-4" /> Start {scheduledDayLabel} day
            </button>
            <button
              onClick={() => setProgramSheetOpen(true)}
              className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-2xl bg-muted text-[13px] font-bold text-muted-foreground active:scale-95"
            >
              <Flame className="size-3.5" /> Build a program instead
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-semibold">Plan your training</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                A weekly split repeats forever; a program adds planned progression and a deload.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={() => setPlanSheetOpen(true)}
                className="min-h-[36px] rounded-full bg-secondary px-4 text-[13px] font-bold text-secondary-foreground active:scale-95"
              >
                Weekly plan
              </button>
              <button
                onClick={() => setProgramSheetOpen(true)}
                className="min-h-[36px] rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground active:scale-95"
              >
                Program
              </button>
            </div>
          </div>
        )}
      </Card>

      {hydrated && workoutTemplates.length > 0 ? (
        <div className="mb-4">
          <SectionLabel>Saved templates</SectionLabel>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {workoutTemplates.slice(0, 6).map((t) => (
              <button
                key={t.id}
                onClick={() => startTemplate(t.plan, t.duration_minutes, t.target_muscles)}
                className="glass shrink-0 rounded-2xl px-4 py-2 text-left active:scale-[0.985]"
              >
                <p className="text-[13px] font-semibold">{t.name}</p>
                <p className="text-[12px] text-muted-foreground">
                  {t.plan.length} exercises · ~{estimateMinutes(t.plan)} min
                </p>
              </button>
            ))}
            <button
              onClick={() => setTemplatesOpen(true)}
              className="glass shrink-0 rounded-2xl px-4 py-2 text-[13px] font-semibold text-primary active:scale-[0.985]"
            >
              Manage
            </button>
          </div>
        </div>
      ) : null}

      {hydrated && !weeklyScheme && !program && workouts.length > 0 && regions.length === 0 ? (
        <Card className="mb-4 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold uppercase tracking-widest text-primary">
                Recommended today
              </p>
              <p className="mt-1 text-[15px] leading-snug">
                {recommended
                  .map((r) =>
                    r.daysSince === null
                      ? `${r.muscle} (never trained)`
                      : `${r.muscle} (${r.daysSince}d ago)`,
                  )
                  .join(" · ")}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                These groups have gone longest without a working set.
              </p>
            </div>
            <button
              onClick={applyRecommendation}
              className="min-h-[36px] shrink-0 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground active:scale-95"
            >
              Use
            </button>
          </div>
        </Card>
      ) : null}

      <SectionLabel>Muscle map</SectionLabel>

      {proposalPair ? (
        <div
          role="alert"
          className="glass mb-3 animate-[sheet-up_0.25s_ease-out] rounded-2xl border p-3 shadow-xl backdrop-blur-xl"
          style={{
            borderColor: `color-mix(in oklch, ${SUGGESTED_COLOR} 55%, transparent)`,
            boxShadow: `0 0 24px color-mix(in oklch, ${SUGGESTED_COLOR} 25%, transparent)`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 shrink-0" style={{ color: SUGGESTED_COLOR }} />
            <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
              Pair <span className="font-bold">{regionById(proposal!).label}</span> with{" "}
              <span className="font-bold">{regionById(proposalPair.with).label}</span>
              {proposalPair.relation.includes("·")
                ? ` for a ${proposalPair.relation.split("·")[1]!.trim()}`
                : ""}
              ?
            </p>
            <button
              onClick={acceptProposal}
              className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-bold"
              style={{ backgroundColor: SUGGESTED_COLOR, color: "oklch(0.2 0.05 90)" }}
            >
              <Plus className="size-3.5" strokeWidth={3} />
              Add {regionById(proposalPair.with).label}
            </button>
            <button
              onClick={() => setProposal(null)}
              aria-label="Dismiss suggestion"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
            >
              <X className="size-4" />
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

      <SectionLabel>Target muscles</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {MUSCLES.map((m) => (
          <button
            key={m}
            onClick={() => toggleMuscle(m)}
            className={`min-h-[44px] rounded-full px-5 text-[15px] font-semibold transition-colors ${
              muscles.includes(m)
                ? "bg-primary text-primary-foreground"
                : "glass text-secondary-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {focusGroups.length ? (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
            Focus (optional) — narrow a group to specific heads
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
                      className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground"
                          : "glass text-secondary-foreground"
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
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-[14px] leading-snug text-foreground">
            Warning: Targeting more than 2 major muscle groups in a single session may reduce focus,
            increase system fatigue, and slow down strength progress.
          </p>
        </div>
      ) : null}

      {lovedExerciseIds.length ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Heart className="size-3.5 fill-current text-primary" />
            Always included
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
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary/15 px-3 text-[14px] font-semibold text-primary"
                >
                  {ex?.name ?? id}
                  <X className="size-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Supersets</p>
          <p className="text-[12.5px] text-muted-foreground">
            Pair exercises back-to-back, rounds set by intensity
          </p>
        </div>
        <button
          role="switch"
          aria-checked={supersetsEnabled}
          aria-label="Enable supersets"
          onClick={() => {
            haptic(12);
            update({ supersetsEnabled: !supersetsEnabled });
          }}
          className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
            supersetsEnabled ? "bg-primary" : "bg-secondary"
          }`}
        >
          <span
            className={`absolute top-[2px] size-[27px] rounded-full bg-foreground transition-all ${
              supersetsEnabled ? "left-[22px]" : "left-[2px]"
            }`}
          />
        </button>
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="glow mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground active:scale-[0.985] disabled:active:scale-100"
      >
        {generating ? (
          <>
            <DumbbellLoader size={26} className="text-primary-foreground" />
            Building your session…
          </>
        ) : (
          <>
            <Zap className="size-5" />
            {plan ? "Regenerate workout" : "Generate workout"}
          </>
        )}
      </button>

      {plan ? (
        <>
          <div className="mb-1.5 mt-4 flex items-center justify-between gap-3 px-1">
            <p className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
              Your plan · ~{estimateMinutes(plan)} min · {plan.length} exercises
            </p>
            <button
              onClick={() => {
                haptic(12);
                setSavingTemplate(true);
              }}
              className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-primary"
            >
              <Bookmark className="size-3.5" /> Save
            </button>
          </div>
          <div className="space-y-2">
            {plan.map((p, i) => {
              const ex = exerciseById(p.exercise_id);
              if (!ex) return null;
              const loved = lovedExerciseIds.includes(p.exercise_id);
              return (
                <Card key={`${p.exercise_id}-${i}`} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="tabular w-6 text-lg font-bold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 flex-1 text-[17px] font-semibold leading-tight">
                          {ex.name}
                        </p>
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
                          aria-label={loved ? `Unlove ${ex.name}` : `Love ${ex.name}`}
                          aria-pressed={loved}
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                            loved ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          <Heart className={`size-4 ${loved ? "fill-current" : ""}`} />
                        </button>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {p.warmup_sets ? `${p.warmup_sets} warm-up · ` : ""}
                        {p.superset_group !== undefined
                          ? `Superset ${p.superset_group}${p.superset_slot} · ${p.target_sets} rounds`
                          : `${p.target_sets} × ${p.target_reps}`}{" "}
                        · {p.rest_seconds ? `${p.rest_seconds}s rest · ` : ""}
                        {ex.muscle_targets[0] ?? ex.primary_muscle}
                      </p>
                      {p.suggested_weight ? (
                        <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-primary">
                          <TrendingUp className="size-3.5" /> Suggested {p.suggested_weight}kg
                          {p.suggested_reps ? ` × ${p.suggested_reps}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === plan.length - 1}
                        aria-label="Move down"
                        className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        onClick={() => setSwapIndex(i)}
                        aria-label="Swap exercise"
                        className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                      >
                        <Repeat className="size-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={shuffle}
              className="glass flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold"
            >
              <RefreshCw className="size-5" /> Shuffle
            </button>
            <button
              onClick={start}
              className="glow flex min-h-[56px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground active:scale-[0.985]"
            >
              <Play className="size-5" /> Start workout
            </button>
          </div>
        </>
      ) : null}

      <SwapSheet
        exerciseId={swapIndex !== null ? (plan?.[swapIndex]?.exercise_id ?? null) : null}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          setPlan((cur) =>
            cur
              ? cur.map((p, i) => {
                  if (i !== swapIndex) return p;
                  const { suggested_weight: _dropped, suggested_reps: _droppedReps, ...rest } = p;
                  const suggestion = suggestWeight(
                    ex.id,
                    workouts,
                    p.target_reps,
                    todayReadiness,
                    plateStep(ex, profile),
                  );
                  return {
                    ...rest,
                    exercise_id: ex.id,
                    ...(suggestion
                      ? { suggested_weight: suggestion.weight, suggested_reps: suggestion.reps }
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
      <WorkoutTemplatesSheet
        open={templatesOpen || savingTemplate}
        onClose={() => {
          setTemplatesOpen(false);
          setSavingTemplate(false);
        }}
        draft={
          savingTemplate && plan
            ? { plan, duration_minutes: duration, target_muscles: muscles }
            : null
        }
        onStart={startTemplate}
      />
    </Screen>
  );
}
