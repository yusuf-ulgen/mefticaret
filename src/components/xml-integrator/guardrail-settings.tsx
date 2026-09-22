/**
 * Güvenlik sınırları kartı: anormal fiyat/stok verisinin canlıya yazılmasını
 * engelleyen kuralların satıcı tarafından ayarlandığı bölüm.
 */

import { ShieldCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ZERO_PRICE_ACTIONS,
  ZERO_STOCK_ACTIONS,
  type GuardrailConfig,
  type ZeroPriceAction,
  type ZeroStockAction,
} from "@/lib/xml-guardrail";

const ZERO_PRICE_LABELS: Record<ZeroPriceAction, string> = {
  quarantine: "İncelemeye al (önerilen)",
  skip: "Ürünü atla",
  allow: "Sıfır fiyata izin ver",
};

const ZERO_STOCK_LABELS: Record<ZeroStockAction, string> = {
  update: "Stoğu sıfır olarak güncelle",
  quarantine: "İncelemeye al",
};

export function GuardrailSettings({
  idPrefix = "guard",
  value,
  onChange,
}: {
  idPrefix?: string | undefined;
  value: GuardrailConfig;
  onChange: (next: GuardrailConfig) => void;
}) {
  const set = <K extends keyof GuardrailConfig>(key: K, next: GuardrailConfig[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor={`${idPrefix}-enabled`} className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Güvenlik sınırları
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Anormal fiyat ve stok verisi canlı ürünlere yazılmaz, incelemeye alınır.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={value.enabled}
          onCheckedChange={(checked) => set("enabled", checked)}
        />
      </div>

      {value.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-drop`}>En fazla fiyat düşüşü (%)</Label>
            <Input
              id={`${idPrefix}-drop`}
              type="number"
              min={0}
              value={value.maxPriceDropPercent}
              onChange={(event) => set("maxPriceDropPercent", Number(event.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Daha fazla düşerse ürün incelemeye alınır.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-rise`}>En fazla fiyat artışı (%)</Label>
            <Input
              id={`${idPrefix}-rise`}
              type="number"
              min={0}
              value={value.maxPriceIncreasePercent}
              onChange={(event) => set("maxPriceIncreasePercent", Number(event.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Daha fazla artarsa ürün incelemeye alınır.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-zero-price`}>Fiyat sıfır gelirse</Label>
            <select
              id={`${idPrefix}-zero-price`}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={value.zeroPriceAction}
              onChange={(event) => set("zeroPriceAction", event.target.value as ZeroPriceAction)}
            >
              {ZERO_PRICE_ACTIONS.map((item) => (
                <option key={item} value={item}>{ZERO_PRICE_LABELS[item]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-zero-stock`}>Stok sıfır gelirse</Label>
            <select
              id={`${idPrefix}-zero-stock`}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={value.zeroStockAction}
              onChange={(event) => set("zeroStockAction", event.target.value as ZeroStockAction)}
            >
              {ZERO_STOCK_ACTIONS.map((item) => (
                <option key={item} value={item}>{ZERO_STOCK_LABELS[item]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-email`}>İnceleme bildirimi e-postası</Label>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              value={value.notificationEmail}
              placeholder="ornek@magazam.com"
              onChange={(event) => set("notificationEmail", event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
