import { requireHomeMaker } from "@/lib/home-maker-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
const customerListInput = storeInput.extend({
  page: z.number().int().min(0).max(100000).default(0),
  search: z.string().max(100).default(""),
});

export const listKolayCustomers = createServerFn({ method: "GET" })
  .middleware([requireHomeMaker])
  .inputValidator((input: unknown) => customerListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
    const currency = (store as { currency?: string | null }).currency ?? "TRY";

    let query = supabase
      .from("customers")
      .select(
        "id, full_name, phone, email, notes, tags, orders_count, total_spent, last_activity_at, created_at",
        { count: "exact" },
      )
      .eq("store_id", data.storeId)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .order("id");
    const term = data.search.trim().replace(/[%,().]/g, " ");
    if (term)
      query = query.or(
        `full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%,notes.ilike.%${term}%`,
      );
    const pageSize = 25;
    const {
      data: rows,
      count,
      error,
    } = await query.range(data.page * pageSize, (data.page + 1) * pageSize - 1);
    if (error) throw new Error(error.message);

    const aggregate = rows?.length ? await supabase.rpc("customer_page_summaries", { p_store_id: data.storeId, p_customer_ids: rows.map((row) => row.id) }) : { data: [], error: null };
    if (aggregate.error) throw new Error(aggregate.error.message);
    const summary = new Map((aggregate.data ?? []).map((row) => [row.customer_id, row]));

    const items: KolayCustomer[] = (rows ?? []).map((row) => {
      const match = summary.get(row.id);
      return {
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        tags: (row.tags ?? []) as string[],
        ordersCount: Number(match?.orders_count ?? 0),
        totalSpent: Number(match?.total_spent ?? 0),
        lastOrderAt: match?.last_order_at ?? row.last_activity_at ?? null,
        currency,
      };
    });
    return { items, total: count ?? 0, pageSize, currency };
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
