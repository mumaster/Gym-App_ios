import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Beer,
  ChevronRight,
  Coffee,
  Droplet,
  Info,
  Plus,
  RotateCcw,
  Wine,
  X,
  Pencil,
} from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Card } from "./Screen";
import { HapticSwitch } from "./HapticSwitch";
import { button } from "./ui";
import {
  ALCOHOL_CATEGORIES,
  ALCOHOL_DRINKS,
  alcoholCardVisible,
  alcoholDrinkById,
  alcoholLoggable,
  buildDrinkEntry,
  drinkEntries,
  drinkOf,
  quickDrinkChoices,
  servingKcal,
  standardGlasses,
  type AlcoholCategory,
  type AlcoholDrink,
} from "../../lib/gym/alcohol";
import { loadNevoFoods, type NevoFood } from "../../lib/gym/nevoFoods";
import {
  CAFFEINE_DAILY_LIMIT_MG,
  CAFFEINE_PREGNANCY_LIMIT_MG,
  caffeineMg,
  COFFEE_CAFFEINE_MG,
  COFFEE_KINDS,
  dailyTotals,
  entriesForDay,
  formatLiters,
  formatWaterAmount,
  nutrientStatus,
  parseWaterMl,
  suggestWaterGoalMl,
  WATER_AMOUNT_MAX_ML,
  WATER_QUICK_ADD,
  type NutrientStatus,
} from "../../lib/gym/nutrition";
import { useTranslation } from "../../lib/gym/i18n";
import { parseDayKey } from "../../lib/gym/schedule";
import { latestBodyKg } from "../../lib/gym/load";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

/** Nutrition → Drinks: water, coffee and alcohol for the picked day, at the
 *  Food tab's sizes (card padding, gaps, type, button heights). Everything you do
 *  daily (the totals, the quick-adds, today's entries) is on the cards;
 *  what you set once (the water goal and its suggestion, your quick-add
 *  amounts) is in a sheet behind the water card's settings button. */
export function DrinksTab({
  dayKey,
  isToday,
  onNeedProfile,
}: {
  dayKey: string;
  isToday: boolean;
  /** Opens the limits questionnaire, which the water suggestion is based on. */
  onNeedProfile: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="mt-4 space-y-4">
      <WaterCard
        dayKey={dayKey}

        isToday={isToday}
        onOpenSettings={() => {
          haptic(12);
          setSettingsOpen(true);
        }}
      />
      <CoffeeCard dayKey={dayKey} canAdd={isToday} />
      <AlcoholCard dayKey={dayKey} canAdd={isToday} />
      <WaterSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onNeedProfile={() => {
          setSettingsOpen(false);
          onNeedProfile();
        }}
      />
    </div>
  );
}

/** EFSA-based suggestion (nutrition.ts); the latest weigh-in beats the
 *  questionnaire's one-off weight. */
function useSuggestedWaterMl() {
  const { nutritionProfile, weightLog } = useGym();
  return useMemo(() => {
    if (!nutritionProfile) return null;
    const weightKg = latestBodyKg(weightLog, nutritionProfile) ?? nutritionProfile.weightKg;
    return suggestWaterGoalMl({ ...nutritionProfile, weightKg });
  }, [nutritionProfile, weightLog]);
}

function barClass(status: NutrientStatus) {
  return status === "over" ? "bg-destructive" : status === "near" ? "bg-warning" : "bg-primary";
}

/** The card header every drink card shares: a badge, the drink as a small
 *  label (no day: the week strip shows which day is picked) and the total, with an optional trailing control. It's the card's
 *  tinted header band (`card-head`, full width: the card is `p-4`), like a
 *  meal's header on the Food tab, and its badge is solid once something is
 *  logged and muted while empty, like a meal's. */
