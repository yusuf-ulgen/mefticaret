/** Hediye kartı analitiği: yükümlülük (liability), kullanım hızı ve breakage analizi. */

export type GiftCardRecord = {
  id: string;
  code: string;
  status: string;
  initialAmount: number;
  balance: number;
  createdAt: string;
  expiresAt: string | null;
};

export type GiftTxRecord = {
  id: string;
  giftCardId: string;
  kind: string;
  amount: number;
  createdAt: string;
};

export type GiftLiabilitySummary = {
  cards: number;
  issuedAmount: number;
  redeemedAmount: number;
  /** Kullanılmayı bekleyen bakiye toplamı = yükümlülük */
  outstanding: number;
  /** Kullanım oranı (%) */
  redemptionRate: number;
  /** Hiç kullanılmamış kart sayısı */
  untouched: number;
  /** Tamamen tükenmiş kart sayısı */
  depleted: number;
  /** Süresi geçmiş kartlarda kalan bakiye (breakage) */
  expiredBalance: number;
  /** 30 gün içinde süresi dolacak bakiye */
  expiringSoon: number;
  averageCardValue: number;
};

const DAY = 1000 * 60 * 60 * 24;

export function giftLiabilitySummary(
  cards: GiftCardRecord[],
  now = Date.now(),
): GiftLiabilitySummary {
  const issuedAmount = cards.reduce((sum, card) => sum + card.initialAmount, 0);
  const outstandingAll = cards.reduce((sum, card) => sum + card.balance, 0);
  const redeemedAmount = Math.max(0, issuedAmount - outstandingAll);

  let expiredBalance = 0;
  let expiringSoon = 0;
  let untouched = 0;
  let depleted = 0;
  let outstanding = 0;

  for (const card of cards) {
    if (card.balance >= card.initialAmount && card.initialAmount > 0) untouched += 1;
    if (card.balance <= 0) depleted += 1;

    const expiry = card.expiresAt ? new Date(card.expiresAt).getTime() : null;
    if (expiry && expiry < now) {
      expiredBalance += card.balance;
      continue;
    }
    outstanding += card.balance;
    if (expiry && expiry - now <= 30 * DAY) expiringSoon += card.balance;
  }

  return {
    cards: cards.length,
    issuedAmount,
    redeemedAmount,
    outstanding,
    redemptionRate: issuedAmount > 0 ? (redeemedAmount / issuedAmount) * 100 : 0,
    untouched,
    depleted,
    expiredBalance,
    expiringSoon,
    averageCardValue: cards.length ? issuedAmount / cards.length : 0,
  };
}

export type GiftMonthlyPoint = {
  month: string;
  issued: number;
  redeemed: number;
  net: number;
};

export function monthlyFlow(transactions: GiftTxRecord[]): GiftMonthlyPoint[] {
  const map = new Map<string, { issued: number; redeemed: number }>();

  for (const tx of transactions) {
    const month = tx.createdAt.slice(0, 7);
    const entry = map.get(month) ?? { issued: 0, redeemed: 0 };
    const amount = Math.abs(tx.amount);
    if (tx.kind === "redeem") entry.redeemed += amount;
    else if (tx.kind === "issue" || tx.kind === "adjust" || tx.kind === "refund") entry.issued += amount;
    map.set(month, entry);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, entry]) => ({
      month,
      issued: entry.issued,
      redeemed: entry.redeemed,
      net: entry.issued - entry.redeemed,
    }));
}

export type GiftAgeBand = {
  label: string;
  cards: number;
  balance: number;
  share: number;
};

const AGE_BANDS: Array<{ label: string; maxDays: number }> = [
  { label: "0-30 gün", maxDays: 30 },
  { label: "31-90 gün", maxDays: 90 },
  { label: "91-180 gün", maxDays: 180 },
  { label: "181-365 gün", maxDays: 365 },
  { label: "1 yıl+", maxDays: Number.POSITIVE_INFINITY },
];

export function liabilityAging(cards: GiftCardRecord[], now = Date.now()): GiftAgeBand[] {
  const active = cards.filter((card) => card.balance > 0);
  const totals = AGE_BANDS.map(() => ({ cards: 0, balance: 0 }));

  for (const card of active) {
    const ageDays = Math.max(0, (now - new Date(card.createdAt).getTime()) / DAY);
    const index = AGE_BANDS.findIndex((band) => ageDays <= band.maxDays);
    const slot = totals[index === -1 ? AGE_BANDS.length - 1 : index]!;
    slot.cards += 1;
    slot.balance += card.balance;
  }

  const totalBalance = totals.reduce((sum, slot) => sum + slot.balance, 0);
  return AGE_BANDS.map((band, index) => ({
    label: band.label,
    cards: totals[index]!.cards,
    balance: totals[index]!.balance,
    share: totalBalance > 0 ? (totals[index]!.balance / totalBalance) * 100 : 0,
  }));
}

export type GiftCardRow = GiftCardRecord & {
  usedAmount: number;
  usageRate: number;
  daysSinceIssue: number;
  expiryState: "none" | "expired" | "soon" | "future";
};

export function cardRows(cards: GiftCardRecord[], now = Date.now()): GiftCardRow[] {
  return cards
    .map((card) => {
      const usedAmount = Math.max(0, card.initialAmount - card.balance);
      const expiry = card.expiresAt ? new Date(card.expiresAt).getTime() : null;
      const expiryState: GiftCardRow["expiryState"] = !expiry
        ? "none"
        : expiry < now
          ? "expired"
          : expiry - now <= 30 * DAY
            ? "soon"
            : "future";
      return {
        ...card,
        usedAmount,
        usageRate: card.initialAmount > 0 ? (usedAmount / card.initialAmount) * 100 : 0,
        daysSinceIssue: Math.floor((now - new Date(card.createdAt).getTime()) / DAY),
        expiryState,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}
