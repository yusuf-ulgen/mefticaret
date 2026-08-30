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

export const claimMyStoreAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => claimStoreAccount(context as never, data.storeId));

export const getMyStoreOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyOrders(context as never, data.storeId));

export const getMyStoreAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listMyAddresses(context as never, data.storeId));

export const saveMyStoreAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveAddressSchema.parse(data))
  .handler(async ({ data, context }) => saveMyAddress(context as never, data));

export const deleteMyStoreAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteAddressSchema.parse(data))
  .handler(async ({ data, context }) => deleteMyAddress(context as never, data));

export const updateMyStoreProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateProfileSchema.parse(data))
  .handler(async ({ data, context }) => updateMyProfile(context as never, data));
