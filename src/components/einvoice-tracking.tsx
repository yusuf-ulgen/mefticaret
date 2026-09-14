import { AlertTriangle, Check, CircleDashed, Clock, Inbox, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/mefti";

/**
 * E-fatura izleme görselleri: giden belgelerin akış çizelgesi ve
 * gelen fatura özetleri. Yalnızca sunum katmanı — veri değiştirmez.
 */

export type OutgoingDoc = {
  id: string;
  status: string;
  document_number: string | null;
  document_kind?: string | null;
  environment: string;
  created_at: string;
  sent_at?: string | null;
  last_checked_at?: string | null;
  durum_kodu?: number | null;
  ulasti_mi?: boolean | null;
  yanit_durum?: number | null;
  resendable?: boolean | null;
};

export type InboxDoc = {
  id: string;
  ettn: string;
  document_number: string | null;
  document_date: string | null;
  arrived_at?: string | null;
  payable_amount: number | null;
  currency: string | null;
  sender_title: string | null;
  sender_tax_id: string | null;
};

type StageState = "done" | "active" | "error" | "idle";

type Stage = { label: string; state: StageState; hint?: string };

/** Belgenin servis yanıtlarına göre 5 aşamalı akış durumu. */
export function outgoingStages(doc: OutgoingDoc): Stage[] {
  const failed = doc.status === "failed";
  const sent = doc.status === "sent" || Boolean(doc.sent_at);
  const durum = doc.durum_kodu ?? null;
  const processed = durum === 3;
  const processError = durum === 2;
  const reached = Boolean(doc.ulasti_mi);
  const answer = doc.yanit_durum ?? null;

  return [
    { label: "Oluşturuldu", state: "done", hint: formatDateTime(doc.created_at) },
    {
      label: "Servise gönderildi",
      state: failed && !sent ? "error" : sent ? "done" : "active",
      hint: doc.sent_at ? formatDateTime(doc.sent_at) : undefined,
    },
    {
      label: "GİB'de işlendi",
      state: processError ? "error" : processed ? "done" : sent ? "active" : "idle",
      hint: durum === 1 ? "Alındı, işleniyor" : processError ? "İşleme hatası" : undefined,
    },
    {
      label: "Alıcıya ulaştı",
      state: reached ? "done" : processed ? "active" : "idle",
    },
    {
      label: "Alıcı yanıtı",
      state:
        answer === 2
          ? "done"
          : answer === 1
            ? "error"
            : answer === -1
              ? "done"
              : reached
                ? "active"
                : "idle",
      hint:
        answer === 2
          ? "Kabul"
          : answer === 1
            ? "Red"
            : answer === -1
              ? "Yanıt gerekmez"
              : answer === 0
                ? "Bekleniyor"
                : undefined,
    },
  ];
}

const STAGE_STYLE: Record<StageState, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  active: "border-primary/50 bg-primary/10 text-primary",
  error: "border-destructive bg-destructive text-destructive-foreground",
  idle: "border-border bg-muted text-muted-foreground",
};

function StageIcon({ state }: { state: StageState }) {
  if (state === "done") return <Check className="size-3.5" />;
  if (state === "error") return <X className="size-3.5" />;
  if (state === "active") return <Loader2 className="size-3.5 animate-spin" />;
  return <CircleDashed className="size-3.5" />;
}

/** Yatay, mobilde kaydırılabilir akış çizelgesi. */
export function EinvoiceFlow({ stages }: { stages: Stage[] }) {
  return (
    <ol className="-mx-1 flex w-full items-start gap-1 overflow-x-auto px-1 pb-1">
      {stages.map((stage, index) => (
        <li key={stage.label} className="flex min-w-[104px] flex-1 flex-col items-center gap-1 text-center">
          <div className="flex w-full items-center">
            <span
              className={cn("h-px flex-1", index === 0 ? "bg-transparent" : "bg-border")}
              aria-hidden="true"
            />
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border",
                STAGE_STYLE[stage.state],
              )}
            >
              <StageIcon state={stage.state} />
            </span>
            <span
              className={cn("h-px flex-1", index === stages.length - 1 ? "bg-transparent" : "bg-border")}
              aria-hidden="true"
            />
          </div>
          <span
            className={cn(
              "text-[11px] leading-tight",
              stage.state === "idle" ? "text-muted-foreground" : "font-medium",
            )}
          >
            {stage.label}
          </span>
          {stage.hint ? (
            <span className="text-[10px] leading-tight text-muted-foreground">{stage.hint}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "text-primary"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-muted-foreground"
          : "";
  return (
    <div className="surface-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

/** Giden belgeler için özet sayaçlar. */
export function OutgoingSummary({ docs }: { docs: OutgoingDoc[] }) {
  const sent = docs.filter((doc) => doc.status === "sent").length;
  const queued = docs.filter((doc) => doc.status === "queued").length;
  const failed = docs.filter((doc) => doc.status === "failed").length;
  const reached = docs.filter((doc) => doc.ulasti_mi).length;
  const accepted = docs.filter((doc) => doc.yanit_durum === 2).length;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Metric label="Toplam belge" value={docs.length} />
      <Metric label="Gönderildi" value={sent} tone="positive" />
      <Metric label="Kuyrukta" value={queued} tone="warning" />
      <Metric label="Alıcıya ulaştı" value={reached} tone="positive" />
      <Metric label="Hatalı" value={failed} tone={failed > 0 ? "danger" : "default"} />
      <div className="col-span-2 sm:col-span-3 xl:col-span-5">
        <p className="text-xs text-muted-foreground">
          Kabul edilen yanıt sayısı: <span className="font-medium text-foreground">{accepted}</span>
        </p>
      </div>
    </div>
  );
}

/** Gelen faturalar için özet sayaçlar. */
export function InboxSummary({ rows }: { rows: InboxDoc[] }) {
  const total = rows.reduce((sum, row) => sum + Number(row.payable_amount ?? 0), 0);
  const currency = rows.find((row) => row.currency)?.currency ?? "TRY";
  const senders = new Set(rows.map((row) => row.sender_tax_id ?? row.sender_title ?? "")).size;
  const last = rows[0]?.arrived_at ?? rows[0]?.document_date ?? null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Metric label="Gelen fatura" value={rows.length} />
      <Metric
        label="Toplam tutar"
        value={`${total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${currency}`}
      />
      <Metric label="Tedarikçi" value={senders} />
      <Metric label="Son alım" value={last ? formatDateTime(last) : "—"} />
    </div>
  );
}

/** Belge durumuna göre renkli etiket. */
export function OutgoingStatusBadge({ doc }: { doc: OutgoingDoc }) {
  if (doc.status === "failed")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Hata
      </Badge>
    );
  if (doc.status === "sent")
    return (
      <Badge variant="secondary" className="gap-1">
        <Check className="size-3" /> Gönderildi
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="size-3" /> Kuyrukta
    </Badge>
  );
}

/** Gelen fatura satır ikonu. */
export function InboxIcon() {
  return <Inbox className="size-4 text-muted-foreground" />;
}
