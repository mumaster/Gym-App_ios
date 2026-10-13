import {
  ANKLE_Y,
  BODY,
  assemble,
  cos,
  headFrom,
  label,
  lerp,
  sin,
  smooth,
  twoBone,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W2 (core: crunches, leg raises, twist, nordic curl, back
 *  extension), merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** A straight leg: hip to ankle just inside the reach, so the knee never bulges. */
const STRAIGHT_LEG = BODY.thigh + BODY.shin - 1e-5;

/** Lying on the back: the hips sit 10 cm and the shoulders 12 cm above the floor. */
const LIE_HIP_Y = 10;
const LIE_SHOULDER_Y = 12;

/** Crunch: lying on the back, knees bent with the feet flat, hands at the
 *  temples. Only the shoulder blades curl up (the torso shortens as the upper
 *  spine rounds), the lower back stays on the floor. */
export function crunchPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: LIE_HIP_Y, z: 0 };
  const phi = lerp(2.3, 20, e); // torso angle above the floor
  const torso = lerp(BODY.torso, 45, e);
  const shoulder = {
    y: hip.y + torso * sin(phi),
    z: hip.z - torso * cos(phi),
  };
  const headAngle = phi + lerp(0, 14, e); // chin stays off the chest
  const head: V3 = [0, shoulder.y + 22 * sin(headAngle), shoulder.z - 22 * cos(headAngle)];
  const hand: V3 = [10, head[1] + 1, head[2] + 5];
  return assemble({
    hip,
    shoulder,
    head,
    ankleZ: 56,
    footHalf: 12,
    wrist: (s) => [s * hand[0], hand[1], hand[2]],
    bar: [0, hand[1], hand[2]],
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s, 0.15, -0.3],
  });
}

/** Reverse crunch: lying on the back, arms flat by the sides, knees bent 90
 *  degrees. The hips curl off the floor and the knees come to the chest;
 *  lowering stops with the feet just above the floor. */
export function reverseCrunchPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: LIE_SHOULDER_Y, z: -50 };
  const hipY = LIE_HIP_Y + 12 * e;
  const hip = {
    y: hipY,
    z: shoulder.z + Math.sqrt(BODY.torso ** 2 - (hipY - shoulder.y) ** 2),
  };
  // Thigh angle from the floor (past 90 = knees over the chest); the knee
  // stays bent about 90 degrees, so the shin turns with the thigh.
  const theta = lerp(46, 112, e);
  const psi = theta - 90;
  const knee = {
    y: hip.y + BODY.thigh * sin(theta),
    z: hip.z + BODY.thigh * cos(theta),
  };
  const ankle = {
    y: knee.y + BODY.shin * sin(psi),
    z: knee.z + BODY.shin * cos(psi),
  };
  return assemble({
    hip,
    shoulder,
    head: [0, 12.9, shoulder.z - 22],
    ankleZ: ankle.z,
    footHalf: 10,
    ankle: (s) => [s * 10, ankle.y, ankle.z],
    // A foot in the air hangs off the shin at a fixed angle.
    foot: () => ({ floor: Math.max(0, ankle.y - 2), dir: 1, angle: psi + 45 }),
    wrist: (s) => [s * 26, 4, shoulder.z + 53],
    bar: [0, 4, shoulder.z + 53],
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s * 0.5, 0.3, 0],
  });
}

/** Lying leg raise: hands by the sides, legs straight, from just above the
 *  floor up to vertical; the lower back stays pressed down. */
export function lyingLegRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: LIE_SHOULDER_Y, z: -50 };
  const hip = { y: LIE_HIP_Y, z: 0 };
  const beta = lerp(7, 90, e); // legs above the floor
  const ankle = {
    y: hip.y + STRAIGHT_LEG * sin(beta),
    z: hip.z + STRAIGHT_LEG * cos(beta),
  };
  return assemble({
    hip,
    shoulder,
    head: [0, 12.9, shoulder.z - 22],
    ankleZ: ankle.z,
    footHalf: 10,
    ankle: (s) => [s * 10, ankle.y, ankle.z],
    foot: () => ({ floor: Math.max(0, ankle.y - 2), dir: 1, angle: beta + 45 }),
    wrist: (s) => [s * 26, 4, shoulder.z + 53],
    bar: [0, 4, shoulder.z + 53],
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s * 0.5, 0.3, 0],
  });
}