function DrinkHeader({
  icon,
  active,
  eyebrow,
  value,
  sub,
  valueEnd,
  caption,
  trailing,
}: {
  icon: ReactNode;
  /** Something is logged that day. */
  active: boolean;
  eyebrow: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Right after the value and never truncated (a small info button). */
  valueEnd?: ReactNode;
  /** A small line under the value. */
  caption?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="card-head -mx-4 -mt-4 flex items-center gap-3 px-4 py-3">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold uppercase leading-none tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <div className="tabular mt-1.5 flex items-center text-[26px] font-bold leading-none">
          <p className="min-w-0 truncate">
            {value}
            {sub}
          </p>
          {valueEnd}
        </div>
        {caption ? (
          <p className="tabular mt-1 truncate text-[13px] text-muted-foreground">{caption}</p>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}

/** A day's logged entries as removable chips, scrolling sideways. */
function EntryChips({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 -mb-1.5 mt-1.5 flex gap-2 overflow-x-auto px-4 py-1.5">
      {children}
    </div>
  );
}

const chipClass =
  "tap-target flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] font-semibold text-muted-foreground active:scale-95";

function WaterCard({
  dayKey,
  isToday,
  onOpenSettings,
}: {
  dayKey: string;
  isToday: boolean;
  onOpenSettings: () => void;
}) {
  const t = useTranslation();
  const { waterEntries, waterGoalMl, waterQuickAdd, logWater, removeWaterEntry, update } = useGym();
  const suggestedMl = useSuggestedWaterMl();
  const entries = useMemo(() => entriesForDay(waterEntries, dayKey), [waterEntries, dayKey]);
  const totalMl = entries.reduce((sum, e) => sum + e.ml, 0);
  const pct = waterGoalMl ? Math.min(100, (totalMl / waterGoalMl) * 100) : 0;
  /** The quick-add row swaps for a field for a one-off amount (a 600 ml
   *  bottle) and back, so it costs no extra row. */
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  const otherMl = parseWaterMl(other);
  const otherRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (otherOpen) otherRef.current?.focus();
  }, [otherOpen]);
  const logOther = () => {
    if (otherMl == null) return;
    haptic(15);
    logWater(otherMl);
    setOther("");
    setOtherOpen(false);
  };

  return (
    <Card className="overflow-hidden p-4">
      <DrinkHeader
        icon={<Droplet className="size-5" />}
        active={totalMl > 0}
        eyebrow={t.nutrition.water}
        value={formatLiters(totalMl)}
        sub={
          waterGoalMl ? (
            <span className="text-[15px] font-medium text-muted-foreground">
              {" "}
              / {formatLiters(waterGoalMl)}
            </span>
          ) : null
        }
        trailing={
          <button
            onClick={onOpenSettings}
            aria-label={t.nutrition.waterSettings}
            className={button.icon}
          >
            <Pencil className="size-4" />
          </button>
        }
      />

      {waterGoalMl ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : isToday ? (
        // No goal yet: the suggestion in one line, or a way to get one.
        <button
          onClick={() => {
            haptic(15);
            if (suggestedMl != null) update({ waterGoalMl: suggestedMl });
            else onOpenSettings();
          }}
          className="mt-3 flex w-full items-center gap-1 text-left text-[14px] leading-tight font-semibold text-primary-text"
        >
          <span className="min-w-0 leading-snug">
            {suggestedMl != null
              ? t.nutrition.waterSetSuggested(formatLiters(suggestedMl))
              : t.nutrition.setWaterGoal}
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      ) : null}

      {isToday ? (
        otherOpen ? (
          <div className="mt-4 flex items-center gap-2">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-muted px-3.5">
              <span className="sr-only">{t.nutrition.waterOther}</span>
              <input
                ref={otherRef}
                inputMode="numeric"
                type="text"
                value={other}
                onFocus={selectOnFocus}
                onChange={(e) => {
                  if (DECIMAL_INPUT_RE.test(e.target.value)) setOther(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && logOther()}
                placeholder={t.nutrition.waterOther}
                className="tabular h-full w-full min-w-0 bg-transparent text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
              <span className="shrink-0 text-[13px] text-muted-foreground">ml</span>
            </label>
            <button
              onClick={logOther}
              disabled={otherMl == null}
              aria-label={t.nutrition.waterAddOtherAria}
              className="relative flex h-12 shrink-0 items-center gap-1 rounded-2xl bg-primary px-4 text-[15px] font-bold text-primary-foreground disabled:opacity-40"
            >
              <Plus className="size-4" /> {t.nutrition.waterAddOther}
            </button>
            <button
              onClick={() => {
                setOther("");
                setOtherOpen(false);
              }}
              aria-label={t.common.cancel}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-5 gap-2">
            {waterQuickAdd.map((ml, i) => (
              <button
                key={i}
                onClick={() => {
                  haptic(15);
                  logWater(ml, { tap: true });
                }}
                aria-label={t.home.addWater(ml)}
                className={`${button.add} h-12 text-[12.5px] font-bold tracking-tight`}
              >
                <HapticSwitch />+{formatWaterAmount(ml)}
              </button>
            ))}
            <button
              onClick={() => {
                haptic(10);
                setOtherOpen(true);
              }}
              aria-label={t.nutrition.waterOther}
              className={`${button.more} h-12 text-[12.5px] font-bold tracking-tight`}
            >
              <Plus className="size-4" />
              ml
            </button>
          </div>
        )
      ) : null}

      {entries.length > 0 ? (
        <EntryChips>
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                haptic(10);
                removeWaterEntry(entry.id);
              }}
              aria-label={t.nutrition.removeWaterEntry(entry.ml)}
              className={chipClass}
            >
              <Droplet className="size-3.5 text-primary-text" /> {formatWaterAmount(entry.ml)}
              <X className="size-3.5" />
            </button>
          ))}
        </EntryChips>
      ) : null}
    </Card>
  );
}

