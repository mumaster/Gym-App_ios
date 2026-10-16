import {
  LPC_PLATE_EDGE,
  LYING_GRIP,
  LYING_HANDLE_Z,
  LYING_PAD_END,
  LYING_PAD_TOP,
  SEATED_HIP_Z,
  SINGLE_SUPPORT,
  THRUST_GUIDE_Z,
  lpcPlateReach,
} from "../../../lib/gym/exerciseAnimationW14";
import {
  LEG_PRESS_HIP,
  LEG_PRESS_TILT,
  THRUST_BENCH_Y,
  THRUST_BENCH_Z,
} from "../../../lib/gym/exerciseAnimation";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W14 (exerciseAnimationW14.ts). */

const padCls = "fill-foreground/30 stroke-none";
const railCls = "stroke-foreground/25";
const SMITH_X = 60;

type Layer = "behind" | "mid" | "over";
type Draw = (c: DrawCtx) => React.ReactNode;

/** Several extras drawn together, layer by layer. */
function merge(...list: FigureExtra[]): FigureExtra {
  const out: FigureExtra = { front: {}, side: {} };
  for (const view of ["front", "side"] as const) {
    for (const layer of ["behind", "mid", "over"] as Layer[]) {
      const fns = list.map((e) => e[view]?.[layer]).filter((f): f is Draw => !!f);
      if (fns.length)
        out[view]![layer] = (c) => (
          <g>
            {fns.map((f, i) => (
              <g key={i}>{f(c)}</g>
            ))}
          </g>
        );
    }
  }
  return out;
}

/* ------------------------------ shared pieces ---------------------------- */

/** A step or plate under the balls of the feet: its rear edge `from` and front
 *  edge `to` are z values (side view); `half` is half its width in the front view. */
const step = (h: number, from: number, to: number, half: number, cx = 0): FigureExtra => ({
  front: {
    behind: ({ p, s }) => (
      <rect
        x={p([cx - half, 0, 0])[0]}
        y={p([0, h, 0])[1]}
        width={s(half * 2)}
        height={s(h)}
        rx={2}
        className={furn}
      />
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <rect
        x={p([0, 0, from])[0]}
        y={p([0, h, 0])[1]}
        width={s(to - from)}
        height={s(h)}
        rx={2}
        className={furn}
      />
    ),
  },
});

/** Smith machine rails: two uprights and a top beam in the front view; one rail
 *  at `z`, a top brace and a short foot in the side view. */
