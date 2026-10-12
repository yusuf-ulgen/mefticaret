import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Ban, Store, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/mefti";
import {
  PAYOUT_REQUEST_LABELS,
  SELLER_STATUS_LABELS,
  computeSellerEarnings,
  sellerOrderLinesQuery,
  sellerPayoutRequestsQuery,
  sellersQuery,
  storeProductsForAssignmentQuery,
  storePayoutRequestsQuery,
} from "@/lib/marketplace-queries";
import type { PayoutRequestStatus, SellerRow, SellerStatus } from "@/lib/marketplace-queries";
import {
  assignProductSeller,
  reviewPayoutRequest,
  reviewSeller,
} from "@/lib/marketplace.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/sellers")({
  head: () => ({
    meta: [
      { title: "Pazaryeri Satıcıları — Mefticaret" },
      {
        name: "description",
        content:
          "Satıcı başvurularını onaylayın, komisyon oranı belirleyin, satıcı ürünlerini ve para çekme taleplerini yönetin.",
      },
      { property: "og:title", content: "Pazaryeri Satıcıları — Mefticaret" },
      {
        property: "og:description",
        content: "Çok satıcılı pazaryeri yönetimi: onay, komisyon, ürün ve ödeme kontrolü.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreSellersPage,
});

const statusTone: Record<SellerStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

function StoreSellersPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: sellers, isLoading } = useQuery(sellersQuery(storeId));
  const { data: payouts } = useQuery(storePayoutRequestsQuery(storeId));
  const { data: products } = useQuery(storeProductsForAssignmentQuery(storeId));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [commission, setCommission] = useState("");
  const [assignProduct, setAssignProduct] = useState("");
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const selected: SellerRow | null = useMemo(() => {
    if (!sellers?.length) return null;
    return sellers.find((seller) => seller.id === selectedId) ?? sellers[0]!;
  }, [sellers, selectedId]);

  const { data: lines } = useQuery({
    ...sellerOrderLinesQuery(selected?.id ?? "", storeId),
    enabled: Boolean(selected?.id),
  });
  const { data: sellerRequests } = useQuery({
    ...sellerPayoutRequestsQuery(selected?.id ?? ""),
    enabled: Boolean(selected?.id),
  });

  const earnings = useMemo(
    () =>
      computeSellerEarnings(
        lines ?? [],
        Number(selected?.commission_rate ?? 0),
        sellerRequests ?? [],
      ),
    [lines, selected?.commission_rate, sellerRequests],
  );

  const review = useServerFn(reviewSeller);
  const assign = useServerFn(assignProductSeller);
  const processPayout = useServerFn(reviewPayoutRequest);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace-sellers", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["store-payout-requests", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["store-products-assignment", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["seller-payout-requests"] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: (input: { status: SellerStatus; reason?: string; commissionRate?: number }) =>
      review({
        data: {
          sellerId: selected!.id,
          status: input.status,
          reason: input.reason,
          commissionRate: input.commissionRate,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      setReason("");
      toast.success("Satıcı kaydı güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: (input: { productId: string; sellerId: string | null }) =>
      assign({ data: { storeId, productId: input.productId, sellerId: input.sellerId } }),
    onSuccess: async () => {
      await invalidate();
      setAssignProduct("");
      toast.success("Ürün satıcı ataması güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payoutMutation = useMutation({
    mutationFn: (input: { requestId: string; status: PayoutRequestStatus }) =>
      processPayout({
        data: {
          requestId: input.requestId,
          status: input.status,
          adminNote: adminNotes[input.requestId] || undefined,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Para çekme talebi güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sellerProducts = (products ?? []).filter((product) => product.seller_id === selected?.id);
  const unassigned = (products ?? []).filter((product) => !product.seller_id);
  const pendingCount = (sellers ?? []).filter((seller) => seller.status === "pending").length;

  return (
    <AppShell
      storeId={storeId}
      title="Pazaryeri satıcıları"
      description="Satıcı başvurularını değerlendirin, komisyon belirleyin, ürün ve ödeme yönetimini tek ekrandan yapın."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Satıcılar</h2>
            {pendingCount > 0 ? (
              <Badge variant="secondary">{pendingCount} başvuru</Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
            {!isLoading && !sellers?.length ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Henüz satıcı başvurusu yok. Satıcılar “Satıcı Ol” sayfasından başvurabilir.
              </p>
            ) : null}
            {(sellers ?? []).map((seller) => (
              <button
                key={seller.id}
                type="button"
                onClick={() => {
                  setSelectedId(seller.id);
                  setCommission(String(Number(seller.commission_rate) * 100));
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selected?.id === seller.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{seller.display_name}</span>
                  <Badge variant={statusTone[seller.status]}>
                    {SELLER_STATUS_LABELS[seller.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Komisyon %{(Number(seller.commission_rate) * 100).toFixed(1)} ·{" "}
                  {seller.email ?? "e-posta yok"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {selected ? (
            <>
              <div className="rounded-2xl border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{selected.display_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selected.legal_name ?? "Yasal ad girilmedi"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selected.email ?? "—"} · {selected.phone ?? "—"} · IBAN ve vergi
                      numarası güvenlik nedeniyle gizlidir
                    </p>
                  </div>
                  <Badge variant={statusTone[selected.status]}>
                    {SELLER_STATUS_LABELS[selected.status]}
                  </Badge>
                </div>
                {selected.about ? (
                  <p className="mt-3 text-sm text-muted-foreground">{selected.about}</p>
                ) : null}
                {selected.rejection_reason ? (
                  <p className="mt-3 text-sm text-destructive">
                    Red gerekçesi: {selected.rejection_reason}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="commission">Komisyon oranı (%)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="commission"
                        inputMode="decimal"
                        value={commission}
                        onChange={(event) => setCommission(event.target.value)}
                        placeholder={String(Number(selected.commission_rate) * 100)}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          reviewMutation.mutate({
                            status: selected.status,
                            commissionRate: Math.max(0, Number(commission) || 0) / 100,
                          })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reason">Red / askı gerekçesi</Label>
                    <Textarea
                      id="reason"
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Belgeler eksik…"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => reviewMutation.mutate({ status: "approved" })}
                    disabled={reviewMutation.isPending}
                  >
                    <BadgeCheck className="mr-2 size-4" /> Onayla
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => reviewMutation.mutate({ status: "rejected", reason })}
                    disabled={reviewMutation.isPending}
                  >
                    Reddet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reviewMutation.mutate({ status: "suspended", reason })}
                    disabled={reviewMutation.isPending}
                  >
                    <Ban className="mr-2 size-4" /> Askıya al
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => reviewMutation.mutate({ status: "pending" })}
                    disabled={reviewMutation.isPending}
                  >
                    Başvuruya döndür
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Satış hacmi", value: formatMoney(earnings.revenue) },
                  { label: "Komisyon", value: formatMoney(earnings.commission) },
                  { label: "Net kazanç", value: formatMoney(earnings.net) },
                  { label: "Ödenen", value: formatMoney(earnings.paid) },
                ].map((card) => (
                  <div key={card.label} className="rounded-2xl border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2">
                  <Store className="size-4 text-muted-foreground" />
                  <h3 className="font-display text-base font-semibold">Satıcı ürünleri</h3>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Select value={assignProduct} onValueChange={setAssignProduct}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Atanacak ürün seç" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Atanmamış ürün yok
                        </SelectItem>
                      ) : null}
                      {unassigned.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!assignProduct || assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({ productId: assignProduct, sellerId: selected.id })
                    }
                  >
                    Satıcıya ata
                  </Button>
                </div>
                <ul className="mt-4 divide-y divide-border">
                  {sellerProducts.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">
                      Bu satıcıya atanmış ürün yok.
                    </li>
                  ) : null}
                  {sellerProducts.map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm">{product.title}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          assignMutation.mutate({ productId: product.id, sellerId: null })
                        }
                      >
                        Bağlantıyı kaldır
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          <div className="rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-muted-foreground" />
              <h3 className="font-display text-base font-semibold">Para çekme talepleri</h3>
            </div>
            <div className="mt-3 space-y-3">
              {!payouts?.length ? (
                <p className="text-sm text-muted-foreground">Bekleyen talep yok.</p>
              ) : null}
              {(payouts ?? []).map((request) => (
                <div key={request.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {request.marketplace_sellers?.display_name ?? "Satıcı"} —{" "}
                        {formatMoney(Number(request.amount), request.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleString("tr-TR")} · IBAN{" "}
                        {request.iban ?? "—"}
                      </p>
                    </div>
                    <Badge variant={request.status === "paid" ? "default" : "secondary"}>
                      {PAYOUT_REQUEST_LABELS[request.status]}
                    </Badge>
                  </div>
                  {request.note ? (
                    <p className="mt-2 text-sm text-muted-foreground">{request.note}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      className="w-64"
                      placeholder="Yönetici notu"
                      value={adminNotes[request.id] ?? request.admin_note ?? ""}
                      onChange={(event) =>
                        setAdminNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        payoutMutation.mutate({ requestId: request.id, status: "processing" })
                      }
                    >
                      İşleme al
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => payoutMutation.mutate({ requestId: request.id, status: "paid" })}
                    >
                      Ödendi
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        payoutMutation.mutate({ requestId: request.id, status: "failed" })
                      }
                    >
                      Reddet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
