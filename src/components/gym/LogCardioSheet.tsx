import { useEffect, useState } from "react";
import { dayKeyFromDate, addDays } from "../../lib/gym/date";
import { useTranslation } from "../../lib/gym/i18n";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";
import type { CardioActivity, CardioEffort } from "../../lib/gym/types";
import { BottomSheet } from "./BottomSheet";
import { ActivityPicker, EffortPicker } from "./CardioControls";
import { SessionRpePicker } from "./SessionRpePicker";

/** A typo guard for the minutes field (so "600" for 60 can't log ten hours),
 *  not a training number. */
const MAX_MINUTES = 360;

export interface CardioPreset {
  activity: CardioActivity;
  effort: CardioEffort;
  minutes: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Logs a cardio session by hand, for when there's no watch recording to
 * import. Prefilled from the plan when one is given. Done saves too (the
 * app's save-on-Done rule), but only once something was changed: a sheet
 * opened on a prefilled plan and closed straight away mustn't log a session
 * that didn't happen.
 */
export function LogCardioSheet({
  open,
  onClose,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  preset?: CardioPreset | null;
}) {
  const t = useTranslation();
  const { logCardio } = useGym();
  const [activity, setActivity] = useState<CardioActivity | null>(null);
  const [effort, setEffort] = useState<CardioEffort | null>(null);
  const [minutes, setMinutes] = useState("");
  const [distance, setDistance] = useState("");
  const [yesterday, setYesterday] = useState(false);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActivity(preset?.activity ?? null);
    setEffort(preset?.effort ?? null);
    setMinutes(preset ? String(preset.minutes) : "");
    setDistance("");
    setYesterday(false);
    setRpe(undefined);
    setTouched(false);
  }, [open, preset]);

  const mins = parseDecimal(minutes);
  const km = distance ? parseDecimal(distance) : null;
  const valid =
    activity != null &&
    effort != null &&
    Number.isFinite(mins) &&
    mins > 0 &&
    mins <= MAX_MINUTES &&
    (km == null || (Number.isFinite(km) && km >= 0));

  const touch = () => setTouched(true);

  const save = () => {
    if (!valid || !activity || !effort) return;
    const now = new Date();
    const day = yesterday ? addDays(now, -1) : now;
    const time = yesterday ? "12:00" : `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    logCardio({
      activity,
      effort,
      minutes: Math.round(mins),
      distanceKm: km && km > 0 ? km : null,
      start: `${dayKeyFromDate(day)}T${time}`,
      label: t.cardio.activities[activity],
      rpe: rpe ?? null,
    });
    haptic([20, 40, 20]);
    onClose();
  };

  const close = () => {
    if (touched && valid) save();
    else onClose();
  };

  const field =
    "tabular h-11 w-full rounded-xl bg-secondary px-3 text-[16px] font-semibold outline-none";

  return (
    <BottomSheet open={open} onClose={close} title={t.cardio.logTitle}>
      <div className="space-y-4">
        <ActivityPicker
          value={activity}
          onChange={(a) => {
            setActivity(a);
            touch();
          }}
        />
        <EffortPicker
          value={effort}
          onChange={(e) => {
            setEffort(e);
            touch();
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
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
                touch();
              }}
              aria-invalid={minutes !== "" && !(mins > 0 && mins <= MAX_MINUTES)}
              className={`${field} ${
                minutes !== "" && !(mins > 0 && mins <= MAX_MINUTES)
                  ? "ring-2 ring-destructive"
                  : ""
              }`}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold text-muted-foreground">
              {t.cardio.distance} <span className="font-normal">({t.cardio.distanceHint})</span>
            </span>
            <input
              inputMode="decimal"
              type="text"
              value={distance}
              onFocus={selectOnFocus}
              onChange={(e) => {
                if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
                setDistance(e.target.value);
                touch();
              }}
              className={field}
            />
          </label>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.when}</p>
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((y) => (
              <button
                key={String(y)}
                type="button"
                aria-pressed={yesterday === y}
                onClick={() => {
                  setYesterday(y);
                  touch();
                }}
                className={`min-h-[40px] rounded-2xl text-[13.5px] font-semibold active:scale-95 ${
                  yesterday === y
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {y ? t.cardio.yesterday : t.cardio.today}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-semibold text-muted-foreground">{t.cardio.rpe}</p>
          <SessionRpePicker
            value={rpe}
            onChange={(n) => {
              setRpe(n);
              touch();
            }}
          />
        </div>
        <button
          type="button"
          disabled={!valid}
          onClick={save}
          className="glow flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40 disabled:shadow-none"
        >
          {t.cardio.save}
        </button>
      </div>
    </BottomSheet>
  );
}
