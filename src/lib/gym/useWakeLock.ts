import { useEffect, useRef } from "react";

/**
 * Holds a screen wake lock while `enabled` so the phone doesn't sleep mid-set.
 * Silent no-op where unsupported (iOS < 16.4) or rejected (battery saver). The OS
 * drops the lock when the tab is hidden; this re-acquires it when visible again.
 */
export function useWakeLock(enabled: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel.current) return;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel.current = s;
        s.addEventListener("release", () => {
          sentinel.current = null;
        });
      } catch {
        /* not visible / battery saver — retried on next visibilitychange */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel.current?.release();
      sentinel.current = null;
    };
  }, [enabled]);
}
