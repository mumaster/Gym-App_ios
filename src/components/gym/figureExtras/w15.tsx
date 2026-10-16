import {
  ACM_ARM,
  ACM_BACK,
  ACM_PAD_OFF,
  BT_BAR_Y,
  CC_HAND_X,
  CC_PAD_Z,
  CC_SHOULDER_Y,
  DS_PAD,
  RO_MAT_TOP,
  acmAxes,
  ccArms,
  dsPoint,
} from "../../../lib/gym/exerciseAnimationW15";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W15 (exerciseAnimationW15.ts). */

const padCls = "fill-foreground/30 stroke-none";
const leverCls = "stroke-foreground/45";
const chestPadCls = "stroke-foreground/55";
const handleCls = "stroke-foreground/60";

/* ----------------------------- captain's chair ---------------------------- */

const CC = ccArms();
/** Forearm pads: their top is just under the forearm. */
const CC_PAD_TOP = CC.elbow.y - 4;
const CC_PAD_FROM = -3;
const CC_PAD_TO = CC.wrist.z + 6;
const CC_BACK_BOTTOM = CC_SHOULDER_Y - 62;
const CC_BACK_TOP = CC_SHOULDER_Y + 27;

const ccFront = ({ p, s }: DrawCtx) => (
  <g>
    {/* base on the floor, spine behind the back rest */}
    <path d={line(p([-40, 1.5, 0]), p([40, 1.5, 0]))} className={furnLine} strokeWidth={s(4)} />
    <path
      d={line(p([0, 1.5, 0]), p([0, CC_BACK_BOTTOM, 0]))}
      className={furnLine}
      strokeWidth={s(8)}
    />
    <rect
      x={p([-16, 0, 0])[0]}
      y={p([0, CC_BACK_TOP, 0])[1]}
      width={s(32)}
      height={s(CC_BACK_TOP - CC_BACK_BOTTOM)}
      rx={s(5)}
      className={furn}
    />
    {/* arm rests with their handles */}
    {[-1, 1].map((sg) => (
      <g key={sg}>
        <rect
          x={p([sg * CC_HAND_X - 5, 0, 0])[0]}
          y={p([0, CC_PAD_TOP, 0])[1]}
          width={s(10)}
          height={s(7)}
          rx={s(3)}
          className={padCls}
        />
        <path
          d={line(p([sg * CC_HAND_X, CC_PAD_TOP - 7, 0]), p([sg * 8, CC_PAD_TOP - 18, 0]))}
          className={furnLine}
          strokeWidth={s(4)}
        />
      </g>
    ))}
  </g>
);

/** The arm rest and its handle in the side view. */
const ccPad = ({ p, s }: DrawCtx, cls: string) => (
  <g>
    <rect
      x={p([0, 0, CC_PAD_FROM])[0]}
      y={p([0, CC_PAD_TOP, 0])[1]}
      width={s(CC_PAD_TO - CC_PAD_FROM)}
      height={s(7)}
      rx={s(3)}
      className={cls}
    />
  </g>
);

