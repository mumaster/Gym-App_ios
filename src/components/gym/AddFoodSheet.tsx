import { useRef, useState } from "react";
import { AlertTriangle, Camera, Check, Keyboard, Loader2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { OCR_LANGUAGES, parseNutritionText } from "../../lib/gym/nutritionOcr";
import { MEAL_LABELS, MEAL_ORDER, mealForTime, type MealType } from "../../lib/gym/nutrition";
import { haptic, useGym } from "../../lib/gym/store";

type Step = "start" | "scanning" | "review";
type MacroKey = "calories" | "protein" | "carbs" | "fat";

const MACRO_FIELDS: { key: MacroKey; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

const emptyPer100: Record<MacroKey, string> = {
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

export function AddFoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addFoodEntry } = useGym();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("start");
  const [scanError, setScanError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealType>(() => mealForTime(new Date().toISOString()));
  const [grams, setGrams] = useState("100");
  const [per100, setPer100] = useState<Record<MacroKey, string>>(emptyPer100);
  const [unmatched, setUnmatched] = useState<Set<MacroKey>>(new Set());

  const reset = () => {
    setStep("start");
    setScanError(null);
    setName("");
    setMeal(mealForTime(new Date().toISOString()));
    setGrams("100");
    setPer100(emptyPer100);
    setUnmatched(new Set());
  };

  const close = () => {
    reset();
    onClose();
  };

  const startManual = () => {
    haptic(15);
    setName("");
    setPer100(emptyPer100);
    setUnmatched(new Set());
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
      const { createWorker } = await import("tesseract.js");
      // Self-hosted (see scripts/setup-ocr-assets.mjs) rather than the
      // library's default jsdelivr CDN, which corporate proxies, ad
      // blockers and some networks block outright. All OCR_LANGUAGES load
      // together so one scan reads labels in any of them without asking the
      // user to pick a language up front.
      const worker = await createWorker(OCR_LANGUAGES.join("+"), undefined, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract",
        gzip: true,
      });
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      const parsed = parseNutritionText(text);
      const missing = new Set<MacroKey>();
      const next: Record<MacroKey, string> = { ...emptyPer100 };
      for (const { key } of MACRO_FIELDS) {
        const v = parsed[key];
        if (v === null) missing.add(key);
        else next[key] = String(v);
      }
      setPer100(next);
      setUnmatched(missing);
      setName((n) => n || "Scanned food");
      setStep("review");
    } catch {
      setScanError(
        "Couldn't read that photo — try a clearer, well-lit shot, or enter it manually.",
      );
      setStep("start");
    }
  };

  const gramsNum = Number(grams) || 0;
  const factor = gramsNum / 100;
  const preview = {
    calories: Math.round((Number(per100.calories) || 0) * factor),
    protein: Number(((Number(per100.protein) || 0) * factor).toFixed(1)),
    carbs: Number(((Number(per100.carbs) || 0) * factor).toFixed(1)),
    fat: Number(((Number(per100.fat) || 0) * factor).toFixed(1)),
  };

  const canSave = name.trim().length > 0 && gramsNum > 0;

  const save = () => {
    if (!canSave) return;
    haptic([20, 30]);
    addFoodEntry({
      id: crypto.randomUUID(),
      name: name.trim(),
      logged_at: new Date().toISOString(),
      meal,
      grams: gramsNum,
      per100: {
        calories: Number(per100.calories) || 0,
        protein: Number(per100.protein) || 0,
        carbs: Number(per100.carbs) || 0,
        fat: Number(per100.fat) || 0,
      },
    });
    close();
  };

  return (
    <BottomSheet open={open} onClose={close} title="Add food">
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
        </div>
      ) : null}

      {step === "scanning" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-[15px] font-semibold">Reading the label…</p>
          <p className="text-[13px] text-muted-foreground">
            This runs right on your device — no photo is uploaded anywhere.
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
              placeholder="e.g. Greek yogurt"
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
            />
          </label>

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
                      type="number"
                      value={per100[key]}
                      onChange={(e) => {
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

          <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="shrink-0 text-[14px] font-semibold text-muted-foreground">
              Grams eaten
            </span>
            <input
              inputMode="numeric"
              type="number"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="tabular h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[17px] font-bold text-foreground outline-none"
            />
          </label>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-primary">
              This portion
            </p>
            <p className="tabular mt-1 text-[15px] font-semibold">
              {preview.calories} kcal · {preview.protein}g protein · {preview.carbs}g carbs ·{" "}
              {preview.fat}g fat
            </p>
          </div>

          <button
            onClick={save}
            disabled={!canSave}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> Add to log
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
