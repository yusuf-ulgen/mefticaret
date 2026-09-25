import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PageRenderer, type V2RenderContext } from "@/components/theme-v2/page-renderer";
import { presetToPages } from "@/lib/theme-v2";

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70&fm=webp`;
const P = (i: number, title: string, price: number, cmp: number | null, a: string, b: string, tags: string[] = []) => ({
  id: `demo-${i}`, title, slug: `ornek-${i}`, base_price: price, compare_at_price: cmp, currency: "TRY", tags, coverUrl: img(a), secondUrl: img(b), stockTotal: 10,
});
const PRODUCTS = [
  P(1, "Örnek Siyah Maxi Elbise", 1299, 1899, "1595777457583-95e059d581b8", "1539008835657-9e8e9680c956", ["yeni"]),
  P(2, "Örnek Keten Gömlek", 749, null, "1596755094514-f87e34085b2c", "1602810318383-e386cc2a3ccf"),
  P(3, "Örnek Yün Kaban", 2499, 3299, "1539533018447-63fcce2678e3", "1548624313-0396c75e4b1a"),
  P(4, "Örnek Triko Kazak", 899, null, "1576566588028-4147f3842f27", "1434389677669-e08b4cac3105", ["yeni"]),
  P(5, "Örnek Pileli Etek", 649, 899, "1583496661160-fb5886a0aaaa", "1577900232427-18219b9166a0"),
  P(6, "Örnek Deri Çanta", 1599, null, "1548036328-c9fa89d128fa", "1584917865442-de89df76afd3"),
];
const COLLECTIONS = ["Kadın", "Erkek", "Çocuk", "Spor", "Sale"].map((t, i) => ({ id: `c${i}`, title: t, slug: t.toLowerCase() }));

export const Route = createFileRoute("/demo/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase.from("v2_theme_templates").select("name, slug, description, structure_json").eq("slug", params.slug).eq("is_published", true).maybeSingle();
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `${loaderData.name} Teması Canlı Demo — Mefticaret` : "Tema bulunamadı — Mefticaret";
    const desc = loaderData?.description || "Mefticaret hazır tema canlı demosu.";
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: `https://mefticaret.com/demo/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://mefticaret.com/demo/${params.slug}` }],
    };
  },
  notFoundComponent: () => <div className="p-10 text-center">Tema bulunamadı.</div>,
  component: DemoPage,
});

function DemoPage() {
  const tpl = Route.useLoaderData();
  const { settings, pages } = presetToPages(tpl.structure_json, () => crypto.randomUUID());
  const ctx: V2RenderContext = { storeSlug: "demo", currency: "TRY", products: PRODUCTS, collections: COLLECTIONS };
  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 text-sm backdrop-blur">
        <span className="min-w-0 truncate"><b>{tpl.name}</b> canlı demo · ürünler ve metinler örnektir</span>
        <Link to="/auth" className="shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background">Bu Temayı Kur</Link>
      </div>
      <PageRenderer sections={pages["home"] ?? []} settings={settings} ctx={ctx} />
    </div>
  );
}
