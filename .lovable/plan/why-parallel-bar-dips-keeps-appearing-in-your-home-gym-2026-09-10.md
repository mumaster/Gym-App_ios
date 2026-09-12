# Why Parallel Bar Dips keeps appearing in your home gym

Dips is currently stored as needing only "Bodyweight". Your home gym profile includes Bodyweight, so the generator treats dips as always possible — even though you have no dip bars.

Same issue applies to any move that really needs a fixed station but is tagged bodyweight-only.

## Fix

1. Add a new equipment option: **Dip bars / parallel bars**.
2. Mark Parallel Bar Dip as requiring dip bars (so it only shows when that gear is switched on).
3. Review the other bodyweight-tagged moves and re-tag ones that need real gear (e.g. hyperextension/back extension bench, captain's chair leg raise if present); leave true floor moves (push-ups, planks, lunges) as bodyweight.
4. Your home gym profile stays as is, so dips will disappear from generated workouts until you add dip bars. Bench Dip (bodyweight + bench) remains available as the triceps alternative.
5. Equipment profile screen shows the new toggle so you can turn dip bars on if you ever get them.

## Technical notes

- Add `dip_bars` to `EquipmentId` in `src/lib/gym/types.ts` and to the equipment option list in `src/lib/gym/data.ts`.
- Update the `dips` row in the exercises table (`equipment_required` -> `{bodyweight,dip_bars}`) and the matching seed entry in `data.ts`, plus any other mis-tagged rows found in the same pass.
- No generator change needed: `availableExercises` already requires every listed equipment id to be active.
