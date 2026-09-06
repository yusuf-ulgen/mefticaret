import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/mefti";
import { insertAuditRow } from "./audit.server";

/**
 * Kural tabanlı müşteri segmentleri.
 * Tenant izolasyonu RLS ile zorlanır; burada doğrulama, slug üretimi ve audit yapılır.
 */

const segmentInput = z.object({
  storeId: z.guid(),
  segmentId: z.guid().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(400).optional(),
  color: z.enum(["slate", "primary", "emerald", "amber", "sky", "rose"]).default("slate"),
  minOrders: z.number().int().min(0).max(9999).default(0),
  minSpent: z.number().min(0).max(100_000_000).default(0),
  inactiveDays: z.number().int().min(0).max(3650).nullable().optional(),
  newWithinDays: z.number().int().min(0).max(3650).nullable().optional(),
  requiredTags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const saveCustomerSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => segmentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const base = slugify(data.name) || "segment";
    let slug = base;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: taken } = await supabase
        .from("customer_segments")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("slug", slug)
        .maybeSingle();
      if (!taken || taken.id === data.segmentId) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const payload = {
      store_id: data.storeId,
      name: data.name,
      slug,
      description: data.description ?? null,
      color: data.color,
      min_orders: data.minOrders,
      min_spent: data.minSpent,
      inactive_days: data.inactiveDays ?? null,
      new_within_days: data.newWithinDays ?? null,
      required_tags: data.requiredTags,
      sort_order: data.sortOrder,
    };

    const query = data.segmentId
      ? supabase
          .from("customer_segments")
          .update(payload)
          .eq("id", data.segmentId)
          .eq("store_id", data.storeId)
      : supabase.from("customer_segments").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: data.segmentId ? "customer_segment.updated" : "customer_segment.created",
      entity: "customer_segments",
      entity_id: row.id,
      new_value: { name: row.name, slug: row.slug } as never,
    });

    return row;
  });

export const deleteCustomerSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), segmentId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("customer_segments")
      .delete()
      .eq("id", data.segmentId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "customer_segment.deleted",
      entity: "customer_segments",
      entity_id: data.segmentId,
    });

    return { ok: true };
  });

/** Hazır segment şablonlarını (yeni, sadık, VIP, yüksek değerli, pasif) oluşturur. */
export const seedDefaultSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const defaults = [
      {
        name: "Yeni müşteri",
        slug: "yeni-musteri",
        description: "Son 30 gün içinde ilk kez alışveriş yapan müşteriler.",
        color: "sky",
        min_orders: 1,
        min_spent: 0,
        inactive_days: null,
        new_within_days: 30,
        sort_order: 0,
      },
      {
        name: "Sadık müşteri",
        slug: "sadik-musteri",
        description: "En az 3 sipariş vermiş, düzenli alışveriş yapan müşteriler.",
        color: "emerald",
        min_orders: 3,
        min_spent: 0,
        inactive_days: null,
        new_within_days: null,
        sort_order: 1,
      },
      {
        name: "VIP",
        slug: "vip",
        description: "En az 5 sipariş ve 10.000 üzeri toplam harcama yapan müşteriler.",
        color: "primary",
        min_orders: 5,
        min_spent: 10_000,
        inactive_days: null,
        new_within_days: null,
        sort_order: 2,
      },
      {
        name: "Yüksek değerli müşteri",
        slug: "yuksek-degerli-musteri",
        description: "Toplam harcaması 5.000 üzerinde olan müşteriler.",
        color: "amber",
        min_orders: 1,
        min_spent: 5_000,
        inactive_days: null,
        new_within_days: null,
        sort_order: 3,
      },
      {
        name: "Pasif müşteri",
        slug: "pasif-musteri",
        description: "90 günden uzun süredir alışveriş yapmayan müşteriler.",
        color: "rose",
        min_orders: 1,
        min_spent: 0,
        inactive_days: 90,
        new_within_days: null,
        sort_order: 4,
      },
    ];

    const { data: existing, error: existingError } = await supabase
      .from("customer_segments")
      .select("slug")
      .eq("store_id", data.storeId);
    if (existingError) throw new Error(existingError.message);

    const taken = new Set((existing ?? []).map((row) => row.slug));
    const rows = defaults
      .filter((row) => !taken.has(row.slug))
      .map((row) => ({ ...row, store_id: data.storeId, is_system: true, required_tags: [] }));

    if (rows.length === 0) return { created: 0 };

    const { error } = await supabase.from("customer_segments").insert(rows);
    if (error) throw new Error(error.message);
    return { created: rows.length };
  });