/** Russian twist: seated, torso leaning back 45 degrees, heels down, hands
 *  clasped in front of the chest. The shoulders and hands rotate about the
 *  torso axis from one side to the other; the hips do not move. */
export const TWIST_LEAN = 45;
export const TWIST_MAX = 40;
export function russianTwistPose(depth: number): FigurePose {
  const theta = lerp(-TWIST_MAX, TWIST_MAX, smooth(depth));
  const hip = { y: 10, z: 0 };
  const up: V3 = [0, cos(TWIST_LEAN), -sin(TWIST_LEAN)]; // hip -> shoulder
  const fwd: V3 = [0, sin(TWIST_LEAN), cos(TWIST_LEAN)]; // out of the chest
  const at = (a: number, b: number, x = 0): V3 => [
    x,
    hip.y + a * up[1] + b * fwd[1],
    hip.z + a * up[2] + b * fwd[2],
  ];
  // The lateral axis and the chest normal after turning by theta.
  const lat: V3 = [cos(theta), -sin(theta) * fwd[1], -sin(theta) * fwd[2]];
  const front: V3 = [sin(theta), cos(theta) * fwd[1], cos(theta) * fwd[2]];
  const centre = at(50, 0);
  const shoulderAt = (s: -1 | 1): V3 => [
    centre[0] + s * 19 * lat[0],
    centre[1] + s * 19 * lat[1],
    centre[2] + s * 19 * lat[2],
  ];
  const chest = at(38, 8);
  const hand: V3 = [chest[0] + 25 * front[0], chest[1] + 25 * front[1], chest[2] + 25 * front[2]];
  const wristAt = (s: -1 | 1): V3 => [
    hand[0] + s * 2 * lat[0],
    hand[1] + s * 2 * lat[1],
    hand[2] + s * 2 * lat[2],
  ];
  const base = assemble({
    hip,
    shoulder: { y: centre[1], z: centre[2] },
    head: headFrom({ y: centre[1], z: centre[2] }, -TWIST_LEAN * 0.8),
    ankleZ: 60,
    footHalf: 10,
    wrist: wristAt,
    bar: hand,
    kneePole: () => [0, 1, 0],
    elbowPole: () => [0, 0, 1],
  });
  const shoulders: [V3, V3] = [shoulderAt(-1), shoulderAt(1)];
  const wrists: [V3, V3] = [wristAt(-1), wristAt(1)];
  const elbows = [-1, 1].map((s, i) =>
    twoBone(shoulders[i]!, wrists[i]!, 29, 26, [s * lat[0], s * lat[1] - 0.7, s * lat[2] + 0.1]),
  ) as [V3, V3];
  return { ...base, shoulders, wrists, elbows };
}

/** The knee pad, shin on the floor, and the roller over the ankles. */
export const NORDIC_PAD_TOP = 4;
export const NORDIC_KNEE_Y = 9.5;
/** Nordic hamstring curl: kneeling with the ankles anchored; the body is one
 *  straight line from the knees to the head and falls forward like a plank
 *  until the hands catch, then pulls itself back up. */
