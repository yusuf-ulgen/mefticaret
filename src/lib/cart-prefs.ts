/**
 * Sepette seçilen kupon ve kargo yöntemi kasaya taşınsın diye tarayıcıda
 * mağaza bazında saklanır. Tutarlar burada saklanmaz; her hesap sunucuda
 * yeniden doğrulanır.
 */
export type CartPrefs = {
  couponCode?: string;
  shippingRateId?: string;
};

const key = (slug: string) => `mefti-cart-prefs:${slug}`;

export function getCartPrefs(slug: string): CartPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CartPrefs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setCartPrefs(slug: string, prefs: CartPrefs) {
  if (typeof window === "undefined") return;
  try {
    const next = { ...getCartPrefs(slug), ...prefs };
    window.localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    /* kota dolu olabilir, sessizce yut */
  }
}

/** eta_days -> "3-5 gün içinde (4 Eyl - 6 Eyl)" biçiminde tahmini teslimat metni */
export function estimatedDeliveryLabel(etaDays: number | null | undefined, locale = "tr-TR"): string | null {
  const days = Number(etaDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) return null;
  const min = Math.max(1, Math.round(days));
  const max = min + 2;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const start = new Date();
  start.setDate(start.getDate() + min);
  const end = new Date();
  end.setDate(end.getDate() + max);
  return `${min}-${max} iş günü (${fmt.format(start)} – ${fmt.format(end)})`;
}
