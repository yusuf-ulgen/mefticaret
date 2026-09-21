import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Tarayıcı tarafı hataların toplandığı uç nokta.
 * IP başına hız sınırlı, kişisel veri taşımaz; yalnızca hata metni/rota gelir.
 */

const payloadSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  route: z.string().max(500).optional(),
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]).default("WARNING"),
  source: z.string().trim().max(120).default("browser"),
});

export const Route = createFileRoute("/api/public/telemetry/error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientIp, consumeRateLimit, RATE_LIMITS, rateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const limit = await consumeRateLimit(`telemetry:${clientIp(request)}`, RATE_LIMITS.public_form);
        if (!limit.allowed) return rateLimitResponse(limit);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_payload" }), {
            status: 400,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        const { recordAppError } = await import("@/lib/monitoring.server");
        await recordAppError({
          severity: parsed.data.severity,
          source: `client:${parsed.data.source}`,
          message: parsed.data.message,
          ...(parsed.data.stack ? { stack: parsed.data.stack } : {}),
          ...(parsed.data.route ? { route: parsed.data.route } : {}),
          meta: { userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null },
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      },
    },
  },
});
