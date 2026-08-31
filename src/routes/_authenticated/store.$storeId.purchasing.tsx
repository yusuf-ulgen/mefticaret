import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PackagePlus, Plus, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/mefti";
import { inventoryQuery } from "@/lib/inventory-queries";
import {
  PURCHASE_STATUS_LABEL,
  nextPurchaseOrderCode,
  purchaseOrderReceivedRatio,
  purchaseOrderTotal,
} from "@/lib/purchasing";
import {
  createPurchaseOrder,
  receivePurchaseOrderLines,
  saveSupplier,
  setPurchaseOrderStatus,
} from "@/lib/purchasing.functions";
import { purchaseOrdersQuery, suppliersQuery } from "@/lib/purchasing-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/purchasing")({
  head: () => ({
    meta: [
      { title: "Tedarik & Satın Alma — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçilerini yönet, satın alma siparişi oluştur ve mal kabulü tek adımda stok girişine dönüştür.",
      },
      { property: "og:title", content: "Tedarik & Satın Alma — Mefticaret" },
      {
        property: "og:description",
        content: "Tedarikçi kayıtları, satın alma siparişleri ve denetim izli mal kabul.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchasingPage,
});

type DraftItem = {
  variantId: string;
  productId?: string;
  title: string;
  sku?: string;
  quantity: number;
  unitCost: number;
};

function PurchasingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: suppliers } = useQuery(suppliersQuery(storeId));
  const { data: orders } = useQuery(purchaseOrdersQuery(storeId));
  const { data: variants } = useQuery(inventoryQuery(storeId));

  const saveSupplierFn = useServerFn(saveSupplier);
  const createOrderFn = useServerFn(createPurchaseOrder);
  const receiveFn = useServerFn(receivePurchaseOrderLines);
  const statusFn = useServerFn(setPurchaseOrderStatus);

  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");

  const [code, setCode] = useState(() => nextPurchaseOrderCode());
  const [supplierId, setSupplierId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["suppliers", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-movements", storeId] });
  };

  const supplierMutation = useMutation({
    mutationFn: () =>
      saveSupplierFn({
        data: {
          storeId,
          name: supplierName.trim(),
          email: supplierEmail.trim(),
          phone: supplierPhone.trim(),
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("Tedarikçi kaydedildi");
      setSupplierName("");
      setSupplierEmail("");
      setSupplierPhone("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orderMutation = useMutation({
    mutationFn: () =>
      createOrderFn({
        data: {
          storeId,
          code: code.trim(),
          supplierId: supplierId || undefined,
          expectedAt: expectedAt || undefined,
          note: note.trim() || undefined,
          items: items.map((item) => ({
            variantId: item.variantId,
            productId: item.productId,
            title: item.title,
            sku: item.sku,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Satın alma siparişi oluşturuldu");
      setItems([]);
      setNote("");
      setCode(nextPurchaseOrderCode());
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const receiveMutation = useMutation({
    mutationFn: (input: { purchaseOrderId: string; lines: { itemId: string; quantity: number }[] }) =>
      receiveFn({ data: { storeId, ...input } }),
    onSuccess: (result) => {
      const received = result.received.reduce((sum, line) => sum + line.quantity, 0);
      toast.success(`Mal kabul tamam · ${received} adet stoğa eklendi`);
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} kalem atlandı`);
      }
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (purchaseOrderId: string) =>
      statusFn({ data: { storeId, purchaseOrderId, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Sipariş iptal edildi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return [];
    return (variants ?? [])
      .filter((variant: any) => {
        const productTitle = variant.products?.title ?? "";
        return (
          variant.title?.toLowerCase().includes(term) ||
          productTitle.toLowerCase().includes(term) ||
          (variant.sku ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [search, variants]);

  const draftTotal = purchaseOrderTotal(
    items.map((item) => ({ quantity: item.quantity, unit_cost: item.unitCost })),
  );

  const addItem = (variant: any) => {
    setItems((previous) => {
      if (previous.some((item) => item.variantId === variant.id)) return previous;
      const label = variant.products?.title
        ? `${variant.products.title} — ${variant.title}`
        : variant.title;
      return [
        ...previous,
        {
          variantId: variant.id,
          productId: variant.product_id ?? undefined,
          title: label,
          sku: variant.sku ?? undefined,
          quantity: 1,
          unitCost: 0,
        },
      ];
    });
    setSearch("");
  };

  const patchItem = (variantId: string, patch: Partial<DraftItem>) =>
    setItems((previous) =>
      previous.map((item) => (item.variantId === variantId ? { ...item, ...patch } : item)),
    );

  return (
    <AppShell storeId={storeId}>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Tedarik &amp; Satın Alma
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tedarikçilerini kaydet, satın alma siparişi aç ve mal kabul ettiğinde stok denetim
            iziyle otomatik güncellensin.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Yeni tedarikçi</h2>
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Firma adı</Label>
              <Input
                id="supplier-name"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Örn. Anadolu Tekstil A.Ş."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-email">E-posta</Label>
              <Input
                id="supplier-email"
                value={supplierEmail}
                onChange={(event) => setSupplierEmail(event.target.value)}
                placeholder="satis@tedarikci.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Telefon</Label>
              <Input
                id="supplier-phone"
                value={supplierPhone}
                onChange={(event) => setSupplierPhone(event.target.value)}
                placeholder="0212 000 00 00"
              />
            </div>
            <Button
              className="w-full"
              disabled={supplierName.trim().length < 2 || supplierMutation.isPending}
              onClick={() => supplierMutation.mutate()}
            >
              <Plus className="mr-2 size-4" /> Tedarikçi ekle
            </Button>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kayıtlı tedarikçiler ({suppliers?.length ?? 0})
              </p>
              <ul className="space-y-1 text-sm">
                {(suppliers ?? []).map((supplier) => (
                  <li key={supplier.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{supplier.name}</span>
                    {supplier.email ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {supplier.email}
                      </span>
                    ) : null}
                  </li>
                ))}
                {(suppliers ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">Henüz tedarikçi yok.</li>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Satın alma siparişi oluştur</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="po-code">Sipariş kodu</Label>
                <Input
                  id="po-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-supplier">Tedarikçi</Label>
                <select
                  id="po-supplier"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                >
                  <option value="">Seçilmedi</option>
                  {(suppliers ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-expected">Beklenen teslim</Label>
                <Input
                  id="po-expected"
                  type="date"
                  value={expectedAt}
                  onChange={(event) => setExpectedAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-search">Varyant ara (ürün adı veya SKU)</Label>
              <Input
                id="po-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="En az 2 karakter yaz"
              />
              {searchResults.length > 0 ? (
                <ul className="divide-y rounded-md border">
                  {searchResults.map((variant: any) => (
                    <li key={variant.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => addItem(variant)}
                      >
                        <span className="truncate">
                          {variant.products?.title
                            ? `${variant.products.title} — ${variant.title}`
                            : variant.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {variant.sku ?? "SKU yok"} · stok {variant.stock ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {items.length > 0 ? (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Kalem</th>
                      <th className="px-3 py-2 text-right">Adet</th>
                      <th className="px-3 py-2 text-right">Birim maliyet</th>
                      <th className="px-3 py-2 text-right">Toplam</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => (
                      <tr key={item.variantId}>
                        <td className="px-3 py-2">
                          <div className="truncate font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.sku ?? "SKU yok"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            className="h-8 w-20 text-right"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              patchItem(item.variantId, {
                                quantity: Math.max(1, Number(event.target.value) || 1),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            className="h-8 w-28 text-right"
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitCost}
                            onChange={(event) =>
                              patchItem(item.variantId, {
                                unitCost: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(item.quantity * item.unitCost)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setItems((previous) =>
                                previous.filter((row) => row.variantId !== item.variantId),
                              )
                            }
                          >
                            Kaldır
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Siparişe eklenecek varyantları yukarıdaki aramadan seç.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="po-note">Not</Label>
              <Textarea
                id="po-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ödeme vadesi, sevkiyat notu vb."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Sipariş toplamı:{" "}
                <strong className="text-foreground">{formatMoney(draftTotal)}</strong>
              </span>
              <Button
                disabled={items.length === 0 || code.trim().length < 3 || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}
              >
                <PackagePlus className="mr-2 size-4" /> Siparişi oluştur
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Satın alma siparişleri</h2>
          <div className="space-y-3">
            {(orders ?? []).map((order) => {
              const total = purchaseOrderTotal(order.purchase_order_items);
              const ratio = purchaseOrderReceivedRatio(order.purchase_order_items);
              const openLines = order.purchase_order_items
                .filter((item) => item.received_quantity < item.quantity)
                .map((item) => ({
                  itemId: item.id,
                  quantity: item.quantity - item.received_quantity,
                }));
              return (
                <article key={order.id} className="rounded-xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-semibold">{order.code}</h3>
                        <Badge
                          variant={
                            order.status === "received"
                              ? "default"
                              : order.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {PURCHASE_STATUS_LABEL[order.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.suppliers?.name ?? "Tedarikçi belirtilmedi"} ·{" "}
                        {order.purchase_order_items.length} kalem · {formatMoney(total)} ·{" "}
                        {order.expected_at
                          ? `beklenen ${formatDate(order.expected_at)}`
                          : `oluşturma ${formatDate(order.created_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">%{ratio} teslim</span>
                      {openLines.length > 0 && order.status !== "cancelled" ? (
                        <Button
                          size="sm"
                          disabled={receiveMutation.isPending}
                          onClick={() =>
                            receiveMutation.mutate({
                              purchaseOrderId: order.id,
                              lines: openLines,
                            })
                          }
                        >
                          <Truck className="mr-2 size-4" /> Tümünü mal kabul et
                        </Button>
                      ) : null}
                      {order.status === "ordered" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(order.id)}
                        >
                          İptal
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1 text-sm">
                    {order.purchase_order_items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{item.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.received_quantity}/{item.quantity} adet ·{" "}
                          {formatMoney(Number(item.unit_cost))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {order.note ? (
                    <p className="mt-3 text-xs text-muted-foreground">{order.note}</p>
                  ) : null}
                </article>
              );
            })}
            {(orders ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Henüz satın alma siparişi yok.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
