import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SECTION_CATEGORIES,
  THEME_SECTIONS,
  type ThemeSectionType,
} from "@/lib/theme-sections";

/** "Bölüm ekle" modalı: arama + kategori sekmeleri + kart ızgarası. */
export function AddSectionDialog({
  open,
  onOpenChange,
  usedTypes,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usedTypes: string[];
  onAdd: (type: ThemeSectionType) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return THEME_SECTIONS.filter((section) => {
      if (category !== "all" && section.category !== category) return false;
      if (!q) return true;
      return (
        section.label.toLocaleLowerCase("tr").includes(q) ||
        section.description.toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [query, category]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bölüm ekle</DialogTitle>
          <DialogDescription>
            Vitrin sayfana yeni bir bölüm ekle. Eklenen bölüm listenin sonuna gelir, sürükleyerek
            taşıyabilirsin.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bölüm ara…"
            className="pl-9"
          />
        </div>

        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="all">Tümü</TabsTrigger>
            {SECTION_CATEGORIES.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[380px] pr-3">
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aramanla eşleşen bölüm yok.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((section) => {
                const blocked = !section.repeatable && usedTypes.includes(section.type);
                return (
                  <div
                    key={section.type}
                    className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border p-3 transition hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{section.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={blocked ? "ghost" : "secondary"}
                      disabled={blocked}
                      onClick={() => onAdd(section.type)}
                    >
                      <Plus className="mr-1 size-3.5" />
                      {blocked ? "Ekli" : "Ekle"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
