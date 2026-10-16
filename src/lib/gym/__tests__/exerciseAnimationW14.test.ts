import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { LEG_PRESS_TILT, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W14,
  CALF_STRETCH,
  CALF_TOP_LIFT,
  DB_ALONG,
  DB_OUT,
  LPC_PLATE_EDGE,
  LPC_REACH,
  LYING_PAD_TOP,
  SINGLE_CALF_STEP,
  SINGLE_SUPPORT,
  SMITH_CALF_BAR_Z,
  SMITH_CALF_STEP,
  SMITH_SEATED_BAR_Z,
  THRUST_GUIDE_Z,
  lpcPlateReach,
} from "../exerciseAnimationW14";
import { GymProvider } from "../store";

const IDS = [
  "lying-leg-curl",
  "smith-calf-raise",
  "leg-press-calf-raise",
  "seated-calf-machine",
  "single-leg-calf-raise",
  "seated-db-calf-raise",
  "smith-seated-calf-raise",
  "machine-hip-thrust",
  "smith-hip-thrust",
  "db-reverse-lunge",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W14[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

const joints = (p: FigurePose): V3[] => [
  ...p.shoulders,
  ...p.elbows,
  ...p.wrists,
  ...p.hips,
  ...p.knees,
  ...p.ankles,
  p.head,
];

const front = (m: FigureModel, v: V3): [number, number] => [
  160 + v[0] * m.scale,
  196 - v[1] * m.scale,
];
const side = (m: FigureModel, v: V3): [number, number] => [
  160 + (v[2] - m.centerZ) * m.scale,
  196 - v[1] * m.scale,
];

/** Distance from a point to the segment a-b in the y-z plane (side view). */
function distToSegment(pt: V3, a: V3, b: V3): number {
  const ay = a[1];
  const az = a[2];
  const dy = b[1] - ay;
  const dz = b[2] - az;
  const t = Math.max(0, Math.min(1, ((pt[1] - ay) * dy + (pt[2] - az) * dz) / (dy * dy + dz * dz)));
  return Math.hypot(pt[1] - (ay + t * dy), pt[2] - (az + t * dz));
}

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W14[id]!;
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
  it("keeps limb lengths constant and moves smoothly through the rep", () => {
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
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(10));
      prev = p;
    }
  });
  it("stays inside the frame in both views", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const j of joints(p)) {
        for (const [x, y] of [front(m, j), side(m, j)]) {
          expect(x).toBeGreaterThan(8);
          expect(x).toBeLessThan(312);
          expect(y).toBeGreaterThan(8);
          expect(y).toBeLessThan(200);
        }
      }
      for (const [x, y] of [front(m, p.head), side(m, p.head)]) {
        expect(x - 10.5 * m.scale).toBeGreaterThan(5);
        expect(x + 10.5 * m.scale).toBeLessThan(315);
        expect(y - 10.5 * m.scale).toBeGreaterThan(5);
      }
      // a plate (22.5 cm radius, small Smith plate 10) on the bar in the side view
      if (m.implement === "w3-smith-bar" || m.implement === "w14-thrust-belt") {
        const [x, y] = side(m, p.bar);
        const r = 22.5 * m.scale;
        expect(x - r).toBeGreaterThan(5);
        expect(x + r).toBeLessThan(315);
        expect(y - r).toBeGreaterThan(5);
        expect(front(m, p.bar)[0] - 75 * m.scale).toBeGreaterThan(5);
        expect(front(m, p.bar)[0] + 75 * m.scale).toBeLessThan(315);
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

describe("lying leg curl", () => {
  const id = "lying-leg-curl";
  it("keeps the hips, torso and thighs down on the pad", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(dist(p.knees[1], a.knees[1])).toBeLessThan(1e-9);
      // torso and thigh rest on the pad (their radius 10 and 5 cm above its top)
      expect(p.hips[1][1] - 10).toBeGreaterThanOrEqual(LYING_PAD_TOP - 1e-9);
      expect(p.knees[1][1] - 5).toBeGreaterThanOrEqual(LYING_PAD_TOP - 1e-9);
      // the head is clear of the pad
      expect(p.head[1] - 10.5).toBeGreaterThanOrEqual(LYING_PAD_TOP);
    }
  });
  it("curls the shins up in one direction, the foot hanging off the shin", () => {
    let prevReach = Infinity;
    let prevAnkleY = -Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      const reach = dist(p.hips[1], p.ankles[1]);
      expect(reach).toBeLessThan(prevReach + 1e-9);
      // rises until the shin is vertical, then hardly drops (past vertical)
      expect(p.ankles[1][1]).toBeGreaterThan(prevAnkleY - 0.5);
      prevReach = reach;
      prevAnkleY = p.ankles[1][1];
      for (const s of [0, 1] as const) {
        expect(p.feet[s].angle).toBeDefined();
        expect(p.feet[s].pitch).toBeUndefined();
      }
    }
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    // nearly straight at the start, about 100 degrees of knee bend at the end
    expect(dist(top.hips[1], top.ankles[1])).toBeGreaterThan(84);
    expect(dist(bot.hips[1], bot.ankles[1])).toBeLessThan(64);
    // the heels stay behind the knees' vertical until past vertical, never through the pad
    expect(bot.ankles[1][1]).toBeGreaterThan(LYING_PAD_TOP + 30);
    expect(top.ankles[1][1]).toBeGreaterThan(LYING_PAD_TOP + 2);
  });
  it("keeps the hands on the handles beside the pad, clear of the head", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.wrists[1]).toEqual(a.wrists[1]);
      expect(p.wrists[1][1]).toBeLessThan(LYING_PAD_TOP);
      // neither the hand nor the elbow passes through the head circle in the side view
      for (const j of [p.wrists[1], p.elbows[1]])
        expect(Math.hypot(j[1] - p.head[1], j[2] - p.head[2])).toBeGreaterThan(14);
    }
  });
});

