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
    };
  });
