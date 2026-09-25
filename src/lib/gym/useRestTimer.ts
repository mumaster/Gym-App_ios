import { useCallback, useEffect, useRef, useState } from "react";

export type RestPhase = "idle" | "counting" | "done";

/** How long the "Rest complete — go!" banner lingers before advancing. */
const DWELL_MS = 2200;
/** Past this much overshoot (phone left locked for ages) we skip the end cue. */
const CUE_WINDOW_MS = 10_000;

interface Machine {
  phase: RestPhase;
  /** Wall-clock ms epoch the countdown reaches zero. */
  endsAt: number;
  /** Original countdown length in seconds — the progress-bar denominator. */
  duration: number;
  /** Set by `skip()` — ends the rest immediately regardless of the clock. */
  skipped?: boolean;
}

export interface RestTimer {
  phase: RestPhase;
  secondsLeft: number;
  duration: number;
  start: (durationSec: number) => void;
  skip: () => void;
  /** Stops the rest silently — no end cue, no dismiss callback (e.g. the
   *  set that started it was undone). */
  cancel: () => void;
  /** Adds seconds to a running countdown. */
  extend: (seconds: number) => void;
}

/**
 * Wall-clock rest timer. The countdown is anchored to an absolute timestamp, so
 * locking the phone or backgrounding the tab never desyncs it — on
 * `visibilitychange` it recomputes and, if the rest already elapsed, fires the
 * end cue and advances.
 *
 * - `onCountdownEnd` fires once when the countdown hits zero (or on `skip` while
 *   still counting).
 * - `onDismiss` fires once when the "go!" dwell finishes (or immediately on `skip`).
 */
export function useRestTimer(opts: {
  onCountdownEnd: () => void;
  onDismiss: () => void;
}): RestTimer {
  const onEnd = useRef(opts.onCountdownEnd);
  const onDismiss = useRef(opts.onDismiss);
  useEffect(() => {
    onEnd.current = opts.onCountdownEnd;
    onDismiss.current = opts.onDismiss;
  });

  const [machine, setMachine] = useState<Machine>({ phase: "idle", endsAt: 0, duration: 0 });
  const [now, setNow] = useState(() => Date.now());
  const cuedFor = useRef(-1);
  const dismissedFor = useRef(-1);

  // tick + catch up the instant the tab becomes visible again
  useEffect(() => {
    if (machine.phase === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [machine.phase]);

  // state machine + one-shot cues, all derived from (machine, now)
  useEffect(() => {
    if (machine.phase === "idle") return;
    const past = now - machine.endsAt;
    if (past < 0 && !machine.skipped) return; // still counting down

    if (cuedFor.current !== machine.endsAt) {
      cuedFor.current = machine.endsAt;
      if (machine.skipped || past < CUE_WINDOW_MS) onEnd.current();
    }

    if (machine.phase === "counting" && !machine.skipped) {
      setMachine((m) => (m.phase === "counting" ? { ...m, phase: "done" } : m));
      return;
    }

    if (machine.phase === "done" && (machine.skipped || past >= DWELL_MS)) {
      if (dismissedFor.current !== machine.endsAt) {
        dismissedFor.current = machine.endsAt;
        onDismiss.current();
      }
      setMachine({ phase: "idle", endsAt: 0, duration: 0 });
    }
  }, [machine, now]);

  const start = useCallback((durationSec: number) => {
    const seconds = Math.max(0, Math.round(durationSec));
    cuedFor.current = -1;
    dismissedFor.current = -1;
    setNow(Date.now());
    setMachine({
      phase: "counting",
      endsAt: Date.now() + seconds * 1000,
      duration: Math.max(1, seconds),
    });
  }, []);

  const skip = useCallback(() => {
    setMachine((m) => (m.phase === "idle" ? m : { ...m, phase: "done", skipped: true }));
    setNow(Date.now());
  }, []);

  const cancel = useCallback(() => {
    setMachine((m) => {
      if (m.phase !== "idle") {
        cuedFor.current = m.endsAt;
        dismissedFor.current = m.endsAt;
      }
      return { phase: "idle", endsAt: 0, duration: 0 };
    });
  }, []);

  const extend = useCallback((seconds: number) => {
    setMachine((m) =>
      m.phase === "counting"
        ? { ...m, endsAt: m.endsAt + seconds * 1000, duration: m.duration + seconds }
        : m,
    );
  }, []);

  const secondsLeft =
    machine.phase === "idle" || machine.skipped
      ? 0
      : Math.max(0, Math.ceil((machine.endsAt - now) / 1000));

  return {
    phase: machine.phase,
    secondsLeft,
    duration: machine.duration,
    start,
    skip,
    cancel,
    extend,
  };
}
