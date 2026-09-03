import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Facebook, Instagram, MessageCircle, Share2, Twitter } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  storeShareableProductsQuery,
  storeStoriesQuery,
} from "@/lib/marketing-tools-queries";
import { deleteStoreStory, publishStoreStory, upsertStoreStory } from "@/lib/marketing-tools.functions";
import { storeQuery } from "@/lib/store-queries";
import {
  STORY_CHANNELS,
  STORY_CHANNEL_LABELS,
  STORY_STATUS_LABELS,
  type StoryChannel,
} from "@/lib/popups";

export const Route = createFileRoute("/_authenticated/store/$storeId/social-share")({
  head: () => {
    const title = "Ürün & Story Paylaşımı — Mefticaret";
    const description =
      "Ürünlerinizi Instagram, Facebook, WhatsApp, TikTok ve vitrinde paylaşıma hazır bağlantılarla saniyeler içinde tanıtın.";
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
    <AppShell title="Ürün & Story Paylaşımı" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Ürün & Story Paylaşımı" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız paylaşım bulunamadı.
      </div>
    </AppShell>
  ),
  component: SocialSharePage,
});

const CHANNEL_ICON: Record<StoryChannel, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
  tiktok: Share2,
  storefront: Share2,
};

function buildShareLinks(link: string, caption: string) {
  const encodedLink = encodeURIComponent(link);
  const encodedText = encodeURIComponent(`${caption}\n${link}`);
  return {
    whatsapp: `https://wa.me/?text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodedLink}`,
  };
}

function SocialSharePage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products, isLoading: productsLoading } = useQuery(storeShareableProductsQuery(storeId));
  const { data: stories, isLoading: storiesLoading } = useQuery(storeStoriesQuery(storeId));

  const save = useServerFn(upsertStoreStory);
  const publish = useServerFn(publishStoreStory);
  const remove = useServerFn(deleteStoreStory);

  const [productId, setProductId] = useState<string>("");
  const [channel, setChannel] = useState<StoryChannel>("instagram");
  const [caption, setCaption] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const storeSlug = store?.slug ?? "";

  const selectedProduct = (products ?? []).find((p) => p.id === productId);
  const productLink = useMemo(() => {
    if (!selectedProduct || !storeSlug) return "";
    return `${origin}/s/${storeSlug}/p/${selectedProduct.slug}`;
  }, [selectedProduct, storeSlug, origin]);

  const autoCaption = useMemo(() => {
    if (!selectedProduct) return "";
    const price = formatMoney(Number(selectedProduct.base_price ?? 0), selectedProduct.currency ?? "TRY");
    return `${selectedProduct.title} — ${price}`;
  }, [selectedProduct]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["marketing-tools", storeId, "stories"] });

  const createMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          productId: productId || null,
          channel,
          caption: caption || autoCaption,
          imageUrl: selectedProduct?.coverUrl ?? null,
          linkUrl: productLink || null,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Paylaşım kaydedildi");
      setCaption("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publish({ data: { storeId, id } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.info(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { storeId, id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Paylaşım silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Kopyalandı"))
      .catch(() => toast.error("Kopyalanamadı"));
  }

  const shareLinks = productLink ? buildShareLinks(productLink, caption || autoCaption) : null;

  return (
    <AppShell
      storeId={storeId}
      title="Ürün & Story Paylaşımı"
      description="Ürünlerinizi sosyal kanallarda ve vitrinde paylaşıma hazırlayın."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="surface-card space-y-4 p-6 lg:col-span-1"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">Yeni paylaşım</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Ürün</label>
            {productsLoading ? (
              <CardSkeleton count={1} />
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Ürün seç" />
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedProduct ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
              {selectedProduct.coverUrl ? (
                <img
                  src={selectedProduct.coverUrl}
                  alt=""
                  className="size-14 rounded-lg object-cover"
                />
              ) : (
                <div className="size-14 rounded-lg bg-muted" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedProduct.title}</p>
                <p className="truncate text-xs text-muted-foreground">{productLink}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium">Kanal</label>
            <Select value={channel} onValueChange={(next) => setChannel(next as StoryChannel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORY_CHANNELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STORY_CHANNEL_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Açıklama</label>
            <Textarea
              rows={4}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={autoCaption || "Otomatik oluşturulacak…"}
            />
            <p className="text-xs text-muted-foreground">
              Boş bırakırsanız otomatik başlık kullanılır: {autoCaption || "—"}
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={!productId || createMutation.isPending}>
            {createMutation.isPending ? "Kaydediliyor…" : "Paylaşım oluştur"}
          </Button>

          {shareLinks ? (
            <div className="space-y-2 rounded-xl border border-border/60 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Hızlı paylaşım linkleri</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1 size-3.5" /> WhatsApp
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={shareLinks.facebook} target="_blank" rel="noreferrer">
                    <Facebook className="mr-1 size-3.5" /> Facebook
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={shareLinks.x} target="_blank" rel="noreferrer">
                    <Twitter className="mr-1 size-3.5" /> X
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copy(productLink)}>
                  <Copy className="mr-1 size-3.5" /> Linki kopyala
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="lg:col-span-2">
          {storiesLoading ? (
            <CardSkeleton count={4} />
          ) : (stories ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <Share2 className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz paylaşım yok</p>
              <p className="text-sm text-muted-foreground">Soldaki formla ilk paylaşımınızı oluşturun.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(stories ?? []).map((story) => {
                const Icon = CHANNEL_ICON[story.channel as StoryChannel] ?? Share2;
                const links = story.link_url ? buildShareLinks(story.link_url, story.caption ?? "") : null;
                return (
                  <li key={story.id} className="surface-card space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{story.products?.title ?? "Ürün silinmiş"}</p>
                          <p className="text-xs text-muted-foreground">
                            {STORY_CHANNEL_LABELS[story.channel as StoryChannel]}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{STORY_STATUS_LABELS[story.status] ?? story.status}</Badge>
                    </div>
                    {story.caption ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">{story.caption}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Oluşturulma: {formatDateTime(story.created_at)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {story.link_url ? (
                        <Button size="sm" variant="ghost" onClick={() => copy(story.link_url!)}>
                          <Copy className="mr-1 size-3.5" /> Linki kopyala
                        </Button>
                      ) : null}
                      {links ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={links.whatsapp} target="_blank" rel="noreferrer">
                            <MessageCircle className="mr-1 size-3.5" /> Paylaş
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate(story.id)}
                      >
                        Sıraya al
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMutation.mutate(story.id)}
                      >
                        Sil
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
