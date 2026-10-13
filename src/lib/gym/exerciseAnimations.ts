import { BASE_ANIMATIONS, label, type ExerciseAnimationSpec } from "./exerciseAnimation";
import { ANIMATIONS_W1 } from "./exerciseAnimationW1";
import { ANIMATIONS_W2 } from "./exerciseAnimationW2";
import { ANIMATIONS_W3 } from "./exerciseAnimationW3";
import { ANIMATIONS_W4 } from "./exerciseAnimationW4";
import { ANIMATIONS_W5 } from "./exerciseAnimationW5";

/** Another catalog exercise with the same movement as an animated one (a
 *  lever leg extension, a bodyweight step-up): its animation with its own
 *  names, and optionally another implement and first cue. */
function variant(
  of: string,
  en: string,
  nl: string,
  change: { implement?: string; firstCue?: { en: string; nl: string } } = {},
): ExerciseAnimationSpec {
  const base = BASE_ANIMATIONS[of]!;
  const cue = change.firstCue;
  return {
    ...base,
    ...(base.figure
      ? { figure: { ...base.figure, ...(change.implement ? { implement: change.implement } : {}) } }
      : {}),
    labels: label(en, nl),
    cues: cue
      ? { en: [cue.en, ...base.cues.en.slice(1)], nl: [cue.nl, ...base.cues.nl.slice(1)] }
      : base.cues,
  };
}

const VARIANTS: Record<string, ExerciseAnimationSpec> = {
  "leg-developer-extension": variant("leg-extension", "Lever leg extension", "Leg extension"),
  "seated-leg-curl": variant("leg-curl", "Machine seated leg curl", "Seated leg curl"),
  "chest-dip": variant("dips", "Chest dip", "Dips voor de borst"),
  "bw-step-up": variant("db-step-up", "Step-up", "Step-up", {
    implement: "none",
    firstCue: {
      en: "Use a box or bench about knee height, arms relaxed by your sides.",
      nl: "Gebruik een box of bank op ongeveer kniehoogte, armen ontspannen langs je lichaam.",
    },
  }),
  "bw-calf-raise": variant("standing-calf", "Bodyweight calf raise", "Kuitheffing zonder gewicht", {
    implement: "none",
  }),
};

/** Every exercise with an explainer animation, by catalog id. */
export const EXERCISE_ANIMATIONS: Record<string, ExerciseAnimationSpec> = {
  ...BASE_ANIMATIONS,
  ...VARIANTS,
  ...ANIMATIONS_W1,
  ...ANIMATIONS_W2,
  ...ANIMATIONS_W3,
  ...ANIMATIONS_W4,
  ...ANIMATIONS_W5,
};
