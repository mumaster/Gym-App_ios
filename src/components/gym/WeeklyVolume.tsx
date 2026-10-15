import { useMemo } from "react";
import { Check, ListChecks, Star } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import {
  FOCUS_GROUPS,
  VOLUME_MUSCLES,
  weeklySets,
  weeklyVolume,
  type VolumeMuscle,
} from "../../lib/gym/volume";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { chip } from "./ui";
import { barFill } from "./bar";

/** The "muscles to grow" chips: each starred muscle's weekly target goes
 *  from 10 to 20 sets (volume.ts), and generated sessions share themselves
 *  out by what's still missing (generator.ts). A group's name stars or
 *  unstars all its muscles at once. Controlled, so the plan builders can
 *  hold a draft until their save (WeeklyPlanSheet, ProgramBuilderSheet). */
export function GrowthFocusPicker({
  value,
  onChange,
}: {
  value: VolumeMuscle[];
  onChange: (next: VolumeMuscle[]) => void;
}) {
  const t = useTranslation();
  const set = (muscles: VolumeMuscle[], on: boolean) =>
    onChange(VOLUME_MUSCLES.filter((m) => (muscles.includes(m) ? on : value.includes(m))));
  const pill = (on: boolean) =>
    `tap-target flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[13px] font-semibold active:scale-95 ${
      on ? chip.on : chip.off
    }`;
  return (
    <div className="space-y-2.5">
      {FOCUS_GROUPS.map((g) => {
        const all = g.muscles.every((m) => value.includes(m));
        const single = g.muscles.length === 1;
        return (
          <div key={g.id} className="flex items-start gap-2">
            <span className="w-[5.25rem] shrink-0 pt-[9px] text-[13px] font-semibold text-muted-foreground">
              {single ? "" : t.volume.groups[g.id]}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-1.5 gap-y-2.5">
              {single ? null : (
                <button
                  onClick={() => {
                    haptic(10);
                    set(g.muscles, !all);
                  }}
                  aria-pressed={all}
                  aria-label={t.volume.allOf(t.volume.groups[g.id])}
                  className={pill(all)}
                >
                  {all ? <Star className="size-3.5" fill="currentColor" /> : null}
                  {t.volume.all}
                </button>
              )}
              {g.muscles.map((m) => {
                const on = value.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      haptic(10);
                      set([m], !on);
                    }}
                    aria-pressed={on}
                    className={pill(on)}
                  >
                    {on ? <Star className="size-3.5" fill="currentColor" /> : null}
                    {single ? t.volume.groups[g.id] : m}
                  </button>
                );
              })}
            </div>
          </div>
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
          {VOLUME_MUSCLES.filter((m) => growthFocus.includes(m)).map((m) => (
            <span
              key={m}
              className="flex min-h-[36px] items-center gap-1 rounded-full bg-muted px-3 text-[13px] font-semibold"
            >
              <Star className="size-3.5 text-primary-text" fill="currentColor" />
              {m}
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
  value: VolumeMuscle[];
  onChange: (next: VolumeMuscle[]) => void;
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
  const focus = useMemo(() => new Set(growthFocus), [growthFocus]);
  const rows = useMemo(
    () => weeklyVolume(VOLUME_MUSCLES, weeklySets(workouts, activeWorkout, weekOf), focus),
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
              <span className="flex w-28 shrink-0 items-center gap-1 truncate text-[13px] font-medium">
                {r.focus ? (
                  <Star className="size-3 shrink-0 text-primary-text" fill="currentColor" />
                ) : null}
                {r.muscle}
              </span>
              <div className="h-2 min-w-0 flex-1 bar-track bg-muted">
                <div
                  className={`bar-grow bar-fill-x ${r.done >= r.target ? "bg-primary" : "bg-primary/60"}`}
                  style={barFill(pct)}
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
