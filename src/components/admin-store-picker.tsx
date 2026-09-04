import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search, Store as StoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { adminStoresQuery } from "@/lib/store-queries";

/**
 * Süper admin ekranlarında mağaza seçimi: her mağaza için ilgili düzenleme
 * ekranlarına doğrudan bağlantı verir (platform_admin RLS'te tüm mağazaları yönetebilir).
 */

export type StoreLinkDef = {
  /** `:id` yerine mağaza kimliği yazılır. */
  path: string;
  label: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  suspended: "Askıda",
  archived: "Arşiv",
};

export function AdminStorePicker({
  links,
  emptyHint,
}: {
  links: StoreLinkDef[];
  emptyHint?: string;
}) {
  const { isPlatformAdmin } = useAuth();
  const stores = useQuery(adminStoresQuery(isPlatformAdmin));
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const list = (stores.data ?? []) as Record<string, unknown>[];
    const needle = term.trim().toLocaleLowerCase("tr");
    if (!needle) return list;
    return list.filter((row) =>
      `${row["name"] ?? ""} ${row["slug"] ?? ""}`.toLocaleLowerCase("tr").includes(needle),
    );
  }, [stores.data, term]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Mağaza ara…"
          className="pl-9"
          aria-label="Mağaza ara"
        />
      </div>

      {stores.isLoading ? (
        <p className="text-sm text-muted-foreground">Mağazalar yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="surface-card px-6 py-10 text-center text-sm text-muted-foreground">
          {emptyHint ?? "Kayıtlı mağaza bulunamadı."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const id = String(row["id"]);
            const slug = String(row["slug"] ?? "");
            const status = String(row["status"] ?? "draft");
            return (
              <article key={id} className="surface-card flex flex-col gap-3 p-4">
                <header className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <StoreIcon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold">
                      {String(row["name"] ?? "Mağaza")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">/s/{slug}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </header>

                <div className="flex flex-wrap gap-1.5">
                  {links.map((link) => (
                    <Button key={link.path} asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link to={link.path.replace(":id", id)}>{link.label}</Link>
                    </Button>
                  ))}
                  {slug ? (
                    <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                      <a href={`/s/${slug}`} target="_blank" rel="noreferrer">
                        Vitrini aç <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
