import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  buildFallbackChain,
  isRtlLanguage,
  languageFlag,
  languageNative,
  localeShortCode,
  matchBrowserLocale,
} from "@/lib/languages";
import { SYSTEM_STRINGS, makeKey, type SwitcherStyle } from "@/lib/translation";

/**
 * Vitrin dil motoru.
 *
 * Yalnızca seçili dilin sözlüğü çekilir (tüm çeviri tablosu değil).
 * Dil tercihi çerezde + yerel depoda tutulur; yoksa tarayıcı dili önerilir.
 */

const COOKIE = "mefticaret_locale";

export type StorefrontLocaleData = {
  storeId: string | null;
  locales: {
    locale: string;
    label: string;
    native_label: string | null;
    dir: string;
    is_default: boolean;
  }[];
  settings: {
    switcher_enabled: boolean;
    switcher_style: string;
    detect_browser_language: boolean;
    show_missing: boolean;
    fallback_chain: string[];
  } | null;
};

export const storefrontLocalesQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront-locales", slug],
    queryFn: async (): Promise<StorefrontLocaleData> => {
      const { data: store } = await supabase.from("stores").select("id").eq("slug", slug).maybeSingle();
      if (!store) return { storeId: null, locales: [], settings: null };

      const [{ data: locales }, { data: settings }] = await Promise.all([
        supabase
          .from("store_locales")
          .select("locale, label, native_label, dir, is_default")
          .eq("store_id", store.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("translation_settings")
          .select("switcher_enabled, switcher_style, detect_browser_language, show_missing, fallback_chain")
          .eq("store_id", store.id)
          .maybeSingle(),
      ]);

      return { storeId: store.id, locales: locales ?? [], settings: settings ?? null };
    },
    staleTime: 300_000,
  });

const localeBundleQuery = (storeId: string | null, locale: string) =>
  queryOptions({
    queryKey: ["storefront-locale-bundle", storeId, locale],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!storeId) return {};
      const { data } = await supabase
        .from("translation_entries")
        .select("translation_key, translated_value")
        .eq("store_id", storeId)
        .eq("locale", locale)
        .in("content_type", ["system", "theme", "menu", "email"])
        .not("translated_value", "is", null)
        .limit(3000);
      const bundle: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.translated_value) bundle[row.translation_key] = row.translated_value;
      }
      return bundle;
    },
    enabled: Boolean(storeId),
    staleTime: 300_000,
  });

