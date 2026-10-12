import { createContext, useContext, type ReactNode } from "react";

import { LANDING_DICT } from "@/lib/landing-dict";
import type { SiteSection } from "@/lib/site-content";
import { withLocale } from "@/lib/auth-i18n";

/**
 * Ana sayfa çevirisi: Türkçe metin anahtardır. Türkçede metin aynen döner;
 * diğer dillerde sözlükte karşılığı yoksa Türkçe metin gösterilir.
 */
export type LandingLocale = "tr" | "en" | "de" | "fr" | "ar";

const LandingLocaleContext = createContext<LandingLocale>("tr");

export function LandingLocaleProvider({
  locale,
  children,
}: {
  locale: LandingLocale;
  children: ReactNode;
}) {
  return <LandingLocaleContext.Provider value={locale}>{children}</LandingLocaleContext.Provider>;
}

export function useLandingLocale(): LandingLocale {
  return useContext(LandingLocaleContext);
}

export type Tx = (
  text: string | null | undefined,
  vars?: Record<string, string | number>,
) => string;

export function translateLanding(
  locale: LandingLocale,
  text: string | null | undefined,
  vars?: Record<string, string | number>,
): string {
  if (text == null) return "";
  let out = text;
  if (locale !== "tr") {
    const key = text.trim();
    out = (key && LANDING_DICT[locale]?.[key]) || text;
  }
  if (vars)
    out = out.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  return out;
}

export function useTx(): Tx {
  const locale = useLandingLocale();
  return (text, vars) => translateLanding(locale, text, vars);
}

const SKIP_FIELDS = new Set([
  "href",
  "icon",
  "primary_href",
  "secondary_href",
  "section_key",
  "id",
  "count",
]);

export function landingHref(href: string, locale: LandingLocale) {
  return /^\/(auth|forgot-password)(\?|$)/.test(href) ? withLocale(href, locale) : href;
}

function contentLanguageLabel(href: unknown, label: string, locale: LandingLocale) {
  if (
    locale === "tr" ||
    typeof href !== "string" ||
    !/^\/(kolay-panel-rehberi|e-ticaret-paketleri)(\?|#|$)/.test(href)
  )
    return label;
  const note = {
    en: "Turkish content",
    de: "Inhalt auf Türkisch",
    fr: "Contenu en turc",
    ar: "المحتوى باللغة التركية",
  }[locale];
  return `${label} (${note})`;
}

/** Paneldeki bölüm metinlerini (başlık, buton, öğeler) seçili dile çevirir. */
export function localizeSection(
  section: SiteSection | null,
  locale: LandingLocale,
): SiteSection | null {
  if (!section || locale === "tr") return section;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(section)) {
    if (key === "items" && Array.isArray(value)) {
      out[key] = value.map((item: Record<string, string>) => {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(item ?? {})) {
          next[k] =
            typeof v === "string" && k.endsWith("href")
              ? landingHref(v, locale)
              : typeof v === "string" && !SKIP_FIELDS.has(k)
                ? translateLanding(locale, v)
                : v;
        }
        if (next["label"])
          next["label"] = contentLanguageLabel(next["href"], next["label"], locale);
        return next;
      });
    } else if (typeof value === "string" && key.endsWith("href")) {
      out[key] = landingHref(value, locale);
    } else if (typeof value === "string" && !SKIP_FIELDS.has(key)) {
      out[key] = translateLanding(locale, value);
    } else {
      out[key] = value;
    }
  }
  for (const prefix of ["primary", "secondary"]) {
    const label = out[`${prefix}_label`];
    if (typeof label === "string")
      out[`${prefix}_label`] = contentLanguageLabel(out[`${prefix}_href`], label, locale);
  }
  return out as SiteSection;
}
