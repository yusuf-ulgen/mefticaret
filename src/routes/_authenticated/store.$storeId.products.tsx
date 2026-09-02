import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Package, Plus, Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { BulkProductActions } from "@/components/bulk-product-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { productsQuery } from "@/lib/catalog-queries";
import { createProduct } from "@/lib/catalog.functions";
import { PRODUCT_CSV_HEADERS, downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/products")({
  head: () => ({
    meta: [
      { title: "Ürünler — Mefticaret" },
      {
        name: "description",
        content: "Varyantlı ürün kataloğunu yönet: fiyat, stok, durum ve koleksiyonlar.",
      },
      { property: "og:title", content: "Ürünler — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret katalog yönetimi: ürün, varyant, stok ve fiyatlama.",
      },
    ],
  }),
  component: ProductsPage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  archived: "Arşiv",
};

function ProductsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products, isLoading } = useQuery(productsQuery(storeId));
  const create = useServerFn(createProduct);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [filter, setFilter] = useState<"all" | "draft" | "active" | "archived">("all");

  const currency = store?.currency ?? "TRY";

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeId,
          title,
          basePrice: Number(price || 0),
          stock: Number(stock || 0),
          status,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Ürün eklendi");
      setOpen(false);
      setTitle("");
      setPrice("");
      setStock("0");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    return (products ?? []).filter((product) => {
      if (filter !== "all" && product.status !== filter) return false;
      if (!term) return true;
      return (
        product.title.toLocaleLowerCase("tr").includes(term) ||
        (product.slug ?? "").toLocaleLowerCase("tr").includes(term)
      );
    });
  }, [products, filter, search]);

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  const exportCsv = () => {
    const source = selected.length > 0 ? rows.filter((r) => selected.includes(r.id)) : rows;
    const csv = toCsv(
      [...PRODUCT_CSV_HEADERS],
      source.map((product) => {
        const variants = product.product_variants ?? [];
        return [
          product.title,
          product.description ?? "",
          product.sku ?? "",
          product.vendor ?? "",
          product.product_type ?? "",
          Number(product.base_price),
          product.compare_at_price ?? "",
          variants.reduce((sum, v) => sum + (v.stock ?? 0), 0),
          product.status,
          (product.tags ?? []).join(","),
        ];
      }),
    );
    downloadCsv(`urunler-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <AppShell
      storeId={storeId}
      title="Ürünler"
      description="Varyant, stok ve fiyat yönetimi tek ekranda."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün ara…"
              className="w-52 pl-8"
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> CSV indir
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/store/$storeId/import-export" params={{ storeId }}>
              <Upload className="size-4" /> CSV yükle
            </Link>
          </Button>
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="archived">Arşiv</SelectItem>
            </SelectContent>
          </Select>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Yeni ürün
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-md overflow-y-auto p-6">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle>Yeni ürün</SheetTitle>
              </SheetHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Ürün adı</Label>
                  <Input
                    id="title"
                    required
                    minLength={2}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Örn. Merino Yün Triko"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Fiyat ({currency})</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Başlangıç stoğu</Label>
                    <Input
                      id="stock"
                      type="number"
                      min={0}
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as "draft")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Taslak</SelectItem>
                      <SelectItem value="active">Aktif (satışta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Kaydediliyor…" : "Ürünü oluştur"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      }
    >
      {selected.length > 0 ? (
        <BulkProductActions
          storeId={storeId}
          productIds={selected}
          currency={currency}
          onClear={() => setSelected([])}
        />
      ) : null}

      {/* Shopify tarzı özet şeridi */}
      <div className="surface-card grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
        {[
          { label: "Toplam ürün", value: formatNumber(products?.length ?? 0) },
          {
            label: "Aktif ürün",
            value: formatNumber((products ?? []).filter((p) => p.status === "active").length),
          },
          {
            label: "Varyant",
            value: formatNumber(
              (products ?? []).reduce((sum, p) => sum + (p.product_variants?.length ?? 0), 0),
            ),
          },
          {
            label: "Envanter değeri",
            value: formatMoney(
              (products ?? []).reduce(
                (sum, p) =>
                  sum +
                  (p.product_variants ?? []).reduce(
                    (inner, v) => inner + Number(v.price ?? p.base_price) * (v.stock ?? 0),
                    0,
                  ),
                0,
              ),
              currency,
            ),
          },
        ].map((metric) => (
          <div key={metric.label} className="px-4 py-3">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Durum sekmeleri */}
      <div className="surface-card flex flex-wrap gap-1 p-1.5">
        {(
          [
            ["all", "Tümü"],
            ["active", "Aktif"],
            ["draft", "Taslak"],
            ["archived", "Arşiv"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="surface-card overflow-hidden">
        {/* Mobil: kart listesi */}
        <ul className="divide-y divide-border md:hidden">
          {isLoading ? (
            <li className="px-4 py-8 text-center text-muted-foreground">Yükleniyor…</li>
          ) : rows.length === 0 ? (
            <li className="px-4 py-10 text-center">
              <Package className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Bu filtrede ürün yok</p>
            </li>
          ) : (
            rows.map((product) => {
              const variants = product.product_variants ?? [];
              const stockTotal = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
              const image = (product.product_images ?? [])
                .slice()
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
              return (
                <li key={product.id} className="flex gap-3 px-4 py-3">
                  <Checkbox
                    className="mt-1"
                    checked={selected.includes(product.id)}
                    onCheckedChange={(value) =>
                      setSelected((prev) =>
                        value === true ? [...prev, product.id] : prev.filter((id) => id !== product.id),
                      )
                    }
                    aria-label={`${product.title} seç`}
                  />
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {image ? (
                      <img src={image.url} alt="" className="size-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/store/$storeId/products/$productId"
                      params={{ storeId, productId: product.id }}
                      className="block truncate font-medium hover:underline"
                    >
                      {product.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {variants.length} varyasyon · {formatNumber(stockTotal)} adet stokta
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABELS[product.status] ?? product.status}
                      </Badge>
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(Number(product.base_price), product.currency)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Masaüstü / tablet: tablo */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(value) =>
                      setSelected(value === true ? rows.map((row) => row.id) : [])
                    }
                    aria-label="Tümünü seç"
                  />
                </th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Envanter</th>
                <th className="px-4 py-3">Fiyat</th>
                <th className="px-4 py-3">Varyant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <Package className="mx-auto mb-3 size-6 text-muted-foreground" />
                    <p className="font-medium">Bu filtrede ürün yok</p>
                    <p className="text-sm text-muted-foreground">
                      Sağ üstten yeni ürün ekleyerek kataloğunu başlat.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((product) => {
                  const variants = product.product_variants ?? [];
                  const stockTotal = variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
                  const image = (product.product_images ?? [])
                    .slice()
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
                  return (
                    <tr key={product.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={selected.includes(product.id)}
                          onCheckedChange={(value) =>
                            setSelected((prev) =>
                              value === true
                                ? [...prev, product.id]
                                : prev.filter((id) => id !== product.id),
                            )
                          }
                          aria-label={`${product.title} seç`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {image ? (
                              <img
                                src={image.url}
                                alt=""
                                className="size-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to="/store/$storeId/products/$productId"
                              params={{ storeId, productId: product.id }}
                              className="block max-w-[22rem] truncate font-medium hover:underline"
                            >
                              {product.title}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">
                              /{product.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={product.status === "active" ? "default" : "secondary"}>
                          {STATUS_LABELS[product.status] ?? product.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={stockTotal === 0 ? "text-destructive" : undefined}>
                          {variants.length} varyasyon için {formatNumber(stockTotal)} adet stokta
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {formatMoney(Number(product.base_price), product.currency)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{variants.length}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
