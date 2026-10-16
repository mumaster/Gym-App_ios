import {
  ANKLE_Y,
  ARM,
  BASE_ANIMATIONS,
  BODY,
  LEG_PRESS_HIP,
  LEG_PRESS_TILT,
  assemble,
  cos,
  forwardKnees,
  headFrom,
  hipThrustPose,
  label,
  lerp,
  reverseLungePose,
  sin,
  smooth,
  twoBone,
  type ExerciseAnimationSpec,
  type FigurePose,
  type Foot,
  type V3,
} from "./exerciseAnimation";
import { variantSpec } from "./exerciseVariant";

/** Animation batch W14, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

const deg = (r: number) => (r * 180) / Math.PI;
/** Fold an angle in degrees into (-180, 180]. */
const wrap = (a: number) => {
  let r = a % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
};
const KNEES_UP = (s: -1 | 1): V3 => [s * 0.2, 1, 0.3];

/* ------------------------------------------------------------------ */
/* Shared calf-raise foot: ball of the foot on a step                  */
/* ------------------------------------------------------------------ */

/** The ankle rises this far above flat at the top and sinks this far below
 *  flat in the stretch (cm). The top matches the standing calf raise (pitch 40). */
export const CALF_TOP_LIFT = 9.8;
export const CALF_STRETCH = 4.6;
/** The toe tip stays on the step top; the foot is 15 cm ahead of the ankle. */
const TOE_REACH = 15;

/** The ankle height and the foot that goes with it for a calf raise on a step
 *  `step` cm high. `e` runs from 0 (heels as high as they go) to 1 (heels
 *  dropped below the step). Heels up: the sole tips about the toes (`pitch`).
 *  Heels down: the foot pivots about the ankle with the toes up (`angle`,
 *  `drop` 8) so the toe tip stays on the step and the heel hangs below it. */
export function calfFoot(step: number, e: number): { ankleY: number; lift: number; foot: Foot } {
  const lift = lerp(CALF_TOP_LIFT, -CALF_STRETCH, e);
  const ankleY = step + ANKLE_Y + lift;
  if (lift >= 0) return { ankleY, lift, foot: { floor: step, dir: 1, pitch: (45 * lift) / 11 } };
  const angle = deg(Math.asin(-lift / TOE_REACH));
  return { ankleY, lift, foot: { floor: step, dir: 1, angle, drop: ANKLE_Y } };
}

/* ------------------------------------------------------------------ */
/* Lying leg curl                                                      */
/* ------------------------------------------------------------------ */

export const LYING_PAD_TOP = 36;
export const LYING_HIP = { y: 46, z: 0 };
export const LYING_SHOULDER = { y: 46, z: 50 };
/** The thigh lies on the pad, sloping 6 degrees down towards the knee. */
const LYING_THIGH_DOWN = 6;
export const LYING_KNEE: V3 = [
  0,
  LYING_HIP.y - BODY.thigh * sin(LYING_THIGH_DOWN),
  LYING_HIP.z - BODY.thigh * cos(LYING_THIGH_DOWN),
];
/** The pad ends just behind the knee, so the legs hang free past it. */
export const LYING_PAD_END = LYING_KNEE[2] - 2;
/** The pad's head end; the handles hang beside the pad just ahead of the shoulders. */
export const LYING_HANDLE_Z = 88;
export const LYING_GRIP: V3 = [26, 31, 64];
const LYING_KNEE_START = 8;
const LYING_KNEE_END = 100;

/** Direction (degrees, in the z-y plane) from the knee to the ankle. */
export const lyingShinAngle = (depth: number) =>
  180 + LYING_THIGH_DOWN - lerp(LYING_KNEE_START, LYING_KNEE_END, smooth(depth));

/** Lying leg curl: face down on the pad, hips and thighs stay down, the shins
 *  curl up from nearly straight towards the glutes (about 100 degrees of knee
 *  bend). Depth 0 = legs almost straight, 1 = fully curled. */
