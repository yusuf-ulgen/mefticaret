/**
 * Abonelik ticareti, mağaza cüzdanı ve akıllı sipariş bölme — saf hesaplama katmanı.
 * Ağ/veritabanı erişimi yoktur; tüm kurallar burada test edilebilir.
 */

export const SUBSCRIPTION_INTERVAL_PRESETS = [
  { days: 7, label: "Her hafta" },
  { days: 14, label: "İki haftada bir" },
  { days: 30, label: "Her ay" },
  { days: 60, label: "İki ayda bir" },
  { days: 90, label: "Üç ayda bir" },
] as const;

export const CUSTOMER_SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  paused: "Duraklatıldı",
  canceled: "İptal edildi",
};

export const WALLET_KIND_LABELS: Record<string, string> = {
  topup: "Bakiye yükleme",
  spend: "Harcama",
  refund: "İade",
  adjustment: "Düzeltme",
};

/** Abonelik aralığını okunur metne çevirir (preset yoksa gün olarak yazar). */
export function intervalLabel(days: number): string {
  const preset = SUBSCRIPTION_INTERVAL_PRESETS.find((p) => p.days === days);
  return preset ? preset.label : `${days} günde bir`;
}

/** Abone fiyatı: taban fiyata plan indirimi uygulanır, 2 haneye yuvarlanır. */
export function subscriberPrice(basePrice: number, discountPercent: number): number {
  const safeBase = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 0;
  const safeDiscount = Math.min(90, Math.max(0, discountPercent));
  return Math.round(safeBase * (1 - safeDiscount / 100) * 100) / 100;
}

/** Bir abonelikten min. döngü boyunca elde edilecek toplam ciro. */
export function subscriptionCommitmentValue(
  basePrice: number,
  discountPercent: number,
  quantity: number,
  minCycles: number,
): number {
  const unit = subscriberPrice(basePrice, discountPercent);
  const qty = Math.max(1, Math.trunc(quantity));
  const cycles = Math.max(1, Math.trunc(minCycles));
  return Math.round(unit * qty * cycles * 100) / 100;
}

/** Bir sonraki gönderim tarihi: verilen tarihe interval eklenir. */
export function nextOrderDate(from: Date, intervalDays: number): Date {
  const days = Math.max(1, Math.trunc(intervalDays));
  return new Date(from.getTime() + days * 86_400_000);
}

export type WalletTxKind = "topup" | "spend" | "refund" | "adjustment";

/** Cüzdan hareketinin bakiyeye etkisi (harcama negatif). */
export function walletDelta(kind: WalletTxKind, amount: number): number {
  const value = Math.abs(Number(amount) || 0);
  if (kind === "spend") return -value;
  if (kind === "adjustment") return Number(amount) || 0;
  return value;
}

/** Hareket listesinden bakiyeyi yeniden hesaplar. */
export function walletBalance(rows: Array<{ kind: string; amount: number }>): number {
  const total = rows.reduce((sum, row) => sum + walletDelta(row.kind as WalletTxKind, row.amount), 0);
  return Math.round(total * 100) / 100;
}

/* ------------------------- akıllı sipariş bölme --------------------------- */

export type SplitWarehouse = {
  id: string;
  name: string;
  countryCode: string;
  priority: number;
  isActive: boolean;
  /** ürün/varyant bazlı kullanılabilir stok */
  stock: Record<string, number>;
};

export type SplitLine = { sku: string; title: string; quantity: number };

export type SplitParcel = {
  warehouseId: string;
  warehouseName: string;
  countryCode: string;
  lines: Array<{ sku: string; title: string; quantity: number }>;
};

export type SplitResult = {
  parcels: SplitParcel[];
  unfulfilled: Array<{ sku: string; title: string; quantity: number }>;
  parcelCount: number;
  /** Tek parçada karşılanabiliyorsa true */
  singleParcel: boolean;
  reason: string;
};

/* ------------------------- panel görünüm tipleri -------------------------- */

export type SubscriptionPlanView = {
  id: string;
  productId: string | null;
  name: string;
  intervalDays: number;
  discountPercent: number;
  minCycles: number;
  isActive: boolean;
};

export type SubscriptionProductView = { id: string; title: string; basePrice: number };

