/**
 * Canlı çalışma ilerlemesi: süren içe aktarım çalışmalarını Realtime ile izler,
 * ilerleme çubuğu, işlenen ürün sayısı ve kategori bazlı hata sayaçlarını gösterir.
 */

import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlXmlRun } from "@/lib/xml-integrator-v2.functions";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { XML_ERROR_CATEGORY_LABELS, XML_PHASE_LABELS } from "@/lib/xml-integrator";
import { deltaEfficiency } from "@/lib/xml-delta-sync";

export type LiveRun = {
  id: string;
  feed_id: string;
  status: string;
  phase: string | null;
  total_rows: number | null;
  processed_count: number | null;
  created_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  error_count: number | null;
  unchanged_count: number | null;
  delta_sync_enabled: boolean | null;
  error_categories: Record<string, number> | null;
  started_at: string | null;
  control_state: string | null;
  rate_per_min: number | null;
  store_id?: string;
};

const isLive = (row: LiveRun) =>
  row.status === "queued" || row.status === "running" || (row.status === "partial" && row.control_state === "paused");

const SELECT =
  "id, feed_id, status, phase, total_rows, processed_count, created_count, updated_count, skipped_count, unchanged_count, delta_sync_enabled, error_count, error_categories, started_at, control_state, rate_per_min, store_id";

/** Süren çalışmaları okur ve Realtime güncellemeleriyle canlı tutar. */
export function useLiveImportRuns(storeId: string) {
  const [runs, setRuns] = useState<LiveRun[]>([]);

  useEffect(() => {
    if (!storeId) return;
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("xml_import_logs")
        .select(SELECT)
        .eq("store_id", storeId)
        .or("status.in.(queued,running),and(status.eq.partial,control_state.eq.paused)")
        .order("started_at", { ascending: false })
        .limit(5);
      if (active) setRuns((data ?? []) as unknown as LiveRun[]);
    };
    void load();

    const channel = supabase
      .channel(`xml-live-runs-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "xml_import_logs", filter: `store_id=eq.${storeId}` },
        (payload) => {
          const row = payload.new as unknown as LiveRun | null;
          if (!row?.id) return;
          setRuns((current) => {
            const rest = current.filter((item) => item.id !== row.id);
            if (!isLive(row)) return rest;
            return [row, ...rest].slice(0, 5);
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [storeId]);

  return runs;
}

/** Tek bir çalışmanın canlı ilerleme kartı. */
function RunCard({ run, feedName }: { run: LiveRun; feedName: string }) {
  const total = Math.max(0, Number(run.total_rows ?? 0));
  const processed = Math.max(0, Number(run.processed_count ?? 0));
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;
  const categories = Object.entries(run.error_categories ?? {}).filter(([, count]) => Number(count) > 0);
  const errorCount = Number(run.error_count ?? 0);
  const control = useServerFn(controlXmlRun);
  const [busy, setBusy] = useState<string | null>(null);
  const paused = run.control_state === "paused";
  const rate = Number(run.rate_per_min ?? 0);
  const remaining = rate > 0 && total > processed ? Math.round(((total - processed) / rate) * 60) : null;
  const act = async (action: "pause" | "stop" | "resume") => {
    if (!run.store_id) return;
    setBusy(action);
    try {
      await control({ data: { storeId: run.store_id, runId: run.id, action } });
      toast.success(action === "pause" ? "Duraklatma isteği gönderildi" : action === "stop" ? "Durdurma isteği gönderildi" : "Çalışma kaldığı yerden tamamlandı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşlem başarısız");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="rounded-xl border bg-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {paused ? <Pause className="size-3.5 text-muted-foreground" aria-hidden /> : <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />}
        <span className="font-medium">{feedName}</span>
        <Badge variant="secondary">
          {paused ? "Duraklatıldı" : run.control_state === "pause_requested" ? "Duraklatılıyor…" : run.control_state === "stop_requested" ? "Durduruluyor…" : XML_PHASE_LABELS[run.phase ?? ""] ?? "Çalışıyor"}
        </Badge>
        {errorCount > 0 ? <Badge variant="destructive">{errorCount} hata</Badge> : null}
      </div>

      <Progress className="mt-2 h-2" value={percent ?? 8} />

      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {total > 0
          ? `${processed} / ${total} ürün işlendi${percent === null ? "" : ` · %${percent}`}`
          : "Kaynak hazırlanıyor…"}
        {rate > 0 && !paused ? ` · ~${rate.toLocaleString("tr-TR")} kayıt/dk` : ""}
        {remaining !== null && !paused ? ` · kalan ~${Math.floor(remaining / 60)} dk ${remaining % 60} sn` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {paused ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("resume")}>
            {busy === "resume" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Play className="mr-1 size-3.5" />}Devam et
          </Button>
        ) : run.status === "running" ? (
          <>
            <Button size="sm" variant="outline" disabled={busy !== null || run.control_state !== "running"} onClick={() => act("pause")}>
              <Pause className="mr-1 size-3.5" />Duraklat
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null || run.control_state !== "running"} onClick={() => act("stop")}>
              <Square className="mr-1 size-3.5" />Durdur
            </Button>
          </>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <RunStat label="Yeni" value={Number(run.created_count ?? 0)} />
        <RunStat label="Güncellendi" value={Number(run.updated_count ?? 0)} />
        <RunStat label="Değişmeyen (atlandı)" value={Number(run.unchanged_count ?? 0)} />
        <RunStat label="Hatalı" value={errorCount} tone={errorCount > 0 ? "error" : "default"} />
      </div>

      <DeltaEfficiencyBadge
        totalRows={total}
        unchanged={Number(run.unchanged_count ?? 0)}
        active={run.delta_sync_enabled}
      />

      {categories.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map(([key, count]) => (
            <Badge key={key} variant="outline" className="border-destructive/40 text-destructive">
              {XML_ERROR_CATEGORY_LABELS[key] ?? key}: {Number(count)}
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Tek sayaç kutusu. */
export function RunStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "error";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone === "error" ? "text-destructive" : ""}`}>
        {value.toLocaleString("tr-TR")}
      </p>
    </div>
  );
}

