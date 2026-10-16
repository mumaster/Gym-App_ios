import {
  BODY,
  ROW_BENCH_Y,
  SEAT_HIP_Y,
  STAND_SHOULDER_Y,
  STAND_HIP_Y,
  assemble,
  cos,
  forwardKnees,
  headFrom,
  label,
  lerp,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W12 (EZ-bar work, preacher curls, a cable curl and the
 *  overhead cable extension), merged into EXERCISE_ANIMATIONS by
 *  exerciseAnimations.ts. */

/** Pole that makes `twoBone` return the elbow `E` for the shoulder `S` and wrist `W`. */
function poleOf(S: V3, E: V3, W: V3): V3 {
  const p: V3 = [E[0] - (S[0] + W[0]) / 2, E[1] - (S[1] + W[1]) / 2, E[2] - (S[2] + W[2]) / 2];
  return Math.hypot(p[0], p[1], p[2]) < 1e-6 ? [0, 0, 1] : p;
}

/** Both arms from pinned elbows and forearm vectors (per side `s` = -1 / +1). */
interface ArmPlan {
  shoulder: (s: -1 | 1) => V3;
  elbow: (s: -1 | 1) => V3;
  wrist: (s: -1 | 1) => V3;
}
const poleFn = (a: ArmPlan) => (s: -1 | 1) => poleOf(a.shoulder(s), a.elbow(s), a.wrist(s));

/* ------------------------------------------------------------------ */
/* Standing curls: EZ-bar curl, EZ-bar reverse curl, cable curl         */
/* ------------------------------------------------------------------ */

interface CurlCfg {
  /** Half the distance between the hands (cm). */
  grip: number;
  /** Elbow x (cm from the midline), pinned at the sides. */
  elbowX: number;
  /** Forearm angle from hanging, at depth 1 (degrees). */
  flex: number;
}
/** Elbow height is fixed; the elbow sits 4 cm ahead of the shoulder line. */
const CURL_ELBOW_Z = 5;

export const EZ_CURL: CurlCfg = { grip: 12, elbowX: 17.5, flex: 146 };
export const EZ_REVERSE_CURL: CurlCfg = { grip: 14, elbowX: 18, flex: 128 };
export const CABLE_CURL: CurlCfg = { grip: 15, elbowX: 19, flex: 144 };

/** Standing curl with both elbows pinned at the sides and only the forearms
 *  turning about them. Depth 0 = arms hanging (almost straight), 1 = curled. */
export function standingCurlPose(cfg: CurlCfg, depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const dxe = BODY.shoulderHalf - cfg.elbowX;
  const ey = shoulder.y - Math.sqrt(29 * 29 - dxe * dxe - CURL_ELBOW_Z * CURL_ELBOW_Z);
  const gx = cfg.grip - cfg.elbowX;
  const L = Math.sqrt(26 * 26 - gx * gx);
  const theta = lerp(10, cfg.flex, e);
  const arms: ArmPlan = {
    shoulder: (s) => [s * BODY.shoulderHalf, shoulder.y, 0],
    elbow: (s) => [s * cfg.elbowX, ey, CURL_ELBOW_Z],
    wrist: (s) => [s * cfg.grip, ey - L * cos(theta), CURL_ELBOW_Z + L * sin(theta)],
  };
  const w = arms.wrist(1);
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    wrist: arms.wrist,
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: poleFn(arms),
  });
}

/* ------------------------------------------------------------------ */
/* Preacher curls (EZ bar, barbell, dumbbell, machine)                  */
/* ------------------------------------------------------------------ */

