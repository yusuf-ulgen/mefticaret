import { Check, GripVertical, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FEED_PRESETS, detectPreset, type FeedPreset } from "@/lib/feed-presets";
import {
  MEFTI_FIELDS,
  MEFTI_FIELD_GROUPS,
  suggestMapping,
  type FieldMapping,
  type MeftiField,
} from "@/lib/supplier-import";

/**
 * Mapping Studio: solda canlı XML/Excel düğüm ağacı, sağda Mefticaret hedef
 * alanları. Düğümler sürükle-bırak ile ya da seçip tıklayarak eşleştirilir.
 */

type Node = { path: string; label: string; depth: number; sample: string; isLeaf: boolean };

function buildTree(columns: string[], sampleRow: Record<string, string> | undefined): Node[] {
  const seen = new Set<string>();
  const nodes: Node[] = [];
  for (const column of [...columns].sort((a, b) => a.localeCompare(b, "tr"))) {
    const parts = column.split(".");
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join(".");
      if (seen.has(path)) return;
      seen.add(path);
      const isLeaf = index === parts.length - 1;
      nodes.push({
        path,
        label: part,
        depth: index,
        sample: isLeaf ? String(sampleRow?.[path] ?? "").slice(0, 90) : "",
        isLeaf,
      });
    });
  }
  return nodes;
}

export function MappingStudio({
  columns,
  rows,
  mapping,
  onChange,
  onPreset,
}: {
  columns: string[];
  rows: Array<Record<string, string>>;
  mapping: FieldMapping;
  onChange: (mapping: FieldMapping) => void;
  onPreset?: (preset: FeedPreset) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<MeftiField | null>(null);
  const tree = useMemo(() => buildTree(columns, rows[0]), [columns, rows]);
  const detected = useMemo(() => detectPreset(columns), [columns]);

  const assigned = useMemo(() => new Set(Object.values(mapping).filter(Boolean) as string[]), [mapping]);

  const assign = (field: MeftiField, column: string | null) => {
    const next = { ...mapping };
    if (!column) delete next[field];
    else next[field] = column;
    onChange(next);
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-xl border bg-muted/20">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Besleme düğüm ağacı</p>
            <p className="text-[11px] text-muted-foreground">{columns.length} düğüm · örnek değerlerle</p>
          </div>
          {selected ? <Badge variant="secondary" className="max-w-[120px] truncate">{selected}</Badge> : null}
        </header>
        <div className="max-h-64 overflow-auto p-2 lg:max-h-[420px]">
          {tree.map((node) => (
            <button
              type="button"
              key={node.path}
              draggable={node.isLeaf}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", node.path)}
              onClick={() => setSelected(node.isLeaf ? node.path : null)}
              disabled={!node.isLeaf}
              style={{ paddingLeft: `${Math.min(node.depth, 4) * 10 + 8}px` }}
              className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
                node.isLeaf
                  ? `cursor-grab hover:bg-background ${selected === node.path ? "bg-background ring-1 ring-primary" : ""}`
                  : "font-semibold text-muted-foreground"
              }`}
            >
              {node.isLeaf ? <GripVertical className="size-3 shrink-0 text-muted-foreground" aria-hidden /> : null}
              <span className="truncate font-medium">{node.label}</span>
              {node.sample ? <span className="ml-auto max-w-[45%] truncate text-[10px] text-muted-foreground">{node.sample}</span> : null}
              {assigned.has(node.path) ? <Check className="size-3 shrink-0 text-emerald-600" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button className="shrink-0" size="sm" variant="outline" onClick={() => onChange(suggestMapping(columns))}>
            <Sparkles className="mr-1 size-4" aria-hidden />
            Otomatik eşleştir
          </Button>
          {FEED_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              className="shrink-0"
              size="sm"
              variant={detected?.id === preset.id ? "default" : "secondary"}
              title={preset.hint}
              onClick={() => {
                onChange({ ...preset.mapping });
                onPreset?.(preset);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {MEFTI_FIELD_GROUPS.map((group) => (
          <div key={group.key} className="min-w-0 rounded-xl border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MEFTI_FIELDS.filter((field) => field.group === group.key).map((field) => {
                const value = mapping[field.key];
                return (
                  <div
                    key={field.key}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(field.key);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOver(null);
                      const path = event.dataTransfer.getData("text/plain");
                      if (path) assign(field.key, path);
                    }}
                    onClick={() => {
                      if (selected) assign(field.key, selected);
                    }}
                    className={`rounded-lg border p-2 transition-colors ${
                      dragOver === field.key ? "border-primary bg-primary/5" : value ? "border-emerald-500/40" : "border-dashed"
                    } ${selected ? "cursor-copy" : ""}`}
                  >
                    <p className="text-xs font-medium">
                      {field.label}
                      {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <select
                        className="h-8 w-full rounded-md border bg-background px-1 text-xs"
                        value={value ?? ""}
                        onChange={(event) => assign(field.key, event.target.value || null)}
                      >
                        <option value="">— eşleştirilmedi —</option>
                        {columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                      {value ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 shrink-0"
                          aria-label={`${field.label} eşleştirmesini kaldır`}
                          onClick={(event) => {
                            event.stopPropagation();
                            assign(field.key, null);
                          }}
                        >
                          <X className="size-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
