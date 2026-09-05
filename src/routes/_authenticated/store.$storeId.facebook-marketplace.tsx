import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/mefti";
import { FB_CONDITIONS, FB_CONDITION_LABELS, type FbCondition } from "@/lib/facebook-marketplace";
import {
  fbAccountQuery,
  fbListingsQuery,
  fbSyncRunsQuery,
} from "@/lib/facebook-marketplace-queries";
import {
  connectMarketplaceManually,
  disconnectMarketplace,
  previewMarketplaceItems,
  removeMarketplaceItem,
  syncMarketplaceNow,
  updateMarketplaceSettings,
} from "@/lib/facebook-marketplace.functions";

/** Facebook Marketplace paneli: sayfa bağlama, ilan eşitleme ve ilan durumu. */
export const Route = createFileRoute("/_authenticated/store/$storeId/facebook-marketplace")({
  head: () => ({
    meta: [
      { title: "Facebook Marketplace | Mefticaret" },
      {
        name: "description",
        content:
          "Ürünlerini Facebook Marketplace Item API ile yayınla, fiyat ve stokları otomatik eşitle.",
      },
      { property: "og:title", content: "Facebook Marketplace | Mefticaret" },
      {
        property: "og:description",
        content: "Mağaza ürünlerini Facebook Marketplace'e otomatik gönder ve stokları eşitle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplacePage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  queued: "Sırada",
  listed: "Yayında",
  error: "Hata",
  removed: "Kaldırıldı",
};

function MarketplacePage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const accountQuery = useQuery(fbAccountQuery(storeId));
  const listingsQuery = useQuery(fbListingsQuery(storeId));
  const runsQuery = useQuery(fbSyncRunsQuery(storeId));

  const connectFn = useServerFn(connectMarketplaceManually);
  const settingsFn = useServerFn(updateMarketplaceSettings);
  const syncFn = useServerFn(syncMarketplaceNow);
  const previewFn = useServerFn(previewMarketplaceItems);
  const removeFn = useServerFn(removeMarketplaceItem);
  const disconnectFn = useServerFn(disconnectMarketplace);

  const account = accountQuery.data ?? null;

  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [autoSync, setAutoSync] = useState(true);
  const [interval, setIntervalMinutes] = useState(60);
  const [condition, setCondition] = useState<FbCondition>("new");
  const [category, setCategory] = useState("");
  const [shipping, setShipping] = useState(true);
  const [pickup, setPickup] = useState(false);
  const [settingsCatalog, setSettingsCatalog] = useState("");

  useEffect(() => {
    if (!account) return;
    setAutoSync(account.auto_sync);
    setIntervalMinutes(account.sync_interval_minutes);
    setCondition((account.default_condition as FbCondition) ?? "new");
    setCategory(account.default_category ?? "");
    setShipping(account.offer_shipping);
    setPickup(account.offer_local_pickup);
    setSettingsCatalog(account.catalog_id ?? "");
  }, [account]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["fb-marketplace", storeId] });

  const connectMutation = useMutation({
    mutationFn: () =>
      connectFn({
        data: {
          storeId,
          pageId: pageId.trim(),
          pageName: pageName.trim() || null,
          catalogId: catalogId.trim() || null,
          partnerId: null,
          accessToken: accessToken.trim(),
          currency: "TRY",
        },
      }),
    onSuccess: () => {
      toast.success("Facebook sayfası bağlandı");
      setAccessToken("");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      settingsFn({
        data: {
          storeId,
          autoSync,
          syncIntervalMinutes: interval,
          defaultCondition: condition,
          defaultCategory: category.trim() || null,
          offerShipping: shipping,
          offerLocalPickup: pickup,
          catalogId: settingsCatalog.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: (force: boolean) => syncFn({ data: { storeId, force } }),
    onSuccess: (result) => {
      toast.success(
        `Eşitleme bitti · ${result.created} yeni, ${result.updated} güncel, ${result.failed} hata`,
      );
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewFn({ data: { storeId } }),
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (listingId: string) => removeFn({ data: { storeId, listingId } }),
    onSuccess: () => {
      toast.success("İlan kaldırıldı");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectFn({ data: { storeId } }),
    onSuccess: () => {
      toast.success("Bağlantı kaldırıldı");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const listings = listingsQuery.data ?? [];
  const listed = listings.filter((row) => row.status === "listed").length;
  const failed = listings.filter((row) => row.status === "error").length;

  return (
    <AppShell storeId={storeId} title="Facebook Marketplace" description="Ürünlerini Marketplace Item API ile yayınla ve stokları eşitle.">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShoppingBag className="size-6 shrink-0" aria-hidden="true" />
              Facebook Marketplace
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Ürünlerini Marketplace Item API ile yayınla; fiyat ve stok değişiklikleri otomatik
              eşitlensin.
            </p>
          </div>
          {account ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate(false)}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden="true" />
                Şimdi eşitle
              </Button>
              <Button onClick={() => syncMutation.mutate(true)} disabled={syncMutation.isPending}>
                Tümünü yeniden gönder
              </Button>
            </div>
          ) : null}
        </header>

        {accountQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !account ? (
          <Card>
            <CardHeader>
              <CardTitle>Facebook sayfanı bağla</CardTitle>
              <CardDescription>
                Marketplace ilan yetkisi verilmiş sayfanın kimliğini ve sayfa erişim anahtarını gir.
                Anahtar yalnızca sunucuda saklanır, panelde hiçbir zaman görünmez.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fb-page-id">Sayfa kimliği (Page ID)</Label>
                <Input id="fb-page-id" value={pageId} onChange={(e) => setPageId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-page-name">Sayfa adı</Label>
                <Input
                  id="fb-page-name"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-catalog">Katalog / iş ortağı kimliği (opsiyonel)</Label>
                <Input
                  id="fb-catalog"
                  value={catalogId}
                  onChange={(e) => setCatalogId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-token">Sayfa erişim anahtarı</Label>
                <Input
                  id="fb-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={
                    connectMutation.isPending || pageId.trim().length < 3 || accessToken.length < 20
                  }
                >
                  Bağlantıyı tamamla
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="overview">Genel bakış</TabsTrigger>
              <TabsTrigger value="listings">İlanlar</TabsTrigger>
              <TabsTrigger value="settings">Ayarlar</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Bağlı sayfa</CardDescription>
                    <CardTitle className="truncate text-lg">
                      {account.page_name ?? account.page_id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={account.status === "connected" ? "secondary" : "destructive"}>
                      {account.status === "connected" ? "Bağlı" : "Hata"}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Yayındaki ilan</CardDescription>
                    <CardTitle className="text-lg">{listed}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {failed} ilan hata aldı
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Son eşitleme</CardDescription>
                    <CardTitle className="text-lg">
                      {account.last_sync_at ? formatDateTime(account.last_sync_at) : "Henüz yok"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {account.auto_sync ? `Her ${account.sync_interval_minutes} dakikada` : "Manuel"}
                  </CardContent>
                </Card>
              </div>

              {account.last_error ? (
                <Card className="border-destructive/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="size-4" aria-hidden="true" /> Son hata
                    </CardTitle>
                    <CardDescription className="break-words">{account.last_error}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Gönderim önizlemesi</CardTitle>
                    <CardDescription>
                      Gönderilecek ilanları ve eksik alanları gönderim öncesi kontrol et.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => previewMutation.mutate()}
                    disabled={previewMutation.isPending}
                  >
                    Önizle
                  </Button>
                </CardHeader>
                {previewMutation.data ? (
                  <CardContent className="space-y-3">
                    <p className="text-sm">
                      {previewMutation.data.total} ilan hazır ·{" "}
                      <span className={previewMutation.data.invalid ? "text-destructive" : ""}>
                        {previewMutation.data.invalid} eksik
                      </span>
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <thead className="text-muted-foreground text-left">
                          <tr>
                            <th className="py-2">Ürün</th>
                            <th className="py-2">Fiyat</th>
                            <th className="py-2">Stok</th>
                            <th className="py-2">Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewMutation.data.sample.map((row) => (
                            <tr key={row.retailerId} className="border-t">
                              <td className="py-2 pr-2">{row.title}</td>
                              <td className="py-2 pr-2">
                                {row.price} {row.currency}
                              </td>
                              <td className="py-2 pr-2">{row.quantity}</td>
                              <td className="py-2">
                                {row.issues.length === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="size-4" aria-hidden="true" /> Hazır
                                  </span>
                                ) : (
                                  <span className="text-destructive">{row.issues.join(" ")}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                ) : null}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Eşitleme geçmişi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(runsQuery.data ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">Henüz eşitleme yapılmadı.</p>
                  ) : (
                    (runsQuery.data ?? []).map((run) => (
                      <div
                        key={run.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                      >
                        <span>{formatDateTime(run.started_at)}</span>
                        <span className="text-muted-foreground">
                          {run.created_items} yeni · {run.updated_items} güncel ·{" "}
                          {run.failed_items} hata
                        </span>
                        <Badge variant={run.status === "success" ? "secondary" : "destructive"}>
                          {run.status === "success" ? "Başarılı" : run.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="listings">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Marketplace ilanları</CardTitle>
                  <CardDescription>Son 100 ilan gösteriliyor.</CardDescription>
                </CardHeader>
                <CardContent>
                  {listings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Henüz ilan yok. “Şimdi eşitle” ile ürünlerini gönder.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead className="text-muted-foreground text-left">
                          <tr>
                            <th className="py-2">İlan</th>
                            <th className="py-2">Fiyat</th>
                            <th className="py-2">Stok</th>
                            <th className="py-2">Durum</th>
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {listings.map((row) => (
                            <tr key={row.id} className="border-t align-top">
                              <td className="max-w-[220px] truncate py-2 pr-2">
                                {row.retailer_id}
                              </td>
                              <td className="py-2 pr-2">{row.price ?? "-"}</td>
                              <td className="py-2 pr-2">{row.quantity}</td>
                              <td className="py-2 pr-2">
                                <Badge
                                  variant={row.status === "listed" ? "secondary" : "destructive"}
                                >
                                  {STATUS_LABELS[row.status] ?? row.status}
                                </Badge>
                                {row.last_error ? (
                                  <p className="text-destructive mt-1 text-xs break-words">
                                    {row.last_error}
                                  </p>
                                ) : null}
                              </td>
                              <td className="py-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeMutation.mutate(row.id)}
                                  disabled={removeMutation.isPending}
                                  aria-label="İlanı kaldır"
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Eşitleme ayarları</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 sm:col-span-2">
                    <div>
                      <Label htmlFor="fb-auto">Otomatik eşitleme</Label>
                      <p className="text-muted-foreground text-sm">
                        Fiyat ve stok değişiklikleri belirli aralıklarla gönderilir.
                      </p>
                    </div>
                    <Switch id="fb-auto" checked={autoSync} onCheckedChange={setAutoSync} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-interval">Eşitleme aralığı (dakika)</Label>
                    <Input
                      id="fb-interval"
                      type="number"
                      min={15}
                      max={1440}
                      value={interval}
                      onChange={(e) => setIntervalMinutes(Number(e.target.value) || 60)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-condition">Varsayılan ürün durumu</Label>
                    <Select
                      value={condition}
                      onValueChange={(value) => setCondition(value as FbCondition)}
                    >
                      <SelectTrigger id="fb-condition">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FB_CONDITIONS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {FB_CONDITION_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-category">Varsayılan kategori</Label>
                    <Input
                      id="fb-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Örn. Giyim & Aksesuar"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fb-catalog-id">Katalog kimliği</Label>
                    <Input
                      id="fb-catalog-id"
                      value={settingsCatalog}
                      onChange={(e) => setSettingsCatalog(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="fb-shipping">Kargolu satış</Label>
                    <Switch id="fb-shipping" checked={shipping} onCheckedChange={setShipping} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="fb-pickup">Elden teslim</Label>
                    <Switch id="fb-pickup" checked={pickup} onCheckedChange={setPickup} />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      onClick={() => saveSettings.mutate()}
                      disabled={saveSettings.isPending}
                    >
                      Ayarları kaydet
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-base">Bağlantıyı kaldır</CardTitle>
                  <CardDescription>
                    Sayfa bağlantısı ve erişim anahtarı silinir; ilan kayıtları kaldırılır.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    Bağlantıyı kaldır
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
