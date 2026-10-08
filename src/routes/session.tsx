import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  List,
  Minus,
  PartyPopper,
  Plus,
  Repeat,
  TrendingDown,
  TrendingUp,
  ArrowUp,
  Trophy,
  Undo2,
  Youtube,
  X,
  StickyNote,
  CornerDownRight,
  Bandage,
  Trash2,
} from "lucide-react";
import { BottomSheet } from "../components/gym/BottomSheet";
import { Confetti } from "../components/gym/Confetti";
import { HapticSwitch } from "../components/gym/HapticSwitch";
import { CARDIO_ICONS } from "../components/gym/cardioDisplay";
import { finisherCardioLog } from "../lib/gym/cardio";
import type { CardioFinisher } from "../lib/gym/types";
import { SwitchRow } from "../components/gym/SwitchRow";
import { SwapSheet } from "../components/gym/SwapSheet";
import { PlateHint } from "../components/gym/PlateHint";
import { SessionRpePicker } from "../components/gym/SessionRpePicker";
import { RecapShare } from "../components/gym/RecapShare";
import { exerciseById } from "../lib/gym/data";
import { antagonistLabel, isAntagonistPair } from "../lib/gym/antagonist";
import { availableExercises, estimateSeconds } from "../lib/gym/generator";
import { useTranslation } from "../lib/gym/i18n";
import {
  DECIMAL_INPUT_RE,
  SIGNED_DECIMAL_INPUT_RE,
  parseDecimal,
  selectOnFocus,
} from "../lib/gym/numericInput";
import { plateStep } from "../lib/gym/plates";
import { estimated1RM } from "../lib/gym/progress";
import { TARGET_RPE, rpeAdjustedWeight, suggestWeight } from "../lib/gym/progression";
import { crossEstimate, heavierHint, withKnownLifts, withRunning } from "../lib/gym/startWeight";
import {
  cancelRestNotification,
  ensurePushSubscription,
  scheduleRestNotification,
  syncRestNotificationCopy,
} from "../lib/gym/push";
import { playRestEndBeep, unlockAudio } from "../lib/gym/sound";
import { useRestTimer } from "../lib/gym/useRestTimer";
import { useWakeLock } from "../lib/gym/useWakeLock";
import { formatLoad, isBodyweightExercise, latestBodyKg } from "../lib/gym/load";
import { limbOf } from "../lib/gym/unilateral";
import { WARMUP_REPS, warmupFractions, warmupLoad } from "../lib/gym/warmup";
import {
  clearSessionResume,
  loadSessionResume,
  saveSessionResume,
  type SessionPos,
} from "../lib/gym/sessionResume";
import { haptic, useGym } from "../lib/gym/store";
import type { Exercise, LoggedSet, PlannedExercise, SetType } from "../lib/gym/types";
import { exerciseVideoUrl } from "../lib/gym/exerciseVideo";
import { ExerciseDetailSheet } from "../components/gym/ExerciseDetailSheet";
import { chip, button } from "../components/gym/ui";

export const Route = createFileRoute("/session")({
  head: () => ({
    meta: [
      { title: "Live Session — Forge" },
      {
        name: "description",
        content: "Focus-mode set logging, supersets and rest timers during your gym session.",
      },
      { property: "og:title", content: "Live Session — Forge" },
      {
        property: "og:description",
        content: "Single-exercise focus mode with superset rounds and automatic rest timers.",
      },
    ],
  }),
  component: SessionScreen,
});

interface Block {
  /** Plan indices belonging to this block (2 for a superset pair, else 1). */
  indices: number[];
  group?: number;
  rounds: number;
}

/** Space left between the sticky header and a card scrolled up to it. */
const CARD_GAP_PX = 12;

function buildBlocks(plan: PlannedExercise[]): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    const next = plan[i + 1];
    if (p.superset_group !== undefined && next?.superset_group === p.superset_group) {
      blocks.push({ indices: [i, i + 1], group: p.superset_group, rounds: p.target_sets });
      i++;
    } else {
      blocks.push({ indices: [i], rounds: p.target_sets });
    }
  }
  return blocks;
}

