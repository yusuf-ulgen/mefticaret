/**
 * Delta senkronizasyon ayarları — tarayıcı ve sunucu tarafında paylaşılan
 * tipler, çözümleyiciler ve verimlilik hesapları.
 */

export const DELTA_HASH_FIELDS = [
  { key: "price", label: "Fiyat" },
  { key: "stock", label: "Stok adedi" },
  { key: "title", label: "Ürün adı" },
  { key: "images", label: "Görseller" },
  { key: "description", label: "Açıklama" },
  { key: "barcode", label: "Barkod" },
  { key: "variants", label: "Varyantlar" },
] as const;

export const DEFAULT_DELTA_HASH_FIELDS = ["price", "stock", "title", "images"] as const;

const ALLOWED_HASH_FIELDS = new Set(DELTA_HASH_FIELDS.map((item) => item.key as string));

export type DeltaSyncConfig = {
  enabled: boolean;
  hashFields: string[];
  forceFullSyncHours: number;
};

export const DEFAULT_DELTA_SYNC_CONFIG: DeltaSyncConfig = {
  enabled: true,
  hashFields: [...DEFAULT_DELTA_HASH_FIELDS],
  forceFullSyncHours: 168,
};

/** Veritabanındaki jsonb ayarını güvenli okur; bilinmeyen alanlar atılır. */
export function parseDeltaSyncConfig(raw: unknown): DeltaSyncConfig {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawFields = Array.isArray(source["hash_fields"])
    ? (source["hash_fields"] as unknown[])
    : Array.isArray(source["hashFields"])
      ? (source["hashFields"] as unknown[])
      : [];
  const fields = rawFields
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => ALLOWED_HASH_FIELDS.has(item));

  const hours = Number(source["force_full_sync_hours"] ?? source["forceFullSyncHours"]);

  return {
    enabled: source["enabled"] === undefined ? true : Boolean(source["enabled"]),
    hashFields: fields.length ? Array.from(new Set(fields)) : [...DEFAULT_DELTA_HASH_FIELDS],
    forceFullSyncHours:
      Number.isFinite(hours) && hours > 0 ? Math.min(Math.round(hours), 24 * 90) : 168,
  };
}

export function serializeDeltaSyncConfig(config: DeltaSyncConfig) {
  return {
    enabled: config.enabled,
    hash_fields: config.hashFields.length ? config.hashFields : [...DEFAULT_DELTA_HASH_FIELDS],
    force_full_sync_hours: config.forceFullSyncHours,
  };
}

/** Zorunlu tam senkronizasyon zamanı geldi mi? */
export function needsFullSync(
  config: DeltaSyncConfig,
  lastFullSyncAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!config.enabled) return true;
  if (!lastFullSyncAt) return true;
  const last = new Date(lastFullSyncAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= config.forceFullSyncHours * 3600_000;
}

/**
 * Atlanan ürün sayısından kazanç oranı: her atlanan ürün ortalama 3 veritabanı
 * sorgusu (ürün okuma, güncelleme, varyant/görsel kontrolü) tasarrufu demektir.
 */
export const QUERIES_PER_PRODUCT = 3;

export function deltaEfficiency(input: { totalRows: number; unchanged: number }) {
  const total = Math.max(0, Math.round(input.totalRows));
  const unchanged = Math.max(0, Math.min(Math.round(input.unchanged), total || Number.MAX_SAFE_INTEGER));
  if (unchanged <= 0) return null;
  const percent = total > 0 ? Math.round((unchanged / total) * 100) : null;
  return { unchanged, percent, savedQueries: unchanged * QUERIES_PER_PRODUCT };
}
