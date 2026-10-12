# Exercise animations: posture and clipping rules

Read this before adding an entry to `EXERCISE_ANIMATIONS`. Born from the first batch (deadlift, RDL, goblet squat, shoulder press, lat pulldown), where Max found clipping and wrong postures.

## Check before shipping
1. Render every exercise in both views at phases 0, 450, 700 and 900 (slider "Move through the rep") at 390 wide and look at them at full size, not thumbnails. Compare with a photo or video of the real lift.
2. Nothing may touch or cross the SVG edge (viewBox is 320 x 206; floor at y 196). Furniture tops need headroom for pulleys and circles: keep tops under about 172 cm at scale 1.05.
3. Tests for geometry (`exerciseAnimation.test.ts`): constant limb lengths, targets within reach (an unreachable wrist silently stretches the forearm), feet planted.

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
