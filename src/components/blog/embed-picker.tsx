import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";

import type { EmbedAttrs } from "@/components/blog/blog-editor-nodes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchBlogEmbeds } from "@/lib/blog-v2.functions";
import { cn } from "@/lib/utils";

const VARIANTS: Array<{ key: EmbedAttrs["variant"]; label: string }> = [
  { key: "card", label: "Kart" },
  { key: "row", label: "Satır" },
  { key: "minimal", label: "Minimal" },
];

export function EmbedPicker({
  storeId,
  storeSlug,
  kind,
  onClose,
  onPick,
}: {
  storeId: string;
  storeSlug: string | null;
  kind: "product" | "collection" | null;
  onClose: () => void;
  onPick: (attrs: EmbedAttrs) => void;
}) {
  const search = useServerFn(searchBlogEmbeds);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [variant, setVariant] = useState<EmbedAttrs["variant"]>("card");
  const results = useQuery({
    queryKey: ["blog-embed", storeId, kind, q],
    enabled: kind !== null,
    queryFn: () => search({ data: { storeId, kind: kind ?? "product", q } }),
  });
  const pick = results.data?.find((r) => r.id === selected) ?? null;

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kind === "collection" ? "Koleksiyon ekle" : "Ürün kartı ekle"}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {results.isLoading ? (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Aranıyor…
            </p>
          ) : results.data?.length ? (
            results.data.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn("flex w-full items-center gap-3 rounded-lg border p-2 text-left text-sm", selected === r.id && "border-primary bg-primary/5")}
              >
                {r.image ? <img src={r.image} alt="" className="size-10 rounded object-cover" /> : <span className="size-10 rounded bg-muted" />}
                <span className="flex-1 truncate">{r.title}</span>
                {r.price !== null ? <span className="text-muted-foreground">₺{r.price.toLocaleString("tr-TR")}</span> : null}
              </button>
            ))
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Sonuç bulunamadı.</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Görünüm:</span>
          {VARIANTS.map((v) => (
            <Button key={v.key} type="button" size="sm" variant={variant === v.key ? "default" : "outline"} onClick={() => setVariant(v.key)}>
              {v.label}
            </Button>
          ))}
        </div>
        <Button
          disabled={!pick}
          onClick={() => {
            if (!pick) return;
            const base = storeSlug ? `/s/${storeSlug}` : "";
            onPick({
              kind: kind ?? "product",
              id: pick.id,
              title: pick.title,
              price: pick.price,
              image: pick.image,
              url: kind === "collection" ? `${base}/c/${pick.slug}` : `${base}/p/${pick.slug}`,
              variant,
            });
            setSelected(null);
          }}
        >
          Ekle
        </Button>
      </DialogContent>
    </Dialog>
  );
}
