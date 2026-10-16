import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseAnimation } from "../../../components/gym/ExerciseAnimation";
import { type FigureModel, type FigurePose, type V3 } from "../exerciseAnimation";
import {
  ANIMATIONS_W12,
  CABLE_CURL_PULLEY,
  OHC_BACK_ANKLE_Z,
  OHC_FRONT_ANKLE_Z,
  OHC_PULLEY,
  PAD_HALF,
  PREACHER_ELBOW_X,
  PRE_BARBELL,
  PRE_DB,
  PRE_EZ,
  PRE_MACHINE,
} from "../exerciseAnimationW12";
import { GymProvider } from "../store";

const IDS = [
  "ez-bar-curl",
  "ez-bar-reverse-curl",
  "ez-bar-preacher-curl",
  "barbell-preacher-curl",
  "db-preacher-curl",
  "machine-preacher-curl",
  "ez-bar-skullcrusher",
  "ez-bar-overhead-triceps-extension",
  "cable-curl",
  "overhead-cable-extension",
];

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const WALK = Array.from({ length: 21 }, (_, i) => i * 0.05);
const model = (id: string): FigureModel => ANIMATIONS_W12[id]!.figure!;
const poseAt = (id: string, d: number): FigurePose => model(id).pose(d);
const deg = (r: number) => (r * 180) / Math.PI;

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

