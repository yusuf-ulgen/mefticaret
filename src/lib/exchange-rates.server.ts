/**
 * Exchange Rate Gateway — sağlayıcı bağımsız kur güncelleme katmanı.
 *
 * Mimari: MefTicaret → Gateway → Provider Adapter → Provider API
 * Failover sırası: 1) birincil sağlayıcı 2) yedek sağlayıcılar 3) son geçerli
 * (cached) kur 4) manuel kur. Hiçbir yerde sabit kur ya da uydurma veri yoktur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type ProviderRow = {
  id: string;
  code: string;
  name: string;
  adapter: string;
  base_url: string | null;
  requires_key: boolean;
  secret_name: string | null;
  priority: number;
  is_active: boolean;
};

export type FetchedRates = { base: string; rates: Record<string, number>; provider: string };

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Sağlayıcı ${response.status} döndü`);
  return response.json();
}

/** Frankfurter (Avrupa Merkez Bankası) adaptörü. */
async function frankfurter(base: string, quotes: string[], baseUrl: string): Promise<FetchedRates> {
  const url = `${baseUrl.replace(/\/$/, "")}/latest?from=${base}&to=${quotes.join(",")}`;
  const json = (await fetchJson(url)) as { rates?: Record<string, number> };
  if (!json.rates) throw new Error("Sağlayıcı kur listesi döndürmedi");
  return { base, rates: json.rates, provider: "frankfurter" };
}

/** open.er-api.com adaptörü. */
async function erapi(base: string, quotes: string[], baseUrl: string): Promise<FetchedRates> {
  const url = `${baseUrl.replace(/\/$/, "")}/latest/${base}`;
  const json = (await fetchJson(url)) as { result?: string; rates?: Record<string, number> };
  if (json.result !== "success" || !json.rates) throw new Error("Sağlayıcı kur listesi döndürmedi");
  const rates: Record<string, number> = {};
  for (const quote of quotes) {
    const value = json.rates[quote];
    if (typeof value === "number") rates[quote] = value;
  }
  return { base, rates, provider: "erapi" };
}

const ADAPTERS: Record<
  string,
  (base: string, quotes: string[], baseUrl: string) => Promise<FetchedRates>
> = { frankfurter, erapi };

export async function loadProviders(supabase: Admin): Promise<ProviderRow[]> {
  const { data, error } = await supabase
    .from("exchange_rate_providers")
    .select("id, code, name, adapter, base_url, requires_key, secret_name, priority, is_active")
    .eq("is_active", true)
    .order("priority");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProviderRow[];
}

async function markProvider(
  supabase: Admin,
  provider: ProviderRow,
  ok: boolean,
  error?: string,
): Promise<void> {
  const patch = ok
    ? { last_status: "ok", last_error: null, last_success_at: new Date().toISOString(), failure_count: 0 }
    : { last_status: "error", last_error: error?.slice(0, 400) ?? "bilinmeyen hata" };
  await supabase.from("exchange_rate_providers").update(patch as never).eq("id", provider.id);
  if (!ok) {
    const { data } = await supabase
      .from("exchange_rate_providers")
      .select("failure_count")
      .eq("id", provider.id)
      .maybeSingle();
    await supabase
      .from("exchange_rate_providers")
      .update({ failure_count: Number(data?.failure_count ?? 0) + 1 } as never)
      .eq("id", provider.id);
  }
}

/** Sağlayıcı zincirini sırayla dener; hepsi başarısız olursa null döner. */
export async function fetchRatesWithFailover(
  supabase: Admin,
  base: string,
  quotes: string[],
  preferredCode?: string | null,
): Promise<FetchedRates | null> {
  const wanted = quotes.filter((code) => code !== base);
  if (wanted.length === 0) return { base, rates: {}, provider: "noop" };

  const providers = await loadProviders(supabase);
  const ordered = preferredCode
    ? [...providers].sort((a, b) => (a.code === preferredCode ? -1 : b.code === preferredCode ? 1 : 0))
    : providers;

  for (const provider of ordered) {
    const adapter = ADAPTERS[provider.adapter];
    if (!adapter) continue;
    try {
      const result = await adapter(base, wanted, provider.base_url ?? "");
      if (Object.keys(result.rates).length === 0) throw new Error("Boş kur listesi");
      await markProvider(supabase, provider, true);
      return { ...result, provider: provider.code };
    } catch (error) {
      await markProvider(supabase, provider, false, error instanceof Error ? error.message : undefined);
    }
  }
  return null;
}

