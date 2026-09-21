import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CheckCircle2, ChevronRight, CircleDollarSign, FileText, PackagePlus, Search, ShoppingBasket, SlidersHorizontal, Store, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/mefti";
import { supplierDeskApproveRfq, supplierDeskCreateRfq, supplierDeskPublishProducts } from "@/lib/supplier-desk.functions";

export type CatalogProduct = {
  id: string; title: string; sku: string | null; barcode: string | null; category: string | null; brand: string | null;
  supplierPrice: number; salePrice: number; stock: number; currency: string; images: string[]; description: string | null;
  color: string | null; size: string | null; isPublished: boolean; updatedAt: string;
};

export type SupplierRfq = {
  id: string; reference: string; companyName: string; currency: string; total: number; status: string;
  validUntil: string | null; purchaseOrderId: string | null;
  items: Array<{ supplierProductId?: string; title: string; sku?: string; quantity: number; unitPrice: number }>;
  createdAt: string;
};

type Credit = { companyName: string; currency: string; creditLimit: number; balance: number; termDays: number; status: string } | null;
type Movement = { id: string; kind: string; quantity: number; stock_before: number; stock_after: number; reason: string | null; created_at: string };

function Empty({ text }: { text: string }) {
  return <div className="border-y bg-card px-4 py-12 text-center text-sm text-muted-foreground">{text}</div>;
}