const smithRails = (top: number, z: number, footFrom: number, footTo: number): FigureExtra => ({
  front: {
    behind: ({ p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <g key={sg}>
            <path
              d={line(p([sg * SMITH_X, 0, 0]), p([sg * SMITH_X, top, 0]))}
              className={railCls}
              strokeWidth={s(5)}
            />
            <path
              d={line(p([sg * (SMITH_X - 8), 0, 0]), p([sg * (SMITH_X + 8), 0, 0]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
          </g>
        ))}
        <path
          d={line(p([-SMITH_X, top, 0]), p([SMITH_X, top, 0]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <path d={line(p([0, 0, z]), p([0, top, z]))} className={railCls} strokeWidth={s(5)} />
        <path
          d={line(p([0, top, z]), p([0, top, z - 18]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
        <path
          d={line(p([0, 3, footFrom]), p([0, 3, footTo]))}
          className={furnLine}
          strokeWidth={s(6)}
        />
      </g>
    ),
  },
});

/** A flat bench seen from the side: pad from z0 to z1 with its top at `top`. */
const flatBench = (top: number, z0: number, z1: number, half = 15): FigureExtra => ({
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-half, 0, 0])[0]}
          y={p([0, top, 0])[1]}
          width={s(half * 2)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        <path d={line(p([0, top - 9, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([0, 0, z0])[0]}
          y={p([0, top, 0])[1]}
          width={s(z1 - z0)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        {[z0 + 8, z1 - 8].map((z) => (
          <path
            key={z}
            d={line(p([0, top - 9, z]), p([0, 0, z]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
        ))}
      </g>
    ),
  },
});

/* ------------------------------- lying leg curl -------------------------- */

/** Roller centre: on the back of the shin, 90% of the way to the ankle. */
function lyingRoller(c: DrawCtx) {
  const kn = c.pose.knees[1];
  const an = c.pose.ankles[1];
  const dy = an[1] - kn[1];
  const dz = an[2] - kn[2];
  const l = Math.hypot(dy, dz);
  // Unit normal on the back (calf) side of the shin.
  const ny = -dz / l;
  const nz = dy / l;
  return { y: kn[1] + dy * 0.9 + ny * 6.5, z: kn[2] + dz * 0.9 + nz * 6.5, x: kn[0] };
}

const lyingCurl: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-20, 0, 0])[0]}
          y={p([0, LYING_PAD_TOP, 0])[1]}
          width={s(40)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        <path
          d={line(p([0, LYING_PAD_TOP - 9, 0]), p([0, 0, 0]))}
          className={furnLine}
          strokeWidth={s(8)}
        />
        <path d={line(p([-26, 0, 0]), p([26, 0, 0]))} className={furnLine} strokeWidth={s(4)} />
      </g>
    ),
    mid: (c) => {
      const r = lyingRoller(c);
      return (
        <path
          d={line(c.p([-24, r.y, 0]), c.p([24, r.y, 0]))}
          className="stroke-foreground/30"
          strokeWidth={c.s(7)}
        />
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s, pose } = c;
      const r = lyingRoller(c);
      const kn = pose.knees[1];
      return (
        <g>
          {/* pad under the torso and thighs, ending just behind the knee */}
          <rect
            x={p([0, 0, LYING_PAD_END])[0]}
            y={p([0, LYING_PAD_TOP, 0])[1]}
            width={s(LYING_HANDLE_Z - LYING_PAD_END)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          {[-30, 70].map((z) => (
            <path
              key={z}
              d={line(p([0, LYING_PAD_TOP - 9, z]), p([0, 0, z]))}
              className={furnLine}
              strokeWidth={s(7)}
            />
          ))}
          <path
            d={line(p([0, 3, LYING_PAD_END - 14]), p([0, 3, LYING_HANDLE_Z]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          {/* handles hanging from the pad beside the chest */}
          <path
            d={line(p([0, LYING_PAD_TOP - 9, LYING_GRIP[2]]), p([0, LYING_GRIP[1], LYING_GRIP[2]]))}
            className={furnLine}
            strokeWidth={s(3)}
          />
          {/* pivot post at the end of the pad and the lever to the roller */}
          <path
            d={line(p([0, 0, kn[2] - 8]), p([0, kn[1], kn[2] - 8]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(p([0, kn[1], kn[2] - 8]), p([0, r.y, r.z]))}
            className="stroke-foreground/30"
            strokeWidth={s(3)}
          />
          <circle
            cx={p([0, kn[1], kn[2] - 8])[0]}
            cy={p([0, kn[1], kn[2] - 8])[1]}
            r={s(3)}
            className="fill-foreground/30 stroke-none"
          />
        </g>
      );
    },
    mid: (c) => {
      const r = lyingRoller(c);
      const q = c.p([0, r.y, r.z]);
      return <circle cx={q[0]} cy={q[1]} r={c.s(4.5)} className="fill-foreground/35 stroke-none" />;
    },
  },
};

/* ----------------------------- leg press calf raise ---------------------- */

const lpFrame = (c: DrawCtx) => {
  const gamma = (c.pose.feet[1].angle ?? 90) - LEG_PRESS_TILT;
  const reach = lpcPlateReach(gamma);
  const hp = LEG_PRESS_HIP;
  const t = (LEG_PRESS_TILT * Math.PI) / 180;
  return { gamma, reach, hp, t };
};

const legPressCalf: FigureExtra = {
  front: {
    behind: (c) => {
      const { p, s, pose } = c;
      const { reach, hp, t } = lpFrame(c);
      const yEdge = hp.y + Math.sin(t) * (reach + 2.5) + Math.cos(t) * LPC_PLATE_EDGE;
      const yTop = hp.y + Math.sin(t) * (reach + 2.5) + Math.cos(t) * 40;
      return (
        <g>
          <rect
            x={p([-27, 0, 0])[0]}
            y={p([0, yTop, 0])[1]}
            width={s(54)}
            height={s(yTop - yEdge)}
            rx={5}
            className={furn}
          />
          <rect
            x={p([-16, 0, 0])[0]}
            y={p([0, hp.y + 62, 0])[1]}
            width={s(32)}
            height={s(66)}
            rx={6}
            className={furn}
          />
          <rect
            x={p([-15, 0, 0])[0]}
            y={p([0, pose.hips[1][1] - 4, 0])[1]}
            width={s(30)}
            height={s(7)}
            rx={3}
            className={furn}
          />
        </g>
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      const { reach, hp, t } = lpFrame(c);
      const dir: [number, number] = [Math.sin(t), Math.cos(t)];
      const up: [number, number] = [Math.cos(t), -Math.sin(t)];
      const at = (a: number, b: number) =>
        p([0, hp.y + dir[0] * a + up[0] * b, hp.z + dir[1] * a + up[1] * b]);
      const face = reach + 2.5; // the line is drawn 5 cm thick, so its centre sits behind the face
      return (
        <g>
          {/* back pad and seat */}
          <path
            d={line(
              p([0, hp.y + 2, hp.z - 3]),
              p([0, hp.y + 70 * Math.cos(1.0472), hp.z - 70 * Math.sin(1.0472)]),
            )}
            className="stroke-foreground/15"
            strokeWidth={s(9)}
          />
          <rect
            x={p([0, 0, hp.z - 14])[0]}
            y={p([0, hp.y - 4, 0])[1]}
            width={s(30)}
            height={s(7)}
            rx={3}
            className={furn}
          />
          {/* rails under the legs, the sled and the platform with its lower edge */}
          <path d={line(at(30, -14), at(135, -14))} className={furnLine} strokeWidth={s(6)} />
          <path
            d={line(p([0, hp.y - 4, hp.z]), at(30, -14))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(at(face, LPC_PLATE_EDGE), at(face, 40))}
            className="stroke-foreground/35"
            strokeWidth={s(5)}
          />
          <path
            d={line(at(face, LPC_PLATE_EDGE), at(face, -14))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        </g>
      );
    },
  },
};

/* -------------------------------- seated calf machine -------------------- */

const SEATED_SEAT_TOP = 52; // hip y (60) minus the pad half thickness
const SC_COLUMN_Z = 96;

/** Pad centre on the thigh and its two ends, from the pose. */
function thighPad(c: DrawCtx, from: number, to: number, out: number) {
  const hip = c.pose.hips[1];
  const knee = c.pose.knees[1];
  const dy = knee[1] - hip[1];
  const dz = knee[2] - hip[2];
  const l = Math.hypot(dy, dz);
  const at = (along: number): [number, number] => [
    hip[1] + dy * along + (dz / l) * out,
    hip[2] + dz * along - (dy / l) * out,
  ];
  return { a: at(from), b: at(to), c: at((from + to) / 2) };
}

const seatedMachine: FigureExtra = merge(step(10, 44, 90, 30), {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-19, 0, 0])[0]}
          y={p([0, SEATED_SEAT_TOP, 0])[1]}
          width={s(38)}
          height={s(8)}
          rx={4}
          className={furn}
        />
        <path
          d={line(p([0, SEATED_SEAT_TOP, 0]), p([0, 0, 0]))}
          className={furnLine}
          strokeWidth={s(8)}
        />
      </g>
    ),
    mid: (c) => {
      const { a, b } = thighPad(c, 0.74, 0.98, 8);
      void b;
      return (
        <g>
          <rect
            x={c.p([-30, 0, 0])[0]}
            y={c.p([0, a[0] + 4, 0])[1]}
            width={c.s(60)}
            height={c.s(9)}
            rx={4}
            className={padCls}
          />
          <path
            d={line(c.p([0, a[0] + 4, 0]), c.p([0, a[0] + 28, 0]))}
            className="stroke-foreground/30"
            strokeWidth={c.s(4)}
          />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        {/* seat on a stem, floor rail, front column with the lever pivot and weight stack */}
        <rect
          x={p([0, 0, SEATED_HIP_Z - 18])[0]}
          y={p([0, SEATED_SEAT_TOP, 0])[1]}
          width={s(40)}
          height={s(8)}
          rx={4}
          className={furn}
        />
        <path
          d={line(p([0, SEATED_SEAT_TOP, SEATED_HIP_Z]), p([0, 0, SEATED_HIP_Z]))}
          className={furnLine}
          strokeWidth={s(8)}
        />
        <path
          d={line(p([0, 3, SEATED_HIP_Z - 20]), p([0, 3, SC_COLUMN_Z + 20]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
        <path
          d={line(p([0, 0, SC_COLUMN_Z]), p([0, 96, SC_COLUMN_Z]))}
          className={furnLine}
          strokeWidth={s(7)}
        />
        <rect
          x={p([0, 0, SC_COLUMN_Z + 6])[0]}
          y={p([0, 70, 0])[1]}
          width={s(16)}
          height={s(60)}
          rx={3}
          className={furn}
        />
      </g>
    ),
    mid: (c) => {
      const { a, b, c: m } = thighPad(c, 0.74, 0.98, 8);
      const A = c.p([0, a[0], a[1]]);
      const B = c.p([0, b[0], b[1]]);
      const M = c.p([0, m[0], m[1]]);
      const P = c.p([0, 92, SC_COLUMN_Z]);
      return (
        <g>
          <path d={line(M, P)} className="stroke-foreground/30" strokeWidth={c.s(3)} />
          <path d={line(A, B)} className="stroke-foreground/45" strokeWidth={c.s(8)} />
          <circle cx={P[0]} cy={P[1]} r={c.s(3.5)} className="fill-foreground/30 stroke-none" />
        </g>
      );
    },
  },
});

/* ------------------------- single-leg calf raise on a step --------------- */

const SINGLE_STEP = 14;
const singleUpright: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <path
          d={line(p([SINGLE_SUPPORT.x, 0, 0]), p([SINGLE_SUPPORT.x, SINGLE_SUPPORT.top, 0]))}
          className={railCls}
          strokeWidth={s(6)}
        />
        <path
          d={line(p([SINGLE_SUPPORT.x - 14, 1.5, 0]), p([SINGLE_SUPPORT.x + 14, 1.5, 0]))}
          className={railCls}
          strokeWidth={s(3)}
        />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <path
        d={line(p([0, 0, SINGLE_SUPPORT.z]), p([0, SINGLE_SUPPORT.top, SINGLE_SUPPORT.z]))}
        className={railCls}
        strokeWidth={s(6)}
      />
    ),
  },
};
const singleStep: FigureExtra = merge(step(SINGLE_STEP, 4, 44, 24, 8), singleUpright);

/* --------------------------- seated dumbbell calf raise ------------------ */

const BENCH_TOP = 48;
const seatedDb: FigureExtra = merge(
  flatBench(BENCH_TOP, SEATED_HIP_Z - 92, SEATED_HIP_Z + 18),
  step(6, 44, 78, 28),
);

/* ---------------------------- Smith seated calf raise -------------------- */

const smithSeated: FigureExtra = merge(
  flatBench(BENCH_TOP, SEATED_HIP_Z - 92, SEATED_HIP_Z + 18),
  step(6, 44, 78, 28),
  smithRails(140, SEATED_HIP_Z + 30, SEATED_HIP_Z + 30 - 12, SEATED_HIP_Z + 30 + 12),
  {
    // The padded stretch of the bar that lies across the thighs.
    front: {
      mid: ({ pose, p, s }) => (
        <rect
          x={p([-26, 0, 0])[0]}
          y={p([0, pose.bar[1] + 2.5, 0])[1]}
          width={s(52)}
          height={s(5)}
          rx={2.5}
          className="fill-foreground/40 stroke-none"
        />
      ),
    },
    side: {
      mid: ({ pose, p, s }) => {
        const q = p(pose.bar);
        return <circle cx={q[0]} cy={q[1]} r={s(3.6)} className="fill-foreground/40 stroke-none" />;
      },
    },
  },
);

/* ----------------------------- Smith standing calf ----------------------- */

const smithCalf: FigureExtra = merge(smithRails(200, -6, -34, -16), step(7, 4, 36, 30));

/* -------------------------------- hip thrusts ---------------------------- */

const thrustBench: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-15, 0, 0])[0]}
          y={p([0, THRUST_BENCH_Y, 0])[1]}
          width={s(30)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        <path
          d={line(p([0, THRUST_BENCH_Y - 9, 0]), p([0, 0, 0]))}
          className={furnLine}
          strokeWidth={s(8)}
        />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([0, 0, THRUST_BENCH_Z.from])[0]}
          y={p([0, THRUST_BENCH_Y, 0])[1]}
          width={s(THRUST_BENCH_Z.to - THRUST_BENCH_Z.from)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        {[THRUST_BENCH_Z.from + 4, THRUST_BENCH_Z.to - 4].map((z) => (
          <path
            key={z}
            d={line(p([0, THRUST_BENCH_Y - 9, z]), p([0, 0, z]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
        ))}
      </g>
    ),
  },
};

/** Machine hip thrust: the bench pad plus a guide column that the belt carriage runs on. */
const thrustMachineFrame: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <g key={sg}>
            <path
              d={line(p([sg * 52, 0, 0]), p([sg * 52, 110, 0]))}
              className={railCls}
              strokeWidth={s(5)}
            />
            <path
              d={line(p([sg * 44, 0, 0]), p([sg * 60, 0, 0]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
          </g>
        ))}
        <path d={line(p([-52, 110, 0]), p([52, 110, 0]))} className={furnLine} strokeWidth={s(5)} />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <path
          d={line(p([0, 0, THRUST_GUIDE_Z]), p([0, 110, THRUST_GUIDE_Z]))}
          className={railCls}
          strokeWidth={s(5)}
        />
        <path
          d={line(p([0, 3, THRUST_GUIDE_Z - 26]), p([0, 3, THRUST_GUIDE_Z + 20]))}
          className={furnLine}
          strokeWidth={s(6)}
        />
      </g>
    ),
  },
};

const thrustMachine = merge(thrustBench, thrustMachineFrame);
const smithThrust = merge(
  thrustBench,
  smithRails(125, THRUST_GUIDE_Z, THRUST_GUIDE_Z - 26, THRUST_GUIDE_Z + 20),
);

/** The padded belt that rests over the hips, its side arms to the carriage rails
 *  and the plates loaded on the carriage. */
const thrustBelt: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const bar = p(pose.bar);
      return (
        <g>
          <path
            d={line([bar[0] - s(52), bar[1]], [bar[0] + s(52), bar[1]])}
            className="stroke-foreground/50"
            strokeWidth={2}
          />
          <rect
            x={bar[0] - s(23)}
            y={bar[1] - s(5)}
            width={s(46)}
            height={s(10)}
            rx={s(4)}
            className="fill-foreground/40 stroke-foreground/60"
            strokeWidth={1.5}
          />
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <rect
                x={bar[0] + sg * s(52) - s(3.5)}
                y={bar[1] - s(6)}
                width={s(7)}
                height={s(12)}
                rx={2}
                className="fill-foreground/60 stroke-none"
              />
              <rect
                x={bar[0] + sg * s(60) - s(3)}
                y={bar[1] - s(18)}
                width={s(6)}
                height={s(36)}
                rx={3}
                className="fill-primary stroke-none"
              />
            </g>
          ))}
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const bar = p(pose.bar);
      return (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1]}
            r={s(18)}
            className="fill-primary/12 stroke-primary"
            strokeWidth={2}
          />
          <circle
            cx={bar[0]}
            cy={bar[1]}
            r={s(5)}
            className="fill-foreground/40 stroke-foreground/60"
            strokeWidth={1.5}
          />
        </g>
      );
    },
  },
};

export const EXTRAS_W14: Record<string, FigureExtra> = {
  "w14-lying-curl": lyingCurl,
  "w14-lp-calf": legPressCalf,
  "w14-seated-calf": seatedMachine,
  "w14-single-step": singleStep,
  "w14-seated-db": seatedDb,
  "w14-smith-seated": smithSeated,
  "w14-smith-calf": smithCalf,
  "w14-thrust-machine": thrustMachine,
  "w14-smith-thrust": smithThrust,
  "w14-thrust-belt": thrustBelt,
};
