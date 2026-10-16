import { machineShoulderPressPose } from "./exerciseAnimationW6";
import { machineRowPose } from "./exerciseAnimationW4";
import {
  ANKLE_Y,
  ARM,
  BODY,
  SEAT_HIP_Y,
  assemble,
  cos,
  forwardKnees,
  headFrom,
  label,
  lerp,
  lerp3,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W13 (plate-loaded and selectorized press / row machines,
 *  cable chest press), merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/* ------------------------------------------------------------------ */
/* Seated chest press (flat and incline)                               */
/* ------------------------------------------------------------------ */

interface PressGeo {
  hip: { y: number; z: number };
  /** Back pad recline from vertical (degrees). */
  back: number;
  /** Elevation of the press path above horizontal (degrees). */
  path: number;
  /** Handle start (stretch): distance in front of the torso line and along it
   *  (negative = below the shoulder joint), and half the handle spacing. */
  fwd: number;
  up: number;
  x0: number;
  /** Half the handle spacing at the end of the press, and the shoulder-to-hand
   *  reach there (just short of lockout). */
  x1: number;
  reach: number;
}

/** Everything about a seated press machine pose that the furniture needs too. */
export function pressGeometry(g: PressGeo) {
  const shoulder = {
    y: g.hip.y + BODY.torso * cos(g.back),
    z: g.hip.z - BODY.torso * sin(g.back),
  };
  const t: [number, number] = [cos(g.back), -sin(g.back)]; // up the torso (y, z)
  const n: [number, number] = [sin(g.back), cos(g.back)]; // in front of the chest (y, z)
  const dy0 = g.fwd * n[0] + g.up * t[0];
  const dz0 = g.fwd * n[1] + g.up * t[1];
  const dx1 = g.x1 - BODY.shoulderHalf;
  const uy = sin(g.path);
  const uz = cos(g.path);
  // travel along the path so that the end of the press is `reach` from the shoulder
  const b = dy0 * uy + dz0 * uz;
  const c = dy0 * dy0 + dz0 * dz0 + dx1 * dx1 - g.reach * g.reach;
  const travel = -b + Math.sqrt(b * b - c);
  const start: V3 = [g.x0, shoulder.y + dy0, shoulder.z + dz0];
  const end: V3 = [g.x1, shoulder.y + dy0 + travel * uy, shoulder.z + dz0 + travel * uz];
  return { shoulder, start, end, u: [0, uy, uz] as V3, travel };
}

function seatedPress(g: PressGeo, depth: number): FigurePose {
  const { shoulder, start, end, u } = pressGeometry(g);
  const e = smooth(depth);
  const w = lerp3(end, start, e);
  const S: V3 = [BODY.shoulderHalf, shoulder.y, shoulder.z];
  const mid: V3 = [(S[0] + w[0]) / 2, (S[1] + w[1]) / 2, (S[2] + w[2]) / 2];
  // The forearm lies along the press direction, the elbow hangs out and back.
  const guess: V3 = [w[0] + 0.12 * 26, w[1] - u[1] * 26, w[2] - u[2] * 26];
  const off = unit(sub3(guess, mid));
  void off;
  // The elbow hangs below and behind the hands at the stretch and drops
  // straight down as the arms extend.
  const rest: V3 = unit([0.3, -1, -0.1]);
  const low: V3 = unit([0.5, -0.3, -0.5]);
  const pole: V3 = lerp3(rest, low, e);
  return assemble({
    hip: g.hip,
    shoulder,
    head: headFrom(shoulder, -g.back * 0.7),
    ankleZ: 40,
    footHalf: 24,
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * pole[0], pole[1], pole[2]],
  });
}

export const CHEST_PRESS: PressGeo = {
  hip: { y: 52, z: 0 },
  back: 8,
  path: 0,
  fwd: 22,
  up: -10,
  x0: 34,
  x1: 26,
  reach: 52.8,
};

