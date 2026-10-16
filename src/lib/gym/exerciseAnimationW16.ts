import {
  ANKLE_Y,
  ARM,
  BODY,
  ROW_BENCH_Y,
  SEAT_HIP_Y,
  STAND_HIP_Y,
  STAND_SHOULDER_Y,
  assemble,
  cos,
  forwardKnees,
  label,
  lerp,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W16, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** Longest shoulder-to-wrist distance used for a locked-out arm (ARM is 55). */
const REACH = ARM - 0.3;

/* ------------------------------------------------------------------ */
/* Close-grip lat pulldown (V-handle)                                  */
/* ------------------------------------------------------------------ */

/** Cable pulley of the pulldown machine in the side view (cm), as drawn by the
 *  built-in `pulldown` furniture. */
export const CGP_PULLEY = { y: 170, z: 16 };
/** Each hand of the V-handle sits this far from the midline (neutral grip). */
export const CGP_GRIP = 8;
/** Handle z relative to the shoulder joint: at the top (long arms, in front of the
 *  face) and at the bottom (touching the upper chest). */
const CGP_TOP_Z = 24;
/** Shoulder-to-wrist distance at the top: long arms with a hair of slack. */
const CGP_TOP_REACH = 52.5;
const CGP_BOTTOM_Z = 17;
const CGP_BOTTOM_UP = -9; // handle height relative to the shoulder joint at the chest
/** Length of the V-handle's grip rod (along z) and how far its apex sits above it. */
export const CGP_ROD = 13;
export const CGP_APEX = 13;

/** Close-grip lat pulldown: seated with the thighs under the pad and a slight
 *  lean back, hands on a V-handle (neutral grip, close together). The handle
 *  starts above the head at full stretch and is pulled to the upper chest while
 *  the elbows travel down in front of the body and finish beside the ribs.
 *  Depth 0 = arms long, 1 = handle on the upper chest. */
export function closeGripPulldownPose(depth: number): FigurePose {
  const hip = { y: 50, z: 0 };
  const lean = lerp(12, 18, depth);
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z - BODY.torso * sin(lean),
  };
  const dx = BODY.shoulderHalf - CGP_GRIP;
  const topY = shoulder.y + Math.sqrt(CGP_TOP_REACH ** 2 - dx * dx - CGP_TOP_Z * CGP_TOP_Z);
  // The hands drop quickly at first and settle onto the chest.
  const e = 1 - (1 - depth) * (1 - depth);
  const wy = lerp(topY, shoulder.y + CGP_BOTTOM_UP, e);
  const wz = shoulder.z + lerp(CGP_TOP_Z, CGP_BOTTOM_Z, depth);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z + 22 * sin(-lean * 0.4) + 3],
    ankleZ: 42,
    footHalf: 18,
    wrist: (s) => [s * CGP_GRIP, wy, wz],
    bar: [0, wy, wz],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    // Elbows hang down: in front of the shoulders early on, beside the ribs at the end.
    elbowPole: (s) => [s * 0.5, -1, 0],
  });
}

/* ------------------------------------------------------------------ */
/* Barbell shrug                                                       */
/* ------------------------------------------------------------------ */

/** Hands just outside the shoulders; the bar hangs against the front of the thighs. */
export const BBS_GRIP = 26;
export const BBS_BAR_Z = 8;
export const BBS_RISE = 8;

/** Barbell shrug: standing tall, the bar hanging in front of the thighs on
 *  straight arms; the shoulders rise straight up about 8 cm toward the ears
 *  (no rolling), the head and hips stay still. Depth 0 = hanging, 1 = top. */
export function barbellShrugPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y + BBS_RISE * e, z: 0 };
  const dx = BBS_GRIP - BODY.shoulderHalf;
  const wy = shoulder.y - Math.sqrt((ARM - 0.05) ** 2 - dx * dx - BBS_BAR_Z * BBS_BAR_Z);
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: [0, STAND_SHOULDER_Y + 22, 0],
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * BBS_GRIP, wy, BBS_BAR_Z],
    bar: [0, wy, BBS_BAR_Z],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Upright rows (dumbbells and low cable)                              */
