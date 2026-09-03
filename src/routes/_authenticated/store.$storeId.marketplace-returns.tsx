import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PackageOpen, Plus, RefreshCcw, Repeat } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton } from "@/components/ui/data-skeleton";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  MARKETPLACE_RETURN_REASON_LABELS,
  MARKETPLACE_RETURN_STATUSES,
  MARKETPLACE_RETURN_STATUS_LABELS,
  type MarketplaceReturnReason,
  type MarketplaceReturnStatus,
} from "@/lib/marketplace-ops";
import { marketplaceChannelsQuery, marketplaceReturnsQuery } from "@/lib/marketplace-ops-queries";
import { resolveMarketplaceReturnFn, upsertMarketplaceReturn } from "@/lib/marketplace-ops.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/marketplace-returns")({
  head: () => {
    const title = "Pazaryeri İade & Değişim Yönetimi — Mefticaret";
    const description =
      "Tüm pazaryerlerinden gelen iade ve değişim taleplerini tek ekrandan onayla, reddet, teslim al ve otomatik stok artırma ile takip et.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: () => (
    <AppShell title="Pazaryeri İadeleri" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Pazaryeri İadeleri" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız iade/değişim kaydı bulunamadı.
      </div>
    </AppShell>
  ),
  component: MarketplaceReturnsPage,
});

