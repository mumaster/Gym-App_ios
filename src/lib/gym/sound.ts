/**
 * Rest-end audio cue. iOS Safari gives no vibration, so a short beep is the only
 * reliable "go" signal. The AudioContext must be created/resumed from inside a
 * user gesture (the first logged set) or the browser keeps it suspended.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Call from a tap handler so later beeps are allowed to play. Safe to call often. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

/** Three short 880 Hz beeps. No-op if audio is unavailable or still suspended. */
export function playRestEndBeep(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  try {
    const start = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const t0 = start + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
  } catch {
    /* context closed / interrupted — nothing to play */
  }
}
