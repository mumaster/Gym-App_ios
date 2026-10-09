import { EQUIPMENT } from "./data";
import { fromBase64Url, toBase64Url } from "./mealShare";
import type { EquipmentId, EquipmentProfile } from "./types";

/**
 * Sharing a gym (an equipment profile) works like sharing a meal
 * (mealShare.ts): everything is packed into the link, `/equipment#gym=<code>`,
 * shown as a QR or sent through the share sheet. No server, no account.
 */
export type SharedGym = Pick<
  EquipmentProfile,
  | "name"
  | "active_equipment_ids"
  | "plates"
  | "bar_weight"
  | "dumbbell_bar_weight"
  | "loadable_dumbbells"
>;

const VERSION = 1;
const IDS = new Set<string>(EQUIPMENT.map((e) => e.id));
const MAX_WEIGHT_KG = 100;
const MAX_PLATE_PAIRS = 50;

const round = (n: number) => Math.round(n * 100) / 100;

export function encodeGym(gym: SharedGym): string {
  return toBase64Url(
    JSON.stringify({
      v: VERSION,
      g: gym.name,
      e: gym.active_equipment_ids,
      p: Object.fromEntries(Object.entries(gym.plates).filter(([, pairs]) => pairs > 0)),
      b: round(gym.bar_weight),
      d: round(gym.dumbbell_bar_weight),
      l: gym.loadable_dumbbells !== false,
    }),
  );
}

const weight = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_WEIGHT_KG;

/** The gym in a code, or null when it isn't one of ours (or is damaged). */
export function decodeGym(code: string): SharedGym | null {
  try {
    const raw = JSON.parse(fromBase64Url(code.trim()));
    if (raw?.v !== VERSION || typeof raw.g !== "string" || !Array.isArray(raw.e)) return null;
    const ids = [...new Set(raw.e)].filter((id): id is EquipmentId => IDS.has(id as string));
    if (!ids.length || !raw.p || typeof raw.p !== "object") return null;
    if (!weight(raw.b) || !weight(raw.d)) return null;
    const plates: Record<string, number> = {};
    for (const [size, pairs] of Object.entries(raw.p as Record<string, unknown>)) {
      const kg = Number(size);
      if (!(kg > 0 && kg <= MAX_WEIGHT_KG)) return null;
      if (!Number.isInteger(pairs) || (pairs as number) < 0 || (pairs as number) > MAX_PLATE_PAIRS)
        return null;
      plates[size] = pairs as number;
    }
    return {
      name: raw.g.trim().slice(0, 40) || "Gym",
      active_equipment_ids: ids,
      plates,
      bar_weight: raw.b,
      dumbbell_bar_weight: raw.d,
      loadable_dumbbells: raw.l !== false,
    };
  } catch {
    return null;
  }
}

export const gymShareUrl = (gym: SharedGym, origin: string) =>
  `${origin}/equipment#gym=${encodeGym(gym)}`;

/** The code in a link or `#gym=` fragment. */
export const gymCodeFrom = (text: string): string | null =>
  text.match(/gym=([A-Za-z0-9_-]+)/)?.[1] ?? null;
