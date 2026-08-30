import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Tags } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { productsQuery } from "@/lib/catalog-queries";
import { formatMoney } from "@/lib/mefti";
import { applyBulkPricing } from "@/lib/pricing.functions";
import {
  PRICE_MODE_LABELS,
  ROUND_MODE_LABELS,
  computePrice,
  priceDelta,
  type PriceMode,
  type RoundMode,
} from "@/lib/pricing";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/pricing")({
  head: () => ({
    meta: [
      { title: "Toplu Fiyatlandırma — Mefticaret" },
      {
        name: "description",
        content:
          "Seçtiğiniz ürünlerde yüzde veya tutar bazlı toplu fiyat değişikliği yapın, psikolojik yuvarlama uygulayın ve önizleyin.",
      },
      { property: "og:title", content: "Toplu Fiyatlandırma — Mefticaret" },
      {
        property: "og:description",
        content: "Kampanya fiyatlarını tek ekranda önizleyip toplu uygulayın.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products, isLoading } = useQuery(productsQuery(storeId));
  const currency = store?.currency ?? "TRY";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PriceMode>("increase_percent");
  const [round, setRound] = useState<RoundMode>("x99");
  const [value, setValue] = useState("10");
  const [includeVariants, setIncludeVariants] = useState(true);
  const [setCompareAtToOld, setSetCompareAtToOld] = useState(true);
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLocaleLowerCase("tr");
    return (products ?? []).filter((product) =>
      q ? product.title.toLocaleLowerCase("tr").includes(q) : true,
    );
  }, [products, term]);

  const numericValue = Number(value.replace(",", ".")) || 0;

  const preview = useMemo(
    () =>
      rows
        .filter((product) => selected.has(String(product.id)))
        .map((product) => {
          const before = Number(product.base_price ?? 0);
          const after = computePrice(before, mode, numericValue, round);
          return { id: String(product.id), title: product.title, before, after, delta: priceDelta(before, after) };
        }),
    [rows, selected, mode, numericValue, round],
  );

  const apply = useServerFn(applyBulkPricing);
  const mutation = useMutation({
    mutationFn: () =>
      apply({
        data: {
          storeId,
          productIds: [...selected],
          mode,
          value: numericValue,
          round,
          includeVariants,
          setCompareAtToOld,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.productCount} ürün${result.variantCount ? ` ve ${result.variantCount} varyant` : ""} güncellendi`,
      );
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = rows.length > 0 && rows.every((product) => selected.has(String(product.id)));

  return (
    <AppShell storeId={storeId} title="Toplu Fiyatlandırma">
      <div className="space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Tags className="size-5 text-primary" /> Toplu fiyatlandırma
          </h1>
          <p className="text-sm text-muted-foreground">
            Kampanya ve zam işlemlerini ürün ürün dolaşmadan uygulayın; değişiklikleri kaydetmeden önce önizleyin.
          </p>
        </header>

        <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-4">
          <div className="space-y-2">
            <Label>İşlem</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PriceMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRICE_MODE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricing-value">Değer</Label>
            <Input
              id="pricing-value"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Yuvarlama</Label>
            <Select value={round} onValueChange={(v) => setRound(v as RoundMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROUND_MODE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="variants" className="text-xs">
                Varyantlara da uygula
              </Label>
              <Switch id="variants" checked={includeVariants} onCheckedChange={setIncludeVariants} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="compare" className="text-xs">
                İndirimde eski fiyatı göster
              </Label>
              <Switch id="compare" checked={setCompareAtToOld} onCheckedChange={setSetCompareAtToOld} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <Input
              placeholder="Ürün ara…"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(rows.map((product) => String(product.id))))
              }
              disabled={rows.length === 0}
            >
              {allSelected ? "Seçimi temizle" : "Tümünü seç"}
            </Button>
            <Badge variant="secondary">{selected.size} seçili</Badge>
            <Button
              className="ml-auto"
              onClick={() => mutation.mutate()}
              disabled={selected.size === 0 || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Fiyatları uygula
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Ürün bulunamadı.</p>
          ) : (
            <div className="divide-y">
              {rows.map((product) => {
                const id = String(product.id);
                const before = Number(product.base_price ?? 0);
                const isSelected = selected.has(id);
                const after = computePrice(before, mode, numericValue, round);
                return (
                  <label key={id} className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggle(id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(product.status)} · {product.product_variants?.length ?? 0} varyant
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatMoney(before, currency)}
                    </span>
                    {isSelected ? (
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          after > before ? "text-primary" : after < before ? "text-destructive" : "",
                        )}
                      >
                        → {formatMoney(after, currency)}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {preview.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Önizleme: {preview.length} ürün, ortalama değişim{" "}
            {(preview.reduce((sum, row) => sum + row.delta, 0) / preview.length).toFixed(1)}%.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