/* ------------------------------------------------------------------ */

interface UprightRow {
  /** Half the distance between the hands at the bottom and at the top. */
  grip0: number;
  grip1: number;
  /** Hand z (in front of the body) at the bottom and at the top. */
  z0: number;
  z1: number;
  /** How far below the shoulder joint the hands finish. */
  top: number;
  /** Elbow offset from the shoulder at the top; the elbows bend towards it all rep. */
  pole: V3;
}

/** Elbow offset from the shoulder at the top: out to the side (about 25 cm), at
 *  shoulder height and a little in front. It also steers the elbow all rep. */
const UPRIGHT_ELBOW: V3 = [25.5, -2, 13.6];
export const DB_UPRIGHT: UprightRow = {
  grip0: 16,
  grip1: 23,
  z0: 12,
  z1: 16.5,
  top: 16.5,
  pole: UPRIGHT_ELBOW,
};
export const CABLE_UPRIGHT: UprightRow = {
  grip0: 16,
  grip1: 21,
  z0: 10,
  z1: 15,
  top: 16,
  pole: UPRIGHT_ELBOW,
};

/** Standing tall, the hands hang in front of the thighs on straight arms and
 *  are pulled up along the body to chest height with the elbows leading up and
 *  out (never above the shoulders, wrists below the elbows). */
function uprightRow(depth: number, c: UprightRow): FigurePose {
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const dx0 = c.grip0 - BODY.shoulderHalf;
  const y0 = shoulder.y - Math.sqrt(REACH * REACH - dx0 * dx0 - c.z0 * c.z0);
  const y1 = shoulder.y - c.top;
  const x = lerp(c.grip0, c.grip1, depth);
  const y = lerp(y0, y1, depth);
  const z = lerp(c.z0, c.z1, depth);
  const pole = (s: -1 | 1): V3 => [s * c.pole[0], c.pole[1], c.pole[2]];
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: [0, STAND_SHOULDER_Y + 22, 0],
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * x, y, z],
    bar: [0, y, z],
    kneePole: forwardKnees,
    elbowPole: pole,
  });
}

export const dbUprightRowPose = (depth: number) => uprightRow(depth, DB_UPRIGHT);
export const cableUprightRowPose = (depth: number) => uprightRow(depth, CABLE_UPRIGHT);

/** Low pulley of the cable upright row (cm): the tower stands in front of the lifter. */
export const CUR_PULLEY = { y: 16, z: 46 };

/* ------------------------------------------------------------------ */
/* Close-grip barbell bench press                                      */
/* ------------------------------------------------------------------ */

/** Height of a lying figure's shoulder and hip joints above the floor (flat
 *  bench top 45 plus 10), as in the dumbbell bench press. */
const LYING_Y = ROW_BENCH_Y + 10;
const LYING_SHOULDER_Z = -8;
const LYING_HIP_Z = LYING_SHOULDER_Z + BODY.torso;

/** Hands just inside shoulder width (the shoulder joints are 19 cm out). */
export const CGB_GRIP = 16;
const CGB_BOTTOM_Y = LYING_Y + 12;
const CGB_DX = CGB_GRIP - BODY.shoulderHalf;
const CGB_DY = CGB_BOTTOM_Y - 26 - LYING_Y;
/** Bottom: the forearm is vertical, so the elbow sits right under the wrist and
 *  the bar lands on the lower chest. */
