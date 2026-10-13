import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getOrderFinancialTrail } from "@/lib/order-financial-trail.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { QueryStatus } from "@/components/query-status";
import { Button } from "@/components/ui/button";

const labels: Record<string, string> = {
  pending: "Bekliyor",
  pending_review: "İnceleme bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  processing: "Mutabakat bekliyor",
  processed: "Tamamlandı",
  completed: "Tamamlandı",
  partial_refunded: "Kısmen iade",
  failed: "Başarısız",
  paid: "Ödendi",
  payable: "Ödenebilir",
  refunded: "İade edildi",
  cancelled: "İptal",
  posted: "İşlendi",
};
export function OrderFinancialTrail({ storeId, orderId }: { storeId: string; orderId: string }) {
  const get = useServerFn(getOrderFinancialTrail);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["order-financial-trail", storeId, orderId],
    enabled: open,
    queryFn: () => get({ data: { storeId, orderId } }),
  });
  return (
    <details
      className="surface-card mb-6 p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        Tahsilat, iade ve hakediş hareketleri
      </summary>
      <QueryStatus
        label="Finans hareketleri"
        error={query.error}
        loading={query.isPending}
        hasData={query.data !== undefined}
        onRetry={() => void query.refetch()}
      />
      {query.data ? (
        <>
          <div className="my-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              Sipariş ödemesi:{" "}
              {labels[query.data.order.payment_status] ?? query.data.order.payment_status} · Son
              kontrol: {formatDateTime(query.data.measuredAt)}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Yenile
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tüm hareketler bu siparişe bağlıdır. Dekont incelemesi tahsilat değildir; bekleyen iade
            tamamlanmış iade değildir. Aynı tutar tahsilat, defter ve hakedişte görünebilir;
            satırlar toplanmaz.
          </p>
          {query.data.pendingReconciliation ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Sağlayıcı sonucu doğrulanmadan tekrar iade göndermeyin. Bekleyen iadeyi sağlayıcı
              referansıyla mutabakat ekranından kontrol edin.
            </p>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr>
                  <th>İşlem</th>
                  <th>Durum</th>
                  <th>Tutar</th>
                  <th>Referans / Tarih</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-2">{item.source}</td>
                    <td>{labels[item.status] ?? item.status}</td>
                    <td>{item.amount === null ? "—" : formatMoney(item.amount, item.currency)}</td>
                    <td className="max-w-48 break-all text-xs">
                      {item.reference ?? "Referans yok"}
                      <br />
                      {formatDateTime(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data.items.length === 0 ? (
            <p className="mt-3 text-sm">Bağlı finans hareketi bulunamadı.</p>
          ) : null}
        </>
      ) : null}
    </details>
  );
}
