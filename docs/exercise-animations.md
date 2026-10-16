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

## Batch 8 (home gym, v0.025)

Picked by running `generateWorkout` with only the Home Gym profile's equipment (every target, 30/45/60 min, variations 0-3, with and without supersets) and ranking the suggested exercises without an animation by popularity, skipping holds and carries. Built in `exerciseAnimationW11.ts` / `figureExtras/w11.tsx`.

- Single-arm cable rear delt fly: the tower stands on the far side (`w11-rdf-tower`, x -98, pulley y 172 like `w8-hi-tower`, z 34) so the cable crosses in front of the body to the opposite hand; one fixed soft elbow bend, the hand sweeps from across the chest to out at shoulder height and stops in line with the body; the free hand on the hip.
- Smith machine shoulder press: `w11-smith-seat` is the W6 Smith frame (`smithFrame`, now exported from w6.tsx) plus an upright bench. `w11-smith-bar-small` draws side-view plates at radius 10 so they stay clear of the face; the bar's z is fixed (shoulder z + 19) and it runs from chin height to lockout.
- Half-kneeling single-arm lat pulldown: reuses `w8-hi-tower` and `w8-hi-handle`; the near knee is down with the shin flat on the floor, the far foot flat 40 cm ahead, the free hand on the front thigh. Starts in a full stretch with the hand in front of the face line.
- Smith machine RDL: `w3-smith-bar` with a `w11-smith-rdl` frame (top 150). Bar z fixed over mid-foot (12 against an ankle z of 6), torso 0 to 76 degrees, hips about 28 cm back, shins about vertical. With straight arms the bar only reaches just below the knee, which is where an RDL stops for most people anyway.

## Batch 9 (0.057: the 13 new gear exercises plus the 30 most-suggested without animation)

Picked with `popularityOf` (program-count ranking from 0.056) over the generator output, as for batch 7. Built as `exerciseAnimationW12.ts` … `W16.ts` with furniture in `figureExtras/w12.tsx` … `w16.tsx`; near-copies use `variantSpec` (`exerciseVariant.ts`). W12 arms (EZ bar, preacher, cable curl, overhead cable extension), W13 plate-loaded and other machines, W14 calves, leg curl and hip thrusts, W15 core, W16 pulls, close-grip bench and hip machines.

### W12

# Notes W12 (EZ bar, preacher curls, cable curl, overhead cable extension)

Files: `src/lib/gym/exerciseAnimationW12.ts`, `src/components/gym/figureExtras/w12.tsx`, `src/lib/gym/__tests__/exerciseAnimationW12.test.ts` (67 tests green, prettier + eslint clean). Frames: `/tmp/claude-0/scratch/frames-W12/<id>.png`. No shared file touched.

## Posture

