import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, Copy, FileSpreadsheet, FileText, ImageUp, Link2, Loader2, Sparkles, Tags, Type, Wallet } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchAiCreditStatus } from "@/lib/ai-credits.functions";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  INTENT_LABELS,
  KEYWORD_MARKETS,
  type KeywordMarket,
  type KeywordResult,
} from "@/lib/keyword-generator";
import {
  applyKeywordsToProduct,
  generateKeywordDescription,
  generateKeywords,
  listKeywordProducts,
} from "@/lib/keyword-generator.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/keywords")({
  head: () => ({
    meta: [
      { title: "AI Anahtar Kelime Üreticisi — Mefticaret" },
      { name: "description", content: "Google, Trendyol, Hepsiburada ve Amazon için yapay zekâ ile anahtar kelime seti üretin." },
      { property: "og:title", content: "AI Anahtar Kelime Üreticisi — Mefticaret" },
      { property: "og:description", content: "Ürün adı, görsel veya rakip linkinden SEO anahtar kelimeleri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KeywordsPage,
});

type Mode = "text" | "vision" | "url";
type Group = "primary" | "longTail" | "lsi" | "negative";

const GROUPS: { key: Group; title: string; hint: string }[] = [
  { key: "primary", title: "Odak kelimeler", hint: "Yüksek arama hacimli ana kelimeler" },
  { key: "longTail", title: "Uzun kuyruk", hint: "Dönüşümü yüksek, daha spesifik aramalar" },
  { key: "lsi", title: "LSI / anlamsal terimler", hint: "Metinde doğal geçmesi gereken ilişkili terimler" },
  { key: "negative", title: "Negatif kelimeler", hint: "Reklamda hariç tutun — alakasız harcamayı önler" },
];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 4 * 1024 * 1024) return reject(new Error("Görsel en fazla 4 MB olabilir."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.readAsDataURL(file);
  });
}

function excelXml(rows: string[][]): string {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = rows
    .map((r) => `<Row>${r.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join("")}</Row>`)
    .join("");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Anahtar Kelimeler"><Table>${body}</Table></Worksheet></Workbook>`;
}

function KeywordsPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const creditFn = useServerFn(fetchAiCreditStatus);
  const genFn = useServerFn(generateKeywords);
  const descFn = useServerFn(generateKeywordDescription);
  const productsFn = useServerFn(listKeywordProducts);
  const applyFn = useServerFn(applyKeywordsToProduct);

  const credits = useQuery({
    queryKey: ["ai-credit-status", storeId],
    queryFn: () => creditFn({ data: { storeId } }),
  });

  const [mode, setMode] = useState<Mode>("text");
  const [markets, setMarkets] = useState<KeywordMarket[]>(["google", "trendyol"]);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState("");
  const [productId, setProductId] = useState<string>("");

  const products = useQuery({
    queryKey: ["keyword-products", storeId],
    queryFn: () => productsFn({ data: { storeId } }),
  });

  const setBalance = (balance: number) =>
    qc.setQueryData(["ai-credit-status", storeId], (old: typeof credits.data) => (old ? { ...old, balance } : old));

  const generate = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          storeId,
          mode,
          markets,
          productName: productName || undefined,
          category: category || undefined,
          audience: audience || undefined,
          imageDataUrl: mode === "vision" ? (image ?? undefined) : undefined,
          url: mode === "url" ? url : undefined,
        },
      }),
    onSuccess: (out) => {
      setResult(out.result);
      setSelected(new Set([...out.result.primary, ...out.result.longTail.slice(0, 4)]));
      setDescription("");
      setBalance(out.balance);
      toast.success(`Anahtar kelimeler hazır · ${out.creditsUsed} kredi kullanıldı`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Üretim başarısız"),
  });

  const writeDesc = useMutation({
    mutationFn: () =>
      descFn({
        data: {
          storeId,
          productName: productName || result?.primary[0] || "Ürün",
          category: category || undefined,
          audience: audience || undefined,
          keywords: [...selected].slice(0, 40),
        },
      }),
    onSuccess: (out) => {
      setDescription(out.text);
      setBalance(out.balance);
      toast.success(`Açıklama yazıldı · ${out.creditsUsed} kredi kullanıldı`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Açıklama yazılamadı"),
  });

  const apply = useMutation({
    mutationFn: () =>
      applyFn({
        data: {
          storeId,
          productId,
          metaTitle: result?.metaTitle ?? "",
          metaDescription: result?.metaDescription ?? "",
          tags: [...selected].filter((k) => !result?.negative.includes(k)).slice(0, 40),
          description: description || undefined,
        },
      }),
    onSuccess: () => toast.success("Meta başlık, açıklama ve arama etiketleri ürüne kaydedildi"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });

  const intentOf = useMemo(() => {
    const map = new Map<string, string>();
    result?.intents.forEach((i) => map.set(i.keyword.toLocaleLowerCase("tr"), INTENT_LABELS[i.intent]));
    return map;
  }, [result]);

  const toggle = (k: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const rows = (): string[][] => {
    if (!result) return [];
    const out: string[][] = [["Grup", "Anahtar kelime", "Arama niyeti", "Seçili"]];
    for (const g of GROUPS)
      for (const k of result[g.key])
        out.push([g.title, k, intentOf.get(k.toLocaleLowerCase("tr")) ?? "", selected.has(k) ? "evet" : ""]);
    return out;
  };

  const exportCsv = () => {
    const [head, ...body] = rows();
    if (head) downloadCsv("anahtar-kelimeler.csv", toCsv(head, body));
  };
  const exportExcel = () => {
    const blob = new Blob([excelXml(rows())], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "anahtar-kelimeler.xls";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const copyAll = async () => {
    const list = selected.size ? [...selected] : rows().slice(1).map((r) => r[1]!);
    await navigator.clipboard.writeText(list.join(", "));
    toast.success(`${list.length} kelime panoya kopyalandı`);
  };

  const canGenerate =
    markets.length > 0 &&
    ((mode === "text" && productName.trim()) || (mode === "vision" && image) || (mode === "url" && url.trim()));
  const cost = credits.data?.costs.text ?? 1;

  return (
    <AppShell
      storeId={storeId}
      title="AI Anahtar Kelime Üreticisi"
      description="Ürün adı, görsel veya rakip linkinden Google ve pazaryerleri için anahtar kelime seti üretin."
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">AI Cüzdanı</p>
                <p className="text-lg font-semibold">
                  {credits.isLoading ? "…" : `${credits.data?.balance ?? 0} kredi`}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Her üretim {cost} kredi · Başarısız istekte kredi düşülmez</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Girdi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text"><Type className="mr-1.5 size-4" />Metin</TabsTrigger>
                <TabsTrigger value="vision"><ImageUp className="mr-1.5 size-4" />Görsel</TabsTrigger>
                <TabsTrigger value="url"><Link2 className="mr-1.5 size-4" />Rakip link</TabsTrigger>
              </TabsList>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kw-name">Ürün adı{mode === "text" ? " *" : ""}</Label>
                  <Input id="kw-name" value={productName} maxLength={160} onChange={(e) => setProductName(e.target.value)} placeholder="Örn. Keten yazlık elbise" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kw-cat">Kategori</Label>
                  <Input id="kw-cat" value={category} maxLength={160} onChange={(e) => setCategory(e.target.value)} placeholder="Örn. Elbise" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kw-aud">Hedef kitle</Label>
                  <Input id="kw-aud" value={audience} maxLength={160} onChange={(e) => setAudience(e.target.value)} placeholder="Kadın, Çocuk, Ev Dekorasyon…" />
                </div>
              </div>

              <TabsContent value="vision" className="mt-4">
                <Label htmlFor="kw-img" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40">
                  {image ? (
                    <img src={image} alt="Seçilen ürün görseli" className="max-h-48 rounded-md object-contain" />
                  ) : (
                    <>
                      <ImageUp className="size-6" />
                      Ürün görseli yükleyin (PNG, JPG, WEBP · en fazla 4 MB). Renk, kumaş ve stil otomatik çıkarılır.
                    </>
                  )}
                </Label>
                <input
                  id="kw-img"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setImage(await readImage(f));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Görsel okunamadı");
                    }
                  }}
                />
              </TabsContent>
              <TabsContent value="url" className="mt-4 space-y-1.5">
                <Label htmlFor="kw-url">Rakip ürün linki *</Label>
                <Input id="kw-url" type="url" value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.ornek.com/urun/..." />
                <p className="text-xs text-muted-foreground">Sayfanın başlığı, meta etiketleri ve metni okunur; rakibin kelime stratejisi çıkarılır.</p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Odak arama algoritması</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KEYWORD_MARKETS) as KeywordMarket[]).map((m) => {
                  const on = markets.includes(m);
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      className="rounded-full"
                      aria-pressed={on}
                      onClick={() => setMarkets((prev) => (on ? prev.filter((x) => x !== m) : [...prev, m]))}
                    >
                      {on ? <Check className="mr-1 size-3.5" /> : null}
                      {KEYWORD_MARKETS[m]}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Button className="w-full rounded-full sm:w-auto" disabled={!canGenerate || generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              Anahtar kelimeleri üret ({cost} kredi)
            </Button>
          </CardContent>
        </Card>

        {result ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-muted-foreground">
                {selected.size} kelime seçili · rozete dokunarak seçin/kaldırın
              </p>
              <Button size="sm" variant="outline" onClick={copyAll}><Copy className="mr-1.5 size-4" />Panoya kopyala</Button>
              <Button size="sm" variant="outline" onClick={exportCsv}><FileText className="mr-1.5 size-4" />CSV</Button>
              <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="mr-1.5 size-4" />Excel</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {GROUPS.map((g) => (
                <Card key={g.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{g.title} <span className="font-normal text-muted-foreground">({result[g.key].length})</span></CardTitle>
                    <p className="text-xs text-muted-foreground">{g.hint}</p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {result[g.key].map((k) => {
                      const on = selected.has(k);
                      const intent = intentOf.get(k.toLocaleLowerCase("tr"));
                      return (
                        <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={on}>
                          <Badge variant={on ? "default" : g.key === "negative" ? "destructive" : "secondary"} className="cursor-pointer gap-1 py-1 text-xs">
                            {on ? <Check className="size-3" /> : null}
                            {k}
                            {intent ? <span className="opacity-70">· {intent}</span> : null}
                          </Badge>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>

            {result.visualAttributes.color.length + result.visualAttributes.fabric.length + result.visualAttributes.style.length > 0 ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Görselden çıkarılan nitelikler</CardTitle></CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
                  {(["color", "fabric", "style"] as const).map((a) => (
                    <div key={a}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{{ color: "Renk", fabric: "Kumaş", style: "Stil" }[a]}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.visualAttributes[a].map((v) => (
                          <button key={v} type="button" onClick={() => toggle(v)}>
                            <Badge variant={selected.has(v) ? "default" : "outline"}>{v}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tags className="size-4" />Meta etiketler ve ürüne uygula</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kw-mt">Meta başlık ({result.metaTitle.length}/60)</Label>
                  <Input id="kw-mt" value={result.metaTitle} maxLength={120} onChange={(e) => setResult({ ...result, metaTitle: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kw-md">Meta açıklama ({result.metaDescription.length}/155)</Label>
                  <Textarea id="kw-md" rows={2} value={result.metaDescription} maxLength={320} onChange={(e) => setResult({ ...result, metaDescription: e.target.value })} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full" disabled={!selected.size || writeDesc.isPending} onClick={() => writeDesc.mutate()}>
                    {writeDesc.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                    Seçili kelimelerle ürün açıklaması yaz ({cost} kredi)
                  </Button>
                </div>
                {description ? (
                  <Textarea rows={10} value={description} maxLength={10000} onChange={(e) => setDescription(e.target.value)} aria-label="Ürün açıklaması" />
                ) : null}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label>Ürün</Label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger><SelectValue placeholder={products.data?.length ? "Ürün seçin" : "Mağazada ürün yok"} /></SelectTrigger>
                      <SelectContent>
                        {(products.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="rounded-full" disabled={!productId || apply.isPending} onClick={() => apply.mutate()}>
                    {apply.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                    Tümünü meta etiketlere kopyala
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Meta başlık, meta açıklama ve seçili kelimeler (negatifler hariç) ürünün arama etiketlerine yazılır{description ? "; açıklama da güncellenir" : ""}.
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
