import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { PLATE_RADIUS, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import { ANIMATIONS_W10 } from "../exerciseAnimationW10";
import { GymProvider } from "../store";

const IDS = [
  "db-front-raise",
  "db-bent-over-row",
  "bb-sumo-deadlift",
  "db-sumo-squat",
  "db-side-bend",
  "good-morning",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W10[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);
const deg = (r: number) => (r * 180) / Math.PI;
/** Torso lean from vertical (degrees), shoulder midpoint to hip midpoint, side view. */
const lean = (p: FigurePose) =>
  deg(Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]));

const joints = (p: FigurePose): V3[] => [
  ...p.shoulders,
  ...p.elbows,
  ...p.wrists,
  ...p.hips,
  ...p.knees,
  ...p.ankles,
  p.head,
];

/** Pixel position of a point in the front or side view. */
const front = (m: FigureModel, v: V3): [number, number] => [
  160 + v[0] * m.scale,
  196 - v[1] * m.scale,
];
const side = (m: FigureModel, v: V3): [number, number] => [
  160 + (v[2] - m.centerZ) * m.scale,
  196 - v[1] * m.scale,
];

/** Both feet flat on the floor and not moving (no `pitch`, no `angle`). */
function expectPlanted(id: string) {
  const a = poseAt(id, 0);
  for (const d of WALK) {
    const p = poseAt(id, d);
    for (const s of [0, 1] as const) {
      expect(p.feet[s]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[s][1]).toBe(8);
      expect(dist(p.ankles[s], a.ankles[s])).toBeLessThan(1e-9);
    }
  }
}

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W10[id]!;
    for (const lang of ["en", "nl"] as const) {
      expect(spec.cues[lang].length).toBeGreaterThanOrEqual(4);
      expect(spec.cues[lang].length).toBeLessThanOrEqual(5);
      expect(spec.cues[lang]).toHaveLength(spec.cues.en.length);
      expect(spec.labels![lang].front).toBeTruthy();
      expect(spec.labels![lang].side).toBeTruthy();
      for (const ph of ["lower", "touch", "press", "lockout"] as const)
        expect(spec.phases![lang][ph]).toBeTruthy();
    }
  });
  it("keeps limb lengths constant and smooth through the rep", () => {
    let prev = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(dist(p.shoulders[s], p.elbows[s])).toBeCloseTo(29, 3);
        expect(dist(p.elbows[s], p.wrists[s])).toBeCloseTo(26, 3);
        expect(dist(p.hips[s], p.knees[s])).toBeCloseTo(45, 3);
        expect(dist(p.knees[s], p.ankles[s])).toBeCloseTo(43, 3);
        // targets in reach: nothing is silently stretched
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThanOrEqual(55);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThanOrEqual(88);
      }
      const a = joints(prev);
      const b = joints(p);
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(6));
      prev = p;
    }
  });
  it("stays inside the frame in both views", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const j of joints(p)) {
        for (const [x, y] of [front(m, j), side(m, j)]) {
          expect(x).toBeGreaterThan(6);
          expect(x).toBeLessThan(314);
          expect(y).toBeGreaterThan(6);
          expect(y).toBeLessThan(200);
        }
      }
      // head circle (radius 10.5 cm)
      for (const [x, y] of [front(m, p.head), side(m, p.head)]) {
        expect(x - 10.5 * m.scale).toBeGreaterThan(4);
        expect(x + 10.5 * m.scale).toBeLessThan(316);
        expect(y - 10.5 * m.scale).toBeGreaterThan(4);
      }
      if (m.implement === "barbell") {
        // plates (radius 22.5 cm) in the side view, bar ends (+-75 cm) in the front view
        const [x, y] = side(m, p.bar);
        expect(x - PLATE_RADIUS * m.scale).toBeGreaterThan(4);
        expect(x + PLATE_RADIUS * m.scale).toBeLessThan(316);
        expect(y - PLATE_RADIUS * m.scale).toBeGreaterThan(4);
        expect(y + PLATE_RADIUS * m.scale).toBeLessThan(198);
        expect(front(m, p.bar)[0] - 75 * m.scale).toBeGreaterThan(4);
        expect(front(m, p.bar)[0] + 75 * m.scale).toBeLessThan(316);
      }
    }
  });
  it("renders", () => {
    const html = renderToString(
      createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
    );
    expect(html).toContain("<svg");
  });
});

