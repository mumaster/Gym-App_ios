import {
  LANDMINE_BAR,
  LANDMINE_PIVOT_Y,
  LANDMINE_PIVOT_Z,
  LANDMINE_PLATES,
  landmineAngle,
} from "../../../lib/gym/exerciseAnimationW5";
import type { FigureExtra } from "../ExerciseFigureExtras";
import { line } from "../figureDraw";

const PLATE_R = 22.5;

/** Furniture and implements for animation batch W5 (exerciseAnimationW5.ts). */
export const EXTRAS_W5: Record<string, FigureExtra> = {
  // Barbell anchored in a floor landmine: a straight line from the pivot to
  // the plates, the pivot cup on the floor and the V-handle on the bar.
  "w5-landmine": {
    side: {
      behind: ({ pose, p, s }) => {
        const a = landmineAngle(pose.bar[1]);
        const at = (d: number) =>
          p([0, LANDMINE_PIVOT_Y + d * Math.sin(a), LANDMINE_PIVOT_Z + d * Math.cos(a)]);
        const pivot = p([0, LANDMINE_PIVOT_Y, LANDMINE_PIVOT_Z]);
        const plate = at(LANDMINE_PLATES);
        return (
          <g>
            <path
              d={line(p([0, 0, LANDMINE_PIVOT_Z - 6]), p([0, 0, LANDMINE_PIVOT_Z + 6]))}
              className="stroke-foreground/35"
              strokeWidth={s(5)}
            />
            <path
              d={line(pivot, at(LANDMINE_BAR))}
              className="stroke-foreground/50"
              strokeWidth={s(3)}
            />
            <circle cx={pivot[0]} cy={pivot[1]} r={s(3)} className="fill-foreground stroke-none" />
            <circle
              cx={plate[0]}
              cy={plate[1]}
              r={s(PLATE_R)}
              className="fill-primary/12 stroke-primary"
              strokeWidth={2}
            />
            <circle cx={plate[0]} cy={plate[1]} r={s(3)} className="fill-foreground stroke-none" />
          </g>
        );
      },
      over: ({ pose, p, s }) => {
        const w = p(pose.wrists[1]);
        return (
          <circle
            cx={w[0]}
            cy={w[1]}
            r={s(4)}
            className="fill-primary/40 stroke-primary"
            strokeWidth={2}
          />
        );
      },
    },
    front: {
      behind: ({ pose, p, s }) => {
        // Seen end-on: the bar runs away from us and down to the pivot, the
        // plates face us just in front of the hands.
        const a = landmineAngle(pose.bar[1]);
        const plate = p([0, LANDMINE_PIVOT_Y + LANDMINE_PLATES * Math.sin(a), 0]);
        const pivot = p([0, LANDMINE_PIVOT_Y, 0]);
        return (
          <g>
            <path d={line(pivot, plate)} className="stroke-foreground/50" strokeWidth={s(3)} />
            <circle
              cx={plate[0]}
              cy={plate[1]}
              r={s(PLATE_R)}
              className="fill-primary/12 stroke-primary"
              strokeWidth={2}
            />
          </g>
        );
      },
      over: ({ pose, p, s }) => {
        const l = p(pose.wrists[0]);
        const r = p(pose.wrists[1]);
        return (
          <g>
            <path d={line(l, r)} className="stroke-foreground" strokeWidth={3} />
            {[l, r].map((w, i) => (
              <circle
                key={i}
                cx={w[0]}
                cy={w[1]}
                r={s(4)}
                className="fill-primary/40 stroke-primary"
                strokeWidth={2}
              />
            ))}
          </g>
        );
      },
    },
  },
};
