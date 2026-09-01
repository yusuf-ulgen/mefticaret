import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { CONSENT_TYPES, DSR_KINDS, DSR_STATUSES, LEGAL_BASES } from "@/lib/security";

/** KVKK/GDPR sunucu mantığı: rıza kayıtları, veri işleme envanteri, veri sahibi talepleri. */

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

const textList = z.array(z.string().trim().min(1).max(160)).max(40).default([]);

export const consentInputSchema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  consents: z
    .array(
      z.object({
        consentType: z.enum(CONSENT_TYPES),
        granted: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
  subjectEmail: z.string().trim().email().max(200).optional(),
  policyVersion: z.string().trim().max(20).default("v1"),
  source: z.enum(["storefront", "checkout", "account", "admin"]).default("storefront"),
});

export const dataRequestInputSchema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  kind: z.enum(DSR_KINDS),
  subjectEmail: z.string().trim().email().max(200),
  reason: z.string().trim().max(1000).optional(),
});

export const ropaSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid().optional(),
  activity: z.string().trim().min(2).max(200),
  purpose: z.string().trim().min(2).max(1000),
  legalBasis: z.enum(LEGAL_BASES),
  dataCategories: textList,
  dataSubjects: textList,
  recipients: textList,
  retentionPeriod: z.string().trim().max(200).optional(),
  crossBorderTransfer: z.boolean().default(false),
  transferDetails: z.string().trim().max(1000).optional(),
  securityMeasures: z.string().trim().max(1000).optional(),
  responsiblePerson: z.string().trim().max(200).optional(),
});

export const ropaDeleteSchema = z.object({ storeId: z.string().uuid(), id: z.string().uuid() });

export const dsrUpdateSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid(),
  status: z.enum(DSR_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const customerDataSchema = z.object({
  storeId: z.string().uuid(),
  customerId: z.string().uuid(),
});

/** Mağaza slug'ından yayınlanmış mağaza kimliğini çözer (halka açık formlar için). */
export async function resolvePublishedStoreId(supabase: Client, slug: string) {
  const { data, error } = await supabase
    .from("stores")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listConsentRecords(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("consent_records")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listSecurityEvents(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("security_events")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listProcessingRecords(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("data_processing_records")
    .select("*")
    .eq("store_id", storeId)
    .order("activity", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveProcessingRecord(supabase: Client, input: z.infer<typeof ropaSchema>) {
  const row = {
    store_id: input.storeId,
    activity: input.activity,
    purpose: input.purpose,
    legal_basis: input.legalBasis,
    data_categories: input.dataCategories,
    data_subjects: input.dataSubjects,
    recipients: input.recipients,
    retention_period: input.retentionPeriod ?? null,
    cross_border_transfer: input.crossBorderTransfer,
    transfer_details: input.transferDetails ?? null,
    security_measures: input.securityMeasures ?? null,
    responsible_person: input.responsiblePerson ?? null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("data_processing_records")
      .update(row)
      .eq("id", input.id)
      .eq("store_id", input.storeId);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("data_processing_records")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteProcessingRecord(supabase: Client, input: z.infer<typeof ropaDeleteSchema>) {
  const { error } = await supabase
    .from("data_processing_records")
    .delete()
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listDataRequests(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("data_subject_requests")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateDataRequest(
  supabase: Client,
  userId: string,
  input: z.infer<typeof dsrUpdateSchema>,
) {
  const { error } = await supabase
    .from("data_subject_requests")
    .update({
      status: input.status,
      reason: input.note ?? null,
      handled_by: userId,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("store_id", input.storeId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Bir müşterinin mağaza içindeki tüm kişisel verilerini taşınabilir biçimde toplar. */
export async function exportCustomerData(supabase: Client, input: z.infer<typeof customerDataSchema>) {
  const { storeId, customerId } = input;

  const [customer, addresses, orders, consents, requests, reviews, questions] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).eq("store_id", storeId).maybeSingle(),
    supabase.from("customer_addresses").select("*").eq("customer_id", customerId),
    supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, customer_email, customer_name, customer_phone, shipping_address, billing_address, placed_at, order_items(title, sku, quantity, unit_price, total)",
      )
      .eq("store_id", storeId)
      .eq("customer_id", customerId),
    supabase.from("consent_records").select("*").eq("store_id", storeId).eq("customer_id", customerId),
    supabase.from("data_subject_requests").select("*").eq("store_id", storeId).eq("customer_id", customerId),
    supabase.from("product_reviews").select("*").eq("store_id", storeId).eq("customer_id", customerId),
    supabase.from("product_questions").select("*").eq("store_id", storeId).eq("customer_id", customerId),
  ]);

  if (!customer.data) throw new Error("Müşteri bulunamadı");

  return {
    exportedAt: new Date().toISOString(),
    format: "kvkk-gdpr-portability-v1",
    customer: customer.data,
    addresses: addresses.data ?? [],
    orders: orders.data ?? [],
    consents: consents.data ?? [],
    dataRequests: requests.data ?? [],
    reviews: reviews.data ?? [],
    questions: questions.data ?? [],
  };
}

/**
 * Müşteri verisini siler. Sipariş kayıtları vergi mevzuatı gereği saklanır;
 * kimliği belirleyen alanlar anonimleştirilir.
 */
export async function eraseCustomerData(
  supabase: Client,
  userId: string,
  input: z.infer<typeof customerDataSchema>,
) {
  const { storeId, customerId } = input;

  const { data: customer, error: readError } = await supabase
    .from("customers")
    .select("id, email")
    .eq("id", customerId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!customer) throw new Error("Müşteri bulunamadı");

  const anonymousTag = `silindi-${customerId.slice(0, 8)}`;

  await supabase.from("customer_addresses").delete().eq("customer_id", customerId);
  await supabase
    .from("orders")
    .update({
      customer_email: `${anonymousTag}@anonim.local`,
      customer_name: "Silinmiş müşteri",
      customer_phone: null,
      shipping_address: {} as never,
      billing_address: {} as never,
    })
    .eq("store_id", storeId)
    .eq("customer_id", customerId);
  await supabase.from("product_reviews").update({ author_name: "Anonim" }).eq("store_id", storeId).eq("customer_id", customerId);
  await supabase.from("product_questions").update({ author_name: "Anonim" }).eq("store_id", storeId).eq("customer_id", customerId);

  const { error } = await supabase
    .from("customers")
    .update({
      full_name: "Silinmiş müşteri",
      email: `${anonymousTag}@anonim.local`,
      phone: null,
      notes: null,
      tags: [],
      accepts_marketing: false,
    })
    .eq("id", customerId)
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    store_id: storeId,
    actor_id: userId,
    action: "customer.erased",
    entity: "customer",
    entity_id: customerId,
    new_value: { anonymized: true } as never,
  });

  return { ok: true };
}
