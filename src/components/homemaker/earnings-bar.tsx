import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, ChevronRight, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EarningsSheet } from "@/components/homemaker/earnings-sheet";
import { kolayFinanceQuery, kolayPayoutsQuery } from "@/lib/kolay-finance-queries";
import { requestKolayPayout } from "@/lib/kolay-finance.functions";
import { formatMoney } from "@/lib/mefti";

/**
 * "Bugünün kazancı" ve "çekilebilir bakiye" göstergesi.
 * Tutarlar sunucuda ödemesi alınmış siparişlerden hesaplanır; aktarım talebi
 * kayıt olarak açılır ve ertesi gün hakedişle ödenir.
 */
export function EarningsBar({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(kolayFinanceQuery(storeId));
  const { data: payouts } = useQuery(kolayPayoutsQuery(storeId));
  const askPayout = useServerFn(requestKolayPayout);
  const [busy, setBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const currency = data?.currency ?? "TRY";
  const pending = (payouts ?? []).filter((row) => row.status === "pending");

  const transfer = async () => {
    setBusy(true);
    try {
      await askPayout({ data: { storeId } });
      await queryClient.invalidateQueries({ queryKey: ["kolay-finance", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["kolay-payouts", storeId] });
      toast.success("Aktarım talebiniz alındı. Ertesi gün hesabınıza geçer.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Talep oluşturulamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 border-t border-hm-line bg-white px-4 py-2">
      <div className="mx-auto flex w-full max-w-lg items-center gap-2">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex-1 rounded-2xl bg-hm-emerald-soft px-3 py-2 text-left"
        >
          <p className="text-[11px] font-semibold text-hm-emerald">Bugünün kazancı</p>
          <p className="text-sm font-bold text-hm-emerald">
            {formatMoney(data?.today ?? 0, currency)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex-1 rounded-2xl bg-hm-teal-soft px-3 py-2 text-left"
        >
          <p className="text-[11px] font-semibold text-hm-teal">Çekilebilir bakiye</p>
          <p className="text-sm font-bold text-hm-teal">
            {formatMoney(data?.withdrawable ?? 0, currency)}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void transfer()}
          disabled={busy || (data?.withdrawable ?? 0) <= 0}
          className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-hm-rose px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          Hesabıma aktar
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2">
        {pending.length ? (
          <p className="flex items-center gap-1.5 text-xs text-hm-ink-soft">
            <Banknote className="size-3.5" />
            {formatMoney(pending[0]!.amount, pending[0]!.currency)} aktarım talebiniz sırada.
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-hm-teal"
        >
          Kazanç ayrıntısı <ChevronRight className="size-3.5" />
        </button>
      </div>
      <EarningsSheet open={detailOpen} onClose={() => setDetailOpen(false)} storeId={storeId} />
    </div>
  );
}
