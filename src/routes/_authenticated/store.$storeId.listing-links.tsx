import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/data-skeleton";
import { formatMoney } from "@/lib/mefti";
import {
  LISTING_LINK_STATUSES,
  LISTING_LINK_STATUS_LABELS,
  type ListingLinkStatus,
} from "@/lib/marketplace-ops";
import {
  listingLinksQuery,
  marketplaceChannelsQuery,
  productPickerQuery,
  variantPickerQuery,
} from "@/lib/marketplace-ops-queries";
import { deleteListingLink, upsertListingLink } from "@/lib/marketplace-ops.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/listing-links")({
  head: () => {
    const title = "Çoklu İlan Bağlantıları — Mefticaret";
    const description =
      "Ürünlerinizi birden fazla pazaryeri kanalına eşleyin; dış barkod, ilan kimliği, fiyat ve stok katsayısını tek ekrandan yönetin.";
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
    <AppShell title="Çoklu İlan Bağlantıları" description="Bu sayfa şu anda yüklenemedi.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Bir sorun oluştu. Sayfayı yenilemeyi deneyin.
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Çoklu İlan Bağlantıları" description="Kayıt bulunamadı.">
      <div className="surface-card p-10 text-center text-sm text-muted-foreground">
        Aradığınız ilan bağlantısı bulunamadı.
      </div>
    </AppShell>
  ),
  component: ListingLinksPage,
});

const STATUS_TONE: Record<ListingLinkStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-600",
  paused: "bg-amber-500/15 text-amber-600",
  error: "bg-destructive/15 text-destructive",
  removed: "bg-muted text-muted-foreground",
};

type LinkFormState = {
  linkId?: string;
  productId: string;
  variantId: string;
  channelId: string;
  externalListingId: string;
  externalBarcode: string;
  price: string;
  stockMultiplier: string;
  status: ListingLinkStatus;
};

const EMPTY_FORM: LinkFormState = {
  productId: "",
  variantId: "",
  channelId: "",
  externalListingId: "",
  externalBarcode: "",
  price: "",
  stockMultiplier: "1",
  status: "active",
};

