import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Languages, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPORT_LOCALES } from "@/lib/global-commerce";
import { runTranslationStudio } from "@/lib/global-suite.functions";

type StudioResult = Awaited<ReturnType<typeof runTranslationStudio>>;

/** AI Çeviri Stüdyosu — ürün başlığı, açıklaması ve SEO metaları tek tıkla çevrilir. */
export function AiTranslationStudio({ storeId }: { storeId: string }) {
  const [locale, setLocale] = useState("en");
  const [result, setResult] = useState<StudioResult | null>(null);

  const translate = useMutation({
    mutationFn: () => runTranslationStudio({ data: { storeId, locale, limit: 120 } } as never),
    onSuccess: (data) => {
      setResult(data as StudioResult);
      toast.success(
        `${(data as StudioResult).translated} metin çevrildi, ${(data as StudioResult).remaining} metin kaldı`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dir = result?.dir ?? "ltr";
  // Aynı metin birden çok üründe geçebilir; önizlemede tekrarları gizle.
  const preview = (result?.preview ?? []).filter(
    (row, index, list) =>
      list.findIndex((other) => other.source === row.source && other.target === row.target) === index,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-4" /> AI Çeviri Stüdyosu
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ürün başlıkları, açıklamaları ve SEO metaları hedef dile çevrilir. Arapça, Farsça ve İbranice
          seçildiğinde vitrin otomatik olarak sağdan sola döner.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-48">
            <Label htmlFor="studio-locale">Hedef dil</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger id="studio-locale" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_LOCALES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.label} ({entry.code.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => translate.mutate()} disabled={translate.isPending}>
            <Languages className="mr-2 size-4" />
            {translate.isPending ? "Çeviriliyor…" : "Tek tıkla çevir"}
          </Button>
        </div>
      </div>

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Çevrilen", value: result.translated },
              { label: "Yeniden kullanılan", value: result.reused },
              { label: "Başarısız", value: result.failed },
              { label: "Kalan", value: result.remaining },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Çeviri önizlemesi</h3>
              <Badge variant="outline">
                {result.locale.toUpperCase()} · {dir === "rtl" ? "Sağdan sola (RTL)" : "Soldan sağa"}
              </Badge>
            </div>
            {preview.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Önizlenecek çeviri bulunamadı.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {preview.map((row, index) => (
                  <li key={`${row.field}-${index}`} className="grid gap-2 py-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        {row.contentType} · {row.field}
                      </p>
                      <p className="mt-1 text-sm">{row.source}</p>
                    </div>
                    <div dir={dir} className={dir === "rtl" ? "text-right" : ""}>
                      <p className="text-xs uppercase text-muted-foreground">{result.locale.toUpperCase()}</p>
                      <p className="mt-1 text-sm font-medium">{row.target}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
