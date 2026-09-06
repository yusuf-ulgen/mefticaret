import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Vitrin analitik toplayıcısı: ziyaretçi/oturum bazlı davranış olaylarını kaydeder.
 * Public bir uç nokta olduğu için yazma yalnızca doğrulanmış payload + var olan
 * mağaza slug'ı ile yapılır; hiçbir veri geri okunmaz (yanıt yalnızca ok döner).
 */

const bodySchema = z.object({
  visitorId: z.string().min(6).max(64),
  sessionId: z.string().min(6).max(64),
  kind: z.enum(["page_view", "product_view", "add_to_cart", "checkout", "purchase", "search"]),
  searchTerm: z.string().trim().min(1).max(120).optional(),
  searchResults: z.number().int().min(0).max(100_000).optional(),
  path: z.string().max(300).optional(),
  productId: z.guid().optional(),
  variantId: z.guid().optional(),
  orderId: z.guid().optional(),
  value: z.number().finite().min(0).max(10_000_000).optional(),
  quantity: z.number().int().min(0).max(10_000).optional(),
  currency: z.string().max(8).optional(),
  referrer: z.string().max(500).optional(),
  source: z.string().max(120).optional(),
  medium: z.string().max(120).optional(),
  campaign: z.string().max(120).optional(),
});

function detectDevice(userAgent: string): "mobile" | "tablet" | "desktop" | "bot" {
  const ua = userAgent.toLowerCase();
  if (/bot|crawler|spider|crawling|preview|lighthouse/.test(ua)) return "bot";
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
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

export const Route = createFileRoute("/api/public/track/$slug")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Geçersiz olay verisi" }, { status: 400 });
        }

        const userAgent = request.headers.get("user-agent") ?? "";
        const device = detectDevice(userAgent);
        if (device === "bot") return Response.json({ ok: true, skipped: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, currency")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!store) return Response.json({ error: "Mağaza bulunamadı" }, { status: 404 });

        const referrerHost = hostOf(payload.referrer);
        const source =
          payload.source ?? (referrerHost ? referrerHost : payload.referrer === "" ? "direct" : "direct");

        const { error } = await supabaseAdmin.from("analytics_events").insert({
          store_id: store.id,
          visitor_id: payload.visitorId,
          session_id: payload.sessionId,
          kind: payload.kind,
          path: payload.path ?? null,
          product_id: payload.productId ?? null,
          variant_id: payload.variantId ?? null,
          order_id: payload.orderId ?? null,
          value: payload.value ?? 0,
          quantity: payload.quantity ?? 0,
          currency: payload.currency ?? store.currency ?? "TRY",
          source,
          medium: payload.medium ?? (referrerHost ? "referral" : "none"),
          campaign: payload.campaign ?? null,
          referrer: payload.referrer ?? null,
          referrer_host: referrerHost,
          device,
          country: request.headers.get("cf-ipcountry") ?? null,
          city: request.headers.get("cf-ipcity") ?? null,
          search_term: payload.searchTerm ?? null,
          search_results: payload.searchResults ?? null,
          user_agent: userAgent.slice(0, 400),
        });
        if (error) return Response.json({ error: "Olay kaydedilemedi" }, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