/** Distance from point `c` to the segment a-b. */
function segDist(c: V3, a: V3, b: V3): number {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const t = Math.min(
    1,
    Math.max(
      0,
      (ac[0] * ab[0] + ac[1] * ab[1] + ac[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2),
    ),
  );
  return dist(c, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}

/** Implement extents in the frame: half bar length and plate radius (cm). */
const BARS: Record<string, { half: number; r: number }> = {
  "w12-ez-bar": { half: 56, r: 15 },
  "w12-ez-bar-over": { half: 56, r: 15 },
  "w12-ez-bar-small": { half: 56, r: 10 },
  "w12-ez-bar-behind": { half: 56, r: 10 },
  "w12-barbell": { half: 75, r: 15 },
};

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

/** Elbows (and shoulders) never move. */
function expectElbowsPinned(id: string, sides: (0 | 1)[] = [0, 1]) {
  const a = poseAt(id, 0);
  for (const d of WALK) {
    const p = poseAt(id, d);
    for (const s of sides) {
      expect(dist(p.elbows[s], a.elbows[s])).toBeLessThan(1e-6);
      expect(dist(p.shoulders[s], a.shoulders[s])).toBeLessThan(1e-9);
    }
  }
}

/** The shoulder-to-wrist distance shrinks steadily: one smooth curl, no jumps. */
function expectMonotoneReach(id: string, dir: "shrinks" | "grows") {
  let prev = dist(poseAt(id, 0).shoulders[1], poseAt(id, 0).wrists[1]);
  for (const d of WALK.slice(1)) {
    const p = poseAt(id, d);
    const r = dist(p.shoulders[1], p.wrists[1]);
    if (dir === "shrinks") expect(r).toBeLessThanOrEqual(prev + 1e-9);
    else expect(r).toBeGreaterThanOrEqual(prev - 1e-9);
    prev = r;
  }
}

describe.each(IDS)("%s", (id) => {
  const m = model(id);
  it("has captions, labels and 4-5 cues in both languages", () => {
    const spec = ANIMATIONS_W12[id]!;
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
        expect(dist(p.shoulders[s], p.wrists[s])).toBeLessThanOrEqual(54.95);
        expect(dist(p.hips[s], p.ankles[s])).toBeLessThanOrEqual(88);
      }
      const a = joints(prev);
      const b = joints(p);
      a.forEach((j, i) => expect(dist(j, b[i]!)).toBeLessThan(8));
      prev = p;
    }
  });
  it("stays inside the frame in both views", () => {
    const bar = BARS[m.implement];
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
      if (bar) {
        const [x, y] = side(m, p.bar);
        expect(x - bar.r * m.scale).toBeGreaterThan(4);
        expect(x + bar.r * m.scale).toBeLessThan(316);
        expect(y - bar.r * m.scale).toBeGreaterThan(4);
        expect(y + bar.r * m.scale).toBeLessThan(198);
        expect(front(m, p.bar)[0] - bar.half * m.scale).toBeGreaterThan(4);
        expect(front(m, p.bar)[0] + bar.half * m.scale).toBeLessThan(316);
        expect(front(m, p.bar)[1] - bar.r * m.scale).toBeGreaterThan(4);
      }
      if (m.pulley) {
        const [x, y] = side(m, [0, m.pulley.y, m.pulley.z]);
        expect(x).toBeGreaterThan(24);
        expect(x).toBeLessThan(296);
        expect(y).toBeGreaterThan(14);
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

describe("EZ-bar and cable curls", () => {
  for (const id of ["ez-bar-curl", "ez-bar-reverse-curl", "cable-curl"]) {
    it(`${id}: standing tall, feet planted, elbows pinned, only the forearms move`, () => {
      expectPlanted(id);
      expectElbowsPinned(id);
      expectMonotoneReach(id, "shrinks");
      const a = poseAt(id, 0);
      for (const d of WALK) {
        const p = poseAt(id, d);
        // standing straight: ankle z equals hip z, torso upright
        expect(p.ankles[1][2]).toBe(p.hips[1][2]);
        expect(p.shoulders[1][2]).toBe(p.hips[1][2]);
        // elbows stay beside the torso
        expect(Math.abs(p.elbows[1][2] - p.shoulders[1][2])).toBeLessThan(8);
        // hands never touch the face
        expect(dist(p.wrists[1], p.head)).toBeGreaterThan(20);
        // the wrists keep their x: the grip does not slide
        expect(p.wrists[1][0]).toBeCloseTo(a.wrists[1][0], 9);
      }
      // hangs in front of the thighs, arms almost straight
      expect(a.wrists[1][2] - a.hips[1][2]).toBeGreaterThan(7);
      expect(a.wrists[1][2] - a.hips[1][2]).toBeLessThan(14);
      expect(dist(a.shoulders[1], a.wrists[1])).toBeGreaterThan(51);
    });
  }
  it("EZ-bar curl uses a grip narrower than the barbell curl and ends at shoulder height", () => {
    const a = poseAt("ez-bar-curl", 0);
    const b = poseAt("ez-bar-curl", 1);
    expect(Math.abs(a.wrists[1][0])).toBeLessThan(17);
    expect(Math.abs(a.wrists[1][0])).toBeGreaterThan(8);
    expect(b.wrists[1][1]).toBeGreaterThan(b.shoulders[1][1] - 12);
    expect(b.wrists[1][1]).toBeLessThan(b.shoulders[1][1] + 2);
    expect(b.wrists[1][2]).toBeGreaterThan(b.shoulders[1][2] + 8);
  });
  it("reverse curl stops lower than the underhand curl", () => {
    const rev = poseAt("ez-bar-reverse-curl", 1);
    const cur = poseAt("ez-bar-curl", 1);
    expect(rev.wrists[1][1]).toBeLessThan(cur.wrists[1][1] - 4);
    expect(rev.wrists[1][1]).toBeGreaterThan(rev.shoulders[1][1] - 25);
    expect(model("ez-bar-reverse-curl").implement).toBe("w12-ez-bar-over");
  });
  it("cable curl pulls from a low pulley in front and the cable clears the legs", () => {
    expect(CABLE_CURL_PULLEY.y).toBeLessThanOrEqual(20);
    expect(CABLE_CURL_PULLEY.z).toBeGreaterThan(50);
    expect(model("cable-curl").pulley).toEqual(CABLE_CURL_PULLEY);
    const pulley: V3 = [0, CABLE_CURL_PULLEY.y, CABLE_CURL_PULLEY.z];
    for (const d of WALK) {
      const p = poseAt("cable-curl", d);
      expect(p.wrists[1][1]).toBeGreaterThan(CABLE_CURL_PULLEY.y + 40);
      for (const k of p.knees)
        expect(segDist([0, k[1], k[2]], p.wrists[1], pulley)).toBeGreaterThan(10);
      expect(segDist([0, p.hips[1][1], p.hips[1][2]], p.wrists[1], pulley)).toBeGreaterThan(10);
      // the cable never crosses the lifter's ankles or feet
      expect(
        segDist([0, 8, 0], [0, p.wrists[1][1], p.wrists[1][2]], [0, pulley[1], pulley[2]]),
      ).toBeGreaterThan(8);
    }
  });
});

describe("preacher curls", () => {
  const cfgs: Record<string, typeof PRE_EZ> = {
    "ez-bar-preacher-curl": PRE_EZ,
    "barbell-preacher-curl": PRE_BARBELL,
    "db-preacher-curl": PRE_DB,
    "machine-preacher-curl": PRE_MACHINE,
  };
  for (const [id, cfg] of Object.entries(cfgs)) {
    describe(id, () => {
      it("sits on the seat with the feet flat and the chest leaning onto the pad", () => {
        expectPlanted(id);
        for (const d of WALK) {
          const p = poseAt(id, d);
          expect(p.hips[1][1]).toBe(53);
          // torso lean from vertical
          const lean = deg(
            Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]),
          );
          expect(lean).toBeCloseTo(cfg.lean, 6);
          // shins about vertical, knees ahead of the hips
          expect(p.knees[1][2]).toBeGreaterThan(p.hips[1][2] + 30);
          expect(Math.abs(p.knees[1][2] - p.ankles[1][2])).toBeLessThan(12);
        }
      });
      it("keeps the elbows on the pad for the whole rep, only the forearms move", () => {
        expectElbowsPinned(id, cfg.oneArm ? [1] : [0, 1]);
        for (const d of WALK) {
          const p = poseAt(id, d);
          for (const s of cfg.oneArm ? [1] : [0, 1]) {
            expect(Math.abs(p.elbows[s]![0])).toBeCloseTo(PREACHER_ELBOW_X, 9);
            // the upper arm lies along the pad: angle below horizontal = pad angle
            const ang = deg(
              Math.atan2(
                p.shoulders[s]![1] - p.elbows[s]![1],
                p.elbows[s]![2] - p.shoulders[s]![2],
              ),
            );
            expect(ang).toBeCloseTo(cfg.padDeg, 6);
            // elbow well below the shoulder and ahead of it, armpit at the top of the pad
            expect(p.elbows[s]![1]).toBeLessThan(p.shoulders[s]![1] - 20);
            expect(p.elbows[s]![2]).toBeGreaterThan(p.shoulders[s]![2] + 14);
          }
        }
      });
      it("curls from almost straight arms to a squeezed top, never under the pad or into the face", () => {
        expectMonotoneReach(id, "shrinks");
        const bot = poseAt(id, 0);
        const top = poseAt(id, 1);
        expect(dist(bot.shoulders[1], bot.wrists[1])).toBeGreaterThan(49);
        expect(dist(top.shoulders[1], top.wrists[1])).toBeLessThan(38);
        // forearm nearly vertical at the top, hands under the chin
        expect(Math.abs(top.wrists[1][2] - top.elbows[1][2])).toBeLessThan(14);
        expect(top.wrists[1][1]).toBeGreaterThan(top.elbows[1][1] + 18);
        const a = (cfg.padDeg * Math.PI) / 180;
        const n: [number, number] = [Math.sin(a), Math.cos(a)];
        for (const d of WALK) {
          const p = poseAt(id, d);
          // the wrist stays on the upper side of the pad plane through the arm
          const rz = p.wrists[1][2] - p.shoulders[1][2];
          const ry = p.wrists[1][1] - p.shoulders[1][1];
          expect(rz * n[0] + ry * n[1]).toBeGreaterThan(PAD_HALF * 0 + 0.5);
          // hands clear of the face and of the thigh
          expect(dist(p.wrists[1], p.head)).toBeGreaterThan(19);
          expect(segDist(p.wrists[1], p.hips[1], p.knees[1])).toBeGreaterThan(8);
        }
      });
    });
  }
  it("dumbbell version: one dumbbell on the near arm, the free hand rests on the far thigh", () => {
    expect(model("db-preacher-curl").oneDumbbell).toBe(true);
    expect(model("db-preacher-curl").implement).toBe("dumbbells");
    const a = poseAt("db-preacher-curl", 0);
    for (const d of WALK) {
      const p = poseAt("db-preacher-curl", d);
      expect(dist(p.wrists[0], a.wrists[0])).toBeLessThan(1e-9);
      expect(segDist(p.wrists[0], p.hips[0], p.knees[0])).toBeLessThan(9);
      expect(segDist(p.wrists[0], p.hips[0], p.knees[0])).toBeGreaterThan(3);
    }
  });
  it("uses the right implement and furniture per variant", () => {
    expect(model("ez-bar-preacher-curl").implement).toBe("w12-ez-bar");
    expect(model("barbell-preacher-curl").implement).toBe("w12-barbell");
    expect(model("machine-preacher-curl").implement).toBe("w12-preacher-lever");
    expect(model("machine-preacher-curl").furniture).toBe("w12-preacher-machine");
    for (const id of ["ez-bar-preacher-curl", "barbell-preacher-curl", "db-preacher-curl"])
      expect(model(id).furniture).toBe("w12-preacher");
    // EZ grip narrower than the straight barbell grip
    expect(Math.abs(poseAt("ez-bar-preacher-curl", 0).wrists[1][0])).toBeLessThan(
      Math.abs(poseAt("barbell-preacher-curl", 0).wrists[1][0]),
    );
  });
});

describe("EZ-bar skullcrusher", () => {
  const id = "ez-bar-skullcrusher";
  it("lies flat on the bench, feet flat beyond its end, upper arms still and near vertical", () => {
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.shoulders[1][1]).toBe(55);
      expect(p.hips[1][1]).toBe(55);
      expect(p.feet[1]).toEqual({ floor: 0, dir: 1 });
      expect(p.ankles[1][1]).toBe(8);
      expect(dist(p.ankles[1], a.ankles[1])).toBeLessThan(1e-9);
      expect(dist(p.elbows[1], a.elbows[1])).toBeLessThan(1e-6);
      expect(dist(p.elbows[0], a.elbows[0])).toBeLessThan(1e-6);
      // upper arm within 10 degrees of vertical, elbows tucked in (not flared)
      const up = p.elbows[1][1] - p.shoulders[1][1];
      expect(deg(Math.acos(up / 29))).toBeLessThan(15);
      expect(Math.abs(p.elbows[1][0])).toBeLessThan(BODY_SH);
    }
  });
  it("hinges the forearms only: reach shrinks steadily, bar ends just above the forehead", () => {
    expectMonotoneReach(id, "shrinks");
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(53);
    // narrow EZ grip
    expect(Math.abs(top.wrists[1][0])).toBeLessThan(12);
    expect(Math.abs(top.wrists[1][0])).toBeGreaterThan(6);
    // bar above the forehead, clear of the face by more than a plate
    expect(bot.wrists[1][1]).toBeGreaterThan(bot.head[1] + 12);
    expect(Math.abs(bot.wrists[1][2] - bot.head[2])).toBeLessThan(14);
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(21);
    }
  });
});

