import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

/**
 * Satıcı panelinde son ziyaret edilen ekranları hatırlar.
 * Yalnızca tarayıcıda (localStorage) tutulur, mağaza bazında ayrılır.
 */
const MAX_RECENT = 6;

const storageKey = (storeId: string) => `mefti:recent-nav:${storeId}`;

function read(storeId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(storeId: string, value: string[]) {
  try {
    window.localStorage.setItem(storageKey(storeId), JSON.stringify(value));
  } catch {
    /* depolama kapalıysa yoksay */
  }
}

/** Geçerli yolu kaydeder ve son ziyaret edilen yolları döndürür. */
export function useRecentPaths(storeId: string): { recent: string[]; clear: () => void } {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [recent, setRecent] = useState<string[]>([]);

  // Hidrasyon uyuşmazlığı olmaması için depolama render sonrası okunur.
  useEffect(() => {
    setRecent(read(storeId));
  }, [storeId]);

  useEffect(() => {
    if (!pathname.startsWith(`/store/${storeId}/`)) return;
    setRecent((prev) => {
      const base = prev.length === 0 ? read(storeId) : prev;
      const next = [pathname, ...base.filter((item) => item !== pathname)].slice(0, MAX_RECENT);
      if (next.length === base.length && next.every((item, i) => item === base[i])) return base;
      write(storeId, next);
      return next;
    });
  }, [pathname, storeId]);

  const clear = useCallback(() => {
    write(storeId, []);
    setRecent([]);
  }, [storeId]);

  return { recent, clear };
}
