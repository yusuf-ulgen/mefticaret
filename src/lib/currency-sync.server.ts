/**
 * CurrencySyncService — TCMB günlük kurlarını çeker ve platform kur tablosunu
 * günceller; fiyat dönüştürme yardımcısı sağlar.
 *
 * Yalnızca sunucuda çalışır; yazma işlemleri service_role ile yapılır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<any, "public", any>;

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const TRACKED = ["USD", "EUR", "GBP"] as const;
const FETCH_TIMEOUT_MS = 15_000;

export type CurrencyRate = { code: string; rate: number; source: string; updatedAt: string | null };
export type CurrencySyncResult = { updated: string[]; skipped: string[]; error: string | null };

/** TCMB XML'inden `CurrencyCode` + `ForexSelling` çiftlerini okur. */
export function parseTcmbXml(xml: string): Array<{ code: string; rate: number }> {
  const out: Array<{ code: string; rate: number }> = [];
  const blocks = xml.match(/<Currency\b[^>]*>[\s\S]*?<\/Currency>/g) ?? [];
  for (const block of blocks) {
    const code = /CurrencyCode="([A-Z]{3})"/.exec(block)?.[1] ?? "";
    const raw = /<ForexSelling>([^<]*)<\/ForexSelling>/.exec(block)?.[1]?.trim() ?? "";
    const rate = Number(raw);
    if (code && Number.isFinite(rate) && rate > 0) out.push({ code, rate });
  }
  return out;
}

/** Güncel kurları indirip `platform_currency_rates` tablosuna yazar. */
export async function syncTcmbRates(supabase: Admin): Promise<CurrencySyncResult> {
  const result: CurrencySyncResult = { updated: [], skipped: [], error: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let body: string;
    try {
      const response = await fetch(TCMB_URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`TCMB yanıtı ${response.status}`);
      body = await response.text();
    } finally {
      clearTimeout(timer);
    }

    const rates = parseTcmbXml(body).filter((item) =>
      (TRACKED as readonly string[]).includes(item.code),
    );
    if (rates.length === 0) throw new Error("TCMB yanıtında kur bulunamadı");

    for (const item of rates) {
      const { error } = await supabase
        .from("platform_currency_rates")
        .upsert(
          { code: item.code, rate: item.rate, source: "tcmb", updated_at: new Date().toISOString() },
          { onConflict: "code" },
        );
      if (error) result.skipped.push(`${item.code}: ${error.message}`);
      else result.updated.push(item.code);
    }
    return result;
  } catch (cause) {
    result.error = cause instanceof Error ? cause.message : String(cause);
    return result;
  }
}

/** Kaydedilmiş kurları okur. */
export async function loadCurrencyRates(supabase: Admin): Promise<CurrencyRate[]> {
  const { data, error } = await supabase
    .from("platform_currency_rates")
    .select("code, rate, source, updated_at")
    .order("code");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    code: String(row["code"]),
    rate: Number(row["rate"]),
    source: String(row["source"] ?? "tcmb"),
    updatedAt: (row["updated_at"] as string | null) ?? null,
  }));
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Fiyatı hedef para birimine çevirir. `manualRate` verilirse tablo yerine o kur
 * kullanılır; kur bulunamazsa fiyat olduğu gibi döner.
 */
export function convertPrice(
  price: number,
  options: {
    from: string;
    to?: string;
    rates?: CurrencyRate[];
    manualRate?: number | null;
    profitMarginPercent?: number | null;
  },
): number {
  const from = (options.from || "TRY").toUpperCase();
  const to = (options.to || "TRY").toUpperCase();
  const margin = 1 + (options.profitMarginPercent ?? 0) / 100;

  if (!Number.isFinite(price)) return 0;
  if (from === to) return round2(price * margin);

  const manual = options.manualRate ?? 0;
  if (manual > 0) return round2(price * manual * margin);

  const rates = options.rates ?? [];
  const rateOf = (code: string) =>
    code === "TRY" ? 1 : rates.find((item) => item.code === code)?.rate ?? 0;

  const fromRate = rateOf(from);
  const toRate = rateOf(to);
  if (fromRate <= 0 || toRate <= 0) return round2(price * margin);

  return round2((price * fromRate) / toRate * margin);
}
