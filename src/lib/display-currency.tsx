import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { useStorefrontLocale } from "@/components/storefront-language";
import { formatMoney as formatBase } from "@/lib/mefti";
import { DISPLAY_CURRENCIES, getDisplayRates } from "@/lib/display-currency.functions";
import {
  GEORGIA_CUSTOMS_LIMIT_GEL,
  SHIP_COUNTRIES,
  exportT,
  isGeorgia,
  normalizeExportLang,
  type ExportLang,
} from "@/lib/export-ge";

/**
 * Vitrin görüntüleme para birimi + teslimat ülkesi durumu.
 * Kayıtlar ve tahsilat mağazanın ana para biriminde kalır; burası yalnız gösterimdir.
 */
type DisplayState = {
  code: string | null;
  base: string;
  rates: Record<string, number>;
  shipCountry: string;
};

const STORAGE_KEY = "mefticaret.display";
const SERVER_STATE: DisplayState = { code: null, base: "TRY", rates: {}, shipCountry: "Türkiye" };
let state: DisplayState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit(next: Partial<DisplayState>) {
  state = { ...state, ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: state.code, shipCountry: state.shipCountry }));
  } catch {
    /* depolama kapalı olabilir */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplayCurrency() {
  const current = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return {
    ...current,
    active: current.code ?? current.base,
    setCurrency: (code: string) => emit({ code }),
    setShipCountry: (shipCountry: string) => emit({ shipCountry }),
  };
}

/** Ana para birimindeki tutarı hedef para birimine çevirir; kur yoksa null. */
export function convertAmount(amount: number, from: string, to: string): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  if (f !== state.base) return null;
  const rate = state.rates[t];
  return rate ? amount * rate : null;
}

/** mefti.formatMoney ile aynı imza; seçili görüntüleme para birimine anlık çevirir. */
export function formatMoney(value: number, currency = "TRY", locale = "tr-TR"): string {
  const code = state.code;
  if (code && code !== String(currency).toUpperCase()) {
    const converted = convertAmount(value, String(currency), code);
    if (converted !== null) return formatBase(converted, code, locale);
  }
  return formatBase(value, currency, locale);
}

/** Mağaza kurlarını yükler ve kayıtlı tercihi uygular (yalnız istemcide). */
export function DisplayCurrencyBridge({ slug }: { slug: string }) {
  const { data } = useQuery({
    queryKey: ["storefront", slug, "display-rates"],
    queryFn: () => getDisplayRates({ data: { slug } }),
    staleTime: 15 * 60 * 1000,
  });
  useEffect(() => {
    if (!data) return;
    let saved: { code?: string | null; shipCountry?: string } = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      saved = {};
    }
    const code = saved.code && (saved.code === data.base || data.rates[saved.code]) ? saved.code : null;
    emit({ base: data.base, rates: data.rates, code, shipCountry: saved.shipCountry ?? state.shipCountry });
  }, [data]);
  return null;
}

/**
 * Para birimi değişince sayfa içeriği yeniden çizilir. Kasa formu kendi durumunu
 * korumak için yeniden kurulmaz; kendisi abone olur.
 */
export function CurrencyScope({ children }: { children: ReactNode }) {
  const { active } = useDisplayCurrency();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const keep = /\/checkout$/.test(pathname);
  return <Fragment key={keep ? "checkout" : active}>{children}</Fragment>;
}

export function useExportLang(): ExportLang {
  const lang = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)?.["lang"] });
  return normalizeExportLang(lang);
}

const LANGS = [
  { code: "tr", locale: "tr-TR", label: "TR" },
  { code: "en", locale: "en-US", label: "EN" },
  { code: "ka", locale: "ka-GE", label: "KA" },
] as const;

/** Header: dil, para birimi ve teslimat ülkesi seçici. */
export function StorefrontGlobalSelector({ storeSlug, color }: { storeSlug: string; color?: string }) {
  const lang = useExportLang();
  const { available, setLocale } = useStorefrontLocale(storeSlug);
  const display = useDisplayCurrency();
  const select = {
    background: "transparent",
    border: "1px solid currentColor",
    borderRadius: 999,
    color: color ?? "inherit",
    fontSize: 12,
    padding: "4px 8px",
    fontFamily: "inherit",
  } as const;
  const currencies = DISPLAY_CURRENCIES.filter((code) => code === display.base || display.rates[code]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <select
        aria-label={exportT(lang, "language")}
        value={lang}
        style={select}
        onChange={(event) => {
          const target = LANGS.find((row) => row.code === event.target.value)!;
          const match = available.find((row) => row.locale.slice(0, 2).toLowerCase() === target.code);
          setLocale(match?.locale ?? target.locale);
        }}
      >
        {LANGS.map((row) => (
          <option key={row.code} value={row.code}>{row.label}</option>
        ))}
      </select>
      <select
        aria-label={exportT(lang, "currency")}
        value={display.active}
        style={select}
        onChange={(event) => display.setCurrency(event.target.value)}
      >
        {currencies.map((code) => (
          <option key={code} value={code}>{code}</option>
        ))}
      </select>
      <select
        aria-label={exportT(lang, "shipTo")}
        value={display.shipCountry}
        style={select}
        onChange={(event) => display.setShipCountry(event.target.value)}
      >
        {SHIP_COUNTRIES.map((row) => (
          <option key={row.code} value={row.value}>{row.code === "GE" ? "🇬🇪 GE" : "🇹🇷 TR"}</option>
        ))}
      </select>
    </div>
  );
}

/** Teslimat ülkesi Gürcistan ve toplam 300 GEL üzerindeyse gösterilen gümrük uyarısı. */
export function GeorgiaCustomsNotice({
  amount,
  currency,
  country,
}: {
  amount: number;
  currency: string;
  /** Verilmezse header'daki teslimat ülkesi kullanılır. */
  country?: string;
}) {
  const lang = useExportLang();
  const display = useDisplayCurrency();
  const target = country ?? display.shipCountry;
  if (!isGeorgia(target)) return null;
  const inGel = convertAmount(amount, currency, "GEL");
  if (inGel === null || inGel <= GEORGIA_CUSTOMS_LIMIT_GEL) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/15 p-3 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="font-semibold">{exportT(lang, "customsTitle")}</p>
        <p className="mt-0.5 leading-relaxed">{exportT(lang, "customsText")}</p>
      </div>
    </div>
  );
}
