import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Paket satın alma tahsilat bağlantısı (fiyat yalnızca sunucuda belirlenir). */
export const startPlanCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        planId: z.guid(),
        billingInterval: z.enum(["monthly", "yearly"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { startPlanCheckout } = await import("@/lib/plan-checkout.server");
    return startPlanCheckout(context.supabase, data, context.userId);
  });
