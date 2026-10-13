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

Furniture added with batch 4: `leg-press` (back pad, seat, rails and a plate perpendicular to the rails; tilt `LEG_PRESS_TILT`, seat at `LEG_PRESS_HIP`; depth 0 is the lockout, depth 1 the bottom; the sole lies flat on the plate via `angle = tilt + 90`), `leg-extension` (seat plus a roller on the front of the lower shin; the shin foot follows with `angle = 80 - shinAngle`) and `rear-bench` (the Bulgarian split squat's bench at `REAR_BENCH_Y`/`REAR_BENCH_Z`, back foot `dir: -1` on top of it).

Batch 4 posture: leg press hips stay on the seat and the torso is reclined about 60 degrees, so the knees come up beside the chest without the hips lifting; Bulgarian split squat keeps the rear ankle fixed on the bench and the front foot flat; walking lunge swings the lead foot in an arc (hanging foot, `angle` + `drop`) and lands it flat, back heel up with `pitch`, back knee above the floor; standing calf raise starts at the top with `pitch` toes down and a straight leg, heel lowering to flat.

## Batch 6 (30 most-suggested exercises, 2026-10-13)

Picked by running the generator over every target muscle and three equipment sets and ranking what it suggests by `EXERCISE_POPULARITY`; holds (plank, wall sit) are left out because they have no rep.

**How the code is split.** `exerciseAnimations.ts` builds `EXERCISE_ANIMATIONS` from `BASE_ANIMATIONS` (exerciseAnimation.ts), the near-copies in `VARIANTS` (same movement, other equipment: lever leg extension, machine seated leg curl, chest dip, bodyweight step-up and calf raise) and one module per batch, `exerciseAnimationW1.ts` … `W5.ts`. A batch draws its own furniture or implements in `components/gym/figureExtras/wN.tsx` (prefixed names such as `w4-pecdeck`), hooked into the scene by `ExerciseFigureExtras.tsx` in three layers: `behind` the body, `mid` (before the near arm, for pads on the body) and `over`. New batches can be built side by side this way. Render review frames with `scripts/animation-frames/render.sh <outdir> <id>...` (front and side at 0/300/450/700/900 plus a 12-frame strip) and look at them before posting.

Posture:

- Push-up: one straight line shoulder, hip, ankle pivoting about the toes, hands under the shoulders, elbows about 45 degrees and travelling back, chest ends just above the floor. Toes on the floor with the heel genuinely lifted (`pitch`).
- Diamond push-up: the same plank, hands together under the chest, elbows tucked closer than the push-up.
- Pike push-up: hips high in an inverted V, legs straight, heels down, the head lowers to just in front of the hands.
- Bench dip: hands on the flat bench's front edge, legs straight with heels flat, hips drop straight down in front of the bench to about 90 degrees at the elbows.
- Bodyweight squat: heels down, knees over the toes, thighs about parallel, the arms reach forward to shoulder height as you descend.
- Split squat: neither foot moves (tested), hips drop straight down, front thigh level, back knee hovering, back foot on the ball (`pitch`), hands on the hips.
- Crunch: hips and feet fixed, only the shoulders curl up (torso shortens a little), hands at the temples. The torso is drawn straight, so the lift is kept under 20 degrees so it does not read as a sit-up.
- Reverse crunch: shoulders and arms flat, knees held at 90 degrees, the hips curl up bringing the knees over the chest; airborne feet use `angle`.
- Lying leg raise: lower back fixed, legs perfectly straight (no knee bulge, tested) from just above the floor to vertical; feet hang off the shin like the hanging leg raise.
- Russian twist: torso fixed at 45 degrees back, hips, knees and heels still, the shoulders and clasped hands rotate about the torso axis from one side to the other.
- Nordic curl: knees on the pad, ankles under the roller (kneeling feet `dir: -1`), knees to head one straight line that tips forward, hands catch at the floor.
- 45 degree back extension: hip pad below the hip crease, ankles under the ankle pad, sole flat on the footplate; straight line at the top, about 90 degrees of hip flexion at the bottom, no hyperextension, arms crossed.
- Dumbbell bench press: head, shoulders and hips on the flat bench, feet flat; wrists over elbows at the bottom with elbows about 50 degrees, lockout over the chest. Single-arm: free hand still on the lower chest, hips level.
- Dumbbell flye: one fixed soft elbow bend, the arm swings as one piece out to chest level and back, palms facing.
- Incline barbell bench and Smith incline press: 45 degree bench, bar to the upper chest, wrists over elbows at the bottom; the Smith bar path is exactly vertical along the drawn rails.
- Standing overhead press: torso upright over the ankles, bar from the collarbones straight up over the mid-foot, head moves back to let the bar pass and forward under it (bar centre stays clear of the head).
- Seated cable row: upright torso, feet flat on the platform (`floor` = platform height), arms straight forward at the start, handle to the lower belly with elbows past the torso.
- Face pull: rope from a high pulley, hands end beside the ears with elbows out at shoulder height.
- Cable crossover: two high pulleys, slight lean, one fixed elbow bend, hands sweep down and in to meet at the waist.
- Cable lateral raise: cable from a low pulley on the far side crossing the body, the working arm rises to shoulder height and never above, free hand on the tower.
- Pec deck: back on the pad, upper arms at shoulder height, arms sweep horizontally until the handles meet.
- Chest-supported machine row: chest stays on the pad (torso angle fixed, tested), arms straight at the start, elbows end behind the torso.
- Chin-up: like the pull-up with an underhand, shoulder-width grip and the elbows coming down in front of the shoulders.
- Bent-over reverse flye: hinge held about 58 degrees with soft knees, soft fixed elbows, hands open to shoulder height in line with the shoulders.
- Seated rear lateral raise: on the end of the bench, chest on the thighs and still, dumbbells by the calves rising to shoulder height.
- Concentration curl: elbow fixed on the inner thigh (tested), only the forearm moves, free hand on the other knee.
- Dumbbell shrug: arms straight, shoulders rise about 8 cm straight up, head still.
- Landmine T-bar row: torso held about 48 degrees, feet either side of the bar, the bar pivots about its floor anchor so the plates move on an arc.

## Batch 7 (30 more most-suggested exercises, 2026-10-13)

Picked the same way as batch 6 (generator over every target muscle, three equipment sets, durations 30/45/60 and four variations, ranked by `EXERCISE_POPULARITY`) from the suggested exercises still without an animation. Holds and carries (plank, wall sit, side plank, farmer's carry) are left out. Built as `exerciseAnimationW6.ts` … `W10.ts` with furniture in `figureExtras/w6.tsx` … `w10.tsx` (names prefixed `w6-` … `w10-`).

Near-copies in `VARIANTS` (`exerciseAnimations.ts`; `variant()` can now also swap the grip and all cues): dumbbell calf raise, rope pushdown (`rope` implement: cable to a knot, two rope ends into the hands), bodyweight hip thrust, bodyweight single-leg RDL and the barbell lying triceps extension (`small-barbell`: short bar with small plates so the plate does not cover the face). Their drawing lives in `figureExtras/variants.tsx`.

Posture:

- Smith machine flat press: head, shoulders and hips on the flat bench, feet flat; the bar path is exactly vertical along the drawn rails (constant z over the mid chest), wrists over elbows with elbows about 45 degrees at the bottom, arms straight at lockout.
- Smith machine squat: bar on the traps 6 cm behind the shoulder joint on a vertical line (bar z constant), feet fixed and flat just in front of the bar, shoulders stay over the ankles while the hips travel back and down to just below parallel, torso lean under 40 degrees (more upright than the free squat), knees about at the toes, standing straight at lockout (ankle z = hip z).
- Decline bench press: bench tilted 22 degrees head down, torso on the bench line, head on the pad end, ankles fixed under the roller (hanging foot with `angle`, shin 45 degrees below horizontal), bar to the lower chest with a near vertical forearm and elbows about 45 degrees, lockout over the chest, wrists clear of the face.
- Machine shoulder press: back on the 10 degree pad, hips on the seat, feet flat; handles start at chin height with vertical forearms and wide grip, press up and slightly together to almost straight arms; handles stay in front of the face.
- Machine hack squat: back on a pad inclined 40 degrees and sliding on rails (torso lean exactly constant), shoulder pads on top of the shoulders, feet fixed flat low on the platform, hip-to-ankle distance shrinks steadily (no early lockout), thighs about level at the bottom with knees a little past the toes and heels down, hands on the side handles.
- Dumbbell Arnold press: seated on the upright bench; start with dumbbells at chin height in front of the face, palms facing you and elbows forward; elbows swing out and the palms rotate (dumbbell axis left-right, forward at mid-turn, left-right again) while pressing to straight arms overhead with palms forward; the dumbbells pass in front of the face, never through it.
- Dragon flag: on the shared flat bench (top 45 cm), shoulders and head on the pad (shoulder joint 10 cm above it), hands gripping the bench behind the head (wrists fixed beside the pad end, elbows out). The whole body is one rigid straight line from the shoulders (tested: hips on the shoulder-ankle line, straight legs) that pivots about the shoulders from vertical down to a 14 degree hover; the torso underside stays clear of the pad away from the shoulders. Feet hang off the shins (`angle = g + 45`, like the lying leg raise). Scale 0.88 because the vertical pose is about 2 m tall.
- Bicycle crunch: lying on the back, hips on the floor and still, shoulder blades lifted about 22 degrees (torso 46 cm: the spine rounds), hands behind the head with wrists outside the face. One leg extended straight and low (thigh 22 degrees above the floor), the other knee drawn in with the shin about level; the shoulder line rotates +-30 degrees about the spine so the elbow of the lifted shoulder crosses toward the opposite (bent) knee. Depth 0 and 1 are the two ends of the pedalling, the middle has both knees half bent. Airborne feet use `angle = shin + 45` measured from the real knee-ankle geometry.
- Decline push-up: the push-up plank with the toes (heel lifted, `pitch 65`, `floor` = bench height) on a bench turned across the body; ankle 17 cm above the bench top, hands on the floor a little wider than the shoulders (a few cm behind them at the top so the elbow stays under control), body one straight line pivoting about the toes, so the chest ends lower than the feet (about 19 degrees head down); head clears the floor. Elbows about 45 degrees and travelling back.
- Archer push-up: wide plank (hands 50 cm either side), body one rigid line from the toes; the chest shifts 17 cm toward the working (near) hand and lowers to it while the far arm stays straight (shoulder-wrist at full reach all rep, its shoulder rolls up as the other side drops); working elbow flares out and back, bent past 90 degrees at the bottom. Hands and feet never move.
- Superman: face down, hips fixed on the floor; chest (shoulder 12 to 25 cm), straight arms overhead (starting on the floor, ending 10 degrees up) and straight legs (ankle 6 to 26 cm) rise together and monotonically, reaching long rather than high; head follows the chest at about half its lift (neutral neck, looking at the floor); feet pointed along the leg (`angle = leg angle - 18`).
- Sissy squat: standing, near hand on an upright (`w7-support`) beside the lifter, free hand on the hip. First up onto the toes (heel rises like the calf raise, `pitch` up to 40, toe tip stays at the same z), then the whole thigh-torso line leans back about 48 degrees (hips stay open: hip angle at least 172 degrees, tested) while the shin tips forward about 58 degrees and the knees travel well past the toes and down; head follows the line. Scale 0.98 because the calf raise lifts the head about 10 cm.
- Straight-arm pulldown: hinge about 22 degrees held still with soft knees, arms swing as one piece about the shoulder with a FIXED soft elbow bend (shoulder-to-wrist 54.3 cm, tested constant) from hands out in front at head height (clear of the face) down to the front of the thighs, never behind the shoulder, stance and torso fixed.
- Single-arm high cable fly: side-on to a high tower on the working side, slight lean, feet and torso still, near arm keeps one fixed soft elbow bend (53 cm shoulder to hand) and sweeps from out and up down and across to the opposite hip, free hand on its hip, cable always comes from above the hand.
- Low-to-high cable fly: two low pulleys, slight forward lean and soft knees, one fixed soft elbow bend (52 cm), hands sweep from low and wide up and together to chin height in front of the chest, wrists stay clear of the face, stance fixed.
- Single-arm seated cable row: tall torso that stays square (lean 7 to 0 degrees), feet flat on the platform (`floor` = platform height), working arm goes from a long reach to the hip with the elbow past the torso, free hand rests on the far thigh.
- Cable glute kickback: hinged about 24 degrees forward and held, hands on the tower, torso, hips and standing leg fixed; the working leg (near side) stays almost straight (hip-to-ankle near full length) and swings back and up to 38 degrees behind vertical, the foot is flat on the floor at the start and hangs off the shin (`angle` + `drop`, toes down) once airborne, ankle strap cable runs to the low pulley.
- Reverse pec deck: seated facing the machine, chest on the pad (torso 8 degrees forward and fixed), arms at shoulder height with a soft bend, sweep from in front back and out until in line with the shoulders (no more than a few cm behind), elbows lead, feet wide on the floor, column between the knees.
- Dumbbell pullover: across a flat bench (`w9-cross-bench`), only the upper back on it, hips below bench top (hip y 38), thighs nearly level, shins vertical, feet flat; one dumbbell (`w9-pullover-db`) held upright in both hands along the forearms; arms swing as one piece with a fixed soft elbow bend (reach 53.8) from over the chest back to about 105 degrees past vertical, passing beside the head (dumbbell centre >25 cm from the head).
- Incline dumbbell curl: shared 45 degree `incline-bench`, back and head on the pad, hips on the seat, feet flat; arms hang straight down behind the torso line, elbows pinned (never move, 2 cm in front of the shoulder), only the forearms curl (0 to 145 degrees), hands finish just below shoulder height.
- Incline dumbbell row: face down on a 45 degree seatless pad (`w9-prone-bench`), chest on the pad, torso and head fixed, legs nearly straight with toes on the floor (heel lifted, `pitch` 65); arms start straight down, elbows drive back to 60 degrees past the torso line, forearms stay vertical, palms facing (`neutralGrip`).
- Incline dumbbell flye: 30 degree bench (`w9-incline-30`), hips on the seat, feet flat; one fixed soft elbow bend (reach 52.5), the arm swings in an arc from the dumbbells together over the upper chest (about 9 degrees inward) to 98 degrees (just below shoulder level), hands never below the shoulder by more than 15 cm, palms facing.
- Dumbbell triceps kickback: hinge of 62 degrees with soft knees, free hand on the front thigh; working upper arm pinned along (4 degrees above) the torso, the elbow never moves; elbow starts at about 90 degrees and the forearm swings back until the arm is one straight line; neutral grip, one dumbbell.
- Zottman curl: standing curl with elbows pinned; palms up and palms down look identical from front and side, so the grip turn is shown as the dumbbells passing through neutral (lengthways) at the bottom and the top (`zottmanTurn`, stored in `pose.bar[0]`, drawn by `w9-zottman`).
- Dumbbell front raise: standing tall and still (hips, torso, head fixed), arms swing forward as one piece with a soft fixed elbow (reach 54), dumbbells start in front of the thighs and stop at shoulder height, never above, hands stay well clear of the face, no swing or lean back.
- Dumbbell bent-over row: torso held at about 52 degrees from vertical the whole rep, soft knees, neutral neck (head about 0.6 of the lean), arms straight at the bottom with the dumbbells (neutral grip) under the shoulders, elbows travel back and up past the torso, dumbbells end beside the lower ribs.
- Barbell sumo deadlift: wide stance (ankles 32 cm out each side, toes out), hands inside the knees (16 cm), knees pushed out to the sides (about 17 cm beyond the ankles, front view) with the shins near vertical in the side view, bar vertical over the mid-foot (z 3 to 7), arms straight, shoulders about 12 cm ahead of the bar at the bottom, torso lean about 51 degrees at the bottom, hips within 3 cm of knee height (tested), built from a fixed torso length and a steadily growing hip-to-ankle reach so the legs never lock early.
- Dumbbell sumo squat: wide stance, one dumbbell hanging vertically (goblet implement) between the legs on straight arms, torso upright (lean up to 16 degrees), hips drop almost straight down (under 16 cm back) until the thighs are about level, knees out over the toes, heels down, stands straight at the top (ankle z = hip z).
- Dumbbell side bend: hips, legs and feet fixed, everything in the frontal plane (no forward or backward lean), the spine bends sideways toward the dumbbell (lower half bends less than the upper half, up to 36 degrees at the top of the spine), the dumbbell shoulder drops while the hand slides down the thigh on a straight arm, the free hand rests on the hip crest with the elbow out to the side (never above the shoulder, so no stub over the head), neutral-grip dumbbell on the near (right) hand only.
- Good morning: bar on the traps behind the neck and over the mid-foot (z within a hand span all rep), hinge at the hips with soft knees (hip-to-ankle reach 87.8 to 81 cm), hips travel about 37 cm back, flat back tipping to about 58 degrees from vertical, knee stays about over the ankle (shin never leans back), neutral neck, stands straight at the top, it is a hinge not a squat.

Furniture and implements:

- `w6-smith-flat`: flat bench plus Smith rails (front rails at +-60, side rail at the bar z, top height 138); used with the shared `w3-smith-bar` implement.
- `w6-smith-squat`: tall Smith frame (top 182) for the squat, same `w3-smith-bar` implement.
- `w6-decline-bench`: 22 degree decline pad, posts and skids, ankle roller on the shin with leg holder post, bar rack upright with hook.
- `w6-press-machine` (implement): selectorized shoulder press frame (column and rails, carriage arms behind the handles, parallel handles); drawn with the built-in `upright-bench` seat.
- `w6-hack-squat`: base, foot platform (top 5 cm), inclined rails, moving back pad, shoulder pads, side handles.
- `w6-arnold-db` (implement): dumbbells whose axis turns with the wrist height (`arnoldProgress` / `arnoldTurn`), drawn with ellipses for the plates.
- `w7-decline-bench` (figureExtras/w7.tsx): flat bench turned across the body under the toes at the shared flat-bench height (`DECLINE_BENCH_Y` = `ROW_BENCH_Y` = 45). Side view: its 28 cm width as a pad plus one post at `DECLINE_ANKLE_Z + 3`; front view: the whole 92 cm bench with two legs, drawn behind the body.
- `w7-support` (figureExtras/w7.tsx): a vertical upright at `SISSY_SUPPORT` (x 36 beside the lifter, z 14, top 152 cm) with a floor foot; the near wrist is fixed on it at y 110. Drawn behind the body in both views.
- `w8-straight-bar` (implement): straight bar between the hands plus a cable to the high pulley (`FigureModel.pulley`).
- `w8-sap-tower` (furniture): high-pulley tower in front of the lifter; side view only (the front view draws nothing so no pole shows behind the head).
- `w8-hi-tower` (furniture) and `w8-hi-handle` (implement): single high tower at x = `HIFLY_TOWER.x` beside the working arm, cable to the near hand.
- `w8-low-towers` (furniture) and `w8-low-cable` (implement): two full-height columns at x = +/-`LOWFLY_TOWER_X` with the carriage and pulley at y 16, cables to both hands.
- `w8-row-handle` (implement): single D-handle and cable for the single-arm row; reuses `w4-row-seat` furniture.
- `w8-kick-tower` (furniture): column the lifter holds with a hand bar, base and low pulley (`KICK_PULLEY`); `w8-kick-strap` (implement): ankle cuff and cable from the working ankle to the low pulley.
- `w8-rev-deck` (furniture): reverse pec deck: seat, floor rail, front column with the handle pivot, chest pad on the front of the torso (mid layer so the hands stay in front of it), levers to the grips.
- W9: `w9-cross-bench`, `w9-incline-30`, `w9-prone-bench`, `w9-pullover-db`, `w9-zottman` (zottman grip turn stored in `pose.bar[0]`: palms up and down look the same, so the dumbbells pass through neutral at the bottom and top).
