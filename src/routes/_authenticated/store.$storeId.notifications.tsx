import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CreditCard,
  Megaphone,
  Package,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  UserPlus,
  Wallet,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KIND_META,
  type NotificationKind,
} from "@/lib/notifications";
import {
  notificationDeliveriesQuery,
  notificationSettingsQuery,
} from "@/lib/notifications-queries";
import {
  saveNotificationSetting,
  sendSystemNotification,
} from "@/lib/notifications.functions";
import { storeNotificationsQuery } from "@/lib/webhook-queries";
import { markStoreNotificationsRead } from "@/lib/webhooks.functions";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingBag,
  payment: CreditCard,
  payment_failed: AlertTriangle,
  inventory: Package,
  customer: UserPlus,
  subscription: RefreshCw,
  app_update: Sparkles,
  review: Star,
  question: Bell,
  payout: Wallet,
  abandoned_cart: ShoppingCart,
  system: Webhook,
};

const KIND_FILTERS = ["all", ...NOTIFICATION_KINDS] as const;

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  queued: "Kuyrukta",
  sent: "Gönderildi",
  delivered: "Teslim edildi",
  read: "Okundu",
  failed: "Başarısız",
};

export const Route = createFileRoute("/_authenticated/store/$storeId/notifications")({
  head: () => ({
    meta: [
      { title: "Bildirim Merkezi — Mefticaret" },
      {
        name: "description",
        content:
          "Sipariş, ödeme, stok, müşteri ve abonelik bildirimlerini panel, e-posta, push, SMS ve WhatsApp kanallarıyla yönet.",
      },
      { property: "og:title", content: "Bildirim Merkezi — Mefticaret" },
      {
        property: "og:description",
        content: "Bildirim türlerini ve kanallarını tek ekrandan yapılandır, gönderim kuyruğunu izle.",
      },
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
      <Tabs defaultValue="feed" className="space-y-6">
        <TabsList>
          <TabsTrigger value="feed">Bildirimler</TabsTrigger>
          <TabsTrigger value="channels">Kanal ayarları</TabsTrigger>
          <TabsTrigger value="deliveries">Gönderim kuyruğu</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {KIND_FILTERS.map((value) => {
              const count =
                value === "all" ? items.length : items.filter((item) => item.kind === value).length;
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
                Bu filtreye uygun bildirim yok. Yeni sipariş, ödeme, kritik stok, müşteri ve abonelik hareketleri burada
                listelenir.
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
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <ChannelSettings storeId={storeId} />
          <SystemBroadcast storeId={storeId} />
        </TabsContent>

        <TabsContent value="deliveries">
          <DeliveryQueue storeId={storeId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ChannelSettings({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(notificationSettingsQuery(storeId));
  const [pendingKind, setPendingKind] = useState<NotificationKind | null>(null);

  const save = useMutation({
    mutationFn: (input: {
      kind: NotificationKind;
      inApp: boolean;
      email: boolean;
      push: boolean;
      sms: boolean;
      whatsapp: boolean;
      emailTo?: string;
      smsTo?: string;
      whatsappTo?: string;
    }) => saveNotificationSetting({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Bildirim ayarı kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notification-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPendingKind(null),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Kanal matrisi</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Her bildirim türü için panel, e-posta, push, SMS ve WhatsApp kanallarını ayrı ayrı aç/kapat. E-posta, SMS ve
          WhatsApp için alıcı bilgisi girilmeden gönderim kuyruğa alınmaz.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <SettingRow
            key={row.kind}
            row={row}
            saving={save.isPending && pendingKind === row.kind}
            onSave={(input) => {
              setPendingKind(row.kind as NotificationKind);
              save.mutate({ kind: row.kind as NotificationKind, ...input });
            }}
          />
        ))}
      </div>
    </div>
  );
}

type SettingRowData = {
  kind: string;
  in_app: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  email_to: string | null;
  sms_to: string | null;
  whatsapp_to: string | null;
};

function SettingRow({
  row,
  saving,
  onSave,
}: {
  row: SettingRowData;
  saving: boolean;
  onSave: (input: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    emailTo?: string;
    smsTo?: string;
    whatsappTo?: string;
  }) => void;
}) {
  const [state, setState] = useState({
    in_app: row.in_app,
    email: row.email,
    push: row.push,
    sms: row.sms,
    whatsapp: row.whatsapp,
    email_to: row.email_to ?? "",
    sms_to: row.sms_to ?? "",
    whatsapp_to: row.whatsapp_to ?? "",
  });

  const meta = NOTIFICATION_KIND_META[row.kind as NotificationKind];
  const Icon = KIND_ICONS[row.kind] ?? Bell;

  const dirty =
    state.in_app !== row.in_app ||
    state.email !== row.email ||
    state.push !== row.push ||
    state.sms !== row.sms ||
    state.whatsapp !== row.whatsapp ||
    state.email_to !== (row.email_to ?? "") ||
    state.sms_to !== (row.sms_to ?? "") ||
    state.whatsapp_to !== (row.whatsapp_to ?? "");

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{meta?.label ?? row.kind}</p>
            <p className="text-xs text-muted-foreground">{meta?.description}</p>
          </div>
        </div>
        <Button
          size="sm"
          disabled={!dirty || saving}
          onClick={() =>
            onSave({
              inApp: state.in_app,
              email: state.email,
              push: state.push,
              sms: state.sms,
              whatsapp: state.whatsapp,
              emailTo: state.email_to,
              smsTo: state.sms_to,
              whatsappTo: state.whatsapp_to,
            })
          }
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {NOTIFICATION_CHANNELS.map((channel) => (
          <label
            key={channel.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
          >
            <span>
              <span className="block text-sm font-medium">{channel.label}</span>
              <span className="block text-[0.7rem] text-muted-foreground">{channel.description}</span>
            </span>
            <Switch
              checked={state[channel.key]}
              onCheckedChange={(checked) => setState((prev) => ({ ...prev, [channel.key]: checked }))}
              aria-label={`${meta?.label ?? row.kind} · ${channel.label}`}
            />
          </label>
        ))}
      </div>

      {state.email || state.sms || state.whatsapp ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {state.email ? (
            <div className="space-y-1.5">
              <Label className="text-xs">E-posta alıcısı</Label>
              <Input
                value={state.email_to}
                onChange={(event) => setState((prev) => ({ ...prev, email_to: event.target.value }))}
                placeholder="bildirim@magazam.com"
              />
            </div>
          ) : null}
          {state.sms ? (
            <div className="space-y-1.5">
              <Label className="text-xs">SMS numarası</Label>
              <Input
                value={state.sms_to}
                onChange={(event) => setState((prev) => ({ ...prev, sms_to: event.target.value }))}
                placeholder="+905xxxxxxxxx"
              />
            </div>
          ) : null}
          {state.whatsapp ? (
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp numarası</Label>
              <Input
                value={state.whatsapp_to}
                onChange={(event) => setState((prev) => ({ ...prev, whatsapp_to: event.target.value }))}
                placeholder="+905xxxxxxxxx"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SystemBroadcast({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"system" | "app_update">("system");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: () =>
      sendSystemNotification({
        data: { storeId, kind, title, ...(message.trim() ? { message } : {}) },
      }),
    onSuccess: () => {
      toast.success("Bildirim yayınlandı");
      setTitle("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["store", storeId, "notification-deliveries"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Sistem / uygulama duyurusu gönder</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Ekibine panel bildirimi olarak duyuru yayınla; açık olan e-posta, push, SMS ve WhatsApp kanalları kuyruğa
        eklenir.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Tür</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={kind === "system" ? "default" : "outline"} onClick={() => setKind("system")}>
              Sistem bildirimi
            </Button>
            <Button
              size="sm"
              variant={kind === "app_update" ? "default" : "outline"}
              onClick={() => setKind("app_update")}
            >
              Uygulama güncellemesi
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Başlık</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bakım penceresi" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label className="text-xs">Mesaj</Label>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Detaylar…"
          rows={3}
        />
      </div>
      <Button
        className="mt-3"
        size="sm"
        disabled={title.trim().length < 3 || send.isPending}
        onClick={() => send.mutate()}
      >
        <Send className="mr-1.5 size-4" /> {send.isPending ? "Gönderiliyor…" : "Yayınla"}
      </Button>
    </div>
  );
}

function DeliveryQueue({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    ...notificationDeliveriesQuery(storeId),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4">
        <p className="text-sm font-semibold">Kanal gönderimleri</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bildirimlerden üretilen e-posta, push, SMS ve WhatsApp gönderimleri. Sağlayıcı bağlanana kadar kayıtlar
          kuyrukta bekler.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Henüz kanal gönderimi yok.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{NOTIFICATION_CHANNEL_LABELS[row.channel] ?? row.channel}</Badge>
                  <p className="truncate text-sm font-medium">{row.subject ?? "(başlıksız)"}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.recipient} · {formatDateTime(row.created_at)}
                </p>
                {row.error ? <p className="mt-1 text-xs text-muted-foreground/80">{row.error}</p> : null}
              </div>
              <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                {DELIVERY_STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
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
  if (entity === "customer") {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/customers" params={{ storeId }}>
          Müşteriye git
        </Link>
      </Button>
    );
  }
  if (entity === "subscription") {
    return (
      <Button asChild size="sm" variant="ghost">
        <Link to="/store/$storeId/billing" params={{ storeId }}>
          Aboneliğe git
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
