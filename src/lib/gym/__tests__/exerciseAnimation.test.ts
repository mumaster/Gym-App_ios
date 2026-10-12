import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { ExerciseDetailSheet } from "../../../components/gym/ExerciseDetailSheet";
import { EXERCISES } from "../data";
import {
  backSquatPose,
  barbellCurlPose,
  calfRaisePose,
  dbRdlPose,
  hammerCurlPose,
  legExtensionPose,
  BENCH_PRESS_RIG,
  cableCrunchPose,
  cablePushdownPose,
  hangingLegRaisePose,
  pullUpPose,
  PULLUP_BAR_Y,
  seatedLegCurlPose,
  bentRowPose,
  BOX_TOP,
  BOX_Z,
  curlPose,
  dbRowPose,
  deadliftPose,
  gluteBridgePose,
  hipThrustPose,
  kettlebellSwingPose,
  lateralRaisePose,
  singleLegRdlPose,
  THRUST_BENCH_Y,
  depthAt,
  elbowFlare,
  EXERCISE_ANIMATIONS,
  gobletPose,
  inclinePressPose,
  latPulldownPose,
  phaseAt,
  pressPose,
  rdlPose,
  reverseLungePose,
  seatedPressPose,
  stepUpPose,
  sumoPose,
  type FigurePose,
} from "../exerciseAnimation";
import { GymProvider } from "../store";

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - (b[i] ?? 0)));

describe("bench press rig", () => {
  const rig = BENCH_PRESS_RIG;
  it("keeps limb lengths constant through the rep", () => {
    for (const d of [0, 0.3, 0.7, 1]) {
      const p = pressPose(rig, d);
      expect(dist(p.shoulders[1], p.elbows[1])).toBeCloseTo(rig.upperArm, 3);
      expect(dist(p.elbows[1], p.wrists[1])).toBeCloseTo(rig.forearm, 3);
    }
  });
  it("stacks wrists over elbows with 45-75 degree elbows at the bottom", () => {
    const p = pressPose(rig, 1);
    expect(Math.abs(p.elbows[1][0] - p.wrists[1][0])).toBeLessThan(2);
    expect(p.elbows[1][1]).toBeLessThan(p.wrists[1][1]);
    expect(elbowFlare(p)).toBeGreaterThan(45);
    expect(elbowFlare(p)).toBeLessThan(75);
  });
  it("touches the lower chest and locks out over the shoulders", () => {
    const bottom = pressPose(rig, 1);
    const top = pressPose(rig, 0);
    expect(bottom.bar[2]).toBeGreaterThan(top.bar[2]);
    expect(top.bar[1]).toBeGreaterThan(bottom.bar[1] + 30);
    // lockout: the arm is (almost) straight
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(rig.upperArm + rig.forearm - 2);
  });
  it("plants the feet and runs one rep from lockout through the chest and back", () => {
    expect(pressPose(rig, 0.5).ankles[1][1]).toBe(rig.ankleY);
    expect(depthAt(0)).toBe(0);
    expect(depthAt(0.45)).toBe(1);
    expect(depthAt(0.9)).toBe(0);
    expect([0, 0.45, 0.6, 0.9].map(phaseAt)).toEqual(["lower", "touch", "press", "lockout"]);
  });
});

const ANIMATED = [
  "bb-bench",
  "bb-curl",
  "bb-deadlift",
  "bb-row",
  "bb-squat",
  "cable-crunch",
  "cable-pushdown",
  "db-curl",
  "db-hammer-curl",
  "db-rdl",
  "db-row",
  "db-shoulder-press",
  "db-single-leg-rdl",
  "db-step-up",
  "db-sumo-deadlift",
  "glute-bridge",
  "goblet-squat",
  "hanging-leg-raise",
  "hip-thrust",
  "incline-db-press",
  "kb-swing",
  "lat-pulldown",
  "lateral-raise",
  "leg-curl",
  "leg-extension",
  "pullup",
  "rdl",
  "reverse-lunge",
  "standing-calf",
];

