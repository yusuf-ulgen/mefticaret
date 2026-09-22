/**
 * XmlIntegrator — içe aktarım motoru (sunucu).
 *
 * Katmanlar:
 *  - XmlFetcher       : 60 sn zaman aşımı + 3 denemeli (artan bekleme) indirici.
 *  - XmlParser        : XML/CSV/JSON içeriğini satırlara çeviren bellek dostu sarmalayıcı.
 *  - ProductNormalizer: eşleştirme kurallarını uygulayıp ürün nesnesi üretir.
 *  - ProductUpserter  : 100'erli paketler halinde ürün/varyant/görsel yazımı.
 *  - XmlFeedManager   : tüm akışı yürüten ve çalışma kaydını yazan orkestratör.
 *
 * Tüm kimlik bilgileri yalnızca sunucuda kullanılır; hiçbir değer tarayıcıya dönmez.
 */

import {
  parseSourceText,
  readMapped,
  type FieldMapping,
  type ParsedSource,
  type XmlAuthType,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";
import { fetchSource, saveFieldSchema, type AuthConfig, type FetchedSource } from "@/lib/xml-integrator.server";

/* ------------------------------- XmlFetcher ------------------------------- */

const FETCH_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kalıcı hatalarda (yetki, bulunamadı, boyut) yeniden denemek anlamsızdır. */
function isPermanent(message: string): boolean {
  return /\b(400|401|403|404|410|422)\b/.test(message) || /40 MB|engellendi|özel ağ|geçersiz adres/i.test(message);
}

export type FetchResult = FetchedSource & { attempts: number };

/**
 * XmlFetcher — kaynağı indirir. Her denemede 60 sn zaman aşımı uygulanır,
 * geçici hatalarda en fazla 3 kez (1.5 sn, 3 sn bekleyerek) yeniden denenir.
 */
export async function fetchFeedSource(input: {
  url: string;
  authType?: XmlAuthType;
  authConfig?: AuthConfig;
  format?: XmlSourceFormat | null;
  attempts?: number;
}): Promise<FetchResult> {
  const maxAttempts = Math.max(1, Math.min(input.attempts ?? FETCH_ATTEMPTS, 5));
  let lastError = "Kaynak indirilemedi";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const fetched = await fetchSource(input);
      return { ...fetched, attempts: attempt };
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
      if (isPermanent(lastError) || attempt === maxAttempts) break;
      await sleep(RETRY_BASE_MS * attempt);
    }
  }

  throw new Error(`${lastError} (${maxAttempts} deneme yapıldı)`);
}

/* -------------------------------- XmlParser ------------------------------- */

export const IMPORT_ROW_LIMIT = 5_000;

/**
 * XmlParser — indirilen içeriği satırlara çevirir. Satır sayısı üst sınırla
 * kırpılır; böylece çok büyük beslemeler bellek taşmasına yol açmaz.
 */
export function parseFeedRows(
  fetched: { content: string; format: XmlSourceFormat },
  options: { itemPath?: string | null; limit?: number } = {},
): ParsedSource {
  return parseSourceText(fetched.content, fetched.format, {
    itemPath: options.itemPath ?? null,
    limit: Math.min(options.limit ?? IMPORT_ROW_LIMIT, IMPORT_ROW_LIMIT),
  });
}

/* ----------------------------- Normalizasyon ----------------------------- */

export type NormalizedProduct = {
  key: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  description: string | null;
  vendor: string | null;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  taxRate: number;
  currency: string;
  stock: number;
  weightGrams: number | null;
  videoUrl: string | null;
  images: string[];
  options: Record<string, string>;
};

export type RowError = { row: number; reason: string };

/** "1.234,56" / "1,234.56" / "12 TL" gibi değerleri sayıya çevirir. */
export function parseNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).replace(/[^\d,.\-]/g, "").trim();
  if (!text) return null;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let normalized = text;
  if (hasComma && hasDot) {
    normalized = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (hasComma) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const MEDIA_SPLIT = /[\s,;|]+/;

/** Görsel/video alanlarını bağlantı listesine çevirir. */
function parseUrlList(raw: string): string[] {
  return raw
    .split(MEDIA_SPLIT)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item))
    .slice(0, 10);
}

/**
 * ProductNormalizer — eşleştirmeye göre satırı ürün nesnesine dönüştürür.
 * Zorunlu alanı eksik olan satırlar hata listesine yazılır.
 */
