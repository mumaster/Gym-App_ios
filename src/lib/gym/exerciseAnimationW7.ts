import {
  ANKLE_Y,
  ARM,
  BODY,
  ROW_BENCH_Y,
  assemble,
  clamp01,
  cos,
  headFrom,
  label,
  lerp,
  sin,
  smooth,
  twoBone,
  type ExerciseAnimationSpec,
  type Foot,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W7 (dragon flag, bicycle crunch, decline and archer
 *  push-up, superman, sissy squat), merged into EXERCISE_ANIMATIONS by
 *  exerciseAnimations.ts. */

/** A straight leg: hip to ankle just inside the reach, so the knee never bulges. */
const STRAIGHT_LEG = BODY.thigh + BODY.shin - 1e-5;
const LEG = STRAIGHT_LEG;
const ARM_STRAIGHT = ARM - 0.005;
const FLOOR_HAND_Y = 3.2; // wrist height with the palm flat on the floor
const PLANK_ANKLE_Y = 17; // ankle height above what the toes stand on, heel lifted
const deg = (r: number) => (r * 180) / Math.PI;

/* ------------------------------------------------------------------ */
/* Decline push-up                                                     */
/* ------------------------------------------------------------------ */

/** The bench the feet rest on is turned across the body (seen from the side
 *  it is only its 28 cm width), its top at the shared flat-bench height. */
export const DECLINE_BENCH_Y = ROW_BENCH_Y;
export const DECLINE_BENCH_WIDTH = 28;
const DECLINE_GRIP_HALF = 24;
const DECLINE_GRIP_Z = -6;
const DECLINE_BOTTOM_Y = 21;

const DECLINE_ANKLE_Y = DECLINE_BENCH_Y + PLANK_ANKLE_Y;
const DECLINE_TOTAL = BODY.torso + LEG;
const DECLINE_TOP_Y =
  FLOOR_HAND_Y +
  Math.sqrt(ARM_STRAIGHT ** 2 - (BODY.shoulderHalf - DECLINE_GRIP_HALF) ** 2 - DECLINE_GRIP_Z ** 2);

/** Where the feet are: with the shoulders over the hands at the top the body
 *  line is nearly level, so the ankles sit about 138 cm behind the hands. */
export const DECLINE_ANKLE_Z = -Math.sqrt(
  DECLINE_TOTAL ** 2 - (DECLINE_TOP_Y - DECLINE_ANKLE_Y) ** 2,
);

/** Decline push-up: toes on a bench, hands on the floor a little wider than
 *  the shoulders; one straight line from ankle to shoulder that pivots about
 *  the toes, the chest lowering to just above the floor. */
export function declinePushupPose(depth: number): FigurePose {
  const e = smooth(depth);
  const sy = lerp(DECLINE_TOP_Y, DECLINE_BOTTOM_Y, e);
  const theta = Math.asin((sy - DECLINE_ANKLE_Y) / DECLINE_TOTAL);
  const shoulder = { y: sy, z: DECLINE_ANKLE_Z + DECLINE_TOTAL * Math.cos(theta) };
  const hip = {
    y: DECLINE_ANKLE_Y + LEG * Math.sin(theta),
    z: DECLINE_ANKLE_Z + LEG * Math.cos(theta),
  };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 90 - deg(theta) - 6),
    ankleZ: DECLINE_ANKLE_Z,
    footHalf: BODY.hipHalf,
    ankle: (s) => [s * BODY.hipHalf, DECLINE_ANKLE_Y, DECLINE_ANKLE_Z],
    // Genuinely on the toes, standing on the bench top.
    foot: () => ({ floor: DECLINE_BENCH_Y, dir: 1, pitch: 65 }),
    wrist: (s) => [s * DECLINE_GRIP_HALF, FLOOR_HAND_Y, DECLINE_GRIP_Z],
    bar: [0, FLOOR_HAND_Y, DECLINE_GRIP_Z],
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => [s * 0.75, 0.2, -0.65],
  });
}

/* ------------------------------------------------------------------ */
/* Archer push-up                                                      */
/* ------------------------------------------------------------------ */

/** Both hands wide (|x| in cm); the near (right) hand is the working one, the
 *  far (left) arm stays straight and slides its shoulder past its hand. */
