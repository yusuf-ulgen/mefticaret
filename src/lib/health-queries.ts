import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type HealthSnapshot = {
  storeName: string;
  storeSlug: string;
  storeStatus: string;
  onboardingCompleted: boolean;
  activeProducts: number;
  productsWithImage: number;
  totalProducts: number;
  outOfStockVariants: number;
  paymentMethods: number;
  shippingRates: number;
  verifiedDomains: number;
  themePublished: boolean;
  publishedPages: number;
  contactFilled: boolean;
  legalFilled: boolean;
  seoFilled: boolean;
  menuItems: number;
  pendingReviews: number;
  openQuestions: number;
};

export type HealthCheck = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
  severity: "critical" | "warning";
  to?: string;
};

export const storeHealthQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-health", storeId],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<HealthSnapshot> => {
      const [
        store,
        settings,
        theme,
        products,
        images,
        variants,
        payments,
        rates,
        domains,
        pages,
        menus,
        reviews,
        questions,
      ] = await Promise.all([
        supabase
          .from("stores")
          .select("name, slug, status, onboarding_completed")
          .eq("id", storeId)
          .maybeSingle(),
        supabase
          .from("store_settings")
          .select("contact_email, contact_phone, legal_name, tax_number, seo")
          .eq("store_id", storeId)
          .maybeSingle(),
        supabase.from("store_themes").select("is_published").eq("store_id", storeId).maybeSingle(),
        supabase.from("products").select("id, status").eq("store_id", storeId).limit(2000),
        supabase.from("product_images").select("product_id").eq("store_id", storeId).limit(4000),
        supabase.from("product_variants").select("stock").eq("store_id", storeId).limit(2000),
        supabase
          .from("store_payment_methods")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_active", true),
        supabase
          .from("shipping_rates")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_active", true),
        supabase
          .from("store_domains")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "verified"),
        supabase
          .from("store_pages")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_published", true),
        supabase
          .from("store_menu_items")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("is_visible", true),
        supabase
          .from("product_reviews")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .eq("status", "pending"),
        supabase
          .from("product_questions")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .is("answer", null),
      ]);

      if (store.error) throw store.error;
      if (!store.data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

      const productRows = products.data ?? [];
      const withImage = new Set((images.data ?? []).map((row) => String(row.product_id)));
      const seo = (settings.data?.seo ?? null) as { title?: string; description?: string } | null;

      return {
        storeName: String(store.data.name),
        storeSlug: String(store.data.slug),
        storeStatus: String(store.data.status),
        onboardingCompleted: Boolean(store.data.onboarding_completed),
        totalProducts: productRows.length,
        activeProducts: productRows.filter((row) => row.status === "active").length,
        productsWithImage: productRows.filter((row) => withImage.has(String(row.id))).length,
        outOfStockVariants: (variants.data ?? []).filter((row) => Number(row.stock ?? 0) <= 0).length,
        paymentMethods: payments.count ?? 0,
        shippingRates: rates.count ?? 0,
        verifiedDomains: domains.count ?? 0,
        themePublished: Boolean(theme.data?.is_published),
        publishedPages: pages.count ?? 0,
        menuItems: menus.count ?? 0,
        pendingReviews: reviews.count ?? 0,
        openQuestions: questions.count ?? 0,
        contactFilled: Boolean(settings.data?.contact_email && settings.data?.contact_phone),
        legalFilled: Boolean(settings.data?.legal_name && settings.data?.tax_number),
        seoFilled: Boolean(seo?.title && seo?.description),
      };
    },
  });

