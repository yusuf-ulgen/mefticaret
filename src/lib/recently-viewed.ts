/** Vitrin ziyaretçisinin son görüntülediği ürünler (mağaza bazında, localStorage). */
export type RecentProduct = {
  storeSlug: string;
  productSlug: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
  viewedAt: number;
};

const STORAGE_KEY = "mefti-recent-v1";
const MAX_PER_STORE = 12;

function readAll(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentProduct[]) : [];
  } catch {
    return [];
  }
}

export function recordRecentProduct(item: Omit<RecentProduct, "viewedAt">) {
  if (typeof window === "undefined") return;
  const next = [
    { ...item, viewedAt: Date.now() },
    ...readAll().filter(
      (entry) => !(entry.storeSlug === item.storeSlug && entry.productSlug === item.productSlug),
    ),
  ];
  const byStore = new Map<string, number>();
  const trimmed = next.filter((entry) => {
    const count = (byStore.get(entry.storeSlug) ?? 0) + 1;
    byStore.set(entry.storeSlug, count);
    return count <= MAX_PER_STORE;
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* kota dolu olabilir */
  }
}

export function getRecentProducts(storeSlug: string, excludeSlug?: string): RecentProduct[] {
  return readAll()
    .filter((entry) => entry.storeSlug === storeSlug && entry.productSlug !== excludeSlug)
    .sort((a, b) => b.viewedAt - a.viewedAt);
}
