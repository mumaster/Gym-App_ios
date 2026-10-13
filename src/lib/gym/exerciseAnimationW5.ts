import {
  ANKLE_Y,
  ARM,
  BODY,
  PULLUP_BAR_Y,
  STAND_HIP_Y,
  STAND_SHOULDER_Y,
  assemble,
  cos,
  forwardKnees,
  hangShoulderY,
  headFrom,
  hipFrom,
  label,
  lerp,
  sin,
  smooth,
  twoBone,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W5, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/* ------------------------------------------------------------------ */
/* Chin-up                                                             */
/* ------------------------------------------------------------------ */

/** Chin-up: a pull-up with an underhand grip about shoulder width, so the
 *  elbows travel down in front of the body instead of out to the sides. */
export function chinUpPose(depth: number): FigurePose {
  const e = smooth(depth);
  const grip = 20;
  const shoulder = {
    y: lerp(hangShoulderY(grip), PULLUP_BAR_Y - 11, e),
    z: lerp(0, -8, e),
  };
  const hip = hipFrom(shoulder, lerp(0, -12, e));
  // Knees a little bent, feet behind the body (as in the pull-up).
  const back = hip.z - 14;
  const ankleY = hip.y - Math.sqrt(86 * 86 - 14 * 14);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lerp(0, -14, e)),
    ankleZ: back,
    footHalf: 10,
    ankle: (s) => [s * 10, ankleY, back],
    foot: () => ({ floor: ankleY - ANKLE_Y, dir: 1, pitch: 55 }),
    wrist: (s) => [s * grip, PULLUP_BAR_Y, 0],
    bar: [0, PULLUP_BAR_Y, 0],
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => [s * 0.05, -1, 0.55],
  });
}

/* ------------------------------------------------------------------ */
/* Bent-over reverse flye                                              */
/* ------------------------------------------------------------------ */

/** Standing hinge shared by the reverse flye: the bent-row hip and ankles
 *  with a chosen torso lean. */
function hinge(lean: number) {
  const ankleZ = -6;
  const dz = -26 - ankleZ;
  const hip = { z: -26, y: ANKLE_Y + Math.sqrt(80 * 80 - dz * dz - 16) };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  return { hip, shoulder, ankleZ };
}

const FLYE_REACH = 53.5; // shoulder -> wrist: a soft, fixed elbow bend
const FLYE_LEAN = 58;

/** Bent-over reverse flye: torso held still near parallel, the arms open out
 *  to the sides to shoulder height (never behind the shoulders). */
export function reverseFlyePose(depth: number): FigurePose {
  const e = smooth(depth);
  const { hip, shoulder, ankleZ } = hinge(FLYE_LEAN);
  const phi = lerp(6, 86, e); // degrees from hanging
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, FLYE_LEAN * 0.55),
    ankleZ,
    footHalf: 14,
    wrist: (s) => [
      s * (BODY.shoulderHalf + FLYE_REACH * sin(phi)),
      shoulder.y - FLYE_REACH * cos(phi),
      shoulder.z,
    ],
    bar: [0, shoulder.y - FLYE_REACH * cos(phi), shoulder.z],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.2, -1, 0.3],
  });
}

/* ------------------------------------------------------------------ */
/* Seated lifts on the end of a flat bench                             */
/* ------------------------------------------------------------------ */

/** Hip z when sitting on the end of the shared flat bench (it spans z -42..50). */
const SEAT_Z = 36;
const SEAT_Y = 53;

/** Seated rear lateral raise: chest folded over the thighs and still, the
 *  dumbbells hang beside the calves and the arms open out to shoulder height. */
export function seatedRearRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 72;
  const hip = { y: SEAT_Y, z: SEAT_Z };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const reach = 53.5;
  const phi = lerp(9, 86, e);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 52),
    ankleZ: SEAT_Z + 50,
    footHalf: 12,
    wrist: (s) => [
      s * (BODY.shoulderHalf + reach * sin(phi)),
      shoulder.y - reach * cos(phi),
      shoulder.z,
    ],
    bar: [0, shoulder.y - reach * cos(phi), shoulder.z],
    kneePole: (s) => [s * 0.3, 1, 0.5],
    elbowPole: (s) => [s * 0.2, -1, 0.3],
  });
}

/** Concentration curl: seated with the feet wide, the working (near) elbow
 *  braced on the inner thigh, the other hand on its knee. Only the forearm
 *  moves, curling the dumbbell from a straight arm up to the shoulder. */
