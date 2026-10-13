import {
  ANKLE_Y,
  assemble,
  BODY,
  cos,
  forwardKnees,
  headFrom,
  label,
  lerp,
  lerp3,
  sin,
  smooth,
  STAND_SHOULDER_Y,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W4 (cable and machine pulls), merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

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

/** A standing pose with soft knees: hip height from a hip-to-ankle reach. */
const SOFT_HIP_Y = ANKLE_Y + Math.sqrt(87.2 * 87.2 - 4);

/* ------------------------------------------------------------------ */
/* Seated cable row                                                    */
/* ------------------------------------------------------------------ */

/** Height of the foot platform (cm) and the low pulley the row cable runs to. */
export const ROW_PLATFORM_Y = 18;
export const ROW_PULLEY = { y: 30, z: 128 };
export const ROW_HIP = { y: 48, z: 0 };

/** Seated cable row: tall torso (a small lean at the stretch, no rocking),
 *  the V-handle travels from straight arms to the lower ribs, elbows back. */
export function seatedCableRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = ROW_HIP;
  const lean = lerp(8, -2, e);
  const shoulder = { y: hip.y + BODY.torso * cos(lean), z: hip.z + BODY.torso * sin(lean) };
  // Arms nearly straight: 8 cm in x from the shoulder, 54.8 cm in all.
  const start: V3 = [0, shoulder.y - 13, shoulder.z + Math.sqrt(54.8 ** 2 - 11 ** 2 - 13 ** 2)];
  const end: V3 = [0, hip.y + 23, hip.z + 9];
  const w = lerp3(start, end, e);
  const ankleY = ROW_PLATFORM_Y + ANKLE_Y;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.4),
    ankleZ: 78,
    footHalf: 14,
    ankle: (s) => [s * 14, ankleY, 78],
    foot: () => ({ floor: ROW_PLATFORM_Y, dir: 1 }),
    wrist: (s) => [s * 8, w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: (s) => [s * 0.15, 1, 0.2],
    elbowPole: (s) => [s * 0.35, -0.3, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Face pull                                                           */
/* ------------------------------------------------------------------ */

export const FACE_PULL_PULLEY = { y: 166, z: 112 };

/** Cable face pull: arms straight at the rope, then the rope goes to the face,
 *  the hands finish beside the ears with the elbows high and out. */
export function facePullPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = -4;
  const hip = { y: SOFT_HIP_Y, z: 0 };
  const shoulder = { y: hip.y + BODY.torso * cos(lean), z: hip.z + BODY.torso * sin(lean) };
  const head = headFrom(shoulder, lean * 0.3);
  const start: V3 = [8, shoulder.y + 9, shoulder.z + 51];
  const end: V3 = [26, head[1] - 6, head[2] - 1];
  // The hands come in along the cable first and split to the ears at the end.
  const split = smooth(Math.min(1, e * 1.15));
  const w: V3 = [
    lerp(start[0], end[0], split * split),
    lerp(start[1], end[1], e),
    lerp(start[2], end[2], e),
  ];
  return assemble({
    hip,
    shoulder,
    head,
    ankleZ: 0,
    footHalf: 12,
    wrist: (s) => [s * w[0], w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 1, lerp(-0.4, -0.2, e), lerp(-0.1, -0.4, e)],
  });
}

/* ------------------------------------------------------------------ */
/* Cable crossover                                                     */
/* ------------------------------------------------------------------ */

/** Two high pulleys: half the distance between the towers, and their height / z. */
export const CROSS_TOWER_X = 82;
export const CROSS_PULLEY = { y: 170, z: -26 };

/** Cable crossover: a slight forward lean and soft knees, the arms keep one
 *  soft elbow bend and sweep down and in until the hands meet at the waist. */
export function cableCrossoverPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 14;
  const hip = { y: SOFT_HIP_Y - 1, z: 0 };
  const shoulder = { y: hip.y + BODY.torso * cos(lean), z: hip.z + BODY.torso * sin(lean) };
  const R = 52;
  const d0 = unit([0.94, 0.12, -0.25]);
  const d1 = unit([-0.31, -0.64, 0.7]);
  const wrist = (s: -1 | 1): V3 => {
    const d = slerp3(d0, d1, e);
    return [s * BODY.shoulderHalf + s * R * d[0], shoulder.y + R * d[1], shoulder.z + R * d[2]];
  };
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
    elbowPole: (s) => [s * lerp(0.1, 1, e), lerp(-1, -0.3, e), lerp(-0.3, 0.2, e)],
  });
}

