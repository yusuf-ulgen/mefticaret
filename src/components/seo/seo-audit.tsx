import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, EyeOff, Info, RefreshCw, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/mefti";
import type { SeoAuditPageRow, SeoAuditRow, SeoIssueRow } from "@/lib/seo-audit-queries";

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Teknik",
  onpage: "Sayfa içi",
  content: "İçerik",
  schema: "Schema",
  performance: "Performans",
  mobile: "Mobil",
  linking: "Bağlantı",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  warning: "Uyarı",
  info: "Bilgi",
};

const ENTITY_LABELS: Record<string, string> = {
  store: "Mağaza",
  product: "Ürün",
  collection: "Koleksiyon",
  category: "Kategori",
  brand: "Marka",
  page: "Sayfa",
  blog: "Blog",
  redirect: "Yönlendirme",
};

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-600";
  if (score >= 65) return "text-amber-600";
  return "text-destructive";
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export function SeoAuditTab({
  audit,
  pages,
  issues,
  running,
  pending,
  runAudit,
  fixIssues,
  setStatus,
}: {
  audit: SeoAuditRow | null;
  pages: SeoAuditPageRow[];
  issues: SeoIssueRow[];
  running: boolean;
  pending: boolean;
  runAudit: () => void;
  fixIssues: (ids: string[]) => void;
  setStatus: (id: string, status: "open" | "ignored" | "resolved") => void;
}) {
  const [severity, setSeverity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const openIssues = issues.filter((issue) => issue.status === "open");
  const filtered = useMemo(
    () =>
      openIssues.filter(
        (issue) =>
          (severity === "all" || issue.severity === severity) &&
          (category === "all" || issue.category === category),
      ),
    [openIssues, severity, category],
  );
  const autofixable = filtered.filter((issue) => issue.autofixable).map((issue) => issue.id);

  const categories: { key: string; value: number }[] = audit
    ? [
        { key: "technical", value: audit.technical_score },
        { key: "onpage", value: audit.onpage_score },
        { key: "content", value: audit.content_score },
        { key: "schema", value: audit.schema_score },
        { key: "performance", value: audit.performance_score },
        { key: "mobile", value: audit.mobile_score },
        { key: "linking", value: audit.linking_score },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="surface-card grid grid-cols-1 gap-6 p-6 lg:grid-cols-[260px_1fr]">
        <div className="rounded-xl border border-border p-5 text-center">
          <p className="eyebrow">SEO skoru</p>
          <p className={`mt-2 text-5xl font-semibold ${scoreTone(audit?.score ?? 0)}`}>
            {audit ? audit.score : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {audit
              ? `${formatNumber(audit.pages_count)} sayfa · ${new Date(audit.created_at).toLocaleString("tr-TR")}`
              : "Henüz denetim çalıştırılmadı"}
          </p>
          <Button className="mt-4 w-full gap-2" onClick={runAudit} disabled={running}>
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Denetim çalışıyor..." : "Denetimi çalıştır"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Denetimi çalıştırdığınızda teknik, içerik, schema, performans, mobil ve bağlantı skorları burada
              listelenir.
            </p>
          ) : (
            categories.map((item) => (
              <div key={item.key} className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[item.key]}
                </p>
                <p className={`mt-1 text-2xl font-semibold ${scoreTone(item.value)}`}>{item.value}</p>
                <Progress className="mt-2" value={item.value} />
              </div>
            ))
          )}
          {audit ? (
            <>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Kritik</p>
                <p className="mt-1 text-2xl font-semibold text-destructive">{audit.critical_count}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Uyarı</p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">{audit.warning_count}</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Başarılı kontrol</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-600">{audit.passed_count}</p>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-medium">Sorun merkezi</h2>
            <p className="text-xs text-muted-foreground">
              {formatNumber(filtered.length)} açık kayıt · {formatNumber(autofixable.length)} tanesi tek tıkla
              düzeltilebilir
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Önem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm önem dereceleri</SelectItem>
                <SelectItem value="critical">Kritik</SelectItem>
                <SelectItem value="warning">Uyarı</SelectItem>
                <SelectItem value="info">Bilgi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm kategoriler</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2"
              disabled={pending || autofixable.length === 0}
              onClick={() => fixIssues(autofixable)}
            >
              <Wand2 className="h-4 w-4" /> Tümünü düzelt ({autofixable.length})
            </Button>
            {selected.length > 0 ? (
              <Button className="gap-2" disabled={pending} onClick={() => fixIssues(selected)}>
                <Wand2 className="h-4 w-4" /> Seçili {selected.length} kaydı düzelt
              </Button>
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Bu filtrede açık sorun yok.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.slice(0, 200).map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                {issue.autofixable ? (
                  <Checkbox
                    className="mt-1"
                    checked={selected.includes(issue.id)}
                    onCheckedChange={(checked) =>
                      setSelected((old) =>
                        checked ? [...old, issue.id] : old.filter((id) => id !== issue.id),
                      )
                    }
                    aria-label="Sorunu seç"
                  />
                ) : (
                  <span className="mt-1 w-4" />
                )}
                <SeverityIcon severity={issue.severity} />
                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{issue.message}</p>
                    <Badge variant="outline" className="text-[11px]">
                      {SEVERITY_LABELS[issue.severity]}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {CATEGORY_LABELS[issue.category] ?? issue.category}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {ENTITY_LABELS[issue.entity_type] ?? issue.entity_type}
                    </Badge>
                  </div>
                  {issue.title ? <p className="mt-1 text-xs text-muted-foreground">{issue.title}</p> : null}
                  {issue.url ? (
                    <code className="mt-1 block truncate text-xs text-muted-foreground">{issue.url}</code>
                  ) : null}
                  {issue.fix_hint ? (
                    <p className="mt-1 text-xs text-muted-foreground">Öneri: {issue.fix_hint}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {issue.autofixable ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => fixIssues([issue.id])}>
                      Düzelt
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    disabled={pending}
                    onClick={() => setStatus(issue.id, "ignored")}
                  >
                    <EyeOff className="h-4 w-4" /> Yoksay
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-medium">Sayfa bazlı skorlar</h2>
          <p className="text-xs text-muted-foreground">En düşük skorlu sayfalar önce listelenir.</p>
        </div>
        {pages.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Denetim çalıştırıldığında sayfa listesi burada görünür.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Sayfa</th>
                  <th className="px-3 py-3">Tür</th>
                  <th className="px-3 py-3">Skor</th>
                  <th className="px-3 py-3">Kritik</th>
                  <th className="px-3 py-3">Uyarı</th>
                  <th className="px-5 py-3">Index</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pages.slice(0, 200).map((page) => (
                  <tr key={page.id}>
                    <td className="max-w-[320px] px-5 py-3">
                      <p className="truncate font-medium">{page.title ?? page.url}</p>
                      <code className="block truncate text-xs text-muted-foreground">{page.url}</code>
                    </td>
                    <td className="px-3 py-3 text-xs">{ENTITY_LABELS[page.entity_type] ?? page.entity_type}</td>
                    <td className={`px-3 py-3 font-semibold ${scoreTone(page.score)}`}>{page.score}</td>
                    <td className="px-3 py-3">{page.critical_count}</td>
                    <td className="px-3 py-3">{page.warning_count}</td>
                    <td className="px-5 py-3 text-xs">
                      {page.indexable ? (
                        <Badge variant="secondary">Indexlenebilir</Badge>
                      ) : (
                        <Badge variant="destructive">noindex</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