export function lyingLegCurlPose(depth: number): FigurePose {
  const psi = lyingShinAngle(depth);
  const knee = LYING_KNEE;
  const ankle: V3 = [0, knee[1] + BODY.shin * sin(psi), knee[2] + BODY.shin * cos(psi)];
  const hip = LYING_HIP;
  // The knee lies on the lower side of the hip-ankle line: its pole is that offset.
  const dy = ankle[1] - hip.y;
  const dz = ankle[2] - hip.z;
  const l2 = dy * dy + dz * dz;
  const tt = ((knee[1] - hip.y) * dy + (knee[2] - hip.z) * dz) / l2;
  const pole: V3 = [0, knee[1] - (hip.y + tt * dy), knee[2] - (hip.z + tt * dz)];
  const shoulder = LYING_SHOULDER;
  return assemble({
    hip,
    shoulder,
    head: [0, 48, shoulder.z + 22],
    ankleZ: ankle[2],
    footHalf: 10,
    ankle: (s) => [s * 10, ankle[1], ankle[2]],
    // The foot hangs off the shin, toes a little short of straight down at the start.
    foot: () => ({ floor: Math.max(0, ankle[1] - 2), dir: 1, angle: wrap(psi + 80) }),
    wrist: (s) => [s * LYING_GRIP[0], LYING_GRIP[1], LYING_GRIP[2]],
    bar: [0, LYING_GRIP[1], LYING_GRIP[2]],
    kneePole: () => pole,
    elbowPole: (s) => [s * 0.8, -1, -0.2],
  });
}

/* ------------------------------------------------------------------ */
/* Smith machine standing calf raise                                   */
/* ------------------------------------------------------------------ */

export const SMITH_CALF_STEP = 7;
/** The Smith bar rides on the traps 6 cm behind the shoulder joint. */
export const SMITH_CALF_BAR_Z = -6;

/** Smith machine calf raise: bar on the traps, toes on a step, legs straight,
 *  body upright. The bar only moves up and down its rails. Depth 0 = up on the
 *  toes, 1 = heels dropped below the step. */
export function smithCalfRaisePose(depth: number): FigurePose {
  const { ankleY, foot } = calfFoot(SMITH_CALF_STEP, smooth(depth));
  const hip = { y: ankleY + BODY.thigh + BODY.shin - 0.05, z: 0 };
  const shoulder = { y: hip.y + BODY.torso, z: 0 };
  const bar: V3 = [0, shoulder.y + 4, SMITH_CALF_BAR_Z];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 12,
    ankle: (s) => [s * 12, ankleY, 0],
    foot: () => foot,
    wrist: (s) => [s * 28, bar[1], bar[2]],
    bar,
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, -1, -0.7],
  });
}

/* ------------------------------------------------------------------ */
/* Single-leg calf raise on a step                                     */
/* ------------------------------------------------------------------ */

export const SINGLE_CALF_STEP = 14;
/** The balance upright next to the lifter (the shared `w7-support` shape). */
export const SINGLE_SUPPORT = { x: 36, z: 14, top: 152 };

/** Single-leg calf raise: the near foot on the edge of a step, the other leg
 *  hooked up behind, one hand sliding up an upright for balance only.
 *  Depth 0 = up on the toes, 1 = heel dropped below the step. */
export function singleLegCalfRaisePose(depth: number): FigurePose {
  const { ankleY, foot } = calfFoot(SINGLE_CALF_STEP, smooth(depth));
  const hip = { y: ankleY + BODY.thigh + BODY.shin - 0.05, z: 0 };
  const shoulder = { y: hip.y + BODY.torso, z: 0 };
  // The balance hand rests on the upright, a hand span of arm down from the shoulder.
  const grip: V3 = [SINGLE_SUPPORT.x, shoulder.y - 46, SINGLE_SUPPORT.z];
  const freeFoot: V3 = [-BODY.hipHalf, hip.y - 44, -38];
  // Shin direction (knee to ankle) of the hooked leg, for its hanging foot.
  const pole = (s: -1 | 1): V3 => (s > 0 ? forwardKnees(s) : [0, 0, 1]);
  const probe = assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: BODY.hipHalf,
    ankle: (s) => (s > 0 ? [BODY.hipHalf, ankleY, 0] : freeFoot),
    wrist: () => grip,
    bar: grip,
    kneePole: pole,
    elbowPole: () => [0, -1, 0],
  });
  const k = probe.knees[0];
  const psi = deg(Math.atan2(freeFoot[1] - k[1], freeFoot[2] - k[2]));
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: BODY.hipHalf,
    ankle: (s) => (s > 0 ? [BODY.hipHalf, ankleY, 0] : freeFoot),
    foot: (s) =>
      s > 0 ? foot : { floor: Math.max(0, freeFoot[1] - 2), dir: 1, angle: wrap(psi + 90) },
    wrist: (s) => (s > 0 ? grip : [-22, hip.y + 8, hip.z]),
    bar: grip,
    kneePole: pole,
    elbowPole: (s) => (s > 0 ? [0.4, -1, -0.5] : [-1, 0, -0.2]),
  });
}

