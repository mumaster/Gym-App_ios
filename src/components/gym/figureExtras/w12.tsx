import {
  CABLE_CURL_PULLEY,
  OHC_PULLEY,
  PAD_HALF,
  PAD_OFFSET,
} from "../../../lib/gym/exerciseAnimationW12";
import type { FigurePose } from "../../../lib/gym/exerciseAnimation";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line, poly } from "../figureDraw";

/** Furniture and implements for animation batch W12 (exerciseAnimationW12.ts). */

const pulleyFill = "fill-foreground/30 stroke-none";
const cableCls = "stroke-foreground/50";
const dot = "fill-foreground stroke-none";

/* -------------------------------------------------------------------- */
/* EZ bar and plated bars                                                */
/* -------------------------------------------------------------------- */

interface BarLook {
  /** Half the bar length and where the plates sit (cm). */
  half: number;
  plateX: number;
  plateR: number;
  /** Draw the EZ zig-zag between the hands. */
  zigzag: boolean;
  /** Overhand grip: knuckles on top of the bar. */
  overhand?: boolean;
  /** Draw the bar behind the body in the front view (it passes behind the head). */
  behind?: boolean;
}

/** Half-pattern of the EZ bar from the outer straight part inwards: x offsets
 *  from the grip centre and the sideways kink (cm). The hands sit on the
 *  angled sections, which zig-zag in and out of the line of the bar. */
const ZIG: [number, number][] = [
  [14, 0],
  [5.5, -3],
  [-5.5, 3],
];

const plateBar = (look: BarLook): FigureExtra => ({
  front: {
    [look.behind ? "behind" : "over"]: ({ pose, p, s }: DrawCtx) => {
      const bar = p(pose.bar);
      const g = Math.abs(pose.wrists[1][0]);
      const pts: [number, number][] = [];
      if (look.zigzag) {
        // right half from the outside in, then the mirrored left half
        const right: [number, number][] = [
          [look.half, 0],
          ...ZIG.map(([dx, dy]): [number, number] => [g + dx, dy]),
        ];
        const left = [...right].reverse().map(([x, y]): [number, number] => [-x, y]);
        pts.push(...right, ...left);
      } else {
        pts.push([look.half, 0], [-look.half, 0]);
      }
      const d = `M${pts.map(([x, y]) => `${(bar[0] + s(x)).toFixed(1)},${(bar[1] - s(y)).toFixed(1)}`).join("L")}`;
      return (
        <g>
          <path
            d={d}
            className="stroke-foreground"
            strokeWidth={3}
            fill="none"
            strokeLinejoin="round"
          />
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={bar[0] + sg * s(look.plateX) - s(3)}
              y={bar[1] - s(look.plateR)}
              width={s(6)}
              height={s(look.plateR * 2)}
              rx={3}
              className="fill-primary stroke-none"
            />
          ))}
          {look.overhand &&
            [-1, 1].map((sg) => (
              <rect
                key={sg}
                x={bar[0] + sg * s(g) - s(4.5)}
                y={bar[1] - s(7)}
                width={s(9)}
                height={s(5)}
                rx={s(2.5)}
                className="fill-primary/45 stroke-primary"
                strokeWidth={1.5}
              />
            ))}
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }: DrawCtx) => {
      const bar = p(pose.bar);
      return (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1]}
            r={s(look.plateR)}
            className="fill-primary/12 stroke-primary"
            strokeWidth={2}
          />
          <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
});

/* -------------------------------------------------------------------- */
/* Preacher bench and machine                                            */
/* -------------------------------------------------------------------- */

type ZY = [number, number];
/** The pad as seen from the side: along-pad and normal unit vectors (z, y),
 *  the top end `a` (armpit), the bottom end `b` and the arm length. The pad
 *  follows the upper arm, which lies on it. */
