/**
 * XmlIntegrator — saf (veri erişimi olmayan) yardımcılar.
 *
 * Kaynak dosyayı (XML / CSV / JSON) satır nesnelerine çevirir, ürün kök
 * düğümünü kendi başına bulur, alan envanteri çıkarır ve hedef alanlar için
 * eşleştirme önerir. Hem sunucu hem tarayıcı tarafında kullanılabilir.
 */

import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";

/* ------------------------------- sabitler -------------------------------- */

export const XML_DIRECTIONS = ["import", "export"] as const;
export type XmlDirection = (typeof XML_DIRECTIONS)[number];

export const XML_DIRECTION_LABELS: Record<XmlDirection, string> = {
  import: "İçe aktarım (tedarikçiden)",
  export: "Dışa aktarım (pazaryerine)",
};

export const XML_PLATFORMS = [
  "generic",
  "trendyol",
  "hepsiburada",
  "n11",
  "amazon",
  "ciceksepeti",
  "pttavm",
  "google_shopping",
] as const;
export type XmlPlatform = (typeof XML_PLATFORMS)[number];

export const XML_PLATFORM_LABELS: Record<XmlPlatform, string> = {
  generic: "Genel XML",
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  n11: "N11",
  amazon: "Amazon",
  ciceksepeti: "Çiçeksepeti",
  pttavm: "PTT AVM",
  google_shopping: "Google Shopping",
};

export const XML_SOURCE_FORMATS = ["xml", "csv", "xlsx", "json"] as const;
export type XmlSourceFormat = (typeof XML_SOURCE_FORMATS)[number];

export const XML_SOURCE_FORMAT_LABELS: Record<XmlSourceFormat, string> = {
  xml: "XML",
  csv: "CSV",
  xlsx: "Excel",
  json: "JSON",
};

export const XML_SCHEDULES = [
  "manual",
  "hourly",
  "three_hourly",
  "six_hourly",
  "twelve_hourly",
  "daily",
  "custom",
] as const;
export type XmlSchedule = (typeof XML_SCHEDULES)[number];

export const XML_SCHEDULE_LABELS: Record<XmlSchedule, string> = {
  manual: "Elle",
  hourly: "Saatlik",
  three_hourly: "3 saatte bir",
  six_hourly: "6 saatte bir",
  twelve_hourly: "12 saatte bir",
  daily: "Günlük",
  custom: "Özel cron",
};

/** Plan sıklığının saat cinsinden aralığı (manual = null). */
export const XML_SCHEDULE_HOURS: Record<XmlSchedule, number | null> = {
  manual: null,
  hourly: 1,
  three_hourly: 3,
  six_hourly: 6,
  twelve_hourly: 12,
  daily: 24,
  custom: null,
};

/** Cron alanı ("*", "*/5", "1-5", "0,30") için izinli değer kümesi. */
function cronFieldValues(field: string, min: number, max: number): number[] | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) return null;
    let from = min;
    let to = max;
    if (range !== "*") {
      const bounds = (range ?? "").split("-");
      const start = Number(bounds[0]);
      const end = bounds[1] === undefined ? start : Number(bounds[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
      if (start < min || end > max || start > end) return null;
      from = start;
      to = end;
    }
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values.size ? [...values].sort((a, b) => a - b) : null;
}

/** 5 alanlı cron ifadesini çözer; geçersizse null döner. */
export function parseCron(expression: string) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minutes = cronFieldValues(fields[0]!, 0, 59);
  const hours = cronFieldValues(fields[1]!, 0, 23);
  const days = cronFieldValues(fields[2]!, 1, 31);
  const months = cronFieldValues(fields[3]!, 1, 12);
  const weekdays = cronFieldValues(fields[4]!.replace(/7/g, "0"), 0, 6);
  if (!minutes || !hours || !days || !months || !weekdays) return null;
  return {
    minutes,
    hours,
    days,
    months,
    weekdays,
    anyDay: fields[2] === "*",
    anyWeekday: fields[4] === "*",
  };
}

export const isValidCron = (expression: string) => parseCron(expression) !== null;

/**
 * Cron ifadesinin verilen andan sonraki ilk çalışma zamanını (UTC) bulur.
 * Bir yıl içinde eşleşme yoksa null döner.
 */
