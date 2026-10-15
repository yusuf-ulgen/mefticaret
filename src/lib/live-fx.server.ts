/**
 * Canlı kur yedeği: mağazanın kur tablosunda olmayan çiftler (ör. TRY→GEL) için
 * open.er-api.com'dan güncel kur okunur. Sabit kur yoktur; sağlayıcı yanıt vermezse null döner.
 */
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; rates: Record<string, number> }>();

export async function liveRates(base: string): Promise<Record<string, number> | null> {
  const key = base.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(key)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return hit?.rates ?? null;
    const json = (await response.json()) as { result?: string; rates?: Record<string, number> };
    if (json.result !== "success" || !json.rates) return hit?.rates ?? null;
    cache.set(key, { at: Date.now(), rates: json.rates });
    return json.rates;
  } catch {
    return hit?.rates ?? null;
  }
}

export async function liveRate(base: string, quote: string): Promise<number | null> {
  if (base.toUpperCase() === quote.toUpperCase()) return 1;
  const rates = await liveRates(base);
  const value = Number(rates?.[quote.toUpperCase()]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
