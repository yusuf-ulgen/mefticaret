import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Boxes,
  Gauge,
  PackageCheck,
  Printer,
  RefreshCw,
  Repeat2,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SmartImage } from "@/components/smart-image";
import { SupplierImportWizard } from "@/components/supplier/import-wizard";
import { printCargoLabels } from "@/components/supplier/cargo-label";
import { SupplierAnalytics, SupplierCatalog, SupplierChanges, SupplierCommercialDesk } from "@/components/supplier/workspace-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DROPSHIP_STATUS_LABEL } from "@/lib/dropshipping";
import { formatDate, formatMoney } from "@/lib/mefti";
import { LEDGER_STATUS_LABELS, PAYOUT_STATUS_LABELS } from "@/lib/supplier-import";
import {
  supplierDeskOverview,
  supplierDeskRequestPayout,
  supplierDeskRunFeed,
  supplierDeskSaveBank,
  supplierDeskSaveFeed,
} from "@/lib/supplier-desk.functions";
import { supplierPortalUpdateOrder } from "@/lib/supplier-portal.functions";

export const Route = createFileRoute("/_authenticated/supplier")({
  head: () => ({
    meta: [
      { title: "Tedarikçi Paneli — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi paneli: gelen siparişleri hazırlayın, kargo etiketi yazdırın, toplu ürün yükleyin, komisyon ve ödeme bakiyenizi takip edin.",
      },
      { property: "og:title", content: "Tedarikçi Paneli — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş karşılama masası, toplu ürün aktarımı, komisyon defteri ve performans karnesi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupplierPortalPage,
});

const CARRIERS = [
  "Aras Kargo",
  "MNG Kargo",
  "Yurtiçi Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS Kargo",
  "DHL",
  "FedEx",
  "Trendyol Express",
];

const SCHEDULES = [
  { value: "manual", label: "Elle" },
  { value: "hourly", label: "Saatlik" },
  { value: "daily", label: "Günlük" },
];

type Overview = Awaited<ReturnType<typeof supplierDeskOverview>>;
type DeskOrderView = Overview["orders"][number];

function SupplierPortalPage() {
  const client = useQueryClient();
  const load = useServerFn(supplierDeskOverview);
  const update = useServerFn(supplierPortalUpdateOrder);

  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-desk"],
    queryFn: () => load({}),
    retry: false,
  });

  const refresh = () => void client.invalidateQueries({ queryKey: ["supplier-desk"] });

  const mutation = useMutation({
    mutationFn: (input: {
      dropshipOrderId: string;
      status?: "accepted" | "shipped" | "cancelled";
      carrier?: string;
      trackingNumber?: string;
    }) => update({ data: input }),
    onSuccess: () => {
      toast.success("Sipariş güncellendi");
      refresh();
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const supplierId = data?.suppliers[0]?.id ?? "";
  const [activeTab, setActiveTab] = useState("profile");
  const [orderFilter, setOrderFilter] = useState("pending");
  const openOrders = useMemo(
    () => (data?.orders ?? []).filter((order) => !["shipped", "delivered", "cancelled"].includes(order.status)),
    [data?.orders],
  );
  const filteredOrders = useMemo(() => {
    const orders = data?.orders ?? [];
    if (orderFilter === "shipping") return orders.filter((order) => order.status === "shipped");
    if (orderFilter === "delivered") return orders.filter((order) => order.status === "delivered");
    if (orderFilter === "return") {
      return orders.filter((order) => ["cancelled", "failed", "returned"].includes(order.status));
    }
    return orders.filter((order) => !["shipped", "delivered", "cancelled", "failed", "returned"].includes(order.status));
  }, [data?.orders, orderFilter]);

  const navigation = [
    { value: "profile", label: "Profil", icon: UserRound },
    { value: "orders", label: "Siparişler", icon: ShoppingBag },
    { value: "products", label: "Ürünler", icon: Boxes },
    { value: "changes", label: "Değişimler", icon: Repeat2 },
    { value: "analytics", label: "Analiz", icon: BarChart3 },
  ];

  return (
    <AppShell title="Tedarikçi paneli">
      <div className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl bg-supplier-surface pb-24 sm:rounded-lg sm:border sm:pb-6">
        <header className="flex min-h-16 items-center justify-between bg-supplier-brand px-4 text-supplier-brand-foreground sm:rounded-t-lg sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <PackageCheck className="size-6 shrink-0" aria-hidden />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{data?.suppliers[0]?.name ?? "Tedarikçi Paneli"}</h1>
              <p className="truncate text-xs opacity-80">MEFTİCARET TEDARİKÇİ</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-supplier-brand-foreground hover:bg-supplier-brand-foreground/15 hover:text-supplier-brand-foreground"
            onClick={refresh}
            aria-label="Paneli yenile"
          >
            <RefreshCw className="size-5" aria-hidden />
          </Button>
        </header>

        {isLoading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : error ? (
          <div className="m-4 rounded-lg border bg-card p-6 text-sm text-muted-foreground sm:m-6">
            {(error as Error).message}
          </div>
        ) : data && !data.hasAccess ? (
          <div className="m-4 space-y-3 rounded-lg border bg-card p-6 sm:m-6">
            <p className="text-sm font-medium">Bu hesap bir tedarikçi hesabına bağlı değil.</p>
            <p className="text-sm text-muted-foreground">
              Tedarikçi paneline girmek için tedarikçi hesabınızla oturum açın veya yeni tedarikçi kaydı oluşturun.
            </p>
            <Button asChild>
              <Link to="/tedarikci-giris">Tedarikçi girişi</Link>
            </Button>
          </div>
        ) : !data ? null : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4 sm:p-6">
            <TabsList className="mb-4 hidden w-full grid-cols-5 bg-card sm:grid">
              {navigation.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="gap-2">
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="profile" className="mt-0 space-y-4">
              <ProfileSummary data={data} openOrders={openOrders.length} />
              {supplierId ? <SupplierCommercialDesk supplierId={supplierId} products={data.products} rfqs={data.rfqs} credit={data.credit} transactions={data.transactions} onChanged={refresh} /> : null}
              <FinancePanel data={data} onSaved={refresh} />
            </TabsContent>

            <TabsContent value="orders" className="mt-0 space-y-4">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-card p-1 shadow-sm">
                {[
                  ["pending", "Bekleyen"],
                  ["shipping", "Kargoda"],
                  ["delivered", "Ulaştı"],
                  ["return", "İade"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={orderFilter === value ? "default" : "ghost"}
                    className={orderFilter === value ? "bg-supplier-brand text-supplier-brand-foreground hover:bg-supplier-brand/90" : ""}
                    onClick={() => value && setOrderFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {!filteredOrders.length ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  Bu durumda sipariş bulunmuyor.
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <SupplierOrderCard
                    key={order.dropshipOrderId}
                    order={order}
                    pending={mutation.isPending}
                    onSubmit={(input) =>
                      mutation.mutate({ dropshipOrderId: order.dropshipOrderId, ...input })
                    }
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="products" className="mt-0 space-y-4">
              {supplierId ? <SupplierCatalog supplierId={supplierId} products={data.products} onChanged={refresh} /> : null}
              {supplierId ? (
                <SupplierImportWizard supplierId={supplierId} onImported={refresh} />
              ) : null}
              {data.importJobs.length ? (
                <div className="rounded-xl border bg-card p-4">
                  <h2 className="text-sm font-medium">Yükleme geçmişi</h2>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left uppercase text-muted-foreground">
                        <tr>
                          <th className="py-1">Tarih</th>
                          <th className="py-1">Kaynak</th>
                          <th className="py-1">Satır</th>
                          <th className="py-1">Yeni</th>
                          <th className="py-1">Güncel</th>
                          <th className="py-1">Hatalı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.importJobs.map((job) => (
                          <tr key={job.id} className="border-t">
                            <td className="py-1">{formatDate(job.createdAt)}</td>
                            <td className="py-1">{job.fileName ?? job.sourceUrl ?? job.source}</td>
                            <td className="py-1">{job.rowCount}</td>
                            <td className="py-1">{job.createdCount}</td>
                            <td className="py-1">{job.updatedCount}</td>
                            <td className="py-1">{job.errorCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="changes" className="mt-0 space-y-4">
              {supplierId ? <SupplierChanges supplierId={supplierId} movements={data.movements} returnCount={data.ledger.reduce((total, row) => total + row.scorecard.returned, 0)} cancelledCount={data.ledger.reduce((total, row) => total + row.scorecard.cancelled, 0)} feedPanel={<FeedPanel supplierId={supplierId} feeds={data.feeds} onSaved={refresh} />} /> : null}
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 space-y-4">
              <SupplierAnalytics orders={data.orders} currency={data.suppliers[0]?.currency ?? "TRY"} />
              {data.ledger.map((row) => (
                <div key={row.supplierId} className="rounded-lg border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">{row.supplierName}</h2>
                    <Badge variant="outline">Komisyon %{row.commissionRate}</Badge>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Sipariş" value={String(row.scorecard.orders)} />
                    <Metric
                      label="Ortalama kargoya verme"
                      value={row.scorecard.avgShipHours === null ? "—" : `${row.scorecard.avgShipHours} saat`}
                    />
                    <Metric label="İptal oranı" value={`%${row.scorecard.cancellationRate}`} />
                    <Metric label="İade oranı" value={`%${row.scorecard.returnRate}`} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Kargoya verilen</span>
                      <span>
                        {row.scorecard.shipped}/{row.scorecard.orders}
                      </span>
                    </div>
                    <Progress
                      value={row.scorecard.orders ? (row.scorecard.shipped / row.scorecard.orders) * 100 : 0}
                    />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Metric label="Ciro" value={formatMoney(row.scorecard.revenue, row.currency)} />
                    <Metric label="Platform komisyonu" value={formatMoney(row.scorecard.commission, row.currency)} />
                    <Metric label="Net" value={formatMoney(row.scorecard.net, row.currency)} />
                  </div>
                </div>
              ))}
            </TabsContent>

            <nav
              aria-label="Tedarikçi paneli"
              className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 shadow-elevated sm:hidden"
            >
              {navigation.map((item) => (
                <Button
                  key={item.value}
                  variant="ghost"
                  className={`h-14 min-w-0 flex-col gap-1 px-1 text-[10px] ${activeTab === item.value ? "text-supplier-brand" : "text-muted-foreground"}`}
                  onClick={() => setActiveTab(item.value)}
                  aria-current={activeTab === item.value ? "page" : undefined}
                >
                  <item.icon className="size-5" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Button>
              ))}
            </nav>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

function ProfileSummary({ data, openOrders }: { data: Overview; openOrders: number }) {
  const primary = data.ledger[0];
  const orders = data.ledger.reduce((total, row) => total + row.scorecard.orders, 0);
  const delivered = data.orders.filter((order) => order.status === "delivered").length;
  const shipped = data.orders.filter((order) => order.status === "shipped").length;
  const returned = data.ledger.reduce((total, row) => total + row.scorecard.returned, 0);
  const deliveryRate = orders ? Math.round((delivered / orders) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs text-muted-foreground">Net bakiye</p>
          <p className="mt-1 text-3xl font-semibold">{formatMoney(primary?.net ?? 0, primary?.currency ?? "TRY")}</p>
          <p className="mt-2 text-xs text-muted-foreground">Net = Hakediş − Ödenen − Kesilen</p>
        </div>
        <div className="flex min-w-40 items-center justify-between rounded-lg border bg-card p-5 sm:flex-col sm:justify-center">
          <div>
            <p className="text-xs text-muted-foreground">Teslimat başarısı</p>
            <p className="mt-1 text-2xl font-semibold">%{deliveryRate}</p>
          </div>
          <Progress className="ml-4 w-28 sm:ml-0 sm:mt-3" value={deliveryRate} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Bekleyen" value={String(openOrders)} />
        <Metric label="Yolda" value={String(shipped)} />
        <Metric label="Ulaşan" value={String(delivered)} />
        <Metric label="İade" value={String(returned)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

function SupplierOrderCard({
  order,
  pending,
  onSubmit,
}: {
  order: DeskOrderView;
  pending: boolean;
  onSubmit: (input: {
    status?: "accepted" | "shipped" | "cancelled";
    carrier?: string;
    trackingNumber?: string;
  }) => void;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(order.orderCreatedAt)} · {order.supplierName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {DROPSHIP_STATUS_LABEL[order.status as keyof typeof DROPSHIP_STATUS_LABEL] ?? order.status}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ok = printCargoLabels([
                {
                  orderNumber: order.orderNumber,
                  supplierName: order.supplierName,
                  carrier: carrier || order.carrier || "—",
                  trackingNumber: trackingNumber || order.trackingNumber || null,
                  customerName: order.customerName ?? "—",
                  customerPhone: order.customerPhone ?? null,
                  addressLines: order.addressLines,
                  items: order.items.map((item) => ({
                    title: item.title + (item.variantTitle ? ` · ${item.variantTitle}` : ""),
                    code: item.productCode ?? item.barcode ?? "—",
                    quantity: item.quantity,
                  })),
                  createdAt: order.orderCreatedAt,
                },
              ]);
              if (!ok) toast.error("Yazdırma penceresi açılamadı; açılır pencere izni verin");
            }}
          >
            <Printer className="mr-1 size-4" aria-hidden />
            Kargo etiketi
          </Button>
        </div>
      </div>

      {order.addressLines.length ? (
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Teslimat adresi</p>
          <p className="mt-1 font-medium">{order.customerName ?? "—"}</p>
          {order.addressLines.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {order.note || order.paymentStatus ? <div className="grid gap-2 text-sm sm:grid-cols-2">{order.paymentStatus ? <div className="border-l-2 border-supplier-brand bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Ödeme</p><p className="font-medium">{order.paymentStatus}</p></div> : null}{order.note ? <div className="border-l-2 border-supplier-brand bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Sipariş notu</p><p>{order.note}</p></div> : null}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Ürün</th>
              <th className="py-2">Ürün kodu</th>
              <th className="py-2">Barkod</th>
              <th className="py-2">Adet</th>
              <th className="py-2">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t align-top">
                <td className="py-2">
                  <div className="flex min-w-48 items-center gap-2">{item.imageUrl ? <SmartImage src={item.imageUrl} alt={item.title} width={48} height={48} className="size-12 rounded object-cover" /> : null}<span>{item.title}{item.variantTitle ? <span className="text-muted-foreground"> · {item.variantTitle}</span> : null}</span></div>
                </td>
                <td className="py-2">{item.productCode ?? "—"}</td>
                <td className="py-2">{item.barcode ?? "—"}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">{formatMoney(item.lineTotal, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          Kalem tutarı: <strong>{formatMoney(order.itemsTotal, order.currency)}</strong>
        </span>
        <span className="text-muted-foreground">
          Platform komisyonu: {formatMoney(order.commissionTotal, order.currency)}
        </span>
        <span>
          Hak edilen: <strong>{formatMoney(order.netTotal, order.currency)}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`carrier-${order.dropshipOrderId}`}>
            Kargo firması
          </Label>
          <Input
            id={`carrier-${order.dropshipOrderId}`}
            list="mefti-carriers"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="Aras Kargo"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`tracking-${order.dropshipOrderId}`}>
            Takip numarası
          </Label>
          <Input
            id={`tracking-${order.dropshipOrderId}`}
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onSubmit({ status: "accepted", carrier, trackingNumber })}
          >
            Kabul et
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onSubmit({ status: "shipped", carrier, trackingNumber })}
          >
            <Truck className="mr-1 size-4" aria-hidden />
            Kargoya verdim
          </Button>
        </div>
      </div>
      <datalist id="mefti-carriers">
        {CARRIERS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </section>
  );
}

function FeedPanel({
  supplierId,
  feeds,
  onSaved,
}: {
  supplierId: string;
  feeds: Overview["feeds"];
  onSaved: () => void;
}) {
  const saveFeed = useServerFn(supplierDeskSaveFeed);
  const runFeed = useServerFn(supplierDeskRunFeed);
  const existing = feeds[0];

  const [name, setName] = useState(existing?.name ?? "Fiyat & stok beslemesi");
  const [kind, setKind] = useState<"xml" | "csv" | "json">((existing?.kind as "xml") ?? "xml");
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? "");
  const [schedule, setSchedule] = useState(existing?.schedule ?? "daily");

  const save = useMutation({
    mutationFn: () =>
      saveFeed({
        data: {
          supplierId,
          feedId: existing?.id,
          name,
          kind,
          sourceUrl: sourceUrl.trim(),
          schedule: schedule as "manual" | "hourly" | "daily",
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("Otomatik senkron kaydedildi");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useMutation({
    mutationFn: (feedId: string) => runFeed({ data: { supplierId, feedId } }),
    onSuccess: () => {
      toast.success("Senkron tamamlandı");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div>
          <h2 className="font-medium">Otomatik fiyat & stok senkronu</h2>
          <p className="text-sm text-muted-foreground">
            Bağlantınızı verin; sistem seçtiğiniz sıklıkta fiyat ve stokları günceller.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="feed-name">
              Besleme adı
            </Label>
            <Input id="feed-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="feed-kind">
              Dosya türü
            </Label>
            <select
              id="feed-kind"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as "xml" | "csv" | "json")}
            >
              <option value="xml">XML</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs" htmlFor="feed-url">
              Kaynak bağlantısı
            </Label>
            <Input
              id="feed-url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://tedarikci.com/urunler.xml"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="feed-schedule">
              Sıklık
            </Label>
            <select
              id="feed-schedule"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            >
              {SCHEDULES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!sourceUrl.trim() || save.isPending} onClick={() => save.mutate()}>
            Kaydet
          </Button>
          {existing ? (
            <Button variant="outline" disabled={run.isPending} onClick={() => run.mutate(existing.id)}>
              <RefreshCw className="mr-1 size-4" aria-hidden />
              Şimdi çalıştır
            </Button>
          ) : null}
        </div>
      </div>

      {feeds.length ? (
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-medium">Beslemeler</h3>
          <div className="mt-2 space-y-2 text-sm">
            {feeds.map((feed) => (
              <div key={feed.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <div>
                  <p className="font-medium">{feed.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {feed.kind.toUpperCase()} · {SCHEDULES.find((item) => item.value === feed.schedule)?.label}
                    {feed.lastRunAt ? ` · son çalışma ${formatDate(feed.lastRunAt)}` : ""}
                  </p>
                  {feed.lastError ? <p className="text-xs text-destructive">{feed.lastError}</p> : null}
                </div>
                <Badge variant={feed.isActive ? "secondary" : "outline"}>
                  {feed.isActive ? "Aktif" : "Kapalı"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FinancePanel({ data, onSaved }: { data: Overview; onSaved: () => void }) {
  const saveBank = useServerFn(supplierDeskSaveBank);
  const requestPayout = useServerFn(supplierDeskRequestPayout);
  const primary = data.ledger[0];

  const [iban, setIban] = useState(primary?.iban ?? "");
  const [accountName, setAccountName] = useState(primary?.accountName ?? "");
  const [amount, setAmount] = useState("");

  const bank = useMutation({
    mutationFn: () =>
      saveBank({
        data: { supplierId: primary!.supplierId, iban: iban.trim(), accountName: accountName.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Banka bilgisi kaydedildi");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payout = useMutation({
    mutationFn: () =>
      requestPayout({
        data: { supplierId: primary!.supplierId, amount: Number(amount.replace(",", ".")) },
      }),
    onSuccess: () => {
      toast.success("Ödeme talebiniz iletildi");
      setAmount("");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!primary) return null;

  return (
    <div className="space-y-4">
      {data.ledger.map((row) => (
        <div key={row.supplierId} className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">{row.supplierName} — komisyon defteri</h2>
            <Badge variant="outline">Platform komisyonu %{row.commissionRate}</Badge>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Toplam ciro" value={formatMoney(row.revenue, row.currency)} />
            <Metric label="Komisyon kesintisi" value={formatMoney(row.commission, row.currency)} />
            <Metric label={LEDGER_STATUS_LABELS["pending"]!} value={formatMoney(row.pending, row.currency)} />
            <Metric label={LEDGER_STATUS_LABELS["payable"]!} value={formatMoney(row.payable, row.currency)} />
            <Metric label={LEDGER_STATUS_LABELS["paid"]!} value={formatMoney(row.paid, row.currency)} />
          </div>
        </div>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="font-medium">Banka bilgisi</h3>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="supplier-iban">
              IBAN
            </Label>
            <Input
              id="supplier-iban"
              value={iban}
              onChange={(event) => setIban(event.target.value)}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="supplier-account">
              Hesap sahibi
            </Label>
            <Input
              id="supplier-account"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </div>
          <Button disabled={iban.trim().length < 15 || bank.isPending} onClick={() => bank.mutate()}>
            <BadgeCheck className="mr-1 size-4" aria-hidden />
            Kaydet
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="font-medium">Ödeme talebi</h3>
          <p className="text-sm text-muted-foreground">
            Ödenebilir bakiyeniz: {formatMoney(primary.pending + primary.payable, primary.currency)}
          </p>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="payout-amount">
              Tutar
            </Label>
            <Input
              id="payout-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <Button
            disabled={!Number(amount.replace(",", ".")) || payout.isPending}
            onClick={() => payout.mutate()}
          >
            <Banknote className="mr-1 size-4" aria-hidden />
            Havale talep et
          </Button>

          {data.payouts.length ? (
            <div className="space-y-2 pt-2 text-sm">
              {data.payouts.map((request) => (
                <div key={request.id} className="flex items-center justify-between border-t pt-2">
                  <div>
                    <p className="font-medium">{formatMoney(request.amount, request.currency)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
                  </div>
                  <Badge variant="outline">{PAYOUT_STATUS_LABELS[request.status] ?? request.status}</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
