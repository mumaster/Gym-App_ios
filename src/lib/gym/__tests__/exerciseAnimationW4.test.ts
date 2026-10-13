import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { type FigurePose, type V3 } from "../exerciseAnimation";
import { ANIMATIONS_W4, CROSS_PULLEY, MROW_LEAN, ROW_PLATFORM_Y } from "../exerciseAnimationW4";
import { GymProvider } from "../store";

const IDS = [
  "seated-cable-row",
  "face-pull",
  "cable-crossover",
  "cable-lateral",
  "pec-deck",
  "machine-row",
];
const WALK = Array.from({ length: 21 }, (_, i) => i / 20);
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));
const pose = (id: string, d: number) => ANIMATIONS_W4[id]!.figure!.pose(d);

const joints = (p: FigurePose): V3[] => [
  ...p.shoulders,
  ...p.elbows,
  ...p.wrists,
  ...p.hips,
  ...p.knees,
  ...p.ankles,
  p.head,
  p.bar,
];

describe.each(IDS)("%s", (id) => {
  const m = ANIMATIONS_W4[id]!.figure!;
  it("has full copy", () => {
    const a = ANIMATIONS_W4[id]!;
    for (const l of ["en", "nl"] as const) {
      expect(a.cues[l]).toHaveLength(4);
      expect(Object.keys(a.phases![l]).sort()).toEqual(["lockout", "lower", "press", "touch"]);
      expect(a.labels![l].front).toBeTruthy();
    }
  });
  it("keeps limb lengths constant and targets within reach", () => {
    for (const d of WALK) {
      const p = m.pose(d);
      for (const i of [0, 1] as const) {
        expect(dist(p.shoulders[i], p.elbows[i])).toBeCloseTo(29, 3);
        expect(dist(p.elbows[i], p.wrists[i])).toBeCloseTo(26, 3);
        expect(dist(p.hips[i], p.knees[i])).toBeCloseTo(45, 3);
        expect(dist(p.knees[i], p.ankles[i])).toBeCloseTo(43, 3);
        expect(dist(p.shoulders[i], p.wrists[i])).toBeLessThanOrEqual(55);
        expect(dist(p.hips[i], p.ankles[i])).toBeLessThanOrEqual(88);
      }
    }
  });
  it("moves smoothly and stays inside the frame in both views", () => {
    let prev = m.pose(0);
    for (const d of WALK) {
      const p = m.pose(d);
      const a = joints(prev);
      joints(p).forEach((j, n) => expect(dist(j, a[n]!)).toBeLessThan(id === "pec-deck" ? 12 : 9));
      prev = p;
      for (const j of joints(p)) {
        const fx = 160 + j[0] * m.scale;
        const sx = 160 + (j[2] - m.centerZ) * m.scale;
        const y = 196 - j[1] * m.scale;
        expect(fx).toBeGreaterThan(6);
        expect(fx).toBeLessThan(314);
        expect(sx).toBeGreaterThan(6);
        expect(sx).toBeLessThan(314);
        expect(y).toBeGreaterThan(6);
        expect(y).toBeLessThan(200);
      }
      const head = 196 - (p.head[1] + 10.5) * m.scale;
      expect(head).toBeGreaterThan(6);
    }
  });
  it("renders", () => {
    const html = renderToString(
      createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
    );
    expect(html).toContain("<svg");
  });
});

describe("posture", () => {
  it("seated row: torso stays tall, arms straight at the start, handle ends at the belly behind the elbows' line", () => {
    for (const d of WALK) {
      const p = pose("seated-cable-row", d);
      const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
      expect(Math.abs((lean * 180) / Math.PI)).toBeLessThan(12);
      expect(p.feet[1].floor).toBe(ROW_PLATFORM_Y);
      expect(p.ankles[1][1]).toBe(ROW_PLATFORM_Y + 8);
    }
    const s = pose("seated-cable-row", 0);
    expect(dist(s.shoulders[1], s.wrists[1])).toBeGreaterThan(54);
    const e = pose("seated-cable-row", 1);
    expect(e.elbows[1][2]).toBeLessThan(e.shoulders[1][2] - 3);
    expect(e.wrists[1][2]).toBeLessThan(e.hips[1][2] + 20);
  });
  it("face pull: hands end beside the ears with the elbows about shoulder height", () => {
    const e = pose("face-pull", 1);
    expect(Math.abs(e.wrists[1][1] - e.head[1])).toBeLessThan(10);
    expect(e.wrists[1][0]).toBeGreaterThan(18);
    expect(Math.abs(e.elbows[1][1] - e.shoulders[1][1])).toBeLessThan(8);
    expect(e.elbows[1][0]).toBeGreaterThan(e.wrists[1][0] + 10);
    const s = pose("face-pull", 0);
    expect(s.wrists[1][2]).toBeGreaterThan(s.shoulders[1][2] + 40);
    expect(s.ankles[1][2]).toBe(s.hips[1][2]);
  });
  it("cable crossover: the elbow bend is fixed, hands go from wide to meeting below the chest", () => {
    const bends = WALK.map((d) => {
      const p = pose("cable-crossover", d);
      return dist(p.shoulders[1], p.wrists[1]);
    });
    expect(Math.max(...bends) - Math.min(...bends)).toBeLessThan(0.5);
    const a = pose("cable-crossover", 0);
    const b = pose("cable-crossover", 1);
    expect(a.wrists[1][0]).toBeGreaterThan(55);
    expect(Math.abs(b.wrists[1][0])).toBeLessThan(8);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1] - 25);
    expect(CROSS_PULLEY.y).toBeGreaterThan(a.shoulders[1][1] + 15);
  });
  it("cable lateral: the hand never goes above the shoulder and ends level with it", () => {
    for (const d of WALK) {
      const p = pose("cable-lateral", d);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(p.shoulders[1][1] + 1);
    }
    const e = pose("cable-lateral", 1);
    expect(e.wrists[1][1]).toBeGreaterThan(e.shoulders[1][1] - 10);
    expect(e.wrists[1][0]).toBeGreaterThan(60);
    const s = pose("cable-lateral", 0);
    expect(s.wrists[1][0]).toBeLessThan(10);
    expect(s.wrists[1][1]).toBeLessThan(s.shoulders[1][1] - 35);
  });
  it("pec deck: hands stay at shoulder height and sweep from behind the shoulder line to the midline", () => {
    for (const d of WALK) {
      const p = pose("pec-deck", d);
      expect(Math.abs(p.wrists[1][1] - p.shoulders[1][1])).toBeLessThan(3);
      expect(p.hips[1][2]).toBe(0);
    }
    const a = pose("pec-deck", 0);
    const b = pose("pec-deck", 1);
    expect(a.wrists[1][2]).toBeLessThan(a.shoulders[1][2] + 2);
    expect(a.wrists[1][0]).toBeGreaterThan(60);
    expect(Math.abs(b.wrists[1][0])).toBeLessThan(8);
    expect(b.wrists[1][2]).toBeGreaterThan(b.shoulders[1][2] + 35);
  });
  it("machine row: torso fixed against the pad, elbows end behind the torso", () => {
    for (const d of WALK) {
      const p = pose("machine-row", d);
      const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
      expect((lean * 180) / Math.PI).toBeCloseTo(MROW_LEAN, 3);
    }
    const s = pose("machine-row", 0);
    expect(dist(s.shoulders[1], s.wrists[1])).toBeGreaterThan(49);
    const e = pose("machine-row", 1);
    expect(e.elbows[1][2]).toBeLessThan(e.shoulders[1][2] - 8);
  });
});
