import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, CheckCheck, Eye, Radio, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/mefti";
import {
  NOTIFICATION_KIND_LABELS,
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENT_LABELS,
  type WebhookEvent,
} from "@/lib/webhook-events";
import {
  storeNotificationsQuery,
  storeWebhooksQuery,
  webhookDeliveriesQuery,
} from "@/lib/webhook-queries";
import {
  deleteStoreWebhook,
  markStoreNotificationsRead,
  retryStoreWebhookDelivery,
  saveStoreWebhook,
  testStoreWebhook,
} from "@/lib/webhooks.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/store/$storeId/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhook & Bildirimler — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza olaylarını dış sistemlere imzalı webhook ile ilet, gönderim kayıtlarını ve panel bildirimlerini takip et.",
      },
      { property: "og:title", content: "Webhook & Bildirimler — Mefticaret" },
      {
        property: "og:description",
        content: "İmzalı webhook tanımları, gönderim geçmişi ve mağaza bildirimleri tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: hooks, isLoading } = useQuery(storeWebhooksQuery(storeId));
  const { data: deliveries } = useQuery(webhookDeliveriesQuery(storeId));
  const { data: notifications } = useQuery(storeNotificationsQuery(storeId));

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["order.created"]);
  const [active, setActive] = useState(true);

  const saveFn = useServerFn(saveStoreWebhook);
  const deleteFn = useServerFn(deleteStoreWebhook);
  const testFn = useServerFn(testStoreWebhook);
  const readFn = useServerFn(markStoreNotificationsRead);
  const retryFn = useServerFn(retryStoreWebhookDelivery);
  const [inspected, setInspected] = useState<string | null>(null);

  function invalidate(key: string) {
    void queryClient.invalidateQueries({ queryKey: ["store", storeId, key] });
  }

  const save = useMutation({
    mutationFn: () =>
      saveFn({ data: { storeId, name, targetUrl: url, events, isActive: active } }),
    onSuccess: () => {
      toast.success("Webhook kaydedildi");
      setName("");
      setUrl("");
      setEvents(["order.created"]);
      invalidate("webhooks");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kaydedilemedi"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook silindi");
      invalidate("webhooks");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  const test = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(`Test gönderildi (HTTP ${result.status})`);
      else toast.error(`Gönderim başarısız: ${result.body ?? result.status ?? "yanıt yok"}`);
      invalidate("webhook-deliveries");
      invalidate("webhooks");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Test edilemedi"),
  });

  const retry = useMutation({
    mutationFn: (deliveryId: string) => retryFn({ data: { storeId, deliveryId } }),
    onSuccess: (result) => {
      if (result?.ok) toast.success("Gönderim yeniden denendi ve başarılı oldu");
      else toast.warning("Yeniden deneme başarısız oldu, yanıtı inceleyin");
      invalidate("webhook-deliveries");
      invalidate("webhooks");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Denenemedi"),
  });

  const markRead = useMutation({
    mutationFn: (id?: string) => readFn({ data: id ? { storeId, id } : { storeId } }),
    onSuccess: () => invalidate("notifications"),
  });

  const unread = (notifications ?? []).filter((item) => !item.is_read).length;

  return (
    <AppShell
      storeId={storeId}
      title="Webhook & Bildirimler"
      description="Mağaza olaylarını dış sistemlere imzalı olarak ilet, panel bildirimlerini yönet."
    >
      <Tabs defaultValue="hooks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="hooks" className="gap-2">
            <Webhook className="size-4" /> Webhook’lar
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-2">
            <Radio className="size-4" /> Gönderimler
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" /> Bildirimler{unread ? ` (${unread})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hooks" className="space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Yeni webhook</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Her istek <code className="rounded bg-muted px-1">x-mefti-signature</code> başlığında
              HMAC-SHA256 imzası taşır; doğrulamak için webhook gizli anahtarını kullan.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hook-name">Ad</Label>
                <Input
                  id="hook-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ERP sipariş aktarımı"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hook-url">Hedef adres</Label>
                <Input
                  id="hook-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://ornek.com/hooks/mefti"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label>Olaylar</Label>
              <div className="space-y-3">
                {WEBHOOK_EVENT_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.events.map((event) => {
                        const selected = events.includes(event);
                        return (
                          <button
                            key={event}
                            type="button"
                            onClick={() =>
                              setEvents((prev) =>
                                prev.includes(event)
                                  ? prev.filter((item) => item !== event)
                                  : [...prev, event],
                              )
                            }
                            className={
                              selected
                                ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                : "rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                            }
                          >
                            {WEBHOOK_EVENT_LABELS[event]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Başarısız gönderimler 1, 5, 15, 60 ve 360 dakika aralıklarıyla otomatik yeniden
                denenir; imza <code>x-mefti-signature</code> başlığında HMAC-SHA256 olarak gönderilir.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch id="hook-active" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="hook-active" className="text-sm">
                  Aktif
                </Label>
              </div>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !name.trim() || !url.trim() || events.length === 0}
              >
                Webhook oluştur
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (hooks ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Henüz webhook tanımı yok.
            </p>
          ) : (
            <div className="space-y-3">
              {(hooks ?? []).map((hook) => (
                <div key={hook.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{hook.name}</p>
                        <Badge variant={hook.is_active ? "default" : "secondary"}>
                          {hook.is_active ? "Aktif" : "Kapalı"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{hook.target_url}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {hook.events.map((event) => (
                          <span key={event} className="rounded-full border px-2 py-0.5 text-[0.7rem]">
                            {WEBHOOK_EVENT_LABELS[event as WebhookEvent] ?? event}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Son tetikleme:{" "}
                        {hook.last_triggered_at ? formatDateTime(hook.last_triggered_at) : "—"}
                        {hook.last_error ? ` · Son hata: ${hook.last_error}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={test.isPending}
                        onClick={() => test.mutate(hook.id)}
                      >
                        <Send className="size-3.5" /> Test
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Webhook’u sil"
                        onClick={() => remove.mutate(hook.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deliveries">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Olay</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Deneme</TableHead>
                  <TableHead>Yanıt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(deliveries ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Henüz gönderim kaydı yok.
                    </TableCell>
                  </TableRow>
                ) : (
                  (deliveries ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">{row.store_webhooks?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{row.event}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "success" ? "default" : "destructive"}>
                          {row.status === "success" ? "Başarılı" : "Başarısız"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.attempt ?? 1}
                        {row.next_retry_at ? (
                          <span className="ml-1 text-xs text-amber-600">
                            → {formatDateTime(row.next_retry_at)}
                          </span>
                        ) : null}
                        {row.duration_ms ? (
                          <span className="ml-1 text-xs opacity-70">{row.duration_ms} ms</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[18rem] truncate text-sm text-muted-foreground">
                        {row.response_status ?? "—"} {row.response_body ?? ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Gönderim detayı"
                          onClick={() => setInspected(row.id)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {row.status === "failed" ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Yeniden dene"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(row.id)}
                          >
                            <RefreshCw className="size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{unread} okunmamış bildirim</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!unread || markRead.isPending}
              onClick={() => markRead.mutate(undefined)}
            >
              <CheckCheck className="size-4" /> Tümünü okundu işaretle
            </Button>
          </div>
          {(notifications ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Bildirim yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {(notifications ?? []).map((item) => (
                <li
                  key={item.id}
                  className={
                    item.is_read
                      ? "rounded-xl border bg-card p-4"
                      : "rounded-xl border border-primary/40 bg-primary/5 p-4"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind}
                        </Badge>
                        <p className="font-medium">{item.title}</p>
                      </div>
                      {item.message ? (
                        <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                    {item.is_read ? null : (
                      <Button variant="ghost" size="sm" onClick={() => markRead.mutate(item.id)}>
                        Okundu
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(inspected)} onOpenChange={(open) => !open && setInspected(null)}>
        <DialogContent className="max-w-2xl">
          {(() => {
            const row = (deliveries ?? []).find((item) => item.id === inspected);
            if (!row) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{row.event}</DialogTitle>
                  <DialogDescription>
                    {row.store_webhooks?.target_url ?? "—"} · {formatDateTime(row.created_at)} ·{" "}
                    {row.attempt ?? 1}. deneme
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Gönderilen veri</p>
                    <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {JSON.stringify(row.payload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Yanıt ({row.response_status ?? "—"})
                    </p>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {row.response_body ?? "—"}
                    </pre>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
