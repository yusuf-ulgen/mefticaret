import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity, ArrowRight, BarChart3, CreditCard, Mail, MessageCircle, Package, Radio, ShoppingBag,
  Sparkles, Tag, Truck, Users, Wallet, LayoutGrid, Globe2,
} from "lucide-react";
import { useState, type ComponentType } from "react";

import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/mefti";

type Period = "today" | "yesterday" | "week" | "month";
const LABEL: Record<Period, string> = { today: "Bugün", yesterday: "Dün", week: "1 Hafta", month: "30 Gün" };
const DAYS: Record<Period, number> = { today: 1, yesterday: 1, week: 7, month: 30 };

function range(p: Period, shift = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (p === "yesterday") start.setDate(start.getDate() - 1);
  else start.setDate(start.getDate() - (DAYS[p] - 1));
  start.setDate(start.getDate() - shift * DAYS[p]);
  const end = new Date(start);
  end.setDate(end.getDate() + DAYS[p]);
  return { from: start, to: end };
}

type Row = { grand_total: number | string | null; currency: string | null; payment_status: string; status: string; created_at: string };
type Ev = { kind: string; session_id: string; created_at: string };

async function load(storeId: string, p: Period, shift: number) {
  const { from, to } = range(p, shift);
  const [o, e] = await Promise.all([
    supabase.from("orders").select("grand_total, currency, payment_status, status, created_at").eq("store_id", storeId)
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(5000),
    supabase.from("analytics_events").select("kind, session_id, created_at").eq("store_id", storeId)
      .in("kind", ["page_view", "add_to_cart", "checkout", "purchase"])
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).limit(20000),
  ]);
  if (o.error) throw o.error;
  const orders = ((o.data ?? []) as Row[]).filter((r) => r.status !== "cancelled");
  const events = (e.data ?? []) as Ev[];
  const sessions = new Set(events.map((x) => x.session_id));
  const cartSessions = new Set(events.filter((x) => x.kind === "add_to_cart").map((x) => x.session_id));
  const checkoutSessions = new Set(events.filter((x) => x.kind === "checkout").map((x) => x.session_id));
  const buySessions = new Set(events.filter((x) => x.kind === "purchase").map((x) => x.session_id));
  const paid = orders.filter((r) => r.payment_status === "paid" || r.payment_status === "partially_refunded");
  const totals = new Map<string, number>();
  for (const r of paid) totals.set(r.currency || "TRY", (totals.get(r.currency || "TRY") ?? 0) + Number(r.grand_total ?? 0));
  const status = new Map<string, number>();
  for (const r of orders) status.set(r.payment_status, (status.get(r.payment_status) ?? 0) + 1);

  // Mini grafik: tek günde saatlik, çok günde günlük kova.
  const buckets = DAYS[p] === 1 ? 24 : DAYS[p];
  const span = (to.getTime() - from.getTime()) / buckets;
  const idx = (iso: string) => Math.min(buckets - 1, Math.max(0, Math.floor((new Date(iso).getTime() - from.getTime()) / span)));
  const sSess = Array.from({ length: buckets }, () => new Set<string>());
  for (const x of events) sSess[idx(x.created_at)].add(x.session_id);
  const sOrd = new Array(buckets).fill(0);
  const sRev = new Array(buckets).fill(0);
  for (const r of orders) sOrd[idx(r.created_at)]++;
  for (const r of paid) sRev[idx(r.created_at)] += Number(r.grand_total ?? 0);

  return {
    sessions: sessions.size,
    orders: orders.length,
    totals: [...totals],
    revenueSum: [...totals.values()].reduce((a, b) => a + b, 0),
    conversion: sessions.size ? (buySessions.size / sessions.size) * 100 : 0,
    cartRate: sessions.size ? (cartSessions.size / sessions.size) * 100 : 0,
    abandoned: [...cartSessions].filter((s) => !buySessions.has(s) && !checkoutSessions.has(s)).length,
    status: [...status],
    spark: { sessions: sSess.map((s) => s.size), orders: sOrd, revenue: sRev },
  };
}

