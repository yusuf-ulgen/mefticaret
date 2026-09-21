import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Copy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AI_TASKS, AI_TASK_GROUP_LABELS, taskLabel, type AiTask } from "@/lib/ai-tasks";
import { aiGenerationsQuery, aiUsageQuery, storeAiSettingsQuery } from "@/lib/ai-queries";
import { runAiAssistant, saveStoreAiSettings } from "@/lib/ai.functions";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/ai")({
  head: () => ({
    meta: [
      { title: "AI Asistan — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün açıklaması, SEO metni, blog, kampanya, e-posta, çeviri ve satış analizi üretin; AI sağlayıcınızı seçin ve mağaza bazlı kullanımı izleyin.",
      },
      { property: "og:title", content: "AI Asistan — Mefticaret" },
      {
        property: "og:description",
        content: "Modüler AI sağlayıcı desteği, 14 hazır görev ve mağaza bazlı kullanım takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiPage,
});

function ResultBox({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Metni kopyala"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            toast.success("Kopyalandı");
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AiPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeAiSettingsQuery(storeId));
  const { data: usage } = useQuery(aiUsageQuery(storeId));
  const { data: history } = useQuery(aiGenerationsQuery(storeId));

  const run = useServerFn(runAiAssistant);
  const saveSettings = useServerFn(saveStoreAiSettings);

  const [taskKey, setTaskKey] = useState(AI_TASKS[0]!.key);
  const [values, setValues] = useState<Record<string, string>>({});
  const task = useMemo<AiTask>(() => AI_TASKS.find((item) => item.key === taskKey) ?? AI_TASKS[0]!, [taskKey]);

  const [form, setForm] = useState({
    providerCode: settings?.provider_code ?? "lovable",
    model: settings?.model ?? "google/gemini-3.7-flash",
    creativity: String(settings?.creativity ?? 0.7),
    brandTone: settings?.brand_tone ?? "premium",
    language: settings?.language ?? "tr",
    monthlyTokenLimit: String(settings?.monthly_token_limit ?? 500000),
    isEnabled: settings?.is_enabled ?? true,
  });

  const limit = settings?.monthly_token_limit ?? 500000;
  const usedPercent = limit > 0 ? Math.min(100, Math.round(((usage?.monthTokens ?? 0) / limit) * 100)) : 0;

  const generate = useMutation({
    mutationFn: () => run({ data: { storeId, task: taskKey, values } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-usage", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["ai-generations", storeId] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settingsMutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          storeId,
          providerCode: form.providerCode,
          model: form.model,
          creativity: Number(form.creativity),
          brandTone: form.brandTone,
          language: form.language,
          monthlyTokenLimit: Number(form.monthlyTokenLimit) || 0,
          isEnabled: form.isEnabled,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store-ai-settings", storeId] });
      toast.success("AI ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groups = useMemo(() => {
    const map = new Map<string, AiTask[]>();
    for (const item of AI_TASKS) {
      map.set(item.group, [...(map.get(item.group) ?? []), item]);
    }
    return [...map.entries()];
  }, []);

  return (
    <AppShell
      storeId={storeId}
      title="AI Asistan"
      description={`${store?.name ?? "Mağaza"} için 14 hazır AI görevi, modüler sağlayıcı seçimi ve kullanım takibi.`}
    >
      <Tabs defaultValue="assistant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assistant">Asistan</TabsTrigger>
          <TabsTrigger value="usage">Kullanım</TabsTrigger>
          <TabsTrigger value="settings">Sağlayıcı & ayarlar</TabsTrigger>
          <TabsTrigger value="history">Geçmiş</TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <nav className="surface-card space-y-4 p-4">
            {groups.map(([group, items]) => (
              <div key={group} className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {AI_TASK_GROUP_LABELS[group as keyof typeof AI_TASK_GROUP_LABELS]}
                </p>
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTaskKey(item.key);
                      setValues({});
                      generate.reset();
                    }}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                      taskKey === item.key && "bg-muted font-medium",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <section className="surface-card p-6">
            <header className="mb-4">
              <h2 className="font-display text-lg font-semibold">{task.label}</h2>
              <p className="text-sm text-muted-foreground">{task.description}</p>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {task.fields.map((field) => (
                <div
                  key={field.name}
                  className={cn("space-y-2", field.type === "textarea" && "md:col-span-2")}
                >
                  <Label htmlFor={`ai-${field.name}`}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  {field.type === "text" ? (
                    <Input
                      id={`ai-${field.name}`}
                      value={values[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                      }
                    />
                  ) : null}
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`ai-${field.name}`}
                      rows={field.rows ?? 3}
                      value={values[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                      }
                    />
                  ) : null}
                  {field.type === "select" ? (
                    <Select
                      value={values[field.name] ?? field.options?.[0]?.value ?? ""}
                      onValueChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
                    >
                      <SelectTrigger id={`ai-${field.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              ))}
            </div>

            <Button className="mt-4" disabled={generate.isPending} onClick={() => generate.mutate()}>
              <Wand2 className="mr-2 size-4" />
              {generate.isPending ? "Üretiliyor…" : "Üret"}
            </Button>
            {generate.isPending ? <Skeleton className="mt-4 h-40 w-full" /> : null}
            {generate.data ? (
              <>
                <ResultBox text={generate.data.text} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {generate.data.providerCode} · {generate.data.model} ·{" "}
                  {formatNumber(generate.data.totalTokens)} token
                </p>
              </>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <article className="surface-card p-4">
              <p className="text-sm text-muted-foreground">Bu ay kullanılan token</p>
              <p className="font-display text-2xl font-semibold">{formatNumber(usage?.monthTokens ?? 0)}</p>
              <Progress className="mt-3" value={usedPercent} />
              <p className="mt-1 text-xs text-muted-foreground">
                Limit: {limit > 0 ? formatNumber(limit) : "Sınırsız"} · %{usedPercent}
              </p>
            </article>
            <article className="surface-card p-4">
              <p className="text-sm text-muted-foreground">Bu ay istek</p>
              <p className="font-display text-2xl font-semibold">{formatNumber(usage?.monthRequests ?? 0)}</p>
            </article>
            <article className="surface-card p-4">
              <p className="text-sm text-muted-foreground">Toplam token</p>
              <p className="font-display text-2xl font-semibold">{formatNumber(usage?.totalTokens ?? 0)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="surface-card p-4">
              <h3 className="mb-3 font-semibold">Göreve göre kullanım</h3>
              {(usage?.byTask ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(usage?.byTask ?? []).map((row) => (
                    <li key={row.task} className="flex items-center justify-between gap-2">
                      <span>{taskLabel(row.task)}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(row.tokens)} token · {row.requests} istek
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="surface-card p-4">
              <h3 className="mb-3 font-semibold">Sağlayıcıya göre kullanım</h3>
              {(usage?.byProvider ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(usage?.byProvider ?? []).map((row) => (
                    <li key={row.provider} className="flex items-center justify-between gap-2">
                      <span>{row.provider}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(row.tokens)} token · {row.requests} istek
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <form
            className="surface-card space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              settingsMutation.mutate();
            }}
          >
            <h2 className="font-display text-lg font-semibold">Mağaza AI ayarları</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Yapay zekâ motoru</Label>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Model seçimi platform tarafından yönetilir: hızlı metin işleri, strateji işleri ve görsel
                  üretimi otomatik olarak en uygun motora yönlendirilir.
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-creativity">Yaratıcılık (0-1)</Label>
                <Input
                  id="ai-creativity"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={form.creativity}
                  onChange={(event) => setForm((prev) => ({ ...prev, creativity: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Marka tonu</Label>
                <Select
                  value={form.brandTone}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, brandTone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["premium", "samimi", "teknik", "minimal", "esprili"].map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {tone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Çıktı dili</Label>
                <Select
                  value={form.language}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr">Türkçe</SelectItem>
                    <SelectItem value="en">İngilizce</SelectItem>
                    <SelectItem value="de">Almanca</SelectItem>
                    <SelectItem value="ar">Arapça</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-limit">Aylık token limiti (0 = sınırsız)</Label>
                <Input
                  id="ai-limit"
                  type="number"
                  min={0}
                  value={form.monthlyTokenLimit}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, monthlyTokenLimit: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Bu mağaza için AI aktif</span>
              <Switch
                checked={form.isEnabled}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isEnabled: checked }))}
              />
            </div>
            <Button type="submit" disabled={settingsMutation.isPending}>
              Ayarları kaydet
            </Button>
          </form>

          <aside className="surface-card space-y-3 p-6">
            <h3 className="font-semibold">Kredi kullanımı</h3>
            <p className="text-sm text-muted-foreground">
              Her yapay zekâ işlemi kredi düşer: ürün açıklaması ve SEO metni 1 kredi; görsel üretimi,
              kampanya taslağı ve CoPilot işlemi 2 kredi. Bakiyenizi üst çubuktaki kredi rozetinden takip
              edebilir, tek tıkla yükleme yapabilirsiniz.
            </p>
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Motor</p>
              <p className="pt-1 text-xs text-muted-foreground">
                Metin ve strateji işleri ile görsel üretimi platform tarafından yönetilir; ayrı anahtar veya
                sağlayıcı seçimi gerekmez.
              </p>
            </div>
          </aside>
        </TabsContent>

        <TabsContent value="history">
          <section className="surface-card divide-y divide-border">
            {(history ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                <Sparkles className="mb-2 size-5" /> Henüz AI üretimi yok.
              </p>
            ) : (
              (history ?? []).map((row) => (
                <article key={row.id} className="space-y-1 p-4">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{taskLabel(row.task)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)} · {row.provider_code}/{row.model} ·{" "}
                      {formatNumber(row.total_tokens)} token
                    </span>
                  </header>
                  {row.status === "error" ? (
                    <p className="text-sm text-destructive">{row.error}</p>
                  ) : (
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {row.output}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
