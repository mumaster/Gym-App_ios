import { useEffect, useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { buildRecap } from "../../lib/gym/recap";
import { drawRecap, recapBlob, type RecapCopy } from "../../lib/gym/recapImage";
import { haptic, useGym } from "../../lib/gym/store";
import { SESSION_RPE_ANCHORS } from "../../lib/gym/trainingLoad";
import type { Workout } from "../../lib/gym/types";

/** A preview of the recap image plus a Share button. On iPhone the share
 *  sheet offers Save Image, Messages, Instagram…; where file sharing isn't
 *  supported the PNG is downloaded instead. */
export function RecapShare({ workout }: { workout: Workout }) {
  const { workouts } = useGym();
  const t = useTranslation();
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const data = useMemo(() => buildRecap(workout, workouts), [workout, workouts]);

  const copy = useMemo<RecapCopy>(() => {
    const date = new Date(workout.date);
    return {
      eyebrow: t.recap.eyebrow,
      title: workout.target_muscles.length
        ? workout.target_muscles.join(" · ")
        : t.generate.fullBody,
      date: date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }),
      minutes: t.recap.duration,
      volume: t.recap.volume,
      sets: t.recap.sets,
      bw: t.session.bw,
      pr: t.recap.pr,
      prs: t.recap.prs,
      effort: (rpe) => {
        const anchor = SESSION_RPE_ANCHORS[rpe];
        const label = anchor
          ? t.trainingLoad.anchors[anchor as keyof typeof t.trainingLoad.anchors]
          : "";
        return t.recap.effort(rpe, label);
      },
      more: t.recap.more,
      setsCount: t.recap.setsCount,
    };
  }, [workout, t, locale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--primary");
    drawRecap(canvas, data, copy, accent);
    setPreview(canvas.toDataURL("image/png"));
  }, [data, copy]);

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    haptic(15);
    setBusy(true);
    try {
      const blob = await recapBlob(canvas);
      if (!blob) return;
      const file = new File([blob], `forge-${workout.date.slice(0, 10)}.png`, {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      // The user closing the share sheet rejects too — nothing to report.
    } finally {
      setBusy(false);
    }
  };

  if (!data.workingSets) return null;
  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      {preview ? (
        <img
          src={preview}
          alt={t.recap.alt}
          className="mx-auto w-full max-w-[320px] rounded-2xl shadow-[0_18px_50px_-12px_oklch(0_0_0/60%)]"
        />
      ) : null}
      <button
        onClick={() => void share()}
        disabled={busy}
        className="relative mx-auto flex min-h-[52px] w-full max-w-[320px] items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
      >
        <Share2 className="size-5" />
        {t.recap.share}
      </button>
    </div>
  );
}
