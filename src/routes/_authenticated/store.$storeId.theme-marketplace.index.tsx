import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, Loader2, Search, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageRenderer } from "@/components/theme-v2/page-renderer";
import { useRenderCtx } from "@/components/theme-v2/use-render-ctx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney as formatCurrency } from "@/lib/mefti";
import { CATEGORY_LABEL, TEMPLATE_CATEGORIES } from "@/lib/theme-system-v2";
import { tsInstallTemplate, tsListTemplates } from "@/lib/theme-system-v2.functions";
import { presetToPages } from "@/lib/theme-v2";
import { cn } from "@/lib/utils";

const DESCRIPTION = "Ücretsiz ve ücretli temaları ara, önizle ve mağazanın tema kütüphanesine tek tıkla ekle.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-marketplace/")({
  head: () => ({
    meta: [
      { title: "Tema Marketi — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Marketi — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketplacePage,
});

type Template = Awaited<ReturnType<typeof tsListTemplates>>[number];

function MarketplacePage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(tsListTemplates);
  const install = useServerFn(tsInstallTemplate);
  const ctx = useRenderCtx(storeId);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [price, setPrice] = useState<"all" | "free" | "paid">("all");

  const query = useQuery({
    queryKey: ["ts-templates", storeId, q, category, price],
    queryFn: () => list({ data: { storeId, q: q.trim() || undefined, category, price } }),
    retry: false,
  });

  const install$ = useMutation({
    mutationFn: (tpl: Template) => install({ data: { storeId, templateId: tpl.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ts-library", storeId] });
      toast.success("Tema kütüphanene taslak olarak eklendi.");
      void navigate({ to: "/store/$storeId/theme-library", params: { storeId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Tema yüklenemedi."),
  });

  return (
    <AppShell storeId={storeId} title="Tema Marketi" description={DESCRIPTION}
      actions={<Button asChild variant="outline"><Link to="/store/$storeId/theme-library" params={{ storeId }}>Tema Kütüphanem</Link></Button>}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tema ara..." className="h-11 pl-9" aria-label="Tema ara" />
          </div>
          <Select value={price} onValueChange={(v) => setPrice(v as typeof price)}>
            <SelectTrigger className="h-11 sm:w-44" aria-label="Fiyat filtresi"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm fiyatlar</SelectItem>
              <SelectItem value="free">Ücretsiz</SelectItem>
              <SelectItem value="paid">Ücretli</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Kategori">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button key={c.value} type="button" role="tab" aria-selected={category === c.value} onClick={() => setCategory(c.value)}
              className={cn("h-10 shrink-0 rounded-full border px-4 text-sm", category === c.value ? "border-foreground bg-foreground text-background" : "bg-background")}>
              {c.label}
            </button>
          ))}
        </div>

        {query.isError ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : "Marketplace açılamadı."}</p>
        ) : query.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div>
        ) : !query.data?.length ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Aramana uyan tema bulunamadı.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} storeId={storeId} ctx={ctx} busy={install$.isPending} onInstall={() => install$.mutate(tpl)} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TemplateCard({ tpl, storeId, ctx, busy, onInstall }: { tpl: Template; storeId: string; ctx: ReturnType<typeof useRenderCtx>; busy: boolean; onInstall: () => void }) {
  const paid = Number(tpl.price) > 0;
  return (
    <Card className="overflow-hidden">
      <Link to="/store/$storeId/theme-marketplace/$templateId" params={{ storeId, templateId: tpl.id }} className="block h-52 overflow-hidden border-b bg-muted/30" aria-label={`${tpl.name} detay`}>
        {tpl.preview_image_url ? <img src={tpl.preview_image_url} alt={tpl.name} loading="lazy" className="size-full object-cover object-top" /> : <MiniPreview structure={tpl.structure_json} ctx={ctx} />}
      </Link>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{tpl.name}</h3>
            <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[tpl.category] ?? tpl.category} · {tpl.author}</p>
          </div>
          {tpl.is_featured ? <Badge variant="secondary">Öne çıkan</Badge> : null}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1"><Star className="size-4 fill-current" aria-hidden />{Number(tpl.rating_avg).toFixed(1)} <span className="text-muted-foreground">({tpl.rating_count})</span></span>
          <span className="font-semibold">{paid ? formatCurrency(Number(tpl.price), tpl.currency) : "Ücretsiz"}</span>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-11 flex-1"><Link to="/store/$storeId/theme-marketplace/$templateId" params={{ storeId, templateId: tpl.id }}><Eye className="mr-1 size-4" />Önizle</Link></Button>
          {paid ? (
            <Button asChild className="h-11 flex-1"><Link to="/store/$storeId/theme-store" params={{ storeId }}><ShoppingBag className="mr-1 size-4" />Satın al</Link></Button>
          ) : (
            <Button className="h-11 flex-1" disabled={busy} onClick={onInstall}><Download className="mr-1 size-4" />Yükle</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Görseli olmayan şablonlar için yapıdan küçük canlı önizleme. */
function MiniPreview({ structure, ctx }: { structure: unknown; ctx: ReturnType<typeof useRenderCtx> }) {
  const parsed = useMemo(() => { let n = 0; return presetToPages(structure, () => `m-${n++}`); }, [structure]);
  return (
    <div className="pointer-events-none origin-top-left scale-[0.35]" style={{ width: "286%" }}>
      <PageRenderer sections={parsed.pages["home"] ?? []} settings={parsed.settings} ctx={ctx} />
    </div>
  );
}
