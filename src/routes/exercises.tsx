import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Heart, Pencil, Plus, Search, ShieldOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "../components/gym/BottomSheet";
import { Card, Screen } from "../components/gym/Screen";
import {
  EQUIPMENT,
  MUSCLES,
  TARGET_MUSCLES,
  TARGET_MUSCLE_GROUP,
  targetsForGroup,
} from "../lib/gym/data";
import {
  csvToExercises,
  deleteExercise,
  exercisesToCsv,
  saveExercise,
  saveExercises,
  slugifyId,
  useExerciseCatalog,
} from "../lib/gym/catalog";
import { useTranslation } from "../lib/gym/i18n";
import { haptic, useGym } from "../lib/gym/store";
import type {
  EquipmentId,
  Exercise,
  MovementPattern,
  Muscle,
  TargetMuscle,
} from "../lib/gym/types";

const PATTERNS: MovementPattern[] = ["push", "pull", "hinge", "squat", "carry", "core"];

const emptyExercise = (): Exercise => ({
  id: "",
  name: "",
  primary_muscle: "Chest",
  secondary_muscles: [],
  muscle_targets: [],
  equipment_required: [],
  movement_pattern: "push",
  compound: false,
  instructions: "",
  cues: [],
});

export const Route = createFileRoute("/exercises")({
  head: () => ({
    meta: [
      { title: "Exercise Library — Forge" },
      {
        name: "description",
        content:
          "Editable database of gym exercises with primary and secondary muscles, equipment, movement patterns, instructions and coaching cues.",
      },
      { property: "og:title", content: "Exercise Library — Forge" },
      {
        property: "og:description",
        content: "Browse, edit and import your own exercise database with CSV support.",
      },
    ],
  }),
  component: ExercisesScreen,
});

