import {
  ANKLE_Y,
  BODY,
  INCLINE_HIP,
  ROW_BENCH_Y,
  assemble,
  cos,
  curlPose,
  forwardKnees,
  headFrom,
  label,
  lerp,
  sin,
  smooth,
  sub,
  twoBone,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W9, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** The elbow pole that keeps the elbow exactly at `elbow` (the IK picks the
 *  point of its circle that lies in the plane of the pole). */
const pin = (shoulder: V3, elbow: V3): V3 => sub(elbow, shoulder);

/** A point `r` from `from` along the (y, z) direction `deg` degrees from straight
 *  down, swinging toward +z (positive) or -z (negative). */
function swing(from: V3, r: number, deg: number, dx = 0): V3 {
  const k = Math.sqrt(1 - (dx / r) ** 2);
  return [from[0] + dx, from[1] - r * k * cos(deg), from[2] + r * k * sin(deg)];
}

/* ------------------------------------------------------------------ */
/* Dumbbell pullover                                                   */
/* ------------------------------------------------------------------ */

/** Cross-bench: only the upper back lies on it (z span, cm). */
export const PULLOVER_BENCH_Z = { from: -10, to: 18 };
const PO_REACH = 53.8; // shoulder -> wrist: a soft, fixed elbow bend
const PO_HALF_GRIP = 5;
/** How far the dumbbell's middle sits behind the wrists (toward the shoulders). */
export const PULLOVER_DB = { back: 2, half: 8 };

/** Dumbbell pullover: across a bench with the upper back on it, hips low,
 *  feet flat. One dumbbell held upright with both hands; the straight-ish
 *  arms swing as one piece from over the chest back past the head. */
export function pulloverPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: ROW_BENCH_Y + 10, z: 0 };
  const hipY = 38;
  const hip = { y: hipY, z: Math.sqrt(BODY.torso ** 2 - (shoulder.y - hipY) ** 2) };
  // Thighs nearly level, shins vertical: knee 13 cm above the hip, over the ankle.
  const kneeY = 51;
  const ankleZ = hip.z + Math.sqrt(BODY.thigh ** 2 - (kneeY - hipY) ** 2);
  const phi = lerp(-4, 105, e); // arm angle from straight up, toward the head
  const dx = BODY.shoulderHalf - PO_HALF_GRIP;
  const r = Math.sqrt(PO_REACH ** 2 - dx ** 2);
  const pose = assemble({
    hip,
    shoulder,
    head: [0, shoulder.y - 1, shoulder.z - 22],
    ankleZ,
    footHalf: 14,
    wrist: (s) => [s * PO_HALF_GRIP, shoulder.y + r * cos(phi), shoulder.z - r * sin(phi)],
    bar: [0, 0, 0],
    kneePole: (s) => [s * 0.2, 1, 0],
    elbowPole: (s) => [s * 0.8, 0, 0.3],
  });
  // The dumbbell: stands on the hands, along the forearms.
  const wm = mid(pose.wrists[0], pose.wrists[1]);
  const em = mid(pose.elbows[0], pose.elbows[1]);
  const a = unit(sub(wm, em));
  const bar: V3 = [
    wm[0] - a[0] * PULLOVER_DB.back,
    wm[1] - a[1] * PULLOVER_DB.back,
    wm[2] - a[2] * PULLOVER_DB.back,
  ];
  return { ...pose, bar };
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* ------------------------------------------------------------------ */
/* Incline dumbbell curl                                               */
/* ------------------------------------------------------------------ */

const ICURL_ELBOW_DX = 3;
const ICURL_ELBOW_FWD = 2;

/** Incline dumbbell curl on the shared 45 degree bench: the arms hang
 *  straight down behind the torso line (a full stretch), the elbows stay put
 *  and only the forearms curl the dumbbells up toward the shoulders. */
