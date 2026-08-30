import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Panel geneli hızlı arama (komut paleti). Tenant izolasyonu RLS ile zorlanır;
 * burada sadece kısa, güvenli projeksiyonlar döner.
 */

export type SearchHit = {
  kind: "product" | "order" | "customer" | "page";
  id: string;
  title: string;
  subtitle: string | null;
};

const searchInput = z.object({
  storeId: z.string().uuid(),
  term: z.string().trim().max(120),
});

function escapeLike(value: string) {
  return value.replace(/[%,_]/g, " ").trim();
}

export const searchStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchInput.parse(data))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const term = escapeLike(data.term);
    if (term.length < 2) return [];
    const like = `%${term}%`;
    const { supabase, storeId } = { supabase: context.supabase, storeId: data.storeId };

    const [products, orders, customers, pages] = await Promise.all([
      supabase
        .from("products")
        .select("id,title,status,base_price,currency")
        .eq("store_id", storeId)
        .ilike("title", like)
        .limit(5),
      supabase
        .from("orders")
        .select("id,order_number,customer_name,grand_total,currency")
        .eq("store_id", storeId)
        .or(`order_number.ilike.${like},customer_name.ilike.${like},customer_email.ilike.${like}`)
        .limit(5),
      supabase
        .from("customers")
        .select("id,full_name,email")
        .eq("store_id", storeId)
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .limit(5),
      supabase
        .from("store_pages")
        .select("id,title,slug,is_published")
        .eq("store_id", storeId)
        .ilike("title", like)
        .limit(5),
    ]);

    const hits: SearchHit[] = [];

    for (const row of products.data ?? []) {
      hits.push({
        kind: "product",
        id: row.id,
        title: row.title,
        subtitle: `${row.status} · ${row.base_price} ${row.currency}`,
      });
    }
    for (const row of orders.data ?? []) {
      hits.push({
        kind: "order",
        id: row.id,
        title: row.order_number,
        subtitle: `${row.customer_name ?? "Misafir"} · ${row.grand_total} ${row.currency}`,
      });
    }
    for (const row of customers.data ?? []) {
      hits.push({ kind: "customer", id: row.id, title: row.full_name, subtitle: row.email });
    }
    for (const row of pages ?? { data: [] }).data ?? []) {
      hits.push({
        kind: "page",
        id: row.id,
        title: row.title,
        subtitle: row.is_published ? `/${row.slug} · yayında` : `/${row.slug} · taslak`,
      });
    }

    return hits;
  });
