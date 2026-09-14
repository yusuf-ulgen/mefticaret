import { useEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, Strikethrough, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FieldShell } from "./field-shell";

type Command = { icon: typeof Bold; label: string; run: () => void };

/**
 * Basit zengin metin alanı: kalın/italik/altı çizili/üstü çizili, H2, H3,
 * listeler, bağlantı ve biçim temizleme. Çıktı HTML metnidir; vitrinde
 * `sanitizeHtml` ile süzülerek gösterilir.
 */
export function RichtextField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string | undefined;
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node && node.innerHTML !== value) node.innerHTML = value;
  }, [value]);

  const exec = (command: string, argument?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, argument);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const commands: Command[] = [
    { icon: Bold, label: "Kalın", run: () => exec("bold") },
    { icon: Italic, label: "İtalik", run: () => exec("italic") },
    { icon: Underline, label: "Altı çizili", run: () => exec("underline") },
    { icon: Strikethrough, label: "Üstü çizili", run: () => exec("strikeThrough") },
    { icon: List, label: "Madde listesi", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numaralı liste", run: () => exec("insertOrderedList") },
    {
      icon: Link2,
      label: "Bağlantı",
      run: () => {
        const url = window.prompt("Bağlantı adresi", "https://");
        if (url) exec("createLink", url);
      },
    },
    { icon: RemoveFormatting, label: "Biçimi temizle", run: () => exec("removeFormat") },
  ];

  return (
    <FieldShell id={id} label={label} help={help}>
      <div className="overflow-hidden rounded-md border border-input">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-[11px] font-semibold"
            onClick={() => exec("formatBlock", "<h2>")}
          >
            H2
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-[11px] font-semibold"
            onClick={() => exec("formatBlock", "<h3>")}
          >
            H3
          </Button>
          {commands.map((command) => (
            <Button
              key={command.label}
              type="button"
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={command.run}
              aria-label={command.label}
              title={command.label}
            >
              <command.icon className="size-3.5" />
            </Button>
          ))}
        </div>
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onBlur={(event) => onChange(event.currentTarget.innerHTML)}
          className="min-h-24 max-w-none px-3 py-2 text-sm outline-none [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </FieldShell>
  );
}
