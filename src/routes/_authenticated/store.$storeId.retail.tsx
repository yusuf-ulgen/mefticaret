import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, CreditCard, Landmark, Minus, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { createManualOrderFn } from "@/lib/sales.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/retail")({
  head: () => ({
    meta: [
      { title: "Perakende Satış — Mefticaret" },
      { name: "description", content: "Mağaza kasasından hızlı satış yap; stok ve raporlar otomatik güncellensin." },
      { property: "og:title", content: "Perakende Satış — Mefticaret" },
      { property: "og:description", content: "Mağaza kasası: ürün ara, sepete ekle, nakit veya kartla satışı kaydet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetailPage,
});

type Method = "cash" | "card" | "transfer";
const METHODS: { id: Method; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Nakit", icon: Banknote },
  { id: "card", label: "Kart", icon: CreditCard },
  { id: "transfer", label: "Havale", icon: Landmark },
];

function RetailPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Perakende Satış" description="Mağaza kasasından yapılan satışlar; stok ve raporlara otomatik işlenir.">
      <div className="p-4 sm:p-6">
        <Tabs defaultValue="pos">
          <TabsList>
            <TabsTrigger value="pos">Kasa</TabsTrigger>
            <TabsTrigger value="sales">Perakende Satışlar</TabsTrigger>
          </TabsList>
          <TabsContent value="pos"><PosRegister storeId={storeId} /></TabsContent>
          <TabsContent value="sales"><RetailSales storeId={storeId} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function PosRegister({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createManualOrderFn);
  const [term, setTerm] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<Method>("cash");
  const [discount, setDiscount] = useState("0");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: products } = useQuery({
    queryKey: ["pos-variants", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, currency, base_price, product_variants(id, title, price, stock, sku)")
        .eq("store_id", storeId)
        .eq("status", "active")
        .order("title")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const variants = useMemo(
    () =>
      (products ?? []).flatMap((p) =>
        (p.product_variants ?? []).map((v) => ({
          id: v.id,
          label: `${p.title}${v.title ? ` — ${v.title}` : ""}`,
          sku: v.sku ?? "",
          price: Number(v.price ?? p.base_price),
          stock: Number(v.stock ?? 0),
          currency: p.currency,
        })),
      ),
    [products],
  );
  const currency = variants[0]?.currency ?? "TRY";
  const shown = variants.filter((v) => {
    const t = term.trim().toLocaleLowerCase("tr");
    return !t || v.label.toLocaleLowerCase("tr").includes(t) || v.sku.toLocaleLowerCase("tr").includes(t);
  }).slice(0, 60);

  const lines = Object.entries(cart).map(([id, qty]) => ({ v: variants.find((x) => x.id === id), qty })).filter((l) => l.v);
  const subtotal = lines.reduce((s, l) => s + l.v!.price * l.qty, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const add = (id: string, d: number) =>
    setCart((c) => {
      const n = (c[id] ?? 0) + d;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const sell = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          storeId,
          source: "pos",
          posPaymentMethod: method,
          customer: { fullName: name.trim() || "Perakende Müşteri", phone: phone.trim() || null, email: null },
          items: lines.map((l) => ({ variantId: l.v!.id, quantity: l.qty })),
          discountTotal: Number(discount) || 0,
          shippingTotal: 0,
          paymentStatus: "paid",
          note: "Mağaza kasası satışı",
        },
      }),
    onSuccess: (r) => {
      toast.success(`Satış kaydedildi: ${r.orderNumber}`);
      setCart({}); setDiscount("0"); setName(""); setPhone("");
      void qc.invalidateQueries({ queryKey: ["pos-variants", storeId] });
      void qc.invalidateQueries({ queryKey: ["retail-sales", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Satış kaydedilemedi"),
  });

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="rounded-xl border bg-card p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ürün adı veya stok kodu ara" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        {variants.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Satışta olan ürün yok. Önce ürün ekleyip yayına alın.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => add(v.id, 1)}
                disabled={v.stock <= (cart[v.id] ?? 0)}
                className="min-h-24 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary disabled:opacity-50"
              >
                <div className="line-clamp-2 text-sm font-medium">{v.label}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(v.price, v.currency)}</div>
                <div className="text-xs text-muted-foreground">Stok: {v.stock}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Sepet</h2>
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Ürüne dokunarak sepete ekleyin.</p>}
        {lines.map(({ v, qty }) => (
          <div key={v!.id} className="flex items-center gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate">{v!.label}</div>
              <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(v!.price * qty, v!.currency)}</div>
            </div>
            <Button size="icon" variant="outline" className="size-8" aria-label="Azalt" onClick={() => add(v!.id, -1)}><Minus className="size-3" /></Button>
            <span className="w-6 text-center tabular-nums">{qty}</span>
            <Button size="icon" variant="outline" className="size-8" aria-label="Artır" disabled={qty >= v!.stock} onClick={() => add(v!.id, 1)}><Plus className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Kaldır" onClick={() => add(v!.id, -qty)}><Trash2 className="size-3" /></Button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <Input placeholder="Müşteri adı (isteğe bağlı)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Telefon (isteğe bağlı)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <label className="flex items-center justify-between gap-2 text-sm">
          İndirim
          <Input className="w-28 text-right" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <Button key={m.id} type="button" variant={method === m.id ? "default" : "outline"} onClick={() => setMethod(m.id)} aria-pressed={method === m.id}>
              <m.icon className="size-4" /> {m.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-3 text-lg font-semibold tabular-nums">
          <span>Toplam</span>
          <span>{formatMoney(total, currency)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Mağaza ayarlarınızda KDV fiyata dahil değilse kayıtta KDV ayrıca eklenir.</p>
        <Button size="lg" disabled={lines.length === 0 || sell.isPending} onClick={() => sell.mutate()}>
          {sell.isPending ? "Kaydediliyor…" : "Satışı tamamla"}
        </Button>
      </aside>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = { cash: "Nakit", card: "Kart", transfer: "Havale" };

function RetailSales({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["retail-sales", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_events")
        .select("meta, created_at, orders(id, order_number, grand_total, currency, customer_name)")
        .eq("store_id", storeId)
        .eq("kind", "created")
        .eq("meta->>source", "pos")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data ?? []) {
      const o = r.orders as { grand_total: number; currency: string } | null;
      if (o) m.set(o.currency, (m.get(o.currency) ?? 0) + Number(o.grand_total));
    }
    return [...m.entries()];
  }, [data]);

  if (isLoading) return <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>;
  if (!data?.length) return <p className="mt-4 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Henüz kasadan satış yapılmadı.</p>;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Satış adedi (son 200)</div><div className="text-2xl font-semibold tabular-nums">{data.length}</div></div>
        {totals.map(([cur, sum]) => (
          <div key={cur} className="rounded-xl border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Toplam ({cur})</div><div className="text-2xl font-semibold tabular-nums">{formatMoney(sum, cur)}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Fiş</th><th className="p-3">Tarih</th><th className="p-3">Müşteri</th><th className="p-3">Ödeme</th><th className="p-3 text-right">Tutar</th></tr></thead>
          <tbody>
            {data.map((r, i) => {
              const o = r.orders as { order_number: string; grand_total: number; currency: string; customer_name: string | null } | null;
              const meta = (r.meta ?? {}) as { pos_payment_method?: string };
              return (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium">{o?.order_number ?? "—"}</td>
                  <td className="p-3">{new Date(r.created_at).toLocaleString("tr-TR")}</td>
                  <td className="p-3">{o?.customer_name ?? "—"}</td>
                  <td className="p-3">{METHOD_LABEL[meta.pos_payment_method ?? ""] ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{o ? formatMoney(Number(o.grand_total), o.currency) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
