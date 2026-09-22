import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Minus, Plus, ShieldOff, Trash2, X } from "lucide-react";
import { Card, Screen, SectionLabel } from "../components/gym/Screen";
import { EQUIPMENT, exerciseById } from "../lib/gym/data";
import { availableExercises } from "../lib/gym/generator";
import { DECIMAL_INPUT_RE, parseDecimal, selectOnFocus } from "../lib/gym/numericInput";
import { useTranslation } from "../lib/gym/i18n";
import { DEFAULT_PLATES, PLATE_SIZES } from "../lib/gym/plates";
import { haptic, useGym } from "../lib/gym/store";
import type { EquipmentId } from "../lib/gym/types";

export const Route = createFileRoute("/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment Profiles — Forge" },
      {
        name: "description",
        content:
          "Save gym setups like home dumbbells, hotel gym or full commercial gym and generate only workouts you can actually do.",
      },
      { property: "og:title", content: "Equipment Profiles — Forge" },
      {
        property: "og:description",
        content: "Save the gear you have at each gym and filter every workout to match.",
      },
    ],
  }),
  component: EquipmentScreen,
});

function EquipmentScreen() {
  const { profiles, activeProfileId, update, avoidedExerciseIds, toggleAvoidedExercise } = useGym();
  const t = useTranslation();
  const [editingId, setEditingId] = useState(activeProfileId);
  const editing = profiles.find((p) => p.id === editingId) ?? profiles[0]!;

  const toggle = (id: EquipmentId) => {
    haptic(12);
    update({
      profiles: profiles.map((p) =>
        p.id === editing.id
          ? {
              ...p,
              active_equipment_ids: p.active_equipment_ids.includes(id)
                ? p.active_equipment_ids.filter((x) => x !== id)
                : [...p.active_equipment_ids, id],
            }
          : p,
      ),
    });
  };

  const patch = (fields: Partial<(typeof profiles)[number]>) =>
    update({
      profiles: profiles.map((p) => (p.id === editing.id ? { ...p, ...fields } : p)),
    });

  const setPlate = (size: number, delta: number) =>
    patch({
      plates: {
        ...editing.plates,
        [String(size)]: Math.max(0, (editing.plates[String(size)] ?? 0) + delta),
      },
    });

  const addProfile = () => {
    const id = crypto.randomUUID();
    update({
      profiles: [
        ...profiles,
        {
          id,
          name: t.equipment.newGymName(profiles.length + 1),
          active_equipment_ids: ["bodyweight"],
          plates: { ...DEFAULT_PLATES },
          bar_weight: 20,
          dumbbell_bar_weight: 2,
        },
      ],
    });
    setEditingId(id);
  };

  return (
    <Screen title={t.equipment.title} subtitle={t.equipment.subtitle}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => setEditingId(p.id)}
            className={`min-h-[44px] shrink-0 rounded-full px-5 text-[15px] font-semibold ${
              p.id === editing.id
                ? "bg-primary text-primary-foreground"
                : "glass text-secondary-foreground"
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={addProfile}
          className="glass flex size-11 shrink-0 items-center justify-center rounded-full"
          aria-label={t.equipment.addProfile}
        >
          <Plus className="size-5 text-primary" />
        </button>
      </div>

      <SectionLabel>{t.equipment.profileName}</SectionLabel>
      <Card className="p-2">
        <input
          value={editing.name}
          onChange={(e) =>
            update({
              profiles: profiles.map((p) =>
                p.id === editing.id ? { ...p, name: e.target.value } : p,
              ),
            })
          }
          className="h-14 w-full rounded-xl bg-transparent px-3 text-[18px] font-semibold outline-none"
        />
      </Card>

      <SectionLabel>{t.equipment.availableEquipment}</SectionLabel>
      <Card className="divide-y divide-border p-0">
        {EQUIPMENT.map((e) => {
          const on = editing.active_equipment_ids.includes(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggle(e.id)}
              className="flex min-h-[56px] w-full items-center justify-between px-4 text-left"
            >
              <span className="text-[17px] font-medium">{e.label}</span>
              <span
                className={`flex size-7 items-center justify-center rounded-full ${
                  on ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {on ? <Check className="size-4" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </Card>

      <p className="mt-3 px-1 text-[13px] text-muted-foreground">
        {t.equipment.exercisesUnlocked(
          availableExercises(editing.active_equipment_ids, avoidedExerciseIds).length,
        )}
      </p>

      <SectionLabel>{t.equipment.avoidedExercises}</SectionLabel>
      <Card className="p-4">
        <p className="text-[13px] text-muted-foreground">{t.equipment.avoidedDesc}</p>
        {avoidedExerciseIds.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {avoidedExerciseIds.map((id) => {
              const ex = exerciseById(id);
              return (
                <button
                  key={id}
                  onClick={() => {
                    haptic(12);
                    toggleAvoidedExercise(id);
                  }}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-destructive/15 px-3 text-[14px] font-semibold text-destructive"
                >
                  <ShieldOff className="size-3.5" />
                  {ex?.name ?? id}
                  <X className="size-3.5" />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground/70">{t.equipment.noneYet}</p>
        )}
      </Card>

      <SectionLabel>{t.equipment.barWeights}</SectionLabel>
      <Card className="divide-y divide-border p-0">
        {(
          [
            [t.equipment.barbellSmithBar, "bar_weight"],
            [t.equipment.dumbbellHandle, "dumbbell_bar_weight"],
          ] as const
        ).map(([label, key]) => (
          <div key={key} className="flex min-h-[56px] items-center justify-between px-4">
            <span className="text-[17px] font-medium">{label}</span>
            <div className="flex items-center gap-2">
              <WeightField
                value={editing[key]}
                onCommit={(v) => patch({ [key]: v })}
                label={label}
              />
              <span className="text-[15px] text-muted-foreground">kg</span>
            </div>
          </div>
        ))}
      </Card>

      <SectionLabel>{t.equipment.platesOwned}</SectionLabel>
      <Card className="divide-y divide-border p-0">
        {PLATE_SIZES.map((size) => {
          const count = editing.plates[String(size)] ?? 0;
          return (
            <div key={size} className="flex min-h-[56px] items-center justify-between px-4">
              <span className="tabular text-[17px] font-medium">{size} kg</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    haptic(10);
                    setPlate(size, -1);
                  }}
                  aria-label={t.equipment.fewerPlates(size)}
                  className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <Minus className="size-4" />
                </button>
                <span className="tabular w-8 text-center text-[17px] font-bold">{count}</span>
                <button
                  onClick={() => {
                    haptic(10);
                    setPlate(size, 1);
                  }}
                  aria-label={t.equipment.morePlates(size)}
                  className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-2 px-1 text-[13px] text-muted-foreground">{t.equipment.plateHint}</p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            haptic(20);
            update({ activeProfileId: editing.id });
          }}
          className="flex min-h-[56px] flex-1 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground"
        >
          {activeProfileId === editing.id ? t.equipment.activeProfile : t.equipment.setAsActive}
        </button>
        {profiles.length > 1 ? (
          <button
            onClick={() => {
              const rest = profiles.filter((p) => p.id !== editing.id);
              update({
                profiles: rest,
                activeProfileId: activeProfileId === editing.id ? rest[0]!.id : activeProfileId,
              });
              setEditingId(rest[0]!.id);
            }}
            className="glass flex size-14 items-center justify-center rounded-2xl text-destructive"
            aria-label={t.equipment.deleteProfile}
          >
            <Trash2 className="size-5" />
          </button>
        ) : null}
      </div>
    </Screen>
  );
}

/** Keeps the raw text while typing so decimals like 2.5 don't get mangled. */
function WeightField({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (v: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      inputMode="decimal"
      type="text"
      aria-label={label}
      value={draft ?? String(value)}
      onFocus={selectOnFocus}
      onChange={(e) => {
        const next = e.target.value;
        if (!DECIMAL_INPUT_RE.test(next)) return;
        setDraft(next);
        const parsed = parseDecimal(next);
        if (next !== "" && Number.isFinite(parsed)) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
      className="tabular h-11 w-20 rounded-xl bg-muted px-3 text-right text-[17px] font-bold outline-none"
    />
  );
}
