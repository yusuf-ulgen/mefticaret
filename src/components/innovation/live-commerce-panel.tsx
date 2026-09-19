import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { productsQuery } from "@/lib/catalog-queries";
import { liveStreamsQuery, shoppableVideosQuery } from "@/lib/innovation-queries";
import {
  deleteLiveStream,
  deleteShoppableVideo,
  getStreamPerformance,
  saveLiveStream,
  saveShoppableVideo,
} from "@/lib/innovation.functions";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Planlandı",
  live: "Canlı",
  ended: "Bitti",
  cancelled: "İptal",
};

/** Canlı yayın satışı ve kısa video vitrini yönetimi. */
export function LiveCommercePanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: streams } = useQuery(liveStreamsQuery(storeId));
  const { data: videos } = useQuery(shoppableVideosQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));

  const saveStream = useServerFn(saveLiveStream);
  const removeStream = useServerFn(deleteLiveStream);
  const saveVideo = useServerFn(saveShoppableVideo);
  const removeVideo = useServerFn(deleteShoppableVideo);
  const performance = useServerFn(getStreamPerformance);

  const [title, setTitle] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [provider, setProvider] = useState("youtube");
  const [chatEnabled, setChatEnabled] = useState(true);
  const [status, setStatus] = useState("scheduled");
  const [pickedProducts, setPickedProducts] = useState<string[]>([]);

  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSource, setVideoSource] = useState("upload");
  const [videoPlacement, setVideoPlacement] = useState("home");
  const [videoProduct, setVideoProduct] = useState("none");

  const [report, setReport] = useState<Record<string, number> | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["live-streams", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["shoppable-videos", storeId] });
  };

  const streamMutation = useMutation({
    mutationFn: async () =>
      saveStream({
        data: {
          storeId,
          title,
          provider,
          streamUrl: streamUrl.trim() || null,
          chatEnabled,
          status,
          productIds: pickedProducts,
        } as never,
      }),
    onSuccess: () => {
      toast.success("Yayın kaydedildi.");
      setTitle("");
      setStreamUrl("");
      setPickedProducts([]);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  const reportMutation = useMutation({
    mutationFn: async (streamId: string) => performance({ data: { storeId, streamId } as never }),
    onSuccess: (result) => setReport(result as unknown as Record<string, number>),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Radio className="size-4" /> Canlı satış yayını
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Yayın adresini girin, yayında gösterilecek ürünleri seçin. Vitrinde yayın kutusu ve tıklanabilir
          ürün kartları görünür.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Yayın başlığı</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kış indirimi canlı yayını" />
          </div>
          <div>
            <Label>Yayın adresi</Label>
            <Input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Platform</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["youtube", "vimeo", "mux", "custom"].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Durum</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} id="chat-enabled" />
          <Label htmlFor="chat-enabled">Canlı sohbet açık</Label>
        </div>
        <div className="mt-3">
          <Label>Yayında gösterilecek ürünler</Label>
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {(products ?? []).slice(0, 40).map((product) => {
              const active = pickedProducts.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    setPickedProducts((prev) =>
                      active ? prev.filter((id) => id !== product.id) : [...prev, product.id],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {product.title}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={title.trim().length < 2 || streamMutation.isPending}
          onClick={() => streamMutation.mutate()}
        >
          Yayını kaydet
        </Button>

        <div className="mt-5 space-y-2">
          {(streams ?? []).map((stream) => (
            <div key={stream.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{stream.title}</p>
                <p className="text-xs text-muted-foreground">
                  {STATUS_LABEL[stream.status]} · {stream.total_views} görüntüleme · {stream.product_clicks} ürün tıklaması
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={stream.status === "live" ? "default" : "secondary"}>{STATUS_LABEL[stream.status]}</Badge>
                <Button size="sm" variant="outline" onClick={() => reportMutation.mutate(stream.id)}>
                  Performans
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Yayını sil"
                  onClick={() => {
                    void removeStream({ data: { storeId, id: stream.id } as never }).then(() => {
                      toast.success("Yayın silindi.");
                      invalidate();
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {(streams ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz yayın yok.</p>
          ) : null}
        </div>

        {report ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Yayından gelen sipariş</p>
              <p className="text-lg font-semibold">{report["orders"] ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Ciro</p>
              <p className="text-lg font-semibold">{report["revenue"] ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground">Tıklama → sipariş</p>
              <p className="text-lg font-semibold">{report["conversion"] ?? 0}%</p>
            </div>
          </div>
        ) : null}
      </div>

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
