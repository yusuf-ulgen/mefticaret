import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/mefti";

type Period = "today" | "yesterday" | "week" | "month";
const LABEL: Record<Period, string> = { today: "Bugün", yesterday: "Dün", week: "1 Hafta", month: "30 Gün" };

function range(p: Period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  if (p === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  if (p === "week") start.setDate(start.getDate() - 6);
  if (p === "month") start.setDate(start.getDate() - 29);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Panel ana sayfası "Mağaza özeti": seçilen dönemde sipariş, ciro, sepet, müşteri, bekleyen. */
export function StoreSummary({ storeId }: { storeId: string }) {
  const [p, setP] = useState<Period>("today");
  const { data, isLoading } = useQuery({
    queryKey: ["store-summary", storeId, p],
    queryFn: async () => {
      const { from, to } = range(p);
      const [o, c] = await Promise.all([
        supabase.from("orders").select("grand_total, currency, payment_status, status").eq("store_id", storeId).gte("created_at", from).lt("created_at", to).limit(5000),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId).gte("created_at", from).lt("created_at", to),
      ]);
      if (o.error) throw o.error;
      const rows = (o.data ?? []).filter((r) => r.status !== "cancelled");
      const paid = rows.filter((r) => r.payment_status === "paid" || r.payment_status === "partially_refunded");
      const totals = new Map<string, number>();
      for (const r of paid) totals.set(r.currency || "TRY", (totals.get(r.currency || "TRY") ?? 0) + Number(r.grand_total ?? 0));
      const pending = rows.filter((r) => ["pending", "awaiting_payment", "paid", "processing"].includes(r.status as string)).length;
      return { orders: rows.length, paidCount: paid.length, totals: [...totals], customers: c.count ?? 0, pending };
    },
  });

  const money = (t: [string, number][]) => (t.length ? t.map(([c, v]) => formatMoney(v, c)).join(" · ") : formatMoney(0));
  const aov: [string, number][] = data && data.totals.length === 1 && data.paidCount ? [[data.totals[0][0], data.totals[0][1] / data.paidCount]] : [];
  const cards = [
    { label: "Sipariş", value: data ? String(data.orders) : "" },
    { label: "Ciro (ödenen)", value: data ? money(data.totals) : "" },
    { label: "Ortalama sepet", value: data ? (data.totals.length > 1 ? "Para birimleri ayrı" : money(aov)) : "" },
    { label: "Yeni müşteri", value: data ? String(data.customers) : "" },
    { label: "Hazırlanacak sipariş", value: data ? String(data.pending) : "" },
  ];

  return (
    <section className="space-y-3" aria-label="Mağaza özeti">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Mağaza özeti</h2>
        <div className="flex gap-1 rounded-full border bg-card p-1" role="tablist">
          {(Object.keys(LABEL) as Period[]).map((k) => (
            <button key={k} role="tab" aria-selected={p === k} onClick={() => setP(k)}
              className={`rounded-full px-3 py-1 text-xs ${p === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 truncate text-lg font-semibold tabular-nums">{isLoading ? "…" : c.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
