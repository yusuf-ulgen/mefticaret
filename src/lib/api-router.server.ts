import { z } from "zod";

import { authenticateApiKey, logApiRequest, type AuthedApiKey } from "@/lib/api-keys.server";

/** Mefticaret REST API yönlendiricisi (/api/v1/... ve gelecekte /api/v2/...). */

const SUPPORTED_VERSIONS = new Set(["v1"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-api-key, content-type",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

function extractKey(request: Request) {
  const bearer = request.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) return bearer.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() ?? "";
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.string().trim().max(40).optional(),
  q: z.string().trim().max(120).optional(),
});

type Resource = {
  table:
    | "products"
    | "orders"
    | "customers"
    | "product_variants"
    | "stores"
    | "collections"
    | "store_payment_methods"
    | "shipping_rates";
  select: string;
  readScope: string;
  writeScope: string | null;
  searchColumn?: string;
  statusColumn?: string;
  writeSchema?: z.ZodTypeAny;
};

const RESOURCES: Record<string, Resource> = {
  products: {
    table: "products",
    select:
      "id, title, slug, sku, barcode, status, vendor, product_type, tags, base_price, compare_at_price, cost_price, tax_rate, currency, weight_grams, track_inventory, seo, created_at, updated_at",
    readScope: "read_products",
    writeScope: "write_products",
    searchColumn: "title",
    statusColumn: "status",
    writeSchema: z.object({
      title: z.string().trim().min(1).max(300).optional(),
      slug: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(20_000).nullish(),
      sku: z.string().trim().max(120).nullish(),
      barcode: z.string().trim().max(120).nullish(),
      status: z.enum(["draft", "active", "archived"]).optional(),
      vendor: z.string().trim().max(160).nullish(),
      product_type: z.string().trim().max(160).nullish(),
      tags: z.array(z.string().trim().max(60)).max(50).optional(),
      base_price: z.number().min(0).max(10_000_000).optional(),
      compare_at_price: z.number().min(0).max(10_000_000).nullish(),
      cost_price: z.number().min(0).max(10_000_000).nullish(),
      tax_rate: z.number().min(0).max(100).optional(),
      weight_grams: z.number().int().min(0).max(1_000_000).nullish(),
    }),
  },
  orders: {
    table: "orders",
    select:
      "id, order_number, status, payment_status, fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, discount_code, customer_email, customer_name, customer_phone, shipping_address, billing_address, shipping_carrier, tracking_number, invoice_number, note, placed_at, created_at, updated_at, order_items(id, product_id, variant_id, title, sku, quantity, unit_price, total, tax_rate, tax_amount)",
    readScope: "read_orders",
    writeScope: "write_orders",
    searchColumn: "order_number",
    statusColumn: "status",
    writeSchema: z.object({
      status: z
        .enum([
          "pending",
          "awaiting_payment",
          "paid",
          "processing",
          "packed",
          "shipped",
          "delivered",
          "cancelled",
          "returned",
          "refunded",
        ])
        .optional(),
      payment_status: z
        .enum(["pending", "paid", "partially_refunded", "refunded", "failed"])
        .optional(),
      fulfillment_status: z
        .enum(["unfulfilled", "partially_fulfilled", "fulfilled", "returned"])
        .optional(),
      shipping_carrier: z.string().trim().max(120).nullish(),
      tracking_number: z.string().trim().max(120).nullish(),
      note: z.string().max(5000).nullish(),
    }),
  },
  customers: {
    table: "customers",
    select:
      "id, full_name, email, phone, accepts_marketing, tags, notes, total_spent, orders_count, created_at, updated_at",
    readScope: "read_customers",
    writeScope: "write_customers",
    searchColumn: "email",
    writeSchema: z.object({
      full_name: z.string().trim().max(200).nullish(),
      email: z.string().trim().email().max(200).nullish(),
      phone: z.string().trim().max(40).nullish(),
      accepts_marketing: z.boolean().optional(),
      tags: z.array(z.string().trim().max(60)).max(50).optional(),
      notes: z.string().max(5000).nullish(),
    }),
  },
  inventory: {
    table: "product_variants",
    select:
      "id, product_id, title, sku, barcode, price, stock, low_stock_threshold, weight_grams, options, created_at, updated_at",
    readScope: "read_inventory",
    writeScope: "write_inventory",
    searchColumn: "sku",
    writeSchema: z.object({
      stock: z.number().int().min(0).max(10_000_000).optional(),
      low_stock_threshold: z.number().int().min(0).max(100_000).optional(),
      price: z.number().min(0).max(10_000_000).optional(),
      sku: z.string().trim().max(120).nullish(),
      barcode: z.string().trim().max(120).nullish(),
    }),
  },
  store: {
    table: "stores",
    select: "id, name, slug, status, industry, currency, locale, plan_id, created_at, updated_at",
    readScope: "read_store",
    writeScope: null,
  },
  categories: {
    table: "collections",
    select: "id, title, slug, description, is_active, sort_order, created_at, updated_at",
    readScope: "read_categories",
    writeScope: null,
    searchColumn: "title",
  },
  payments: {
    table: "store_payment_methods",
    select: "id, provider, label, is_active, extra_fee_percent, extra_fee_fixed, config, sort_order",
    readScope: "read_payments",
    writeScope: null,
  },
  shipping: {
    table: "shipping_rates",
    select:
      "id, zone_id, name, carrier, price, min_subtotal, max_subtotal, free_over, eta_days, is_active",
    readScope: "read_shipping",
    writeScope: null,
  },
};

