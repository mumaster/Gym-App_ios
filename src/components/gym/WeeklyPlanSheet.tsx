import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { DayTypePicker } from "./DayTypePicker";
import { useTranslation } from "../../lib/gym/i18n";
import {
  DOW_DISPLAY_ORDER,
  SPLIT_TEMPLATES,
  applyDayPicks,
  distinctDays,
  buildSchedule,
  initialCyclePosition,
  splitDayLabel,
  splitTemplateById,
  templateCardio,
  templateHasCardio,
  withSeparateCardioDays,
  type SplitTemplateId,
} from "../../lib/gym/splits";
import { anchorFor } from "../../lib/gym/schedule";
import { haptic, useGym } from "../../lib/gym/store";
import { button, chip } from "./ui";
import { GrowthFocusSection } from "./WeeklyVolume";
import type { FocusGroup } from "../../lib/gym/volume";
import type { CardioFinisher } from "../../lib/gym/types";
import { HybridCardioSection } from "./HybridCardioSection";

/** A sane default spread of weekdays for a given training frequency. */
const EVEN_SPREAD: Record<number, number[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

type Mode = "manage" | "template" | "days";

export function WeeklyPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    weeklyScheme,
    setWeeklyScheme,
    updateScheduleSlotDow,
    updateScheduleSlotDay,
    clearWeeklyScheme,
    growthFocus,
    cardioPlan,
    setCardioPlan,
    update,
  } = useGym();
  const t = useTranslation();
  const [mode, setMode] = useState<Mode>("template");
  const [templateId, setTemplateId] = useState<SplitTemplateId>("upper_lower");
  const [dows, setDows] = useState<number[]>(EVEN_SPREAD[4]!);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  // Day type picked per weekday while building (overrides the split's own order).
  const [dayPicks, setDayPicks] = useState<Record<number, string>>({});
  // Muscles to grow, picked while setting up a plan and saved with it.
  const [focusDraft, setFocusDraft] = useState<FocusGroup[]>(growthFocus);
  // Cardio after the lifting, per day, for a hybrid split.
  const [cardioDraft, setCardioDraft] = useState<Record<string, CardioFinisher>>({});
  // Read through a ref so the draft resets when the sheet opens, not on
  // every change made from its manage view.
  const focusRef = useRef(growthFocus);
  focusRef.current = growthFocus;

  useEffect(() => {
    if (!open) return;
    setEditingSlot(null);
    setDayPicks({});
    setFocusDraft(focusRef.current);
    setMode(weeklyScheme ? "manage" : "template");
  }, [open, weeklyScheme]);

  const pickTemplate = (id: SplitTemplateId) => {
    haptic(15);
    setTemplateId(id);
    setDayPicks({});
    setCardioDraft(templateCardio(id));
    setDows(EVEN_SPREAD[splitTemplateById(id).suggestedDaysPerWeek] ?? EVEN_SPREAD[3]!);
    setMode("days");
  };

  const toggleDow = (dow: number) => {
    haptic(10);
    setDows((cur) =>
      cur.includes(dow) ? cur.filter((d) => d !== dow) : [...cur, dow].sort((a, b) => a - b),
    );
  };

  const preview = applyDayPicks(templateId, buildSchedule(templateId, dows), dayPicks);
  const template = splitTemplateById(templateId);

  const save = () => {
    if (!preview.length) return;
    haptic([20, 30]);
    const cyclePosition = initialCyclePosition(preview);
    setWeeklyScheme({
      templateId,
      schedule: preview,
      cyclePosition,
      anchor: anchorFor(preview, cyclePosition),
      ...(templateHasCardio(templateId) ? { cardio: cardioDraft } : {}),
    });
    setCardioPlan(withSeparateCardioDays(cardioPlan, templateId, dows));
    update({ growthFocus: focusDraft });
    onClose();
  };

  const remove = () => {
    haptic([30, 40]);
    clearWeeklyScheme();
    onClose();
  };

  const setSlotDow = (index: number, dow: number) => {
    haptic(10);
    updateScheduleSlotDow(index, dow);
    setEditingSlot(null);
  };

  if (mode === "manage" && weeklyScheme) {
    const activeTemplate = splitTemplateById(weeklyScheme.templateId);
    const usedDows = new Set(weeklyScheme.schedule.map((s) => s.dow));
    return (
      <BottomSheet open={open} onClose={onClose} title={t.weeklyPlan.title}>
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {t.weeklyPlan.subtitle(activeTemplate.label, weeklyScheme.schedule.length)}
          </p>

          <div className="space-y-2">
            {weeklyScheme.schedule.map((slot, i) => {
              const isNext = i === weeklyScheme.cyclePosition;
              const dayLabel = splitDayLabel(weeklyScheme.templateId, slot.dayId);
              return (
                <div
                  key={i}
                  className={`glass rounded-2xl p-3 ${isNext ? "border border-primary/60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[15px] font-semibold">{dayLabel}</span>
                      {isNext ? (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary-text">
                          {t.weeklyPlan.nextUp}
                        </span>
                      ) : null}
                      <p className="text-[13px] text-muted-foreground">{t.common.dow[slot.dow]}</p>
                    </div>
                    <button
                      onClick={() => setEditingSlot(editingSlot === i ? null : i)}
                      aria-label={t.weeklyPlan.changeDay(dayLabel)}
                      className={button.icon}
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                  {editingSlot === i ? (
                    <div className="mt-3 space-y-2">
                      <DayTypePicker
                        templateId={weeklyScheme.templateId}
                        value={slot.dayId}
                        onChange={(dayId) => updateScheduleSlotDay(i, dayId)}
                      />
                      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                        {DOW_DISPLAY_ORDER.map((dow) => {
                          const taken = usedDows.has(dow) && dow !== slot.dow;
                          return (
                            <button
                              key={dow}
                              disabled={taken}
                              onClick={() => setSlotDow(i, dow)}
                              className={`min-h-[36px] flex-1 rounded-xl text-[13px] font-semibold ${
                                dow === slot.dow
                                  ? chip.on
                                  : taken
                                    ? "bg-secondary text-muted-foreground opacity-40"
                                    : chip.off
                              }`}
                            >
                              {t.common.dow[dow]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Applies at once, like the day edits above. */}
          <HybridCardioSection
            templateId={weeklyScheme.templateId}
            value={templateCardio(weeklyScheme.templateId, weeklyScheme.cardio)}
            onChange={(cardio) => setWeeklyScheme({ ...weeklyScheme, cardio })}
          />

          {/* Applies at once, like the day edits above: no need to rebuild
              the plan just to change what it prioritises. */}
          <GrowthFocusSection
            value={growthFocus}
            onChange={(next) => update({ growthFocus: next })}
          />

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => setMode("template")}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              {t.weeklyPlan.changeSplit}
            </button>
            <button
              onClick={remove}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[14px] font-bold text-destructive-text active:scale-95"
            >
              <Trash2 className="size-4" /> {t.weeklyPlan.removeWeeklyPlan}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t.weeklyPlan.setupTitle}>
      {mode === "template" ? (
        <div className="space-y-2">
          <p className="mb-1 text-[13px] text-muted-foreground">{t.weeklyPlan.pickSplitDesc}</p>
          {SPLIT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => pickTemplate(tpl.id)}
              className="glass flex w-full flex-col gap-1 rounded-2xl p-4 text-left active:scale-[0.985]"
            >
              <span className="text-[17px] font-semibold">{tpl.label}</span>
              <span className="text-[13px] text-muted-foreground">{tpl.description}</span>
              <span className="mt-1 text-[12px] font-semibold text-primary-text">
                {tpl.days.map((d) => d.label).join(" → ")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setMode("template")}
            className="flex min-h-[44px] items-center text-[13px] font-semibold text-primary-text"
          >
            {t.weeklyPlan.changeSplitBack(template.label)}
          </button>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              {t.weeklyPlan.whichDays}
            </p>
            <div className="flex flex-wrap gap-2">
              {DOW_DISPLAY_ORDER.map((dow) => (
                <button
                  key={dow}
                  onClick={() => toggleDow(dow)}
                  className={`min-h-[44px] min-w-[44px] rounded-2xl px-3 text-[14px] font-semibold ${
                    dows.includes(dow) ? chip.on : chip.off
                  }`}
                >
                  {t.common.dow[dow]}
                </button>
              ))}
            </div>
          </div>

          {preview.length ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                {t.weeklyPlan.proposedSchedule}
              </p>
              {distinctDays(templateId).length > 1 ? (
                <p className="mb-2 text-[12.5px] text-muted-foreground">
                  {t.programBuilder.sessionTypeHint}
                </p>
              ) : null}
              <div className="space-y-1.5">
                {preview.map((slot, i) => (
                  <div key={`${slot.dow}-${i}`} className="glass space-y-2 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold">
                        {splitDayLabel(templateId, slot.dayId)}
                      </span>
                      <span className="text-[13px] text-muted-foreground">
                        {t.common.dow[slot.dow]}
                      </span>
                    </div>
                    <DayTypePicker
                      templateId={templateId}
                      value={slot.dayId}
                      onChange={(dayId) => setDayPicks((cur) => ({ ...cur, [slot.dow]: dayId }))}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">{t.weeklyPlan.fineTuneHint}</p>
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground">{t.weeklyPlan.pickOneDay}</p>
          )}

          {template.cardioDays ? (
            <p className="text-[12.5px] text-muted-foreground">{t.cardio.hybridDaysNote}</p>
          ) : null}

          <HybridCardioSection
            templateId={templateId}
            value={cardioDraft}
            onChange={setCardioDraft}
          />

          <GrowthFocusSection value={focusDraft} onChange={setFocusDraft} />

          <button onClick={save} disabled={!preview.length} className={`${button.primary} w-full`}>
            <Check className="size-5" />{" "}
            {weeklyScheme ? t.weeklyPlan.saveChanges : t.weeklyPlan.startThisPlan}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
