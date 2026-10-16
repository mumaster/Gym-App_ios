import {
  ARM,
  BODY,
  PULLUP_BAR_Y,
  SEAT_HIP_Y,
  assemble,
  cos,
  hangShoulderY,
  headFrom,
  label,
  lerp,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W15 (core: captain's chair, hanging knee raise, ab crunch
 *  machine, rollout, decline sit-up; plus the bar triceps extension), merged
 *  into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

const LEG = BODY.thigh + BODY.shin - 0.1; // a straight leg, hip to ankle
const REACH = ARM - 0.3; // a locked-out arm, shoulder to wrist

/* ------------------------------------------------------------------ */
/* Captain's chair (leg raise and knee raise)                          */
/* ------------------------------------------------------------------ */

/** Shoulder height of the lifter held up by the forearm pads: the legs hang
 *  with the toes about 14 cm off the floor. */
export const CC_SHOULDER_Y = 157;
/** Centre line of the back pad: with its 4 cm thickness the face is at
 *  CC_PAD_Z + 4, right behind the 20 cm wide torso and the head. */
export const CC_PAD_Z = -15;
/** Forearm pads: the elbows sit right under the shoulders, the forearms lie
 *  forward on the pads and the hands grip the handles at their ends. */
const CC_UPPER_TILT = 3; // upper arm, degrees forward of vertical
const CC_FOREARM_TILT = 4; // forearm, degrees above horizontal

/** The wrist (and its grip handle) of one side of the captain's chair. */
export function ccArms() {
  const shoulderY = CC_SHOULDER_Y;
  const elbow = { y: shoulderY - 29 * cos(CC_UPPER_TILT), z: 29 * sin(CC_UPPER_TILT) };
  const wrist = {
    y: elbow.y + 26 * sin(CC_FOREARM_TILT),
    z: elbow.z + 26 * cos(CC_FOREARM_TILT),
  };
  return { elbow, wrist };
}
export const CC_HAND_X = 19;

/** Shared build of the captain's chair poses: shoulders fixed on the forearm
 *  pads, the back against the pad, the hips curling forward a little. */
function captainPose(
  e: number,
  leg: (hip: { y: number; z: number }) => { ankle: V3; angle: number; kneePole: V3 },
): FigurePose {
  const shoulder = { y: CC_SHOULDER_Y, z: 0 };
  const lean = lerp(0, -7, e);
  const hip = {
    y: shoulder.y - BODY.torso * cos(lean),
    z: shoulder.z - BODY.torso * sin(lean),
  };
  const { wrist } = ccArms();
  const l = leg(hip);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: l.ankle[2],
    footHalf: 10,
    ankle: (s) => [s * 10, l.ankle[1], l.ankle[2]],
    foot: () => ({ floor: Math.max(0, l.ankle[1] - 2), dir: 1, angle: l.angle }),
    wrist: (s) => [s * CC_HAND_X, wrist.y, wrist.z],
    bar: [0, wrist.y, wrist.z],
    kneePole: () => l.kneePole,
    elbowPole: (s) => [s * 0.05, -1, 0],
  });
}

/** Captain's chair leg raise: the straight legs swing up to hip height while
 *  the pelvis curls forward off the back pad. Depth 0 = legs hanging. */
export function captainsLegRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const a = lerp(4, 86, e); // legs, degrees from hanging straight down
  return captainPose(e, (hip) => ({
    ankle: [0, hip.y - LEG * cos(a), hip.z + LEG * sin(a)],
    angle: a - 45,
    kneePole: [0, 1, 1],
  }));
}

/** Knee raise from a hang: the thigh swings up while the knee bends more and
 *  more, so the shin stays about vertical and the knee ends up at the chest. */
