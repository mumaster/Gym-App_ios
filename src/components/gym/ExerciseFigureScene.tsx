import {
  BOX_TOP,
  BOX_Z,
  PULLUP_BAR_Y,
  ROW_BENCH_Y,
  THRUST_BENCH_Y,
  THRUST_BENCH_Z,
  type FigureModel,
  type FigurePose,
  type V3,
} from "../../lib/gym/exerciseAnimation";

const W = 320;
const FLOOR = 196;
const PLATE_RADIUS = 22.5;

type P2 = [number, number];
const f = (n: number) => n.toFixed(1);
const pt = ([x, y]: P2) => `${f(x)},${f(y)}`;
const line = (a: P2, b: P2) => `M${pt(a)}L${pt(b)}`;
const poly = (...p: P2[]) => `M${p.map(pt).join("L")}`;
const SIDES = [0, 1] as const;

const body = "stroke-foreground/35";
const limb = "stroke-foreground/60";
const arm = "stroke-primary";
const furn = "fill-foreground/15 stroke-none";
const furnLine = "stroke-foreground/20";

interface Props {
  model: FigureModel;
  pose: FigurePose;
}

const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/** Cable, pulley and frame of the pulldown machine (cm, side view z). */
const PULLEY_Z = 16;
const TOP_Y = 170;