const CGB_DZ = Math.sqrt(29 * 29 - CGB_DX * CGB_DX - CGB_DY * CGB_DY);
export const CGB_BOTTOM_Z = LYING_SHOULDER_Z + CGB_DZ;
export const CGB_TOP_Z = LYING_SHOULDER_Z + 4;
export const CGB_BOTTOM_Y_OUT = CGB_BOTTOM_Y;
export const CGB_TOP_Y =
  LYING_Y + Math.sqrt(REACH * REACH - CGB_DX * CGB_DX - (CGB_TOP_Z - LYING_SHOULDER_Z) ** 2);

/** Close-grip bench press: lying on a flat bench, feet flat, hands just inside
 *  shoulder width, elbows tucked beside the ribs; the bar goes to the lower
 *  chest and back up over the shoulders. Depth 0 = lockout, 1 = bar on the chest. */
export function closeGripBenchPose(depth: number): FigurePose {
  const y = lerp(CGB_TOP_Y, CGB_BOTTOM_Y, depth);
  const z = lerp(CGB_TOP_Z, CGB_BOTTOM_Z, Math.pow(depth, 1.6));
  return assemble({
    hip: { y: LYING_Y, z: LYING_HIP_Z },
    shoulder: { y: LYING_Y, z: LYING_SHOULDER_Z },
    head: [0, LYING_Y, LYING_SHOULDER_Z - 22],
    ankleZ: LYING_HIP_Z + 26,
    footHalf: 28,
    wrist: (s) => [s * CGB_GRIP, y, z],
    bar: [0, y, z],
    kneePole: (s) => [s * 0.3, 1, 0.2],
    elbowPole: (s) => [s * CGB_DX, CGB_DY, CGB_DZ],
  });
}

/* ------------------------------------------------------------------ */
/* Hip abduction and adduction machines                                */
/* ------------------------------------------------------------------ */

const HM_BACK = 10;
export const HM_HIP = { y: SEAT_HIP_Y, z: 0 };
/** The foot rests ride on the levers: a 3 cm plate under each foot. */
export const HM_PLATE = 3;
/** Thigh swing from straight ahead (degrees), closed and fully open. */
export const HM_PHI_CLOSED = 3;
export const HM_PHI_OPEN = 30;

/** Seated on a hip abduction or adduction machine: back on the pad, hips fixed,
 *  hands on the side grips, thighs about level with the shins vertical and the
 *  feet on the foot rests. The thighs swing sideways about the hips (knees
 *  apart or together), the foot rests travelling with them. `open` is 0 with the
 *  knees together and 1 with them wide apart. */
export function hipMachinePose(open: number): FigurePose {
  const phi = lerp(HM_PHI_CLOSED, HM_PHI_OPEN, open);
  const shoulder = {
    y: HM_HIP.y + BODY.torso * cos(HM_BACK),
    z: HM_HIP.z - BODY.torso * sin(HM_BACK),
  };
  const plateY = ANKLE_Y + HM_PLATE;
  // Thigh direction: swung out by phi, tilted up so the knee is 43 cm above the ankle.
  const tilt = Math.asin((plateY + BODY.shin - HM_HIP.y) / BODY.thigh);
  const knee = (s: -1 | 1): V3 => [
    s * BODY.hipHalf + s * BODY.thigh * cos(tilt * (180 / Math.PI)) * sin(phi),
    HM_HIP.y + BODY.thigh * Math.sin(tilt),
    HM_HIP.z + BODY.thigh * cos(tilt * (180 / Math.PI)) * cos(phi),
  ];
  const grip = (s: -1 | 1): V3 => [s * 25, HM_HIP.y + 5, HM_HIP.z + 8];
  return assemble({
    hip: HM_HIP,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 0,
    footHalf: 0,
    ankle: (s) => {
      const k = knee(s);
      return [k[0], plateY, k[2]];
    },
    foot: () => ({ floor: HM_PLATE, dir: 1 }),
    wrist: grip,
    bar: [0, HM_HIP.y, HM_HIP.z],
    kneePole: (s) => {
      const k = knee(s);
      return [k[0] - s * BODY.hipHalf, k[1] - HM_HIP.y, k[2] - HM_HIP.z];
    },
    elbowPole: (s) => [s * 1, -0.4, 0],
  });
}

