import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Camera, Mic, NotebookPen, Plus, X } from "lucide-react";
import { AddFoodSheet, MealPicker, type ListPhoto } from "./AddFoodSheet";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { FoodScanner, type ScanMode } from "./FoodScanner";
import { button, text } from "./ui";
import {
  completeLines,
  linesFromResult,
  type FoodListLine,
  type FoodListSource,
  type ListFood,
} from "../../lib/gym/foodList";
import { readFoodList } from "../../lib/gym/foodListScan";
import { useTranslation } from "../../lib/gym/i18n";
import { fileToBase64 } from "../../lib/gym/imageUpload";
import { nameKey } from "../../lib/gym/myFoods";
import { loadNevoFoods, nevoName } from "../../lib/gym/nevoFoods";
import {
  mealForTime,
  scaledMacros,
  type MealIngredient,
  type MealType,
} from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";

type Step = "pick" | "text" | "reading" | "review";

/** Handwriting and small print stay legible at this size; still a small upload. */
const PHOTO_LIMIT = { maxWidth: 1600, maxHeight: 1600 };

/**
 * Reads a list of foods with Gemini (foodListScan.ts) from a written note or
 * recipe, a photo of a plate, or typed/spoken words, and shows it as lines to
 * check before anything is logged or saved. Each line keeps what was read,
 * its grams and its food apart: the swap button changes only the food, so a
 * wrong match never loses the weighed amount (asked for). Values come from
 * the matched NEVO food or your own food, never from Gemini.
 */
