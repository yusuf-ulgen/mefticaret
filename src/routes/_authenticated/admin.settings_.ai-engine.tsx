import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  fetchAiEngineDesk,
  saveAiEngineConfig,
  testOpenAiConnection,
} from "@/lib/ai-credits.functions";

/**
 * Süper Admin AI Motor Masası.
 *
 * OpenAI anahtarı yalnızca sunucuda saklanır; bu sayfa anahtarı ne gösterir ne
 * de alır — yalnızca bağlantı durumunu test eder. Model yönlendirmesi, kredi
 * bedelleri ve finansal özet buradan yönetilir.
 */
export const Route = createFileRoute("/_authenticated/admin/settings_/ai-engine")({
  head: () => ({
    meta: [
      { title: "AI Motor Masası — Mefticaret" },
      {
        name: "description",
        content: "OpenAI model yönlendirmesi, kredi ekonomisi ve yapay zekâ maliyet analizi.",
      },
      { property: "og:title", content: "AI Motor Masası — Mefticaret" },
      { property: "og:description", content: "Platform genelinde yapay zekâ motorunu yönet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiEngineDeskPage,
});

const usd = (value: number) => `$${value.toFixed(4)}`;
const tryFmt = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value);

function AiEngineDeskPage() {
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["ai-engine-desk"], queryFn: () => fetchAiEngineDesk({}) });
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveAiEngineConfig({ data: payload }),
    onSuccess: () => {
      toast.success("Motor ayarları kaydedildi");
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ["ai-engine-desk"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: () => testOpenAiConnection({}),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
    onError: (error: Error) => toast.error(error.message),
  });

  const engine = desk.data?.engine;
  const finance = desk.data?.finance;
  const value = (key: string, fallback: string | number) =>
    draft[key] !== undefined ? String(draft[key]) : String(fallback);

  const numberField = (key: string, label: string, fallback: number, step = "0.01") => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={key} className="text-xs">
        {label}
      </Label>
      <Input
        id={key}
        type="number"
        step={step}
        value={value(key, fallback)}
        onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
      />
    </div>
  );

  const textField = (key: string, label: string, fallback: string) => (
    <div className="space-y-1.5" key={key}>
      <Label htmlFor={key} className="text-xs">
        {label}
      </Label>
      <Input
        id={key}
        value={value(key, fallback)}
        onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
      />
    </div>
  );

  function submit() {
    const numericKeys = new Set([
      "creditCostText",
      "creditCostImage",
      "creditCostCampaign",
      "creditCostCopilot",
      "fastInputUsd",
      "fastOutputUsd",
      "smartInputUsd",
      "smartOutputUsd",
      "imageUnitUsd",
    ]);
    const payload: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(draft)) {
      if (typeof raw === "boolean") payload[key] = raw;
      else if (numericKeys.has(key)) payload[key] = Number(raw);
      else payload[key] = raw;
    }
    if (Object.keys(payload).length === 0) {
      toast.info("Değişiklik yok");
      return;
    }
    save.mutate(payload);
  }

  return (
    <AdminShell
      title="AI Motor Masası"
      description="Tüm yapay zekâ işleri OpenAI üzerinden çalışır. Model yönlendirmesi, kredi bedelleri ve maliyet/ciro dengesi buradan yönetilir."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" aria-hidden /> OpenAI bağlantısı
            </CardTitle>
            <CardDescription>
              Anahtar yalnızca sunucuda saklanır; panelde görüntülenmez veya kopyalanamaz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {desk.data?.keyConfigured ? (
              <Badge className="gap-1.5">
                <BadgeCheck className="size-3.5" aria-hidden /> Anahtar tanımlı
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1.5">
                <TriangleAlert className="size-3.5" aria-hidden /> Anahtar tanımlı değil
              </Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="w-full rounded-full"
              disabled={test.isPending}
              onClick={() => test.mutate()}
            >
              {test.isPending ? "Test ediliyor…" : "Bağlantıyı test et"}
            </Button>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">Motor açık</span>
              <Switch
                checked={
                  draft["isEnabled"] !== undefined
                    ? Boolean(draft["isEnabled"])
                    : Boolean(engine?.isEnabled)
                }
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isEnabled: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Finansal denge (bu ay)</CardTitle>
            <CardDescription>
              OpenAI kullanım maliyeti (USD) ile kredi satış cirosu (TRY).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Metric label="Maliyet (USD)" value={usd(finance?.monthCostUsd ?? 0)} />
            <Metric label="Ciro (TRY)" value={tryFmt(finance?.monthRevenueTry ?? 0)} tone="good" />
            <Metric label="İstek" value={String(finance?.monthRequests ?? 0)} />
            <Metric label="Harcanan kredi" value={String(finance?.monthCreditsUsed ?? 0)} />
            <Metric label="Toplam maliyet" value={usd(finance?.totalCostUsd ?? 0)} />
            <Metric label="Toplam ciro" value={tryFmt(finance?.totalRevenueTry ?? 0)} tone="good" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motor yönlendirmesi</CardTitle>
          <CardDescription>
            Hızlı metin işleri (ürün açıklaması, SEO, destek) hızlı modele; strateji işleri (e-posta
            akışı, CoPilot, pazarlama) güçlü modele; görsel işleri görsel modeline gider.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {textField("modelFast", "Hızlı metin modeli", engine?.modelFast ?? "gpt-4o-mini")}
          {textField("modelSmart", "Strateji modeli", engine?.modelSmart ?? "gpt-4o")}
          {textField("modelImage", "Görsel modeli", engine?.modelImage ?? "dall-e-3")}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kredi bedelleri</CardTitle>
            <CardDescription>Her işlem için satıcıdan düşülecek kredi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {numberField("creditCostText", "Metin / SEO", engine?.creditCosts.text ?? 1, "1")}
            {numberField("creditCostImage", "Görsel üretimi", engine?.creditCosts.image ?? 2, "1")}
            {numberField(
              "creditCostCampaign",
              "Kampanya taslağı",
              engine?.creditCosts.campaign ?? 2,
              "1",
            )}
            {numberField(
              "creditCostCopilot",
              "CoPilot işlemi",
              engine?.creditCosts.copilot ?? 2,
              "1",
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">OpenAI birim maliyetleri</CardTitle>
            <CardDescription>Milyon token başına USD; görsel için adet başına USD.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {numberField("fastInputUsd", "Hızlı model girdi", engine?.fastInputUsd ?? 0.15)}
            {numberField("fastOutputUsd", "Hızlı model çıktı", engine?.fastOutputUsd ?? 0.6)}
            {numberField("smartInputUsd", "Strateji girdi", engine?.smartInputUsd ?? 2.5)}
            {numberField("smartOutputUsd", "Strateji çıktı", engine?.smartOutputUsd ?? 10)}
            {numberField("imageUnitUsd", "Görsel (adet)", engine?.imageUnitUsd ?? 0.04)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model bazlı kullanım</CardTitle>
          <CardDescription>Tüm zamanlar için istek sayısı ve maliyet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(finance?.byModel ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : null}
          {(finance?.byModel ?? []).map((row) => (
            <div
              key={row.model}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span className="truncate font-medium">{row.model}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.requests} istek · {usd(row.costUsd)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kredi paketleri</CardTitle>
          <CardDescription>Satıcıların yükleme yaptığı hazır paketler.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {(desk.data?.packages ?? []).map((pack) => (
            <div key={pack.id} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{pack.name}</p>
              <p className="text-xs text-muted-foreground">
                {pack.credits} kredi · {tryFmt(pack.price)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="rounded-full" disabled={save.isPending} onClick={submit}>
          {save.isPending ? "Kaydediliyor…" : "Ayarları kaydet"}
        </Button>
      </div>
    </AdminShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
