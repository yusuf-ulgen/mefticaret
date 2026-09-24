import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Panel için Ürün/Koleksiyon/Müşteri v2 sunucu fonksiyonları.
 * Kullanıcının RLS'li istemcisi kullanılır; ek olarak mağaza yöneticiliği ve
 * paket modülü (varsayılan kapalı) sunucuda doğrulanır.
 */

type Mod = "module_v2_products" | "module_v2_collections" | "module_v2_customers";

async function guard(supabase: unknown, storeId: string, userId: string, mod: Mod) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
  const { requirePlanModule } = await import("@/lib/entitlements.server");
  await requirePlanModule(supabase as never, storeId, mod);
  return supabase as SupabaseClient;
}

const store = z.object({ storeId: z.guid() });

// ---------- Ürünler ----------
export const v2ListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ filters: z.record(z.string(), z.unknown()).default({}) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_products");
    const svc = await import("@/lib/commerce-v2.server");
    const res = await svc.listProducts(db, data.storeId, svc.productListQuery.parse(data.filters));
    const [{ data: meta }] = await Promise.all([
      db.from("products").select("vendor, product_type, tags").eq("store_id", data.storeId).limit(2000),
    ]);
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "tr"));
    return {
      ...res,
      facets: {
        vendors: uniq((meta ?? []).map((m) => m.vendor)),
        types: uniq((meta ?? []).map((m) => m.product_type)),
        tags: uniq((meta ?? []).flatMap((m) => m.tags ?? [])),
      },
    } as never as { data: Record<string, any>[]; meta: { total: number }; facets: { vendors: string[]; types: string[]; tags: string[] } };
  });

export const v2GetProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ productId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_products");
    const { getProduct } = await import("@/lib/commerce-v2.server");
    return (await getProduct(db, data.storeId, data.productId)) as never as Record<string, any> | null;
  });

export const v2SaveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ productId: z.guid().optional(), product: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_products");
    const svc = await import("@/lib/commerce-v2.server");
    const input = svc.productSchema.parse(data.product);
    const res = await svc.saveProduct(db, data.storeId, input, data.productId);
    const { insertAuditRow } = await import("@/lib/audit.server");
    await insertAuditRow(db as never, {
      store_id: data.storeId, actor_id: context.userId,
      action: data.productId ? "product_v2.updated" : "product_v2.created",
      entity: "products", entity_id: res.id,
    });
    return res;
  });

export const v2BulkProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    store.extend({
      ids: z.array(z.guid()).min(1).max(500),
      action: z.enum(["publish", "archive", "draft", "delete", "add_to_collection"]),
      collectionId: z.guid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_products");
    const { bulkProducts } = await import("@/lib/commerce-v2.server");
    return { count: await bulkProducts(db, data.storeId, data.ids, data.action, data.collectionId) };
  });

export const v2DuplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ productId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_products");
    const { duplicateProduct } = await import("@/lib/commerce-v2.server");
    const res = await duplicateProduct(db, data.storeId, data.productId);
    if (!res) throw new Error("Ürün bulunamadı");
    return res;
  });

// ---------- Koleksiyonlar ----------
export const v2ListCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ module: z.enum(["products", "collections"]).default("collections") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, data.module === "products" ? "module_v2_products" : "module_v2_collections");
    const { listCollections } = await import("@/lib/commerce-v2.server");
    return (await listCollections(db, data.storeId)) as never as Record<string, any>[];
  });

export const v2CollectionProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ collectionId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_collections");
    const { data: rows, error } = await db
      .from("product_collections")
      .select("position, products!inner(id, title, status, base_price, store_id)")
      .eq("collection_id", data.collectionId)
      .eq("products.store_id", data.storeId)
      .order("position");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.products) as never as { id: string; title: string; status: string; base_price: number }[];
  });

export const v2SaveCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ collectionId: z.guid().optional(), collection: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_collections");
    const svc = await import("@/lib/commerce-v2.server");
    const row = await svc.saveCollection(db, data.storeId, svc.collectionSchema.parse(data.collection), data.collectionId);
    if (!row) throw new Error("Koleksiyon bulunamadı");
    return { id: row.id as string };
  });

export const v2SetCollectionProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ collectionId: z.guid(), productIds: z.array(z.guid()).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_collections");
    const { setCollectionProducts } = await import("@/lib/commerce-v2.server");
    return { count: await setCollectionProducts(db, data.storeId, data.collectionId, data.productIds) };
  });

export const v2DeleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ collectionId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_collections");
    const { error } = await db.from("collections").delete().eq("id", data.collectionId).eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Müşteriler ----------