describe("dumbbell front raise", () => {
  it("keeps the torso and feet still, arms nearly straight", () => {
    expectPlanted("db-front-raise");
    const a = poseAt("db-front-raise", 0);
    for (const d of WALK) {
      const p = poseAt("db-front-raise", d);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.head).toEqual(a.head);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(52);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeLessThan(54.5);
      // a symmetric lift
      expect(p.wrists[0][1]).toBeCloseTo(p.wrists[1][1], 6);
      expect(p.wrists[0][2]).toBeCloseTo(p.wrists[1][2], 6);
    }
  });
  it("starts at the thighs and stops at shoulder height, never above", () => {
    const hang = poseAt("db-front-raise", 0);
    const top = poseAt("db-front-raise", 1);
    expect(hang.wrists[1][1]).toBeLessThan(hang.shoulders[1][1] - 48);
    expect(hang.wrists[1][2]).toBeLessThan(12);
    expect(top.shoulders[1][1] - top.wrists[1][1]).toBeLessThan(4);
    expect(top.wrists[1][2]).toBeGreaterThan(48);
    let prev = -Infinity;
    for (const d of WALK) {
      const p = poseAt("db-front-raise", d);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(p.shoulders[1][1]);
      expect(p.wrists[1][1]).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p.wrists[1][1];
      // the hands stay clear of the face
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(24);
    }
  });
  it("keeps the arm straight at lockout in front view (hands under the shoulders)", () => {
    const hang = poseAt("db-front-raise", 0);
    expect(Math.abs(hang.wrists[1][0])).toBeGreaterThan(14);
    expect(Math.abs(hang.wrists[1][0])).toBeLessThan(21);
    expect(hang.ankles[1][2]).toBeCloseTo(hang.hips[1][2], 6);
  });
});

describe("dumbbell bent-over row", () => {
  it("holds the hinge and the soft knees, feet planted", () => {
    expectPlanted("db-bent-over-row");
    const a = poseAt("db-bent-over-row", 0);
    for (const d of WALK) {
      const p = poseAt("db-bent-over-row", d);
      expect(lean(p)).toBeGreaterThan(45);
      expect(lean(p)).toBeLessThan(58);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] - 2);
      expect(p.hips[1][1]).toBeGreaterThan(p.knees[1][1]);
    }
  });
  it("starts with straight arms and ends with the elbows back and up past the torso", () => {
    const hang = poseAt("db-bent-over-row", 0);
    const top = poseAt("db-bent-over-row", 1);
    expect(dist(hang.shoulders[1], hang.wrists[1])).toBeGreaterThan(54);
    expect(hang.wrists[1][2]).toBeCloseTo(hang.shoulders[1][2], 0);
    expect(top.elbows[1][2]).toBeLessThan(top.shoulders[1][2] - 8);
    expect(top.elbows[1][1]).toBeGreaterThan(top.wrists[1][1] + 10);
    // dumbbells finish beside the lower ribs: well below the shoulders, level with the torso
    expect(top.shoulders[1][1] - top.wrists[1][1]).toBeGreaterThan(20);
    expect(top.wrists[1][1]).toBeGreaterThan(top.hips[1][1]);
    expect(top.wrists[1][2]).toBeGreaterThan(top.shoulders[1][2] - 30);
  });
  it("is a neutral-grip dumbbell row with a neutral neck", () => {
    expect(model("db-bent-over-row").neutralGrip).toBe(true);
    const p = poseAt("db-bent-over-row", 0);
    const neck = deg(Math.atan2(p.head[2] - p.shoulders[1][2], p.head[1] - p.shoulders[1][1]));
    expect(neck).toBeGreaterThan(0.4 * lean(p));
    expect(neck).toBeLessThan(0.8 * lean(p));
  });
});