function SessionScreen() {
  const navigate = useNavigate();
  const t = useTranslation();
  const {
    activeWorkout,
    workouts,
    hydrated,
    update,
    finishWorkout,
    logCardio,
    updateActiveCardio,
    cancelWorkout,
    restSeconds,
    restOverride,
    soundEnabled,
    warmupsEnabled,
    notifyEnabled,
    swapActiveExercise,
    appendBonusExercise,
    moveActiveToEnd,
    rateWorkout,
    toggleAvoidedExercise,
    removeActivePlanEntries,
    profiles,
    activeProfileId,
    avoidedExerciseIds,
    removeSetAt,
    updateSet,
    weightLog,
    nutritionProfile,
  } = useGym();
  const bodyKg = latestBodyKg(weightLog, nutritionProfile);

  const [pos, setPos] = useState<SessionPos>({ block: 0, slot: 0, round: 1 });
  /** Plan indices whose target sets are done but that got "+ Extra set",
   *  which brings the entry form back. */
  const [extraSetFor, setExtraSetFor] = useState<number[]>([]);
  const addExtraSet = (index: number) => {
    haptic(10);
    setExtraSetFor((cur) => (cur.includes(index) ? cur : [...cur, index]));
  };
  /** What the rest bar says comes next ("Set 3 of 4", the next exercise). */
  const [restNext, setRestNext] = useState<string | null>(null);
  /** The block shown as a preview during the rest, set only on the rest
   *  after an exercise or superset is finished (not between sets or rounds). */
  const [restPreview, setRestPreview] = useState<number | null>(null);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  /** Exercise whose page is open (tapped its title). */
  const [infoExercise, setInfoExercise] = useState<Exercise | null>(null);
  /** Plan index whose "Hurts" sheet is open. */
  const [painIndex, setPainIndex] = useState<number | null>(null);
  /** "Keep going" on the time check hides it for the rest of the session. */
  const [overtimeDismissed, setOvertimeDismissed] = useState(false);
  const [celebrate, setCelebrate] = useState<"normal" | "big" | null>(null);
  const [finishedSummary, setFinishedSummary] = useState<PlannedExercise[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  /** The bottom dock (rest or finish panel). Only there while one of them
   *  is, so it's tracked as state for the height observer below. */
  const [navEl, setNavEl] = useState<HTMLElement | null>(null);
  const wasComplete = useRef(false);
  /** Where to move once the running rest finishes — a position rather than
   *  a callback, so it can be saved and survive the app being closed. */
  const afterRest = useRef<SessionPos | null>(null);

  // Keep the phone awake for the whole session (lifting benefits too).
  useWakeLock(true);

  // Elapsed time anchored to the real workout start, so leaving and returning
  // to the screen doesn't reset it.
  const startedAt = useMemo(
    () => new Date(activeWorkout?.date ?? Date.now()).getTime(),
    [activeWorkout?.date],
  );
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && setNowTs(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const elapsed = Math.max(0, Math.floor((nowTs - startedAt) / 1000));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  /** Brief pulse on the active card when rest ends, signalling it's time to lift. */
  const [cardFlash, setCardFlash] = useState(false);
  const flashActiveCard = useCallback(() => {
    setCardFlash(true);
    setTimeout(() => setCardFlash(false), 2200);
  }, []);

  /** True while a server push is scheduled for the current rest. */
  const pushScheduled = useRef(false);

  const rest = useRestTimer({
    onCountdownEnd: () => {
      haptic([60, 60, 120]);
      if (soundEnabled) playRestEndBeep();
      flashActiveCard();
      // The server-sent push (scheduled in startRest below) is now moot
      // either way — it already fired, or rest ended before it was due.
      void cancelRestNotification();
      // When the server push is scheduled it is the one notification (the
      // service worker shows it in the app language); the in-page one is
      // only the fallback, otherwise both would fire.
      if (
        notifyEnabled &&
        !pushScheduled.current &&
        document.visibilityState !== "visible" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(t.session.restCompleteNotifTitle, {
            body: t.session.restCompleteNotifBody,
            tag: "forge-rest",
          });
        } catch {
          /* some browsers restrict Notification outside a service worker */
        }
      }
    },
    onDismiss: () => {
      const target = afterRest.current;
      afterRest.current = null;
      setRestPreview(null);
      if (target) setPos(target);
    },
  });
  /** Rest Mode: countdown running, before the "rest complete" phase. */
  const resting = rest.phase === "counting";
  const restDone = rest.phase === "done";

  /** A failed push schedule is shown once per session, not on every rest:
   *  the in-app timer still works, and repeating the same error each rest
   *  only gets in the way. */
  const pushErrorShown = useRef(false);

  /** Starts the rest countdown and, if notifications are on, schedules the
   *  server-sent push that backs it up while the screen is off. */
  const startRest = useCallback(
    (seconds: number) => {
      rest.start(seconds);
      pushScheduled.current = false;
      if (notifyEnabled) {
        void scheduleRestNotification(seconds).then((result) => {
          pushScheduled.current = result.ok;
          if (result.ok) return;
          console.warn("scheduleRestNotification:", result.reason);
          if (pushErrorShown.current) return;
          pushErrorShown.current = true;
          setToast(t.session.pushNotScheduled(result.reason));
        });
      }
    },
    [rest, notifyEnabled, t.session],
  );

  // With notifications on, re-save this device's push subscription when the
  // session opens, so the server has a current one before the first rest
  // (the browser can rotate it, and the server drops one the push service
  // rejects). Silent: a rest that still can't be scheduled reports it.
  const subscriptionChecked = useRef(false);

  // Keep the service worker's push copy in the app's current language.
  useEffect(() => {
    void syncRestNotificationCopy(
      t.session.restCompleteNotifTitle,
      t.session.restCompleteNotifBody,
    );
  }, [t.session.restCompleteNotifTitle, t.session.restCompleteNotifBody]);
  useEffect(() => {
    if (
      notifyEnabled &&
      !subscriptionChecked.current &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      subscriptionChecked.current = true;
      void ensurePushSubscription();
    }
  }, [notifyEnabled]);

  // Cancel any pending server-sent notification for this device whenever the
  // session screen goes away (workout finished/cancelled/navigated off) —
  // otherwise a push could still land for a rest that's no longer running.
  useEffect(() => () => void cancelRestNotification(), []);

  // Pick up where the session was if the app was closed mid-workout: the
  // exercise/round, and a rest still counting (or one that ran out while
  // closed, which then moves on as it would have).
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    const id = activeWorkout?.id;
    if (!id || restoredFor.current === id) return;
    restoredFor.current = id;
    const saved = loadSessionResume(id);
    if (!saved) return;
    setPos(saved.pos);
    afterRest.current = saved.afterRest;
    setRestNext(saved.restNext);
    // A rest that moves to another block was the one after finishing a
    // block, so it had the preview.
    setRestPreview(
      saved.rest && saved.afterRest && saved.afterRest.block !== saved.pos.block
        ? saved.afterRest.block
        : null,
    );
    if (saved.rest) rest.resume(saved.rest.endsAt, saved.rest.duration);
  }, [activeWorkout?.id, rest]);

  useEffect(() => {
    const id = activeWorkout?.id;
    if (!id || restoredFor.current !== id) return;
    saveSessionResume({
      workoutId: id,
      pos,
      rest: rest.endsAt ? { endsAt: rest.endsAt, duration: rest.duration } : null,
      afterRest: rest.endsAt ? afterRest.current : null,
      restNext,
    });
  }, [activeWorkout?.id, pos, rest.endsAt, rest.duration, restNext]);

  const plan = useMemo(() => activeWorkout?.plan ?? [], [activeWorkout]);
  const blocks = useMemo(() => buildBlocks(plan), [plan]);

  /** Rest to use for a plan entry: the session override, else the exercise's own. */
  const restFor = useCallback(
    (planIdx: number) => {
      if (restOverride != null) return restOverride;
      const r = plan[planIdx]?.rest_seconds ?? 0;
      return r > 0 ? r : restSeconds;
    },
    [restOverride, plan, restSeconds],
  );

  const blockIndex = Math.min(pos.block, Math.max(0, blocks.length - 1));
  const block = blocks[blockIndex];
  const slot = block ? Math.min(pos.slot, block.indices.length - 1) : 0;
  const planIndex = block?.indices[slot] ?? 0;
  const planned = plan[planIndex];
  const isSuperset = (block?.indices.length ?? 1) > 1;

  const goToBlock = useCallback(
    (index: number) => {
      if (index < 0 || index >= blocks.length) return;
      haptic(15);
      setPos({ block: index, slot: 0, round: 1 });
    },
    [blocks.length],
  );

  /** Working sets already logged for a plan entry. */
  const loggedWorking = useCallback(
    (index: number) => {
      const p = plan[index];
      if (!p || !activeWorkout) return 0;
      return activeWorkout.completed_sets.filter(
        (s) => s.exercise_id === p.exercise_id && s.set_type === "working",
      ).length;
    },
    [plan, activeWorkout],
  );

  const blockDone =
    !!block && block.indices.every((i) => loggedWorking(i) >= (plan[i]?.target_sets ?? 0));

  /** Celebrate the moment the whole block (both superset halves) is finished. */
  useEffect(() => {
    if (blockDone && !wasComplete.current) haptic([30, 40, 30]);
    wasComplete.current = blockDone;
  }, [blockDone]);

  /** Bring the focused card's top just under the sticky header as focus
   *  moves (next exercise, superset partner, after a rest). Centring it, as
   *  before, put a card taller than the screen with its title hidden under
   *  the header. Exercise A of a superset lines up the same way rather than
   *  scrolling to the very top: the round label above it took room that
   *  pushed the Log set button under the bottom bar (reported). */
  useEffect(() => {
    const card = activeCardRef.current;
    if (!card) return;
    const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
    const cardTop = card.getBoundingClientRect().top + window.scrollY - headerBottom - CARD_GAP_PX;
    // On a smaller phone the card can be taller than the space between the
    // header and the bottom bar; then scroll on until Log set clears the
    // bar, since that's what you tap next (the title scrolls away instead).
    const log = card.querySelector<HTMLElement>("[data-log-set]");
    const navTop =
      document.querySelector("[data-session-dock]")?.getBoundingClientRect().top ??
      window.innerHeight;
    const logTop = log
      ? log.getBoundingClientRect().bottom + window.scrollY - (navTop - CARD_GAP_PX)
      : 0;
    // A finished exercise you jumped back to has "Next exercise" above it;
    // keep that in view too.
    const nextBtn = document.querySelector<HTMLElement>("[data-next-exercise]");
    const nextTop = nextBtn
      ? nextBtn.getBoundingClientRect().top + window.scrollY - headerBottom - CARD_GAP_PX
      : Infinity;
    const top = Math.min(nextTop, Math.max(cardTop, logTop));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [pos.block, pos.slot, pos.round]);

  /** The set that finishes the workout hides the entry form and brings up
   *  the finish panel, which left the page scrolled down to the form tips
   *  (reported). Bring the card's top back under the header, like moving
   *  to a new exercise does. Only on that moment: an extra set logged
   *  afterwards doesn't scroll again. */
  const workoutDone = blockDone && blockIndex >= blocks.length - 1;
  const wasWorkoutDone = useRef(workoutDone);
  useEffect(() => {
    const was = wasWorkoutDone.current;
    wasWorkoutDone.current = workoutDone;
    if (!workoutDone || was) return;
    // After the form is gone and the panel is up, so the page has its
    // final height.
    const id = requestAnimationFrame(() => {
      const card = activeCardRef.current;
      if (!card) return;
      const headerBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0;
      const top = card.getBoundingClientRect().top + window.scrollY - headerBottom - CARD_GAP_PX;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [workoutDone]);

  // The page keeps room to scroll its last content clear of the dock
  // while it's showing.
  const [navHeight, setNavHeight] = useState(0);
  useEffect(() => {
    if (!navEl || typeof ResizeObserver === "undefined") {
      setNavHeight(0);
      return;
    }
    const ro = new ResizeObserver(() => setNavHeight(navEl.offsetHeight));
    ro.observe(navEl);
    return () => ro.disconnect();
  }, [navEl]);

  // The finish screen replaces the session in place, so it would open at
  // the session's scroll position, with the effort rating above the fold.
  useLayoutEffect(() => {
    if (finishedSummary) window.scrollTo({ top: 0, behavior: "instant" });
  }, [finishedSummary]);

  if (!hydrated) return <div className="min-h-[100dvh] bg-background" />;

  if (finishedSummary) {
    const summaryProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
    const uniqueIds = Array.from(new Set(finishedSummary.map((p) => p.exercise_id)));
    // The session that just ended is the newest workout once the finish commits.
    const finishedWorkout = workouts[0];
    return (
      <div className="safe-top min-h-[100dvh] bg-background px-4 pb-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="flex flex-col items-center gap-2 pb-6 pt-10 text-center">
            <Trophy className="size-10 text-primary-text" />
            <h1 className="text-[26px] font-bold">{t.session.workoutComplete}</h1>
            <p className="text-[14px] text-muted-foreground">{t.session.workoutCompleteSub}</p>
          </div>
          {finishedWorkout ? (
            <div className="glass mb-4 space-y-2 rounded-2xl p-4">
              <p className="text-[15px] font-semibold">{t.trainingLoad.question}</p>
              <SessionRpePicker
                value={finishedWorkout.session_rpe}
                onChange={(n) => rateWorkout(finishedWorkout.id, n)}
              />
              <p className="text-[12px] text-muted-foreground">{t.trainingLoad.rateHint}</p>
            </div>
          ) : null}
          {finishedWorkout ? (
            <div className="mb-6">
              <RecapShare workout={finishedWorkout} />
            </div>
          ) : null}
          <div className="space-y-2">
            {uniqueIds.map((id) => {
              const ex = exerciseById(id);
              const plannedEntry = finishedSummary.find((p) => p.exercise_id === id);
              if (!ex || !plannedEntry) return null;
              const step = plateStep(ex, summaryProfile);
              const bw = isBodyweightExercise(ex);
              const suggestion = suggestWeight(
                id,
                workouts,
                plannedEntry.target_reps,
                step,
                t.progression,
                bw ? bodyKg : null,
              );
              return (
                <div key={id} className="glass rounded-2xl p-3">
                  <p className="text-[15px] font-semibold">{ex.name}</p>
                  {suggestion ? (
                    <p className="text-[13px] text-muted-foreground">
                      {t.session.nextTime(
                        formatLoad(suggestion.weight, bw, t.session.bw),
                        suggestion.reps,
                        suggestion.reason,
                      )}
                    </p>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      {t.session.loggedNoSuggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate({ to: "/history" })}
            className={`${button.primary} mt-6 w-full`}
          >
            {t.session.viewHistory}
          </button>
        </div>
      </div>
    );
  }

  if (!activeWorkout || !planned || !block) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-[17px] font-semibold">{t.session.noActiveSession}</p>
        <button onClick={() => navigate({ to: "/generate" })} className={`${button.primary}`}>
          {t.session.buildAWorkout}
        </button>
      </div>
    );
  }

  const totalSets = plan.reduce((n, p) => n + p.target_sets, 0);
  // Working sets logged, each exercise counted up to its target, against
  // the planned working sets (it used to count warm-ups and extra sets too).
  const done = plan.reduce((n, p, i) => n + Math.min(loggedWorking(i), p.target_sets), 0);
  const workingDone = activeWorkout.completed_sets.filter(
    (s) => s.exercise_id === planned.exercise_id && s.set_type === "working",
  ).length;
  const exerciseComplete = workingDone >= planned.target_sets;
  const blockComplete = blockDone;
  const isLastBlock = blockIndex >= blocks.length - 1;
  /** Whether the current exercise's entry form is showing (not yet done,
   *  or "+ Extra set" was tapped). */
  const formOpenHere = !exerciseComplete || extraSetFor.includes(planIndex);
  const totalVolume = activeWorkout.completed_sets.reduce((v, s) => v + s.weight * s.reps, 0);
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const planIds = new Set(plan.map((p) => p.exercise_id));
  const bonusOptions = availableExercises(profile.active_equipment_ids, avoidedExerciseIds).filter(
    (e) => !planIds.has(e.id),
  );

  // Time check: projected finish = time so far + the generator's own
  // estimate for what's left (estimateSeconds — the model the planned
  // length was fitted with). No fixed "minutes over" threshold: it shows
  // once the projection passes the length the user chose, offering to drop
  // the last exercise not started yet (an accessory where possible).
  const overtime = (() => {
    if (!activeWorkout || overtimeDismissed || !block) return null;
    const warmDone = (id: string) =>
      activeWorkout.completed_sets.filter((x) => x.exercise_id === id && x.set_type === "warmup")
        .length;
    const remaining = plan
      .map((p, i) => ({
        ...p,
        target_sets: Math.max(0, p.target_sets - loggedWorking(i)),
        warmup_sets: warmupsEnabled ? Math.max(0, p.warmup_sets - warmDone(p.exercise_id)) : 0,
      }))
      .filter((p) => p.target_sets > 0);
    const projected = Math.round(elapsed / 60 + estimateSeconds(remaining) / 60);
    const plannedMin = activeWorkout.duration_minutes;
    if (projected <= plannedMin) return null;
    const unstarted = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b, i }) => i > blockIndex && b.indices.every((x) => loggedWorking(x) === 0));
    const isAccessory = ({ b }: { b: Block }) =>
      b.indices.every((x) => !exerciseById(plan[x]!.exercise_id)?.compound);
    const pick = [...unstarted].reverse().find(isAccessory) ?? unstarted.at(-1);
    if (!pick) return null;
    const saves = Math.max(
      1,
      Math.round(estimateSeconds(pick.b.indices.map((x) => plan[x]!)) / 60),
    );
    const name = exerciseById(plan[pick.b.indices[0]!]!.exercise_id)?.name ?? "";
    return { projected, plannedMin, indices: pick.b.indices, saves, name };
  })();

  const upNext = (() => {
    const nextBlock = blocks[blockIndex + 1];
    if (!nextBlock) return null;
    const ex = exerciseById(plan[nextBlock.indices[0]!]!.exercise_id);
    return ex ? ex.name : null;
  })();

  /** Antagonist-aware label for the superset status badge. */
  const supersetBadge = (() => {
    if (!isSuperset) return "";
    const a = exerciseById(plan[block.indices[0]!]!.exercise_id);
    const b = exerciseById(plan[block.indices[1]!]!.exercise_id);
    if (a && b && isAntagonistPair(a, b))
      return t.session.supersetAntagonist(antagonistLabel(a, b));
    return t.session.supersetSlot(slot + 1);
  })();

  /** When swapping inside a superset, the other half of the pair. */
  const swapPartnerId = (() => {
    if (swapIndex === null || !isSuperset) return null;
    const other = block.indices.find((i) => i !== swapIndex);
    return other === undefined ? null : (plan[other]?.exercise_id ?? null);
  })();

  /** Automatically extends the session with an exercise matching today's target muscles. */
  const addBonus = () => {
    const onTarget = bonusOptions.filter((e) =>
      activeWorkout.target_muscles.includes(e.primary_muscle),
    );
    const pool = onTarget.length ? onTarget : bonusOptions;
    if (!pool.length) return;
    haptic(20);
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    appendBonusExercise(pick.id);
    setPos({ block: blocks.length, slot: 0, round: 1 });
  };

  const endWorkout = () => {
    haptic([30, 50, 30]);
    setCelebrate(plan.some((p) => p.bonus) ? "big" : "normal");
    const planSnapshot = plan;
    const cardio = activeWorkout.cardio;
    setTimeout(() => {
      clearSessionResume();
      const log = cardio
        ? finisherCardioLog(cardio, new Date(), t.cardio.activities[cardio.activity])
        : null;
      if (log) logCardio(log);
      finishWorkout();
      setFinishedSummary(planSnapshot);
    }, 1800);
  };

  const requestCancelWorkout = () => {
    haptic(15);
    setListOpen(false);
    setCancelConfirmOpen(true);
  };

  const toggleNotify = async () => {
    if (typeof Notification === "undefined") {
      setToast(t.session.notificationsUnsupported);
      return;
    }
    if (notifyEnabled) {
      update({ notifyEnabled: false });
      return;
    }
    if (Notification.permission === "denied") {
      setToast(t.session.notificationsBlocked);
      return;
    }
    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      update({ notifyEnabled: true });
      // Backs the in-app timer with a server-sent push so rest completion
      // still notifies with the screen locked. Not fatal if this fails (e.g.
      // Web Push isn't available outside a Home-Screen-installed PWA) — the
      // in-app cues still work either way — but surface why, since a silent
      // failure here is otherwise impossible to diagnose from outside.
      subscriptionChecked.current = true;
      const result = await ensurePushSubscription();
      if (!result.ok) setToast(t.session.pushSetupFailed(result.reason));
    } else setToast(t.session.notificationsNotAllowed);
  };

  const confirmCancelWorkout = () => {
    haptic([40, 60, 40]);
    setCancelConfirmOpen(false);
    clearSessionResume();
    cancelWorkout();
    navigate({ to: "/" });
  };

  /** Superset-aware transition after a working set is logged in a given slot. */
  const handleLogged = (setType: SetType, loggedSlot: number) => {
    if (setType !== "working") return;
    if (!isSuperset) {
      const willComplete = loggedWorking(planIndex) + 1 >= (planned?.target_sets ?? 0);
      afterRest.current =
        willComplete && blockIndex < blocks.length - 1
          ? { block: blockIndex + 1, slot: 0, round: 1 }
          : null;
      // The set that completes the last exercise ends the workout: no rest
      // (nothing is left to rest for), the finish panel takes over.
      if (
        blockIndex === blocks.length - 1 &&
        loggedWorking(planIndex) + 1 === (planned?.target_sets ?? 0)
      ) {
        setRestNext(null);
        return;
      }
      setRestPreview(willComplete && blockIndex < blocks.length - 1 ? blockIndex + 1 : null);
      setRestNext(
        !willComplete
          ? t.session.restNextSet(loggedWorking(planIndex) + 2, planned?.target_sets ?? 0)
          : upNext
            ? t.session.restNextExercise(upNext)
            : null,
      );
      startRest(restFor(planIndex));
      return;
    }

    // Counts including the set that was just logged.
    const remaining = (s: number) =>
      (plan[block.indices[s]!]?.target_sets ?? 0) -
      (loggedWorking(block.indices[s]!) + (s === loggedSlot ? 1 : 0));

    const other = loggedSlot === 0 ? 1 : 0;

    // Straight into the partner exercise — no rest between A and B.
    if (loggedSlot === 0 && remaining(other) > 0) {
      const bEx = exerciseById(plan[block.indices[1]!]!.exercise_id);
      setToast(t.session.straightInto(bEx?.name ?? t.session.exerciseBFallback));
      setPos((p) => ({ ...p, slot: 1 }));
      return;
    }

    const nextSlot = remaining(0) > 0 ? 0 : remaining(1) > 0 ? 1 : -1;
    // Same as above: the set that completes the last superset ends the
    // workout without a rest.
    if (nextSlot === -1 && remaining(loggedSlot) === 0 && blockIndex === blocks.length - 1) {
      afterRest.current = null;
      setRestNext(null);
      return;
    }
    const nextSlotName =
      nextSlot >= 0 ? exerciseById(plan[block.indices[nextSlot]!]!.exercise_id)?.name : upNext;
    setRestNext(nextSlotName ? t.session.restNextExercise(nextSlotName) : null);
    setRestPreview(nextSlot < 0 && blockIndex < blocks.length - 1 ? blockIndex + 1 : null);
    afterRest.current =
      nextSlot >= 0
        ? { block: blockIndex, slot: nextSlot, round: pos.round + 1 }
        : blockIndex < blocks.length - 1
          ? { block: blockIndex + 1, slot: 0, round: 1 }
          : null;
    // The pair rest lives on slot B.
    startRest(restFor(block.indices[block.indices.length - 1]!));
  };

  /** From the "Hurts" sheet: close it, optionally put the exercise on the
   *  avoid list (the generator and swap sheet already skip those), then
   *  open the swap sheet for it — one sheet at a time. */
  const painSwap = (avoid: boolean) => {
    if (painIndex === null) return;
    const id = plan[painIndex]?.exercise_id;
    if (avoid && id && !avoidedExerciseIds.includes(id)) toggleAvoidedExercise(id);
    const index = painIndex;
    setPainIndex(null);
    setSwapIndex(index);
  };

  /** "Do later" (a machine is taken): the current exercise — both halves of
   *  a superset — moves to the end, and the next one comes up in its place. */
  const doLater = () => {
    if (!block) return;
    haptic(15);
    const name = exerciseById(plan[block.indices[0]!]!.exercise_id)?.name ?? "";
    moveActiveToEnd(block.indices);
    setPos({ block: blockIndex, slot: 0, round: 1 });
    setToast(t.session.movedToEnd(name));
  };

  /** Undo from the rest bar: removes the set that started this rest and
   *  stops the rest silently, without advancing to the next exercise. */
  const undoLastSet = () => {
    if (!activeWorkout?.completed_sets.length) return;
    haptic(20);
    afterRest.current = null;
    rest.cancel();
    void cancelRestNotification();
    removeSetAt(activeWorkout.completed_sets.length - 1);
    setRestNext(null);
    setRestPreview(null);
  };

  /** The set that started this rest, rated from the rest panel. */
  const lastSet = activeWorkout?.completed_sets[activeWorkout.completed_sets.length - 1];
  const lastSetIsWorking = lastSet?.set_type === "working";

  const extendRest = () => {
    haptic(10);
    rest.extend(30);
    if (notifyEnabled) {
      void scheduleRestNotification(rest.secondsLeft + 30).then((result) => {
        pushScheduled.current = result.ok;
      });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header
        ref={headerRef}
        className={`safe-top glass-strong sticky top-0 z-30 border-x-0 border-t-0 border-b-0 transition-[filter] duration-300 ${
          resting ? "brightness-[0.7]" : ""
        }`}
      >
        {/* One compact row: the muscles moved out (the card names the
            exercise; the overview lists the rest), and the progress bar is a
            hairline along the header's bottom edge. */}
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pb-1.5">
          <button
            onClick={() => navigate({ to: "/" })}
            className="glass tap-target flex size-9 shrink-0 items-center justify-center rounded-full"
            aria-label={t.session.closeSession}
          >
            <X className="size-4" />
          </button>
          <p className="tabular min-w-0 flex-1 truncate text-center leading-none">
            <span className="text-[20px] font-bold">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </span>
            <span className="ml-2 text-[13px] font-semibold text-muted-foreground">
              {t.session.setsOfTotal(done, totalSets)}
            </span>
          </p>
          <button
            onClick={() => setListOpen(true)}
            aria-label={`${t.session.workoutOverview} · ${t.common.ofTotal(blockIndex + 1, blocks.length)}`}
            className="glass tap-target flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3"
          >
            <List className="size-4 text-primary-text" />
            <span className="tabular text-[13px] font-semibold">
              {blockIndex + 1}/{blocks.length}
            </span>
          </button>
        </div>
        <div
          className="h-[3px] bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSets}
          aria-valuenow={done}
          aria-label={t.session.setsOfTotal(done, totalSets)}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${Math.min(100, (done / Math.max(1, totalSets)) * 100)}%` }}
          />
        </div>
      </header>

      {toast ? (
        <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-2">
          <div className="glass-strong mt-16 rounded-2xl bg-primary/20 px-5 py-3 text-center text-[15px] font-bold text-foreground shadow-[var(--shadow-float)]">
            {toast}
          </div>
        </div>
      ) : null}

      <main
        className="mx-auto w-full max-w-xl space-y-3 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
        style={navHeight ? { paddingBottom: navHeight + 24 } : undefined}
      >
        {upNext && blockComplete && !isLastBlock && rest.phase === "idle" ? (
          // A finished exercise you came back to (the normal path moves on
          // by itself after the rest): the way forward, where you're looking.
          <button
            data-next-exercise
            onClick={() => goToBlock(blockIndex + 1)}
            className="glow relative flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-2 text-left text-primary-foreground active:scale-[0.99]"
          >
            <HapticSwitch />
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold opacity-80">
                {t.session.nextExercise}
              </span>
              <span className="block truncate text-[15px] font-bold">{upNext}</span>
            </span>
            <ChevronRight className="size-5 shrink-0" />
          </button>
        ) : null}
        <div className={isSuperset ? "space-y-3" : ""}>
          {isSuperset ? (
            <p className="flex items-center justify-between gap-3 rounded-full bg-primary/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-text">
              <span className="truncate">{supersetBadge}</span>
              <span className="tabular shrink-0">
                {t.session.roundOf(Math.min(pos.round, block.rounds), block.rounds)}
              </span>
            </p>
          ) : null}

          {block.indices.map((idx, s) => {
            const p = plan[idx]!;
            const doneSets = loggedWorking(idx);
            return (
              <ExerciseBlock
                key={`${p.exercise_id}-${idx}`}
                planned={p}
                index={blockIndex}
                total={blocks.length}
                restForThisExercise={restFor(idx)}
                {...(isSuperset ? { round: pos.round, letter: s === 0 ? "A" : "B" } : {})}
                active={!isSuperset || s === slot}
                locked={resting}
                flash={(!isSuperset || s === slot) && cardFlash}
                cardRef={s === slot ? activeCardRef : undefined}
                onSwap={() => setSwapIndex(idx)}
                onOpenInfo={setInfoExercise}
                onHurts={() => setPainIndex(idx)}
                {...(blockIndex < blocks.length - 1 && !resting ? { onDoLater: doLater } : {})}
                onLogged={(t) => handleLogged(t, s)}
                complete={doneSets >= p.target_sets}
                formOpen={doneSets < p.target_sets || extraSetFor.includes(idx)}
                onExtraSet={() => addExtraSet(idx)}
              />
            );
          })}
        </div>

        {overtime ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3">
            <p className="text-[14px] leading-snug">
              {t.session.overtime(
                overtime.projected,
                overtime.plannedMin,
                overtime.name,
                overtime.saves,
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  haptic(15);
                  removeActivePlanEntries(overtime.indices);
                  setToast(t.session.dropped(overtime.name));
                }}
                className="relative min-h-[44px] flex-1 rounded-xl bg-primary/10 text-[13px] font-bold text-primary-text ring-1 ring-inset ring-primary/50 active:scale-95"
              >
                <HapticSwitch />
                {t.session.dropIt(overtime.name)}
              </button>
              <button
                onClick={() => setOvertimeDismissed(true)}
                className="min-h-[44px] rounded-xl bg-secondary px-4 text-[13px] font-semibold text-secondary-foreground active:scale-95"
              >
                {t.session.keepGoing}
              </button>
            </div>
          </div>
        ) : null}

        {upNext && !(blockComplete && !isLastBlock) ? (
          <p className="rounded-2xl bg-muted px-4 py-3 text-[14px] text-muted-foreground">
            <span className="font-semibold text-foreground">{t.session.upNext}</span> {upNext}
          </p>
        ) : null}

        {isLastBlock && blockComplete && planned.bonus ? (
          <div className="glass glow rounded-3xl p-5 text-center">
            <PartyPopper className="mx-auto size-10 text-primary-text" />
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">
              {t.session.outstandingTitle}
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">{t.session.outstandingBody}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                [t.session.statSets, `${done}`],
                [t.session.statVolume, `${totalVolume.toLocaleString()} kg`],
                [t.session.statTime, `${Math.max(1, Math.round(elapsed / 60))} min`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted px-2 py-3">
                  <p className="tabular text-[17px] font-bold">{value}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={endWorkout} className={`${button.primary} mt-4 w-full`}>
              {t.session.finishWorkout}
            </button>
          </div>
        ) : null}

        <div className="glass space-y-3 rounded-2xl p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{t.session.restTimer}</p>
              <div className="flex flex-wrap justify-end gap-1 rounded-full bg-muted p-1">
                {(["auto", 60, 90, 120] as const).map((s) => {
                  const on = s === "auto" ? restOverride == null : restOverride === s;
                  return (
                    <button
                      key={s}
                      onClick={() => update({ restOverride: s === "auto" ? null : s })}
                      className={`tap-target min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold ${
                        on ? chip.on : "text-muted-foreground"
                      }`}
                    >
                      {s === "auto" ? t.session.auto : `${s}s`}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {restOverride == null
                ? t.session.restFollowing
                : t.session.restEverySet(restOverride)}
            </p>
          </div>
          <SwitchRow
            className="py-0.5"
            label={t.generate.warmups}
            ariaLabel={t.generate.warmups}
            on={warmupsEnabled}
            onToggle={() => update({ warmupsEnabled: !warmupsEnabled })}
          />
          <SwitchRow
            className="py-0.5"
            label={t.session.restEndBeep}
            ariaLabel={t.session.restEndBeep}
            on={soundEnabled}
            onToggle={() => update({ soundEnabled: !soundEnabled })}
          />
          <SwitchRow
            className="py-0.5"
            label={
              <span className="flex items-center gap-1.5">
                {notifyEnabled ? (
                  <Bell className="size-4 text-primary-text" />
                ) : (
                  <BellOff className="size-4 text-muted-foreground" />
                )}
                {t.session.restEndNotification}
              </span>
            }
            ariaLabel={t.session.restEndNotification}
            on={notifyEnabled}
            onToggle={toggleNotify}
          />
          <p className="text-[13px] text-muted-foreground">{t.session.beepHint}</p>
        </div>
      </main>

      {/* No bottom bar while you're lifting: moving on happens after the
          rest, the overview (header) jumps anywhere, and "Next exercise"
          sits in the page when a finished exercise is showing. The dock only
          appears for the rest timer and the end of the workout. */}
      {rest.phase !== "idle" ? (
        // The rest is the one thing to look at: the page and header behind
        // the rest panel are blurred and dimmed, and taps on them do
        // nothing until the rest ends (Skip Rest ends it early).
        <div
          aria-hidden
          className="animate-in fade-in fixed inset-0 z-[35] bg-background/40 backdrop-blur-md duration-300"
        />
      ) : null}
      {rest.phase !== "idle" && restPreview != null && blocks[restPreview] ? (
        <NextUpPreview
          entries={blocks[restPreview]!.indices.map((i) => ({
            planned: plan[i]!,
            rest: restFor(i),
          }))}
          bottom={navHeight}
        />
      ) : null}
      {rest.phase !== "idle" || (isLastBlock && blockComplete) ? (
        <nav
          ref={setNavEl}
          data-session-dock
          className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-border bg-background px-4 pt-3 pb-[max(0.5rem,calc(env(safe-area-inset-bottom)-0.5rem))] shadow-[var(--shadow-float)]"
        >
          {rest.phase !== "idle" ? (
            <RestPanel
              done={restDone}
              secondsLeft={rest.secondsLeft}
              duration={rest.duration}
              next={restNext}
              onSkip={() => {
                haptic();
                rest.skip();
              }}
              onExtend={extendRest}
              onUndo={undoLastSet}
              lastSetRpe={lastSetIsWorking ? (lastSet?.rpe ?? null) : undefined}
              onRateLastSet={(n) => {
                if (!activeWorkout) return;
                updateSet(activeWorkout.completed_sets.length - 1, { rpe: n });
              }}
            />
          ) : (
            <FinishPanel
              setsDone={plan.reduce((n, p, i) => n + Math.min(loggedWorking(i), p.target_sets), 0)}
              setsPlanned={totalSets}
              minutes={Math.max(1, Math.round(elapsed / 60))}
              onFinish={endWorkout}
              {...(activeWorkout.cardio
                ? { cardio: activeWorkout.cardio, onCardio: updateActiveCardio }
                : {})}
              {...(blockIndex > 0 ? { onBack: () => goToBlock(blockIndex - 1) } : {})}
              {...(formOpenHere ? {} : { onExtraSet: () => addExtraSet(planIndex) })}
              {...(bonusOptions.length > 0 ? { onExtraExercise: addBonus } : {})}
            />
          )}
        </nav>
      ) : null}

      <BottomSheet
        open={painIndex !== null}
        onClose={() => setPainIndex(null)}
        title={t.session.painTitle}
      >
        <div className="space-y-3">
          <p className="text-[14px] leading-snug">
            {t.session.painBody(exerciseById(plan[painIndex ?? 0]?.exercise_id ?? "")?.name ?? "")}
          </p>
          <button onClick={() => painSwap(false)} className={`${button.primary} relative w-full`}>
            <HapticSwitch />
            {t.session.painSwap}
          </button>
          <button
            onClick={() => painSwap(true)}
            className="relative min-h-[52px] w-full rounded-2xl bg-secondary text-[15px] font-semibold text-secondary-foreground active:scale-[0.99]"
          >
            <HapticSwitch />
            {t.session.painSwapAvoid}
          </button>
          <p className="text-[12px] text-muted-foreground">{t.session.painNote}</p>
        </div>
      </BottomSheet>

      <ExerciseDetailSheet exercise={infoExercise} onClose={() => setInfoExercise(null)} />
      <SwapSheet
        exerciseId={swapIndex === null ? null : (plan[swapIndex]?.exercise_id ?? null)}
        partnerExerciseId={swapPartnerId}
        onClose={() => setSwapIndex(null)}
        onPick={(ex) => {
          haptic(20);
          if (swapIndex !== null) swapActiveExercise(swapIndex, ex.id);
          setSwapIndex(null);
        }}
      />

      <BottomSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title={t.session.workoutOverview}
      >
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <button
              key={`block-${i}`}
              onClick={() => {
                setPos({ block: i, slot: 0, round: 1 });
                setListOpen(false);
              }}
              className={`w-full rounded-2xl p-4 text-left ${i === blockIndex ? "bg-primary/10 ring-1 ring-inset ring-primary/50" : "glass"}`}
            >
              {b.group !== undefined ? (
                <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary-text">
                  {t.session.supersetRounds(b.rounds)}
                </p>
              ) : null}
              {b.indices.map((idx) => {
                const p = plan[idx]!;
                const ex = exerciseById(p.exercise_id);
                const logged = activeWorkout.completed_sets.filter(
                  (s) => s.exercise_id === p.exercise_id && s.set_type === "working",
                ).length;
                return (
                  <div key={idx} className="flex items-center gap-3 py-0.5">
                    <span className="tabular w-5 text-[17px] font-bold text-primary-text">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-[16px] font-semibold">{ex?.name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {t.session.overviewProgress(
                          logged,
                          p.target_sets,
                          p.target_reps,
                          ex?.unilateral
                            ? t.exercises.perLimb(t.exercises.limb[limbOf(ex)])
                            : undefined,
                        )}
                      </p>
                    </div>
                    {logged >= p.target_sets ? (
                      <CheckCircle2 className="size-5 text-primary-text" />
                    ) : null}
                  </div>
                );
              })}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setListOpen(false);
            endWorkout();
          }}
          className={`${button.primary} mt-4 w-full`}
        >
          <CheckCircle2 className="size-4" /> {t.session.finishWorkout}
        </button>
        <button
          onClick={requestCancelWorkout}
          className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-bold text-destructive-text active:scale-95"
        >
          <Ban className="size-4" /> {t.session.cancelWorkout}
        </button>
      </BottomSheet>

      {cancelConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            aria-label={t.session.keepTraining}
            onClick={() => setCancelConfirmOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="glass-strong relative w-full max-w-sm rounded-3xl p-6 text-center shadow-[var(--shadow-float)]">
            <h2 className="text-[20px] font-bold tracking-tight">{t.session.cancelWorkoutTitle}</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t.session.cancelWorkoutBody(done, done === 1 ? t.session.set : t.session.sets)}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={confirmCancelWorkout}
                className="min-h-[52px] w-full rounded-2xl bg-destructive text-[15px] font-bold text-destructive-foreground active:scale-95"
              >
                {t.session.cancelWorkout}
              </button>
              <button
                onClick={() => setCancelConfirmOpen(false)}
                className="min-h-[52px] w-full rounded-2xl bg-secondary text-[15px] font-semibold text-secondary-foreground active:scale-95"
              >
                {t.session.keepTraining}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {celebrate ? <Confetti big={celebrate === "big"} /> : null}
    </div>
  );
}

function ExerciseBlock({
  planned,
  index,
  total,
  round,
  letter,
  active,
  locked = false,
  flash = false,
  restForThisExercise,
  cardRef,
  onSwap,
  onOpenInfo,
  onHurts,
  onDoLater,
  onLogged,
  complete: exerciseComplete,
  formOpen,
  onExtraSet,
}: {
  planned: PlannedExercise;
  index: number;
  total: number;
  round?: number | undefined;
  letter?: "A" | "B" | undefined;
  active: boolean;
  /** Rest timer running — the Log button is disabled (inputs stay live). */
  locked?: boolean | undefined;
  /** Brief pulse when the rest ends and this card is up next. */
  flash?: boolean | undefined;
  /** Seconds of rest this exercise will actually use, for the subtitle. */
  restForThisExercise: number;
  cardRef?: React.MutableRefObject<HTMLElement | null> | undefined;
  onSwap: () => void;
  /** Opens the exercise's page (tapping its title). */
  onOpenInfo: (exercise: Exercise) => void;
  onHurts: () => void;
  /** Present when there's a later exercise to swap places with. */
  onDoLater?: (() => void) | undefined;
  onLogged: (type: SetType) => void;
  complete: boolean;
  /** The next-set entry form. Hidden once the target sets are logged, so a
   *  finished exercise doesn't offer a prefilled "set 4". */
  formOpen: boolean;
  onExtraSet: () => void;
}) {
  const {
    activeWorkout,
    workouts,
    knownLifts,
    logSet,
    updateSet,
    removeSetAt,
    lastPerformance,
    bestSet,
    profiles,
    activeProfileId,
    weightLog,
    nutritionProfile,
    exerciseNotes,
    setExerciseNote,
    warmupsEnabled,
  } = useGym();
  const t = useTranslation();
  const exercise = exerciseById(planned.exercise_id);
  const note = exerciseNotes[planned.exercise_id] ?? "";
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const saveNote = () => {
    if (noteDraft === null) return;
    setExerciseNote(planned.exercise_id, noteDraft);
    setNoteDraft(null);
  };
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const step = exercise ? plateStep(exercise, profile) : 0.5;
  /** Bodyweight exercise: the weight field is external load (+ added, − assisted). */
  const bw = isBodyweightExercise(exercise);
  const bodyKg = bw ? latestBodyKg(weightLog, nutritionProfile) : null;
  const load = (kg: number) => formatLoad(kg, bw, t.session.bw);
  /** Short form for the set table's kg column: "BW", "+10", "−15". */
  const cell = (kg: number) =>
    !bw ? String(kg) : kg === 0 ? t.session.bw : `${kg > 0 ? "+" : "−"}${Math.abs(kg)}`;

  const logged = useMemo(
    () =>
      (activeWorkout?.completed_sets ?? []).filter((s) => s.exercise_id === planned.exercise_id),
    [activeWorkout, planned.exercise_id],
  );

  /** Sets from the most recent finished session, used for the "Previous" column. */
  const previousSets = useMemo<LoggedSet[]>(() => {
    const w = workouts.find((x) =>
      x.completed_sets.some((s) => s.exercise_id === planned.exercise_id),
    );
    return (w?.completed_sets ?? []).filter(
      (s) => s.exercise_id === planned.exercise_id && s.set_type === "working",
    );
  }, [workouts, planned.exercise_id]);

  const warmupsLogged = logged.filter((s) => s.set_type === "warmup").length;
  /** Warm-ups turned off in settings: none are due, also in a workout
   *  planned with them. */
  const plannedWarmups = warmupsEnabled ? planned.warmup_sets : 0;
  /** Warm-ups only come before the first working set: once working sets are
   *  logged (warm-ups done or skipped), the next set is a working one, also
   *  when the session is reopened. It used to start on a warm-up again
   *  whenever the planned warm-ups hadn't all been logged. */
  const warmupDue = warmupsLogged < plannedWarmups && !logged.some((s) => s.set_type === "working");
  const previous = lastPerformance(planned.exercise_id);
  const best = bestSet(planned.exercise_id);

  const targetTopReps = useMemo(() => {
    const nums = (planned.target_reps.match(/\d+/g) ?? []).map(Number);
    return nums.length ? Math.max(...nums) : 8;
  }, [planned.target_reps]);

  const lastLogged = logged[logged.length - 1];
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [setType, setSetType] = useState<SetType>(warmupDue ? "warmup" : "working");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editW, setEditW] = useState(0);
  const [editR, setEditR] = useState(0);
  const [editRpe, setEditRpe] = useState<number | null>(null);

  /** Progressive-overload suggestion for this exercise, freshly derived from history. */
  const suggestion = useMemo(
    () =>
      suggestWeight(
        planned.exercise_id,
        workouts,
        planned.target_reps,
        step,
        t.progression,
        bodyKg,
      ),
    [workouts, planned.exercise_id, planned.target_reps, step, t, bodyKg],
  );

  /** Never done: a starting weight from a related exercise; done: a
   *  heavier weight your own numbers support (startWeight.ts). */
  const estimate = useMemo(
    () =>
      exercise && !previous
        ? crossEstimate(
            exercise,
            withKnownLifts(withRunning(workouts, activeWorkout), knownLifts),
            planned.target_reps,
            step,
          )
        : null,
    [exercise, previous, workouts, activeWorkout, knownLifts, planned.target_reps, step],
  );
  const hint = useMemo(
    () => (exercise && suggestion ? heavierHint(exercise, workouts, suggestion, step) : null),
    [exercise, suggestion, workouts, step],
  );
  const estimateFrom = estimate ? exerciseById(estimate.fromId) : undefined;
  const hintFrom = hint?.fromId ? exerciseById(hint.fromId) : undefined;

  useEffect(() => {
    if (!warmupDue) setSetType((t) => (t === "warmup" ? "working" : t));
  }, [warmupDue]);

  // Absolute indices into completed_sets shift when any set is added/removed.
  useEffect(() => {
    setEditIdx(null);
  }, [logged.length]);

  // After a working set logged outside the target RPE range, the next set's
  // weight moves 4% per point (see progression.ts's rpeAdjustedWeight).
  const rpeAdjustment =
    lastLogged?.set_type === "working" && setType === "working"
      ? rpeAdjustedWeight(lastLogged.weight, lastLogged.rpe, step, bodyKg)
      : null;
  // Working sets carry on from the last *working* set — after warm-ups the
  // last logged set is a light one, which used to become the prefill.
  const lastWorking = [...logged].reverse().find((s) => s.set_type === "working");
  /** The same-numbered set from the last session: the one source for the
   *  "Previous" hint and the prefill, so they can't disagree. */
  const sameSetBefore = previousSets[logged.filter((s) => s.set_type === "working").length];
  const prevSet = sameSetBefore ?? previousSets[previousSets.length - 1];
  /** An actual progression step (up/down) beats repeating last time's set. */
  const progression = suggestion && suggestion.direction !== "same" ? suggestion : null;
  const workingRef =
    lastWorking?.weight ?? prevSet?.weight ?? estimate?.weight ?? previous?.weight ?? null;
  const gear = exercise?.equipment_required ?? [];
  const warmupCount = Math.max(plannedWarmups, 1);
  // Sourced warm-up ramp (see warmup.ts); not for bodyweight exercises,
  // where there's no lighter version of your own body to load.
  const warmup =
    setType === "warmup" && !bw
      ? warmupLoad(
          workingRef,
          Math.min(warmupsLogged, warmupCount - 1),
          warmupCount,
          step,
          gear.includes("barbell") || gear.includes("smith") ? profile.bar_weight : 0,
        )
      : null;
  /** A loaded exercise with nothing to go on: not done before, nothing
   *  related done either (also not earlier in this workout). The card then
   *  explains how to pick the first weight instead of offering 0 kg. */
  const noReference = !bw && workingRef == null;
  const prefillWeight =
    setType === "warmup"
      ? (warmup?.weight ?? lastLogged?.weight ?? 0)
      : (rpeAdjustment?.weight ??
        lastWorking?.weight ??
        progression?.weight ??
        prevSet?.weight ??
        estimate?.weight ??
        previous?.weight ??
        0);
  // Reps carry on from the last working set too, like the weight; before
  // any this session, the double-progression target, then last session's.
  // (It used to be the most reps ever logged, so after a set of 10 the
  // field could read 12.)
  const prefillReps = warmup
    ? warmup.reps
    : setType === "warmup" && noReference
      ? WARMUP_REPS
      : (lastWorking?.reps ??
        progression?.reps ??
        prevSet?.reps ??
        estimate?.reps ??
        previous?.reps ??
        targetTopReps);

  if (!exercise) return null;

  const submitSet = (w: number, r: number, rpeValue?: number) => {
    unlockAudio();
    haptic([25, 30]);
    logSet({
      exercise_id: exercise.id,
      set_number: logged.length + 1,
      set_type: setType,
      weight: w,
      reps: r,
      completed_at: new Date().toISOString(),
      ...(round === undefined ? {} : { round }),
      ...(setType === "working" && rpeValue != null ? { rpe: rpeValue } : {}),
    });
    setWeight("");
    setReps("");
    setRpe(null);
    onLogged(setType);
  };
  /** The weight field as a number ("-" alone, mid-typing, reads as 0). */
  const currentKg = parseDecimal(weight === "" ? String(prefillWeight) : weight) || 0;
  const logCurrent = () =>
    submitSet(currentKg, parseDecimal(reps === "" ? String(prefillReps) : reps), rpe ?? undefined);

  const bumpWeight = (dir: 1 | -1) => {
    haptic(10);
    const cur = currentKg;
    // Bodyweight exercises go below zero into assistance, never past the
    // whole bodyweight (a machine can't take off more than you weigh).
    const floor = bw ? -(bodyKg ?? 200) : 0;
    setWeight(String(Number(Math.max(floor, cur + dir * step).toFixed(2))));
  };
  const bumpReps = (dir: 1 | -1) => {
    haptic(10);
    const cur = parseDecimal(reps === "" ? String(prefillReps) : reps);
    setReps(String(Math.max(1, cur + dir)));
  };

  const openEdit = (abs: number, s: LoggedSet) => {
    haptic(10);
    setEditIdx(abs);
    setEditW(s.weight);
    setEditR(s.reps);
    setEditRpe(s.rpe ?? null);
  };

  // e1RM-based so this agrees with the PR definition used everywhere else
  // (progress.ts, History) — comparing raw weight alone ignored reps and
  // could flag/miss a PR differently than the History tab would.
  const currentWeight = parseDecimal(weight || String(prefillWeight));
  const currentReps = parseDecimal(reps || String(prefillReps));
  const isPR =
    !!best &&
    currentWeight > 0 &&
    currentReps > 0 &&
    estimated1RM({ weight: currentWeight, reps: currentReps }) > estimated1RM(best);

  // The set column is as wide as the next set's round button (size-11) and
  // centred, so a logged set's number sits right above that button's.
  const GRID = "grid grid-cols-[2.75rem_2.75rem_1fr_minmax(3.5rem,1fr)] items-center gap-1.5";
  const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return (
    <section
      ref={(el) => {
        if (cardRef) cardRef.current = el;
      }}
      className={`overflow-hidden rounded-3xl border p-4 transition-all ${
        active ? "glow border-primary/70 bg-card" : "border-border/70 bg-card/70 opacity-60"
      } ${flash ? "flash" : ""}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-text">
            {letter ? t.session.exerciseLetter(letter) : t.session.exerciseOf(index + 1, total)}
          </p>
          <h2 className="mt-1 text-[26px] font-bold leading-[1.1] tracking-tight">
            <button
              onClick={() => onOpenInfo(exercise)}
              aria-label={t.exercises.openExercise(exercise.name)}
              className="tap-target text-left active:opacity-70"
            >
              {exercise.name}
            </button>
          </h2>
          <p className="mt-1.5 line-clamp-2 text-[12px] text-muted-foreground">
            {plannedWarmups ? t.session.warmupPrefix(plannedWarmups) : ""}
            {t.session.targetLine(
              planned.target_sets,
              planned.target_reps,
              restForThisExercise,
              exercise.unilateral
                ? t.exercises.perLimb(t.exercises.limb[limbOf(exercise)])
                : undefined,
            )}
            <span className="capitalize">{exercise.primary_muscle}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onSwap}
            aria-label={t.generate.swapExercise}
            className="tap-target flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
          >
            <Repeat className="size-4" />
          </button>
          <a
            href={exerciseVideoUrl(exercise)}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t.session.watchDemo}
            className="tap-target flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
          >
            <Youtube className="size-4 text-primary-text" />
          </a>
        </div>
      </div>

      {noteDraft !== null ? (
        <div className="mt-3 flex items-start gap-2">
          <textarea
            autoFocus
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            placeholder={t.session.notePlaceholder}
            aria-label={t.session.noteLabel}
            className="min-w-0 flex-1 resize-none rounded-xl bg-muted px-3 py-2 text-[16px] leading-snug outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={saveNote}
            className={`min-h-[44px] shrink-0 rounded-xl px-4 text-[14px] font-bold active:scale-95 ${chip.on}`}
          >
            {t.common.save}
          </button>
        </div>
      ) : note ? (
        <button
          onClick={() => setNoteDraft(note)}
          aria-label={t.session.editNote}
          className="mt-3 flex w-full items-start gap-2 rounded-xl bg-muted px-3 py-2 text-left active:scale-[0.99]"
        >
          <StickyNote className="mt-0.5 size-4 shrink-0 text-primary-text" />
          <span className="min-w-0 flex-1 whitespace-pre-wrap text-[14px] leading-snug">
            {note}
          </span>
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-1.5 gap-y-2">
        {!note && noteDraft === null ? (
          <button
            onClick={() => setNoteDraft("")}
            className="tap-target flex min-h-[36px] items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground active:scale-95"
          >
            <StickyNote className="size-3.5" />
            {t.session.addNote}
          </button>
        ) : null}
        <button
          onClick={onHurts}
          className="tap-target flex min-h-[36px] items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground active:scale-95"
        >
          <Bandage className="size-3.5" />
          {t.session.hurts}
        </button>
        {onDoLater ? (
          <button
            onClick={onDoLater}
            className="tap-target flex min-h-[36px] items-center gap-1.5 rounded-full bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground active:scale-95"
          >
            <CornerDownRight className="size-3.5" />
            {t.session.doLater}
          </button>
        ) : null}
      </div>

      {exerciseComplete ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary/15 px-4 py-3">
          <CheckCircle2 className="size-6 shrink-0 text-primary-text" />
          <div className="min-w-0">
            <p className="text-[15px] font-bold">{t.session.wellDone(planned.target_sets)}</p>
            <p className="text-[13px] text-muted-foreground">
              {index >= total - 1 ? t.session.finishBelow : t.session.moveToNext}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-1.5">
        <div
          className={`${GRID} text-[11px] font-semibold uppercase tracking-widest text-muted-foreground`}
        >
          <span className="text-center">{t.session.setCol}</span>
          <span>{t.session.prevCol}</span>
          <span className="text-center">{t.session.kgCol}</span>
          <span className="text-center">
            {exercise.unilateral
              ? t.session.repsColPer(t.exercises.limb[limbOf(exercise)])
              : t.session.repsCol}
          </span>
        </div>

        {logged.map((s, i) => {
          const abs = (activeWorkout?.completed_sets ?? []).indexOf(s);
          if (editIdx === abs) {
            return (
              <div key={`edit-${abs}`} className="space-y-2 rounded-xl bg-primary/15 p-2">
                <div className="flex items-center gap-2">
                  <span className="tabular w-6 shrink-0 text-[15px] font-bold text-primary-text">
                    {s.set_type === "warmup" ? "W" : s.set_number}
                  </span>
                  <Stepper
                    value={editW}
                    onChange={setEditW}
                    step={step}
                    min={bw ? -(bodyKg ?? 200) : 0}
                    ariaLabel={t.session.weightAriaLabel}
                    unit="kg"
                    signed={bw}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0" />
                  <Stepper
                    value={editR}
                    onChange={setEditR}
                    step={1}
                    min={0}
                    ariaLabel={t.session.repsAriaLabel}
                    unit="reps"
                  />
                </div>
                {s.set_type === "working" ? (
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">
                      {t.session.rpe}
                    </span>
                    <RpePicker value={editRpe} onChange={setEditRpe} />
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      haptic(15);
                      updateSet(abs, {
                        weight: editW,
                        reps: editR,
                        ...(s.set_type === "working" ? { rpe: editRpe } : {}),
                      });
                      setEditIdx(null);
                    }}
                    className={`${button.primary} min-w-0 flex-1`}
                  >
                    {t.session.saveEdit}
                  </button>
                  <button
                    onClick={() => {
                      haptic(15);
                      removeSetAt(abs);
                      setEditIdx(null);
                    }}
                    aria-label={t.session.deleteEdit}
                    className="flex size-11 shrink-0 items-center justify-center self-center rounded-xl bg-secondary text-destructive-text active:scale-95"
                  >
                    {/* An icon, so Save, Cancel and Delete fit one row at
                        375 pt in Dutch ("Verwijderen" cut off). */}
                    <Trash2 className="size-4" />
                  </button>
                  <button
                    onClick={() => setEditIdx(null)}
                    className="min-h-11 shrink-0 self-center rounded-xl bg-secondary px-4 text-[14px] font-semibold text-muted-foreground active:scale-95"
                  >
                    {t.session.cancelEdit}
                  </button>
                </div>
              </div>
            );
          }
          return (
            <button
              key={`${s.set_number}-${i}`}
              onClick={() => openEdit(abs, s)}
              aria-label={t.session.editSet(s.set_number)}
              className={`${GRID} tap-target w-full rounded-xl bg-primary/10 py-2 text-left active:scale-[0.99]`}
            >
              <span className="tabular text-center text-[15px] font-bold text-primary-text">
                {s.set_type === "warmup" ? "W" : s.set_number}
              </span>
              <span className="tabular text-[13px] text-muted-foreground">
                {previousSets[i]
                  ? `${cell(previousSets[i]!.weight)} × ${previousSets[i]!.reps}`
                  : "—"}
              </span>
              <span className="tabular text-center text-[16px] font-semibold">
                {cell(s.weight)}
              </span>
              <span className="tabular text-center text-[16px] font-semibold">
                {s.reps}
                {s.rpe ? (
                  <span className="ml-1 text-[11px] text-primary-text">@{s.rpe}</span>
                ) : s.set_type === "working" ? (
                  // A reminder that this set has no RPE; the row opens the
                  // editor, which has the RPE picker.
                  <span
                    aria-label={t.session.addRpeAria(s.set_number)}
                    className="ml-1 rounded-full border border-dashed border-muted-foreground/60 px-1.5 py-px align-middle text-[10px] font-semibold text-muted-foreground"
                  >
                    {t.session.addRpe}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}

        {formOpen ? (
          <div className={`space-y-2 pt-1 ${!active ? "pointer-events-none opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  haptic(10);
                  setSetType((t) => (t === "warmup" ? "working" : "warmup"));
                }}
                aria-label={
                  setType === "warmup" ? t.session.warmupSetToggleOn : t.session.warmupSetToggleOff
                }
                className={`tabular size-11 shrink-0 rounded-xl text-[15px] font-bold active:scale-95 ${
                  setType === "warmup"
                    ? "bg-primary/25 text-primary-text"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {setType === "warmup" ? "W" : logged.length + 1}
              </button>
              <span className="text-[12px] text-muted-foreground">
                {sameSetBefore
                  ? t.session.lastTime(load(sameSetBefore.weight), sameSetBefore.reps)
                  : t.session.firstTime}
              </span>
            </div>
            {warmup && workingRef ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {t.session.warmupHint(
                    Math.min(warmupsLogged, warmupCount - 1) + 1,
                    warmupCount,
                    warmup.reps,
                    load(warmup.weight),
                    Math.round(warmup.fraction * 100),
                    load(workingRef),
                  )}
                </span>
              </p>
            ) : null}

            {noReference && setType === "warmup" ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
                {t.session.firstWarmupGuide(
                  Math.min(warmupsLogged, warmupCount - 1) + 1,
                  warmupCount,
                  WARMUP_REPS,
                  Math.round(
                    warmupFractions(warmupCount)[Math.min(warmupsLogged, warmupCount - 1)]! * 100,
                  ),
                )}
              </p>
            ) : noReference && setType === "working" ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
                {t.session.firstSetGuide(currentReps)}
              </p>
            ) : null}

            {!lastLogged && estimate && estimateFrom && setType === "working" ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
                {estimate.basis === "entered"
                  ? t.session.fromEnteredLift(load(estimate.fromSet.weight), estimate.fromSet.reps)
                  : t.session.estimatedFrom(
                      estimateFrom.name,
                      load(estimate.fromSet.weight),
                      estimate.fromSet.reps,
                      estimate.basis === "rough" || estimate.basis === "reference"
                        ? estimate.basis
                        : "estimate",
                    )}
              </p>
            ) : null}

            {!lastLogged && hint ? (
              // Your own numbers say heavier than the suggestion: a note, and
              // Use fills the fields; the suggestion itself stays as it was.
              <div className="flex items-center gap-2 rounded-xl bg-primary/15 py-1.5 pl-3 pr-1.5">
                <ArrowUp className="size-4 shrink-0 text-primary-text" />
                <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-foreground">
                  {t.session.heavierNote(
                    load(hint.weight),
                    hint.reps,
                    hint.why === "rpe"
                      ? t.session.heavierWhyRpe(hint.rpe!)
                      : hint.why === "personal"
                        ? t.session.heavierWhyPersonal(hintFrom?.name ?? "")
                        : t.session.heavierWhyPublished(hintFrom?.name ?? ""),
                  )}
                </p>
                <button
                  onClick={() => {
                    haptic(12);
                    setWeight(String(hint.weight));
                    setReps(String(hint.reps));
                  }}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-bold text-primary-foreground active:scale-95"
                >
                  {t.session.useWeight}
                </button>
              </div>
            ) : null}

            {!lastLogged && suggestion && suggestion.direction !== "same" ? (
              <p className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-[13px] font-semibold text-primary-text">
                {suggestion.direction === "up" ? (
                  <TrendingUp className="size-4 shrink-0" />
                ) : (
                  <TrendingDown className="size-4 shrink-0" />
                )}{" "}
                {t.session.suggestedInline(
                  load(suggestion.weight),
                  suggestion.reps,
                  suggestion.reason,
                )}
              </p>
            ) : null}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => bumpWeight(-1)}
                aria-label={t.session.lessWeight}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
              >
                <HapticSwitch />
                <Minus className="size-4" />
              </button>
              <div className="relative min-w-0 flex-1">
                <input
                  inputMode="decimal"
                  type="text"
                  value={weight}
                  aria-label={t.session.weightAriaLabel}
                  placeholder={noReference ? "–" : `${prefillWeight}`}
                  onFocus={selectOnFocus}
                  onChange={(e) => {
                    const re = bw ? SIGNED_DECIMAL_INPUT_RE : DECIMAL_INPUT_RE;
                    if (!re.test(e.target.value)) return;
                    setWeight(e.target.value);
                  }}
                  className="tabular h-12 w-full rounded-xl bg-muted px-8 text-center text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  kg
                </span>
              </div>
              <button
                onClick={() => bumpWeight(1)}
                aria-label={t.session.moreWeight}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
              >
                <HapticSwitch />
                <Plus className="size-4" />
              </button>
            </div>
            {bw ? (
              <p className="-mt-1 px-1 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{load(currentKg)}</span> ·{" "}
                {t.session.bodyweightHint}
              </p>
            ) : null}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => bumpReps(-1)}
                aria-label={t.session.fewerReps}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
              >
                <HapticSwitch />
                <Minus className="size-4" />
              </button>
              <div className="relative min-w-0 flex-1">
                <input
                  inputMode="numeric"
                  type="text"
                  value={reps}
                  placeholder={`${prefillReps}`}
                  aria-label={t.session.repsAriaLabel}
                  onFocus={selectOnFocus}
                  onChange={(e) => {
                    if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                    setReps(e.target.value);
                  }}
                  className="tabular h-12 w-full rounded-xl bg-muted px-10 text-center text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  reps
                </span>
              </div>
              <button
                onClick={() => bumpReps(1)}
                aria-label={t.session.moreReps}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
              >
                <HapticSwitch />
                <Plus className="size-4" />
              </button>
            </div>

            {setType === "working" ? (
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t.session.rpe}
                </span>
                <RpePicker value={rpe} onChange={setRpe} />
              </div>
            ) : null}
            {setType === "working" ? (
              <p className="text-[12px] text-muted-foreground">
                {rpeAdjustment && lastLogged?.rpe != null
                  ? t.session.rpeAdjusted(
                      lastLogged.rpe,
                      TARGET_RPE[0],
                      TARGET_RPE[1],
                      rpeAdjustment.direction === "down",
                    )
                  : t.session.rpeTarget(TARGET_RPE[0], TARGET_RPE[1])}
              </p>
            ) : null}

            <PlateHint
              exerciseId={exercise.id}
              target={parseDecimal(weight === "" ? String(prefillWeight) : weight)}
            />

            <button
              data-log-set
              onClick={logCurrent}
              disabled={!active || locked}
              className={`relative min-h-14 w-full rounded-2xl px-3 text-[16px] font-bold active:scale-[0.99] ${
                !active || locked
                  ? "bg-secondary text-muted-foreground opacity-50"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <HapticSwitch disabled={!active || locked} />
              {locked
                ? t.session.resting
                : t.session.logSetWith(
                    load(currentKg),
                    currentReps,
                    setType === "working" ? rpe : null,
                  )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onExtraSet}
            disabled={!active}
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-[14px] font-semibold text-muted-foreground active:scale-[0.99]"
          >
            <Plus className="size-4" /> {t.session.extraSet}
          </button>
        )}
      </div>

      {isPR ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary/15 px-3 py-2 text-[14px] font-semibold text-primary-text">
          <Trophy className="size-4" /> {t.session.prPace(load(best?.weight ?? 0), best?.reps ?? 0)}
        </p>
      ) : null}

      <div className="mt-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-primary-text">
          <Lightbulb className="size-4" /> {t.session.keyFormCues}
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {sentence(exercise.instructions)}
        </p>
        <ul className="mt-2 space-y-1.5">
          {exercise.cues.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[14px] font-medium text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary-text" strokeWidth={3} />
              <span>{sentence(c)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** m:ss, so a 2-minute rest reads "1:43" rather than "103s". */
function formatRest(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The rest timer, docked in the bottom bar in place of the exercise
 * navigation (which is locked during a rest anyway). It used to float over
 * the top of the card, covering the weight and reps fields, and cut the
 * "next" line short. Here it covers only the logging buttons, which are
 * locked too, and sits under the thumb.
 */
/** What's next, shown in the blurred area above the rest panel on the rest
 *  after an exercise or superset is finished: each exercise's name, target
 *  and rest, the first line of how it's done, your saved note, and the
 *  weight × reps its card will start on — the same prefill the card uses
 *  before a set is logged (the progression suggestion, else last session,
 *  else the top of the rep range). */
function NextUpPreview({
  entries,
  bottom,
}: {
  entries: { planned: PlannedExercise; rest: number }[];
  /** The rest panel's height, to sit just above it. */
  bottom: number;
}) {
  const t = useTranslation();
  const {
    workouts,
    activeWorkout,
    knownLifts,
    lastPerformance,
    exerciseNotes,
    profiles,
    activeProfileId,
    weightLog,
    nutritionProfile,
  } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 fixed inset-x-0 z-[36] mx-auto max-w-xl px-4 duration-300"
      style={{ bottom: bottom + 12 }}
    >
      <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto rounded-3xl border border-border bg-background/90 p-4 shadow-[var(--shadow-float)]">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-text">
          {entries.length > 1 ? t.session.upNextSuperset : t.session.nextUpTitle}
        </p>
        {entries.map(({ planned, rest }, i) => {
          const exercise = exerciseById(planned.exercise_id);
          if (!exercise) return null;
          const bw = isBodyweightExercise(exercise);
          const bodyKg = bw ? latestBodyKg(weightLog, nutritionProfile) : null;
          const suggestion = suggestWeight(
            planned.exercise_id,
            workouts,
            planned.target_reps,
            plateStep(exercise, profile),
            t.progression,
            bodyKg,
          );
          const previous = lastPerformance(planned.exercise_id);
          const estimate =
            suggestion || previous
              ? null
              : crossEstimate(
                  exercise,
                  withKnownLifts(withRunning(workouts, activeWorkout), knownLifts),
                  planned.target_reps,
                  plateStep(exercise, profile),
                );
          const nums = (planned.target_reps.match(/\d+/g) ?? []).map(Number);
          // A bodyweight exercise starts at bodyweight (0 external load),
          // like its card; a loaded one without history has no weight yet.
          const weight =
            suggestion?.weight ?? estimate?.weight ?? previous?.weight ?? (bw ? 0 : null);
          const reps =
            suggestion?.reps ??
            estimate?.reps ??
            previous?.reps ??
            (nums.length ? Math.max(...nums) : 8);
          const note = exerciseNotes[planned.exercise_id];
          const referenceFrom =
            estimate?.basis === "reference" ? exerciseById(estimate.fromId) : undefined;
          return (
            <div
              key={planned.exercise_id + i}
              className={i > 0 ? "mt-3 border-t border-border pt-3" : "mt-1.5"}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[17px] font-bold leading-snug">
                  {entries.length > 1 ? (
                    <span className="mr-1.5 text-primary-text">{i === 0 ? "A" : "B"}</span>
                  ) : null}
                  {exercise.name}
                </p>
                {weight != null ? (
                  <span className="tabular shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[13px] font-bold">
                    {estimate ? "≈ " : ""}
                    {formatLoad(weight, bw, t.session.bw)} × {reps}
                    {estimate?.basis === "reference" ? "*" : ""}
                  </span>
                ) : (
                  <span className="shrink-0 pt-0.5 text-[12px] text-muted-foreground">
                    {t.session.firstTime}
                  </span>
                )}
              </div>
              <p className="tabular mt-0.5 text-[12.5px] text-muted-foreground">
                {t.session.targetLine(planned.target_sets, planned.target_reps, rest)}
                <span className="capitalize">{exercise.primary_muscle}</span>
              </p>
              {estimate?.basis === "reference" && referenceFrom ? (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {t.session.referenceFrom(referenceFrom.name)}
                </p>
              ) : null}
              {exercise.instructions ? (
                <p className="mt-1 line-clamp-2 text-[13px] leading-snug">
                  {exercise.instructions}
                </p>
              ) : null}
              {note ? (
                <p className="mt-1.5 flex gap-1.5 text-[13px] leading-snug text-muted-foreground">
                  <StickyNote className="mt-0.5 size-3.5 shrink-0 text-primary-text" />
                  <span className="min-w-0">{note}</span>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RestPanel({
  done,
  secondsLeft,
  duration,
  next,
  onSkip,
  onExtend,
  onUndo,
  lastSetRpe,
  onRateLastSet,
}: {
  done: boolean;
  secondsLeft: number;
  duration: number;
  next: string | null;
  onSkip: () => void;
  onExtend: () => void;
  onUndo: () => void;
  /** RPE of the working set that started this rest (null: not rated yet);
   *  undefined hides the picker (the last set was a warm-up). */
  lastSetRpe: number | null | undefined;
  onRateLastSet: (rpe: number | null) => void;
}) {
  const t = useTranslation();
  const pct = done ? 0 : Math.max(0, Math.min(100, (secondsLeft / Math.max(1, duration)) * 100));
  return (
    <div className="mx-auto w-full max-w-xl" role="region" aria-label={t.session.restLabel}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            {done ? t.session.restOverLabel : t.session.restLabel}
          </p>
          <p
            className={`tabular mt-0.5 truncate text-[30px] font-bold leading-none ${
              done ? "text-primary-text" : ""
            }`}
            aria-label={done ? t.session.restGo : undefined}
          >
            {done ? t.session.restGo : formatRest(secondsLeft)}
          </p>
        </div>
        {!done ? (
          <button
            onClick={onExtend}
            className="relative min-h-11 shrink-0 rounded-2xl bg-secondary px-3 text-[14px] font-bold text-secondary-foreground active:scale-95"
          >
            <HapticSwitch />
            {t.session.addRest}
          </button>
        ) : null}
        <button
          onClick={onSkip}
          className={`relative min-h-11 shrink-0 rounded-2xl bg-primary px-5 text-[15px] font-bold text-primary-foreground active:scale-95 ${
            done ? "glow" : ""
          }`}
        >
          <HapticSwitch />
          {done ? t.session.restContinue : t.session.skipRest}
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      {next || !done ? (
        <div className="mt-2 flex items-center gap-2">
          <p className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[14px]">
            {next ? (
              <>
                <span className="shrink-0 font-semibold text-muted-foreground">
                  {t.session.restNextLabel}
                </span>
                <span className="line-clamp-2 min-w-0 font-semibold">{next}</span>
              </>
            ) : null}
          </p>
          {!done ? (
            <button
              onClick={onUndo}
              className="tap-target flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground active:scale-95"
            >
              <HapticSwitch />
              <Undo2 className="size-3.5" />
              {t.session.undoSet}
            </button>
          ) : null}
        </div>
      ) : null}
      {!done && lastSetRpe !== undefined ? (
        // Rest is when you'd rate the set anyway, and logging moves straight
        // on, so the set that just finished can be rated (or corrected) here.
        <div className="mt-2 flex items-center gap-2">
          <span className="w-16 shrink-0 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            {t.session.rateLastSet}
          </span>
          <RpePicker value={lastSetRpe} onChange={onRateLastSet} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A hybrid day's cardio as the last exercise: what's planned, its minutes
 * (adjustable in 5s, as done), and a tick for having done it. Not ticked,
 * nothing is logged.
 */
function CardioFinisherRow({
  cardio,
  onChange,
}: {
  cardio: CardioFinisher & { done?: boolean };
  onChange: (patch: Partial<CardioFinisher & { done: boolean }>) => void;
}) {
  const t = useTranslation();
  const Icon = CARDIO_ICONS[cardio.activity];
  const step = (d: number) => {
    haptic(10);
    onChange({ minutes: Math.min(120, Math.max(5, cardio.minutes + d)) });
  };
  return (
    <div className="mt-2 flex items-center gap-2 rounded-2xl bg-foreground/[0.05] p-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-text">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold leading-tight">
          {t.cardio.activities[cardio.activity]} · {t.cardio.efforts[cardio.effort]}
        </p>
        <div className="mt-0.5 flex items-center gap-1">
          <button
            onClick={() => step(-5)}
            aria-label={t.cardio.lessMinutes}
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="tabular min-w-[52px] text-center text-[13px] text-muted-foreground">
            {t.cardio.min(cardio.minutes)}
          </span>
          <button
            onClick={() => step(5)}
            aria-label={t.cardio.moreMinutes}
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <button
        onClick={() => {
          haptic(15);
          onChange({ done: !cardio.done });
        }}
        aria-pressed={!!cardio.done}
        className={`flex min-h-10 shrink-0 items-center gap-1 rounded-2xl px-3 text-[13.5px] font-bold active:scale-95 ${
          cardio.done ? chip.on : "bg-secondary text-secondary-foreground"
        }`}
      >
        {cardio.done ? <Check className="size-4" /> : null}
        {cardio.done ? t.cardio.finisherDone : t.cardio.finisherMarkDone}
      </button>
    </div>
  );
}

/**
 * The end of the workout, docked in the bottom bar once the last exercise's
 * sets are done. Before, the last set started a rest with nothing after it,
 * then the card offered a prefilled "set 4" and the only sign the workout
 * was over was a line of text and the Finish button in the bar.
 */
function FinishPanel({
  setsDone,
  setsPlanned,
  minutes,
  onFinish,
  onBack,
  onExtraSet,
  onExtraExercise,
  cardio,
  onCardio,
}: {
  setsDone: number;
  setsPlanned: number;
  minutes: number;
  onFinish: () => void;
  /** A hybrid day's cardio, done after the lifting: ticked off here, and
   *  logged as cardio when the workout is finished. */
  cardio?: CardioFinisher & { done?: boolean };
  onCardio?: (patch: Partial<CardioFinisher & { done: boolean }>) => void;
  onBack?: () => void;
  onExtraSet?: () => void;
  onExtraExercise?: () => void;
}) {
  const t = useTranslation();
  const all = setsDone >= setsPlanned;
  return (
    <div className="mx-auto w-full max-w-xl" role="region" aria-label={t.session.finishTitle}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <PartyPopper className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-tight">
            {all ? t.session.finishTitle : t.session.finishTitlePartial}
          </p>
          <p className="tabular text-[14px] text-muted-foreground">
            {t.session.finishStats(setsDone, setsPlanned, minutes)}
          </p>
        </div>
      </div>
      {cardio && onCardio ? <CardioFinisherRow cardio={cardio} onChange={onCardio} /> : null}
      <button onClick={onFinish} className={`${button.primary} relative mt-2 w-full`}>
        <HapticSwitch />
        {t.session.finishWorkout}
      </button>
      {onBack || onExtraSet || onExtraExercise ? (
        <div className="mt-2 flex gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              aria-label={t.session.previousExercise}
              className="flex min-h-10 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground active:scale-95"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {onExtraSet ? (
            <button
              onClick={onExtraSet}
              className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary px-2 text-[14px] font-semibold text-secondary-foreground active:scale-95"
            >
              <Plus className="size-4 shrink-0" /> {t.session.extraSet}
            </button>
          ) : null}
          {onExtraExercise ? (
            <button
              onClick={onExtraExercise}
              aria-label={t.session.addExtra}
              className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-2xl bg-secondary px-2 text-[14px] font-semibold text-secondary-foreground active:scale-95"
            >
              <Plus className="size-4 shrink-0" /> {t.session.extraExercise}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** RPE 6–10 on Zourdos et al.'s RIR-based scale; tapping the chosen value
 *  again clears it. */
function RpePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (rpe: number | null) => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-1 gap-1">
      {[6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => {
            haptic(8);
            onChange(value === n ? null : n);
          }}
          aria-pressed={value === n}
          aria-label={t.session.rpeAriaLabel(n)}
          className={`tap-target h-10 flex-1 rounded-lg text-[13px] font-bold active:scale-95 ${
            value === n ? chip.on : chip.off
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Numeric field with big −/+ buttons, for editing a logged set. The field
 *  keeps what's typed as text while it's being edited, so "12," can become
 *  "12,5": it used to show the parsed number, which dropped the comma on
 *  every keystroke (reported). The unit sits inside the field, like the
 *  new-set form's "kg" and "reps". */
function Stepper({
  value,
  onChange,
  step,
  min = 0,
  ariaLabel,
  unit,
  signed = false,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  ariaLabel: string;
  unit: string;
  /** Allows a leading minus (assistance on a bodyweight exercise). */
  signed?: boolean;
}) {
  const t = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const set = (v: number) => {
    setDraft(null);
    onChange(Number(Math.max(min, v).toFixed(2)));
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button
        onClick={() => {
          haptic(10);
          set(value - step);
        }}
        aria-label={t.session.lessLabel(ariaLabel)}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
      >
        <Minus className="size-4" />
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          inputMode="decimal"
          type="text"
          value={draft ?? (Number.isFinite(value) ? String(value) : "")}
          aria-label={ariaLabel}
          onFocus={selectOnFocus}
          onChange={(e) => {
            const text = e.target.value;
            if (!(signed ? SIGNED_DECIMAL_INPUT_RE : DECIMAL_INPUT_RE).test(text)) return;
            setDraft(text);
            const n = parseDecimal(text);
            if (Number.isFinite(n)) onChange(Math.max(min, n));
          }}
          onBlur={() => setDraft(null)}
          className="tabular h-12 w-full min-w-0 rounded-xl bg-muted px-10 text-center text-[16px] font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
          {unit}
        </span>
      </div>
      <button
        onClick={() => {
          haptic(10);
          set(value + step);
        }}
        aria-label={t.session.moreLabel(ariaLabel)}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
