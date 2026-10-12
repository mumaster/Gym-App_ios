import type { Language } from "./types";

/**
 * Exercise explainer animations. An exercise is described once, in 3D, by a
 * `PressRig` (body anchors, bar path, limb lengths); `pressPose` turns the
 * rig plus a progress value into joint positions and the views project them,
 * so the front and side drawings can never disagree about the posture.
 *
 * Axes (cm): x = left/right (+ right), y = up from the floor, z = along the
 * body, 0 at the shoulder line and + towards the feet.
 */
export type V3 = [number, number, number];

export interface PressRig {
  /** Half the distance between the shoulder joints. */
  shoulderHalf: number;
  /** Shoulder joint height (blades pinned into the bench). */
  shoulderY: number;
  benchTop: number;
  torsoHalfDepth: number;
  /** Torso length shoulder -> hip, and how far the lower back lifts (the arch). */
  torsoLength: number;
  archLift: number;
  hipHalf: number;
  /** Feet: lateral half-width, ankle height and distance from the shoulder line. */
  footHalf: number;
  ankleY: number;
  ankleZ: number;
  thigh: number;
  shin: number;
  upperArm: number;
  forearm: number;
  /** Half the grip width (wrists stay at this x all rep). */
  gripHalf: number;
  /** Bar centre at lockout and when touching the chest. */
  top: { y: number; z: number };
  bottom: { y: number; z: number };
  /** >1 pushes the sideways travel to the start of the press (the J-curve). */
  jCurve: number;
}

export interface Pose {
  shoulders: [V3, V3];
  elbows: [V3, V3];
  wrists: [V3, V3];
  hips: [V3, V3];
  knees: [V3, V3];
  ankles: [V3, V3];
  bar: V3;
}

export const BENCH_PRESS_RIG: PressRig = {
  shoulderHalf: 19,
  shoulderY: 55,
  benchTop: 45,
  torsoHalfDepth: 10,
  torsoLength: 50,
  archLift: 3.5,
  hipHalf: 10,
  footHalf: 30,
  ankleY: 8,
  ankleZ: 72,
  thigh: 45,
  shin: 43,
  upperArm: 29,
  forearm: 26,
  gripHalf: 40,
  top: { y: 105, z: 3 },
  bottom: { y: 67, z: 15 },
  jCurve: 1.8,
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));

/** Two-bone IK: the middle joint for a root and a target, bending towards
 *  `pole`. A target out of reach straightens the limb. */
export function twoBone(root: V3, target: V3, l1: number, l2: number, pole: V3): V3 {
  const d = sub(target, root);
  const dist = Math.min(len(d), l1 + l2 - 1e-6);
  const dir = norm(d);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = sub(pole, mul(dir, dot(pole, dir)));
  return add(add(root, mul(dir, a)), mul(norm(perp), h));
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Seconds for one rep, and where each phase starts (fractions of the rep). */
export const REP_SECONDS = 5.5;
export const PHASES = [
  { id: "lower", from: 0 },
  { id: "touch", from: 0.4 },
  { id: "press", from: 0.5 },
  { id: "lockout", from: 0.84 },
] as const;
export type PhaseId = (typeof PHASES)[number]["id"];

export function phaseAt(t: number): PhaseId {
  let id: PhaseId = "lower";
  for (const p of PHASES) if (t >= p.from) id = p.id;
  return id;
}

/** 0 = locked out at the top, 1 = bar resting on the chest. Starts at the top. */
export function depthAt(t: number): number {
  if (t < 0.4) return smooth(t / 0.4);
  if (t < 0.5) return 1;
  if (t < 0.84) return 1 - smooth((t - 0.5) / 0.34);
  return 0;
}

export function pressPose(rig: PressRig, depth: number): Pose {
  const sy = rig.shoulderY;
  const barY = rig.top.y + (rig.bottom.y - rig.top.y) * depth;
  const barZ = rig.top.z + (rig.bottom.z - rig.top.z) * Math.pow(depth, rig.jCurve);
  const at = <T>(f: (s: -1 | 1) => T) => [f(-1), f(1)] as [T, T];
  const shoulders = at((s): V3 => [s * rig.shoulderHalf, sy, 0]);
  const wrists = at((s): V3 => [s * rig.gripHalf, barY, barZ]);
  const elbows = at((s) =>
    twoBone(shoulders[s < 0 ? 0 : 1], wrists[s < 0 ? 0 : 1], rig.upperArm, rig.forearm, [
      s * 0.35,
      -1,
      0.25,
    ]),
  );
  const hips = at((s): V3 => [s * rig.hipHalf, sy, rig.torsoLength]);
  const ankles = at((s): V3 => [s * rig.footHalf, rig.ankleY, rig.ankleZ]);
  const knees = at((s) =>
    twoBone(hips[s < 0 ? 0 : 1], ankles[s < 0 ? 0 : 1], rig.thigh, rig.shin, [s * 0.4, 1, 0.5]),
  );
  return { shoulders, elbows, wrists, hips, knees, ankles, bar: [0, barY, barZ] };
}

/** Angle in degrees between the upper arm and the torso line (flare), seen
 *  from above; the cue says 45-75. */
export function elbowFlare(pose: Pose, side: 0 | 1 = 1): number {
  const u = sub(pose.elbows[side], pose.shoulders[side]);
  const h = Math.hypot(u[0], u[2]);
  return h ? (Math.atan2(Math.abs(u[0]), Math.abs(u[2])) * 180) / Math.PI : 0;
}

/* ------------------------------------------------------------------ */
/* Standing and seated lifts: a figure built from joint angles.        */
/* ------------------------------------------------------------------ */

/** What each foot stands on: the height (cm) of the surface under it, and
 *  which way the toes point along z (-1 when kneeling). */
export interface Foot {
  floor: number;
  dir: 1 | -1;
  /** Degrees the toes tip down from flat (a leg held in the air). */
  pitch?: number;
}

export interface FigurePose extends Pose {
  head: V3;
  feet: [Foot, Foot];
}

export type Implement = "barbell" | "dumbbells" | "goblet" | "kettlebell" | "latbar" | "none";
export type Furniture =
  "none" | "upright-bench" | "pulldown" | "incline-bench" | "flat-bench" | "box" | "thrust-bench";

/** One exercise as a function of `depth` (0 = the start/top position the
 *  loop begins in, 1 = the turning point), plus what to draw around it. */
export interface FigureModel {
  pose: (depth: number) => FigurePose;
  implement: Implement;
  furniture: Furniture;
  /** px per cm, and the z (cm) drawn at the middle of the side view. */
  scale: number;
  centerZ: number;
  /** Only the near hand holds a dumbbell (the other one is on the bench). */
  oneDumbbell?: boolean;
}

const BODY = { shoulderHalf: 19, hipHalf: 10, thigh: 45, shin: 43, torso: 50 };
const ARM = 29 + 26;
const ANKLE_Y = 8;
const PLATE_RADIUS = 22.5;

const rad = (deg: number) => (deg * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sin = (deg: number) => Math.sin(rad(deg));
const cos = (deg: number) => Math.cos(rad(deg));

interface Skeleton {
  hip: { y: number; z: number };
  shoulder: { y: number; z: number };
  head: V3;
  ankleZ: number;
  footHalf: number;
  /** Per-foot position for lifts where the feet move or leave the floor. */
  ankle?: (s: -1 | 1) => V3;
  foot?: (s: -1 | 1) => Foot;
  wrist: (s: -1 | 1) => V3;
  bar: V3;
  /** Directions the knees and elbows bend towards. */
  kneePole: (s: -1 | 1) => V3;
  elbowPole: (s: -1 | 1) => V3;
}

function assemble(sk: Skeleton): FigurePose {
  const at = <T>(f: (s: -1 | 1) => T) => [f(-1), f(1)] as [T, T];
  const i = (s: -1 | 1) => (s < 0 ? 0 : 1);
  const shoulders = at((s): V3 => [s * BODY.shoulderHalf, sk.shoulder.y, sk.shoulder.z]);
  const hips = at((s): V3 => [s * BODY.hipHalf, sk.hip.y, sk.hip.z]);
  const ankles = at((s): V3 => (sk.ankle ? sk.ankle(s) : [s * sk.footHalf, ANKLE_Y, sk.ankleZ]));
  const wrists = at(sk.wrist);
  const elbows = at((s) => twoBone(shoulders[i(s)], wrists[i(s)], 29, 26, sk.elbowPole(s)));
  const knees = at((s) => twoBone(hips[i(s)], ankles[i(s)], BODY.thigh, BODY.shin, sk.kneePole(s)));
  const feet = at((s): Foot => sk.foot?.(s) ?? { floor: 0, dir: 1 });
  return { shoulders, elbows, wrists, hips, knees, ankles, head: sk.head, bar: sk.bar, feet };
}

/** Hip position from a shoulder and a torso lean (degrees from vertical,
 *  positive = chest forward). */
const hipFrom = (sh: { y: number; z: number }, lean: number) => ({
  y: sh.y - BODY.torso * cos(lean),
  z: sh.z - BODY.torso * sin(lean),
});

/** The hip: BODY.torso from the shoulder and `reach` from the ankle, on the
 *  side behind the feet. */
function hipAt(
  sh: { y: number; z: number },
  an: { y: number; z: number },
  reach: number,
): { y: number; z: number } {
  const dy = sh.y - an.y;
  const dz = sh.z - an.z;
  const d = Math.hypot(dy, dz);
  const a = (reach * reach - BODY.torso * BODY.torso + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, reach * reach - a * a));
  const my = an.y + (a * dy) / d;
  const mz = an.z + (a * dz) / d;
  return { y: my + (h * dz) / d, z: mz - (h * dy) / d };
}

const headFrom = (sh: { y: number; z: number }, angle: number): V3 => [
  0,
  sh.y + 22 * cos(angle),
  sh.z + 22 * sin(angle),
];

const ANKLE_Z = -6;
const forwardKnees = (s: -1 | 1): V3 => [s * 0.25, 0, 1];
const straightArms = (s: -1 | 1): V3 => [s * 0.3, 0, 1];

/** Conventional deadlift: bar over the mid-foot, back angle held while the
 *  hips and shoulders rise together, then the hips come through. */
export function deadliftPose(depth: number): FigurePose {
  const barY = lerp(90, PLATE_RADIUS, depth);
  const barZ = lerp(7, 3, depth);
  const off = lerp(-6, 4, depth);
  const shoulder = { z: barZ + off, y: barY + Math.sqrt(ARM * ARM - off * off) };
  // The hips sit where the torso (fixed length) meets the leg's reach: the
  // hip-to-ankle distance grows steadily, so the knees extend smoothly and
  // never lock out early or kick forward mid-lift.
  const reach = lerp(BODY.thigh + BODY.shin - 0.1, 63, smooth(depth));
  const hip = hipAt(shoulder, { y: ANKLE_Y, z: 1 }, reach);
  const lean = (Math.atan2(shoulder.z - hip.z, shoulder.y - hip.y) * 180) / Math.PI;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.7),
    ankleZ: 1,
    footHalf: 12,
    wrist: (s) => [s * 22, barY, barZ],
    bar: [0, barY, barZ],
    kneePole: forwardKnees,
    elbowPole: straightArms,
  });
}

