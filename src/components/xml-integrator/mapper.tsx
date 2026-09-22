/**
 * Sürükle-bırak alan eşleştirme ekranı: kaynak alanları hedef Mefticaret
 * alanlarının üzerine bırakılır, eşleşme beslemeye kaydedilir.
 */

import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Eye, GripVertical, Loader2, Sparkles, Wand2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { XmlCategoryMapper } from "@/components/xml-integrator/category-mapper";
import { VariationManager } from "@/components/xml-integrator/variation-manager";
import { CurrencySettings, useCurrencyRates } from "@/components/xml-integrator/currency-settings";
import { PricingRulesPanel } from "@/components/xml-integrator/pricing-rules-panel";
import {
  DEFAULT_PRICING_RULES,
  serializePricingRules,
  type PricingRules,
} from "@/lib/xml-pricing-rules";
import {
  DEFAULT_CURRENCY_CONFIG,
  PRICE_FIELD_KEYS,
  syncCurrencyTransforms,
  totalMultiplier,
  type CurrencyConfig,
} from "@/lib/xml-currency";
import { PreviewProductsDialog, type PreviewResult } from "@/components/xml-integrator/preview-products";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_VARIANT_CONFIG,
  type VariantConfig,
  type VariantMode,
} from "@/lib/xml-variant-parser";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Input } from "@/components/ui/input";
import { TransformPanel } from "@/components/xml-integrator/transform-panel";
import {
  describeTransforms,
  parseTransformRules,
  type TransformRules,
  type TransformStep,
} from "@/lib/xml-transforms";
import { xmlFieldSchemaQuery, xmlIntegratorOverviewQuery } from "@/lib/xml-integrator-queries";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  aiSuggestXmlFieldMapping,
  analyzeXmlSource,
  previewXmlImport,
  saveXmlFeed,
} from "@/lib/xml-integrator.functions";
import {
  TARGET_FIELDS,
  TARGET_FIELD_GROUP_LABELS,
  missingRequiredFields,
  type FieldMapping,
  type TargetFieldGroup,
  type XmlAuthType,
  type XmlPlatform,
  type XmlSchedule,
  type XmlSourceFormat,
} from "@/lib/xml-integrator";

const GROUPS = Object.keys(TARGET_FIELD_GROUP_LABELS) as TargetFieldGroup[];

