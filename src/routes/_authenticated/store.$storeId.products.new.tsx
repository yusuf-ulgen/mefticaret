import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/products/new")({
  head: () => ({
    meta: [
      { title: "Yeni Ürün — Mefticaret" },
      {
        name: "description",
        content: "Ürün adı, fiyat, stok ve durum bilgisiyle yeni ürünü saniyeler içinde oluştur.",
      },
      { property: "og:title", content: "Yeni Ürün — Mefticaret" },
      { property: "og:description", content: "Kataloğuna hızlıca yeni ürün ekle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewProductPage,
});

function NewProductPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const create = useServerFn(createProduct);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [productType, setProductType] = useState("");
  const [basePrice, setBasePrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeId,
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
          ...(productType.trim() ? { productType: productType.trim() } : {}),
          basePrice: Number(basePrice) || 0,
          stock: Math.max(0, Math.trunc(Number(stock) || 0)),
          status,
        },
      }),
    onSuccess: (product: { id: string }) => {
      toast.success("Ürün oluşturuldu");
      void navigate({
        to: "/store/$storeId/products/$productId",
        params: { storeId, productId: product.id },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Yeni ürün" description="Temel bilgileri gir, ardından varyant ve görselleri ekle.">
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link to="/store/$storeId/products" params={{ storeId }}>
            <ArrowLeft className="size-4" /> Ürünler
          </Link>
        </Button>
      </div>

      <form
        className="surface-card grid max-w-2xl gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="product-title">Ürün adı</Label>
          <Input
            id="product-title"
            required
            minLength={2}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-description">Açıklama</Label>
          <Textarea
            id="product-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-vendor">Marka / Satıcı</Label>
            <Input
              id="product-vendor"
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-type">Ürün tipi</Label>
            <Input
              id="product-type"
              value={productType}
              onChange={(event) => setProductType(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-price">Fiyat</Label>
            <Input
              id="product-price"
              type="number"
              min={0}
              step="0.01"
              value={basePrice}
              onChange={(event) => setBasePrice(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-stock">Başlangıç stoğu</Label>
            <Input
              id="product-stock"
              type="number"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-status">Durum</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger id="product-status" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="active">Yayında</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={mutation.isPending} className="w-fit">
          {mutation.isPending ? "Oluşturuluyor..." : "Ürünü oluştur"}
        </Button>
      </form>
    </AppShell>
  );
}