/* ------------------------------------------------------------------ */
/* Seated calf raises (machine, dumbbells, Smith bar)                  */
/* ------------------------------------------------------------------ */

export interface SeatedCalfGeometry {
  step: number;
  /** Hip height above the step top. */
  hipAbove: number;
  /** The shin is close to vertical: the ankle sits this far ahead of the hip. */
  ankleZ: number;
}

export const SEATED_MACHINE: SeatedCalfGeometry = { step: 10, hipAbove: 50, ankleZ: 44 };
export const SEATED_DB: SeatedCalfGeometry = { step: 6, hipAbove: 50, ankleZ: 44 };
export const SEATED_SMITH: SeatedCalfGeometry = { step: 6, hipAbove: 50, ankleZ: 44 };
export const SEATED_HIP_Z = -4;
const SEATED_LEAN = 4;

interface SeatedPoseParts {
  hip: { y: number; z: number };
  shoulder: { y: number; z: number };
  ankleY: number;
  foot: Foot;
  knee: V3;
  /** A point `along` (0..1) of the way from hip to knee and `out` cm above the thigh. */
  onThigh: (along: number, out: number) => V3;
}

function seatedParts(g: SeatedCalfGeometry, depth: number): SeatedPoseParts {
  const { ankleY, foot } = calfFoot(g.step, smooth(depth));
  const hip = { y: g.step + g.hipAbove, z: SEATED_HIP_Z };
  const shoulder = {
    y: hip.y + BODY.torso * cos(SEATED_LEAN),
    z: hip.z + BODY.torso * sin(SEATED_LEAN),
  };
  const ankle: V3 = [BODY.hipHalf + 4, ankleY, hip.z + g.ankleZ];
  const knee = twoBone([BODY.hipHalf, hip.y, hip.z], ankle, BODY.thigh, BODY.shin, [0, 1, 0.3]);
  const onThigh = (along: number, out: number): V3 => {
    const dy = knee[1] - hip.y;
    const dz = knee[2] - hip.z;
    const l = Math.hypot(dy, dz);
    return [knee[0], hip.y + dy * along - (dz / l) * -out, hip.z + dz * along + (dy / l) * -out];
  };
  return { hip, shoulder, ankleY, foot, knee, onThigh };
}

function seatedPose(
  g: SeatedCalfGeometry,
  depth: number,
  hands: (parts: SeatedPoseParts, s: -1 | 1) => V3,
  bar: (parts: SeatedPoseParts) => V3,
): FigurePose {
  const parts = seatedParts(g, depth);
  const { hip, shoulder, ankleY, foot } = parts;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, SEATED_LEAN * 0.5),
    ankleZ: hip.z + g.ankleZ,
    footHalf: BODY.hipHalf + 4,
    ankle: (s) => [s * (BODY.hipHalf + 4), ankleY, hip.z + g.ankleZ],
    foot: () => foot,
    wrist: (s) => hands(parts, s),
    bar: bar(parts),
    kneePole: KNEES_UP,
    elbowPole: (s) => [s * 0.5, -0.6, -1],
  });
}

/** Seated calf raise machine: pads on the thighs above the knees, toes on the
 *  platform. The knees rise and sink with the heels while the hips stay on the
 *  seat. Hands rest on the thighs. Depth 0 = heels up, 1 = heels dropped. */
export function seatedCalfMachinePose(depth: number): FigurePose {
  return seatedPose(
    SEATED_MACHINE,
    depth,
    (p, s) => {
      const w = p.onThigh(0.42, 8);
      return [s * 14, w[1], w[2]];
    },
    (p) => p.onThigh(0.42, 8),
  );
}

/** Seated dumbbell calf raise: a dumbbell lies across each thigh near the knee,
 *  held by the hand, toes on a plate. Depth 0 = heels up, 1 = heels dropped. */
