import { BASE_ANIMATIONS, type ExerciseAnimationSpec } from "./exerciseAnimation";
import { ANIMATIONS_W1 } from "./exerciseAnimationW1";
import { ANIMATIONS_W2 } from "./exerciseAnimationW2";
import { ANIMATIONS_W3 } from "./exerciseAnimationW3";
import { ANIMATIONS_W4 } from "./exerciseAnimationW4";
import { ANIMATIONS_W5 } from "./exerciseAnimationW5";

/** Every exercise with an explainer animation, by catalog id. */
export const EXERCISE_ANIMATIONS: Record<string, ExerciseAnimationSpec> = {
  ...BASE_ANIMATIONS,
  ...ANIMATIONS_W1,
  ...ANIMATIONS_W2,
  ...ANIMATIONS_W3,
  ...ANIMATIONS_W4,
  ...ANIMATIONS_W5,
};