function padGeom(pose: FigurePose) {
  const S = pose.shoulders[1];
  const E = pose.elbows[1];
  const dz = E[2] - S[2];
  const dy = E[1] - S[1];
  const l = Math.hypot(dz, dy);
  const u: ZY = [dz / l, dy / l];
  const n: ZY = [-u[1], u[0]];
  const a: ZY = [S[2] - PAD_OFFSET * n[0], S[1] - PAD_OFFSET * n[1]];
  const b: ZY = [a[0] + u[0] * (l + 5), a[1] + u[1] * (l + 5)];
  return { u, n, a, b, l };
}

const seatSide = ({ pose, p, s }: DrawCtx) => {
  const hip = pose.hips[1];
  const top = hip[1] - 8;
  const g = padGeom(pose);
  // The pad's support: a strut from its underside down to the base rail.
  const q: ZY = [
    g.a[0] + g.u[0] * g.l * 0.7 - g.n[0] * PAD_HALF,
    g.a[1] + g.u[1] * g.l * 0.7 - g.n[1] * PAD_HALF,
  ];
  return (
    <g>
      <rect
        x={p([0, 0, hip[2] - 14])[0]}
        y={p([0, top, 0])[1]}
        width={s(46)}
        height={s(8)}
        rx={4}
        className={furn}
      />
      <path
        d={line(p([0, top - 8, hip[2] + 8]), p([0, 3, hip[2] + 8]))}
        className={furnLine}
        strokeWidth={s(8)}
      />
      <path
        d={line(p([0, 3, hip[2] - 14]), p([0, 3, q[0] + 16]))}
        className={furnLine}
        strokeWidth={s(6)}
      />
      <path
        d={line(p([0, q[1], q[0]]), p([0, 3, q[0] - 6]))}
        className={furnLine}
        strokeWidth={s(6)}
      />
    </g>
  );
};

const seatFront = ({ pose, p, s }: DrawCtx) => {
  const hip = pose.hips[1];
  const top = hip[1] - 8;
  return (
    <g>
      <rect
        x={p([-19, 0, 0])[0]}
        y={p([0, top, 0])[1]}
        width={s(38)}
        height={s(8)}
        rx={4}
        className={furn}
      />
      <path d={line(p([0, top - 8, 0]), p([0, 3, 0]))} className={furnLine} strokeWidth={s(8)} />
      <path d={line(p([-24, 3, 0]), p([24, 3, 0]))} className={furnLine} strokeWidth={s(6)} />
    </g>
  );
};

const padSide = ({ pose, p, s }: DrawCtx) => {
  const g = padGeom(pose);
  const h = PAD_HALF;
  const at = (c: ZY, along: number, across: number) =>
    p([0, c[1] + g.u[1] * along + g.n[1] * across, c[0] + g.u[0] * along + g.n[0] * across]);
  const top = at(g.a, -3, h);
  const bot = at(g.b, 0, h);
  return (
    <g>
      {/* the sloping pad: a padded slab from the armpits down to just past the elbows */}
      <path
        d={`${poly(at(g.a, -3, h), at(g.b, 0, h), at(g.b, 0, -h), at(g.a, -3, -h))}Z`}
        className="fill-foreground/30 stroke-foreground/60"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <path d={line(top, bot)} className="stroke-foreground/90" strokeWidth={s(0.8)} />
    </g>
  );
};

const padFront = ({ pose, p, s }: DrawCtx) => {
  const g = padGeom(pose);
  const topY = g.a[1] + g.n[1] * PAD_HALF;
  const botY = g.b[1] + g.n[1] * PAD_HALF;
  return (
    <rect
      x={p([-20, 0, 0])[0]}
      y={p([0, topY, 0])[1]}
      width={s(40)}
      height={s(topY - botY)}
      rx={6}
      className="fill-foreground/35 stroke-foreground/60"
      strokeWidth={1.2}
    />
  );
};

const preacher: FigureExtra = {
  front: { behind: seatFront, mid: padFront },
  side: { behind: seatSide, mid: padSide },
};

