import {
  ARM,
  BODY,
  ROW_BENCH_Y,
  SEAT_HIP_Y,
  STAND_SHOULDER_Y,
  ANKLE_Y,
  assemble,
  clamp01,
  cos,
  headFrom,
  hipAt,
  label,
  lerp,
  lerp3,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W6, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** Longest shoulder-to-wrist distance used for a locked-out arm (ARM is 55). */
const REACH = ARM - 0.2;

/* ------------------------------------------------------------------ */
/* Smith machine flat bench press                                      */
/* ------------------------------------------------------------------ */

/** Height of a lying figure's shoulder and hip joints above the floor (flat
 *  bench top 45 plus 10), as in the dumbbell bench press. */
const LYING_Y = ROW_BENCH_Y + 10;
const LYING_SHOULDER_Z = -8;
const LYING_HIP_Z = LYING_SHOULDER_Z + BODY.torso;

/** Grip half-width, the bar's z (it only moves up and down the rails) and its
 *  height at the chest and at lockout. At the bottom the forearm is vertical and
 *  the elbow sits about 45 degrees from the torso, which fixes the z. */
export const SMITH_FLAT_GRIP = 37;
const SF_BOTTOM_Y = LYING_Y + 12;
const SF_ELBOW_DX = SMITH_FLAT_GRIP - BODY.shoulderHalf;
const SF_ELBOW_DY = SF_BOTTOM_Y - 26 - LYING_Y;
const SF_DZ = Math.sqrt(29 * 29 - SF_ELBOW_DX * SF_ELBOW_DX - SF_ELBOW_DY * SF_ELBOW_DY);
export const SMITH_FLAT_Z = LYING_SHOULDER_Z + SF_DZ;
const SF_TOP_Y = LYING_Y + Math.sqrt(REACH * REACH - SF_ELBOW_DX * SF_ELBOW_DX - SF_DZ * SF_DZ);
export const SMITH_FLAT_BOTTOM_Y = SF_BOTTOM_Y;
export const SMITH_FLAT_TOP_Y = SF_TOP_Y;

/** Smith machine flat bench press: lying on a flat bench, feet flat, the bar
 *  runs straight up and down the rails over the mid chest. Depth 0 = lockout,
 *  1 = bar on the chest. */
export function smithFlatPressPose(depth: number): FigurePose {
  const y = lerp(SF_TOP_Y, SF_BOTTOM_Y, depth);
  return assemble({
    hip: { y: LYING_Y, z: LYING_HIP_Z },
    shoulder: { y: LYING_Y, z: LYING_SHOULDER_Z },
    head: [0, LYING_Y, LYING_SHOULDER_Z - 22],
    ankleZ: LYING_HIP_Z + 26,
    footHalf: 28,
    wrist: (s) => [s * SMITH_FLAT_GRIP, y, SMITH_FLAT_Z],
    bar: [0, y, SMITH_FLAT_Z],
    kneePole: (s) => [s * 0.3, 1, 0.2],
    elbowPole: (s) => [s * SF_ELBOW_DX, SF_ELBOW_DY, SF_DZ],
  });
}

/* ------------------------------------------------------------------ */
/* Smith machine squat                                                 */
/* ------------------------------------------------------------------ */

/** The bar rides on the traps 6 cm behind the shoulder joint; its z never
 *  changes because the rails are vertical. */
export const SMITH_SQUAT_BAR_Z = -6;
const SQ_BAR_ABOVE = 4;

/** Smith machine squat: the feet stand just in front of the bar and the
 *  shoulders stay over the ankles while the hips travel back and down, so the
 *  torso is more upright than in a free back squat. Depth 0 = standing,
 *  1 = just below parallel. */
export function smithSquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shoulder = { y: lerp(STAND_SHOULDER_Y, 82, e), z: 0 };
  const hip = hipAt(shoulder, { y: ANKLE_Y, z: 0 }, lerp(87.6, 44, e));
  const lean = (Math.atan2(shoulder.z - hip.z, shoulder.y - hip.y) * 180) / Math.PI;
  const bar: V3 = [0, shoulder.y + SQ_BAR_ABOVE, SMITH_SQUAT_BAR_Z];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.35),
    ankleZ: 0,
    footHalf: 17,
    wrist: (s) => [s * 28, bar[1], bar[2]],
    bar,
    kneePole: (s) => [s * 0.4, 0, 1],
    elbowPole: (s) => [s * 0.3, -1, -0.7],
  });
}