const captainsChair: FigureExtra = {
  front: {
    behind: ccFront,
    over: ({ p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <path
            key={sg}
            d={line(p([sg * CC_HAND_X, CC_PAD_TOP, 0]), p([sg * CC_HAND_X, CC_PAD_TOP + 14, 0]))}
            className={handleCls}
            strokeWidth={s(3)}
          />
        ))}
      </g>
    ),
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      return (
        <g>
          {/* floor frame, spine, back rest */}
          <path
            d={line(p([0, 2, CC_PAD_Z - 38]), p([0, 2, CC_PAD_Z + 16]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 2, CC_PAD_Z - 9]), p([0, CC_BACK_BOTTOM, CC_PAD_Z - 9]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, CC_BACK_BOTTOM, CC_PAD_Z]), p([0, CC_BACK_TOP, CC_PAD_Z]))}
            className="stroke-foreground/15"
            strokeWidth={s(8)}
          />
          {/* beam under the arm rests, braced to the spine */}
          <path
            d={line(p([0, CC_PAD_TOP - 9, CC_PAD_Z - 9]), p([0, CC_PAD_TOP - 9, CC_PAD_TO - 4]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(
              p([0, CC_BACK_BOTTOM + 6, CC_PAD_Z - 9]),
              p([0, CC_PAD_TOP - 9, CC_PAD_Z + 14]),
            )}
            className={furnLine}
            strokeWidth={s(3)}
          />
          {ccPad(c, "fill-foreground/10 stroke-none")}
        </g>
      );
    },
    mid: (c) => ccPad(c, padCls),
    over: ({ p, s }) => (
      <path
        d={line(p([0, CC_PAD_TOP, CC.wrist.z]), p([0, CC_PAD_TOP + 14, CC.wrist.z]))}
        className={handleCls}
        strokeWidth={s(3)}
      />
    ),
  },
};

/* ------------------------------ ab crunch machine ------------------------- */

/** Pad centre, torso direction and hip of the current pose (side view y, z). */
function acmGeometry(pose: DrawCtx["pose"]) {
  const hip = pose.hips[1];
  const sh = pose.shoulders[1];
  const lean = (Math.atan2(sh[2] - hip[2], sh[1] - hip[1]) * 180) / Math.PI;
  const { dir, out } = acmAxes(lean);
  const along = Math.sqrt(ACM_ARM * ACM_ARM - ACM_PAD_OFF * ACM_PAD_OFF);
  return {
    hip,
    dir,
    out,
    pad: {
      y: hip[1] + along * dir.y + ACM_PAD_OFF * out.y,
      z: hip[2] + along * dir.z + ACM_PAD_OFF * out.z,
    },
  };
}

const PAD_HALF = 11;

