import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/guests")({
  head: () => ({
    meta: [
      { title: "Misafir Kullanıcılar — Mefticaret" },
      { name: "description", content: "Üye olmadan sipariş veren misafir müşterilerinizi görün." },
      { property: "og:title", content: "Misafir Kullanıcılar — Mefticaret" },
      { property: "og:description", content: "Üyeliksiz sipariş veren müşterilerin listesi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestsPage,
});

type Guest = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  orders: number;
  totals: Map<string, number>;
  last: string;
};

function GuestsPage() {
  const { storeId } = Route.useParams();
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["guests", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_name, customer_email, customer_phone, grand_total, currency, created_at, status")
        .eq("store_id", storeId)
        .is("customer_id", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, Guest>();
      for (const o of data ?? []) {
        const email = o.customer_email?.trim().toLowerCase() || null;
        const phone = o.customer_phone?.trim() || null;
        if (!email && !phone) continue; // kasa (isimsiz) satışları misafir sayılmaz
        const key = email ?? phone!;
        const g = map.get(key) ?? { key, name: o.customer_name || "—", email, phone, orders: 0, totals: new Map(), last: o.created_at };
        g.orders += 1;
        if (!["cancelled", "refunded"].includes(o.status as string)) {
          const cur = o.currency || "TRY";
          g.totals.set(cur, (g.totals.get(cur) ?? 0) + Number(o.grand_total ?? 0));
        }
        if (!g.phone && phone) g.phone = phone;
        map.set(key, g);
      }
      return { guests: [...map.values()], capped: (data ?? []).length >= 1000 };
    },
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = data?.guests ?? [];
    if (!s) return all;
    return all.filter((g) => [g.name, g.email, g.phone].some((v) => v?.toLowerCase().includes(s)));
  }, [data, q]);

  return (
    <AppShell storeId={storeId} title="Misafir Kullanıcılar" description="Üye olmadan sipariş veren müşterileriniz. Aynı e-posta veya telefonla verilen siparişler tek kişide toplanır.">
      <div className="space-y-4 p-4 sm:p-6">
        <Input placeholder="Ad, e-posta veya telefon ara" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        {data?.capped && <p className="text-xs text-muted-foreground">Son 1000 misafir siparişi gösteriliyor.</p>}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Liste yüklenemedi: {(error as Error).message}</p>
        ) : list.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Henüz misafir olarak sipariş veren müşteri yok.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Ad</th>
                  <th className="p-3">E-posta</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3 text-right">Sipariş</th>
                  <th className="p-3 text-right">Toplam</th>
                  <th className="p-3">Son sipariş</th>
                </tr>
              </thead>
              <tbody>
                {list.map((g) => (
                  <tr key={g.key} className="border-b last:border-0">
                    <td className="p-3 font-medium">{g.name}</td>
                    <td className="p-3">{g.email ?? "—"}</td>
                    <td className="p-3">{g.phone ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{g.orders}</td>
                    <td className="p-3 text-right tabular-nums">
                      {g.totals.size === 0 ? "—" : [...g.totals].map(([c, v]) => <div key={c}>{formatMoney(v, c)}</div>)}
                    </td>
                    <td className="p-3 whitespace-nowrap">{new Date(g.last).toLocaleDateString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
