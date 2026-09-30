/**
 * Which copy wins when a signed-in app starts: this device's or the cloud's.
 *
 * Before this, the cloud copy always won on every launch. But local edits
 * reach the cloud on a 1.5 s debounce, and iOS freezes or closes a
 * backgrounded PWA freely (opening a YouTube video from a workout is
 * enough), so the last few edits often never got there. The next launch
 * then replaced the newer local state with that older cloud copy: sets
 * logged mid-workout disappeared and an exercise, or one half of a
 * superset, started again at set 1.
 *
 * Now the device remembers a fingerprint of the state it last exchanged
 * with the cloud (pushed or pulled), per user. If the local state still
 * matches it, this device has nothing the cloud lacks, so the cloud copy
 * (possibly newer, from another device) is taken. If it differs, this
 * device has edits the cloud never received, and they're pushed instead.
 * With no fingerprint for this user (first sign-in on this device), an
 * existing cloud copy wins, as before: that's restoring onto a new phone.
 */

export interface SyncedMark {
  userId: string;
  hash: string;
}

const KEY = "forge.gym.synced.v1";

/** cyrb53: a fast 53-bit string hash. Only compares two states for
 *  equality on one device, so no cryptographic strength is needed. */
export function stateHash(json: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type Reconcile = "adoptCloud" | "pushLocal";

export function reconcile({
  userId,
  cloudExists,
  localHash,
  mark,
}: {
  userId: string;
  cloudExists: boolean;
  localHash: string;
  mark: SyncedMark | null;
}): Reconcile {
  if (!cloudExists) return "pushLocal";
  if (mark && mark.userId === userId && mark.hash !== localHash) return "pushLocal";
  return "adoptCloud";
}

export function loadSyncedMark(): SyncedMark | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SyncedMark) : null;
  } catch {
    return null;
  }
}

export function saveSyncedMark(mark: SyncedMark) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mark));
  } catch {
    // Storage full or blocked: the next launch falls back to cloud-wins.
  }
}

interface HasWorkouts<W extends { id: string; completed_sets: unknown[] }> {
  activeWorkout: W | null;
  workouts: { id: string }[];
}

/**
 * A cloud copy about to replace local state, with the workout in progress
 * protected: a cloud copy must never take logged sets away from a running
 * session. Keeps the local running workout when the cloud has the same one
 * with fewer sets, or doesn't know about it at all (started here, never
 * uploaded, and not finished on another device). Everything else comes
 * from the cloud as before. This also covers a first launch after this
 * change, when there's no fingerprint yet and the cloud copy wins.
 */
export function keepRunningWorkout<
  W extends { id: string; completed_sets: unknown[] },
  S extends HasWorkouts<W>,
>(local: S, cloud: S): S {
  const mine = local.activeWorkout;
  if (!mine) return cloud;
  const theirs = cloud.activeWorkout;
  if (theirs && theirs.id === mine.id) {
    return mine.completed_sets.length > theirs.completed_sets.length
      ? { ...cloud, activeWorkout: mine }
      : cloud;
  }
  if (!theirs && !cloud.workouts.some((w) => w.id === mine.id)) {
    return { ...cloud, activeWorkout: mine };
  }
  return cloud;
}
