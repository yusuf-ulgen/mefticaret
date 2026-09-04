/**
 * Güvenli SEO otomatik düzeltmeleri. Yalnızca geri alınabilir, içerik üretmeyen
 * (şablon/veri temelli) düzeltmeler burada uygulanır. Tüm yazmalar kullanıcının
 * kendi oturumuyla (RLS altında) yapılır.
 */

import { clampDescription, plainText, readSeo, readStoreSeo } from "@/lib/seo";
import { interpolateSeoTemplate } from "@/lib/seo-template";
import { seoTemplateDefaults } from "@/components/seo/seo-shared";

type Db = { from: (table: string) => any };

export const AUTOFIXABLE_CODES = [
  "missing_meta_title",
  "missing_meta_description",
  "missing_image_alt",
  "missing_canonical",
  "missing_home_title",
  "missing_home_description",
] as const;

export type AutofixCode = (typeof AUTOFIXABLE_CODES)[number];

const TABLE: Record<string, string> = {
  product: "products",
  collection: "collections",
  category: "categories",
  page: "store_pages",
  blog: "store_pages",
};

type Issue = {
  id: string;
  store_id: string;
  code: string;
  entity_type: string;
  entity_id: string | null;
  url: string | null;
  title: string | null;
  meta: Record<string, unknown> | null;
};

async function storeContext(db: Db, storeId: string) {
  const [storeRes, settingsRes] = await Promise.all([
    db.from("stores").select("name, slug").eq("id", storeId).maybeSingle(),
    db.from("store_settings").select("seo").eq("store_id", storeId).maybeSingle(),
  ]);
  const store = (storeRes.data ?? { name: "Mağaza", slug: "magaza" }) as { name: string; slug: string };
  return { store, storeSeo: readStoreSeo(settingsRes.data?.seo) };
}

function templateFor(storeSeo: ReturnType<typeof readStoreSeo>, kind: "product" | "collection" | "page" | "blog") {
  const stored = storeSeo.templates?.[kind];
  return {
    title: stored?.title || seoTemplateDefaults[kind].title,
    description: stored?.description || seoTemplateDefaults[kind].description,
  };
}

/** Tek bir SEO bulgusunu otomatik düzeltir; düzeltilemezse hata verir. */
export async function applySeoAutofix(db: Db, issueId: string, storeId: string) {
  const { data, error } = await db
    .from("seo_issues")
    .select("id, store_id, code, entity_type, entity_id, url, title, meta")
    .eq("id", issueId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const issue = data as Issue | null;
  if (!issue) throw new Error("Sorun kaydı bulunamadı");
  if (!(AUTOFIXABLE_CODES as readonly string[]).includes(issue.code)) {
    throw new Error("Bu sorun otomatik düzeltilemez; elle müdahale gerekir.");
  }

  const { store, storeSeo } = await storeContext(db, storeId);

  /* --- Mağaza düzeyi --- */
  if (issue.code === "missing_home_title" || issue.code === "missing_home_description") {
    const next = { ...storeSeo } as Record<string, unknown>;
    if (issue.code === "missing_home_title") next["homeTitle"] = `${store.name} | Online Alışveriş`;
    else
      next["homeDescription"] = clampDescription(
        `${store.name} mağazasında güncel ürünleri keşfedin. Hızlı kargo, güvenli ödeme ve kolay iade.`,
      );
    const { error: upError } = await db
      .from("store_settings")
      .upsert({ store_id: storeId, seo: next }, { onConflict: "store_id" });
    if (upError) throw new Error(upError.message);
    return { applied: issue.code, value: String(issue.code === "missing_home_title" ? next["homeTitle"] : next["homeDescription"]) };
  }

  /* --- Görsel alt metni --- */
  if (issue.code === "missing_image_alt") {
    if (!issue.entity_id) throw new Error("Ürün bulunamadı");
    const { data: product } = await db
      .from("products")
      .select("id, title")
      .eq("id", issue.entity_id)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!product) throw new Error("Ürün bulunamadı");
    const { data: images } = await db
      .from("product_images")
      .select("id, alt, position")
      .eq("product_id", issue.entity_id)
      .eq("store_id", storeId)
      .order("position");
    const missing = ((images ?? []) as { id: string; alt: string | null }[]).filter((image) => !image.alt?.trim());
    let index = 0;
    for (const image of missing) {
      index += 1;
      const alt = index === 1 ? String(product.title) : `${product.title} — görsel ${index}`;
      const { error: altError } = await db
        .from("product_images")
        .update({ alt })
        .eq("id", image.id)
        .eq("store_id", storeId);
      if (altError) throw new Error(altError.message);
    }
    return { applied: issue.code, value: `${missing.length} görsel` };
  }

  /* --- İçerik meta alanları --- */
  const table = TABLE[issue.entity_type];
  if (!table || !issue.entity_id) throw new Error("Bu kayıt için otomatik düzeltme yok");

  const columns =
    table === "products"
      ? "id, title, slug, description, seo, base_price, currency, sku"
      : table === "store_pages"
        ? "id, title, slug, excerpt, seo_description, seo"
        : table === "categories"
          ? "id, name, slug, description, seo"
          : "id, title, slug, description, seo";
  const { data: row, error: rowError } = await db
    .from(table)
    .select(columns)
    .eq("id", issue.entity_id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (rowError) throw new Error(rowError.message);
  if (!row) throw new Error("Kayıt bulunamadı");

  const name = String(row.title ?? row.name ?? "");
  const kind: "product" | "collection" | "page" | "blog" =
    issue.entity_type === "product" ? "product" : issue.entity_type === "collection" ? "collection" : issue.entity_type === "blog" ? "blog" : "page";
  const template = templateFor(storeSeo, kind);
  const variables = {
    product_name: name,
    collection_name: name,
    category_name: name,
    brand_name: "",
    page_title: name,
    blog_title: name,
    post_title: name,
    store_name: store.name,
    price: row.base_price ?? "",
    currency: row.currency ?? "",
    sku: row.sku ?? "",
    description: plainText(row.description ?? row.excerpt ?? ""),
    page_excerpt: plainText(row.excerpt ?? row.description ?? ""),
  };

  const seo = { ...readSeo(row.seo) } as Record<string, unknown>;
  let value = "";
  if (issue.code === "missing_meta_title") {
    value = interpolateSeoTemplate(template.title, variables).slice(0, 60) || `${name} | ${store.name}`;
    seo["title"] = value;
  } else if (issue.code === "missing_meta_description") {
    const fromTemplate = interpolateSeoTemplate(template.description, variables);
    value = clampDescription(fromTemplate || variables.description || `${name} — ${store.name}`);
    seo["description"] = value;
  } else if (issue.code === "missing_canonical") {
    const path =
      issue.entity_type === "product"
        ? `/p/${row.slug}`
        : issue.entity_type === "collection"
          ? `/c/${row.slug}`
          : `/page/${row.slug}`;
    value = `/s/${store.slug}${path}`;
    seo["canonical"] = value;
  }

  const { error: updateError } = await db
    .from(table)
    .update({ seo })
    .eq("id", issue.entity_id)
    .eq("store_id", storeId);
  if (updateError) throw new Error(updateError.message);

  return { applied: issue.code, value };
}
