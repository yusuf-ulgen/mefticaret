import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Kolay Panel'deki tahsilat tercihini gerçek vitrin ödeme yöntemlerine yansıtır.
 * "mefpay" → QNBpay altyapısıyla kartla ödeme, "bank_transfer" → IBAN havale talimatı.
 * Tüm yazma işlemleri giriş yapmış kullanıcının RLS bağlamında yapılır.
 */
export async function syncKolayPaymentMethods(
  supabase: SupabaseClient<Database>,
  storeId: string,
  input: { mode: "mefpay" | "bank_transfer"; iban?: string | null; accountHolder?: string | null },
): Promise<void> {
  const { data: connectors } = await supabase
    .from("connectors")
    .select("id, code")
    .in("code", ["mefpay", "bank_transfer"]);

  const byCode = new Map((connectors ?? []).map((row) => [row.code, row.id]));
  const mefpayId = byCode.get("mefpay");
  const bankId = byCode.get("bank_transfer");

  const { data: existing } = await supabase
    .from("store_payment_methods")
    .select("id, connector_id, display_name")
    .eq("store_id", storeId);

  const rows = existing ?? [];
  const findFor = (connectorId: string | undefined) =>
    connectorId ? rows.find((row) => row.connector_id === connectorId) : undefined;

  const ibanText = (input.iban ?? "").replace(/\s/g, "").toUpperCase();
  const holder = (input.accountHolder ?? "").trim();

  const targets: {
    connectorId: string | undefined;
    active: boolean;
    displayName: string;
    instructions: string | null;
    installments: boolean;
  }[] = [
    {
      connectorId: mefpayId,
      active: input.mode === "mefpay",
      displayName: "Kredi / banka kartı (Mefpay)",
      instructions: "Sipariş sonrası güvenli ödeme sayfasında kartınızla ödeyin.",
      installments: true,
    },
    {
      connectorId: bankId,
      active: input.mode === "bank_transfer",
      displayName: "Havale / EFT",
      instructions:
        input.mode === "bank_transfer" && ibanText
          ? `IBAN: ${ibanText}${holder ? ` · Alıcı: ${holder}` : ""} · Açıklamaya sipariş numaranızı yazın.`
          : "Sipariş sonrası IBAN bilgileri paylaşılır.",
      installments: false,
    },
  ];

  for (const target of targets) {
    if (!target.connectorId) continue;
    const current = findFor(target.connectorId);
    if (current) {
      await supabase
        .from("store_payment_methods")
        .update({
          is_active: target.active,
          display_name: target.displayName,
          instructions: target.instructions,
        })
        .eq("id", current.id);
      continue;
    }
    if (!target.active) continue;
    await supabase.from("store_payment_methods").insert({
      store_id: storeId,
      connector_id: target.connectorId,
      display_name: target.displayName,
      instructions: target.instructions,
      is_active: true,
      installments_enabled: target.installments,
    } as never);
  }
}
