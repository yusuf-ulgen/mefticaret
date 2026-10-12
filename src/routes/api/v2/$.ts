import { createFileRoute } from "@tanstack/react-router";

/** Mefticaret REST API v2: /api/v2/<kaynak>. v1 kaynakları + analitik uçları. */

async function handler({ request, params }: { request: Request; params: { _splat?: string } }) {
  const { handleApiRequest } = await import("@/lib/api-router.server");
  return handleApiRequest(request, `v2/${params._splat ?? ""}`);
}

export const Route = createFileRoute("/api/v2/$")({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
      OPTIONS: handler,
    },
  },
});
