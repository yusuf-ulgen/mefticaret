/** Denetim kaydı sözlüğü — istemci ve sunucu tarafından paylaşılır. */

export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "product.created",
  "product.updated",
  "product.deleted",
  "order.updated",
  "order.status_changed",
  "payment.updated",
  "payment.refunded",
  "role.changed",
  "subscription.changed",
  "api_key.created",
  "api_key.revoked",
  "domain.changed",
  "app.installed",
  "app.uninstalled",
  "data.deleted",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Giriş yapıldı",
  "auth.logout": "Çıkış yapıldı",
  "product.created": "Ürün oluşturuldu",
  "product.updated": "Ürün güncellendi",
  "product.deleted": "Ürün silindi",
  "order.updated": "Sipariş güncellendi",
  "order.status_changed": "Sipariş durumu değişti",
  "payment.updated": "Ödeme güncellendi",
  "payment.refunded": "Geri ödeme yapıldı",
  "role.changed": "Yetki değişti",
  "subscription.changed": "Abonelik değişti",
  "api_key.created": "API anahtarı oluşturuldu",
  "api_key.revoked": "API anahtarı iptal edildi",
  "domain.changed": "Domain değişti",
  "app.installed": "Uygulama kuruldu",
  "app.uninstalled": "Uygulama kaldırıldı",
  "data.deleted": "Veri silindi",
};

/** Bilinmeyen action değerlerini de okunur biçimde gösterir. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/** İki kayıt arasındaki değişen alanları döndürür; audit old/new alanlarını küçük tutar. */
export function auditDiff<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    oldValue[key] = a ?? null;
    newValue[key] = b ?? null;
  }
  return { old: oldValue, new: newValue };
}
