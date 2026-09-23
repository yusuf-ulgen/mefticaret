import { createFileRoute } from "@tanstack/react-router";

/**
 * E-posta tıklama takibi: olayı kaydeder ve hedef adrese yönlendirir.
 *
 * Açık yönlendirme (open redirect) olmaması için hedef adres yalnızca kendi
 * alan adlarımız veya ilgili mağazanın doğrulanmış kendi alan adı olabilir;
 * dışarıdan verilen başka adresler yok sayılıp ana sayfaya düşülür.
 */

const FALLBACK = "https://mefticaret.com";

const ALLOWED_SUFFIXES = ["mefticaret.com", "lovable.app", "lovableproject.com"];

function parseTarget(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isAllowedHost(host: string, storeHosts: string[]): boolean {
  const normalized = host.toLowerCase();
  if (storeHosts.includes(normalized)) return true;
  return ALLOWED_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

export const Route = createFileRoute("/api/public/email/click/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const candidate = parseTarget(url.searchParams.get("u"));
        const token = String(params.token ?? "");
        let target = FALLBACK;

        if (!/^[a-f0-9]{16,64}$/i.test(token)) {
          return new Response(null, { status: 302, headers: { location: FALLBACK } });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: send } = await supabaseAdmin
            .from("email_sends")
            .select("id, store_id, campaign_id, variant_id, clicked_at, opened_at")
            .eq("token", token)
            .maybeSingle();

          if (send) {
            if (candidate) {
              const { data: domains } = await supabaseAdmin
                .from("store_domains")
                .select("hostname")
                .eq("store_id", send.store_id)
                .eq("status", "active");
              const storeHosts = (domains ?? [])
                .map((row) => row.hostname?.toLowerCase())
                .filter((value): value is string => Boolean(value));
              if (isAllowedHost(candidate.hostname, storeHosts)) target = candidate.toString();
            }

            const now = new Date().toISOString();
            const patch = {
              ...(send.clicked_at ? {} : { clicked_at: now }),
              ...(send.opened_at ? {} : { opened_at: now }),
            };
            if (Object.keys(patch).length > 0) {
              await supabaseAdmin.from("email_sends").update(patch).eq("id", send.id);
              if (send.variant_id && !send.clicked_at) {
                const { data: variant } = await supabaseAdmin
                  .from("email_campaign_variants")
                  .select("click_count")
                  .eq("id", send.variant_id)
                  .maybeSingle();
                await supabaseAdmin
                  .from("email_campaign_variants")
                  .update({ click_count: (variant?.click_count ?? 0) + 1 })
                  .eq("id", send.variant_id);
              }
            }
            await supabaseAdmin.from("email_events").insert({
              store_id: send.store_id,
              campaign_id: send.campaign_id,
              send_id: send.id,
              kind: "click",
              url: target.slice(0, 900),
              user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
            });
          }
        } catch {
          // Takip hatası yönlendirmeyi engellemez.
        }

        return new Response(null, { status: 302, headers: { location: target } });
      },
    },
  },
});
