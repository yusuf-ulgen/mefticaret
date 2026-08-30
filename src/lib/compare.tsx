import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CompareItem = {
  storeSlug: string;
  productSlug: string;
};

type CompareState = {
  slugsFor: (storeSlug: string) => string[];
  countFor: (storeSlug: string) => number;
  isSelected: (storeSlug: string, productSlug: string) => boolean;
  /** true = eklendi, false = çıkarıldı, null = limit doldu */
  toggle: (item: CompareItem) => boolean | null;
  remove: (storeSlug: string, productSlug: string) => void;
  clear: (storeSlug: string) => void;
  limit: number;
};

export const COMPARE_LIMIT = 4;

const STORAGE_KEY = "mefti-compare-v1";
const CompareContext = createContext<CompareState | null>(null);

function readStorage(): CompareItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CompareItem[]) : [];
  } catch {
    return [];
  }
}

/** Vitrin karşılaştırma listesi — mağaza bazında izole, tarayıcıda saklanır. */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* kota dolu olabilir, sessizce yut */
    }
  }, [items, hydrated]);

  const remove = useCallback((storeSlug: string, productSlug: string) => {
    setItems((prev) =>
      prev.filter((item) => !(item.storeSlug === storeSlug && item.productSlug === productSlug)),
    );
  }, []);

  const toggle = useCallback(
    (item: CompareItem) => {
      const exists = items.some(
        (current) => current.storeSlug === item.storeSlug && current.productSlug === item.productSlug,
      );
      if (exists) {
        remove(item.storeSlug, item.productSlug);
        return false;
      }
      const currentCount = items.filter((current) => current.storeSlug === item.storeSlug).length;
      if (currentCount >= COMPARE_LIMIT) return null;
      setItems((prev) => [...prev, item]);
      return true;
    },
    [items, remove],
  );

  const value = useMemo<CompareState>(
    () => ({
      slugsFor: (storeSlug) =>
        items.filter((item) => item.storeSlug === storeSlug).map((item) => item.productSlug),
      countFor: (storeSlug) => items.filter((item) => item.storeSlug === storeSlug).length,
      isSelected: (storeSlug, productSlug) =>
        items.some((item) => item.storeSlug === storeSlug && item.productSlug === productSlug),
      toggle,
      remove,
      clear: (storeSlug) => setItems((prev) => prev.filter((item) => item.storeSlug !== storeSlug)),
      limit: COMPARE_LIMIT,
    }),
    [items, toggle, remove],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) throw new Error("useCompare, CompareProvider içinde kullanılmalı");
  return context;
}