const abMachine: FigureExtra = {
  front: {
    behind: ({ p, s, pose }) => {
      const hip = pose.hips[1];
      return (
        <g>
          <path
            d={line(p([-34, 1.5, 0]), p([34, 1.5, 0]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 1.5, 0]), p([0, hip[1] - 6, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <rect
            x={p([-19, 0, 0])[0]}
            y={p([0, hip[1] - 2, 0])[1]}
            width={s(38)}
            height={s(8)}
            rx={s(4)}
            className={furn}
          />
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, hip[1] + 66, 0])[1]}
            width={s(34)}
            height={s(68)}
            rx={s(6)}
            className="fill-foreground/10 stroke-none"
          />
        </g>
      );
    },
    mid: (c) => {
      const { p, s } = c;
      const g = acmGeometry(c.pose);
      const top = p([0, g.pad.y + PAD_HALF * g.dir.y, 0]);
      const bot = p([0, g.pad.y - PAD_HALF * g.dir.y, 0]);
      return (
        <g>
          {/* lever arms from the pivots beside the hips to the pad */}
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * 25, g.hip[1], 0]), p([sg * 25, g.pad.y, 0]))}
                className={leverCls}
                strokeWidth={s(4)}
              />
              <path
                d={line(p([sg * 25, g.pad.y, 0]), p([sg * 13, g.pad.y, 0]))}
                className={leverCls}
                strokeWidth={s(4)}
              />
              <circle
                cx={p([sg * 25, g.hip[1], 0])[0]}
                cy={p([sg * 25, g.hip[1], 0])[1]}
                r={s(4)}
                className="fill-foreground/50 stroke-none"
              />
            </g>
          ))}
          <rect
            x={p([-16, 0, 0])[0]}
            y={top[1]}
            width={s(32)}
            height={Math.max(2, bot[1] - top[1])}
            rx={s(5)}
            className="fill-foreground/45 stroke-none"
          />
        </g>
      );
    },
  },
  side: {
    behind: ({ p, s, pose }) => {
      const hip = pose.hips[1];
      const b = (ACM_BACK * Math.PI) / 180;
      // a cm up the tilted back pad, off cm behind its face
      const back = (a: number, off: number) =>
        p([
          0,
          hip[1] + a * Math.cos(b) - off * Math.sin(b),
          hip[2] - a * Math.sin(b) - off * Math.cos(b),
        ]);
      return (
        <g>
          <path d={line(p([0, 2, -40]), p([0, 2, 70]))} className={furnLine} strokeWidth={s(4)} />
          <path
            d={line(p([0, 2, -16]), p([0, hip[1] - 8, -16]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          {/* seat */}
          <rect
            x={p([0, 0, -14])[0]}
            y={p([0, hip[1] - 2, 0])[1]}
            width={s(48)}
            height={s(8)}
            rx={s(4)}
            className={furn}
          />
          {/* back pad, tilted back 10 degrees, and its support */}
          <path
            d={line(back(-4, 14), back(66, 14))}
            className="stroke-foreground/15"
            strokeWidth={s(8)}
          />
          <path
            d={line(p([0, hip[1] - 8, -16]), back(14, 18))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        </g>
      );
    },
    mid: (c) => {
      const { p, s } = c;
      const g = acmGeometry(c.pose);
      const a = p([0, g.pad.y + PAD_HALF * g.dir.y, g.pad.z + PAD_HALF * g.dir.z]);
      const b = p([0, g.pad.y - PAD_HALF * g.dir.y, g.pad.z - PAD_HALF * g.dir.z]);
      const pivot = p([0, g.hip[1], g.hip[2]]);
      return (
        <g>
          <path d={line(pivot, p([0, g.pad.y, g.pad.z]))} className={leverCls} strokeWidth={s(6)} />
          <path d={line(a, b)} className={chestPadCls} strokeWidth={s(12)} />
          <circle cx={pivot[0]} cy={pivot[1]} r={s(5)} className="fill-foreground/60 stroke-none" />
        </g>
      );
    },
    over: (c) => {
      const { p, s } = c;
      const w = p(c.pose.wrists[1]);
      const g = acmGeometry(c.pose);
      const foot = p([0, g.pad.y + 6 * g.dir.y, g.pad.z + 6 * g.dir.z]);
      return <path d={line(foot, w)} className={handleCls} strokeWidth={s(3)} />;
    },
  },
};

/* --------------------------------- rollout mat ---------------------------- */

const rolloutMat: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <rect
        x={p([-26, 0, 0])[0]}
        y={p([0, RO_MAT_TOP, 0])[1]}
        width={s(52)}
        height={s(RO_MAT_TOP)}
        rx={s(2)}
        className="fill-foreground/20 stroke-none"
      />
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <rect
        x={p([0, 0, -62])[0]}
        y={p([0, RO_MAT_TOP, 0])[1]}
        width={s(76)}
        height={s(RO_MAT_TOP)}
        rx={s(2)}
        className="fill-foreground/20 stroke-none"
      />
    ),
  },
};

/* ------------------------------ decline sit-up bench ---------------------- */

/** The roller on the front of the lower shin, and the post that holds it. */
function situpRoller(c: DrawCtx) {
  const kn = c.pose.knees[1];
  const an = c.pose.ankles[1];
  const dy = an[1] - kn[1];
  const dz = an[2] - kn[2];
  const l = Math.hypot(dy, dz);
  const ny = dz / l;
  const nz = -dy / l;
  return {
    y: kn[1] + dy * 0.9 + ny * 6.5,
    z: kn[2] + dz * 0.9 + nz * 6.5,
    holderZ: an[2] + 17,
  };
}
const DS_HEAD_END = DS_PAD.from;
const DS_FOOT_END = DS_PAD.to;

