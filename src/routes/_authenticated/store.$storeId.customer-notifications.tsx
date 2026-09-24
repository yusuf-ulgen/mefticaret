import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Mail, MessageCircle, RotateCw, Send, Smartphone, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { API_CARRIERS, CARRIERS, type CarrierKey } from "@/lib/carriers";
import {
  CHANNEL_LABELS,
  DEFAULT_TEMPLATES,
  EVENT_LABELS,
  NOTIFY_CHANNELS,
  NOTIFY_EVENTS,
  type NotifyChannel,
  type NotifyEvent,
  renderTemplate,
  SAMPLE_VARS,
  SMS_MAX,
  SMS_STOP_SUFFIX,
  TEMPLATE_VARIABLES,
} from "@/lib/customer-notify";
import {
  getNotificationCenter,
  listNotificationLogs,
  resendNotification,
  saveCarrierSetting,
  saveNotificationTemplate,
  sendTestNotification,
} from "@/lib/customer-notify.functions";
import { formatDateTime } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/customer-notifications")({
  head: () => ({
    meta: [
      { title: "Müşteri Bildirimleri — Mefticaret" },
      { name: "description", content: "Sipariş, kargo ve iade bildirimlerini e-posta, SMS ve WhatsApp ile yönetin." },
    ],
  }),
  component: Page,
});

const CH_ICON = { email: Mail, sms: Smartphone, whatsapp: MessageCircle } as const;

