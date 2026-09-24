import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import * as svc from "@/lib/commerce-v2.server";

/**
 * /api/v2 ürün, varyant, koleksiyon, müşteri ve segment uçları.
 * Modül (plan özelliği) kapalıysa `null` döner ve istek mevcut genel v2 davranışına düşer;
 * böylece anahtar açılana kadar hiçbir entegrasyon kırılmaz.
 */

export const COMMERCE_V2_RESOURCES = new Set(["products", "variants", "collections", "customers", "segments"]);

const MODULE_FOR: Record<string, string> = {
  products: "module_v2_products",
  variants: "module_v2_products",
  collections: "module_v2_collections",
  customers: "module_v2_customers",
  segments: "module_v2_customers",
};

type Out = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Out => ({ status, body });
const err = (error: string, status: number, extra?: Record<string, unknown>): Out => ({ status, body: { error, ...extra } });
const guid = z.guid();
const OUT = Symbol("out");

export async function isCommerceModuleEnabled(admin: SupabaseClient, storeId: string, resource: string) {
  const { loadEntitlements } = await import("@/lib/entitlements.server");
  const ent = await loadEntitlements(admin, storeId);
  return ent.modules[MODULE_FOR[resource] ?? ""] === true;
}

export function requiredScope(resource: string, writing: boolean) {
  const base = resource === "customers" || resource === "segments" ? "customers" : "products";
  return `${writing ? "write" : "read"}_${base}`;
}

async function body<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | Out> {
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return Object.assign(err("validation_failed", 422, { issues: parsed.error.issues.slice(0, 20) }), { [OUT]: true });
  return parsed.data;
}
const isOut = (v: unknown): v is Out => !!v && typeof v === "object" && OUT in v;

