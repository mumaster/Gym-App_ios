import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ImagePlus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { WatchDataCard } from "./WatchDataCard";
import { dayKey } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { fileToBase64, SCREENSHOT_LIMIT } from "../../lib/gym/imageUpload";
import { parseDayKey } from "../../lib/gym/schedule";
import { haptic, useGym } from "../../lib/gym/store";
import type { WatchData } from "../../lib/gym/types";
import { matchWorkout } from "../../lib/gym/watch";
import { scanWatchWorkout } from "../../lib/gym/watchScan";

type Step = "pick" | "reading" | "review" | "error";

/** Sessions offered when the screenshots don't match one by date and time. */
const PICK_LIMIT = 20;

/**
 * Screenshots of a workout in a watch's app → that workout's numbers on a
 * Forge session. Pick one or more screenshots; they're read together in
 * one request (watchScan.ts); the session is matched by date and time
 * (watch.ts) or picked by hand; saving attaches the numbers to it. Opened
 * from a session's detail screen, that session is preselected.
 */
export function WatchImportSheet({
  open,
  onClose,
  workoutId,
}: {
  open: boolean;
  onClose: () => void;
  /** Attach to this session (from its detail screen) instead of matching. */
  workoutId?: string;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { workouts, setWorkoutWatch } = useGym();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<WatchData | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const matched = useMemo(
    () => (scan && !workoutId ? matchWorkout(scan.start, workouts) : null),
    [scan, workoutId, workouts],
  );
  const targetId = workoutId ?? chosenId ?? matched?.id ?? null;
  const preset = workoutId ? workouts.find((w) => w.id === workoutId) : undefined;
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  const reset = () => {
    setStep("pick");
    setError(null);
    setScan(null);
    setChosenId(null);
  };

  const save = () => {
    if (!scan || !targetId) return;
    haptic([20, 30]);
    setWorkoutWatch(targetId, scan);
    reset();
    onClose();
  };

  // Done with a read, attachable result keeps it, like every other sheet
  // with a filled-in draft (see "Bottom sheets save on Done" in CLAUDE.md).
  const close = () => {
    if (step === "review" && scan && targetId) save();
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
      const images = await Promise.all(
        files.map(async (f) => {
          const { base64, mimeType } = await fileToBase64(f, SCREENSHOT_LIMIT);
          return { imageBase64: base64, mimeType };
        }),
      );
      const result = await scanWatchWorkout({ data: { images } });
      const empty =
        result.durationSeconds == null &&
        result.avgHr == null &&
        result.totalKcal == null &&
        result.activeKcal == null &&
        !result.hrZones.length;
      if (empty) {
        setError(t.watch.nothingRead);
        setStep("error");
        return;
      }
      setScan({ ...result, importedAt: new Date().toISOString() });
      setStep("review");
    } catch (e) {
      setError(t.watch.error(e instanceof Error ? e.message : String(e)));
      setStep("error");
    }
  };

  const recent = useMemo(
    () =>
      [...workouts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, PICK_LIMIT),
    [workouts],
  );
  const watchDay = scan?.start?.slice(0, 10);
  // Local calendar days on both sides — toISOString would compare UTC days.
  const presetOtherDay =
    preset && watchDay && dayKey(preset.date) !== watchDay
      ? parseDayKey(watchDay).toLocaleDateString(locale, { day: "numeric", month: "long" })
      : null;

  return (
    <BottomSheet open={open} onClose={close} title={t.watch.sheetTitle}>
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
          <p className="text-[14px] leading-snug text-muted-foreground">{t.watch.intro}</p>
          {workouts.length ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="glow flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
            >
              <ImagePlus className="size-5" /> {t.watch.choose}
            </button>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-3 text-[14px]">{t.watch.noSessions}</p>
          )}
        </div>
      ) : null}

      {step === "reading" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <DumbbellLoader size={56} className="text-primary" />
          <p className="text-[15px] font-semibold">{t.watch.reading}</p>
          <p className="text-[13px] text-muted-foreground">{t.watch.readingDesc}</p>
        </div>
      ) : null}

      {step === "error" ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-[14px] text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="glass flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold"
          >
            <ImagePlus className="size-5 text-primary" /> {t.watch.tryAgain}
          </button>
        </div>
      ) : null}

      {step === "review" && scan ? (
        <div className="space-y-4">
          <WatchDataCard data={scan} />

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.watch.attachTo}
            </p>
            {preset ? (
              <>
                <p className="rounded-2xl bg-muted px-4 py-3 text-[14px] font-semibold">
                  {dayLabel(preset.date)} · {preset.target_muscles.join(" · ")}
                </p>
                {presetOtherDay ? (
                  <p className="mt-2 flex items-start gap-2 text-[13px] text-amber-500">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {t.watch.otherDay(presetOtherDay)}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {matched && !chosenId ? (
                  <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-primary">
                    <Check className="size-3.5" /> {t.watch.matched}
                  </p>
                ) : !matched ? (
                  <p className="mb-2 text-[12.5px] text-muted-foreground">{t.watch.noMatch}</p>
                ) : null}
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {recent.map((w) => {
                    const on = w.id === targetId;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setChosenId(w.id)}
                        aria-pressed={on}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-[14px] ${
                          on ? "bg-primary/15 ring-1 ring-primary" : "bg-muted"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-semibold">{dayLabel(w.date)}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {new Date(w.date).toLocaleTimeString(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {" · "}
                            {w.target_muscles.join(" · ")}
                          </span>
                        </span>
                        {on ? <Check className="size-4 shrink-0 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            onClick={save}
            disabled={!targetId}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> {t.watch.save}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
