import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Keyboard, Plus, ScanBarcode, Star, Trash2 } from "lucide-react";
import { FoodScanner, type FoodScannerStatus } from "./FoodScanner";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { HapticSwitch } from "./HapticSwitch";
import { lookupBarcode } from "../../lib/gym/barcodeLookup";
import { useTranslation } from "../../lib/gym/i18n";
import { scanNutritionLabel, type ScannedLabel } from "../../lib/gym/labelScan";
import {
  MEAL_ORDER,
  dailyTotals,
  mealForTime,
  recipePerServing,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  scaledMacros,
  type FoodEntry,
  type MealIngredient,
  type MealType,
  type NutrientKey,
} from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

type Step = "start" | "scanning" | "review";
type MacroKey = NutrientKey;

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

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Longest edge a scanned label photo gets downscaled to before upload — a
 *  label's fine print stays perfectly legible well below full camera
 *  resolution, and a smaller image means less to upload and fewer tiles for
 *  Gemini to process, so this is the main lever for a faster scan without
 *  spending anything. */
const MAX_SCAN_DIMENSION = 1280;

/** Downscales + re-encodes as JPEG (phone camera photos are routinely
 *  several MB at full resolution). Falls back to the original file untouched
 *  if resizing fails for any reason — a slower scan beats a broken one. */
async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SCAN_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Canvas failed to encode JPEG");

    return { base64: await readAsBase64(blob), mimeType: "image/jpeg" };
  } catch {
    return { base64: await readAsBase64(file), mimeType: file.type || "image/jpeg" };
  }
}

