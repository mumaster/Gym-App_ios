import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import { ANIMATIONS_W9, zottmanTurn } from "../exerciseAnimationW9";
import { GymProvider } from "../store";

const IDS = [
  "db-pullover",
  "incline-db-curl",
  "incline-db-row",
  "incline-db-flye",
  "db-kickback",
  "zottman-curl",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W9[id]!.figure!;
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
/** Angle (degrees) of the shoulder-to-hip line from vertical. */
const lean = (p: FigurePose) =>
  (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) / Math.PI;

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4 cues in both languages", () => {
    const spec = ANIMATIONS_W9[id]!;
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
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(9));
      prev = p;
    }
  });
  it("keeps the feet planted", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.ankles).toEqual(a.ankles);
      expect(p.feet).toEqual(a.feet);
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

describe("dumbbell pullover", () => {
  it("lies across the bench: shoulders and hips fixed, hips below the bench top, shins vertical", () => {
    const a = poseAt("db-pullover", 0);
    for (const d of WALK) {
      const p = poseAt("db-pullover", d);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.hips).toEqual(a.hips);
      expect(p.head).toEqual(a.head);
      expect(p.hips[1][1]).toBeLessThan(45);
      expect(p.shoulders[1][1]).toBeGreaterThan(50);
      expect(Math.abs(p.knees[1][2] - p.ankles[1][2])).toBeLessThan(3);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
    }
  });
  it("keeps one fixed soft elbow bend and the hands together", () => {
    for (const d of WALK) {
      const p = poseAt("db-pullover", d);
      const reach = dist(p.shoulders[1], p.wrists[1]);
      expect(reach).toBeGreaterThan(51);
      expect(reach).toBeLessThan(54.5);
      expect(Math.abs(p.wrists[1][0])).toBeCloseTo(5, 6);
    }
    const r0 = dist(poseAt("db-pullover", 0).shoulders[1], poseAt("db-pullover", 0).wrists[1]);
    const r1 = dist(poseAt("db-pullover", 1).shoulders[1], poseAt("db-pullover", 1).wrists[1]);
    expect(r1).toBeCloseTo(r0, 6);
  });
  it("starts over the chest and ends in a deep stretch behind the head", () => {
    const a = poseAt("db-pullover", 0);
    const b = poseAt("db-pullover", 1);
    expect(a.wrists[1][1]).toBeGreaterThan(a.shoulders[1][1] + 45);
    expect(Math.abs(a.wrists[1][2] - a.shoulders[1][2])).toBeLessThan(8);
    expect(b.wrists[1][2]).toBeLessThan(b.head[2] - 20);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1] + 1);
  });
  it("keeps the dumbbell clear of the head", () => {
    for (const d of WALK) {
      const p = poseAt("db-pullover", d);
      expect(dist(p.bar, p.head)).toBeGreaterThan(25);
    }
  });
});

describe("incline dumbbell curl", () => {
  it("pins the elbows (they never move) and hangs the arms straight at the start", () => {
    const a = poseAt("incline-db-curl", 0);
    for (const d of WALK) {
      const p = poseAt("incline-db-curl", d);
      for (const s of [0, 1] as const) expect(dist(p.elbows[s], a.elbows[s])).toBeLessThan(1e-6);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.hips).toEqual(a.hips);
    }
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54.4);
    // the hands hang behind the hips, in line under the shoulders
    expect(a.wrists[1][2]).toBeLessThan(a.hips[1][2] - 20);
    expect(a.elbows[1][1]).toBeLessThan(a.shoulders[1][1] - 25);
  });
  it("curls the dumbbells up toward the shoulders", () => {
    const a = poseAt("incline-db-curl", 0);
    const b = poseAt("incline-db-curl", 1);
    expect(dist(b.shoulders[1], b.wrists[1])).toBeLessThan(32);
    expect(b.wrists[1][1]).toBeGreaterThan(a.wrists[1][1] + 35);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1]);
  });
  it("keeps the back on the 45 degree pad and the hips on the seat", () => {
    const p = poseAt("incline-db-curl", 0.5);
    expect(lean(p)).toBeCloseTo(-45, 3);
    expect(p.hips[1][1]).toBeCloseTo(50, 6);
    expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
  });
});

