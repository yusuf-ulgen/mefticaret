/**
 * Pazaryeri uyum kontrolü: dışa aktarım beslemesinde hangi ürünlerin
 * pazaryeri kurallarına uyduğunu, hangilerinin neden atlandığını gösterir.
 */

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { previewXmlExport } from "@/lib/xml-integrator.functions";
import { XML_PLATFORM_LABELS, type XmlPlatform } from "@/lib/xml-integrator";

export function ExportReadinessButton({ storeId, feedId }: { storeId: string; feedId: string }) {
  const [open, setOpen] = useState(false);
  const preview = useServerFn(previewXmlExport);
  const check = useMutation({ mutationFn: () => preview({ data: { storeId, feedId } }) });

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of check.data?.issues ?? []) {
      for (const part of issue.reason.split(";")) {
        const key = part.trim();
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [check.data]);

  const total = (check.data?.included ?? 0) + (check.data?.skipped ?? 0);
  const score = total ? Math.round(((check.data?.included ?? 0) / total) * 100) : 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          check.mutate();
        }}
      >
        <ShieldCheck className="mr-1 size-4" /> Uyum kontrolü
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pazaryeri uyum kontrolü</DialogTitle>
            <DialogDescription>
              Ürünleriniz seçili pazaryerinin zorunlu alan kurallarına göre denetlenir. Hiçbir şey gönderilmez.
            </DialogDescription>
          </DialogHeader>

          {check.isPending ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Ürünler denetleniyor…
            </div>
          ) : check.error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {(check.error as Error).message}
            </p>
          ) : check.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Uyum puanı" value={`%${score}`} tone={score >= 90 ? "success" : score >= 60 ? "default" : "destructive"} />
                <Stat label="Gönderilecek" value={String(check.data.included)} tone="success" />
                <Stat label="Atlanacak" value={String(check.data.skipped)} tone={check.data.skipped ? "destructive" : "default"} />
              </div>
              <p className="text-xs text-muted-foreground">
                Pazaryeri: {XML_PLATFORM_LABELS[check.data.platform as XmlPlatform] ?? check.data.platform}
              </p>

              {groups.length ? (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">Sorun türleri</h4>
                  <ul className="space-y-1">
                    {groups.map(([reason, count]) => (
                      <li key={reason} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm">
                        <span className="min-w-0">{reason}</span>
                        <Badge variant="secondary">{count} ürün</Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border p-3 text-sm text-success">
                  <CheckCircle2 className="size-4" /> Tüm ürünler pazaryeri kurallarına uyuyor.
                </p>
              )}

              {check.data.issues.length ? (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">Atlanan ürünler (ilk {check.data.issues.length})</h4>
                  <ul className="max-h-60 space-y-1 overflow-y-auto">
                    {check.data.issues.map((issue) => (
                      <li key={issue.productId} className="rounded-lg bg-muted/50 p-2 text-xs">
                        <p className="font-medium">{issue.title}</p>
                        <p className="text-muted-foreground">{issue.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <Button variant="outline" size="sm" onClick={() => check.mutate()}>
                Yeniden denetle
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "success" | "destructive" | "default" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
