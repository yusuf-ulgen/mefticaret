import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/seo/seo-shared";
import type { StoreSeoSettings, StoreSeoUrlStructure } from "@/lib/seo";

const productOptions = [
  { value: "product", label: "/p/urun-adi", hint: "Kısa ve öneriler için en güvenli yapı" },
  { value: "category-product", label: "/kategori/urun-adi", hint: "Kategori bağlamını URL'ye taşır" },
  { value: "short", label: "/urun-adi", hint: "En kısa yapı, çakışma riski daha yüksek" },
] as const;

export function SeoUrlsTab({
  current,
  storeSlug,
  updateSeo,
  save,
  pending,
}: {
  current: StoreSeoSettings;
  storeSlug: string;
  updateSeo: (patch: Partial<StoreSeoSettings>) => void;
  save: () => void;
  pending: boolean;
}) {
  const structure: StoreSeoUrlStructure = current.urlStructure ?? {};
  const productStyle = structure.product ?? "product";
  const base = `/s/${storeSlug}`;
  const productExample =
    productStyle === "category-product"
      ? `${base}/ayakkabi/hafif-kosu-ayakkabisi`
      : productStyle === "short"
        ? `${base}/hafif-kosu-ayakkabisi`
        : `${base}/p/hafif-kosu-ayakkabisi`;

  const setStructure = (patch: Partial<StoreSeoUrlStructure>) =>
    updateSeo({ urlStructure: { ...structure, ...patch } });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <section className="surface-card space-y-5 p-6">
        <div>
          <p className="eyebrow">Bağlantı yapısı</p>
          <h2 className="mt-1 font-display text-lg font-semibold">URL ve permalink kuralları</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yapıyı değiştirdiğinizde eski adresler için 301 yönlendirmesi eklemeyi unutmayın.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Ürün adresleri</Label>
          <Select value={productStyle} onValueChange={(value) => setStructure({ product: value as "product" })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} — {option.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Koleksiyon adresleri</Label>
          <Select
            value={structure.collection ?? "collection"}
            onValueChange={(value) => setStructure({ collection: value as "collection" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="collection">/c/koleksiyon-adi</SelectItem>
              <SelectItem value="short">/koleksiyon-adi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Blog adresleri</Label>
          <Select
            value={structure.blog ?? "blog"}
            onValueChange={(value) => setStructure({ blog: value as "blog" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blog">/blog/yazi-adi</SelectItem>
              <SelectItem value="page">/page/yazi-adi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Dil ön eki kullan</p>
            <p className="text-xs text-muted-foreground">Çok dilli mağazalarda /tr, /en ön eki eklenir.</p>
          </div>
          <Switch
            checked={Boolean(structure.localePrefix)}
            onCheckedChange={(checked) => setStructure({ localePrefix: checked })}
          />
        </div>

        <Field
          label="robots.txt ek kuralları"
          id="seo-robots"
          hint="Her satıra bir kural yazın. Platform temel kuralları otomatik eklenir."
        >
          <Textarea
            id="seo-robots"
            rows={6}
            value={current.robotsExtra ?? ""}
            onChange={(event) => updateSeo({ robotsExtra: event.target.value })}
            placeholder={"Disallow: /kampanya-taslak\nDisallow: /*?filter="}
          />
        </Field>

        <Button onClick={save} disabled={pending}>
          {pending ? "Kaydediliyor..." : "URL ve robots ayarlarını kaydet"}
        </Button>
      </section>

      <aside className="surface-card h-fit space-y-4 p-6">
        <p className="eyebrow">Örnek adresler</p>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Ürün</p>
          <code className="block rounded bg-muted/50 px-2 py-1 text-xs">{productExample}</code>
          <p className="font-medium">Koleksiyon</p>
          <code className="block rounded bg-muted/50 px-2 py-1 text-xs">
            {structure.collection === "short" ? `${base}/yeni-sezon` : `${base}/c/yeni-sezon`}
          </code>
          <p className="font-medium">Blog</p>
          <code className="block rounded bg-muted/50 px-2 py-1 text-xs">
            {structure.blog === "page" ? `${base}/page/kargo-rehberi` : `${base}/blog/kargo-rehberi`}
          </code>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium">robots.txt</p>
          <a
            className="mt-1 inline-block text-xs underline underline-offset-4"
            href={`/api/public/robots/${storeSlug}`}
            target="_blank"
            rel="noreferrer"
          >
            Yayındaki robots.txt dosyasını aç
          </a>
        </div>
      </aside>
    </div>
  );
}
