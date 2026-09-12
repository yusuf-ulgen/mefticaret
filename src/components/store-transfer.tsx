import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTransferableStores,
  previewStoreTransfer,
  runStoreTransfer,
} from "@/lib/migration.functions";

/**
 * Mefticaret mağazasından mağazaya aktarım paneli: mevcut gerçek veriler
 * (ürün, sipariş, müşteri, içerik, tema) seçilen hedef mağazaya kopyalanır.
 */

type TransferEntity = "category" | "product" | "customer" | "order" | "page" | "theme";

const ENTITIES: { key: TransferEntity; label: string }[] = [
  { key: "category", label: "Kategoriler" },
  { key: "product", label: "Ürünler (varyant, görsel, stok)" },
  { key: "customer", label: "Müşteriler ve adresleri" },
  { key: "order", label: "Siparişler ve kalemleri" },
  { key: "page", label: "İçerik sayfaları ve blog" },
  { key: "theme", label: "Tema ve vitrin bölümleri" },
];

const numberFmt = new Intl.NumberFormat("tr-TR");

type Report = Awaited<ReturnType<typeof previewStoreTransfer>>;

export function StoreTransfer({ storeId }: { storeId: string }) {
  const { data: stores = [] } = useQuery({
    queryKey: ["migration", "transferable-stores"],
    queryFn: () => listTransferableStores(),
  });

  const [targetStoreId, setTargetStoreId] = useState("");
  const [scope, setScope] = useState<TransferEntity[]>(ENTITIES.map((item) => item.key));
  const [report, setReport] = useState<Report | null>(null);

  const others = stores.filter((store) => store.id !== storeId);

  const preview = useMutation({
    mutationFn: () =>
      previewStoreTransfer({ data: { sourceStoreId: storeId, targetStoreId, scope } }),
    onSuccess: (result) => {
      setReport(result);
      toast.success("Kuru çalışma tamamlandı — hiçbir veri yazılmadı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const run = useMutation({
    mutationFn: () => runStoreTransfer({ data: { sourceStoreId: storeId, targetStoreId, scope } }),
    onSuccess: (result) => {
      setReport(result);
      toast.success("Aktarım tamamlandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bu mağazadan yeni mağazaya aktar</CardTitle>
        <CardDescription>
          Bu mağazadaki gerçek verileri (ürünler, siparişler, müşteriler, içerik ve tema) seçtiğin
          mağazaya kopyalar. Bu mağazadaki hiçbir kayıt değişmez, aynı kayıt ikinci kez kopyalanmaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Hedef mağaza</Label>
          <Select value={targetStoreId} onValueChange={setTargetStoreId}>
            <SelectTrigger>
              <SelectValue placeholder={others.length ? "Mağaza seç" : "Başka mağaza yok"} />
            </SelectTrigger>
            <SelectContent>
              {others.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Aktarılacak veriler</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ENTITIES.map((entity) => (
              <label key={entity.key} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                <Checkbox
                  checked={scope.includes(entity.key)}
                  onCheckedChange={(checked) =>
                    setScope((prev) =>
                      checked
                        ? [...new Set([...prev, entity.key])]
                        : prev.filter((item) => item !== entity.key),
                    )
                  }
                />
                <span>{entity.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!targetStoreId || scope.length === 0 || preview.isPending}
            onClick={() => preview.mutate()}
          >
            Kuru çalışma (önizleme)
          </Button>
          <Button
            disabled={!targetStoreId || scope.length === 0 || run.isPending}
            onClick={() => run.mutate()}
          >
            Aktarımı başlat
          </Button>
        </div>

        {report ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {report.dryRun
                ? "Önizleme: aşağıdaki kayıtlar aktarılacak, henüz yazılmadı."
                : "Aktarım raporu:"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ENTITIES.filter((entity) => report.totals[entity.key]).map((entity) => {
                const stats = report.totals[entity.key]!;
                return (
                  <div key={entity.key} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{entity.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {report.dryRun
                        ? `${numberFmt.format(stats.copied)} kayıt aktarılacak`
                        : `${numberFmt.format(stats.copied)} aktarıldı · ${numberFmt.format(stats.skipped)} zaten vardı · ${numberFmt.format(stats.failed)} hata`}
                    </p>
                  </div>
                );
              })}
            </div>
            {report.errors.length > 0 ? (
              <ul className="space-y-1 text-sm text-destructive">
                {report.errors.slice(0, 10).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
