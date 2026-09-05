import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Instagram, MessageSquare, Plus, Sparkles, Trash2, Zap } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import {
  IG_EVENT_TYPE_LABELS,
  IG_KEYWORD_PRESETS,
  IG_MATCH_TYPES,
  IG_MATCH_TYPE_LABELS,
  type IgEventType,
  type IgMatchType,
} from "@/lib/instagram";
import {
  instagramAccountQuery,
  instagramEventsQuery,
  instagramInteractionsQuery,
  instagramProductOptionsQuery,
  instagramRulesQuery,
  type InstagramRule,
} from "@/lib/instagram-queries";
import {
  connectInstagramManually,
  deleteInstagramRule,
  disconnectInstagram,
  saveInstagramRule,
  testInstagramRule,
  updateInstagramSettings,
} from "@/lib/instagram.functions";

/** Instagram DM otomasyon paneli: hesap bağlama, yorum→DM kuralları, olay akışı. */
export const Route = createFileRoute("/_authenticated/store/$storeId/instagram")({
  head: () => ({
    meta: [
      { title: "Instagram DM Otomasyonu | Mefticaret" },
      {
        name: "description",
        content:
          "Instagram yorumlarını otomatik DM'e çevir, ürün linki gönder, gelen mesajları AI ile yanıtla.",
      },
      { property: "og:title", content: "Instagram DM Otomasyonu | Mefticaret" },
      {
        property: "og:description",
        content:
          "Yorum→DM kuralları, ürün kartlı otomatik yanıtlar ve AI destekli Instagram gelen kutusu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstagramPage,
});

const EMPTY_RULE = {
  name: "",
  keywords: "fiyat, link",
  matchType: "contains" as IgMatchType,
  targetPostId: "",
  productId: "",
  dmTemplate:
    "Merhaba {{name}}! 👋 Sorduğun ürünün detayları aşağıda, hemen sipariş verebilirsin 👇",
  publicReply: "DM'den detayları gönderdim 📩",
  sendProductCard: true,
  replyToComment: true,
  priority: 100,
  isActive: true,
};

function InstagramPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const account = useQuery(instagramAccountQuery(storeId));
  const rules = useQuery(instagramRulesQuery(storeId));
  const interactions = useQuery(instagramInteractionsQuery(storeId));
  const events = useQuery(instagramEventsQuery(storeId));
  const products = useQuery(instagramProductOptionsQuery(storeId));

  const connectFn = useServerFn(connectInstagramManually);
  const disconnectFn = useServerFn(disconnectInstagram);
  const settingsFn = useServerFn(updateInstagramSettings);
  const saveRuleFn = useServerFn(saveInstagramRule);
  const deleteRuleFn = useServerFn(deleteInstagramRule);
  const testFn = useServerFn(testInstagramRule);

  const [connectForm, setConnectForm] = useState({
    igUserId: "",
    igUsername: "",
    pageId: "",
    accessToken: "",
  });
  const [ruleForm, setRuleForm] = useState({ ...EMPTY_RULE, ruleId: "" });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [testComment, setTestComment] = useState("Fiyat nedir?");
  const [testResult, setTestResult] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["instagram", storeId] });
  }

  const connect = useMutation({
    mutationFn: () =>
      connectFn({
        data: {
          storeId,
          igUserId: connectForm.igUserId.trim(),
          igUsername: connectForm.igUsername.trim() || null,
          pageId: connectForm.pageId.trim() || null,
          accessToken: connectForm.accessToken.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Instagram hesabı bağlandı");
      setConnectForm({ igUserId: "", igUsername: "", pageId: "", accessToken: "" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { storeId } }),
    onSuccess: () => {
      toast.success("Bağlantı kaldırıldı");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSettings = useMutation({
    mutationFn: (patch: {
      autoCommentDmEnabled?: boolean;
      autonomousAiEnabled?: boolean;
      aiConfidenceThreshold?: number;
    }) => settingsFn({ data: { storeId, ...patch } }),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveRule = useMutation({
    mutationFn: () =>
      saveRuleFn({
        data: {
          storeId,
          ...(ruleForm.ruleId ? { ruleId: ruleForm.ruleId } : {}),
          name: ruleForm.name.trim(),
          keywords: ruleForm.keywords
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          matchType: ruleForm.matchType,
          targetPostId: ruleForm.targetPostId.trim() || null,
          productId: ruleForm.productId || null,
          dmTemplate: ruleForm.dmTemplate.trim(),
          publicReply: ruleForm.publicReply.trim(),
          sendProductCard: ruleForm.sendProductCard,
          replyToComment: ruleForm.replyToComment,
          priority: ruleForm.priority,
          isActive: ruleForm.isActive,
        },
      }),
    onSuccess: () => {
      toast.success("Kural kaydedildi");
      setRuleOpen(false);
      setRuleForm({ ...EMPTY_RULE, ruleId: "" });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeRule = useMutation({
    mutationFn: (ruleId: string) => deleteRuleFn({ data: { storeId, ruleId } }),
    onSuccess: () => {
      toast.success("Kural silindi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runTest = useMutation({
    mutationFn: () => testFn({ data: { storeId, comment: testComment } }),
    onSuccess: (result) => {
      setTestResult(
        result.matched
          ? `"${result.ruleName}" kuralı çalışır (${result.keyword}). DM: ${result.dm}`
          : "Bu yorum hiçbir kuralla eşleşmiyor.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function editRule(rule: InstagramRule) {
    setRuleForm({
      ruleId: rule.id,
      name: rule.name,
      keywords: rule.keywords.join(", "),
      matchType: rule.match_type as IgMatchType,
      targetPostId: rule.target_post_id ?? "",
      productId: rule.product_id ?? "",
      dmTemplate: rule.dm_template,
      publicReply: rule.public_reply,
      sendProductCard: rule.send_product_card,
      replyToComment: rule.reply_to_comment,
      priority: rule.priority,
      isActive: rule.is_active,
    });
    setRuleOpen(true);
  }

  const connected = Boolean(account.data);
  const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}/api/public/instagram/${storeId}`;

  return (
    <AppShell
      title="Instagram DM Otomasyonu"
      description="Yorumları otomatik DM'e çevir, ürün linki gönder ve gelen mesajları AI ile yanıtla."
    >
      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="account">
            <Instagram className="mr-2 h-4 w-4" /> Hesap
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Zap className="mr-2 h-4 w-4" /> Yorum → DM
          </TabsTrigger>
          <TabsTrigger value="activity">
            <MessageSquare className="mr-2 h-4 w-4" /> Etkinlik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Instagram Professional hesabı
                <Badge variant={connected ? "default" : "outline"}>
                  {connected ? "Bağlı" : "Bağlı değil"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Meta Graph API üzerinden mesaj ve yorum olaylarını dinler. Erişim anahtarı yalnızca
                sunucuda saklanır, panelde hiçbir zaman görüntülenmez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {account.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : connected ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kullanıcı adı" value={account.data?.ig_username ?? "—"} />
                    <Field label="Instagram kimliği" value={account.data?.ig_user_id ?? "—"} />
                    <Field label="Sayfa" value={account.data?.page_name ?? account.data?.page_id ?? "—"} />
                    <Field label="Durum" value={account.data?.status_message ?? "—"} />
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">Meta webhook ayarları</p>
                    <p className="break-all text-xs text-muted-foreground">
                      Callback URL: {webhookUrl}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      Verify token: {account.data?.verify_token}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <ToggleRow
                      label="Yorumlara otomatik DM"
                      description="Eşleşen yorumlara otomatik özel mesaj gönderilir."
                      checked={account.data?.auto_comment_dm_enabled ?? false}
                      onChange={(checked) =>
                        saveSettings.mutate({ autoCommentDmEnabled: checked })
                      }
                    />
                    <ToggleRow
                      label="Otonom AI yanıt"
                      description="Gelen DM'leri AI, güven eşiğinin üzerindeyse kendi yanıtlar."
                      checked={account.data?.autonomous_ai_enabled ?? false}
                      onChange={(checked) => saveSettings.mutate({ autonomousAiEnabled: checked })}
                    />
                    <div className="space-y-2">
                      <Label className="text-sm">
                        AI güven eşiği: {(Number(account.data?.ai_confidence_threshold ?? 0.7)).toFixed(2)}
                      </Label>
                      <Slider
                        min={0.3}
                        max={1}
                        step={0.05}
                        value={[Number(account.data?.ai_confidence_threshold ?? 0.7)]}
                        onValueCommit={(value) =>
                          saveSettings.mutate({ aiConfidenceThreshold: value[0] ?? 0.7 })
                        }
                      />
                    </div>
                  </div>

                  <Button variant="outline" onClick={() => disconnect.mutate()}>
                    Bağlantıyı kaldır
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ig-user">Instagram hesap kimliği</Label>
                    <Input
                      id="ig-user"
                      value={connectForm.igUserId}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, igUserId: event.target.value }))
                      }
                      placeholder="17841400000000000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ig-username">Kullanıcı adı</Label>
                    <Input
                      id="ig-username"
                      value={connectForm.igUsername}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, igUsername: event.target.value }))
                      }
                      placeholder="magazam"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ig-page">Facebook sayfa kimliği</Label>
                    <Input
                      id="ig-page"
                      value={connectForm.pageId}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, pageId: event.target.value }))
                      }
                      placeholder="1029384756"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ig-token">Sayfa erişim anahtarı</Label>
                    <Input
                      id="ig-token"
                      type="password"
                      value={connectForm.accessToken}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, accessToken: event.target.value }))
                      }
                      placeholder="EAAG…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      disabled={
                        connect.isPending ||
                        !connectForm.igUserId.trim() ||
                        connectForm.accessToken.trim().length < 20
                      }
                      onClick={() => connect.mutate()}
                    >
                      Hesabı bağla
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Yorum → DM kuralları</CardTitle>
                <CardDescription>
                  Anahtar kelime yakalandığında otomatik DM ve yorum yanıtı gönderilir.
                </CardDescription>
              </div>
              <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setRuleForm({ ...EMPTY_RULE, ruleId: "" })}>
                    <Plus className="mr-2 h-4 w-4" /> Yeni kural
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{ruleForm.ruleId ? "Kuralı düzenle" : "Yeni kural"}</DialogTitle>
                    <DialogDescription>
                      Şablonlarda {"{{name}}"}, {"{{product}}"}, {"{{price}}"}, {"{{link}}"} ve{" "}
                      {"{{cart}}"} yer tutucularını kullanabilirsin.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="rule-name">Kural adı</Label>
                      <Input
                        id="rule-name"
                        value={ruleForm.name}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Fiyat soranlara ürün linki"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rule-keywords">Anahtar kelimeler (virgülle)</Label>
                      <Input
                        id="rule-keywords"
                        value={ruleForm.keywords}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, keywords: event.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {IG_KEYWORD_PRESETS.map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setRuleForm((prev) => ({
                                ...prev,
                                keywords: prev.keywords
                                  ? `${prev.keywords}, ${preset}`
                                  : preset,
                              }))
                            }
                          >
                            {preset}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Eşleşme türü</Label>
                        <Select
                          value={ruleForm.matchType}
                          onValueChange={(value) =>
                            setRuleForm((prev) => ({ ...prev, matchType: value as IgMatchType }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IG_MATCH_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {IG_MATCH_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bağlı ürün</Label>
                        <Select
                          value={ruleForm.productId || "none"}
                          onValueChange={(value) =>
                            setRuleForm((prev) => ({
                              ...prev,
                              productId: value === "none" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Ürün seç" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ürün bağlama</SelectItem>
                            {(products.data ?? []).map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rule-post">Yalnızca bu gönderi (isteğe bağlı)</Label>
                      <Input
                        id="rule-post"
                        value={ruleForm.targetPostId}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, targetPostId: event.target.value }))
                        }
                        placeholder="Gönderi (media) kimliği"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rule-dm">DM mesajı</Label>
                      <Textarea
                        id="rule-dm"
                        rows={3}
                        value={ruleForm.dmTemplate}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, dmTemplate: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rule-reply">Yorum altına yanıt</Label>
                      <Input
                        id="rule-reply"
                        value={ruleForm.publicReply}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, publicReply: event.target.value }))
                        }
                      />
                    </div>
                    <ToggleRow
                      label="Ürün kartı ekle"
                      description="DM'e ürün adı, fiyatı, stok durumu ve sepet linki eklenir."
                      checked={ruleForm.sendProductCard}
                      onChange={(checked) =>
                        setRuleForm((prev) => ({ ...prev, sendProductCard: checked }))
                      }
                    />
                    <ToggleRow
                      label="Yoruma herkese açık yanıt ver"
                      description="Yorum altına kısa bir bilgi mesajı bırakılır."
                      checked={ruleForm.replyToComment}
                      onChange={(checked) =>
                        setRuleForm((prev) => ({ ...prev, replyToComment: checked }))
                      }
                    />
                    <ToggleRow
                      label="Kural aktif"
                      description="Kapalıyken bu kural hiç çalışmaz."
                      checked={ruleForm.isActive}
                      onChange={(checked) => setRuleForm((prev) => ({ ...prev, isActive: checked }))}
                    />
                    <Button
                      className="w-full"
                      disabled={saveRule.isPending || ruleForm.name.trim().length < 2}
                      onClick={() => saveRule.mutate()}
                    >
                      Kaydet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (rules.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Henüz kural yok. İlk kuralını ekleyerek yorumları satışa çevir.
                </p>
              ) : (
                (rules.data ?? []).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.is_active ? "default" : "outline"}>
                          {rule.is_active ? "Aktif" : "Kapalı"}
                        </Badge>
                        <Badge variant="outline">
                          {IG_MATCH_TYPE_LABELS[rule.match_type as IgMatchType] ?? rule.match_type}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {rule.keywords.join(", ") || "tüm yorumlar"} · {rule.triggered_count} tetikleme
                        · {rule.dm_sent_count} DM
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => editRule(rule)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeRule.mutate(rule.id)}
                        aria-label={`${rule.name} kuralını sil`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Kural testi
              </CardTitle>
              <CardDescription>
                Örnek bir yorum yazıp hangi kuralın çalışacağını gerçek gönderim yapmadan gör.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={testComment}
                  onChange={(event) => setTestComment(event.target.value)}
                  placeholder="Fiyat nedir?"
                />
                <Button disabled={runTest.isPending} onClick={() => runTest.mutate()}>
                  Test et
                </Button>
              </div>
              {testResult ? (
                <p className="rounded-md bg-muted p-3 text-sm">{testResult}</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Son etkileşimler</CardTitle>
              <CardDescription>Yakalanan yorumlar, gönderilen DM'ler ve gelen mesajlar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {interactions.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (interactions.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz etkileşim kaydı yok.</p>
              ) : (
                (interactions.data ?? []).map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.kind}</Badge>
                      <span className="font-medium">@{item.username ?? item.ig_user_id ?? "bilinmiyor"}</span>
                      <Badge variant={item.dm_status === "sent" ? "default" : "outline"}>
                        DM: {item.dm_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-muted-foreground">{item.text ?? "—"}</p>
                    {item.error ? (
                      <p className="mt-1 text-xs text-destructive">{item.error}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-4 w-4" /> Olay kuyruğu
              </CardTitle>
              <CardDescription>
                Meta'dan gelen olaylar sıraya alınır ve arka planda işlenir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (events.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Kuyruk boş.</p>
              ) : (
                (events.data ?? []).map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span>
                      {IG_EVENT_TYPE_LABELS[event.event_type as IgEventType] ?? event.event_type}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={event.status === "processed" ? "default" : "outline"}>
                        {event.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-all text-sm font-medium">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
