import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recipientSchema, sendSchema, settingsSchema, statusSchema } from "@/lib/einvoice-schemas";

/**
 * QNB eSolutions e-fatura sunucu fonksiyonları.
 *
 * Her çağrıda oturum doğrulanır ve ardından veritabanından `platform_admin`
 * rolü kontrol edilir; mağaza satıcıları bu uçlara erişemez.
 */

async function assertAdmin(supabase: unknown, userId: string) {
  const guard = await import("@/lib/platform-admin.server");
  await guard.assertPlatformAdmin(supabase as never, userId);
}

export const getEinvoiceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadOverview } = await import("@/lib/einvoice.server");
    return loadOverview();
  });

export const saveEinvoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveSettings } = await import("@/lib/einvoice.server");
    return saveSettings(data, context.userId);
  });

export const testEinvoiceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { testConnection } = await import("@/lib/einvoice.server");
    return testConnection(context.userId);
  });

export const sendEinvoiceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sendInvoice } = await import("@/lib/einvoice.server");
    return sendInvoice(data, context.userId);
  });
