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
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";
import { HIFLY_TOWER } from "./exerciseAnimationW8";

/** Animation batch W11, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

/** Longest shoulder-to-wrist distance used for a locked-out arm (ARM is 55). */
const REACH = ARM - 0.2;

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

/* ------------------------------------------------------------------ */
/* Single-arm cable rear delt fly                                      */
/* ------------------------------------------------------------------ */

/** The high tower stands on the far side (x negative), a little in front of
 *  the lifter so the cable crosses in front of the body. */
export const RDF_TOWER = { x: -98, y: HIFLY_TOWER.y, z: 34 };
const RDF_LEAN = 6;
const RDF_REACH = 53; // shoulder -> wrist, a soft fixed elbow bend
/** Hip height of a standing pose with soft knees (hip-to-ankle reach 87.2 cm). */
const RDF_HIP_Y = ANKLE_Y + Math.sqrt(87.2 * 87.2 - 4);

/** Single-arm cable rear delt fly: side-on to a high tower, the near hand
 *  takes the cable across the body and sweeps back and out at shoulder height
 *  with one fixed soft elbow bend, until the hand is in line with the body.
 *  The other hand rests on the hip. Depth 0 = hand across the body, 1 = arm out. */
export function cableRearDeltFlyPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: RDF_HIP_Y, z: -2 };
  const shoulder = {
    y: hip.y + BODY.torso * cos(RDF_LEAN),
    z: hip.z + BODY.torso * sin(RDF_LEAN),
  };
  const d = slerp3(unit([-0.45, -0.32, 0.84]), unit([0.99, 0.03, -0.12]), e);
  const right: V3 = [
    BODY.shoulderHalf + RDF_REACH * d[0],
    shoulder.y + RDF_REACH * d[1],
    shoulder.z + RDF_REACH * d[2],
  ];
  const left: V3 = [-27, hip.y + 4, hip.z + 4];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, RDF_LEAN * 0.6),
    ankleZ: 0,
    footHalf: 12,
    wrist: (s) => (s > 0 ? right : left),
    bar: right,
    kneePole: forwardKnees,
    // The soft bend of the working elbow points down and back.
    elbowPole: (s) => (s > 0 ? [0.2, -1, -0.6] : [-1, 0, -0.3]),
  });
}

/* ------------------------------------------------------------------ */
/* Smith machine shoulder press                                        */
/* ------------------------------------------------------------------ */

const SSP_BACK = 10;
const SSP_HIP = { y: SEAT_HIP_Y, z: 0 };
export const SSP_SHOULDER = {
  y: SSP_HIP.y + BODY.torso * cos(SSP_BACK),
  z: SSP_HIP.z - BODY.torso * sin(SSP_BACK),
};
export const SSP_GRIP = 38;
/** Bar z: in front of the face, forearm (nearly) vertical at the bottom. The
 *  bar only moves up and down the rails, so it never changes. */
export const SSP_BAR_Z = SSP_SHOULDER.z + 19;
export const SSP_BOTTOM_UP = 9; // chin height: bar this far above the shoulder joint
const SSP_DX = SSP_GRIP - BODY.shoulderHalf;
export const SSP_TOP_UP = Math.sqrt(REACH * REACH - SSP_DX * SSP_DX - 19 * 19);
/** Radius of the small plates drawn on the Smith bar (cm), so they stay clear of the face. */
export const SSP_PLATE_R = 10;

/** Smith machine shoulder press: seated upright with the back on the pad, the
 *  bar travels straight up and down in front of the face from chin height to
 *  lockout. Depth 0 = lockout, 1 = bar at the chin. */
export function smithShoulderPressPose(depth: number): FigurePose {
  const shoulder = SSP_SHOULDER;
  const y = shoulder.y + lerp(SSP_TOP_UP, SSP_BOTTOM_UP, depth);
  const bottomElbow: V3 = [SSP_DX, SSP_BOTTOM_UP - 26, 15];
  return assemble({
    hip: SSP_HIP,
    shoulder,
    head: [0, shoulder.y + 22, shoulder.z - 2],
    ankleZ: 40,
    footHalf: 24,
    wrist: (s) => [s * SSP_GRIP, y, SSP_BAR_Z],
    bar: [0, y, SSP_BAR_Z],
    kneePole: (s) => [s * 0.2, 1, 0.5],
    elbowPole: (s) => [s * bottomElbow[0], bottomElbow[1], bottomElbow[2]],
  });
}