export function kneeRaiseLegs(
  e: number,
  hip: { y: number; z: number },
  top = 125,
): { ankle: V3; angle: number; kneePole: V3 } {
  const theta = lerp(3, top, e); // thigh from hanging straight down
  const flex = lerp(8, top - 5, e); // knee flexion (the shin ends about vertical)
  const psi = theta - flex; // shin from hanging straight down
  const knee = {
    y: hip.y - BODY.thigh * cos(theta),
    z: hip.z + BODY.thigh * sin(theta),
  };
  return {
    ankle: [0, knee.y - BODY.shin * cos(psi), knee.z + BODY.shin * sin(psi)],
    angle: psi - 45,
    kneePole: [0, 0.5, 1],
  };
}

/** Captain's chair knee raise. Depth 0 = hanging, 1 = knees at the chest. */
export function captainsKneeRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  return captainPose(e, (hip) => kneeRaiseLegs(e, hip));
}

/* ------------------------------------------------------------------ */
/* Hanging knee raise                                                  */
/* ------------------------------------------------------------------ */

/** Hanging knee raise: arms straight on the pull-up bar, the knees bend and
 *  rise to the chest while the pelvis curls up. Depth 0 = hanging. */
export function hangingKneeRaisePose(depth: number): FigurePose {
  const e = smooth(depth);
  const grip = 26;
  const shoulder = { y: hangShoulderY(grip), z: 0 };
  const lean = lerp(2, -13, e);
  const hip = {
    y: shoulder.y - BODY.torso * cos(lean),
    z: shoulder.z - BODY.torso * sin(lean),
  };
  const l = kneeRaiseLegs(e, hip, 135);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: l.ankle[2],
    footHalf: 10,
    ankle: (s) => [s * 10, l.ankle[1], l.ankle[2]],
    foot: () => ({ floor: Math.max(0, l.ankle[1] - 2), dir: 1, angle: l.angle }),
    wrist: (s) => [s * grip, PULLUP_BAR_Y, 0],
    bar: [0, PULLUP_BAR_Y, 0],
    kneePole: () => l.kneePole,
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Ab crunch machine                                                   */
/* ------------------------------------------------------------------ */

/** Seated with the back on the pad, hips on the seat. The chest pad sits on
 *  the lever arms that pivot beside the hips, so the pad moves on a circle
 *  of radius ACM_ARM about the hip joint. */
export const ACM_HIP = { y: SEAT_HIP_Y, z: 0 };
export const ACM_BACK = 10; // back pad tilt (degrees from vertical)
export const ACM_ARM = 36; // pivot to the centre of the chest pad
export const ACM_PAD_OFF = 14; // pad centre in front of the torso axis
const ACM_LEAN = { from: -ACM_BACK, to: 36 };
const ACM_TORSO = { from: BODY.torso, to: 43 };

/** The unit vectors along the torso and out of the chest, side view (y, z). */
export function acmAxes(lean: number) {
  return {
    dir: { y: cos(lean), z: sin(lean) },
    out: { y: -sin(lean), z: cos(lean) },
  };
}

/** Ab crunch machine: the torso curls forward over the hips (the spine
 *  rounds, so the shoulder-to-hip distance shortens) and pushes the chest pad
 *  down and forward on its lever. Depth 0 = upright against the back pad. */
export function abCrunchMachinePose(depth: number): FigurePose {
  const e = smooth(depth);
  const lean = lerp(ACM_LEAN.from, ACM_LEAN.to, e);
  const torso = lerp(ACM_TORSO.from, ACM_TORSO.to, e);
  const hip = ACM_HIP;
  const shoulder = { y: hip.y + torso * cos(lean), z: hip.z + torso * sin(lean) };
  const { dir, out } = acmAxes(lean);
  // Pad centre on the circle about the hip: the contact slides up the chest a
  // little as the torso shortens.
  const along = Math.sqrt(ACM_ARM * ACM_ARM - ACM_PAD_OFF * ACM_PAD_OFF);
  const pad = {
    y: hip.y + along * dir.y + ACM_PAD_OFF * out.y,
    z: hip.z + along * dir.z + ACM_PAD_OFF * out.z,
  };
  // The hands hold the handles at the upper edge of the pad.
  const hand: V3 = [0, pad.y + 18 * dir.y + 17 * out.y, pad.z + 18 * dir.z + 17 * out.z];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean + lerp(0, 16, e)),
    ankleZ: 42,
    footHalf: 14,
    wrist: (s) => [s * 15, hand[1], hand[2]],
    bar: hand,
    kneePole: (s) => [s * 0.1, 1, 0.5],
    elbowPole: (s) => [s * 0.1, -0.6, 0.6],
  });
}

