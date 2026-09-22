import { useEffect, useState } from "react";

import type { StoreTheme } from "@/components/storefront-chrome";
import { getThemePreviewSettings } from "@/lib/theme-preview.functions";
import {
  PREVIEW_MESSAGE_TYPE,
  isPreviewKey,
  mergePreviewSettings,
  sanitizePreviewValue,
  type PreviewSettings,
} from "@/lib/theme-preview";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Customizer canlı önizlemesi: adreste geçerli bir `preview_token` varsa
 * kaydedilmemiş tema ayarları sunucudan okunur ve panelden gelen anlık
 * değişiklikler (postMessage) sayfa yenilenmeden uygulanır.
 *
 * Token yoksa veya geçersizse yayınlanmış tema aynen döner.
 */
export function usePreviewTheme(storeId: string | undefined, theme: StoreTheme): StoreTheme {
  const [token, setToken] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PreviewSettings>({});

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("preview_token");
    setToken(value && UUID.test(value) ? value : null);
  }, []);

  useEffect(() => {
    if (!token || !storeId) return;
    let active = true;
    void getThemePreviewSettings({ data: { token, storeId } })
      .then((result) => {
        if (active) setOverrides(result.settings);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storeId, token]);

  useEffect(() => {
    if (!token) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as { type?: unknown; token?: unknown; key?: unknown; value?: unknown } | null;
      if (!payload || payload.type !== PREVIEW_MESSAGE_TYPE) return;
      if (payload.token !== token) return;
      if (!isPreviewKey(payload.key)) return;
      const value = sanitizePreviewValue(payload.key, payload.value);
      if (value === null) return;
      setOverrides((current) => ({ ...current, [payload.key as string]: value }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [token]);

  if (!token || !theme || Object.keys(overrides).length === 0) return theme;
  return mergePreviewSettings(theme as Record<string, unknown>, overrides) as StoreTheme;
}
