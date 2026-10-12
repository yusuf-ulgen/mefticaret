import { useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Eye, Italic, Link2, List, ListOrdered, Pencil, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Süper yönetici blog içeriği için Markdown editörü: araç çubuğu + canlı önizleme. */

type Action = { label: string; icon: typeof Bold; before: string; after?: string; block?: boolean };

const ACTIONS: Action[] = [
  { label: "Kalın", icon: Bold, before: "**", after: "**" },
  { label: "İtalik", icon: Italic, before: "*", after: "*" },
  { label: "Bağlantı", icon: Link2, before: "[", after: "](https://)" },
  { label: "Kod", icon: Code, before: "`", after: "`" },
  { label: "Alıntı", icon: Quote, before: "> ", block: true },
  { label: "Madde listesi", icon: List, before: "- ", block: true },
  { label: "Numaralı liste", icon: ListOrdered, before: "1. ", block: true },
];

const HEADINGS = ["H1", "H2", "H3"];

export function MarkdownEditor({
  value,
  onChange,
  rows = 16,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrap = (before: string, after = "", block = false) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const insert = block
      ? (selected || "Metin")
          .split("\n")
          .map((line) => `${before}${line}`)
          .join("\n")
      : `${before}${selected || "metin"}${after}`;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + insert.length);
    });
  };

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        {HEADINGS.map((heading, index) => (
          <Button
            key={heading}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs font-semibold"
            onClick={() => wrap(`${"#".repeat(index + 1)} `, "", true)}
          >
            {heading}
          </Button>
        ))}
        {ACTIONS.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={action.label}
            title={action.label}
            onClick={() => wrap(action.before, action.after ?? "", action.block ?? false)}
          >
            <action.icon className="size-4" />
          </Button>
        ))}
        <Button
          type="button"
          variant={preview ? "default" : "outline"}
          size="sm"
          className="ml-auto h-8 gap-1"
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          {preview ? "Düzenle" : "Önizle"}
        </Button>
      </div>

      {preview ? (
        <div className="markdown-body max-h-[420px] overflow-y-auto p-4 text-sm">
          {value.trim() ? (
            <Markdown remarkPlugins={[remarkGfm]}>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Önizlenecek içerik yok.</p>
          )}
        </div>
      ) : (
        <Textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Markdown ile yaz: **kalın**, *italik*, ## başlık, - liste…"
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
        />
      )}
    </div>
  );
}