export const INCLINE_PRESS: PressGeo = {
  hip: { y: 48, z: 0 },
  back: 38,
  path: 40,
  fwd: 20,
  up: -9,
  x0: 34,
  x1: 25,
  reach: 52.8,
};

/** Seated chest press: back on a slightly reclined pad, handles at mid-chest
 *  pressed straight forward to just short of lockout. Depth 0 = arms almost
 *  straight, 1 = handles back at the chest (full stretch). */
export function chestPressPose(depth: number): FigurePose {
  return seatedPress(CHEST_PRESS, depth);
}

/** Incline chest press: back pad reclined 38 degrees, handles from the upper
 *  chest pressed up and forward along a 40 degree path. */
export function inclineChestPressPose(depth: number): FigurePose {
  return seatedPress(INCLINE_PRESS, depth);
}

/* ------------------------------------------------------------------ */
/* Plate-loaded high row                                               */
/* ------------------------------------------------------------------ */

export const HIGH_ROW_HIP = { y: 50, z: 0 };
export const HIGH_ROW_LEAN = -5;
export const HIGH_ROW_SHOULDER = {
  y: HIGH_ROW_HIP.y + BODY.torso * cos(HIGH_ROW_LEAN),
  z: HIGH_ROW_HIP.z + BODY.torso * sin(HIGH_ROW_LEAN),
};

/** Hand position relative to the shoulder joint (x already includes the shoulder offset). */
export function highRowHand(e: number): V3 {
  const S = HIGH_ROW_SHOULDER;
  return [lerp(29, 21, e), S.y + lerp(40, -30, e), S.z + lerp(30, 8, e) + 8 * sin(180 * e)];
}

/** Plate-loaded high row: seated tall with the chest on the front pad, the
 *  handles start high and in front of the head and are pulled down and back to
 *  the lower ribs. Depth 0 = arms stretched up, 1 = handles at the ribs. */
export function highRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const w = highRowHand(e);
  const shoulder = HIGH_ROW_SHOULDER;
  const rest: V3 = unit([0.4, -1, -0.2]);
  const back: V3 = unit([0.5, -0.1, -1]);
  const pole: V3 = lerp3(rest, back, Math.min(1, e * 1.3));
  return assemble({
    hip: HIGH_ROW_HIP,
    shoulder,
    head: headFrom(shoulder, HIGH_ROW_LEAN * 0.5),
    ankleZ: 40,
    footHalf: 24,
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * pole[0], pole[1], pole[2]],
  });
}

/* ------------------------------------------------------------------ */
/* Chest-supported T-bar row machine                                   */
/* ------------------------------------------------------------------ */

export const TBAR_LEAN = 46;
/** Height of the foot platform. */
export const TBAR_PLATFORM = 8;
const TB_ANKLE = { y: TBAR_PLATFORM + ANKLE_Y, z: 0 };
const TB_HIP_Z = -26;
export const TBAR_HIP = {
  y: TB_ANKLE.y + Math.sqrt(82 * 82 - (TB_HIP_Z - TB_ANKLE.z) ** 2 - 4 * 4),
  z: TB_HIP_Z,
};
export const TBAR_SHOULDER = {
  y: TBAR_HIP.y + BODY.torso * cos(TBAR_LEAN),
  z: TBAR_HIP.z + BODY.torso * sin(TBAR_LEAN),
};
export const TBAR_GRIP = 9;
/** Handle at the dead hang and at the lower chest (just under the pad). */
export function tBarHandle(e: number): V3 {
  const S = TBAR_SHOULDER;
  const dx = TBAR_GRIP - BODY.shoulderHalf;
  const hang: V3 = [TBAR_GRIP, S.y - Math.sqrt((ARM - 0.6) ** 2 - dx * dx - 3 * 3), S.z + 3];
  // lower chest: 24 cm down the torso, 11 cm in front of its axis
  const a = 24;
  const front = 11;
  const chest: V3 = [
    TBAR_GRIP,
    S.y - a * cos(TBAR_LEAN) - front * sin(TBAR_LEAN),
    S.z - a * sin(TBAR_LEAN) + front * cos(TBAR_LEAN),
  ];
  return lerp3(hang, chest, e);
}

