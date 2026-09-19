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

import appCss from "../styles.css?url";
import { GymProvider } from "../lib/gym/store";
import { loadCachedCatalog, refreshCatalog } from "../lib/gym/catalog";
import { registerServiceWorker } from "../pwa";
import { SplashScreen } from "../components/gym/SplashScreen";
import { TabBar } from "../components/gym/TabBar";

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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      // "black-translucent" makes iOS overlay the status bar transparently on
      // top of page content and blur/dim whatever's underneath for legibility
      // — that's the header-text blur users were seeing, not app CSS. "black"
      // gives a plain opaque status bar instead; since the app's own
      // background is already solid black (see theme-color below), it reads
      // identically without the blur artifact.
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "Forge" },
      { name: "theme-color", content: "#000000" },
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
      // black) → one frame of WebKit's own light-mode default canvas
      // (white) → the page's actual black paint takes over — precisely the
      // "black, then a brief white flash, then content" sequence reported
      // even after the launch-image fixes above landed and survived a
      // clean reinstall. Declaring dark here tells WebKit its own default
      // canvas is dark too, closing that specific gap.
      { name: "color-scheme", content: "dark" },
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
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Critical CSS: everything needed for the first paint to be a
            solid black screen, with zero network dependency. #forge-boot is
            SplashScreen's own root — covering the viewport in black from
            this rule (rather than only from Tailwind's `fixed inset-0
            bg-background`) means the first paint is correct even before
            styles.css has applied, which also hides the otherwise unstyled
            TabBar buttons underneath (UA-default buttons render light grey).
            ID specificity beats Tailwind's classes, but both resolve to the
            same plain black (--background is oklch(0 0 0) === #000), and
            opacity/pointer-events are left alone so the dismiss transition
            still works.
            color-scheme:dark mirrors the <meta name="color-scheme"> above
            (belt-and-suspenders, since this applies with zero dependency on
            HeadContent's own render order) and covers an even earlier gap:
            WebKit's default canvas color for the very first frame, before
            any author CSS has taken effect at all. */}
        <style>
          {"html,body{background-color:#000}html{color-scheme:dark}" +
            "#forge-boot{position:fixed;inset:0;z-index:100;background-color:#000}" +
            "html.css-pending #forge-boot *{visibility:hidden}"}
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
            it doesn't finish synchronously. Removing css-pending in that
            same tick (an earlier version of this did exactly that) raced it:
            content could become visible via the default `visibility` before
            Tailwind's styles had actually painted, showing unstyled,
            unpositioned content (a plain-bordered "outline" of the badge and
            wordmark) — worse than the flash this whole mechanism exists to
            prevent. A fixed frame count (an earlier version of THIS fix used
            a double requestAnimationFrame) isn't a reliable enough signal
            for how long that takes: it assumed flipping `rel` to
            "stylesheet" reuses the already-fetched preload response near-
            instantly, which held in this sandbox's only available test
            engine (Chromium) but not, per a real-device report, on iOS
            Safari — WebKit is documented as sometimes re-fetching rather
            than reusing the preload on that swap, so the real gap there can
            run well past a couple of frames. Polling `l.sheet.cssRules`
            instead waits for actual confirmation that the CSSOM has been
            built from this stylesheet — not a timing guess, and correct
            regardless of how many times the browser (re)fetches internally
            to get there — capped at 120 rAF ticks (~2s at 60fps) as a safety
            net so a same-origin read that somehow never resolves can't hang
            the reveal forever; the outer 3s setTimeout below is a second,
            independent backstop under that. The error and timeout paths
            skip waiting entirely and reveal immediately — there's no valid
            CSS arriving to paint against on those, so there's nothing to
            gain by waiting, and doing so keeps the unstyled fallback
            appearing as promptly as possible. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement;d.classList.add('css-pending');var h=" +
              JSON.stringify(appCss) +
              ";var l=document.createElement('link');l.rel='preload';l.as='style';l.href=h;" +
              "var settled=false;function reveal(){if(settled)return;settled=true;d.classList.remove('css-pending')}" +
              "var tries=0;function waitReady(){var ready=false;try{ready=!!(l.sheet&&l.sheet.cssRules&&l.sheet.cssRules.length>0)}catch(e){}" +
              "tries++;if(ready||tries>120){requestAnimationFrame(reveal)}else{requestAnimationFrame(waitReady)}}" +
              "function ok(){if(l.rel!=='stylesheet')l.rel='stylesheet';waitReady()}" +
              "function fail(){if(l.rel!=='stylesheet')l.rel='stylesheet';reveal()}" +
              "l.onload=ok;l.onerror=fail;setTimeout(fail,3000);document.head.appendChild(l)})()",
          }}
        />
        <noscript>
          <link rel="stylesheet" href={appCss} />
        </noscript>
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
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GymProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <TabBar />
        <SplashScreen />
      </GymProvider>
    </QueryClientProvider>
  );
}
