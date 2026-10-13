import {
  RDF_TOWER,
  SSP_BAR_Z,
  SSP_PLATE_R,
  SRDL_BAR_Z,
} from "../../../lib/gym/exerciseAnimationW11";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";
import { EXTRAS_W3 } from "./w3";
import { smithFrame } from "./w6";

/** Furniture and implements for animation batch W11 (exerciseAnimationW11.ts). */

const pulleyFill = "fill-foreground/30 stroke-none";
const cableCls = "stroke-foreground/50";
const dot = "fill-foreground stroke-none";

/* ------------------- rear delt fly: tower on the far side ----------------- */

const rdfTower: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const t = RDF_TOWER;
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
      const t = RDF_TOWER;
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

const rdfHandle: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const t = RDF_TOWER;
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
      const t = RDF_TOWER;
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

/* ----------------- Smith machine with an upright bench ------------------- */

const sspFrame = smithFrame(176, SSP_BAR_Z);

const uprightFront = ({ p, s }: DrawCtx) => (
  <g>
    <rect
      x={p([-17, 0, 0])[0]}
      y={p([0, 118, 0])[1]}
      width={s(34)}
      height={s(70)}
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
  </g>
);

const uprightSide = ({ p, s }: DrawCtx) => (
  <g>
    <rect
      x={p([0, 0, -12])[0]}
      y={p([0, 45, 0])[1]}
      width={s(48)}
      height={s(8)}
      rx={4}
      className={furn}
    />
    <path
      d={line(p([0, 48, -11]), p([0, 120, -20]))}
      className="stroke-foreground/15"
      strokeWidth={s(9)}
    />
    <path d={line(p([0, 45, 6]), p([0, 0, 6]))} className={furnLine} strokeWidth={s(8)} />
  </g>
);

const smithSeat: FigureExtra = {
  front: {
    behind: (c) => (
      <g>
        {sspFrame.front!.behind!(c)}
        {uprightFront(c)}
      </g>
    ),
  },
  side: {
    behind: (c) => (
      <g>
        {sspFrame.side!.behind!(c)}
        {uprightSide(c)}
      </g>
    ),
  },
};

/** The Smith bar with small plates, so the plate circle stays clear of the face. */
const smithBarSmall: FigureExtra = {
  front: EXTRAS_W3["w3-smith-bar"]!.front!,
  side: {
    over: ({ pose, p, s }) => {
      const bar = p(pose.bar);
      return (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1]}
            r={s(SSP_PLATE_R)}
            className="fill-primary/12 stroke-primary"
            strokeWidth={2}
          />
          <circle cx={bar[0]} cy={bar[1]} r={3} className="fill-foreground stroke-none" />
        </g>
      );
    },
  },
};

export const EXTRAS_W11: Record<string, FigureExtra> = {
  "w11-rdf-tower": rdfTower,
  "w11-rdf-handle": rdfHandle,
  "w11-smith-seat": smithSeat,
  "w11-smith-bar-small": smithBarSmall,
  // Smith frame for the Romanian deadlift: rails at the bar's z, top at 150.
  "w11-smith-rdl": smithFrame(150, SRDL_BAR_Z),
};
