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
import { applyTransforms, parseTransformRules, type TransformRules } from "@/lib/xml-transforms";
import { parseConnectionType, type ConnectionType } from "@/lib/xml-connection";
import { checkProductSafety, parseGuardrailConfig, type GuardrailConfig } from "@/lib/xml-guardrail";
import type { QuarantineRow } from "@/lib/xml-guardrail.server";
import { fetchSource, saveFieldSchema, type AuthConfig, type FetchedSource } from "@/lib/xml-integrator.server";
import {
  calculateFinalPrice,
  parsePricingRules,
  pricingRulesActive,
  type PricingRules,
} from "@/lib/xml-pricing-rules";
import {
  buildVariantGroups,
  parseVariantConfig,
  parseVariantMode,
  readField,
  type VariantConfig,
  type VariantMode,
} from "@/lib/xml-variant-parser";
import {
  filterChangedProducts,
  loadProductHashes,
  needsFullSync,
  parseDeltaSyncConfig,
  saveProductHashes,
} from "./xml-delta-sync.server";


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
  url?: string | null;
  authType?: XmlAuthType;
  authConfig?: AuthConfig;
  format?: XmlSourceFormat | null;
  attempts?: number;
  connectionType?: ConnectionType;
  ftpConfig?: unknown;
  inlineContent?: string | null;
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

export type NormalizedVariant = {
  sku: string | null;
  barcode: string | null;
  title: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  weightGrams: number | null;
  options: Record<string, string>;
  images: string[];
};

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
  /** Varyasyonlu ürünlerde varyant listesi; tekil üründe boş kalır. */
  variants: NormalizedVariant[];
};


/** Hata kategorileri — canlı sayaç ve kayıt panelinde gruplama için. */
export type ErrorCategory =
  | "FETCH_ERROR"
  | "PARSE_ERROR"
  | "MAPPING_ERROR"
  | "UPSERT_ERROR"
  | "GUARDRAIL_BLOCK";

export type RowError = { row: number; reason: string; category?: ErrorCategory };

