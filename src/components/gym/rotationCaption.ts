import {
  doneDate,
  plannedDate,
  slotOffset,
  weekIndex,
  type Rotation,
} from "../../lib/gym/schedule";

type Dict = ReturnType<typeof import("../../lib/gym/i18n").useTranslation>;

/** The line under a day's name in a plan editor: the real date this cycle
 *  (with "moved" and the usual weekday when pushed), or just its place in the
 *  order in flexible mode. */
export function rotationCaption(r: Rotation, i: number, t: Dict, locale: string): string {
  const m = t.common.scheduleMode;
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const slot = r.schedule[i];
  if (!slot) return "";
  if (r.flexible) {
    if (i < r.cyclePosition) return doneDate(r, i) ? m.doneOn(fmt(doneDate(r, i)!)) : "";
    return i === r.cyclePosition ? m.upNext : m.afterDay(i);
  }
  if (i < r.cyclePosition) {
    const d = doneDate(r, i);
    return d ? m.doneOn(fmt(d)) : "";
  }
  const moved = slotOffset(r, i) !== weekIndex(slot.dow);
  const base = m.plannedOn(fmt(plannedDate(r, i)));
  return moved ? `${base} · ${m.moved} · ${m.usual(t.common.dow[slot.dow] ?? "")}` : base;
}