export function SupplierCatalog({ supplierId, products, onChanged }: { supplierId: string; products: CatalogProduct[]; onChanged: () => void }) {
  const publish = useServerFn(supplierDeskPublishProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<CatalogProduct | null>(null);
  const categories = useMemo(() => Array.from(new Set(products.map((row) => row.category).filter(Boolean) as string[])).sort(), [products]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr");
    const rows = products.filter((row) => (!term || `${row.title} ${row.sku ?? ""} ${row.barcode ?? ""}`.toLocaleLowerCase("tr").includes(term)) && (category === "all" || row.category === category));
    return [...rows].sort((a, b) => sort === "price" ? a.salePrice - b.salePrice : sort === "stock" ? b.stock - a.stock : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [products, query, category, sort]);
  const action = useMutation({
    mutationFn: (ids: string[]) => publish({ data: { supplierId, productIds: ids } }),
    onSuccess: (result) => { toast.success(`${result.processed} ürün mağazaya aktarıldı`); setSelected([]); onChanged(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="space-y-4">
    <section className="border-y bg-card p-4 sm:rounded-lg sm:border">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0"><h2 className="font-semibold">Ürünlerim</h2><p className="truncate text-xs text-muted-foreground">{products.length} ürün · {products.filter((row) => row.isPublished).length} mağazada</p></div>
        <Badge className="shrink-0" variant="outline"><Store className="mr-1 size-3" /> Canlı</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_12rem_10rem]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Ürün, stok kodu veya barkod ara" /></div>
        <select aria-label="Kategori" className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tüm kategoriler</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Sıralama" className="h-9 rounded-md border bg-background px-3 text-sm" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">En güncel</option><option value="price">Fiyata göre</option><option value="stock">Stoğa göre</option></select>
      </div>
    </section>

    {selected.length ? <div className="sticky top-16 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y bg-card p-3 shadow-sm sm:rounded-lg sm:border"><span className="min-w-0 truncate text-sm font-medium">{selected.length} ürün seçildi</span><Button className="shrink-0 bg-supplier-brand px-3 text-supplier-brand-foreground hover:bg-supplier-brand/90" disabled={action.isPending} onClick={() => action.mutate(selected)}><PackagePlus /> Aktar</Button></div> : null}

    {!visible.length ? <Empty text="Aramanıza uygun ürün bulunamadı." /> : <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((product) => <article key={product.id} className={`relative overflow-hidden rounded-lg border bg-card ${selected.includes(product.id) ? "ring-2 ring-supplier-brand" : ""}`}>
        <Button type="button" variant="outline" size="icon" aria-label={`${product.title} seç`} className="absolute left-2 top-2 z-10 size-9 rounded-full bg-card shadow" onClick={() => toggle(product.id)}>{selected.includes(product.id) ? <CheckCircle2 className="size-5 text-supplier-brand" /> : <span className="size-3 rounded-full border" />}</Button>
        <button type="button" className="grid w-full grid-cols-[7rem_minmax(0,1fr)] text-left min-[430px]:block" onClick={() => setDetail(product)}>
          <div className="aspect-square bg-muted/30">{product.images[0] ? <SmartImage src={product.images[0]} alt={product.title} width={360} height={360} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ShoppingBasket className="size-10 text-muted-foreground/40" /></div>}</div>
          <div className="space-y-2 p-3"><div className="flex items-start justify-between gap-2"><h3 className="line-clamp-2 min-h-10 text-sm font-medium">{product.title}</h3><ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></div><p className="text-base font-semibold">{formatMoney(product.salePrice, product.currency)}</p><div className="flex items-center justify-between text-xs"><span className={product.stock > 0 ? "text-success" : "text-destructive"}>{product.stock > 0 ? `${product.stock} stok` : "Tükendi"}</span><Badge variant={product.isPublished ? "secondary" : "outline"}>{product.isPublished ? "Mağazada" : "Taslak"}</Badge></div></div>
        </button>
      </article>)}
    </div>}

    <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}><DialogContent className="h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-lg"><DialogHeader className="sr-only"><DialogTitle>{detail?.title}</DialogTitle><DialogDescription>Ürün ayrıntısı</DialogDescription></DialogHeader>{detail ? <><div className="aspect-[4/3] bg-muted/30">{detail.images[0] ? <SmartImage src={detail.images[0]} alt={detail.title} width={720} height={540} className="h-full w-full object-contain" /> : null}</div><div className="space-y-4 p-4 sm:p-5"><div><Badge variant="outline">{detail.category ?? "Kategorisiz"}</Badge><h2 className="mt-2 text-xl font-semibold">{detail.title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail.brand ?? "—"} · {detail.sku ?? "SKU yok"}</p></div><div className="grid grid-cols-2 gap-3 border-y py-4"><div><p className="text-xs text-muted-foreground">Tedarikçi fiyatı</p><p className="font-medium">{formatMoney(detail.supplierPrice, detail.currency)}</p></div><div><p className="text-xs text-muted-foreground">Mağaza satış fiyatı</p><p className="font-semibold text-success">{formatMoney(detail.salePrice, detail.currency)}</p></div></div><div className="grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Stok</p><p>{detail.stock}</p></div><div><p className="text-xs text-muted-foreground">Renk</p><p>{detail.color ?? "—"}</p></div><div><p className="text-xs text-muted-foreground">Beden</p><p>{detail.size ?? "—"}</p></div></div>{detail.description ? <p className="text-sm leading-6 text-muted-foreground">{detail.description}</p> : null}</div><DialogFooter className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-card p-3 sm:p-4"><Button className="h-auto min-h-10 whitespace-normal px-2 text-xs sm:text-sm" variant="outline" onClick={() => { toggle(detail.id); setDetail(null); }}><ShoppingBasket /> Teklife ekle</Button><Button className="h-auto min-h-10 whitespace-normal bg-supplier-brand px-2 text-xs text-supplier-brand-foreground hover:bg-supplier-brand/90 sm:text-sm" disabled={detail.isPublished || action.isPending} onClick={() => action.mutate([detail.id])}><Store /> {detail.isPublished ? "Mağazada" : "Mağazama aktar"}</Button></DialogFooter></> : null}</DialogContent></Dialog>
  </div>;
}

const RFQ_LABELS: Record<string, string> = { new: "Yeni", quoted: "Teklif verildi", won: "Siparişe dönüştü", lost: "Kaybedildi" };

export function SupplierCommercialDesk({ supplierId, products, rfqs, credit, transactions, onChanged }: { supplierId: string; products: CatalogProduct[]; rfqs: SupplierRfq[]; credit: Credit; transactions: any[]; onChanged: () => void }) {
  const createRfq = useServerFn(supplierDeskCreateRfq);
  const approveRfq = useServerFn(supplierDeskApproveRfq);
  const [company, setCompany] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("10");
  const create = useMutation({ mutationFn: () => createRfq({ data: { supplierId, companyName: company, validDays: 30, items: [{ supplierProductId: productId, quantity: Number(quantity) }] } }), onSuccess: (result) => { toast.success(`${result.reference} oluşturuldu`); setCompany(""); onChanged(); }, onError: (error: Error) => toast.error(error.message) });
  const approve = useMutation({ mutationFn: (rfqId: string) => approveRfq({ data: { supplierId, rfqId } }), onSuccess: () => { toast.success("Teklif onaylandı ve sipariş oluşturuldu"); onChanged(); }, onError: (error: Error) => toast.error(error.message) });

  return <section className="space-y-4 border-y bg-card p-4 sm:rounded-lg sm:border sm:p-5">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><div className="min-w-0"><h2 className="font-semibold">B2B Cari Hesap & RFQ</h2><p className="text-xs text-muted-foreground">Tekliften satın alma siparişine gerçek akış</p></div><FileText className="size-5 shrink-0 text-supplier-brand" /></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><SmallMetric label="Kredi limiti" value={formatMoney(credit?.creditLimit ?? 0, credit?.currency ?? "TRY")} /><SmallMetric label="Kullanılan" value={formatMoney(credit?.balance ?? 0, credit?.currency ?? "TRY")} /><SmallMetric label="Vade" value={`${credit?.termDays ?? 0} gün`} /><SmallMetric label="Hareket" value={String(transactions.length)} /></div>
    <div className="grid gap-3 border-y py-4 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end"><div><Label>Firma</Label><Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Firma unvanı" /></div><div><Label>Ürün</Label><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}>{products.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></div><div><Label>Adet</Label><Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><Button className="w-full sm:w-auto" disabled={company.trim().length < 2 || !productId || Number(quantity) < 1 || create.isPending} onClick={() => create.mutate()}><FileText /> Teklif ver</Button></div>
    {!rfqs.length ? <p className="py-4 text-center text-sm text-muted-foreground">Henüz teklif bulunmuyor.</p> : <div className="space-y-2">{rfqs.map((rfq) => <div key={rfq.id} className="flex flex-col gap-3 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{rfq.reference} · {rfq.companyName}</p><p className="text-xs text-muted-foreground">{rfq.items.length} kalem · {rfq.validUntil ? `${formatDate(rfq.validUntil)} tarihine kadar` : "Vade yok"}</p></div><div className="flex items-center justify-between gap-3"><div className="text-right"><p className="font-semibold">{formatMoney(rfq.total, rfq.currency)}</p><Badge variant="outline">{RFQ_LABELS[rfq.status] ?? rfq.status}</Badge></div>{rfq.status === "quoted" && !rfq.purchaseOrderId ? <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(rfq.id)}>Onayla & Sipariş</Button> : rfq.purchaseOrderId ? <CheckCircle2 className="size-5 text-success" /> : null}</div></div>)}</div>}
  </section>;
}

function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-l-2 border-supplier-brand bg-muted/20 p-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>; }

export function SupplierChanges({ movements, returnCount, cancelledCount, supplierId, feedPanel }: { movements: Movement[]; returnCount: number; cancelledCount: number; supplierId: string; feedPanel: React.ReactNode }) {
  return <Tabs defaultValue="returns" className="min-w-0 space-y-4"><TabsList className="grid h-auto w-full grid-cols-2"><TabsTrigger className="min-w-0 whitespace-normal py-2" value="returns">İade & Değişim</TabsTrigger><TabsTrigger className="min-w-0 whitespace-normal py-2" value="movements">Stok & Fiyat</TabsTrigger></TabsList><TabsContent value="returns" className="space-y-3"><div className="grid grid-cols-2 gap-2"><SmallMetric label="İade" value={String(returnCount)} /><SmallMetric label="İptal" value={String(cancelledCount)} /></div><Empty text="Siparişe bağlı yeni iade veya değişim talebi bulunmuyor." /></TabsContent><TabsContent value="movements" className="min-w-0 space-y-3">{movements.length ? movements.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card p-3"><div className="flex min-w-0 items-center gap-3"><Warehouse className="size-5 shrink-0 text-supplier-brand" /><div className="min-w-0"><p className="truncate text-sm font-medium">{row.reason ?? row.kind}</p><p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p></div></div><div className="shrink-0 text-right"><p className="font-semibold">{row.stock_before} → {row.stock_after}</p><p className="text-xs text-muted-foreground">{row.quantity > 0 ? "+" : ""}{row.quantity} adet</p></div></div>) : <Empty text="Henüz stok veya fiyat hareketi yok." />}{feedPanel}</TabsContent></Tabs>;
}

export function SupplierAnalytics({ orders, currency }: { orders: Array<{ orderCreatedAt: string; itemsTotal: number; netTotal: number; commissionTotal: number; items: Array<{ quantity: number; title: string }> }>; currency: string }) {
  const [period, setPeriod] = useState("daily");
  const [metric, setMetric] = useState("revenue");
  const points = useMemo(() => {
    const grouped = new Map<string, { label: string; revenue: number; quantity: number; commission: number }>();
    for (const order of orders) { const date = new Date(order.orderCreatedAt); const key = period === "yearly" ? String(date.getFullYear()) : period === "monthly" ? `${date.getFullYear()}-${date.getMonth() + 1}` : period === "hourly" ? `${date.toISOString().slice(0, 10)} ${date.getHours()}:00` : date.toISOString().slice(0, 10); const row = grouped.get(key) ?? { label: key, revenue: 0, quantity: 0, commission: 0 }; row.revenue += order.itemsTotal; row.commission += order.commissionTotal; row.quantity += order.items.reduce((sum, item) => sum + item.quantity, 0); grouped.set(key, row); }
    return Array.from(grouped.values()).slice(-24);
  }, [orders, period]);
  const topProducts = useMemo(() => { const map = new Map<string, number>(); orders.flatMap((order) => order.items).forEach((item) => map.set(item.title, (map.get(item.title) ?? 0) + item.quantity)); return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5); }, [orders]);
  const revenue = orders.reduce((sum, row) => sum + row.itemsTotal, 0); const quantity = orders.flatMap((row) => row.items).reduce((sum, row) => sum + row.quantity, 0); const commission = orders.reduce((sum, row) => sum + row.commissionTotal, 0);
  const periods: Array<[string, string]> = [["hourly", "Saatlik"], ["daily", "Günlük"], ["monthly", "Aylık"], ["yearly", "Yıllık"]];
  return <div className="min-w-0 space-y-4"><div className="grid grid-cols-4 gap-1 bg-card p-1">{periods.map(([value, label]) => <Button className="min-w-0 px-1 text-xs" key={value} size="sm" variant={period === value ? "default" : "ghost"} onClick={() => setPeriod(value)}>{label}</Button>)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><SmallMetric label="Adet" value={String(quantity)} /><SmallMetric label="Ciro" value={formatMoney(revenue, currency)} /><SmallMetric label="R/C" value={commission ? (revenue / commission).toFixed(1) : "—"} /></div><section className="min-w-0 border-y bg-card p-3 sm:rounded-lg sm:border sm:p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><h2 className="truncate font-semibold">Satış grafiği</h2><select className="h-8 shrink-0 rounded-md border bg-background px-2 text-xs" value={metric} onChange={(event) => setMetric(event.target.value)}><option value="quantity">Adet</option><option value="revenue">Ciro</option><option value="commission">Komisyon</option></select></div>{points.length ? <ChartContainer className="mt-4 h-64 w-full min-w-0 aspect-auto" config={{ value: { label: metric, color: "var(--supplier-brand)" } }}><AreaChart data={points}><defs><linearGradient id="supplierArea" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35}/><stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} width={32}/><ChartTooltip content={<ChartTooltipContent />}/><Area type="monotone" dataKey={metric} stroke="var(--color-value)" fill="url(#supplierArea)" strokeWidth={2}/></AreaChart></ChartContainer> : <Empty text="Grafik için tamamlanmış sipariş verisi bekleniyor." />}</section><section className="border-y bg-card p-4 sm:rounded-lg sm:border"><h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="size-4 text-supplier-brand" /> Çok satanlar</h2>{topProducts.length ? <div className="mt-3 space-y-3">{topProducts.map(([name, count], index) => <div key={name} className="flex min-w-0 items-center gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm">{name}</span><strong className="shrink-0 text-sm">{count} adet</strong></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Henüz satılan ürün yok.</p>}</section><div className="grid grid-cols-2 gap-2"><SmallMetric label="Reklam" value={formatMoney(0, currency)} /><SmallMetric label="Sipariş ort." value={formatMoney(orders.length ? revenue / orders.length : 0, currency)} /><SmallMetric label="Net kazanç" value={formatMoney(orders.reduce((sum, row) => sum + row.netTotal, 0), currency)} /><SmallMetric label="Komisyon" value={formatMoney(commission, currency)} /></div></div>;
}