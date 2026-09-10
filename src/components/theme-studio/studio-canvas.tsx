import { Monitor, Smartphone, Tablet } from "lucide-react";

import { StorefrontSections, type SectionProduct } from "@/components/storefront-sections";
import { designCss, type DesignTokens } from "@/lib/theme-design";
import type { ResolvedSection } from "@/lib/theme-sections";
import { cn } from "@/lib/utils";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewPage = "home" | "product" | "collection" | "cart" | "search";

export const PREVIEW_DEVICES: { value: PreviewDevice; label: string; icon: typeof Monitor; width: number | null }[] = [
  { value: "desktop", label: "Masaüstü", icon: Monitor, width: null },
  { value: "tablet", label: "Tablet", icon: Tablet, width: 834 },
  { value: "mobile", label: "Mobil", icon: Smartphone, width: 390 },
];

export const PREVIEW_PAGES: { value: PreviewPage; label: string }[] = [
  { value: "home", label: "Ana sayfa" },
  { value: "product", label: "Ürün sayfası" },
  { value: "collection", label: "Kategori sayfası" },
  { value: "cart", label: "Sepet" },
  { value: "search", label: "Arama" },
];

const INSPECTOR_CSS =
  ".sf-pick [data-section-id]{position:relative;cursor:pointer;outline:1px dashed color-mix(in oklch, currentColor 25%, transparent);outline-offset:-2px}" +
  ".sf-pick [data-section-id]:hover{outline:2px solid oklch(0.55 0.2 265);outline-offset:-2px}";

/** Orta panel: seçili cihaz genişliğinde canlı vitrin önizlemesi. */
export function StudioCanvas({
  device,
  page,
  zoom,
  inspector,
  pagePath,
  sections,
  designTokens,
  theme,
  storeSlug,
  storeName,
  storeCurrency,
  products,
  collections,
  commerce,
  onPickSection,
}: {
  device: PreviewDevice;
  page: PreviewPage;
  zoom: number;
  inspector: boolean;
  pagePath: string | null;
  sections: ResolvedSection[];
  designTokens: DesignTokens | null;
  theme: unknown;
  storeSlug: string;
  storeName: string;
  storeCurrency: string;
  products: SectionProduct[];
  collections: { id: string; title: string; slug: string; description: string | null }[];
  commerce: Parameters<typeof StorefrontSections>[0]["context"]["commerce"];
  onPickSection: (id: string) => void;
}) {
  const width = PREVIEW_DEVICES.find((entry) => entry.value === device)?.width ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/40 p-2 sm:p-5">
      <div
        className="mx-auto w-full origin-top transition-[max-width,transform] duration-300"
        style={{ maxWidth: width ? `${width}px` : "100%", transform: `scale(${zoom})` }}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {pagePath && page !== "home" ? (
            <iframe key={pagePath} title="Sayfa önizlemesi" src={pagePath} className="h-[calc(100vh-10rem)] w-full border-0" />
          ) : (
            <div
              className={cn(inspector && "sf-pick")}
              onClick={
                inspector
                  ? (event) => {
                      const target = (event.target as HTMLElement).closest("[data-section-id]");
                      const id = target?.getAttribute("data-section-id");
                      if (id) {
                        event.preventDefault();
                        onPickSection(id);
                      }
                    }
                  : undefined
              }
            >
              {designTokens ? <style dangerouslySetInnerHTML={{ __html: designCss(designTokens) }} /> : null}
              {inspector ? <style dangerouslySetInnerHTML={{ __html: INSPECTOR_CSS }} /> : null}
              <StorefrontSections
                sections={sections.filter((section) => section.isEnabled)}
                context={{
                  theme: (theme ?? null) as never,
                  storeSlug,
                  storeName,
                  storeCurrency,
                  products,
                  collections,
                  pages: [],
                  commerce,
                  preview: true,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {page !== "home" ? (
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
          {pagePath
            ? "Bu sayfa gerçek vitrinden gelir; bölüm değişiklikleri kaydedildikten sonra yansır."
            : "Bu sayfayı önizlemek için önce ilgili ürün ya da kategori kaydı gerekiyor."}
        </p>
      ) : null}
    </div>
  );
}
