import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/store/$storeId/calendar")({
  head: () => ({
    meta: [
      { title: "Takvim — Mefticaret" },
      { name: "description", content: "Kampanyalarınızı, indirimlerinizi ve günlük siparişlerinizi takvimde görün." },
      { property: "og:title", content: "Takvim — Mefticaret" },
      { property: "og:description", content: "Mağaza takvimi: kampanya, indirim ve sipariş günleri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

type Kind = "email" | "holiday" | "discount";
type Ev = { id: string; kind: Kind; title: string; start: string; end: string };
const KIND: Record<Kind, { label: string; cls: string }> = {
  email: { label: "E-posta", cls: "bg-primary/15 text-primary" },
  holiday: { label: "Kampanya", cls: "bg-success/15 text-success" },
  discount: { label: "İndirim", cls: "bg-warning/20 text-warning-foreground" },
};
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarPage() {
  const { storeId } = Route.useParams();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null);
  const from = new Date(month.getFullYear(), month.getMonth(), 1);
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["calendar", storeId, key(from)],
    queryFn: async () => {
      const f = from.toISOString(), t = to.toISOString();
      const [em, ho, di, or] = await Promise.all([
        supabase.from("email_campaigns").select("id, name, scheduled_at, sent_at, starts_at, ends_at").eq("store_id", storeId).limit(500),
        supabase.from("holiday_campaigns").select("id, name, starts_at, ends_at").eq("store_id", storeId).lt("starts_at", t).gte("ends_at", f).limit(500),
        supabase.from("discounts").select("id, title, starts_at, ends_at").eq("store_id", storeId).lt("starts_at", t).limit(500),
        supabase.from("orders").select("created_at").eq("store_id", storeId).gte("created_at", f).lt("created_at", t).not("status", "eq", "cancelled").limit(5000),
      ]);
      const evs: Ev[] = [];
      for (const e of em.data ?? []) {
        const s = e.sent_at ?? e.scheduled_at ?? e.starts_at;
        if (s) evs.push({ id: e.id, kind: "email", title: e.name, start: s, end: e.ends_at ?? s });
      }
      for (const h of ho.data ?? []) evs.push({ id: h.id, kind: "holiday", title: h.name, start: h.starts_at, end: h.ends_at });
      for (const d of di.data ?? []) if (!d.ends_at || d.ends_at >= f) evs.push({ id: d.id, kind: "discount", title: d.title || "İndirim", start: d.starts_at, end: d.ends_at ?? t });
      const orders: Record<string, number> = {};
      for (const o of or.data ?? []) { const k = key(new Date(o.created_at)); orders[k] = (orders[k] ?? 0) + 1; }
      if (or.error) throw or.error;
      return { evs, orders };
    },
  });

  const cells = useMemo(() => {
    const lead = (from.getDay() + 6) % 7;
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const eventsOn = (d: Date) => {
    const s = new Date(d), e = new Date(d); e.setDate(e.getDate() + 1);
    return (data?.evs ?? []).filter((ev) => new Date(ev.start) < e && new Date(ev.end) >= s);
  };
  const today = key(new Date());
  const selDate = sel ? cells.find((c) => c && key(c) === sel) ?? null : null;

  return (
    <AppShell storeId={storeId} title="Takvim" description="Kampanyalar, indirimler ve günlük sipariş sayıları tek takvimde.">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Önceki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <div className="min-w-40 text-center font-semibold">{month.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</div>
          <Button variant="outline" size="icon" aria-label="Sonraki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Bugün</Button>
          <div className="ml-auto hidden flex-wrap gap-2 text-xs sm:flex">
            {Object.values(KIND).map((k) => <span key={k.label} className={`rounded px-2 py-0.5 ${k.cls}`}>{k.label}</span>)}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">Takvim yüklenemedi: {(error as Error).message}</p>}
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border bg-card text-sm">
          {DAYS.map((d) => <div key={d} className="border-b p-2 text-center text-xs text-muted-foreground">{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={`x${i}`} className="min-h-16 border-b border-r bg-muted/30 sm:min-h-24" />;
            const k = key(c), evs = eventsOn(c), oc = data?.orders[k] ?? 0;
            return (
              <button key={k} onClick={() => setSel(k)} aria-label={`${c.toLocaleDateString("tr-TR")}, ${oc} sipariş, ${evs.length} etkinlik`}
                className={`min-h-16 border-b border-r p-1 text-left align-top sm:min-h-24 sm:p-1.5 ${sel === k ? "ring-2 ring-inset ring-primary" : ""}`}>
                <div className={`text-xs ${k === today ? "inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}`}>{c.getDate()}</div>
                {oc > 0 && <div className="text-[10px] text-muted-foreground tabular-nums">{oc} sipariş</div>}
                <div className="mt-0.5 hidden space-y-0.5 sm:block">
                  {evs.slice(0, 2).map((ev) => <div key={ev.kind + ev.id} className={`truncate rounded px-1 text-[10px] ${KIND[ev.kind].cls}`}>{ev.title}</div>)}
                  {evs.length > 2 && <div className="text-[10px] text-muted-foreground">+{evs.length - 2}</div>}
                </div>
                {evs.length > 0 && <div className="mt-0.5 size-1.5 rounded-full bg-primary sm:hidden" />}
              </button>
            );
          })}
        </div>
        {selDate && (
          <div className="rounded-xl border bg-card p-4 text-sm">
            <div className="mb-2 font-medium">{selDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}</div>
            <div className="mb-2 text-muted-foreground">{data?.orders[sel!] ?? 0} sipariş</div>
            {eventsOn(selDate).length === 0 ? <p className="text-muted-foreground">Bu gün için kampanya veya indirim yok.</p> : (
              <ul className="space-y-1">
                {eventsOn(selDate).map((ev) => (
                  <li key={ev.kind + ev.id} className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${KIND[ev.kind].cls}`}>{KIND[ev.kind].label}</span>{ev.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
      </div>
    </AppShell>
  );
}
