import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  consentRecordsQuery,
  dataRequestsQuery,
  processingRecordsQuery,
  securityEventsQuery,
} from "@/lib/compliance-queries";
import {
  deleteProcessingRecordFn,
  eraseCustomerDataFn,
  exportCustomerDataFn,
  saveProcessingRecordFn,
  updateDataRequestFn,
} from "@/lib/compliance.functions";
import { formatDateTime } from "@/lib/mefti";
import {
  CONSENT_TYPE_LABELS,
  DSR_KIND_LABELS,
  DSR_STATUSES,
  DSR_STATUS_LABELS,
  LEGAL_BASES,
  LEGAL_BASIS_LABELS,
  type ConsentType,
  type DsrKind,
  type DsrStatus,
  type LegalBasis,
} from "@/lib/security";
import { storeAuditQuery, storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/security")({
  head: () => ({
    meta: [
      { title: "Güvenlik & KVKK — Mefticaret" },
      {
        name: "description",
        content:
          "İki adımlı doğrulama, güvenlik olayları, denetim kayıtları, açık rıza kayıtları ve KVKK/GDPR veri talepleri.",
      },
      { property: "og:title", content: "Güvenlik & KVKK — Mefticaret" },
      {
        property: "og:description",
        content: "Mağazan için güvenlik sertleştirmesi ve KVKK/GDPR uyum merkezi.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));

  return (
    <AppShell
      storeId={storeId}
      title="Güvenlik & KVKK"
      description={`${store?.name ?? "Mağaza"} · güvenlik sertleştirmesi, denetim kayıtları ve veri uyumluluğu`}
    >
      <Tabs defaultValue="posture" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="posture">Güvenlik durumu</TabsTrigger>
          <TabsTrigger value="events">Olaylar & denetim</TabsTrigger>
          <TabsTrigger value="consents">Rıza kayıtları</TabsTrigger>
          <TabsTrigger value="ropa">Veri işleme envanteri</TabsTrigger>
          <TabsTrigger value="requests">Veri talepleri</TabsTrigger>
        </TabsList>

        <TabsContent value="posture" className="space-y-4">
          <PostureGrid />
          <TwoFactorSettings />
          <CustomerDataTools storeId={storeId} />
        </TabsContent>

        <TabsContent value="events">
          <EventsPanel storeId={storeId} />
        </TabsContent>

        <TabsContent value="consents">
          <ConsentPanel storeId={storeId} />
        </TabsContent>

        <TabsContent value="ropa">
          <RopaPanel storeId={storeId} />
        </TabsContent>

        <TabsContent value="requests">
          <RequestsPanel storeId={storeId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

const POSTURE: { label: string; detail: string }[] = [
  { label: "HTTPS / HSTS", detail: "Tüm yanıtlarda 2 yıllık HSTS ve upgrade-insecure-requests." },
  { label: "CSRF", detail: "Sunucu fonksiyonlarında origin doğrulamalı CSRF koruması." },
  { label: "XSS", detail: "İçerik güvenlik politikası, nosniff ve React kaçışlaması." },
  { label: "SQL Injection", detail: "Tüm sorgular parametrik PostgREST çağrılarıyla yapılır." },
  { label: "Hız sınırı", detail: "API, form ve veri talepleri için veritabanı destekli sayaçlar." },
  { label: "Güvenli çerez", detail: "Oturum çerezleri Secure + HttpOnly + SameSite ile üretilir." },
  { label: "Parola hash", detail: "Parolalar bcrypt ile kimlik servisinde saklanır." },
  { label: "Oturum yönetimi", detail: "Kısa ömürlü erişim tokenı + rotasyonlu yenileme tokenı." },
  { label: "RBAC", detail: "Platform ve mağaza rolleri ayrı tablolarda, güvenlik fonksiyonlarıyla." },
  { label: "Tenant izolasyonu", detail: "Her tabloda store_id kapsamlı RLS politikaları." },
  { label: "Audit log", detail: "Yönetim işlemleri audit_logs tablosunda saklanır." },
  { label: "API kimlik doğrulama", detail: "Hash'lenmiş, scope tabanlı API anahtarları." },
  { label: "Webhook imzası", detail: "HMAC-SHA256 imza ve tekrar denemeli kuyruk." },
];

function PostureGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {POSTURE.map((item) => (
        <div key={item.label} className="surface-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function EventsPanel({ storeId }: { storeId: string }) {
  const { data: events } = useQuery(securityEventsQuery(storeId));
  const { data: audit } = useQuery(storeAuditQuery(storeId));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold">Güvenlik olayları</h3>
        <div className="mt-3 space-y-2">
          {(events ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Kayıt yok.</p>
          ) : (
            (events ?? []).map((event) => (
              <div key={event.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.kind}</span>
                  <Badge variant={event.severity === "critical" ? "destructive" : "secondary"}>
                    {event.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatDateTime(event.created_at)} · {event.ip ?? "ip yok"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold">Denetim kayıtları</h3>
        <div className="mt-3 space-y-2">
          {(audit ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Kayıt yok.</p>
          ) : (
            (audit ?? []).map((row) => (
              <div key={row.id} className="rounded-lg border border-border p-3 text-xs">
                <span className="font-medium">{row.action}</span>
                <p className="mt-1 text-muted-foreground">
                  {formatDateTime(row.created_at)} · {row.entity ?? "-"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ConsentPanel({ storeId }: { storeId: string }) {
  const { data } = useQuery(consentRecordsQuery(storeId));
  const rows = data ?? [];

  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Açık rıza kayıtları</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Çerez ve pazarlama izinleri, politika sürümü ve teknik iz bilgisiyle birlikte saklanır.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2">Tarih</th>
              <th className="py-2">Tür</th>
              <th className="py-2">Durum</th>
              <th className="py-2">Kaynak</th>
              <th className="py-2">Sürüm</th>
              <th className="py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-muted-foreground">
                  Henüz rıza kaydı yok.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2">{formatDateTime(row.created_at)}</td>
                  <td className="py-2">
                    {CONSENT_TYPE_LABELS[row.consent_type as ConsentType] ?? row.consent_type}
                  </td>
                  <td className="py-2">
                    <Badge variant={row.granted ? "secondary" : "outline"}>
                      {row.granted ? "Verildi" : "Reddedildi"}
                    </Badge>
                  </td>
                  <td className="py-2">{row.source}</td>
                  <td className="py-2">{row.policy_version}</td>
                  <td className="py-2">{row.ip ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_ROPA = {
  activity: "",
  purpose: "",
  legalBasis: "consent" as LegalBasis,
  dataCategories: "",
  dataSubjects: "",
  recipients: "",
  retentionPeriod: "",
  crossBorderTransfer: false,
  transferDetails: "",
  securityMeasures: "",
  responsiblePerson: "",
};

function RopaPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(processingRecordsQuery(storeId));
  const [form, setForm] = useState(EMPTY_ROPA);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["store", storeId, "processing-records"] });

  const save = useMutation({
    mutationFn: () =>
      saveProcessingRecordFn({
        data: {
          storeId,
          activity: form.activity.trim(),
          purpose: form.purpose.trim(),
          legalBasis: form.legalBasis,
          dataCategories: splitList(form.dataCategories),
          dataSubjects: splitList(form.dataSubjects),
          recipients: splitList(form.recipients),
          crossBorderTransfer: form.crossBorderTransfer,
          ...(form.retentionPeriod.trim() ? { retentionPeriod: form.retentionPeriod.trim() } : {}),
          ...(form.transferDetails.trim() ? { transferDetails: form.transferDetails.trim() } : {}),
          ...(form.securityMeasures.trim() ? { securityMeasures: form.securityMeasures.trim() } : {}),
          ...(form.responsiblePerson.trim() ? { responsiblePerson: form.responsiblePerson.trim() } : {}),
        },
      }),
    onSuccess: async () => {
      toast.success("Veri işleme kaydı eklendi");
      setForm(EMPTY_ROPA);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteProcessingRecordFn({ data: { storeId, id } }),
    onSuccess: async () => {
      toast.success("Kayıt silindi");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
      <form
        className="surface-card space-y-3 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="text-sm font-semibold">Yeni işleme faaliyeti</h3>
        <div className="space-y-2">
          <Label htmlFor="ropa-activity">Faaliyet</Label>
          <Input
            id="ropa-activity"
            required
            value={form.activity}
            onChange={(event) => setForm({ ...form, activity: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-purpose">Amaç</Label>
          <Textarea
            id="ropa-purpose"
            required
            value={form.purpose}
            onChange={(event) => setForm({ ...form, purpose: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-basis">Hukuki dayanak</Label>
          <select
            id="ropa-basis"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.legalBasis}
            onChange={(event) => setForm({ ...form, legalBasis: event.target.value as LegalBasis })}
          >
            {LEGAL_BASES.map((basis) => (
              <option key={basis} value={basis}>
                {LEGAL_BASIS_LABELS[basis]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-categories">Veri kategorileri (virgülle)</Label>
          <Input
            id="ropa-categories"
            value={form.dataCategories}
            onChange={(event) => setForm({ ...form, dataCategories: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-subjects">Veri sahipleri (virgülle)</Label>
          <Input
            id="ropa-subjects"
            value={form.dataSubjects}
            onChange={(event) => setForm({ ...form, dataSubjects: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-recipients">Alıcılar (virgülle)</Label>
          <Input
            id="ropa-recipients"
            value={form.recipients}
            onChange={(event) => setForm({ ...form, recipients: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-retention">Saklama süresi</Label>
          <Input
            id="ropa-retention"
            value={form.retentionPeriod}
            onChange={(event) => setForm({ ...form, retentionPeriod: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-xs">Yurt dışına aktarım var</span>
          <Switch
            checked={form.crossBorderTransfer}
            onCheckedChange={(checked) => setForm({ ...form, crossBorderTransfer: checked })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-measures">Teknik ve idari tedbirler</Label>
          <Textarea
            id="ropa-measures"
            value={form.securityMeasures}
            onChange={(event) => setForm({ ...form, securityMeasures: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ropa-responsible">Sorumlu kişi</Label>
          <Input
            id="ropa-responsible"
            value={form.responsiblePerson}
            onChange={(event) => setForm({ ...form, responsiblePerson: event.target.value })}
          />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Kaydediliyor..." : "Kaydı ekle"}
        </Button>
      </form>

      <div className="space-y-3">
        {(data ?? []).length === 0 ? (
          <p className="surface-card p-5 text-xs text-muted-foreground">
            Henüz veri işleme envanteri kaydı yok.
          </p>
        ) : (
          (data ?? []).map((row) => (
            <div key={row.id} className="surface-card space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{row.activity}</p>
                  <p className="text-xs text-muted-foreground">{row.purpose}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Kaydı sil"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  {LEGAL_BASIS_LABELS[row.legal_basis as LegalBasis] ?? row.legal_basis}
                </Badge>
                {row.cross_border_transfer ? <Badge variant="outline">Yurt dışı aktarım</Badge> : null}
                {row.retention_period ? <Badge variant="outline">{row.retention_period}</Badge> : null}
              </div>
              {row.data_categories.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Veri kategorileri: {row.data_categories.join(", ")}
                </p>
              ) : null}
              {row.recipients.length > 0 ? (
                <p className="text-xs text-muted-foreground">Alıcılar: {row.recipients.join(", ")}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RequestsPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(dataRequestsQuery(storeId));

  const update = useMutation({
    mutationFn: (input: { id: string; status: DsrStatus }) =>
      updateDataRequestFn({ data: { storeId, ...input } }),
    onSuccess: async () => {
      toast.success("Talep güncellendi");
      await queryClient.invalidateQueries({ queryKey: ["store", storeId, "data-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">Veri sahibi talepleri</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        KVKK m.11 / GDPR Art. 15-17 başvuruları 30 gün içinde yanıtlanmalıdır.
      </p>
      <div className="mt-4 space-y-3">
        {(data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Bekleyen talep yok.</p>
        ) : (
          (data ?? []).map((row) => (
            <div key={row.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {DSR_KIND_LABELS[row.kind as DsrKind] ?? row.kind} · {row.subject_email}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</p>
                </div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={row.status}
                  onChange={(event) =>
                    update.mutate({ id: row.id, status: event.target.value as DsrStatus })
                  }
                >
                  {DSR_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {DSR_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              {row.reason ? <p className="mt-2 text-xs text-muted-foreground">{row.reason}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CustomerDataTools({ storeId }: { storeId: string }) {
  const [customerId, setCustomerId] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const payload = await exportCustomerDataFn({ data: { storeId, customerId: customerId.trim() } });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `musteri-verisi-${customerId.trim()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Veri dışa aktarıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Dışa aktarma başarısız");
    }
    setBusy(false);
  }

  async function handleErase() {
    if (!window.confirm("Müşterinin kişisel verileri anonimleştirilecek. Onaylıyor musun?")) return;
    setBusy(true);
    try {
      await eraseCustomerDataFn({ data: { storeId, customerId: customerId.trim() } });
      toast.success("Müşteri verisi silindi/anonimleştirildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silme başarısız");
    }
    setBusy(false);
  }

  return (
    <div className="surface-card space-y-3 p-5">
      <div>
        <h3 className="text-sm font-semibold">Müşteri verisi dışa aktarma & silme</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sipariş kayıtları vergi mevzuatı gereği saklanır; kimlik bilgileri anonimleştirilir.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="customer-id">Müşteri kimliği (UUID)</Label>
        <Input
          id="customer-id"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy || !customerId.trim()} onClick={() => void handleExport()}>
          <Download className="mr-2 size-4" /> Verileri indir
        </Button>
        <Button size="sm" variant="destructive" disabled={busy || !customerId.trim()} onClick={() => void handleErase()}>
          <Trash2 className="mr-2 size-4" /> Verileri sil
        </Button>
      </div>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}