export function FigureFront({ model, pose }: Props) {
  const k = model.scale;
  const p = ([x, y]: V3): P2 => [W / 2 + x * k, FLOOR - y * k];
  const lSh = p(pose.shoulders[0]);
  const rSh = p(pose.shoulders[1]);
  const lHip = p(pose.hips[0]);
  const rHip = p(pose.hips[1]);
  const head = p(pose.head);
  const bar = p(pose.bar);
  const wl = p(pose.wrists[0]);
  const wr = p(pose.wrists[1]);
  const s = (cm: number) => cm * k;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={line([20, FLOOR], [W - 20, FLOOR])}
        className="stroke-foreground/15"
        strokeWidth={2}
      />
      {(model.furniture === "upright-bench" ||
        model.furniture === "leg-curl" ||
        model.furniture === "leg-extension") && (
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
      )}
      {model.furniture === "pulldown" && (
        <g>
          <path
            d={line(p([-58, 0, 0]), p([-58, TOP_Y, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([58, 0, 0]), p([58, TOP_Y, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <path
            d={line(p([-58, TOP_Y, 0]), p([58, TOP_Y, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <rect
            x={p([-22, 0, 0])[0]}
            y={p([0, 46, 0])[1]}
            width={s(44)}
            height={s(6)}
            rx={3}
            className={furn}
          />
          <path d={line(p([0, 46, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
        </g>
      )}
      {model.furniture === "pullup-bar" && (
        <g>
          {[-1, 1].map((sg) => (
            <path
              key={sg}
              d={line(p([sg * 56, 0, 0]), p([sg * 56, PULLUP_BAR_Y, 0]))}
              className={furnLine}
              strokeWidth={s(5)}
            />
          ))}
          <path
            d={line(p([-56, PULLUP_BAR_Y, 0]), p([56, PULLUP_BAR_Y, 0]))}
            className="stroke-foreground/50"
            strokeWidth={s(3.5)}
          />
        </g>
      )}
      {model.furniture === "cable-tower" && model.pulley && (
        <g>
          <path
            d={line(p([0, 0, 0]), p([0, model.pulley.y, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
          <circle
            cx={p([0, model.pulley.y, 0])[0]}
            cy={p([0, model.pulley.y, 0])[1]}
            r={s(5)}
            className="fill-foreground/30 stroke-none"
          />
        </g>
      )}
      {model.furniture === "incline-bench" && (
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
      )}
      {model.furniture === "flat-bench" && (
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
      )}
      {model.furniture === "thrust-bench" && (
        <g>
          <rect
            x={p([-15, 0, 0])[0]}
            y={p([0, THRUST_BENCH_Y, 0])[1]}
            width={s(30)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          <path
            d={line(p([0, THRUST_BENCH_Y - 9, 0]), p([0, 0, 0]))}
            className={furnLine}
            strokeWidth={s(8)}
          />
        </g>
      )}
      {model.furniture === "box" && (
        <rect
          x={p([-26, 0, 0])[0]}
          y={p([0, BOX_TOP, 0])[1]}
          width={s(52)}
          height={s(BOX_TOP)}
          rx={4}
          className={furn}
        />
      )}
      {/* legs */}
      {SIDES.map((i) => (
        <path
          key={i}
          d={poly(p(pose.hips[i]), p(pose.knees[i]), p(pose.ankles[i]))}
          className="stroke-foreground/45"
          strokeWidth={s(11)}
        />
      ))}
      {SIDES.map((i) => {
        const a = p(pose.ankles[i]);
        const out = i === 0 ? -1 : 1;
        const y = FLOOR - s(pose.feet[i].floor) - 2;
        return (
          <path
            key={i}
            d={`${line([a[0] - out * s(2), y], [a[0] + out * s(10), y])}${
              (pose.feet[i].pitch ?? 0) > 0
                ? `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${(a[0] + out * s(4)).toFixed(1)},${y.toFixed(1)}`
                : ""
            }`}
            className="stroke-foreground/45"
            strokeWidth={s(6)}
          />
        );
      })}
      {model.furniture === "pulldown" &&
        SIDES.map((i) => {
          const c = p(mid(pose.hips[i], pose.knees[i]));
          return (
            <rect
              key={i}
              x={c[0] - s(10)}
              y={c[1] - s(14)}
              width={s(20)}
              height={s(8)}
              rx={4}
              className="fill-foreground/25 stroke-none"
            />
          );
        })}
      {/* torso and head */}
      <path
        d={`${poly(lSh, rSh, rHip, lHip)}Z`}
        className="fill-foreground/25 stroke-foreground/25"
        strokeWidth={s(6)}
      />
      <path d={line(p([0, pose.shoulders[0][1], 0]), head)} className={body} strokeWidth={s(8)} />
      <circle cx={head[0]} cy={head[1]} r={s(10.5)} className="fill-foreground/55 stroke-none" />
      {/* arms */}
      {SIDES.map((i) => (
        <path
          key={i}
          d={poly(p(pose.shoulders[i]), p(pose.elbows[i]), p(pose.wrists[i]))}
          className={arm}
          strokeWidth={s(7)}
        />
      ))}
      {model.implement === "barbell" && (
        <g>
          <path
            d={line([bar[0] - s(75), bar[1]], [bar[0] + s(75), bar[1]])}
            className="stroke-foreground"
            strokeWidth={3}
          />
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={bar[0] + sg * s(48) - s(3)}
              y={bar[1] - s(PLATE_RADIUS)}
              width={s(6)}
              height={s(PLATE_RADIUS * 2)}
              rx={3}
              className="fill-primary stroke-none"
            />
          ))}
        </g>
      )}
      {model.implement === "dumbbells" &&
        (model.oneDumbbell ? [wr] : [wl, wr]).map((w, i) => (
          <g key={i}>
            {model.neutralGrip ? (
              <>
                <path
                  d={line([w[0], w[1] - s(12)], [w[0], w[1] + s(12)])}
                  className="stroke-foreground"
                  strokeWidth={3}
                />
                {[-1, 1].map((sg) => (
                  <rect
                    key={sg}
                    x={w[0] - s(6)}
                    y={w[1] + sg * s(11) - s(3)}
                    width={s(12)}
                    height={s(6)}
                    rx={2}
                    className="fill-primary stroke-none"
                  />
                ))}
              </>
            ) : (
              <>
                <path
                  d={line([w[0] - s(12), w[1]], [w[0] + s(12), w[1]])}
                  className="stroke-foreground"
                  strokeWidth={3}
                />
                {[-1, 1].map((sg) => (
                  <rect
                    key={sg}
                    x={w[0] + sg * s(11) - s(3)}
                    y={w[1] - s(6)}
                    width={s(6)}
                    height={s(12)}
                    rx={2}
                    className="fill-primary stroke-none"
                  />
                ))}
              </>
            )}
          </g>
        ))}
      {model.implement === "goblet" && (
        <g>
          <path
            d={line([bar[0], bar[1] - s(10)], [bar[0], bar[1] + s(10)])}
            className="stroke-foreground"
            strokeWidth={3}
          />
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={bar[0] - s(7)}
              y={bar[1] + sg * s(10) - s(3)}
              width={s(14)}
              height={s(6)}
              rx={2}
              className="fill-primary stroke-none"
            />
          ))}
        </g>
      )}
      {model.implement === "kettlebell" && (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1] + s(5)}
            r={s(8)}
            className="fill-primary/60 stroke-primary"
            strokeWidth={2}
          />
          <path
            d={poly(
              [bar[0] - s(4), bar[1] - s(1)],
              [bar[0] - s(4), bar[1] - s(7)],
              [bar[0] + s(4), bar[1] - s(7)],
              [bar[0] + s(4), bar[1] - s(1)],
            )}
            className="stroke-foreground"
            strokeWidth={3}
          />
        </g>
      )}
      {model.implement === "cable" && model.pulley && (
        <g>
          <path
            d={poly(wl, p([0, model.pulley.y, 0]), wr)}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
          <path
            d={line([wl[0] - s(3), wl[1]], [wr[0] + s(3), wr[1]])}
            className="stroke-foreground"
            strokeWidth={3}
          />
        </g>
      )}
      {model.implement === "latbar" && (
        <g>
          <path
            d={poly([wl[0] - s(16), wl[1]], [wr[0] + s(16), wr[1]])}
            className="stroke-foreground"
            strokeWidth={3}
          />
          <path
            d={poly([wl[0] - s(14), wl[1]], [bar[0], bar[1] - s(26)], [wr[0] + s(14), wr[1]])}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
          <path
            d={line([bar[0], bar[1] - s(26)], [bar[0], 0])}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
        </g>
      )}
    </g>
  );
}

export function FigureSide({ model, pose }: Props) {
  const k = model.scale;
  const p = ([, y, z]: V3): P2 => [W / 2 + (z - model.centerZ) * k, FLOOR - y * k];
  const s = (cm: number) => cm * k;
  const near = 1;
  const far = 0;
  const hip = p(pose.hips[near]);
  const sh = p(pose.shoulders[near]);
  const head = p(pose.head);
  const bar = p(pose.bar);
  const leg = (i: 0 | 1, cls: string, w: number, op?: number) => {
    const a = p(pose.ankles[i]);
    const dir = pose.feet[i].dir;
    const soleY = FLOOR - s(pose.feet[i].floor) - 2;
    // Flat sole, heel down; only a genuinely lifted heel (rear foot of a lunge) slopes.
    const raised = soleY - a[1] > s(14);
    const pitch = pose.feet[i].pitch ?? 0;
    const angle = pose.feet[i].angle;
    let foot: string;
    if (angle !== undefined) {
      // A foot hanging off the shin: it pivots about the ankle, toes at `angle` above horizontal.
      const c = Math.cos((angle * Math.PI) / 180);
      const sn = Math.sin((angle * Math.PI) / 180);
      const py = a[1] + s(pose.feet[i].drop ?? 0);
      foot = `${(pose.feet[i].drop ?? 0) > 0 ? `L${pt([a[0], py])}` : ""}M${pt([a[0] - dir * s(5) * c, py + s(5) * sn])}L${pt([a[0] + dir * s(15) * c, py - s(15) * sn])}`;
    } else if (pitch > 0) {
      // A foot in the air: the sole rotates about the ankle, toes tipping down.
      const k = Math.min(1, pitch / 75);
      const oy = soleY + (a[1] - soleY) * k;
      const c = Math.cos((pitch * Math.PI) / 180);
      const sn = Math.sin((pitch * Math.PI) / 180);
      foot = `L${pt([a[0], oy])}M${pt([a[0] - dir * s(5) * c, oy - s(5) * sn])}L${pt([a[0] + dir * s(15) * c, oy + s(15) * sn])}`;
    } else {
      foot = raised
        ? `L${pt([a[0] + dir * s(15), soleY])}`
        : `L${pt([a[0], soleY])}M${pt([a[0] - dir * s(5), soleY])}L${pt([a[0] + dir * s(15), soleY])}`;
    }
    return (
      <path
        opacity={op}
        d={`${poly(p(pose.hips[i]), p(pose.knees[i]), a)}${foot}`}
        className={cls}
        strokeWidth={w}
      />
    );
  };
  const arms = (i: 0 | 1, w: number, op?: number) => (
    <path
      opacity={op}
      d={poly(p(pose.shoulders[i]), p(pose.elbows[i]), p(pose.wrists[i]))}
      className={arm}
      strokeWidth={w}
    />
  );
  const wrist = p(pose.wrists[near]);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={line([20, FLOOR], [W - 20, FLOOR])}
        className="stroke-foreground/15"
        strokeWidth={2}
      />
      {(model.furniture === "upright-bench" ||
        model.furniture === "leg-curl" ||
        model.furniture === "leg-extension") && (
        <g>
          {/* seat, back pad tilted 10 degrees and its base */}
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
      )}
      {model.furniture === "pulldown" && (
        <g>
          <path
            d={line(p([0, 0, -34]), p([0, TOP_Y, -34]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(p([0, TOP_Y, -34]), p([0, TOP_Y, PULLEY_Z]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <circle
            cx={p([0, TOP_Y, PULLEY_Z])[0]}
            cy={p([0, TOP_Y, PULLEY_Z])[1]}
            r={s(5)}
            className="fill-foreground/30 stroke-none"
          />
          <rect
            x={p([0, 0, -12])[0]}
            y={p([0, 44, 0])[1]}
            width={s(30)}
            height={s(7)}
            rx={3}
            className={furn}
          />
          <path d={line(p([0, 44, 0]), p([0, 0, 0]))} className={furnLine} strokeWidth={s(8)} />
        </g>
      )}
      {model.furniture === "pullup-bar" && (
        <g>
          <path
            d={line(p([0, 0, -56]), p([0, PULLUP_BAR_Y, -56]))}
            className={furnLine}
            strokeWidth={s(6)}
          />
          <path
            d={line(p([0, PULLUP_BAR_Y, -56]), p([0, PULLUP_BAR_Y, 0]))}
            className={furnLine}
            strokeWidth={s(5)}
          />
          <circle
            cx={p([0, PULLUP_BAR_Y, 0])[0]}
            cy={p([0, PULLUP_BAR_Y, 0])[1]}
            r={s(2.5)}
            className="fill-foreground stroke-none"
          />
        </g>
      )}
      {model.furniture === "cable-tower" && model.pulley && (
        <g>
          <path
            d={line(
              p([0, 0, model.pulley.z + 16]),
              p([0, model.pulley.y + 8, model.pulley.z + 16]),
            )}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(
              p([0, model.pulley.y + 8, model.pulley.z + 16]),
              p([0, model.pulley.y + 8, model.pulley.z]),
            )}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <circle
            cx={p([0, model.pulley.y, model.pulley.z])[0]}
            cy={p([0, model.pulley.y, model.pulley.z])[1]}
            r={s(5)}
            className="fill-foreground/30 stroke-none"
          />
        </g>
      )}
      {model.furniture === "incline-bench" && (
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
      )}
      {model.furniture === "flat-bench" && (
        <g>
          <rect
            x={p([0, 0, -42])[0]}
            y={p([0, ROW_BENCH_Y, 0])[1]}
            width={s(92)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          <path
            d={line(p([0, ROW_BENCH_Y - 9, -32]), p([0, 0, -32]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
          <path
            d={line(p([0, ROW_BENCH_Y - 9, 38]), p([0, 0, 38]))}
            className={furnLine}
            strokeWidth={s(7)}
          />
        </g>
      )}
      {model.furniture === "thrust-bench" && (
        <g>
          <rect
            x={p([0, 0, THRUST_BENCH_Z.from])[0]}
            y={p([0, THRUST_BENCH_Y, 0])[1]}
            width={s(THRUST_BENCH_Z.to - THRUST_BENCH_Z.from)}
            height={s(9)}
            rx={4}
            className={furn}
          />
          {[THRUST_BENCH_Z.from + 4, THRUST_BENCH_Z.to - 4].map((z) => (
            <path
              key={z}
              d={line(p([0, THRUST_BENCH_Y - 9, z]), p([0, 0, z]))}
              className={furnLine}
              strokeWidth={s(7)}
            />
          ))}
        </g>
      )}
      {model.furniture === "box" && (
        <rect
          x={p([0, 0, BOX_Z.from])[0]}
          y={p([0, BOX_TOP, 0])[1]}
          width={s(BOX_Z.to - BOX_Z.from)}
          height={s(BOX_TOP)}
          rx={4}
          className={furn}
        />
      )}
      {leg(far, limb, s(9), 0.35)}
      {arms(far, s(6), 0.4)}
      {/* torso, straight and neutral from hips to shoulders, then neck and head */}
      <path d={line(hip, sh)} className={body} strokeWidth={s(20)} />
      <path d={line(sh, head)} className={body} strokeWidth={s(8)} />
      <circle cx={head[0]} cy={head[1]} r={s(10.5)} className="fill-foreground/55 stroke-none" />
      {leg(near, limb, s(10))}
      {model.furniture === "pulldown" && (
        <rect
          x={p(mid(pose.hips[near], pose.knees[near]))[0] - s(16)}
          y={p(mid(pose.hips[near], pose.knees[near]))[1] - s(13)}
          width={s(32)}
          height={s(8)}
          rx={4}
          className="fill-foreground/30 stroke-none"
        />
      )}
      {arms(near, s(8))}
      {model.furniture === "leg-extension" && (
        <g>
          {/* the ankle pad sits on the front of the lower shin */}
          {(() => {
            const kn = pose.knees[near];
            const an = pose.ankles[near];
            const th = Math.atan2(kn[1] - an[1], an[2] - kn[2]);
            const c: [number, number] = [
              kn[1] + (an[1] - kn[1]) * 0.9 + Math.cos(th) * 6.5,
              kn[2] + (an[2] - kn[2]) * 0.9 + Math.sin(th) * 6.5,
            ];
            const pc = p([0, c[0], c[1]]);
            return (
              <g>
                <circle cx={pc[0]} cy={pc[1]} r={s(5)} className="fill-foreground/60 stroke-none" />
                <path d={line(pc, p([0, 38, -12]))} className={furnLine} strokeWidth={s(3)} />
              </g>
            );
          })()}
        </g>
      )}
      {model.furniture === "leg-curl" && (
        <g>
          {/* thigh pad on the thighs and the ankle roller behind the lower shin */}
          <rect
            x={p([0, 0, 24])[0]}
            y={p([0, 62, 0])[1]}
            width={s(24)}
            height={s(7)}
            rx={3}
            className="fill-foreground/30 stroke-none"
          />
          {(() => {
            const kn = pose.knees[near];
            const an = pose.ankles[near];
            const th = Math.atan2(kn[1] - an[1], an[2] - kn[2]);
            const c: [number, number] = [
              kn[1] + (an[1] - kn[1]) * 0.9 - Math.cos(th) * 6.5,
              kn[2] + (an[2] - kn[2]) * 0.9 - Math.sin(th) * 6.5,
            ];
            const pc = p([0, c[0], c[1]]);
            return (
              <g>
                <circle cx={pc[0]} cy={pc[1]} r={s(4)} className="fill-foreground/30 stroke-none" />
                <path d={line(pc, p([0, 38, 56]))} className={furnLine} strokeWidth={s(3)} />
              </g>
            );
          })()}
        </g>
      )}
      {model.implement === "barbell" && (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1]}
            r={s(PLATE_RADIUS)}
            className="fill-primary/12 stroke-primary"
            strokeWidth={2}
          />
          <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
        </g>
      )}
      {model.implement === "dumbbells" && model.neutralGrip && (
        <g>
          <path
            d={line([wrist[0] - s(12), wrist[1]], [wrist[0] + s(12), wrist[1]])}
            className="stroke-foreground"
            strokeWidth={3}
          />
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={wrist[0] + sg * s(11) - s(3)}
              y={wrist[1] - s(6)}
              width={s(6)}
              height={s(12)}
              rx={2}
              className="fill-primary stroke-none"
            />
          ))}
        </g>
      )}
      {model.implement === "dumbbells" && !model.neutralGrip && (
        <g>
          <circle
            cx={wrist[0]}
            cy={wrist[1]}
            r={s(7)}
            className="fill-primary/40 stroke-primary"
            strokeWidth={2}
          />
          <circle cx={wrist[0]} cy={wrist[1]} r={2.5} className="fill-foreground stroke-none" />
        </g>
      )}
      {model.implement === "goblet" && (
        <g>
          <path
            d={line([bar[0], bar[1] - s(10)], [bar[0], bar[1] + s(10)])}
            className="stroke-foreground"
            strokeWidth={3}
          />
          {[-1, 1].map((sg) => (
            <rect
              key={sg}
              x={bar[0] - s(4)}
              y={bar[1] + sg * s(10) - s(3)}
              width={s(8)}
              height={s(6)}
              rx={2}
              className="fill-primary stroke-none"
            />
          ))}
        </g>
      )}
      {model.implement === "kettlebell" && (
        <g>
          <circle
            cx={bar[0]}
            cy={bar[1] + s(5)}
            r={s(8)}
            className="fill-primary/60 stroke-primary"
            strokeWidth={2}
          />
          <path
            d={poly(
              [bar[0] - s(4), bar[1] - s(1)],
              [bar[0] - s(4), bar[1] - s(7)],
              [bar[0] + s(4), bar[1] - s(7)],
              [bar[0] + s(4), bar[1] - s(1)],
            )}
            className="stroke-foreground"
            strokeWidth={3}
          />
        </g>
      )}
      {model.implement === "cable" && model.pulley && (
        <g>
          <path
            d={line(bar, p([0, model.pulley.y, model.pulley.z]))}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
          <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
        </g>
      )}
      {model.implement === "latbar" && (
        <g>
          <path
            d={line(bar, p([0, TOP_Y, PULLEY_Z]))}
            className="stroke-foreground/50"
            strokeWidth={1.5}
          />
          <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
        </g>
      )}
    </g>
  );
}
