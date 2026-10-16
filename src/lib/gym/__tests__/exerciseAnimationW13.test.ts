import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import type { FigureModel, FigurePose, V3 } from "../exerciseAnimation";
import { ANIMATIONS_W13, TBAR_PLATFORM } from "../exerciseAnimationW13";
import { GymProvider } from "../store";

const IDS = [
  "plate-chest-press",
  "plate-incline-chest-press",
  "plate-shoulder-press",
  "plate-row",
  "plate-high-row",
  "machine-chest-press",
  "t-bar-row-machine",
  "machine-lateral-raise",
  "cable-chest-press",
];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W13[id]!.figure!;
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

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has labels, phases and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W13[id]!;
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
  it("keeps limb lengths constant, targets in reach and no jumps", () => {
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
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(7));
      prev = p;
    }
  });
  it("keeps feet flat and still", () => {
    const a = poseAt(id, 0);
    const floor = id === "t-bar-row-machine" ? TBAR_PLATFORM : 0;
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(p.feet[s].floor).toBe(floor);
        expect(p.feet[s].angle).toBeUndefined();
        expect(p.feet[s].pitch).toBeUndefined();
        expect(p.ankles[s][1]).toBe(floor + 8);
        expect(dist(p.ankles[s], a.ankles[s])).toBeLessThan(1e-9);
      }
    }
  });
  it("stays inside the frame in both views", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const j of joints(p))
        for (const [x, y] of [front(m, j), side(m, j)]) {
          expect(x).toBeGreaterThan(8);
          expect(x).toBeLessThan(312);
          expect(y).toBeGreaterThan(8);
          expect(y).toBeLessThan(198);
        }
      expect(side(m, p.head)[1] - 10.5 * m.scale).toBeGreaterThan(4);
    }
  });
  it("renders", () => {
    const html = renderToString(
      createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
    );
    expect(html).toContain("<svg");
  });
});

/** Distance along a monotone series check. */
function monotone(vals: number[], dir: 1 | -1) {
  for (let i = 1; i < vals.length; i++)
    expect(dir * (vals[i]! - vals[i - 1]!)).toBeGreaterThanOrEqual(-1e-9);
}

describe("seated chest presses", () => {
  for (const id of ["plate-chest-press", "machine-chest-press", "plate-incline-chest-press"]) {
    it(`${id}: back and hips fixed, hands travel monotonically and stop short of lockout`, () => {
      const a = poseAt(id, 0);
      const zs: number[] = [];
      for (const d of WALK) {
        const p = poseAt(id, d);
        expect(p.hips[1]).toEqual(a.hips[1]);
        expect(p.shoulders[1]).toEqual(a.shoulders[1]);
        zs.push(p.wrists[1][2]);
        expect(dist(p.shoulders[1], p.wrists[1])).toBeLessThan(54);
        expect(dist(p.wrists[1], p.head)).toBeGreaterThan(24);
      }
      monotone(zs, -1);
      expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(51);
      const b = poseAt(id, 1);
      expect(dist(b.shoulders[1], b.wrists[1])).toBeGreaterThan(24);
    });
  }
  it("flat press path is horizontal at mid-chest, incline path rises about 40 degrees", () => {
    const f0 = poseAt("plate-chest-press", 0).wrists[1];
    const f1 = poseAt("plate-chest-press", 1).wrists[1];
    expect(Math.abs(f0[1] - f1[1])).toBeLessThan(0.01);
    const sh = poseAt("plate-chest-press", 0).shoulders[1];
    expect(sh[1] - f1[1]).toBeGreaterThan(4);
    expect(sh[1] - f1[1]).toBeLessThan(16);
    const i0 = poseAt("plate-incline-chest-press", 0).wrists[1];
    const i1 = poseAt("plate-incline-chest-press", 1).wrists[1];
    const ang = (Math.atan2(i0[1] - i1[1], i0[2] - i1[2]) * 180) / Math.PI;
    expect(ang).toBeGreaterThan(36);
    expect(ang).toBeLessThan(44);
    // incline: torso reclined much more than the flat press
    const t = poseAt("plate-incline-chest-press", 0);
    const lean =
      (Math.atan2(t.hips[1][2] - t.shoulders[1][2], t.shoulders[1][1] - t.hips[1][1]) * 180) /
      Math.PI;
    expect(lean).toBeGreaterThan(30);
  });
  it("machine press and plate press share the pose, forearm near horizontal", () => {
    expect(poseAt("machine-chest-press", 0.4)).toEqual(poseAt("plate-chest-press", 0.4));
    const p = poseAt("plate-chest-press", 1);
    expect(Math.abs(p.wrists[1][1] - p.elbows[1][1])).toBeLessThan(12);
  });
});

