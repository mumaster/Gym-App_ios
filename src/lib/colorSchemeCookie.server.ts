import { getCookie } from "@tanstack/react-start/server";

/** Server-only: reads the `forge-color-scheme` cookie that `GymProvider`'s
 *  own effect (store.tsx) writes whenever the resolved light/dark scheme
 *  changes — see `__root.tsx`'s `head()` for why this exists at all. Kept
 *  in its own `.server.ts` file rather than inline in `__root.tsx`, which
 *  is also bundled for the client to hydrate `RootComponent`, because
 *  `@tanstack/react-start/server` is a server-only import the client
 *  bundle isn't allowed to pull in at all — attempting it there fails the
 *  build with "Import denied in client environment". */
export function readColorSchemeCookie(): string | undefined {
  return getCookie("forge-color-scheme");
}