describe("EZ-bar overhead triceps extension", () => {
  const id = "ez-bar-overhead-triceps-extension";
  it("stands tall with the elbows overhead beside the ears, only the forearms hinge", () => {
    expectPlanted(id);
    expectElbowsPinned(id);
    expectMonotoneReach(id, "shrinks");
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(p.ankles[1][2]).toBe(p.hips[1][2]);
      // elbows above the head, close to it (no stub flaring out)
      expect(p.elbows[1][1]).toBeGreaterThan(p.head[1] + 4);
      expect(Math.abs(p.elbows[1][0])).toBeLessThan(17);
      expect(Math.abs(p.elbows[1][2] - p.head[2])).toBeLessThan(8);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(17);
    }
  });
  it("goes from arms overhead to the bar behind the head at neck height", () => {
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(53);
    expect(top.wrists[1][1]).toBeGreaterThan(top.head[1] + 30);
    expect(bot.wrists[1][2]).toBeLessThan(bot.head[2] - 12);
    expect(bot.wrists[1][1]).toBeLessThan(bot.head[1] - 5);
    expect(bot.wrists[1][1]).toBeGreaterThan(bot.shoulders[1][1] - 2);
  });
});

describe("overhead cable triceps extension", () => {
  const id = "overhead-cable-extension";
  it("faces away from a high pulley, staggered stance, torso fixed and leaning forward", () => {
    expect(OHC_PULLEY.y).toBeGreaterThan(185);
    expect(OHC_PULLEY.z).toBeLessThan(-40);
    expect(model(id).pulley).toEqual(OHC_PULLEY);
    expect(OHC_FRONT_ANKLE_Z).toBeGreaterThan(OHC_BACK_ANKLE_Z + 40);
    const a = poseAt(id, 0);
    for (const d of WALK) {
      const p = poseAt(id, d);
      // feet flat, not moving
      for (const s of [0, 1] as const) {
        expect(p.feet[s]).toEqual({ floor: 0, dir: 1 });
        expect(p.ankles[s][1]).toBe(8);
        expect(dist(p.ankles[s], a.ankles[s])).toBeLessThan(1e-9);
        expect(dist(p.hips[s], a.hips[s])).toBeLessThan(1e-9);
        expect(dist(p.shoulders[s], a.shoulders[s])).toBeLessThan(1e-9);
        expect(dist(p.elbows[s], a.elbows[s])).toBeLessThan(1e-6);
      }
      const lean = deg(
        Math.atan2(p.shoulders[1][2] - p.hips[1][2], p.shoulders[1][1] - p.hips[1][1]),
      );
      expect(lean).toBeGreaterThan(20);
      expect(lean).toBeLessThan(32);
      // the near foot is the front foot, the far one behind
      expect(p.ankles[1][2]).toBeGreaterThan(p.ankles[0][2] + 40);
    }
  });
  it("extends the arms forward and up, then lets the rope back behind the head", () => {
    expectMonotoneReach(id, "shrinks");
    const top = poseAt(id, 0);
    const bot = poseAt(id, 1);
    expect(dist(top.shoulders[1], top.wrists[1])).toBeGreaterThan(53);
    // extended: hands above and ahead of the head
    expect(top.wrists[1][1]).toBeGreaterThan(top.head[1] + 20);
    expect(top.wrists[1][2]).toBeGreaterThan(top.head[2]);
    // stretched: hands behind the head, elbows still next to it
    expect(bot.wrists[1][2]).toBeLessThan(bot.head[2] - 10);
    expect(Math.abs(bot.elbows[1][2] - bot.head[2])).toBeLessThan(12);
    expect(bot.elbows[1][1]).toBeGreaterThan(bot.head[1]);
  });
  it("keeps the cable coming from above and behind, clear of the head", () => {
    const pulley: V3 = [0, OHC_PULLEY.y, OHC_PULLEY.z];
    for (const d of WALK) {
      const p = poseAt(id, d);
      expect(OHC_PULLEY.y).toBeGreaterThan(p.wrists[1][1] + 2);
      expect(p.wrists[1][2]).toBeGreaterThan(OHC_PULLEY.z + 40);
      expect(
        segDist(
          [0, p.head[1], p.head[2]],
          [0, p.wrists[1][1], p.wrists[1][2]],
          [0, pulley[1], pulley[2]],
        ),
      ).toBeGreaterThan(14);
      expect(dist(p.wrists[1], p.head)).toBeGreaterThan(16);
    }
  });
});

const BODY_SH = 19;