const POSES: Record<string, (d: number) => FigurePose> = {
  "bb-deadlift": deadliftPose,
  rdl: rdlPose,
  "goblet-squat": gobletPose,
  "db-shoulder-press": seatedPressPose,
  "lat-pulldown": latPulldownPose,
  "bb-squat": backSquatPose,
  "bb-row": bentRowPose,
  "incline-db-press": inclinePressPose,
  "db-curl": curlPose,
  "reverse-lunge": reverseLungePose,
  "db-step-up": stepUpPose,
  "db-sumo-deadlift": sumoPose,
  "db-row": dbRowPose,
  "lateral-raise": lateralRaisePose,
  "kb-swing": kettlebellSwingPose,
  "db-single-leg-rdl": singleLegRdlPose,
  "glute-bridge": gluteBridgePose,
  "hip-thrust": hipThrustPose,
};

/** Height of the near foot's ankle when it is not on the floor. */
const NEAR_ANKLE_Y: Record<string, number> = { "db-step-up": 8 + BOX_TOP };

/** Samples every 0.05 of depth, from the start pose to the turning point. */
const WALK = Array.from({ length: 21 }, (_, i) => i / 20);
const JOINTS = ["shoulders", "elbows", "wrists", "hips", "knees", "ankles"] as const;

describe("figure rigs", () => {
  it("keep limb lengths constant and the feet planted through the rep", () => {
    for (const [id, pose] of Object.entries(POSES)) {
      for (const d of [0, 0.25, 0.5, 0.75, 1]) {
        const p = pose(d);
        for (const i of [0, 1] as const) {
          expect(dist(p.shoulders[i], p.elbows[i])).toBeCloseTo(29, 3);
          expect(dist(p.elbows[i], p.wrists[i])).toBeCloseTo(26, 0);
          // a fully straight leg is clamped to its reach, so the shin may stretch a hair

          expect(dist(p.hips[i], p.knees[i])).toBeCloseTo(45, 3);
          expect(Math.abs(dist(p.knees[i], p.ankles[i]) - 43)).toBeLessThan(1.2);
        }
        expect(p.ankles[1][1]).toBe(NEAR_ANKLE_Y[id] ?? 8);
      }
    }
  });
  it("move every joint smoothly through the whole rep (no snaps between neighbouring samples)", () => {
    for (const [id, pose] of Object.entries(POSES)) {
      let prev = pose(0);
      for (const d of WALK.slice(1)) {
        const p = pose(d);
        for (const j of JOINTS) {
          for (const i of [0, 1] as const) {
            expect(dist(p[j][i], prev[j][i]), `${id} ${j} at ${d}`).toBeLessThan(14);
          }
        }
        prev = p;
      }
    }
  });
  it("deadlift: bar over the mid-foot, knees extend smoothly, then lockout", () => {
    const floor = deadliftPose(1);
    expect(floor.bar[1]).toBeCloseTo(22.5, 3);
    expect(Math.abs(floor.bar[2] - 3)).toBeLessThan(2);
    // The legs straighten gradually (no early lockout, no sudden jump) and the
    // knees never travel far from the bar.
    let prev = dist(floor.hips[1], floor.ankles[1]);
    for (let d = 0.95; d >= -0.001; d -= 0.05) {
      const p = deadliftPose(Math.max(0, d));
      const reach = dist(p.hips[1], p.ankles[1]);
      expect(reach).toBeGreaterThanOrEqual(prev - 0.5);
      expect(reach - prev).toBeLessThan(4);
      if (d > 0.15) expect(reach).toBeLessThan(86);
      expect(Math.abs(p.knees[1][2] - p.bar[2])).toBeLessThan(12);
      prev = reach;
    }
    const rise = deadliftPose(0.7);
    expect(rise.hips[1][1]).toBeGreaterThan(floor.hips[1][1] + 8);
    expect(rise.shoulders[1][1]).toBeGreaterThan(floor.shoulders[1][1] + 10);
    const top = deadliftPose(0);
    expect(top.hips[1][1]).toBeGreaterThan(90);
    expect(Math.abs(top.shoulders[1][2] - top.hips[1][2])).toBeLessThan(10);
  });
  it("RDL: the knees stay soft while the hips travel back", () => {
    const knee = (p: FigurePose) => dist(p.hips[1], p.ankles[1]);
    for (const d of [0, 0.5, 1]) expect(knee(rdlPose(d))).toBeLessThan(88);
    expect(rdlPose(1).hips[1][2]).toBeLessThan(rdlPose(0).hips[1][2] - 20);
    expect(rdlPose(1).shoulders[1][1]).toBeLessThan(rdlPose(0).shoulders[1][1] - 25);
  });
  it("goblet squat: hips below the knees, knees over the toes, torso upright", () => {
    const p = gobletPose(1);
    expect(p.hips[1][1]).toBeLessThan(p.knees[1][1] + 4); // parallel or deeper
    expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] + 10);
    const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
    expect((lean * 180) / Math.PI).toBeLessThan(35);
  });
  it("seated press: wrists over elbows at the bottom, locked out overhead", () => {
    const bottom = seatedPressPose(1);
    expect(Math.abs(bottom.elbows[1][0] - bottom.wrists[1][0])).toBeLessThan(4);
    expect(bottom.wrists[1][1]).toBeGreaterThan(bottom.elbows[1][1] + 20);
    const top = seatedPressPose(0);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(52);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1] + 45);
    expect(top.hips[1][2]).toBeGreaterThan(top.shoulders[1][2]);
  });
  it("lat pulldown: leaning back, bar to the upper chest, elbows below the hands", () => {
    const bottom = latPulldownPose(1);
    const top = latPulldownPose(0);
    expect(bottom.shoulders[1][2]).toBeLessThan(bottom.hips[1][2]);
    expect(top.wrists[1][1]).toBeGreaterThan(bottom.wrists[1][1] + 40);
    expect(Math.abs(bottom.wrists[1][1] - bottom.shoulders[1][1])).toBeLessThan(15);
    expect(bottom.elbows[1][1]).toBeLessThan(bottom.wrists[1][1] - 8);
    expect(bottom.elbows[1][2]).toBeLessThan(bottom.wrists[1][2]);
  });
  it("back squat: just below parallel, knees over the toes, bar over the mid-foot", () => {
    const p = backSquatPose(1);
    expect(p.hips[1][1]).toBeLessThanOrEqual(p.knees[1][1] + 1);
    expect(p.hips[1][1]).toBeGreaterThan(p.knees[1][1] - 12);
    expect(p.knees[1][2]).toBeGreaterThan(p.ankles[1][2] + 10);
    expect(Math.abs(p.bar[2] - 7)).toBeLessThan(8);
    const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
    expect((lean * 180) / Math.PI).toBeLessThan(45);
    // The hips sink steadily; the legs never lock out early or snap.
    let prev = dist(backSquatPose(0).hips[1], backSquatPose(0).ankles[1]);
    for (const d of WALK.slice(1)) {
      const q = backSquatPose(d);
      const reach = dist(q.hips[1], q.ankles[1]);
      expect(reach).toBeLessThanOrEqual(prev + 0.01);
      expect(q.bar[2]).toBeGreaterThan(-8);
      expect(q.bar[2]).toBeLessThan(12);
      prev = reach;
    }
    expect(backSquatPose(0).hips[1][2]).toBeCloseTo(backSquatPose(0).ankles[1][2], 0);
  });
  it("bent-over row: torso angle held, arms straight at the bottom, elbows back at the top", () => {
    const lean = (p: FigurePose) =>
      (Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) /
      Math.PI;
    for (const d of WALK)
      expect(Math.abs(lean(bentRowPose(d)) - lean(bentRowPose(0)))).toBeLessThan(0.5);
    expect(lean(bentRowPose(0))).toBeGreaterThan(40);
    expect(lean(bentRowPose(0))).toBeLessThan(65);
    const hang = bentRowPose(0);
    expect(dist(hang.shoulders[1], hang.wrists[1])).toBeGreaterThan(53);
    const top = bentRowPose(1);
    expect(top.elbows[1][2]).toBeLessThan(top.shoulders[1][2] - 15);
    expect(top.wrists[1][1]).toBeGreaterThan(hang.wrists[1][1] + 15);
    expect(top.wrists[1][1]).toBeLessThan(top.shoulders[1][1] - 20);
  });
  it("incline press: bench at 45 degrees, wrists over elbows at the bottom, locked out at the top", () => {
    const bottom = inclinePressPose(1);
    const top = inclinePressPose(0);
    expect(Math.abs(bottom.elbows[1][2] - bottom.wrists[1][2])).toBeLessThan(4);
    expect(bottom.wrists[1][1]).toBeGreaterThan(bottom.elbows[1][1] + 20);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(52);
    const back = (p: FigurePose) =>
      (Math.atan2(p.hips[1][2] - p.shoulders[1][2], p.shoulders[1][1] - p.hips[1][1]) * 180) /
      Math.PI;
    expect(back(top)).toBeGreaterThan(40);
    expect(back(top)).toBeLessThan(50);
    expect(top.wrists[1][1]).toBeGreaterThan(top.shoulders[1][1] + 45);
  });
  it("curl: elbows stay pinned, the wrist ends at shoulder height", () => {
    const start = curlPose(0);
    const end = curlPose(1);
    for (const d of WALK) {
      const p = curlPose(d);
      expect(dist(p.elbows[1], start.elbows[1])).toBeLessThan(9);
      expect(p.hips[1][1]).toBe(start.hips[1][1]);
    }
    expect(dist(start.shoulders[1], start.wrists[1])).toBeGreaterThan(52);
    expect(Math.abs(end.wrists[1][1] - end.shoulders[1][1])).toBeLessThan(12);
  });
  it("reverse lunge: front shin vertical and thigh level, back knee near the floor, torso upright", () => {
    const p = reverseLungePose(1);
    expect(Math.abs(p.knees[1][1] - p.hips[1][1])).toBeLessThan(6);
    expect(Math.abs(p.knees[1][2] - p.ankles[1][2])).toBeLessThan(8);
    expect(p.knees[0][1]).toBeLessThan(25);
    expect(p.ankles[0][2]).toBeLessThan(-80);
    const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
    expect((lean * 180) / Math.PI).toBeLessThan(12);
    let prev = 0;
    for (const d of WALK) {
      const q = reverseLungePose(d);
      expect(q.ankles[1][2]).toBe(0);
      expect(q.ankles[0][2]).toBeLessThanOrEqual(prev + 0.01);
      expect(q.knees[0][1]).toBeGreaterThan(8);
      prev = q.ankles[0][2];
    }
  });
  it("step-up: the free foot clears the box and the box foot stays put", () => {
    for (const d of WALK) {
      const p = stepUpPose(d);
      expect(p.ankles[1]).toEqual(stepUpPose(0).ankles[1]);
      const free = p.ankles[0];
      const belowTop = free[1] - 8 < BOX_TOP - 0.5;
      if (belowTop) expect(free[2] + 15).toBeLessThanOrEqual(BOX_Z.from + 0.5);
      expect(p.hips[1][1]).toBeGreaterThan(80);
    }
    const bottom = stepUpPose(1);
    expect(bottom.ankles[0][1]).toBe(8);
    expect(Math.abs(bottom.knees[1][1] - bottom.hips[1][1])).toBeLessThan(12);
    const top = stepUpPose(0);
    expect(top.hips[1][1]).toBeGreaterThan(top.ankles[1][1] + 85);
  });
  it("sumo deadlift: wide stance, knees out, dumbbell near the floor, hips and legs open steadily", () => {
    const bottom = sumoPose(1);
    expect(bottom.ankles[1][0]).toBeGreaterThan(24);
    expect(Math.abs(bottom.knees[1][0])).toBeGreaterThan(Math.abs(bottom.hips[1][0]) + 12);
    expect(bottom.bar[1]).toBeLessThan(26);
    const lean = Math.atan2(
      bottom.shoulders[1][2] - bottom.hips[1][2],
      bottom.shoulders[1][1] - bottom.hips[1][1],
    );
    expect((lean * 180) / Math.PI).toBeGreaterThan(30);
    expect((lean * 180) / Math.PI).toBeLessThan(48);
    let prev = dist(bottom.hips[1], bottom.ankles[1]);
    for (const d of [...WALK].reverse().slice(1)) {
      const reach = dist(sumoPose(d).hips[1], sumoPose(d).ankles[1]);
      expect(reach).toBeGreaterThanOrEqual(prev - 0.01);
      prev = reach;
    }
  });
  it("one-arm row: flat back, free hand and knee on the bench, elbow back at the top", () => {
    for (const d of WALK) {
      const p = dbRowPose(d);
      const lean = Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]);
      expect((lean * 180) / Math.PI).toBeGreaterThan(70);
      expect(p.wrists[0][1]).toBeLessThan(50);
      expect(p.ankles[0][1]).toBeGreaterThan(50);
    }
    const hang = dbRowPose(0);
    expect(dist(hang.shoulders[1], hang.wrists[1])).toBeGreaterThan(53);
    const top = dbRowPose(1);
    expect(top.elbows[1][2]).toBeLessThan(top.shoulders[1][2] - 15);
    expect(top.wrists[1][1]).toBeGreaterThan(hang.wrists[1][1] + 30);
  });
});

