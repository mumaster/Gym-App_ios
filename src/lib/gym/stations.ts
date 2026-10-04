import type { EquipmentId, Exercise } from "./types";

/**
 * Where an exercise's load is set: the barbell, the dumbbells, a cable stack,
 * a machine. In a superset you alternate between two exercises every round,
 * so two exercises on the same station would mean changing the weight twice
 * a round (asked for: no switching weights within a superset; changing the
 * weight of one exercise between its own sets, by RPE, is fine). This is a
 * rule about the flow of a workout, not a training number, so it has no
 * source.
 *
 * Equipment whose load is a setting you change: plates on a bar, which
 * dumbbell or kettlebell you hold, which band, the pin in a stack, the
 * plates on a leg press or leg developer. Bodyweight, a pull-up bar, dip
 * bars and a bench carry no load of their own.
 */
const LOADED: EquipmentId[] = [
  "barbell",
  "smith",
  "dumbbell",
  "kettlebell",
  "bands",
  "cable",
  "cable_high",
  "leg_press",
  "leg_developer",
];

/** "Pin-loaded machines" are separate machines in a gym, so each machine
 *  exercise is its own station — except these, which are usually one
 *  machine with two settings (the pec deck doubles as the rear-delt fly;
 *  hip adduction and abduction share a machine). */
const SHARED_MACHINES: Record<string, string> = {
  "pec-deck": "pec-deck",
  "reverse-pec-deck": "pec-deck",
  "machine-adduction": "hip-machine",
  "machine-abduction": "hip-machine",
};

/** The load stations an exercise uses. Empty for bodyweight exercises. */
export function loadStations(ex: Exercise): string[] {
  const stations: string[] = ex.equipment_required.filter((e) => LOADED.includes(e));
  if (ex.equipment_required.includes("machine"))
    stations.push(`machine:${SHARED_MACHINES[ex.id] ?? ex.id}`);
  return stations;
}

/** The station two exercises share, if any: pairing them in a superset would
 *  mean changing the weight every round. */
export function sharedStation(a: Exercise, b: Exercise): string | undefined {
  const theirs = loadStations(b);
  return loadStations(a).find((s) => theirs.includes(s));
}

export const sharesLoadStation = (a: Exercise, b: Exercise): boolean =>
  sharedStation(a, b) !== undefined;