export function AddFoodSheet({
  open,
  onClose,
  editEntry = null,
  onIngredientCaptured,
  initialMeal,
  onCreateMeal,
  onCreateRecipe,
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
  /** Meal to add to, e.g. from a meal's "+" in the log; else by time of day. */
  initialMeal?: MealType | undefined;
  /** Open the meal/recipe builders. The parent closes this sheet first, so
   *  two overlays are never stacked. Without them the sections are hidden
   *  (the meal builder's own ingredient picker). */
  onCreateMeal?: () => void;
  onCreateRecipe?: () => void;
}) {
  const {
    addFoodEntry,
    updateFoodEntry,
    removeFoodEntry,
    foodEntries,
    favoriteFoods,
    toggleFavoriteFood,
    mealTemplates,
    recipes,
    logMealTemplate,
    logRecipe,
    deleteMealTemplate,
    deleteRecipe,
  } = useGym();
  const t = useTranslation();
  const MACRO_FIELDS: { key: MacroKey; label: string; unit: string }[] = NUTRIENT_ORDER.map(
    (key) => ({ key, label: t.nutrients[key], unit: NUTRIENT_UNITS[key] }),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("start");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<FoodScannerStatus>("scanning");
  /** Which flow the "scanning" step's loading copy below belongs to. */
  const [scanKind, setScanKind] = useState<"label" | "barcode">("label");
  const [scanError, setScanError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealType>(() => mealForTime(new Date().toISOString()));
  const [grams, setGrams] = useState("100");
  const [gramsTouched, setGramsTouched] = useState(false);
  const [suggestedGrams, setSuggestedGrams] = useState<number | null>(null);
  const [per100, setPer100] = useState<Record<MacroKey, string>>(emptyPer100);
  const [unmatched, setUnmatched] = useState<Set<MacroKey>>(new Set());
  const [editingSaved, setEditingSaved] = useState(false);

  // A new entry goes to the meal it was opened for (a meal's "+"), else the
  // one the time of day suggests.
  useEffect(() => {
    if (open && !editEntry) setMeal(initialMeal ?? mealForTime(new Date().toISOString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMeal]);

  const reset = () => {
    setStep("start");
    setScannerOpen(false);
    setScanError(null);
    setName("");
    setMeal(mealForTime(new Date().toISOString()));
    setGrams("100");
    setGramsTouched(false);
    setSuggestedGrams(null);
    setPer100(emptyPer100);
    setUnmatched(new Set());
    setEditingSaved(false);
  };

  const close = () => {
    // Closing (Done, or tapping the backdrop) with the review form filled
    // in — whether that's a scan result, a manual entry, or an edit —
    // should keep it rather than silently discard it: there's no separate
    // reminder to hit "Add to log" first, and Done reads as "I'm finished
    // with this," not "throw it away."
    if (step === "review") persistEdits();
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

  const foodKey = (n: string) => n.trim().toLowerCase();
  const favoriteKeys = useMemo(
    () => new Set(favoriteFoods.map((f) => foodKey(f.name))),
    [favoriteFoods],
  );

  /** Most recently logged distinct foods, newest first, for one-tap re-add
   *  — favourites are listed separately above, so they're left out here. */
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const list: MealIngredient[] = [];
    for (const entry of [...foodEntries].sort((a, b) => b.logged_at.localeCompare(a.logged_at))) {
      const key = foodKey(entry.name);
      if (!key || seen.has(key) || favoriteKeys.has(key)) continue;
      seen.add(key);
      list.push({ name: entry.name, grams: entry.grams, per100: entry.per100 });
      if (list.length >= RECENT_LIMIT) break;
    }
    return list;
  }, [foodEntries, favoriteKeys]);

  /** The "+" on a favourite/recent row: logs it straight away with its usual
   *  portion (or, in the meal builder, adds it as an ingredient). */
  const quickAdd = (food: MealIngredient) => {
    haptic([20, 30]);
    if (onIngredientCaptured) {
      onIngredientCaptured(food);
    } else {
      addFoodEntry({
        id: crypto.randomUUID(),
        name: food.name,
        logged_at: new Date().toISOString(),
        meal,
        grams: food.grams,
        per100: food.per100,
      });
    }
    close();
  };

  const startManual = () => {
    haptic(15);
    setName("");
    setPer100(emptyPer100);
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setStep("review");
  };

  const startFromRecent = (entry: MealIngredient) => {
    haptic(15);
    setName(entry.name);
    setGrams(String(entry.grams));
    setGramsTouched(true);
    setPer100(per100ToDraft(entry.per100));
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setStep("review");
  };

  /** One scanner for both paths — see FoodScanner. */
  const startScan = () => {
    haptic(15);
    setScanError(null);
    setScannerStatus("scanning");
    setScannerOpen(true);
  };

  const choosePhoto = () => {
    setScannerOpen(false);
    fileInputRef.current?.click();
  };

  /** Fills the review form from a label scan or a barcode lookup — both
   *  return the same shape, so one path applies either result. */
  const applyScanResult = (result: ScannedLabel) => {
    const missing = new Set<MacroKey>();
    const next: Record<MacroKey, string> = { ...emptyPer100 };
    for (const { key } of MACRO_FIELDS) {
      const v = result[key];
      if (v === null) missing.add(key);
      else next[key] = String(v);
    }
    setPer100(next);
    setUnmatched(missing);
    setName(result.name?.trim() || t.addFood.scannedFoodFallback);
    setSuggestedGrams(!gramsTouched ? result.servingSizeGrams : null);
    setStep("review");
  };

  const onFileSelected = async (file: File) => {
    setScanKind("label");
    setStep("scanning");
    try {
      const { base64: imageBase64, mimeType } = await fileToBase64(file);
      const result = await scanNutritionLabel({
        data: { imageBase64, mimeType },
      });
      applyScanResult(result);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setScanError(t.addFood.scanReadError(detail));
      setStep("start");
    }
  };

  // The camera stays open during the lookup: if the product isn't in the
  // database the user is already pointing at the package, so the next step
  // is one shutter tap on its label rather than starting over.
  const onBarcodeDetected = async (barcode: string) => {
    setScannerStatus("lookingUp");
    try {
      const result = await lookupBarcode(barcode);
      if (!result) {
        setScannerStatus("notFound");
        return;
      }
      setScannerOpen(false);
      applyScanResult(result);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setScannerOpen(false);
      setScanError(t.addFood.barcodeLookupError(detail));
      setStep("start");
    }
  };

  const onPhotoCaptured = (photo: Blob) => {
    setScannerOpen(false);
    void onFileSelected(new File([photo], "label.jpg", { type: photo.type || "image/jpeg" }));
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
  const draftPer100 = () => ({
    calories: parseDecimal(per100.calories) || 0,
    protein: parseDecimal(per100.protein) || 0,
    carbs: parseDecimal(per100.carbs) || 0,
    fat: parseDecimal(per100.fat) || 0,
    fiber: parseDecimal(per100.fiber) || 0,
    salt: parseDecimal(per100.salt) || 0,
  });

  const persistEdits = () => {
    if (!canSave) return false;
    const per100Value = draftPer100();
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

  /** Delete from the edit screen — the path that doesn't need a swipe. */
  const deleteEntry = () => {
    if (!editEntry) return;
    haptic(15);
    removeFoodEntry(editEntry.id);
    reset();
    onClose();
  };

  const openBuilder = (openIt: () => void) => {
    haptic(15);
    reset();
    openIt();
  };

  const showSaved = !onIngredientCaptured && !editEntry;

  return (
    <>
      <BottomSheet
        open={open}
        onClose={close}
        title={
          onIngredientCaptured
            ? t.addFood.addIngredient
            : editEntry
              ? t.addFood.editFood
              : t.addFood.addFood
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFileSelected(file);
          }}
        />

        {step === "start" ? (
          <div className="space-y-4">
            {scanError ? (
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {scanError}
              </p>
            ) : null}
            {onIngredientCaptured ? null : (
              <MealPicker label={t.addFood.addingTo} meal={meal} onPick={setMeal} />
            )}
            {/* Scan and manual side by side, first: they used to sit under
                every list, a long scroll down once meals and recipes moved
                into this sheet. */}
            <div className="grid grid-cols-[1.7fr_1fr] gap-2">
              <button
                onClick={startScan}
                className="glow flex min-h-[60px] items-center gap-2.5 rounded-2xl bg-primary px-4 text-left text-primary-foreground active:scale-[0.985]"
              >
                <ScanBarcode className="size-6 shrink-0" />
                <span className="text-[14.5px] font-bold leading-tight">{t.addFood.scanFood}</span>
              </button>
              <button
                onClick={startManual}
                className="glass flex min-h-[60px] items-center gap-2 rounded-2xl px-3 text-left active:scale-[0.985]"
              >
                <Keyboard className="size-5 shrink-0 text-primary" />
                <span className="text-[14px] font-bold leading-tight">
                  {t.addFood.enterManually}
                </span>
              </button>
            </div>
            {favoriteFoods.length ? (
              <FoodList
                title={t.addFood.favorites}
                foods={favoriteFoods}
                favoriteKeys={favoriteKeys}
                onOpen={startFromRecent}
                onQuickAdd={quickAdd}
                onToggleFavorite={toggleFavoriteFood}
              />
            ) : null}
            {recentFoods.length ? (
              <FoodList
                title={t.addFood.recent}
                foods={recentFoods}
                favoriteKeys={favoriteKeys}
                onOpen={startFromRecent}
                onQuickAdd={quickAdd}
                onToggleFavorite={toggleFavoriteFood}
              />
            ) : null}
            {showSaved && onCreateMeal ? (
              <SavedList
                title={t.nutrition.meals}
                empty={t.nutrition.mealsEmpty}
                newLabel={t.nutrition.newMeal}
                editing={editingSaved}
                onToggleEdit={() => setEditingSaved((v) => !v)}
                onNew={() => openBuilder(onCreateMeal)}
                items={mealTemplates.map((m) => ({
                  id: m.id,
                  name: m.name,
                  detail: `${t.nutrition.ingredientCount(m.ingredients.length)} · ${t.nutrition.kcal(dailyTotals(m.ingredients).calories)}`,
                  logLabel: t.nutrition.logTemplate(m.name),
                }))}
                onLog={(id) => {
                  haptic([20, 30]);
                  logMealTemplate(id, meal);
                  close();
                }}
                onDelete={(id) => {
                  haptic(15);
                  deleteMealTemplate(id);
                }}
              />
            ) : null}
            {showSaved && onCreateRecipe ? (
              <SavedList
                title={t.nutrition.recipes}
                empty={t.nutrition.recipesEmpty}
                newLabel={t.nutrition.newRecipe}
                editing={editingSaved}
                onToggleEdit={() => setEditingSaved((v) => !v)}
                onNew={() => openBuilder(onCreateRecipe)}
                items={recipes.map((r) => ({
                  id: r.id,
                  name: r.name,
                  detail: `${t.nutrition.servingCount(r.servings)} · ${t.nutrition.kcalPerServing(recipePerServing(r).calories)}`,
                  logLabel: t.nutrition.logServing(r.name),
                }))}
                onLog={(id) => {
                  haptic([20, 30]);
                  logRecipe(id, 1, meal);
                  close();
                }}
                onDelete={(id) => {
                  haptic(15);
                  deleteRecipe(id);
                }}
              />
            ) : null}
          </div>
        ) : null}

        {step === "scanning" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <DumbbellLoader size={56} className="text-primary" />
            <p className="text-[15px] font-semibold">
              {scanKind === "barcode" ? t.addFood.lookingUpProduct : t.addFood.readingLabel}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {scanKind === "barcode" ? t.addFood.lookingUpProductDesc : t.addFood.readingLabelDesc}
            </p>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-4">
            {unmatched.size > 0 ? (
              <p className="flex items-start gap-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-[13px] text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />{" "}
                {t.addFood.couldntRead(
                  [...unmatched]
                    .map((k) => MACRO_FIELDS.find((f) => f.key === k)!.label)
                    .join(", "),
                )}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
                  {t.addFood.food}
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={selectOnFocus}
                  placeholder={t.addFood.foodPlaceholder}
                  className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
                />
              </label>
              {name.trim() ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    haptic(10);
                    toggleFavoriteFood({ name, grams: gramsNum || 100, per100: draftPer100() });
                  }}
                  aria-pressed={favoriteKeys.has(foodKey(name))}
                  aria-label={
                    favoriteKeys.has(foodKey(name))
                      ? t.addFood.unfavorite(name)
                      : t.addFood.favorite(name)
                  }
                  className="flex size-11 shrink-0 rounded-2xl bg-muted items-center justify-center text-primary active:scale-90"
                >
                  <Star
                    className="size-4"
                    fill={favoriteKeys.has(foodKey(name)) ? "currentColor" : "none"}
                  />
                </button>
              ) : null}
            </div>

            {onIngredientCaptured ? null : (
              <MealPicker label={t.addFood.meal} meal={meal} onPick={setMeal} />
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
                  {t.addFood.useServingSize(suggestedGrams)}
                </span>
                <Check className="size-4 shrink-0 text-primary" />
              </button>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
                {onIngredientCaptured ? t.addFood.gramsInMeal : t.addFood.gramsEaten}
              </span>
              <input
                inputMode="decimal"
                type="text"
                value={grams}
                onFocus={selectOnFocus}
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
                {t.addFood.per100g}
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
                        onFocus={selectOnFocus}
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
                {onIngredientCaptured ? t.addFood.thisIngredient : t.addFood.thisPortion}
              </p>
              <p className="tabular mt-1 text-[15px] font-semibold">
                {t.addFood.macroSummary(
                  preview.calories,
                  preview.protein,
                  preview.carbs,
                  preview.fat,
                  preview.fiber,
                  preview.salt,
                )}
              </p>
            </div>

            {/* Editing an existing entry already saves on Done/backdrop close
              (see `close` above) — a separate button here would just be a
              second, redundant way to do the same thing. New entries keep
              an explicit button too, as the primary/expected action, even
              though Done now saves them as well. */}
            {editEntry && !onIngredientCaptured ? (
              <button
                onClick={deleteEntry}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-semibold text-destructive active:scale-[0.985]"
              >
                <Trash2 className="size-4" /> {t.addFood.deleteFromLog}
              </button>
            ) : (
              <button
                onClick={save}
                disabled={!canSave}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
              >
                <Check className="size-5" />{" "}
                {onIngredientCaptured ? t.addFood.addIngredient : t.addFood.addToLog}
              </button>
            )}
          </div>
        ) : null}
      </BottomSheet>

      <FoodScanner
        open={scannerOpen}
        status={scannerStatus}
        onClose={() => setScannerOpen(false)}
        onBarcode={(barcode) => void onBarcodeDetected(barcode)}
        onPhoto={onPhotoCaptured}
        onChoosePhoto={choosePhoto}
      />
    </>
  );
}

function FoodList({
  title,
  foods,
  favoriteKeys,
  onOpen,
  onQuickAdd,
  onToggleFavorite,
}: {
  title: string;
  foods: MealIngredient[];
  favoriteKeys: Set<string>;
  onOpen: (food: MealIngredient) => void;
  onQuickAdd: (food: MealIngredient) => void;
  onToggleFavorite: (food: MealIngredient) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {foods.map((food) => {
          const m = scaledMacros(food);
          const starred = favoriteKeys.has(food.name.trim().toLowerCase());
          return (
            <div
              key={food.name}
              className="glass flex items-center gap-1 rounded-2xl py-1 pl-4 pr-1"
            >
              <button
                onClick={() => onOpen(food)}
                className="min-w-0 flex-1 py-2 text-left active:opacity-70"
              >
                <p className="truncate text-[15px] font-semibold">{food.name}</p>
                <p className="tabular text-[12px] text-muted-foreground">
                  {food.grams}g · {m.calories} kcal
                </p>
              </button>
              <button
                onClick={() => {
                  haptic(10);
                  onToggleFavorite(food);
                }}
                aria-pressed={starred}
                aria-label={
                  starred ? t.addFood.unfavorite(food.name) : t.addFood.favorite(food.name)
                }
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary active:scale-90"
              >
                <Star className="size-4" fill={starred ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onQuickAdd(food)}
                aria-label={t.addFood.quickAdd(food.name, food.grams)}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90"
              >
                <HapticSwitch />
                <Plus className="size-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MealPicker({
  label,
  meal,
  onPick,
}: {
  label: string;
  meal: MealType;
  onPick: (meal: MealType) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        {MEAL_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              haptic(10);
              onPick(m);
            }}
            aria-pressed={meal === m}
            className={`min-h-[40px] flex-auto whitespace-nowrap rounded-2xl px-2.5 text-[13.5px] font-semibold ${
              meal === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-secondary-foreground"
            }`}
          >
            {t.mealTypes[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Saved meals or recipes: one tap on "+" logs to the chosen meal. "Edit"
 *  swaps the "+" for a delete button — deleting had no way in at all
 *  before these moved here from the Nutrition screen. */
function SavedList({
  title,
  empty,
  newLabel,
  items,
  editing,
  onToggleEdit,
  onNew,
  onLog,
  onDelete,
}: {
  title: string;
  empty: string;
  newLabel: string;
  items: { id: string; name: string; detail: string; logLabel: string }[];
  editing: boolean;
  onToggleEdit: () => void;
  onNew: () => void;
  onLog: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslation();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
        <div className="flex items-center gap-1">
          {items.length ? (
            <button
              onClick={onToggleEdit}
              className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-muted-foreground"
            >
              {editing ? t.common.done : t.common.edit}
            </button>
          ) : null}
          <button
            onClick={onNew}
            className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[13px] font-semibold text-foreground active:scale-95"
          >
            <Plus className="size-3.5" /> {newLabel}
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-muted/60 px-4 py-3 text-[12.5px] leading-snug text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="glass flex items-center gap-1 rounded-2xl py-1 pl-4 pr-1">
              <div className="min-w-0 flex-1 py-2">
                <p className="truncate text-[15px] font-semibold">{item.name}</p>
                <p className="tabular text-[12px] text-muted-foreground">{item.detail}</p>
              </div>
              {editing ? (
                <button
                  onClick={() => onDelete(item.id)}
                  aria-label={t.addFood.deleteMeal(item.name)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive active:scale-90"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <button
                  onClick={() => onLog(item.id)}
                  aria-label={item.logLabel}
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90"
                >
                  <HapticSwitch />
                  <Plus className="size-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
