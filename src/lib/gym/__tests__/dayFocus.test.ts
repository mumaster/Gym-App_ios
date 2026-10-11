import { describe, expect, it } from "vitest";
import { EQUIPMENT } from "../data";
import { regionsForMuscles, REGION_TARGETS } from "../anatomy";
import { generateWorkout } from "../generator";
import { buildSchedule, musclesForSlot, SPLIT_TEMPLATES } from "../splits";
import { focusMuscles } from "../volume";
import type { FocusGroup } from "../volume";
import { exerciseById } from "../data";

const equipment = EQUIPMENT.map((e) => e.id);

function planFor(
  templateId: Parameters<typeof buildSchedule>[0],
  dayIdx: number,
  focus: FocusGroup[],
) {
  const slot = buildSchedule(templateId, [1, 2, 3, 4, 5, 6, 0].slice(0, 7))[dayIdx];
  if (!slot) return null;
  const muscles = musclesForSlot(templateId, slot, [], focus);
  if (!muscles.length) return null;
  const regions = regionsForMuscles(muscles, slot.dayId);
  const targets = regions.flatMap((r) => REGION_TARGETS[r]);
  const plan = generateWorkout({
    duration: 60,
    equipment,
    targets,
    focusMuscles: [...focusMuscles(focus)],
  });
  return { muscles, plan };
}

describe("a chosen day type drives the session", () => {
  it("never trains outside the day's muscles, whatever the growth focus", () => {
    for (const t of SPLIT_TEMPLATES) {
      const days = buildSchedule(t.id, [1, 2, 3, 4, 5, 6, 0]);
      for (let i = 0; i < days.length; i++) {
        const day = t.days.find((d) => d.id === days[i]!.dayId);
        if (!day || !day.muscles.length) continue;
        for (const focus of [[], ["arms", "shoulders"], ["glutes", "legs"]] as FocusGroup[][]) {
          const r = planFor(t.id, i, focus)!;
          expect(r.muscles).toEqual(day.muscles);
          const total = r.plan.reduce((n, p) => n + p.target_sets, 0);
          const inDay = r.plan
            .filter((p) => day.muscles.includes(exerciseById(p.exercise_id)!.primary_muscle))
            .reduce((n, p) => n + p.target_sets, 0);
          expect(inDay / total, `${t.id}#${i} ${day.id} focus=${focus}`).toBeGreaterThanOrEqual(
            0.7,
          );
        }
      }
    }
  });

  it("a full-body day with glutes + legs focus is mostly lower body", () => {
    const r = planFor("full_body", 0, ["glutes", "legs"])!;
    const lower = ["Glutes", "Quads", "Hamstrings", "Calves"];
    const sets = (pred: (m: string) => boolean) =>
      r.plan
        .filter((p) => pred(exerciseById(p.exercise_id)!.primary_muscle))
        .reduce((n, p) => n + p.target_sets, 0);
    expect(sets((m) => lower.includes(m))).toBeGreaterThan(sets((m) => !lower.includes(m)));
  });
});
