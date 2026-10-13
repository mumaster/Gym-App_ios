import {
  ARM,
  BODY,
  INCLINE_BACK,
  INCLINE_HIP,
  ROW_BENCH_Y,
  STAND_HIP_Y,
  STAND_SHOULDER_Y,
  assemble,
  clamp01,
  cos,
  forwardKnees,
  label,
  lerp,
  lerp3,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W3, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** Longest shoulder-to-wrist distance used for a locked-out arm (ARM is 55). */
const REACH = ARM - 0.2;
/** Height of a lying figure's shoulder and hip joints above the floor. */
const LYING_Y = ROW_BENCH_Y + 10;
const LYING_SHOULDER_Z = -8;
const LYING_HIP_Z = LYING_SHOULDER_Z + BODY.torso;

/** Lying on a flat bench: head, shoulders and hips on the pad, feet flat on the floor. */
function lying(
  wrist: (s: -1 | 1) => V3,
  elbowPole: (s: -1 | 1) => V3,
  extra: { bar?: V3; footHalf?: number } = {},
): FigurePose {
  return assemble({
    hip: { y: LYING_Y, z: LYING_HIP_Z },
    shoulder: { y: LYING_Y, z: LYING_SHOULDER_Z },
    head: [0, LYING_Y, LYING_SHOULDER_Z - 22],
    ankleZ: LYING_HIP_Z + 26,
    footHalf: extra.footHalf ?? 28,
    wrist,
    bar: extra.bar ?? [0, LYING_Y + 54, LYING_SHOULDER_Z + 4],
    kneePole: (s) => [s * 0.3, 1, 0.2],
    elbowPole,
  });
}

/** Dumbbell press path for one side: lockout over the chest, bottom beside the
 *  chest with the forearm vertical and the elbow about 50 degrees from the torso. */
const DB_ELBOW_OFFSET: V3 = [21.7, -6, 18.2];
const dbPressWrist = (s: -1 | 1, depth: number): V3 => {
  const top: V3 = [s * 17, LYING_Y + 54.6, LYING_SHOULDER_Z + 4];
  const bottom: V3 = [
    s * (BODY.shoulderHalf + DB_ELBOW_OFFSET[0]),
    LYING_Y + DB_ELBOW_OFFSET[1] + 26,
    LYING_SHOULDER_Z + DB_ELBOW_OFFSET[2],
  ];
  return lerp3(top, bottom, depth);
};
const dbElbowPole = (s: -1 | 1): V3 => [
  s * DB_ELBOW_OFFSET[0],
  DB_ELBOW_OFFSET[1],
  DB_ELBOW_OFFSET[2],
];

/** Dumbbell bench press on a flat bench. */
export function dbBenchPose(depth: number): FigurePose {
  return lying((s) => dbPressWrist(s, depth), dbElbowPole);
}

/** Single-arm dumbbell bench press: the near (right) hand presses, the other
 *  hand rests on the chest, hips level on the bench. */
export function singleArmDbBenchPose(depth: number): FigurePose {
  const rest: V3 = [-7, LYING_Y + 10, LYING_SHOULDER_Z + 14];
  return lying(
    (s) => (s > 0 ? dbPressWrist(1, depth) : rest),
    (s) => (s > 0 ? dbElbowPole(1) : [-1, -0.05, 0.25]),
    { footHalf: 30 },
  );
}

/** Dumbbell flye: the arm keeps a fixed soft elbow bend (about 18 degrees) and
 *  swings in the frontal plane as one piece, from the hands almost together over
 *  the chest to the hands level with the chest, elbows slightly lower. */
const FLY_BEND = 18;
const FLY_FORE_ANGLE = 180 - FLY_BEND; // angle at the elbow (degrees)
const FLY_CHORD = Math.sqrt(
  29 * 29 + 26 * 26 - 2 * 29 * 26 * Math.cos((FLY_FORE_ANGLE * Math.PI) / 180),
);
/** Angle at the shoulder between the upper arm and the shoulder-wrist line. */
const FLY_ALPHA =
  (Math.asin((26 * Math.sin((FLY_FORE_ANGLE * Math.PI) / 180)) / FLY_CHORD) * 180) / Math.PI;
export function dbFlyPose(depth: number): FigurePose {
  // Chord angle from vertical: slightly inwards at the top, nearly horizontal at the bottom.
  const phi = lerp(-8, 80, depth);
  const wrist = (s: -1 | 1): V3 => [
    s * (BODY.shoulderHalf + FLY_CHORD * sin(phi)),
    LYING_Y + FLY_CHORD * cos(phi),
    LYING_SHOULDER_Z,
  ];
  // The elbow bulges away from the chord: outwards at the top, down at the bottom.
  const pole = (s: -1 | 1): V3 => [s * cos(phi), -sin(phi), 0];
  return lying(wrist, pole, { footHalf: 30 });
}

/* ------------------------------------------------------------------ */
/* Incline press (barbell and Smith machine)                           */
/* ------------------------------------------------------------------ */

const INCLINE_SHOULDER = {
  y: INCLINE_HIP.y + BODY.torso * cos(INCLINE_BACK),
  z: INCLINE_HIP.z - BODY.torso * sin(INCLINE_BACK),
};
/** The bar centre when it rests on the upper chest, relative to the shoulder:
 *  a little down the chest and out from the chest wall. */
const CHEST_ALONG = -3;
const CHEST_OUT = 11;
export const INCLINE_BAR_BOTTOM = {
  y: INCLINE_SHOULDER.y + (CHEST_ALONG + CHEST_OUT) * cos(45),
  z: INCLINE_SHOULDER.z + (CHEST_OUT - CHEST_ALONG) * sin(45),
};

function inclineBarPose(depth: number, gripHalf: number, vertical: boolean): FigurePose {
  const dx = gripHalf - BODY.shoulderHalf;
  const bottom = INCLINE_BAR_BOTTOM;
  const topZ = vertical ? bottom.z : INCLINE_SHOULDER.z + 6;
  const topY =
    INCLINE_SHOULDER.y + Math.sqrt(REACH * REACH - dx * dx - (topZ - INCLINE_SHOULDER.z) ** 2);
  const barY = lerp(topY, bottom.y, depth);
  const barZ = lerp(topZ, bottom.z, vertical ? depth : Math.pow(depth, 1.6));
  // Bottom elbow: right under the wrist (vertical forearm); the pole points there.
  const pole = (s: -1 | 1): V3 => [
    s * dx,
    bottom.y - 26 - INCLINE_SHOULDER.y,
    bottom.z - INCLINE_SHOULDER.z,
  ];
  return assemble({
    hip: INCLINE_HIP,
    shoulder: INCLINE_SHOULDER,
    head: [
      0,
      INCLINE_SHOULDER.y + 22 * cos(INCLINE_BACK),
      INCLINE_SHOULDER.z - 22 * sin(INCLINE_BACK),
    ],
    ankleZ: 38,
    footHalf: 28,
    wrist: (s) => [s * gripHalf, barY, barZ],
    bar: [0, barY, barZ],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: pole,
  });
}

/** Incline barbell bench press: the bar travels to the upper chest and back
 *  over the upper chest and shoulders. */
export function bbInclineBenchPose(depth: number): FigurePose {
  return inclineBarPose(depth, 37, false);
}

/** Smith machine incline press: the bar is on rails, so its path is vertical. */
export function smithInclinePose(depth: number): FigurePose {
  return inclineBarPose(depth, 38, true);
}

/* ------------------------------------------------------------------ */
/* Standing overhead press                                            */
/* ------------------------------------------------------------------ */

const OHP_GRIP = 28;
const OHP_RACK = { y: STAND_SHOULDER_Y + 1, z: 10 };
const OHP_LOCK_Z = 5;
const OHP_LOCK_Y =
  STAND_SHOULDER_Y +
  Math.sqrt((REACH - 0.05) ** 2 - (OHP_GRIP - BODY.shoulderHalf) ** 2 - OHP_LOCK_Z * OHP_LOCK_Z);

/** Standing barbell overhead press. Depth 0 = locked out over the mid-foot,
 *  depth 1 = bar resting in the front rack on the collarbones. */
export function ohpPose(depth: number): FigurePose {
  const q = 1 - depth; // how far the bar has been pressed
  const barY = lerp(OHP_RACK.y, OHP_LOCK_Y, q);
  // The bar stays in front of the face until it is above the head, then moves
  // back over the mid-foot; the head makes room and then comes forward under it.
  const barZ = lerp(OHP_RACK.z, OHP_LOCK_Z, smooth(clamp01((q - 0.6) / 0.4)));
  const headZ = lerp(-6, 2, smooth(clamp01((q - 0.55) / 0.45)));
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: [0, shoulder.y + 22, headZ],
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * OHP_GRIP, barY, barZ],
    bar: [0, barY, barZ],
    kneePole: forwardKnees,
    // Bottom: the elbow sits under the wrist, a little in front of the shoulder.
    elbowPole: (s) => [s * (OHP_GRIP - BODY.shoulderHalf), -25, OHP_RACK.z],
  });
}

