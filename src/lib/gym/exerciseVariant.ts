import type { ExerciseAnimationSpec } from "./exerciseAnimation";
import { label } from "./exerciseAnimation";

/** Another catalog exercise with the same movement as an animated one (a
 *  lever leg extension, a bodyweight step-up): the base spec with its own
 *  names, and optionally another implement, grip and cues. Animation batch
 *  modules use it for their near-copies. */
export function variantSpec(
  base: ExerciseAnimationSpec,
  en: string,
  nl: string,
  change: {
    implement?: string;
    furniture?: string;
    neutralGrip?: boolean;
    firstCue?: { en: string; nl: string };
    cues?: ExerciseAnimationSpec["cues"];
  } = {},
): ExerciseAnimationSpec {
  const cue = change.firstCue;
  return {
    ...base,
    ...(base.figure
      ? {
          figure: {
            ...base.figure,
            ...(change.implement ? { implement: change.implement } : {}),
            ...(change.furniture ? { furniture: change.furniture } : {}),
            ...(change.neutralGrip !== undefined ? { neutralGrip: change.neutralGrip } : {}),
          },
        }
      : {}),
    labels: label(en, nl),
    cues:
      change.cues ??
      (cue
        ? { en: [cue.en, ...base.cues.en.slice(1)], nl: [cue.nl, ...base.cues.nl.slice(1)] }
        : base.cues),
  };
}
