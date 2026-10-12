import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiPlatformPost } from "@/lib/platform-blog.functions";

export type AiBlogResult = {
  title: string;
  metaTitle: string;
  slug: string;
  excerpt: string;
  seoDescription: string;
  body: string;
  tags: string[];
  category: string;
};

/** Süper yöneticiye özel: e-ticaret uzmanı AI yazar (yeni yazı, iyileştir, SEO doldur). */
export function PlatformBlogAi({
  currentTitle,
  currentBody,
  onResult,
}: {
  currentTitle: string;
  currentBody: string;
  onResult: (result: AiBlogResult) => void;
}) {
  const run = useServerFn(aiPlatformPost);
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("uzman");
  const [length, setLength] = useState("orta");
  const [busy, setBusy] = useState<string | null>(null);
  const hasBody = currentBody.trim().length >= 50;

  const go = async (mode: "new" | "improve" | "seo") => {
    setBusy(mode);
    try {
      const result = await run({
        data: { mode, topic, keywords, tone, length, currentTitle, currentBody },
      });
      onResult(result as AiBlogResult);
      toast.success(mode === "seo" ? "SEO alanları dolduruldu" : "Yazı hazır — kontrol edip kaydedin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI yazamadı");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/40 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-brand" /> AI E-Ticaret Yazarı
      </p>
      <div className="space-y-2">
        <Label htmlFor="ai-topic">Konu</Label>
        <Input
          id="ai-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Örn. Trendyol'da satışa başlamak için 10 adım"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="ai-kw">Anahtar kelimeler</Label>
          <Input id="ai-kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="virgülle" />
        </div>
        <div className="space-y-2">
          <Label>Ton</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uzman">Uzman</SelectItem>
              <SelectItem value="rehber">Adım adım rehber</SelectItem>
              <SelectItem value="samimi">Samimi</SelectItem>
              <SelectItem value="teknik">Teknik</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Uzunluk</Label>
          <Select value={length} onValueChange={setLength}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kisa">Kısa</SelectItem>
              <SelectItem value="orta">Orta</SelectItem>
              <SelectItem value="uzun">Uzun</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!!busy || topic.trim().length < 3} onClick={() => void go("new")}>
          {busy === "new" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Yazıyı yaz
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!!busy || !hasBody} onClick={() => void go("improve")}>
          {busy === "improve" ? <Loader2 className="size-4 animate-spin" /> : null} Mevcut yazıyı iyileştir
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!!busy || !hasBody} onClick={() => void go("seo")}>
          {busy === "seo" ? <Loader2 className="size-4 animate-spin" /> : null} SEO alanlarını doldur
        </Button>
      </div>
      {busy ? <p className="text-xs text-muted-foreground" aria-live="polite">Yazılıyor, 30-60 sn sürebilir…</p> : null}
    </div>
  );
}
