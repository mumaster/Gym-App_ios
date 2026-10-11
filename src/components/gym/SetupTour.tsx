import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  HeartPulse,
  ListChecks,
  Palette,
  Pencil,
  ShieldAlert,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Wine,
} from "lucide-react";
import { AvatarPicker } from "./AvatarPicker";
import { BodyweightCard } from "./BodyweightCard";
import { CardioPlanSheet } from "./CardioPlanSheet";
import { ColorSchemePicker } from "./ColorSchemePicker";
import { WaterSettingsSheet } from "./DrinksTab";
import { ListCard } from "./ListCard";
import { KnownLiftsSheet } from "./KnownLiftsSheet";
import { LanguagePicker } from "./LanguagePicker";
import { NameField } from "./NameField";
import { NutritionGoalsSheet } from "./NutritionGoalsSheet";
import { ProgramBuilderSheet } from "./ProgramBuilderSheet";
import { LinkRow, PickerSection } from "./SettingsRows";
import { SwitchRow } from "./SwitchRow";
import { ThemePicker } from "./ThemePicker";
import { GrowthFocusCard } from "./WeeklyVolume";
import { WeeklyPlanSheet } from "./WeeklyPlanSheet";
import { button, chip, text } from "./ui";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { dayKeyFromDate, formatWaterAmount } from "../../lib/gym/nutrition";
import { ALLERGIES } from "../../lib/gym/allergens";
import { splitTemplateById } from "../../lib/gym/splits";
import { haptic, useGym } from "../../lib/gym/store";

/**
 * First-run setup: a full-screen, step-by-step flow shown once after the
 * welcome tour (`welcomeSeen` true, `setupSeen` false), and again from
 * Settings → "Set up Forge". It builds nothing of its own: every step embeds
 * the control or opens the sheet that Settings, Equipment, Nutrition and the
 * plan screens already use, so a setting has one implementation.
 *
 * It sits at z-45: above the tab bar (z-40) and below the sheets (z-50), so
 * the existing BottomSheets open on top of it. Only one sheet is open at a
 * time (`open`). While the user is on /equipment (the gym step's "Edit
 * equipment") the tour renders nothing but stays mounted, so its step
 * survives and the back button there lands on the same step.
 */

const STEPS = [
  "you",
  "look",
  "gym",
  "lifts",
  "plan",
  "focus",
  "workout",
  "cardio",
  "weight",
  "food",
  "drinks",
  "allergies",
  "done",
] as const;
type StepId = (typeof STEPS)[number];
type OpenSheet = null | "lifts" | "weekly" | "program" | "cardio" | "goals" | "water";

export const SETUP_STEP_COUNT = STEPS.length;

export function SetupTour() {
  const { hydrated, welcomeSeen, setupSeen, update } = useGym();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [step, setStep] = useState(0);

  if (!hydrated || !welcomeSeen || setupSeen) return null;
  // Stay mounted (keeping `step`) but invisible while equipment is edited.
  if (pathname === "/equipment") return null;

  const close = () => {
    update({ setupSeen: true });
    setStep(0);
  };
  return <SetupFlow step={step} onStep={setStep} onClose={close} />;
}

/** The visible flow, separate from the gate so it renders without router
 *  state (tests render it directly). `onClose` marks the setup as seen. */