/* ------------------------------------------------------------------ */
/* Single-arm lat pulldown (half-kneeling)                             */
/* ------------------------------------------------------------------ */

/** Hip height with the near knee on the floor and the thigh vertical. */
const SAL_HIP_Y = 51;
const SAL_HIP_Z = 0;
/** The front (far) foot stands flat this far ahead of the hip. */
export const SAL_FRONT_ANKLE_Z = 40;
/** The back (near) shin lies on the floor behind the knee. */
export const SAL_BACK_ANKLE_Z = SAL_HIP_Z - 42.95;

/** Single-arm lat pulldown, half-kneeling beside a high pulley: the near knee
 *  is down, the far foot flat in front, the near arm reaches up into a full
 *  stretch and the elbow pulls down and back to the side of the chest.
 *  Depth 0 = full stretch, 1 = elbow at the hip. */
export function singleArmLatPulldownPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: SAL_HIP_Y, z: SAL_HIP_Z };
  const lean = lerp(2, -9, e); // leans back slightly as the elbow drives down
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // The upper arm swings down along the side, from a long stretch toward the
  // pulley to the elbow beside the hip; the forearm stays between vertical and
  // the cable's line, so the hand ends just outside the shoulder.
  const S: V3 = [BODY.shoulderHalf, shoulder.y, shoulder.z];
  const theta = lerp(22, 160, e); // upper arm from straight up, out to the side
  const u = unit([sin(theta), cos(theta), lerp(0.45, -0.3, e)]);
  const elbow: V3 = [S[0] + 29 * u[0], S[1] + 29 * u[1], S[2] + 29 * u[2]];
  const toPulley = unit([
    HIFLY_TOWER.x - elbow[0],
    HIFLY_TOWER.y - elbow[1],
    HIFLY_TOWER.z - elbow[2],
  ]);
  const fwd = lerp(0.35, 0.15, e); // keeps the hand ahead of the face in the side view
  const f = unit([toPulley[0] * 0.5, toPulley[1] * 0.5 + 0.5, toPulley[2] * 0.5 + fwd]);
  const right: V3 = [elbow[0] + 26 * f[0], elbow[1] + 26 * f[1], elbow[2] + 26 * f[2]];
  const pole: V3 = [
    elbow[0] - (S[0] + right[0]) / 2,
    elbow[1] - (S[1] + right[1]) / 2,
    elbow[2] - (S[2] + right[2]) / 2,
  ];
  const build = (free: V3) =>
    assemble({
      hip,
      shoulder,
      head: headFrom(shoulder, lean * 0.6),
      ankleZ: 0,
      footHalf: 10,
      ankle: (s) => (s > 0 ? [10, ANKLE_Y, SAL_BACK_ANKLE_Z] : [-10, ANKLE_Y, SAL_FRONT_ANKLE_Z]),
      foot: (s) => (s > 0 ? { floor: 0, dir: -1 } : { floor: 0, dir: 1 }),
      wrist: (s) => (s > 0 ? right : free),
      bar: right,
      kneePole: (s) => (s > 0 ? [0, -1, 1] : [0, 1, 0.3]),
      elbowPole: (s) => (s > 0 ? pole : [-0.6, -1, 0.1]),
    });
  // The free hand rests on the front (far) thigh, a little above its middle.
  const probe = build([-14, 0, 0]);
  const k = probe.knees[0];
  const mid: V3 = [
    (probe.hips[0][0] + k[0]) / 2,
    (probe.hips[0][1] + k[1]) / 2,
    (probe.hips[0][2] + k[2]) / 2,
  ];
  return build([mid[0] - 1, mid[1] + 7, mid[2] + 2]);
}

/* ------------------------------------------------------------------ */
/* Smith machine Romanian deadlift                                     */
/* ------------------------------------------------------------------ */

export const SRDL_ANKLE_Z = 6;
/** Bar z: about 4 cm ahead of the ankle (mid-foot), against the thighs; fixed by the rails. */
export const SRDL_BAR_Z = 12;
export const SRDL_GRIP = 22;
const SRDL_LEAN = 76;

