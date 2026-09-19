import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Globe2, Plus, Trash2, Truck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ExportDocumentPrint } from "@/components/global-export/export-document-print";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productsQuery } from "@/lib/catalog-queries";
import {
  CARRIER_CATALOG,
  EXPORT_DOC_LABELS,
  EXPORT_LOCALES,
  GLOBAL_COUNTRIES,
  GLOBAL_CURRENCIES,
  INCOTERM_LABELS,
  PAYMENT_PROVIDER_CATALOG,
  calculateLandedCost,
  resolveEuVat,
  resolveUsSalesTax,
} from "@/lib/global-commerce";
import {
  countryPricesQuery,
  customsProfilesQuery,
  euVatRatesQuery,
  exportDocumentsQuery,
  globalCarriersQuery,
  globalPaymentMethodsQuery,
  globalSettingsQuery,
  usSalesTaxRatesQuery,
  type ExportDocumentRow,
} from "@/lib/global-export-queries";
import {
  createExportDocument,
  runGlobalAutoTranslate,
  deleteCountryPrice,
  saveCustomsProfile,
  saveGlobalCarrier,
  saveGlobalPaymentMethod,
  saveGlobalSettings,
  upsertCountryPrice,
} from "@/lib/global-export.functions";
import { formatMoney } from "@/lib/mefti";
import { ordersQuery } from "@/lib/sales-queries";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/global")({
  head: () => ({
    meta: [
      { title: "E-İhracat & Global Satış — Mefticaret" },
      {
        name: "description",
        content:
          "Ülke bazlı fiyatlar, küresel ödeme yöntemleri, AB/ABD vergi kuralları, mikro ihracat kargo ve İngilizce ihracat belgeleri tek panelde.",
      },
      { property: "og:title", content: "E-İhracat & Global Satış — Mefticaret" },
      {
        property: "og:description",
        content: "Dünyaya satış için fiyat, vergi, gümrük, kargo ve belge yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GlobalExportPage,
});

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-5 ${className}`}>{children}</div>;
}

function GlobalExportPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(globalSettingsQuery(storeId));
  const { data: prices } = useQuery(countryPricesQuery(storeId));
  const { data: methods } = useQuery(globalPaymentMethodsQuery(storeId));
  const { data: carriers } = useQuery(globalCarriersQuery(storeId));
  const { data: customs } = useQuery(customsProfilesQuery(storeId));
  const { data: documents } = useQuery(exportDocumentsQuery(storeId));
  const { data: orders } = useQuery(ordersQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const { data: euRates } = useQuery(euVatRatesQuery());
  const { data: usRates } = useQuery(usSalesTaxRatesQuery());

  const saveSettings = useServerFn(saveGlobalSettings);
  const savePrice = useServerFn(upsertCountryPrice);
  const removePrice = useServerFn(deleteCountryPrice);
  const savePayment = useServerFn(saveGlobalPaymentMethod);
  const saveCarrier = useServerFn(saveGlobalCarrier);
  const saveCustoms = useServerFn(saveCustomsProfile);
  const createDoc = useServerFn(createExportDocument);

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key, storeId] });

  const baseCurrency = store?.currency ?? "TRY";

  /* ------------------------------- ayarlar ------------------------------- */
  const [form, setForm] = useState<Record<string, string>>({});
  const value = (field: string, fallback: unknown) =>
    form[field] ?? (fallback === null || fallback === undefined ? "" : String(fallback));

  const settingsMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      saveSettings({
        data: {
          storeId,
          geoDetectEnabled: settings?.geo_detect_enabled ?? true,
          fxBufferPercent: Number(settings?.fx_buffer_percent ?? 2),
          defaultIncoterm: settings?.default_incoterm ?? "DDP",
          iossEnabled: settings?.ioss_enabled ?? false,
          iossNumber: settings?.ioss_number ?? null,
          ossEnabled: settings?.oss_enabled ?? false,
          usNexusStates: settings?.us_nexus_states ?? [],
          rtlAuto: settings?.rtl_auto ?? true,
          exporterName: settings?.exporter_name ?? null,
          exporterTaxId: settings?.exporter_tax_id ?? null,
          exporterAddress: settings?.exporter_address ?? null,
          exporterCity: settings?.exporter_city ?? null,
          exporterCountry: settings?.exporter_country ?? "TR",
          exporterPhone: settings?.exporter_phone ?? null,
          exporterEmail: settings?.exporter_email ?? null,
          defaultHsCode: settings?.default_hs_code ?? null,
          autoTranslateLocales: settings?.auto_translate_locales ?? ["en"],
          ...patch,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      void invalidate("global-settings");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /* --------------------------- otomatik çeviri --------------------------- */
  const autoTranslate = useServerFn(runGlobalAutoTranslate);
  const translateMutation = useMutation({
    mutationFn: () =>
      autoTranslate({
        data: { storeId, locales: settings?.auto_translate_locales ?? [] },
      }),
    onSuccess: (result) =>
      toast.success(
        `${result.processed} metin çevrildi${result.remaining > 0 ? `, ${result.remaining} sırada` : ""}`,
      ),
    onError: (error: Error) => toast.error(error.message),
  });

  /* ------------------------------ genel bakış ------------------------------ */
  const exportStats = useMemo(() => {
    const rows = (orders ?? []).filter(
      (order) => !["cancelled", "failed", "abandoned"].includes(String(order.status)),
    );
    const byCountry = new Map<string, { orders: number; revenue: number }>();
    let abroadRevenue = 0;
    let domesticRevenue = 0;
    const byCurrency = new Map<string, number>();
    for (const order of rows) {
      const address = (order.shipping_address ?? {}) as Record<string, unknown>;
      const country = String(address["country"] ?? address["country_code"] ?? "TR").toUpperCase();
      const total = Number(order.grand_total ?? 0);
      const entry = byCountry.get(country) ?? { orders: 0, revenue: 0 };
      entry.orders += 1;
      entry.revenue += total;
      byCountry.set(country, entry);
      if (country === "TR") domesticRevenue += total;
      else abroadRevenue += total;
      const currency = String(order.currency ?? baseCurrency).toUpperCase();
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + total);
    }
    const countries = [...byCountry.entries()]
      .map(([code, stats]) => ({ code, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
    const max = countries[0]?.revenue ?? 0;
    return {
      countries,
      max,
      abroadRevenue,
      domesticRevenue,
      currencies: [...byCurrency.entries()].sort((a, b) => b[1] - a[1]),
      abroadCount: countries.filter((row) => row.code !== "TR").length,
    };
  }, [orders, baseCurrency]);

  /* --------------------------- ülke bazlı fiyat --------------------------- */
  const [priceForm, setPriceForm] = useState({
    productId: "",
    countryCode: "DE",
    currency: "EUR",
    price: "",
  });

  /* ----------------------------- simülatör ----------------------------- */
  const [sim, setSim] = useState({
    country: "DE",
    state: "CA",
    goods: "100",
    shipping: "20",
    duty: "0",
    incoterm: "DDP" as "DDP" | "DDU",
    vatId: "",
  });

  const simulation = useMemo(() => {
    const euRate = (euRates ?? []).find((row) => row.country_code === sim.country);
    const usRate = (usRates ?? []).find((row) => row.state_code === sim.state);
    const goods = Number(sim.goods) || 0;
    if (sim.country === "US") {
      const decision = resolveUsSalesTax({
        state: sim.state,
        ratePercent: Number(usRate?.rate ?? 0),
        nexusStates: settings?.us_nexus_states ?? [],
      });
      return {
        note: decision.note,
        scheme: "US Sales Tax",
        cost: calculateLandedCost({
          goodsValue: goods,
          shippingCost: Number(sim.shipping) || 0,
          dutyRatePercent: Number(sim.duty) || 0,
          taxRatePercent: decision.ratePercent,
          incoterm: sim.incoterm,
          taxCollectedAtCheckout: decision.applies,
        }),
      };
    }
    const decision = resolveEuVat({
      country: sim.country,
      vatRatePercent: Number(euRate?.standard_rate ?? 0),
      consignmentValueEur: goods,
      buyerVatId: sim.vatId || null,
      iossEnabled: settings?.ioss_enabled ?? false,
      ossEnabled: settings?.oss_enabled ?? false,
    });
    return {
      note: decision.note,
      scheme: decision.scheme,
      cost: calculateLandedCost({
        goodsValue: goods,
        shippingCost: Number(sim.shipping) || 0,
        dutyRatePercent: Number(sim.duty) || 0,
        taxRatePercent: decision.ratePercent,
        incoterm: sim.incoterm,
        taxCollectedAtCheckout: decision.collectAtCheckout,
      }),
    };
  }, [sim, euRates, usRates, settings]);

  /* ------------------------------- belgeler ------------------------------- */
  const [docForm, setDocForm] = useState({
    orderId: "",
    kind: "commercial_invoice" as "commercial_invoice" | "packing_list" | "etgb",
  });
  const [openDoc, setOpenDoc] = useState<ExportDocumentRow | null>(null);

  const productName = (id: string) =>
    (products ?? []).find((row) => row.id === id)?.title ?? id.slice(0, 8);

  return (
    <AppShell storeId={storeId} title="E-İhracat & Global">
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="prices">Ülke Bazlı Fiyatlar</TabsTrigger>
          <TabsTrigger value="tax">Gümrük & Vergi</TabsTrigger>
          <TabsTrigger value="shipping">Mikro İhracat Kargo</TabsTrigger>
          <TabsTrigger value="payments">Küresel Ödemeler</TabsTrigger>
          <TabsTrigger value="localization">Yerelleştirme</TabsTrigger>
        </TabsList>

        {/* ------------------------------ Genel Bakış ------------------------------ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-muted-foreground">Yurt dışı ciro</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatMoney(exportStats.abroadRevenue, baseCurrency)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">Yurt içi ciro</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatMoney(exportStats.domesticRevenue, baseCurrency)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">İhracat yapılan ülke</p>
              <p className="mt-1 text-2xl font-semibold">{exportStats.abroadCount}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted-foreground">Kur risk marjı</p>
              <p className="mt-1 text-2xl font-semibold">
                %{Number(settings?.fx_buffer_percent ?? 0)}
              </p>
            </Card>
          </div>

          <Card>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Globe2 className="size-4" /> Ülke bazlı satış yoğunluğu
            </h3>
            {exportStats.countries.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Henüz sipariş yok. İlk uluslararası sipariş geldiğinde ülke dağılımı burada görünür.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {exportStats.countries.slice(0, 12).map((row) => {
                  const country = GLOBAL_COUNTRIES.find((item) => item.code === row.code);
                  const width = exportStats.max ? (row.revenue / exportStats.max) * 100 : 0;
                  return (
                    <li key={row.code} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{country?.name ?? row.code}</span>
                        <span className="text-muted-foreground">
                          {row.orders} sipariş · {formatMoney(row.revenue, baseCurrency)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(width, 2)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Para birimi bazlı gelir</h3>
            {exportStats.currencies.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Veri yok.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {exportStats.currencies.map(([currency, total]) => (
                  <li
                    key={currency}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{currency}</span>
                    <span>{formatMoney(total, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* --------------------------- Ülke Bazlı Fiyatlar --------------------------- */}
        <TabsContent value="prices" className="space-y-4">
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold">Ülkeye özel fiyat ekle</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1 lg:col-span-2">
                <Label>Ürün</Label>
                <Select
                  value={priceForm.productId}
                  onValueChange={(next) => setPriceForm((prev) => ({ ...prev, productId: next }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ürün seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(products ?? []).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ülke</Label>
                <Select
                  value={priceForm.countryCode}
                  onValueChange={(next) => {
                    const country = GLOBAL_COUNTRIES.find((row) => row.code === next);
                    setPriceForm((prev) => ({
                      ...prev,
                      countryCode: next,
                      currency: country?.currency ?? prev.currency,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOBAL_COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Para birimi</Label>
                <Select
                  value={priceForm.currency}
                  onValueChange={(next) => setPriceForm((prev) => ({ ...prev, currency: next }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOBAL_CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fiyat</Label>
                <Input
                  inputMode="decimal"
                  value={priceForm.price}
                  onChange={(event) =>
                    setPriceForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={!priceForm.productId || !priceForm.price}
              onClick={async () => {
                try {
                  await savePrice({
                    data: {
                      storeId,
                      productId: priceForm.productId,
                      countryCode: priceForm.countryCode,
                      currency: priceForm.currency,
                      price: Number(priceForm.price),
                      isActive: true,
                    } as never,
                  });
                  toast.success("Ülke fiyatı kaydedildi");
                  setPriceForm((prev) => ({ ...prev, price: "" }));
                  void invalidate("country-prices");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
                }
              }}
            >
              <Plus className="mr-2 size-4" /> Kaydet
            </Button>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Tanımlı ülke fiyatları</h3>
            {(prices ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Henüz ülke fiyatı yok. Fiyat tanımlanmayan ülkelerde kur + risk marjı uygulanır.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Ürün</th>
                      <th className="py-2">Ülke</th>
                      <th className="py-2 text-right">Fiyat</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(prices ?? []).map((row) => (
                      <tr key={row.id}>
                        <td className="py-2">{row.products?.title ?? productName(row.product_id)}</td>
                        <td className="py-2">{row.country_code}</td>
                        <td className="py-2 text-right">
                          {formatMoney(Number(row.price), row.currency)}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await removePrice({ data: { storeId, id: row.id } as never });
                                void invalidate("country-prices");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error ? error.message : "Silinemedi",
                                );
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ----------------------------- Gümrük & Vergi ----------------------------- */}
        <TabsContent value="tax" className="space-y-4">
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold">Vergi kayıtları</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">IOSS (150 EUR altı AB satışı)</p>
                  <p className="text-xs text-muted-foreground">
                    Açıkken KDV kasada tahsil edilir, gümrükte ek KDV çıkmaz.
                  </p>
                </div>
                <Switch
                  checked={settings?.ioss_enabled ?? false}
                  onCheckedChange={(checked) =>
                    settingsMutation.mutate({ iossEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">OSS (AB içi depodan satış)</p>
                  <p className="text-xs text-muted-foreground">
                    Alıcı ülkesinin KDV oranı kasada hesaplanır.
                  </p>
                </div>
                <Switch
                  checked={settings?.oss_enabled ?? false}
                  onCheckedChange={(checked) => settingsMutation.mutate({ ossEnabled: checked })}
                />
              </div>
              <div className="space-y-1">
                <Label>IOSS numarası</Label>
                <Input
                  value={value("iossNumber", settings?.ioss_number)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, iossNumber: event.target.value }))
                  }
                  onBlur={() =>
                    form["iossNumber"] !== undefined &&
                    settingsMutation.mutate({ iossNumber: form["iossNumber"] })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>ABD nexus eyaletleri (virgülle)</Label>
                <Input
                  placeholder="CA, NY, TX"
                  value={value("nexus", (settings?.us_nexus_states ?? []).join(", "))}
                  onChange={(event) => setForm((prev) => ({ ...prev, nexus: event.target.value }))}
                  onBlur={() =>
                    form["nexus"] !== undefined &&
                    settingsMutation.mutate({
                      usNexusStates: form["nexus"]
                        .split(",")
                        .map((code) => code.trim().toUpperCase())
                        .filter((code) => code.length === 2),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Varsayılan teslim şekli</Label>
                <Select
                  value={settings?.default_incoterm ?? "DDP"}
                  onValueChange={(next) => settingsMutation.mutate({ defaultIncoterm: next })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCOTERM_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {code} — {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Varsayılan GTIP / HS kodu</Label>
                <Input
                  value={value("defaultHsCode", settings?.default_hs_code)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, defaultHsCode: event.target.value }))
                  }
                  onBlur={() =>
                    form["defaultHsCode"] !== undefined &&
                    settingsMutation.mutate({ defaultHsCode: form["defaultHsCode"] })
                  }
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-sm font-semibold">Gümrük & teslim maliyeti simülatörü</h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1">
                <Label>Ülke</Label>
                <Select
                  value={sim.country}
                  onValueChange={(next) => setSim((prev) => ({ ...prev, country: next }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GLOBAL_COUNTRIES.filter((row) => row.code !== "TR").map((row) => (
                      <SelectItem key={row.code} value={row.code}>
                        {row.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sim.country === "US" ? (
                <div className="space-y-1">
                  <Label>Eyalet</Label>
                  <Select
                    value={sim.state}
                    onValueChange={(next) => setSim((prev) => ({ ...prev, state: next }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(usRates ?? []).map((row) => (
                        <SelectItem key={row.state_code} value={row.state_code}>
                          {row.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Alıcı KDV no (B2B)</Label>
                  <Input
                    value={sim.vatId}
                    onChange={(event) => setSim((prev) => ({ ...prev, vatId: event.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label>Mal değeri</Label>
                <Input
                  inputMode="decimal"
                  value={sim.goods}
                  onChange={(event) => setSim((prev) => ({ ...prev, goods: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Kargo</Label>
                <Input
                  inputMode="decimal"
                  value={sim.shipping}
                  onChange={(event) =>
                    setSim((prev) => ({ ...prev, shipping: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Gümrük vergisi %</Label>
                <Input
                  inputMode="decimal"
                  value={sim.duty}
                  onChange={(event) => setSim((prev) => ({ ...prev, duty: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Teslim şekli</Label>
                <Select
                  value={sim.incoterm}
                  onValueChange={(next) =>
                    setSim((prev) => ({ ...prev, incoterm: next as "DDP" | "DDU" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DDP">DDP</SelectItem>
                    <SelectItem value="DDU">DDU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <p>
                Vergi rejimi: <span className="font-medium">{simulation.scheme}</span>
              </p>
              <p>
                Vergi: <span className="font-medium">{simulation.cost.tax.toFixed(2)}</span>
              </p>
              <p>
                Gümrük vergisi:{" "}
                <span className="font-medium">{simulation.cost.duty.toFixed(2)}</span>
              </p>
              <p>
                Kasada tahsil:{" "}
                <span className="font-medium">
                  {simulation.cost.collectedAtCheckout.toFixed(2)}
                </span>
              </p>
              <p>
                Teslimde ödenecek:{" "}
                <span className="font-medium">{simulation.cost.payableOnDelivery.toFixed(2)}</span>
              </p>
              <p>
                Toplam: <span className="font-medium">{simulation.cost.total.toFixed(2)}</span>
              </p>
              <p className="text-xs text-muted-foreground sm:col-span-3">{simulation.note}</p>
            </div>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-sm font-semibold">Ürün gümrük bilgileri</h3>
            <CustomsForm
              products={(products ?? []).map((row) => ({ id: row.id, title: String(row.title) }))}
              onSave={async (input) => {
                try {
                  await saveCustoms({ data: { storeId, ...input } as never });
                  toast.success("Gümrük bilgisi kaydedildi");
                  void invalidate("customs-profiles");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Kaydedilemedi");
                }
              }}
            />
            {(customs ?? []).length > 0 ? (
              <ul className="divide-y text-sm">
                {(customs ?? []).map((row) => (
                  <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="font-medium">
                      {row.products?.title ?? productName(row.product_id)}
                    </span>
                    <span className="text-muted-foreground">
                      HS {row.hs_code ?? "-"} · {row.origin_country} ·{" "}
                      {row.weight_grams ? `${row.weight_grams} g` : "ağırlık yok"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </TabsContent>

        {/* -------------------------- Mikro İhracat Kargo -------------------------- */}
        <TabsContent value="shipping" className="space-y-4">
          <Card className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4" /> Taşıyıcı bağlantıları
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {CARRIER_CATALOG.map((carrier) => {
                const row = (carriers ?? []).find((item) => item.carrier_code === carrier.code);
                return (
                  <div
                    key={carrier.code}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{carrier.label}</p>
                      <p className="text-xs text-muted-foreground">{carrier.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row?.credentials_ready ? (
                          <Badge variant="secondary">Anahtar hazır</Badge>
                        ) : (
                          <Badge variant="outline">Anahtar bekleniyor</Badge>
                        )}
                        {carrier.microExport ? <Badge variant="outline">Mikro ihracat</Badge> : null}
                      </div>
                    </div>
                    <Switch
                      checked={row?.is_active ?? false}
                      onCheckedChange={async (checked) => {
                        try {
                          await saveCarrier({
                            data: {
                              storeId,
                              carrierCode: carrier.code,
                              label: carrier.label,
                              mode: row?.mode ?? "test",
                              accountNumber: row?.account_number ?? null,
                              isActive: checked,
                            } as never,
                          });
                          void invalidate("global-carriers");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Güncellenemedi");
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-sm font-semibold">İhracat belgesi oluştur (İngilizce)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Sipariş</Label>
                <Select
                  value={docForm.orderId}
                  onValueChange={(next) => setDocForm((prev) => ({ ...prev, orderId: next }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sipariş seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(orders ?? []).slice(0, 50).map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        #{order.order_number} · {formatMoney(Number(order.grand_total ?? 0), String(order.currency ?? baseCurrency))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Belge türü</Label>
                <Select
                  value={docForm.kind}
                  onValueChange={(next) =>
                    setDocForm((prev) => ({ ...prev, kind: next as typeof prev.kind }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPORT_DOC_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              disabled={!docForm.orderId}
              onClick={async () => {
                try {
                  const result = await createDoc({
                    data: {
                      storeId,
                      orderId: docForm.orderId,
                      kind: docForm.kind,
                      incoterm: settings?.default_incoterm ?? "DDP",
                    } as never,
                  });
                  toast.success(`Belge oluşturuldu: ${result.documentNumber}`);
                  void invalidate("export-documents");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Belge oluşturulamadı");
                }
              }}
            >
              Belge oluştur
            </Button>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold">Oluşturulan belgeler</h3>
            {(documents ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Henüz belge yok.</p>
            ) : (
              <ul className="mt-3 divide-y text-sm">
                {(documents ?? []).map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{doc.document_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {EXPORT_DOC_LABELS[doc.kind]} · {doc.incoterm} ·{" "}
                        {formatMoney(Number(doc.total_value), doc.currency)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setOpenDoc(doc)}>
                      Görüntüle / PDF
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {openDoc ? <ExportDocumentPrint document={openDoc} /> : null}
        </TabsContent>

        {/* --------------------------- Küresel Ödemeler --------------------------- */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="size-4" /> Ödeme sağlayıcıları
            </h3>
            <p className="text-xs text-muted-foreground">
              Bir yöntem yalnızca sağlayıcı hesap bilgileri kaydedildikten sonra etkinleştirilebilir.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PAYMENT_PROVIDER_CATALOG.map((provider) => {
                const row = (methods ?? []).find((item) => item.provider === provider.provider);
                return (
                  <div
                    key={provider.provider}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{provider.label}</p>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row?.credentials_ready ? (
                          <Badge variant="secondary">Anahtar hazır</Badge>
                        ) : (
                          <Badge variant="outline">Anahtar bekleniyor</Badge>
                        )}
                        <Badge variant="outline">{provider.currencies.join(", ")}</Badge>
                      </div>
                    </div>
                    <Switch
                      checked={row?.is_active ?? false}
                      onCheckedChange={async (checked) => {
                        try {
                          await savePayment({
                            data: {
                              storeId,
                              provider: provider.provider,
                              label: provider.label,
                              countries: provider.countries,
                              currencies: provider.currencies,
                              mode: row?.mode ?? "test",
                              isActive: checked,
                            } as never,
                          });
                          void invalidate("global-payment-methods");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Güncellenemedi");
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ----------------------------- Yerelleştirme ----------------------------- */}
        <TabsContent value="localization" className="space-y-4">
          <Card className="space-y-4">
            <h3 className="text-sm font-semibold">Konum ve para birimi</h3>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ziyaretçi ülkesini otomatik algıla</p>
                <p className="text-xs text-muted-foreground">
                  Dil, para birimi ve vergi kuralları ülkeye göre ayarlanır.
                </p>
              </div>
              <Switch
                checked={settings?.geo_detect_enabled ?? true}
                onCheckedChange={(checked) =>
                  settingsMutation.mutate({ geoDetectEnabled: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Arapça / İbranice için sağdan sola düzen</p>
                <p className="text-xs text-muted-foreground">RTL diller otomatik çevrilir.</p>
              </div>
              <Switch
                checked={settings?.rtl_auto ?? true}
                onCheckedChange={(checked) => settingsMutation.mutate({ rtlAuto: checked })}
              />
            </div>
            <div className="space-y-1">
              <Label>Kur risk marjı (%)</Label>
              <Input
                inputMode="decimal"
                value={value("fxBuffer", settings?.fx_buffer_percent ?? 2)}
                onChange={(event) => setForm((prev) => ({ ...prev, fxBuffer: event.target.value }))}
                onBlur={() =>
                  form["fxBuffer"] !== undefined &&
                  settingsMutation.mutate({
                    fxBufferPercent: Math.min(Math.max(Number(form["fxBuffer"]) || 0, 0), 25),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Canlı kura eklenen koruma payı; %0–25 arasında olabilir.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Otomatik çeviri dilleri</Label>
              <div className="flex flex-wrap gap-2">
                {EXPORT_LOCALES.map((locale) => {
                  const active = (settings?.auto_translate_locales ?? []).includes(locale.code);
                  return (
                    <Button
                      key={locale.code}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => {
                        const current = settings?.auto_translate_locales ?? [];
                        settingsMutation.mutate({
                          autoTranslateLocales: active
                            ? current.filter((code: string) => code !== locale.code)
                            : [...current, locale.code],
                        });
                      }}
                    >
                      {locale.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={() => translateMutation.mutate()}
                  disabled={
                    translateMutation.isPending ||
                    (settings?.auto_translate_locales ?? []).length === 0
                  }
                >
                  {translateMutation.isPending
                    ? "Çeviriliyor..."
                    : "Seçili dillere otomatik çevir"}
                </Button>
                {translateMutation.data ? (
                  <p className="text-xs text-muted-foreground">
                    {translateMutation.data.locales.join(", ").toUpperCase()} · toplam{" "}
                    {translateMutation.data.total} metin · {translateMutation.data.processed} çevrildi
                    {translateMutation.data.remaining > 0
                      ? ` · ${translateMutation.data.remaining} sırada`
                      : " · tamamlandı"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {(settings?.auto_translate_locales ?? []).length === 0
                      ? "Önce yukarıdan en az bir dil seçin."
                      : "Ürün, kategori, sayfa, blog ve sipariş/e-posta metinleri seçili dillere çevrilir."}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-sm font-semibold">İhracatçı bilgileri (belgelerde kullanılır)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["exporterName", "Firma adı", settings?.exporter_name],
                ["exporterTaxId", "Vergi numarası", settings?.exporter_tax_id],
                ["exporterAddress", "Adres", settings?.exporter_address],
                ["exporterCity", "Şehir", settings?.exporter_city],
                ["exporterCountry", "Ülke kodu", settings?.exporter_country ?? "TR"],
                ["exporterPhone", "Telefon", settings?.exporter_phone],
                ["exporterEmail", "E-posta", settings?.exporter_email],
              ].map(([field, label, current]) => (
                <div key={String(field)} className="space-y-1">
                  <Label>{String(label)}</Label>
                  <Input
                    value={value(String(field), current)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [String(field)]: event.target.value }))
                    }
                    onBlur={() =>
                      form[String(field)] !== undefined &&
                      settingsMutation.mutate({ [String(field)]: form[String(field)] })
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function CustomsForm({
  products,
  onSave,
}: {
  products: { id: string; title: string }[];
  onSave: (input: {
    productId: string;
    hsCode: string | null;
    originCountry: string;
    weightGrams: number | null;
    descriptionEn: string | null;
    material: string | null;
  }) => Promise<void>;
}) {
  const [state, setState] = useState({
    productId: "",
    hsCode: "",
    originCountry: "TR",
    weightGrams: "",
    descriptionEn: "",
    material: "",
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label>Ürün</Label>
          <Select
            value={state.productId}
            onValueChange={(next) => setState((prev) => ({ ...prev, productId: next }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ürün seçin" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>HS / GTIP kodu</Label>
          <Input
            value={state.hsCode}
            onChange={(event) => setState((prev) => ({ ...prev, hsCode: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Menşe ülke</Label>
          <Input
            maxLength={2}
            value={state.originCountry}
            onChange={(event) =>
              setState((prev) => ({ ...prev, originCountry: event.target.value.toUpperCase() }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Ağırlık (gram)</Label>
          <Input
            inputMode="numeric"
            value={state.weightGrams}
            onChange={(event) => setState((prev) => ({ ...prev, weightGrams: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>İngilizce açıklama</Label>
          <Input
            value={state.descriptionEn}
            onChange={(event) =>
              setState((prev) => ({ ...prev, descriptionEn: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Malzeme</Label>
          <Input
            value={state.material}
            onChange={(event) => setState((prev) => ({ ...prev, material: event.target.value }))}
          />
        </div>
      </div>
      <Button
        size="sm"
        disabled={!state.productId}
        onClick={async () => {
          await onSave({
            productId: state.productId,
            hsCode: state.hsCode || null,
            originCountry: state.originCountry || "TR",
            weightGrams: state.weightGrams ? Number(state.weightGrams) : null,
            descriptionEn: state.descriptionEn || null,
            material: state.material || null,
          });
          setState((prev) => ({ ...prev, hsCode: "", weightGrams: "", descriptionEn: "", material: "" }));
        }}
      >
        Gümrük bilgisini kaydet
      </Button>
    </div>
  );
}