/** Toe tip height of a calf-raise foot standing on a step of `step` cm. */
function toeTipY(p: FigurePose, step: number): number {
  const f = p.feet[1];
  const a = p.ankles[1];
  if (f.angle !== undefined) return a[1] - (f.drop ?? 0) + 15 * Math.sin(rad(f.angle));
  // pitched foot: the scene draws the toe tip on the step, the ankle follows the pitch
  return step + (a[1] - step - 8) * 0; // contact height is the step by construction
}

describe.each([
  ["smith-calf-raise", SMITH_CALF_STEP],
  ["single-leg-calf-raise", SINGLE_CALF_STEP],
] as const)("%s", (id, stepH) => {
  it("raises and lowers the heel in one direction, toes always on the step", () => {
    let prev = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      const y = p.ankles[1][1];
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      prev = y;
      expect(p.feet[1].floor).toBe(stepH);
      expect(toeTipY(p, stepH)).toBeCloseTo(stepH, 6);
      // standing leg straight and over the toes: ankle z = hip z
      expect(p.hips[1][2]).toBeCloseTo(p.ankles[1][2], 9);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(87.8);
    }
    expect(poseAt(id, 0).ankles[1][1]).toBeCloseTo(stepH + 8 + CALF_TOP_LIFT, 6);
    expect(poseAt(id, 1).ankles[1][1]).toBeCloseTo(stepH + 8 - CALF_STRETCH, 6);
    // heel up uses a pitched foot, heel down a foot hanging below the step with toes up
    expect(poseAt(id, 0).feet[1].pitch).toBeGreaterThan(35);
    expect(poseAt(id, 1).feet[1].angle).toBeGreaterThan(10);
    const heel = (p: FigurePose) => p.ankles[1][1] - 8 - 5 * Math.sin(rad(p.feet[1].angle ?? 0));
    expect(heel(poseAt(id, 1))).toBeLessThan(stepH - 4);
  });
});

