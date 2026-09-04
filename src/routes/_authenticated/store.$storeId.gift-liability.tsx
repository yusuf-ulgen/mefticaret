import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, TriangleAlert, Wallet } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { cardRows, giftLiabilitySummary, liabilityAging, monthlyFlow } from "@/lib/gift-liability";
import { giftLiabilityQuery } from "@/lib/gift-liability-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/gift-liability")({
  head: () => ({
    meta: [
      { title: "Hediye Kartı Yükümlülüğü — Mefticaret" },
      {
        name: "description",
        content:
          "Hediye kartı bakiye yükümlülüğü, kullanım oranı, yaşlandırma ve süresi dolan bakiye (breakage) analizi.",
      },
      { property: "og:title", content: "Hediye Kartı Yükümlülüğü — Mefticaret" },
      {
        property: "og:description",
        content: "Açık hediye kartı bakiyelerinin finansal yükümlülüğünü ve kullanım hızını takip et.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GiftLiabilityPage,
});

const EXPIRY_LABELS: Record<string, string> = {
  none: "Süresiz",
  expired: "Süresi geçti",
  soon: "30 günde dolacak",
  future: "Geçerli",
};

function GiftLiabilityPage() {
  const { storeId } = Route.useParams();
  const { data, isLoading } = useQuery(giftLiabilityQuery(storeId));

  const cards = data?.cards ?? [];
  const transactions = data?.transactions ?? [];

  const summary = useMemo(() => giftLiabilitySummary(cards), [cards]);
  const aging = useMemo(() => liabilityAging(cards), [cards]);
  const flow = useMemo(() => monthlyFlow(transactions), [transactions]);
  const rows = useMemo(() => cardRows(cards), [cards]);
  const maxBalance = Math.max(1, ...aging.map((band) => band.balance));

  return (
    <AppShell
      storeId={storeId}
      title="Hediye Kartı Yükümlülüğü"
      description="Açık bakiyelerin finansal yükünü, kullanım hızını ve süresi dolan tutarları izle."
    >
      <div className="space-y-8">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Hediye kartı verileri hesaplanıyor…</p>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz hediye kartı tanımlanmamış.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Açık yükümlülük"
                value={formatMoney(summary.outstanding)}
                hint={`${formatNumber(summary.cards)} kart · ort. ${formatMoney(summary.averageCardValue)}`}
              />
              <Kpi
                label="Tanımlanan"
                value={formatMoney(summary.issuedAmount)}
                hint={`Kullanılan ${formatMoney(summary.redeemedAmount)}`}
              />
              <Kpi
                label="Kullanım oranı"
                value={`%${summary.redemptionRate.toFixed(1)}`}
                hint={`${formatNumber(summary.untouched)} kart hiç kullanılmadı`}
              />
              <Kpi
                label="Breakage"
                value={formatMoney(summary.expiredBalance)}
                hint={`30 günde dolacak ${formatMoney(summary.expiringSoon)}`}
              />
            </div>

            {summary.expiringSoon > 0 ? (
              <section className="rounded-xl border p-5">
                <h3 className="font-display flex items-center gap-2 text-lg">
                  <TriangleAlert className="size-4 text-primary" /> Yaklaşan son kullanım
                </h3>
                <p className="mt-2 text-sm">
                  Önümüzdeki 30 gün içinde <strong>{formatMoney(summary.expiringSoon)}</strong> bakiye
                  geçerliliğini yitirecek. Müşterilere hatırlatma göndermek kullanım oranını yükseltir.
                </p>
              </section>
            ) : null}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border p-5">
                <h3 className="font-display flex items-center gap-2 text-lg">
                  <Wallet className="size-4 text-primary" /> Bakiye yaşlandırma
                </h3>
                {aging.map((band) => (
                  <div key={band.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{band.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(band.cards)} kart · {formatMoney(band.balance)} · %{band.share.toFixed(1)}
                      </span>
                    </div>
                    <div className="bg-muted h-3 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.round((band.balance / maxBalance) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-4">
                <h3 className="font-display flex items-center gap-2 px-1 text-lg">
                  <Gift className="size-4 text-primary" /> Aylık yükleme / kullanım
                </h3>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={flow}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="issued" name="Yükleme" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="redeemed" name="Kullanım" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Kart detayları</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Kod</th>
                      <th className="p-3 text-right">Tanımlanan</th>
                      <th className="p-3 text-right">Kalan</th>
                      <th className="p-3 text-right">Kullanım</th>
                      <th className="p-3 text-right">Yaş</th>
                      <th className="p-3">Son kullanım</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3 font-mono text-xs">{row.code}</td>
                        <td className="p-3 text-right">{formatMoney(row.initialAmount)}</td>
                        <td className="p-3 text-right font-medium">{formatMoney(row.balance)}</td>
                        <td className="p-3 text-right">%{row.usageRate.toFixed(0)}</td>
                        <td className="p-3 text-right">{formatNumber(row.daysSinceIssue)} gün</td>
                        <td className="p-3">
                          <Badge variant={row.expiryState === "expired" ? "destructive" : "outline"}>
                            {EXPIRY_LABELS[row.expiryState]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
