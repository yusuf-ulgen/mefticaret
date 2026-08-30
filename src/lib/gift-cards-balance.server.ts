import { normalizeGiftCardCode, isGiftCardUsable } from "@/lib/gift-cards";

/** Vitrin tarafı hediye kartı bakiye sorgusu. Sadece maskeli, güvenli alanlar döner. */
export type GiftCardBalanceResult = {
  found: boolean;
  code?: string;
  balance?: number;
  currency?: string;
  usable?: boolean;
  status?: string;
  expiresAt?: string | null;
  reason?: string;
};

export function maskGiftCardCode(code: string): string {
  const normalized = normalizeGiftCardCode(code);
  if (normalized.length <= 4) return normalized;
  return `${"•".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export async function lookupGiftCardBalance(
  storeSlug: string,
  rawCode: string,
): Promise<GiftCardBalanceResult> {
  const code = normalizeGiftCardCode(rawCode);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id, currency, status")
    .eq("slug", storeSlug)
    .maybeSingle();
  if (!store || store.status !== "active") return { found: false, reason: "Mağaza bulunamadı" };

  const { data: card } = await supabaseAdmin
    .from("gift_cards")
    .select("code, balance, currency, status, expires_at")
    .eq("store_id", store.id)
    .eq("code", code)
    .maybeSingle();
  if (!card) return { found: false, reason: "Bu koda ait bir hediye kartı bulunamadı" };

  const usable = isGiftCardUsable({
    status: card.status,
    balance: Number(card.balance),
    expires_at: card.expires_at,
  } as never);

  return {
    found: true,
    code: maskGiftCardCode(card.code),
    balance: Number(card.balance),
    currency: card.currency,
    status: card.status,
    expiresAt: card.expires_at,
    usable,
    reason: usable
      ? undefined
      : Number(card.balance) <= 0
        ? "Kart bakiyesi tükenmiş"
        : card.expires_at && new Date(card.expires_at) < new Date()
          ? "Kartın son kullanma tarihi geçmiş"
          : "Kart şu anda kullanılamıyor",
  };
}
