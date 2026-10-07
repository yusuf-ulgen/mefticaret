import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productsQuery } from "@/lib/catalog-queries";
import { shoppableVideosQuery } from "@/lib/innovation-queries";
import { deleteShoppableVideo, saveShoppableVideo } from "@/lib/innovation.functions";

/** Kısa video vitrini yönetimi. */
export function LiveCommercePanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: videos } = useQuery(shoppableVideosQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));
  const saveVideo = useServerFn(saveShoppableVideo);
  const removeVideo = useServerFn(deleteShoppableVideo);

  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSource, setVideoSource] = useState("upload");
  const [videoPlacement, setVideoPlacement] = useState("home");
  const [videoProduct, setVideoProduct] = useState("none");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["shoppable-videos", storeId] });
  };

  const videoMutation = useMutation({
    mutationFn: async () =>
      saveVideo({
        data: {
          storeId,
          title: videoTitle,
          videoUrl,
          source: videoSource,
          placement: videoPlacement,
          productId: videoProduct === "none" ? null : videoProduct,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Video eklendi.");
      setVideoTitle("");
      setVideoUrl("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Video className="size-4" /> Kısa video vitrini
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Dikey kısa videolar ana sayfada ve ürün sayfalarında kaydırmalı ızgara olarak gösterilir.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Başlık</Label>
            <Input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} />
          </div>
          <div>
            <Label>Video adresi (mp4 / paylaşım bağlantısı)</Label>
            <Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Kaynak</Label>
            <Select value={videoSource} onValueChange={setVideoSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["upload", "tiktok", "instagram", "youtube"].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nerede görünsün</Label>
            <Select value={videoPlacement} onValueChange={setVideoPlacement}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="home">Ana sayfa</SelectItem>
                <SelectItem value="pdp">Ürün sayfası</SelectItem>
                <SelectItem value="both">İkisi de</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Bağlı ürün</Label>
            <Select value={videoProduct} onValueChange={setVideoProduct}>
              <SelectTrigger><SelectValue placeholder="Ürün seç" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ürün bağlama</SelectItem>
                {(products ?? []).slice(0, 60).map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={videoTitle.trim().length < 2 || videoUrl.trim().length < 8 || videoMutation.isPending}
          onClick={() => videoMutation.mutate()}
        >
          Videoyu ekle
        </Button>

        <div className="mt-5 space-y-2">
          {(videos ?? []).map((video) => (
            <div key={video.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{video.title}</p>
                <p className="text-xs text-muted-foreground">
                  {video.source} · {video.placement} · {video.views} görüntüleme · {video.product_clicks} tıklama
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Videoyu sil"
                onClick={() => {
                  void removeVideo({ data: { storeId, id: video.id } as never }).then(() => {
                    toast.success("Video silindi.");
                    invalidate();
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          {(videos ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Henüz video yok.</p> : null}
        </div>
      </div>
    </div>
  );
}
