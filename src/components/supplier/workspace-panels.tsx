import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  PackagePlus,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Store,
  Warehouse,
} from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";

import { supplierCatalogQuery, type SupplierCatalogFilter } from "@/lib/supplier-catalog-query";
import { SupplierCatalogActions } from "./catalog-actions";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/mefti";
import { htmlToText } from "@/lib/blog-content";
import { supplierDeskApproveRfq, supplierDeskCreateRfq } from "@/lib/supplier-desk.functions";
import { supplierSearchCatalog, supplierSetSalePrice } from "@/lib/supplier-workflow.functions";

export type CatalogProduct = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  brand: string | null;
  supplierPrice: number;
  configuredSalePrice?: number | null;
  suggestedPrice?: number | null;
  catalogVisible?: boolean;
  salePrice: number;
  stock: number;
  currency: string;
  images: string[];
  description: string | null;
  color: string | null;
  size: string | null;
  isPublished: boolean;
  updatedAt: string;
  sourceStock?: number;
  warehouseReserved?: number | null;
  warehouseOnHand?: number | null;
  warehouseUpdatedAt?: string | null;
  storeStock?: number | null;
  sourceUpdatedAt?: string;
  storeUpdatedAt?: string | null;
};

export type SupplierRfq = {
  id: string;
  reference: string;
  companyName: string;
  currency: string;
  total: number;
  status: string;
  validUntil: string | null;
  purchaseOrderId: string | null;
  items: Array<{
    supplierProductId?: string;
    title: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
  }>;
  createdAt: string;
};

type Credit = {
  companyName: string;
  currency: string;
  creditLimit: number;
  balance: number;
  termDays: number;
  status: string;
} | null;
type Movement = {
  id: string;
  kind: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  created_at: string;
};

function Empty({ text }: { text: string }) {
  return (
    <div className="border-y bg-card px-4 py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function SalePriceEditor({
  supplierId,
  product,
  onSaved,
}: {
  supplierId: string;
  product: CatalogProduct;
  onSaved?: (() => void) | undefined;
}) {
  const save = useServerFn(supplierSetSalePrice);
  const [value, setValue] = useState(String(product.salePrice || ""));
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: { supplierId, productId: product.id, salePrice: Number(value.replace(",", ".")) },
      }),
    onSuccess: () => {
      toast.success("Mağaza satış fiyatı kaydedildi");
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const parsed = Number(value.replace(",", "."));
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="sale-price" className="text-xs">
          Mağaza satış fiyatı ({product.currency})
        </Label>
        <Input
          id="sale-price"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending || !Number.isFinite(parsed) || parsed < 0}>
        Kaydet
      </Button>
    </form>
  );
}

