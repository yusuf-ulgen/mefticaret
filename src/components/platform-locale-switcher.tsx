import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Platform (mefticaret.com) ana sayfası için dil değiştirici.
 * Türkçe ana sayfa `/`, diğer diller `/en`, `/de`, `/ar` adreslerinde.
 */
export const PLATFORM_LOCALES = [
  { code: "tr", label: "Türkçe", short: "TR", to: "/" as const },
  { code: "en", label: "English", short: "EN", to: "/en" as const },
  { code: "de", label: "Deutsch", short: "DE", to: "/de" as const },
  { code: "fr", label: "Français", short: "FR", to: "/fr" as const },
  { code: "ar", label: "العربية", short: "AR", to: "/ar" as const },
];

export function PlatformLocaleSwitcher({ active }: { active: string }) {
  const activeLocale = PLATFORM_LOCALES.find((locale) => locale.code === active) ?? PLATFORM_LOCALES[0];

  return (
    <nav aria-label="Dil seçimi / Language">
      <div className="hidden items-center gap-1 rounded-full border border-border p-1 md:flex">
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
      </div>

      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 gap-1 rounded-full px-3"
              aria-label={`Dil seçimi: ${activeLocale?.label ?? "Türkçe"}`}
            >
              <Globe className="size-4" aria-hidden="true" />
              <span className="text-xs font-semibold">{activeLocale?.short ?? "TR"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40 rounded-lg p-1.5">
            {PLATFORM_LOCALES.map((locale) => {
              const isActive = locale.code === active;
              return (
                <DropdownMenuItem key={locale.code} asChild className="rounded-md p-0">
                  <Link
                    to={locale.to}
                    hrefLang={locale.code}
                    aria-current={isActive ? "page" : undefined}
                    className="flex w-full items-center gap-3 px-3 py-2.5"
                  >
                    <span className="w-5 text-xs font-semibold text-muted-foreground">{locale.short}</span>
                    <span className="flex-1">{locale.label}</span>
                    {isActive ? <Check className="size-4" aria-hidden="true" /> : null}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
