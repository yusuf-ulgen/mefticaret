import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { cn } from "@/lib/utils";
import {
  whatsappAccountQuery,
  whatsappAutoRepliesQuery,
  whatsappInboxQuery,
  whatsappMessagesQuery,
} from "@/lib/whatsapp-queries";
import {
  deleteAutoReply,
  markConversationRead,
  saveAutoReply,
  saveWhatsAppAccount,
  sendWhatsApp,
  sendWhatsAppCampaign,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Business | Mefticaret" },
      {
        name: "description",
        content:
          "WhatsApp Business API ile gelen/giden mesajlar, şablonlar, sipariş ve kargo bildirimleri, sepet kurtarma, otomatik cevap ve kampanya gönderimi.",
      },
      { property: "og:title", content: "WhatsApp Business | Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanız için WhatsApp gelen kutusu, otomatik cevaplar ve kampanya gönderimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: account } = useQuery(whatsappAccountQuery(storeId));
  const { data: conversations } = useQuery(whatsappInboxQuery(storeId));
  const { data: replies } = useQuery(whatsappAutoRepliesQuery(storeId));

  const [activeId, setActiveId] = useState<string | null>(null);
  const conversation = (conversations ?? []).find((item) => item.id === activeId) ?? null;
  const { data: messages } = useQuery(whatsappMessagesQuery(conversation?.id ?? null));

  const saveAccount = useServerFn(saveWhatsAppAccount);
  const send = useServerFn(sendWhatsApp);
  const markRead = useServerFn(markConversationRead);
  const saveReply = useServerFn(saveAutoReply);
  const removeReply = useServerFn(deleteAutoReply);
  const sendCampaign = useServerFn(sendWhatsAppCampaign);

  const [form, setForm] = useState({
    displayPhone: account?.display_phone ?? "",
    phoneNumberId: account?.phone_number_id ?? "",
    wabaId: account?.waba_id ?? "",
    businessName: account?.business_name ?? "",
    autoReplyEnabled: account?.auto_reply_enabled ?? true,
  });
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState({
    id: null as string | null,
    keyword: "",
    matchType: "contains" as "contains" | "exact" | "starts_with",
    replyBody: "",
  });
  const [campaign, setCampaign] = useState("");

  const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}/api/public/whatsapp/${storeId}`;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["whatsapp-account", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["whatsapp-inbox", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["whatsapp-auto-replies", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", conversation?.id ?? null] }),
    ]);
  };

  const accountMutation = useMutation({
    mutationFn: () =>
      saveAccount({
        data: {
          storeId,
          displayPhone: form.displayPhone,
          phoneNumberId: form.phoneNumberId,
          wabaId: form.wabaId || undefined,
          businessName: form.businessName || undefined,
          autoReplyEnabled: form.autoReplyEnabled,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("WhatsApp hesabı kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          storeId,
          waId: conversation?.wa_id ?? "",
          body: draft,
          contactName: conversation?.contact_name ?? undefined,
        },
      }),
    onSuccess: async (result) => {
      setDraft("");
      await invalidate();
      if (result.status === "sent") toast.success("Mesaj gönderildi");
      else toast.info(result.error ?? "Mesaj kuyruğa alındı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      saveReply({
        data: {
          storeId,
          replyId: reply.id ?? undefined,
          keyword: reply.keyword,
          matchType: reply.matchType,
          replyBody: reply.replyBody,
          isActive: true,
          sortOrder: 0,
        },
      }),
    onSuccess: async () => {
      setReply({ id: null, keyword: "", matchType: "contains", replyBody: "" });
      await invalidate();
      toast.success("Otomatik cevap kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const campaignMutation = useMutation({
    mutationFn: () =>
      sendCampaign({
        data: {
          storeId,
          body: campaign,
          waIds: (conversations ?? []).map((item) => item.wa_id),
        },
      }),
    onSuccess: async (result) => {
      setCampaign("");
      await invalidate();
      toast.success(`${result.sent} gönderildi, ${result.failed} başarısız`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="WhatsApp Business"
      description="Gelen kutusu, giden mesaj, şablon bildirimleri, otomatik cevap ve kampanya gönderimi."
    >
      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Gelen kutusu</TabsTrigger>
          <TabsTrigger value="auto">Otomatik cevap</TabsTrigger>
          <TabsTrigger value="campaign">Kampanya</TabsTrigger>
          <TabsTrigger value="settings">Bağlantı</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="surface-card divide-y divide-border">
            {(conversations ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Henüz görüşme yok.</p>
            ) : (
              (conversations ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    setActiveId(item.id);
                    if (item.unread_count > 0) {
                      await markRead({ data: { storeId, conversationId: item.id } });
                      await invalidate();
                    }
                  }}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    activeId === item.id && "bg-muted",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.contact_name ?? item.wa_id}</span>
                    {item.unread_count > 0 ? (
                      <Badge variant="destructive">{item.unread_count}</Badge>
                    ) : null}
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

          <div className="surface-card flex min-h-[26rem] flex-col p-4">
            {!conversation ? (
              <p className="m-auto text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-2 size-6" /> Soldan bir görüşme seç.
              </p>
            ) : (
              <>
                <header className="border-b border-border pb-3">
                  <h2 className="font-semibold">{conversation.contact_name ?? conversation.wa_id}</h2>
                  <p className="text-xs text-muted-foreground">{conversation.wa_id}</p>
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto py-4">
                  {(messages ?? []).map((message) => (
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
                      </p>
                    </div>
                  ))}
                </div>
                <form
                  className="flex gap-2 border-t border-border pt-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMutation.mutate();
                  }}
                >
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Mesaj yaz…"
                    required
                  />
                  <Button type="submit" disabled={sendMutation.isPending}>
                    <Send className="size-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="auto" className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form
            className="surface-card space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              replyMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Otomatik cevap kuralı</h2>
            <div className="space-y-2">
              <Label htmlFor="ar-keyword">Anahtar kelime</Label>
              <Input
                id="ar-keyword"
                required
                value={reply.keyword}
                onChange={(event) => setReply((r) => ({ ...r, keyword: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Eşleşme</Label>
              <Select
                value={reply.matchType}
                onValueChange={(value) =>
                  setReply((r) => ({ ...r, matchType: value as typeof r.matchType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">İçeriyorsa</SelectItem>
                  <SelectItem value="exact">Tam eşleşme</SelectItem>
                  <SelectItem value="starts_with">İle başlıyorsa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-body">Cevap</Label>
              <Textarea
                id="ar-body"
                rows={4}
                required
                value={reply.replyBody}
                onChange={(event) => setReply((r) => ({ ...r, replyBody: event.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={replyMutation.isPending}>
              Kuralı kaydet
            </Button>
          </form>

          <div className="space-y-3">
            {(replies ?? []).map((item) => (
              <article key={item.id} className="surface-card space-y-1 p-4">
                <header className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{item.keyword}</h3>
                    <p className="text-xs text-muted-foreground">{item.match_type}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setReply({
                          id: item.id,
                          keyword: item.keyword,
                          matchType: item.match_type as "contains" | "exact" | "starts_with",
                          replyBody: item.reply_body,
                        })
                      }
                    >
                      Düzenle
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${item.keyword} kuralını sil`}
                      onClick={async () => {
                        await removeReply({ data: { storeId, replyId: item.id } });
                        await invalidate();
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </header>
                <p className="text-sm text-muted-foreground">{item.reply_body}</p>
              </article>
            ))}
            {(replies ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz kural yok.</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="campaign">
          <form
            className="surface-card max-w-2xl space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              campaignMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Kampanya mesajı</h2>
            <p className="text-sm text-muted-foreground">
              Mesaj, gelen kutusundaki {(conversations ?? []).length} görüşmeye gönderilir. WhatsApp
              politikası gereği 24 saatlik pencere dışında onaylı şablon kullanılmalıdır.
            </p>
            <Textarea
              rows={5}
              required
              value={campaign}
              onChange={(event) => setCampaign(event.target.value)}
              placeholder="Kampanya metni"
            />
            <Button
              type="submit"
              disabled={campaignMutation.isPending || (conversations ?? []).length === 0}
            >
              Kampanyayı gönder
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="settings">
          <form
            className="surface-card max-w-2xl space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              accountMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">WhatsApp Business API bağlantısı</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wa-phone">Görünen numara</Label>
                <Input
                  id="wa-phone"
                  required
                  value={form.displayPhone}
                  onChange={(event) => setForm((f) => ({ ...f, displayPhone: event.target.value }))}
                  placeholder="905xxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-pid">Phone Number ID</Label>
                <Input
                  id="wa-pid"
                  required
                  value={form.phoneNumberId}
                  onChange={(event) => setForm((f) => ({ ...f, phoneNumberId: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-waba">WABA ID</Label>
                <Input
                  id="wa-waba"
                  value={form.wabaId}
                  onChange={(event) => setForm((f) => ({ ...f, wabaId: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-business">İşletme adı</Label>
                <Input
                  id="wa-business"
                  value={form.businessName}
                  onChange={(event) => setForm((f) => ({ ...f, businessName: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Otomatik cevaplar aktif</span>
              <Switch
                checked={form.autoReplyEnabled}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, autoReplyEnabled: checked }))}
              />
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Webhook adresi</p>
              <code className="block break-all text-xs text-muted-foreground">{webhookUrl}</code>
              <p className="font-medium">Doğrulama anahtarı (verify token)</p>
              <code className="block break-all text-xs text-muted-foreground">
                {account?.verify_token ?? "Hesap kaydedilince oluşturulur"}
              </code>
              <p className="text-xs text-muted-foreground">
                Meta uygulamanızda bu adresi ve anahtarı tanımlayın. Mesaj gönderimi için
                WHATSAPP_ACCESS_TOKEN anahtarı gereklidir; tanımlı değilse mesajlar kuyruğa alınır.
              </p>
            </div>
            <Button type="submit" disabled={accountMutation.isPending}>
              Bağlantıyı kaydet
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