export interface PreacherCfg {
  /** Pad angle below horizontal (degrees): the upper arms lie along it. */
  padDeg: number;
  /** Torso lean forward onto the pad (degrees from vertical). */
  lean: number;
  /** Half the distance between the hands. */
  grip: number;
  /** Elbow flexion beyond straight at depth 0 and 1 (degrees). */
  flex0: number;
  flex1: number;
  /** Only the near arm curls (dumbbell); the free hand rests on the thigh. */
  oneArm?: boolean;
}
export const PREACHER_HIP = { y: SEAT_HIP_Y, z: -4 };
/** Elbow x on the pad (the upper arms tuck 4 cm inside the shoulders). */
export const PREACHER_ELBOW_X = BODY.shoulderHalf - 4;
/** Thickness of the pad, and how far its surface sits below the arm line. */
export const PAD_HALF = 4.5;
export const PAD_OFFSET = 8.5;

export const PRE_EZ: PreacherCfg = { padDeg: 52, lean: 22, grip: 12, flex0: 12, flex1: 130 };
export const PRE_BARBELL: PreacherCfg = { padDeg: 52, lean: 22, grip: 17, flex0: 12, flex1: 126 };
export const PRE_DB: PreacherCfg = {
  padDeg: 52,
  lean: 22,
  grip: 19,
  flex0: 8,
  flex1: 138,
  oneArm: true,
};
export const PRE_MACHINE: PreacherCfg = {
  padDeg: 55,
  lean: 20,
  grip: 14,
  flex0: 10,
  flex1: 136,
};

/** Preacher curl: sitting with the upper arms flat on the sloping pad,
 *  armpits at its top edge, the elbows never leave the pad and only the
 *  forearms turn about them. Depth 0 = arms almost straight, 1 = curled. */
export function preacherPose(cfg: PreacherCfg, depth: number): FigurePose {
  const e = smooth(depth);
  const hip = PREACHER_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(cfg.lean),
    z: hip.z + BODY.torso * sin(cfg.lean),
  };
  const a = cfg.padDeg;
  // Along the pad (down and forward) and its normal (up and forward), as (z, y).
  const u: [number, number] = [cos(a), -sin(a)];
  const n: [number, number] = [sin(a), cos(a)];
  const dxe = BODY.shoulderHalf - PREACHER_ELBOW_X;
  const Lu = Math.sqrt(29 * 29 - dxe * dxe);
  const gx = cfg.grip - PREACHER_ELBOW_X;
  const Lf = Math.sqrt(26 * 26 - gx * gx);
  const d = lerp(cfg.flex0, cfg.flex1, e);
  const f: [number, number] = [cos(d) * u[0] + sin(d) * n[0], cos(d) * u[1] + sin(d) * n[1]];
  const arms: ArmPlan = {
    shoulder: (s) => [s * BODY.shoulderHalf, shoulder.y, shoulder.z],
    elbow: (s) => [s * PREACHER_ELBOW_X, shoulder.y + Lu * u[1], shoulder.z + Lu * u[0]],
    wrist: (s) => {
      const el: V3 = [s * PREACHER_ELBOW_X, shoulder.y + Lu * u[1], shoulder.z + Lu * u[0]];
      return [s * cfg.grip, el[1] + Lf * f[1], el[2] + Lf * f[0]];
    },
  };
  const build = (free: V3 | null) =>
    assemble({
      hip,
      shoulder,
      head: headFrom(shoulder, cfg.lean * 0.6),
      ankleZ: 40,
      footHalf: 16,
      wrist: (s) => (cfg.oneArm && s < 0 && free ? free : arms.wrist(s)),
      bar: cfg.oneArm ? arms.wrist(1) : [0, arms.wrist(1)[1], arms.wrist(1)[2]],
      kneePole: (s) => [s * 0.2, 1, 0.5],
      elbowPole: (s) =>
        cfg.oneArm && s < 0 && free
          ? [-1, -0.3, -0.8]
          : poleOf(arms.shoulder(s), arms.elbow(s), arms.wrist(s)),
    });
  if (!cfg.oneArm) return build(null);
  // The free hand rests on top of the far thigh, a little above its middle.
  const probe = build([-13, 0, 0]);
  const k = probe.knees[0];
  const h = probe.hips[0];
  return build([-13, (h[1] + k[1]) / 2 + 7, (h[2] + k[2]) / 2 + 4]);
}

