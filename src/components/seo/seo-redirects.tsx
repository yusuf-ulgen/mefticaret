import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/seo/seo-shared";
import { formatNumber } from "@/lib/mefti";
import type { SeoRedirect } from "@/lib/seo-management-queries";

export function SeoRedirectsTab({
  rows,
  source,
  target,
  code,
  setSource,
  setTarget,
  setCode,
  add,
  remove,
  pending,
}: {
  rows: SeoRedirect[];
  source: string;
  target: string;
  code: "301" | "302";
  setSource: (value: string) => void;
  setTarget: (value: string) => void;
  setCode: (value: "301" | "302") => void;
  add: () => void;
  remove: (id: string) => void;
  pending: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
      <form
        className="surface-card h-fit space-y-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <div>
          <p className="eyebrow">Yeni kural</p>
          <h2 className="mt-1 font-display text-lg font-semibold">Yönlendirme ekle</h2>
        </div>
        <Field label="Kaynak yol" id="redirect-source" hint="Örn. /eski-urun-adresi">
          <Input
            id="redirect-source"
            required
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="/eski-adres"
          />
        </Field>
        <Field label="Hedef yol" id="redirect-target" hint="Site içi yol veya tam https adresi">
          <Input
            id="redirect-target"
            required
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="/yeni-adres"
          />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">Yönlendirme tipi</p>
          <Select value={code} onValueChange={(value) => setCode(value as "301" | "302")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="301">301 — Kalıcı (SEO değeri aktarılır)</SelectItem>
              <SelectItem value="302">302 — Geçici</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="gap-2" disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "Kaydediliyor..." : "Yönlendirmeyi kaydet"}
        </Button>
      </form>

      <section className="surface-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-medium">Tanımlı yönlendirmeler</h2>
          <Badge variant="secondary">{formatNumber(rows.length)} kural</Badge>
        </div>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Henüz yönlendirme yok. 404 sekmesindeki kayıtlardan tek tıkla kural oluşturabilirsiniz.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-[260px] flex-1">
                  <p className="text-sm font-medium">{row.source_path}</p>
                  <p className="text-xs text-muted-foreground">→ {row.target_path}</p>
                </div>
                <Badge variant={row.status_code === 301 ? "secondary" : "outline"}>{row.status_code}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(row.hit_count)} isabet
                </span>
                {!row.is_active ? <Badge variant="outline">Pasif</Badge> : null}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Yönlendirmeyi sil"
                  onClick={() => remove(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
