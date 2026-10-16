import {
  CABLE_PRESS_PULLEY,
  CHEST_PRESS,
  HIGH_ROW_SHOULDER,
  INCLINE_PRESS,
  LATRAISE_FROM,
  LATRAISE_SHOULDER,
  LATRAISE_TO,
  TBAR_LEAN,
  TBAR_PLATFORM,
  lateralRaiseElbow,
  pressGeometry,
} from "../../../lib/gym/exerciseAnimationW13";
import { MACHINE_PRESS_BOTTOM, MACHINE_PRESS_TOP } from "../../../lib/gym/exerciseAnimationW6";
import { MROW_HIP, MROW_LEVER, MROW_PIVOT } from "../../../lib/gym/exerciseAnimationW4";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line, type P2 } from "../figureDraw";

/** Furniture and implements for animation batch W13 (exerciseAnimationW13.ts). */

const pulleyFill = "fill-foreground/30 stroke-none";
const leverCls = "stroke-foreground/25";
const padOuter = "stroke-foreground/20";
const padCore = "stroke-foreground/40";
const gripCls = "stroke-foreground";
const plateCls = "fill-primary/12 stroke-primary";
const PLATE_R = 22.5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const deg = (r: number) => (r * 180) / Math.PI;
const cosd = (a: number) => Math.cos((a * Math.PI) / 180);
const sind = (a: number) => Math.sin((a * Math.PI) / 180);

/** Side-view point at distance `a` along the torso (hip -> shoulder) and `b`
 *  in front of it (negative = behind), in cm. */
function torsoPt(c: DrawCtx, a: number, b: number): P2 {
  const h = c.pose.hips[1];
  const sh = c.pose.shoulders[1];
  const dy = sh[1] - h[1];
  const dz = sh[2] - h[2];
  const l = Math.hypot(dy, dz);
  const uy = dy / l;
  const uz = dz / l;
  return c.p([0, h[1] + a * uy - b * uz, h[2] + a * uz + b * uy]);
}

/** Side view: a plate seen face-on (outline, light fill, sleeve ring, hub). */
function PlateSide({ c, y, z }: { c: DrawCtx; y: number; z: number }) {
  const pc = c.p([0, y, z]);
  return (
    <g>
      <circle cx={pc[0]} cy={pc[1]} r={c.s(PLATE_R)} className={plateCls} strokeWidth={2} />
      <circle
        cx={pc[0]}
        cy={pc[1]}
        r={c.s(8)}
        className="fill-none stroke-foreground/25"
        strokeWidth={1.5}
      />
      <circle cx={pc[0]} cy={pc[1]} r={c.s(3)} className="fill-foreground stroke-none" />
    </g>
  );
}

/** Front view: a plate on a horn pointing outwards, seen edge-on. */
function PlateFront({ c, x, y }: { c: DrawCtx; x: number; y: number }) {
  return (
    <rect
      x={c.p([x, 0, 0])[0] - c.s(4.5)}
      y={c.p([0, y + PLATE_R, 0])[1]}
      width={c.s(9)}
      height={c.s(PLATE_R * 2)}
      rx={3}
      className="fill-primary stroke-none"
    />
  );
}

/** Both side-view grips: a short bar across the hand. */
const gripFront = ({ pose, p }: DrawCtx) => (
  <g>
    {([0, 1] as const).map((i) => {
      const w = p(pose.wrists[i]);
      return (
        <path
          key={i}
          d={line([w[0], w[1] - 6], [w[0], w[1] + 6])}
          className={gripCls}
          strokeWidth={3.5}
        />
      );
    })}
  </g>
);
const gripSide = ({ pose, p, s }: DrawCtx) => {
  const w = pose.wrists[1];
  return (
    <path
      d={line(p([0, w[1] - 7, w[2]]), p([0, w[1] + 7, w[2]]))}
      className={gripCls}
      strokeWidth={s(3.5)}
    />
  );
};

