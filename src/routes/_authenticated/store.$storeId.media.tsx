import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, Images, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { MediaLibraryPanel } from "@/components/media-library-panel";
import { MediaV2DetailExtra, MediaV2Uploader, useMediaV2Boot } from "@/components/media-v2";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteProductImage, updateProductImage } from "@/lib/media.functions";
import { mediaLibraryQuery, type MediaLibraryItem } from "@/lib/media-queries";
import { formatDateTime } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/media")({
  head: () => ({
    meta: [
      { title: "Medya Kütüphanesi — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanızdaki tüm ürün görsellerini tek ekranda görün, alt metinleri düzenleyin, eksik açıklamaları tespit edin ve kullanılmayan görselleri silin.",
      },
      { property: "og:title", content: "Medya Kütüphanesi — Mefticaret" },
      {
        property: "og:description",
        content: "Ürün görsellerini tek ekranda yönetin: alt metin denetimi, önizleme ve silme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Medya Kütüphanesi">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Medya kütüphanesi</h1>
          <p className="text-sm text-muted-foreground">
            Görsel, video ve dokümanlarınızı klasörleyin; alt metin, WebP dönüşümü ve responsive
            varyantlarla yönetin.
          </p>
        </div>
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Kütüphane</TabsTrigger>
            <TabsTrigger value="products">Ürün görselleri</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="mt-6">
            <LibraryTab storeId={storeId} />
          </TabsContent>
          <TabsContent value="products" className="mt-6">
            <ProductImagesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function ProductImagesPanel() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: items, isLoading } = useQuery(mediaLibraryQuery(storeId));
  const updateImage = useServerFn(updateProductImage);
  const removeImage = useServerFn(deleteProductImage);

  const [search, setSearch] = useState("");
  const [onlyMissingAlt, setOnlyMissingAlt] = useState(false);
  const [selected, setSelected] = useState<MediaLibraryItem | null>(null);
  const [altDraft, setAltDraft] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["media-library", storeId] });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      if (onlyMissingAlt && item.alt && item.alt.trim().length > 0) return false;
      if (!term) return true;
      return (
        item.productTitle.toLowerCase().includes(term) ||
        (item.alt ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, search, onlyMissingAlt]);

  const missingAlt = (items ?? []).filter((item) => !item.alt || !item.alt.trim()).length;

  const altMutation = useMutation({
    mutationFn: (input: { imageId: string; alt: string }) =>
      updateImage({ data: { imageId: input.imageId, alt: input.alt } }),
    onSuccess: async () => {
      toast.success("Alt metin güncellendi");
      setSelected(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Güncellenemedi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => removeImage({ data: { imageId } }),
    onSuccess: async () => {
      toast.success("Görsel silindi");
      setSelected(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Silinemedi"),
  });

  return (
    <>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Ürünlere bağlı görseller. Alt metni olmayan görseller SEO ve erişilebilirlik puanını
          düşürür.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Görsel sayısı" value={String((items ?? []).length)} />
          <StatCard label="Alt metni eksik" value={String(missingAlt)} />
          <StatCard
            label="Görselli ürün"
            value={String(new Set((items ?? []).map((item) => item.productId)).size)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ürün adı veya alt metin ara…"
            className="max-w-sm"
          />
          <Button
            variant={onlyMissingAlt ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyMissingAlt((value) => !value)}
          >
            Alt metni eksik olanlar
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Images className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Görsel bulunamadı. Ürün detay sayfasından görsel yükleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelected(item);
                  setAltDraft(item.alt ?? "");
                }}
                className="group overflow-hidden rounded-xl border border-border bg-card text-left"
              >
                <div className="flex aspect-square items-center justify-center bg-muted/40">
                  {item.displayUrl ? (
                    <img
                      src={item.displayUrl}
                      alt={item.alt ?? item.productTitle}
                      loading="lazy"
                      className="size-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <ImageOff className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-sm font-medium">{item.productTitle}</p>
                  {item.alt?.trim() ? (
                    <p className="truncate text-xs text-muted-foreground">{item.alt}</p>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      Alt metin yok
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selected?.productTitle ?? "Görsel"}</SheetTitle>
              <SheetDescription>
                {selected ? `Yüklenme ${formatDateTime(selected.created_at)}` : ""}
              </SheetDescription>
            </SheetHeader>

            {selected ? (
              <div className="mt-6 space-y-5">
                <div className="overflow-hidden rounded-xl border border-border">
                  {selected.displayUrl ? (
                    <img
                      src={selected.displayUrl}
                      alt={selected.alt ?? selected.productTitle}
                      className="w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                      Önizleme yok
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Alt metin</Label>
                  <Input
                    value={altDraft}
                    onChange={(event) => setAltDraft(event.target.value)}
                    placeholder="Görseli tanımlayan kısa açıklama"
                  />
                  <Button
                    size="sm"
                    disabled={altMutation.isPending}
                    onClick={() =>
                      altMutation.mutate({ imageId: selected.id, alt: altDraft.trim() })
                    }
                  >
                    {altMutation.isPending ? "Kaydediliyor…" : "Alt metni kaydet"}
                  </Button>
                </div>

                {selected.productId ? (
                  <Link
                    to="/store/$storeId/catalog-v2/$productId"
                    params={{ storeId, productId: selected.productId }}
                    className="inline-block text-sm underline"
                  >
                    Ürün detayına git
                  </Link>
                ) : null}

                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(selected.id)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Görseli sil
                </Button>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function LibraryTab({ storeId }: { storeId: string }) {
  const { data: boot } = useMediaV2Boot(storeId);
  const queryClient = useQueryClient();
  if (!boot?.enabled) return <MediaLibraryPanel storeId={storeId} />;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["media-assets", storeId] });
  return (
    <MediaLibraryPanel
      storeId={storeId}
      v2
      uploader={({ folderId, onUploaded }) => (
        <MediaV2Uploader storeId={storeId} boot={boot} folderId={folderId} onUploaded={onUploaded} />
      )}
      renderDetailExtra={(asset) => (
        <MediaV2DetailExtra storeId={storeId} asset={asset} boot={boot} folderId={asset.folder_id} onDone={refresh} />
      )}
    />
  );
}
