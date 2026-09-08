/**
 * Dropshipping / tedarikçi besleme saf yardımcıları.
 * Hiçbir DB veya UI bağımlılığı yoktur; XML / CSV / API kaynaklarını
 * ortak `SupplierFeedItem` biçimine çevirir, fiyat ve stok kurallarını uygular.
 */

export type SupplierFeedKind = "xml" | "csv" | "api";
export type SupplierFeedSchedule = "manual" | "hourly" | "six_hourly" | "daily";
export type SupplierFeedRunStatus = "running" | "success" | "failed";
export type SupplierMatchKey = "sku" | "barcode" | "external_id";
export type DropshipOrderStatus =
  | "pending"
  | "sent"
  | "accepted"
  | "shipped"
  | "cancelled"
  | "failed";

export const FEED_KIND_LABEL: Record<SupplierFeedKind, string> = {
  xml: "XML",
  csv: "CSV",
  api: "API (JSON)",
};

export const FEED_SCHEDULE_LABEL: Record<SupplierFeedSchedule, string> = {
  manual: "Manuel",
  hourly: "Saatlik",
  six_hourly: "6 saatte bir",
  daily: "Günlük",
};

export const FEED_SCHEDULE_MINUTES: Record<SupplierFeedSchedule, number | null> = {
  manual: null,
  hourly: 60,
  six_hourly: 360,
  daily: 1440,
};

export const MATCH_KEY_LABEL: Record<SupplierMatchKey, string> = {
  sku: "SKU",
  barcode: "Barkod",
  external_id: "Tedarikçi kodu",
};

export const DROPSHIP_STATUS_LABEL: Record<DropshipOrderStatus, string> = {
  pending: "Beklemede",
  sent: "Gönderildi",
  accepted: "Kabul edildi",
  shipped: "Kargoda",
  cancelled: "İptal",
  failed: "Başarısız",
};

