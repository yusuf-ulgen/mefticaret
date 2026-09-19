import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PackageCheck, Route, Trash2, Truck } from "lucide-react";
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
import { CARRIER_CATALOG, GLOBAL_COUNTRIES, GLOBAL_CURRENCIES } from "@/lib/global-commerce";
import { carrierQuotesQuery, returnHubsQuery, returnLabelsQuery } from "@/lib/growth-export-queries";
import {
  compareCarriers,
  createInternationalReturnLabel,
  deleteCarrierQuote,
  deleteReturnHub,
  saveCarrierQuote,
  saveReturnHub,
  simulateWarehouseRouting,
  updateReturnLabelStatus,
} from "@/lib/growth-export.functions";
import { ordersQuery } from "@/lib/sales-queries";

type Props = { storeId: string };

const RETURN_STATUS: Record<string, string> = {
  draft: "Taslak",
  issued: "Oluşturuldu",
  in_transit: "Yolda",
  received: "Teslim alındı",
  cancelled: "İptal",
};

/** Yerel iade hub'ları, uluslararası iade etiketleri, taşıyıcı karşılaştırma ve depo yönlendirme. */
export function LogisticsReturnsPanel({ storeId }: Props) {
  const queryClient = useQueryClient();
  const { data: hubs } = useQuery(returnHubsQuery(storeId));
  const { data: labels } = useQuery(returnLabelsQuery(storeId));
  const { data: quotes } = useQuery(carrierQuotesQuery(storeId));
  const { data: orders } = useQuery(ordersQuery(storeId));

  const saveHub = useServerFn(saveReturnHub);
  const removeHub = useServerFn(deleteReturnHub);
  const createLabel = useServerFn(createInternationalReturnLabel);
  const updateLabel = useServerFn(updateReturnLabelStatus);
  const saveQuote = useServerFn(saveCarrierQuote);
  const removeQuote = useServerFn(deleteCarrierQuote);
  const compare = useServerFn(compareCarriers);
  const simulate = useServerFn(simulateWarehouseRouting);

  const [hubCountry, setHubCountry] = useState("DE");
  const [hubName, setHubName] = useState("");
  const [hubCity, setHubCity] = useState("");
  const [hubAddress, setHubAddress] = useState("");
  const [hubCarrier, setHubCarrier] = useState("dhl");

  const [orderId, setOrderId] = useState("");
  const [labelTracking, setLabelTracking] = useState("");

  const [quoteCountry, setQuoteCountry] = useState("DE");
  const [quoteCarrier, setQuoteCarrier] = useState("dhl");
  const [quoteWeight, setQuoteWeight] = useState("1000");
  const [quoteCost, setQuoteCost] = useState("18");
  const [quoteCurrency, setQuoteCurrency] = useState("EUR");
  const [quoteTransit, setQuoteTransit] = useState("3");

  const [compareCountry, setCompareCountry] = useState("DE");
  const [compareStrategy, setCompareStrategy] = useState<"cheapest" | "fastest">("cheapest");
  const [comparison, setComparison] = useState<null | {
    selected: { carrier_code: string; cost: number; currency: string; transit_days: number | null } | null;
    ranked: Array<{ carrier_code: string; cost: number; currency: string; transit_days: number | null; costTry: number }>;
  }>(null);

  const [routeCountry, setRouteCountry] = useState("US");
  const [routeQty, setRouteQty] = useState("1");
  const [routing, setRouting] = useState<null | {
    reason: string;
    warehouse: { name: string; country_code: string; provider: string } | null;
    ranked: Array<{ id: string; name: string; country: string; provider: string; distance: number; score: number }>;
  }>(null);

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key, storeId] });

  const hubMutation = useMutation({
    mutationFn: () =>
      saveHub({
        data: {
          storeId,
          countryCode: hubCountry,
          hubName,
          city: hubCity || null,
          address: hubAddress || null,
          carrierCode: hubCarrier,
          isActive: true,
        } as never,
      }),
    onSuccess: () => {
      toast.success("İade adresi kaydedildi");
      setHubName("");
      setHubCity("");
      setHubAddress("");
      void invalidate("return-hubs");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const labelMutation = useMutation({
    mutationFn: () =>
      createLabel({
        data: { storeId, orderId, trackingNumber: labelTracking || null } as never,
      }),
    onSuccess: (result: { reference?: string; hub?: string | null }) => {
      toast.success(`İade etiketi hazır: ${result?.reference ?? ""}${result?.hub ? ` · ${result.hub}` : ""}`);
      setLabelTracking("");
      void invalidate("return-labels");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quoteMutation = useMutation({
    mutationFn: () =>
      saveQuote({
        data: {
          storeId,
          destinationCountry: quoteCountry,
          weightGrams: Number(quoteWeight),
          carrierCode: quoteCarrier,
          cost: Number(quoteCost.replace(",", ".")),
          currency: quoteCurrency,
          transitDays: Number(quoteTransit),
          source: "manual",
        } as never,
      }),
    onSuccess: () => {
      toast.success("Taşıyıcı fiyatı kaydedildi");
      void invalidate("carrier-quotes");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PackageCheck className="size-4" /> Yurt dışı yerel iade adresleri
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Müşteri ürünü kendi ülkesindeki adrese iade eder; sınır ötesi iade maliyeti ve süresi düşer.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Ülke</Label>
            <Select value={hubCountry} onValueChange={setHubCountry}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hub-name">Adres adı</Label>
            <Input id="hub-name" className="mt-1" value={hubName} onChange={(e) => setHubName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hub-city">Şehir</Label>
            <Input id="hub-city" className="mt-1" value={hubCity} onChange={(e) => setHubCity(e.target.value)} />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="hub-address">Açık adres</Label>
            <Input id="hub-address" className="mt-1" value={hubAddress} onChange={(e) => setHubAddress(e.target.value)} />
          </div>
          <div>
            <Label>Taşıyıcı</Label>
            <Select value={hubCarrier} onValueChange={setHubCarrier}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_CATALOG.map((carrier) => (
                  <SelectItem key={carrier.code} value={carrier.code}>
                    {carrier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-4" disabled={hubName.length < 2 || hubMutation.isPending} onClick={() => hubMutation.mutate()}>
          İade adresini kaydet
        </Button>

        {(hubs ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(hubs ?? []).map((hub) => (
              <li key={hub.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {hub.country_code} · {hub.hub_name}
                  {hub.city ? ` · ${hub.city}` : ""}
                </span>
                <div className="flex items-center gap-2">
                  {hub.carrier_code ? <Badge variant="secondary">{hub.carrier_code}</Badge> : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="İade adresini sil"
                    onClick={() =>
                      removeHub({ data: { storeId, id: hub.id } as never }).then(() => {
                        toast.success("İade adresi kaldırıldı");
                        void invalidate("return-hubs");
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">İade etiketi oluştur (RMA)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sipariş alıcısının ülkesine en uygun iade adresi otomatik seçilir. Taşıyıcı takip numarası girilmezse
          etiket taslak olarak kaydedilir — sahte takip numarası üretilmez.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Sipariş</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sipariş seçin" />
              </SelectTrigger>
              <SelectContent>
                {(orders ?? []).slice(0, 50).map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.order_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="label-tracking">Taşıyıcı takip numarası (varsa)</Label>
            <Input
              id="label-tracking"
              className="mt-1"
              value={labelTracking}
              onChange={(e) => setLabelTracking(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" disabled={!orderId || labelMutation.isPending} onClick={() => labelMutation.mutate()}>
          İade etiketi oluştur
        </Button>

        {(labels ?? []).length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2">Referans</th>
                  <th className="py-2">Rota</th>
                  <th className="py-2">Takip</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {(labels ?? []).map((label) => (
                  <tr key={label.id} className="border-t">
                    <td className="py-2">{label.reference}</td>
                    <td className="py-2">
                      {label.origin_country} → {label.return_hubs?.hub_name ?? label.destination_country}
                    </td>
                    <td className="py-2">{label.tracking_number ?? "—"}</td>
                    <td className="py-2">
                      <Select
                        value={label.status}
                        onValueChange={(status) =>
                          updateLabel({ data: { storeId, id: label.id, status } as never }).then(() => {
                            toast.success("İade durumu güncellendi");
                            void invalidate("return-labels");
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(RETURN_STATUS).map(([value, text]) => (
                            <SelectItem key={value} value={value}>
                              {text}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Truck className="size-4" /> Taşıyıcı fiyat karşılaştırma
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Taşıyıcı hesapları bağlanana kadar fiyatları elle girin; bağlandığında aynı tablo API fiyatlarıyla
          dolar. Karşılaştırma en ucuz veya en hızlı rotayı seçer.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Hedef ülke</Label>
            <Select value={quoteCountry} onValueChange={setQuoteCountry}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Taşıyıcı</Label>
            <Select value={quoteCarrier} onValueChange={setQuoteCarrier}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIER_CATALOG.map((carrier) => (
                  <SelectItem key={carrier.code} value={carrier.code}>
                    {carrier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quote-weight">Ağırlık (gr)</Label>
            <Input id="quote-weight" className="mt-1" value={quoteWeight} onChange={(e) => setQuoteWeight(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="quote-cost">Ücret</Label>
            <Input id="quote-cost" className="mt-1" value={quoteCost} onChange={(e) => setQuoteCost(e.target.value)} />
          </div>
          <div>
            <Label>Para birimi</Label>
            <Select value={quoteCurrency} onValueChange={setQuoteCurrency}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_CURRENCIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="quote-transit">Teslim süresi (gün)</Label>
            <Input id="quote-transit" className="mt-1" value={quoteTransit} onChange={(e) => setQuoteTransit(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" disabled={quoteMutation.isPending} onClick={() => quoteMutation.mutate()}>
          Fiyatı kaydet
        </Button>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <Label>Karşılaştırılacak ülke</Label>
            <Select value={compareCountry} onValueChange={setCompareCountry}>
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Strateji</Label>
            <Select value={compareStrategy} onValueChange={(next) => setCompareStrategy(next as "cheapest" | "fastest")}>
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">En ucuz</SelectItem>
                <SelectItem value="fastest">En hızlı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              compare({
                data: {
                  storeId,
                  destinationCountry: compareCountry,
                  weightGrams: Number(quoteWeight) || 1000,
                  strategy: compareStrategy,
                } as never,
              })
                .then((result) => setComparison(result as never))
                .catch((error: Error) => toast.error(error.message))
            }
          >
            Rotayı karşılaştır
          </Button>
        </div>

        {comparison ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            {comparison.selected ? (
              <p>
                Seçilen rota: <strong>{comparison.selected.carrier_code.toUpperCase()}</strong> ·{" "}
                {comparison.selected.cost.toFixed(2)} {comparison.selected.currency}
                {comparison.selected.transit_days ? ` · ${comparison.selected.transit_days} gün` : ""}
              </p>
            ) : (
              <p className="text-muted-foreground">Bu ülke ve ağırlık için kayıtlı fiyat yok.</p>
            )}
            {comparison.ranked.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {comparison.ranked.map((row, index) => (
                  <li key={`${row.carrier_code}-${index}`}>
                    {row.carrier_code.toUpperCase()} · {row.cost.toFixed(2)} {row.currency} ·{" "}
                    {row.costTry.toFixed(2)} ₺{row.transit_days ? ` · ${row.transit_days} gün` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {(quotes ?? []).length > 0 ? (
          <ul className="mt-4 space-y-2">
            {(quotes ?? []).map((quote) => (
              <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {quote.destination_country} · {quote.carrier_code.toUpperCase()} · {quote.weight_grams} gr
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {quote.cost.toFixed(2)} {quote.currency}
                  </Badge>
                  {quote.transit_days ? <Badge variant="outline">{quote.transit_days} gün</Badge> : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Fiyatı sil"
                    onClick={() =>
                      removeQuote({ data: { storeId, id: quote.id } as never }).then(() => {
                        toast.success("Fiyat kaldırıldı");
                        void invalidate("carrier-quotes");
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Route className="size-4" /> Akıllı depo yönlendirme testi
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label>Teslim ülkesi</Label>
            <Select value={routeCountry} onValueChange={setRouteCountry}>
              <SelectTrigger className="mt-1 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLOBAL_COUNTRIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="route-qty">Adet</Label>
            <Input id="route-qty" className="mt-1 w-24" value={routeQty} onChange={(e) => setRouteQty(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={() =>
              simulate({
                data: { storeId, destinationCountry: routeCountry, quantity: Number(routeQty) || 1 } as never,
              })
                .then((result) => setRouting(result as never))
                .catch((error: Error) => toast.error(error.message))
            }
          >
            Yönlendirmeyi hesapla
          </Button>
        </div>
        {routing ? (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            {routing.warehouse ? (
              <p>
                Sipariş <strong>{routing.warehouse.name}</strong> ({routing.warehouse.country_code} ·{" "}
                {routing.warehouse.provider}) deposundan gönderilir.
              </p>
            ) : (
              <p className="text-muted-foreground">Uygun aktif depo bulunamadı ({routing.reason}).</p>
            )}
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {routing.ranked.map((row) => (
                <li key={row.id}>
                  {row.name} · {row.country} · {row.provider} · mesafe skoru {row.distance}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
