import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Yük testi orkestratörü sunucu fonksiyonları — yalnızca platform yöneticileri. */

async function assertAdmin(supabase: unknown, userId: string) {
  const admin = await import("@/lib/platform-admin.server");
  await admin.assertPlatformAdmin(supabase as never, userId);
}

export const fetchLoadTestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const loadtest = await import("@/lib/loadtest.server");
    return loadtest.loadTestStatus();
  });

export const saveLoadTestConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        paused: z.boolean().optional(),
        cycleMinutes: z.number().int().min(15).max(1440).optional(),
        storesTarget: z.number().int().min(1).max(5000).optional(),
        productsTarget: z.number().int().min(1).max(200_000).optional(),
        vusersTarget: z.number().int().min(1).max(20_000).optional(),
        ordersTarget: z.number().int().min(1).max(50_000).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const loadtest = await import("@/lib/loadtest.server");
    return loadtest.updateLoadTestConfig(data);
  });

/** Turu elle bir adım ilerletir (panelden "şimdi çalıştır"). */
export const stepLoadTestCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const loadtest = await import("@/lib/loadtest.server");
    return loadtest.advanceLoadTestCycle();
  });

export const stopLoadTestSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cleanup: z.boolean().default(true) }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const loadtest = await import("@/lib/loadtest.server");
    return loadtest.stopLoadTest(data.cleanup);
  });