export function concentrationCurlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = 50;
  const hip = { y: SEAT_Y, z: SEAT_Z };
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const base = assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 32),
    ankleZ: SEAT_Z + 45,
    footHalf: 30,
    wrist: () => [0, 0, 0],
    bar: [0, 0, 0],
    kneePole: (s) => [s * 1, 0.6, 0.35],
    elbowPole: (s) => [s, 0, -1],
  });
  // Working arm: the elbow is fixed on the inner thigh, the upper arm hangs
  // down and a little back; the forearm swings forward and up about it.
  const rs = base.shoulders[1];
  const ud: V3 = [-0.18, -0.97, -0.12];
  const un = Math.hypot(...ud);
  const elbow: V3 = [
    rs[0] + (29 * ud[0]) / un,
    rs[1] + (29 * ud[1]) / un,
    rs[2] + (29 * ud[2]) / un,
  ];
  const hy = Math.hypot(ud[1], ud[2]);
  const u2: V3 = [ud[1] / hy, ud[2] / hy, 0]; // in-plane "down" (y, z)
  const theta = lerp(4, 150, e);
  const dy = cos(theta) * u2[0] + sin(theta) * (ud[2] / hy);
  const dz = cos(theta) * u2[1] + sin(theta) * (-ud[1] / hy);
  const dx = ud[0] / un;
  const dn = Math.hypot(dx, dy, dz);
  const wrist: V3 = [
    elbow[0] + (26 * dx) / dn,
    elbow[1] + (26 * dy) / dn,
    elbow[2] + (26 * dz) / dn,
  ];
  // Free hand on the far knee, elbow out and back.
  const lk = base.knees[0];
  const lw: V3 = [lk[0] + 1, lk[1] + 8, lk[2] - 4];
  const le = twoBone(base.shoulders[0], lw, 29, 26, [-0.7, 0.2, -0.6]);
  return {
    ...base,
    elbows: [le, elbow],
    wrists: [lw, wrist],
    bar: wrist,
  };
}

/* ------------------------------------------------------------------ */
/* Dumbbell shrug                                                      */
/* ------------------------------------------------------------------ */

/** Dumbbell shrug: standing tall, straight arms, the shoulders rise straight
 *  up toward the ears while the head stays still. */
