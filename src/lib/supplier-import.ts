/**
 * Tedarikçi toplu ürün yükleme motoru (saf fonksiyonlar).
 * CSV / Excel / XML dosyalarını satır nesnelerine çevirir, alan eşleştirmesi
 * önerir ve satır bazında doğrulama yapar. Veri erişimi yoktur.
 */

import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";

import { parseXmlItems } from "@/lib/dropshipping";
import { splitFeedMedia, splitMediaField } from "@/lib/feed-media";

export type ImportFormat = "csv" | "xlsx" | "xml" | "json";

export type MeftiField =
  | "sku"
  | "barcode"
  | "title"
  | "description"
  | "short_description"
  | "cost_price"
  | "retail_price"
  | "discount_price"
  | "tax_rate"
  | "stock"
  | "category"
  | "category_path"
  | "brand"
  | "images"
  | "videos"
  | "color"
  | "size"
  | "currency"
  | "fabric"
  | "model_size"
  | "hs_code"
  | "weight"
  | "variants"
  | "variant_name"
  | "variant_value"
  | "variant_barcode"
  | "variant_stock"
  | "variant_price"
  | "variant_image";

export type MeftiFieldGroup = "core" | "pricing" | "variants" | "media" | "logistics";

export const MEFTI_FIELD_GROUPS: Array<{ key: MeftiFieldGroup; label: string }> = [
  { key: "core", label: "Ürün çekirdeği" },
  { key: "pricing", label: "Fiyat matrisi" },
  { key: "variants", label: "Varyant çıkarımı" },
  { key: "media", label: "Medya ve video" },
  { key: "logistics", label: "Lojistik ve detay" },
];

export const MEFTI_FIELDS: Array<{
  key: MeftiField;
  label: string;
  required: boolean;
  kind: "text" | "number";
  group: MeftiFieldGroup;
}> = [
  { key: "sku", label: "Stok kodu (SKU)", required: true, kind: "text", group: "core" },
  { key: "title", label: "Ürün adı", required: true, kind: "text", group: "core" },
  { key: "barcode", label: "EAN / GTIN barkod", required: false, kind: "text", group: "core" },
  { key: "description", label: "Uzun açıklama (HTML temizlenir)", required: false, kind: "text", group: "core" },
  { key: "short_description", label: "Kısa açıklama", required: false, kind: "text", group: "core" },
  { key: "brand", label: "Marka", required: false, kind: "text", group: "core" },
  { key: "category", label: "Kategori", required: false, kind: "text", group: "core" },
  { key: "category_path", label: "Kategori ağacı (Kadın > İç Giyim > Sütyen)", required: false, kind: "text", group: "core" },

  { key: "cost_price", label: "Alış fiyatı (maliyet)", required: true, kind: "number", group: "pricing" },
  { key: "retail_price", label: "Satış fiyatı (liste)", required: false, kind: "number", group: "pricing" },
  { key: "discount_price", label: "İndirimli fiyat", required: false, kind: "number", group: "pricing" },
  { key: "tax_rate", label: "KDV oranı (%)", required: false, kind: "number", group: "pricing" },
  { key: "currency", label: "Para birimi (TRY/USD/EUR)", required: false, kind: "text", group: "pricing" },
  { key: "stock", label: "Stok adedi", required: true, kind: "number", group: "pricing" },

  { key: "variants", label: "Varyant düğümü (<variants><variant>)", required: false, kind: "text", group: "variants" },
  { key: "variant_name", label: "Varyant adı (Beden/Renk/Materyal)", required: false, kind: "text", group: "variants" },
  { key: "variant_value", label: "Varyant değeri", required: false, kind: "text", group: "variants" },
  { key: "variant_barcode", label: "Varyant barkodu", required: false, kind: "text", group: "variants" },
  { key: "variant_stock", label: "Varyant stok adedi", required: false, kind: "number", group: "variants" },
  { key: "variant_price", label: "Varyant fiyatı", required: false, kind: "number", group: "variants" },
  { key: "variant_image", label: "Varyant görseli", required: false, kind: "text", group: "variants" },
  { key: "color", label: "Renk", required: false, kind: "text", group: "variants" },
  { key: "size", label: "Beden / ölçü", required: false, kind: "text", group: "variants" },

  { key: "images", label: "Görsel bağlantıları", required: false, kind: "text", group: "media" },
  { key: "videos", label: "Video / Reels bağlantıları", required: false, kind: "text", group: "media" },

  { key: "fabric", label: "Kumaş türü", required: false, kind: "text", group: "logistics" },
  { key: "model_size", label: "Manken ölçüleri", required: false, kind: "text", group: "logistics" },
  { key: "hs_code", label: "GTİP / HS kodu", required: false, kind: "text", group: "logistics" },
  { key: "weight", label: "Ağırlık / desi", required: false, kind: "number", group: "logistics" },
];