const wrap = (child: ReturnType<typeof createElement>) =>
  renderToString(createElement(GymProvider, null, child));

describe("ExerciseAnimation render", () => {
  it("renders every animated exercise and nothing for exercises without one", () => {
    for (const id of ANIMATED) {
      expect(wrap(createElement(ExerciseAnimation, { exerciseId: id }))).toContain("<svg");
    }
    expect(wrap(createElement(ExerciseAnimation, { exerciseId: "unknown" }))).toBe("");
    expect(Object.keys(EXERCISE_ANIMATIONS).sort()).toEqual(ANIMATED);
  });
  it("shows up in the exercise sheet for the barbell bench press only", () => {
    const bench = EXERCISES.find((e) => e.id === "bb-bench")!;
    const other = EXERCISES.find((e) => e.id === "db-bench")!;
    const open = (e: typeof bench) =>
      wrap(createElement(ExerciseDetailSheet, { exercise: e, onClose: () => {} }));
    expect(() => open(bench)).not.toThrow();
    expect(open(bench)).toContain("<svg");
    expect(open(other)).not.toContain('role="img"');
  });
  it("has cues, captions and names in both languages, and matches catalog ids", () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    for (const id of ANIMATED) {
      const spec = EXERCISE_ANIMATIONS[id]!;
      expect(spec.cues.en.length).toBeGreaterThan(0);
      expect(spec.cues.nl.length).toBe(spec.cues.en.length);
      if (id !== "bb-bench") {
        expect(Object.keys(spec.phases!.nl)).toEqual(Object.keys(spec.phases!.en));
        expect(spec.labels!.nl.side).not.toBe("");
      }
    }
    expect(ANIMATED.every((id) => ids.has(id))).toBe(true);
  });
});

