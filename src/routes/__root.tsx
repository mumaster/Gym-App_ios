import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";

import appCss from "../styles.css?url";
import { readColorSchemeCookie } from "../lib/colorSchemeCookie.server";
import { GymProvider } from "../lib/gym/store";
import { loadCachedCatalog, refreshCatalog } from "../lib/gym/catalog";
import { registerServiceWorker } from "../pwa";
import { SplashScreen } from "../components/gym/SplashScreen";
import { TabBar } from "../components/gym/TabBar";
import { UpdateBanner } from "../components/gym/UpdateBanner";

// `head()` below runs both server-side (for the actual SSR'd document) and
// client-side (TanStack Router re-invokes a route's head() during
// client-side navigation, to keep <HeadContent/> in sync without a full
// reload) — so this needs a real implementation on both sides, not just a
// server-only one. The server side reads the request's actual Cookie
// header via readColorSchemeCookie (kept in its own .server.ts file since
// @tanstack/react-start/server can't be imported into this file at all —
// __root.tsx also hydrates RootComponent on the client); the client side
// has no request to read a Cookie header from, but doesn't need one either
// — document.cookie is a plain, always-available browser API, reading the
// exact same cookie GymProvider's own effect (store.tsx) just wrote.
const getColorSchemeCookie = createIsomorphicFn()
  .server(readColorSchemeCookie)
  .client(() => document.cookie.match(/(?:^|;\s*)forge-color-scheme=([^;]*)/)?.[1]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: async () => {
    // Read at request time, not client-side, since the whole point is
    // getting the FIRST server response right — GymProvider's own effect
    // (store.tsx) already corrects these two meta tags' live DOM content
    // after hydration, every time colorScheme changes, but on an installed
    // iOS PWA that correction is too late to matter: iOS reads
    // apple-mobile-web-app-status-bar-style straight from this SSR'd HTML
    // at cold-launch time, before any of the app's JS has run, and every
    // fresh launch re-fetches (or gets served, see server.ts's caching) the
    // exact same head() output — so a client-only fix can genuinely never
    // self-correct here, confirmed by a report that force-quitting and
    // reopening still showed the old value. `forge-color-scheme` (written
    // by that same store.tsx effect via document.cookie, alongside the
    // localStorage write everything else here already does) carries the
    // one bit an HTTP request actually can: the RESOLVED scheme ("dark" or
    // "light", already resolved from "system" client-side, since matchMedia
    // has no server equivalent) as of the last time it changed in a
    // browser. Defaults to dark (this app's original, only-ever-shipped
    // look) when the cookie hasn't been set yet — a first-ever visit, or
    // any client that predates this cookie.
    const dark = getColorSchemeCookie() !== "light";
    return {
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
        },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        // "black-translucent" makes iOS overlay the status bar transparently
        // on top of page content and blur/dim whatever's underneath for
        // legibility — that's the header-text blur users were seeing, not
        // app CSS. "black"/"default" give a plain opaque bar instead,
        // matching whichever of --background's two values is currently
        // active, so it reads as a continuation of the page rather than a
        // mismatched strip — see this same reasoning in "default" below.
        { name: "apple-mobile-web-app-status-bar-style", content: dark ? "black" : "default" },
        { name: "apple-mobile-web-app-title", content: "Forge" },
        // #f2f2f7 mirrors .light's own --background choice in styles.css
        // (iOS's light "systemGroupedBackground" rather than pure white).
        { name: "theme-color", content: dark ? "#000000" : "#f2f2f7" },
        // Without this, WebKit's default color-scheme is "light" — which
        // controls more than form/scrollbar theming: it's also the UA's
        // default canvas color for the very first frame it paints, before
        // ANY author CSS has taken effect (inline <style> included, since
        // even that has to wait for the parser to reach <body> and for a
        // style/layout pass to run). That's a separate, earlier gap than the
        // one the inline <style> below closes, and a separate mechanism again
        // from the native apple-touch-startup-image launch screen above — it
        // only governs the launch IMAGE shown before WebKit starts painting
        // the page at all, not this handoff moment once it does. On an
        // installed iOS PWA this reads as: native launch image (now correctly
        // matching this mode) → one frame of WebKit's own opposite-mode
        // default canvas → the page's actual paint takes over — precisely
        // the "black, then a brief white flash, then content" sequence
        // reported even after the launch-image fixes above landed and
        // survived a clean reinstall (for a dark-mode cold launch; the light
        // case now avoids the mirror-image flash the same way). Declaring
        // the resolved scheme here tells WebKit its own default canvas
        // matches too, closing that specific gap — mirrors RootShell's own
        // inline `color-scheme` for the same reason that one's set twice:
        // this meta tag's application depends on HeadContent's own render
        // order, the inline `<style>` doesn't, so RootShell's copy is the
        // one guaranteed to apply first if the two ever raced.
        { name: "color-scheme", content: dark ? "dark" : "light" },
        { title: "Forge — Smart Workout Generator & Tracker" },
        {
          name: "description",
          content:
            "Generate gym workouts from your time, equipment and target muscles, then log every set with rest timers and PR tracking.",
        },
        { property: "og:title", content: "Forge — Smart Workout Generator & Tracker" },
        {
          property: "og:description",
          content: "Time-, equipment- and muscle-aware workout generation with live set logging.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        // styles.css is deliberately NOT listed here as a plain
        // rel="stylesheet" — that makes it render-blocking, which gates the
        // ENTIRE first paint (the inline <style> in RootShell included) on a
        // ~94KB network fetch. RootShell loads it non-blockingly instead; see
        // the comment there for the full reasoning.
        { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/pwa/icon-180.png" },
        // iOS's own native launch screen for a home-screen-installed PWA is
        // shown before any of the page's own HTML/CSS/JS ever runs, so no
        // amount of in-page fix (see the inline <style> below) can touch it —
        // it's a separate mechanism entirely. iOS Safari's support for the
        // manifest's background_color as that launch screen's color has long
        // been inconsistent across versions (ours is already correctly set to
        // #000000, but that alone isn't reliably honored), so the standard,
        // reliable fix is these apple-touch-startup-image links instead: one
        // solid-black PNG per common iPhone screen size (device pixels =
        // CSS points × the device's pixel ratio), each scoped to exactly that
        // device via its media query, so iOS shows black immediately rather
        // than defaulting to white while the page loads. Portrait only, since
        // the app doesn't support landscape.
        //
        // These media queries match on EXACT device-width/device-height/
        // pixel-ratio — a real, ongoing gap, not a one-time list to finish:
        // any device released after this list was written (or any model
        // just not covered) matches none of them and gets iOS's white
        // default regardless of this fix being in place. The catch-all
        // entry at the end, with no media query at all, is what actually
        // closes that gap — Safari falls back to it when nothing more
        // specific matches, so an uncovered/newer device still gets solid
        // black instead of white. Reuses the largest existing image (any
        // solid black PNG works as a fallback; exact fit doesn't matter for
        // a flat color) rather than shipping another asset for it.
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/x-xsmax11pro-splash.png",
          media:
            "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/xr-11-splash.png",
          media:
            "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/xsmax-11promax-splash.png",
          media:
            "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/12-13-14-splash.png",
          media:
            "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/12-13promax-14plus-splash.png",
          media:
            "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/14pro-15-16-splash.png",
          media:
            "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/14promax-15plus-16plus-splash.png",
          media:
            "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/16pro-splash.png",
          media:
            "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/16promax-splash.png",
          media:
            "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
        },
        // Catch-all fallback — no media query, so Safari uses it for any
        // device none of the entries above matched. Must stay last: a
        // device this list DOES cover should still get its own exact-size
        // image above, not this one.
        {
          rel: "apple-touch-startup-image",
          href: "/pwa/splash/16promax-splash.png",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Same cookie getColorSchemeCookie() already reads for head()'s meta tags
  // (see that function's own comment) — reused here for a second, distinct
  // reason found afterward: iOS 26+'s "Liquid Glass" redesign changed how
  // WebKit tints the status bar/home-indicator area for an installed PWA.
  // It no longer reliably honors apple-mobile-web-app-status-bar-style/
  // theme-color the way earlier iOS versions did — confirmed by the status
  // bar staying black even once those meta tags were proven (via direct
  // curl/fetch against the deployed server, bypassing every cache layer)
  // to be correctly serving "default"/"#f2f2f7" for a light-mode cookie.
  // Multiple independent reports (as of September 2026) describe Safari 26
  // instead sampling the actual rendered page background at the very top of
  // the viewport — i.e., this <html>/<body> background and, during the
  // splash's cold-launch window, #forge-boot's own background below, not a
  // meta tag at all. Both were unconditionally black before this, the same
  // "always dark first" gap already accepted for the *content* flash (see
  // the "Light/dark/system color scheme" section in CLAUDE.md) — except on
  // iOS 26+ this isn't just a one-frame flash, it's what the status bar
  // itself is (or was, at time of writing) actually tinted from, so it
  // needs the SSR'd values themselves to be correct, not just corrected
  // post-hydration. Rendering the wrong class here would still cause a
  // real hydration mismatch against the client's own (correct) render, so
  // this calls the exact same isomorphic getColorSchemeCookie() head() uses
  // — both sides resolve the identical cookie, keeping server and client
  // renders in agreement.
  const dark = getColorSchemeCookie() !== "light";
  return (
    <html lang="en" className={dark ? "dark" : "light"}>
      <head>
        {/* Critical CSS: everything needed for the first paint to be a
            solid black (or, in light mode, the app's light background)
            screen, with zero network dependency. #forge-boot is
            SplashScreen's own root — covering the viewport in this same
            color from this rule (rather than only from Tailwind's `fixed
            inset-0 bg-background`) means the first paint is correct even
            before styles.css has applied, which also hides the otherwise
            unstyled TabBar buttons underneath (UA-default buttons render
            light grey). ID specificity beats Tailwind's classes, but both
            resolve to the same color either way (--background is
            oklch(0 0 0) === #000 in dark, .light's own oklch(0.97 0.002
            260) ≈ #f2f2f7 in light — this hex is a plain approximation for
            a context with no oklch() support to fall back on, not the
            source of truth those CSS custom properties remain), and
            opacity/pointer-events are left alone so the dismiss transition
            still works. This SSR'd solid-color choice is what fixed the
            status bar staying black in light mode on iOS 26+ specifically
            — see the comment on RootShell's own `dark` above for why a
            content-flash-only fix (correcting the class post-hydration)
            wasn't enough there.
            color-scheme mirrors the <meta name="color-scheme"> above
            (belt-and-suspenders, since this applies with zero dependency on
            HeadContent's own render order) and covers an even earlier gap:
            WebKit's default canvas color for the very first frame, before
            any author CSS has taken effect at all. */}
        <style>
          {`html,body{background-color:${dark ? "#000" : "#f2f2f7"}}html{color-scheme:${dark ? "dark" : "light"}}` +
            `#forge-boot{position:fixed;inset:0;z-index:100;background-color:${dark ? "#000" : "#f2f2f7"}}` +
            "html.css-pending #forge-boot *{visibility:hidden}" +
            "html.no-transition #forge-boot *{transition:none!important}"}
        </style>
        <HeadContent />
        {/* styles.css is loaded via preload+swap rather than a plain
            rel="stylesheet", because a render-blocking stylesheet gates the
            entire first paint — including the inline rule above — on that
            ~94KB file arriving. On a cold launch of the installed PWA with
            an evicted HTTP cache (iOS is aggressive about this, and a
            reinstall guarantees it), that's a real network round-trip during
            which the OS shows its own backdrop instead of our content: the
            white flash. Safari-on-reload never showed it because Safari
            holds the previous frame until the new first paint, and a cold
            PWA launch has no previous frame to hold.
            Injecting the link from script (rather than emitting a
            rel="preload" tag plus a separate swap script) keeps this free of
            any dependency on head tag ordering — React hoists link/script
            tags, and an id lookup that ran before its target existed would
            silently leave the app unstyled. The load handler flips it to a
            real stylesheet the moment it's available; the error and timeout
            paths flip it anyway so a failed preload degrades to a normal
            (blocking) stylesheet fetch rather than an unstyled app.
            The `css-pending` class it adds up front (and removes on any of
            those three paths) drives the rule above that hides the splash's
            CONTENTS until the real stylesheet lands. Without it the pre-CSS
            paint isn't actually black: `color-scheme: dark` makes WebKit's
            default text color WHITE, so the FORGE wordmark and the
            currentColor SVG render white-on-black, unpositioned — measured
            at ~2.4k bright pixels including pure white. Hiding them keeps
            the first frame pure black, so the splash animation plays from
            its proper start instead of jumping out of an unstyled state.
            It's added by script, not baked into the SSR'd HTML, precisely so
            that a JS-off client (which gets the <noscript> stylesheet below)
            never ends up with permanently invisible content.
            On the success path specifically, flipping `rel` to "stylesheet"
            only STARTS the browser applying the CSS (parse/recalc/layout) —
            it doesn't finish synchronously. Two earlier attempts at waiting
            for that both failed on real iOS Safari despite checking out in
            this sandbox's only available test engine (a Chromium-only
            Playwright install — no WebKit build to actually verify against):
            a fixed frame count assumed the preload response gets reused
            near-instantly on the rel swap, which doesn't hold on WebKit
            (documented to sometimes re-fetch instead); polling
            `l.sheet.cssRules.length` next, on the theory that confirms the
            CSSOM is built — reported back as still showing the badge with
            square (pre-rounded) corners and the wordmark flashing visible
            then vanishing, meaning cssRules being populated does NOT imply
            the browser has finished computing styles from it across the
            page, at least not reliably on WebKit; those are apparently more
            separable pipeline stages there than on Chromium, where checking
            actual computed style (not cssRules) never showed a gap in
            testing.
            So: check computed style directly, which is the one signal that
            can't lie about what the browser has actually rendered regardless
            of engine-specific pipeline timing. `--background` is a plain CSS
            custom property `styles.css`'s `:root` sets and nothing in this
            page's inline critical CSS touches, so its presence is an
            unambiguous, engine-agnostic proof that styles.css has actually
            been applied — not just fetched, not just parsed into a
            stylesheet object, but applied. Capped at 120 rAF ticks (~2s at
            60fps) as a safety net so a check that somehow never resolves
            can't hang the reveal forever; the outer 3s setTimeout below is a
            second, independent backstop under that. The error and timeout
            paths skip waiting entirely and reveal immediately — there's no
            valid CSS arriving to paint against on those, so there's nothing
            to gain by waiting, and doing so keeps the unstyled fallback
            appearing as promptly as possible.
            None of the above was actually the "outline" bug's root cause,
            though — it was still reproducing even once revealing waited for
            confirmed-applied computed style, including in plain Safari (not
            just the installed PWA), which is what exposed that this was
            never really a reveal-TIMING problem. `duration-[500ms]` (on the
            badge) and `duration-[550ms]` (on the wordmark's own
            `transition-all`) compile to a flat `transition-duration`
            unconditionally — Tailwind sets it whether or not a `transition`
            utility is present alongside it, and `transition-property`
            defaults to `all`. That means these elements have an ACTIVE
            transition on every property from the moment they exist, so the
            very first time their styles resolve — jumping from unstyled
            (`border-radius: 0`, default opacity 1) to Tailwind's real values
            (`rounded-[2rem]`'s 32px, `opacity-0` while `textVisible` is
            still false) — that jump itself gets caught by the transition
            and animates over hundreds of ms, instead of applying instantly:
            a square box slowly rounding into shape, wordmark text fading
            out instead of just already being invisible. This was always
            latent — it's invisible when styles.css blocks first paint
            (the ORIGINAL bug this whole mechanism exists to fix), since
            there's never an unstyled state to transition FROM in that case.
            Making CSS non-blocking is what first made an unstyled state
            possible to observe, which is what surfaced this.
            `no-transition` (companion to `css-pending`, same lifecycle)
            blocks all transitions under `#forge-boot` for that entire
            window, so this first, unstyled-to-styled jump can only ever
            apply instantly — never animated — regardless of exactly when
            reveal happens. Legitimate transitions (the wordmark's own
            opacity fade, driven later by React's `textVisible` state) are
            unaffected: by the time that happens, `no-transition` is long
            gone and the jump it exists to suppress already resolved. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;d.classList.add('css-pending');d.classList.add('no-transition');var h=" +
              JSON.stringify(appCss) +
              ";var l=document.createElement('link');l.rel='preload';l.as='style';l.href=h;" +
              "var settled=false;function reveal(){if(settled)return;settled=true;d.classList.remove('css-pending');d.classList.remove('no-transition')}" +
              "var tries=0;function cssApplied(){try{return getComputedStyle(d).getPropertyValue('--background').trim()!==''}catch(e){return false}}" +
              "function waitReady(){tries++;if(cssApplied()||tries>120){requestAnimationFrame(reveal)}else{requestAnimationFrame(waitReady)}}" +
              "function ok(){if(l.rel!=='stylesheet')l.rel='stylesheet';waitReady()}" +
              "function fail(){if(l.rel!=='stylesheet')l.rel='stylesheet';reveal()}" +
              "l.onload=ok;l.onerror=fail;setTimeout(fail,3000);document.head.appendChild(l)})()",
          }}
        />
        <noscript>
          <link rel="stylesheet" href={appCss} />
        </noscript>
        {/* Self-heal from a stale cached app shell. sw.js's navigation
            handler is stale-while-revalidate (see that file), and the
            document itself carries an hour-long Cache-Control
            (src/server.ts's withDocumentCaching) — both deliberate tradeoffs
            for a fast cold launch, but both mean a device can be served an
            OLD cached HTML after a new deploy whose <Scripts/> tags point at
            content-hashed JS files a fresh deploy has since replaced. That
            script 404s, React never mounts, and SplashScreen — whose own
            entrance animation is pure CSS and plays fine from the SSR'd
            markup with zero JS — gets stuck showing the badge/bar forever
            with no wordmark, since that's gated by React state that never
            arrives. Reported in the wild as exactly that: the animated badge
            with no text, unrecoverable by force-quitting the app (which just
            re-serves the same stale cache) — only fixed by fully deleting
            and reinstalling the Home Screen icon, which forces a genuinely
            fresh fetch. This script catches that class of failure directly
            instead of relying on a user to know that trick: a capture-phase
            listener (resource load errors don't bubble, but capture-phase
            dispatch to ancestors still happens) catches a failed <script>
            tag, and an unhandledrejection listener catches a failed dynamic
            import (the phrasing varies by engine, hence the loose regex).
            Either one triggers up to two auto-reloads, spaced out to give
            the service worker's background revalidation (already in flight
            since the first failed load) a real chance to land a fresh shell
            before the retry. If it's still failing after that — e.g.
            genuinely offline — a plain, Tailwind-independent fallback button
            appears instead of a silent infinite loop, since Tailwind's own
            CSS may be exactly what failed to load. The attempt counter lives
            in sessionStorage so it survives the reload it triggers, and is
            cleared on a real successful mount (see RootComponent's effect)
            so one bad launch doesn't poison a later, unrelated failure. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var KEY='forge-reload-attempts';var MAX=2;var handled=false;" +
              "function attempts(){try{return parseInt(sessionStorage.getItem(KEY)||'0',10)}catch(e){return 0}}" +
              "function showFallback(){var el=document.createElement('div');" +
              "el.setAttribute('style','position:fixed;inset:0;z-index:200;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:24px');" +
              'el.innerHTML=\'<p style="font-size:16px;opacity:.85;max-width:280px">Forge couldn\\\'t finish loading.</p><button id="forge-reload-btn" style="background:#fff;color:#000;border:none;border-radius:999px;padding:12px 24px;font-size:15px;font-weight:600">Reload</button>\';' +
              "document.body.appendChild(el);" +
              "document.getElementById('forge-reload-btn').addEventListener('click',function(){try{sessionStorage.removeItem(KEY)}catch(e){}location.reload()})}" +
              "function bumpAndReload(){if(handled)return;handled=true;var n=attempts();" +
              "if(n<MAX){try{sessionStorage.setItem(KEY,String(n+1))}catch(e){}setTimeout(function(){location.reload()},1200)}else{showFallback()}}" +
              "window.addEventListener('error',function(e){var t=e&&e.target;if(t&&t.tagName==='SCRIPT')bumpAndReload()},true);" +
              "window.addEventListener('unhandledrejection',function(e){var msg=(e&&e.reason&&(e.reason.message||String(e.reason)))||'';" +
              "if(/fetch dynamically imported module|importing a module script failed|failed to fetch/i.test(msg))bumpAndReload()})})()",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    loadCachedCatalog();
    void refreshCatalog();
    registerServiceWorker();
    // A real mount means the stale-shell auto-reload above (if it fired)
    // did its job — clear its attempt counter so a later, unrelated
    // failure starts its own fresh retry budget instead of inheriting
    // whatever was left over from this one.
    try {
      sessionStorage.removeItem("forge-reload-attempts");
    } catch {
      /* sessionStorage unavailable — nothing to clean up */
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GymProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <TabBar />
        <SplashScreen />
        <UpdateBanner />
      </GymProvider>
    </QueryClientProvider>
  );
}
