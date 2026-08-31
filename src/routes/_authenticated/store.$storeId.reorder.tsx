import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, PackagePlus, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { createPurchaseOrder } from "@/lib/purchasing.functions";
import { nextPurchaseOrderCode } from "@/lib/purchasing";
import { suppliersQuery } from "@/lib/purchasing-queries";
import {
  DEFAULT_REORDER_SETTINGS,
  buildReorderPlan,
  reorderPlanCost,
  type ReorderLine,
} from "@/lib/reorder";
import { reorderDataQuery } from "@/lib/reorder-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/reorder")({
  head: () => ({
    meta: [
      { title: "Yeniden Sipariş Planı — Mefticaret" },
      {
        name: "description",
        content:
          "Satış hızına, tedarik süresine ve emniyet stoğuna göre hangi ürünü ne zaman ve kaç adet sipariş etmen gerektiğini hesapla.",
      },
      { property: "og:title", content: "Yeniden Sipariş Planı — Mefticaret" },
      {
        property: "og:description",
        content: "Satış hızı bazlı tedarik planı ve tek tıkla satın alma siparişi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReorderPage,
});

const URGENCY_LABEL: Record<ReorderLine["urgency"], string> = {
  critical: "Acil",
  soon: "Yakında",
  ok: "Yeterli",
};

function ReorderPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [windowDays, setWindowDays] = useState(DEFAULT_REORDER_SETTINGS.windowDays);
  const [leadTimeDays, setLeadTimeDays] = useState(DEFAULT_REORDER_SETTINGS.leadTimeDays);
  const [safetyDays, setSafetyDays] = useState(DEFAULT_REORDER_SETTINGS.safetyDays);
  const [coverDays, setCoverDays] = useState(DEFAULT_REORDER_SETTINGS.coverDays);
  const [onlyNeeded, setOnlyNeeded] = useState(true);
  const [supplierId, setSupplierId] = useState("");

  const { data: inputs, isLoading } = useQuery(reorderDataQuery(storeId, windowDays));
  const { data: suppliers } = useQuery(suppliersQuery(storeId));
  const createOrderFn = useServerFn(createPurchaseOrder);

  const lines = useMemo(
    () =>
      buildReorderPlan(inputs ?? [], {
        windowDays,
        leadTimeDays,
        safetyDays,
        coverDays,
      }),
    [inputs, windowDays, leadTimeDays, safetyDays, coverDays],
  );

  const visible = onlyNeeded ? lines.filter((line) => line.suggestedQuantity > 0) : lines;
  const needed = lines.filter((line) => line.suggestedQuantity > 0);
  const planCost = reorderPlanCost(needed);
  const criticalCount = lines.filter((line) => line.urgency === "critical").length;

  const orderMutation = useMutation({
    mutationFn: () =>
      createOrderFn({
        data: {
          storeId,
          code: nextPurchaseOrderCode(),
          supplierId: supplierId || undefined,
          note: `Otomatik yeniden sipariş planı · ${windowDays} günlük satış hızı`,
          items: needed.slice(0, 200).map((line) => ({
            variantId: line.variantId,
            productId: line.productId ?? undefined,
            title: line.title,
            sku: line.sku ?? undefined,
            quantity: line.suggestedQuantity,
            unitCost: Number(line.costPrice ?? 0),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Satın alma siparişi oluşturuldu");
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders", storeId] });
      void navigate({ to: "/store/$storeId/purchasing", params: { storeId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportCsv = () => {
    downloadCsv(
      `yeniden-siparis-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "SKU",
          "Stok",
          "Günlük satış",
          "Kalan gün",
          "Sipariş noktası",
          "Önerilen adet",
          "Durum",
        ],
        visible.map((line) => [
          line.title,
          line.sku ?? "",
          line.stock,
          line.velocity,
          line.daysOfCover ?? "",
          line.reorderPoint,
          line.suggestedQuantity,
          URGENCY_LABEL[line.urgency],
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Yeniden Sipariş Planı"
      description="Satış hızı, tedarik süresi ve emniyet stoğuna göre tedarik önerileri."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Acil kalem", value: formatNumber(criticalCount) },
            { label: "Sipariş gereken kalem", value: formatNumber(needed.length) },
            {
              label: "Toplam önerilen adet",
              value: formatNumber(needed.reduce((sum, line) => sum + line.suggestedQuantity, 0)),
            },
            { label: "Tahmini maliyet", value: formatMoney(planCost) },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { id: "window", label: "Satış penceresi (gün)", value: windowDays, set: setWindowDays },
            { id: "lead", label: "Tedarik süresi (gün)", value: leadTimeDays, set: setLeadTimeDays },
            { id: "safety", label: "Emniyet stoğu (gün)", value: safetyDays, set: setSafetyDays },
            { id: "cover", label: "Kapsanacak süre (gün)", value: coverDays, set: setCoverDays },
          ].map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                type="number"
                min={1}
                max={365}
                value={field.value}
                onChange={(event) =>
                  field.set(Math.min(365, Math.max(1, Number(event.target.value) || 1)))
                }
              />
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={onlyNeeded ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyNeeded((previous) => !previous)}
            >
              <RefreshCcw className="mr-2 size-4" />
              {onlyNeeded ? "Sadece sipariş gerekenler" : "Tüm varyantlar"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
              <Download className="mr-2 size-4" /> CSV indir
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="reorder-supplier">Tedarikçi</Label>
              <select
                id="reorder-supplier"
                className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Seçilmedi</option>
                {(suppliers ?? []).map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              disabled={needed.length === 0 || orderMutation.isPending}
              onClick={() => orderMutation.mutate()}
            >
              <PackagePlus className="mr-2 size-4" /> Satın alma siparişi oluştur
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ürün / varyant</th>
                <th className="px-3 py-2 text-right">Stok</th>
                <th className="px-3 py-2 text-right">Günlük satış</th>
                <th className="px-3 py-2 text-right">Kalan gün</th>
                <th className="px-3 py-2 text-right">Sipariş noktası</th>
                <th className="px-3 py-2 text-right">Önerilen adet</th>
                <th className="px-3 py-2 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((line) => (
                <tr key={line.variantId}>
                  <td className="px-3 py-2">
                    <div className="truncate font-medium">{line.title}</div>
                    <div className="text-xs text-muted-foreground">{line.sku ?? "SKU yok"}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(line.stock)}</td>
                  <td className="px-3 py-2 text-right">{line.velocity}</td>
                  <td className="px-3 py-2 text-right">
                    {line.daysOfCover === null ? "—" : line.daysOfCover}
                  </td>
                  <td className="px-3 py-2 text-right">{line.reorderPoint}</td>
                  <td className="px-3 py-2 text-right font-medium">{line.suggestedQuantity}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge
                      variant={
                        line.urgency === "critical"
                          ? "destructive"
                          : line.urgency === "soon"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {URGENCY_LABEL[line.urgency]}
                    </Badge>
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>
                    {isLoading ? "Hesaplanıyor…" : "Şu an sipariş edilmesi gereken kalem yok."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
