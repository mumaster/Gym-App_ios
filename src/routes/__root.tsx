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
      { rel: "stylesheet", href: appCss },
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
        {/* The app's black background otherwise comes entirely from the
            external styles.css stylesheet linked below — until that
            finishes its network round-trip, html/body have no background
            set at all, so the browser paints its default white in the gap.
            This inline rule applies the instant the HTML parses, with no
            request to wait on, so there's no white flash before SplashScreen
            (or its own background) ever gets a chance to paint. Kept in
            sync with --background in styles.css by being the same plain
            black (oklch(0 0 0) === #000).
            color-scheme:dark here (mirroring the <meta name="color-scheme">
            above, belt-and-suspenders since this applies synchronously with
            zero dependency on HeadContent's own render order) closes a
            separate, EARLIER gap than background-color does: it's WebKit's
            default canvas color for the very first frame it paints, before
            this rule (or any author CSS) has actually taken effect, which
            otherwise defaults to light/white. */}
        <style>{"html,body{background-color:#000}html{color-scheme:dark}"}</style>
        <HeadContent />
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
