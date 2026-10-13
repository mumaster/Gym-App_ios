import { BASE_ANIMATIONS, label, type ExerciseAnimationSpec } from "./exerciseAnimation";
import { ANIMATIONS_W1 } from "./exerciseAnimationW1";
import { ANIMATIONS_W2 } from "./exerciseAnimationW2";
import { ANIMATIONS_W3 } from "./exerciseAnimationW3";
import { ANIMATIONS_W4 } from "./exerciseAnimationW4";
import { ANIMATIONS_W5 } from "./exerciseAnimationW5";
import { ANIMATIONS_W6 } from "./exerciseAnimationW6";
import { ANIMATIONS_W7 } from "./exerciseAnimationW7";
import { ANIMATIONS_W8 } from "./exerciseAnimationW8";
import { ANIMATIONS_W9 } from "./exerciseAnimationW9";
import { ANIMATIONS_W10 } from "./exerciseAnimationW10";
import { ANIMATIONS_W11 } from "./exerciseAnimationW11";

/** Another catalog exercise with the same movement as an animated one (a
 *  lever leg extension, a bodyweight step-up): its animation with its own
 *  names, and optionally another implement and first cue. */
function variant(
  of: string,
  en: string,
  nl: string,
  change: {
    implement?: string;
    neutralGrip?: boolean;
    firstCue?: { en: string; nl: string };
    cues?: ExerciseAnimationSpec["cues"];
  } = {},
): ExerciseAnimationSpec {
  const base = BASE_ANIMATIONS[of]!;
  const cue = change.firstCue;
  return {
    ...base,
    ...(base.figure
      ? {
          figure: {
            ...base.figure,
            ...(change.implement ? { implement: change.implement } : {}),
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
  "db-calf": variant("standing-calf", "Dumbbell calf raise", "Kuitheffing met dumbbells"),
  "rope-pushdown": variant("cable-pushdown", "Rope triceps pushdown", "Triceps pushdown met touw", {
    implement: "rope",
    cues: {
      en: [
        "Stand close to the high pulley holding the rope, a slight lean forward, elbows at your sides.",
        "Press the rope down and spread the ends apart at the bottom.",
        "Keep your elbows still. Only your forearms move.",
        "Squeeze for a second at the bottom, then let the rope rise until your forearms are level.",
      ],
      nl: [
        "Sta dicht bij de hoge katrol met het touw vast, licht voorovergebogen, ellebogen langs je zij.",
        "Duw het touw omlaag en trek de uiteinden onderin uit elkaar.",
        "Houd je ellebogen stil. Alleen je onderarmen bewegen.",
        "Knijp onderin een seconde aan en laat het touw dan omhoog tot je onderarmen horizontaal zijn.",
      ],
    },
  }),
  "bw-hip-thrust": variant("hip-thrust", "Bodyweight hip thrust", "Hip thrust zonder gewicht", {
    implement: "none",
    cues: {
      en: [
        "Sit with your upper back against a bench, feet flat and hip-width apart.",
        "Drive through your heels and lift your hips until your body is level from shoulders to knees.",
        "Squeeze your glutes at the top with your shins vertical.",
        "Keep your ribs down and your chin tucked.",
        "Lower your hips under control and repeat.",
      ],
      nl: [
        "Zit met je bovenrug tegen een bank, voeten plat op heupbreedte.",
        "Duw door je hielen en til je heupen op tot je lichaam van schouders tot knieën vlak is.",
        "Span bovenin je billen aan met je scheenbenen verticaal.",
        "Houd je ribben omlaag en je kin licht ingetrokken.",
        "Laat je heupen gecontroleerd zakken en herhaal.",
      ],
    },
  }),
  "single-leg-rdl": variant(
    "db-single-leg-rdl",
    "Single-leg Romanian deadlift",
    "Romeinse deadlift op één been",
    {
      implement: "none",
      cues: {
        en: [
          "Stand on one leg with a soft knee, arms hanging down.",
          "Hinge at the hip and let your free leg rise behind you in one line with your torso.",
          "Keep your hips level and your back flat.",
          "Lower until your torso is about level, then drive your hip forward to stand tall.",
        ],
        nl: [
          "Sta op één been met een zachte knie, armen hangend.",
          "Scharnier vanuit je heup en laat je vrije been achter je omhoog komen, in één lijn met je romp.",
          "Houd je heupen recht en je rug plat.",
          "Zak tot je romp ongeveer horizontaal is en duw dan je heup naar voren om rechtop te komen.",
        ],
      },
    },
  ),
  "bb-lying-triceps-extension": variant(
    "skullcrusher",
    "Barbell lying triceps extension",
    "Liggende triceps extensie met stang",
    {
      implement: "small-barbell",
      neutralGrip: false,
      cues: {
        en: [
          "Lie on a flat bench, feet flat, the bar above your shoulders with a narrow overhand grip.",
          "Keep your upper arms still. Only your forearms move.",
          "Lower the bar toward your forehead by bending your elbows.",
          "Straighten your elbows to press back up without flaring them out.",
          "Keep your lower back on the bench and your wrists straight.",
        ],
        nl: [
          "Ga op een vlakke bank liggen, voeten plat, de stang boven je schouders met een smalle bovenhandse greep.",
          "Houd je bovenarmen stil. Alleen je onderarmen bewegen.",
          "Laat de stang zakken richting je voorhoofd door je ellebogen te buigen.",
          "Strek je ellebogen om omhoog te duwen zonder ze naar buiten te laten wijken.",
          "Houd je onderrug op de bank en je polsen recht.",
        ],
      },
    },
  ),
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
  ...ANIMATIONS_W6,
  ...ANIMATIONS_W7,
  ...ANIMATIONS_W8,
  ...ANIMATIONS_W9,
  ...ANIMATIONS_W10,
  ...ANIMATIONS_W11,
};