describe("incline dumbbell row", () => {
  it("holds the torso on the pad and still, toes on the floor with the heel lifted", () => {
    const a = poseAt("incline-db-row", 0);
    for (const d of WALK) {
      const p = poseAt("incline-db-row", d);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.head).toEqual(a.head);
      expect(lean(p)).toBeCloseTo(-45, 3);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1, pitch: 65 });
      expect(p.ankles[1][1]).toBeGreaterThan(12);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(84);
    }
  });
  it("starts with straight arms and drives the elbows back past the torso", () => {
    const a = poseAt("incline-db-row", 0);
    const b = poseAt("incline-db-row", 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(b.elbows[1][2] - b.shoulders[1][2]).toBeGreaterThan(20);
    // the elbow ends above the torso line (shoulder to hip), not under it
    const ey = b.elbows[1][1] - b.shoulders[1][1];
    const ez = b.elbows[1][2] - b.shoulders[1][2];
    expect(ez).toBeGreaterThan(-ey);
  });
  it("keeps the forearms close to vertical and the dumbbells off the floor", () => {
    for (const d of WALK) {
      const p = poseAt("incline-db-row", d);
      expect(Math.abs(p.wrists[1][2] - p.elbows[1][2])).toBeLessThan(2);
      expect(p.wrists[1][1]).toBeGreaterThan(30);
      expect(p.wrists[1][1]).toBeLessThan(p.elbows[1][1]);
    }
  });
  it("is drawn with a seatless prone bench and palms facing", () => {
    expect(model("incline-db-row").furniture).toBe("w9-prone-bench");
    expect(model("incline-db-row").neutralGrip).toBe(true);
  });
});

describe("incline dumbbell flye", () => {
  it("keeps one fixed soft elbow bend through the whole arc", () => {
    for (const d of WALK) {
      const p = poseAt("incline-db-flye", d);
      for (const s of [0, 1] as const) {
        const reach = dist(p.shoulders[s], p.wrists[s]);
        expect(reach).toBeCloseTo(52.5, 3);
      }
      // symmetric arms
      expect(p.wrists[0][0]).toBeCloseTo(-p.wrists[1][0], 6);
    }
  });
  it("starts with the dumbbells together over the upper chest", () => {
    const a = poseAt("incline-db-flye", 0);
    expect(a.wrists[1][0]).toBeGreaterThan(5);
    expect(a.wrists[1][0]).toBeLessThan(14);
    expect(a.wrists[1][1]).toBeGreaterThan(a.shoulders[1][1] + 40);
    expect(a.wrists[1][2]).toBeGreaterThan(a.shoulders[1][2]);
  });
  it("opens wide to just below shoulder level and never drops below the bench", () => {
    const b = poseAt("incline-db-flye", 1);
    expect(b.wrists[1][0]).toBeGreaterThan(60);
    expect(b.wrists[1][1]).toBeLessThanOrEqual(b.shoulders[1][1]);
    expect(b.shoulders[1][1] - b.wrists[1][1]).toBeLessThan(15);
    for (const d of WALK) {
      const p = poseAt("incline-db-flye", d);
      expect(Math.abs(p.wrists[1][2] - p.shoulders[1][2])).toBeLessThan(10);
    }
  });
  it("lies on a 30 degree bench with the hips on the seat", () => {
    const p = poseAt("incline-db-flye", 0.5);
    expect(lean(p)).toBeCloseTo(-60, 3);
    expect(p.hips[1][1]).toBeCloseTo(50, 6);
  });
});

