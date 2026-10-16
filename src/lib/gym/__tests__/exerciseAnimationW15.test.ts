import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { EXTRAS_W15 } from "../../../components/gym/figureExtras/w15";
import {
  PLATE_RADIUS,
  PULLUP_BAR_Y,
  type FigureModel,
  type FigurePose,
  type V3,
} from "../exerciseAnimation";
import {
  ACM_ARM,
  ACM_HIP,
  ANIMATIONS_W15,
  BT_BAR_Y,
  BT_BOTTOM,
  BT_TOP,
  CC_PAD_Z,
  CC_SHOULDER_Y,
  DS_ANGLE,
  DS_ANKLE,
  DS_HIP,
  DS_PAD,
  DS_SHIN,
  DS_SURFACE_Y,
  RO_BAR_Y,
  RO_KNEE_Y,
  RO_MAT_TOP,
  ccArms,
  dsPoint,
} from "../exerciseAnimationW15";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import { GymProvider } from "../store";

const IDS = [
  "captains-chair-leg-raise",
  "captains-chair-knee-raise",
  "hanging-knee-raise",
  "ab-crunch-machine",
  "barbell-rollout",
  "decline-situp",
  "bar-triceps-extension",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Distance in the side view (y and z only). */
const sdist = (a: V3, b: V3) => Math.hypot(a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W15[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);
const deg = (r: number) => (r * 180) / Math.PI;
/** Torso lean from vertical (degrees), hip midpoint to shoulder midpoint, side view. */
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

/** Distance from point `p` to the segment `a`-`b` (side view, y and z only). */
function segDist(p: V3, a: V3, b: V3): number {
  const ay = a[1];
  const az = a[2];
  const dy = b[1] - ay;
  const dz = b[2] - az;
  const t = Math.max(0, Math.min(1, ((p[1] - ay) * dy + (p[2] - az) * dz) / (dy * dy + dz * dz)));
  return Math.hypot(p[1] - (ay + t * dy), p[2] - (az + t * dz));
}

/** Monotone (non-increasing or non-decreasing) series, allowing rounding noise. */
function expectMonotone(values: number[], dir: 1 | -1, eps = 1e-6) {
  for (let i = 1; i < values.length; i++)
    expect((values[i]! - values[i - 1]!) * dir).toBeGreaterThan(-eps);
}

/** Ankles do not move at all, feet keep their drawing mode. */
function expectFeetFixed(id: string) {
  const a = poseAt(id, 0);
  for (const d of WALK) {
    const p = poseAt(id, d);
    for (const s of [0, 1] as const) {
      expect(dist(p.ankles[s], a.ankles[s])).toBeLessThan(1e-9);
      expect(p.feet[s]).toEqual(a.feet[s]);
    }
  }
}

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W15[id]!;
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
  it("is registered and its furniture is drawn", () => {
    expect(EXERCISE_ANIMATIONS[id]).toBe(ANIMATIONS_W15[id]);
    for (const name of [m.furniture, m.implement]) {
      if (name.startsWith("w15-")) expect(EXTRAS_W15[name]).toBeDefined();
    }
  });
  it("keeps limb lengths constant and moves smoothly through the rep", () => {
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
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(11));
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
  it("keeps every joint above the floor and the head clear of the hands", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const j of joints(p)) expect(j[1]).toBeGreaterThan(3);
      for (const s of [0, 1] as const) expect(dist(p.wrists[s], p.head)).toBeGreaterThan(13);
    }
  });
  it("renders", () => {
    const html = renderToString(
      createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
    );
    expect(html).toContain("<svg");
  });
});

/** Foot hanging off the shin: toes stay clear of the floor and the foot angle follows the shin. */
function expectHangingFeet(id: string) {
  for (const d of WALK) {
    const p = poseAt(id, d);
    for (const s of [0, 1] as const) {
      const f = p.feet[s];
      expect(f.angle).toBeDefined();
      expect(f.pitch).toBeUndefined();
      expect(f.floor).toBeCloseTo(Math.max(0, p.ankles[s][1] - 2), 9);
      // the toe tip is 15 cm along the foot
      const toeY = p.ankles[s][1] + 15 * Math.sin((f.angle! * Math.PI) / 180);
      expect(toeY).toBeGreaterThan(4);
    }
  }
}

