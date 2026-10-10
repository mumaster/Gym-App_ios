import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Card, Screen } from "../components/gym/Screen";
import {
  CardioCard,
  DrinksCard,
  FoodCard,
  StrengthCard,
  WaterCard,
  WeekHero,
  WeightCard,
} from "../components/gym/WeekRecapCards";
import { button, text } from "../components/gym/ui";
import { useDayGoalsResolver } from "../lib/gym/dayNutrition";
import { useLocale, useTranslation } from "../lib/gym/i18n";
import { mondayOf } from "../lib/gym/schedule";
import { useGym } from "../lib/gym/store";
import { buildWeekRecap, parseWeekKey } from "../lib/gym/weekRecap";

export const Route = createFileRoute("/history/week/$weekStart")({
  head: () => ({
    meta: [
      { title: "Week recap — Forge" },
      {
        name: "description",
        content: "Everything tracked in one week: training, food, water and weight.",
      },
    ],
  }),
  component: WeekRecapScreen,
});

/** One Monday–Sunday week of everything tracked. A week still going shows
 *  what's in so far. Opened from History's week cards. */
function WeekRecapScreen() {
  const { weekStart } = Route.useParams();
  const {
    hydrated,
    workouts,
    cardioSessions,
    foodEntries,
    waterEntries,
    coffeeEntries,
    weightLog,
    waterGoalMl,
  } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const resolveGoals = useDayGoalsResolver();
  const monday = parseWeekKey(weekStart);

  const recap = useMemo(
    () =>
      monday
        ? buildWeekRecap(
            {
              workouts,
              cardioSessions,
              foodEntries,
              waterEntries,
              coffeeEntries,
              weightLog,
              waterGoalMl,
              calorieGoalFor: (date) => resolveGoals(date).goals.calories,
            },
            monday,
          )
        : null,
    // `monday` is a new Date per render; its key is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      weekStart,
      workouts,
      cardioSessions,
      foodEntries,
      waterEntries,
      coffeeEntries,
      weightLog,
      waterGoalMl,
      resolveGoals,
    ],
  );

  const back = (
    <Link to="/history" aria-label={t.weekRecap.back} className={button.icon}>
      <ChevronLeft aria-hidden className="size-5" />
    </Link>
  );

  if (!hydrated) return <Screen title={t.weekRecap.title}>{null}</Screen>;
  if (!recap) {
    return (
      <Screen title={t.weekRecap.title} action={back}>
        <Card className="p-6 text-center">
          <p className="text-[17px] font-semibold">{t.weekRecap.notFound}</p>
        </Card>
      </Screen>
    );
  }

  const weeksAgo = Math.round(
    (mondayOf(new Date()).getTime() - recap.weekStart.getTime()) / (7 * 86_400_000),
  );
  const short = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  const title =
    weeksAgo === 0
      ? t.weekRecap.thisWeek
      : weeksAgo === 1
        ? t.weekRecap.lastWeek
        : t.weekRecap.weekOf(short(recap.weekStart));
  const range = `${short(recap.weekStart)} – ${short(recap.weekEnd)}`;

  return (
    <Screen title={title} subtitle={range} action={back}>
      <div className="space-y-4">
        <WeekHero recap={recap} />
        {recap.hasData ? (
          <>
            <StrengthCard recap={recap} />
            <CardioCard recap={recap} />
            <FoodCard recap={recap} />
            <WaterCard recap={recap} />
            <DrinksCard recap={recap} />
            <WeightCard recap={recap} />
          </>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-[17px] font-semibold">{t.weekRecap.emptyTitle}</p>
            <p className={`${text.meta} mt-1`}>{t.weekRecap.emptyDesc}</p>
          </Card>
        )}
      </div>
    </Screen>
  );
}
