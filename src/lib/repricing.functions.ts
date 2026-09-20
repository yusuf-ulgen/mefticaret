import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Otomatik yeniden fiyatlama sunucu uçları (mantık repricing.server.ts içinde). */

const storeId = z.guid();

const strategy = z.enum(["match", "undercut_amount", "undercut_percent", "premium_percent"]);
const rounding = z.enum([
  "none",
  "nearest_0_01",
  "nearest_0_05",
  "nearest_0_10",
  "nearest_1",
  "nearest_5",
  "nearest_10",
  "psych_99",
  "psych_95",
  "psych_90",
]);

export const fetchRepricingRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listRepricingRules } = await import("@/lib/repricing.server");
    return listRepricingRules(context.supabase, data.storeId);
  });

export const fetchRepricingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listRepricingEvents } = await import("@/lib/repricing.server");
    return listRepricingEvents(context.supabase, data.storeId);
  });

export const saveRepricingRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        productId: z.guid().nullish(),
        name: z.string().trim().min(2).max(120),
        isActive: z.boolean(),
        strategy,
        value: z.number().min(0).max(1000000),
        minMarginPct: z.number().min(0).max(95),
        floorPrice: z.number().min(0).max(100000000).nullish(),
        ceilingPrice: z.number().min(0).max(100000000).nullish(),
        maxChangePct: z.number().min(0).max(90),
        rounding,
        autoApply: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveRepricingRule } = await import("@/lib/repricing.server");
    const { storeId: store, ...input } = data;
    return saveRepricingRule({
      client: context.supabase,
      storeId: store,
      userId: context.userId,
      input,
    });
  });

export const deleteRepricingRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteRepricingRule } = await import("@/lib/repricing.server");
    return deleteRepricingRule({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      id: data.id,
    });
  });

export const runRepricingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, apply: z.boolean().default(false), ruleId: z.guid().nullish() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { runRepricing } = await import("@/lib/repricing.server");
    return runRepricing({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      apply: data.apply,
      ruleId: data.ruleId ?? null,
    });
  });
