import { describe, expect, it } from "vitest";
import { decodeGym, encodeGym, gymCodeFrom, gymShareUrl } from "../equipmentShare";
import { decodeMeal, encodeMeal } from "../mealShare";

const gym = {
  name: "Garage gym 🏋️",
  active_equipment_ids: ["bodyweight", "barbell", "dumbbell", "bench"] as const,
  plates: { "1.25": 2, "5": 4, "20": 0 },
  bar_weight: 20,
  dumbbell_bar_weight: 2.5,
  loadable_dumbbells: true,
};

describe("gym sharing", () => {
  it("round-trips a gym, dropping plate sizes you don't own", () => {
    const back = decodeGym(
      encodeGym({ ...gym, active_equipment_ids: [...gym.active_equipment_ids] }),
    );
    expect(back).toEqual({
      ...gym,
      active_equipment_ids: [...gym.active_equipment_ids],
      plates: { "1.25": 2, "5": 4 },
    });
  });

  it("finds the code in a link and keeps meals and gyms apart", () => {
    const g = { ...gym, active_equipment_ids: [...gym.active_equipment_ids] };
    const code = encodeGym(g);
    expect(gymCodeFrom(gymShareUrl(g, "https://app.example"))).toBe(code);
    expect(gymCodeFrom("#meal=abc")).toBeNull();
    expect(decodeMeal(code)).toBeNull();
    expect(decodeGym(encodeMeal({ name: "x", ingredients: [] }))).toBeNull();
  });

  it("drops unknown equipment and rejects damaged or silly codes", () => {
    const make = (o: object) =>
      btoa(JSON.stringify({ v: 1, g: "x", e: ["barbell"], p: {}, b: 20, d: 2, l: true, ...o }));
    expect(decodeGym(make({ e: ["barbell", "jetpack"] }))?.active_equipment_ids).toEqual([
      "barbell",
    ]);
    expect(decodeGym(make({ e: ["jetpack"] }))).toBeNull();
    expect(decodeGym(make({ b: 5000 }))).toBeNull();
    expect(decodeGym(make({ p: { "5": 9999 } }))).toBeNull();
    expect(decodeGym("not a code")).toBeNull();
  });
});
