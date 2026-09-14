import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { deleteThemeVersion, restoreThemeVersion } from "@/lib/theme-versions.functions";
import { themeVersionsQuery } from "@/lib/theme-versions-queries";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });

/** Tema sürüm geçmişi: yayınlanan sürümleri geri yükle veya sil. */
export function StudioVersions({ storeId, onRestored }: { storeId: string; onRestored: () => void }) {
  const queryClient = useQueryClient();
  const versions = useQuery(themeVersionsQuery(storeId));
  const restoreFn = useServerFn(restoreThemeVersion);
  const deleteFn = useServerFn(deleteThemeVersion);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["theme-versions", storeId] });
  };

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreFn({ data: { storeId, versionId } }),
    onSuccess: async () => {
      await invalidate();
      onRestored();
      toast.success("Sürüm geri yüklendi.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (versionId: string) => deleteFn({ data: { storeId, versionId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sürüm silindi.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = versions.data ?? [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Sürüm geçmişi">
          <History className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Sürüm geçmişi</SheetTitle>
          <SheetDescription>
            Her yayınlamada bir sürüm kaydedilir. Geri yükleme, mevcut tasarımın üzerine yazar.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-160px)] pr-3">
          {versions.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground" aria-busy="true">
              Yükleniyor…
            </p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Henüz sürüm yok. “Yayınla” dediğinde ilk sürüm oluşur.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((version) => (
                <li key={version.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {version.label}
                        {version.is_published ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Yayında
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(version.created_at)} · {version.sectionCount} bölüm
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        aria-label="Bu sürümü geri yükle"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(version.id)}
                      >
                        {restore.isPending && restore.variables === version.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="Sürümü sil"
                        disabled={version.is_published || remove.isPending}
                        onClick={() => remove.mutate(version.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
