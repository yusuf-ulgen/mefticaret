import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Truck } from "lucide-react";
import { useState } from "react";
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
import { connectorsQuery, shippingZonesQuery } from "@/lib/commerce-queries";
import {
  deleteShippingRate,
  deleteShippingZone,
  upsertShippingRate,
  upsertShippingZone,
} from "@/lib/commerce.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/shipping")({
  head: () => ({
    meta: [
      { title: "Kargo & Teslimat — Mefticaret" },
      {
        name: "description",
        content:
          "Ülke ve şehir bazlı kargo bölgeleri, kargo firması connector'ları ve ücretsiz kargo eşikleri.",
      },
      { property: "og:title", content: "Kargo & Teslimat — Mefticaret" },
      {
        property: "og:description",
        content: "Bölge bazlı kargo tarifeleri, teslim süresi ve ücretsiz kargo kuralları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShippingPage,
});

const NO_CONNECTOR = "none";

function ShippingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: zones, isLoading } = useQuery(shippingZonesQuery(storeId));
  const { data: connectors } = useQuery(connectorsQuery("shipping"));
  const saveZone = useServerFn(upsertShippingZone);
  const removeZone = useServerFn(deleteShippingZone);
  const saveRate = useServerFn(upsertShippingRate);
  const removeRate = useServerFn(deleteShippingRate);

  const [zoneName, setZoneName] = useState("");
  const [zoneCountries, setZoneCountries] = useState("TR");
  const [rateForm, setRateForm] = useState<Record<string, { title: string; price: string; freeOver: string; eta: string; connectorId: string }>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shipping-zones", storeId] });

  const zoneMutation = useMutation({
    mutationFn: () =>
      saveZone({
        data: {
          storeId,
          name: zoneName,
          countries: zoneCountries
            .split(",")
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length === 2),
          cities: [],
          isActive: true,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Kargo bölgesi eklendi");
      setZoneName("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const zoneDeleteMutation = useMutation({
    mutationFn: (zoneId: string) => removeZone({ data: { storeId, zoneId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Bölge silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rateMutation = useMutation({
    mutationFn: (zoneId: string) => {
      const form = rateForm[zoneId];
      return saveRate({
        data: {
          storeId,
          zoneId,
          title: form?.title ?? "",
          price: Number(form?.price ?? 0) || 0,
          freeOver: form?.freeOver ? Number(form.freeOver) : null,
          etaDays: form?.eta ? Number(form.eta) : null,
          connectorId:
            form?.connectorId && form.connectorId !== NO_CONNECTOR ? form.connectorId : null,
          isActive: true,
        },
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Tarife kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rateDeleteMutation = useMutation({
    mutationFn: (rateId: string) => removeRate({ data: { storeId, rateId } }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setField = (zoneId: string, field: string, value: string) =>
    setRateForm((prev) => ({
      ...prev,
      [zoneId]: {
        title: "",
        price: "",
        freeOver: "",
        eta: "",
        connectorId: NO_CONNECTOR,
        ...prev[zoneId],
        [field]: value,
      },
    }));

  return (
    <AppShell
      storeId={storeId}
      title="Kargo & Teslimat"
      description="Bölge bazlı kargo tarifeleri ve kargo firması connector'ları."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          className="surface-card h-fit space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            zoneMutation.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Yeni bölge</h2>
          <div className="space-y-2">
            <Label htmlFor="zone-name">Bölge adı</Label>
            <Input
              id="zone-name"
              required
              minLength={2}
              value={zoneName}
              onChange={(event) => setZoneName(event.target.value)}
              placeholder="Türkiye"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-countries">Ülke kodları (virgülle)</Label>
            <Input
              id="zone-countries"
              value={zoneCountries}
              onChange={(event) => setZoneCountries(event.target.value)}
              placeholder="TR, DE, NL"
            />
          </div>
          <Button type="submit" className="w-full" disabled={zoneMutation.isPending}>
            {zoneMutation.isPending ? "Ekleniyor…" : "Bölge ekle"}
          </Button>
        </form>

        <div className="space-y-6 lg:col-span-2">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (zones ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Truck className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz kargo bölgesi yok</p>
              <p className="text-sm text-muted-foreground">
                Soldaki formla ilk bölgeni oluştur ve tarife ekle.
              </p>
            </div>
          ) : (
            (zones ?? []).map((zone) => (
              <div key={zone.id} className="surface-card space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{zone.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(zone.countries ?? []).join(", ") || "Ülke belirtilmedi"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`${zone.name} bölgesini sil`}
                    onClick={() => zoneDeleteMutation.mutate(zone.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <ul className="space-y-2">
                  {(zone.shipping_rates ?? []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">Bu bölgede tarife yok.</li>
                  ) : (
                    (zone.shipping_rates ?? []).map((rate) => (
                      <li
                        key={rate.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{rate.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {rate.connectors?.name ?? "Manuel"}
                            {rate.eta_days ? ` · ${rate.eta_days} gün` : ""}
                            {rate.free_over
                              ? ` · ${formatMoney(Number(rate.free_over))} üzeri ücretsiz`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{formatMoney(Number(rate.price))}</Badge>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`${rate.title} tarifesini sil`}
                            onClick={() => rateDeleteMutation.mutate(rate.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>

                <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border/60 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Input
                    aria-label="Tarife adı"
                    placeholder="Standart Kargo"
                    value={rateForm[zone.id]?.title ?? ""}
                    onChange={(event) => setField(zone.id, "title", event.target.value)}
                  />
                  <Input
                    aria-label="Ücret"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="49.90"
                    value={rateForm[zone.id]?.price ?? ""}
                    onChange={(event) => setField(zone.id, "price", event.target.value)}
                  />
                  <Input
                    aria-label="Ücretsiz kargo eşiği"
                    type="number"
                    min={0}
                    placeholder="Ücretsiz eşiği"
                    value={rateForm[zone.id]?.freeOver ?? ""}
                    onChange={(event) => setField(zone.id, "freeOver", event.target.value)}
                  />
                  <Select
                    value={rateForm[zone.id]?.connectorId ?? NO_CONNECTOR}
                    onValueChange={(next) => setField(zone.id, "connectorId", next)}
                  >
                    <SelectTrigger aria-label="Kargo firması">
                      <SelectValue placeholder="Kargo firması" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CONNECTOR}>Manuel</SelectItem>
                      {(connectors ?? []).map((connector) => (
                        <SelectItem key={connector.id} value={connector.id}>
                          {connector.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={rateMutation.isPending || !(rateForm[zone.id]?.title ?? "").trim()}
                    onClick={() => rateMutation.mutate(zone.id)}
                  >
                    <Plus className="mr-1 size-4" />
                    Tarife
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
