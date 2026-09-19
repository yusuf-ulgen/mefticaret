import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fraudAssessmentsQuery } from "@/lib/innovation-queries";
import { scoreRecentOrders, setFraudStatus } from "@/lib/innovation.functions";
import { formatMoney } from "@/lib/mefti";

const LEVEL_LABEL: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const STATUS_LABEL: Record<string, string> = { pending: "İnceleme bekliyor", cleared: "Güvenli", blocked: "Bloklandı" };

/** Sahtecilik kalkanı: gerçek sipariş verilerinden risk puanı ve inceleme kuyruğu. */
export function FraudShieldPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: rows } = useQuery(fraudAssessmentsQuery(storeId));
  const score = useServerFn(scoreRecentOrders);
  const setStatus = useServerFn(setFraudStatus);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fraud-assessments", storeId] });

  const scoreMutation = useMutation({
    mutationFn: async () => score({ data: { storeId, days: 30 } as never }),
    onSuccess: (result) => {
      const data = result as unknown as { scored: number; high: number; medium: number };
      toast.success(`${data.scored} sipariş puanlandı · ${data.high} yüksek riskli`);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const list = rows ?? [];
  const high = list.filter((row) => row.level === "high").length;
  const pending = list.filter((row) => row.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-4" /> Sahtecilik kalkanı
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Son 30 günün siparişleri gerçek sinyallerle puanlanır: tek kullanımlık e-posta, IP–adres uyuşmazlığı,
          kısa sürede çok deneme, ortalamanın çok üstünde tutar, geçmiş ödeme kaydı.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button disabled={scoreMutation.isPending} onClick={() => scoreMutation.mutate()}>
            Siparişleri puanla
          </Button>
          <span className="text-sm text-muted-foreground">
            {list.length} kayıt · {high} yüksek risk · {pending} inceleme bekliyor
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((row) => (
          <div key={row.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {row.orders?.order_number ?? "Sipariş"}{" "}
                  {row.orders ? (
                    <span className="text-muted-foreground">
                      · {formatMoney(Number(row.orders.grand_total), row.orders.currency)}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  Risk {row.score}/100 · {LEVEL_LABEL[row.level]} · {STATUS_LABEL[row.status]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={row.level === "high" ? "destructive" : row.level === "medium" ? "default" : "secondary"}>
                  {LEVEL_LABEL[row.level]}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void setStatus({ data: { storeId, id: row.id, status: "cleared" } as never }).then(() => {
                      toast.success("Güvenli olarak işaretlendi.");
                      void invalidate();
                    });
                  }}
                >
                  Güvenli
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void setStatus({ data: { storeId, id: row.id, status: "blocked" } as never }).then(() => {
                      toast.success("Bloklandı.");
                      void invalidate();
                    });
                  }}
                >
                  Blokla
                </Button>
              </div>
            </div>
            {row.signals.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                {row.signals.map((signal) => (
                  <li key={signal.code}>{signal.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz risk puanı yok. "Siparişleri puanla" ile başlayın.</p>
        ) : null}
      </div>
    </div>
  );
}
