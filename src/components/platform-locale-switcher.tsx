import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";

/**
 * Platform (mefticaret.com) ana sayfası için dil değiştirici.
 * Türkçe ana sayfa `/`, diğer diller `/en`, `/de`, `/ar` adreslerinde.
 */
export const PLATFORM_LOCALES = [
  { code: "tr", label: "Türkçe", short: "TR", to: "/" as const },
  { code: "en", label: "English", short: "EN", to: "/en" as const },
  { code: "de", label: "Deutsch", short: "DE", to: "/de" as const },
  { code: "ar", label: "العربية", short: "AR", to: "/ar" as const },
];

export function PlatformLocaleSwitcher({ active }: { active: string }) {
  return (
    <nav
      aria-label="Dil seçimi / Language"
      className="flex items-center gap-1 rounded-full border border-border px-1 py-1"
    >
      <Globe className="mx-1 size-4 text-muted-foreground" aria-hidden="true" />
      {PLATFORM_LOCALES.map((locale) => {
        const isActive = locale.code === active;
        return (
          <Link
            key={locale.code}
            to={locale.to}
            hrefLang={locale.code}
            aria-current={isActive ? "page" : undefined}
            title={locale.label}
            className={`rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {locale.short}
          </Link>
        );
      })}
    </nav>
  );
}
