import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, Instagram } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productsQuery } from "@/lib/catalog-queries";
import { arAssetsQuery, ugcPostsQuery } from "@/lib/innovation-queries";
import { importTiktokUgc, saveArAsset, saveUgcPost, setUgcStatus } from "@/lib/innovation.functions";

const STATUS_LABEL: Record<string, string> = { pending: "Onay bekliyor", approved: "Yayında", rejected: "Reddedildi" };

/** Müşteri içerikleri (UGC) duvarı ve 3B/AR ürün görüntüleyici varlıkları. */
export function SocialArPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: posts } = useQuery(ugcPostsQuery(storeId));
  const { data: assets } = useQuery(arAssetsQuery(storeId));
  const { data: products } = useQuery(productsQuery(storeId));

  const addPost = useServerFn(saveUgcPost);
  const updateStatus = useServerFn(setUgcStatus);
  const importTiktok = useServerFn(importTiktokUgc);
  const saveAsset = useServerFn(saveArAsset);

  const [mediaUrl, setMediaUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [caption, setCaption] = useState("");
  const [source, setSource] = useState("instagram");

  const [arProduct, setArProduct] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [usdzUrl, setUsdzUrl] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["ugc-posts", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["product-ar-assets", storeId] });
  };

  const postMutation = useMutation({
    mutationFn: async () =>
      addPost({
        data: {
          storeId,
          source,
          authorHandle: handle.trim() || null,
          mediaUrl,
          caption: caption.trim() || null,
        } as never,
      }),
    onSuccess: () => {
      toast.success("İçerik eklendi, onay bekliyor.");
      setMediaUrl("");
      setCaption("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tiktokMutation = useMutation({
    mutationFn: async () => importTiktok({ data: { storeId, limit: 10 } as never }),
    onSuccess: (result) => {
      const data = result as unknown as { credentialsReady: boolean; imported: number };
      if (!data.credentialsReady) {
        toast.error("TikTok hesabı bağlı değil. Bağladığınızda içerikler otomatik gelir.");
        return;
      }
      toast.success(`${data.imported} içerik alındı.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assetMutation = useMutation({
    mutationFn: async () =>
      saveAsset({
        data: {
          storeId,
          productId: arProduct,
          modelUrl: modelUrl.trim() || null,
          usdzUrl: usdzUrl.trim() || null,
        } as never,
      }),
    onSuccess: () => {
      toast.success("3B model kaydedildi.");
      setModelUrl("");
      setUsdzUrl("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Instagram className="size-4" /> Müşteri içerikleri duvarı
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Müşterilerinizin paylaştığı fotoğraf ve videoları onaylayıp ürün sayfalarında gösterin.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Görsel/video adresi</Label>
            <Input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Paylaşan kişi</Label>
            <Input value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@kullanici" />
          </div>
          <div>
            <Label>Kaynak</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="manual">Elle eklendi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Açıklama</Label>
            <Input value={caption} onChange={(event) => setCaption(event.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={mediaUrl.trim().length < 8 || postMutation.isPending} onClick={() => postMutation.mutate()}>
            İçerik ekle
          </Button>
          <Button variant="outline" disabled={tiktokMutation.isPending} onClick={() => tiktokMutation.mutate()}>
            TikTok'tan içe aktar
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {(posts ?? []).map((post) => (
            <div key={post.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{post.author_handle ?? post.source}</p>
                <p className="truncate text-xs text-muted-foreground">{post.caption ?? post.media_url}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={post.status === "approved" ? "default" : "secondary"}>{STATUS_LABEL[post.status]}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void updateStatus({ data: { storeId, id: post.id, status: "approved" } as never }).then(() => {
                      toast.success("Yayına alındı.");
                      invalidate();
                    });
                  }}
                >
                  Onayla
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void updateStatus({ data: { storeId, id: post.id, status: "rejected" } as never }).then(() => {
                      toast.success("Reddedildi.");
                      invalidate();
                    });
                  }}
                >
                  Reddet
                </Button>
              </div>
            </div>
          ))}
          {(posts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz müşteri içeriği yok.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Boxes className="size-4" /> 3B ve artırılmış gerçeklik
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ürünün 3B modelini ekleyin; müşteri telefonunda ürünü odasında görebilir (Android için .glb, iPhone
          için .usdz).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Ürün</Label>
            <Select value={arProduct} onValueChange={setArProduct}>
              <SelectTrigger><SelectValue placeholder="Ürün seç" /></SelectTrigger>
              <SelectContent>
                {(products ?? []).slice(0, 80).map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>.glb adresi</Label>
            <Input value={modelUrl} onChange={(event) => setModelUrl(event.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>.usdz adresi</Label>
            <Input value={usdzUrl} onChange={(event) => setUsdzUrl(event.target.value)} placeholder="https://" />
          </div>
        </div>
        <Button className="mt-4" disabled={!arProduct || assetMutation.isPending} onClick={() => assetMutation.mutate()}>
          3B modeli kaydet
        </Button>

        <div className="mt-5 space-y-2">
          {(assets ?? []).map((asset) => {
            const product = (products ?? []).find((item) => item.id === asset.product_id);
            return (
              <div key={asset.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{product?.title ?? asset.product_id}</p>
                <p className="text-xs text-muted-foreground">
                  {asset.model_url ? ".glb ✓" : ".glb —"} · {asset.usdz_url ? ".usdz ✓" : ".usdz —"}
                </p>
              </div>
            );
          })}
          {(assets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz 3B model yok.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
