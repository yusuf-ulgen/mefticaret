import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Package, ShoppingBag, Star, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NOTIFICATION_KIND_LABELS } from "@/lib/mefti";
import { storeNotificationsQuery } from "@/lib/webhook-queries";
import { markStoreNotificationsRead } from "@/lib/webhooks.functions";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingBag,
  inventory: Package,
  review: Star,
  system: Webhook,
};

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return new Date(value).toLocaleDateString("tr-TR");
}

export function NotificationBell({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: notifications } = useQuery({
    ...storeNotificationsQuery(storeId),
    refetchInterval: 60_000,
  });

  const items = notifications ?? [];
  const unread = items.filter((item) => !item.is_read).length;

  const markRead = useMutation({
    mutationFn: (id?: string) =>
      markStoreNotificationsRead({ data: id ? { storeId, id } : { storeId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `${unread} okunmamış bildirim` : "Bildirimler"}
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[0.6rem] font-bold leading-4 text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Bildirimler</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              <CheckCheck className="size-3.5" /> Tümünü okundu yap
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Henüz bildirim yok. Yeni sipariş, yorum ve kritik stok hareketleri burada görünecek.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y divide-border">
              {items.slice(0, 12).map((item) => {
                const Icon = KIND_ICONS[item.kind] ?? Bell;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.is_read) markRead.mutate(item.id);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        !item.is_read && "bg-primary/5",
                      )}
                    >
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{item.title}</span>
                          {!item.is_read ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                          ) : null}
                        </span>
                        {item.message ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {item.message}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[0.7rem] text-muted-foreground/80">
                          {NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind} ·{" "}
                          {relativeTime(item.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t border-border px-4 py-2">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center text-xs">
            <Link
              to="/store/$storeId/webhooks"
              params={{ storeId }}
              onClick={() => setOpen(false)}
            >
              Tüm bildirimleri gör
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
