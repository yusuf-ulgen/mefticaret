import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper Analitik & İş Zekâsı sunucu uçları. */

const storeId = z.guid();

export const fetchBusinessIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        fromIso: z.string().min(10),
        toIso: z.string().min(10),
        days: z.number().int().min(1).max(730),
        label: z.string().max(60),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { collectBusinessIntelligence } = await import("@/lib/bi.server");
    const { storeId: store, ...range } = data;
    return collectBusinessIntelligence(context.supabase, store, range);
  });

export const saveCostSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        paymentCommissionRate: z.number().min(0).max(30),
        shippingCostPerOrder: z.number().min(0).max(100000),
        packagingCostPerOrder: z.number().min(0).max(100000),
        overheadRate: z.number().min(0).max(90),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveCostSettings } = await import("@/lib/bi.server");
    const { storeId: store, ...input } = data;
    return saveCostSettings({ client: context.supabase, storeId: store, input });
  });

export const addMarketingSpendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        spendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        channel: z.string().trim().min(2).max(40),
        amount: z.number().min(0).max(100_000_000),
        currency: z.string().trim().min(3).max(3),
        impressions: z.number().int().min(0).max(1_000_000_000).optional(),
        clicks: z.number().int().min(0).max(100_000_000).optional(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addMarketingSpend } = await import("@/lib/bi.server");
    const { storeId: store, ...input } = data;
    return addMarketingSpend({ client: context.supabase, storeId: store, input });
  });

export const deleteMarketingSpendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteMarketingSpend } = await import("@/lib/bi.server");
    return deleteMarketingSpend({ client: context.supabase, storeId: data.storeId, id: data.id });
  });