describe("barbell sumo deadlift", () => {
  it("has a wide stance, planted feet and knees out over the toes", () => {
    expectPlanted("bb-sumo-deadlift");
    for (const d of WALK) {
      const p = poseAt("bb-sumo-deadlift", d);
      expect(p.ankles[1][0]).toBeGreaterThanOrEqual(26);
      expect(p.ankles[0][0]).toBeLessThanOrEqual(-26);
      if (d >= 0.4) {
        expect(p.knees[1][0]).toBeGreaterThanOrEqual(p.ankles[1][0]);
        expect(p.knees[1][0]).toBeLessThan(p.ankles[1][0] + 20);
        expect(p.knees[0][0]).toBeLessThanOrEqual(p.ankles[0][0]);
      }
    }
  });
  it("keeps the bar over the mid-foot, arms straight and hands inside the knees", () => {
    for (const d of WALK) {
      const p = poseAt("bb-sumo-deadlift", d);
      // mid-foot is about 4 cm ahead of the ankle
      expect(Math.abs(p.bar[2] - 4)).toBeLessThanOrEqual(4);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(53.5);
      expect(p.wrists[1][0]).toBeGreaterThan(10);
      expect(p.wrists[1][0]).toBeLessThan(p.knees[1][0] - 8);
      expect(p.wrists[1][1]).toBeCloseTo(p.bar[1], 6);
    }
    expect(poseAt("bb-sumo-deadlift", 1).bar[1]).toBeCloseTo(PLATE_RADIUS, 6);
  });
  it("rises smoothly: hips and shoulders go up together, legs never lock early", () => {
    let prevHip = Infinity;
    let prevSh = Infinity;
    let prevReach = Infinity;
    let prevLean = -Infinity;
    for (const d of WALK) {
      const p = poseAt("bb-sumo-deadlift", d);
      const reach = dist(p.hips[1], p.ankles[1]);
      expect(p.hips[1][1]).toBeLessThanOrEqual(prevHip + 1e-9);
      expect(p.shoulders[1][1]).toBeLessThanOrEqual(prevSh + 1e-9);
      expect(reach).toBeLessThanOrEqual(prevReach + 1e-9);
      expect(lean(p)).toBeGreaterThanOrEqual(prevLean - 1e-9);
      // while the hips are still back the knees must still be bent
      if (lean(p) > 15) expect(reach).toBeLessThan(86);
      prevHip = p.hips[1][1];
      prevSh = p.shoulders[1][1];
      prevReach = reach;
      prevLean = lean(p);
    }
  });
  it("leans 50-55 degrees at the bottom with the hips about level with the knees", () => {
    const b = poseAt("bb-sumo-deadlift", 1);
    expect(lean(b)).toBeGreaterThan(48);
    expect(lean(b)).toBeLessThan(56);
    expect(b.shoulders[1][2]).toBeGreaterThan(b.bar[2]);
    expect(b.shoulders[1][2] - b.bar[2]).toBeLessThan(16);
    expect(b.hips[1][2]).toBeLessThan(b.ankles[1][2]);
    for (const s of [0, 1] as const) {
      // a sumo pull, not a squat: hips within 3 cm of knee height, never well below it
      expect(Math.abs(b.hips[s][1] - b.knees[s][1])).toBeLessThanOrEqual(3);
      // shins near vertical in the side view, the knees pushed out to the sides
      expect(Math.abs(b.knees[s][2] - b.ankles[s][2])).toBeLessThan(6);
      expect(Math.abs(b.knees[s][0]) - Math.abs(b.ankles[s][0])).toBeGreaterThan(10);
    }
  });
  it("starts standing straight: ankle z equals hip z", () => {
    const a = poseAt("bb-sumo-deadlift", 0);
    expect(Math.abs(a.hips[1][2] - a.ankles[1][2])).toBeLessThan(1);
    expect(lean(a)).toBeLessThan(2);
  });
});

