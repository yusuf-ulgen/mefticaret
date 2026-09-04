import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Play, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/mefti";
import { fetchSeoAiStatus, runSeoAiNow, saveSeoAiConfig } from "@/lib/seo-ai.functions";

const DESCRIPTION =
  "Platform genelinde her gün otomatik çalışan SEO yapay zekası: ana sayfa, ürünler, koleksiyonlar, kategoriler, kampanyalar ve blog sayfalarının meta verilerini gerçek panel verisine dayanarak iyileştirir.";

export const Route = createFileRoute("/_authenticated/admin/seo-ai")({
  head: () => ({
    meta: [
      { title: "Otomatik SEO Yapay Zekası — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Otomatik SEO Yapay Zekası — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminSeoAiPage,
});

type Settings = Awaited<ReturnType<typeof fetchSeoAiStatus>>["settings"];

const SCOPE_LABELS: Record<string, string> = {
  landing: "Ana sayfa",
  product: "Ürün",
  collection: "Koleksiyon",
  category: "Kategori",
  page: "Sayfa",
  campaign: "Kampanya",
  autofix: "Otomatik düzeltme",
};

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "isEnabled", label: "Otomasyon açık", hint: "Kapatılırsa günlük çalışma atlanır" },
  { key: "aiEnabled", label: "Yapay zeka metni", hint: "Meta başlık ve açıklama üretimi" },
  { key: "autofixEnabled", label: "Güvenli düzeltmeler", hint: "Eksik canonical, alt metin, şablon meta" },
  { key: "runLanding", label: "Ana sayfa", hint: "Platform pazarlama sitesi meta verisi" },
  { key: "runProducts", label: "Ürünler", hint: "Aktif ürünlerin meta verisi" },
  { key: "runCollections", label: "Koleksiyon & kategori", hint: "Vitrin liste sayfaları" },
  { key: "runBlog", label: "Blog & sayfalar", hint: "İçerik sayfalarının meta verisi" },
  { key: "runCampaigns", label: "Kampanyalar", hint: "Kampanya sayfaları" },
];

function AdminSeoAiPage() {
  const client = useQueryClient();
  const loadStatus = useServerFn(fetchSeoAiStatus);
  const saveConfig = useServerFn(saveSeoAiConfig);
  const runNow = useServerFn(runSeoAiNow);
  const [draft, setDraft] = useState<Partial<Settings>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["seo-ai-status"],
    queryFn: () => loadStatus(),
    staleTime: 15_000,
  });

  const settings = { ...(data?.settings ?? null), ...draft } as Settings | null;

  const saveMutation = useMutation({
    mutationFn: () => saveConfig({ data: draft }),
    onSuccess: async () => {
      setDraft({});
      await client.invalidateQueries({ queryKey: ["seo-ai-status"] });
      toast.success("Otomasyon ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runMutation = useMutation({
    mutationFn: () => runNow({ data: { storeId: null } }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["seo-ai-status"] });
      await client.invalidateQueries({ queryKey: ["platform-seo"] });
      if ("skipped" in result && result.skipped) {
        toast.info(result.reason);
        return;
      }
      toast.success(
        `${result.storesAudited} mağaza denetlendi · ${result.autofixed} düzeltme · ${result.aiUpdates} AI güncellemesi`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dirty = Object.keys(draft).length > 0;
  const lastRun = data?.runs?.[0] ?? null;

  return (
    <AdminShell
      title="Otomatik SEO Yapay Zekası"
      description={DESCRIPTION}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            <Save className="mr-2 size-4" /> Ayarları kaydet
          </Button>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
            <Play className="mr-2 size-4" />
            {runMutation.isPending ? "Çalışıyor…" : "Şimdi çalıştır"}
          </Button>
        </div>
      }
    >
      {isLoading || !settings ? (
        <p className="text-sm text-muted-foreground">Otomasyon durumu yükleniyor…</p>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Son çalışma", value: settings.lastRunAt ? new Date(settings.lastRunAt).toLocaleString("tr-TR") : "Henüz yok" },
              { label: "Son turda denetlenen mağaza", value: formatNumber(lastRun?.storesAudited ?? 0) },
              { label: "Toplam otomatik düzeltme", value: formatNumber(data?.totals.autofixed ?? 0) },
              { label: "Toplam AI meta güncellemesi", value: formatNumber(data?.totals.aiUpdates ?? 0) },
            ].map((card) => (
              <article key={card.label} className="rounded-2xl border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-xl font-semibold">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <header className="mb-4 flex items-center gap-2">
              <Bot className="size-4" />
              <h2 className="text-sm font-semibold">Çalışma kapsamı</h2>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TOGGLES.map((toggle) => (
                <label key={String(toggle.key)} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                  <span>
                    <span className="block text-sm font-medium">{toggle.label}</span>
                    <span className="block text-xs text-muted-foreground">{toggle.hint}</span>
                  </span>
                  <Switch
                    checked={Boolean(settings[toggle.key])}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, [toggle.key]: checked }))}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <Label>Çalışma günleri (UTC)</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = (settings.runDays ?? []).includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => {
                          const current = new Set(settings.runDays ?? []);
                          if (current.has(day.value)) current.delete(day.value);
                          else current.add(day.value);
                          const next = [...current].sort((a, b) => a - b);
                          return { ...prev, runDays: next.length > 0 ? next : [day.value] };
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Otomasyon yalnızca seçilen günlerde, belirlenen saatte çalışır.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-hour">Günlük çalışma saati (UTC)</Label>
                <Input
                  id="seo-ai-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.dailyHour}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dailyHour: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-minute">Çalışma dakikası</Label>
                <Input
                  id="seo-ai-minute"
                  type="number"
                  min={0}
                  max={59}
                  value={settings.dailyMinute}
                  onChange={(event) => setDraft((prev) => ({ ...prev, dailyMinute: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-stores">Tur başına mağaza</Label>
                <Input
                  id="seo-ai-stores"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.maxStoresPerRun}
                  onChange={(event) => setDraft((prev) => ({ ...prev, maxStoresPerRun: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-concurrency">Aynı anda işlenen mağaza</Label>
                <Input
                  id="seo-ai-concurrency"
                  type="number"
                  min={1}
                  max={12}
                  value={settings.concurrency}
                  onChange={(event) => setDraft((prev) => ({ ...prev, concurrency: Number(event.target.value) }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-items">Mağaza başına kayıt</Label>
                <Input
                  id="seo-ai-items"
                  type="number"
                  min={1}
                  max={40}
                  value={settings.maxItemsPerStore}
                  onChange={(event) => setDraft((prev) => ({ ...prev, maxItemsPerStore: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seo-ai-model">Model</Label>
                <Input
                  id="seo-ai-model"
                  value={settings.model}
                  onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 xl:col-span-4">
                <Label htmlFor="seo-ai-keywords">Odak anahtar kelimeler (virgülle)</Label>
                <Input
                  id="seo-ai-keywords"
                  placeholder="e-ticaret altyapısı, mağaza kurulumu, online satış"
                  value={settings.focusKeywords}
                  onChange={(event) => setDraft((prev) => ({ ...prev, focusKeywords: event.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Çalışma geçmişi</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Tarih</th>
                    <th className="py-2">Tetikleyici</th>
                    <th className="py-2">Durum</th>
                    <th className="py-2">Mağaza</th>
                    <th className="py-2">Sorun</th>
                    <th className="py-2">Düzeltme</th>
                    <th className="py-2">AI meta</th>
                    <th className="py-2">Ortalama skor</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.runs ?? []).map((run) => (
                    <tr key={run.id} className="border-t">
                      <td className="py-2">{new Date(run.startedAt).toLocaleString("tr-TR")}</td>
                      <td className="py-2">{run.trigger === "cron" ? "Otomatik" : "Manuel"}</td>
                      <td className="py-2">
                        <Badge variant={run.status === "success" ? "secondary" : run.status === "failed" ? "destructive" : "outline"}>
                          {run.status === "success" ? "Tamam" : run.status === "failed" ? "Hata" : run.status === "partial" ? "Kısmi" : "Çalışıyor"}
                        </Badge>
                      </td>
                      <td className="py-2">{formatNumber(run.storesAudited)}</td>
                      <td className="py-2">{formatNumber(run.issuesFound)}</td>
                      <td className="py-2">{formatNumber(run.autofixed)}</td>
                      <td className="py-2">{formatNumber(run.aiUpdates)}</td>
                      <td className="py-2">{run.averageScore}</td>
                    </tr>
                  ))}
                  {(data?.runs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted-foreground">
                        Henüz çalışma yok. “Şimdi çalıştır” ile ilk turu başlatabilirsin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <header className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4" />
              <h2 className="text-sm font-semibold">Son yapılan değişiklikler</h2>
            </header>
            <ul className="space-y-3">
              {(data?.actions ?? []).map((action) => (
                <li key={action.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{SCOPE_LABELS[action.scope] ?? action.scope}</Badge>
                    <span>{action.storeName}</span>
                    <span>{new Date(action.createdAt).toLocaleString("tr-TR")}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{action.target}</p>
                  {action.before && <p className="text-xs text-muted-foreground line-through">{action.before}</p>}
                  {action.after && <p className="text-sm">{action.after}</p>}
                </li>
              ))}
              {(data?.actions ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Henüz otomatik değişiklik kaydı yok.</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
