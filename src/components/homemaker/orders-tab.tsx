import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Banknote,
  Check,
  Copy,
  CreditCard,
  Handshake,
  Loader2,
  MessageCircle,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DelegateSheet } from "@/components/homemaker/delegate-sheet";
import { BigButton, Sheet, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { ManualOrderSheet } from "@/components/homemaker/manual-order-sheet";
import { refreshArasTracking, sendOrderToAras } from "@/lib/aras.functions";
import { createPickupCode } from "@/lib/homemaker.functions";
import type { SimpleOrder, SimpleProduct } from "@/lib/homemaker-queries";
import { delegationsQuery } from "@/lib/kolay-v4-queries";
import { formatMoney } from "@/lib/mefti";
import { startOrderPayment } from "@/lib/order-payment.functions";
import { updateOrder } from "@/lib/sales.functions";

type Bucket = "new" | "toShip" | "done";

const BUCKET_LABELS: Record<Bucket, string> = {
  new: "Yeni siparişler",
  toShip: "Kargolanacaklar",
  done: "Tamamlananlar",
};

function bucketOf(order: SimpleOrder): Bucket {
  if (["delivered", "cancelled", "returned", "refunded"].includes(order.status)) return "done";
  if (["shipped", "packed"].includes(order.status)) return "toShip";
  return "new";
}

function addressText(order: SimpleOrder) {
  const address = order.shipping_address ?? {};
  const parts = [
    address["line1"],
    address["line2"],
    address["district"],
    address["city"],
    address["postal_code"],
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts.join(", ");
}

/** "Siparişlerim" sekmesi: üç basit aşama, WhatsApp ve teslim kodu. */
export function OrdersTab({
  storeId,
  storeSlug,
  orders,
  products = [],
  currency = "TRY",
}: {
  storeId: string;
  storeSlug?: string;
  orders: SimpleOrder[];
  products?: SimpleProduct[];
  currency?: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Bucket>("new");
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const makeCode = useServerFn(createPickupCode);
  const patchOrder = useServerFn(updateOrder);
  const sendToAras = useServerFn(sendOrderToAras);
  const refreshTracking = useServerFn(refreshArasTracking);
  const payLink = useServerFn(startOrderPayment);
  const [syncing, setSyncing] = useState(false);
  const [delegate, setDelegate] = useState<SimpleOrder | null>(null);
  const [collecting, setCollecting] = useState<SimpleOrder | null>(null);
  const [manualSource, setManualSource] = useState<"whatsapp" | "phone" | null>(null);
  const { data: delegations } = useQuery(delegationsQuery(storeId));

  /** Müşteriye kartla ödeme bağlantısı üretir (tutar sunucuda siparişten okunur). */
  const sendPaymentLink = async (order: SimpleOrder) => {
    if (!storeSlug) return;
    if (!order.customer_email) {
      toast.error("Kart bağlantısı için siparişte e-posta adresi olmalı.");
      return;
    }
    setBusy(order.id);
    try {
      const result = await payLink({
        data: { slug: storeSlug, orderNumber: order.order_number, email: order.customer_email },
      });
      const digits = (order.customer_phone ?? "").replace(/\D/g, "");
      const waPhone = digits.startsWith("90") ? digits : `90${digits.replace(/^0/, "")}`;
      const text = `${order.order_number} numaralı siparişinizin ödemesini banka veya kredi kartıyla buradan yapabilirsiniz: ${result.link}`;
      await navigator.clipboard.writeText(result.link).catch(() => {});
      if (digits.length >= 10) {
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, "_blank");
      }
      toast.success("Kartla ödeme bağlantısı hazır ve kopyalandı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ödeme bağlantısı oluşturulamadı");
    } finally {
      setBusy(null);
    }
  };

  const delegationOf = (orderId: string) =>
    (delegations ?? []).find(
      (row) => row.order_id === orderId && (row.status === "pending" || row.status === "accepted"),
    );

  const shipWithAras = async (order: SimpleOrder) => {
    setBusy(order.id);
    try {
      const result = await sendToAras({ data: { orderId: order.id } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      toast.success(
        result.trackingNumber
          ? `Aras Kargo takip numarası: ${result.trackingNumber}`
          : "Aras Kargo'ya iletildi. Takip numarası birkaç dakika içinde gelir.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kargo oluşturulamadı");
    } finally {
      setBusy(null);
    }
  };

  const syncAras = async () => {
    setSyncing(true);
    try {
      const result = await refreshTracking({ data: { storeId } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      toast.success(
        result.updated > 0
          ? `${result.updated} gönderinin durumu güncellendi`
          : "Kargo durumlarında değişiklik yok",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Durum sorgulanamadı");
    } finally {
      setSyncing(false);
    }
  };

  const term = search.trim().toLocaleLowerCase("tr");
  const rows = orders.filter((order) => {
    if (bucketOf(order) !== tab) return false;
    if (!term) return true;
    const haystack = [order.customer_name, order.order_number, order.customer_phone]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("tr");
    return haystack.includes(term);
  });

  const todayKey = new Date().toDateString();
  const todayOrders = orders.filter(
    (order) => order.placed_at && new Date(order.placed_at).toDateString() === todayKey,
  );
  const todayTotal = todayOrders.reduce((sum, order) => sum + (order.grand_total ?? 0), 0);
  const unpaidCount = orders.filter(
    (order) => bucketOf(order) !== "done" && order.payment_status !== "paid",
  ).length;


  const createCode = async (order: SimpleOrder) => {
    setBusy(order.id);
    try {
      const result = await makeCode({ data: { orderId: order.id } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      toast.success(`Teslim kodu: ${result.code}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kod oluşturulamadı");
    } finally {
      setBusy(null);
    }
  };

  /** Kapıda nakit/kart veya havale ile alınan tahsilatı işaretler; tutar siparişten gelir. */
  const collect = async (order: SimpleOrder, method: string) => {
    setBusy(order.id);
    try {
      await patchOrder({
        data: {
          orderId: order.id,
          patch: {
            payment_status: "paid",
            note: [order.note ?? "", `Ödeme alındı: ${method}`].filter(Boolean).join("\n"),
          },
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-finance", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-finance-detail", storeId] }),
      ]);
      setCollecting(null);
      toast.success(`${method} ile ödeme alındı olarak işaretlendi`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşaretlenemedi");
    } finally {
      setBusy(null);
    }
  };

  const complete = async (order: SimpleOrder) => {
    setBusy(order.id);
    try {
      await patchOrder({ data: { orderId: order.id, patch: { status: "delivered" } } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      toast.success("Sipariş tamamlandı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Güncellenemedi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        <SoftCard className="text-center">
          <p className="text-xs text-hm-ink-soft">Bugün</p>
          <p className="text-lg font-bold text-hm-ink">{todayOrders.length}</p>
        </SoftCard>
        <SoftCard className="text-center">
          <p className="text-xs text-hm-ink-soft">Bugünkü tutar</p>
          <p className="text-lg font-bold text-hm-rose">
            {formatMoney(todayTotal, orders[0]?.currency ?? "TRY")}
          </p>
        </SoftCard>
        <SoftCard className="text-center">
          <p className="text-xs text-hm-ink-soft">Ödeme bekliyor</p>
          <p className="text-lg font-bold text-hm-amber">{unpaidCount}</p>
        </SoftCard>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BigButton tone="emerald" onClick={() => setManualSource("whatsapp")}>
          <MessageCircle className="size-4" /> WhatsApp siparişi
        </BigButton>
        <BigButton tone="teal" onClick={() => setManualSource("phone")}>
          <Phone className="size-4" /> Telefon siparişi
        </BigButton>
      </div>
      <p className="-mt-2 flex items-center gap-1.5 text-xs text-hm-ink-soft">
        <Plus className="size-3.5" /> WhatsApp veya telefonla gelen siparişleri buradan ekleyin,
        listeye ve kazancınıza otomatik işlenir.
      </p>


      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Müşteri adı, telefon veya sipariş no ara"
          className={`${inputClass} pl-11`}
        />
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-3xl border border-hm-line bg-white p-1.5">

        {(Object.keys(BUCKET_LABELS) as Bucket[]).map((key) => {
          const count = orders.filter((order) => bucketOf(order) === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-12 rounded-2xl px-2 text-sm font-semibold transition-colors ${
                tab === key ? "bg-hm-rose text-white" : "text-hm-ink-soft"
              }`}
            >
              {BUCKET_LABELS[key]}
              {count ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void syncAras()}
        disabled={syncing}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-hm-line bg-white text-sm font-semibold text-hm-ink-soft"
      >
        {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Kargo durumlarını güncelle
      </button>

      {rows.length === 0 ? (
        <SoftCard className="text-center">
          <p className="font-semibold text-hm-ink">Burada sipariş yok</p>
          <p className="mt-1 text-sm text-hm-ink-soft">
            Mağaza bağlantınızı paylaşarak ilk siparişinizi alabilirsiniz.
          </p>
        </SoftCard>
      ) : (
        rows.map((order) => {
          const phone = (order.customer_phone ?? "").replace(/\D/g, "");
          const waPhone = phone.startsWith("90") ? phone : `90${phone.replace(/^0/, "")}`;
          const isAras = order.shipping_carrier === "Aras Kargo";
          return (
            <SoftCard key={order.id} className="grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-hm-ink">{order.customer_name ?? "Müşteri"}</p>
                  <p className="text-xs text-hm-ink-soft">
                    #{order.order_number}
                    {order.placed_at
                      ? ` · ${new Date(order.placed_at).toLocaleDateString("tr-TR")}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-hm-rose">
                    {formatMoney(order.grand_total, order.currency)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                      order.payment_status === "paid"
                        ? "bg-hm-teal-soft text-hm-teal"
                        : "bg-hm-sand text-hm-ink-soft"
                    }`}
                  >
                    {order.payment_status === "paid"
                      ? "Ödeme alındı"
                      : order.payment_status === "refunded" ||
                          order.payment_status === "partially_refunded"
                        ? "İade edildi"
                        : order.payment_status === "failed"
                          ? "Ödeme başarısız"
                          : "Ödeme bekliyor"}
                  </span>
                </div>
              </div>

              {delegationOf(order.id) ? (
                <p className="flex items-center gap-2 rounded-2xl bg-hm-amber-soft px-3 py-2 text-sm font-semibold text-hm-amber">
                  <Handshake className="size-4 shrink-0" />
                  {delegationOf(order.id)?.status === "accepted"
                    ? "Komşu mağaza bu siparişi üstlendi."
                    : "Komşu mağazanın onayı bekleniyor."}
                </p>
              ) : null}

              <ul className="grid gap-1 rounded-2xl bg-hm-sand p-3 text-sm text-hm-ink">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.title}
                    {item.variant_title ? ` (${item.variant_title})` : ""}
                  </li>
                ))}
              </ul>

              {addressText(order) ? (
                <p className="text-sm text-hm-ink-soft">{addressText(order)}</p>
              ) : null}
              {order.customer_phone ? (
                <p className="text-sm text-hm-ink-soft">{order.customer_phone}</p>
              ) : null}

              {order.tracking_number ? (
                <div className="grid gap-2 rounded-2xl bg-hm-teal-soft p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-hm-teal">
                      {isAras ? "Aras Kargo takip no" : "Teslim kodu"}: {order.tracking_number}
                    </span>
                    <button
                      type="button"
                      aria-label="Kodu kopyala"
                      onClick={() => {
                        void navigator.clipboard.writeText(order.tracking_number ?? "");
                        toast.success("Kopyalandı");
                      }}
                      className="ml-auto grid size-10 place-items-center rounded-xl bg-white text-hm-teal"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                  {isAras ? (
                    <a
                      href={`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(
                        order.tracking_number,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-hm-teal underline"
                    >
                      Aras Kargo'da takip et
                    </a>
                  ) : null}
                </div>
              ) : isAras ? (
                <p className="rounded-2xl bg-hm-teal-soft p-3 text-sm font-semibold text-hm-teal">
                  Aras Kargo'ya iletildi, takip numarası bekleniyor.
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {phone ? (
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                      `Merhaba ${order.customer_name ?? ""}, ${order.order_number} numaralı siparişiniz hakkında yazıyorum.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-hm-emerald px-4 text-sm font-semibold text-white"
                  >
                    <MessageCircle className="size-4" /> WhatsApp'tan yaz
                  </a>
                ) : null}
                {order.payment_status !== "paid" ? (
                  <BigButton
                    tone="emerald"
                    disabled={busy === order.id}
                    onClick={() => setCollecting(order)}
                  >
                    <Banknote className="size-4" /> Ödemeyi aldım
                  </BigButton>
                ) : null}
                {tab !== "done" && !isAras && !order.tracking_number ? (
                  <BigButton
                    tone="teal"
                    disabled={busy === order.id}
                    onClick={() => void shipWithAras(order)}
                  >
                    {busy === order.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PackageCheck className="size-4" />
                    )}
                    Aras Kargo ile gönder
                  </BigButton>
                ) : null}
                {tab !== "done" && !isAras && !order.tracking_number ? (
                  <BigButton
                    tone="ghost"
                    disabled={busy === order.id}
                    onClick={() => void createCode(order)}
                  >
                    <Truck className="size-4" /> Kendim teslim edeceğim
                  </BigButton>
                ) : null}
                {tab !== "done" ? (
                  <BigButton
                    tone="ghost"
                    disabled={busy === order.id}
                    onClick={() => void complete(order)}
                  >
                    <Check className="size-4" /> Tamamlandı
                  </BigButton>
                ) : null}
                {tab !== "done" && !delegationOf(order.id) ? (
                  <BigButton tone="ghost" onClick={() => setDelegate(order)}>
                    <Handshake className="size-4" /> Siparişi komşuya devret
                  </BigButton>
                ) : null}
              </div>
            </SoftCard>
          );
        })
      )}

      <Sheet
        open={Boolean(collecting)}
        title="Ödemeyi nasıl aldınız?"
        onClose={() => setCollecting(null)}
      >
        {collecting ? (
          <div className="grid gap-3">
            <p className="rounded-2xl bg-hm-sand px-4 py-3 text-sm text-hm-ink-soft">
              #{collecting.order_number} · {formatMoney(collecting.grand_total, collecting.currency)}
            </p>
            {["Kapıda nakit", "Kapıda kart", "Havale / EFT", "WhatsApp dekontu"].map((method) => (
              <BigButton
                key={method}
                tone="ghost"
                disabled={busy === collecting.id}
                onClick={() => void collect(collecting, method)}
              >
                <Banknote className="size-4" /> {method}
              </BigButton>
            ))}
            <p className="text-xs text-hm-ink-soft">
              İşaretlediğiniz tutar kazancınıza ve çekilebilir bakiyenize eklenir.
            </p>
          </div>
        ) : null}
      </Sheet>

      <DelegateSheet order={delegate} onClose={() => setDelegate(null)} storeId={storeId} />
    </div>
  );
}
