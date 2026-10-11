import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, HelpCircle, ScanLine, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "../../lib/gym/i18n";
import { checkSulphites, type AllergenResult, type HitKind } from "../../lib/gym/allergens";
import { fileToBase64 } from "../../lib/gym/imageUpload";
import {
  lookupIngredients,
  scanIngredients,
  type ScannedIngredients,
} from "../../lib/gym/ingredientScan";
import { haptic, useGym } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { FoodScanner, type FoodScannerStatus, type ScanMode } from "./FoodScanner";
import { button, text } from "./ui";

type Step = "start" | "reading" | "result";

const KIND_KEY: Record<HitKind, "additive" | "named" | "declared" | "sourceFood" | "mayContain"> = {
  additive: "additive",
  named: "named",
  declared: "declared",
  sourceFood: "sourceFood",
  mayContain: "mayContain",
};

/**
 * Nutrition → Food → "Can I eat this?": scan a barcode or photograph the
 * ingredients (or paste them) and see whether the product has what the user
 * is allergic to (Settings → Allergies). Three answers, never a plain yes:
 * contains / may contain / none found. See lib/gym/allergens.ts.
 */
export function CanIEatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const { allergies } = useGym();
  const [step, setStep] = useState<Step>("start");
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [product, setProduct] = useState<string | null>(null);
  const [result, setResult] = useState<AllergenResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<FoodScannerStatus>("scanning");
  const [scanMode, setScanMode] = useState<ScanMode>("barcode");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const a = t.allergy;
  const active = allergies.includes("sulphites");

  useEffect(() => {
    if (!open) return;
    setStep("start");
    setError(null);
    setPasted("");
    setProduct(null);
    setResult(null);
    setScannerOpen(false);
  }, [open]);

  const show = (found: ScannedIngredients) => {
    const r = checkSulphites(found.ingredientsText, found.tags);
    if (!r) {
      setError(a.noIngredients);
      setStep("start");
      return;
    }
    setProduct(found.name);
    setResult(r);
    setStep("result");
    haptic(r.verdict === "none" ? 10 : 20);
  };

  const fail = (e: unknown) => {
    setError(a.readError(e instanceof Error ? e.message : String(e)));
    setStep("start");
  };

  const readPhoto = async (file: File) => {
    setError(null);
    setStep("reading");
    try {
      const { base64: imageBase64, mimeType } = await fileToBase64(file);
      show(await scanIngredients({ data: { imageBase64, mimeType } }));
    } catch (e) {
      fail(e);
    }
  };

  const onBarcode = async (code: string) => {
    setScannerStatus("lookingUp");
    try {
      const found = await lookupIngredients(code);
      if (!found?.ingredientsText && !found?.tags?.allergens?.length) {
        // Unknown product, or no ingredients on file: photograph them.
        setScannerStatus("notFound");
        setScanMode("label");
        return;
      }
      setScannerOpen(false);
      show(found);
    } catch (e) {
      setScannerOpen(false);
      fail(e);
    }
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={a.title}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readPhoto(file);
          }}
        />

        {!active ? (
          <div className="space-y-4 py-2">
            <p className="text-[15px] text-muted-foreground">{a.noneSet}</p>
            <Link to="/settings" onClick={onClose} className={`${button.primary} w-full`}>
              {a.openSettings}
            </Link>
          </div>
        ) : null}

        {active && step === "start" ? (
          <div className="space-y-4">
            {error ? (
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            ) : null}
            <button
              onClick={() => {
                haptic(15);
                setError(null);
                setScannerStatus("scanning");
                setScanMode("barcode");
                setScannerOpen(true);
              }}
              className={`${button.primary} w-full`}
            >
              <ScanLine className="size-5" /> {a.scan}
            </button>
            <div>
              <p className={`${text.eyebrow} mb-2`}>{a.orType}</p>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={a.placeholder}
                rows={3}
                className="w-full rounded-2xl bg-secondary px-4 py-3 text-[16px] placeholder:text-muted-foreground"
              />
              <button
                disabled={!pasted.trim()}
                onClick={() => {
                  haptic(12);
                  show({ name: null, ingredientsText: pasted });
                }}
                className={`${button.secondary} mt-2 w-full`}
              >
                {a.check}
              </button>
            </div>
            <p className={text.note}>{a.disclaimer}</p>
          </div>
        ) : null}

        {active && step === "reading" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <DumbbellLoader size={56} className="text-primary-text" />
            <p className="text-[15px] font-semibold">{a.reading}</p>
            <p className="text-[13px] text-muted-foreground">{a.readingDesc}</p>
          </div>
        ) : null}

        {active && step === "result" && result ? (
          <div className="space-y-4">
            <Verdict result={result} product={product} />
            <button onClick={() => setStep("start")} className={`${button.secondary} w-full`}>
              {a.again}
            </button>
            <p className={text.note}>{a.disclaimer}</p>
          </div>
        ) : null}
      </BottomSheet>

      <FoodScanner
        open={scannerOpen}
        status={scannerStatus}
        onClose={() => setScannerOpen(false)}
        onBarcode={(code) => void onBarcode(code)}
        onPhoto={(photo) => {
          setScannerOpen(false);
          void readPhoto(new File([photo], "label.jpg", { type: photo.type || "image/jpeg" }));
        }}
        onChoosePhoto={() => {
          setScannerOpen(false);
          fileRef.current?.click();
        }}
        modes={["barcode", "label"]}
        mode={scanMode}
        onMode={(m) => {
          setScanMode(m);
          if (m === "barcode") setScannerStatus("scanning");
        }}
      />
    </>
  );
}

function Verdict({ result, product }: { result: AllergenResult; product: string | null }) {
  const t = useTranslation();
  const a = t.allergy;
  const v = result.verdict;
  const tone =
    v === "contains"
      ? "bg-destructive/10 text-destructive-text"
      : v === "maybe"
        ? "bg-warning/10 text-warning-text"
        : "bg-primary/10 text-primary-text";
  const Icon = v === "contains" ? ShieldAlert : v === "maybe" ? HelpCircle : Check;
  return (
    <div className="space-y-3">
      {product ? <p className={text.eyebrow}>{product}</p> : null}
      <div className={`flex items-start gap-3 rounded-2xl px-4 py-4 ${tone}`}>
        <Icon aria-hidden className="mt-0.5 size-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-[19px] font-bold leading-tight">
            {v === "contains" ? a.contains : v === "maybe" ? a.maybe : a.clear}
          </p>
          <p className="mt-1 text-[14px] leading-snug">
            {v === "contains" ? a.containsDesc : v === "maybe" ? a.maybeDesc : a.clearDesc}
          </p>
        </div>
      </div>
      {result.hits.length ? (
        <div>
          <p className={`${text.eyebrow} mb-2`}>{a.foundBecause}</p>
          <ul className="divide-y divide-border rounded-2xl glass px-4">
            {result.hits.map((h) => (
              <li
                key={`${h.kind}-${h.term}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0 break-words text-[15px] font-semibold">{h.term}</span>
                <span className="shrink-0 text-right text-[12px] text-muted-foreground">
                  {a.kinds[KIND_KEY[h.kind]]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
