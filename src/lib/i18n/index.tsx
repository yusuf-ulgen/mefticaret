import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dictionaries, type TranslationKey } from "./messages";
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  normalizeLocale,
  type Locale,
  type LocaleMeta,
} from "./locales";

const STORAGE_KEY = "mefticaret.locale";

type I18nValue = {
  locale: Locale;
  meta: LocaleMeta;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Fallback zinciri: seçili dil -> İngilizce -> Türkçe -> anahtarın kendisi. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const value = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? dictionaries.tr[key] ?? key;
  return interpolate(value, vars);
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  routeLocale,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  routeLocale?: Locale | undefined;
}) {
  const [selectedLocale, setLocaleState] = useState<Locale>(initialLocale);
  const locale = routeLocale ?? selectedLocale;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setLocaleState(normalizeLocale(stored, initialLocale));
    } catch {
      /* storage kapalı olabilir */
    }
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* yoksay */
    }
  }, []);

  useEffect(() => {
    const meta = LOCALE_META[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      meta: LOCALE_META[locale],
      dir: LOCALE_META[locale].dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (context) return context;
  // Sağlayıcı olmayan ağaçlarda güvenli varsayılan (SSR / izole testler).
  return {
    locale: DEFAULT_LOCALE,
    meta: LOCALE_META[DEFAULT_LOCALE],
    dir: "ltr",
    setLocale: () => {},
    t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
  };
}

export function useT() {
  return useI18n().t;
}

export type { TranslationKey };
export * from "./locales";