const declineSitupBench: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const head = dsPoint(DS_HEAD_END, -4);
      const foot = dsPoint(DS_FOOT_END, -4);
      return (
        <g>
          <rect
            x={p([-14, 0, 0])[0]}
            y={p([0, foot.y + 4, 0])[1]}
            width={s(28)}
            height={s(foot.y - head.y + 8)}
            rx={s(5)}
            className={furn}
          />
          <path
            d={line(p([0, head.y - 4, 0]), p([0, 0, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
        </g>
      );
    },
    mid: (c) => {
      const r = situpRoller(c);
      return (
        <rect
          x={c.p([-22, 0, 0])[0]}
          y={c.p([0, r.y + 4.5, 0])[1]}
          width={c.s(44)}
          height={c.s(9)}
          rx={c.s(4)}
          className={padCls}
        />
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      const r = situpRoller(c);
      const at = (a: number, out: number) => {
        const q = dsPoint(a, out);
        return p([0, q.y, q.z]);
      };
      const postA = dsPoint(-62, -8);
      const postB = dsPoint(38, -8);
      return (
        <g>
          <path
            d={line(at(DS_HEAD_END, -5), at(DS_FOOT_END, -5))}
            className="stroke-foreground/25"
            strokeWidth={s(10)}
          />
          {[postA, postB].map((q, i) => (
            <g key={i}>
              <path
                d={line(p([0, q.y, q.z]), p([0, 0, q.z]))}
                className={furnLine}
                strokeWidth={s(7)}
              />
              <path
                d={line(p([0, 2, q.z - 18]), p([0, 2, q.z + 18]))}
                className={furnLine}
                strokeWidth={s(5)}
              />
            </g>
          ))}
          {/* leg holder: a post behind the feet and an arm to the roller */}
          <path
            d={line(p([0, 0, r.holderZ]), p([0, r.y + 14, r.holderZ]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, r.y + 14, r.holderZ]), p([0, r.y, r.z]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 2, r.holderZ - 14]), p([0, 2, r.holderZ + 14]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        </g>
      );
    },
    mid: (c) => {
      const r = situpRoller(c);
      const pc = c.p([0, r.y, r.z]);
      return <circle cx={pc[0]} cy={pc[1]} r={c.s(5)} className="fill-foreground/35 stroke-none" />;
    },
  },
};

/* --------------------------------- waist-high bar ------------------------- */

const lowBar: FigureExtra = {
  front: {
    behind: ({ p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <g key={sg}>
            <path
              d={line(p([sg * 58, 0, 0]), p([sg * 58, BT_BAR_Y + 9, 0]))}
              className={furnLine}
              strokeWidth={s(6)}
            />
            <path
              d={line(p([sg * 58 - 14, 1.5, 0]), p([sg * 58 + 14, 1.5, 0]))}
              className={furnLine}
              strokeWidth={s(4)}
            />
          </g>
        ))}
        <path
          d={line(p([-58, BT_BAR_Y, 0]), p([58, BT_BAR_Y, 0]))}
          className="stroke-foreground/50"
          strokeWidth={s(3.5)}
        />
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <path
          d={line(p([0, 0, 0]), p([0, BT_BAR_Y + 9, 0]))}
          className={furnLine}
          strokeWidth={s(6)}
        />
        <path d={line(p([0, 1.5, -26]), p([0, 1.5, 26]))} className={furnLine} strokeWidth={s(4)} />
      </g>
    ),
    over: ({ p, s }) => (
      <circle
        cx={p([0, BT_BAR_Y, 0])[0]}
        cy={p([0, BT_BAR_Y, 0])[1]}
        r={s(2.6)}
        className="fill-foreground stroke-none"
      />
    ),
  },
};

export const EXTRAS_W15: Record<string, FigureExtra> = {
  "w15-captains-chair": captainsChair,
  "w15-ab-machine": abMachine,
  "w15-rollout-mat": rolloutMat,
  "w15-decline-situp-bench": declineSitupBench,
  "w15-low-bar": lowBar,
};