describe("batch 2 lifts", () => {
  it("lateral raise: arms stay almost straight and end at shoulder height", () => {
    const top = lateralRaisePose(1);
    expect(Math.abs(top.wrists[1][1] - top.shoulders[1][1])).toBeLessThan(6);
    expect(top.wrists[1][0]).toBeGreaterThan(top.shoulders[1][0] + 40);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(50);
    // never above the shoulders
    for (const d of WALK) {
      const p = lateralRaisePose(d);
      expect(p.wrists[1][1]).toBeLessThan(p.shoulders[1][1] + 1);
    }
  });
  it("kettlebell swing: bell reaches chest height at the top, back between the legs at the bottom, arms straight", () => {
    const top = kettlebellSwingPose(0);
    const bottom = kettlebellSwingPose(1);
    expect(Math.abs(top.bar[1] - top.shoulders[1][1])).toBeLessThan(18);
    expect(top.bar[2]).toBeGreaterThan(top.hips[1][2] + 40);
    expect(bottom.bar[1]).toBeLessThan(bottom.hips[1][1]);
    expect(bottom.hips[1][2]).toBeLessThan(top.hips[1][2] - 25);
    for (const d of WALK) {
      const p = kettlebellSwingPose(d);
      expect(dist(p.shoulders[1], p.wrists[1])).toBeGreaterThan(50);
    }
  });
  it("single-leg RDL: the free leg rises in line with the torso, the standing leg stays soft", () => {
    const bottom = singleLegRdlPose(1);
    expect(bottom.ankles[0][1]).toBeGreaterThan(40);
    // torso and free leg point in opposite directions along one line
    const torso: [number, number] = [
      bottom.shoulders[1][1] - bottom.hips[1][1],
      bottom.shoulders[1][2] - bottom.hips[1][2],
    ];
    const leg: [number, number] = [
      bottom.ankles[0][1] - bottom.hips[0][1],
      bottom.ankles[0][2] - bottom.hips[0][2],
    ];
    const cross = torso[0] * leg[1] - torso[1] * leg[0];
    expect(Math.abs(cross) / (Math.hypot(...torso) * Math.hypot(...leg))).toBeLessThan(0.15);
    expect(Math.abs(bottom.hips[1][1] - bottom.hips[0][1])).toBeLessThan(0.01);
    expect(dist(bottom.hips[1], bottom.ankles[1])).toBeLessThan(87.5);
    expect(bottom.feet[0].pitch).toBeGreaterThan(60);
  });
  it("glute bridge: shoulders stay on the floor and shoulders, hips and knees line up at the top", () => {
    const top = gluteBridgePose(0);
    for (const d of WALK) {
      const p = gluteBridgePose(d);
      expect(p.shoulders[1][1]).toBe(12);
      expect(p.hips[1][1]).toBeGreaterThan(9.9);
    }
    const a: [number, number] = [
      top.hips[1][1] - top.shoulders[1][1],
      top.hips[1][2] - top.shoulders[1][2],
    ];
    const b: [number, number] = [
      top.knees[1][1] - top.hips[1][1],
      top.knees[1][2] - top.hips[1][2],
    ];
    const angle = Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)));
    expect((angle * 180) / Math.PI).toBeLessThan(25);
    expect(top.hips[1][1]).toBeGreaterThan(gluteBridgePose(1).hips[1][1] + 20);
  });
  it("hip thrust: shoulders stay on the bench; at the top the torso and thighs are level and the shins vertical", () => {
    const top = hipThrustPose(0);
    for (const d of WALK) {
      const p = hipThrustPose(d);
      expect(p.shoulders[1][1]).toBe(THRUST_BENCH_Y + 8);
      expect(p.bar[1]).toBeGreaterThan(p.hips[1][1]);
    }
    expect(Math.abs(top.hips[1][1] - top.shoulders[1][1])).toBeLessThan(1);
    expect(Math.abs(top.knees[1][1] - top.hips[1][1])).toBeLessThan(4);
    expect(Math.abs(top.knees[1][2] - top.ankles[1][2])).toBeLessThan(4);
    expect(hipThrustPose(1).hips[1][1]).toBeLessThan(top.hips[1][1] - 25);
  });
});

