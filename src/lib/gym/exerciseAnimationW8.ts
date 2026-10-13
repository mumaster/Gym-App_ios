import {
  ANKLE_Y,
  assemble,
  BODY,
  clamp01,
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
import { ROW_HIP, ROW_PLATFORM_Y, ROW_PULLEY } from "./exerciseAnimationW4";

/** Animation batch W8 (cable and machine isolation work), merged into
 *  EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** Unit vector `t` of the way from `a` to `b` along the great circle. */
function slerp3(a: V3, b: V3, t: number): V3 {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(d);
  if (om < 1e-6) return a;
  const k0 = Math.sin((1 - t) * om) / Math.sin(om);
  const k1 = Math.sin(t * om) / Math.sin(om);
  return [k0 * a[0] + k1 * b[0], k0 * a[1] + k1 * b[1], k0 * a[2] + k1 * b[2]];
}
const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Hip height of a standing pose with soft knees (hip-to-ankle reach 87.2 cm). */
const SOFT_HIP_Y = ANKLE_Y + Math.sqrt(87.2 * 87.2 - 4);

/** Hip height over ankles `dz` behind the hip and `dx` apart, with a hip-to-ankle reach of `reach`. */
const hipHeight = (reach: number, dz: number, dx: number) =>
  ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx);

/* ------------------------------------------------------------------ */
/* Straight-arm pulldown                                               */
/* ------------------------------------------------------------------ */

/** The high pulley the straight bar hangs from (cm). */
export const SAP_PULLEY = { y: 182, z: 96 };
/** The hinge the lifter holds the whole set (degrees from vertical). */
export const SAP_LEAN = 22;
/** Shoulder-to-wrist distance, fixed all rep: a soft elbow bend (cm). */
export const SAP_REACH = 54.3;

/** Straight-arm pulldown: a small hinge held still, the arms stay almost
 *  straight and swing from overhead-forward down to the thighs. */
export function straightArmPulldownPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: hipHeight(87.4, 12, 2), z: -12 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(SAP_LEAN),
    z: hip.z + BODY.torso * sin(SAP_LEAN),
  };
  const theta = lerp(112, 4, e); // arm angle from hanging, forward positive
  const reach = Math.sqrt(SAP_REACH * SAP_REACH - 4);
  const wy = shoulder.y - reach * cos(theta);
  const wz = shoulder.z + reach * sin(theta);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, SAP_LEAN * 0.6),
    ankleZ: 0,
    footHalf: 12,
    wrist: (s) => [s * 17, wy, wz],
    bar: [0, wy, wz],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.4, -1, -0.3],
  });
}

/* ------------------------------------------------------------------ */
/* Single-arm high cable fly                                           */
/* ------------------------------------------------------------------ */

/** The tower stands to the working (near) side: its x, pulley height and z. */
export const HIFLY_TOWER = { x: 98, y: 172, z: 4 };

/** Single-arm high cable fly: side-on to the high pulley, the near arm keeps
 *  one soft elbow bend and sweeps from out-and-up down and across to the
 *  opposite hip; the free hand rests on the far hip. */
export function singleArmHighFlyPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 8;
  const hip = { y: SOFT_HIP_Y, z: -4 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const R = 53;
  const d = slerp3(unit([0.93, 0.28, -0.1]), unit([-0.5, -0.82, 0.28]), e);
  const right: V3 = [BODY.shoulderHalf + R * d[0], shoulder.y + R * d[1], shoulder.z + R * d[2]];
  const left: V3 = [-27, hip.y + 4, hip.z + 4];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: 0,
    footHalf: 12,
    wrist: (s) => (s > 0 ? right : left),
    bar: right,
    kneePole: forwardKnees,
    elbowPole: (s) =>
      s > 0 ? [lerp(0.1, 1, e), lerp(-1, -0.3, e), lerp(-0.3, 0.2, e)] : [-1, 0, -0.3],
  });
}

/* ------------------------------------------------------------------ */
/* Low-to-high cable fly                                               */
/* ------------------------------------------------------------------ */

/** Half the distance between the towers, and the low pulleys' height and z. */
export const LOWFLY_TOWER_X = 82;
export const LOWFLY_PULLEY = { y: 16, z: -14 };

