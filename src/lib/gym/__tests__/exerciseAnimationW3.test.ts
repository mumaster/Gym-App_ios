import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { depthAt, elbowFlare, type FigurePose, type Pose, type V3 } from "../exerciseAnimation";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import {
  ANIMATIONS_W3,
  bbInclineBenchPose,
  dbBenchPose,
  dbFlyPose,
  ohpPose,
  singleArmDbBenchPose,
  smithInclinePose,
} from "../exerciseAnimationW3";
import { GymProvider } from "../store";

const IDS = [
  "db-bench",
  "single-arm-db-bench",
  "db-fly",
  "bb-incline-bench",
  "smith-incline-press",
  "ohp",
];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const STEPS = Array.from({ length: 21 }, (_, i) => i * 0.05);
const figureOf = (id: string) => ANIMATIONS_W3[id]!.figure!;

/** Every joint of a pose, with the radius it needs around it (cm). */
function joints(pose: FigurePose, implement: string): { at: V3; r: number }[] {
  const out: { at: V3; r: number }[] = [];
  for (const k of ["shoulders", "elbows", "wrists", "hips", "knees", "ankles"] as const)
    for (const v of pose[k]) out.push({ at: v, r: 3 });
  out.push({ at: pose.head, r: 10.5 });
  if (implement === "barbell" || implement === "w3-smith-bar") out.push({ at: pose.bar, r: 22.5 });
  if (implement === "dumbbells") for (const w of pose.wrists) out.push({ at: w, r: 7 });
  return out;
}

describe("W3 animations: specs", () => {
  it("has a complete spec for every id, merged into EXERCISE_ANIMATIONS", () => {
    expect(Object.keys(ANIMATIONS_W3).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      const spec = EXERCISE_ANIMATIONS[id]!;
      expect(spec, id).toBeTruthy();
      expect(spec.figure, id).toBeTruthy();
      for (const lang of ["en", "nl"] as const) {
        expect(spec.cues[lang], id).toHaveLength(4);
        expect(Object.keys(spec.phases![lang]).sort(), id).toEqual([
          "lockout",
          "lower",
          "press",
          "touch",
        ]);
        expect(spec.labels![lang].front.length, id).toBeGreaterThan(5);
        expect(spec.labels![lang].side.length, id).toBeGreaterThan(5);
      }
    }
  });
});

describe.each(IDS)("W3 geometry: %s", (id) => {
  const fig = figureOf(id);
  const poses = STEPS.map((d) => fig.pose(d));

  it("keeps every limb length constant and arms within reach", () => {
    for (const p of poses)
      for (const s of [0, 1] as const) {
        expect(dist(p.shoulders[s], p.elbows[s])).toBeCloseTo(29, 3);
        expect(dist(p.elbows[s], p.wrists[s])).toBeCloseTo(26, 3);
        expect(dist(p.hips[s], p.knees[s])).toBeCloseTo(45, 3);
        expect(dist(p.knees[s], p.ankles[s])).toBeCloseTo(43, 3);
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThan(54.95);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThan(87.95);
      }
  });

  it("moves smoothly: no joint jumps between neighbouring samples", () => {
    for (let i = 1; i < poses.length; i++)
      for (const k of ["elbows", "wrists", "knees", "ankles"] as const)
        for (const s of [0, 1] as const)
          expect(dist(poses[i]![k][s], poses[i - 1]![k][s]), `${k} ${i}`).toBeLessThan(7);
  });

  it("moves smoothly through the real rep timing", () => {
    let prev = fig.pose(depthAt(0));
    for (let i = 1; i <= 100; i++) {
      const p = fig.pose(depthAt(i / 100));
      for (const k of ["elbows", "wrists", "knees", "ankles"] as const)
        for (const s of [0, 1] as const)
          expect(dist(p[k][s], prev[k][s]), `${k} ${i}`).toBeLessThan(4);
      prev = p;
    }
  });

  it("stays inside the frame in both views", () => {
    for (const p of poses)
      for (const { at, r } of joints(p, fig.implement)) {
        const fx = 160 + at[0] * fig.scale;
        const sx = 160 + (at[2] - fig.centerZ) * fig.scale;
        const y = 196 - at[1] * fig.scale;
        for (const x of [fx, sx]) {
          expect(x - r * fig.scale).toBeGreaterThanOrEqual(6);
          expect(x + r * fig.scale).toBeLessThanOrEqual(314);
        }
        expect(y - r * fig.scale).toBeGreaterThanOrEqual(6);
        expect(y).toBeLessThanOrEqual(200);
      }
  });

  it("keeps the feet flat on the floor", () => {
    for (const p of poses)
      for (const s of [0, 1] as const) {
        expect(p.ankles[s][1]).toBeCloseTo(8, 3);
        expect(p.feet[s].floor).toBe(0);
        expect(p.feet[s].pitch).toBeUndefined();
        expect(p.feet[s].angle).toBeUndefined();
      }
  });
});

const wristsOverElbows = (p: Pose, tol = 3) => {
  for (const s of [0, 1] as const) {
    expect(Math.abs(p.wrists[s][0] - p.elbows[s][0])).toBeLessThan(tol);
    expect(Math.abs(p.wrists[s][2] - p.elbows[s][2])).toBeLessThan(tol);
    expect(p.wrists[s][1]).toBeGreaterThan(p.elbows[s][1] + 22);
  }
};

