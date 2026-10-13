import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";
import {
  CROSS_TOWER_X,
  LATERAL_TOWER,
  MROW_HIP,
  PEC_HIP,
  ROW_PLATFORM_Y,
} from "../../../lib/gym/exerciseAnimationW4";

/** Furniture and implements for animation batch W4 (exerciseAnimationW4.ts). */

const pulleyFill = "fill-foreground/30 stroke-none";
const cableCls = "stroke-foreground/50";
const gripCls = "stroke-foreground";

/** Side-view point at distance `a` along the torso (hip -> shoulder) and `b` in
 *  front of it, in cm. */
function alongTorso(c: DrawCtx, a: number, b: number) {
  const h = c.pose.hips[1];
  const sh = c.pose.shoulders[1];
  const dy = sh[1] - h[1];
  const dz = sh[2] - h[2];
  const l = Math.hypot(dy, dz);
  const uy = dy / l;
  const uz = dz / l;
  return c.p([0, h[1] + a * uy - b * uz, h[2] + a * uz + b * uy]);
}

/* ---------------------------- seated cable row --------------------------- */

const rowSeat: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-26, 0, 0])[0]}
          y={p([0, ROW_PLATFORM_Y, 0])[1]}
          width={s(52)}
          height={s(ROW_PLATFORM_Y)}
          rx={4}
          className={furn}
        />
        <rect
          x={p([-19, 0, 0])[0]}
          y={p([0, 43, 0])[1]}
          width={s(38)}
          height={s(8)}
          rx={4}
          className={furn}
        />
        <path d={line(p([0, 35, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
      </g>
    ),
  },
  side: {
    behind: ({ model, p, s }) => {
      const pu = model.pulley!;
      return (
        <g>
          {/* floor rail from the seat to the pulley, seat, foot platform and its plate */}
          <path
            d={line(p([0, 3, -24]), p([0, 3, pu.z + 8]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <rect
            x={p([0, 0, -22])[0]}
            y={p([0, 43, 0])[1]}
            width={s(38)}
            height={s(8)}
            rx={4}
            className={furn}
          />
          <path d={line(p([0, 35, -6]), p([0, 0, -6]))} className={furnLine} strokeWidth={s(8)} />
          <rect
            x={p([0, 0, 56])[0]}
            y={p([0, ROW_PLATFORM_Y, 0])[1]}
            width={s(48)}
            height={s(ROW_PLATFORM_Y)}
            rx={4}
            className={furn}
          />
          <path
            d={line(p([0, 20, 102]), p([0, 50, 110]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(p([0, 0, pu.z + 8]), p([0, pu.y + 14, pu.z + 8]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([0, pu.y, pu.z])[0]}
            cy={p([0, pu.y, pu.z])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
};

/* -------------------------------- face pull ------------------------------ */

const rope: FigureExtra = {
  front: {
    over: ({ model, pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const top = p([0, model.pulley!.y, 0]);
      const knot: [number, number] = [(wl[0] + wr[0]) / 2, (wl[1] + wr[1]) / 2 - s(6)];
      return (
        <g>
          <path d={line(top, knot)} className={cableCls} strokeWidth={1.5} />
          <path d={`${line(knot, wl)}${line(knot, wr)}`} className={gripCls} strokeWidth={2.5} />
          {[wl, wr].map((w, i) => (
            <circle key={i} cx={w[0]} cy={w[1]} r={s(3)} className="fill-foreground stroke-none" />
          ))}
        </g>
      );
    },
  },
  side: {
    over: ({ model, pose, p, s }) => {
      const w = p(pose.wrists[1]);
      const pu = p([0, model.pulley!.y, model.pulley!.z]);
      const d: [number, number] = [pu[0] - w[0], pu[1] - w[1]];
      const l = Math.hypot(d[0], d[1]) || 1;
      const end: [number, number] = [w[0] + (d[0] / l) * s(13), w[1] + (d[1] / l) * s(13)];
      return (
        <g>
          <path d={line(end, pu)} className={cableCls} strokeWidth={1.5} />
          <path d={line(w, end)} className={gripCls} strokeWidth={3} />
          <circle cx={w[0]} cy={w[1]} r={s(3)} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
};

/* ------------------------------ cable crossover -------------------------- */

const crossTowers: FigureExtra = {
  front: {
    behind: ({ model, p, s }) => {
      const pu = model.pulley!;
      return (
        <g>
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * CROSS_TOWER_X, 0, 0]), p([sg * CROSS_TOWER_X, pu.y + 6, 0]))}
                className={furnLine}
                strokeWidth={s(7)}
              />
              <path
                d={line(p([sg * (CROSS_TOWER_X + 16), 0, 0]), p([sg * (CROSS_TOWER_X - 16), 0, 0]))}
                className={furnLine}
                strokeWidth={s(4)}
              />
              <circle
                cx={p([sg * CROSS_TOWER_X, pu.y, 0])[0]}
                cy={p([sg * CROSS_TOWER_X, pu.y, 0])[1]}
                r={s(5)}
                className={pulleyFill}
              />
            </g>
          ))}
        </g>
      );
    },
  },
  side: {
    behind: ({ model, p, s }) => {
      const pu = model.pulley!;
      return (
        <g>
          <path
            d={line(p([0, 0, pu.z - 16]), p([0, pu.y + 8, pu.z - 16]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, pu.y + 8, pu.z - 16]), p([0, pu.y + 8, pu.z]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([0, pu.y, pu.z])[0]}
            cy={p([0, pu.y, pu.z])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
};

const crossCable: FigureExtra = {
  front: {
    over: ({ model, pose, p, s }) => (
      <g>
        {([0, 1] as const).map((i) => {
          const sg = i === 0 ? -1 : 1;
          const w = p(pose.wrists[i]);
          return (
            <g key={i}>
              <path
                d={line(w, p([sg * CROSS_TOWER_X, model.pulley!.y, 0]))}
                className={cableCls}
                strokeWidth={1.5}
              />
              <circle cx={w[0]} cy={w[1]} r={s(3.5)} className="fill-foreground stroke-none" />
            </g>
          );
        })}
      </g>
    ),
  },
  side: {
    over: ({ model, pose, p, s }) => {
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path
            d={line(w, p([0, model.pulley!.y, model.pulley!.z]))}
            className={cableCls}
            strokeWidth={1.5}
          />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
};

/* ------------------------------ cable lateral ---------------------------- */

const latTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const t = LATERAL_TOWER;
      return (
        <g>
          <path
            d={line(p([t.x - 16, 0, 0]), p([t.x + 16, 0, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([t.x, 0, 0]), p([t.x, t.handY + 12, 0]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([t.x, t.pulleyY, 0])[0]}
            cy={p([t.x, t.pulleyY, 0])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => {
      const t = LATERAL_TOWER;
      return (
        <g>
          <path
            d={line(p([0, 1, t.z - 16]), p([0, 1, t.z + 16]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 0, t.z]), p([0, t.handY + 12, t.z]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([0, t.pulleyY, t.z])[0]}
            cy={p([0, t.pulleyY, t.z])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
};

const latCable: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const t = LATERAL_TOWER;
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(p([t.x, t.pulleyY, 0]), w)} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const t = LATERAL_TOWER;
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(p([0, t.pulleyY, t.z]), w)} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
};

/* --------------------------------- pec deck ------------------------------ */

const pecDeck: FigureExtra = {
  front: {
    behind: ({ pose, p, s }) => {
      const sy = pose.shoulders[1][1];
      return (
        <g>
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sy + 16, 0])[1]}
            width={s(34)}
            height={s(sy + 16 - PEC_HIP.y + 4)}
            rx={6}
            className={furn}
          />
          <rect
            x={p([-19, 0, 0])[0]}
            y={p([0, 45, 0])[1]}
            width={s(38)}
            height={s(8)}
            rx={4}
            className={furn}
          />
          <path d={line(p([0, 45, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
          {/* machine head: the pivots sit above the shoulder joints */}
          <path
            d={line(p([-19, sy + 9, 0]), p([19, sy + 9, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        </g>
      );
    },
    mid: ({ pose, p, s }) => {
      const sy = pose.shoulders[1][1];
      return (
        <g>
          {([0, 1] as const).map((i) => {
            const sg = i === 0 ? -1 : 1;
            const w = p(pose.wrists[i]);
            return (
              <path
                key={i}
                d={line(p([sg * 19, sy + 9, 0]), [w[0], p([0, pose.wrists[i][1] + 7, 0])[1]])}
                className="stroke-foreground/35"
                strokeWidth={s(5)}
              />
            );
          })}
        </g>
      );
    },
    over: ({ pose, p, s }) => (
      <g>
        {([0, 1] as const).map((i) => {
          const w = p(pose.wrists[i]);
          return (
            <path
              key={i}
              d={line([w[0], w[1] - s(7)], [w[0], w[1] + s(9)])}
              className={gripCls}
              strokeWidth={3.5}
            />
          );
        })}
      </g>
    ),
  },
  side: {
    behind: ({ pose, p, s }) => {
      const sh = pose.shoulders[1];
      const hip = pose.hips[1];
      const dy = sh[1] - hip[1];
      const dz = sh[2] - hip[2];
      const l = Math.hypot(dy, dz);
      // Back pad: the torso line pushed 14 cm behind.
      const back = (a: number) =>
        p([0, hip[1] + (a * dy) / l + (12 * dz) / l, hip[2] + (a * dz) / l - (12 * dy) / l]);
      return (
        <g>
          <path
            d={line(back(-4), back(l + 14))}
            className="stroke-foreground/15"
            strokeWidth={s(9)}
          />
          <rect
            x={p([0, 0, -12])[0]}
            y={p([0, 45, 0])[1]}
            width={s(44)}
            height={s(8)}
            rx={4}
            className={furn}
          />
          <path d={line(p([0, 45, 6]), p([0, 0, 6]))} className={furnLine} strokeWidth={s(8)} />
          <path d={line(p([0, 2, -34]), p([0, 2, 20]))} className={furnLine} strokeWidth={s(5)} />
          <path
            d={line(p([0, 0, -34]), p([0, sh[1] + 9, -34]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, sh[1] + 9, -34]), p([0, sh[1] + 9, sh[2]]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
    mid: ({ pose, p, s }) => {
      const sh = pose.shoulders[1];
      const w = pose.wrists[1];
      return (
        <g>
          <path
            d={line(p([0, sh[1] + 9, sh[2]]), p([0, w[1] + 7, w[2]]))}
            className="stroke-foreground/35"
            strokeWidth={s(5)}
          />
          <circle
            cx={p([0, sh[1] + 9, sh[2]])[0]}
            cy={p([0, sh[1] + 9, sh[2]])[1]}
            r={s(4)}
            className={pulleyFill}
          />
        </g>
      );
    },
    over: ({ pose, p, s }) => {
      const w = p(pose.wrists[1]);
      return (
        <path
          d={line([w[0], w[1] - s(7)], [w[0], w[1] + s(9)])}
          className={gripCls}
          strokeWidth={3.5}
        />
      );
    },
  },
};

/* ------------------------------- machine row ----------------------------- */

const machineRow: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-19, 0, 0])[0]}
          y={p([0, 42, 0])[1]}
          width={s(38)}
          height={s(8)}
          rx={4}
          className={furn}
        />
        <path d={line(p([0, 42, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
      </g>
    ),
    over: ({ pose, p, s }) => {
      const sh = pose.shoulders[1];
      return (
        <g>
          {/* chest pad in front of the sternum */}
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sh[1] - 4, 0])[1]}
            width={s(34)}
            height={s(36)}
            rx={7}
            className="fill-foreground/15 stroke-foreground/25"
            strokeWidth={1}
          />
          {([0, 1] as const).map((i) => {
            const w = p(pose.wrists[i]);
            return (
              <path
                key={i}
                d={line([w[0], w[1] - s(8)], [w[0], w[1] + s(8)])}
                className={gripCls}
                strokeWidth={3.5}
              />
            );
          })}
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <path d={line(p([0, 3, -24]), p([0, 3, 112]))} className={furnLine} strokeWidth={s(5)} />
        <rect
          x={p([0, 0, -16])[0]}
          y={p([0, MROW_HIP.y - 8, 0])[1]}
          width={s(38)}
          height={s(8)}
          rx={4}
          className={furn}
        />
        <path
          d={line(p([0, MROW_HIP.y - 8, -2]), p([0, 0, -2]))}
          className={furnLine}
          strokeWidth={s(8)}
        />
        {/* front column with the handle carriage, and the arm that carries the chest pad */}
        <path d={line(p([0, 0, 106]), p([0, 96, 106]))} className={furnLine} strokeWidth={s(7)} />
        <path d={line(p([0, 66, 106]), p([0, 66, 30]))} className={furnLine} strokeWidth={s(6)} />
      </g>
    ),
    mid: (c) => {
      const w = c.pose.wrists[1];
      const a = alongTorso(c, 20, 15.5);
      const b = alongTorso(c, 50, 15.5);
      return (
        <g>
          {/* the chest pad lies against the front of the chest the whole rep */}
          <path d={line(a, b)} className="stroke-foreground/25" strokeWidth={c.s(12)} />
          <path d={line(a, b)} className="stroke-foreground/60" strokeWidth={c.s(8.5)} />
          {/* the handle lever runs forward at hand height, above the knees, to the column */}
          <path
            d={line(c.p([0, w[1], w[2]]), c.p([0, 94, 106]))}
            className="stroke-foreground/35"
            strokeWidth={c.s(5)}
          />
          <circle
            cx={c.p([0, 94, 106])[0]}
            cy={c.p([0, 94, 106])[1]}
            r={c.s(4.5)}
            className={pulleyFill}
          />
        </g>
      );
    },
    over: ({ pose, p, s }) => {
      const w = p(pose.wrists[1]);
      return (
        <path
          d={line([w[0], w[1] - s(8)], [w[0], w[1] + s(8)])}
          className={gripCls}
          strokeWidth={3.5}
        />
      );
    },
  },
};

export const EXTRAS_W4: Record<string, FigureExtra> = {
  "w4-row-seat": rowSeat,
  "w4-rope": rope,
  "w4-cross-towers": crossTowers,
  "w4-cross-cable": crossCable,
  "w4-lat-tower": latTower,
  "w4-lat-cable": latCable,
  "w4-pecdeck": pecDeck,
  "w4-machine-row": machineRow,
};