/* ------------------------------------------------------------------ */
/* Cable lateral raise                                                 */
/* ------------------------------------------------------------------ */

/** The tower stands beside the left side of the figure; its low pulley and the
 *  post the free hand holds. */
export const LATERAL_TOWER = { x: -52, z: 14, pulleyY: 16, handY: 112 };

/** Cable lateral raise (right arm working): the handle starts across the body
 *  by the opposite thigh and the straight-ish arm rises out to shoulder height. */
export function cableLateralPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y, z: 0 };
  const R = 53;
  const d0 = unit([-0.31, -0.9, 0.3]);
  const d1 = unit([1, -0.06, 0.05]);
  const d = slerp3(d0, d1, e);
  const right: V3 = [BODY.shoulderHalf + R * d[0], shoulder.y + R * d[1], shoulder.z + R * d[2]];
  const left: V3 = [LATERAL_TOWER.x + 3, LATERAL_TOWER.handY, LATERAL_TOWER.z];
  return assemble({
    hip: { y: SOFT_HIP_Y + 0.6, z: 0 },
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => (s > 0 ? right : left),
    bar: right,
    kneePole: forwardKnees,
    elbowPole: (s) => (s > 0 ? [0.6, -0.5, -1] : [-0.3, -1, -0.4]),
  });
}

/* ------------------------------------------------------------------ */
/* Pec deck                                                            */
/* ------------------------------------------------------------------ */

export const PEC_HIP = { y: 53, z: 0 };
export const PEC_PIVOT_X = 78;

/** Pec deck: back on the pad, upper arms at shoulder height, the straight-ish
 *  arms sweep in an arc until the handles meet in front of the chest. */
