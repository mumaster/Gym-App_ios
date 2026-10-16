import { BarReadout, barColumn, usePickedBar } from "./BarReadout";
import type { ReactNode } from "react";
import {
  Beer,
  Check,
  Coffee,
  Droplet,
  Dumbbell,
  Egg,
  Footprints,
  Scale,
  Sparkles,
  Target,
  Utensils,
  Wheat,
} from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { COFFEE_KINDS, formatWaterAmount, type CoffeeKind } from "../../lib/gym/nutrition";
import { parseDayKey } from "../../lib/gym/schedule";
import type { WeekRecap, WeekRecapDay } from "../../lib/gym/weekRecap";
import { Card } from "./Screen";
import { CardHead } from "./CardHead";
import { text } from "./ui";
import { barFill } from "./bar";

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
  unit?: string | undefined;
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
/** A figure in a fun fact (1,760 kg, 2,100 kcal, 4 cups) gets the accent so it draws the eye. */
const FACT_FIGURE =
  /\d[\d.,]*(?:\s?(?:kg|kcal|km|g|min|ml|L|cups?|kopjes?|drinks?|drankjes|glasses|glazen|beers?|bieren|wines?|wijnen)\b)?/g;

function highlightFigures(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(FACT_FIGURE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <strong key={at} className="font-semibold text-primary-text">
        {m[0]}
      </strong>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function FunFact({
  children,
  icon: Icon = Sparkles,
}: {
  children: ReactNode;
  icon?: typeof Sparkles;
}) {
  const t = useTranslation();
  return (
    <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-primary/10 px-3 py-2.5 text-[14px] text-foreground">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
      <span>
        {Icon === Sparkles ? <span className="sr-only">{t.weekRecap.funFact}: </span> : null}
        {typeof children === "string" ? highlightFigures(children) : children}
      </span>
    </p>
  );
}

/** The weekday name of a day key, in the app's language. */
function useDayName() {
  const locale = useLocale();
  return (key: string) => parseDayKey(key).toLocaleDateString(locale, { weekday: "long" });
}

interface BarSegment {
  value: number;
  /** Tailwind background class of this part of the bar. */
  className: string;
}

/**
 * Seven vertical bars, one per day, on a shared baseline. A day's bar is a
 * grey track as tall as its goal (or, without one, the week's biggest day) and
 * the accent fills it up to what was reached. Over the goal the bar grows
 * taller than the track and the whole bar turns the solid accent (when
 * `overIsBad`), under it the fill is the card header's tint, so the heights differ by design: a taller bar is a bigger
 * day. Every bar is a `bar-track` pill and its fills share its round ends (styles.css). The value
 * and weekday sit under each bar; a day with nothing logged is just its track.
 * `segments` stacks several kinds (coffee, beer and wine) from the bottom.
 */
function DayBars({
  days,
  segments,
  limit,
  overIsBad,
  label,
  ariaLabel,
}: {
  days: WeekRecapDay[];
  segments: (d: WeekRecapDay) => BarSegment[];
  limit?: (d: WeekRecapDay) => number | null | undefined;
  overIsBad?: boolean;
  label: (d: WeekRecapDay) => string | null;
  ariaLabel: (d: WeekRecapDay) => string;
}) {
  const t = useTranslation();
  const sum = (d: WeekRecapDay) => segments(d).reduce((s, p) => s + p.value, 0);
  const scale = Math.max(1, ...days.map((d) => Math.max(limit?.(d) ?? 0, sum(d))));
  const { picked, toggle } = usePickedBar();
  return (
    <>
      <BarReadout text={picked == null ? null : ariaLabel(days[picked]!)} />
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const total = sum(d);
          const goal = limit?.(d) ?? null;
          const ref = goal ?? scale;
          const height = Math.max(ref, total);
          const over = goal != null && total > goal;
          const parts: BarSegment[] = overIsBad
            ? over
              ? [
                  { value: goal, className: "intake-fill" },
                  { value: total - goal, className: "bg-primary" },
                ]
              : [{ value: total, className: "intake-fill" }]
            : segments(d).filter((p) => p.value > 0);
          const text = label(d);
          return (
            <li key={d.key}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-label={ariaLabel(d)}
                aria-pressed={picked === i}
                className={`${barColumn(picked === i)} flex w-full flex-col items-center py-1`}
              >
                <div className="flex h-28 w-full items-end justify-center" aria-hidden>
                  <div
                    data-bar="day"
                    className={`bar-in-y bar-track w-5 ${
                      over && overIsBad ? "bg-primary" : "bg-foreground/10"
                    }`}
                    style={{ height: `max(1.25rem, ${(height / scale) * 100}%)` }}
                  >
                    {total > 0 && over && overIsBad && goal != null ? (
                      <span
                        data-bar="level"
                        className="intake-solid bar-fill-y"
                        style={barFill((goal / total) * 100)}
                      />
                    ) : null}
                    {total > 0 && !(over && overIsBad)
                      ? parts
                          .map((p, k) => ({
                            className: p.className,
                            reach: parts.slice(0, k + 1).reduce((s, q) => s + q.value, 0),
                          }))
                          .reverse()
                          .map((p, k) => (
                            <span
                              key={k}
                              data-bar="part"
                              className={`${p.className} bar-fill-y`}
                              style={barFill((p.reach / height) * 100)}
                            />
                          ))
                      : null}
                  </div>
                </div>
                <span
                  className={`tabular mt-1.5 h-4 text-[11px] font-semibold leading-4 ${
                    over && overIsBad ? "text-primary-text" : ""
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
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A dot, a name and a figure: the legend that also gives each part's total. */
function Legend({ items }: { items: { dot: string; label: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span aria-hidden className={`size-2.5 rounded-sm ${i.dot}`} />
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
          <div className="h-2 bar-track bg-foreground/10">
            <div className="bar-in-x bar-fill-x bg-primary" style={barFill(pct)} />
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
      <DayBars
        days={days}
        segments={(d) => [{ value: d.logged ? d.calories : 0, className: "bg-primary" }]}
        limit={(d) => d.calorieGoal}
        overIsBad
        label={(d) => (d.logged ? d.calories.toLocaleString(locale) : null)}
        ariaLabel={(d) =>
          `${d.date.toLocaleDateString(locale, { weekday: "long" })}: ${
            d.logged ? `${d.calories.toLocaleString(locale)} kcal` : t.weekRecap.notLogged
          }${d.calorieGoal != null ? `, ${t.weekRecap.dayLimit(d.calorieGoal.toLocaleString(locale))}` : ""}`
        }
      />
      {hasLimit ? (
        <ul className="mt-1 grid grid-cols-7 gap-1" aria-hidden>
          {days.map((d) => (
            <li
              key={d.key}
              className="tabular text-center text-[10px] leading-4 text-muted-foreground"
            >
              {d.calorieGoal != null ? d.calorieGoal.toLocaleString(locale) : "–"}
            </li>
          ))}
        </ul>
      ) : null}
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
          <div className="h-2 bar-track bg-foreground/10">
            <div
              className={`bar-in-x bar-fill-x ${over ? "bg-destructive" : "bg-primary"}`}
              style={barFill(Math.min(100, Math.round((average.calories / calorieGoal) * 100)))}
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
        <FunFact icon={Target}>
          {t.weekRecap.withinLimit(nutrition.daysWithinGoal, finishedLogged)}
        </FunFact>
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
        <DayBars
          days={recap.days}
          segments={(d) => [{ value: d.waterMl, className: "bg-primary" }]}
          overIsBad
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
          <DayBars
            days={recap.days}
            segments={(d) =>
              COFFEE_KINDS.map((k) => ({ value: d.coffeeByKind[k], className: KIND_SHADE[k] }))
            }
            label={(d) => (d.coffeeCups > 0 ? String(d.coffeeCups) : null)}
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
          <DayBars
            days={recap.days}
            segments={(d) => [
              { value: d.beers, className: "bg-primary" },
              { value: d.wines, className: "bg-primary/45" },
            ]}
            label={(d) => (d.beers + d.wines > 0 ? String(d.beers + d.wines) : null)}
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

/**
 * Carbs per day as seven nested bars: one rounded pill as tall as the day's
 * carbs in the header tint, with a solid accent pill from the bottom up to the
 * sugars in it (both tops round, no notch, nothing translucent overlapping).
 * A day whose sugars are unknown is just the pale pill; a day with no food has
 * no bar. There's no goal for carbs, so no grey track.
 */
function CarbsBars({ days }: { days: WeekRecapDay[] }) {
  const t = useTranslation();
  const locale = useLocale();
  const { picked, toggle } = usePickedBar();
  const scale = Math.max(1, ...days.map((d) => d.carbs));
  const name = (d: WeekRecapDay) => d.date.toLocaleDateString(locale, { weekday: "long" });
  const aria = (d: WeekRecapDay) =>
    d.logged
      ? t.weekRecap.carbsDay(
          name(d),
          Math.round(d.carbs).toLocaleString(locale),
          d.sugars != null ? Math.round(d.sugars).toLocaleString(locale) : null,
        )
      : `${name(d)}: ${t.weekRecap.notLogged}`;
  return (
    <>
      <BarReadout text={picked == null ? null : aria(days[picked]!)} />
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <li key={d.key}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-label={aria(d)}
              aria-pressed={picked === i}
              className={`${barColumn(picked === i)} flex w-full flex-col items-center py-1`}
            >
              <div className="flex h-28 w-full items-end justify-center" aria-hidden>
                {d.carbs > 0 ? (
                  <div
                    data-bar="carbs"
                    className="bar-in-y intake-fill bar-track w-5"
                    style={{ height: `max(1.25rem, ${(d.carbs / scale) * 100}%)` }}
                  >
                    {d.sugars != null && d.sugars > 0 ? (
                      <span
                        data-bar="sugars"
                        className="bar-fill-y bg-primary"
                        style={barFill((d.sugars / d.carbs) * 100)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className="tabular mt-1.5 h-4 text-[11px] font-semibold leading-4">
                {d.carbs > 0 ? Math.round(d.carbs).toLocaleString(locale) : null}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase ${
                  d.today ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t.common.dow[d.date.getDay()]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CarbsCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
  const { carbs } = recap;
  if (!recap.nutrition.loggedDays || carbs.totalCarbs <= 0) return null;
  const g = (n: number) => Math.round(n).toLocaleString(locale);
  const finished = recap.days.filter((d) => d.logged && !d.today && !d.future).length;
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Wheat}
        title={t.weekRecap.carbs}
        subtitle={t.weekRecap.carbsTotal(g(carbs.totalCarbs))}
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t.weekRecap.totalCarbs} value={g(carbs.totalCarbs)} unit="g" />
        <Stat
          label={t.weekRecap.totalSugars}
          value={
            carbs.totalSugars == null ? (
              "–"
            ) : (
              <>
                {!carbs.complete ? (
                  <>
                    <span aria-hidden>~ </span>
                    <span className="sr-only">{t.weekRecap.atLeast} </span>
                  </>
                ) : null}
                {g(carbs.totalSugars)}
              </>
            )
          }
          unit={carbs.totalSugars == null ? undefined : "g"}
        />
        <Stat
          label={t.weekRecap.sugarsShare}
          value={carbs.sugarsPct == null ? "–" : carbs.sugarsPct.toLocaleString(locale)}
          unit={carbs.sugarsPct == null ? undefined : "%"}
        />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDayCarbs}</p>
        <CarbsBars days={recap.days} />
        <Legend
          items={[
            { dot: "intake-fill", label: t.weekRecap.legendCarbs },
            { dot: "bg-primary", label: t.weekRecap.legendSugars },
          ]}
        />
        <p className={`${text.meta} mt-3`}>{t.weekRecap.carbsLegend}</p>
      </div>
      {carbs.daysWithSugarGoal > 0 && finished > 0 ? (
        <FunFact icon={Target}>
          {t.weekRecap.withinSugarGoal(carbs.daysWithinSugarGoal, carbs.daysWithSugarGoal)}
        </FunFact>
      ) : null}
      {carbs.highestSugars ? (
        <FunFact>
          {t.weekRecap.factMostSugar(
            dayName(carbs.highestSugars.key),
            g(carbs.highestSugars.value),
          )}
        </FunFact>
      ) : null}
    </Card>
  );
}

/**
 * Fat per day as seven nested bars, like the carbs: a pale pill as tall as the
 * day's fat with a solid accent fill inside up to the saturated fat. A day
 * whose saturated fat is unknown is just the pale pill.
 */
function FatBars({ days }: { days: WeekRecapDay[] }) {
  const t = useTranslation();
  const locale = useLocale();
  const { picked, toggle } = usePickedBar();
  const scale = Math.max(1, ...days.map((d) => d.fat));
  const name = (d: WeekRecapDay) => d.date.toLocaleDateString(locale, { weekday: "long" });
  const aria = (d: WeekRecapDay) =>
    d.logged
      ? t.weekRecap.fatDay(
          name(d),
          Math.round(d.fat).toLocaleString(locale),
          d.satFat != null
            ? `${d.satFatComplete ? "" : "~"}${Math.round(d.satFat).toLocaleString(locale)}`
            : null,
        )
      : `${name(d)}: ${t.weekRecap.notLogged}`;
  return (
    <>
      <BarReadout text={picked == null ? null : aria(days[picked]!)} />
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <li key={d.key}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-label={aria(d)}
              aria-pressed={picked === i}
              className={`${barColumn(picked === i)} flex w-full flex-col items-center py-1`}
            >
              <div className="flex h-28 w-full items-end justify-center" aria-hidden>
                {d.fat > 0 ? (
                  <div
                    data-bar="fat"
                    className="bar-in-y intake-fill bar-track w-5"
                    style={{ height: `max(1.25rem, ${(d.fat / scale) * 100}%)` }}
                  >
                    {d.satFat != null && d.satFat > 0 ? (
                      <span
                        data-bar="satFat"
                        className="bar-fill-y bg-primary"
                        style={barFill((d.satFat / d.fat) * 100)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className="tabular mt-1.5 h-4 text-[11px] font-semibold leading-4">
                {d.fat > 0 ? Math.round(d.fat).toLocaleString(locale) : null}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase ${
                  d.today ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t.common.dow[d.date.getDay()]}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function FatCard({ recap }: { recap: WeekRecap }) {
  const t = useTranslation();
  const locale = useLocale();
  const dayName = useDayName();
  const { fat } = recap;
  if (!recap.nutrition.loggedDays || fat.totalFat <= 0) return null;
  const g = (n: number) => Math.round(n).toLocaleString(locale);
  // A total with some foods lacking a figure is a floor, shown with "~".
  const approx = (n: number | null) =>
    n == null ? (
      "–"
    ) : (
      <>
        {!fat.complete ? (
          <>
            <span aria-hidden>~ </span>
            <span className="sr-only">{t.weekRecap.atLeast} </span>
          </>
        ) : null}
        {g(n)}
      </>
    );
  const finished = recap.days.filter((d) => d.logged && !d.today && !d.future).length;
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={Egg}
        title={t.weekRecap.fat}
        subtitle={t.weekRecap.fatTotal(g(fat.totalFat))}
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t.weekRecap.totalSatFat}
          value={approx(fat.totalSatFat)}
          unit={fat.totalSatFat == null ? undefined : "g"}
        />
        <Stat
          label={t.weekRecap.avgSatFat}
          value={approx(fat.averageSatFat)}
          unit={fat.averageSatFat == null ? undefined : "g"}
        />
        <Stat
          label={t.weekRecap.satFatShare}
          value={fat.satFatPct == null ? "–" : fat.satFatPct.toLocaleString(locale)}
          unit={fat.satFatPct == null ? undefined : "%"}
        />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <p className={`${text.eyebrow} mb-2`}>{t.weekRecap.perDayFat}</p>
        <FatBars days={recap.days} />
        <Legend
          items={[
            { dot: "intake-fill", label: t.weekRecap.legendFat },
            { dot: "bg-primary", label: t.weekRecap.legendSatFat },
          ]}
        />
        <p className={`${text.meta} mt-3`}>{t.weekRecap.fatLegend}</p>
      </div>
      {fat.daysWithSatFatGoal > 0 && finished > 0 ? (
        <FunFact icon={Target}>
          {t.weekRecap.withinSatFatGoal(fat.daysWithinSatFatGoal, fat.daysWithSatFatGoal)}
        </FunFact>
      ) : null}
      {fat.highestSatFat ? (
        <FunFact>
          {t.weekRecap.factMostSatFat(dayName(fat.highestSatFat.key), g(fat.highestSatFat.value))}
        </FunFact>
      ) : null}
    </Card>
  );
}
