/**
 * Para birimi ve otomatik çevirim ayarları — eşleme ekranındaki "Para birimi"
 * sekmesi. Çevirim açıkken fiyat alanlarına kur kuralı otomatik eklenir.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { listPlatformCurrencyRates } from "@/lib/xml-integrator.functions";
import {
  SUPPORTED_FEED_CURRENCIES,
  effectiveRate,
  totalMultiplier,
  type CurrencyConfig,
  type FeedCurrency,
  type RateRow,
} from "@/lib/xml-currency";

const money = (value: number, code: string) =>
  `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`;

export function useCurrencyRates() {
  const load = useServerFn(listPlatformCurrencyRates);
  return useQuery({
    queryKey: ["platform-currency-rates"],
    queryFn: () => load(),
    staleTime: 5 * 60 * 1000,
  });
}

export function CurrencySettings({
  config,
  onChange,
  rates,
  ratesLoading,
  mappedPriceFields,
}: {
  config: CurrencyConfig;
  onChange: (next: CurrencyConfig) => void;
  rates: RateRow[];
  ratesLoading?: boolean;
  mappedPriceFields: string[];
}) {
  const rate = effectiveRate(config, rates);
  const multiplier = totalMultiplier(config, rates);
  const sameCurrency = config.sourceCurrency === config.targetCurrency;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="source-currency">Kaynak XML para birimi</Label>
          <select
            id="source-currency"
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={config.sourceCurrency}
            onChange={(event) =>
              onChange({ ...config, sourceCurrency: event.target.value as FeedCurrency })
            }
          >
            {SUPPORTED_FEED_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Besleme dosyasındaki fiyatların para birimi.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Sistem para birimi</Label>
          <div className="flex h-9 items-center">
            <Badge variant="secondary" className="text-sm">{config.targetCurrency}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Mağaza fiyatları bu para biriminde saklanır.</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div className="min-w-0">
          <Label htmlFor="auto-convert" className="text-sm">Otomatik para birimi çevirimi</Label>
          <p className="text-xs text-muted-foreground">
            Açıkken fiyat alanlarına kur kuralı eklenir ve içe aktarımda fiyatlar çevrilir.
          </p>
        </div>
        <Switch
          id="auto-convert"
          checked={config.autoConvert}
          onCheckedChange={(checked) => onChange({ ...config, autoConvert: checked })}
        />
      </div>

      {config.autoConvert ? (
        <div className="space-y-4">
          {sameCurrency ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Kaynak ve sistem para birimi aynı — çevirim uygulanmaz.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>Kur kaynağı</Label>
            <RadioGroup
              value={config.exchangeRateType}
              onValueChange={(value) =>
                onChange({ ...config, exchangeRateType: value === "manual" ? "manual" : "auto" })
              }
              className="gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="rate-auto" />
                <Label htmlFor="rate-auto" className="text-sm font-normal">
                  Canlı TCMB kuru (otomatik)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="rate-manual" />
                <Label htmlFor="rate-manual" className="text-sm font-normal">
                  Sabit kur (elle)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {config.exchangeRateType === "manual" ? (
            <div className="space-y-1.5 sm:max-w-48">
              <Label htmlFor="manual-rate">Sabit kur çarpanı</Label>
              <Input
                id="manual-rate"
                type="number"
                min={0}
                step="0.0001"
                inputMode="decimal"
                value={config.manualRate}
                onChange={(event) =>
                  onChange({ ...config, manualRate: Math.max(0, Number(event.target.value) || 0) })
                }
              />
              <p className="text-xs text-muted-foreground">Örnek: 35,50</p>
            </div>
          ) : null}

          <div className="space-y-1.5 sm:max-w-48">
            <Label htmlFor="profit-margin">Kâr marjı (%)</Label>
            <Input
              id="profit-margin"
              type="number"
              step="0.1"
              inputMode="decimal"
              value={config.profitMarginPercent}
              onChange={(event) =>
                onChange({ ...config, profitMarginPercent: Number(event.target.value) || 0 })
              }
            />
          </div>

          <div className="rounded-lg border bg-background p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
              <RefreshCw className={`size-3 ${ratesLoading ? "animate-spin" : ""}`} />
              Güncel kurlar
            </p>
            {ratesLoading ? (
              <p className="mt-2 text-xs text-muted-foreground">Kurlar yükleniyor…</p>
            ) : rates.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Kayıtlı kur bulunamadı.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {rates.map((row) => (
                  <li key={row.code} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.code}/TRY: {row.rate.toFixed(4)}</span>
                    <span className="text-muted-foreground">
                      son güncelleme:{" "}
                      {row.updatedAt
                        ? new Date(row.updatedAt).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "bilinmiyor"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {rate > 0 && !sameCurrency ? (
              <p className="mt-3 text-xs">
                Uygulanan çarpan: <strong>{multiplier.toFixed(4)}</strong> · örnek{" "}
                {money(10, config.sourceCurrency)} → {money(10 * multiplier, config.targetCurrency)}
              </p>
            ) : !sameCurrency ? (
              <p className="mt-3 text-xs text-destructive">
                Kur bulunamadı; çevirim uygulanmaz. Sabit kur girebilirsiniz.
              </p>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {mappedPriceFields.length
              ? `Kur kuralı eklenecek alanlar: ${mappedPriceFields.join(", ")} — kaydetmeyi unutmayın.`
              : "Henüz eşlenmiş fiyat alanı yok; önce fiyat alanlarını eşleyin."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