export const ARCHER_HANDS = 50;
const ARCHER_SHIFT = 17; // how far the chest travels towards the working hand
const ARCHER_BOTTOM_Y = 20; // working shoulder height at the bottom
const ARCHER_TOP_Y =
  FLOOR_HAND_Y + Math.sqrt(ARM_STRAIGHT ** 2 - (ARCHER_HANDS - BODY.shoulderHalf) ** 2);
const ARCHER_ANKLE_Z = -Math.sqrt((BODY.torso + LEG) ** 2 - (ARCHER_TOP_Y - PLANK_ANKLE_Y) ** 2);

/** Archer push-up: a wide plank. The chest shifts over the working (right)
 *  hand and lowers to it while the other arm stays straight, its hand flat on
 *  the floor. The body stays one rigid line from the toes. */
export function archerPushupPose(depth: number): FigurePose {
  const e = smooth(depth);
  const total = BODY.torso + LEG;
  const cx = ARCHER_SHIFT * e;
  const yr = lerp(ARCHER_TOP_Y, ARCHER_BOTTOM_Y, e);
  const half = BODY.shoulderHalf;
  // The straight arm fixes the far shoulder; the shoulder line rolls to match.
  let rho = 0;
  let sz = 0;
  let yl = yr;
  for (let i = 0; i < 12; i++) {
    const xl = cx - half * Math.cos(rho);
    yl =
      FLOOR_HAND_Y + Math.sqrt(Math.max(0, ARM_STRAIGHT ** 2 - (xl + ARCHER_HANDS) ** 2 - sz * sz));
    rho = Math.asin(Math.max(-1, Math.min(1, (yl - yr) / (2 * half))));
    const sy = (yl + yr) / 2;
    sz = ARCHER_ANKLE_Z + Math.sqrt(Math.max(0, total ** 2 - cx * cx - (sy - PLANK_ANKLE_Y) ** 2));
  }
  const sy = (yl + yr) / 2;
  const centre: V3 = [cx, sy, sz];
  const ankleC: V3 = [0, PLANK_ANKLE_Y, ARCHER_ANKLE_Z];
  const k = LEG / Math.hypot(centre[0] - ankleC[0], centre[1] - ankleC[1], centre[2] - ankleC[2]);
  const hipC: V3 = [
    ankleC[0] + (centre[0] - ankleC[0]) * k,
    ankleC[1] + (centre[1] - ankleC[1]) * k,
    ankleC[2] + (centre[2] - ankleC[2]) * k,
  ];
  const shoulders: [V3, V3] = [
    [cx - half * Math.cos(rho), yl, sz],
    [cx + half * Math.cos(rho), yr, sz],
  ];
  const hips: [V3, V3] = [
    [hipC[0] - BODY.hipHalf, hipC[1], hipC[2]],
    [hipC[0] + BODY.hipHalf, hipC[1], hipC[2]],
  ];
  const ankles: [V3, V3] = [
    [-BODY.hipHalf, PLANK_ANKLE_Y, ARCHER_ANKLE_Z],
    [BODY.hipHalf, PLANK_ANKLE_Y, ARCHER_ANKLE_Z],
  ];
  const wrists: [V3, V3] = [
    [-ARCHER_HANDS, FLOOR_HAND_Y, 0],
    [ARCHER_HANDS, FLOOR_HAND_Y, 0],
  ];
  const elbows: [V3, V3] = [
    twoBone(shoulders[0], wrists[0], 29, 26, [-0.2, 0.3, 1]),
    twoBone(shoulders[1], wrists[1], 29, 26, [0.8, 0.3, -0.55]),
  ];
  const knees: [V3, V3] = [
    twoBone(hips[0], ankles[0], BODY.thigh, BODY.shin, [0, 0, 1]),
    twoBone(hips[1], ankles[1], BODY.thigh, BODY.shin, [0, 0, 1]),
  ];
  const bodyDeg = deg(Math.atan2(sy - PLANK_ANKLE_Y, sz - ARCHER_ANKLE_Z));
  const a = 90 - bodyDeg - 6;
  const head: V3 = [cx + 22 * Math.sin(rho) * 0.6, sy + 22 * cos(a), sz + 22 * sin(a)];
  return {
    shoulders,
    elbows,
    wrists,
    hips,
    knees,
    ankles,
    head,
    bar: wrists[1],
    feet: [
      { floor: 0, dir: 1, pitch: 65 },
      { floor: 0, dir: 1, pitch: 65 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Superman                                                            */
/* ------------------------------------------------------------------ */

/** Superman raise: face down, hips on the floor. Chest, straight arms and
 *  straight legs lift together (reach long rather than high). */
export function supermanPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: 10, z: 0 };
  const shoulderY = lerp(12, 25, e);
  const alpha = Math.asin((shoulderY - hip.y) / BODY.torso) * (180 / Math.PI);
  const shoulder = {
    y: shoulderY,
    z: hip.z - BODY.torso * cos(alpha),
  };
  // Neutral neck: the head follows the chest but looks at the floor.
  const eta = alpha * 0.55;
  const head: V3 = [0, shoulderY + 22 * sin(eta), shoulder.z - 22 * cos(eta)];
  // Arms straight overhead, lying on the floor at first, then reaching forward and a little up.
  const armAngle = lerp(-9.2, 10, e);
  const armLen = ARM_STRAIGHT;
  const wrist: V3 = [
    BODY.shoulderHalf,
    shoulderY + armLen * sin(armAngle),
    shoulder.z - armLen * cos(armAngle),
  ];
  // Legs straight, from resting on the floor to a few degrees up.
  const ankleY = lerp(6, 26, e);
  const beta = Math.asin((ankleY - hip.y) / STRAIGHT_LEG) * (180 / Math.PI);
  const ankleZ = hip.z + STRAIGHT_LEG * cos(beta);
  return assemble({
    hip,
    shoulder,
    head,
    ankleZ,
    footHalf: BODY.hipHalf,
    ankle: (s) => [s * BODY.hipHalf, ankleY, ankleZ],
    // Toes pointed along the leg (laces down), hanging off the shin.
    foot: () => ({ floor: Math.max(0, ankleY - 2), dir: 1, angle: beta - 18 }),
    wrist: (s) => [s * wrist[0], wrist[1], wrist[2]],
    bar: wrist,
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s * 0.3, 1, 0],
  });
}

/* ------------------------------------------------------------------ */
/* Bicycle crunch                                                      */
/* ------------------------------------------------------------------ */

const BC_CURL = 22; // shoulder blades lifted, degrees above the floor
const BC_TORSO = 46; // the spine rounds a little, so the torso is shorter
const BC_TWIST = 30; // rotation of the shoulder line about the spine (degrees)

/** Leg of the bicycle crunch, `q` = 0 extended low, 1 knee drawn in (ankle
 *  position, plus the shin angle for the foot). */
function bicycleLeg(q: number, side: -1 | 1) {
  const theta = lerp(22, 98, q); // thigh above the floor, past 90 = knee over the chest
  const flex = lerp(0.4, 100, q); // knee bend (a hair under straight), the shin ends about level
  const hip: V3 = [side * BODY.hipHalf, 10, 0];
  const knee: V3 = [hip[0], hip[1] + BODY.thigh * sin(theta), hip[2] + BODY.thigh * cos(theta)];
  const shin = theta - flex;
  const ankle: V3 = [hip[0], knee[1] + BODY.shin * sin(shin), knee[2] + BODY.shin * cos(shin)];
  return ankle;
}

/** Bicycle crunch: on the back, hands behind the head, shoulder blades lifted.
 *  The torso rotates from one side to the other, the elbow travels towards the
 *  opposite knee as that knee comes in while the other leg stretches out low.
 *  Depth 0 and 1 are the two ends of the pedalling; the middle passes through
 *  both knees half bent. */
export function bicycleCrunchPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hipY = 10;
  const phi = lerp(-BC_TWIST, BC_TWIST, e); // > 0: near (right) shoulder up, left knee in
  const spine: V3 = [0, sin(BC_CURL), -cos(BC_CURL)]; // hip -> shoulder
  const up: V3 = [0, cos(BC_CURL), sin(BC_CURL)]; // out of the chest
  const centre: V3 = [0, hipY + BC_TORSO * spine[1], BC_TORSO * spine[2]];
  const shoulderAt = (side: -1 | 1): V3 => [
    centre[0] + side * 19 * cos(phi),
    centre[1] + side * 19 * sin(phi) * up[1],
    centre[2] + side * 19 * sin(phi) * up[2],
  ];
  const shoulders: [V3, V3] = [shoulderAt(-1), shoulderAt(1)];
  const hips: [V3, V3] = [
    [-BODY.hipHalf, hipY, 0],
    [BODY.hipHalf, hipY, 0],
  ];
  const headAngle = BC_CURL + 14; // chin stays off the chest
  const head: V3 = [0, centre[1] + 22 * sin(headAngle), centre[2] - 22 * cos(headAngle) + 2];
  // Left knee is in when e = 1, right knee when e = 0.
  const ankles: [V3, V3] = [bicycleLeg(e, -1), bicycleLeg(1 - e, 1)];
  const knees: [V3, V3] = [
    twoBone(hips[0], ankles[0], BODY.thigh, BODY.shin, [0, 1, 0]),
    twoBone(hips[1], ankles[1], BODY.thigh, BODY.shin, [0, 1, 0]),
  ];
  // Hands behind the head, elbows wide; the lifted shoulder's elbow crosses
  // towards the opposite knee.
  const wrists: [V3, V3] = [
    [-12, head[1] + 1, head[2] + 5],
    [12, head[1] + 1, head[2] + 5],
  ];
  // How far each elbow has crossed over: the right one as the right shoulder
  // comes up (late in the sweep), the left one the other way round.
  const crossed = [clamp01((0.75 - e) / 0.75), clamp01((e - 0.25) / 0.75)];
  const cross = (side: -1 | 1) => {
    const w = crossed[side < 0 ? 0 : 1]!;
    return [lerp(side * 1, -side * 0.55, w), lerp(0.25, 0.8, w), lerp(0, 0.8, w)] as V3;
  };
  const elbows: [V3, V3] = [
    twoBone(shoulders[0], wrists[0], 29, 26, cross(-1)),
    twoBone(shoulders[1], wrists[1], 29, 26, cross(1)),
  ];
  // Feet in the air hang off the shin, toes up and back like the leg raise.
  const foot = (i: 0 | 1): Foot => ({
    floor: Math.max(0, ankles[i][1] - 2),
    dir: 1,
    angle: deg(Math.atan2(ankles[i][1] - knees[i][1], ankles[i][2] - knees[i][2])) + 45,
  });
  return {
    shoulders,
    elbows,
    wrists,
    hips,
    knees,
    ankles,
    head,
    bar: [0, wrists[1][1], wrists[1][2]],
    feet: [foot(0), foot(1)],
  };
}

