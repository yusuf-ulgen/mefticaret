import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Smartphone } from "lucide-react";

import { PagesManager } from "@/components/pages-manager";
import { PlatformPagesManager } from "@/components/platform-pages-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { platformPagesQuery } from "@/lib/platform-pages-queries";
import { storePagesQuery } from "@/lib/pages-queries";

/**
 * Mobil uygulama panelindeki "Sayfalar" sekmesi: mağaza ve platform içerik
 * sayfaları burada düzenlenir, telefon önizlemesinde nasıl göründüğü görülür.
 * Yayınlanan sayfalar mobil uygulamanın menüsüne ve vitrine otomatik yansır.
 */
export function MobilePagesPanel({
  storeId,
  storeSlug,
  branding,
}: {
  storeId: string;
  storeSlug?: string | undefined;
  branding?: { background: string; text: string; primary: string } | undefined;
}) {
  const { data: storePages } = useQuery(storePagesQuery(storeId));
  const { data: platformPages } = useQuery(platformPagesQuery());

  const items = useMemo(
    () => [
      ...(storePages ?? [])
        .filter((page) => page.is_published)
        .map((page) => ({
          key: `store-${page.id}`,
          scope: "Mağaza",
          title: page.title,
          body: page.body ?? "",
          href: storeSlug ? `/s/${storeSlug}/page/${page.slug}` : undefined,
        })),
      ...(platformPages ?? [])
        .filter((page) => page.is_published)
        .map((page) => ({
          key: `platform-${page.id}`,
          scope: "Platform",
          title: page.title,
          body: page.body ?? "",
          href: `/sayfa/${page.slug}`,
        })),
    ],
    [storePages, platformPages, storeSlug],
  );

  const about = items.find((item) => item.title.toLocaleLowerCase("tr").includes("hakkımızda"));
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = items.find((item) => item.key === activeKey) ?? about ?? items[0];

  const bg = branding?.background ?? "#ffffff";
  const fg = branding?.text ?? "#111111";
  const primary = branding?.primary ?? "#111111";

  return (
    <div className="space-y-6">
      <div className="surface-card p-4">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Mobil sayfa önizleme</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Yayınladığın sayfalar mobil uygulamanın menüsünde ve mağaza vitrininde otomatik listelenir.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y rounded-lg border">
            {items.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Henüz yayınlanmış sayfa yok.</li>
            ) : (
              items.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2 p-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setActiveKey(item.key)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <Badge variant="secondary">{item.scope}</Badge>
                    </span>
                  </button>
                  {item.href ? (
                    <Button asChild variant="ghost" size="icon" aria-label="Sayfayı aç">
                      <a href={item.href} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          <div
            className="mx-auto w-[300px] overflow-hidden rounded-[2rem] border-8 border-foreground/80 shadow-lg"
            style={{ background: bg, color: fg }}
          >
            <div className="h-6" style={{ background: primary }} />
            <div className="h-[430px] overflow-y-auto p-4">
              {active ? (
                <>
                  <h3 className="text-lg font-semibold">{active.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line opacity-80">
                    {active.body || "Bu sayfanın içeriği henüz boş."}
                  </p>
                </>
              ) : (
                <p className="text-sm opacity-70">Önizlemek için bir sayfa seç.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold">Mağaza sayfaları</h3>
        <PagesManager storeId={storeId} storeSlug={storeSlug} />
      </div>

      <div>
        <h3 className="mb-2 text-base font-semibold">Platform sayfaları</h3>
        <p className="mb-2 text-sm text-muted-foreground">
          Mefticaret'in kurumsal sayfaları (Hakkımızda, KVKK, İletişim) — yalnızca süper yönetici
          düzenleyebilir.
        </p>
        <PlatformPagesManager />
      </div>
    </div>
  );
}