describe("dumbbell sumo squat", () => {
  it("has a wide stance with planted feet", () => {
    expectPlanted("db-sumo-squat");
    const p = poseAt("db-sumo-squat", 1);
    expect(p.ankles[1][0]).toBeGreaterThanOrEqual(26);
    expect(p.ankles[0][0]).toBeLessThanOrEqual(-26);
  });
  it("sits straight down to about level thighs with the knees out over the toes", () => {
    const b = poseAt("db-sumo-squat", 1);
    for (const s of [0, 1] as const) {
      expect(Math.abs(b.knees[s][1] - b.hips[s][1])).toBeLessThan(6);
      expect(Math.abs(b.knees[s][0])).toBeGreaterThanOrEqual(Math.abs(b.ankles[s][0]));
      expect(Math.abs(b.knees[s][0])).toBeLessThan(Math.abs(b.ankles[s][0]) + 14);
    }
    let prev = Infinity;
    let prevReach = Infinity;
    for (const d of WALK) {
      const p = poseAt("db-sumo-squat", d);
      expect(p.hips[1][1]).toBeLessThanOrEqual(prev + 1e-9);
      expect(dist(p.hips[1], p.ankles[1])).toBeLessThanOrEqual(prevReach + 1e-9);
      prev = p.hips[1][1];
      prevReach = dist(p.hips[1], p.ankles[1]);
      // the hips drop more than they travel back (a squat, not a hinge)
      expect(Math.abs(p.hips[1][2])).toBeLessThan(16);
    }
  });
  it("keeps the torso upright and the dumbbell hanging between the legs on straight arms", () => {
    expect(model("db-sumo-squat").implement).toBe("goblet");
    for (const d of WALK) {
      const p = poseAt("db-sumo-squat", d);
      expect(lean(p)).toBeLessThan(22);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(53.5);
      expect(Math.abs(p.wrists[1][0])).toBeLessThan(6);
      expect(Math.abs(p.wrists[1][0])).toBeLessThan(Math.abs(p.knees[1][0]) - 6);
      expect(p.wrists[1][1]).toBeLessThan(p.hips[1][1] + 1);
    }
    const b = poseAt("db-sumo-squat", 1);
    expect(b.wrists[1][1]).toBeLessThan(b.hips[1][1]);
  });
  it("starts standing straight: ankle z equals hip z", () => {
    const a = poseAt("db-sumo-squat", 0);
    expect(Math.abs(a.hips[1][2] - a.ankles[1][2])).toBeLessThan(0.5);
  });
});

