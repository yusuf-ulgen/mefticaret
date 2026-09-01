/**
 * Depolama sağlayıcı soyutlaması.
 *
 * Tüm medya kayıtları `storage_provider` + `bucket` + `storage_path` üçlüsüyle
 * saklanır. Bugün varsayılan sağlayıcı Lovable Cloud deposudur; ileride S3 /
 * R2 / GCS gibi S3 uyumlu bir object storage'a geçmek için yalnızca yeni bir
 * adapter eklenir, veri modeli ve arayüz değişmez.
 */

export type StorageProvider = "supabase" | "s3" | "r2" | "gcs";

export const DEFAULT_STORAGE_PROVIDER: StorageProvider = "supabase";
export const DEFAULT_BUCKET = "store-media";

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  supabase: "Yerleşik depo",
  s3: "Amazon S3",
  r2: "Cloudflare R2",
  gcs: "Google Cloud Storage",
};

/** Mağaza + klasör bazlı, çakışmayan nesne anahtarı üretir. */
export function buildObjectKey(input: {
  storeId: string;
  assetId: string;
  fileName: string;
  variant?: string;
}) {
  const safeName = sanitizeFileName(input.fileName);
  const suffix = input.variant ? `${input.variant}-${safeName}` : safeName;
  return `${input.storeId}/library/${input.assetId}/${suffix}`;
}

/** Nesne anahtarında güvenli olmayan karakterleri temizler. */
export function sanitizeFileName(name: string) {
  const trimmed = name.trim().toLowerCase();
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
  };
  const ascii = trimmed.replace(/[çğıöşüâîû]/g, (char) => map[char] ?? char);
  const cleaned = ascii.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "");
  return (cleaned || "dosya").slice(0, 120);
}

/**
 * Responsive görseller için üretilecek genişlikler.
 * S3 uyumlu depoya geçildiğinde aynı liste CDN dönüşümlerine devredilebilir.
 */
export const RESPONSIVE_WIDTHS = [320, 640, 1024, 1600] as const;

export type MediaVariant = {
  width: number;
  height: number;
  path: string;
  size_bytes: number;
  mime_type: string;
};

/** Varyantlardan `srcset` üretir (imzalı/genel adres eşlemesi ile). */
export function buildSrcSet(variants: MediaVariant[], urls: Record<string, string>) {
  return variants
    .map((variant) => (urls[variant.path] ? `${urls[variant.path]} ${variant.width}w` : ""))
    .filter(Boolean)
    .join(", ");
}
