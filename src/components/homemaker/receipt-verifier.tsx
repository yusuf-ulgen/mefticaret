import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ReceiptText, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BigButton, SoftCard } from "@/components/homemaker/kolay-parts";
import { verifyPaymentReceipt } from "@/lib/kolay-v8.functions";
import { formatMoney } from "@/lib/mefti";

type SimpleOrder = {
  id: string;
  order_number: string;
  customer_name: string | null;
  grand_total: number;
  currency: string;
  payment_status: string;
};

async function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

/**
 * Havale/EFT siparişlerinde müşterinin gönderdiği dekont fotoğrafını yapay
 * zekâya okutur; tutar uyuşursa sipariş "ödendi" olarak işaretlenir.
 */
export function ReceiptVerifier({
  storeId,
  orders,
  currency,
}: {
  storeId: string;
  orders: SimpleOrder[];
  currency: string;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyPaymentReceipt);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; notes: string } | null>(null);

  const waiting = orders.filter((order) => order.payment_status !== "paid");
  if (waiting.length === 0) return null;

  const selected = waiting.find((order) => order.id === orderId) ?? null;

  const upload = async (file: File) => {
    if (!selected) {
      toast.error("Önce siparişi seçin");
      return;
    }
    if (file.size > 6_000_000) {
      toast.error("Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const imageDataUrl = await toDataUrl(file);
      const outcome = await verify({ data: { storeId, orderId: selected.id, imageDataUrl } });
      setResult({ status: outcome.status, notes: outcome.notes });
      if (outcome.status === "matched") {
        await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
        toast.success("Ödeme alındı olarak işaretlendi");
      } else {
        toast.warning("Dekont doğrulanamadı");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dekont okunamadı");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SoftCard className="grid gap-3">
      <div className="flex items-center gap-2">
        <ReceiptText className="size-5 text-hm-teal" />
        <h2 className="text-base font-bold">Dekont kontrolü</h2>
      </div>
      <p className="text-xs text-hm-ink-soft">
        Havale ile ödeyen müşterinizin gönderdiği dekontu yükleyin. Tutar siparişle aynıysa ödeme
        otomatik “alındı” olur.
      </p>

      <label className="block">
        <span className="text-sm font-semibold">Sipariş</span>
        <select
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          className="mt-1.5 min-h-12 w-full rounded-2xl border border-hm-line bg-hm-sand px-3 text-base"
        >
          <option value="">Seçiniz…</option>
          {waiting.map((order) => (
            <option key={order.id} value={order.id}>
              #{order.order_number} · {order.customer_name ?? "Müşteri"} ·{" "}
              {formatMoney(Number(order.grand_total), order.currency ?? currency)}
            </option>
          ))}
        </select>
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <BigButton
        tone="teal"
        disabled={busy || !selected}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        Dekont fotoğrafı yükle
      </BigButton>

      {result ? (
        <div
          className={`flex items-start gap-2 rounded-2xl p-3 text-sm ${
            result.status === "matched"
              ? "bg-hm-emerald-soft text-hm-emerald"
              : "bg-hm-rose-soft text-hm-rose"
          }`}
        >
          {result.status === "matched" ? (
            <CheckCircle2 className="size-5 shrink-0" />
          ) : (
            <TriangleAlert className="size-5 shrink-0" />
          )}
          <p>{result.notes}</p>
        </div>
      ) : null}
    </SoftCard>
  );
}