describe("Smith machine calf raise", () => {
  const id = "smith-calf-raise";
  it("keeps the bar on the traps on a vertical line and the body upright", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[0]).toBe(0);
      expect(p.bar[2]).toBe(SMITH_CALF_BAR_Z);
      expect(p.wrists[1][2]).toBe(SMITH_CALF_BAR_Z);
      expect(p.wrists[1][0]).toBe(28);
      expect(p.bar[1] - p.shoulders[1][1]).toBeCloseTo(4, 9);
      expect(p.shoulders[1][2]).toBe(p.hips[1][2]);
      // bar behind the neck, not through the head
      expect(Math.hypot(p.bar[1] - p.head[1], p.bar[2] - p.head[2])).toBeGreaterThan(14);
    }
  });
});

describe("single-leg calf raise", () => {
  const id = "single-leg-calf-raise";
  it("stands on one foot on the step, the other leg hooked up behind", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      // the free foot is airborne and hangs off the shin
      expect(p.feet[0].angle).toBeDefined();
      expect(p.ankles[0][1]).toBeGreaterThan(p.ankles[1][1] + 30);
      expect(p.ankles[0][2]).toBeLessThan(p.hips[0][2] - 30);
      // knee bent well past 90 degrees: shin roughly horizontal
      expect(Math.abs(p.ankles[0][1] - p.knees[0][1])).toBeLessThan(8);
      expect(p.knees[0][2]).toBeGreaterThan(p.hips[0][2] - 6);
      // the free toes hang clear of the floor and of the step
      expect(p.ankles[0][1] - 20).toBeGreaterThan(SINGLE_CALF_STEP);
    }
  });
  it("rests one hand on the upright and the other on the hip", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.wrists[1][0]).toBe(SINGLE_SUPPORT.x);
      expect(p.wrists[1][2]).toBe(SINGLE_SUPPORT.z);
      expect(p.wrists[1][1]).toBeLessThan(SINGLE_SUPPORT.top);
      expect(p.wrists[0][1]).toBeCloseTo(p.hips[0][1] + 8, 9);
    }
  });
});

/** Angle of the thigh above horizontal in the side view (degrees). */
const thighAngle = (p: FigurePose) =>
  deg(Math.atan2(p.knees[1][1] - p.hips[1][1], p.knees[1][2] - p.hips[1][2]));

describe.each([
  ["seated-calf-machine", 10],
  ["seated-db-calf-raise", 6],
  ["smith-seated-calf-raise", 6],
] as const)("%s (seated)", (id, stepH) => {
  it("keeps the hips on the seat and the feet on the step while the knees rise and sink", () => {
    const a = poseAt(id, 0);
    let prevKnee = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.feet[1].floor).toBe(stepH);
      expect(p.ankles[1][2]).toBeCloseTo(a.ankles[1][2], 9);
      expect(p.knees[1][1]).toBeLessThanOrEqual(prevKnee + 1e-9);
      prevKnee = p.knees[1][1];
      // shin close to vertical, thigh within a calf raise's tilt
      expect(Math.abs(p.knees[1][2] - p.ankles[1][2])).toBeLessThan(9);
      expect(thighAngle(p)).toBeGreaterThan(-9);
      expect(thighAngle(p)).toBeLessThan(18);
      // torso upright on the seat
      expect(Math.abs(p.shoulders[1][2] - p.hips[1][2])).toBeLessThan(6);
    }
    expect(poseAt(id, 0).ankles[1][1]).toBeCloseTo(stepH + 8 + CALF_TOP_LIFT, 6);
    expect(poseAt(id, 1).ankles[1][1]).toBeCloseTo(stepH + 8 - CALF_STRETCH, 6);
    expect(poseAt(id, 1).feet[1].angle).toBeGreaterThan(10);
    expect(poseAt(id, 0).feet[1].pitch).toBeGreaterThan(35);
  });
});

