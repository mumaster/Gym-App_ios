import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CalendarX,
  ChevronRight,
  Coffee,
  Droplets,
  Flame,
  PartyPopper,
  Play,
  Scale,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { dayKeyFromDate } from "../../lib/gym/date";
import { focusMuscles } from "../../lib/gym/volume";
import { buildNotifications, type AppNotification } from "../../lib/gym/notifications";
import { caffeineMg, dailyTotals, entriesForDay } from "../../lib/gym/nutrition";
import { useDayGoalsResolver } from "../../lib/gym/dayNutrition";
import { addDays } from "../../lib/gym/date";
import { mondayOf } from "../../lib/gym/schedule";
import { haptic, useGym } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";
import { badge } from "./ui";

const ICONS: Record<AppNotification["kind"], LucideIcon> = {
  resume: Play,
  missed: CalendarX,
  targetReached: Target,
  streakRisk: Flame,
  water: Droplets,
  caffeine: Coffee,
  weekendOver: PartyPopper,
  weighIn: Scale,
};

/** Home's bell next to the profile button: a sheet of what's worth knowing
 *  now (notifications.ts), with a dot for the ones not opened yet. */
export function NotificationBell() {
  const t = useTranslation();
  const navigate = useNavigate();
  const {
    workouts,
    activeWorkout,
    program,
    weeklyScheme,
    growthFocus,
    waterEntries,
    waterGoalMl,
    coffeeEntries,
    weightLog,
    foodEntries,
    weekendBudget,
    notifSeen,
    update,
  } = useGym();
  const resolveDay = useDayGoalsResolver();
  const [open, setOpen] = useState(false);
  // Which messages were new when the sheet opened, so they stay marked while
  // it's open even though opening it marks them seen.
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const items = useMemo(() => {
    const now = new Date();
    const key = dayKeyFromDate(now);
    return buildNotifications({
      now,
      workouts,
      activeWorkout,
      rotation: program ?? weeklyScheme,
      focus: focusMuscles(growthFocus),
      waterMl: entriesForDay(waterEntries, key).reduce((sum, e) => sum + e.ml, 0),
      waterGoalMl,
      caffeineMg: caffeineMg(entriesForDay(coffeeEntries, key)),
      lastWeighInMs: weightLog.length
        ? Math.max(...weightLog.map((e) => new Date(e.date).getTime()))
        : null,
      weighsIn: weightLog.length > 0,
      weekendOverKcal: (() => {
        if (!weekendBudget) return null;
        // Saturday and Sunday of the latest weekend, finished and logged.
        const today = dayKeyFromDate(now);
        const monday = mondayOf(now);
        const base = now.getDay() === 0 || now.getDay() >= 3 ? monday : addDays(monday, -7);
        const over: number[] = [];
        for (const offset of [5, 6]) {
          const day = addDays(base, offset);
          const dk = dayKeyFromDate(day);
          if (dk >= today) continue;
          const logged = entriesForDay(foodEntries, dk);
          const goal = resolveDay(day).goals.calories;
          if (!logged.length || goal == null) continue;
          over.push(dailyTotals(logged).calories - goal);
        }
        return over.length ? over.reduce((a, b) => a + b, 0) / over.length : null;
      })(),
    });
  }, [
    workouts,
    activeWorkout,
    program,
    weeklyScheme,
    growthFocus,
    waterEntries,
    waterGoalMl,
    coffeeEntries,
    weightLog,
    foodEntries,
    weekendBudget,
    resolveDay,
  ]);

  const unseen = items.filter((n) => !notifSeen.includes(n.id));

  const text = (n: AppNotification): { title: string; body: string } => {
    const m = t.notifications;
    switch (n.kind) {
      case "resume":
        return { title: m.resume, body: m.resumeText };
      case "missed":
        return { title: m.missed(n.count ?? 1), body: m.missedText };
      case "targetReached":
        return {
          title: m.targetReached(n.muscles?.length ?? 0),
          body: m.targetReachedText((n.muscles ?? []).join(", ")),
        };
      case "streakRisk":
        return { title: m.streakRisk, body: m.streakRiskText(n.count ?? 1) };
      case "water":
        return { title: m.water, body: m.waterText };
      case "caffeine":
        return { title: m.caffeine, body: m.caffeineText };
      case "weekendOver":
        return {
          title: m.weekendOver,
          body: m.weekendOverText((n.count ?? 0).toLocaleString()),
        };
      case "weighIn":
        return { title: m.weighIn, body: m.weighInText };
    }
  };

  const show = () => {
    haptic(12);
    setFresh(new Set(unseen.map((n) => n.id)));
    setOpen(true);
    if (unseen.length) {
      // Only ids that are current stay: old days' and weeks' ids fall away.
      update({ notifSeen: items.map((n) => n.id) });
    }
  };

  return (
    <>
      <button
        onClick={show}
        aria-label={t.notifications.open(unseen.length)}
        className="tap-target relative flex size-[42px] items-center justify-center rounded-full glass-chip active:scale-95"
      >
        <Bell className="size-5" />
        {unseen.length ? (
          <span
            aria-hidden
            className="absolute right-0.5 top-0.5 size-3 rounded-full bg-primary ring-2 ring-background"
          />
        ) : null}
      </button>
      {/* Portaled out of Home's sticky header: its blur makes `fixed` resolve
          against the header (sheet at the top of the page) and its stacking
          context put the tab bar over the sheet. */}
      {open &&
        createPortal(
          <BottomSheet open={open} onClose={() => setOpen(false)} title={t.notifications.title}>
            {items.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[17px] font-semibold">{t.notifications.empty}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t.notifications.emptyHint}
                </p>
              </div>
            ) : (
              <ul className="space-y-2 pb-2">
                {items.map((n) => {
                  const Icon = ICONS[n.kind];
                  const { title, body } = text(n);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate({
                            to: n.href,
                            ...(n.search ? { search: n.search } : {}),
                          } as never);
                        }}
                        className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left active:brightness-95"
                      >
                        <span aria-hidden className={`${badge.tonal} size-10 shrink-0`}>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight">
                            {title}
                            {fresh.has(n.id) ? (
                              <span
                                aria-hidden
                                className="size-2 shrink-0 rounded-full bg-primary"
                              />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-foreground/75">
                            {body}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </BottomSheet>,
          document.body,
        )}
    </>
  );
}
