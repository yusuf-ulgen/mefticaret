import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { createManualOrder } from "@/lib/manual-order.server";

type Client = SupabaseClient<Database>;

/**
 * WhatsApp'tan gelen mesajı sipariş niyeti açısından inceler ve eşleşme
 * güvenliyse siparişi panele kaydeder.
 *
 * Güvenlik: fiyat, stok ve toplam daima veritabanından okunur (createManualOrder),
 * mesaj içeriğinden tutar kabul edilmez. Ödeme durumu her zaman "pending" kalır.
 */

const norm = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/[İIıi]/g, "i")
    .replace(/\s+/g, " ")
    .trim();

/** Sipariş niyeti gösteren ifadeler. */
const INTENT = [
  "siparis",
  "sipariş",
  "istiyorum",
  "alabilir",
  "almak",
  "gönderebilir",
  "gonderebilir",
  "adet",
  "kutu",
  "paket",
  "lütfen",
  "lutfen",
];

/** Yalnızca bilgi sorusu olan mesajlar sipariş sayılmaz. */
const QUESTION = ["fiyat", "kaç para", "kac para", "ne kadar", "var mı", "var mi", "stok var"];

export type AutoOrderResult =
  | { created: false; reason: string }
  | { created: true; orderNumber: string; grandTotal: number; currency: string };

/** Mesaj metninden istenen ürün/adet çiftlerini çıkarır. */
function detectItems(
  text: string,
  products: { id: string; title: string; variantId: string }[],
) {
  const haystack = norm(text);
  const items: { variantId: string; quantity: number; title: string }[] = [];

  for (const product of products) {
    const needle = norm(product.title);
    if (needle.length < 3) continue;
    const at = haystack.indexOf(needle);
    if (at < 0) continue;

    // Ürün adının hemen öncesindeki ya da sonrasındaki sayıyı adet kabul et.
    const before = haystack.slice(Math.max(0, at - 12), at);
    const after = haystack.slice(at + needle.length, at + needle.length + 12);
    const match = /(\d{1,2})\s*(?:adet|kutu|paket|tane)?\s*$/.exec(before) ?? /^\s*(\d{1,2})/.exec(after);
    const quantity = Math.min(20, Math.max(1, Number(match?.[1] ?? 1)));
    items.push({ variantId: product.variantId, quantity, title: product.title });
  }

  return items;
}

export async function tryCreateOrderFromWhatsApp(
  supabase: Client,
  input: { storeId: string; waId: string; contactName: string | null; body: string },
): Promise<AutoOrderResult> {
  const text = norm(input.body);
  if (text.length < 3) return { created: false, reason: "empty" };
  if (QUESTION.some((word) => text.includes(word)) && !text.includes("siparis"))
    return { created: false, reason: "question" };
  if (!INTENT.some((word) => text.includes(norm(word))))
    return { created: false, reason: "no_intent" };

  const { data: rows } = await supabase
    .from("products")
    .select("id, title, status, product_variants(id)")
    .eq("store_id", input.storeId)
    .eq("status", "active")
    .limit(200);

  const products = (rows ?? [])
    .map((row) => ({
      id: row.id,
      title: row.title,
      variantId: (row.product_variants ?? [])[0]?.id ?? "",
    }))
    .filter((row) => row.variantId);
  if (products.length === 0) return { created: false, reason: "no_products" };

  const items = detectItems(input.body, products);
  if (items.length === 0) return { created: false, reason: "no_product_match" };

  const digits = input.waId.replace(/\D/g, "");
  const phone = digits.startsWith("90") ? `0${digits.slice(2)}` : digits;

  const result = await createManualOrder(supabase, {
    storeId: input.storeId,
    source: "whatsapp",
    customer: {
      fullName: (input.contactName ?? "").trim().length >= 2 ? input.contactName!.trim() : `WhatsApp ${phone}`,
      email: null,
      phone,
    },
    items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    shippingTotal: 0,
    discountTotal: 0,
    paymentStatus: "pending",
    note: `WhatsApp mesajı: ${input.body.slice(0, 400)}`,
  });

  return {
    created: true,
    orderNumber: result.orderNumber,
    grandTotal: result.grandTotal,
    currency: result.currency,
  };
}
