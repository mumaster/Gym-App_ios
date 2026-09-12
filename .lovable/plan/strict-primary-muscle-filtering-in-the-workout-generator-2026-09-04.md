# Strict primary-muscle filtering in the workout generator

## Problem

In `src/lib/gym/generator.ts`, `nextChoice` admits an exercise when the target muscle appears in its **secondary** muscles:

```ts
.filter((e) => e.primary_muscle === muscle || e.secondary_muscles.includes(muscle))
```

So selecting Shoulders/Arms can pull in Dumbbell Bench Press (primary: Chest). A second, subtler issue: the fill loop picks the muscle by `targets[plan.length % targets.length]` and `continue`s when a muscle has no candidates — one muscle with a small pool can starve the others, skewing volume.

## Fix (generator.ts only)

1. **Strict primary rule** — in `nextChoice`, filter to `e.primary_muscle === muscle` only; drop the `secondary_muscles` clause and the now-unneeded primary-first sort tiebreak.
2. **Cross-muscle fallback stays strict** — the existing fallback that tries the *next selected target* muscle is kept, but it too goes through the strict filter, so no unselected primary muscle can ever enter the plan.
3. **Balanced distribution** — track per-target hit counts; each iteration picks the selected muscle with the fewest planned exercises (ties in selection order) instead of simple `plan.length % targets.length`. Muscles with no available candidates are skipped for the remaining iterations, so a dry pool doesn't block the others. Every selected muscle with available exercises gets at least one exercise before any muscle gets a second (within the exercise/time budget).
4. The set top-up loop already rotates across plan entries, which now map 1:1 to distinct muscles early on, so set volume stays even.

## Verification

- Unit-style check via a small script: generate with Shoulders + Arms selected and full equipment; assert every planned exercise has `primary_muscle` in {Shoulders, Arms} and that both muscles appear; run across 15/30/45/60/90 min and several shuffle variations.
- `bunx tsgo --noEmit` clean.
- Playwright spot check on `/` generating a plan and reading the exercise names in the preview.
