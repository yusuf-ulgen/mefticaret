/**
 * Mağaza Taşıma motoru (yalnızca sunucu).
 *
 * Sağlayıcı modülleri saf payload/normalize sağlar; gerçek HTTP çağrıları,
 * kimlik bilgisi okuma, sayfalama, dry-run önizleme ve idempotent yazma
 * burada yapılır. Kimlik bilgileri `migration_credentials` tablosunda yalnızca
 * servis rolüyle okunur ve asla istemciye dönmez.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { requireMigrationProvider } from "@/lib/migration";
import {
  ENTITY_ORDER,
  slugify,
  type MigrationEntity,
  type MigrationProviderModule,
  type MigrationRequestSpec,
  type NormalizedCategory,
  type NormalizedContent,
  type NormalizedCustomer,
  type NormalizedOrder,
  type NormalizedProduct,
  type NormalizedRecord,
} from "@/lib/migration/types";

type Db = SupabaseClient<Database>;

const MAX_PAGES = 40;
const PREVIEW_SAMPLE = 5;

export interface MigrationSourceRow {
  id: string;
  store_id: string;
  provider: string;
  shop_domain: string | null;
  scope: unknown;
  options: unknown;
}

export interface MigrationTotals {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export type MigrationEntityTotals = Partial<Record<MigrationEntity, MigrationTotals>>;

export interface MigrationRunReport {
  jobId: string | null;
  mode: "preview" | "run";
  provider: string;
  dryRun: boolean;
  totals: MigrationEntityTotals;
  sample: Partial<Record<MigrationEntity, Json[]>>;
  errors: string[];
}

const emptyTotals = (): MigrationTotals => ({ created: 0, updated: 0, skipped: 0, failed: 0 });

async function loadCredentials(admin: Db, sourceId: string): Promise<Record<string, string>> {
  const { data, error } = await admin
    .from("migration_credentials")
    .select("credentials")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data?.credentials ?? {}) as Record<string, unknown>;
  const credentials: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.length > 0) credentials[key] = value;
  }
  return credentials;
}

async function request(
  provider: MigrationProviderModule,
  baseUrl: string,
  credentials: Record<string, string>,
  spec: MigrationRequestSpec,
): Promise<{ body: unknown; headers: Headers }> {
  const target = spec.path.startsWith("http")
    ? spec.path
    : baseUrl.replace(/\/$/, "") + (spec.path.startsWith("/") || spec.path === "" ? spec.path : `/${spec.path}`);
  const url = new URL(target);
  for (const [key, value] of Object.entries(spec.query ?? {})) url.searchParams.set(key, value);

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: spec.method,
        headers: {
          Accept: "application/json",
          ...provider.authHeaders(credentials),
          ...(spec.headers ?? {}),
          ...(spec.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(spec.body !== undefined ? { body: JSON.stringify(spec.body) } : {}),
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = `Kaynak sistem geçici hata verdi [${response.status}]`;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Kaynak sistem isteği başarısız [${response.status}]: ${text.slice(0, 300)}`);
      }
      const text = await response.text();
      let body: unknown = [];
      if (text.trim().length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error("Kaynak sistem JSON dışı bir yanıt döndürdü");
        }
      }
      return { body, headers: response.headers };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Bilinmeyen hata";
      if (attempt === 2) throw new Error(lastError);
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new Error(lastError || "Kaynak sisteme ulaşılamadı");
}

/** Kaynak bağlantısını doğrular (veri yazmaz). */
export async function testMigrationSource(
  admin: Db,
  source: MigrationSourceRow,
): Promise<{ ok: boolean; message: string }> {
  const provider = requireMigrationProvider(source.provider);
  const credentials = await loadCredentials(admin, source.id);
  const missing = provider.credentialFields
    .filter((field) => !field.optional && !credentials[field.key])
    .map((field) => field.label);
  if (missing.length > 0) return { ok: false, message: `Eksik kimlik bilgisi: ${missing.join(", ")}` };

  const baseUrl = provider.baseUrl({ shopDomain: source.shop_domain ?? "", credentials });
  try {
    await request(provider, baseUrl, credentials, provider.probeRequest(credentials));
    return { ok: true, message: `${provider.name} bağlantısı doğrulandı` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Bağlantı doğrulanamadı" };
  }
}

/** Sağlayıcıdan tek varlık için normalize kayıtları toplar. */
async function collect(
  provider: MigrationProviderModule,
  baseUrl: string,
  credentials: Record<string, string>,
  entity: MigrationEntity,
  maxRecords: number,
): Promise<NormalizedRecord[]> {
  const records: NormalizedRecord[] = [];
  let cursor: { page: number; cursor?: string | null } = { page: 1, cursor: null };

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const spec = provider.pageRequest(entity, cursor, credentials);
    if (!spec) break;
    const { body, headers } = await request(provider, baseUrl, credentials, spec);
    const extracted = provider.extract(entity, body, headers);
    if (extracted.rows.length === 0) break;
    for (const row of extracted.rows) {
      const normalized = provider.normalize(entity, row);
      if (normalized) records.push(normalized);
      if (records.length >= maxRecords) return records;
    }
    if (extracted.nextCursor) cursor = { page: cursor.page + 1, cursor: extracted.nextCursor };
    else if (extracted.rows.length < 20) break;
    else cursor = { page: cursor.page + 1, cursor: null };
  }
  return records;
}

