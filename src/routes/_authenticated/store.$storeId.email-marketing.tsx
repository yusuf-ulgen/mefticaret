import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Plus, RefreshCcw, Send, Trash2, Users, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { DesignEditor, type DesignDraft } from "@/components/email-marketing/design-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  FLOW_PRESETS,
  TEMPLATE_CAMPAIGNS,
  TEMPLATE_LIBRARY_SIZE,
  TEMPLATE_SECTORS,
  abWinner,
  buildTemplateLibrary,
  defaultBlock,
  filterTemplates,
  type EmailBlock,
} from "@/lib/email-marketing";
import {
  emailCampaignsQuery,
  emailDesignsQuery,
  emailSendsQuery,
  emailSubscribersQuery,
  metricsByCampaign,
} from "@/lib/email-marketing-queries";
import {
  deleteEmailCampaign,
  deleteEmailDesign,
  importSubscribers,
  previewEmailAudience,
  saveEmailCampaign,
  saveEmailDesign,
  seedEmailFlow,
  sendEmailCampaign,
  syncSubscribersToKlaviyo,
  setSubscriberStatus,
  syncCampaignRevenue,
} from "@/lib/email-marketing.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/email-marketing")({
  head: () => ({
    meta: [
      { title: "E-posta Pazarlama — Mefticaret" },
      {
        name: "description",
        content:
          "Sürükle-bırak e-posta editörü, 1.000+ hazır şablon, terk edilen sepet akışları, A/B testli kampanyalar ve açılma-tıklama-ciro analitiği.",
      },
      { property: "og:title", content: "E-posta Pazarlama — Mefticaret" },
      {
        property: "og:description",
        content: "Kampanya gönderimi, otomasyon akışları, şablon kütüphanesi ve kampanya analitiği tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmailMarketingPage,
});

const EMPTY_DESIGN: DesignDraft = {
  name: "Yeni e-posta",
  subject: "",
  previewText: "",
  accentColor: "#111111",
  blocks: [defaultBlock("header"), defaultBlock("text"), defaultBlock("button"), defaultBlock("footer")],
};

function EmailMarketingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: designs } = useQuery(emailDesignsQuery(storeId));
  const { data: campaignData } = useQuery(emailCampaignsQuery(storeId));
  const { data: sends } = useQuery(emailSendsQuery(storeId));
  const { data: subscribers } = useQuery(emailSubscribersQuery(storeId));

  const currency = store?.currency ?? "TRY";
  const storeName = store?.name ?? "Mağazanız";

  const saveDesign = useServerFn(saveEmailDesign);
  const removeDesign = useServerFn(deleteEmailDesign);
  const saveCampaign = useServerFn(saveEmailCampaign);
  const removeCampaign = useServerFn(deleteEmailCampaign);
  const sendCampaign = useServerFn(sendEmailCampaign);
  const previewAudience = useServerFn(previewEmailAudience);
  const syncRevenue = useServerFn(syncCampaignRevenue);
  const seedFlow = useServerFn(seedEmailFlow);
  const importList = useServerFn(importSubscribers);
  const setStatus = useServerFn(setSubscriberStatus);
  const klaviyoSyncFn = useServerFn(syncSubscribersToKlaviyo);
  const klaviyoSync = useMutation({
    mutationFn: () => klaviyoSyncFn({ data: { storeId } }),
    onSuccess: (r) => toast.success(`${r.count} abone Klaviyo listesine gönderildi`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Klaviyo aktarımı başarısız"),
  });

  const [draft, setDraft] = useState<DesignDraft>(EMPTY_DESIGN);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySector, setLibrarySector] = useState("all");
  const [libraryCampaign, setLibraryCampaign] = useState("all");

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    designId: "",
    subject: "",
    previewText: "",
    abEnabled: false,
    variantBSubject: "",
    ltvMin: "",
    ordersMin: "",
    inactiveOverDays: "",
    tag: "",
    includeSubscribers: true,
    storefrontEnabled: false,
    slug: "",
    bannerHeadline: "",
    bannerBody: "",
    bannerCtaLabel: "",
    landingHeadline: "",
    landingBody: "",
    discountCode: "",
    endsAt: "",
  });

  const [testEmail, setTestEmail] = useState("");
  const [audienceInfo, setAudienceInfo] = useState<{ total: number; customers: number; subscribers: number } | null>(null);
  const [importRaw, setImportRaw] = useState("");

  const library = useMemo(() => buildTemplateLibrary(), []);
  const visibleTemplates = useMemo(
    () => filterTemplates(library, { search: librarySearch, sector: librarySector, campaign: libraryCampaign }).slice(0, 60),
    [library, librarySearch, librarySector, libraryCampaign],
  );

  const campaigns = campaignData?.campaigns ?? [];
  const variants = campaignData?.variants ?? [];
  const metrics = useMemo(() => metricsByCampaign(sends ?? []), [sends]);

  const totals = useMemo(() => {
    const all = [...metrics.values()];
    return {
      sent: all.reduce((sum, item) => sum + item.delivered, 0),
      opens: all.reduce((sum, item) => sum + item.opens, 0),
      clicks: all.reduce((sum, item) => sum + item.clicks, 0),
      revenue: all.reduce((sum, item) => sum + item.revenue, 0),
      unsubscribes: all.reduce((sum, item) => sum + item.unsubscribes, 0),
    };
  }, [metrics]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["email-designs", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["email-campaigns", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["email-sends", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["email-subscribers", storeId] }),
    ]);
  };

  const designMutation = useMutation({
    mutationFn: () =>
      saveDesign({
        data: {
          storeId,
          ...(editingDesignId ? { designId: editingDesignId } : {}),
          name: draft.name,
          subject: draft.subject,
          previewText: draft.previewText,
          accentColor: draft.accentColor,
          blocks: draft.blocks,
        },
      }),
    onSuccess: async (row) => {
      setEditingDesignId(row.id);
      toast.success("Tasarım kaydedildi");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Tasarım kaydedilemedi"),
  });

  const campaignMutation = useMutation({
    mutationFn: () =>
      saveCampaign({
        data: {
          storeId,
          name: campaignForm.name,
          designId: campaignForm.designId || null,
          subject: campaignForm.subject,
          previewText: campaignForm.previewText,
          abEnabled: campaignForm.abEnabled,
          audience: {
            includeSubscribers: campaignForm.includeSubscribers,
            ...(campaignForm.ltvMin ? { ltvMin: Number(campaignForm.ltvMin) } : {}),
            ...(campaignForm.ordersMin ? { ordersMin: Number(campaignForm.ordersMin) } : {}),
            ...(campaignForm.inactiveOverDays ? { inactiveOverDays: Number(campaignForm.inactiveOverDays) } : {}),
            ...(campaignForm.tag ? { tag: campaignForm.tag } : {}),
          },
          variants: campaignForm.abEnabled
            ? [
                { label: "A", subject: campaignForm.subject, previewText: campaignForm.previewText, weight: 50 },
                { label: "B", subject: campaignForm.variantBSubject || campaignForm.subject, previewText: campaignForm.previewText, weight: 50 },
              ]
            : [],
          storefrontEnabled: campaignForm.storefrontEnabled,
          slug: campaignForm.slug.trim().toLowerCase(),
          bannerHeadline: campaignForm.bannerHeadline,
          bannerBody: campaignForm.bannerBody,
          bannerCtaLabel: campaignForm.bannerCtaLabel,
          landingHeadline: campaignForm.landingHeadline,
          landingBody: campaignForm.landingBody,
          discountCode: campaignForm.discountCode.trim().toUpperCase(),
          endsAt: campaignForm.endsAt ? new Date(campaignForm.endsAt).toISOString() : null,
        },
      }),

    onSuccess: async () => {
      toast.success("Kampanya kaydedildi");
      setCampaignForm((current) => ({ ...current, name: "" }));
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kampanya kaydedilemedi"),
  });

  const audienceMutation = useMutation({
    mutationFn: () =>
      previewAudience({
        data: {
          storeId,
          audience: {
            includeSubscribers: campaignForm.includeSubscribers,
            ...(campaignForm.ltvMin ? { ltvMin: Number(campaignForm.ltvMin) } : {}),
            ...(campaignForm.ordersMin ? { ordersMin: Number(campaignForm.ordersMin) } : {}),
            ...(campaignForm.inactiveOverDays ? { inactiveOverDays: Number(campaignForm.inactiveOverDays) } : {}),
            ...(campaignForm.tag ? { tag: campaignForm.tag } : {}),
          },
        },
      }),
    onSuccess: (result) => {
      setAudienceInfo(result);
      toast.success(`${result.total} izinli alıcı bulundu`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Hedef kitle hesaplanamadı"),
  });

  const sendMutation = useMutation({
    mutationFn: (input: { campaignId: string; test?: string }) =>
      sendCampaign({
        data: { storeId, campaignId: input.campaignId, ...(input.test ? { testEmail: input.test } : {}) },
      }),
    onSuccess: async (result) => {
      toast.success(
        result.test
          ? "Test e-postası gönderildi"
          : result.via === "klaviyo"
            ? "Kampanya Klaviyo üzerinden gönderime alındı"
          : `${result.sent} gönderim tamamlandı${result.failed > 0 ? `, ${result.failed} başarısız` : ""}`,
      );
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gönderim yapılamadı"),
  });

  const revenueMutation = useMutation({
    mutationFn: (campaignId: string) => syncRevenue({ data: { storeId, campaignId } }),
    onSuccess: async (result) => {
      toast.success(`İlişkilendirilen ciro: ${formatMoney(result.attributedRevenue, currency)}`);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ciro eşleştirilemedi"),
  });

  const flowMutation = useMutation({
    mutationFn: (presetId: string) => seedFlow({ data: { storeId, presetId } }),
    onSuccess: (result) => toast.success(`${result.name} akışı taslak olarak kuruldu (${result.steps} adım)`),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Akış kurulamadı"),
  });

  const importMutation = useMutation({
    mutationFn: () => importList({ data: { storeId, raw: importRaw, tags: [] } }),
    onSuccess: async (result) => {
      toast.success(`${result.imported} abone eklendi`);
      setImportRaw("");
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Liste aktarılamadı"),
  });

  return (
    <AppShell storeId={storeId} title="E-posta Pazarlama">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">E-posta pazarlama</h1>
            <p className="text-sm text-muted-foreground">
              Sürükle-bırak editör, {TEMPLATE_LIBRARY_SIZE.toLocaleString("tr-TR")} hazır şablon, otomatik akışlar, A/B test ve gerçek gönderim analitiği.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/store/$storeId/automations" params={{ storeId }}>
              <Zap className="mr-2 size-4" /> Akış tuvaline git
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Teslim edilen" value={totals.sent.toLocaleString("tr-TR")} />
          <StatCard label="Açılma" value={totals.opens.toLocaleString("tr-TR")} />
          <StatCard label="Tıklama" value={totals.clicks.toLocaleString("tr-TR")} />
          <StatCard label="Kampanya cirosu" value={formatMoney(totals.revenue, currency)} />
          <StatCard label="Abonelik iptali" value={totals.unsubscribes.toLocaleString("tr-TR")} />
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList className="flex-wrap">
            <TabsTrigger value="campaigns">Kampanyalar</TabsTrigger>
            <TabsTrigger value="editor">E-posta editörü</TabsTrigger>
            <TabsTrigger value="library">Şablon kütüphanesi</TabsTrigger>
            <TabsTrigger value="flows">Hazır akışlar</TabsTrigger>
            <TabsTrigger value="subscribers">Aboneler</TabsTrigger>
          </TabsList>

          {/* ---------------------------------------------------- kampanyalar */}
          <TabsContent value="campaigns" className="space-y-4 pt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Yeni kampanya</p>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-name">Kampanya adı</Label>
                  <Input id="campaign-name" value={campaignForm.name} onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-design">E-posta tasarımı</Label>
                  <Select value={campaignForm.designId} onValueChange={(value) => setCampaignForm((current) => ({ ...current, designId: value }))}>
                    <SelectTrigger id="campaign-design" className="h-9">
                      <SelectValue placeholder="Tasarım seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(designs ?? []).map((design) => (
                        <SelectItem key={design.id} value={design.id}>
                          {design.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-subject">Konu başlığı</Label>
                  <Input id="campaign-subject" value={campaignForm.subject} onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-preview">Ön izleme metni</Label>
                  <Input id="campaign-preview" value={campaignForm.previewText} onChange={(event) => setCampaignForm((current) => ({ ...current, previewText: event.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">A/B testi</p>
                    <p className="text-xs text-muted-foreground">Alıcılar iki konu başlığına eşit bölünür.</p>
                  </div>
                  <Switch checked={campaignForm.abEnabled} onCheckedChange={(checked) => setCampaignForm((current) => ({ ...current, abEnabled: checked }))} />
                </div>
                {campaignForm.abEnabled ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-variant-b">B varyantı konu başlığı</Label>
                    <Input id="campaign-variant-b" value={campaignForm.variantBSubject} onChange={(event) => setCampaignForm((current) => ({ ...current, variantBSubject: event.target.value }))} />
                  </div>
                ) : null}

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Vitrinde göster</p>
                      <p className="text-xs text-muted-foreground">
                        Mağaza vitrininin üstünde kampanya bandı ve ayrı kampanya sayfası yayınlanır.
                      </p>
                    </div>
                    <Switch
                      checked={campaignForm.storefrontEnabled}
                      onCheckedChange={(checked) =>
                        setCampaignForm((current) => ({ ...current, storefrontEnabled: checked }))
                      }
                    />
                  </div>
                  {campaignForm.storefrontEnabled ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-slug">Kampanya adresi</Label>
                        <Input
                          id="campaign-slug"
                          placeholder="yaz-indirimi"
                          value={campaignForm.slug}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, slug: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-code">İndirim kodu</Label>
                        <Input
                          id="campaign-code"
                          placeholder="YAZ20"
                          value={campaignForm.discountCode}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, discountCode: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-banner-headline">Bant başlığı</Label>
                        <Input
                          id="campaign-banner-headline"
                          value={campaignForm.bannerHeadline}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, bannerHeadline: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-banner-body">Bant açıklaması</Label>
                        <Input
                          id="campaign-banner-body"
                          value={campaignForm.bannerBody}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, bannerBody: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-cta">Buton yazısı</Label>
                        <Input
                          id="campaign-cta"
                          placeholder="Kampanyayı gör"
                          value={campaignForm.bannerCtaLabel}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, bannerCtaLabel: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="campaign-ends">Bitiş tarihi</Label>
                        <Input
                          id="campaign-ends"
                          type="datetime-local"
                          value={campaignForm.endsAt}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, endsAt: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="campaign-landing-headline">Kampanya sayfası başlığı</Label>
                        <Input
                          id="campaign-landing-headline"
                          value={campaignForm.landingHeadline}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, landingHeadline: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="campaign-landing-body">Kampanya sayfası metni</Label>
                        <Textarea
                          id="campaign-landing-body"
                          rows={4}
                          value={campaignForm.landingBody}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, landingBody: event.target.value }))}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>



                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hedef kitle</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="audience-ltv">Min. harcama</Label>
                      <Input id="audience-ltv" inputMode="numeric" value={campaignForm.ltvMin} onChange={(event) => setCampaignForm((current) => ({ ...current, ltvMin: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="audience-orders">Min. sipariş</Label>
                      <Input id="audience-orders" inputMode="numeric" value={campaignForm.ordersMin} onChange={(event) => setCampaignForm((current) => ({ ...current, ordersMin: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="audience-inactive">X günden uzun sessiz</Label>
                      <Input id="audience-inactive" inputMode="numeric" value={campaignForm.inactiveOverDays} onChange={(event) => setCampaignForm((current) => ({ ...current, inactiveOverDays: event.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="audience-tag">Etiket</Label>
                      <Input id="audience-tag" value={campaignForm.tag} onChange={(event) => setCampaignForm((current) => ({ ...current, tag: event.target.value }))} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="audience-subscribers" className="text-sm">E-bülten abonelerini dahil et</Label>
                    <Switch id="audience-subscribers" checked={campaignForm.includeSubscribers} onCheckedChange={(checked) => setCampaignForm((current) => ({ ...current, includeSubscribers: checked }))} />
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => audienceMutation.mutate()} disabled={audienceMutation.isPending}>
                    <Users className="mr-2 size-4" /> Alıcı sayısını hesapla
                  </Button>
                  {audienceInfo ? (
                    <p className="text-xs text-muted-foreground">
                      {audienceInfo.total} alıcı ({audienceInfo.customers} müşteri, {audienceInfo.subscribers} abone)
                    </p>
                  ) : null}
                </div>

                <Button className="w-full" onClick={() => campaignMutation.mutate()} disabled={campaignMutation.isPending || campaignForm.name.trim().length < 2}>
                  <Plus className="mr-2 size-4" /> Kampanyayı kaydet
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="test-email">Test adresi</Label>
                    <Input id="test-email" type="email" placeholder="siz@ornek.com" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
                  </div>
                </div>

                {campaigns.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Henüz kampanya yok. Soldaki formla ilk kampanyanızı oluşturun.
                  </p>
                ) : null}

                {campaigns.map((campaign) => {
                  const stats = metrics.get(campaign.id);
                  const campaignVariants = variants.filter((variant) => variant.campaign_id === campaign.id);
                  const winner = abWinner(
                    campaignVariants.map((variant) => ({
                      id: variant.id,
                      label: variant.label,
                      sent: variant.sent_count,
                      opens: variant.open_count,
                      clicks: variant.click_count,
                      revenue: Number(variant.revenue),
                    })),
                  );
                  return (
                    <div key={campaign.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.subject || "Konu başlığı yok"} ·{" "}
                            {campaign.sent_at ? formatDateTime(campaign.sent_at) : "henüz gönderilmedi"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>{statusLabel(campaign.status)}</Badge>
                          {campaign.ab_enabled ? <Badge variant="outline">A/B</Badge> : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <Metric label="Teslim" value={(stats?.delivered ?? 0).toLocaleString("tr-TR")} />
                        <Metric label="Açılma" value={`${stats?.openRate ?? 0}%`} />
                        <Metric label="Tıklama" value={`${stats?.clickRate ?? 0}%`} />
                        <Metric label="Ciro" value={formatMoney(stats?.revenue ?? 0, currency)} />
                      </div>

                      {campaignVariants.length > 0 ? (
                        <div className="rounded-lg border border-border p-3 text-sm">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">A/B sonuçları</p>
                          {campaignVariants.map((variant) => (
                            <div key={variant.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-1 last:border-0">
                              <span className="font-medium">{variant.label}</span>
                              <span className="text-muted-foreground">{variant.subject || "—"}</span>
                              <span>
                                {variant.sent_count} gönderim · {variant.open_count} açılma · {variant.click_count} tıklama ·{" "}
                                {formatMoney(Number(variant.revenue), currency)}
                              </span>
                            </div>
                          ))}
                          {winner ? (
                            <p className="mt-2 text-xs text-success">
                              Kazanan varyant {winner.winner.label}
                              {winner.lift !== 0 ? ` (%${Math.abs(winner.lift)} fark)` : ""}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => sendMutation.mutate({ campaignId: campaign.id })} disabled={sendMutation.isPending}>
                          <Send className="mr-2 size-4" /> Gönder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!testEmail.trim()) {
                              toast.error("Önce test adresi girin");
                              return;
                            }
                            sendMutation.mutate({ campaignId: campaign.id, test: testEmail.trim() });
                          }}
                          disabled={sendMutation.isPending}
                        >
                          <Mail className="mr-2 size-4" /> Test gönder
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => revenueMutation.mutate(campaign.id)} disabled={revenueMutation.isPending}>
                          <RefreshCcw className="mr-2 size-4" /> Ciroyu eşleştir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await removeCampaign({ data: { storeId, campaignId: campaign.id } });
                            toast.success("Kampanya silindi");
                            await invalidate();
                          }}
                        >
                          <Trash2 className="mr-2 size-4" /> Sil
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------- editör */}
          <TabsContent value="editor" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => designMutation.mutate()} disabled={designMutation.isPending}>
                {editingDesignId ? "Tasarımı güncelle" : "Tasarımı kaydet"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY_DESIGN);
                  setEditingDesignId(null);
                }}
              >
                Yeni tasarım
              </Button>
              <Select
                value={editingDesignId ?? ""}
                onValueChange={(value) => {
                  const design = (designs ?? []).find((item) => item.id === value);
                  if (!design) return;
                  setEditingDesignId(design.id);
                  setDraft({
                    name: design.name,
                    subject: design.subject,
                    previewText: design.preview_text,
                    accentColor: design.accent_color,
                    blocks: (design.blocks ?? []) as unknown as EmailBlock[],
                  });
                }}
              >
                <SelectTrigger className="h-9 w-[240px]" aria-label="Kayıtlı tasarım">
                  <SelectValue placeholder="Kayıtlı tasarımı aç" />
                </SelectTrigger>
                <SelectContent>
                  {(designs ?? []).map((design) => (
                    <SelectItem key={design.id} value={design.id}>
                      {design.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingDesignId ? (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await removeDesign({ data: { storeId, designId: editingDesignId } });
                    setEditingDesignId(null);
                    setDraft(EMPTY_DESIGN);
                    toast.success("Tasarım silindi");
                    await invalidate();
                  }}
                >
                  <Trash2 className="mr-2 size-4" /> Sil
                </Button>
              ) : null}
            </div>
            <DesignEditor value={draft} onChange={setDraft} storeName={storeName} />
          </TabsContent>

          {/* -------------------------------------------------- kütüphane */}
          <TabsContent value="library" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Input className="max-w-[260px]" placeholder="Şablon ara" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} />
              <Select value={librarySector} onValueChange={setLibrarySector}>
                <SelectTrigger className="h-9 w-[200px]" aria-label="Sektör">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm sektörler</SelectItem>
                  {TEMPLATE_SECTORS.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      {sector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={libraryCampaign} onValueChange={setLibraryCampaign}>
                <SelectTrigger className="h-9 w-[200px]" aria-label="Kampanya türü">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm kampanyalar</SelectItem>
                  {TEMPLATE_CAMPAIGNS.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTemplates.map((template) => (
                <div key={template.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <div className="h-2 w-16 rounded-full" style={{ background: template.accent }} />
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.subject}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDesignId(null);
                      setDraft({
                        name: template.name,
                        subject: template.subject,
                        previewText: template.previewText,
                        accentColor: template.accent,
                        blocks: template.blocks.map((block, index) => ({ ...block, id: `${block.kind}-${index}` })),
                      });
                      toast.success("Şablon editöre yüklendi");
                    }}
                  >
                    Bu şablonu kullan
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ---------------------------------------------------- akışlar */}
          <TabsContent value="flows" className="space-y-3 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FLOW_PRESETS.map((preset) => (
                <div key={preset.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {preset.steps.map((step, index) => (
                      <li key={`${preset.id}-${index}`}>
                        {index + 1}. {step.title}
                      </li>
                    ))}
                  </ol>
                  <Button size="sm" onClick={() => flowMutation.mutate(preset.id)} disabled={flowMutation.isPending}>
                    <Zap className="mr-2 size-4" /> Akışı kur
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Akışlar taslak olarak kurulur; tuvalde düzenleyip aktifleştirebilirsiniz.
            </p>
          </TabsContent>

          {/* --------------------------------------------------- aboneler */}
          <TabsContent value="subscribers" className="space-y-4 pt-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Liste aktar</p>
                <Textarea
                  rows={8}
                  placeholder={"ornek@mail.com, Ayşe Yılmaz\ndiger@mail.com"}
                  value={importRaw}
                  onChange={(event) => setImportRaw(event.target.value)}
                />
                <Button className="w-full" onClick={() => importMutation.mutate()} disabled={importMutation.isPending || importRaw.trim().length < 3}>
                  <Plus className="mr-2 size-4" /> Aboneleri ekle
                </Button>
                <Button variant="outline" className="w-full" onClick={() => klaviyoSync.mutate()} disabled={klaviyoSync.isPending}>
                  Aboneleri Klaviyo'ya aktar
                </Button>
              </div>
              <div className="rounded-xl border border-border bg-card">
                {(subscribers ?? []).length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">Henüz e-bülten abonesi yok.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(subscribers ?? []).map((subscriber) => (
                      <li key={subscriber.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{subscriber.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {subscriber.full_name || "—"} · {subscriber.source} · {formatDateTime(subscriber.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={subscriber.status === "subscribed" ? "default" : "secondary"}>
                            {subscriber.status === "subscribed" ? "Abone" : "Çıktı"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await setStatus({
                                data: {
                                  storeId,
                                  subscriberId: subscriber.id,
                                  status: subscriber.status === "subscribed" ? "unsubscribed" : "subscribed",
                                },
                              });
                              await invalidate();
                            }}
                          >
                            {subscriber.status === "subscribed" ? "Çıkar" : "Geri al"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function statusLabel(status: string) {
  if (status === "sent") return "Gönderildi";
  if (status === "sending") return "Gönderiliyor";
  if (status === "failed") return "Başarısız";
  return "Taslak";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
