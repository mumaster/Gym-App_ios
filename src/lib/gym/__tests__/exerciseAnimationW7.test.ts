import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { ROW_BENCH_Y, type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W7,
  ARCHER_HANDS,
  DECLINE_ANKLE_Z,
  DECLINE_BENCH_Y,
  FLAG_SHOULDER,
  SISSY_SUPPORT,
} from "../exerciseAnimationW7";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import { EXERCISE_LIBRARY } from "../exerciseLibrary";
import { EXERCISES } from "../data";
import { GymProvider } from "../store";

const IDS = [
  "dragon-flag",
  "bicycle-crunch",
  "decline-pushup",
  "archer-pushup",
  "superman",
  "sissy-squat",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const deg = (r: number) => (r * 180) / Math.PI;
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W7[id]!.figure!;
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

/** Distance from `p` to the line through `a` and `b`. */
function offLine(p: V3, a: V3, b: V3) {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (dist(ab, [0, 0, 0]) ** 2 || 1);
  return dist(ap, [ab[0] * t, ab[1] * t, ab[2] * t]);
}

/** Angle (degrees) at `b` between the segments to `a` and `c`. */
function angleAt(a: V3, b: V3, c: V3) {
  const u: V3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v: V3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (dist(u, [0, 0, 0]) * dist(v, [0, 0, 0]));
  return deg(Math.acos(Math.max(-1, Math.min(1, d))));
}

/** Pixel position of a point in the front or side view. */
const front = (m: FigureModel, v: V3): [number, number] => [
  160 + v[0] * m.scale,
  196 - v[1] * m.scale,
];
const side = (m: FigureModel, v: V3): [number, number] => [
  160 + (v[2] - m.centerZ) * m.scale,
  196 - v[1] * m.scale,
];

describe("W7 batch", () => {
  it("covers exactly its six catalog ids and is merged into EXERCISE_ANIMATIONS", () => {
    expect(Object.keys(ANIMATIONS_W7).sort()).toEqual([...IDS].sort());
    const catalog = new Set([...EXERCISES, ...EXERCISE_LIBRARY].map((e) => e.id));
    for (const id of IDS) {
      expect(catalog.has(id), id).toBe(true);
      expect(EXERCISE_ANIMATIONS[id]).toBe(ANIMATIONS_W7[id]);
    }
  });
});

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4 cues in both languages", () => {
    const spec = ANIMATIONS_W7[id]!;
    for (const lang of ["en", "nl"] as const) {
      expect(spec.cues[lang]).toHaveLength(4);
      expect(spec.labels![lang].front).toBeTruthy();
      expect(spec.labels![lang].side).toBeTruthy();
      for (const ph of ["lower", "touch", "press", "lockout"] as const)
        expect(spec.phases![lang][ph]).toBeTruthy();
    }
  });
  it("keeps limb lengths constant and moves smoothly through the rep", () => {
    let prev = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(dist(p.shoulders[s], p.elbows[s]), `${d}`).toBeCloseTo(29, 3);
        expect(dist(p.elbows[s], p.wrists[s]), `${d}`).toBeCloseTo(26, 3);
        expect(dist(p.hips[s], p.knees[s]), `${d}`).toBeCloseTo(45, 3);
        expect(dist(p.knees[s], p.ankles[s]), `${d}`).toBeCloseTo(43, 3);
        // targets in reach: nothing is silently stretched
        expect(dist(p.shoulders[s], p.wrists[s]), `${d}`).toBeLessThanOrEqual(55);
        expect(dist(p.hips[s], p.ankles[s]), `${d}`).toBeLessThanOrEqual(88);
      }
      const a = joints(prev);
      const b = joints(p);
      // per 1/20 of the rep: the dragon flag's 1.4 m lever swings its ankles furthest,
      // the sissy squat sweeps the whole body back and the bicycle crunch sends an
      // elbow across the chest
      const step = { "dragon-flag": 16, "sissy-squat": 8, "bicycle-crunch": 7 }[id] ?? 6;
      a.forEach((j, i) => expect(dist(j, b[i]!), `${d} joint ${i}`).toBeLessThan(step));
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
        expect(y + 10.5 * m.scale).toBeLessThan(198);
      }
      // feet: the sole stays above the floor and every foot sits inside the frame
      for (const s of [0, 1] as const) {
        const a = p.ankles[s];
        for (const [x, y] of [
          front(m, [a[0], a[1], a[2] + 15]),
          side(m, [a[0], a[1], a[2] + 15]),
        ]) {
          expect(x).toBeGreaterThan(6);
          expect(x).toBeLessThan(314);
          expect(y).toBeLessThan(200);
        }
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

describe("dragon flag", () => {
  it("keeps the shoulders on the bench and the head resting on it", () => {
    for (const d of WALK) {
      const p = poseAt("dragon-flag", d);
      for (const s of [0, 1] as const) {
        expect(p.shoulders[s][1]).toBe(FLAG_SHOULDER.y);
        expect(p.shoulders[s][2]).toBe(FLAG_SHOULDER.z);
      }
      // shoulder joint a body-thickness above the pad (bench top 45)
      expect(FLAG_SHOULDER.y - ROW_BENCH_Y).toBeGreaterThanOrEqual(9);
      expect(FLAG_SHOULDER.y - ROW_BENCH_Y).toBeLessThanOrEqual(11);
      expect(p.head[1] - 10.5).toBeCloseTo(ROW_BENCH_Y, 3);
      expect(p.head[2] - 10.5).toBeGreaterThan(-42);
      expect(p.head[2]).toBeLessThan(p.shoulders[1][2]);
    }
  });
  it("is one straight line from shoulder to ankle with straight legs", () => {
    for (const d of WALK) {
      const p = poseAt("dragon-flag", d);
      const hipC: V3 = [0, p.hips[1][1], p.hips[1][2]];
      const shC: V3 = [0, p.shoulders[1][1], p.shoulders[1][2]];
      const anC: V3 = [0, p.ankles[1][1], p.ankles[1][2]];
      expect(offLine(hipC, shC, anC), `hips on the line at ${d}`).toBeLessThan(0.05);
      for (const s of [0, 1] as const)
        expect(offLine(p.knees[s], p.hips[s], p.ankles[s]), `knee bulge at ${d}`).toBeLessThan(0.1);
    }
  });
  it("goes from vertical down to a low hover that stays clear of the bench", () => {
    const top = poseAt("dragon-flag", 0);
    const low = poseAt("dragon-flag", 1);
    expect(Math.abs(top.ankles[1][2] - top.shoulders[1][2])).toBeLessThan(0.5);
    expect(top.ankles[1][1]).toBeGreaterThan(185);
    expect(low.ankles[1][1]).toBeLessThan(top.ankles[1][1] - 90);
    for (const d of WALK) {
      const p = poseAt("dragon-flag", d);
      // the underside of the torso (20 cm thick) clears the pad away from the shoulders
      expect(p.hips[1][1] - 10).toBeGreaterThan(ROW_BENCH_Y + 4);
      // the body only ever rises monotonically towards vertical
      expect(p.ankles[1][1]).toBeGreaterThanOrEqual(low.ankles[1][1] - 1e-9);
      // feet hang off the shin, never a sole under a floating ankle
      expect(p.feet[1].angle).toBeDefined();
      expect(p.feet[1].pitch).toBeUndefined();
    }
  });
  it("grips the bench behind the head, wrists fixed", () => {
    const a = poseAt("dragon-flag", 0).wrists[1];
    for (const d of WALK) {
      const p = poseAt("dragon-flag", d);
      expect(dist(p.wrists[1], a)).toBeLessThan(1e-9);
      expect(p.wrists[1][2]).toBeLessThan(p.head[2]);
      expect(p.wrists[1][2]).toBeGreaterThan(-45);
      expect(Math.abs(p.wrists[1][1] - ROW_BENCH_Y)).toBeLessThan(8);
      expect(Math.abs(p.wrists[1][0])).toBeGreaterThan(14);
    }
  });
});

describe("bicycle crunch", () => {
  it("keeps the hips and lower back on the floor, shoulder blades lifted", () => {
    for (const d of WALK) {
      const p = poseAt("bicycle-crunch", d);
      for (const s of [0, 1] as const) {
        expect(p.hips[s][1]).toBe(10);
        expect(p.hips[s][2]).toBe(0);
      }
      const sh = Math.max(p.shoulders[0][1], p.shoulders[1][1]);
      expect(sh).toBeGreaterThan(22);
      expect(Math.min(p.shoulders[0][1], p.shoulders[1][1])).toBeGreaterThan(12);
      expect(p.head[1] - 10.5).toBeGreaterThan(8);
      expect(p.head[1]).toBeLessThan(45);
    }
  });
  it("ends with one knee in and the other leg straight and low, mirrored", () => {
    const a = poseAt("bicycle-crunch", 0);
    const b = poseAt("bicycle-crunch", 1);
    // near (right) knee in at the start, far (left) knee in at the end
    const bentA = 1;
    const straightA = 0;
    expect(angleAt(a.hips[bentA], a.knees[bentA], a.ankles[bentA])).toBeLessThan(95);
    expect(a.knees[bentA][1]).toBeGreaterThan(a.hips[bentA][1] + 35);
    expect(a.knees[bentA][2]).toBeLessThan(a.hips[bentA][2] + 5);
    expect(offLine(a.knees[straightA], a.hips[straightA], a.ankles[straightA])).toBeLessThan(0.5);
    expect(a.ankles[straightA][1]).toBeGreaterThan(25);
    expect(a.ankles[straightA][1]).toBeLessThan(50);
    expect(b.knees[0][1]).toBeCloseTo(a.knees[1][1], 3);
    expect(b.knees[0][2]).toBeCloseTo(a.knees[1][2], 3);
    expect(b.ankles[1][1]).toBeCloseTo(a.ankles[0][1], 3);
    // at the crossover both knees are half way
    const mid = poseAt("bicycle-crunch", 0.5);
    expect(mid.knees[0][1]).toBeCloseTo(mid.knees[1][1], 3);
  });
  it("takes the elbow of the lifted shoulder towards the opposite knee", () => {
    const a = poseAt("bicycle-crunch", 0); // right knee in, left shoulder up
    const b = poseAt("bicycle-crunch", 1); // left knee in, right shoulder up
    expect(a.shoulders[0][1]).toBeGreaterThan(a.shoulders[1][1] + 6);
    expect(b.shoulders[1][1]).toBeGreaterThan(b.shoulders[0][1] + 6);
    // the crossing elbow is nearer the bent knee than the other elbow is
    expect(dist(a.elbows[0], a.knees[1])).toBeLessThan(dist(a.elbows[1], a.knees[1]));
    expect(dist(b.elbows[1], b.knees[0])).toBeLessThan(dist(b.elbows[0], b.knees[0]));
    // and travels across the body's midline
    expect(a.elbows[0][0]).toBeGreaterThan(a.shoulders[0][0] + 6);
    expect(b.elbows[1][0]).toBeLessThan(b.shoulders[1][0] - 6);
  });
  it("keeps the hands behind the head and the feet hanging off the shins", () => {
    for (const d of WALK) {
      const p = poseAt("bicycle-crunch", d);
      for (const s of [0, 1] as const) {
        expect(Math.abs(p.wrists[s][2] - p.head[2])).toBeLessThan(8);
        expect(Math.abs(p.wrists[s][0])).toBeGreaterThan(10.5);
        const shin: V3 = [0, p.ankles[s][1] - p.knees[s][1], p.ankles[s][2] - p.knees[s][2]];
        const shinAngle = deg(Math.atan2(shin[1], shin[2]));
        expect(p.feet[s].angle).toBeCloseTo(shinAngle + 45, 2);
        expect(p.feet[s].pitch).toBeUndefined();
        expect(p.ankles[s][1]).toBeGreaterThan(20);
      }
    }
  });
});

describe("decline push-up", () => {
  it("stands on its toes on the bench, feet and hands fixed", () => {
    const a = poseAt("decline-pushup", 0);
    for (const d of WALK) {
      const p = poseAt("decline-pushup", d);
      for (const s of [0, 1] as const) {
        expect(p.feet[s].floor).toBe(DECLINE_BENCH_Y);
        expect(p.feet[s].pitch).toBeGreaterThan(40);
        expect(p.ankles[s]).toEqual(a.ankles[s]);
        expect(p.wrists[s]).toEqual(a.wrists[s]);
        expect(p.wrists[s][1]).toBeCloseTo(3.2, 3);
        expect(p.ankles[s][1] - DECLINE_BENCH_Y).toBeCloseTo(17, 3);
      }
      expect(p.ankles[1][2]).toBeCloseTo(DECLINE_ANKLE_Z, 6);
    }
    // wider than the shoulders
    expect(Math.abs(a.wrists[1][0])).toBeGreaterThan(21);
  });
  it("keeps the body one straight line, ending lower at the chest than the feet", () => {
    for (const d of WALK) {
      const p = poseAt("decline-pushup", d);
      expect(
        offLine(
          [0, p.hips[1][1], p.hips[1][2]],
          [0, p.shoulders[1][1], p.shoulders[1][2]],
          [0, p.ankles[1][1], p.ankles[1][2]],
        ),
      ).toBeLessThan(0.05);
      for (const s of [0, 1] as const)
        expect(offLine(p.knees[s], p.hips[s], p.ankles[s])).toBeLessThan(0.1);
    }
    const bottom = poseAt("decline-pushup", 1);
    const slope = deg(
      Math.atan2(
        bottom.ankles[1][1] - bottom.shoulders[1][1],
        bottom.shoulders[1][2] - bottom.ankles[1][2],
      ),
    );
    expect(slope).toBeGreaterThan(12);
    expect(bottom.shoulders[1][1]).toBeLessThan(25);
    // head clears the floor
    expect(bottom.head[1] - 10.5).toBeGreaterThan(1);
  });
  it("starts with straight arms under the shoulders and sends the elbows back", () => {
    const top = poseAt("decline-pushup", 0);
    const bottom = poseAt("decline-pushup", 1);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54.5);
    expect(Math.abs(top.shoulders[1][2] - top.wrists[1][2])).toBeLessThan(10);
    expect(bottom.elbows[1][2]).toBeLessThan(bottom.shoulders[1][2] - 8);
    expect(angleAt(bottom.shoulders[1], bottom.elbows[1], bottom.wrists[1])).toBeLessThan(75);
  });
  it("puts the bench under the toes and only its width shows in the side view", () => {
    const f = model("decline-pushup");
    expect(f.furniture).toBe("w7-decline-bench");
    expect(DECLINE_BENCH_Y).toBe(ROW_BENCH_Y);
  });
});

