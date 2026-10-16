import {
  CGP_APEX,
  CGP_PULLEY,
  CGP_ROD,
  CUR_PULLEY,
  HM_PLATE,
} from "../../../lib/gym/exerciseAnimationW16";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line, poly } from "../figureDraw";

/** Furniture and implements for animation batch W16 (exerciseAnimationW16.ts). */

const cableCls = "stroke-foreground/50";
const metal = "stroke-foreground";
const sign = (i: number): -1 | 1 => (i === 0 ? -1 : 1);

/* --------------------- close-grip pulldown V-handle ----------------------- */

/** A V-handle: two parallel grips (neutral grip) joined by a triangle that
 *  carries the cable. Front: grips end-on under the apex; side: one grip lying
 *  along z with the triangle above it. */
const vHandle: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const apex: [number, number] = [(wl[0] + wr[0]) / 2, wl[1] - s(CGP_APEX)];
      const top = p([0, CGP_PULLEY.y, 0]);
      return (
        <g>
          <path d={line(apex, top)} className={cableCls} strokeWidth={1.5} />
          <path d={poly(wl, apex, wr)} className="stroke-foreground/60" strokeWidth={2.5} />
          {[wl, wr].map((w, i) => (
            <circle key={i} cx={w[0]} cy={w[1]} r={s(3)} className="fill-foreground stroke-none" />
          ))}
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const w = pose.wrists[1]!;
      const rear = p([0, w[1], w[2] - CGP_ROD / 2]);
      const frontEnd = p([0, w[1], w[2] + CGP_ROD / 2]);
      const apex = p([0, w[1] + CGP_APEX, w[2]]);
      const top = p([0, CGP_PULLEY.y, CGP_PULLEY.z]);
      return (
        <g>
          <path d={line(apex, top)} className={cableCls} strokeWidth={1.5} />
          <path d={poly(rear, apex, frontEnd)} className="stroke-foreground/60" strokeWidth={2} />
          <path d={line(rear, frontEnd)} className={metal} strokeWidth={s(3.5)} />
        </g>
      );
    },
  },
};

/* ------------------------ low cable tower (upright row) ------------------- */

const lowTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const pu = CUR_PULLEY;
      const c = p([0, pu.y, 0]);
      return (
        <g>
          <path d={line(p([0, 0, 0]), p([0, 150, 0]))} className={furnLine} strokeWidth={s(9)} />
          <rect
            x={p([-24, 0, 0])[0]}
            y={p([0, 3, 0])[1]}
            width={s(48)}
            height={s(3)}
            rx={1.5}
            className={furn}
          />
          <rect
            x={c[0] - s(9)}
            y={c[1] - s(11)}
            width={s(18)}
            height={s(22)}
            rx={3}
            className="fill-foreground/20 stroke-none"
          />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s }) => {
      const pu = CUR_PULLEY;
      const back = pu.z + 12;
      return (
        <g>
          <path
            d={line(p([0, 0, back]), p([0, 160, back]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <path
            d={line(p([0, 2, 28]), p([0, 2, back + 12]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, pu.y, back]), p([0, pu.y, pu.z]))}
            className="stroke-foreground/25"
            strokeWidth={s(9)}
          />
          <circle
            cx={p([0, pu.y, pu.z])[0]}
            cy={p([0, pu.y, pu.z])[1]}
            r={s(5)}
            className="fill-foreground/35 stroke-none"
          />
        </g>
      );
    },
  },
};