describe("W3 posture", () => {
  it("dumbbell bench press: wrists over elbows, elbows 45-60 degrees, lockout over the chest", () => {
    const bottom = dbBenchPose(1);
    wristsOverElbows(bottom);
    expect(elbowFlare(bottom)).toBeGreaterThan(40);
    expect(elbowFlare(bottom)).toBeLessThan(62);
    const top = dbBenchPose(0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54);
    expect(Math.abs(top.wrists[1][0])).toBeLessThan(20);
    // lying flat: shoulders and hips level, head on the bench
    expect(top.hips[1][1]).toBe(top.shoulders[1][1]);
    expect(top.head[1]).toBe(top.shoulders[1][1]);
  });

  it("single-arm dumbbell bench press: free hand rests on the chest, hips level", () => {
    const rest = singleArmDbBenchPose(0).wrists[0];
    for (const d of STEPS) {
      const p = singleArmDbBenchPose(d);
      expect(p.wrists[0]).toEqual(rest);
      expect(p.hips[0][1]).toBe(p.hips[1][1]);
      expect(Math.abs(p.wrists[0][0])).toBeLessThan(12);
    }
    const bottom = singleArmDbBenchPose(1);
    expect(Math.abs(bottom.wrists[1][0] - bottom.elbows[1][0])).toBeLessThan(3);
    expect(bottom.wrists[1][1]).toBeGreaterThan(bottom.elbows[1][1] + 22);
  });

  it("dumbbell flye: the elbow bend is fixed (15-20 degrees) and the hands finish level with the chest", () => {
    const bends = STEPS.map((d) => {
      const p = dbFlyPose(d);
      const u = [0, 1, 2].map((i) => p.shoulders[1][i]! - p.elbows[1][i]!);
      const f = [0, 1, 2].map((i) => p.wrists[1][i]! - p.elbows[1][i]!);
      const cosA =
        (u[0]! * f[0]! + u[1]! * f[1]! + u[2]! * f[2]!) / (Math.hypot(...u) * Math.hypot(...f));
      return 180 - (Math.acos(cosA) * 180) / Math.PI;
    });
    for (const b of bends) {
      expect(b).toBeGreaterThan(15);
      expect(b).toBeLessThan(20);
    }
    expect(Math.max(...bends) - Math.min(...bends)).toBeLessThan(0.01);
    const top = dbFlyPose(0);
    const bottom = dbFlyPose(1);
    expect(Math.abs(top.wrists[1][0])).toBeLessThan(15);
    expect(bottom.wrists[1][0]).toBeGreaterThan(top.wrists[1][0] + 40);
    expect(Math.abs(bottom.wrists[1][1] - 65)).toBeLessThan(8);
    // the arc keeps opening: wrists move outwards and down all the way
    let prev = -Infinity;
    for (const d of STEPS) {
      const x = dbFlyPose(d).wrists[1][0];
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });

  it("incline barbell press: bar to the upper chest, wrists over elbows, lockout over the shoulders", () => {
    const bottom = bbInclineBenchPose(1);
    wristsOverElbows(bottom);
    expect(dist(bottom.bar, [0, bottom.shoulders[1][1], bottom.shoulders[1][2]])).toBeLessThan(18);
    const top = bbInclineBenchPose(0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54);
    expect(Math.abs(top.bar[2] - top.shoulders[1][2])).toBeLessThan(10);
    // the bar never goes through the head
    for (const d of STEPS) {
      const p = bbInclineBenchPose(d);
      expect(Math.hypot(p.bar[1] - p.head[1], p.bar[2] - p.head[2])).toBeGreaterThan(18);
    }
  });

  it("Smith incline press: the bar path is exactly vertical", () => {
    const zs = STEPS.map((d) => smithInclinePose(d).bar[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-9);
    for (const d of STEPS) expect(smithInclinePose(d).bar[0]).toBe(0);
    const bottom = smithInclinePose(1);
    wristsOverElbows(bottom);
    expect(smithInclinePose(0).bar[1]).toBeGreaterThan(bottom.bar[1] + 40);
  });

  it("overhead press: upright torso, vertical bar, bar never through the head, ends over the mid-foot", () => {
    for (const d of STEPS) {
      const p = ohpPose(d);
      expect(p.shoulders[1][2]).toBe(p.hips[1][2]);
      expect(p.ankles[1][2]).toBe(p.hips[1][2]);
      // bar centre stays clear of the head (radius 10.5 plus the bar)
      expect(Math.hypot(p.bar[1] - p.head[1], p.bar[2] - p.head[2])).toBeGreaterThan(12.5);
      expect(p.bar[2]).toBeGreaterThan(2);
      expect(p.bar[2]).toBeLessThan(12);
    }
    const top = ohpPose(0);
    expect(Math.abs(top.bar[2] - (top.ankles[1][2] + 5))).toBeLessThan(3);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54);
    const rack = ohpPose(1);
    wristsOverElbows(rack, 4);
    expect(rack.bar[1]).toBeLessThan(top.bar[1] - 45);
    // the head makes room (back) while the bar passes, then comes forward
    expect(ohpPose(1).head[2]).toBeLessThan(ohpPose(0).head[2]);
  });
});

describe("W3 render", () => {
  it("renders every exercise", () => {
    for (const id of IDS) {
      const html = renderToString(
        createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
      );
      expect(html, id).toContain("<svg");
    }
  });
});
