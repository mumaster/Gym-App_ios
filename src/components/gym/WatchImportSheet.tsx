import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Footprints, ImagePlus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { DumbbellLoader } from "./DumbbellLoader";
import { RouteMapView } from "./RouteMapView";
import { WatchDataCard } from "./WatchDataCard";
import { dayKey } from "../../lib/gym/date";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { screenshotToBase64Parts } from "../../lib/gym/imageUpload";
import { extractRouteMap, partBoxToCrop, type RouteMap } from "../../lib/gym/routeMap";
import { putRouteMap } from "../../lib/gym/routeMapStore";
import { parseDayKey } from "../../lib/gym/schedule";
import { haptic, useGym } from "../../lib/gym/store";
import type { CardioActivity, CardioEffort, WatchData } from "../../lib/gym/types";
import { cardioTargetId, formatDuration, looksLikeCardio, matchWorkout } from "../../lib/gym/watch";
import { guessCardioActivity } from "../../lib/gym/cardio";
import { ActivityPicker, EffortPicker } from "./CardioControls";
import { scanWatchWorkout } from "../../lib/gym/watchScan";

type Step = "pick" | "reading" | "review" | "error";

/** Sessions offered when the screenshots don't match one by date and time. */
const PICK_LIMIT = 20;

/** Where the read numbers go: a Forge strength session, or a cardio session
 *  of their own (new, or the one being replaced). */
type Target = { type: "workout"; id: string } | { type: "cardio" };

/**
 * Screenshots of a workout in a watch's app → that workout's numbers in
 * Forge. Pick one or more screenshots; they're read together in one request
 * (watchScan.ts). A strength recording is matched to a Forge session by date
 * and time (watch.ts) or picked by hand; a cardio recording (a run, a walk)
 * is saved as a cardio session of its own. Either can be switched by hand.
 * Opened from a session's detail screen, that session is preselected; from
 * a cardio session's, its data is replaced.
 */