export function nordicCurlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const g = lerp(0, 76, e); // body angle from vertical
  const along = (len: number) => ({
    y: NORDIC_KNEE_Y + len * cos(g),
    z: len * sin(g),
  });
  const hip = along(BODY.thigh);
  const shoulder = along(BODY.thigh + BODY.torso);
  const headPos = along(BODY.thigh + BODY.torso + 22);
  const ankleY = NORDIC_PAD_TOP + ANKLE_Y;
  const ankleZ = -Math.sqrt(BODY.shin ** 2 - (ankleY - NORDIC_KNEE_Y) ** 2);
  // The hands wait at the chest and finish flat on the floor in front.
  const hand = {
    y: shoulder.y + lerp(-8, -28.5, e),
    z: shoulder.z + lerp(22, 26, e),
  };
  const knee: V3 = [0, NORDIC_KNEE_Y, 0];
  return assemble({
    hip,
    shoulder,
    head: [0, headPos.y, headPos.z],
    ankleZ,
    footHalf: 10,
    ankle: (s) => [s * 10, ankleY, ankleZ],
    foot: () => ({ floor: NORDIC_PAD_TOP, dir: -1 }),
    wrist: (s) => [s * 14, hand.y, hand.z],
    bar: [0, hand.y, hand.z],
    kneePole: () => [0, knee[1] - (hip.y + ankleY) / 2, knee[2] - (hip.z + ankleZ) / 2],
    elbowPole: (s) => [s * 0.4, lerp(-1, 0.4, e), lerp(-0.3, -0.6, e)],
  });
}

/** The 45 degree back extension bench: the hip joint sits at BACK_EXT_HIP, the
 *  legs run straight down and back along 45 degrees to the footplate. */
export const BACK_EXT_HIP = { y: 83.4, z: 0 };
export const BACK_EXT_TILT = 45;
/** Back extension on a 45 degree bench: the hips are the hinge. At the top the
 *  body is one straight line at 45 degrees; at the bottom the torso hangs
 *  down in front of the pad (about 90 degrees of hip flexion). */
export function backExtensionPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = BACK_EXT_HIP;
  const phi = lerp(BACK_EXT_TILT, -BACK_EXT_TILT, e); // torso angle above horizontal
  const t = { z: cos(phi), y: sin(phi) }; // along the torso, towards the head
  const fn = { z: sin(phi), y: -cos(phi) }; // out of the chest
  const shoulder = { y: hip.y + BODY.torso * t.y, z: hip.z + BODY.torso * t.z };
  const headPos: V3 = [0, shoulder.y + 22 * t.y, shoulder.z + 22 * t.z];
  const legZ = -STRAIGHT_LEG * cos(BACK_EXT_TILT);
  const legY = hip.y - STRAIGHT_LEG * sin(BACK_EXT_TILT);
  // Arms crossed over the chest: each hand lands on the opposite shoulder.
  const chest = { y: hip.y + 38 * t.y + 9 * fn.y, z: hip.z + 38 * t.z + 9 * fn.z };
  return assemble({
    hip,
    shoulder,
    head: headPos,
    ankleZ: legZ,
    footHalf: 10,
    ankle: (s) => [s * 10, legY, legZ],
    // Toes point out of the body's front, soles flat on the footplate.
    foot: () => ({ floor: legY - 2, dir: 1, angle: -BACK_EXT_TILT }),
    wrist: (s) => [-s * 9, chest.y + s * 2 * t.y, chest.z + s * 2 * t.z],
    bar: [0, chest.y, chest.z],
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s * 0.4, fn.y, fn.z],
  });
}