export type SyncResult = {
  storeId: string;
  base: string;
  updated: { quote: string; oldRate: number | null; newRate: number }[];
  skippedManual: string[];
  provider: string | null;
  failedOver: boolean;
};

/**
 * Bir mağazanın aktif para birimleri için kurları günceller.
 * Manuel kur kilidi olan para birimlerinin üzerine asla yazılmaz.
 */
export async function syncStoreRates(supabase: Admin, storeId: string): Promise<SyncResult> {
  const [{ data: settings }, { data: currencies }, { data: existing }] = await Promise.all([
    supabase
      .from("store_pricing_settings")
      .select("base_currency, provider_code")
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_currencies")
      .select("currency, is_active, use_manual_rate, manual_rate")
      .eq("store_id", storeId)
      .eq("is_active", true),
    supabase
      .from("currency_rates")
      .select("base_currency, quote_currency, rate")
      .eq("store_id", storeId),
  ]);

  const base = (settings?.base_currency ?? "TRY").toUpperCase();
  const rows = currencies ?? [];
  const manual = rows.filter((row) => row.use_manual_rate).map((row) => row.currency.toUpperCase());
  const quotes = rows
    .map((row) => row.currency.toUpperCase())
    .filter((code) => code !== base && !manual.includes(code));

  const result: SyncResult = {
    storeId,
    base,
    updated: [],
    skippedManual: manual,
    provider: null,
    failedOver: false,
  };

  // Manuel kurlar her zaman canlı tabloya yazılır (satıcı önceliği).
  for (const row of rows) {
    const code = row.currency.toUpperCase();
    if (!row.use_manual_rate || code === base) continue;
    const rate = Number(row.manual_rate ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    await upsertRate(supabase, storeId, base, code, rate, "manual", null, existing ?? []);
  }

  if (quotes.length === 0) return result;

  const fetched = await fetchRatesWithFailover(supabase, base, quotes, settings?.provider_code ?? null);
  if (!fetched) {
    result.failedOver = true;
    return result; // Son geçerli kur tabloda kalır (cache failover).
  }
  result.provider = fetched.provider;

  for (const [quote, value] of Object.entries(fetched.rates)) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    const previous = (existing ?? []).find(
      (row) => row.base_currency.toUpperCase() === base && row.quote_currency.toUpperCase() === quote,
    );
    const oldRate = previous ? Number(previous.rate) : null;
    await upsertRate(supabase, storeId, base, quote, rate, "auto", fetched.provider, existing ?? []);
    result.updated.push({ quote, oldRate, newRate: rate });
  }

  await supabase
    .from("store_pricing_settings")
    .update({ last_rate_sync_at: new Date().toISOString() } as never)
    .eq("store_id", storeId);

  return result;
}

async function upsertRate(
  supabase: Admin,
  storeId: string,
  base: string,
  quote: string,
  rate: number,
  source: string,
  providerCode: string | null,
  existing: { base_currency: string; quote_currency: string; rate: number | string }[],
): Promise<void> {
  const previous = existing.find(
    (row) => row.base_currency.toUpperCase() === base && row.quote_currency.toUpperCase() === quote,
  );
  const oldRate = previous ? Number(previous.rate) : null;
  if (oldRate !== null && Math.abs(oldRate - rate) < 1e-9) return;

  const payload = {
    store_id: storeId,
    base_currency: base,
    quote_currency: quote,
    rate,
    source,
    fetched_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("currency_rates")
    .upsert(payload as never, { onConflict: "store_id,base_currency,quote_currency" });
  if (error) throw new Error(error.message);

  await supabase.from("exchange_rate_history").insert({
    store_id: storeId,
    base_currency: base,
    quote_currency: quote,
    old_rate: oldRate,
    new_rate: rate,
    source,
    provider_code: providerCode,
  } as never);
}

export type RateFrequency = "manual" | "hourly" | "six_hourly" | "daily";

/** Zamanlanmış görev: sıklığı uygun tüm mağazaların kurlarını günceller. */
export async function syncDueStores(
  supabase: Admin,
  frequencies: RateFrequency[],
): Promise<{ stores: number; results: SyncResult[] }> {
  const { data, error } = await supabase
    .from("store_pricing_settings")
    .select("store_id, update_frequency")
    .in("update_frequency", frequencies);
  if (error) throw new Error(error.message);

  const results: SyncResult[] = [];
  for (const row of data ?? []) {
    try {
      results.push(await syncStoreRates(supabase, row.store_id));
    } catch {
      // Bir mağazanın hatası diğerlerini durdurmaz.
    }
  }
  return { stores: results.length, results };
}