/* ------------------------------------------------------------------ yazma */

type IdMap = Map<string, string>;

async function loadIdMap(admin: Db, storeId: string, entity: MigrationEntity): Promise<IdMap> {
  const map: IdMap = new Map();
  const { data, error } = await admin
    .from("migration_records")
    .select("external_id, local_id")
    .eq("store_id", storeId)
    .eq("entity", entity)
    .not("local_id", "is", null);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) if (row.local_id) map.set(row.external_id, row.local_id);
  return map;
}

async function trace(
  admin: Db,
  input: {
    storeId: string;
    jobId: string;
    sourceId: string;
    entity: MigrationEntity;
    externalId: string;
    localId: string | null;
    action: "created" | "updated" | "skipped" | "failed";
    message?: string | null;
  },
): Promise<void> {
  await admin.from("migration_records").insert({
    store_id: input.storeId,
    job_id: input.jobId,
    source_id: input.sourceId,
    entity: input.entity,
    external_id: input.externalId.slice(0, 200),
    local_id: input.localId,
    action: input.action,
    message: input.message ? input.message.slice(0, 500) : null,
  });
}

async function upsertCategory(
  admin: Db,
  storeId: string,
  data: NormalizedCategory,
  existing: string | null,
  parents: IdMap,
): Promise<string> {
  const payload = {
    store_id: storeId,
    name: data.name,
    slug: data.slug ?? slugify(data.name),
    description: data.description,
    image_url: data.imageUrl,
    parent_id: data.parentExternalId ? parents.get(data.parentExternalId) ?? null : null,
    sort_order: data.sortOrder,
    is_active: data.isActive,
    seo: { title: data.seoTitle, description: data.seoDescription },
  };
  if (existing) {
    const { error } = await admin.from("categories").update(payload).eq("id", existing).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return existing;
  }
  const { data: inserted, error } = await admin.from("categories").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

async function upsertProduct(
  admin: Db,
  storeId: string,
  data: NormalizedProduct,
  existing: string | null,
  categories: IdMap,
): Promise<string> {
  const categoryId =
    data.categoryExternalIds.map((code) => categories.get(code)).find((value): value is string => Boolean(value)) ??
    null;
  const payload = {
    store_id: storeId,
    title: data.title,
    slug: data.slug ?? slugify(data.title),
    description: data.description,
    status: data.status,
    vendor: data.vendor,
    product_type: data.productType,
    tags: data.tags,
    base_price: data.basePrice,
    compare_at_price: data.compareAtPrice,
    cost_price: data.costPrice,
    currency: data.currency ?? "TRY",
    sku: data.sku,
    barcode: data.barcode,
    weight_grams: data.weightGrams,
    tax_rate: data.taxRate ?? 0,
    category_id: categoryId,
    seo: { title: data.seoTitle, description: data.seoDescription },
  };

  let productId = existing;
  if (productId) {
    const { error } = await admin.from("products").update(payload).eq("id", productId).eq("store_id", storeId);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await admin.from("products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    productId = inserted.id;
  }

  await admin.from("product_variants").delete().eq("product_id", productId).eq("store_id", storeId);
  const variants = data.variants.length
    ? data.variants
    : [
        {
          externalId: `${data.externalId}-default`,
          title: "Varsayılan",
          sku: data.sku,
          barcode: data.barcode,
          price: data.basePrice,
          compareAtPrice: data.compareAtPrice,
          costPrice: data.costPrice,
          stock: 0,
          weightGrams: data.weightGrams,
          options: {},
        },
      ];
  const { error: variantError } = await admin.from("product_variants").insert(
    variants.map((variant, index) => ({
      store_id: storeId,
      product_id: productId,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      compare_at_price: variant.compareAtPrice,
      cost_price: variant.costPrice,
      stock: variant.stock,
      weight_grams: variant.weightGrams,
      options: variant.options,
      position: index,
    })),
  );
  if (variantError) throw new Error(variantError.message);

  await admin.from("product_images").delete().eq("product_id", productId).eq("store_id", storeId);
  if (data.images.length > 0) {
    const { error: imageError } = await admin.from("product_images").insert(
      data.images.slice(0, 20).map((image, index) => ({
        store_id: storeId,
        product_id: productId,
        url: image.url,
        alt: image.alt,
        position: index,
      })),
    );
    if (imageError) throw new Error(imageError.message);
  }

  return productId;
}

async function upsertCustomer(
  admin: Db,
  storeId: string,
  data: NormalizedCustomer,
  existing: string | null,
): Promise<string> {
  const payload = {
    store_id: storeId,
    full_name: data.fullName,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone,
    accepts_marketing: data.acceptsMarketing,
    notes: data.notes,
    tags: data.tags,
    total_spent: data.totalSpent,
    orders_count: data.ordersCount,
  };
  let customerId = existing;
  if (customerId) {
    const { error } = await admin.from("customers").update(payload).eq("id", customerId).eq("store_id", storeId);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await admin.from("customers").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    customerId = inserted.id;
  }

  if (data.addresses.length > 0) {
    await admin.from("customer_addresses").delete().eq("customer_id", customerId).eq("store_id", storeId);
    const { error } = await admin.from("customer_addresses").insert(
      data.addresses.slice(0, 10).map((address) => ({
        store_id: storeId,
        customer_id: customerId,
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        country: address.country,
        city: address.city,
        district: address.district,
        line1: address.line1,
        line2: address.line2,
        postal_code: address.postalCode,
        is_default: address.isDefault,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return customerId;
}

async function upsertOrder(
  admin: Db,
  storeId: string,
  data: NormalizedOrder,
  existing: string | null,
  customers: IdMap,
  products: IdMap,
): Promise<string> {
  const payload = {
    store_id: storeId,
    order_number: data.orderNumber || `IMP-${data.externalId}`.slice(0, 40),
    status: data.status,
    payment_status: data.paymentStatus,
    fulfillment_status: data.fulfillmentStatus,
    currency: data.currency,
    subtotal: data.subtotal,
    discount_total: data.discountTotal,
    shipping_total: data.shippingTotal,
    tax_total: data.taxTotal,
    grand_total: data.grandTotal,
    customer_id: data.customerExternalId ? customers.get(data.customerExternalId) ?? null : null,
    customer_email: data.customerEmail,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    shipping_carrier: data.shippingCarrier,
    tracking_number: data.trackingNumber,
    note: data.note,
    placed_at: data.placedAt,
  };

  let orderId = existing;
  if (orderId) {
    const { error } = await admin.from("orders").update(payload).eq("id", orderId).eq("store_id", storeId);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await admin.from("orders").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    orderId = inserted.id;
  }

  await admin.from("order_items").delete().eq("order_id", orderId).eq("store_id", storeId);
  if (data.items.length > 0) {
    const { error } = await admin.from("order_items").insert(
      data.items.map((item) => ({
        store_id: storeId,
        order_id: orderId,
        product_id: item.productExternalId ? products.get(item.productExternalId) ?? null : null,
        title: item.title,
        variant_title: item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        tax_rate: item.taxRate,
        tax_total: item.taxTotal,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return orderId;
}

async function upsertContent(
  admin: Db,
  storeId: string,
  entity: MigrationEntity,
  data: NormalizedContent,
  existing: string | null,
): Promise<string> {
  const payload = {
    store_id: storeId,
    page_kind: entity === "post" ? "blog" : "page",
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    body: data.body,
    cover_url: data.coverUrl,
    author_name: data.authorName,
    is_published: data.isPublished,
    status: data.isPublished ? "published" : "draft",
    published_at: data.publishedAt,
    seo_description: data.seoDescription,
    seo: { title: data.seoTitle, description: data.seoDescription },
  };
  if (existing) {
    const { error } = await admin.from("store_pages").update(payload).eq("id", existing).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return existing;
  }
  const { data: inserted, error } = await admin.from("store_pages").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

/* -------------------------------------------------------------- yürütücü */

export async function runMigration(
  admin: Db,
  input: {
    source: MigrationSourceRow;
    mode: "preview" | "run";
    scope: MigrationEntity[];
    jobId: string | null;
    maxRecords?: number;
  },
): Promise<MigrationRunReport> {
  const provider = requireMigrationProvider(input.source.provider);
  const credentials = await loadCredentials(admin, input.source.id);
  const baseUrl = provider.baseUrl({ shopDomain: input.source.shop_domain ?? "", credentials });
  const storeId = input.source.store_id;
  const dryRun = input.mode === "preview";
  const maxRecords = input.maxRecords ?? (dryRun ? 25 : 5000);

  const scope = ENTITY_ORDER.filter(
    (entity) => input.scope.includes(entity) && provider.entities.includes(entity),
  );

  const report: MigrationRunReport = {
    jobId: input.jobId,
    mode: input.mode,
    provider: provider.code,
    dryRun,
    totals: {},
    sample: {},
    errors: [],
  };

  const maps: Partial<Record<MigrationEntity, IdMap>> = {};
  const idMap = async (entity: MigrationEntity): Promise<IdMap> => {
    if (!maps[entity]) maps[entity] = await loadIdMap(admin, storeId, entity);
    return maps[entity]!;
  };

  for (const entity of scope) {
    const totals = emptyTotals();
    report.totals[entity] = totals;
    let records: NormalizedRecord[] = [];
    try {
      records = await collect(provider, baseUrl, credentials, entity, maxRecords);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      report.errors.push(`${entity}: ${message}`);
      totals.failed += 1;
      continue;
    }

    report.sample[entity] = records
      .slice(0, PREVIEW_SAMPLE)
      .map((record) => JSON.parse(JSON.stringify(record.data)) as Json);
    if (dryRun) {
      totals.created = records.length;
      continue;
    }

    const existingMap = await idMap(entity);
    for (const record of records) {
      const externalId = String((record.data as { externalId: string }).externalId ?? "");
      if (!externalId) {
        totals.skipped += 1;
        continue;
      }
      const existing = existingMap.get(externalId) ?? null;
      try {
        let localId: string;
        if (record.entity === "category") {
          localId = await upsertCategory(admin, storeId, record.data, existing, existingMap);
        } else if (record.entity === "product") {
          localId = await upsertProduct(admin, storeId, record.data, existing, await idMap("category"));
        } else if (record.entity === "customer") {
          localId = await upsertCustomer(admin, storeId, record.data, existing);
        } else if (record.entity === "order") {
          localId = await upsertOrder(
            admin,
            storeId,
            record.data,
            existing,
            await idMap("customer"),
            await idMap("product"),
          );
        } else {
          localId = await upsertContent(admin, storeId, record.entity, record.data, existing);
        }
        existingMap.set(externalId, localId);
        if (existing) totals.updated += 1;
        else totals.created += 1;
        if (input.jobId) {
          await trace(admin, {
            storeId,
            jobId: input.jobId,
            sourceId: input.source.id,
            entity,
            externalId,
            localId,
            action: existing ? "updated" : "created",
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen hata";
        totals.failed += 1;
        report.errors.push(`${entity}/${externalId}: ${message}`);
        if (input.jobId) {
          await trace(admin, {
            storeId,
            jobId: input.jobId,
            sourceId: input.source.id,
            entity,
            externalId,
            localId: null,
            action: "failed",
            message,
          });
        }
      }
    }
  }

  return report;
}
