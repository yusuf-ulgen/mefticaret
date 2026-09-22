/**
 * Ücretli tema lisansı satın alma — tahsilat QNBpay üzerinden yapılır.
 * Fiyat yalnızca sunucudaki `themes` tablosundan okunur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { recordAudit } from "@/lib/audit.server";

type Admin = SupabaseClient<Database>;

type ThemeTransaction = {
  id: string;
  store_id: string | null;
  request_summary: unknown;
};

/** Tema lisansı için ödeme bağlantısı üretir. */
export async function startThemeLicenseCheckout(
  supabase: SupabaseClient<Database>,
  input: { storeId: string; themeId: string },
  userId: string,
): Promise<{ link: string; amount: number; currency: string; themeName: string }> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, input.storeId, userId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Admin;

  const { data: theme, error } = await db
    .from("themes")
    .select("id, slug, name, price, currency, is_active")
    .eq("id", input.themeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!theme || !theme.is_active) throw new Error("Tema bulunamadı");

  const amount = Number(theme.price);
  if (!(amount > 0)) throw new Error("Bu tema ücretsiz — ödeme gerekmiyor.");

  const { data: alreadyPaid } = await db
    .from("store_theme_purchases")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("theme_id", theme.id)
    .eq("status", "paid")
    .limit(1);
  if (alreadyPaid?.length) throw new Error("Bu temanın lisansı zaten alınmış.");

  const currency = (["TRY", "USD", "EUR"] as const).includes((theme.currency ?? "TRY") as "TRY")
    ? ((theme.currency ?? "TRY") as "TRY" | "USD" | "EUR")
    : "TRY";

  const { data: store } = await db.from("stores").select("name").eq("id", input.storeId).maybeSingle();
  const buyer = (store?.name ?? "Mefticaret").trim().split(" ");

  const { createChargeLink } = await import("@/lib/qnbpay-admin.server");
  const result = await createChargeLink(
    {
      purpose: "other",
      amount,
      currency,
      description: `${theme.name} tema lisansı`,
      buyerName: buyer[0] || "Mefticaret",
      buyerSurname: buyer.slice(1).join(" ") || "Magaza",
      storeId: input.storeId,
    },
    userId,
  );

  await db
    .from("qnbpay_transactions")
    .update({
      request_summary: {
        purpose: "theme_license",
        themeId: theme.id,
        themeSlug: theme.slug,
        storeId: input.storeId,
      } as never,
    })
    .eq("id", result.id);

  await db.from("store_theme_purchases").insert({
    store_id: input.storeId,
    theme_id: theme.id,
    amount,
    currency,
    status: "pending",
    transaction_id: result.id,
    created_by: userId,
  });

  return { link: result.link, amount, currency, themeName: theme.name };
}

/** Ödemesi onaylanan tema lisansını mağazaya tanımlar ve temayı kurar. */
export async function fulfillThemeLicense(
  db: Admin,
  transaction: ThemeTransaction,
): Promise<{ handled: boolean }> {
  const summary = (transaction.request_summary ?? {}) as Record<string, unknown>;
  const storeId = transaction.store_id;
  const themeId = typeof summary["themeId"] === "string" ? summary["themeId"] : null;
  if (!storeId || !themeId) return { handled: false };

  const { data: purchase } = await db
    .from("store_theme_purchases")
    .select("id, status")
    .eq("transaction_id", transaction.id)
    .maybeSingle();
  if (purchase?.status === "paid") return { handled: true };

  if (purchase) {
    await db
      .from("store_theme_purchases")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", purchase.id);
  }

  /* Lisans alınınca tema otomatik kurulur; aktifleştirme satıcıya bırakılır. */
  await db
    .from("store_installed_themes")
    .upsert({ store_id: storeId, theme_id: themeId }, { onConflict: "store_id,theme_id" });

  const { data: theme } = await db.from("themes").select("name").eq("id", themeId).maybeSingle();

  await db.rpc("emit_notification", {
    _store_id: storeId,
    _kind: "billing",
    _title: `${theme?.name ?? "Tema"} lisansı alındı`,
    _message: "Tema mağazanıza kuruldu, tema mağazasından aktifleştirebilirsiniz.",
    _entity: "store_theme_purchases",
    _entity_id: purchase?.id ?? transaction.id,
    _meta: { themeId, provider: "qnbpay" },
  } as never);

  await recordAudit(db as never, {
    action: "theme.license.settled",
    actorId: null,
    entity: "qnbpay_transactions",
    entityId: transaction.id,
    newValue: { themeId },
    storeId,
  });

  return { handled: true };
}