export function inclineCurlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = INCLINE_HIP;
  const back = 45;
  const shoulder = {
    y: hip.y + BODY.torso * cos(back),
    z: hip.z - BODY.torso * sin(back),
  };
  const sh: V3 = [BODY.shoulderHalf, shoulder.y, shoulder.z];
  // Elbow fixed a touch in front of the shoulder, the upper arm hanging down.
  const upper = Math.sqrt(29 * 29 - ICURL_ELBOW_DX ** 2 - ICURL_ELBOW_FWD ** 2);
  const elbow = (s: -1 | 1): V3 => [
    s * (BODY.shoulderHalf + ICURL_ELBOW_DX),
    shoulder.y - upper,
    shoulder.z + ICURL_ELBOW_FWD,
  ];
  const theta = lerp(0, 145, e);
  const wrist = (s: -1 | 1): V3 => swing(elbow(s), 26, theta, -s * 1.5 * (1 - e));
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22 * cos(back), shoulder.z - 22 * sin(back)],
    ankleZ: 38,
    footHalf: 18,
    wrist,
    bar: [0, wrist(1)[1], wrist(1)[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => pin([s * sh[0], sh[1], sh[2]], elbow(s)),
  });
}

/* ------------------------------------------------------------------ */
/* Incline dumbbell flye                                               */
/* ------------------------------------------------------------------ */

/** Bench back of the flye, degrees from vertical (a 30 degree bench). */
export const FLYE_BACK = 60;
const FLYE_REACH = 52.5; // shoulder -> wrist: one soft, fixed elbow bend

/** Incline dumbbell flye on a 30 degree bench: the arms swing as one piece
 *  in an arc, from the dumbbells together over the upper chest out to just
 *  below shoulder level, the elbow bend never changing. */
export function inclineFlyePose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = INCLINE_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(FLYE_BACK),
    z: hip.z - BODY.torso * sin(FLYE_BACK),
  };
  const theta = lerp(-9, 98, e); // arm angle from vertical, negative = leaning in
  const dz = lerp(9, -2, e); // hands start ahead of the shoulders, over the upper chest
  const r = Math.sqrt(FLYE_REACH ** 2 - dz ** 2);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22 * cos(FLYE_BACK), shoulder.z - 22 * sin(FLYE_BACK)],
    ankleZ: 36,
    footHalf: 20,
    wrist: (s) => [
      s * (BODY.shoulderHalf + r * sin(theta)),
      shoulder.y + r * cos(theta),
      shoulder.z + dz,
    ],
    bar: [0, shoulder.y + r * cos(theta), shoulder.z + dz],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * cos(theta), -sin(theta), 0.35],
  });
}

/* ------------------------------------------------------------------ */
/* Incline dumbbell row (chest supported, face down)                   */
/* ------------------------------------------------------------------ */

const ROW_BACK = 45;
const ROW_LEG = 86.5; // hip -> ankle: legs nearly straight
const ROW_ANKLE_Y = 17; // heel lifted, toes on the floor

/** Chest-supported incline dumbbell row: lying face down on a 45 degree
 *  bench, toes on the floor, the torso still. The arms start straight down;
 *  the elbows drive back past the torso with the forearms staying vertical. */
export function inclineRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = INCLINE_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(ROW_BACK),
    z: hip.z - BODY.torso * sin(ROW_BACK),
  };
  const sh = (s: -1 | 1): V3 => [s * BODY.shoulderHalf, shoulder.y, shoulder.z];
  const gamma = lerp(2, 60, e); // upper arm from straight down, toward the hips
  const elbow = (s: -1 | 1): V3 => swing(sh(s), 29, gamma, s * 3);
  const psi = lerp(2, 0, e); // forearm stays close to vertical
  const wrist = (s: -1 | 1): V3 => swing(elbow(s), 26, psi, s * 0.5);
  const ankleZ = hip.z + Math.sqrt(ROW_LEG ** 2 - (hip.y - ROW_ANKLE_Y) ** 2);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22 * cos(ROW_BACK), shoulder.z - 22 * sin(ROW_BACK)],
    ankleZ,
    footHalf: 10,
    ankle: (s) => [s * 10, ROW_ANKLE_Y, ankleZ],
    foot: () => ({ floor: 0, dir: 1, pitch: 65 }),
    wrist,
    bar: [0, wrist(1)[1], wrist(1)[2]],
    kneePole: () => [0, 0.5, 1],
    elbowPole: (s) => pin(sh(s), elbow(s)),
  });
}

/* ------------------------------------------------------------------ */
/* Dumbbell triceps kickback                                           */
/* ------------------------------------------------------------------ */

const KICK_LEAN = 62;
const KICK_ANKLE_Z = -6;

