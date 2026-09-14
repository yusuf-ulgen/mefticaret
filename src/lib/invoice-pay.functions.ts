import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Ödeme linki: jeton ile fatura özetini döndürür (kimlik doğrulaması gerekmez, veri asgari tutulur). */

export type PublicInvoice = {
  invoiceNumber: string;
  status: string;
  total: number;
  currency: string;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  storeName: string;
  storeId: string;
  storeStatus: string;
  cardPaymentEnabled: boolean;
};


export const getInvoiceByToken = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ token: z.string().min(16).max(64).regex(/^[a-f0-9]+$/) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicInvoice | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("invoice_number, status, total, currency, due_at, issued_at, paid_at, store_id")
      .eq("pay_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) return null;

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name, status")
      .eq("id", invoice.store_id)
      .maybeSingle();

    const { cardPaymentAvailable } = await import("@/lib/qnbpay-admin.server");

    return {
      invoiceNumber: invoice.invoice_number,
      status: String(invoice.status),
      total: Number(invoice.total ?? 0),
      currency: invoice.currency ?? "TRY",
      dueAt: invoice.due_at ?? null,
      issuedAt: invoice.issued_at ?? null,
      paidAt: invoice.paid_at ?? null,
      storeName: store?.name ?? "Mağaza",
      storeId: store?.id ?? invoice.store_id,
      storeStatus: String(store?.status ?? "active"),
      cardPaymentEnabled: isOdealConfigured(),
    };
  });

/** Fatura için Ödeal üzerinden tek kullanımlık kart ödeme linki oluşturur. */
export const startInvoiceCardPayment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string().min(16).max(64).regex(/^[a-f0-9]+$/) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ checkoutUrl: string }> => {
    const [{ supabaseAdmin }, odeal] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/odeal.server"),
    ]);

    if (!odeal.isOdealConfigured()) {
      throw new Error("Kart ile ödeme şu anda kullanılamıyor.");
    }

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, status, total, currency, store_id")
      .eq("pay_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Ödeme linki geçersiz.");
    if (invoice.status === "paid") throw new Error("Bu fatura zaten ödendi.");

    const amount = Number(invoice.total ?? 0);
    if (!(amount > 0)) throw new Error("Fatura tutarı geçersiz.");

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .eq("id", invoice.store_id)
      .maybeSingle();

    const externalId = `${invoice.invoice_number}-${Date.now().toString(36)}`;
    const created = await odeal.createPayByLink({
      amount,
      externalId,
      currency: invoice.currency ?? "TRY",
      buyerName: store?.name ?? null,
    });


    await supabaseAdmin.from("invoice_payments").insert({
      invoice_id: invoice.id,
      store_id: invoice.store_id,
      provider: "odeal",
      environment: odeal.odealEnvironment(),
      external_id: externalId,
      provider_payment_id: created.paymentId,
      status: "PENDING",
      amount,
      currency: invoice.currency ?? "TRY",
      checkout_url: created.checkoutUrl,
    });

    return { checkoutUrl: created.checkoutUrl };
  });

