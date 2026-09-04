import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { generateBlogDraft } from "@/lib/blog-ai.functions";

export type AiBlogDraft = {
  title: string;
  slug: string;
  excerpt: string;
  seoDescription: string;
  body: string;
  tags: string[];
  outline: string[];
  totalTokens: number;
  model: string;
};

type Tone = "premium" | "samimi" | "teknik" | "minimal";
type Length = "kisa" | "orta" | "uzun";

const TONES: { value: Tone; label: string }[] = [
  { value: "premium", label: "Premium" },
  { value: "samimi", label: "Samimi" },
  { value: "teknik", label: "Teknik" },
  { value: "minimal", label: "Minimal" },
];

const LENGTHS: { value: Length; label: string }[] = [
  { value: "kisa", label: "Kısa (~600 kelime)" },
  { value: "orta", label: "Orta (~1000 kelime)" },
  { value: "uzun", label: "Uzun (~1700 kelime)" },
];

/**
 * E-ticaret odaklı AI blog yazarı. Model, mağazanın gerçek ürün ve
 * koleksiyon verisiyle temellendirilir; üretilen taslak forma basılır.
 */
export function AiBlogWriter({
  storeId,
  onDraft,
}: {
  storeId: string;
  onDraft: (draft: AiBlogDraft) => void;
}) {
  const generate = useServerFn(generateBlogDraft);
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<Tone>("premium");
  const [length, setLength] = useState<Length>("orta");
  const [includeProducts, setIncludeProducts] = useState(true);
  const [outline, setOutline] = useState<string[]>([]);

  const draft = useMutation({
    mutationFn: () =>
      generate({
        data: { storeId, topic: topic.trim(), keywords, audience, tone, length, includeProducts },
      }),
    onSuccess: (result) => {
      setOutline(result.outline);
      onDraft(result as AiBlogDraft);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface-card space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4" />
            Yapay zekâ ile blog yaz
          </h2>
          <p className="text-muted-foreground text-sm">
            E-ticaret uzmanı asistan; mağazanın gerçek ürün, koleksiyon ve fiyat verisini kullanarak SEO uyumlu
            taslak üretir. Sonuç aşağıdaki forma otomatik yazılır.
          </p>
        </div>
        <Badge variant="outline">Gerçek mağaza verisiyle temellendirilir</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ai-topic">Konu</Label>
          <Input
            id="ai-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Örn. Sonbahar kombin rehberi ve trend parçalar"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-keywords">Anahtar kelimeler</Label>
          <Input
            id="ai-keywords"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="sonbahar kombin, trençkot, bot"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-audience">Hedef kitle</Label>
          <Input
            id="ai-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="25-40 yaş, şehirli kadın müşteri"
          />
        </div>
        <div className="space-y-2">
          <Label>Marka tonu</Label>
          <Select value={tone} onValueChange={(value) => setTone(value as Tone)}>
            <SelectTrigger>
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
          <Label>Uzunluk</Label>
          <Select value={length} onValueChange={(value) => setLength(value as Length)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTHS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex items-center gap-3">
          <Switch id="ai-products" checked={includeProducts} onCheckedChange={setIncludeProducts} />
          <Label htmlFor="ai-products" className="text-sm font-normal">
            Mağaza ürünlerini içerikte öner
          </Label>
        </div>
        <Button
          type="button"
          disabled={draft.isPending || topic.trim().length < 3}
          onClick={() => draft.mutate()}
        >
          <Wand2 className="mr-2 size-4" />
          {draft.isPending ? "Yazı üretiliyor…" : "Taslak üret"}
        </Button>
      </div>

      {outline.length > 0 ? (
        <div className="bg-muted/40 rounded-xl p-4">
          <p className="mb-2 text-sm font-medium">Yazı planı</p>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            {outline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
