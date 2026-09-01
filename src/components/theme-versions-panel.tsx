import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Rocket, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/mefti";
import { themeVersionsQuery } from "@/lib/theme-versions-queries";
import {
  deleteThemeVersion,
  publishThemeVersion,
  restoreThemeVersion,
} from "@/lib/theme-versions.functions";

/**
 * Tema sürümleri: her yayınlama anında tema ayarları ve bileşen düzeni
 * anlık görüntü olarak saklanır, istenildiğinde geri yüklenebilir.
 */
export function ThemeVersionsPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useQuery(themeVersionsQuery(storeId));
  const [label, setLabel] = useState("");

  const publish = useServerFn(publishThemeVersion);
  const restore = useServerFn(restoreThemeVersion);
  const drop = useServerFn(deleteThemeVersion);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["theme-versions", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["theme-sections", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["store-theme", storeId] }),
    ]);
  };

  const publishMutation = useMutation({
    mutationFn: () => publish({ data: { storeId, ...(label.trim() ? { label: label.trim() } : {}) } }),
    onSuccess: async () => {
      setLabel("");
      await refresh();
      toast.success("Tema yayınlandı ve sürüm olarak kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restore({ data: { storeId, versionId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Sürüm geri yüklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => drop({ data: { storeId, versionId } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Sürüm silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Tema sürümleri
        </CardTitle>
        <CardDescription>
          Yayınladığın her düzen sürüm olarak saklanır. Taslakta denemeler yapıp dilediğin an eski
          yayına geri dönebilirsin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="version-label">Sürüm notu (opsiyonel)</Label>
            <Input
              id="version-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Örn. Yaz kampanyası düzeni"
              className="w-[280px]"
              maxLength={120}
            />
          </div>
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            <Rocket className="mr-2 size-4" /> Yayınla ve sürüm oluştur
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Sürümler yükleniyor…</p>
        ) : (versions ?? []).length === 0 ? (
          <EmptyState
            icon={History}
            title="Henüz yayınlanmış sürüm yok"
            description="Düzenini tamamladığında “Yayınla ve sürüm oluştur” ile ilk yayın sürümünü kaydet."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(versions ?? []).map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {version.label}
                    {version.is_published ? <Badge>Yayında</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(version.created_at)} · {version.sectionCount} bileşen
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ConfirmDialog
                    title="Bu sürüme dönülsün mü?"
                    description="Mevcut tema ayarları ve bileşen düzeni bu sürümdeki haliyle değiştirilecek."
                    confirmLabel="Geri yükle"
                    onConfirm={() => restoreMutation.mutate(version.id)}
                    trigger={
                      <Button variant="outline" size="sm" disabled={restoreMutation.isPending}>
                        <RotateCcw className="mr-2 size-4" /> Geri yükle
                      </Button>
                    }
                  />
                  <ConfirmDialog
                    title="Sürüm silinsin mi?"
                    description="Bu anlık görüntü kalıcı olarak silinir."
                    confirmLabel="Sil"
                    onConfirm={() => deleteMutation.mutate(version.id)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={version.is_published || deleteMutation.isPending}
                        aria-label="Sürümü sil"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
