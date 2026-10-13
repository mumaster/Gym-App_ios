import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import type { FigurePose, V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W2,
  BACK_EXT_HIP,
  NORDIC_KNEE_Y,
  NORDIC_PAD_TOP,
  backExtensionPose,
  crunchPose,
  lyingLegRaisePose,
  nordicCurlPose,
  reverseCrunchPose,
  russianTwistPose,
} from "../exerciseAnimationW2";
import { EXERCISES } from "../data";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import { GymProvider } from "../store";

const POSES: Record<string, (d: number) => FigurePose> = {
  crunch: crunchPose,
  "reverse-crunch": reverseCrunchPose,
  "lying-leg-raise": lyingLegRaisePose,
  "russian-twist": russianTwistPose,
  "nordic-curl": nordicCurlPose,
  "back-extension": backExtensionPose,
};
const IDS = Object.keys(POSES);
const WALK = Array.from({ length: 21 }, (_, i) => i / 20);
const JOINTS = ["shoulders", "elbows", "wrists", "hips", "knees", "ankles"] as const;
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));
const deg = (r: number) => (r * 180) / Math.PI;

/** Distance from point `p` to the line through `a` and `b`. */
function offLine(p: V3, a: V3, b: V3) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = (ab[0]! * ap[0]! + ab[1]! * ap[1]! + ab[2]! * ap[2]!) / (dist(ab, [0, 0, 0]) ** 2 || 1);
  return dist(
    ap,
    ab.map((v) => v * t),
  );
}

describe("W2 animations: every rep", () => {
  it("covers exactly the six catalog ids with complete captions and cues", () => {
    expect(Object.keys(ANIMATIONS_W2).sort()).toEqual([...IDS].sort());
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const id of IDS) {
      const spec = ANIMATIONS_W2[id]!;
      expect(ids.has(id), id).toBe(true);
      expect(spec.cues.en.length).toBe(4);
      expect(spec.cues.nl.length).toBe(4);
      expect(Object.keys(spec.phases!.nl)).toEqual(["lower", "touch", "press", "lockout"]);
      expect(spec.labels!.nl.side).not.toBe("");
      expect(EXERCISE_ANIMATIONS[id]).toBe(spec);
    }
  });
  it("keeps limb lengths constant", () => {
    for (const id of IDS) {
      for (const d of WALK) {
        const p = POSES[id]!(d);
        for (const i of [0, 1] as const) {
          expect(dist(p.shoulders[i], p.elbows[i]), `${id} ${d}`).toBeCloseTo(29, 3);
          expect(dist(p.elbows[i], p.wrists[i]), `${id} ${d}`).toBeCloseTo(26, 3);
          expect(dist(p.hips[i], p.knees[i]), `${id} ${d}`).toBeCloseTo(45, 3);
          expect(dist(p.knees[i], p.ankles[i]), `${id} ${d}`).toBeCloseTo(43, 2);
          // targets within reach: nothing silently stretched
          expect(dist(p.shoulders[i], p.wrists[i])).toBeLessThan(54.5);
          expect(dist(p.hips[i], p.ankles[i])).toBeLessThan(88);
        }
      }
    }
  });
  it("moves every joint smoothly (no snaps between neighbouring samples)", () => {
    for (const id of IDS) {
      let prev = POSES[id]!(0);
      for (const d of WALK.slice(1)) {
        const p = POSES[id]!(d);
        for (const j of JOINTS)
          for (const i of [0, 1] as const)
            expect(dist(p[j][i], prev[j][i]), `${id} ${j} at ${d}`).toBeLessThan(12);
        expect(dist(p.head, prev.head), `${id} head at ${d}`).toBeLessThan(12);
        prev = p;
      }
    }
  });
  it("stays inside the frame in both views", () => {
    for (const id of IDS) {
      const m = ANIMATIONS_W2[id]!.figure!;
      const k = m.scale;
      for (const d of WALK) {
        const p = m.pose(d);
        const pts: [V3, number][] = [
          ...JOINTS.flatMap((j) => p[j].map((v) => [v, 0] as [V3, number])),
          [p.head, 10.5],
        ];
        for (const [v, r] of pts) {
          const fx = 160 + v[0] * k;
          const sx = 160 + (v[2] - m.centerZ) * k;
          const y = 196 - v[1] * k;
          for (const x of [fx, sx]) {
            expect(x - r * k, `${id} ${d} x`).toBeGreaterThan(6);
            expect(x + r * k, `${id} ${d} x`).toBeLessThan(314);
          }
          expect(y - r * k, `${id} ${d} y`).toBeGreaterThan(6);
          expect(y + r * k, `${id} ${d} y`).toBeLessThan(200);
        }
      }
    }
  });
  it("renders each exercise", () => {
    for (const id of IDS) {
      const html = renderToString(
        createElement(GymProvider, null, createElement(ExerciseAnimation, { exerciseId: id })),
      );
      expect(html, id).toContain("<svg");
    }
  });
});

