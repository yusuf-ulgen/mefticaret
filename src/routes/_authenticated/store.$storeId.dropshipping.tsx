import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, PackageCheck, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatMoney } from "@/lib/mefti";
import {
  DROPSHIP_STATUS_LABEL,
  FEED_KIND_LABEL,
  FEED_SCHEDULE_LABEL,
  MATCH_KEY_LABEL,
  computeSalePrice,
  computeStock,
  type FieldMap,
  type SupplierFeedKind,
  type SupplierFeedSchedule,
  type SupplierMatchKey,
} from "@/lib/dropshipping";
import {
  dropshipOrdersQuery,
  supplierFeedRunsQuery,
  supplierFeedsQuery,
  supplierProductsQuery,
  type SupplierFeedRow,
} from "@/lib/dropshipping-queries";
import {
  autoMapFeedCategories,
  deleteSupplierFeed,
  previewSupplierFeed,
  publishFeedProducts,
  runSupplierFeedNow,
  saveDropshipSupplierSettings,
  saveSupplierFeed,
  setSupplierPortalAccess,
  updateDropshipOrder,
} from "@/lib/dropshipping.functions";
import { channelsQuery } from "@/lib/channels-queries";
import { suppliersQuery } from "@/lib/purchasing-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/dropshipping")({
  head: () => ({
    meta: [
      { title: "Dropshipping & XML Entegrasyonu — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi XML, CSV ve API beslemelerini bağla; stok ve fiyat senkronizasyonunu otomatikleştir, siparişleri tedarikçiye gönder.",
      },
      { property: "og:title", content: "Dropshipping & XML Entegrasyonu — Mefticaret" },
      {
        property: "og:description",
        content: "Otomatik ürün içe aktarma, fiyat/stok kuralları ve dropshipping sipariş gönderimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DropshippingPage,
});

const FIELD_KEYS: { key: keyof FieldMap; label: string }[] = [
  { key: "external_id", label: "Tedarikçi kodu" },
  { key: "sku", label: "SKU" },
  { key: "barcode", label: "Barkod" },
  { key: "title", label: "Ürün adı" },
  { key: "brand", label: "Marka" },
  { key: "category", label: "Kategori" },
  { key: "price", label: "Fiyat" },
  { key: "stock", label: "Stok" },
  { key: "images", label: "Görsel" },
  { key: "description", label: "Açıklama" },
];

const emptyForm = {
  id: "" as string,
  name: "",
  kind: "xml" as SupplierFeedKind,
  sourceUrl: "",
  authHeader: "",
  schedule: "daily" as SupplierFeedSchedule,
  matchKey: "sku" as SupplierMatchKey,
  itemPath: "",
  supplierId: "",
  importImages: true,
  createMissing: false,
  isActive: true,
  priceMode: "markup" as "markup" | "margin" | "fixed",
  priceValue: 0.35,
  rounding: "none" as "none" | "integer" | "psychological",
  minPrice: 0,
  stockBuffer: 0,
  stockThreshold: 0,
  stockCap: 0,
  fieldMap: {} as FieldMap,
};

type FormState = typeof emptyForm;

const parseMapping = (raw: string): Record<string, string> =>
  Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.split("="))
      .filter((parts) => parts.length >= 2 && parts[0]!.trim() && parts[1]!.trim())
      .map((parts) => [parts[0]!.trim(), parts.slice(1).join("=").trim()]),
  );

const mappingToText = (mapping: Record<string, string> = {}) =>
  Object.entries(mapping)
    .map(([from, to]) => `${from}=${to}`)
    .join("\n");

function DropshippingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: feeds } = useQuery(supplierFeedsQuery(storeId));
  const { data: runs } = useQuery(supplierFeedRunsQuery(storeId));
  const { data: suppliers } = useQuery(suppliersQuery(storeId));
  const { data: dropshipOrders } = useQuery(dropshipOrdersQuery(storeId));

  const [form, setForm] = useState<FormState>(emptyForm);
  const [categoryMapText, setCategoryMapText] = useState("");
  const [brandMapText, setBrandMapText] = useState("");
  const [selectedFeedId, setSelectedFeedId] = useState<string>("");
  const [preview, setPreview] = useState<{ total: number; fields: string[] } | null>(null);

  const { data: supplierProducts } = useQuery(
    supplierProductsQuery(storeId, selectedFeedId || undefined),
  );

  const saveFeedFn = useServerFn(saveSupplierFeed);
  const deleteFeedFn = useServerFn(deleteSupplierFeed);
  const runFeedFn = useServerFn(runSupplierFeedNow);
  const previewFn = useServerFn(previewSupplierFeed);
  const supplierSettingsFn = useServerFn(saveDropshipSupplierSettings);
  const updateDropshipFn = useServerFn(updateDropshipOrder);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["supplier-feeds", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["supplier-feed-runs", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["supplier-products", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["dropship-orders", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["suppliers", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: async () =>
      saveFeedFn({
        data: {
          storeId,
          ...(form.id ? { id: form.id } : {}),
          supplierId: form.supplierId || null,
          name: form.name,
          kind: form.kind,
          sourceUrl: form.sourceUrl,
          authHeader: form.authHeader || null,
          schedule: form.schedule,
          matchKey: form.matchKey,
          itemPath: form.itemPath || null,
          fieldMap: form.fieldMap,
          categoryMap: parseMapping(categoryMapText),
          brandMap: parseMapping(brandMapText),
          priceRules: {
            mode: form.priceMode,
            value: Number(form.priceValue) || 0,
            rounding: form.rounding,
            ...(form.minPrice > 0 ? { minPrice: form.minPrice } : {}),
          },
          stockRules: {
            buffer: Math.trunc(form.stockBuffer) || 0,
            minThreshold: Math.trunc(form.stockThreshold) || 0,
            ...(form.stockCap > 0 ? { cap: Math.trunc(form.stockCap) } : {}),
          },
          importImages: form.importImages,
          createMissing: form.createMissing,
          isActive: form.isActive,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Besleme güncellendi" : "Besleme oluşturuldu");
      setForm(emptyForm);
      setCategoryMapText("");
      setBrandMapText("");
      setPreview(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: async () =>
      previewFn({
        data: {
          storeId,
          kind: form.kind,
          sourceUrl: form.sourceUrl,
          authHeader: form.authHeader || null,
          itemPath: form.itemPath || null,
        },
      }),
    onSuccess: (result) => {
      setPreview({ total: result.total, fields: result.fields });
      toast.success(`${result.total} kayıt bulundu, ${result.fields.length} alan algılandı`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: async (feedId: string) => runFeedFn({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      const t = result.totals;
      toast.success(
        `Senkronizasyon tamam · ${t.imported} kayıt, ${t.matched} eşleşme, ${t.created} yeni ürün, ${t.priceUpdated} fiyat, ${t.stockUpdated} stok`,
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (feedId: string) => deleteFeedFn({ data: { storeId, feedId } }),
    onSuccess: () => {
      toast.success("Besleme silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const supplierMutation = useMutation({
    mutationFn: async (input: {
      supplierId: string;
      isDropship: boolean;
      leadTimeDays: number;
      currency: string;
      autoSendOrders: boolean;
      orderEndpoint: string;
    }) => supplierSettingsFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Tedarikçi dropshipping ayarları kaydedildi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dropshipMutation = useMutation({
    mutationFn: async (input: {
      dropshipOrderId: string;
      status: "pending" | "sent" | "accepted" | "shipped" | "cancelled" | "failed";
      carrier?: string;
      trackingNumber?: string;
    }) => updateDropshipFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Dropshipping siparişi güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editFeed = (feed: SupplierFeedRow) => {
    setForm({
      id: feed.id,
      name: feed.name,
      kind: feed.kind,
      sourceUrl: feed.source_url,
      authHeader: feed.auth_header ?? "",
      schedule: feed.schedule,
      matchKey: feed.match_key,
      itemPath: feed.item_path ?? "",
      supplierId: feed.supplier_id ?? "",
      importImages: feed.import_images,
      createMissing: feed.create_missing,
      isActive: feed.is_active,
      priceMode: feed.price_rules?.mode ?? "markup",
      priceValue: Number(feed.price_rules?.value ?? 0),
      rounding: feed.price_rules?.rounding ?? "none",
      minPrice: Number(feed.price_rules?.minPrice ?? 0),
      stockBuffer: Number(feed.stock_rules?.buffer ?? 0),
      stockThreshold: Number(feed.stock_rules?.minThreshold ?? 0),
      stockCap: Number(feed.stock_rules?.cap ?? 0),
      fieldMap: feed.field_map ?? {},
    });
    setCategoryMapText(mappingToText(feed.category_map));
    setBrandMapText(mappingToText(feed.brand_map));
    setSelectedFeedId(feed.id);
    setPreview(null);
  };

  const priceSample = useMemo(
    () =>
      computeSalePrice(100, {
        mode: form.priceMode,
        value: Number(form.priceValue) || 0,
        rounding: form.rounding,
        ...(form.minPrice > 0 ? { minPrice: form.minPrice } : {}),
      }),
    [form.priceMode, form.priceValue, form.rounding, form.minPrice],
  );

  const stockSample = useMemo(
    () =>
      computeStock(20, {
        buffer: Math.trunc(form.stockBuffer) || 0,
        minThreshold: Math.trunc(form.stockThreshold) || 0,
        ...(form.stockCap > 0 ? { cap: Math.trunc(form.stockCap) } : {}),
      }),
    [form.stockBuffer, form.stockThreshold, form.stockCap],
  );

  const dropshipSuppliers = (suppliers ?? []).filter((s) => s.is_active);

  const autoMapFn = useServerFn(autoMapFeedCategories);
  const publishFn = useServerFn(publishFeedProducts);
  const portalFn = useServerFn(setSupplierPortalAccess);
  const { data: channels } = useQuery(channelsQuery(storeId));
  const [publishChannels, setPublishChannels] = useState<string[]>([]);
  const [publishActivate, setPublishActivate] = useState(true);
  const [publishOnlyInStock, setPublishOnlyInStock] = useState(true);
  const [categorySuggestions, setCategorySuggestions] = useState<
    { source: string; target: string; action: "matched" | "create"; score: number }[]
  >([]);

  const autoMapMutation = useMutation({
    mutationFn: async (feedId: string) => autoMapFn({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      setCategorySuggestions(result.suggestions);
      setCategoryMapText(mappingToText(result.map));
      toast.success(`${result.suggestions.length} kategori otomatik eşleştirildi`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: async (feedId: string) =>
      publishFn({
        data: {
          storeId,
          feedId,
          channelIds: publishChannels,
          activate: publishActivate,
          onlyInStock: publishOnlyInStock,
        },
      }),
    onSuccess: (totals) => {
      toast.success(
        `Yayınlandı · ${totals.productsCreated} yeni ürün, ${totals.productsActivated} aktifleştirme, ${totals.categoriesAssigned} kategori, ${totals.listingsQueued} pazaryeri kaydı`,
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["channel-listings", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const portalMutation = useMutation({
    mutationFn: async (input: { supplierId: string; email?: string; enabled: boolean }) =>
      portalFn({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Tedarikçi portal erişimi güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });


  return (
    <AppShell
      storeId={storeId}
      title="Dropshipping & XML Entegrasyonu"
      description="Tedarikçi XML / CSV / API beslemeleri, fiyat ve stok kuralları, tedarikçiye sipariş gönderimi."
    >
      <div className="space-y-8">

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-muted-foreground" />
              <h2 className="font-medium">{form.id ? "Beslemeyi düzenle" : "Yeni besleme"}</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Besleme adı</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ana tedarikçi XML"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tür</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value as SupplierFeedKind })}
                >
                  {Object.entries(FEED_KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Kaynak adresi (URL)</Label>
                <Input
                  value={form.sourceUrl}
                  onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                  placeholder="https://tedarikci.com/urunler.xml"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kimlik başlığı (opsiyonel)</Label>
                <Input
                  value={form.authHeader}
                  onChange={(e) => setForm({ ...form, authHeader: e.target.value })}
                  placeholder="Authorization: Bearer xxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ürün düğümü / dizi yolu</Label>
                <Input
                  value={form.itemPath}
                  onChange={(e) => setForm({ ...form, itemPath: e.target.value })}
                  placeholder="Product veya data.items"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Senkronizasyon</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.schedule}
                  onChange={(e) =>
                    setForm({ ...form, schedule: e.target.value as SupplierFeedSchedule })
                  }
                >
                  {Object.entries(FEED_SCHEDULE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Eşleştirme anahtarı</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.matchKey}
                  onChange={(e) =>
                    setForm({ ...form, matchKey: e.target.value as SupplierMatchKey })
                  }
                >
                  {Object.entries(MATCH_KEY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tedarikçi</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">Tedarikçi seçilmedi</option>
                  {dropshipSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 rounded-lg bg-muted/40 p-3 text-sm">
              <label className="flex items-center gap-2">
                <Switch
                  checked={form.importImages}
                  onCheckedChange={(v) => setForm({ ...form, importImages: v })}
                />
                Görsel aktarımı
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={form.createMissing}
                  onCheckedChange={(v) => setForm({ ...form, createMissing: v })}
                />
                Eşleşmeyen ürünleri oluştur
              </label>
              <label className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                Aktif
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Alan eşleştirme</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!form.sourceUrl || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  <Wand2 className="mr-1.5 size-3.5" />
                  Kaynağı analiz et
                </Button>
              </div>
              {preview ? (
                <p className="text-xs text-muted-foreground">
                  {preview.total} kayıt · algılanan alanlar: {preview.fields.slice(0, 12).join(", ")}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELD_KEYS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    {preview?.fields.length ? (
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={form.fieldMap[key] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fieldMap: { ...form.fieldMap, [key]: e.target.value },
                          })
                        }
                      >
                        <option value="">Otomatik</option>
                        {preview.fields.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={form.fieldMap[key] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fieldMap: { ...form.fieldMap, [key]: e.target.value },
                          })
                        }
                        placeholder="kaynak alan adı"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Fiyat kuralları</p>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.priceMode}
                  onChange={(e) =>
                    setForm({ ...form, priceMode: e.target.value as FormState["priceMode"] })
                  }
                >
                  <option value="markup">Maliyet üzerine oran</option>
                  <option value="margin">Hedef kâr marjı</option>
                  <option value="fixed">Sabit tutar ekle</option>
                </select>
                <Input
                  type="number"
                  step="0.01"
                  value={form.priceValue}
                  onChange={(e) => setForm({ ...form, priceValue: Number(e.target.value) })}
                  placeholder={form.priceMode === "fixed" ? "25" : "0.35"}
                />
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.rounding}
                  onChange={(e) =>
                    setForm({ ...form, rounding: e.target.value as FormState["rounding"] })
                  }
                >
                  <option value="none">Yuvarlama yok</option>
                  <option value="integer">Tam sayıya yuvarla</option>
                  <option value="psychological">x,99 fiyatlama</option>
                </select>
                <Input
                  type="number"
                  step="0.01"
                  value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: Number(e.target.value) })}
                  placeholder="Minimum satış fiyatı"
                />
                <p className="text-xs text-muted-foreground">
                  100 birim maliyet → <strong>{priceSample}</strong> satış fiyatı
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Stok kuralları</p>
                <Input
                  type="number"
                  value={form.stockBuffer}
                  onChange={(e) => setForm({ ...form, stockBuffer: Number(e.target.value) })}
                  placeholder="Güvenlik payı"
                />
                <Input
                  type="number"
                  value={form.stockThreshold}
                  onChange={(e) => setForm({ ...form, stockThreshold: Number(e.target.value) })}
                  placeholder="Alt eşik (altı tükendi sayılır)"
                />
                <Input
                  type="number"
                  value={form.stockCap}
                  onChange={(e) => setForm({ ...form, stockCap: Number(e.target.value) })}
                  placeholder="Üst sınır (0 = sınırsız)"
                />
                <p className="text-xs text-muted-foreground">
                  Tedarikçide 20 adet → vitrinde <strong>{stockSample}</strong> adet
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Kategori eşleştirme (satır başına kaynak=hedef)</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  value={categoryMapText}
                  onChange={(e) => setCategoryMapText(e.target.value)}
                  placeholder={"Erkek Giyim=Erkek\nKadin=Kadın"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Marka eşleştirme</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  value={brandMapText}
                  onChange={(e) => setBrandMapText(e.target.value)}
                  placeholder={"NIKE=Nike\nadidas=Adidas"}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || !form.sourceUrl || saveMutation.isPending}
              >
                {form.id ? "Değişiklikleri kaydet" : "Beslemeyi oluştur"}
              </Button>
              {form.id ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm(emptyForm);
                    setCategoryMapText("");
                    setBrandMapText("");
                  }}
                >
                  Vazgeç
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="font-medium">Beslemeler</h2>
              {(feeds ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz besleme eklenmedi.</p>
              ) : (
                <ul className="space-y-3">
                  {(feeds ?? []).map((feed) => (
                    <li key={feed.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{feed.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {FEED_KIND_LABEL[feed.kind]} · {FEED_SCHEDULE_LABEL[feed.schedule]} ·{" "}
                            {MATCH_KEY_LABEL[feed.match_key]}
                            {feed.suppliers ? ` · ${feed.suppliers.name}` : ""}
                          </p>
                        </div>
                        <Badge variant={feed.is_active ? "default" : "secondary"}>
                          {feed.is_active ? "Aktif" : "Kapalı"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{feed.source_url}</p>
                      <p className="text-xs text-muted-foreground">
                        Son çalışma: {feed.last_run_at ? formatDate(feed.last_run_at) : "—"}
                        {feed.next_run_at ? ` · Sıradaki: ${formatDate(feed.next_run_at)}` : ""}
                        {feed.last_status ? ` · ${feed.last_status === "success" ? "başarılı" : "hatalı"}` : ""}
                      </p>
                      {feed.last_error ? (
                        <p className="text-xs text-destructive">{feed.last_error}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={runMutation.isPending}
                          onClick={() => runMutation.mutate(feed.id)}
                        >
                          <RefreshCw className="mr-1.5 size-3.5" />
                          Şimdi senkronize et
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => editFeed(feed)}>
                          Düzenle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedFeedId(feed.id)}
                        >
                          Ürünleri gör
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(feed.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="font-medium">Senkronizasyon geçmişi</h2>
              {(runs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Kayıt yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(runs ?? []).slice(0, 10).map((run) => (
                    <li key={run.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {formatDate(run.started_at)} · {run.trigger === "manual" ? "manuel" : "zamanlanmış"}
                      </span>
                      <span>
                        {run.status === "success" ? (
                          <Badge variant="secondary">
                            {run.totals?.["imported"] ?? 0} kayıt · {run.totals?.["stockUpdated"] ?? 0} stok
                          </Badge>
                        ) : run.status === "running" ? (
                          <Badge variant="outline">çalışıyor</Badge>
                        ) : (
                          <Badge variant="destructive">hata</Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-medium">Dropshipping tedarikçileri</h2>
          {dropshipSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Önce Tedarik &amp; Satın Alma ekranından tedarikçi ekleyin.
            </p>
          ) : (
            <div className="space-y-3">
              {dropshipSuppliers.map((supplier) => (
                <SupplierDropshipRow
                  key={supplier.id}
                  supplier={supplier as never}
                  onSave={(input) => supplierMutation.mutate({ supplierId: supplier.id, ...input })}
                  pending={supplierMutation.isPending}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-4 text-muted-foreground" />
            <h2 className="font-medium">Tedarikçiye gönderilen siparişler</h2>
          </div>
          {(dropshipOrders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz dropshipping siparişi yok. Sipariş detayından tedarikçiye gönderim yapabilirsiniz.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Sipariş</th>
                    <th className="py-2">Tedarikçi</th>
                    <th className="py-2">Durum</th>
                    <th className="py-2">Kargo / takip</th>
                    <th className="py-2">Tarih</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(dropshipOrders ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2">
                        {row.orders?.order_number ?? "—"}
                        {row.orders ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatMoney(Number(row.orders.grand_total), row.orders.currency)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">{row.suppliers?.name ?? "—"}</td>
                      <td className="py-2">
                        <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                          {DROPSHIP_STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {[row.carrier, row.tracking_number].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">{formatDate(row.created_at)}</td>
                      <td className="py-2">
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                          value={row.status}
                          onChange={(e) =>
                            dropshipMutation.mutate({
                              dropshipOrderId: row.id,
                              status: e.target.value as never,
                              ...(row.carrier ? { carrier: row.carrier } : {}),
                              ...(row.tracking_number
                                ? { trackingNumber: row.tracking_number }
                                : {}),
                            })
                          }
                        >
                          {Object.entries(DROPSHIP_STATUS_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wand2 className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="font-medium">Tek tıkla ürün yükleme ve kategori eşleştirme</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Seçili beslemenin ürünlerini mağazanıza aktif ürün olarak aktarın ve aynı anda seçtiğiniz
            pazaryeri kanallarına yükleme kuyruğuna alın. Kategoriler tedarikçi verisinden otomatik
            eşleştirilir, eşleşme bulunmazsa kategori oluşturulur.
          </p>

          {!selectedFeedId ? (
            <p className="text-sm text-muted-foreground">
              Önce yukarıdaki listeden bir besleme seçin (Düzenle) — yayınlama o beslemeye uygulanır.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={publishActivate} onCheckedChange={setPublishActivate} />
                  Ürünleri yayına al (aktif)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={publishOnlyInStock} onCheckedChange={setPublishOnlyInStock} />
                  Yalnızca stokta olanlar
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Pazaryeri kanalları</Label>
                {(channels ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Henüz pazaryeri kanalı bağlı değil. Kanallar sayfasından Trendyol, Hepsiburada,
                    n11 gibi kanalları bağlayın.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(channels ?? []).map((channel: { id: string; name: string; provider: string }) => {
                      const active = publishChannels.includes(channel.id);
                      return (
                        <Button
                          key={channel.id}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() =>
                            setPublishChannels((current) =>
                              active
                                ? current.filter((id) => id !== channel.id)
                                : [...current, channel.id],
                            )
                          }
                        >
                          {channel.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={autoMapMutation.isPending}
                  onClick={() => autoMapMutation.mutate(selectedFeedId)}
                >
                  Kategorileri otomatik eşleştir
                </Button>
                <Button
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate(selectedFeedId)}
                >
                  <PackageCheck className="mr-1 size-4" aria-hidden />
                  Tek tıkla yükle
                </Button>
              </div>

              {categorySuggestions.length ? (
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2">Tedarikçi kategorisi</th>
                        <th className="p-2">Mağaza kategorisi</th>
                        <th className="p-2">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySuggestions.slice(0, 100).map((row) => (
                        <tr key={row.source} className="border-t">
                          <td className="p-2">{row.source}</td>
                          <td className="p-2">{row.target}</td>
                          <td className="p-2">
                            {row.action === "matched" ? (
                              <Badge variant="secondary">Eşleşti · {row.score}</Badge>
                            ) : (
                              <Badge variant="outline">Oluşturulacak</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-medium">Tedarikçi paneli erişimi</h2>
          <p className="text-sm text-muted-foreground">
            Tedarikçinize kendi panelini açın: gelen siparişleri ürün adı, açıklama, ürün kodu, stok
            kodu ve kargo firması ile görür, kargo/takip bilgisini bildirir. Tedarikçinin
            Mefticaret’te kayıtlı bir hesabı olmalıdır.
          </p>
          {dropshipSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Önce tedarikçi ekleyin.</p>
          ) : (
            <div className="space-y-3">
              {dropshipSuppliers.map((supplier) => (
                <SupplierPortalRow
                  key={supplier.id}
                  supplier={supplier as { id: string; name: string; email?: string | null; portal_enabled?: boolean }}
                  pending={portalMutation.isPending}
                  onSave={(input) => portalMutation.mutate({ supplierId: supplier.id, ...input })}
                />
              ))}
            </div>
          )}
        </section>



        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Tedarikçi ürünleri</h2>
            {selectedFeedId ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedFeedId("")}>
                Tüm beslemeler
              </Button>
            ) : null}
          </div>
          {(supplierProducts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Senkronizasyon sonrası tedarikçi ürünleri burada listelenir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Ürün</th>
                    <th className="py-2">SKU / Barkod</th>
                    <th className="py-2">Marka</th>
                    <th className="py-2">Maliyet</th>
                    <th className="py-2">Satış</th>
                    <th className="py-2">Stok</th>
                    <th className="py-2">Eşleşme</th>
                  </tr>
                </thead>
                <tbody>
                  {(supplierProducts ?? []).slice(0, 100).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="py-2">{row.title}</td>
                      <td className="py-2 text-muted-foreground">
                        {[row.sku, row.barcode].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-2 text-muted-foreground">{row.brand ?? "—"}</td>
                      <td className="py-2">{Number(row.supplier_price).toFixed(2)}</td>
                      <td className="py-2">{Number(row.computed_price ?? 0).toFixed(2)}</td>
                      <td className="py-2">{row.stock}</td>
                      <td className="py-2">
                        {row.variant_id ? (
                          <Badge variant="secondary">Eşleşti</Badge>
                        ) : (
                          <Badge variant="outline">Eşleşmedi</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function SupplierDropshipRow({
  supplier,
  onSave,
  pending,
}: {
  supplier: {
    id: string;
    name: string;
    is_dropship?: boolean;
    lead_time_days?: number;
    currency?: string;
    auto_send_orders?: boolean;
    order_endpoint?: string | null;
  };
  onSave: (input: {
    isDropship: boolean;
    leadTimeDays: number;
    currency: string;
    autoSendOrders: boolean;
    orderEndpoint: string;
  }) => void;
  pending: boolean;
}) {
  const [isDropship, setIsDropship] = useState(supplier.is_dropship ?? false);
  const [leadTimeDays, setLeadTimeDays] = useState(supplier.lead_time_days ?? 3);
  const [currency, setCurrency] = useState(supplier.currency ?? "TRY");
  const [autoSendOrders, setAutoSendOrders] = useState(supplier.auto_send_orders ?? false);
  const [orderEndpoint, setOrderEndpoint] = useState(supplier.order_endpoint ?? "");

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1.2fr_repeat(4,0.7fr)_auto] sm:items-end">
      <div>
        <p className="font-medium">{supplier.name}</p>
        <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={isDropship} onCheckedChange={setIsDropship} />
          Dropshipping
        </label>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tedarik (gün)</Label>
        <Input
          type="number"
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(Number(e.target.value))}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Para birimi</Label>
        <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Sipariş uç noktası</Label>
        <Input
          value={orderEndpoint}
          onChange={(e) => setOrderEndpoint(e.target.value)}
          placeholder="https://tedarikci.com/api/orders"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={autoSendOrders} onCheckedChange={setAutoSendOrders} />
          Otomatik
        </label>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            onSave({ isDropship, leadTimeDays, currency, autoSendOrders, orderEndpoint })
          }
        >
          Kaydet
        </Button>
      </div>
    </div>
  );
}

function SupplierPortalRow({
  supplier,
  pending,
  onSave,
}: {
  supplier: { id: string; name: string; email?: string | null; portal_enabled?: boolean };
  pending: boolean;
  onSave: (input: { email?: string; enabled: boolean }) => void;
}) {
  const [email, setEmail] = useState(supplier.email ?? "");
  const enabled = supplier.portal_enabled ?? false;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
      <div>
        <p className="font-medium">{supplier.name}</p>
        {enabled ? (
          <Badge variant="secondary" className="mt-1">
            Portal açık
          </Badge>
        ) : (
          <Badge variant="outline" className="mt-1">
            Portal kapalı
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={`portal-email-${supplier.id}`}>
          Tedarikçi hesap e-postası
        </Label>
        <Input
          id={`portal-email-${supplier.id}`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tedarikci@ornek.com"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !email} onClick={() => onSave({ email, enabled: true })}>
          Erişim ver
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !enabled}
          onClick={() => onSave({ enabled: false })}
        >
          Kapat
        </Button>
      </div>
    </div>
  );
}
