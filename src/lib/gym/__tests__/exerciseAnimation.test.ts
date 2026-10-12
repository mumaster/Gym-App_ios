import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { ExerciseDetailSheet } from "../../../components/gym/ExerciseDetailSheet";
import { EXERCISES } from "../data";
import {
  BENCH_PRESS_RIG,
  depthAt,
  elbowFlare,
  EXERCISE_ANIMATIONS,
  phaseAt,
  pressPose,
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

const wrap = (child: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, child));

describe("ExerciseAnimation render", () => {
  it("renders the bench press and nothing for exercises without one", () => {
    expect(wrap(createElement(ExerciseAnimation, { exerciseId: "bb-bench" }))).toContain("<svg");
    expect(wrap(createElement(ExerciseAnimation, { exerciseId: "unknown" }))).toBe("");
    expect(Object.keys(EXERCISE_ANIMATIONS)).toEqual(["bb-bench"]);
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
  it("has cues in both languages", () => {
    const { cues } = EXERCISE_ANIMATIONS["bb-bench"]!;
    expect(cues.en.length).toBeGreaterThan(0);
    expect(cues.nl.length).toBe(cues.en.length);
  });
});
