import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { previewCatalogImport } from "@/lib/supplier-catalog.functions";
import { formatMoney } from "@/lib/mefti";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CatalogImportPreview({
  storeId,
  ids,
  markup,
  busy,
  onClose,
  onConfirm,
}: {
  storeId: string;
  ids: string[] | null;
  markup: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const preview = useServerFn(previewCatalogImport);
  const query = useQuery({
    queryKey: ["catalog-import-preview", storeId, ids, markup],
    enabled: Boolean(ids?.length),
    queryFn: () => preview({ data: { storeId, ids: ids!, markup } }),
    staleTime: 0,
  });
  return (
    <Dialog
      open={Boolean(ids)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aktarım önizlemesi</DialogTitle>
          <DialogDescription>
            Ürün, kategori ve varyant eşlemelerini kontrol edin. Mevcut aktarım tekrar oluşturulmaz.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">Önizleme hazırlanıyor…</p>
        ) : query.error ? (
          <div role="alert">
            <p>{query.error.message}</p>
            <Button onClick={() => void query.refetch()}>Tekrar dene</Button>
          </div>
        ) : query.data ? (
          <>
            <p className="text-sm">
              {query.data.newCount} yeni · {query.data.existingCount} zaten aktarılmış ·{" "}
              {query.data.unavailableCount} kullanılamıyor
            </p>
            {query.data.quota ? (
              <p className="text-sm">
                Kalan aktarım hakkı: {Math.max(0, query.data.quota.limit - query.data.quota.used)}
              </p>
            ) : null}
            <ul className="divide-y">
              {query.data.items.map((row) => (
                <li key={row.id} className="space-y-1 py-3 text-sm">
                  <p className="font-medium">
                    {row.title} · {row.sku ?? "SKU yok"}
                  </p>
                  <p>
                    {row.existing ? "Zaten aktarılmış; atlanacak" : "Yeni ürün"} ·{" "}
                    {formatMoney(row.price, row.currency)} · {row.variants} varyant
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.sourceCategory ?? "Kategorisiz"} → {row.targetCategory ?? "Kategori yok"}
                  </p>
                  {row.warning ? <p className="text-xs text-destructive">{row.warning}</p> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-background pt-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            disabled={busy || !query.data?.newCount || query.isFetching || Boolean(query.error)}
            onClick={() => {
              if (ids) onConfirm(ids);
            }}
          >
            {busy ? "Aktarılıyor…" : "Onayla ve aktar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
