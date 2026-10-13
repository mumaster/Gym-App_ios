/** Small SVG path helpers and colour classes shared by the exercise figure
 *  drawings (ExerciseFigureScene and the figureExtras modules). */
export type P2 = [number, number];
export const W = 320;
export const FLOOR = 196;
export const f = (n: number) => n.toFixed(1);
export const pt = ([x, y]: P2) => `${f(x)},${f(y)}`;
export const line = (a: P2, b: P2) => `M${pt(a)}L${pt(b)}`;
export const poly = (...p: P2[]) => `M${p.map(pt).join("L")}`;
/** Furniture fill and furniture lines, as in ExerciseFigureScene. */
export const furn = "fill-foreground/15 stroke-none";
export const furnLine = "stroke-foreground/20";