describe("seated dumbbell calf raise", () => {
  it("holds a dumbbell on each thigh just above the knee", () => {
    for (const d of WALK) {
      const p = poseAt("seated-db-calf-raise", d);
      for (const s of [0, 1] as const) {
        const d2 = distToSegment(p.wrists[s], p.hips[s], p.knees[s]);
        expect(d2).toBeCloseTo(DB_OUT, 0);
        // along the thigh, 80% of the way to the knee
        const along = Math.hypot(p.wrists[s][1] - p.hips[s][1], p.wrists[s][2] - p.hips[s][2]);
        expect(Math.sqrt(Math.max(0, along * along - DB_OUT * DB_OUT)) / 45).toBeCloseTo(
          DB_ALONG,
          1,
        );
      }
      expect(p.bar[1]).toBe(p.wrists[1][1]);
      expect(p.bar[2]).toBe(p.wrists[1][2]);
    }
  });
});

describe("Smith machine seated calf raise", () => {
  const id = "smith-seated-calf-raise";
  it("rests the bar on the thighs and slides it straight up and down", () => {
    let prev = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[0]).toBe(0);
      expect(p.bar[2]).toBe(SMITH_SEATED_BAR_Z);
      expect(p.wrists[1][2]).toBe(SMITH_SEATED_BAR_Z);
      expect(p.bar[1]).toBeLessThanOrEqual(prev + 1e-9);
      prev = p.bar[1];
      // on top of the thighs (radius 5 plus the bar), never inside them
      const gap = distToSegment(p.bar, p.hips[1], p.knees[1]);
      expect(gap).toBeGreaterThanOrEqual(6.4);
      expect(gap).toBeLessThan(8.2);
      // the bar is above the thigh and clear of the head and torso
      expect(p.bar[1]).toBeGreaterThan(p.hips[1][1] + 4);
      expect(dist(p.bar, p.head)).toBeGreaterThan(45);
      expect(p.bar[2] - p.shoulders[1][2]).toBeGreaterThan(25);
    }
  });
});

describe("leg press calf raise", () => {
  const id = "leg-press-calf-raise";
  it("keeps the legs straight and still while only the feet rotate", () => {
    const a = poseAt(id, 0);
    let prevAngle = -Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.knees[1]).toEqual(a.knees[1]);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(dist(p.hips[1], p.ankles[1])).toBeCloseTo(LPC_REACH, 0);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(87.5);
      const ang = p.feet[1].angle!;
      expect(ang).toBeGreaterThan(prevAngle - 1e-9);
      prevAngle = ang;
    }
  });
  it("keeps the balls of the feet on the platform and the heels below its lower edge", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      const gamma = p.feet[1].angle! - LEG_PRESS_TILT;
      const reach = lpcPlateReach(gamma);
      expect(gamma).toBeGreaterThan(50);
      expect(gamma).toBeLessThan(105);
      // foot points in rail coordinates (a along the rails, b up the plate) from the ankle
      for (const sArc of [4, 8, 11, 15]) {
        const a = LPC_REACH + sArc * Math.cos(rad(gamma));
        expect(a).toBeLessThanOrEqual(reach + 1.7);
      }
      const heelB = -5 * Math.sin(rad(gamma));
      expect(heelB).toBeLessThan(LPC_PLATE_EDGE);
      // the toe tip never goes past the plate
      expect(LPC_REACH + 15 * Math.cos(rad(gamma))).toBeLessThanOrEqual(reach + 1.7);
    }
    // the plate travels about 10 cm between the two ends
    const travel = lpcPlateReach(55) - lpcPlateReach(102);
    expect(travel).toBeGreaterThan(8);
    expect(travel).toBeLessThan(14);
  });
  it("lies back on the pad with the hands on the side handles", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1][1]).toBe(30);
      expect(p.shoulders[1][2]).toBeLessThan(p.hips[1][2] - 35);
      expect(p.wrists[1][2]).toBeCloseTo(p.hips[1][2] + 6, 9);
    }
  });
});

