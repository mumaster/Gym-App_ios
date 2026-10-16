import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { button } from "./ui";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import type { SavedFood } from "../../lib/gym/myFoods";
import {
  NUTRIENT_UNITS,
  withSatFat,
  withSugars,
  type MealIngredient,
  type NutrientKey,
} from "../../lib/gym/nutrition";

type Draft = Record<NutrientKey, string>;
const KEYS: NutrientKey[] = [
  "calories",
  "fat",
  "satFat",
  "carbs",
  "sugars",
  "fiber",
  "protein",
  "salt",
];
const OPTIONAL: NutrientKey[] = ["sugars", "satFat"];

const toDraft = (food: SavedFood | null): Draft =>
  Object.fromEntries(
    KEYS.map((k) => [k, food?.per100[k] == null ? "" : String(food.per100[k])]),
  ) as Draft;

/**
 * Edits, adds or deletes one saved food (My food tab). The values are the
 * per-100 g figures of an EU label, in label order: the same rows the Add
 * food sheet shows, with "of which saturated" and "of which sugars" under
 * fat and carbs. Sugars and saturated fat stay "not known" when left empty,
 * never 0 (nutrition.ts).
 */
export function MyFoodEditSheet({
  open,
  food,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** The food to edit, or null to add a new one. */
  food: SavedFood | null;
  onClose: () => void;
  onSave: (next: MealIngredient) => void;
  onDelete: (() => void) | undefined;
}) {
  const t = useTranslation();
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("100");
  const [draft, setDraft] = useState<Draft>(() => toDraft(null));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Start from the picked food each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setName(food?.name ?? "");
    setGrams(food ? String(food.grams) : "100");
    setDraft(toDraft(food));
    setConfirmDelete(false);
  }, [open, food]);

  const label = (k: NutrientKey) =>
    k === "satFat"
      ? t.addFood.ofWhichSatFat
      : k === "sugars"
        ? t.addFood.ofWhichSugars
        : t.nutrients[k];

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const num = (k: NutrientKey) => parseDecimal(draft[k]) || 0;
    const opt = (k: NutrientKey) => (draft[k].trim() === "" ? null : parseDecimal(draft[k]));
    const per100 = withSatFat(
      withSugars(
        {
          calories: num("calories"),
          protein: num("protein"),
          carbs: num("carbs"),
          fat: num("fat"),
          fiber: num("fiber"),
          salt: num("salt"),
        },
        opt("sugars"),
      ),
      opt("satFat"),
    );
    haptic(15);
    onSave({ name: n, grams: Math.max(1, parseDecimal(grams) || 100), per100 });
  };

  const numberBox =
    "tabular h-11 w-full min-w-0 bg-transparent text-right text-[17px] font-bold text-foreground outline-none placeholder:text-muted-foreground";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={food ? t.myFood.editTitle : t.myFood.newTitle}
      tall
    >
      <div className="space-y-3 px-5 pb-6">
        <label className="glass-chip flex h-12 items-center gap-3 rounded-2xl px-4">
          <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
            {t.myFood.name}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.myFood.namePlaceholder}
            autoComplete="off"
            enterKeyHint="done"
            className="h-11 w-full min-w-0 bg-transparent text-right text-[16px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!name.trim()}
          className={`${button.primary} w-full`}
        >
          <Check className="size-5" aria-hidden /> {t.myFood.save}
        </button>

        <div className="rounded-3xl bg-muted p-1">
          <div className="flex items-center pt-1.5 pb-0.5 pl-3">
            <span className="min-w-0 flex-1" />
            <span className="w-[8.5rem] shrink-0 pr-4 text-right text-[12px] font-semibold text-muted-foreground">
              {t.addFood.per100gShort}
            </span>
          </div>
          {KEYS.map((k) => {
            const sub = OPTIONAL.includes(k);
            return (
              <label key={k} className="flex items-center rounded-xl pl-3">
                <span
                  className={`min-w-0 flex-1 truncate ${
                    sub
                      ? "pl-3 text-[13px] text-muted-foreground"
                      : k === "calories"
                        ? "text-[16px] font-bold"
                        : "text-[14px] font-semibold"
                  }`}
                >
                  {label(k)}
                </span>
                <span className="flex w-[8.5rem] shrink-0 items-baseline gap-1 pr-4">
                  <input
                    inputMode="decimal"
                    type="text"
                    aria-label={`${label(k)} ${t.addFood.per100gShort}`}
                    value={draft[k]}
                    onFocus={selectOnFocus}
                    onChange={(e) => {
                      if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                      setDraft((cur) => ({ ...cur, [k]: e.target.value }));
                    }}
                    placeholder={sub ? "–" : "0"}
                    className={numberBox}
                  />
                  <span className="w-8 shrink-0 text-[11px] text-muted-foreground">
                    {NUTRIENT_UNITS[k]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <label className="glass-chip flex h-12 items-center gap-3 rounded-2xl px-4">
          <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
            {t.myFood.portion}
          </span>
          <input
            inputMode="decimal"
            type="text"
            value={grams}
            onFocus={selectOnFocus}
            onChange={(e) => {
              if (DECIMAL_INPUT_RE.test(e.target.value)) setGrams(e.target.value);
            }}
            className="tabular h-11 w-full min-w-0 bg-transparent text-right text-[17px] font-bold text-foreground outline-none"
          />
        </label>

        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              if (!confirmDelete) {
                haptic(10);
                setConfirmDelete(true);
                return;
              }
              onDelete();
            }}
            className={`${button.destructive} w-full`}
          >
            <Trash2 className="size-4" aria-hidden />
            {confirmDelete ? t.myFood.deleteSure : t.myFood.delete}
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
