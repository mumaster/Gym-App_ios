import { ChevronDown, Dumbbell, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  SAME_DAY_GAP_HOURS,
  WHO_WEEKLY_MINUTES,
  plannedWhoMinutes,
  sortCardioPlan,
} from "../../lib/gym/cardio";
import { useTranslation } from "../../lib/gym/i18n";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";
import type { CardioPlanDay } from "../../lib/gym/types";
import { BottomSheet } from "./BottomSheet";
import { ActivityPicker, EffortPicker } from "./CardioControls";
import { CARDIO_ICONS } from "./cardioDisplay";
import { chip } from "./ui";

/** Monday-first weekdays, as Date#getDay values. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Same typo guard as the log sheet — not a training number. */
const MAX_MINUTES = 360;

/**
 * The weekly cardio plan: fixed weekdays, each with an activity, minutes
 * and effort. Changes apply straight away (like adjusting the week), so
 * Done just closes. A day that's also a strength day gets the one sourced
 * piece of advice about combining them (see cardio.ts).
 */
export function CardioPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const { cardioPlan, setCardioPlan, program, weeklyScheme } = useGym();
  const [editing, setEditing] = useState<string | null>(null);
  const strengthDows = new Set((program ?? weeklyScheme)?.schedule.map((s) => s.dow) ?? []);

  useEffect(() => {
    if (open) setEditing(null);
  }, [open]);

  const total = Math.round(plannedWhoMinutes(cardioPlan));
  const pct = Math.min(1, total / WHO_WEEKLY_MINUTES);

  const change = (id: string, patch: Partial<CardioPlanDay>) =>
    setCardioPlan(cardioPlan.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const add = () => {
    const used = new Set(cardioPlan.map((d) => d.dow));
    // First weekday with neither cardio nor strength, else any without cardio.
    const dow =
      WEEK.find((d) => !used.has(d) && !strengthDows.has(d)) ??
      WEEK.find((d) => !used.has(d)) ??
      WEEK[0]!;
    const day: CardioPlanDay = {
      id: crypto.randomUUID(),
      dow,
      activity: "run",
      effort: "moderate",
      minutes: 30,
    };
    haptic(15);
    setCardioPlan(sortCardioPlan([...cardioPlan, day]));
    setEditing(day.id);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t.cardio.planTitle}>
      <p className="text-[13.5px] text-muted-foreground">{t.cardio.planIntro}</p>

      <div className="mt-3 rounded-2xl bg-foreground/[0.05] p-3">
        <p className="tabular text-[13.5px] font-semibold">
          {t.cardio.planTotal(total, WHO_WEEKLY_MINUTES)}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{t.cardio.explain}</p>
      </div>

      <div className="mt-4 space-y-2">
        {cardioPlan.map((d) => {
          const Icon = CARDIO_ICONS[d.activity];
          const open = editing === d.id;
          const sameDay = strengthDows.has(d.dow);
          return (
            <div key={d.id} className="rounded-2xl bg-foreground/[0.05]">
              <button
                type="button"
                onClick={() => setEditing(open ? null : d.id)}
                aria-expanded={open}
                className="flex min-h-[56px] w-full items-center gap-3 px-3 text-left"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {t.common.dow[d.dow]} · {t.cardio.activities[d.activity]}
                  </span>
                  <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
                    {t.cardio.min(d.minutes)} · {t.cardio.efforts[d.effort]}
                    {sameDay ? (
                      <>
                        {" · "}
                        <Dumbbell className="size-3" /> {t.cardio.alsoStrength}
                      </>
                    ) : null}
                  </span>
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open ? (
                <PlanDayEditor
                  day={d}
                  sameDay={sameDay}
                  onChange={(patch) => change(d.id, patch)}
                  onRemove={() => {
                    haptic(15);
                    setCardioPlan(cardioPlan.filter((x) => x.id !== d.id));
                    setEditing(null);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
      >
        <Plus className="size-4" /> {t.cardio.addSession}
      </button>
    </BottomSheet>
  );
}

function PlanDayEditor({
  day,
  sameDay,
  onChange,
  onRemove,
}: {
  day: CardioPlanDay;
  sameDay: boolean;
  onChange: (patch: Partial<CardioPlanDay>) => void;
  onRemove: () => void;
}) {
  const t = useTranslation();
  const [minutes, setMinutes] = useState(String(day.minutes));
  const mins = parseDecimal(minutes);
  const bad = !(mins > 0 && mins <= MAX_MINUTES);
  return (
    <div className="space-y-4 px-3 pb-3 pt-1">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.day}</p>
        <div className="grid grid-cols-7 gap-1">
          {WEEK.map((dow) => (
            <button
              key={dow}
              type="button"
              aria-pressed={day.dow === dow}
              aria-label={t.common.dow[dow]}
              onClick={() => {
                haptic(10);
                onChange({ dow });
              }}
              className={`min-h-[40px] rounded-xl text-[13px] font-bold active:scale-95 ${
                day.dow === dow ? chip.on : "bg-secondary text-secondary-foreground"
              }`}
            >
              {t.common.dow[dow]}
            </button>
          ))}
        </div>
        {sameDay ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {t.cardio.sameDayHint(SAME_DAY_GAP_HOURS)}
          </p>
        ) : null}
      </div>
      <ActivityPicker value={day.activity} onChange={(activity) => onChange({ activity })} />
      <EffortPicker value={day.effort} onChange={(effort) => onChange({ effort })} />
      <div className="flex items-end gap-3">
        <label className="block flex-1">
          <span className="mb-2 block text-[13px] font-semibold text-muted-foreground">
            {t.cardio.minutes}
          </span>
          <input
            inputMode="numeric"
            type="text"
            value={minutes}
            onFocus={selectOnFocus}
            onChange={(e) => {
              if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
              setMinutes(e.target.value);
              const n = parseDecimal(e.target.value);
              if (n > 0 && n <= MAX_MINUTES) onChange({ minutes: Math.round(n) });
            }}
            aria-invalid={bad}
            className={`tabular h-11 w-full rounded-xl bg-secondary px-3 text-[16px] font-semibold outline-none ${
              bad ? "ring-2 ring-destructive" : ""
            }`}
          />
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t.cardio.remove}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-destructive/15 px-3 text-[13.5px] font-bold text-destructive-text active:scale-95"
        >
          <Trash2 className="size-4" /> {t.cardio.remove}
        </button>
      </div>
    </div>
  );
}
