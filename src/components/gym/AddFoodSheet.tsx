import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, Keyboard, Loader2, Plus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { scanNutritionLabel } from "../../lib/gym/labelScan";
import {
  MEAL_LABELS,
  MEAL_ORDER,
  mealForTime,
  NUTRIENT_LABELS,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  scaledMacros,
  type FoodEntry,
  type MealIngredient,
  type MealType,
  type NutrientKey,
} from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, placeCursorAtEnd } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

type Step = "start" | "scanning" | "review";
type MacroKey = NutrientKey;

const MACRO_FIELDS: { key: MacroKey; label: string; unit: string }[] = NUTRIENT_ORDER.map(
  (key) => ({ key, label: NUTRIENT_LABELS[key], unit: NUTRIENT_UNITS[key] }),
);

const emptyPer100 = Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, ""])) as Record<
  MacroKey,
  string
>;

const per100ToDraft = (per100: FoodEntry["per100"]): Record<MacroKey, string> =>
  Object.fromEntries(NUTRIENT_ORDER.map((key) => [key, String(per100[key])])) as Record<
    MacroKey,
    string
  >;

/** Max distinct recent foods offered for one-tap re-logging on the start step. */
const RECENT_LIMIT = 5;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AddFoodSheet({
  open,
  onClose,
  editEntry = null,
  onIngredientCaptured,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet opens straight into editing this entry instead of adding a new one. */
  editEntry?: FoodEntry | null;
  /**
   * When set, capture {name, grams, per100} to this callback instead of
   * writing to the food log — used by the meal builder to add one
   * ingredient to a meal in progress. Hides the meal picker (irrelevant
   * for a standalone ingredient).
   */
  onIngredientCaptured?: (ingredient: MealIngredient) => void;
}) {
  const { addFoodEntry, updateFoodEntry, foodEntries } = useGym();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("start");
  const [scanError, setScanError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealType>(() => mealForTime(new Date().toISOString()));
  const [grams, setGrams] = useState("100");
  const [gramsTouched, setGramsTouched] = useState(false);
  const [suggestedGrams, setSuggestedGrams] = useState<number | null>(null);
  const [per100, setPer100] = useState<Record<MacroKey, string>>(emptyPer100);
  const [unmatched, setUnmatched] = useState<Set<MacroKey>>(new Set());

  const reset = () => {
    setStep("start");
    setScanError(null);
    setName("");
    setMeal(mealForTime(new Date().toISOString()));
    setGrams("100");
    setGramsTouched(false);
    setSuggestedGrams(null);
    setPer100(emptyPer100);
    setUnmatched(new Set());
  };

  const close = () => {
    // Closing (Done, or tapping the backdrop) while editing an existing
    // entry should keep whatever was changed, not silently discard it —
    // there's no separate "Save" action to remind the user to hit first.
    if (editEntry && step === "review") persistEdits();
    reset();
    onClose();
  };

  // Editing an existing entry skips straight to the review step, pre-filled.
  useEffect(() => {
    if (!open || !editEntry) return;
    setStep("review");
    setScanError(null);
    setName(editEntry.name);
    setMeal(editEntry.meal);
    setGrams(String(editEntry.grams));
    setGramsTouched(false);
    setSuggestedGrams(null);
    setPer100(per100ToDraft(editEntry.per100));
    setUnmatched(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editEntry?.id]);

  /** Most recently logged distinct foods, newest first, for one-tap re-add. */
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const list: FoodEntry[] = [];
    for (const entry of foodEntries) {
      const key = entry.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(entry);
      if (list.length >= RECENT_LIMIT) break;
    }
    return list;
  }, [foodEntries]);

  const startManual = () => {
    haptic(15);
    setName("");
    setPer100(emptyPer100);
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setStep("review");
  };

  const startFromRecent = (entry: FoodEntry) => {
    haptic(15);
    setName(entry.name);
    setMeal(mealForTime(new Date().toISOString()));
    setGrams(String(entry.grams));
    setGramsTouched(true);
    setPer100(per100ToDraft(entry.per100));
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setStep("review");
  };

  const startScan = () => {
    haptic(15);
    setScanError(null);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (file: File) => {
    setStep("scanning");
    try {
      const imageBase64 = await fileToBase64(file);
      const result = await scanNutritionLabel({
        data: { imageBase64, mimeType: file.type || "image/jpeg" },
      });

      const missing = new Set<MacroKey>();
      const next: Record<MacroKey, string> = { ...emptyPer100 };
      for (const { key } of MACRO_FIELDS) {
        const v = result[key];
        if (v === null) missing.add(key);
        else next[key] = String(v);
      }
      setPer100(next);
      setUnmatched(missing);
      setName(result.name?.trim() || "Scanned food");
      setSuggestedGrams(!gramsTouched ? result.servingSizeGrams : null);
      setStep("review");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setScanError(
        `Couldn't read that photo — try a clearer, well-lit shot, or enter it manually. (${detail})`,
      );
      setStep("start");
    }
  };

  const gramsNum = parseDecimal(grams) || 0;
  const factor = gramsNum / 100;
  const preview = {
    calories: Math.round((parseDecimal(per100.calories) || 0) * factor),
    protein: Number(((parseDecimal(per100.protein) || 0) * factor).toFixed(1)),
    carbs: Number(((parseDecimal(per100.carbs) || 0) * factor).toFixed(1)),
    fat: Number(((parseDecimal(per100.fat) || 0) * factor).toFixed(1)),
    fiber: Number(((parseDecimal(per100.fiber) || 0) * factor).toFixed(1)),
    salt: Number(((parseDecimal(per100.salt) || 0) * factor).toFixed(2)),
  };

  const canSave = name.trim().length > 0 && gramsNum > 0;

  /** Writes the current form to the store. Returns whether it actually saved. */
  const persistEdits = () => {
    if (!canSave) return false;
    const per100Value = {
      calories: parseDecimal(per100.calories) || 0,
      protein: parseDecimal(per100.protein) || 0,
      carbs: parseDecimal(per100.carbs) || 0,
      fat: parseDecimal(per100.fat) || 0,
      fiber: parseDecimal(per100.fiber) || 0,
      salt: parseDecimal(per100.salt) || 0,
    };
    if (onIngredientCaptured) {
      onIngredientCaptured({ name: name.trim(), grams: gramsNum, per100: per100Value });
      return true;
    }
    if (editEntry) {
      updateFoodEntry(editEntry.id, {
        name: name.trim(),
        meal,
        grams: gramsNum,
        per100: per100Value,
      });
    } else {
      addFoodEntry({
        id: crypto.randomUUID(),
        name: name.trim(),
        logged_at: new Date().toISOString(),
        meal,
        grams: gramsNum,
        per100: per100Value,
      });
    }
    return true;
  };

  const save = () => {
    if (!persistEdits()) return;
    haptic([20, 30]);
    close();
  };

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={onIngredientCaptured ? "Add ingredient" : editEntry ? "Edit food" : "Add food"}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFileSelected(file);
        }}
      />

      {step === "start" ? (
        <div className="space-y-3">
          {scanError ? (
            <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {scanError}
            </p>
          ) : null}
          <button
            onClick={startScan}
            className="glow flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-primary px-5 text-left text-primary-foreground active:scale-[0.985]"
          >
            <Camera className="size-6 shrink-0" />
            <div>
              <p className="text-[16px] font-bold">Scan nutrition label</p>
              <p className="text-[13px] opacity-80">Photograph the label — we'll read it for you</p>
            </div>
          </button>
          <button
            onClick={startManual}
            className="glass flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-5 text-left active:scale-[0.985]"
          >
            <Keyboard className="size-6 shrink-0 text-primary" />
            <div>
              <p className="text-[16px] font-bold">Enter manually</p>
              <p className="text-[13px] text-muted-foreground">Type in the values yourself</p>
            </div>
          </button>

          {recentFoods.length ? (
            <div className="pt-1">
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Recent</p>
              <div className="space-y-2">
                {recentFoods.map((entry) => {
                  const m = scaledMacros(entry);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => startFromRecent(entry)}
                      className="glass flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.985]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold">{entry.name}</p>
                        <p className="tabular text-[12px] text-muted-foreground">
                          {entry.grams}g · {m.calories} kcal
                        </p>
                      </div>
                      <Plus className="size-4 shrink-0 text-primary" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "scanning" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-[15px] font-semibold">Reading the label…</p>
          <p className="text-[13px] text-muted-foreground">
            Your photo is sent to Google's Gemini API to read the label, then discarded.
          </p>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-4">
          {unmatched.size > 0 ? (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-[13px] text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Couldn't read{" "}
              {[...unmatched].map((k) => MACRO_FIELDS.find((f) => f.key === k)!.label).join(", ")} —
              double-check those fields.
            </p>
          ) : null}

          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">Food</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={placeCursorAtEnd}
              placeholder="e.g. Greek yogurt"
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

          {onIngredientCaptured ? null : (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">Meal</p>
              <div className="flex gap-2">
                {MEAL_ORDER.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      haptic(10);
                      setMeal(m);
                    }}
                    aria-pressed={meal === m}
                    className={`min-h-[40px] flex-1 rounded-2xl text-[14px] font-semibold ${
                      meal === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-secondary-foreground"
                    }`}
                  >
                    {MEAL_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestedGrams && !gramsTouched ? (
            <button
              type="button"
              onClick={() => {
                haptic(15);
                setGrams(String(suggestedGrams));
                setGramsTouched(true);
                setSuggestedGrams(null);
              }}
              className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 text-left active:scale-[0.985]"
            >
              <span className="text-[14px] font-semibold text-primary">
                Use the label's serving size — {suggestedGrams}g?
              </span>
              <Check className="size-4 shrink-0 text-primary" />
            </button>
          ) : null}

          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
              {onIngredientCaptured ? "Grams in this meal" : "Grams eaten"}
            </span>
            <input
              inputMode="decimal"
              type="text"
              value={grams}
              onFocus={placeCursorAtEnd}
              onChange={(e) => {
                if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                setGrams(e.target.value);
                setGramsTouched(true);
              }}
              className="tabular h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[17px] font-bold text-foreground outline-none"
            />
          </label>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              Per 100g — as printed on the label
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MACRO_FIELDS.map(({ key, label, unit }) => (
                <label
                  key={key}
                  className={`flex flex-col gap-1 rounded-2xl px-3.5 py-2.5 ${
                    unmatched.has(key) ? "bg-amber-400/10" : "bg-muted"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <input
                      inputMode="decimal"
                      type="text"
                      value={per100[key]}
                      onFocus={placeCursorAtEnd}
                      onChange={(e) => {
                        if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                        setPer100((cur) => ({ ...cur, [key]: e.target.value }));
                        setUnmatched((cur) => {
                          const next = new Set(cur);
                          next.delete(key);
                          return next;
                        });
                      }}
                      placeholder="0"
                      className="tabular h-7 w-full min-w-0 bg-transparent text-[17px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <span className="shrink-0 text-[12px] text-muted-foreground">{unit}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              {onIngredientCaptured ? "This ingredient" : "This portion"}
            </p>
            <p className="tabular mt-1 text-[15px] font-semibold">
              {preview.calories} kcal · {preview.protein}g protein · {preview.carbs}g carbs ·{" "}
              {preview.fat}g fat · {preview.fiber}g fiber · {preview.salt}g salt
            </p>
          </div>

          {/* Editing an existing entry already saves on Done/backdrop close
              (see `close` above) — a separate button here would just be a
              second, redundant way to do the same thing. */}
          {editEntry && !onIngredientCaptured ? null : (
            <button
              onClick={save}
              disabled={!canSave}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              <Check className="size-5" /> {onIngredientCaptured ? "Add ingredient" : "Add to log"}
            </button>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}