function Page() {
  const { storeId } = Route.useParams();
  const load = useServerFn(getNotificationCenter);
  const { data, isLoading } = useQuery({ queryKey: ["customer-notify", storeId], queryFn: () => load({ data: { storeId } }) });

  return (
    <AppShell storeId={storeId} title="Müşteri Bildirimleri" description="Sipariş, kargo ve iade bildirimleri">
      {isLoading || !data ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : (
        <Tabs defaultValue="templates">
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="channels" className="min-h-11">Kanal Ayarları</TabsTrigger>
            <TabsTrigger value="templates" className="min-h-11">Şablonlar</TabsTrigger>
            <TabsTrigger value="logs" className="min-h-11">Bildirim Geçmişi</TabsTrigger>
            <TabsTrigger value="carriers" className="min-h-11">Kargo Firmaları</TabsTrigger>
          </TabsList>
          <TabsContent value="channels"><Channels storeId={storeId} channels={data.channels} /></TabsContent>
          <TabsContent value="templates"><Templates storeId={storeId} templates={data.templates} channels={data.channels} storeName={data.store?.name ?? ""} /></TabsContent>
          <TabsContent value="logs"><Logs storeId={storeId} /></TabsContent>
          <TabsContent value="carriers"><Carriers storeId={storeId} rows={data.carriers} /></TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function Channels({ storeId, channels }: { storeId: string; channels: { email: boolean; sms: boolean; whatsapp: boolean; whatsappNumber: string | null } }) {
  const rows = [
    { key: "email", label: "E-posta", ok: channels.email, info: "Platform e-posta altyapısı (destek.mefticaret.com). Teslim ve geri dönme takibi dahil.", to: null },
    { key: "sms", label: "SMS (Verimor)", ok: channels.sms, info: channels.sms ? "Verimor bağlı." : "SMS için Verimor uygulamasını kurun.", to: "apps" },
    { key: "whatsapp", label: "WhatsApp Business", ok: channels.whatsapp, info: channels.whatsapp ? `Bağlı numara: ${channels.whatsappNumber ?? ""}` : "WhatsApp Business hesabınızı bağlayın.", to: "whatsapp" },
  ] as const;
  return (
    <div className="grid gap-3 pt-4">
      {rows.map((r) => (
        <div key={r.key} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-medium">{r.label}</p>
            <p className="text-sm text-muted-foreground">{r.info}</p>
          </div>
          {r.ok ? <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3" /> Bağlı</Badge> : r.to ? (
            <Button asChild className="h-11"><Link to={`/store/$storeId/${r.to}` as "/store/$storeId/apps"} params={{ storeId }}>Bağla</Link></Button>
          ) : null}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Her e-postaya abonelikten çıkma bağlantısı, her SMS'e "STOP" çıkış bilgisi otomatik eklenir. Aynı sipariş olayı için bir müşteriye en fazla 1 SMS gider.
      </p>
    </div>
  );
}

type Tpl = { event_key: string; channel: string; language: string; subject: string | null; body: string; is_active: boolean };

function Templates({ storeId, templates, channels, storeName }: { storeId: string; templates: Tpl[]; channels: Record<string, unknown>; storeName: string }) {
  const [event, setEvent] = useState<NotifyEvent>("ORDER_SHIPPED");
  const [channel, setChannel] = useState<NotifyChannel>("email");
  return (
    <div className="grid gap-4 pt-4 lg:grid-cols-[280px_1fr]">
      <ul className="surface-card divide-y divide-border">
        {NOTIFY_EVENTS.map((ev) => (
          <li key={ev}>
            <button type="button" onClick={() => setEvent(ev)} className={`flex min-h-11 w-full flex-col items-start gap-1 px-4 py-3 text-left ${event === ev ? "bg-muted" : ""}`}>
              <span className="text-sm font-medium">{EVENT_LABELS[ev]}</span>
              <span className="flex gap-1">
                {NOTIFY_CHANNELS.map((ch) => {
                  const row = templates.find((t) => t.event_key === ev && t.channel === ch);
                  const on = row ? row.is_active : Boolean(DEFAULT_TEMPLATES[ev][ch]);
                  return on ? <Badge key={ch} variant="outline" className="text-[10px]">{CHANNEL_LABELS[ch]}</Badge> : null;
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {NOTIFY_CHANNELS.map((ch) => {
            const Icon = CH_ICON[ch];
            return (
              <Button key={ch} variant={channel === ch ? "default" : "outline"} className="h-11" onClick={() => setChannel(ch)}>
                <Icon className="mr-1 size-4" /> {CHANNEL_LABELS[ch]}
              </Button>
            );
          })}
        </div>
        <Editor key={`${event}-${channel}`} storeId={storeId} event={event} channel={channel} storeName={storeName}
          row={templates.find((t) => t.event_key === event && t.channel === channel && t.language === "tr")}
          connected={channel === "email" || Boolean(channels[channel])} />
      </div>
    </div>
  );
}

function Editor({ storeId, event, channel, row, connected, storeName }: { storeId: string; event: NotifyEvent; channel: NotifyChannel; row?: Tpl; connected: boolean; storeName: string }) {
  const qc = useQueryClient();
  const save = useServerFn(saveNotificationTemplate);
  const test = useServerFn(sendTestNotification);
  const def = DEFAULT_TEMPLATES[event][channel];
  const [active, setActive] = useState(row ? row.is_active : Boolean(def));
  const [subject, setSubject] = useState(row?.subject ?? def?.subject ?? "");
  const [body, setBody] = useState(row?.body ?? def?.body ?? "");
  const [to, setTo] = useState("");

  const vars = { ...SAMPLE_VARS, store_name: storeName || SAMPLE_VARS["store_name"]! };
  const preview = renderTemplate(body, vars);
  const smsLen = preview.length + SMS_STOP_SUFFIX.length;
  const tooLong = channel === "sms" && body.length > SMS_MAX;

  const saveM = useMutation({
    mutationFn: () => save({ data: { storeId, eventKey: event, channel, language: "tr", subject: channel === "email" ? subject : null, body, isActive: active } }),
    onSuccess: () => { toast.success("Şablon kaydedildi"); void qc.invalidateQueries({ queryKey: ["customer-notify", storeId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const testM = useMutation({
    mutationFn: () => test({ data: { storeId, eventKey: event, channel, to, subject: channel === "email" ? subject : null, body } }),
    onSuccess: () => toast.success("Test bildirimi gönderildi"),
    onError: (e: Error) => toast.error(e.message),
  });

  const insert = (v: string) => setBody((b) => `${b}{{${v}}}`);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_375px]">
      <div className="surface-card space-y-3 p-4">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-sm font-medium">{EVENT_LABELS[event]} · {CHANNEL_LABELS[channel]} gönderilsin</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </label>
        {!connected ? <p className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="size-4" /> Bu kanal bağlı değil; bağlanana kadar mesaj gitmez.</p> : null}
        {channel === "whatsapp" ? (
          <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            WhatsApp, müşteriyle son 24 saatte yazışma yoksa yalnızca Meta tarafından önceden onaylanmış şablonlara izin verir. Onaysız metin bu durumda teslim edilmeyebilir.
          </p>
        ) : null}
        {channel === "email" ? (
          <div className="space-y-1"><Label>Konu</Label><Input className="h-11" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        ) : null}
        <div className="space-y-1">
          <div className="flex items-center justify-between"><Label>Mesaj</Label>
            {channel === "sms" ? <span className={`text-xs ${smsLen > SMS_MAX ? "text-destructive" : "text-muted-foreground"}`}>{smsLen}/{SMS_MAX} (STOP bilgisi dahil)</span> : null}
          </div>
          <Textarea rows={channel === "email" ? 8 : 4} maxLength={channel === "sms" ? SMS_MAX : 5000} value={body} onChange={(e) => setBody(e.target.value)} />
          {channel === "sms" ? <p className="text-xs text-muted-foreground">Türkçe karakterler (ş, ğ, ı…) bazı operatörlerde SMS'i ikiye bölebilir.</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insert(v)} className="min-h-9 rounded-full border border-border px-3 text-xs">{`{{${v}}}`}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button className="h-11" disabled={saveM.isPending || tooLong || !body.trim()} onClick={() => saveM.mutate()}>Kaydet</Button>
          {row || !def ? null : <span className="self-center text-xs text-muted-foreground">Varsayılan şablon kullanılıyor</span>}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Input className="h-11 flex-1" placeholder={channel === "email" ? "test@ornek.com" : "05xx xxx xx xx"} value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" className="h-11" disabled={testM.isPending || to.length < 5 || !connected} onClick={() => testM.mutate()}>
            <Send className="mr-1 size-4" /> Test gönder
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[375px]">
        <p className="mb-2 text-xs text-muted-foreground">Telefon önizlemesi (375px)</p>
        <div className="rounded-[2rem] border-8 border-foreground/80 bg-background p-3">
          {channel === "email" ? (
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-semibold">{renderTemplate(subject, vars)}</p>
              <p className="whitespace-pre-line text-muted-foreground">{preview}</p>
              <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">Bildirimlerden çık</p>
            </div>
          ) : (
            <div className={`ml-auto max-w-[85%] whitespace-pre-line rounded-2xl p-3 text-sm ${channel === "whatsapp" ? "bg-secondary" : "bg-muted"}`}>
              {channel === "sms" ? `${preview}${SMS_STOP_SUFFIX}` : preview}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Logs({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listNotificationLogs);
  const resend = useServerFn(resendNotification);
  const [channel, setChannel] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const filters = useMemo(() => ({
    storeId,
    ...(channel !== "all" ? { channel: channel as NotifyChannel } : {}),
    ...(status !== "all" ? { status: status as "failed" } : {}),
    ...(from ? { from } : {}), ...(to ? { to } : {}), ...(q ? { q } : {}),
  }), [storeId, channel, status, from, to, q]);
  const { data = [], isLoading } = useQuery({ queryKey: ["customer-notify-logs", filters], queryFn: () => list({ data: filters }) });
  const resendM = useMutation({
    mutationFn: (logId: string) => resend({ data: { storeId, logId } }),
    onSuccess: () => { toast.success("Yeniden gönderildi"); void qc.invalidateQueries({ queryKey: ["customer-notify-logs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 pt-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tüm kanallar</SelectItem>{NOTIFY_CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            <SelectItem value="sent">Gönderildi</SelectItem>
            <SelectItem value="failed">Başarısız</SelectItem>
            <SelectItem value="pending">Bekliyor</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Başlangıç" />
        <Input type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Bitiş" />
        <Input className="col-span-2 h-11 sm:col-span-1" placeholder="Müşteri e-posta/telefon" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {isLoading ? <Skeleton className="h-32 w-full" /> : data.length === 0 ? (
        <p className="surface-card p-6 text-center text-sm text-muted-foreground">Henüz bildirim gönderilmedi.</p>
      ) : (
        <ul className="surface-card divide-y divide-border">
          {data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{EVENT_LABELS[l.event_key as NotifyEvent] ?? l.event_key} · {CHANNEL_LABELS[l.channel as NotifyChannel]}</p>
                <p className="truncate text-xs text-muted-foreground">
                  #{(l.orders as { order_number?: string } | null)?.order_number ?? "—"} · {l.recipient} · {formatDateTime(l.created_at)}
                </p>
                {l.error ? <p className="text-xs text-destructive">{l.error}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={l.status === "sent" ? "secondary" : l.status === "failed" ? "destructive" : "outline"}>
                  {l.status === "sent" ? "Gönderildi" : l.status === "failed" ? "Başarısız" : l.status === "pending" ? "Bekliyor" : l.status}
                </Badge>
                {l.status === "failed" ? (
                  <Button size="sm" variant="outline" className="h-11" disabled={resendM.isPending} onClick={() => resendM.mutate(l.id)}>
                    <RotateCw className="mr-1 size-4" /> Yeniden gönder
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type CarrierRow = { carrier_key: string; customer_number: string | null; credential_hint: unknown; is_active: boolean; is_test_mode: boolean };

function Carriers({ storeId, rows }: { storeId: string; rows: CarrierRow[] }) {
  return (
    <div className="grid gap-3 pt-4 md:grid-cols-2">
      {CARRIERS.map((c) => <CarrierCard key={c.key} storeId={storeId} carrierKey={c.key} name={c.name} row={rows.find((r) => r.carrier_key === c.key)} />)}
    </div>
  );
}

function CarrierCard({ storeId, carrierKey, name, row }: { storeId: string; carrierKey: CarrierKey; name: string; row?: CarrierRow }) {
  const qc = useQueryClient();
  const save = useServerFn(saveCarrierSetting);
  const [active, setActive] = useState(row?.is_active ?? false);
  const [testMode, setTestMode] = useState(row?.is_test_mode ?? true);
  const [customer, setCustomer] = useState(row?.customer_number ?? "");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const hint = (row?.credential_hint ?? {}) as Record<string, string>;
  useEffect(() => { setActive(row?.is_active ?? false); }, [row?.is_active]);
  const m = useMutation({
    mutationFn: () => save({ data: { storeId, carrierKey, customerNumber: customer, apiKey: apiKey || undefined, apiSecret: apiSecret || undefined, isActive: active, isTestMode: testMode } }),
    onSuccess: () => { setApiKey(""); setApiSecret(""); toast.success(`${name} kaydedildi`); void qc.invalidateQueries({ queryKey: ["customer-notify", storeId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const hasApi = API_CARRIERS.includes(carrierKey);
  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-medium"><Truck className="size-4" /> {name}</p>
        <Badge variant={hasApi ? "secondary" : "outline"}>{hasApi ? "Otomatik takip" : "Elle takip"}</Badge>
      </div>
      {!hasApi ? <p className="text-xs text-muted-foreground">Bu firma için otomatik takip bağlantısı henüz yok. Bilgileri kaydedebilirsiniz; bağlantı eklendiğinde kullanılacak.</p> : null}
      <Input className="h-11" placeholder="Müşteri numarası" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      <Input className="h-11" placeholder={hint["api_key"] ? `API anahtarı (${hint["api_key"]})` : "API anahtarı"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
      <Input className="h-11" type="password" placeholder={hint["api_secret"] ? `API şifresi (${hint["api_secret"]})` : "API şifresi"} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} autoComplete="new-password" />
      <div className="flex flex-wrap gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> Aktif</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><Switch checked={testMode} onCheckedChange={setTestMode} /> Test modu</label>
      </div>
      <Button className="h-11 w-full" disabled={m.isPending} onClick={() => m.mutate()}>Kaydet</Button>
    </div>
  );
}
