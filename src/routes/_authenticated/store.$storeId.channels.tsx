import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productsQuery } from "@/lib/catalog-queries";
import {
  CAPABILITY_LABELS,
  connectorSupports,
  getMarketplaceConnector,
} from "@/lib/marketplace";
import {
  CHANNEL_STATUS_LABELS,
  LISTING_STATUS_LABELS,
  MARKETPLACE_PROVIDERS,
  channelListingsQuery,
  channelsQuery,
} from "@/lib/channels-queries";
import {
  connectChannel,
  removeChannel,
  removeChannelListing,
  setChannelListings,
  syncChannel,
  updateChannel,
} from "@/lib/channels.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/channels")({
  head: () => {
    const title = "Pazaryeri Kanalları — Mefticaret";
    const description =
      "Trendyol, Hepsiburada, n11, Amazon, Etsy, Shopify, WooCommerce ve 20+ pazaryeri kanalını bağımsız connector modülleriyle bağla; ürün, fiyat, stok ve siparişleri tek panelden yönet.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ChannelsPage,
});

function ChannelsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: channels, isLoading } = useQuery(channelsQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));

  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>(MARKETPLACE_PROVIDERS[0]?.code ?? "trendyol");
  const [selected, setSelected] = useState<string[]>([]);

  const currentChannel =
    (channels ?? []).find((channel) => channel.id === activeChannel) ?? (channels ?? [])[0] ?? null;
  const { data: listings } = useQuery(channelListingsQuery(storeId, currentChannel?.id ?? null));

  const connect = useServerFn(connectChannel);
  const update = useServerFn(updateChannel);
  const remove = useServerFn(removeChannel);
  const setListings = useServerFn(setChannelListings);
  const removeListing = useServerFn(removeChannelListing);
  const sync = useServerFn(syncChannel);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["marketplace-channels", storeId] });
    await queryClient.invalidateQueries({ queryKey: ["channel-listings", storeId] });
  };

  const connectMutation = useMutation({
    mutationFn: () => {
      const meta = MARKETPLACE_PROVIDERS.find((item) => item.code === provider)!;
      return connect({ data: { storeId, provider: meta.code, name: meta.name } });
    },
    onSuccess: async (result) => {
      await invalidate();
      setActiveChannel(result.id);
      toast.success("Kanal eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      channelId: string;
      sellerId?: string | null;
      isActive?: boolean;
      autoSync?: boolean;
      priceMarkupRate?: number;
    }) => update({ data: { storeId, ...input } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (channelId: string) => remove({ data: { storeId, channelId } }),
    onSuccess: async () => {
      setActiveChannel(null);
      await invalidate();
      toast.success("Kanal kaldırıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const listingMutation = useMutation({
    mutationFn: (channelId: string) =>
      setListings({ data: { storeId, channelId, productIds: selected } }),
    onSuccess: async (result) => {
      setSelected([]);
      await invalidate();
      toast.success(`${result.queued} ürün kuyruğa alındı`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncMutation = useMutation({
    mutationFn: (input: { channelId: string; scope: "full" | "price" | "stock" | "orders" }) =>
      sync({ data: { storeId, ...input } }),
    onSuccess: async (result) => {
      await invalidate();
      const parts = [
        `${result.listed} listeleme`,
        `${result.priceUpdated} fiyat`,
        `${result.stockUpdated} stok`,
        `${result.ordersFetched} sipariş`,
      ].join(" · ");
      if (result.dryRun) {
        toast.info(`Kuru çalışma tamamlandı (${parts}). Kimlik bilgisi tanımlı değil.`);
      } else {
        toast.success(`Senkronizasyon tamamlandı: ${parts}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeListingMutation = useMutation({
    mutationFn: (listingId: string) => removeListing({ data: { storeId, listingId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Listeleme kaldırıldı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const usedProviders = new Set((channels ?? []).map((channel) => channel.provider));
  const availableProviders = MARKETPLACE_PROVIDERS.filter((item) => !usedProviders.has(item.code));
  const listedProductIds = new Set((listings ?? []).map((listing) => listing.product_id));
  const listableProducts = (products ?? []).filter(
    (product) => product.status === "active" && !listedProductIds.has(product.id),
  );

  return (
    <AppShell
      storeId={storeId}
      title="Pazaryeri Kanalları"
      description="Ürünlerini pazaryerlerine tek panelden aç, marj ve senkron kurallarını yönet."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (channels ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Store className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Bağlı pazaryeri kanalı yok</p>
              <p className="text-sm text-muted-foreground">
                Sağdaki panelden bir kanal ekleyerek başla.
              </p>
            </div>
          ) : (
            (channels ?? []).map((channel) => {
              const isCurrent = currentChannel?.id === channel.id;
              return (
                <div key={channel.id} className="surface-card space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{channel.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {channel.last_sync_at
                          ? `Son senkron: ${formatDateTime(channel.last_sync_at)}`
                          : "Henüz senkronize edilmedi"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={channel.status === "connected" ? "default" : "secondary"}>
                        {CHANNEL_STATUS_LABELS[channel.status] ?? channel.status}
                      </Badge>
                      {(
                        [
                          { scope: "full" as const, label: "Tümünü senkronize et" },
                          { scope: "price" as const, label: "Fiyat" },
                          { scope: "stock" as const, label: "Stok" },
                          { scope: "orders" as const, label: "Sipariş" },
                        ] satisfies Array<{ scope: "full" | "price" | "stock" | "orders"; label: string }>
                      )
                        .filter(
                          (action) =>
                            action.scope === "full" ||
                            connectorSupports(channel.provider, action.scope),
                        )
                        .map((action) => (
                          <Button
                            key={action.scope}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              syncMutation.mutate({ channelId: channel.id, scope: action.scope })
                            }
                            disabled={syncMutation.isPending}
                          >
                            {action.scope === "full" && <RefreshCw className="mr-1 size-4" />}
                            {action.label}
                          </Button>
                        ))}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMutation.mutate(channel.id)}
                        aria-label="Kanalı kaldır"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(getMarketplaceConnector(channel.provider)?.capabilities ?? []).map(
                      (capability) => (
                        <Badge key={capability} variant="outline">
                          {CAPABILITY_LABELS[capability]}
                        </Badge>
                      ),
                    )}
                    <Badge variant="secondary">
                      Tahmini komisyon %
                      {(
                        (getMarketplaceConnector(channel.provider)?.defaultCommissionRate ?? 0) * 100
                      ).toFixed(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`seller-${channel.id}`}>
                        {getMarketplaceConnector(channel.provider)?.sellerIdLabel ??
                          "Satıcı kimliği"}
                      </Label>
                      <Input
                        id={`seller-${channel.id}`}
                        defaultValue={channel.seller_id ?? ""}
                        placeholder="Örn. 123456"
                        onBlur={(event) =>
                          updateMutation.mutate({
                            channelId: channel.id,
                            sellerId: event.target.value.trim(),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`markup-${channel.id}`}>Fiyat marjı (%)</Label>
                      <Input
                        id={`markup-${channel.id}`}
                        type="number"
                        step="0.5"
                        defaultValue={(Number(channel.price_markup_rate) * 100).toFixed(1)}
                        onBlur={(event) =>
                          updateMutation.mutate({
                            channelId: channel.id,
                            priceMarkupRate: Number(event.target.value || 0) / 100,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={channel.is_active}
                        onCheckedChange={(value) =>
                          updateMutation.mutate({ channelId: channel.id, isActive: value })
                        }
                      />
                      Kanal aktif
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={channel.auto_sync}
                        onCheckedChange={(value) =>
                          updateMutation.mutate({ channelId: channel.id, autoSync: value })
                        }
                      />
                      Otomatik senkron
                    </label>
                    {!isCurrent && (
                      <Button size="sm" variant="ghost" onClick={() => setActiveChannel(channel.id)}>
                        Listelemeleri gör
                      </Button>
                    )}
                  </div>

                  {channel.last_error && (
                    <p className="text-sm text-destructive">{channel.last_error}</p>
                  )}
                </div>
              );
            })
          )}

          {currentChannel && (
            <div className="surface-card space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{currentChannel.name} listelemeleri</p>
                  <p className="text-sm text-muted-foreground">
                    {(listings ?? []).length} ürün bu kanala bağlı.
                  </p>
                </div>
              </div>
              {(listings ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Bu kanalda listelenmiş ürün yok. Sağdan ürün ekle.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {(listings ?? []).map((listing) => (
                    <div
                      key={listing.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-medium">{listing.products?.title ?? "Ürün"}</p>
                        <p className="text-xs text-muted-foreground">
                          {listing.external_id ? `Dış kimlik: ${listing.external_id} · ` : ""}
                          {listing.products
                            ? formatMoney(
                                Number(listing.price_override ?? listing.products.base_price) *
                                  (1 + Number(currentChannel.price_markup_rate)),
                                listing.products.currency,
                              )
                            : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={listing.status === "listed" ? "default" : "secondary"}>
                          {LISTING_STATUS_LABELS[listing.status] ?? listing.status}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Listelemeyi kaldır"
                          onClick={() => removeListingMutation.mutate(listing.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="surface-card space-y-3 p-6">
            <p className="font-semibold">Kanal ekle</p>
            {availableProviders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tüm pazaryerleri bağlandı.</p>
            ) : (
              <>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pazaryeri seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.name} · {item.kind === "platform" ? "Platform" : "Pazaryeri"} (
                        {item.region})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  <Plus className="mr-1 size-4" /> Kanalı bağla
                </Button>
                {(() => {
                  const meta = getMarketplaceConnector(provider);
                  if (!meta) return null;
                  return (
                    <div className="space-y-2 rounded-lg border border-border/60 p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {meta.capabilities.map((capability) => (
                          <Badge key={capability} variant="outline">
                            {CAPABILITY_LABELS[capability]}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gerekli kimlik alanları:{" "}
                        {meta.credentialFields.map((field) => field.label).join(", ")}
                      </p>
                      {meta.notes && (
                        <p className="text-xs text-muted-foreground">{meta.notes}</p>
                      )}
                      <a
                        className="text-xs underline"
                        href={meta.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Sağlayıcı dokümanı
                      </a>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground">
                  API anahtarları veritabanında saklanmaz; yalnızca güvenli referans tutulur.
                </p>
              </>
            )}
          </div>

          {currentChannel && (
            <div className="surface-card space-y-3 p-6">
              <p className="font-semibold">Ürün listele</p>
              {listableProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Listelenebilecek aktif ürün kalmadı.
                </p>
              ) : (
                <>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {listableProducts.map((product) => (
                      <label key={product.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border"
                          checked={selected.includes(product.id)}
                          onChange={(event) =>
                            setSelected((prev) =>
                              event.target.checked
                                ? [...prev, product.id]
                                : prev.filter((id) => id !== product.id),
                            )
                          }
                        />
                        <span className="truncate">{product.title}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={selected.length === 0 || listingMutation.isPending}
                    onClick={() => listingMutation.mutate(currentChannel.id)}
                  >
                    Seçili {selected.length} ürünü kuyruğa al
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
