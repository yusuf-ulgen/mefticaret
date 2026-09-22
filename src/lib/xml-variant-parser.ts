/**
 * XmlVariantParser — tedarikçi dosyalarındaki varyasyon yapılarını çözer.
 *
 * İki yapı desteklenir:
 *  - flat   : Her satır bir varyant; satırlar üst stok kodu (parent SKU) alanına göre gruplanır.
 *  - nested : Ürün düğümünün altında `Variants.Variant[]` gibi iç içe varyant düğümleri bulunur.
 *
 * Satırlar `flattenRecord` ile tek seviyeye indirilmiş haldedir; bu yüzden iç içe
 * varyantlar `Variants.Variant[0].SKU` biçiminde anahtarlarla gelir.
 */

export type VariantMode = "none" | "nested" | "flat";

export type VariantConfig = {
  /** Ürün düğümünün yolu (bilgi amaçlı; ayrıştırma satır listesi üzerinden yapılır). */
  parentNodePath: string;
  /** İç içe yapıda varyant düğümünün yolu, ör. `Variants.Variant`. */
  variantNodePath: string;
  /** Düz listede üst ürünü belirleyen alan, ör. `ParentSKU`. */
  parentSkuField: string;
  /** Varyant seçeneği olarak kullanılacak alan adları, ör. `["Renk", "Beden"]`. */
  optionAttributes: string[];
};

export const DEFAULT_VARIANT_CONFIG: VariantConfig = {
  parentNodePath: "",
  variantNodePath: "",
  parentSkuField: "",
  optionAttributes: [],
};

/** Veritabanındaki `variant_mode` değerini güvenli biçimde okur. */
export function parseVariantMode(raw: unknown): VariantMode {
  return raw === "nested" || raw === "flat" ? raw : "none";
}

/** Veritabanındaki `variant_config` JSON'unu güvenli biçimde okur. */
export function parseVariantConfig(raw: unknown): VariantConfig {
  const source = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const text = (key: string) => {
    const value = source[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const attributes = Array.isArray(source["option_attributes"]) ? source["option_attributes"] : [];
  return {
    parentNodePath: text("parent_node_path"),
    variantNodePath: text("variant_node_path"),
    parentSkuField: text("parent_sku_field"),
    optionAttributes: attributes
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

export type SourceRow = Record<string, string>;

export type VariantGroup = {
  /** Gruptaki satır varyantlı bir ürün mü, tekil ürün mü? */
  isVariant: boolean;
  /** Varyantlı üründe üst stok kodu. */
  parentSku: string | null;
  /** Ana ürün bilgilerinin okunacağı satır (gruptaki ilk satır). */
  mainRow: SourceRow;
  /** Varyant satırları; tekil üründe tek eleman olur. */
  variantRows: SourceRow[];
};

/** Yol karşılaştırmasında `[3]` indekslerini yok sayar. */
const generic = (key: string) => key.replace(/\[\d+\]/g, "[]");

/** Bir satırdan alan değeri okur; tam yol, indeks bağımsız yol ve son parça sırayla denenir. */
export function readField(row: SourceRow, field: string): string {
  if (!field) return "";
  if (row[field] !== undefined) return String(row[field]).trim();
  const wanted = generic(field);
  for (const [key, value] of Object.entries(row)) {
    if (generic(key) === wanted) return String(value ?? "").trim();
  }
  const tail = wanted.split(".").pop() ?? wanted;
  for (const [key, value] of Object.entries(row)) {
    if ((generic(key).split(".").pop() ?? "") === tail) return String(value ?? "").trim();
  }
  return "";
}

/**
 * Düz listede (flat) gelen satırları üst stok koduna göre gruplar.
 * Üst stok kodu boş olan satırlar tekil ürün kabul edilir.
 */
export function groupFlatVariants(rows: SourceRow[], parentSkuField: string): VariantGroup[] {
  const groups = new Map<string, SourceRow[]>();
  const singles: SourceRow[] = [];

  for (const row of rows) {
    const parentSku = parentSkuField ? readField(row, parentSkuField) : "";
    if (!parentSku) {
      singles.push(row);
      continue;
    }
    const bucket = groups.get(parentSku);
    if (bucket) bucket.push(row);
    else groups.set(parentSku, [row]);
  }

  const out: VariantGroup[] = [];
  for (const [parentSku, items] of groups) {
    out.push({
      isVariant: items.length > 1,
      parentSku,
      mainRow: items[0] as SourceRow,
      variantRows: items,
    });
  }
  for (const row of singles) {
    out.push({ isVariant: false, parentSku: null, mainRow: row, variantRows: [row] });
  }
  return out;
}

/**
 * İç içe (nested) varyant düğümlerini ayrıştırır. Varyant satırları ana ürünün
 * alanlarını devralır; varyant düğümü içindeki alanlar hem kısa (ör. `SKU`) hem
 * indekssiz tam yol (ör. `Variants.Variant.SKU`) olarak yazılır; böylece hangi
 * biçimde eşleme yapıldıysa okunabilir.
 */
export function parseNestedVariants(row: SourceRow, variantNodePath: string): VariantGroup {
  if (!variantNodePath) return { isVariant: false, parentSku: null, mainRow: row, variantRows: [row] };

  const wanted = generic(variantNodePath);
  const buckets = new Map<string, SourceRow>();
  const parentRow: SourceRow = {};

  for (const [key, value] of Object.entries(row)) {
    const plain = generic(key);
    if (plain === wanted || !plain.startsWith(`${wanted}.`)) {
      if (!plain.startsWith(`${wanted}`)) parentRow[key] = value;
      continue;
    }
    // Varyant düğümündeki indeksi bul: `...Variant[2].SKU` → "2"
    const match = key.slice(0, key.length).match(/\[(\d+)\](?!.*\[\d+\])/);
    const index = match?.[1] ?? "0";
    const relative = plain.slice(wanted.length + 1);
    const bucket = buckets.get(index) ?? {};
    bucket[relative] = value;
    bucket[`${wanted}.${relative}`] = value;
    buckets.set(index, bucket);
  }

  if (!buckets.size) return { isVariant: false, parentSku: null, mainRow: row, variantRows: [row] };

  const variantRows = [...buckets.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, fields]) => ({ ...parentRow, ...fields }));

  return { isVariant: variantRows.length > 0, parentSku: null, mainRow: row, variantRows };
}

/**
 * Besleme ayarına göre satırları varyant gruplarına çevirir.
 * `none` modunda her satır tekil üründür.
 */
export function buildVariantGroups(rows: SourceRow[], mode: VariantMode, config: VariantConfig): VariantGroup[] {
  if (mode === "flat") return groupFlatVariants(rows, config.parentSkuField);
  if (mode === "nested") return rows.map((row) => parseNestedVariants(row, config.variantNodePath));
  return rows.map((row) => ({ isVariant: false, parentSku: null, mainRow: row, variantRows: [row] }));
}
