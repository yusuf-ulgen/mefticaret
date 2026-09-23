import { requireHomeMaker } from "@/lib/home-maker-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kolay Panel müşteri uçları.
 *
 * Müşteri listesi ve sipariş özetleri veritabanından hesaplanır; istemciden
 * gelen toplam/sipariş sayısına asla güvenilmez. Tenant izolasyonu RLS ile
 * (mağaza üyeliği) zorlanır — kullanıcı kimliğiyle çalışan istemci kullanılır.
 */

export type KolayCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  currency: string;
};

const storeInput = z.object({ storeId: z.string().uuid() });

export const listKolayCustomers = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .inputValidator((input: unknown) => storeInput.parse(input))
  .handler(async ({ data, context }): Promise<KolayCustomer[]> => {
    const { supabase } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
    const currency = (store as { currency?: string | null }).currency ?? "TRY";

    const { data: rows, error } = await supabase
      .from("customers")
      .select(
        "id, full_name, phone, email, notes, tags, orders_count, total_spent, last_activity_at, created_at",
      )
      .eq("store_id", data.storeId)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw new Error(error.message);

    // Gerçek sipariş verisiyle telefon/e-posta üzerinden eşleştirilmiş özet.
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("customer_phone, customer_email, grand_total, payment_status, status, placed_at")
      .eq("store_id", data.storeId)
      .limit(2000);
    if (ordersError) throw new Error(ordersError.message);

    const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(-10);
    const summary = new Map<string, { count: number; total: number; last: string | null }>();
    for (const order of orders ?? []) {
      if (["cancelled", "refunded", "returned"].includes(String(order.status))) continue;
      const keys = [digits(order.customer_phone), (order.customer_email ?? "").toLowerCase()].filter(
        Boolean,
      );
      for (const key of keys) {
        const current = summary.get(key) ?? { count: 0, total: 0, last: null };
        current.count += 1;
        if (String(order.payment_status) === "paid") current.total += Number(order.grand_total ?? 0);
        const placed = order.placed_at ?? null;
        if (placed && (!current.last || placed > current.last)) current.last = placed;
        summary.set(key, current);
      }
    }

    return (rows ?? []).map((row) => {
      const byPhone = summary.get(digits(row.phone));
      const byMail = summary.get((row.email ?? "").toLowerCase());
      const match = byPhone ?? byMail;
      return {
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        tags: (row.tags ?? []) as string[],
        ordersCount: match?.count ?? Number(row.orders_count ?? 0),
        totalSpent: match?.total ?? Number(row.total_spent ?? 0),
        lastOrderAt: match?.last ?? row.last_activity_at ?? null,
        currency,
      };
    });
  });

const saveInput = z.object({
  storeId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2, "Müşteri adı en az 2 karakter olmalı").max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email("Geçerli bir e-posta girin").max(160).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

export const saveKolayCustomer = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      full_name: data.fullName,
      phone: data.phone?.trim() ? data.phone.trim() : null,
      email: data.email?.trim() ? data.email.trim() : null,
      notes: data.notes?.trim() ? data.notes.trim() : null,
      tags: data.tags ?? [],
    };

    if (data.customerId) {
      const { error } = await supabase
        .from("customers")
        .update(patch)
        .eq("id", data.customerId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.customerId };
    }

    const { data: created, error } = await supabase
      .from("customers")
      .insert({ ...patch, store_id: data.storeId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteKolayCustomer = createServerFn({ method: "POST" })
  .middleware([requireHomeMaker])
  .inputValidator((input: unknown) =>
    z.object({ storeId: z.string().uuid(), customerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customers")
      .delete()
      .eq("id", data.customerId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
