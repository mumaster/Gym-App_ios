import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import type { FigureModel, FigurePose, V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W8,
  HIFLY_TOWER,
  KICK_KICK,
  LOWFLY_PULLEY,
  LOWFLY_TOWER_X,
  SAP_PULLEY,
  SAP_REACH,
} from "../exerciseAnimationW8";
import { ROW_PLATFORM_Y } from "../exerciseAnimationW4";
import { GymProvider } from "../store";

const IDS = [
  "cable-straight-arm-pulldown",
  "single-arm-high-cable-fly",
  "low-to-high-cable-fly",
  "single-arm-cable-row",
  "cable-kickback",
  "reverse-pec-deck",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W8[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);
/** Torso lean (degrees from vertical, forward positive). */
const lean = (p: FigurePose) =>
  (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) / Math.PI;

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

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4 cues in both languages", () => {
    const spec = ANIMATIONS_W8[id]!;
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
        // targets in reach: nothing is silently stretched
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThanOrEqual(55);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThanOrEqual(88);
      }
      const a = joints(prev);
      const b = joints(p);
      // joints: shoulders, elbows, wrists, hips, knees, ankles (x2), head. The
      // hands sweep a long arc, so they may travel further per step than the rest.
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(i >= 2 && i < 6 ? 14 : 6));
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
    }
  });
  it("renders", () => {
    const html = renderToString(
      createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
    );
    expect(html).toContain("<svg");
  });
});

describe("straight-arm pulldown", () => {
  it("holds the hinge and the stance, arms stay almost straight", () => {
    const a = poseAt("cable-straight-arm-pulldown", 0);
    for (const d of WALK) {
      const p = poseAt("cable-straight-arm-pulldown", d);
      expect(lean(p)).toBeGreaterThan(15);
      expect(lean(p)).toBeLessThan(30);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.ankles).toEqual(a.ankles);
      for (const s of [0, 1] as const) {
        expect(dist(p.shoulders[s], p.wrists[s])).toBeCloseTo(SAP_REACH, 3);
      }
      // the hands travel on an arc about the shoulder, never behind it
      expect(p.wrists[1][2]).toBeGreaterThan(p.shoulders[1][2] - 1);
    }
  });
  it("starts with the bar out in front at head height, clear of the head, and ends at the thighs", () => {
    const top = poseAt("cable-straight-arm-pulldown", 0);
    const end = poseAt("cable-straight-arm-pulldown", 1);
    expect(Math.abs(top.wrists[1][1] - top.head[1])).toBeLessThan(15);
    expect(top.wrists[1][2] - top.head[2]).toBeGreaterThan(25);
    expect(Math.abs(end.wrists[1][1] - end.hips[1][1])).toBeLessThan(15);
    expect(end.wrists[1][1]).toBeLessThan(end.hips[1][1]);
    // the pulley stays above and in front of the hands the whole rep
    for (const d of WALK) {
      const p = poseAt("cable-straight-arm-pulldown", d);
      expect(SAP_PULLEY.y).toBeGreaterThan(p.wrists[1][1]);
      expect(SAP_PULLEY.z).toBeGreaterThan(p.wrists[1][2]);
    }
  });
});

describe("single-arm high cable fly", () => {
  it("keeps the torso and feet still, the free hand on its hip", () => {
    const a = poseAt("single-arm-high-cable-fly", 0);
    for (const d of WALK) {
      const p = poseAt("single-arm-high-cable-fly", d);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.hips).toEqual(a.hips);
      expect(p.ankles).toEqual(a.ankles);
      expect(p.wrists[0]).toEqual(a.wrists[0]);
      expect(Math.abs(p.wrists[0][1] - p.hips[0][1])).toBeLessThan(10);
    }
  });
  it("sweeps from out and up down and across to the opposite hip, one soft elbow bend", () => {
    const top = poseAt("single-arm-high-cable-fly", 0);
    const end = poseAt("single-arm-high-cable-fly", 1);
    expect(top.wrists[1][0]).toBeGreaterThan(55);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1]);
    expect(end.wrists[1][0]).toBeLessThan(0);
    expect(Math.abs(end.wrists[1][1] - end.hips[1][1])).toBeLessThan(15);
    for (const d of WALK) {
      const p = poseAt("single-arm-high-cable-fly", d);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeCloseTo(53, 2);
      // the cable always comes from above the hand
      expect(HIFLY_TOWER.y).toBeGreaterThan(p.wrists[1][1] + 5);
    }
  });
});

