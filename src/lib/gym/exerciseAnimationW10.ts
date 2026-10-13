import {
  ANKLE_Y,
  ARM,
  BODY,
  PLATE_RADIUS,
  STAND_HIP_Y,
  STAND_SHOULDER_Y,
  assemble,
  cos,
  forwardKnees,
  headFrom,
  hipAt,
  label,
  lerp,
  sin,
  smooth,
  twoBone,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W10, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/* ------------------------------------------------------------------ */
/* Dumbbell front raise                                                */
/* ------------------------------------------------------------------ */

const FRONT_RAISE_REACH = 54; // shoulder -> wrist: a soft, fixed elbow bend
const FRONT_RAISE_HALF_GRIP = 17;

/** Dumbbell front raise: standing tall, the arms swing forward as one piece
 *  (a soft fixed elbow) from the thighs up to shoulder height. */
export function frontRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const phi = lerp(7, 87, e); // degrees from hanging, forward
  const inPlane = Math.sqrt(
    FRONT_RAISE_REACH ** 2 - (BODY.shoulderHalf - FRONT_RAISE_HALF_GRIP) ** 2,
  );
  const wy = shoulder.y - inPlane * cos(phi);
  const wz = inPlane * sin(phi);
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * FRONT_RAISE_HALF_GRIP, wy, wz],
    bar: [0, wy, wz],
    kneePole: forwardKnees,
    // The elbow's soft bend points down and back: the forearm leans a touch forward.
    elbowPole: (s) => [s * 0.3, -0.2, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Dumbbell bent-over row                                              */
/* ------------------------------------------------------------------ */

const ROW_LEAN = 52;

/** Dumbbell bent-over row: the torso is held at about 50 degrees from
 *  vertical with soft knees; both dumbbells travel from hanging arms to the
 *  sides of the lower ribs, the elbows going back and up past the torso. */
export function dbBentRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const dz = -26 - -6;
  const hip = { z: -26, y: ANKLE_Y + Math.sqrt(80 * 80 - dz * dz - 16) };
  const shoulder = {
    y: hip.y + BODY.torso * cos(ROW_LEAN),
    z: hip.z + BODY.torso * sin(ROW_LEAN),
  };
  const hang: V3 = [20, shoulder.y - Math.sqrt(ARM * ARM - 1) + 0.1, shoulder.z];
  // Contact point: 68% down the torso, beside the ribs and a little in front.
  const rib: V3 = [
    21,
    shoulder.y - 0.68 * BODY.torso * cos(ROW_LEAN) - 9 * sin(ROW_LEAN),
    shoulder.z - 0.68 * BODY.torso * sin(ROW_LEAN) + 9 * cos(ROW_LEAN),
  ];
  const w: V3 = [lerp(hang[0], rib[0], e), lerp(hang[1], rib[1], e), lerp(hang[2], rib[2], e)];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, ROW_LEAN * 0.6),
    ankleZ: -6,
    footHalf: 14,
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.4, 0.5, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Barbell sumo deadlift                                               */
/* ------------------------------------------------------------------ */

const SUMO_FOOT_HALF = 32;
const SUMO_GRIP_HALF = 16;
/** Sideways hip-to-ankle offset: the wide stance shortens the reach in the side view. */
const SUMO_DX = SUMO_FOOT_HALF - BODY.hipHalf;

/** Barbell sumo deadlift: wide stance, hands inside the knees, the bar rises
 *  straight up the shins over the mid-foot with a fixed torso length and a
 *  steadily growing hip-to-ankle reach. */
export function bbSumoPose(depth: number): FigurePose {
  const e = smooth(depth);
  const barY = lerp(88.5, PLATE_RADIUS, e);
  const barZ = lerp(7, 3, e);
  const off = lerp(-6, 12, e);
  const dxArm = BODY.shoulderHalf - SUMO_GRIP_HALF;
  const shoulder = {
    y: barY + Math.sqrt((ARM - 0.2) ** 2 - dxArm ** 2 - off ** 2),
    z: barZ + off,
  };
  const reach2d = lerp(84.8, 44, e);
  const hip = hipAt(shoulder, { y: ANKLE_Y, z: 0 }, reach2d);
  const lean = (Math.atan2(shoulder.z - hip.z, shoulder.y - hip.y) * 180) / Math.PI;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.7),
    ankleZ: 0,
    footHalf: SUMO_FOOT_HALF,
    wrist: (s) => [s * SUMO_GRIP_HALF, barY, barZ],
    bar: [0, barY, barZ],
    kneePole: (s) => [s * 1, 0, 0.6],
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Dumbbell sumo squat                                                 */
/* ------------------------------------------------------------------ */

