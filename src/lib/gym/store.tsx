import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_AVATAR_ID, type AvatarId } from "./avatars";
import { DEFAULT_PROFILES } from "./data";
import { DEFAULT_PLATES } from "./plates";
import {
  mealForTime,
  recipePerServing,
  type FoodEntry,
  type MealIngredient,
  type MealTemplate,
  type MealType,
  type NutritionGoals,
  type NutritionProfile,
  type Recipe,
  type WaterEntry,
} from "./nutrition";
import { estimated1RM } from "./progress";
import type { ReadinessCheckIn, ReadinessScore } from "./readiness";
import { dayKey } from "./date";
import { advanceProgram, type Program } from "./programs";
import type { WeeklyScheme } from "./splits";
import type {
  AccentId,
  ColorScheme,
  EquipmentProfile,
  Language,
  LoggedSet,
  Muscle,
  PlannedExercise,
  Unit,
  Workout,
  WorkoutTemplate,
} from "./types";
import {
  onAuthStateChange,
  pullCloudState,
  pushCloudState,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type Session,
} from "./auth";

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
  /** Light/dark mode. Defaults to "dark" — see the `initialState` assignment
   *  below for why "system" isn't the default despite being an option. */
  colorScheme: ColorScheme;
  /** UI display language. Defaults to "en" for the same reason colorScheme
   *  defaults to "dark" — the app only ever shipped in English until now,
   *  so a silent switch for anyone whose device happens to be set to Dutch
   *  would be a bigger surprise than just adding the option. */
  language: Language;
  /** Which character represents the user in the profile/settings icon. */
  avatarId: AvatarId;
  supersetsEnabled: boolean;
  supersetRounds: number;
  /** Exercise ids the user "loved" — always forced into a generated plan. */
  lovedExerciseIds: string[];
  /** Exercise ids the user is avoiding (injury, pain, dislike) — never generated or offered. */
  avoidedExerciseIds: string[];
  /** How-are-you-feeling check-ins, one per day, used to scale suggested weight. */
  readinessLog: ReadinessCheckIn[];
  /** Rest-end audio cue during a session. */
  soundEnabled: boolean;
  /** When set, overrides every exercise's suggested rest for the active session. */
  restOverride: number | null;
  /** Fire a system Notification when rest ends and the tab isn't focused. */
  notifyEnabled: boolean;
  /** The user's chosen weekly split, if they've set one up. */
  weeklyScheme: WeeklyScheme | null;
  /** The user's active multi-week program, if they've set one up — a
   *  bounded, progressing alternative to the indefinitely-repeating
   *  weeklyScheme, see lib/gym/programs.ts. Independent of weeklyScheme in
   *  state (both can exist), but the UI shows program info preferentially
   *  when both are present. */
  program: Program | null;
  /** Logged food, newest first. */
  foodEntries: FoodEntry[];
  /** Daily nutrition limits the user set for themselves — see NutritionGoalsSheet. */
  nutritionGoals: NutritionGoals;
  /** Last questionnaire answers used to suggest nutritionGoals, so reopening
   *  the questionnaire prefills instead of starting blank. Not itself used
   *  for anything besides that — editing nutritionGoals directly doesn't
   *  touch this. */
  nutritionProfile: NutritionProfile | null;
  /** Saved ingredient combos (e.g. "Banana oatmeal") the user can log in one tap. */
  mealTemplates: MealTemplate[];
  /** Named, reusable workout plans the user can start exactly as saved. */
  workoutTemplates: WorkoutTemplate[];
  /** Saved recipes (ingredients + serving count) — see lib/gym/nutrition.ts's Recipe. */
  recipes: Recipe[];
  /** Logged water, newest first. */
  waterEntries: WaterEntry[];
  /** Daily water target in ml, or null if the user hasn't set one. */
  waterGoalMl: number | null;
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
  // Defaults to the app's existing look rather than "system" — the app has
  // been dark-only until now, so a silent flip to light for anyone whose
  // device happens to be in light mode would be a bigger surprise than
  // just adding the option and leaving current behavior as the default.
  colorScheme: "dark",
  language: "en",
  avatarId: DEFAULT_AVATAR_ID,
  supersetsEnabled: false,
  supersetRounds: 3,
  lovedExerciseIds: [],
  avoidedExerciseIds: [],
  readinessLog: [],
  soundEnabled: true,
  restOverride: null,
  notifyEnabled: false,
  weeklyScheme: null,
  program: null,
  foodEntries: [],
  nutritionGoals: {},
  nutritionProfile: null,
  mealTemplates: [],
  workoutTemplates: [],
  recipes: [],
  waterEntries: [],
  waterGoalMl: null,
};