/* ------------------------------------------------------------------ */
/* Decline barbell bench press                                         */
/* ------------------------------------------------------------------ */

/** The bench is tilted so the head is lower than the hips. */
export const DECLINE_ANGLE = 22;
export const DECLINE_SHOULDER = { y: 56, z: -14 };
/** Where the knee bends: the thigh follows the bench, the shin hangs down
 *  and forward to the ankle rollers. */
const DECLINE_SHIN = -45;

/** A point `a` cm along the torso from the shoulder toward the hips and `out`
 *  cm up out of the body (negative = into the pad), on the bench plane. */
export function declinePoint(a: number, out = 0): { y: number; z: number } {
  return {
    y: DECLINE_SHOULDER.y + a * sin(DECLINE_ANGLE) + out * cos(DECLINE_ANGLE),
    z: DECLINE_SHOULDER.z + a * cos(DECLINE_ANGLE) - out * sin(DECLINE_ANGLE),
  };
}

const DECLINE_GRIP = 37;
const DEC_DX = DECLINE_GRIP - BODY.shoulderHalf;
/** Bar on the lower chest: 25 cm down the torso, 12 cm out of it. */
const DEC_BOTTOM = declinePoint(25, 12);
const DEC_TOP_Z = DECLINE_SHOULDER.z + 4;
const DEC_TOP_Y = DECLINE_SHOULDER.y + Math.sqrt(REACH * REACH - DEC_DX * DEC_DX - 4 * 4);
export const DECLINE_BAR_BOTTOM = DEC_BOTTOM;
export const DECLINE_BAR_TOP = { y: DEC_TOP_Y, z: DEC_TOP_Z };

const decHip = declinePoint(BODY.torso);
const decKnee = {
  y: decHip.y + BODY.thigh * sin(DECLINE_ANGLE),
  z: decHip.z + BODY.thigh * cos(DECLINE_ANGLE),
};
/** The ankle (hooked under the roller) and the foot angle that keeps the sole
 *  square to the shin. */
export const DECLINE_ANKLE = {
  y: decKnee.y + BODY.shin * sin(DECLINE_SHIN),
  z: decKnee.z + BODY.shin * cos(DECLINE_SHIN),
};
export const DECLINE_SHIN_ANGLE = DECLINE_SHIN;

/** Decline barbell bench press: lying head-down on a decline bench with the
 *  ankles hooked under the rollers, the bar lowers to the lower chest and
 *  presses back up. Depth 0 = lockout, 1 = bar on the chest. */
export function declineBenchPose(depth: number): FigurePose {
  const y = lerp(DEC_TOP_Y, DEC_BOTTOM.y, depth);
  const z = lerp(DEC_TOP_Z, DEC_BOTTOM.z, Math.pow(depth, 1.6));
  const shoulder = DECLINE_SHOULDER;
  const bottomElbow: V3 = [DEC_DX, DEC_BOTTOM.y - 26 - shoulder.y, DEC_BOTTOM.z - shoulder.z];
  return assemble({
    hip: decHip,
    shoulder,
    head: [0, shoulder.y - 22 * sin(DECLINE_ANGLE), shoulder.z - 22 * cos(DECLINE_ANGLE)],
    ankleZ: DECLINE_ANKLE.z,
    footHalf: 16,
    ankle: (s) => [s * 16, DECLINE_ANKLE.y, DECLINE_ANKLE.z],
    foot: () => ({ floor: DECLINE_ANKLE.y - 2, dir: 1, angle: DECLINE_SHIN + 90 }),
    wrist: (s) => [s * DECLINE_GRIP, y, z],
    bar: [0, y, z],
    kneePole: (s) => [s * 0.15, 1, 0],
    elbowPole: (s) => [s * bottomElbow[0], bottomElbow[1], bottomElbow[2]],
  });
}

