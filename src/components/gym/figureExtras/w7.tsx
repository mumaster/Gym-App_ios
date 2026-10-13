import {
  DECLINE_ANKLE_Z,
  DECLINE_BENCH_WIDTH,
  DECLINE_BENCH_Y,
  SISSY_SUPPORT,
} from "../../../lib/gym/exerciseAnimationW7";
import type { FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W7 (exerciseAnimationW7.ts). */
export const EXTRAS_W7: Record<string, FigureExtra> = {
  // Flat bench turned across the body under the toes (decline push-up): seen
  // from the side it is its 28 cm width, from the front the whole 92 cm.
  "w7-decline-bench": {
    side: {
      behind: ({ p, s }) => {
        const mid = DECLINE_ANKLE_Z + 3;
        const half = DECLINE_BENCH_WIDTH / 2;
        return (
          <g>
            <rect
              x={p([0, 0, mid - half])[0]}
              y={p([0, DECLINE_BENCH_Y, 0])[1]}
              width={s(DECLINE_BENCH_WIDTH)}
              height={s(9)}
              rx={4}
              className={furn}
            />
            <path
              d={line(p([0, DECLINE_BENCH_Y - 9, mid]), p([0, 0, mid]))}
              className={furnLine}
              strokeWidth={s(8)}
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
            y={p([0, DECLINE_BENCH_Y, 0])[1]}
            width={s(92)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          {[-38, 38].map((x) => (
            <path
              key={x}
              d={line(p([x, DECLINE_BENCH_Y - 9, 0]), p([x, 0, 0]))}
              className={furnLine}
              strokeWidth={s(7)}
            />
          ))}
        </g>
      ),
    },
  },
  // A sturdy upright (rack post or pole) beside the lifter, held with the near hand.
  "w7-support": {
    side: {
      behind: ({ p, s }) => (
        <g>
          <path
            d={line(p([0, 0, SISSY_SUPPORT.z]), p([0, SISSY_SUPPORT.top, SISSY_SUPPORT.z]))}
            className="stroke-foreground/25"
            strokeWidth={s(6)}
          />
          <path
            d={line(p([0, 1.5, SISSY_SUPPORT.z - 16]), p([0, 1.5, SISSY_SUPPORT.z + 16]))}
            className="stroke-foreground/25"
            strokeWidth={s(3)}
          />
        </g>
      ),
    },
    front: {
      behind: ({ p, s }) => (
        <g>
          <path
            d={line(p([SISSY_SUPPORT.x, 0, 0]), p([SISSY_SUPPORT.x, SISSY_SUPPORT.top, 0]))}
            className="stroke-foreground/25"
            strokeWidth={s(6)}
          />
          <path
            d={line(p([SISSY_SUPPORT.x - 14, 1.5, 0]), p([SISSY_SUPPORT.x + 14, 1.5, 0]))}
            className="stroke-foreground/25"
            strokeWidth={s(3)}
          />
        </g>
      ),
    },
  },
};
