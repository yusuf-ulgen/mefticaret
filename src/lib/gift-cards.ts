/** Hediye kartı / mağaza kredisi için saf yardımcı fonksiyonlar. */

export type GiftCardStatus = "active" | "disabled" | "depleted";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const GIFT_CARD_STATUS_LABELS: Record<GiftCardStatus, string> = {
  active: "Aktif",
  disabled: "Pasif",
  depleted: "Tükendi",
};

export const GIFT_CARD_TX_LABELS: Record<string, string> = {
  issue: "Tanımlama",
  redeem: "Kullanım",
  adjust: "Düzeltme",
  refund: "İade",
};

/** Karışması kolay karakterler (0/O, 1/I) hariç tutulmuş okunabilir kod üretir. */
export function generateGiftCardCode(groups = 3, groupSize = 4): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g += 1) {
    let part = "";
    for (let i = 0; i < groupSize; i += 1) {
      const index = Math.floor(Math.random() * CODE_ALPHABET.length);
      part += CODE_ALPHABET[index];
    }
    parts.push(part);
  }
  return `MEF-${parts.join("-")}`;
}

export function normalizeGiftCardCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type GiftCardLike = {
  status: string;
  balance: number;
  expires_at: string | null;
};

export function isGiftCardUsable(card: GiftCardLike, now = Date.now()): boolean {
  if (card.status !== "active") return false;
  if (Number(card.balance) <= 0) return false;
  if (card.expires_at && new Date(card.expires_at).getTime() < now) return false;
  return true;
}

/** Karttan bu siparişe uygulanabilecek tutar: bakiye ile toplam tutarın küçüğü. */
export function redeemableAmount(balance: number, orderTotal: number): number {
  const value = Math.min(Math.max(0, Number(balance)), Math.max(0, Number(orderTotal)));
  return Math.round(value * 100) / 100;
}

export type GiftCardTotals = {
  count: number;
  issued: number;
  outstanding: number;
  redeemed: number;
};

export function summarizeGiftCards(
  cards: { initial_amount: number; balance: number; status: string }[],
): GiftCardTotals {
  return cards.reduce<GiftCardTotals>(
    (acc, card) => {
      const initial = Number(card.initial_amount ?? 0);
      const balance = Number(card.balance ?? 0);
      acc.count += 1;
      acc.issued += initial;
      acc.redeemed += Math.max(0, initial - balance);
      if (card.status === "active") acc.outstanding += balance;
      return acc;
    },
    { count: 0, issued: 0, outstanding: 0, redeemed: 0 },
  );
}
