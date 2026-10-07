import { useRef, useState } from "react";
import { AlertTriangle, Check, ImagePlus, Scale } from "lucide-react";
import { dayKey } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { screenshotToBase64Parts } from "../../lib/gym/imageUpload";
import { readingToWeighIn, type ScaleWeighIn } from "../../lib/gym/scale";
import { scanScaleReading } from "../../lib/gym/scaleScan";
import { haptic, useGym } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";
import { CompositionGrid } from "./BodyCompositionCard";
import { DumbbellLoader } from "./DumbbellLoader";
import { badge, button } from "./ui";

type Step = "pick" | "reading" | "review" | "error";

/**
 * A screenshot of a weigh-in in a smart scale's app → a weigh-in in Forge,
 * with the body composition printed alongside it (asked for, from a Huawei
 * Health page). Like the watch import: pick one or more screenshots, read
 * together in one request (scaleScan.ts), checked by scale.ts, then a
 * review with Save. The weigh-in lands on the day it was measured and
 * replaces that day's weigh-in, as typing today's weight does; the review
 * says so first. Done saves a finished read (the save-on-Done rule).
 */
export function ScaleImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const locale = useLocale();
  const { weightLog, logWeighIn } = useGym();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<ScaleWeighIn | null>(null);

  const reset = () => {
    setStep("pick");
    setError(null);
    setReading(null);
  };

  const save = () => {
    if (!reading) return;
    haptic([20, 30]);
    logWeighIn(reading);
    reset();
    onClose();
  };

  const close = () => {
    if (step === "review" && reading) save();
    else {
      reset();
      onClose();
    }
  };

  const read = async (files: File[]) => {
    if (!files.length) return;
    setStep("reading");
    setError(null);
    try {
      const parts = (await Promise.all(files.map(screenshotToBase64Parts))).flat();
      const images = parts.map(({ base64, mimeType }) => ({ imageBase64: base64, mimeType }));
      const result = readingToWeighIn(await scanScaleReading({ data: { images } }));
      if (!result) {
        setError(t.scale.nothingRead);
        setStep("error");
        return;
      }
      setReading(result);
      setStep("review");
    } catch (e) {
      setError(t.scale.error(e instanceof Error ? e.message : String(e)));
      setStep("error");
    }
  };

  const kg = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 2 })} kg`;
  const when = reading
    ? new Date(reading.date).toLocaleString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const replaced = reading
    ? weightLog.find((e) => dayKey(e.date) === dayKey(reading.date))
    : undefined;

  return (
    <BottomSheet open={open} onClose={close} title={t.scale.sheetTitle}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void read(files);
        }}
      />

      {step === "pick" ? (
        <div className="space-y-4">
          <p className="text-[14px] leading-snug text-muted-foreground">{t.scale.intro}</p>
          <button onClick={() => fileRef.current?.click()} className={`${button.primary} w-full`}>
            <ImagePlus className="size-5" /> {t.scale.choose}
          </button>
        </div>
      ) : null}

      {step === "reading" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <DumbbellLoader size={56} className="text-primary-text" />
          <p className="text-[15px] font-semibold">{t.scale.reading}</p>
          <p className="text-[13px] text-muted-foreground">{t.scale.readingDesc}</p>
        </div>
      ) : null}

      {step === "error" ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
          <button onClick={() => fileRef.current?.click()} className={`${button.secondary} w-full`}>
            <ImagePlus className="size-5" /> {t.scale.tryAgain}
          </button>
        </div>
      ) : null}

      {step === "review" && reading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className={`${badge.tonal} size-11`}>
              <Scale className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="tabular text-[26px] font-bold leading-tight">{kg(reading.kg)}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {[when, reading.source].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {reading.composition ? <CompositionGrid composition={reading.composition} /> : null}
          {replaced ? (
            <p className="flex items-start gap-2 text-[13px] text-warning-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t.scale.replaces(
                kg(replaced.kg),
                new Date(replaced.date).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "long",
                }),
              )}
            </p>
          ) : null}
          <button onClick={save} className={`${button.primary} w-full`}>
            <Check className="size-5" /> {t.scale.save}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
