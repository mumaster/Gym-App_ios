import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import type { FigureModel, FigurePose, V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W6,
  DECLINE_ANGLE,
  HACK_PLATFORM_Y,
  SMITH_FLAT_Z,
  SMITH_SQUAT_BAR_Z,
  arnoldProgress,
  arnoldTurn,
} from "../exerciseAnimationW6";
import { GymProvider } from "../store";

const IDS = [
  "smith-flat-press",
  "smith-squat",
  "decline-bench",
  "machine-shoulder-press",
  "hack-squat",
  "db-arnold-press",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W6[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);

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
const torsoLean = (p: FigurePose) =>
  (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) / Math.PI;

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4 cues in both languages", () => {
    const spec = ANIMATIONS_W6[id]!;
    for (const lang of ["en", "nl"] as const) {
      expect(spec.cues[lang]).toHaveLength(4);
      expect(spec.labels![lang].front).toBeTruthy();
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
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThanOrEqual(55);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThanOrEqual(88);
      }
      const a = joints(prev);
      const b = joints(p);
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(8));
      prev = p;
    }
  });
  it("stays inside the frame in both views", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const j of [...joints(p), p.bar]) {
        for (const [x, y] of [front(m, j), side(m, j)]) {
          expect(x).toBeGreaterThan(6);
          expect(x).toBeLessThan(314);
          expect(y).toBeGreaterThan(6);
          expect(y).toBeLessThan(200);
        }
      }
      for (const [x, y] of [front(m, p.head), side(m, p.head)]) {
        expect(x - 10.5 * m.scale).toBeGreaterThan(4);
        expect(x + 10.5 * m.scale).toBeLessThan(316);
        expect(y - 10.5 * m.scale).toBeGreaterThan(4);
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

describe("Smith machine flat press", () => {
  it("runs the bar exactly vertically over the mid chest, wrists over elbows at the bottom", () => {
    for (const d of WALK) {
      const p = poseAt("smith-flat-press", d);
      expect(p.bar[2]).toBeCloseTo(SMITH_FLAT_Z, 6);
      expect(p.wrists[1][2]).toBeCloseTo(SMITH_FLAT_Z, 6);
      // lying: head, shoulders and hips on the bench, feet flat
      expect(p.shoulders[1][1]).toBe(p.hips[1][1]);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[1][1]).toBe(8);
    }
    const b = poseAt("smith-flat-press", 1);
    expect(Math.abs(b.elbows[1][1] - (b.wrists[1][1] - 26))).toBeLessThan(0.1);
    expect(Math.abs(b.elbows[1][2] - b.wrists[1][2])).toBeLessThan(0.5);
    const top = poseAt("smith-flat-press", 0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54);
    expect(b.bar[1]).toBeGreaterThan(60);
    expect(b.bar[1]).toBeLessThan(70);
  });
});

describe("Smith machine squat", () => {
  it("keeps the bar on a vertical line behind the shoulders and the feet fixed and flat", () => {
    const a = poseAt("smith-squat", 0);
    let prevHip = a.hips[1][1] + 1;
    for (const d of WALK) {
      const p = poseAt("smith-squat", d);
      expect(p.bar[2]).toBe(SMITH_SQUAT_BAR_Z);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.hips[1][1]).toBeLessThan(prevHip);
      prevHip = p.hips[1][1];
      // heels down, knee not far past the toes
      expect(p.knees[1][2]).toBeLessThan(p.ankles[1][2] + 20);
      expect(torsoLean(p)).toBeLessThan(40);
    }
  });
  it("starts standing straight and ends just below parallel", () => {
    const a = poseAt("smith-squat", 0);
    expect(a.ankles[1][2]).toBeCloseTo(a.hips[1][2], 6);
    expect(a.ankles[1][2]).toBeCloseTo(a.shoulders[1][2], 6);
    const b = poseAt("smith-squat", 1);
    expect(b.hips[1][1]).toBeLessThan(b.knees[1][1]);
    expect(b.hips[1][1]).toBeGreaterThan(b.knees[1][1] - 14);
  });
});