/** Yaygın sütun adlarından otomatik eşleştirme önerisi. */
const FIELD_HINTS: Record<MeftiField, string[]> = {
  sku: ["sku", "stokkodu", "stok_kodu", "urunkodu", "ürün kodu", "code", "kod", "stockcode", "productcode"],
  barcode: ["barcode", "barkod", "ean", "gtin", "upc"],
  title: ["title", "name", "urunadi", "ürün adı", "baslik", "başlık", "productname", "isim"],
  description: ["description", "aciklama", "açıklama", "detay", "detail"],
  short_description: ["shortdescription", "kisaaciklama", "kısa açıklama", "kisadetay", "ozet", "özet"],
  cost_price: ["cost", "costprice", "alis", "alış", "alisfiyati", "alış fiyatı", "supplierprice", "tedarikfiyati", "buyprice", "bayifiyat", "pricewithouttax"],
  retail_price: ["price", "satis", "satış", "satisfiyati", "satış fiyatı", "listprice", "retail", "fiyat", "psf"],
  discount_price: ["indirimlifiyat", "indirimli fiyat", "saleprice", "discountprice", "kampanyafiyat"],
  tax_rate: ["kdv", "kdvorani", "tax", "taxrate", "vat"],
  stock: ["stock", "stok", "quantity", "adet", "qty", "miktar", "inventory", "stockamount"],
  category: ["category", "kategori", "categoryname", "kategoriadi"],
  category_path: ["categorypath", "kategoriyolu", "kategoriagaci", "kategori ağacı", "categorytree"],
  brand: ["brand", "marka", "vendor", "manufacturer", "uretici"],
  images: ["image", "images", "resim", "resimler", "gorsel", "görsel", "picture", "imageurl", "photo"],
  videos: ["video", "videourl", "videolink", "reels", "youtube", "vimeo"],
  color: ["color", "colour", "renk"],
  size: ["size", "beden", "olcu", "ölçü", "numara"],
  currency: ["currency", "parabirimi", "para birimi", "kur", "doviz"],
  fabric: ["kumas", "kumaş", "fabric", "material", "materyal"],
  model_size: ["mankenolculeri", "manken", "modelsize", "modelolculeri"],
  hs_code: ["gtip", "hscode", "hs_code"],
  weight: ["agirlik", "ağırlık", "weight", "desi", "kg"],
  variants: ["variants", "variant", "varyantlar", "secenekler", "options", "option"],
  variant_name: ["variantname", "varyantadi", "secenekadi", "optionname"],
  variant_value: ["variantvalue", "varyantdegeri", "secenekdegeri", "optionvalue"],
  variant_barcode: ["variantbarcode", "varyantbarkod"],
  variant_stock: ["variantstock", "varyantstok", "secenekstok"],
  variant_price: ["variantprice", "varyantfiyat"],
  variant_image: ["variantimage", "varyantresim", "secenekresim"],
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

export function detectFormat(fileName: string, content?: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  const head = (content ?? "").trimStart().slice(0, 40);
  if (head.startsWith("<")) return "xml";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  return "csv";
}

export type ParsedFeed = {
  format: ImportFormat;
  columns: string[];
  rows: Array<Record<string, string>>;
};

/** Metin içeriğini (CSV / XML / JSON) satır nesnelerine çevirir. */
export function parseTextFeed(content: string, format: ImportFormat, itemPath?: string): ParsedFeed {
  let rows: Array<Record<string, unknown>> = [];

  if (format === "csv") {
    const result = Papa.parse<Record<string, unknown>>(content.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: "",
    });
    rows = (result.data ?? []) as Array<Record<string, unknown>>;
  } else if (format === "xml") {
    rows = parseXmlItems(content, itemPath ?? null);
  } else if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as Record<string, unknown>)?.["products"] as unknown[]) ??
        ((parsed as Record<string, unknown>)?.["items"] as unknown[]) ??
        [];
    rows = (list as Array<Record<string, unknown>>) ?? [];
  }

  return normalizeRows(rows, format);
}