describe("low-to-high cable fly", () => {
  it("keeps one fixed soft elbow bend and a still stance", () => {
    const a = poseAt("low-to-high-cable-fly", 0);
    for (const d of WALK) {
      const p = poseAt("low-to-high-cable-fly", d);
      expect(p.hips).toEqual(a.hips);
      expect(p.ankles).toEqual(a.ankles);
      for (const s of [0, 1] as const) expect(dist(p.shoulders[s], p.wrists[s])).toBeCloseTo(52, 2);
    }
  });
  it("starts low and wide, ends with the hands together at chin height, clear of the face", () => {
    const a = poseAt("low-to-high-cable-fly", 0);
    const b = poseAt("low-to-high-cable-fly", 1);
    expect(a.wrists[1][1]).toBeLessThan(a.shoulders[1][1] - 25);
    expect(a.wrists[1][0]).toBeGreaterThan(45);
    expect(Math.abs(b.wrists[1][0])).toBeLessThan(10);
    expect(Math.abs(b.wrists[1][1] - (b.head[1] - 11))).toBeLessThan(10);
    for (const d of WALK) {
      const p = poseAt("low-to-high-cable-fly", d);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(24);
      // the low pulleys stay below the hands
      expect(LOWFLY_PULLEY.y).toBeLessThan(p.wrists[1][1] - 20);
    }
    expect(LOWFLY_TOWER_X).toBeGreaterThan(Math.abs(a.wrists[1][0]));
  });
});

