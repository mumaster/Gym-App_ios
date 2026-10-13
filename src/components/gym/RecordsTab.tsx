import { useMemo, useState } from "react";
import { ChevronRight, Info, TrendingUp, Trophy } from "lucide-react";
import { exerciseById } from "../../lib/gym/data";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { formatLoad, isBodyweightExercise, latestBodyKg } from "../../lib/gym/load";
import {
  exerciseRecords,
  monthlyStrengthScores,
  strengthScore,
  type ExerciseRecords,
  type PrEvent,
} from "../../lib/gym/records";
import { useGym } from "../../lib/gym/store";
import type { Workout } from "../../lib/gym/types";
import { BottomSheet } from "./BottomSheet";
import { CardHead } from "./CardHead";
import { ExerciseProgressChart } from "./ExerciseProgressChart";
import { ListCard } from "./ListCard";
import { Card, SectionLabel } from "./Screen";
import { button } from "./ui";

/** A record set this recently still gets the "New" pill. */
const NEW_PR_DAYS = 7;

const isBw = (id: string) => isBodyweightExercise(exerciseById(id));

/** An estimate in the app's locale ("107,7 kg" in Dutch). */
const kgText = (kg: number, locale: string) =>
  `${kg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg`;

/** The strength score's monthly bars, in the house bar style (DESIGN.md §7):
 *  the grey track is the 100 baseline; up to 100 the score is an
 *  `intake-fill` pill, above it one whole `bg-primary` pill with an opaque
 *  `intake-solid` pill over it up to 100 (same as `DayBars`). */
