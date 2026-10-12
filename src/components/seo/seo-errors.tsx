import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/mefti";
import type { Seo404 } from "@/lib/seo-management-queries";

export function SeoErrorsTab({
  rows,
  targets,
  setTarget,
  create,
  pending,
}: {
  rows: Seo404[];
  targets: Record<string, string>;
  setTarget: (id: string, value: string) => void;
  create: (id: string, target: string) => void;
  pending: boolean;
}) {
  const totalHits = rows.reduce((sum, row) => sum + row.hit_count, 0);

  return (
    <section className="surface-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-medium">404 kayıtları</h2>
          <p className="text-xs text-muted-foreground">
            Vitrinde bulunamayan adresler otomatik olarak kaydedilir.
          </p>
        </div>
        <Badge variant="secondary">{formatNumber(totalHits)} toplam isabet</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          Henüz kayıtlı 404 yok. Ziyaretçiler kırık bir adrese girdiğinde burada listelenir.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[240px] flex-1">
                  <p className="text-sm font-medium">{row.path}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(row.hit_count)} isabet · son görülme{" "}
                    {new Date(row.last_seen_at).toLocaleString("tr-TR")}
                  </p>
                </div>
                {row.referrer ? (
                  <Badge variant="outline" className="max-w-[240px] truncate text-xs">
                    {row.referrer}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-xs"
                  value={targets[row.id] ?? ""}
                  onChange={(event) => setTarget(row.id, event.target.value)}
                  placeholder="/yeni-hedef-adres"
                  aria-label={`${row.path} için hedef adres`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || !(targets[row.id] ?? "").trim()}
                  onClick={() => create(row.id, (targets[row.id] ?? "").trim())}
                >
                  301 oluştur
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
