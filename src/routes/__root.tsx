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
            black (oklch(0 0 0) === #000). */}
        <style>{"html,body{background-color:#000}"}</style>
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