export type CustomerSubscriptionView = {
  id: string;
  planId: string;
  customerId: string;
  customerName: string;
  quantity: number;
  status: string;
  nextOrderAt: string;
  lastOrderAt: string | null;
  cyclesCompleted: number;
  note: string | null;
};

export type SubscriptionCommerceData = {
  plans: SubscriptionPlanView[];
  products: SubscriptionProductView[];
  subscriptions: CustomerSubscriptionView[];
};

export type WalletTransactionView = {
  id: string;
  kind: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

export type WalletView = {
  id: string;
  customerId: string;
  customerName: string;
  balance: number;
  currency: string;
  transactions: WalletTransactionView[];
};

export type WalletsData = {
  wallets: WalletView[];
  customers: Array<{ id: string; name: string }>;
};

function distance(warehouseCountry: string, destination: string): number {
  const a = (warehouseCountry || "").trim().toUpperCase().slice(0, 2);
  const b = (destination || "").trim().toUpperCase().slice(0, 2);
  if (!a || !b) return 3;
  if (a === b) return 0;
  const eu = new Set(["DE", "FR", "NL", "BE", "IT", "ES", "AT", "PL", "SE", "DK", "FI", "IE", "PT", "CZ"]);
  if (eu.has(a) && eu.has(b)) return 1;
  return 2;
}

/**
 * Sipariş kalemlerini stoğu olan depolara böler.
 * Önce tüm siparişi tek başına karşılayabilen en yakın depo denenir (tek kargo hedefi),
 * karşılanamazsa kalemler yakınlık + öncelik sırasına göre depolara paylaştırılır.
 */
export function splitOrderAcrossWarehouses(
  warehouses: SplitWarehouse[],
  lines: SplitLine[],
  destinationCountry: string,
): SplitResult {
  const active = warehouses
    .filter((w) => w.isActive)
    .map((w) => ({ w, d: distance(w.countryCode, destinationCountry) }))
    .sort((a, b) => a.d - b.d || b.w.priority - a.w.priority)
    .map((entry) => entry.w);

  const wanted = lines.filter((line) => line.quantity > 0);
  if (active.length === 0 || wanted.length === 0) {
    return {
      parcels: [],
      unfulfilled: wanted.map((line) => ({ ...line })),
      parcelCount: 0,
      singleParcel: false,
      reason: active.length === 0 ? "Aktif depo bulunamadı" : "Bölünecek kalem yok",
    };
  }

  const single = active.find((w) => wanted.every((line) => (w.stock[line.sku] ?? 0) >= line.quantity));
  if (single) {
    return {
      parcels: [
        {
          warehouseId: single.id,
          warehouseName: single.name,
          countryCode: single.countryCode,
          lines: wanted.map((line) => ({ ...line })),
        },
      ],
      unfulfilled: [],
      parcelCount: 1,
      singleParcel: true,
      reason: `${single.name} tüm kalemleri tek kargoda karşılıyor`,
    };
  }

  const remaining = new Map(wanted.map((line) => [line.sku, line.quantity]));
  const titles = new Map(wanted.map((line) => [line.sku, line.title]));
  const parcels: SplitParcel[] = [];

  for (const warehouse of active) {
    const picked: SplitParcel["lines"] = [];
    for (const [sku, need] of remaining) {
      if (need <= 0) continue;
      const available = warehouse.stock[sku] ?? 0;
      if (available <= 0) continue;
      const take = Math.min(available, need);
      picked.push({ sku, title: titles.get(sku) ?? sku, quantity: take });
      remaining.set(sku, need - take);
    }
    if (picked.length > 0) {
      parcels.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        countryCode: warehouse.countryCode,
        lines: picked,
      });
    }
    if ([...remaining.values()].every((value) => value <= 0)) break;
  }

  const unfulfilled = [...remaining.entries()]
    .filter(([, value]) => value > 0)
    .map(([sku, quantity]) => ({ sku, title: titles.get(sku) ?? sku, quantity }));

  return {
    parcels,
    unfulfilled,
    parcelCount: parcels.length,
    singleParcel: false,
    reason:
      unfulfilled.length > 0
        ? `${parcels.length} parça hazırlanabiliyor, ${unfulfilled.length} kalem stokta yok`
        : `Sipariş ${parcels.length} parçaya bölündü`,
  };
}