describe("single-arm seated cable row", () => {
  it("sits tall on the seat with the feet flat on the platform", () => {
    const a = poseAt("single-arm-cable-row", 0);
    for (const d of WALK) {
      const p = poseAt("single-arm-cable-row", d);
      expect(p.hips).toEqual(a.hips);
      expect(lean(p)).toBeLessThan(8);
      expect(lean(p)).toBeGreaterThan(-3);
      expect(p.ankles).toEqual(a.ankles);
      expect(p.ankles[1][1]).toBe(ROW_PLATFORM_Y + 8);
      expect(p.feet[1]).toEqual({ floor: ROW_PLATFORM_Y, dir: 1 });
      expect(p.feet[0]).toEqual({ floor: ROW_PLATFORM_Y, dir: 1 });
    }
  });
  it("rows from a long reach to the hip with the elbow past the torso", () => {
    const a = poseAt("single-arm-cable-row", 0);
    const b = poseAt("single-arm-cable-row", 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(a.elbows[1][2]).toBeGreaterThan(a.shoulders[1][2]);
    expect(b.elbows[1][2]).toBeLessThan(b.shoulders[1][2] - 5);
    expect(Math.abs(b.wrists[1][1] - b.hips[1][1])).toBeLessThan(25);
    expect(b.wrists[1][2]).toBeLessThan(b.shoulders[1][2] + 8);
  });
  it("keeps the free hand resting on its thigh", () => {
    for (const d of WALK) {
      const p = poseAt("single-arm-cable-row", d);
      const mid: V3 = [
        (p.hips[0][0] + p.knees[0][0]) / 2,
        (p.hips[0][1] + p.knees[0][1]) / 2,
        (p.hips[0][2] + p.knees[0][2]) / 2,
      ];
      expect(dist(p.wrists[0], mid)).toBeLessThan(9);
    }
  });
});

describe("cable glute kickback", () => {
  it("holds the hinge: torso, hips, head, hands and the standing leg stay put", () => {
    const a = poseAt("cable-kickback", 0);
    for (const d of WALK) {
      const p = poseAt("cable-kickback", d);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.hips).toEqual(a.hips);
      expect(p.head).toEqual(a.head);
      expect(p.wrists).toEqual(a.wrists);
      expect(p.ankles[0]).toEqual(a.ankles[0]);
      expect(p.knees[0]).toEqual(a.knees[0]);
      expect(p.feet[0]).toEqual({ floor: 0, dir: 1 });
      expect(lean(p)).toBeGreaterThan(18);
      expect(lean(p)).toBeLessThan(30);
    }
  });
  it("starts with the working foot flat under the hip and kicks straight back and up", () => {
    const a = poseAt("cable-kickback", 0);
    const b = poseAt("cable-kickback", 1);
    expect(a.ankles[1][1]).toBeCloseTo(8, 6);
    expect(a.feet[1].angle).toBeCloseTo(0, 6);
    expect(Math.abs(a.ankles[1][2] - a.hips[1][2])).toBeLessThan(0.5);
    expect(b.ankles[1][2]).toBeLessThan(b.hips[1][2] - 45);
    expect(b.ankles[1][1]).toBeGreaterThan(20);
    // the leg is almost straight the whole way: hip-to-ankle stays near full length
    let prevZ = a.ankles[1][2];
    for (const d of WALK) {
      const p = poseAt("cable-kickback", d);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(84);
      expect(p.ankles[1][2]).toBeLessThanOrEqual(prevZ + 1e-9);
      prevZ = p.ankles[1][2];
      // the kick never swings past the chosen angle
      const swing =
        (Math.atan2(p.hips[1][2] - p.ankles[1][2], p.hips[1][1] - p.ankles[1][1]) * 180) / Math.PI;
      expect(swing).toBeLessThanOrEqual(KICK_KICK + 1);
    }
  });
  it("lets the working foot hang off the shin once it is in the air", () => {
    for (const d of WALK) {
      const p = poseAt("cable-kickback", d);
      const lift = p.ankles[1][1] - 8;
      const f = p.feet[1];
      expect(f.angle).toBeDefined();
      expect(f.angle!).toBeLessThanOrEqual(0);
      expect(f.floor).toBeCloseTo(Math.max(0, lift), 6);
      // a foot well off the floor tips toes down, never pointing up
      if (lift > 8) expect(f.angle!).toBeLessThan(-10);
      expect(f.drop!).toBeGreaterThanOrEqual(0);
      expect(f.drop!).toBeLessThanOrEqual(8);
    }
  });
});

describe("reverse pec deck", () => {
  it("keeps the chest on the pad: torso and hips fixed, head still", () => {
    const a = poseAt("reverse-pec-deck", 0);
    for (const d of WALK) {
      const p = poseAt("reverse-pec-deck", d);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.hips).toEqual(a.hips);
      expect(p.head).toEqual(a.head);
      expect(p.ankles).toEqual(a.ankles);
      expect(lean(p)).toBeLessThan(12);
      expect(lean(p)).toBeGreaterThan(4);
    }
  });
  it("keeps the arms at shoulder height with a soft bend, ending in line with the shoulders", () => {
    const a = poseAt("reverse-pec-deck", 0);
    const b = poseAt("reverse-pec-deck", 1);
    for (const d of WALK) {
      const p = poseAt("reverse-pec-deck", d);
      for (const s of [0, 1] as const) {
        expect(Math.abs(p.wrists[s][1] - p.shoulders[s][1])).toBeLessThan(2);
        expect(dist(p.shoulders[s], p.wrists[s])).toBeGreaterThan(50);
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThan(54.5);
        // the hands never travel far behind the shoulder line
        expect(p.wrists[s][2]).toBeGreaterThan(p.shoulders[s][2] - 8);
      }
      // the elbow leads: it never ends up in front of the hand and shoulder line
      expect(p.elbows[1][2]).toBeLessThanOrEqual(Math.max(p.shoulders[1][2], p.wrists[1][2]) + 1);
    }
    expect(a.wrists[1][2]).toBeGreaterThan(a.shoulders[1][2] + 45);
    expect(Math.abs(a.wrists[1][0])).toBeLessThan(20);
    expect(b.wrists[1][2]).toBeLessThan(b.shoulders[1][2] + 1);
    expect(b.wrists[1][0]).toBeGreaterThan(60);
  });
});
