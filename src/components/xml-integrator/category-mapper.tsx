/**
 * Kategori eşleştirme tablosu: kaynak (tedarikçi/pazaryeri) kategorileri ile
 * mağaza kategorileri karşılıklı olarak eşleştirilir.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { xmlCategoryMappingsQuery } from "@/lib/xml-integrator-queries";
import {
  aiSuggestXmlCategoryMappings,
  saveXmlCategoryMapping,
  scanXmlSourceCategories,
} from "@/lib/xml-integrator.functions";

export function XmlCategoryMapper({ storeId, feedId }: { storeId: string; feedId: string }) {
  const client = useQueryClient();
  const query = useQuery(xmlCategoryMappingsQuery(storeId, feedId));
  const scan = useServerFn(scanXmlSourceCategories);
  const saveOne = useServerFn(saveXmlCategoryMapping);
  const aiSuggest = useServerFn(aiSuggestXmlCategoryMappings);
  const [search, setSearch] = useState("");

  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["xml-integrator", storeId, "categories", feedId] });

  const scanMutation = useMutation({
    mutationFn: () => scan({ data: { storeId, feedId } }),
    onSuccess: (result) => {
      toast.success(`${result.found} kaynak kategorisi bulundu (${result.rows} satır tarandı)`);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aiMutation = useMutation({
    mutationFn: () => aiSuggest({ data: { storeId, feedId, onlyUnmapped: true } }),
    onSuccess: (result) => {
      toast.success(
        `Yapay zekâ ${result.suggested} kategoriyi eşleştirdi (${result.highConfidence} tanesi %90+ güven)` +
          (result.creditsUsed ? ` · ${result.creditsUsed} kredi` : ""),
      );
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: (input: { sourceCategory: string; targetCategoryId: string | null }) =>
      saveOne({
        data: {
          storeId,
          feedId,
          sourceCategory: input.sourceCategory,
          targetCategoryId: input.targetCategoryId,
          targetCategoryCode: null,
        },
      }),
    onSuccess: () => {
      toast.success("Kategori eşleşmesi kaydedildi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const list = query.data?.mappings ?? [];
    return term ? list.filter((row) => row.sourceCategory.toLocaleLowerCase("tr").includes(term)) : list;
  }, [query.data, search]);

  if (query.isLoading) return <CardSkeleton />;

  const categories = query.data?.categories ?? [];
  const matched = (query.data?.mappings ?? []).filter((row) => row.targetCategoryId).length;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Kategori eşleme</h3>
        <Badge variant="outline">{query.data?.mappings.length ?? 0} kaynak kategorisi</Badge>
        <Badge variant="secondary">{matched} eşleşti</Badge>
        <Button
          className="ml-auto"
          size="sm"
          variant="outline"
          disabled={scanMutation.isPending}
          onClick={() => scanMutation.mutate()}
        >
          {scanMutation.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-4" />
          )}
          Kaynak kategorilerini tara
        </Button>
        <Button
          size="sm"
          disabled={aiMutation.isPending || !query.data?.mappings.length || !categories.length}
          onClick={() => aiMutation.mutate()}
        >
          {aiMutation.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-4" />
          )}
          Yapay zekâ ile eşleştir
        </Button>
      </header>

      {!query.data?.mappings.length ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Henüz kategori taranmadı. Önce kategori (veya kategori yolu) alanını eşleştirin, sonra
          “Kaynak kategorilerini tara” düğmesine basın.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Kaynak kategorisi ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <ul className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm">{row.sourceCategory}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.productCount} ürün
                    {row.isAiSuggested ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1 inline-flex cursor-help items-center gap-1 text-primary">
                            <Sparkles className="size-3" />%{Math.round(row.aiConfidence * 100)} güven
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                          {row.aiReasoning || "Yapay zekâ önerisi — gerekçe belirtilmedi."}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </p>
                </div>
                <select
                  aria-label={`${row.sourceCategory} hedef kategorisi`}
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={row.targetCategoryId ?? ""}
                  disabled={saveMutation.isPending}
                  onChange={(event) =>
                    saveMutation.mutate({
                      sourceCategory: row.sourceCategory,
                      targetCategoryId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Eşleşme yok</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.path ?? category.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {!categories.length ? (
            <p className="text-xs text-muted-foreground">
              Mağazanızda henüz kategori yok; önce Kategoriler bölümünden kategori oluşturun.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
