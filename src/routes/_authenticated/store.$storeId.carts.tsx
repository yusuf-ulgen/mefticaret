import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Link2, Mail, ShoppingCart, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteAbandonedCart } from "@/lib/abandoned.functions";
import { abandonedCartsQuery } from "@/lib/abandoned-queries";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/carts")({
  head: () => ({
    meta: [
      { title: "Terk Edilmiş Sepetler — Mefticaret" },
      {
        name: "description",
        content: "Satın almadan ayrılan ziyaretçilerin sepetlerini görüntüle, kurtarma oranını takip et.",
      },
      { property: "og:title", content: "Terk Edilmiş Sepetler — Mefticaret" },
      { property: "og:description", content: "Terk edilmiş sepetleri ve kurtarma oranını takip et." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AbandonedCartsPage,
});

function AbandonedCartsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: carts, isLoading } = useQuery(abandonedCartsQuery(storeId));

  const deleteFn = useServerFn(deleteAbandonedCart);
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Kayıt silindi");
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "abandoned-carts"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const storeSlug = store?.slug ?? "";

  /** Ziyaretçiyi sepeti dolu olarak geri getiren kurtarma linki. */
  function recoveryLink(cartToken: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/s/${storeSlug}/cart?recover=${encodeURIComponent(cartToken)}`;
  }

  async function copyRecoveryLink(cartToken: string) {
    try {
      await navigator.clipboard.writeText(recoveryLink(cartToken));
      toast.success("Kurtarma linki kopyalandı");
    } catch {
      toast.error("Link kopyalanamadı");
    }
  }

  const rows = carts ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    if (!q) return rows;
    return rows.filter((cart) =>
      [cart.customer_email ?? "", cart.customer_name ?? "", JSON.stringify(cart.items)]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [rows, search]);

  const open = rows.filter((cart) => !cart.recovered_order_id);
  const recovered = rows.filter((cart) => cart.recovered_order_id);
  const openValue = open.reduce((sum, cart) => sum + Number(cart.total), 0);
  const recoveryRate = rows.length ? Math.round((recovered.length / rows.length) * 100) : 0;
  const currency = store?.currency ?? "TRY";

  return (
    <AppShell storeId={storeId} title="Terk Edilmiş Sepetler">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Terk Edilmiş Sepetler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Satın almadan ayrılan ziyaretçilerin sepet anlık görüntüleri. Siparişe dönüşen sepetler otomatik işaretlenir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="size-4" /> Açık sepet
            </div>
            <p className="mt-2 text-2xl font-semibold">{open.length}</p>
            <p className="text-xs text-muted-foreground">{formatMoney(openValue, currency)} potansiyel ciro</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4" /> E-postası bilinen
            </div>
            <p className="mt-2 text-2xl font-semibold">{open.filter((cart) => cart.customer_email).length}</p>
            <p className="text-xs text-muted-foreground">Kurtarma kampanyasına uygun</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" /> Kurtarma oranı
            </div>
            <p className="mt-2 text-2xl font-semibold">%{recoveryRate}</p>
            <p className="text-xs text-muted-foreground">{recovered.length} sepet siparişe döndü</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="E-posta, isim veya ürün ara…"
            className="max-w-sm"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Henüz terk edilmiş sepet kaydı yok. Ziyaretçiler sepete ürün ekledikçe burada listelenir."
              : "Aramanızla eşleşen kayıt bulunamadı."}
          </div>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Müşteri</TableHead>
                  <TableHead>Sepet içeriği</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead>Son görülme</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cart) => (
                  <TableRow key={cart.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{cart.customer_name ?? "Anonim ziyaretçi"}</div>
                      <div className="text-xs text-muted-foreground">{cart.customer_email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm text-muted-foreground">
                        {(cart.items as { title?: string; quantity?: number }[])
                          .map((item) => `${item.title ?? "Ürün"} × ${item.quantity ?? 1}`)
                          .join(", ")}
                      </div>
                      <div className="text-xs text-muted-foreground">{cart.item_count} kalem</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(cart.total), cart.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(cart.last_seen_at)}</TableCell>
                    <TableCell>
                      {cart.recovered_order_id ? (
                        <Badge variant="default">Siparişe döndü</Badge>
                      ) : (
                        <Badge variant="secondary">Bekliyor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {!cart.recovered_order_id && storeSlug ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Kurtarma linkini kopyala"
                          title="Kurtarma linkini kopyala"
                          onClick={() => void copyRecoveryLink(cart.cart_token)}
                        >
                          <Link2 className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Kaydı sil"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(cart.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