describe("plate-loaded high row", () => {
  it("starts high in front of the head and ends at the lower ribs behind the shoulder line", () => {
    const a = poseAt("plate-high-row", 0);
    const b = poseAt("plate-high-row", 1);
    expect(a.wrists[1][1]).toBeGreaterThan(a.head[1] + 10);
    expect(a.wrists[1][2] - a.head[2]).toBeGreaterThan(25);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1] - 25);
    expect(b.wrists[1][1]).toBeGreaterThan(b.hips[1][1] + 8);
    expect(b.elbows[1][2]).toBeLessThan(b.shoulders[1][2] - 10);
    const ys: number[] = [];
    for (const d of WALK) {
      const p = poseAt("plate-high-row", d);
      ys.push(p.wrists[1][1]);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(20);
    }
    monotone(ys, -1);
  });
});

describe("chest-supported T-bar row machine", () => {
  it("holds the torso at 46 degrees, hands hang then row to the lower chest", () => {
    const a = poseAt("t-bar-row-machine", 0);
    const b = poseAt("t-bar-row-machine", 1);
    for (const d of WALK) {
      const p = poseAt("t-bar-row-machine", d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
    }
    const lean =
      (Math.atan2(a.shoulders[1][2] - a.hips[1][2], a.shoulders[1][1] - a.hips[1][1]) * 180) /
      Math.PI;
    expect(lean).toBeCloseTo(46, 3);
    expect(a.shoulders[1][1] - a.wrists[1][1]).toBeGreaterThan(50);
    expect(b.shoulders[1][1] - b.wrists[1][1]).toBeLessThan(32);
    expect(b.elbows[1][2]).toBeLessThan(b.shoulders[1][2] - 8);
  });
});

describe("machine lateral raise", () => {
  it("raises the elbows out to shoulder height and never above, forearms forward", () => {
    const ys: number[] = [];
    for (const d of WALK) {
      const p = poseAt("machine-lateral-raise", d);
      ys.push(p.elbows[1][1]);
      expect(p.elbows[1][1]).toBeLessThanOrEqual(p.shoulders[1][1] - 2);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(p.shoulders[1][1] + 1);
      expect(p.wrists[1][2] - p.elbows[1][2]).toBeGreaterThan(20);
      expect(p.elbows[0][0]).toBeCloseTo(-p.elbows[1][0], 6);
    }
    monotone(ys, 1);
    const top = poseAt("machine-lateral-raise", 1);
    expect(top.shoulders[1][1] - top.elbows[1][1]).toBeLessThan(8);
    expect(top.elbows[1][0]).toBeGreaterThan(top.shoulders[1][0] + 25);
  });
});

describe("standing cable chest press", () => {
  it("uses a split stance with both feet flat and hands meeting in front of the sternum", () => {
    const a = poseAt("cable-chest-press", 0);
    expect(Math.abs(a.ankles[0][2] - a.ankles[1][2])).toBeGreaterThan(30);
    expect(a.hips[1][2]).toBeGreaterThan(Math.min(a.ankles[0][2], a.ankles[1][2]));
    expect(a.hips[1][2]).toBeLessThan(Math.max(a.ankles[0][2], a.ankles[1][2]));
    expect(a.wrists[1][0]).toBeLessThan(6);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(51);
    expect(model("cable-chest-press").furniture).toBe("w4-cross-towers");
    // the high pulleys are behind the lifter
    expect(model("cable-chest-press").pulley!.z).toBeLessThan(a.hips[1][2] - 40);
    expect(model("cable-chest-press").pulley!.y).toBeGreaterThan(150);
    const zs: number[] = [];
    for (const d of WALK) zs.push(poseAt("cable-chest-press", d).wrists[1][2]);
    monotone(zs, -1);
  });
});
