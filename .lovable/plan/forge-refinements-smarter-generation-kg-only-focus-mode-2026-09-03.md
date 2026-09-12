# Forge refinements: smarter generation, kg-only, focus mode

## 1. Time-accurate generator

Rewrite the generator to build the plan against a real time budget instead of a fixed slot count.

- Duration model: each working set ≈ 45s of work; warmup sets ≈ 30s; add each exercise's rest interval per set (rest is skipped after the last set of the final exercise) plus ~45s transition between exercises.
- Fill loop: keep adding exercises/sets while the running estimate stays under the selected time, stop within roughly ±5% of target.
- Shape by duration:
  - 15 min: 2–3 exercises, 2 working sets each, 45–60s rest, compounds only.
  - 30 min: 3–4 exercises, 3 sets, 60s rest.
  - 45 min: 4–5 exercises, compounds + 1–2 accessories, 75–90s rest.
  - 60 min: 5–6 exercises with warmup sets on the main lift.
  - 90 min: 7–8 exercises, warmup sets on compounds, 4 sets on compounds, extra isolation, 90–120s rest — estimate must land at 85–90 min.
- `estimateMinutes` uses the same formula so the plan header, generation and the session view all agree.
- Add `warmup_sets` to the planned-exercise model so long sessions actually schedule them.

## 2. Equipment selector + kg

- Split equipment into distinct toggles: Smith Machine (guided barbell), High Cable Pulley (lat station / overhead cable), Adjustable Bench (flat / incline / decline), Leg Developer (leg extension + lying leg curl), alongside the existing bodyweight, barbell, dumbbell, low/mid cable, bands, kettlebell, pull-up bar, leg press, machines.
- Existing exercises are re-tagged to the new equipment IDs so filtering stays correct; saved profiles missing a new ID are migrated on load.
- Kilograms become the only unit: remove the kg/lbs switch in the session settings, drop `lbs` from the data model, and label every weight input, log row, PR badge and volume chart in kg. Stored workouts carrying `lbs` are displayed as kg-labelled values (no conversion applied to historical numbers).

## 3. More than 2 muscle groups warning

On the generator screen, when 3+ muscle groups are selected show a subtle inline warning banner above the generate button:

> Warning: Targeting more than 2 major muscle groups in a single session may reduce focus, increase system fatigue, and slow down strength progress.

Non-blocking — generation still works.

## 4. Editing and bug fixes

- Reordering: up/down arrow controls on each exercise card, available in the plan preview and inside the running session (reordering the remaining exercises).
- Swap: every exercise card (preview and session) gets a Swap button opening a sheet of same-primary-muscle alternatives filtered to the active equipment profile; picking one replaces it in place, preserving sets/reps/rest.
- Shuffle: fix so it re-runs generation with a varied pick (rotating past the previously chosen exercises) rather than returning the same list, and force a visible state update.

## 5. Focus mode session

Rework `/session` to show one exercise at a time:

- Current exercise card: name, target sets × reps, rest, cues, previous performance, set logging, rest timer.
- Sticky bottom bar with Previous / Next exercise plus an "x of n" progress indicator and thin progress bar.
- Swap and reorder actions live in the current card's header menu.
- Finish workout stays available from the header; the full list is reachable through a collapsible "All exercises" sheet rather than the main view.

## 6. Exercise library additions

Add ~15 exercises with the new equipment tags:

- Smith Machine: incline press, flat press, squat, Romanian deadlift, hip thrust, shoulder press.
- High Cable Pulley: lat pulldown, straight-arm pulldown, tricep rope pushdown, face pull.
- Leg Developer: seated leg extension, lying leg curl.
- Adjustable Bench: incline dumbbell flye, decline pushup, incline dumbbell row.

Each with primary/secondary muscles, movement pattern, compound flag, instructions and cues, matching the existing seed format.

## Technical notes

- Files touched: `src/lib/gym/types.ts` (equipment IDs, warmup sets, unit), `src/lib/gym/data.ts` (equipment list, profiles, new exercises), `src/lib/gym/generator.ts` (budget-based generation + shared estimator), `src/lib/gym/store.tsx` (kg-only, profile migration, plan mutation helpers: reorder/swap), `src/routes/index.tsx` (warning, reorder/swap, shuffle fix), `src/routes/session.tsx` (focus mode), `src/routes/equipment.tsx`, `src/routes/history.tsx`, `src/routes/exercises.tsx` (kg labels, new equipment).
- State stays in localStorage with the existing key; a version bump plus migration keeps old saved data loadable.
