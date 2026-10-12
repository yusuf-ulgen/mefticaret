import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ReceiptText, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BigButton, SoftCard } from "@/components/homemaker/kolay-parts";
import { reviewPaymentReceipt, verifyPaymentReceipt } from "@/lib/kolay-v8.functions";
import { formatMoney } from "@/lib/mefti";

type SimpleOrder = {
  id: string;
  order_number: string;
  customer_name: string | null;
  grand_total: number;
  currency: string;
  payment_status: string;
  status?: string;
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
 * zekâya okutur; banka tahsilatını doğrulayan satıcı ayrıca onaylar.
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
  const review = useServerFn(reviewPaymentReceipt);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; notes: string; checkId: string } | null>(
    null,
  );
  const [bankReference, setBankReference] = useState("");
  const [bankConfirmed, setBankConfirmed] = useState(false);

  const waiting = orders.filter(
    (order) =>
      order.payment_status === "pending" &&
      !["cancelled", "returned", "refunded"].includes(order.status ?? ""),
  );
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
    setBankReference("");
    setBankConfirmed(false);
    try {
      const imageDataUrl = await toDataUrl(file);
      const outcome = await verify({ data: { storeId, orderId: selected.id, imageDataUrl } });
      setResult({ status: outcome.status, notes: outcome.notes, checkId: outcome.checkId });
      if (outcome.status === "pending_review") {
        toast.info("Dekont inceleme bekliyor");
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

  const decide = async (approve: boolean) => {
    if (!result || (approve && (!bankConfirmed || bankReference.trim().length < 3))) return;
    setBusy(true);
    try {
      const outcome = await review({
        data: { storeId, checkId: result.checkId, approve, bankReference },
      });
      setResult({
        ...result,
        status: outcome.status,
        notes:
          outcome.status === "approved"
            ? "Tahsilat manuel onaylandı."
            : "Dekont reddedildi; ödeme durumu değişmedi.",
      });
      await queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
      toast.success(outcome.status === "approved" ? "Tahsilat onaylandı" : "Dekont reddedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İnceleme kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SoftCard className="grid gap-3">
      <div className="flex items-center gap-2">
        <ReceiptText className="size-5 text-hm-teal" />
        <h2 className="text-base font-bold">Dekont kontrolü</h2>
      </div>
      <p className="text-xs text-hm-ink-soft">
        Dekontu yükleyin. Okuma sonucu inceleme önerisidir. Ödemeyi onaylamadan önce banka
        hareketinde tutarı, para birimini ve alıcı hesabı doğrulayın.
      </p>

      <label className="block">
        <span className="text-sm font-semibold">Sipariş</span>
        <select
          value={orderId}
          disabled={busy}
          onChange={(event) => {
            setOrderId(event.target.value);
            setResult(null);
            setBankConfirmed(false);
            setBankReference("");
          }}
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

      <BigButton tone="teal" disabled={busy || !selected} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        Dekont fotoğrafı yükle
      </BigButton>

      {result ? (
        <div
          className={`flex items-start gap-2 rounded-2xl p-3 text-sm ${
            result.status === "approved"
              ? "bg-hm-emerald-soft text-hm-emerald"
              : "bg-hm-rose-soft text-hm-rose"
          }`}
        >
          {result.status === "approved" ? (
            <CheckCircle2 className="size-5 shrink-0" />
          ) : (
            <TriangleAlert className="size-5 shrink-0" />
          )}
          <p>{result.notes}</p>
        </div>
      ) : null}
      {result?.status === "pending_review" ? (
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            Banka işlem referansı
            <input
              className="rounded-xl border p-3"
              value={bankReference}
              maxLength={160}
              onChange={(e) => setBankReference(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={bankConfirmed}
              onChange={(e) => setBankConfirmed(e.target.checked)}
            />
            Banka hesabındaki tahsilatı, tutarı, para birimini ve alıcı hesabı kontrol ettim.
          </label>
          <BigButton
            tone="emerald"
            disabled={busy || !bankConfirmed || bankReference.trim().length < 3}
            onClick={() => void decide(true)}
          >
            Tahsilatı onayla
          </BigButton>
          <BigButton tone="ghost" disabled={busy} onClick={() => void decide(false)}>
            Dekontu reddet
          </BigButton>
        </div>
      ) : null}
    </SoftCard>
  );
}
