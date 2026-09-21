const UPDATE_AVAILABLE_EVENT = "forge:update-available";

/** Registers Forge's service worker (public/sw.js) — see that file for why it's
 * hand-written rather than build-generated. Safe to call anywhere: no-ops
 * outside the browser or when the API isn't available (e.g. plain HTTP). */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      // A controller already present at registration time means this page
      // load was served by a service worker that was already active from a
      // PREVIOUS visit — so a later controllerchange is a genuine version
      // swap worth telling the user about. On a page's very first-ever SW
      // registration there's no controller yet, and the controllerchange
      // that fires once install/activate finishes is just that first
      // takeover, not an update — nothing to announce.
      const hadControllerAtLoad = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadControllerAtLoad) window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
      });

      // Force-quitting and reopening the installed PWA is a fresh page load,
      // but that alone doesn't guarantee the browser re-checks sw.js against
      // the server — iOS Safari's own update check is lazy/throttled, which
      // is exactly why "force close and reopen" was reported as not picking
      // up a new deploy. Explicitly asking on every foreground (both this
      // initial load and any later resume-from-background) makes that the
      // actual, reliable trigger instead of hoping the browser gets to it
      // on its own schedule. Our sw.js already calls skipWaiting()/
      // clients.claim() unconditionally, so a found update installs and
      // takes over on its own — this only needs to ask, not drive the
      // install/activate steps itself.
      void registration.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    });
  };
  // This runs from a React effect, which typically fires after `load` has
  // already happened — registering immediately in that case rather than
  // waiting on an event that's already passed.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** Subscribes to "a new version has taken over" — fires at most once per
 *  update (a fresh controllerchange each time a newer SW activates over an
 *  already-active one). Deliberately NOT an auto-reload: the new shell is
 *  already active and will be used on the next navigation regardless, but
 *  forcing that navigation out from under someone mid-workout or mid-typing
 *  would be disruptive, so the caller decides when (and whether) to prompt
 *  for a reload. Returns an unsubscribe function. */
export function onUpdateAvailable(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATE_AVAILABLE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, callback);
}
