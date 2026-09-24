import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  cleanOptions,
  matchesCollection,
  matchesSegmentQuery,
  parseCollectionRules,
  parseSegmentQuery,
  toGrams,
} from "@/lib/commerce-v2";
import { slugify } from "@/lib/mefti";

/**
 * Ürün/koleksiyon/müşteri v2 servis katmanı.
 * Hem API anahtarlı uçlar (service role + store_id filtresi) hem de panel
 * sunucu fonksiyonları (RLS'li kullanıcı istemcisi) aynı fonksiyonları kullanır.
 * Her sorgu açıkça `store_id` ile sınırlandırılır.
 */

type Db = SupabaseClient;

// ---------- Önbellek (liste 2 dk, detay 5 dk; yazımda mağaza bazında temizlenir) ----------
const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
export const LIST_TTL = 120_000;
export const DETAIL_TTL = 300_000;

export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), ttl, value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}
export function invalidateStore(storeId: string) {
  for (const k of cache.keys()) if (k.includes(storeId)) cache.delete(k);
}

// ---------- Şemalar ----------
const money = z.number().min(0).max(10_000_000);

export const variantSchema = z.object({
  id: z.guid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().max(120).nullish(),
  barcode: z.string().trim().max(120).nullish(),
  price: money.optional(),
  compare_at_price: money.nullish(),
  cost_price: money.nullish(),
  stock: z.number().int().min(0).max(10_000_000).optional(),
  inventory_policy: z.enum(["deny", "continue"]).optional(),
  weight: z.number().min(0).max(1_000_000).nullish(),
  weight_unit: z.enum(["kg", "g", "lb"]).optional(),
  option1: z.string().trim().max(120).nullish(),
  option2: z.string().trim().max(120).nullish(),
  option3: z.string().trim().max(120).nullish(),
  is_default: z.boolean().optional(),
  position: z.number().int().min(0).max(1000).optional(),
});

