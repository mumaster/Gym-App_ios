import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CookingPot,
  History,
  Keyboard,
  Leaf,
  Pencil,
  Mic,
  Plus,
  ScanBarcode,
  ScanLine,
  Search,
  Star,
  StarOff,
  Trash2,
  UserRound,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { FoodScanner, type FoodScannerStatus, type ScanMode } from "./FoodScanner";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { HapticSwitch } from "./HapticSwitch";
import { PortionLine } from "./MealOverviewSheet";
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
import { useTapFocus } from "../../lib/gym/tapFocus";
import { haptic, useGym } from "../../lib/gym/store";
import { badge, chip } from "./ui";

type Step = "start" | "scanning" | "review";

/** A note or plate already photographed, for the list reader to read. */
export interface ListPhoto {
  source: "note" | "plate";
  file: File;
}

/** What Add food hands the list reader (FoodListSheet). */
export type ReadListRequest = { meal: MealType } & (
  { start: "text" } | ({ start: "photo" } & ListPhoto)
);
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
  swap,
  onReadList,
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
  /** Swapping a food on a list (FoodListSheet, a recipe's ingredients): the
   *  search starts from what was written, and the grams already there stay
   *  as they are, whichever food is picked (asked for: a wrong match is
   *  changed without losing the weighed amount). With `grams` null the
   *  picked food brings its own. Needs `onIngredientCaptured`. */
  swap?: { query: string; grams: number | null } | undefined;
  /** Open the list reader (FoodListSheet) on typed text, or on a note or
   *  plate photographed with the scanner's other modes, for the meal picked
   *  here. The parent closes this sheet first, like the builders. */
  onReadList?: (request: ReadListRequest) => void;
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
  /** Grams that a swap keeps, whatever food is picked. */
  const swapGrams = swap?.grams ?? null;

  const [step, setStep] = useState<Step>("start");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<FoodScannerStatus>("scanning");
  const [scanMode, setScanMode] = useState<ScanMode>("label");
  /** The mode a picked photo (the scanner's photo button) belongs to. */
  const photoMode = useRef<ScanMode>("label");
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
  /** Set once the search field is focused: the sheet then fills the screen
   *  above the keyboard until it closes, so it doesn't resize as results
   *  come and go (and doesn't shrink back the moment the keyboard hides). */
  const [searchMode, setSearchMode] = useState(false);
  const searchTap = useTapFocus(() => setSearchMode(true));
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
  /** Edit mode of the Favourites card: its rows' "+" becomes unfavourite. */
  const [editingFavs, setEditingFavs] = useState(false);

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

  // A swap starts searching from what was written.
  useEffect(() => {
    if (open && swap) setQuery(swap.query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, swap?.query]);

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
    setSearchMode(false);
    setNevoSource(null);
    setBarcode(null);
    unknownBarcode.current = null;
    setEditingMine(false);
    setEditingFavs(false);
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
      grams: swapGrams ?? row.grams,
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
    if (swapGrams != null) setGrams(String(swapGrams));
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
    setGrams(String(swapGrams ?? entry.grams));
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
    setGrams(swapGrams != null ? String(swapGrams) : "");
    setGramsTouched(swapGrams != null);
    setPer100(per100ToDraft(food.per100));
    setUnmatched(food.saltKnown ? new Set() : new Set<MacroKey>(["salt"]));
    setSuggestedGrams(null);
    setNevoSource({ codes: [food.code], per100: food.per100 });
    setBarcode(null);
    setQuery("");
    setStep("review");
  };

  /** One scanner for every kind of photo — see FoodScanner. It opens on
   *  Barcode, the quickest and most exact; label, note and plate are a
   *  switch away. */
  const startScan = () => {
    haptic(15);
    setScanError(null);
    unknownBarcode.current = null;
    setScannerStatus("scanning");
    setScanMode("barcode");
    setScannerOpen(true);
  };

  const choosePhoto = (mode: ScanMode) => {
    photoMode.current = mode;
    setScannerOpen(false);
    fileInputRef.current?.click();
  };

  /** A note or a plate goes to the list reader, for the meal picked here. */
  const readPhoto = (source: "note" | "plate", file: File) => {
    if (!onReadList) return;
    openBuilder(() => onReadList({ start: "photo", source, file, meal }));
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
    if (swapGrams != null) setGrams(String(swapGrams));
    setSuggestedGrams(!gramsTouched && swapGrams == null ? result.servingSizeGrams : null);
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
  // database the user is already pointing at the package, so it switches to
  // Label and the next step is one shutter tap rather than starting over.
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
        setScanMode("label");
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

  const onPhotoCaptured = (photo: Blob, mode: ScanMode) => {
    setScannerOpen(false);
    const file = new File([photo], `${mode}.jpg`, { type: photo.type || "image/jpeg" });
    if (mode === "note" || mode === "plate") readPhoto(mode, file);
    else void onFileSelected(file);
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
  /** Notes, plates and typed lists log foods, so they're only offered when
   *  this sheet logs (not while capturing an ingredient or swapping). */
  const listModes = !!onReadList && showSaved;

  // Pinned under the title, outside the scrolling list, so the field stays
  // at the top of the screen while results change under it.
  const searchField = (
    <label className="flex items-center gap-2 rounded-2xl bg-muted pl-4 pr-1.5">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // A tap focuses the field itself (no iOS scroll-and-bounce) and
        // starts going full height in the same tap; onFocus covers a
        // keyboard or other focus.
        {...searchTap}
        onFocus={() => setSearchMode(true)}
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
  );

  /** Scan from the search results: a product the search doesn't know. */
  const scanButton = (
    <button
      onClick={startScan}
      className="glass flex min-h-[52px] w-full items-center gap-2 rounded-2xl px-4 text-left active:scale-[0.985]"
    >
      <ScanBarcode className="size-5 shrink-0 text-primary-text" />
      <span className="min-w-0 truncate text-[14px] font-bold">{t.addFood.scanFood}</span>
    </button>
  );

  return (
    <>
      <BottomSheet
        open={open}
        onClose={close}
        title={
          swap
            ? t.addFood.swapFood
            : onIngredientCaptured
              ? t.addFood.addIngredient
              : editEntry
                ? t.addFood.editFood
                : t.addFood.addFood
        }
        toolbar={step === "start" ? searchField : undefined}
        fullHeight={step === "start" && searchMode}
        tall={step === "review"}
        scrollKey={q}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const mode = photoMode.current;
            photoMode.current = "label";
            if (mode === "note" || mode === "plate") readPhoto(mode, file);
            else void onFileSelected(file);
          }}
        />

        {step === "start" ? (
          <div className="space-y-4">
            {scanError ? (
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {scanError}
              </p>
            ) : null}
            {/* While searching, the meal moves under the results so they
                start right below the search field, above the keyboard. */}
            {onIngredientCaptured || searching ? null : (
              <MealPicker label={t.addFood.addingTo} meal={meal} onPick={setMeal} />
            )}
            {searching ? (
              <div className="space-y-4">
                {/* Swapping starts with the written name searched, which
                    used to hide the scan button: a packaged replacement is
                    often quickest from its label (asked for). */}
                {swap ? scanButton : null}
                {savedMatches.length ? (
                  <FoodList
                    icon={UserRound}
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
                  <ListCard
                    icon={Leaf}
                    title={t.addFood.foods}
                    subtitle={t.mealOverview.foods(nevoMatches.length)}
                    filled
                  >
                    <div className="divide-y divide-border border-t border-border">
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
                  </ListCard>
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
                {swap ? null : scanButton}
                {onIngredientCaptured ? null : (
                  <MealPicker label={t.addFood.addingTo} meal={meal} onPick={setMeal} />
                )}
                {nevoMatches.length ? (
                  <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                    {t.nutrition.nevoReference}
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                {/* One way in per kind of input (asked for: two scan buttons,
                    one opening the camera and one a new screen, read as a
                    jumble). Scan opens the camera, which reads a barcode or
                    label, a note or a plate; the two quieter buttons are
                    for typing. */}
                <div className="space-y-2">
                  <button
                    onClick={startScan}
                    className="glow flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-primary px-4 py-2.5 text-left text-primary-foreground active:scale-[0.985]"
                  >
                    <ScanLine className="size-6 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold leading-tight">
                        {listModes ? t.addFood.scan : t.addFood.scanFood}
                      </span>
                      {listModes ? (
                        <span className="block truncate text-[13px] leading-snug opacity-85">
                          {t.addFood.scanDesc}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {/* The quieter ways in, as one grouped list: full-width
                      rows keep each label on one line in Dutch too. */}
                  <div className="glass divide-y divide-border overflow-hidden rounded-2xl">
                    {(listModes
                      ? ([
                          [
                            Mic,
                            t.addFood.typeOrSpeak,
                            () => openBuilder(() => onReadList?.({ start: "text", meal })),
                          ],
                          [Keyboard, t.addFood.enterManually, startManual],
                        ] as const)
                      : ([[Keyboard, t.addFood.enterManually, startManual]] as const)
                    ).map(([Icon, label, onClick]) => (
                      <button
                        key={label}
                        onClick={onClick}
                        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left active:bg-foreground/5"
                      >
                        <Icon className="size-5 shrink-0 text-primary-text" />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                          {label}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
                {favoriteFoods.length ? (
                  <FoodList
                    icon={Star}
                    title={t.addFood.favorites}
                    foods={favoriteFoods}
                    favoriteKeys={favoriteKeys}
                    onOpen={startFromRecent}
                    onQuickAdd={quickAdd}
                    onToggleFavorite={toggleFavoriteFood}
                    favorites
                    editing={editingFavs}
                    onToggleEdit={() => setEditingFavs((v) => !v)}
                  />
                ) : null}
                {recentFoods.length ? (
                  <FoodList
                    icon={History}
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
                    icon={UtensilsCrossed}
                    title={t.nutrition.meals}
                    count={t.addFood.savedMeals}
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
                    icon={CookingPot}
                    title={t.nutrition.recipes}
                    count={t.addFood.savedRecipes}
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
          <div className="space-y-2">
            {unmatched.size > 0 ? (
              <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-2 text-[13px] leading-snug text-warning-text">
                <AlertTriangle className="mt-px size-4 shrink-0" />{" "}
                {(nevoSource ? t.addFood.notInNevo : t.addFood.couldntRead)(
                  [...unmatched]
                    .map((k) => MACRO_FIELDS.find((f) => f.key === k)!.label)
                    .join(", "),
                )}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-muted px-4 py-1">
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
              <MealPicker label={t.addFood.meal} meal={meal} onPick={setMeal} compact />
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
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 text-left active:scale-[0.985]"
              >
                <span className="text-[14px] font-semibold text-primary-text">
                  {t.addFood.useServingSize(suggestedGrams)}
                </span>
                <Check className="size-4 shrink-0 text-primary-text" />
              </button>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-1">
              <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
                {onIngredientCaptured ? t.addFood.gramsInMeal : t.addFood.gramsEaten}
              </span>
              <input
                inputMode="decimal"
                type="text"
                value={grams}
                readOnly={swapGrams != null}
                autoFocus={nevoSource !== null && grams === ""}
                onFocus={swapGrams != null ? undefined : selectOnFocus}
                onChange={(e) => {
                  if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                  setGrams(e.target.value);
                  setGramsTouched(true);
                }}
                className="tabular h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[17px] font-bold text-foreground outline-none"
              />
            </label>
            {swapGrams != null ? (
              <p className="px-1 text-[12px] leading-snug text-muted-foreground">
                {t.addFood.swapKeepsGrams}
              </p>
            ) : null}

            {/* What this portion adds up to, right under the grams that set
                it and above the per-100 g values it's worked out from. */}
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
                {onIngredientCaptured ? t.addFood.thisIngredient : t.addFood.thisPortion}
              </p>
              <p className="tabular mt-0.5 text-[15px] font-semibold leading-snug">
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

            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-muted-foreground">
                {t.addFood.per100g}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MACRO_FIELDS.map(({ key, label, unit }) => (
                  <label
                    key={key}
                    className={`flex flex-col rounded-2xl px-3.5 py-1.5 ${
                      unmatched.has(key) ? "bg-warning/10" : "bg-muted"
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
                        className="tabular h-6 w-full min-w-0 bg-transparent text-[17px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <span className="shrink-0 text-[12px] text-muted-foreground">{unit}</span>
                    </div>
                  </label>
                ))}
              </div>
              {/* RIVM's conditions: say the values are NEVO's, and mark the
                  app's own addition (salt from sodium) as one. */}
              {currentNevo() ? (
                <p className="mt-1.5 px-1 text-[11px] leading-snug text-muted-foreground">
                  {t.addFood.nevoSaltNote} {t.nutrition.nevoReference}
                </p>
              ) : null}
            </div>

            {/* Editing an existing entry already saves on Done/backdrop close
              (see `close` above) — a separate button here would just be a
              second, redundant way to do the same thing. New entries keep
              an explicit button too, as the primary/expected action, even
              though Done now saves them as well. */}
            {editEntry && !onIngredientCaptured ? (
              <button
                onClick={deleteEntry}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[15px] font-semibold text-destructive-text active:scale-[0.985]"
              >
                <Trash2 className="size-4" /> {t.addFood.deleteFromLog}
              </button>
            ) : (
              <button
                onClick={save}
                disabled={!canSave}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
              >
                <Check className="size-5" />{" "}
                {swap
                  ? t.addFood.useThisFood
                  : onIngredientCaptured
                    ? t.addFood.addIngredient
                    : t.addFood.addToLog}
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
        modes={listModes ? ["barcode", "label", "note", "plate"] : ["barcode", "label"]}
        mode={scanMode}
        onMode={(m) => {
          setScanMode(m);
          // Back to Barcode after a miss: look for the next one.
          if (m === "barcode") setScannerStatus("scanning");
        }}
      />
    </>
  );
}

/** One of Add food's lists as a card, built like a meal's card on the Food
 *  tab: a tinted header band (`card-head`) with a badge, the title and a
 *  count, and the rows under it divided by hairlines. The badge is tonal
 *  (`badge.tonal`) once the list has something in it and muted while it's
 *  empty, not solid like a meal's: Scan is this screen's one solid accent,
 *  and up to four solid circles under it competed with it (asked for).
 *  Favourites and Recent only show when they have items, so a solid fill
 *  wouldn't say anything there anyway. */
function ListCard({
  icon: Icon,
  title,
  subtitle,
  filled,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  filled: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="card-head flex min-h-[56px] items-center gap-3 px-4 py-2">
        <span aria-hidden className={`${filled ? badge.tonal : badge.off} size-9`}>
          <Icon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold leading-tight">{title}</span>
          {/* Not text-muted-foreground: on a card inside a sheet the band
              sits on a lighter surface, and muted grey measured 4.43:1. */}
          <span className="tabular mt-0.5 block truncate text-[12.5px] text-foreground/75">
            {subtitle}
          </span>
        </span>
        {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Edit/Done in a list card's header band: a round icon button, like the
 *  meal card's save button, so a long title ("Maaltijden") keeps its room
 *  next to "New". */
function EditToggle({
  editing,
  onToggle,
}: {
  editing: boolean;
  onToggle?: (() => void) | undefined;
}) {
  const t = useTranslation();
  return (
    <button
      onClick={onToggle}
      aria-pressed={editing}
      aria-label={editing ? t.common.done : t.common.edit}
      className="tap-target flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90"
    >
      {editing ? <Check className="size-4" /> : <Pencil className="size-3.5" />}
    </button>
  );
}

/** Favourite, recent or search-result foods. With `onRemove`, an "Edit"
 *  toggle swaps the "+" of each `removable` row for a remove button. */
function FoodList({
  icon,
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
  favorites = false,
}: {
  icon: LucideIcon;
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
  /** The Favourites card: every row would show a filled star, so there's no
   *  star column (the name gets the room); a favourite is removed in edit
   *  mode instead, where its "+" becomes an unfavourite button. */
  favorites?: boolean;
}) {
  const t = useTranslation();
  const canEdit = favorites ? foods.length > 0 : !!onRemove && !!removable && foods.some(removable);
  return (
    <ListCard
      icon={icon}
      title={title}
      subtitle={t.mealOverview.foods(foods.length)}
      filled={foods.length > 0}
      actions={canEdit ? <EditToggle editing={editing} onToggle={onToggleEdit} /> : null}
    >
      {foods.map((food) => {
        const m = scaledMacros(food);
        const starred = favoriteKeys.has(food.name.trim().toLowerCase());
        const removing = editing && canEdit && (favorites || removable!(food));
        return (
          <div
            key={myFoodKey(food)}
            className="flex items-center gap-1 border-t border-border py-1 pl-4 pr-1.5"
          >
            <button
              onClick={() => onOpen(food)}
              className="min-w-0 flex-1 py-1.5 text-left active:opacity-70"
            >
              <span className="block truncate text-[15px] font-semibold">{food.name}</span>
              <PortionLine
                grams={food.grams}
                macros={m}
                kcal={m.calories}
                className="text-[12.5px]"
              />
            </button>
            {favorites ? null : (
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
            )}
            {removing && favorites ? (
              <button
                onClick={() => {
                  haptic(10);
                  onToggleFavorite(food);
                }}
                aria-label={t.addFood.unfavorite(food.name)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground active:scale-90"
              >
                <StarOff className="size-4" />
              </button>
            ) : removing ? (
              <button
                onClick={() => onRemove!(food)}
                aria-label={t.addFood.forgetFood(food.name)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive-text active:scale-90"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => onQuickAdd(food)}
                aria-label={t.addFood.quickAdd(food.name, food.grams)}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-primary/60 text-primary-text active:scale-90 active:bg-primary/10"
              >
                <HapticSwitch />
                <Plus className="size-5" />
              </button>
            )}
          </div>
        );
      })}
    </ListCard>
  );
}

export function MealPicker({
  label,
  meal,
  onPick,
  compact = false,
}: {
  label: string;
  meal: MealType;
  onPick: (meal: MealType) => void;
  /** Tighter, for the review form that has to fit on one screen. */
  compact?: boolean;
}) {
  const t = useTranslation();
  return (
    <div>
      <p
        className={`${compact ? "mb-1.5" : "mb-2"} text-[13px] font-semibold text-muted-foreground`}
      >
        {label}
      </p>
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
            className={`${compact ? "min-h-[36px]" : "min-h-[40px]"} tap-target flex-auto whitespace-nowrap rounded-2xl px-2.5 text-[13.5px] font-semibold ${
              meal === m ? chip.on : "bg-muted text-secondary-foreground"
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
  icon,
  title,
  count,
  empty,
  newLabel,
  items,
  editing,
  onToggleEdit,
  onNew,
  onLog,
  onDelete,
}: {
  icon: LucideIcon;
  title: string;
  /** "2 meals" in the header band. */
  count: (n: number) => string;
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
    <ListCard
      icon={icon}
      title={title}
      subtitle={items.length ? count(items.length) : t.nutrition.nothingInMeal}
      filled={items.length > 0}
      actions={
        <>
          {items.length ? <EditToggle editing={editing} onToggle={onToggleEdit} /> : null}
          {/* Says "New", not just "+": in a header band "+" means "add to
              the log" (a meal's card), and this one makes a new meal. */}
          <button
            onClick={onNew}
            aria-label={newLabel}
            className="tap-target flex items-center gap-1 rounded-full bg-primary/25 px-2.5 py-1 text-[13px] font-semibold text-foreground active:scale-95"
          >
            <Plus className="size-3.5" /> {t.addFood.newShort}
          </button>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="border-t border-border px-4 py-3 text-[12.5px] leading-snug text-muted-foreground">
          {empty}
        </p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1 border-t border-border py-1 pl-4 pr-1.5"
          >
            <div className="min-w-0 flex-1 py-1.5">
              <p className="truncate text-[15px] font-semibold">{item.name}</p>
              <p className="tabular mt-0.5 truncate text-[12.5px] text-muted-foreground">
                {item.detail}
              </p>
            </div>
            {editing ? (
              <button
                onClick={() => onDelete(item.id)}
                aria-label={t.addFood.deleteMeal(item.name)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive-text active:scale-90"
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <button
                onClick={() => onLog(item.id)}
                aria-label={item.logLabel}
                className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-primary/60 text-primary-text active:scale-90 active:bg-primary/10"
              >
                <HapticSwitch />
                <Plus className="size-5" />
              </button>
            )}
          </div>
        ))
      )}
    </ListCard>
  );
}
