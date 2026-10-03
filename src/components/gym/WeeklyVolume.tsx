import { useMemo } from "react";
import { Star } from "lucide-react";
import { MUSCLES } from "../../lib/gym/data";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import {
  FOCUS_GROUPS,
  focusMuscles,
  weeklySets,
  weeklyVolume,
  type FocusGroup,
} from "../../lib/gym/volume";
import { Card } from "./Screen";
import { chip } from "./ui";

/** The "muscles to grow" picker: raises a group's weekly target (see
 *  volume.ts) and steers the generator. Lives on the Workout tab, since it
 *  changes what gets generated; the sets-this-week progress it feeds is on
 *  History (WeeklySetsCard below). */
export function GrowthFocusCard() {
  const t = useTranslation();
  const { growthFocus, update } = useGym();
  const toggle = (id: FocusGroup) => {
    haptic(10);
    update({
      growthFocus: growthFocus.includes(id)
        ? growthFocus.filter((g) => g !== id)
        : [...growthFocus, id],
    });
  };

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="text-[15px] font-semibold">{t.volume.growTitle}</p>
        <p className="text-[12.5px] text-muted-foreground">{t.volume.growDesc}</p>
      </div>
      <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
        {FOCUS_GROUPS.map((g) => {
          const on = growthFocus.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              aria-pressed={on}
              className={`tap-target flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[13px] font-semibold active:scale-95 ${
                on ? chip.on : "bg-secondary text-secondary-foreground"
              }`}
            >
              {on ? <Star className="size-3.5" fill="currentColor" /> : null}
              {t.volume.groups[g.id]}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** This Monday–Sunday week's working sets per muscle against the sourced
 *  targets (starred: a muscle to grow), furthest behind first. */
export function WeeklySetsCard() {
  const { workouts, activeWorkout, growthFocus } = useGym();
  const focus = useMemo(() => focusMuscles(growthFocus), [growthFocus]);
  const rows = useMemo(
    () => weeklyVolume(MUSCLES, weeklySets(workouts, activeWorkout), focus),
    [workouts, activeWorkout, focus],
  );
  const t = useTranslation();

  return (
    <Card className="space-y-2 p-4">
      {rows.map((r) => {
        const pct = Math.min(100, (r.done / r.target) * 100);
        return (
          <div key={r.muscle} className="flex items-center gap-2.5">
            <span className="flex w-24 shrink-0 items-center gap-1 truncate text-[13px] font-medium">
              {r.focus ? (
                <Star className="size-3 shrink-0 text-primary-text" fill="currentColor" />
              ) : null}
              {r.muscle}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${r.done >= r.target ? "bg-primary" : "bg-primary/60"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="tabular w-14 shrink-0 text-right text-[12px] text-muted-foreground">
              {t.volume.setsOf(r.done, r.target)}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
