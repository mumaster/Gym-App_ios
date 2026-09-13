/** Registers Forge's service worker (public/sw.js) — see that file for why it's
 * hand-written rather than build-generated. Safe to call anywhere: no-ops
 * outside the browser or when the API isn't available (e.g. plain HTTP). */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const register = () => void navigator.serviceWorker.register("/sw.js");
  // This runs from a React effect, which typically fires after `load` has
  // already happened — registering immediately in that case rather than
  // waiting on an event that's already passed.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
