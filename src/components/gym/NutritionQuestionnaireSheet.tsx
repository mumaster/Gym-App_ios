import { useEffect, useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import {
  ACTIVITY_LEVELS,
  NUTRIENT_LABELS,
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

const GOALS: { id: NutritionGoalType; label: string; description: string }[] = [
  { id: "lose", label: "Lose weight", description: "Eat in a calorie deficit" },
  { id: "maintain", label: "Maintain", description: "Stay around your current weight" },
  { id: "gain", label: "Gain weight", description: "Eat in a calorie surplus" },
];

const PACES: { id: NutritionPace; label: string; description: string }[] = [
  { id: "mild", label: "Mild", description: "Slow and steady, easiest to sustain" },
  { id: "moderate", label: "Moderate", description: "A balanced pace" },
  { id: "aggressive", label: "Aggressive", description: "Faster, harder to sustain" },
];

const STEP_LABELS = ["Basics", "Activity", "Goal", "Review"];

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
  onApply: (goals: NutritionGoals) => void;
}) {
  const { nutritionProfile, update } = useGym();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<NutritionGoalType | null>(null);
  const [pace, setPace] = useState<NutritionPace>("moderate");

  // Seed from the last saved profile every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSex(nutritionProfile?.sex ?? null);
    setAge(nutritionProfile ? String(nutritionProfile.age) : "");
    setHeightCm(nutritionProfile ? String(nutritionProfile.heightCm) : "");
    setWeightKg(nutritionProfile ? String(nutritionProfile.weightKg) : "");
    setActivityLevel(nutritionProfile?.activityLevel ?? null);
    setGoal(nutritionProfile?.goal ?? null);
    setPace(nutritionProfile?.pace ?? "moderate");
  }, [open, nutritionProfile]);

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

  const profile: NutritionProfile | null =
    basicsValid && sex && activityLevel && goal
      ? {
          sex,
          age: Math.round(ageNum),
          heightCm: Math.round(heightNum),
          weightKg: Math.round(weightNum * 10) / 10,
          activityLevel,
          goal,
          pace,
        }
      : null;

  const suggested = profile ? suggestNutritionGoals(profile) : null;

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
        ? activityLevel != null
        : step === 2
          ? goal != null
          : true;

  return (
    <BottomSheet open={open} onClose={close} title="Suggest my limits">
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
              A few basics to estimate your daily energy needs.
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
                  {s}
                </button>
              ))}
            </div>
            <NumberField label="Age" unit="yrs" value={age} placeholder="30" onChange={setAge} />
            <NumberField
              label="Height"
              unit="cm"
              value={heightCm}
              placeholder="175"
              onChange={setHeightCm}
            />
            <NumberField
              label="Weight"
              unit="kg"
              value={weightKg}
              placeholder="75"
              onChange={setWeightKg}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-2">
            <p className="text-[13px] text-muted-foreground">
              How active are you day-to-day, outside the gym?
            </p>
            {ACTIVITY_LEVELS.map((a) => (
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
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[13px] text-muted-foreground">What's your goal?</p>
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
                <p className="text-[13px] text-muted-foreground">How fast?</p>
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
              An estimate based on your answers — not medical advice. Every value is still yours to
              adjust after applying it.
            </p>
            <div className="space-y-2">
              {NUTRIENT_ORDER.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
                >
                  <span className="text-[14px] font-semibold text-muted-foreground">
                    {NUTRIENT_LABELS[key]}
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
              <ChevronLeft className="size-4" /> Back
            </button>
          ) : null}
          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={next}
              disabled={!canAdvance}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-40 active:scale-95"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => {
                if (!profile || !suggested) return;
                haptic([20, 30]);
                update({ nutritionProfile: profile });
                onApply(suggested);
                close();
              }}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground active:scale-95"
            >
              Use these limits
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
