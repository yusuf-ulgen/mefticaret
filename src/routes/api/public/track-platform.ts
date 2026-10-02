import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Mefticaret platform sayfaları (ana sayfa, rehberler, blog vb.) için anonim
 * sayfa görüntüleme toplayıcısı. Yalnız yazma yapar; hiçbir veri geri okunmaz.
 */
const bodySchema = z.object({
  visitorId: z.string().min(6).max(64),
  sessionId: z.string().min(6).max(64),
  path: z.string().min(1).max(300).startsWith("/"),
  pageTitle: z.string().trim().max(200).optional(),
  referrer: z.string().max(500).optional(),
  source: z.string().max(120).optional(),
});

function detectDevice(ua: string) {
  const v = ua.toLowerCase();
  if (/bot|crawler|spider|crawling|preview|lighthouse|headless/.test(v)) return "bot";
  if (/ipad|tablet|playbook|silk/.test(v)) return "tablet";
  if (/mobi|iphone|android/.test(v)) return "mobile";
  return "desktop";
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/track-platform")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Geçersiz veri" }, { status: 400 });
        }
        const ua = request.headers.get("user-agent") ?? "";
        const device = detectDevice(ua);
        if (device === "bot") return Response.json({ ok: true, skipped: true });

        const selfHost = new URL(request.url).hostname.replace(/^www\./, "");
        let referrerHost = hostOf(payload.referrer);
        if (referrerHost === selfHost || referrerHost === "mefticaret.com") referrerHost = null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("platform_page_views").insert({
          visitor_id: payload.visitorId,
          session_id: payload.sessionId,
          path: payload.path,
          page_title: payload.pageTitle ?? null,
          referrer_host: referrerHost,
          source: payload.source ?? referrerHost ?? "direct",
          device,
          country: request.headers.get("cf-ipcountry") ?? null,
          city: request.headers.get("cf-ipcity") ?? null,
        });
        if (error) return Response.json({ error: "Kaydedilemedi" }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