/** Standing hinge of the kickback: soft knees, hips back, torso near level. */
function kickHinge() {
  const dz = -26 - KICK_ANKLE_Z;
  const hip = { z: -26, y: ANKLE_Y + Math.sqrt(80 * 80 - dz * dz - 16) };
  const shoulder = {
    y: hip.y + BODY.torso * cos(KICK_LEAN),
    z: hip.z + BODY.torso * sin(KICK_LEAN),
  };
  return { hip, shoulder };
}

/** Upper arm of the working side: parallel to (a touch above) the torso, so
 *  it points back at this angle from straight down. */
export const KICK_UPPER = KICK_LEAN + 4;

/** Dumbbell triceps kickback (right arm working): hinged forward, the upper
 *  arm pinned along the torso, the elbow starts bent about 90 degrees and
 *  the forearm swings back until the arm is one straight line. The free hand
 *  rests on the front thigh. */
export function kickbackPose(depth: number): FigurePose {
  const e = smooth(depth);
  const { hip, shoulder } = kickHinge();
  const base = assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, KICK_LEAN * 0.55),
    ankleZ: KICK_ANKLE_Z,
    footHalf: 14,
    wrist: () => [0, 0, 0],
    bar: [0, 0, 0],
    kneePole: forwardKnees,
    elbowPole: () => [0, 0, 1],
  });
  const rs = base.shoulders[1];
  // Upper arm: back along the torso, elbow just outside the ribs.
  const elbow = swing(rs, 29, -KICK_UPPER, 2);
  const psi = lerp(KICK_UPPER - 92, KICK_UPPER, e); // forearm angle, toward the back
  const wrist = swing(elbow, 26, -psi, 0);
  // Free hand on top of the front thigh, elbow out and a little back.
  const lh = base.hips[0];
  const lk = base.knees[0];
  const lw: V3 = [
    lh[0] + 0.55 * (lk[0] - lh[0]),
    lh[1] + 0.55 * (lk[1] - lh[1]) + 5,
    lh[2] + 0.55 * (lk[2] - lh[2]),
  ];
  const le = twoBone(base.shoulders[0], lw, 29, 26, [-0.9, 0.2, -0.3]);
  return { ...base, elbows: [le, elbow], wrists: [lw, wrist], bar: wrist };
}

/* ------------------------------------------------------------------ */
/* Zottman curl                                                        */
/* ------------------------------------------------------------------ */

/** How far the grip is turned toward neutral (0 = palms up or down, which
 *  look the same from the front and the side; 1 = palms facing). The turn
 *  happens at the top and the bottom of the rep. */
export function zottmanTurn(depth: number): number {
  const ss = (a: number, b: number, x: number) =>
    smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));
  return Math.max(1 - ss(0, 0.2, depth), ss(0.8, 1, depth));
}

/** Zottman curl: an ordinary standing curl (elbows pinned) whose grip turns
 *  through neutral at the top (palms up -> palms down) and at the bottom.
 *  The turn is stored in `bar[0]` for the `w9-zottman` dumbbells. */
