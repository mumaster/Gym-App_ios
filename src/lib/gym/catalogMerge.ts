import type { Exercise } from "./types";

/** A database row as an exercise, with when it was last saved. */
export interface CatalogRow {
  exercise: Exercise;
  updatedAt: string | null;
}

/**
 * The catalog the app uses: every built-in exercise, in built-in order (its
 * database row instead only when that was saved after `revisedAt`, the time
 * the built-in list was last revised — i.e. an edit made in the app — and
 * then keeping the built-in `unilateral` flag, which the table has no
 * column for), followed by the exercises that exist only in the database
 * (your own). See catalog.ts's BUILT_IN_REVISED_AT for why.
 */
export function mergeCatalog(seed: Exercise[], rows: CatalogRow[], revisedAt: string): Exercise[] {
  const byId = new Map(rows.map((r) => [r.exercise.id, r]));
  const revised = Date.parse(revisedAt);
  const builtIn = seed.map((s) => {
    const row = byId.get(s.id);
    if (!row?.updatedAt || !(Date.parse(row.updatedAt) > revised)) return s;
    return { ...row.exercise, ...(s.unilateral ? { unilateral: true } : {}) };
  });
  const seedIds = new Set(seed.map((e) => e.id));
  const own = rows.filter((r) => !seedIds.has(r.exercise.id)).map((r) => r.exercise);
  return [...builtIn, ...own];
}
