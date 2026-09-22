/**
 * Tedarikçi performans ve ödeme etiketleri (saf sabitler / tipler).
 * XML/Excel içe aktarma motoru sistemden kaldırıldı; burada yalnızca
 * satıcı panelinin kullandığı durum etiketleri ve skor kartı tipi kalır.
 */

export type SupplierScorecard = {
  orders: number;
  shipped: number;
  cancelled: number;
  returned: number;
  avgShipHours: number | null;
  cancellationRate: number;
  returnRate: number;
  revenue: number;
  commission: number;
  net: number;
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  requested: "Talep edildi",
  approved: "Onaylandı",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

export const LEDGER_STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  payable: "Ödenebilir",
  paid: "Ödendi",
  cancelled: "İptal",
};
