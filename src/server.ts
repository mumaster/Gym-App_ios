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

// The document response (the SSR'd HTML shell for a route like "/") has no
// per-request server data baked in — every route hydrates entirely from
// localStorage client-side (see store.tsx) — so, unlike a typical SSR app,
// it's safe to let the browser's own HTTP cache serve a recent copy of it
// without a network round-trip at all. That's not redundant with sw.js's
// own stale-while-revalidate handling of navigations: that only helps once
// a service worker is actually intercepting the request, and on iOS a cold
// launch's very first navigation can race ahead of a terminated SW waking
// back up to do that (see CLAUDE.md's Routing section for the fuller
// history here). Plain Cache-Control is checked by the browser's network
// stack itself, before any service worker gets a say, so it's the one
// layer that still helps even when that race is lost. A relatively short
// max-age (not the ~1yr the truly static manifest/icons use) keeps a real
// content change (the next deploy) reaching users reasonably promptly even
// in the worst case where the SW's own revalidation also isn't reached.
function withDocumentCaching(request: Request, response: Response): Response {
  if (request.method !== "GET" || response.status !== 200) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  if (response.headers.has("cache-control")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=3600");
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