describe("captain's chair", () => {
  const arms = ccArms();
  for (const id of ["captains-chair-leg-raise", "captains-chair-knee-raise"]) {
    it(`${id}: forearms on the pads, elbows under the shoulders, back on the pad`, () => {
      const a = poseAt(id, 0);
      for (const d of WALK) {
        const p = poseAt(id, d);
        // shoulders, elbows and hands never move
        for (const s of [0, 1] as const) {
          expect(dist(p.shoulders[s], a.shoulders[s])).toBeLessThan(1e-9);
          expect(dist(p.elbows[s], a.elbows[s])).toBeLessThan(1e-9);
          expect(dist(p.wrists[s], a.wrists[s])).toBeLessThan(1e-9);
        }
        expect(p.shoulders[1][1]).toBe(CC_SHOULDER_Y);
        // upper arm about vertical, forearm about level, hands in front of the elbow
        const e = p.elbows[1];
        const sh = p.shoulders[1];
        const w = p.wrists[1];
        expect(Math.abs(e[2] - sh[2])).toBeLessThan(6);
        expect(sh[1] - e[1]).toBeGreaterThan(27);
        expect(Math.abs(w[1] - e[1])).toBeLessThan(6);
        expect(w[2] - e[2]).toBeGreaterThan(22);
        expect(w[2]).toBeCloseTo(arms.wrist.z, 6);
        // the back stays on the pad (its face is at CC_PAD_Z + 4); head and shoulder too
        expect(p.shoulders[1][2] - 10).toBeGreaterThanOrEqual(CC_PAD_Z + 4 - 1e-9);
        expect(p.head[2] - 10.5).toBeGreaterThanOrEqual(CC_PAD_Z + 4 - 1e-9);
      }
    });
    it(`${id}: the hips only curl forward a little, feet hang clear of the floor`, () => {
      expectHangingFeet(id);
      const hipZ = WALK.map((d) => poseAt(id, d).hips[1][2]);
      expectMonotone(hipZ, 1);
      expect(hipZ[0]).toBeCloseTo(0, 6);
      expect(hipZ[hipZ.length - 1]).toBeGreaterThan(4);
      expect(hipZ[hipZ.length - 1]).toBeLessThan(9);
      // legs hang with the toes off the floor at the start
      const p0 = poseAt(id, 0);
      expect(p0.ankles[1][1]).toBeGreaterThan(14);
    });
  }
  it("leg raise: straight legs rise to hip height", () => {
    const id = "captains-chair-leg-raise";
    const ankleY: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(dist(p.hips[s], p.ankles[s])).toBeGreaterThan(87.8);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThanOrEqual(88);
      }
      ankleY.push(p.ankles[1][1]);
    }
    expectMonotone(ankleY, 1);
    const top = poseAt(id, 1);
    // level with the hips (within 10 cm), legs well forward of the body
    expect(Math.abs(top.ankles[1][1] - top.hips[1][1])).toBeLessThan(10);
    expect(top.ankles[1][2] - top.hips[1][2]).toBeGreaterThan(80);
    // the arm rests are above the legs even at the top
    expect(top.hips[1][1]).toBeLessThan(ccArms().elbow.y - 12);
  });
  it("knee raise: the knees bend steadily and end up at the chest, shins near vertical", () => {
    const id = "captains-chair-knee-raise";
    const kneeY: number[] = [];
    const reach: number[] = [];
    const angle: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      kneeY.push(p.knees[1][1]);
      reach.push(dist(p.hips[1], p.ankles[1]));
      const t = [p.knees[1][1] - p.hips[1][1], p.knees[1][2] - p.hips[1][2]];
      const sh = [p.ankles[1][1] - p.knees[1][1], p.ankles[1][2] - p.knees[1][2]];
      const c = -(t[0]! * sh[0]! + t[1]! * sh[1]!) / (45 * 43);
      angle.push(deg(Math.acos(Math.max(-1, Math.min(1, c)))));
      // the knee never goes behind the hip
      expect(p.knees[1][2]).toBeGreaterThan(p.hips[1][2] - 1);
    }
    expectMonotone(kneeY, 1);
    expectMonotone(reach, -1);
    expectMonotone(angle, -1); // interior knee angle closes
    const top = poseAt(id, 1);
    expect(top.knees[1][1]).toBeGreaterThan(top.hips[1][1] + 20);
    expect(Math.abs(top.ankles[1][2] - top.knees[1][2])).toBeLessThan(10);
    expect(top.ankles[1][1]).toBeLessThan(top.knees[1][1] - 30);
  });
});

