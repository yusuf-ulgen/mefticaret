/**
 * Politika Yönetimi — mağaza ve platform için ortak ekran.
 * Taslak düzenleme, yer tutucu değerleri, yayınlama (sürüm), geçmiş, onay kayıtları ve çerez bandı.
 * Metinler şablon/taslaktır; hukuki danışmanlık yerine geçmez.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, History, Loader2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  getCookieBanner,
  getPolicy,
  listPolicies,
  listPolicyAcceptances,
  listPolicyVersions,
  publishPolicy,
  saveCookieBanner,
  savePolicyDraft,
  withdrawPolicyAcceptance,
} from "@/lib/policies.functions";

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const today = () => new Date().toISOString().slice(0, 10);

export function PolicyManager({ storeId }: { storeId: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listPolicies);
  const policies = useQuery({ queryKey: ["policies", storeId], queryFn: () => list({ data: { storeId } }) });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && policies.data?.[0]) setSelected(policies.data[0].id);
  }, [policies.data, selected]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["policies", storeId] });

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Hazır metinler başlangıç şablonudur, hukuki danışmanlık değildir. Yayınlamadan önce kendi işinize göre
          kontrol edin; gerekirse bir avukata danışın.
        </p>
      </div>
      <Tabs defaultValue="policies">
        <TabsList className="flex-wrap">
          <TabsTrigger value="policies">Politikalar</TabsTrigger>
          <TabsTrigger value="acceptances">Onay kayıtları</TabsTrigger>
          {storeId ? <TabsTrigger value="cookie">Çerez bandı</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="policies" className="mt-4">
          {policies.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : policies.error ? (
            <p className="text-sm text-destructive">{(policies.error as Error).message}</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                {(policies.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selected === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                  >
                    <div className="font-medium">{p.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {p.current_version_id ? <Badge variant="secondary">v{p.version}</Badge> : <Badge variant="outline">Taslak</Badge>}
                      {!p.is_visible ? <span>Gizli</span> : null}
                      {p.next_review_date && p.next_review_date < today() ? <span className="text-destructive">Gözden geçir</span> : null}
                      <span>{p.acceptance_count} onay</span>
                    </div>
                  </button>
                ))}
              </div>
              {selected ? <PolicyEditor key={selected} storeId={storeId} policyId={selected} onChanged={refresh} /> : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="acceptances" className="mt-4">
          <Acceptances storeId={storeId} policies={policies.data ?? []} />
        </TabsContent>

        {storeId ? (
          <TabsContent value="cookie" className="mt-4">
            <CookieBannerForm storeId={storeId} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function PolicyEditor({ storeId, policyId, onChanged }: { storeId: string | null; policyId: string; onChanged: () => void }) {
  const get = useServerFn(getPolicy);
  const save = useServerFn(savePolicyDraft);
  const publish = useServerFn(publishPolicy);
  const versionsFn = useServerFn(listPolicyVersions);
  const q = useQuery({ queryKey: ["policy", storeId, policyId], queryFn: () => get({ data: { storeId, policyId } }) });
  const versions = useQuery({ queryKey: ["policy-versions", storeId, policyId], queryFn: () => versionsFn({ data: { storeId, policyId } }) });

  const [form, setForm] = useState<{
    title: string; draftContent: string; values: Record<string, string>; seoTitle: string; seoDescription: string; isVisible: boolean; nextReviewDate: string;
  } | null>(null);
  const [pub, setPub] = useState({ bump: "minor" as "minor" | "major", effectiveDate: today(), changeSummary: "", requiresAcceptance: false });

  useEffect(() => {
    const p = q.data?.policy as any;
    if (p && !form) {
      setForm({
        title: p.title ?? "",
        draftContent: p.draft_content ?? "",
        values: (p.placeholder_values ?? {}) as Record<string, string>,
        seoTitle: p.seo_title ?? "",
        seoDescription: p.seo_description ?? "",
        isVisible: p.is_visible ?? true,
        nextReviewDate: p.next_review_date ?? "",
      });
    }
  }, [q.data, form]);

  const saveM = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId, policyId, title: form!.title, draftContent: form!.draftContent, placeholderValues: form!.values,
          seoTitle: form!.seoTitle || null, seoDescription: form!.seoDescription || null, isVisible: form!.isVisible,
          nextReviewDate: form!.nextReviewDate || null,
        },
      }),
    onSuccess: () => { toast.success("Taslak kaydedildi"); onChanged(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const pubM = useMutation({
    mutationFn: async () => {
      await saveM.mutateAsync();
      return publish({ data: { storeId, policyId, ...pub } });
    },
    onSuccess: (r) => {
      toast.success(`v${r.version} yayınlandı`);
      setPub((s) => ({ ...s, changeSummary: "" }));
      onChanged();
      void versions.refetch();
      void q.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const preview = useMemo(() => {
    if (!form) return "";
    const vals: Record<string, string> = { ...form.values, MAGAZA_ADI: q.data?.storeName ?? "" };
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const html = form.draftContent.replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => (vals[k] ? esc(vals[k]) : `<mark>${m}</mark>`));
    return sanitizeBlogHtml(html);
  }, [form, q.data?.storeName]);

  if (q.isLoading || !form) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const defs = q.data!.placeholders.filter((d) => d.placeholder_key !== "MAGAZA_ADI");
  const p = q.data!.policy as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> {form.title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {p.current_version_id ? `Yayında: v${p.version} · Yürürlük ${fmt(p.effective_date)}` : "Henüz yayınlanmadı"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Başlık</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Sonraki gözden geçirme</Label><Input type="date" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} /></div>
          </div>
          {defs.length ? (
            <div className="space-y-2">
              <Label>Bilgileriniz (metne otomatik yerleşir)</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {defs.map((d) => (
                  <div key={d.placeholder_key} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{d.label}{d.is_required ? " *" : ""}</span>
                    <Input
                      type={d.input_type === "number" ? "number" : d.input_type === "email" ? "email" : "text"}
                      min={d.min_value ?? undefined}
                      value={form.values[d.placeholder_key] ?? ""}
                      onChange={(e) => setForm({ ...form, values: { ...form.values, [d.placeholder_key]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <Tabs defaultValue="edit">
            <TabsList><TabsTrigger value="edit">Metin</TabsTrigger><TabsTrigger value="preview">Önizleme</TabsTrigger></TabsList>
            <TabsContent value="edit">
              <Textarea rows={16} className="font-mono text-xs" value={form.draftContent} onChange={(e) => setForm({ ...form, draftContent: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">HTML biçimli metin. {"{{ALAN_ADI}}"} yazan yerler yukarıdaki bilgilerle doldurulur.</p>
            </TabsContent>
            <TabsContent value="preview">
              <div className="blog-prose max-h-[520px] overflow-auto rounded-lg border border-border p-4 text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
            </TabsContent>
          </Tabs>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>SEO başlığı</Label><Input value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>SEO açıklaması</Label><Input value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.isVisible} onCheckedChange={(v) => setForm({ ...form, isVisible: v })} /> Sitede göster</label>
            <Button variant="outline" onClick={() => saveM.mutate()} disabled={saveM.isPending}>Taslağı kaydet</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Yayınla</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Değişiklik türü</Label>
              <Select value={pub.bump} onValueChange={(v) => setPub({ ...pub, bump: v as "minor" | "major" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="minor">Küçük (1.0 → 1.1)</SelectItem><SelectItem value="major">Büyük (1.x → 2.0)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Yürürlük tarihi</Label><Input type="date" value={pub.effectiveDate} onChange={(e) => setPub({ ...pub, effectiveDate: e.target.value })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><Switch checked={pub.requiresAcceptance} onCheckedChange={(v) => setPub({ ...pub, requiresAcceptance: v })} /> Yeniden onay iste</label>
          </div>
          <div className="space-y-1.5"><Label>Ne değişti?</Label><Input value={pub.changeSummary} placeholder="Örn. iade süresi 14 günden 30 güne çıkarıldı" onChange={(e) => setPub({ ...pub, changeSummary: e.target.value })} /></div>
          <Button onClick={() => pubM.mutate()} disabled={pubM.isPending || pub.changeSummary.trim().length < 2}>
            {pubM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Yeni sürüm yayınla
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Sürüm geçmişi</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(versions.data ?? []).map((v) => (
            <details key={v.id} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer">
                <strong>v{v.version}</strong> {v.is_active ? <Badge className="ml-1">Aktif</Badge> : null}
                <span className="ml-2 text-muted-foreground">{fmt(v.published_at)} · {v.acceptances} onay · {v.change_summary}</span>
              </summary>
              <div className="blog-prose mt-3 max-h-80 overflow-auto text-xs" dangerouslySetInnerHTML={{ __html: v.content }} />
            </details>
          ))}
          {!versions.data?.length ? <p className="text-muted-foreground">Henüz yayınlanmış sürüm yok.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Acceptances({ storeId, policies }: { storeId: string | null; policies: Array<{ id: string; title: string }> }) {
  const fn = useServerFn(listPolicyAcceptances);
  const withdraw = useServerFn(withdrawPolicyAcceptance);
  const [policyId, setPolicyId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["policy-acceptances", storeId, policyId, search],
    queryFn: () => fn({ data: { storeId, policyId: policyId === "all" ? null : policyId, q: search } }),
  });
  const names = new Map(policies.map((p) => [p.id, p.title]));
  const w = useMutation({
    mutationFn: (id: string) => withdraw({ data: { storeId: storeId!, acceptanceId: id } }),
    onSuccess: () => { toast.success("Onay geri çekildi olarak işaretlendi"); void q.refetch(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const exportCsv = () => {
    const rows = (q.data?.rows ?? []).map((r) => [
      names.get(r.policy_id) ?? "", r.version_label ?? "", r.subject_email ?? "", r.order_number ?? "",
      r.ip_address ?? "", r.user_agent ?? "", r.accepted_at, r.withdrawn_at ?? "",
    ]);
    downloadCsv(`politika-onaylari-${today()}.csv`, toCsv(["Politika", "Sürüm", "E-posta", "Sipariş", "IP", "Tarayıcı", "Tarih", "Geri çekildi"], rows));
  };
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap gap-2">
          <Select value={policyId} onValueChange={setPolicyId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm politikalar</SelectItem>
              {policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="w-56" placeholder="E-posta ara" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={exportCsv} disabled={!q.data?.rows.length}><Download className="mr-2 h-4 w-4" /> CSV indir</Button>
        </div>
        {q.data ? <p className="text-sm text-muted-foreground">Toplam {q.data.total} · Aktif {q.data.active} · Geri çekilen {q.data.withdrawn}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-3">Politika</th><th className="pr-3">Sürüm</th><th className="pr-3">E-posta</th><th className="pr-3">Sipariş</th><th className="pr-3">Tarih</th><th /></tr>
            </thead>
            <tbody>
              {(q.data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3">{names.get(r.policy_id) ?? "—"}</td>
                  <td className="pr-3">v{r.version_label}</td>
                  <td className="pr-3">{r.subject_email ?? "—"}</td>
                  <td className="pr-3">{r.order_number ?? "—"}</td>
                  <td className="pr-3">{new Date(r.accepted_at).toLocaleString("tr-TR")}</td>
                  <td>
                    {r.withdrawn_at ? <Badge variant="outline">Geri çekildi</Badge> : storeId ? (
                      <Button size="sm" variant="ghost" onClick={() => w.mutate(r.id)}>Geri çek</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data && !q.data.rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">Henüz onay kaydı yok.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CookieBannerForm({ storeId }: { storeId: string }) {
  const get = useServerFn(getCookieBanner);
  const save = useServerFn(saveCookieBanner);
  const q = useQuery({ queryKey: ["cookie-banner-admin", storeId], queryFn: () => get({ data: { storeId } }) });
  const [f, setF] = useState<Awaited<ReturnType<typeof get>> | null>(null);
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const m = useMutation({
    mutationFn: () => save({ data: { storeId, ...f! } }),
    onSuccess: () => toast.success("Çerez bandı kaydedildi"),
    onError: (e) => toast.error((e as Error).message),
  });
  if (!f) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Konum</Label>
            <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v as typeof f.position })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="bottom">Alt (tam genişlik)</SelectItem><SelectItem value="bottom-left">Sol alt köşe</SelectItem><SelectItem value="bottom-right">Sağ alt köşe</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Renk</Label>
            <Select value={f.colorScheme} onValueChange={(v) => setF({ ...f, colorScheme: v as typeof f.colorScheme })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="auto">Otomatik</SelectItem><SelectItem value="light">Açık</SelectItem><SelectItem value="dark">Koyu</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.usesAnalytics} onCheckedChange={(v) => setF({ ...f, usesAnalytics: v })} /> Analitik çerez kullanıyorum</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.usesMarketing} onCheckedChange={(v) => setF({ ...f, usesMarketing: v })} /> Pazarlama çerezi kullanıyorum (reklam pikselleri)</label>
        <div className="space-y-1.5">
          <Label>Bant metni (boşsa varsayılan)</Label>
          <Textarea rows={3} value={f.bannerText ?? ""} onChange={(e) => setF({ ...f, bannerText: e.target.value || null })} />
        </div>
        <div className="space-y-1.5">
          <Label>Önizleme</Label>
          <div className="relative h-56 overflow-hidden rounded-lg border bg-muted/40" aria-label="Çerez bandı önizlemesi">
            <div className="p-3 text-xs text-muted-foreground">Mağaza sayfanız</div>
            <div
              className={`absolute bottom-2 rounded-lg border p-3 text-xs shadow-lg ${
                f.position === "bottom" ? "inset-x-2" : f.position === "bottom-left" ? "left-2 w-64" : "right-2 w-64"
              } ${f.colorScheme === "dark" ? "bg-foreground text-background" : "bg-background text-foreground"}`}
            >
              <p className="mb-2">
                {f.bannerText ||
                  "Sitemizde deneyiminizi iyileştirmek için çerezler kullanıyoruz. Zorunlu çerezler her zaman açıktır."}
              </p>
              <div className="mb-2 flex flex-wrap gap-1 opacity-80">
                <span className="rounded border px-1.5">Zorunlu</span>
                {f.usesAnalytics && <span className="rounded border px-1.5">Analitik</span>}
                {f.usesMarketing && <span className="rounded border px-1.5">Pazarlama</span>}
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">Kabul et</span>
                <span className="rounded-full border px-3 py-1">Reddet</span>
                <span className="rounded-full px-2 py-1 underline">Ayarlar</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Kategorileri değiştirdiğinizde ziyaretçilerden yeniden onay istenir.</p>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>Kaydet</Button>
      </CardContent>
    </Card>
  );
}
