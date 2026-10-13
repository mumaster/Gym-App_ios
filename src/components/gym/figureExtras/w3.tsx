import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W3 (exerciseAnimationW3.ts). */

/** The 45 degree incline bench, drawn like the shared `incline-bench`. */
const inclineBenchFront = ({ p, s }: DrawCtx) => (
  <g>
    <rect
      x={p([-16, 0, 0])[0]}
      y={p([0, 112, 0])[1]}
      width={s(32)}
      height={s(66)}
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

const inclineBenchSide = ({ p, s }: DrawCtx) => (
  <g>
    <path
      d={line(p([0, 41, -9]), p([0, 100, -66]))}
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
);

/** Smith machine: rails at this x (front view) and the z of the bar (side view). */
const SMITH_X = 60;
const SMITH_TOP = 150;
const SMITH_Z = -35.4 + 9.9;

export const EXTRAS_W3: Record<string, FigureExtra> = {
  /** Incline bench with a rack: two uprights beside the bar ends. */
  "w3-incline-rack": {
    front: {
      behind: (c) => (
        <g>
          {inclineBenchFront(c)}
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(c.p([sg * 66, 0, 0]), c.p([sg * 66, 138, 0]))}
                className={furnLine}
                strokeWidth={c.s(6)}
              />
              <path
                d={line(c.p([sg * 66, 118, 0]), c.p([sg * 56, 118, 0]))}
                className={furnLine}
                strokeWidth={c.s(4)}
              />
            </g>
          ))}
        </g>
      ),
    },
    side: {
      behind: (c) => (
        <g>
          {inclineBenchSide(c)}
          <path
            d={line(c.p([0, 0, -72]), c.p([0, 138, -72]))}
            className={furnLine}
            strokeWidth={c.s(6)}
          />
          <path
            d={line(c.p([0, 118, -72]), c.p([0, 118, -60]))}
            className={furnLine}
            strokeWidth={c.s(4)}
          />
          <path
            d={line(c.p([0, 3, -80]), c.p([0, 3, -64]))}
            className={furnLine}
            strokeWidth={c.s(6)}
          />
        </g>
      ),
    },
  },
  /** Incline bench inside a Smith machine: two vertical guide rails. */
  "w3-smith-incline": {
    front: {
      behind: (c) => (
        <g>
          {inclineBenchFront(c)}
          {[-1, 1].map((sg) => (
            <path
              key={sg}
              d={line(c.p([sg * SMITH_X, 0, 0]), c.p([sg * SMITH_X, SMITH_TOP, 0]))}
              className="stroke-foreground/25"
              strokeWidth={c.s(5)}
            />
          ))}
          <path
            d={line(c.p([-SMITH_X, SMITH_TOP, 0]), c.p([SMITH_X, SMITH_TOP, 0]))}
            className={furnLine}
            strokeWidth={c.s(5)}
          />
        </g>
      ),
    },
    side: {
      behind: (c) => (
        <g>
          {inclineBenchSide(c)}
          <path
            d={line(c.p([0, 0, SMITH_Z]), c.p([0, SMITH_TOP, SMITH_Z]))}
            className="stroke-foreground/25"
            strokeWidth={c.s(5)}
          />
          <path
            d={line(c.p([0, SMITH_TOP, SMITH_Z]), c.p([0, SMITH_TOP, SMITH_Z + 18]))}
            className={furnLine}
            strokeWidth={c.s(5)}
          />
          <path
            d={line(c.p([0, 3, SMITH_Z - 14]), c.p([0, 3, SMITH_Z + 14]))}
            className={furnLine}
            strokeWidth={c.s(6)}
          />
        </g>
      ),
    },
  },
  /** Smith bar: a short bar between the rails, plates outside, carriages on the rails. */
  "w3-smith-bar": {
    front: {
      over: ({ pose, p, s }) => {
        const bar = p(pose.bar);
        return (
          <g>
            <path
              d={line([bar[0] - s(72), bar[1]], [bar[0] + s(72), bar[1]])}
              className="stroke-foreground"
              strokeWidth={3}
            />
            {[-1, 1].map((sg) => (
              <g key={sg}>
                <rect
                  x={bar[0] + sg * s(66) - s(3)}
                  y={bar[1] - s(22.5)}
                  width={s(6)}
                  height={s(45)}
                  rx={3}
                  className="fill-primary stroke-none"
                />
                <rect
                  x={bar[0] + sg * s(SMITH_X) - s(3.5)}
                  y={bar[1] - s(5)}
                  width={s(7)}
                  height={s(10)}
                  rx={2}
                  className="fill-foreground/60 stroke-none"
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
              r={s(22.5)}
              className="fill-primary/12 stroke-primary"
              strokeWidth={2}
            />
            <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
          </g>
        );
      },
    },
  },
};
