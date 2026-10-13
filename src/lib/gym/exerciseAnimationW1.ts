import {
  ANKLE_Y,
  ARM,
  BODY,
  assemble,
  clamp01,
  cos,
  headFrom,
  hipAt,
  label,
  lerp,
  sin,
  smooth,
  type ExerciseAnimationSpec,
  type FigurePose,
  type V3,
} from "./exerciseAnimation";

/** Animation batch W1, merged into EXERCISE_ANIMATIONS by exerciseAnimations.ts. */

const LEG = BODY.thigh + BODY.shin - 0.03; // a straight leg, hip to ankle
const ARM_STRAIGHT = ARM - 0.1;
const FLOOR_HAND_Y = 3.2; // wrist height with the palm flat on the floor

/** Plank-based push-up: the body is one straight line that pivots about the
 *  toes, hands fixed on the floor, the chest lowering to just above it. */
interface PlankOpts {
  /** Wrist x (each side), and wrist z relative to the shoulder at the top. */
  gripHalf: number;
  gripZ: number;
  /** Shoulder joint height at the bottom. */
  bottomY: number;
  elbowPole: (s: -1 | 1) => V3;
}

const PLANK_ANKLE_Y = 17;

function plankPose(depth: number, o: PlankOpts): FigurePose {
  const e = smooth(depth);
  const dx = BODY.shoulderHalf - o.gripHalf;
  const topY = FLOOR_HAND_Y + Math.sqrt(ARM_STRAIGHT ** 2 - dx * dx - o.gripZ * o.gripZ);
  const total = BODY.torso + LEG; // shoulder to ankle
  const ankleZ = -Math.sqrt(total ** 2 - (topY - PLANK_ANKLE_Y) ** 2);
  const sy = lerp(topY, o.bottomY, e);
  const theta = Math.asin((sy - PLANK_ANKLE_Y) / total);
  const shoulder = { y: sy, z: ankleZ + total * Math.cos(theta) };
  const hip = {
    y: PLANK_ANKLE_Y + LEG * Math.sin(theta),
    z: ankleZ + LEG * Math.cos(theta),
  };
  const deg = (theta * 180) / Math.PI;
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 90 - deg - 6),
    ankleZ,
    footHalf: 8,
    ankle: (s) => [s * 8, PLANK_ANKLE_Y, ankleZ],
    // Genuinely on the toes: the heel is lifted, the sole pitched on the floor.
    foot: () => ({ floor: 0, dir: 1, pitch: 65 }),
    wrist: (s) => [s * o.gripHalf, FLOOR_HAND_Y, o.gripZ],
    bar: [0, FLOOR_HAND_Y, o.gripZ],
    kneePole: () => [0, 0, 1],
    elbowPole: o.elbowPole,
  });
}

/** Push-up: hands a little wider than the shoulders, elbows about 45 degrees
 *  from the torso, chest to just above the floor. */
export function pushupPose(depth: number): FigurePose {
  return plankPose(depth, {
    gripHalf: 24,
    gripZ: 0,
    bottomY: 18,
    elbowPole: (s) => [s * 0.75, 0.2, -0.65],
  });
}

/** Diamond push-up: hands together under the chest, elbows stay close. */
export function diamondPushupPose(depth: number): FigurePose {
  return plankPose(depth, {
    gripHalf: 4,
    gripZ: 3,
    bottomY: 20,
    elbowPole: (s) => [s * 0.3, 0.2, -1],
  });
}

const PIKE_ANKLE: V3 = [0, ANKLE_Y, -100];

/** Pike push-up: hips high in an inverted V, feet and hands fixed; the head
 *  lowers to the floor just in front of the hands. */
export function pikePushupPose(depth: number): FigurePose {
  const e = smooth(depth);
  const r = lerp(ARM_STRAIGHT, 27.6, e);
  const alpha = lerp(62, 77.5, e);
  const shoulder = {
    y: FLOOR_HAND_Y + r * sin(alpha),
    z: -r * cos(alpha),
  };
  const hip = hipAt(shoulder, { y: ANKLE_Y, z: PIKE_ANKLE[2] }, LEG);
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lerp(115, 125, e)),
    ankleZ: PIKE_ANKLE[2],
    footHalf: 10,
    wrist: (s) => [s * BODY.shoulderHalf, FLOOR_HAND_Y, 0],
    bar: [0, FLOOR_HAND_Y, 0],
    kneePole: () => [0, 0, 1],
    elbowPole: (s) => [s * 0.6, 0.2, -1],
  });
}

/** The bench is the shared flat bench: its front edge is at z = 50. */
export const DIP_BENCH_EDGE = 50;
export const DIP_BENCH_Y = 45;
const DIP_WRIST: V3 = [12, DIP_BENCH_Y + 1.5, 46];
const DIP_ANKLE_Z = 140;

