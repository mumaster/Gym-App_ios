import { KCAL_PER_KG, LOSS_RATE_PER_WEEK, type NutritionProfile } from "./nutrition";

export interface WeightEntry {
  id: string;
  /** ISO timestamp of the weigh-in. */
  date: string;
  kg: number;
}

/**
 * Minimum data before a trend is trusted. Day-to-day bodyweight varies by
 * roughly 0.5% of body mass (Day-to-day variability in euvolemic body mass,
 * PMC10653631), while the target rates are 0.5–1% per week — so one week of
 * change is about one day's noise. Requiring 14 days and 4 weigh-ins is
 * this app's own derivation from those two numbers, not a published rule.
 * The trend is a least-squares line through the last 28 days.
 */
export const MIN_TREND_DAYS = 14;
export const MIN_TREND_ENTRIES = 4;
const TREND_WINDOW_DAYS = 28;
const DAY_MS = 86_400_000;

export interface WeightTrend {
  kgPerWeek: number;
  /** kgPerWeek as a share of the latest weight. */
  pctPerWeek: number;
  latestKg: number;
  entries: number;
  days: number;
}

export function weightTrend(entries: WeightEntry[], today = new Date()): WeightTrend | null {
  const cutoff = today.getTime() - TREND_WINDOW_DAYS * DAY_MS;
  const pts = entries
    .map((e) => ({ t: new Date(e.date).getTime(), kg: e.kg }))
    .filter((p) => p.t >= cutoff && p.t <= today.getTime())
    .sort((a, b) => a.t - b.t);
  if (pts.length < MIN_TREND_ENTRIES) return null;
  const days = (pts[pts.length - 1]!.t - pts[0]!.t) / DAY_MS;
  if (days < MIN_TREND_DAYS) return null;
  const n = pts.length;
  const mt = pts.reduce((s, p) => s + p.t, 0) / n;
  const mk = pts.reduce((s, p) => s + p.kg, 0) / n;
  const slopePerMs =
    pts.reduce((s, p) => s + (p.t - mt) * (p.kg - mk), 0) /
    pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  const kgPerWeek = slopePerMs * 7 * DAY_MS;
  const latestKg = pts[n - 1]!.kg;
  return {
    kgPerWeek,
    pctPerWeek: kgPerWeek / latestKg,
    latestKg,
    entries: n,
    days: Math.round(days),
  };
}

/** Target rate in kg/week for the profile's goal: cutting at Helms et al.
 *  2014's 0.5 / 0.75 / 1% of bodyweight per week (as in the calorie
 *  target); bulking at Iraki et al. 2019's 0.25–0.5% per week (0.25 / 0.375
 *  / 0.5); maintaining at zero. */
const GAIN_RATE_PER_WEEK = { mild: 0.0025, moderate: 0.00375, aggressive: 0.005 } as const;

export function targetKgPerWeek(profile: NutritionProfile, weightKg: number): number {
  if (profile.goal === "lose") return -LOSS_RATE_PER_WEEK[profile.pace] * weightKg;
  if (profile.goal === "gain") return GAIN_RATE_PER_WEEK[profile.pace] * weightKg;
  return 0;
}

/** Daily calorie change that would move the observed rate onto the target,
 *  at the same 7700 kcal/kg the calorie target uses (see nutrition.ts for
 *  Hall 2008's caveat) — rounded to 10 kcal. Negative = eat less. */
export function calorieAdjustment(trend: WeightTrend, targetRate: number): number {
  return Math.round(((targetRate - trend.kgPerWeek) * KCAL_PER_KG) / 7 / 10) * 10;
}