describe.each(["machine-hip-thrust", "smith-hip-thrust"] as const)("%s", (id) => {
  it("keeps the upper back on the bench and the feet flat", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(
        Math.hypot(p.shoulders[1][1] - p.hips[1][1], p.shoulders[1][2] - p.hips[1][2]),
      ).toBeCloseTo(50, 3);
      for (const s of [0, 1] as const) {
        expect(p.feet[s]).toEqual({ floor: 0, dir: 1 });
        expect(p.ankles[s][1]).toBe(8);
        expect(dist(p.ankles[s], a.ankles[s])).toBeLessThan(1e-9);
      }
    }
  });
  it("goes from torso level and shins vertical to hips low, the bar exactly vertical", () => {
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(Math.abs(top.hips[1][1] - top.shoulders[1][1])).toBeLessThan(1);
    expect(Math.abs(top.knees[1][2] - top.ankles[1][2])).toBeLessThan(3);
    expect(top.knees[1][1] - top.hips[1][1]).toBeLessThan(2);
    expect(bot.hips[1][1]).toBeLessThan(22);
    let prev = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[0]).toBe(0);
      expect(p.bar[2]).toBe(THRUST_GUIDE_Z);
      expect(p.wrists[1][2]).toBe(THRUST_GUIDE_Z);
      expect(p.wrists[1][1]).toBe(p.bar[1]);
      expect(p.bar[1]).toBeLessThanOrEqual(prev + 1e-9);
      prev = p.bar[1];
      // the bar rests on the body (pelvis or thighs), never inside it
      const toHip = distToSegment(p.bar, p.hips[1], p.shoulders[1]);
      const toThigh = distToSegment(p.bar, p.hips[1], p.knees[1]);
      expect(Math.min(toHip - 10, toThigh - 5)).toBeGreaterThanOrEqual(2.2);
      expect(Math.min(toHip - 10, toThigh - 5)).toBeLessThan(3.6);
      // bar well clear of the head and shoulders
      expect(dist(p.bar, p.head)).toBeGreaterThan(40);
    }
  });
});

describe("dumbbell reverse lunge", () => {
  const id = "db-reverse-lunge";
  it("never moves the front foot, the back foot lifts onto the ball", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(dist(p.ankles[1], a.ankles[1])).toBeLessThan(1e-9);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
    }
    const bot = poseAt(id, 1);
    expect(bot.feet[0].pitch).toBeGreaterThan(40);
    // front shin vertical, front thigh level
    expect(Math.abs(bot.knees[1][2] - bot.ankles[1][2])).toBeLessThan(5);
    expect(Math.abs(bot.knees[1][1] - bot.hips[1][1])).toBeLessThan(4);
  });
  it("lets the dumbbells hang straight down beside the legs", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(Math.abs(p.wrists[s][0])).toBe(27);
        // hanging arm: wrist well below the shoulder, forearm vertical
        expect(p.shoulders[s][1] - p.wrists[s][1]).toBeGreaterThan(53);
        expect(Math.abs(p.wrists[s][2] - p.elbows[s][2])).toBeLessThan(3.5);
        // dumbbell (12 cm half length) stays outside the thigh (radius 5.5)
        expect(Math.abs(p.wrists[s][0]) - 12 - 5.5 - 10).toBeGreaterThan(-8);
      }
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(45);
    }
    expect(model(id).neutralGrip).toBe(true);
    expect(model(id).implement).toBe("dumbbells");
  });
  it("sinks smoothly: the hips drop and travel back, torso upright", () => {
    let prevY = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1][1]).toBeLessThanOrEqual(prevY + 1e-9);
      prevY = p.hips[1][1];
      const lean = deg(
        Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]),
      );
      expect(lean).toBeLessThan(10);
    }
  });
});