export function nextCronRun(expression: string, from: Date = new Date()): Date | null {
  const cron = parseCron(expression);
  if (!cron) return null;
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const limit = 60 * 24 * 366;
  for (let index = 0; index < limit; index += 1) {
    const matchesDay = cron.anyDay || cron.days.includes(cursor.getUTCDate());
    const matchesWeekday = cron.anyWeekday || cron.weekdays.includes(cursor.getUTCDay());
    const dayOk = cron.anyDay && cron.anyWeekday ? true : cron.anyDay ? matchesWeekday : cron.anyWeekday ? matchesDay : matchesDay || matchesWeekday;
    if (
      dayOk &&
      cron.months.includes(cursor.getUTCMonth() + 1) &&
      cron.hours.includes(cursor.getUTCHours()) &&
      cron.minutes.includes(cursor.getUTCMinutes())
    ) {
      return cursor;
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

export const XML_AUTH_TYPES = ["none", "basic", "bearer", "header", "query"] as const;
export type XmlAuthType = (typeof XML_AUTH_TYPES)[number];

export const XML_AUTH_TYPE_LABELS: Record<XmlAuthType, string> = {
  none: "Gerekmiyor",
  basic: "Kullanıcı adı & şifre",
  bearer: "Erişim anahtarı (Bearer)",
  header: "Özel başlık",
  query: "Adres parametresi",
};

export const XML_RUN_STATUSES = ["queued", "running", "success", "partial", "failed"] as const;
export type XmlRunStatus = (typeof XML_RUN_STATUSES)[number];

export const XML_RUN_STATUS_LABELS: Record<XmlRunStatus, string> = {
  queued: "Kuyrukta",
  running: "Çalışıyor",
  success: "Başarılı",
  partial: "Kısmen başarılı",
  failed: "Başarısız",
};

/* ----------------------------- hedef alanlar ----------------------------- */

export type TargetFieldGroup = "core" | "pricing" | "stock" | "media" | "logistics";

export const TARGET_FIELD_GROUP_LABELS: Record<TargetFieldGroup, string> = {
  core: "Temel bilgiler",
  pricing: "Fiyat & vergi",
  stock: "Stok & varyant",
  media: "Görsel & video",
  logistics: "Kargo & gümrük",
};

export type TargetField = {
  key: string;
  label: string;
  group: TargetFieldGroup;
  required?: boolean;
  hint?: string;
  aliases: string[];
};

/** Mefticaret ürün alanları ve tedarikçi dosyalarındaki yaygın karşılıkları. */
export const TARGET_FIELDS: TargetField[] = [
  { key: "sku", label: "Stok kodu (SKU)", group: "core", required: true, aliases: ["sku", "stokkodu", "stok_kodu", "urunkodu", "product_code", "code", "kod", "merchantsku", "stockcode"] },
  { key: "barcode", label: "Barkod / EAN", group: "core", aliases: ["barkod", "barcode", "ean", "gtin", "upc"] },
  { key: "title", label: "Ürün adı", group: "core", required: true, aliases: ["ad", "adi", "urunadi", "baslik", "title", "name", "productname", "urun_adi"] },
  { key: "description", label: "Açıklama", group: "core", aliases: ["aciklama", "detay", "description", "detail", "urunaciklama", "body"] },
  { key: "brand", label: "Marka", group: "core", aliases: ["marka", "brand", "vendor", "manufacturer"] },
  { key: "category", label: "Kategori", group: "core", aliases: ["kategori", "category", "categoryname", "kategoriadi"] },
  { key: "category_path", label: "Kategori yolu", group: "core", hint: "Ana > alt kategori", aliases: ["kategoriyolu", "categorypath", "kategori_agaci", "breadcrumb"] },
  { key: "cost_price", label: "Alış fiyatı", group: "pricing", aliases: ["alisfiyati", "alis_fiyat", "costprice", "cost", "tedarikcifiyati", "bayifiyati"] },
  { key: "price", label: "Satış fiyatı", group: "pricing", required: true, aliases: ["fiyat", "satisfiyati", "price", "saleprice", "listprice", "tutar"] },
  { key: "compare_at_price", label: "Liste (üstü çizili) fiyat", group: "pricing", aliases: ["piyasafiyati", "listfiyat", "compareatprice", "oldprice", "psf"] },
  { key: "tax_rate", label: "KDV oranı", group: "pricing", aliases: ["kdv", "kdvorani", "tax", "taxrate", "vat"] },
  { key: "currency", label: "Para birimi", group: "pricing", aliases: ["parabirimi", "currency", "doviz", "kur"] },
  { key: "stock", label: "Stok adedi", group: "stock", required: true, aliases: ["stok", "stokadedi", "stock", "quantity", "qty", "adet", "miktar"] },
  { key: "variant_name", label: "Varyant adı", group: "stock", hint: "Beden, Renk, Materyal", aliases: ["varyant", "variant", "ozellik", "option", "secenek"] },
  { key: "variant_value", label: "Varyant değeri", group: "stock", aliases: ["varyantdegeri", "variantvalue", "optionvalue", "deger"] },
  { key: "color", label: "Renk", group: "stock", aliases: ["renk", "color", "colour"] },
  { key: "size", label: "Beden / ölçü", group: "stock", aliases: ["beden", "size", "olcu", "numara"] },
  { key: "material", label: "Materyal", group: "stock", aliases: ["materyal", "material", "kumas", "fabric"] },
  { key: "images", label: "Görseller", group: "media", aliases: ["resim", "resimler", "gorsel", "gorseller", "image", "images", "picture", "imageurl", "photo"] },
  { key: "videos", label: "Videolar", group: "media", aliases: ["video", "videolar", "videourl", "youtube", "vimeo"] },
  { key: "weight", label: "Ağırlık (kg)", group: "logistics", aliases: ["agirlik", "weight", "kg", "kilo", "desi"] },
  { key: "hs_code", label: "GTIP / HS kodu", group: "logistics", aliases: ["gtip", "hscode", "hs_code", "gtipkodu"] },
  { key: "shipping_days", label: "Kargoya veriliş (gün)", group: "logistics", aliases: ["terminsuresi", "kargosuresi", "shippingdays", "leadtime"] },
];

export type FieldMapping = Record<string, string>;

/* ------------------------------- ayrıştırma ------------------------------ */

export type ParsedSource = {
  format: XmlSourceFormat;
  rootPath: string | null;
  rootCandidates: Array<{ path: string; count: number }>;
  columns: string[];
  rows: Array<Record<string, string>>;
  totalRows: number;
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/[\s_\-./\\[\]]/g, "")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

/** Dosya adı ve içeriğe göre biçimi belirler. */
export function detectFormat(fileName: string | null, content?: string): XmlSourceFormat {
  const name = (fileName ?? "").toLocaleLowerCase("tr");
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".xml")) return "xml";
  const head = (content ?? "").trimStart().slice(0, 200);
  if (head.startsWith("<")) return "xml";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  return "csv";
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Nesneyi tek seviyeye indirir: `varyantlar.varyant.renk` gibi yollar üretir. */
export function flattenRecord(input: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (input === null || input === undefined) return out;
  if (Array.isArray(input)) {
    const scalars = input.filter((item) => !isPlainObject(item) && !Array.isArray(item));
    if (scalars.length === input.length) {
      out[prefix || "value"] = scalars.map((item) => String(item)).join(",");
      return out;
    }
    input.slice(0, 50).forEach((item, index) => flattenRecord(item, prefix ? `${prefix}[${index}]` : `[${index}]`, out));
    return out;
  }
  if (isPlainObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenRecord(value, path, out);
    }
    return out;
  }
  out[prefix || "value"] = String(input);
  return out;
}

type Candidate = { path: string; count: number; rows: Array<Record<string, unknown>> };

/** Ağaçta tekrar eden ürün listelerini bulur (en çok tekrar eden aday kazanır). */
function collectCandidates(node: unknown, path: string, depth: number, out: Candidate[]): void {
  if (depth > 8 || !isPlainObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    if (Array.isArray(value)) {
      const objects = value.filter(isPlainObject);
      if (objects.length >= 1) out.push({ path: childPath, count: objects.length, rows: objects });
      objects.slice(0, 3).forEach((item) => collectCandidates(item, childPath, depth + 1, out));
    } else if (isPlainObject(value)) {
      collectCandidates(value, childPath, depth + 1, out);
    }
  }
}

function rowsFromTree(tree: unknown, itemPath?: string | null) {
  const candidates: Candidate[] = [];
  collectCandidates(tree, "", 0, candidates);
  candidates.sort((a, b) => b.count - a.count);

  if (itemPath) {
    const wanted = candidates.find((candidate) => candidate.path === itemPath);
    if (wanted) return { chosen: wanted, candidates };
  }
  return { chosen: candidates[0] ?? null, candidates };
}

function buildParsed(
  format: XmlSourceFormat,
  chosen: Candidate | null,
  candidates: Candidate[],
  limit: number,
): ParsedSource {
  const rows = (chosen?.rows ?? []).slice(0, limit).map((row) => flattenRecord(row));
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const generic = key.replace(/\[\d+\]/g, "[]");
      if (!columns.includes(generic)) columns.push(generic);
    }
  }
  return {
    format,
    rootPath: chosen?.path ?? null,
    rootCandidates: candidates.slice(0, 12).map(({ path, count }) => ({ path, count })),
    columns,
    rows,
    totalRows: chosen?.count ?? 0,
  };
}