/** Machine body: a housing under the lower end of the pad, up to the pivot. */
const machineSide = ({ pose, p, s }: DrawCtx) => {
  const g = padGeom(pose);
  const top = g.b[1] - g.n[1] * PAD_HALF - 1;
  return (
    <g>
      <rect
        x={p([0, 0, g.b[0] - 16])[0]}
        y={p([0, top, 0])[1]}
        width={s(24)}
        height={s(top)}
        rx={5}
        className={furn}
      />
      <path
        d={line(p([0, 3, g.b[0] - 20]), p([0, 3, g.b[0] + 22]))}
        className={furnLine}
        strokeWidth={s(6)}
      />
    </g>
  );
};

const preacherMachine: FigureExtra = {
  front: { behind: seatFront, mid: padFront },
  side: {
    behind: (c) => (
      <g>
        {seatSide(c)}
        {machineSide(c)}
      </g>
    ),
    mid: padSide,
  },
};

/** The lever and handles of the machine: a pivot ring at the elbow axis, the
 *  lever along the forearm out to the grips. */
const preacherLever: FigureExtra = {
  front: {
    mid: ({ pose, p, s }) => (
      <g>
        {[0, 1].map((i) => {
          const sg = i === 0 ? -1 : 1;
          const e = pose.elbows[i]!;
          const piv = p([sg * (Math.abs(e[0]) + 14), e[1], 0]);
          const w = p(pose.wrists[i]!);
          return (
            <g key={i}>
              <path d={line(piv, w)} className="stroke-foreground/45" strokeWidth={s(3.5)} />
              <circle
                cx={piv[0]}
                cy={piv[1]}
                r={s(5)}
                className="fill-foreground/25 stroke-foreground/45"
                strokeWidth={1.5}
              />
            </g>
          );
        })}
      </g>
    ),
    over: ({ pose, p, s }) => (
      <g>
        {[0, 1].map((i) => {
          const w = p(pose.wrists[i]!);
          return (
            <path
              key={i}
              d={line([w[0] - s(6), w[1]], [w[0] + s(6), w[1]])}
              className="stroke-foreground"
              strokeWidth={3}
            />
          );
        })}
      </g>
    ),
  },
  side: {
    over: ({ pose, p, s }) => {
      const E = pose.elbows[1];
      const W = pose.wrists[1];
      const e = p(E);
      const w = p(W);
      const dx = w[0] - e[0];
      const dy = w[1] - e[1];
      const l = Math.hypot(dx, dy) || 1;
      const end: [number, number] = [w[0] + (dx / l) * s(4), w[1] + (dy / l) * s(4)];
      return (
        <g>
          <path d={line(e, end)} className="stroke-foreground/70" strokeWidth={s(2.5)} />
          <circle
            cx={e[0]}
            cy={e[1]}
            r={s(5.5)}
            className="fill-foreground/20 stroke-foreground/70"
            strokeWidth={1.5}
          />
          <circle cx={w[0]} cy={w[1]} r={4} className={dot} />
        </g>
      );
    },
  },
};

/* -------------------------------------------------------------------- */
/* Cable curl: low pulley in front of the lifter                         */
/* -------------------------------------------------------------------- */

const lowTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <path d={line(p([-26, 2, 0]), p([26, 2, 0]))} className={furnLine} strokeWidth={s(4)} />
    ),
  },
  side: {
    behind: ({ p, s }) => {
      const t = CABLE_CURL_PULLEY;
      return (
        <g>
          <path
            d={line(p([0, 2, t.z - 8]), p([0, 2, t.z + 38]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([0, 0, t.z + 16]), p([0, 170, t.z + 16]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <rect
            x={p([0, 0, t.z + 8])[0]}
            y={p([0, t.y + 12, 0])[1]}
            width={s(16)}
            height={s(24)}
            rx={4}
            className={furn}
          />
          <path
            d={line(p([0, t.y, t.z]), p([0, t.y, t.z + 16]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <circle
            cx={p([0, t.y, t.z])[0]}
            cy={p([0, t.y, t.z])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
};

const cableBar: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const t = CABLE_CURL_PULLEY;
      const mid = p([0, pose.bar[1], 0]);
      return (
        <g>
          <path d={line(mid, p([0, t.y, 0]))} className={cableCls} strokeWidth={1.5} />
          <circle cx={p([0, t.y, 0])[0]} cy={p([0, t.y, 0])[1]} r={s(5)} className={pulleyFill} />
          <path
            d={line([wl[0] - s(9), wl[1]], [wr[0] + s(9), wr[1]])}
            className="stroke-foreground"
            strokeWidth={3}
          />
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p }) => {
      const t = CABLE_CURL_PULLEY;
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(w, p([0, t.y, t.z]))} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={4} className={dot} />
        </g>
      );
    },
  },
};

/* -------------------------------------------------------------------- */
/* Overhead cable extension: high pulley behind the lifter               */
/* -------------------------------------------------------------------- */

const ohTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const t = OHC_PULLEY;
      return (
        <g>
          <rect
            x={p([-9, 0, 0])[0]}
            y={p([0, t.y + 8, 0])[1]}
            width={s(18)}
            height={s(18)}
            rx={4}
            className={furn}
          />
          <circle cx={p([0, t.y, 0])[0]} cy={p([0, t.y, 0])[1]} r={s(5)} className={pulleyFill} />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => {
      const t = OHC_PULLEY;
      return (
        <g>
          <path
            d={line(p([0, 2, t.z - 40]), p([0, 2, t.z + 12]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([0, 0, t.z - 14]), p([0, t.y + 8, t.z - 14]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <path
            d={line(p([0, t.y + 8, t.z - 14]), p([0, t.y + 8, t.z]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <circle
            cx={p([0, t.y, t.z])[0]}
            cy={p([0, t.y, t.z])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
};

const ohRope: FigureExtra = {
  front: {
    behind: ({ pose, p }) => {
      const t = OHC_PULLEY;
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const top = p([0, t.y, 0]);
      return <path d={poly(wl, top, wr)} className={cableCls} strokeWidth={1.5} fill="none" />;
    },
    over: ({ pose, p, s }) => (
      <g>
        {[0, 1].map((i) => {
          const w = p(pose.wrists[i]!);
          return <circle key={i} cx={w[0]} cy={w[1]} r={s(3)} className={dot} />;
        })}
      </g>
    ),
  },
  side: {
    over: ({ pose, p, s }) => {
      const t = OHC_PULLEY;
      const w = p(pose.wrists[1]);
      const top = p([0, t.y, t.z]);
      const dx = w[0] - top[0];
      const dy = w[1] - top[1];
      const l = Math.hypot(dx, dy) || 1;
      // The rope ends continue a little past the hands along the cable.
      const end: [number, number] = [w[0] + (dx / l) * s(7), w[1] + (dy / l) * s(7)];
      return (
        <g>
          <path d={line(top, w)} className={cableCls} strokeWidth={1.5} />
          <path d={line(w, end)} className="stroke-foreground" strokeWidth={3} />
          <circle cx={w[0]} cy={w[1]} r={4} className={dot} />
        </g>
      );
    },
  },
};

export const EXTRAS_W12: Record<string, FigureExtra> = {
  // EZ bar: zig-zag between the hands, small plates (the curl and preacher
  // versions use 15 cm plates, the versions near the head 10 cm).
  "w12-ez-bar": plateBar({ half: 56, plateX: 44, plateR: 15, zigzag: true }),
  "w12-ez-bar-over": plateBar({ half: 56, plateX: 44, plateR: 15, zigzag: true, overhand: true }),
  "w12-ez-bar-small": plateBar({ half: 56, plateX: 44, plateR: 10, zigzag: true }),
  // Overhead extension: the bar passes behind the head and neck.
  "w12-ez-bar-behind": plateBar({
    half: 56,
    plateX: 44,
    plateR: 10,
    zigzag: true,
    behind: true,
  }),
  // Straight barbell with 15 cm plates for the preacher curl.
  "w12-barbell": plateBar({ half: 75, plateX: 48, plateR: 15, zigzag: false }),
  "w12-preacher": preacher,
  "w12-preacher-machine": preacherMachine,
  "w12-preacher-lever": preacherLever,
  "w12-low-tower": lowTower,
  "w12-cable-bar": cableBar,
  "w12-oh-tower": ohTower,
  "w12-oh-rope": ohRope,
};
