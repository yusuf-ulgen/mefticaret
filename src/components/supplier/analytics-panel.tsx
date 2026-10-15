import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/mefti";
import { supplierSalesBucket } from "@/lib/supplier-sales-bucket";
function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-supplier-brand bg-muted/20 p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function SupplierAnalytics({
  orders,
  currency,
}: {
  orders: Array<{
    orderCreatedAt: string;
    itemsTotal: number | null;
    netTotal: number | null;
    commissionTotal: number | null;
    items: Array<{ quantity: number; title: string }>;
  }>;
  currency: string;
}) {
  const [period, setPeriod] = useState("daily");
  const [metric, setMetric] = useState("revenue");
  const points = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; revenue: number; quantity: number; commission: number }
    >();
    for (const order of orders) {
      if (order.itemsTotal === null) continue;
      const key = supplierSalesBucket(order.orderCreatedAt, period);
      if (!key) continue;
      const row = grouped.get(key) ?? { label: key, revenue: 0, quantity: 0, commission: 0 };
      row.revenue += order.itemsTotal;
      row.commission += order.commissionTotal ?? 0;
      row.quantity += order.items.reduce((sum, item) => sum + item.quantity, 0);
      grouped.set(key, row);
    }
    return Array.from(grouped.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-24);
  }, [orders, period]);
  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .flatMap((order) => order.items)
      .forEach((item) => map.set(item.title, (map.get(item.title) ?? 0) + item.quantity));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [orders]);
  const revenue = orders.reduce((sum, row) => sum + (row.itemsTotal ?? 0), 0);
  const quantity = orders.flatMap((row) => row.items).reduce((sum, row) => sum + row.quantity, 0);
  const commission = orders.reduce((sum, row) => sum + (row.commissionTotal ?? 0), 0);
  const periods: Array<[string, string]> = [
    ["hourly", "Saatlik"],
    ["daily", "Günlük"],
    ["monthly", "Aylık"],
    ["yearly", "Yıllık"],
  ];
  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-4 gap-1 bg-card p-1">
        {periods.map(([value, label]) => (
          <Button
            className="min-w-0 px-1 text-xs"
            key={value}
            size="sm"
            variant={period === value ? "default" : "ghost"}
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SmallMetric label="Adet" value={String(quantity)} />
        <SmallMetric label="Ciro" value={formatMoney(revenue, currency)} />
        <SmallMetric label="R/C" value={commission ? (revenue / commission).toFixed(1) : "—"} />
      </div>
      <section className="min-w-0 border-y bg-card p-3 sm:rounded-lg sm:border sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h2 className="truncate font-semibold">Satış grafiği</h2>
          <select
            className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            <option value="quantity">Adet</option>
            <option value="revenue">Ciro</option>
            <option value="commission">Komisyon</option>
          </select>
        </div>
        {points.length ? (
          <ChartContainer
            className="mt-4 h-64 w-full min-w-0 aspect-auto"
            config={{ value: { label: metric, color: "var(--supplier-brand)" } }}
          >
            <AreaChart data={points}>
              <defs>
                <linearGradient id="supplierArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="var(--color-value)"
                fill="url(#supplierArea)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <Empty text="Grafik için tamamlanmış sipariş verisi bekleniyor." />
        )}
      </section>
      <section className="border-y bg-card p-4 sm:rounded-lg sm:border">
        <h2 className="flex items-center gap-2 font-semibold">
          <BarChart3 className="size-4 text-supplier-brand" /> Çok satanlar
        </h2>
        {topProducts.length ? (
          <div className="mt-3 space-y-3">
            {topProducts.map(([name, count], index) => (
              <div key={name} className="flex min-w-0 items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                <strong className="shrink-0 text-sm">{count} adet</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Henüz satılan ürün yok.</p>
        )}
      </section>
      <div className="grid grid-cols-2 gap-2">
        <SmallMetric label="Reklam" value="Ölçüm yok" />
        <SmallMetric
          label="Sipariş ort."
          value={formatMoney(orders.length ? revenue / orders.length : 0, currency)}
        />
        <SmallMetric
          label="Net kazanç"
          value={
            orders.some((row) => row.netTotal === null)
              ? "Eksik finans kaydı"
              : formatMoney(
                  orders.reduce((sum, row) => sum + (row.netTotal ?? 0), 0),
                  currency,
                )
          }
        />
        <SmallMetric
          label="Komisyon"
          value={
            orders.some((row) => row.commissionTotal === null)
              ? "Eksik finans kaydı"
              : formatMoney(commission, currency)
          }
        />
      </div>
    </div>
  );
}