export function XmlFieldMapper({ storeId, feedId }: { storeId: string; feedId: string }) {
  const client = useQueryClient();
  const overview = useQuery(xmlIntegratorOverviewQuery(storeId));
  const schema = useQuery(xmlFieldSchemaQuery(storeId, feedId));
  const analyze = useServerFn(analyzeXmlSource);
  const save = useServerFn(saveXmlFeed);
  const aiMapFields = useServerFn(aiSuggestXmlFieldMapping);
  const previewImport = useServerFn(previewXmlImport);

  const feed = overview.data?.feeds.find((row) => row.id === feedId);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [transforms, setTransforms] = useState<TransformRules>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<Record<string, { confidence: number; reason: string | null }>>({});
  const [variantMode, setVariantMode] = useState<VariantMode>("none");
  const [variantConfig, setVariantConfig] = useState<VariantConfig>(DEFAULT_VARIANT_CONFIG);
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig>(DEFAULT_CURRENCY_CONFIG);
  const [pricingRules, setPricingRules] = useState<PricingRules>(DEFAULT_PRICING_RULES);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  useEffect(() => {
    if (feed && loadedFor !== feed.id) {
      setMapping(feed.fieldMapping as FieldMapping);
      setTransforms(parseTransformRules(feed.transformRules));
      setVariantMode(feed.variantMode);
      setVariantConfig({ ...DEFAULT_VARIANT_CONFIG, ...feed.variantConfig });
      setCurrencyConfig({ ...DEFAULT_CURRENCY_CONFIG, ...feed.currencyConfig });
      setPricingRules({ ...DEFAULT_PRICING_RULES, ...feed.pricingRules });
      setLoadedFor(feed.id);
    }
  }, [feed, loadedFor]);

  const ratesQuery = useCurrencyRates();
  const rates = ratesQuery.data ?? [];

  /* Otomatik çevirim açıkken eşlenen fiyat alanlarına currency(kur) kuralı eklenir. */
  const effectiveTransforms = useMemo(
    () => syncCurrencyTransforms(transforms, mapping, currencyConfig, rates),
    [transforms, mapping, currencyConfig, rates],
  );
  const conversionMultiplier = totalMultiplier(currencyConfig, rates);
  const conversion =
    currencyConfig.autoConvert && conversionMultiplier > 0 && conversionMultiplier !== 1
      ? {
          from: currencyConfig.sourceCurrency,
          to: currencyConfig.targetCurrency,
          multiplier: conversionMultiplier,
        }
      : null;
  const mappedPriceFields = PRICE_FIELD_KEYS.filter((key) => mapping[key]).map(
    (key) => TARGET_FIELDS.find((field) => field.key === key)?.label ?? key,
  );

  const columns = useMemo(
    () => (schema.data ?? []).map((row) => ({ path: row.field_path, samples: row.sample_values ?? [] })),
    [schema.data],
  );
  const sampleRow = useMemo(() => {
    const row: Record<string, string> = {};
    for (const column of columns) row[column.path] = column.samples[0] ?? "";
    return row;
  }, [columns]);
  const visibleColumns = columns.filter((column) =>
    column.path.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const refresh = useMutation({
    mutationFn: () => {
      if (!feed?.sourceUrl) throw new Error("Bu beslemede kaynak bağlantısı yok");
      return analyze({
        data: {
          storeId,
          feedId,
          sourceUrl: feed.sourceUrl,
          sourceFormat: feed.sourceFormat as XmlSourceFormat,
          ...(feed.itemPath ? { itemPath: feed.itemPath } : {}),
          authType: feed.authType as XmlAuthType,
          authConfig: {},
        },
      });
    },
    onSuccess: (result) => {
      setMapping((current) => ({ ...result.suggestedMapping, ...current }));
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
      toast.success(`${result.columns.length} alan yenilendi`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aiFieldMutation = useMutation({
    mutationFn: () => aiMapFields({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      setMapping((current) => {
        const next = { ...current };
        for (const row of result.suggestions) next[row.targetKey] = row.sourcePath;
        return next;
      });
      setAiInfo(() => {
        const next: Record<string, { confidence: number; reason: string | null }> = {};
        for (const row of result.suggestions) next[row.targetKey] = { confidence: row.confidence, reason: row.reason };
        return next;
      });
      toast.success(
        `Yapay zekâ ${result.matched} alanı eşleştirdi (${result.highConfidence} tanesi %90+ güven)` +
          (result.creditsUsed ? ` · ${result.creditsUsed} kredi` : "") +
          " — kaydetmeyi unutmayın",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      previewImport({
        data: {
          storeId,
          feedId,
          fieldMapping: mapping,
          transformRules: effectiveTransforms as never,
          variantMode,
          variantConfig,
          pricingRules: serializePricingRules(pricingRules) as never,
        },
      }),
    onSuccess: (result) => {
      setPreview(result as PreviewResult);
      setPreviewOpen(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!feed) throw new Error("Besleme bulunamadı");
      return save({
        data: {
          storeId,
          feedId,
          name: feed.name,
          direction: feed.direction,
          platform: feed.platform as XmlPlatform,
          sourceFormat: feed.sourceFormat as XmlSourceFormat,
          ...(feed.sourceUrl ? { sourceUrl: feed.sourceUrl } : {}),
          ...(feed.itemPath ? { itemPath: feed.itemPath } : {}),
          authType: feed.authType as XmlAuthType,
          authConfig: {},
          ...(feed.outputFilename ? { outputFilename: feed.outputFilename } : {}),
          schedule: feed.schedule as XmlSchedule,
          fieldMapping: mapping,
          filterRules: {},
          transformRules: effectiveTransforms as never,
          currencyConfig,
          priceMarkup: feed.priceMarkup,
          currency: feed.currency,
          isActive: feed.isActive,
          variantMode,
          variantConfig,
          pricingRules,
        },
      });
    },
    onSuccess: () => {
      toast.success("Alan eşleştirmesi kaydedildi");
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (overview.isLoading || schema.isLoading) return <CardSkeleton />;
  if (!feed) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm">
        <p>Besleme bulunamadı.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/store/$storeId/xml-integrator/feeds" params={{ storeId }}>Listeye dön</Link>
        </Button>
      </div>
    );
  }

  const missing = missingRequiredFields(mapping);

  const onDragEnd = (event: DragEndEvent) => {
    const source = String(event.active.id);
    const target = event.over ? String(event.over.id) : null;
    if (!target) return;
    setMapping((current) => ({ ...current, [target]: source }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">{feed.name}</h2>
        <Badge variant="outline">{columns.length} kaynak alanı</Badge>
        <Badge variant="outline">{Object.keys(mapping).length} eşleşme</Badge>
        {columns.length ? (
          <Button
            className="ml-auto"
            size="sm"
            disabled={aiFieldMutation.isPending}
            onClick={() => aiFieldMutation.mutate()}
          >
            {aiFieldMutation.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-4" />
            )}
            Yapay zekâ ile eşleştir
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="fields" className="space-y-3">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="fields">Alan eşleme</TabsTrigger>
          <TabsTrigger value="variants">Varyasyon ve seçenekler</TabsTrigger>
          <TabsTrigger value="currency">Para birimi</TabsTrigger>
          <TabsTrigger value="pricing">Fiyatlandırma</TabsTrigger>
          <TabsTrigger value="categories">Kategori eşleme</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
      {columns.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm">
          <p className="text-muted-foreground">Bu beslemenin alan listesi henüz okunmadı.</p>
          <Button className="mt-3" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {refresh.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Wand2 className="mr-1 size-4" />}
            Kaynağı oku
          </Button>
        </div>
      ) : (
        <DndContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="space-y-2 rounded-xl border bg-card p-3 lg:sticky lg:top-4 lg:max-h-[80vh] lg:overflow-y-auto">
              <Input
                placeholder="Kaynak alanı ara"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alanı sağdaki kutuya sürükleyin; mobilde kutudan listeyle de seçebilirsiniz.
              </p>
              <ul className="space-y-1">
                {visibleColumns.map((column) => (
                  <li key={column.path}>
                    <DraggableColumn path={column.path} sample={column.samples[0] ?? ""} />
                  </li>
                ))}
              </ul>
            </aside>

            <div className="space-y-4">
              {GROUPS.map((group) => (
                <section key={group} className="space-y-2 rounded-xl border bg-card p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {TARGET_FIELD_GROUP_LABELS[group]}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TARGET_FIELDS.filter((field) => field.group === group).map((field) => (
                      <TargetSlot
                        key={field.key}
                        fieldKey={field.key}
                        label={field.label}
                        required={field.required}
                        value={mapping[field.key] ?? ""}
                        columns={columns.map((column) => column.path)}
                        transformSummary={describeTransforms(effectiveTransforms[field.key])}
                        ai={aiInfo[field.key] ?? null}
                        onOpenTransforms={() => setActiveField(field.key)}
                        onSelect={(value) =>
                          setMapping((current) => {
                            const next = { ...current };
                            if (value) next[field.key] = value;
                            else delete next[field.key];
                            return next;
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </DndContext>
      )}

        </TabsContent>

        <TabsContent value="variants">
          <VariationManager
            columns={columns.map((column) => column.path)}
            mode={variantMode}
            config={variantConfig}
            onModeChange={setVariantMode}
            onConfigChange={setVariantConfig}
          />
        </TabsContent>

        <TabsContent value="currency">
          <CurrencySettings
            config={currencyConfig}
            onChange={setCurrencyConfig}
            rates={rates}
            ratesLoading={ratesQuery.isLoading}
            mappedPriceFields={mappedPriceFields}
          />
        </TabsContent>

        <TabsContent value="pricing">
          <PricingRulesPanel rules={pricingRules} onChange={setPricingRules} />
        </TabsContent>

        <TabsContent value="categories">
          <XmlCategoryMapper storeId={storeId} feedId={feedId} />
        </TabsContent>
      </Tabs>

      {activeField ? (
        <TransformPanel
          open
          onOpenChange={(next) => {
            if (!next) setActiveField(null);
          }}
          fieldLabel={TARGET_FIELDS.find((field) => field.key === activeField)?.label ?? activeField}
          sourcePath={mapping[activeField] ?? ""}
          sample={
            columns.find((column) => column.path === mapping[activeField])?.samples[0] ?? ""
          }
          row={sampleRow}
          steps={transforms[activeField] ?? []}
          onChange={(steps: TransformStep[]) =>
            setTransforms((current) => {
              const next = { ...current };
              if (steps.length) next[activeField] = steps;
              else delete next[activeField];
              return next;
            })
          }
        />
      ) : null}


      {missing.length ? (
        <p className="text-xs text-destructive">
          Eksik zorunlu alan: {missing.map((field) => field.label).join(", ")}
        </p>
      ) : null}


      <div className="flex flex-wrap gap-2">
        <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          Eşleştirmeyi kaydet
        </Button>
        {feed.direction === "import" ? (
          <Button variant="outline" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()}>
            {previewMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Eye className="mr-1 size-4" />}
            İlk 10 ürünü önizle
          </Button>
        ) : null}
        {columns.length ? (
          <Button variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {refresh.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Wand2 className="mr-1 size-4" />}
            Alanları yenile
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/store/$storeId/xml-integrator/feeds" params={{ storeId }}>Listeye dön</Link>
        </Button>
      </div>

      <PreviewProductsDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        result={preview}
        conversion={conversion}
      />
    </div>
  );
}

function DraggableColumn({ path, sample }: { path: string; sample: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: path });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={`flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs ${
        isDragging ? "opacity-70 shadow-lg" : ""
      }`}
    >
      <GripVertical className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{path}</span>
      {sample ? <span className="max-w-24 truncate text-muted-foreground">{sample}</span> : null}
    </div>
  );
}

function TargetSlot({
  fieldKey,
  label,
  required,
  value,
  columns,
  onSelect,
  transformSummary,
  onOpenTransforms,
  ai,
}: {
  fieldKey: string;
  label: string;
  required?: boolean | undefined;
  value: string;
  columns: string[];
  onSelect: (value: string) => void;
  transformSummary: string;
  onOpenTransforms: () => void;
  ai?: { confidence: number; reason: string | null } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fieldKey });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1 rounded-lg border p-2 ${isOver ? "border-foreground bg-muted" : "bg-background"}`}
    >
      <p className="flex items-center gap-1 text-xs font-medium">
        <span className="min-w-0 truncate">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </span>
        {ai ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0 cursor-help items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="size-3" />%{Math.round(ai.confidence * 100)} eşleşme
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                {ai.reason || "Yapay zekâ önerisi — gerekçe belirtilmedi."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </p>
      {value ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onOpenTransforms}
              className="flex min-w-0 flex-1 items-center gap-1 rounded-md border bg-background px-2 py-1 text-left text-xs hover:bg-muted"
              aria-label={`${label} dönüştürme kuralları`}
            >
              <Wrench className="size-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{value}</span>
            </button>
            <Button size="icon" variant="ghost" aria-label={`${label} eşleşmesini kaldır`} onClick={() => onSelect("")}>
              <X className="size-3" />
            </Button>
          </div>
          {transformSummary ? (
            <p className="truncate text-[11px] text-muted-foreground">{transformSummary}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Dönüştürme için alana tıklayın</p>
          )}
        </div>
      ) : (
        <select
          aria-label={`${label} kaynak alanı`}
          className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          value=""
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Sürükleyin veya seçin</option>
          {columns.map((column) => (
            <option key={column} value={column}>{column}</option>
          ))}
        </select>
      )}
    </div>
  );
}
