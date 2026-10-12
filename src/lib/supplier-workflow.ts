/** Tedarikçi iş akışı etiketleri (istemci ve sunucuda ortak). */
export const PO_SUPPLIER_STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  accepted: "Kabul edildi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda",
  rejected: "Reddedildi",
};

export const PO_PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Ödenmedi",
  pending: "Ödeme bekleniyor",
  paid: "Ödendi",
};
