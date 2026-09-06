import { useSyncExternalStore } from "react";

/**
 * Vitrin arayüzü için hafif global durum (sepet çekmecesi, hızlı bakış modalı).
 * Provider plumbing gerektirmez; herhangi bir bileşen açıp kapatabilir.
 */

type StorefrontUIState = {
  cartOpen: boolean;
  quickViewSlug: string | null;
  searchOpen: boolean;
};

let state: StorefrontUIState = { cartOpen: false, quickViewSlug: null, searchOpen: false };
const listeners = new Set<() => void>();

function emit(next: Partial<StorefrontUIState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const storefrontUI = {
  openCart: () => emit({ cartOpen: true }),
  closeCart: () => emit({ cartOpen: false }),
  openQuickView: (slug: string) => emit({ quickViewSlug: slug }),
  closeQuickView: () => emit({ quickViewSlug: null }),
  setSearchOpen: (open: boolean) => emit({ searchOpen: open }),
};

const serverSnapshot: StorefrontUIState = { cartOpen: false, quickViewSlug: null, searchOpen: false };

export function useStorefrontUI(): StorefrontUIState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );
}