export const DB_ALONG = 0.8;
export const DB_OUT = 11;
export function seatedDbCalfRaisePose(depth: number): FigurePose {
  return seatedPose(
    SEATED_DB,
    depth,
    (p, s) => {
      const w = p.onThigh(DB_ALONG, DB_OUT);
      return [s * 15, w[1], w[2]];
    },
    (p) => p.onThigh(DB_ALONG, DB_OUT),
  );
}

/** The Smith bar lies across the thighs at this z (never changes), 30 cm ahead of the hip. */
export const SMITH_SEATED_BAR_Z = SEATED_HIP_Z + 30;

/** Smith machine seated calf raise: bench in the machine, bar across the thighs
 *  above the knees; the bar slides straight up and down the rails while the
 *  knees rise with the heels. Depth 0 = heels up, 1 = heels dropped. */
export function smithSeatedCalfRaisePose(depth: number): FigurePose {
  const parts = seatedParts(SEATED_SMITH, depth);
  // The bar rests on top of the thigh at its fixed z: find the thigh height there.
  const { hip, knee } = parts;
  const t = (SMITH_SEATED_BAR_Z - hip.z) / (knee[2] - hip.z);
  const thighY = hip.y + (knee[1] - hip.y) * t;
  const slope = (knee[1] - hip.y) / (knee[2] - hip.z);
  const barY = thighY + 5 * Math.sqrt(1 + slope * slope) + 1.5;
  const bar: V3 = [0, barY, SMITH_SEATED_BAR_Z];
  return seatedPose(
    SEATED_SMITH,
    depth,
    (_p, s) => [s * 30, barY, SMITH_SEATED_BAR_Z],
    () => bar,
  );
}

/* ------------------------------------------------------------------ */
/* Leg press calf raise                                                */
/* ------------------------------------------------------------------ */

/** Hip to ankle with straight but unlocked legs. */
export const LPC_REACH = 87.8;
export const LPC_TOP_GAMMA = 55; // ankle extended: the toes point along the rails
export const LPC_BOTTOM_GAMMA = 102; // ankle dorsiflexed: heels pulled back
/** Where the platform's lower edge sits, measured up the plate from the ankle (cm). */
export const LPC_PLATE_EDGE = 3;
/** Foot-to-platform contact: the toe tip when the toes point forward, the ball when pulled back. */
export const lpcPlateReach = (gamma: number) => {
  const c = cos(gamma);
  return LPC_REACH + (c > 0 ? 15 * c : 11 * c);
};

/** Leg press calf raise: reclined on the pad with the legs straight, only the
 *  balls of the feet on the lower edge of the platform, heels hanging off. The
 *  knees stay still; the foot rotates about the ankle and the sled moves.
 *  Depth 0 = pushed up onto the toes, 1 = heels pulled back in the stretch. */
export function legPressCalfRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const gamma = lerp(LPC_TOP_GAMMA, LPC_BOTTOM_GAMMA, e);
  const hip = LEG_PRESS_HIP;
  const t = LEG_PRESS_TILT;
  const ankle: V3 = [0, hip.y + LPC_REACH * sin(t), hip.z + LPC_REACH * cos(t)];
  const shoulder = { y: hip.y + BODY.torso * cos(60), z: hip.z - BODY.torso * sin(60) };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, -60),
    ankleZ: ankle[2],
    footHalf: 12,
    ankle: (s) => [s * 12, ankle[1], ankle[2]],
    foot: () => ({ floor: ankle[1] - 2, dir: 1, angle: t + gamma }),
    wrist: (s) => [s * 24, hip.y + 10, hip.z + 6],
    bar: [0, hip.y + 10, hip.z + 6],
    kneePole: (s) => [s * 0.3, cos(t), -sin(t)],
    elbowPole: (s) => [s * 0.5, -1, 0.3],
  });
}

/* ------------------------------------------------------------------ */
/* Hip thrusts with a guided pad or bar (machine, Smith)               */
/* ------------------------------------------------------------------ */

/** The pad or bar travels on vertical rails at this z. */
export const THRUST_GUIDE_Z = -46;
const THRUST_BAR_R = 3;

/** Highest point of a capsule (segment a-b, radius r) at depth z, or -Infinity. */
function capsuleTop(a: V3, b: V3, r: number, z: number): number {
  let best = -Infinity;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const pz = a[2] + (b[2] - a[2]) * t;
    const dz = Math.abs(z - pz);
    if (dz <= r) best = Math.max(best, a[1] + (b[1] - a[1]) * t + Math.sqrt(r * r - dz * dz));
  }
  return best;
}

