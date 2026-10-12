/** Dropshipping sipariş durumları (tedarikçi besleme motoru kaldırıldı). */

export type DropshipOrderStatus =
  | "pending"
  | "sent"
  | "accepted"
  | "shipped"
  | "cancelled"
  | "failed";

export const DROPSHIP_STATUS_LABEL: Record<DropshipOrderStatus, string> = {
  pending: "Beklemede",
  sent: "Gönderildi",
  accepted: "Kabul edildi",
  shipped: "Kargoda",
  cancelled: "İptal",
  failed: "Başarısız",
};