- EZ-bar curl (`ez-bar-curl`): standing tall (ankle z = hip z), underhand grip 12 cm each side of the midline (barbell curl is 17), elbows pinned (exactly fixed, x 17.5, 5 cm ahead of the shoulder line), only the forearms turn about them from 10 to 146 degrees. Hands hang 9.5 cm in front of the hip (bar against the thighs, arms almost straight, shoulder-wrist 51+ cm), bar ends at shoulder height, 20+ cm from the face.
- EZ-bar reverse curl (`ez-bar-reverse-curl`): same curl with an overhand grip (14 cm half width, knuckle caps drawn on top of the bar in the front view `w12-ez-bar-over`), forearm swing only to 128 degrees so the bar ends lower, at the chest (tested lower than the underhand curl).
- EZ-bar preacher curl (`ez-bar-preacher-curl`): seated (hip y 53, shins about vertical, feet flat 40 cm ahead), torso leans 22 degrees onto the pad, pad 52 degrees below horizontal, upper arms lie along it from the shoulder (armpit at the top edge), both elbows exactly fixed on the pad (x 15, tested; upper-arm angle = pad angle tested every 0.05), forearms rotate in the arm plane from 12 to 130 degrees of flexion. Wrist always on the upper side of the pad plane, never within 19 cm of the head, never within 8 cm of the thigh.
- Barbell preacher curl: same, straight bar grip 17 half width, 15 cm plates, flexion 12 to 126 degrees so the plate stays off the face.
- Dumbbell preacher curl (`db-preacher-curl`): same pose, one arm: the near arm curls with one dumbbell (`oneDumbbell`, palm up, flex 8 to 138), the far hand rests on top of the far thigh (fixed, tested). Catalog text says "incline bench back pad"; I drew the same preacher pad (cue 1 mentions an incline bench works too).
- Machine preacher curl (`machine-preacher-curl`): seat plus pad (55 degrees) on a housing, pivot ring on the elbow axis, lever and handle dot at the wrist in the side view, front view pivots 14 cm outside the elbows with a lever line to each grip. Flexion 10 to 136 degrees.
- EZ-bar skullcrusher: flat bench (shared `flat-bench`), upper arms 8 degrees toward the head and exactly still, elbows 4 cm inside the shoulders (not flared), grip 9 cm half width on the EZ inner angles, forearm swings from straight (reach 54.9) to 104 degrees, bar ends 12+ cm above the forehead, 21+ cm from head centre, small plates (r 10) so they do not cover the face.
- EZ-bar overhead triceps extension: standing tall, elbows fixed overhead beside the ears (x 14, 3 cm ahead), forearms hinge from almost straight to 138 degrees behind the head: bar ends behind the neck at neck height, never nearer than 17 cm to the head. Scale 0.88 like the dumbbell version. The front view draws the bar in the `behind` layer so it passes behind head and neck.
- Cable curl (`cable-curl`): same curl as the EZ curl (grip 15, flexion to 144), low pulley (y 14, z 74) on a tall column in front (`w12-low-tower`), straight bar with cable from the bar centre to the pulley; cable stays more than 10 cm from knees and hips and 8 cm from the ankles (tested).
- Overhead cable extension (`overhead-cable-extension`): high pulley behind the lifter (y 192, z -58), lifter faces away, staggered stance (near foot 26 ahead, far foot 26 behind, both flat), hips y 90, torso leans 26 degrees and stays fixed, soft knees, upper arms pinned 28 degrees forward of vertical beside the ears (elbows fixed), rope hands 8 cm from the midline; forearm from nearly straight (forward and up) to 138 degrees back: hands end behind the head (more than 10 cm behind it), cable from above/behind never nearer than 14 cm to the head (tested). Scale 0.85.

## New furniture / implements (all in `figureExtras/w12.tsx`)

