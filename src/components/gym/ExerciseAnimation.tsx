import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  depthAt,
  phaseAt,
  pressPose,
  REP_SECONDS,
  type Pose,
  type PressRig,
  type V3,
} from "../../lib/gym/exerciseAnimation";
import { EXERCISE_ANIMATIONS } from "../../lib/gym/exerciseAnimations";
import { useTranslation } from "../../lib/gym/i18n";
import { useGym } from "../../lib/gym/store";
import { FigureFront, FigureSide } from "./ExerciseFigureScene";
import { SegmentedTabs } from "./SegmentedTabs";

type View = "front" | "side";
const SIDES = [0, 1] as const;
const VIEWS = ["front", "side"] as const;

const K = 1.7; // px per cm
const W = 320;
const H = 206;
const FLOOR = 196;
/** Where the resting frame sits in the rep (bar on the chest), used for the
 *  first render, the reduced-motion frame and tests. */
const REST_T = 0.45;

type P2 = [number, number];
/** Looking from behind the head: x is left/right. */
const front = ([x, y]: V3): P2 => [W / 2 + x * K, FLOOR - y * K];
/** Looking from the right: head on the left, feet on the right. */
const side = ([, y, z]: V3): P2 => [52 + (z + 30) * K, FLOOR - y * K];

const f = (n: number) => n.toFixed(1);
const pt = ([x, y]: P2) => `${f(x)},${f(y)}`;
const line = (a: P2, b: P2) => `M${pt(a)}L${pt(b)}`;

/**
 * A small, silent looping side view of one exercise (no controls), for
 * previews such as What's new. Holds the resting frame under Reduce Motion.
 */