export function SetupFlow({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (n: number) => void;
  onClose: () => void;
}) {
  const t = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<OpenSheet>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const last = STEPS.length - 1;
  const idx = Math.min(Math.max(step, 0), last);
  const id: StepId = STEPS[idx]!;
  const s = useSetupStatus();

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [idx]);

  const go = (n: number) => {
    haptic(10);
    onStep(n);
  };
  const leave = (to: "/generate" | "/nutrition" | "/") => {
    haptic(12);
    onClose();
    void navigate({ to });
  };

  const titles: Record<StepId, string> = {
    you: t.setup.youTitle,
    look: t.setup.lookTitle,
    gym: t.setup.gymTitle,
    lifts: t.setup.liftsTitle,
    plan: t.setup.planTitle,
    focus: t.setup.focusTitle,
    workout: t.setup.workoutTitle,
    cardio: t.setup.cardioTitle,
    weight: t.setup.weightTitle,
    food: t.setup.foodTitle,
    drinks: t.setup.drinksTitle,
    allergies: t.setup.allergiesTitle,
    done: t.setup.doneTitle,
  };
  const bodies: Record<StepId, string> = {
    you: t.setup.youBody,
    look: t.setup.lookBody,
    gym: t.setup.gymBody,
    lifts: t.setup.liftsBody,
    plan: t.setup.planBody,
    focus: t.setup.focusBody,
    workout: t.setup.workoutBody,
    cardio: t.setup.cardioBody,
    weight: t.setup.weightBody,
    food: t.setup.foodBody,
    drinks: t.setup.drinksBody,
    allergies: t.setup.allergiesBody,
    done: t.setup.doneBody,
  };

  const row = (title: string, desc: string, sheet: Exclude<OpenSheet, null>) => (
    <LinkRow
      key={sheet}
      title={title}
      desc={desc}
      onClick={() => {
        haptic(10);
        setOpen(sheet);
      }}
    />
  );

  const body: Record<StepId, ReactNode> = {
    you: <YouStep subtitle={s.you.text} filled={s.you.set} />,
    look: (
      <ListCard
        icon={Palette}
        title={t.settings.appearance}
        subtitle={t.settings.appearanceSub}
        filled
      >
        <PickerSection label={t.settings.colorScheme}>
          <ColorSchemePicker />
        </PickerSection>
        <PickerSection label={t.settings.accentColor}>
          <ThemePicker />
        </PickerSection>
        <PickerSection label={t.settings.language}>
          <LanguagePicker />
        </PickerSection>
      </ListCard>
    ),
    gym: <GymStep onEdit={() => navigate({ to: "/equipment", search: { from: "setup" } })} />,
    lifts: (
      <ListCard
        icon={Trophy}
        title={t.setup.liftsTitle}
        subtitle={s.lifts.text}
        filled={s.lifts.set}
      >
        {row(t.knownLifts.row, t.knownLifts.rowDesc, "lifts")}
      </ListCard>
    ),
    plan: (
      <ListCard
        icon={CalendarDays}
        title={t.setup.planTitle}
        subtitle={s.plan.text}
        filled={s.plan.set}
      >
        {row(t.setup.planWeekly, s.weekly.set ? s.weekly.text : t.setup.planWeeklyDesc, "weekly")}
        {row(
          t.setup.planProgram,
          s.program.set ? s.program.text : t.setup.planProgramDesc,
          "program",
        )}
      </ListCard>
    ),
    cardio: (
      <ListCard
        icon={HeartPulse}
        title={t.setup.cardioTitle}
        subtitle={s.cardio.text}
        filled={s.cardio.set}
      >
        {row(t.setup.cardioOpen, s.cardio.text, "cardio")}
      </ListCard>
    ),
    focus: <GrowthFocusCard />,
    workout: <WorkoutStep status={s.workout} />,
    weight: <WeightStep />,
    food: (
      <ListCard icon={Flame} title={t.setup.foodTitle} subtitle={s.food.text} filled={s.food.set}>
        {row(t.setup.foodOpen, s.food.text, "goals")}
      </ListCard>
    ),
    drinks: <DrinksStep status={s.drinks} onOpen={() => setOpen("water")} />,
    allergies: <AllergiesStep />,
    done: (
      <div className="space-y-4">
        <ListCard icon={ListChecks} title={t.setup.doneTitle} subtitle={t.setup.dialogLabel} filled>
          {(
            [
              ["gym", s.gym],
              ["lifts", s.lifts],
              ["plan", s.plan],
              ["focus", s.focus],
              ["workout", s.workout],
              ["cardio", s.cardio],
              ["weight", s.weight],
              ["food", s.food],
              ["drinks", s.drinks],
              ["allergies", s.allergies],
            ] as const
          ).map(([stepId, st]) => (
            <button
              key={stepId}
              onClick={() => go(STEPS.indexOf(stepId))}
              className="flex min-h-[56px] w-full items-center gap-3 border-t border-border px-4 py-3 text-left active:bg-foreground/5"
            >
              <Mark set={st.set} />
              <span className="min-w-0 flex-1">
                <span className={`${text.rowTitle} block`}>{titles[stepId]}</span>
                <span className="block text-[12.5px] text-muted-foreground">{st.text}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </ListCard>
        <button
          onClick={() => leave("/nutrition")}
          className="glass flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.985]"
        >
          <span className={text.rowTitle}>{t.setup.doneFood}</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <button
          onClick={() => leave("/")}
          className="mx-auto flex min-h-[44px] items-center px-4 text-[14px] font-semibold text-muted-foreground"
        >
          {t.setup.doneClose}
        </button>
      </div>
    ),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.setup.dialogLabel}
      className="fixed inset-0 z-[45] flex flex-col bg-background text-foreground"
    >
      <div className="safe-top flex items-center gap-3 px-5 pb-2">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={idx + 1}
          aria-label={t.setup.stepOf(idx + 1, STEPS.length)}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        {idx < last ? (
          <button
            onClick={() => {
              haptic(10);
              onClose();
            }}
            className="tap-target text-[14px] font-semibold text-muted-foreground"
          >
            {t.setup.skip}
          </button>
        ) : null}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          key={id}
          className="animate-in fade-in mx-auto max-w-xl space-y-5 px-5 pb-6 pt-4 duration-200"
        >
          <header className="space-y-2">
            <p className={text.eyebrow}>{t.setup.stepOf(idx + 1, STEPS.length)}</p>
            <h2 className="text-[26px] font-bold leading-tight tracking-tight">{titles[id]}</h2>
            <p className="text-[15px] text-muted-foreground">{bodies[id]}</p>
          </header>
          {body[id]}
          {idx < last ? (
            <button
              onClick={() => go(idx + 1)}
              className="mx-auto flex min-h-[44px] items-center px-4 text-[14px] font-semibold text-muted-foreground"
            >
              {t.setup.skipStep}
            </button>
          ) : null}
        </div>
      </div>

      <div className="safe-bottom mx-auto flex w-full max-w-xl items-center gap-3 px-5 pt-2">
        <button
          onClick={() => go(idx - 1)}
          aria-label={t.setup.back}
          className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90 ${idx === 0 ? "invisible" : ""}`}
          tabIndex={idx === 0 ? -1 : 0}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        {idx < last ? (
          <button onClick={() => go(idx + 1)} className={`${button.primary} flex-1`}>
            {t.setup.next}
          </button>
        ) : (
          <button onClick={() => leave("/generate")} className={`${button.primary} flex-1`}>
            {t.setup.doneWorkout}
          </button>
        )}
      </div>

      <KnownLiftsSheet open={open === "lifts"} onClose={() => setOpen(null)} />
      <WeeklyPlanSheet open={open === "weekly"} onClose={() => setOpen(null)} />
      <ProgramBuilderSheet open={open === "program"} onClose={() => setOpen(null)} />
      <CardioPlanSheet open={open === "cardio"} onClose={() => setOpen(null)} />
      <NutritionGoalsSheet open={open === "goals"} onClose={() => setOpen(null)} />
      <WaterSettingsSheet
        open={open === "water"}
        onClose={() => setOpen(null)}
        onNeedProfile={() => setOpen("goals")}
      />
    </div>
  );
}

type StatusInfo = { set: boolean; text: string };

/** What is set, per step, for the status lines and the final checklist. */
function useSetupStatus() {
  const t = useTranslation();
  const locale = useLocale();
  const g = useGym();
  const notSet = t.setup.notSet;
  const you: StatusInfo = g.firstName
    ? { set: true, text: g.firstName }
    : { set: false, text: notSet };
  const lifts: StatusInfo = g.knownLifts.length
    ? { set: true, text: t.setup.liftsCount(g.knownLifts.length) }
    : { set: false, text: notSet };
  const weekly: StatusInfo = g.weeklyScheme
    ? {
        set: true,
        text: t.weeklyPlan.subtitle(
          splitTemplateById(g.weeklyScheme.templateId).label,
          g.weeklyScheme.schedule.length,
        ),
      }
    : { set: false, text: notSet };
  const program: StatusInfo = g.program
    ? { set: true, text: t.weeklyPlan.subtitle(g.program.name, g.program.schedule.length) }
    : { set: false, text: notSet };
  const plan: StatusInfo = g.program ? program : weekly;
  const cardio: StatusInfo = g.cardioPlan.length
    ? { set: true, text: t.setup.cardioCount(g.cardioPlan.length) }
    : { set: false, text: notSet };
  const weight: StatusInfo = g.weightLog.length
    ? { set: true, text: latestWeighIn(g.weightLog, locale) ?? notSet }
    : { set: false, text: notSet };
  const food: StatusInfo =
    g.nutritionGoals.calories != null
      ? { set: true, text: t.setup.foodSummary(g.nutritionGoals.calories.toLocaleString(locale)) }
      : { set: false, text: notSet };
  const drinks: StatusInfo =
    g.waterGoalMl != null
      ? { set: true, text: t.setup.waterSummary(formatWaterAmount(g.waterGoalMl)) }
      : { set: false, text: notSet };
  const focus: StatusInfo = g.growthFocus.length
    ? { set: true, text: g.growthFocus.map((f) => t.volume.groups[f]).join(", ") }
    : { set: false, text: notSet };
  const workout: StatusInfo = {
    set: g.supersetsEnabled || g.warmupsEnabled || g.soundEnabled,
    text: [
      g.supersetsEnabled ? t.generate.supersets : null,
      g.warmupsEnabled ? t.generate.warmups : null,
      g.soundEnabled ? t.session.restEndBeep : null,
    ]
      .filter(Boolean)
      .join(", "),
  };
  if (!workout.text) workout.text = notSet;
  const allergies: StatusInfo = g.allergies.length
    ? { set: true, text: g.allergies.map((a) => t.allergy.names[a]).join(", ") }
    : { set: false, text: notSet };
  const gym: StatusInfo = {
    set: true,
    text: g.profiles.find((p) => p.id === g.activeProfileId)?.name ?? notSet,
  };
  return {
    you,
    lifts,
    weekly,
    program,
    plan,
    focus,
    workout,
    cardio,
    weight,
    food,
    drinks,
    allergies,
    gym,
  };
}

function latestWeighIn(log: { kg: number }[], locale: string) {
  const last = log[log.length - 1];
  return last ? `${last.kg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg` : null;
}

function YouStep({ subtitle, filled }: { subtitle: string; filled: boolean }) {
  const t = useTranslation();
  return (
    <ListCard icon={UserRound} title={t.setup.youTitle} subtitle={subtitle} filled={filled}>
      <PickerSection label={t.name.title}>
        <NameField />
      </PickerSection>
      <PickerSection label={t.settings.avatar}>
        <AvatarPicker />
      </PickerSection>
    </ListCard>
  );
}

function WorkoutStep({ status }: { status: StatusInfo }) {
  const t = useTranslation();
  const { supersetsEnabled, warmupsEnabled, soundEnabled, update } = useGym();
  const rowCls = "border-t border-border px-4 py-3";
  return (
    <ListCard
      icon={SlidersHorizontal}
      title={t.setup.workoutTitle}
      subtitle={status.text}
      filled={status.set}
    >
      <SwitchRow
        className={rowCls}
        label={t.generate.supersets}
        desc={t.generate.supersetsDesc}
        ariaLabel={t.generate.enableSupersets}
        on={supersetsEnabled}
        onToggle={() => {
          haptic(12);
          update({ supersetsEnabled: !supersetsEnabled });
        }}
      />
      <SwitchRow
        className={rowCls}
        label={t.generate.warmups}
        desc={t.generate.warmupsDesc}
        ariaLabel={t.generate.warmups}
        on={warmupsEnabled}
        onToggle={() => {
          haptic(12);
          update({ warmupsEnabled: !warmupsEnabled });
        }}
      />
      <SwitchRow
        className={rowCls}
        label={t.session.restEndBeep}
        ariaLabel={t.session.restEndBeep}
        on={soundEnabled}
        onToggle={() => {
          haptic(12);
          update({ soundEnabled: !soundEnabled });
        }}
      />
    </ListCard>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function AllergiesStep() {
  const t = useTranslation();
  const { allergies, language, update } = useGym();
  return (
    <ListCard
      icon={ShieldAlert}
      title={t.allergy.settingsTitle}
      subtitle={
        allergies.length === 0
          ? t.allergy.none
          : allergies.length === 1
            ? cap(t.allergy.names[allergies[0]!])
            : t.allergy.picked(allergies.length)
      }
      filled={allergies.length > 0}
    >
      <div className="divide-y divide-border border-t border-border">
        {[...ALLERGIES]
          .sort((a, b) => t.allergy.names[a].localeCompare(t.allergy.names[b], language))
          .map((id) => (
            <SwitchRow
              key={id}
              label={cap(t.allergy.names[id])}
              desc={t.allergy.descs[id]}
              ariaLabel={cap(t.allergy.names[id])}
              on={allergies.includes(id)}
              onToggle={() => {
                haptic(12);
                update({
                  allergies: allergies.includes(id)
                    ? allergies.filter((a) => a !== id)
                    : [...allergies, id],
                });
              }}
            />
          ))}
      </div>
    </ListCard>
  );
}

function GymStep({ onEdit }: { onEdit: () => void }) {
  const t = useTranslation();
  const { profiles, activeProfileId, update } = useGym();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  if (!profile) return null;
  return (
    <ListCard
      icon={Dumbbell}
      title={profiles.length > 1 ? t.equipment.title : profile.name}
      subtitle={t.generate.equipmentSummary(profile.active_equipment_ids.length)}
      filled
      actions={
        <button
          onClick={() => {
            haptic(10);
            onEdit();
          }}
          aria-label={t.exercises.editGym(profile.name)}
          className={button.edit}
        >
          <Pencil className="size-4" />
        </button>
      }
    >
      {profiles.length > 1 ? (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                haptic(12);
                update({ activeProfileId: p.id });
              }}
              aria-pressed={p.id === profile.id}
              className={`tap-target min-h-[36px] shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold ${
                p.id === profile.id ? chip.on : chip.off
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
    </ListCard>
  );
}

/** The Weight tab's own card, as Nutrition → Weight draws it for today. */
function WeightStep() {
  const t = useTranslation();
  const locale = useLocale();
  const { weightLog } = useGym();
  const todayKey = dayKeyFromDate(new Date());
  const today = [...weightLog].reverse().find((e) => dayKeyFromDate(new Date(e.date)) === todayKey);
  return (
    <BodyweightCard
      canLog
      dayLabel={t.nutrition.today}
      weighIn={today ? `${today.kg.toLocaleString(locale, { maximumFractionDigits: 1 })} kg` : null}
    />
  );
}

function DrinksStep({ status, onOpen }: { status: StatusInfo; onOpen: () => void }) {
  const t = useTranslation();
  const { alcoholEnabled, alcoholWeekdays, update } = useGym();
  return (
    <div className="space-y-3">
      <ListCard
        icon={Droplet}
        title={t.setup.drinksTitle}
        subtitle={status.text}
        filled={status.set}
      >
        <LinkRow
          title={t.setup.waterOpen}
          desc={status.text}
          onClick={() => {
            haptic(10);
            onOpen();
          }}
        />
      </ListCard>
      <ListCard
        icon={Wine}
        title={t.settings.alcohol}
        subtitle={alcoholEnabled ? t.settings.on : t.settings.off}
        filled={alcoholEnabled}
      >
        <div className="divide-y divide-border border-t border-border">
          <SwitchRow
            label={t.settings.alcoholTrack}
            desc={t.settings.alcoholTrackDesc}
            ariaLabel={t.settings.alcoholTrack}
            on={alcoholEnabled}
            onToggle={() => {
              haptic(12);
              update({ alcoholEnabled: !alcoholEnabled });
            }}
          />
          <SwitchRow
            label={t.settings.alcoholWeekdays}
            desc={t.settings.alcoholWeekdaysDesc}
            ariaLabel={t.settings.alcoholWeekdays}
            on={alcoholWeekdays}
            disabled={!alcoholEnabled}
            onToggle={() => {
              haptic(12);
              update({ alcoholWeekdays: !alcoholWeekdays });
            }}
          />
        </div>
      </ListCard>
    </div>
  );
}

/** A check when set, a muted dot when not (never colour alone). */
function Mark({ set }: { set: boolean }) {
  return set ? (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-text">
      <Check className="size-3.5" aria-hidden />
    </span>
  ) : (
    <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
      <span className="size-2 rounded-full bg-muted-foreground/50" />
    </span>
  );
}