export function pecDeckPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = -6;
  const hip = PEC_HIP;
  const shoulder = { y: hip.y + BODY.torso * cos(lean), z: hip.z + BODY.torso * sin(lean) };
  const R = 51;
  const psi = lerp(100, -16, e); // degrees from straight ahead, towards the side
  const dir = (s: -1 | 1): V3 => [s * sin(psi), 0, cos(psi)];
  const wrist = (s: -1 | 1): V3 => {
    const v = dir(s);
    return [s * BODY.shoulderHalf + R * v[0], shoulder.y - 1, shoulder.z + R * v[2]];
  };
  const mid = wrist(1);
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 40,
    footHalf: 22,
    wrist,
    bar: [0, mid[1], mid[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    // The elbows stay a touch behind the line from shoulder to hand.
    elbowPole: (s) => {
      const v = dir(s);
      return [s * v[2], -0.15, -v[0] * s * s];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Chest-supported machine row                                         */
/* ------------------------------------------------------------------ */

export const MROW_HIP = { y: 50, z: 0 };
export const MROW_LEAN = 12;
/** The handle lever turns about this low pivot (cm), so the hands travel on an arc of radius MROW_LEVER. */
export const MROW_PIVOT = { y: 14, z: 60 };
export const MROW_LEVER = 73;

/** Chest-supported machine row: chest on the pad the whole rep, the handles
 *  travel from straight arms to the sides of the chest, elbows behind. */
export function machineRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = MROW_HIP;
  const shoulder = {
    y: hip.y + BODY.torso * cos(MROW_LEAN),
    z: hip.z + BODY.torso * sin(MROW_LEAN),
  };
  const theta = lerp(-1, -33, e); // lever angle from vertical, forward positive
  const w: V3 = [0, MROW_PIVOT.y + MROW_LEVER * cos(theta), MROW_PIVOT.z + MROW_LEVER * sin(theta)];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 14),
    ankleZ: 42,
    footHalf: 18,
    wrist: (s) => [s * 21, w[1], w[2]],
    bar: [0, w[1], w[2]],
    kneePole: (s) => [s * 0.2, 1, 0.4],
    elbowPole: (s) => [s * 0.15, -0.1, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W4: Record<string, ExerciseAnimationSpec> = {
  "seated-cable-row": {
    figure: {
      pose: seatedCableRowPose,
      implement: "cable",
      furniture: "w4-row-seat",
      scale: 1.12,
      centerZ: 56,
      pulley: ROW_PULLEY,
    },
    labels: label("Seated cable row", "Zittend roeien aan de kabel"),
    phases: {
      en: {
        lower: "Pull the handle to your belly, elbows past your torso",
        touch: "Chest up, shoulder blades squeezed",
        press: "Let the handle go forward slowly",
        lockout: "Arms long, back tall, a little stretch",
      },
      nl: {
        lower: "Trek het handvat naar je buik, ellebogen langs je romp naar achteren",
        touch: "Borst vooruit, schouderbladen samenknijpen",
        press: "Laat het handvat langzaam weer naar voren gaan",
        lockout: "Lange armen, rechte rug, een lichte rek",
      },
    },
    cues: {
      en: [
        "Feet flat on the platform, knees slightly bent, sit tall with your chest up.",
        "Start with long arms and your shoulders pulled down, with only a small lean forward.",
        "Pull the handle to your lower ribs and drive your elbows back, close to your body.",
        "Squeeze your shoulder blades, then return slowly without rocking your torso.",
      ],
      nl: [
        "Voeten plat op het platform, knieën licht gebogen, zit lang met je borst vooruit.",
        "Begin met lange armen en je schouders omlaag, met maar een kleine voorwaartse hang.",
        "Trek het handvat naar je onderste ribben en duw je ellebogen dicht langs je lijf naar achteren.",
        "Knijp je schouderbladen samen en keer langzaam terug zonder met je romp te schommelen.",
      ],
    },
  },
  "face-pull": {
    figure: {
      pose: facePullPose,
      implement: "w4-rope",
      furniture: "cable-tower",
      scale: 1.0,
      centerZ: 52,
      pulley: FACE_PULL_PULLEY,
    },
    labels: label("Cable face pull", "Face pull aan de kabel"),
    phases: {
      en: {
        lower: "Pull the rope to your face, hands apart",
        touch: "Hands beside your ears, elbows high",
        press: "Let the rope go back out slowly",
        lockout: "Arms long towards the pulley",
      },
      nl: {
        lower: "Trek het touw naar je gezicht, handen uit elkaar",
        touch: "Handen naast je oren, ellebogen hoog",
        press: "Laat het touw langzaam weer naar voren gaan",
        lockout: "Lange armen richting de katrol",
      },
    },
    cues: {
      en: [
        "Set the pulley about forehead height. Stand tall with soft knees and a firm core.",
        "Hold the rope overhand and start with your arms straight towards the pulley.",
        "Pull the rope to your forehead and split it, so your hands end beside your ears.",
        "Keep your elbows high, level with your shoulders, and squeeze the back of your shoulders.",
      ],
      nl: [
        "Zet de katrol op ongeveer voorhoofdshoogte. Sta rechtop met zachte knieën en een strakke core.",
        "Pak het touw overhands vast en begin met je armen gestrekt richting de katrol.",
        "Trek het touw naar je voorhoofd en trek het uit elkaar, zodat je handen naast je oren eindigen.",
        "Houd je ellebogen hoog, op schouderhoogte, en knijp de achterkant van je schouders samen.",
      ],
    },
  },
  "cable-crossover": {
    figure: {
      pose: cableCrossoverPose,
      implement: "w4-cross-cable",
      furniture: "w4-cross-towers",
      scale: 1.0,
      centerZ: 0,
      pulley: CROSS_PULLEY,
    },
    labels: label("Cable crossover", "Cable crossover"),
    phases: {
      en: {
        lower: "Sweep your hands down and in",
        touch: "Hands meet in front of your lower chest",
        press: "Open back up slowly, elbows still bent",
        lockout: "Arms wide and high, chest stretched",
      },
      nl: {
        lower: "Zwaai je handen naar beneden en naar elkaar toe",
        touch: "Handen ontmoeten elkaar voor je onderste borst",
        press: "Ga langzaam weer open, ellebogen blijven licht gebogen",
        lockout: "Armen wijd en hoog, borst gerekt",
      },
    },
    cues: {
      en: [
        "Stand between two high pulleys with a slight forward lean and soft knees.",
        "Keep a small, fixed bend in your elbows the whole rep.",
        "Sweep your hands in a wide arc, down and in, until they meet in front of your lower chest.",
        "Squeeze your chest for a moment, then open back up slowly without losing tension.",
      ],
      nl: [
        "Sta tussen twee hoge katrollen met een lichte voorover hang en zachte knieën.",
        "Houd de hele herhaling een kleine, vaste buiging in je ellebogen.",
        "Zwaai je handen in een grote boog naar beneden en naar elkaar toe tot ze voor je onderste borst samenkomen.",
        "Knijp even je borst samen en ga dan langzaam weer open zonder de spanning te verliezen.",
      ],
    },
  },
  "cable-lateral": {
    figure: {
      pose: cableLateralPose,
      implement: "w4-lat-cable",
      furniture: "w4-lat-tower",
      scale: 1.05,
      centerZ: 6,
      pulley: { y: LATERAL_TOWER.pulleyY, z: LATERAL_TOWER.z },
    },
    labels: label("Cable lateral raise", "Zijwaarts heffen aan de kabel"),
    phases: {
      en: {
        lower: "Raise your arm out to the side",
        touch: "Hand at shoulder height, no higher",
        press: "Lower slowly back across your body",
        lockout: "Hand by your opposite thigh, cable tight",
      },
      nl: {
        lower: "Til je arm zijwaarts omhoog",
        touch: "Hand op schouderhoogte, niet hoger",
        press: "Laat langzaam terugzakken over je lichaam",
        lockout: "Hand bij je andere dij, kabel strak",
      },
    },
    cues: {
      en: [
        "Stand side-on to the low pulley and take the handle with the hand furthest from the machine.",
        "Hold the machine with your free hand and keep your chest tall.",
        "Raise your arm out to the side with a soft elbow, leading with your elbow.",
        "Stop at shoulder height, then lower slowly without swinging.",
      ],
      nl: [
        "Sta zijwaarts naast de lage katrol en pak het handvat met de hand die het verst van het apparaat af zit.",
        "Houd het apparaat vast met je vrije hand en houd je borst hoog.",
        "Til je arm zijwaarts op met een zachte elleboog en laat je elleboog het werk leiden.",
        "Stop op schouderhoogte en laat dan langzaam zakken zonder te zwaaien.",
      ],
    },
  },
  "pec-deck": {
    figure: {
      pose: pecDeckPose,
      implement: "none",
      furniture: "w4-pecdeck",
      scale: 1.1,
      centerZ: 22,
    },
    labels: label("Pec deck", "Pec deck"),
    phases: {
      en: {
        lower: "Sweep your arms together in front of your chest",
        touch: "Handles meet, squeeze your chest",
        press: "Open back up slowly",
        lockout: "Arms open to just behind your shoulders",
      },
      nl: {
        lower: "Breng je armen samen voor je borst",
        touch: "Handvatten ontmoeten elkaar, knijp je borst samen",
        press: "Ga langzaam weer open",
        lockout: "Armen open tot net achter je schouders",
      },
    },
    cues: {
      en: [
        "Sit with your back flat on the pad and set the handles at shoulder height.",
        "Keep a slight bend in your elbows and your shoulders pulled down.",
        "Sweep your arms together in front of your chest in a wide arc.",
        "Squeeze, then open back up slowly, to just behind your shoulder line.",
      ],
      nl: [
        "Zit met je rug plat tegen het kussen en zet de handvatten op schouderhoogte.",
        "Houd een lichte buiging in je ellebogen en je schouders omlaag.",
        "Breng je armen in een brede boog samen voor je borst.",
        "Knijp even en ga dan langzaam weer open, tot net achter je schouderlijn.",
      ],
    },
  },
  "machine-row": {
    figure: {
      pose: machineRowPose,
      implement: "none",
      furniture: "w4-machine-row",
      scale: 1.15,
      centerZ: 34,
    },
    labels: label("Chest-supported machine row", "Roeien aan de machine met borststeun"),
    phases: {
      en: {
        lower: "Pull the handles back, elbows behind your torso",
        touch: "Shoulder blades squeezed, chest on the pad",
        press: "Let the handles go forward slowly",
        lockout: "Arms long, shoulders reaching forward",
      },
      nl: {
        lower: "Trek de handvatten naar achteren, ellebogen langs je romp",
        touch: "Schouderbladen samengeknepen, borst op het kussen",
        press: "Laat de handvatten langzaam naar voren gaan",
        lockout: "Lange armen, schouders naar voren gestrekt",
      },
    },
    cues: {
      en: [
        "Set the seat so the pad meets your chest and the handles are at chest height.",
        "Keep your chest on the pad and your feet planted on the floor or footrests.",
        "Start with long arms, then drive your elbows back behind your torso.",
        "Squeeze your shoulder blades together, then return slowly without lifting off the pad.",
      ],
      nl: [
        "Stel de zitting zo af dat het kussen tegen je borst zit en de handvatten op borsthoogte zijn.",
        "Houd je borst op het kussen en je voeten stevig op de grond of de voetsteunen.",
        "Begin met lange armen en duw dan je ellebogen achter je romp.",
        "Knijp je schouderbladen samen en keer langzaam terug zonder van het kussen te komen.",
      ],
    },
  },
};
