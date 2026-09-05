/**
 * Facebook Marketplace (Partnerships Item API) ortak yardımcıları.
 * Bu dosya istemci tarafında da güvenle içe aktarılabilir: yalnızca saf
 * dönüşüm/doğrulama fonksiyonları içerir, hiçbir gizli anahtar okumaz.
 */

export const FB_GRAPH_VERSION = "v21.0";

/** Item API'nin kabul ettiği ürün durumları. */
export const FB_CONDITIONS = ["new", "refurbished", "used_like_new", "used_good", "used_fair"] as const;
export type FbCondition = (typeof FB_CONDITIONS)[number];

export const FB_CONDITION_LABELS: Record<FbCondition, string> = {
  new: "Sıfır",
  refurbished: "Yenilenmiş",
  used_like_new: "İkinci el (sıfır gibi)",
  used_good: "İkinci el (iyi)",
  used_fair: "İkinci el (orta)",
};

/** Marketplace izinleri (Meta uygulama incelemesinde talep edilir). */
export const FB_MARKETPLACE_SCOPES = [
  "catalog_management",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
];

export type FbItemPayload = {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: FbCondition;
  price: string;
  currency: string;
  link: string;
  image_url: string;
  additional_image_urls?: string[];
  brand?: string;
  category?: string;
  quantity_to_sell_on_facebook: number;
  offer_shipping?: boolean;
  offer_local_pickup?: boolean;
};

export type FbBatchRequest = {
  method: "CREATE" | "UPDATE" | "DELETE";
  data: FbItemPayload | { id: string };
};

/** Marketplace ilanı için benzersiz perakendeci kimliği. */
export function retailerId(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

/** Fiyatı Item API biçimine çevirir ("249.90"). */
export function formatPrice(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** HTML etiketlerini temizler ve açıklamayı Item API sınırına kısaltır. */
export function plainDescription(input: string | null | undefined, fallback: string): string {
  const text = (input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const value = text.length > 0 ? text : fallback;
  return value.length > 9500 ? `${value.slice(0, 9497)}...` : value;
}

/** Payload'un Item API için geçerli olup olmadığını denetler. */
export function validateItem(item: FbItemPayload): string[] {
  const issues: string[] = [];
  if (!item.title.trim()) issues.push("Başlık boş olamaz.");
  if (item.title.length > 150) issues.push("Başlık 150 karakteri aşamaz.");
  if (!item.image_url) issues.push("En az bir ürün görseli gerekli.");
  if (!/^https:\/\//.test(item.image_url)) issues.push("Görsel adresi https ile başlamalı.");
  if (!/^https:\/\//.test(item.link)) issues.push("Ürün adresi https ile başlamalı.");
  if (Number(item.price) <= 0) issues.push("Fiyat sıfırdan büyük olmalı.");
  if (!/^[A-Z]{3}$/.test(item.currency)) issues.push("Para birimi 3 harfli olmalı (örn. TRY).");
  return issues;
}

/** Aynı içerik tekrar gönderilmesin diye kararlı bir imza üretir. */
export function payloadHash(item: FbItemPayload): string {
  const raw = JSON.stringify(item);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(36)}`;
}
