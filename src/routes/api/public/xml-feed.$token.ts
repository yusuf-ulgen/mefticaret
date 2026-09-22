import { createFileRoute } from "@tanstack/react-router";

/**
 * Pazaryeri XML beslemesini herkese açık sunar. Adres, beslemenin gizli
 * erişim anahtarını (export_token) içerir; anahtar olmadan içerik verilmez.
 * Depodaki son üretilmiş dosya sunulur; dosya yoksa anında üretilir.
 */
export const Route = createFileRoute("/api/public/xml-feed/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String((params as { token?: string }).token ?? "");
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: feedRow } = await supabaseAdmin
          .from("xml_feeds")
          .select(
            "id, store_id, platform, currency, price_markup, output_filename, export_token, direction, is_active",
          )
          .eq("export_token", token)
          .maybeSingle();

        const feed = feedRow as Record<string, unknown> | null;
        if (!feed || feed["direction"] !== "export" || feed["is_active"] !== true) {
          return new Response("Not found", { status: 404 });
        }

        const { EXPORT_BUCKET, buildExportXml } = await import("@/lib/xml-export-engine.server");
        const filename = String(feed["output_filename"] ?? `${feed["platform"]}-feed.xml`)
          .replace(/[^A-Za-z0-9._-]/g, "-")
          .slice(0, 80)
          .toLowerCase();
        const storagePath = `${feed["store_id"]}/xml-exports/${feed["id"]}/${
          filename.endsWith(".xml") ? filename : `${filename}.xml`
        }`;

        const stored = await supabaseAdmin.storage.from(EXPORT_BUCKET).download(storagePath);
        if (stored.data) {
          return new Response(await stored.data.arrayBuffer(), {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=300, s-maxage=600",
            },
          });
        }

        try {
          const generated = await buildExportXml(supabaseAdmin as never, {
            id: String(feed["id"]),
            storeId: String(feed["store_id"]),
            platform: feed["platform"] as never,
            currency: (feed["currency"] as string | null) ?? null,
            priceMarkup: feed["price_markup"] === null ? null : Number(feed["price_markup"]),
            outputFilename: (feed["output_filename"] as string | null) ?? null,
            exportToken: token,
          });
          return new Response(generated.xml, {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=300, s-maxage=600",
            },
          });
        } catch {
          return new Response("Feed unavailable", { status: 503 });
        }
      },
    },
  },
});