/* ------------------------------------------------------------------ */
/* Dragon flag                                                         */
/* ------------------------------------------------------------------ */

/** Shoulder joint on the shared flat bench (top 45 cm, spans z -42..50): the
 *  upper back is the only thing that touches it. */
export const FLAG_SHOULDER = { y: ROW_BENCH_Y + 10, z: 4 };
export const FLAG_TOP = 90; // body angle above the bench at the top (vertical)
export const FLAG_LOW = 14; // lowest the straight body hovers
const FLAG_GRIP: V3 = [16, ROW_BENCH_Y - 4, -34];

/** Dragon flag: lying on a bench, hands gripping it behind the head. The body
 *  is one rigid straight line that pivots about the shoulders, from vertical
 *  down to a low hover and back; the shoulders stay on the bench. */
export function dragonFlagPose(depth: number): FigurePose {
  const e = smooth(depth);
  const g = lerp(FLAG_TOP, FLAG_LOW, e);
  const dir = { z: cos(g), y: sin(g) };
  const hip = {
    y: FLAG_SHOULDER.y + BODY.torso * dir.y,
    z: FLAG_SHOULDER.z + BODY.torso * dir.z,
  };
  const ankle = {
    y: hip.y + STRAIGHT_LEG * dir.y,
    z: hip.z + STRAIGHT_LEG * dir.z,
  };
  return assemble({
    hip,
    shoulder: FLAG_SHOULDER,
    // Head rests on the bench, in line with the spine.
    head: [0, ROW_BENCH_Y + 10.5, FLAG_SHOULDER.z - 24],
    ankleZ: ankle.z,
    footHalf: BODY.hipHalf,
    ankle: (s) => [s * BODY.hipHalf, ankle.y, ankle.z],
    // Feet hang off the shins, toes up like the leg raise.
    foot: () => ({ floor: Math.max(0, ankle.y - 2), dir: 1, angle: g + 45 }),
    wrist: (s) => [s * FLAG_GRIP[0], FLAG_GRIP[1], FLAG_GRIP[2]],
    bar: FLAG_GRIP,
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => [s * 1, 0.4, -0.2],
  });
}

