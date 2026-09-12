# Rest timer: global default override + Skip Rest button

## 1. Global default rest overrides per-exercise rest

- In `session.tsx`, the rest duration used after a logged set is currently `planned.rest_seconds || restSeconds`. Change it so the session-wide default (`restSeconds` from the store, set in the "Default rest" card) always wins, for both standalone exercises and superset pair rests.
- The rest progress bar denominator uses the same global value so the bar animates correctly.
- Update the "Default rest" card copy from "Used when an exercise has none" to reflect that it applies to every set (e.g. "Applies to every set in this session").
- Exercise cards: replace the per-exercise "Ns rest / no rest" line with the effective rest (the global default) so what the card shows matches what actually happens.
- No generator or data-model changes; `planned.rest_seconds` stays stored but is no longer consulted during the session. Manual on-the-fly adjustment remains available via the Default rest selector.

## 2. "Skip Rest" button in the timer banner

- Add a high-contrast "Skip Rest" button to the floating rest banner (next to the countdown, primary-colored, min 44px tap target).
- Tapping it:
  1. Clears the countdown state and the "rest complete" flash immediately.
  2. Runs the pending `afterRest` callback right away — the exact same advance logic as when the timer hits zero (next round of A in a superset, or next block) — then clears the ref.
  3. Fires a short haptic tap.
- Extract the shared "finish rest now" logic into one function used by both the natural timer completion and the Skip button, so the two paths can't drift apart.
- The button stays pointer-interactive while the banner container remains non-blocking for the rest of the screen.

## Technical notes

- `src/routes/session.tsx` only.
- New helper `endRestNow()` encapsulates: `setRest(null)`, `setRestDone(false)`, invoke + clear `afterRest.current`, `haptic()`. The zero-countdown timeout path calls it too.
- Skip also works while the banner is in the "Rest complete — go!" state (simply dismisses early).