describe("hanging knee raise", () => {
  const id = "hanging-knee-raise";
  it("hangs on straight arms from the pull-up bar, shoulders fixed", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      for (const s of [0, 1] as const) {
        expect(p.wrists[s][1]).toBe(PULLUP_BAR_Y);
        expect(dist(p.shoulders[s], p.wrists[s])).toBeGreaterThan(54.5);
        expect(dist(p.shoulders[s], a.shoulders[s])).toBeLessThan(1e-9);
      }
    }
    expect(model(id).furniture).toBe("pullup-bar");
    expectHangingFeet(id);
  });
  it("brings the bent knees up to the chest while the pelvis curls", () => {
    const kneeY: number[] = [];
    const reach: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      kneeY.push(p.knees[1][1]);
      reach.push(dist(p.hips[1], p.ankles[1]));
    }
    expectMonotone(kneeY, 1);
    expectMonotone(reach, -1);
    const top = poseAt(id, 1);
    const start = poseAt(id, 0);
    expect(top.knees[1][1]).toBeGreaterThan(top.hips[1][1] + 25);
    expect(top.hips[1][2]).toBeGreaterThan(start.hips[1][2] + 8);
    expect(dist(start.hips[1], start.ankles[1])).toBeGreaterThan(86);
  });
});

describe("ab crunch machine", () => {
  const id = "ab-crunch-machine";
  it("keeps hips on the seat and feet flat, the torso curls and shortens", () => {
    expectFeetFixed(id);
    const leans: number[] = [];
    const torso: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[1][1]).toBe(8);
      expect(p.hips[1][1]).toBe(ACM_HIP.y);
      expect(p.hips[1][2]).toBe(ACM_HIP.z);
      leans.push(lean(p));
      torso.push(sdist(p.hips[1], p.shoulders[1]));
    }
    expectMonotone(leans, 1);
    expectMonotone(torso, -1);
    expect(leans[0]).toBeCloseTo(-10, 6);
    expect(leans[leans.length - 1]).toBeCloseTo(36, 6);
    expect(torso[0]).toBeCloseTo(50, 6);
    expect(torso[torso.length - 1]).toBeCloseTo(43, 6);
  });
  it("keeps the hands on the handles in front of the chest pad, clear of the face", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      const hip = p.hips[1];
      const wr = p.wrists[1];
      // hands beyond the pad (pad centre sits ACM_ARM from the hip joint)
      expect(dist(hip, wr)).toBeGreaterThan(ACM_ARM + 3);
      expect(dist(wr, p.head)).toBeGreaterThan(18);
      // both hands hold the same handle
      expect(p.wrists[0][1]).toBeCloseTo(wr[1], 9);
      expect(p.wrists[0][2]).toBeCloseTo(wr[2], 9);
    }
  });
  it("starts reclined 10 degrees against the back pad, with the back at the pad", () => {
    const p = poseAt(id, 0);
    expect(lean(p)).toBeCloseTo(-10, 6);
    expect(p.head[2]).toBeLessThan(p.hips[1][2]);
  });
});