/** Metin içeriği (XML / CSV / JSON) satırlara çevirir. */
export function parseSourceText(
  content: string,
  format: XmlSourceFormat,
  options: { itemPath?: string | null; limit?: number } = {},
): ParsedSource {
  const limit = options.limit ?? 500;

  if (format === "csv") {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
      transformHeader: (header) => header.trim(),
    });
    const rows = (result.data ?? []).filter((row) => Object.values(row).some((value) => String(value ?? "").trim()));
    const columns = (result.meta.fields ?? []).map((field) => field.trim()).filter(Boolean);
    return {
      format,
      rootPath: null,
      rootCandidates: [],
      columns,
      rows: rows.slice(0, limit).map((row) => flattenRecord(row)),
      totalRows: rows.length,
    };
  }

  if (format === "json") {
    let tree: unknown;
    try {
      tree = JSON.parse(content);
    } catch {
      throw new Error("JSON içeriği okunamadı");
    }
    if (Array.isArray(tree)) {
      const objects = tree.filter(isPlainObject);
      const chosen: Candidate = { path: "", count: objects.length, rows: objects };
      return buildParsed(format, chosen, [chosen], limit);
    }
    const { chosen, candidates } = rowsFromTree(tree, options.itemPath ?? null);
    if (!chosen) throw new Error("JSON içinde ürün listesi bulunamadı");
    return buildParsed(format, chosen, candidates, limit);
  }

  // XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    cdataPropName: "#cdata",
    isArray: () => false,
  });
  let tree: unknown;
  try {
    tree = parser.parse(content);
  } catch {
    throw new Error("XML içeriği okunamadı");
  }
  const { chosen, candidates } = rowsFromTree(tree, options.itemPath ?? null);
  if (!chosen) {
    // Tek ürünlü beslemelerde dizi oluşmaz; en derin tekil nesneyi satır kabul et.
    const flat = flattenRecord(tree);
    if (!Object.keys(flat).length) throw new Error("XML içinde ürün düğümü bulunamadı");
    return { format, rootPath: null, rootCandidates: [], columns: Object.keys(flat), rows: [flat], totalRows: 1 };
  }
  return buildParsed(format, chosen, candidates, limit);
}

