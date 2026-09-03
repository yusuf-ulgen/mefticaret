import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "@/lib/audit.server";
import {
  bulkMarkOrdersProcessing,
  orderAnalysis,
  productAnalysis,
  resolveMarketplaceReturn,
  settlementSummary,
  stockDepletionAnalysis,
} from "@/lib/marketplace-ops.server";

/** Pazaryeri Operasyon sunucu fonksiyonları. Tenant izolasyonu RLS ile zorlanır. */

export const resolveMarketplaceReturnFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        returnId: z.string().uuid(),
        action: z.enum(["approve", "reject", "receive", "refund"]),
        staffNote: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    resolveMarketplaceReturn(context.supabase, {
      storeId: data.storeId,
      returnId: data.returnId,
      action: data.action,
      actorId: context.userId,
      staffNote: data.staffNote ?? null,
    }),
  );

export const upsertMarketplaceReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        returnId: z.string().uuid().optional(),
        marketplace: z.string().trim().min(1).max(60),
        channelId: z.string().uuid().nullish(),
        orderId: z.string().uuid().nullish(),
        externalOrderNumber: z.string().trim().max(120).nullish(),
        externalReturnId: z.string().trim().max(120).nullish(),
        customerName: z.string().trim().max(160).nullish(),
        reason: z.string().trim().max(60).nullish(),
        reasonDetail: z.string().trim().max(1000).nullish(),
        isExchange: z.boolean().default(false),
        autoRestock: z.boolean().default(true),
        totalAmount: z.number().min(0).max(1_000_000).default(0),
        currency: z.string().trim().min(3).max(3).default("TRY"),
        items: z
          .array(
            z.object({
              product_id: z.string().uuid().nullish(),
              variant_id: z.string().uuid().nullish(),
              title: z.string().max(200).optional(),
              quantity: z.number().int().min(1).max(999),
            }),
          )
          .max(50)
          .default([]),
        status: z
          .enum(["requested", "approved", "rejected", "received", "refunded", "cancelled"])
          .default("requested"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      marketplace: data.marketplace,
      channel_id: data.channelId ?? null,
      order_id: data.orderId ?? null,
      external_order_number: data.externalOrderNumber ?? null,
      external_return_id: data.externalReturnId ?? null,
      customer_name: data.customerName ?? null,
      reason: data.reason ?? null,
      reason_detail: data.reasonDetail ?? null,
      is_exchange: data.isExchange,
      auto_restock: data.autoRestock,
      total_amount: data.totalAmount,
      currency: data.currency,
      items: data.items,
      status: data.status,
    };

    if (data.returnId) {
      const { data: updated, error } = await context.supabase
        .from("marketplace_returns")
        .update(payload)
        .eq("id", data.returnId)
        .eq("store_id", data.storeId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("İade kaydı güncellenemedi");
      return updated;
    }

    const { data: created, error } = await context.supabase
      .from("marketplace_returns")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "marketplace_return.created",
      entity: "marketplace_returns",
      entity_id: created.id,
      new_value: payload,
    });
    return created;
  });

export const bulkMarkOrdersProcessingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), orderIds: z.array(z.string().uuid()).min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) =>
    bulkMarkOrdersProcessing(context.supabase, {
      storeId: data.storeId,
      orderIds: data.orderIds,
      actorId: context.userId,
    }),
  );

export const upsertSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        settlementId: z.string().uuid().optional(),
        channelId: z.string().uuid().nullish(),
        marketplace: z.string().trim().min(1).max(60),
        periodStart: z.string().min(10),
        periodEnd: z.string().min(10),
        grossAmount: z.number().min(0).default(0),
        commissionAmount: z.number().min(0).default(0),
        shippingAmount: z.number().min(0).default(0),
        serviceFee: z.number().min(0).default(0),
        otherDeductions: z.number().min(0).default(0),
        netAmount: z.number().default(0),
        currency: z.string().trim().min(3).max(3).default("TRY"),
        status: z.enum(["pending", "processing", "paid", "disputed", "cancelled"]).default("pending"),
        externalId: z.string().trim().max(120).nullish(),
        paidAt: z.string().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      channel_id: data.channelId ?? null,
      marketplace: data.marketplace,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      gross_amount: data.grossAmount,
      commission_amount: data.commissionAmount,
      shipping_amount: data.shippingAmount,
      service_fee: data.serviceFee,
      other_deductions: data.otherDeductions,
      net_amount: data.netAmount,
      currency: data.currency,
      status: data.status,
      external_id: data.externalId ?? null,
      paid_at: data.paidAt ?? null,
    };

    if (data.settlementId) {
      const { data: updated, error } = await context.supabase
        .from("marketplace_settlements")
        .update(payload)
        .eq("id", data.settlementId)
        .eq("store_id", data.storeId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("Mutabakat kaydı güncellenemedi");
      return updated;
    }

    const { data: created, error } = await context.supabase
      .from("marketplace_settlements")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await insertAuditRow(context.supabase, {
      store_id: data.storeId,
      actor_id: context.userId,
      action: "marketplace_settlement.upserted",
      entity: "marketplace_settlements",
      entity_id: created.id,
      new_value: payload,
    });
    return created;
  });

export const deleteSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), settlementId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketplace_settlements")
      .delete()
      .eq("id", data.settlementId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertListingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        linkId: z.string().uuid().optional(),
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullish(),
        channelId: z.string().uuid(),
        externalListingId: z.string().trim().max(160).nullish(),
        externalBarcode: z.string().trim().max(160).nullish(),
        title: z.string().trim().max(200).nullish(),
        price: z.number().min(0).nullish(),
        stockMultiplier: z.number().min(0).max(100).default(1),
        status: z.enum(["active", "paused", "error", "removed"]).default("active"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      product_id: data.productId,
      variant_id: data.variantId ?? null,
      channel_id: data.channelId,
      external_listing_id: data.externalListingId ?? null,
      external_barcode: data.externalBarcode ?? null,
      title: data.title ?? null,
      price: data.price ?? null,
      stock_multiplier: data.stockMultiplier,
      status: data.status,
    };

    if (data.linkId) {
      const { data: updated, error } = await context.supabase
        .from("marketplace_listing_links")
        .update(payload)
        .eq("id", data.linkId)
        .eq("store_id", data.storeId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!updated) throw new Error("İlan bağlantısı güncellenemedi");
      return updated;
    }

    const { data: created, error } = await context.supabase
      .from("marketplace_listing_links")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const deleteListingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), linkId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketplace_listing_links")
      .delete()
      .eq("id", data.linkId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const stockDepletionAnalysisFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(data))
  .handler(async ({ data, context }) => stockDepletionAnalysis(context.supabase, data.storeId, data.days));

export const orderAnalysisFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data, context }) => orderAnalysis(context.supabase, data.storeId, data.from, data.to));

export const productAnalysisFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data, context }) => productAnalysis(context.supabase, data.storeId, data.from, data.to));

export const settlementSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data, context }) => settlementSummary(context.supabase, data.storeId, data.from, data.to));
