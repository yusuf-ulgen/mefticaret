import { Link } from "@tanstack/react-router";
import { CheckCircle2, Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Metric } from "@/components/seo/seo-shared";
import { formatNumber } from "@/lib/mefti";

export type SeoCheck = { id: string; label: string; hint: string; ok: boolean; to?: string };
export type SeoProductIssue = { id: string; title: string; slug: string; issues: string[] };

export function SeoOverviewTab({
  checks,
  score,
  passed,
  activeCount,
  issues,
  loading,
  storeId,
}: {
  checks: SeoCheck[];
  score: number;
  passed: number;
  activeCount: number;
  issues: SeoProductIssue[];
  loading: boolean;
  storeId: string;
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="SEO skoru" value={`${score}/100`}>
          <Progress value={score} className="mt-3" />
        </Metric>
        <Metric label="Mağaza kontrolleri" value={`${passed}/${checks.length}`} hint="tamamlandı" />
        <Metric
          label="Eksiği olan ürün"
          value={formatNumber(issues.length)}
          hint={`${formatNumber(activeCount)} aktif ürün içinde`}
        />
      </section>

      <section className="surface-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-medium">Mağaza kontrolleri</h2>
        </div>
        <ul className="divide-y">
          {checks.map((check) => (
            <li key={check.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              {check.ok ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <TriangleAlert className="h-5 w-5 text-destructive" />
              )}
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-medium">{check.label}</p>
                {!check.ok ? <p className="text-xs text-muted-foreground">{check.hint}</p> : null}
              </div>
              {!check.ok && check.to ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={check.to}>Düzelt</Link>
                </Button>
              ) : (
                <Badge variant="secondary">Tamam</Badge>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Ürün sayfası eksikleri</h2>
        </div>
        {loading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : issues.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Aktif ürünlerin tümü temel SEO kontrollerini geçiyor.
          </p>
        ) : (
          <ul className="divide-y">
            {issues.slice(0, 50).map((product) => (
              <li key={product.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-medium">{product.title}</p>
                  <p className="text-xs text-muted-foreground">/{product.slug}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {product.issues.map((issue) => (
                    <Badge key={issue} variant="outline" className="text-xs">
                      {issue}
                    </Badge>
                  ))}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/store/$storeId/products/$productId"
                    params={{ storeId, productId: product.id }}
                  >
                    Düzenle
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