/** Bench dip: hands on the bench edge behind the hips, legs out with the heels
 *  down; the hips drop straight down in front of the bench until the elbows
 *  are about 90 degrees. */
export function benchDipPose(depth: number): FigurePose {
  const e = smooth(depth);
  const dx = BODY.shoulderHalf - DIP_WRIST[0];
  const shZ = DIP_WRIST[2] + lerp(4, 10, e);
  const dz = shZ - DIP_WRIST[2];
  const topY = DIP_WRIST[1] + Math.sqrt(ARM_STRAIGHT ** 2 - dx * dx - dz * dz);
  const botY = DIP_WRIST[1] + Math.sqrt(39 ** 2 - dx * dx - dz * dz);
  const shoulder = { y: lerp(topY, botY, e), z: shZ };
  // The hip is BODY.torso from the shoulder and a straight leg from the ankle,
  // on the lower-back side (below the shoulder-ankle line).
  const dy = ANKLE_Y - shoulder.y;
  const dzz = DIP_ANKLE_Z - shoulder.z;
  const d = Math.hypot(dy, dzz);
  const a = (BODY.torso ** 2 - LEG ** 2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, BODY.torso ** 2 - a * a));
  const hip = {
    y: shoulder.y + (a * dy - h * dzz) / d,
    z: shoulder.z + (a * dzz + h * dy) / d,
  };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 6),
    ankleZ: DIP_ANKLE_Z,
    footHalf: 10,
    wrist: (s) => [s * DIP_WRIST[0], DIP_WRIST[1], DIP_WRIST[2]],
    bar: [0, DIP_WRIST[1], DIP_WRIST[2]],
    kneePole: () => [0, 1, 0.3],
    elbowPole: (s) => [s * 0.25, 0, -1],
  });
}

/** Bodyweight squat: feet shoulder-width, arms reach forward for balance,
 *  hips back and down to about parallel, heels down, chest up. */
export function bodyweightSquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const shin = 6 + 30 * e;
  const thighAngle = 6 + 78 * e;
  const knee = { y: ANKLE_Y + BODY.shin * cos(shin), z: BODY.shin * sin(shin) };
  const hip = {
    y: knee.y + BODY.thigh * cos(thighAngle),
    z: knee.z - BODY.thigh * sin(thighAngle),
  };
  const lean = 30 * e;
  const shoulder = {
    y: hip.y + BODY.torso * cos(lean),
    z: hip.z + BODY.torso * sin(lean),
  };
  // Arms swing from hanging at the sides up to shoulder height in front.
  const phi = 4 + 86 * smooth(clamp01(depth / 0.7));
  const reach = ARM_STRAIGHT - 0.05;
  const wrist: V3 = [20, shoulder.y - reach * cos(phi), shoulder.z + reach * sin(phi)];
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, lean * 0.4),
    ankleZ: 0,
    footHalf: 18,
    wrist: (s) => [s * wrist[0], wrist[1], wrist[2]],
    bar: [0, wrist[1], wrist[2]],
    kneePole: (s) => [s * 0.35, 0, 1],
    elbowPole: (s) => [s * 0.2, -0.6, 0.8],
  });
}

export const SPLIT_REAR_ANKLE: V3 = [0, 19, -92];
const SPLIT_HIP_Z = -37;

/** Split squat: the stance is fixed, neither foot moves; the hips go straight
 *  down until the front thigh is level and the back knee hovers over the floor. */
export function splitSquatPose(depth: number): FigurePose {
  const e = smooth(depth);
  const hip = { y: lerp(87.4, 52, e), z: SPLIT_HIP_Z };
  const shoulder = { y: hip.y + BODY.torso, z: hip.z };
  return assemble({
    hip,
    shoulder,
    head: headFrom(shoulder, 0),
    ankleZ: 0,
    footHalf: 11,
    ankle: (s) => (s < 0 ? [-11, SPLIT_REAR_ANKLE[1], SPLIT_REAR_ANKLE[2]] : [11, ANKLE_Y, 0]),
    // The back heel stays up on the ball of the foot, the front foot is flat.
    foot: (s) => (s < 0 ? { floor: 0, dir: 1, pitch: 45 } : { floor: 0, dir: 1 }),
    // Hands on the hips.
    wrist: (s) => [s * 22, hip.y + 8, hip.z],
    bar: [0, hip.y + 8, hip.z],
    kneePole: (s) => (s < 0 ? [0, -1, 0.5] : [0, 0, 1]),
    elbowPole: (s) => [s, 0, -0.2],
  });
}

