import { useEffect, useState } from "react";
import { AlertTriangle, Dumbbell, HeartPulse, Plus, Shuffle } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { ActivityPicker, EffortPicker } from "./CardioControls";
import { button, chip } from "./ui";
import { EQUIPMENT, exerciseById } from "../../lib/gym/data";
import { nearDuplicateIn } from "../../lib/gym/similar";
import { muscleLabel } from "../../lib/gym/antagonist";
import { muscleIcon } from "../../lib/gym/muscleIcons";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic } from "../../lib/gym/store";
import type { CardioActivity, CardioEffort, CardioFinisher, Exercise } from "../../lib/gym/types";

const MINUTES = [10, 20, 30];

const subtitleOf = (e: Exercise) =>
  [muscleLabel(e), ...e.equipment_required.map((id) => EQUIPMENT.find((q) => q.id === id)?.label)]
    .filter(Boolean)
    .join(" · ");

type View = "menu" | "pick" | "cardio";
type Pending = { e: Exercise; other: string };

/** What tapping "Exercise" on the finish panel opens: a new exercise picked
 *  for the user, one they choose (the best fit suggested first), or cardio
 *  after the lifting. */
export function AddToWorkoutSheet({
  open,
  onClose,
  options,
  inWorkoutIds = [],
  targetMuscles,
  onAuto,
  onPick,
  onCardio,
}: {
  open: boolean;
  onClose: () => void;
  /** Exercises not yet in the workout that the gear allows. */
  options: Exercise[];
  /** Everything already in the workout, to warn about near-duplicates. */
  inWorkoutIds?: readonly string[];
  targetMuscles: readonly string[];
  onAuto: () => void;
  onPick: (e: Exercise) => void;
  onCardio: (c: CardioFinisher) => void;
}) {
  const t = useTranslation();
  const [view, setView] = useState<View>("menu");
  const [activity, setActivity] = useState<CardioActivity>("run");
  const [effort, setEffort] = useState<CardioEffort>("moderate");
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => {
    if (!open) {
      setView("menu");
      setPending(null);
    }
  }, [open]);

  const fits = options.filter((e) => targetMuscles.includes(e.primary_muscle));
  const rest = options.filter((e) => !fits.includes(e));
  const suggested = fits[0] ?? options[0];
  const more = [...fits, ...rest].filter((e) => e.id !== suggested?.id);
  const customMin = Math.round(Number(custom));
  const customOk = customMin >= 1 && customMin <= 240;

  const similarName = (e: Exercise) => {
    const id = nearDuplicateIn(e.id, inWorkoutIds);
    return id ? exerciseById(id)?.name : undefined;
  };
  const choose = (e: Exercise) => {
    const other = similarName(e);
    if (other) setPending({ e, other });
    else onPick(e);
  };

  const row = (e: Exercise) => {
    const similar = similarName(e);
    const Icon = muscleIcon(e.primary_muscle);
    return (
      <button
        key={e.id}
        onClick={() => choose(e)}
        className="glass flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-2 text-left active:scale-[0.985]"
      >
        <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{e.name}</span>
          <span data-cut-ok className="block truncate text-[13px] text-muted-foreground">
            {subtitleOf(e)}
          </span>
          {similar ? (
            <span className="block text-[13px] text-warning-text">
              {t.swapSheet.similarTo(similar)}
            </span>
          ) : null}
        </span>
        <Plus className="size-5 shrink-0 text-primary-text" />
      </button>
    );
  };

  const choice = (Icon: typeof Dumbbell, label: string, hint: string | null, go: () => void) => (
    <button
      onClick={() => {
        haptic(10);
        go();
      }}
      className="glass flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-4 py-2 text-left active:scale-[0.985]"
    >
      <Icon aria-hidden className="size-5 shrink-0 text-primary-text" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        {hint ? <span className="block text-[13px] text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );

  const addCardio = (minutes: number) => onCardio({ activity, effort, minutes });
  const back = (
    <button
      onClick={() => setView("menu")}
      className="min-h-[44px] w-full text-[15px] font-semibold text-muted-foreground active:scale-95"
    >
      {t.session.addBack}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t.session.addSheetTitle}>
      {pending ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-warning/50 bg-warning/10 p-4">
            <p className="flex items-center gap-2 text-[15px] font-bold text-warning-text">
              <AlertTriangle className="size-5" /> {t.swapSheet.similarTitle}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t.swapSheet.similarBody(pending.e.name, pending.other)}
            </p>
          </div>
          <button
            onClick={() => onPick(pending.e)}
            className="glass min-h-[52px] w-full rounded-2xl text-[16px] font-semibold active:scale-95"
          >
            {t.swapSheet.keepSimilar}
          </button>
          <button
            onClick={() => setPending(null)}
            className="min-h-[44px] w-full text-[15px] font-semibold text-muted-foreground active:scale-95"
          >
            {t.swapSheet.backToList}
          </button>
        </div>
      ) : view === "menu" ? (
        <div className="space-y-2">
          {options.length
            ? choice(Shuffle, t.session.addAuto, t.session.addAutoHint, onAuto)
            : null}
          {options.length ? choice(Dumbbell, t.session.addPick, null, () => setView("pick")) : null}
          {choice(HeartPulse, t.session.addCardio, null, () => setView("cardio"))}
        </div>
      ) : view === "pick" ? (
        <div className="space-y-2">
          {suggested ? (
            <>
              <p className="text-[12px] font-bold uppercase tracking-widest text-primary-text">
                {t.session.addSuggested}
              </p>
              {row(suggested)}
            </>
          ) : null}
          {more.length ? (
            <>
              <p className="pt-3 text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.session.addMoreOptions}
              </p>
              {more.map(row)}
            </>
          ) : null}
          {back}
        </div>
      ) : (
        <div className="space-y-4">
          <ActivityPicker value={activity} onChange={setActivity} />
          <EffortPicker value={effort} onChange={setEffort} />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.session.addCardioMinutes}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    haptic(10);
                    addCardio(m);
                  }}
                  className={`tabular min-h-[44px] rounded-2xl text-[15px] font-semibold active:scale-95 ${chip.off}`}
                >
                  {t.cardio.min(m)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t.session.addCardioCustom}
                aria-label={t.session.addCardioCustom}
                className="min-h-[44px] min-w-0 flex-1 rounded-2xl bg-secondary px-4 text-[16px] text-secondary-foreground"
              />
              <button
                disabled={!customOk}
                onClick={() => addCardio(customMin)}
                className={`${button.primary} px-5 disabled:opacity-40`}
              >
                {t.session.addCardioAdd}
              </button>
            </div>
          </div>
          {back}
        </div>
      )}
    </BottomSheet>
  );
}
