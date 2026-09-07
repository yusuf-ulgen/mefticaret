import { QueryClient, timeoutManager } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const isPrerendering =
  typeof process !== "undefined" && process.env["TSS_PRERENDERING"] === "true";

if (isPrerendering) {
  timeoutManager.setTimeoutProvider({
    setTimeout: (cb, ms) => {
      const id = setTimeout(cb, ms);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (cb, ms) => {
      const id = setInterval(cb, ms);
      (id as unknown as { unref?: () => void }).unref?.();
      return id;
    },
    clearInterval: (id) => clearInterval(id),
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 30_000,
  });

  return router;
};
