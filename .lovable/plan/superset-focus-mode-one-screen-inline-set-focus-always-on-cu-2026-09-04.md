# Superset Focus Mode: one screen, inline set focus, always-on cues

Rework the active workout screen so a superset pair lives on a single page, the active set highlight moves inline between the two cards, the bottom button only lights up when the whole block is done, and form cues are always visible.

## 1. Unified superset block

- A superset pair renders both exercises stacked on the same screen inside one "Superset Block" container (accent border, rounded), with a status badge at the top: `SUPERSET 1/2 • ROUND 1 OF 3`.
- No view switching between A and B, and no per-slot navigation. Previous/Next move between blocks only.
- Standalone exercises keep the current single-card look.
- The "Up Next" banner now names the next block (never Exercise B, since B is already on screen).

## 2. Inline set focus and auto-advance

- One active target per block: which card (A or B) and which set row is live. The active card gets a focus ring and its input row is enabled; the inactive card is dimmed with its row read-only until focus arrives.
- Complete A set 1 → focus slides to B set 1 immediately, no rest timer, short "straight into [B]" hint.
- Complete B set 1 → rest timer starts (pair rest, 90–120s).
- Rest ends → focus jumps back up to A, next round.
- Loop until every set of both exercises is logged. If one exercise has sets remaining and the other is finished, focus simply stays on the unfinished one.
- Standalone exercise: unchanged — completing a set starts its own rest timer.
- Auto-scroll the newly focused card into view so the user never hunts for it.

## 3. Next / Complete Superset button

- Completion is computed across every required working set in both exercises of the block.
- Until then the button stays subtle (muted secondary, non-interactive).
- When the block completes: the button turns vibrant primary with a glow pulse and a haptic buzz, labelled "Complete superset" for pairs and "Next exercise" otherwise; on the final block it is "Finish workout".

## 4. Always-expanded form cues

- Remove the collapsible "Form hints" accordion and its toggle state.
- Every exercise card ends with a permanent glass panel: a lightbulb icon plus "Key Form Cues" header, the instruction line, then the cues as a high-contrast bulleted list.
- Cues re-read from the current exercise, so they update on block change and after a swap.

## Technical notes

- `src/routes/session.tsx` only; no data model or generator changes.
- Focus state becomes `{ block, slot, round }` where `slot` is the active card within the block rather than the only visible card; the block renders `block.indices.map(...)`.
- `ExerciseBlock` gains `active: boolean` (focus ring / dim + input gating) and drops `cuesOpen` / `onToggleCues`; `blockComplete` already sums both indices and now drives the bottom button, a `useEffect` firing `haptic()` on the false→true transition.
- Rest completion callback (`afterRest`) sets the next focus target: same block round + 1, or the next block when the pair is done.
- Scroll-into-view via a ref on the active card in a `useEffect` keyed on the focus target.