/** Romanian deadlift: knees stay softly bent, the hips travel back, the bar
 *  slides down the legs with a flat back. */
export function rdlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hipZ = lerp(-2, -30, e);
  const reach = lerp(87, 82, e);
  const dz = hipZ - ANKLE_Z;
  const dx = 14 - BODY.hipHalf;
  const hip = { z: hipZ, y: ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx) };
  const lean = 62 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // Arms hang from the shoulders, tilting so the bar stays against the legs.
  const tilt = lerp(-11, 14, e);
  const hang = Math.sqrt(ARM * ARM - 3 * 3) - 0.1;
  const wy = shoulder.y - hang * cos(tilt);
  const wz = shoulder.z - hang * sin(tilt);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: ANKLE_Z,
    footHalf: 14,
    wrist: (s) => [s * 22, wy, wz],
    bar: [0, wy, wz],
    kneePole: forwardKnees,
    elbowPole: straightArms,
  });
}

/** Goblet squat: dumbbell at the chest, torso upright, knees forward over
 *  the toes with the heels down, hips below the knees at the bottom. */
export function gobletPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shin = 38 * e;
  const thighAngle = 86 * e;
  const knee = { y: ANKLE_Y + BODY.shin * cos(shin), z: 0 + BODY.shin * sin(shin) };
  const hip = {
    y: knee.y + BODY.thigh * cos(thighAngle),
    z: knee.z - BODY.thigh * sin(thighAngle),
  };
  const lean = 24 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // Chest: a little below the shoulder joint and in front of the torso line.
  const chest = {
    y: shoulder.y - 12 * cos(lean) + 11 * sin(lean),
    z: shoulder.z - 12 * sin(lean) + 11 * cos(lean) + 6,
  };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.3),
    ankleZ: 0,
    footHalf: 17,
    wrist: (s) => [s * 6, chest.y, chest.z],
    bar: [0, chest.y - 4, chest.z + 2],
    kneePole: (s) => [s * 0.5, 0, 1],
    elbowPole: (s) => [s * 0.5, -1, 0.1],
  });
}

const SEAT_HIP_Y = 53;

/** Seated dumbbell shoulder press on an upright bench. */
export function seatedPressPose(depth: number): FigurePose {
  const back = 10;
  const hip = { y: SEAT_HIP_Y, z: 0 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(back),
    z: hip.z - BODY.torso * sin(back),
  };
  // Bottom: upper arm out and a little forward, forearm vertical.
  const ux = 0.85;
  const uy = -0.45;
  const uz = 0.27;
  const bottom = (s: -1 | 1): V3 => [
    s * BODY.shoulderHalf + s * 29 * ux,
    shoulder.y + 29 * uy + 26,
    shoulder.z + 29 * uz,
  ];
  const top = (s: -1 | 1): V3 => [s * 13, shoulder.y + 54.2, shoulder.z + 4];
  const lerp3 = (a: V3, b: V3, t: number): V3 => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 40,
    footHalf: 24,
    wrist: (s) => lerp3(top(s), bottom(s), depth),
    bar: [0, shoulder.y + 54, shoulder.z],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s, -0.2, 0.1],
  });
}

