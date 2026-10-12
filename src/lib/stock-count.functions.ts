import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const applyStockCountRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        reason: z.string().trim().max(200).optional(),
        rows: z
          .array(
            z.object({
              key: z.string().trim().min(1).max(80),
              counted: z.number().int().min(0).max(1_000_000),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { applyStockCount } = await import("@/lib/stock-count.server");

    const { data: store, error } = await supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    return applyStockCount(
      supabase as never,
      data.storeId,
      userId,
      data.rows,
      data.reason?.length ? data.reason : null,
    );
  });
