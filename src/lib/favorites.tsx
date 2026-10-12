import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type FavoriteItem = {
  storeSlug: string;
  productSlug: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
};

type FavoritesState = {
  items: FavoriteItem[];
  itemsFor: (storeSlug: string) => FavoriteItem[];
  countFor: (storeSlug: string) => number;
  isFavorite: (storeSlug: string, productSlug: string) => boolean;
  toggle: (item: FavoriteItem) => boolean;
  remove: (storeSlug: string, productSlug: string) => void;
  clear: (storeSlug: string) => void;
};

const STORAGE_KEY = "mefti-favorites-v1";
const FavoritesContext = createContext<FavoritesState | null>(null);

function readStorage(): FavoriteItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

/** Vitrin favorileri — mağaza bazında izole, tarayıcıda saklanır. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
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

  const isFavorite = useCallback(
    (storeSlug: string, productSlug: string) =>
      items.some((item) => item.storeSlug === storeSlug && item.productSlug === productSlug),
    [items],
  );

  const remove = useCallback((storeSlug: string, productSlug: string) => {
    setItems((prev) =>
      prev.filter((item) => !(item.storeSlug === storeSlug && item.productSlug === productSlug)),
    );
  }, []);

  const toggle = useCallback(
    (item: FavoriteItem) => {
      const exists = items.some(
        (current) => current.storeSlug === item.storeSlug && current.productSlug === item.productSlug,
      );
      if (exists) {
        remove(item.storeSlug, item.productSlug);
        return false;
      }
      setItems((prev) => [item, ...prev]);
      return true;
    },
    [items, remove],
  );

  const value = useMemo<FavoritesState>(
    () => ({
      items,
      itemsFor: (storeSlug) => items.filter((item) => item.storeSlug === storeSlug),
      countFor: (storeSlug) => items.filter((item) => item.storeSlug === storeSlug).length,
      isFavorite,
      toggle,
      remove,
      clear: (storeSlug) => setItems((prev) => prev.filter((item) => item.storeSlug !== storeSlug)),
    }),
    [items, isFavorite, toggle, remove],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

/** Sağlayıcı yoksa (editör önizlemesi) null döner. */
export function useOptionalFavorites() {
  return useContext(FavoritesContext);
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites, FavoritesProvider içinde kullanılmalı");
  return context;
}
