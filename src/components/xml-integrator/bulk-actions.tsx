/**
 * Toplu besleme işlemleri: seçili sekmedeki beslemeleri sırayla çalıştırır,
 * açar veya kapatır. Her besleme mevcut yetkili sunucu işlevleriyle işlenir.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pause, Play, Power } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { runXmlFeedNow, toggleXmlFeed } from "@/lib/xml-integrator.functions";

type Feed = { id: string; name: string; isActive: boolean };
type Action = "run" | "activate" | "deactivate";

export function XmlBulkActions({ storeId, feeds, runLabel }: { storeId: string; feeds: Feed[]; runLabel: string }) {
  const client = useQueryClient();
  const run = useServerFn(runXmlFeedNow);
  const toggle = useServerFn(toggleXmlFeed);
  const [busy, setBusy] = useState<Action | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  if (feeds.length < 2) return null;

  const execute = async (action: Action) => {
    const targets =
      action === "run"
        ? feeds.filter((feed) => feed.isActive)
        : feeds.filter((feed) => feed.isActive !== (action === "activate"));
    if (!targets.length) {
      toast.info(action === "run" ? "Çalıştırılacak aktif besleme yok" : "Değiştirilecek besleme yok");
      return;
    }
    setBusy(action);
    setProgress({ done: 0, total: targets.length });
    let ok = 0;
    const failed: string[] = [];
    for (const feed of targets) {
      try {
        if (action === "run") await run({ data: { storeId, feedId: feed.id, forceFullSync: false } });
        else await toggle({ data: { storeId, feedId: feed.id, isActive: action === "activate" } });
        ok += 1;
      } catch (error) {
        failed.push(`${feed.name}: ${error instanceof Error ? error.message : "hata"}`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setBusy(null);
    void client.invalidateQueries({ queryKey: ["xml-integrator", storeId] });
    if (failed.length) toast.error(`${ok} besleme tamamlandı, ${failed.length} başarısız — ${failed.slice(0, 2).join(" · ")}`);
    else toast.success(`${ok} besleme tamamlandı`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <span className="mr-auto text-xs font-medium uppercase tracking-wide text-primary">Toplu işlemler</span>
      {busy ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> {progress.done}/{progress.total}
        </span>
      ) : null}
      <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void execute("run")}>
        <Play className="mr-1 size-4" /> {runLabel}
      </Button>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void execute("activate")}>
        <Power className="mr-1 size-4" /> Tümünü aç
      </Button>
      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void execute("deactivate")}>
        <Pause className="mr-1 size-4" /> Tümünü kapat
      </Button>
    </div>
  );
}