function CoffeeCard({ dayKey, canAdd }: { dayKey: string; canAdd: boolean }) {
  const t = useTranslation();
  const { coffeeEntries, logCoffee, removeCoffeeEntry } = useGym();
  const entries = useMemo(() => entriesForDay(coffeeEntries, dayKey), [coffeeEntries, dayKey]);
  const mg = caffeineMg(entries);
  const status = nutrientStatus(mg, CAFFEINE_DAILY_LIMIT_MG);
  /** The limits' note (with the lower one in pregnancy) on request, so the
   *  card stays compact; the card itself always shows the daily limit. */
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <Card className="overflow-hidden p-4">
      <DrinkHeader
        icon={<Coffee className="size-5" />}
        active={entries.length > 0}
        eyebrow={t.coffee.title}
        value={t.coffee.cups(entries.length)}
        trailing={
          <button
            onClick={() => setNoteOpen((v) => !v)}
            aria-expanded={noteOpen}
            aria-label={t.coffee.aboutLimit}
            className={`tap-target tabular flex shrink-0 items-center gap-1 text-right text-[13px] leading-tight ${
              status === "over" ? "font-semibold text-destructive-text" : "text-muted-foreground"
            }`}
          >
            {status === "over"
              ? t.coffee.over(mg - CAFFEINE_DAILY_LIMIT_MG)
              : t.coffee.caffeineShort(mg, CAFFEINE_DAILY_LIMIT_MG)}
            <Info className="size-4 shrink-0" />
          </button>
        }
      />
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barClass(status)}`}
          style={{ width: `${Math.min(100, (mg / CAFFEINE_DAILY_LIMIT_MG) * 100)}%` }}
        />
      </div>
      {canAdd ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {COFFEE_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => {
                haptic(15);
                logCoffee(kind);
              }}
              aria-label={t.coffee.add(t.coffee.kinds[kind])}
              className={`${button.add} h-14 flex-col`}
            >
              <HapticSwitch />
              <span className="w-full truncate px-1 text-center text-[13px] font-bold leading-tight">
                + {t.coffee.kinds[kind]}
              </span>
              <span className="tabular mt-0.5 text-[12px] leading-tight text-muted-foreground">
                {COFFEE_CAFFEINE_MG[kind]} mg
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {entries.length > 0 ? (
        <EntryChips>
          {entries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => {
                haptic(10);
                removeCoffeeEntry(entry.id);
              }}
              aria-label={t.coffee.remove(t.coffee.kinds[entry.kind])}
              className={chipClass}
            >
              <Coffee className="size-3.5 text-primary-text" /> {t.coffee.kinds[entry.kind]}
              <X className="size-3.5" />
            </button>
          ))}
        </EntryChips>
      ) : null}
      {noteOpen ? (
        <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground">
          {t.coffee.note(CAFFEINE_DAILY_LIMIT_MG, CAFFEINE_PREGNANCY_LIMIT_MG)}
        </p>
      ) : null}
    </Card>
  );
}

const drinkIcon = (category: AlcoholCategory, className: string) =>
  category === "beer" ? <Beer className={className} /> : <Wine className={className} />;

/** NEVO's beers and wines by code, loaded (a lazy chunk) as soon as the
 *  card is on screen so the first tap logs at once. */
function useNevoDrinks(enabled: boolean) {
  const [byCode, setByCode] = useState<Map<number, NevoFood> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const wanted = new Set(ALCOHOL_DRINKS.map((d) => d.nevo));
    loadNevoFoods()
      .then((foods) => {
        if (alive)
          setByCode(new Map(foods.filter((f) => wanted.has(f.code)).map((f) => [f.code, f])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return byCode;
}

/** Beer and wine, logged as ordinary foods from NEVO (alcohol.ts), so the
 *  calories count in the day like any food. Today has one-tap choices (your
 *  latest drink + size combinations) and a sheet with every type and its
 *  usual sizes; past days only list what was logged. */
function AlcoholCard({ dayKey, canAdd }: { dayKey: string; canAdd: boolean }) {
  const t = useTranslation();
  const { foodEntries, language, addFoodEntry, removeFoodEntry, alcoholEnabled, alcoholWeekdays } =
    useGym();
  const settings = useMemo(
    () => ({ enabled: alcoholEnabled, weekdays: alcoholWeekdays }),
    [alcoholEnabled, alcoholWeekdays],
  );
  const day = useMemo(() => parseDayKey(dayKey), [dayKey]);
  /** Quick-adds: only today, and only on a day the card is for. */
  const canLog = alcoholLoggable(day, canAdd, settings);
  const byCode = useNevoDrinks(canLog);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const entries = useMemo(
    () => drinkEntries(entriesForDay(foodEntries, dayKey)),
    [foodEntries, dayKey],
  );
  const kcal = Math.round(dailyTotals(entries).calories);
  const glasses = standardGlasses(entries);
  const choices = useMemo(() => quickDrinkChoices(foodEntries), [foodEntries]);
  if (!alcoholCardVisible(day, entries.length, settings)) return null;

  /** Logs one serving; if the NEVO chunk is still on its way, waits for it. */
  const log = (drink: AlcoholDrink, ml: number) => {
    haptic(15);
    const add = (food: NevoFood | undefined) =>
      food && addFoodEntry(buildDrinkEntry(drink, ml, food, language));
    const food = byCode?.get(drink.nevo);
    if (food) add(food);
    else void loadNevoFoods().then((foods) => add(foods.find((f) => f.code === drink.nevo)));
  };

  return (
    <>
      <Card className="overflow-hidden p-4">
        <DrinkHeader
          icon={<Beer className="size-5" />}
          active={entries.length > 0}
          eyebrow={t.alcohol.title}
          value={t.alcohol.drinks(entries.length)}
          caption={
            // Under the count rather than beside it, so the count never
            // truncates on a narrow phone.
            entries.length ? `${t.nutrition.kcal(kcal)} · ${t.alcohol.glasses(glasses)}` : null
          }
          valueEnd={
            <button
              onClick={() => setNoteOpen((v) => !v)}
              aria-expanded={noteOpen}
              aria-label={t.alcohol.aboutLabel}
              className="tap-target ml-1.5 inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground"
            >
              <Info className="size-4" />
            </button>
          }
        />
        {canLog ? (
          <div className="mt-4 flex gap-2">
            {choices.map(({ id, ml }) => {
              const drink = alcoholDrinkById(id)!;
              const name = t.alcohol.names[id];
              return (
                <button
                  key={`${id}-${ml}`}
                  onClick={() => log(drink, ml)}
                  aria-label={t.alcohol.logAria(name, ml)}
                  className={`${button.add} h-14 min-w-0 flex-1 flex-col px-1.5`}
                >
                  <HapticSwitch />
                  <span className="w-full truncate text-center text-[13.5px] font-bold leading-tight">
                    + {name}
                  </span>
                  <span className="tabular mt-0.5 text-[12px] leading-tight text-muted-foreground">
                    {ml} ml
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => {
                haptic(10);
                setSheetOpen(true);
              }}
              aria-label={t.alcohol.addDrinkAria}
              className={`${button.more} h-14 w-[5.25rem] shrink-0 text-[13.5px] font-bold`}
            >
              <Plus className="size-4" />
              {t.alcohol.addDrink}
            </button>
          </div>
        ) : null}
        {entries.length > 0 ? (
          <EntryChips>
            {entries.map((entry) => {
              const drink = drinkOf(entry)!;
              const name = t.alcohol.names[drink.id];
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    haptic(10);
                    removeFoodEntry(entry.id);
                  }}
                  aria-label={t.alcohol.removeAria(name, entry.grams)}
                  className={chipClass}
                >
                  {drinkIcon(drink.category, "size-3.5 text-primary-text")} {name} {entry.grams} ml
                  <X className="size-3.5" />
                </button>
              );
            })}
          </EntryChips>
        ) : null}
        {noteOpen ? (
          <p className="mt-3 text-[12.5px] leading-snug text-muted-foreground">
            {t.alcohol.note} {t.nutrition.nevoReference}
          </p>
        ) : null}
      </Card>
      <AlcoholSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        byCode={byCode}
        onPick={(drink, ml) => {
          log(drink, ml);
          setSheetOpen(false);
        }}
      />
    </>
  );
}

/** Every beer and wine with its usual sizes and what a serving comes to;
 *  tapping a size logs it and closes the sheet. */
function AlcoholSheet({
  open,
  onClose,
  byCode,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  byCode: Map<number, NevoFood> | null;
  onPick: (drink: AlcoholDrink, ml: number) => void;
}) {
  const t = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t.alcohol.sheetTitle}>
      <p className="mb-3 px-1 text-[13px] text-muted-foreground">{t.alcohol.sheetHint}</p>
      {ALCOHOL_CATEGORIES.map((category) => (
        <section key={category} className="mb-4">
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            {drinkIcon(category, "size-3.5")} {t.alcohol.categories[category]}
          </p>
          <div className="space-y-2">
            {ALCOHOL_DRINKS.filter((d) => d.category === category).map((drink) => {
              const food = byCode?.get(drink.nevo);
              return (
                <div key={drink.id} className="rounded-2xl bg-muted px-3 py-2.5">
                  <p className="mb-1.5 text-[15px] font-semibold">{t.alcohol.names[drink.id]}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {drink.sizes.map((ml) => (
                      <button
                        key={ml}
                        onClick={() => onPick(drink, ml)}
                        aria-label={t.alcohol.logAria(t.alcohol.names[drink.id], ml)}
                        className={`${button.add} h-12 min-w-0 flex-col`}
                      >
                        <HapticSwitch />
                        <span className="tabular text-[13px] font-bold leading-tight">{ml} ml</span>
                        <span className="tabular text-[11px] leading-tight text-muted-foreground">
                          {food ? t.nutrition.kcal(servingKcal(food, ml)) : "…"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="px-1 text-[12px] leading-snug text-muted-foreground">
        {t.nutrition.nevoReference}
      </p>
    </BottomSheet>
  );
}

/** What's set once: the daily water goal (with the suggestion and why) and
 *  the four quick-add amounts, shared with Home's Water tile. Done saves,
 *  like every sheet with a filled-in form; quick-add amounts only when all
 *  four are valid. */
function WaterSettingsSheet({
  open,
  onClose,
  onNeedProfile,
}: {
  open: boolean;
  onClose: () => void;
  onNeedProfile: () => void;
}) {
  const t = useTranslation();
  const { waterGoalMl, waterQuickAdd, update } = useGym();
  const suggestedMl = useSuggestedWaterMl();
  const [goal, setGoal] = useState("");
  const [drafts, setDrafts] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setGoal(waterGoalMl ? String(waterGoalMl) : "");
    setDrafts(waterQuickAdd.map(String));
    // Seed once per opening, not on every store change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const draftMl = drafts.map(parseWaterMl);
  const draftsValid = draftMl.every((ml) => ml != null);

  const save = () => {
    const n = Math.round(parseDecimal(goal));
    update({
      waterGoalMl: n > 0 ? n : null,
      ...(draftsValid ? { waterQuickAdd: draftMl as number[] } : {}),
    });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={save} title={t.nutrition.waterSettings}>
      <p className="mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t.nutrition.waterGoal}
      </p>
      <label className="flex h-11 items-center gap-2 rounded-xl bg-muted px-3">
        <span className="sr-only">{t.nutrition.waterGoal}</span>
        <input
          inputMode="numeric"
          type="text"
          value={goal}
          onFocus={selectOnFocus}
          onChange={(e) => {
            if (DECIMAL_INPUT_RE.test(e.target.value)) setGoal(e.target.value);
          }}
          placeholder={t.nutrition.mlPlaceholder}
          className="tabular h-full w-full min-w-0 bg-transparent text-[16px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-[13px] text-muted-foreground">ml</span>
      </label>
      {suggestedMl != null ? (
        <div className="mt-2 rounded-xl bg-muted px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-semibold">
              {t.nutrition.waterSuggested(formatLiters(suggestedMl))}
            </p>
            <button
              onClick={() => {
                haptic(10);
                setGoal(String(suggestedMl));
              }}
              className="tap-target shrink-0 rounded-full bg-primary/15 px-3 py-1.5 text-[12.5px] font-bold text-foreground active:scale-95"
            >
              {t.nutrition.waterUseSuggestion}
            </button>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            {t.nutrition.waterSuggestionWhy}
          </p>
        </div>
      ) : (
        <button
          onClick={onNeedProfile}
          className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2.5 text-left text-[12.5px] text-muted-foreground active:scale-[0.985]"
        >
          {t.nutrition.waterSuggestNeedsProfile}
          <ChevronRight className="size-4 shrink-0" />
        </button>
      )}

      <div className="mb-3 mt-5 flex items-end justify-between gap-2 px-1">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t.nutrition.waterEditShortcuts}
        </p>
        <button
          onClick={() => {
            haptic(10);
            setDrafts(WATER_QUICK_ADD.map(String));
          }}
          className="tap-target flex items-center gap-1 text-[13px] font-semibold text-primary-text"
        >
          <RotateCcw className="size-3.5" /> {t.nutrition.waterResetShortcuts}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {drafts.map((value, i) => (
          <label
            key={i}
            className={`flex flex-col items-center gap-0.5 rounded-2xl px-1.5 py-2 ${
              draftMl[i] == null ? "bg-destructive/10 ring-1 ring-destructive/50" : "bg-muted"
            }`}
          >
            <span className="sr-only">{t.nutrition.waterShortcut(i + 1)}</span>
            <input
              inputMode="numeric"
              type="text"
              value={value}
              onFocus={selectOnFocus}
              onChange={(e) => {
                if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                const next = [...drafts];
                next[i] = e.target.value;
                setDrafts(next);
              }}
              className="tabular h-8 w-full min-w-0 bg-transparent text-center text-[16px] font-bold outline-none"
            />
            <span className="text-[11px] text-muted-foreground">ml</span>
          </label>
        ))}
      </div>
      <p
        className={`mt-1.5 px-1 text-[12px] ${draftsValid ? "text-muted-foreground" : "text-destructive-text"}`}
      >
        {draftsValid
          ? t.nutrition.waterShortcutsHint
          : t.nutrition.waterInvalid(WATER_AMOUNT_MAX_ML)}
      </p>

      <button
        onClick={() => {
          haptic(15);
          save();
        }}
        className={`${button.primary} mt-5 w-full`}
      >
        {t.common.save}
      </button>
    </BottomSheet>
  );
}
