import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Stok tahmini, teslim noktaları ve RFQ masası sunucu uçları. */

const storeId = z.guid();

export const fetchStockForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, windowDays: z.number().int().min(7).max(120).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { forecastStockDepletion } = await import("@/lib/retail-ops.server");
    return forecastStockDepletion(context.supabase, data.storeId, data.windowDays ?? 30);
  });

export const fetchPickupLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listPickupLocations } = await import("@/lib/retail-ops.server");
    return listPickupLocations(context.supabase, data.storeId);
  });

export const savePickupLocationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        name: z.string().trim().min(2).max(120),
        addressLine: z.string().trim().min(3).max(300),
        city: z.string().trim().min(2).max(80),
        phone: z.string().trim().max(40).optional(),
        openingHours: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(500).optional(),
        isActive: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { savePickupLocation } = await import("@/lib/retail-ops.server");
    const { storeId: store, ...input } = data;
    return savePickupLocation({
      client: context.supabase,
      storeId: store,
      userId: context.userId,
      input,
    });
  });

export const deletePickupLocationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deletePickupLocation } = await import("@/lib/retail-ops.server");
    return deletePickupLocation({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      id: data.id,
    });
  });

/** Vitrin: mağazadan teslim noktaları (aktif olanlar). */
export const fetchStorefrontPickupLocations = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ storeSlug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listActivePickupLocations } = await import("@/lib/retail-ops.server");
    return listActivePickupLocations(supabaseAdmin as never, data.storeSlug);
  });

export const fetchRfqDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listRfqDesk } = await import("@/lib/retail-ops.server");
    return listRfqDesk(context.supabase, data.storeId);
  });

export const replyToRfqFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        rfqId: z.guid(),
        body: z.string().trim().min(1).max(4000),
        quotedTotal: z.number().min(0).max(100000000).optional(),
        status: z.enum(["new", "quoted", "won", "lost"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { replyToRfq } = await import("@/lib/retail-ops.server");
    return replyToRfq({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      rfqId: data.rfqId,
      body: data.body,
      ...(typeof data.quotedTotal === "number" ? { quotedTotal: data.quotedTotal } : {}),
      ...(data.status ? { status: data.status } : {}),
    });
  });
