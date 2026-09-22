/**
 * PricingRulesPanel — besleme fiyatlandırma kuralları: KDV, kâr marjı (sabit veya
 * kademeli), pazaryeri gideri ve yuvarlama; canlı örnek hesap gösterir.
 */

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { explainPrice, type PricingRules, type PricingTier } from "@/lib/xml-pricing-rules";

const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const ROUNDING_OPTIONS = [
  { value: "none", label: "Yuvarlama yok (kuruşlu)" },
  { value: "round_99", label: "X,99 ile bitir" },
  { value: "round_90", label: "X,90 ile bitir" },
  { value: "integer", label: "Tam sayıya yuvarla" },
] as const;

const VAT_OPTIONS = [
  { value: "none", label: "KDV işlemi yok", hint: "Fiyat kaynaktaki gibi kalır" },
  { value: "add_vat", label: "KDV ekle (+%)", hint: "Alış fiyatına KDV eklenir" },
  { value: "remove_vat", label: "KDV çıkar (-%)", hint: "Fiyat KDV'den arındırılır" },
] as const;

export function PricingRulesPanel({
  rules,
  onChange,
}: {
  rules: PricingRules;
  onChange: (next: PricingRules) => void;
}) {
  const [samplePrice, setSamplePrice] = useState("100");
  const base = Number(samplePrice.replace(",", ".")) || 0;
  const steps = explainPrice(base, rules);
  const result = steps[steps.length - 1]?.value ?? 0;

  const patch = (partial: Partial<PricingRules>) => onChange({ ...rules, ...partial });
  const patchTier = (index: number, partial: Partial<PricingTier>) =>
    patch({
      tieredMargins: rules.tieredMargins.map((tier, i) => (i === index ? { ...tier, ...partial } : tier)),
    });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Fiyatlandırma kuralları</h3>
            <p className="text-xs text-muted-foreground">
              Kaynaktaki alış fiyatına sırayla KDV, kâr marjı, pazaryeri gideri ve yuvarlama uygulanır.
            </p>
          </div>
          <Badge variant="secondary">Sıra: KDV → marj → gider → yuvarlama</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="KDV işlemi">
          {VAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={rules.vatAction === option.value}
              onClick={() => patch({ vatAction: option.value })}
              className={`rounded-lg border p-3 text-left transition ${
                rules.vatAction === option.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>

        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="vat-rate">KDV oranı (%)</Label>
          <Input
            id="vat-rate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={rules.vatRate}
            disabled={rules.vatAction === "none"}
            onChange={(event) => patch({ vatRate: Number(event.target.value) || 0 })}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="tiered">
              {rules.marginType === "tiered" ? "Kademeli marj (fiyat aralıkları)" : "Sabit marj (tek oran)"}
            </Label>
            <p className="text-xs text-muted-foreground">
              Kapalıyken tüm ürünlere aynı oran uygulanır; açıkken alış fiyatı aralığına göre oran değişir.
            </p>
          </div>
          <Switch
            id="tiered"
            checked={rules.marginType === "tiered"}
            onCheckedChange={(checked) => patch({ marginType: checked ? "tiered" : "flat" })}
          />
        </div>

        {rules.marginType === "flat" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="flat-margin">Kâr marjı (%)</Label>
              <Input
                id="flat-margin"
                type="number"
                step="0.1"
                value={rules.flatMarginPercent}
                onChange={(event) => patch({ flatMarginPercent: Number(event.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flat-add">Sabit ek tutar (TL)</Label>
              <Input
                id="flat-add"
                type="number"
                step="0.01"
                value={rules.flatAddAmount}
                onChange={(event) => patch({ flatAddAmount: Number(event.target.value) || 0 })}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.tieredMargins.length === 0 ? (
              <p className="text-xs text-muted-foreground">Henüz kademe eklenmedi.</p>
            ) : null}
            {rules.tieredMargins.map((tier, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <Input
                  type="number"
                  placeholder="Alt sınır"
                  value={tier.min}
                  onChange={(event) => patchTier(index, { min: Number(event.target.value) || 0 })}
                />
                <Input
                  type="number"
                  placeholder="Üst sınır (boş: sınırsız)"
                  value={tier.max ?? ""}
                  onChange={(event) =>
                    patchTier(index, {
                      max: event.target.value === "" ? null : Number(event.target.value) || 0,
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Marj %"
                  value={tier.margin}
                  onChange={(event) => patchTier(index, { margin: Number(event.target.value) || 0 })}
                />
                <Input
                  type="number"
                  placeholder="Ek tutar"
                  value={tier.addAmount}
                  onChange={(event) => patchTier(index, { addAmount: Number(event.target.value) || 0 })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Kademeyi kaldır"
                  onClick={() =>
                    patch({ tieredMargins: rules.tieredMargins.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rules.tieredMargins.length >= 20}
              onClick={() =>
                patch({
                  tieredMargins: [
                    ...rules.tieredMargins,
                    { min: 0, max: null, margin: 0, addAmount: 0 },
                  ],
                })
              }
            >
              <Plus className="mr-2 size-4" /> Fiyat aralığı ekle
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold">Pazaryeri gideri ve yuvarlama</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="commission">Komisyon (%)</Label>
            <Input
              id="commission"
              type="number"
              min={0}
              step="0.1"
              value={rules.marketplaceFees.commissionPercent}
              onChange={(event) =>
                patch({
                  marketplaceFees: {
                    ...rules.marketplaceFees,
                    commissionPercent: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shipping">Kargo gideri (TL)</Label>
            <Input
              id="shipping"
              type="number"
              min={0}
              step="0.01"
              value={rules.marketplaceFees.shippingFee}
              onChange={(event) =>
                patch({
                  marketplaceFees: {
                    ...rules.marketplaceFees,
                    shippingFee: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Yuvarlama</Label>
            <Select
              value={rules.roundingType}
              onValueChange={(value) => patch({ roundingType: value as PricingRules["roundingType"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-muted/40 p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sample">Fiyat simülatörü — örnek alış fiyatı (TL)</Label>
            <Input
              id="sample"
              className="w-40"
              value={samplePrice}
              onChange={(event) => setSamplePrice(event.target.value)}
            />
          </div>
          <Badge variant="secondary">Son fiyat: {money(result)} TL</Badge>
        </div>

        <ol className="space-y-1 text-sm">
          {steps.map((step, index) => (
            <li key={`${step.label}-${index}`} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {index + 1}. {step.label}
              </span>
              <span className={index === steps.length - 1 ? "font-semibold" : ""}>
                {money(step.value)} TL
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
