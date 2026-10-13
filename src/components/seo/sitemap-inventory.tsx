import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { inspectPlatformSitemaps } from "@/lib/platform-seo.functions";
import { formatDateTime } from "@/lib/mefti";
import { Button } from "@/components/ui/button";

export function PlatformSitemapInventory() {
  const inspect = useServerFn(inspectPlatformSitemaps);
  const query = useMutation({ mutationFn: () => inspect() });
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Sitemap kapsam envanteri</h2>
        <Button variant="outline" disabled={query.isPending} onClick={() => query.mutate()}>
          {query.isPending ? "Kontrol ediliyor…" : "Envanteri yenile"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Platform dilleri ve mağaza içerikleri farklı kapsamlardır; sayıları toplam URL olarak
        toplanmaz. Aktif/yayınlanmış/noindex kuralları mevcut sitemap üreticileriyle aynı kaynaktan
        kontrol edilir.
      </p>
      {query.error ? <p role="alert">{query.error.message}</p> : null}
      {query.data ? (
        <>
          <p className="text-xs">Son üretim: {formatDateTime(query.data.generatedAt)}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr>
                  <th>Kapsam</th>
                  <th>URL</th>
                  <th>Tekrar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.path} className="border-t">
                    <td className="py-2">
                      <a href={row.path} target="_blank" rel="noreferrer" className="underline">
                        {row.scope}
                      </a>
                    </td>
                    <td>{row.total ?? "—"}</td>
                    <td>{row.duplicates ?? "—"}</td>
                    <td>{row.error ?? (row.duplicates ? "Yinelenen URL var" : "Üretildi")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