/* ------------------------------------------------------------------ */
/* Barbell rollout                                                     */
/* ------------------------------------------------------------------ */

/** A kneeling mat, 4 cm thick: knee centre 5.5 cm above it, shins on it. */
export const RO_MAT_TOP = 4;
export const RO_KNEE_Y = 9.5;
export const RO_BAR_Y = 22.5; // bar centre: the round plates rest on the floor
const RO_ANKLE: V3 = [
  0,
  RO_MAT_TOP + 8,
  -Math.sqrt(BODY.shin ** 2 - (RO_KNEE_Y - RO_MAT_TOP - 8) ** 2),
];

/** Barbell rollout: kneeling, straight arms, the bar rolls forward as the body
 *  stretches into one line from the knees to the shoulders (hips never sag),
 *  until the torso is almost level; then it rolls back. Depth 0 = hips piked
 *  with the bar under the shoulders, 1 = fully stretched out. */
export function barbellRolloutPose(depth: number): FigurePose {
  const e = smooth(depth);
  const knee = { y: RO_KNEE_Y, z: 0 };
  const thighAngle = lerp(12, 78, e); // thigh from vertical
  const torsoAngle = lerp(64, 78, e); // torso from vertical
  const hip = {
    y: knee.y + BODY.thigh * cos(thighAngle),
    z: knee.z + BODY.thigh * sin(thighAngle),
  };
  const shoulder = {
    y: hip.y + BODY.torso * cos(torsoAngle),
    z: hip.z + BODY.torso * sin(torsoAngle),
  };
  const dy = shoulder.y - RO_BAR_Y;
  const gripHalf = 20;
  const dx = gripHalf - BODY.shoulderHalf;
  const barZ = shoulder.z + Math.sqrt(REACH * REACH - dy * dy - dx * dx);
  const mid = { y: (hip.y + RO_ANKLE[1]) / 2, z: (hip.z + RO_ANKLE[2]) / 2 };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, torsoAngle * 0.62),
    ankleZ: RO_ANKLE[2],
    footHalf: 8,
    ankle: (s) => [s * 8, RO_ANKLE[1], RO_ANKLE[2]],
    foot: () => ({ floor: RO_MAT_TOP, dir: -1 }),
    wrist: (s) => [s * gripHalf, RO_BAR_Y, barZ],
    bar: [0, RO_BAR_Y, barZ],
    kneePole: () => [0, knee.y - mid.y, knee.z - mid.z],
    elbowPole: (s) => [s * 0.3, 1, 0],
  });
}

/* ------------------------------------------------------------------ */
/* Decline sit-up                                                      */
/* ------------------------------------------------------------------ */

/** The bench is tilted so the head end is lower: the pad's surface under the
 *  hips is at DS_SURFACE_Y, the angle is in degrees. */
export const DS_ANGLE = 25;
export const DS_SURFACE_Y = 56;
/** The shin hangs this many degrees below horizontal toward the ankle rollers. */
export const DS_SHIN = -50;
/** The pad runs from the head end to just past the knees (a, cm along the bench from the hips). */
export const DS_PAD = { from: -92, to: 50 };

/** A point `a` cm along the bench from the hips toward the feet and `out` cm
 *  above the pad (negative = into it). */
export function dsPoint(a: number, out = 0): { y: number; z: number } {
  return {
    y: DS_SURFACE_Y + a * sin(DS_ANGLE) + out * cos(DS_ANGLE),
    z: a * cos(DS_ANGLE) - out * sin(DS_ANGLE),
  };
}
export const DS_HIP = dsPoint(0, 10);
export const DS_KNEE = {
  y: DS_HIP.y + BODY.thigh * sin(DS_ANGLE),
  z: DS_HIP.z + BODY.thigh * cos(DS_ANGLE),
};
export const DS_ANKLE = {
  y: DS_KNEE.y + BODY.shin * sin(DS_SHIN),
  z: DS_KNEE.z + BODY.shin * cos(DS_SHIN),
};