function ExercisesScreen() {
  const t = useTranslation();
  const {
    profiles,
    activeProfileId,
    lovedExerciseIds,
    toggleLovedExercise,
    avoidedExerciseIds,
    toggleAvoidedExercise,
  } = useGym();
  const exercises = useExerciseCatalog();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "All">("All");
  const [target, setTarget] = useState<TargetMuscle | "All">("All");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyLoved, setOnlyLoved] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [draft, setDraft] = useState<{ value: Exercise; isNew: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () =>
      exercises.filter((e) => {
        if (muscle !== "All" && e.primary_muscle !== muscle) return false;
        if (target !== "All" && !e.muscle_targets.includes(target)) return false;
        if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (onlyLoved && !lovedExerciseIds.includes(e.id)) return false;
        if (
          onlyAvailable &&
          !e.equipment_required.every((r) => profile.active_equipment_ids.includes(r))
        )
          return false;
        return true;
      }),
    [exercises, query, muscle, target, onlyAvailable, onlyLoved, lovedExerciseIds, profile],
  );

  // specific-muscle chips: narrowed to the picked group, else the full list
  const targetChoices = muscle === "All" ? TARGET_MUSCLES : targetsForGroup(muscle);

  const exportCsv = () => {
    const blob = new Blob([exercisesToCsv(exercises)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-exercises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t.exercises.exportedCount(exercises.length));
  };

  const importCsv = async (file: File) => {
    const { list, errors } = csvToExercises(await file.text());
    if (!list.length) {
      toast.error(errors[0] ?? t.exercises.nothingToImport);
      return;
    }
    const { error } = await saveExercises(list);
    if (error) toast.error(error);
    else toast.success(t.exercises.importedCount(list.length, errors.length));
  };

  return (
    <Screen
      title={t.exercises.title}
      subtitle={t.exercises.subtitle(results.length, exercises.length)}
    >
      <div className="glass flex h-12 items-center gap-2 rounded-2xl px-3">
        <Search className="size-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.exercises.search}
          className="h-full w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {(["All", ...MUSCLES] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMuscle(m);
              setTarget((t) =>
                t === "All" || (m !== "All" && TARGET_MUSCLE_GROUP[t] !== m) ? "All" : t,
              );
            }}
            className={`min-h-[40px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${
              muscle === m
                ? "bg-primary text-primary-foreground"
                : "glass text-secondary-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
        {(["All", ...targetChoices] as const).map((choice) => (
          <button
            key={choice}
            onClick={() => setTarget(choice)}
            className={`min-h-[36px] shrink-0 rounded-full px-3 text-[13px] font-semibold ${
              target === choice
                ? "bg-primary text-primary-foreground"
                : "glass text-secondary-foreground"
            }`}
          >
            {choice === "All" ? t.exercises.anyMuscle : choice}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setOnlyAvailable((v) => !v)}
          className={`min-h-[44px] flex-1 rounded-2xl text-[15px] font-semibold ${
            onlyAvailable ? "bg-primary text-primary-foreground" : "glass text-secondary-foreground"
          }`}
        >
          {onlyAvailable ? t.exercises.filteredTo(profile.name) : t.exercises.showOnlyAvailable}
        </button>
        <button
          onClick={() => setOnlyLoved((v) => !v)}
          aria-pressed={onlyLoved}
          aria-label={t.exercises.showOnlyLoved}
          className={`flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 text-[15px] font-semibold ${
            onlyLoved ? "bg-primary text-primary-foreground" : "glass text-secondary-foreground"
          }`}
        >
          <Heart className={`size-4 ${onlyLoved ? "fill-current" : ""}`} />
          {lovedExerciseIds.length || t.exercises.loved}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => setDraft({ value: emptyExercise(), isNew: true })}
          className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> {t.exercises.new}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="glass flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold text-secondary-foreground"
        >
          <Upload className="size-4" /> {t.exercises.import}
        </button>
        <button
          onClick={exportCsv}
          className="glass flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold text-secondary-foreground"
        >
          <Download className="size-4" /> {t.exercises.export}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importCsv(f);
        }}
      />

      <div className="mt-4 space-y-2">
        {results.map((e) => {
          const loved = lovedExerciseIds.includes(e.id);
          const avoided = avoidedExerciseIds.includes(e.id);
          return (
            <Card key={e.id} className="flex items-center gap-3 p-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(e)}>
                <p className="truncate text-[17px] font-semibold">{e.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {(e.muscle_targets.length ? e.muscle_targets : [e.primary_muscle]).join(" · ")}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground/70">
                  {e.movement_pattern} ·{" "}
                  {e.equipment_required
                    .map((id) => EQUIPMENT.find((q) => q.id === id)?.label ?? id)
                    .join(", ") || t.exercises.noEquipment}
                </p>
              </button>
              <button
                aria-label={avoided ? t.exercises.stopAvoiding(e.name) : t.exercises.avoid(e.name)}
                aria-pressed={avoided}
                onClick={() => {
                  haptic(12);
                  toggleAvoidedExercise(e.id);
                }}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  avoided ? "bg-destructive/15 text-destructive" : "glass text-secondary-foreground"
                }`}
              >
                <ShieldOff className="size-4" />
              </button>
              <button
                aria-label={loved ? t.exercises.unlove(e.name) : t.exercises.love(e.name)}
                aria-pressed={loved}
                onClick={() => {
                  haptic(12);
                  toggleLovedExercise(e.id);
                }}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                  loved ? "bg-primary/15 text-primary" : "glass text-secondary-foreground"
                }`}
              >
                <Heart className={`size-4 ${loved ? "fill-current" : ""}`} />
              </button>
              <button
                aria-label={t.exercises.edit(e.name)}
                onClick={() => setDraft({ value: { ...e }, isNew: false })}
                className="glass flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <Pencil className="size-4 text-secondary-foreground" />
              </button>
            </Card>
          );
        })}
      </div>

      <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  haptic(12);
                  toggleLovedExercise(detail.id);
                }}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold ${
                  lovedExerciseIds.includes(detail.id)
                    ? "bg-primary text-primary-foreground"
                    : "glass text-secondary-foreground"
                }`}
              >
                <Heart
                  className={`size-4 ${lovedExerciseIds.includes(detail.id) ? "fill-current" : ""}`}
                />
                {lovedExerciseIds.includes(detail.id)
                  ? t.exercises.lovedThis
                  : t.exercises.loveThis}
              </button>
              <button
                onClick={() => {
                  haptic(12);
                  toggleAvoidedExercise(detail.id);
                }}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold ${
                  avoidedExerciseIds.includes(detail.id)
                    ? "bg-destructive text-destructive-foreground"
                    : "glass text-secondary-foreground"
                }`}
              >
                <ShieldOff className="size-4" />
                {avoidedExerciseIds.includes(detail.id)
                  ? t.exercises.avoided
                  : t.exercises.avoidThis}
              </button>
            </div>
            <p className="text-[15px] text-muted-foreground">{detail.instructions}</p>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.exercises.targets}
              </p>
              <div className="flex flex-wrap gap-2">
                {(detail.muscle_targets.length
                  ? detail.muscle_targets
                  : [detail.primary_muscle]
                ).map((m, i) => (
                  <span
                    key={m}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                      i === 0 ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[detail.primary_muscle, ...detail.secondary_muscles].map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold text-secondary-foreground"
                >
                  {m}
                </span>
              ))}
            </div>
            <ul className="space-y-1.5">
              {detail.cues.map((c) => (
                <li key={c} className="text-[15px]">
                  • {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </BottomSheet>

      <ExerciseEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onChange={(value) => setDraft((d) => (d ? { ...d, value } : d))}
      />
    </Screen>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-full px-3 text-[13px] font-semibold ${
        active ? "bg-primary text-primary-foreground" : "glass text-secondary-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ExerciseEditor({
  draft,
  onClose,
  onChange,
}: {
  draft: { value: Exercise; isNew: boolean } | null;
  onClose: () => void;
  onChange: (value: Exercise) => void;
}) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const value = draft?.value;

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const save = async () => {
    if (!value) return;
    if (!value.name.trim()) {
      toast.error(t.exercises.giveExerciseName);
      return;
    }
    setBusy(true);
    const { error } = await saveExercise({
      ...value,
      name: value.name.trim(),
      id: value.id || slugifyId(value.name),
    });
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(t.exercises.saved);
      onClose();
    }
  };

  const remove = async () => {
    if (!value) return;
    setBusy(true);
    const { error } = await deleteExercise(value.id);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(t.exercises.deleted);
      onClose();
    }
  };

  return (
    <BottomSheet
      open={!!draft}
      onClose={onClose}
      title={draft?.isNew ? t.exercises.newExercise : t.exercises.editExercise}
    >
      {value ? (
        <div className="space-y-4 pb-2">
          <Field label={t.exercises.nameField}>
            <input
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t.exercises.namePlaceholder}
              className="glass h-12 w-full rounded-2xl px-3 text-[17px] outline-none"
            />
          </Field>

          <Field label={t.exercises.primaryMuscle}>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={value.primary_muscle === m}
                  onClick={() => onChange({ ...value, primary_muscle: m })}
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.secondaryMuscles}>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={value.secondary_muscles.includes(m)}
                  onClick={() =>
                    onChange({ ...value, secondary_muscles: toggle(value.secondary_muscles, m) })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.specificTargets}>
            <div className="flex flex-wrap gap-2">
              {TARGET_MUSCLES.map((tm) => {
                const pos = value.muscle_targets.indexOf(tm);
                return (
                  <Chip
                    key={tm}
                    label={pos === 0 ? `★ ${tm}` : tm}
                    active={pos !== -1}
                    onClick={() =>
                      onChange({ ...value, muscle_targets: toggle(value.muscle_targets, tm) })
                    }
                  />
                );
              })}
            </div>
          </Field>

          <Field label={t.exercises.equipmentRequired}>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((eq) => (
                <Chip
                  key={eq.id}
                  label={eq.label}
                  active={value.equipment_required.includes(eq.id)}
                  onClick={() =>
                    onChange({
                      ...value,
                      equipment_required: toggle<EquipmentId>(value.equipment_required, eq.id),
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.movementPattern}>
            <div className="flex flex-wrap gap-2">
              {PATTERNS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={value.movement_pattern === p}
                  onClick={() => onChange({ ...value, movement_pattern: p })}
                />
              ))}
            </div>
          </Field>

          <button
            type="button"
            onClick={() => onChange({ ...value, compound: !value.compound })}
            className="glass flex min-h-[48px] w-full items-center justify-between rounded-2xl px-4"
          >
            <span className="text-[15px] font-semibold">{t.exercises.compoundMovement}</span>
            <span
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                value.compound
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {value.compound ? t.exercises.yes : t.exercises.no}
            </span>
          </button>

          <Field label={t.exercises.instructions}>
            <textarea
              value={value.instructions}
              onChange={(e) => onChange({ ...value, instructions: e.target.value })}
              rows={3}
              className="glass w-full rounded-2xl p-3 text-[17px] outline-none"
            />
          </Field>

          <Field label={t.exercises.formCues}>
            <textarea
              value={value.cues.join("\n")}
              onChange={(e) =>
                onChange({ ...value, cues: e.target.value.split("\n").filter((c) => c.trim()) })
              }
              rows={3}
              className="glass w-full rounded-2xl p-3 text-[17px] outline-none"
            />
          </Field>

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void save()}
              className="min-h-[50px] flex-1 rounded-2xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? t.exercises.savingExercise : t.exercises.saveExercise}
            </button>
            {!draft?.isNew ? (
              <button
                disabled={busy}
                aria-label={t.exercises.deleteExercise}
                onClick={() => void remove()}
                className="glass flex size-[50px] shrink-0 items-center justify-center rounded-2xl text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
