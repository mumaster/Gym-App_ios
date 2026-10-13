import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";
import {
  HIFLY_TOWER,
  KICK_PULLEY,
  KICK_TOWER_Z,
  LOWFLY_TOWER_X,
} from "../../../lib/gym/exerciseAnimationW8";

/** Furniture and implements for animation batch W8 (exerciseAnimationW8.ts). */

const pulleyFill = "fill-foreground/30 stroke-none";
const cableCls = "stroke-foreground/50";
const gripCls = "stroke-foreground";
const dot = "fill-foreground stroke-none";

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

/* --------------------------- straight-arm pulldown ----------------------- */

const straightBar: FigureExtra = {
  front: {
    over: ({ model, pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const top = p([0, model.pulley!.y, 0]);
      const mid: [number, number] = [(wl[0] + wr[0]) / 2, (wl[1] + wr[1]) / 2];
      return (
        <g>
          <path d={line(top, mid)} className={cableCls} strokeWidth={1.5} />
          <path
            d={line([wl[0] - s(5), wl[1]], [wr[0] + s(5), wr[1]])}
            className={gripCls}
            strokeWidth={3}
          />
        </g>
      );
    },
  },
  side: {
    over: ({ model, pose, p }) => {
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path
            d={line(w, p([0, model.pulley!.y, model.pulley!.z]))}
            className={cableCls}
            strokeWidth={1.5}
          />
          <circle cx={w[0]} cy={w[1]} r={3.5} className={dot} />
        </g>
      );
    },
  },
};

/** The tower the lifter faces: it stands in front of the figure, so the front
 *  view draws nothing behind the head. */
