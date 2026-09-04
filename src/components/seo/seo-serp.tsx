import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/** Google SERP önizlemesi + karakter/pixel analizi. */

const CHAR_WIDTH = 7.6; // ortalama piksel genişliği (Arial 16px)

function verdict(length: number, min: number, ideal: number, max: number) {
  if (length === 0) return { label: "boş", tone: "destructive" as const };
  if (length < min) return { label: "kısa", tone: "secondary" as const };
  if (length > max) return { label: "uzun", tone: "destructive" as const };
  if (length >= ideal) return { label: "ideal", tone: "default" as const };
  return { label: "kabul edilebilir", tone: "secondary" as const };
}

export function SeoSerpPreview({
  title,
  description,
  url,
  siteName,
}: {
  title: string;
  description: string;
  url: string;
  siteName?: string;
}) {
  const titleVerdict = verdict(title.length, 30, 50, 60);
  const descVerdict = verdict(description.length, 70, 120, 160);
  const titlePixels = Math.round(title.length * CHAR_WIDTH);
  const descPixels = Math.round(description.length * CHAR_WIDTH * 0.82);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-xs text-muted-foreground">{siteName ? `${siteName} · ` : ""}{url}</p>
        <p className="mt-1 line-clamp-2 text-lg leading-snug text-[color:var(--serp-title,#1a0dab)]">
          {title || "Başlık girilmedi"}
        </p>
        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
          {description || "Meta açıklama girilmedi. Arama sonucunda Google sayfa içeriğinden bir metin seçer."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Başlık</p>
            <Badge variant={titleVerdict.tone === "default" ? "secondary" : titleVerdict.tone}>
              {titleVerdict.label}
            </Badge>
          </div>
          <Progress className="mt-2" value={Math.min(100, (title.length / 60) * 100)} />
          <p className="mt-2 text-xs text-muted-foreground">
            {title.length}/60 karakter · ~{titlePixels}px (sınır 580px)
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Açıklama</p>
            <Badge variant={descVerdict.tone === "default" ? "secondary" : descVerdict.tone}>
              {descVerdict.label}
            </Badge>
          </div>
          <Progress className="mt-2" value={Math.min(100, (description.length / 160) * 100)} />
          <p className="mt-2 text-xs text-muted-foreground">
            {description.length}/160 karakter · ~{descPixels}px (sınır 990px)
          </p>
        </div>
      </div>
    </div>
  );
}
