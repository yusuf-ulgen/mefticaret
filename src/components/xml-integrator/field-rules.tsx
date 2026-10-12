/**
 * XML Entegratör v2 — alan ayarları penceresi (⚙️) ve eşleştirme şablonları çubuğu.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CONDITION_LABELS,
  CONDITION_OPERATORS,
  testFormula,
  type ConditionOperator,
  type FieldRule,
  type FieldRules,
} from "@/lib/xml-field-rules";
import {
  applyXmlMappingTemplate,
  deleteXmlMappingTemplate,
  listXmlMappingTemplates,
  saveXmlMappingTemplate,
} from "@/lib/xml-integrator-v2.functions";

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

export function describeRule(rule: FieldRule | undefined): string {
  if (!rule) return "";
  const parts: string[] = [];
  if (rule.fallback) parts.push(`yedek: ${rule.fallback}`);
  if (rule.formula) parts.push(`formül: ${rule.formula}`);
  if (rule.condition) parts.push(`koşul: ${rule.condition.field} ${CONDITION_LABELS[rule.condition.operator]} ${rule.condition.value ?? ""}`.trim());
  if (rule.defaultValue) parts.push(`varsayılan: ${rule.defaultValue}`);
  if (rule.required) parts.push("zorunlu");
  return parts.join(" · ");
}

export function FieldRuleDialog({
  open,
  onOpenChange,
  fieldLabel,
  sourcePath,
  columns,
  sampleRow,
  rule,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldLabel: string;
  sourcePath: string;
  columns: string[];
  sampleRow: Record<string, string>;
  rule: FieldRule | undefined;
  onSave: (rule: FieldRule | null) => void;
}) {
  const [draft, setDraft] = useState<FieldRule>(rule ?? {});
  const [useCondition, setUseCondition] = useState(Boolean(rule?.condition));
  const [testValue, setTestValue] = useState(sampleRow[sourcePath] ?? "");

  useEffect(() => {
    if (open) {
      setDraft(rule ?? {});
      setUseCondition(Boolean(rule?.condition));
      setTestValue(sampleRow[sourcePath] ?? "");
    }
  }, [open, rule, sampleRow, sourcePath]);

  const set = (patch: Partial<FieldRule>) => setDraft((current) => ({ ...current, ...patch }));
  const test = draft.formula ? testFormula(draft.formula, testValue, sampleRow) : null;

  const submit = () => {
    const next: FieldRule = { ...draft };
    if (!useCondition) delete next.condition;
    for (const key of ["fallback", "formula", "defaultValue", "notes"] as const) if (!next[key]) delete next[key];
    if (!next.required) delete next.required;
    onSave(Object.keys(next).length ? next : null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Alan ayarları — {fieldLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kaynak alan</Label>
              <Input value={sourcePath || "—"} readOnly />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rule-fallback">Yedek alan</Label>
              <select id="rule-fallback" className={selectClass} value={draft.fallback ?? ""} onChange={(e) => set({ fallback: e.target.value })}>
                <option value="">Yok</option>
                {columns.map((column) => <option key={column} value={column}>{column}</option>)}
              </select>
              <p className="text-[11px] text-muted-foreground">Kaynak boşsa bu alana bakılır.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label htmlFor="rule-formula">Formül</Label>
            <Input id="rule-formula" placeholder="ör. value * 1.20 + 5" value={draft.formula ?? ""} onChange={(e) => set({ formula: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-32" aria-label="Test değeri" value={testValue} onChange={(e) => setTestValue(e.target.value)} />
              {test ? (
                <Badge variant={test.ok ? "secondary" : "destructive"}>{test.ok ? `Sonuç: ${test.result}` : test.result}</Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground">Formül yazınca sonuç anında görünür.</span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label>Koşul (isteğe bağlı)</Label>
              <Switch checked={useCondition} onCheckedChange={(checked) => {
                setUseCondition(checked);
                if (checked && !draft.condition) set({ condition: { field: columns[0] ?? "", operator: "greater", value: "0" } });
              }} />
            </div>
            {useCondition && draft.condition ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <select aria-label="Koşul alanı" className={selectClass} value={draft.condition.field} onChange={(e) => set({ condition: { ...draft.condition!, field: e.target.value } })}>
                  {columns.map((column) => <option key={column} value={column}>{column}</option>)}
                </select>
                <select aria-label="Koşul işlemi" className={selectClass} value={draft.condition.operator} onChange={(e) => set({ condition: { ...draft.condition!, operator: e.target.value as ConditionOperator } })}>
                  {CONDITION_OPERATORS.map((op) => <option key={op} value={op}>{CONDITION_LABELS[op]}</option>)}
                </select>
                {draft.condition.operator === "empty" || draft.condition.operator === "not_empty" ? null : (
                  <Input aria-label="Koşul değeri" value={draft.condition.value ?? ""} onChange={(e) => set({ condition: { ...draft.condition!, value: e.target.value } })} />
                )}
                <p className="text-[11px] text-muted-foreground sm:col-span-3">Koşul sağlanmazsa formül uygulanmaz, varsayılan değer yazılır.</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rule-default">Varsayılan değer</Label>
              <Input id="rule-default" value={draft.defaultValue ?? ""} onChange={(e) => set({ defaultValue: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="rule-required">Zorunlu alan</Label>
              <Switch id="rule-required" checked={draft.required === true} onCheckedChange={(checked) => set({ required: checked })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-notes">Notlar</Label>
            <Textarea id="rule-notes" rows={2} maxLength={500} value={draft.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button onClick={submit}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MappingTemplatesBar({
  storeId,
  mapping,
  rules,
  onApply,
  onReset,
}: {
  storeId: string;
  mapping: Record<string, string>;
  rules: FieldRules;
  onApply: (mapping: Record<string, string>, rules: FieldRules) => void;
  onReset: () => void;
}) {
  const client = useQueryClient();
  const list = useServerFn(listXmlMappingTemplates);
  const saveFn = useServerFn(saveXmlMappingTemplate);
  const deleteFn = useServerFn(deleteXmlMappingTemplate);
  const applyFn = useServerFn(applyXmlMappingTemplate);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const templates = useQuery({
    queryKey: ["xml-integrator", storeId, "templates"],
    queryFn: () => list({ data: { storeId } }),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["xml-integrator", storeId, "templates"] });

  const apply = useMutation({
    mutationFn: (templateId: string) => applyFn({ data: { storeId, templateId } }),
    onSuccess: (result) => {
      onApply(result.fieldMapping, result.fieldRules);
      toast.success("Şablon uygulandı — kaydetmeyi unutmayın");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () => saveFn({ data: { storeId, name, fieldMapping: mapping, fieldRules: rules as never } }),
    onSuccess: () => {
      toast.success("Şablon kaydedildi");
      setSaveOpen(false);
      setName("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (templateId: string) => deleteFn({ data: { storeId, templateId } }),
    onSuccess: () => { toast.success("Şablon silindi"); void refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = templates.data ?? [];
  const platform = rows.filter((row) => row.isPublic);
  const own = rows.filter((row) => !row.isPublic);

  return (
    <div className="flex flex-wrap gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={apply.isPending}>
            {apply.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Şablon uygula
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Platform şablonları</DropdownMenuLabel>
          {platform.map((row) => (
            <DropdownMenuItem key={row.id} onSelect={() => apply.mutate(row.id)} className="flex-col items-start">
              <span>{row.name}</span>
              <span className="text-[11px] text-muted-foreground">{row.fieldCount} alan{row.description ? ` · ${row.description}` : ""}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Kendi şablonlarım</DropdownMenuLabel>
          {own.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Henüz şablon yok</p> : null}
          {own.map((row) => (
            <div key={row.id} className="flex items-center gap-1 px-1">
              <DropdownMenuItem className="flex-1 flex-col items-start" onSelect={() => apply.mutate(row.id)}>
                <span>{row.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {row.fieldCount} alan · {new Date(row.createdAt).toLocaleDateString("tr-TR")} · {row.usageCount} kez kullanıldı
                </span>
              </DropdownMenuItem>
              <Button size="icon" variant="ghost" aria-label={`${row.name} şablonunu sil`} onClick={() => remove.mutate(row.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)} disabled={!Object.keys(mapping).length}>
        <Save className="mr-1 size-4" /> Şablon kaydet
      </Button>
      <Button size="sm" variant="ghost" onClick={onReset}>Tümünü sıfırla</Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Eşleştirmeyi şablon olarak kaydet</DialogTitle></DialogHeader>
          <Input placeholder="ör. ABC Tedarikçi Ayarları" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <DialogFooter>
            <Button disabled={name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Şablonu kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