/** Low-to-high cable fly: slight forward lean, one soft elbow bend, the hands
 *  sweep from low and wide up and together in front of the chin. */
export function lowToHighFlyPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 12;
  const hip = { y: SOFT_HIP_Y - 1, z: 0 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const R = 52;
  const d = slerp3(unit([0.7, -0.7, -0.15]), unit([-0.25, 0.1, 0.95]), e);
  const wrist = (s: -1 | 1): V3 => [
    s * BODY.shoulderHalf + s * R * d[0],
    shoulder.y + R * d[1],
    shoulder.z + R * d[2],
  ];
  const mid = wrist(1);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: 0,
    footHalf: 14,
    wrist,
    bar: [0, mid[1], mid[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * lerp(0.2, 0.8, e), -1, lerp(-0.5, -0.1, e)],
  });
}

/* ------------------------------------------------------------------ */
/* Single-arm seated cable row                                         */
/* ------------------------------------------------------------------ */

/** Single-arm seated cable row: upright torso that stays square, the near
 *  arm rows the handle from a long reach to the hip with the elbow past the
 *  torso; the free hand rests on its thigh. */
export function singleArmCableRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = ROW_HIP;
  const lean = lerp(7, 0, e);
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const R = 54.4;
  const startY = shoulder.y - 14;
  const start: V3 = [19, startY, shoulder.z + Math.sqrt(R * R - 14 * 14)];
  const end: V3 = [17, hip.y + 17, hip.z + 4];
  const w: V3 = [lerp(start[0], end[0], e), lerp(start[1], end[1], e), lerp(start[2], end[2], e)];
  const ankleY = ROW_PLATFORM_Y + ANKLE_Y;
  const build = (free: V3) =>
    assemble({
      hip,
      shoulder,
      head: headFrom(shoulder, lean * 0.4),
      ankleZ: 78,
      footHalf: 14,
      ankle: (s) => [s * 14, ankleY, 78],
      foot: () => ({ floor: ROW_PLATFORM_Y, dir: 1 }),
      wrist: (s) => (s > 0 ? w : free),
      bar: w,
      kneePole: (s) => [s * 0.15, 1, 0.2],
      elbowPole: (s) => (s > 0 ? [0.35, -0.3, -1] : [-0.6, -1, 0.1]),
    });
  // The free hand lies on the far thigh, a little above its middle.
  const probe = build([-14, 0, 0]);
  const k = probe.knees[0];
  const mid: V3 = [
    (probe.hips[0][0] + k[0]) / 2,
    (probe.hips[0][1] + k[1]) / 2,
    (probe.hips[0][2] + k[2]) / 2,
  ];
  return build([mid[0] + 1, mid[1] + 7, mid[2] + 2]);
}

/* ------------------------------------------------------------------ */
/* Cable glute kickback                                                */
/* ------------------------------------------------------------------ */

/** The tower the lifter faces: column z, the hand bar's height above the
 *  shoulder line, and the low pulley (cm). */
export const KICK_LEAN = 24;
export const KICK_HIP_Z = -4;
export const KICK_KICK = 38; // degrees the working leg ends behind vertical
export const KICK_TOWER_Z = 68;
export const KICK_PULLEY = { y: 14, z: KICK_TOWER_Z - 4 };

/** Hip/shoulder of the kickback stance: hinged forward and held there. */
function kickStance() {
  const hip = { y: hipHeight(87.6, -KICK_HIP_Z, 1), z: KICK_HIP_Z };
  const shoulder = {
    y: hip.y + BODY.torso * cos(KICK_LEAN),
    z: hip.z + BODY.torso * sin(KICK_LEAN),
  };
  return { hip, shoulder };
}

/** Cable glute kickback: hinged forward holding the tower, the standing leg
 *  stays put while the working leg (near side) kicks straight back and up
 *  with the torso and hips held still. */