/** Delta senkronizasyonun o çalışmada kazandırdığı sorgu sayısı. */
export function DeltaEfficiencyBadge({
  totalRows,
  unchanged,
  active,
}: {
  totalRows: number;
  unchanged: number;
  active?: boolean | null;
}) {
  if (active === false) return null;
  const stats = deltaEfficiency({ totalRows, unchanged });
  if (!stats) return null;
  return (
    <Badge className="mt-2 bg-success/10 text-success">
      ⚡ Delta senkronizasyon {stats.savedQueries.toLocaleString("tr-TR")} veritabanı sorgusu kazandırdı
      {stats.percent === null ? "" : ` (%${stats.percent} hızlanma)`}
    </Badge>
  );
}

/** Süren çalışmalar listesi; çalışma yoksa hiçbir şey göstermez. */
export function LiveRunProgress({
  storeId,
  feedNames,
}: {
  storeId: string;
  feedNames: Map<string, string>;
}) {
  const runs = useLiveImportRuns(storeId);
  if (!runs.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Süren çalışmalar</h2>
      {runs.map((run) => (
        <RunCard key={run.id} run={run} feedName={feedNames.get(run.feed_id) ?? "Besleme"} />
      ))}
    </section>
  );
}

/** Tamamlanmış kayıt kartlarında kategori sayaçları. */
export function ErrorCategoryBadges({ value }: { value: unknown }) {
  const entries = Object.entries((value ?? {}) as Record<string, number>).filter(([, count]) => Number(count) > 0);
  if (!entries.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, count]) => (
        <Badge key={key} variant="outline" className="border-destructive/40 text-destructive">
          {XML_ERROR_CATEGORY_LABELS[key] ?? key}: {Number(count)}
        </Badge>
      ))}
    </div>
  );
}
