import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Package, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUS_LABELS } from "@/lib/mefti";
import { formatMoney } from "@/lib/mefti";
import {
  PAYOUT_REQUEST_LABELS,
  SELLER_STATUS_LABELS,
  computeSellerEarnings,
  sellerOrderLinesQuery,
  sellerPayoutRequestsQuery,
  sellerProductsQuery,
  sellerQuery,
} from "@/lib/marketplace-queries";
import { requestSellerPayout, updateSellerVariant } from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/seller/$sellerId")({
  head: () => ({
    meta: [
      { title: "Satıcı Paneli — Mefticaret Pazaryeri" },
      {
        name: "description",
        content:
          "Pazaryeri satıcı paneli: ürün ve stok yönetimi, siparişler, satışlar, komisyon, kazanç ve para çekme talepleri.",
      },
      { property: "og:title", content: "Satıcı Paneli — Mefticaret Pazaryeri" },
      {
        property: "og:description",
        content: "Satışlarınızı, komisyonlarınızı ve kazancınızı tek ekrandan takip edin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellerDashboardPage,
});

const orderStatusLabel = (status: string) =>
  (ORDER_STATUS_LABELS as Record<string, string>)[status] ?? status;

function SellerDashboardPage() {
  const { sellerId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: seller, isLoading } = useQuery(sellerQuery(sellerId));
  const storeId = seller?.store_id ?? "";

  const { data: products } = useQuery({
    ...sellerProductsQuery(sellerId),
    enabled: Boolean(seller),
  });
  const { data: lines } = useQuery({
    ...sellerOrderLinesQuery(sellerId, storeId),
    enabled: Boolean(storeId),
  });
  const { data: requests } = useQuery(sellerPayoutRequestsQuery(sellerId));

  const earnings = useMemo(
    () => computeSellerEarnings(lines ?? [], Number(seller?.commission_rate ?? 0), requests ?? []),
    [lines, seller?.commission_rate, requests],
  );

  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const saveVariant = useServerFn(updateSellerVariant);
  const requestPayout = useServerFn(requestSellerPayout);

  const stockMutation = useMutation({
    mutationFn: (input: { variantId: string; stock: number }) =>
      saveVariant({ data: { variantId: input.variantId, stock: input.stock } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-products", sellerId] });
      toast.success("Stok güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payoutMutation = useMutation({
    mutationFn: () =>
      requestPayout({
        data: {
          sellerId,
          amount: Number(amount),
          iban: iban || undefined,
          note: note || undefined,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["seller-payout-requests", sellerId] });
      setAmount("");
      setNote("");
      toast.success("Para çekme talebiniz oluşturuldu");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Satıcı paneli">
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      </AppShell>
    );
  }

  if (!seller) {
    return (
      <AppShell title="Satıcı paneli">
        <p className="text-sm text-muted-foreground">Satıcı kaydı bulunamadı.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={seller.display_name}
      description={`${seller.stores?.name ?? "Pazaryeri"} · Komisyon %${(
        Number(seller.commission_rate) * 100
      ).toFixed(1)}`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/sellers">
            <ArrowLeft className="mr-2 size-4" /> Satıcı hesaplarım
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={seller.status === "approved" ? "default" : "secondary"}>
            {SELLER_STATUS_LABELS[seller.status]}
          </Badge>
          {seller.status !== "approved" ? (
            <span className="text-sm text-muted-foreground">
              Onay tamamlanana kadar ürün ve stok işlemleri kapalıdır.
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Satışlar", value: formatMoney(earnings.revenue) },
            {
              label: `Komisyon (%${(earnings.commissionRate * 100).toFixed(1)})`,
              value: formatMoney(earnings.commission),
            },
            { label: "Net kazanç", value: formatMoney(earnings.net) },
            { label: "Çekilebilir bakiye", value: formatMoney(earnings.available) },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-1 font-display text-xl font-semibold">{card.value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Ürünlerim ve stok</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Varyant</th>
                  <th className="py-2">SKU</th>
                  <th className="py-2">Fiyat</th>
                  <th className="py-2">Stok</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!products?.length ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
                      Size atanmış ürün yok. Pazaryeri yöneticisi ürün atadığında burada görünür.
                    </td>
                  </tr>
                ) : null}
                {(products ?? []).flatMap((product) =>
                  (product.product_variants ?? []).map((variant) => (
                    <tr key={variant.id}>
                      <td className="py-2">{product.title}</td>
                      <td className="py-2">{variant.title}</td>
                      <td className="py-2 text-muted-foreground">{variant.sku ?? "—"}</td>
                      <td className="py-2">{formatMoney(Number(variant.price))}</td>
                      <td className="py-2">
                        <Input
                          className="w-24"
                          inputMode="numeric"
                          value={stockDrafts[variant.id] ?? String(variant.stock)}
                          onChange={(event) =>
                            setStockDrafts((prev) => ({ ...prev, [variant.id]: event.target.value }))
                          }
                        />
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={seller.status !== "approved" || stockMutation.isPending}
                          onClick={() =>
                            stockMutation.mutate({
                              variantId: variant.id,
                              stock: Math.max(
                                0,
                                Number(stockDrafts[variant.id] ?? variant.stock) || 0,
                              ),
                            })
                          }
                        >
                          Kaydet
                        </Button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border p-5">
          <h2 className="font-display text-base font-semibold">Siparişlerim</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Sipariş</th>
                  <th className="py-2">Durum</th>
                  <th className="py-2">Tarih</th>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Adet</th>
                  <th className="py-2">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!lines?.length ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
                      Henüz siparişiniz yok.
                    </td>
                  </tr>
                ) : null}
                {(lines ?? []).map((line, index) => (
                  <tr key={`${line.order_id}-${index}`}>
                    <td className="py-2 font-medium">{line.order_number}</td>
                    <td className="py-2">
                      <Badge variant="secondary">{orderStatusLabel(line.status)}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {line.placed_at ? new Date(line.placed_at).toLocaleDateString("tr-TR") : "—"}
                    </td>
                    <td className="py-2">
                      {line.title}
                      {line.variant_title ? (
                        <span className="text-muted-foreground"> · {line.variant_title}</span>
                      ) : null}
                    </td>
                    <td className="py-2">{line.quantity}</td>
                    <td className="py-2">{formatMoney(line.line_total, line.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Para çekme</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Çekilebilir bakiye: {formatMoney(earnings.available)} · Bekleyen talep:{" "}
            {formatMoney(earnings.pending)} · Ödenen: {formatMoney(earnings.paid)}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Tutar</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-iban">IBAN</Label>
              <Input
                id="payout-iban"
                value={iban}
                placeholder="TR.. (kayıtlı IBAN güvenlik nedeniyle gösterilmez)"
                onChange={(event) => setIban(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-note">Not</Label>
              <Textarea
                id="payout-note"
                rows={1}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={
              seller.status !== "approved" ||
              !(Number(amount) > 0) ||
              payoutMutation.isPending
            }
            onClick={() => payoutMutation.mutate()}
          >
            Talep oluştur
          </Button>

          <div className="mt-5 space-y-2">
            {(requests ?? []).map((request) => (
              <div
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="font-medium">
                    {formatMoney(Number(request.amount), request.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(request.created_at).toLocaleString("tr-TR")}
                    {request.admin_note ? ` · ${request.admin_note}` : ""}
                  </p>
                </div>
                <Badge variant={request.status === "paid" ? "default" : "secondary"}>
                  {PAYOUT_REQUEST_LABELS[request.status]}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
