import { useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { ExternalLink, ImagePlus, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadStoreLogo } from "@/lib/media";
import type { SectionField } from "@/lib/theme-sections";

export type FieldValue = string | number | boolean;

/** 20 popüler Google yazı tipi (font_picker alanı için). */
export const FONT_OPTIONS = [
  "Geist",
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Work Sans",
  "DM Sans",
  "Manrope",
  "Rubik",
  "Karla",
  "Mulish",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Source Serif 4",
  "Space Grotesk",
];

export type FieldWidget =
  | "text"
  | "textarea"
  | "richtext"
  | "image"
  | "color"
  | "range"
  | "select"
  | "switch"
  | "font"
  | "url"
  | "number"
  | "code"
  | "lines";

/**
 * Alan tanımından uygun düzenleyici tipini belirler. Kayıt defteri (registry)
 * şeması sade tutulur; burada anahtar adı ve sınırlara bakarak zengin
 * düzenleyiciler (renk, slider, görsel, font, url) seçilir.
 */
export function widgetFor(field: SectionField): FieldWidget {
  const key = field.key.toLowerCase();
  if (field.kind === "select") return "select";
  if (field.kind === "boolean") return "switch";
  if (field.kind === "code") return "code";
  if (field.kind === "lines") return "lines";
  if (field.kind === "number") {
    return typeof field.min === "number" && typeof field.max === "number" ? "range" : "number";
  }
  if (key.includes("color")) return "color";
  if (key.includes("font")) return "font";
  if (key.includes("image") || key.includes("logo") || key.includes("avatar")) return "image";
  if (key.endsWith("url")) return "url";
  if (field.kind === "textarea") return key.includes("html") ? "code" : "richtext";
  return "text";
}

export function isWideWidget(widget: FieldWidget) {
  return widget === "textarea" || widget === "richtext" || widget === "code" || widget === "lines";
}

/** Küçük WYSIWYG araç çubuğu: seçili metne basit HTML etiketleri sarar. */
function RichText({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before) => {
    const node = ref.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = value.slice(start, end) || "metin";
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
  };

  const tools: { label: string; run: () => void }[] = [
    { label: "B", run: () => wrap("<strong>", "</strong>") },
    { label: "I", run: () => wrap("<em>", "</em>") },
    { label: "U", run: () => wrap("<u>", "</u>") },
    { label: "H2", run: () => wrap("<h2>", "</h2>") },
    { label: "•", run: () => wrap("<ul><li>", "</li></ul>") },
    { label: "1.", run: () => wrap("<ol><li>", "</li></ol>") },
    { label: "🔗", run: () => wrap('<a href="#">', "</a>") },
  ];

  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap gap-1 border-b border-border p-1">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.run}
            className="rounded px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tool.label}
          </button>
        ))}
      </div>
      <Textarea
        id={id}
        ref={ref}
        value={value}
        rows={4}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-none border-0 focus-visible:ring-0"
      />
    </div>
  );
}

function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#111111";
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Renk seç"
            className="size-9 shrink-0 rounded-md border border-border"
            style={{ background: hex }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3">
          <HexColorPicker color={hex} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" />
    </div>
  );
}

function ImageField({
  storeId,
  value,
  onChange,
}: {
  storeId: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      {value ? (
        <img
          src={value}
          alt="Seçili görsel önizlemesi"
          className="h-24 w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="grid h-24 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          Görsel seçilmedi
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="https://…"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label="Görsel yükle"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await uploadStoreLogo(storeId, file));
            toast.success("Görsel yüklendi");
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Tek bir bileşen ayarını uygun düzenleyiciyle gösterir. */
export function SettingField({
  storeId,
  id,
  field,
  value,
  onChange,
}: {
  storeId: string;
  id: string;
  field: SectionField;
  value: FieldValue;
  onChange: (next: FieldValue) => void;
}) {
  const widget = widgetFor(field);
  const text = String(value ?? "");
  const num = Number(value ?? 0);

  const control = (() => {
    switch (widget) {
      case "switch":
        return (
          <Switch id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
        );
      case "select":
        return (
          <Select value={text} onValueChange={onChange}>
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "font":
        return (
          <Select value={text || FONT_OPTIONS[0]!} onValueChange={onChange}>
            <SelectTrigger id={id} style={{ fontFamily: text || undefined }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {FONT_OPTIONS.map((font) => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "color":
        return <ColorField value={text} onChange={onChange} />;
      case "image":
        return <ImageField storeId={storeId} value={text} onChange={onChange} />;
      case "range":
        return (
          <div className="space-y-1">
            <Slider
              id={id}
              value={[num]}
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={1}
              onValueChange={([next]) => onChange(next ?? num)}
            />
            <p className="text-right text-xs text-muted-foreground">{num}</p>
          </div>
        );
      case "number":
        return (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Azalt"
              onClick={() => onChange(num - 1)}
            >
              <Minus className="size-4" />
            </Button>
            <Input
              id={id}
              type="number"
              value={num}
              onChange={(event) => onChange(Number(event.target.value))}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Artır"
              onClick={() => onChange(num + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        );
      case "url":
        return (
          <div className="flex items-center gap-2">
            <Input
              id={id}
              value={text}
              placeholder={field.placeholder ?? "/s/magazam/products"}
              onChange={(event) => onChange(event.target.value)}
            />
            {text ? (
              <a
                href={text}
                target="_blank"
                rel="noreferrer"
                aria-label="Bağlantıyı yeni sekmede aç"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
        );
      case "richtext":
        return <RichText id={id} value={text} onChange={onChange} />;
      case "code":
      case "lines":
        return (
          <Textarea
            id={id}
            value={text}
            rows={6}
            className="font-mono text-xs"
            onChange={(event) => onChange(event.target.value)}
          />
        );
      default:
        return (
          <Input
            id={id}
            value={text}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        );
    }
  })();

  return (
    <div className={isWideWidget(widget) ? "grid gap-2" : "grid gap-2"}>
      <Label htmlFor={id} className="text-xs font-medium">
        {field.label}
      </Label>
      {control}
      {field.help ? <p className="text-[11px] text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