export const productSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(100_000).nullish(),
  handle: z.string().trim().max(200).optional(),
  vendor: z.string().trim().max(160).nullish(),
  product_type: z.string().trim().max(160).nullish(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  seo_title: z.string().trim().max(120).nullish(),
  seo_description: z.string().trim().max(320).nullish(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  price: money.default(0),
  compare_at_price: money.nullish(),
  cost_price: money.nullish(),
  options: z.array(z.object({ name: z.string().max(60), values: z.array(z.string().max(120)).max(100) })).max(3).default([]),
  variants: z.array(variantSchema).max(250).optional(),
  collection_ids: z.array(z.guid()).max(100).optional(),
  media_order: z.array(z.guid()).max(100).optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

async function uniqueHandle(db: Db, storeId: string, wanted: string, selfId?: string) {
  const base = slugify(wanted) || "urun";
  let slug = base;
  for (let i = 0; i < 8; i += 1) {
    const { data } = await db.from("products").select("id").eq("store_id", storeId).eq("slug", slug).maybeSingle();
    if (!data || data.id === selfId) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function variantRow(storeId: string, productId: string, v: z.infer<typeof variantSchema>, options: { name: string }[], i: number) {
  const opts: Record<string, string> = {};
  [v.option1, v.option2, v.option3].forEach((val, idx) => {
    const name = options[idx]?.name;
    if (name && val) opts[name] = val;
  });
  const unit = v.weight_unit ?? "g";
  return {
    store_id: storeId,
    product_id: productId,
    title: v.title ?? ([v.option1, v.option2, v.option3].filter(Boolean).join(" / ") || "Varsayılan"),
    sku: v.sku || null,
    barcode: v.barcode || null,
    price: v.price ?? 0,
    compare_at_price: v.compare_at_price ?? null,
    cost_price: v.cost_price ?? null,
    stock: v.stock ?? 0,
    inventory_policy: v.inventory_policy ?? "deny",
    weight_unit: unit,
    weight_grams: toGrams(v.weight ?? null, unit),
    option1: v.option1 ?? null,
    option2: v.option2 ?? null,
    option3: v.option3 ?? null,
    options: opts,
    is_default: v.is_default ?? i === 0,
    position: v.position ?? i,
  };
}

// ---------- Ürünler ----------
export const PRODUCT_LIST_SELECT =
  "id, title, slug, status, vendor, product_type, tags, base_price, compare_at_price, published_at, created_at, updated_at, product_variants(id, stock, price), product_images(url, storage_path, position)";

export const productListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["draft", "active", "archived"]).optional(),
  product_type: z.string().max(160).optional(),
  vendor: z.string().max(160).optional(),
  tag: z.string().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(["title", "price", "created_at", "updated_at"]).default("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export async function listProducts(db: Db, storeId: string, f: z.infer<typeof productListQuery>) {
  let q = db
    .from("products")
    .select(PRODUCT_LIST_SELECT, { count: "exact" })
    .eq("store_id", storeId)
    .order(f.sort === "price" ? "base_price" : f.sort, { ascending: f.dir === "asc" })
    .range(f.offset, f.offset + f.limit - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.product_type) q = q.eq("product_type", f.product_type);
  if (f.vendor) q = q.eq("vendor", f.vendor);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[%,()]/g, "")}%,sku.ilike.%${f.q.replace(/[%,()]/g, "")}%`);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((p) => {
    const vars = (p.product_variants ?? []) as { stock: number; price: number }[];
    return { ...p, inventory_total: vars.reduce((s, v) => s + Number(v.stock ?? 0), 0), variants_count: vars.length };
  });
  return { data: rows, meta: { limit: f.limit, offset: f.offset, total: count ?? 0 } };
}

export async function getProduct(db: Db, storeId: string, id: string) {
  const { data, error } = await db
    .from("products")
    .select("*, product_variants(*), product_images(*), product_collections(collection_id, position)")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const variants = [...((data.product_variants ?? []) as { position: number }[])].sort((a, b) => a.position - b.position);
  const media = [...((data.product_images ?? []) as { position: number }[])].sort((a, b) => a.position - b.position);
  return { ...data, handle: data.slug, options: data.variant_options ?? [], product_variants: variants, product_images: media };
}

export async function saveProduct(db: Db, storeId: string, input: ProductInput, productId?: string) {
  const options = cleanOptions(input.options);
  const handle = await uniqueHandle(db, storeId, input.handle || input.title, productId);
  let publishedAt: string | null | undefined;
  if (input.status === "active") {
    if (productId) {
      const { data: prev } = await db.from("products").select("published_at").eq("id", productId).eq("store_id", storeId).maybeSingle();
      publishedAt = prev?.published_at ?? new Date().toISOString();
    } else publishedAt = new Date().toISOString();
  }
  const row = {
    store_id: storeId,
    title: input.title,
    description: input.description ?? null,
    slug: handle,
    vendor: input.vendor || null,
    product_type: input.product_type || null,
    status: input.status,
    seo_title: input.seo_title || null,
    seo_description: input.seo_description || null,
    // Geri uyumluluk: vitrin mevcut `seo` JSON'unu okur.
    seo: { title: input.seo_title || null, description: input.seo_description || null },
    tags: [...new Set(input.tags)],
    base_price: input.price,
    compare_at_price: input.compare_at_price ?? null,
    cost_price: input.cost_price ?? null,
    variant_options: options,
    ...(publishedAt !== undefined ? { published_at: publishedAt } : {}),
  };

  let id = productId;
  if (id) {
    const { data, error } = await db.from("products").update(row).eq("id", id).eq("store_id", storeId).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("not_found");
  } else {
    const { data, error } = await db.from("products").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id as string;
  }

  if (input.variants) {
    const variants = input.variants.length ? input.variants : [{ title: "Varsayılan", price: input.price, compare_at_price: input.compare_at_price, cost_price: input.cost_price }];
    const { data: existing } = await db.from("product_variants").select("id").eq("product_id", id).eq("store_id", storeId);
    const keep = new Set(variants.map((v) => v.id).filter(Boolean));
    const remove = (existing ?? []).map((v) => v.id as string).filter((vid) => !keep.has(vid));
    if (remove.length) {
      const { error } = await db.from("product_variants").delete().in("id", remove).eq("store_id", storeId);
      if (error) throw new Error(`Varyant silinemedi (siparişte kullanılıyor olabilir): ${error.message}`);
    }
    for (const [i, v] of variants.entries()) {
      const r = variantRow(storeId, id, v, options, i);
      const res = v.id
        ? await db.from("product_variants").update(r).eq("id", v.id).eq("store_id", storeId)
        : await db.from("product_variants").insert(r);
      if (res.error) throw new Error(res.error.message);
    }
  }

  if (input.collection_ids) {
    const { data: owned } = await db.from("collections").select("id").eq("store_id", storeId).in("id", input.collection_ids.length ? input.collection_ids : ["00000000-0000-0000-0000-000000000000"]);
    const ids = (owned ?? []).map((c) => c.id as string);
    await db.from("product_collections").delete().eq("product_id", id);
    if (ids.length) {
      const { error } = await db.from("product_collections").insert(ids.map((cid) => ({ product_id: id, collection_id: cid })));
      if (error) throw new Error(error.message);
    }
  }

  if (input.media_order) {
    for (const [i, mid] of input.media_order.entries()) {
      await db.from("product_images").update({ position: i }).eq("id", mid).eq("product_id", id).eq("store_id", storeId);
    }
  }

  invalidateStore(storeId);
  return { id: id as string, handle };
}

export async function deleteProduct(db: Db, storeId: string, id: string) {
  const { data, error } = await db.from("products").delete().eq("id", id).eq("store_id", storeId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  invalidateStore(storeId);
  return Boolean(data);
}

export async function duplicateProduct(db: Db, storeId: string, id: string) {
  const src = await getProduct(db, storeId, id);
  if (!src) return null;
  const vs = src.product_variants as Record<string, unknown>[];
  const res = await saveProduct(db, storeId, {
    title: `${src.title} (Kopya)`,
    description: src.description,
    handle: `${src.slug}-kopya`,
    vendor: src.vendor,
    product_type: src.product_type,
    status: "draft",
    seo_title: src.seo_title,
    seo_description: src.seo_description,
    tags: src.tags ?? [],
    price: Number(src.base_price),
    compare_at_price: src.compare_at_price,
    cost_price: src.cost_price,
    options: (src.variant_options as { name: string; values: string[] }[]) ?? [],
    variants: vs.map((v) => ({
      title: v["title"] as string, sku: null, barcode: null, price: Number(v["price"]),
      compare_at_price: v["compare_at_price"] as number | null, cost_price: v["cost_price"] as number | null,
      stock: 0, inventory_policy: (v["inventory_policy"] as "deny") ?? "deny",
      option1: v["option1"] as string | null, option2: v["option2"] as string | null, option3: v["option3"] as string | null,
    })),
    collection_ids: (src.product_collections as { collection_id: string }[]).map((c) => c.collection_id),
  });
  return res;
}

export async function bulkProducts(db: Db, storeId: string, ids: string[], action: "publish" | "archive" | "draft" | "delete" | "add_to_collection", collectionId?: string) {
  if (!ids.length) return 0;
  if (action === "delete") {
    const { error } = await db.from("products").delete().in("id", ids).eq("store_id", storeId);
    if (error) throw new Error(error.message);
  } else if (action === "add_to_collection") {
    if (!collectionId) throw new Error("collection_required");
    const { data: col } = await db.from("collections").select("id").eq("id", collectionId).eq("store_id", storeId).maybeSingle();
    if (!col) throw new Error("not_found");
    const { data: owned } = await db.from("products").select("id").in("id", ids).eq("store_id", storeId);
    const rows = (owned ?? []).map((p) => ({ product_id: p.id, collection_id: collectionId }));
    if (rows.length) {
      const { error } = await db.from("product_collections").upsert(rows, { onConflict: "product_id,collection_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
  } else {
    const status = action === "publish" ? "active" : action === "archive" ? "archived" : "draft";
    const patch: Record<string, unknown> = { status };
    if (status === "active") patch["published_at"] = new Date().toISOString();
    const { error } = await db.from("products").update(patch).in("id", ids).eq("store_id", storeId);
    if (error) throw new Error(error.message);
  }
  invalidateStore(storeId);
  return ids.length;
}

// ---------- Varyantlar ----------
export async function listVariants(db: Db, storeId: string, productId: string) {
  const { data, error } = await db.from("product_variants").select("*").eq("product_id", productId).eq("store_id", storeId).order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function productOptions(db: Db, storeId: string, productId: string) {
  const { data } = await db.from("products").select("variant_options").eq("id", productId).eq("store_id", storeId).maybeSingle();
  if (!data) return null;
  return (data.variant_options as { name: string }[]) ?? [];
}

export async function createVariant(db: Db, storeId: string, productId: string, v: z.infer<typeof variantSchema>) {
  const opts = await productOptions(db, storeId, productId);
  if (!opts) return null;
  const { count } = await db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { data, error } = await db.from("product_variants").insert(variantRow(storeId, productId, v, opts, count ?? 0)).select("*").single();
  if (error) throw new Error(error.message);
  invalidateStore(storeId);
  return data;
}

export async function updateVariant(db: Db, storeId: string, id: string, v: z.infer<typeof variantSchema>) {
  const { data: cur } = await db.from("product_variants").select("product_id, position").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!cur) return null;
  const patch: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) if (val !== undefined && k !== "id" && k !== "weight") patch[k] = val;
  if (v.weight !== undefined) patch["weight_grams"] = toGrams(v.weight ?? null, v.weight_unit ?? "g");
  const { data, error } = await db.from("product_variants").update(patch).eq("id", id).eq("store_id", storeId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  invalidateStore(storeId);
  return data;
}

export async function deleteVariant(db: Db, storeId: string, id: string) {
  const { data, error } = await db.from("product_variants").delete().eq("id", id).eq("store_id", storeId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  invalidateStore(storeId);
  return Boolean(data);
}

// ---------- Koleksiyonlar ----------
export const collectionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).nullish(),
  handle: z.string().trim().max(200).optional(),
  collection_type: z.enum(["manual", "smart"]).default("manual"),
  rules: z.unknown().optional(),
  sort_order: z.number().int().min(0).max(10_000).default(0),
  image_url: z.string().url().max(1000).nullish(),
  seo_title: z.string().trim().max(120).nullish(),
  seo_description: z.string().trim().max(320).nullish(),
  published: z.boolean().default(true),
});

export async function listCollections(db: Db, storeId: string) {
  const { data, error } = await db
    .from("collections")
    .select("id, title, slug, description, collection_type, rules, sort_order, image_url, published_at, seo, created_at, product_collections(product_id)")
    .eq("store_id", storeId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ ...c, handle: c.slug, products_count: (c.product_collections ?? []).length }));
}

async function uniqueCollectionHandle(db: Db, storeId: string, wanted: string, selfId?: string) {
  const base = slugify(wanted) || "koleksiyon";
  let slug = base;
  for (let i = 0; i < 8; i += 1) {
    const { data } = await db.from("collections").select("id").eq("store_id", storeId).eq("slug", slug).maybeSingle();
    if (!data || data.id === selfId) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function saveCollection(db: Db, storeId: string, input: z.infer<typeof collectionSchema>, id?: string) {
  const rules = parseCollectionRules(input.rules);
  const row = {
    store_id: storeId,
    title: input.title,
    description: input.description ?? null,
    slug: await uniqueCollectionHandle(db, storeId, input.handle || input.title, id),
    collection_type: input.collection_type,
    rules,
    sort_order: input.sort_order,
    image_url: input.image_url ?? null,
    seo: { title: input.seo_title || null, description: input.seo_description || null },
    published_at: input.published ? new Date().toISOString() : null,
  };
  const res = id
    ? await db.from("collections").update(row).eq("id", id).eq("store_id", storeId).select("*").maybeSingle()
    : await db.from("collections").insert(row).select("*").single();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return null;
  if (input.collection_type === "smart") await syncSmartCollection(db, storeId, res.data.id as string);
  invalidateStore(storeId);
  return res.data;
}

/** Akıllı koleksiyon üyeliğini kurallara göre yeniden hesaplar. */
export async function syncSmartCollection(db: Db, storeId: string, collectionId: string) {
  const { data: col } = await db.from("collections").select("rules").eq("id", collectionId).eq("store_id", storeId).maybeSingle();
  if (!col) return 0;
  const rules = parseCollectionRules(col.rules);
  const { data: products, error } = await db
    .from("products")
    .select("id, title, tags, base_price, product_type, vendor, product_variants(stock)")
    .eq("store_id", storeId)
    .limit(5000);
  if (error) throw new Error(error.message);
  const ids = (products ?? [])
    .filter((p) => matchesCollection({
      title: p.title, tags: p.tags, base_price: Number(p.base_price), product_type: p.product_type, vendor: p.vendor,
      stock: ((p.product_variants ?? []) as { stock: number }[]).reduce((s, v) => s + Number(v.stock ?? 0), 0),
    }, rules))
    .map((p) => p.id as string);
  await db.from("product_collections").delete().eq("collection_id", collectionId);
  if (ids.length) {
    const { error: e } = await db.from("product_collections").insert(ids.map((pid, i) => ({ product_id: pid, collection_id: collectionId, position: i })));
    if (e) throw new Error(e.message);
  }
  return ids.length;
}

/** Manuel koleksiyonun ürün listesini sırasıyla ayarlar. */
export async function setCollectionProducts(db: Db, storeId: string, collectionId: string, productIds: string[]) {
  const { data: col } = await db.from("collections").select("id, collection_type").eq("id", collectionId).eq("store_id", storeId).maybeSingle();
  if (!col) return null;
  if (col.collection_type === "smart") throw new Error("smart_collection_is_rule_based");
  const { data: owned } = await db.from("products").select("id").eq("store_id", storeId).in("id", productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]);
  const ok = new Set((owned ?? []).map((p) => p.id as string));
  const ordered = productIds.filter((pid) => ok.has(pid));
  await db.from("product_collections").delete().eq("collection_id", collectionId);
  if (ordered.length) {
    const { error } = await db.from("product_collections").insert(ordered.map((pid, i) => ({ product_id: pid, collection_id: collectionId, position: i })));
    if (error) throw new Error(error.message);
  }
  invalidateStore(storeId);
  return ordered.length;
}

// ---------- Müşteriler ----------
export const customerSchema = z.object({
  first_name: z.string().trim().max(100).nullish(),
  last_name: z.string().trim().max(100).nullish(),
  email: z.string().trim().email().max(200).nullish(),
  phone: z.string().trim().max(40).nullish(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  gender: z.enum(["female", "male", "other", "unspecified"]).nullish(),
  accepts_marketing: z.boolean().optional(),
  tax_exempt: z.boolean().optional(),
  note: z.string().max(5000).nullish(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const addressSchema = z.object({
  first_name: z.string().trim().max(100).nullish(),
  last_name: z.string().trim().max(100).nullish(),
  company: z.string().trim().max(160).nullish(),
  address1: z.string().trim().min(1).max(300),
  address2: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(100).nullish(),
  province: z.string().trim().max(100).nullish(),
  country: z.string().trim().max(2).default("TR"),
  zip: z.string().trim().max(20).nullish(),
  phone: z.string().trim().max(40).nullish(),
  is_default: z.boolean().default(false),
});

export const CUSTOMER_SELECT =
  "id, first_name, last_name, full_name, email, phone, date_of_birth, gender, accepts_marketing, verified_email, tax_exempt, notes, tags, total_spent, orders_count, last_activity_at, created_at, updated_at";

function customerRow(input: z.infer<typeof customerSchema>) {
  const row: Record<string, unknown> = {};
  if (input.first_name !== undefined) row["first_name"] = input.first_name || null;
  if (input.last_name !== undefined) row["last_name"] = input.last_name || null;
  if (input.first_name !== undefined || input.last_name !== undefined)
    row["full_name"] = [input.first_name, input.last_name].filter(Boolean).join(" ") || input.email || "Müşteri";
  if (input.email !== undefined) row["email"] = input.email ? input.email.toLowerCase() : null;
  if (input.phone !== undefined) row["phone"] = input.phone || null;
  if (input.birthdate !== undefined) row["date_of_birth"] = input.birthdate || null;
  if (input.gender !== undefined) row["gender"] = input.gender || null;
  if (input.accepts_marketing !== undefined) row["accepts_marketing"] = input.accepts_marketing;
  if (input.tax_exempt !== undefined) row["tax_exempt"] = input.tax_exempt;
  if (input.note !== undefined) row["notes"] = input.note || null;
  if (input.tags !== undefined) row["tags"] = [...new Set(input.tags)];
  return row;
}

export const customerListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(120).optional(),
  tag: z.string().max(60).optional(),
  accepts_marketing: z.enum(["true", "false"]).optional(),
  city: z.string().max(100).optional(),
});

export async function listCustomers(db: Db, storeId: string, f: z.infer<typeof customerListQuery>) {
  let ids: string[] | null = null;
  if (f.city) {
    const { data } = await db.from("customer_addresses").select("customer_id").eq("store_id", storeId).ilike("city", f.city).limit(5000);
    ids = [...new Set((data ?? []).map((a) => a.customer_id as string))];
    if (!ids.length) return { data: [], meta: { limit: f.limit, offset: f.offset, total: 0 } };
  }
  let q = db.from("customers").select(CUSTOMER_SELECT, { count: "exact" }).eq("store_id", storeId)
    .order("created_at", { ascending: false }).range(f.offset, f.offset + f.limit - 1);
  if (ids) q = q.in("id", ids.slice(0, 1000));
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.accepts_marketing) q = q.eq("accepts_marketing", f.accepts_marketing === "true");
  if (f.q) {
    const s = f.q.replace(/[%,()]/g, "");
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  }
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { data: data ?? [], meta: { limit: f.limit, offset: f.offset, total: count ?? 0 } };
}

export async function getCustomer(db: Db, storeId: string, id: string) {
  const { data, error } = await db.from("customers").select(CUSTOMER_SELECT).eq("id", id).eq("store_id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCustomer(db: Db, storeId: string, input: z.infer<typeof customerSchema>) {
  const row: Record<string, unknown> = { ...customerRow(input), store_id: storeId };
  if (!row["full_name"]) row["full_name"] = input.email || input.phone || "Müşteri";
  const { data, error } = await db.from("customers").insert(row).select(CUSTOMER_SELECT).single();
  if (error) throw new Error(error.code === "23505" ? "Bu e-posta ile kayıtlı müşteri zaten var." : error.message);
  invalidateStore(storeId);
  return data;
}

export async function updateCustomer(db: Db, storeId: string, id: string, input: z.infer<typeof customerSchema>) {
  const { data, error } = await db.from("customers").update(customerRow(input)).eq("id", id).eq("store_id", storeId).select(CUSTOMER_SELECT).maybeSingle();
  if (error) throw new Error(error.code === "23505" ? "Bu e-posta ile kayıtlı müşteri zaten var." : error.message);
  invalidateStore(storeId);
  return data;
}

export async function deleteCustomer(db: Db, storeId: string, id: string) {
  const { data, error } = await db.from("customers").delete().eq("id", id).eq("store_id", storeId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  invalidateStore(storeId);
  return Boolean(data);
}

function addressOut(a: Record<string, unknown>) {
  return {
    id: a["id"], customer_id: a["customer_id"], first_name: a["first_name"], last_name: a["last_name"], company: a["company"],
    address1: a["line1"], address2: a["line2"], city: a["city"], province: a["province"] ?? a["district"], country: a["country"],
    zip: a["postal_code"], phone: a["phone"], is_default: a["is_default"],
  };
}

async function ownsCustomer(db: Db, storeId: string, customerId: string) {
  const { data } = await db.from("customers").select("id").eq("id", customerId).eq("store_id", storeId).maybeSingle();
  return Boolean(data);
}

export async function listAddresses(db: Db, storeId: string, customerId: string) {
  const { data, error } = await db.from("customer_addresses").select("*").eq("customer_id", customerId).eq("store_id", storeId).order("is_default", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(addressOut);
}

export async function saveAddress(db: Db, storeId: string, customerId: string, input: z.infer<typeof addressSchema>, addressId?: string) {
  if (!(await ownsCustomer(db, storeId, customerId))) return null;
  const row = {
    store_id: storeId, customer_id: customerId,
    first_name: input.first_name || null, last_name: input.last_name || null, company: input.company || null,
    recipient: [input.first_name, input.last_name].filter(Boolean).join(" ") || input.company || "Alıcı",
    line1: input.address1, line2: input.address2 || null, city: input.city || null, province: input.province || null,
    district: input.province || null, country: input.country, postal_code: input.zip || null, phone: input.phone || null,
    is_default: input.is_default,
  };
  if (input.is_default) await db.from("customer_addresses").update({ is_default: false }).eq("customer_id", customerId).eq("store_id", storeId);
  const res = addressId
    ? await db.from("customer_addresses").update(row).eq("id", addressId).eq("customer_id", customerId).eq("store_id", storeId).select("*").maybeSingle()
    : await db.from("customer_addresses").insert(row).select("*").single();
  if (res.error) throw new Error(res.error.message);
  invalidateStore(storeId);
  return res.data ? addressOut(res.data) : null;
}

export async function deleteAddress(db: Db, storeId: string, customerId: string, addressId: string) {
  const { data, error } = await db.from("customer_addresses").delete().eq("id", addressId).eq("customer_id", customerId).eq("store_id", storeId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function customerOrders(db: Db, storeId: string, customerId: string, limit = 50) {
  const { data, error } = await db
    .from("orders")
    .select("id, order_number, status, payment_status, fulfillment_status, grand_total, currency, placed_at, created_at")
    .eq("store_id", storeId).eq("customer_id", customerId)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listNotes(db: Db, storeId: string, customerId: string) {
  const { data, error } = await db.from("customer_notes").select("id, customer_id, admin_user_id, note, created_at")
    .eq("customer_id", customerId).eq("store_id", storeId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addNote(db: Db, storeId: string, customerId: string, note: string, adminUserId: string | null) {
  if (!(await ownsCustomer(db, storeId, customerId))) return null;
  const { data, error } = await db.from("customer_notes").insert({ store_id: storeId, customer_id: customerId, note, admin_user_id: adminUserId })
    .select("id, customer_id, admin_user_id, note, created_at").single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Segmentler ----------
export const segmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).nullish(),
  query: z.unknown(),
});

/** Müşterileri kurallara göre değerlendirir (şehirler adreslerden, son sipariş siparişlerden). */
export async function evaluateSegment(db: Db, storeId: string, rawQuery: unknown) {
  const query = parseSegmentQuery(rawQuery);
  const [{ data: customers, error }, { data: addresses }, { data: orders }] = await Promise.all([
    db.from("customers").select(CUSTOMER_SELECT).eq("store_id", storeId).limit(5000),
    db.from("customer_addresses").select("customer_id, city").eq("store_id", storeId).limit(10000),
    db.from("orders").select("customer_id, created_at, placed_at").eq("store_id", storeId).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(10000),
  ]);
  if (error) throw new Error(error.message);
  const cities = new Map<string, string[]>();
  for (const a of addresses ?? []) if (a.city) cities.set(a.customer_id as string, [...(cities.get(a.customer_id as string) ?? []), a.city as string]);
  const last = new Map<string, string>();
  for (const o of orders ?? []) if (!last.has(o.customer_id as string)) last.set(o.customer_id as string, (o.placed_at ?? o.created_at) as string);
  return (customers ?? []).filter((c) => matchesSegmentQuery({
    total_spent: Number(c.total_spent), orders_count: Number(c.orders_count), cities: cities.get(c.id) ?? [],
    tags: c.tags, last_order_at: last.get(c.id) ?? null, accepts_marketing: Boolean(c.accepts_marketing),
  }, query));
}

export async function listSegments(db: Db, storeId: string) {
  const { data, error } = await db.from("customer_segments")
    .select("id, name, slug, description, query, customer_count, created_at, updated_at")
    .eq("store_id", storeId).not("query", "is", null).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveSegment(db: Db, storeId: string, input: z.infer<typeof segmentSchema>, id?: string) {
  const query = parseSegmentQuery(input.query);
  const members = await evaluateSegment(db, storeId, query);
  let slug = slugify(input.name) || "segment";
  if (!id) {
    const { data: taken } = await db.from("customer_segments").select("id").eq("store_id", storeId).eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
  }
  const row = { store_id: storeId, name: input.name, description: input.description ?? null, query, customer_count: members.length, ...(id ? {} : { slug }) };
  const res = id
    ? await db.from("customer_segments").update(row).eq("id", id).eq("store_id", storeId).select("id, name, slug, description, query, customer_count").maybeSingle()
    : await db.from("customer_segments").insert(row).select("id, name, slug, description, query, customer_count").single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function segmentCustomers(db: Db, storeId: string, id: string) {
  const { data: seg } = await db.from("customer_segments").select("id, query").eq("id", id).eq("store_id", storeId).maybeSingle();
  if (!seg) return null;
  const members = await evaluateSegment(db, storeId, seg.query);
  await db.from("customer_segments").update({ customer_count: members.length }).eq("id", id).eq("store_id", storeId);
  return members;
}