describe("batch 3 lifts", () => {
  const B3: Record<string, (d: number) => FigurePose> = {
    pullup: pullUpPose,
    "hanging-leg-raise": hangingLegRaisePose,
    "cable-pushdown": cablePushdownPose,
    "cable-crunch": cableCrunchPose,
    "leg-curl": seatedLegCurlPose,
    "bb-curl": barbellCurlPose,
    "db-hammer-curl": hammerCurlPose,
    "db-rdl": dbRdlPose,
    "standing-calf": calfRaisePose,
    "leg-extension": legExtensionPose,
  };
  it("keeps limb lengths constant and moves smoothly through the whole rep", () => {
    for (const [id, pose] of Object.entries(B3)) {
      let prev = pose(0);
      for (const d of WALK) {
        const p = pose(d);
        for (const i of [0, 1] as const) {
          expect(dist(p.shoulders[i], p.elbows[i]), id).toBeCloseTo(29, 3);
          expect(dist(p.elbows[i], p.wrists[i]), id).toBeCloseTo(26, 0);
          expect(dist(p.hips[i], p.knees[i]), id).toBeCloseTo(45, 3);
          expect(Math.abs(dist(p.knees[i], p.ankles[i]) - 43), id).toBeLessThan(1.2);
          for (const j of JOINTS)
            expect(dist(p[j][i], prev[j][i]), `${id} ${j} at ${d}`).toBeLessThan(14);
        }
        prev = p;
      }
    }
  });
  it("pull-up: hangs with straight arms and ends with the chin over the bar", () => {
    const hang = pullUpPose(0);
    const top = pullUpPose(1);
    expect(dist(hang.shoulders[1], hang.wrists[1])).toBeGreaterThan(54);
    expect(hang.wrists[1][1]).toBeCloseTo(PULLUP_BAR_Y, 0);
    expect(top.wrists[1][1]).toBeCloseTo(PULLUP_BAR_Y, 0);
    expect(top.shoulders[1][1]).toBeGreaterThan(hang.shoulders[1][1] + 25);
    expect(top.ankles[1][1]).toBeGreaterThan(40);
  });
  it("hanging leg raise: the shoulders stay put and the legs rise to hip height", () => {
    const hang = hangingLegRaisePose(0);
    const top = hangingLegRaisePose(1);
    expect(top.shoulders[1][1]).toBeCloseTo(hang.shoulders[1][1], 3);
    expect(top.ankles[1][1]).toBeGreaterThan(hang.ankles[1][1] + 40);
    expect(Math.abs(top.ankles[1][1] - top.hips[1][1])).toBeLessThan(8);
  });
  it("cable pushdown: the upper arm stays pinned and the hands finish by the thighs", () => {
    const top = cablePushdownPose(0);
    const bottom = cablePushdownPose(1);
    expect(Math.abs(top.elbows[1][1] - bottom.elbows[1][1])).toBeLessThan(2);
    expect(bottom.wrists[1][1]).toBeLessThan(top.wrists[1][1] - 30);
    expect(dist(bottom.shoulders[1], bottom.wrists[1])).toBeGreaterThan(50);
  });
  it("cable crunch: the hips stay back and the torso curls down toward the knees", () => {
    const top = cableCrunchPose(0);
    const bottom = cableCrunchPose(1);
    expect(Math.abs(top.hips[1][1] - bottom.hips[1][1])).toBeLessThan(1);
    expect(bottom.shoulders[1][1]).toBeLessThan(top.shoulders[1][1] - 15);
  });
  it("calf raise: toes stay planted while the body rises and the legs stay straight", () => {
    const down = calfRaisePose(0);
    const up = calfRaisePose(1);
    expect(up.hips[1][1]).toBeGreaterThan(down.hips[1][1] + 9);
    expect(up.ankles[1][2]).toBeCloseTo(down.ankles[1][2], 3);
    expect(dist(up.hips[1], up.ankles[1])).toBeGreaterThan(87.5);
  });
  it("leg extension: the thigh stays put while the shin swings up to straight", () => {
    const start = legExtensionPose(0);
    const end = legExtensionPose(1);
    expect(dist(end.knees[1], start.knees[1])).toBeLessThan(0.5);
    expect(end.ankles[1][2]).toBeGreaterThan(start.ankles[1][2] + 25);
    expect(Math.abs(end.ankles[1][1] - end.knees[1][1])).toBeLessThan(5);
  });
  it("seated leg curl: the thigh stays on the pad while the shin swings back", () => {
    const start = seatedLegCurlPose(0);
    const end = seatedLegCurlPose(1);
    expect(dist(end.knees[1], start.knees[1])).toBeLessThan(0.5);
    expect(end.ankles[1][2]).toBeLessThan(start.ankles[1][2] - 25);
  });
});
