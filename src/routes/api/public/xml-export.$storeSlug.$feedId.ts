import { createFileRoute } from "@tanstack/react-router";

/**
 * Pazaryeri XML çıktısı: /api/public/xml-export/<magaza-slug>/<feed-id>?token=...
 * Token besleme kaydındaki export_token ile eşleşmelidir; eşleşmezse 401.
 */
export const Route = createFileRoute("/api/public/xml-export/$storeSlug/$feedId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, name, slug, currency")
          .eq("slug", params.storeSlug)
          .maybeSingle();
        if (!store) return new Response("Not found", { status: 404 });

        const { data: feed } = await supabaseAdmin
          .from("supplier_feeds")
          .select("*")
          .eq("id", params.feedId)
          .eq("store_id", store.id)
          .maybeSingle();
        const row = feed as Record<string, any> | null;
        if (!row || row["direction"] !== "export" || !row["is_active"]) {
          return new Response("Not found", { status: 404 });
        }

        const expected = String(row["export_token"] ?? "");
        if (!expected || expected.length !== token.length) return new Response("Unauthorized", { status: 401 });
        let mismatch = 0;
        for (let index = 0; index < expected.length; index += 1) {
          mismatch |= expected.charCodeAt(index) ^ token.charCodeAt(index);
        }
        if (mismatch !== 0) return new Response("Unauthorized", { status: 401 });

        const forwarded = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;

        const { generateExportXml } = await import("@/lib/xml-export.server");
        try {
          const result = await generateExportXml(supabaseAdmin as never, row as never, {
            storeName: store.name,
            storeSlug: store.slug,
            storeCurrency: store.currency ?? "TRY",
            origin,
          });
          return new Response(result.xml, {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "content-disposition": `inline; filename="${result.filename}"`,
              "cache-control": "public, max-age=900",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "XML üretilemedi";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