describe("decline bench press", () => {
  it("lies head down on a decline with the torso on the bench line", () => {
    for (const d of WALK) {
      const p = poseAt("decline-bench", d);
      const dy = p.hips[1][1] - p.shoulders[1][1];
      const dz = p.hips[1][2] - p.shoulders[1][2];
      expect((Math.atan2(dy, dz) * 180) / Math.PI).toBeCloseTo(DECLINE_ANGLE, 3);
      expect(p.head[1]).toBeLessThan(p.shoulders[1][1]);
      expect(p.head[1] - 10.5).toBeGreaterThan(30);
    }
  });
  it("hooks the ankles under a roller: foot hangs off the shin and the ankle is fixed", () => {
    const a = poseAt("decline-bench", 0);
    for (const d of WALK) {
      const p = poseAt("decline-bench", d);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(p.feet[1].angle).toBeDefined();
      expect(p.feet[1].floor).toBeCloseTo(p.ankles[1][1] - 2, 6);
      expect(p.ankles[1][1]).toBeGreaterThan(40);
    }
  });
  it("lowers the bar to the lower chest with a near vertical forearm and clears the face", () => {
    const b = poseAt("decline-bench", 1);
    const t = poseAt("decline-bench", 0);
    expect(dist(t.shoulders[1], t.wrists[1])).toBeGreaterThan(54);
    expect(Math.abs(b.elbows[1][2] - b.wrists[1][2])).toBeLessThan(6);
    expect(b.wrists[1][2]).toBeGreaterThan(b.shoulders[1][2] + 12);
    for (const d of WALK) {
      const p = poseAt("decline-bench", d);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(30);
    }
  });
});

describe("machine shoulder press", () => {
  it("keeps the back on the pad and starts with vertical forearms at chin height", () => {
    const a = poseAt("machine-shoulder-press", 0);
    const b = poseAt("machine-shoulder-press", 1);
    for (const d of WALK) {
      const p = poseAt("machine-shoulder-press", d);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      // handles stay in front of the face while they pass it
      if (Math.abs(p.wrists[1][1] - p.head[1]) < 22)
        expect(p.wrists[1][2]).toBeGreaterThan(p.head[2] + 10.5 - 3);
    }
    expect(Math.abs(b.elbows[1][2] - b.wrists[1][2])).toBeLessThan(0.5);
    expect(Math.abs(b.wrists[1][1] - 26 - b.elbows[1][1])).toBeLessThan(0.5);
    expect(b.wrists[1][1]).toBeGreaterThan(b.shoulders[1][1] + 5);
    expect(b.wrists[1][1]).toBeLessThan(b.head[1] + 3);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(a.wrists[1][0]).toBeLessThan(b.wrists[1][0]);
  });
});

describe("machine hack squat", () => {
  it("keeps the feet fixed and flat on the platform and the knees from locking early", () => {
    const a = poseAt("hack-squat", 0);
    let prev = dist(a.hips[1], a.ankles[1]) + 1;
    for (const d of WALK) {
      const p = poseAt("hack-squat", d);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(p.feet[1]).toEqual({ floor: HACK_PLATFORM_Y, dir: 1 });
      expect(p.ankles[1][1]).toBe(HACK_PLATFORM_Y + 8);
      const r = dist(p.hips[1], p.ankles[1]);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
    expect(dist(a.hips[1], a.ankles[1])).toBeGreaterThan(86);
  });
  it("holds the torso on the inclined pad and ends with the thighs about level", () => {
    for (const d of WALK) {
      const p = poseAt("hack-squat", d);
      expect(torsoLean(p)).toBeCloseTo(-40, 3);
    }
    const b = poseAt("hack-squat", 1);
    expect(Math.abs(b.hips[1][1] - b.knees[1][1])).toBeLessThan(6);
    // knees travel forward but not far past the toes
    expect(b.knees[1][2]).toBeLessThan(b.ankles[1][2] + 20);
    expect(b.knees[1][2]).toBeGreaterThan(b.ankles[1][2] + 8);
  });
});

describe("dumbbell Arnold press", () => {
  it("starts in front of the chin and finishes straight overhead", () => {
    const b = poseAt("db-arnold-press", 1);
    const t = poseAt("db-arnold-press", 0);
    expect(b.wrists[1][1]).toBeGreaterThan(b.shoulders[1][1] + 5);
    expect(b.wrists[1][1]).toBeLessThan(b.head[1] + 3);
    expect(b.elbows[1][2]).toBeGreaterThan(b.shoulders[1][2] + 8);
    expect(dist(t.shoulders[1], t.wrists[1])).toBeGreaterThan(54);
    expect(t.wrists[1][1]).toBeGreaterThan(t.head[1] + 25);
  });
  it("clears the face all rep and rotates the palms from facing you to forward", () => {
    for (const d of WALK) {
      const p = poseAt("db-arnold-press", d);
      const nearFace = p.wrists[1][1] < p.head[1] + 22 && p.wrists[1][1] > p.head[1] - 22;
      if (nearFace) expect(p.wrists[1][2] - 11).toBeGreaterThan(p.head[2] + 10.5 - 2);
      expect(p.wrists[1][0]).toBeGreaterThan(12);
    }
    const y = (d: number) => poseAt("db-arnold-press", d).wrists[1][1];
    expect(arnoldTurn(arnoldProgress(y(1)))).toBeCloseTo(0, 3);
    expect(arnoldTurn(arnoldProgress(y(0)))).toBeCloseTo(180, 3);
    expect(arnoldTurn(arnoldProgress((y(0) + y(1)) / 2))).toBeCloseTo(90, 0);
  });
});