export function AnimationSnippet({ exerciseId, label }: { exerciseId: string; label: string }) {
  const figure = EXERCISE_ANIMATIONS[exerciseId]?.figure;
  const [phase, setPhase] = useState(REST_T);
  useEffect(() => {
    if (!figure) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setPhase((REST_T + (now - start) / 1000 / REP_SECONDS) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [figure]);
  if (!figure) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block w-full">
      <FigureSide model={figure} pose={figure.pose(depthAt(phase))} />
    </svg>
  );
}

/**
 * A looping front or side drawing of one exercise, driven by the rig in
 * `exerciseAnimation.ts`. Renders nothing for exercises without a rig.
 * Honors reduced motion by holding the bar on the chest until played.
 */
export function ExerciseAnimation({ exerciseId }: { exerciseId: string }) {
  const spec = EXERCISE_ANIMATIONS[exerciseId];
  const t = useTranslation();
  const { language } = useGym();
  const [view, setView] = useState<View>("side");
  const [phase, setPhase] = useState(REST_T);
  const [playing, setPlaying] = useState(true);
  const reducedRef = useRef(false);

  useEffect(() => {
    if (!spec) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    reducedRef.current = reduce;
    if (reduce) setPlaying(false);
  }, [spec]);

  useEffect(() => {
    if (!spec || !playing) return;
    let raf = 0;
    let last = performance.now();
    let cur = phase;
    const tick = (now: number) => {
      cur = (cur + (now - last) / 1000 / REP_SECONDS) % 1;
      last = now;
      setPhase(cur);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Resume from wherever the rep is; `phase` itself must not restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, playing]);

  if (!spec) return null;
  const a = t.exercises.animation;
  const depth = depthAt(phase);
  const current = phaseAt(phase);
  const caption = spec.phases?.[language][current] ?? a.phase[current];
  const names = spec.labels?.[language];
  const figure = spec.figure;
  const benchPose = spec.rig ? pressPose(spec.rig, depth) : null;
  const figurePose = figure ? figure.pose(depth) : null;

  return (
    <div className="space-y-3">
      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-2 px-3 pt-3">
          <div className="w-[170px]">
            <SegmentedTabs
              tabs={VIEWS}
              value={view}
              onChange={setView}
              labels={{ front: a.front, side: a.side }}
            />
          </div>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? a.pause : a.play}
            className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={names ? names[view] : view === "front" ? a.frontLabel : a.sideLabel}
          className="block w-full"
        >
          {figure && figurePose ? (
            view === "front" ? (
              <FigureFront model={figure} pose={figurePose} />
            ) : (
              <FigureSide model={figure} pose={figurePose} />
            )
          ) : spec.rig && benchPose ? (
            view === "front" ? (
              <FrontScene rig={spec.rig} pose={benchPose} />
            ) : (
              <SideScene rig={spec.rig} pose={benchPose} />
            )
          ) : null}
        </svg>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(phase * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setPhase(Number(e.target.value) / 1000);
          }}
          aria-label={a.scrub}
          className="mx-4 block h-8 w-[calc(100%-2rem)] accent-primary"
        />
        <p
          className="px-4 pb-3 text-center text-[15px] font-semibold text-primary-text"
          aria-live="off"
        >
          {caption}
        </p>
      </div>
      <ul className="space-y-1.5">
        {spec.cues[language].map((c) => (
          <li key={c} className="text-[15px]">
            • {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

const body = "stroke-foreground/35";
const limb = "stroke-foreground/60";
const arm = "stroke-primary";

function Bar({ x1, x2, y, plate }: { x1: number; x2: number; y: number; plate: P2[] }) {
  return (
    <g>
      <path d={line([x1, y], [x2, y])} className="stroke-foreground" strokeWidth={3} />
      {plate.map(([x, py], i) => (
        <rect key={i} x={x - 4} y={py - 24} width={8} height={48} rx={3} className="fill-primary" />
      ))}
    </g>
  );
}

function FrontScene({ rig, pose }: { rig: PressRig; pose: Pose }) {
  const bench: P2 = front([0, rig.benchTop, 0]);
  const lSh = front(pose.shoulders[0]);
  const rSh = front(pose.shoulders[1]);
  const bar = front(pose.bar);
  const barL = front(pose.wrists[0]);
  const barR = front(pose.wrists[1]);
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={line([20, FLOOR], [W - 20, FLOOR])}
        className="stroke-foreground/15"
        strokeWidth={2}
      />
      {/* legs, further away behind the bench: knee up, foot planted wide */}
      {SIDES.map((i) => {
        const kk = front(pose.knees[i]);
        const an = front(pose.ankles[i]);
        return (
          <path
            key={i}
            d={`M${pt(front(pose.hips[i]))}L${pt(kk)}L${pt(an)}`}
            className="stroke-foreground/25"
            strokeWidth={10}
          />
        );
      })}
      {SIDES.map((i) => {
        const a2 = front(pose.ankles[i]);
        return (
          <path
            key={i}
            d={line([a2[0] - 9, FLOOR - 2], [a2[0] + 9, FLOOR - 2])}
            className="stroke-foreground/45"
            strokeWidth={6}
          />
        );
      })}
      {/* bench and its legs */}
      <rect
        x={bench[0] - 26}
        y={bench[1]}
        width={52}
        height={12}
        rx={5}
        className="fill-foreground/15 stroke-none"
      />
      <path
        d={line([bench[0], bench[1] + 12], [bench[0], FLOOR])}
        className="stroke-foreground/20"
        strokeWidth={8}
      />
      {/* torso: shoulders pinned back and down onto the pad */}
      <path d={line(lSh, rSh)} className={body} strokeWidth={30} />
      {/* arms */}
      {SIDES.map((i) => (
        <path
          key={i}
          d={`M${pt(front(pose.shoulders[i]))}L${pt(front(pose.elbows[i]))}L${pt(front(pose.wrists[i]))}`}
          className={arm}
          strokeWidth={8}
        />
      ))}
      <Bar
        x1={barL[0] - 55}
        x2={barR[0] + 55}
        y={bar[1]}
        plate={[
          [barL[0] - 46, bar[1]],
          [barR[0] + 46, bar[1]],
        ]}
      />
      {/* head, seen from behind, in front of the bar */}
      <path
        d={line(front([0, 62, -14]), front([0, 62, -14]))}
        className="stroke-foreground/55"
        strokeWidth={26}
      />
    </g>
  );
}

function SideScene({ rig, pose }: { rig: PressRig; pose: Pose }) {
  const bench = side([0, rig.benchTop, -30]);
  const benchEnd = side([0, rig.benchTop, 80]);
  const near = 1;
  const far = 0;
  const sh = side(pose.shoulders[near]);
  const hip = side(pose.hips[near]);
  const archMid: P2 = [(sh[0] + hip[0]) / 2, sh[1] - (rig.archLift + 0.5) * 2 * K];
  const head = side([0, rig.shoulderY + 1, -17]);
  const bar = side(pose.bar);
  const limbs = (i: 0 | 1, cls: string, w: number, op?: number) => (
    <g opacity={op}>
      <path
        d={`M${pt(side(pose.hips[i]))}L${pt(side(pose.knees[i]))}L${pt(side(pose.ankles[i]))}L${pt([
          side(pose.ankles[i])[0],
          FLOOR - 3,
        ])}M${pt([side(pose.ankles[i])[0] - 5, FLOOR - 3])}L${pt([
          side(pose.ankles[i])[0] + 15,
          FLOOR - 3,
        ])}`}
        className={cls}
        strokeWidth={w}
      />
    </g>
  );
  const arms = (i: 0 | 1, w: number, op?: number) => (
    <path
      d={`M${pt(side(pose.shoulders[i]))}L${pt(side(pose.elbows[i]))}L${pt(side(pose.wrists[i]))}`}
      className={arm}
      strokeWidth={w}
      opacity={op}
    />
  );
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d={line([20, FLOOR], [W - 20, FLOOR])}
        className="stroke-foreground/15"
        strokeWidth={2}
      />
      {limbs(far, limb, 9, 0.35)}
      {arms(far, 7, 0.4)}
      {/* bench */}
      <rect
        x={bench[0]}
        y={bench[1]}
        width={benchEnd[0] - bench[0]}
        height={12}
        rx={5}
        className="fill-foreground/15 stroke-none"
      />
      <path
        d={line([bench[0] + 24, bench[1] + 12], [bench[0] + 24, FLOOR])}
        className="stroke-foreground/20"
        strokeWidth={8}
      />
      <path
        d={line([benchEnd[0] - 24, bench[1] + 12], [benchEnd[0] - 24, FLOOR])}
        className="stroke-foreground/20"
        strokeWidth={8}
      />
      {/* torso with the natural arch in the lower back */}
      <path
        d={`M${pt(side([0, rig.shoulderY, -2]))}Q${pt(archMid)} ${pt(hip)}`}
        className={body}
        strokeWidth={rig.torsoHalfDepth * 2 * K}
      />
      <path d={line(side([0, rig.shoulderY, -6]), head)} className={body} strokeWidth={9} />
      <path d={line(head, head)} className="stroke-foreground/55" strokeWidth={21} />
      {limbs(near, limb, 11)}
      {arms(near, 9)}
      <Bar x1={bar[0]} x2={bar[0]} y={bar[1]} plate={[]} />
      <circle
        cx={bar[0]}
        cy={bar[1]}
        r={25}
        className="fill-primary/30 stroke-primary"
        strokeWidth={2}
      />
      <circle cx={bar[0]} cy={bar[1]} r={4} className="fill-foreground stroke-none" />
    </g>
  );
}
