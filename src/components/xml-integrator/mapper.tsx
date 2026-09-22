/**
 * Sürükle-bırak alan eşleştirme ekranı: kaynak alanları hedef Mefticaret
 * alanlarının üzerine bırakılır, eşleşme beslemeye kaydedilir.
 */

import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { GripVertical, Loader2, Wand2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { XmlCategoryMapper } from "@/components/xml-integrator/category-mapper";
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
import { analyzeXmlSource, saveXmlFeed } from "@/lib/xml-integrator.functions";
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

  const feed = overview.data?.feeds.find((row) => row.id === feedId);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [transforms, setTransforms] = useState<TransformRules>({});
  const [activeField, setActiveField] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (feed && loadedFor !== feed.id) {
      setMapping(feed.fieldMapping as FieldMapping);
      setTransforms(parseTransformRules(feed.transformRules));
      setLoadedFor(feed.id);
    }
  }, [feed, loadedFor]);

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
          transformRules: transforms as never,
          priceMarkup: feed.priceMarkup,
          currency: feed.currency,
          isActive: feed.isActive,
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
      </div>

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
                        transformSummary={describeTransforms(transforms[field.key])}
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

      <XmlCategoryMapper storeId={storeId} feedId={feedId} />

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
}: {
  fieldKey: string;
  label: string;
  required?: boolean | undefined;
  value: string;
  columns: string[];
  onSelect: (value: string) => void;
  transformSummary: string;
  onOpenTransforms: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fieldKey });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-1 rounded-lg border p-2 ${isOver ? "border-foreground bg-muted" : "bg-background"}`}
    >
      <p className="text-xs font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
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
