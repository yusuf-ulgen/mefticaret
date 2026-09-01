import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { platformListQuery } from "@/lib/platform-admin-queries";
import { PLATFORM_DATASETS, type PlatformColumn, type PlatformDatasetKey } from "@/lib/platform-datasets";

/** Platform genelinde beyaz listelenmiş bir veri kümesini arama, yenileme ve CSV ile listeler. */

function renderCell(column: PlatformColumn, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (column.kind) {
    case "date":
      return formatDateTime(String(value));
    case "money":
      return formatMoney(Number(value));
    case "number":
      return formatNumber(Number(value));
    case "percent":
      return `${(Number(value) * 100).toFixed(2)}%`;
    case "boolean":
      return value ? "Evet" : "Hayır";
    case "json":
      return JSON.stringify(value).slice(0, 120);
    default:
      return String(value);
  }
}

export function PlatformDataTable({ dataset }: { dataset: PlatformDatasetKey }) {
  const { isPlatformAdmin } = useAuth();
  const config = PLATFORM_DATASETS[dataset];
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const query = useQuery(platformListQuery(dataset, search, isPlatformAdmin));

  const rows = query.data?.rows ?? [];
  const storeNames = query.data?.storeNames ?? {};
  const columns = config.columns;

  const exportCsv = () => {
    downloadCsv(
      `mefticaret-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        [...(config.withStore ? ["Mağaza"] : []), ...columns.map((column) => column.label)],
        rows.map((row) => [
          ...(config.withStore ? [storeNames[String(row["store_id"] ?? "")] ?? ""] : []),
          ...columns.map((column) => renderCell(column, row[column.key])),
        ]),
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {config.searchColumns.length > 0 ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(term.trim());
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ara"
                className="h-9 w-56 pl-8"
                aria-label={`${config.title} içinde ara`}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Ara
            </Button>
          </form>
        ) : null}
        <Badge variant="secondary">{formatNumber(rows.length)} kayıt</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCcw className="size-4" /> Yenile
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {query.isError ? (
        <p className="surface-card p-4 text-sm text-destructive">
          {(query.error as Error).message}
        </p>
      ) : null}

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {config.withStore ? <th className="px-4 py-3">Mağaza</th> : null}
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 whitespace-nowrap">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={String(row["id"] ?? index)} className="align-top">
                {config.withStore ? (
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {storeNames[String(row["store_id"] ?? "")] ?? "—"}
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.key} className="max-w-[280px] px-4 py-3">
                    {column.kind === "badge" ? (
                      <Badge variant="secondary">{renderCell(column, row[column.key])}</Badge>
                    ) : (
                      <span className="line-clamp-2 break-words">{renderCell(column, row[column.key])}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !query.isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (config.withStore ? 1 : 0)}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