/* ------------------------------------------------------------------ */
/* Sissy squat                                                         */
/* ------------------------------------------------------------------ */

/** The support: an upright beside the lifter, held with the near hand. */
export const SISSY_SUPPORT = { x: 36, y: 110, z: 14, top: 152 };
const SISSY_SHIN = 58; // degrees the shin leans forward at the bottom
const SISSY_BACK = 48; // degrees the thigh-torso line leans back at the bottom
const SISSY_TOE_Z = 15; // the toes (ball of the foot) stay put

/** Sissy squat: rise onto the toes, then lean back as one stiff line from the
 *  knee to the head while the knees travel forward and down. The hips stay
 *  open (thigh and torso in line), the heels stay up. */
export function sissySquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const rise = smooth(clamp01(e / 0.22)); // up on the toes first
  const lean = clamp01((e - 0.08) / 0.92);
  const pitch = 40 * rise;
  const ankleY = ANKLE_Y + 11 * (pitch / 45);
  const ankleZ = SISSY_TOE_Z - 15 * cos(pitch);
  const delta = 2 + SISSY_SHIN * lean; // shin from vertical
  const epsilon = 1.91 + SISSY_BACK * lean; // thigh from vertical, leaning back
  const knee = {
    y: ankleY + BODY.shin * cos(delta),
    z: ankleZ + BODY.shin * sin(delta),
  };
  const hip = {
    y: knee.y + BODY.thigh * cos(epsilon),
    z: knee.z - BODY.thigh * sin(epsilon),
  };
  const torsoBack = epsilon - 1.91;
  const shoulder = {
    y: hip.y + BODY.torso * cos(torsoBack),
    z: hip.z - BODY.torso * sin(torsoBack),
  };
  const grip: V3 = [SISSY_SUPPORT.x, SISSY_SUPPORT.y, SISSY_SUPPORT.z];
  const free: V3 = [-22, hip.y + 8, hip.z];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, -torsoBack * 0.9),
    ankleZ,
    footHalf: BODY.hipHalf,
    ankle: (s) => [s * BODY.hipHalf, ankleY, ankleZ],
    foot: () => ({ floor: 0, dir: 1, pitch }),
    wrist: (s) => (s > 0 ? grip : free),
    bar: grip,
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => (s > 0 ? [0.4, -1, 0.2] : [-1, 0, -0.3]),
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

