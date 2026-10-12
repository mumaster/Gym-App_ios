import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { ExerciseDetailSheet } from "../../../components/gym/ExerciseDetailSheet";
import { EXERCISES } from "../data";
import {
  BENCH_PRESS_RIG,
  deadliftPose,
  depthAt,
  elbowFlare,
  EXERCISE_ANIMATIONS,
  gobletPose,
  latPulldownPose,
  phaseAt,
  pressPose,
  rdlPose,
  seatedPressPose,
  type FigurePose,
} from "../exerciseAnimation";
import { GymProvider } from "../store";

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));

describe("bench press rig", () => {
  const rig = BENCH_PRESS_RIG;
  it("keeps limb lengths constant through the rep", () => {
    for (const d of [0, 0.3, 0.7, 1]) {
      const p = pressPose(rig, d);
      expect(dist(p.shoulders[1], p.elbows[1])).toBeCloseTo(rig.upperArm, 3);
      expect(dist(p.elbows[1], p.wrists[1])).toBeCloseTo(rig.forearm, 3);
    }
  });
  it("stacks wrists over elbows with 45-75 degree elbows at the bottom", () => {
    const p = pressPose(rig, 1);
    expect(Math.abs(p.elbows[1][0] - p.wrists[1][0])).toBeLessThan(2);
    expect(p.elbows[1][1]).toBeLessThan(p.wrists[1][1]);
    expect(elbowFlare(p)).toBeGreaterThan(45);
    expect(elbowFlare(p)).toBeLessThan(75);
  });
  it("touches the lower chest and locks out over the shoulders", () => {
    const bottom = pressPose(rig, 1);
    const top = pressPose(rig, 0);
    expect(bottom.bar[2]).toBeGreaterThan(top.bar[2]);
    expect(top.bar[1]).toBeGreaterThan(bottom.bar[1] + 30);
    // lockout: the arm is (almost) straight
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(rig.upperArm + rig.forearm - 2);
  });
  it("plants the feet and runs one rep from lockout through the chest and back", () => {
    expect(pressPose(rig, 0.5).ankles[1][1]).toBe(rig.ankleY);
    expect(depthAt(0)).toBe(0);
    expect(depthAt(0.45)).toBe(1);
    expect(depthAt(0.9)).toBe(0);
    expect([0, 0.45, 0.6, 0.9].map(phaseAt)).toEqual(["lower", "touch", "press", "lockout"]);
  });
});

const ANIMATED = [
  "bb-bench",
  "bb-deadlift",
  "db-shoulder-press",
  "goblet-squat",
  "lat-pulldown",
  "rdl",
];

const POSES: Record<string, (d: number) => FigurePose> = {
  "bb-deadlift": deadliftPose,
  rdl: rdlPose,
  "goblet-squat": gobletPose,
  "db-shoulder-press": seatedPressPose,
  "lat-pulldown": latPulldownPose,
};

