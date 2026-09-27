import { useEffect, useSyncExternalStore } from "react";
import type { RouteMap } from "./routeMap";

/**
 * Route maps live in IndexedDB, one per cardio session id, not in GymState:
 * at ~50 KB each they'd make the one localStorage blob (rewritten on every
 * change, and near its ~5 MB cap after a year of runs) slow and fragile. The
 * cost is that they stay on this device — cloud sync backs up the session's
 * numbers but not its map. Every call degrades to "no map" rather than
 * throwing, like the app's other optional storage.
 */
const DB_NAME = "forge-route-maps";
const STORE = "maps";

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

// A small cache + subscription so every view of a map updates together.
const cache = new Map<string, RouteMap | null>();
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

export async function putRouteMap(id: string, map: RouteMap): Promise<void> {
  cache.set(id, map);
  bump();
  try {
    await run("readwrite", (s) => s.put(map, id));
  } catch {
    // Shown for this visit from the cache; just not kept.
  }
}

export async function deleteRouteMap(id: string): Promise<void> {
  cache.set(id, null);
  bump();
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}

function load(id: string) {
  if (cache.has(id)) return;
  cache.set(id, null);
  run<RouteMap | undefined>("readonly", (s) => s.get(id))
    .then((m) => {
      if (m) {
        cache.set(id, m);
        bump();
      }
    })
    .catch(() => {});
}

/** The stored route map for a cardio session, or null (none, not loaded yet,
 *  or kept on another device). */
export function useRouteMap(id: string | null): RouteMap | null {
  useEffect(() => {
    if (id) load(id);
  }, [id]);
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => 0,
  );
  return id ? (cache.get(id) ?? null) : null;
}