const STATUS_TONE: Record<MarketplaceReturnStatus, string> = {
  requested: "bg-amber-500/15 text-amber-600",
  approved: "bg-sky-500/15 text-sky-600",
  received: "bg-violet-500/15 text-violet-600",
  refunded: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

type ReturnRow = Awaited<ReturnType<NonNullable<ReturnType<typeof marketplaceReturnsQuery>["queryFn"]>>> extends readonly (infer Row)[]
  ? Row
  : never;

function ManualReturnDialog({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [marketplace, setMarketplace] = useState("");
  const [externalOrderNumber, setExternalOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState<MarketplaceReturnReason>("changed_mind");
  const [isExchange, setIsExchange] = useState(false);
  const [autoRestock, setAutoRestock] = useState(true);
  const [totalAmount, setTotalAmount] = useState("0");

  const create = useServerFn(upsertMarketplaceReturn);
  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeId,
          marketplace,
          externalOrderNumber: externalOrderNumber || undefined,
          customerName: customerName || undefined,
          reason,
          isExchange,
          autoRestock,
          totalAmount: Number(totalAmount) || 0,
          items: [],
        },
      }),
    onSuccess: () => {
      toast.success("İade/değişim kaydı oluşturuldu");
      setOpen(false);
      setMarketplace("");
      setExternalOrderNumber("");
      setCustomerName("");
      setTotalAmount("0");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> Manuel kayıt
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manuel iade/değişim kaydı</SheetTitle>
          <SheetDescription>
            Pazaryeri panelinden manuel takip ettiğiniz bir iade/değişimi buradan kaydedin.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mp">Pazaryeri</Label>
            <Input
              id="mp"
              value={marketplace}
              onChange={(event) => setMarketplace(event.target.value)}
              placeholder="ör. Trendyol"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ext-order">Sipariş numarası</Label>
            <Input
              id="ext-order"
              value={externalOrderNumber}
              onChange={(event) => setExternalOrderNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust">Müşteri</Label>
            <Input
              id="cust"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sebep</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as MarketplaceReturnReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MARKETPLACE_RETURN_REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Tutar</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
            />
          </div>
          <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span>Değişim (exchange)</span>
            <Switch checked={isExchange} onCheckedChange={setIsExchange} />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span>Onaylanınca otomatik stok artırma</span>
            <Switch checked={autoRestock} onCheckedChange={setAutoRestock} />
          </label>

          <Button
            className="w-full"
            disabled={!marketplace || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Kaydet
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReturnDetailSheet({ row, storeId }: { row: ReturnRow; storeId: string }) {
  const status = row.status as MarketplaceReturnStatus;
  const items: { title?: string; quantity?: number }[] = Array.isArray(row.items) ? (row.items as { title?: string; quantity?: number }[]) : [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          Detay
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {row.external_return_id ?? row.id.slice(0, 8)}
            {row.is_exchange ? (
              <Badge variant="secondary" className="gap-1">
                <Repeat className="size-3" /> Değişim
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {row.marketplace_channels?.name ?? row.marketplace} ·{" "}
            {row.orders?.order_number ?? row.external_order_number ?? "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Durum</span>
            <Badge className={STATUS_TONE[status]} variant="secondary">
              {MARKETPLACE_RETURN_STATUS_LABELS[status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Müşteri</span>
            <span>{row.customer_name ?? row.orders?.customer_name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sebep</span>
            <span>{MARKETPLACE_RETURN_REASON_LABELS[row.reason as MarketplaceReturnReason] ?? row.reason ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tutar</span>
            <span className="font-semibold">{formatMoney(Number(row.total_amount ?? 0), row.currency ?? "TRY")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Otomatik stok artırma</span>
            <span>{row.auto_restock ? "Açık" : "Kapalı"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Oluşturulma</span>
            <span>{formatDateTime(row.requested_at ?? row.created_at)}</span>
          </div>

          {row.reason_detail ? (
            <div className="rounded-xl bg-muted/50 p-3">{row.reason_detail}</div>
          ) : null}

          {items.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-border/60 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Kalemler</p>
              {items.map((item, index) => (
                <p key={index} className="text-sm">
                  {item.quantity ?? 1} × {item.title ?? "Ürün"}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MarketplaceReturnsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MarketplaceReturnStatus | "all">("all");
  const [channelId, setChannelId] = useState<string | "all">("all");

  const filters = { status, channelId };
  const { data: rows, isLoading } = useQuery(marketplaceReturnsQuery(storeId, filters));
  const { data: channels } = useQuery(marketplaceChannelsQuery(storeId));

  const resolve = useServerFn(resolveMarketplaceReturnFn);
  const mutation = useMutation({
    mutationFn: (input: { returnId: string; action: "approve" | "reject" | "receive" | "refund" }) =>
      resolve({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("İade güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["marketplace-returns", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["marketplace-returns", storeId] });

  const list = rows ?? [];

  return (
    <AppShell
      storeId={storeId}
      title="Pazaryeri İade & Değişim Yönetimi"
      description="Tüm kanallardan gelen iade/değişim taleplerini onaylayın, reddedin ve stoklarınızı otomatik güncelleyin."
      actions={<ManualReturnDialog storeId={storeId} onDone={invalidate} />}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select value={channelId} onValueChange={(value) => setChannelId(value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kanal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kanallar</SelectItem>
            {(channels ?? []).map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={status === "all" ? "default" : "outline"}
            onClick={() => setStatus("all")}
          >
            Tümü
          </Button>
          {MARKETPLACE_RETURN_STATUSES.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? "default" : "outline"}
              onClick={() => setStatus(value)}
            >
              {MARKETPLACE_RETURN_STATUS_LABELS[value]}
            </Button>
          ))}
        </div>

        <Button size="sm" variant="ghost" onClick={() => void invalidate()}>
          <RefreshCcw className="mr-2 size-3.5" /> Yenile
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Bu filtrede kayıt bulunmuyor.</p>
          </div>
        ) : (
          list.map((row) => {
            const rowStatus = row.status as MarketplaceReturnStatus;
            return (
              <article key={row.id} className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {row.external_return_id ?? row.marketplace} — {row.marketplace_channels?.name ?? row.marketplace}
                      </h3>
                      <Badge className={STATUS_TONE[rowStatus]} variant="secondary">
                        {MARKETPLACE_RETURN_STATUS_LABELS[rowStatus]}
                      </Badge>
                      {row.is_exchange ? (
                        <Badge variant="secondary" className="gap-1">
                          <Repeat className="size-3" /> Değişim
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.orders?.order_number ?? row.external_order_number ?? "—"} ·{" "}
                      {row.customer_name ?? row.orders?.customer_name ?? "Misafir"} ·{" "}
                      {formatDateTime(row.requested_at ?? row.created_at)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">
                    {formatMoney(Number(row.total_amount ?? 0), row.currency ?? "TRY")}
                  </p>
                </header>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ReturnDetailSheet row={row} storeId={storeId} />
                  <Button
                    size="sm"
                    disabled={rowStatus !== "requested" || mutation.isPending}
                    onClick={() => mutation.mutate({ returnId: row.id, action: "approve" })}
                  >
                    Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rowStatus !== "requested" || mutation.isPending}
                    onClick={() => mutation.mutate({ returnId: row.id, action: "reject" })}
                  >
                    Reddet
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={rowStatus !== "approved" || mutation.isPending}
                    onClick={() => mutation.mutate({ returnId: row.id, action: "receive" })}
                  >
                    Teslim aldım
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
