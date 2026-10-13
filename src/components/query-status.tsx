import { Button } from "@/components/ui/button";

export function QueryStatus({
  error,
  loading,
  hasData,
  onRetry,
  label,
}: {
  error: Error | null;
  loading: boolean;
  hasData: boolean;
  onRetry: () => void;
  label: string;
}) {
  if (error)
    return (
      <div role="alert" className="space-y-2 rounded-xl border bg-card p-4 text-sm">
        <p>
          {label} alınamadı: {error.message}
        </p>
        {hasData ? (
          <p className="text-muted-foreground">Son alınan veri gösteriliyor; henüz yenilenmedi.</p>
        ) : null}
        <Button variant="outline" onClick={onRetry}>
          Tekrar dene
        </Button>
      </div>
    );
  if (loading && !hasData)
    return (
      <div role="status" className="animate-pulse rounded-xl border bg-muted/30 p-6 text-sm">
        {label} yükleniyor…
      </div>
    );
  return null;
}
