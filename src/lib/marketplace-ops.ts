/**
 * Pazaryeri Operasyon paketi — TR etiket sözlükleri ve paylaşılan sabitler.
 * Framework-agnostik; istemci ve sunucu tarafından ortak kullanılır.
 */

export const MARKETPLACE_RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
  "cancelled",
] as const;
export type MarketplaceReturnStatus = (typeof MARKETPLACE_RETURN_STATUSES)[number];

export const MARKETPLACE_RETURN_STATUS_LABELS: Record<MarketplaceReturnStatus, string> = {
  requested: "Talep edildi",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  received: "Teslim alındı",
  refunded: "İade edildi",
  cancelled: "İptal edildi",
};

export const MARKETPLACE_RETURN_REASONS = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "size_fit",
  "changed_mind",
  "cargo_issue",
  "other",
] as const;
export type MarketplaceReturnReason = (typeof MARKETPLACE_RETURN_REASONS)[number];

export const MARKETPLACE_RETURN_REASON_LABELS: Record<MarketplaceReturnReason, string> = {
  damaged: "Hasarlı ürün",
  wrong_item: "Yanlış ürün",
  not_as_described: "Açıklamayla uyuşmuyor",
  size_fit: "Beden / uyum sorunu",
  changed_mind: "Fikir değişikliği",
  cargo_issue: "Kargo sorunu",
  other: "Diğer",
};

export const SETTLEMENT_STATUSES = ["pending", "processing", "paid", "disputed", "cancelled"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: "Bekliyor",
  processing: "İşleniyor",
  paid: "Ödendi",
  disputed: "İtirazlı",
  cancelled: "İptal edildi",
};

export const LISTING_LINK_STATUSES = ["active", "paused", "error", "removed"] as const;
export type ListingLinkStatus = (typeof LISTING_LINK_STATUSES)[number];

export const LISTING_LINK_STATUS_LABELS: Record<ListingLinkStatus, string> = {
  active: "Aktif",
  paused: "Duraklatıldı",
  error: "Hata",
  removed: "Kaldırıldı",
};

export function returnStatusLabel(status: string): string {
  return MARKETPLACE_RETURN_STATUS_LABELS[status as MarketplaceReturnStatus] ?? status;
}

export function returnReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Belirtilmedi";
  return MARKETPLACE_RETURN_REASON_LABELS[reason as MarketplaceReturnReason] ?? reason;
}

export function settlementStatusLabel(status: string): string {
  return SETTLEMENT_STATUS_LABELS[status as SettlementStatus] ?? status;
}

export function listingLinkStatusLabel(status: string): string {
  return LISTING_LINK_STATUS_LABELS[status as ListingLinkStatus] ?? status;
}

/** Gün başına saat dilimleri — sipariş analizi grafiklerinde kullanılır. */
export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour);