const SQUAT_FOOT_HALF = 28;
const SQUAT_HAND_HALF = 3;

/** Dumbbell sumo squat: wide stance, one dumbbell hanging vertically between
 *  the legs on straight arms, torso upright, knees out over the toes, sitting
 *  down until the thighs are about level. */
export function sumoSquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: lerp(93.9, 47, e), z: lerp(0, -13, e) };
  const lean = 16 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // Straight arms hang from the shoulders and lean forward with the torso.
  const hang = Math.sqrt((ARM - 0.2) ** 2 - (BODY.shoulderHalf - SQUAT_HAND_HALF) ** 2);
  const tilt = lerp(2, 10, e);
  const w = { y: shoulder.y - hang * cos(tilt), z: shoulder.z + hang * sin(tilt) };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.4),
    ankleZ: 0,
    footHalf: SQUAT_FOOT_HALF,
    wrist: (s) => [s * SQUAT_HAND_HALF, w.y, w.z],
    bar: [0, w.y - 6, w.z],
    kneePole: (s) => [s * 0.5, 0.2, 1],
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Dumbbell side bend                                                  */
/* ------------------------------------------------------------------ */

/** Total sideways bend of the upper spine at the bottom (degrees). */
const BEND_MAX = 36;

/** Dumbbell side bend: standing tall with one dumbbell in the near (right)
 *  hand, the free hand behind the head. The spine bends sideways toward the
 *  dumbbell, the hand slides down the thigh, the hips stay put. */
export function sideBendPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip: V3 = [0, STAND_HIP_Y, 0];
  // The spine curves: the lower half bends less than the upper half.
  const a1 = BEND_MAX * 0.45 * e;
  const a2 = BEND_MAX * e;
  const mid: V3 = [hip[0] + 25 * sin(a1), hip[1] + 25 * cos(a1), 0];
  const top: V3 = [mid[0] + 25 * sin(a2), mid[1] + 25 * cos(a2), 0];
  // The shoulder line tilts with the upper spine; the right side drops.
  const sh = (s: -1 | 1): V3 => [
    top[0] + s * BODY.shoulderHalf * cos(a2),
    top[1] - s * BODY.shoulderHalf * sin(a2),
    0,
  ];
  const head: V3 = [top[0] + 22 * sin(a2 * 0.9), top[1] + 22 * cos(a2 * 0.9), 0];
  const base = assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder: { y: STAND_SHOULDER_Y, z: 0 },
    head,
    ankleZ: 0,
    footHalf: 11,
    wrist: () => [0, 0, 0],
    bar: [0, 0, 0],
    kneePole: forwardKnees,
    elbowPole: () => [0, 0, 1],
  });
  const shoulders: [V3, V3] = [sh(-1), sh(1)];
  // Working (right) hand: a straight arm, the hand drifting in toward the thigh.
  const wx = lerp(BODY.shoulderHalf + 1, 16, e);
  const reach = ARM - 0.15;
  const wy = shoulders[1][1] - Math.sqrt(reach * reach - (shoulders[1][0] - wx) ** 2 - 4);
  const rw: V3 = [wx, wy, 2];
  const re = twoBone(shoulders[1], rw, 29, 26, [0.3, 0, -1]);
  // Free (left) hand resting on the hip crest, elbow out to the side.
  const lw: V3 = [-16, base.hips[0][1] + 12, 6];
  const le = twoBone(shoulders[0], lw, 29, 26, [-1, -0.2, -0.1]);
  return {
    ...base,
    shoulders,
    elbows: [le, re],
    wrists: [lw, rw],
    bar: rw,
    head,
  };
}

/* ------------------------------------------------------------------ */
/* Good morning                                                        */
/* ------------------------------------------------------------------ */

const GM_LEAN = 58;

/** Barbell good morning: the bar rides on the traps and stays over the
 *  mid-foot while the hips travel far back and the flat back tips toward
 *  horizontal, knees only soft. */