/** Abduction: depth 0 = knees together, 1 = pushed wide apart. */
export const hipAbductionPose = (depth: number) => hipMachinePose(depth);
/** Adduction: depth 0 = wide start, 1 = pads squeezed together. */
export const hipAdductionPose = (depth: number) => hipMachinePose(1 - depth);

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W16: Record<string, ExerciseAnimationSpec> = {
  "close-grip-lat-pulldown": {
    figure: {
      pose: closeGripPulldownPose,
      implement: "w16-vhandle",
      furniture: "pulldown",
      scale: 1.05,
      centerZ: 12,
    },
    labels: label("Close-grip lat pulldown", "Lat pulldown met smalle grip"),
    phases: {
      en: {
        lower: "Pull the handle to your upper chest, elbows down",
        touch: "Handle at the upper chest, squeeze your lats",
        press: "Let the handle rise slowly",
        lockout: "Arms long, lats stretched",
      },
      nl: {
        lower: "Trek het handvat naar je bovenborst, ellebogen omlaag",
        touch: "Handvat bij je bovenborst, knijp je lats samen",
        press: "Laat het handvat langzaam omhoog gaan",
        lockout: "Armen gestrekt, lats gerekt",
      },
    },
    cues: {
      en: [
        "Clip a V-handle to the high pulley and sit with your thighs locked under the pad.",
        "Take the handle with a close neutral grip, palms facing each other, and sit tall with a slight lean back.",
        "Start with long arms and your shoulders drawn down.",
        "Pull the handle to your upper chest, driving your elbows down along your sides.",
        "Squeeze your lats, then let the handle rise slowly until your arms are straight again.",
      ],
      nl: [
        "Haak een V-handvat aan de hoge katrol en zit met je bovenbenen vast onder het kussen.",
        "Pak het handvat met een smalle neutrale grip, handpalmen naar elkaar, en zit rechtop met een lichte lean naar achteren.",
        "Begin met lange armen en je schouders omlaag.",
        "Trek het handvat naar je bovenborst en druk je ellebogen omlaag langs je zij.",
        "Span je lats aan en laat het handvat dan langzaam omhoog gaan tot je armen weer gestrekt zijn.",
      ],
    },
  },
  "bb-shrug": {
    figure: {
      pose: barbellShrugPose,
      implement: "barbell",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Barbell shrug", "Barbell shrug"),
    phases: {
      en: {
        lower: "Shrug your shoulders straight up toward your ears",
        touch: "Pause at the top",
        press: "Lower your shoulders slowly",
        lockout: "Arms straight, bar hanging against your thighs",
      },
      nl: {
        lower: "Trek je schouders recht omhoog naar je oren",
        touch: "Pauzeer bovenin",
        press: "Laat je schouders langzaam zakken",
        lockout: "Armen gestrekt, stang hangt tegen je bovenbenen",
      },
    },
    cues: {
      en: [
        "Stand tall with the bar hanging in front of your thighs, hands just outside your hips and arms straight.",
        "Lift your shoulders straight up toward your ears. Don't roll them.",
        "Keep your arms straight and your head still. Pause at the top.",
        "Lower slowly until your shoulders are relaxed again.",
      ],
      nl: [
        "Sta rechtop met de stang voor je bovenbenen, handen net buiten je heupen en armen gestrekt.",
        "Til je schouders recht omhoog naar je oren. Draai ze niet rond.",
        "Houd je armen gestrekt en je hoofd stil. Pauzeer bovenin.",
        "Laat langzaam zakken tot je schouders weer ontspannen zijn.",
      ],
    },
  },
  "db-upright-row": {
    figure: {
      pose: dbUprightRowPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 6,
    },
    labels: label("Dumbbell upright row", "Upright row met dumbbells"),
    phases: {
      en: {
        lower: "Pull the dumbbells up your body, elbows leading",
        touch: "Elbows at shoulder height, hands below",
        press: "Lower the dumbbells slowly",
        lockout: "Arms long, dumbbells in front of your thighs",
      },
      nl: {
        lower: "Trek de dumbbells langs je lichaam omhoog, ellebogen voorop",
        touch: "Ellebogen op schouderhoogte, handen eronder",
        press: "Laat de dumbbells langzaam zakken",
        lockout: "Armen gestrekt, dumbbells voor je bovenbenen",
      },
    },
    cues: {
      en: [
        "Stand tall with a dumbbell in each hand in front of your thighs, palms facing you.",
        "Pull the dumbbells up the front of your body, leading with your elbows.",
        "Stop when your hands reach chest height, just below your chin. Keep your elbows higher than your wrists.",
        "Stop if your shoulders pinch. Lower under control to straight arms.",
      ],
      nl: [
        "Sta rechtop met een dumbbell in elke hand voor je bovenbenen, handpalmen naar je toe.",
        "Trek de dumbbells langs de voorkant van je lichaam omhoog, met je ellebogen voorop.",
        "Stop als je handen borsthoogte bereiken, net onder je kin. Houd je ellebogen hoger dan je polsen.",
        "Stop als je schouders knellen. Laat gecontroleerd zakken tot gestrekte armen.",
      ],
    },
  },
  "cable-upright-row": {
    figure: {
      pose: cableUprightRowPose,
      implement: "w16-low-bar",
      furniture: "w16-low-tower",
      scale: 1.0,
      centerZ: 24,
      pulley: CUR_PULLEY,
    },
    labels: label("Cable upright row", "Upright row aan de kabel"),
    phases: {
      en: {
        lower: "Pull the bar up your body, elbows leading",
        touch: "Bar at chest height, elbows above your hands",
        press: "Lower the bar slowly, keep the cable tight",
        lockout: "Arms long, bar against your thighs",
      },
      nl: {
        lower: "Trek de stang langs je lichaam omhoog, ellebogen voorop",
        touch: "Stang op borsthoogte, ellebogen boven je handen",
        press: "Laat de stang langzaam zakken, houd de kabel strak",
        lockout: "Armen gestrekt, stang tegen je bovenbenen",
      },
    },
    cues: {
      en: [
        "Stand facing a low pulley with a short straight bar, hands about shoulder width apart and arms straight.",
        "Pull the bar up along your body, leading with your elbows.",
        "Stop at chest height with your elbows above your hands and never higher than your shoulders.",
        "Lower slowly with the cable tight. Don't lean back or swing.",
      ],
      nl: [
        "Sta met je gezicht naar een lage katrol met een korte rechte stang, handen ongeveer schouderbreed en armen gestrekt.",
        "Trek de stang langs je lichaam omhoog, met je ellebogen voorop.",
        "Stop op borsthoogte met je ellebogen boven je handen en nooit hoger dan je schouders.",
        "Laat langzaam zakken met de kabel strak. Leun niet achterover en zwaai niet.",
      ],
    },
  },
  "close-grip-bench": {
    figure: {
      pose: closeGripBenchPose,
      implement: "barbell",
      furniture: "flat-bench",
      scale: 1.3,
      centerZ: 20,
    },
    labels: label("Close-grip bench press", "Close-grip bankdrukken"),
    phases: {
      en: {
        lower: "Lower the bar to your lower chest, elbows tucked",
        touch: "Bar on the lower chest, wrists over elbows",
        press: "Press up, keeping your elbows close",
        lockout: "Arms straight over your shoulders",
      },
      nl: {
        lower: "Laat de stang zakken naar je onderborst, ellebogen dicht langs je lijf",
        touch: "Stang op je onderborst, polsen boven ellebogen",
        press: "Duw omhoog en houd je ellebogen dicht bij je lichaam",
        lockout: "Armen gestrekt boven je schouders",
      },
    },
    cues: {
      en: [
        "Lie on the bench with your feet flat and your shoulder blades pulled back and down.",
        "Grip the bar just inside shoulder width, with your wrists straight over your elbows.",
        "Lower the bar to your lower chest, keeping your elbows tucked close to your body.",
        "Touch your lower chest, then press up and slightly back to straight arms.",
      ],
      nl: [
        "Lig op de bank met je voeten plat en je schouderbladen naar achter en omlaag.",
        "Pak de stang net smaller dan schouderbreed, met je polsen recht boven je ellebogen.",
        "Laat de stang zakken naar je onderborst en houd je ellebogen dicht langs je lichaam.",
        "Raak je onderborst aan en duw dan omhoog en iets naar achteren tot gestrekte armen.",
      ],
    },
  },
  "machine-abduction": {
    figure: {
      pose: hipAbductionPose,
      implement: "w16-abduction",
      furniture: "upright-bench",
      scale: 1.2,
      centerZ: 20,
    },
    labels: label("Hip abduction machine", "Abductor machine"),
    phases: {
      en: {
        lower: "Push your knees apart",
        touch: "Pause at the widest point",
        press: "Let the pads close slowly",
        lockout: "Knees together, hips still",
      },
      nl: {
        lower: "Duw je knieën uit elkaar",
        touch: "Pauzeer op het breedste punt",
        press: "Laat de kussens langzaam sluiten",
        lockout: "Knieën bij elkaar, heupen stil",
      },
    },
    cues: {
      en: [
        "Sit with your back against the pad and your feet on the foot rests, the pads on the outside of your knees.",
        "Hold the grips and keep your hips pressed into the seat. Leaning slightly forward works the glutes more.",
        "Push the pads apart as far as you can without your hips lifting.",
        "Pause at the widest point, then let the pads close slowly.",
      ],
      nl: [
        "Zit met je rug tegen het kussen en je voeten op de voetsteunen, de kussens aan de buitenkant van je knieën.",
        "Pak de handvatten vast en houd je heupen tegen de zitting. Iets voorover leunen werkt je bilspieren meer.",
        "Duw de kussens zo ver mogelijk uit elkaar zonder dat je heupen opkomen.",
        "Pauzeer op het breedste punt en laat de kussens dan langzaam sluiten.",
      ],
    },
  },
  "machine-adduction": {
    figure: {
      pose: hipAdductionPose,
      implement: "w16-adduction",
      furniture: "upright-bench",
      scale: 1.2,
      centerZ: 20,
    },
    labels: label("Hip adduction machine", "Adductor machine"),
    phases: {
      en: {
        lower: "Squeeze your knees together",
        touch: "Pause when the pads meet",
        press: "Let the pads open slowly",
        lockout: "Knees wide, inner thighs stretched",
      },
      nl: {
        lower: "Knijp je knieën naar elkaar toe",
        touch: "Pauzeer als de kussens elkaar raken",
        press: "Laat de kussens langzaam openen",
        lockout: "Knieën wijd, binnenkant bovenbenen gerekt",
      },
    },
    cues: {
      en: [
        "Sit with your back against the pad and your feet on the foot rests, the pads on the inside of your knees.",
        "Set the start as wide as is comfortable. Hold the grips and keep your hips on the seat.",
        "Squeeze the pads together with your inner thighs.",
        "Pause when the pads meet, then let them open slowly.",
      ],
      nl: [
        "Zit met je rug tegen het kussen en je voeten op de voetsteunen, de kussens aan de binnenkant van je knieën.",
        "Zet de start zo wijd als comfortabel is. Pak de handvatten vast en houd je heupen op de zitting.",
        "Knijp de kussens samen met de binnenkant van je bovenbenen.",
        "Pauzeer als de kussens elkaar raken en laat ze dan langzaam openen.",
      ],
    },
  },
};