/** Hip thrust with the load on a vertical guide: the upper back stays on the
 *  bench and the hips rise and fall like the barbell version, but the bar or
 *  pad can only move straight up and down at THRUST_GUIDE_Z, so it rests on the
 *  highest point of the body there (the pelvis at the top, the thighs lower
 *  down). Depth 0 = top, torso level, 1 = hips low. */
export function guidedHipThrustPose(depth: number, grip: number): FigurePose {
  const base = hipThrustPose(depth);
  const hip = base.hips[1];
  const sh = base.shoulders[1];
  const knee = base.knees[1];
  const top = Math.max(
    capsuleTop(hip, sh, 10, THRUST_GUIDE_Z),
    capsuleTop(hip, knee, 5, THRUST_GUIDE_Z),
  );
  const bar: V3 = [0, top + THRUST_BAR_R, THRUST_GUIDE_Z];
  return {
    ...base,
    wrists: [
      [-grip, bar[1], bar[2]],
      [grip, bar[1], bar[2]],
    ],
    elbows: [-1, 1].map((s) =>
      twoBone(base.shoulders[s < 0 ? 0 : 1]!, [s * grip, bar[1], bar[2]], 29, 26, [s, -1, 0]),
    ) as [V3, V3],
    bar,
  };
}
export const machineHipThrustPose = (depth: number) => guidedHipThrustPose(depth, 26);
export const smithHipThrustPose = (depth: number) => guidedHipThrustPose(depth, 32);

/* ------------------------------------------------------------------ */
/* Dumbbell reverse lunge                                              */
/* ------------------------------------------------------------------ */

export const DB_LUNGE_X = 27;

/** Reverse lunge with a dumbbell hanging from each straight arm at the sides
 *  (palms facing the legs); the legs and torso are the bodyweight lunge's. */