/** Excel dosyasını (ArrayBuffer) satır nesnelerine çevirir. */
export function parseWorkbook(buffer: ArrayBuffer): ParsedFeed {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { format: "xlsx", columns: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, { defval: "", raw: false });
  return normalizeRows(rows, "xlsx");
}

function normalizeRows(rows: Array<Record<string, unknown>>, format: ImportFormat): ParsedFeed {
  const columns: string[] = [];
  const out: Array<Record<string, string>> = [];

  for (const row of rows) {
    const flat = flatten(row);
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(flat)) {
      if (!columns.includes(key)) columns.push(key);
      record[key] = value;
    }
    if (Object.values(record).some((value) => value.trim().length > 0)) out.push(record);
  }

  return { format, columns, rows: out };
}

function flatten(input: unknown, prefix = "", depth = 0): Record<string, string> {
  const out: Record<string, string> = {};
  if (input === null || input === undefined) return out;
  if (typeof input !== "object") {
    if (prefix) out[prefix] = String(input);
    return out;
  }
  if (Array.isArray(input)) {
    if (!prefix) return out;
    // İç içe varyant/görsel düğümleri JSON olarak korunur; düz listeler virgülle birleşir.
    const hasObject = input.some((item) => item !== null && typeof item === "object");
    out[prefix] = hasObject ? JSON.stringify(input) : input.map((item) => String(item)).join(",");
    return out;
  }
  if (depth > 3) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(out, flatten(value, path, depth + 1));
  }
  return out;
}

export type FieldMapping = Partial<Record<MeftiField, string>>;

/** Sütun adlarına bakarak eşleştirme önerir. */
export function suggestMapping(columns: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  for (const field of MEFTI_FIELDS) {
    const hints = FIELD_HINTS[field.key];
    const match = columns.find((column) => {
      if (used.has(column)) return false;
      const normalized = slug(column.split(".").pop() ?? column);
      return hints.some((hint) => normalized === slug(hint)) || hints.some((hint) => normalized.includes(slug(hint)));
    });
    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }
  return mapping;
}

export type ImportVariant = {
  name: string;
  value: string;
  barcode: string | null;
  stock: number;
  price: number | null;
  image: string | null;
};

export type ImportRow = {
  index: number;
  sku: string;
  barcode: string | null;
  title: string;
  description: string | null;
  shortDescription: string | null;
  costPrice: number;
  retailPrice: number | null;
  discountPrice: number | null;
  taxRate: number | null;
  stock: number;
  category: string | null;
  categoryPath: string[];
  brand: string | null;
  images: string[];
  videos: Array<{ url: string; source: string; embedUrl: string; thumbnailUrl: string | null }>;
  color: string | null;
  size: string | null;
  currency: string | null;
  fabric: string | null;
  modelSize: string | null;
  hsCode: string | null;
  weight: number | null;
  variants: ImportVariant[];
  warnings: string[];
  errors: string[];
};

