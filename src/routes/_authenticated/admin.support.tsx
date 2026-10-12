import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { platformTicketsQuery } from "@/lib/platform-admin-queries";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({
    meta: [
      { title: "Destek — Süper Admin" },
      { name: "description", content: "Destek yükü, kategori dağılımı ve bekleyen talepler özeti." },
      { property: "og:title", content: "Destek — Süper Admin" },
      { property: "og:description", content: "Platform destek operasyonunun genel görünümü." },
    ],
  }),
  component: AdminSupport,
});

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  pending: "Beklemede",
  answered: "Yanıtlandı",
  resolved: "Çözüldü",
  closed: "Kapandı",
};

function AdminSupport() {
  const { isPlatformAdmin } = useAuth();
  const tickets = useQuery(platformTicketsQuery("all", isPlatformAdmin));
  const rows = tickets.data?.rows ?? [];
  const storeNames = tickets.data?.storeNames ?? {};

  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row["status"] ?? "open");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row["category"] ?? "genel");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const waiting = rows.filter((row) => ["open", "pending"].includes(String(row["status"])));

  return (
    <AdminShell
      title="Destek"
      description="Talep yükü ve bekleyen işler."
      actions={
        <Button asChild size="sm">
          <Link to="/admin/tickets">Ticket kuyruğu</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status} className="surface-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{formatNumber(byStatus[status] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Kategori dağılımı</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {Object.entries(byCategory).map(([category, count]) => (
              <li key={category} className="flex items-center justify-between gap-2">
                <span className="capitalize">{category}</span>
                <Badge variant="secondary">{formatNumber(count)}</Badge>
              </li>
            ))}
            {Object.keys(byCategory).length === 0 ? (
              <li className="text-muted-foreground">Henüz talep yok.</li>
            ) : null}
          </ul>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Yanıt bekleyenler</h2>
          <ul className="mt-4 divide-y divide-border text-sm">
            {waiting.slice(0, 12).map((row) => (
              <li key={String(row["id"])} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{String(row["subject"] ?? "—")}</p>
                  <p className="text-xs text-muted-foreground">
                    {storeNames[String(row["store_id"] ?? "")] ?? "Platform"} ·{" "}
                    {formatDateTime(String(row["created_at"]))}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/tickets">Aç</Link>
                </Button>
              </li>
            ))}
            {waiting.length === 0 ? <li className="py-2 text-muted-foreground">Bekleyen talep yok.</li> : null}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
