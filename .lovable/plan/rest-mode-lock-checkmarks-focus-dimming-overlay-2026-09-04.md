# Rest Mode: lock checkmarks + focus/dimming overlay

All changes in `src/routes/session.tsx` (plus one utility keyframe in `src/styles.css` only if the existing `flash` utility can't be reused for the completion pulse — it can, so likely no CSS file changes).

## Resting state definition

- Derive a single flag: `resting = rest !== null && !restDone`.
- Rest Mode is active while the countdown is running. It ends the moment the countdown hits 0 (the existing "Rest complete — go!" flash phase) or when `endRestNow()` runs via **Skip Rest** — both paths already funnel through the same state, so no new logic branches are needed.

## 1. Lock set checkmarks while resting

- Pass `resting` (or a `locked` prop) down to every `ExerciseBlock`.
- While locked, each set-row checkmark / "Complete set" button is `disabled`, with muted styling: `opacity-40`, muted colors, `pointer-events-none`.
- Unlock happens automatically on both exit paths because `resting` flips false when the countdown reaches 0 or Skip Rest fires — no extra wiring.

## 2. Rest Mode dimming transition

- Wrap the main content column (header actions, exercise cards, set tables, bottom nav) in a container that gets, while `resting`:
  - `filter: brightness(0.35) grayscale(0.7)` with `transition: filter 0.4s ease`
  - `pointer-events-none` so no background taps land
- On rest end, transition back to `brightness(1) grayscale(0)` over ~0.3s and restore `pointer-events-auto`.
- The floating rest banner lives **outside** the dimmed container (it already renders as a fixed overlay), so it stays at full opacity, saturation and contrast, with its Skip Rest button fully tappable — that banner keeps its own `pointer-events` handling.

## 3. Rest-complete cue

- When `resting` flips false (timer zero or Skip Rest):
  - Apply the existing `flash` ring-pulse animation to the newly active exercise card (the card receiving focus via `activeCardRef`).
  - Fire a short haptic ping (`haptic()`) — the timer-zero path already haptics today; extend the same cue to the Skip Rest path so both feel identical.

## Technical notes

- `src/routes/session.tsx` only: new `resting` boolean, `locked` prop on `ExerciseBlock`, wrapper div with conditional dim classes, `flash` class keyed to the focus card on rest end.
- No store, generator, or data-model changes. Superset and standalone flows both covered because both set `rest` through the same code path.
- Verify: typecheck + a Playwright pass that starts a rest, confirms checkmarks are disabled and the background is dimmed, taps Skip Rest, and confirms immediate unlock/restore with no console errors.