/* ----------------------------- eşleştirme ------------------------------- */

/** Sütun adlarına bakarak hedef alan eşleştirmesi önerir. */
export function suggestMapping(columns: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  const normalized = columns.map((column) => ({
    column,
    leaf: normalize(column.split(".").pop() ?? column),
    full: normalize(column),
  }));

  for (const field of TARGET_FIELDS) {
    const exact = normalized.find(
      (item) => !used.has(item.column) && (field.aliases.includes(item.leaf) || field.aliases.includes(item.full)),
    );
    const partial =
      exact ??
      normalized.find(
        (item) =>
          !used.has(item.column) &&
          field.aliases.some((alias) => alias.length >= 4 && (item.leaf.includes(alias) || item.full.includes(alias))),
      );
    if (partial) {
      mapping[field.key] = partial.column;
      used.add(partial.column);
    }
  }
  return mapping;
}

/** Eşleştirmede eksik olan zorunlu alanları döndürür. */
export function missingRequiredFields(mapping: FieldMapping): TargetField[] {
  return TARGET_FIELDS.filter((field) => field.required && !mapping[field.key]);
}

/** Bir satırdan eşleştirilmiş değeri okur (dizi indeksli yollar dahil). */
export function readMapped(row: Record<string, string>, path: string | undefined): string {
  if (!path) return "";
  if (row[path] !== undefined) return row[path];
  if (!path.includes("[]")) return "";
  const prefix = path.split("[]")[0] ?? "";
  const suffix = path.split("[]").slice(1).join("[]");
  const values: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith(prefix) && key.replace(/\[\d+\]/g, "[]") === path) values.push(value);
  }
  return values.join(suffix ? "," : ",");
}