export function zottmanPose(depth: number): FigurePose {
  const pose = curlPose(depth, (e) => 21 - 3 * e);
  return { ...pose, bar: [zottmanTurn(depth), pose.bar[1], pose.bar[2]] };
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W9: Record<string, ExerciseAnimationSpec> = {
  "db-pullover": {
    figure: {
      pose: pulloverPose,
      implement: "w9-pullover-db",
      furniture: "w9-cross-bench",
      scale: 1.3,
      centerZ: 18,
    },
    labels: label("Dumbbell pullover", "Dumbbell pullover"),
    phases: {
      en: {
        lower: "Lower the dumbbell in an arc behind your head",
        touch: "Deep stretch in your lats and chest",
        press: "Pull the dumbbell back over your chest",
        lockout: "Dumbbell over your chest, arms softly bent",
      },
      nl: {
        lower: "Laat de dumbbell in een boog achter je hoofd zakken",
        touch: "Diepe rek in je lats en borst",
        press: "Trek de dumbbell terug boven je borst",
        lockout: "Dumbbell boven je borst, armen zacht gebogen",
      },
    },
    cues: {
      en: [
        "Lie across a bench with only your upper back on it, feet flat and hips low.",
        "Hold one dumbbell upright with both hands under the top plate, over your chest.",
        "Lower it in an arc behind your head with a soft, fixed bend in your elbows.",
        "Stop at a deep stretch without arching your lower back, then pull it back over your chest.",
      ],
      nl: [
        "Ga dwars op een bank liggen met alleen je bovenrug erop, voeten plat en heupen laag.",
        "Houd één dumbbell rechtop vast met beide handen onder de bovenste schijf, boven je borst.",
        "Laat hem in een boog achter je hoofd zakken met een zachte, vaste buiging in je ellebogen.",
        "Stop bij een diepe rek zonder je onderrug hol te trekken en haal hem dan terug boven je borst.",
      ],
    },
  },
  "incline-db-curl": {
    figure: {
      pose: inclineCurlPose,
      implement: "dumbbells",
      furniture: "incline-bench",
      scale: 1.3,
      centerZ: -6,
    },
    labels: label("Incline dumbbell curl", "Dumbbell curl op een schuine bank"),
    phases: {
      en: {
        lower: "Curl up, elbows stay back and down",
        touch: "Squeeze your biceps at the top",
        press: "Lower slowly to a full stretch",
        lockout: "Arms hanging straight behind your torso",
      },
      nl: {
        lower: "Curl omhoog, ellebogen blijven naar beneden en achter",
        touch: "Knijp je biceps samen bovenin",
        press: "Laat langzaam zakken tot een volledige rek",
        lockout: "Armen gestrekt omlaag achter je romp",
      },
    },
    cues: {
      en: [
        "Sit back on a 45 degree bench with your head and back on the pad, feet flat.",
        "Let your arms hang straight down behind your torso for a full stretch.",
        "Curl both dumbbells up. Your elbows stay pointing down and don't swing forward.",
        "Squeeze at the top, then lower slowly until your arms are straight again.",
      ],
      nl: [
        "Ga achterover zitten op een bank van 45 graden met je hoofd en rug op het kussen, voeten plat.",
        "Laat je armen recht omlaag hangen achter je romp voor een volledige rek.",
        "Curl beide dumbbells omhoog. Je ellebogen blijven naar beneden wijzen en zwaaien niet naar voren.",
        "Knijp bovenin en laat dan langzaam zakken tot je armen weer gestrekt zijn.",
      ],
    },
  },
  "incline-db-row": {
    figure: {
      pose: inclineRowPose,
      implement: "dumbbells",
      furniture: "w9-prone-bench",
      scale: 1.4,
      centerZ: 14,
      neutralGrip: true,
    },
    labels: label("Incline dumbbell row", "Roeien met dumbbells op een schuine bank"),
    phases: {
      en: {
        lower: "Row the dumbbells up, elbows back past your torso",
        touch: "Squeeze your shoulder blades",
        press: "Lower to straight arms with control",
        lockout: "Arms long, chest on the pad",
      },
      nl: {
        lower: "Roei de dumbbells omhoog, ellebogen langs je romp naar achteren",
        touch: "Knijp je schouderbladen samen",
        press: "Zak gecontroleerd tot gestrekte armen",
        lockout: "Lange armen, borst op het kussen",
      },
    },
    cues: {
      en: [
        "Lie face down on a bench set to about 45 degrees, chest on the pad and toes on the floor.",
        "Let the dumbbells hang beside the bench with straight arms.",
        "Row both dumbbells up, driving your elbows back past your torso.",
        "Keep your chest on the pad. Pause for a second at the top, then lower slowly.",
      ],
      nl: [
        "Ga met je buik naar beneden op een bank van ongeveer 45 graden liggen, borst op het kussen en tenen op de grond.",
        "Laat de dumbbells met gestrekte armen naast de bank hangen.",
        "Roei beide dumbbells omhoog en trek je ellebogen langs je romp naar achteren.",
        "Houd je borst op het kussen. Pauzeer een seconde bovenin en zak dan langzaam.",
      ],
    },
  },
  "incline-db-flye": {
    figure: {
      pose: inclineFlyePose,
      implement: "dumbbells",
      furniture: "w9-incline-30",
      scale: 1.25,
      centerZ: -14,
      neutralGrip: true,
    },
    labels: label("Incline dumbbell flye", "Flye met dumbbells op een schuine bank"),
    phases: {
      en: {
        lower: "Open your arms wide in an arc",
        touch: "Deep stretch across your upper chest",
        press: "Hug the dumbbells back up",
        lockout: "Dumbbells together over your upper chest",
      },
      nl: {
        lower: "Open je armen wijd in een boog",
        touch: "Diepe rek over je bovenborst",
        press: "Omhels de dumbbells weer omhoog",
        lockout: "Dumbbells samen boven je bovenborst",
      },
    },
    cues: {
      en: [
        "Lie back on a 30 degree bench with the dumbbells together over your upper chest, palms facing.",
        "Keep a soft bend in your elbows and don't change it.",
        "Open your arms in a wide arc until your hands are just below shoulder level.",
        "Stretch without dropping. Hug the dumbbells back up along the same arc.",
      ],
      nl: [
        "Ga achterover liggen op een bank van 30 graden met de dumbbells samen boven je bovenborst, handpalmen naar elkaar.",
        "Houd een zachte buiging in je ellebogen en verander die niet.",
        "Open je armen in een wijde boog tot je handen net onder schouderhoogte zijn.",
        "Rek zonder te laten vallen. Omhels de dumbbells weer omhoog langs dezelfde boog.",
      ],
    },
  },
  "db-kickback": {
    figure: {
      pose: kickbackPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.2,
      centerZ: -4,
      oneDumbbell: true,
      neutralGrip: true,
    },
    labels: label("Dumbbell triceps kickback", "Triceps kickback met dumbbell"),
    phases: {
      en: {
        lower: "Straighten your elbow behind you",
        touch: "Squeeze your triceps at full lockout",
        press: "Bend your elbow slowly back to 90 degrees",
        lockout: "Upper arm still, forearm hanging",
      },
      nl: {
        lower: "Strek je elleboog achter je",
        touch: "Span je triceps aan bij volledige strekking",
        press: "Buig je elleboog langzaam terug naar 90 graden",
        lockout: "Bovenarm stil, onderarm hangend",
      },
    },
    cues: {
      en: [
        "Hinge forward from the hips with soft knees, one hand resting on your front thigh.",
        "Pin your upper arm against your side, parallel to the floor, elbow bent about 90 degrees.",
        "Straighten your elbow and swing the dumbbell back until your arm is in one line.",
        "Squeeze for a second. Only your forearm moves, then bend back slowly.",
      ],
      nl: [
        "Buig vanuit je heupen voorover met zachte knieën, één hand op je voorste bovenbeen.",
        "Zet je bovenarm tegen je zij, parallel aan de grond, elleboog ongeveer 90 graden gebogen.",
        "Strek je elleboog en zwaai de dumbbell naar achteren tot je arm in één lijn staat.",
        "Knijp een seconde. Alleen je onderarm beweegt, buig daarna langzaam terug.",
      ],
    },
  },
  "zottman-curl": {
    figure: {
      pose: zottmanPose,
      implement: "w9-zottman",
      furniture: "none",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("Zottman curl", "Zottman curl"),
    phases: {
      en: {
        lower: "Curl up with your palms facing up",
        touch: "Turn your palms to face down",
        press: "Lower slowly with your palms down",
        lockout: "Turn your palms up again at the bottom",
      },
      nl: {
        lower: "Curl omhoog met je handpalmen omhoog",
        touch: "Draai je handpalmen naar beneden",
        press: "Laat langzaam zakken met je handpalmen omlaag",
        lockout: "Draai je handpalmen onderaan weer omhoog",
      },
    },
    cues: {
      en: [
        "Stand tall with a dumbbell in each hand, palms facing forward, elbows by your sides.",
        "Curl both dumbbells up to your shoulders with your palms up.",
        "At the top, rotate your wrists until your palms face the floor.",
        "Lower slowly for about three seconds, then turn your palms up again at the bottom.",
      ],
      nl: [
        "Sta rechtop met een dumbbell in elke hand, handpalmen naar voren, ellebogen langs je zij.",
        "Curl beide dumbbells met je handpalmen omhoog naar je schouders.",
        "Draai bovenin je polsen tot je handpalmen naar de grond wijzen.",
        "Laat ongeveer drie seconden langzaam zakken en draai onderaan je handpalmen weer omhoog.",
      ],
    },
  },
};
