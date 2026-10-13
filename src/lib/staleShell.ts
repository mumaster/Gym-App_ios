const ATTEMPTS_KEY = "forge-reload-attempts";
const MAX_ATTEMPTS = 2;

/** True for the errors a page throws when a lazy JS chunk it asks for was
 *  deleted by a newer deploy (wording differs per engine). */
export function isChunkLoadError(error: unknown): boolean {
  const msg =
    (error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "")) || "";
  return /fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to fetch|Unexpected token '<'|ChunkLoadError/i.test(
    msg,
  );
}

function attempts(): number {
  try {
    return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

/** Shares the retry budget with the inline script in __root.tsx, so a real
 *  failure (e.g. offline) ends in the error screen instead of a reload loop. */
export function canAutoRecover(): boolean {
  return attempts() < MAX_ATTEMPTS;
}

/** Asks the service worker to drop its cached app shell, then reloads so the
 *  new deploy's HTML (and matching JS) is fetched from the network. */
export function recoverFromStaleShell(): void {
  try {
    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts() + 1));
  } catch {
    /* sessionStorage unavailable: the reload still happens once per error */
  }
  let done = false;
  const reload = () => {
    if (done) return;
    done = true;
    location.reload();
  };
  const controller = typeof navigator !== "undefined" && navigator.serviceWorker?.controller;
  if (controller) {
    const channel = new MessageChannel();
    channel.port1.onmessage = reload;
    controller.postMessage({ type: "forge:revalidate-shell" }, [channel.port2]);
    setTimeout(reload, 1500);
  } else {
    reload();
  }
}
