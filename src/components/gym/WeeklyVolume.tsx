import { useMemo } from "react";
import { Check, ListChecks, Star } from "lucide-react";
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
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { chip } from "./ui";

/** The "muscles to grow" chips: each group's weekly target goes from 10 to
 *  20 sets (volume.ts), and generated sessions share themselves out by
 *  what's still missing (generator.ts). Controlled, so the plan builders
 *  can hold a draft until their save (WeeklyPlanSheet, ProgramBuilderSheet). */
export function GrowthFocusPicker({
  value,
  onChange,
}: {
  value: FocusGroup[];
  onChange: (next: FocusGroup[]) => void;
}) {
  const t = useTranslation();
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
      {FOCUS_GROUPS.map((g) => {
        const on = value.includes(g.id);
        return (
          <button
            key={g.id}
            onClick={() => {
              haptic(10);
              onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id]);
            }}
            aria-pressed={on}
            className={`tap-target flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[13px] font-semibold active:scale-95 ${
              on ? chip.on : chip.off
            }`}
          >
            {on ? <Star className="size-3.5" fill="currentColor" /> : null}
            {t.volume.groups[g.id]}
          </button>
        );
      })}
    </div>
  );
}

/** History → Activity's read-only view of the muscles to grow: they're set
 *  in the plan builders, so this only shows what's there. */
export function GrowthFocusCard() {
  const t = useTranslation();
  const { growthFocus } = useGym();
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Star}
        title={t.volume.growTitle}
        subtitle={t.volume.growCount(growthFocus.length)}
        filled={growthFocus.length > 0}
      />
      <p className="mb-3 text-[12.5px] text-muted-foreground">{t.volume.growReadOnly}</p>
      {growthFocus.length ? (
        <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
          {FOCUS_GROUPS.filter((g) => growthFocus.includes(g.id)).map((g) => (
            <span
              key={g.id}
              className="flex min-h-[36px] items-center gap-1 rounded-full bg-muted px-3 text-[13px] font-semibold"
            >
              <Star className="size-3.5 text-primary-text" fill="currentColor" />
              {t.volume.groups[g.id]}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

/** A labelled picker for inside a sheet (the plan builders). */
export function GrowthFocusSection({
  value,
  onChange,
}: {
  value: FocusGroup[];
  onChange: (next: FocusGroup[]) => void;
}) {
  const t = useTranslation();
  return (
    <div data-growth-focus>
      <p className="text-[13px] font-semibold text-muted-foreground">{t.volume.growTitle}</p>
      <p className="mb-2 text-[12.5px] text-muted-foreground">{t.volume.growPlanDesc}</p>
      <GrowthFocusPicker value={value} onChange={onChange} />
    </div>
  );
}

/** This Monday–Sunday week's working sets per muscle against the sourced
 *  targets (starred: a muscle to grow), furthest behind first. */
export function WeeklySetsCard({ weekOf }: { weekOf?: Date | undefined }) {
  const { workouts, activeWorkout, growthFocus } = useGym();
  const focus = useMemo(() => focusMuscles(growthFocus), [growthFocus]);
  const rows = useMemo(
    () => weeklyVolume(MUSCLES, weeklySets(workouts, activeWorkout, weekOf), focus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workouts, activeWorkout, focus, weekOf?.getTime()],
  );
  const t = useTranslation();

  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={ListChecks}
        title={weekOf ? t.volume.weekTitle : t.volume.thisWeek}
        subtitle={t.volume.onTarget(rows.filter((r) => r.done >= r.target).length, rows.length)}
        filled={rows.some((r) => r.done > 0)}
      />
      <div className="space-y-2">
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
                  className={`bar-grow h-full rounded-full ${r.done >= r.target ? "bg-primary" : "bg-primary/60"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`tabular flex w-16 shrink-0 items-center justify-end gap-1 text-[12px] ${
                  r.done >= r.target ? "font-semibold text-primary-text" : "text-muted-foreground"
                }`}
                aria-label={r.done >= r.target ? t.volume.reached : undefined}
              >
                {r.done >= r.target ? <Check className="size-3.5 shrink-0" /> : null}
                {t.volume.setsOf(r.done, r.target)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