/** Seat (a pad on a post) in the front view, hip height `top`. */
function SeatFront({ c, top, half = 19 }: { c: DrawCtx; top: number; half?: number }) {
  const { p, s } = c;
  return (
    <g>
      <rect
        x={p([-half, 0, 0])[0]}
        y={p([0, top, 0])[1]}
        width={s(half * 2)}
        height={s(8)}
        rx={4}
        className={furn}
      />
      <path d={line(p([0, top, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
    </g>
  );
}

/** Seat in the side view from z0 to z1 with a post at zp. */
function SeatSide({
  c,
  top,
  z0,
  z1,
  zp,
}: {
  c: DrawCtx;
  top: number;
  z0: number;
  z1: number;
  zp: number;
}) {
  const { p, s } = c;
  return (
    <g>
      <rect
        x={p([0, 0, z0])[0]}
        y={p([0, top, 0])[1]}
        width={s(z1 - z0)}
        height={s(8)}
        rx={4}
        className={furn}
      />
      <path d={line(p([0, top, zp]), p([0, 0, zp]))} className={furnLine} strokeWidth={s(8)} />
    </g>
  );
}

/** A pad along the torso in the side view (outline plus core). */
function TorsoPad({ c, a0, a1, b }: { c: DrawCtx; a0: number; a1: number; b: number }) {
  const p0 = torsoPt(c, a0, b);
  const p1 = torsoPt(c, a1, b);
  return (
    <g>
      <path d={line(p0, p1)} className={padOuter} strokeWidth={c.s(12)} />
      <path d={line(p0, p1)} className={padCore} strokeWidth={c.s(8)} />
    </g>
  );
}

/** Weight stack, side view: slabs from the floor, the top `lifted` slabs
 *  raised by `lift` cm (the selected weight). */
function StackSide({
  c,
  z0,
  z1,
  n,
  lifted,
  lift,
}: {
  c: DrawCtx;
  z0: number;
  z1: number;
  n: number;
  lifted: number;
  lift: number;
}) {
  const { p, s } = c;
  const slab = 7;
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const up = k >= n - lifted;
        const y = 8 + k * slab + (up ? lift : 0);
        return (
          <rect
            key={k}
            x={p([0, 0, z0])[0]}
            y={p([0, y + slab - 1, 0])[1]}
            width={s(z1 - z0)}
            height={s(slab - 1)}
            rx={1.5}
            className={up ? "fill-primary/25 stroke-none" : "fill-foreground/15 stroke-none"}
          />
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Seated press machines (flat and incline chest press)               */
/* ------------------------------------------------------------------ */

interface PressMachine {
  geo: typeof CHEST_PRESS;
  /** Lever pivot behind the back pad (side view y, z) and its x in the front view. */
  pivot: { y: number; z: number };
  pivotX: number;
  /** Plate centre when the arms are fully stretched (progress 1) and the
   *  extra offset when pressed out (progress 0). */
  plates: { y: number; z: number; dy: number; dz: number };
  /** Selectorized: weight stack instead of plates. */
  stack?: boolean;
  seatTop: number;
}

function pressMachine(m: PressMachine): FigureExtra {
  const geo = pressGeometry(m.geo);
  /** 0 = arms pressed out, 1 = handles at the chest. */
  const progress = (c: DrawCtx) =>
    clamp01((c.pose.wrists[1][2] - geo.end[2]) / (geo.start[2] - geo.end[2]));
  const plateAt = (c: DrawCtx): { y: number; z: number } => {
    const e = progress(c);
    return { y: m.plates.y + m.plates.dy * (1 - e), z: m.plates.z + m.plates.dz * (1 - e) };
  };
  const STACK = { z0: -80, z1: -60, n: 15, lifted: 8, lift: 10 };
  return {
    front: {
      behind: (c) => {
        const { p, s, pose } = c;
        const hip = pose.hips[1];
        const sh = pose.shoulders[1];
        const pl = plateAt(c);
        return (
          <g>
            <path
              d={line(p([-m.pivotX - 8, 2, 0]), p([m.pivotX + 8, 2, 0]))}
              className={furnLine}
              strokeWidth={s(4)}
            />
            {[-1, 1].map((sg) => (
              <path
                key={sg}
                d={line(p([sg * m.pivotX, 0, 0]), p([sg * m.pivotX, m.pivot.y + 12, 0]))}
                className={furnLine}
                strokeWidth={s(6)}
              />
            ))}
            {m.stack && (
              <rect
                x={p([-20, 0, 0])[0]}
                y={p([0, 8 + 15 * 7 + 4, 0])[1]}
                width={s(40)}
                height={s(15 * 7 + 4)}
                rx={3}
                className="fill-foreground/12 stroke-none"
              />
            )}
            <SeatFront c={c} top={m.seatTop} />
            <rect
              x={p([-17, 0, 0])[0]}
              y={p([0, sh[1] + 15, 0])[1]}
              width={s(34)}
              height={s(sh[1] + 15 - hip[1])}
              rx={6}
              className={furn}
            />
            {([0, 1] as const).map((i) => {
              const sg = i === 0 ? -1 : 1;
              const w = pose.wrists[i];
              return (
                <path
                  key={i}
                  d={line(p([w[0], w[1], 0]), p([sg * m.pivotX, m.pivot.y, 0]))}
                  className={leverCls}
                  strokeWidth={s(5)}
                />
              );
            })}
            {!m.stack &&
              [-1, 1].map((sg) => (
                <g key={sg}>
                  <path
                    d={line(p([sg * m.pivotX, m.pivot.y, 0]), p([sg * (m.pivotX + 7), pl.y, 0]))}
                    className={leverCls}
                    strokeWidth={s(5)}
                  />
                  <PlateFront c={c} x={sg * (m.pivotX + 7)} y={pl.y} />
                </g>
              ))}
            {[-1, 1].map((sg) => (
              <circle
                key={sg}
                cx={p([sg * m.pivotX, m.pivot.y, 0])[0]}
                cy={p([0, m.pivot.y, 0])[1]}
                r={s(4.5)}
                className={pulleyFill}
              />
            ))}
          </g>
        );
      },
      over: gripFront,
    },
    side: {
      behind: (c) => {
        const { p, s, pose } = c;
        const piv = p([0, m.pivot.y, m.pivot.z]);
        const w = pose.wrists[1];
        const pl = plateAt(c);
        const e = progress(c);
        return (
          <g>
            <path
              d={line(p([0, 3, m.pivot.z - 14]), p([0, 3, 58]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
            <SeatSide c={c} top={m.seatTop} z0={-14} z1={30} zp={8} />
            <path
              d={line(p([0, 0, m.pivot.z]), p([0, m.pivot.y + 14, m.pivot.z]))}
              className={furnLine}
              strokeWidth={s(8)}
            />
            <path
              d={line(torsoPt(c, 8, -14), p([0, m.pivot.y - 28, m.pivot.z]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
            <TorsoPad c={c} a0={0} a1={66} b={-13.5} />
            <path d={line(p([0, w[1], w[2]]), piv)} className={leverCls} strokeWidth={s(5)} />
            {m.stack ? (
              <g>
                <StackSide
                  c={c}
                  z0={STACK.z0}
                  z1={STACK.z1}
                  n={STACK.n}
                  lifted={STACK.lifted}
                  lift={STACK.lift * (1 - e)}
                />
                <path
                  d={line(
                    piv,
                    p([0, 8 + 15 * 7 - 8 + STACK.lift * (1 - e), (STACK.z0 + STACK.z1) / 2]),
                  )}
                  className={leverCls}
                  strokeWidth={s(4)}
                />
              </g>
            ) : (
              <g>
                <path d={line(piv, p([0, pl.y, pl.z]))} className={leverCls} strokeWidth={s(5)} />
                <PlateSide c={c} y={pl.y} z={pl.z} />
              </g>
            )}
            <circle cx={piv[0]} cy={piv[1]} r={s(4.5)} className={pulleyFill} />
          </g>
        );
      },
      over: gripSide,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Plate-loaded shoulder press (implement, with the shared upright bench) */
/* ------------------------------------------------------------------ */

/** Lever pivot: equally far from the handle's start and end points, behind the pad. */
const SP_L = 71.6;
const SP_PIVOT = (() => {
  const a: [number, number] = [MACHINE_PRESS_BOTTOM[2], MACHINE_PRESS_BOTTOM[1]];
  const b: [number, number] = [MACHINE_PRESS_TOP[2], MACHINE_PRESS_TOP[1]];
  const mz = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dz = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dz, dy);
  const h = Math.sqrt(SP_L * SP_L - (l / 2) ** 2);
  // perpendicular to the chord, on the side behind the lifter (negative z)
  const nz = -dy / l;
  const ny = dz / l;
  const sign = nz < 0 ? 1 : -1;
  return { y: my + sign * ny * h, z: mz + sign * nz * h };
})();
const SP_X = 62;
const SP_HORN = 40;

function pressHorn(c: DrawCtx): { y: number; z: number } {
  const w = c.pose.wrists[1];
  const a = deg(Math.atan2(w[1] - SP_PIVOT.y, w[2] - SP_PIVOT.z));
  const psi = a - 125;
  return { y: SP_PIVOT.y + SP_HORN * sind(psi), z: SP_PIVOT.z + SP_HORN * cosd(psi) };
}

const platePress: FigureExtra = {
  front: {
    behind: (c) => {
      const { p, s, pose } = c;
      const h = pressHorn(c);
      return (
        <g>
          <path
            d={line(p([-SP_X - 10, 2, 0]), p([SP_X + 10, 2, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * SP_X, 0, 0]), p([sg * SP_X, SP_PIVOT.y + 14, 0]))}
                className={furnLine}
                strokeWidth={s(6)}
              />
              <path
                d={line(p([sg * SP_X, SP_PIVOT.y, 0]), p([sg * (SP_X + 7), h.y, 0]))}
                className={leverCls}
                strokeWidth={s(5)}
              />
              <PlateFront c={c} x={sg * (SP_X + 7)} y={h.y} />
              <circle
                cx={p([sg * SP_X, 0, 0])[0]}
                cy={p([0, SP_PIVOT.y, 0])[1]}
                r={s(4.5)}
                className={pulleyFill}
              />
            </g>
          ))}
          {([0, 1] as const).map((i) => {
            const sg = i === 0 ? -1 : 1;
            const w = pose.wrists[i];
            return (
              <path
                key={i}
                d={line(p([w[0], w[1], 0]), p([sg * SP_X, SP_PIVOT.y, 0]))}
                className={leverCls}
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
            <circle
              key={i}
              cx={w[0]}
              cy={w[1]}
              r={s(3.5)}
              className="fill-primary/40 stroke-primary"
              strokeWidth={2}
            />
          );
        })}
      </g>
    ),
  },
  side: {
    behind: (c) => {
      const { p, s, pose } = c;
      const w = pose.wrists[1];
      const h = pressHorn(c);
      const piv = p([0, SP_PIVOT.y, SP_PIVOT.z]);
      return (
        <g>
          <path
            d={line(p([0, 3, SP_PIVOT.z - 14]), p([0, 3, 58]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([0, 0, SP_PIVOT.z]), p([0, SP_PIVOT.y + 14, SP_PIVOT.z]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <path
            d={line(p([0, SP_PIVOT.y - 52, SP_PIVOT.z]), p([0, 66, -22]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path d={line(p([0, w[1], w[2]]), piv)} className={leverCls} strokeWidth={s(5)} />
          <path d={line(piv, p([0, h.y, h.z]))} className={leverCls} strokeWidth={s(5)} />
          <PlateSide c={c} y={h.y} z={h.z} />
          <circle cx={piv[0]} cy={piv[1]} r={s(4.5)} className={pulleyFill} />
        </g>
      );
    },
    over: ({ pose, p, s }) => {
      const w = pose.wrists[1];
      return (
        <path
          d={line(p([0, w[1], w[2] - 6]), p([0, w[1], w[2] + 6]))}
          className={gripCls}
          strokeWidth={s(3.5)}
        />
      );
    },
  },
};

/* ------------------------------------------------------------------ */
/* Plate-loaded row (chest-supported, low pivot)                       */
/* ------------------------------------------------------------------ */

const PR_X = 46;
const PR_HORN = 46;
/** Horn centre: the horn turns with the lever arm. */
function rowHorn(c: DrawCtx): { y: number; z: number } {
  const w = c.pose.wrists[1];
  const theta = deg(Math.atan2(w[2] - MROW_PIVOT.z, w[1] - MROW_PIVOT.y)); // from vertical, back negative
  const psi = 22 + (-theta - 1);
  return { y: MROW_PIVOT.y + PR_HORN * sind(psi), z: MROW_PIVOT.z + PR_HORN * cosd(psi) };
}

const plateRow: FigureExtra = {
  front: {
    behind: (c) => {
      const { p, s, pose } = c;
      const h = rowHorn(c);
      return (
        <g>
          <path
            d={line(p([-PR_X - 12, 2, 0]), p([PR_X + 12, 2, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <SeatFront c={c} top={MROW_HIP.y - 8} />
          {([0, 1] as const).map((i) => {
            const sg = i === 0 ? -1 : 1;
            const w = pose.wrists[i];
            return (
              <path
                key={i}
                d={line(p([w[0], w[1], 0]), p([sg * PR_X, MROW_PIVOT.y, 0]))}
                className={leverCls}
                strokeWidth={s(5)}
              />
            );
          })}
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * PR_X, MROW_PIVOT.y, 0]), p([sg * (PR_X + 5), h.y, 0]))}
                className={leverCls}
                strokeWidth={s(5)}
              />
              <PlateFront c={c} x={sg * (PR_X + 6)} y={h.y} />
              <circle
                cx={p([sg * PR_X, 0, 0])[0]}
                cy={p([0, MROW_PIVOT.y, 0])[1]}
                r={s(4.5)}
                className={pulleyFill}
              />
            </g>
          ))}
        </g>
      );
    },
    over: (c) => {
      const { pose, p, s } = c;
      const sh = pose.shoulders[1];
      return (
        <g>
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sh[1] - 4, 0])[1]}
            width={s(34)}
            height={s(36)}
            rx={7}
            className="fill-foreground/15 stroke-foreground/25"
            strokeWidth={1}
          />
          {gripFront(c)}
        </g>
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s, pose } = c;
      const w = pose.wrists[1];
      const h = rowHorn(c);
      const piv = p([0, MROW_PIVOT.y, MROW_PIVOT.z]);
      const padMid = torsoPt(c, 46, 21);
      return (
        <g>
          <path d={line(p([0, 3, -24]), p([0, 3, 130]))} className={furnLine} strokeWidth={s(5)} />
          <SeatSide c={c} top={MROW_HIP.y - 8} z0={-16} z1={22} zp={-2} />
          {/* front column with the arm that carries the chest pad */}
          <path
            d={line(p([0, 0, 124]), p([0, 100, 124]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path d={line(padMid, p([0, 100, 124]))} className={furnLine} strokeWidth={s(6)} />
          {/* pivot housing, lever and the horn with its plates */}
          <rect
            x={piv[0] - s(8)}
            y={piv[1] - s(8)}
            width={s(16)}
            height={s(14)}
            rx={3}
            className={furn}
          />
          <path d={line(p([0, w[1], w[2]]), piv)} className={leverCls} strokeWidth={s(5)} />
          <path d={line(piv, p([0, h.y, h.z]))} className={leverCls} strokeWidth={s(5)} />
          <PlateSide c={c} y={h.y} z={h.z} />
          <circle cx={piv[0]} cy={piv[1]} r={s(4.5)} className={pulleyFill} />
        </g>
      );
    },
    mid: (c) => <TorsoPad c={c} a0={20} a1={52} b={15.5} />,
    over: gripSide,
  },
};

/* ------------------------------------------------------------------ */
/* Plate-loaded high row                                               */
/* ------------------------------------------------------------------ */

const HR_PIVOT = { y: 80, z: 84 };
const HR_X = 58;
const HR_HORN = 38;
function highHorn(c: DrawCtx): { y: number; z: number } {
  const w = c.pose.wrists[1];
  const phi = deg(Math.atan2(w[1] - HR_PIVOT.y, w[2] - HR_PIVOT.z));
  const psi = phi - 180;
  return { y: HR_PIVOT.y + HR_HORN * sind(psi), z: HR_PIVOT.z + HR_HORN * cosd(psi) };
}

const plateHighRow: FigureExtra = {
  front: {
    behind: (c) => {
      const { p, s, pose } = c;
      const h = highHorn(c);
      return (
        <g>
          <path
            d={line(p([-HR_X - 12, 2, 0]), p([HR_X + 12, 2, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <SeatFront c={c} top={42} />
          {[-1, 1].map((sg) => (
            <path
              key={sg}
              d={line(p([sg * HR_X, 0, 0]), p([sg * HR_X, HR_PIVOT.y + 14, 0]))}
              className={furnLine}
              strokeWidth={s(6)}
            />
          ))}
          {([0, 1] as const).map((i) => {
            const sg = i === 0 ? -1 : 1;
            const w = pose.wrists[i];
            return (
              <path
                key={i}
                d={line(p([w[0], w[1], 0]), p([sg * HR_X, HR_PIVOT.y, 0]))}
                className={leverCls}
                strokeWidth={s(5)}
              />
            );
          })}
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * HR_X, HR_PIVOT.y, 0]), p([sg * (HR_X + 6), h.y, 0]))}
                className={leverCls}
                strokeWidth={s(5)}
              />
              <PlateFront c={c} x={sg * (HR_X + 6)} y={h.y} />
              <circle
                cx={p([sg * HR_X, 0, 0])[0]}
                cy={p([0, HR_PIVOT.y, 0])[1]}
                r={s(4.5)}
                className={pulleyFill}
              />
            </g>
          ))}
        </g>
      );
    },
    over: (c) => {
      const { p, s } = c;
      const sh = HIGH_ROW_SHOULDER;
      return (
        <g>
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sh.y - 2, 0])[1]}
            width={s(34)}
            height={s(32)}
            rx={7}
            className="fill-foreground/15 stroke-foreground/25"
            strokeWidth={1}
          />
          {gripFront(c)}
        </g>
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s, pose } = c;
      const w = pose.wrists[1];
      const h = highHorn(c);
      const piv = p([0, HR_PIVOT.y, HR_PIVOT.z]);
      const padMid = torsoPt(c, 42, 20);
      return (
        <g>
          <path d={line(p([0, 3, -24]), p([0, 3, 150]))} className={furnLine} strokeWidth={s(5)} />
          <SeatSide c={c} top={42} z0={-16} z1={22} zp={-2} />
          <path
            d={line(p([0, 0, HR_PIVOT.z]), p([0, 112, HR_PIVOT.z]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <path d={line(padMid, p([0, 98, HR_PIVOT.z]))} className={furnLine} strokeWidth={s(6)} />
          <path d={line(p([0, w[1], w[2]]), piv)} className={leverCls} strokeWidth={s(5)} />
          <path d={line(piv, p([0, h.y, h.z]))} className={leverCls} strokeWidth={s(5)} />
          <PlateSide c={c} y={h.y} z={h.z} />
          <circle cx={piv[0]} cy={piv[1]} r={s(4.5)} className={pulleyFill} />
        </g>
      );
    },
    mid: (c) => <TorsoPad c={c} a0={28} a1={56} b={15.5} />,
    over: gripSide,
  },
};

/* ------------------------------------------------------------------ */
/* Chest-supported T-bar row machine                                   */
/* ------------------------------------------------------------------ */

const TB_PIVOT = { y: 24, z: 128 };

/** Point `t` of the way from the handle to the pivot. */
function barPoint(c: DrawCtx, t: number) {
  const w = c.pose.wrists[1];
  return { y: w[1] + (TB_PIVOT.y - w[1]) * t, z: w[2] + (TB_PIVOT.z - w[2]) * t };
}

const tBarMachine: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        <rect
          x={p([-26, 0, 0])[0]}
          y={p([0, TBAR_PLATFORM, 0])[1]}
          width={s(52)}
          height={s(TBAR_PLATFORM)}
          rx={3}
          className={furn}
        />
      </g>
    ),
    over: (c) => {
      const { pose, p, s } = c;
      const sh = pose.shoulders[1];
      const w = pose.wrists[1];
      const b = barPoint(c, 0.62);
      const bar0 = p([0, w[1], 0]);
      return (
        <g>
          {/* the bar and its plates run towards the camera: a vertical line and a disc */}
          <path
            d={line([bar0[0], bar0[1]], p([0, TB_PIVOT.y + 2, 0]))}
            className={leverCls}
            strokeWidth={s(5)}
          />
          <circle
            cx={p([0, 0, 0])[0]}
            cy={p([0, b.y, 0])[1]}
            r={s(PLATE_R)}
            className={plateCls}
            strokeWidth={2}
          />
          <circle
            cx={p([0, 0, 0])[0]}
            cy={p([0, b.y, 0])[1]}
            r={s(3)}
            className="fill-foreground stroke-none"
          />
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sh[1] - 4, 0])[1]}
            width={s(34)}
            height={s(28)}
            rx={7}
            className="fill-foreground/15 stroke-foreground/25"
            strokeWidth={1}
          />
          {gripFront(c)}
        </g>
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      const padMid = torsoPt(c, 44, 20);
      return (
        <g>
          <path d={line(p([0, 3, -16]), p([0, 3, 160]))} className={furnLine} strokeWidth={s(5)} />
          <rect
            x={p([0, 0, -14])[0]}
            y={p([0, TBAR_PLATFORM, 0])[1]}
            width={s(46)}
            height={s(TBAR_PLATFORM)}
            rx={3}
            className={furn}
          />
          {/* front column and the arm that carries the chest pad */}
          <path
            d={line(p([0, 0, TB_PIVOT.z + 20]), p([0, 120, TB_PIVOT.z + 20]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <path
            d={line(padMid, p([0, 114, TB_PIVOT.z + 20]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <rect
            x={p([0, 0, TB_PIVOT.z - 8])[0]}
            y={p([0, TB_PIVOT.y + 8, 0])[1]}
            width={s(18)}
            height={s(16)}
            rx={3}
            className={furn}
          />
        </g>
      );
    },
    mid: (c) => <TorsoPad c={c} a0={32} a1={56} b={15.5} />,
    over: (c) => {
      const { p, s, pose } = c;
      const w = pose.wrists[1];
      const bar = line(p([0, w[1], w[2]]), p([0, TB_PIVOT.y, TB_PIVOT.z]));
      const b = barPoint(c, 0.55);
      return (
        <g>
          <path d={bar} className="stroke-foreground/35" strokeWidth={s(4)} />
          <PlateSide c={c} y={b.y} z={b.z} />
          {gripSide(c)}
        </g>
      );
    },
  },
};

/* ------------------------------------------------------------------ */
/* Machine lateral raise                                               */
/* ------------------------------------------------------------------ */

const LR_PIVOT_Z = -34;
const LR_STACK = { z0: -92, z1: -72, n: 15, lifted: 8 };
function lateralProgress(c: DrawCtx): number {
  const y0 = lateralRaiseElbow(LATRAISE_FROM)[1];
  const y1 = lateralRaiseElbow(LATRAISE_TO)[1];
  return clamp01((c.pose.elbows[1][1] - y0) / (y1 - y0));
}

const lateralMachine: FigureExtra = {
  front: {
    behind: (c) => {
      const { p, s, pose } = c;
      const S = LATRAISE_SHOULDER;
      return (
        <g>
          <path d={line(p([-70, 2, 0]), p([70, 2, 0]))} className={furnLine} strokeWidth={s(4)} />
          <rect
            x={p([-20, 0, 0])[0]}
            y={p([0, 8 + 15 * 7 + 4, 0])[1]}
            width={s(40)}
            height={s(15 * 7 + 4)}
            rx={3}
            className="fill-foreground/12 stroke-none"
          />
          <SeatFront c={c} top={45} />
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, S.y + 15, 0])[1]}
            width={s(34)}
            height={s(S.y + 15 - 53)}
            rx={6}
            className={furn}
          />
          {([0, 1] as const).map((i) => {
            const sg = i === 0 ? -1 : 1;
            const sh = pose.shoulders[i];
            const el = pose.elbows[i];
            const dx = el[0] - sh[0];
            const dy = el[1] - sh[1];
            const l = Math.hypot(dx, dy);
            const ux = dx / l;
            const uy = dy / l;
            // the pad sits on the outside of the elbow, square to the arm
            const cx = el[0] + ux * 6;
            const cy = el[1] + uy * 6;
            return (
              <g key={i}>
                <circle
                  cx={p([sg * 19, 0, 0])[0]}
                  cy={p([0, S.y, 0])[1]}
                  r={s(6.5)}
                  className="fill-none stroke-foreground/25"
                  strokeWidth={s(2)}
                />
                <path
                  d={line(p([sh[0], sh[1], 0]), p([cx, cy, 0]))}
                  className={leverCls}
                  strokeWidth={s(5)}
                />
                <path
                  d={line(p([cx - uy * 9, cy + ux * 9, 0]), p([cx + uy * 9, cy - ux * 9, 0]))}
                  className={padOuter}
                  strokeWidth={s(9)}
                />
                <path
                  d={line(p([cx - uy * 9, cy + ux * 9, 0]), p([cx + uy * 9, cy - ux * 9, 0]))}
                  className={padCore}
                  strokeWidth={s(6)}
                />
              </g>
            );
          })}
        </g>
      );
    },
    over: gripFront,
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      const S = LATRAISE_SHOULDER;
      const e = lateralProgress(c);
      const hub = p([0, S.y, LR_PIVOT_Z]);
      const el = c.pose.elbows[1];
      return (
        <g>
          <path
            d={line(p([0, 3, LR_STACK.z0 - 4]), p([0, 3, 58]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <SeatSide c={c} top={45} z0={-14} z1={30} zp={8} />
          <path
            d={line(p([0, 0, LR_PIVOT_Z]), p([0, S.y + 14, LR_PIVOT_Z]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <TorsoPad c={c} a0={0} a1={66} b={-13.5} />
          <StackSide
            c={c}
            z0={LR_STACK.z0}
            z1={LR_STACK.z1}
            n={LR_STACK.n}
            lifted={LR_STACK.lifted}
            lift={10 * e}
          />
          <path
            d={line(hub, p([0, 8 + 15 * 7 - 8 + 10 * e, (LR_STACK.z0 + LR_STACK.z1) / 2]))}
            className={leverCls}
            strokeWidth={s(4)}
          />
          {/* lever from the pivot forward to the pad at the elbow */}
          <path d={line(hub, p([0, el[1], el[2] + 4]))} className={leverCls} strokeWidth={s(5)} />
          <circle cx={hub[0]} cy={hub[1]} r={s(4.5)} className={pulleyFill} />
        </g>
      );
    },
    mid: (c) => {
      const { p, s, pose } = c;
      const el = pose.elbows[1];
      const w = pose.wrists[1];
      // the pad lies along the outside of the forearm, just below its line
      return (
        <g>
          <path
            d={line(p([0, el[1] - 3, el[2] + 2]), p([0, w[1] - 3, w[2] - 6]))}
            className={padOuter}
            strokeWidth={s(9)}
          />
          <path
            d={line(p([0, el[1] - 3, el[2] + 2]), p([0, w[1] - 3, w[2] - 6]))}
            className={padCore}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
    over: gripSide,
  },
};

export const EXTRAS_W13: Record<string, FigureExtra> = {
  "w13-plate-chest": pressMachine({
    geo: CHEST_PRESS,
    pivot: { y: 95, z: -46 },
    pivotX: 58,
    plates: { y: 62, z: -80, dy: 8, dz: -6 },
    seatTop: 44,
  }),
  "w13-stack-chest": pressMachine({
    geo: CHEST_PRESS,
    pivot: { y: 95, z: -46 },
    pivotX: 58,
    plates: { y: 62, z: -80, dy: 8, dz: -6 },
    seatTop: 44,
    stack: true,
  }),
  "w13-plate-incline": pressMachine({
    geo: INCLINE_PRESS,
    pivot: { y: 70, z: -80 },
    pivotX: 58,
    plates: { y: 56, z: -112, dy: 8, dz: -6 },
    seatTop: 40,
  }),
  "w13-plate-press": platePress,
  "w13-plate-row": plateRow,
  "w13-high-row": plateHighRow,
  "w13-tbar-machine": tBarMachine,
  "w13-lateral-machine": lateralMachine,
};

void CABLE_PRESS_PULLEY;
void TBAR_LEAN;
void MROW_LEVER;
