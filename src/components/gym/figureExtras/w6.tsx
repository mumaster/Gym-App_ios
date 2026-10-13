import {
  DECLINE_SHOULDER,
  HACK_PLATFORM_Y,
  HACK_TRAVEL,
  MACHINE_PRESS_SHOULDER,
  SMITH_FLAT_Z,
  SMITH_SQUAT_BAR_Z,
  arnoldProgress,
  arnoldTurn,
  declinePoint,
  hackPoint,
} from "../../../lib/gym/exerciseAnimationW6";
import { ROW_BENCH_Y } from "../../../lib/gym/exerciseAnimation";
import type { DrawCtx, FigureExtra } from "../ExerciseFigureExtras";
import { furn, furnLine, line } from "../figureDraw";

/** Furniture and implements for animation batch W6 (exerciseAnimationW6.ts). */

const railCls = "stroke-foreground/25";
const padCls = "fill-foreground/30 stroke-none";
const gripCls = "stroke-foreground";

/** Rail x (front view) of the Smith machine, matching the carriages drawn by
 *  the shared `w3-smith-bar` implement. */
const SMITH_X = 60;

/* --------------------------- Smith machine frame ------------------------- */

/** Front: two vertical rails and the top beam. Side: one rail at `z`, a brace
 *  at the top and a floor foot. */
