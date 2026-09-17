import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/** Abonelik sunucu fonksiyonu: paket değişimi (RLS ile yetki kontrolü + audit kaydı). */

export const changeStorePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), planId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, code, name, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan || !plan.is_active) throw new Error("Paket bulunamadı veya aktif değil");

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, plan_id, store_kind")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
    if (store.store_kind === "micro") throw new Error("Kolay Panel kurumsal paketlere bağlı değildir");

    const { error: updateError } = await supabase
      .from("stores")
      .update({ plan_id: plan.id })
      .eq("id", data.storeId);
    if (updateError) throw new Error(updateError.message);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "store.plan_changed",
      entity: "stores",
      entity_id: data.storeId,
      old_value: { plan_id: store.plan_id },
      new_value: { plan_id: plan.id, plan_code: plan.code },
    });

    return { planId: plan.id, planName: plan.name };
  });
