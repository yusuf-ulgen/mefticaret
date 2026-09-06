import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/** Platform yönetim fonksiyonları: mağaza durumu ve paket tanımları (RLS + rol kontrolü). */

const storeStatusSchema = z.object({
  storeId: z.guid(),
  status: z.enum(["draft", "active", "suspended", "archived"]),
});

const planSchema = z.object({
  id: z.guid().optional(),
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, "Kod yalnızca küçük harf, rakam, tire ve alt çizgi içerebilir"),
  name: z.string().min(2).max(80),
  description: z.string().max(400).nullable().optional(),
  priceMonthly: z.number().min(0).max(1_000_000),
  priceYearly: z.number().min(0).max(10_000_000),
  commissionRate: z.number().min(0).max(0.5),
  trialDays: z.number().int().min(0).max(365),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  limits: z.record(z.string(), z.number()).default({}),
});

export const setStoreStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, status")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { error: updateError } = await supabase
      .from("stores")
      .update({ status: data.status })
      .eq("id", data.storeId);
    if (updateError) throw new Error(updateError.message);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "platform.store_status_changed",
      entity: "stores",
      entity_id: data.storeId,
      old_value: { status: store.status },
      new_value: { status: data.status },
    });

    return { storeId: data.storeId, status: data.status };
  });

export const savePlatformPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => planSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");

    const payload = {
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price_monthly: data.priceMonthly,
      price_yearly: data.priceYearly,
      commission_rate: data.commissionRate,
      trial_days: data.trialDays,
      is_active: data.isActive,
      sort_order: data.sortOrder,
      limits: data.limits,
    };

    if (data.id) {
      const { error } = await supabase.from("plans").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("plans").insert(payload);
      if (error) throw new Error(error.message);
    }

    await insertAuditRow(supabase, {
      actor_id: userId,
      action: data.id ? "platform.plan_updated" : "platform.plan_created",
      entity: "plans",
      entity_id: data.id ?? data.code,
      new_value: payload,
    });

    return { code: data.code };
  });