/* ------------------------------------------------------------------ */
/* EZ-bar skullcrusher                                                  */
/* ------------------------------------------------------------------ */

export const ESC_GRIP = 9;
const ESC_ELBOW_X = 15;

/** EZ-bar skullcrusher: lying on a flat bench, the upper arms stay almost
 *  vertical (8 degrees toward the head) and still, only the forearms hinge
 *  and the bar travels to just above the forehead. Depth 0 = arms straight. */
export function ezSkullcrusherPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: ROW_BENCH_Y + 10, z: -8 };
  const hip = { y: shoulder.y, z: shoulder.z + BODY.torso };
  const tilt = 8;
  const Lu = Math.sqrt(29 * 29 - (BODY.shoulderHalf - ESC_ELBOW_X) ** 2);
  const Lf = Math.sqrt(26 * 26 - (ESC_ELBOW_X - ESC_GRIP) ** 2);
  const elbow = (s: -1 | 1): V3 => [
    s * ESC_ELBOW_X,
    shoulder.y + Lu * cos(tilt),
    shoulder.z - Lu * sin(tilt),
  ];
  const phi = lerp(tilt, 104, e); // forearm angle from straight up, toward the head
  const arms: ArmPlan = {
    shoulder: (s) => [s * BODY.shoulderHalf, shoulder.y, shoulder.z],
    elbow,
    wrist: (s) => {
      const el = elbow(s);
      return [s * ESC_GRIP, el[1] + Lf * cos(phi), el[2] - Lf * sin(phi)];
    },
  };
  const w = arms.wrist(1);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y, shoulder.z - 22],
    ankleZ: hip.z + 24,
    footHalf: 13,
    wrist: arms.wrist,
    bar: [0, w[1], w[2]],
    kneePole: () => [0, 1, 0.3],
    elbowPole: poleFn(arms),
  });
}

/* ------------------------------------------------------------------ */
/* EZ-bar overhead triceps extension                                    */
/* ------------------------------------------------------------------ */

export const EOH_GRIP = 9;
const EOH_ELBOW_X = 14;
/** Upper arm lean forward of vertical (degrees). */
const EOH_LEAN = 6;

/** EZ-bar overhead triceps extension: standing tall, the upper arms stay up
 *  beside the ears and only the forearms hinge, lowering the bar behind the
 *  head to neck height. Depth 0 = arms almost straight overhead. */
export function ezOverheadPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const Lu = Math.sqrt(29 * 29 - (BODY.shoulderHalf - EOH_ELBOW_X) ** 2);
  const Lf = Math.sqrt(26 * 26 - (EOH_ELBOW_X - EOH_GRIP) ** 2);
  const elbow = (s: -1 | 1): V3 => [
    s * EOH_ELBOW_X,
    shoulder.y + Lu * cos(EOH_LEAN),
    Lu * sin(EOH_LEAN),
  ];
  const gamma = EOH_LEAN - lerp(8, 138, e); // forearm angle from straight up, forward positive
  const arms: ArmPlan = {
    shoulder: (s) => [s * BODY.shoulderHalf, shoulder.y, 0],
    elbow,
    wrist: (s) => {
      const el = elbow(s);
      return [s * EOH_GRIP, el[1] + Lf * cos(gamma), el[2] + Lf * sin(gamma)];
    },
  };
  const w = arms.wrist(1);
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: [0, shoulder.y + 22, 4],
    ankleZ: 0,
    footHalf: 11,
    wrist: arms.wrist,
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: poleFn(arms),
  });
}

/* ------------------------------------------------------------------ */
/* Overhead cable triceps extension (high pulley behind the lifter)     */
/* ------------------------------------------------------------------ */