export function normalizeRows(
  rows: Array<Record<string, string>>,
  mapping: FieldMapping,
  options: { priceMarkup?: number | null; currency?: string } = {},
): { items: NormalizedProduct[]; errors: RowError[] } {
  const markup = options.priceMarkup ?? null;
  const fallbackCurrency = (options.currency ?? "TRY").toUpperCase();
  const items: NormalizedProduct[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const read = (field: string) => readMapped(row, mapping[field]).trim();

    const sku = read("sku");
    const barcode = read("barcode");
    const title = read("title");
    const key = (sku || barcode).trim();

    if (!key) {
      errors.push({ row: index + 1, reason: "Stok kodu (SKU) veya barkod boş" });
      return;
    }
    if (!title) {
      errors.push({ row: index + 1, reason: `${key}: ürün adı boş` });
      return;
    }
    if (seen.has(key)) {
      errors.push({ row: index + 1, reason: `${key}: kaynakta tekrarlanan stok kodu` });
      return;
    }

    const rawPrice = parseNumber(read("price"));
    if (rawPrice === null || rawPrice < 0) {
      errors.push({ row: index + 1, reason: `${key}: satış fiyatı okunamadı` });
      return;
    }

    const price = markup === null ? rawPrice : Math.round(rawPrice * (1 + markup / 100) * 100) / 100;
    const stockValue = parseNumber(read("stock"));
    const weight = parseNumber(read("weight"));
    const options_: Record<string, string> = {};
    for (const [field, label] of [
      ["color", "Renk"],
      ["size", "Beden"],
      ["material", "Materyal"],
    ] as const) {
      const value = read(field);
      if (value) options_[label] = value.slice(0, 80);
    }
    const variantName = read("variant_name");
    const variantValue = read("variant_value");
    if (variantName && variantValue) options_[variantName.slice(0, 40)] = variantValue.slice(0, 80);

    const currency = (read("currency") || fallbackCurrency).toUpperCase().slice(0, 3);
    const videos = parseUrlList(read("videos"));

    seen.add(key);
    items.push({
      key,
      sku: sku || null,
      barcode: barcode || null,
      title: title.slice(0, 250),
      description: read("description").slice(0, 20_000) || null,
      vendor: read("brand").slice(0, 120) || null,
      price,
      compareAtPrice: parseNumber(read("compare_at_price")),
      costPrice: parseNumber(read("cost_price")),
      taxRate: parseNumber(read("tax_rate")) ?? 20,
      currency: /^[A-Z]{3}$/.test(currency) ? currency : fallbackCurrency,
      stock: stockValue === null ? 0 : Math.max(0, Math.round(stockValue)),
      weightGrams: weight === null ? null : Math.round(weight < 100 ? weight * 1000 : weight),
      videoUrl: videos[0] ?? null,
      images: parseUrlList(read("images")),
      options: options_,
    });
  });

  return { items, errors };
}

/* ----------------------------- ProductUpserter --------------------------- */

type Client = { from: (table: string) => any };

export const UPSERT_CHUNK_SIZE = 100;

export type UpsertResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
};

const slugify = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "urun";

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * ProductUpserter — normalize edilmiş ürünleri 100'erli paketler halinde yazar.
 * Var olan ürünlerde fiyat/stok/açıklama güncellenir, yeni ürünler taslak
 * (yayınlanmamış) olarak eklenir. Her pakette tek tek satır hatası toplanır.
 */
