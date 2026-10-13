import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { PULLUP_BAR_Y, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W5,
  LANDMINE_BAR,
  LANDMINE_HANDLE,
  LANDMINE_PIVOT_Y,
  LANDMINE_PIVOT_Z,
  LANDMINE_PLATES,
} from "../exerciseAnimationW5";
import { GymProvider } from "../store";

const IDS = [
  "chinup",
  "db-rear-delt-flye",
  "seated-rear-lateral-raise",
  "concentration-curl",
  "db-shrug",
  "landmine-t-bar-row",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W5[id]!.figure!;
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
    const spec = ANIMATIONS_W5[id]!;
    for (const lang of ["en", "nl"] as const) {
      expect(spec.cues[lang]).toHaveLength(4);
      expect(spec.labels![lang].front).toBeTruthy();
      for (const ph of ["lower", "touch", "press", "lockout"] as const)
        expect(spec.phases![lang][ph]).toBeTruthy();
    }
  });
  it("keeps limb lengths constant and smooth through the rep", () => {
    const first = poseAt(id, 0);
    let prev = first;
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
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(6));
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

describe("chin-up", () => {
  it("starts in a dead hang, ends with the chin over the bar, narrow grip", () => {
    const top = poseAt("chinup", 1);
    const hang = poseAt("chinup", 0);
    expect(dist(hang.shoulders[1], hang.wrists[1])).toBeGreaterThan(54);
    expect(top.head[1] + 5).toBeGreaterThan(PULLUP_BAR_Y);
    expect(top.head[1] - 10.5).toBeLessThan(PULLUP_BAR_Y);
    expect(Math.abs(hang.wrists[1][0])).toBeLessThan(23);
    expect(Math.abs(hang.wrists[1][0])).toBeGreaterThan(17);
  });
  it("brings the elbows down in front of the shoulders, not out to the sides", () => {
    for (const d of [0.5, 0.75, 1]) {
      const p = poseAt("chinup", d);
      expect(p.elbows[1][2]).toBeGreaterThan(p.shoulders[1][2]);
      expect(Math.abs(p.elbows[1][0])).toBeLessThan(26);
    }
  });
});

describe("bent-over reverse flye", () => {
  it("holds a hinge and keeps the elbow bend", () => {
    for (const d of WALK) {
      const p = poseAt("db-rear-delt-flye", d);
      const lean =
        (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) /
        Math.PI;
      expect(lean).toBeGreaterThan(45);
      expect(lean).toBeLessThan(65);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeLessThan(54.5);
    }
  });
  it("raises to shoulder height, in line with the shoulders, not behind", () => {
    const top = poseAt("db-rear-delt-flye", 1);
    const hang = poseAt("db-rear-delt-flye", 0);
    expect(hang.wrists[1][1]).toBeLessThan(top.shoulders[1][1] - 45);
    expect(top.shoulders[1][1] - top.wrists[1][1]).toBeLessThan(6);
    expect(top.wrists[1][1]).toBeLessThanOrEqual(top.shoulders[1][1]);
    expect(top.wrists[1][2]).toBeGreaterThanOrEqual(top.shoulders[1][2] - 1);
    expect(top.wrists[1][0]).toBeGreaterThan(60);
  });
});

describe("seated rear lateral raise", () => {
  it("keeps the torso folded and still, hips on the bench", () => {
    const a = poseAt("seated-rear-lateral-raise", 0);
    for (const d of WALK) {
      const p = poseAt("seated-rear-lateral-raise", d);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.head).toEqual(a.head);
      expect(p.shoulders[1][1] - p.hips[1][1]).toBeLessThan(25);
      // feet flat on the floor in front of the bench
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[1][1]).toBe(8);
    }
  });
  it("hangs beside the calves and ends level with the shoulders", () => {
    const hang = poseAt("seated-rear-lateral-raise", 0);
    const top = poseAt("seated-rear-lateral-raise", 1);
    expect(hang.wrists[1][1]).toBeLessThan(25);
    expect(top.shoulders[1][1] - top.wrists[1][1]).toBeLessThan(6);
    expect(top.wrists[1][1]).toBeLessThanOrEqual(top.shoulders[1][1]);
  });
});