export function dbReverseLungePose(depth: number): FigurePose {
  const base = reverseLungePose(depth);
  const sh = base.shoulders[1];
  const dx = DB_LUNGE_X - BODY.shoulderHalf;
  const dz = 2;
  const wy = sh[1] - Math.sqrt((ARM - 0.4) ** 2 - dx * dx - dz * dz);
  const wrists = [-1, 1].map((s) => [s * DB_LUNGE_X, wy, sh[2] + dz]) as [V3, V3];
  const elbows = [0, 1].map((i) =>
    twoBone(base.shoulders[i]!, wrists[i]!, 29, 26, [(i === 0 ? -1 : 1) * 0.3, 0, 1]),
  ) as [V3, V3];
  return { ...base, wrists, elbows, bar: [0, wy, sh[2] + dz] };
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

const STAND_CALF_PHASES = {
  en: {
    lower: "Lower your heels slowly below the step",
    touch: "Heels dropped, calves stretched",
    press: "Rise up onto your toes",
    lockout: "Up on your toes, calves squeezed",
  },
  nl: {
    lower: "Laat je hielen langzaam onder de step zakken",
    touch: "Hielen omlaag, kuiten gerekt",
    press: "Kom omhoog op je tenen",
    lockout: "Op je tenen, kuiten aangespannen",
  },
};

const SEATED_CALF_PHASES = {
  en: {
    lower: "Lower your heels as far as you can",
    touch: "Heels dropped, calves stretched",
    press: "Rise onto the balls of your feet",
    lockout: "As high as you can go, calves squeezed",
  },
  nl: {
    lower: "Laat je hielen zo ver mogelijk zakken",
    touch: "Hielen omlaag, kuiten gerekt",
    press: "Kom omhoog op de bal van je voeten",
    lockout: "Zo hoog mogelijk, kuiten aangespannen",
  },
};

const baseLunge = BASE_ANIMATIONS["reverse-lunge"]!;

export const ANIMATIONS_W14: Record<string, ExerciseAnimationSpec> = {
  "lying-leg-curl": {
    figure: {
      pose: lyingLegCurlPose,
      implement: "none",
      furniture: "w14-lying-curl",
      scale: 1.15,
      centerZ: 2,
    },
    labels: label("Lying leg curl", "Liggende leg curl"),
    phases: {
      en: {
        lower: "Curl your heels up towards your glutes",
        touch: "Heels near your glutes, hamstrings squeezed",
        press: "Lower the roller slowly",
        lockout: "Legs almost straight, hips pressed into the pad",
      },
      nl: {
        lower: "Trek je hielen omhoog naar je billen",
        touch: "Hielen bij je billen, hamstrings aangespannen",
        press: "Laat de roller langzaam zakken",
        lockout: "Benen bijna gestrekt, heupen tegen het kussen gedrukt",
      },
    },
    cues: {
      en: [
        "Lie face down with the pad under your hips and thighs, the roller just above your heels, and hold the handles.",
        "Keep your hips pressed into the pad and curl your heels up towards your glutes.",
        "Squeeze your hamstrings at the top without lifting your hips off the pad.",
        "Lower slowly until your legs are almost straight. Point the toes to bias the hamstrings.",
      ],
      nl: [
        "Ga met je buik naar beneden liggen, het kussen onder je heupen en bovenbenen, de roller net boven je hielen, en pak de handvatten vast.",
        "Houd je heupen tegen het kussen gedrukt en trek je hielen omhoog naar je billen.",
        "Span bovenin je hamstrings aan zonder je heupen van het kussen te tillen.",
        "Laat langzaam zakken tot je benen bijna gestrekt zijn. Wijs je tenen om de hamstrings meer te belasten.",
      ],
    },
  },
  "smith-calf-raise": {
    figure: {
      pose: smithCalfRaisePose,
      implement: "w3-smith-bar",
      furniture: "w14-smith-calf",
      scale: 0.9,
      centerZ: 6,
    },
    labels: label("Smith machine calf raise", "Kuitheffing in de Smith machine"),
    phases: STAND_CALF_PHASES,
    cues: {
      en: [
        "Put the Smith bar on your upper back and stand with the balls of your feet on a step or plate, the bar over your shoulders.",
        "Keep your knees straight, not locked, and your body upright.",
        "Lower your heels as far as you can and pause in the stretch.",
        "Rise as high as you can onto your toes and squeeze your calves. Re-hook the bar when you finish.",
      ],
      nl: [
        "Leg de Smith-stang op je bovenrug en sta met de bal van je voeten op een step of plaat, de stang boven je schouders.",
        "Houd je knieën gestrekt, niet op slot, en je lichaam rechtop.",
        "Laat je hielen zo ver mogelijk zakken en pauzeer in de rek.",
        "Kom zo hoog mogelijk op je tenen en span je kuiten aan. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  "leg-press-calf-raise": {
    figure: {
      pose: legPressCalfRaisePose,
      implement: "none",
      furniture: "w14-lp-calf",
      scale: 1.3,
      centerZ: -2,
    },
    labels: label("Leg press calf raise", "Kuitheffing op de leg press"),
    phases: {
      en: {
        lower: "Let your heels sink back, toes pulled up",
        touch: "Calves stretched, knees still",
        press: "Push the plate away through the balls of your feet",
        lockout: "Up on your toes, calves squeezed",
      },
      nl: {
        lower: "Laat je hielen terugzakken, tenen omhoog",
        touch: "Kuiten gerekt, knieën stil",
        press: "Duw de plaat weg met de bal van je voeten",
        lockout: "Op je tenen, kuiten aangespannen",
      },
    },
    cues: {
      en: [
        "Sit back on the pad and put only the balls of your feet on the lower edge of the platform, heels hanging off.",
        "Straighten your legs without locking your knees and keep them still.",
        "Push the plate away by pointing your toes, as high as you can.",
        "Let your heels come back for a full stretch. Keep the safety handles within reach.",
      ],
      nl: [
        "Zit achterover op het kussen en zet alleen de bal van je voeten op de onderrand van de plaat, je hielen hangen eraf.",
        "Strek je benen zonder je knieën op slot te zetten en houd ze stil.",
        "Duw de plaat weg door je tenen te strekken, zo hoog als je kunt.",
        "Laat je hielen terugkomen voor een volledige rek. Houd de veiligheidshendels binnen bereik.",
      ],
    },
  },
  "seated-calf-machine": {
    figure: {
      pose: seatedCalfMachinePose,
      implement: "none",
      furniture: "w14-seated-calf",
      scale: 1.25,
      centerZ: 26,
    },
    labels: label("Seated calf raise machine", "Zittende kuitheffing machine"),
    phases: SEATED_CALF_PHASES,
    cues: {
      en: [
        "Sit with the pads snug on your thighs just above your knees and the balls of your feet on the platform.",
        "Release the lever and let your heels drop as far as you can.",
        "Pause in the stretch. No bouncing.",
        "Rise as high as you can onto the balls of your feet and squeeze your calves.",
      ],
      nl: [
        "Zit met de kussens strak op je bovenbenen net boven je knieën en de bal van je voeten op het platform.",
        "Haal de hendel los en laat je hielen zo ver mogelijk zakken.",
        "Pauzeer in de rek. Niet veren.",
        "Kom zo hoog mogelijk op de bal van je voeten en span je kuiten aan.",
      ],
    },
  },
  "single-leg-calf-raise": {
    figure: {
      pose: singleLegCalfRaisePose,
      implement: "none",
      furniture: "w14-single-step",
      scale: 0.9,
      centerZ: 12,
    },
    labels: label("Single-leg calf raise", "Kuitheffing op één been"),
    phases: STAND_CALF_PHASES,
    cues: {
      en: [
        "Stand on one foot with the ball of that foot on the edge of a step, the other leg hooked up behind you.",
        "Rest one hand on a wall or rail for balance only. Don't push off it.",
        "Lower your heel below the step until you feel the stretch in your calf.",
        "Rise as high as you can, pause, then lower slowly. No bouncing. Do all reps, then switch legs.",
      ],
      nl: [
        "Sta op één voet met de bal van die voet op de rand van een step, het andere been opgetrokken achter je.",
        "Houd één hand op een muur of leuning, alleen om je evenwicht te houden. Duw er niet vanaf.",
        "Laat je hiel onder de step zakken tot je de rek in je kuit voelt.",
        "Kom zo hoog mogelijk, pauzeer en laat langzaam zakken. Niet veren. Doe alle herhalingen en wissel dan van been.",
      ],
    },
  },
  "seated-db-calf-raise": {
    figure: {
      pose: seatedDbCalfRaisePose,
      implement: "dumbbells",
      furniture: "w14-seated-db",
      scale: 1.25,
      centerZ: 22,
    },
    labels: label("Seated dumbbell calf raise", "Zittende kuitheffing met dumbbells"),
    phases: SEATED_CALF_PHASES,
    cues: {
      en: [
        "Sit on a bench with the balls of your feet on a raised edge, such as a plate or a step.",
        "Rest a dumbbell on each thigh just above the knee and hold it in place.",
        "Lower your heels into a full stretch and pause.",
        "Rise as high as you can and pause at the top. Keep the reps slow and strict.",
      ],
      nl: [
        "Zit op een bank met de bal van je voeten op een verhoogde rand, zoals een plaat of step.",
        "Leg op elk bovenbeen net boven de knie een dumbbell en houd hem vast.",
        "Laat je hielen zakken tot een volledige rek en pauzeer.",
        "Kom zo hoog mogelijk en pauzeer bovenin. Houd de herhalingen langzaam en strak.",
      ],
    },
  },
  "smith-seated-calf-raise": {
    figure: {
      pose: smithSeatedCalfRaisePose,
      implement: "w11-smith-bar-small",
      furniture: "w14-smith-seated",
      scale: 1.2,
      centerZ: 28,
    },
    labels: label("Smith machine seated calf raise", "Zittende kuitheffing in de Smith machine"),
    phases: SEATED_CALF_PHASES,
    cues: {
      en: [
        "Set a bench under the Smith bar and sit with your knees bent 90 degrees and the balls of your feet on a plate.",
        "Pad the bar and rest it across your thighs just above your knees. Twist it off the hooks.",
        "Lower your heels all the way down and pause in the stretch.",
        "Rise as high as you can and squeeze your calves. Re-hook the bar when you finish.",
      ],
      nl: [
        "Zet een bank onder de Smith-stang en zit met je knieën 90 graden gebogen en de bal van je voeten op een plaat.",
        "Bekleed de stang en leg hem over je bovenbenen net boven je knieën. Draai hem van de haken.",
        "Laat je hielen helemaal zakken en pauzeer in de rek.",
        "Kom zo hoog mogelijk en span je kuiten aan. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  "machine-hip-thrust": {
    figure: {
      pose: machineHipThrustPose,
      implement: "w14-thrust-belt",
      furniture: "w14-thrust-machine",
      scale: 1.2,
      centerZ: -48,
    },
    labels: label("Machine hip thrust", "Hip thrust machine"),
    phases: {
      en: {
        lower: "Lower your hips, chin tucked",
        touch: "Hips low, shins vertical",
        press: "Drive through your heels and thrust",
        lockout: "Hips up, torso level, glutes squeezed",
      },
      nl: {
        lower: "Laat je heupen zakken, kin ingetrokken",
        touch: "Heupen laag, onderbenen verticaal",
        press: "Duw door je hielen en duw omhoog",
        lockout: "Heupen omhoog, romp horizontaal, billen aangespannen",
      },
    },
    cues: {
      en: [
        "Sit with your upper back against the pad and the belt over your hips, feet flat and hip-width apart.",
        "Tuck your chin and drive through your heels until your hips are at full extension.",
        "Pause at the top with your shins vertical and your glutes squeezed.",
        "Lower under control and keep your ribs down.",
      ],
      nl: [
        "Zit met je bovenrug tegen het kussen en de band over je heupen, voeten plat op heupbreedte.",
        "Trek je kin in en duw door je hielen tot je heupen volledig gestrekt zijn.",
        "Pauzeer bovenin met verticale onderbenen en aangespannen billen.",
        "Laat gecontroleerd zakken en houd je ribben omlaag.",
      ],
    },
  },
  "smith-hip-thrust": {
    figure: {
      pose: smithHipThrustPose,
      implement: "w3-smith-bar",
      furniture: "w14-smith-thrust",
      scale: 1.1,
      centerZ: -48,
    },
    labels: label("Smith machine hip thrust", "Hip thrust in de Smith machine"),
    phases: {
      en: {
        lower: "Lower your hips, chin tucked",
        touch: "Hips low, shins vertical",
        press: "Drive through your heels and thrust",
        lockout: "Hips up, torso level, 2 seconds of squeeze",
      },
      nl: {
        lower: "Laat je heupen zakken, kin ingetrokken",
        touch: "Heupen laag, onderbenen verticaal",
        press: "Duw door je hielen en duw omhoog",
        lockout: "Heupen omhoog, romp horizontaal, 2 seconden aanspannen",
      },
    },
    cues: {
      en: [
        "Sit with your upper back against a bench in the Smith machine and the padded bar across your hip crease.",
        "Tuck your chin, brace your ribs down and drive through your heels. The bar goes straight up its rails.",
        "At the top your torso is level and your shins vertical. Squeeze for 2 seconds.",
        "Lower under control without letting the bar roll off your hips. Re-hook the bar when you finish.",
      ],
      nl: [
        "Zit met je bovenrug tegen een bank in de Smith machine en de beklede stang op je heupplooi.",
        "Trek je kin in, houd je ribben omlaag en duw door je hielen. De stang gaat recht omhoog langs de rails.",
        "Bovenin is je romp horizontaal en zijn je onderbenen verticaal. Span 2 seconden aan.",
        "Laat gecontroleerd zakken zonder dat de stang van je heupen rolt. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  "db-reverse-lunge": {
    ...variantSpec(baseLunge, "Dumbbell reverse lunge", "Achterwaartse lunge met dumbbells", {
      implement: "dumbbells",
      neutralGrip: true,
      cues: {
        en: [
          "Stand tall with a dumbbell in each hand at your sides, palms facing in, and your core braced.",
          "Take a big step straight back and land on the ball of your back foot. Your front foot never moves.",
          "Drop straight down: front knee over the ankle, shin vertical, torso upright, the dumbbells hanging beside your legs.",
          "Touch your back knee down lightly, no slam.",
          "Push through your front heel to stand and bring the back foot forward.",
        ],
        nl: [
          "Sta rechtop met een dumbbell in elke hand langs je zij, handpalmen naar binnen, en je core aangespannen.",
          "Zet een grote stap recht naar achteren en land op de bal van je achterste voet. Je voorste voet beweegt nooit.",
          "Zak recht omlaag: voorste knie boven de enkel, scheenbeen verticaal, romp rechtop, de dumbbells hangen langs je benen.",
          "Raak je achterste knie licht de grond aan, niet neerploffen.",
          "Duw af met je voorste hiel om te staan en breng de achterste voet naar voren.",
        ],
      },
    }),
    figure: {
      ...baseLunge.figure!,
      pose: dbReverseLungePose,
      implement: "dumbbells",
      neutralGrip: true,
    },
  },
};
