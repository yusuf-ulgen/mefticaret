import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Gauge, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROUNDING_LABELS, type RoundingMode } from "@/lib/pricing-engine";
import { REPRICING_STRATEGY_LABELS, type RepricingStrategy } from "@/lib/repricing";
import { repricingEventsQuery, repricingRulesQuery } from "@/lib/nextgen-queries";
import {
  deleteRepricingRuleFn,
  runRepricingFn,
  saveRepricingRuleFn,
} from "@/lib/repricing.functions";

type Props = { storeId: string; products: { id: string; title: string }[] };

type PreviewItem = Awaited<ReturnType<typeof runRepricingFn>>["items"][number];

const ROUNDING_OPTIONS: RoundingMode[] = ["none", "nearest_1", "nearest_5", "psych_99", "psych_95", "psych_90"];

function money(value: number, currency: string) {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * Rakip fiyatlarına göre otomatik yeniden fiyatlama.
 * Kurallar taban/tavan fiyat, en az kâr marjı ve maksimum değişim sınırı ile korunur;
 * fiyat değişikliği yalnızca sunucudaki kural motorundan geçerek uygulanır.
 */
export function AutoRepricingPanel({ storeId, products }: Props) {
  const queryClient = useQueryClient();
  const { data: rules } = useQuery(repricingRulesQuery(storeId));
  const { data: events } = useQuery(repricingEventsQuery(storeId));

  const saveRule = useServerFn(saveRepricingRuleFn);
  const removeRule = useServerFn(deleteRepricingRuleFn);
  const runFn = useServerFn(runRepricingFn);

  const [name, setName] = useState("Rakip takibi");
  const [productId, setProductId] = useState("all");
  const [strategy, setStrategy] = useState<RepricingStrategy>("undercut_percent");
  const [value, setValue] = useState("2");
  const [minMargin, setMinMargin] = useState("10");
  const [floor, setFloor] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [maxChange, setMaxChange] = useState("15");
  const [rounding, setRounding] = useState<RoundingMode>("psych_99");
  const [autoApply, setAutoApply] = useState(false);
  const [preview, setPreview] = useState<PreviewItem[]>([]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["repricing-rules", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["repricing-events", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["products", storeId] });
  };

  const num = (input: string) => Number(input.replace(",", "."));

  const saveMutation = useMutation({
    mutationFn: () =>
      saveRule({
        data: {
          storeId,
          productId: productId === "all" ? null : productId,
          name,
          isActive: true,
          strategy,
          value: num(value) || 0,
          minMarginPct: num(minMargin) || 0,
          floorPrice: floor ? num(floor) : null,
          ceilingPrice: ceiling ? num(ceiling) : null,
          maxChangePct: num(maxChange) || 0,
          rounding,
          autoApply,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Fiyatlama kuralı kaydedildi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: (apply: boolean) => runFn({ data: { storeId, apply } as never }),
    onSuccess: (result, apply) => {
      setPreview(result.items);
      if (apply) {
        toast.success(
          result.appliedCount > 0
            ? `${result.appliedCount} ürünün fiyatı güncellendi`
            : "Güncellenecek fiyat bulunamadı",
        );
      } else {
        toast.success(
          result.items.length > 0
            ? `${result.items.length} ürün için öneri hazırlandı`
            : "Rakip fiyatı eşleşen ürün bulunamadı",
        );
      }
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule({ data: { storeId, id } as never }),
    onSuccess: () => {
      toast.success("Kural silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Otomatik fiyatlama kuralı</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp-name">Kural adı</Label>
            <Input id="rp-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ürün</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm eşleşen ürünler</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Strateji</Label>
            <Select value={strategy} onValueChange={(next) => setStrategy(next as RepricingStrategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REPRICING_STRATEGY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-value">
              {strategy === "undercut_amount" ? "Tutar farkı" : "Yüzde farkı"}
            </Label>
            <Input id="rp-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-margin">En az kâr marjı (%)</Label>
            <Input
              id="rp-margin"
              inputMode="decimal"
              value={minMargin}
              onChange={(e) => setMinMargin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-max">Tek seferde en fazla değişim (%)</Label>
            <Input id="rp-max" inputMode="decimal" value={maxChange} onChange={(e) => setMaxChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-floor">Taban fiyat (boş = yok)</Label>
            <Input id="rp-floor" inputMode="decimal" value={floor} onChange={(e) => setFloor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-ceiling">Tavan fiyat (boş = yok)</Label>
            <Input id="rp-ceiling" inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Yuvarlama</Label>
            <Select value={rounding} onValueChange={(next) => setRounding(next as RoundingMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_OPTIONS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {ROUNDING_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="rp-auto" checked={autoApply} onCheckedChange={setAutoApply} />
            <Label htmlFor="rp-auto" className="text-sm">
              Öneriyi otomatik uygula
            </Label>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Kuralı kaydet
          </Button>
          <Button
            variant="outline"
            onClick={() => runMutation.mutate(false)}
            disabled={runMutation.isPending}
          >
            <Play className="mr-2 h-4 w-4" /> Önerileri hesapla
          </Button>
          <Button
            variant="secondary"
            onClick={() => runMutation.mutate(true)}
            disabled={runMutation.isPending}
          >
            Fiyatları uygula
          </Button>
        </div>
      </div>

      {(rules ?? []).length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Kurallar</h3>
          <div className="space-y-2">
            {(rules ?? []).map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {REPRICING_STRATEGY_LABELS[rule.strategy]} · %{rule.value} · en az marj %{rule.minMarginPct} ·
                    en fazla değişim %{rule.maxChangePct}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rule.autoApply ? <Badge>Otomatik</Badge> : <Badge variant="outline">Öneri</Badge>}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(rule.id)}
                    aria-label="Kuralı sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Fiyat önerileri</h3>
          <div className="space-y-2">
            {preview.map((item) => (
              <div key={item.productId} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{item.productTitle}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground line-through">
                      {money(item.currentPrice, item.currency)}
                    </span>
                    <span className="font-semibold">{money(item.suggestedPrice, item.currency)}</span>
                    <Badge variant={item.changePct < 0 ? "outline" : "secondary"}>
                      {item.changePct > 0 ? "+" : ""}
                      {item.changePct.toFixed(1)}%
                    </Badge>
                    {item.applied && <Badge>Uygulandı</Badge>}
                  </div>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {item.competitorName
                    ? `Rakip: ${item.competitorName} — ${money(item.competitorPrice ?? 0, item.currency)}. `
                    : ""}
                  {item.reasons.join(" ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(events ?? []).length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Fiyat hareketleri</h3>
          <div className="space-y-2">
            {(events ?? []).slice(0, 20).map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm">
                <span>{event.productTitle}</span>
                <span className="text-muted-foreground text-xs">
                  {money(event.oldPrice, event.currency)} → {money(event.suggestedPrice, event.currency)} ·{" "}
                  {new Date(event.createdAt).toLocaleString("tr-TR")} ·{" "}
                  {event.applied ? "uygulandı" : "öneri"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