describe("barbell rollout", () => {
  const id = "barbell-rollout";
  it("kneels on the mat with shins lying flat, knees never move", () => {
    expectFeetFixed(id);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.feet[1]).toEqual({ floor: RO_MAT_TOP, dir: -1 });
      expect(p.knees[1][1]).toBeCloseTo(RO_KNEE_Y, 0);
      expect(p.knees[1][2]).toBeCloseTo(0, 1);
      expect(p.ankles[1][2]).toBeLessThan(-40);
    }
  });
  it("rolls the plates on the floor on straight arms", () => {
    const barZ: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.bar[1]).toBe(RO_BAR_Y);
      expect(p.bar[1] - PLATE_RADIUS).toBeCloseTo(0, 9); // plates rest on the floor
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(54.4);
      expect(p.wrists[1][1]).toBe(RO_BAR_Y);
      barZ.push(p.bar[2]);
    }
    expectMonotone(barZ, 1);
    expect(barZ[barZ.length - 1]! - barZ[0]!).toBeGreaterThan(70);
  });
  it("stretches into one line from knees to shoulders without sagging", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      const k = p.knees[1];
      const s = p.shoulders[1];
      const h = p.hips[1];
      // the hip is on or above the knee-shoulder line (never sagging below it)
      const lineY = k[1] + ((h[2] - k[2]) / (s[2] - k[2])) * (s[1] - k[1]);
      expect(h[1]).toBeGreaterThanOrEqual(lineY - 0.5);
    }
    const end = poseAt(id, 1);
    const k = end.knees[1];
    const s = end.shoulders[1];
    const h = end.hips[1];
    expect(h[1] - (k[1] + ((h[2] - k[2]) / (s[2] - k[2])) * (s[1] - k[1]))).toBeLessThan(0.5);
    // torso almost level, and the hips folded at the start
    expect(s[1]).toBeLessThan(35);
    const start = poseAt(id, 0);
    expect(start.shoulders[1][1] - start.hips[1][1]).toBeGreaterThan(15);
  });
  it("keeps the head clear of the arms and the bar", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(segDist(p.head, p.shoulders[1], p.wrists[1])).toBeGreaterThan(14.5);
      expect(dist(p.head, p.bar)).toBeGreaterThan(PLATE_RADIUS + 10.5);
    }
  });
  it("uses a barbell with round plates", () => {
    expect(model(id).implement).toBe("barbell");
  });
});

describe("decline sit-up", () => {
  const id = "decline-situp";
  /** Height above the pad surface, perpendicular to it. */
  const outOfPad = (v: V3) =>
    (v[1] - (DS_SURFACE_Y + v[2] * Math.tan((DS_ANGLE * Math.PI) / 180))) *
    Math.cos((DS_ANGLE * Math.PI) / 180);
  it("keeps hips on the pad and ankles under the rollers, feet hanging off the shin", () => {
    expectFeetFixed(id);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(dist(p.hips[1], [10, DS_HIP.y, DS_HIP.z])).toBeLessThan(1e-9);
      expect(p.ankles[1][2]).toBeCloseTo(DS_ANKLE.z, 9);
      expect(p.feet[1].angle).toBeCloseTo(DS_SHIN + 90, 9);
      // the thigh lies along the pad (10 cm above it), the shin falls away below the knee
      expect(outOfPad(p.hips[1])).toBeCloseTo(10, 6);
      expect(outOfPad(p.knees[1])).toBeCloseTo(10, 0);
      expect(p.knees[1][1]).toBeGreaterThan(p.ankles[1][1] + 25);
      // the ankle hangs beyond the end of the pad, under the roller
      expect(p.ankles[1][2]).toBeGreaterThan(dsPoint(DS_PAD.to, 0).z + 10);
    }
  });
  it("curls from lying just above the pad up to sitting almost upright", () => {
    const angles: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      const tlen = sdist(p.hips[1], p.shoulders[1]);
      expect(tlen).toBeGreaterThan(45.9);
      expect(tlen).toBeLessThan(50.001);
      angles.push(lean(p));
      // never through the pad: shoulder and head stay above it
      expect(outOfPad(p.shoulders[1])).toBeGreaterThan(9.9);
      expect(outOfPad(p.head)).toBeGreaterThan(10);
    }
    // lean (from vertical, forward positive) runs from lying head-down through vertical
    const start = poseAt(id, 0);
    const end = poseAt(id, 1);
    expect(start.shoulders[1][2]).toBeLessThan(start.hips[1][2] - 40);
    expect(outOfPad(start.shoulders[1])).toBeLessThan(14);
    expect(Math.abs(lean(end))).toBeLessThan(5);
    expect(end.shoulders[1][1] - end.hips[1][1]).toBeGreaterThan(44);
    // the shoulder rises steadily
    expectMonotone(
      WALK.map((d) => poseAt(id, d).shoulders[1][1]),
      1,
    );
    // the torso does not hit the thighs: the chest stays clear of the knee
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(segDist(p.shoulders[1], p.hips[1], p.knees[1])).toBeGreaterThan(14);
    }
  });
  it("crosses the hands over the chest, clear of the face", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      const dd = dist(p.shoulders[1], p.wrists[1]);
      expect(dd).toBeGreaterThan(20);
      expect(dd).toBeLessThan(42);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(18);
      // the hands cross the midline
      expect(p.wrists[1][0]).toBeLessThan(0);
      expect(p.wrists[0][0]).toBeGreaterThan(0);
    }
  });
});

