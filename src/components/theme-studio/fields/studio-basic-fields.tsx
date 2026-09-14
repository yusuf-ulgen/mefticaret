import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { FieldShell } from "./field-shell";
import { useDebouncedField } from "./use-debounced-value";

export type FieldOption = { value: string; label: string };

/** Tek satır metin. */
export function TextField({
  id,
  label,
  help,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (next: string) => void;
}) {
  const [local, setLocal] = useDebouncedField(value, onChange);
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      aside={
        maxLength ? (
          <span className="tabular-nums text-[11px] text-muted-foreground">
            {local.length}/{maxLength}
          </span>
        ) : null
      }
    >
      <Input
        id={id}
        value={local}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => setLocal(event.target.value)}
        className="h-9 text-sm"
      />
    </FieldShell>
  );
}

/** Çok satırlı metin. */
export function TextareaField({
  id,
  label,
  help,
  value,
  rows = 3,
  mono = false,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  rows?: number;
  mono?: boolean;
  onChange: (next: string) => void;
}) {
  const [local, setLocal] = useDebouncedField(value, onChange);
  return (
    <FieldShell id={id} label={label} help={help}>
      <Textarea
        id={id}
        value={local}
        rows={rows}
        onChange={(event) => setLocal(event.target.value)}
        className={mono ? "font-mono text-xs" : "text-sm"}
      />
    </FieldShell>
  );
}

/** Artır/azalt düğmeli sayı. */
export function NumberField({
  id,
  label,
  help,
  value,
  min = 0,
  max = 999,
  step = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <FieldShell id={id} label={label} help={help}>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`${label} azalt`}
        >
          <Minus className="size-3.5" />
        </Button>
        <Input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className="h-8 text-center text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`${label} artır`}
        >
          <Plus className="size-3.5" />
        </Button>
        {unit ? <span className="shrink-0 text-[11px] text-muted-foreground">{unit}</span> : null}
      </div>
    </FieldShell>
  );
}

/** Kaydırıcı + sayı kutusu. */
export function RangeField({
  id,
  label,
  help,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  const current = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      aside={
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {current}
          {unit ?? ""}
        </span>
      }
    >
      <div className="flex items-center gap-2">
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={[current]}
          onValueChange={([next]) => onChange(next ?? min)}
          className="flex-1"
          aria-label={label}
        />
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))}
          className="h-8 w-[68px] text-xs"
          aria-label={`${label} değeri`}
        />
      </div>
    </FieldShell>
  );
}

/** Tek seçim açılır liste. */
export function SelectField({
  id,
  label,
  help,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  options: FieldOption[];
  onChange: (next: string) => void;
}) {
  return (
    <FieldShell id={id} label={label} help={help}>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 text-sm">
          <SelectValue placeholder="Seç" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-sm">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

/** Çoklu seçim: virgülle ayrılmış değer olarak saklanır. */
export function MultiSelectField({
  id,
  label,
  help,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  options: FieldOption[];
  onChange: (next: string) => void;
}) {
  const selected = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((entry) => entry !== option)
      : [...selected, option];
    onChange(next.join(","));
  };

  return (
    <FieldShell label={label} help={help} id={id}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </FieldShell>
  );
}

/** Kart görünümlü radyo seçim. */
export function RadioField({
  id,
  label,
  help,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  options: FieldOption[];
  onChange: (next: string) => void;
}) {
  return (
    <FieldShell label={label} help={help}>
      <RadioGroup value={value} onValueChange={onChange} className="gap-1.5">
        {options.map((option) => (
          <Label
            key={option.value}
            htmlFor={`${id}-${option.value}`}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition",
              value === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
            )}
          >
            <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
    </FieldShell>
  );
}

/** Aç/kapa anahtarı. */
export function SwitchField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {help ? <p className="text-[11px] leading-snug text-muted-foreground">{help}</p> : null}
      </div>
      <Switch id={id} checked={value} onCheckedChange={onChange} />
    </div>
  );
}

const URL_OK = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

/** Bağlantı adresi + doğrulama. */
export function UrlField({
  id,
  label,
  help,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const [local, setLocal] = useDebouncedField(value, onChange);
  const invalid = local.trim().length > 0 && !URL_OK.test(local.trim());
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      error={invalid ? "Adres https:// ile ya da / ile başlamalı." : null}
    >
      <Input
        id={id}
        value={local}
        inputMode="url"
        placeholder={placeholder ?? "https://"}
        onChange={(event) => setLocal(event.target.value)}
        className="h-9 text-sm"
      />
    </FieldShell>
  );
}

/** Ayar panelinde başlık ayırıcısı. */
export function HeadingField({ label }: { label: string }) {
  return <h4 className="pt-1 text-xs font-semibold text-foreground">{label}</h4>;
}

/** Ayar panelinde açıklama metni. */
export function ParagraphField({ text }: { text: string }) {
  return <p className="text-[13px] leading-snug text-muted-foreground">{text}</p>;
}
