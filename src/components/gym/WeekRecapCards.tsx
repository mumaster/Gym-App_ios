import type { ReactNode } from "react";
import {
  Beer,
  Check,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Scale,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { COFFEE_KINDS, formatWaterAmount, type CoffeeKind } from "../../lib/gym/nutrition";
import { parseDayKey } from "../../lib/gym/schedule";
import type { WeekRecap, WeekRecapDay } from "../../lib/gym/weekRecap";
import { Card } from "./Screen";
import { CardHead } from "./CardHead";
import { text } from "./ui";

/** The cards of the weekly recap (routes/history.week.$weekStart.tsx). Each one
 *  only draws a slice of the `WeekRecap` that lib/gym/weekRecap.ts builds, and
 *  a card whose slice is empty isn't drawn, so a week with no cardio simply
 *  has no cardio card. A new figure goes into the data first. */

function Stat({
  label,
  value,
  unit,
  last,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** The same figure a week earlier, shown quietly under the value. */
  last?: string | undefined;
}) {
  const t = useTranslation();
  return (
    <div className="min-w-0 rounded-lg bg-foreground/5 px-3 py-2.5">
      <p className="truncate text-[12px] text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-[20px] font-bold leading-tight">
        {value}
        {unit ? (
          <span className="ml-1 text-[13px] font-semibold text-muted-foreground">{unit}</span>
        ) : null}
      </p>
      {last ? (
        <p className="tabular mt-0.5 truncate text-[12px] text-muted-foreground">
          {t.weekRecap.lastWeekValue(last)}
        </p>
      ) : null}
    </div>
  );
}

/** "45 min", "3 h", "3 h 20 min": the value and its unit, units lower case. */
const lastTime = (m: number, locale: string) => {
  const f = formatMinutes(m, locale);
  return `${f.value} ${f.unit}`;
};

const formatMinutes = (m: number, locale: string) => {
  if (m < 60) return { value: m.toLocaleString(locale), unit: "min" };
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest
    ? { value: `${h.toLocaleString(locale)} h ${rest}`, unit: "min" }
    : { value: h.toLocaleString(locale), unit: "h" };
};

/** One quiet line about the week, under a card's figures. */
function FunFact({ children }: { children: ReactNode }) {
  const t = useTranslation();
  return (
    <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[13px] text-muted-foreground">
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
      <span>
        <span className="sr-only">{t.weekRecap.funFact}: </span>
        {children}
      </span>
    </p>
  );
}

/** The weekday name of a day key, in the app's language. */
function useDayName() {
  const locale = useLocale();
  return (key: string) => parseDayKey(key).toLocaleDateString(locale, { weekday: "long" });
}

/**
 * Seven progress rings, one per day, for a figure with a daily limit or goal
 * (calories, water): the ring fills to that day's own limit, so a closed ring
 * means "reached it" whatever the day's limit was. Every ring is the same
 * size, the arc has round ends and nothing is ever cut off: a day over its
 * limit is a closed ring in red (when `overIsBad`). Without a limit the ring
 * is relative to the week's biggest day. The day's value and weekday sit
 * under the ring, as in `DayDots`; a day with nothing logged is just the empty track.
 */
function DayRings({
  days,
  value,
  limit,
  overIsBad,
  label,
  ariaLabel,
}: {
  days: WeekRecapDay[];
  value: (d: WeekRecapDay) => number;
  limit?: (d: WeekRecapDay) => number | null | undefined;
  overIsBad?: boolean;
  label: (d: WeekRecapDay) => string | null;
  ariaLabel: (d: WeekRecapDay) => string;
}) {
  const t = useTranslation();
  const max = Math.max(1, ...days.map(value));
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <ul className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const v = value(d);
        const ref = limit?.(d) ?? max;
        const ratio = v > 0 ? Math.min(1, v / ref) : 0;
        const over = overIsBad && v > ref && limit?.(d) != null;
        const text = label(d);
        return (
          <li key={d.key} aria-label={ariaLabel(d)} className="flex flex-col items-center">
            <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
              <circle
                cx="18"
                cy="18"
                r={R}
                fill="none"
                strokeWidth="4"
                className="stroke-foreground/10"
              />
              {ratio > 0 ? (
                <circle
                  cx="18"
                  cy="18"
                  r={R}
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0.01, ratio * C)} ${C}`}
                  className={over ? "stroke-destructive" : "stroke-primary"}
                />
              ) : null}
            </svg>
            <span
              className={`tabular mt-1.5 h-4 text-[11px] font-semibold leading-4 ${
                over ? "text-destructive-text" : ""
              }`}
            >
              {text}
            </span>
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
  );
}

interface DotPart {
  count: number;
  /** Tailwind background class of these dots. */
  className: string;
}

/** The most dots a day shows; the printed count is always the real one. */
const MAX_DOTS = 8;

/**
 * Countable things per day (cups, drinks) as a stack of dots, one per item,
 * coloured by kind and growing up from a shared baseline, so the week reads
 * like a tally: count the dots or read the number under them. The column is
 * as tall as the week's busiest day (at most `MAX_DOTS`).
 */
function DayDots({
  days,
  parts,
  ariaLabel,
}: {
  days: WeekRecapDay[];
  parts: (d: WeekRecapDay) => DotPart[];
  ariaLabel: (d: WeekRecapDay) => string;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const count = (d: WeekRecapDay) => parts(d).reduce((s, p) => s + p.count, 0);
  const rows = Math.min(MAX_DOTS, Math.max(1, ...days.map(count)));
  return (
    <ul className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const n = count(d);
        const dots = parts(d)
          .flatMap((p) => Array.from({ length: p.count }, () => p.className))
          .slice(0, MAX_DOTS);
        return (
          <li key={d.key} aria-label={ariaLabel(d)} className="flex flex-col items-center">
            <div
              className="flex flex-col-reverse items-center gap-[3px]"
              style={{ height: rows * 8 + (rows - 1) * 3 }}
              aria-hidden
            >
              {dots.length ? (
                dots.map((c, i) => <span key={i} className={`size-2 rounded-full ${c}`} />)
              ) : (
                <span className="size-2 rounded-full bg-foreground/10" />
              )}
            </div>
            <span className="tabular mt-1.5 h-4 text-[11px] font-semibold leading-4">
              {n > 0 ? n.toLocaleString(locale) : ""}
            </span>
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
  );
}

/** A dot, a name and a figure: the legend that also gives each part's total. */
function Legend({ items }: { items: { dot: string; label: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span aria-hidden className={`size-2.5 rounded-full ${i.dot}`} />
          <span className="tabular">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

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
export function WeekHero({
  recap,
  nav,
}: {
  recap: WeekRecap;
  /** Previous / next week buttons, drawn at the end of the status line. */
  nav?: ReactNode;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { training, cardio, nutrition } = recap;
  const active = formatMinutes(training.minutes + cardio.minutes, locale);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={text.eyebrow}>
          {recap.inProgress
            ? `${t.weekRecap.dayOf(recap.daysElapsed)} · ${t.weekRecap.soFar}`
            : t.weekRecap.complete}
        </p>
        {nav}
      </div>
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

export function StrengthCard({ recap, prev }: { recap: WeekRecap; prev?: WeekRecap | null }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
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
        <Stat
          label={t.weekRecap.time}
          value={time.value}
          unit={time.unit}
          last={prev?.training.minutes ? lastTime(prev.training.minutes, locale) : undefined}
        />
        <Stat
          label={t.weekRecap.sets}
          value={training.workingSets.toLocaleString(locale)}
          last={
            prev?.training.workingSets
              ? prev.training.workingSets.toLocaleString(locale)
              : undefined
          }
        />
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
      {training.heaviest ? (
        <FunFact>
          {t.weekRecap.factHeaviest(
            dayName(training.heaviest.key),
            training.heaviest.value.toLocaleString(locale),
          )}
        </FunFact>
      ) : null}
    </Card>
  );
}

export function CardioCard({ recap, prev }: { recap: WeekRecap; prev?: WeekRecap | null }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
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
        <Stat
          label={t.weekRecap.time}
          value={time.value}
          unit={time.unit}
          last={prev?.cardio.minutes ? lastTime(prev.cardio.minutes, locale) : undefined}
        />
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
      {cardio.longest ? (
        <FunFact>
          {t.weekRecap.factCardioLongest(
            dayName(cardio.longest.key),
            lastTime(cardio.longest.value, locale),
          )}
        </FunFact>
      ) : null}
    </Card>
  );
}

/** Calories per day; a closed ring is that day's own limit. */
function CalorieBars({ days }: { days: WeekRecapDay[] }) {
  const t = useTranslation();
  const locale = useLocale();
  const hasLimit = days.some((d) => d.calorieGoal != null);
  return (
    <div>
      <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDay}</p>
      <DayRings
        days={days}
        value={(d) => (d.logged ? d.calories : 0)}
        limit={(d) => d.calorieGoal}
        overIsBad
        label={(d) => (d.logged ? d.calories.toLocaleString(locale) : null)}
        ariaLabel={(d) =>
          `${d.date.toLocaleDateString(locale, { weekday: "long" })}: ${
            d.logged ? `${d.calories.toLocaleString(locale)} kcal` : t.weekRecap.notLogged
          }`
        }
      />
      {hasLimit ? <p className={`${text.meta} mt-3`}>{t.weekRecap.limitLegend}</p> : null}
    </div>
  );
}

export function FoodCard({ recap, prev }: { recap: WeekRecap; prev?: WeekRecap | null }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
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
      {prev?.nutrition.average ? (
        <p className={`${text.meta} tabular mt-1`}>
          {t.weekRecap.lastWeekValue(
            `${prev.nutrition.average.calories.toLocaleString(locale)} kcal`,
          )}
        </p>
      ) : null}
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
      {nutrition.highest ? (
        <FunFact>
          {t.weekRecap.factHighest(
            dayName(nutrition.highest.key),
            nutrition.highest.value.toLocaleString(locale),
          )}
        </FunFact>
      ) : null}
    </Card>
  );
}

export function WaterCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const dayName = useDayName();
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
      <div className="mt-4">
        <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDayWater}</p>
        <DayRings
          days={recap.days}
          value={(d) => d.waterMl}
          {...(water.goalMl ? { limit: () => water.goalMl } : {})}
          label={(d) => (d.waterMl > 0 ? formatWaterAmount(d.waterMl) : null)}
          ariaLabel={(d) =>
            `${dayName(d.key)}: ${d.waterMl > 0 ? formatWaterAmount(d.waterMl) : t.weekRecap.notLogged}`
          }
        />
        {water.goalMl ? <p className={`${text.meta} mt-3`}>{t.weekRecap.goalLegend}</p> : null}
      </div>
      {water.busiest ? (
        <FunFact>
          {t.weekRecap.factWater(
            dayName(water.busiest.key),
            formatWaterAmount(water.busiest.value),
          )}
        </FunFact>
      ) : null}
    </Card>
  );
}

const KIND_SHADE: Record<CoffeeKind, string> = {
  espresso: "bg-primary",
  filter: "bg-primary/65",
  milk: "bg-primary/35",
};

/** Coffee and alcohol: a card each, with the days broken down. */
export function DrinksCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
  const { coffee, alcohol } = recap;
  const drinks = alcohol.beers + alcohol.wines;
  if (!coffee.cups && !drinks) return null;
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
            <p className={`${text.meta} mb-3`}>{t.weekRecap.caffeineAvg(coffee.averageMg)}</p>
          ) : null}
          <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDayCoffee}</p>
          <DayDots
            days={recap.days}
            parts={(d) =>
              COFFEE_KINDS.map((k) => ({ count: d.coffeeByKind[k], className: KIND_SHADE[k] }))
            }
            ariaLabel={(d) =>
              `${dayName(d.key)}: ${d.coffeeCups > 0 ? t.weekRecap.cups(d.coffeeCups) : t.weekRecap.notLogged}`
            }
          />
          <Legend
            items={COFFEE_KINDS.filter((k) => coffee.byKind[k] > 0).map((k) => ({
              dot: KIND_SHADE[k],
              label: `${t.coffee.kinds[k]} ${coffee.byKind[k]}`,
            }))}
          />
          {coffee.busiest ? (
            <FunFact>
              {t.weekRecap.factCoffeeBusiest(dayName(coffee.busiest.key), coffee.busiest.value)}
              {coffee.favourite
                ? ` ${t.weekRecap.factFavourite(t.coffee.kinds[coffee.favourite])}`
                : ""}
            </FunFact>
          ) : coffee.favourite ? (
            <FunFact>{t.weekRecap.factFavourite(t.coffee.kinds[coffee.favourite])}</FunFact>
          ) : null}
        </Card>
      ) : null}
      {drinks ? (
        <Card className="overflow-hidden p-4">
          <CardHead
            icon={Beer}
            title={t.weekRecap.alcohol}
            subtitle={t.weekRecap.glasses(alcohol.glasses.toLocaleString(locale))}
          />
          <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDayDrinks}</p>
          <DayDots
            days={recap.days}
            parts={(d) => [
              { count: d.beers, className: "bg-primary" },
              { count: d.wines, className: "bg-primary/45" },
            ]}
            ariaLabel={(d) =>
              `${dayName(d.key)}: ${
                d.beers + d.wines > 0
                  ? t.weekRecap.drinksCount(d.beers + d.wines)
                  : t.weekRecap.notLogged
              }`
            }
          />
          <Legend
            items={[
              ...(alcohol.beers
                ? [{ dot: "bg-primary", label: t.weekRecap.beers(alcohol.beers) }]
                : []),
              ...(alcohol.wines
                ? [{ dot: "bg-primary/45", label: t.weekRecap.wines(alcohol.wines) }]
                : []),
            ]}
          />
          {alcohol.busiest ? (
            <FunFact>
              {t.weekRecap.factAlcohol(dayName(alcohol.busiest.key), alcohol.busiest.value)}
            </FunFact>
          ) : null}
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
