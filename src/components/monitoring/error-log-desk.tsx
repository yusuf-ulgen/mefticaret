import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { errorLogsQuery } from "@/lib/monitoring-queries";
import { resolveErrorLog } from "@/lib/monitoring.functions";

/** Aranabilir hata kayıt masası: seviye etiketleri, stack trace ve çözüm durumu. */

type Severity = "ALL" | "CRITICAL" | "WARNING" | "INFO";

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  { value: "CRITICAL", label: "Kritik" },
  { value: "WARNING", label: "Uyarı" },
  { value: "INFO", label: "Bilgi" },
];

export function ErrorLogDesk() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [severity, setSeverity] = useState<Severity>("ALL");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(
    errorLogsQuery({ search: term, severity, onlyOpen }, isPlatformAdmin),
  );
  const resolveFn = useServerFn(resolveErrorLog);
  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; resolved: boolean }) => resolveFn({ data: input }),
    onSuccess: () => {
      toast.success("Kayıt güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["error-logs"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(search.trim());
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Hata mesajı, kaynak veya rota ara"
            className="max-w-sm"
          />
          <Button type="submit" size="sm" variant="secondary">
            Ara
          </Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {SEVERITIES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={severity === item.value ? "default" : "outline"}
              onClick={() => setSeverity(item.value)}
            >
              {item.label}
            </Button>
          ))}
          <Button size="sm" variant={onlyOpen ? "default" : "outline"} onClick={() => setOnlyOpen((value) => !value)}>
            {onlyOpen ? "Açık kayıtlar" : "Tüm kayıtlar"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      <ul className="divide-y divide-border rounded-2xl border border-border">
        {(data ?? []).map((row) => (
          <li key={row.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={row.severity === "CRITICAL" ? "destructive" : "secondary"}>{row.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{row.source}</span>
                  {row.route ? <span className="text-xs text-muted-foreground">· {row.route}</span> : null}
                  {row.resolved_at ? <Badge variant="outline">çözüldü</Badge> : null}
                </div>
                <p className="mt-2 break-words text-sm font-medium">{row.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatNumber(row.occurrences)} kez · ilk {formatDateTime(row.first_seen_at)} · son{" "}
                  {formatDateTime(row.last_seen_at)}
                  {row.user_id ? ` · kullanıcı ${row.user_id.slice(0, 8)}…` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {row.stack ? (
                  <Button size="sm" variant="outline" onClick={() => setOpenRow(openRow === row.id ? null : row.id)}>
                    {openRow === row.id ? "Gizle" : "Stack"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate({ id: row.id, resolved: !row.resolved_at })}
                >
                  {row.resolved_at ? "Yeniden aç" : "Çözüldü"}
                </Button>
              </div>
            </div>
            {openRow === row.id && row.stack ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-muted p-3 text-[11px] leading-relaxed">
                {row.stack}
              </pre>
            ) : null}
          </li>
        ))}
        {!isLoading && (data ?? []).length === 0 ? (
          <li className="p-8 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</li>
        ) : null}
        {isLoading ? <li className="p-8 text-center text-sm text-muted-foreground">Yükleniyor…</li> : null}
      </ul>
    </div>
  );
}
