import { readAllPages } from "@/lib/read-all-pages";
/**
 * SEO Audit Engine — mağaza içeriğini gerçek veriyle tarar, kategori bazlı
 * skorlar üretir ve bulguları seo_audits / seo_audit_pages / seo_issues
 * tablolarına yazar. Skorlar sabit değildir; her bulgu ağırlıklı ceza üretir.
 */

import { plainText, readSeo, readStoreSeo } from "@/lib/seo";

type Db = { from: (table: string) => any };

export type SeoCategory =
  "technical" | "onpage" | "content" | "schema" | "performance" | "mobile" | "linking";

export const SEO_CATEGORY_WEIGHTS: Record<SeoCategory, number> = {
  technical: 25,
  onpage: 20,
  content: 15,
  schema: 15,
  performance: 10,
  mobile: 10,
  linking: 5,
};

export const SEO_CATEGORY_LABELS: Record<SeoCategory, string> = {
  technical: "Teknik SEO",
  onpage: "Sayfa içi",
  content: "İçerik",
  schema: "Yapısal veri",
  performance: "Performans",
  mobile: "Mobil",
  linking: "İç linkleme",
};

export type SeoSeverity = "critical" | "warning" | "info";

const SEVERITY_PENALTY: Record<SeoSeverity, number> = { critical: 34, warning: 14, info: 5 };

export type Finding = {
  code: string;
  category: SeoCategory;
  severity: SeoSeverity;
  message: string;
  fixHint?: string;
  autofixable?: boolean;
  entityType: string;
  entityId?: string | null;
  url?: string | null;
  title?: string | null;
  meta?: Record<string, unknown>;
};

