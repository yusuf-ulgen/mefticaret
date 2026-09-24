import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";

import { LiveBadge, CustomersSection, FunnelSection, OrdersSection, OverviewSection, ProductsSection, SalesSection, TrafficSection } from "@/components/analytics/analytics-sections";
import { PeriodPicker, PullToRefresh } from "@/components/analytics/analytics-kit";
import { ReportsSection } from "@/components/analytics/analytics-reports";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERIODS, type PeriodInput } from "@/lib/analytics-v2";
import { storeQuery } from "@/lib/store-queries";

const TABS = [
  ["overview", "Genel Bakış"], ["sales", "Satışlar"], ["orders", "Siparişler"], ["products", "Ürünler"],
  ["customers", "Müşteriler"], ["traffic", "Trafik"], ["funnel", "Dönüşüm Hunisi"], ["reports", "Raporlar"],
] as const;
type Tab = (typeof TABS)[number][0];
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/_authenticated/store/$storeId/analytics")({
  validateSearch: (s) =>
    z.object({
      tab: z.enum(TABS.map((t) => t[0]) as [Tab, ...Tab[]]).catch("overview").default("overview"),
      period: z.enum(PERIODS).catch("30d").default("30d"),
      from: z.string().regex(dateRe).optional().catch(undefined),
      to: z.string().regex(dateRe).optional().catch(undefined),
    }).parse(s),
  head: () => ({
    meta: [
      { title: "Analitik — Mefticaret" },
      { name: "description", content: "Satış, sipariş, ürün, müşteri, trafik ve dönüşüm hunisi analitiği; canlı ziyaretçi ve raporlar." },
      { property: "og:title", content: "Analitik — Mefticaret" },
      { property: "og:description", content: "Mağazanızın satış ve ziyaretçi performansını tek ekranda izleyin." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { storeId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const currency = store?.currency ?? "TRY";
  const period: PeriodInput = {
    period: search.period,
    ...(search.period === "custom" && search.from ? { from: search.from } : {}),
    ...(search.period === "custom" && search.to ? { to: search.to } : {}),
  };
  const setPeriod = (p: PeriodInput) => navigate({ search: (s) => ({ ...s, period: p.period, from: p.from, to: p.to }), replace: true });
  const setTab = (tab: string) => navigate({ search: (s) => ({ ...s, tab: tab as Tab }), replace: true });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["analytics-v2", storeId] }), [qc, storeId]);

  return (
    <AppShell storeId={storeId} title="Analitik" description="Satış, ziyaretçi ve dönüşüm performansı" actions={<LiveBadge storeId={storeId} />}>
      <PullToRefresh onRefresh={refresh}>
        <div className="space-y-4">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Tabs value={search.tab} onValueChange={setTab}>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <TabsList className="h-auto w-max">
                {TABS.map(([k, l]) => <TabsTrigger key={k} value={k} className="min-h-10 px-3">{l}</TabsTrigger>)}
              </TabsList>
            </div>
            <TabsContent value="overview" className="pt-2"><OverviewSection storeId={storeId} period={period} currency={currency} /></TabsContent>
            <TabsContent value="sales" className="pt-2"><SalesSection storeId={storeId} period={period} currency={currency} /></TabsContent>
            <TabsContent value="orders" className="pt-2"><OrdersSection storeId={storeId} period={period} /></TabsContent>
            <TabsContent value="products" className="pt-2"><ProductsSection storeId={storeId} period={period} currency={currency} /></TabsContent>
            <TabsContent value="customers" className="pt-2"><CustomersSection storeId={storeId} period={period} currency={currency} /></TabsContent>
            <TabsContent value="traffic" className="pt-2"><TrafficSection storeId={storeId} period={period} currency={currency} /></TabsContent>
            <TabsContent value="funnel" className="pt-2"><FunnelSection storeId={storeId} period={period} /></TabsContent>
            <TabsContent value="reports" className="pt-2"><ReportsSection storeId={storeId} period={period} /></TabsContent>
          </Tabs>
        </div>
      </PullToRefresh>
    </AppShell>
  );
}