/** İstek yolunu çözer, anahtarı doğrular ve kaynak sorgusunu çalıştırır. */
export async function handleApiRequest(request: Request, splat: string): Promise<Response> {
  const started = Date.now();
  const method = request.method.toUpperCase();
  const url = new URL(request.url);

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: json({}).headers });

  const segments = splat.split("/").filter(Boolean);
  const [version, resourceName, resourceId] = segments;

  if (!version || !SUPPORTED_VERSIONS.has(version)) {
    return json(
      { error: "unsupported_api_version", supported: [...SUPPORTED_VERSIONS] },
      400,
    );
  }

  const rawKey = extractKey(request);
  let auth: AuthedApiKey | null = null;
  try {
    auth = await authenticateApiKey(rawKey);
  } catch {
    auth = null;
  }
  if (!auth) return json({ error: "unauthorized", message: "Geçersiz veya süresi geçmiş API anahtarı" }, 401);

  const finish = async (response: Response, errorMessage?: string) => {
    await logApiRequest({
      storeId: auth.storeId,
      apiKeyId: auth.id,
      apiVersion: version,
      method,
      path: url.pathname,
      statusCode: response.status,
      durationMs: Date.now() - started,
      ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
      errorMessage: errorMessage ?? null,
    });
    return response;
  };

  if (!resourceName) {
    return finish(
      json({
        version,
        store_id: auth.storeId,
        scopes: auth.scopes,
        resources: Object.keys(RESOURCES).map((name) => `/api/${version}/${name}`),
      }),
    );
  }

  const resource = RESOURCES[resourceName];
  if (!resource) return finish(json({ error: "unknown_resource", resource: resourceName }, 404));

  const writing = method === "POST" || method === "PATCH" || method === "PUT";
  const needed = writing ? resource.writeScope : resource.readScope;
  if (!needed) return finish(json({ error: "method_not_allowed" }, 405));
  if (!auth.scopes.includes(needed)) {
    return finish(json({ error: "insufficient_scope", required: needed }, 403), "insufficient_scope");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    if (method === "GET") {
      if (resourceName === "store") {
        const { data, error } = await supabaseAdmin
          .from("stores")
          .select(resource.select)
          .eq("id", auth.storeId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        return finish(json({ data }));
      }

      if (resourceId) {
        const query = supabaseAdmin
          .from(resource.table)
          .select(resource.select)
          .eq("id", resourceId);
        const scoped = resource.table === "product_variants" ? query : query.eq("store_id", auth.storeId);
        const { data, error } = await scoped.maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return finish(json({ error: "not_found" }, 404));
        return finish(json({ data }));
      }

      const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return finish(json({ error: "invalid_query" }, 400));
      const { limit, offset, status, q } = parsed.data;

      let query = supabaseAdmin
        .from(resource.table)
        .select(resource.select, { count: "exact" })
        .eq("store_id", auth.storeId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && resource.statusColumn) query = query.eq(resource.statusColumn, status);
      if (q && resource.searchColumn) query = query.ilike(resource.searchColumn, `%${q}%`);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return finish(json({ data: data ?? [], meta: { limit, offset, total: count ?? 0 } }));
    }

    if (!resource.writeSchema) return finish(json({ error: "method_not_allowed" }, 405));

    const payload = await request.json().catch(() => null);
    const parsed = resource.writeSchema.safeParse(payload);
    if (!parsed.success) {
      return finish(
        json({ error: "validation_failed", issues: parsed.error.issues.slice(0, 20) }, 422),
        "validation_failed",
      );
    }
    const patch = parsed.data as Record<string, unknown>;

    if (method === "POST") {
      if (resourceName === "inventory") return finish(json({ error: "method_not_allowed" }, 405));
      const { data, error } = await supabaseAdmin
        .from(resource.table)
        .insert({ ...patch, store_id: auth.storeId } as never)
        .select(resource.select)
        .single();
      if (error) throw new Error(error.message);
      return finish(json({ data }, 201));
    }

    if (!resourceId) return finish(json({ error: "missing_resource_id" }, 400));

    const base = supabaseAdmin.from(resource.table).update(patch as never).eq("id", resourceId);
    const scoped = resource.table === "product_variants" ? base : base.eq("store_id", auth.storeId);
    const { data, error } = await scoped.select(resource.select).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return finish(json({ error: "not_found" }, 404));
    return finish(json({ data }));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown_error";
    return finish(json({ error: "server_error" }, 500), message);
  }
}
