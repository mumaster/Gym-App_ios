# Forge — Session focus polish, plate math and theming

## 1. Active workout: set-gated Next button

- The Next button stays dimmed/secondary while the current exercise has fewer logged working sets than its target.
- When the target set count is reached: show a "Well done — exercise complete" banner on the card, and promote Next to the full-width primary (glowing) action so it's the obvious next step. Prev shrinks to an icon button.
- On the last exercise, the promoted action becomes "Finish workout" instead of Next.
- Warm-up sets don't count toward the target.

## 2. Form cues always visible

Remove the collapsible toggle; instructions and cues render as a permanent block on the exercise card.

## 3. YouTube Shorts lookup

Add a "Watch on YouTube" button next to Swap that opens a new tab to a Shorts search scoped to the DeltaBolic channel, using the exercise name as the query (channel search URL with the exercise name, so results stay within that creator's shorts).

## 4. Remove reorder in the session

Delete the up/down arrows from the active exercise card. Swap stays. Reordering remains available on the generated plan preview before starting.

## 5. Workout tab duration control

Quick shortcut chips reduce to 30 / 45 / 60 minutes. All other durations (15, 20, 75, 90) stay reachable through the existing wheel picker, which keeps the full list.

## 6. Equipment tab: plate inventory + per-exercise plate suggestions

- New "Plates" section in the equipment profile: for each plate size (0.5, 1.25, 2.5, 5, 10, 20 kg) a stepper for how many the user owns (counted as pairs).
- Bar weight is configurable per profile (default 20 kg barbell, 2 kg dumbbell handle).
- On barbell/dumbbell/smith exercises in the session, show a plate breakdown line under the weight input: e.g. `60 kg = bar + 20 + 10 per side`, computed greedily from the owned inventory, and flagged as "closest loadable: 57.5 kg" when the exact target can't be built.
- Stored per equipment profile so different gyms can have different plate sets.

## 7. Theme color selector

New "Appearance" section (Equipment tab) with a row of accent swatches — Electric Green (current default), Blue, Orange, Purple, Pink, Yellow. Selecting one writes the accent tokens (`--primary`, `--ring`, glow, chart-1) at runtime and persists in the store; app stays dark-mode.

## Technical notes

- `types.ts`: add `plates: Record<string, number>`, `bar_weight`, `dumbbell_bar_weight` to `EquipmentProfile`; add `accent` to app state.
- `store.tsx`: bump migration to fill plate defaults on existing profiles and default accent; add an `accent` setter.
- New `src/lib/gym/plates.ts`: pure `solvePlates(target, bar, inventory)` returning per-side plates plus achievable weight.
- New `src/components/gym/PlateHint.tsx` and `ThemePicker.tsx`.
- `styles.css`: define accent presets as CSS classes on `<html>` (e.g. `.accent-blue`), applied from the root route based on stored accent.
- `session.tsx`: focus-card changes (cues, YouTube, no reorder, completion banner, gated nav bar).
- `index.tsx`: shortcut chips to 30/45/60.
