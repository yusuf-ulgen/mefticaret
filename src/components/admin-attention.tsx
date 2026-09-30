import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bug, CheckCircle2, CreditCard, Flag, LifeBuoy, ShieldAlert, Store, UserPlus, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getAdminAttention } from "@/lib/admin-insights.functions";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { cn } from "@/lib/utils";

/** Dashboard: dikkat gerektiren işler + son kayıtlar (gerçek sayımlar). */
export function AdminAttention({ enabled }: { enabled: boolean }) {
  const fetch = useServerFn(getAdminAttention);
  const q = useQuery({ queryKey: ["admin-attention"], enabled, refetchInterval: 60_000, queryFn: () => fetch() });
  const d = q.data;

  const items = [
    { label: "Bekleyen ödeme talebi", value: d?.payouts, to: "/admin/control", icon: Wallet, tone: "warn" },
    { label: "Açık mesaj şikâyeti", value: d?.reports, to: "/admin/control", icon: Flag, tone: "warn" },
    { label: "Yanıt bekleyen destek", value: d?.tickets, to: "/admin/tickets", icon: LifeBuoy, tone: "warn" },
    { label: "Çözülmemiş ciddi hata", value: d?.criticalErrors, to: "/admin/system", icon: Bug, tone: "danger" },
    { label: "Saldırı (24 sa)", value: d?.attacks, to: "/admin/firewall", icon: ShieldAlert, tone: "danger" },
    { label: "Askıdaki mağaza", value: d?.suspended, to: "/admin/stores", icon: Store, tone: "muted" },
    { label: "Ödeme bekleyen sipariş (24 sa)", value: d?.pendingPayments, to: "/admin/transactions", icon: CreditCard, tone: "muted" },
    { label: "Yeni kullanıcı (24 sa)", value: d?.newUsers, to: "/admin/users", icon: UserPlus, tone: "good" },
  ] as const;

  const total = (d?.payouts ?? 0) + (d?.reports ?? 0) + (d?.tickets ?? 0) + (d?.criticalErrors ?? 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
      <section className="surface-card p-5">
        <div className="flex items-center gap-2">
          {q.isLoading ? null : total > 0 ? (
            <AlertTriangle className="size-4 text-warning" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
          <h2 className="font-display text-lg font-semibold">Dikkat gerektirenler</h2>
          {q.isError ? <Badge variant="destructive" className="ml-auto">Durum alınamadı</Badge> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((item) => {
            const n = item.value ?? 0;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "rounded-xl border border-border p-3 transition hover:bg-muted/60",
                  n > 0 && item.tone === "danger" && "border-destructive/40 bg-destructive/5",
                  n > 0 && item.tone === "warn" && "border-warning/40 bg-warning/5",
                )}
              >
                <item.icon className="size-4 text-muted-foreground" />
                <p className="mt-2 font-display text-xl font-semibold">{q.isLoading ? "…" : formatNumber(n)}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">{item.label}</p>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="surface-card p-5">
        <h2 className="font-display text-lg font-semibold">Son katılanlar</h2>
        <p className="text-xs text-muted-foreground">Son 24 saatte {formatNumber(d?.newStores ?? 0)} yeni mağaza</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {(d?.recentStores ?? []).slice(0, 4).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <Link to="/admin/store/$storeId" params={{ storeId: s.id }} className="flex min-w-0 items-center gap-2 hover:underline">
                <Store className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{s.name}</span>
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(s.created_at)}</span>
            </li>
          ))}
          {(d?.recentUsers ?? []).slice(0, 4).map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-2">
              <Link to="/admin/user/$userId" params={{ userId: u.id }} className="flex min-w-0 items-center gap-2 hover:underline">
                <UserPlus className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{u.full_name || u.email || "İsimsiz"}</span>
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(u.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