export function SupplierCatalog({
  products,
  supplierId,
  onChanged,
}: {
  products: CatalogProduct[];
  supplierId?: string | undefined;
  onChanged?: (() => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"recent" | "price" | "stock">("recent");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<SupplierCatalogFilter>("all");
  const searchCatalog = useServerFn(supplierSearchCatalog);
  const catalog = useQuery(
    supplierCatalogQuery(searchCatalog, {
      supplierId: supplierId ?? "",
      search: query,
      page,
      category,
      sort,
      filter,
    }),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<CatalogProduct | null>(null);
  const visible = supplierId ? (catalog.data?.products ?? []) : products;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  const pagination = (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="outline"
        disabled={page === 0 || catalog.isFetching}
        onClick={() => setPage((p) => p - 1)}
      >
        Önceki
      </Button>
      <span className="text-sm">
        Sayfa {page + 1} / {Math.max(1, Math.ceil((catalog.data?.total ?? 0) / 25))}
      </span>
      <Button
        variant="outline"
        disabled={catalog.isFetching || (page + 1) * 25 >= (catalog.data?.total ?? 0)}
        onClick={() => setPage((p) => p + 1)}
      >
        Sonraki
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="border-y bg-card p-4 sm:rounded-lg sm:border">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Ürün çalışma alanı</h2>
            <p className="truncate text-xs text-muted-foreground">
              {supplierId
                ? catalog.data
                  ? `${catalog.data.total} ürün`
                  : "Ürün sayısı bekleniyor"
                : `${products.length} ürün`}{" "}
              · Sayfa {page + 1}
            </p>
          </div>
          <Badge className="shrink-0" variant="outline">
            <Store className="mr-1 size-3" /> Canlı
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className="pl-9"
              placeholder="Ürün, stok kodu veya barkod ara"
              aria-label="Tam katalogda ara"
            />
          </div>
          <Input
            aria-label="Kategori"
            placeholder="Kategori ara"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Sıralama"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as typeof sort);
              setPage(0);
            }}
          >
            <option value="recent">En güncel</option>
            <option value="price">Fiyata göre</option>
            <option value="stock">Stoğa göre</option>
          </select>
          <select
            aria-label="Katalog görünürlüğü"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as SupplierCatalogFilter);
              setPage(0);
            }}
          >
            <option value="all">Tümü</option>
            <option value="visible">Katalogda görünen</option>
            <option value="hidden">Gizli</option>
            <option value="out">Stoksuz</option>
          </select>
        </div>
      </section>
      {supplierId ? (
        <SupplierCatalogActions
          supplierId={supplierId}
          selected={selected}
          product={
            selected.length === 1 ? (visible.find((p) => p.id === selected[0]) ?? null) : null
          }
          clear={() => setSelected([])}
          onChanged={() => {
            onChanged?.();
            void catalog.refetch();
          }}
        />
      ) : null}
      {supplierId ? pagination : null}

      {selected.length ? (
        <div className="sticky top-16 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-y bg-card p-3 shadow-sm sm:rounded-lg sm:border">
          <span className="min-w-0 truncate text-sm font-medium">
            {selected.length} ürün seçildi
          </span>
          <Button className="shrink-0" variant="outline" onClick={() => setSelected([])}>
            Seçimi temizle
          </Button>
        </div>
      ) : null}

      {catalog.isError ? (
        <div role="alert">
          <p>{catalog.error.message}</p>
          <Button variant="outline" onClick={() => void catalog.refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : catalog.isFetching ? (
        <Empty text="Katalog yükleniyor…" />
      ) : !visible.length ? (
        <Empty text="Aramanıza uygun ürün bulunamadı." />
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <article
              key={product.id}
              className={`relative overflow-hidden rounded-lg border bg-card ${selected.includes(product.id) ? "ring-2 ring-supplier-brand" : ""}`}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`${product.title} seç`}
                className="absolute left-2 top-2 z-10 size-9 rounded-full bg-card shadow"
                onClick={() => toggle(product.id)}
              >
                {selected.includes(product.id) ? (
                  <CheckCircle2 className="size-5 text-supplier-brand" />
                ) : (
                  <span className="size-3 rounded-full border" />
                )}
              </Button>
              <button
                type="button"
                className="grid w-full grid-cols-[7rem_minmax(0,1fr)] text-left min-[430px]:block"
                onClick={() => setDetail(product)}
              >
                <div className="aspect-square bg-muted/30">
                  {product.images[0] ? (
                    <SmartImage
                      src={product.images[0]}
                      fallbackSrcs={product.images.slice(1)}
                      alt={product.title}
                      width={360}
                      height={360}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <ShoppingBasket className="size-10 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-medium">{product.title}</h3>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold">
                    {formatMoney(product.salePrice, product.currency)}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className={product.stock > 0 ? "text-success" : "text-destructive"}>
                      {product.stock > 0 ? `${product.stock} kaynak stok` : "Tükendi"}
                    </span>
                    <Badge variant={product.isPublished ? "secondary" : "outline"}>
                      {product.isPublished ? "Mağazada" : "Taslak"}
                    </Badge>
                  </div>
                </div>
              </button>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>Ürün ayrıntısı</DialogDescription>
          </DialogHeader>
          {detail ? (
            <>
              <div className="aspect-[4/3] bg-muted/30">
                {detail.images[0] ? (
                  <SmartImage
                    src={detail.images[0]}
                    fallbackSrcs={detail.images.slice(1)}
                    alt={detail.title}
                    width={720}
                    height={540}
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <div>
                  <Badge variant="outline">{detail.category ?? "Kategorisiz"}</Badge>
                  <h2 className="mt-2 text-xl font-semibold">{detail.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detail.brand ?? "—"} · {detail.sku ?? "SKU yok"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 border-y py-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tedarikçi fiyatı</p>
                    <p className="font-medium">
                      {formatMoney(detail.supplierPrice, detail.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mağaza satış fiyatı</p>
                    <p className="font-semibold text-success">
                      {formatMoney(detail.salePrice, detail.currency)}
                    </p>
                  </div>
                </div>
                {supplierId ? (
                  <SalePriceEditor
                    key={detail.id}
                    supplierId={supplierId}
                    product={detail}
                    onSaved={() => {
                      onChanged?.();
                      void catalog.refetch();
                    }}
                  />
                ) : null}
                {detail.images.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {detail.images.map((src, i) => (
                      <SmartImage
                        key={src}
                        src={src}
                        alt={`${detail.title} ${i + 1}`}
                        width={96}
                        height={96}
                        className="size-20 shrink-0 rounded-md border object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Stok</p>
                    <p>{detail.sourceStock ?? detail.stock}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Kaynak stok</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bağlı mağaza stoku</p>
                    <p>{detail.storeStock ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Depoda ayrılan</p>
                    <p>{detail.warehouseReserved ?? "Depo kaydı yok"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Depodaki toplam</p>
                    <p>{detail.warehouseOnHand ?? "Depo kaydı yok"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Renk</p>
                    <p>{detail.color ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Beden</p>
                    <p>{detail.size ?? "—"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Katalog tedarikçi kaynak stokunu, vitrin ve sipariş mağaza varyant stokunu
                  kullanır. Sipariş rezervasyonu varyant stokundan düşer. Depo rezervasyonu ayrı
                  kaynaktır; ikinci kez düşülmez. Eşitleme kapalıysa stoklar farklı kalabilir.
                </p>
                <p className="text-xs text-muted-foreground">
                  Depo güncellemesi:{" "}
                  {detail.warehouseUpdatedAt ? formatDate(detail.warehouseUpdatedAt) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Kaynak güncellemesi:{" "}
                  {detail.sourceUpdatedAt ? formatDate(detail.sourceUpdatedAt) : "—"} · Mağaza
                  güncellemesi: {detail.storeUpdatedAt ? formatDate(detail.storeUpdatedAt) : "—"}.
                  Mağaza stoku satış ve stok eşitleme zamanına göre farklı olabilir.
                </p>
                {detail.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {htmlToText(detail.description)}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="sticky bottom-0 border-t bg-card p-3 sm:p-4">
                <Button
                  className="h-auto min-h-10 w-full whitespace-normal px-2 text-xs sm:text-sm"
                  variant="outline"
                  onClick={() => {
                    toggle(detail.id);
                    setDetail(null);
                  }}
                >
                  <ShoppingBasket /> Teklife ekle
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RFQ_LABELS: Record<string, string> = {
  new: "Yeni",
  quoted: "Teklif verildi",
  won: "Siparişe dönüştü",
  lost: "Kaybedildi",
};

export function SupplierCommercialDesk({
  supplierId,
  products,
  rfqs,
  credit,
  transactions,
  onChanged,
}: {
  supplierId: string;
  products: CatalogProduct[];
  rfqs: SupplierRfq[];
  credit: Credit;
  transactions: any[];
  onChanged: () => void;
}) {
  const createRfq = useServerFn(supplierDeskCreateRfq);
  const approveRfq = useServerFn(supplierDeskApproveRfq);
  const [company, setCompany] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(0);
  const searchCatalog = useServerFn(supplierSearchCatalog);
  const optionsQuery = useQuery(
    supplierCatalogQuery(searchCatalog, { supplierId, search: productSearch, page: productPage }),
  );
  const productOptions = optionsQuery.data?.products ?? [];
  const [quantity, setQuantity] = useState("10");
  const create = useMutation({
    mutationFn: () =>
      createRfq({
        data: {
          supplierId,
          companyName: company,
          validDays: 30,
          items: [{ supplierProductId: productId, quantity: Number(quantity) }],
        },
      }),
    onSuccess: (result) => {
      toast.success(`${result.reference} oluşturuldu`);
      setCompany("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const approve = useMutation({
    mutationFn: (rfqId: string) => approveRfq({ data: { supplierId, rfqId } }),
    onSuccess: () => {
      toast.success("Teklif onaylandı ve sipariş oluşturuldu");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="space-y-4 border-y bg-card p-4 sm:rounded-lg sm:border sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">B2B Cari Hesap & RFQ</h2>
          <p className="text-xs text-muted-foreground">
            Tekliften satın alma siparişine gerçek akış
          </p>
        </div>
        <FileText className="size-5 shrink-0 text-supplier-brand" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SmallMetric
          label="Kredi limiti"
          value={formatMoney(credit?.creditLimit ?? 0, credit?.currency ?? "TRY")}
        />
        <SmallMetric
          label="Kullanılan"
          value={formatMoney(credit?.balance ?? 0, credit?.currency ?? "TRY")}
        />
        <SmallMetric label="Vade" value={`${credit?.termDays ?? 0} gün`} />
        <SmallMetric label="Hareket" value={String(transactions.length)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="RFQ ürün araması"
          placeholder="Stok kodu veya ürün ara"
          value={productSearch}
          onChange={(e) => {
            setProductSearch(e.target.value);
            setProductPage(0);
          }}
        />
        <Button
          variant="outline"
          disabled={productPage === 0 || optionsQuery.isFetching}
          onClick={() => setProductPage((p) => p - 1)}
        >
          Önceki
        </Button>
        <span>{productPage + 1}</span>
        <Button
          variant="outline"
          disabled={
            optionsQuery.isFetching || (productPage + 1) * 25 >= (optionsQuery.data?.total ?? 0)
          }
          onClick={() => setProductPage((p) => p + 1)}
        >
          Sonraki
        </Button>
        {optionsQuery.isError ? <p role="alert">{optionsQuery.error.message}</p> : null}
      </div>
      <div className="grid gap-3 border-y py-4 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
        <div>
          <Label>Firma</Label>
          <Input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Firma unvanı"
          />
        </div>
        <div>
          <Label>Ürün</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Ürün seç</option>
            {productId && !productOptions.some((row) => row.id === productId) ? (
              <option value={productId}>
                {products.find((row) => row.id === productId)?.title ?? productId}
              </option>
            ) : null}
            {productOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title} {row.sku}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Adet</Label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={
            company.trim().length < 2 || !productId || Number(quantity) < 1 || create.isPending
          }
          onClick={() => create.mutate()}
        >
          <FileText /> Teklif ver
        </Button>
      </div>
      {!rfqs.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Henüz teklif bulunmuyor.</p>
      ) : (
        <div className="space-y-2">
          {rfqs.map((rfq) => (
            <div
              key={rfq.id}
              className="flex flex-col gap-3 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {rfq.reference} · {rfq.companyName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rfq.items.length} kalem ·{" "}
                  {rfq.validUntil ? `${formatDate(rfq.validUntil)} tarihine kadar` : "Vade yok"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(rfq.total, rfq.currency)}</p>
                  <Badge variant="outline">{RFQ_LABELS[rfq.status] ?? rfq.status}</Badge>
                </div>
                {rfq.status === "quoted" && !rfq.purchaseOrderId ? (
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(rfq.id)}
                  >
                    Onayla & Sipariş
                  </Button>
                ) : rfq.purchaseOrderId ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-supplier-brand bg-muted/20 p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

export function SupplierChanges({
  movements,
  returnCount,
  cancelledCount,
}: {
  movements: Movement[];
  returnCount: number;
  cancelledCount: number;
}) {
  return (
    <Tabs defaultValue="returns" className="min-w-0 space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger className="min-w-0 whitespace-normal py-2" value="returns">
          İade & Değişim
        </TabsTrigger>
        <TabsTrigger className="min-w-0 whitespace-normal py-2" value="movements">
          Stok & Fiyat
        </TabsTrigger>
      </TabsList>
      <TabsContent value="returns" className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <SmallMetric label="İade" value={String(returnCount)} />
          <SmallMetric label="İptal" value={String(cancelledCount)} />
        </div>
        <Empty text="Siparişe bağlı yeni iade veya değişim talebi bulunmuyor." />
      </TabsContent>
      <TabsContent value="movements" className="min-w-0 space-y-3">
        {movements.length ? (
          movements.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Warehouse className="size-5 shrink-0 text-supplier-brand" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.reason ?? row.kind}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">
                  {row.stock_before} → {row.stock_after}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.quantity > 0 ? "+" : ""}
                  {row.quantity} adet
                </p>
              </div>
            </div>
          ))
        ) : (
          <Empty text="Henüz stok veya fiyat hareketi yok." />
        )}
      </TabsContent>
    </Tabs>
  );
}


const LazySupplierAnalytics = lazy(() => import("./analytics-panel"));
export function SupplierAnalytics(props: React.ComponentProps<typeof LazySupplierAnalytics>) {
  return <Suspense fallback={<p role="status" className="p-6 text-sm">Analiz yükleniyor…</p>}><LazySupplierAnalytics {...props} /></Suspense>;
}
