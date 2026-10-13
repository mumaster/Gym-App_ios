import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import { GymProvider } from "../store";
import {
  ANIMATIONS_W1,
  DIP_BENCH_EDGE,
  DIP_BENCH_Y,
  SPLIT_REAR_ANKLE,
} from "../exerciseAnimationW1";
import type { FigurePose, V3 } from "../exerciseAnimation";

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));
const WALK = Array.from({ length: 21 }, (_, i) => i / 20);
const JOINTS = ["shoulders", "elbows", "wrists", "hips", "knees", "ankles"] as const;
const IDS = [
  "pushup",
  "diamond-pushup",
  "pike-pushup",
  "bench-dip",
  "bodyweight-squat",
  "split-squat",
];
const model = (id: string) => ANIMATIONS_W1[id]!.figure!;
const pose = (id: string, d: number): FigurePose => model(id).pose(d);

describe("W1 animations", () => {
  it("are registered with the exact catalog ids, both languages and four cues", () => {
    for (const id of IDS) {
      const spec = EXERCISE_ANIMATIONS[id]!;
      expect(spec, id).toBeDefined();
      for (const lang of ["en", "nl"] as const) {
        expect(spec.cues[lang]).toHaveLength(4);
        for (const ph of ["lower", "touch", "press", "lockout"] as const)
          expect(spec.phases![lang][ph].length).toBeGreaterThan(5);
        expect(spec.labels![lang].side.length).toBeGreaterThan(5);
      }
    }
  });

  it("keep limb lengths constant, move smoothly and stay inside the frame", () => {
    for (const id of IDS) {
      const m = model(id);
      let prev = pose(id, 0);
      for (const d of WALK) {
        const p = pose(id, d);
        for (const i of [0, 1] as const) {
          expect(dist(p.shoulders[i], p.elbows[i]), `${id} upper arm`).toBeCloseTo(29, 3);
          expect(Math.abs(dist(p.elbows[i], p.wrists[i]) - 26), `${id} forearm ${d}`).toBeLessThan(
            0.3,
          );
          expect(dist(p.hips[i], p.knees[i]), `${id} thigh`).toBeCloseTo(45, 3);
          expect(Math.abs(dist(p.knees[i], p.ankles[i]) - 43), `${id} shin ${d}`).toBeLessThan(0.3);
        }
        if (d > 0) {
          for (const j of JOINTS)
            for (const i of [0, 1] as const)
              expect(dist(p[j][i], prev[j][i]), `${id} ${j} at ${d}`).toBeLessThan(8);
        }
        prev = p;
        const pts = [...JOINTS.flatMap((j) => p[j])];
        for (const q of pts) {
          const fx = 160 + q[0] * m.scale;
          const sx = 160 + (q[2] - m.centerZ) * m.scale;
          const py = 196 - q[1] * m.scale;
          expect(fx, `${id} front x`).toBeGreaterThan(6);
          expect(fx, `${id} front x`).toBeLessThan(314);
          expect(sx - 5 * m.scale, `${id} side x ${d}`).toBeGreaterThan(6);
          expect(sx + 15 * m.scale, `${id} side x ${d}`).toBeLessThan(314);
          expect(py, `${id} y ${d}`).toBeGreaterThan(6);
          expect(py, `${id} y ${d}`).toBeLessThan(200);
        }
        const hx = 160 + (p.head[2] - m.centerZ) * m.scale;
        const hy = 196 - p.head[1] * m.scale;
        expect(hx - 10.5 * m.scale).toBeGreaterThan(6);
        expect(hx + 10.5 * m.scale).toBeLessThan(314);
        expect(hy - 10.5 * m.scale, `${id} head top ${d}`).toBeGreaterThan(6);
        expect(hy + 10.5 * m.scale, `${id} head bottom ${d}`).toBeLessThan(200);
      }
    }
  });

  it("push-up and diamond push-up: one straight line, toes on the floor, hands fixed", () => {
    for (const id of ["pushup", "diamond-pushup"]) {
      const top = pose(id, 0);
      const bottom = pose(id, 1);
      for (const d of WALK) {
        const p = pose(id, d);
        // Shoulder, hip and ankle stay on one line (no sagging or piking hips).
        const line = (a: V3, b: V3) => Math.atan2(b[1] - a[1], b[2] - a[2]) * (180 / Math.PI);
        expect(
          Math.abs(line(p.hips[1], p.shoulders[1]) - line(p.ankles[1], p.hips[1])),
        ).toBeLessThan(1.5);
        // Heels genuinely lifted, toes on the floor.
        expect(p.feet[1].pitch).toBeGreaterThan(50);
        expect(p.feet[1].floor).toBe(0);
        expect(p.wrists[1][1]).toBeLessThan(5);
        expect(p.wrists[1][2]).toBe(top.wrists[1][2]);
      }
      expect(top.shoulders[1][1]).toBeGreaterThan(52);
      expect(bottom.shoulders[1][1]).toBeLessThan(22);
      // The elbows travel behind the torso.
      expect(bottom.elbows[1][2]).toBeLessThan(bottom.shoulders[1][2] - 8);
    }
    // Diamond: hands together, elbows tucked closer than the regular push-up.
    expect(pose("diamond-pushup", 1).wrists[1][0]).toBeLessThan(6);
    expect(pose("diamond-pushup", 1).elbows[1][0]).toBeLessThan(pose("pushup", 1).elbows[1][0] - 5);
    expect(pose("pushup", 1).wrists[1][0]).toBeGreaterThan(19);
  });

  it("pike push-up: hips stay high, feet and hands planted, the head goes toward the floor", () => {
    const top = pose("pike-pushup", 0);
    const bottom = pose("pike-pushup", 1);
    for (const d of WALK) {
      const p = pose("pike-pushup", d);
      expect(p.hips[1][1], `hips ${d}`).toBeGreaterThan(65);
      expect(p.hips[1][1]).toBeGreaterThan(p.shoulders[1][1] + 15);
      expect(p.ankles[1][2]).toBe(top.ankles[1][2]);
      expect(p.wrists[1][2]).toBe(top.wrists[1][2]);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(87);
    }
    expect(bottom.head[1]).toBeLessThan(top.head[1] - 15);
    expect(bottom.head[1]).toBeGreaterThan(12);
    expect(bottom.head[2]).toBeGreaterThan(top.wrists[1][2]);
  });

  it("bench dip: hands on the bench edge, hips drop straight down, elbows about 90 degrees", () => {
    const top = pose("bench-dip", 0);
    const bottom = pose("bench-dip", 1);
    expect(model("bench-dip").furniture).toBe("flat-bench");
    for (const d of WALK) {
      const p = pose("bench-dip", d);
      expect(p.wrists[1][1]).toBeCloseTo(DIP_BENCH_Y + 1.5, 3);
      expect(p.wrists[1][2]).toBeLessThan(DIP_BENCH_EDGE);
      expect(p.wrists[1][2]).toBeGreaterThan(DIP_BENCH_EDGE - 12);
      expect(p.ankles[1][2]).toBe(top.ankles[1][2]);
      expect(p.ankles[1][1]).toBe(8);
      // Hips stay in front of the bench edge.
      expect(p.hips[1][2]).toBeGreaterThan(DIP_BENCH_EDGE + 2);
    }
    expect(bottom.hips[1][1]).toBeLessThan(top.hips[1][1] - 15);
    const u = [0, 1, 2].map((k) => bottom.shoulders[1][k]! - bottom.elbows[1][k]!);
    const f = [0, 1, 2].map((k) => bottom.wrists[1][k]! - bottom.elbows[1][k]!);
    const cosA = (u[0]! * f[0]! + u[1]! * f[1]! + u[2]! * f[2]!) / (29 * 26);
    expect((Math.acos(cosA) * 180) / Math.PI).toBeGreaterThan(80);
    expect((Math.acos(cosA) * 180) / Math.PI).toBeLessThan(100);
    // Elbows bend backwards, towards the bench.
    expect(bottom.elbows[1][2]).toBeLessThan(bottom.wrists[1][2] - 5);
    // The torso stays near-vertical so the back stays close to the bench.
    for (const p of [top, bottom]) {
      const lean = Math.abs(
        Math.atan2(p.hips[1][2] - p.shoulders[1][2], p.shoulders[1][1] - p.hips[1][1]),
      );
      expect(lean).toBeLessThan(0.35);
    }
  });

  it("bodyweight squat: parallel at the bottom, heels down, arms to shoulder height", () => {
    const top = pose("bodyweight-squat", 0);
    const bottom = pose("bodyweight-squat", 1);
    for (const d of WALK) {
      const p = pose("bodyweight-squat", d);
      expect(p.ankles[1][2]).toBe(0);
      expect(p.ankles[1][1]).toBe(8);
      expect(p.feet[1].pitch).toBeUndefined();
      expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] - 1);
    }
    expect(Math.abs(bottom.hips[1][1] - bottom.knees[1][1])).toBeLessThan(6);
    expect(bottom.hips[1][1]).toBeLessThan(top.hips[1][1] - 40);
    expect(Math.abs(bottom.wrists[1][1] - bottom.shoulders[1][1])).toBeLessThan(5);
    expect(bottom.wrists[1][2]).toBeGreaterThan(bottom.shoulders[1][2] + 45);
    expect(top.wrists[1][1]).toBeLessThan(top.shoulders[1][1] - 45);
    const lean = Math.atan2(
      bottom.shoulders[1][2] - bottom.hips[1][2],
      bottom.shoulders[1][1] - bottom.hips[1][1],
    );
    expect(lean).toBeLessThan(0.7);
  });

  it("split squat: neither foot moves, back heel up, thigh level and back knee hovering at the bottom", () => {
    const top = pose("split-squat", 0);
    const bottom = pose("split-squat", 1);
    for (const d of WALK) {
      const p = pose("split-squat", d);
      for (const i of [0, 1] as const) expect(p.ankles[i]).toEqual(top.ankles[i]);
      expect(p.feet[0].pitch).toBe(45);
      expect(p.ankles[0][2]).toBe(SPLIT_REAR_ANKLE[2]);
      expect(p.hips[1][2]).toBe(top.hips[1][2]);
      expect(p.knees[1][2]).toBeLessThan(p.ankles[1][2] + 15);
    }
    expect(Math.abs(bottom.hips[1][1] - bottom.knees[1][1])).toBeLessThan(4);
    expect(bottom.knees[0][1]).toBeGreaterThan(3);
    expect(bottom.knees[0][1]).toBeLessThan(16);
    expect(Math.abs(bottom.shoulders[1][2] - bottom.hips[1][2])).toBeLessThan(3);
    expect(Math.abs(bottom.knees[1][2] - bottom.ankles[1][2])).toBeLessThan(8);
  });
});

describe("W1 render", () => {
  it("renders each animation", () => {
    for (const id of IDS) {
      expect(
        renderToString(
          createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
        ),
      ).toContain("<svg");
    }
  });
});
