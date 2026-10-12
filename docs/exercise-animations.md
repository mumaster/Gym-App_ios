# Exercise animations: posture and clipping rules

Read this before adding an entry to `EXERCISE_ANIMATIONS`. Born from the first batch (deadlift, RDL, goblet squat, shoulder press, lat pulldown), where Max found clipping and wrong postures.

## Check before shipping

1. Render every exercise in both views at phases 0, 450, 700 and 900 (slider "Move through the rep") at 390 wide and look at them at full size, not thumbnails. Compare with a photo or video of the real lift.
2. Nothing may touch or cross the SVG edge (viewBox is 320 x 206; floor at y 196). Furniture tops need headroom for pulleys and circles: keep tops under about 172 cm at scale 1.05.
3. Tests for geometry (`exerciseAnimation.test.ts`): constant limb lengths, targets within reach (an unreachable wrist silently stretches the forearm), feet planted.

## Check the whole rep, not just the key frames (added after the deadlift legs snapped straight mid-lift)

Four stills can look right while the motion between them is wrong. For every new or changed lift:

1. Sample the pose in small steps (every 0.05 of depth) from the bottom to the top and print the hip-to-ankle distance, knee position and torso angle, or render a strip of 10+ frames.
2. Joint distances must change smoothly and in one direction: no early lockout (legs fully straight while the hips are still back), no sudden jump between neighbouring samples, no knee kicking far forward and coming back.
3. Add a test that walks the whole rep and asserts this (see the deadlift test in `exerciseAnimation.test.ts`).
4. Prefer building the pose from the constraint that matters (for the deadlift: fixed torso length plus a steadily growing hip-to-ankle reach) instead of animating an angle and hoping the legs follow.
5. Then view the frames at 390 wide in both views, post them, and only merge after Max says yes.

## Clipping rules

- A prop must not hide the joint that shows the posture. Plates are drawn as an outline with a very light fill (12%) so knees and shins stay visible in the side view.
- Keep the head clear of arms and bars: put wrists a bit forward of the face (about +20 cm in z for overhead pulls) instead of through it.
- Pads and seats sit on the body part they support (thigh pad on the thigh, seat under the hips), not floating above it.
- Standing figures start straight: ankle z equals hip z at lockout, otherwise the legs show a kink.

## Posture rules per lift

- Deadlift: bar over mid-foot, shoulders just ahead of the bar, back angle held while the bar leaves the floor, hips higher than or level with the knees, arms straight, neutral neck (head follows the back, about 0.7 of its lean).
- Romanian deadlift: soft knees, hips travel back, bar stays against the legs, flat back.
- Goblet squat: upright chest, dumbbell at the chest with elbows inside the knees, knees over the toes, heels down, depth about parallel (do not drop the hips far below the knees or the torso collapses).
- Seated press: wrists stacked over elbows, forearms vertical at the bottom, back against the pad.
- Lat pulldown: slight lean back (12 to 18 degrees), bar to the upper chest, elbows down and back, thigh pad on the thighs.
- Back squat: bar on the traps over the mid-foot (bar z stays within a hand span of mid-foot all rep), hips back and down to just below parallel, knees over the toes, torso lean under 45 degrees, heels down.
- Bent-over row: torso held at about 50 degrees from vertical the whole rep, soft knees, arms straight at the bottom, elbows travel back and up, bar ends at the lower ribs.
- Incline dumbbell press: pad at 45 degrees, hips on the seat, head on the pad, wrists over elbows at the bottom, lockout over the upper chest.
- Dumbbell curl: elbows stay within a few cm of the sides, only the forearms move, dumbbells finish at shoulder height, no swing.
- Reverse lunge: front foot never moves, front shin vertical and thigh level at the bottom, back knee hovers above the floor on the ball of the foot, torso upright.
- Step-up: box foot stays put and is drawn on the box (`feet[].floor`), the free foot must clear the box edge before it drops below the box top (tested).
- Sumo deadlift: wide stance, knees out over the toes (front view), dumbbell hangs vertically between the legs, torso lean 30 to 45 degrees at the bottom.
- One-arm row: torso nearly parallel to the floor and fixed, free hand and same-side knee on the bench, working elbow goes back past the torso.
- Lateral raise: arms almost straight (a soft elbow), hands stop at shoulder height and never above the shoulders, no swing.
- Kettlebell swing: a hip hinge, not a squat; arms stay straight like a rope, the bell goes between the legs at the bottom and to chest height at the top.
- Single-leg RDL: standing leg soft, free leg and torso form one line (a seesaw), hips stay level, dumbbells hang straight down. A free foot in the air follows the foot rules below.
- Glute bridge: shoulders stay on the floor (torso length constant), at the top shoulders, hips and knees are one line (hip about 34 cm up), feet flat.
- Hip thrust: upper back stays on the bench, at the top torso and thighs are level and the shins vertical, the bar rolls on the hip crease.
- Pull-up: start from a dead hang with straight arms (reach ARM-0.3 so the forearm never stretches), grip just wider than the shoulders, elbows drive down and back, chin ends over the bar, legs hang slightly behind the hips with no swing.
- Hanging leg raise: shoulders fixed under the bar, legs stay straight and rise to hip height while the pelvis curls up a little, then lower under control.
- Cable pushdown: upper arm pinned to the side, only the forearms move, hands finish straight at the thighs, slight forward lean, wrists on the cable line.
- Cable crunch: kneeling, hips stay still above the knees, the torso curls down toward the thighs (it shortens as the spine rounds), hands stay at the head.
- Seated leg curl: thigh stays on the pad, only the shin swings back and down under the seat, back on the pad.
- Barbell curl: shoulder-width underhand grip that stays put, elbows pinned, bar finishes at shoulder height.
- Hammer curl: palms face each other (`neutralGrip`: dumbbells drawn lengthways in the side view and upright in the front view), hands stay close to the thighs.
- Dumbbell RDL: the RDL hinge with the dumbbells hanging just outside the thighs.
- Skullcrusher: lying flat, upper arms vertical (a few degrees toward the head) and still, only the forearms hinge, the weights stop beside the forehead, elbows not flared.
- Overhead triceps extension: elbows stay overhead beside the ears, only the forearms hinge, the dumbbell drops behind the head to neck height. The raised pose is tall, so its scale is 0.88 to keep the dumbbell inside the frame.
- Dips: hands fixed on the bars (`dip-bars` furniture, `DIP_BAR_Y`), elbows bent about 90 degrees at the bottom, chest leaning forward, knees bent with the feet hanging behind (an `angle` foot).