const copy = (en: string[], nl: string[]) => ({ en, nl });

export const ANIMATIONS_W7: Record<string, ExerciseAnimationSpec> = {
  "dragon-flag": {
    figure: {
      pose: dragonFlagPose,
      implement: "none",
      furniture: "flat-bench",
      scale: 0.88,
      centerZ: 60,
    },
    labels: label("Dragon flag", "Dragon flag"),
    phases: {
      en: {
        lower: "Lower your body as one stiff line",
        touch: "Hover just above the bench, only your shoulders touch",
        press: "Raise hips and legs back up together",
        lockout: "Body vertical on your shoulders, grip tight",
      },
      nl: {
        lower: "Laat je lichaam zakken als één stijve lijn",
        touch: "Zweef vlak boven de bank, alleen je schouders raken aan",
        press: "Til heupen en benen samen weer omhoog",
        lockout: "Lichaam verticaal op je schouders, stevige greep",
      },
    },
    cues: copy(
      [
        "Lie on a bench and grip it behind your head, with only your shoulders and upper back on the pad.",
        "Lift your legs and hips until your body is one straight vertical line resting on your shoulders.",
        "Lower as one stiff line with your hips open. Don't fold at the hips.",
        "Stop just above the bench, then raise back up. Bend your knees to make it easier.",
      ],
      [
        "Ga op een bank liggen en pak de bank achter je hoofd vast, met alleen je schouders en bovenrug op het kussen.",
        "Til je benen en heupen op tot je lichaam één rechte, verticale lijn is die op je schouders rust.",
        "Zak als één stijve lijn met open heupen. Knik niet in je heupen.",
        "Stop vlak boven de bank en kom weer omhoog. Buig je knieën om het makkelijker te maken.",
      ],
    ),
  },
  "bicycle-crunch": {
    figure: {
      pose: bicycleCrunchPose,
      implement: "none",
      furniture: "none",
      scale: 1.5,
      centerZ: 20,
    },
    labels: label("Bicycle crunch", "Bicycle crunch"),
    phases: {
      en: {
        lower: "Switch sides: stretch one leg out, bring the other knee in",
        touch: "Elbow toward the opposite knee",
        press: "Pedal back to the first side",
        lockout: "Shoulders up, elbow toward the bent knee",
      },
      nl: {
        lower: "Wissel van kant: strek het ene been, haal de andere knie in",
        touch: "Elleboog naar de tegenovergestelde knie",
        press: "Trap terug naar de eerste kant",
        lockout: "Schouders omhoog, elleboog naar de gebogen knie",
      },
    },
    cues: copy(
      [
        "Lie on your back with your hands behind your head and lift your shoulder blades off the floor.",
        "Bring one knee toward your chest while the other leg stretches out low above the floor.",
        "Rotate from your ribs and take the opposite elbow toward the bent knee. Don't pull on your neck.",
        "Switch sides in a slow, controlled pedalling motion and keep your lower back pressed down.",
      ],
      [
        "Ga op je rug liggen met je handen achter je hoofd en til je schouderbladen van de grond.",
        "Breng één knie naar je borst terwijl het andere been laag boven de grond wordt gestrekt.",
        "Draai vanuit je ribben en breng de tegenovergestelde elleboog naar de gebogen knie. Trek niet aan je nek.",
        "Wissel van kant in een langzame, gecontroleerde trapbeweging en houd je onderrug tegen de grond.",
      ],
    ),
  },
  "decline-pushup": {
    figure: {
      pose: declinePushupPose,
      implement: "none",
      furniture: "w7-decline-bench",
      scale: 1.35,
      centerZ: -66,
    },
    labels: label("Decline push-up", "Decline push-up"),
    phases: {
      en: {
        lower: "Lower your chest toward the floor, elbows at about 45 degrees",
        touch: "Chest just above the floor, body in one line",
        press: "Push the floor away",
        lockout: "Arms straight, toes on the bench",
      },
      nl: {
        lower: "Zak met je borst naar de grond, ellebogen op ongeveer 45 graden",
        touch: "Borst vlak boven de grond, lichaam in één lijn",
        press: "Duw de grond weg",
        lockout: "Armen gestrekt, tenen op de bank",
      },
    },
    cues: copy(
      [
        "Put your toes on a bench and your hands on the floor, a little wider than your shoulders.",
        "Squeeze your glutes and keep your ribs down so your body stays in one straight line.",
        "Lower your chest to just above the floor with your elbows at about 45 degrees.",
        "Press the floor away until your arms are straight again.",
      ],
      [
        "Zet je tenen op een bank en je handen op de grond, iets breder dan je schouders.",
        "Span je billen aan en houd je ribben naar beneden zodat je lichaam één rechte lijn blijft.",
        "Zak met je borst tot vlak boven de grond met je ellebogen op ongeveer 45 graden.",
        "Duw de grond weg tot je armen weer gestrekt zijn.",
      ],
    ),
  },
  "archer-pushup": {
    figure: {
      pose: archerPushupPose,
      implement: "none",
      furniture: "none",
      scale: 1.45,
      centerZ: -50,
    },
    labels: label("Archer push-up", "Archer push-up"),
    phases: {
      en: {
        lower: "Shift over one hand and lower toward it",
        touch: "Chest by the working hand, other arm straight",
        press: "Push back up to the middle",
        lockout: "Wide hands, both arms straight",
      },
      nl: {
        lower: "Verplaats je gewicht naar één hand en zak naar die hand",
        touch: "Borst bij de werkende hand, andere arm gestrekt",
        press: "Duw jezelf terug naar het midden",
        lockout: "Brede handen, beide armen gestrekt",
      },
    },
    cues: copy(
      [
        "Start in a wide push-up position with your hands far outside your shoulders and your body in one line.",
        "Shift your weight over one hand and bend that elbow as you lower your chest toward it.",
        "Keep the other arm straight out to the side, lightly loaded for balance.",
        "Push back up to the middle, then switch sides.",
      ],
      [
        "Begin in een brede push-uphouding met je handen ver buiten je schouders en je lichaam in één lijn.",
        "Verplaats je gewicht naar één hand en buig die elleboog terwijl je met je borst naar die hand zakt.",
        "Houd de andere arm gestrekt naar de zijkant, licht belast voor balans.",
        "Duw jezelf terug naar het midden en wissel dan van kant.",
      ],
    ),
  },
  superman: {
    figure: {
      pose: supermanPose,
      implement: "none",
      furniture: "none",
      scale: 1.35,
      centerZ: -2,
    },
    labels: label("Superman raise", "Superman"),
    phases: {
      en: {
        lower: "Lift your arms, chest and legs off the floor",
        touch: "Hold at the top, reaching long",
        press: "Lower under control",
        lockout: "Face down, arms stretched overhead",
      },
      nl: {
        lower: "Til je armen, borst en benen van de grond",
        touch: "Houd vast bovenin en reik ver",
        press: "Laat gecontroleerd zakken",
        lockout: "Op je buik, armen gestrekt boven je hoofd",
      },
    },
    cues: copy(
      [
        "Lie face down with your arms stretched overhead and your legs straight.",
        "Lift your arms, chest and legs off the floor together, reaching long rather than high.",
        "Keep your neck neutral and look at the floor. Squeeze your lower back and glutes.",
        "Pause for about two seconds, then lower under control.",
      ],
      [
        "Ga op je buik liggen met je armen gestrekt boven je hoofd en je benen recht.",
        "Til je armen, borst en benen tegelijk van de grond en reik ver in plaats van hoog.",
        "Houd je nek neutraal en kijk naar de grond. Span je onderrug en billen aan.",
        "Pauzeer ongeveer twee seconden en zak dan gecontroleerd.",
      ],
    ),
  },
  "sissy-squat": {
    figure: {
      pose: sissySquatPose,
      implement: "none",
      furniture: "w7-support",
      scale: 0.98,
      centerZ: -2,
    },
    labels: label("Sissy squat", "Sissy squat"),
    phases: {
      en: {
        lower: "Rise onto your toes and lean back as your knees go forward",
        touch: "Knees far forward, one line from knees to head",
        press: "Pull the knees back and rise",
        lockout: "Standing tall, one hand on the support",
      },
      nl: {
        lower: "Kom op je tenen en leun naar achteren terwijl je knieën naar voren gaan",
        touch: "Knieën ver naar voren, één lijn van knieën tot hoofd",
        press: "Trek je knieën terug en kom omhoog",
        lockout: "Rechtop, één hand op de steun",
      },
    },
    cues: copy(
      [
        "Hold a sturdy support with one hand and stand with your feet about hip-width apart.",
        "Rise onto your toes and lean your whole body back as your knees travel forward and down.",
        "Keep your hips extended so your body is one line from your knees to your head. Don't sit back.",
        "Go only as deep as your knees allow, then return.",
      ],
      [
        "Houd een stevige steun met één hand vast en sta met je voeten ongeveer heupbreed.",
        "Kom op je tenen en leun je hele lichaam naar achteren terwijl je knieën naar voren en omlaag gaan.",
        "Houd je heupen gestrekt zodat je lichaam één lijn is van je knieën tot je hoofd. Zak niet door je heupen.",
        "Ga alleen zo diep als je knieën toelaten en kom dan terug.",
      ],
    ),
  },
};