/** Smith machine Romanian deadlift: the bar slides straight down the thighs
 *  and shins in the rails while the hips travel back, knees soft, back flat.
 *  Depth 0 = standing, 1 = bar at mid-shin. */
export function smithRdlPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hipZ = lerp(0, -28, e);
  const reach = lerp(87, 80, e);
  const dz = hipZ - SRDL_ANKLE_Z;
  const dx = 14 - BODY.hipHalf;
  const hip = { z: hipZ, y: ANKLE_Y + Math.sqrt(reach * reach - dz * dz - dx * dx) };
  const lean = SRDL_LEAN * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  const gdx = SRDL_GRIP - BODY.shoulderHalf;
  const gdz = SRDL_BAR_Z - shoulder.z;
  const wy = shoulder.y - Math.sqrt((ARM - 0.4) ** 2 - gdx * gdx - gdz * gdz);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.6),
    ankleZ: SRDL_ANKLE_Z,
    footHalf: 14,
    wrist: (s) => [s * SRDL_GRIP, wy, SRDL_BAR_Z],
    bar: [0, wy, SRDL_BAR_Z],
    kneePole: forwardKnees,
    elbowPole: (s) => [s * 0.3, 0, 1],
  });
}

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

export const ANIMATIONS_W11: Record<string, ExerciseAnimationSpec> = {
  "cable-rear-delt-fly": {
    figure: {
      pose: cableRearDeltFlyPose,
      implement: "w11-rdf-handle",
      furniture: "w11-rdf-tower",
      scale: 1.0,
      centerZ: 14,
      pulley: { y: RDF_TOWER.y, z: RDF_TOWER.z },
    },
    labels: label("Single-arm cable rear delt fly", "Rear delt fly met kabel, één arm"),
    phases: {
      en: {
        lower: "Sweep your arm back and out, elbow leading",
        touch: "Hand in line with your body, rear delt squeezed",
        press: "Bring the handle back across slowly",
        lockout: "Arm across your body, cable under tension",
      },
      nl: {
        lower: "Zwaai je arm naar achteren en opzij, elleboog voorop",
        touch: "Hand in lijn met je lichaam, achterste schouder samengeknepen",
        press: "Breng het handvat langzaam terug over je lichaam",
        lockout: "Arm voor je lichaam, kabel onder spanning",
      },
    },
    cues: {
      en: [
        "Stand side-on to a high pulley and take the handle with the hand farthest from the tower, so the cable crosses in front of you.",
        "Keep a slight bend in your elbow and your other hand on your hip.",
        "Sweep your arm back and out at shoulder height until your hand is in line with your body.",
        "Don't twist your torso or swing. Return slowly and keep the cable tight.",
      ],
      nl: [
        "Sta zijwaarts naast een hoge katrol en pak het handvat met de hand die het verst van de toren zit, zodat de kabel voor je langs kruist.",
        "Houd je elleboog licht gebogen en je andere hand op je heup.",
        "Zwaai je arm op schouderhoogte naar achteren en opzij tot je hand in lijn met je lichaam is.",
        "Draai je romp niet en zwaai niet. Keer langzaam terug en houd de kabel strak.",
      ],
    },
  },
  "smith-shoulder-press": {
    figure: {
      pose: smithShoulderPressPose,
      implement: "w11-smith-bar-small",
      furniture: "w11-smith-seat",
      scale: 1.0,
      centerZ: 14,
    },
    labels: label("Smith machine shoulder press", "Schouderdrukken in de Smith machine"),
    phases: {
      en: {
        lower: "Lower the bar in front of your face to chin height",
        touch: "Forearms vertical, back on the pad",
        press: "Press straight up along the rails",
        lockout: "Arms long overhead, shoulders down",
      },
      nl: {
        lower: "Laat de stang voor je gezicht zakken tot kinhoogte",
        touch: "Onderarmen verticaal, rug tegen het kussen",
        press: "Duw recht omhoog langs de rails",
        lockout: "Armen gestrekt boven je hoofd, schouders omlaag",
      },
    },
    cues: {
      en: [
        "Set an upright bench in the machine so the bar hangs just in front of your face, and sit with your back on the pad.",
        "Grip the bar a little wider than your shoulders and twist it off the hooks at chin height.",
        "Press straight up along the rails until your arms are almost straight. The bar passes in front of your face.",
        "Lower under control to your chin with your forearms vertical. Re-hook the bar when you finish.",
      ],
      nl: [
        "Zet een rechte bank in de machine zodat de stang net voor je gezicht hangt en zit met je rug tegen het kussen.",
        "Pak de stang iets breder dan je schouders en draai hem op kinhoogte van de haken.",
        "Duw recht omhoog langs de rails tot je armen bijna gestrekt zijn. De stang gaat voor je gezicht langs.",
        "Laat gecontroleerd zakken tot kinhoogte met verticale onderarmen. Hang de stang terug als je klaar bent.",
      ],
    },
  },
  "single-arm-lat-pulldown": {
    figure: {
      pose: singleArmLatPulldownPose,
      implement: "w8-hi-handle",
      furniture: "w8-hi-tower",
      scale: 1.0,
      centerZ: 0,
      pulley: { y: HIFLY_TOWER.y, z: HIFLY_TOWER.z },
    },
    labels: label("Single-arm lat pulldown", "Lat pulldown met één arm"),
    phases: {
      en: {
        lower: "Pull your elbow down and back",
        touch: "Elbow at your hip, lat squeezed",
        press: "Let the handle rise back up slowly",
        lockout: "Arm long overhead, lat stretched",
      },
      nl: {
        lower: "Trek je elleboog omlaag en naar achteren",
        touch: "Elleboog bij je heup, lat samengeknepen",
        press: "Laat het handvat langzaam weer omhoog komen",
        lockout: "Arm gestrekt boven je hoofd, lat gerekt",
      },
    },
    cues: {
      en: [
        "Kneel on the knee nearest the high pulley with your other foot flat in front, and take the handle with one hand.",
        "Reach up into a full stretch with your torso tall.",
        "Pull your elbow down and back to the side of your chest, towards your hip.",
        "Squeeze your lat, then let the handle rise slowly back to the stretch. Do all reps, then switch sides.",
      ],
      nl: [
        "Kniel op de knie die het dichtst bij de hoge katrol is met je andere voet plat voor je en pak het handvat met één hand.",
        "Reik omhoog in een volledige rek met een lange romp.",
        "Trek je elleboog omlaag en naar achteren tot de zijkant van je borst, richting je heup.",
        "Span je lat aan en laat het handvat dan langzaam terug omhoog naar de rek. Doe alle herhalingen en wissel dan van kant.",
      ],
    },
  },
  "smith-rdl": {
    figure: {
      pose: smithRdlPose,
      implement: "w3-smith-bar",
      furniture: "w11-smith-rdl",
      scale: 1.05,
      centerZ: -4,
    },
    labels: label("Smith machine Romanian deadlift", "Roemeense deadlift in de Smith machine"),
    phases: {
      en: {
        lower: "Hips back, bar sliding down your legs",
        touch: "Bar at mid-shin, hamstrings stretched, back flat",
        press: "Drive the hips forward",
        lockout: "Stand tall, squeeze the glutes",
      },
      nl: {
        lower: "Heupen naar achteren, stang glijdt langs je benen",
        touch: "Stang halverwege je scheenbenen, hamstrings gerekt, rug recht",
        press: "Duw je heupen naar voren",
        lockout: "Sta rechtop, span je billen aan",
      },
    },
    cues: {
      en: [
        "Set the bar at hip height, stand with it over your mid-foot and feet hip-width apart, and twist it off the hooks.",
        "Keep your knees soft and your back flat as you push your hips back.",
        "Let the bar slide down your thighs and shins on its fixed path until you feel your hamstrings stretch.",
        "Drive your hips forward to stand tall. Re-hook the bar when you finish.",
      ],
      nl: [
        "Zet de stang op heuphoogte, sta met de stang boven het midden van je voet en je voeten heupbreed, en draai hem van de haken.",
        "Houd je knieën zacht en je rug recht terwijl je je heupen naar achteren duwt.",
        "Laat de stang over zijn vaste baan langs je bovenbenen en scheenbenen zakken tot je je hamstrings voelt rekken.",
        "Duw je heupen naar voren om rechtop te komen. Hang de stang terug als je klaar bent.",
      ],
    },
  },
};
