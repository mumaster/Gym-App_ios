import { PULLOVER_BENCH_Z, PULLOVER_DB } from "../../../lib/gym/exerciseAnimationW9";
import { ROW_BENCH_Y, cos, sin, type V3 } from "../../../lib/gym/exerciseAnimation";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W9 (exerciseAnimationW9.ts). */

const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const along = (c: V3, a: V3, k: number): V3 => [c[0] + a[0] * k, c[1] + a[1] * k, c[2] + a[2] * k];

/** A dumbbell as two discs on a handle, centred at `c` with its axis `a` (a
 *  unit vector in cm space). The discs are drawn as ellipses: round when the
 *  axis points at the viewer, thin slabs when it lies across the view. */
function Dumbbell({
  ctx,
  view,
  c,
  a,
  half = 8,
}: {
  ctx: DrawCtx;
  view: "front" | "side";
  c: V3;
  a: V3;
  half?: number;
}) {
  const { p, s } = ctx;
  const v: V3 = view === "front" ? [0, 0, 1] : [1, 0, 0];
  const cv = Math.min(1, Math.abs(a[0] * v[0] + a[1] * v[1] + a[2] * v[2]));
  const e1 = p(along(c, a, -half));
  const e2 = p(along(c, a, half));
  const ang = (Math.atan2(e2[1] - e1[1], e2[0] - e1[0]) * 180) / Math.PI;
  const rx = s(6.5) * cv + s(1.8) * Math.sqrt(1 - cv * cv);
  const m = p(c);
  return (
    <g>
      <path d={line(e1, e2)} className="stroke-foreground" strokeWidth={3} />
      {[e1, e2].map((q, i) => (
        <ellipse
          key={i}
          cx={q[0]}
          cy={q[1]}
          rx={rx}
          ry={s(6.5)}
          transform={`rotate(${ang} ${q[0]} ${q[1]})`}
          className="fill-primary/50 stroke-primary"
          strokeWidth={1.5}
        />
      ))}
      <circle cx={m[0]} cy={m[1]} r={2} className="fill-foreground stroke-none" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Benches                                                             */
/* ------------------------------------------------------------------ */

/** Pad centre line of an incline bench whose back is `back` degrees from
 *  vertical, like the shared 45 degree bench: it starts 12.7 cm behind the
 *  hip and runs 82 cm up the back. */
function pad(back: number): { from: [number, number]; to: [number, number] } {
  const from: [number, number] = [50 - 12.7 * sin(back), -12.7 * cos(back)];
  return { from, to: [from[0] + 82 * cos(back), from[1] - 82 * sin(back)] };
}

/** The shared incline bench drawn at another angle (pad from the seat up). */
function inclineBench(back: number): FigureExtra {
  const { from, to } = pad(back);
  return {
    side: {
      behind: ({ p, s }) => (
        <g>
          <path
            d={line(p([0, from[0], from[1]]), p([0, to[0], to[1]]))}
            className="stroke-foreground/15"
            strokeWidth={s(9)}
          />
          <rect
            x={p([0, 0, -14])[0]}
            y={p([0, 42, 0])[1]}
            width={s(50)}
            height={s(7)}
            rx={3}
            className={furn}
          />
          <path d={line(p([0, 42, 8]), p([0, 0, 8]))} className={furnLine} strokeWidth={s(7)} />
          <path d={line(p([0, 3, -30]), p([0, 3, 40]))} className={furnLine} strokeWidth={s(6)} />
        </g>
      ),
    },
    front: {
      behind: ({ p, s }) => {
        const top = to[0] + 5;
        return (
          <g>
            <rect
              x={p([-16, 0, 0])[0]}
              y={p([0, top, 0])[1]}
              width={s(32)}
              height={s(top - 41)}
              rx={6}
              className={furn}
            />
            <rect
              x={p([-18, 0, 0])[0]}
              y={p([0, 44, 0])[1]}
              width={s(36)}
              height={s(8)}
              rx={4}
              className={furn}
            />
            <path d={line(p([0, 44, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
          </g>
        );
      },
    },
  };
}

/** Face-down incline bench for the chest-supported row: a 45 degree pad on
 *  a front and a rear post, no seat in the way of the legs. */
const PRONE = pad(45);
const proneBench: FigureExtra = {
  side: {
    behind: ({ p, s }) => {
      const at = (k: number): [number, number] => [
        PRONE.from[0] + k * cos(45),
        PRONE.from[1] - k * sin(45),
      ];
      const front = at(4);
      const rear = at(70);
      return (
        <g>
          <path
            d={line(p([0, PRONE.from[0], PRONE.from[1]]), p([0, PRONE.to[0], PRONE.to[1]]))}
            className="stroke-foreground/15"
            strokeWidth={s(9)}
          />
          <path
            d={line(p([0, front[0] - 4, front[1]]), p([0, 0, front[1]]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, rear[0] - 4, rear[1]]), p([0, 0, rear[1]]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, 3, rear[1] - 14]), p([0, 3, 6]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
  },
  front: {
    behind: ({ p, s }) => {
      const top = PRONE.to[0] + 5;
      return (
        <g>
          <rect
            x={p([-16, 0, 0])[0]}
            y={p([0, top, 0])[1]}
            width={s(32)}
            height={s(top - 41)}
            rx={6}
            className={furn}
          />
          <path d={line(p([0, 41, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
          <path d={line(p([-26, 3, 0]), p([26, 3, 0]))} className={furnLine} strokeWidth={s(6)} />
        </g>
      );
    },
  },
};

/** Flat bench used crosswise for the pullover: only the upper back rests on
 *  it, so the side view shows its cross-section and the front view its length. */
const crossBench: FigureExtra = {
  side: {
    behind: ({ p, s }) => {
      const mz = (PULLOVER_BENCH_Z.from + PULLOVER_BENCH_Z.to) / 2;
      return (
        <g>
          <rect
            x={p([0, 0, PULLOVER_BENCH_Z.from])[0]}
            y={p([0, ROW_BENCH_Y, 0])[1]}
            width={s(PULLOVER_BENCH_Z.to - PULLOVER_BENCH_Z.from)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          <path
            d={line(p([0, ROW_BENCH_Y - 9, mz]), p([0, 0, mz]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, 3, mz - 14]), p([0, 3, mz + 14]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
  },
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-46, 0, 0])[0]}
          y={p([0, ROW_BENCH_Y, 0])[1]}
          width={s(92)}
          height={s(9)}
          rx={4}
          className={furn}
        />
        {[-36, 36].map((x) => (
          <path
            key={x}
            d={line(p([x, ROW_BENCH_Y - 9, 0]), p([x, 0, 0]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
        ))}
      </g>
    ),
  },
};

/* ------------------------------------------------------------------ */
/* Implements                                                          */
/* ------------------------------------------------------------------ */

const pulloverAxis = (c: DrawCtx): V3 =>
  unit([
    mid(c.pose.wrists[0], c.pose.wrists[1])[0] - mid(c.pose.elbows[0], c.pose.elbows[1])[0],
    mid(c.pose.wrists[0], c.pose.wrists[1])[1] - mid(c.pose.elbows[0], c.pose.elbows[1])[1],
    mid(c.pose.wrists[0], c.pose.wrists[1])[2] - mid(c.pose.elbows[0], c.pose.elbows[1])[2],
  ]);

/** One dumbbell held upright in both hands, along the forearms. */
const pulloverDb = (view: "front" | "side") => (c: DrawCtx) => (
  <Dumbbell ctx={c} view={view} c={c.pose.bar} a={pulloverAxis(c)} half={PULLOVER_DB.half} />
);

/** The Zottman dumbbells: `pose.bar[0]` is how far the grip is turned toward
 *  neutral (0 = palms up or down, 1 = palms facing). */
const zottman = (view: "front" | "side") => (c: DrawCtx) => {
  const n = c.pose.bar[0];
  return (
    <g>
      {([0, 1] as const).map((i) => {
        const w = c.pose.wrists[i];
        const el = c.pose.elbows[i];
        const f = unit([w[0] - el[0], w[1] - el[1], w[2] - el[2]]);
        const neutral = unit([0, -f[2], f[1]]);
        const a = unit([1 - n + n * neutral[0], n * neutral[1], n * neutral[2]]);
        return <Dumbbell key={i} ctx={c} view={view} c={w} a={a} half={9} />;
      })}
    </g>
  );
};

export const EXTRAS_W9: Record<string, FigureExtra> = {
  "w9-incline-30": inclineBench(60),
  "w9-prone-bench": proneBench,
  "w9-cross-bench": crossBench,
  "w9-pullover-db": {
    front: { over: pulloverDb("front") },
    side: { over: pulloverDb("side") },
  },
  "w9-zottman": {
    front: { over: zottman("front") },
    side: { over: zottman("side") },
  },
};