export const ANIMATIONS_W2: Record<string, ExerciseAnimationSpec> = {
  crunch: {
    figure: {
      pose: crunchPose,
      implement: "none",
      furniture: "none",
      scale: 1.8,
      centerZ: 0,
    },
    labels: label("Crunch", "Crunch"),
    phases: {
      en: {
        lower: "Curl your shoulder blades off the floor",
        touch: "Top of the crunch, lower back still down",
        press: "Lower slowly, shoulders back to the floor",
        lockout: "Flat on your back, hands at your temples",
      },
      nl: {
        lower: "Krul je schouderbladen van de grond",
        touch: "Bovenin de crunch, onderrug blijft plat",
        press: "Zak langzaam, schouders terug naar de grond",
        lockout: "Plat op je rug, handen bij je slapen",
      },
    },
    cues: {
      en: [
        "Lie on your back with your knees bent and your feet flat on the floor.",
        "Put your fingertips at your temples with your elbows out. Don't pull on your head.",
        "Curl up until only your shoulder blades leave the floor. Your lower back stays down.",
        "Breathe out as you come up, then lower slowly instead of dropping.",
      ],
      nl: [
        "Lig op je rug met gebogen knieën en je voeten plat op de grond.",
        "Leg je vingertoppen bij je slapen met je ellebogen naar buiten. Trek niet aan je hoofd.",
        "Krul omhoog tot alleen je schouderbladen loskomen. Je onderrug blijft op de grond.",
        "Adem uit terwijl je omhoog komt en zak daarna langzaam in plaats van te laten vallen.",
      ],
    },
  },
  "reverse-crunch": {
    figure: {
      pose: reverseCrunchPose,
      implement: "none",
      furniture: "none",
      scale: 1.7,
      centerZ: 0,
    },
    labels: label("Reverse crunch", "Reverse crunch"),
    phases: {
      en: {
        lower: "Curl your hips off the floor, knees to your chest",
        touch: "Knees over your chest, shoulders still down",
        press: "Lower your hips slowly",
        lockout: "Feet just above the floor, knees bent 90 degrees",
      },
      nl: {
        lower: "Krul je heupen van de grond, knieën naar je borst",
        touch: "Knieën boven je borst, schouders blijven liggen",
        press: "Laat je heupen langzaam zakken",
        lockout: "Voeten vlak boven de grond, knieën 90 graden gebogen",
      },
    },
    cues: {
      en: [
        "Lie on your back with your arms flat by your sides and your knees bent 90 degrees, thighs up.",
        "Curl your hips off the floor and bring your knees toward your chest.",
        "Keep your shoulders on the floor. Don't swing your legs to get up.",
        "Lower slowly until your feet are just above the floor, then go again.",
      ],
      nl: [
        "Lig op je rug met je armen plat langs je lichaam en je knieën 90 graden gebogen, bovenbenen omhoog.",
        "Krul je heupen van de grond en breng je knieën naar je borst.",
        "Houd je schouders op de grond. Zwaai niet met je benen om omhoog te komen.",
        "Zak langzaam tot je voeten vlak boven de grond zijn en begin dan opnieuw.",
      ],
    },
  },
  "lying-leg-raise": {
    figure: {
      pose: lyingLegRaisePose,
      implement: "none",
      furniture: "none",
      scale: 1.45,
      centerZ: 8,
    },
    labels: label("Lying leg raise", "Lying leg raise"),
    phases: {
      en: {
        lower: "Raise your straight legs toward the ceiling",
        touch: "Legs vertical, lower back pressed down",
        press: "Lower your legs slowly",
        lockout: "Legs just above the floor, lower back down",
      },
      nl: {
        lower: "Til je gestrekte benen naar het plafond",
        touch: "Benen verticaal, onderrug in de grond gedrukt",
        press: "Laat je benen langzaam zakken",
        lockout: "Benen vlak boven de grond, onderrug blijft plat",
      },
    },
    cues: {
      en: [
        "Lie on your back with your hands by your sides, palms down, legs straight.",
        "Raise your legs together until they point straight up.",
        "Press your lower back into the floor and don't let it arch.",
        "Lower slowly, stopping just above the floor.",
      ],
      nl: [
        "Lig op je rug met je handen langs je lichaam, handpalmen naar beneden, benen gestrekt.",
        "Til je benen samen tot ze recht omhoog wijzen.",
        "Druk je onderrug in de grond en laat hem niet holrug worden.",
        "Zak langzaam en stop vlak boven de grond.",
      ],
    },
  },
  "russian-twist": {
    figure: {
      pose: russianTwistPose,
      implement: "none",
      furniture: "none",
      scale: 1.9,
      centerZ: 9,
    },
    labels: label("Russian twist", "Russian twist"),
    phases: {
      en: {
        lower: "Rotate your shoulders and hands to the other side",
        touch: "Turned all the way, hips still",
        press: "Rotate back across the middle",
        lockout: "Turned to the starting side",
      },
      nl: {
        lower: "Draai je schouders en handen naar de andere kant",
        touch: "Helemaal gedraaid, heupen stil",
        press: "Draai terug via het midden",
        lockout: "Gedraaid naar de startkant",
      },
    },
    cues: {
      en: [
        "Sit with your knees bent and your heels on the floor, and lean back until your torso is about 45 degrees.",
        "Keep your back straight and clasp your hands in front of your chest.",
        "Rotate your shoulders and hands from one side to the other. Your hips stay still.",
        "Move from your ribs, not by swinging your arms.",
      ],
      nl: [
        "Ga zitten met gebogen knieën en je hielen op de grond en leun achterover tot je romp ongeveer 45 graden staat.",
        "Houd je rug recht en vouw je handen voor je borst.",
        "Draai je schouders en handen van de ene naar de andere kant. Je heupen blijven stil.",
        "Draai vanuit je ribben, zwaai niet met je armen.",
      ],
    },
  },
  "nordic-curl": {
    figure: {
      pose: nordicCurlPose,
      implement: "none",
      furniture: "w2-nordic-rig",
      scale: 1.3,
      centerZ: 30,
    },
    labels: label("Nordic hamstring curl", "Nordic hamstring curl"),
    phases: {
      en: {
        lower: "Lower forward slowly, body in one straight line",
        touch: "Hands catch you near the floor",
        press: "Pull yourself back up with your hamstrings",
        lockout: "Kneeling tall, ankles anchored",
      },
      nl: {
        lower: "Zak langzaam naar voren, lichaam op één lijn",
        touch: "Je handen vangen je op vlak boven de grond",
        press: "Trek jezelf met je hamstrings terug omhoog",
        lockout: "Rechtop geknield, enkels vast",
      },
    },
    cues: {
      en: [
        "Kneel on a pad with your ankles anchored under a roller or held by a partner.",
        "Keep a straight line from your knees to your head. Don't fold at the hips.",
        "Lower forward as slowly as you can, fighting the fall with your hamstrings.",
        "Catch yourself with your hands, then pull back up and give a little push if you need it.",
      ],
      nl: [
        "Kniel op een mat met je enkels vast onder een roller of vastgehouden door een partner.",
        "Houd een rechte lijn van je knieën tot je hoofd. Vouw niet door in je heupen.",
        "Zak zo langzaam mogelijk naar voren en rem de val af met je hamstrings.",
        "Vang jezelf op met je handen, trek jezelf weer omhoog en duw een beetje mee als dat nodig is.",
      ],
    },
  },
  "back-extension": {
    figure: {
      pose: backExtensionPose,
      implement: "none",
      furniture: "w2-hyper-bench",
      scale: 1.25,
      centerZ: -7,
    },
    labels: label("45 degree back extension", "Rugextensie op 45 graden"),
    phases: {
      en: {
        lower: "Hinge at the hips and lower your torso",
        touch: "Torso hanging down, hips on the pad",
        press: "Rise until you are in one straight line",
        lockout: "Straight line at 45 degrees, no extra arch",
      },
      nl: {
        lower: "Hinge in je heupen en laat je romp zakken",
        touch: "Romp naar beneden, heupen op het kussen",
        press: "Kom omhoog tot je op één rechte lijn zit",
        lockout: "Rechte lijn op 45 graden, niet extra holrug",
      },
    },
    cues: {
      en: [
        "Put your feet on the footplate with your ankles under the pad and the hip pad just below your hip crease.",
        "Cross your arms over your chest and start in a straight line from head to heels.",
        "Hinge at the hips and lower your torso, keeping your back flat.",
        "Rise until your body is straight again. Don't lean back past the straight line.",
      ],
      nl: [
        "Zet je voeten op het voetplateau met je enkels onder het kussen en het heupkussen net onder je heupplooi.",
        "Kruis je armen over je borst en begin op een rechte lijn van hoofd tot hielen.",
        "Hinge in je heupen en laat je romp zakken met een vlakke rug.",
        "Kom omhoog tot je lichaam weer recht is. Ga niet verder achterover dan de rechte lijn.",
      ],
    },
  },
};