/** The high pulley behind the lifter (cm). The lifter faces away from it. */
export const OHC_PULLEY = { y: 192, z: -58 };
export const OHC_HIP = { y: 90, z: -2 };
export const OHC_LEAN = 26;
const OHC_ARM_LEAN = 28;
const OHC_ELBOW_X = 14;
export const OHC_GRIP = 8;
/** Staggered stance: the near foot ahead, the far foot behind (z of the ankles). */
export const OHC_FRONT_ANKLE_Z = 26;
export const OHC_BACK_ANKLE_Z = -26;

/** Overhead cable triceps extension with a rope: staggered stance, torso
 *  leaning forward about 26 degrees, upper arms pinned beside the ears and
 *  pointing up and forward, the rope behind the head. The forearms hinge from
 *  nearly straight (arms forward and up) back to a deep stretch behind the
 *  head. Depth 0 = extended, 1 = deep stretch. */
export function overheadCablePose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = OHC_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(OHC_LEAN),
    z: hip.z + BODY.torso * sin(OHC_LEAN),
  };
  const Lu = Math.sqrt(29 * 29 - (BODY.shoulderHalf - OHC_ELBOW_X) ** 2);
  const Lf = Math.sqrt(26 * 26 - (OHC_ELBOW_X - OHC_GRIP) ** 2);
  const elbow = (s: -1 | 1): V3 => [
    s * OHC_ELBOW_X,
    shoulder.y + Lu * cos(OHC_ARM_LEAN),
    shoulder.z + Lu * sin(OHC_ARM_LEAN),
  ];
  const gamma = OHC_ARM_LEAN - lerp(10, 138, e);
  const arms: ArmPlan = {
    shoulder: (s) => [s * BODY.shoulderHalf, shoulder.y, shoulder.z],
    elbow,
    wrist: (s) => {
      const el = elbow(s);
      return [s * OHC_GRIP, el[1] + Lf * cos(gamma), el[2] + Lf * sin(gamma)];
    },
  };
  const w = arms.wrist(1);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, OHC_LEAN * 0.6),
    ankleZ: 0,
    footHalf: 11,
    ankle: (s) => [s * 11, 8, s > 0 ? OHC_FRONT_ANKLE_Z : OHC_BACK_ANKLE_Z],
    wrist: arms.wrist,
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: poleFn(arms),
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

/** The low pulley the cable curl pulls from (cm). */
export const CABLE_CURL_PULLEY = { y: 14, z: 74 };

type Cues = ExerciseAnimationSpec["cues"];
type Phases = NonNullable<ExerciseAnimationSpec["phases"]>;

const curlPhases: Phases = {
  en: {
    lower: "Curl the bar up, elbows pinned to your sides",
    touch: "Squeeze at the top, bar at shoulder height",
    press: "Lower slowly under control",
    lockout: "Arms almost straight, biceps stretched",
  },
  nl: {
    lower: "Curl de stang omhoog, ellebogen tegen je zij",
    touch: "Knijp bovenin, stang op schouderhoogte",
    press: "Laat langzaam gecontroleerd zakken",
    lockout: "Armen bijna gestrekt, biceps gerekt",
  },
};

const preacherPhases: Phases = {
  en: {
    lower: "Curl up, upper arms flat on the pad",
    touch: "Squeeze at the top, armpits against the pad",
    press: "Lower slowly, don't swing",
    lockout: "Arms almost straight, biceps stretched",
  },
  nl: {
    lower: "Curl omhoog, bovenarmen plat op het kussen",
    touch: "Knijp bovenin, oksels tegen het kussen",
    press: "Laat langzaam zakken, zwaai niet",
    lockout: "Armen bijna gestrekt, biceps gerekt",
  },
};

