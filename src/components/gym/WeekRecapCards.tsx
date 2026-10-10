import type { ReactNode } from "react";
import { Beer, Check, Coffee, Droplet, Dumbbell, Footprints, Scale, Utensils } from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { formatWaterAmount } from "../../lib/gym/nutrition";
import type { WeekRecap, WeekRecapDay } from "../../lib/gym/weekRecap";
import { Card } from "./Screen";
import { CardHead } from "./CardHead";
import { text } from "./ui";

/** The cards of the weekly recap (routes/history.week.$weekStart.tsx). Each one
 *  only draws a slice of the `WeekRecap` that lib/gym/weekRecap.ts builds, and
 *  a card whose slice is empty isn't drawn, so a week with no cardio simply
 *  has no cardio card. A new figure goes into the data first. */

function Stat({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-foreground/5 px-3 py-2.5">
      <p className="truncate text-[12px] text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-[20px] font-bold leading-tight">
        {value}
        {unit ? (
          <span className="ml-1 text-[13px] font-semibold text-muted-foreground">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

/** "45 min", "3 h", "3 h 20 min": the value and its unit, units lower case. */
const formatMinutes = (m: number, locale: string) => {
  if (m < 60) return { value: m.toLocaleString(locale), unit: "min" };
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest
    ? { value: `${h.toLocaleString(locale)} h ${rest}`, unit: "min" }
    : { value: h.toLocaleString(locale), unit: "h" };
};

/** The seven days as a Health-style strip: a check on days with training. */
function DayStrip({ days }: { days: WeekRecapDay[] }) {
  const t = useTranslation();
  const locale = useLocale();
  return (
    <ul className="grid grid-cols-7 gap-1" aria-label={t.weekRecap.daysAria}>
      {days.map((d) => {
        const done = d.workouts + d.cardio > 0;
        const initial = t.common.dow[d.date.getDay()] ?? "";
        const name = d.date.toLocaleDateString(locale, { weekday: "long" });
        const label = done
          ? d.workouts
            ? t.weekRecap.dayTrained(name)
            : t.weekRecap.dayCardio(name)
          : d.future
            ? t.weekRecap.dayAhead(name)
            : t.weekRecap.dayRest(name);
        return (
          <li
            key={d.key}
            aria-label={label}
            className={`flex flex-col items-center gap-1.5 rounded-lg py-2 ${
              d.today ? "bg-foreground/[0.06]" : ""
            }`}
          >
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              {initial}
            </span>
            {done ? (
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check aria-hidden className="size-4" strokeWidth={3} />
              </span>
            ) : (
              <span className="flex size-7 items-center justify-center">
                <span className="size-1.5 rounded-full bg-foreground/20" />
              </span>
            )}
            <span className="tabular text-[11px] text-muted-foreground">{d.date.getDate()}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** The week at a glance: the day strip and the three figures most people
 *  open a recap for. */
export function WeekHero({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { training, cardio, nutrition } = recap;
  const active = formatMinutes(training.minutes + cardio.minutes, locale);
  return (
    <Card className="p-4">
      <p className={`${text.eyebrow} mb-2`}>
        {recap.inProgress
          ? `${t.weekRecap.dayOf(recap.daysElapsed)} · ${t.weekRecap.soFar}`
          : t.weekRecap.complete}
      </p>
      <DayStrip days={recap.days} />
      <div className="mt-3 grid grid-cols-3 border-t border-border pt-3">
        {[
          {
            value: (training.sessions + cardio.sessions).toLocaleString(locale),
            label: t.history.sessions,
          },
          { value: active.value, unit: active.unit, label: t.weekRecap.time },
          {
            value: nutrition.average ? nutrition.average.calories.toLocaleString(locale) : "–",
            unit: nutrition.average ? "kcal" : undefined,
            label: t.weekRecap.avgShort,
          },
        ].map((s, i) => (
          <div key={s.label} className={`min-w-0 px-3 ${i ? "border-l border-border" : "pl-1"}`}>
            <p className="tabular text-[20px] font-bold leading-none">
              {s.value}
              {s.unit ? (
                <span className="ml-1 text-[12px] font-semibold text-muted-foreground">
                  {s.unit}
                </span>
              ) : null}
            </p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-tight text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StrengthCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { training } = recap;
  if (!training.sessions) return null;
  const time = formatMinutes(training.minutes, locale);
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Dumbbell}
        title={t.weekRecap.strength}
        subtitle={`${t.weekRecap.sessionsCount(training.sessions)} · ${t.weekRecap.onDays(training.days)}`}
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.weekRecap.time} value={time.value} unit={time.unit} />
        <Stat label={t.weekRecap.sets} value={training.workingSets.toLocaleString(locale)} />
        <Stat
          label={t.weekRecap.volume}
          value={training.volumeKg.toLocaleString(locale)}
          unit="kg"
        />
        <Stat label={t.weekRecap.records} value={training.prs.toLocaleString(locale)} />
        {training.load != null ? (
          <Stat label={t.weekRecap.load} value={training.load.toLocaleString(locale)} />
        ) : null}
      </div>
    </Card>
  );
}

export function CardioCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { cardio } = recap;
  if (!cardio.sessions) return null;
  const time = formatMinutes(cardio.minutes, locale);
  const pct = Math.min(100, Math.round((cardio.whoMinutes / cardio.whoTarget) * 100));
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Footprints}
        title={t.weekRecap.cardio}
        subtitle={t.weekRecap.sessionsCount(cardio.sessions)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.weekRecap.time} value={time.value} unit={time.unit} />
        {cardio.distanceKm > 0 ? (
          <Stat
            label={t.weekRecap.distance}
            value={cardio.distanceKm.toLocaleString(locale)}
            unit="km"
          />
        ) : null}
      </div>
      {cardio.whoMinutes > 0 ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className={`${text.meta} mt-1.5`}>
            {t.weekRecap.whoLine(cardio.whoMinutes, cardio.whoTarget)}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/** Calories per day as seven bars with the day's limit as a tick. */
function CalorieBars({ days }: { days: WeekRecapDay[] }) {
  const t = useTranslation();
  const locale = useLocale();
  const max = Math.max(1, ...days.map((d) => Math.max(d.calories, d.calorieGoal ?? 0)));
  return (
    <div>
      <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDay}</p>
      <ul className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const name = d.date.toLocaleDateString(locale, { weekday: "long" });
          const over = d.calorieGoal != null && d.calories > d.calorieGoal;
          return (
            <li
              key={d.key}
              aria-label={`${name}: ${
                d.logged ? `${d.calories.toLocaleString(locale)} kcal` : t.weekRecap.notLogged
              }`}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="relative flex h-24 w-full items-end overflow-hidden rounded-lg bg-foreground/5">
                {d.logged ? (
                  <div
                    className={`w-full rounded-lg ${over ? "bg-destructive" : "bg-primary"}`}
                    style={{ height: `${Math.max(6, (d.calories / max) * 100)}%` }}
                  />
                ) : null}
                {d.calorieGoal != null ? (
                  <div
                    aria-hidden
                    className="absolute inset-x-0 border-t-2 border-dashed border-foreground/40"
                    style={{ bottom: `${(d.calorieGoal / max) * 100}%` }}
                  />
                ) : null}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase ${
                  d.today ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t.common.dow[d.date.getDay()]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FoodCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { nutrition } = recap;
  if (!nutrition.loggedDays || !nutrition.average) return null;
  const { average, calorieGoal } = nutrition;
  const over = calorieGoal != null && average.calories > calorieGoal;
  const finishedLogged = recap.days.filter((d) => d.logged && !d.today && !d.future).length;
  const basis =
    nutrition.countedDays === 1 &&
    recap.days.some((d) => d.today && d.logged && finishedLogged === 0)
      ? t.weekRecap.basedOnToday
      : t.weekRecap.basedOn(nutrition.countedDays);
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Utensils}
        title={t.weekRecap.food}
        subtitle={t.weekRecap.caloriesTotal(nutrition.totals.calories.toLocaleString(locale))}
      />
      <p className={text.eyebrow}>
        {recap.inProgress ? t.weekRecap.avgSoFar : t.weekRecap.avgPerDay}
      </p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular text-[30px] font-bold leading-none">
          {average.calories.toLocaleString(locale)}
        </span>
        <span className="text-[14px] font-semibold text-muted-foreground">kcal</span>
      </p>
      {calorieGoal != null ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
              style={{
                width: `${Math.min(100, Math.round((average.calories / calorieGoal) * 100))}%`,
              }}
            />
          </div>
          <p className={`${text.meta} mt-1.5`}>
            {t.weekRecap.limitAvg(calorieGoal.toLocaleString(locale))}
          </p>
        </div>
      ) : null}
      <p className={`${text.meta} mt-1`}>{basis}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label={t.nutrients.protein} value={average.protein.toLocaleString(locale)} unit="g" />
        <Stat label={t.nutrients.carbs} value={average.carbs.toLocaleString(locale)} unit="g" />
        <Stat label={t.nutrients.fat} value={average.fat.toLocaleString(locale)} unit="g" />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <CalorieBars days={recap.days} />
      </div>
      {calorieGoal != null && finishedLogged > 0 ? (
        <p className={`${text.meta} mt-3`}>
          {t.weekRecap.withinLimit(nutrition.daysWithinGoal, finishedLogged)}
        </p>
      ) : null}
    </Card>
  );
}

export function WaterCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const { water } = recap;
  if (!water.daysLogged || water.averageMl == null) return null;
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Droplet}
        title={t.weekRecap.water}
        subtitle={
          water.goalMl
            ? t.weekRecap.waterDays(water.daysOnGoal, water.daysLogged)
            : t.weekRecap.waterLogged(water.daysLogged)
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.weekRecap.waterAvg} value={formatWaterAmount(water.averageMl)} />
        <Stat label={t.weekRecap.waterTotal} value={formatWaterAmount(water.totalMl)} />
      </div>
    </Card>
  );
}

/** Coffee and alcohol share a card: both are a few small numbers. */
export function DrinksCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { coffee, alcohol } = recap;
  if (!coffee.cups && !alcohol.glasses) return null;
  return (
    <>
      {coffee.cups ? (
        <Card className="overflow-hidden p-4">
          <CardHead
            icon={Coffee}
            title={t.weekRecap.coffee}
            subtitle={t.weekRecap.cups(coffee.cups)}
          />
          {coffee.averageMg != null ? (
            <p className={text.meta}>{t.weekRecap.caffeineAvg(coffee.averageMg)}</p>
          ) : null}
        </Card>
      ) : null}
      {alcohol.glasses ? (
        <Card className="overflow-hidden p-4">
          <CardHead
            icon={Beer}
            title={t.weekRecap.alcohol}
            subtitle={t.weekRecap.glasses(alcohol.glasses.toLocaleString(locale))}
          />
        </Card>
      ) : null}
    </>
  );
}

export function WeightCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const { weight } = recap;
  if (!weight) return null;
  const kg = (n: number) =>
    n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const change = `${weight.change > 0 ? "+" : weight.change < 0 ? "−" : ""}${kg(Math.abs(weight.change))}`;
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Scale}
        title={t.weekRecap.weight}
        subtitle={t.weekRecap.weighIns(weight.weighIns)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t.weekRecap.weightLatest} value={kg(weight.last)} unit="kg" />
        {weight.weighIns > 1 ? (
          <Stat label={t.weekRecap.weightChange} value={change} unit="kg" />
        ) : null}
      </div>
    </Card>
  );
}