describe("W2 animations: posture", () => {
  it("crunch: lower back and feet stay down, only the shoulders curl up and the torso shortens", () => {
    const start = crunchPose(0);
    const top = crunchPose(1);
    for (const d of WALK) {
      const p = crunchPose(d);
      expect(p.hips[1][1]).toBeCloseTo(10, 3);
      expect(p.ankles[1][1]).toBe(8);
      expect(p.feet[1].floor).toBe(0);
    }
    expect(top.shoulders[1][1] - start.shoulders[1][1]).toBeGreaterThan(8);
    expect(top.shoulders[1][1]).toBeLessThan(32);
    expect(dist(top.shoulders[1], top.hips[1])).toBeLessThan(
      dist(start.shoulders[1], start.hips[1]) - 3,
    );
    // hands stay at the temples
    expect(Math.abs(top.wrists[1][2] - top.head[2])).toBeLessThan(8);
  });
  it("reverse crunch: shoulders stay down, hips curl up, knees stay at 90 degrees, feet hang off the shin", () => {
    const start = reverseCrunchPose(0);
    const top = reverseCrunchPose(1);
    for (const d of WALK) {
      const p = reverseCrunchPose(d);
      expect(p.shoulders[1][1]).toBe(12);
      expect(p.shoulders[1][2]).toBe(-50);
      const thigh = [p.hips[1][1] - p.knees[1][1], p.hips[1][2] - p.knees[1][2]];
      const shin = [p.ankles[1][1] - p.knees[1][1], p.ankles[1][2] - p.knees[1][2]];
      const cosK = (thigh[0]! * shin[0]! + thigh[1]! * shin[1]!) / (45 * 43);
      expect(Math.abs(deg(Math.acos(cosK)) - 90)).toBeLessThan(0.5);
      // fixed angle to the shin, never a sole on the floor under a floating ankle
      const shinAngle = deg(Math.atan2(shin[0]!, shin[1]!));
      expect(p.feet[1].angle).toBeCloseTo(shinAngle + 45, 3);
      expect(p.feet[1].pitch).toBeUndefined();
    }
    expect(top.hips[1][1] - start.hips[1][1]).toBeGreaterThan(10);
    expect(top.knees[1][2]).toBeLessThan(top.hips[1][2]);
    // feet end just above the floor
    expect(start.ankles[1][1]).toBeGreaterThan(10);
    expect(start.ankles[1][1]).toBeLessThan(20);
  });
  it("lying leg raise: legs perfectly straight, lower back down, from just above the floor to vertical", () => {
    for (const d of WALK) {
      const p = lyingLegRaisePose(d);
      for (const i of [0, 1] as const) {
        expect(offLine(p.knees[i], p.hips[i], p.ankles[i]), `knee bulge at ${d}`).toBeLessThan(
          0.05,
        );
        expect(p.hips[i][1]).toBeCloseTo(10, 3);
      }
      expect(p.feet[1].angle).toBeDefined();
    }
    const start = lyingLegRaisePose(0);
    const top = lyingLegRaisePose(1);
    expect(start.ankles[1][1]).toBeLessThan(25);
    expect(start.ankles[1][1]).toBeGreaterThan(14);
    expect(Math.abs(top.ankles[1][2] - top.hips[1][2])).toBeLessThan(1);
    expect(top.ankles[1][1]).toBeGreaterThan(95);
  });
  it("russian twist: hips and feet fixed, torso leans 45 degrees, the hands swing from side to side", () => {
    const a = russianTwistPose(0);
    const b = russianTwistPose(1);
    const mid = russianTwistPose(0.5);
    for (const d of WALK) {
      const p = russianTwistPose(d);
      expect(p.hips[1]).toEqual(a.hips[1]);
      expect(p.ankles[1]).toEqual(a.ankles[1]);
      expect(p.knees[1]).toEqual(a.knees[1]);
      const cx = (p.shoulders[0][1] + p.shoulders[1][1]) / 2;
      const cz = (p.shoulders[0][2] + p.shoulders[1][2]) / 2;
      const lean = deg(Math.atan2(-cz - 0, cx - 10));
      expect(Math.abs(lean - 45)).toBeLessThan(0.5);
    }
    expect(a.wrists[1][0]).toBeLessThan(-12);
    expect(b.wrists[1][0]).toBeGreaterThan(12);
    expect(Math.abs(mid.wrists[1][0])).toBeLessThan(3);
    // the shoulder line turns: it narrows in the front view
    expect(Math.abs(a.shoulders[1][0] - a.shoulders[0][0])).toBeLessThan(36);
    expect(Math.abs(mid.shoulders[1][0] - mid.shoulders[0][0])).toBeCloseTo(38, 0);
  });
  it("nordic curl: knees on the pad, ankles anchored, one straight line from knees to head", () => {
    for (const d of WALK) {
      const p = nordicCurlPose(d);
      const knee: V3 = [10, NORDIC_KNEE_Y, 0];
      expect(p.ankles[1][1]).toBe(NORDIC_PAD_TOP + 8);
      expect(p.ankles[1][2]).toBeCloseTo(nordicCurlPose(0).ankles[1][2], 6);
      expect(p.feet[1].dir).toBe(-1);
      expect(dist(p.knees[1], knee), `knee at ${d}`).toBeLessThan(0.05);
      expect(
        offLine([10, p.shoulders[1][1], p.shoulders[1][2]], knee, [10, p.head[1], p.head[2]]),
      ).toBeLessThan(0.05);
      expect(offLine(p.hips[1], knee, [10, p.head[1], p.head[2]])).toBeLessThan(0.05);
    }
    const top = nordicCurlPose(0);
    const low = nordicCurlPose(1);
    expect(top.hips[1][2]).toBeCloseTo(0, 3);
    expect(top.head[1]).toBeGreaterThan(120);
    expect(low.wrists[1][1]).toBeLessThan(8);
    expect(low.shoulders[1][1]).toBeLessThan(40);
  });
  it("back extension: straight line at 45 degrees at the top, 90 degrees of hip flexion at the bottom, hips on the pad", () => {
    const top = backExtensionPose(0);
    const bottom = backExtensionPose(1);
    for (const d of WALK) {
      const p = backExtensionPose(d);
      expect(p.hips[1][1]).toBeCloseTo(BACK_EXT_HIP.y, 6);
      expect(p.hips[1][2]).toBeCloseTo(BACK_EXT_HIP.z, 6);
      expect(offLine(p.knees[1], p.hips[1], p.ankles[1]), `knee at ${d}`).toBeLessThan(0.05);
      expect(p.feet[1].angle).toBe(-45);
    }
    const flat = (v: V3): V3 => [0, v[1], v[2]];
    expect(offLine(flat(top.shoulders[1]), flat(top.ankles[1]), flat(top.hips[1]))).toBeLessThan(
      0.1,
    );
    const leg = [top.hips[1][2] - top.ankles[1][2], top.hips[1][1] - top.ankles[1][1]];
    expect(deg(Math.atan2(leg[1]!, leg[0]!))).toBeCloseTo(45, 1);
    // the hip angle: between the thigh and the torso
    const flex = (p: FigurePose) => {
      const t = [p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]];
      const l = [p.knees[1][2] - p.hips[1][2], p.knees[1][1] - p.hips[1][1]];
      return deg(Math.acos((t[0]! * l[0]! + t[1]! * l[1]!) / (dist(t, [0, 0]) * dist(l, [0, 0]))));
    };
    expect(flex(top)).toBeGreaterThan(178);
    expect(flex(bottom)).toBeCloseTo(90, 0);
    expect(bottom.head[1]).toBeGreaterThan(15);
    // crossed arms: each wrist is on the opposite side of the chest
    expect(top.wrists[1][0]).toBeLessThan(0);
  });
});