describe("figure rigs", () => {
  it("keep limb lengths constant and the feet planted through the rep", () => {
    for (const pose of Object.values(POSES)) {
      for (const d of [0, 0.25, 0.5, 0.75, 1]) {
        const p = pose(d);
        for (const i of [0, 1] as const) {
          expect(dist(p.shoulders[i], p.elbows[i])).toBeCloseTo(29, 3);
          expect(dist(p.elbows[i], p.wrists[i])).toBeCloseTo(26, 0);
          // a fully straight leg is clamped to its reach, so the shin may stretch a hair

          expect(dist(p.hips[i], p.knees[i])).toBeCloseTo(45, 3);
          expect(Math.abs(dist(p.knees[i], p.ankles[i]) - 43)).toBeLessThan(1.2);
        }
        expect(p.ankles[1][1]).toBe(8);
      }
    }
  });
  it("deadlift: bar over the mid-foot, knees extend smoothly, then lockout", () => {
    const floor = deadliftPose(1);
    expect(floor.bar[1]).toBeCloseTo(22.5, 3);
    expect(Math.abs(floor.bar[2] - 3)).toBeLessThan(2);
    // The legs straighten gradually (no early lockout, no sudden jump) and the
    // knees never travel far from the bar.
    let prev = dist(floor.hips[1], floor.ankles[1]);
    for (let d = 0.95; d >= -0.001; d -= 0.05) {
      const p = deadliftPose(Math.max(0, d));
      const reach = dist(p.hips[1], p.ankles[1]);
      expect(reach).toBeGreaterThanOrEqual(prev - 0.5);
      expect(reach - prev).toBeLessThan(4);
      if (d > 0.15) expect(reach).toBeLessThan(86);
      expect(Math.abs(p.knees[1][2] - p.bar[2])).toBeLessThan(12);
      prev = reach;
    }
    const rise = deadliftPose(0.7);
    expect(rise.hips[1][1]).toBeGreaterThan(floor.hips[1][1] + 8);
    expect(rise.shoulders[1][1]).toBeGreaterThan(floor.shoulders[1][1] + 10);
    const top = deadliftPose(0);
    expect(top.hips[1][1]).toBeGreaterThan(90);
    expect(Math.abs(top.shoulders[1][2] - top.hips[1][2])).toBeLessThan(10);
  });
  it("RDL: the knees stay soft while the hips travel back", () => {
    const knee = (p: FigurePose) => dist(p.hips[1], p.ankles[1]);
    for (const d of [0, 0.5, 1]) expect(knee(rdlPose(d))).toBeLessThan(88);
    expect(rdlPose(1).hips[1][2]).toBeLessThan(rdlPose(0).hips[1][2] - 20);
    expect(rdlPose(1).shoulders[1][1]).toBeLessThan(rdlPose(0).shoulders[1][1] - 25);
  });
  it("goblet squat: hips below the knees, knees over the toes, torso upright", () => {
    const p = gobletPose(1);
    expect(p.hips[1][1]).toBeLessThan(p.knees[1][1] + 4); // parallel or deeper
    expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] + 10);
    const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
    expect((lean * 180) / Math.PI).toBeLessThan(35);
  });
  it("seated press: wrists over elbows at the bottom, locked out overhead", () => {
    const bottom = seatedPressPose(1);
    expect(Math.abs(bottom.elbows[1][0] - bottom.wrists[1][0])).toBeLessThan(4);
    expect(bottom.wrists[1][1]).toBeGreaterThan(bottom.elbows[1][1] + 20);
    const top = seatedPressPose(0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(52);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1] + 45);
    expect(top.hips[1][2]).toBeGreaterThan(top.shoulders[1][2]);
  });
  it("lat pulldown: leaning back, bar to the upper chest, elbows below the hands", () => {
    const bottom = latPulldownPose(1);
    const top = latPulldownPose(0);
    expect(bottom.shoulders[1][2]).toBeLessThan(bottom.hips[1][2]);
    expect(top.wrists[1][1]).toBeGreaterThan(bottom.wrists[1][1] + 40);
    expect(Math.abs(bottom.wrists[1][1] - bottom.shoulders[1][1])).toBeLessThan(15);
    expect(bottom.elbows[1][1]).toBeLessThan(bottom.wrists[1][1] - 8);
    expect(bottom.elbows[1][2]).toBeLessThan(bottom.wrists[1][2]);
  });
});

const wrap = (child: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, child));

describe("ExerciseAnimation render", () => {
  it("renders every animated exercise and nothing for exercises without one", () => {
    for (const id of ANIMATED) {
      expect(wrap(createElement(ExerciseAnimation, { exerciseId: id }))).toContain("<svg");
    }
    expect(wrap(createElement(ExerciseAnimation, { exerciseId: "unknown" }))).toBe("");
    expect(Object.keys(EXERCISE_ANIMATIONS).sort()).toEqual(ANIMATED);
  });
  it("shows up in the exercise sheet for the barbell bench press only", () => {
    const bench = EXERCISES.find((e) => e.id === "bb-bench")!;
    const other = EXERCISES.find((e) => e.id === "db-bench")!;
    const open = (e: typeof bench) =>
      wrap(createElement(ExerciseDetailSheet, { exercise: e, onClose: () => {} }));
    expect(() => open(bench)).not.toThrow();
    expect(open(bench)).toContain("<svg");
    expect(open(other)).not.toContain('role="img"');
  });
  it("has cues, captions and names in both languages, and matches catalog ids", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const id of ANIMATED) {
      const spec = EXERCISE_ANIMATIONS[id]!;
      expect(spec.cues.en.length).toBeGreaterThan(0);
      expect(spec.cues.nl.length).toBe(spec.cues.en.length);
      if (id !== "bb-bench") {
        expect(Object.keys(spec.phases!.nl)).toEqual(Object.keys(spec.phases!.en));
        expect(spec.labels!.nl.side).not.toBe("");
      }
    }
    expect(ANIMATED.every((id) => ids.has(id))).toBe(true);
  });
});
