import {
  Bike,
  Footprints,
  HeartPulse,
  Mountain,
  PersonStanding,
  Sailboat,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Dict } from "../../lib/gym/i18n";
import type { CardioActivity, CardioSession } from "../../lib/gym/types";

/** One icon per activity, for chips, rows and the week strips. */
export const CARDIO_ICONS: Record<CardioActivity, LucideIcon> = {
  run: Footprints,
  cycle: Bike,
  walk: PersonStanding,
  hike: Mountain,
  swim: Waves,
  row: Sailboat,
  elliptical: HeartPulse,
  intervals: Zap,
};

/** A cardio session's name: the activity in the app's language for one
 *  logged by hand, else the watch's own name for it. */
export function cardioName(c: CardioSession, t: Dict): string {
  if (c.activity && (c.manual || !c.watch.activity)) return t.cardio.activities[c.activity];
  return c.watch.activity || t.watch.cardio;
}
