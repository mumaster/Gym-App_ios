import {
  BACK_EXT_HIP,
  BACK_EXT_TILT,
  NORDIC_KNEE_Y,
  NORDIC_PAD_TOP,
} from "../../../lib/gym/exerciseAnimationW2";
import type { FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W2 (exerciseAnimationW2.ts). */

const pad = "stroke-foreground/40";

/** Point on the 45 degree hyperextension bench: `a` cm along the body line from
 *  the hip joint (towards the head), `b` cm out of the body's front. */
const hyperPoint = (a: number, b: number) => {
  const r = (BACK_EXT_TILT * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { y: BACK_EXT_HIP.y + a * s - b * c, z: BACK_EXT_HIP.z + a * c + b * s };
};

/** Where the legs end: hip to ankle along the leg line. */
const ANKLE_A = -88;
const RAIL_B = 22;
const PLATE_A = ANKLE_A - 7;

export const EXTRAS_W2: Record<string, FigureExtra> = {
  /** Kneeling pad with the ankle roller on a post behind (nordic curl). */
  "w2-nordic-rig": {
    side: {
      behind: ({ pose, p, s }) => {
        const an = pose.ankles[1];
        const roller = p([0, an[1] + 9.5, an[2] + 2]);
        const post = p([0, 0, an[2] - 24]);
        return (
          <g>
            <rect
              x={p([0, 0, an[2] - 18])[0]}
              y={p([0, NORDIC_PAD_TOP, 0])[1]}
              width={s(-an[2] + 18 + 14)}
              height={s(NORDIC_PAD_TOP)}
              rx={s(2)}
              className={furn}
            />
            <path
              d={line(post, p([0, an[1] + 9.5, an[2] - 24]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
            <path
              d={line(p([0, an[1] + 9.5, an[2] - 24]), roller)}
              className={furnLine}
              strokeWidth={s(4)}
            />
            <path
              d={line(p([0, 0, an[2] - 33]), p([0, 0, an[2] - 14]))}
              className={furnLine}
              strokeWidth={s(3)}
            />
          </g>
        );
      },
      mid: ({ pose, p, s }) => {
        const an = pose.ankles[1];
        const c = p([0, an[1] + 9.5, an[2] + 2]);
        return <circle cx={c[0]} cy={c[1]} r={s(4.5)} className="fill-foreground/35 stroke-none" />;
      },
    },
    front: {
      behind: ({ p, s }) => {
        const top = NORDIC_KNEE_Y + 14;
        return (
          <g>
            <rect
              x={p([-22, 0, 0])[0]}
              y={p([0, NORDIC_PAD_TOP, 0])[1]}
              width={s(44)}
              height={s(NORDIC_PAD_TOP)}
              rx={s(2)}
              className={furn}
            />
            {[-20, 20].map((x) => (
              <path
                key={x}
                d={line(p([x, 0, 0]), p([x, top + 3, 0]))}
                className={furnLine}
                strokeWidth={s(4)}
              />
            ))}
          </g>
        );
      },
      over: ({ pose, p, s }) => {
        const y = pose.ankles[1][1] + 9.5;
        return (
          <rect
            x={p([-20, 0, 0])[0]}
            y={p([0, y + 4.5, 0])[1]}
            width={s(40)}
            height={s(9)}
            rx={s(4.5)}
            className="fill-foreground/25 stroke-none"
          />
        );
      },
    },
  },
  /** 45 degree hyperextension bench: footplate, ankle pad, hip pad, rails and posts. */
  "w2-hyper-bench": {
    side: {
      behind: ({ p, s }) => {
        const P = (a: number, b: number) => {
          const v = hyperPoint(a, b);
          return p([0, v.y, v.z]);
        };
        const rear = hyperPoint(PLATE_A, RAIL_B);
        const front = hyperPoint(-4, RAIL_B);
        return (
          <g>
            {/* posts and floor rail */}
            <path
              d={line(p([0, 0, rear.z - 12]), p([0, 0, front.z + 12]))}
              className={furnLine}
              strokeWidth={s(3)}
            />
            <path
              d={line(p([0, rear.y, rear.z]), p([0, 0, rear.z]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
            <path
              d={line(p([0, front.y, front.z]), p([0, 0, front.z]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
            {/* the inclined frame under the legs */}
            <path
              d={line(P(PLATE_A, RAIL_B), P(-2, RAIL_B))}
              className="stroke-foreground/25"
              strokeWidth={s(5)}
            />
            {/* hip pad on a riser, just below the hip crease */}
            <path d={line(P(-18, 14), P(-18, RAIL_B))} className={furnLine} strokeWidth={s(5)} />
            <path d={line(P(-9, 9.5), P(-26, 9.5))} className={pad} strokeWidth={s(9)} />
            {/* footplate (square to the legs) with the arm that carries the ankle pad */}
            <path
              d={line(P(PLATE_A, -14), P(PLATE_A, RAIL_B))}
              className={pad}
              strokeWidth={s(4)}
            />
            <path
              d={line(P(PLATE_A, -14), P(ANKLE_A + 8, -14))}
              className={furnLine}
              strokeWidth={s(3)}
            />
          </g>
        );
      },
      mid: ({ p, s }) => {
        const v = hyperPoint(ANKLE_A + 8, -9.5);
        const c = p([0, v.y, v.z]);
        return <circle cx={c[0]} cy={c[1]} r={s(4.5)} className="fill-foreground/40 stroke-none" />;
      },
    },
    front: {
      behind: ({ p, s }) => {
        const yAt = (a: number, b: number) => hyperPoint(a, b).y;
        const yTop = yAt(PLATE_A, -14);
        const yBottom = yAt(PLATE_A, RAIL_B);
        return (
          <g>
            {[-18, 18].map((x) => (
              <path
                key={x}
                d={line(p([x, yBottom, 0]), p([x, yAt(-4, RAIL_B), 0]))}
                className={furnLine}
                strokeWidth={s(5)}
              />
            ))}
            {/* footplate */}
            <rect
              x={p([-22, 0, 0])[0]}
              y={p([0, yTop, 0])[1]}
              width={s(44)}
              height={s(yTop - yBottom)}
              rx={s(2)}
              className={furn}
            />
            {/* hip pad */}
            <rect
              x={p([-17, 0, 0])[0]}
              y={p([0, yAt(-4, 9.5), 0])[1]}
              width={s(34)}
              height={s(yAt(-4, 9.5) - yAt(-32, 9.5))}
              rx={s(4)}
              className="fill-foreground/25 stroke-none"
            />
          </g>
        );
      },
      over: ({ p, s }) => {
        const y = hyperPoint(ANKLE_A + 8, -9.5).y;
        return (
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, y + 4.5, 0])[1]}
            width={s(34)}
            height={s(9)}
            rx={s(4.5)}
            className="fill-foreground/25 stroke-none"
          />
        );
      },
    },
  },
};
