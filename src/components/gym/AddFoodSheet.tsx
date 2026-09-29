import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Keyboard,
  Plus,
  ScanBarcode,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { FoodScanner, type FoodScannerStatus } from "./FoodScanner";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { HapticSwitch } from "./HapticSwitch";
import { lookupBarcode } from "../../lib/gym/barcodeLookup";
import { fileToBase64 } from "../../lib/gym/imageUpload";
import { useTranslation } from "../../lib/gym/i18n";
import { scanNutritionLabel, type ScannedLabel } from "../../lib/gym/labelScan";
import {
  loadNevoFoods,
  matchesNevo,
  nevoName,
  searchNevoFoods,
  type NevoFood,
} from "../../lib/gym/nevoFoods";
import {
  MEAL_ORDER,
  dailyTotals,
  mealForTime,
  recipePerServing,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  scaledMacros,
  type FoodEntry,
  type Macros,
  type MealIngredient,
  type MealType,
  type NutrientKey,
} from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import {
  findByBarcode,
  matchScore,
  myFoodKey,
  nameKey,
  searchMyFoods,
} from "../../lib/gym/myFoods";
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

/** A row in a food list: a favourite or recent food, or one of "your
 *  foods" (which may carry the barcode it was scanned from). */
type ListFood = MealIngredient & { barcode?: string };

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
    myFoods,
    rememberFood,
    forgetFood,
    mealTemplates,
    recipes,
    logMealTemplate,
    logRecipe,
    deleteMealTemplate,
    deleteRecipe,
    language,
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
  /** Search over your own foods and NEVO's unpackaged ones (nevoFoods.ts). */
  const [query, setQuery] = useState("");
  const [nevoFoods, setNevoFoods] = useState<NevoFood[] | null>(null);
  /** When the form holds a NEVO food: its codes and NEVO's own values, so
   *  the entry keeps its NEVO mark only while the values are unchanged. */
  const [nevoSource, setNevoSource] = useState<{ codes: number[]; per100: Macros } | null>(null);
  /** Barcode the form's food was scanned from, saved with it in "your
   *  foods" so the next scan of that product fills in your values. */
  const [barcode, setBarcode] = useState<string | null>(null);
  /** A barcode Open Food Facts didn't know: the label photographed next
   *  belongs to it. */
  const unknownBarcode = useRef<string | null>(null);
  /** Edit mode of the "Your foods" search results (remove from the library). */
  const [editingMine, setEditingMine] = useState(false);

  // The NEVO table is a separate chunk, loaded the first time the sheet opens.
  useEffect(() => {
    if (!open || nevoFoods) return;
    let alive = true;
    loadNevoFoods()
      .then((foods) => alive && setNevoFoods(foods))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, nevoFoods]);

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
    setQuery("");
    setNevoSource(null);
    setBarcode(null);
    unknownBarcode.current = null;
    setEditingMine(false);
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
    setNevoSource(editEntry.nevo ? { codes: editEntry.nevo, per100: editEntry.per100 } : null);
    setBarcode(null);
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
      list.push({
        name: entry.name,
        grams: entry.grams,
        per100: entry.per100,
        ...(entry.nevo ? { nevo: entry.nevo } : {}),
      });
      if (list.length >= RECENT_LIMIT) break;
    }
    return list;
  }, [foodEntries, favoriteKeys]);

  const q = query.trim();
  const searching = q.length > 0;
  /** Your own foods matching the search come first: they carry your usual
   *  portion, so they're a one-tap "+". */
  const savedMatches = useMemo((): ListFood[] => {
    if (!q) return [];
    const favorites = favoriteFoods.filter((food) => matchScore(food.name, q) !== null);
    // Everything you scanned or typed in before (myFoods.ts), then recent
    // NEVO foods, which carry your usual portion but aren't in the library.
    const mine = searchMyFoods(myFoods, q).filter((food) => !favoriteKeys.has(nameKey(food.name)));
    const mineKeys = new Set(mine.map((food) => nameKey(food.name)));
    const recent = recentFoods.filter(
      (food) =>
        food.nevo?.length && !mineKeys.has(nameKey(food.name)) && matchScore(food.name, q) !== null,
    );
    return [...favorites, ...mine, ...recent];
  }, [q, favoriteFoods, myFoods, favoriteKeys, recentFoods]);
  const libraryKeys = useMemo(() => new Set(myFoods.map(myFoodKey)), [myFoods]);
  const nevoMatches = useMemo(
    () => (q && nevoFoods ? searchNevoFoods(nevoFoods, q, language) : []),
    [q, nevoFoods, language],
  );

  /** The "+" on a favourite/recent row: logs it straight away with its usual
   *  portion (or, in the meal builder, adds it as an ingredient). */
  const quickAdd = (row: ListFood) => {
    haptic([20, 30]);
    const food: MealIngredient = {
      name: row.name,
      grams: row.grams,
      per100: row.per100,
      ...(row.nevo ? { nevo: row.nevo } : {}),
    };
    if (!food.nevo?.length) remember(food, row.barcode);
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
        ...(food.nevo ? { nevo: food.nevo } : {}),
      });
    }
    close();
  };

  const startManual = () => {
    haptic(15);
    // From a search with no match, the typed words become the name.
    setName(query.trim());
    setNevoSource(null);
    setPer100(emptyPer100);
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setBarcode(null);
    setStep("review");
  };

  const startFromRecent = (entry: ListFood) => {
    haptic(15);
    setName(entry.name);
    setGrams(String(entry.grams));
    setGramsTouched(true);
    setPer100(per100ToDraft(entry.per100));
    setUnmatched(new Set());
    setSuggestedGrams(null);
    setNevoSource(entry.nevo ? { codes: entry.nevo, per100: entry.per100 } : null);
    setBarcode(entry.barcode ?? null);
    setQuery("");
    setStep("review");
  };

  /** A NEVO food: its values per 100 g, and the grams left for you to fill
   *  in (NEVO has no portion weights, so none is guessed). */
  const startFromNevo = (food: NevoFood) => {
    haptic(15);
    setName(nevoName(food, language));
    setGrams("");
    setGramsTouched(false);
    setPer100(per100ToDraft(food.per100));
    setUnmatched(food.saltKnown ? new Set() : new Set<MacroKey>(["salt"]));
    setSuggestedGrams(null);
    setNevoSource({ codes: [food.code], per100: food.per100 });
    setBarcode(null);
    setQuery("");
    setStep("review");
  };

  /** One scanner for both paths — see FoodScanner. */
  const startScan = () => {
    haptic(15);
    setScanError(null);
    unknownBarcode.current = null;
    setScannerStatus("scanning");
    setScannerOpen(true);
  };

  const choosePhoto = () => {
    setScannerOpen(false);
    fileInputRef.current?.click();
  };

  /** Fills the review form from a label scan or a barcode lookup — both
   *  return the same shape, so one path applies either result. */
  const applyScanResult = (result: ScannedLabel, scannedBarcode: string | null) => {
    const missing = new Set<MacroKey>();
    const next: Record<MacroKey, string> = { ...emptyPer100 };
    for (const { key } of MACRO_FIELDS) {
      const v = result[key];
      if (v === null) missing.add(key);
      else next[key] = String(v);
    }
    setPer100(next);
    setUnmatched(missing);
    setNevoSource(null);
    setBarcode(scannedBarcode);
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
      applyScanResult(result, unknownBarcode.current);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setScanError(t.addFood.scanReadError(detail));
      setStep("start");
    }
  };

  // The camera stays open during the lookup: if the product isn't in the
  // database the user is already pointing at the package, so the next step
  // is one shutter tap on its label rather than starting over.
  const onBarcodeDetected = async (code: string) => {
    // A product you've saved before: your own values, instantly and
    // offline, corrections included. Open Food Facts only for new ones.
    const saved = findByBarcode(myFoods, code);
    if (saved) {
      setScannerOpen(false);
      startFromRecent(saved);
      return;
    }
    setScannerStatus("lookingUp");
    try {
      const result = await lookupBarcode(code);
      if (!result) {
        unknownBarcode.current = code;
        setScannerStatus("notFound");
        return;
      }
      setScannerOpen(false);
      applyScanResult(result, code);
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

  /** NEVO codes to keep on the entry: only while the values are NEVO's. */
  const currentNevo = (): number[] | undefined =>
    nevoSource && matchesNevo(draftPer100(), nevoSource.per100) ? nevoSource.codes : undefined;

  /** Keeps a food in "your foods" — not a servings entry of a recipe
   *  (logRecipe names it after the recipe), which isn't a food. */
  const remember = (food: MealIngredient, foodBarcode?: string) => {
    if (recipes.some((r) => nameKey(r.name) === nameKey(food.name))) return;
    rememberFood(food, foodBarcode);
  };

  const persistEdits = () => {
    if (!canSave) return false;
    const per100Value = draftPer100();
    const nevo = currentNevo();
    // Unedited NEVO values stay NEVO's: the NEVO search already finds them.
    if (!nevo)
      remember({ name: name.trim(), grams: gramsNum, per100: per100Value }, barcode ?? undefined);
    if (onIngredientCaptured) {
      onIngredientCaptured({
        name: name.trim(),
        grams: gramsNum,
        per100: per100Value,
        ...(nevo ? { nevo } : {}),
      });
      return true;
    }
    if (editEntry) {
      updateFoodEntry(editEntry.id, {
        name: name.trim(),
        meal,
        grams: gramsNum,
        per100: per100Value,
        nevo: nevo ?? null,
      });
    } else {
      addFoodEntry({
        id: crypto.randomUUID(),
        name: name.trim(),
        logged_at: new Date().toISOString(),
        meal,
        grams: gramsNum,
        per100: per100Value,
        ...(nevo ? { nevo } : {}),
      });
    }
    return true;
  };

  const save = () => {
    if (!persistEdits()) return;
    haptic([20, 30]);
    // Not close(): that saves the open form too (for Done), which logged
    // every "Add to log" twice.
    reset();
    onClose();
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
            <label className="flex items-center gap-2 rounded-2xl bg-muted pl-4 pr-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.addFood.searchFoods}
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 w-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t.addFood.clearSearch}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </label>
            {searching ? (
              <div className="space-y-4">
                {savedMatches.length ? (
                  <FoodList
                    title={t.addFood.yourFoods}
                    foods={savedMatches}
                    favoriteKeys={favoriteKeys}
                    onOpen={startFromRecent}
                    onQuickAdd={quickAdd}
                    onToggleFavorite={toggleFavoriteFood}
                    removable={(food) =>
                      !favoriteKeys.has(nameKey(food.name)) && libraryKeys.has(myFoodKey(food))
                    }
                    editing={editingMine}
                    onToggleEdit={() => setEditingMine((v) => !v)}
                    onRemove={(food) => {
                      haptic(15);
                      forgetFood(myFoodKey(food));
                    }}
                  />
                ) : null}
                {nevoMatches.length ? (
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                      {t.addFood.foods}
                    </p>
                    <div className="glass divide-y divide-border overflow-hidden rounded-2xl">
                      {nevoMatches.map(({ food, synonym }) => (
                        <button
                          key={food.code}
                          onClick={() => startFromNevo(food)}
                          className="block w-full px-4 py-2.5 text-left active:bg-foreground/5"
                        >
                          <p className="text-[15px] font-semibold leading-snug">
                            {nevoName(food, language)}
                          </p>
                          <p className="tabular text-[12px] text-muted-foreground">
                            {synonym ? `${synonym} · ` : ""}
                            {t.addFood.per100kcal(food.per100.calories)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!savedMatches.length && !nevoMatches.length ? (
                  <p className="px-1 text-[14px] text-muted-foreground">{t.addFood.noFoodMatch}</p>
                ) : null}
                <button
                  onClick={startManual}
                  className="glass flex min-h-[52px] w-full items-center gap-2 rounded-2xl px-4 text-left active:scale-[0.985]"
                >
                  <Keyboard className="size-5 shrink-0 text-primary-text" />
                  <span className="min-w-0 truncate text-[14px] font-bold">
                    {t.addFood.enterAsNew(q)}
                  </span>
                </button>
                {nevoMatches.length ? (
                  <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                    {t.nutrition.nevoReference}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                {/* Scan and manual side by side, first: they used to sit under
                every list, a long scroll down once meals and recipes moved
                into this sheet. */}
                <div className="grid grid-cols-[1.7fr_1fr] gap-2">
                  <button
                    onClick={startScan}
                    className="glow flex min-h-[60px] items-center gap-2.5 rounded-2xl bg-primary px-4 text-left text-primary-foreground active:scale-[0.985]"
                  >
                    <ScanBarcode className="size-6 shrink-0" />
                    <span className="text-[14.5px] font-bold leading-tight">
                      {t.addFood.scanFood}
                    </span>
                  </button>
                  <button
                    onClick={startManual}
                    className="glass flex min-h-[60px] items-center gap-2 rounded-2xl px-3 text-left active:scale-[0.985]"
                  >
                    <Keyboard className="size-5 shrink-0 text-primary-text" />
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
              </>
            )}
          </div>
        ) : null}

        {step === "scanning" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <DumbbellLoader size={56} className="text-primary-text" />
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
                {(nevoSource ? t.addFood.notInNevo : t.addFood.couldntRead)(
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
                    const nevo = currentNevo();
                    toggleFavoriteFood({
                      name,
                      grams: gramsNum || 100,
                      per100: draftPer100(),
                      ...(nevo ? { nevo } : {}),
                    });
                  }}
                  aria-pressed={favoriteKeys.has(foodKey(name))}
                  aria-label={
                    favoriteKeys.has(foodKey(name))
                      ? t.addFood.unfavorite(name)
                      : t.addFood.favorite(name)
                  }
                  className="flex size-11 shrink-0 rounded-2xl bg-muted items-center justify-center text-primary-text active:scale-90"
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
                <span className="text-[14px] font-semibold text-primary-text">
                  {t.addFood.useServingSize(suggestedGrams)}
                </span>
                <Check className="size-4 shrink-0 text-primary-text" />
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
                autoFocus={nevoSource !== null && grams === ""}
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
              {/* RIVM's conditions: say the values are NEVO's, and mark the
                  app's own addition (salt from sodium) as one. */}
              {currentNevo() ? (
                <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
                  {t.addFood.nevoSaltNote} {t.nutrition.nevoReference}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
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

/** Favourite, recent or search-result foods. With `onRemove`, an "Edit"
 *  toggle swaps the "+" of each `removable` row for a remove button. */
function FoodList({
  title,
  foods,
  favoriteKeys,
  onOpen,
  onQuickAdd,
  onToggleFavorite,
  removable,
  editing = false,
  onToggleEdit,
  onRemove,
}: {
  title: string;
  foods: ListFood[];
  favoriteKeys: Set<string>;
  onOpen: (food: ListFood) => void;
  onQuickAdd: (food: ListFood) => void;
  onToggleFavorite: (food: MealIngredient) => void;
  removable?: (food: ListFood) => boolean;
  editing?: boolean;
  onToggleEdit?: () => void;
  onRemove?: (food: ListFood) => void;
}) {
  const t = useTranslation();
  const canEdit = !!onRemove && !!removable && foods.some(removable);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-muted-foreground">{title}</p>
        {canEdit ? (
          <button
            onClick={onToggleEdit}
            className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-muted-foreground"
          >
            {editing ? t.common.done : t.common.edit}
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        {foods.map((food) => {
          const m = scaledMacros(food);
          const starred = favoriteKeys.has(food.name.trim().toLowerCase());
          const removing = editing && canEdit && removable!(food);
          return (
            <div
              key={myFoodKey(food)}
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
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-primary-text active:scale-90"
              >
                <Star className="size-4" fill={starred ? "currentColor" : "none"} />
              </button>
              {removing ? (
                <button
                  onClick={() => onRemove!(food)}
                  aria-label={t.addFood.forgetFood(food.name)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive active:scale-90"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : (
                <button
                  onClick={() => onQuickAdd(food)}
                  aria-label={t.addFood.quickAdd(food.name, food.grams)}
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-90"
                >
                  <HapticSwitch />
                  <Plus className="size-5" />
                </button>
              )}
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