const KEY = "forge.gym.state.v2";
const LEGACY_KEY = "forge.gym.state.v1";

// Circuit breaker for the color-scheme effect's auto-reload-on-switch below
// (see that effect's own comment for the mechanism, and hasHydratedBaselineRef's
// comment for the infinite-reload-loop bug this specifically guards against
// a *recurrence* of). sessionStorage survives the reload it's guarding
// against — same property the RootShell stale-shell-recovery script
// elsewhere in this app already relies on for its own reload budget — so a
// genuine loop can be counted across reloads instead of resetting every time.
const COLOR_SCHEME_RELOAD_GUARD_KEY = "forge.color-scheme-reload-count";
const MAX_COLOR_SCHEME_AUTO_RELOADS = 2;

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
    colorScheme: raw.colorScheme ?? "dark",
    language: raw.language ?? "en",
    avatarId: raw.avatarId ?? DEFAULT_AVATAR_ID,
    supersetsEnabled: raw.supersetsEnabled ?? false,
    supersetRounds: raw.supersetRounds ?? 3,
    lovedExerciseIds: raw.lovedExerciseIds ?? [],
    avoidedExerciseIds: raw.avoidedExerciseIds ?? [],
    readinessLog: raw.readinessLog ?? [],
    soundEnabled: raw.soundEnabled ?? true,
    restOverride: raw.restOverride ?? null,
    notifyEnabled: raw.notifyEnabled ?? false,
    weeklyScheme: raw.weeklyScheme ?? null,
    program: raw.program ?? null,
    nutritionGoals: raw.nutritionGoals ?? {},
    nutritionProfile: raw.nutritionProfile ?? null,
    mealTemplates: raw.mealTemplates ?? [],
    workoutTemplates: raw.workoutTemplates ?? [],
    recipes: raw.recipes ?? [],
    waterEntries: raw.waterEntries ?? [],
    waterGoalMl: raw.waterGoalMl ?? null,
    foodEntries: (raw.foodEntries ?? []).map((e) => ({
      ...e,
      meal: e.meal ?? mealForTime(e.logged_at),
      per100: {
        ...e.per100,
        fiber: e.per100.fiber ?? 0,
        salt: e.per100.salt ?? 0,
      },
    })),
    profiles,
    activeProfileId:
      profiles.find((p) => p.id === raw.activeProfileId)?.id ?? profiles[0]?.id ?? "full-gym",
    workouts: (raw.workouts ?? []).map((w) => fixWorkout(w)!),
    activeWorkout: fixWorkout(raw.activeWorkout ?? null),
  };
}

export type SyncStatus = "offline" | "syncing" | "synced" | "error";

interface Ctx extends GymState {
  hydrated: boolean;
  /** Signed-in Supabase session, or null when using the app purely offline/local. */
  session: Session | null;
  syncStatus: SyncStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  update: (patch: Partial<GymState>) => void;
  startWorkout: (
    input: Pick<
      Workout,
      "plan" | "duration_minutes" | "target_muscles" | "fromScheduledDay" | "fromProgramDay"
    >,
  ) => void;
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
  toggleAvoidedExercise: (exerciseId: string) => void;
  setTodayReadiness: (score: ReadinessScore) => void;
  lastPerformance: (exerciseId: string) => LoggedSet | undefined;
  bestSet: (exerciseId: string) => LoggedSet | undefined;
  setWeeklyScheme: (scheme: WeeklyScheme) => void;
  updateScheduleSlotDow: (index: number, dow: number) => void;
  clearWeeklyScheme: () => void;
  setProgram: (program: Program) => void;
  updateProgramSlotDow: (index: number, dow: number) => void;
  clearProgram: () => void;
  saveWorkoutTemplate: (
    name: string,
    plan: PlannedExercise[],
    duration_minutes: number,
    target_muscles: Muscle[],
  ) => void;
  deleteWorkoutTemplate: (id: string) => void;
  addFoodEntry: (entry: FoodEntry) => void;
  updateFoodEntry: (
    id: string,
    patch: Partial<Pick<FoodEntry, "name" | "meal" | "grams" | "per100">>,
  ) => void;
  removeFoodEntry: (id: string) => void;
  setNutritionGoals: (goals: NutritionGoals) => void;
  saveMealTemplate: (name: string, ingredients: MealIngredient[]) => void;
  deleteMealTemplate: (id: string) => void;
  /** Logs every ingredient of a saved meal as its own food entry, all at once. */
  logMealTemplate: (id: string, meal: MealType) => void;
  saveRecipe: (name: string, servings: number, ingredients: MealIngredient[]) => void;
  deleteRecipe: (id: string) => void;
  /** Logs one food entry for `servings` servings of a saved recipe, scaled from its per-serving macros. */
  logRecipe: (id: string, servings: number, meal: MealType) => void;
  logWater: (ml: number) => void;
  removeWaterEntry: (id: string) => void;
}