describe("dumbbell triceps kickback", () => {
  it("is one-dumbbell and holds a hinge with soft knees", () => {
    expect(model("db-kickback").oneDumbbell).toBe(true);
    for (const d of WALK) {
      const p = poseAt("db-kickback", d);
      expect(lean(p)).toBeGreaterThan(55);
      expect(lean(p)).toBeLessThan(70);
      expect(dist(p.hips[1], p.ankles[1])).toBeLessThan(86);
    }
  });
  it("pins the upper arm along the torso: the elbow never moves", () => {
    const a = poseAt("db-kickback", 0);
    for (const d of WALK) {
      const p = poseAt("db-kickback", d);
      expect(dist(p.elbows[1], a.elbows[1])).toBeLessThan(1e-6);
      // upper arm within 10 degrees of the torso direction
      const u = [p.elbows[1][1] - p.shoulders[1][1], p.elbows[1][2] - p.shoulders[1][2]];
      const t = [p.hips[1][1] - p.shoulders[1][1], p.hips[1][2] - p.shoulders[1][2]];
      const ang =
        (Math.acos((u[0]! * t[0]! + u[1]! * t[1]!) / (Math.hypot(...u) * Math.hypot(...t))) * 180) /
        Math.PI;
      expect(ang).toBeLessThan(10);
      expect(p.elbows[1][2]).toBeLessThan(p.shoulders[1][2]);
    }
  });
  it("starts with the elbow at about 90 degrees and locks out straight", () => {
    const bend = (p: FigurePose) => {
      const u: V3 = [
        p.shoulders[1][0] - p.elbows[1][0],
        p.shoulders[1][1] - p.elbows[1][1],
        p.shoulders[1][2] - p.elbows[1][2],
      ];
      const f: V3 = [
        p.wrists[1][0] - p.elbows[1][0],
        p.wrists[1][1] - p.elbows[1][1],
        p.wrists[1][2] - p.elbows[1][2],
      ];
      return (Math.acos((u[0] * f[0] + u[1] * f[1] + u[2] * f[2]) / (29 * 26)) * 180) / Math.PI;
    };
    expect(bend(poseAt("db-kickback", 0))).toBeGreaterThan(80);
    expect(bend(poseAt("db-kickback", 0))).toBeLessThan(100);
    expect(bend(poseAt("db-kickback", 1))).toBeGreaterThan(172);
    expect(
      dist(poseAt("db-kickback", 1).shoulders[1], poseAt("db-kickback", 1).wrists[1]),
    ).toBeGreaterThan(54.5);
    // forearm swings back: the wrist ends behind the hip line start
    expect(poseAt("db-kickback", 1).wrists[1][2]).toBeLessThan(
      poseAt("db-kickback", 0).wrists[1][2] - 25,
    );
  });
  it("rests the free hand on the front thigh", () => {
    for (const d of WALK) {
      const p = poseAt("db-kickback", d);
      const h = p.wrists[0];
      const a = p.hips[0];
      const k = p.knees[0];
      // distance from the hand to the thigh segment
      const ab = [k[0] - a[0], k[1] - a[1], k[2] - a[2]];
      const ah = [h[0] - a[0], h[1] - a[1], h[2] - a[2]];
      const t = Math.min(
        1,
        Math.max(0, (ah[0]! * ab[0]! + ah[1]! * ab[1]! + ah[2]! * ab[2]!) / 45 ** 2),
      );
      const c: V3 = [a[0] + ab[0]! * t, a[1] + ab[1]! * t, a[2] + ab[2]! * t];
      expect(dist(h, c)).toBeLessThan(8);
    }
  });
});

describe("Zottman curl", () => {
  it("turns the grip through neutral at the bottom and the top, not mid-curl", () => {
    expect(zottmanTurn(0)).toBe(1);
    expect(zottmanTurn(1)).toBe(1);
    expect(zottmanTurn(0.5)).toBe(0);
    expect(zottmanTurn(0.3)).toBe(0);
    expect(poseAt("zottman-curl", 1).bar[0]).toBe(1);
    expect(poseAt("zottman-curl", 0.5).bar[0]).toBe(0);
    for (const d of WALK) {
      const n = poseAt("zottman-curl", d).bar[0];
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
  it("curls with the elbows pinned at the sides", () => {
    const a = poseAt("zottman-curl", 0);
    for (const d of WALK) {
      const p = poseAt("zottman-curl", d);
      expect(Math.abs(p.elbows[1][2] - p.shoulders[1][2])).toBeLessThan(12);
      expect(Math.abs(p.elbows[1][1] - a.elbows[1][1])).toBeLessThan(4);
      expect(p.shoulders).toEqual(a.shoulders);
      expect(p.ankles[1][2]).toBe(p.hips[1][2]);
    }
    const b = poseAt("zottman-curl", 1);
    expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(54);
    expect(b.wrists[1][1]).toBeGreaterThan(b.shoulders[1][1] - 16);
  });
});
