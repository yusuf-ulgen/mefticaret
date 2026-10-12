import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/**
 * SEO Merkezi'nden tetiklenen hızlı indeksleme: mağazanın ürün, kategori ve
 * sayfa adresleri IndexNow uçlarına bildirilir. Mağaza erişimi RLS ile
 * doğrulanır; slug ve adresler istemciden kabul edilmez.
 */
export const submitStoreUrlsToIndexNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        kinds: z
          .array(z.enum(["product", "collection", "page"]))
          .min(1)
          .default(["product"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, slug")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const { getRequest } = await import("@tanstack/react-start/server");
    const origin = new URL(getRequest().url).origin.replace(/\/$/, "");
    const base = `${origin}/s/${store.slug}`;
    const urls = new Set<string>([base, `${origin}/api/public/sitemap/${store.slug}`]);

    if (data.kinds.includes("product")) {
      const { data: rows } = await supabase
        .from("products")
        .select("slug")
        .eq("store_id", data.storeId)
        .eq("status", "active");
      for (const row of rows ?? []) urls.add(`${base}/p/${row.slug}`);
    }

    if (data.kinds.includes("collection")) {
      const { data: rows } = await supabase
        .from("collections")
        .select("slug")
        .eq("store_id", data.storeId);
      for (const row of rows ?? []) urls.add(`${base}/c/${row.slug}`);
    }

    if (data.kinds.includes("page")) {
      const { data: rows } = await supabase
        .from("store_pages")
        .select("slug")
        .eq("store_id", data.storeId)
        .eq("is_published", true);
      for (const row of rows ?? []) urls.add(`${base}/page/${row.slug}`);
    }

    const { pushUrlsToIndexNow } = await import("@/lib/indexnow.server");
    const result = await pushUrlsToIndexNow(origin, [...urls]);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "seo.indexnow_submitted",
      entity: "stores",
      entity_id: data.storeId,
      new_value: { urlCount: result.urlCount, kinds: data.kinds } as never,
    });

    const accepted = result.endpoints.filter(
      (row) => typeof row.status === "number" && row.status >= 200 && row.status < 300,
    ).length;

    return { urlCount: result.urlCount, accepted, endpoints: result.endpoints.length };
  });
