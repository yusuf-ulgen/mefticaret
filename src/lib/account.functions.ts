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
