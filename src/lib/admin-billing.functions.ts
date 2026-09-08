import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper admin: Ödeal ödeme sağlayıcısı durumu ile platform faturalarının tahsilat takibi. */

export type OdealSettingsView = {
  configured: boolean;
  environment: "sandbox" | "live";
  callbackUrl: string;
};

export type PlatformInvoiceRow = {
  id: string;
  invoiceNumber: string;
  storeId: string;
  storeName: string;
  status: string;
  total: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
  payUrl: string | null;
};

async function guard(supabase: unknown, userId: string) {
  const mod = await import("@/lib/platform-admin.server");
  await mod.assertPlatformAdmin(supabase as never, userId);
}

export const fetchOdealSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OdealSettingsView> => {
    await guard(context.supabase, context.userId);
    const odeal = await import("@/lib/odeal.server");
    return {
      configured: odeal.isOdealConfigured(),
      environment: odeal.odealEnvironment(),
      callbackUrl: odeal.odealReturnUrl(),
    };
  });

export const testOdealConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    await guard(context.supabase, context.userId);
    const odeal = await import("@/lib/odeal.server");
    if (!odeal.isOdealConfigured()) {
      return { ok: false, message: "Ödeal müşteri numarası ve gizli anahtarı henüz kaydedilmemiş." };
    }
    try {
      await odeal.verifyOdealCredentials();
      return { ok: true, message: `Bağlantı başarılı (${odeal.odealEnvironment() === "live" ? "canlı" : "test"} ortamı).` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Bağlantı kurulamadı." };
    }
  });

export const fetchPlatformInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(["all", "draft", "open", "paid", "uncollectible", "void"]).default("all"),
        search: z.string().trim().max(120).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<PlatformInvoiceRow[]> => {
    await guard(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { payUrl } = await import("@/lib/billing-lifecycle.server");

    let query = supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, status, total, currency, due_at, paid_at, pay_token, store_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: invoices, error } = await query;
    if (error) throw new Error(error.message);

    const storeIds = [...new Set((invoices ?? []).map((row) => row.store_id))];
    const { data: stores } = storeIds.length
      ? await supabaseAdmin.from("stores").select("id, name").in("id", storeIds)
      : { data: [] as { id: string; name: string }[] };
    const names = new Map((stores ?? []).map((store) => [store.id, store.name]));

    const rows = (invoices ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      storeId: row.store_id,
      storeName: names.get(row.store_id) ?? "Mağaza",
      status: String(row.status),
      total: Number(row.total ?? 0),
      currency: row.currency ?? "TRY",
      dueAt: row.due_at ?? null,
      paidAt: row.paid_at ?? null,
      payUrl: row.pay_token ? payUrl(row.pay_token) : null,
    }));

    const needle = data.search?.toLocaleLowerCase("tr");
    return needle
      ? rows.filter((row) =>
          `${row.invoiceNumber} ${row.storeName} ${row.status}`.toLocaleLowerCase("tr").includes(needle),
        )
      : rows;
  });

/** Banka havalesi gibi manuel tahsilatlarda faturayı ödendi işaretler ve mağazayı açar. */
export const markInvoicePaidManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ invoiceId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await guard(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { restoreAfterPayment } = await import("@/lib/billing-lifecycle.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.invoiceId)
      .select("store_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Fatura bulunamadı.");

    await restoreAfterPayment(supabaseAdmin, invoice.store_id);
    const { insertAuditRow } = await import("@/lib/audit.server");
    await insertAuditRow(supabaseAdmin, {
      store_id: invoice.store_id,
      actor_id: context.userId,
      action: "platform.invoice_manual_paid",
      entity: "invoices",
      entity_id: data.invoiceId,
    });
    return { ok: true };
  });
