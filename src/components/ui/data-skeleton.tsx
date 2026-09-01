import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Tablo yüklenirken satır iskeleti; `aria-busy` ile durum duyurulur. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Veriler yükleniyor"
      className={cn("surface-card divide-y divide-border", className)}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 px-5 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Metrik kartları için iskelet. */
export function CardSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Veriler yükleniyor"
      className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card space-y-3 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Grafik alanı iskeleti. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true" aria-label="Grafik yükleniyor" className={cn("surface-card p-6", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}
