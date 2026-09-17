import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Flame,
  List,
  Minus,
  PartyPopper,
  Plus,
  Repeat,
  TrendingDown,
  TrendingUp,
  Trophy,
  Youtube,
  X,
} from "lucide-react";
import { BottomSheet } from "../components/gym/BottomSheet";
import { Confetti } from "../components/gym/Confetti";
import { SwapSheet } from "../components/gym/SwapSheet";
import { PlateHint } from "../components/gym/PlateHint";
import { exerciseById } from "../lib/gym/data";
import { antagonistLabel, isAntagonistPair } from "../lib/gym/antagonist";
import { availableExercises } from "../lib/gym/generator";
import { DECIMAL_INPUT_RE, parseDecimal, placeCursorAtEnd } from "../lib/gym/numericInput";
import { plateStep } from "../lib/gym/plates";
import { estimated1RM } from "../lib/gym/progress";
import { suggestWeight } from "../lib/gym/progression";
import { todaysCheckIn } from "../lib/gym/readiness";
import { playRestEndBeep, unlockAudio } from "../lib/gym/sound";
import { useRestTimer } from "../lib/gym/useRestTimer";
import { useWakeLock } from "../lib/gym/useWakeLock";
import { haptic, useGym } from "../lib/gym/store";
import type { LoggedSet, PlannedExercise, SetType } from "../lib/gym/types";

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
  const {
    activeWorkout,
    hydrated,
    update,
    finishWorkout,
    cancelWorkout,
    restSeconds,
    restOverride,
    soundEnabled,
    notifyEnabled,
    swapActiveExercise,
    appendBonusExercise,
    profiles,
    activeProfileId,
    avoidedExerciseIds,
  } = useGym();

  const [pos, setPos] = useState({ block: 0, slot: 0, round: 1 });
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<"normal" | "big" | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
  const wasComplete = useRef(false);
  const afterRest = useRef<(() => void) | null>(null);

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

  const rest = useRestTimer({
    onCountdownEnd: () => {
      haptic([60, 60, 120]);
      if (soundEnabled) playRestEndBeep();
      flashActiveCard();
      if (
        notifyEnabled &&
        document.visibilityState !== "visible" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("Rest complete", {
            body: "Time to lift — back to Forge.",
            tag: "forge-rest",
          });
        } catch {
          /* some browsers restrict Notification outside a service worker */
        }
      }
    },
    onDismiss: () => {
      const cb = afterRest.current;
      afterRest.current = null;
      cb?.();
    },
  });
  /** Rest Mode: countdown running, before the "rest complete" phase. */
  const resting = rest.phase === "counting";
  const restDone = rest.phase === "done";

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

  /** Keep the focused card in view as focus moves between the paired exercises. */
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pos.block, pos.slot, pos.round]);

  if (!hydrated) return <div className="min-h-[100dvh] bg-background" />;

  if (!activeWorkout || !planned || !block) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold">No active session</p>
        <button
          onClick={() => navigate({ to: "/" })}
          className="min-h-[52px] active:scale-95 rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
        >
          Build a workout
        </button>
      </div>
    );
  }

  const totalSets = plan.reduce((n, p) => n + p.target_sets, 0);
  const done = activeWorkout.completed_sets.length;
  const workingDone = activeWorkout.completed_sets.filter(
    (s) => s.exercise_id === planned.exercise_id && s.set_type === "working",
  ).length;
  const exerciseComplete = workingDone >= planned.target_sets;
  const blockComplete = blockDone;
  const isLastBlock = blockIndex >= blocks.length - 1;
  const totalVolume = activeWorkout.completed_sets.reduce((v, s) => v + s.weight * s.reps, 0);
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const planIds = new Set(plan.map((p) => p.exercise_id));
  const bonusOptions = availableExercises(profile.active_equipment_ids, avoidedExerciseIds).filter(
    (e) => !planIds.has(e.id),
  );

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
    if (a && b && isAntagonistPair(a, b)) return `Superset (Antagonist • ${antagonistLabel(a, b)})`;
    return `Superset ${slot + 1}/2`;
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
    setTimeout(() => {
      finishWorkout();
      navigate({ to: "/history" });
    }, 1800);
  };

  const requestCancelWorkout = () => {
    haptic(15);
    setListOpen(false);
    setCancelConfirmOpen(true);
  };

  const toggleNotify = async () => {
    if (typeof Notification === "undefined") {
      setToast("Notifications aren't supported in this browser.");
      return;
    }
    if (notifyEnabled) {
      update({ notifyEnabled: false });
      return;
    }
    if (Notification.permission === "denied") {
      setToast("Notifications are blocked — enable them in your browser settings.");
      return;
    }
    const permission =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") update({ notifyEnabled: true });
    else setToast("Notifications weren't allowed.");
  };

  const confirmCancelWorkout = () => {
    haptic([40, 60, 40]);
    setCancelConfirmOpen(false);
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
          ? () => setPos({ block: blockIndex + 1, slot: 0, round: 1 })
          : null;
      rest.start(restFor(planIndex));
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
      setToast(`Great set! Straight into ${bEx?.name ?? "Exercise B"}`);
      setPos((p) => ({ ...p, slot: 1 }));
      return;
    }

    const nextSlot = remaining(0) > 0 ? 0 : remaining(1) > 0 ? 1 : -1;
    afterRest.current = () => {
      if (nextSlot >= 0) setPos((p) => ({ ...p, slot: nextSlot, round: p.round + 1 }));
      else if (blockIndex < blocks.length - 1) setPos({ block: blockIndex + 1, slot: 0, round: 1 });
    };
    // The pair rest lives on slot B.
    rest.start(restFor(block.indices[block.indices.length - 1]!));
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header
        className={`safe-top glass-strong sticky top-0 z-30 border-x-0 border-t-0 pb-3 transition-[filter] duration-300 ${
          resting ? "brightness-[0.7]" : ""
        }`}
      >
        <div className="mx-auto w-full max-w-xl px-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => navigate({ to: "/" })}
              className="glass flex size-11 items-center justify-center rounded-full"
              aria-label="Close session"
            >
              <X className="size-5" />
            </button>
            <div className="text-center">
              <p className="tabular text-2xl font-bold leading-none">
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                {String(elapsed % 60).padStart(2, "0")}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {activeWorkout.target_muscles.join(" · ") || "Workout"} · {done}/{totalSets} sets
              </p>
            </div>
            <button
              onClick={() => setListOpen(true)}
              aria-label="Workout overview"
              className="glass flex size-11 items-center justify-center rounded-full"
            >
              <List className="size-5 text-primary" />
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (done / Math.max(1, totalSets)) * 100)}%` }}
            />
          </div>
        </div>
      </header>

      {rest.phase !== "idle" ? (
        <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-2">
          <div
            className={`glass-strong mt-16 flex min-w-[220px] flex-col gap-2 rounded-3xl px-5 py-3 shadow-[var(--shadow-float)] ${restDone ? "flash" : ""}`}
          >
            <div className="flex items-center gap-3">
              <Flame className="size-5 text-primary" />
              <span className="tabular text-xl font-bold">
                {restDone ? "Rest complete — go!" : `${rest.secondsLeft}s rest`}
              </span>
              <button
                onClick={() => {
                  haptic();
                  rest.skip();
                }}
                className="pointer-events-auto ml-2 min-h-[44px] rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground"
              >
                Skip Rest
              </button>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, (rest.secondsLeft / Math.max(1, rest.duration)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-2">
          <div className="glass-strong mt-16 rounded-2xl bg-primary/20 px-5 py-3 text-center text-[15px] font-bold text-foreground shadow-[var(--shadow-float)]">
            {toast}
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-xl space-y-3 px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-3">
        <div className={isSuperset ? "space-y-3" : ""}>
          {isSuperset ? (
            <p className="rounded-full bg-primary/20 px-4 py-2 text-center text-[12px] font-bold uppercase tracking-widest text-primary">
              {supersetBadge} • Round {Math.min(pos.round, block.rounds)} of {block.rounds}
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
                onLogged={(t) => handleLogged(t, s)}
                complete={doneSets >= p.target_sets}
              />
            );
          })}
        </div>

        {upNext ? (
          <p className="rounded-2xl bg-muted px-4 py-3 text-[14px] text-muted-foreground">
            <span className="font-semibold text-foreground">Up next:</span> {upNext}
          </p>
        ) : null}

        {isLastBlock && blockComplete && planned.bonus ? (
          <div className="glass glow rounded-3xl p-5 text-center">
            <PartyPopper className="mx-auto size-10 text-primary" />
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">
              Outstanding — you went beyond the plan!
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              You didn&apos;t just finish the session, you added an extra exercise on top and closed
              every single set. That is exactly the kind of effort that builds real strength. Be
              proud of this one — you earned every rep.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["Sets", `${done}`],
                ["Volume", `${totalVolume.toLocaleString()} kg`],
                ["Time", `${Math.max(1, Math.round(elapsed / 60))} min`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted px-2 py-3">
                  <p className="tabular text-[18px] font-bold">{value}</p>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={endWorkout}
              className="glow mt-4 min-h-[52px] active:scale-95 w-full rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground"
            >
              Finish workout
            </button>
          </div>
        ) : null}

        <div className="glass space-y-3 rounded-2xl p-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Rest timer</p>
              <div className="flex flex-wrap justify-end gap-1 rounded-full bg-muted p-1">
                {(["auto", 60, 90, 120] as const).map((s) => {
                  const on = s === "auto" ? restOverride == null : restOverride === s;
                  return (
                    <button
                      key={s}
                      onClick={() => update({ restOverride: s === "auto" ? null : s })}
                      className={`min-h-[40px] rounded-full px-3.5 text-[14px] font-semibold ${
                        on ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {s === "auto" ? "Auto" : `${s}s`}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {restOverride == null
                ? "Following each exercise's suggested rest."
                : `Every set rests ${restOverride}s.`}
            </p>
          </div>
          <button
            onClick={() => update({ soundEnabled: !soundEnabled })}
            className="flex w-full items-center justify-between gap-2"
            aria-pressed={soundEnabled}
          >
            <span className="text-[15px] font-semibold">Rest-end beep</span>
            <span
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                soundEnabled
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {soundEnabled ? "On" : "Off"}
            </span>
          </button>
          <button
            onClick={toggleNotify}
            className="flex w-full items-center justify-between gap-2"
            aria-pressed={notifyEnabled}
          >
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              {notifyEnabled ? (
                <Bell className="size-4 text-primary" />
              ) : (
                <BellOff className="size-4 text-muted-foreground" />
              )}
              Rest-end notification
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                notifyEnabled
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {notifyEnabled ? "On" : "Off"}
            </span>
          </button>
          <p className="text-[13px] text-muted-foreground">
            iPhone gives no buzz between sets — the beep is your cue. All weights in kg.
          </p>
        </div>
      </main>

      <nav
        className={`glass-strong fixed inset-x-0 bottom-0 z-30 border-x-0 border-b-0 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-[filter] duration-300 ${
          resting ? "pointer-events-none brightness-[0.55] grayscale-[0.6]" : ""
        }`}
      >
        <div className="mx-auto flex w-full max-w-xl items-center gap-2">
          <button
            onClick={() => goToBlock(blockIndex - 1)}
            disabled={blockIndex === 0}
            aria-label="Previous exercise"
            className="glass flex min-h-[52px] active:scale-95 w-14 items-center justify-center rounded-2xl disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="tabular w-14 text-center text-[13px] font-semibold text-muted-foreground">
            {blockIndex + 1} of {blocks.length}
          </span>
          {isLastBlock ? (
            <>
              {blockComplete && bonusOptions.length > 0 ? (
                <button
                  onClick={addBonus}
                  aria-label="Add an extra exercise"
                  className="glass flex min-h-[52px] active:scale-95 items-center justify-center gap-1 rounded-2xl px-3 text-[14px] font-semibold"
                >
                  <Plus className="size-5 text-primary" /> Extra
                </button>
              ) : null}
              <button
                onClick={endWorkout}
                className={`flex min-h-[52px] active:scale-95 flex-1 items-center justify-center gap-1 rounded-2xl text-[15px] font-bold ${
                  blockComplete
                    ? "glow bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                Finish workout
              </button>
            </>
          ) : (
            <button
              onClick={() => goToBlock(blockIndex + 1)}
              disabled={!blockComplete}
              className={`flex min-h-[52px] active:scale-95 flex-1 items-center justify-center gap-1 rounded-2xl text-[15px] font-bold transition-all ${
                blockComplete
                  ? "glow animate-pulse bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground opacity-60"
              }`}
            >
              {isSuperset ? "Complete superset" : "Next exercise"}{" "}
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>
      </nav>

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

      <BottomSheet open={listOpen} onClose={() => setListOpen(false)} title="Workout overview">
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <button
              key={`block-${i}`}
              onClick={() => {
                setPos({ block: i, slot: 0, round: 1 });
                setListOpen(false);
              }}
              className={`w-full rounded-2xl p-4 text-left ${i === blockIndex ? "bg-primary/15" : "glass"}`}
            >
              {b.group !== undefined ? (
                <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">
                  Superset · {b.rounds} rounds
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
                    <span className="tabular w-5 text-lg font-bold text-primary">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-[16px] font-semibold">{ex?.name}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {logged}/{p.target_sets} sets · {p.target_reps} reps
                      </p>
                    </div>
                    {logged >= p.target_sets ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : null}
                  </div>
                );
              })}
            </button>
          ))}
        </div>
        <button
          onClick={requestCancelWorkout}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-bold text-destructive active:scale-95"
        >
          <Ban className="size-4" /> Cancel workout
        </button>
      </BottomSheet>

      {cancelConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            aria-label="Keep training"
            onClick={() => setCancelConfirmOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="glass-strong relative w-full max-w-sm rounded-3xl p-6 text-center shadow-[var(--shadow-float)]">
            <h2 className="text-xl font-bold tracking-tight">Cancel this workout?</h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {done} logged {done === 1 ? "set" : "sets"} will be discarded. This can&apos;t be
              undone.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={confirmCancelWorkout}
                className="min-h-[52px] w-full rounded-2xl bg-destructive text-[15px] font-bold text-destructive-foreground active:scale-95"
              >
                Cancel workout
              </button>
              <button
                onClick={() => setCancelConfirmOpen(false)}
                className="min-h-[52px] w-full rounded-2xl bg-secondary text-[15px] font-semibold text-secondary-foreground active:scale-95"
              >
                Keep training
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
  onLogged,
  complete: exerciseComplete,
}: {
  planned: PlannedExercise;
  index: number;
  total: number;
  round?: number | undefined;
  letter?: "A" | "B" | undefined;
  active: boolean;
  /** Rest timer running — the Log / Repeat buttons are disabled (inputs stay live). */
  locked?: boolean | undefined;
  /** Brief pulse when the rest ends and this card is up next. */
  flash?: boolean | undefined;
  /** Seconds of rest this exercise will actually use, for the subtitle. */
  restForThisExercise: number;
  cardRef?: React.MutableRefObject<HTMLElement | null> | undefined;
  onSwap: () => void;
  onLogged: (type: SetType) => void;
  complete: boolean;
}) {
  const {
    activeWorkout,
    workouts,
    logSet,
    updateSet,
    removeSetAt,
    lastPerformance,
    bestSet,
    profiles,
    activeProfileId,
    readinessLog,
  } = useGym();
  const exercise = exerciseById(planned.exercise_id);
  const todayReadiness = todaysCheckIn(readinessLog)?.score;

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
  const previous = lastPerformance(planned.exercise_id);
  const best = bestSet(planned.exercise_id);

  /** Highest rep count ever logged for this exercise, history + current session. */
  const bestReps = useMemo(() => {
    const all = [
      ...workouts.flatMap((w) => w.completed_sets),
      ...(activeWorkout?.completed_sets ?? []),
    ].filter((s) => s.exercise_id === planned.exercise_id && s.set_type === "working");
    return all.reduce((m, s) => Math.max(m, s.reps), 0);
  }, [workouts, activeWorkout, planned.exercise_id]);

  const targetTopReps = useMemo(() => {
    const nums = (planned.target_reps.match(/\d+/g) ?? []).map(Number);
    return nums.length ? Math.max(...nums) : 8;
  }, [planned.target_reps]);

  const lastLogged = logged[logged.length - 1];
  const [weight, setWeight] = useState<string>("");
  const [reps, setReps] = useState<string>("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [setType, setSetType] = useState<SetType>(planned.warmup_sets > 0 ? "warmup" : "working");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editW, setEditW] = useState(0);
  const [editR, setEditR] = useState(0);

  /** Progressive-overload suggestion for this exercise, freshly derived from history. */
  const suggestion = useMemo(
    () => suggestWeight(planned.exercise_id, workouts, planned.target_reps, todayReadiness),
    [workouts, planned.exercise_id, planned.target_reps, todayReadiness],
  );

  useEffect(() => {
    if (warmupsLogged >= planned.warmup_sets) setSetType((t) => (t === "warmup" ? "working" : t));
  }, [warmupsLogged, planned.warmup_sets]);

  // Absolute indices into completed_sets shift when any set is added/removed.
  useEffect(() => {
    setEditIdx(null);
  }, [logged.length]);

  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const prefillWeight = lastLogged?.weight ?? suggestion?.weight ?? previous?.weight ?? 0;
  const prefillReps = bestReps || targetTopReps;

  if (!exercise) return null;

  const step = plateStep(exercise, profile);

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
  const logCurrent = () =>
    submitSet(
      parseDecimal(weight === "" ? String(prefillWeight) : weight),
      parseDecimal(reps === "" ? String(prefillReps) : reps),
      rpe ?? undefined,
    );
  const repeatLast = () =>
    lastLogged ? submitSet(lastLogged.weight, lastLogged.reps, rpe ?? undefined) : logCurrent();

  const bumpWeight = (dir: 1 | -1) => {
    haptic(10);
    const cur = parseDecimal(weight === "" ? String(prefillWeight) : weight);
    setWeight(String(Number(Math.max(0, cur + dir * step).toFixed(2))));
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
  const nextPrevious = previousSets[logged.filter((s) => s.set_type === "working").length];

  const GRID = "grid grid-cols-[2rem_2.75rem_1fr_minmax(3.5rem,1fr)] items-center gap-1.5";
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            {letter ? `Exercise ${letter}` : `Exercise ${index + 1} of ${total}`}
          </p>
          <h2 className="mt-1 text-[24px] font-bold leading-[1.1] tracking-tight">
            {exercise.name}
          </h2>
          <p className="mt-1.5 truncate text-[12px] text-muted-foreground">
            {planned.warmup_sets ? `${planned.warmup_sets} warm-up · ` : ""}
            Target {planned.target_sets} × {planned.target_reps} · {restForThisExercise}s rest ·{" "}
            <span className="capitalize">{exercise.primary_muscle}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onSwap}
            aria-label="Swap exercise"
            className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
          >
            <Repeat className="size-4" />
          </button>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`DeltaBolic ${exercise.name}`)}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Watch demo"
            className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
          >
            <Youtube className="size-4 text-primary" />
          </a>
        </div>
      </div>

      {exerciseComplete ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary/15 px-4 py-3">
          <CheckCircle2 className="size-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[15px] font-bold">Well done — {planned.target_sets} sets logged</p>
            <p className="text-[13px] text-muted-foreground">
              {index >= total - 1 ? "Finish your workout below." : "Move on to the next exercise."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-1.5">
        <div
          className={`${GRID} px-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground`}
        >
          <span>Set</span>
          <span>Prev</span>
          <span className="text-center">kg</span>
          <span className="text-center">Reps</span>
        </div>

        {logged.map((s, i) => {
          const abs = (activeWorkout?.completed_sets ?? []).indexOf(s);
          if (editIdx === abs) {
            return (
              <div key={`edit-${abs}`} className="space-y-2 rounded-xl bg-primary/15 p-2">
                <div className="flex items-center gap-2">
                  <span className="tabular w-6 shrink-0 text-[15px] font-bold text-primary">
                    {s.set_type === "warmup" ? "W" : s.set_number}
                  </span>
                  <Stepper value={editW} onChange={setEditW} step={step} ariaLabel="weight kg" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0" />
                  <Stepper value={editR} onChange={setEditR} step={1} min={0} ariaLabel="reps" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      haptic(15);
                      updateSet(abs, { weight: editW, reps: editR });
                      setEditIdx(null);
                    }}
                    className="min-h-11 flex-1 rounded-xl bg-primary text-[14px] font-bold text-primary-foreground active:scale-95"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      haptic(15);
                      removeSetAt(abs);
                      setEditIdx(null);
                    }}
                    className="min-h-11 rounded-xl bg-secondary px-4 text-[14px] font-semibold text-destructive active:scale-95"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setEditIdx(null)}
                    className="min-h-11 rounded-xl bg-secondary px-4 text-[14px] font-semibold text-muted-foreground active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }
          return (
            <button
              key={`${s.set_number}-${i}`}
              onClick={() => openEdit(abs, s)}
              aria-label={`Edit set ${s.set_number}`}
              className={`${GRID} w-full rounded-xl bg-primary/15 px-0.5 py-2 text-left active:scale-[0.99]`}
            >
              <span className="tabular text-[15px] font-bold text-primary">
                {s.set_type === "warmup" ? "W" : s.set_number}
              </span>
              <span className="tabular text-[13px] text-muted-foreground">
                {previousSets[i] ? `${previousSets[i]!.weight} × ${previousSets[i]!.reps}` : "—"}
              </span>
              <span className="tabular text-center text-[16px] font-semibold">{s.weight}</span>
              <span className="tabular text-center text-[16px] font-semibold">
                {s.reps}
                {s.rpe ? <span className="ml-1 text-[11px] text-primary">@{s.rpe}</span> : null}
              </span>
            </button>
          );
        })}

        <div className={`space-y-2 pt-1 ${!active ? "pointer-events-none opacity-50" : ""}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic(10);
                setSetType((t) => (t === "warmup" ? "working" : "warmup"));
              }}
              aria-label={
                setType === "warmup"
                  ? "Warm-up set — tap for working set"
                  : "Working set — tap for warm-up"
              }
              className={`tabular size-11 shrink-0 rounded-xl text-[15px] font-bold active:scale-95 ${
                setType === "warmup"
                  ? "bg-primary/25 text-primary"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {setType === "warmup" ? "W" : logged.length + 1}
            </button>
            <span className="text-[12px] text-muted-foreground">
              {nextPrevious
                ? `Last time: ${nextPrevious.weight} × ${nextPrevious.reps}`
                : "First time on this one"}
            </span>
          </div>

          {!lastLogged && suggestion && suggestion.direction !== "same" ? (
            <p className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3 py-2 text-[13px] font-semibold text-primary">
              {suggestion.direction === "up" ? (
                <TrendingUp className="size-4 shrink-0" />
              ) : (
                <TrendingDown className="size-4 shrink-0" />
              )}{" "}
              Suggested {suggestion.weight}kg — {suggestion.reason}
            </p>
          ) : null}

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => bumpWeight(-1)}
              aria-label="Less weight"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
            >
              <Minus className="size-4" />
            </button>
            <div className="relative min-w-0 flex-1">
              <input
                inputMode="decimal"
                type="text"
                value={weight}
                aria-label="Weight in kg"
                placeholder={`${prefillWeight}`}
                onFocus={placeCursorAtEnd}
                onChange={(e) => {
                  if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                  setWeight(e.target.value);
                }}
                className="tabular h-12 w-full rounded-xl bg-muted px-8 text-center text-base font-bold text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                kg
              </span>
            </div>
            <button
              onClick={() => bumpWeight(1)}
              aria-label="More weight"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => bumpReps(-1)}
              aria-label="Fewer reps"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
            >
              <Minus className="size-4" />
            </button>
            <div className="relative min-w-0 flex-1">
              <input
                inputMode="numeric"
                type="text"
                value={reps}
                placeholder={`${prefillReps}`}
                aria-label="Reps"
                onFocus={placeCursorAtEnd}
                onChange={(e) => {
                  if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                  setReps(e.target.value);
                }}
                className="tabular h-12 w-full rounded-xl bg-muted px-10 text-center text-base font-bold text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                reps
              </span>
            </div>
            <button
              onClick={() => bumpReps(1)}
              aria-label="More reps"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {setType === "working" ? (
            <div className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                RPE
              </span>
              <div className="flex flex-1 gap-1">
                {[6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      haptic(8);
                      setRpe((cur) => (cur === n ? null : n));
                    }}
                    aria-pressed={rpe === n}
                    aria-label={`Rate of perceived exertion ${n}`}
                    className={`h-10 flex-1 rounded-lg text-[13px] font-bold active:scale-95 ${
                      rpe === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <PlateHint
            exerciseId={exercise.id}
            target={parseDecimal(weight === "" ? String(prefillWeight) : weight)}
          />

          {lastLogged ? (
            <button
              onClick={repeatLast}
              disabled={!active || locked}
              className={`min-h-14 w-full rounded-2xl text-[16px] font-bold active:scale-[0.99] ${
                !active || locked
                  ? "bg-secondary text-muted-foreground opacity-50"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {locked ? "Resting…" : `Repeat  ${lastLogged.weight} × ${lastLogged.reps}`}
            </button>
          ) : null}
          <button
            onClick={logCurrent}
            disabled={!active || locked}
            className={`min-h-14 w-full rounded-2xl text-[16px] font-bold active:scale-[0.99] ${
              !active || locked
                ? "bg-secondary text-muted-foreground opacity-50"
                : lastLogged
                  ? "border border-primary/60 text-primary"
                  : "bg-primary text-primary-foreground"
            }`}
          >
            {locked ? "Resting…" : "Log set"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-right text-[13px] text-muted-foreground">
        {previous ? `Last: ${previous.weight}kg × ${previous.reps}` : "No history yet"}
      </p>

      {isPR ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary/15 px-3 py-2 text-[14px] font-semibold text-primary">
          <Trophy className="size-4" /> PR pace — above your best of {best?.weight}kg × {best?.reps}
        </p>
      ) : null}

      <div className="mt-3 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-primary">
          <Lightbulb className="size-4" /> Key form cues
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {sentence(exercise.instructions)}
        </p>
        <ul className="mt-2 space-y-1.5">
          {exercise.cues.map((c) => (
            <li key={c} className="flex items-start gap-2 text-[14px] font-medium text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} />
              <span>{sentence(c)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Numeric field with big −/+ buttons, for editing a logged set. */
function Stepper({
  value,
  onChange,
  step,
  min = 0,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  ariaLabel: string;
}) {
  const set = (v: number) => onChange(Number(Math.max(min, v).toFixed(2)));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <button
        onClick={() => {
          haptic(10);
          set(value - step);
        }}
        aria-label={`Less ${ariaLabel}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="decimal"
        type="text"
        value={Number.isFinite(value) ? value : ""}
        aria-label={ariaLabel}
        onFocus={placeCursorAtEnd}
        onChange={(e) => {
          if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
          onChange(e.target.value === "" ? min : parseDecimal(e.target.value));
        }}
        className="tabular h-12 w-full min-w-0 flex-1 rounded-xl bg-muted px-1 text-center text-base font-bold text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        onClick={() => {
          haptic(10);
          set(value + step);
        }}
        aria-label={`More ${ariaLabel}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-95"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
