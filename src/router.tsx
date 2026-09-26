import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Crossfades pages on navigation via document.startViewTransition where
    // supported (iOS Safari 18+, Chromium); elsewhere it's the old instant
    // switch. The styling lives in styles.css under "Page transitions".
    defaultViewTransition: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