/** Chest-supported T-bar row: torso held at 46 degrees on the pad, feet on the
 *  platform, the handle rows from a dead hang to the lower chest, elbows back.
 *  Depth 0 = arms hanging, 1 = handle at the lower chest. */
export function tBarRowMachinePose(depth: number): FigurePose {
  const e = smooth(depth);
  const w = tBarHandle(e);
  const shoulder = TBAR_SHOULDER;
  return assemble({
    hip: TBAR_HIP,
    shoulder,
    head: headFrom(shoulder, TBAR_LEAN * 0.55),
    ankleZ: TB_ANKLE.z,
    footHalf: 14,
    ankle: (s) => [s * 14, TB_ANKLE.y, TB_ANKLE.z],
    foot: () => ({ floor: TBAR_PLATFORM, dir: 1 }),
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * lerp(0.3, 0.6, e), 0.3, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Machine lateral raise                                               */
/* ------------------------------------------------------------------ */

export const LATRAISE_HIP = { y: SEAT_HIP_Y, z: 0 };
const LR_BACK = 6;
export const LATRAISE_SHOULDER = {
  y: LATRAISE_HIP.y + BODY.torso * cos(LR_BACK),
  z: LATRAISE_HIP.z - BODY.torso * sin(LR_BACK),
};
/** Arm abduction (degrees from hanging) at the start and the top of the lift. */
export const LATRAISE_FROM = 14;
export const LATRAISE_TO = 82;

/** Elbow of the working arm for an abduction angle `a` (degrees from hanging). */
export function lateralRaiseElbow(a: number, s: -1 | 1 = 1): V3 {
  const S = LATRAISE_SHOULDER;
  return [s * (BODY.shoulderHalf + 29 * sin(a)), S.y - 29 * cos(a), S.z + 1];
}

/** Machine lateral raise: seated against the back pad, upper arms push the
 *  pads out and up from the sides to shoulder height, elbows bent about 90
 *  degrees with the forearms pointing forward. Depth 0 = arms at the sides,
 *  1 = upper arms at shoulder height. */
export function machineLateralRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const a = lerp(LATRAISE_FROM, LATRAISE_TO, e);
  const shoulder = LATRAISE_SHOULDER;
  const wrist = (s: -1 | 1): V3 => {
    const el = lateralRaiseElbow(a, s);
    return [el[0] - s * 4.5, el[1] + 1, el[2] + 25.5];
  };
  const mid = wrist(1);
  return assemble({
    hip: LATRAISE_HIP,
    shoulder,
    head: headFrom(shoulder, -LR_BACK * 0.5),
    ankleZ: 40,
    footHalf: 24,
    wrist,
    bar: [0, mid[1], mid[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * 0.5, -0.1, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Standing cable chest press                                          */
/* ------------------------------------------------------------------ */

export const CABLE_PRESS_HIP = { y: 85, z: 0 };
const CP_LEAN = 12;
export const CABLE_PRESS_SHOULDER = {
  y: CABLE_PRESS_HIP.y + BODY.torso * cos(CP_LEAN),
  z: CABLE_PRESS_HIP.z + BODY.torso * sin(CP_LEAN),
};
/** The high pulleys stand behind the lifter. */
export const CABLE_PRESS_PULLEY = { y: 170, z: -62 };
export const CABLE_PRESS_FRONT_ANKLE_Z = 20;
export const CABLE_PRESS_BACK_ANKLE_Z = -18;

/** Hand position: beside the chest at the start, together in front of the
 *  sternum at the end of the press. */
export function cablePressHand(e: number): V3 {
  const S = CABLE_PRESS_SHOULDER;
  const dx1 = 4 - BODY.shoulderHalf;
  const dy = -7;
  const dz1 = Math.sqrt(52.4 ** 2 - dx1 * dx1 - dy * dy);
  return [lerp(4, 28, e), S.y + dy, S.z + lerp(dz1, 26, e)];
}

/** Standing cable chest press in a split stance with the back to the high
 *  pulleys: slight forward lean, both hands press out and together in front
 *  of the sternum. Depth 0 = arms nearly straight, 1 = hands at the chest. */
export function cableChestPressPose(depth: number): FigurePose {
  const e = smooth(depth);
  const w = cablePressHand(e);
  const shoulder = CABLE_PRESS_SHOULDER;
  const rest: V3 = unit([0.3, -1, -0.1]);
  const low: V3 = unit([0.5, -0.3, -0.5]);
  const pole: V3 = lerp3(rest, low, e);
  return assemble({
    hip: CABLE_PRESS_HIP,
    shoulder,
    head: headFrom(shoulder, CP_LEAN * 0.5),
    ankleZ: 0,
    footHalf: 12,
    ankle: (s) => [s * 12, ANKLE_Y, s > 0 ? CABLE_PRESS_FRONT_ANKLE_Z : CABLE_PRESS_BACK_ANKLE_Z],
    foot: () => ({ floor: 0, dir: 1 }),
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * pole[0], pole[1], pole[2]],
  });
}

const pressPhases = {
  en: {
    lower: "Let the handles come back to your chest",
    touch: "Full stretch, shoulder blades pinned back",
    press: "Press the handles straight forward",
    lockout: "Arms almost straight, chest tall",
  },
  nl: {
    lower: "Laat de handgrepen terugkomen naar je borst",
    touch: "Volledige rek, schouderbladen naar achteren",
    press: "Duw de handgrepen recht naar voren",
    lockout: "Armen bijna gestrekt, borst omhoog",
  },
};

export const ANIMATIONS_W13: Record<string, ExerciseAnimationSpec> = {
  "plate-chest-press": {
    figure: {
      pose: chestPressPose,
      implement: "none",
      furniture: "w13-plate-chest",
      scale: 1.12,
      centerZ: -22,
    },
    labels: label("Plate-loaded chest press", "Chestpress met platen"),
    phases: pressPhases,
    cues: {
      en: [
        "Adjust the seat so the handles are at mid-chest height, then sit with your back flat against the pad and your feet flat on the floor.",
        "Pin your shoulder blades back and down and grip the handles with your wrists stacked over your elbows.",
        "Press the handles straight forward to just short of lockout. Don't snap your elbows straight.",
        "Control the return until you feel a full stretch across your chest, with your back on the pad.",
      ],
      nl: [
        "Stel het zadel zo in dat de handgrepen op borsthoogte zitten en zit met je rug plat tegen het kussen en je voeten plat op de grond.",
        "Trek je schouderbladen naar achteren en omlaag en pak de handgrepen vast met je polsen boven je ellebogen.",
        "Duw de handgrepen recht naar voren tot net voor volledige strekking. Gooi je ellebogen niet strak.",
        "Laat gecontroleerd terugkomen tot je een volledige rek in je borst voelt, met je rug tegen het kussen.",
      ],
    },
  },
  "machine-chest-press": {
    figure: {
      pose: chestPressPose,
      implement: "none",
      furniture: "w13-stack-chest",
      scale: 1.12,
      centerZ: -22,
    },
    labels: label("Machine chest press", "Chestpress op de machine"),
    phases: pressPhases,
    cues: {
      en: [
        "Set the seat so the handles are at mid-chest height, and sit with your back flat against the pad.",
        "Pin your shoulder blades back and down and grip the handles with your wrists over your elbows.",
        "Press the handles straight forward to just short of lockout.",
        "Control the return to a full stretch without letting the weight stack touch down.",
      ],
      nl: [
        "Stel het zadel zo in dat de handgrepen op borsthoogte zitten en zit met je rug plat tegen het kussen.",
        "Trek je schouderbladen naar achteren en omlaag en pak de handgrepen vast met je polsen boven je ellebogen.",
        "Duw de handgrepen recht naar voren tot net voor volledige strekking.",
        "Laat gecontroleerd terugkomen tot een volledige rek, zonder dat het gewichtenblok neerkomt.",
      ],
    },
  },
  "plate-incline-chest-press": {
    figure: {
      pose: inclineChestPressPose,
      implement: "none",
      furniture: "w13-plate-incline",
      scale: 1.05,
      centerZ: -38,
    },
    labels: label("Plate-loaded incline chest press", "Incline chestpress met platen"),
    phases: {
      en: {
        lower: "Lower the handles back to your upper chest",
        touch: "Full stretch, handles at upper-chest height",
        press: "Press the handles up and forward",
        lockout: "Arms almost straight, shoulders down",
      },
      nl: {
        lower: "Laat de handgrepen terugkomen naar je bovenborst",
        touch: "Volledige rek, handgrepen op bovenborsthoogte",
        press: "Duw de handgrepen omhoog en naar voren",
        lockout: "Armen bijna gestrekt, schouders omlaag",
      },
    },
    cues: {
      en: [
        "Set the seat so the handles start at upper-chest height, and sit with your back against the angled pad.",
        "Pin your shoulder blades back and keep your shoulders down. Don't shrug.",
        "Press the handles up and forward along the path of the machine, to just short of lockout.",
        "Lower under control to a full stretch with your back on the pad.",
      ],
      nl: [
        "Stel het zadel zo in dat de handgrepen op bovenborsthoogte beginnen en zit met je rug tegen het schuine kussen.",
        "Trek je schouderbladen naar achteren en houd je schouders omlaag. Haal ze niet op.",
        "Duw de handgrepen omhoog en naar voren langs het pad van de machine, tot net voor volledige strekking.",
        "Laat gecontroleerd zakken tot een volledige rek, met je rug tegen het kussen.",
      ],
    },
  },
  "plate-shoulder-press": {
    figure: {
      pose: machineShoulderPressPose,
      implement: "w13-plate-press",
      furniture: "upright-bench",
      scale: 1.0,
      centerZ: -24,
    },
    labels: label("Plate-loaded shoulder press", "Schouderpers met platen"),
    phases: {
      en: {
        lower: "Lower the handles to shoulder height",
        touch: "Forearms vertical, back on the pad",
        press: "Press up and slightly together",
        lockout: "Arms long overhead, ribs down",
      },
      nl: {
        lower: "Laat de handgrepen zakken tot schouderhoogte",
        touch: "Onderarmen verticaal, rug tegen het kussen",
        press: "Duw omhoog en iets naar elkaar toe",
        lockout: "Armen gestrekt boven je hoofd, ribben omlaag",
      },
    },
    cues: {
      en: [
        "Set the seat so the handles start at about shoulder height. Sit with your back flat against the pad and your feet flat on the floor.",
        "Grip the handles with your wrists stacked over your elbows and keep your ribcage down.",
        "Press the handles overhead until your arms are almost straight. Don't shrug at the top.",
        "Lower under control back to shoulder height.",
      ],
      nl: [
        "Stel het zadel zo in dat de handgrepen op ongeveer schouderhoogte beginnen. Zit met je rug plat tegen het kussen en je voeten plat op de grond.",
        "Pak de handgrepen vast met je polsen boven je ellebogen en houd je ribbenkast omlaag.",
        "Duw de handgrepen boven je hoofd tot je armen bijna gestrekt zijn. Haal je schouders bovenin niet op.",
        "Laat gecontroleerd zakken tot schouderhoogte.",
      ],
    },
  },
  "plate-row": {
    figure: {
      pose: machineRowPose,
      implement: "none",
      furniture: "w13-plate-row",
      scale: 1.12,
      centerZ: 52,
    },
    labels: label("Plate-loaded row", "Roeien aan de machine met platen"),
    phases: {
      en: {
        lower: "Pull the handles back, elbows behind your torso",
        touch: "Shoulder blades squeezed, chest on the pad",
        press: "Let the handles go forward slowly",
        lockout: "Arms long, shoulders reaching forward",
      },
      nl: {
        lower: "Trek de handgrepen naar achteren, ellebogen langs je romp",
        touch: "Schouderbladen samengeknepen, borst op het kussen",
        press: "Laat de handgrepen langzaam naar voren gaan",
        lockout: "Lange armen, schouders naar voren gestrekt",
      },
    },
    cues: {
      en: [
        "Set the seat so the pad meets your chest and the handles are at chest height. Plant your feet.",
        "Start with long arms and your chest on the pad, shoulders reaching forward.",
        "Lead with your elbows and pull the handles back until your elbows pass your torso.",
        "Squeeze your shoulder blades together, then return to a full stretch without bouncing off the pad.",
      ],
      nl: [
        "Stel het zadel zo in dat het kussen tegen je borst zit en de handgrepen op borsthoogte zijn. Zet je voeten stevig neer.",
        "Begin met lange armen en je borst op het kussen, schouders naar voren gestrekt.",
        "Laat je ellebogen het werk leiden en trek de handgrepen naar achteren tot je ellebogen langs je romp zijn.",
        "Knijp je schouderbladen samen en keer terug tot een volledige rek, zonder van het kussen te stuiteren.",
      ],
    },
  },
  "plate-high-row": {
    figure: {
      pose: highRowPose,
      implement: "none",
      furniture: "w13-high-row",
      scale: 1.05,
      centerZ: 58,
    },
    labels: label("Plate-loaded high row", "High row met platen"),
    phases: {
      en: {
        lower: "Pull the handles down and back to your lower ribs",
        touch: "Elbows behind you, shoulder blades squeezed",
        press: "Let your arms stretch back up slowly",
        lockout: "Arms long overhead, chest up",
      },
      nl: {
        lower: "Trek de handgrepen omlaag en naar achteren tot je onderste ribben",
        touch: "Ellebogen achter je lijf, schouderbladen samengeknepen",
        press: "Laat je armen langzaam weer omhoog rekken",
        lockout: "Armen gestrekt omhoog, borst vooruit",
      },
    },
    cues: {
      en: [
        "Sit tall with your chest on the pad and your feet flat. Reach up and take the handles.",
        "Start with long arms, shoulders pulled down and a slight lean back.",
        "Pull the handles down and back towards your lower ribs, leading with your elbows.",
        "Pause at the squeeze, then let your arms stretch up under control.",
      ],
      nl: [
        "Zit rechtop met je borst op het kussen en je voeten plat. Reik omhoog en pak de handgrepen.",
        "Begin met lange armen, schouders omlaag en een lichte lean naar achteren.",
        "Trek de handgrepen omlaag en naar achteren richting je onderste ribben en laat je ellebogen het werk leiden.",
        "Pauzeer even in de knijp en laat je armen dan gecontroleerd weer omhoog rekken.",
      ],
    },
  },
  "t-bar-row-machine": {
    figure: {
      pose: tBarRowMachinePose,
      implement: "none",
      furniture: "w13-tbar-machine",
      scale: 0.98,
      centerZ: 60,
    },
    labels: label("Chest-supported T-bar row", "T-bar row met borststeun"),
    phases: {
      en: {
        lower: "Row the handles up to your lower chest",
        touch: "Elbows back, shoulder blades squeezed",
        press: "Lower the handles slowly",
        lockout: "Arms long, chest on the pad",
      },
      nl: {
        lower: "Roei de handgrepen naar je onderste borst",
        touch: "Ellebogen naar achteren, schouderbladen samengeknepen",
        press: "Laat de handgrepen langzaam zakken",
        lockout: "Armen gestrekt, borst op het kussen",
      },
    },
    cues: {
      en: [
        "Stand on the platform with your feet planted and knees slightly bent, and lean your chest onto the pad.",
        "Take the handles with straight arms and keep your chest on the pad the whole set.",
        "Row the handles to your lower chest, driving your elbows back past your torso.",
        "Squeeze your shoulder blades together, then lower the handles slowly to straight arms.",
      ],
      nl: [
        "Sta op het platform met je voeten stevig neer en je knieën licht gebogen, en leun met je borst op het kussen.",
        "Pak de handgrepen met gestrekte armen en houd je borst de hele set op het kussen.",
        "Roei de handgrepen naar je onderste borst en duw je ellebogen langs je romp naar achteren.",
        "Knijp je schouderbladen samen en laat de handgrepen dan langzaam zakken tot gestrekte armen.",
      ],
    },
  },
  "machine-lateral-raise": {
    figure: {
      pose: machineLateralRaisePose,
      implement: "none",
      furniture: "w13-lateral-machine",
      scale: 1.1,
      centerZ: -18,
    },
    labels: label("Machine lateral raise", "Zijwaarts heffen op de machine"),
    phases: {
      en: {
        lower: "Raise your arms out to the sides",
        touch: "Elbows at shoulder height, no higher",
        press: "Lower slowly back to your sides",
        lockout: "Arms by your sides, shoulders down",
      },
      nl: {
        lower: "Til je armen zijwaarts omhoog",
        touch: "Ellebogen op schouderhoogte, niet hoger",
        press: "Laat langzaam terugzakken langs je lichaam",
        lockout: "Armen langs je lichaam, schouders omlaag",
      },
    },
    cues: {
      en: [
        "Set the seat so your shoulders are level with the machine's pivot, and sit with your back against the pad.",
        "Rest your forearms against the pads with your elbows bent about 90 degrees.",
        "Raise your elbows out to the sides until your upper arms reach shoulder height. Don't shrug.",
        "Pause, then lower slowly without letting the weights touch down.",
      ],
      nl: [
        "Stel het zadel zo in dat je schouders op gelijke hoogte zitten met het draaipunt van de machine en zit met je rug tegen het kussen.",
        "Laat je onderarmen tegen de kussens rusten met je ellebogen ongeveer 90 graden gebogen.",
        "Til je ellebogen zijwaarts tot je bovenarmen schouderhoogte bereiken. Haal je schouders niet op.",
        "Pauzeer even en laat dan langzaam zakken zonder dat de gewichten neerkomen.",
      ],
    },
  },
  "cable-chest-press": {
    figure: {
      pose: cableChestPressPose,
      implement: "w4-cross-cable",
      furniture: "w4-cross-towers",
      scale: 1.0,
      centerZ: -9,
      pulley: CABLE_PRESS_PULLEY,
    },
    labels: label("Standing cable chest press", "Staande chestpress aan de kabel"),
    phases: {
      en: {
        lower: "Let the handles come back to your chest",
        touch: "Elbows back, chest open, cables tight",
        press: "Press the handles forward and together",
        lockout: "Arms almost straight, hands in front of your sternum",
      },
      nl: {
        lower: "Laat de handgrepen terugkomen naar je borst",
        touch: "Ellebogen naar achteren, borst open, kabels strak",
        press: "Duw de handgrepen naar voren en naar elkaar toe",
        lockout: "Armen bijna gestrekt, handen voor je borstbeen",
      },
    },
    cues: {
      en: [
        "Set both pulleys high and stand with your back to them in a split stance, one foot forward, with a slight lean forward.",
        "Hold the handles at chest height with your elbows bent and back.",
        "Press both handles forward and together until your hands meet in front of your sternum.",
        "Return slowly until you feel a stretch across your chest, keeping your torso still.",
      ],
      nl: [
        "Zet beide katrollen hoog en sta met je rug naar de katrollen in een spreidstand, één voet voor, met een lichte lean naar voren.",
        "Houd de handgrepen op borsthoogte met je ellebogen gebogen en naar achteren.",
        "Duw beide handgrepen naar voren en naar elkaar toe tot je handen voor je borstbeen samenkomen.",
        "Keer langzaam terug tot je een rek over je borst voelt en houd je romp stil.",
      ],
    },
  },
};
