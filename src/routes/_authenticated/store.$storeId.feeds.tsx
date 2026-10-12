import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { storeProductFeedsQuery } from "@/lib/marketing-tools-queries";
import { storeQuery } from "@/lib/store-queries";
import {
  rebuildStoreProductFeed,
  rotateStoreFeedToken,
  saveStoreProductFeed,
} from "@/lib/marketing-tools.functions";
import { FEED_KINDS, FEED_KIND_FORMAT, FEED_KIND_LABELS, type FeedKind } from "@/lib/popups";
import { formatDate } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/feeds")({
  head: () => ({
    meta: [
      { title: "Ürün Akışları — Mefticaret" },
      {
        name: "description",
        content:
          "Google Shopping, TikTok Shop, Instagram ve Facebook katalog akışlarını oluştur, yenile ve güvenli akış adresini paylaş.",
      },
      { property: "og:title", content: "Ürün Akışları — Mefticaret" },
      {
        property: "og:description",
        content: "Mağaza kataloğunu reklam kanallarına akış olarak gönder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedsPage,
});

type FeedRow = {
  id: string;
  kind: string;
  is_active: boolean;
  currency: string;
  include_out_of_stock: boolean;
  item_count: number | null;
  last_built_at: string | null;
  token: string | null;
};

function FeedsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const feeds = useQuery(storeProductFeedsQuery(storeId));
  const store = useQuery(storeQuery(storeId));
  const storeSlug = (store.data as { slug?: string } | null | undefined)?.slug ?? "";
  const save = useServerFn(saveStoreProductFeed);
  const rebuild = useServerFn(rebuildStoreProductFeed);
  const rotate = useServerFn(rotateStoreFeedToken);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["marketing-tools", storeId, "product-feeds"] });

  const saveMutation = useMutation({
    mutationFn: (input: { kind: FeedKind; isActive: boolean; includeOutOfStock: boolean; currency: string }) =>
      save({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Akış ayarı kaydedildi");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rebuildMutation = useMutation({
    mutationFn: (id: string) => rebuild({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Akış yeniden oluşturuldu");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => rotate({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Akış adresi yenilendi");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (feeds.data ?? []) as unknown as FeedRow[];
  const byKind = new Map(rows.map((row) => [row.kind, row]));

  return (
    <AppShell
      storeId={storeId}
      title="Ürün Akışları"
      description="Kataloğunu Google Shopping, TikTok, Instagram ve Facebook için akışa dönüştür."
    >
      {feeds.isLoading ? (
        <CardSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {FEED_KINDS.map((kind) => {
            const row = byKind.get(kind);
            const feedUrl = row?.token && storeSlug
              ? `${typeof window === "undefined" ? "" : window.location.origin}/api/public/feed/${storeSlug}/${kind}?token=${row.token}`
              : null;
            return (
              <div key={kind} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{FEED_KIND_LABELS[kind]}</h3>
                    <p className="text-sm text-muted-foreground">
                      Biçim: {FEED_KIND_FORMAT[kind].toUpperCase()} · {row?.item_count ?? 0} ürün
                    </p>
                  </div>
                  <Badge variant={row?.is_active ? "default" : "secondary"}>
                    {row?.is_active ? "Aktif" : "Kapalı"}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Label htmlFor={`active-${kind}`} className="text-sm">
                    Akışı yayınla
                  </Label>
                  <Switch
                    id={`active-${kind}`}
                    checked={Boolean(row?.is_active)}
                    onCheckedChange={(checked) =>
                      saveMutation.mutate({
                        kind,
                        isActive: checked,
                        includeOutOfStock: Boolean(row?.include_out_of_stock),
                        currency: row?.currency ?? "TRY",
                      })
                    }
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <Label htmlFor={`stock-${kind}`} className="text-sm">
                    Stokta olmayanları da gönder
                  </Label>
                  <Switch
                    id={`stock-${kind}`}
                    checked={Boolean(row?.include_out_of_stock)}
                    onCheckedChange={(checked) =>
                      saveMutation.mutate({
                        kind,
                        isActive: Boolean(row?.is_active),
                        includeOutOfStock: checked,
                        currency: row?.currency ?? "TRY",
                      })
                    }
                  />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {row?.last_built_at ? `Son oluşturma: ${formatDate(row.last_built_at)}` : "Henüz oluşturulmadı"}
                </p>

                {row ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rebuildMutation.mutate(row.id)}
                      disabled={rebuildMutation.isPending}
                    >
                      <RefreshCw className="mr-1 h-4 w-4" /> Yenile
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rotateMutation.mutate(row.id)}
                      disabled={rotateMutation.isPending}
                    >
                      <KeyRound className="mr-1 h-4 w-4" /> Adresi değiştir
                    </Button>
                    {feedUrl ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(feedUrl);
                          toast.success("Akış adresi kopyalandı");
                        }}
                      >
                        <Copy className="mr-1 h-4 w-4" /> Adresi kopyala
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