/** Lat pulldown: slight lean back, bar to the upper chest, elbows down and back. */
export function latPulldownPose(depth: number): FigurePose {
  const hip = { y: 50, z: 0 };
  const lean = lerp(12, 18, depth);
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z - BODY.torso * sin(lean),
  };
  const grip = 30;
  const topW: V3 = [grip, shoulder.y + 46, shoulder.z + 22];
  const bottomW: V3 = [grip, shoulder.y - 6, shoulder.z + 24];
  const w = (s: -1 | 1): V3 => [
    s * grip,
    lerp(topW[1], bottomW[1], depth),
    lerp(topW[2], bottomW[2], depth),
  ];
  const mid = w(1);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z + 22 * sin(-lean * 0.4) + 3],
    ankleZ: 42,
    footHalf: 18,
    wrist: w,
    bar: [0, mid[1], mid[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * 0.5, -1, -0.8],
  });
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Standing with the legs straight and the feet a hair outside the hips. */
const STAND_HIP_Y = 95.8;
const STAND_SHOULDER_Y = STAND_HIP_Y + BODY.torso;

/** Barbell back squat: bar on the upper back over the mid-foot, hips back and
 *  down to just below parallel, torso leaning to keep the bar over the foot. */
export function backSquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: lerp(145.9, 78, e), z: lerp(0, 10, e) };
  const hip = hipAt(shoulder, { y: ANKLE_Y, z: 0 }, lerp(87.8, 38, e));
  const lean = (Math.atan2(shoulder.z - hip.z, shoulder.y - hip.y) * 180) / Math.PI;
  // The bar rests on the traps: a little above the shoulder and behind the neck.
  const bar: V3 = [
    0,
    shoulder.y + 3 * cos(lean) + 6 * sin(lean),
    shoulder.z + 3 * sin(lean) - 6 * cos(lean),
  ];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.35),
    ankleZ: 0,
    footHalf: 17,
    wrist: (s) => [s * 27, bar[1], bar[2]],
    bar,
    kneePole: (s) => [s * 0.4, 0, 1],
    elbowPole: (s) => [s * 0.3, -1, -0.7],
  });
}

/** Barbell bent-over row: torso held at about 50 degrees from vertical, soft
 *  knees, the bar travels from hanging arms to the lower ribs. */
export function bentRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const dz = -26 - ANKLE_Z;
  const hip = { z: -26, y: ANKLE_Y + Math.sqrt(80 * 80 - dz * dz - 16) };
  const lean = 52;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const hang: V3 = [22, shoulder.y - Math.sqrt(ARM * ARM - 9) + 0.1, shoulder.z];
  // Contact point: 70% down the torso, on the front of the body.
  const belly: V3 = [
    22,
    shoulder.y - 0.7 * BODY.torso * cos(lean) - 13 * sin(lean),
    shoulder.z - 0.7 * BODY.torso * sin(lean) + 13 * cos(lean),
  ];
  const w = lerp3(hang, belly, e);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: ANKLE_Z,
    footHalf: 14,
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, 0.5, -1],
  });
}

const INCLINE_BACK = 45;
const INCLINE_HIP = { y: 50, z: 0 };

/** Incline dumbbell press on a 45 degree bench. */
export function inclinePressPose(depth: number): FigurePose {
  const hip = INCLINE_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(INCLINE_BACK),
    z: hip.z - BODY.torso * sin(INCLINE_BACK),
  };
  const bottom = (s: -1 | 1): V3 => [
    s * BODY.shoulderHalf + s * 29 * 0.78,
    shoulder.y + 29 * -0.55 + 26,
    shoulder.z + 29 * 0.3,
  ];
  const top = (s: -1 | 1): V3 => [s * 13, shoulder.y + 53.8, shoulder.z + 8];
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22 * cos(INCLINE_BACK), shoulder.z - 22 * sin(INCLINE_BACK)],
    ankleZ: 34,
    footHalf: 24,
    wrist: (s) => lerp3(top(s), bottom(s), depth),
    bar: [0, shoulder.y + 54, shoulder.z],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    // Bend towards where the upper arm hangs: down, out and a touch forward.
    elbowPole: (s) => [s * 0.78, -0.55, 0.3],
  });
}

/** Standing dumbbell curl: elbows pinned at the sides, only the forearms move. */
export function curlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const elbowY = shoulder.y - 28.5;
  const elbowZ = shoulder.z + 5 + 2 * e;
  const theta = 148 * e;
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * (21 - 4 * e), elbowY - 26 * cos(theta), elbowZ + 26 * sin(theta)],
    bar: [0, elbowY - 26 * cos(theta), elbowZ + 26 * sin(theta)],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.2, -1, 0],
  });
}

/** Reverse lunge: the far leg steps back, the hips drop straight down until
 *  the front thigh is level and the back knee hovers over the floor. */
export function reverseLungePose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: lerp(STAND_HIP_Y, 52.5, e), z: lerp(0, -42, e) };
  const lean = 6 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.5),
    ankleZ: 0,
    footHalf: 11,
    ankle: (s) =>
      s < 0 ? [-11, ANKLE_Y + 15 * smooth(clamp01(e / 0.5)), lerp(0, -103, e)] : [11, ANKLE_Y, 0],
    // Hands on the hips.
    wrist: (s) => [s * 22, hip.y + 8, hip.z],
    bar: [0, hip.y + 8, hip.z],
    kneePole: (s) => (s < 0 ? [0, -1, 0.5] : [0, 0, 1]),
    elbowPole: (s) => [s, 0, -0.2],
  });
}

export const BOX_TOP = 36;
/** The box the step-up climbs: its back face (cm). */
export const BOX_Z = { from: 4, to: 50 };

/** Dumbbell step-up: start tall on the box with the other knee up, lower the
 *  free foot back behind the box, then drive up through the box foot. */
export function stepUpPose(depth: number): FigurePose {
  const e = smooth(depth);
  const boxAnkle: V3 = [11, ANKLE_Y + BOX_TOP, 14];
  const hip = { y: lerp(boxAnkle[1] + 87.4, 88, e), z: lerp(14, -8, e) };
  const lean = 15 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // Free foot: first back over the front edge of the box, then down behind it.
  const back = smooth(clamp01(e / 0.6));
  const down = smooth(clamp01((e - 0.35) / 0.65));
  const free: V3 = [-11, lerp(boxAnkle[1] + 22, ANKLE_Y, down), lerp(32, -20, back)];
  const hang = Math.sqrt(ARM * ARM - 22 * 22 + 38) - 0.1;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.5),
    ankleZ: 14,
    footHalf: 11,
    ankle: (s) => (s < 0 ? free : boxAnkle),
    foot: (s) => ({ floor: s < 0 ? 0 : BOX_TOP, dir: 1 }),
    wrist: (s) => [s * 22, shoulder.y - hang, shoulder.z + 3],
    bar: [0, shoulder.y - hang, shoulder.z + 3],
    kneePole: (s) => (s < 0 ? [0, 0.2, 1] : [0, 0, 1]),
    elbowPole: straightArms,
  });
}

/** Dumbbell sumo deadlift: wide stance, the dumbbell held vertically between
 *  the legs, knees out, hips and shoulders rise together. */