- `w12-ez-bar`, `w12-ez-bar-over`, `w12-ez-bar-small`, `w12-ez-bar-behind`: EZ bar with the zig-zag drawn relative to the actual grip (the angled sections cross the bar line at the hands), plates at +-44 (r 15, or r 10 for the `small`/`behind` variants), side view plate circle like the barbell. `-over` adds knuckle caps, `-behind` draws the bar behind the body in the front view.
- `w12-barbell`: straight barbell (+-75) with 15 cm plates for the preacher curl.
- `w12-preacher` (furniture): seat, stem, base rail, pad slab (polygon drawn from the pose's shoulder-elbow line, so it always matches the arms), support strut; front view pad rectangle in the `mid` layer so the arms lie on it.
- `w12-preacher-machine` (furniture, adds a housing under the pad) and `w12-preacher-lever` (implement: pivot ring, lever, handles).
- `w12-low-tower`, `w12-cable-bar` (cable curl); `w12-oh-tower` (front view only draws the pulley housing, no pole behind the head), `w12-oh-rope` (cable plus rope ends).

## Things to know

- Depth convention follows the siblings: depth 0 = start of the rep (arms hanging / arms extended), 1 = turning point.
- Plates on EZ and preacher bars are 15 cm radius (10 near the head), smaller than the 22.5 of `barbell`, so they stay off the legs and face; `barbell` itself is used only via my `w12-barbell` look.
- Known imperfections: the EZ zig-zag is only visible in the front view as a small W (in the side view the bar is end-on); the reverse-curl overhand grip is shown by knuckle caps only; machine lever is stylised (no weight stack).
- No shared-file change needed.

### W13

# Notes W13 (plate/machine presses and rows, cable chest press)

Posture:

- Plate-loaded chest press (`plate-chest-press`) and Machine chest press (`machine-chest-press`, same pose): seated, hips on seat (y 52), back pad 8 deg, feet flat; handles start 22 cm ahead of and 10 cm below the shoulder joint (mid-chest, x 34), press along an exactly horizontal path to x 26, reach 52.8 (just short of lockout); forearm near horizontal, elbows ~13 cm below the shoulder. Travel monotone (tested).
- Plate incline chest press: back pad reclined 38 deg, press path 40 deg above horizontal (tested), handles from the upper chest, reach 52.8.
- Plate shoulder press: reuses `machineShoulderPressPose` (W6) with `upright-bench` + implement `w13-plate-press`.
- Plate row: reuses `machineRowPose` (W4), furniture `w13-plate-row`.
- Plate high row: seated tall, torso 5 deg back and fixed, chest pad; hands from up/forward of the head (reach ~51) down and back to the lower ribs, elbows end 19 cm behind the shoulder; wrist height monotone (tested).
- Chest-supported T-bar row machine: torso fixed 46 deg on the pad, feet flat on an 8 cm platform (`floor` 8), hands hang then row to the lower chest, elbows back.
- Machine lateral raise: seated, back 6 deg, elbows bent 90 deg with forearms forward; upper arm abducts 14 to 82 deg so elbows end ~4 cm below shoulder height, never above (tested); pads on the outside of the elbows.
- Standing cable chest press: split stance (ankles z +20/-18, both flat), lean 12 deg, hands from beside the chest (x 28) pressing forward and together to x 4 (reach 52.4); high pulleys 62 cm behind the hips (`pulley` y 170, z -62), reuses `w4-cross-towers` / `w4-cross-cable`.

Furniture / implements (figureExtras/w13.tsx):

- `w13-plate-chest`, `w13-plate-incline`: seat, back pad, upright with lever pivots, levers to the handles, horn with plates (side: disc; front: edge-on plates that move slightly as you press). `w13-stack-chest`: same frame with a weight stack (selected slabs lift while pressing).
- `w13-plate-press` (implement): levers from a pivot behind the pad, horn with plates; used with `upright-bench`.
- `w13-plate-row`, `w13-high-row`, `w13-tbar-machine`, `w13-lateral-machine` (selectorized stack).

Known imperfections: lever lines are drawn faint behind the body and change apparent length a little (hinge levers seen in projection); in the side view lever lines pass behind the legs at the end of the plate row. Cable press cable grazes under the chin in the side view (pulley behind, as in real life). No shared-file changes needed.

### W14

# Notes W14 (animation batch, 10 exercises)

Files: `src/lib/gym/exerciseAnimationW14.ts`, `src/components/gym/figureExtras/w14.tsx`, `src/lib/gym/__tests__/exerciseAnimationW14.test.ts` (63 tests green, prettier + eslint clean, no tsc errors in my files). Frames: `/tmp/claude-0/scratch/frames-W14/<id>.png`. No shared file touched.

## Posture

- Lying leg curl (`lying-leg-curl`): face down on a pad (top 36), torso/hips/thighs fixed (hip y 46, thigh slopes 6 deg down to the knee, pad ends just behind the knee so the legs hang free). Shin curls from 8 to 100 degrees of knee bend (hip-ankle reach shrinks monotonically, ankle rises until the shin is vertical, then drops <0.5 cm). Foot hangs off the shin (`angle = shin angle + 80`, toes down at start, pointing back at the top). Hands hold handles hanging beside the pad (wrist y 31 below the pad top, elbows out and down) so no arm crosses the head (tested). Scale 1.15.
- Smith machine calf raise (`smith-calf-raise`): standing upright, legs straight (hip-ankle 87.95), toes on a 7 cm step, bar on the traps (z -6, 4 cm above the shoulder joint, exactly vertical, hands at +-28). Heel range from 9.8 cm above flat to 4.6 cm below flat. Scale 0.9, Smith frame top 200 (taller than the squat's because the lifter stands on the step and rises).
- Single-leg calf raise (`single-leg-calf-raise`): near foot on the edge of a 14 cm step, straight leg, other leg hooked up behind (thigh vertical, shin about horizontal, free foot hanging toes-down via `angle`), near hand slides up an upright (x 36, z 14, 46 cm below the shoulder, balance only), other hand on the hip. Scale 0.9.
- Seated calf machine (`seated-calf-machine`): hips fixed on the seat (hip y = step 10 + 50), shin near vertical, thigh tilts about -5 to +13 degrees as the heels sink/rise, ball of foot on a 10 cm platform. Pads on the thighs just above the knees (along 0.74-0.98 of the thigh), lever to a front column with a weight stack. Hands rest on the thighs.
- Seated dumbbell calf raise (`seated-db-calf-raise`): flat bench (top 48), ball of foot on a 6 cm plate, one dumbbell across each thigh 80% of the way to the knee (centre 11 cm above the thigh axis, hand on it), thigh tilt like the machine. Standard `dumbbells` implement (end-on circle in side view, bar across thighs in front view).
- Smith machine seated calf raise (`smith-seated-calf-raise`): bench in the Smith, bar across the thighs 30 cm ahead of the hip (z fixed, x 0), resting 1.5 cm above the thigh surface at every depth (bar y follows the thigh, tested 6.4-8.2 cm from the thigh axis), hands on the bar at +-30, small plates (`w11-smith-bar-small`), frame top 140.
- Leg press calf raise (`leg-press-calf-raise`): reclined 60 degrees on the shared leg-press seat (`LEG_PRESS_HIP`, tilt 35), legs straight (reach 87.8) and completely still; only the foot rotates about the ankle (`angle = tilt + gamma`, gamma 55 = ankles extended, 102 = dorsiflexed) while the platform slides ~10.5 cm along the rails. Platform lower edge sits 3 cm above the ankle line so the heels hang off below it (heel b < edge, tested), contact is the toe tip when plantarflexed, the ball when pulled back. Hands on the side handles (wrist 6 cm ahead of the hip, reachable; the base leg-press wrist is not).
- Machine hip thrust (`machine-hip-thrust`) and Smith hip thrust (`smith-hip-thrust`): the barbell hip-thrust body (`hipThrustPose`: upper back on the bench, torso level and shins vertical at the top, hips to 18 cm at the bottom, feet flat) with the load on a vertical guide at z -46. The bar/belt rests on the highest point of the pelvis/thigh capsules at that z (3 cm above the body, tested 2.2-3.6 cm), so it stays exactly vertical yet touches the hip crease at the top and the thighs lower down, never inside the body. Hands at +-26 (machine, on the belt ends) and +-32 (Smith).
- Dumbbell reverse lunge (`db-reverse-lunge`): the bodyweight lunge legs/torso (`reverseLungePose`, front foot never moves, back foot on the ball, front shin vertical, thigh level), arms straight down at x +-27 (palms in, `neutralGrip`), dumbbells hang beside the legs, forearm vertical. Uses `variantSpec` for spec and cues, pose wrapped (wrists/elbows replaced).

## Calf-raise foot model (shared by 5 exercises, `calfFoot(step, e)`)

Heel up (lift >= 0): `pitch` foot like the standing calf raise (ankle = step + 8 + 11*pitch/45, toe tip stays on the step). Heel down (lift < 0): `angle = asin(-lift/15)` with `drop 8`, so the toe tip stays on the step top and the heel hangs below the step (heel about 6 cm under the step top at the bottom). `floor` = step height in both. The two foot forms agree at lift 0 (flat sole).

## New furniture / implements (figureExtras/w14.tsx)

- `w14-lying-curl`: pad with posts, floor rail, hanging handles, pivot post at the knee, lever to the roller, roller (circle in side view, bar across the ankles in front view) on the back of the shin at 90% of its length.
- `w14-lp-calf`: leg press frame for the calf raise (back pad, seat, rails, platform line starting 3 cm above the ankle line at the pose's plate reach, plate rect in the front view).
- `w14-seated-calf`: seat on a stem, floor rail, front column with weight stack, 10 cm platform, thigh pad and lever (mid layer, follows the thigh), front-view pad bar.
- `w14-single-step`: 14 cm step (rear edge z 4, front edge 44) plus a balance upright.
- `w14-seated-db`: flat bench plus 6 cm plate.
- `w14-smith-seated`: bench, plate, Smith rails (own `smithRails` with a short base so it does not run under the feet) and a pad on the bar over the thighs.
- `w14-smith-calf`: Smith rails (top 200) plus 7 cm step.
- `w14-thrust-machine` + implement `w14-thrust-belt`: bench pad, two guide columns at +-52 (top 110) and a belt pad across the hips with arms to the carriages and plates at +-60 (front) / radius-18 plate circle (side).
- `w14-smith-thrust`: the same bench with Smith rails (top 125); implement is the shared `w3-smith-bar`.

## Known imperfections / things to know

- Machine hip thrust is drawn with a guided carriage (vertical rail) rather than a pivoting lever: a lever whose arm has constant length cannot follow the hips without passing through the torso/head in a 2D side view. It reads as a belt carriage machine and looks close to the Smith version (belt + smaller plates is the difference).
- Reverse lunge bottom: the hanging dumbbells are at thigh height (wrist y 47, front thigh y 52), so in the side view the near dumbbell overlaps the front thigh (it hangs beside the leg, x 27 vs thigh x 11).
- Single-leg calf raise: the balance upright is drawn behind the body (same as `w7-support`), so it appears behind the near leg although it stands on the near side.
- Lying leg curl front view is an end-on view of a prone figure (flat slab with raised shins), like other lying exercises.
- Seated calf machine lever is not exact constant length (length varies < 0.5 cm over the rep).
- `exerciseAnimations.ts` / `ExerciseFigureExtras.tsx` already register W14; no changes needed. For the test list `ANIMATED` in `exerciseAnimation.test.ts`: add the ten ids.
- Review helper (not part of the repo): `/tmp/claude-0/scratch/w14tools/big.sh <id> <d1,d2,...> <abs out.png> [width]` renders large side+front frames at chosen depths.

### W15

# W15 notes

Files: `src/lib/gym/exerciseAnimationW15.ts`, `src/components/gym/figureExtras/w15.tsx`, `src/lib/gym/__tests__/exerciseAnimationW15.test.ts` (64 tests green; prettier, eslint and tsc clean for these three). Frames: `/tmp/claude-0/scratch/frames-W15/<id>.png`. No shared file was changed. For `exerciseAnimation.test.ts` the ids to add to `ANIMATED` (if you want them there): captains-chair-leg-raise, captains-chair-knee-raise, hanging-knee-raise, ab-crunch-machine, barbell-rollout, decline-situp, bar-triceps-extension.

Posture (depth 0 = the loop start; for the sit-up it is lying, for the rollout the folded start):

- Captain's chair leg raise: shoulders fixed at y 157, elbows right under the shoulders (upper arm 3 degrees forward of vertical), forearms level on the pads (4 degrees up), hands on the handles at the pad ends (wrist z 27.5, x 19), torso vertical against the back pad (head and torso never behind the pad face). Straight legs (hip-to-ankle 87.9) swing from 4 to 86 degrees from hanging, level with the hips at the top; the pelvis curls forward (lean 0 to -7, hip 6 cm forward of the shoulder line, monotone). Feet hang off the shin (`angle = a - 45`, `floor = ankle y - 2`), toes at least 4 cm off the floor all rep (ankle 14 cm at the start). The legs rise under the forearm pads (hips 12+ cm below the pad).
- Captain's chair knee raise: same chair and upper body; thigh from 3 to 125 degrees from hanging, knee flexion 8 to 120 (shin ends about vertical, `angle = shin - 45`). Knee ends about 26 cm above the hip and 37 cm in front of it, passing between the two arm rests (the near pad is drawn over the thigh in the side view, as the pad is nearer the camera). Hip-to-ankle distance and knee height are monotone (tested).
- Hanging knee raise: `pullup-bar`, grip 26, straight arms, shoulders fixed (like the hanging leg raise, scale 0.8). Thigh 3 to 135 degrees, flexion 8 to 130 (shin ends vertical), pelvis lean 2 to -13. Knees end 32 cm above the hips.
- Ab crunch machine: seated (seat hip y 53, thighs level, feet flat 42 cm ahead, `footHalf` 14), back pad tilted 10 degrees, torso starts reclined 10 degrees against it and curls to 36 degrees forward while shortening from 50 to 43 cm (the spine rounds, not a hinge). The chest pad sits on lever arms that pivot beside the hip joint, so its centre is always exactly `ACM_ARM` (36 cm) from the hip joint (side view circle, no stretching lever). Hands hold the handles at the pad's upper edge (wrist 15 cm either side), elbows in front and forward-down, clear of the thighs (elbow at least 5 cm above the thigh).
- Barbell rollout: kneeling on a 4 cm mat, knee fixed at (y 9.5, z 0), shins lie back flat (feet `dir -1`, `floor` 4). Barbell (built-in `barbell`, round plates) on the floor (bar y 22.5, plates touch the floor), straight arms (reach 54.7). Thigh 12 to 78 degrees and torso 64 to 78 degrees from vertical: hips piked with the bar under the shoulders at the start, one straight knee-to-shoulder line at the end with the torso nearly level (shoulder y 29), hips never below that line (tested). Bar travels 80 cm forward. Head 0.62 of the torso lean, clear of the arms.
- Decline sit-up: pad tilted 25 degrees head down (`DS_ANGLE`), hip fixed on it (10 cm above the surface), thigh along the pad, shin 50 degrees below horizontal to the ankle roller (hanging foot `angle = shin + 90`, same logic as the W6 decline press), knees bent about 105 degrees. Torso direction goes from 2 degrees above the pad (just above flat) to 88 degrees (upright) as a rigid pivot about the hip (length 50, 46 at mid rep for the spine curl); shoulders and head stay above the pad (tested), chest never touches the thigh (tested). Hands crossed on the chest (wrists 14 cm either side of the midline), elbows folded down the front of the chest. Head tucks 17 degrees as it comes up.
- Bar triceps extension: bar at y 105 on two posts, toes on the floor 150 cm behind it (`pitch 65`, ankle y 17, like the push-up plank), body one rigid line (hip on the ankle-shoulder line, tested) pivoting about the toes from 45.8 degrees (arms straight, shoulder 54.7 from the wrists) to 31 degrees. Elbows point up (skull-crusher style), forearms stay above the head, the head slides under bar and forearms (head tucks from +6 to -55 degrees relative to the body so it clears the bar by more than 14 cm throughout and the forearm by more than 14.5 cm in the lower 30 percent of the rep (tested)). Hands on the bar at x 19. Shoulder-to-wrist distance decreases monotonically 54.7 to 32.

Furniture and implements (`figureExtras/w15.tsx`):

- `w15-captains-chair`: back pad (z -15, from shoulder -62 to +27), spine post and floor base behind it, beam under the arm rests, two forearm pads (top 4 cm under the forearm, near one in the `mid` layer, far one `behind`), vertical grip handles at the pad ends (`over`). Front view: back pad rect, spine, pads and handles.
- `w15-ab-machine`: floor base, seat, 10 degree back pad and support, chest pad (rounded, lighter), lever from a pivot dot at the hip to the pad centre; front view: pad rect on the chest and two lever arms at x +-25 to hip pivots; handle bar between pad and wrist (`over`).
- `w15-rollout-mat`: thin 4 cm mat under the knees and shins (z -62 to 14). The barbell is the built-in implement.
- `w15-decline-situp-bench`: 25 degree pad (z/y from `DS_PAD`), two posts with floor feet, leg holder post, roller on the lower shin (same placement as the W6 decline bench, no bar rack), front view pad and roller.
- `w15-low-bar`: waist-height bar on two uprights at x +-58 (front), single upright at z 0 and floor foot (side, bar end as a dot in `over`).

Known imperfections / things to know:

- Ab crunch machine is a generic selectorized machine (chest pad + hip-pivot lever); it looks schematic, the pad is mostly hidden behind the arm in the side view.
- Bar triceps extension: in the middle of the rep the near elbow/forearm crosses the head circle in the side view (the arms are beside the head in 3D, so nothing really collides). The head is clear of the bar and of the forearm for the lower 30 percent of the rep (tested).
- Captain's chair: the knee raise's thigh passes behind the near arm pad in the side view (physically the knees pass between the pads).
- Captain's chair shoulder height 157 and scale 0.95 keep the head top inside the frame (head top 190 cm at scale 0.95).

### W16

# Notes W16

Posture:

- Close-grip lat pulldown: built-in `pulldown` furniture (thigh pad), lean 12 to 18 deg like the lat pulldown, V-handle with a neutral grip (hands 8 cm from the midline). Starts with long arms (shoulder-wrist 52.5, handle 24 cm in front of the shoulder, clear of the face), handle drops quickly then settles on the upper chest (9 cm below the shoulder joint). Elbows hang down (pole down): they swing forward to shoulder height early (a narrow grip forces that), then come down in front of / beside the ribs. Feet flat (ankle z 42, as the lat pulldown).
- Barbell shrug: standing straight (ankle z = hip z), grip 26 (just outside the shoulders), bar z 8 in front of the thighs, arms straight (reach ARM-0.05); shoulders rise 8 cm straight up (smooth), head and hips fixed, no rolling. `barbell` implement, scale 1.05.
- Dumbbell upright row: standing straight, dumbbells (pronated, drawn lengthways in the front view) start in front of the thighs (x 16, z 12, arm straight) and rise close to the body to 16.5 cm below the shoulder joint at x 23 / z 16.5; elbow pole fixed at (25.5, -2, 13.6) from the shoulder, so the elbows lead out and up and stop at shoulder height (never above, tested), elbows more than 6 cm above the wrists from depth 0.35 on, forearms angled in.
- Cable upright row: same movement with a short straight bar (grip 16 to 21) and a low pulley in front (`w16-low-tower`, pulley y 16, z 46); cable line from the bar centre to the pulley. Hands finish 16 cm under the shoulder joint.
- Close-grip bench press: figure (not the old rig) lying on the shared `flat-bench`, `barbell` implement, scale 1.3. Grip 16 (inside the 19 cm shoulder joints), bottom forearm exactly vertical, elbow right under the wrist (about 3 cm from the shoulder line in x: tucked), bar at chest height 12 cm above the shoulder joint, z about 25 cm below the shoulder (lower chest). Top: bar 4 cm toward the feet from the shoulder, arm at full length (54.8). Bar z uses the J-curve (depth^1.6), y linear.
- Hip abduction / adduction machine: built-in `upright-bench` seat and 10 deg back pad, hips fixed (SEAT_HIP_Y), hands on side grips, thighs level (knee 1 cm above hip), shin vertical, ankles on 3 cm foot plates (`floor` 3) that travel with the legs. Thigh swings about the vertical axis from 3 to 30 degrees (knee gap 23 to 66 cm); knees move only a few cm back in the side view. Abduction: depth 0 closed, 1 wide, pads on the outside (`w16-abduction`). Adduction: depth 0 wide, 1 closed, pads on the inside (`w16-adduction`), start of the rep is the wide position.

Furniture / implements (figureExtras/w16.tsx):

- `w16-vhandle`: V-handle (triangle with two end-on grips in the front view, grip rod plus triangle in the side view), cable to the pulldown pulley (170, z 16).
- `w16-low-tower`: low cable tower drawn behind the body (column, base, carriage, pulley wheel at CUR_PULLEY y 16 z 46); `w16-low-bar`: short straight bar, cable from its middle to the low pulley (needs `pulley: CUR_PULLEY` in the model).
- `w16-abduction` / `w16-adduction`: pads (outer or inner), posts rising from the foot plates, foot plates, floor rail, grip posts. Side view: outer pad as a rounded slab on the near thigh; the inner pad only shows its rim.

Know-how / imperfections:

- No shared file was changed. Frame review used `/tmp/claude-0/scratch/frames-W16/`.
- Bench bottom: the near elbow (y 41) dips 4 cm under the bench top in the side view, same as the Smith flat press (forced by a vertical forearm and bar on the chest).
- Shrug: the drawn torso lengthens by 8 cm at the top (shoulder moves, hip fixed), same as db-shrug.
- Cable lines in the front view pass over the legs (single line to the pulley at x 0), and the tower column is drawn behind the lifter (same convention as the pushdown).
- Hip machines: foot plates are assumed to ride on the levers (feet do not slide).
