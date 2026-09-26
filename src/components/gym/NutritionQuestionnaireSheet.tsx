import { useEffect, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useTranslation } from "../../lib/gym/i18n";
import {
  ACTIVITY_LEVELS,
  NUTRIENT_ORDER,
  NUTRIENT_UNITS,
  suggestNutritionGoals,
  type ActivityLevel,
  type NutritionGoalType,
  type NutritionGoals,
  type NutritionPace,
  type NutritionProfile,
  type Sex,
} from "../../lib/gym/nutrition";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../../lib/gym/numericInput";
import { haptic, useGym } from "../../lib/gym/store";
import { useSessionShape } from "../../lib/gym/dayNutrition";
import type { Workout } from "../../lib/gym/types";

/** Average finished sessions a week over the last four weeks, or null
 *  without any — a prefill from what the user actually did. */
function recentSessionsPerWeek(workouts: Workout[]): number | null {
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const n = workouts.filter((w) => w.finished && new Date(w.date).getTime() >= cutoff).length;
  return n ? Math.round(n / 4) : null;
}

type Translations = ReturnType<typeof useTranslation>;

const goalsList = (
  t: Translations,
): { id: NutritionGoalType; label: string; description: string }[] => [
  {
    id: "lose",
    label: t.nutritionQuestionnaire.goalLose,
    description: t.nutritionQuestionnaire.goalLoseDesc,
  },
  {
    id: "maintain",
    label: t.nutritionQuestionnaire.goalMaintain,
    description: t.nutritionQuestionnaire.goalMaintainDesc,
  },
  {
    id: "gain",
    label: t.nutritionQuestionnaire.goalGain,
    description: t.nutritionQuestionnaire.goalGainDesc,
  },
];

const pacesList = (
  t: Translations,
  goal: NutritionGoalType | null,
): { id: NutritionPace; label: string; description: string }[] => {
  const q = t.nutritionQuestionnaire;
  const gain = goal === "gain";
  return [
    { id: "mild", label: q.paceMild, description: gain ? q.gainMildDesc : q.loseMildDesc },
    {
      id: "moderate",
      label: q.paceModerate,
      description: gain ? q.gainModerateDesc : q.loseModerateDesc,
    },
    {
      id: "aggressive",
      label: q.paceAggressive,
      description: gain ? q.gainAggressiveDesc : q.loseAggressiveDesc,
    },
  ];
};

const activityLevelsList = (
  t: Translations,
): { id: ActivityLevel; label: string; description: string }[] =>
  ACTIVITY_LEVELS.map((a) => ({
    id: a.id,
    label: t.activityLevels[`${a.id}Label`],
    description: t.activityLevels[`${a.id}Desc`],
  }));

const isActivityLevel = (v: unknown): v is ActivityLevel => ACTIVITY_LEVELS.some((a) => a.id === v);

