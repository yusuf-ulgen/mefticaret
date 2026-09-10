import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SECTION_CATEGORIES, THEME_SECTIONS, type SectionCategory, type ThemeSectionType } from "@/lib/theme-sections";
import { cn } from "@/lib/utils";

/** Aranabilir, kategoriye göre filtrelenen bölüm ekleme kataloğu. */
export function StudioAddSection({
  open,
  onOpenChange,
  onAdd,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: ThemeSectionType) => void;
  pending: boolean;
}) {
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<SectionCategory | "all">("all");

  const results = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    return THEME_SECTIONS.filter((definition) => {
      if (category !== "all" && definition.category !== category) return false;
      if (!needle) return true;
      return (
        definition.label.toLocaleLowerCase("tr").includes(needle) ||
        definition.description.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [category, term]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bölüm ekle</DialogTitle>
          <DialogDescription>Vitrine eklemek istediğin bölümü seç. Ayarlarını sonra düzenleyebilirsin.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Bölüm ara"
            className="pl-9"
            aria-label="Bölüm ara"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="Tümü" />
          {SECTION_CATEGORIES.map((entry) => (
            <FilterChip
              key={entry.value}
              active={category === entry.value}
              onClick={() => setCategory(entry.value)}
              label={entry.label}
            />
          ))}
        </div>

        <ScrollArea className="h-[46vh] pr-2">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aramanla eşleşen bölüm yok.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((definition) => (
                <li key={definition.type}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onAdd(definition.type)}
                    className="flex h-full w-full flex-col items-start gap-1 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/50 disabled:opacity-60"
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                      {definition.label}
                      <Plus className="size-4 shrink-0 text-muted-foreground" />
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">{definition.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn("h-7 rounded-full px-3 text-xs", !active && "text-muted-foreground")}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
