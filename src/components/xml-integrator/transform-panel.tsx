/**
 * Dönüştürme paneli: eşleşen bir alana tıklandığında açılır, o alan için
 * kural zinciri (16 kural) kurulur ve örnek değerle canlı önizlenir.
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  TRANSFORM_DEFINITIONS,
  TRANSFORM_BY_KIND,
  TRANSFORM_GROUP_LABELS,
  applyTransforms,
  defaultTransformStep,
  type TransformGroup,
  type TransformKind,
  type TransformStep,
} from "@/lib/xml-transforms";

const GROUPS = Object.keys(TRANSFORM_GROUP_LABELS) as TransformGroup[];

export function TransformPanel({
  open,
  onOpenChange,
  fieldLabel,
  sourcePath,
  sample,
  row,
  steps,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldLabel: string;
  sourcePath: string;
  sample: string;
  row: Record<string, string>;
  steps: TransformStep[];
  onChange: (steps: TransformStep[]) => void;
}) {
  const preview = applyTransforms(sample, steps, row);

  const update = (index: number, next: TransformStep) =>
    onChange(steps.map((step, position) => (position === index ? next : step)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item as TransformStep);
    onChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{fieldLabel} — dönüştürme kuralları</SheetTitle>
          <SheetDescription>
            Kaynak alan: {sourcePath || "—"}. Kurallar yukarıdan aşağıya sırayla uygulanır.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
          <p className="text-muted-foreground">Örnek değer</p>
          <p className="break-words font-medium">{sample || "—"}</p>
          <p className="pt-1 text-muted-foreground">Sonuç</p>
          <p className="break-words font-medium">{preview || "—"}</p>
        </div>

        <div className="space-y-2">
          {steps.map((step, index) => {
            const definition = TRANSFORM_BY_KIND[step.kind];
            return (
              <div key={`${step.kind}-${index}`} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{definition?.label ?? step.kind}</p>
                  <Button size="icon" variant="ghost" aria-label="Yukarı taşı" onClick={() => move(index, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Aşağı taşı" onClick={() => move(index, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Kuralı kaldır"
                    onClick={() => onChange(steps.filter((_, position) => position !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{definition?.hint}</p>
                {definition?.fields.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {definition.fields.map((field) => {
                      const value = step.options?.[field.key];
                      const text = value === undefined || value === null ? "" : String(value);
                      const setValue = (next: string) =>
                        update(index, { kind: step.kind, options: { ...(step.options ?? {}), [field.key]: next } });
                      return (
                        <label key={field.key} className="space-y-1 text-xs">
                          <span className="text-muted-foreground">{field.label}</span>
                          {field.type === "select" ? (
                            <select
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              value={text}
                              onChange={(event) => setValue(event.target.value)}
                            >
                              {field.choices?.map((choice) => (
                                <option key={choice.value} value={choice.value}>
                                  {choice.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={field.type === "number" ? "number" : "text"}
                              value={text}
                              {...(field.placeholder ? { placeholder: field.placeholder } : {})}
                              onChange={(event) => setValue(event.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Kural ekle</p>
          {GROUPS.map((group) => (
            <div key={group} className="space-y-1">
              <p className="text-xs text-muted-foreground">{TRANSFORM_GROUP_LABELS[group]}</p>
              <div className="flex flex-wrap gap-1">
                {TRANSFORM_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => (
                  <Button
                    key={definition.kind}
                    size="sm"
                    variant="outline"
                    onClick={() => onChange([...steps, defaultTransformStep(definition.kind as TransformKind)])}
                  >
                    <Plus className="mr-1 size-3" />
                    {definition.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