export const v2ListCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ filters: z.record(z.string(), z.unknown()).default({}) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const svc = await import("@/lib/commerce-v2.server");
    const res = await svc.listCustomers(db, data.storeId, svc.customerListQuery.parse(data.filters));
    const { data: addr } = await db.from("customer_addresses").select("customer_id, city, is_default").eq("store_id", data.storeId).limit(10000);
    const cityOf = new Map<string, string>();
    for (const a of addr ?? []) if (a.city && (a.is_default || !cityOf.has(a.customer_id as string))) cityOf.set(a.customer_id as string, a.city as string);
    const cities = [...new Set((addr ?? []).map((a) => a.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "tr"));
    return {
      data: res.data.map((c) => ({ ...c, city: cityOf.get(c.id as string) ?? null })),
      meta: res.meta,
      cities,
    } as never as { data: Record<string, any>[]; meta: { total: number }; cities: string[] };
  });

export const v2CustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ customerId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const svc = await import("@/lib/commerce-v2.server");
    const customer = await svc.getCustomer(db, data.storeId, data.customerId);
    if (!customer) return null;
    const [addresses, orders, notes] = await Promise.all([
      svc.listAddresses(db, data.storeId, data.customerId),
      svc.customerOrders(db, data.storeId, data.customerId, 10),
      svc.listNotes(db, data.storeId, data.customerId),
    ]);
    return { customer, addresses, orders, notes } as never as {
      customer: Record<string, any>; addresses: Record<string, any>[]; orders: Record<string, any>[]; notes: Record<string, any>[];
    };
  });

export const v2SaveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ customerId: z.guid().optional(), customer: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const svc = await import("@/lib/commerce-v2.server");
    const input = svc.customerSchema.parse(data.customer);
    const row = data.customerId
      ? await svc.updateCustomer(db, data.storeId, data.customerId, input)
      : await svc.createCustomer(db, data.storeId, input);
    if (!row) throw new Error("Müşteri bulunamadı");
    return { id: row.id as string };
  });

export const v2SaveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ customerId: z.guid(), addressId: z.guid().optional(), address: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const svc = await import("@/lib/commerce-v2.server");
    const a = await svc.saveAddress(db, data.storeId, data.customerId, svc.addressSchema.parse(data.address), data.addressId);
    if (!a) throw new Error("Müşteri bulunamadı");
    return { ok: true };
  });

export const v2DeleteAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ customerId: z.guid(), addressId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const { deleteAddress } = await import("@/lib/commerce-v2.server");
    return { ok: await deleteAddress(db, data.storeId, data.customerId, data.addressId) };
  });

export const v2AddNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ customerId: z.guid(), note: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const { addNote } = await import("@/lib/commerce-v2.server");
    const n = await addNote(db, data.storeId, data.customerId, data.note, context.userId);
    if (!n) throw new Error("Müşteri bulunamadı");
    return { ok: true };
  });

export const v2BulkTagCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    store.extend({ ids: z.array(z.guid()).min(1).max(1000), tag: z.string().trim().min(1).max(60), onlyMarketing: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    let q = db.from("customers").select("id, tags").eq("store_id", data.storeId).in("id", data.ids);
    if (data.onlyMarketing) q = q.eq("accepts_marketing", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let n = 0;
    for (const r of rows ?? []) {
      const tags = (r.tags ?? []) as string[];
      if (tags.includes(data.tag)) { n += 1; continue; }
      const { error: e } = await db.from("customers").update({ tags: [...tags, data.tag] }).eq("id", r.id).eq("store_id", data.storeId);
      if (!e) n += 1;
    }
    return { count: n };
  });

// ---------- Segmentler ----------
export const v2ListSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const { listSegments } = await import("@/lib/commerce-v2.server");
    return (await listSegments(db, data.storeId)) as never as Record<string, any>[];
  });

export const v2PreviewSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ query: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const { evaluateSegment } = await import("@/lib/commerce-v2.server");
    const members = await evaluateSegment(db, data.storeId, data.query);
    return {
      count: members.length,
      sample: members.slice(0, 50).map((m) => ({ id: m.id, full_name: m.full_name, email: m.email, orders_count: m.orders_count, total_spent: Number(m.total_spent) })),
    };
  });

export const v2SaveSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ segmentId: z.guid().optional(), segment: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const svc = await import("@/lib/commerce-v2.server");
    const row = await svc.saveSegment(db, data.storeId, svc.segmentSchema.parse(data.segment), data.segmentId);
    return { id: row?.id as string, count: row?.customer_count as number };
  });

export const v2DeleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => store.extend({ segmentId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId, "module_v2_customers");
    const { error } = await db.from("customer_segments").delete().eq("id", data.segmentId).eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
