import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { inventoryMovementsQuery, inventoryQuery } from "@/lib/inventory-queries";
import type { InventoryMovementKind } from "@/lib/inventory-queries";
import { adjustStock, setLowStockThreshold } from "@/lib/inventory.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/inventory")({
  head: () => ({
    meta: [
      { title: "Stok Yönetimi — Mefticaret" },
      {
        name: "description",
        content:
          "Varyant bazlı stok sayımı, mal girişi, fire ve iade hareketleri ile kritik stok uyarıları.",
      },
      { property: "og:title", content: "Stok Yönetimi — Mefticaret" },
      {
        property: "og:description",
        content: "Stok hareketleri, kritik stok eşikleri ve değiştirilemez stok denetim izi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

const KIND_LABELS: Record<InventoryMovementKind, string> = {
  count: "Sayım (mutlak)",
  restock: "Mal girişi (+)",
  return: "İade girişi (+)",
  manual_out: "Manuel çıkış (−)",
  damage: "Fire / hasar (−)",
  sale: "Satış (−)",
};

function InventoryPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: variants, isLoading } = useQuery(inventoryQuery(storeId));
  const { data: movements } = useQuery(inventoryMovementsQuery(storeId));
  const adjust = useServerFn(adjustStock);
  const saveThreshold = useServerFn(setLowStockThreshold);

  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [kind, setKind] = useState<InventoryMovementKind>("restock");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    return (variants ?? []).filter((variant) => {
      const productTitle = variant.products?.title ?? "";
      const matches =
        !term ||
        productTitle.toLocaleLowerCase("tr").includes(term) ||
        variant.title.toLocaleLowerCase("tr").includes(term) ||
        (variant.sku ?? "").toLocaleLowerCase("tr").includes(term);
      const low = (variant.stock ?? 0) <= (variant.low_stock_threshold ?? 0);
      return matches && (!onlyLow || low);
    });
  }, [variants, search, onlyLow]);

  const totals = useMemo(() => {
    const list = variants ?? [];
    return {
      variants: list.length,
      units: list.reduce((sum, item) => sum + (item.stock ?? 0), 0),
      low: list.filter((item) => (item.stock ?? 0) <= (item.low_stock_threshold ?? 0)).length,
      value: list.reduce((sum, item) => sum + (item.stock ?? 0) * Number(item.price ?? 0), 0),
    };
  }, [variants]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-movements", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["products", storeId] }),
    ]);
  };

  const adjustMutation = useMutation({
    mutationFn: (variantId: string) =>
      adjust({
        data: {
          storeId,
          variantId,
          kind,
          amount: Math.max(0, Number(amount) || 0),
          reason: reason || undefined,
        },
      }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`Stok güncellendi: ${result.before} → ${result.stock}`);
      setActiveVariant(null);
      setAmount("1");
      setReason("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const thresholdMutation = useMutation({
    mutationFn: (input: { variantId: string; threshold: number }) =>
      saveThreshold({ data: { storeId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Kritik stok eşiği güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = (variants ?? []).find((item) => item.id === activeVariant);

  return (
    <AppShell
      storeId={storeId}
      title="Stok Yönetimi"
      description="Varyant bazlı stok hareketleri, kritik stok uyarıları ve denetim izi."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Varyant", value: String(totals.variants) },
            { label: "Toplam adet", value: String(totals.units) },
            { label: "Kritik stok", value: String(totals.low) },
            { label: "Stok değeri", value: formatMoney(totals.value) },
          ].map((kpi) => (
            <div key={kpi.label} className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Ürün, varyant veya SKU ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            type="button"
            variant={onlyLow ? "default" : "outline"}
            onClick={() => setOnlyLow((prev) => !prev)}
          >
            <TriangleAlert className="mr-2 size-4" />
            Sadece kritik stok
          </Button>
        </div>

        <div className="surface-card overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Boxes className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Gösterilecek varyant yok</p>
              <p className="text-sm text-muted-foreground">
                Ürünler sayfasından varyant ekleyerek stok takibine başla.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Ürün / Varyant</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Stok</th>
                  <th className="px-5 py-3">Kritik eşik</th>
                  <th className="px-5 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((variant) => {
                  const low = (variant.stock ?? 0) <= (variant.low_stock_threshold ?? 0);
                  return (
                    <tr key={variant.id} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium">{variant.products?.title ?? "Ürün"}</p>
                        <p className="text-xs text-muted-foreground">{variant.title}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {variant.sku ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold">{variant.stock ?? 0}</span>{" "}
                        {low ? (
                          <Badge variant="destructive" className="ml-2">
                            Kritik
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Input
                          className="h-9 w-20"
                          type="number"
                          min={0}
                          defaultValue={variant.low_stock_threshold ?? 0}
                          aria-label={`${variant.title} kritik stok eşiği`}
                          onBlur={(event) => {
                            const next = Number(event.target.value) || 0;
                            if (next !== (variant.low_stock_threshold ?? 0)) {
                              thresholdMutation.mutate({
                                variantId: variant.id,
                                threshold: next,
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveVariant(variant.id)}
                        >
                          Stok hareketi
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">Son stok hareketleri</h2>
          <p className="text-sm text-muted-foreground">
            Hareket kayıtları değiştirilemez; denetim izi olarak saklanır.
          </p>
          <ul className="mt-4 space-y-3">
            {(movements ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Henüz hareket yok.</li>
            ) : (
              (movements ?? []).map((movement) => (
                <li
                  key={movement.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {movement.products?.title ?? "Ürün"} ·{" "}
                      {movement.product_variants?.title ?? "Varyant"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABELS[movement.kind as InventoryMovementKind]} ·{" "}
                      {formatDateTime(movement.created_at)}
                      {movement.reason ? ` · ${movement.reason}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {movement.stock_before} → {movement.stock_after}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <Sheet open={Boolean(activeVariant)} onOpenChange={(open) => !open && setActiveVariant(null)}>
        <SheetContent className="w-full max-w-md space-y-5 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Stok hareketi</SheetTitle>
            <SheetDescription>
              {current
                ? `${current.products?.title ?? "Ürün"} · ${current.title} (mevcut: ${current.stock ?? 0})`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            <Label>Hareket tipi</Label>
            <Select value={kind} onValueChange={(next) => setKind(next as InventoryMovementKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as InventoryMovementKind[])
                  .filter((key) => key !== "sale")
                  .map((key) => (
                    <SelectItem key={key} value={key}>
                      {KIND_LABELS[key]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-amount">
              {kind === "count" ? "Sayım sonucu stok" : "Miktar"}
            </Label>
            <Input
              id="inv-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-reason">Sebep / not</Label>
            <Input
              id="inv-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Tedarikçi sevkiyatı, depo sayımı…"
            />
          </div>
          <Button
            className="w-full"
            disabled={adjustMutation.isPending || !activeVariant}
            onClick={() => activeVariant && adjustMutation.mutate(activeVariant)}
          >
            {adjustMutation.isPending ? "Kaydediliyor…" : "Hareketi kaydet"}
          </Button>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
