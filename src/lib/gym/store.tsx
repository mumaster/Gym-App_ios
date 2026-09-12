import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_PROFILES } from "./data";
import { DEFAULT_PLATES } from "./plates";
import type {
  AccentId,
  EquipmentProfile,
  LoggedSet,
  PlannedExercise,
  Unit,
  Workout,
} from "./types";

interface GymState {
  profiles: EquipmentProfile[];
  activeProfileId: string;
  workouts: Workout[];
  activeWorkout: Workout | null;
  unit: Unit;
  restSeconds: number;
  accent: AccentId;
  /** Hex color used when accent === "custom". */
  customAccent: string;
  supersetsEnabled: boolean;
  supersetRounds: number;
  /** Exercise ids the user "loved" — always forced into a generated plan. */
  lovedExerciseIds: string[];
  /** Rest-end audio cue during a session. */
  soundEnabled: boolean;
  /** When set, overrides every exercise's suggested rest for the active session. */
  restOverride: number | null;
}

const initialState: GymState = {
  profiles: DEFAULT_PROFILES,
  activeProfileId: DEFAULT_PROFILES[0]!.id,
  workouts: [],
  activeWorkout: null,
  unit: "kg",
  restSeconds: 90,
  accent: "green",
  customAccent: "#34d399",
  supersetsEnabled: false,
  supersetRounds: 3,
  lovedExerciseIds: [],
  soundEnabled: true,
  restOverride: null,
};

const KEY = "forge.gym.state.v2";
const LEGACY_KEY = "forge.gym.state.v1";

/** Re-derive `set_number` per exercise (warm-ups and working sets counted apart). */
function renumber(sets: LoggedSet[]): LoggedSet[] {
  const working = new Map<string, number>();
  const warmup = new Map<string, number>();
  return sets.map((s) => {
    const counter = s.set_type === "warmup" ? warmup : working;
    const n = (counter.get(s.exercise_id) ?? 0) + 1;
    counter.set(s.exercise_id, n);
    return s.set_number === n ? s : { ...s, set_number: n };
  });
}

/** Older saves may lack warmup_sets or carry a non-kg unit. */
function migrate(raw: Partial<GymState>): GymState {
  const fixPlan = (plan: PlannedExercise[] = []) =>
    plan.map((p) => ({ ...p, warmup_sets: p.warmup_sets ?? 0 }));
  const fixWorkout = <T extends Workout | null>(w: T): T =>
    w ? ({ ...w, unit: "kg", plan: fixPlan(w.plan) } as T) : w;

  const fixProfile = (p: EquipmentProfile): EquipmentProfile => ({
    ...p,
    plates: p.plates ?? { ...DEFAULT_PLATES },
    bar_weight: p.bar_weight ?? 20,
    dumbbell_bar_weight: p.dumbbell_bar_weight ?? 2,
  });

  const profiles = (raw.profiles?.length ? raw.profiles : DEFAULT_PROFILES).map(fixProfile);
  return {
    ...initialState,
    ...raw,
    unit: "kg",
    accent: raw.accent ?? "green",
    customAccent: raw.customAccent ?? "#34d399",
    supersetsEnabled: raw.supersetsEnabled ?? false,
    supersetRounds: raw.supersetRounds ?? 3,
    lovedExerciseIds: raw.lovedExerciseIds ?? [],
    soundEnabled: raw.soundEnabled ?? true,
    restOverride: raw.restOverride ?? null,
    profiles,
    activeProfileId:
      profiles.find((p) => p.id === raw.activeProfileId)?.id ?? profiles[0]?.id ?? "full-gym",
    workouts: (raw.workouts ?? []).map((w) => fixWorkout(w)!),
    activeWorkout: fixWorkout(raw.activeWorkout ?? null),
  };
}

interface Ctx extends GymState {
  hydrated: boolean;
  update: (patch: Partial<GymState>) => void;
  startWorkout: (input: Pick<Workout, "plan" | "duration_minutes" | "target_muscles">) => void;
  logSet: (set: LoggedSet) => void;
  updateSet: (
    index: number,
    patch: Partial<Pick<LoggedSet, "weight" | "reps" | "set_type">>,
  ) => void;
  removeSetAt: (index: number) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  reorderActivePlan: (from: number, to: number) => void;
  swapActiveExercise: (index: number, nextExerciseId: string) => void;
  appendBonusExercise: (exerciseId: string) => void;
  toggleLovedExercise: (exerciseId: string) => void;
  lastPerformance: (exerciseId: string) => LoggedSet | undefined;
  bestSet: (exerciseId: string) => LoggedSet | undefined;
}