const preacherCues = (
  en: { grab: string; lift: string },
  nl: { grab: string; lift: string },
): Cues => ({
  en: [
    "Sit with your feet flat and your chest against the pad. Your armpits sit against the top edge of the pad.",
    en.grab,
    "Rest your upper arms flat on the pad. They stay there for the whole rep.",
    en.lift,
    "Lower slowly until your arms are almost straight. Don't swing or lift your elbows off the pad.",
  ],
  nl: [
    "Zit met je voeten plat en je borst tegen het kussen. Je oksels zitten tegen de bovenrand van het kussen.",
    nl.grab,
    "Leg je bovenarmen plat op het kussen. Ze blijven er de hele herhaling op liggen.",
    nl.lift,
    "Laat langzaam zakken tot je armen bijna gestrekt zijn. Zwaai niet en til je ellebogen niet van het kussen.",
  ],
});

const dbPreacherCues: Cues = {
  en: [
    "Sit at a preacher bench with your feet flat and your chest against the pad. An incline bench's back pad works too.",
    "Take a dumbbell in one hand with your palm up and rest the back of that upper arm on the pad, armpit tight to the top.",
    "Curl the dumbbell up towards your shoulder. Your upper arm stays on the pad.",
    "Lower all the way to a straight arm without swinging.",
    "Do all reps, then switch arms.",
  ],
  nl: [
    "Zit aan een preacher bank met je voeten plat en je borst tegen het kussen. De rugleuning van een incline bank werkt ook.",
    "Pak met één hand een dumbbell met je handpalm omhoog en leg de achterkant van die bovenarm op het kussen, oksel strak tegen de bovenkant.",
    "Curl de dumbbell omhoog naar je schouder. Je bovenarm blijft op het kussen.",
    "Laat helemaal zakken tot een gestrekte arm, zonder te zwaaien.",
    "Doe alle herhalingen en wissel dan van arm.",
  ],
};

