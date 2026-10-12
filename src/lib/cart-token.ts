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
    // Depolama kapalıysa her yüklemede yeni, tahmin edilemez bir token üret.
    try {
      return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    } catch {
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
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
