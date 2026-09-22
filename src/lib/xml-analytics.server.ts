/**
 * Tedarikçi (besleme) günlük istatistikleri: her içe aktarım sonunda
 * xml_analytics_daily tablosundaki gün satırı güncellenir.
 * Sayaçlar gün içinde birikir; katalog boyutu ve süre son çalışmayı yansıtır.
 */

type Client = { from: (table: string) => any };

export type ImportRunSummary = {
  totalRecords: number;
  outOfStockCount: number;
  priceChangedCount: number;
  stockChangedCount: number;
  quarantineCount: number;
  durationSeconds: number;
  /** Başarı oranı: hatasız işlenen satır yüzdesi. */
  successRatePercent: number;
};

const clampInt = (value: number, max = 100_000_000) =>
  Math.max(0, Math.min(Math.round(Number.isFinite(value) ? value : 0), max));

const clampNumeric = (value: number, max: number) =>
  Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max));

/** Günlük istatistik satırını oluşturur veya biriktirerek güncelleyir. */
export async function recordImportMetrics(
  admin: Client,
  input: { storeId: string; feedId: string; summary: ImportRunSummary; day?: string },
): Promise<void> {
  const day = input.day ?? new Date().toISOString().slice(0, 10);
  const summary = input.summary;

  try {
    const { data: existing } = await admin
      .from("xml_analytics_daily")
      .select("id, price_changed_count, stock_changed_count, quarantined_items_count")
      .eq("feed_id", input.feedId)
      .eq("date", day)
      .maybeSingle();

    const previous = (existing ?? null) as {
      id: string;
      price_changed_count: number | null;
      stock_changed_count: number | null;
      quarantined_items_count: number | null;
    } | null;

    const payload = {
      store_id: input.storeId,
      feed_id: input.feedId,
      date: day,
      total_products_count: clampInt(summary.totalRecords),
      out_of_stock_count: clampInt(summary.outOfStockCount),
      price_changed_count: clampInt(Number(previous?.price_changed_count ?? 0) + summary.priceChangedCount),
      stock_changed_count: clampInt(Number(previous?.stock_changed_count ?? 0) + summary.stockChangedCount),
      quarantined_items_count: clampInt(
        Number(previous?.quarantined_items_count ?? 0) + summary.quarantineCount,
      ),
      sync_duration_avg_seconds: clampNumeric(summary.durationSeconds, 999_999),
      success_rate_percent: clampNumeric(summary.successRatePercent, 100),
      updated_at: new Date().toISOString(),
    };

    if (previous) {
      await admin.from("xml_analytics_daily").update(payload).eq("id", previous.id);
    } else {
      await admin.from("xml_analytics_daily").insert(payload);
    }
  } catch (error) {
    /* İstatistik yazımı içe aktarımı durdurmaz. */
    console.error("[xml-analytics] günlük istatistik yazılamadı", error);
  }
}
