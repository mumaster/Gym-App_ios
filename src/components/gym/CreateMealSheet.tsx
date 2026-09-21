import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { AddFoodSheet } from "./AddFoodSheet";
import { BottomSheet } from "./BottomSheet";
import { Card } from "./Screen";
import { dailyTotals, scaledMacros, type MealIngredient } from "../../lib/gym/nutrition";
import { selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

export function CreateMealSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { saveMealTemplate } = useGym();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<MealIngredient[]>([]);
  const [addingIngredient, setAddingIngredient] = useState(false);

  const reset = () => {
    setName("");
    setIngredients([]);
    setAddingIngredient(false);
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
      <BottomSheet open={open && !addingIngredient} onClose={close} title="Create meal">
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">Meal</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={selectOnFocus}
              placeholder="e.g. Banana oatmeal"
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

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
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
                Whole meal
              </p>
              <p className="tabular mt-1 text-[15px] font-semibold">
                {totals.calories} kcal · {totals.protein}g protein · {totals.carbs}g carbs ·{" "}
                {totals.fat}g fat · {totals.fiber}g fiber · {totals.salt}g salt
              </p>
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={!canSave}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> Save meal
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
