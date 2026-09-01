import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { seoEntitiesQuery, type SeoEntity } from "@/lib/seo-entities-queries";
import { readStoreSeo, serpPreview, type FaqEntry, type SeoFields } from "@/lib/seo";
import { savePageSeoMeta, saveEntitySeo, saveStoreSeo } from "@/lib/seo.functions";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/seo-editor")({
  head: () => ({
    meta: [
      { title: "SEO Editörü — Mefticaret" },
      {
        name: "description",
        content:
          "Ana sayfa, ürün, kategori, koleksiyon, sayfa ve blog içerikleri için meta başlık, açıklama, Open Graph ve Schema.org ayarlarını düzenleyin.",
      },
      { property: "og:title", content: "SEO Editörü — Mefticaret" },
      {
        property: "og:description",
        content: "Her içerik için arama sonucu önizlemesiyle SEO alanlarını yönetin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeoEditorPage,
});

const KIND_LABELS: Record<SeoEntity["kind"], string> = {
  product: "Ürün",
  collection: "Kategori / Koleksiyon",
  page: "Sayfa",
  blog: "Blog yazısı",
};

function SeoEditorPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const { data: entities } = useQuery(seoEntitiesQuery(storeId));

  const storeSlug = store?.slug ?? "magaza";

  return (
    <AppShell
      title="SEO Editörü"
      description="Ana sayfa, ürünler, kategoriler, koleksiyonlar, sayfalar ve blog için meta etiketleri, sosyal paylaşım ve yapısal veri ayarları."
    >
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">Ana sayfa & Mağaza</TabsTrigger>
          <TabsTrigger value="schema">Yapısal veri</TabsTrigger>
          <TabsTrigger value="product">Ürünler</TabsTrigger>
          <TabsTrigger value="collection">Kategoriler</TabsTrigger>
          <TabsTrigger value="page">Sayfalar & Blog</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <StoreSeoForm storeId={storeId} storeSlug={storeSlug} seoJson={settings?.seo} tab="general" />
        </TabsContent>
        <TabsContent value="schema">
          <StoreSeoForm storeId={storeId} storeSlug={storeSlug} seoJson={settings?.seo} tab="schema" />
        </TabsContent>
        <TabsContent value="product">
          <EntityEditor
            storeId={storeId}
            storeSlug={storeSlug}
            rows={(entities ?? []).filter((row) => row.kind === "product")}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["seo-entities", storeId] })}
            urlPrefix="p"
          />
        </TabsContent>
        <TabsContent value="collection">
          <EntityEditor
            storeId={storeId}
            storeSlug={storeSlug}
            rows={(entities ?? []).filter((row) => row.kind === "collection")}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["seo-entities", storeId] })}
            urlPrefix="c"
          />
        </TabsContent>
        <TabsContent value="page">
          <EntityEditor
            storeId={storeId}
            storeSlug={storeSlug}
            rows={(entities ?? []).filter((row) => row.kind === "page" || row.kind === "blog")}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["seo-entities", storeId] })}
            urlPrefix="page"
            showPageMeta
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/** Google sonuç önizlemesi ve karakter sayaçları. */
function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const preview = serpPreview(title, description, url);
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">Arama sonucu önizlemesi</p>
      <p className="mt-2 truncate text-xs text-muted-foreground">{preview.url}</p>
      <p className="text-base font-medium text-primary">{preview.title || "Başlık girilmedi"}</p>
      <p className="text-sm text-muted-foreground">{preview.description || "Açıklama girilmedi"}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge variant={preview.titleOk ? "secondary" : "destructive"}>
          Başlık {preview.titleLength}/60
        </Badge>
        <Badge variant={preview.descriptionOk ? "secondary" : "destructive"}>
          Açıklama {preview.descriptionLength}/160
        </Badge>
      </div>
    </div>
  );
}

type StoreFormProps = {
  storeId: string;
  storeSlug: string;
  seoJson: unknown;
  tab: "general" | "schema";
};

