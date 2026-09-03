import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tedarikçi paneli sunucu fonksiyonları. Erişim daima çağıranın kendi
 * tedarikçi kayıtlarıyla (portal_user_id) doğrulanır; ayrıcalıklı istemci
 * yalnızca doğrulama sonrasında ve tedarikçi kimlikleriyle sınırlı kullanılır.
 */

const assertSuppliers = async (supabase: any, userId: string) => {
  const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
  const suppliers = await listPortalSuppliers(supabase, userId);
  if (!suppliers.length) throw new Error("Tedarikçi portal erişiminiz bulunmuyor");
  return suppliers;
};

export const supplierPortalOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const suppliers = await assertSuppliers(supabase, userId);
    const { loadSupplierPortalOrders } = await import("@/lib/supplier-portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orders = await loadSupplierPortalOrders(
      supabaseAdmin as never,
      suppliers.map((supplier) => supplier.id),
      150,
    );
    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        currency: supplier.currency,
        leadTimeDays: supplier.lead_time_days,
      })),
      orders,
    };
  });

export const supplierPortalUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        dropshipOrderId: z.string().uuid(),
        status: z.enum(["accepted", "shipped", "cancelled"]).optional(),
        carrier: z.string().trim().max(80).optional(),
        trackingNumber: z.string().trim().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const suppliers = await assertSuppliers(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("dropship_orders")
      .select("id, supplier_id")
      .eq("id", data.dropshipOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !suppliers.some((supplier) => supplier.id === row.supplier_id)) {
      throw new Error("Sipariş bulunamadı veya yetkiniz yok");
    }

    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.carrier !== undefined) patch["carrier"] = data.carrier || null;
    if (data.trackingNumber !== undefined) patch["tracking_number"] = data.trackingNumber || null;
    if (!Object.keys(patch).length) return { ok: true };

    const { error: updateError } = await supabaseAdmin
      .from("dropship_orders")
      .update(patch)
      .eq("id", data.dropshipOrderId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