/* ------------------------------------------------------------------ */
/* Machine shoulder press                                              */
/* ------------------------------------------------------------------ */

const MS_BACK = 10;
const MS_HIP = { y: SEAT_HIP_Y, z: 0 };
export const MACHINE_PRESS_SHOULDER = {
  y: MS_HIP.y + BODY.torso * cos(MS_BACK),
  z: MS_HIP.z - BODY.torso * sin(MS_BACK),
};

/** Handle path: at the bottom the forearm is vertical with the handle at chin
 *  height, at the top the arms are straight and the handles converge. */
const MP_BOTTOM_X = 38;
const MP_BOTTOM_UP = 10;
const MP_BOTTOM_ELBOW_DY = MP_BOTTOM_UP - 26;
const MP_BOTTOM_DZ = Math.sqrt(
  29 * 29 - (MP_BOTTOM_X - BODY.shoulderHalf) ** 2 - MP_BOTTOM_ELBOW_DY ** 2,
);
const MP_TOP_X = 22;
const MP_TOP_DZ = 8;
const MP_TOP_UP = Math.sqrt(
  REACH * REACH - (MP_TOP_X - BODY.shoulderHalf) ** 2 - MP_TOP_DZ * MP_TOP_DZ,
);
export const MACHINE_PRESS_BOTTOM: V3 = [
  MP_BOTTOM_X,
  MACHINE_PRESS_SHOULDER.y + MP_BOTTOM_UP,
  MACHINE_PRESS_SHOULDER.z + MP_BOTTOM_DZ,
];
export const MACHINE_PRESS_TOP: V3 = [
  MP_TOP_X,
  MACHINE_PRESS_SHOULDER.y + MP_TOP_UP,
  MACHINE_PRESS_SHOULDER.z + MP_TOP_DZ,
];

/** Machine shoulder press: back flat on the pad, hips on the seat, the
 *  handles start at chin height with vertical forearms and press up and
 *  slightly together. Depth 0 = lockout, 1 = handles at the bottom. */
export function machineShoulderPressPose(depth: number): FigurePose {
  const shoulder = MACHINE_PRESS_SHOULDER;
  const w = (s: -1 | 1): V3 => {
    const m = lerp3(MACHINE_PRESS_TOP, MACHINE_PRESS_BOTTOM, depth);
    return [s * m[0], m[1], m[2]];
  };
  const mid = w(1);
  return assemble({
    hip: MS_HIP,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 40,
    footHalf: 24,
    wrist: w,
    bar: [0, mid[1], mid[2]],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * (MP_BOTTOM_X - BODY.shoulderHalf), MP_BOTTOM_ELBOW_DY, MP_BOTTOM_DZ],
  });
}

/* ------------------------------------------------------------------ */
/* Machine hack squat                                                  */
/* ------------------------------------------------------------------ */

/** The back pad and the rails it slides on lean back by this much from vertical. */
export const HACK_TILT = 40;
/** The foot platform is a low plate; the ankles stand ANKLE_Y above it. */
export const HACK_PLATFORM_Y = 5;
export const HACK_ANKLE = { y: HACK_PLATFORM_Y + ANKLE_Y, z: 0 };
const HACK_FOOT_HALF = 16;
/** Hip at the bottom: thighs about level, shins 33 degrees from vertical. */
const HACK_SHIN = 30;
const hackKnee = {
  y: HACK_ANKLE.y + BODY.shin * cos(HACK_SHIN),
  z: HACK_ANKLE.z + BODY.shin * sin(HACK_SHIN),
};
const HACK_BOTTOM_HIP_Y = hackKnee.y - 2;
export const HACK_BOTTOM_HIP = {
  y: HACK_BOTTOM_HIP_Y,
  z: hackKnee.z - Math.sqrt(BODY.thigh * BODY.thigh - 2 * 2),
};
/** The sled moves along (-sin, cos) of the tilt; this is how far up the rails
 *  the hip is at lockout, where the leg is almost straight. */