const pct = (v: number) => `%${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  if (before === 0) return <span className="text-[11px] text-muted-foreground">{now === 0 ? "%0,0" : "Karşılaştırma yok"}</span>;
  const d = ((now - before) / before) * 100;
  const up = d >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-success" : "text-destructive"}`}>
      {up ? "↑" : "↓"} %{Math.abs(d).toLocaleString("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
      <span className="sr-only"> önceki döneme göre</span>
    </span>
  );
}

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${28 - (v / max) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-24 text-primary" aria-hidden preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ icon: Icon, label, value, now, before, spark, foot }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; now?: number; before?: number; spark?: number[]; foot: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-3.5" /></span>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="truncate text-xl font-semibold tabular-nums">{value}</span>
        {now !== undefined && <Delta now={now} before={before} />}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-xs text-muted-foreground">{foot}</span>
        {spark && <Spark data={spark} />}
      </div>
    </div>
  );
}

const PROMPTS = ["Mağazamın durumu nasıl?", "Stoksuz ürünleri kontrol et", "Bugün kaç sipariş geldi?"];
const PAY_LABEL: Record<string, string> = { paid: "Ödendi", pending: "Bekliyor", failed: "Başarısız", refunded: "İade", partially_refunded: "Kısmi iade" };

/** Panel ana sayfası karşılama ekranı: özet kartları, Copilot, kısayol kartları, ödeme ve dönüşüm. */
export function StoreSummary({ storeId }: { storeId: string }) {
  const [p, setP] = useState<Period>("today");
  const navigate = useNavigate();
  const cur = useQuery({ queryKey: ["store-summary", storeId, p, 0], queryFn: () => load(storeId, p, 0) });
  const prev = useQuery({ queryKey: ["store-summary", storeId, p, 1], queryFn: () => load(storeId, p, 1) });
  const live = useQuery({
    queryKey: ["store-summary-live", storeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await supabase.from("analytics_events").select("visitor_id").eq("store_id", storeId).gte("created_at", since).limit(2000);
      return new Set((data ?? []).map((x) => x.visitor_id)).size;
    },
  });
  const d = cur.data;
  const b = prev.data;
  const dash = cur.isLoading ? "…" : "0";
  const goCopilot = () => navigate({ to: "/store/$storeId/copilot", params: { storeId } });
  const s = { storeId };

  return (
    <div className="space-y-4">
      <section className="space-y-3" aria-label="Mağaza özeti">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm"><span className="font-semibold">Mağaza özeti</span><span className="text-muted-foreground"> · {LABEL[p]}</span></h2>
          <div className="flex gap-1 rounded-xl border bg-card p-1" role="tablist">
            {(Object.keys(LABEL) as Period[]).map((k) => (
              <button key={k} role="tab" aria-selected={p === k} onClick={() => setP(k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${p === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                {LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi icon={Users} label="Oturumlar" value={d ? String(d.sessions) : dash} now={d?.sessions} before={b?.sessions} spark={d?.spark.sessions} foot={LABEL[p]} />
          <Kpi icon={Wallet} label="Toplam satışlar" value={d ? (d.totals.length ? d.totals.map(([c, v]) => formatMoney(v, c)).join(" · ") : formatMoney(0)) : dash}
            now={d && d.totals.length <= 1 ? d.revenueSum : undefined} before={b?.revenueSum} spark={d?.spark.revenue} foot={LABEL[p]} />
          <Kpi icon={ShoppingBag} label="Siparişler" value={d ? String(d.orders) : dash} now={d?.orders} before={b?.orders} spark={d?.spark.orders} foot={LABEL[p]} />
          <Kpi icon={Activity} label="Dönüşüm oranı" value={d ? pct(d.conversion) : dash} now={d?.conversion} before={b?.conversion} foot={LABEL[p]} />
          <Kpi icon={Radio} label="Canlı ziyaretçiler" value={live.data === undefined ? "…" : String(live.data)} foot="Son 5 dakikada mağazada" />
        </div>
      </section>

      {/* Copilot karşılama alanı */}
      <section className="relative overflow-hidden rounded-2xl border bg-card p-6 md:p-8">
        <Globe2 aria-hidden className="pointer-events-none absolute -right-10 -top-10 hidden size-80 text-primary/10 md:block" strokeWidth={0.6} />
        <div className="relative max-w-xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"><Sparkles className="size-3.5" /> Mefticaret Copilot</p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight md:text-3xl">Bugün sana <span className="text-primary">nasıl yardımcı olabilirim?</span></h2>
          <form className="mt-5 flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-3" onSubmit={(e) => { e.preventDefault(); goCopilot(); }}>
            <Sparkles className="size-4 shrink-0 text-primary" />
            <input aria-label="Copilot'a sor" placeholder="Copilot'a sorun… (Örn. bu hafta en çok satan ürün)" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="submit" aria-label="Gönder" className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><ArrowRight className="size-4" /></button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROMPTS.map((t) => (
              <button key={t} onClick={goCopilot} className="rounded-full border bg-background px-3 py-1.5 text-sm hover:border-primary">{t}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Kısayol kartları */}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Öne çıkanlar">
        <Link to="/store/$storeId/site-kit" params={s} className="rounded-2xl bg-foreground p-5 text-background">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Site Kit</p>
          <h3 className="mt-2 text-lg font-semibold">Google & Meta servislerini bağla</h3>
          <p className="mt-1 text-sm opacity-75">Analytics, Tag Manager ve Meta Pixel'i tek panelden entegre et.</p>
          <span className="mt-4 inline-block rounded-lg bg-background px-3 py-1.5 text-sm font-medium text-foreground">Servisleri bağla</span>
        </Link>
        <Link to="/store/$storeId/discounts" params={s} className="rounded-2xl border bg-primary/5 p-5">
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">KUPON</span>
          <h3 className="mt-2 text-lg font-semibold">İndirim ve kupon oluştur</h3>
          <p className="mt-1 text-sm text-muted-foreground">Sepette indirim, hoş geldin kuponu ve zamanlı kampanyalar.</p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium text-primary"><Tag className="size-3.5" /> Kuponlara git</span>
        </Link>
        <Link to="/store/$storeId/shipping" params={s} className="rounded-2xl border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kargo</p>
          <h3 className="mt-2 text-lg font-semibold">Kargo ayarlarını yapılandır</h3>
          <p className="mt-1 text-sm text-muted-foreground">Kargo firmalarını ekle, bölge ve ağırlık kurallarını tanımla.</p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium text-primary"><Truck className="size-3.5" /> Ayarları aç</span>
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/store/$storeId/email-marketing" as const, icon: Mail, t: "E-Posta Ayarları", d: "SMTP ve sipariş bildirim şablonları.", c: "Ayarları düzenle" },
          { to: "/store/$storeId/whatsapp" as const, icon: MessageCircle, t: "WhatsApp Pazarlama", d: "Sipariş bildirimleri ve kampanyalar.", c: "Yönet" },
          { to: "/store/$storeId/analytics" as const, icon: BarChart3, t: "Mefticaret Analitik", d: "Ziyaretçi, dönüşüm ve satış raporları.", c: "Raporu aç" },
        ].map((x) => (
          <Link key={x.t} to={x.to} params={s} className="rounded-2xl border bg-card p-5">
            <x.icon className="size-6 text-primary" />
            <h3 className="mt-3 font-semibold">{x.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">{x.c} <ArrowRight className="size-3.5" /></span>
          </Link>
        ))}
        <Link to="/store/$storeId/payments" params={s} className="rounded-2xl bg-foreground p-5 text-background">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Ödeme</p>
          <h3 className="mt-2 font-semibold">Ödeme yöntemleri</h3>
          <p className="mt-1 text-sm opacity-75">Sanal POS ve havaleyi tek panelden yönet.</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-background px-3 py-1.5 text-sm font-medium text-foreground"><CreditCard className="size-3.5" /> Yönet</span>
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Ödeme dağılımı</h3>
          {d && d.status.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {d.status.map(([k, v]) => (
                <li key={k} className="flex justify-between"><span>{PAY_LABEL[k] ?? k}</span><span className="font-semibold tabular-nums">{v}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{cur.isLoading ? "Yükleniyor…" : "Seçili dönemde ödeme kaydı yok."}</p>
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Sepet & dönüşüm</h3>
          <dl className="mt-3 divide-y text-sm">
            <div className="flex justify-between py-2"><dt>Sepete ekleme oranı</dt><dd className="font-semibold tabular-nums">{d ? pct(d.cartRate) : "…"}</dd></div>
            <div className="flex justify-between py-2"><dt>Dönüşüm oranı</dt><dd className="font-semibold tabular-nums">{d ? pct(d.conversion) : "…"}</dd></div>
            <div className="flex justify-between py-2"><dt>Terk edilmiş sepet</dt><dd className="font-semibold tabular-nums">{d ? d.abandoned : "…"}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Uygulama mağazası</h3>
          <p className="mt-1 text-sm text-muted-foreground">Mağazanı uygulamalarla büyüt.</p>
          <div className="mt-3 flex gap-2 text-primary"><LayoutGrid className="size-8" /><Package className="size-8" /><Sparkles className="size-8" /></div>
          <Link to="/store/$storeId/apps" params={s} className="mt-4 inline-block rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background">Uygulama mağazasına git</Link>
        </div>
      </section>
    </div>
  );
}