export function dbShrugPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: STAND_SHOULDER_Y + 8 * e, z: 0 };
  const reach = ARM - 0.05;
  const dx = 2;
  const wy = shoulder.y - Math.sqrt(reach * reach - dx * dx);
  return assemble({
    hip: { y: STAND_HIP_Y, z: 0 },
    shoulder,
    head: [0, STAND_SHOULDER_Y + 22, 0],
    ankleZ: 0,
    footHalf: 11,
    wrist: (s) => [s * (BODY.shoulderHalf + dx), wy, 0],
    bar: [0, wy, 0],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Landmine T-bar row                                                  */
/* ------------------------------------------------------------------ */

const LM_LEAN = 48;
/** The landmine pivot sits on the floor behind the feet; the V-handle is a
 *  fixed distance along the bar from it, so the handle moves on an arc. */
export const LANDMINE_PIVOT_Y = 4;
export const LANDMINE_HANDLE = 150;
/** Bar length from the pivot, and where the plates sit on it (cm). */
export const LANDMINE_BAR = 186;
export const LANDMINE_PLATES = 172;
const LM_RISE = 25; // how far the handle rises over the rep
const LM_HALF_GRIP = 6;

function landmineGeometry() {
  const { hip, shoulder, ankleZ } = hinge(LM_LEAN);
  // Dead hang: straight arms, the handle hanging under the shoulders.
  const reach = ARM - 0.5;
  const w0y = shoulder.y - Math.sqrt(reach * reach - (BODY.shoulderHalf - LM_HALF_GRIP) ** 2);
  const a0 = Math.asin((w0y - LANDMINE_PIVOT_Y) / LANDMINE_HANDLE);
  const pivotZ = shoulder.z - LANDMINE_HANDLE * Math.cos(a0);
  return { hip, shoulder, ankleZ, w0y, pivotZ };
}

/** Floor anchor of the landmine (cm, z). */
export const LANDMINE_PIVOT_Z = landmineGeometry().pivotZ;

/** Angle of the bar above the floor (radians) when the handle is at height `y`. */
export const landmineAngle = (handleY: number) =>
  Math.asin((handleY - LANDMINE_PIVOT_Y) / LANDMINE_HANDLE);

/** Landmine T-bar row: hinged about 45 degrees, feet either side of the bar,
 *  both hands on the V-handle; the bar pivots about the floor anchor behind
 *  the feet and the handle rows toward the chest on an arc. */
export function landmineRowPose(depth: number): FigurePose {
  const e = smooth(depth);
  const { hip, shoulder, ankleZ, w0y } = landmineGeometry();
  const a = landmineAngle(w0y + LM_RISE * e);
  const wz = LANDMINE_PIVOT_Z + LANDMINE_HANDLE * Math.cos(a);
  const wy = LANDMINE_PIVOT_Y + LANDMINE_HANDLE * Math.sin(a);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, LM_LEAN * 0.6),
    ankleZ,
    footHalf: 17,
    wrist: (s) => [s * LM_HALF_GRIP, wy, wz],
    bar: [0, wy, wz],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.6, 0.3, -1],
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W5: Record<string, ExerciseAnimationSpec> = {
  chinup: {
    figure: {
      pose: chinUpPose,
      implement: "none",
      furniture: "pullup-bar",
      scale: 0.8,
      centerZ: 0,
    },
    labels: label("Chin-up", "Chin-up"),
    phases: {
      en: {
        lower: "Pull your chest up to the bar, elbows down in front",
        touch: "Chin over the bar",
        press: "Lower slowly with control",
        lockout: "Dead hang, arms straight",
      },
      nl: {
        lower: "Trek je borst naar de stang, ellebogen naar beneden voor je lijf",
        touch: "Kin boven de stang",
        press: "Zak langzaam gecontroleerd",
        lockout: "Dode hang, armen gestrekt",
      },
    },
    cues: {
      en: [
        "Hang from the bar with an underhand grip about shoulder-width apart.",
        "Pull your elbows down and forward toward your ribs until your chin clears the bar.",
        "Keep your legs still and your chest up. Don't kick or swing.",
        "Lower for about two seconds until your arms are straight again.",
      ],
      nl: [
        "Hang aan de stang met een onderhandse greep ongeveer schouderbreed.",
        "Trek je ellebogen naar beneden en naar voren richting je ribben tot je kin boven de stang komt.",
        "Houd je benen stil en je borst omhoog. Schop of zwaai niet.",
        "Zak ongeveer twee seconden tot je armen weer gestrekt zijn.",
      ],
    },
  },
  "db-rear-delt-flye": {
    figure: {
      pose: reverseFlyePose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
    },
    labels: label("Bent-over reverse flye", "Omgekeerde flye voorovergebogen"),
    phases: {
      en: {
        lower: "Open your arms out to the sides",
        touch: "Squeeze your shoulder blades at shoulder height",
        press: "Lower slowly under control",
        lockout: "Arms hanging under your shoulders, back flat",
      },
      nl: {
        lower: "Open je armen naar de zijkant",
        touch: "Knijp je schouderbladen samen op schouderhoogte",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Armen hangend onder je schouders, rug recht",
      },
    },
    cues: {
      en: [
        "Hinge forward from the hips with soft knees until your torso is close to parallel to the floor.",
        "Keep your back flat and your neck neutral. Hold this angle all rep.",
        "Raise the dumbbells out to the sides with a soft, fixed bend in your elbows.",
        "Stop at shoulder height and squeeze your shoulder blades, then lower slowly.",
      ],
      nl: [
        "Buig vanuit je heupen voorover met zachte knieën tot je romp bijna parallel aan de grond is.",
        "Houd je rug recht en je nek neutraal. Houd deze hoek de hele herhaling vast.",
        "Til de dumbbells naar de zijkant met een zachte, vaste buiging in je ellebogen.",
        "Stop op schouderhoogte en knijp je schouderbladen samen, laat dan langzaam zakken.",
      ],
    },
  },
  "seated-rear-lateral-raise": {
    figure: {
      pose: seatedRearRaisePose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.25,
      centerZ: 32,
    },
    labels: label("Seated rear lateral raise", "Zittende achterwaartse zijwaartse raise"),
    phases: {
      en: {
        lower: "Raise your arms out to the sides",
        touch: "Hands at shoulder height, squeeze",
        press: "Lower slowly under control",
        lockout: "Dumbbells hanging beside your calves",
      },
      nl: {
        lower: "Til je armen naar de zijkant",
        touch: "Handen op schouderhoogte, knijp samen",
        press: "Laat langzaam gecontroleerd zakken",
        lockout: "Dumbbells hangend naast je kuiten",
      },
    },
    cues: {
      en: [
        "Sit on the end of a flat bench, feet flat in front, and fold your chest down over your thighs.",
        "Let the dumbbells hang beside your calves with a soft bend in your elbows.",
        "Raise your arms out to the sides to about shoulder height, leading with your elbows.",
        "Keep your torso down and still. Lower slowly without swinging.",
      ],
      nl: [
        "Ga op het uiteinde van een vlakke bank zitten, voeten plat voor je, en vouw je borst over je dijen.",
        "Laat de dumbbells naast je kuiten hangen met een zachte buiging in je ellebogen.",
        "Til je armen naar de zijkant tot ongeveer schouderhoogte en leid met je ellebogen.",
        "Houd je romp laag en stil. Laat langzaam zakken zonder te zwaaien.",
      ],
    },
  },
  "concentration-curl": {
    figure: {
      pose: concentrationCurlPose,
      implement: "dumbbells",
      furniture: "flat-bench",
      scale: 1.2,
      centerZ: 30,
      oneDumbbell: true,
    },
    labels: label("Concentration curl", "Concentration curl"),
    phases: {
      en: {
        lower: "Curl the dumbbell up toward your shoulder",
        touch: "Squeeze your biceps at the top",
        press: "Lower slowly to a straight arm",
        lockout: "Arm long, elbow braced on your thigh",
      },
      nl: {
        lower: "Curl de dumbbell omhoog naar je schouder",
        touch: "Knijp je biceps samen bovenin",
        press: "Laat langzaam zakken tot een gestrekte arm",
        lockout: "Arm lang, elleboog tegen je dij",
      },
    },
    cues: {
      en: [
        "Sit on a flat bench with your feet wide and lean forward.",
        "Brace the back of your working upper arm against your inner thigh, the other hand on your knee.",
        "Curl the dumbbell toward your shoulder. Only your forearm moves.",
        "Pause at the top, then lower slowly until your arm is straight.",
      ],
      nl: [
        "Ga op een vlakke bank zitten met je voeten wijd uit elkaar en leun voorover.",
        "Zet de achterkant van je werkende bovenarm tegen je binnenste dij, de andere hand op je knie.",
        "Curl de dumbbell naar je schouder. Alleen je onderarm beweegt.",
        "Pauzeer bovenin en laat dan langzaam zakken tot je arm gestrekt is.",
      ],
    },
  },
  "db-shrug": {
    figure: {
      pose: dbShrugPose,
      implement: "dumbbells",
      furniture: "none",
      scale: 1.05,
      centerZ: 0,
      neutralGrip: true,
    },
    labels: label("Dumbbell shrug", "Dumbbell shrug"),
    phases: {
      en: {
        lower: "Shrug your shoulders straight up toward your ears",
        touch: "Pause at the top",
        press: "Lower your shoulders slowly",
        lockout: "Arms straight, shoulders relaxed",
      },
      nl: {
        lower: "Trek je schouders recht omhoog naar je oren",
        touch: "Pauzeer bovenin",
        press: "Laat je schouders langzaam zakken",
        lockout: "Armen gestrekt, schouders ontspannen",
      },
    },
    cues: {
      en: [
        "Stand tall with a dumbbell in each hand at your sides, arms straight.",
        "Lift your shoulders straight up toward your ears. Don't roll them.",
        "Keep your arms straight and your head still. Pause at the top.",
        "Lower slowly until your shoulders are relaxed again.",
      ],
      nl: [
        "Sta rechtop met een dumbbell in elke hand langs je lichaam, armen gestrekt.",
        "Til je schouders recht omhoog naar je oren. Draai ze niet rond.",
        "Houd je armen gestrekt en je hoofd stil. Pauzeer bovenin.",
        "Laat langzaam zakken tot je schouders weer ontspannen zijn.",
      ],
    },
  },
  "landmine-t-bar-row": {
    figure: {
      pose: landmineRowPose,
      implement: "w5-landmine",
      furniture: "none",
      scale: 1.2,
      centerZ: -52,
    },
    labels: label("Landmine T-bar row", "Landmine T-bar row"),
    phases: {
      en: {
        lower: "Row the handle toward your chest, elbows back",
        touch: "Squeeze your shoulder blades",
        press: "Lower the bar under control",
        lockout: "Arms long, back flat",
      },
      nl: {
        lower: "Roei de handgreep naar je borst, ellebogen naar achteren",
        touch: "Knijp je schouderbladen samen",
        press: "Laat de stang gecontroleerd zakken",
        lockout: "Lange armen, rug recht",
      },
    },
    cues: {
      en: [
        "Straddle the bar with the far end anchored in a landmine, feet planted either side.",
        "Hinge to about 45 degrees with soft knees and a flat back, hands on the V-handle.",
        "Row the handle toward your chest with your elbows back. The bar swings on an arc.",
        "Pause and squeeze, then lower to straight arms without moving your torso.",
      ],
      nl: [
        "Sta schrap boven de stang waarvan het ene uiteinde in een landmine zit, voeten aan weerszijden.",
        "Buig tot ongeveer 45 graden met zachte knieën en een rechte rug, handen op de V-handgreep.",
        "Roei de handgreep naar je borst met je ellebogen naar achteren. De stang zwaait in een boog.",
        "Pauzeer en knijp, laat dan zakken tot gestrekte armen zonder je romp te bewegen.",
      ],
    },
  },
};
