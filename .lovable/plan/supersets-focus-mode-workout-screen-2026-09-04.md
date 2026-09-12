# Supersets + Focus Mode workout screen

Adds a superset system to the generator and rebuilds the active workout screen as a true-black, single-exercise Focus Mode with superset-aware rest logic.

## 1. Generator setup screen

- New "Enable Supersets" iOS-style switch near the time/muscle selectors, default OFF.
- "Rounds per Superset" segmented control (2 / 3 / 4, default 3), only shown when the switch is ON.
- Both settings persist with the rest of the app state and are passed into generation.

## 2. Pairing logic

When supersets are ON, the generator groups exercises into pairs after picking them:

1. Antagonist pairs first (push paired with pull, quads with hamstrings, etc.).
2. Otherwise compound + isolation on the same muscle.
3. An odd leftover exercise stays standalone.

Each pair runs the chosen number of rounds. Time estimation is updated so paired sets count zero rest between A and B plus one longer rest after B, keeping the total within the requested duration.

Also, for weight training, pair the supersets based on available equipment so that the least amount of weights need to be removed from the bar/dumbbell. For example pair a dumbbell exercise with a cable exercise and not two cable trainings with two different weights.

## 3. Focus Mode (active workout screen)

- True black background, high-contrast text, large tap targets.
- Header: elapsed time, workout name, list-view button opening the full workout sheet.
- Superset badge in the accent color when applicable: `SUPERSET 1/2 • ROUND 1 OF 3`.
- Exercise card: large name, "Chest • Horizontal Push" badge, Swap button top-right.
- "Up Next" banner under the card naming the next exercise (Exercise B for supersets).
- Set table: `Set #` | `Previous (kg × reps)` | `kg` | `Reps` | checkmark. Inputs prefill from the previous set/session; completing a set turns the row green, fires haptics and moves to the next row.

## 4. Rest and transition logic

- Standalone exercise: checkmark starts the floating rest timer (exercise's rest, 60–90s range).
- Superset A: no timer; jumps straight to B with a 3-second banner "Great set! Move immediately to [B]".
- Superset B: starts the longer pair rest (90–120s). When it ends, loop back to A for the next round, or advance to the next block if all rounds are done.

## 5. Navigation

- Bottom bar: Previous Exercise, Next Exercise, Finish Workout (Finish stays reachable, prominent on the last block).
- Collapsible form-hints accordion at the bottom of the card with the exercise cues.

## Technical notes

- `types.ts`: `PlannedExercise` gains `superset_group?: string` and `superset_slot?: "A" | "B"`; `Workout` gains `superset_rounds?: number`. `LoggedSet` gains an optional `round` so per-round logging is tracked.
- `store.tsx`: new persisted `supersetsEnabled` / `supersetRounds` settings, migration defaults for existing saves, and a helper to resolve the next focus target (round loop vs next block).
- `generator.ts`: `generateWorkout` takes `supersets` and `rounds`; new pairing pass plus `estimateSeconds` handling for zero intra-pair rest.
- `src/routes/session.tsx` is rewritten around a "focus position" (block index, slot, round) instead of a flat exercise index; swap, plate hints, PR display, bonus exercise and finish/confetti behaviour are preserved.
- `styles.css`: a true-black session surface token; the existing accent themes stay in use.