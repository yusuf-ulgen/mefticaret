import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { FieldShell } from "./field-shell";
import { useStudioFieldContext } from "./studio-context";

type PickerEntry = { id: string; title: string; handle?: string | null };

function PickerBody({
  entries,
  selected,
  multiple,
  onToggle,
}: {
  entries: PickerEntry[];
  selected: string[];
  multiple: boolean;
  onToggle: (handle: string) => void;
}) {
  const [term, setTerm] = useState("");
  const filtered = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    if (!needle) return entries.slice(0, 80);
    return entries
      .filter((entry) => entry.title.toLocaleLowerCase("tr").includes(needle))
      .slice(0, 80);
  }, [entries, term]);

  return (
    <div className="space-y-2">
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Ara"
        className="h-8 text-xs"
        aria-label="Ara"
      />
      <ScrollArea className="h-56">
        <div className="space-y-0.5 pr-2">
          {filtered.length === 0 ? (
            <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">Kayıt bulunamadı.</p>
          ) : null}
          {filtered.map((entry) => {
            const key = entry.handle || entry.id;
            const active = selected.includes(key);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onToggle(key)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <span className="min-w-0 truncate">{entry.title}</span>
                {active ? <Check className="size-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </ScrollArea>
      {multiple ? (
        <p className="text-[11px] text-muted-foreground">Birden fazla kayıt seçebilirsin.</p>
      ) : null}
    </div>
  );
}

function PickerField({
  id,
  label,
  help,
  value,
  entries,
  multiple,
  onChange,
}: {
  id: string;
  label: string;
  help?: string | undefined;
  value: string;
  entries: PickerEntry[];
  multiple: boolean;
  onChange: (next: string) => void;
}) {
  const selected = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const toggle = (handle: string) => {
    if (!multiple) {
      onChange(selected[0] === handle ? "" : handle);
      return;
    }
    const next = selected.includes(handle)
      ? selected.filter((entry) => entry !== handle)
      : [...selected, handle];
    onChange(next.join(","));
  };

  const summary = selected.length === 0 ? "Seç" : selected.length === 1 ? selected[0] : `${selected.length} kayıt`;

  return (
    <FieldShell id={id} label={label} help={help}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            variant="outline"
            className="h-9 w-full justify-between text-xs font-normal"
          >
            <span className="min-w-0 truncate">{summary}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px]" align="start">
          <PickerBody entries={entries} selected={selected} multiple={multiple} onToggle={toggle} />
        </PopoverContent>
      </Popover>
    </FieldShell>
  );
}

/** Mağazadaki gerçek ürünlerden seçim. */
export function ProductPickerField(props: {
  id: string;
  label: string;
  help?: string | undefined;
  value: string;
  multiple?: boolean;
  onChange: (next: string) => void;
}) {
  const context = useStudioFieldContext();
  const entries = (context?.products ?? []).map((product) => ({
    id: product.id,
    title: product.title,
    handle: product.slug,
  }));
  return <PickerField {...props} entries={entries} multiple={props.multiple ?? false} />;
}

/** Mağazadaki gerçek koleksiyonlardan seçim. */
export function CollectionPickerField(props: {
  id: string;
  label: string;
  help?: string | undefined;
  value: string;
  multiple?: boolean;
  onChange: (next: string) => void;
}) {
  const context = useStudioFieldContext();
  const entries = (context?.collections ?? []).map((collection) => ({
    id: collection.id,
    title: collection.title,
    handle: collection.slug,
  }));
  return <PickerField {...props} entries={entries} multiple={props.multiple ?? false} />;
}
