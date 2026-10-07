import { PieChart } from "lucide-react";
import type { BodyComposition } from "../../lib/gym/bodyweight";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import {
  COMPOSITION_FIELDS,
  compositionAt,
  compositionChange,
  type CompositionField,
} from "../../lib/gym/scale";
import { useGym } from "../../lib/gym/store";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";

/**
 * The body composition a smart scale printed with a weigh-in (imported
 * from a screenshot, ScaleImportSheet), on Nutrition → Weight under the
 * bodyweight card: the latest reading on or before the picked day, each
 * value with its change since the reading before. Numbers are the scale's,
 * shown as printed; none of them feeds anything else, and changes aren't
 * coloured, since the app has no source for which way is "good" for each.
 * Hidden until a reading with composition exists.
 */
export function BodyCompositionCard({ dayKey }: { dayKey: string }) {
  const t = useTranslation();
  const locale = useLocale();
  const { weightLog } = useGym();
  const at = compositionAt(weightLog, dayKey);
  if (!at) return null;
  const { entry, previous } = at;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const kg = `${entry.kg.toLocaleString(locale, { maximumFractionDigits: 2 })} kg`;
  return (
    <Card className="mt-4 overflow-hidden p-4">
      <CardHead
        icon={PieChart}
        title={t.scale.title}
        subtitle={[date(entry.date), kg, entry.source].filter(Boolean).join(" · ")}
      />
      <div className="space-y-3">
        {previous ? (
          <p className="text-[12.5px] text-muted-foreground">
            {t.scale.since(date(previous.date))}
          </p>
        ) : null}
        <CompositionGrid composition={entry.composition!} previous={previous?.composition} />
        <p className="text-[12.5px] leading-snug text-muted-foreground">{t.scale.note}</p>
      </div>
    </Card>
  );
}

/** The composition as two columns of tiles (label, value and unit, and the
 *  change since `previous` when given), then any other printed metrics as
 *  label/value lines. Shared by the card and the import sheet's review. */
export function CompositionGrid({
  composition,
  previous,
}: {
  composition: BodyComposition;
  previous?: BodyComposition | undefined;
}) {
  const t = useTranslation();
  const locale = useLocale();
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const unit = (field: CompositionField) =>
    field.endsWith("Pct")
      ? "%"
      : field.endsWith("Kg")
        ? "kg"
        : field === "visceralFat"
          ? t.scale.level
          : field === "bmrKcal"
            ? t.scale.kcalDay
            : field === "metabolicAge"
              ? t.scale.years
              : "";
  const fields = COMPOSITION_FIELDS.filter((f) => composition[f] != null);
  return (
    <>
      {fields.length ? (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((field) => {
            const change = previous ? compositionChange(composition, previous, field) : null;
            return (
              <div key={field} className="min-w-0 rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="truncate text-[12px] font-semibold text-muted-foreground">
                  {t.scale.fields[field]}
                </p>
                <p className="tabular mt-0.5 truncate text-[20px] font-bold leading-tight">
                  {num(composition[field]!)}
                  {unit(field) ? (
                    <span className="ml-1 text-[12px] font-medium text-muted-foreground">
                      {unit(field)}
                    </span>
                  ) : null}
                </p>
                {change != null ? (
                  <p className="tabular mt-0.5 text-[12px] text-muted-foreground">
                    {change > 0 ? "+" : change < 0 ? "−" : "±"}
                    {num(Math.abs(change))}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {composition.other?.length ? (
        <div className="divide-y divide-border">
          {composition.other.map((m, i) => (
            <p key={i} className="flex justify-between gap-3 py-2 text-[14px]">
              <span className="min-w-0 text-muted-foreground">{m.label}</span>
              <span className="tabular shrink-0 font-semibold">
                {m.value}
                {m.unit ? ` ${m.unit}` : ""}
              </span>
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