export function cableKickbackPose(depth: number): FigurePose {
  const e = smooth(depth);
  const { hip, shoulder } = kickStance();
  const L = hip.y - ANKLE_Y;
  const alpha = KICK_KICK * e;
  const kick: V3 = [11, hip.y - L * cos(alpha), hip.z - L * sin(alpha)];
  const hold = shoulder.y - 16;
  const holdZ = shoulder.z + 46;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, KICK_LEAN * 0.7),
    ankleZ: 0,
    footHalf: 11,
    ankle: (s) => (s > 0 ? kick : [-11, ANKLE_Y, 0]),
    foot: (s) => {
      if (s < 0) return { floor: 0, dir: 1 };
      // The working foot hangs off the shin once it leaves the floor.
      const t = clamp01((kick[1] - ANKLE_Y) / 6);
      return {
        floor: Math.max(0, kick[1] - ANKLE_Y),
        dir: 1,
        angle: -(alpha + 10) * t,
        drop: ANKLE_Y * (1 - t),
      };
    },
    wrist: (s) => [s * 14, hold, holdZ],
    bar: [0, hold, holdZ],
    kneePole: (s) => (s > 0 ? [0, -0.6, 0.8] : forwardKnees(s)),
    elbowPole: (s) => [s * 0.4, -1, -0.2],
  });
}

/* ------------------------------------------------------------------ */
/* Reverse pec deck                                                    */
/* ------------------------------------------------------------------ */

export const REVDECK_HIP = { y: 53, z: 0 };
export const REVDECK_LEAN = 8;

/** Reverse pec deck: chest on the pad, upper arms at shoulder height, the
 *  nearly straight arms sweep back and out until they are in line with the
 *  shoulders. */