function readStoredLocale(slug: string): string | null {
  try {
    const stored = window.localStorage.getItem(`${COOKIE}:${slug}`);
    if (stored) return stored;
  } catch {
    /* depolama kapalı olabilir */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function persistLocale(slug: string, locale: string) {
  try {
    window.localStorage.setItem(`${COOKIE}:${slug}`, locale);
  } catch {
    /* yoksay */
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=31536000; samesite=lax`;
}

export type StorefrontLocale = {
  locale: string;
  defaultLocale: string;
  dir: "ltr" | "rtl";
  available: StorefrontLocaleData["locales"];
  switcherEnabled: boolean;
  switcherStyle: SwitcherStyle;
  setLocale: (locale: string) => void;
  /** Sistem metni: çeviri yoksa kaynak metne düşer. */
  st: (key: string, fallback?: string) => string;
  /** Tema/menü gibi kayıt bazlı çeviriler için. */
  tf: (contentType: string, entityId: string, field: string, fallback: string) => string;
};

export function useStorefrontLocale(storeSlug: string): StorefrontLocale {
  const { data } = useQuery(storefrontLocalesQuery(storeSlug));
  const defaultLocale = data?.locales.find((row) => row.is_default)?.locale ?? "tr-TR";
  const available = data?.locales ?? [];
  const [locale, setLocaleState] = useState(defaultLocale);

  useEffect(() => {
    if (available.length === 0) return;
    const stored = readStoredLocale(storeSlug);
    if (stored && available.some((row) => row.locale === stored)) {
      setLocaleState(stored);
      return;
    }
    if (data?.settings?.detect_browser_language !== false) {
      const detected = matchBrowserLocale(
        navigator.languages ?? [navigator.language],
        available.map((row) => row.locale),
        defaultLocale,
      );
      setLocaleState(detected);
      return;
    }
    setLocaleState(defaultLocale);
  }, [available, data?.settings?.detect_browser_language, defaultLocale, storeSlug]);

  const bundle = useQuery(localeBundleQuery(data?.storeId ?? null, locale));

  useEffect(() => {
    document.documentElement.lang = localeShortCode(locale);
    document.documentElement.dir = isRtlLanguage(locale) ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback(
    (next: string) => {
      setLocaleState(next);
      persistLocale(storeSlug, next);
    },
    [storeSlug],
  );

  const chain = useMemo(
    () =>
      buildFallbackChain(
        locale,
        available.map((row) => row.locale),
        defaultLocale,
        data?.settings?.fallback_chain ?? [],
      ),
    [locale, available, defaultLocale, data?.settings?.fallback_chain],
  );

  const showMissing = data?.settings?.show_missing ?? false;

  const st = useCallback(
    (key: string, fallback?: string) => {
      const full = makeKey("system", "global", key);
      const value = bundle.data?.[full];
      if (value) return value;
      if (showMissing && locale !== defaultLocale) return `[${key}]`;
      return fallback ?? SYSTEM_STRINGS[key] ?? key;
    },
    [bundle.data, showMissing, locale, defaultLocale],
  );

  const tf = useCallback(
    (contentType: string, entityId: string, field: string, fallback: string) =>
      bundle.data?.[`${contentType}.${entityId}.${field}`] ?? fallback,
    [bundle.data],
  );

  return {
    locale,
    defaultLocale,
    dir: isRtlLanguage(locale) ? "rtl" : "ltr",
    available,
    switcherEnabled: data?.settings?.switcher_enabled ?? true,
    switcherStyle: (data?.settings?.switcher_style ?? "flags_text") as SwitcherStyle,
    setLocale,
    st,
    tf,
    // Yedek zincir ileride sunucu tarafı çözümü için de kullanılır.
    ...({ chain } as Record<string, unknown>),
  };
}

/** Vitrin dil değiştirici — masaüstü ve mobil menüde aynı bileşen kullanılır. */
export function LanguageSwitcher({
  storeSlug,
  compact = false,
  color,
}: {
  storeSlug: string;
  compact?: boolean;
  color?: string;
}) {
  const { locale, available, setLocale, switcherEnabled, switcherStyle } = useStorefrontLocale(storeSlug);
  if (!switcherEnabled || available.length < 2) return null;

  const style = compact ? "select" : switcherStyle;

  if (style === "select") {
    return (
      <select
        aria-label="Dil seç"
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
        style={{
          background: "transparent",
          border: "1px solid currentColor",
          borderRadius: 999,
          color: color ?? "inherit",
          fontSize: 12,
          padding: "4px 8px",
        }}
      >
        {available.map((row) => (
          <option key={row.locale} value={row.locale}>
            {languageNative(row.locale)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {available.map((row) => {
        const active = row.locale === locale;
        const label =
          style === "flags"
            ? languageFlag(row.locale)
            : style === "text" || style === "minimal"
              ? localeShortCode(row.locale).toUpperCase()
              : `${languageFlag(row.locale)} ${localeShortCode(row.locale).toUpperCase()}`;
        return (
          <button
            key={row.locale}
            type="button"
            onClick={() => setLocale(row.locale)}
            aria-current={active ? "true" : undefined}
            aria-label={`${row.label} diline geç`}
            style={{
              background: active ? "currentColor" : "transparent",
              border: style === "minimal" ? "none" : "1px solid currentColor",
              borderRadius: 999,
              color: color ?? "inherit",
              cursor: "pointer",
              fontSize: 12,
              mixBlendMode: active ? "difference" : "normal",
              padding: "3px 8px",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