export function buildHealthChecks(snapshot: HealthSnapshot, storeId: string): HealthCheck[] {
  const base = `/store/${storeId}`;
  return [
    {
      id: "products",
      label: "Yayında en az 3 aktif ürün",
      detail: `${snapshot.activeProducts} aktif ürün (toplam ${snapshot.totalProducts})`,
      ok: snapshot.activeProducts >= 3,
      severity: "critical",
      to: `${base}/products`,
    },
    {
      id: "images",
      label: "Tüm ürünlerde görsel var",
      detail: `${snapshot.productsWithImage}/${snapshot.totalProducts} üründe görsel yüklü`,
      ok: snapshot.totalProducts > 0 && snapshot.productsWithImage === snapshot.totalProducts,
      severity: "warning",
      to: `${base}/products`,
    },
    {
      id: "payment",
      label: "Aktif ödeme yöntemi",
      detail: `${snapshot.paymentMethods} aktif yöntem`,
      ok: snapshot.paymentMethods > 0,
      severity: "critical",
      to: `${base}/payments`,
    },
    {
      id: "shipping",
      label: "Aktif kargo tarifesi",
      detail: `${snapshot.shippingRates} aktif tarife`,
      ok: snapshot.shippingRates > 0,
      severity: "critical",
      to: `${base}/shipping`,
    },
    {
      id: "theme",
      label: "Tema yayınlandı",
      detail: snapshot.themePublished ? "Vitrin teması yayında" : "Tema hâlâ taslak durumda",
      ok: snapshot.themePublished,
      severity: "critical",
      to: `${base}/themes`,
    },
    {
      id: "pages",
      label: "Yasal sayfalar yayında",
      detail: `${snapshot.publishedPages} yayında sayfa (iade, gizlilik, mesafeli satış)`,
      ok: snapshot.publishedPages >= 3,
      severity: "critical",
      to: `${base}/pages`,
    },
    {
      id: "legal",
      label: "Kurumsal bilgiler tamam",
      detail: snapshot.legalFilled ? "Unvan ve vergi numarası girildi" : "Unvan veya vergi numarası eksik",
      ok: snapshot.legalFilled,
      severity: "critical",
      to: `${base}/settings`,
    },
    {
      id: "contact",
      label: "İletişim bilgileri tamam",
      detail: snapshot.contactFilled ? "E-posta ve telefon girildi" : "E-posta veya telefon eksik",
      ok: snapshot.contactFilled,
      severity: "warning",
      to: `${base}/settings`,
    },
    {
      id: "seo",
      label: "Mağaza SEO başlık/açıklama",
      detail: snapshot.seoFilled ? "SEO alanları dolu" : "SEO başlığı veya açıklaması eksik",
      ok: snapshot.seoFilled,
      severity: "warning",
      to: `${base}/seo`,
    },
    {
      id: "domain",
      label: "Doğrulanmış alan adı",
      detail: `${snapshot.verifiedDomains} doğrulanmış alan adı`,
      ok: snapshot.verifiedDomains > 0,
      severity: "warning",
      to: `${base}/domains`,
    },
    {
      id: "menu",
      label: "Vitrin menüsü kurulu",
      detail: `${snapshot.menuItems} görünür menü öğesi`,
      ok: snapshot.menuItems >= 2,
      severity: "warning",
      to: `${base}/navigation`,
    },
    {
      id: "stock",
      label: "Stoksuz varyant yok",
      detail: `${snapshot.outOfStockVariants} varyantın stoğu tükendi`,
      ok: snapshot.outOfStockVariants === 0,
      severity: "warning",
      to: `${base}/inventory`,
    },
    {
      id: "reviews",
      label: "Bekleyen değerlendirme yok",
      detail: `${snapshot.pendingReviews} değerlendirme onay bekliyor`,
      ok: snapshot.pendingReviews === 0,
      severity: "warning",
      to: `${base}/reviews`,
    },
    {
      id: "questions",
      label: "Yanıtsız soru yok",
      detail: `${snapshot.openQuestions} soru yanıt bekliyor`,
      ok: snapshot.openQuestions === 0,
      severity: "warning",
      to: `${base}/questions`,
    },
  ];
}

export function healthScore(checks: HealthCheck[]) {
  const weight = (check: HealthCheck) => (check.severity === "critical" ? 2 : 1);
  const total = checks.reduce((sum, check) => sum + weight(check), 0);
  const earned = checks.reduce((sum, check) => sum + (check.ok ? weight(check) : 0), 0);
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}
