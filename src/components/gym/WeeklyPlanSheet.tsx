import { useEffect, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import {
  DOW_DISPLAY_ORDER,
  DOW_LABELS,
  SPLIT_TEMPLATES,
  buildSchedule,
  initialCyclePosition,
  splitDayLabel,
  splitTemplateById,
  type SplitTemplateId,
} from "../../lib/gym/splits";
import { haptic, useGym } from "../../lib/gym/store";

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
  const { weeklyScheme, setWeeklyScheme, updateScheduleSlotDow, clearWeeklyScheme } = useGym();
  const [mode, setMode] = useState<Mode>("template");
  const [templateId, setTemplateId] = useState<SplitTemplateId>("upper_lower");
  const [dows, setDows] = useState<number[]>(EVEN_SPREAD[4]!);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setEditingSlot(null);
    setMode(weeklyScheme ? "manage" : "template");
  }, [open, weeklyScheme]);

  const pickTemplate = (id: SplitTemplateId) => {
    haptic(15);
    setTemplateId(id);
    setDows(EVEN_SPREAD[splitTemplateById(id).suggestedDaysPerWeek] ?? EVEN_SPREAD[3]!);
    setMode("days");
  };

  const toggleDow = (dow: number) => {
    haptic(10);
    setDows((cur) =>
      cur.includes(dow) ? cur.filter((d) => d !== dow) : [...cur, dow].sort((a, b) => a - b),
    );
  };

  const preview = buildSchedule(templateId, dows);
  const template = splitTemplateById(templateId);

  const save = () => {
    if (!preview.length) return;
    haptic([20, 30]);
    setWeeklyScheme({
      templateId,
      schedule: preview,
      cyclePosition: initialCyclePosition(preview),
    });
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
      <BottomSheet open={open} onClose={onClose} title="Your weekly plan">
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {activeTemplate.label} · {weeklyScheme.schedule.length}{" "}
            {weeklyScheme.schedule.length === 1 ? "day" : "days"} a week
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
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                          Next up
                        </span>
                      ) : null}
                      <p className="text-[13px] text-muted-foreground">{DOW_LABELS[slot.dow]}</p>
                    </div>
                    <button
                      onClick={() => setEditingSlot(editingSlot === i ? null : i)}
                      aria-label={`Change day for ${dayLabel}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                  {editingSlot === i ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {DOW_DISPLAY_ORDER.map((dow) => {
                        const taken = usedDows.has(dow) && dow !== slot.dow;
                        return (
                          <button
                            key={dow}
                            disabled={taken}
                            onClick={() => setSlotDow(i, dow)}
                            className={`min-h-[36px] flex-1 rounded-xl text-[13px] font-semibold ${
                              dow === slot.dow
                                ? "bg-primary text-primary-foreground"
                                : taken
                                  ? "bg-secondary text-muted-foreground opacity-40"
                                  : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            {DOW_LABELS[dow]}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => setMode("template")}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-[14px] font-bold text-secondary-foreground active:scale-95"
            >
              Change split
            </button>
            <button
              onClick={remove}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-[14px] font-bold text-destructive active:scale-95"
            >
              <Trash2 className="size-4" /> Remove weekly plan
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Set up a weekly plan">
      {mode === "template" ? (
        <div className="space-y-2">
          <p className="mb-1 text-[13px] text-muted-foreground">
            Pick a split — it decides which muscles land on which day. The generator's set, rep and
            rest scheme is unchanged.
          </p>
          {SPLIT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className="glass flex w-full flex-col gap-1 rounded-2xl p-4 text-left active:scale-[0.985]"
            >
              <span className="text-[17px] font-semibold">{t.label}</span>
              <span className="text-[13px] text-muted-foreground">{t.description}</span>
              <span className="mt-1 text-[12px] font-semibold text-primary">
                {t.days.map((d) => d.label).join(" → ")}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setMode("template")}
            className="text-[13px] font-semibold text-primary"
          >
            ← {template.label} · change split
          </button>

          <div>
            <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
              Which days do you want to train?
            </p>
            <div className="flex flex-wrap gap-2">
              {DOW_DISPLAY_ORDER.map((dow) => (
                <button
                  key={dow}
                  onClick={() => toggleDow(dow)}
                  className={`min-h-[44px] min-w-[44px] rounded-2xl px-3 text-[14px] font-semibold ${
                    dows.includes(dow)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {DOW_LABELS[dow]}
                </button>
              ))}
            </div>
          </div>

          {preview.length ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-muted-foreground">
                Proposed schedule
              </p>
              <div className="space-y-1.5">
                {preview.map((slot, i) => (
                  <div
                    key={`${slot.dayId}-${i}`}
                    className="glass flex items-center justify-between rounded-xl px-3 py-2.5"
                  >
                    <span className="text-[14px] font-semibold">
                      {splitDayLabel(templateId, slot.dayId)}
                    </span>
                    <span className="text-[13px] text-muted-foreground">
                      {DOW_LABELS[slot.dow]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                You can fine-tune individual days any time from the weekly plan card.
              </p>
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground">Pick at least one training day.</p>
          )}

          <button
            onClick={save}
            disabled={!preview.length}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground active:scale-95 disabled:opacity-40"
          >
            <Check className="size-5" /> {weeklyScheme ? "Save changes" : "Start this plan"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
