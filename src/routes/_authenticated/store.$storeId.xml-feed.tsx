import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/mefti";
import {
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
import { previewSupplierFeed, saveSupplierFeed } from "@/lib/dropshipping.functions";

/** XML/CSV/API entegratör kurulum sihirbazı: kaynak → alan eşleme → kurallar → zamanlama. */
export const Route = createFileRoute("/_authenticated/store/$storeId/xml-feed")({
  head: () => ({
    meta: [
      { title: "XML Entegratör Kurulumu — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi XML, CSV veya API kaynağını adım adım bağla: alanları otomatik eşle, fiyat ve stok kurallarını belirle, senkronizasyonu zamanla.",
      },
      { property: "og:title", content: "XML Entegratör Kurulumu — Mefticaret" },
      {
        property: "og:description",
        content: "Adım adım tedarikçi beslemesi kurulumu, otomatik alan eşleme ve canlı önizleme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlFeedWizardPage,
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

const STEPS = ["Kaynak", "Alan eşleme", "Fiyat & stok", "Zamanlama"] as const;

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

function XmlFeedWizardPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const preview = useServerFn(previewSupplierFeed);
  const save = useServerFn(saveSupplierFeed);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SupplierFeedKind>("xml");
  const [sourceUrl, setSourceUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [itemPath, setItemPath] = useState("");
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [matchKey, setMatchKey] = useState<SupplierMatchKey>("sku");
  const [priceMode, setPriceMode] = useState<"markup" | "margin" | "fixed">("markup");
  const [priceValue, setPriceValue] = useState(20);
  const [rounding, setRounding] = useState<"none" | "integer" | "psychological">("psychological");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [buffer, setBuffer] = useState(0);
  const [minThreshold, setMinThreshold] = useState(0);
  const [cap, setCap] = useState("");
  const [schedule, setSchedule] = useState<SupplierFeedSchedule>("daily");
  const [importImages, setImportImages] = useState(true);
  const [createMissing, setCreateMissing] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [analysis, setAnalysis] = useState<{
    total: number;
    fields: string[];
    sample: Record<string, string>[];
  } | null>(null);

  const analyze = useMutation({
    mutationFn: async () =>
      preview({
        data: {
          storeId,
          kind,
          sourceUrl: sourceUrl.trim(),
          authHeader: authHeader.trim() || null,
          itemPath: itemPath.trim() || null,
        },
      }),
    onSuccess: (result) => {
      setAnalysis(result);
      setFieldMap((current) => (Object.keys(current).length ? current : autoMap(result.fields)));
      toast.success(`${result.total} kayıt bulundu, ${result.fields.length} alan okundu`);
      setStep(1);
    },
    onError: (error: Error) => toast.error(error.message || "Kaynak okunamadı"),
  });

  const priceRules = useMemo(
    () => ({
      mode: priceMode,
      value: priceMode === "fixed" ? priceValue : priceValue / 100,
      rounding,
      ...(minPrice ? { minPrice: Number(minPrice) } : {}),
      ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}),
    }),
    [priceMode, priceValue, rounding, minPrice, maxPrice],
  );

  const stockRules = useMemo(
    () => ({ buffer, minThreshold, ...(cap ? { cap: Number(cap) } : {}) }),
    [buffer, minThreshold, cap],
  );

  const create = useMutation({
    mutationFn: async () =>
      save({
        data: {
          storeId,
          name: name.trim(),
          kind,
          sourceUrl: sourceUrl.trim(),
          authHeader: authHeader.trim() || null,
          schedule,
          matchKey,
          itemPath: itemPath.trim() || null,
          fieldMap,
          categoryMap: {},
          brandMap: {},
          priceRules,
          stockRules,
          importImages,
          createMissing,
          isActive,
        },
      }),
    onSuccess: () => {
      toast.success("Besleme oluşturuldu");
      navigate({ to: "/store/$storeId/dropshipping", params: { storeId } });
    },
    onError: (error: Error) => toast.error(error.message || "Kaydedilemedi"),
  });

  const sampleRow = analysis?.sample[0] ?? null;
  const sampleCost = sampleRow ? Number(String(sampleRow[fieldMap.price ?? ""] ?? "0").replace(",", ".")) || 0 : 0;
  const sampleStock = sampleRow ? Number(String(sampleRow[fieldMap.stock ?? ""] ?? "0").replace(",", ".")) || 0 : 0;

  const canContinue =
    step === 0
      ? name.trim().length >= 2 && /^https?:\/\//.test(sourceUrl.trim())
      : step === 1
        ? Boolean(fieldMap.title && fieldMap.price && fieldMap.stock)
        : true;

  return (
    <AppShell
      storeId={storeId}
      title="XML Entegratör Kurulumu"
      description="Tedarikçi kaynağını bağla, alanları eşle, fiyat ve stok kurallarını belirle."
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/store/$storeId/dropshipping", params: { storeId } })}>
          Beslemelere dön
        </Button>
      }
    >
      <div className="space-y-6">
        <ol className="surface-card flex flex-wrap items-center gap-3 p-4 text-sm">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : index === step
                      ? "border border-primary text-primary"
                      : "border text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="size-3" /> : index + 1}
              </span>
              <span className={index === step ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {index < STEPS.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="surface-card space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Besleme adı</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ana tedarikçi XML" />
              </div>
              <div className="space-y-1.5">
                <Label>Kaynak türü</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as SupplierFeedKind)}
                >
                  {Object.entries(FEED_KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Kaynak adresi (URL)</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://tedarikci.com/feed.xml"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kimlik doğrulama başlığı (opsiyonel)</Label>
                <Input
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="Authorization: Bearer ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ürün düğümü / yol (opsiyonel)</Label>
                <Input value={itemPath} onChange={(e) => setItemPath(e.target.value)} placeholder="product" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Boş bırakırsanız ürün düğümü otomatik algılanır. Kimlik bilgileri yalnızca sunucuda kullanılır.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => analyze.mutate()} disabled={!canContinue || analyze.isPending}>
                {analyze.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 size-4" />
                )}
                Kaynağı analiz et
              </Button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="surface-card space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{analysis?.total ?? 0} kayıt</Badge>
              <Badge variant="outline">{analysis?.fields.length ?? 0} alan</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFieldMap(autoMap(analysis?.fields ?? []))}
                className="ml-auto"
              >
                <Sparkles className="mr-2 size-4" /> Otomatik eşle
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {FIELD_KEYS.map((entry) => (
                <div key={entry.key} className="space-y-1.5">
                  <Label>
                    {entry.label}
                    {entry.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={fieldMap[entry.key] ?? ""}
                    onChange={(e) => setFieldMap({ ...fieldMap, [entry.key]: e.target.value || undefined })}
                  >
                    <option value="">— seçilmedi —</option>
                    {(analysis?.fields ?? []).map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                  {sampleRow && fieldMap[entry.key] && (
                    <p className="truncate text-xs text-muted-foreground">
                      Örnek: {sampleRow[fieldMap[entry.key] as string] ?? "—"}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1.5 md:max-w-xs">
              <Label>Eşleştirme anahtarı</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={matchKey}
                onChange={(e) => setMatchKey(e.target.value as SupplierMatchKey)}
              >
                {Object.entries(MATCH_KEY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="surface-card space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Fiyat kuralı</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={priceMode}
                  onChange={(e) => setPriceMode(e.target.value as typeof priceMode)}
                >
                  <option value="markup">Kâr ekle (%)</option>
                  <option value="margin">Hedef marj (%)</option>
                  <option value="fixed">Sabit tutar ekle</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{priceMode === "fixed" ? "Eklenecek tutar" : "Oran (%)"}</Label>
                <Input
                  type="number"
                  value={priceValue}
                  onChange={(e) => setPriceValue(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Yuvarlama</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={rounding}
                  onChange={(e) => setRounding(e.target.value as typeof rounding)}
                >
                  <option value="none">Yok</option>
                  <option value="integer">Tam sayı</option>
                  <option value="psychological">Psikolojik (,99)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Alt fiyat sınırı</Label>
                <Input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Üst fiyat sınırı</Label>
                <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Stok güvenlik payı</Label>
                <Input type="number" value={buffer} onChange={(e) => setBuffer(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum stok eşiği</Label>
                <Input
                  type="number"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stok üst sınırı</Label>
                <Input type="number" value={cap} onChange={(e) => setCap(e.target.value)} />
              </div>
            </div>
            {sampleRow && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Önizleme</p>
                <p className="text-muted-foreground">
                  Tedarikçi fiyatı {formatMoney(sampleCost)} → satış {formatMoney(computeSalePrice(sampleCost, priceRules))}
                  {" · "}
                  Tedarikçi stoğu {sampleStock} → vitrin {computeStock(sampleStock, stockRules)}
                </p>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="surface-card space-y-4 p-4">
            <div className="space-y-1.5 md:max-w-xs">
              <Label>Senkronizasyon sıklığı</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as SupplierFeedSchedule)}
              >
                {Object.entries(FEED_SCHEDULE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
                Besleme aktif
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{name || "Adsız besleme"}</span> ·{" "}
                {FEED_KIND_LABEL[kind]} · {FEED_SCHEDULE_LABEL[schedule]} · eşleştirme: {MATCH_KEY_LABEL[matchKey]}
              </p>
              <p className="truncate">{sourceUrl}</p>
              <p>{analysis ? `${analysis.total} kayıt analiz edildi` : "Kaynak analiz edilmedi"}</p>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="mr-2 size-4" /> Geri
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue || (step === 1 && !analysis)}>
              İleri <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
              Beslemeyi oluştur
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
