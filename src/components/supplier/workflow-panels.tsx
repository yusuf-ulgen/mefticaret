import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/mefti";
import { PO_PAYMENT_LABEL, PO_SUPPLIER_STATUS_LABEL } from "@/lib/supplier-workflow";
import {
  supplierDeleteFeed,
  supplierMarkMessagesRead,
  supplierRunFeed,
  supplierRecoverFeed,
  supplierSaveFeed,
  supplierSavePaymentSettings,
  supplierSendMessage,
  supplierSetFeedMarkup,
  supplierUpdatePurchaseOrder,
  supplierWorkflowOverview,
} from "@/lib/supplier-workflow.functions";

export function useSupplierWorkflow(supplierId: string) {
  const load = useServerFn(supplierWorkflowOverview);
  return useQuery({
    queryKey: ["supplier-workflow", supplierId],
    queryFn: () => load({ data: { supplierId } }),
    enabled: Boolean(supplierId),
    refetchInterval: 30_000,
  });
}

type Workflow = NonNullable<ReturnType<typeof useSupplierWorkflow>["data"]>;

function useRefresh(supplierId: string) {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: ["supplier-workflow", supplierId] });
}

/** Mağazadan gelen satın alma siparişleri: kabul, hazırlama, kargo, ödeme takibi. */
export function SupplierPurchaseOrders({
  supplierId,
  data,
}: {
  supplierId: string;
  data: Workflow;
}) {
  const refresh = useRefresh(supplierId);
  const update = useServerFn(supplierUpdatePurchaseOrder);
  const mutation = useMutation({
    mutationFn: (input: {
      purchaseOrderId: string;
      supplierStatus: "accepted" | "preparing" | "shipped" | "rejected";
      carrier?: string;
      trackingNumber?: string;
    }) => update({ data: { supplierId, ...input } }),
    onSuccess: () => {
      toast.success("Sipariş güncellendi");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data.orders.length) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Mağazadan gelen satın alma siparişi yok.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {data.orders.map((order) => (
        <PurchaseOrderCard
          key={order.id}
          order={order}
          pending={mutation.isPending}
          onSubmit={(input) => mutation.mutate({ purchaseOrderId: order.id, ...input })}
        />
      ))}
    </div>
  );
}

function PurchaseOrderCard({
  order,
  pending,
  onSubmit,
}: {
  order: Workflow["orders"][number];
  pending: boolean;
  onSubmit: (input: {
    supplierStatus: "accepted" | "preparing" | "shipped" | "rejected";
    carrier?: string;
    trackingNumber?: string;
  }) => void;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const closed =
    order.status === "cancelled" ||
    order.status === "received" ||
    order.supplierStatus === "rejected";
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{order.code}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(order.createdAt)}
            {order.expectedAt ? ` · Termin ${formatDate(order.expectedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">
            {order.status === "received"
              ? "Teslim alındı"
              : order.status === "cancelled"
                ? "İptal"
                : PO_SUPPLIER_STATUS_LABEL[order.supplierStatus]}
          </Badge>
          <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"}>
            {PO_PAYMENT_LABEL[order.paymentStatus]}
          </Badge>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-2 py-2">
            <span className="min-w-0">
              {item.title} <span className="text-muted-foreground">{item.sku ?? ""}</span>
            </span>
            <span className="shrink-0">
              {item.quantity} × {formatMoney(item.unitCost, order.currency)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Toplam: <strong>{formatMoney(order.total, order.currency)}</strong>
      </p>
      {order.note ? <p className="text-sm text-muted-foreground">{order.note}</p> : null}
      {closed ? null : (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Kargo firması</Label>
            <Input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Yurtiçi Kargo"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Takip numarası</Label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {order.supplierStatus === "new" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onSubmit({ supplierStatus: "accepted" })}
              >
                Kabul et
              </Button>
            ) : null}
            {order.supplierStatus === "accepted" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onSubmit({ supplierStatus: "preparing" })}
              >
                Hazırlanıyor
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={pending || !tracking}
              onClick={() =>
                onSubmit({ supplierStatus: "shipped", carrier, trackingNumber: tracking })
              }
            >
              Kargoya ver
            </Button>
            {order.supplierStatus === "new" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onSubmit({ supplierStatus: "rejected" })}
              >
                Reddet
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

/** Mağaza ile mesajlaşma. */
export function SupplierMessages({ supplierId, data }: { supplierId: string; data: Workflow }) {
  const refresh = useRefresh(supplierId);
  const send = useServerFn(supplierSendMessage);
  const markRead = useServerFn(supplierMarkMessagesRead);
  const [body, setBody] = useState("");
  useEffect(() => {
    if (data.unread > 0) void markRead({ data: { supplierId } }).then(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.unread, supplierId]);
  const mutation = useMutation({
    mutationFn: () => send({ data: { supplierId, body } }),
    onSuccess: () => {
      setBody("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">Mağaza ile mesajlar</h2>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {data.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz mesaj yok.</p>
        ) : null}
        {data.messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-lg p-3 text-sm ${m.senderRole === "supplier" ? "ml-auto bg-primary text-primary-foreground" : m.senderRole === "admin" ? "mx-auto bg-muted text-muted-foreground" : "bg-muted"}`}
          >
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="mt-1 text-[10px] opacity-70">{formatDate(m.createdAt)}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mağazaya mesaj yazın"
        />
        <Button disabled={!body.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          Gönder
        </Button>
      </div>
    </section>
  );
}

/** Tedarikçinin XML ürün beslemeleri. */
export function SupplierXmlFeeds({ supplierId, data }: { supplierId: string; data: Workflow }) {
  const refresh = useRefresh(supplierId);
  const save = useServerFn(supplierSaveFeed);
  const run = useServerFn(supplierRunFeed);
  const recover = useServerFn(supplierRecoverFeed);
  const recoverMutation = useMutation({
    mutationFn: (feedId: string) => recover({ data: { supplierId, feedId } }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useServerFn(supplierDeleteFeed);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [markup, setMarkup] = useState("");
  const setFeedMarkup = useServerFn(supplierSetFeedMarkup);
  const markupMutation = useMutation({
    mutationFn: (v: { feedId: string; markupPercent: number }) =>
      setFeedMarkup({ data: { supplierId, ...v } }),
    onSuccess: () => {
      toast.success("Kâr oranı kaydedildi; bir sonraki eşitlemede satış fiyatları güncellenir");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const created = await save({
        data: {
          supplierId,
          name,
          sourceUrl: url,
          markupPercent: Math.max(0, Number(markup.replace(",", ".")) || 0),
        },
      });
      if (created.error || !created.stats)
        throw new Error(`Besleme eklendi ama yüklenemedi: ${created.error ?? "bilinmeyen hata"}`);
      return created.stats;
    },
    onSuccess: (r) => {
      toast.success(`XML aktarıldı: ${r.created} yeni, ${r.updated} güncellendi`);
      setName("");
      setUrl("");
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });
  const runMutation = useMutation({
    mutationFn: (feedId: string) => run({ data: { supplierId, feedId } }),
    onSuccess: (r) => {
      toast.success(`${r.created} yeni, ${r.updated} güncellendi, ${r.skipped} atlandı`);
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (feedId: string) => remove({ data: { supplierId, feedId } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-medium">XML entegratör</h2>
        <p className="text-sm text-muted-foreground">
          Ürün XML bağlantınızı ekleyin; stok kodu, ad, alış fiyatı, stok, açıklama ve tüm görseller
          otomatik eşleştirilip mağazaya aktarılır.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_8rem_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Besleme adı</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana katalog" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">XML adresi</Label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ornek.com/urunler.xml"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Satış kâr oranı (%)</Label>
          <Input
            inputMode="decimal"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            placeholder="ör. 30"
          />
        </div>
        <Button
          disabled={saveMutation.isPending || name.length < 2 || !url}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "Aktarılıyor…" : "Ekle ve aktar"}
        </Button>
      </div>
      <ul className="divide-y">
        {data.feeds.map((feed) => (
          <li key={feed.id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{feed.name}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={runMutation.isPending || feed.lastStatus === "running"}
                  onClick={() => runMutation.mutate(feed.id)}
                >
                  {(feed.stats.remaining ?? 0) > 0 ? "Kaldığı yerden devam et" : "Şimdi eşitle"}
                </Button>
                {feed.lastStatus === "running" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={recoverMutation.isPending}
                    onClick={() => recoverMutation.mutate(feed.id)}
                  >
                    Kesilen işi yeniden aç
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(feed.id)}
                >
                  Sil
                </Button>
              </div>
            </div>
            <p className="break-all text-xs text-muted-foreground">{feed.sourceUrl}</p>
            <form
              className="flex items-center gap-2 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const value = Number(
                  String(new FormData(e.currentTarget).get("markup") ?? "").replace(",", "."),
                );
                if (Number.isFinite(value) && value >= 0)
                  markupMutation.mutate({ feedId: feed.id, markupPercent: value });
              }}
            >
              <Label htmlFor={`markup-${feed.id}`} className="text-xs text-muted-foreground">
                Mağaza satış fiyatı = alış fiyatı +
              </Label>
              <Input
                id={`markup-${feed.id}`}
                name="markup"
                inputMode="decimal"
                defaultValue={feed.markupPercent || ""}
                placeholder="0"
                className="h-8 w-20"
              />
              <span>%</span>
              <Button type="submit" size="sm" variant="outline" disabled={markupMutation.isPending}>
                Kaydet
              </Button>
            </form>
            <div
              className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs sm:grid-cols-4"
              role="status"
            >
              <div>
                Durum:{" "}
                {feed.lastStatus === "running"
                  ? "Çalışıyor"
                  : feed.lastStatus === "partial"
                    ? "Kısmen tamamlandı"
                    : feed.lastStatus === "success"
                      ? "Tamamlandı"
                      : feed.lastStatus === "failed"
                        ? "Başarısız"
                        : "Henüz çalışmadı"}
              </div>
              <div>
                İşlenen: {feed.stats.processed ?? "—"} / {feed.stats.totalRows ?? "—"}
              </div>
              <div>Kalan: {feed.stats.remaining ?? "—"}</div>
              <div>Devam noktası: {feed.stats.nextOffset ?? "—"}</div>
              <div>
                Son başarı: {feed.stats.lastSuccessAt ? formatDate(feed.stats.lastSuccessAt) : "—"}
              </div>
              <div>Eksik alan: {feed.stats.failedFields ?? "—"}</div>
              <div>Güncelleme hatası: {feed.stats.failedUpdates ?? "—"}</div>
              <div>Mağazaya aktarılan: {feed.stats.autoImported ?? "—"}</div>
              <div>Aktarım bekleyen: {feed.stats.autoRemaining ?? "—"}</div>
            </div>
            {feed.stats.syncError ? (
              <p role="alert" className="text-xs text-destructive">
                Mağaza eşitlemesi: {feed.stats.syncError}
              </p>
            ) : null}
            {(feed.stats.autoRemaining ?? 0) > 0 ? (
              <p className="text-xs text-muted-foreground">
                Otomatik aktarım her çalışmada en fazla 200 ürün işler. Kalan ürünler sonraki
                eşitlemede işlenir; tamamlanmış sayılmaz.
              </p>
            ) : null}
            {(feed.stats.remaining ?? 0) > 0 ? (
              <p className="text-xs text-muted-foreground">
                Kaynak 200 kayıtlık parçalarla işlenir. Kaynak içeriği değişmediyse sonraki parça
                kaldığı yerden sürer; değiştiyse yeni tarama başlar.
              </p>
            ) : null}
            {feed.lastStatus === "partial" || feed.lastStatus === "failed" ? (
              <p className="text-xs text-muted-foreground">
                Tekrar deneme manuel yapılır. Aynı stok kodu mevcut kaydı günceller.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {feed.lastRunAt ? `${formatDate(feed.lastRunAt)} · ` : "Henüz çalışmadı"}
              {feed.lastStatus === "success"
                ? `${feed.stats.totalRows ?? 0} satır, ${feed.stats.created ?? 0} yeni, ${feed.stats.updated ?? 0} güncellendi`
                : null}
              {feed.lastStatus === "failed" ? (
                <span className="text-destructive">Hata: {feed.lastError}</span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** iyzico / PayTR üye işyeri bilgisi: mağaza siparişi bu hesaptan kartla öder. */
export function SupplierPaymentSettings({
  supplierId,
  data,
}: {
  supplierId: string;
  data: Workflow;
}) {
  const refresh = useRefresh(supplierId);
  const save = useServerFn(supplierSavePaymentSettings);
  const [provider, setProvider] = useState<"iyzico" | "paytr">(data.payment?.provider ?? "iyzico");
  const [f, setF] = useState({ a: "", b: "", c: "" });
  const [test, setTest] = useState(data.payment?.test ?? true);
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data:
          provider === "iyzico"
            ? { provider, supplierId, apiKey: f.a, secretKey: f.b, test }
            : { provider, supplierId, merchantId: f.a, merchantKey: f.b, merchantSalt: f.c, test },
      }),
    onSuccess: () => {
      toast.success("Ödeme hesabı kaydedildi");
      setF({ a: "", b: "", c: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const origin = typeof window === "undefined" ? "https://mefticaret.com" : window.location.origin;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-medium">Ödeme al (iyzico / PayTR)</h2>
        <p className="text-sm text-muted-foreground">
          {data.payment
            ? `Kayıtlı: ${data.payment.provider === "iyzico" ? "iyzico" : "PayTR"}${data.payment.test ? " (test)" : ""}. `
            : "Henüz ödeme hesabı yok. "}
          Mağaza satın alma siparişinizi kendi üye işyeri hesabınıza kartla öder. Anahtarlar geri
          gösterilmez.
        </p>
      </div>
      <div className="flex gap-2">
        {(["iyzico", "paytr"] as const).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={provider === p ? "default" : "outline"}
            onClick={() => setProvider(p)}
          >
            {p === "iyzico" ? "iyzico" : "PayTR"}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          placeholder={provider === "iyzico" ? "API anahtarı" : "Mağaza no (merchant_id)"}
          value={f.a}
          onChange={(e) => setF({ ...f, a: e.target.value })}
        />
        <Input
          type="password"
          placeholder={provider === "iyzico" ? "Gizli anahtar" : "merchant_key"}
          value={f.b}
          onChange={(e) => setF({ ...f, b: e.target.value })}
        />
        {provider === "paytr" ? (
          <Input
            type="password"
            placeholder="merchant_salt"
            value={f.c}
            onChange={(e) => setF({ ...f, c: e.target.value })}
          />
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /> Test
        modu
      </label>
      {provider === "paytr" ? (
        <p className="break-all text-xs text-muted-foreground">
          PayTR panelinde bildirim adresi: {origin}/api/public/pay/supplier-paytr
        </p>
      ) : null}
      <Button
        disabled={mutation.isPending || !f.a || !f.b || (provider === "paytr" && !f.c)}
        onClick={() => mutation.mutate()}
      >
        Kaydet
      </Button>
    </section>
  );
}
