import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EXERCISES, defaultMuscleTargets } from "./data";
import { mergeCatalog, type CatalogRow } from "./catalogMerge";
import type { EquipmentId, Exercise, Muscle, MovementPattern, TargetMuscle } from "./types";

// v2: caches the database rows (with their edit time) rather than a list
// that already replaced the built-in one, so a cached copy is merged too.
const CACHE_KEY = "forge.exercise-catalog.v2";

/**
 * The built-in list (data.ts + exerciseLibrary.ts) was last revised at this
 * time. A database row for a built-in exercise that's older is a stale copy:
 * the database's table was seeded once with 54 exercises and empty muscle
 * targets, and used to replace the whole built-in list, so 63 built-in
 * exercises never showed and swaps offered one or two near-copies. Such a
 * row loses to the built-in version; a row saved later (an edit in the
 * Exercises screen) wins. Bump this when the built-in list changes.
 */
export const BUILT_IN_REVISED_AT = "2026-10-01T19:40:35Z";

/** The seeded list shipped with the app — used before the database answers. */
export const SEED_EXERCISES: Exercise[] = EXERCISES.map((e) => ({ ...e }));

let version = 0;
const listeners = new Set<() => void>();

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

/**
 * Replaces the contents of the shared EXERCISES array in place so every module
 * that imported it (generator, session, history) sees the new catalog.
 */
function apply(list: Exercise[]) {
  if (!list.length) return;
  EXERCISES.splice(0, EXERCISES.length, ...list);
  emit();
}

const toRows = (data: Record<string, unknown>[]): CatalogRow[] =>
  data.map((r) => ({
    exercise: toExercise(r),
    updatedAt: typeof r["updated_at"] === "string" ? r["updated_at"] : null,
  }));

const toExercise = (r: Record<string, unknown>): Exercise => {
  const primary_muscle = r["primary_muscle"] as Muscle;
  const targets = (r["muscle_targets"] as TargetMuscle[] | null) ?? [];
  return {
    id: String(r["id"]),
    name: String(r["name"]),
    primary_muscle,
    secondary_muscles: (r["secondary_muscles"] as Muscle[] | null) ?? [],
    muscle_targets: targets.length ? targets : defaultMuscleTargets(primary_muscle),
    equipment_required: (r["equipment_required"] as EquipmentId[] | null) ?? [],
    movement_pattern: (r["movement_pattern"] as MovementPattern) ?? "push",
    compound: Boolean(r["compound"]),
    instructions: String(r["instructions"] ?? ""),
    cues: (r["cues"] as string[] | null) ?? [],
  };
};

export function loadCachedCatalog() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    apply(
      mergeCatalog(
        SEED_EXERCISES,
        toRows(JSON.parse(raw) as Record<string, unknown>[]),
        BUILT_IN_REVISED_AT,
      ),
    );
  } catch {
    /* ignore corrupt cache */
  }
}

export async function refreshCatalog(): Promise<{ ok: boolean }> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return { ok: false };
  const raw = data as unknown as Record<string, unknown>[];
  apply(mergeCatalog(SEED_EXERCISES, toRows(raw), BUILT_IN_REVISED_AT));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("forge.exercise-catalog.v1");
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    } catch {
      /* quota */
    }
  }
  return { ok: true };
}

export async function saveExercise(ex: Exercise): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercises").upsert({
    id: ex.id,
    name: ex.name,
    primary_muscle: ex.primary_muscle,
    secondary_muscles: ex.secondary_muscles,
    muscle_targets: ex.muscle_targets,
    equipment_required: ex.equipment_required,
    movement_pattern: ex.movement_pattern,
    compound: ex.compound,
    instructions: ex.instructions,
    cues: ex.cues,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  await refreshCatalog();
  return { error: null };
}

export async function saveExercises(list: Exercise[]): Promise<{ error: string | null }> {
  if (!list.length) return { error: "Nothing to import" };
  const { error } = await supabase.from("exercises").upsert(
    list.map((ex) => ({
      id: ex.id,
      name: ex.name,
      primary_muscle: ex.primary_muscle,
      secondary_muscles: ex.secondary_muscles,
      muscle_targets: ex.muscle_targets,
      equipment_required: ex.equipment_required,
      movement_pattern: ex.movement_pattern,
      compound: ex.compound,
      instructions: ex.instructions,
      cues: ex.cues,
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) return { error: error.message };
  await refreshCatalog();
  return { error: null };
}

export async function deleteExercise(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) return { error: error.message };
  await refreshCatalog();
  return { error: null };
}

export function slugifyId(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `exercise-${Date.now()}`
  );
}

/* ---------------------------------- CSV ---------------------------------- */

const CSV_COLUMNS = [
  "id",
  "name",
  "primary_muscle",
  "secondary_muscles",
  "muscle_targets",
  "equipment_required",
  "movement_pattern",
  "compound",
  "instructions",
  "cues",
] as const;

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function exercisesToCsv(list: Exercise[]) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const e of list) {
    lines.push(
      [
        e.id,
        e.name,
        e.primary_muscle,
        e.secondary_muscles.join("|"),
        e.muscle_targets.join("|"),
        e.equipment_required.join("|"),
        e.movement_pattern,
        String(e.compound),
        e.instructions,
        e.cues.join("|"),
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function csvToExercises(text: string): { list: Exercise[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (!rows.length) return { list: [], errors: ["The file is empty"] };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  if (idx("name") === -1 || idx("primary_muscle") === -1) {
    return { list: [], errors: ["CSV needs at least 'name' and 'primary_muscle' columns"] };
  }
  const get = (r: string[], k: string) => (idx(k) === -1 ? "" : (r[idx(k)] ?? "")).trim();
  const list: Exercise[] = [];
  rows.slice(1).forEach((r, i) => {
    const name = get(r, "name");
    if (!name) {
      errors.push(`Row ${i + 2}: missing name`);
      return;
    }
    const split = (v: string) =>
      v
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
    const primary_muscle = get(r, "primary_muscle") as Muscle;
    const targets = split(get(r, "muscle_targets")) as TargetMuscle[];
    list.push({
      id: get(r, "id") || slugifyId(name),
      name,
      primary_muscle,
      secondary_muscles: split(get(r, "secondary_muscles")) as Muscle[],
      muscle_targets: targets.length ? targets : defaultMuscleTargets(primary_muscle),
      equipment_required: split(get(r, "equipment_required")) as EquipmentId[],
      movement_pattern: (get(r, "movement_pattern") || "push") as MovementPattern,
      compound: /^(true|yes|1)$/i.test(get(r, "compound")),
      instructions: get(r, "instructions"),
      cues: split(get(r, "cues")),
    });
  });
  return { list, errors };
}

/* --------------------------------- hooks --------------------------------- */

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Re-renders the caller whenever the exercise catalog changes. */
export function useExerciseCatalog(): Exercise[] {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return EXERCISES;
}
