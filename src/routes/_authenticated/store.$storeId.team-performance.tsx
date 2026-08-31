import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Download, Users } from "lucide-react";
import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/mefti";
import { analyzeTeamPerformance } from "@/lib/team-performance";
import { teamPerformanceDataQuery } from "@/lib/team-performance-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/team-performance")({
  head: () => ({
    meta: [
      { title: "Personel Performansı — Mefticaret" },
      {
        name: "description",
        content:
          "Ekip üyelerinin sipariş işleme, kargolama ve panel aktivitelerini son 90 gün üzerinden karşılaştır.",
      },
      { property: "og:title", content: "Personel Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Kişi başına aksiyon, dokunulan sipariş, aktif gün ve günlük aktivite trendi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPerformancePage,
});

function TeamPerformancePage() {
  const { storeId } = Route.useParams();
  const { data, isLoading } = useQuery(teamPerformanceDataQuery(storeId));

  const analysis = useMemo(
    () => analyzeTeamPerformance(data?.events ?? [], data?.audits ?? [], data?.members ?? []),
    [data],
  );

  const exportCsv = () => {
    downloadCsv(
      `personel-performans-${storeId}.csv`,
      toCsv(
        [
          "Üye",
          "Rol",
          "Toplam aksiyon",
          "Sipariş olayı",
          "Panel işlemi",
          "Kargo aksiyonu",
          "Dokunulan sipariş",
          "Aktif gün",
          "Gün başına aksiyon",
          "Son aktiflik",
        ],
        analysis.members.map((member) => [
          member.label,
          member.roleLabel,
          member.totalActions,
          member.orderEvents,
          member.auditActions,
          member.fulfillmentActions,
          member.ordersTouched,
          member.activeDays,
          member.actionsPerActiveDay.toFixed(1),
          member.lastActiveAt ? member.lastActiveAt.slice(0, 10) : "",
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Aktif üye", value: formatNumber(analysis.summary.activeMembers) },
    { label: "Toplam aksiyon", value: formatNumber(analysis.summary.totalActions) },
    { label: "Kargo aksiyonu", value: formatNumber(analysis.summary.fulfillmentActions) },
    {
      label: "Üye başına aksiyon",
      value: analysis.summary.avgActionsPerMember.toFixed(1),
    },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Personel Performansı"
      description="Son 90 günde ekip üyelerinin sipariş işleme ve panel aktivitelerini karşılaştır."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        {analysis.summary.idleMembers > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <Users className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="font-medium">
                {formatNumber(analysis.summary.idleMembers)} ekip üyesi son 90 günde hiç işlem
                yapmadı
              </p>
              <p className="text-sm text-muted-foreground">
                Kullanılmayan yetkileri gözden geçirmek güvenlik açısından önerilir.
              </p>
            </div>
          </div>
        ) : null}

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Günlük aktivite trendi</h2>
          </div>
          {analysis.byDay.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.byDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12 }}
                    formatter={(value: number, name) => [
                      formatNumber(value),
                      name === "orderEvents" ? "Sipariş olayı" : "Panel işlemi",
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "orderEvents" ? "Sipariş olayı" : "Panel işlemi"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="orderEvents"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="auditActions"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Yükleniyor…" : "Bu dönemde aktivite kaydı yok."}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">En sık yapılan işlemler</h2>
          <div className="space-y-3">
            {analysis.topActions.map((row) => (
              <div key={row.action} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.action}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(row.count)} · {(row.share * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(2, row.share * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!analysis.topActions.length ? (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "İşlem kaydı bulunmuyor."}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Ekip üyeleri ({formatNumber(analysis.members.length)})
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              disabled={!analysis.members.length}
            >
              <Download className="mr-2 size-4" /> CSV indir
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Üye</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Aksiyon</th>
                  <th className="py-2">Sipariş olayı</th>
                  <th className="py-2">Kargo</th>
                  <th className="py-2">Sipariş</th>
                  <th className="py-2">Aktif gün</th>
                  <th className="py-2">Gün/aksiyon</th>
                  <th className="py-2">Son aktiflik</th>
                </tr>
              </thead>
              <tbody>
                {analysis.members.map((member) => (
                  <tr key={member.actorId} className="border-t">
                    <td className="py-2 font-medium">{member.label}</td>
                    <td className="py-2">
                      <Badge variant="outline">{member.roleLabel}</Badge>
                    </td>
                    <td className="py-2">
                      {formatNumber(member.totalActions)}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({(member.share * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="py-2">{formatNumber(member.orderEvents)}</td>
                    <td className="py-2">{formatNumber(member.fulfillmentActions)}</td>
                    <td className="py-2">{formatNumber(member.ordersTouched)}</td>
                    <td className="py-2">{formatNumber(member.activeDays)}</td>
                    <td className="py-2">{member.actionsPerActiveDay.toFixed(1)}</td>
                    <td className="py-2 text-muted-foreground">
                      {member.lastActiveAt ? member.lastActiveAt.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
                {!analysis.members.length ? (
                  <tr>
                    <td colSpan={9} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Ekip üyesi bulunmuyor."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
