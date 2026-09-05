import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, MessageSquare, Music2, Plus, Radio, Trash2, Zap } from "lucide-react";

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
  TT_EVENT_TYPE_LABELS,
  TT_KEYWORD_PRESETS,
  TT_MATCH_TYPES,
  TT_MATCH_TYPE_LABELS,
  TT_RULE_SOURCES,
  TT_RULE_SOURCE_LABELS,
  type TtEventType,
  type TtMatchType,
  type TtRuleSource,
} from "@/lib/tiktok";
import {
  tiktokAccountQuery,
  tiktokEventsQuery,
  tiktokInteractionsQuery,
  tiktokProductOptionsQuery,
  tiktokRulesQuery,
  type TiktokRule,
} from "@/lib/tiktok-queries";
import {
  connectTiktokManually,
  deleteTiktokRule,
  disconnectTiktok,
  saveTiktokRule,
  testTiktokRule,
  updateTiktokSettings,
} from "@/lib/tiktok.functions";

/** TikTok DM otomasyon paneli: hesap bağlama, yorum/canlı yayın → DM kuralları, olay akışı. */
export const Route = createFileRoute("/_authenticated/store/$storeId/tiktok")({
  head: () => ({
    meta: [
      { title: "TikTok DM Otomasyonu | Mefticaret" },
      {
        name: "description",
        content:
          "TikTok video ve canlı yayın yorumlarını otomatik DM'e çevir, ürün kartı gönder, gelen mesajları AI ile yanıtla.",
      },
      { property: "og:title", content: "TikTok DM Otomasyonu | Mefticaret" },
      {
        property: "og:description",
        content:
          "Yorum→DM kuralları, canlı yayın satış otomasyonu ve AI destekli TikTok gelen kutusu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TiktokPage,
});

const EMPTY_RULE = {
  name: "",
  keywords: "fiyat, link",
  matchType: "contains" as TtMatchType,
  source: "all" as TtRuleSource,
  targetVideoId: "",
  productId: "",
  dmTemplate: "Selam {{name}}! 👋 Sorduğun ürünün detayları burada, hemen kapabilirsin 👇",
  publicReply: "DM attık, kutuna bak 📩",
  sendProductCard: true,
  replyToComment: true,
  pinProductCard: false,
  priority: 100,
  isActive: true,
};

function TiktokPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const account = useQuery(tiktokAccountQuery(storeId));
  const rules = useQuery(tiktokRulesQuery(storeId));
  const interactions = useQuery(tiktokInteractionsQuery(storeId));
  const events = useQuery(tiktokEventsQuery(storeId));
  const products = useQuery(tiktokProductOptionsQuery(storeId));

  const connectFn = useServerFn(connectTiktokManually);
  const disconnectFn = useServerFn(disconnectTiktok);
  const settingsFn = useServerFn(updateTiktokSettings);
  const saveRuleFn = useServerFn(saveTiktokRule);
  const deleteRuleFn = useServerFn(deleteTiktokRule);
  const testFn = useServerFn(testTiktokRule);

  const [connectForm, setConnectForm] = useState({
    openId: "",
    username: "",
    displayName: "",
    accessToken: "",
  });
  const [ruleForm, setRuleForm] = useState({ ...EMPTY_RULE, ruleId: "" });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [testComment, setTestComment] = useState("Fiyat ne kadar?");
  const [testSource, setTestSource] = useState<"video" | "live">("video");
  const [testResult, setTestResult] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["tiktok", storeId] });
  }

  const connect = useMutation({
    mutationFn: () =>
      connectFn({
        data: {
          storeId,
          openId: connectForm.openId.trim(),
          username: connectForm.username.trim() || null,
          displayName: connectForm.displayName.trim() || null,
          accessToken: connectForm.accessToken.trim(),
          refreshToken: null,
        },
      }),
    onSuccess: () => {
      toast.success("TikTok hesabı bağlandı");
      setConnectForm({ openId: "", username: "", displayName: "", accessToken: "" });
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
      liveAutomationEnabled?: boolean;
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
          source: ruleForm.source,
          targetVideoId: ruleForm.targetVideoId.trim() || null,
          productId: ruleForm.productId || null,
          dmTemplate: ruleForm.dmTemplate.trim(),
          publicReply: ruleForm.publicReply.trim(),
          sendProductCard: ruleForm.sendProductCard,
          replyToComment: ruleForm.replyToComment,
          pinProductCard: ruleForm.pinProductCard,
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
    mutationFn: () => testFn({ data: { storeId, comment: testComment, source: testSource } }),
    onSuccess: (result) => {
      setTestResult(
        result.matched
          ? `"${result.ruleName}" kuralı çalışır (${result.keyword}). DM: ${result.dm}`
          : "Bu yorum hiçbir kuralla eşleşmiyor.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function editRule(rule: TiktokRule) {
    setRuleForm({
      ruleId: rule.id,
      name: rule.name,
      keywords: rule.keywords.join(", "),
      matchType: rule.match_type as TtMatchType,
      source: rule.source as TtRuleSource,
      targetVideoId: rule.target_video_id ?? "",
      productId: rule.product_id ?? "",
      dmTemplate: rule.dm_template,
      publicReply: rule.public_reply,
      sendProductCard: rule.send_product_card,
      replyToComment: rule.reply_to_comment,
      pinProductCard: rule.pin_product_card,
      priority: rule.priority,
      isActive: rule.is_active,
    });
    setRuleOpen(true);
  }

  const connected = Boolean(account.data);
  const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}/api/public/tiktok/${storeId}`;

  return (
    <AppShell
      title="TikTok DM Otomasyonu"
      description="Video ve canlı yayın yorumlarını otomatik DM'e çevir, ürün kartı gönder, gelen mesajları AI ile yanıtla."
    >
      <Tabs defaultValue="account" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="account">
            <Music2 className="mr-2 h-4 w-4" /> Hesap
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
                TikTok Business hesabı
                <Badge variant={connected ? "default" : "outline"}>
                  {connected ? "Bağlı" : "Bağlı değil"}
                </Badge>
              </CardTitle>
              <CardDescription>
                TikTok Open API üzerinden mesaj, video yorumu ve canlı yayın olaylarını dinler.
                Erişim anahtarı yalnızca sunucuda saklanır, panelde hiçbir zaman görüntülenmez.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {account.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : connected ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kullanıcı adı" value={account.data?.username ?? "—"} />
                    <Field label="Görünen ad" value={account.data?.display_name ?? "—"} />
                    <Field label="Hesap kimliği (open_id)" value={account.data?.open_id ?? "—"} />
                    <Field label="Durum" value={account.data?.status_message ?? "—"} />
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">TikTok webhook ayarları</p>
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
                      description="Eşleşen video yorumlarına otomatik özel mesaj gönderilir."
                      checked={account.data?.auto_comment_dm_enabled ?? false}
                      onChange={(checked) => saveSettings.mutate({ autoCommentDmEnabled: checked })}
                    />
                    <ToggleRow
                      label="Canlı yayın otomasyonu"
                      description="Canlı yayın sohbetindeki tetikleyici kelimeler de kural motoruna girer."
                      checked={account.data?.live_automation_enabled ?? false}
                      onChange={(checked) => saveSettings.mutate({ liveAutomationEnabled: checked })}
                    />
                    <ToggleRow
                      label="Otonom AI yanıt"
                      description="Gelen DM'leri AI, güven eşiğinin üzerindeyse kendi yanıtlar."
                      checked={account.data?.autonomous_ai_enabled ?? false}
                      onChange={(checked) => saveSettings.mutate({ autonomousAiEnabled: checked })}
                    />
                    <div className="space-y-2">
                      <Label className="text-sm">
                        AI güven eşiği:{" "}
                        {Number(account.data?.ai_confidence_threshold ?? 0.7).toFixed(2)}
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
                    <Label htmlFor="tt-open">Hesap kimliği (open_id)</Label>
                    <Input
                      id="tt-open"
                      value={connectForm.openId}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, openId: event.target.value }))
                      }
                      placeholder="_0000abcd1234"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tt-username">Kullanıcı adı</Label>
                    <Input
                      id="tt-username"
                      value={connectForm.username}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, username: event.target.value }))
                      }
                      placeholder="magazam"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tt-display">Görünen ad</Label>
                    <Input
                      id="tt-display"
                      value={connectForm.displayName}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, displayName: event.target.value }))
                      }
                      placeholder="Mağazam"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tt-token">Erişim anahtarı</Label>
                    <Input
                      id="tt-token"
                      type="password"
                      value={connectForm.accessToken}
                      onChange={(event) =>
                        setConnectForm((prev) => ({ ...prev, accessToken: event.target.value }))
                      }
                      placeholder="act.…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      disabled={
                        connect.isPending ||
                        !connectForm.openId.trim() ||
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
                <CardTitle>Yorum & canlı yayın → DM kuralları</CardTitle>
                <CardDescription>
                  Anahtar kelime yakalandığında otomatik DM, yorum yanıtı ve ürün kartı gönderilir.
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
                      Şablonlarda {"{{name}}"}, {"{{product}}"}, {"{{price}}"}, {"{{link}}"},{" "}
                      {"{{cart}}"} ve {"{{stock}}"} yer tutucularını kullanabilirsin.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tt-rule-name">Kural adı</Label>
                      <Input
                        id="tt-rule-name"
                        value={ruleForm.name}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Fiyat soranlara link"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tt-rule-keywords">Tetikleyici kelimeler (virgülle)</Label>
                      <Input
                        id="tt-rule-keywords"
                        value={ruleForm.keywords}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, keywords: event.target.value }))
                        }
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {TT_KEYWORD_PRESETS.map((preset) => (
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
                        <Label>Eşleşme tipi</Label>
                        <Select
                          value={ruleForm.matchType}
                          onValueChange={(value) =>
                            setRuleForm((prev) => ({ ...prev, matchType: value as TtMatchType }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TT_MATCH_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {TT_MATCH_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Çalışacağı yer</Label>
                        <Select
                          value={ruleForm.source}
                          onValueChange={(value) =>
                            setRuleForm((prev) => ({ ...prev, source: value as TtRuleSource }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TT_RULE_SOURCES.map((source) => (
                              <SelectItem key={source} value={source}>
                                {TT_RULE_SOURCE_LABELS[source]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="tt-rule-video">Hedef video kimliği (boş = tümü)</Label>
                        <Input
                          id="tt-rule-video"
                          value={ruleForm.targetVideoId}
                          onChange={(event) =>
                            setRuleForm((prev) => ({ ...prev, targetVideoId: event.target.value }))
                          }
                          placeholder="7301234567890123456"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bağlanacak ürün</Label>
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
                            <SelectItem value="none">Ürün yok</SelectItem>
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
                      <Label htmlFor="tt-rule-dm">DM şablonu</Label>
                      <Textarea
                        id="tt-rule-dm"
                        rows={3}
                        value={ruleForm.dmTemplate}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, dmTemplate: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="tt-rule-reply">Herkese açık yorum yanıtı</Label>
                      <Input
                        id="tt-rule-reply"
                        value={ruleForm.publicReply}
                        onChange={(event) =>
                          setRuleForm((prev) => ({ ...prev, publicReply: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border p-3">
                      <ToggleRow
                        label="Ürün kartını DM'e ekle"
                        description="Fiyat, stok ve sepete ekleme bağlantısı mesaja eklenir."
                        checked={ruleForm.sendProductCard}
                        onChange={(checked) =>
                          setRuleForm((prev) => ({ ...prev, sendProductCard: checked }))
                        }
                      />
                      <ToggleRow
                        label="Yoruma herkese açık yanıt ver"
                        description="Yorumun altına kısa bir yanıt bırakılır."
                        checked={ruleForm.replyToComment}
                        onChange={(checked) =>
                          setRuleForm((prev) => ({ ...prev, replyToComment: checked }))
                        }
                      />
                      <ToggleRow
                        label="Video / canlı yayına ürün kartı sabitle"
                        description="TikTok Commercial Content API ile anlık ürün yönlendirme kartı tetiklenir."
                        checked={ruleForm.pinProductCard}
                        onChange={(checked) =>
                          setRuleForm((prev) => ({ ...prev, pinProductCard: checked }))
                        }
                      />
                      <ToggleRow
                        label="Kural aktif"
                        description="Kapatıldığında kural motoru bu kuralı atlar."
                        checked={ruleForm.isActive}
                        onChange={(checked) =>
                          setRuleForm((prev) => ({ ...prev, isActive: checked }))
                        }
                      />
                    </div>

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
            <CardContent className="space-y-2">
              {rules.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (rules.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Henüz kural yok. İlk kuralını oluştur.
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
                          {TT_RULE_SOURCE_LABELS[rule.source as TtRuleSource] ?? rule.source}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {rule.keywords.join(", ") || "tüm yorumlar"} · {rule.triggered_count} tetik ·{" "}
                        {rule.dm_sent_count} DM
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => editRule(rule)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`${rule.name} kuralını sil`}
                        onClick={() => removeRule.mutate(rule.id)}
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
                <Radio className="h-4 w-4" /> Kural testi
              </CardTitle>
              <CardDescription>
                Örnek bir yorum yazarak hangi kuralın tetiklendiğini gönderim yapmadan gör.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={testComment}
                  onChange={(event) => setTestComment(event.target.value)}
                  placeholder="Fiyat ne kadar?"
                />
                <Select
                  value={testSource}
                  onValueChange={(value) => setTestSource(value as "video" | "live")}
                >
                  <SelectTrigger className="sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video yorumu</SelectItem>
                    <SelectItem value="live">Canlı yayın</SelectItem>
                  </SelectContent>
                </Select>
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
              <CardDescription>
                Yakalanan yorumlar, canlı yayın mesajları, gönderilen DM'ler ve gelen mesajlar.
              </CardDescription>
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
                      <span className="font-medium">
                        @{item.username ?? item.tiktok_user_id ?? "bilinmiyor"}
                      </span>
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
                TikTok'tan gelen olaylar sıraya alınır ve arka planda işlenir.
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
                      {TT_EVENT_TYPE_LABELS[event.event_type as TtEventType] ?? event.event_type}
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
