import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, Minus, NotebookPen, Plus, Trash2 } from "lucide-react";
import { button } from "./ui";
import { AddFoodSheet } from "./AddFoodSheet";
import { BottomSheet } from "./BottomSheet";
import { FoodListSheet } from "./FoodListSheet";
import { Card } from "./Screen";
import { useTranslation } from "../../lib/gym/i18n";
import {
  dailyTotals,
  recipePerServing,
  scaledMacros,
  type MealIngredient,
} from "../../lib/gym/nutrition";
import { selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

/**
 * Mirrors CreateMealSheet's shape (name + ingredient list, built by reusing
 * AddFoodSheet for each ingredient) with one addition: `servings`, the whole
 * batch's yield — what actually makes a Recipe a Recipe rather than another
 * MealTemplate, since it's what lets a later log ask "how many servings"
 * instead of always logging the fixed, full ingredient list.
 */
/** A recipe to start from: read from a note or recipe (FoodListSheet). */
export interface RecipeSeed {
  name: string;
  servings: number | null;
  ingredients: MealIngredient[];
}

export function CreateRecipeSheet({
  open,
  onClose,
  seed = null,
}: {
  open: boolean;
  onClose: () => void;
  seed?: RecipeSeed | null;
}) {
  const { saveRecipe } = useGym();
  const t = useTranslation();
  const [name, setName] = useState("");
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [addingIngredient, setAddingIngredient] = useState(false);
  /** An ingredient whose food is being swapped; its grams stay. */
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  /** Reading ingredients from a note (FoodListSheet). */
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open || !seed) return;
    setName(seed.name);
    if (seed.servings) setServings(Math.min(50, seed.servings));
    setIngredients(seed.ingredients);
  }, [open, seed]);

  const reset = () => {
    setName("");
    setServings(4);
    setIngredients([]);
    setAddingIngredient(false);
    setSwapIndex(null);
    setReading(false);
  };

  const totals = useMemo(() => dailyTotals(ingredients), [ingredients]);
  const perServing = useMemo(
    () => recipePerServing({ id: "", name: "", servings, ingredients }),
    [servings, ingredients],
  );
  const canSave = name.trim().length > 0 && ingredients.length > 0 && servings > 0;

  const persist = () => {
    if (!canSave) return false;
    saveRecipe(name.trim(), servings, ingredients);
    return true;
  };

  // Closing (Done, or tapping the backdrop) with a name and at least one
  // ingredient already entered should keep the recipe rather than silently
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
      {/* Same "hide while adding an ingredient" pattern as CreateMealSheet —
          this sheet's own state (name/servings/ingredients) survives that
          toggle regardless, since it lives here, not inside AddFoodSheet. */}
      <BottomSheet
        open={open && !addingIngredient && swapIndex === null && !reading}
        onClose={close}
        title={t.createRecipe.title}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
              {t.createRecipe.recipe}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              placeholder={t.createRecipe.recipePlaceholder}
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-muted-foreground">
                {t.createRecipe.servings}
              </p>
              <p className="text-[12px] text-muted-foreground">{t.createRecipe.servingsDesc}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  haptic(10);
                  setServings((s) => Math.max(1, s - 1));
                }}
                aria-label={t.createRecipe.fewerServings}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
              >
                <Minus className="size-4" />
              </button>
              <span className="tabular w-6 text-center text-[17px] font-bold">{servings}</span>
              <button
                onClick={() => {
                  haptic(10);
                  setServings((s) => Math.min(50, s + 1));
                }}
                aria-label={t.createRecipe.moreServings}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.createRecipe.ingredients}
            </p>
            {ingredients.length === 0 ? (
              <Card className="p-4 text-center text-[14px] text-muted-foreground">
                {t.createRecipe.ingredientsEmpty}
              </Card>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, i) => {
                  const m = scaledMacros(ing);
                  return (
                    <Card key={i} className="flex items-center justify-between gap-3 p-3">
                      {/* Tapping the food swaps it for another; the grams carry over. */}
                      <button
                        onClick={() => {
                          haptic(12);
                          setSwapIndex(i);
                        }}
                        aria-label={t.foodList.swap(ing.name)}
                        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left active:opacity-70"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            {ing.name}
                          </span>
                          <span className="tabular block text-[12px] text-muted-foreground">
                            {ing.grams}g · {m.calories} kcal
                          </span>
                        </span>
                        <ArrowLeftRight className="size-4 shrink-0 text-primary-text" />
                      </button>
                      <button
                        onClick={() => {
                          haptic(12);
                          setIngredients((cur) => cur.filter((_, idx) => idx !== i));
                        }}
                        aria-label={t.createRecipe.removeIngredient(ing.name)}
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

          <button
            onClick={() => {
              haptic(15);
              setAddingIngredient(true);
            }}
            className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-text active:scale-[0.985]"
          >
            <Plus className="size-4" /> {t.createRecipe.addIngredient}
          </button>
          <button
            onClick={() => {
              haptic(15);
              setReading(true);
            }}
            className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary-text active:scale-[0.985]"
          >
            <NotebookPen className="size-4" /> {t.foodList.scanIngredients}
          </button>

          {ingredients.length > 0 ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t.createRecipe.wholeBatch}
                </p>
                <p className="tabular mt-1 text-[14px]">
                  {t.createRecipe.macroSummary4(
                    totals.calories,
                    totals.protein,
                    totals.carbs,
                    totals.fat,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
                  {t.createRecipe.perServing(servings)}
                </p>
                <p className="tabular mt-1 text-[15px] font-semibold">
                  {t.createRecipe.macroSummary4(
                    perServing.calories,
                    perServing.protein,
                    perServing.carbs,
                    perServing.fat,
                  )}
                </p>
              </div>
            </div>
          ) : null}

          <button onClick={save} disabled={!canSave} className={`${button.primary} w-full`}>
            <Check className="size-5" /> {t.createRecipe.saveRecipe}
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
      <AddFoodSheet
        open={open && swapIndex !== null}
        onClose={() => setSwapIndex(null)}
        swap={
          swapIndex !== null && ingredients[swapIndex]
            ? { query: ingredients[swapIndex].name, grams: ingredients[swapIndex].grams }
            : undefined
        }
        onIngredientCaptured={(ing) => {
          // The ingredient's grams came along into the swap (changeable
          // there), so the captured grams are the ones to keep.
          setIngredients((cur) =>
            cur.map((old, j) =>
              j === swapIndex
                ? {
                    name: ing.name,
                    grams: ing.grams,
                    per100: ing.per100,
                    ...(ing.nevo ? { nevo: ing.nevo } : {}),
                  }
                : old,
            ),
          );
          setSwapIndex(null);
        }}
      />
      <FoodListSheet
        open={open && reading}
        start="photo"
        target="ingredients"
        onClose={() => setReading(false)}
        onIngredients={(list) => setIngredients((cur) => [...cur, ...list])}
      />
    </>
  );
}