const sapTower: FigureExtra = {
  side: {
    behind: ({ model, p, s }) => {
      const pu = model.pulley!;
      return (
        <g>
          <path
            d={line(p([0, 1, pu.z - 8]), p([0, 1, pu.z + 28]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 0, pu.z + 16]), p([0, pu.y + 8, pu.z + 16]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, pu.y + 8, pu.z + 16]), p([0, pu.y + 8, pu.z]))}
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

/* ------------------------ single-arm high cable fly ---------------------- */

const hiTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const t = HIFLY_TOWER;
      return (
        <g>
          <path
            d={line(p([t.x - 16, 0, 0]), p([t.x + 16, 0, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([t.x, 0, 0]), p([t.x, t.y + 6, 0]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([t.x, t.y, 0])[0]}
            cy={p([t.x, t.y, 0])[1]}
            r={s(5)}
            className={pulleyFill}
          />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => {
      const t = HIFLY_TOWER;
      return (
        <g>
          <path
            d={line(p([0, 1, t.z - 16]), p([0, 1, t.z + 16]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 0, t.z]), p([0, t.y + 6, t.z]))}
            className={furnLine}
            strokeWidth={s(7)}
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

const hiHandle: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const t = HIFLY_TOWER;
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(p([t.x, t.y, 0]), w)} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const t = HIFLY_TOWER;
      const w = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(p([0, t.y, t.z]), w)} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
  },
};

/* ------------------------- low-to-high cable fly ------------------------- */

const lowTowers: FigureExtra = {
  front: {
    behind: ({ model, p, s }) => {
      const pu = model.pulley!;
      return (
        <g>
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * LOWFLY_TOWER_X, 0, 0]), p([sg * LOWFLY_TOWER_X, 176, 0]))}
                className={furnLine}
                strokeWidth={s(7)}
              />
              <path
                d={line(
                  p([sg * (LOWFLY_TOWER_X + 16), 0, 0]),
                  p([sg * (LOWFLY_TOWER_X - 16), 0, 0]),
                )}
                className={furnLine}
                strokeWidth={s(4)}
              />
              <rect
                x={p([sg * LOWFLY_TOWER_X - 7, 0, 0])[0]}
                y={p([0, pu.y + 9, 0])[1]}
                width={s(14)}
                height={s(18)}
                rx={3}
                className={furn}
              />
              <circle
                cx={p([sg * LOWFLY_TOWER_X, pu.y, 0])[0]}
                cy={p([0, pu.y, 0])[1]}
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
      const cz = pu.z - 12;
      return (
        <g>
          <path
            d={line(p([0, 1, cz - 14]), p([0, 1, cz + 14]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path d={line(p([0, 0, cz]), p([0, 176, cz]))} className={furnLine} strokeWidth={s(7)} />
          <path
            d={line(p([0, pu.y + 8, cz]), p([0, pu.y + 8, pu.z]))}
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

const lowCable: FigureExtra = {
  front: {
    over: ({ model, pose, p, s }) => (
      <g>
        {([0, 1] as const).map((i) => {
          const sg = i === 0 ? -1 : 1;
          const w = p(pose.wrists[i]);
          return (
            <g key={i}>
              <path
                d={line(w, p([sg * LOWFLY_TOWER_X, model.pulley!.y, 0]))}
                className={cableCls}
                strokeWidth={1.5}
              />
              <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
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
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
  },
};

/* ---------------------- single-arm seated cable row ---------------------- */

const rowHandle: FigureExtra = {
  front: {
    over: ({ model, pose, p, s }) => {
      const w = p(pose.wrists[1]);
      const low = p([pose.wrists[1][0], model.pulley!.y, 0]);
      return (
        <g>
          <path d={line(w, low)} className={cableCls} strokeWidth={1.5} />
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
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
          <circle cx={w[0]} cy={w[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
  },
};

/* ---------------------------- cable glute kickback ----------------------- */

const kickTower: FigureExtra = {
  front: {
    behind: ({ pose, p, s }) => {
      const wy = pose.wrists[1][1];
      return (
        <g>
          <path d={line(p([-18, 0, 0]), p([18, 0, 0]))} className={furnLine} strokeWidth={s(4)} />
          <path
            d={line(p([0, 0, 0]), p([0, wy + 14, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
        </g>
      );
    },
    over: ({ pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      return (
        <g>
          <path d={line(wl, wr)} className={gripCls} strokeWidth={3} />
          {[wl, wr].map((w, i) => (
            <circle key={i} cx={w[0]} cy={w[1]} r={s(3)} className={dot} />
          ))}
        </g>
      );
    },
  },
  side: {
    behind: ({ pose, p, s }) => {
      const wy = pose.wrists[1][1];
      return (
        <g>
          <path
            d={line(p([0, 1, KICK_TOWER_Z - 14]), p([0, 1, KICK_TOWER_Z + 20]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 0, KICK_TOWER_Z]), p([0, wy + 14, KICK_TOWER_Z]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <circle
            cx={p([0, KICK_PULLEY.y, KICK_PULLEY.z])[0]}
            cy={p([0, KICK_PULLEY.y, KICK_PULLEY.z])[1]}
            r={s(4.5)}
            className={pulleyFill}
          />
        </g>
      );
    },
    over: ({ pose, p, s }) => {
      const w = pose.wrists[1];
      const a = p([0, w[1], w[2]]);
      const b = p([0, w[1], KICK_TOWER_Z]);
      return (
        <g>
          <path d={line(a, b)} className={furnLine} strokeWidth={s(4)} />
          <circle cx={a[0]} cy={a[1]} r={s(3.5)} className={dot} />
        </g>
      );
    },
  },
};

const kickStrap: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const a = p(pose.ankles[1]);
      return (
        <g>
          <path d={line(a, p([0, KICK_PULLEY.y, 0]))} className={cableCls} strokeWidth={1.5} />
          <circle cx={a[0]} cy={a[1]} r={s(3.5)} className="fill-foreground/70 stroke-none" />
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const a = p(pose.ankles[1]);
      const k = p(pose.knees[1]);
      const d: [number, number] = [k[0] - a[0], k[1] - a[1]];
      const l = Math.hypot(d[0], d[1]) || 1;
      const cuff: [number, number] = [a[0] + (d[0] / l) * s(6), a[1] + (d[1] / l) * s(6)];
      return (
        <g>
          <path
            d={line(a, p([0, KICK_PULLEY.y, KICK_PULLEY.z]))}
            className={cableCls}
            strokeWidth={1.5}
          />
          <path d={line(a, cuff)} className="stroke-foreground/70" strokeWidth={s(7)} />
        </g>
      );
    },
  },
};

/* ----------------------------- reverse pec deck -------------------------- */

const revDeck: FigureExtra = {
  front: {
    behind: ({ pose, p, s }) => {
      const sy = pose.shoulders[1][1];
      return (
        <g>
          <rect
            x={p([-19, 0, 0])[0]}
            y={p([0, 45, 0])[1]}
            width={s(38)}
            height={s(8)}
            rx={4}
            className={furn}
          />
          <path d={line(p([0, 45, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
          {/* machine head: the pivots sit in front of the shoulders */}
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
          {/* chest pad against the sternum */}
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sy + 2, 0])[1]}
            width={s(34)}
            height={s(38)}
            rx={7}
            className="fill-foreground/15 stroke-foreground/25"
            strokeWidth={1}
          />
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
      const colZ = sh[2] + 27;
      return (
        <g>
          <rect
            x={p([0, 0, -12])[0]}
            y={p([0, 45, 0])[1]}
            width={s(44)}
            height={s(8)}
            rx={4}
            className={furn}
          />
          <path d={line(p([0, 45, 6]), p([0, 0, 6]))} className={furnLine} strokeWidth={s(8)} />
          <path
            d={line(p([0, 2, -30]), p([0, 2, colZ + 14]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          {/* the column in front of the pad carries the pad and the handle pivots */}
          <path
            d={line(p([0, 0, colZ]), p([0, sh[1] + 9, colZ]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
        </g>
      );
    },
    mid: (c) => {
      const sh = c.pose.shoulders[1];
      const w = c.pose.wrists[1];
      const colZ = sh[2] + 27;
      const a = alongTorso(c, 14, 15.5);
      const b = alongTorso(c, 48, 15.5);
      return (
        <g>
          {/* the chest pad lies against the front of the chest the whole rep */}
          <path d={line(a, b)} className="stroke-foreground/25" strokeWidth={c.s(12)} />
          <path d={line(a, b)} className="stroke-foreground/60" strokeWidth={c.s(8.5)} />
          <path
            d={line(c.p([0, sh[1] + 9, colZ]), c.p([0, w[1] + 7, w[2]]))}
            className="stroke-foreground/35"
            strokeWidth={c.s(5)}
          />
          <circle
            cx={c.p([0, sh[1] + 9, colZ])[0]}
            cy={c.p([0, sh[1] + 9, colZ])[1]}
            r={c.s(4)}
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

export const EXTRAS_W8: Record<string, FigureExtra> = {
  "w8-straight-bar": straightBar,
  "w8-sap-tower": sapTower,
  "w8-hi-tower": hiTower,
  "w8-hi-handle": hiHandle,
  "w8-low-towers": lowTowers,
  "w8-low-cable": lowCable,
  "w8-row-handle": rowHandle,
  "w8-kick-tower": kickTower,
  "w8-kick-strap": kickStrap,
  "w8-rev-deck": revDeck,
};
