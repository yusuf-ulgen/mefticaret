import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Globe, Palette, Rocket, Search } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addStoreDomain, createStore } from "@/lib/stores.functions";
import { applyThemeTemplate } from "@/lib/theme-templates.functions";
import { saveStoreSeo } from "@/lib/seo.functions";
import { seoTemplateDefaults } from "@/components/seo/seo-shared";
import { THEME_TEMPLATES } from "@/lib/theme-templates";
import { plansQuery } from "@/lib/store-queries";
import {
  CURRENCIES,
  INDUSTRIES,
  LOCALES,
  slugify,
  SUBDOMAIN_SUFFIX,
} from "@/lib/mefti";

/**
 * Tek sayfalık mağaza kurulumu: marka, paket, tema, alan adı ve SEO tek formda
 * toplanır. Tüm yazma işlemleri sunucu fonksiyonlarıyla RLS altında yapılır;
 * kurulum tamamlanınca kullanıcı doğrudan mağaza paneline yönlendirilir.
 */
export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Mağaza Kurulumu — Mefticaret" },
      {
        name: "description",
        content:
          "Marka, paket, tema, alan adı ve SEO ayarlarını tek sayfada tamamlayarak mağazanı dakikalar içinde aç.",
      },
      { property: "og:title", content: "Mağaza Kurulumu — Mefticaret" },
      {
        property: "og:description",
        content: "Tema, alan adı, paket ve SEO seçimiyle mağazan tek adımda hazır.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createStore);
  const applyTheme = useServerFn(applyThemeTemplate);
  const saveSeo = useServerFn(saveStoreSeo);
  const addDomain = useServerFn(addStoreDomain);
  const { data: plans } = useQuery(plansQuery());

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string>("moda");
  const [currency, setCurrency] = useState<string>("TRY");
  const [locale, setLocale] = useState<string>("tr");
  const [planCode, setPlanCode] = useState<string>("free");
  const [themeCode, setThemeCode] = useState<string>(THEME_TEMPLATES[0]?.code ?? "wokiee-mega");
  const [domain, setDomain] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const slug = slugify(name) || "magaza-adi";
  const industryLabel =
    INDUSTRIES.find((item) => item.value === industry)?.label ?? "E-ticaret";

  // Otomatik SEO önerisi: kullanıcı kendi metnini yazmadıysa marka + sektörden üretilir.
  const suggestedTitle = useMemo(
    () => (name.trim() ? `${name.trim()} — ${industryLabel} Online Alışveriş` : ""),
    [name, industryLabel],
  );
  const suggestedDescription = useMemo(
    () =>
      name.trim()
        ? `${name.trim()} ${industryLabel.toLocaleLowerCase("tr")} ürünlerini güvenli ödeme ve hızlı kargo ile sunar. Kampanyalı fiyatları keşfedin.`
        : "",
    [name, industryLabel],
  );

  const finalTitle = (seoTitle.trim() || suggestedTitle).slice(0, 60);
  const finalDescription = (seoDescription.trim() || suggestedDescription).slice(0, 160);

  const mutation = useMutation({
    mutationFn: async () => {
      const store = await create({
        data: {
          name: name.trim(),
          industry,
          currency: currency as "TRY",
          locale: locale as "tr",
          planCode,
        },
      });

      const notes: string[] = [];

      try {
        await applyTheme({ data: { storeId: store.id, code: themeCode as "wokiee-mega" } });
      } catch {
        notes.push("tema");
      }

      try {
        await saveSeo({
          data: {
            storeId: store.id,
            homeTitle: finalTitle,
            homeDescription: finalDescription,
            templates: seoTemplateDefaults,
          },
        });
      } catch {
        notes.push("SEO");
      }

      if (domain.trim()) {
        try {
          await addDomain({ data: { storeId: store.id, hostname: domain.trim(), includeWww: true } });
        } catch (error) {
          notes.push(`alan adı (${(error as Error).message})`);
        }
      }

      return { store, notes };
    },
    onSuccess: async ({ store, notes }) => {
      await queryClient.invalidateQueries({ queryKey: ["my-stores"] });
      if (notes.length) {
        toast.warning(`Mağaza açıldı; şu adımlar panelden tamamlanmalı: ${notes.join(", ")}.`);
      } else {
        toast.success("Mağazan hazır — panele yönlendiriliyorsun.");
      }
      void navigate({ to: "/store/$storeId/dashboard", params: { storeId: store.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Mağaza kurulumu"
      description="Marka, paket, tema, alan adı ve SEO — hepsi tek sayfada. Tamamlandığında mağaza paneline geçersin."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          className="surface-card space-y-8 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 2) {
              toast.error("Mağaza adı en az 2 karakter olmalı");
              return;
            }
            mutation.mutate();
          }}
        >
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">1. Marka ve paket</h2>
            <div className="space-y-2">
              <Label htmlFor="store-name">Mağaza adı</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Örn. Atlas Moda"
                required
              />
              <p className="text-xs text-muted-foreground">
                Alt alan adın:{" "}
                <span className="font-medium text-foreground">
                  {slug}.{SUBDOMAIN_SUFFIX}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sektör</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paket</Label>
                <Select value={planCode} onValueChange={setPlanCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(plans ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={plan.code}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Para birimi</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dil</Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Palette className="size-4 text-muted-foreground" /> 2. Tema
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THEME_TEMPLATES.map((template) => (
                <button
                  key={template.code}
                  type="button"
                  onClick={() => setThemeCode(template.code)}
                  className={`rounded-xl border p-4 text-left transition ${
                    themeCode === template.code
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{template.name}</p>
                    {themeCode === template.code ? <Check className="size-4 text-primary" /> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {template.description}
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    {[
                      template.theme.primaryColor,
                      template.theme.accentColor,
                      template.theme.backgroundColor,
                    ].map((color, i) => (
                      <span
                        key={`${i}-${color}`}
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="size-4 text-muted-foreground" /> 3. Alan adı (opsiyonel)
            </h2>
            <Input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="magazam.com"
            />
            <p className="text-xs text-muted-foreground">
              Kendi alan adını şimdi ekleyebilirsin; DNS doğrulaması panelde tamamlanır. Boş
              bırakırsan mağaza alt alan adıyla yayınlanır.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Search className="size-4 text-muted-foreground" /> 4. SEO
            </h2>
            <div className="space-y-2">
              <Label htmlFor="seo-title">Arama başlığı</Label>
              <Input
                id="seo-title"
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
                placeholder={suggestedTitle || "Marka adını yazınca otomatik önerilir"}
                maxLength={70}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-description">Arama açıklaması</Label>
              <Textarea
                id="seo-description"
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
                placeholder={suggestedDescription || "Marka adını yazınca otomatik önerilir"}
                rows={3}
                maxLength={200}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Boş bıraktığın alanlar otomatik doldurulur ve SEO Merkezi'ne kaydedilir; ürün,
              kategori ve sayfa meta şablonları da hazır gelir.
            </p>
          </section>

          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Mağaza kuruluyor..." : "Kurulumu tamamla ve panele git"}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </form>

        <aside className="surface-card space-y-4 p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl brand-gradient text-brand-foreground">
              <Rocket className="size-4" />
            </span>
            <h2 className="font-display text-lg font-semibold">Kurulum özeti</h2>
          </div>
          <dl className="space-y-3 text-sm">
            <Row label="Mağaza" value={name.trim() || "—"} />
            <Row label="Adres" value={`${slug}.${SUBDOMAIN_SUFFIX}`} />
            <Row label="Sektör" value={industryLabel} />
            <Row
              label="Paket"
              value={(plans ?? []).find((plan) => plan.code === planCode)?.name ?? planCode}
            />
            <Row
              label="Tema"
              value={THEME_TEMPLATES.find((item) => item.code === themeCode)?.name ?? themeCode}
            />
            <Row label="Alan adı" value={domain.trim() || "Alt alan adı"} />
            <Row label="Arama başlığı" value={finalTitle || "—"} />
          </dl>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            {finalDescription || "Arama açıklaması marka adına göre otomatik oluşturulur."}
          </div>
          <Badge variant="secondary">Tek sayfada kurulum</Badge>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-medium">{value}</dd>
    </div>
  );
}
