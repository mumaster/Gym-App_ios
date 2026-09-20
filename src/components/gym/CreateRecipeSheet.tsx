import { useMemo, useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { AddFoodSheet } from "./AddFoodSheet";
import { BottomSheet } from "./BottomSheet";
import { Card } from "./Screen";
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
export function CreateRecipeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saveRecipe } = useGym();
  const [name, setName] = useState("");
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [addingIngredient, setAddingIngredient] = useState(false);

  const reset = () => {
    setName("");
    setServings(4);
    setIngredients([]);
    setAddingIngredient(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const totals = useMemo(() => dailyTotals(ingredients), [ingredients]);
  const perServing = useMemo(
    () => recipePerServing({ id: "", name: "", servings, ingredients }),
    [servings, ingredients],
  );
  const canSave = name.trim().length > 0 && ingredients.length > 0 && servings > 0;

  const save = () => {
    if (!canSave) return;
    haptic([20, 30]);
    saveRecipe(name.trim(), servings, ingredients);
    close();
  };

  return (
    <>
      {/* Same "hide while adding an ingredient" pattern as CreateMealSheet —
          this sheet's own state (name/servings/ingredients) survives that
          toggle regardless, since it lives here, not inside AddFoodSheet. */}
      <BottomSheet open={open && !addingIngredient} onClose={close} title="Create recipe">
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">Recipe</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              placeholder="e.g. Chicken stir fry"
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

          <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-muted-foreground">Servings</p>
              <p className="text-[12px] text-muted-foreground">How many the whole batch makes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  haptic(10);
                  setServings((s) => Math.max(1, s - 1));
                }}
                aria-label="Fewer servings"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
              >
                <Minus className="size-4" />
              </button>
              <span className="tabular w-6 text-center text-[18px] font-bold">{servings}</span>
              <button
                onClick={() => {
                  haptic(10);
                  setServings((s) => Math.min(50, s + 1));
                }}
                aria-label="More servings"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Ingredients</p>
            {ingredients.length === 0 ? (
              <Card className="p-4 text-center text-[14px] text-muted-foreground">
                Add each ingredient — scan its label or enter it manually.
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
                        aria-label={`Remove ${ing.name}`}
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
            className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-primary active:scale-[0.985]"
          >
            <Plus className="size-4" /> Add ingredient
          </button>

          {ingredients.length > 0 ? (
            <div className="space-y-2">
              <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Whole batch
                </p>
                <p className="tabular mt-1 text-[14px]">
                  {totals.calories} kcal · {totals.protein}g protein · {totals.carbs}g carbs ·{" "}
                  {totals.fat}g fat
                </p>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
                  Per serving ({servings} total)
                </p>
                <p className="tabular mt-1 text-[15px] font-semibold">
                  {perServing.calories} kcal · {perServing.protein}g protein · {perServing.carbs}g
                  carbs · {perServing.fat}g fat
                </p>
              </div>
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={!canSave}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> Save recipe
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
