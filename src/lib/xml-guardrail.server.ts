/**
 * Güvenlik sınırları — sunucu tarafı: incelemeye (karantinaya) alınan ürünleri kaydeder.
 * Kayıtlar yalnızca sunucu tarafındaki servis anahtarıyla yazılır.
 */

import type { NormalizedProduct } from "@/lib/xml-import-engine.server";
import type { QuarantineIssueType } from "@/lib/xml-guardrail";

type Client = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  };
};

export type QuarantineRow = {
  item: NormalizedProduct;
  issueType: QuarantineIssueType;
  oldPrice: number | null;
  oldStock: number | null;
  reason: string;
};

/** Anormal ürünleri incelemeye alır; hata olursa içe aktarımı durdurmaz. */
export async function quarantineProducts(
  admin: Client,
  input: { storeId: string; feedId: string; rows: QuarantineRow[] },
): Promise<number> {
  if (input.rows.length === 0) return 0;

  const payload = input.rows.slice(0, 2000).map((row) => ({
    feed_id: input.feedId,
    store_id: input.storeId,
    sku: (row.item.sku ?? row.item.key ?? "UNKNOWN").slice(0, 200),
    product_title: row.item.title?.slice(0, 500) ?? null,
    old_price: row.oldPrice,
    new_price: row.item.price,
    old_stock: row.oldStock,
    new_stock: row.item.stock,
    issue_type: row.issueType,
    status: "pending_review",
    raw_data: {
      reason: row.reason,
      key: row.item.key,
      barcode: row.item.barcode,
      currency: row.item.currency,
      compareAtPrice: row.item.compareAtPrice,
      costPrice: row.item.costPrice,
      variantCount: row.item.variants.length,
    },
  }));

  const { error } = await admin.from("xml_quarantine_items").insert(payload);
  if (error) {
    console.warn("[guardrail] karantina kaydı yazılamadı:", error.message);
    return 0;
  }
  return payload.length;
}
