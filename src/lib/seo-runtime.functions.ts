import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const runtimeInput = z.object({
  slug: z.string().trim().min(1).max(120),
  path: z.string().trim().startsWith("/").max(500),
});

/** Public vitrin akışı için eşleşen redirect'i bulur. Yönetim verisi dışarı açılmaz. */
export const resolveStorefrontRedirect = createServerFn({ method: "GET" })
  .inputValidator((data) => runtimeInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin.from("stores").select("id, status").eq("slug", data.slug).maybeSingle();
    if (!store || store.status !== "active") return null;

    const { data: redirect } = await supabaseAdmin
      .from("store_seo_redirects")
      .select("id, target_path, status_code")
      .eq("store_id", store.id)
      .eq("source_path", data.path)
      .eq("is_active", true)
      .maybeSingle();
    if (!redirect) return null;

    // Sayaç her IP için saatte bir kez artar; yönlendirme her durumda çalışır.
    const { getRequest } = await import("@tanstack/react-start/server");
    const { consumeRateLimit, clientIp } = await import("@/lib/rate-limit.server");
    const request = getRequest();
    const ip = request ? clientIp(request) : "unknown";
    const gate = await consumeRateLimit(`redirect_hit:${ip}:${redirect.id}`, { limit: 1, windowSeconds: 3_600 });
    if (gate.allowed) await supabaseAdmin
      .from("store_seo_redirects")
      .update({ hit_count: 1, last_hit_at: new Date().toISOString() })
      .eq("id", redirect.id);

    return { targetPath: redirect.target_path, statusCode: redirect.status_code };
  });

/** Public vitrin akışında çözülemeyen adresleri mağazanın 404 raporuna toplar. */
export const recordStorefront404 = createServerFn({ method: "POST" })
  .inputValidator((data) => runtimeInput.extend({ referrer: z.string().max(500).optional(), userAgent: z.string().max(400).optional() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin.from("stores").select("id, status").eq("slug", data.slug).maybeSingle();
    if (!store || store.status !== "active") return { ok: false as const };

    const { data: existing } = await supabaseAdmin
      .from("store_seo_404s")
      .select("id, hit_count")
      .eq("store_id", store.id)
      .eq("path", data.path)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("store_seo_404s").update({
        hit_count: existing.hit_count + 1,
        last_seen_at: new Date().toISOString(),
        ...(data.referrer ? { referrer: data.referrer } : {}),
        ...(data.userAgent ? { user_agent: data.userAgent } : {}),
      }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("store_seo_404s").insert({
        store_id: store.id,
        path: data.path,
        referrer: data.referrer ?? null,
        user_agent: data.userAgent ?? null,
      });
    }
    return { ok: true as const };
  });