function ScoreBars({ months }: { months: { month: Date; score: number | null }[] }) {
  const t = useTranslation();
  const locale = useLocale();
  const scale = Math.max(100, ...months.map((m) => m.score ?? 0));
  return (
    <ul className="grid grid-cols-6 gap-1">
      {months.map(({ month, score }) => {
        const total = score ?? 0;
        const height = Math.max(100, total);
        const over = total > 100;
        const name = month.toLocaleDateString(locale, { month: "short" });
        return (
          <li
            key={month.getTime()}
            aria-label={t.records.monthAria(name, score)}
            className="flex flex-col items-center"
          >
            <div className="flex h-28 w-full items-end justify-center" aria-hidden>
              <div
                className="relative w-5"
                style={{ height: `${Math.max(4, (height / scale) * 100)}%` }}
              >
                <span
                  className="absolute inset-x-0 bottom-0 rounded-full bg-foreground/10"
                  style={{ height: `${(100 / height) * 100}%` }}
                />
                {total > 0 && over ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-primary" />
                    <span
                      className="intake-solid absolute inset-x-0 bottom-0 rounded-full"
                      style={{ height: `${(100 / total) * 100}%` }}
                    />
                  </>
                ) : null}
                {total > 0 && !over ? (
                  <span
                    className="intake-fill absolute inset-x-0 bottom-0 rounded-full"
                    style={{ height: `${Math.max(4, (total / height) * 100)}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="tabular mt-1.5 h-4 text-[11px] font-semibold leading-4">
              {score == null ? "–" : score}
            </span>
            <span className="text-[10px] uppercase leading-4 text-muted-foreground" aria-hidden>
              {name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StrengthScoreCard({ workouts, bodyKg }: { workouts: Workout[]; bodyKg: number | null }) {
  const t = useTranslation();
  const [info, setInfo] = useState(false);
  const score = useMemo(() => strengthScore(workouts, isBw, bodyKg), [workouts, bodyKg]);
  const months = useMemo(
    () => monthlyStrengthScores(workouts, isBw, bodyKg, 6),
    [workouts, bodyKg],
  );
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={TrendingUp}
        title={t.records.scoreTitle}
        subtitle={score ? t.records.scoreSub(score.exercises) : undefined}
        filled={!!score}
        actions={
          <button
            onClick={() => setInfo((v) => !v)}
            aria-label={t.records.scoreInfoAria}
            aria-expanded={info}
            className={button.icon}
          >
            <Info className="size-4" aria-hidden />
          </button>
        }
      />
      {info ? (
        <p className="mb-3 text-[12.5px] text-muted-foreground">{t.records.scoreInfo}</p>
      ) : null}
      {score ? (
        <>
          <p className="tabular text-[30px] font-bold leading-none">{score.score}</p>
          <p className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
            {t.records.scoreLine(score.score)}
          </p>
          <ScoreBars months={months} />
          <p className="mt-3 text-[12px] text-muted-foreground">{t.records.chartNote}</p>
        </>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t.records.scoreEmpty}</p>
      )}
    </Card>
  );
}

function RecordRow({
  rec,
  first,
  onOpen,
}: {
  rec: ExerciseRecords;
  first: boolean;
  onOpen: () => void;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const bwLabel = t.session.bw;
  const load = (kg: number) => formatLoad(kg, rec.bodyweight, bwLabel);
  const recent =
    rec.lastPr != null && Date.now() - Date.parse(rec.lastPr) <= NEW_PR_DAYS * 86_400_000;
  const parts: string[] = [];
  if (rec.best.e1rm != null) {
    parts.push(`${t.records.bestE1rm} ${kgText(rec.best.e1rm, locale)}`);
  } else {
    parts.push(`${t.records.bestSet} ${load(rec.best.weight)} × ${rec.best.reps}`);
  }
  if (rec.heaviest)
    parts.push(`${t.records.heaviest} ${load(rec.heaviest.weight)} × ${rec.heaviest.reps}`);
  return (
    <button
      onClick={onOpen}
      aria-label={t.records.rowAria(rec.name)}
      className={`flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.985] active:bg-foreground/5 ${
        first ? "" : "border-t border-border"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{rec.name}</span>
          {recent ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-text">
              {t.records.newPr}
            </span>
          ) : null}
        </span>
        <span className="tabular block text-[12.5px] text-muted-foreground">
          {parts.join(" · ")}
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function HistoryRow({ ev, rec, first }: { ev: PrEvent; rec: ExerciseRecords; first: boolean }) {
  const t = useTranslation();
  const locale = useLocale();
  const load = (kg: number) => formatLoad(kg, rec.bodyweight, t.session.bw);
  const tag =
    "tabular rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-text";
  return (
    <li className={`px-4 py-3 ${first ? "" : "border-t border-border"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          {new Date(ev.date).toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="tabular text-[15px] font-semibold">
          {load(ev.weight)} × {ev.reps}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ev.first ? (
          <span className="text-[12.5px] text-muted-foreground">{t.records.firstSession}</span>
        ) : null}
        {ev.kinds.includes("e1rm") && ev.e1rm != null ? (
          <span className={tag}>
            {t.records.kindE1rm} {kgText(ev.e1rm, locale)}
          </span>
        ) : null}
        {ev.kinds.includes("heaviest") && ev.heaviest ? (
          <span className={tag}>
            {t.records.kindHeaviest} {load(ev.heaviest.weight)} × {ev.heaviest.reps}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function RecordSheet({ rec, onClose }: { rec: ExerciseRecords | null; onClose: () => void }) {
  const t = useTranslation();
  const locale = useLocale();
  const load = (kg: number) => formatLoad(kg, rec?.bodyweight ?? false, t.session.bw);
  const prCount = rec ? rec.history.filter((h) => !h.first).length : 0;
  return (
    <BottomSheet open={!!rec} onClose={onClose} title={rec?.name ?? ""}>
      {rec ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-foreground/5 p-3">
              <p className="text-[12px] text-muted-foreground">
                {rec.best.e1rm != null ? t.records.bestE1rm : t.records.bestSet}
              </p>
              <p className="tabular text-[20px] font-bold">
                {rec.best.e1rm != null ? kgText(rec.best.e1rm, locale) : load(rec.best.weight)}
              </p>
              <p className="tabular text-[12.5px] text-muted-foreground">
                {load(rec.best.weight)} × {rec.best.reps}
              </p>
            </div>
            <div className="rounded-lg bg-foreground/5 p-3">
              <p className="text-[12px] text-muted-foreground">{t.records.heaviest}</p>
              <p className="tabular text-[20px] font-bold">
                {rec.heaviest ? load(rec.heaviest.weight) : "–"}
              </p>
              {rec.heaviest ? (
                <p className="tabular text-[12.5px] text-muted-foreground">
                  {load(rec.heaviest.weight)} × {rec.heaviest.reps}
                </p>
              ) : null}
            </div>
          </div>
          {rec.sessions >= 2 ? (
            <div className="mt-4">
              <ExerciseProgressChart exerciseId={rec.exercise_id} />
            </div>
          ) : null}
          <SectionLabel>
            {t.records.historyTitle} · {t.records.historyCount(prCount)}
          </SectionLabel>
          <ul className="glass overflow-hidden rounded-2xl">
            {rec.history.map((ev, i) => (
              <HistoryRow key={ev.date} ev={ev} rec={rec} first={i === 0} />
            ))}
          </ul>
        </>
      ) : null}
    </BottomSheet>
  );
}

/** History's Records tab: the strength score and every exercise's records,
 *  each opening its record history in a sheet. `workouts` and `openId` are
 *  props so it can be rendered on its own (tests). */
export function RecordsTab({
  workouts,
  openId = null,
}: {
  workouts?: Workout[];
  openId?: string | null;
}) {
  const gym = useGym();
  const t = useTranslation();
  const all = workouts ?? gym.workouts;
  const bodyKg = latestBodyKg(gym.weightLog, gym.nutritionProfile);
  const records = useMemo(() => exerciseRecords(all, isBw, bodyKg), [all, bodyKg]);
  const [openedId, setOpenedId] = useState<string | null>(openId);
  const open = records.find((r) => r.exercise_id === openedId) ?? null;

  if (!all.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[14px] text-muted-foreground">{t.records.empty}</p>
      </Card>
    );
  }
  return (
    <>
      <StrengthScoreCard workouts={all} bodyKg={bodyKg} />
      <div className="mt-4">
        <ListCard
          icon={Trophy}
          title={t.records.listTitle}
          subtitle={t.records.listSub(records.length)}
          filled={records.length > 0}
        >
          {records.map((rec, i) => (
            <RecordRow
              key={rec.exercise_id}
              rec={rec}
              first={i === 0}
              onOpen={() => setOpenedId(rec.exercise_id)}
            />
          ))}
        </ListCard>
      </div>
      <RecordSheet rec={open} onClose={() => setOpenedId(null)} />
    </>
  );
}