/** Decline sit-up: hips on the pad, ankles hooked under the rollers, hands
 *  across the chest; the torso curls from lying (just above the pad) up to
 *  sitting almost upright. Depth 0 = lying, 1 = up. */
export function declineSitupPose(depth: number): FigurePose {
  const e = smooth(depth);
  const psi = lerp(180 + DS_ANGLE - 2, 88, e); // torso direction, degrees from +z (counter-clockwise)
  const torso = BODY.torso - 4 * sin(180 * e);
  const hip = DS_HIP;
  const shoulder = { y: hip.y + torso * sin(psi), z: hip.z + torso * cos(psi) };
  const neck = psi + 5 - 17 * e;
  const head: V3 = [0, shoulder.y + 22 * sin(neck), shoulder.z + 22 * cos(neck)];
  // chest: the front of the torso faces the direction rotated 90 degrees clockwise
  const front = { y: -cos(psi), z: sin(psi) };
  const dir = { y: sin(psi), z: cos(psi) };
  const hand: V3 = [14, shoulder.y - 8 * dir.y + 8 * front.y, shoulder.z - 8 * dir.z + 8 * front.z];
  return assemble({
    hip,
    shoulder,
    head,
    ankleZ: DS_ANKLE.z,
    footHalf: 16,
    ankle: (s) => [s * 12, DS_ANKLE.y, DS_ANKLE.z],
    foot: () => ({ floor: DS_ANKLE.y - 2, dir: 1, angle: DS_SHIN + 90 }),
    wrist: (s) => [-s * hand[0], hand[1], hand[2]],
    bar: hand,
    kneePole: (s) => [s * 0.15, 1, 0.2],
    elbowPole: (s) => [s * 0.2, front.y * 0.5 - dir.y, front.z * 0.5 - dir.z],
  });
}

/* ------------------------------------------------------------------ */
/* Bar triceps extension                                               */
/* ------------------------------------------------------------------ */

/** Waist-high bar at z = 0; the toes stay on the floor 150 cm behind it. */
export const BT_BAR_Y = 105;
export const BT_ANKLE: V3 = [0, 17, -150];
const BT_LEG = LEG + 0.1 - 0.03;
const BT_TOTAL = BODY.torso + BT_LEG;
const BT_GRIP = 19;

/** Shoulder position of the rigid body line at `theta` degrees above the floor. */
export function btShoulder(theta: number) {
  return { y: BT_ANKLE[1] + BT_TOTAL * sin(theta), z: BT_ANKLE[2] + BT_TOTAL * cos(theta) };
}
const btReach = (theta: number) => {
  const s = btShoulder(theta);
  return Math.hypot(BT_BAR_Y - s.y, -s.z);
};
function btTopAngle(): number {
  // The steepest lean at which the arms are still (almost) straight.
  let lo = 30;
  let hi = 60;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (btReach(mid) > ARM - 0.15) hi = mid;
    else lo = mid;
  }
  return lo;
}
export const BT_TOP = btTopAngle();
export const BT_BOTTOM = 31;

/** Bar triceps extension: hands on a waist-high bar, the body one rigid line
 *  from the toes, leaning in. Only the elbows bend: the head travels under the
 *  bar (the forearms stay above it) and the arms press straight again.
 *  Depth 0 = arms straight, 1 = head under the bar. */
