import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2, PlugZap, RefreshCw, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/mefti";
import type { SendInput, SettingsInput } from "@/lib/einvoice-schemas";
import {
  checkEinvoiceRecipient,
  getEinvoiceOverview,
  queryEinvoiceStatus,
  saveEinvoiceSettings,
  sendEinvoiceDocument,
  testEinvoiceConnection,
} from "@/lib/einvoice.functions";

const DESCRIPTION =
  "QNB eSolutions Özel Entegratör web servisiyle bağlantıyı yönet ve platform faturalarını e-fatura olarak gönder.";

export const Route = createFileRoute("/_authenticated/admin/einvoice")({
  head: () => ({
    meta: [
      { title: "E-Fatura (QNB eSolutions) — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "E-Fatura (QNB eSolutions) — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEinvoicePage,
});

const emptySend: SendInput = {
  invoiceId: "",
  buyerTaxId: "",
  buyerTitle: "",
  buyerAddress: "",
  buyerCity: "",
  buyerEmail: "",
  profile: "AUTO",
};

function AdminEinvoicePage() {
  const queryClient = useQueryClient();
  const loadOverview = useServerFn(getEinvoiceOverview);
  const saveFn = useServerFn(saveEinvoiceSettings);
  const testFn = useServerFn(testEinvoiceConnection);
  const sendFn = useServerFn(sendEinvoiceDocument);
  const checkFn = useServerFn(checkEinvoiceRecipient);
  const statusFn = useServerFn(queryEinvoiceStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-einvoice"],
    queryFn: () => loadOverview({ data: undefined }),
  });

  const [form, setForm] = useState<SettingsInput | null>(null);
  const [send, setSend] = useState<SendInput>(emptySend);

  useEffect(() => {
    if (!data?.settings || form) return;
    const row = data.settings;
    setForm({
      environment: row.environment === "live" ? "live" : "test",
      authMode: row.auth_mode === "cookie" ? "cookie" : "wsse",
      loginUrl: row.login_url ?? "",
      serviceUrl: row.service_url ?? "",
      loginOperation: row.login_operation,
      sendOperation: row.send_operation,
      statusOperation: row.status_operation,
      serviceNamespace: row.service_namespace,
      loginNamespace: row.login_namespace,
      senderTaxId: row.sender_tax_id ?? "",
      senderTitle: row.sender_title ?? "",
      senderAddress: row.sender_address ?? "",
      senderCity: row.sender_city ?? "",
      senderCountry: row.sender_country,
      invoicePrefix: row.invoice_prefix,
      isEnabled: row.is_enabled,
      checkUserOperation: row.check_user_operation,
      listUsersOperation: row.list_users_operation,
      resendOperation: row.resend_operation,
    });
  }, [data, form]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-einvoice"] });

  const save = useMutation({
    mutationFn: (input: SettingsInput) => saveFn({ data: input }),
    onSuccess: async () => {
      toast.success("Ayarlar kaydedildi");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: undefined }),
    onSuccess: (result) => toast.success(result.detail),
    onError: (error: Error) => toast.error(error.message),
  });

  const dispatch = useMutation({
    mutationFn: (input: SendInput) => sendFn({ data: input }),
    onSuccess: async (result) => {
      toast.success(`Fatura gönderildi: ${result.documentNumber}`);
      setSend(emptySend);
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const lookup = useMutation({
    mutationFn: (taxId: string) => checkFn({ data: { taxId } }),
    onSuccess: (result) => {
      setSend((prev) => ({ ...prev, profile: result.profile }));
      toast.success(
        result.registered
          ? `Alıcı e-fatura mükellefi${result.alias ? ` (etiket: ${result.alias})` : ""} — e-Fatura olarak düzenlenecek`
          : "Alıcı e-fatura mükellefi değil — e-Arşiv fatura olarak düzenlenecek",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: (documentId: string) => statusFn({ data: { documentId } }),
    onSuccess: async (result) => {
      toast.success(result.detail || "Durum güncellendi");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const set = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <AdminShell title="E-Fatura (QNB eSolutions)" description={DESCRIPTION}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={data?.credentialsConfigured ? "secondary" : "destructive"}>
          {data?.credentialsConfigured ? "Kullanıcı bilgileri tanımlı" : "Kullanıcı adı/şifre eksik"}
        </Badge>
        <Badge variant="outline">
          Ortam: {form?.environment === "live" ? "Canlı" : "Test"}
        </Badge>
        <Badge variant={form?.isEnabled ? "secondary" : "outline"}>
          {form?.isEnabled ? "Entegrasyon açık" : "Entegrasyon kapalı"}
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={test.isPending || !data}
          onClick={() => test.mutate()}
        >
          <PlugZap className="mr-2 size-4" />
          {test.isPending ? "Test ediliyor…" : "Bağlantıyı test et"}
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Bağlantı ayarları</TabsTrigger>
          <TabsTrigger value="send">Fatura gönder</TabsTrigger>
          <TabsTrigger value="log">Gönderim kayıtları</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          {isLoading || !form ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <form
              className="surface-card grid gap-4 p-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid gap-2">
                <Label>Ortam</Label>
                <Select
                  value={form.environment}
                  onValueChange={(value) => set("environment", value as SettingsInput["environment"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Canlı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Kimlik doğrulama yöntemi</Label>
                <Select
                  value={form.authMode}
                  onValueChange={(value) => set("authMode", value as SettingsInput["authMode"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wsse">SOAP Header (UsernameToken)</SelectItem>
                    <SelectItem value="cookie">Oturum çerezi (wsLogin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Giriş servisi adresi</Label>
                <Input
                  value={form.loginUrl ?? ""}
                  placeholder="https://.../CSAPService"
                  onChange={(event) => set("loginUrl", event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Fatura servisi adresi</Label>
                <Input
                  value={form.serviceUrl ?? ""}
                  placeholder="https://.../ConnectorService"
                  onChange={(event) => set("serviceUrl", event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Giriş isim alanı (namespace)</Label>
                <Input value={form.loginNamespace} onChange={(e) => set("loginNamespace", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Servis isim alanı (namespace)</Label>
                <Input value={form.serviceNamespace} onChange={(e) => set("serviceNamespace", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Giriş operasyonu</Label>
                <Input value={form.loginOperation} onChange={(e) => set("loginOperation", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Gönderim operasyonu</Label>
                <Input value={form.sendOperation} onChange={(e) => set("sendOperation", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Durum sorgulama operasyonu</Label>
                <Input value={form.statusOperation} onChange={(e) => set("statusOperation", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Fatura seri kodu</Label>
                <Input value={form.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Mükellef sorgulama operasyonu</Label>
                <Input
                  value={form.checkUserOperation}
                  onChange={(e) => set("checkUserOperation", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tüm kullanıcı listesi operasyonu</Label>
                <Input
                  value={form.listUsersOperation}
                  onChange={(e) => set("listUsersOperation", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tekrar gönderim operasyonu</Label>
                <Input value={form.resendOperation} onChange={(e) => set("resendOperation", e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Gönderici vergi kimlik no</Label>
                <Input value={form.senderTaxId ?? ""} onChange={(e) => set("senderTaxId", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Gönderici unvan</Label>
                <Input value={form.senderTitle ?? ""} onChange={(e) => set("senderTitle", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Gönderici adres</Label>
                <Input value={form.senderAddress ?? ""} onChange={(e) => set("senderAddress", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Gönderici şehir</Label>
                <Input value={form.senderCity ?? ""} onChange={(e) => set("senderCity", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Ülke</Label>
                <Input value={form.senderCountry} onChange={(e) => set("senderCountry", e.target.value)} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Entegrasyon açık</p>
                  <p className="text-xs text-muted-foreground">
                    Kapalıyken fatura gönderimi engellenir.
                  </p>
                </div>
                <Switch checked={form.isEnabled} onCheckedChange={(value) => set("isEnabled", value)} />
              </div>

              <div className="md:col-span-2">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Kaydediliyor…" : "Ayarları kaydet"}
                </Button>
              </div>
            </form>
          )}
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <form
            className="surface-card grid gap-4 p-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!send.invoiceId) {
                toast.error("Fatura seçin");
                return;
              }
              dispatch.mutate(send);
            }}
          >
            <div className="grid gap-2 md:col-span-2">
              <Label>Fatura</Label>
              <Select
                value={send.invoiceId}
                onValueChange={(value) => setSend((prev) => ({ ...prev, invoiceId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Platform faturası seç" /></SelectTrigger>
                <SelectContent>
                  {invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} — {invoice.storeName} — {invoice.total} {invoice.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Belge tipi</Label>
              <Select
                value={send.profile}
                onValueChange={(value) => setSend((prev) => ({ ...prev, profile: value as SendInput["profile"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Otomatik (mükellefe göre seç)</SelectItem>
                  <SelectItem value="EARSIVFATURA">e-Arşiv fatura</SelectItem>
                  <SelectItem value="TEMELFATURA">e-Fatura (temel)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Alıcı VKN / TCKN</Label>
              <div className="flex gap-2">
                <Input
                  value={send.buyerTaxId}
                  inputMode="numeric"
                  onChange={(e) => setSend((prev) => ({ ...prev, buyerTaxId: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={lookup.isPending || !/^\d{10,11}$/.test(send.buyerTaxId)}
                  onClick={() => lookup.mutate(send.buyerTaxId)}
                >
                  <Search className="mr-2 size-4" />
                  {lookup.isPending ? "Sorgulanıyor…" : "Mükellef sorgula"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Alıcı e-fatura mükellefiyse belge e-Fatura, değilse e-Arşiv fatura olarak düzenlenir.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Alıcı unvan</Label>
              <Input
                value={send.buyerTitle}
                onChange={(e) => setSend((prev) => ({ ...prev, buyerTitle: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Alıcı e-posta</Label>
              <Input
                type="email"
                value={send.buyerEmail ?? ""}
                onChange={(e) => setSend((prev) => ({ ...prev, buyerEmail: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Alıcı adres</Label>
              <Input
                value={send.buyerAddress}
                onChange={(e) => setSend((prev) => ({ ...prev, buyerAddress: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Alıcı şehir</Label>
              <Input
                value={send.buyerCity}
                onChange={(e) => setSend((prev) => ({ ...prev, buyerCity: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={dispatch.isPending}>
                <Send className="mr-2 size-4" />
                {dispatch.isPending ? "Gönderiliyor…" : "E-faturayı gönder"}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <div className="surface-card divide-y overflow-hidden">
            {(data?.documents ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Henüz gönderim kaydı yok.</p>
            ) : (
              (data?.documents ?? []).map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <FileCheck2 className="size-4 text-muted-foreground" />
                  <span className="font-medium">{doc.document_number ?? "—"}</span>
                  <Badge
                    variant={
                      doc.status === "sent" ? "secondary" : doc.status === "failed" ? "destructive" : "outline"
                    }
                  >
                    {doc.status === "sent" ? "Gönderildi" : doc.status === "failed" ? "Hata" : "Kuyrukta"}
                  </Badge>
                  {doc.ulasti_mi ? <Badge variant="secondary">Alıcıya ulaştı</Badge> : null}
                  <span className="text-muted-foreground">{doc.environment}</span>
                  <span className="text-muted-foreground">{formatDateTime(doc.created_at)}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={status.isPending}
                    onClick={() => status.mutate(doc.id)}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Durum sorgula
                  </Button>
                  {doc.service_message ? (
                    <span className="w-full text-xs text-muted-foreground">{doc.service_message}</span>
                  ) : null}
                  {doc.error_message ? (
                    <span className="w-full text-xs text-destructive">{doc.error_message}</span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
