import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Loader2, Megaphone, Smartphone, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPushOverview, sendAdminPush } from "@/lib/admin-push.functions";

export const Route = createFileRoute("/_authenticated/admin/push")({
  head: () => ({
    meta: [
      { title: "Push Bildirimleri — Süper Admin" },
      { name: "description", content: "Firebase üzerinden mobil uygulamalara platform duyurusu gönderin." },
      { property: "og:title", content: "Push Bildirimleri — Süper Admin" },
      { property: "og:description", content: "Firebase üzerinden mobil uygulamalara platform duyurusu gönderin." },
    ],
  }),
  component: AdminPushPage,
});

function AdminPushPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["admin-push-overview"], queryFn: () => fetchPushOverview() });

  const [storeId, setStoreId] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");

  const send = useMutation({
    mutationFn: () =>
      sendAdminPush({
        data: {
          storeId: storeId === "all" ? null : storeId,
          title,
          body,
          imageUrl,
          deepLink,
        },
      }),
    onSuccess: (result) => {
      toast.success(`${result.total} mağazadan ${result.sent} tanesine duyuru gönderildi.`);
      setTitle("");
      setBody("");
      setImageUrl("");
      setDeepLink("");
      void queryClient.invalidateQueries({ queryKey: ["admin-push-overview"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gönderim başarısız"),
  });

  const data = overview.data;

  return (
    <AdminShell
      title="Push Bildirimleri"
      description="Firebase (FCM) üzerinden mobil uygulaması yayında olan mağazalara duyuru gönderin."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="size-4" /> Yeni duyuru
              </CardTitle>
              <CardDescription>Tüm mağazalara veya seçtiğiniz tek mağazaya anlık bildirim gönderir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="push-target">Hedef</Label>
                <select
                  id="push-target"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Tüm mağazalar ({data?.stores.length ?? 0})</option>
                  {(data?.stores ?? []).map((s) => (
                    <option key={s.storeId} value={s.storeId}>
                      {s.name} ({s.devices.total} cihaz)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="push-title">Başlık</Label>
                <Input
                  id="push-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Örn. Yeni sezon ürünleri yayında"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="push-body">Mesaj</Label>
                <Textarea
                  id="push-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Kısa ve net bir duyuru metni yazın."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="push-image">Görsel URL (opsiyonel)</Label>
                  <Input
                    id="push-image"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="push-link">Derin bağlantı (opsiyonel)</Label>
                  <Input
                    id="push-link"
                    value={deepLink}
                    onChange={(e) => setDeepLink(e.target.value)}
                    placeholder="mefticaret://home"
                  />
                </div>
              </div>
              <Button
                onClick={() => send.mutate()}
                disabled={send.isPending || title.trim().length < 3 || body.trim().length < 3 || !data?.providerConfigured}
                className="gap-2"
              >
                {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
                Gönder
              </Button>
              {data && !data.providerConfigured ? (
                <p className="text-sm text-destructive">
                  Firebase bağlantısı yapılandırılmamış; gönderim için bağlayıcının bağlı olması gerekir.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gönderim geçmişi</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.campaigns ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kampanya kaydı yok.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(data?.campaigns ?? []).map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.storeName} · {c.body}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={c.status === "sent" ? "default" : "secondary"}>
                          {c.status === "sent" ? "Gönderildi" : "Kuyrukta"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {c.recipients_count} alıcı · {new Date(c.created_at).toLocaleDateString("tr-TR")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Firebase durumu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {data?.providerConfigured ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600" /> Bağlı — Firebase Cloud Messaging aktif
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-destructive" /> Bağlı değil
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="size-4" /> Toplam kayıtlı cihaz: {data?.totalDevices ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uygulaması yayında olan mağazalar</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.stores ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz yayınlanmış mobil uygulama yok.</p>
              ) : (
                <ul className="space-y-3">
                  {(data?.stores ?? []).map((s) => (
                    <li key={s.storeId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">v{s.version} · /{s.slug}</p>
                      </div>
                      <Badge variant="outline">{s.devices.total} cihaz</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