/** Bir sonraki otomatik senkronizasyon zamanı; manuel beslemede null. */
export function nextRunAt(schedule: SupplierFeedSchedule, from: Date = new Date()): string | null {
  const minutes = FEED_SCHEDULE_MINUTES[schedule];
  if (!minutes) return null;
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export type FieldMap = {
  external_id?: string;
  sku?: string;
  barcode?: string;
  title?: string;
  brand?: string;
  category?: string;
  price?: string;
  stock?: string;
  images?: string;
  description?: string;
};

export const DEFAULT_FIELD_MAP: FieldMap = {
  external_id: "id",
  sku: "sku",
  barcode: "barcode",
  title: "name",
  brand: "brand",
  category: "category",
  price: "price",
  stock: "stock",
  images: "image",
  description: "description",
};

export type PriceTier = {
  /** Bu tedarikçi maliyetine kadar (dahil) geçerli kademe; boşsa üst sınırsız */
  upTo?: number;
  /** Kademede uygulanacak oran (0.2 = %20) veya sabit tutar */
  value: number;
};

export type PriceRules = {
  /** markup: maliyet * (1 + value), margin: maliyet / (1 - value), fixed: maliyet + value */
  mode?: "markup" | "margin" | "fixed";
  value?: number;
  rounding?: "none" | "integer" | "psychological";
  minPrice?: number;
  maxPrice?: number;
  /** Tedarikçi para birimi TL değilse uygulanacak çevrim kuru (1 birim = X TL) */
  fxRate?: number;
  /** KDV oranı (%) — satış fiyatına eklenir */
  vatRate?: number;
  /** Tedarikçi fiyatı KDV dahil geliyorsa KDV tekrar eklenmez */
  supplierVatIncluded?: boolean;
  /** Maliyet aralığına göre kademeli kâr oranları (küçükten büyüğe) */
  tiers?: PriceTier[];
};

export type StockRules = {
  /** Güvenlik payı: tedarikçi stoğundan düşülür */
  buffer?: number;
  /** Bu değerin altındaki stok 0 kabul edilir */
  minThreshold?: number;
  /** Vitrinde gösterilecek üst sınır */
  cap?: number;
  /** Kaynakta artık bulunmayan ürünler için davranış */
  missingAction?: "ignore" | "zero_stock" | "deactivate";
};


export type FilterRules = {
  /** Tedarikçi maliyeti bu değerin altındaysa ürün atlanır */
  minSupplierPrice?: number;
  /** Tedarikçi maliyeti bu değerin üstündeyse ürün atlanır */
  maxSupplierPrice?: number;
  /** Bu stok değerinin altındaki ürünler atlanır */
  minStock?: number;
  /** Yalnızca bu markalar aktarılır (boşsa tümü) */
  includeBrands?: string[];
  /** Bu markalar aktarılmaz */
  excludeBrands?: string[];
  /** Yalnızca bu kategoriler aktarılır (boşsa tümü) */
  includeCategories?: string[];
  /** Bu kategoriler aktarılmaz */
  excludeCategories?: string[];
  /** Ürün adı bu kelimelerden birini içeriyorsa atlanır */
  excludeKeywords?: string[];
};

export type SupplierFeedItem = {
  external_id: string | null;
  sku: string | null;
  barcode: string | null;
  title: string;
  brand: string | null;
  category: string | null
  supplier_price: number;
  stock: number;
  images: string[];
  description: string | null;
  raw: Record<string, unknown>;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  // "1.234,56" → "1234.56"
  const normalized =
    cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

/** `a.b.c` yolunu veya düz alan adını kayıttan okur. */
export function pickField(record: Record<string, unknown>, path?: string): unknown {
  if (!path || !record || typeof record !== "object") return undefined;
  if (path in record) return record[path];
  let current: unknown = record;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const decodeEntities = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

/**
 * Bağımlılıksız XML okuyucu. Ürün düğümü adı verilmezse en sık yinelenen
 * düğüm otomatik seçilir. Her ürün düğümü, alt düğüm adı → değer eşlemesine
 * çevrilir; öznitelikler `dugum@ozellik` anahtarıyla eklenir.
 */
export function parseXmlItems(xml: string, itemPath?: string | null): Record<string, unknown>[] {
  const cleaned = xml.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  let nodeName = itemPath?.trim() || "";

  if (!nodeName) {
    // Kapanış etiketlerinden aday düğümleri say; en sık yinelenen ve alt
    // elemanı olan düğüm ürün düğümü kabul edilir.
    const counts = new Map<string, number>();
    for (const match of cleaned.matchAll(/<\/([A-Za-z_][\w.:-]*)>/g)) {
      const name = match[1]!;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const candidates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    for (const [name] of candidates) {
      const probe = new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "g");
      const bodies = Array.from(cleaned.matchAll(probe));
      if (bodies.length > 1 && bodies.every((node) => (node[2] ?? "").includes("<"))) {
        nodeName = name;
        break;
      }
    }
    if (!nodeName && candidates.length) nodeName = candidates[0]![0];
  }
  if (!nodeName) return [];

  const items: Record<string, unknown>[] = [];
  const nodeRe = new RegExp(`<${nodeName}(\\s[^>]*)?>([\\s\\S]*?)</${nodeName}>`, "g");
  for (const node of cleaned.matchAll(nodeRe)) {
    const record: Record<string, unknown> = {};
    const attrBlock = node[1] ?? "";
    for (const attr of attrBlock.matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
      record[`@${attr[1]}`] = decodeEntities(attr[2]!);
    }
    const body = node[2] ?? "";
    for (const child of body.matchAll(/<([A-Za-z_][\w.:-]*)(\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
      const key = child[1]!;
      const value = decodeEntities(child[3]!);
      const existing = record[key];
      if (existing === undefined) record[key] = value;
      else if (Array.isArray(existing)) (existing as unknown[]).push(value);
      else record[key] = [existing, value];
      for (const attr of (child[2] ?? "").matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
        record[`${key}@${attr[1]}`] = decodeEntities(attr[2]!);
      }
    }
    for (const selfClosing of body.matchAll(/<([A-Za-z_][\w.:-]*)([^>]*)\/>/g)) {
      const key = selfClosing[1]!;
      for (const attr of (selfClosing[2] ?? "").matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
        record[`${key}@${attr[1]}`] = decodeEntities(attr[2]!);
      }
    }
    items.push(record);
  }
  return items;
}

/** Ayırıcıyı (`,` `;` `\t` `|`) otomatik bulan CSV okuyucu. */
export function parseCsvItems(text: string): Record<string, unknown>[] {
  const content = text.replace(/^\uFEFF/, "").trim();
  if (!content) return [];
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", "|", ","]
    .map((d) => ({ d, count: firstLine.split(d).length }))
    .sort((a, b) => b.count - a.count)[0]!.d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.replace(/\r$/, ""));
  rows.push(row);

  const header = (rows.shift() ?? []).map((name) => name.trim());
  return rows
    .filter((cells) => cells.some((value) => value.trim().length))
    .map((cells) => {
      const record: Record<string, unknown> = {};
      header.forEach((name, index) => {
        record[name] = (cells[index] ?? "").trim();
      });
      return record;
    });
}

/** API yanıtından ürün dizisini çıkarır. */
export function parseApiItems(payload: unknown, itemPath?: string | null): Record<string, unknown>[] {
  const asArray = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Record<string, unknown>[]) : [];

  if (itemPath?.trim()) {
    const nested = pickField((payload ?? {}) as Record<string, unknown>, itemPath.trim());
    if (Array.isArray(nested)) return asArray(nested);
  }
  if (Array.isArray(payload)) return asArray(payload);
  if (payload && typeof payload === "object") {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object") return asArray(value);
    }
  }
  return [];
}

export function parseFeedPayload(
  kind: SupplierFeedKind,
  body: string,
  itemPath?: string | null,
): Record<string, unknown>[] {
  if (kind === "csv") return parseCsvItems(body);
  if (kind === "api") {
    try {
      return parseApiItems(JSON.parse(body), itemPath);
    } catch {
      return [];
    }
  }
  return parseXmlItems(body, itemPath);
}

const collectImages = (value: unknown): string[] => {
  const out: string[] = [];
  const push = (candidate: unknown) => {
    const text = toText(candidate);
    if (text && /^https?:\/\//i.test(text)) out.push(text);
  };
  if (Array.isArray(value)) value.forEach(push);
  else if (typeof value === "string" && value.includes(",")) value.split(",").forEach(push);
  else push(value);
  return Array.from(new Set(out)).slice(0, 12);
};

/** Ham kaydı alan eşleştirmesiyle normalize eder. */
export function normalizeFeedItem(
  record: Record<string, unknown>,
  fieldMap: FieldMap,
): SupplierFeedItem | null {
  const map = { ...DEFAULT_FIELD_MAP, ...fieldMap };
  const title = toText(pickField(record, map.title));
  const sku = toText(pickField(record, map.sku));
  const externalId = toText(pickField(record, map.external_id));
  const barcode = toText(pickField(record, map.barcode));
  if (!title && !sku && !externalId) return null;

  return {
    external_id: externalId,
    sku,
    barcode,
    title: title ?? sku ?? externalId ?? "İsimsiz ürün",
    brand: toText(pickField(record, map.brand)),
    category: toText(pickField(record, map.category)),
    supplier_price: Math.max(0, toNumber(pickField(record, map.price))),
    stock: Math.max(0, Math.trunc(toNumber(pickField(record, map.stock)))),
    images: collectImages(pickField(record, map.images)),
    description: toText(pickField(record, map.description)),
    raw: record,
  };
}

const round = (value: number, mode: PriceRules["rounding"]): number => {
  if (mode === "integer") return Math.round(value);
  if (mode === "psychological") return Math.max(0, Math.floor(value) + 0.99);
  return Math.round(value * 100) / 100;
};

/** Tedarikçi maliyetinden satış fiyatı üretir. */
export function computeSalePrice(supplierPrice: number, rules: PriceRules = {}): number {
  const value = Number(rules.value ?? 0);
  const mode = rules.mode ?? "markup";
  let price = supplierPrice;
  if (mode === "fixed") price = supplierPrice + value;
  else if (mode === "margin") price = value >= 1 ? supplierPrice : supplierPrice / (1 - value);
  else price = supplierPrice * (1 + value);

  price = round(price, rules.rounding ?? "none");
  if (rules.minPrice !== undefined) price = Math.max(price, rules.minPrice);
  if (rules.maxPrice !== undefined && rules.maxPrice > 0) price = Math.min(price, rules.maxPrice);
  return Math.max(0, Math.round(price * 100) / 100);
}

/** Tedarikçi stoğuna güvenlik payı, alt eşik ve üst sınır kurallarını uygular. */
export function computeStock(supplierStock: number, rules: StockRules = {}): number {
  const threshold = rules.minThreshold ?? 0;
  if (supplierStock <= threshold) return 0;
  let stock = supplierStock - (rules.buffer ?? 0);
  if (stock <= 0) return 0;
  if (rules.cap !== undefined && rules.cap > 0) stock = Math.min(stock, rules.cap);
  return Math.trunc(stock);
}

/** Eşleştirme sözlüğü uygular (kategori / marka). */
export function applyMapping(value: string | null, mapping: Record<string, string> = {}): string | null {
  if (!value) return value;
  return mapping[value] ?? mapping[value.toLowerCase()] ?? value;
}

export function matchValueOf(item: SupplierFeedItem, key: SupplierMatchKey): string | null {
  if (key === "barcode") return item.barcode;
  if (key === "external_id") return item.external_id;
  return item.sku;
}

const lower = (values?: string[]): string[] =>
  (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);

/** Filtre kurallarına göre ürünün aktarılıp aktarılmayacağını belirler. */
export function passesFilters(item: SupplierFeedItem, rules: FilterRules = {}): boolean {
  if (rules.minSupplierPrice !== undefined && item.supplier_price < rules.minSupplierPrice) return false;
  if (rules.maxSupplierPrice !== undefined && rules.maxSupplierPrice > 0 && item.supplier_price > rules.maxSupplierPrice)
    return false;
  if (rules.minStock !== undefined && item.stock < rules.minStock) return false;

  const brand = (item.brand ?? "").toLowerCase();
  const category = (item.category ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();

  const includeBrands = lower(rules.includeBrands);
  if (includeBrands.length && !includeBrands.includes(brand)) return false;
  if (lower(rules.excludeBrands).includes(brand) && brand) return false;

  const includeCategories = lower(rules.includeCategories);
  if (includeCategories.length && !includeCategories.some((value) => category.includes(value))) return false;
  if (lower(rules.excludeCategories).some((value) => value && category.includes(value))) return false;

  if (lower(rules.excludeKeywords).some((word) => word && title.includes(word))) return false;
  return true;
}

/** Satır bazlı metni listeye çevirir (virgül veya satır sonu ayırıcı). */
export function parseList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 200);
}