export function goodMorningPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = GM_LEAN * e;
  const reach = lerp(87.8, 81, e);
  // The bar sits on the traps: a little above the shoulder and behind the neck.
  // Solve the hip so the bar stays over the foot as the torso tips.
  const barZ = lerp(-6, 5, e);
  const hipZ = barZ - (BODY.torso + 3) * sin(lean) + 6 * cos(lean);
  const dz = hipZ - 0;
  const dx = 14 - BODY.hipHalf;
  const hip = { z: hipZ, y: ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx) };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const bar: V3 = [
    0,
    shoulder.y + 3 * cos(lean) + 6 * sin(lean),
    shoulder.z + 3 * sin(lean) - 6 * cos(lean),
  ];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.55),
    ankleZ: 0,
    footHalf: 14,
    wrist: (s) => [s * 27, bar[1], bar[2]],
    bar,
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, -1, -0.7],
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W10: Record<string, ExerciseAnimationSpec> = {
  "db-front-raise": {
    figure: {
      pose: frontRaisePose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("Dumbbell front raise", "Frontale dumbbell raise"),
    phases: {
      en: {
        lower: "Raise the dumbbells straight in front of you",
        touch: "Hands at shoulder height",
        press: "Lower slowly under control",
        lockout: "Dumbbells in front of your thighs, standing tall",
      },
      nl: {
        lower: "Til de dumbbells recht voor je uit",
        touch: "Handen op schouderhoogte",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Dumbbells voor je dijen, rechtop staan",
      },
    },
    cues: {
      en: [
        "Stand tall, feet hip-width apart, a dumbbell in each hand in front of your thighs.",
        "Keep a soft bend in your elbows and lift your arms straight forward.",
        "Stop when your hands reach shoulder height. Don't swing or lean back.",
        "Lower for about two seconds back to your thighs.",
      ],
      nl: [
        "Sta rechtop, voeten heupbreed, een dumbbell in elke hand voor je dijen.",
        "Houd je ellebogen zacht gebogen en til je armen recht naar voren.",
        "Stop als je handen op schouderhoogte zijn. Zwaai niet en leun niet achterover.",
        "Laat ongeveer twee seconden zakken naar je dijen.",
      ],
    },
  },
  "db-bent-over-row": {
    figure: {
      pose: dbBentRowPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
      neutralGrip: true,
    },
    labels: label("Dumbbell bent-over row", "Gebogen roeien met dumbbells"),
    phases: {
      en: {
        lower: "Row the dumbbells to your lower ribs",
        touch: "Squeeze your shoulder blades together",
        press: "Lower the dumbbells under control",
        lockout: "Arms long, back flat",
      },
      nl: {
        lower: "Roei de dumbbells naar je onderste ribben",
        touch: "Knijp je schouderbladen samen",
        press: "Laat de dumbbells gecontroleerd zakken",
        lockout: "Lange armen, rug recht",
      },
    },
    cues: {
      en: [
        "Hinge at the hips with soft knees until your torso is about 45 degrees above horizontal.",
        "Flat back and neutral neck. Brace your core and keep this angle all rep.",
        "Start with straight arms and the dumbbells hanging below your shoulders.",
        "Pull your elbows back and up, bringing the dumbbells to the sides of your lower ribs.",
        "Pause and squeeze, then lower slowly without letting your torso swing.",
      ],
      nl: [
        "Buig vanuit je heupen met zachte knieën tot je romp ongeveer 45 graden boven horizontaal is.",
        "Rechte rug en neutrale nek. Span je core aan en houd deze hoek de hele herhaling vast.",
        "Begin met gestrekte armen en de dumbbells hangend onder je schouders.",
        "Trek je ellebogen naar achteren en omhoog, de dumbbells gaan naar de zijkant van je onderste ribben.",
        "Pauzeer en knijp, laat dan langzaam zakken zonder met je romp te zwaaien.",
      ],
    },
  },
  "bb-sumo-deadlift": {
    figure: {
      pose: bbSumoPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: -10,
    },
    labels: label("Barbell sumo deadlift", "Sumo deadlift met halterstang"),
    phases: {
      en: {
        lower: "Sit down between your legs, chest up",
        touch: "Bar at the floor, flat back",
        press: "Push the floor apart and stand up",
        lockout: "Stand tall, squeeze your glutes",
      },
      nl: {
        lower: "Zak tussen je benen door, borst omhoog",
        touch: "Stang bij de grond, rechte rug",
        press: "Duw de vloer uit elkaar en kom omhoog",
        lockout: "Sta rechtop, span je billen aan",
      },
    },
    cues: {
      en: [
        "Wide stance with your toes turned out, the bar over your mid-foot and your hands inside your knees.",
        "Chest up, flat back, arms straight and hanging.",
        "Push your knees out over your toes as you pull the slack out of the bar.",
        "Push the floor apart to stand, the bar sliding up your shins and thighs.",
        "Finish with a hard glute squeeze, not by leaning back.",
      ],
      nl: [
        "Brede stand met je tenen naar buiten, de stang boven het midden van je voet en je handen binnen je knieën.",
        "Borst omhoog, rechte rug, armen gestrekt en hangend.",
        "Duw je knieën naar buiten over je tenen terwijl je de speling uit de stang haalt.",
        "Duw de vloer uit elkaar om te staan, de stang schuift langs je scheenbenen en bovenbenen omhoog.",
        "Eindig met een stevige bilknijp, niet door achterover te leunen.",
      ],
    },
  },
  "db-sumo-squat": {
    figure: {
      pose: sumoSquatPose,
      implement: "goblet",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Dumbbell sumo squat", "Sumo squat met dumbbell"),
    phases: {
      en: {
        lower: "Sit straight down between your knees",
        touch: "Thighs about level, chest up",
        press: "Push the floor apart and stand up",
        lockout: "Stand tall, dumbbell hanging between your legs",
      },
      nl: {
        lower: "Zak recht naar beneden tussen je knieën",
        touch: "Bovenbenen ongeveer horizontaal, borst omhoog",
        press: "Duw de vloer uit elkaar en kom omhoog",
        lockout: "Sta rechtop, dumbbell hangend tussen je benen",
      },
    },
    cues: {
      en: [
        "Take a wide stance with your toes turned out and hold one dumbbell vertically between your legs.",
        "Keep your arms straight and your chest up.",
        "Push your knees out over your toes as you sit straight down until your thighs are about level.",
        "Push the floor apart to stand and squeeze your glutes at the top.",
      ],
      nl: [
        "Neem een brede stand met je tenen naar buiten en houd één dumbbell verticaal tussen je benen.",
        "Houd je armen gestrekt en je borst omhoog.",
        "Duw je knieën naar buiten over je tenen terwijl je recht naar beneden zakt tot je bovenbenen ongeveer horizontaal zijn.",
        "Duw de vloer uit elkaar om te staan en span je billen aan bovenin.",
      ],
    },
  },
  "db-side-bend": {
    figure: {
      pose: sideBendPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
      oneDumbbell: true,
      neutralGrip: true,
    },
    labels: label("Dumbbell side bend", "Zijwaartse buiging met dumbbell"),
    phases: {
      en: {
        lower: "Bend sideways, sliding the dumbbell down your thigh",
        touch: "Deepest point, feel the stretch",
        press: "Squeeze your side and come back up",
        lockout: "Stand tall, dumbbell at your side",
      },
      nl: {
        lower: "Buig opzij en laat de dumbbell langs je dij zakken",
        touch: "Diepste punt, voel de rek",
        press: "Span je zij aan en kom weer omhoog",
        lockout: "Sta rechtop, dumbbell langs je zij",
      },
    },
    cues: {
      en: [
        "Stand tall with a dumbbell in one hand at your side and the other hand behind your head.",
        "Keep your hips still and bend sideways toward the dumbbell. Don't lean forward or back.",
        "Slide the dumbbell down your thigh until you feel a stretch along the opposite side.",
        "Use your side muscles to pull back up to standing. Do all reps on one side, then switch.",
      ],
      nl: [
        "Sta rechtop met een dumbbell in één hand langs je zij en de andere hand achter je hoofd.",
        "Houd je heupen stil en buig opzij naar de dumbbell. Leun niet naar voren of achteren.",
        "Laat de dumbbell langs je dij zakken tot je een rek voelt aan de andere kant.",
        "Gebruik je zijspieren om weer rechtop te komen. Doe alle herhalingen aan één kant en wissel dan.",
      ],
    },
  },
  "good-morning": {
    figure: {
      pose: goodMorningPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: -10,
    },
    labels: label("Good morning", "Good morning met halterstang"),
    phases: {
      en: {
        lower: "Push your hips back and tip your chest forward",
        touch: "Torso near parallel, feel the hamstrings",
        press: "Drive your hips forward and stand up",
        lockout: "Stand tall, bar on your upper back",
      },
      nl: {
        lower: "Duw je heupen naar achteren en kantel je borst naar voren",
        touch: "Romp bijna parallel, voel je hamstrings",
        press: "Duw je heupen naar voren en kom omhoog",
        lockout: "Sta rechtop, stang op je bovenrug",
      },
    },
    cues: {
      en: [
        "Rest the bar on your upper back as for a squat, feet hip-width apart, knees soft.",
        "Push your hips straight back and tip your torso forward with a flat back and neutral neck.",
        "Go down until your torso is close to parallel or you feel your hamstrings stretch, keeping the bar over your mid-foot.",
        "Drive your hips forward to stand tall. It's a hinge, not a squat.",
      ],
      nl: [
        "Leg de stang op je bovenrug zoals bij een squat, voeten heupbreed, knieën zacht.",
        "Duw je heupen recht naar achteren en kantel je romp naar voren met een rechte rug en neutrale nek.",
        "Ga omlaag tot je romp bijna parallel is of je je hamstrings voelt rekken, met de stang boven het midden van je voet.",
        "Duw je heupen naar voren om rechtop te komen. Het is een heupscharnier, geen squat.",
      ],
    },
  },
};