/** HTML açıklamayı düz metne indirir (script/style ve etiketler temizlenir). */
export function cleanHtml(value: string): string {
  return value
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Kadın > İç Giyim > Sütyen" gibi çok seviyeli kategori yolunu parçalar. */
export function splitCategoryPath(value: string): string[] {
  return value
    .split(/\s*(?:>|»|\/|\|)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** İç içe varyant düğümlerini (JSON olarak korunan) okunabilir varyantlara çevirir. */
export function extractVariants(raw: string, mapping: FieldMapping): ImportVariant[] {
  if (!raw) return [];
  let list: unknown[] = [];
  const text = raw.trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  } else if (text.startsWith("{")) {
    try {
      list = [JSON.parse(text)];
    } catch {
      return [];
    }
  } else {
    // Basit liste: "S,M,L" → her değer ayrı varyant
    return text
      .split(/[,;|]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50)
      .map((value) => ({ name: mapping.variant_name ?? "Beden", value, barcode: null, stock: 0, price: null, image: null }));
  }

  const readKey = (item: Record<string, unknown>, mapped: string | undefined, fallbacks: string[]): string => {
    const keys = [mapped, ...fallbacks].filter(Boolean) as string[];
    for (const key of keys) {
      const direct = item[key] ?? item[key.split(".").pop() ?? key];
      if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
      const lower = Object.keys(item).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
      if (lower && String(item[lower] ?? "").trim()) return String(item[lower]).trim();
    }
    return "";
  };

  const out: ImportVariant[] = [];
  for (const entry of list.slice(0, 60)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const value = readKey(item, mapping.variant_value, ["value", "deger", "değer", "beden", "size", "renk", "color", "name", "isim", "@value"]);
    const name = readKey(item, mapping.variant_name, ["name", "ad", "adi", "attribute", "ozellik", "@name"]) || "Beden";
    if (!value) continue;
    const priceRaw = readKey(item, mapping.variant_price, ["price", "fiyat", "satisfiyati"]);
    out.push({
      name,
      value,
      barcode: readKey(item, mapping.variant_barcode, ["barcode", "barkod", "gtin"]) || null,
      stock: Math.max(0, Math.round(parseNumber(readKey(item, mapping.variant_stock, ["stock", "stok", "adet", "quantity", "miktar"])))),
      price: priceRaw ? parseNumber(priceRaw) : null,
      image: readKey(item, mapping.variant_image, ["image", "resim", "gorsel", "picture"]) || null,
    });
  }
  return out;
}


export function parseNumber(raw: string | undefined | null): number {
  if (!raw) return 0;
  const text = String(raw).replace(/[^\d,.\-]/g, "").trim();
  if (!text) return 0;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma > lastDot) normalized = text.replace(/\./g, "").replace(",", ".");
  else normalized = text.replace(/,/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Eşleştirilmiş satırları doğrular; hatalı satırlar errors, kurtarılan sorunlar
 * (bozuk görsel linki, sıfır stok, dönüştürülen format) warnings ile döner.
 */
export function validateRows(
  rows: Array<Record<string, string>>,
  mapping: FieldMapping,
  baseUrl?: string | null,
): ImportRow[] {
  const seenSku = new Set<string>();
  return rows.map((row, index) => {
    const pick = (field: MeftiField) => {
      const column = mapping[field];
      return column ? (row[column] ?? "").trim() : "";
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    const sku = pick("sku");
    const title = pick("title");
    const costRaw = pick("cost_price");
    const retailRaw = pick("retail_price");
    const discountRaw = pick("discount_price");
    const stockRaw = pick("stock");

    if (!sku) errors.push("Stok kodu (SKU) boş");
    else if (seenSku.has(sku)) errors.push("Bu stok kodu dosyada tekrar ediyor");
    else seenSku.add(sku);

    if (title.length < 2) errors.push("Ürün adı eksik veya çok kısa");

    const costPrice = parseNumber(costRaw);
    if (!costRaw) errors.push("Alış fiyatı boş");
    else if (costPrice <= 0) errors.push("Alış fiyatı sayı olmalı ve 0'dan büyük olmalı");

    const retailPrice = retailRaw ? parseNumber(retailRaw) : null;
    if (retailRaw && (retailPrice === null || retailPrice <= 0)) errors.push("Satış fiyatı geçersiz");
    if (retailPrice !== null && costPrice > 0 && retailPrice < costPrice) {
      errors.push("Satış fiyatı alış fiyatının altında");
    }

    const discountPrice = discountRaw ? parseNumber(discountRaw) : null;
    if (discountPrice !== null && discountPrice <= 0) warnings.push("İndirimli fiyat geçersiz, yok sayıldı");

    const taxRaw = pick("tax_rate");
    let taxRate = taxRaw ? parseNumber(taxRaw) : null;
    if (taxRate !== null && (taxRate < 0 || taxRate > 100)) {
      warnings.push("KDV oranı geçersiz, mağaza varsayılanı kullanılacak");
      taxRate = null;
    }

    const variants = extractVariants(pick("variants"), mapping);
    const variantStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    let stock = Math.round(parseNumber(stockRaw));
    if (!stockRaw && variants.length) stock = variantStock;
    else if (!stockRaw) errors.push("Stok adedi boş");
    if (stock < 0) errors.push("Stok adedi negatif olamaz");
    if (stock === 0 && variantStock === 0) warnings.push("Stok sıfır: ürün stokta yok olarak aktarılır");

    const media = splitFeedMedia(
      [...splitMediaField(pick("images")), ...splitMediaField(pick("videos")), ...variants.map((variant) => variant.image)],
      baseUrl ?? null,
    );
    if (media.converted) warnings.push(`${media.converted} görsel web uyumlu WEBP'ye çevrildi`);
    if (media.invalid.length) warnings.push(`${media.invalid.length} medya bağlantısı okunamadı`);
    if (!media.images.length && (pick("images") || variants.some((variant) => variant.image))) {
      warnings.push("Geçerli görsel bulunamadı, yer tutucu kullanılacak");
    }

    const rawDescription = pick("description");
    const categoryPath = splitCategoryPath(pick("category_path") || pick("category"));
    const weightRaw = pick("weight");

    return {
      index,
      sku,
      barcode: pick("barcode") || null,
      title,
      description: rawDescription ? cleanHtml(rawDescription).slice(0, 8000) : null,
      shortDescription: pick("short_description") ? cleanHtml(pick("short_description")).slice(0, 600) : null,
      costPrice,
      retailPrice,
      discountPrice: discountPrice && discountPrice > 0 ? discountPrice : null,
      taxRate,
      stock: Math.max(0, stock),
      category: pick("category") || categoryPath[categoryPath.length - 1] || null,
      categoryPath,
      brand: pick("brand") || null,
      images: media.images.length ? media.images : [],
      videos: media.videos,
      color: pick("color") || null,
      size: pick("size") || null,
      currency: (pick("currency") || "").toUpperCase() || null,
      fabric: pick("fabric") || null,
      modelSize: pick("model_size") || null,
      hsCode: pick("hs_code") || null,
      weight: weightRaw ? parseNumber(weightRaw) : null,
      variants,
      warnings,
      errors,
    };
  });
}

export function importSummary(rows: ImportRow[]) {
  const invalid = rows.filter((row) => row.errors.length > 0);
  const warned = rows.filter((row) => row.warnings.length > 0);
  return {
    total: rows.length,
    valid: rows.length - invalid.length,
    invalid: invalid.length,
    images: rows.reduce((sum, row) => sum + row.images.length, 0),
    videos: rows.reduce((sum, row) => sum + row.videos.length, 0),
    variants: rows.reduce((sum, row) => sum + row.variants.length, 0),
    missingSku: rows.filter((row) => !row.sku).length,
    zeroStock: rows.filter((row) => row.stock === 0).length,
    errorRows: invalid.slice(0, 200).map((row) => ({ line: row.index + 2, sku: row.sku, errors: row.errors })),
    warningRows: warned.slice(0, 200).map((row) => ({ line: row.index + 2, sku: row.sku, warnings: row.warnings })),
  };
}

/* ------------------------------- performans ------------------------------- */

export type SupplierScorecard = {
  orders: number;
  shipped: number;
  cancelled: number;
  returned: number;
  avgShipHours: number | null;
  cancellationRate: number;
  returnRate: number;
  revenue: number;
  commission: number;
  net: number;
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  requested: "Talep edildi",
  approved: "Onaylandı",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

export const LEDGER_STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  payable: "Ödenebilir",
  paid: "Ödendi",
  cancelled: "İptal",
};
