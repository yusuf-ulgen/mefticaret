import { Calculator, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BigButton, Field, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { formatMoney } from "@/lib/mefti";

/**
 * "Maliyet Hesapla": malzeme + emek girdisinden tavsiye satış fiyatı ve
 * tahmini kâr oranını hesaplar. Hesap tamamen ekranda yapılır; fiyat yalnızca
 * kullanıcı "Bu fiyatı ürüne uygula" derse kaydedilir.
 */
export function CostCalculatorSheet({
  open,
  onClose,
  currency = "TRY",
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  currency?: string;
  onApply?: (price: number) => void;
}) {
  const [material, setMaterial] = useState("");
  const [hours, setHours] = useState("2");
  const [hourly, setHourly] = useState("100");
  const [margin, setMargin] = useState("35");

  const result = useMemo(() => {
    const materialCost = Number(material.replace(",", ".")) || 0;
    const hourCount = Number(hours.replace(",", ".")) || 0;
    const hourlyRate = Number(hourly.replace(",", ".")) || 0;
    const marginRate = Math.min(90, Math.max(0, Number(margin.replace(",", ".")) || 0));
    const laborCost = hourCount * hourlyRate;
    const cost = materialCost + laborCost;
    const price = marginRate >= 90 ? cost * 2 : cost / (1 - marginRate / 100);
    const suggested = Math.ceil(price / 5) * 5;
    const profit = suggested - cost;
    const profitRate = suggested > 0 ? (profit / suggested) * 100 : 0;
    return { materialCost, laborCost, cost, suggested, profit, profitRate };
  }, [material, hours, hourly, margin]);

  return (
    <Sheet open={open} title="Maliyet hesapla" onClose={onClose}>
      <div className="grid gap-4">
        <Field label={`Harcanan malzeme (${currency})`} hint="Kumaş, iplik, malzeme, ambalaj…">
          <input
            className={inputClass}
            inputMode="decimal"
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            placeholder="80"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Emek (saat)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
          <Field label={`Saat ücretiniz (${currency})`}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={hourly}
              onChange={(event) => setHourly(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Hedef kâr oranı (%)" hint="Kaydırmadan da yazabilirsiniz.">
          <input
            className={inputClass}
            inputMode="numeric"
            value={margin}
            onChange={(event) => setMargin(event.target.value)}
          />
        </Field>

        <SoftCard className="grid gap-2 bg-hm-sand">
          <p className="text-sm text-hm-ink-soft">
            Malzeme {formatMoney(result.materialCost, currency)} + emek{" "}
            {formatMoney(result.laborCost, currency)} = maliyet{" "}
            <span className="font-semibold text-hm-ink">{formatMoney(result.cost, currency)}</span>
          </p>
          <p className="text-sm font-semibold text-hm-ink">Tavsiye edilen satış fiyatı</p>
          <p className="text-3xl font-bold text-hm-rose">
            {formatMoney(result.suggested, currency)}
          </p>
          <p className="text-sm text-hm-teal">
            Tahmini kâr {formatMoney(result.profit, currency)} · %{result.profitRate.toFixed(0)}
          </p>
        </SoftCard>

        {onApply ? (
          <BigButton
            className="w-full"
            disabled={result.suggested <= 0}
            onClick={() => {
              onApply(result.suggested);
              toast.success(`Fiyat ${formatMoney(result.suggested, currency)} olarak kullanılacak`);
              onClose();
            }}
          >
            <Check className="size-5" /> Bu fiyatı ürüne uygula
          </BigButton>
        ) : (
          <BigButton
            tone="ghost"
            className="w-full"
            onClick={() => {
              toast.success(`Tavsiye fiyat: ${formatMoney(result.suggested, currency)}`);
            }}
          >
            <Calculator className="size-5" /> Hesabı gör
          </BigButton>
        )}
      </div>
    </Sheet>
  );
}
