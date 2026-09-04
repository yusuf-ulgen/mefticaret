import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bot, Gift, Link2, MessageSquare, Package, Send, Settings } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { cn } from "@/lib/utils";
import {
  OMNI_AUTO_REPLY_KINDS,
  OMNI_AUTO_REPLY_KIND_LABELS,
  OMNI_CHANNELS,
  OMNI_CONVERSATION_STATUSES,
  OMNI_STATUS_LABELS,
  OMNI_TAG_PRESETS,
  channelLabel,
  statusLabel,
} from "@/lib/omni";
import {
  omniAssigneesQuery,
  omniAutoRepliesQuery,
  omniChannelAccountsQuery,
  omniConversationsQuery,
  omniInboxStatsQuery,
  omniMessagesQuery,
  omniQuickRepliesQuery,
} from "@/lib/omni-queries";
import {
  assignConversation,
  markConversationRead,
  saveAutoReply,
  saveChannelAccount,
  saveInternalNote,
  sendOmniMessage,
  setConversationStatus,
  setConversationTags,
  suggestAiReply,
  testChannelAccount,
  upsertQuickReply,
} from "@/lib/omni.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/inbox")({
  head: () => ({
    meta: [
      { title: "Omni-Channel Mesaj Merkezi | Mefticaret" },
      {
        name: "description",
        content:
          "Instagram, TikTok, Messenger, Telegram, canlı destek, e-posta, pazaryeri ve WhatsApp mesajlarını tek gelen kutusundan yönet.",
      },
      { property: "og:title", content: "Omni-Channel Mesaj Merkezi | Mefticaret" },
      {
        property: "og:description",
        content: "Tüm kanallardan gelen mesajları tek panelden yanıtla, AI önerileriyle hızlan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function formatSeconds(value: number | null): string {
  if (value == null) return "—";
  if (value < 60) return `${value} sn`;
  const minutes = Math.round(value / 60);
  return `${minutes} dk`;
}

function InboxPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("inbox");

  const filters = useMemo(
    () => ({
      channel: channelFilter === "all" ? null : channelFilter,
      status: statusFilter === "all" ? null : statusFilter,
      unreadOnly,
      search: search || null,
    }),
    [channelFilter, statusFilter, unreadOnly, search],
  );

  const { data: conversations, isLoading: loadingConversations } = useQuery(
    omniConversationsQuery(storeId, filters),
  );
  const { data: stats } = useQuery(omniInboxStatsQuery(storeId));
  const { data: quickReplies } = useQuery(omniQuickRepliesQuery(storeId));
  const { data: autoReplies } = useQuery(omniAutoRepliesQuery(storeId));
  const { data: channelAccounts } = useQuery(omniChannelAccountsQuery(storeId));
  const { data: assignees } = useQuery(omniAssigneesQuery(storeId));

  const conversation = (conversations ?? []).find((item) => item.id === activeId) ?? null;
  const { data: messages, isLoading: loadingMessages } = useQuery(omniMessagesQuery(conversation?.id ?? null));

  const send = useServerFn(sendOmniMessage);
  const markRead = useServerFn(markConversationRead);
  const assign = useServerFn(assignConversation);
  const setStatus = useServerFn(setConversationStatus);
  const setTags = useServerFn(setConversationTags);
  const saveNote = useServerFn(saveInternalNote);
  const suggestReply = useServerFn(suggestAiReply);
  const saveQuickReply = useServerFn(upsertQuickReply);
  const saveAutoReplyRule = useServerFn(saveAutoReply);
  const saveChannel = useServerFn(saveChannelAccount);
  const testChannel = useServerFn(testChannelAccount);

  const [note, setNote] = useState("");
  const [quickReplyForm, setQuickReplyForm] = useState({ title: "", body: "" });
  const [autoReplyForm, setAutoReplyForm] = useState({
    kind: "greeting" as (typeof OMNI_AUTO_REPLY_KINDS)[number],
    body: "",
  });
  const [channelForm, setChannelForm] = useState({
    channel: "whatsapp" as (typeof OMNI_CHANNELS)[number],
    accountName: "",
    credentialsRaw: "",
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["omni-conversations", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["omni-inbox-stats", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["omni-messages", conversation?.id ?? null] }),
      queryClient.invalidateQueries({ queryKey: ["omni-quick-replies", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["omni-auto-replies", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["omni-channel-accounts", storeId] }),
    ]);
  };

  const sendMutation = useMutation({
    mutationFn: (body: string) => send({ data: { storeId, conversationId: conversation!.id, body } }),
    onSuccess: async () => {
      setDraft("");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aiMutation = useMutation({
    mutationFn: () => suggestReply({ data: { storeId, conversationId: conversation!.id } }),
    onSuccess: (result) => {
      setDraft(result.text);
      toast.success("AI cevap önerisi hazır");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      setStatus({ data: { storeId, conversationId: conversation!.id, status: status as never } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: string | null) => assign({ data: { storeId, conversationId: conversation!.id, assignedTo } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const tagsMutation = useMutation({
    mutationFn: (tags: string[]) => setTags({ data: { storeId, conversationId: conversation!.id, tags } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: () => saveNote({ data: { storeId, conversationId: conversation!.id, note } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Not kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const quickReplyMutation = useMutation({
    mutationFn: () =>
      saveQuickReply({ data: { storeId, title: quickReplyForm.title, body: quickReplyForm.body, sortOrder: 0 } }),
    onSuccess: async () => {
      setQuickReplyForm({ title: "", body: "" });
      await invalidate();
      toast.success("Hızlı cevap kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const autoReplyMutation = useMutation({
    mutationFn: () =>
      saveAutoReplyRule({ data: { storeId, kind: autoReplyForm.kind, body: autoReplyForm.body, isActive: true } }),
    onSuccess: async () => {
      setAutoReplyForm({ kind: "greeting", body: "" });
      await invalidate();
      toast.success("Otomatik cevap kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const channelMutation = useMutation({
    mutationFn: () => {
      let credentials: Record<string, string> = {};
      try {
        credentials = channelForm.credentialsRaw ? JSON.parse(channelForm.credentialsRaw) : {};
      } catch {
        throw new Error("Kimlik bilgileri geçerli JSON olmalı, örn: {\"access_token\":\"...\"}");
      }
      return saveChannel({
        data: {
          storeId,
          channel: channelForm.channel,
          accountName: channelForm.accountName,
          credentials,
          isActive: true,
        },
      });
    },
    onSuccess: async () => {
      setChannelForm({ channel: "whatsapp", accountName: "", credentialsRaw: "" });
      await invalidate();
      toast.success("Kanal hesabı kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: (accountId: string) => testChannel({ data: { storeId, accountId } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.info(result.status_message ?? "Kontrol edildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="Omni-Channel Mesaj Merkezi"
      description="Instagram, TikTok, Messenger, Telegram, canlı destek, e-posta, pazaryeri ve WhatsApp mesajlarını tek yerden yönet."
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Günlük mesaj" value={stats?.todayMessages ?? "—"} />
        <StatCard label="Cevaplanmamış" value={stats?.unanswered ?? "—"} />
        <StatCard label="Ort. ilk cevap" value={formatSeconds(stats?.avgFirstResponseSeconds ?? null)} />
        <StatCard label="AI ile cevaplanan" value={stats?.aiAnswered ?? "—"} />
        <StatCard label="Satışa dönüşen" value={stats?.convertedToOrder ?? "—"} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Gelen kutusu</TabsTrigger>
          <TabsTrigger value="channels">Kanallar</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr_300px]">
          <div className="surface-card flex flex-col">
            <div className="space-y-2 border-b border-border p-3">
              <Input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={channelFilter === "all" ? "default" : "outline"}
                  onClick={() => setChannelFilter("all")}
                >
                  Tümü
                </Button>
                {OMNI_CHANNELS.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={channelFilter === c ? "default" : "outline"}
                    onClick={() => setChannelFilter(c)}
                  >
                    {channelLabel(c)}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm durumlar</SelectItem>
                    {OMNI_CONVERSATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {OMNI_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 text-xs">
                  <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} />
                  Okunmamış
                </div>
              </div>
            </div>
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {loadingConversations ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (conversations ?? []).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Henüz görüşme yok.</p>
              ) : (
                (conversations ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={async () => {
                      setActiveId(item.id);
                      setNote(item.internal_note ?? "");
                      if (item.unread_count > 0) {
                        await markRead({ data: { storeId, conversationId: item.id } });
                        await invalidate();
                      }
                    }}
                    className={cn(
                      "w-full px-3 py-3 text-left transition-colors hover:bg-muted/60",
                      activeId === item.id && "bg-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.participant_name ?? item.participant_handle}</span>
                      {item.unread_count > 0 ? <Badge variant="destructive">{item.unread_count}</Badge> : null}
                    </span>
                    <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                      <Badge variant="secondary">{channelLabel(item.channel)}</Badge>
                      <Badge variant="outline">{statusLabel(item.status)}</Badge>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.last_message_preview ?? "—"}
                    </span>
                    <span className="block text-[0.65rem] text-muted-foreground">
                      {formatDateTime(item.last_message_at)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="surface-card flex min-h-[30rem] flex-col p-4">
            {!conversation ? (
              <p className="m-auto text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 size-6" /> Soldan bir görüşme seç.
              </p>
            ) : (
              <>
                <header className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="font-semibold">{conversation.participant_name ?? conversation.participant_handle}</h2>
                    <p className="text-xs text-muted-foreground">
                      {channelLabel(conversation.channel)} · {conversation.participant_handle}
                    </p>
                  </div>
                  <Select value={conversation.status} onValueChange={(v) => statusMutation.mutate(v)}>
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OMNI_CONVERSATION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {OMNI_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </header>

                <div className="flex-1 space-y-2 overflow-y-auto py-4">
                  {loadingMessages ? (
                    <Skeleton className="h-10 w-2/3" />
                  ) : (messages ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Henüz mesaj yok.</p>
                  ) : (
                    (messages ?? []).map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          message.direction === "outbound"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-muted",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="pt-1 text-[0.65rem] opacity-70">
                          {formatDateTime(message.created_at)} · {message.status}
                          {message.is_ai ? " · AI" : ""}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {(quickReplies ?? []).length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {(quickReplies ?? []).map((qr) => (
                      <Button key={qr.id} size="sm" variant="outline" onClick={() => setDraft(qr.body)}>
                        {qr.title}
                      </Button>
                    ))}
                  </div>
                ) : null}

                <div className="mb-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending}>
                    <Bot className="mr-1 size-4" /> AI cevap öner
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Katalogdan ürün seçimi gelen kutusu içinden yapılamaz, ürün sayfasından paylaşın">
                    <Package className="mr-1 size-4" /> Ürün kartı
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Kupon paylaşımı için Kuponlar sayfasını kullanın">
                    <Gift className="mr-1 size-4" /> Kupon
                  </Button>
                  <Button size="sm" variant="outline" disabled title="Sipariş linki için ilgili sipariş sayfasını kullanın">
                    <Link2 className="mr-1 size-4" /> Sipariş linki
                  </Button>
                </div>

                <form
                  className="flex gap-2 border-t border-border pt-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.trim()) return;
                    sendMutation.mutate(draft.trim());
                  }}
                >
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Mesaj yazın..."
                    className="min-h-[2.5rem] flex-1"
                  />
                  <Button type="submit" disabled={sendMutation.isPending}>
                    <Send className="size-4" />
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="space-y-3">
            {!conversation ? (
              <div className="surface-card p-4 text-sm text-muted-foreground">Görüşme seçildiğinde müşteri bilgisi burada görünür.</div>
            ) : (
              <>
                <CustomerCard storeId={storeId} conversation={conversation} />
                <div className="surface-card space-y-2 p-4">
                  <Label>Etiketler</Label>
                  <div className="flex flex-wrap gap-1">
                    {OMNI_TAG_PRESETS.map((tag) => {
                      const active = conversation.tags?.includes(tag);
                      return (
                        <Badge
                          key={tag}
                          variant={active ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = conversation.tags ?? [];
                            const next = active ? current.filter((t) => t !== tag) : [...current, tag];
                            tagsMutation.mutate(next);
                          }}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="surface-card space-y-2 p-4">
                  <Label>Atanan kişi</Label>
                  <Select
                    value={conversation.assigned_to ?? "none"}
                    onValueChange={(v) => assignMutation.mutate(v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Atanmadı</SelectItem>
                      {(assignees ?? []).map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.full_name ?? person.email ?? person.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="surface-card space-y-2 p-4">
                  <Label>Dahili not</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                  <Button size="sm" onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending}>
                    Notu kaydet
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <div className="surface-card p-4">
            <h3 className="mb-3 font-semibold">Kanal hesapları</h3>
            <div className="mb-4 space-y-2">
              {(channelAccounts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kanal hesabı eklenmedi.</p>
              ) : (
                (channelAccounts ?? []).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {channelLabel(acc.channel)} · {acc.account_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{acc.status_message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={acc.status === "connected" ? "default" : "destructive"}>{acc.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => testMutation.mutate(acc.id)}>
                        <Settings className="mr-1 size-3" /> Kontrol et
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label>Kanal</Label>
                <Select
                  value={channelForm.channel}
                  onValueChange={(v) => setChannelForm((f) => ({ ...f, channel: v as never }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OMNI_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {channelLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hesap adı</Label>
                <Input
                  value={channelForm.accountName}
                  onChange={(e) => setChannelForm((f) => ({ ...f, accountName: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Kimlik bilgileri (JSON)</Label>
                <Textarea
                  placeholder='{"access_token":"...", "phone_number_id":"..."}'
                  value={channelForm.credentialsRaw}
                  onChange={(e) => setChannelForm((f) => ({ ...f, credentialsRaw: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={() => channelMutation.mutate()} disabled={channelMutation.isPending}>
              Kanal hesabını kaydet
            </Button>
          </div>

          <div className="surface-card p-4">
            <h3 className="mb-3 font-semibold">Otomatik cevaplar</h3>
            <div className="mb-4 space-y-2">
              {(autoReplies ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz otomatik cevap kuralı yok.</p>
              ) : (
                (autoReplies ?? []).map((rule) => (
                  <div key={rule.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{OMNI_AUTO_REPLY_KIND_LABELS[rule.kind as never] ?? rule.kind}</p>
                    <p className="text-xs text-muted-foreground">{rule.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label>Tür</Label>
                <Select
                  value={autoReplyForm.kind}
                  onValueChange={(v) => setAutoReplyForm((f) => ({ ...f, kind: v as never }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OMNI_AUTO_REPLY_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {OMNI_AUTO_REPLY_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Mesaj</Label>
                <Textarea
                  value={autoReplyForm.body}
                  onChange={(e) => setAutoReplyForm((f) => ({ ...f, body: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={() => autoReplyMutation.mutate()} disabled={autoReplyMutation.isPending}>
              Otomatik cevabı kaydet
            </Button>
          </div>

          <div className="surface-card p-4">
            <h3 className="mb-3 font-semibold">Hızlı cevaplar</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {(quickReplies ?? []).map((qr) => (
                <Badge key={qr.id} variant="outline">
                  {qr.title}
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label>Başlık</Label>
                <Input
                  value={quickReplyForm.title}
                  onChange={(e) => setQuickReplyForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Mesaj</Label>
                <Input
                  value={quickReplyForm.body}
                  onChange={(e) => setQuickReplyForm((f) => ({ ...f, body: e.target.value }))}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={() => quickReplyMutation.mutate()} disabled={quickReplyMutation.isPending}>
              Hızlı cevap ekle
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function CustomerCard({
  storeId,
  conversation,
}: {
  storeId: string;
  conversation: { participant_name: string | null; participant_handle: string; channel: string };
}) {
  return (
    <div className="surface-card space-y-1 p-4 text-sm">
      <p className="font-semibold">{conversation.participant_name ?? conversation.participant_handle}</p>
      <p className="text-xs text-muted-foreground">
        {channelLabel(conversation.channel)} · {conversation.participant_handle}
      </p>
      <p className="text-xs text-muted-foreground">Mağaza: {storeId.slice(0, 8)}…</p>
    </div>
  );
}