export async function handleCommerceV2(
  admin: SupabaseClient,
  storeId: string,
  method: string,
  segments: string[],
  url: URL,
  request: Request,
): Promise<Out> {
  const [resource, id, sub, subId] = segments;
  if (id && !guid.safeParse(id).success) return err("invalid_id", 400);
  const params = Object.fromEntries(url.searchParams);
  const listKey = `${storeId}:${resource}:${url.search}`;

  switch (resource) {
    case "products": {
      if (!id) {
        if (method === "GET") {
          const f = svc.productListQuery.safeParse(params);
          if (!f.success) return err("invalid_query", 400);
          return ok(await svc.cached(listKey, svc.LIST_TTL, () => svc.listProducts(admin, storeId, f.data)));
        }
        if (method === "POST") {
          const input = await body(request, svc.productSchema);
          if (isOut(input)) return input;
          const res = await svc.saveProduct(admin, storeId, { ...input, variants: input.variants ?? [] });
          return ok({ data: await svc.getProduct(admin, storeId, res.id) }, 201);
        }
        return err("method_not_allowed", 405);
      }
      if (sub === "duplicate") {
        if (method !== "POST") return err("method_not_allowed", 405);
        const res = await svc.duplicateProduct(admin, storeId, id);
        return res ? ok({ data: await svc.getProduct(admin, storeId, res.id) }, 201) : err("not_found", 404);
      }
      if (sub === "variants") {
        if (method === "GET") return ok({ data: await svc.listVariants(admin, storeId, id) });
        if (method === "POST") {
          const input = await body(request, svc.variantSchema);
          if (isOut(input)) return input;
          const v = await svc.createVariant(admin, storeId, id, input);
          return v ? ok({ data: v }, 201) : err("not_found", 404);
        }
        return err("method_not_allowed", 405);
      }
      if (sub) return err("unknown_endpoint", 404);
      if (method === "GET") {
        const p = await svc.cached(`${storeId}:product:${id}`, svc.DETAIL_TTL, () => svc.getProduct(admin, storeId, id));
        return p ? ok({ data: p }) : err("not_found", 404);
      }
      if (method === "PUT" || method === "PATCH") {
        const current = await svc.getProduct(admin, storeId, id);
        if (!current) return err("not_found", 404);
        const input = await body(request, svc.productSchema.partial());
        if (isOut(input)) return input;
        const merged = svc.productSchema.parse({
          title: current.title, description: current.description, handle: current.slug, vendor: current.vendor,
          product_type: current.product_type, status: current.status, seo_title: current.seo_title,
          seo_description: current.seo_description, tags: current.tags ?? [], price: Number(current.base_price),
          compare_at_price: current.compare_at_price, cost_price: current.cost_price,
          options: current.variant_options ?? [], ...input,
        });
        await svc.saveProduct(admin, storeId, merged, id);
        return ok({ data: await svc.getProduct(admin, storeId, id) });
      }
      if (method === "DELETE") return (await svc.deleteProduct(admin, storeId, id)) ? ok({ deleted: true }) : err("not_found", 404);
      return err("method_not_allowed", 405);
    }

    case "variants": {
      if (!id || sub) return err("unknown_endpoint", 404);
      if (method === "PUT" || method === "PATCH") {
        const input = await body(request, svc.variantSchema);
        if (isOut(input)) return input;
        const v = await svc.updateVariant(admin, storeId, id, input);
        return v ? ok({ data: v }) : err("not_found", 404);
      }
      if (method === "DELETE") return (await svc.deleteVariant(admin, storeId, id)) ? ok({ deleted: true }) : err("not_found", 404);
      return err("method_not_allowed", 405);
    }

    case "collections": {
      if (!id) {
        if (method === "GET") return ok({ data: await svc.cached(listKey, svc.LIST_TTL, () => svc.listCollections(admin, storeId)) });
        if (method === "POST") {
          const input = await body(request, svc.collectionSchema);
          if (isOut(input)) return input;
          return ok({ data: await svc.saveCollection(admin, storeId, input) }, 201);
        }
        return err("method_not_allowed", 405);
      }
      if (sub === "products") {
        if (method !== "POST") return err("method_not_allowed", 405);
        const input = await body(request, z.object({ product_ids: z.array(z.guid()).max(1000) }));
        if (isOut(input)) return input;
        try {
          const n = await svc.setCollectionProducts(admin, storeId, id, input.product_ids);
          return n === null ? err("not_found", 404) : ok({ data: { products_count: n } });
        } catch (e) {
          return err((e as Error).message, 409);
        }
      }
      if (sub) return err("unknown_endpoint", 404);
      if (method === "PUT" || method === "PATCH") {
        const input = await body(request, svc.collectionSchema);
        if (isOut(input)) return input;
        const c = await svc.saveCollection(admin, storeId, input, id);
        return c ? ok({ data: c }) : err("not_found", 404);
      }
      return err("method_not_allowed", 405);
    }

    case "customers": {
      if (!id) {
        if (method === "GET") {
          const f = svc.customerListQuery.safeParse(params);
          if (!f.success) return err("invalid_query", 400);
          return ok(await svc.cached(listKey, svc.LIST_TTL, () => svc.listCustomers(admin, storeId, f.data)));
        }
        if (method === "POST") {
          const input = await body(request, svc.customerSchema);
          if (isOut(input)) return input;
          try { return ok({ data: await svc.createCustomer(admin, storeId, input) }, 201); }
          catch (e) { return err("conflict", 409, { message: (e as Error).message }); }
        }
        return err("method_not_allowed", 405);
      }
      if (sub === "addresses") {
        if (subId && !guid.safeParse(subId).success) return err("invalid_id", 400);
        if (!subId && method === "GET") return ok({ data: await svc.listAddresses(admin, storeId, id) });
        if ((!subId && method === "POST") || (subId && (method === "PUT" || method === "PATCH"))) {
          const input = await body(request, svc.addressSchema);
          if (isOut(input)) return input;
          const a = await svc.saveAddress(admin, storeId, id, input, subId);
          return a ? ok({ data: a }, subId ? 200 : 201) : err("not_found", 404);
        }
        if (subId && method === "DELETE") return (await svc.deleteAddress(admin, storeId, id, subId)) ? ok({ deleted: true }) : err("not_found", 404);
        return err("method_not_allowed", 405);
      }
      if (sub === "orders") {
        if (method !== "GET") return err("method_not_allowed", 405);
        return ok({ data: await svc.customerOrders(admin, storeId, id) });
      }
      if (sub === "notes") {
        if (method === "GET") return ok({ data: await svc.listNotes(admin, storeId, id) });
        if (method === "POST") {
          const input = await body(request, z.object({ note: z.string().trim().min(1).max(4000) }));
          if (isOut(input)) return input;
          const n = await svc.addNote(admin, storeId, id, input.note, null);
          return n ? ok({ data: n }, 201) : err("not_found", 404);
        }
        return err("method_not_allowed", 405);
      }
      if (sub) return err("unknown_endpoint", 404);
      if (method === "GET") {
        const c = await svc.cached(`${storeId}:customer:${id}`, svc.DETAIL_TTL, () => svc.getCustomer(admin, storeId, id));
        return c ? ok({ data: c }) : err("not_found", 404);
      }
      if (method === "PUT" || method === "PATCH") {
        const input = await body(request, svc.customerSchema);
        if (isOut(input)) return input;
        try {
          const c = await svc.updateCustomer(admin, storeId, id, input);
          return c ? ok({ data: c }) : err("not_found", 404);
        } catch (e) { return err("conflict", 409, { message: (e as Error).message }); }
      }
      if (method === "DELETE") return (await svc.deleteCustomer(admin, storeId, id)) ? ok({ deleted: true }) : err("not_found", 404);
      return err("method_not_allowed", 405);
    }

    case "segments": {
      if (!id) {
        if (method === "GET") return ok({ data: await svc.listSegments(admin, storeId) });
        if (method === "POST") {
          const input = await body(request, svc.segmentSchema);
          if (isOut(input)) return input;
          return ok({ data: await svc.saveSegment(admin, storeId, input) }, 201);
        }
        return err("method_not_allowed", 405);
      }
      if (sub === "customers" && method === "GET") {
        const m = await svc.segmentCustomers(admin, storeId, id);
        return m ? ok({ data: m, meta: { total: m.length } }) : err("not_found", 404);
      }
      return err("unknown_endpoint", 404);
    }
  }
  return err("unknown_resource", 404);
}
