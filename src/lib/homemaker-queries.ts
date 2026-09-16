import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signMediaPaths } from "@/lib/media";

/**
 * "Kolay Panel" (ev üretimi mağazaları) için sade okuma katmanı.
 * Gerçek mağaza verisini kullanır; tenant izolasyonu RLS ile veritabanında zorlanır.
 */

export type SimpleVariant = {
  id: string;
  title: string;
  price: number | null;
  stock: number | null;
  options: Record<string, string> | null;
};

export type SimpleProduct = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  base_price: number;
  currency: string;
  slug: string | null;
  product_type: string | null;
  made_to_order: boolean;
  prep_days: number;
  custom_note_enabled: boolean;
  custom_note_label: string | null;
  variants: SimpleVariant[];
  imageUrl: string;
  stock: number;
};

export const simpleProductsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-products", storeId],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<SimpleProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, description, status, base_price, currency, slug, product_type, made_to_order, prep_days, custom_note_enabled, custom_note_label, product_variants(id, title, price, stock, options), product_images(url, storage_path, position)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = data ?? [];
      const paths = rows
        .flatMap((row) => (row.product_images ?? []).map((img) => img.storage_path ?? ""))
        .filter(Boolean);
      const signed = await signMediaPaths(paths);

      return rows.map((row) => {
        const images = (row.product_images ?? [])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const first = images[0];
        const variants = (row.product_variants ?? []).map((variant) => ({
          id: variant.id,
          title: variant.title,
          price: variant.price === null ? null : Number(variant.price),
          stock: variant.stock,
          options: (variant.options ?? null) as Record<string, string> | null,
        }));
        const extra = row as unknown as {
          made_to_order?: boolean | null;
          prep_days?: number | null;
          custom_note_enabled?: boolean | null;
          custom_note_label?: string | null;
        };
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          base_price: Number(row.base_price),
          currency: row.currency,
          slug: row.slug,
          product_type: row.product_type,
          made_to_order: Boolean(extra.made_to_order),
          prep_days: Number(extra.prep_days ?? 0),
          custom_note_enabled: Boolean(extra.custom_note_enabled),
          custom_note_label: extra.custom_note_label ?? null,
          variants,
          imageUrl: first
            ? first.storage_path
              ? (signed[first.storage_path] ?? "")
              : first.url
            : "",
          stock: variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0),
        };
      });
    },
  });

export type SimpleOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  grand_total: number;
  currency: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  shipping_address: Record<string, unknown> | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  placed_at: string | null;
  items: { id: string; title: string; variant_title: string | null; quantity: number }[];
};

export const simpleOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-orders", storeId],
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<SimpleOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, grand_total, currency, customer_name, customer_phone, customer_email, shipping_address, tracking_number, shipping_carrier, placed_at, order_items(id, title, variant_title, quantity)",
        )
        .eq("store_id", storeId)
        .order("placed_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        order_number: row.order_number,
        status: row.status,
        payment_status: row.payment_status,
        grand_total: Number(row.grand_total),
        currency: row.currency,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        customer_email: row.customer_email,
        shipping_address: (row.shipping_address ?? null) as Record<string, unknown> | null,
        tracking_number: row.tracking_number,
        shipping_carrier: row.shipping_carrier,
        placed_at: row.placed_at,
        items: (row.order_items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          variant_title: item.variant_title,
          quantity: item.quantity,
        })),
      }));
    },
  });