const PUSHUP_LABEL = label("Push-up", "Push-up");

export const ANIMATIONS_W1: Record<string, ExerciseAnimationSpec> = {
  pushup: {
    figure: {
      pose: pushupPose,
      implement: "none",
      furniture: "none",
      scale: 1.45,
      centerZ: -50,
    },
    labels: PUSHUP_LABEL,
    phases: {
      en: {
        lower: "Bend your elbows and lower your chest",
        touch: "Chest just above the floor, body still one line",
        press: "Push the floor away until your arms are straight",
        lockout: "Arms straight, body in one line from head to heels",
      },
      nl: {
        lower: "Buig je ellebogen en zak met je borst omlaag",
        touch: "Borst net boven de grond, lichaam nog steeds één lijn",
        press: "Duw de grond weg tot je armen gestrekt zijn",
        lockout: "Armen gestrekt, lichaam één lijn van hoofd tot hielen",
      },
    },
    cues: {
      en: [
        "Hands under your shoulders, a little wider, body in one straight line from head to heels.",
        "Squeeze your glutes and brace your core so your hips don't sag or pike.",
        "Keep your elbows about 45 degrees from your torso, not flared out wide.",
        "Lower your chest to just above the floor, then press up to straight arms.",
      ],
      nl: [
        "Handen onder je schouders, iets breder, lichaam in één rechte lijn van hoofd tot hielen.",
        "Span je billen en core aan, zodat je heupen niet doorzakken of omhoog gaan.",
        "Houd je ellebogen ongeveer 45 graden van je romp, niet wijd naar buiten.",
        "Zak met je borst tot net boven de grond en duw dan omhoog tot gestrekte armen.",
      ],
    },
  },
  "diamond-pushup": {
    figure: {
      pose: diamondPushupPose,
      implement: "none",
      furniture: "none",
      scale: 1.45,
      centerZ: -50,
    },
    labels: label("Diamond push-up", "Diamond push-up"),
    phases: {
      en: {
        lower: "Lower your chest to your hands, elbows close",
        touch: "Chest just above your hands, elbows hugging your sides",
        press: "Press up through your triceps to straight arms",
        lockout: "Arms straight, hands together under your chest",
      },
      nl: {
        lower: "Zak met je borst naar je handen, ellebogen dicht langs je lijf",
        touch: "Borst net boven je handen, ellebogen langs je zij",
        press: "Duw omhoog met je triceps tot je armen gestrekt zijn",
        lockout: "Armen gestrekt, handen samen onder je borst",
      },
    },
    cues: {
      en: [
        "Put your hands together under your chest, thumbs and index fingers touching in a diamond.",
        "Keep your body in one straight line from head to heels.",
        "Lower your chest toward your hands while your elbows stay close to your body.",
        "Press up until your arms are straight, without letting your hips sag.",
      ],
      nl: [
        "Zet je handen tegen elkaar onder je borst, duimen en wijsvingers raken elkaar als een ruit.",
        "Houd je lichaam in één rechte lijn van hoofd tot hielen.",
        "Zak met je borst naar je handen terwijl je ellebogen dicht langs je lijf blijven.",
        "Duw omhoog tot je armen gestrekt zijn, zonder dat je heupen doorzakken.",
      ],
    },
  },
  "pike-pushup": {
    figure: {
      pose: pikePushupPose,
      implement: "none",
      furniture: "none",
      scale: 1.7,
      centerZ: -42,
    },
    labels: label("Pike push-up", "Pike push-up"),
    phases: {
      en: {
        lower: "Bend your elbows and lower your head toward the floor",
        touch: "Head just above the floor in front of your hands",
        press: "Press back up to straight arms, hips staying high",
        lockout: "Arms straight, hips high in an inverted V",
      },
      nl: {
        lower: "Buig je ellebogen en zak met je hoofd naar de grond",
        touch: "Hoofd net boven de grond, vlak voor je handen",
        press: "Duw terug omhoog tot gestrekte armen, heupen blijven hoog",
        lockout: "Armen gestrekt, heupen hoog in een omgekeerde V",
      },
    },
    cues: {
      en: [
        "Start with your hands shoulder-width apart and your hips high in an inverted V.",
        "Keep your legs straight and your weight over your hands.",
        "Bend your elbows and lower your head toward the floor just in front of your hands.",
        "Press back up to straight arms and keep your hips high.",
      ],
      nl: [
        "Begin met je handen op schouderbreedte en je heupen hoog in een omgekeerde V.",
        "Houd je benen gestrekt en je gewicht boven je handen.",
        "Buig je ellebogen en zak met je hoofd naar de grond, vlak voor je handen.",
        "Duw terug omhoog tot gestrekte armen en houd je heupen hoog.",
      ],
    },
  },
  "bench-dip": {
    figure: {
      pose: benchDipPose,
      implement: "none",
      furniture: "flat-bench",
      scale: 1.3,
      centerZ: 52,
    },
    labels: label("Bench dip", "Bench dip"),
    phases: {
      en: {
        lower: "Bend your elbows and drop your hips straight down",
        touch: "Elbows at about 90 degrees, back close to the bench",
        press: "Press through your palms back up",
        lockout: "Arms straight, hips just in front of the bench",
      },
      nl: {
        lower: "Buig je ellebogen en zak met je heupen recht omlaag",
        touch: "Ellebogen ongeveer 90 graden, rug dicht langs de bank",
        press: "Duw je via je handpalmen weer omhoog",
        lockout: "Armen gestrekt, heupen net voor de bank",
      },
    },
    cues: {
      en: [
        "Sit on the edge of a bench, hands beside your hips, fingers forward, and walk your feet out.",
        "Legs extended with your heels on the floor, hips just in front of the bench.",
        "Lower your hips straight down until your elbows are about 90 degrees.",
        "Keep your back close to the bench, then press up to straight arms.",
      ],
      nl: [
        "Ga op de rand van een bank zitten, handen naast je heupen, vingers naar voren, en loop je voeten naar voren.",
        "Benen gestrekt met je hielen op de grond, heupen net voor de bank.",
        "Zak recht omlaag tot je ellebogen ongeveer 90 graden zijn.",
        "Houd je rug dicht langs de bank en duw dan omhoog tot gestrekte armen.",
      ],
    },
  },
  "bodyweight-squat": {
    figure: {
      pose: bodyweightSquatPose,
      implement: "none",
      furniture: "none",
      scale: 1.05,
      centerZ: 18,
    },
    labels: label("Bodyweight squat", "Squat met eigen gewicht"),
    phases: {
      en: {
        lower: "Hips back and down, arms reach forward",
        touch: "Thighs about parallel, heels down, chest up",
        press: "Drive through your whole foot to stand",
        lockout: "Stand tall, arms relaxed at your sides",
      },
      nl: {
        lower: "Heupen naar achteren en omlaag, armen naar voren",
        touch: "Bovenbenen ongeveer horizontaal, hielen op de grond, borst omhoog",
        press: "Duw af met je hele voet om te staan",
        lockout: "Sta rechtop, armen ontspannen langs je zij",
      },
    },
    cues: {
      en: [
        "Stand with your feet shoulder-width apart, toes slightly out.",
        "Reach your arms forward to shoulder height for balance as you go down.",
        "Send your hips back and down to about parallel, knees over your toes, chest up.",
        "Keep your heels down and drive through your whole foot to stand.",
      ],
      nl: [
        "Sta met je voeten op schouderbreedte, tenen een beetje naar buiten.",
        "Strek je armen naar voren tot schouderhoogte voor balans terwijl je zakt.",
        "Duw je heupen naar achteren en omlaag tot ongeveer horizontaal, knieën boven je tenen, borst omhoog.",
        "Houd je hielen op de grond en duw af met je hele voet om te staan.",
      ],
    },
  },
  "split-squat": {
    figure: {
      pose: splitSquatPose,
      implement: "none",
      furniture: "none",
      scale: 1.05,
      centerZ: -41,
    },
    labels: label("Split squat", "Split squat"),
    phases: {
      en: {
        lower: "Drop straight down, neither foot moves",
        touch: "Front thigh level, back knee just above the floor",
        press: "Push through your front foot to rise",
        lockout: "Stand tall in your split stance",
      },
      nl: {
        lower: "Zak recht omlaag, geen van beide voeten beweegt",
        touch: "Voorste bovenbeen horizontaal, achterste knie net boven de grond",
        press: "Duw af met je voorste voet om omhoog te komen",
        lockout: "Sta rechtop in je spreidstand",
      },
    },
    cues: {
      en: [
        "Take a long step forward and keep your feet in that split stance for the whole set.",
        "Rest your back foot on the ball of the foot, heel up, torso upright.",
        "Drop straight down until your front thigh is about level.",
        "Let your back knee hover just above the floor, then push through your front foot to rise.",
      ],
      nl: [
        "Zet een grote stap naar voren en laat je voeten de hele set in die spreidstand staan.",
        "Zet je achterste voet op de bal van je voet, hiel omhoog, romp rechtop.",
        "Zak recht omlaag tot je voorste bovenbeen ongeveer horizontaal is.",
        "Laat je achterste knie net boven de grond zweven en duw dan af met je voorste voet.",
      ],
    },
  },
};