describe("concentration curl", () => {
  it("is one-dumbbell and keeps the working elbow still on the inner thigh", () => {
    expect(model("concentration-curl").oneDumbbell).toBe(true);
    const e0 = poseAt("concentration-curl", 0).elbows[1];
    for (const d of WALK) {
      const p = poseAt("concentration-curl", d);
      expect(dist(p.elbows[1], e0)).toBeLessThan(1e-6);
      // elbow sits just above and inside the working thigh
      expect(p.elbows[1][0]).toBeLessThan(p.knees[1][0]);
      expect(Math.abs(p.elbows[1][1] - p.knees[1][1])).toBeLessThan(12);
      // the free hand stays on its knee
      expect(dist(p.wrists[0], p.knees[0])).toBeLessThan(12);
    }
  });
  it("curls from a straight arm up toward the shoulder", () => {
    const a = poseAt("concentration-curl", 0);
    const b = poseAt("concentration-curl", 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(dist(b.shoulders[1], b.wrists[1])).toBeLessThan(32);
    expect(b.wrists[1][1]).toBeGreaterThan(a.wrists[1][1] + 30);
  });
});

describe("dumbbell shrug", () => {
  it("raises the shoulders 6-8 cm with straight arms and a still head", () => {
    const a = poseAt("db-shrug", 0);
    const b = poseAt("db-shrug", 1);
    expect(model("db-shrug").neutralGrip).toBe(true);
    expect(b.shoulders[1][1] - a.shoulders[1][1]).toBeGreaterThanOrEqual(6);
    expect(b.shoulders[1][1] - a.shoulders[1][1]).toBeLessThanOrEqual(8);
    expect(b.head).toEqual(a.head);
    expect(b.hips[1]).toEqual(a.hips[1]);
    for (const d of WALK) {
      const p = poseAt("db-shrug", d);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(54.5);
      expect(p.wrists[1][2]).toBe(0);
    }
  });
});

describe("landmine T-bar row", () => {
  it("pivots the bar about the fixed floor anchor: the handle stays on one arc", () => {
    for (const d of WALK) {
      const p = poseAt("landmine-t-bar-row", d);
      const bar = p.bar;
      expect(Math.hypot(bar[1] - LANDMINE_PIVOT_Y, bar[2] - LANDMINE_PIVOT_Z)).toBeCloseTo(
        LANDMINE_HANDLE,
        3,
      );
      // plates are beyond the hands on the same line
      expect(LANDMINE_PLATES).toBeGreaterThan(LANDMINE_HANDLE);
      expect(LANDMINE_BAR).toBeGreaterThan(LANDMINE_PLATES);
    }
    expect(poseAt("landmine-t-bar-row", 1).bar[1]).toBeGreaterThan(
      poseAt("landmine-t-bar-row", 0).bar[1] + 15,
    );
  });
  it("keeps the hinge, plants the feet either side of the bar and keeps the anchor behind them", () => {
    const a = poseAt("landmine-t-bar-row", 0);
    for (const d of WALK) {
      const p = poseAt("landmine-t-bar-row", d);
      const lean =
        (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) /
        Math.PI;
      expect(lean).toBeGreaterThan(40);
      expect(lean).toBeLessThan(55);
      expect(p.shoulders[1]).toEqual(a.shoulders[1]);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(p.ankles[0][0]).toBeLessThan(-12);
      expect(p.ankles[1][0]).toBeGreaterThan(12);
      expect(LANDMINE_PIVOT_Z).toBeLessThan(p.ankles[1][2] - 60);
    }
  });
  it("starts with straight arms and rows the handle back toward the chest", () => {
    const a = poseAt("landmine-t-bar-row", 0);
    const b = poseAt("landmine-t-bar-row", 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(dist(b.shoulders[1], b.wrists[1])).toBeLessThan(40);
    expect(b.elbows[1][2]).toBeLessThan(b.shoulders[1][2]);
  });
  it("keeps the whole bar inside the frame", () => {
    const m = model("landmine-t-bar-row");
    for (const d of WALK) {
      const p = poseAt("landmine-t-bar-row", d);
      const ang = Math.atan2(p.bar[1] - LANDMINE_PIVOT_Y, p.bar[2] - LANDMINE_PIVOT_Z);
      for (const dd of [0, LANDMINE_BAR]) {
        const v: V3 = [
          0,
          LANDMINE_PIVOT_Y + dd * Math.sin(ang),
          LANDMINE_PIVOT_Z + dd * Math.cos(ang),
        ];
        const [x, y] = side(m, v);
        expect(x).toBeGreaterThan(6);
        expect(x).toBeLessThan(314);
        expect(y).toBeLessThan(200);
      }
      const plate = side(m, [
        0,
        LANDMINE_PIVOT_Y + LANDMINE_PLATES * Math.sin(ang),
        LANDMINE_PIVOT_Z + LANDMINE_PLATES * Math.cos(ang),
      ]);
      expect(plate[0] + 22.5 * m.scale).toBeLessThan(314);
      expect(plate[1] - 22.5 * m.scale).toBeGreaterThan(6);
    }
  });
});