/** Türkçe karakterleri normalize eden slug üretici (Slug Manager). */
export function seoSlugify(value: string) {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
    â: "a",
    î: "i",
    û: "u",
  };
  return value
    .replace(/[çÇğĞıİöÖşŞüÜâîû]/g, (char) => map[char] ?? char)
    .toLowerCase()
    .replace(/&/g, " ve ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

type PageRecord = {
  url: string;
  entityType: string;
  entityId: string | null;
  title: string;
  indexable: boolean;
  findings: Finding[];
};

function scoresFromFindings(findings: Finding[]) {
  const penalties: Record<SeoCategory, number> = {
    technical: 0,
    onpage: 0,
    content: 0,
    schema: 0,
    performance: 0,
    mobile: 0,
    linking: 0,
  };
  for (const finding of findings) {
    penalties[finding.category] += SEVERITY_PENALTY[finding.severity];
  }
  const scores = {} as Record<SeoCategory, number>;
  for (const key of Object.keys(penalties) as SeoCategory[]) {
    scores[key] = Math.max(0, 100 - penalties[key]);
  }
  const total = (Object.keys(scores) as SeoCategory[]).reduce(
    (sum, key) => sum + scores[key] * (SEO_CATEGORY_WEIGHTS[key] / 100),
    0,
  );
  return { scores, total: Math.round(total) };
}

function severityCounts(findings: Finding[]) {
  return {
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

const IMAGE_OK = /\.(webp|avif)(\?|$)/i;

export type AuditResult = Awaited<ReturnType<typeof runStoreSeoAudit>>;

/** Bir mağaza için tam SEO denetimi yürütür ve sonuçları kalıcı hale getirir. */
export async function runStoreSeoAudit(
  db: Db,
  storeId: string,
  options: { source?: string; userId?: string | null } = {},
) {
  const [
    storeRes,
    settingsRes,
    productsRes,
    imagesRes,
    collectionsRes,
    pagesRes,
    categoriesRes,
    brandsRes,
    redirectsRes,
    notFoundRes,
  ] = await Promise.all([
    db.from("stores").select("id, name, slug, status").eq("id", storeId).maybeSingle(),
    db
      .from("store_settings")
      .select("seo, contact_email, contact_phone, address")
      .eq("store_id", storeId)
      .maybeSingle(),
    readAllPages((from, to) =>
      db
        .from("products")
        .select(
          "id, title, slug, status, description, seo, base_price, currency, sku, brand_id, category_id",
        )
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("product_images")
        .select("id, product_id, url, alt")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("collections")
        .select("id, title, slug, description, seo")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("store_pages")
        .select(
          "id, title, slug, excerpt, body, seo, seo_description, is_published, page_kind, cover_url, author_name",
        )
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("categories")
        .select("id, name, slug, description, seo, is_active")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("brands")
        .select("id, name, slug, description, is_active")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("store_seo_redirects")
        .select("source_path, target_path, is_active")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
    readAllPages((from, to) =>
      db
        .from("store_seo_404s")
        .select("id, path, hit_count")
        .eq("store_id", storeId)
        .order("id")
        .range(from, to),
    ),
  ]);

  for (const result of [storeRes, settingsRes]) {
    if (result.error) throw new Error(result.error.message);
  }

  const store = storeRes.data as { id: string; name: string; slug: string; status: string } | null;
  if (!store) throw new Error("Mağaza bulunamadı");

  const storeSeo = readStoreSeo(settingsRes.data?.seo);
  const base = `/s/${store.slug}`;
  const pages: PageRecord[] = [];
  const storeFindings: Finding[] = [];

  /* ---------- Mağaza düzeyi teknik kontroller ---------- */
  if (storeSeo.noindexStore) {
    storeFindings.push({
      code: "store_noindex",
      category: "technical",
      severity: "critical",
      entityType: "store",
      url: base,
      title: store.name,
      message: "Mağaza tamamen noindex; arama motorları hiçbir sayfayı dizine ekleyemez.",
      fixHint: "SEO Ayarları içinde “Arama motorlarına kapat” seçeneğini kaldırın.",
    });
  }
  if (store.status !== "active") {
    storeFindings.push({
      code: "store_not_active",
      category: "technical",
      severity: "critical",
      entityType: "store",
      url: base,
      title: store.name,
      message: "Mağaza yayında değil; robots.txt tüm taramaları engelliyor.",
      fixHint: "Mağazayı yayına alın.",
    });
  }
  if (/disallow:\s*\/\s*$/im.test(storeSeo.robotsExtra ?? "")) {
    storeFindings.push({
      code: "robots_disallow_all",
      category: "technical",
      severity: "critical",
      entityType: "store",
      url: `${base}/robots.txt`,
      title: "robots.txt",
      message: "robots.txt içinde “Disallow: /” satırı var; tüm mağaza taranamaz hale gelir.",
      fixHint: "Robots.txt yöneticisinden bu satırı kaldırın.",
    });
  }
  if (!storeSeo.homeTitle || storeSeo.homeTitle.trim().length < 5) {
    storeFindings.push({
      code: "missing_home_title",
      category: "onpage",
      severity: "warning",
      entityType: "store",
      url: base,
      title: store.name,
      autofixable: true,
      message: "Ana sayfa SEO başlığı tanımlı değil.",
      fixHint: "Mağaza adından otomatik başlık oluşturulabilir.",
    });
  }
  if (!storeSeo.homeDescription || storeSeo.homeDescription.trim().length < 40) {
    storeFindings.push({
      code: "missing_home_description",
      category: "onpage",
      severity: "warning",
      entityType: "store",
      url: base,
      title: store.name,
      autofixable: true,
      message: "Ana sayfa meta açıklaması eksik veya çok kısa.",
      fixHint: "Meta şablonundan otomatik açıklama oluşturulabilir.",
    });
  }
  if (!settingsRes.data?.contact_email) {
    storeFindings.push({
      code: "missing_contact",
      category: "schema",
      severity: "info",
      entityType: "store",
      url: base,
      title: store.name,
      message: "İletişim e-postası yok; Organization yapısal verisi eksik kalıyor.",
      fixHint: "Mağaza ayarlarından iletişim bilgisi girin.",
    });
  }
  if (storeSeo.localBusinessEnabled && !settingsRes.data?.address) {
    storeFindings.push({
      code: "localbusiness_incomplete",
      category: "schema",
      severity: "warning",
      entityType: "store",
      url: base,
      title: store.name,
      message: "LocalBusiness açık ama adres bilgisi eksik.",
      fixHint: "Adres, telefon ve çalışma saatlerini tamamlayın.",
    });
  }

  /* ---------- Yönlendirme zinciri / döngü ---------- */
  const redirects = (redirectsRes.data ?? []) as {
    source_path: string;
    target_path: string;
    is_active: boolean;
  }[];
  const redirectMap = new Map(
    redirects.filter((r) => r.is_active).map((r) => [r.source_path, r.target_path]),
  );
  for (const [source, target] of redirectMap) {
    if (source === target) {
      storeFindings.push({
        code: "redirect_loop",
        category: "technical",
        severity: "critical",
        entityType: "redirect",
        url: source,
        title: source,
        message: `${source} kendisine yönleniyor (döngü).`,
        fixHint: "Yönlendirmeyi silin veya hedefi düzeltin.",
      });
    } else if (redirectMap.has(target)) {
      storeFindings.push({
        code: "redirect_chain",
        category: "technical",
        severity: "warning",
        entityType: "redirect",
        url: source,
        title: source,
        message: `${source} → ${target} → ${redirectMap.get(target)} zinciri var.`,
        fixHint: "Kaynağı doğrudan son hedefe yönlendirin.",
      });
    }
  }

  /* ---------- Ürünler ---------- */
  const products = (productsRes.data ?? []) as any[];
  const images = (imagesRes.data ?? []) as {
    id: string;
    product_id: string;
    url: string;
    alt: string | null;
  }[];
  const imagesByProduct = new Map<string, typeof images>();
  for (const image of images) {
    const list = imagesByProduct.get(image.product_id) ?? [];
    list.push(image);
    imagesByProduct.set(image.product_id, list);
  }

  const titleSeen = new Map<string, number>();
  const descSeen = new Map<string, number>();
  const slugSeen = new Map<string, number>();
  const bodySeen = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };

  for (const product of products) {
    const seo = readSeo(product.seo);
    bump(titleSeen, (seo.title ?? product.title ?? "").trim().toLowerCase());
    bump(descSeen, (seo.description ?? "").trim().toLowerCase());
    bump(slugSeen, `product:${product.slug}`);
    bump(bodySeen, plainText(product.description).slice(0, 200).toLowerCase());
  }
  for (const collection of (collectionsRes.data ?? []) as any[])
    bump(slugSeen, `collection:${collection.slug}`);
  for (const page of (pagesRes.data ?? []) as any[]) bump(slugSeen, `page:${page.slug}`);

  const activeProducts = products.filter((product) => product.status === "active");
  let missingAlt = 0;
  let unoptimizedImages = 0;

  for (const product of activeProducts) {
    const seo = readSeo(product.seo);
    const url = `${base}/p/${product.slug}`;
    const findings: Finding[] = [];
    const entity = {
      entityType: "product",
      entityId: String(product.id),
      url,
      title: product.title as string,
    };
    const productImages = imagesByProduct.get(String(product.id)) ?? [];
    const body = plainText(product.description);

    if (seo.noindex) {
      findings.push({
        ...entity,
        code: "page_noindex",
        category: "technical",
        severity: "critical",
        message: "Ürün sayfası noindex işaretli.",
        fixHint: "SEO alanlarından noindex seçeneğini kaldırın.",
      });
    }
    if (!seo.title) {
      findings.push({
        ...entity,
        code: "missing_meta_title",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "SEO başlığı yok; şablondan üretilebilir.",
        fixHint: "Meta şablonu ile otomatik doldurulabilir.",
      });
    } else if (seo.title.length > 60) {
      findings.push({
        ...entity,
        code: "title_too_long",
        category: "onpage",
        severity: "info",
        message: `SEO başlığı ${seo.title.length} karakter (ideal 50-60).`,
        fixHint: "Başlığı kısaltın.",
      });
    }
    if (!seo.description) {
      findings.push({
        ...entity,
        code: "missing_meta_description",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "Meta açıklama yok.",
        fixHint: "Şablon veya ürün açıklamasından otomatik üretilebilir.",
      });
    } else if (seo.description.length > 165) {
      findings.push({
        ...entity,
        code: "description_too_long",
        category: "onpage",
        severity: "info",
        message: `Meta açıklama ${seo.description.length} karakter (ideal 120-160).`,
        fixHint: "Açıklamayı kısaltın.",
      });
    }
    if ((titleSeen.get((seo.title ?? product.title ?? "").trim().toLowerCase()) ?? 0) > 1) {
      findings.push({
        ...entity,
        code: "duplicate_title",
        category: "onpage",
        severity: "warning",
        message: "Aynı SEO başlığı başka ürünlerde de kullanılıyor.",
        fixHint: "Başlığı benzersiz hale getirin.",
      });
    }
    if (seo.description && (descSeen.get(seo.description.trim().toLowerCase()) ?? 0) > 1) {
      findings.push({
        ...entity,
        code: "duplicate_description",
        category: "onpage",
        severity: "warning",
        message: "Aynı meta açıklama birden fazla ürüne yazılmış.",
        fixHint: "Açıklamayı benzersizleştirin.",
      });
    }
    if (body.length < 60) {
      findings.push({
        ...entity,
        code: "missing_content",
        category: "content",
        severity: "critical",
        message: "Ürün açıklaması yok veya çok kısa.",
        fixHint: "En az 300 karakterlik özgün açıklama ekleyin.",
      });
    } else if (body.length < 300) {
      findings.push({
        ...entity,
        code: "thin_content",
        category: "content",
        severity: "warning",
        message: `Ürün açıklaması ${body.length} karakter; zayıf içerik.`,
        fixHint: "Açıklamayı 300+ karaktere çıkarın.",
      });
    }
    if ((bodySeen.get(body.slice(0, 200).toLowerCase()) ?? 0) > 1 && body.length > 60) {
      findings.push({
        ...entity,
        code: "duplicate_content",
        category: "content",
        severity: "warning",
        message: "Bu açıklama başka ürünlerle aynı.",
        fixHint: "İçeriği benzersiz hale getirin.",
      });
    }
    if (productImages.length === 0) {
      findings.push({
        ...entity,
        code: "missing_image",
        category: "schema",
        severity: "critical",
        message: "Ürün görseli yok; Product şeması ve vitrin görünümü eksik.",
        fixHint: "En az bir görsel yükleyin.",
      });
    } else {
      const withoutAlt = productImages.filter((image) => !image.alt || !image.alt.trim());
      if (withoutAlt.length > 0) {
        missingAlt += withoutAlt.length;
        findings.push({
          ...entity,
          code: "missing_image_alt",
          category: "onpage",
          severity: "warning",
          autofixable: true,
          message: `${withoutAlt.length} görselde alt metni yok.`,
          fixHint: "Ürün adından otomatik alt metni üretilebilir.",
          meta: { imageIds: withoutAlt.map((image) => image.id) },
        });
      }
      const heavy = productImages.filter((image) => !IMAGE_OK.test(image.url ?? ""));
      unoptimizedImages += heavy.length;
      if (heavy.length === productImages.length) {
        findings.push({
          ...entity,
          code: "images_not_optimized",
          category: "performance",
          severity: "info",
          message: "Görseller WebP/AVIF değil.",
          fixHint: "Görselleri WebP veya AVIF olarak yükleyin.",
        });
      }
      if (productImages.length > 12) {
        findings.push({
          ...entity,
          code: "too_many_images",
          category: "performance",
          severity: "info",
          message: `${productImages.length} görsel sayfa yüklenmesini yavaşlatabilir.`,
          fixHint: "Görsel sayısını azaltın.",
        });
      }
    }
    if (!Number(product.base_price)) {
      findings.push({
        ...entity,
        code: "missing_price",
        category: "schema",
        severity: "critical",
        message: "Fiyat 0; Offer şeması geçersiz olur.",
        fixHint: "Ürün fiyatını girin.",
      });
    }
    if (!product.sku) {
      findings.push({
        ...entity,
        code: "missing_sku",
        category: "schema",
        severity: "info",
        message: "SKU yok; Product şeması eksik kalıyor.",
        fixHint: "Stok kodu tanımlayın.",
      });
    }
    if (!product.brand_id) {
      findings.push({
        ...entity,
        code: "missing_brand",
        category: "schema",
        severity: "info",
        message: "Marka bağlı değil; Brand alanı üretilemiyor.",
        fixHint: "Ürüne marka atayın.",
      });
    }
    if (!seo.canonical) {
      findings.push({
        ...entity,
        code: "missing_canonical",
        category: "technical",
        severity: "info",
        autofixable: true,
        message: "Canonical tanımlı değil; sistem varsayılanı kullanılıyor.",
        fixHint: "Canonical otomatik oluşturulabilir.",
      });
    }
    if (product.slug !== seoSlugify(product.slug)) {
      findings.push({
        ...entity,
        code: "invalid_slug",
        category: "technical",
        severity: "warning",
        message: `URL “${product.slug}” standart değil (büyük harf/Türkçe karakter).`,
        fixHint: `Önerilen: ${seoSlugify(product.slug)} — değişimde 301 önerilir.`,
        meta: { suggested: seoSlugify(product.slug) },
      });
    }
    if (product.slug.length > 70) {
      findings.push({
        ...entity,
        code: "slug_too_long",
        category: "technical",
        severity: "info",
        message: "URL çok uzun.",
        fixHint: "URL'yi kısaltın.",
      });
    }
    if ((slugSeen.get(`product:${product.slug}`) ?? 0) > 1) {
      findings.push({
        ...entity,
        code: "duplicate_url",
        category: "technical",
        severity: "critical",
        message: "Aynı URL birden fazla üründe.",
        fixHint: "URL'leri benzersizleştirin.",
      });
    }
    if (!product.category_id) {
      findings.push({
        ...entity,
        code: "orphan_page",
        category: "linking",
        severity: "info",
        message: "Ürün hiçbir kategoriye bağlı değil; iç link almıyor.",
        fixHint: "Ürünü bir kategoriye ekleyin.",
      });
    }
    if (redirectMap.has(`/p/${product.slug}`)) {
      findings.push({
        ...entity,
        code: "redirect_conflict",
        category: "technical",
        severity: "warning",
        message: "Yayında olan bu URL için yönlendirme tanımlı.",
        fixHint: "Çakışan yönlendirmeyi kaldırın.",
      });
    }

    pages.push({
      url,
      entityType: "product",
      entityId: String(product.id),
      title: product.title,
      indexable: !seo.noindex,
      findings,
    });
  }

  /* ---------- Koleksiyonlar & kategoriler ---------- */
  for (const collection of (collectionsRes.data ?? []) as any[]) {
    const seo = readSeo(collection.seo);
    const url = `${base}/c/${collection.slug}`;
    const entity = {
      entityType: "collection",
      entityId: String(collection.id),
      url,
      title: collection.title as string,
    };
    const findings: Finding[] = [];
    if (!seo.title)
      findings.push({
        ...entity,
        code: "missing_meta_title",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "Koleksiyon SEO başlığı yok.",
        fixHint: "Şablondan üretilebilir.",
      });
    if (!seo.description)
      findings.push({
        ...entity,
        code: "missing_meta_description",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "Koleksiyon meta açıklaması yok.",
        fixHint: "Şablondan üretilebilir.",
      });
    if (plainText(collection.description).length < 120)
      findings.push({
        ...entity,
        code: "thin_content",
        category: "content",
        severity: "info",
        message: "Koleksiyon açıklaması zayıf.",
        fixHint: "Tanıtım metni ekleyin.",
      });
    if (seo.noindex)
      findings.push({
        ...entity,
        code: "page_noindex",
        category: "technical",
        severity: "critical",
        message: "Koleksiyon noindex.",
        fixHint: "Noindex seçeneğini kaldırın.",
      });
    if (collection.slug !== seoSlugify(collection.slug))
      findings.push({
        ...entity,
        code: "invalid_slug",
        category: "technical",
        severity: "warning",
        message: "URL standart değil.",
        fixHint: `Önerilen: ${seoSlugify(collection.slug)}`,
        meta: { suggested: seoSlugify(collection.slug) },
      });
    pages.push({
      url,
      entityType: "collection",
      entityId: String(collection.id),
      title: collection.title,
      indexable: !seo.noindex,
      findings,
    });
  }

  for (const category of (categoriesRes.data ?? []) as any[]) {
    if (category.is_active === false) continue;
    const seo = readSeo(category.seo);
    const url = `${base}/categories`;
    const entity = {
      entityType: "category",
      entityId: String(category.id),
      url,
      title: category.name as string,
    };
    const findings: Finding[] = [];
    if (!seo.title)
      findings.push({
        ...entity,
        code: "missing_meta_title",
        category: "onpage",
        severity: "info",
        autofixable: true,
        message: "Kategori SEO başlığı yok.",
        fixHint: "Şablondan üretilebilir.",
      });
    if (plainText(category.description).length < 80)
      findings.push({
        ...entity,
        code: "thin_content",
        category: "content",
        severity: "info",
        message: "Kategori açıklaması yok/zayıf.",
        fixHint: "Kategori metni ekleyin.",
      });
    if (category.slug !== seoSlugify(category.slug))
      findings.push({
        ...entity,
        code: "invalid_slug",
        category: "technical",
        severity: "info",
        message: "Kategori URL'si standart değil.",
        fixHint: `Önerilen: ${seoSlugify(category.slug)}`,
        meta: { suggested: seoSlugify(category.slug) },
      });
    pages.push({
      url,
      entityType: "category",
      entityId: String(category.id),
      title: category.name,
      indexable: !seo.noindex,
      findings,
    });
  }

  for (const brand of (brandsRes.data ?? []) as any[]) {
    if (brand.is_active === false) continue;
    const findings: Finding[] = [];
    const entity = {
      entityType: "brand",
      entityId: String(brand.id),
      url: `${base}/products?brand=${brand.slug}`,
      title: brand.name as string,
    };
    if (plainText(brand.description).length < 60)
      findings.push({
        ...entity,
        code: "thin_content",
        category: "content",
        severity: "info",
        message: "Marka açıklaması yok/zayıf.",
        fixHint: "Marka tanıtım metni ekleyin.",
      });
    if (brand.slug !== seoSlugify(brand.slug))
      findings.push({
        ...entity,
        code: "invalid_slug",
        category: "technical",
        severity: "info",
        message: "Marka URL'si standart değil.",
        fixHint: `Önerilen: ${seoSlugify(brand.slug)}`,
        meta: { suggested: seoSlugify(brand.slug) },
      });
    pages.push({
      url: entity.url,
      entityType: "brand",
      entityId: String(brand.id),
      title: brand.name,
      indexable: true,
      findings,
    });
  }

  /* ---------- Sayfalar & blog ---------- */
  for (const page of (pagesRes.data ?? []) as any[]) {
    if (!page.is_published) continue;
    const seo = readSeo(page.seo);
    const kind = page.page_kind === "blog" ? "blog" : "page";
    const url = `${base}/page/${page.slug}`;
    const entity = {
      entityType: kind,
      entityId: String(page.id),
      url,
      title: page.title as string,
    };
    const findings: Finding[] = [];
    const body = plainText(page.body);
    if (!seo.title)
      findings.push({
        ...entity,
        code: "missing_meta_title",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "SEO başlığı yok.",
        fixHint: "Şablondan üretilebilir.",
      });
    if (!seo.description && !page.seo_description)
      findings.push({
        ...entity,
        code: "missing_meta_description",
        category: "onpage",
        severity: "warning",
        autofixable: true,
        message: "Meta açıklama yok.",
        fixHint: "Özetten otomatik üretilebilir.",
      });
    if (body.length < 300)
      findings.push({
        ...entity,
        code: "thin_content",
        category: "content",
        severity: "warning",
        message: `İçerik ${body.length} karakter; zayıf.`,
        fixHint: "İçeriği genişletin.",
      });
    if (seo.noindex)
      findings.push({
        ...entity,
        code: "page_noindex",
        category: "technical",
        severity: "critical",
        message: "Sayfa noindex.",
        fixHint: "Noindex seçeneğini kaldırın.",
      });
    if (kind === "blog" && !page.cover_url)
      findings.push({
        ...entity,
        code: "missing_cover",
        category: "schema",
        severity: "info",
        message: "Kapak görseli yok; Article şeması görselsiz.",
        fixHint: "Kapak görseli ekleyin.",
      });
    if (kind === "blog" && !page.author_name)
      findings.push({
        ...entity,
        code: "missing_author",
        category: "schema",
        severity: "info",
        message: "Yazar bilgisi yok.",
        fixHint: "Yazar adı girin.",
      });
    if (page.slug !== seoSlugify(page.slug))
      findings.push({
        ...entity,
        code: "invalid_slug",
        category: "technical",
        severity: "warning",
        message: "URL standart değil.",
        fixHint: `Önerilen: ${seoSlugify(page.slug)}`,
        meta: { suggested: seoSlugify(page.slug) },
      });
    pages.push({
      url,
      entityType: kind,
      entityId: String(page.id),
      title: page.title,
      indexable: !seo.noindex,
      findings,
    });
  }

  /* ---------- 404 ---------- */
  const notFound = (notFoundRes.data ?? []) as { id: string; path: string; hit_count: number }[];
  const unresolved404 = notFound.filter((row) => !redirectMap.has(row.path));
  if (unresolved404.length > 0) {
    const hits = unresolved404.reduce((sum, row) => sum + Number(row.hit_count ?? 0), 0);
    storeFindings.push({
      code: "broken_urls",
      category: "technical",
      severity: unresolved404.length > 10 ? "critical" : "warning",
      entityType: "store",
      url: base,
      title: store.name,
      message: `${unresolved404.length} URL 404 veriyor (${hits} isabet) ve yönlendirmesi yok.`,
      fixHint: "404 İzleyici ekranından 301 yönlendirmesi oluşturun.",
      meta: { count: unresolved404.length },
    });
  }
  if (activeProducts.length === 0) {
    storeFindings.push({
      code: "no_indexable_products",
      category: "content",
      severity: "critical",
      entityType: "store",
      url: base,
      title: store.name,
      message: "Yayında aktif ürün yok; sitemap boş kalır.",
      fixHint: "En az bir ürünü yayına alın.",
    });
  }

  /* ---------- Skorlar ---------- */
  const storePage: PageRecord = {
    url: base,
    entityType: "home",
    entityId: null,
    title: `${store.name} — Ana sayfa`,
    indexable: !storeSeo.noindexStore,
    findings: storeFindings,
  };
  const allPages = [storePage, ...pages];
  const allFindings = allPages.flatMap((page) => page.findings);

  const categoryScores = {} as Record<SeoCategory, number>;
  for (const key of Object.keys(SEO_CATEGORY_WEIGHTS) as SeoCategory[]) {
    const list = allPages.map((page) => scoresFromFindings(page.findings).scores[key]);
    categoryScores[key] = Math.round(
      list.reduce((sum, value) => sum + value, 0) / (list.length || 1),
    );
  }
  const overall = Math.round(
    (Object.keys(categoryScores) as SeoCategory[]).reduce(
      (sum, key) => sum + categoryScores[key] * (SEO_CATEGORY_WEIGHTS[key] / 100),
      0,
    ),
  );
  const counts = severityCounts(allFindings);
  const checksTotal = allPages.length * 8;

  /* ---------- Kalıcılaştırma ---------- */
  const { data: audit, error: auditError } = await db
    .from("seo_audits")
    .insert({
      store_id: storeId,
      status: "completed",
      source: options.source ?? "manual",
      triggered_by: options.userId ?? null,
      score: overall,
      technical_score: categoryScores.technical,
      onpage_score: categoryScores.onpage,
      content_score: categoryScores.content,
      schema_score: categoryScores.schema,
      performance_score: categoryScores.performance,
      mobile_score: categoryScores.mobile,
      linking_score: categoryScores.linking,
      pages_count: allPages.length,
      critical_count: counts.critical,
      warning_count: counts.warning,
      info_count: counts.info,
      passed_count: Math.max(0, checksTotal - allFindings.length),
      summary: {
        redirects: redirects.length,
        notFound: notFound.length,
        unresolved404: unresolved404.length,
        missingAlt,
        unoptimizedImages,
        products: products.length,
        activeProducts: activeProducts.length,
        unpublishedProducts: products.length - activeProducts.length,
        scope: "full_store_catalog",
        measuredAt: new Date().toISOString(),
        orphanPages: allFindings.filter((f) => f.code === "orphan_page").length,
        duplicateTitles: allFindings.filter((f) => f.code === "duplicate_title").length,
        duplicateContent: allFindings.filter((f) => f.code === "duplicate_content").length,
        canonicalIssues: allFindings.filter((f) => f.code === "missing_canonical").length,
        missingMeta: allFindings.filter((f) => f.code.startsWith("missing_meta")).length,
        sitemap: storeSeo.noindexStore || store.status !== "active" ? "blocked" : "ok",
        robots: /disallow:\s*\/\s*$/im.test(storeSeo.robotsExtra ?? "") ? "error" : "ok",
        schema: allFindings.some((f) => f.category === "schema" && f.severity === "critical")
          ? "error"
          : "ok",
      },
    })
    .select("*")
    .single();
  if (auditError) throw new Error(auditError.message);

  const auditId = String(audit.id);

  if (allPages.length > 0) {
    const rows = allPages.map((page) => {
      const { scores, total } = scoresFromFindings(page.findings);
      const pageCounts = severityCounts(page.findings);
      return {
        audit_id: auditId,
        store_id: storeId,
        url: page.url,
        entity_type: page.entityType,
        entity_id: page.entityId,
        title: page.title,
        score: total,
        scores,
        critical_count: pageCounts.critical,
        warning_count: pageCounts.warning,
        info_count: pageCounts.info,
        indexable: page.indexable,
      };
    });
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await db.from("seo_audit_pages").insert(rows.slice(index, index + 500));
      if (error) throw new Error(error.message);
    }
  }

  // Önceki açık bulgular yeni denetimle değiştirilir; kullanıcının "yoksay"
  // dediği kayıtlar korunur.
  const { data: ignored } = await db
    .from("seo_issues")
    .select("code, entity_type, entity_id, url")
    .eq("store_id", storeId)
    .eq("status", "ignored")
    .limit(2000);
  const ignoredKeys = new Set(
    ((ignored ?? []) as any[]).map(
      (row) => `${row.code}|${row.entity_type}|${row.entity_id ?? ""}|${row.url ?? ""}`,
    ),
  );

  await db.from("seo_issues").delete().eq("store_id", storeId).neq("status", "ignored");

  const issueRows = allFindings
    .filter(
      (finding) =>
        !ignoredKeys.has(
          `${finding.code}|${finding.entityType}|${finding.entityId ?? ""}|${finding.url ?? ""}`,
        ),
    )
    .map((finding) => ({
      store_id: storeId,
      audit_id: auditId,
      code: finding.code,
      category: finding.category,
      severity: finding.severity,
      entity_type: finding.entityType,
      entity_id: finding.entityId ?? null,
      url: finding.url ?? null,
      title: finding.title ?? null,
      message: finding.message,
      fix_hint: finding.fixHint ?? null,
      autofixable: finding.autofixable ?? false,
      status: "open",
      meta: finding.meta ?? {},
    }));

  for (let index = 0; index < issueRows.length; index += 500) {
    const { error } = await db.from("seo_issues").upsert(issueRows.slice(index, index + 500), {
      onConflict: "store_id,code,entity_type,entity_id,url",
      ignoreDuplicates: true,
    });
    if (error) {
      const { error: insertError } = await db
        .from("seo_issues")
        .insert(issueRows.slice(index, index + 500));
      if (insertError) throw new Error(insertError.message);
    }
  }

  return {
    auditId,
    score: overall,
    categoryScores,
    counts,
    pages: allPages.length,
    issues: issueRows.length,
    summary: audit.summary as Record<string, number | string>,
  };
}
