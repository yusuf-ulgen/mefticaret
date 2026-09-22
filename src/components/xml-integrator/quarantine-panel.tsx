/**
 * İncelemeye alınan (karantina) ürünler: onaylama, reddetme ve toplu işlemler.
 * Onaylanan üründe gelen fiyat/stok canlıya uygulanır; reddedilen üründe eski veri kalır.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { formatDate, formatMoney } from "@/lib/mefti";
import {
  QUARANTINE_ISSUE_LABELS,
  QUARANTINE_STATUS_LABELS,
  type QuarantineIssueType,
  type QuarantineStatus,
} from "@/lib/xml-guardrail";
import { listXmlQuarantine, resolveXmlQuarantine } from "@/lib/xml-integrator.functions";

const STATUS_TABS: QuarantineStatus[] = ["pending_review", "approved", "rejected"];

/** Bekleyen kayıt varsa gösterilen uyarı rozeti. */
export function QuarantineAlertBadge({ storeId }: { storeId: string }) {
  const list = useServerFn(listXmlQuarantine);
  const query = useQuery({
    queryKey: ["xml-quarantine", storeId, "pending_review"],
    queryFn: () => list({ data: { storeId, status: "pending_review", limit: 1 } }),
    staleTime: 60_000,
  });
  const count = query.data?.pendingCount ?? 0;
  if (!count) return null;
  return (
    <Badge variant="destructive" className="gap-1">
      <ShieldAlert className="size-3" />
      {count} ürün incelemede
    </Badge>
  );
}

export function QuarantinePanel({ storeId }: { storeId: string }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<QuarantineStatus>("pending_review");
  const [selected, setSelected] = useState<string[]>([]);

  const list = useServerFn(listXmlQuarantine);
  const query = useQuery({
    queryKey: ["xml-quarantine", storeId, status],
    queryFn: () => list({ data: { storeId, status, limit: 200 } }),
  });

  const resolve = useServerFn(resolveXmlQuarantine);
  const resolveMutation = useMutation({
    mutationFn: (input: { itemIds: string[]; action: "approve" | "reject" }) =>
      resolve({ data: { storeId, ...input } }),
    onSuccess: (result, variables) => {
      toast.success(
        variables.action === "approve"
          ? `${result.applied} ürün güncellendi`
          : `${result.rejected} kayıt reddedildi, ürünler eski verisiyle kaldı`,
      );
      setSelected([]);
      void client.invalidateQueries({ queryKey: ["xml-quarantine", storeId] });
      void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = query.data?.items ?? [];
  const allSelected = items.length > 0 && selected.length === items.length;
  const busy = resolveMutation.isPending;

  const toggleRow = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={status === item ? "default" : "outline"}
            onClick={() => {
              setStatus(item);
              setSelected([]);
            }}
          >
            {QUARANTINE_STATUS_LABELS[item]}
          </Button>
        ))}
        {query.data?.pendingCount ? (
          <Badge variant="destructive" className="ml-auto gap-1">
            <ShieldAlert className="size-3" />
            {query.data.pendingCount} ürün incelemede
          </Badge>
        ) : null}
      </div>

      {status === "pending_review" && items.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked ? items.map((item) => item.id) : [])}
            />
            Tümünü seç
          </label>
          <span className="text-xs text-muted-foreground">{selected.length} seçili</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              disabled={busy || selected.length === 0}
              onClick={() => resolveMutation.mutate({ itemIds: selected, action: "approve" })}
            >
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
              Seçilenleri onayla
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || selected.length === 0}
              onClick={() => resolveMutation.mutate({ itemIds: selected, action: "reject" })}
            >
              <X className="mr-1 size-4" />
              Seçilenleri reddet
            </Button>
          </div>
        </div>
      ) : null}

      {query.isLoading ? <CardSkeleton /> : null}
      {query.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          Liste yüklenemedi: {(query.error as Error).message}
        </div>
      ) : null}

      {!query.isLoading && items.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Bu listede kayıt yok.
        </p>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
              {status === "pending_review" ? (
                <Checkbox
                  aria-label={`${item.sku} seç`}
                  checked={selected.includes(item.id)}
                  onCheckedChange={() => toggleRow(item.id)}
                />
              ) : (
                <span />
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.sku}</code>
                  <Badge variant="outline">
                    {QUARANTINE_ISSUE_LABELS[item.issueType as QuarantineIssueType] ?? item.issueType}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{item.productTitle ?? "Ürün adı yok"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fiyat: {item.oldPrice === null ? "—" : formatMoney(item.oldPrice)} →{" "}
                  <span className="font-medium text-foreground">
                    {item.newPrice === null ? "—" : formatMoney(item.newPrice)}
                  </span>
                  {item.newStock === null ? null : ` · Stok: ${item.oldStock ?? "—"} → ${item.newStock}`}
                </p>
                {item.reason ? <p className="mt-1 text-xs text-destructive">{item.reason}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
              </div>

              {status === "pending_review" ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => resolveMutation.mutate({ itemIds: [item.id], action: "approve" })}
                  >
                    <Check className="mr-1 size-4" />
                    Onayla
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => resolveMutation.mutate({ itemIds: [item.id], action: "reject" })}
                  >
                    <X className="mr-1 size-4" />
                    Reddet
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary">{QUARANTINE_STATUS_LABELS[status]}</Badge>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
