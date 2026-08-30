import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const cartItemSchema = z.object({
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
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

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
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

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
  .inputValidator((data) => z.object({ storeId: z.string().uuid() }).parse(data))
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
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("abandoned_carts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
