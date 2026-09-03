import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, BarChart3, PackageSearch, ShoppingBag } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/data-skeleton";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  orderAnalysisQuery,
  productAnalysisQuery,
  stockDepletionAnalysisQuery,
} from "@/lib/marketplace-ops-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/marketplace-analytics")({
  head: () => {
    const title = "Pazaryeri Analitiği — Mefticaret";
    const description =
      "Stok tükenme tahmini, şehir/saat/kanal kırılımlı sipariş analizi ve ürün bazlı ciro/komisyon/kâr analizini tek panelde incele.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <AppShell title="Pazaryeri Analitiği" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Pazaryeri Analitiği" description="Veri bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız analiz verisi bulunamadı.
      </div>
    </AppShell>
  ),
  component: MarketplaceAnalyticsPage,
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function StockDepletionTab({ storeId }: { storeId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery(stockDepletionAnalysisQuery(storeId, days));
  const rows = data ?? [];
  const outOfStock = rows.filter((row) => row.isOutOfStock);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Stokta yok</p>
            <p className="mt-1 text-2xl font-semibold">{outOfStock.length}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tahmini günlük kayıp</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatMoney(outOfStock.reduce((sum, row) => sum + row.estimatedDailyRevenueLoss, 0))}
            </p>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="days">Analiz penceresi (gün)</Label>
          <Input
            id="days"
            type="number"
            min={7}
            max={365}
            className="w-32"
            value={days}
            onChange={(event) => setDays(Math.min(365, Math.max(7, Number(event.target.value) || 30)))}
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : rows.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Analiz için yeterli veri yok.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead>Günlük satış</TableHead>
                <TableHead>Tükenme (gün)</TableHead>
                <TableHead className="text-right">Günlük kayıp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 100).map((row) => (
                <TableRow key={row.variantId}>
                  <TableCell className="font-medium">
                    {row.title}
                    {row.isOutOfStock ? (
                      <Badge variant="destructive" className="ml-2 gap-1">
                        <AlertTriangle className="size-3" /> Stok yok
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatNumber(row.sellableStock)}</TableCell>
                  <TableCell>{row.avgDailySales.toFixed(2)}</TableCell>
                  <TableCell>
                    {row.daysToStockout == null ? "—" : `${row.daysToStockout.toFixed(1)} gün`}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.estimatedDailyRevenueLoss)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function OrderAnalysisTab({ storeId }: { storeId: string }) {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const { data, isLoading } = useQuery(orderAnalysisQuery(storeId, from, to));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="oa-from">Başlangıç</Label>
          <Input id="oa-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="oa-to">Bitiş</Label>
          <Input id="oa-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading || !data ? (
        <>
          <CardSkeleton count={3} />
          <ChartSkeleton />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="surface-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Toplam sipariş</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(data.totalOrders)}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Günlük ortalama ciro</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(data.dailyAverageRevenue)}</p>
            </div>
            <div className="surface-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Son 7 gün ortalaması</p>
              <p className="mt-1 text-2xl font-semibold">{formatMoney(data.last7DayAverageRevenue)}</p>
            </div>
          </div>

          <section className="surface-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Saatlik dağılım</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byHour}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" name="Sipariş" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Şehir kırılımı</h2>
              {data.byCity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byCity.slice(0, 10).map((row) => (
                    <li key={row.city} className="flex items-center justify-between">
                      <span>{row.city}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(row.orders)} sipariş · {formatMoney(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="surface-card p-5">
              <h2 className="mb-3 text-sm font-semibold">Kanal kırılımı</h2>
              {data.byChannel.length === 0 ? (
                <p className="text-sm text-muted-foreground">Veri yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byChannel.map((row) => (
                    <li key={row.channel} className="flex items-center justify-between">
                      <span>{row.channel}</span>
                      <span className="text-muted-foreground">{formatMoney(row.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function ProductAnalysisTab({ storeId }: { storeId: string }) {
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const { data, isLoading } = useQuery(productAnalysisQuery(storeId, from, to));
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="pa-from">Başlangıç</Label>
          <Input id="pa-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pa-to">Bitiş</Label>
          <Input id="pa-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : rows.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Bu dönemde ürün satışı yok.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Adet</TableHead>
                <TableHead>Ciro</TableHead>
                <TableHead>Ort. komisyon</TableHead>
                <TableHead className="text-right">Birim kâr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 100).map((row) => (
                <TableRow key={row.productId}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{formatNumber(row.unitsSold)}</TableCell>
                  <TableCell>{formatMoney(row.revenue)}</TableCell>
                  <TableCell>{row.avgCommission == null ? "—" : formatMoney(row.avgCommission)}</TableCell>
                  <TableCell className="text-right">
                    {row.avgUnitProfit == null ? "—" : formatMoney(row.avgUnitProfit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function MarketplaceAnalyticsPage() {
  const { storeId } = Route.useParams();

  return (
    <AppShell
      storeId={storeId}
      title="Pazaryeri Analitiği"
      description="Stok tükenme riski, sipariş dağılımı ve ürün bazlı kârlılık analizini tek yerden takip edin."
    >
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock" className="gap-2">
            <PackageSearch className="size-4" /> Stok Tükenme Analizi
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2">
            <ShoppingBag className="size-4" /> Sipariş Analizi
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <BarChart3 className="size-4" /> Ürün Analizi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <StockDepletionTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="orders">
          <OrderAnalysisTab storeId={storeId} />
        </TabsContent>
        <TabsContent value="products">
          <ProductAnalysisTab storeId={storeId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
