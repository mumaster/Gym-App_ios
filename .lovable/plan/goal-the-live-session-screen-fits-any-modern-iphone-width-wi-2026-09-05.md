Goal: the live session screen fits any modern iPhone width with nothing clipped, one clean card frame per exercise, and a set table whose headers line up exactly with the controls below.

What changes on screen

**Set rows**

One strict grid for both the header row and every set row: set number, previous log, kg input, reps stepper, tick button.

The tick becomes a 40x40 rounded square, sitting as the last column inside the card, so it can no longer spill past the card edge or get cut off.

Reps keep the minus / number / plus stepper; the number field and kg field stay at 16px+ so tapping them never zooms the page.

Previous column shows ⁠20 × 10⁠ or a dash.

**Active Exercise Highlight & Clean Frames**

Preserve active exercise highlighting: the currently active exercise in a superset must remain prominently highlighted (using a vibrant accent border glow and focus marker) so the user always knows which exercise is active.

Drop the extra nested superset frame border so there is only one clean card outline per exercise. The superset pair keeps a status badge instead of a heavy outer box.

Cards: translucent dark surface, soft hairline border, large corner radius, on true black. Accent colour is used for the active exercise border highlight, active card marker, completed ticks, and status badges.

**Set type**

Remove the Working / Warmup pill row under the table. The set number itself becomes tappable and toggles to a small ⁠W⁠ badge for a warm-up set.

**Header of each card**

Exercise title, then one single metadata line under it (warm-up count, target sets x reps, rest).

Swap and Watch move into one small horizontal button bar in the top-right corner of the card.

**Screen chrome**

Top bar (timer, muscle groups, exit) gets dynamic top safe-area padding.

Bottom action bar gets ⁠pb-[max(1.25rem,env(safe-area-inset-bottom))]⁠ so it clears the home indicator and Safari's bottom bar.

**Form cues**

Each cue line rendered with a consistent bullet icon and sentence capitalisation.

Technical notes

All work in ⁠src/routes/session.tsx⁠ (the ⁠ExerciseBlock⁠ component plus the page shell); no logic, generator, or store changes.

Shared grid template ⁠grid-cols-[2rem_2.75rem_1fr_minmax(7.5rem,1.4fr)_2.5rem]⁠ applied to header, logged rows, and the input row, with ⁠min-w-0⁠ on the flexible columns so the row cannot overflow at 375px.

Card class becomes a single ⁠rounded-3xl⁠ translucent surface; active exercise state maintains its dedicated accent highlight border (e.g., ⁠border-emerald-500⁠ / active ring) to preserve focus while removing nested outer container clutter.

⁠setType⁠ toggling moves onto the set-number button; the existing ⁠setType⁠ state and ⁠logSet⁠ call are unchanged.

Cue capitalisation done at render time, data untouched.

Verify at 375x812 and 402x725 with a Playwright screenshot that no element extends past the card, the active exercise is clearly highlighted, and the header labels align with their columns.