describe("bar triceps extension", () => {
  const id = "bar-triceps-extension";
  it("keeps the toes on the floor and the hands on the bar", () => {
    expectFeetFixed(id);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1, pitch: 65 });
      expect(p.ankles[1][1]).toBe(17);
      for (const s of [0, 1] as const) {
        expect(p.wrists[s][1]).toBe(BT_BAR_Y);
        expect(p.wrists[s][2]).toBe(0);
        expect(Math.abs(p.wrists[s][0])).toBe(19);
      }
      // waist height
      expect(BT_BAR_Y).toBeGreaterThan(95);
      expect(BT_BAR_Y).toBeLessThan(112);
    }
  });
  it("holds the body as one rigid line from the toes", () => {
    for (const d of WALK) {
      const p = poseAt(id, d);
      const a = p.ankles[1];
      const h = p.hips[1];
      const s = p.shoulders[1];
      // hip on the ankle-shoulder line
      const t = (h[2] - a[2]) / (s[2] - a[2]);
      expect(h[1]).toBeCloseTo(a[1] + t * (s[1] - a[1]), 4);
      expect(dist(p.hips[1], p.ankles[1])).toBeGreaterThan(87.8);
    }
    expect(BT_TOP).toBeGreaterThan(BT_BOTTOM + 10);
  });
  it("bends only the elbows: the arms close steadily from straight to a deep bend", () => {
    const reach: number[] = [];
    for (const d of WALK) {
      const p = poseAt(id, d);
      reach.push(dist(p.shoulders[1], p.wrists[1]));
      // the bar never touches the head (head 10.5, bar 2.5), and the elbow joint
      // never sits on the head
      expect(sdist(p.head, p.bar)).toBeGreaterThan(14);
      expect(sdist(p.head, p.elbows[1])).toBeGreaterThan(6);
      // from half way down the forearm stays clear above the head
      if (d >= 0.7) expect(segDist(p.head, p.elbows[1], p.wrists[1])).toBeGreaterThan(14.5);
    }
    expectMonotone(reach, -1, 0.3);
    expect(reach[0]).toBeGreaterThan(54.4);
    expect(reach[reach.length - 1]).toBeLessThan(40);
    const bottom = poseAt(id, 1);
    // elbows point up, well above the shoulder, and the head ends under the bar
    expect(bottom.elbows[1][1]).toBeGreaterThan(bottom.shoulders[1][1] + 20);
    expect(bottom.head[1]).toBeLessThan(BT_BAR_Y - 8);
    expect(Math.abs(bottom.head[2])).toBeLessThan(20);
    expect(bottom.shoulders[1][2]).toBeLessThan(-15);
  });
});