export function reversePecDeckPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = REVDECK_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(REVDECK_LEAN),
    z: hip.z + BODY.torso * sin(REVDECK_LEAN),
  };
  const R = 51;
  const psi = lerp(-6, 95, e); // degrees from straight ahead, towards the side
  const dir = (s: -1 | 1): V3 => [s * sin(psi), 0, cos(psi)];
  const wrist = (s: -1 | 1): V3 => {
    const v = dir(s);
    return [s * BODY.shoulderHalf + R * v[0], shoulder.y - 1, shoulder.z + R * v[2]];
  };
  const mid = wrist(1);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 14),
    ankleZ: 42,
    footHalf: 22,
    wrist,
    bar: [0, mid[1], mid[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    // The elbows lead: they stay a touch behind the line from shoulder to hand.
    elbowPole: (s) => {
      const v = dir(s);
      return [s * v[2], -0.15, -v[0] * s * s];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W8: Record<string, ExerciseAnimationSpec> = {
  "cable-straight-arm-pulldown": {
    figure: {
      pose: straightArmPulldownPose,
      implement: "w8-straight-bar",
      furniture: "w8-sap-tower",
      scale: 0.95,
      centerZ: 50,
      pulley: SAP_PULLEY,
    },
    labels: label("Straight-arm pulldown", "Pulldown met gestrekte armen"),
    phases: {
      en: {
        lower: "Sweep the bar down in an arc, arms almost straight",
        touch: "Bar at your thighs, lats squeezed",
        press: "Let the bar rise back up slowly",
        lockout: "Arms long and high, lats stretched",
      },
      nl: {
        lower: "Haal de stang in een boog omlaag, armen bijna gestrekt",
        touch: "Stang bij je dijen, lats samengeknepen",
        press: "Laat de stang langzaam weer omhoog komen",
        lockout: "Lange armen hoog boven je, lats gerekt",
      },
    },
    cues: {
      en: [
        "Face the high pulley, hinge slightly forward from the hips and hold that angle.",
        "Take the bar with straight arms and keep only a tiny bend in your elbows.",
        "Pull the bar down in an arc to your thighs, driving with your lats rather than your triceps.",
        "Squeeze at the bottom, then let the bar rise back up slowly while your torso stays still.",
      ],
      nl: [
        "Sta met je gezicht naar de hoge katrol, hinge licht voorover vanuit je heupen en houd die hoek vast.",
        "Pak de stang met gestrekte armen en houd maar een heel kleine buiging in je ellebogen.",
        "Haal de stang in een boog naar je dijen en werk met je lats in plaats van je triceps.",
        "Knijp onderin even aan en laat de stang dan langzaam weer omhoog komen terwijl je romp stil blijft.",
      ],
    },
  },
  "single-arm-high-cable-fly": {
    figure: {
      pose: singleArmHighFlyPose,
      implement: "w8-hi-handle",
      furniture: "w8-hi-tower",
      scale: 1.0,
      centerZ: 8,
      pulley: { y: HIFLY_TOWER.y, z: HIFLY_TOWER.z },
    },
    labels: label("Single-arm high cable fly", "Cable fly met een arm vanaf boven"),
    phases: {
      en: {
        lower: "Sweep the handle down and across your body",
        touch: "Hand at your opposite hip, chest squeezed",
        press: "Open back up slowly, elbow still soft",
        lockout: "Arm out and up, chest stretched",
      },
      nl: {
        lower: "Zwaai het handvat omlaag en over je lichaam heen",
        touch: "Hand bij je andere heup, borst samengeknepen",
        press: "Ga langzaam weer open, elleboog blijft zacht",
        lockout: "Arm zijwaarts en omhoog, borst gerekt",
      },
    },
    cues: {
      en: [
        "Stand side-on to the high pulley with a slight forward lean and soft knees.",
        "Take the handle with the arm nearest the tower and keep a small, fixed bend in your elbow.",
        "Sweep your arm down and across your body until your hand reaches your opposite hip.",
        "Squeeze your chest for a moment, then open back up slowly without turning your torso.",
      ],
      nl: [
        "Sta zijwaarts naast de hoge katrol met een lichte voorover hang en zachte knieën.",
        "Pak het handvat met de arm die het dichtst bij de toren zit en houd een kleine, vaste buiging in je elleboog.",
        "Zwaai je arm omlaag en over je lichaam heen tot je hand bij je andere heup is.",
        "Knijp even je borst samen en ga dan langzaam weer open zonder je romp mee te draaien.",
      ],
    },
  },
  "low-to-high-cable-fly": {
    figure: {
      pose: lowToHighFlyPose,
      implement: "w8-low-cable",
      furniture: "w8-low-towers",
      scale: 1.0,
      centerZ: 12,
      pulley: LOWFLY_PULLEY,
    },
    labels: label("Low-to-high cable fly", "Cable fly van laag naar hoog"),
    phases: {
      en: {
        lower: "Sweep your hands up and together",
        touch: "Hands meet in front of your chin",
        press: "Lower slowly back out and down",
        lockout: "Arms low and wide, chest stretched",
      },
      nl: {
        lower: "Zwaai je handen omhoog en naar elkaar toe",
        touch: "Handen ontmoeten elkaar voor je kin",
        press: "Laat langzaam weer naar buiten en omlaag zakken",
        lockout: "Armen laag en wijd, borst gerekt",
      },
    },
    cues: {
      en: [
        "Set both pulleys low and stand between them with a slight forward lean and soft knees.",
        "Keep a small, fixed bend in your elbows and your palms facing up and in.",
        "Sweep your hands up and together in a wide arc until they meet at chin height.",
        "Lift with your chest rather than your shoulders, then lower slowly and keep the tension on.",
      ],
      nl: [
        "Zet beide katrollen laag en sta ertussen met een lichte voorover hang en zachte knieën.",
        "Houd een kleine, vaste buiging in je ellebogen en je handpalmen omhoog en naar binnen.",
        "Zwaai je handen in een brede boog omhoog en naar elkaar toe tot ze op kinhoogte samenkomen.",
        "Til met je borst in plaats van je schouders en laat dan langzaam zakken met spanning op de kabel.",
      ],
    },
  },
  "single-arm-cable-row": {
    figure: {
      pose: singleArmCableRowPose,
      implement: "w8-row-handle",
      furniture: "w4-row-seat",
      scale: 1.12,
      centerZ: 56,
      pulley: ROW_PULLEY,
    },
    labels: label("Single-arm seated cable row", "Zittend roeien met een arm aan de kabel"),
    phases: {
      en: {
        lower: "Row the handle to your hip, elbow past your torso",
        touch: "Elbow behind you, shoulder blade squeezed",
        press: "Let the handle go forward slowly",
        lockout: "Arm long, shoulder reaching forward",
      },
      nl: {
        lower: "Roei het handvat naar je heup, elleboog langs je romp",
        touch: "Elleboog achter je, schouderblad samengeknepen",
        press: "Laat het handvat langzaam naar voren gaan",
        lockout: "Lange arm, schouder naar voren gestrekt",
      },
    },
    cues: {
      en: [
        "Sit tall with your feet flat on the platform and your knees slightly bent.",
        "Hold the handle in one hand and rest the other on your thigh, keeping your torso square.",
        "Row the handle to your hip and drive your elbow back past your body.",
        "Squeeze your shoulder blade, then let the handle go forward slowly until your arm is long.",
      ],
      nl: [
        "Zit rechtop met je voeten plat op het platform en je knieën licht gebogen.",
        "Houd het handvat in een hand en leg de andere op je bovenbeen, met je romp recht naar voren.",
        "Roei het handvat naar je heup en duw je elleboog langs je lichaam naar achteren.",
        "Knijp je schouderblad samen en laat het handvat dan langzaam naar voren gaan tot je arm lang is.",
      ],
    },
  },
  "cable-kickback": {
    figure: {
      pose: cableKickbackPose,
      implement: "w8-kick-strap",
      furniture: "w8-kick-tower",
      scale: 1.1,
      centerZ: 4,
      pulley: KICK_PULLEY,
    },
    labels: label("Cable glute kickback", "Kabel kickback voor je billen"),
    phases: {
      en: {
        lower: "Kick the leg back and up, knee almost straight",
        touch: "Leg in line with your torso, glute squeezed",
        press: "Bring the leg back under you slowly",
        lockout: "Foot back under your hip, cable tight",
      },
      nl: {
        lower: "Schop je been naar achteren en omhoog, knie bijna gestrekt",
        touch: "Been in lijn met je romp, bil samengeknepen",
        press: "Breng je been langzaam terug onder je heup",
        lockout: "Voet weer onder je heup, kabel strak",
      },
    },
    cues: {
      en: [
        "Clip the ankle strap to the low pulley and hold the tower with both hands.",
        "Lean forward from the hips with a soft knee in your standing leg.",
        "Kick the working leg straight back and up, without arching your lower back.",
        "Squeeze your glute at the top, then return slowly and keep your hips square.",
      ],
      nl: [
        "Klik de enkelband aan de lage katrol en houd de toren met beide handen vast.",
        "Leun voorover vanuit je heupen met een zachte knie in je standbeen.",
        "Schop je werkbeen recht naar achteren en omhoog, zonder je onderrug te hol te trekken.",
        "Knijp bovenin je bil samen en keer langzaam terug met je heupen recht naar voren.",
      ],
    },
  },
  "reverse-pec-deck": {
    figure: {
      pose: reversePecDeckPose,
      implement: "none",
      furniture: "w8-rev-deck",
      scale: 1.1,
      centerZ: 22,
    },
    labels: label("Reverse pec deck", "Omgekeerde pec deck"),
    phases: {
      en: {
        lower: "Sweep your arms back and out",
        touch: "Arms in line with your shoulders, rear delts squeezed",
        press: "Bring the handles forward slowly",
        lockout: "Arms long in front of you, chest on the pad",
      },
      nl: {
        lower: "Zwaai je armen naar achteren en naar buiten",
        touch: "Armen in lijn met je schouders, achterkant schouders samengeknepen",
        press: "Breng de handvatten langzaam naar voren",
        lockout: "Lange armen voor je, borst tegen het kussen",
      },
    },
    cues: {
      en: [
        "Sit facing the pad with your chest against it and the handles at shoulder height.",
        "Keep a slight bend in your elbows and your shoulders pulled down.",
        "Lead with your elbows and sweep your arms back and out in a wide arc.",
        "Stop when your arms are in line with your shoulders, then return slowly without shrugging.",
      ],
      nl: [
        "Zit met je gezicht naar het kussen, je borst ertegenaan en de handvatten op schouderhoogte.",
        "Houd een lichte buiging in je ellebogen en je schouders omlaag.",
        "Laat je ellebogen het werk leiden en zwaai je armen in een brede boog naar achteren en naar buiten.",
        "Stop als je armen in lijn met je schouders zijn en keer dan langzaam terug zonder je schouders op te trekken.",
      ],
    },
  },
};
