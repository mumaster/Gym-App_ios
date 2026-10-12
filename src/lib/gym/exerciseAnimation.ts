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

export interface ExerciseAnimationSpec {
  rig: PressRig;
  cues: Record<Language, string[]>;
}

/** Add an exercise by id. Only the barbell bench press has one so far. */
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
};