export const ANIMATIONS_W3: Record<string, ExerciseAnimationSpec> = {
  "db-bench": {
    figure: {
      pose: dbBenchPose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.3,
      centerZ: 22,
    },
    labels: label("Dumbbell bench press", "Dumbbell bankdrukken"),
    phases: {
      en: {
        lower: "Lower the dumbbells to the sides of your chest",
        touch: "Wrists over elbows, a deep stretch",
        press: "Press up and slightly together",
        lockout: "Arms straight above your chest",
      },
      nl: {
        lower: "Laat de dumbbells zakken naar de zijkanten van je borst",
        touch: "Polsen boven ellebogen, een diepe rek",
        press: "Duw omhoog en iets naar elkaar toe",
        lockout: "Armen gestrekt boven je borst",
      },
    },
    cues: {
      en: [
        "Lie on a flat bench with your head, shoulders and hips on the pad and your feet flat on the floor.",
        "Pull your shoulder blades back and down and keep them pinned to the bench.",
        "Lower until your wrists are stacked over your elbows, elbows about 45 to 60 degrees from your torso.",
        "Press the dumbbells up and slightly together until your arms are straight over your chest.",
      ],
      nl: [
        "Ga op een vlakke bank liggen met hoofd, schouders en heupen op het kussen en je voeten plat op de grond.",
        "Trek je schouderbladen naar achteren en omlaag en houd ze vast op de bank.",
        "Zak tot je polsen boven je ellebogen staan, ellebogen ongeveer 45 tot 60 graden van je romp.",
        "Duw de dumbbells omhoog en iets naar elkaar toe tot je armen gestrekt boven je borst zijn.",
      ],
    },
  },
  "single-arm-db-bench": {
    figure: {
      pose: singleArmDbBenchPose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.3,
      centerZ: 22,
      oneDumbbell: true,
    },
    labels: label("Single-arm dumbbell bench press", "Dumbbell bankdrukken met één arm"),
    phases: {
      en: {
        lower: "Lower the dumbbell beside your chest",
        touch: "Wrist over elbow, hips level",
        press: "Press up over your shoulder",
        lockout: "Arm straight, free hand on your chest",
      },
      nl: {
        lower: "Laat de dumbbell zakken naast je borst",
        touch: "Pols boven elleboog, heupen waterpas",
        press: "Duw omhoog boven je schouder",
        lockout: "Arm gestrekt, vrije hand op je borst",
      },
    },
    cues: {
      en: [
        "Lie on a flat bench with your feet planted wide and rest your free hand on your chest.",
        "Brace your core and keep your hips level and on the bench, don't let them twist.",
        "Lower the dumbbell beside your chest until your wrist is over your elbow.",
        "Press straight up over your shoulder, then repeat and switch arms.",
      ],
      nl: [
        "Ga op een vlakke bank liggen met je voeten wijd neer en leg je vrije hand op je borst.",
        "Span je buik aan en houd je heupen waterpas en op de bank, laat ze niet draaien.",
        "Laat de dumbbell zakken naast je borst tot je pols boven je elleboog staat.",
        "Duw recht omhoog boven je schouder, herhaal en wissel dan van arm.",
      ],
    },
  },
  "db-fly": {
    figure: {
      pose: dbFlyPose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.3,
      centerZ: 22,
      neutralGrip: true,
    },
    labels: label("Dumbbell flye", "Dumbbell flye"),
    phases: {
      en: {
        lower: "Open your arms wide in an arc, elbows softly bent",
        touch: "Hands level with your chest, chest stretched",
        press: "Squeeze your chest and hug the arc closed",
        lockout: "Dumbbells together above your chest",
      },
      nl: {
        lower: "Open je armen wijd in een boog, ellebogen licht gebogen",
        touch: "Handen ter hoogte van je borst, borst gerekt",
        press: "Knijp je borst samen en sluit de boog",
        lockout: "Dumbbells bij elkaar boven je borst",
      },
    },
    cues: {
      en: [
        "Lie on a flat bench, dumbbells above your chest with your palms facing each other.",
        "Keep a soft, fixed bend in your elbows, about 15 to 20 degrees. It must not change.",
        "Open your arms in a wide arc until your hands are about level with your chest.",
        "Squeeze your chest to bring the dumbbells back together, like hugging a tree.",
      ],
      nl: [
        "Ga op een vlakke bank liggen, dumbbells boven je borst met je handpalmen naar elkaar toe.",
        "Houd een zachte, vaste buiging in je ellebogen, ongeveer 15 tot 20 graden. Die verandert niet.",
        "Open je armen in een wijde boog tot je handen ongeveer ter hoogte van je borst zijn.",
        "Knijp je borst samen en breng de dumbbells weer bij elkaar, alsof je een boom omarmt.",
      ],
    },
  },
  "bb-incline-bench": {
    figure: {
      pose: bbInclineBenchPose,
      implement: "barbell",
      furniture: "w3-incline-rack",
      scale: 1.0,
      centerZ: -2,
    },
    labels: label("Incline barbell bench press", "Schuine bank bankdrukken met halterstang"),
    phases: {
      en: {
        lower: "Lower the bar to your upper chest",
        touch: "Bar on your upper chest, wrists over elbows",
        press: "Press up and slightly back",
        lockout: "Lock out over your upper chest and shoulders",
      },
      nl: {
        lower: "Laat de stang zakken naar je bovenborst",
        touch: "Stang op je bovenborst, polsen boven ellebogen",
        press: "Duw omhoog en iets naar achteren",
        lockout: "Strek boven je bovenborst en schouders",
      },
    },
    cues: {
      en: [
        "Set the bench to about 30 to 45 degrees. Head and back on the pad, feet planted.",
        "Pull your shoulder blades back and down and keep them pinned to the pad.",
        "Lower the bar under control to your upper chest, wrists stacked over your elbows.",
        "Press up and slightly back until your arms are locked out over your upper chest.",
      ],
      nl: [
        "Zet de bank op ongeveer 30 tot 45 graden. Hoofd en rug op het kussen, voeten stevig neer.",
        "Trek je schouderbladen naar achteren en omlaag en houd ze vast op het kussen.",
        "Laat de stang gecontroleerd zakken naar je bovenborst, polsen boven je ellebogen.",
        "Duw omhoog en iets naar achteren tot je armen gestrekt zijn boven je bovenborst.",
      ],
    },
  },
  "smith-incline-press": {
    figure: {
      pose: smithInclinePose,
      implement: "w3-smith-bar",
      furniture: "w3-smith-incline",
      scale: 1.0,
      centerZ: -2,
    },
    labels: label("Smith machine incline press", "Schuine bank press in de Smith machine"),
    phases: {
      en: {
        lower: "Lower the bar straight down to your upper chest",
        touch: "Bar on your upper chest, wrists over elbows",
        press: "Press straight up along the rails",
        lockout: "Lock out over your upper chest",
      },
      nl: {
        lower: "Laat de stang recht omlaag zakken naar je bovenborst",
        touch: "Stang op je bovenborst, polsen boven ellebogen",
        press: "Duw recht omhoog langs de rails",
        lockout: "Strek boven je bovenborst",
      },
    },
    cues: {
      en: [
        "Set the bench at about 30 to 45 degrees with the bar lined up over your upper chest.",
        "Plant your feet, pin your shoulder blades back and down and grip the bar just wider than your shoulders.",
        "Twist the bar off the hooks and lower it straight down to your upper chest.",
        "Press straight up along the rails and lock out. Re-hook the bar when you are done.",
      ],
      nl: [
        "Zet de bank op ongeveer 30 tot 45 graden met de stang boven je bovenborst.",
        "Zet je voeten stevig neer, trek je schouderbladen naar achteren en omlaag en pak de stang net breder dan je schouders.",
        "Draai de stang van de haken en laat hem recht omlaag zakken naar je bovenborst.",
        "Duw recht omhoog langs de rails en strek je armen. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  ohp: {
    figure: {
      pose: ohpPose,
      implement: "barbell",
      furniture: "none",
      scale: 0.85,
      centerZ: 4,
    },
    labels: label("Standing overhead press", "Staand schouderdrukken met halterstang"),
    phases: {
      en: {
        lower: "Lower the bar to your collarbones, head back to let it pass",
        touch: "Bar in the front rack, forearms vertical",
        press: "Press straight up, then push your head through",
        lockout: "Lock out overhead, bar over your mid-foot",
      },
      nl: {
        lower: "Laat de stang zakken naar je sleutelbeenderen, hoofd naar achteren",
        touch: "Stang in de voorste rack, onderarmen verticaal",
        press: "Duw recht omhoog en steek je hoofd erdoorheen",
        lockout: "Strek boven je hoofd, stang boven het midden van je voet",
      },
    },
    cues: {
      en: [
        "Stand with your feet hip-width apart and squeeze your glutes. The bar rests on your collarbones, forearms vertical.",
        "Brace your core and don't lean back. Your ribs stay down.",
        "Press the bar straight up. Move your head back a little to let it pass, then push it forward under the bar.",
        "Lock out with the bar over your mid-foot and your biceps beside your ears.",
      ],
      nl: [
        "Sta met je voeten op heupbreedte en knijp je billen samen. De stang rust op je sleutelbeenderen, onderarmen verticaal.",
        "Span je buik aan en leun niet achterover. Je ribben blijven omlaag.",
        "Duw de stang recht omhoog. Zet je hoofd even iets naar achteren om hem te laten passeren en duw het dan naar voren onder de stang.",
        "Strek helemaal met de stang boven het midden van je voet en je armen naast je oren.",
      ],
    },
  },
};
