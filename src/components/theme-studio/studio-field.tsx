import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SectionField } from "@/lib/theme-sections";

export type FieldValue = string | number | boolean;

const HEX = /^#[0-9a-fA-F]{6}$/;

function isColorField(field: SectionField) {
  return field.kind === "text" && field.key.toLowerCase().includes("color");
}

function isImageField(field: SectionField) {
  const key = field.key.toLowerCase();
  return field.kind === "text" && (key.includes("image") || key.includes("logo"));
}

/** Bölüm ayar alanının tek bir kontrolü. Şema (registry) alanına göre widget seçer. */
export function StudioField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: SectionField;
  value: FieldValue;
  onChange: (next: FieldValue) => void;
}) {
  const help = field.help ? (
    <p className="text-[11px] leading-snug text-muted-foreground">{field.help}</p>
  ) : null;

  if (field.kind === "boolean") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-xs font-medium">
            {field.label}
          </Label>
          {help}
        </div>
        <Switch id={id} checked={Boolean(value)} onCheckedChange={(next) => onChange(next)} />
      </div>
    );
  }

  const label = (
    <Label htmlFor={id} className="text-xs font-medium">
      {field.label}
    </Label>
  );

  if (field.kind === "select") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {help}
      </div>
    );
  }

  if (field.kind === "number") {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const current = Number(value) || 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          {label}
          <span className="tabular-nums text-[11px] text-muted-foreground">{current}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="range"
            min={min}
            max={max}
            value={Math.min(max, Math.max(min, current))}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary"
            aria-label={field.label}
          />
          <Input
            type="number"
            min={min}
            max={max}
            value={current}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-8 w-20 text-xs"
            aria-label={`${field.label} değeri`}
          />
        </div>
        {help}
      </div>
    );
  }

  if (field.kind === "textarea" || field.kind === "lines" || field.kind === "code") {
    return (
      <div className="space-y-1.5">
        {label}
        <Textarea
          id={id}
          value={String(value ?? "")}
          rows={field.kind === "code" ? 8 : field.kind === "lines" ? 5 : 3}
          spellCheck={field.kind === "textarea"}
          onChange={(event) => onChange(event.target.value)}
          className={field.kind === "text" ? "" : field.kind === "code" ? "font-mono text-xs" : "text-sm"}
        />
        {help}
      </div>
    );
  }

  if (isColorField(field)) {
    const hex = HEX.test(String(value)) ? String(value) : "#111111";
    return (
      <div className="space-y-1.5">
        {label}
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="color"
            value={hex}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
            aria-label={field.label}
          />
          <Input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="h-9 text-xs" />
        </div>
        {help}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={id}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 text-sm"
      />
      {isImageField(field) && String(value ?? "").startsWith("http") ? (
        <img
          src={String(value)}
          alt=""
          className="h-20 w-full rounded-md border border-border object-cover"
          loading="lazy"
        />
      ) : null}
      {help}
    </div>
  );
}