const HACK_LOCK_REACH = 87.5;
const hackAxis = { z: -sin(HACK_TILT), y: cos(HACK_TILT) };
function hackTravelTop(): number {
  const rz = HACK_BOTTOM_HIP.z - HACK_ANKLE.z;
  const ry = HACK_BOTTOM_HIP.y - HACK_ANKLE.y;
  const b = 2 * (rz * hackAxis.z + ry * hackAxis.y);
  const c = rz * rz + ry * ry - HACK_LOCK_REACH * HACK_LOCK_REACH;
  return (-b + Math.sqrt(b * b - 4 * c)) / 2;
}
export const HACK_TRAVEL = hackTravelTop();
/** Unit vectors up the pad (hip to shoulder) and out of the chest. */
export const HACK_UP = hackAxis;
export const HACK_FORWARD = { z: cos(HACK_TILT), y: sin(HACK_TILT) };

/** The point `t` cm up the rails from the bottom position, `a` cm along the
 *  torso from the hip and `out` cm out of the front of the body. */
export function hackPoint(t: number, a: number, out = 0): { y: number; z: number } {
  return {
    y: HACK_BOTTOM_HIP.y + (t + a) * HACK_UP.y + out * HACK_FORWARD.y,
    z: HACK_BOTTOM_HIP.z + (t + a) * HACK_UP.z + out * HACK_FORWARD.z,
  };
}

/** Machine hack squat: shoulders under the pads and the back on the inclined
 *  pad, feet low on the platform. The sled runs along the rails, the hips
 *  drop toward the heels and the knees travel forward. Depth 0 = legs almost
 *  straight, 1 = thighs about level. */
export function hackSquatPose(depth: number): FigurePose {
  const t = lerp(HACK_TRAVEL, 0, depth);
  const hip = hackPoint(t, 0);
  const shoulder = hackPoint(t, BODY.torso);
  // Hands hold the side handles, just below and in front of the shoulders.
  const grip = hackPoint(t, BODY.torso - 20, 12);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, -HACK_TILT * 0.55),
    ankleZ: 0,
    footHalf: HACK_FOOT_HALF,
    ankle: (s) => [s * HACK_FOOT_HALF, HACK_ANKLE.y, HACK_ANKLE.z],
    foot: () => ({ floor: HACK_PLATFORM_Y, dir: 1 }),
    wrist: (s) => [s * 27, grip.y, grip.z],
    bar: [0, grip.y, grip.z],
    kneePole: (s) => [s * 0.35, 0, 1],
    elbowPole: (s) => [s * 0.8, -0.6, -0.7],
  });
}

/* ------------------------------------------------------------------ */
/* Dumbbell Arnold press                                               */
/* ------------------------------------------------------------------ */

const AR_HIP = { y: SEAT_HIP_Y, z: 0 };
const AR_BACK = 10;
export const ARNOLD_SHOULDER = {
  y: AR_HIP.y + BODY.torso * cos(AR_BACK),
  z: AR_HIP.z - BODY.torso * sin(AR_BACK),
};
/** Dumbbell height at the bottom (chin) and at lockout, relative to the shoulder. */
const AR_BOTTOM: V3 = [16, 10, 22];
const AR_TOP_X = 22;
const AR_TOP_Z = 6;
const AR_TOP_UP = Math.sqrt(
  REACH * REACH - (AR_TOP_X - BODY.shoulderHalf) ** 2 - AR_TOP_Z * AR_TOP_Z,
);
export const ARNOLD_Y0 = ARNOLD_SHOULDER.y + AR_BOTTOM[1];
export const ARNOLD_Y1 = ARNOLD_SHOULDER.y + AR_TOP_UP;

/** How far through the turn the dumbbells are (0 = palms facing you at chin
 *  height, 1 = palms forward at lockout), from the wrist height. */
