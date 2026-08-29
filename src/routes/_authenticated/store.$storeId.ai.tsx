import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateProductCopy, generateStoreInsight } from "@/lib/ai.functions";
import { storeQuery } from "@/lib/store-queries";

const TONES = [
  { value: "premium", label: "Premium" },
  { value: "samimi", label: "Samimi" },
  { value: "teknik", label: "Teknik" },
  { value: "minimal", label: "Minimal" },
] as const;

export const Route = createFileRoute("/_authenticated/store/$storeId/ai")({
  head: () => ({
    meta: [
      { title: "AI Asistan — Mefticaret" },
      {
        name: "description",
        content: "Ürün açıklaması ve SEO metni üret, mağaza metriklerini AI ile yorumlat.",
      },
      { property: "og:title", content: "AI Asistan — Mefticaret" },
      { property: "og:description", content: "Mefticaret AI asistanı ile metin üretimi ve satış analizi." },
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
  const { data: store } = useQuery(storeQuery(storeId));
  const copyFn = useServerFn(generateProductCopy);
  const insightFn = useServerFn(generateStoreInsight);

  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]["value"]>("premium");

  const copy = useMutation({
    mutationFn: () =>
      copyFn({
        data: {
          storeId,
          title: title.trim(),
          audience: audience.trim() || undefined,
          keywords: keywords.trim() || undefined,
          tone,
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  const insight = useMutation({
    mutationFn: () => insightFn({ data: { storeId, days: 30 } }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="AI Asistan"
      description={`${store?.name ?? "Mağaza"} için metin üretimi ve satış analizi.`}
    >
      <Tabs defaultValue="copy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="copy">Ürün metni</TabsTrigger>
          <TabsTrigger value="insight">Satış analizi</TabsTrigger>
        </TabsList>

        <TabsContent value="copy">
          <section className="surface-card p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-title">Ürün adı</Label>
                <Input
                  id="ai-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Örn. Su itici trençkot"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-tone">Ton</Label>
                <Select value={tone} onValueChange={(value) => setTone(value as typeof tone)}>
                  <SelectTrigger id="ai-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-audience">Hedef kitle</Label>
                <Input
                  id="ai-audience"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Örn. 25-40 yaş şehirli kadın"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-keywords">Anahtar kelimeler</Label>
                <Textarea
                  id="ai-keywords"
                  rows={2}
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="trençkot, su itici kumaş, sonbahar"
                />
              </div>
            </div>
            <Button
              className="mt-4"
              disabled={title.trim().length < 2 || copy.isPending}
              onClick={() => copy.mutate()}
            >
              <Wand2 className="mr-2 size-4" />
              {copy.isPending ? "Üretiliyor…" : "Metin üret"}
            </Button>
            {copy.isPending ? <Skeleton className="mt-4 h-40 w-full" /> : null}
            {copy.data ? <ResultBox text={copy.data.text} /> : null}
          </section>
        </TabsContent>

        <TabsContent value="insight">
          <section className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold">Son 30 günün AI yorumu</h2>
            <p className="text-sm text-muted-foreground">
              Ciro, sepet ortalaması, ödeme tamamlanma oranı, kritik stok ve en çok satan ürünler analiz edilir.
            </p>
            <Button className="mt-4" disabled={insight.isPending} onClick={() => insight.mutate()}>
              <Sparkles className="mr-2 size-4" />
              {insight.isPending ? "Analiz ediliyor…" : "Analiz et"}
            </Button>
            {insight.isPending ? <Skeleton className="mt-4 h-40 w-full" /> : null}
            {insight.data ? <ResultBox text={insight.data.text} /> : null}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