describe("archer push-up", () => {
  it("keeps one arm straight all rep and bends the other past 90 degrees", () => {
    for (const d of WALK) {
      const p = poseAt("archer-pushup", d);
      expect(dist(p.shoulders[0], p.wrists[0]), `straight arm at ${d}`).toBeGreaterThan(54.7);
      expect(offLine(p.elbows[0], p.shoulders[0], p.wrists[0])).toBeLessThan(2.5);
    }
    const top = poseAt("archer-pushup", 0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(54.7);
    const bottom = poseAt("archer-pushup", 1);
    expect(angleAt(bottom.shoulders[1], bottom.elbows[1], bottom.wrists[1])).toBeLessThan(75);
    expect(bottom.shoulders[1][1]).toBeLessThan(26);
    // the working elbow goes out and back, not under the chest
    expect(bottom.elbows[1][2]).toBeLessThan(bottom.shoulders[1][2] - 5);
  });
  it("starts wide and shifts the chest over the working hand", () => {
    const top = poseAt("archer-pushup", 0);
    const bottom = poseAt("archer-pushup", 1);
    expect(Math.abs(top.wrists[1][0])).toBe(ARCHER_HANDS);
    expect(Math.abs(top.wrists[1][0])).toBeGreaterThan(2 * 19 + 8);
    const centre = (p: FigurePose) => (p.shoulders[0][0] + p.shoulders[1][0]) / 2;
    expect(centre(bottom) - centre(top)).toBeGreaterThan(15);
    // the working shoulder ends close to the working hand, the other shoulder stays mid-body
    expect(Math.abs(bottom.shoulders[1][0] - bottom.wrists[1][0])).toBeLessThan(20);
    // the far shoulder stays higher (the straight arm props it up)
    expect(bottom.shoulders[0][1]).toBeGreaterThan(bottom.shoulders[1][1] + 4);
    // hands and feet never move
    for (const d of WALK) {
      const p = poseAt("archer-pushup", d);
      for (const s of [0, 1] as const) {
        expect(p.wrists[s]).toEqual(top.wrists[s]);
        expect(p.ankles[s]).toEqual(top.ankles[s]);
        expect(p.feet[s].pitch).toBeGreaterThan(40);
      }
    }
  });
  it("keeps the body one rigid line from the toes", () => {
    for (const d of WALK) {
      const p = poseAt("archer-pushup", d);
      const sc: V3 = [
        (p.shoulders[0][0] + p.shoulders[1][0]) / 2,
        (p.shoulders[0][1] + p.shoulders[1][1]) / 2,
        (p.shoulders[0][2] + p.shoulders[1][2]) / 2,
      ];
      const hc: V3 = [
        (p.hips[0][0] + p.hips[1][0]) / 2,
        (p.hips[0][1] + p.hips[1][1]) / 2,
        (p.hips[0][2] + p.hips[1][2]) / 2,
      ];
      const ac: V3 = [
        (p.ankles[0][0] + p.ankles[1][0]) / 2,
        (p.ankles[0][1] + p.ankles[1][1]) / 2,
        (p.ankles[0][2] + p.ankles[1][2]) / 2,
      ];
      expect(offLine(hc, sc, ac), `${d}`).toBeLessThan(0.1);
      for (const s of [0, 1] as const)
        expect(offLine(p.knees[s], p.hips[s], p.ankles[s])).toBeLessThan(0.5);
      // head clears the floor
      expect(p.head[1] - 10.5).toBeGreaterThan(1);
    }
  });
});

describe("superman", () => {
  it("keeps the hips on the floor and lifts chest, arms and legs together", () => {
    const a = poseAt("superman", 0);
    const b = poseAt("superman", 1);
    let prev = a;
    for (const d of WALK) {
      const p = poseAt("superman", d);
      expect(p.hips[1][1]).toBe(10);
      expect(p.hips[1][2]).toBe(0);
      expect(p.shoulders[1][1]).toBeGreaterThanOrEqual(prev.shoulders[1][1] - 1e-9);
      expect(p.wrists[1][1]).toBeGreaterThanOrEqual(prev.wrists[1][1] - 1e-9);
      expect(p.ankles[1][1]).toBeGreaterThanOrEqual(prev.ankles[1][1] - 1e-9);
      prev = p;
    }
    expect(b.shoulders[1][1] - a.shoulders[1][1]).toBeGreaterThan(10);
    expect(b.wrists[1][1] - a.wrists[1][1]).toBeGreaterThan(20);
    expect(b.ankles[1][1] - a.ankles[1][1]).toBeGreaterThan(15);
    // reach long rather than high: lifts stay modest
    expect(b.ankles[1][1]).toBeLessThan(35);
    expect(b.wrists[1][1]).toBeLessThan(50);
  });
  it("lies flat at the start: nothing floats, nothing sinks into the floor", () => {
    const a = poseAt("superman", 0);
    expect(a.ankles[1][1]).toBeLessThanOrEqual(8);
    expect(a.ankles[1][1]).toBeGreaterThanOrEqual(4);
    expect(a.wrists[1][1]).toBeGreaterThanOrEqual(2);
    expect(a.wrists[1][1]).toBeLessThanOrEqual(8);
    expect(a.head[1] - 10.5).toBeGreaterThanOrEqual(0);
    expect(a.shoulders[1][1] - 10).toBeGreaterThanOrEqual(0);
  });
  it("keeps arms and legs straight and the arms reaching beyond the head", () => {
    for (const d of WALK) {
      const p = poseAt("superman", d);
      for (const s of [0, 1] as const) {
        expect(offLine(p.knees[s], p.hips[s], p.ankles[s]), `knee at ${d}`).toBeLessThan(0.1);
        expect(offLine(p.elbows[s], p.shoulders[s], p.wrists[s]), `elbow at ${d}`).toBeLessThan(
          0.6,
        );
        expect(p.wrists[s][2]).toBeLessThan(p.head[2] - 10.5);
        // feet hang off the shin, toes pointing along the leg
        expect(p.feet[s].angle).toBeDefined();
        expect(p.feet[s].pitch).toBeUndefined();
      }
      // neutral neck: the head stays on the chest line, not craned up
      expect(p.head[1] - p.shoulders[1][1]).toBeLessThan(14);
    }
  });
});

describe("sissy squat", () => {
  it("starts tall and straight, ankle under the hip", () => {
    const a = poseAt("sissy-squat", 0);
    expect(Math.abs(a.ankles[1][2] - a.hips[1][2])).toBeLessThan(0.5);
    expect(Math.abs(a.shoulders[1][2] - a.hips[1][2])).toBeLessThan(2);
    expect(Math.abs(a.head[2] - a.shoulders[1][2])).toBeLessThan(2);
    expect(a.feet[1]).toEqual({ floor: 0, dir: 1, pitch: 0 });
    expect(a.hips[1][1] - a.ankles[1][1]).toBeGreaterThan(87.5);
  });
  it("keeps the toes still while the heels rise and the knees go forward", () => {
    const bottom = poseAt("sissy-squat", 1);
    for (const d of WALK) {
      const p = poseAt("sissy-squat", d);
      const pitch = p.feet[1].pitch!;
      expect(p.ankles[1][2] + 15 * Math.cos((pitch * Math.PI) / 180)).toBeCloseTo(15, 3);
      expect(p.feet[1].floor).toBe(0);
    }
    expect(bottom.feet[1].pitch).toBeGreaterThan(35);
    // knee ends well beyond the toes and low
    expect(bottom.knees[1][2]).toBeGreaterThan(bottom.ankles[1][2] + 15 + 12);
    expect(bottom.knees[1][1]).toBeLessThan(50);
    // the whole squat is a downward trip for the hips once up on the toes
    let prev = poseAt("sissy-squat", 0.3);
    for (const d of WALK.filter((v) => v > 0.3)) {
      const p = poseAt("sissy-squat", d);
      expect(p.hips[1][1]).toBeLessThanOrEqual(prev.hips[1][1] + 1e-9);
      expect(p.knees[1][2]).toBeGreaterThanOrEqual(prev.knees[1][2] - 1e-9);
      prev = p;
    }
  });
  it("keeps the hips open: thigh and torso stay in one line that leans back", () => {
    for (const d of WALK) {
      const p = poseAt("sissy-squat", d);
      const flat = (v: V3): V3 => [0, v[1], v[2]];
      const hipAngle = angleAt(flat(p.knees[1]), flat(p.hips[1]), flat(p.shoulders[1]));
      expect(hipAngle, `hip angle at ${d}`).toBeGreaterThan(172);
    }
    const bottom = poseAt("sissy-squat", 1);
    const lean = deg(
      Math.atan2(
        bottom.hips[1][2] - bottom.shoulders[1][2],
        bottom.shoulders[1][1] - bottom.hips[1][1],
      ),
    );
    expect(lean).toBeGreaterThan(40);
    expect(lean).toBeLessThan(60);
    // the head follows the line
    expect(bottom.head[2]).toBeLessThan(bottom.shoulders[1][2]);
  });
  it("holds the support with the near hand all rep and never stretches the arm", () => {
    const a = poseAt("sissy-squat", 0).wrists[1];
    expect(a).toEqual([SISSY_SUPPORT.x, SISSY_SUPPORT.y, SISSY_SUPPORT.z]);
    for (const d of WALK) {
      const p = poseAt("sissy-squat", d);
      expect(p.wrists[1]).toEqual(a);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeLessThan(54.5);
      // the free hand stays on its hip
      expect(Math.abs(p.wrists[0][1] - p.hips[0][1])).toBeLessThan(12);
    }
    expect(model("sissy-squat").furniture).toBe("w7-support");
  });
});
