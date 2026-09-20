/**
 * Tedarikçi toplu ürün yükleme motoru (saf fonksiyonlar).
 * CSV / Excel / XML dosyalarını satır nesnelerine çevirir, alan eşleştirmesi
 * önerir ve satır bazında doğrulama yapar. Veri erişimi yoktur.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

import { parseXmlItems } from "@/lib/dropshipping";

export type ImportFormat = "csv" | "xlsx" | "xml" | "json";

export type MeftiField =
  | "sku"
  | "barcode"
  | "title"
  | "description"
  | "cost_price"
  | "retail_price"
  | "stock"
  | "category"
  | "brand"
  | "images"
  | "color"
  | "size"
  | "currency";

export const MEFTI_FIELDS: Array<{ key: MeftiField; label: string; required: boolean; kind: "text" | "number" }> = [
  { key: "sku", label: "Stok kodu (SKU)", required: true, kind: "text" },
  { key: "title", label: "Ürün adı", required: true, kind: "text" },
  { key: "cost_price", label: "Alış fiyatı", required: true, kind: "number" },
  { key: "retail_price", label: "Satış fiyatı", required: false, kind: "number" },
  { key: "stock", label: "Stok adedi", required: true, kind: "number" },
  { key: "barcode", label: "Barkod", required: false, kind: "text" },
  { key: "description", label: "Açıklama", required: false, kind: "text" },
  { key: "category", label: "Kategori", required: false, kind: "text" },
  { key: "brand", label: "Marka", required: false, kind: "text" },
  { key: "images", label: "Görsel bağlantıları", required: false, kind: "text" },
  { key: "color", label: "Renk", required: false, kind: "text" },
  { key: "size", label: "Beden / ölçü", required: false, kind: "text" },
  { key: "currency", label: "Para birimi", required: false, kind: "text" },
];

/** Yaygın sütun adlarından otomatik eşleştirme önerisi. */
const FIELD_HINTS: Record<MeftiField, string[]> = {
  sku: ["sku", "stokkodu", "stok_kodu", "urunkodu", "ürün kodu", "code", "kod", "stockcode", "productcode"],
  barcode: ["barcode", "barkod", "ean", "gtin", "upc"],
  title: ["title", "name", "urunadi", "ürün adı", "baslik", "başlık", "productname", "isim"],
  description: ["description", "aciklama", "açıklama", "detay", "detail"],
  cost_price: ["cost", "costprice", "alis", "alış", "alisfiyati", "alış fiyatı", "supplierprice", "tedarikfiyati", "buyprice"],
  retail_price: ["price", "satis", "satış", "satisfiyati", "satış fiyatı", "listprice", "retail", "fiyat"],
  stock: ["stock", "stok", "quantity", "adet", "qty", "miktar", "inventory"],
  category: ["category", "kategori", "categoryname", "kategoriadi"],
  brand: ["brand", "marka", "vendor", "manufacturer", "uretici"],
  images: ["image", "images", "resim", "gorsel", "görsel", "picture", "imageurl", "photo"],
  color: ["color", "colour", "renk"],
  size: ["size", "beden", "olcu", "ölçü", "numara"],
  currency: ["currency", "parabirimi", "para birimi", "kur", "doviz"],
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
    if (prefix) out[prefix] = input.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(",");
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

export type ImportRow = {
  index: number;
  sku: string;
  barcode: string | null;
  title: string;
  description: string | null;
  costPrice: number;
  retailPrice: number | null;
  stock: number;
  category: string | null;
  brand: string | null;
  images: string[];
  color: string | null;
  size: string | null;
  currency: string | null;
  errors: string[];
};

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

/** Eşleştirilmiş satırları doğrular; hatalı satırlar errors dizisiyle döner. */
export function validateRows(rows: Array<Record<string, string>>, mapping: FieldMapping): ImportRow[] {
  const seenSku = new Set<string>();
  return rows.map((row, index) => {
    const pick = (field: MeftiField) => {
      const column = mapping[field];
      return column ? (row[column] ?? "").trim() : "";
    };

    const errors: string[] = [];
    const sku = pick("sku");
    const title = pick("title");
    const costRaw = pick("cost_price");
    const retailRaw = pick("retail_price");
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

    const stock = Math.round(parseNumber(stockRaw));
    if (!stockRaw) errors.push("Stok adedi boş");
    else if (stock < 0) errors.push("Stok adedi negatif olamaz");

    const images = pick("images")
      .split(/[,|;\s]+/)
      .map((value) => value.trim())
      .filter((value) => /^https?:\/\//i.test(value));
    if (pick("images") && images.length === 0) errors.push("Görsel bağlantısı http ile başlamalı");

    return {
      index,
      sku,
      barcode: pick("barcode") || null,
      title,
      description: pick("description") || null,
      costPrice,
      retailPrice,
      stock: Math.max(0, stock),
      category: pick("category") || null,
      brand: pick("brand") || null,
      images,
      color: pick("color") || null,
      size: pick("size") || null,
      currency: (pick("currency") || "").toUpperCase() || null,
      errors,
    };
  });
}

export function importSummary(rows: ImportRow[]) {
  const invalid = rows.filter((row) => row.errors.length > 0);
  return {
    total: rows.length,
    valid: rows.length - invalid.length,
    invalid: invalid.length,
    errorRows: invalid.slice(0, 200).map((row) => ({ line: row.index + 2, sku: row.sku, errors: row.errors })),
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
