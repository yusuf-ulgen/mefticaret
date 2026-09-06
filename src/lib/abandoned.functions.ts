import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cartItemSchema = z.object({
  variantId: z.guid().optional(),
  productSlug: z.string().max(160).optional(),
  title: z.string().max(200),
  variantTitle: z.string().max(200).optional(),
  quantity: z.number().int().min(1).max(999),
  price: z.number().min(0),
});

const syncSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  cartToken: z.string().trim().min(16).max(128),
  customerEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  customerName: z.string().trim().max(200).optional(),
  items: z.array(cartItemSchema).max(200),
  currency: z.string().trim().min(3).max(3),
});

export const syncAbandonedCart = createServerFn({ method: "POST" })
  .inputValidator((data) => syncSchema.parse(data))
  .handler(async ({ data }) => {
    // Sepet anlık görüntüleri yalnızca sunucu tarafında yazılır; ziyaretçilerin
    // tabloya doğrudan yazma izni yoktur (token tahmini ile veri kurcalanamaz).
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");


    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) return { ok: false as const };

    const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

    if (data.items.length === 0) {
      // Sepet boşaldıysa bekleyen anlık görüntüyü sıfırla
      const { error } = await supabase
        .from("abandoned_carts")
        .update({ items: [], item_count: 0, total: 0, last_seen_at: new Date().toISOString() })
        .eq("store_id", store.id)
        .eq("cart_token", data.cartToken);
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    const { error } = await supabase.from("abandoned_carts").upsert(
      {
        store_id: store.id,
        cart_token: data.cartToken,
        customer_email: data.customerEmail || null,
        customer_name: data.customerName || null,
        items: data.items,
        item_count: itemCount,
        total: Math.round(total * 100) / 100,
        currency: data.currency,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "store_id,cart_token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const markCartRecovered = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120),
        cartToken: z.string().trim().min(16).max(128),
        orderNumber: z.string().trim().min(1).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) return { ok: false as const };

    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("store_id", store.id)
      .eq("order_number", data.orderNumber)
      .maybeSingle();

    const { error } = await supabase
      .from("abandoned_carts")
      .update({ recovered_order_id: order?.id ?? null })
      .eq("store_id", store.id)
      .eq("cart_token", data.cartToken)
      .is("recovered_order_id", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listAbandonedCarts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("abandoned_carts")
      .select("*")
      .eq("store_id", data.storeId)
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteAbandonedCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("abandoned_carts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Kurtarma linki için sepet anlık görüntüsünü token ile okur.
 * Token tarayıcıya özel rastgele 40+ karakterdir; yalnızca sepet satırları döner.
 */
export const getAbandonedCartByToken = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().trim().min(1).max(120),
        cartToken: z.string().trim().min(16).max(128),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");

    const { data: store } = await supabase.from("stores").select("id").eq("slug", data.slug).maybeSingle();
    if (!store) return null;

    const { data: cart, error } = await supabase
      .from("abandoned_carts")
      .select("items, currency, recovered_order_id")
      .eq("store_id", store.id)
      .eq("cart_token", data.cartToken)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cart || cart.recovered_order_id) return null;

    const items = (Array.isArray(cart.items) ? cart.items : []) as {
      variantId?: string;
      productSlug?: string;
      title?: string;
      variantTitle?: string;
      quantity?: number;
      price?: number;
    }[];

    return {
      currency: cart.currency,
      items: items
        .filter((item) => typeof item.variantId === "string" && typeof item.productSlug === "string")
        .map((item) => ({
          variantId: item.variantId as string,
          productSlug: item.productSlug as string,
          title: item.title ?? "Ürün",
          variantTitle: item.variantTitle ?? "",
          quantity: Math.max(1, Number(item.quantity ?? 1)),
          price: Number(item.price ?? 0),
        })),
    };
  });
