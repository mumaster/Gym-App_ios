import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { PLATE_RADIUS, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import { ANIMATIONS_W16, CGB_GRIP, HM_PLATE } from "../exerciseAnimationW16";
import { GymProvider } from "../store";

const IDS = [
  "close-grip-lat-pulldown",
  "bb-shrug",
  "db-upright-row",
  "cable-upright-row",
  "close-grip-bench",
  "machine-abduction",
  "machine-adduction",
];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W16[id]!.figure!;
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
  it("has captions, labels and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W16[id]!;
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
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThanOrEqual(55);
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
      for (const j of joints(p))
        for (const [x, y] of [front(m, j), side(m, j)]) {
          expect(x).toBeGreaterThan(6);
          expect(x).toBeLessThan(314);
          expect(y).toBeGreaterThan(6);
          expect(y).toBeLessThan(200);
        }
      if (m.implement === "barbell") {
        const [x, y] = side(m, p.bar);
        expect(x - PLATE_RADIUS * m.scale).toBeGreaterThan(4);
        expect(x + PLATE_RADIUS * m.scale).toBeLessThan(316);
        expect(y - PLATE_RADIUS * m.scale).toBeGreaterThan(4);
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

const standing = (id: string) => {
  for (const d of WALK) {
    const p = poseAt(id, d);
    for (const s of [0, 1] as const) {
      expect(p.feet[s]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[s][1]).toBe(8);
      expect(p.ankles[s][2]).toBeCloseTo(p.hips[s][2], 9);
    }
  }
};

describe("close-grip lat pulldown", () => {
  const id = "close-grip-lat-pulldown";
  it("uses a narrow neutral grip, elbows come down and the handle reaches the upper chest", () => {
    let prevY = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(Math.abs(p.wrists[1][0])).toBeLessThan(10);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(prevY + 1e-9);
      prevY = p.wrists[1][1];
      // the handle stays clear of the face
      expect(p.wrists[1][2] - p.head[2]).toBeGreaterThan(14);
      expect(p.elbows[1][1]).toBeLessThan(p.shoulders[1][1] + 26);
    }
    const a = poseAt(id, 0);
    const b = poseAt(id, 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(51);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1]);
    expect(b.elbows[1][1]).toBeLessThan(b.shoulders[1][1] - 20);
    expect(b.feet[1]).toEqual({ floor: 0, dir: 1 });
  });
});

describe("barbell shrug", () => {
  const id = "bb-shrug";
  it("rises straight up about 8 cm with straight arms, head and hips still", () => {
    standing(id);
    const a = poseAt(id, 0);
    const b = poseAt(id, 1);
    expect(b.shoulders[1][1] - a.shoulders[1][1]).toBeCloseTo(8, 6);
    expect(b.shoulders[1][2]).toBe(a.shoulders[1][2]);
    expect(b.head).toEqual(a.head);
    expect(b.hips[1]).toEqual(a.hips[1]);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(54.5);
      expect(p.bar[2]).toBe(a.bar[2]);
      // bar in front of the thighs, not through them
      expect(p.bar[2]).toBeGreaterThan(p.knees[1][2] + 5);
    }
  });
});

describe.each(["db-upright-row", "cable-upright-row"])("%s", (id) => {
  it("pulls close to the body to chest height, elbows lead, never above the shoulders", () => {
    standing(id);
    let prevY = -Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.wrists[1][1]).toBeGreaterThanOrEqual(prevY - 1e-9);
      prevY = p.wrists[1][1];
      expect(p.elbows[1][1]).toBeLessThanOrEqual(p.shoulders[1][1] + 0.5);
      expect(p.wrists[1][1]).toBeLessThan(p.shoulders[1][1] - 10);
      if (d > 0.35) expect(p.elbows[1][1]).toBeGreaterThan(p.wrists[1][1] + 6);
      // never through the thighs or the chest
      expect(p.wrists[1][2]).toBeGreaterThan(8);
      expect(p.wrists[1][2]).toBeLessThan(22);
    }
    const top = poseAt(id, 1);
    expect(top.elbows[1][0]).toBeGreaterThan(top.shoulders[1][0] + 20);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1] - 20);
  });
});

describe("close-grip bench press", () => {
  const id = "close-grip-bench";
  it("grips just inside shoulder width, elbows tucked, bar to the lower chest", () => {
    let prevY = Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.wrists[1][0]).toBe(CGB_GRIP);
      expect(CGB_GRIP).toBeLessThan(19);
      expect(CGB_GRIP).toBeGreaterThan(12);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(prevY + 1e-9);
      prevY = p.wrists[1][1];
      // elbows stay near the torso line (tucked)
      expect(Math.abs(p.elbows[1][0] - p.shoulders[1][0])).toBeLessThan(8);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[1][1]).toBe(8);
    }
    const bot = poseAt(id, 1);
    expect(Math.abs(bot.wrists[1][2] - bot.elbows[1][2])).toBeLessThan(1);
    expect(bot.wrists[1][1] - bot.shoulders[1][1]).toBeCloseTo(12, 6);
    expect(bot.wrists[1][2] - bot.shoulders[1][2]).toBeGreaterThan(18);
    const top = poseAt(id, 0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54);
    expect(Math.abs(top.wrists[1][2] - top.shoulders[1][2])).toBeLessThan(6);
  });
});

describe.each(["machine-abduction", "machine-adduction"])("%s", (id) => {
  it("keeps hips, torso and feet-on-plates fixed while the knees swing symmetrically", () => {
    const a = poseAt(id, 0);
    const gaps: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.head).toEqual(a.head);
      expect(p.knees[0][0]).toBeCloseTo(-p.knees[1][0], 9);
      expect(p.knees[0][2]).toBeCloseTo(p.knees[1][2], 9);
      for (const s of [0, 1] as const) {
        expect(p.feet[s]).toEqual({ floor: HM_PLATE, dir: 1 });
        expect(p.ankles[s][1]).toBe(8 + HM_PLATE);
        // shin vertical: the foot sits right under the knee
        expect(p.ankles[s][0]).toBeCloseTo(p.knees[s][0], 9);
        // thigh about level
        expect(Math.abs(p.knees[s][1] - p.hips[s][1])).toBeLessThan(3);
      }
      gaps.push(p.knees[1][0] * 2);
    }
    // the knee gap changes in one direction only
    const sign = id === "machine-abduction" ? 1 : -1;
    for (let i = 1; i < gaps.length; i++)
      expect(sign * (gaps[i]! - gaps[i - 1]!)).toBeGreaterThan(0);
    const wide = Math.max(...gaps);
    const narrow = Math.min(...gaps);
    expect(wide).toBeGreaterThan(55);
    expect(narrow).toBeLessThan(30);
    // the side view hardly changes: the knee moves back by a few cm only
    const zs = WALK.map((d) => poseAt(id, d).knees[1][2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(8);
  });
  it("starts closed for abduction and wide for adduction", () => {
    const gap = (d: number) => poseAt(id, d).knees[1][0] * 2;
    if (id === "machine-abduction") expect(gap(0)).toBeLessThan(gap(1));
    else expect(gap(0)).toBeGreaterThan(gap(1));
  });
});
