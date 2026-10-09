import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { button } from "./ui";
import { BottomSheet } from "./BottomSheet";
import { useTranslation } from "../../lib/gym/i18n";
import { decodeMeal, mealCodeFrom, mealShareUrl, type SharedMeal } from "../../lib/gym/mealShare";
import { MEAL_ORDER, dailyTotals, type MealType } from "../../lib/gym/nutrition";
import { haptic, useGym } from "../../lib/gym/store";

/** A meal's QR plus the iOS share sheet: the other person scans it with
 *  their camera (or taps the link) and lands on the import sheet. */
export function ShareMealSheet({
  meal,
  onClose,
}: {
  meal: SharedMeal | null;
  onClose: () => void;
}) {
  const t = useTranslation();
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const url = meal ? mealShareUrl(meal, window.location.origin) : "";

  useEffect(() => {
    setCopied(false);
    if (!url) return setSvg("");
    let live = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "L" })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(""));
    return () => {
      live = false;
    };
  }, [url]);

  const send = async () => {
    if (!meal) return;
    try {
      if (navigator.share)
        await navigator.share({ title: meal.name, text: t.mealShare.shareText(meal.name), url });
      else await copy();
    } catch {
      // closing the share sheet rejects too — nothing to report.
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // clipboard blocked: the QR and share sheet still work.
    }
  };

  return (
    <BottomSheet
      open={meal != null}
      onClose={onClose}
      title={meal ? t.mealShare.title(meal.name) : ""}
    >
      {meal ? (
        <div className="space-y-4">
          {svg ? (
            <div
              className="mx-auto size-64 overflow-hidden rounded-2xl bg-white p-2 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: svg }}
              role="img"
              aria-label={meal.name}
            />
          ) : null}
          <p className="text-center text-[13px] text-muted-foreground">{t.mealShare.hint}</p>
          <div className="flex gap-2">
            <button onClick={send} className={`${button.primary} flex-1`}>
              <Share2 className="size-4" /> {t.mealShare.send}
            </button>
            <button
              onClick={copy}
              className="glass flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold active:scale-[0.985]"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t.mealShare.copied : t.mealShare.copy}
            </button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

/** Opens on a shared link (or a pasted one): shows the meal and logs it
 *  today or saves it to the user's meals. `code` null with `paste` shows
 *  the paste box first. */
export function ImportMealSheet({
  open,
  code,
  onClose,
}: {
  open: boolean;
  code: string | null;
  onClose: () => void;
}) {
  const t = useTranslation();
  const { logIngredients, saveMealTemplate, rememberFood } = useGym();
  const [pasted, setPasted] = useState("");
  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState<MealType>("dinner");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPasted("");
      setSaved(false);
      setError(false);
    }
  }, [open, code]);

  const activeCode = code ?? mealCodeFrom(pasted);
  const meal = activeCode ? decodeMeal(activeCode) : null;
  /** The ingredients join "your foods" so they can go into new meals. NEVO
   *  foods stay out, as everywhere: the NEVO search already finds them. */
  const rememberIngredients = () => {
    for (const ing of meal?.ingredients ?? []) if (!ing.nevo?.length) rememberFood(ing);
  };
  const totals = meal ? dailyTotals(meal.ingredients) : null;

  return (
    <BottomSheet open={open} onClose={onClose} title={meal ? meal.name : t.mealShare.importFrom}>
      {open ? (
        <div className="space-y-4">
          {!meal ? (
            <>
              <p className="text-[13px] text-muted-foreground">{t.mealShare.pasteHint}</p>
              <input
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setError(
                    e.target.value.trim() !== "" && !decodeMeal(mealCodeFrom(e.target.value) ?? ""),
                  );
                }}
                placeholder={t.mealShare.pastePlaceholder}
                className="min-h-[48px] w-full rounded-2xl bg-muted px-4 text-[16px]"
              />
              {error ? <p className="text-[13px] text-destructive">{t.mealShare.invalid}</p> : null}
            </>
          ) : (
            <>
              <p className="tabular text-[13px] text-muted-foreground">
                {Math.round(totals!.calories)} kcal · {Math.round(totals!.protein)} /{" "}
                {Math.round(totals!.carbs)} / {Math.round(totals!.fat)} g
              </p>
              <div className="overflow-hidden rounded-2xl bg-muted/50">
                {meal.ingredients.map((ing, i) => (
                  <div
                    key={i}
                    className={`flex justify-between gap-3 px-3.5 py-2.5 text-[15px] ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <span className="truncate font-semibold">{ing.name}</span>
                    <span className="tabular shrink-0 text-muted-foreground">{ing.grams} g</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-1.5 px-1 text-[12.5px] font-semibold text-muted-foreground">
                  {t.mealShare.logTo}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {MEAL_ORDER.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSlot(m)}
                      className={`min-h-[40px] rounded-xl text-[13px] font-semibold ${
                        slot === m ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {t.mealTypes[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    haptic(15);
                    logIngredients(meal.ingredients, slot);
                    rememberIngredients();
                    onClose();
                  }}
                  className={`${button.primary} flex-1`}
                >
                  {t.mealShare.log}
                </button>
                <button
                  disabled={saved}
                  onClick={() => {
                    haptic(15);
                    saveMealTemplate(meal.name, meal.ingredients);
                    rememberIngredients();
                    setSaved(true);
                  }}
                  className="glass flex min-h-[48px] flex-1 items-center justify-center rounded-2xl text-[15px] font-semibold active:scale-[0.985]"
                >
                  {saved ? t.mealShare.saved : t.mealShare.saveOnly}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}
