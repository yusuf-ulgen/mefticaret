import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Banknote, Clock, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Sheet, inputClass } from "@/components/homemaker/kolay-parts";
import {
  kolayFinanceDetailQuery,
  kolayPayoutsQuery,
  type PayoutRequestRow,
} from "@/lib/kolay-finance-queries";
import { requestKolayPayout } from "@/lib/kolay-finance.functions";
import { formatMoney } from "@/lib/mefti";
import { storeSettingsQuery } from "@/lib/store-queries";

const STATUS_LABEL: Record<string, string> = {
  pending: "Sırada",
  approved: "Onaylandı",
  processing: "Gönderiliyor",
  paid: "Hesabınıza geçti",
  rejected: "Reddedildi",
};

function statusTone(status: string) {
  if (status === "paid") return "bg-hm-emerald-soft text-hm-emerald";
  if (status === "rejected") return "bg-hm-rose-soft text-hm-rose";
  return "bg-hm-amber-soft text-hm-amber";
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${tone}`}>
      <p className="text-[11px] font-semibold opacity-80">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

/** Kazanç ayrıntısı: son 14 gün, hafta/ay toplamı, kısmi aktarım ve talep geçmişi. */
export function EarningsSheet({
  open,
  onClose,
  storeId,
}: {
  open: boolean;
  onClose: () => void;
  storeId: string;
}) {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ ...kolayFinanceDetailQuery(storeId), enabled: open });
  const { data: payouts } = useQuery({ ...kolayPayoutsQuery(storeId), enabled: open });
  const { data: settings } = useQuery({ ...storeSettingsQuery(storeId), enabled: open });
  const askPayout = useServerFn(requestKolayPayout);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const currency = data?.currency ?? "TRY";
  const withdrawable = data?.withdrawable ?? 0;
  const iban = (settings as { bank_iban?: string | null } | null)?.bank_iban ?? "";
  const max = Math.max(...(data?.days ?? []).map((day) => day.amount), 1);

  const transfer = async () => {
    const value = amount.trim() ? Number(amount.replace(",", ".")) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      toast.error("Geçerli bir tutar yazın");
      return;
    }
    setBusy(true);
    try {
      await askPayout({ data: { storeId, ...(value !== undefined ? { amount: value } : {}) } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kolay-finance", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-finance-detail", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["kolay-payouts", storeId] }),
      ]);
      setAmount("");
      toast.success("Aktarım talebiniz alındı. Ertesi gün hesabınıza geçer.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Talep oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} title="Kazancım" onClose={onClose}>
      {isPending ? (
        <div className="grid min-h-40 place-items-center text-sm text-hm-ink-soft">
          Kazancınız hesaplanıyor…
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <StatBox
              label="Bugün"
              value={formatMoney(data?.today ?? 0, currency)}
              tone="bg-hm-emerald-soft text-hm-emerald"
            />
            <StatBox
              label="Bu hafta"
              value={formatMoney(data?.week ?? 0, currency)}
              tone="bg-hm-teal-soft text-hm-teal"
            />
            <StatBox
              label="Bu ay"
              value={formatMoney(data?.month ?? 0, currency)}
              tone="bg-hm-amber-soft text-hm-amber"
            />
            <StatBox
              label="Çekilebilir bakiye"
              value={formatMoney(withdrawable, currency)}
              tone="bg-hm-sand text-hm-ink"
            />
          </div>

          <section className="rounded-3xl border border-hm-line bg-white p-4">
            <p className="text-sm font-semibold text-hm-ink">Son 14 gün</p>
            <div className="mt-3 flex h-28 items-end gap-1">
              {(data?.days ?? []).map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    title={`${day.label}: ${formatMoney(day.amount, currency)}`}
                    className="w-full rounded-t-md bg-hm-teal"
                    style={{ height: `${Math.max(3, (day.amount / max) * 88)}px` }}
                  />
                  <span className="text-[9px] text-hm-ink-soft">{day.label.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </section>

          {(data?.awaitingCount ?? 0) > 0 ? (
            <div className="flex items-center gap-2 rounded-3xl bg-hm-amber-soft px-4 py-3 text-sm font-semibold text-hm-amber">
              <Clock className="size-5 shrink-0" />
              {data?.awaitingCount} siparişte {formatMoney(data?.awaiting ?? 0, currency)} tahsil
              edilmeyi bekliyor.
            </div>
          ) : null}

          {!iban ? (
            <div className="flex items-center gap-2 rounded-3xl bg-hm-rose-soft px-4 py-3 text-sm font-semibold text-hm-rose">
              <AlertTriangle className="size-5 shrink-0" />
              Para gönderebilmemiz için Mağazam sekmesine IBAN bilgilerinizi yazın.
            </div>
          ) : null}

          <section className="grid gap-2 rounded-3xl border border-hm-line bg-white p-4">
            <p className="text-sm font-semibold text-hm-ink">Hesabıma aktar</p>
            <p className="text-xs text-hm-ink-soft">
              Boş bırakırsanız çekilebilir bakiyenizin tamamı için talep açılır.
            </p>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder={`Tutar (en fazla ${withdrawable})`}
              className={inputClass}
            />
            <BigButton
              tone="rose"
              onClick={() => void transfer()}
              disabled={busy || withdrawable <= 0}
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Wallet className="size-5" />}
              Aktarım talebi oluştur
            </BigButton>
          </section>

          <section className="grid gap-2">
            <p className="text-sm font-semibold text-hm-ink">Aktarım geçmişim</p>
            {(payouts ?? []).length === 0 ? (
              <p className="rounded-3xl bg-hm-sand px-4 py-3 text-sm text-hm-ink-soft">
                Henüz aktarım talebiniz yok.
              </p>
            ) : (
              (payouts ?? []).map((row: PayoutRequestRow) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-3xl border border-hm-line bg-white px-4 py-3"
                >
                  <Banknote className="size-5 shrink-0 text-hm-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-hm-ink">
                      {formatMoney(row.amount, row.currency)}
                    </p>
                    <p className="text-xs text-hm-ink-soft">
                      {new Date(row.created_at).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(row.status)}`}
                  >
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
