import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appPriceSchema,
  chargeItemSchema,
  completeSchema,
  confirmSchema,
  createChargeLinkSchema,
  installmentQuerySchema,
  planPriceSchema,
  qnbpaySettingsSchema,
  refundSchema,
  transactionIdSchema,
} from "@/lib/qnbpay-schemas";

/** QNBpay POS yönetimi — tüm uçlar yalnızca platform yöneticisine açıktır. */

async function guard(supabase: unknown, userId: string) {
  const mod = await import("@/lib/platform-admin.server");
  await mod.assertPlatformAdmin(supabase as never, userId);
}

export const fetchQnbpayOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.loadOverview();
  });

export const saveQnbpaySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => qnbpaySettingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.saveSettings(data, context.userId);
  });

export const testQnbpayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.testConnection();
  });

export const fetchQnbpayInstallments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => installmentQuerySchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.listInstallments(data);
  });

export const fetchQnbpayCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ currency: z.enum(["TRY", "USD", "EUR"]).default("TRY") }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.loadCommissions(data.currency);
  });

export const createQnbpayChargeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createChargeLinkSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.createChargeLink(data, context.userId);
  });

export const fetchQnbpayTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z
          .enum([
            "all",
            "pending",
            "preauth",
            "completed",
            "failed",
            "cancelled",
            "refunded",
            "partial_refunded",
          ])
          .default("all"),
        purpose: z
          .enum(["all", "plan", "theme", "app", "commission", "invoice", "other"])
          .default("all"),
        search: z.string().trim().max(120).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.listTransactions(data);
  });

export const queryQnbpayStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => transactionIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.queryTransactionStatus(data.transactionId, context.userId);
  });

export const completeQnbpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.completeTransaction(data, context.userId);
  });

export const confirmQnbpayPreAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => confirmSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.confirmPreAuth(data, context.userId);
  });

export const refundQnbpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => refundSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.refundTransaction(data, context.userId);
  });

export const fetchPlatformPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.loadPricing();
  });

export const savePlanPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => planPriceSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.savePlanPrice(data, context.userId);
  });

export const saveAppPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => appPriceSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.saveAppPrice(data, context.userId);
  });

export const saveChargeItemPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chargeItemSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.saveChargeItem(data, context.userId);
  });

export const deleteChargeItemPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const mod = await import("@/lib/qnbpay-admin.server");
    return mod.deleteChargeItem(data.id, context.userId);
  });