function LinkFormDialog({
  storeId,
  initial,
  onDone,
  trigger,
}: {
  storeId: string;
  initial: LinkFormState;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LinkFormState>(initial);

  const { data: products } = useQuery({ ...productPickerQuery(storeId), enabled: open });
  const { data: variants } = useQuery({
    ...variantPickerQuery(storeId, form.productId || null),
    enabled: open && Boolean(form.productId),
  });
  const { data: channels } = useQuery({ ...marketplaceChannelsQuery(storeId), enabled: open });

  const upsert = useServerFn(upsertListingLink);
  const mutation = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          storeId,
          ...(form.linkId ? { linkId: form.linkId } : {}),
          productId: form.productId,
          variantId: form.variantId || undefined,
          channelId: form.channelId,
          externalListingId: form.externalListingId || undefined,
          externalBarcode: form.externalBarcode || undefined,
          price: form.price ? Number(form.price) : undefined,
          stockMultiplier: Number(form.stockMultiplier) || 1,
          status: form.status,
        },
      }),
    onSuccess: () => {
      toast.success(form.linkId ? "İlan bağlantısı güncellendi" : "İlan bağlantısı eklendi");
      setOpen(false);
      setForm(EMPTY_FORM);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(initial);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.linkId ? "İlan bağlantısını düzenle" : "Yeni ilan bağlantısı"}</DialogTitle>
          <DialogDescription>
            Ürünü bir pazaryeri kanalına eşleyin; dış kimlik, fiyat ve stok katsayısını belirtin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Ürün</Label>
            <Select
              value={form.productId}
              onValueChange={(value) => setForm((f) => ({ ...f, productId: value, variantId: "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ürün seçin" />
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title} {product.sku ? `(${product.sku})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.productId ? (
            <div className="space-y-1">
              <Label>Varyant (opsiyonel)</Label>
              <Select
                value={form.variantId || "none"}
                onValueChange={(value) => setForm((f) => ({ ...f, variantId: value === "none" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Varyant seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Varyant yok</SelectItem>
                  {(variants ?? []).map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.title} {variant.sku ? `(${variant.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Kanal</Label>
            <Select value={form.channelId} onValueChange={(value) => setForm((f) => ({ ...f, channelId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Kanal seçin" />
              </SelectTrigger>
              <SelectContent>
                {(channels ?? []).map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ext-id">İlan kimliği</Label>
              <Input
                id="ext-id"
                value={form.externalListingId}
                onChange={(e) => setForm((f) => ({ ...f, externalListingId: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ext-barcode">Dış barkod</Label>
              <Input
                id="ext-barcode"
                value={form.externalBarcode}
                onChange={(e) => setForm((f) => ({ ...f, externalBarcode: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="price">Fiyat</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mult">Stok katsayısı</Label>
              <Input
                id="mult"
                type="number"
                min={0}
                step={0.1}
                value={form.stockMultiplier}
                onChange={(e) => setForm((f) => ({ ...f, stockMultiplier: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Durum</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((f) => ({ ...f, status: value as ListingLinkStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LISTING_LINK_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {LISTING_LINK_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!form.productId || !form.channelId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListingLinksPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [productFilter, setProductFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const { data: products } = useQuery(productPickerQuery(storeId));
  const { data: channels } = useQuery(marketplaceChannelsQuery(storeId));
  const { data: links, isLoading } = useQuery(
    listingLinksQuery(storeId, { productId: productFilter, channelId: channelFilter }),
  );

  const remove = useServerFn(deleteListingLink);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["listing-links", storeId] });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => remove({ data: { storeId, linkId } }),
    onSuccess: () => {
      toast.success("İlan bağlantısı silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = links ?? [];

  return (
    <AppShell
      storeId={storeId}
      title="Çoklu İlan Bağlantıları"
      description="Ürünlerinizi pazaryeri kanallarına eşleyin; dış kimlikleri, fiyatı ve stok katsayısını yönetin."
      actions={
        <LinkFormDialog
          storeId={storeId}
          initial={EMPTY_FORM}
          onDone={invalidate}
          trigger={
            <Button>
              <Plus className="mr-2 size-4" /> Bağlantı ekle
            </Button>
          }
        />
      }
    >
      <div className="flex flex-wrap gap-3">
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Ürün" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm ürünler</SelectItem>
            {(products ?? []).map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Kanal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kanallar</SelectItem>
            {(channels ?? []).map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : rows.length === 0 ? (
          <div className="surface-card p-10 text-center text-sm text-muted-foreground">
            <Link2 className="mx-auto mb-2 size-6" />
            Bu filtrede ilan bağlantısı yok.
          </div>
        ) : (
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>İlan kimliği / barkod</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Stok katsayısı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowStatus = row.status as ListingLinkStatus;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.products?.title ?? "—"}
                        {row.product_variants?.title ? ` — ${row.product_variants.title}` : ""}
                      </TableCell>
                      <TableCell>{row.marketplace_channels?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.external_listing_id ?? "—"} / {row.external_barcode ?? "—"}
                      </TableCell>
                      <TableCell>{row.price != null ? formatMoney(Number(row.price)) : "—"}</TableCell>
                      <TableCell>{row.stock_multiplier ?? 1}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_TONE[rowStatus]} variant="secondary">
                          {LISTING_LINK_STATUS_LABELS[rowStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <LinkFormDialog
                          storeId={storeId}
                          initial={{
                            linkId: row.id,
                            productId: row.product_id,
                            variantId: row.variant_id ?? "",
                            channelId: row.channel_id,
                            externalListingId: row.external_listing_id ?? "",
                            externalBarcode: row.external_barcode ?? "",
                            price: row.price != null ? String(row.price) : "",
                            stockMultiplier: String(row.stock_multiplier ?? 1),
                            status: rowStatus,
                          }}
                          onDone={invalidate}
                          trigger={
                            <Button size="sm" variant="outline">
                              Düzenle
                            </Button>
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(row.id)}
                        >
                          Sil
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