export function FoodListSheet({
  open,
  onClose,
  start,
  photo,
  target,
  initialMeal,
  onIngredients,
  onSaveAsRecipe,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens on the photo choices or straight on the text field. */
  start: "photo" | "text";
  /** A note or plate already photographed in Add food's scanner: read
   *  straight away, so the camera leads directly to the check screen. */
  photo?: ListPhoto | null | undefined;
  /** "log": log the foods to a meal (or hand them to a new recipe).
   *  "ingredients": hand them back to a recipe being built. */
  target: "log" | "ingredients";
  initialMeal?: MealType | undefined;
  onIngredients?: (ingredients: MealIngredient[]) => void;
  onSaveAsRecipe?: (
    ingredients: MealIngredient[],
    meta: { title: string | null; servings: number | null },
  ) => void;
}) {
  const t = useTranslation();
  const { favoriteFoods, myFoods, addFoodEntry, language } = useGym();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [source, setSource] = useState<FoodListSource>("note");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<FoodListLine[]>([]);
  const [meta, setMeta] = useState<{ title: string | null; servings: number | null }>({
    title: null,
    servings: null,
  });
  const [meal, setMeal] = useState<MealType>(
    () => initialMeal ?? mealForTime(new Date().toISOString()),
  );
  /** The camera, open in this mode (the same scanner Add food uses). */
  const [scanner, setScanner] = useState<"note" | "plate" | null>(null);
  /** The line whose food is being swapped; -1 adds a new line. */
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const current: Step = step ?? (start === "text" ? "text" : "pick");

  // The meal it was opened for (a meal's "+"), else the time of day's.
  useEffect(() => {
    if (open) setMeal(initialMeal ?? mealForTime(new Date().toISOString()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Your favourites and saved foods, sent to Gemini by index ("o:<i>"),
   *  so a line can match a product you scanned before. */
  const own = useMemo(() => {
    const seen = new Set<string>();
    const out: ListFood[] = [];
    for (const f of [...favoriteFoods, ...myFoods]) {
      const key = nameKey(f.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: f.name,
        per100: f.per100,
        ...("nevo" in f && f.nevo ? { nevo: f.nevo } : {}),
      });
    }
    return out.slice(0, 200);
  }, [favoriteFoods, myFoods]);

  const reset = () => {
    setStep(null);
    setTyped("");
    setError(null);
    setLines([]);
    setMeta({ title: null, servings: null });
    setMeal(initialMeal ?? mealForTime(new Date().toISOString()));
    setSwapIndex(null);
  };

  const ready = completeLines(lines, (s) => parseDecimal(s) || 0);
  const incomplete = lines.length - ready.length;
  const totalKcal = ready.reduce((sum, ing) => sum + scaledMacros(ing).calories, 0);

  const logAll = () => {
    const logged_at = new Date().toISOString();
    for (const ing of ready) {
      addFoodEntry({
        id: crypto.randomUUID(),
        name: ing.name,
        logged_at,
        meal,
        grams: ing.grams,
        per100: ing.per100,
        ...(ing.nevo ? { nevo: ing.nevo } : {}),
      });
    }
  };

  const finish = () => {
    if (!ready.length || incomplete) return;
    haptic([20, 30]);
    if (target === "log") logAll();
    else onIngredients?.(ready);
    reset();
    onClose();
  };

  // Done saves like the main button when every line is ready (the app's
  // save-on-Done rule); a half-checked list is let go rather than logged
  // in part.
  const close = () => {
    if (current === "review" && ready.length && !incomplete) {
      if (target === "log") logAll();
      else onIngredients?.(ready);
    }
    reset();
    onClose();
  };

  const read = async (src: FoodListSource, payload: { file?: File; text?: string }) => {
    setSource(src);
    setError(null);
    setStep("reading");
    try {
      const image = payload.file ? await fileToBase64(payload.file, PHOTO_LIMIT) : null;
      const [result, nevo] = await Promise.all([
        readFoodList({
          data: {
            source: src,
            own: own.map((f) => f.name),
            language,
            ...(image ? { imageBase64: image.base64, mimeType: image.mimeType } : {}),
            ...(payload.text ? { text: payload.text } : {}),
          },
        }),
        loadNevoFoods(),
      ]);
      const byCode = new Map(nevo.map((f) => [f.code, f]));
      const next = linesFromResult(
        result.items,
        (code) => {
          const f = byCode.get(code);
          return f ? { name: nevoName(f, language), per100: f.per100, nevo: [f.code] } : null;
        },
        own,
        () => crypto.randomUUID(),
      );
      if (!next.length) {
        setError(t.foodList.nothingFound);
        setStep(src === "text" ? "text" : "pick");
        return;
      }
      haptic([15, 25]);
      setLines(next);
      setMeta({ title: result.title, servings: result.servings });
      setStep("review");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setError(/\(429\)/.test(detail) ? t.foodList.limitError : t.foodList.readError(detail));
      setStep(src === "text" ? "text" : "pick");
    }
  };

  const pickPhoto = (src: "note" | "plate") => {
    haptic(15);
    setError(null);
    setScanner(src);
  };

  // A photo taken in Add food's scanner is read as soon as the sheet opens.
  useEffect(() => {
    if (open && photo) void read(photo.source, { file: photo.file });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, photo]);

  const setLine = (i: number, patch: Partial<FoodListLine>) =>
    setLines((cur) => cur.map((line, j) => (j === i ? { ...line, ...patch } : line)));

  const swapLine = swapIndex != null && swapIndex >= 0 ? lines[swapIndex] : undefined;

  return (
    <>
      <BottomSheet
        open={open && swapIndex === null}
        onClose={close}
        title={t.foodList.title}
        tall={current === "review"}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void read(source, { file });
          }}
        />

        {error && current !== "reading" ? (
          <p className="mb-3 flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        ) : null}

        {current === "pick" ? (
          <div className="space-y-2">
            {(
              [
                ["note", NotebookPen, t.foodList.note, t.foodList.noteDesc],
                ["plate", Camera, t.foodList.plate, t.foodList.plateDesc],
              ] as const
            ).map(([src, Icon, label, desc]) => (
              <button
                key={src}
                onClick={() => pickPhoto(src)}
                className="glass flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.985]"
              >
                <Icon className="size-6 shrink-0 text-primary-text" />
                <span className="min-w-0">
                  <span className={`block ${text.rowTitle}`}>{label}</span>
                  <span className={`block ${text.meta}`}>{desc}</span>
                </span>
              </button>
            ))}
            <button
              onClick={() => {
                haptic(15);
                setError(null);
                setStep("text");
              }}
              className="glass flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.985]"
            >
              <Mic className="size-6 shrink-0 text-primary-text" />
              <span className="min-w-0">
                <span className={`block ${text.rowTitle}`}>{t.foodList.text}</span>
                <span className={`block ${text.meta}`}>{t.foodList.textDesc}</span>
              </span>
            </button>
          </div>
        ) : null}

        {current === "text" ? (
          <div className="space-y-3">
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t.foodList.textPlaceholder}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-2xl bg-muted px-4 py-3 text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground"
            />
            <p className={text.note}>{t.foodList.micHint}</p>
            <button
              onClick={() => void read("text", { text: typed.trim() })}
              disabled={!typed.trim()}
              className={`${button.primary} w-full`}
            >
              {t.foodList.read}
            </button>
          </div>
        ) : null}

        {current === "reading" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <DumbbellLoader size={56} className="text-primary-text" />
            <p className="text-[15px] font-semibold">{t.foodList.reading}</p>
            <p className="text-[13px] text-muted-foreground">{t.foodList.readingDesc}</p>
          </div>
        ) : null}

        {current === "review" ? (
          <div className="space-y-2">
            {lines.map((line, i) => {
              const grams = parseDecimal(line.grams) || 0;
              const m =
                line.food && grams > 0 ? scaledMacros({ grams, per100: line.food.per100 }) : null;
              const label = line.food?.name ?? line.name;
              return (
                <div key={line.id} className="glass rounded-2xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        haptic(12);
                        setSwapIndex(i);
                      }}
                      aria-label={t.foodList.swap(label)}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left active:opacity-70"
                    >
                      <span className="min-w-0 flex-1">
                        {line.food ? (
                          <span className={`line-clamp-2 leading-snug ${text.rowTitle}`}>
                            {line.food.name}
                          </span>
                        ) : (
                          <span className="block truncate text-[15px] font-semibold text-warning-text">
                            {t.foodList.pickFood}
                          </span>
                        )}
                        {line.written ? (
                          <span className={`line-clamp-2 ${text.meta}`}>
                            {t.foodList.written(line.written)}
                          </span>
                        ) : null}
                      </span>
                      <ArrowLeftRight className="size-4 shrink-0 text-primary-text" />
                    </button>
                    <label className="flex h-11 w-[84px] shrink-0 items-center gap-1 rounded-xl bg-muted px-2.5">
                      <input
                        inputMode="decimal"
                        type="text"
                        value={line.grams}
                        onFocus={selectOnFocus}
                        onChange={(e) => {
                          if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                          setLine(i, { grams: e.target.value });
                        }}
                        placeholder="0"
                        aria-label={t.foodList.gramsFor(label)}
                        className="tabular w-full min-w-0 bg-transparent text-right text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <span className="text-[12px] text-muted-foreground">g</span>
                    </label>
                    <button
                      onClick={() => {
                        haptic(12);
                        setLines((cur) => cur.filter((_, j) => j !== i));
                      }}
                      aria-label={t.foodList.remove(label)}
                      className={button.icon}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {m ? (
                    <p className={`tabular ${text.meta}`}>
                      {m.calories} kcal · P {Math.round(m.protein)} · C {Math.round(m.carbs)} · F{" "}
                      {Math.round(m.fat)}
                    </p>
                  ) : line.amount && !(grams > 0) ? (
                    <p className="text-[12.5px] text-warning-text">
                      {t.foodList.amountNoGrams(line.amount)}
                    </p>
                  ) : null}
                </div>
              );
            })}

            <button
              onClick={() => {
                haptic(12);
                setSwapIndex(-1);
              }}
              className={`${button.more} min-h-[44px] w-full text-[14px] font-semibold`}
            >
              <Plus className="size-4" /> {t.foodList.addLine}
            </button>

            {target === "log" ? (
              <div className="pt-2">
                <MealPicker label={t.foodList.logTo} meal={meal} onPick={setMeal} compact />
              </div>
            ) : null}

            {incomplete ? (
              <p className="flex items-start gap-2 px-1 text-[13px] leading-snug text-warning-text">
                <AlertTriangle className="mt-px size-4 shrink-0" />{" "}
                {t.foodList.incomplete(incomplete)}
              </p>
            ) : ready.length ? (
              <p className={`tabular px-1 ${text.meta}`}>{t.foodList.total(totalKcal)}</p>
            ) : null}

            <button
              onClick={finish}
              disabled={!ready.length || incomplete > 0}
              className={`${button.primary} w-full`}
            >
              {target === "log"
                ? t.foodList.log(ready.length)
                : t.foodList.addToRecipe(ready.length)}
            </button>
            {target === "log" && onSaveAsRecipe ? (
              <button
                onClick={() => {
                  if (!ready.length || incomplete) return;
                  haptic(15);
                  const list = ready;
                  const m = meta;
                  reset();
                  onSaveAsRecipe(list, m);
                }}
                disabled={!ready.length || incomplete > 0}
                className={`${button.secondary} w-full`}
              >
                {t.foodList.saveAsRecipe}
              </button>
            ) : null}
            {lines.some((l) => l.food?.nevo) ? (
              <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                {t.nutrition.nevoReference}
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <FoodScanner
        open={scanner !== null}
        status="scanning"
        modes={["note", "plate"]}
        mode={scanner ?? "note"}
        onMode={(m) => setScanner(listMode(m))}
        onClose={() => setScanner(null)}
        onPhoto={(blob, m) => {
          setScanner(null);
          const file = new File([blob], `${m}.jpg`, { type: blob.type || "image/jpeg" });
          void read(listMode(m), { file });
        }}
        onChoosePhoto={(m) => {
          setScanner(null);
          setSource(listMode(m));
          fileRef.current?.click();
        }}
      />
      <AddFoodSheet
        open={open && swapIndex !== null}
        onClose={() => setSwapIndex(null)}
        swap={
          swapLine
            ? { query: swapLine.name, grams: parseDecimal(swapLine.grams) || null }
            : undefined
        }
        onIngredientCaptured={(ing) => {
          const food: ListFood = {
            name: ing.name,
            per100: ing.per100,
            ...(ing.nevo ? { nevo: ing.nevo } : {}),
          };
          if (swapIndex != null && swapIndex >= 0) {
            // Only the food changes; grams already on the line stay.
            setLines((cur) =>
              cur.map((line, j) =>
                j === swapIndex ? { ...line, food, grams: line.grams || String(ing.grams) } : line,
              ),
            );
          } else {
            setLines((cur) => [
              ...cur,
              {
                id: crypto.randomUUID(),
                written: "",
                name: ing.name,
                grams: String(ing.grams),
                amount: null,
                food,
              },
            ]);
          }
          setSwapIndex(null);
        }}
      />
    </>
  );
}

/** The scanner's modes a list can come from. */
function listMode(mode: ScanMode): "note" | "plate" {
  return mode === "plate" ? "plate" : "note";
}
