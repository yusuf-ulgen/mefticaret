import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  claimStoreAccount,
  deleteAddressSchema,
  deleteMyAddress,
  listMyAddresses,
  listMyOrders,
  saveAddressSchema,
  saveMyAddress,
  storeIdSchema,
  updateMyProfile,
  updateProfileSchema,
} from "@/lib/account.server";
import {
  cancelMyReturn,
  cancelReturnSchema,
  createMyReturn,
  createReturnSchema,
  listMyReturns,
} from "@/lib/account-returns.server";
import { reorderMyOrder, reorderSchema } from "@/lib/account-reorder.server";
import { listMyLoyalty } from "@/lib/account-loyalty.server";

export const getMyStoreLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyLoyalty(context.supabase, context.userId, data.storeId));

export const claimMyStoreAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => claimStoreAccount(context.supabase, context.userId, data.storeId));

export const getMyStoreOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyOrders(context.supabase, context.userId, data.storeId));

export const getMyStoreAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyAddresses(context.supabase, context.userId, data.storeId));

export const saveMyStoreAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveAddressSchema.parse(data))
  .handler(async ({ data, context }) => saveMyAddress(context.supabase, context.userId, data));

export const deleteMyStoreAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteAddressSchema.parse(data))
  .handler(async ({ data, context }) => deleteMyAddress(context.supabase, context.userId, data));

export const updateMyStoreProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateProfileSchema.parse(data))
  .handler(async ({ data, context }) => updateMyProfile(context.supabase, context.userId, data));

export const getMyStoreReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyReturns(context.supabase, context.userId, data.storeId));

export const createMyStoreReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createReturnSchema.parse(data))
  .handler(async ({ data, context }) => createMyReturn(context.supabase, context.userId, data));

export const cancelMyStoreReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => cancelReturnSchema.parse(data))
  .handler(async ({ data, context }) => cancelMyReturn(context.supabase, context.userId, data));

export const reorderMyStoreOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => reorderSchema.parse(data))
  .handler(async ({ data, context }) => reorderMyOrder(context.supabase, data));

/** Müşterinin bu mağazadaki iadeleri ve mağaza kredisi bakiyesi. */
export const getMyStoreRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { findMyCustomer } = await import("@/lib/account.server");
    const customer = await findMyCustomer(context.supabase, context.userId, data.storeId);
    if (!customer) return { refunds: [], credit: 0 };
    // Müşteri kaydı oturumdan doğrulandı; iadeler RLS dışında yalnız bu müşterinin siparişleriyle sınırlı okunur.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin
      .from("orders").select("id").eq("store_id", data.storeId).eq("customer_id", customer.id);
    const ids = (orders ?? []).map((o) => o.id);
    const [{ data: refunds }, { data: credits }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("refunds")
            .select("id, order_id, refund_number, amount, currency, status, refund_method, reason, created_at, processed_at")
            .in("order_id", ids).neq("status", "cancelled").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      supabaseAdmin.from("customer_store_credits").select("amount")
        .eq("store_id", data.storeId).eq("customer_id", customer.id),
    ]);
    const credit = (credits ?? []).reduce((s, c) => s + Number(c.amount), 0);
    return { refunds: refunds ?? [], credit: Math.round(credit * 100) / 100 };
  });