/** Short straight bar held in both hands, cable from its middle to the low pulley. */
const lowBar: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const wl = p(pose.wrists[0]);
      const wr = p(pose.wrists[1]);
      const mid = p(pose.bar);
      return (
        <g>
          <path d={line(mid, p([0, CUR_PULLEY.y, 0]))} className={cableCls} strokeWidth={1.5} />
          <path
            d={line([wl[0] - s(11), wl[1]], [wr[0] + s(11), wr[1]])}
            className={metal}
            strokeWidth={3}
          />
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p }) => {
      const bar = p(pose.bar);
      return (
        <g>
          <path
            d={line(bar, p([0, CUR_PULLEY.y, CUR_PULLEY.z]))}
            className={cableCls}
            strokeWidth={1.5}
          />
          <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
};

/* ------------------- hip abduction / adduction machine -------------------- */

/** Pad height in the front view and its length along the thigh (cm). */
const PAD_H = 26;
const PAD_W = 7;
const PAD_ALONG = 0.47;
const PAD_THICK = 16;

/** The pads sit on the OUTSIDE (abduction) or the INSIDE (adduction) of the
 *  knees and lower thighs, on posts that rise from the foot rests; the foot
 *  rests are 3 cm plates that travel with the legs. The seat and back pad are
 *  the built-in `upright-bench`. */
function hipMachine(inner: boolean): FigureExtra {
  const padX = (kx: number, sg: number) => kx + (inner ? -sg : sg) * 9;
  /** The pad on the near thigh, drawn as a rounded slab lying along the thigh. */
  const sidePad = ({ pose, p, s }: DrawCtx, cls: string) => {
    const h = pose.hips[1]!;
    const k = pose.knees[1]!;
    const t = 0.97 - PAD_ALONG / 2;
    const c = p([0, h[1] + (k[1] - h[1]) * t, h[2] + (k[2] - h[2]) * t]);
    const a = p(h);
    const b = p(k);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * PAD_ALONG;
    const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    return (
      <rect
        x={-len / 2}
        y={-s(PAD_THICK) / 2}
        width={len}
        height={s(PAD_THICK)}
        rx={s(4)}
        transform={`translate(${c[0].toFixed(1)} ${c[1].toFixed(1)}) rotate(${deg.toFixed(1)})`}
        className={cls}
        strokeWidth={1.5}
      />
    );
  };
  return {
    front: {
      behind: ({ pose, p, s }) => (
        <g>
          <rect
            x={p([-52, 0, 0])[0]}
            y={p([0, 3, 0])[1]}
            width={s(104)}
            height={s(3)}
            rx={1.5}
            className={furn}
          />
          {[0, 1].map((i) => {
            const sg = sign(i);
            const k = pose.knees[i]!;
            const a = pose.ankles[i]!;
            const w = pose.wrists[i]!;
            const px = padX(k[0], sg);
            return (
              <g key={i}>
                <path
                  d={line(p([px, HM_PLATE, 0]), p([px, k[1] - PAD_H / 2 + 2, 0]))}
                  className="stroke-foreground/25"
                  strokeWidth={s(3.5)}
                />
                <rect
                  x={p([a[0] - 13, 0, 0])[0]}
                  y={p([0, HM_PLATE, 0])[1]}
                  width={s(26)}
                  height={s(HM_PLATE)}
                  rx={1.5}
                  className="fill-foreground/30 stroke-none"
                />
                <path
                  d={line(p([w[0], 45, 0]), p([w[0], w[1], 0]))}
                  className="stroke-foreground/25"
                  strokeWidth={s(3.5)}
                />
              </g>
            );
          })}
        </g>
      ),
      mid: ({ pose, p, s }) => (
        <g>
          {[0, 1].map((i) => {
            const k = pose.knees[i]!;
            const px = padX(k[0], sign(i));
            return (
              <rect
                key={i}
                x={p([px - PAD_W / 2, 0, 0])[0]}
                y={p([0, k[1] + PAD_H / 2, 0])[1]}
                width={s(PAD_W)}
                height={s(PAD_H)}
                rx={s(3)}
                className="fill-foreground/35 stroke-foreground/50"
                strokeWidth={1}
              />
            );
          })}
        </g>
      ),
      over: ({ pose, p, s }) => (
        <g>
          {[0, 1].map((i) => {
            const w = p(pose.wrists[i]!);
            return (
              <circle
                key={i}
                cx={w[0]}
                cy={w[1]}
                r={s(3)}
                className="fill-foreground stroke-none"
              />
            );
          })}
        </g>
      ),
    },
    side: {
      behind: (c) => {
        const { pose, p, s } = c;
        const a = pose.ankles[1]!;
        const w = pose.wrists[1]!;
        return (
          <g>
            <rect
              x={p([0, 0, -22])[0]}
              y={p([0, 3, 0])[1]}
              width={s(92)}
              height={s(3)}
              rx={1.5}
              className={furn}
            />
            <rect
              x={p([0, 0, a[2] - 14])[0]}
              y={p([0, HM_PLATE, 0])[1]}
              width={s(34)}
              height={s(HM_PLATE)}
              rx={1.5}
              className="fill-foreground/30 stroke-none"
            />
            <path
              d={line(p([0, 45, w[2]]), p([0, w[1], w[2]]))}
              className="stroke-foreground/25"
              strokeWidth={s(3.5)}
            />
            {/* the inner pad hides behind the thigh: only its rim shows */}
            {inner && sidePad(c, "fill-foreground/20 stroke-foreground/35")}
          </g>
        );
      },
      mid: (c) => (inner ? null : sidePad(c, "fill-foreground/25 stroke-foreground/50")),
      over: ({ pose, p, s }) => {
        const w = pose.wrists[1]!;
        return (
          <path
            d={line(p([0, w[1], w[2] - 6]), p([0, w[1], w[2] + 6]))}
            className="stroke-foreground/60"
            strokeWidth={s(3.5)}
          />
        );
      },
    },
  };
}

export const EXTRAS_W16: Record<string, FigureExtra> = {
  "w16-vhandle": vHandle,
  "w16-low-tower": lowTower,
  "w16-low-bar": lowBar,
  "w16-abduction": hipMachine(false),
  "w16-adduction": hipMachine(true),
};