function OptionRow({
  selected,
  label,
  description,
  onClick,
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors active:scale-[0.985] ${
        selected ? "bg-primary/15" : "bg-muted"
      }`}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[12.5px] text-muted-foreground">{description}</span>
      </span>
      {selected ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
          <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
        </span>
      ) : (
        <span className="size-6 shrink-0 rounded-full border-2 border-border" />
      )}
    </button>
  );
}

function NumberField({
  label,
  unit,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
      <span className="w-20 shrink-0 text-[14px] font-semibold text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        type="text"
        value={value}
        onFocus={selectOnFocus}
        onChange={(e) => {
          if (!DECIMAL_INPUT_RE.test(e.target.value)) return;
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className="h-9 w-full min-w-0 flex-1 bg-transparent text-right text-[16px] font-bold text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
      />
      <span className="w-9 shrink-0 text-[12px] text-muted-foreground">{unit}</span>
    </label>
  );
}

export function NutritionQuestionnaireSheet({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** `weightKg` is the answer just given — the stored profile isn't
   *  updated yet from the caller's point of view when this runs. */
  onApply: (goals: NutritionGoals, profile: NutritionProfile) => void;
}) {
  const { nutritionProfile, program, weeklyScheme, workouts, update } = useGym();
  const t = useTranslation();
  const STEP_LABELS = [
    t.nutritionQuestionnaire.stepBasics,
    t.nutritionQuestionnaire.stepActivity,
    t.nutritionQuestionnaire.stepGoal,
    t.nutritionQuestionnaire.stepReview,
  ];
  const GOALS = goalsList(t);

  const ACTIVITY_LEVELS_T = activityLevelsList(t);
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<NutritionGoalType | null>(null);
  const [pace, setPace] = useState<NutritionPace>("moderate");
  const [sessions, setSessions] = useState("");
  const PACES = pacesList(t, goal);
  const sessionShape = useSessionShape();

  // Seed from the last saved profile every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSex(nutritionProfile?.sex ?? null);
    setAge(nutritionProfile ? String(nutritionProfile.age) : "");
    setHeightCm(nutritionProfile ? String(nutritionProfile.heightCm) : "");
    setWeightKg(nutritionProfile ? String(nutritionProfile.weightKg) : "");
    // Profiles saved before the FAO-based levels used ids that no longer
    // exist (and counted gym training inside them), so they re-ask.
    setActivityLevel(
      isActivityLevel(nutritionProfile?.activityLevel) ? nutritionProfile.activityLevel : null,
    );
    setSessions(
      String(
        nutritionProfile?.sessionsPerWeek ??
          (program ?? weeklyScheme)?.schedule.length ??
          recentSessionsPerWeek(workouts) ??
          "",
      ),
    );
    setGoal(nutritionProfile?.goal ?? null);
    setPace(nutritionProfile?.pace ?? "moderate");
  }, [open, nutritionProfile, program, weeklyScheme, workouts]);

  const ageNum = parseDecimal(age);
  const heightNum = parseDecimal(heightCm);
  const weightNum = parseDecimal(weightKg);
  const basicsValid =
    sex != null &&
    Number.isFinite(ageNum) &&
    ageNum >= 13 &&
    ageNum <= 100 &&
    Number.isFinite(heightNum) &&
    heightNum >= 100 &&
    heightNum <= 250 &&
    Number.isFinite(weightNum) &&
    weightNum >= 30 &&
    weightNum <= 300;

  const sessionsNum = parseDecimal(sessions);
  const sessionsValid = Number.isInteger(sessionsNum) && sessionsNum >= 0 && sessionsNum <= 14;

  const profile: NutritionProfile | null =
    basicsValid && sex && activityLevel && sessionsValid && goal
      ? {
          sex,
          age: Math.round(ageNum),
          heightCm: Math.round(heightNum),
          weightKg: Math.round(weightNum * 10) / 10,
          activityLevel,
          sessionsPerWeek: sessionsNum,
          goal,
          pace,
        }
      : null;

  const suggested = profile ? suggestNutritionGoals(profile, sessionShape) : null;

  const close = () => {
    setStep(0);
    onClose();
  };

  const next = () => {
    haptic(15);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };
  const back = () => {
    haptic(12);
    setStep((s) => Math.max(s - 1, 0));
  };

  const canAdvance =
    step === 0
      ? basicsValid
      : step === 1
        ? activityLevel != null && sessionsValid
        : step === 2
          ? goal != null
          : true;

  return (
    <BottomSheet open={open} onClose={close} title={t.nutritionQuestionnaire.title}>
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <div
              key={label}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              {t.nutritionQuestionnaire.basicsDesc}
            </p>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    haptic(12);
                    setSex(s);
                  }}
                  className={`flex-1 rounded-2xl px-4 py-3 text-[15px] font-semibold capitalize active:scale-95 ${
                    sex === s ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {t.nutritionQuestionnaire[s]}
                </button>
              ))}
            </div>
            <NumberField
              label={t.nutritionQuestionnaire.age}
              unit={t.nutritionQuestionnaire.years}
              value={age}
              placeholder="30"
              onChange={setAge}
            />
            <NumberField
              label={t.nutritionQuestionnaire.height}
              unit={t.nutritionQuestionnaire.cm}
              value={heightCm}
              placeholder="175"
              onChange={setHeightCm}
            />
            <NumberField
              label={t.nutritionQuestionnaire.weight}
              unit={t.nutritionQuestionnaire.kg}
              value={weightKg}
              placeholder="75"
              onChange={setWeightKg}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              {t.nutritionQuestionnaire.activityDesc}
            </p>
            {ACTIVITY_LEVELS_T.map((a) => (
              <OptionRow
                key={a.id}
                selected={activityLevel === a.id}
                label={a.label}
                description={a.description}
                onClick={() => {
                  haptic(12);
                  setActivityLevel(a.id);
                }}
              />
            ))}
            <p className="pt-2 text-[13px] text-muted-foreground">
              {t.nutritionQuestionnaire.sessionsDesc}
            </p>
            <NumberField
              label={t.nutritionQuestionnaire.sessionsLabel}
              unit={t.nutritionQuestionnaire.perWeek}
              value={sessions}
              placeholder="3"
              onChange={setSessions}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[13px] text-muted-foreground">
                {t.nutritionQuestionnaire.goalDesc}
              </p>
              {GOALS.map((g) => (
                <OptionRow
                  key={g.id}
                  selected={goal === g.id}
                  label={g.label}
                  description={g.description}
                  onClick={() => {
                    haptic(12);
                    setGoal(g.id);
                  }}
                />
              ))}
            </div>
            {goal && goal !== "maintain" ? (
              <div className="space-y-2">
                <p className="text-[13px] text-muted-foreground">
                  {t.nutritionQuestionnaire.paceDesc}
                </p>
                {PACES.map((p) => (
                  <OptionRow
                    key={p.id}
                    selected={pace === p.id}
                    label={p.label}
                    description={p.description}
                    onClick={() => {
                      haptic(12);
                      setPace(p.id);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 && suggested ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              {t.nutritionQuestionnaire.reviewDesc}
            </p>
            {profile?.goal !== "maintain" ? (
              <p className="text-[13px] text-muted-foreground">
                {t.nutritionQuestionnaire.checkWeeklyWeight}
              </p>
            ) : null}
            <div className="space-y-2">
              {NUTRIENT_ORDER.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
                >
                  <span className="text-[14px] font-semibold text-muted-foreground">
                    {t.nutrients[key]}
                  </span>
                  <span className="text-[16px] font-bold">
                    {suggested[key]}{" "}
                    <span className="text-[12px] font-normal text-muted-foreground">
                      {NUTRIENT_UNITS[key]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 pt-1">
          {step > 0 ? (
            <button
              onClick={back}
              className="glass flex min-h-[52px] items-center justify-center gap-1 rounded-2xl px-5 text-[15px] font-semibold text-muted-foreground active:scale-95"
            >
              <ChevronLeft className="size-4" /> {t.common.back}
            </button>
          ) : null}
          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={next}
              disabled={!canAdvance}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
            >
              {t.common.next}
            </button>
          ) : (
            <button
              onClick={() => {
                if (!profile || !suggested) return;
                haptic([20, 30]);
                update({ nutritionProfile: profile });
                onApply(suggested, profile);
                close();
              }}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-95"
            >
              {t.nutritionQuestionnaire.useTheseLimits}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
