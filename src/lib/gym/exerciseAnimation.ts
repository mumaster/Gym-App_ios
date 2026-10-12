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

export interface FigurePose extends Pose {
  head: V3;
}

export type Implement = "barbell" | "dumbbells" | "goblet" | "latbar";
export type Furniture = "none" | "upright-bench" | "pulldown";

/** One exercise as a function of `depth` (0 = the start/top position the
 *  loop begins in, 1 = the turning point), plus what to draw around it. */
export interface FigureModel {
  pose: (depth: number) => FigurePose;
  implement: Implement;
  furniture: Furniture;
  /** px per cm, and the z (cm) drawn at the middle of the side view. */
  scale: number;
  centerZ: number;
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
  const ankles = at((s): V3 => [s * sk.footHalf, ANKLE_Y, sk.ankleZ]);
  const wrists = at(sk.wrist);
  const elbows = at((s) => twoBone(shoulders[i(s)], wrists[i(s)], 29, 26, sk.elbowPole(s)));
  const knees = at((s) => twoBone(hips[i(s)], ankles[i(s)], BODY.thigh, BODY.shin, sk.kneePole(s)));
  return { shoulders, elbows, wrists, hips, knees, ankles, head: sk.head, bar: sk.bar };
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
};