function StoreSeoForm({ storeId, storeSlug, seoJson, tab }: StoreFormProps) {
  const saved = useMemo(() => readStoreSeo(seoJson), [seoJson]);
  const [form, setForm] = useState(saved);
  const save = useServerFn(saveStoreSeo);
  const queryClient = useQueryClient();

  useEffect(() => setForm(saved), [saved]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          ...(form.homeTitle ? { homeTitle: form.homeTitle } : {}),
          ...(form.homeDescription ? { homeDescription: form.homeDescription } : {}),
          ...(form.keywords ? { keywords: form.keywords } : {}),
          ...(form.defaultOgImage ? { defaultOgImage: form.defaultOgImage } : {}),
          noindexStore: Boolean(form.noindexStore),
          ...(form.robotsExtra ? { robotsExtra: form.robotsExtra } : {}),
          ...(form.organizationSameAs?.length ? { organizationSameAs: form.organizationSameAs } : {}),
          localBusinessEnabled: Boolean(form.localBusinessEnabled),
          ...(form.businessType ? { businessType: form.businessType } : {}),
          ...(form.priceRange ? { priceRange: form.priceRange } : {}),
          ...(form.openingHours?.length ? { openingHours: form.openingHours } : {}),
          latitude: form.latitude ?? null,
          longitude: form.longitude ?? null,
          faq: form.faq ?? [],
        },
      }),
    onSuccess: () => {
      toast.success("SEO ayarları kaydedildi.");
      queryClient.invalidateQueries({ queryKey: ["store-settings", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const faq = form.faq ?? [];
  const setFaq = (next: FaqEntry[]) => update("faq", next);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {tab === "general" ? (
          <section className="space-y-4 rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">Ana sayfa meta bilgileri</h2>
            <div className="space-y-2">
              <Label htmlFor="home-title">Meta başlık</Label>
              <Input
                id="home-title"
                value={form.homeTitle ?? ""}
                maxLength={120}
                placeholder="Örn. Nova Store — Yeni sezon kadın giyim"
                onChange={(event) => update("homeTitle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-description">Meta açıklama</Label>
              <Textarea
                id="home-description"
                rows={3}
                maxLength={400}
                value={form.homeDescription ?? ""}
                placeholder="Mağazanızı 160 karakterde özetleyin."
                onChange={(event) => update("homeDescription", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Anahtar kelimeler</Label>
              <Input
                id="keywords"
                value={form.keywords ?? ""}
                placeholder="kadın giyim, elbise, yeni sezon"
                onChange={(event) => update("keywords", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="og-image">Varsayılan paylaşım görseli (Open Graph / Twitter)</Label>
              <Input
                id="og-image"
                value={form.defaultOgImage ?? ""}
                placeholder="https://cdn.ornek.com/kapak.jpg"
                onChange={(event) => update("defaultOgImage", event.target.value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Arama motorlarına kapat</p>
                <p className="text-xs text-muted-foreground">
                  Açıldığında tüm vitrin sayfaları noindex olur ve robots.txt tümünü engeller.
                </p>
              </div>
              <Switch
                checked={Boolean(form.noindexStore)}
                onCheckedChange={(checked) => update("noindexStore", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="robots-extra">Ek robots.txt kuralları</Label>
              <Textarea
                id="robots-extra"
                rows={3}
                value={form.robotsExtra ?? ""}
                placeholder={"Disallow: /s/magaza/gizli\nCrawl-delay: 5"}
                onChange={(event) => update("robotsExtra", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sitemap adresiniz: <code>/api/public/sitemap/{storeSlug}</code>
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-4 rounded-lg border bg-card p-5">
              <h2 className="text-sm font-semibold">Organization</h2>
              <p className="text-xs text-muted-foreground">
                Marka adı, logo ve iletişim bilgileri mağaza ayarlarından okunur. Buradan sosyal medya
                profillerinizi (sameAs) ekleyin.
              </p>
              <Textarea
                rows={4}
                value={(form.organizationSameAs ?? []).join("\n")}
                placeholder={"https://instagram.com/magazam\nhttps://x.com/magazam"}
                onChange={(event) =>
                  update(
                    "organizationSameAs",
                    event.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  )
                }
              />
            </section>

            <section className="space-y-4 rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">LocalBusiness</h2>
                  <p className="text-xs text-muted-foreground">
                    Fiziksel mağazanız varsa yerel işletme yapısal verisi üretilir.
                  </p>
                </div>
                <Switch
                  checked={Boolean(form.localBusinessEnabled)}
                  onCheckedChange={(checked) => update("localBusinessEnabled", checked)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>İşletme türü</Label>
                  <Select
                    value={form.businessType ?? "LocalBusiness"}
                    onValueChange={(value) => update("businessType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["LocalBusiness", "Store", "ClothingStore", "ElectronicsStore", "Restaurant", "HealthAndBeautyBusiness"].map(
                        (type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price-range">Fiyat aralığı</Label>
                  <Input
                    id="price-range"
                    value={form.priceRange ?? ""}
                    placeholder="₺₺"
                    onChange={(event) => update("priceRange", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lat">Enlem</Label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    value={form.latitude ?? ""}
                    onChange={(event) =>
                      update("latitude", event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Boylam</Label>
                  <Input
                    id="lng"
                    inputMode="decimal"
                    value={form.longitude ?? ""}
                    onChange={(event) =>
                      update("longitude", event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Çalışma saatleri (her satır bir kural)</Label>
                <Textarea
                  rows={3}
                  value={(form.openingHours ?? []).join("\n")}
                  placeholder={"Mo-Fr 09:00-18:00\nSa 10:00-16:00"}
                  onChange={(event) =>
                    update(
                      "openingHours",
                      event.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </section>

            <section className="space-y-4 rounded-lg border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">FAQ (Sıkça sorulan sorular)</h2>
                  <p className="text-xs text-muted-foreground">
                    Ana sayfada FAQPage yapısal verisi olarak yayınlanır.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFaq([...faq, { question: "", answer: "" }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Soru ekle
                </Button>
              </div>

              {faq.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz soru eklenmedi.</p>
              ) : (
                <div className="space-y-3">
                  {faq.map((entry, index) => (
                    <div key={index} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={entry.question}
                          placeholder="Soru"
                          onChange={(event) =>
                            setFaq(
                              faq.map((item, i) =>
                                i === index ? { ...item, question: event.target.value } : item,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFaq(faq.filter((_, i) => i !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        value={entry.answer}
                        placeholder="Yanıt"
                        onChange={(event) =>
                          setFaq(
                            faq.map((item, i) => (i === index ? { ...item, answer: event.target.value } : item)),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? "Kaydediliyor…" : "SEO ayarlarını kaydet"}
        </Button>
      </div>

      <div className="space-y-4">
        <SerpPreview
          title={form.homeTitle ?? ""}
          description={form.homeDescription ?? ""}
          url={`/s/${storeSlug}`}
        />
        <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Otomatik üretilenler</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Canonical, Open Graph ve Twitter Card tüm vitrin sayfalarında</li>
            <li>Breadcrumb yapısal verisi ürün, koleksiyon ve sayfalarda</li>
            <li>Product, Organization, WebSite ve gerektiğinde LocalBusiness / FAQ / Article</li>
            <li>
              <code>/api/public/sitemap/{storeSlug}</code> ve <code>/api/public/robots/{storeSlug}</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

type EntityEditorProps = {
  storeId: string;
  storeSlug: string;
  rows: SeoEntity[];
  onSaved: () => void;
  urlPrefix: string;
  showPageMeta?: boolean;
};

function EntityEditor({ storeId, storeSlug, rows, onSaved, urlPrefix, showPageMeta }: EntityEditorProps) {
  const [term, setTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) => row.title.toLowerCase().includes(needle) || row.slug.toLowerCase().includes(needle),
    );
  }, [rows, term]);

  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="İçerik ara"
            className="pl-9"
          />
        </div>
        <div className="max-h-[560px] space-y-1 overflow-y-auto rounded-lg border bg-card p-2">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            filtered.map((row) => {
              const active = selected?.id === row.id;
              const complete = Boolean(row.seo.title && row.seo.description);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="block truncate font-medium">{row.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    /{row.slug}
                    <Badge variant={complete ? "secondary" : "outline"} className="text-[10px]">
                      {complete ? "SEO tam" : "Eksik"}
                    </Badge>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selected ? (
        <EntityForm
          key={selected.id}
          storeId={storeId}
          storeSlug={storeSlug}
          row={selected}
          urlPrefix={urlPrefix}
          onSaved={onSaved}
          showPageMeta={Boolean(showPageMeta)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Düzenlemek için soldan bir içerik seçin.</p>
      )}
    </div>
  );
}

function EntityForm({
  storeId,
  storeSlug,
  row,
  urlPrefix,
  onSaved,
  showPageMeta,
}: {
  storeId: string;
  storeSlug: string;
  row: SeoEntity;
  urlPrefix: string;
  onSaved: () => void;
  showPageMeta: boolean;
}) {
  const [seo, setSeo] = useState<SeoFields>(row.seo);
  const [pageKind, setPageKind] = useState<"page" | "blog">(row.kind === "blog" ? "blog" : "page");
  const [author, setAuthor] = useState(row.authorName ?? "");
  const [publishedAt, setPublishedAt] = useState((row.publishedAt ?? "").slice(0, 10));

  const saveEntity = useServerFn(saveEntitySeo);
  const savePageMeta = useServerFn(savePageSeoMeta);

  const entity = row.kind === "product" ? "product" : row.kind === "collection" ? "collection" : "page";

  const mutation = useMutation({
    mutationFn: async () => {
      await saveEntity({
        data: {
          storeId,
          entity,
          id: row.id,
          seo: {
            ...(seo.title ? { title: seo.title } : {}),
            ...(seo.description ? { description: seo.description } : {}),
            ...(seo.keywords ? { keywords: seo.keywords } : {}),
            ...(seo.canonical ? { canonical: seo.canonical } : {}),
            ...(seo.ogImage ? { ogImage: seo.ogImage } : {}),
            noindex: Boolean(seo.noindex),
          },
        },
      });
      if (showPageMeta) {
        await savePageMeta({
          data: {
            storeId,
            pageId: row.id,
            pageKind,
            ...(author.trim() ? { authorName: author.trim() } : {}),
            ...(publishedAt ? { publishedAt } : {}),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("SEO bilgileri kaydedildi.");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const path = `/s/${storeSlug}/${urlPrefix}/${row.slug}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{row.title}</h2>
            <p className="text-xs text-muted-foreground">{KIND_LABELS[row.kind]}</p>
          </div>
          {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
        </div>

        <div className="space-y-2">
          <Label>SEO başlığı</Label>
          <Input
            value={seo.title ?? ""}
            maxLength={120}
            placeholder={row.title}
            onChange={(event) => setSeo((prev) => ({ ...prev, title: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>SEO açıklaması</Label>
          <Textarea
            rows={3}
            maxLength={400}
            value={seo.description ?? ""}
            placeholder={row.fallbackDescription.slice(0, 160)}
            onChange={(event) => setSeo((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Anahtar kelimeler</Label>
            <Input
              value={seo.keywords ?? ""}
              onChange={(event) => setSeo((prev) => ({ ...prev, keywords: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Canonical adres</Label>
            <Input
              value={seo.canonical ?? ""}
              placeholder={path}
              onChange={(event) => setSeo((prev) => ({ ...prev, canonical: event.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Paylaşım görseli</Label>
          <Input
            value={seo.ogImage ?? ""}
            placeholder="https://cdn.ornek.com/gorsel.jpg"
            onChange={(event) => setSeo((prev) => ({ ...prev, ogImage: event.target.value }))}
          />
        </div>

        {showPageMeta ? (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>İçerik türü</Label>
                <Select value={pageKind} onValueChange={(value) => setPageKind(value as "page" | "blog")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="page">Kurumsal sayfa</SelectItem>
                    <SelectItem value="blog">Blog yazısı (Article)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Yazar</Label>
                <Input value={author} onChange={(event) => setAuthor(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Yayın tarihi</Label>
                <Input
                  type="date"
                  value={publishedAt}
                  onChange={(event) => setPublishedAt(event.target.value)}
                />
              </div>
            </div>
          </>
        ) : null}

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Arama motorlarına kapat (noindex)</p>
            <p className="text-xs text-muted-foreground">Bu içerik sitemap'ten de çıkarılır.</p>
          </div>
          <Switch
            checked={Boolean(seo.noindex)}
            onCheckedChange={(checked) => setSeo((prev) => ({ ...prev, noindex: checked }))}
          />
        </div>

        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>

      <SerpPreview
        title={seo.title || row.title}
        description={seo.description || row.fallbackDescription}
        url={path}
      />
    </div>
  );
}