const smithFrame = (top: number, z: number): FigureExtra => ({
  front: {
    behind: ({ p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <path
            key={sg}
            d={line(p([sg * SMITH_X, 0, 0]), p([sg * SMITH_X, top, 0]))}
            className={railCls}
            strokeWidth={s(5)}
          />
        ))}
        <path
          d={line(p([-SMITH_X, top, 0]), p([SMITH_X, top, 0]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
        {[-1, 1].map((sg) => (
          <path
            key={sg}
            d={line(p([sg * (SMITH_X - 8), 0, 0]), p([sg * (SMITH_X + 8), 0, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        ))}
      </g>
    ),
  },
  side: {
    behind: ({ p, s }) => (
      <g>
        <path d={line(p([0, 0, z]), p([0, top, z]))} className={railCls} strokeWidth={s(5)} />
        <path
          d={line(p([0, top, z]), p([0, top, z - 18]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
        <path
          d={line(p([0, 3, z - 18]), p([0, 3, z + 14]))}
          className={furnLine}
          strokeWidth={s(6)}
        />
      </g>
    ),
  },
});

const flatBenchFront = ({ p, s }: DrawCtx) => (
  <g>
    <rect
      x={p([-14, 0, 0])[0]}
      y={p([0, ROW_BENCH_Y, 0])[1]}
      width={s(28)}
      height={s(9)}
      rx={4}
      className={furn}
    />
    <path
      d={line(p([0, ROW_BENCH_Y - 9, 0]), p([0, 0, 0]))}
      className={furnLine}
      strokeWidth={s(8)}
    />
  </g>
);

const flatBenchSide = ({ p, s }: DrawCtx) => (
  <g>
    <rect
      x={p([0, 0, -42])[0]}
      y={p([0, ROW_BENCH_Y, 0])[1]}
      width={s(92)}
      height={s(9)}
      rx={4}
      className={furn}
    />
    {[-32, 38].map((z) => (
      <path
        key={z}
        d={line(p([0, ROW_BENCH_Y - 9, z]), p([0, 0, z]))}
        className={furnLine}
        strokeWidth={s(7)}
      />
    ))}
  </g>
);

const smithFlat = smithFrame(138, SMITH_FLAT_Z);
const smithSquat = smithFrame(182, SMITH_SQUAT_BAR_Z);

/* ------------------------------ decline bench ---------------------------- */

const RACK_Z = DECLINE_SHOULDER.z - 40;
const RACK_TOP = DECLINE_SHOULDER.y + 62;

/** The roller that holds the ankle: on the front of the lower shin. */
function roller(c: DrawCtx) {
  const kn = c.pose.knees[1];
  const an = c.pose.ankles[1];
  const dy = an[1] - kn[1];
  const dz = an[2] - kn[2];
  const l = Math.hypot(dy, dz);
  // Unit normal on the upper side of the shin.
  const ny = dz / l;
  const nz = -dy / l;
  const y = kn[1] + dy * 0.9 + ny * 6.5;
  const z = kn[2] + dz * 0.9 + nz * 6.5;
  return { y, z, ny, nz };
}

const declineBench: FigureExtra = {
  front: {
    behind: ({ p, s }) => {
      const head = declinePoint(-30, -14);
      const hip = declinePoint(92, -14);
      return (
        <g>
          <rect
            x={p([-14, 0, 0])[0]}
            y={p([0, hip.y, 0])[1]}
            width={s(28)}
            height={s(hip.y - head.y + 8)}
            rx={5}
            className={furn}
          />
          <path
            d={line(p([0, head.y - 8, 0]), p([0, 0, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          {[-1, 1].map((sg) => (
            <g key={sg}>
              <path
                d={line(p([sg * 66, 0, 0]), p([sg * 66, RACK_TOP, 0]))}
                className={furnLine}
                strokeWidth={s(6)}
              />
              <path
                d={line(
                  p([sg * 66, DECLINE_SHOULDER.y + 46, 0]),
                  p([sg * 56, DECLINE_SHOULDER.y + 46, 0]),
                )}
                className={furnLine}
                strokeWidth={s(4)}
              />
            </g>
          ))}
        </g>
      );
    },
    mid: (c) => {
      const r = roller(c);
      return (
        <rect
          x={c.p([-22, 0, 0])[0]}
          y={c.p([0, r.y + 4.5, 0])[1]}
          width={c.s(44)}
          height={c.s(9)}
          rx={4}
          className={padCls}
        />
      );
    },
  },
  side: {
    behind: (c) => {
      const { p, s } = c;
      const r = roller(c);
      const a = (t: number, out: number) => {
        const q = declinePoint(t, out);
        return p([0, q.y, q.z]);
      };
      const postA = declinePoint(-22, -18);
      const postB = declinePoint(70, -18);
      const holderZ = c.pose.ankles[1][2] + 16;
      return (
        <g>
          <path
            d={line(a(-30, -14), a(92, -14))}
            className="stroke-foreground/15"
            strokeWidth={s(8)}
          />
          {[postA, postB].map((q, i) => (
            <g key={i}>
              <path
                d={line(p([0, q.y, q.z]), p([0, 0, q.z]))}
                className={furnLine}
                strokeWidth={s(7)}
              />
              <path
                d={line(p([0, 3, q.z - 18]), p([0, 3, q.z + 18]))}
                className={furnLine}
                strokeWidth={s(6)}
              />
            </g>
          ))}
          {/* leg holder: a post behind the feet and an arm to the roller */}
          <path
            d={line(p([0, 0, holderZ]), p([0, r.y + 14, holderZ]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, r.y + 14, holderZ]), p([0, r.y, r.z]))}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 3, holderZ - 14]), p([0, 3, holderZ + 14]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          {/* rack upright with a hook for the bar */}
          <path
            d={line(p([0, 0, RACK_Z]), p([0, RACK_TOP, RACK_Z]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(
              p([0, DECLINE_SHOULDER.y + 46, RACK_Z]),
              p([0, DECLINE_SHOULDER.y + 46, RACK_Z + 12]),
            )}
            className={furnLine}
            strokeWidth={s(4)}
          />
          <path
            d={line(p([0, 3, RACK_Z - 12]), p([0, 3, RACK_Z + 12]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
    mid: (c) => {
      const r = roller(c);
      const q = c.p([0, r.y, r.z]);
      return <circle cx={q[0]} cy={q[1]} r={c.s(4.5)} className={padCls} />;
    },
  },
};

/* --------------------------- machine shoulder press ---------------------- */

const MP_TOP = 172;
const MP_RAIL_X = 46;
const MP_COL_Z = MACHINE_PRESS_SHOULDER.z - 34;

const pressMachine: FigureExtra = {
  front: {
    behind: ({ pose, p, s }) => (
      <g>
        {[-1, 1].map((sg) => (
          <path
            key={sg}
            d={line(p([sg * MP_RAIL_X, 0, 0]), p([sg * MP_RAIL_X, MP_TOP, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
        ))}
        <path
          d={line(p([-MP_RAIL_X, MP_TOP, 0]), p([MP_RAIL_X, MP_TOP, 0]))}
          className={furnLine}
          strokeWidth={s(5)}
        />
        {([0, 1] as const).map((i) => {
          const sg = i === 0 ? -1 : 1;
          const w = pose.wrists[i];
          return (
            <g key={i}>
              <path
                d={line(p([sg * MP_RAIL_X, w[1], 0]), p([w[0], w[1], 0]))}
                className={railCls}
                strokeWidth={s(5)}
              />
              <rect
                x={p([sg * MP_RAIL_X, 0, 0])[0] - s(4)}
                y={p([0, w[1] + 6, 0])[1]}
                width={s(8)}
                height={s(12)}
                rx={2}
                className="fill-foreground/40 stroke-none"
              />
            </g>
          );
        })}
      </g>
    ),
    over: ({ pose, p, s }) => (
      <g>
        {([0, 1] as const).map((i) => {
          // Parallel grips point at you: seen end-on.
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
    behind: ({ pose, p, s }) => {
      const w = pose.wrists[1];
      return (
        <g>
          <path
            d={line(p([0, 0, MP_COL_Z]), p([0, MP_TOP, MP_COL_Z]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, 3, MP_COL_Z - 16]), p([0, 3, 12]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([0, w[1], MP_COL_Z]), p([0, w[1], w[2]]))}
            className={railCls}
            strokeWidth={s(5)}
          />
          <rect
            x={p([0, 0, MP_COL_Z])[0] - s(5)}
            y={p([0, w[1] + 7, 0])[1]}
            width={s(10)}
            height={s(14)}
            rx={2}
            className="fill-foreground/40 stroke-none"
          />
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

/* -------------------------------- hack squat ----------------------------- */

const HACK_RAIL_OFF = -24;
const HACK_PAD_OFF = -14.5;
const HACK_RAIL_END = HACK_TRAVEL + 70;

const hackSquat: FigureExtra = {
  front: {
    behind: ({ pose, p, s }) => {
      const sh = pose.shoulders[1];
      const hip = pose.hips[1];
      return (
        <g>
          <rect
            x={p([-34, 0, 0])[0]}
            y={p([0, HACK_PLATFORM_Y, 0])[1]}
            width={s(68)}
            height={s(HACK_PLATFORM_Y)}
            rx={2}
            className={furn}
          />
          {[-1, 1].map((sg) => (
            <path
              key={sg}
              d={line(p([sg * 42, 0, 0]), p([sg * 42, 140, 0]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
          ))}
          <rect
            x={p([-17, 0, 0])[0]}
            y={p([0, sh[1] + 16, 0])[1]}
            width={s(34)}
            height={s(sh[1] + 16 - hip[1] + 10)}
            rx={6}
            className={furn}
          />
        </g>
      );
    },
    mid: ({ pose, p, s }) => {
      const sh = pose.shoulders[1];
      return (
        <g>
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={p([sg * 19 - 11, 0, 0])[0]}
              y={p([0, sh[1] + 9, 0])[1]}
              width={s(22)}
              height={s(7)}
              rx={3}
              className="fill-foreground/35 stroke-none"
            />
          ))}
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
              d={line([w[0], w[1] - s(6)], [w[0], w[1] + s(6)])}
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
      const pt = (t: number, a: number, out: number) => {
        const q = hackPoint(t, a, out);
        return p([0, q.y, q.z]);
      };
      const hip = pose.hips[1];
      const sh = pose.shoulders[1];
      const len = Math.hypot(sh[2] - hip[2], sh[1] - hip[1]);
      const ux = (sh[2] - hip[2]) / len; // z of the unit vector up the pad
      const uy = (sh[1] - hip[1]) / len;
      const onPad = (a: number, out: number) =>
        p([0, hip[1] + a * uy + out * -ux, hip[2] + a * ux + out * uy]);
      const post = hackPoint(70, 0, HACK_RAIL_OFF);
      return (
        <g>
          <path d={line(p([0, 3, -122]), p([0, 3, 46]))} className={furnLine} strokeWidth={s(6)} />
          <rect
            x={p([0, 0, -14])[0]}
            y={p([0, HACK_PLATFORM_Y, 0])[1]}
            width={s(54)}
            height={s(HACK_PLATFORM_Y)}
            rx={2}
            className={furn}
          />
          {/* the two rails and the posts that hold them */}
          <path
            d={line(pt(-38, 0, HACK_RAIL_OFF), pt(HACK_RAIL_END, 0, HACK_RAIL_OFF))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([0, post.y, post.z]), p([0, 0, post.z]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          {(() => {
            const end = hackPoint(HACK_RAIL_END, 0, HACK_RAIL_OFF);
            return (
              <path
                d={line(p([0, end.y, end.z]), p([0, 0, end.z]))}
                className={furnLine}
                strokeWidth={s(5)}
              />
            );
          })()}
          {/* the pad rides on the rails */}
          <path
            d={line(onPad(-8, HACK_PAD_OFF), onPad(len + 14, HACK_PAD_OFF))}
            className="stroke-foreground/15"
            strokeWidth={s(9)}
          />
          <path
            d={line(onPad(len * 0.5, HACK_PAD_OFF), onPad(len * 0.5, HACK_RAIL_OFF))}
            className={furnLine}
            strokeWidth={s(6)}
          />
        </g>
      );
    },
    mid: ({ pose, p, s }) => {
      const hip = pose.hips[1];
      const sh = pose.shoulders[1];
      const len = Math.hypot(sh[2] - hip[2], sh[1] - hip[1]);
      const ux = (sh[2] - hip[2]) / len;
      const uy = (sh[1] - hip[1]) / len;
      const at = (a: number, out: number) =>
        p([0, hip[1] + a * uy + out * -ux, hip[2] + a * ux + out * uy]);
      // Shoulder pad on top of the shoulder.
      return (
        <path
          d={line(at(len + 9, -10), at(len + 9, 11))}
          className="stroke-foreground/40"
          strokeWidth={s(7)}
        />
      );
    },
    over: ({ pose, p, s }) => {
      const w = p(pose.wrists[1]);
      return (
        <circle
          cx={w[0]}
          cy={w[1]}
          r={s(3.5)}
          className="fill-primary/40 stroke-primary"
          strokeWidth={2}
        />
      );
    },
  },
};

/* ------------------------------- Arnold press ---------------------------- */

const ARNOLD_HALF = 11;
const ARNOLD_PLATE_R = 6;
const ARNOLD_PLATE_T = 3;

/** One dumbbell turning through the Arnold press: its axis runs left-right with
 *  the palms facing you or forward and points forward halfway. `view` picks
 *  which two axes show. */
function arnoldBell(
  c: [number, number],
  turn: number,
  view: "front" | "side",
  s: (cm: number) => number,
) {
  const co = Math.abs(Math.cos((turn * Math.PI) / 180));
  const si = Math.abs(Math.sin((turn * Math.PI) / 180));
  // The axis shows its x part in the front view and its z part in the side view.
  const along = view === "front" ? co : si;
  const across = view === "front" ? si : co;
  const dx = ARNOLD_HALF * along;
  const rx = ARNOLD_PLATE_R * across + ARNOLD_PLATE_T * along;
  return (
    <g>
      <path
        d={line([c[0] - s(dx), c[1]], [c[0] + s(dx), c[1]])}
        className="stroke-foreground"
        strokeWidth={3}
      />
      {[-1, 1].map((sg) => (
        <ellipse
          key={sg}
          cx={c[0] + sg * s(dx)}
          cy={c[1]}
          rx={s(rx)}
          ry={s(ARNOLD_PLATE_R)}
          className="fill-primary stroke-none"
        />
      ))}
    </g>
  );
}

const arnoldDb: FigureExtra = {
  front: {
    over: ({ pose, p, s }) => {
      const turn = arnoldTurn(arnoldProgress(pose.wrists[1][1]));
      return (
        <g>
          {([0, 1] as const).map((i) => (
            <g key={i}>{arnoldBell(p(pose.wrists[i]), turn, "front", s)}</g>
          ))}
        </g>
      );
    },
  },
  side: {
    over: ({ pose, p, s }) => {
      const turn = arnoldTurn(arnoldProgress(pose.wrists[1][1]));
      return arnoldBell(p(pose.wrists[1]), turn, "side", s);
    },
  },
};

export const EXTRAS_W6: Record<string, FigureExtra> = {
  // Flat bench inside a Smith machine: two vertical guide rails.
  "w6-smith-flat": {
    front: {
      behind: (c) => (
        <g>
          {flatBenchFront(c)}
          {smithFlat.front!.behind!(c)}
        </g>
      ),
    },
    side: {
      behind: (c) => (
        <g>
          {flatBenchSide(c)}
          {smithFlat.side!.behind!(c)}
        </g>
      ),
    },
  },
  // Smith machine frame for the squat: tall rails, nothing else.
  "w6-smith-squat": smithSquat,
  // Decline bench with ankle rollers and a rack.
  "w6-decline-bench": declineBench,
  // Plate-less selectorized press frame: rails and carriages behind the handles.
  "w6-press-machine": pressMachine,
  // Hack squat sled: inclined rails, back pad, shoulder pads and platform.
  "w6-hack-squat": hackSquat,
  // Dumbbells that turn through the Arnold press.
  "w6-arnold-db": arnoldDb,
};
