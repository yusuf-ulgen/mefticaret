import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  consentInputSchema,
  customerDataSchema,
  dataRequestInputSchema,
  deleteProcessingRecord,
  dsrUpdateSchema,
  eraseCustomerData,
  exportCustomerData,
  listConsentRecords,
  listDataRequests,
  listProcessingRecords,
  listSecurityEvents,
  ropaDeleteSchema,
  ropaSchema,
  saveProcessingRecord,
  storeIdSchema,
  updateDataRequest,
} from "@/lib/compliance.server";

/** Halka açık: çerez/pazarlama rızasını kaydeder. Hız sınırı ve mağaza doğrulaması sunucuda yapılır. */
export const recordConsent = createServerFn({ method: "POST" })
  .inputValidator((data) => consentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { consumeRateLimit, clientIp, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const { publicSupabase } = await import("@/lib/public-supabase.server");
    const { resolvePublishedStoreId } = await import("@/lib/compliance.server");

    const request = getRequest();
    const ip = request ? clientIp(request) : "unknown";
    const gate = await consumeRateLimit(`consent:${ip}`, RATE_LIMITS.consent);
    if (!gate.allowed) throw new Error("Çok fazla istek gönderildi, lütfen sonra tekrar dene.");

    const supabase = publicSupabase();
    const store = await resolvePublishedStoreId(supabase, data.storeSlug);
    if (!store) throw new Error("Mağaza bulunamadı");

    const userAgent = request?.headers.get("user-agent") ?? null;
    const rows = data.consents.map((item) => ({
      store_id: store.id,
      consent_type: item.consentType,
      granted: item.granted,
      policy_version: data.policyVersion,
      source: data.source,
      subject_email: data.subjectEmail ?? null,
      ip,
      user_agent: userAgent,
      meta: { subject_verified: false } as never,
    }));

    // Yazma yalnızca sunucu tarafında (service role) yapılır; ziyaretçi doğrudan tabloya yazamaz.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("consent_records").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, recorded: rows.length };
  });


/** Halka açık: veri sahibi talebi (dışa aktarma / silme / erişim / düzeltme) oluşturur. */
export const submitDataRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => dataRequestInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { consumeRateLimit, clientIp, RATE_LIMITS, recordSecurityEvent } = await import(
      "@/lib/rate-limit.server"
    );
    const { publicSupabase } = await import("@/lib/public-supabase.server");
    const { resolvePublishedStoreId } = await import("@/lib/compliance.server");

    const request = getRequest();
    const ip = request ? clientIp(request) : "unknown";
    const gate = await consumeRateLimit(`dsr:${ip}`, RATE_LIMITS.data_request);
    if (!gate.allowed) throw new Error("Çok fazla talep gönderildi, lütfen bir saat sonra tekrar dene.");

    const supabase = publicSupabase();
    const store = await resolvePublishedStoreId(supabase, data.storeSlug);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { error } = await supabase.from("data_subject_requests").insert({
      store_id: store.id,
      kind: data.kind,
      subject_email: data.subjectEmail,
      reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);

    await recordSecurityEvent({
      storeId: store.id,
      kind: "data_subject_request.created",
      ...(request ? { request } : {}),
      meta: { kind: data.kind },
    });

    return { ok: true };
  });

export const getConsentRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listConsentRecords(context.supabase, data.storeId));

export const getSecurityEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listSecurityEvents(context.supabase, data.storeId));

export const getProcessingRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listProcessingRecords(context.supabase, data.storeId));

export const saveProcessingRecordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ropaSchema.parse(data))
  .handler(async ({ data, context }) => saveProcessingRecord(context.supabase, data));

export const deleteProcessingRecordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ropaDeleteSchema.parse(data))
  .handler(async ({ data, context }) => deleteProcessingRecord(context.supabase, data));

export const getDataRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => listDataRequests(context.supabase, data.storeId));

export const updateDataRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => dsrUpdateSchema.parse(data))
  .handler(async ({ data, context }) => updateDataRequest(context.supabase, context.userId, data));

export const exportCustomerDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => customerDataSchema.parse(data))
  .handler(async ({ data, context }) => exportCustomerData(context.supabase, data));

export const eraseCustomerDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => customerDataSchema.parse(data))
  .handler(async ({ data, context }) => eraseCustomerData(context.supabase, context.userId, data));
