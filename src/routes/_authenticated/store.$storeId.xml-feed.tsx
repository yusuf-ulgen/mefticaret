import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Filter,
  History,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/mefti";
import {
  FEED_KIND_LABEL,
  FEED_SCHEDULE_LABEL,
  MATCH_KEY_LABEL,
  parseList,
  type FieldMap,
  type FilterRules,
  type SupplierFeedKind,
  type SupplierFeedSchedule,
  type SupplierMatchKey,
} from "@/lib/dropshipping";
import { DROPSHIP_STATUS_LABEL } from "@/lib/dropshipping";
import { suppliersQuery } from "@/lib/purchasing-queries";
import {
  dropshipOrdersQuery,
  supplierFeedRunsQuery,
  supplierFeedsQuery,
  supplierProductsQuery,
  type SupplierFeedRow,
} from "@/lib/dropshipping-queries";
import {
  autoMapFeedCategories,
  saveDropshipSupplierSettings,
  setSupplierPortalAccess,
  updateDropshipOrder,
  deleteSupplierFeed,
  previewSupplierFeed,
  publishFeedProducts,
  runSupplierFeedNow,
  saveSupplierFeed,
} from "@/lib/dropshipping.functions";

/** XML/CSV/API entegratör: kaynak kurulumu, eşleştirme, filtreler, test önizleme, çalıştırma geçmişi. */
export const Route = createFileRoute("/_authenticated/store/$storeId/xml-feed")({
  head: () => ({
    meta: [
      { title: "XML Entegratör — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi XML, CSV veya API kaynağını bağla: alanları otomatik eşle, kategori ve marka eşleştir, filtre kurallarını uygula, test içe aktarma yap ve senkronizasyonu zamanla.",
      },
      { property: "og:title", content: "XML Entegratör — Mefticaret" },
      {
        property: "og:description",
        content: "Tedarikçi kaynakları, alan eşleme, filtre kuralları, test içe aktarma ve çalıştırma geçmişi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlFeedPage,
});

const FIELD_KEYS: { key: keyof FieldMap; label: string; hints: string[]; required?: boolean }[] = [
  { key: "external_id", label: "Tedarikçi kodu", hints: ["id", "urun_id", "productid", "stockcode", "kod"] },
  { key: "sku", label: "SKU", hints: ["sku", "stokkodu", "stock_code", "urunkodu"] },
  { key: "barcode", label: "Barkod", hints: ["barcode", "barkod", "ean", "gtin"] },
  { key: "title", label: "Ürün adı", hints: ["name", "title", "ad", "urunadi", "isim"], required: true },
  { key: "brand", label: "Marka", hints: ["brand", "marka"] },
  { key: "category", label: "Kategori", hints: ["category", "kategori", "categoryname", "kategoriadi"] },
  { key: "price", label: "Fiyat", hints: ["price", "fiyat", "satisfiyat", "listprice", "amount"], required: true },
  { key: "stock", label: "Stok", hints: ["stock", "stok", "quantity", "adet", "miktar"], required: true },
  { key: "images", label: "Görsel", hints: ["image", "images", "resim", "picture", "img", "photo"] },
  { key: "description", label: "Açıklama", hints: ["description", "aciklama", "detail", "detay"] },
];

const STEPS = ["Kaynak", "Alan eşleme", "Kategori & marka", "Fiyat, stok & filtre", "Test & zamanlama"] as const;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Kaynaktan gelen alan adlarını hedef alanlara otomatik eşler. */
function autoMap(fields: string[]): FieldMap {
  const map: FieldMap = {};
  for (const entry of FIELD_KEYS) {
    const found =
      fields.find((field) => entry.hints.includes(normalize(field))) ??
      fields.find((field) => entry.hints.some((hint) => normalize(field).includes(hint)));
    if (found) map[entry.key] = found;
  }
  return map;
}

/** `kaynak = hedef` satırlarını eşleştirme sözlüğüne çevirir. */
function parseMapText(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const [from, ...rest] = line.split("=");
    const to = rest.join("=").trim();
    if (from?.trim() && to) map[from.trim()] = to;
  }
  return map;
}

const mapToText = (map: Record<string, string>) =>
  Object.entries(map ?? {})
    .map(([from, to]) => `${from} = ${to}`)
    .join("\n");

const listToText = (values?: string[]) => (values ?? []).join("\n");

type Analysis = {
  total: number;
  fields: string[];
  sample: Record<string, string>[];
  rows: {
    title: string;
    sku: string | null;
    barcode: string | null;
    brand: string | null;
    category: string | null;
    supplierPrice: number;
    salePrice: number;
    supplierStock: number;
    stock: number;
    images: number;
    included: boolean;
  }[];
  filtered: number;
  brands: string[];
  categories: string[];
};

function XmlFeedPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const preview = useServerFn(previewSupplierFeed);
  const save = useServerFn(saveSupplierFeed);
  const runNow = useServerFn(runSupplierFeedNow);
  const removeFeed = useServerFn(deleteSupplierFeed);
  const autoCategories = useServerFn(autoMapFeedCategories);
  const publish = useServerFn(publishFeedProducts);

  const feeds = useQuery(supplierFeedsQuery(storeId));
  const runs = useQuery(supplierFeedRunsQuery(storeId));

  const [tab, setTab] = useState("sources");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SupplierFeedKind>("xml");
  const [sourceUrl, setSourceUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [itemPath, setItemPath] = useState("");
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [matchKey, setMatchKey] = useState<SupplierMatchKey>("sku");
  const [categoryMapText, setCategoryMapText] = useState("");
  const [brandMapText, setBrandMapText] = useState("");
  const [priceMode, setPriceMode] = useState<"markup" | "margin" | "fixed">("markup");
  const [priceValue, setPriceValue] = useState(20);
  const [rounding, setRounding] = useState<"none" | "integer" | "psychological">("psychological");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [buffer, setBuffer] = useState(0);
  const [minThreshold, setMinThreshold] = useState(0);
  const [cap, setCap] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [supplierVatIncluded, setSupplierVatIncluded] = useState(true);
  const [tiersText, setTiersText] = useState("");
  const [missingAction, setMissingAction] = useState<"ignore" | "zero_stock" | "deactivate">("zero_stock");

  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterMinStock, setFilterMinStock] = useState("");
  const [includeBrandsText, setIncludeBrandsText] = useState("");
  const [excludeBrandsText, setExcludeBrandsText] = useState("");
  const [includeCategoriesText, setIncludeCategoriesText] = useState("");
  const [excludeCategoriesText, setExcludeCategoriesText] = useState("");
  const [excludeKeywordsText, setExcludeKeywordsText] = useState("");
  const [schedule, setSchedule] = useState<SupplierFeedSchedule>("daily");
  const [importImages, setImportImages] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [poolFeedId, setPoolFeedId] = useState<string>("");
  const [portalEmails, setPortalEmails] = useState<Record<string, string>>({});

  const suppliers = useQuery({ ...suppliersQuery(storeId), enabled: tab === "suppliers" });
  const dropshipOrders = useQuery({ ...dropshipOrdersQuery(storeId), enabled: tab === "suppliers" });
  const saveSupplier = useServerFn(saveDropshipSupplierSettings);
  const savePortal = useServerFn(setSupplierPortalAccess);
  const saveOrder = useServerFn(updateDropshipOrder);

  const supplierSettings = useMutation({
    mutationFn: async (input: {
      supplierId: string;
      isDropship: boolean;
      leadTimeDays: number;
      currency: string;
      autoSendOrders: boolean;
      orderEndpoint: string | null;
    }) => saveSupplier({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Tedarikçi dropshipping ayarları kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["suppliers", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const portalAccess = useMutation({
    mutationFn: async (input: { supplierId: string; enabled: boolean; email?: string }) =>
      savePortal({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Tedarikçi portal erişimi güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["suppliers", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const orderStatus = useMutation({
    mutationFn: async (input: {
      dropshipOrderId: string;
      status: keyof typeof DROPSHIP_STATUS_LABEL;
      trackingNumber?: string | null;
    }) => saveOrder({ data: { storeId, ...input } }),
    onSuccess: () => {
      toast.success("Dropshipping siparişi güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["dropship-orders", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const products = useQuery({
    ...supplierProductsQuery(storeId, poolFeedId || undefined),
    enabled: tab === "pool",
  });

  /** "500=10" satırlarını kademe listesine çevirir (500 TL maliyete kadar %10 kâr). */
  const priceTiers = useMemo(
    () =>
      tiersText
        .split(/[\n;]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [rawUpTo, rawValue] = line.split("=");
          const upTo = Number(rawUpTo);
          const value = Number(rawValue);
          if (!Number.isFinite(value)) return null;
          return {
            ...(Number.isFinite(upTo) && upTo > 0 ? { upTo } : {}),
            value: priceMode === "fixed" ? value : value / 100,
          };
        })
        .filter((tier): tier is { upTo?: number; value: number } => tier !== null)
        .slice(0, 10),
    [tiersText, priceMode],
  );

  const priceRules = useMemo(
    () => ({
      mode: priceMode,
      value: priceMode === "fixed" ? priceValue : priceValue / 100,
      rounding,
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
      ...(fxRate ? { fxRate: Number(fxRate) } : {}),
      ...(vatRate ? { vatRate: Number(vatRate) } : {}),
      supplierVatIncluded,
      ...(priceTiers.length ? { tiers: priceTiers } : {}),
    }),
    [priceMode, priceValue, rounding, minPrice, maxPrice, fxRate, vatRate, supplierVatIncluded, priceTiers],
  );

  const stockRules = useMemo(
    () => ({
      buffer,
      minThreshold,
      ...(cap ? { cap: Number(cap) } : {}),
      missingAction,
    }),
    [buffer, minThreshold, cap, missingAction],
  );


  const filterRules = useMemo<FilterRules>(
    () => ({
      ...(filterMinPrice ? { minSupplierPrice: Number(filterMinPrice) } : {}),
      ...(filterMaxPrice ? { maxSupplierPrice: Number(filterMaxPrice) } : {}),
      ...(filterMinStock ? { minStock: Number(filterMinStock) } : {}),
      includeBrands: parseList(includeBrandsText),
      excludeBrands: parseList(excludeBrandsText),
      includeCategories: parseList(includeCategoriesText),
      excludeCategories: parseList(excludeCategoriesText),
      excludeKeywords: parseList(excludeKeywordsText),
    }),
    [
      filterMinPrice,
      filterMaxPrice,
      filterMinStock,
      includeBrandsText,
      excludeBrandsText,
      includeCategoriesText,
      excludeCategoriesText,
      excludeKeywordsText,
    ],
  );

  const analyze = useMutation({
    mutationFn: async (withRules: boolean) =>
      preview({
        data: {
          storeId,
          kind,
          sourceUrl: sourceUrl.trim(),
          authHeader: authHeader.trim() || null,
          itemPath: itemPath.trim() || null,
          ...(withRules
            ? {
                fieldMap,
                priceRules,
                stockRules,
                filterRules,
                categoryMap: parseMapText(categoryMapText),
                brandMap: parseMapText(brandMapText),
              }
            : {}),
        },
      }),
    onSuccess: (result, withRules) => {
      setAnalysis(result as Analysis);
      if (!withRules) {
        setFieldMap((current) => (Object.keys(current).length ? current : autoMap(result.fields)));
        toast.success(`${result.total} kayıt bulundu, ${result.fields.length} alan okundu`);
        setStep(1);
      } else {
        toast.success(
          `${result.total} kayıt · ${result.filtered} kayıt filtrelendi · ${result.rows.length} örnek satır hazır`,
        );
      }
    },
    onError: (error: Error) => toast.error(error.message || "Kaynak okunamadı"),
  });

  const resetForm = () => {
    setEditingId(null);
    setStep(0);
    setName("");
    setKind("xml");
    setSourceUrl("");
    setAuthHeader("");
    setItemPath("");
    setFieldMap({});
    setMatchKey("sku");
    setCategoryMapText("");
    setBrandMapText("");
    setPriceMode("markup");
    setPriceValue(20);
    setRounding("psychological");
    setMinPrice("");
    setMaxPrice("");
    setBuffer(0);
    setMinThreshold(0);
    setCap("");
    setFilterMinPrice("");
    setFilterMaxPrice("");
    setFilterMinStock("");
    setIncludeBrandsText("");
    setExcludeBrandsText("");
    setIncludeCategoriesText("");
    setExcludeCategoriesText("");
    setExcludeKeywordsText("");
    setSchedule("daily");
    setImportImages(true);
    setCreateMissing(true);
    setIsActive(true);
    setAnalysis(null);
  };

  const loadFeed = (feed: SupplierFeedRow) => {
    const price = feed.price_rules ?? {};
    const stock = feed.stock_rules ?? {};
    const filters = ((feed as { filter_rules?: FilterRules }).filter_rules ?? {}) as FilterRules;
    setEditingId(feed.id);
    setStep(0);
    setName(feed.name);
    setKind(feed.kind);
    setSourceUrl(feed.source_url);
    setAuthHeader(feed.auth_header ?? "");
    setItemPath(feed.item_path ?? "");
    setFieldMap(feed.field_map ?? {});
    setMatchKey(feed.match_key);
    setCategoryMapText(mapToText(feed.category_map ?? {}));
    setBrandMapText(mapToText(feed.brand_map ?? {}));
    setPriceMode(price.mode ?? "markup");
    setPriceValue(price.mode === "fixed" ? Number(price.value ?? 0) : Math.round(Number(price.value ?? 0) * 100));
    setRounding(price.rounding ?? "none");
    setMinPrice(price.minPrice !== undefined ? String(price.minPrice) : "");
    setMaxPrice(price.maxPrice !== undefined ? String(price.maxPrice) : "");
    setBuffer(Number(stock.buffer ?? 0));
    setMinThreshold(Number(stock.minThreshold ?? 0));
    setCap(stock.cap !== undefined ? String(stock.cap) : "");
    setFxRate(price.fxRate !== undefined ? String(price.fxRate) : "");
    setVatRate(price.vatRate !== undefined ? String(price.vatRate) : "");
    setSupplierVatIncluded(price.supplierVatIncluded ?? true);
    setTiersText(
      (price.tiers ?? [])
        .map(
          (tier) =>
            `${tier.upTo ?? 0}=${price.mode === "fixed" ? tier.value : Math.round(Number(tier.value) * 100)}`,
        )
        .join("\n"),
    );
    setMissingAction(stock.missingAction ?? "ignore");

    setFilterMinPrice(filters.minSupplierPrice !== undefined ? String(filters.minSupplierPrice) : "");
    setFilterMaxPrice(filters.maxSupplierPrice !== undefined ? String(filters.maxSupplierPrice) : "");
    setFilterMinStock(filters.minStock !== undefined ? String(filters.minStock) : "");
    setIncludeBrandsText(listToText(filters.includeBrands));
    setExcludeBrandsText(listToText(filters.excludeBrands));
    setIncludeCategoriesText(listToText(filters.includeCategories));
    setExcludeCategoriesText(listToText(filters.excludeCategories));
    setExcludeKeywordsText(listToText(filters.excludeKeywords));
    setSchedule(feed.schedule);
    setImportImages(feed.import_images);
    setCreateMissing(feed.create_missing);
    setIsActive(feed.is_active);
    setAnalysis(null);
    setTab("setup");
  };

  const persist = useMutation({
    mutationFn: async () =>
      save({
        data: {
          storeId,
          ...(editingId ? { id: editingId } : {}),
          name: name.trim(),
          kind,
          sourceUrl: sourceUrl.trim(),
          authHeader: authHeader.trim() || null,
          itemPath: itemPath.trim() || null,
          matchKey,
          fieldMap,
          categoryMap: parseMapText(categoryMapText),
          brandMap: parseMapText(brandMapText),
          priceRules,
          stockRules,
          filterRules,
          schedule,
          importImages,
          createMissing,
          isActive,
        },
      }),
    onSuccess: () => {
      toast.success(editingId ? "Kaynak güncellendi" : "Kaynak oluşturuldu");
      void queryClient.invalidateQueries({ queryKey: ["supplier-feeds", storeId] });
      resetForm();
      setTab("sources");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useMutation({
    mutationFn: async (feedId: string) => runNow({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      const totals = (result as { totals: Record<string, number> }).totals ?? {};
      toast.success(
        `Senkronizasyon tamamlandı · ${totals["imported"] ?? 0} ürün · ${totals["created"] ?? 0} yeni · ${totals["skipped"] ?? 0} atlandı`,
      );
      void queryClient.invalidateQueries({ queryKey: ["supplier-feeds", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["supplier-feed-runs", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["supplier-products", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const drop = useMutation({
    mutationFn: async (feedId: string) => removeFeed({ data: { storeId, feedId } }),
    onSuccess: () => {
      toast.success("Kaynak silindi");
      void queryClient.invalidateQueries({ queryKey: ["supplier-feeds", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mapCategories = useMutation({
    mutationFn: async (feedId: string) => autoCategories({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      const mapped = (result as { mapped?: number }).mapped ?? 0;
      toast.success(`${mapped} kategori mağaza kategorileriyle eşleştirildi`);
      void queryClient.invalidateQueries({ queryKey: ["supplier-feeds", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishAll = useMutation({
    mutationFn: async (feedId: string) =>
      publish({ data: { storeId, feedId, channelIds: [], activate: true, onlyInStock: true } }),
    onSuccess: (result) => {
      const totals = result as Record<string, number>;
      toast.success(`${totals["created"] ?? 0} ürün oluşturuldu, ${totals["updated"] ?? 0} ürün güncellendi`);
      void queryClient.invalidateQueries({ queryKey: ["supplier-products", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requiredOk = Boolean(fieldMap.title && fieldMap.price && fieldMap.stock);
  const canContinue =
    step === 0
      ? name.trim().length > 1 && /^https?:\/\//i.test(sourceUrl.trim())
      : step === 1
        ? requiredOk
        : true;

  const feedList = feeds.data ?? [];
  const feedName = (feedId: string) => feedList.find((feed) => feed.id === feedId)?.name ?? "Kaynak";

  return (
    <AppShell
      title="XML Entegratör"
      description="Tedarikçi XML, CSV ve API kaynaklarını bağla, kuralları uygula, ürün havuzunu yayınla."
    >
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sources">Kaynaklar</TabsTrigger>
          <TabsTrigger value="setup">{editingId ? "Kaynağı düzenle" : "Yeni kaynak"}</TabsTrigger>
          <TabsTrigger value="pool">Ürün havuzu</TabsTrigger>
          <TabsTrigger value="history">Çalıştırma geçmişi</TabsTrigger>
          <TabsTrigger value="suppliers">Tedarikçi & siparişler</TabsTrigger>
        </TabsList>

        {/* Kaynak listesi */}
        <TabsContent value="sources" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{feedList.length} kaynak tanımlı</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void feeds.refetch()}>
                <RefreshCcw className="mr-2 size-4" /> Yenile
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  setTab("setup");
                }}
              >
                <Plus className="mr-2 size-4" /> Yeni kaynak
              </Button>
            </div>
          </div>

          {feeds.isLoading ? (
            <p className="text-sm text-muted-foreground">Kaynaklar yükleniyor…</p>
          ) : feedList.length === 0 ? (
            <div className="surface-card p-6 text-sm text-muted-foreground">
              Henüz kaynak yok. “Yeni kaynak” ile tedarikçi XML, CSV veya API adresini bağlayabilirsin.
            </div>
          ) : (
            <div className="grid gap-3">
              {feedList.map((feed) => (
                <article key={feed.id} className="surface-card space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold">{feed.name}</h2>
                        <Badge variant="secondary">{FEED_KIND_LABEL[feed.kind]}</Badge>
                        <Badge variant="outline">{FEED_SCHEDULE_LABEL[feed.schedule]}</Badge>
                        {feed.is_active ? null : <Badge variant="outline">Pasif</Badge>}
                        {feed.last_status ? (
                          <Badge variant={feed.last_status === "failed" ? "destructive" : "secondary"}>
                            {feed.last_status === "failed" ? "Son çalıştırma hatalı" : "Son çalıştırma başarılı"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{feed.source_url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Eşleştirme: {MATCH_KEY_LABEL[feed.match_key]}
                        {feed.last_run_at
                          ? ` · Son çalıştırma: ${new Date(feed.last_run_at).toLocaleString("tr-TR")}`
                          : " · Hiç çalıştırılmadı"}
                        {feed.stats?.["imported"] ? ` · ${feed.stats["imported"]} ürün` : ""}
                      </p>
                      {feed.last_error ? <p className="mt-1 text-xs text-destructive">{feed.last_error}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => run.mutate(feed.id)} disabled={run.isPending}>
                        {run.isPending && run.variables === feed.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 size-4" />
                        )}
                        Çalıştır
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => loadFeed(feed)}>
                        Düzenle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mapCategories.mutate(feed.id)}
                        disabled={mapCategories.isPending}
                      >
                        <Wand2 className="mr-2 size-4" /> Kategori eşle
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPoolFeedId(feed.id);
                          setTab("pool");
                        }}
                      >
                        Ürünler
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => drop.mutate(feed.id)}
                        disabled={drop.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Kurulum sihirbazı */}
        <TabsContent value="setup" className="space-y-6">
          <ol className="flex flex-wrap gap-2 text-sm">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={`rounded-full border px-3 py-1 ${
                  index === step ? "border-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section className="surface-card space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Kaynak adı</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tedarikçi XML" />
                </div>
                <div className="space-y-1.5">
                  <Label>Kaynak tipi</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as SupplierFeedKind)}
                  >
                    {Object.entries(FEED_KIND_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kaynak adresi</Label>
                <Input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://tedarikci.com/xml/urunler.xml"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Yetkilendirme başlığı (opsiyonel)</Label>
                  <Input
                    value={authHeader}
                    onChange={(event) => setAuthHeader(event.target.value)}
                    placeholder="Authorization: Bearer ..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ürün düğümü / dizi yolu (opsiyonel)</Label>
                  <Input
                    value={itemPath}
                    onChange={(event) => setItemPath(event.target.value)}
                    placeholder="Product veya data.items"
                  />
                </div>
              </div>
              <Button onClick={() => analyze.mutate(false)} disabled={!canContinue || analyze.isPending}>
                {analyze.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-4" />
                )}
                Kaynağı analiz et
              </Button>
            </section>
          )}

          {step === 1 && (
            <section className="surface-card space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                {analysis
                  ? `${analysis.total} kayıt, ${analysis.fields.length} alan bulundu. Zorunlu alanlar: ürün adı, fiyat, stok.`
                  : "Önce kaynağı analiz et."}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {FIELD_KEYS.map((entry) => (
                  <div key={entry.key} className="space-y-1.5">
                    <Label>
                      {entry.label}
                      {entry.required ? " *" : ""}
                    </Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={fieldMap[entry.key] ?? ""}
                      onChange={(event) =>
                        setFieldMap((current) => ({ ...current, [entry.key]: event.target.value || undefined }))
                      }
                    >
                      <option value="">— seçilmedi —</option>
                      {(analysis?.fields ?? []).map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ürün eşleştirme anahtarı</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={matchKey}
                    onChange={(event) => setMatchKey(event.target.value as SupplierMatchKey)}
                  >
                    {Object.entries(MATCH_KEY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setFieldMap(autoMap(analysis?.fields ?? []))}
                    disabled={!analysis}
                  >
                    <Wand2 className="mr-2 size-4" /> Alanları otomatik eşle
                  </Button>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="surface-card space-y-4 p-4">
              <p className="text-sm text-muted-foreground">
                Her satıra <code>tedarikçi değeri = mağaza değeri</code> yaz. Boş bırakırsan kaynaktaki değerler
                olduğu gibi kullanılır.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Kategori eşleştirme</Label>
                  <Textarea
                    rows={8}
                    value={categoryMapText}
                    onChange={(event) => setCategoryMapText(event.target.value)}
                    placeholder={"Erkek Ayakkabı = Ayakkabı\nBayan Çanta = Çanta"}
                  />
                  {analysis?.categories?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Kaynakta bulunan kategoriler: {analysis.categories.slice(0, 12).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Marka eşleştirme</Label>
                  <Textarea
                    rows={8}
                    value={brandMapText}
                    onChange={(event) => setBrandMapText(event.target.value)}
                    placeholder={"NIKE TR = Nike\nadidas orj = Adidas"}
                  />
                  {analysis?.brands?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Kaynakta bulunan markalar: {analysis.brands.slice(0, 12).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="surface-card space-y-5 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Fiyat kuralı</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={priceMode}
                    onChange={(event) => setPriceMode(event.target.value as typeof priceMode)}
                  >
                    <option value="markup">Maliyet üzerine kâr (%)</option>
                    <option value="margin">Hedef marj (%)</option>
                    <option value="fixed">Sabit tutar ekle</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{priceMode === "fixed" ? "Eklenecek tutar" : "Oran (%)"}</Label>
                  <Input
                    type="number"
                    value={priceValue}
                    onChange={(event) => setPriceValue(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Yuvarlama</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={rounding}
                    onChange={(event) => setRounding(event.target.value as typeof rounding)}
                  >
                    <option value="none">Yuvarlama yok</option>
                    <option value="integer">Tam sayı</option>
                    <option value="psychological">,99 ile bitir</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Alt fiyat sınırı</Label>
                  <Input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Üst fiyat sınırı</Label>
                  <Input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Stok güvenlik payı</Label>
                  <Input type="number" value={buffer} onChange={(event) => setBuffer(Number(event.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Alt stok eşiği</Label>
                  <Input
                    type="number"
                    value={minThreshold}
                    onChange={(event) => setMinThreshold(Number(event.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vitrinde üst sınır</Label>
                  <Input value={cap} onChange={(event) => setCap(event.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Döviz kuru (1 birim = ₺)</Label>
                  <Input
                    value={fxRate}
                    onChange={(event) => setFxRate(event.target.value)}
                    placeholder="Kaynak TL ise boş bırak"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>KDV oranı (%)</Label>
                  <Input value={vatRate} onChange={(event) => setVatRate(event.target.value)} placeholder="20" />
                </div>
                <div className="space-y-1.5">
                  <Label>Kaynakta olmayan ürün</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={missingAction}
                    onChange={(event) => setMissingAction(event.target.value as typeof missingAction)}
                  >
                    <option value="ignore">Dokunma</option>
                    <option value="zero_stock">Stoğu sıfırla</option>
                    <option value="deactivate">Ürünü taslağa al</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={supplierVatIncluded}
                  onChange={(event) => setSupplierVatIncluded(event.target.checked)}
                />
                Tedarikçi fiyatları KDV dahil geliyor (işaretliyse KDV tekrar eklenmez)
              </label>

              <div className="space-y-1.5">
                <Label>Kademeli kâr oranları</Label>
                <Textarea
                  rows={3}
                  value={tiersText}
                  onChange={(event) => setTiersText(event.target.value)}
                  placeholder={"250=35\n1000=25\n0=15"}
                />
                <p className="text-xs text-muted-foreground">
                  Her satır “maliyet üst sınırı=oran”. Örnek: 250 TL’ye kadar %35, 1000 TL’ye kadar %25, üzeri için
                  0=15 yazın. Boş bırakılırsa yukarıdaki tek oran uygulanır.
                </p>
              </div>


              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Filter className="size-4" /> Filtre kuralları
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Min. tedarikçi fiyatı</Label>
                    <Input value={filterMinPrice} onChange={(event) => setFilterMinPrice(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Maks. tedarikçi fiyatı</Label>
                    <Input value={filterMaxPrice} onChange={(event) => setFilterMaxPrice(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Min. stok</Label>
                    <Input value={filterMinStock} onChange={(event) => setFilterMinStock(event.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Yalnızca bu markalar</Label>
                    <Textarea
                      rows={3}
                      value={includeBrandsText}
                      onChange={(event) => setIncludeBrandsText(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hariç tutulan markalar</Label>
                    <Textarea
                      rows={3}
                      value={excludeBrandsText}
                      onChange={(event) => setExcludeBrandsText(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Yalnızca bu kategoriler</Label>
                    <Textarea
                      rows={3}
                      value={includeCategoriesText}
                      onChange={(event) => setIncludeCategoriesText(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hariç tutulan kategoriler</Label>
                    <Textarea
                      rows={3}
                      value={excludeCategoriesText}
                      onChange={(event) => setExcludeCategoriesText(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Ürün adı bu kelimeleri içermesin</Label>
                  <Textarea
                    rows={2}
                    value={excludeKeywordsText}
                    onChange={(event) => setExcludeKeywordsText(event.target.value)}
                    placeholder={"outlet\nikinci el"}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="surface-card space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1.5">
                  <Label>Senkronizasyon sıklığı</Label>
                  <select
                    className="h-10 w-full min-w-56 rounded-md border bg-background px-3 text-sm"
                    value={schedule}
                    onChange={(event) => setSchedule(event.target.value as SupplierFeedSchedule)}
                  >
                    {Object.entries(FEED_SCHEDULE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" onClick={() => analyze.mutate(true)} disabled={analyze.isPending}>
                  {analyze.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 size-4" />
                  )}
                  Test içe aktarma & tam önizleme
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  Görselleri içe aktar
                  <Switch checked={importImages} onCheckedChange={setImportImages} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  Olmayan ürünleri oluştur
                  <Switch checked={createMissing} onCheckedChange={setCreateMissing} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  Kaynak aktif
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </label>
              </div>

              {analysis?.rows?.length ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {analysis.total} kayıt · {analysis.filtered} kayıt filtre kurallarına uymuyor · aşağıda ilk{" "}
                    {analysis.rows.length} satır
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-2">Ürün</th>
                          <th className="p-2">SKU / Barkod</th>
                          <th className="p-2">Marka / Kategori</th>
                          <th className="p-2">Maliyet</th>
                          <th className="p-2">Satış</th>
                          <th className="p-2">Stok</th>
                          <th className="p-2">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.rows.map((row, index) => (
                          <tr key={`${row.sku ?? row.title}-${index}`} className="border-t">
                            <td className="max-w-64 p-2">
                              <span className="line-clamp-2">{row.title}</span>
                              <span className="text-xs text-muted-foreground">{row.images} görsel</span>
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {row.sku ?? "—"} / {row.barcode ?? "—"}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {row.brand ?? "—"} / {row.category ?? "—"}
                            </td>
                            <td className="p-2">{formatMoney(row.supplierPrice, "TRY")}</td>
                            <td className="p-2 font-medium">{formatMoney(row.salePrice, "TRY")}</td>
                            <td className="p-2">
                              {row.stock}
                              <span className="text-xs text-muted-foreground"> / {row.supplierStock}</span>
                            </td>
                            <td className="p-2">
                              {row.included ? (
                                <Badge variant="secondary">Aktarılacak</Badge>
                              ) : (
                                <Badge variant="outline">Filtrelendi</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Test içe aktarma çalıştırarak fiyat, stok ve filtre kurallarının sonucunu kaydetmeden görebilirsin.
                </p>
              )}
            </section>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-2 size-4" /> Geri
            </Button>
            <div className="flex gap-2">
              {editingId ? (
                <Button variant="ghost" onClick={resetForm}>
                  Yeni kaynağa geç
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue || (step === 1 && !analysis)}>
                  İleri <ArrowRight className="ml-2 size-4" />
                </Button>
              ) : (
                <Button onClick={() => persist.mutate()} disabled={persist.isPending}>
                  {persist.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 size-4" />
                  )}
                  {editingId ? "Kaynağı güncelle" : "Kaynağı oluştur"}
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Ürün havuzu */}
        <TabsContent value="pool" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={poolFeedId}
              onChange={(event) => setPoolFeedId(event.target.value)}
            >
              <option value="">Tüm kaynaklar</option>
              {feedList.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.name}
                </option>
              ))}
            </select>
            <Button
              onClick={() => poolFeedId && publishAll.mutate(poolFeedId)}
              disabled={!poolFeedId || publishAll.isPending}
            >
              {publishAll.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Stokta olanları vitrine yayınla
            </Button>
          </div>

          {products.isLoading ? (
            <p className="text-sm text-muted-foreground">Ürünler yükleniyor…</p>
          ) : (products.data ?? []).length === 0 ? (
            <div className="surface-card p-6 text-sm text-muted-foreground">
              Bu kaynakta henüz ürün yok. Kaynağı çalıştırdıktan sonra ürün havuzu burada listelenir.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Ürün</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Marka</th>
                    <th className="p-2">Maliyet</th>
                    <th className="p-2">Satış</th>
                    <th className="p-2">Stok</th>
                    <th className="p-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {(products.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="max-w-72 p-2">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{row.sku ?? "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">{row.brand ?? "—"}</td>
                      <td className="p-2">{formatMoney(row.supplier_price, "TRY")}</td>
                      <td className="p-2 font-medium">
                        {row.computed_price !== null ? formatMoney(row.computed_price, "TRY") : "—"}
                      </td>
                      <td className="p-2">{row.stock}</td>
                      <td className="p-2">
                        {row.product_id ? (
                          <Badge variant="secondary">Vitrinde</Badge>
                        ) : (
                          <Badge variant="outline">Havuzda</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Çalıştırma geçmişi */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="size-4" /> Son 40 çalıştırma
            </div>
            <Button variant="outline" onClick={() => void runs.refetch()}>
              <RefreshCcw className="mr-2 size-4" /> Yenile
            </Button>
          </div>

          {(runs.data ?? []).length === 0 ? (
            <div className="surface-card p-6 text-sm text-muted-foreground">Henüz çalıştırma kaydı yok.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2">Kaynak</th>
                    <th className="p-2">Başlangıç</th>
                    <th className="p-2">Tetikleyici</th>
                    <th className="p-2">Sonuç</th>
                    <th className="p-2">Özet</th>
                  </tr>
                </thead>
                <tbody>
                  {(runs.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{feedName(row.feed_id)}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(row.started_at).toLocaleString("tr-TR")}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {row.trigger === "scheduled" ? "Zamanlanmış" : "Manuel"}
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            row.status === "failed"
                              ? "destructive"
                              : row.status === "running"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {row.status === "failed" ? "Hatalı" : row.status === "running" ? "Çalışıyor" : "Başarılı"}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {row.error
                          ? row.error
                          : `${row.totals?.["imported"] ?? 0} ürün · ${row.totals?.["created"] ?? 0} yeni · ${
                              row.totals?.["skipped"] ?? 0
                            } atlandı`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tedarikçi dropshipping ayarları ve siparişler */}
        <TabsContent value="suppliers" className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold">Tedarikçi dropshipping ayarları</h2>
            {(suppliers.data ?? []).length === 0 ? (
              <div className="surface-card p-6 text-sm text-muted-foreground">
                Henüz tedarikçi yok. Tedarik &amp; Satın Alma sayfasından tedarikçi ekleyebilirsin.
              </div>
            ) : (
              <div className="grid gap-3">
                {(suppliers.data ?? []).map((supplier) => {
                  const row = supplier as unknown as {
                    id: string;
                    name: string;
                    email: string | null;
                    currency: string | null;
                    is_dropship: boolean | null;
                    lead_time_days: number | null;
                    auto_send_orders: boolean | null;
                    order_endpoint: string | null;
                    portal_enabled: boolean | null;
                  };
                  return (
                    <form
                      key={row.id}
                      className="surface-card space-y-3 p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        supplierSettings.mutate({
                          supplierId: row.id,
                          isDropship: form.get("isDropship") === "on",
                          leadTimeDays: Number(form.get("leadTimeDays") ?? 3),
                          currency: String(form.get("currency") ?? "TRY").toUpperCase(),
                          autoSendOrders: form.get("autoSendOrders") === "on",
                          orderEndpoint: String(form.get("orderEndpoint") ?? "").trim() || null,
                        });
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{row.name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <label className="flex items-center gap-2">
                            Dropshipping
                            <input type="checkbox" name="isDropship" defaultChecked={Boolean(row.is_dropship)} />
                          </label>
                          <label className="flex items-center gap-2">
                            Siparişi otomatik gönder
                            <input
                              type="checkbox"
                              name="autoSendOrders"
                              defaultChecked={Boolean(row.auto_send_orders)}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Tedarik süresi (gün)</Label>
                          <Input type="number" name="leadTimeDays" defaultValue={row.lead_time_days ?? 3} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Para birimi</Label>
                          <Input name="currency" defaultValue={row.currency ?? "TRY"} maxLength={3} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Sipariş uç noktası (opsiyonel)</Label>
                          <Input
                            name="orderEndpoint"
                            defaultValue={row.order_endpoint ?? ""}
                            placeholder="https://tedarikci.com/api/orders"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1.5">
                          <Label>Tedarikçi portal e-postası</Label>
                          <Input
                            value={portalEmails[row.id] ?? row.email ?? ""}
                            onChange={(event) =>
                              setPortalEmails((current) => ({ ...current, [row.id]: event.target.value }))
                            }
                            placeholder="tedarikci@ornek.com"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={portalAccess.isPending}
                          onClick={() =>
                            portalAccess.mutate({
                              supplierId: row.id,
                              enabled: !row.portal_enabled,
                              ...(row.portal_enabled
                                ? {}
                                : { email: (portalEmails[row.id] ?? row.email ?? "").trim() }),
                            })
                          }
                        >
                          {row.portal_enabled ? "Portal erişimini kapat" : "Portal erişimi ver"}
                        </Button>
                        <Button type="submit" disabled={supplierSettings.isPending}>
                          Kaydet
                        </Button>
                      </div>
                    </form>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold">Dropshipping siparişleri</h2>
            {(dropshipOrders.data ?? []).length === 0 ? (
              <div className="surface-card p-6 text-sm text-muted-foreground">
                Tedarikçiye iletilmiş sipariş yok. Sipariş detayında dropshipping gönderimi yapabilirsin.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Sipariş</th>
                      <th className="p-2">Tedarikçi</th>
                      <th className="p-2">Tutar</th>
                      <th className="p-2">Kargo takip</th>
                      <th className="p-2">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dropshipOrders.data ?? []).map((order) => (
                      <tr key={order.id} className="border-t">
                        <td className="p-2">{order.orders?.order_number ?? "—"}</td>
                        <td className="p-2 text-xs text-muted-foreground">{order.suppliers?.name ?? "—"}</td>
                        <td className="p-2">
                          {order.orders
                            ? formatMoney(order.orders.grand_total, order.orders.currency)
                            : "—"}
                        </td>
                        <td className="p-2">
                          <Input
                            defaultValue={order.tracking_number ?? ""}
                            placeholder="Takip no"
                            onBlur={(event) => {
                              const value = event.target.value.trim();
                              if (value !== (order.tracking_number ?? ""))
                                orderStatus.mutate({
                                  dropshipOrderId: order.id,
                                  status: order.status,
                                  trackingNumber: value || null,
                                });
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-sm"
                            value={order.status}
                            onChange={(event) =>
                              orderStatus.mutate({
                                dropshipOrderId: order.id,
                                status: event.target.value as keyof typeof DROPSHIP_STATUS_LABEL,
                                trackingNumber: order.tracking_number,
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
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