const GymContext = createContext<Ctx | null>(null);

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GymState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) setState(migrate(JSON.parse(raw) as Partial<GymState>));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    Array.from(root.classList).forEach((c) => {
      if (c.startsWith("accent-")) root.classList.remove(c);
    });
    root.classList.add(`accent-${state.accent}`);
    if (state.accent === "custom") {
      root.style.setProperty("--custom-primary", state.customAccent);
    } else {
      root.style.removeProperty("--custom-primary");
    }
  }, [state.accent, state.customAccent]);

  const value = useMemo<Ctx>(() => {
    const allSets = (exerciseId: string) =>
      state.workouts.flatMap((w) => w.completed_sets).filter((s) => s.exercise_id === exerciseId);

    const withPlan = (s: GymState, plan: PlannedExercise[]): GymState =>
      s.activeWorkout ? { ...s, activeWorkout: { ...s.activeWorkout, plan } } : s;

    return {
      ...state,
      hydrated,
      update: (patch) => setState((s) => ({ ...s, ...patch })),
      startWorkout: (input) =>
        setState((s) => ({
          ...s,
          restOverride: null,
          activeWorkout: {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            duration_minutes: input.duration_minutes,
            target_muscles: input.target_muscles,
            plan: input.plan,
            completed_sets: [],
            finished: false,
            unit: "kg",
          },
        })),
      logSet: (set) =>
        setState((s) =>
          s.activeWorkout
            ? {
                ...s,
                activeWorkout: {
                  ...s.activeWorkout,
                  completed_sets: [...s.activeWorkout.completed_sets, set],
                },
              }
            : s,
        ),
      updateSet: (index, patch) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const sets = s.activeWorkout.completed_sets.map((x, i) =>
            i === index ? { ...x, ...patch } : x,
          );
          return {
            ...s,
            activeWorkout: { ...s.activeWorkout, completed_sets: renumber(sets) },
          };
        }),
      removeSetAt: (index) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const sets = s.activeWorkout.completed_sets.filter((_, i) => i !== index);
          return {
            ...s,
            activeWorkout: { ...s.activeWorkout, completed_sets: renumber(sets) },
          };
        }),
      finishWorkout: () =>
        setState((s) =>
          s.activeWorkout
            ? {
                ...s,
                workouts: [{ ...s.activeWorkout, finished: true }, ...s.workouts],
                activeWorkout: null,
              }
            : s,
        ),
      cancelWorkout: () => setState((s) => ({ ...s, restOverride: null, activeWorkout: null })),
      reorderActivePlan: (from, to) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = [...s.activeWorkout.plan];
          if (to < 0 || to >= plan.length || from < 0 || from >= plan.length) return s;
          const [moved] = plan.splice(from, 1);
          plan.splice(to, 0, moved!);
          return withPlan(s, plan);
        }),
      swapActiveExercise: (index, nextExerciseId) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = s.activeWorkout.plan.map((p, i) =>
            i === index ? { ...p, exercise_id: nextExerciseId } : p,
          );
          return withPlan(s, plan);
        }),
      appendBonusExercise: (exerciseId) =>
        setState((s) => {
          if (!s.activeWorkout) return s;
          const plan = [
            ...s.activeWorkout.plan,
            {
              exercise_id: exerciseId,
              target_sets: 3,
              warmup_sets: 0,
              target_reps: "8-12",
              rest_seconds: s.restSeconds,
              bonus: true,
            },
          ];
          return withPlan(s, plan);
        }),

      toggleLovedExercise: (exerciseId) =>
        setState((s) => ({
          ...s,
          lovedExerciseIds: s.lovedExerciseIds.includes(exerciseId)
            ? s.lovedExerciseIds.filter((id) => id !== exerciseId)
            : [...s.lovedExerciseIds, exerciseId],
        })),

      lastPerformance: (exerciseId) => allSets(exerciseId).slice(-1)[0],
      bestSet: (exerciseId) =>
        allSets(exerciseId).sort((a, b) => b.weight * b.reps - a.weight * a.reps)[0],
    };
  }, [state, hydrated]);

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym() {
  const ctx = useContext(GymContext);
  if (!ctx) throw new Error("useGym must be used inside GymProvider");
  return ctx;
}

export const haptic = (pattern: number | number[] = 30) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
};
