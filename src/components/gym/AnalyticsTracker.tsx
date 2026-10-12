import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { flushEvents, track } from "../../lib/gym/analytics";
import { useGym } from "../../lib/gym/store";

/** The screen a path shows, without ids: "/history/abc-123" → "history/:id". */
export function screenOf(pathname: string): string {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .map((p) => (/^[0-9a-f-]{8,}$/i.test(p) || /^\d{4}-\d{2}-\d{2}$/.test(p) ? ":id" : p));
  return parts.join("/") || "home";
}

/** Mounted once in the root: screen views, JavaScript errors, and sending
 *  what's queued when the app goes to the background. Renders nothing. */
export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Wait for the saved state: the statistics setting isn't known before it.
  const { hydrated } = useGym();
  useEffect(() => {
    if (hydrated) track("screen.viewed", { screen: screenOf(pathname) });
  }, [pathname, hydrated]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // A failed <script>/<img> load has no message; those are handled elsewhere.
      if (!e.message || /ResizeObserver loop/i.test(e.message)) return;
      track("error.js", { message: e.message.slice(0, 120), source: "window" });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: unknown } | undefined;
      const message = typeof r?.message === "string" ? r.message : String(e.reason ?? "");
      track("error.js", { message: message.slice(0, 120), source: "promise" });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushEvents();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushEvents);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushEvents);
    };
  }, []);

  return null;
}
