import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ListPlus, Plus, Trash2 } from "lucide-react";
import { AddFoodSheet } from "./AddFoodSheet";
import { BottomSheet } from "./BottomSheet";
import { Card } from "./Screen";
import { useTranslation } from "../../lib/gym/i18n";
import { dayKeyFromDate } from "../../lib/gym/date";
import {
  dailyTotals,
  entriesForDay,
  ingredientsFromEntries,
  MEAL_ORDER,
  scaledMacros,
  type MealIngredient,
  type MealType,
} from "../../lib/gym/nutrition";
import { selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

/**
 * `seed` pre-fills the builder when it opens (e.g. every food logged under
 * Lunch); `day` is the day whose logged meals the "Add from a logged meal"
 * chips read from (today when omitted).
 */
export function CreateMealSheet({
  open,
  onClose,
  seed,
  day,
}: {
  open: boolean;
  onClose: () => void;
  seed?: { name: string; ingredients: MealIngredient[]; meal?: MealType } | null;
  day?: string;
}) {
  const { saveMealTemplate, foodEntries } = useGym();
  const t = useTranslation();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [addingIngredient, setAddingIngredient] = useState(false);
  /** Logged meals already pulled in, so a second tap can't add them twice. */
  const [imported, setImported] = useState<MealType[]>([]);

  const reset = () => {
    setName("");
    setIngredients([]);
    setAddingIngredient(false);
    setImported([]);
  };

  // Apply the seed each time the sheet opens (the component stays mounted).
  const seedRef = useRef(seed);
  seedRef.current = seed;
  useEffect(() => {
    if (!open) return;
    const s = seedRef.current;
    if (!s) return;
    setName(s.name);
    setIngredients(s.ingredients);
    setImported(s.meal ? [s.meal] : []);
  }, [open]);

  const dayEntries = useMemo(
    () => entriesForDay(foodEntries, day ?? dayKeyFromDate(new Date())),
    [foodEntries, day],
  );
  const loggedMeals = MEAL_ORDER.map((meal) => ({
    meal,
    entries: dayEntries.filter((e) => e.meal === meal),
  })).filter((m) => m.entries.length > 0);

  const importMeal = (meal: MealType, entries: typeof dayEntries) => {
    haptic(15);
    setIngredients((cur) => [...cur, ...ingredientsFromEntries(entries)]);
    setImported((cur) => [...cur, meal]);
    setName((cur) => (cur.trim() ? cur : t.mealTypes[meal]));
  };

  const totals = useMemo(() => dailyTotals(ingredients), [ingredients]);
  const canSave = name.trim().length > 0 && ingredients.length > 0;

  const persist = () => {
    if (!canSave) return false;
    saveMealTemplate(name.trim(), ingredients);
    return true;
  };

  // Closing (Done, or tapping the backdrop) with a name and at least one
  // ingredient already entered should keep the meal rather than silently
  // discard it — same reasoning as AddFoodSheet's own Done/backdrop save.
  const close = () => {
    persist();
    reset();
    onClose();
  };

  const save = () => {
    if (!persist()) return;
    haptic([20, 30]);
    reset();
    onClose();
  };

  return (
    <>
      {/* Hidden while adding an ingredient so only one sheet is ever visible
          at once — this component's own state (name/ingredients) survives
          that toggle regardless, since it lives here, not inside AddFoodSheet. */}
      <BottomSheet open={open && !addingIngredient} onClose={close} title={t.createMeal.title}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
              {t.createMeal.meal}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              placeholder={t.createMeal.mealPlaceholder}
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.createMeal.ingredients}
            </p>
            {ingredients.length === 0 ? (
              <Card className="p-4 text-center text-[14px] text-muted-foreground">
                {t.createMeal.ingredientsEmpty}
              </Card>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const m = scaledMacros(ing);
                  return (
                    <Card key={i} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{ing.name}</p>
                        <p className="tabular text-[12px] text-muted-foreground">
                          {ing.grams}g · {m.calories} kcal
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          haptic(12);
                          setIngredients((cur) => cur.filter((_, idx) => idx !== i));
                        }}
                        aria-label={t.createMeal.removeIngredient(ing.name)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {loggedMeals.length > 0 ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                {t.createMeal.fromLogged}
              </p>
              <div className="flex flex-wrap gap-2">
                {loggedMeals.map(({ meal, entries }) => {
                  const done = imported.includes(meal);
                  return (
                    <button
                      key={meal}
                      disabled={done}
                      onClick={() => importMeal(meal, entries)}
                      aria-label={t.createMeal.addAllFrom(t.mealTypes[meal], entries.length)}
                      className={`relative flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[14px] font-semibold active:scale-95 ${
                        done
                          ? "bg-secondary text-muted-foreground"
                          : "bg-primary/15 text-foreground"
                      }`}
                    >
                      {done ? <Check className="size-4" /> : <ListPlus className="size-4" />}
                      {t.mealTypes[meal]}
                      <span className="tabular text-[12px] text-muted-foreground">
                        {entries.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            onClick={() => {
              haptic(15);
              setAddingIngredient(true);
            }}
            className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-text active:scale-[0.985]"
          >
            <Plus className="size-4" /> {t.createMeal.addIngredient}
          </button>

          {ingredients.length > 0 ? (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
                {t.createMeal.wholeMeal}
              </p>
              <p className="tabular mt-1 text-[15px] font-semibold">
                {t.createMeal.macroSummary(
                  totals.calories,
                  totals.protein,
                  totals.carbs,
                  totals.fat,
                  totals.fiber,
                  totals.salt,
                )}
              </p>
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={!canSave}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> {t.createMeal.saveMeal}
          </button>
        </div>
      </BottomSheet>

      <AddFoodSheet
        open={addingIngredient}
        onClose={() => setAddingIngredient(false)}
        onIngredientCaptured={(ingredient) => {
          setIngredients((cur) => [...cur, ingredient]);
          setAddingIngredient(false);
        }}
      />
    </>
  );
}
