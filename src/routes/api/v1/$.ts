import { createFileRoute } from "@tanstack/react-router";

/** Mefticaret REST API v1: /api/v1/<kaynak>. Her istek API anahtarı ve scope doğrulaması gerektirir. */

async function handler({ request, params }: { request: Request; params: { _splat?: string } }) {
  const { handleApiRequest } = await import("@/lib/api-router.server");
  return handleApiRequest(request, `v1/${params._splat ?? ""}`);
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      OPTIONS: handler,
    },
  },
});