## Feet and furniture

**Feet lie flat in the side view** (Max, 2026-10-12: sloped feet read as standing on tiptoe). The sole is a horizontal line on whatever the foot stands on, heel behind the ankle, toes ahead of it, with a short vertical piece from the ankle down. Only a genuinely lifted heel (rear foot of a lunge) may slope. Never draw a line from a raised ankle down to the toe tip.

`FigurePose.feet` says what each foot stands on (`floor` = height under it in cm, `dir` = toe direction, -1 when kneeling). Set it with `foot:` in the skeleton for lifts where a foot is on a box or bench, otherwise the toes are drawn on the floor. New furniture (`incline-bench`, `flat-bench`, `box`, `thrust-bench`) and the `kettlebell` implement is drawn in `ExerciseFigureScene.tsx`.

**A foot that is not on anything hangs off the shin** (Max, 2026-10-12: a foot drawn on the floor or as a sloped line under a raised ankle "looks broken"). Whenever the ankle is in the air, the foot pivots about the ankle (`Foot.angle`, degrees of the toes above horizontal) and keeps a fixed angle to the shin, never a sole on the floor under a floating ankle:

- Hanging leg raise: `angle = a - 45` (`a` = the leg's angle from hanging), so the toes tip down while hanging and point up and forward at the top.
- Seated leg curl: `angle = 75 - shinAngle`, so the foot follows the shin, toes up and forward.
- Step-up free foot: `angle = -35 * t` with `drop = ANKLE_Y * (1 - t)` (`t` = how far the ankle is above standing height, 0 to 1), so it hangs while airborne and blends into a flat sole as it lands.
- Pull-up (legs behind the hips): `pitch: 55`, the sole following the ankle with the toes tipped down.
- Reverse lunge back foot: genuinely on the toes, so `pitch` on the floor with a lifted heel.
- Single-leg RDL free foot: `pitch` about 75, toes pointing at the floor.

Set `floor` to the sole height under the ankle (`ankleY - ANKLE_Y`, or `ankleY - 2` for an `angle` foot) so the front view puts the foot bar at the right height; the front view adds a short connector from the ankle only for `pitch` feet. Check every new lift at the frames where a foot is highest.

Furniture added with batch 3: `pullup-bar` (bar at `PULLUP_BAR_Y`), `cable-tower` (pulley at `FigureModel.pulley {y, z}`, used by the `cable` implement for the pushdown and crunch) and `leg-curl` (seat, thigh pad and ankle roller).
