import { Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useExerciseCatalog } from "../../lib/gym/catalog";
import { exerciseById } from "../../lib/gym/data";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { noteMoves, sessionsOf } from "../../lib/gym/moveExercise";
import { haptic, useGym } from "../../lib/gym/store";
import { BottomSheet } from "./BottomSheet";
import { SearchField } from "./SearchField";
import { button } from "./ui";

const LIST_LIMIT = 8;

type Step = "pick" | "confirm" | "done";

/**
 * Settings → Move logged data: sets logged under the wrong exercise move to
 * the right one. Pick the exercise, tick the sessions (all by default), pick
 * the target, check the summary, then move. See lib/gym/moveExercise.ts.
 */
export function MoveDataSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const locale = useLocale();
  const { workouts, exerciseNotes, moveExerciseData: move } = useGym();
  const catalog = useExerciseCatalog();
  const [step, setStep] = useState<Step>("pick");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [movedSets, setMovedSets] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setFrom(null);
    setTo(null);
    setSkipped(new Set());
    setQuery("");
  }, [open]);

  const name = (id: string) => exerciseById(id)?.name ?? id;

  const logged = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts)
      for (const s of w.completed_sets)
        counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, sets]) => ({ id, sets, name: exerciseById(id)?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts]);

  const sessions = useMemo(() => (from ? sessionsOf(workouts, from) : []), [workouts, from]);
  const chosen = useMemo(
    () => new Set(sessions.filter((s) => !skipped.has(s.workoutId)).map((s) => s.workoutId)),
    [sessions, skipped],
  );
  const chosenSets = sessions
    .filter((s) => chosen.has(s.workoutId))
    .reduce((n, s) => n + s.sets, 0);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (n: string) => words.every((w) => n.toLowerCase().includes(w));
  const fromChoices = logged.filter((e) => matches(e.name)).slice(0, LIST_LIMIT + 22);
  const toChoices = useMemo(
    () =>
      catalog
        .filter((e) => e.id !== from && matches(e.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, LIST_LIMIT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, from, query],
  );

  const toggle = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const ready = !!from && !!to && chosen.size > 0;
  const noteGoesAlong = ready && noteMoves({ workouts, exerciseNotes }, from!, to!, chosen);

  const doMove = () => {
    if (!ready) return;
    haptic(20);
    setMovedSets(chosenSets);
    move(from!, to!, chosen);
    setStep("done");
  };

  const picker = (
    items: { id: string; name: string; sets?: number }[],
    onPick: (id: string) => void,
  ) =>
    items.length ? (
      <div className="overflow-hidden rounded-2xl bg-muted">
        {items.map((e, i) => (
          <button
            key={e.id}
            onClick={() => {
              haptic(10);
              setQuery("");
              onPick(e.id);
            }}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-foreground/5 ${
              i ? "border-t border-border" : ""
            }`}
          >
            <span className="min-w-0 truncate text-[15px] font-medium">{e.name}</span>
            {e.sets != null ? (
              <span className="tabular shrink-0 text-[12.5px] text-muted-foreground">
                {t.moveData.sets(e.sets)}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    ) : (
      <p className="py-3 text-center text-[13px] text-muted-foreground">
        {logged.length || from ? t.moveData.noMatch : t.moveData.noLogged}
      </p>
    );

  const pickedRow = (id: string, onChange: () => void) => (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3">
      <p className="min-w-0 truncate text-[15px] font-semibold">{name(id)}</p>
      <button onClick={onChange} className="shrink-0 text-[13px] font-semibold text-primary-text">
        {t.moveData.change}
      </button>
    </div>
  );

  const label = (s: string) => (
    <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {s}
    </p>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t.moveData.title}>
      {step === "done" ? (
        <div className="py-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden className="size-6" />
          </span>
          <p className="text-[16px] font-semibold">{t.moveData.done(movedSets, name(to!))}</p>
          <button onClick={onClose} className={`${button.primary} mt-6 w-full`}>
            {t.common.done}
          </button>
        </div>
      ) : step === "confirm" && ready ? (
        <div>
          <p className="mb-2 text-[17px] font-bold">{t.moveData.confirmTitle}</p>
          <p className="text-[14px] leading-snug text-muted-foreground">
            {t.moveData.confirmBody(chosen.size, chosenSets, name(from!), name(to!))}
          </p>
          {noteGoesAlong ? (
            <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
              {t.moveData.noteMoves(name(from!), name(to!))}
            </p>
          ) : null}
          <button onClick={doMove} className={`${button.primary} mt-5 w-full`}>
            {t.moveData.move}
          </button>
          <button onClick={() => setStep("pick")} className={`${button.secondary} mt-2 w-full`}>
            {t.moveData.back}
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-[13.5px] leading-snug text-muted-foreground">
            {t.moveData.intro}
          </p>

          {label(t.moveData.fromStep)}
          {from ? (
            pickedRow(from, () => {
              setFrom(null);
              setSkipped(new Set());
            })
          ) : (
            <>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={t.moveData.search}
                className="mb-2"
              />
              <p className="mb-1.5 text-[12px] text-muted-foreground">{t.moveData.pickFrom}</p>
              {picker(fromChoices, (id) => {
                setFrom(id);
                if (to === id) setTo(null);
              })}
            </>
          )}

          {from ? (
            <>
              <div className="mb-2 mt-5 flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.moveData.sessionsTitle}
                </p>
                <div className="flex gap-4 text-[13px] font-semibold text-primary-text">
                  <button onClick={() => setSkipped(new Set())}>{t.moveData.all}</button>
                  <button onClick={() => setSkipped(new Set(sessions.map((s) => s.workoutId)))}>
                    {t.moveData.none}
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl bg-muted">
                {sessions.map((s, i) => {
                  const on = chosen.has(s.workoutId);
                  return (
                    <button
                      key={s.workoutId}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => {
                        haptic(8);
                        toggle(s.workoutId);
                      }}
                      className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-foreground/5 ${
                        i ? "border-t border-border" : ""
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                          on
                            ? "bg-primary text-primary-foreground"
                            : "ring-1 ring-inset ring-foreground/25"
                        }`}
                      >
                        {on ? <Check aria-hidden className="size-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-medium">
                        {dateLabel(s.date)}
                      </span>
                      <span className="tabular shrink-0 text-[12.5px] text-muted-foreground">
                        {t.moveData.sets(s.sets)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {label(t.moveData.toStep)}
              {to ? (
                pickedRow(to, () => setTo(null))
              ) : (
                <>
                  <SearchField
                    value={query}
                    onChange={setQuery}
                    placeholder={t.moveData.search}
                    className="mb-2"
                  />
                  <p className="mb-1.5 text-[12px] text-muted-foreground">{t.moveData.pickTo}</p>
                  {picker(
                    toChoices.map((e) => ({ id: e.id, name: e.name })),
                    setTo,
                  )}
                </>
              )}

              <button
                onClick={() => {
                  haptic(12);
                  setStep("confirm");
                }}
                disabled={!ready}
                className={`${button.primary} mt-5 w-full`}
              >
                {t.moveData.review}
              </button>
            </>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}
