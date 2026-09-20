import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Abonelik ticareti, mağaza cüzdanı ve akıllı sipariş bölme sunucu uçları. */

const storeId = z.guid();

export const fetchSubscriptionPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listSubscriptionPlans } = await import("@/lib/retention.server");
    return listSubscriptionPlans(context.supabase, data.storeId);
  });

export const saveSubscriptionPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        productId: z.guid().nullish(),
        name: z.string().trim().min(2).max(120),
        intervalDays: z.number().int().min(1).max(365),
        discountPercent: z.number().min(0).max(90),
        minCycles: z.number().int().min(1).max(36),
        isActive: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveSubscriptionPlan } = await import("@/lib/retention.server");
    const { storeId: store, ...input } = data;
    return saveSubscriptionPlan({ client: context.supabase, storeId: store, input });
  });

export const deleteSubscriptionPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteSubscriptionPlan } = await import("@/lib/retention.server");
    return deleteSubscriptionPlan({ client: context.supabase, storeId: data.storeId, id: data.id });
  });

export const enrollSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        customerId: z.guid(),
        planId: z.guid(),
        quantity: z.number().int().min(1).max(999),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { enrollCustomerSubscription } = await import("@/lib/retention.server");
    const { storeId: store, ...input } = data;
    return enrollCustomerSubscription({ client: context.supabase, storeId: store, input });
  });

export const setSubscriptionStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, id: z.guid(), status: z.enum(["active", "paused", "canceled"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { setSubscriptionStatus } = await import("@/lib/retention.server");
    return setSubscriptionStatus({
      client: context.supabase,
      storeId: data.storeId,
      id: data.id,
      status: data.status,
    });
  });

export const fetchWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listWallets } = await import("@/lib/retention.server");
    return listWallets(context.supabase, data.storeId);
  });

export const addWalletTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        customerId: z.guid(),
        kind: z.enum(["topup", "spend", "refund", "adjustment"]),
        amount: z.number().min(-1_000_000).max(1_000_000),
        note: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { addWalletTransaction } = await import("@/lib/retention.server");
    const { storeId: store, ...input } = data;
    return addWalletTransaction({
      client: context.supabase,
      storeId: store,
      userId: context.userId,
      input,
    });
  });

export const simulateOrderSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        destinationCountry: z.string().trim().min(2).max(40),
        lines: z.array(z.object({ productId: z.guid(), quantity: z.number().int().min(1).max(999) })).min(1).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { simulateOrderSplit } = await import("@/lib/retention.server");
    return simulateOrderSplit({
      client: context.supabase,
      storeId: data.storeId,
      lines: data.lines,
      destinationCountry: data.destinationCountry,
    });
  });