export function sumoPose(depth: number): FigurePose {
  const e = smooth(depth);
  const wristY = lerp(90.9, 26, e);
  const wristZ = 4;
  const off = lerp(-4, 6, e);
  const shoulder = {
    y: wristY + Math.sqrt(ARM * ARM - 16 * 16 - off * off) - 0.2,
    z: wristZ + off,
  };
  const lean = 40 * e;
  const hip = hipFrom(shoulder, lean);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: 0,
    footHalf: 28,
    wrist: (s) => [s * 3, wristY, wristZ],
    bar: [0, wristY - 6, wristZ],
    kneePole: (s) => [s * 1, 0, 0.6],
    elbowPole: straightArms,
  });
}

/** One-arm dumbbell row, free hand and knee on the bench. */
export const ROW_BENCH_Y = 45;
export function dbRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 80;
  const hip = { y: 88, z: -10 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const hang: V3 = [20, shoulder.y - Math.sqrt(ARM * ARM - 1), shoulder.z];
  const top: V3 = [21, 82, 17];
  const w = lerp3(hang, top, e);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 62),
    ankleZ: -14,
    footHalf: 14,
    ankle: (s) => (s < 0 ? [-10, ROW_BENCH_Y + 7, -31] : [14, ANKLE_Y, -14]),
    foot: (s) => (s < 0 ? { floor: ROW_BENCH_Y, dir: -1 } : { floor: 0, dir: 1 }),
    wrist: (s) => (s < 0 ? [-17, ROW_BENCH_Y + 1, shoulder.z] : [w[0], w[1], w[2]]),
    bar: [0, w[1], w[2]],
    kneePole: (s) => (s < 0 ? [0, -1, 1] : [0, 0, 1]),
    elbowPole: (s) => (s < 0 ? [-0.3, 0, -1] : [0, 1, -0.7]),
  });
}

/** Lateral raise: arms stay almost straight (a soft elbow) and rise out to the
 *  sides until the hands reach shoulder height. */
export function lateralRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const phi = 6 + 79 * e; // degrees from hanging
  const reach = 54;
  const wrist = (s: -1 | 1): V3 => [
    s * BODY.shoulderHalf + s * reach * sin(phi),
    shoulder.y - reach * cos(phi),
    4 * e,
  ];
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    wrist,
    bar: [0, shoulder.y - reach * cos(phi), 4 * e],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.6, -1, -0.2],
  });
}

/** Kettlebell swing: a hip hinge with soft knees; the bell swings back between
 *  the legs and the hips snap it up to chest height with straight arms. */
export function kettlebellSwingPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hipZ = lerp(-2, -34, e);
  const reach = lerp(87, 77, e);
  const dz = hipZ - ANKLE_Z;
  const dx = 14 - BODY.hipHalf;
  const hip = { z: hipZ, y: ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx) };
  const lean = lerp(0, 58, e);
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const alpha = lerp(75, -35, e); // arm angle from hanging, + is forward
  const hang = Math.sqrt((ARM - 0.3) ** 2 - (BODY.shoulderHalf - 4) ** 2);
  const w: V3 = [0, shoulder.y - hang * cos(alpha), shoulder.z + hang * sin(alpha)];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.5),
    ankleZ: ANKLE_Z,
    footHalf: 14,
    wrist: (s) => [s * 4, w[1], w[2]],
    bar: w,
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, -0.4, 0.2],
  });
}

/** Single-leg Romanian deadlift: the near leg stays planted with a soft knee,
 *  the torso and the free leg tip like a seesaw, dumbbells hang straight down. */
export function singleLegRdlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hipZ = lerp(-2, -10, e);
  const reach = lerp(87, 84, e);
  const dz = hipZ - 0;
  const dx = 11 - BODY.hipHalf;
  const hip = { z: hipZ, y: ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx) };
  const lean = lerp(0, 72, e);
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // The free leg trails a little below the torso line, like a seesaw that is
  // not quite level.
  const legAngle = Math.max(0, lean - 6);
  const free: V3 = [-11, hip.y - 87.95 * cos(legAngle), hip.z - 87.95 * sin(legAngle)];
  const lift = clamp01((free[1] - ANKLE_Y) / 25);
  const wy = shoulder.y - Math.sqrt((ARM - 0.3) ** 2 - 1);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.45),
    ankleZ: 0,
    footHalf: 11,
    ankle: (s) => (s < 0 ? free : [11, ANKLE_Y, 0]),
    foot: (s) => (s < 0 ? { floor: 0, dir: 1, pitch: 75 * smooth(lift) } : { floor: 0, dir: 1 }),
    wrist: (s) => [s * 20, wy, shoulder.z],
    bar: [0, wy, shoulder.z],
    kneePole: (s) => (s < 0 ? [0, 1, 0] : forwardKnees(s)),
    elbowPole: straightArms,
  });
}

/** Glute bridge: lying on the back, heels under the knees; the hips rise until
 *  shoulders, hips and knees make one line. */
export function gluteBridgePose(depth: number): FigurePose {
  const e = smooth(1 - depth); // depth 0 = hips up (start of the loop)
  const shoulder = { y: 12, z: -97 };
  const hipY = lerp(10, 34, e);
  const hip = {
    y: hipY,
    z: shoulder.z + Math.sqrt(BODY.torso * BODY.torso - (hipY - shoulder.y) ** 2),
  };
  return assemble({
    hip,
    shoulder,
    head: [0, 12, shoulder.z - 22],
    ankleZ: 0,
    footHalf: 14,
    wrist: (s) => [s * 28, 4, shoulder.z + 53],
    bar: [0, 4, shoulder.z + 53],
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s * 0.5, 0.3, 0],
  });
}

/** Barbell hip thrust: upper back on a bench, shins vertical and thighs level
 *  at the top, the bar rolling on the hip crease. */
export const THRUST_BENCH_Y = 43;
export const THRUST_BENCH_Z = { from: -118, to: -88 };
export function hipThrustPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: THRUST_BENCH_Y + 8, z: -95 };
  const hipY = lerp(shoulder.y, 18, e);
  const hip = {
    y: hipY,
    z: shoulder.z + Math.sqrt(BODY.torso * BODY.torso - (shoulder.y - hipY) ** 2),
  };
  const bar: V3 = [0, hip.y + 7, hip.z + 2];
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 4, shoulder.z - 20],
    ankleZ: 0,
    footHalf: 14,
    wrist: (s) => [s * 28, bar[1], bar[2]],
    bar,
    kneePole: () => [0, 1, 0],
    elbowPole: (s) => [s, -1, 0],
  });
}

export type PhaseLabels = Record<PhaseId, string>;

export interface ExerciseAnimationSpec {
  /** Bench-press style rig, or a figure model for the other lifts. */
  rig?: PressRig;
  figure?: FigureModel;
  cues: Record<Language, string[]>;
  /** Captions per phase and the drawings' accessible names; the bench press
   *  uses the shared strings in i18n. */
  phases?: Record<Language, PhaseLabels>;
  labels?: Record<Language, { front: string; side: string }>;
}

const label = (en: string, nl: string) => ({
  en: { front: `${en} seen from the front`, side: `${en} seen from the side` },
  nl: { front: `${nl}, gezien van voren`, side: `${nl}, gezien van de zijkant` },
});

