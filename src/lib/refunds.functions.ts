import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createRefundSchema } from "@/lib/refund-schema";

export const getOrderRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), orderId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { orderRefundOverview } = await import("@/lib/refunds.server");
    return orderRefundOverview(context.supabase, data.storeId, data.orderId);
  });

export const createOrderRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createRefundSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { createAndProcessRefund } = await import("@/lib/refunds.server");
    return createAndProcessRefund(context.supabase, context.userId, data);
  });

const refundRef = z.object({ storeId: z.guid(), refundId: z.guid() });

export const retryOrderRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => refundRef.parse(d))
  .handler(async ({ data, context }) => {
    const { retryRefund } = await import("@/lib/refunds.server");
    return retryRefund(context.supabase, context.userId, data.storeId, data.refundId);
  });

export const cancelOrderRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => refundRef.parse(d))
  .handler(async ({ data, context }) => {
    const { cancelRefund } = await import("@/lib/refunds.server");
    return cancelRefund(context.supabase, context.userId, data.storeId, data.refundId);
  });