export function arnoldProgress(wristY: number): number {
  return clamp01((wristY - ARNOLD_Y0) / (ARNOLD_Y1 - ARNOLD_Y0));
}

/** Angle (degrees) of the dumbbell's axis from the left-right direction: 0
 *  with the palms facing you or forward, 90 (axis pointing forward) when the
 *  hands are halfway through the turn. */
export function arnoldTurn(progress: number): number {
  return 180 * smooth(clamp01(progress));
}

/** Dumbbell Arnold press: seated with the back on the pad. The dumbbells start
 *  in front of the chin with the palms facing you and elbows forward; as they
 *  rise the elbows swing out and the palms turn forward, finishing straight
 *  overhead. Depth 0 = lockout, 1 = start position. */
export function arnoldPressPose(depth: number): FigurePose {
  const shoulder = ARNOLD_SHOULDER;
  const r = 1 - depth; // 0 at the start (chin), 1 at lockout
  const e = smooth(r);
  const y = lerp(ARNOLD_Y0, ARNOLD_Y1, r);
  // Out and forward in the middle so the dumbbells pass clear of the face.
  const x = lerp(AR_BOTTOM[0], AR_TOP_X, e) + 5 * sin(180 * r);
  const z = shoulder.z + lerp(AR_BOTTOM[2], AR_TOP_Z, smooth(clamp01((r - 0.65) / 0.35)));
  const pole = (s: -1 | 1): V3 => lerp3([s * 0.1, -0.7, 1], [s * 1, -0.35, 0.15], e);
  return assemble({
    hip: AR_HIP,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 40,
    footHalf: 24,
    wrist: (s) => [s * x, y, z],
    bar: [0, y, z],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: pole,
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W6: Record<string, ExerciseAnimationSpec> = {
  "smith-flat-press": {
    figure: {
      pose: smithFlatPressPose,
      implement: "w3-smith-bar",
      furniture: "w6-smith-flat",
      scale: 1.2,
      centerZ: 20,
    },
    labels: label("Smith machine flat press", "Vlakke bankdruk in de Smith machine"),
    phases: {
      en: {
        lower: "Lower the bar straight down to your mid chest",
        touch: "Bar on your chest, wrists over elbows",
        press: "Press straight up along the rails",
        lockout: "Lock out over your chest",
      },
      nl: {
        lower: "Laat de stang recht omlaag zakken naar het midden van je borst",
        touch: "Stang op je borst, polsen boven ellebogen",
        press: "Duw recht omhoog langs de rails",
        lockout: "Strek boven je borst",
      },
    },
    cues: {
      en: [
        "Lie on a flat bench with the bar lined up over your mid chest and your feet planted flat.",
        "Pull your shoulder blades back and down, grip the bar just wider than your shoulders and twist it off the hooks.",
        "Lower the bar straight down until it just touches your chest, elbows at about 45 degrees. Don't bounce.",
        "Press straight up along the rails and lock out. Re-hook the bar when you are done.",
      ],
      nl: [
        "Ga op een vlakke bank liggen met de stang boven het midden van je borst en je voeten plat neer.",
        "Trek je schouderbladen naar achteren en omlaag, pak de stang net breder dan je schouders en draai hem van de haken.",
        "Laat de stang recht omlaag zakken tot hij je borst net raakt, ellebogen op ongeveer 45 graden. Niet stuiteren.",
        "Duw recht omhoog langs de rails en strek je armen. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  "smith-squat": {
    figure: {
      pose: smithSquatPose,
      implement: "w3-smith-bar",
      furniture: "w6-smith-squat",
      scale: 0.95,
      centerZ: -4,
    },
    labels: label("Smith machine squat", "Squat in de Smith machine"),
    phases: {
      en: {
        lower: "Sit back and down along the rails",
        touch: "Thighs just below parallel, heels down",
        press: "Drive through your whole foot",
        lockout: "Stand tall, bar over your mid-foot",
      },
      nl: {
        lower: "Zak naar achteren en omlaag langs de rails",
        touch: "Dijen net onder horizontaal, hielen op de grond",
        press: "Duw door je hele voet omhoog",
        lockout: "Sta rechtop, stang boven het midden van je voet",
      },
    },
    cues: {
      en: [
        "Set the bar at upper-chest height, step under it and rest it on your upper back. Twist to unhook it.",
        "Place your feet a little in front of the bar, about shoulder-width apart.",
        "Sit back and down along the fixed path until your thighs are just below parallel. Keep your heels flat.",
        "Drive up through your whole foot to stand tall. Twist the bar back onto the hooks when you finish.",
      ],
      nl: [
        "Zet de stang op bovenborsthoogte, stap eronder en leg hem op je bovenrug. Draai om hem los te maken.",
        "Zet je voeten een stukje voor de stang, ongeveer op schouderbreedte.",
        "Zak naar achteren en omlaag langs het vaste pad tot je dijen net onder horizontaal zijn. Houd je hielen plat.",
        "Duw door je hele voet omhoog tot je rechtop staat. Draai de stang terug op de haken als je klaar bent.",
      ],
    },
  },
  "decline-bench": {
    figure: {
      pose: declineBenchPose,
      implement: "barbell",
      furniture: "w6-decline-bench",
      scale: 1.15,
      centerZ: 29,
    },
    labels: label("Decline barbell bench press", "Bankdrukken op een afhellende bank"),
    phases: {
      en: {
        lower: "Lower the bar to your lower chest",
        touch: "Bar on your lower chest, wrists over elbows",
        press: "Press up and slightly back",
        lockout: "Lock out over your chest",
      },
      nl: {
        lower: "Laat de stang zakken naar je onderste borst",
        touch: "Stang op je onderste borst, polsen boven ellebogen",
        press: "Duw omhoog en iets naar achteren",
        lockout: "Strek boven je borst",
      },
    },
    cues: {
      en: [
        "Hook your ankles securely under the rollers and lie back so your head is lower than your hips.",
        "Pull your shoulder blades back and down and grip the bar just wider than your shoulders.",
        "Lower the bar under control to your lower chest, elbows about 45 degrees from your torso.",
        "Press up and slightly back to lockout over your chest. Use a spotter, because the head-down angle makes it hard to bail.",
      ],
      nl: [
        "Haak je enkels stevig onder de rollers en ga achterover liggen zodat je hoofd lager ligt dan je heupen.",
        "Trek je schouderbladen naar achteren en omlaag en pak de stang net breder dan je schouders.",
        "Laat de stang gecontroleerd zakken naar je onderste borst, ellebogen op ongeveer 45 graden van je romp.",
        "Duw omhoog en iets naar achteren tot je boven je borst gestrekt bent. Gebruik een spotter, want met je hoofd omlaag kun je lastig afhaken.",
      ],
    },
  },
  "machine-shoulder-press": {
    figure: {
      pose: machineShoulderPressPose,
      implement: "w6-press-machine",
      furniture: "upright-bench",
      scale: 1.0,
      centerZ: 8,
    },
    labels: label("Machine shoulder press", "Schouderpers op de machine"),
    phases: {
      en: {
        lower: "Lower the handles to chin height",
        touch: "Forearms vertical, back on the pad",
        press: "Press up and slightly together",
        lockout: "Arms long overhead, shoulders down",
      },
      nl: {
        lower: "Laat de handgrepen zakken tot kinhoogte",
        touch: "Onderarmen verticaal, rug tegen het kussen",
        press: "Duw omhoog en iets naar elkaar toe",
        lockout: "Armen gestrekt boven je hoofd, schouders omlaag",
      },
    },
    cues: {
      en: [
        "Set the seat so the handles start at about chin height. Sit with your back flat against the pad.",
        "Grip the handles with your wrists stacked over your elbows and your feet flat on the floor.",
        "Press the handles up and slightly together until your arms are almost straight.",
        "Don't shrug at the top. Lower under control to chin height.",
      ],
      nl: [
        "Stel het zadel zo in dat de handgrepen op ongeveer kinhoogte beginnen. Zit met je rug plat tegen het kussen.",
        "Pak de handgrepen vast met je polsen boven je ellebogen en je voeten plat op de grond.",
        "Duw de handgrepen omhoog en iets naar elkaar toe tot je armen bijna gestrekt zijn.",
        "Haal je schouders bovenin niet op. Laat gecontroleerd zakken tot kinhoogte.",
      ],
    },
  },
  "hack-squat": {
    figure: {
      pose: hackSquatPose,
      implement: "none",
      furniture: "w6-hack-squat",
      scale: 1.05,
      centerZ: -36,
    },
    labels: label("Machine hack squat", "Hack squat op de machine"),
    phases: {
      en: {
        lower: "Bend your knees and sit down along the rails",
        touch: "Thighs about level, heels flat",
        press: "Drive through your whole foot",
        lockout: "Legs almost straight, back on the pad",
      },
      nl: {
        lower: "Buig je knieën en zak langs de rails omlaag",
        touch: "Dijen ongeveer horizontaal, hielen plat",
        press: "Duw door je hele voet omhoog",
        lockout: "Benen bijna gestrekt, rug op het kussen",
      },
    },
    cues: {
      en: [
        "Step onto the platform with your feet low and about shoulder-width apart, and put your shoulders under the pads.",
        "Keep your whole back against the pad and hold the side handles.",
        "Lower under control until your thighs are about level. Your knees travel forward over your toes and your heels stay down.",
        "Drive up through your whole foot and stop just short of locking your knees.",
      ],
      nl: [
        "Stap op het platform met je voeten laag en ongeveer op schouderbreedte en zet je schouders onder de pads.",
        "Houd je hele rug tegen het kussen en pak de handgrepen aan de zijkant vast.",
        "Zak gecontroleerd tot je dijen ongeveer horizontaal zijn. Je knieën gaan naar voren over je tenen en je hielen blijven omlaag.",
        "Duw door je hele voet omhoog en stop vlak voordat je je knieën op slot zet.",
      ],
    },
  },
  "db-arnold-press": {
    figure: {
      pose: arnoldPressPose,
      implement: "w6-arnold-db",
      furniture: "upright-bench",
      scale: 1.05,
      centerZ: 14,
    },
    labels: label("Dumbbell Arnold press", "Arnold press met dumbbells"),
    phases: {
      en: {
        lower: "Lower and turn your palms back toward you",
        touch: "Dumbbells at chin height, palms facing you",
        press: "Press up and rotate your palms forward",
        lockout: "Arms straight overhead, palms forward",
      },
      nl: {
        lower: "Zak en draai je handpalmen terug naar je toe",
        touch: "Dumbbells op kinhoogte, handpalmen naar je toe",
        press: "Duw omhoog en draai je handpalmen naar voren",
        lockout: "Armen gestrekt boven je hoofd, handpalmen naar voren",
      },
    },
    cues: {
      en: [
        "Sit on an upright bench with your back against the pad. Hold the dumbbells at chin height, palms facing you and elbows in front.",
        "Press up and rotate your palms outward at the same time, as one smooth move.",
        "Finish with your arms straight overhead and your palms facing forward. Keep your ribs down and don't arch your back.",
        "Lower and rotate your palms back toward you until the dumbbells are at chin height again.",
      ],
      nl: [
        "Ga op een rechte bank zitten met je rug tegen het kussen. Houd de dumbbells op kinhoogte, handpalmen naar je toe en ellebogen voor je.",
        "Duw omhoog en draai tegelijk je handpalmen naar buiten, in één vloeiende beweging.",
        "Eindig met gestrekte armen boven je hoofd en handpalmen naar voren. Houd je ribben omlaag en maak geen holle rug.",
        "Zak en draai je handpalmen terug naar je toe tot de dumbbells weer op kinhoogte zijn.",
      ],
    },
  },
};
