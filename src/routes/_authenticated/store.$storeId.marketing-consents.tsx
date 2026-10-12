import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/store/$storeId/marketing-consents")({
  head: () => ({
    meta: [
      { title: "Pazarlama İzinleri — Mefticaret" },
      { name: "description", content: "Müşterilerinizin e-posta, SMS ve WhatsApp pazarlama izinlerini görün." },
      { property: "og:title", content: "Pazarlama İzinleri — Mefticaret" },
      { property: "og:description", content: "KVKK uyumlu izin ve abonelik listesi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentsPage,
});

type Tab = "customers" | "newsletter" | "unsubscribed";
type Filter = "all" | "email" | "sms" | "whatsapp" | "none";

function Yes({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success"><Check className="size-4" aria-hidden />Var</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="size-4" aria-hidden />Yok</span>
  );
}

const CHANNEL: Record<string, string> = { email: "E-posta", sms: "SMS", whatsapp: "WhatsApp", push: "Bildirim" };

function ConsentsPage() {
  const { storeId } = Route.useParams();
  const [tab, setTab] = useState<Tab>("customers");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["marketing-consents", storeId],
    queryFn: async () => {
      const [c, n, u] = await Promise.all([
        supabase.from("customers").select("id, full_name, email, phone, accepts_marketing, accepts_sms, accepts_whatsapp, updated_at").eq("store_id", storeId).order("updated_at", { ascending: false }).limit(1000),
        supabase.from("email_subscribers").select("id, email, full_name, status, source, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000),
        supabase.from("customer_unsubscribes").select("id, recipient, channel, source, created_at").eq("store_id", storeId).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (c.error) throw c.error;
      return { customers: c.data ?? [], newsletter: n.data ?? [], unsub: u.data ?? [] };
    },
  });

  const s = q.trim().toLowerCase();
  const match = (...v: (string | null | undefined)[]) => !s || v.some((x) => x?.toLowerCase().includes(s));

  const customers = useMemo(() => (data?.customers ?? []).filter((c) => {
    if (!match(c.full_name, c.email, c.phone)) return false;
    if (filter === "email") return c.accepts_marketing;
    if (filter === "sms") return c.accepts_sms;
    if (filter === "whatsapp") return c.accepts_whatsapp;
    if (filter === "none") return !c.accepts_marketing && !c.accepts_sms && !c.accepts_whatsapp;
    return true;
  }), [data, filter, s]);

  const counts = useMemo(() => {
    const l = data?.customers ?? [];
    return { email: l.filter((c) => c.accepts_marketing).length, sms: l.filter((c) => c.accepts_sms).length, whatsapp: l.filter((c) => c.accepts_whatsapp).length };
  }, [data]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "customers", label: "Müşteri izinleri" },
    { id: "newsletter", label: "Bülten aboneleri" },
    { id: "unsubscribed", label: "Abonelikten çıkanlar" },
  ];

  return (
    <AppShell storeId={storeId} title="Pazarlama İzinleri" description="Hangi müşterinin hangi kanaldan pazarlama mesajı almayı kabul ettiğini görün. İzinleri yalnız müşterinin kendisi verir veya geri alır.">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-3 gap-3">
          {[["E-posta izni", counts.email], ["SMS izni", counts.sms], ["WhatsApp izni", counts.whatsapp]].map(([l, v]) => (
            <div key={l} className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="text-xl font-semibold tabular-nums">{isLoading ? "…" : v}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${tab === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input placeholder="Ad, e-posta veya telefon ara" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          {tab === "customers" && (
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="İzin filtresi">
              <option value="all">Tümü</option>
              <option value="email">E-posta izni var</option>
              <option value="sms">SMS izni var</option>
              <option value="whatsapp">WhatsApp izni var</option>
              <option value="none">Hiç izin yok</option>
            </select>
          )}
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        : error ? <p className="text-sm text-destructive">Liste yüklenemedi: {(error as Error).message}</p>
        : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            {tab === "customers" && (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Müşteri</th><th className="p-3">E-posta</th><th className="p-3">Telefon</th><th className="p-3">E-posta izni</th><th className="p-3">SMS izni</th><th className="p-3">WhatsApp izni</th></tr></thead>
                <tbody>
                  {customers.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Kayıt yok.</td></tr> : customers.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{c.full_name}</td><td className="p-3">{c.email ?? "—"}</td><td className="p-3">{c.phone ?? "—"}</td>
                      <td className="p-3"><Yes on={c.accepts_marketing} /></td><td className="p-3"><Yes on={c.accepts_sms} /></td><td className="p-3"><Yes on={c.accepts_whatsapp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "newsletter" && (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">E-posta</th><th className="p-3">Ad</th><th className="p-3">Durum</th><th className="p-3">Kaynak</th><th className="p-3">Tarih</th></tr></thead>
                <tbody>
                  {(data?.newsletter ?? []).filter((n) => match(n.email, n.full_name)).map((n) => (
                    <tr key={n.id} className="border-b last:border-0">
                      <td className="p-3">{n.email}</td><td className="p-3">{n.full_name ?? "—"}</td>
                      <td className="p-3">{n.status === "subscribed" ? "Abone" : n.status === "unsubscribed" ? "Ayrıldı" : n.status}</td>
                      <td className="p-3">{n.source}</td><td className="p-3 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                  {(data?.newsletter ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Bülten abonesi yok.</td></tr>}
                </tbody>
              </table>
            )}
            {tab === "unsubscribed" && (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Alıcı</th><th className="p-3">Kanal</th><th className="p-3">Kaynak</th><th className="p-3">Tarih</th></tr></thead>
                <tbody>
                  {(data?.unsub ?? []).filter((u) => match(u.recipient)).map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3">{u.recipient}</td><td className="p-3">{CHANNEL[u.channel] ?? u.channel}</td><td className="p-3">{u.source}</td>
                      <td className="p-3 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("tr-TR")}</td>
                    </tr>
                  ))}
                  {(data?.unsub ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Abonelikten çıkan yok.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
