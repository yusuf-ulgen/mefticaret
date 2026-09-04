import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, RefreshCcw, Rss } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/mefti";
import {
  storeCategoriesLiteQuery,
  storeProductFeedsQuery,
} from "@/lib/marketing-tools-queries";
import {
  rebuildStoreProductFeed,
  rotateStoreFeedToken,
  saveStoreProductFeed,
} from "@/lib/marketing-tools.functions";
import { storeQuery } from "@/lib/store-queries";
import { FEED_KIND_FORMAT, FEED_KIND_LABELS, FEED_KINDS, type FeedKind } from "@/lib/popups";

export const Route = createFileRoute("/_authenticated/store/$storeId/feeds")({
  head: () => {
    const title = "Ürün Akışları — Mefticaret";
    const description =
      "Google Shopping, TikTok Shop, Instagram Shop ve Facebook Catalog için otomatik ürün akışlarını yönetin.";
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
  errorComponent: () => (
    <AppShell title="Ürün Akışları" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Ürün Akışları" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız akış bulunamadı.
      </div>
    </AppShell>
  ),
  component: FeedsPage,
});

type FeedRow = NonNullable<Awaited<ReturnType<NonNullable<ReturnType<typeof storeProductFeedsQuery>["queryFn"]>>>>[number];

function FeedCard({
  storeId,
  storeSlug,
  origin,
  kind,
  feed,
  categories,
  onChanged,
}: {
  storeId: string;
  storeSlug: string;
  origin: string;
  kind: FeedKind;
  feed: FeedRow | undefined;
  categories: { id: string; name: string; slug: string }[];
  onChanged: () => void;
}) {
  const save = useServerFn(saveStoreProductFeed);
  const rebuild = useServerFn(rebuildStoreProductFeed);
  const rotate = useServerFn(rotateStoreFeedToken);

  const [isActive, setIsActive] = useState(feed?.is_active ?? true);
  const [currency, setCurrency] = useState(feed?.currency ?? "TRY");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(feed?.include_out_of_stock ?? false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(
    (feed?.category_map as Record<string, string>) ?? {},
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          kind,
          isActive,
          currency,
          includeOutOfStock,
          categoryMap,
        },
      }),
    onSuccess: () => {
      onChanged();
      toast.success("Akış ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rebuildMutation = useMutation({
    mutationFn: () => {
      if (!feed) throw new Error("Önce akış ayarlarını kaydedin");
      return rebuild({ data: { storeId, id: feed.id } });
    },
    onSuccess: () => {
      onChanged();
      toast.success("Akış yeniden oluşturuldu");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotateMutation = useMutation({
    mutationFn: () => {
      if (!feed) throw new Error("Önce akış ayarlarını kaydedin");
      return rotate({ data: { storeId, id: feed.id } });
    },
    onSuccess: () => {
      onChanged();
      toast.success("Token yenilendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const format = FEED_KIND_FORMAT[kind];
  const feedUrl =
    feed && storeSlug
      ? `${origin}/api/public/feed/${storeSlug}/${kind}?token=${feed.token}${format === "json" ? "" : ""}`
      : "";

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Kopyalandı"))
      .catch(() => toast.error("Kopyalanamadı"));
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Rss className="size-4" />
          </span>
          <div>
            <p className="font-semibold">{FEED_KIND_LABELS[kind]}</p>
            <p className="text-xs text-muted-foreground uppercase">{format}</p>
          </div>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} aria-label={`${FEED_KIND_LABELS[kind]} akışını aç/kapat`} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Para birimi</Label>
          <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={3} />
        </div>
        <label className="mt-5 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs">
          <span>Stokta yok dahil</span>
          <Switch checked={includeOutOfStock} onCheckedChange={setIncludeOutOfStock} />
        </label>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-xs">Kategori eşleştirme</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-2">
                <span className="w-1/2 truncate text-xs text-muted-foreground">{category.name}</span>
                <Input
                  className="h-7 text-xs"
                  placeholder="Hedef kategori adı"
                  value={categoryMap[category.id] ?? ""}
                  onChange={(event) =>
                    setCategoryMap((prev) => ({ ...prev, [category.id]: event.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button size="sm" className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Kaydediliyor…" : "Ayarları kaydet"}
      </Button>

      {feed ? (
        <div className="space-y-2 rounded-xl border border-border/60 p-3 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Ürün sayısı</span>
            <span className="font-medium text-foreground">{feed.item_count ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Son oluşturma</span>
            <span className="font-medium text-foreground">
              {feed.last_built_at ? formatDateTime(feed.last_built_at) : "Henüz oluşturulmadı"}
            </span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="truncate">{feedUrl}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(feedUrl)}>
              <Copy className="mr-1 size-3.5" /> Kopyala
            </Button>
            <Button size="sm" variant="outline" onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}>
              <KeyRound className="mr-1 size-3.5" /> Token yenile
            </Button>
            <Button size="sm" variant="secondary" onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending}>
              <RefreshCcw className="mr-1 size-3.5" /> Yeniden oluştur
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Bu akış için henüz ayar kaydedilmedi. Kaydettikten sonra akış linki burada görünecek.
        </p>
      )}
    </div>
  );
}

function FeedsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: feeds, isLoading } = useQuery(storeProductFeedsQuery(storeId));
  const { data: categories } = useQuery(storeCategoriesLiteQuery(storeId));

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const storeSlug = store?.slug ?? "";

  const onChanged = () =>
    queryClient.invalidateQueries({ queryKey: ["marketing-tools", storeId, "product-feeds"] });

  return (
    <AppShell
      storeId={storeId}
      title="Ürün Akışları"
      description="Google Shopping, TikTok, Instagram ve Facebook için otomatik ürün akışlarını yönetin."
    >
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEED_KINDS.map((kind) => (
            <FeedCard
              key={kind}
              storeId={storeId}
              storeSlug={storeSlug}
              origin={origin}
              kind={kind}
              feed={(feeds ?? []).find((feed) => feed.kind === kind)}
              categories={categories ?? []}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      {!isLoading && (feeds ?? []).length === 0 ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">İpucu</Badge>
          Bir kart üzerinde "Ayarları kaydet" butonuna basarak akışı etkinleştirin.
        </div>
      ) : null}
    </AppShell>
  );
}
