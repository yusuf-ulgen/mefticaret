import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchPlatformSlugHistory } from "@/lib/platform-seo.functions";
import { QueryStatus } from "@/components/query-status";
import { Button } from "@/components/ui/button";

export function PlatformSlugInventory() {
  const get = useServerFn(fetchPlatformSlugHistory);
  const query = useQuery({ queryKey: ["platform-slug-history"], queryFn: () => get() });
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold">Eski → güncel blog adresleri</summary>
      <QueryStatus
        label="Slug geçmişi"
        error={query.error}
        loading={query.isPending}
        hasData={query.data !== undefined}
        onRetry={() => void query.refetch()}
      />
      <p className="my-3 text-xs text-muted-foreground">
        Yayındaki yazı doğrudan güncel adresine 301 yönlenir. Silinmiş veya yayınlanmamış yazı 404
        verir. Kaydı olmayan eski adresler tahmin edilmez.
      </p>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
        Yenile
      </Button>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr>
              <th>Eski adres</th>
              <th>Hedef</th>
              <th>Yanıt</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((row) => (
              <tr className="border-t" key={row.oldPath}>
                <td className="py-2">{row.oldPath}</td>
                <td>
                  {row.targetPath ? (
                    <a href={row.targetPath} className="underline">
                      {row.targetPath}
                    </a>
                  ) : (
                    "Yayında hedef yok"
                  )}
                </td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data?.length === 0 ? <p className="mt-3 text-sm">Kayıtlı eski slug yok.</p> : null}
    </details>
  );
}
