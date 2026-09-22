import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// The document response (the SSR'd HTML shell for a route like "/") used to
// embed no per-USER server data at all — every route hydrated its actual
// state entirely from localStorage client-side (see store.tsx) — which
// made it safe to let the browser's own HTTP cache serve a recent copy of
// it without a network round-trip. `__root.tsx`'s head() broke that
// invariant on purpose: it now reads a `forge-color-scheme` cookie to pick
// the SSR'd status-bar/theme-color meta values (see its own comment), so
// this document's bytes DO depend on the request now, for anyone who's
// ever had the app open at least once (the cookie gets written the moment
// GymProvider's own effect first runs, so in practice almost every request
// past a user's very first-ever page load carries it).
//
// A `Vary: Cookie` response header is the textbook fix for exactly this —
// letting the browser's own cache key on the cookie's value, so a scheme
// change naturally busts the old cached entry — and an earlier version of
// this function did exactly that. Reverted after testing showed Chromium's
// disk cache doesn't reliably honor `Vary: Cookie` in practice: a document
// cached from a cookie-less request (unavoidable on anyone's actual first
// visit, before the cookie exists yet) kept being replayed for later
// requests that DID carry the cookie, serving the stale dark meta values
// straight through a scheme change — reproduced with a plain `fetch()`
// from Node working correctly every time while Chromium (via Playwright)
// consistently served the stale cached entry for the identical request.
// Since that first, uncached-cookie request is also the one poisoning
// entry, and it's a one-time event per browser (every request after it has
// the cookie), the only fully reliable fix is to stop letting the browser
// cache this document at all — `no-store`, unconditionally, on every
// request, not just cookie-bearing ones. sw.js's own PAGES_CACHE still
// covers the original "instant cold launch, before a service worker has
// even had a chance to wake up" case this used to help with, so this isn't
// a total loss of that optimization — just the one extra,
// slightly-faster-than-the-SW layer. That SW cache has its own, different
// version of this same cookie problem — it can't read the Cookie header at
// all (a service worker's fetch event redacts it, unlike this plain HTTP
// layer, which sees the real request) — see sw.js's own comment for why
// that one settles for a bounded, self-correcting staleness instead of a
// clean fix.
function withDocumentCaching(request: Request, response: Response): Response {
  if (request.method !== "GET" || response.status !== 200) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  if (response.headers.has("cache-control")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withDocumentCaching(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
