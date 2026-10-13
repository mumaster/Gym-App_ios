import type { FigureExtra } from "../ExerciseFigureExtras";
import { line } from "../figureDraw";

/** Small plates for a bar lowered to the head (lying triceps extension), so
 *  the plate does not cover the face in the side view. */
const SMALL_PLATE_R = 11;

/** Implements for the near-copy animations in exerciseAnimations.ts. */
export const EXTRAS_VARIANTS: Record<string, FigureExtra> = {
  // A short bar with small plates, held in a narrow grip.
  "small-barbell": {
    front: {
      over: ({ pose, p, s }) => {
        const bar = p(pose.bar);
        return (
          <g>
            <path
              d={line([bar[0] - s(55), bar[1]], [bar[0] + s(55), bar[1]])}
              className="stroke-foreground"
              strokeWidth={3}
            />
            {[-1, 1].map((sg) => (
              <rect
                key={sg}
                x={bar[0] + sg * s(40) - s(3)}
                y={bar[1] - s(SMALL_PLATE_R)}
                width={s(6)}
                height={s(SMALL_PLATE_R * 2)}
                rx={3}
                className="fill-primary stroke-none"
              />
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
              r={s(SMALL_PLATE_R)}
              className="fill-primary/12 stroke-primary"
              strokeWidth={2}
            />
            <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
          </g>
        );
      },
    },
  },
  // A rope on a high pulley: the cable to a knot above the hands, then the
  // two rope ends down into each hand.
  rope: {
    front: {
      over: ({ model, pose, p, s }) => {
        const wl = p(pose.wrists[0]);
        const wr = p(pose.wrists[1]);
        const mid = p([0, (pose.wrists[0][1] + pose.wrists[1][1]) / 2 + 14, pose.bar[2]]);
        return (
          <g>
            {model.pulley && (
              <path
                d={line(mid, p([0, model.pulley.y, 0]))}
                className="stroke-foreground/50"
                strokeWidth={1.5}
              />
            )}
            <path
              d={`M${wl[0]},${wl[1] + s(3)} L${mid[0]},${mid[1]} L${wr[0]},${wr[1] + s(3)}`}
              className="fill-none stroke-foreground"
              strokeWidth={3}
              strokeLinejoin="round"
            />
            {[wl, wr].map((w, i) => (
              <circle
                key={i}
                cx={w[0]}
                cy={w[1] + s(4)}
                r={s(2.2)}
                className="fill-foreground stroke-none"
              />
            ))}
          </g>
        );
      },
    },
    side: {
      over: ({ model, pose, p }) => {
        const bar = p(pose.bar);
        return model.pulley ? (
          <g>
            <path
              d={line(bar, p([0, model.pulley.y, model.pulley.z]))}
              className="stroke-foreground/50"
              strokeWidth={1.5}
            />
            <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
          </g>
        ) : null;
      },
    },
  },
};
