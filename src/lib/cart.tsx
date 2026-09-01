import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { syncAbandonedCart } from "@/lib/abandoned.functions";
import { getCartToken } from "@/lib/cart-token";
import { trackEvent } from "@/lib/track";

export type CartLine = {
  storeSlug: string;
  variantId: string;
  productSlug: string;
  title: string;
  variantTitle: string;
  price: number;
  currency: string;
  quantity: number;
  maxStock: number;
};

type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: (storeSlug?: string) => void;
  linesFor: (storeSlug: string) => CartLine[];
  countFor: (storeSlug: string) => number;
  subtotalFor: (storeSlug: string) => number;
};

const STORAGE_KEY = "mefti-cart-v1";
const CartContext = createContext<CartState | null>(null);

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* kota dolu olabilir, sessizce yut */
    }
  }, [lines, hydrated]);

  // Terk edilmiş sepet takibi: sepet değişimlerini mağaza bazında sunucuya yansıt (sessiz, debounce'lu)
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const byStore = new Map<string, CartLine[]>();
      for (const line of lines) {
        const list = byStore.get(line.storeSlug) ?? [];
        list.push(line);
        byStore.set(line.storeSlug, list);
      }
      for (const [slug, storeLines] of byStore) {
        void syncAbandonedCart({
          data: {
            slug,
            cartToken: getCartToken(slug),
            currency: storeLines[0]?.currency ?? "TRY",
            items: storeLines.map((l) => ({
              variantId: l.variantId,
              productSlug: l.productSlug,
              title: l.title,
              variantTitle: l.variantTitle,
              quantity: l.quantity,
              price: l.price,
            })),
          },
        }).catch(() => {});
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    trackEvent(line.storeSlug, "add_to_cart", {
      variantId: line.variantId,
      value: line.price * Math.max(1, quantity),
      quantity: Math.max(1, quantity),
      currency: line.currency,
    });
    setLines((current) => {
      const existing = current.find((item) => item.variantId === line.variantId);
      if (existing) {
        return current.map((item) =>
          item.variantId === line.variantId
            ? { ...item, ...line, quantity: Math.min(item.quantity + quantity, Math.max(1, line.maxStock)) }
            : item,
        );
      }
      return [...current, { ...line, quantity: Math.max(1, Math.min(quantity, Math.max(1, line.maxStock))) }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) =>
      current
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: Math.max(0, Math.min(quantity, Math.max(1, item.maxStock))) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((current) => current.filter((item) => item.variantId !== variantId));
  }, []);

  const clear = useCallback((storeSlug?: string) => {
    setLines((current) => (storeSlug ? current.filter((item) => item.storeSlug !== storeSlug) : []));
  }, []);

  const value = useMemo<CartState>(() => {
    const linesFor = (storeSlug: string) => lines.filter((item) => item.storeSlug === storeSlug);
    return {
      lines,
      add,
      setQuantity,
      remove,
      clear,
      linesFor,
      countFor: (storeSlug) => linesFor(storeSlug).reduce((sum, item) => sum + item.quantity, 0),
      subtotalFor: (storeSlug) => linesFor(storeSlug).reduce((sum, item) => sum + item.price * item.quantity, 0),
    };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart, CartProvider içinde kullanılmalıdır");
  return context;
}