export async function upsertProducts(
  admin: Client,
  input: {
    storeId: string;
    items: NormalizedProduct[];
    chunkSize?: number;
    publishNew?: boolean;
    updateContent?: boolean;
  },
): Promise<UpsertResult> {
  const result: UpsertResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const size = Math.max(10, Math.min(input.chunkSize ?? UPSERT_CHUNK_SIZE, 250));
  const updateContent = input.updateContent ?? true;

  for (const part of chunk(input.items, size)) {
    const skus = part.map((item) => item.key);

    const { data: existingRows, error: existingError } = await admin
      .from("products")
      .select("id, sku, barcode, slug")
      .eq("store_id", input.storeId)
      .or(`sku.in.(${skus.map((s) => `"${s.replace(/"/g, "")}"`).join(",")}),barcode.in.(${skus
        .map((s) => `"${s.replace(/"/g, "")}"`)
        .join(",")})`);
    if (existingError) throw new Error(existingError.message);

    const byKey = new Map<string, { id: string }>();
    for (const row of (existingRows ?? []) as Array<{ id: string; sku: string | null; barcode: string | null }>) {
      if (row.sku) byKey.set(row.sku, { id: row.id });
      if (row.barcode && !byKey.has(row.barcode)) byKey.set(row.barcode, { id: row.id });
    }

    const toUpdate = part.filter((item) => byKey.has(item.key));
    const toInsert = part.filter((item) => !byKey.has(item.key));

    /* --- var olan ürünler: fiyat ve stok güncellenir --- */
    for (const item of toUpdate) {
      const productId = byKey.get(item.key)!.id;
      const patch: Record<string, unknown> = {
        base_price: item.price,
        compare_at_price: item.compareAtPrice,
        cost_price: item.costPrice,
        tax_rate: item.taxRate,
        currency: item.currency,
        updated_at: new Date().toISOString(),
      };
      if (updateContent) {
        patch["title"] = item.title;
        if (item.description) patch["description"] = item.description;
        if (item.vendor) patch["vendor"] = item.vendor;
        if (item.weightGrams !== null) patch["weight_grams"] = item.weightGrams;
        if (item.barcode) patch["barcode"] = item.barcode;
      }

      const { error } = await admin.from("products").update(patch).eq("id", productId).eq("store_id", input.storeId);
      if (error) {
        result.errors.push({ row: 0, reason: `${item.key}: ${error.message}` });
        result.skipped += 1;
        continue;
      }

      const { data: variants } = await admin
        .from("product_variants")
        .select("id, position")
        .eq("product_id", productId)
        .order("position", { ascending: true })
        .limit(1);
      const variantId = ((variants ?? []) as Array<{ id: string }>)[0]?.id ?? null;
      if (variantId) {
        await admin
          .from("product_variants")
          .update({ price: item.price, stock: item.stock, cost_price: item.costPrice, sku: item.sku })
          .eq("id", variantId);
      } else {
        await admin.from("product_variants").insert({
          product_id: productId,
          store_id: input.storeId,
          title: "Standart",
          sku: item.sku,
          price: item.price,
          stock: item.stock,
          cost_price: item.costPrice,
          position: 1,
        });
      }
      result.updated += 1;
    }

    /* --- yeni ürünler: taslak olarak eklenir --- */
    if (toInsert.length) {
      const stamp = Date.now().toString(36);
      const rows = toInsert.map((item, index) => ({
        store_id: input.storeId,
        title: item.title,
        slug: `${slugify(item.title)}-${slugify(item.key)}-${stamp}${index}`.slice(0, 120),
        sku: item.sku,
        barcode: item.barcode,
        description: item.description,
        vendor: item.vendor,
        base_price: item.price,
        compare_at_price: item.compareAtPrice,
        cost_price: item.costPrice,
        tax_rate: item.taxRate,
        currency: item.currency,
        weight_grams: item.weightGrams,
        video_url: item.videoUrl,
        status: input.publishNew ? "active" : "draft",
      }));

      const { data: inserted, error } = await admin.from("products").insert(rows).select("id, sku, slug");
      if (error) {
        // Paket tümden reddedilirse satırlar tek tek denenir; hatalı olan atlanır.
        for (const [index, item] of toInsert.entries()) {
          const { data: single, error: singleError } = await admin
            .from("products")
            .insert(rows[index] as never)
            .select("id")
            .single();
          if (singleError || !single) {
            result.errors.push({ row: 0, reason: `${item.key}: ${singleError?.message ?? "eklenemedi"}` });
            result.skipped += 1;
            continue;
          }
          await insertChildren(admin, input.storeId, (single as { id: string }).id, item);
          result.created += 1;
        }
      } else {
        const insertedRows = (inserted ?? []) as Array<{ id: string; sku: string | null }>;
        for (const [index, item] of toInsert.entries()) {
          const row = insertedRows[index];
          if (!row) {
            result.skipped += 1;
            continue;
          }
          await insertChildren(admin, input.storeId, row.id, item);
          result.created += 1;
        }
      }
    }
  }

  return result;
}

/** Yeni ürünün varsayılan varyantı ve görselleri. */
async function insertChildren(admin: Client, storeId: string, productId: string, item: NormalizedProduct) {
  const optionEntries = Object.entries(item.options);
  await admin.from("product_variants").insert({
    product_id: productId,
    store_id: storeId,
    title: optionEntries.length ? optionEntries.map(([, value]) => value).join(" / ").slice(0, 80) : "Standart",
    sku: item.sku,
    barcode: item.barcode,
    price: item.price,
    cost_price: item.costPrice,
    compare_at_price: item.compareAtPrice,
    stock: item.stock,
    weight_grams: item.weightGrams,
    options: item.options as never,
    position: 1,
  });

  if (item.images.length) {
    await admin.from("product_images").insert(
      item.images.slice(0, 8).map((url, index) => ({
        store_id: storeId,
        product_id: productId,
        url,
        alt: item.title.slice(0, 120),
        position: index + 1,
      })),
    );
  }
}

/* ----------------------------- XmlFeedManager ---------------------------- */

export type FeedRecord = {
  id: string;
  storeId: string;
  direction: string;
  sourceUrl: string | null;
  sourceFormat: XmlSourceFormat | null;
  itemPath: string | null;
  authType: XmlAuthType;
  authConfig: AuthConfig;
  fieldMapping: FieldMapping;
  priceMarkup: number | null;
  currency: string;
};

export type FeedRunResult = {
  status: "success" | "failed";
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errorMessage: string | null;
  durationSeconds: number;
  attempts: number;
  format: XmlSourceFormat;
  fields: number;
};

/**
 * XmlFeedManager — bir içe aktarım beslemesini uçtan uca yürütür:
 * indir → ayrıştır → alan envanterini kaydet → normalize et → ürünleri yaz →
 * çalışma kaydını ve besleme durumunu güncelle.
 */
export async function runImportFeed(
  admin: Client,
  feed: FeedRecord,
  options: { trigger?: string; rowLimit?: number; nextRunAt?: string | null; publishNew?: boolean } = {},
): Promise<FeedRunResult> {
  const startedAt = new Date();
  const trigger = options.trigger ?? "manual";

  if (feed.direction !== "import") throw new Error("Bu besleme içe aktarım beslemesi değil");
  if (!feed.sourceUrl) throw new Error("Bu beslemede kaynak bağlantısı tanımlı değil");

  const finish = async (result: Omit<FeedRunResult, "durationSeconds">) => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
    await admin.from("xml_import_logs").insert({
      store_id: feed.storeId,
      feed_id: feed.id,
      status: result.status,
      trigger,
      total_rows: result.totalRows,
      created_count: result.created,
      updated_count: result.updated,
      skipped_count: result.skipped,
      error_count: result.errorCount,
      error_message: result.errorMessage,
      duration_seconds: durationSeconds,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
    });
    await admin
      .from("xml_feeds")
      .update({
        last_run_at: startedAt.toISOString(),
        last_status: result.status,
        last_error: result.status === "failed" ? result.errorMessage : null,
        next_run_at: options.nextRunAt ?? null,
        stats: {
          lastCreated: result.created,
          lastUpdated: result.updated,
          lastSkipped: result.skipped,
          lastErrors: result.errorCount,
          lastRows: result.totalRows,
          lastDurationSeconds: durationSeconds,
        } as never,
      })
      .eq("id", feed.id)
      .eq("store_id", feed.storeId);
    return { ...result, durationSeconds };
  };

  try {
    const fetched = await fetchFeedSource({
      url: feed.sourceUrl,
      authType: feed.authType,
      authConfig: feed.authConfig,
      format: feed.sourceFormat,
    });
    const parsed = parseFeedRows(fetched, { itemPath: feed.itemPath, limit: options.rowLimit });
    const fields = await saveFieldSchema(admin, { storeId: feed.storeId, feedId: feed.id, parsed });

    const mapping = feed.fieldMapping ?? {};
    if (!mapping["sku"] && !mapping["barcode"]) {
      throw new Error("Alan eşleme eksik: stok kodu veya barkod alanı eşleştirilmeli");
    }
    if (!mapping["title"] || !mapping["price"]) {
      throw new Error("Alan eşleme eksik: ürün adı ve satış fiyatı alanları eşleştirilmeli");
    }

    const { items, errors } = normalizeRows(parsed.rows, mapping, {
      priceMarkup: feed.priceMarkup,
      currency: feed.currency,
    });
    const upsert = await upsertProducts(admin, {
      storeId: feed.storeId,
      items,
      publishNew: options.publishNew ?? false,
    });

    const allErrors = [...errors, ...upsert.errors];
    return await finish({
      status: "success",
      totalRows: parsed.totalRows,
      created: upsert.created,
      updated: upsert.updated,
      skipped: upsert.skipped + errors.length,
      errorCount: allErrors.length,
      errorMessage: allErrors.length
        ? allErrors.slice(0, 5).map((item) => item.reason).join(" | ").slice(0, 900)
        : null,
      attempts: fetched.attempts,
      format: parsed.format,
      fields,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await finish({
      status: "failed",
      totalRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errorCount: 1,
      errorMessage: message.slice(0, 900),
      attempts: FETCH_ATTEMPTS,
      format: feed.sourceFormat ?? "xml",
      fields: 0,
    });
    throw new Error(message);
  }
}