/** Hata listesini kategori sayaçlarına çevirir. */
export function countErrorCategories(errors: RowError[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of errors) {
    const key = item.category ?? "MAPPING_ERROR";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}


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
  options: {
    priceMarkup?: number | null;
    /** Fiyatlandırma kuralları (KDV, marj, pazaryeri gideri, yuvarlama). */
    pricingRules?: PricingRules;
    currency?: string;
    transformRules?: TransformRules;
    /** `rows` ile aynı sıradaki varyant satırları (varyasyonlu beslemelerde). */
    variantRows?: Array<Array<Record<string, string>>>;
    /** Varyant seçeneği olarak okunacak ek kaynak alanları. */
    optionAttributes?: string[];
    /** Varyanta özel alan eşlemesi; eksik alanlar ürün eşlemesinden okunur. */
    variantMapping?: FieldMapping;
  } = {},
): { items: NormalizedProduct[]; errors: RowError[] } {

  const markup = options.priceMarkup ?? null;
  const pricing = options.pricingRules && pricingRulesActive(options.pricingRules) ? options.pricingRules : null;
  const finalPrice = (value: number) => {
    const withMarkup = markup === null ? value : Math.round(value * (1 + markup / 100) * 100) / 100;
    return pricing ? calculateFinalPrice(withMarkup, pricing) : withMarkup;
  };
  const fallbackCurrency = (options.currency ?? "TRY").toUpperCase();
  const transforms = options.transformRules ?? {};
  const items: NormalizedProduct[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const read = (field: string) =>
      applyTransforms(readMapped(row, mapping[field]).trim(), transforms[field], row).trim();

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

    const price = finalPrice(rawPrice);
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

    /* --- varyantlar (yalnızca varyasyonlu beslemelerde) --- */
    const groupRows = options.variantRows?.[index] ?? [];
    const variants: NormalizedVariant[] = [];
    const seenVariant = new Set<string>();
    if (groupRows.length > 1 || (groupRows.length === 1 && groupRows[0] !== row)) {
      for (const variantRow of groupRows.slice(0, 200)) {
        const readVariant = (field: string) => {
          const path = options.variantMapping?.[field] || mapping[field];
          return applyTransforms(readMapped(variantRow, path).trim(), transforms[field], variantRow).trim();
        };

        const variantOptions: Record<string, string> = {};
        for (const [field, label] of [
          ["color", "Renk"],
          ["size", "Beden"],
          ["material", "Materyal"],
        ] as const) {
          const value = readVariant(field);
          if (value) variantOptions[label] = value.slice(0, 80);
        }
        const vName = readVariant("variant_name");
        const vValue = readVariant("variant_value");
        if (vName && vValue) variantOptions[vName.slice(0, 40)] = vValue.slice(0, 80);
        for (const attribute of options.optionAttributes ?? []) {
          const value = readField(variantRow, attribute);
          if (value) variantOptions[attribute.split(".").pop()!.slice(0, 40)] = value.slice(0, 80);
        }

        const variantSku = readVariant("sku");
        const variantBarcode = readVariant("barcode");
        const variantKey =
          variantSku ||
          variantBarcode ||
          Object.entries(variantOptions)
            .map(([label, value]) => `${label}:${value}`)
            .join("/");
        if (!variantKey || seenVariant.has(variantKey)) continue;
        seenVariant.add(variantKey);

        const variantRawPrice = parseNumber(readVariant("price"));
        const variantPrice =
          variantRawPrice === null || variantRawPrice < 0 ? price : finalPrice(variantRawPrice);
        const variantStock = parseNumber(readVariant("stock"));
        const variantWeight = parseNumber(readVariant("weight"));

        variants.push({
          sku: variantSku || null,
          barcode: variantBarcode || null,
          title:
            Object.values(variantOptions).join(" / ").slice(0, 80) ||
            (variantSku || variantBarcode || "Standart").slice(0, 80),
          price: variantPrice,
          compareAtPrice: parseNumber(readVariant("compare_at_price")),
          costPrice: parseNumber(readVariant("cost_price")),
          stock: variantStock === null ? 0 : Math.max(0, Math.round(variantStock)),
          weightGrams:
            variantWeight === null ? null : Math.round(variantWeight < 100 ? variantWeight * 1000 : variantWeight),
          options: variantOptions,
          images: parseUrlList(readVariant("images")),
        });
      }
    }

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
      stock:
        variants.length > 0
          ? variants.reduce((total, variant) => total + variant.stock, 0)
          : stockValue === null
            ? 0
            : Math.max(0, Math.round(stockValue)),
      weightGrams: weight === null ? null : Math.round(weight < 100 ? weight * 1000 : weight),
      videoUrl: videos[0] ?? null,
      images: parseUrlList(read("images")),
      options: options_,
      variants,
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
  /** Güvenlik sınırlarına takılıp incelemeye alınan ürün sayısı. */
  quarantined: number;
  /** Fiyatı gerçekten değişen ürün sayısı. */
  priceChanged: number;
  /** Stoğu gerçekten değişen ürün sayısı. */
  stockChanged: number;
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
    /** Güvenlik sınırları: anormal fiyat/stok verisi canlıya yazılmaz, incelemeye alınır. */
    guardrail?: { feedId: string; config: GuardrailConfig };
    /** Her paket bittiğinde çağrılır; canlı ilerleme için kullanılır. */
    onProgress?: (progress: { processed: number; total: number; result: UpsertResult }) => void | Promise<void>;
  },
): Promise<UpsertResult> {
  const result: UpsertResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    quarantined: 0,
    priceChanged: 0,
    stockChanged: 0,
    errors: [],
  };
  const size = Math.max(10, Math.min(input.chunkSize ?? UPSERT_CHUNK_SIZE, 250));
  const updateContent = input.updateContent ?? true;
  const guardrail = input.guardrail && input.guardrail.config.enabled ? input.guardrail : null;
  let processed = 0;

  for (const part of chunk(input.items, size)) {
    const skus = part.map((item) => item.key);


    const { data: existingRows, error: existingError } = await admin
      .from("products")
      .select("id, sku, barcode, slug, base_price")
      .eq("store_id", input.storeId)
      .or(`sku.in.(${skus.map((s) => `"${s.replace(/"/g, "")}"`).join(",")}),barcode.in.(${skus
        .map((s) => `"${s.replace(/"/g, "")}"`)
        .join(",")})`);
    if (existingError) throw new Error(existingError.message);

    const byKey = new Map<string, { id: string; basePrice: number | null }>();
    for (const row of (existingRows ?? []) as Array<{
      id: string;
      sku: string | null;
      barcode: string | null;
      base_price: number | null;
    }>) {
      const entry = { id: row.id, basePrice: row.base_price === null ? null : Number(row.base_price) };
      if (row.sku) byKey.set(row.sku, entry);
      if (row.barcode && !byKey.has(row.barcode)) byKey.set(row.barcode, entry);
    }

    let candidatesUpdate = part.filter((item) => byKey.has(item.key));
    let candidatesInsert = part.filter((item) => !byKey.has(item.key));

    /* --- güvenlik sınırları: anormal veri canlıya yazılmadan ayıklanır --- */
    if (guardrail) {
      const blocked: QuarantineRow[] = [];
      const keep = (item: NormalizedProduct, existingPrice: number | null): boolean => {
        const verdict = checkProductSafety({
          newPrice: item.price,
          newStock: item.stock,
          existingPrice,
          config: guardrail.config,
        });
        if (verdict.safe) return true;
        if (verdict.quarantine) {
          blocked.push({
            item,
            issueType: verdict.issueType,
            oldPrice: existingPrice,
            oldStock: null,
            reason: verdict.reason,
          });
        }
        result.errors.push({
          row: 0,
          reason: `${item.key}: ${verdict.reason}`,
          category: "GUARDRAIL_BLOCK",
        });
        return false;
      };

      candidatesUpdate = candidatesUpdate.filter((item) =>
        keep(item, byKey.get(item.key)?.basePrice ?? null),
      );
      candidatesInsert = candidatesInsert.filter((item) => keep(item, null));

      if (blocked.length) {
        const { quarantineProducts } = await import("@/lib/xml-guardrail.server");
        const saved = await quarantineProducts(admin as never, {
          storeId: input.storeId,
          feedId: guardrail.feedId,
          rows: blocked,
        });
        result.quarantined += saved;
      }
      result.skipped += part.length - candidatesUpdate.length - candidatesInsert.length;
    }

    const toUpdate = candidatesUpdate;
    const toInsert = candidatesInsert;


    /* --- var olan ürünler: fiyat ve stok güncellenir --- */
    for (const item of toUpdate) {
      const existingEntry = byKey.get(item.key)!;
      const productId = existingEntry.id;
      if (existingEntry.basePrice === null || Math.abs(existingEntry.basePrice - item.price) > 0.009) {
        result.priceChanged += 1;
      }
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
        result.errors.push({ row: 0, reason: `${item.key}: ${error.message}`, category: "UPSERT_ERROR" });
        result.skipped += 1;
        continue;
      }

      const { data: variantRows } = await admin
        .from("product_variants")
        .select("id, sku, barcode, position, stock")
        .eq("product_id", productId)
        .order("position", { ascending: true });
      const existingVariants = (variantRows ?? []) as Array<{
        id: string;
        sku: string | null;
        barcode: string | null;
        position: number | null;
        stock: number | null;
      }>;

      /* Stok değişimi: varyasyonlu üründe toplam, tekil üründe ilk varyant. */
      const previousStock = item.variants.length
        ? existingVariants.reduce((sum, row) => sum + Number(row.stock ?? 0), 0)
        : Number(existingVariants[0]?.stock ?? 0);
      const incomingStock = item.variants.length
        ? item.variants.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0)
        : Number(item.stock ?? 0);
      if (previousStock !== incomingStock) result.stockChanged += 1;

      if (item.variants.length) {
        /* Varyasyonlu ürün: her varyant stok kodu/barkoduna göre eşleşir,
           eşleşmeyen varyantlar yeni satır olarak eklenir. */
        const byVariantKey = new Map<string, string>();
        for (const row of existingVariants) {
          if (row.sku) byVariantKey.set(row.sku, row.id);
          if (row.barcode && !byVariantKey.has(row.barcode)) byVariantKey.set(row.barcode, row.id);
        }
        let position = existingVariants.length;
        for (const variant of item.variants) {
          const matchId =
            (variant.sku ? byVariantKey.get(variant.sku) : undefined) ??
            (variant.barcode ? byVariantKey.get(variant.barcode) : undefined) ??
            null;
          if (matchId) {
            await admin
              .from("product_variants")
              .update({
                price: variant.price,
                stock: variant.stock,
                cost_price: variant.costPrice,
                compare_at_price: variant.compareAtPrice,
                ...(Object.keys(variant.options).length ? { options: variant.options as never } : {}),
              })
              .eq("id", matchId);
          } else {
            position += 1;
            await admin.from("product_variants").insert({
              product_id: productId,
              store_id: input.storeId,
              title: variant.title || "Standart",
              sku: variant.sku,
              barcode: variant.barcode,
              price: variant.price,
              cost_price: variant.costPrice,
              compare_at_price: variant.compareAtPrice,
              stock: variant.stock,
              weight_grams: variant.weightGrams,
              options: variant.options as never,
              position,
            });
          }
        }
      } else {
        const variantId = existingVariants[0]?.id ?? null;
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
            result.errors.push({
              row: 0,
              reason: `${item.key}: ${singleError?.message ?? "eklenemedi"}`,
              category: "UPSERT_ERROR",
            });

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
            result.errors.push({ row: 0, reason: `${item.key}: ürün eklenemedi`, category: "UPSERT_ERROR" });
            result.skipped += 1;
            continue;
          }

          await insertChildren(admin, input.storeId, row.id, item);
          result.created += 1;
        }
      }
    }

    processed += part.length;
    if (input.onProgress) await input.onProgress({ processed, total: input.items.length, result });
  }

  return result;
}

/** Yeni ürünün varyantları (varyasyonlu ürünlerde hepsi) ve görselleri. */
async function insertChildren(admin: Client, storeId: string, productId: string, item: NormalizedProduct) {
  const optionEntries = Object.entries(item.options);
  const rows = item.variants.length
    ? item.variants.map((variant, index) => ({
        product_id: productId,
        store_id: storeId,
        title: variant.title || "Standart",
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        cost_price: variant.costPrice,
        compare_at_price: variant.compareAtPrice,
        stock: variant.stock,
        weight_grams: variant.weightGrams,
        options: variant.options as never,
        position: index + 1,
      }))
    : [
        {
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
        },
      ];
  await admin.from("product_variants").insert(rows);


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
  transformRules?: TransformRules | unknown;
  priceMarkup: number | null;
  pricingRules?: PricingRules | unknown;
  currency: string;
  /** "none" | "nested" | "flat" */
  variantMode?: VariantMode | string | null;
  variantConfig?: VariantConfig | unknown;
  deltaSyncConfig?: unknown;
  /** Güvenlik sınırları yapılandırması (xml_feeds.guardrail_config). */
  guardrailConfig?: unknown;
  lastFullSyncAt?: string | null;
  /** Satıcı "Tam senkronizasyon" düğmesine bastıysa delta atlanır. */
  forceFullSync?: boolean;
  /** "url" | "ftp" | "sftp" | "webhook" */
  connectionType?: ConnectionType | string | null;
  ftpConfig?: unknown;
  /** Webhook ile gönderilen ham dosya içeriği. */
  inlineContent?: string | null;
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

  const connectionType = parseConnectionType(feed.connectionType ?? "url");
  if (connectionType === "url" && !feed.sourceUrl) {
    throw new Error("Bu beslemede kaynak bağlantısı tanımlı değil");
  }
  if (connectionType === "webhook" && feed.inlineContent == null) {
    throw new Error("Bu besleme webhook ile beslenir; tedarikçinin dosyayı göndermesi gerekir");
  }

  /* Çalışma kaydı en başta "running" olarak açılır; ilerleme aynı satıra yazılır
     ve tarayıcı Realtime ile bu satırı canlı izler. */
  const { data: logRow } = await admin
    .from("xml_import_logs")
    .insert({
      store_id: feed.storeId,
      feed_id: feed.id,
      status: "running",
      trigger,
      phase: "fetching",
      total_rows: 0,
      processed_count: 0,
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();
  const logId = (logRow as { id: string } | null)?.id ?? null;

  const patchLog = async (patch: Record<string, unknown>) => {
    if (!logId) return;
    await admin.from("xml_import_logs").update(patch).eq("id", logId).eq("store_id", feed.storeId);
  };

  const finish = async (result: Omit<FeedRunResult, "durationSeconds">, errors: RowError[] = []) => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
    const payload = {
      status: result.status,
      phase: "done",
      total_rows: result.totalRows,
      processed_count: result.created + result.updated + result.skipped,
      created_count: result.created,
      updated_count: result.updated,
      skipped_count: result.skipped,
      error_count: result.errorCount,
      error_categories: countErrorCategories(errors) as never,
      errors: errors.slice(0, 50) as never,
      error_message: result.errorMessage,
      duration_seconds: durationSeconds,
      finished_at: new Date().toISOString(),
    };
    if (logId) await patchLog(payload);
    else
      await admin.from("xml_import_logs").insert({
        store_id: feed.storeId,
        feed_id: feed.id,
        trigger,
        started_at: startedAt.toISOString(),
        ...payload,
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

  let phase: "fetching" | "parsing" | "mapping" | "upserting" = "fetching";

  try {
    const fetched = await fetchFeedSource({
      url: feed.sourceUrl,
      authType: feed.authType,
      authConfig: feed.authConfig,
      format: feed.sourceFormat,
      connectionType,
      ftpConfig: feed.ftpConfig,
      inlineContent: feed.inlineContent ?? null,
    });

    phase = "parsing";
    await patchLog({ phase });
    const parsed = parseFeedRows(fetched, {
      itemPath: feed.itemPath,
      ...(options.rowLimit === undefined ? {} : { limit: options.rowLimit }),
    });
    const fields = await saveFieldSchema(admin, { storeId: feed.storeId, feedId: feed.id, parsed });

    phase = "mapping";
    await patchLog({ phase, total_rows: parsed.totalRows });

    /* v2: alan kuralları ve hata eşiği beslemeden okunur (mevcut çağıranlar değişmez). */
    const { data: extraRow } = await admin
      .from("xml_feeds")
      .select("field_rules, max_errors_before_pause, name")
      .eq("id", feed.id)
      .eq("store_id", feed.storeId)
      .maybeSingle();
    const extra = (extraRow ?? {}) as { field_rules?: unknown; max_errors_before_pause?: number; name?: string };
    const { parseFieldRules, applyFieldRules, classifyFailure } = await import("@/lib/xml-field-rules");
    const fieldRules = parseFieldRules(extra.field_rules);
    const maxErrors = Math.max(1, Number(extra.max_errors_before_pause ?? 100));

    const baseMapping = feed.fieldMapping ?? {};
    if (!baseMapping["sku"] && !baseMapping["barcode"]) {
      throw new Error("Alan eşleme eksik: stok kodu veya barkod alanı eşleştirilmeli");
    }
    if (!baseMapping["title"] || !baseMapping["price"]) {
      throw new Error("Alan eşleme eksik: ürün adı ve satış fiyatı alanları eşleştirilmeli");
    }

    /* Varyasyon yapısı: düz liste üst stok koduna göre gruplanır,
       iç içe yapıda varyant düğümleri ayrıştırılır. */
    const variantMode = parseVariantMode(feed.variantMode);
    const variantConfig = parseVariantConfig(feed.variantConfig);
    const groups = buildVariantGroups(parsed.rows, variantMode, variantConfig);

    const ruled = applyFieldRules(
      groups.map((group) => group.mainRow),
      baseMapping,
      fieldRules,
    );
    const mapping = ruled.mapping;
    const requiredMissing = new Set(ruled.missing.map((item) => item.row));
    const mainRows = ruled.rows;

    const normalized = normalizeRows(
      mainRows.filter((_, index) => !requiredMissing.has(index)),
      mapping,
      {
        priceMarkup: feed.priceMarkup,
        pricingRules: parsePricingRules(feed.pricingRules),
        currency: feed.currency,
        transformRules: parseTransformRules(feed.transformRules),
        ...(variantMode === "none"
          ? {}
          : {
              variantRows: groups
                .filter((_, index) => !requiredMissing.has(index))
                .map((group) => group.variantRows),
              optionAttributes: variantConfig.optionAttributes,
              variantMapping: variantConfig.variantMapping,
            }),
      },
    );
    const items = normalized.items;
    const keptRows = mainRows.filter((_, index) => !requiredMissing.has(index));
    const errors: RowError[] = [
      ...ruled.missing.map((item) => ({
        row: item.row + 1,
        reason: `Zorunlu alan eksik: ${item.field}`,
      })),
      ...normalized.errors.map((item) => ({ ...item, row: item.row })),
    ];

    const mappingErrors: RowError[] = errors.map((item) => ({ ...item, category: "MAPPING_ERROR" }));

    /* Hatalı ürünleri "Hatalı Ürünler" listesine yaz (ham satırla). */
    const failedRows: Array<Record<string, unknown>> = [];
    const pickSku = (row: Record<string, string> | undefined) =>
      row ? String(row[baseMapping["sku"] ?? ""] ?? row[baseMapping["barcode"] ?? ""] ?? "").slice(0, 200) || null : null;
    for (const item of ruled.missing) {
      const row = mainRows[item.row];
      failedRows.push({ sku: pickSku(row), error_type: "required", message: `Zorunlu alan eksik: ${item.field}`, raw_data: row ?? {} });
    }
    for (const item of normalized.errors) {
      const row = keptRows[item.row - 1];
      failedRows.push({ sku: pickSku(row), error_type: classifyFailure(item.reason), message: item.reason.slice(0, 500), raw_data: row ?? {} });
    }

    /* Delta senkronizasyon: kayıtlı özetle aynı olan ürünler atlanır.
       Ayarlanan süre geçtiyse (varsayılan 7 gün) tam senkronizasyon yapılır. */
    const deltaConfig = parseDeltaSyncConfig(feed.deltaSyncConfig);
    const fullSync =
      feed.forceFullSync === true || needsFullSync(deltaConfig, feed.lastFullSyncAt ?? null, startedAt);
    const deltaActive = deltaConfig.enabled && !fullSync;
    let itemsToWrite = items;
    let unchangedCount = 0;
    let newHashes: Map<string, string> | null = null;

    if (deltaConfig.enabled) {
      const existingHashes = deltaActive
        ? await loadProductHashes(admin, { storeId: feed.storeId, feedId: feed.id })
        : new Map<string, string>();
      const delta = await filterChangedProducts(items, existingHashes, deltaConfig);
      itemsToWrite = delta.changed;
      unchangedCount = delta.unchangedCount;
      newHashes = delta.hashes;
    }

    const resumeFrom = Math.max(0, Math.min(options.resumeFrom ?? 0, itemsToWrite.length));
    if (resumeFrom) itemsToWrite = itemsToWrite.slice(resumeFrom);

    phase = "upserting";
    await patchLog({
      phase,
      error_count: mappingErrors.length,
      unchanged_count: unchangedCount,
      delta_sync_enabled: deltaActive,
      control_state: "running",
    });

    /* Paketler halinde yazılır; her paket arasında duraklat/durdur isteği ve hata eşiği kontrol edilir. */
    const SLICE = 250;
    const upsert = {
      created: 0,
      updated: 0,
      skipped: 0,
      quarantined: 0,
      priceChanged: 0,
      stockChanged: 0,
      errors: [] as RowError[],
    };
    let interrupted: "paused" | "stopped" | "threshold" | null = null;
    let written = 0;
    let lastTick = 0;
    const upsertStarted = Date.now();

    for (let offset = 0; offset < itemsToWrite.length; offset += SLICE) {
      if (logId && offset > 0) {
        const { data: ctl } = await admin
          .from("xml_import_logs")
          .select("control_state")
          .eq("id", logId)
          .maybeSingle();
        const state = (ctl as { control_state?: string } | null)?.control_state;
        if (state === "pause_requested") { interrupted = "paused"; break; }
        if (state === "stop_requested") { interrupted = "stopped"; break; }
      }
      if (mappingErrors.length + upsert.errors.length >= maxErrors) { interrupted = "threshold"; break; }

      const part = await upsertProducts(admin, {
        storeId: feed.storeId,
        items: itemsToWrite.slice(offset, offset + SLICE),
        publishNew: options.publishNew ?? false,
        guardrail: { feedId: feed.id, config: parseGuardrailConfig(feed.guardrailConfig) },
        onProgress: async ({ processed, result }) => {
          if (Date.now() - lastTick < 800) return;
          lastTick = Date.now();
          const done = written + processed;
          const minutes = Math.max(1 / 60, (Date.now() - upsertStarted) / 60000);
          await patchLog({
            processed_count: resumeFrom + done,
            created_count: upsert.created + result.created,
            updated_count: upsert.updated + result.updated,
            skipped_count: upsert.skipped + result.skipped + mappingErrors.length + unchangedCount,
            error_count: mappingErrors.length + upsert.errors.length + result.errors.length,
            error_categories: countErrorCategories([...mappingErrors, ...upsert.errors, ...result.errors]) as never,
            rate_per_min: Math.round(done / minutes),
          });
        },
      });
      written += Math.min(SLICE, itemsToWrite.length - offset);
      upsert.created += part.created;
      upsert.updated += part.updated;
      upsert.skipped += part.skipped;
      upsert.quarantined += part.quarantined;
      upsert.priceChanged += part.priceChanged;
      upsert.stockChanged += part.stockChanged;
      upsert.errors.push(...part.errors);
    }
    if (!interrupted && mappingErrors.length + upsert.errors.length >= maxErrors) interrupted = "threshold";

    for (const item of upsert.errors) {
      failedRows.push({ sku: item.reason.split(":")[0]?.slice(0, 200) ?? null, error_type: classifyFailure(item.reason), message: item.reason.slice(0, 500), raw_data: {} });
    }
    if (failedRows.length) {
      await admin
        .from("xml_run_failed_items")
        .update({ status: "superseded" })
        .eq("feed_id", feed.id)
        .eq("status", "pending");
      await admin.from("xml_run_failed_items").insert(
        failedRows.slice(0, 2000).map((row) => ({ ...row, run_id: logId, feed_id: feed.id, store_id: feed.storeId })) as never,
      );
    }

    if (newHashes && newHashes.size && !interrupted) {
      await saveProductHashes(admin, { storeId: feed.storeId, feedId: feed.id, hashes: newHashes });
    }
    if (fullSync && !interrupted) {
      await admin
        .from("xml_feeds")
        .update({ last_full_sync_at: startedAt.toISOString() })
        .eq("id", feed.id)
        .eq("store_id", feed.storeId);
    }

    if (interrupted) {
      const cursor = resumeFrom + written;
      await patchLog({
        control_state: interrupted === "paused" ? "paused" : "stopped",
        resume_cursor: cursor,
      });
      if (interrupted === "threshold") {
        const reason = `${maxErrors} hata eşiği aşıldı; besleme otomatik durduruldu`;
        await admin
          .from("xml_feeds")
          .update({ is_active: false, paused_reason: reason })
          .eq("id", feed.id)
          .eq("store_id", feed.storeId);
        await admin.rpc("emit_notification", {
          _store_id: feed.storeId,
          _kind: "system",
          _title: `XML besleme durduruldu: ${extra.name ?? "Besleme"}`,
          _message: `${reason}. Hatalı Ürünler listesini inceleyin.`,
          _entity: "system",
          _meta: {},
        } as never);
      }
    }

    const allErrors = [...mappingErrors, ...upsert.errors];

    /* Günlük tedarikçi istatistikleri (katalog boyutu, stoksuz ürün, değişim sayıları). */
    const { recordImportMetrics } = await import("@/lib/xml-analytics.server");
    const outOfStock = items.filter((item) =>
      item.variants.length
        ? item.variants.every((variant) => Number(variant.stock ?? 0) <= 0)
        : Number(item.stock ?? 0) <= 0,
    ).length;
    await recordImportMetrics(admin, {
      storeId: feed.storeId,
      feedId: feed.id,
      summary: {
        totalRecords: items.length,
        outOfStockCount: outOfStock,
        priceChangedCount: upsert.priceChanged,
        stockChangedCount: upsert.stockChanged,
        quarantineCount: upsert.quarantined,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000)),
        successRatePercent:
          parsed.totalRows > 0
            ? Math.max(0, ((parsed.totalRows - allErrors.length) / parsed.totalRows) * 100)
            : 100,
      },
    });

    return await finish(
      {
        status: "success",
        totalRows: parsed.totalRows,
        created: upsert.created,
        updated: upsert.updated,
        skipped: upsert.skipped + mappingErrors.length + unchangedCount,
        errorCount: allErrors.length,
        errorMessage: allErrors.length
          ? allErrors.slice(0, 5).map((item) => item.reason).join(" | ").slice(0, 900)
          : null,
        attempts: fetched.attempts,
        format: parsed.format,
        fields,
      },
      allErrors,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    const category: ErrorCategory =
      phase === "fetching"
        ? "FETCH_ERROR"
        : phase === "parsing"
          ? "PARSE_ERROR"
          : phase === "upserting"
            ? "UPSERT_ERROR"
            : "MAPPING_ERROR";
    await finish(
      {
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
      },
      [{ row: 0, reason: message.slice(0, 300), category }],
    );
    throw new Error(message);
  }
}