export function WatchImportSheet({
  open,
  onClose,
  workoutId,
  cardioId,
}: {
  open: boolean;
  onClose: () => void;
  /** Attach to this session (from its detail screen) instead of matching. */
  workoutId?: string;
  /** Replace this cardio session's data (from its detail screen). */
  cardioId?: string;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const { workouts, cardioSessions, setWorkoutWatch, saveCardioSession } = useGym();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<WatchData | null>(null);
  const [chosen, setChosen] = useState<Target | null>(null);
  const [routeMap, setRouteMap] = useState<RouteMap | null>(null);
  const [pickedActivity, setPickedActivity] = useState<CardioActivity | null>(null);
  const [pickedEffort, setPickedEffort] = useState<CardioEffort | null>(null);

  const matched = useMemo(
    () => (scan && !workoutId && !cardioId ? matchWorkout(scan.start, workouts) : null),
    [scan, workoutId, cardioId, workouts],
  );
  const cardio = scan ? looksLikeCardio(scan) : false;
  // Default: the preset session; else cardio as its own session; else the
  // matched strength session; else nothing until the user picks.
  const target: Target | null = cardioId
    ? { type: "cardio" }
    : (chosen ??
      (workoutId
        ? { type: "workout", id: workoutId }
        : cardio
          ? { type: "cardio" }
          : matched
            ? { type: "workout", id: matched.id }
            : null));
  const preset = workoutId ? workouts.find((w) => w.id === workoutId) : undefined;
  // Activity and effort for a cardio save: what the user picked, else what
  // the session being replaced had, else (activity only) a guess from the
  // watch's own name for it. Effort is never guessed.
  const replacing = cardioId ? cardioSessions.find((c) => c.id === cardioId) : undefined;
  const activity =
    pickedActivity ?? replacing?.activity ?? guessCardioActivity(scan?.activity) ?? null;
  const effort = pickedEffort ?? replacing?.effort ?? null;
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });

  const reset = () => {
    setStep("pick");
    setError(null);
    setScan(null);
    setChosen(null);
    setRouteMap(null);
    setPickedActivity(null);
    setPickedEffort(null);
  };

  const save = () => {
    if (!scan || !target) return;
    haptic([20, 30]);
    if (target.type === "workout") setWorkoutWatch(target.id, scan);
    else {
      const id = cardioTargetId(scan, cardioSessions, cardioId) ?? crypto.randomUUID();
      saveCardioSession(
        id,
        scan,
        !!routeMap,
        activity && effort ? { activity, effort } : undefined,
      );
      if (routeMap) void putRouteMap(id, routeMap);
    }
    reset();
    onClose();
  };

  // Done with a read, attachable result keeps it, like every other sheet
  // with a filled-in draft (see "Bottom sheets save on Done" in CLAUDE.md).
  const close = () => {
    if (step === "review" && scan && target) save();
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
      const perFile = await Promise.all(files.map(screenshotToBase64Parts));
      const parts = perFile.flatMap((ps, fileIndex) => ps.map((p) => ({ ...p, fileIndex })));
      const images = parts.map(({ base64, mimeType }) => ({ imageBase64: base64, mimeType }));
      const { routeMap: mapAt, ...result } = await scanWatchWorkout({ data: { images } });
      const empty =
        result.durationSeconds == null &&
        result.avgHr == null &&
        result.totalKcal == null &&
        result.activeKcal == null &&
        result.distanceKm == null &&
        !result.hrZones.length;
      if (empty) {
        setError(t.watch.nothingRead);
        setStep("error");
        return;
      }
      // The route map, cut out of the full-size screenshot. Optional: a
      // map that can't be found or read just isn't shown.
      const part = mapAt ? parts[mapAt.image] : undefined;
      const crop = part && mapAt ? partBoxToCrop(mapAt.box, part) : null;
      setRouteMap(
        part && crop ? await extractRouteMap(files[part.fileIndex]!, crop).catch(() => null) : null,
      );
      setScan({ ...result, importedAt: new Date().toISOString() });
      setStep("review");
    } catch (e) {
      setError(t.watch.error(e instanceof Error ? e.message : String(e)));
      setStep("error");
    }
  };

  const isOn = (x: Target) =>
    target?.type === x.type &&
    (x.type === "cardio" || (target.type === "workout" && target.id === x.id));
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
          <button
            onClick={() => fileRef.current?.click()}
            className="glow flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.985]"
          >
            <ImagePlus className="size-5" /> {t.watch.choose}
          </button>
        </div>
      ) : null}

      {step === "reading" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <DumbbellLoader size={56} className="text-primary-text" />
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
            <ImagePlus className="size-5 text-primary-text" /> {t.watch.tryAgain}
          </button>
        </div>
      ) : null}

      {step === "review" && scan ? (
        <div className="space-y-4">
          {routeMap && target?.type === "cardio" ? <RouteMapView map={routeMap} /> : null}
          <WatchDataCard data={scan} />

          {cardioId ? null : (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                {t.watch.saveAs}
              </p>
              {!preset ? (
                cardio ? (
                  <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-primary-text">
                    <Check className="size-3.5" /> {t.watch.cardioDetected}
                  </p>
                ) : matched ? (
                  <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-primary-text">
                    <Check className="size-3.5" /> {t.watch.matched}
                  </p>
                ) : (
                  <p className="mb-2 text-[12.5px] text-muted-foreground">{t.watch.noMatch}</p>
                )
              ) : null}
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                <TargetRow
                  on={isOn({ type: "cardio" })}
                  onPick={() => setChosen({ type: "cardio" })}
                  title={t.watch.newCardio}
                  detail={[
                    scan.activity,
                    scan.distanceKm != null ? `${scan.distanceKm.toLocaleString(locale)} km` : null,
                    scan.durationSeconds != null ? formatDuration(scan.durationSeconds) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  icon
                />
                {(preset ? [preset] : recent).map((w) => (
                  <TargetRow
                    key={w.id}
                    on={isOn({ type: "workout", id: w.id })}
                    onPick={() => setChosen({ type: "workout", id: w.id })}
                    title={dayLabel(w.date)}
                    detail={`${new Date(w.date).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })} · ${w.target_muscles.join(" · ")}`}
                  />
                ))}
              </div>
              {presetOtherDay && target?.type === "workout" ? (
                <p className="mt-2 flex items-start gap-2 text-[13px] text-amber-500">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {t.watch.otherDay(presetOtherDay)}
                </p>
              ) : null}
            </div>
          )}

          {target?.type === "cardio" ? (
            <div className="space-y-4">
              <ActivityPicker value={activity} onChange={setPickedActivity} />
              <EffortPicker value={effort} onChange={setPickedEffort} />
              {!activity || !effort ? (
                <p className="text-[12.5px] text-muted-foreground">{t.cardio.setKind}</p>
              ) : null}
            </div>
          ) : null}

          <button
            onClick={save}
            disabled={!target}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" />{" "}
            {target?.type === "cardio" ? t.watch.saveCardio : t.watch.save}
          </button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

function TargetRow({
  on,
  onPick,
  title,
  detail,
  icon,
}: {
  on: boolean;
  onPick: () => void;
  title: string;
  detail: string;
  icon?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      aria-pressed={on}
      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-[14px] ${
        on ? "bg-primary/15 ring-1 ring-primary" : "bg-muted"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon ? <Footprints className="size-4 shrink-0 text-primary-text" /> : null}
        <span className="min-w-0 truncate">
          <span className="font-semibold">{title}</span>
          {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
        </span>
      </span>
      {on ? <Check className="size-4 shrink-0 text-primary-text" /> : null}
    </button>
  );
}
