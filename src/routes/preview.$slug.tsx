import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";

import { PageRenderer, type V2RenderContext } from "@/components/theme-v2/page-renderer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { storefrontQuery } from "@/lib/storefront-queries";
import { tsResolvePreview, tsThemeAction } from "@/lib/theme-system-v2.functions";
import type { V2Section } from "@/lib/theme-v2";

export const Route = createFileRoute("/preview/$slug")({
  validateSearch: (s) => z.object({ theme: z.string().catch(""), token: z.string().catch("") }).parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    if (!deps.theme || !deps.token) return { ok: false as const, message: "Önizleme bağlantısı eksik." };
    try {
      return await tsResolvePreview({ data: { slug: params.slug, themeId: deps.theme, token: deps.token } });
    } catch {
      return { ok: false as const, message: "Önizleme bağlantısı geçersiz." };
    }
  },
  head: () => ({
    meta: [
      { title: "Tema Önizlemesi — Mefticaret" },
      { name: "description", content: "Mağaza teması için paylaşılan, süreli önizleme bağlantısı." },
      { property: "og:title", content: "Tema Önizlemesi — Mefticaret" },
      { property: "og:description", content: "Mağaza teması için paylaşılan, süreli önizleme bağlantısı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: () => <Msg text="Önizleme açılamadı." />,
  notFoundComponent: () => <Msg text="Önizleme bulunamadı." />,
  component: PreviewPage,
});

function Msg({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="outline"><Link to="/">Ana sayfa</Link></Button>
    </main>
  );
}

function PreviewPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { data: storefront } = useQuery({ ...storefrontQuery(slug), enabled: data.ok });
  const session = useQuery({ queryKey: ["preview-session"], queryFn: async () => (await supabase.auth.getSession()).data.session, staleTime: 60_000 });
  const act = useServerFn(tsThemeAction);
  const publish = useMutation({
    mutationFn: () => {
      if (!data.ok) throw new Error("Önizleme yok.");
      return act({ data: { storeId: data.store.id, themeId: data.theme.id, action: "publish" } });
    },
    onSuccess: () => toast.success("Tema yayınlandı."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Yayınlama yetkin yok."),
  });

  const ctx = useMemo<V2RenderContext>(() => ({
    storeSlug: slug, currency: "TRY",
    products: (storefront?.products ?? []) as V2RenderContext["products"],
    collections: storefront?.collections ?? [],
    blogPages: (storefront?.blogPages ?? []) as NonNullable<V2RenderContext["blogPages"]>,
  }), [slug, storefront]);

  if (!data.ok) return <Msg text={data.message} />;
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-2 text-sm backdrop-blur">
        <span><strong>{data.store.name}</strong> · {data.theme.name} önizlemesi · {new Date(data.expires_at).toLocaleString("tr-TR")} tarihine kadar geçerli</span>
        {session.data ? <Button size="sm" className="h-10" disabled={publish.isPending || data.theme.status === "active"} onClick={() => publish.mutate()}>{data.theme.status === "active" ? "Zaten yayında" : "Bu Temayı Yayınla"}</Button> : null}
      </div>
      <PageRenderer sections={(data.pages["home"] ?? []) as unknown as V2Section[]} settings={data.settings} ctx={ctx} />
    </div>
  );
}
