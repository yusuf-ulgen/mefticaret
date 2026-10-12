import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { revokeRawToken } from "@/lib/oauth.server";

/** OAuth token iptal endpoint'i (RFC 7009 benzeri). */

const bodySchema = z.object({
  token: z.string().trim().min(8).max(400),
  client_id: z.string().trim().min(4).max(120),
  client_secret: z.string().trim().min(8).max(400),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/api/public/oauth/revoke")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          const type = request.headers.get("content-type") ?? "";
          raw = type.includes("application/json")
            ? await request.json()
            : Object.fromEntries(
                Array.from((await request.formData()).entries()).map(([k, v]) => [k, String(v)]),
              );
        } catch {
          raw = null;
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_request" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const ok = await revokeRawToken(
          parsed.data.client_id,
          parsed.data.client_secret,
          parsed.data.token,
        );
        if (!ok) {
          return new Response(JSON.stringify({ error: "invalid_client" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        // RFC 7009: geçersiz belirteç için de 200 döner.
        return new Response(null, { status: 200, headers: CORS });
      },
    },
  },
});
