import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Copy,
  Globe,
  HelpCircle,
  Loader2,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  DOMAIN_STATUS_LABELS,
  DOMAIN_TXT_PREFIX,
  PLATFORM_DNS_A,
  PLATFORM_DNS_CNAME,
} from "@/lib/mefti";

export type CheckState = "ok" | "warn" | "pending" | "error" | "unknown";

type DomainRow = {
  id: string;
  hostname: string;
  type: "subdomain" | "custom";
  status: string;
  ssl_status: string;
  ssl_expires_at: string | null;
  verification_token: string;
  dns_records: unknown;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  is_primary: boolean;
  redirect_to_hostname: string | null;
};

const STATE_STYLE: Record<CheckState, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-success" },
  warn: { icon: TriangleAlert, className: "text-warning" },
  pending: { icon: Loader2, className: "text-brand animate-spin" },
  error: { icon: XCircle, className: "text-destructive" },
  unknown: { icon: HelpCircle, className: "text-muted-foreground" },
};

function StateIcon({ state, className }: { state: CheckState; className?: string }) {
  const { icon: Icon, className: tone } = STATE_STYLE[state];
  return <Icon aria-hidden className={cn("size-5 shrink-0", tone, className)} />;
}

function fmt(value: string) {
  // Kullanıcının yerel saat dilimi (tarayıcı varsayılanı)
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function detected(records: unknown, type: string): string[] {
  if (!Array.isArray(records)) return [];
  return records
    .filter((r): r is { type: string; value: string } => !!r && typeof r === "object" && (r as { type?: unknown }).type === type)
    .map((r) => String(r.value));
}

type DnsCheck = { type: string; name: string; expected: string; found: string[]; state: CheckState; note: string };

function buildDnsChecks(domain: DomainRow, checking: boolean): DnsCheck[] {
  const apex = domain.hostname.replace(/^www\./, "");
  const isWww = domain.hostname.startsWith("www.");
  const specs = [
    { type: "TXT", name: `${DOMAIN_TXT_PREFIX}.${apex}`, expected: domain.verification_token },
    isWww
      ? { type: "CNAME", name: "www", expected: PLATFORM_DNS_CNAME }
      : { type: "A", name: "@", expected: PLATFORM_DNS_A },
  ];
  return specs.map((spec) => {
    const found = detected(domain.dns_records, spec.type);
    let state: CheckState;
    let note: string;
    if (checking) {
      state = "pending";
      note = "Kontrol ediliyor";
    } else if (!domain.last_checked_at) {
      state = "unknown";
      note = "Henüz kontrol edilmedi";
    } else if (found.includes(spec.expected)) {
      state = "ok";
      note = "Doğru";
    } else if (found.length) {
      state = "error";
      note = "Farklı değer bulundu";
    } else {
      state = "warn";
      note = "Kayıt bulunamadı";
    }
    return { ...spec, found, state, note };
  });
}

function worst(states: CheckState[]): CheckState {
  const order: CheckState[] = ["error", "pending", "warn", "unknown", "ok"];
  return order.find((s) => states.includes(s)) ?? "unknown";
}

function tlsState(domain: DomainRow, checking: boolean): { state: CheckState; label: string; detail?: string | undefined } {
  if (checking) return { state: "pending", label: "Kontrol ediliyor" };
  const expired = domain.ssl_expires_at && new Date(domain.ssl_expires_at).getTime() < Date.now();
  if (domain.ssl_status === "active" && expired)
    return { state: "error", label: "Süresi dolmuş", detail: `Bitiş: ${fmt(domain.ssl_expires_at!)}` };
  if (domain.ssl_status === "active")
    return {
      state: "ok",
      label: "Aktif",
      detail: domain.ssl_expires_at ? `Geçerlilik: ${fmt(domain.ssl_expires_at)}` : undefined,
    };
  if (domain.ssl_status === "failed") return { state: "error", label: "Sertifika hatası" };
  return {
    state: "pending",
    label: "Hazırlanıyor",
    detail: "DNS doğrulaması tamamlandığında sertifika hazırlanır.",
  };
}

function Section({ title, state, summary, children, defaultOpen }: { title: string; state: CheckState; summary: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-6">
        <StateIcon state={state} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-5 sm:px-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function DomainStatusCard({
  domain,
  checking,
  checkError,
  onRecheck,
  actions,
}: {
  domain: DomainRow;
  checking: boolean;
  checkError: string | null;
  onRecheck: (() => void) | null;
  actions: ReactNode;
}) {
  const isCustom = domain.type === "custom";
  const dns = isCustom ? buildDnsChecks(domain, checking) : [];
  const dnsState: CheckState = isCustom ? worst(dns.map((d) => d.state)) : domain.status === "verified" ? "ok" : "unknown";
  const tls = tlsState(domain, checking);

  const overall: { state: CheckState; label: string } = checking
    ? { state: "pending", label: "Kontrol ediliyor" }
    : domain.status === "verified" && tls.state === "ok"
      ? { state: "ok", label: "Bağlı" }
      : domain.status === "failed"
        ? { state: "error", label: "Bağlanamadı" }
        : domain.status === "verified"
          ? { state: "warn", label: "Bağlı · TLS bekleniyor" }
          : { state: "warn", label: DOMAIN_STATUS_LABELS[domain.status] ?? domain.status };

  const badgeTone: Record<CheckState, string> = {
    ok: "bg-success/15 text-success border-success/30",
    warn: "bg-warning/20 text-warning-foreground border-warning/40",
    pending: "bg-brand-soft text-brand border-brand/30",
    error: "bg-destructive/10 text-destructive border-destructive/30",
    unknown: "bg-muted text-muted-foreground border-border",
  };

  return (
    <article className="surface-card overflow-hidden p-0">
      <header className="space-y-2 px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-all font-display text-xl font-bold tracking-tight sm:text-2xl">
            {domain.hostname}
          </h3>
          <Badge variant="outline" className={cn("gap-1", badgeTone[overall.state])}>
            {overall.label}
          </Badge>
          {domain.is_primary ? <Badge>Ana domain</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {isCustom ? "Özel domain" : "Platform alt alan adı"} · Eklenme: {fmt(domain.created_at)}
          {domain.redirect_to_hostname ? ` · → ${domain.redirect_to_hostname} (301)` : ""}
        </p>
      </header>

      <div className="mx-4 my-5 flex flex-col items-center gap-3 rounded-2xl bg-brand-soft px-4 py-8 text-center sm:mx-6">
        <div className="relative">
          <span className="grid size-20 place-items-center rounded-full bg-background shadow-sm">
            <Globe className="size-11 text-brand" strokeWidth={1.4} />
          </span>
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-background shadow">
            <StateIcon state={overall.state} className="size-6" />
          </span>
        </div>
        <p className="font-medium">
          {overall.state === "ok"
            ? "Alan adın mağazana bağlı ve güvenli."
            : overall.state === "pending"
              ? "Durum kontrol ediliyor…"
              : overall.state === "error"
                ? "Alan adı doğrulanamadı. DNS kayıtlarını kontrol et."
                : "Kurulum tamamlanmadı. Aşağıdaki adımları kontrol et."}
        </p>
        <p className="text-xs text-muted-foreground">
          {domain.last_checked_at ? `Son kontrol: ${fmt(domain.last_checked_at)}` : isCustom ? "Henüz kontrol edilmedi" : "Platform tarafından yönetilir"}
        </p>
        {onRecheck ? (
          <Button size="sm" variant="outline" className="rounded-full" onClick={onRecheck} disabled={checking} aria-busy={checking}>
            {checking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            {checking ? "Kontrol ediliyor…" : "Durumu yeniden kontrol et"}
          </Button>
        ) : null}
        {checkError ? (
          <div role="alert" className="w-full rounded-lg border border-destructive/30 bg-background p-3 text-left text-xs text-destructive">
            <p className="font-medium">Durum alınamadı</p>
            <p className="mt-1 break-words">{checkError}</p>
            {onRecheck ? (
              <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={onRecheck}>
                Yeniden dene
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div aria-live="polite">
        <Section
          title="DNS kayıtları"
          state={dnsState}
          summary={isCustom ? `${dns.filter((d) => d.state === "ok").length}/${dns.length} kayıt doğru` : "Platform tarafından otomatik yönetilir"}
          defaultOpen={isCustom && dnsState !== "ok"}
        >
          {isCustom ? (
            <ul className="space-y-2">
              {dns.map((row) => (
                <li key={row.type} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{row.type}</Badge>
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{row.name}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-xs">
                      <StateIcon state={row.state} className="size-4" /> {row.note}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-1 text-xs">
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-2">
                      <dt className="text-muted-foreground">Beklenen</dt>
                      <dd className="break-all font-mono">{row.expected}</dd>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Değeri kopyala"
                        onClick={() => {
                          void navigator.clipboard.writeText(row.expected);
                          toast.success("Kopyalandı");
                        }}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                      <dt className="text-muted-foreground">Tespit edilen</dt>
                      <dd className="break-all font-mono">
                        {domain.last_checked_at ? (row.found.length ? row.found.join(", ") : "—") : "Henüz kontrol edilmedi"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
              {domain.last_error ? (
                <li className="flex items-start gap-2 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {domain.last_error}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Bu alt alan adı için DNS kaydı eklemen gerekmez.</p>
          )}
        </Section>

        <Section title="Bölgesel erişim" state="unknown" summary="Bu kontrol henüz desteklenmiyor">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <CircleDashed className="mt-0.5 size-4 shrink-0" />
            <p>
              Mefticaret DNS kayıtlarını tek bir genel çözümleyici üzerinden kontrol ediyor; bölge bazlı erişim testi
              henüz yapılmıyor. Bu yüzden burada bölge sonucu gösterilmez.
            </p>
          </div>
        </Section>

        <Section title="TLS sertifikası" state={tls.state} summary={tls.label}>
          <p className="text-sm">{tls.label}</p>
          {tls.detail ? <p className="mt-1 text-xs text-muted-foreground">{tls.detail}</p> : null}
        </Section>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-4 sm:px-6">{actions}</footer>
    </article>
  );
}