/** Add an exercise by id (the id in the exercise catalog). */
export const EXERCISE_ANIMATIONS: Record<string, ExerciseAnimationSpec> = {
  "bb-bench": {
    rig: BENCH_PRESS_RIG,
    cues: {
      en: [
        "Feet flat and planted, shoulder blades pulled back and down and pinned to the bench.",
        "Keep a slight natural arch in your lower back, glutes on the bench.",
        "Wrists stacked over your elbows, forearms vertical at the bottom.",
        "Elbows about 45 to 75 degrees from your torso, not flared out wide.",
        "Touch the lower chest, then press up and slightly back over your shoulders to full lockout.",
      ],
      nl: [
        "Voeten plat en stevig op de grond, schouderbladen naar achter en omlaag en vastgezet op de bank.",
        "Houd een lichte, natuurlijke holling in je onderrug, billen op de bank.",
        "Polsen boven je ellebogen, onderarmen verticaal onderin.",
        "Ellebogen ongeveer 45 tot 75 graden van je romp, niet wijd uit elkaar.",
        "Raak de onderkant van je borst aan, duw omhoog en iets naar achteren boven je schouders tot volledig gestrekt.",
      ],
    },
  },

  "bb-deadlift": {
    figure: {
      pose: deadliftPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: -12,
    },
    labels: label("Barbell deadlift", "Deadlift met halterstang"),
    phases: {
      en: {
        lower: "Hinge down, bar close to the legs",
        touch: "Bar at the floor, flat back",
        press: "Push the floor away, hips and shoulders rise together",
        lockout: "Stand tall and lock out",
      },
      nl: {
        lower: "Zak met rechte rug, stang dicht langs je benen",
        touch: "Stang bij de grond, rechte rug",
        press: "Duw de vloer weg, heupen en schouders komen samen omhoog",
        lockout: "Sta rechtop en strek volledig",
      },
    },
    cues: {
      en: [
        "Bar over the mid-foot, feet hip-width apart, shins close to the bar.",
        "Neutral spine from head to hips, chest up, shoulders just in front of the bar.",
        "Brace your core, pull the slack out of the bar, then push the floor away.",
        "Hips and shoulders rise together, the bar drags up your legs.",
        "Finish tall with hips and knees locked out and glutes squeezed, without leaning back.",
      ],
      nl: [
        "Stang boven het midden van je voet, voeten heupbreed, scheenbenen dicht bij de stang.",
        "Neutrale rug van hoofd tot heupen, borst omhoog, schouders net voor de stang.",
        "Span je core aan, haal de speling uit de stang en duw dan de vloer weg.",
        "Heupen en schouders komen samen omhoog, de stang schuift langs je benen.",
        "Eindig rechtop met heupen en knieën gestrekt en billen aangespannen, zonder achterover te leunen.",
      ],
    },
  },
  rdl: {
    figure: { pose: rdlPose, implement: "barbell", furniture: "none", scale: 1.05, centerZ: -4 },
    labels: label("Barbell Romanian deadlift", "Roemeense deadlift met halterstang"),
    phases: {
      en: {
        lower: "Hips back, soft knees, bar along the legs",
        touch: "Stretch in the hamstrings, back flat",
        press: "Drive the hips forward",
        lockout: "Stand tall, squeeze the glutes",
      },
      nl: {
        lower: "Heupen naar achteren, zachte knieën, stang langs je benen",
        touch: "Rek in de hamstrings, rug recht",
        press: "Duw de heupen naar voren",
        lockout: "Sta rechtop, span de billen aan",
      },
    },
    cues: {
      en: [
        "Soft knees: a slight bend that stays the same all rep.",
        "Push your hips back as if closing a car door with your butt, don't squat down.",
        "Keep the bar close to your legs, brushing your thighs and shins.",
        "Flat back and neutral neck throughout. Stop when your hamstrings are stretched, around knee height.",
        "Drive your hips forward to stand tall and squeeze your glutes.",
      ],
      nl: [
        "Zachte knieën: een lichte buiging die de hele herhaling gelijk blijft.",
        "Duw je heupen naar achteren, alsof je met je billen een autodeur dichtduwt. Zak niet door je knieën.",
        "Houd de stang dicht langs je benen, langs je bovenbenen en scheenbenen.",
        "Rechte rug en neutrale nek de hele herhaling. Stop als je hamstrings gestrekt zijn, rond kniehoogte.",
        "Duw je heupen naar voren om rechtop te komen en span je billen aan.",
      ],
    },
  },
  "goblet-squat": {
    figure: {
      pose: gobletPose,
      implement: "goblet",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Goblet squat", "Goblet squat"),
    phases: {
      en: {
        lower: "Sit down between your knees",
        touch: "Full depth, chest tall",
        press: "Drive up through your feet",
        lockout: "Stand tall",
      },
      nl: {
        lower: "Zak tussen je knieën",
        touch: "Volle diepte, borst hoog",
        press: "Duw omhoog door je voeten",
        lockout: "Sta rechtop",
      },
    },
    cues: {
      en: [
        "Hold the dumbbell vertically against your chest, elbows pointing down.",
        "Feet a little wider than your shoulders, toes turned out slightly.",
        "Sit down between your legs, knees tracking over your toes and heels flat.",
        "Keep your torso upright and chest tall. Go to at least parallel, hips at or below your knees.",
        "Drive up through your whole foot to a full stand.",
      ],
      nl: [
        "Houd de dumbbell verticaal tegen je borst, ellebogen wijzen omlaag.",
        "Voeten iets breder dan je schouders, tenen een beetje naar buiten.",
        "Zak tussen je benen door, knieën in lijn met je tenen en hielen plat.",
        "Houd je romp rechtop en je borst hoog. Ga minstens tot parallel, heupen op of onder kniehoogte.",
        "Duw omhoog door je hele voet tot je volledig staat.",
      ],
    },
  },
  "db-shoulder-press": {
    figure: {
      pose: seatedPressPose,
      implement: "dumbbells",
      furniture: "upright-bench",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("Seated dumbbell shoulder press", "Zittend schouderdrukken met dumbbells"),
    phases: {
      en: {
        lower: "Lower to shoulder height",
        touch: "Wrists over elbows, forearms vertical",
        press: "Press up and slightly in",
        lockout: "Lock out overhead",
      },
      nl: {
        lower: "Zak naar schouderhoogte",
        touch: "Polsen boven ellebogen, onderarmen verticaal",
        press: "Duw omhoog en iets naar binnen",
        lockout: "Strek boven je hoofd",
      },
    },
    cues: {
      en: [
        "Back flat against the pad, feet planted and core braced. Don't arch off the bench.",
        "Start with the dumbbells at shoulder height, elbows just in front of your torso.",
        "Wrists stacked over your elbows, forearms vertical.",
        "Press up and slightly inward until your arms are fully locked out overhead.",
        "Lower under control back to shoulder height.",
      ],
      nl: [
        "Rug plat tegen het kussen, voeten stevig en core aangespannen. Geen holle rug van de bank.",
        "Begin met de dumbbells op schouderhoogte, ellebogen net voor je romp.",
        "Polsen boven je ellebogen, onderarmen verticaal.",
        "Duw omhoog en iets naar binnen tot je armen volledig gestrekt zijn boven je hoofd.",
        "Zak gecontroleerd terug naar schouderhoogte.",
      ],
    },
  },
  "lat-pulldown": {
    figure: {
      pose: latPulldownPose,
      implement: "latbar",
      furniture: "pulldown",
      scale: 1.05,
      centerZ: 12,
    },
    labels: label("Lat pulldown", "Lat pulldown"),
    phases: {
      en: {
        lower: "Pull your elbows down and back",
        touch: "Bar at the upper chest, squeeze",
        press: "Return slowly under control",
        lockout: "Arms long, lats stretched",
      },
      nl: {
        lower: "Trek je ellebogen omlaag en naar achteren",
        touch: "Stang bij je bovenborst, knijp samen",
        press: "Laat gecontroleerd terug gaan",
        lockout: "Lange armen, lats gerekt",
      },
    },
    cues: {
      en: [
        "Thighs locked under the pad. Sit tall with a slight lean back, about 15 degrees.",
        "Grip a little wider than your shoulders. Start with long arms and your shoulders drawn down.",
        "Lead with your elbows: pull them down and back, not with your hands.",
        "Pull the bar to your upper chest and squeeze your lats, without swinging.",
        "Let the bar rise slowly under control until your arms are straight again.",
      ],
      nl: [
        "Bovenbenen vast onder het kussen. Zit rechtop met een lichte lean naar achteren, ongeveer 15 graden.",
        "Grip iets breder dan je schouders. Begin met lange armen en je schouders omlaag.",
        "Leid met je ellebogen: trek ze omlaag en naar achteren, niet met je handen.",
        "Trek de stang naar je bovenborst en span je lats aan, zonder te zwaaien.",
        "Laat de stang langzaam gecontroleerd omhoog gaan tot je armen weer gestrekt zijn.",
      ],
    },
  },
  "bb-squat": {
    figure: {
      pose: backSquatPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Barbell back squat", "Back squat met halterstang"),
    phases: {
      en: {
        lower: "Sit down and back, chest up",
        touch: "Just below parallel, knees over the toes",
        press: "Drive up through the mid-foot",
        lockout: "Stand tall, glutes tight",
      },
      nl: {
        lower: "Zak naar achteren en omlaag, borst omhoog",
        touch: "Net onder parallel, knieën boven de tenen",
        press: "Duw omhoog door het midden van je voet",
        lockout: "Sta rechtop, billen aangespannen",
      },
    },
    cues: {
      en: [
        "Bar on your upper back, not on your neck. Hands just outside your shoulders, elbows down and back.",
        "Feet shoulder-width apart, toes turned out slightly. Brace your core before you descend.",
        "Sit down and back at the same time. Knees track over your toes, heels stay flat.",
        "Keep your chest up and the bar over the middle of your foot. Go to parallel or just below.",
        "Drive up through your whole foot, hips and shoulders rising together.",
      ],
      nl: [
        "Stang op je bovenrug, niet op je nek. Handen net buiten je schouders, ellebogen omlaag en naar achteren.",
        "Voeten op schouderbreedte, tenen een beetje naar buiten. Span je core aan voordat je zakt.",
        "Zak tegelijk naar achteren en omlaag. Knieën volgen je tenen, hielen blijven plat.",
        "Houd je borst hoog en de stang boven het midden van je voet. Ga tot parallel of net eronder.",
        "Duw omhoog door je hele voet, heupen en schouders komen samen omhoog.",
      ],
    },
  },
  "bb-row": {
    figure: {
      pose: bentRowPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Barbell bent-over row", "Gebogen roeien met halterstang"),
    phases: {
      en: {
        lower: "Row the bar to your lower ribs",
        touch: "Squeeze your shoulder blades together",
        press: "Lower the bar under control",
        lockout: "Arms long, back flat",
      },
      nl: {
        lower: "Roei de stang naar je onderste ribben",
        touch: "Knijp je schouderbladen samen",
        press: "Laat de stang gecontroleerd zakken",
        lockout: "Lange armen, rug recht",
      },
    },
    cues: {
      en: [
        "Hinge at the hips with soft knees until your torso is about 45 degrees above horizontal.",
        "Flat back and neutral neck. Brace your core and keep this angle all rep.",
        "Start with straight arms and the bar hanging below your shoulders.",
        "Pull your elbows back and up, bringing the bar to your lower ribs or belly button.",
        "Pause and squeeze, then lower slowly without letting your torso swing.",
      ],
      nl: [
        "Buig vanuit je heupen met zachte knieën tot je romp ongeveer 45 graden boven horizontaal is.",
        "Rechte rug en neutrale nek. Span je core aan en houd deze hoek de hele herhaling vast.",
        "Begin met gestrekte armen en de stang hangend onder je schouders.",
        "Trek je ellebogen naar achteren en omhoog, de stang gaat naar je onderste ribben of navel.",
        "Pauzeer en knijp, laat dan langzaam zakken zonder met je romp te zwaaien.",
      ],
    },
  },
  "incline-db-press": {
    figure: {
      pose: inclinePressPose,
      implement: "dumbbells",
      furniture: "incline-bench",
      scale: 1.05,
      centerZ: -8,
    },
    labels: label("Incline dumbbell press", "Schuine bank dumbbell press"),
    phases: {
      en: {
        lower: "Lower the dumbbells to your upper chest",
        touch: "Wrists over elbows, a deep stretch",
        press: "Press up and slightly in",
        lockout: "Lock out over your upper chest",
      },
      nl: {
        lower: "Zak met de dumbbells naar je bovenborst",
        touch: "Polsen boven ellebogen, diepe rek",
        press: "Duw omhoog en iets naar binnen",
        lockout: "Strek boven je bovenborst",
      },
    },
    cues: {
      en: [
        "Set the bench to about 30 to 45 degrees. Back and head flat on the pad, feet planted.",
        "Pull your shoulder blades back and down and keep them there.",
        "Wrists stacked over your elbows, forearms vertical at the bottom.",
        "Elbows about 45 to 60 degrees from your torso, not flared wide.",
        "Press up and slightly together over your upper chest, then lower under control.",
      ],
      nl: [
        "Zet de bank op ongeveer 30 tot 45 graden. Rug en hoofd plat op het kussen, voeten stevig neer.",
        "Trek je schouderbladen naar achteren en omlaag en houd ze daar.",
        "Polsen boven je ellebogen, onderarmen verticaal onderin.",
        "Ellebogen ongeveer 45 tot 60 graden van je romp, niet wijd uit elkaar.",
        "Duw omhoog en iets naar elkaar toe boven je bovenborst, laat dan gecontroleerd zakken.",
      ],
    },
  },
  "db-curl": {
    figure: {
      pose: curlPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("Dumbbell curl", "Dumbbell curl"),
    phases: {
      en: {
        lower: "Curl up, elbows pinned to your sides",
        touch: "Squeeze at the top",
        press: "Lower slowly under control",
        lockout: "Arms straight, biceps stretched",
      },
      nl: {
        lower: "Curl omhoog, ellebogen tegen je zij",
        touch: "Knijp bovenin",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Armen gestrekt, biceps gerekt",
      },
    },
    cues: {
      en: [
        "Stand tall, feet hip-width apart, knees soft, core braced.",
        "Pin your elbows to your sides. Only your forearms move.",
        "Turn your pinky up as you curl, and bring the dumbbells to shoulder height.",
        "Don't swing or lean back and don't shrug your shoulders.",
        "Lower for about two seconds until your arms are straight again.",
      ],
      nl: [
        "Sta rechtop, voeten heupbreed, knieën zacht, core aangespannen.",
        "Houd je ellebogen tegen je zij. Alleen je onderarmen bewegen.",
        "Draai je pink naar boven tijdens het curlen en breng de dumbbells tot schouderhoogte.",
        "Zwaai niet, leun niet achterover en trek je schouders niet op.",
        "Laat ongeveer twee seconden zakken tot je armen weer gestrekt zijn.",
      ],
    },
  },
  "reverse-lunge": {
    figure: {
      pose: reverseLungePose,
      implement: "none",
      furniture: "none",
      scale: 1.05,
      centerZ: -44,
    },
    labels: label("Reverse lunge", "Achterwaartse lunge"),
    phases: {
      en: {
        lower: "Step back and drop straight down",
        touch: "Front thigh level, back knee just above the floor",
        press: "Push through your front heel to stand",
        lockout: "Stand tall, feet together",
      },
      nl: {
        lower: "Stap naar achteren en zak recht omlaag",
        touch: "Voorste bovenbeen horizontaal, achterste knie net boven de grond",
        press: "Duw af met je voorste hiel om te staan",
        lockout: "Sta rechtop, voeten bij elkaar",
      },
    },
    cues: {
      en: [
        "Stand tall with your hands on your hips and your core braced.",
        "Take a big step straight back and land on the ball of your back foot.",
        "Drop straight down: front knee over the ankle, shin vertical, torso upright.",
        "Lower your back knee until it hovers just above the floor.",
        "Push through your front heel to stand and bring the back foot forward.",
      ],
      nl: [
        "Sta rechtop met je handen op je heupen en je core aangespannen.",
        "Zet een grote stap recht naar achteren en land op de bal van je achterste voet.",
        "Zak recht omlaag: voorste knie boven de enkel, scheenbeen verticaal, romp rechtop.",
        "Laat je achterste knie zakken tot hij net boven de grond zweeft.",
        "Duw af met je voorste hiel om te staan en breng de achterste voet naar voren.",
      ],
    },
  },
  "db-step-up": {
    figure: {
      pose: stepUpPose,
      implement: "dumbbells",
      furniture: "box",
      scale: 0.85,
      centerZ: 14,
    },
    labels: label("Dumbbell step-up", "Step-up met dumbbells"),
    phases: {
      en: {
        lower: "Step back down under control",
        touch: "Whole foot on the box, front knee at about 90 degrees",
        press: "Drive up through your heel",
        lockout: "Stand tall on the box",
      },
      nl: {
        lower: "Stap gecontroleerd terug omlaag",
        touch: "Hele voet op de box, voorste knie ongeveer 90 graden",
        press: "Duw omhoog door je hiel",
        lockout: "Sta rechtop op de box",
      },
    },
    cues: {
      en: [
        "Use a box or bench about knee height. Hold a dumbbell in each hand, arms straight.",
        "Put your whole foot on the box, not just your toes.",
        "Drive up through the heel of the box foot. Don't push off the back foot.",
        "Stand tall on top, hips fully extended, without leaning forward.",
        "Step back down slowly with the same leg and repeat before switching sides.",
      ],
      nl: [
        "Gebruik een box of bank op ongeveer kniehoogte. Houd een dumbbell in elke hand, armen gestrekt.",
        "Zet je hele voet op de box, niet alleen je tenen.",
        "Duw omhoog door de hiel van de voet op de box. Duw niet af met je achterste voet.",
        "Sta rechtop bovenop, heupen volledig gestrekt, zonder voorover te leunen.",
        "Stap langzaam terug met hetzelfde been en herhaal voordat je van kant wisselt.",
      ],
    },
  },
  "db-sumo-deadlift": {
    figure: {
      pose: sumoPose,
      implement: "goblet",
      furniture: "none",
      scale: 1.05,
      centerZ: -8,
    },
    labels: label("Dumbbell sumo deadlift", "Sumo deadlift met dumbbell"),
    phases: {
      en: {
        lower: "Sit down between your legs, chest up",
        touch: "Dumbbell near the floor, back flat",
        press: "Push the floor apart and stand up",
        lockout: "Stand tall, squeeze your glutes",
      },
      nl: {
        lower: "Zak tussen je benen door, borst omhoog",
        touch: "Dumbbell bij de grond, rug recht",
        press: "Duw de vloer uit elkaar en kom omhoog",
        lockout: "Sta rechtop, span je billen aan",
      },
    },
    cues: {
      en: [
        "Wide stance with your toes turned out, the dumbbell held vertically between your feet.",
        "Chest up, flat back, arms straight and hanging.",
        "Push your knees out over your toes as you sit down.",
        "Push the floor apart to stand and bring your hips through at the top.",
        "Finish with a hard glute squeeze, not by leaning back.",
      ],
      nl: [
        "Brede stand met je tenen naar buiten, de dumbbell verticaal tussen je voeten.",
        "Borst omhoog, rechte rug, armen gestrekt en hangend.",
        "Duw je knieën naar buiten over je tenen terwijl je zakt.",
        "Duw de vloer uit elkaar om te staan en breng je heupen naar voren bovenin.",
        "Eindig met een stevige bilknijp, niet door achterover te leunen.",
      ],
    },
  },
  "db-row": {
    figure: {
      pose: dbRowPose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.05,
      centerZ: 12,
      oneDumbbell: true,
    },
    labels: label("One-arm dumbbell row", "Roeien met één arm en dumbbell"),
    phases: {
      en: {
        lower: "Row the dumbbell to your hip, elbow back",
        touch: "Squeeze your back",
        press: "Lower with a full stretch",
        lockout: "Arm long, back flat",
      },
      nl: {
        lower: "Roei de dumbbell naar je heup, elleboog naar achteren",
        touch: "Knijp in je rug",
        press: "Laat zakken met een volledige rek",
        lockout: "Lange arm, rug recht",
      },
    },
    cues: {
      en: [
        "One hand and the same-side knee on the bench, back flat and parallel to the floor.",
        "Start with the working arm hanging straight down, shoulder relaxed.",
        "Pull the dumbbell towards your hip, leading with your elbow.",
        "Don't rotate your torso. Squeeze your shoulder blade towards your spine.",
        "Lower slowly to a full stretch at the bottom.",
      ],
      nl: [
        "Eén hand en de knie aan dezelfde kant op de bank, rug recht en parallel aan de grond.",
        "Begin met de werkende arm recht omlaag hangend, schouder ontspannen.",
        "Trek de dumbbell naar je heup en leid met je elleboog.",
        "Draai je romp niet mee. Knijp je schouderblad richting je wervelkolom.",
        "Laat langzaam zakken tot een volledige rek onderin.",
      ],
    },
  },
  "lateral-raise": {
    figure: {
      pose: lateralRaisePose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Dumbbell lateral raise", "Zijwaartse dumbbell raise"),
    phases: {
      en: {
        lower: "Raise out to the sides, elbows slightly bent",
        touch: "Hands at shoulder height",
        press: "Lower slowly under control",
        lockout: "Arms by your sides, shoulders relaxed",
      },
      nl: {
        lower: "Heffen naar de zijkant, ellebogen licht gebogen",
        touch: "Handen op schouderhoogte",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Armen langs je lichaam, schouders ontspannen",
      },
    },
    cues: {
      en: [
        "Stand tall, feet hip-width apart, a dumbbell in each hand at your sides.",
        "Keep a soft bend in your elbows and lift your arms out to the sides.",
        "Stop when your hands reach shoulder height. Don't swing or shrug.",
        "Lead with your elbows and keep your wrists in line with your forearms.",
        "Lower for about two seconds back to your sides.",
      ],
      nl: [
        "Sta rechtop, voeten heupbreed, een dumbbell in elke hand langs je lichaam.",
        "Houd je ellebogen zacht gebogen en til je armen naar de zijkant.",
        "Stop als je handen op schouderhoogte zijn. Zwaai niet en trek je schouders niet op.",
        "Leid met je ellebogen en houd je polsen in lijn met je onderarmen.",
        "Laat ongeveer twee seconden zakken naar je zij.",
      ],
    },
  },
  "kb-swing": {
    figure: {
      pose: kettlebellSwingPose,
      implement: "kettlebell",
      furniture: "none",
      scale: 0.95,
      centerZ: -8,
    },
    labels: label("Kettlebell swing", "Kettlebell swing"),
    phases: {
      en: {
        lower: "Hinge back, let the bell swing between your legs",
        touch: "Hips back, flat back",
        press: "Snap your hips forward, the bell floats up",
        lockout: "Tall at the top, bell at chest height",
      },
      nl: {
        lower: "Heup naar achteren, laat de bel tussen je benen zwaaien",
        touch: "Heupen achter, rug vlak",
        press: "Schiet je heupen naar voren, de bel zweeft omhoog",
        lockout: "Rechtop bovenin, bel op borsthoogte",
      },
    },
    cues: {
      en: [
        "Feet shoulder-width apart, the bell on the floor a little in front of you.",
        "Hinge at your hips with a flat back and let the bell swing back between your legs.",
        "Drive your hips forward hard. Your arms are just a rope, the power comes from the hips.",
        "At the top stand tall, glutes squeezed, the bell at chest height.",
        "Let the bell fall back and hinge again, don't squat it.",
      ],
      nl: [
        "Voeten schouderbreed, de bel een stukje voor je op de grond.",
        "Hinge vanuit je heupen met een vlakke rug en laat de bel tussen je benen zwaaien.",
        "Duw je heupen hard naar voren. Je armen zijn slechts een touw, de kracht komt uit je heupen.",
        "Sta bovenin rechtop, bilspieren aangespannen, de bel op borsthoogte.",
        "Laat de bel terugvallen en hinge opnieuw, niet squatten.",
      ],
    },
  },
  "db-single-leg-rdl": {
    figure: {
      pose: singleLegRdlPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.0,
      centerZ: -30,
    },
    labels: label("Single-leg Romanian deadlift", "Romeinse deadlift op één been"),
    phases: {
      en: {
        lower: "Hinge forward, free leg reaches back",
        touch: "Torso and free leg in one line",
        press: "Drive the hips forward to stand up",
        lockout: "Tall on one leg, hips level",
      },
      nl: {
        lower: "Hinge naar voren, het vrije been reikt naar achteren",
        touch: "Romp en vrij been op één lijn",
        press: "Duw je heup naar voren om op te staan",
        lockout: "Rechtop op één been, heupen waterpas",
      },
    },
    cues: {
      en: [
        "Stand on one leg with a soft knee, a dumbbell in each hand.",
        "Hinge at the hip and send your free leg straight back as your chest goes forward.",
        "Keep your back flat and your hips square to the floor.",
        "Lower until your torso is close to level, then drive the hip forward to stand.",
        "Keep the dumbbells close to your standing leg.",
      ],
      nl: [
        "Sta op één been met een zachte knie, een dumbbell in elke hand.",
        "Hinge vanuit de heup en stuur je vrije been recht naar achteren terwijl je borst naar voren gaat.",
        "Houd je rug vlak en je heupen recht naar de grond.",
        "Zak tot je romp bijna horizontaal is en duw dan je heup naar voren om op te staan.",
        "Houd de dumbbells dicht bij je standbeen.",
      ],
    },
  },
  "glute-bridge": {
    figure: {
      pose: gluteBridgePose,
      implement: "none",
      furniture: "none",
      scale: 1.2,
      centerZ: -48,
    },
    labels: label("Glute bridge", "Glute bridge"),
    phases: {
      en: {
        lower: "Lower your hips under control",
        touch: "Hips just above the floor",
        press: "Drive through your heels and lift",
        lockout: "Hips up, shoulders to knees in one line",
      },
      nl: {
        lower: "Laat je heupen gecontroleerd zakken",
        touch: "Heupen vlak boven de grond",
        press: "Duw door je hielen en til op",
        lockout: "Heupen omhoog, schouders tot knieën op één lijn",
      },
    },
    cues: {
      en: [
        "Lie on your back, knees bent, feet flat about hip-width apart, arms by your sides.",
        "Drive through your heels and lift your hips until your shoulders, hips and knees form one line.",
        "Squeeze your glutes at the top, ribs down so your lower back doesn't arch.",
        "Lower slowly until your hips almost touch the floor.",
        "Keep your feet flat and your knees pointing forward.",
      ],
      nl: [
        "Lig op je rug, knieën gebogen, voeten plat ongeveer heupbreed, armen langs je lichaam.",
        "Duw door je hielen en til je heupen tot schouders, heupen en knieën op één lijn staan.",
        "Knijp bovenin je bilspieren aan, ribben omlaag zodat je onderrug niet holt.",
        "Zak langzaam tot je heupen bijna de grond raken.",
        "Houd je voeten plat en je knieën naar voren.",
      ],
    },
  },
  "hip-thrust": {
    figure: {
      pose: hipThrustPose,
      implement: "barbell",
      furniture: "thrust-bench",
      scale: 1.2,
      centerZ: -52,
    },
    labels: label("Barbell hip thrust", "Barbell hip thrust"),
    phases: {
      en: {
        lower: "Lower your hips, chin tucked",
        touch: "Hips low, shins vertical",
        press: "Drive through your heels and thrust",
        lockout: "Hips up, torso level, shins vertical",
      },
      nl: {
        lower: "Laat je heupen zakken, kin ingetrokken",
        touch: "Heupen laag, onderbenen verticaal",
        press: "Duw door je hielen en duw omhoog",
        lockout: "Heupen omhoog, romp horizontaal, onderbenen verticaal",
      },
    },
    cues: {
      en: [
        "Sit with your upper back against a bench and the bar over your hips, feet flat.",
        "Tuck your chin and drive through your heels until your torso is level.",
        "At the top your shins are vertical and your glutes are squeezed. Don't arch your lower back.",
        "Lower your hips until they are just above the floor, under control.",
        "Keep your ribs down and the bar rolling on your hip crease.",
      ],
      nl: [
        "Zit met je bovenrug tegen een bank en de stang over je heupen, voeten plat.",
        "Trek je kin in en duw door je hielen tot je romp horizontaal is.",
        "Bovenin zijn je onderbenen verticaal en je bilspieren aangespannen. Hol je onderrug niet.",
        "Laat je heupen gecontroleerd zakken tot vlak boven de grond.",
        "Houd je ribben omlaag en de stang rollend op je heupplooi.",
      ],
    },
  },
};