export const ANIMATIONS_W12: Record<string, ExerciseAnimationSpec> = {
  "ez-bar-curl": {
    figure: {
      pose: (d) => standingCurlPose(EZ_CURL, d),
      implement: "w12-ez-bar",
      furniture: "none",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("EZ-bar curl", "Curl met de EZ-stang"),
    phases: curlPhases,
    cues: {
      en: [
        "Stand tall, feet hip-width apart, knees soft, core braced.",
        "Hold the angled grips of the EZ bar underhand, elbows at your sides.",
        "Curl the bar up to shoulder height. Only your forearms move and your elbows stay pinned.",
        "Don't swing or lean back and don't shrug your shoulders.",
        "Lower under control to a full stretch at the bottom.",
      ],
      nl: [
        "Sta rechtop, voeten heupbreed, knieën zacht, core aangespannen.",
        "Pak de schuine handgrepen van de EZ-stang onderhands vast, ellebogen langs je zij.",
        "Curl de stang omhoog tot schouderhoogte. Alleen je onderarmen bewegen en je ellebogen blijven vast.",
        "Zwaai niet, leun niet achterover en trek je schouders niet op.",
        "Laat gecontroleerd zakken tot een volledige rek onderin.",
      ],
    },
  },
  "ez-bar-reverse-curl": {
    figure: {
      pose: (d) => standingCurlPose(EZ_REVERSE_CURL, d),
      implement: "w12-ez-bar-over",
      furniture: "none",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("EZ-bar reverse curl", "Reverse curl met de EZ-stang"),
    phases: {
      en: {
        lower: "Curl the bar up with your palms down, wrists straight",
        touch: "Squeeze at the top, wrists still straight",
        press: "Lower slowly under control",
        lockout: "Arms almost straight, forearms stretched",
      },
      nl: {
        lower: "Curl de stang omhoog met je handpalmen omlaag, polsen recht",
        touch: "Knijp bovenin, polsen nog steeds recht",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Armen bijna gestrekt, onderarmen gerekt",
      },
    },
    cues: {
      en: [
        "Stand tall, feet hip-width apart, knees soft, core braced.",
        "Take the EZ bar with an overhand grip on the angled sections, elbows at your sides.",
        "Curl the bar up with your wrists straight, so they don't bend back.",
        "Keep your elbows at your sides and don't swing. The bar finishes around chest height.",
        "Lower slowly until your arms are almost straight.",
      ],
      nl: [
        "Sta rechtop, voeten heupbreed, knieën zacht, core aangespannen.",
        "Pak de EZ-stang bovenhands vast op de schuine delen, ellebogen langs je zij.",
        "Curl de stang omhoog met rechte polsen, zodat ze niet naar achteren knikken.",
        "Houd je ellebogen langs je zij en zwaai niet. De stang eindigt rond borsthoogte.",
        "Laat langzaam zakken tot je armen bijna gestrekt zijn.",
      ],
    },
  },
  "ez-bar-preacher-curl": {
    figure: {
      pose: (d) => preacherPose(PRE_EZ, d),
      implement: "w12-ez-bar",
      furniture: "w12-preacher",
      scale: 1.0,
      centerZ: 30,
    },
    labels: label("EZ-bar preacher curl", "Preacher curl met de EZ-stang"),
    phases: preacherPhases,
    cues: preacherCues(
      {
        grab: "Take the EZ bar underhand on the angled grips, shoulder-width or a little narrower.",
        lift: "Curl the bar up until your forearms are almost vertical and squeeze your biceps.",
      },
      {
        grab: "Pak de EZ-stang onderhands op de schuine handgrepen, schouderbreed of iets smaller.",
        lift: "Curl de stang omhoog tot je onderarmen bijna verticaal zijn en span je biceps aan.",
      },
    ),
  },
  "barbell-preacher-curl": {
    figure: {
      pose: (d) => preacherPose(PRE_BARBELL, d),
      implement: "w12-barbell",
      furniture: "w12-preacher",
      scale: 1.0,
      centerZ: 30,
    },
    labels: label("Barbell preacher curl", "Preacher curl met de barbell"),
    phases: preacherPhases,
    cues: preacherCues(
      {
        grab: "Take the barbell underhand, about shoulder-width, with your wrists straight.",
        lift: "Curl the barbell up with straight wrists until your forearms are almost vertical.",
      },
      {
        grab: "Pak de barbell onderhands, ongeveer schouderbreed, met rechte polsen.",
        lift: "Curl de barbell omhoog met rechte polsen tot je onderarmen bijna verticaal zijn.",
      },
    ),
  },
  "db-preacher-curl": {
    figure: {
      pose: (d) => preacherPose(PRE_DB, d),
      implement: "dumbbells",
      furniture: "w12-preacher",
      scale: 1.0,
      centerZ: 30,
      oneDumbbell: true,
    },
    labels: label("Dumbbell preacher curl", "Preacher curl met dumbbell"),
    phases: preacherPhases,
    cues: dbPreacherCues,
  },
  "machine-preacher-curl": {
    figure: {
      pose: (d) => preacherPose(PRE_MACHINE, d),
      implement: "w12-preacher-lever",
      furniture: "w12-preacher-machine",
      scale: 1.0,
      centerZ: 36,
    },
    labels: label("Machine preacher curl", "Preacher curl machine"),
    phases: {
      en: {
        lower: "Curl the handles up, upper arms flat on the pad",
        touch: "Squeeze at the top, armpits against the pad",
        press: "Let the handles down slowly",
        lockout: "Arms almost straight, biceps stretched",
      },
      nl: {
        lower: "Curl de handvatten omhoog, bovenarmen plat op het kussen",
        touch: "Knijp bovenin, oksels tegen het kussen",
        press: "Laat de handvatten langzaam zakken",
        lockout: "Armen bijna gestrekt, biceps gerekt",
      },
    },
    cues: {
      en: [
        "Adjust the seat so your armpits sit against the top of the pad with your feet flat on the floor.",
        "Rest your upper arms flat on the pad and take the handles with your palms up.",
        "Curl the handles up towards your shoulders. Your elbows stay on the pad.",
        "Squeeze at the top, then lower slowly.",
        "Straighten your arms fully at the bottom for a full stretch.",
      ],
      nl: [
        "Stel de zitting zo in dat je oksels tegen de bovenkant van het kussen zitten en je voeten plat op de grond staan.",
        "Leg je bovenarmen plat op het kussen en pak de handvatten met je handpalmen omhoog.",
        "Curl de handvatten omhoog richting je schouders. Je ellebogen blijven op het kussen.",
        "Knijp bovenin en laat dan langzaam zakken.",
        "Strek je armen onderin helemaal voor een volledige rek.",
      ],
    },
  },
  "ez-bar-skullcrusher": {
    figure: {
      pose: ezSkullcrusherPose,
      implement: "w12-ez-bar-small",
      furniture: "flat-bench",
      scale: 1.05,
      centerZ: -4,
    },
    labels: label("EZ-bar skullcrusher", "Skullcrusher met de EZ-stang"),
    phases: {
      en: {
        lower: "Bend your elbows to lower the bar towards your forehead",
        touch: "Bar just above your forehead, upper arms still",
        press: "Straighten your elbows to press back up",
        lockout: "Arms straight above your shoulders",
      },
      nl: {
        lower: "Buig je ellebogen en laat de stang naar je voorhoofd zakken",
        touch: "Stang net boven je voorhoofd, bovenarmen stil",
        press: "Strek je ellebogen om terug omhoog te duwen",
        lockout: "Armen gestrekt boven je schouders",
      },
    },
    cues: {
      en: [
        "Lie on a flat bench, feet flat, EZ bar above your chest with a narrow grip on the inner angled sections.",
        "Keep your upper arms still, elbows pointing at the ceiling. Only your forearms move.",
        "Lower the bar towards your forehead by bending your elbows.",
        "Straighten your elbows to press back up without flaring them out.",
        "Keep your lower back on the bench and your wrists straight.",
      ],
      nl: [
        "Ga op een vlakke bank liggen, voeten plat, EZ-stang boven je borst met een smalle greep op de binnenste schuine delen.",
        "Houd je bovenarmen stil, ellebogen wijzen naar het plafond. Alleen je onderarmen bewegen.",
        "Laat de stang naar je voorhoofd zakken door je ellebogen te buigen.",
        "Strek je ellebogen om omhoog te duwen zonder ze naar buiten te laten wijken.",
        "Houd je onderrug op de bank en je polsen recht.",
      ],
    },
  },
  "ez-bar-overhead-triceps-extension": {
    figure: {
      pose: ezOverheadPose,
      implement: "w12-ez-bar-behind",
      furniture: "none",
      scale: 0.88,
      centerZ: 0,
    },
    labels: label(
      "EZ-bar overhead triceps extension",
      "Triceps extension boven het hoofd met EZ-stang",
    ),
    phases: {
      en: {
        lower: "Bend your elbows to lower the bar behind your head",
        touch: "Bar behind your head, elbows pointing up",
        press: "Straighten your arms to press it back up",
        lockout: "Arms straight overhead",
      },
      nl: {
        lower: "Buig je ellebogen en laat de stang achter je hoofd zakken",
        touch: "Stang achter je hoofd, ellebogen wijzen omhoog",
        press: "Strek je armen om hem weer omhoog te duwen",
        lockout: "Armen gestrekt boven je hoofd",
      },
    },
    cues: {
      en: [
        "Stand tall with the EZ bar held overhead, a narrow grip on the inner angled sections.",
        "Keep your upper arms close to your ears and pointing up. Keep your ribcage down.",
        "Lower the bar behind your head by bending only your elbows.",
        "Press back up until your arms are straight, without arching your back.",
      ],
      nl: [
        "Sta rechtop met de EZ-stang boven je hoofd, een smalle greep op de binnenste schuine delen.",
        "Houd je bovenarmen dicht bij je oren en wijzend omhoog. Houd je ribbenkast omlaag.",
        "Laat de stang achter je hoofd zakken door alleen je ellebogen te buigen.",
        "Duw omhoog tot je armen gestrekt zijn, zonder je rug hol te trekken.",
      ],
    },
  },
  "cable-curl": {
    figure: {
      pose: (d) => standingCurlPose(CABLE_CURL, d),
      implement: "w12-cable-bar",
      furniture: "w12-low-tower",
      scale: 1.0,
      centerZ: 34,
      pulley: CABLE_CURL_PULLEY,
    },
    labels: label("Cable bicep curl", "Biceps curl aan de kabel"),
    phases: {
      en: {
        lower: "Curl the bar up, elbows pinned to your sides",
        touch: "Squeeze at the top, cable under tension",
        press: "Control the way down",
        lockout: "Arms almost straight, biceps stretched",
      },
      nl: {
        lower: "Curl de stang omhoog, ellebogen tegen je zij",
        touch: "Knijp bovenin, kabel onder spanning",
        press: "Laat gecontroleerd zakken",
        lockout: "Armen bijna gestrekt, biceps gerekt",
      },
    },
    cues: {
      en: [
        "Stand facing the low pulley, feet hip-width apart, knees soft, a straight bar or EZ handle in an underhand grip.",
        "Pin your elbows to your sides. Only your forearms move.",
        "Curl the handle up towards your chest without leaning back.",
        "Control the way down and keep the cable tight at the bottom.",
      ],
      nl: [
        "Sta met je gezicht naar de lage katrol, voeten heupbreed, knieën zacht, een rechte stang of EZ-handvat onderhands vast.",
        "Houd je ellebogen tegen je zij. Alleen je onderarmen bewegen.",
        "Curl het handvat omhoog richting je borst zonder achterover te leunen.",
        "Laat gecontroleerd zakken en houd de kabel onderin strak.",
      ],
    },
  },
  "overhead-cable-extension": {
    figure: {
      pose: overheadCablePose,
      implement: "w12-oh-rope",
      furniture: "w12-oh-tower",
      scale: 0.85,
      centerZ: -12,
      pulley: OHC_PULLEY,
    },
    labels: label(
      "Overhead cable triceps extension",
      "Triceps extension boven het hoofd aan de kabel",
    ),
    phases: {
      en: {
        lower: "Bend your elbows to let the rope go back behind your head",
        touch: "Deep stretch behind your head, elbows pointing forward",
        press: "Extend your arms forward and up",
        lockout: "Arms straight, triceps squeezed",
      },
      nl: {
        lower: "Buig je ellebogen en laat het touw achter je hoofd zakken",
        touch: "Diepe rek achter je hoofd, ellebogen wijzen naar voren",
        press: "Strek je armen naar voren en omhoog",
        lockout: "Armen gestrekt, triceps aangespannen",
      },
    },
    cues: {
      en: [
        "Face away from the high pulley in a staggered stance, leaning forward a little, with the rope behind your head.",
        "Keep your elbows next to your head, pointing forward. Your ribcage stays down.",
        "Extend your arms forward and up until they are almost straight.",
        "Let the rope go back slowly for a deep stretch behind your head. Only your forearms move.",
      ],
      nl: [
        "Sta met je rug naar de hoge katrol in spreidstand, een beetje voorovergebogen, met het touw achter je hoofd.",
        "Houd je ellebogen naast je hoofd, wijzend naar voren. Je ribbenkast blijft omlaag.",
        "Strek je armen naar voren en omhoog tot ze bijna gestrekt zijn.",
        "Laat het touw langzaam terugzakken voor een diepe rek achter je hoofd. Alleen je onderarmen bewegen.",
      ],
    },
  },
};
