import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  seoTemplateDefaults,
  seoTemplateLabels,
  seoTemplateVariables,
  type SeoTemplateKey,
} from "@/components/seo/seo-shared";
import { SeoSerpPreview } from "@/components/seo/seo-serp";
import type { SeoTemplate, StoreSeoSettings } from "@/lib/seo";
import { interpolateSeoTemplate } from "@/lib/seo-template";

export function SeoMetaTab({
  current,
  templateKey,
  storeName,
  previewUrl,
  pending,
  setTemplateKey,
  updateSeo,
  updateTemplate,
  save,
}: {
  current: StoreSeoSettings;
  templateKey: SeoTemplateKey;
  storeName: string;
  previewUrl: string;
  pending: boolean;
  setTemplateKey: (key: SeoTemplateKey) => void;
  updateSeo: (patch: Partial<StoreSeoSettings>) => void;
  updateTemplate: (field: "title" | "description", value: string) => void;
  save: () => void;
}) {
  const template: SeoTemplate = current.templates?.[templateKey] ?? seoTemplateDefaults[templateKey];
  const sampleVariables = {
    product_name: "Hafif Koşu Ayakkabısı",
    product_type: "Ayakkabı",
    brand_name: "Mefti Sport",
    collection_name: "Yeni Sezon",
    page_title: "Kargo ve Teslimat",
    page_excerpt: "Siparişleriniz 24 saat içinde kargoya verilir.",
    author_name: "Editör",
    product_count: 24,
    price: "1.499 TL",
    store_name: storeName,
  };
  const templatePreviewTitle = interpolateSeoTemplate(template.title, sampleVariables);
  const templatePreviewDescription = interpolateSeoTemplate(template.description, sampleVariables);

  return (
    <>
      <div className="space-y-6">
        <section className="surface-card space-y-5 p-6">
          <div>
            <p className="eyebrow">Ana sayfa</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Arama sonucu bilgileri</h2>
          </div>
          <Field
            label="Ana sayfa başlığı"
            id="seo-home-title"
            hint={`${(current.homeTitle ?? "").length}/60 karakter`}
          >
            <Input
              id="seo-home-title"
              maxLength={60}
              value={current.homeTitle ?? ""}
              onChange={(event) => updateSeo({ homeTitle: event.target.value })}
              placeholder="Mağazanız | Kısa değer önerisi"
            />
          </Field>
          <Field
            label="Meta açıklaması"
            id="seo-home-description"
            hint={`${(current.homeDescription ?? "").length}/160 karakter`}
          >
            <Textarea
              id="seo-home-description"
              maxLength={160}
              rows={4}
              value={current.homeDescription ?? ""}
              onChange={(event) => updateSeo({ homeDescription: event.target.value })}
              placeholder="Mağazanızı ve ürünlerinizi kısaca anlatın."
            />
          </Field>
          <Field label="Anahtar kelimeler" id="seo-keywords">
            <Input
              id="seo-keywords"
              value={current.keywords ?? ""}
              onChange={(event) => updateSeo({ keywords: event.target.value })}
              placeholder="spor ayakkabı, kadın giyim, online mağaza"
            />
          </Field>
          <Field label="Varsayılan sosyal paylaşım görseli" id="seo-og-image">
            <Input
              id="seo-og-image"
              type="url"
              value={current.defaultOgImage ?? ""}
              onChange={(event) => updateSeo({ defaultOgImage: event.target.value })}
              placeholder="https://..."
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Mağazayı arama motorlarından gizle</p>
              <p className="text-xs text-muted-foreground">
                Yalnızca hazırlık aşamasındaki mağazalarda kullanın.
              </p>
            </div>
            <Switch
              checked={Boolean(current.noindexStore)}
              onCheckedChange={(checked) => updateSeo({ noindexStore: checked })}
            />
          </div>
          <Button onClick={save} disabled={pending}>
            {pending ? "Kaydediliyor..." : "SEO ayarlarını kaydet"}
          </Button>
        </section>

        <section className="surface-card space-y-5 p-6">
          <div>
            <p className="eyebrow">Dinamik içerik</p>
            <h2 className="mt-1 font-display text-lg font-semibold">Meta şablonları</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Değişkenler yayınlanan sayfalarda gerçek ürün ve içerik verileriyle doldurulur.
            </p>
          </div>
          <Select value={templateKey} onValueChange={(value) => setTemplateKey(value as SeoTemplateKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(seoTemplateLabels) as SeoTemplateKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {seoTemplateLabels[key]} sayfaları
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Field label="Başlık şablonu" id="seo-template-title">
            <Input
              id="seo-template-title"
              value={template.title ?? ""}
              onChange={(event) => updateTemplate("title", event.target.value)}
            />
          </Field>
          <Field label="Açıklama şablonu" id="seo-template-description">
            <Textarea
              id="seo-template-description"
              rows={4}
              value={template.description ?? ""}
              onChange={(event) => updateTemplate("description", event.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Kullanılabilir değişkenler</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {seoTemplateVariables[templateKey].map((variable) => (
                <code
                  key={variable}
                  className="rounded bg-background px-2 py-1 text-xs text-muted-foreground"
                >
                  {"{{"}
                  {variable}
                  {"}}"}
                </code>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Örnek çıktı</p>
            <p className="mt-2 text-sm font-medium">{templatePreviewTitle || "Başlık şablonu boş"}</p>
            <p className="text-xs text-muted-foreground">
              {templatePreviewDescription || "Açıklama şablonu boş"}
            </p>
          </div>
          <Button onClick={save} disabled={pending} variant="outline">
            {pending ? "Kaydediliyor..." : "Şablonları kaydet"}
          </Button>
        </section>
      </div>

      <aside className="surface-card h-fit space-y-4 p-6">
        <p className="eyebrow">Google önizlemesi</p>
        <SeoSerpPreview
          title={current.homeTitle || storeName}
          description={current.homeDescription ?? ""}
          url={previewUrl}
          siteName={storeName}
        />
        <div className="space-y-3 border-t pt-4">
          <p className="eyebrow">Şablon önizlemesi</p>
          <SeoSerpPreview
            title={templatePreviewTitle}
            description={templatePreviewDescription}
            url={`${previewUrl}/p/hafif-kosu-ayakkabisi`}
            siteName={storeName}
          />
        </div>
      </aside>
    </>
  );
}
