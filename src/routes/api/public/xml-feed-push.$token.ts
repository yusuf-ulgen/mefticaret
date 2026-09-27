import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook beslemesi — tedarikçi ürün dosyasını (XML/CSV/JSON) doğrudan bu
 * adrese gönderir; içerik anında içe aktarılır.
 *
 * Güvenlik: adres beslemenin gizli webhook anahtarını taşır, yalnızca
 * "webhook" bağlantı türündeki aktif içe aktarım beslemeleri kabul edilir,
 * gövde 40 MB ile sınırlıdır ve besleme başına hız sınırı uygulanır.
 */
const MAX_BYTES = 40 * 1024 * 1024;

export const Route = createFileRoute("/api/public/xml-feed-push/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = String((params as { token?: string }).token ?? "");
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: feedRow } = await supabaseAdmin
          .from("xml_feeds")
          .select(
            "id, store_id, direction, connection_type, is_active, source_url, source_format, item_path, auth_type, auth_config, field_mapping, transform_rules, price_markup, currency, pricing_rules, variant_mode, variant_config, delta_sync_config, last_full_sync_at, ftp_config, guardrail_config",
          )
          .eq("webhook_token", token)
          .maybeSingle();

        const feed = feedRow as Record<string, unknown> | null;
        if (!feed || feed["direction"] !== "import" || feed["is_active"] !== true) {
          return Response.json(
            { ok: false, error: "Invalid or inactive webhook token" },
            { status: 404 },
          );
        }

        const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
        const limit = await consumeRateLimit(`xml_webhook:${feed["id"]}`, RATE_LIMITS.import_trigger);
        if (!limit.allowed) {
          return Response.json(
            { ok: false, error: "Çok sık gönderim yapıldı, birkaç dakika sonra tekrar deneyin" },
            { status: 429 },
          );
        }

        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared && declared > MAX_BYTES) {
          return Response.json({ ok: false, error: "Dosya 40 MB sınırını aşıyor" }, { status: 413 });
        }

        const body = await request.text();
        if (new TextEncoder().encode(body).length > MAX_BYTES) {
          return Response.json({ ok: false, error: "Dosya 40 MB sınırını aşıyor" }, { status: 413 });
        }

        const { parseConnectionType } = await import("@/lib/xml-connection");
        const connectionType = parseConnectionType(feed["connection_type"]);
        const hasBody = body.trim().length > 0;

        /*
         * İki kullanım biçimi desteklenir:
         * 1. Dosya gönderimi — gövdedeki içerik doğrudan içe aktarılır.
         * 2. Tetikleme — gövde boşsa besleme kendi kaynağından (adres / FTP) indirir.
         */
        if (!hasBody && connectionType === "webhook") {
          return Response.json(
            { ok: false, error: "Gönderilen dosya boş; bu besleme kendi kaynağından indirme yapmaz" },
            { status: 400 },
          );
        }


        const { runImportFeed } = await import("@/lib/xml-import-engine.server");
        try {
          const result = await runImportFeed(
            supabaseAdmin as never,
            {
              id: String(feed["id"]),
              storeId: String(feed["store_id"]),
              direction: "import",
              connectionType: hasBody ? "webhook" : connectionType,
              inlineContent: hasBody ? body : null,
              sourceUrl: hasBody ? null : ((feed["source_url"] as string | null) ?? null),
              ftpConfig: feed["ftp_config"] ?? {},
              sourceFormat: (feed["source_format"] as never) ?? null,
              itemPath: (feed["item_path"] as string | null) ?? null,
              authType: (hasBody ? "none" : (feed["auth_type"] ?? "none")) as never,
              authConfig: (hasBody ? {} : (feed["auth_config"] ?? {})) as Record<string, string>,
              fieldMapping: (feed["field_mapping"] ?? {}) as Record<string, string>,
              transformRules: feed["transform_rules"] ?? {},
              priceMarkup: feed["price_markup"] === null ? null : Number(feed["price_markup"]),
              currency: String(feed["currency"] ?? "TRY"),
              pricingRules: feed["pricing_rules"] ?? {},
              variantMode: (feed["variant_mode"] as string | null) ?? "none",
              variantConfig: feed["variant_config"] ?? {},
              deltaSyncConfig: feed["delta_sync_config"] ?? {},
              lastFullSyncAt: (feed["last_full_sync_at"] as string | null) ?? null,
              guardrailConfig: feed["guardrail_config"] ?? {},
            },
            { trigger: "api", nextRunAt: null },
          );

          return Response.json({
            ok: result.status === "success",
            totalRows: result.totalRows,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errorCount: result.errorCount,
          });
        } catch (cause) {
          console.error("xml-feed-push failed", cause);
          const message = "İçe aktarım başarısız";
          return Response.json({ ok: false, error: message }, { status: 422 });
        }
      },
    },
  },
});
