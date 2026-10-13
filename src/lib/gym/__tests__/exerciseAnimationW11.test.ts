import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { PLATE_RADIUS, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W11,
  SAL_BACK_ANKLE_Z,
  SRDL_ANKLE_Z,
  SRDL_BAR_Z,
  SSP_BAR_Z,
} from "../exerciseAnimationW11";
import { GymProvider } from "../store";

const IDS = ["cable-rear-delt-fly", "smith-shoulder-press", "single-arm-lat-pulldown", "smith-rdl"];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W11[id]!.figure!;
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
    const spec = ANIMATIONS_W11[id]!;
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
      a.forEach((j, i) =>
        expect(dist(j, b[i]!)).toBeLessThan(
          id === "single-arm-lat-pulldown" || id === "cable-rear-delt-fly" ? 9 : 6,
        ),
      );
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

describe("single-arm cable rear delt fly", () => {
  it("keeps feet, torso and the soft elbow fixed, the free hand on the hip", () => {
    expectPlanted("cable-rear-delt-fly");
    const a = poseAt("cable-rear-delt-fly", 0);
    for (const d of WALK) {
      const p = poseAt("cable-rear-delt-fly", d);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeCloseTo(53, 3);
      expect(p.wrists[0]).toEqual(a.wrists[0]);
      expect(p.wrists[0][1]).toBeLessThan(p.hips[0][1] + 8);
    }
  });
  it("starts across the body and ends out at shoulder height in line with the body", () => {
    const s = poseAt("cable-rear-delt-fly", 0);
    const e = poseAt("cable-rear-delt-fly", 1);
    expect(s.wrists[1][0]).toBeLessThan(5);
    expect(s.wrists[1][2]).toBeGreaterThan(s.shoulders[1][2] + 30);
    expect(Math.abs(e.wrists[1][1] - e.shoulders[1][1])).toBeLessThan(4);
    expect(e.wrists[1][0]).toBeGreaterThan(65);
    expect(Math.abs(e.wrists[1][2] - e.shoulders[1][2])).toBeLessThan(8);
    for (const d of WALK) {
      const p = poseAt("cable-rear-delt-fly", d);
      expect(p.wrists[1][1]).toBeLessThanOrEqual(p.shoulders[1][1] + 4);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(30);
    }
  });
});

describe("Smith machine shoulder press", () => {
  const id = "smith-shoulder-press";
  it("moves the bar exactly vertically, in front of the face", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[2]).toBeCloseTo(SSP_BAR_Z, 9);
      expect(p.bar[0]).toBe(0);
      expect(p.wrists[1][2]).toBeCloseTo(SSP_BAR_Z, 9);
      expect(p.wrists[1][0]).toBeCloseTo(38, 9);
      // the bar and its small plate (10 cm) never touch the head circle (10.5 cm)
      expect(Math.hypot(p.bar[1] - p.head[1], p.bar[2] - p.head[2])).toBeGreaterThan(21);
      expect(p.wrists[1][2] - p.head[2]).toBeGreaterThan(14);
    }
  });
  it("sits upright on the seat, feet flat, bar from chin height to lockout", () => {
    expectPlanted(id);
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(top.hips[1][1]).toBe(53);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(53);
    expect(bot.wrists[1][1] - bot.shoulders[1][1]).toBeGreaterThan(5);
    expect(bot.wrists[1][1] - bot.shoulders[1][1]).toBeLessThan(14);
    // forearm near vertical at the bottom
    const dz = Math.abs(bot.wrists[1][2] - bot.elbows[1][2]);
    expect(dz).toBeLessThan(10);
    let prev = Infinity;
    for (const d of WALK) {
      const y = poseAt(id, d).bar[1];
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      prev = y;
    }
  });
});

describe("single-arm lat pulldown", () => {
  const id = "single-arm-lat-pulldown";
  it("has the near knee and shin on the floor and the far foot flat in front", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      // near leg: knee under the hip, resting on the floor, shin lying back
      expect(p.knees[1][1]).toBeLessThan(8);
      expect(p.knees[1][1]).toBeGreaterThan(4);
      expect(p.ankles[1][2]).toBeCloseTo(SAL_BACK_ANKLE_Z, 6);
      expect(p.ankles[1][1]).toBe(8);
      expect(p.feet[1]).toEqual({ floor: 0, dir: -1 });
      // far leg: flat foot ahead of the knee-down hip, shin about vertical
      expect(p.feet[0]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[0][1]).toBe(8);
      expect(p.ankles[0][2]).toBeGreaterThan(p.hips[0][2] + 30);
      expect(Math.abs(p.knees[0][2] - p.ankles[0][2])).toBeLessThan(12);
    }
  });
  it("reaches up into a stretch, then pulls the elbow down and back past the torso", () => {
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(52);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1] + 40);
    expect(top.wrists[1][2] - top.head[2]).toBeGreaterThan(14);
    expect(bot.wrists[1][1]).toBeLessThan(bot.shoulders[1][1]);
    expect(bot.elbows[1][1]).toBeLessThan(bot.wrists[1][1] - 6);
    expect(bot.elbows[1][2]).toBeLessThan(bot.wrists[1][2] - 5);
    expect(bot.elbows[1][1]).toBeGreaterThan(bot.hips[1][1]);
    // the free hand stays on the front thigh
    expect(top.wrists[0]).toEqual(bot.wrists[0]);
  });
});

describe("Smith machine Romanian deadlift", () => {
  const id = "smith-rdl";
  it("keeps the bar vertical over the mid-foot and clear of the legs", () => {
    expectPlanted(id);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[2]).toBeCloseTo(SRDL_BAR_Z, 9);
      // mid-foot is about 4 cm ahead of the ankle
      expect(Math.abs(p.bar[2] - (SRDL_ANKLE_Z + 4))).toBeLessThanOrEqual(4);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(53);
      expect(p.hips[1][1]).toBeGreaterThan(p.knees[1][1]);
      expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] - 3);
      // where the bar passes the knees it stays in front of them
      if (Math.abs(p.bar[1] - p.knees[1][1]) < 14)
        expect(p.bar[2]).toBeGreaterThan(p.knees[1][2] + 3);
    }
  });
  it("hinges smoothly: hips back, soft knees, flat back, bar to about mid-shin", () => {
    let prevHipZ = Infinity;
    let prevBar = Infinity;
    let prevLean = -Infinity;
    for (const d of WALK) {
      const p = poseAt(id, d);
      const reach = dist(p.hips[1], p.ankles[1]);
      expect(reach).toBeLessThan(87.5);
      expect(reach).toBeGreaterThan(78);
      expect(p.hips[1][2]).toBeLessThanOrEqual(prevHipZ + 1e-9);
      expect(p.bar[1]).toBeLessThanOrEqual(prevBar + 1e-9);
      expect(lean(p)).toBeGreaterThanOrEqual(prevLean - 1e-9);
      prevHipZ = p.hips[1][2];
      prevBar = p.bar[1];
      prevLean = lean(p);
    }
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(lean(top)).toBeLessThan(2);
    expect(lean(bot)).toBeGreaterThan(62);
    expect(lean(bot)).toBeLessThan(80);
    expect(top.bar[1]).toBeGreaterThan(80);
    expect(bot.bar[1]).toBeLessThan(47);
    expect(bot.bar[1]).toBeGreaterThan(25);
    expect(top.hips[1][2] - bot.hips[1][2]).toBeGreaterThan(26);
  });
});
