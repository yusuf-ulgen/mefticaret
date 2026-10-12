/**
 * Ödenen platform faturalarının QNB'ye otomatik gönderimi (kuyruk işi).
 *
 * Güvenlik: Aynı fatura için daha önce başarısız bir gönderim varsa iş otomatik
 * tekrar denemez; QNB faturayı almış ama yanıt kaybolmuş olabilir (mükerrer fatura riski).
 * Bu durumda Süper Admin durumu kontrol edip elle yeniden gönderir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_STATUS_CHECKS = 12;

export async function runPlatformEinvoiceJob(supabase: SupabaseClient, payload: Record<string, unknown>) {
  const { sendInvoice, queryDocumentStatus } = await import("./einvoice.server");

  if (payload["type"] === "platform_einvoice_status") {
    const documentId = String(payload["documentId"] ?? "");
    const result = await queryDocumentStatus(documentId, null);
    const { data: doc } = await supabase
      .from("einvoice_documents")
      .select("id, status, status_checks, ulasti_mi")
      .eq("id", documentId)
      .maybeSingle();
    const checks = Number(doc?.status_checks ?? 0) + 1;
    await supabase.from("einvoice_documents").update({ status_checks: checks }).eq("id", documentId);
    if (!result.ulastiMi && doc?.status === "sent" && checks < MAX_STATUS_CHECKS) {
      await scheduleStatusCheck(supabase, documentId, checks);
    }
    return { documentId, detail: result.detail, checks };
  }

  const invoiceId = String(payload["invoiceId"] ?? "");
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, status, buyer_tax_id, buyer_title, buyer_tax_office, buyer_address, buyer_district, buyer_city, buyer_email",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error("Fatura bulunamadı");
  if (invoice.status !== "paid") return { skipped: "not_paid" };

  const { data: previous } = await supabase
    .from("einvoice_documents")
    .select("id, status")
    .eq("invoice_id", invoiceId)
    .eq("direction", "outgoing")
    .limit(1)
    .maybeSingle();
  if (previous) return { skipped: `existing_document_${previous.status}` };

  if (!invoice.buyer_tax_id || !invoice.buyer_title || !invoice.buyer_address || !invoice.buyer_city) {
    // Alıcı vergi bilgisi eksikse fatura kesilmez; Süper Admin ekranında "bilgi eksik" görünür.
    return { skipped: "missing_buyer_tax_info" };
  }

  const sent = await sendInvoice(
    {
      invoiceId,
      profile: "AUTO",
      buyerTaxId: invoice.buyer_tax_id,
      buyerTitle: invoice.buyer_title,
      buyerAddress: invoice.buyer_address,
      buyerCity: invoice.buyer_city,
      ...(invoice.buyer_district ? { buyerDistrict: invoice.buyer_district } : {}),
      ...(invoice.buyer_tax_office ? { buyerTaxOffice: invoice.buyer_tax_office } : {}),
      ...(invoice.buyer_email ? { buyerEmail: invoice.buyer_email } : {}),
    } as Parameters<typeof sendInvoice>[0],
    null,
  );

  if (sent.profile === "TEMELFATURA") await scheduleStatusCheck(supabase, sent.documentId, 0);
  return { invoiceId, documentNumber: sent.documentNumber, profile: sent.profile };
}

async function scheduleStatusCheck(supabase: SupabaseClient, documentId: string, checks: number) {
  const delayMinutes = Math.min(5 * 2 ** checks, 360);
  await supabase.from("job_queue").insert({
    kind: "invoice",
    payload: { type: "platform_einvoice_status", documentId },
    priority: 5,
    max_attempts: 1,
    run_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
    dedupe_key: `einvoice-status:${documentId}:${checks}`,
  });
}