describe("dumbbell side bend", () => {
  it("is a one-dumbbell neutral-grip lift with the hips and feet fixed", () => {
    expect(model("db-side-bend").oneDumbbell).toBe(true);
    expect(model("db-side-bend").neutralGrip).toBe(true);
    expectPlanted("db-side-bend");
    const a = poseAt("db-side-bend", 0);
    for (const d of WALK) {
      const p = poseAt("db-side-bend", d);
      expect(p.hips[0]).toEqual(a.hips[0]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.knees[1]).toEqual(a.knees[1]);
      // no forward or backward lean: everything stays in the frontal plane
      expect(p.shoulders[1][2]).toBe(0);
      expect(p.shoulders[0][2]).toBe(0);
      expect(p.head[2]).toBe(0);
    }
  });
  it("bends sideways toward the dumbbell: that shoulder drops, the hand slides down the thigh", () => {
    const a = poseAt("db-side-bend", 0);
    const b = poseAt("db-side-bend", 1);
    expect(a.shoulders[1][1]).toBeCloseTo(a.shoulders[0][1], 6);
    expect(b.shoulders[0][1] - b.shoulders[1][1]).toBeGreaterThan(15);
    expect(b.head[0]).toBeGreaterThan(a.head[0] + 20);
    expect(a.wrists[1][1] - b.wrists[1][1]).toBeGreaterThan(8);
    expect(a.wrists[1][1]).toBeGreaterThan(b.hips[1][1] - 20);
    // the hand follows the thigh instead of swinging out
    for (const d of WALK) {
      const p = poseAt("db-side-bend", d);
      expect(Math.abs(p.wrists[1][0] - p.knees[1][0])).toBeLessThan(10);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(54);
    }
  });
  it("keeps the spine length and the head over the shoulders", () => {
    for (const d of WALK) {
      const p = poseAt("db-side-bend", d);
      const mid: V3 = [
        (p.shoulders[0][0] + p.shoulders[1][0]) / 2,
        (p.shoulders[0][1] + p.shoulders[1][1]) / 2,
        0,
      ];
      const hipMid: V3 = [0, p.hips[1][1], 0];
      // a curved spine is a little shorter than the straight 50 cm, never longer
      expect(dist(mid, hipMid)).toBeLessThanOrEqual(50.001);
      expect(dist(mid, hipMid)).toBeGreaterThan(44);
      expect(dist(mid, p.head)).toBeGreaterThan(20);
      expect(dist(mid, p.head)).toBeLessThan(24);
    }
  });
  it("rests the free hand on the hip with the elbow out to the side", () => {
    for (const d of WALK) {
      const p = poseAt("db-side-bend", d);
      expect(p.wrists[0][0]).toBeLessThan(-10);
      expect(Math.abs(p.wrists[0][1] - p.hips[0][1])).toBeLessThan(15);
      expect(dist(p.wrists[0], p.head)).toBeGreaterThan(40);
      // the elbow never rises above the shoulder, so no stub shows over the head
      expect(p.elbows[0][1]).toBeLessThan(p.shoulders[0][1]);
      expect(p.elbows[0][0]).toBeLessThan(p.shoulders[0][0] - 10);
    }
  });
});

describe("good morning", () => {
  it("keeps the bar over the mid-foot all rep, on the traps behind the neck", () => {
    for (const d of WALK) {
      const p = poseAt("good-morning", d);
      expect(Math.abs(p.bar[2] - 4)).toBeLessThanOrEqual(10);
      expect(p.bar[1]).toBeGreaterThan(p.shoulders[1][1]);
      expect(p.bar[2]).toBeLessThan(p.head[2] + 4);
    }
  });
  it("hinges: hips travel back, torso tips toward horizontal, knees stay soft", () => {
    expectPlanted("good-morning");
    const a = poseAt("good-morning", 0);
    const b = poseAt("good-morning", 1);
    expect(lean(a)).toBeLessThan(2);
    expect(lean(b)).toBeGreaterThan(50);
    expect(lean(b)).toBeLessThan(72);
    expect(b.hips[1][2]).toBeLessThan(a.hips[1][2] - 30);
    let prevZ = Infinity;
    let prevLean = -Infinity;
    for (const d of WALK) {
      const p = poseAt("good-morning", d);
      expect(p.hips[1][2]).toBeLessThanOrEqual(prevZ + 1e-9);
      expect(lean(p)).toBeGreaterThanOrEqual(prevLean - 1e-9);
      prevZ = p.hips[1][2];
      prevLean = lean(p);
      // soft knees: the hips never drop into a squat, the shins never lean back
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(78);
      expect(p.hips[1][1]).toBeGreaterThan(p.knees[1][1] + 15);
      expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] - 5);
    }
  });
  it("starts standing straight: ankle z equals hip z", () => {
    const a = poseAt("good-morning", 0);
    expect(Math.abs(a.hips[1][2] - a.ankles[1][2])).toBeLessThan(0.5);
  });
  it("keeps a neutral neck: the head follows the back at about half its lean", () => {
    const p = poseAt("good-morning", 1);
    const neck = deg(Math.atan2(p.head[2] - p.shoulders[1][2], p.head[1] - p.shoulders[1][1]));
    expect(neck).toBeGreaterThan(0.4 * lean(p));
    expect(neck).toBeLessThan(0.75 * lean(p));
  });
});
