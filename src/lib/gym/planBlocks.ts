import type { PlannedExercise } from "./types";

/** A plan as the session runs it: a straight exercise on its own, or the two
 *  halves of a superset (same `superset_group`, next to each other) together.
 *  Mirrors `session.tsx`'s `buildBlocks`, which decides what a superset is
 *  during the workout. */
export function planBlocks(plan: PlannedExercise[]): number[][] {
  const blocks: number[][] = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]!;
    if (p.superset_group !== undefined && plan[i + 1]?.superset_group === p.superset_group) {
      blocks.push([i, i + 1]);
      i++;
    } else {
      blocks.push([i]);
    }
  }
  return blocks;
}

/** Moves a whole block (a superset moves as a pair, so it can't be split) one
 *  place up (-1) or down (+1), past the neighbouring block. Supersets are
 *  renumbered in the order they now come, so "Superset 1" is always the
 *  first. Returns the plan unchanged at either end. */
export function moveBlock(
  plan: PlannedExercise[],
  block: number,
  delta: -1 | 1,
): PlannedExercise[] {
  const blocks = planBlocks(plan);
  const to = block + delta;
  if (block < 0 || block >= blocks.length || to < 0 || to >= blocks.length) return plan;
  const order = [...blocks];
  [order[block], order[to]] = [order[to]!, order[block]!];
  const renumber = new Map<number, number>();
  return order.flat().map((i) => {
    const p = plan[i]!;
    if (p.superset_group === undefined) return p;
    if (!renumber.has(p.superset_group)) renumber.set(p.superset_group, renumber.size + 1);
    return { ...p, superset_group: renumber.get(p.superset_group)! };
  });
}
