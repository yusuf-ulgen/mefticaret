/**
 * Hatalı Ürünler: son çalışmalarda aktarılamayan ürünler; seçilenleri yeniden dene / atla.
 * Hata eşiği yüzünden durdurulan beslemeler kırmızı uyarıyla gösterilir.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, RotateCcw, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { FAILURE_TYPE_LABELS } from "@/lib/xml-field-rules";
import {
  listXmlFailedItems,
  resolveXmlFailedItems,
  saveXmlFeedV2Settings,
} from "@/lib/xml-integrator-v2.functions";

export function FailedItemsPanel({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const listFn = useServerFn(listXmlFailedItems);
  const resolveFn = useServerFn(resolveXmlFailedItems);
  const settingsFn = useServerFn(saveXmlFeedV2Settings);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const key = ["xml-integrator", storeId, "failed-items"];
  const query = useQuery({ queryKey: key, queryFn: () => listFn({ data: { storeId } }) });
  const items = query.data?.items ?? [];
  const visible = useMemo(() => (filter === "all" ? items : items.filter((i) => i.errorType === filter)), [items, filter]);
  const types = [...new Set(items.map((i) => i.errorType))];

  const resolve = useMutation({
    mutationFn: (action: "retry" | "skip") => resolveFn({ data: { storeId, ids: [...selected], action } }),
    onSuccess: (result, action) => {
      toast.success(action === "retry" ? `Yeniden denendi (${result.runs} besleme çalıştı)` : "Seçilenler atlandı");
      setSelected(new Set());
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reactivate = useMutation({
    mutationFn: (feedId: string) => settingsFn({ data: { storeId, feedId, clearPause: true } }),
    onSuccess: () => {
      toast.success("Besleme yeniden etkinleştirildi");
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <CardSkeleton />;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  return (
    <section className="space-y-3">
      {(query.data?.pausedFeeds ?? []).map((feed) => (
        <div key={feed.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span className="font-medium">{feed.name}:</span>
          <span className="flex-1">{feed.reason}</span>
          <Button size="sm" variant="outline" disabled={reactivate.isPending} onClick={() => reactivate.mutate(feed.id)}>
            Yeniden etkinleştir
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">Hatalı ürünler</h2>
        <Badge variant="outline">{items.length}</Badge>
        <select
          aria-label="Hata türü filtresi"
          className="ml-auto h-8 rounded-md border bg-background px-2 text-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tüm hatalar</option>
          {types.map((t) => <option key={t} value={t}>{FAILURE_TYPE_LABELS[t] ?? t}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Bekleyen hatalı ürün yok.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => setSelected(checked ? new Set(visible.map((i) => i.id)) : new Set())}
              />
              Tümünü seç
            </label>
            <Button size="sm" disabled={!selected.size || resolve.isPending} onClick={() => resolve.mutate("retry")}>
              {resolve.isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RotateCcw className="mr-1 size-3.5" />}
              Seçilenleri yeniden dene ({selected.size})
            </Button>
            <Button size="sm" variant="outline" disabled={!selected.size || resolve.isPending} onClick={() => resolve.mutate("skip")}>
              <SkipForward className="mr-1 size-3.5" /> Seçilenleri atla
            </Button>
          </div>
          <ul className="space-y-2">
            {visible.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-xl border bg-card p-3 text-xs">
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`${item.sku ?? "Ürün"} seç`} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">SKU: {item.sku || "—"}</span>
                    <Badge variant="outline" className="border-destructive/40 text-destructive">
                      {FAILURE_TYPE_LABELS[item.errorType] ?? item.errorType}
                    </Badge>
                  </p>
                  <p>{item.message}</p>
                  {item.sample.length ? <p className="truncate text-muted-foreground">{item.sample.join(" · ")}</p> : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Yeniden dene, beslemeyi tüm ürünlerle yeniden çalıştırır; eşleştirmeyi düzelttiyseniz bu ürünler de aktarılır.
          </p>
        </>
      )}
    </section>
  );
}