export function barTricepsExtensionPose(depth: number): FigurePose {
  const e = smooth(depth);
  const theta = lerp(BT_TOP, BT_BOTTOM, e);
  const shoulder = btShoulder(theta);
  const hip = {
    y: BT_ANKLE[1] + BT_LEG * sin(theta),
    z: BT_ANKLE[2] + BT_LEG * cos(theta),
  };
  // Head up and forward at the top, chin tucked at the bottom (looking at the
  // floor between the hands) so the head slides under the bar and the forearms.
  const headAngle = theta + lerp(6, -55, Math.pow(e, 0.7));
  return assemble({
    hip,
    shoulder,
    head: [0, shoulder.y + 22 * sin(headAngle), shoulder.z + 22 * cos(headAngle)],
    ankleZ: BT_ANKLE[2],
    footHalf: 8,
    ankle: (s) => [s * 8, BT_ANKLE[1], BT_ANKLE[2]],
    foot: () => ({ floor: 0, dir: 1, pitch: 65 }),
    wrist: (s) => [s * BT_GRIP, BT_BAR_Y, 0],
    bar: [0, BT_BAR_Y, 0],
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => [s * 0.15, 1, -0.3],
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W15: Record<string, ExerciseAnimationSpec> = {
  "captains-chair-leg-raise": {
    figure: {
      pose: captainsLegRaisePose,
      implement: "none",
      furniture: "w15-captains-chair",
      scale: 0.95,
      centerZ: 35,
    },
    labels: label("Captain's chair leg raise", "Beenheffen in de captain's chair"),
    phases: {
      en: {
        lower: "Raise your straight legs, curling the pelvis up",
        touch: "Legs level with your hips",
        press: "Lower slowly, no swinging",
        lockout: "Hang still on your forearms, back on the pad",
      },
      nl: {
        lower: "Til je gestrekte benen op en kantel je bekken omhoog",
        touch: "Benen op heuphoogte",
        press: "Zak langzaam, zonder te zwaaien",
        lockout: "Hang stil op je onderarmen, rug tegen het kussen",
      },
    },
    cues: {
      en: [
        "Rest your forearms on the pads, grip the handles and press your back flat against the back rest.",
        "Let your legs hang straight down with your shoulders pulled away from your ears.",
        "Raise your straight legs, without swinging, until they are level with your hips.",
        "Tilt your pelvis up at the top so your abs do the work, not just your hip flexors.",
        "Lower slowly and stop any swing before the next rep.",
      ],
      nl: [
        "Leg je onderarmen op de steunen, pak de handvatten vast en druk je rug plat tegen de rugsteun.",
        "Laat je benen gestrekt naar beneden hangen met je schouders weg van je oren.",
        "Til je gestrekte benen zonder te zwaaien op tot ze op heuphoogte zijn.",
        "Kantel bovenin je bekken omhoog zodat je buikspieren het werk doen en niet alleen je heupbuigers.",
        "Zak langzaam en stop elke zwaai voor de volgende herhaling.",
      ],
    },
  },
  "captains-chair-knee-raise": {
    figure: {
      pose: captainsKneeRaisePose,
      implement: "none",
      furniture: "w15-captains-chair",
      scale: 0.95,
      centerZ: 35,
    },
    labels: label("Captain's chair knee raise", "Knieheffen in de captain's chair"),
    phases: {
      en: {
        lower: "Pull your knees up toward your chest, curling the pelvis",
        touch: "Knees at your chest, lower back rounded",
        press: "Lower slowly under control",
        lockout: "Hang still on your forearms, back on the pad",
      },
      nl: {
        lower: "Trek je knieën op naar je borst en kantel je bekken omhoog",
        touch: "Knieën bij je borst, onderrug rond",
        press: "Zak langzaam en gecontroleerd",
        lockout: "Hang stil op je onderarmen, rug tegen het kussen",
      },
    },
    cues: {
      en: [
        "Rest your forearms on the pads, grip the handles and press your back flat against the back rest.",
        "Let your legs hang with your knees together.",
        "Pull your knees up toward your chest and curl your pelvis so your lower back rounds slightly.",
        "Pause at the top without swinging, then lower slowly.",
      ],
      nl: [
        "Leg je onderarmen op de steunen, pak de handvatten vast en druk je rug plat tegen de rugsteun.",
        "Laat je benen hangen met je knieën tegen elkaar.",
        "Trek je knieën op naar je borst en kantel je bekken zodat je onderrug een beetje rond wordt.",
        "Pauzeer bovenin zonder te zwaaien en zak dan langzaam.",
      ],
    },
  },
  "hanging-knee-raise": {
    figure: {
      pose: hangingKneeRaisePose,
      implement: "none",
      furniture: "pullup-bar",
      scale: 0.8,
      centerZ: 25,
    },
    labels: label("Hanging knee raise", "Hangende knieheffing"),
    phases: {
      en: {
        lower: "Pull your knees up to your chest, curling the pelvis",
        touch: "Knees at your chest",
        press: "Lower slowly, no swinging",
        lockout: "Hang still with straight arms",
      },
      nl: {
        lower: "Trek je knieën op naar je borst en kantel je bekken omhoog",
        touch: "Knieën bij je borst",
        press: "Zak langzaam, zonder te zwaaien",
        lockout: "Hang stil met gestrekte armen",
      },
    },
    cues: {
      en: [
        "Hang from the bar with straight arms and your legs together.",
        "Bend your knees and pull them up toward your chest, curling your pelvis.",
        "Don't swing. Keep your shoulders still under the bar.",
        "Lower under control and stop the swing before the next rep.",
      ],
      nl: [
        "Hang aan de stang met gestrekte armen en je benen tegen elkaar.",
        "Buig je knieën en trek ze op naar je borst terwijl je je bekken omhoog kantelt.",
        "Zwaai niet. Houd je schouders stil onder de stang.",
        "Zak gecontroleerd en stop de zwaai voor de volgende herhaling.",
      ],
    },
  },
  "ab-crunch-machine": {
    figure: {
      pose: abCrunchMachinePose,
      implement: "none",
      furniture: "w15-ab-machine",
      scale: 1.3,
      centerZ: 14,
    },
    labels: label("Ab crunch machine", "Crunch op de buikspiermachine"),
    phases: {
      en: {
        lower: "Curl your torso forward over your hips",
        touch: "Ribs toward hips, spine rounded",
        press: "Return slowly against the pad",
        lockout: "Upright, back against the pad",
      },
      nl: {
        lower: "Rol je romp naar voren over je heupen",
        touch: "Ribben naar je heupen, rug rond",
        press: "Kom langzaam terug tegen het kussen",
        lockout: "Rechtop, rug tegen het kussen",
      },
    },
    cues: {
      en: [
        "Sit with your back against the pad and set the chest pad against your upper chest, holding the handles.",
        "Keep your hips on the seat and your feet flat on the floor.",
        "Curl your torso down against the pad, bringing your ribs toward your hips. Round the spine, don't hinge at the hips.",
        "Breathe out at the bottom, then return slowly without letting the weight stack drop.",
      ],
      nl: [
        "Ga zitten met je rug tegen het kussen en zet het borstkussen tegen je bovenste borst terwijl je de handvatten vasthoudt.",
        "Houd je heupen op de zitting en je voeten plat op de grond.",
        "Rol je romp naar voren tegen het kussen en breng je ribben naar je heupen. Maak je rug rond, buig niet vanuit je heupen.",
        "Adem onderin uit en kom dan langzaam terug zonder het gewicht te laten vallen.",
      ],
    },
  },
  "barbell-rollout": {
    figure: {
      pose: barbellRolloutPose,
      implement: "barbell",
      furniture: "w15-rollout-mat",
      scale: 1.15,
      centerZ: 49,
    },
    labels: label("Barbell rollout", "Rollout met een halterstang"),
    phases: {
      en: {
        lower: "Roll the bar forward, body in one line",
        touch: "As far as you can control, hips not sagging",
        press: "Pull the bar back with your abs",
        lockout: "Back to the start, hips piked, bar under your shoulders",
      },
      nl: {
        lower: "Rol de stang naar voren, je lichaam in één lijn",
        touch: "Zo ver als je kunt beheersen, heupen niet doorzakken",
        press: "Trek de stang met je buikspieren terug",
        lockout: "Terug naar de start, heupen hoog, stang onder je schouders",
      },
    },
    cues: {
      en: [
        "Kneel on a mat behind a barbell with round plates and grip it shoulder-width apart.",
        "Brace your abs, tuck your ribs down and squeeze your glutes.",
        "Roll the bar forward with straight arms until your body is one line from knees to shoulders.",
        "Don't let your hips sag or your lower back arch. Use a shorter range until it's controlled.",
        "Pull the bar back with your abs to the start.",
      ],
      nl: [
        "Kniel op een mat achter een halterstang met ronde schijven en pak hem op schouderbreedte vast.",
        "Span je buik aan, trek je ribben omlaag en knijp je billen samen.",
        "Rol de stang met gestrekte armen naar voren tot je lichaam één lijn is van knieën tot schouders.",
        "Laat je heupen niet zakken en je onderrug niet hol worden. Gebruik een kleiner bereik tot het beheerst gaat.",
        "Trek de stang met je buikspieren terug naar de start.",
      ],
    },
  },
  "decline-situp": {
    figure: {
      pose: declineSitupPose,
      implement: "none",
      furniture: "w15-decline-situp-bench",
      scale: 1.2,
      centerZ: 10,
    },
    labels: label("Decline sit-up", "Sit-up op een afhellende bank"),
    phases: {
      en: {
        lower: "Curl up off the pad, one vertebra at a time",
        touch: "Sitting up tall, hands across your chest",
        press: "Lower back down slowly",
        lockout: "Back just above the pad",
      },
      nl: {
        lower: "Rol omhoog van het kussen, wervel voor wervel",
        touch: "Rechtop gezeten, handen gekruist op je borst",
        press: "Laat je langzaam weer zakken",
        lockout: "Rug net boven het kussen",
      },
    },
    cues: {
      en: [
        "Hook your ankles under the rollers and lie back so your head is lower than your hips.",
        "Cross your hands over your chest.",
        "Curl up rather than yank, rolling your torso up until you sit tall.",
        "Lower under control to just above the pad. Hold a plate on your chest to add load.",
      ],
      nl: [
        "Haak je enkels onder de rollers en ga achterover liggen zodat je hoofd lager ligt dan je heupen.",
        "Kruis je handen over je borst.",
        "Rol omhoog in plaats van te rukken tot je rechtop zit.",
        "Zak gecontroleerd tot net boven het kussen. Houd een schijf op je borst voor meer gewicht.",
      ],
    },
  },
  "bar-triceps-extension": {
    figure: {
      pose: barTricepsExtensionPose,
      implement: "none",
      furniture: "w15-low-bar",
      scale: 1.15,
      centerZ: -70,
    },
    labels: label("Bar triceps extension", "Triceps extension aan een stang"),
    phases: {
      en: {
        lower: "Bend your elbows, head under the bar",
        touch: "Head under the bar, body rigid",
        press: "Extend your arms straight",
        lockout: "Arms straight, body in one line",
      },
      nl: {
        lower: "Buig je ellebogen, hoofd onder de stang",
        touch: "Hoofd onder de stang, lichaam stijf",
        press: "Strek je armen helemaal",
        lockout: "Armen gestrekt, lichaam in één lijn",
      },
    },
    cues: {
      en: [
        "Set a bar at waist height and grip it shoulder-width apart, leaning in with your body in one line from heels to head.",
        "Keep your body rigid, only your elbows move.",
        "Bend your elbows and let your head travel under the bar.",
        "Extend your arms straight again. Step your feet back to make it harder.",
      ],
      nl: [
        "Zet een stang op tailleshoogte en pak hem op schouderbreedte vast, met je lichaam in één lijn van hielen tot hoofd.",
        "Houd je lichaam stijf, alleen je ellebogen bewegen.",
        "Buig je ellebogen en laat je hoofd onder de stang door gaan.",
        "Strek je armen weer helemaal. Zet je voeten verder naar achteren om het zwaarder te maken.",
      ],
    },
  },
};
