import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  downloadSchema,
  inboxDownloadSchema,
  inboxSyncSchema,
  recipientSchema,
  sendSchema,
  settingsSchema,
  statusSchema,
} from "@/lib/einvoice-schemas";

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

/** Akış adımı 1: alıcı e-fatura mükellefi mi? */
export const checkEinvoiceRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recipientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { checkRecipient } = await import("@/lib/einvoice.server");
    return checkRecipient(data.taxId);
  });

/** Akış adımı 3: gönderilen belgenin durumu sorgulanır. */
export const queryEinvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { queryDocumentStatus } = await import("@/lib/einvoice.server");
    return queryDocumentStatus(data.documentId, context.userId);
  });

/** Giden belgeyi PDF/HTML/UBL olarak indirir (base64 .zip döner). */
export const downloadEinvoiceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => downloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { downloadOutgoingDocument } = await import("@/lib/einvoice.server");
    return downloadOutgoingDocument(data.documentId, data.format, context.userId);
  });

/** Gelen e-Faturaları servisten çeker. */
export const syncEinvoiceInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inboxSyncSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { syncInbox } = await import("@/lib/einvoice.server");
    return syncInbox(data.fromSequence ?? null, context.userId);
  });

/** Gelen faturayı ETTN ile indirir. */
export const downloadEinvoiceInboxDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inboxDownloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { downloadInboxDocument } = await import("@/lib/einvoice.server");
    return downloadInboxDocument(data.ettn, data.format, context.userId);
  });
