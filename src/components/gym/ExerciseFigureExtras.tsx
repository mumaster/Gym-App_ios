import type { ReactNode } from "react";
import type { FigureModel, FigurePose, V3 } from "../../lib/gym/exerciseAnimation";
import { EXTRAS_W1 } from "./figureExtras/w1";
import { EXTRAS_W2 } from "./figureExtras/w2";
import { EXTRAS_W3 } from "./figureExtras/w3";
import { EXTRAS_W4 } from "./figureExtras/w4";
import { EXTRAS_W5 } from "./figureExtras/w5";
import { EXTRAS_W6 } from "./figureExtras/w6";
import { EXTRAS_W7 } from "./figureExtras/w7";
import { EXTRAS_W8 } from "./figureExtras/w8";
import { EXTRAS_W9 } from "./figureExtras/w9";
import { EXTRAS_W10 } from "./figureExtras/w10";
import { EXTRAS_W11 } from "./figureExtras/w11";
import { EXTRAS_W12 } from "./figureExtras/w12";
import { EXTRAS_W13 } from "./figureExtras/w13";
import { EXTRAS_W14 } from "./figureExtras/w14";
import { EXTRAS_W15 } from "./figureExtras/w15";
import { EXTRAS_W16 } from "./figureExtras/w16";
import { EXTRAS_VARIANTS } from "./figureExtras/variants";

export type P2 = [number, number];

/** What a drawing hook gets: the model and pose, the view's projection `p`
 *  (cm -> px) and `s` (cm -> px length). */
export interface DrawCtx {
  model: FigureModel;
  pose: FigurePose;
  p: (v: V3) => P2;
  s: (cm: number) => number;
}
type Draw = (c: DrawCtx) => ReactNode;

/** Extra furniture or implements drawn by `FigureFront` / `FigureSide`, keyed
 *  by the model's `furniture` or `implement` name. `behind` is drawn before
 *  the body, `mid` between the body and the near arm (pads on the thighs, a
 *  seat edge over the legs), `over` after everything (handles, cables). */
export interface FigureExtra {
  front?: { behind?: Draw; mid?: Draw; over?: Draw };
  side?: { behind?: Draw; mid?: Draw; over?: Draw };
}

export const FIGURE_EXTRAS: Record<string, FigureExtra> = {
  ...EXTRAS_W1,
  ...EXTRAS_W2,
  ...EXTRAS_W3,
  ...EXTRAS_W4,
  ...EXTRAS_W5,
  ...EXTRAS_W6,
  ...EXTRAS_W7,
  ...EXTRAS_W8,
  ...EXTRAS_W9,
  ...EXTRAS_W10,
  ...EXTRAS_W11,
  ...EXTRAS_W12,
  ...EXTRAS_W13,
  ...EXTRAS_W14,
  ...EXTRAS_W15,
  ...EXTRAS_W16,
  ...EXTRAS_VARIANTS,
};

/** The hooks of one layer for a model's furniture and implement. */
export function drawExtras(
  view: "front" | "side",
  layer: "behind" | "mid" | "over",
  c: DrawCtx,
): ReactNode {
  const out: ReactNode[] = [];
  for (const name of [c.model.furniture, c.model.implement]) {
    const draw = FIGURE_EXTRAS[name]?.[view]?.[layer];
    if (draw) out.push(<g key={`${name}-${layer}`}>{draw(c)}</g>);
  }
  return out;
}