const GymContext = createContext<Ctx | null>(null);

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GymState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressPush = useRef(false);
  // Tracks the last color-scheme resolution the effect below actually
  // applied, so it can tell a genuine switch (worth nudging the service
  // worker's cached shell and reloading — see that effect's own comment)
  // apart from a resolution that isn't really a user switch at all. Must
  // only start tracking once `hydrated` (below) is true — `state` (and so
  // `state.colorScheme`) starts at `initialState`'s hardcoded "dark"
  // default and only gets overwritten with the real persisted value
  // asynchronously, in the load-from-localStorage effect a few lines down.
  // Tracking from the very first render was a real, shipped bug: a
  // light-mode user's first render resolves dark=true (the default),
  // establishing that as the "baseline"; the localStorage effect then
  // corrects state.colorScheme to "light", which reads as a GENUINE
  // switch against that wrong baseline and fires the reload logic below —
  // on every single page load, including the reload it triggers, which
  // read the same hardcoded default first for exactly the same reason,
  // for an infinite reload loop that soft-locked the app for any
  // persisted light-mode user. `hasHydratedBaselineRef` below is what
  // fixes this: the baseline is only established the first time this
  // effect runs AFTER `hydrated` is true (see that effect's own guard),
  // by which point state.colorScheme already reflects the real persisted
  // value, not the pre-hydration placeholder.
  const lastAppliedDarkRef = useRef<boolean | null>(null);
  const hasHydratedBaselineRef = useRef(false);

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

  useEffect(() => onAuthStateChange(setSession), []);

  useEffect(() => {
    if (!session) setSyncStatus("offline");
  }, [session]);

  // On sign-in, reconcile this device against the cloud: an existing cloud
  // copy (signing into an account already used elsewhere) wins and replaces
  // local state; no cloud copy yet (first time this account syncs) means
  // this device's current local state becomes the initial cloud copy.
  useEffect(() => {
    if (!session || !hydrated) return;
    let cancelled = false;
    setSyncStatus("syncing");
    void (async () => {
      try {
        const cloud = await pullCloudState(session.user.id);
        if (cancelled) return;
        if (cloud) {
          suppressPush.current = true;
          setState(migrate(cloud as Partial<GymState>));
        } else {
          await pushCloudState(session.user.id, state);
        }
        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Reconcile only when the signed-in user changes, not on every edit —
    // the debounced push effect below covers ongoing local edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, hydrated]);

  // Mirror local edits up to the cloud (debounced) while signed in.
  useEffect(() => {
    if (!session || !hydrated) return;
    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }
    setSyncStatus("syncing");
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushCloudState(session.user.id, state)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    }, 1500);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, session, hydrated]);

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

  // Applies light/dark to <html> the same way the accent effect above
  // applies accent-<id> — RootShell SSRs `class="dark"` unconditionally
  // (no access to a stored preference at request time), so this corrects
  // it client-side once hydrated, same tradeoff the accent class already
  // makes (a possible one-frame flash of the wrong theme, not solved here
  // — see CLAUDE.md's Styling section for why that's an accepted gap
  // rather than something this reaches into RootShell's own SSR'd markup
  // to fix). "system" tracks the device live via matchMedia, updating the
  // class immediately if the user flips their OS setting while the app is
  // still open, without needing a reload.
  //
  // Also flips the two iOS-PWA chrome meta tags __root.tsx's head() SSRs
  // (apple-mobile-web-app-status-bar-style/theme-color), AND writes the
  // resolved scheme to a `forge-color-scheme` cookie so the NEXT request's
  // SSR can read it too — both parts are needed, for two different iOS
  // status-bar-related bugs that were reported in sequence. First: unlike
  // the <html> class above, nothing was updating these two meta tags'
  // live DOM content at all before this, so a light-mode user's actual
  // status bar (the real OS chrome, not page content) stayed a solid
  // black bar for the whole session — the direct DOM `setAttribute` calls
  // below fix that (confirmed via Playwright that this survives repeated
  // client-side route navigation without TanStack Router's HeadContent
  // reconciliation stomping it back). Second, reported after that fix:
  // even force-quitting and reopening the installed PWA still showed
  // black. That's because iOS reads apple-mobile-web-app-status-bar-style
  // straight from the SSR'd HTML at cold-launch time, before any of this
  // JS has had a chance to run — and __root.tsx's head() had no way to
  // know the user's preference at request time, so it always served the
  // same hardcoded dark value, every launch, forever. A client-side-only
  // fix structurally cannot reach back and change what iOS already read
  // from that response. The cookie write below closes that gap: it's the
  // one piece of this preference an HTTP request can actually carry back
  // to the server, so head() (see its own comment) can read it and bake
  // the correct value into the NEXT request's HTML from the start.
  useEffect(() => {
    const root = document.documentElement;
    const statusBarMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
    );
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const applyScheme = (dark: boolean) => {
      void applySchemeAsync(dark);
    };
    const applySchemeAsync = async (dark: boolean) => {
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      // "default" = white bar, black icons; "black" = black bar, white
      // icons — matches this app's own --background for each mode.
      statusBarMeta?.setAttribute("content", dark ? "black" : "default");
      // #f2f2f7 mirrors .light's --background choice below (iOS's own
      // light "systemGroupedBackground" rather than pure white).
      themeColorMeta?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
      // 1yr expiry: this is a durable preference, not a session value: no
      // `Secure` attribute so it still round-trips on a plain-http local
      // dev server, which every production deploy of this app is served
      // over https anyway (Cloudflare terminates TLS in front of it).
      document.cookie = `forge-color-scheme=${dark ? "dark" : "light"}; path=/; max-age=31536000; SameSite=Lax`;

      // Everything below only matters on a GENUINE switch, and — critically
      // — only once `hydrated` is true. Before that, state.colorScheme is
      // still `initialState`'s hardcoded "dark" default, not the real
      // persisted value, so resolving it here at all would establish the
      // WRONG baseline (see hasHydratedBaselineRef's own comment above for
      // the infinite-reload-loop bug that caused). The first post-hydration
      // run just establishes the correct baseline — no reload, since this
      // isn't a switch, it's the initial correct resolution.
      if (!hydrated) return;
      if (!hasHydratedBaselineRef.current) {
        hasHydratedBaselineRef.current = true;
        lastAppliedDarkRef.current = dark;
        // Reaching a stable post-hydration baseline without immediately
        // needing another reload means the last one (if any) actually
        // worked — clear the guard below so a later, unrelated switch
        // gets its own fresh budget instead of inheriting a stale count.
        try {
          sessionStorage.removeItem(COLOR_SCHEME_RELOAD_GUARD_KEY);
        } catch {
          /* private-mode/disabled storage — nothing to clear */
        }
        return;
      }
      const isGenuineChange = lastAppliedDarkRef.current !== dark;
      lastAppliedDarkRef.current = dark;
      if (!isGenuineChange) return;

      // Circuit breaker: cap how many times this effect will auto-reload
      // per (sessionStorage-scoped) session, regardless of how confident
      // the hydration-gating fix above is. If something we haven't
      // foreseen still causes a reload-triggering false positive right
      // after hydration, this stops it from looping forever again — the
      // DOM/cookie/meta updates above have already applied either way, so
      // the app itself keeps working even if this bails; only the OS
      // status bar might lag until the user relaunches on their own.
      let reloadCount = 0;
      try {
        reloadCount = Number(sessionStorage.getItem(COLOR_SCHEME_RELOAD_GUARD_KEY) ?? "0");
      } catch {
        /* private-mode/disabled storage — treat as 0, same as a fresh session */
      }
      if (reloadCount >= MAX_COLOR_SCHEME_AUTO_RELOADS) return;
      try {
        sessionStorage.setItem(COLOR_SCHEME_RELOAD_GUARD_KEY, String(reloadCount + 1));
      } catch {
        /* private-mode/disabled storage — nothing to persist, proceed anyway */
      }

      // A second, independent race the reload below exposed: while signed
      // in, local edits are pushed to the cloud on a 1.5s DEBOUNCE (the
      // "Mirror local edits up to the cloud" effect above), but a fresh
      // page load unconditionally PULLS the cloud copy and treats it as
      // authoritative the moment session+hydrated are both true (the
      // "reconcile against the cloud" effect above — its own comment says
      // "on sign-in," but it actually re-runs on every load where a
      // session already exists, since `hydrated` goes false→true on every
      // mount). Before this effect started reloading the page itself,
      // nothing else in the app ever navigated away within that 1.5s
      // window, so this race was latent and never actually observable.
      // Reported once it was: switching scheme while signed in reverted
      // right back to whatever the cloud still held, regardless of which
      // way the switch went — the reload was landing before the debounced
      // push ever reached Supabase, so the fresh load's own cloud pull
      // stomped the just-made local change straight back to the stale
      // cloud value. Fixed by pushing this render's state to the cloud
      // directly, bypassing the debounce, and awaiting it before
      // reloading — a 2s cap keeps a slow/failed push from blocking the
      // reload forever, since a stuck reload is worse than occasionally
      // still losing this particular race on a bad connection.
      if (session) {
        if (pushTimer.current) {
          clearTimeout(pushTimer.current);
          pushTimer.current = null;
        }
        try {
          await Promise.race([
            pushCloudState(session.user.id, state),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
        } catch {
          /* push failed — proceed with the reload anyway rather than
             getting stuck; the debounced push would have hit the same
             failure mode regardless. */
        }
      }

      // The classList toggle above already repaints the page's own content
      // instantly — that part was never the problem. The real OS status
      // bar chrome doesn't follow it: iOS 26+'s Liquid Glass tints it by
      // sampling the rendered page background (see this section's own
      // writeup above), and that sampling only happens at specific WebKit
      // lifecycle checkpoints — load being the one we can actually confirm,
      // since force-quit + reopen is confirmed correct. There's no public
      // API to ask WebKit to resample it mid-session; a speculative
      // scroll-position nudge (tried here previously) turned out not to
      // work in practice. A real navigation reload DOES hit that same
      // load-time checkpoint, though — it's architecturally the same
      // "fresh load of /" force-quit + reopen already is, just triggered
      // from live JS instead of the OS — so this reloads the page itself,
      // automatically, right after a genuine switch: as close to "reopen
      // the app for the user" as a running page can do to itself. No data
      // is at risk — GymState is already flushed to localStorage on every
      // change by the persistence effect above this one, and the switch
      // only ever happens from the Settings screen, never mid-workout.
      //
      // Reloading immediately would still race sw.js's PAGES_CACHE, which
      // doesn't get refreshed by this client-side switch on its own — an
      // immediate reload could still serve the OLD scheme's cached shell
      // once more. First attempt: ask the SW to refetch-and-recache "/"
      // before reloading. Reported in practice: still a one-frame flash of
      // the old scheme's status bar on reload — a fetch-and-recache is a
      // genuine network round trip, and "wait for that write to settle" as
      // a proxy for "the reload can't read stale content" turned out not
      // to be airtight. sw.js's handler now just deletes the cache entry
      // instead (see its own comment for why that's the actually-airtight
      // fix: a deleted entry forces the navigate handler onto a plain
      // network-only fetch, current cookie and all, with no cached branch
      // left to race against). This still waits for that handler's reply
      // over a dedicated MessageChannel before reloading — eviction is a
      // near-instant storage op, not a network fetch, so this wait is now
      // short and just prevents reloading before the delete has actually
      // landed — with a 1.5s safety timeout if the SW never responds
      // (offline, no controller yet, etc.), so a switch still eventually
      // reloads even then rather than silently doing nothing.
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        let reloaded = false;
        const reload = () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        };
        const channel = new MessageChannel();
        channel.port1.onmessage = reload;
        navigator.serviceWorker.controller.postMessage({ type: "forge:revalidate-shell" }, [
          channel.port2,
        ]);
        setTimeout(reload, 1500);
      } else {
        // No controlling SW yet (e.g. the very first load, before one's
        // registered) — nothing cached to be stale, so nothing to wait on.
        location.reload();
      }
    };

    if (state.colorScheme === "light") {
      applyScheme(false);
      return;
    }
    if (state.colorScheme === "dark") {
      applyScheme(true);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyScheme(media.matches);
    const onChange = (e: MediaQueryListEvent) => applyScheme(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
    // Deliberately scoped to colorScheme + hydrated only, same as the
    // reconcile-against-cloud effect above: this must NOT re-run on every
    // `state`/`session` change, only when the resolved scheme itself does
    // (or hydration completes) — `state` and `session` are read from the
    // closure purely for the cloud-flush-before-reload step inside
    // applySchemeAsync, which only fires on a genuine switch anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.colorScheme, hydrated]);

  const value = useMemo<Ctx>(() => {
    const allSets = (exerciseId: string) =>
      state.workouts.flatMap((w) => w.completed_sets).filter((s) => s.exercise_id === exerciseId);

    const withPlan = (s: GymState, plan: PlannedExercise[]): GymState =>
      s.activeWorkout ? { ...s, activeWorkout: { ...s.activeWorkout, plan } } : s;

    return {
      ...state,
      hydrated,
      session,
      syncStatus,
      signIn: authSignIn,
      signUp: authSignUp,
      signOut: authSignOut,
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
            fromScheduledDay: input.fromScheduledDay ?? false,
            fromProgramDay: input.fromProgramDay ?? false,
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
                // Only advance the split's rotation for the session it actually
                // scheduled — an off-schedule or repeated session shouldn't
                // silently skip the day that was really next.
                weeklyScheme:
                  s.weeklyScheme && s.activeWorkout.fromScheduledDay
                    ? {
                        ...s.weeklyScheme,
                        cyclePosition:
                          (s.weeklyScheme.cyclePosition + 1) % s.weeklyScheme.schedule.length,
                      }
                    : s.weeklyScheme,
                // Same "only advance the session that actually scheduled it"
                // guard as weeklyScheme above, mirrored for the program cursor.
                program:
                  s.program && s.activeWorkout.fromProgramDay
                    ? advanceProgram(s.program)
                    : s.program,
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
          const plan = s.activeWorkout.plan.map((p, i) => {
            if (i !== index) return p;
            const { suggested_weight: _dropped, ...rest } = p;
            return { ...rest, exercise_id: nextExerciseId };
          });
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
          avoidedExerciseIds: s.avoidedExerciseIds.filter((id) => id !== exerciseId),
        })),

      toggleAvoidedExercise: (exerciseId) =>
        setState((s) => ({
          ...s,
          avoidedExerciseIds: s.avoidedExerciseIds.includes(exerciseId)
            ? s.avoidedExerciseIds.filter((id) => id !== exerciseId)
            : [...s.avoidedExerciseIds, exerciseId],
          lovedExerciseIds: s.lovedExerciseIds.filter((id) => id !== exerciseId),
        })),

      setTodayReadiness: (score) =>
        setState((s) => {
          const key = dayKey(new Date().toISOString());
          const entry: ReadinessCheckIn = { date: new Date().toISOString(), score };
          const withoutToday = s.readinessLog.filter((c) => dayKey(c.date) !== key);
          return { ...s, readinessLog: [entry, ...withoutToday] };
        }),

      lastPerformance: (exerciseId) => allSets(exerciseId).slice(-1)[0],
      // Ranked by estimated 1RM (Epley) so "best set" agrees with the PR
      // definition used everywhere else (progress.ts, history) — it used to
      // rank by raw weight*reps, a third, different notion of "best".
      bestSet: (exerciseId) =>
        allSets(exerciseId).sort((a, b) => estimated1RM(b) - estimated1RM(a))[0],

      setWeeklyScheme: (scheme) => setState((s) => ({ ...s, weeklyScheme: scheme })),
      updateScheduleSlotDow: (index, dow) =>
        setState((s) => {
          if (!s.weeklyScheme) return s;
          const schedule = s.weeklyScheme.schedule.map((slot, i) =>
            i === index ? { ...slot, dow } : slot,
          );
          return { ...s, weeklyScheme: { ...s.weeklyScheme, schedule } };
        }),
      clearWeeklyScheme: () => setState((s) => ({ ...s, weeklyScheme: null })),

      setProgram: (program) => setState((s) => ({ ...s, program })),
      updateProgramSlotDow: (index, dow) =>
        setState((s) => {
          if (!s.program) return s;
          const schedule = s.program.schedule.map((slot, i) =>
            i === index ? { ...slot, dow } : slot,
          );
          return { ...s, program: { ...s.program, schedule } };
        }),
      clearProgram: () => setState((s) => ({ ...s, program: null })),

      saveWorkoutTemplate: (name, plan, duration_minutes, target_muscles) =>
        setState((s) => ({
          ...s,
          workoutTemplates: [
            { id: crypto.randomUUID(), name, plan, duration_minutes, target_muscles },
            ...s.workoutTemplates,
          ],
        })),
      deleteWorkoutTemplate: (id) =>
        setState((s) => ({
          ...s,
          workoutTemplates: s.workoutTemplates.filter((t) => t.id !== id),
        })),

      addFoodEntry: (entry) => setState((s) => ({ ...s, foodEntries: [entry, ...s.foodEntries] })),
      updateFoodEntry: (id, patch) =>
        setState((s) => ({
          ...s,
          foodEntries: s.foodEntries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeFoodEntry: (id) =>
        setState((s) => ({ ...s, foodEntries: s.foodEntries.filter((e) => e.id !== id) })),
      setNutritionGoals: (goals) => setState((s) => ({ ...s, nutritionGoals: goals })),

      saveMealTemplate: (name, ingredients) =>
        setState((s) => ({
          ...s,
          mealTemplates: [{ id: crypto.randomUUID(), name, ingredients }, ...s.mealTemplates],
        })),
      deleteMealTemplate: (id) =>
        setState((s) => ({
          ...s,
          mealTemplates: s.mealTemplates.filter((t) => t.id !== id),
        })),
      logMealTemplate: (id, meal) =>
        setState((s) => {
          const template = s.mealTemplates.find((t) => t.id === id);
          if (!template) return s;
          const now = new Date().toISOString();
          const entries: FoodEntry[] = template.ingredients.map((ing) => ({
            id: crypto.randomUUID(),
            name: ing.name,
            logged_at: now,
            meal,
            grams: ing.grams,
            per100: ing.per100,
          }));
          return { ...s, foodEntries: [...entries, ...s.foodEntries] };
        }),

      saveRecipe: (name, servings, ingredients) =>
        setState((s) => ({
          ...s,
          recipes: [{ id: crypto.randomUUID(), name, servings, ingredients }, ...s.recipes],
        })),
      deleteRecipe: (id) =>
        setState((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id) })),
      // A serving's macros are stored as a per100-style figure so this reuses
      // the exact same scaledMacros math every other food entry uses — grams
      // here is just `servings * 100`, not a real weight, purely to encode
      // "how many servings" through the existing grams/per100 shape rather
      // than adding a parallel one just for recipe-sourced entries.
      logRecipe: (id, servings, meal) =>
        setState((s) => {
          const recipe = s.recipes.find((r) => r.id === id);
          if (!recipe) return s;
          const entry: FoodEntry = {
            id: crypto.randomUUID(),
            name: recipe.name,
            logged_at: new Date().toISOString(),
            meal,
            grams: Math.round(Math.max(0, servings) * 100),
            per100: recipePerServing(recipe),
          };
          return { ...s, foodEntries: [entry, ...s.foodEntries] };
        }),

      logWater: (ml) =>
        setState((s) => ({
          ...s,
          waterEntries: [
            { id: crypto.randomUUID(), ml, logged_at: new Date().toISOString() },
            ...s.waterEntries,
          ],
        })),
      removeWaterEntry: (id) =>
        setState((s) => ({ ...s, waterEntries: s.waterEntries.filter((e) => e.id !== id) })),
    };
  }, [state, hydrated, session, syncStatus]);

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
