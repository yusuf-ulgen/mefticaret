import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bell, CheckCheck, Package, RotateCcw, ShoppingBag, ShoppingCart, Star, Wallet, Webhook } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { NOTIFICATION_KIND_LABELS } from "@/lib/webhook-events";
import { storeNotificationsQuery } from "@/lib/webhook-queries";
import { markStoreNotificationsRead } from "@/lib/webhooks.functions";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingBag,
  inventory: Package,
  review: Star,
  payout: Wallet,
  abandoned_cart: ShoppingCart,
  system: Webhook,
};

const KIND_FILTERS = ["all", "order", "inventory", "review", "payout", "abandoned_cart", "system"] as const;

export const Route = createFileRoute("/_authenticated/store/$storeId/notifications")({
  head: () => ({
    meta: [
      { title: "Bildirim Merkezi — Mefticaret" },
      {
        name: "description",
        content: "Sipariş, stok, yorum ve iade bildirimlerini tek merkezden filtreleyip yönet.",
      },
      { property: "og:title", content: "Bildirim Merkezi — Mefticaret" },
      { property: "og:description", content: "Mağaza bildirimlerini filtrele, okundu işaretle ve kaynağa git." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: notifications, isLoading } = useQuery({
    ...storeNotificationsQuery(storeId),
    refetchInterval: 60_000,
  });

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.is_read).length;

  const markRead = useMutation({
    mutationFn: (id?: string) => markStoreNotificationsRead({ data: id ? { storeId, id } : { storeId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (onlyUnread && item.is_read) return false;
      if (!q) return true;
      return `${item.title} ${item.message ?? ""}`.toLocaleLowerCase("tr").includes(q);
    });
  }, [items, kind, onlyUnread, search]);

  return (
    <AppShell
      storeId={storeId}
      title="Bildirim Merkezi"
      description={`${store?.name ?? "Mağaza"} · ${unread} okunmamış bildirim`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((value) => {
            const count = value === "all" ? items.length : items.filter((item) => item.kind === value).length;
            return (
              <Button
                key={value}
                size="sm"
                variant={kind === value ? "default" : "outline"}
                onClick={() => setKind(value)}
              >
                {value === "all" ? "Tümü" : (NOTIFICATION_KIND_LABELS[value] ?? value)}
                <span className="ml-1.5 text-xs opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Bildirimlerde ara"
            className="max-w-xs"
          />
          <Button size="sm" variant={onlyUnread ? "default" : "outline"} onClick={() => setOnlyUnread((v) => !v)}>
            Sadece okunmamış
          </Button>
          {unread > 0 ? (
            <Button size="sm" variant="ghost" disabled={markRead.isPending} onClick={() => markRead.mutate(undefined)}>
              <CheckCheck className="mr-1.5 size-4" /> Tümünü okundu yap
            </Button>
          ) : null}
        </div>

        <div className="rounded-xl border bg-card">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Bu filtreye uygun bildirim yok. Yeni sipariş, kritik stok, yorum ve iade hareketleri burada listelenir.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((item) => {
                const Icon = KIND_ICONS[item.kind] ?? Bell;
                return (
                  <li
                    key={item.id}
                    className={cn("flex items-start gap-3 p-4", !item.is_read && "bg-primary/5")}
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <Badge variant="outline">{NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind}</Badge>
                        {!item.is_read ? <Badge>Yeni</Badge> : null}
                      </div>
                      {item.message ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground/80">{formatDateTime(item.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <EntityLink storeId={storeId} entity={item.entity} entityId={item.entity_id} />
                      {!item.is_read ? (
                        <Button size="sm" variant="outline" onClick={() => markRead.mutate(item.id)}>
                          Okundu
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EntityLink({
  storeId,
  entity,
  entityId,
}: {
  storeId: string;
  entity: string | null;
  entityId: string | null;
}) {
  if (entity === "order" && entityId) {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/orders/$orderId" params={{ storeId, orderId: entityId }}>
          Siparişe git
        </Link>
      </Button>
    );
  }
  if (entity === "variant") {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/inventory" params={{ storeId }}>
          Stoğa git
        </Link>
      </Button>
    );
  }
  if (entity === "product_review") {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/reviews" params={{ storeId }}>
          Yorumlara git
        </Link>
      </Button>
    );
  }
  if (entity === "return_request") {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/returns" params={{ storeId }}>
          İadelere git
        </Link>
      </Button>
    );
  }
  return null;
}
