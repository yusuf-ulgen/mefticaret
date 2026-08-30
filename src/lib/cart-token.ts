/** Mağaza bazlı, tarayıcıya özel sepet kimliği. Terk edilmiş sepet takibi için kullanılır. */
export function getCartToken(storeSlug: string): string {
  const key = `mefti-cart-token-${storeSlug}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    window.localStorage.setItem(key, token);
    return token;
  } catch {
    return " ephemeral-token-placeholder";
  }
}

/** Kurtarma linki ile gelen ziyaretçinin token'ını sabitler (aynı sepet kaydına yazılsın). */
export function setCartToken(storeSlug: string, token: string): void {
  try {
    window.localStorage.setItem(`mefti-cart-token-${storeSlug}`, token);
  } catch {
    /* depolama kapalı olabilir */
  }
}
