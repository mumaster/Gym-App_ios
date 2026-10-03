import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useExerciseCatalog } from "../../lib/gym/catalog";
import { exerciseById } from "../../lib/gym/data";
import { popularityOf } from "../../lib/gym/exercisePopularity";
import { availableExercises } from "../../lib/gym/generator";
import { useTranslation } from "../../lib/gym/i18n";
import { isBodyweightExercise } from "../../lib/gym/load";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import type { KnownLift } from "../../lib/gym/startWeight";
import { haptic, useGym } from "../../lib/gym/store";
import type { Exercise } from "../../lib/gym/types";
import { BottomSheet } from "./BottomSheet";
import { chip } from "./ui";

/** Typo guards, not training numbers. */
const MAX_KG = 500;
const MAX_REPS = 30;
const LIST_LIMIT = 8;

const perDumbbell = (e: Exercise) =>
  !e.equipment_required.includes("barbell") &&
  (e.equipment_required.includes("dumbbell") || e.equipment_required.includes("kettlebell"));

/**
 * Settings → Your current lifts: for someone who already trains, a recent
 * set for a few exercises, so the first plans start from real weights
 * (startWeight.ts's KnownLift). Entries change straight away; a filled-in
 * form is added on Done too (the save-on-Done rule).
 */
export function KnownLiftsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const { knownLifts, update, workouts, profiles, activeProfileId } = useGym();
  const catalog = useExerciseCatalog();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);

  const reset = () => {
    setQuery("");
    setPicked(null);
    setWeight("");
    setReps("");
    setRpe(null);
  };
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const logged = useMemo(
    () => new Set(workouts.flatMap((w) => w.completed_sets.map((s) => s.exercise_id))),
    [workouts],
  );

  const choices = useMemo(() => {
    const entered = new Set(knownLifts.map((l) => l.exercise_id));
    const byPopularity = (a: Exercise, b: Exercise) => popularityOf(b.id) - popularityOf(a.id);
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      return catalog
        .filter((e) => !isBodyweightExercise(e) && !entered.has(e.id))
        .filter((e) => words.every((w) => e.name.toLowerCase().includes(w)))
        .sort(byPopularity)
        .slice(0, LIST_LIMIT);
    }
    // Nothing typed: the big compound lifts your equipment allows.
    return availableExercises(profile?.active_equipment_ids ?? [])
      .filter((e) => e.compound && !isBodyweightExercise(e) && !entered.has(e.id))
      .sort(byPopularity)
      .slice(0, LIST_LIMIT);
  }, [query, catalog, knownLifts, profile]);

  const kg = parseDecimal(weight);
  const n = parseDecimal(reps);
  const valid =
    !!picked && kg > 0 && kg <= MAX_KG && Number.isInteger(n) && n >= 1 && n <= MAX_REPS;

  const add = () => {
    if (!picked || !valid) return;
    const lift: KnownLift = {
      exercise_id: picked.id,
      weight: kg,
      reps: n,
      ...(rpe != null ? { rpe } : {}),
      date: new Date().toISOString(),
    };
    update({ knownLifts: [...knownLifts.filter((l) => l.exercise_id !== picked.id), lift] });
    reset();
  };

  const close = () => {
    if (valid) add();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title={t.knownLifts.title}>
      <p className="mb-4 text-[13.5px] leading-snug text-muted-foreground">{t.knownLifts.intro}</p>

      {knownLifts.length ? (
        <div className="mb-5 overflow-hidden rounded-2xl bg-muted">
          {knownLifts.map((l, i) => {
            const e = exerciseById(l.exercise_id);
            return (
              <div
                key={l.exercise_id}
                className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-border" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{e?.name ?? l.exercise_id}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {t.knownLifts.set(l.weight, l.reps, l.rpe ?? null, !!e && perDumbbell(e))}
                    {logged.has(l.exercise_id) ? ` · ${t.knownLifts.loggedNow}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    haptic(10);
                    update({
                      knownLifts: knownLifts.filter((x) => x.exercise_id !== l.exercise_id),
                    });
                  }}
                  aria-label={t.knownLifts.remove(e?.name ?? l.exercise_id)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t.knownLifts.addTitle}
      </p>

      {picked ? (
        <div className="rounded-2xl bg-muted p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[15px] font-semibold">{picked.name}</p>
            <button
              onClick={() => setPicked(null)}
              className="shrink-0 text-[13px] font-semibold text-primary-text"
            >
              {t.knownLifts.change}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                {perDumbbell(picked) ? t.knownLifts.kgPerDumbbell : t.knownLifts.kg}
              </span>
              <input
                inputMode="decimal"
                type="text"
                value={weight}
                onFocus={selectOnFocus}
                onChange={(e) => DECIMAL_INPUT_RE.test(e.target.value) && setWeight(e.target.value)}
                className="tabular h-12 w-full rounded-xl bg-background px-3 text-center text-[16px] font-bold outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                {t.knownLifts.reps}
              </span>
              <input
                inputMode="numeric"
                type="text"
                value={reps}
                onFocus={selectOnFocus}
                onChange={(e) => /^\d*$/.test(e.target.value) && setReps(e.target.value)}
                className="tabular h-12 w-full rounded-xl bg-background px-3 text-center text-[16px] font-bold outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <p className="mb-1.5 mt-3 text-[12px] text-muted-foreground">{t.knownLifts.rpe}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                onClick={() => setRpe((r) => (r === v ? null : v))}
                aria-pressed={rpe === v}
                className={`tabular h-10 rounded-xl text-[15px] font-bold active:scale-95 ${
                  rpe === v ? chip.on : "bg-background text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              haptic(12);
              add();
            }}
            disabled={!valid}
            className="mt-4 h-12 w-full rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-40"
          >
            {t.knownLifts.add}
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.knownLifts.search}
              className="h-11 w-full rounded-xl bg-muted pl-9 pr-3 text-[16px] outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {!query.trim() ? (
            <p className="mb-1.5 text-[12px] text-muted-foreground">{t.knownLifts.popular}</p>
          ) : null}
          {choices.length ? (
            <div className="overflow-hidden rounded-2xl bg-muted">
              {choices.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => {
                    haptic(10);
                    setPicked(e);
                    setWeight("");
                    setReps("");
                    setRpe(null);
                  }}
                  className={`block w-full px-4 py-3 text-left text-[15px] font-medium active:bg-foreground/5 ${
                    i ? "border-t border-border" : ""
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-3 text-center text-[13px] text-muted-foreground">
              {t.knownLifts.noMatch}
            </p>
          )}
        </>
      )}
    </BottomSheet>
  );
}
