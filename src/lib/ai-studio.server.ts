/**
 * AI İçerik Stüdyosu (yalnızca sunucu): ürün açıklaması paketleri, kategori SEO
 * içeriği, blog paketi, hukuki metin taslakları ve rakip ürün analizi.
 *
 * Tüm okuma/yazmalar kullanıcının kendi oturumuyla (RLS altında) yapılır.
 * Üretilen her içerik `ai_content_drafts` içine taslak olarak kaydedilir; mağaza
 * verisine yazılması ayrı bir "uygula" adımıdır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { callProvider, loadStoreAiSettings, monthlyTokenUsage, type ChatMessage } from "@/lib/ai.server";
import { clampDescription, plainText } from "@/lib/seo";
import { slugifyTr } from "@/lib/blog-ai.server";

type Client = SupabaseClient<Database>;
type Any = { from: (table: string) => any };

export const LEGAL_KINDS = {
  kvkk: "KVKK Aydınlatma Metni",
  privacy: "Gizlilik Politikası",
  returns: "İade ve Cayma Politikası",
  distance_sales: "Mesafeli Satış Sözleşmesi",
  terms: "Kullanım Koşulları",
} as const;

export type LegalKind = keyof typeof LEGAL_KINDS;

export const LEGAL_DISCLAIMER =
  "Bu metin yapay zeka tarafından hazırlanmış bir TASLAKTIR. Hukuki danışmanlık yerine geçmez; yayınlamadan önce bir avukat tarafından incelenmelidir.";

export const COPY_KINDS = {
  seo: "SEO açıklaması",
  short: "Kısa açıklama",
  long: "Uzun açıklama",
  technical: "Teknik açıklama",
  sales: "Satış odaklı açıklama",
  social: "Sosyal medya açıklaması",
} as const;

export const COPY_TONES = ["profesyonel", "samimi", "premium", "teknik", "minimalist"] as const;
export type CopyTone = (typeof COPY_TONES)[number];

const BASE_RULES =
  "Türkçe yaz. Yalnızca verilen gerçek bilgileri kullan; uydurma özellik, sertifika, garanti, fiyat, istatistik veya yorum ekleme. Bilgi eksikse o kısmı atla.";

/* --------------------------------------------------------------- yardımcılar */

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[{[]/);
  if (start < 0) return null;
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function logGeneration(entry: {
  storeId: string;
  userId: string;
  task: string;
  providerCode: string;
  model: string;
  prompt: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_generations").insert({
    store_id: entry.storeId,
    user_id: entry.userId,
    task: entry.task,
    provider_code: entry.providerCode,
    model: entry.model,
    prompt: entry.prompt.slice(0, 8000),
    output: entry.output.slice(0, 20000),
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    total_tokens: entry.inputTokens + entry.outputTokens,
    duration_ms: 0,
    status: "success",
  });
}

/** Ayarları yükler, limiti kontrol eder, sağlayıcıyı çağırır ve kullanımı kaydeder. */
async function ask(options: {
  client: Client;
  storeId: string;
  userId: string;
  task: string;
  system: string;
  user: string;
  maxTokens?: number;
}) {
  const settings = await loadStoreAiSettings(options.client, options.storeId);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");
  const used = await monthlyTokenUsage(options.client, options.storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu. Limiti AI ayarlarından yükseltebilirsiniz.");
  }

  const messages: ChatMessage[] = [
    { role: "system", content: options.system },
    { role: "user", content: options.user },
  ];
  const result = await callProvider({
    providerCode: settings.providerCode,
    model: settings.model,
    messages,
    temperature: settings.creativity,
    maxTokens: options.maxTokens ?? 1800,
  });

  await logGeneration({
    storeId: options.storeId,
    userId: options.userId,
    task: options.task,
    providerCode: settings.providerCode,
    model: settings.model,
    prompt: options.user,
    output: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return { text: result.text, tokens: result.inputTokens + result.outputTokens, model: settings.model };
}

async function saveDraft(
  client: Client,
  input: {
    storeId: string;
    userId: string;
    entityType: string;
    entityId?: string | null;
    kind: string;
    tone?: string | null;
    title?: string | null;
    content: string;
    fields?: Record<string, any>;
  },
) {
  const { data, error } = await (client as unknown as Any)
    .from("ai_content_drafts")
    .insert({
      store_id: input.storeId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      kind: input.kind,
      tone: input.tone ?? null,
      title: input.title ?? null,
      content: input.content,
      fields: input.fields ?? {},
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

async function storeInfo(client: Client, storeId: string) {
  const { data, error } = await client
    .from("stores")
    .select("id, name, slug, currency, industry")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  return data;
}

/* ------------------------------------------------------- ürün açıklama paketi */

/** Bir veya birçok ürün için altı farklı açıklama türü üretir (toplu üretim). */
export async function generateProductCopyPack(options: {
  client: Client;
  storeId: string;
  userId: string;
  productIds: string[];
  tone: CopyTone;
  keywords?: string;
}) {
  const store = await storeInfo(options.client, options.storeId);
  const { data: products, error } = await options.client
    .from("products")
    .select("id, title, description, base_price, currency, sku, tags")
    .eq("store_id", options.storeId)
    .in("id", options.productIds.slice(0, 20));
  if (error) throw new Error(error.message);
  if ((products ?? []).length === 0) throw new Error("Ürün bulunamadı");

  const results: { productId: string; title: string; draftId: string; fields: Record<string, string> }[] = [];
  let tokens = 0;

  for (const product of products ?? []) {
    const prompt = [
      `Mağaza: ${store.name}${store.industry ? ` (${store.industry})` : ""}`,
      `Ürün: ${product.title}`,
      product.sku ? `Stok kodu: ${product.sku}` : "",
      product.base_price ? `Fiyat: ${product.base_price} ${product.currency ?? store.currency}` : "",
      (product.tags ?? []).length > 0 ? `Etiketler: ${(product.tags ?? []).join(", ")}` : "",
      product.description ? `Mevcut açıklama: ${plainText(product.description).slice(0, 1200)}` : "",
      options.keywords?.trim() ? `Anahtar kelimeler: ${options.keywords.trim()}` : "",
      `Ton: ${options.tone}`,
    ]
      .filter(Boolean)
      .join("\n");

    const system = [
      "Sen Türkiye pazarına odaklı kıdemli bir e-ticaret metin yazarısın.",
      BASE_RULES,
      `İstenen ton: ${options.tone}.`,
      'Yanıtı yalnızca şu JSON ile ver: {"seo":"...","short":"...","long":"...","technical":"...","sales":"...","social":"..."}',
      "seo: en fazla 155 karakter meta açıklama. short: 1-2 cümle. long: 2-3 paragraf.",
      "technical: madde madde teknik özellikler (yalnızca verilen bilgilerden). sales: fayda odaklı satış metni.",
      "social: Instagram için kısa metin + en fazla 8 hashtag.",
    ].join(" ");

    const response = await ask({
      client: options.client,
      storeId: options.storeId,
      userId: options.userId,
      task: "product_copy_pack",
      system,
      user: prompt,
      maxTokens: 2200,
    });
    tokens += response.tokens;

    const parsed = extractJson(response.text) as Record<string, string> | null;
    const fields: Record<string, string> = {};
    for (const key of Object.keys(COPY_KINDS)) {
      const value = parsed?.[key];
      if (typeof value === "string" && value.trim()) fields[key] = value.trim();
    }
    if (Object.keys(fields).length === 0) fields["long"] = response.text.trim();

    const draftId = await saveDraft(options.client, {
      storeId: options.storeId,
      userId: options.userId,
      entityType: "product",
      entityId: String(product.id),
      kind: "copy_pack",
      tone: options.tone,
      title: String(product.title),
      content: fields["long"] ?? fields["sales"] ?? "",
      fields,
    });

    results.push({ productId: String(product.id), title: String(product.title), draftId, fields });
  }

  return { generated: results.length, tokens, results };
}

/** Ürün taslağını gerçek ürün kaydına uygular. */
export async function applyProductCopy(options: {
  client: Client;
  storeId: string;
  draftId: string;
  target: "description" | "seo_description" | "both";
}) {
  const { data: draft, error } = await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .select("id, entity_id, fields, content")
    .eq("id", options.draftId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!draft?.entity_id) throw new Error("Taslak bulunamadı");

  const fields = (draft.fields ?? {}) as Record<string, string>;
  const patch: Record<string, unknown> = {};

  if (options.target === "description" || options.target === "both") {
    patch["description"] = fields["long"] ?? draft.content;
  }
  if (options.target === "seo_description" || options.target === "both") {
    const { data: product } = await options.client
      .from("products")
      .select("seo")
      .eq("id", draft.entity_id)
      .eq("store_id", options.storeId)
      .maybeSingle();
    const { readSeo } = await import("@/lib/seo");
    const seo = { ...readSeo(product?.seo) } as Record<string, unknown>;
    if (fields["seo"]) seo["description"] = clampDescription(fields["seo"]);
    patch["seo"] = seo;
  }

  const { error: updateError } = await options.client
    .from("products")
    .update(patch as never)
    .eq("id", draft.entity_id)
    .eq("store_id", options.storeId);
  if (updateError) throw new Error(updateError.message);

  await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", options.draftId)
    .eq("store_id", options.storeId);

  return { ok: true as const };
}

/* --------------------------------------------------------- kategori içeriği */

/** Kategori adına göre SEO açıklaması, meta başlık/açıklama ve SSS üretir. */
export async function generateCategoryContent(options: {
  client: Client;
  storeId: string;
  userId: string;
  categoryId: string;
  keywords?: string;
}) {
  const store = await storeInfo(options.client, options.storeId);
  const { data: category, error } = await options.client
    .from("categories")
    .select("id, name, description, slug")
    .eq("id", options.categoryId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!category) throw new Error("Kategori bulunamadı");

  const { data: sample } = await options.client
    .from("products")
    .select("title, base_price, currency")
    .eq("store_id", options.storeId)
    .eq("category_id", options.categoryId)
    .limit(8);

  const prompt = [
    `Mağaza: ${store.name}`,
    `Kategori: ${category.name}`,
    category.description ? `Mevcut açıklama: ${plainText(category.description).slice(0, 800)}` : "",
    (sample ?? []).length > 0
      ? `Kategorideki örnek ürünler: ${(sample ?? []).map((row) => row.title).join(", ")}`
      : "Kategoride henüz ürün yok.",
    options.keywords?.trim() ? `Anahtar kelimeler: ${options.keywords.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Sen e-ticaret kategori sayfaları için çalışan bir SEO içerik editörüsün.",
    BASE_RULES,
    'Yanıtı yalnızca şu JSON ile ver: {"metaTitle":"...","metaDescription":"...","seoDescription":"...","faq":[{"question":"...","answer":"..."}]}',
    "metaTitle en fazla 60 karakter, metaDescription en fazla 155 karakter.",
    "seoDescription: kategori sayfasının üstünde gösterilecek 2 paragraf tanıtım metni.",
    "faq: 4-6 soru-cevap; sorular gerçek arama niyetine dayansın.",
  ].join(" ");

  const response = await ask({
    client: options.client,
    storeId: options.storeId,
    userId: options.userId,
    task: "category_content",
    system,
    user: prompt,
    maxTokens: 2000,
  });

  const parsed = extractJson(response.text) as
    | { metaTitle?: string; metaDescription?: string; seoDescription?: string; faq?: { question?: string; answer?: string }[] }
    | null;

  const fields = {
    metaTitle: (parsed?.metaTitle ?? "").trim().slice(0, 60),
    metaDescription: clampDescription((parsed?.metaDescription ?? "").trim()),
    seoDescription: (parsed?.seoDescription ?? response.text).trim(),
    faq: (parsed?.faq ?? [])
      .filter((item) => item.question && item.answer)
      .map((item) => ({ question: String(item.question).trim(), answer: String(item.answer).trim() })),
  };

  const draftId = await saveDraft(options.client, {
    storeId: options.storeId,
    userId: options.userId,
    entityType: "category",
    entityId: String(category.id),
    kind: "category_content",
    title: String(category.name),
    content: fields.seoDescription,
    fields,
  });

  return { draftId, tokens: response.tokens, fields, category: { id: String(category.id), name: String(category.name) } };
}

/** Kategori taslağını kategori kaydına uygular (açıklama + SEO + SSS). */
export async function applyCategoryContent(options: { client: Client; storeId: string; draftId: string }) {
  const { data: draft, error } = await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .select("id, entity_id, fields, content")
    .eq("id", options.draftId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!draft?.entity_id) throw new Error("Taslak bulunamadı");

  const fields = (draft.fields ?? {}) as {
    metaTitle?: string;
    metaDescription?: string;
    seoDescription?: string;
    faq?: { question: string; answer: string }[];
  };

  const { data: category } = await options.client
    .from("categories")
    .select("seo")
    .eq("id", draft.entity_id)
    .eq("store_id", options.storeId)
    .maybeSingle();
  const { readSeo } = await import("@/lib/seo");
  const seo = { ...readSeo(category?.seo) } as Record<string, unknown>;
  if (fields.metaTitle) seo["title"] = fields.metaTitle;
  if (fields.metaDescription) seo["description"] = fields.metaDescription;
  if (fields.faq && fields.faq.length > 0) seo["faq"] = fields.faq;

  const { error: updateError } = await options.client
    .from("categories")
    .update({ description: fields.seoDescription ?? draft.content, seo: seo as never })
    .eq("id", draft.entity_id)
    .eq("store_id", options.storeId);
  if (updateError) throw new Error(updateError.message);

  await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", options.draftId)
    .eq("store_id", options.storeId);

  return { ok: true as const };
}

/* ---------------------------------------------------------------- blog paketi */

/** Konu başlığından tam blog paketi üretir (başlık, giriş, bölümler, SSS, meta). */
export async function generateBlogPackage(options: {
  client: Client;
  storeId: string;
  userId: string;
  topic: string;
  keywords?: string;
  tone?: string;
  length?: "kısa" | "orta" | "uzun";
}) {
  const store = await storeInfo(options.client, options.storeId);
  const { data: products } = await options.client
    .from("products")
    .select("title")
    .eq("store_id", options.storeId)
    .eq("status", "active")
    .limit(12);

  const prompt = [
    `Mağaza: ${store.name}${store.industry ? ` (${store.industry})` : ""}`,
    `Konu: ${options.topic}`,
    options.keywords?.trim() ? `Anahtar kelimeler: ${options.keywords.trim()}` : "",
    `Uzunluk: ${options.length ?? "orta"}`,
    `Ton: ${options.tone ?? "profesyonel"}`,
    (products ?? []).length > 0
      ? `Mağazadaki gerçek ürünler (yalnızca bunlara atıf yapabilirsin): ${(products ?? []).map((row) => row.title).join(", ")}`
      : "Mağazada henüz aktif ürün yok; ürün adı uydurma.",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Sen e-ticaret markaları için çalışan kıdemli bir içerik editörü ve SEO yazarısın.",
    BASE_RULES,
    'Yanıtı yalnızca şu JSON ile ver: {"title":"...","introduction":"...","headings":["..."],"article":"...","faq":[{"question":"...","answer":"..."}],"metaTitle":"...","metaDescription":"...","keywords":["..."]}',
    "article: headings sırasına göre yazılmış tam makale; her bölüm başlığını '## ' ile başlat.",
    "metaTitle en fazla 60, metaDescription en fazla 155 karakter. keywords 5-10 adet.",
  ].join(" ");

  const response = await ask({
    client: options.client,
    storeId: options.storeId,
    userId: options.userId,
    task: "blog_package",
    system,
    user: prompt,
    maxTokens: 4000,
  });

  const parsed = extractJson(response.text) as
    | {
        title?: string;
        introduction?: string;
        headings?: string[];
        article?: string;
        faq?: { question?: string; answer?: string }[];
        metaTitle?: string;
        metaDescription?: string;
        keywords?: string[];
      }
    | null;

  const fields = {
    title: (parsed?.title ?? options.topic).trim(),
    introduction: (parsed?.introduction ?? "").trim(),
    headings: (parsed?.headings ?? []).map((item) => String(item).trim()).filter(Boolean),
    article: (parsed?.article ?? response.text).trim(),
    faq: (parsed?.faq ?? [])
      .filter((item) => item.question && item.answer)
      .map((item) => ({ question: String(item.question).trim(), answer: String(item.answer).trim() })),
    metaTitle: (parsed?.metaTitle ?? "").trim().slice(0, 60),
    metaDescription: clampDescription((parsed?.metaDescription ?? "").trim()),
    keywords: (parsed?.keywords ?? []).map((item) => String(item).trim()).filter(Boolean),
  };

  const draftId = await saveDraft(options.client, {
    storeId: options.storeId,
    userId: options.userId,
    entityType: "blog",
    kind: "blog_package",
    tone: options.tone ?? null,
    title: fields.title,
    content: fields.article,
    fields,
  });

  return { draftId, tokens: response.tokens, fields };
}

/** Blog paketini taslak blog yazısı olarak mağazaya kaydeder. */
export async function applyBlogPackage(options: { client: Client; storeId: string; draftId: string }) {
  const { data: draft, error } = await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .select("id, title, content, fields")
    .eq("id", options.draftId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!draft) throw new Error("Taslak bulunamadı");

  const fields = (draft.fields ?? {}) as {
    introduction?: string;
    article?: string;
    faq?: { question: string; answer: string }[];
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };

  const faqBlock =
    (fields.faq ?? []).length > 0
      ? `\n\n## Sıkça sorulan sorular\n\n${(fields.faq ?? [])
          .map((item) => `**${item.question}**\n\n${item.answer}`)
          .join("\n\n")}`
      : "";
  const body = `${fields.introduction ? `${fields.introduction}\n\n` : ""}${fields.article ?? draft.content}${faqBlock}`;
  const title = String(draft.title ?? "Blog yazısı");
  const slug = `${slugifyTr(title).slice(0, 60)}-${Date.now().toString(36).slice(-4)}`;

  const { data: page, error: insertError } = await options.client
    .from("store_pages")
    .insert({
      store_id: options.storeId,
      page_kind: "blog",
      title,
      slug,
      body,
      excerpt: fields.introduction?.slice(0, 300) ?? null,
      seo_description: fields.metaDescription ?? null,
      seo: {
        title: fields.metaTitle ?? title,
        description: fields.metaDescription ?? "",
        keywords: (fields.keywords ?? []).join(", "),
      } as never,
      status: "draft",
      is_published: false,
    })
    .select("id, slug")
    .single();
  if (insertError) throw new Error(insertError.message);

  await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .update({ status: "applied", applied_at: new Date().toISOString(), entity_id: page.id })
    .eq("id", options.draftId)
    .eq("store_id", options.storeId);

  return { ok: true as const, pageId: String(page.id), slug: String(page.slug) };
}

/* -------------------------------------------------------------- hukuki metin */

/** KVKK, gizlilik, iade, mesafeli satış ve kullanım koşulları taslağı üretir. */
export async function generateLegalDraft(options: {
  client: Client;
  storeId: string;
  userId: string;
  kind: LegalKind;
  companyName?: string;
  contactEmail?: string;
  notes?: string;
}) {
  const store = await storeInfo(options.client, options.storeId);
  const label = LEGAL_KINDS[options.kind];

  const prompt = [
    `Mağaza adı: ${store.name}`,
    options.companyName?.trim() ? `Ticari unvan: ${options.companyName.trim()}` : "",
    options.contactEmail?.trim() ? `İletişim e-postası: ${options.contactEmail.trim()}` : "",
    `Belge türü: ${label}`,
    options.notes?.trim() ? `Ek notlar: ${options.notes.trim()}` : "",
    "Bilinmeyen bilgiler için [ŞİRKET ADRESİ], [VERGİ NO], [TELEFON] gibi köşeli parantezli yer tutucular kullan.",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Sen Türkiye mevzuatına (6698 sayılı KVKK, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği) aşina bir e-ticaret uyum editörüsün.",
    "Hukuki tavsiye vermiyorsun; yalnızca gözden geçirilecek TASLAK metin hazırlıyorsun.",
    BASE_RULES,
    "Metni numaralı maddeler ve '## ' ile başlayan bölüm başlıklarıyla yaz.",
    "Bilmediğin şirket bilgilerini asla uydurma; köşeli parantezli yer tutucu bırak.",
    "Metnin en başına kalın yazılmış bir uyarı satırı ekle: taslak olduğunu ve hukuki danışmanlık yerine geçmediğini belirt.",
  ].join(" ");

  const response = await ask({
    client: options.client,
    storeId: options.storeId,
    userId: options.userId,
    task: "legal_draft",
    system,
    user: prompt,
    maxTokens: 4000,
  });

  const content = `> ${LEGAL_DISCLAIMER}\n\n${response.text.trim()}`;

  const draftId = await saveDraft(options.client, {
    storeId: options.storeId,
    userId: options.userId,
    entityType: "legal",
    kind: options.kind,
    title: label,
    content,
    fields: { disclaimer: LEGAL_DISCLAIMER, kind: options.kind },
  });

  return { draftId, tokens: response.tokens, title: label, content, disclaimer: LEGAL_DISCLAIMER };
}

/** Hukuki taslağı yayınlanmamış bir mağaza sayfası olarak kaydeder. */
export async function applyLegalDraft(options: { client: Client; storeId: string; draftId: string }) {
  const { data: draft, error } = await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .select("id, title, content, kind")
    .eq("id", options.draftId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!draft) throw new Error("Taslak bulunamadı");

  const title = String(draft.title ?? "Hukuki metin");
  const slug = `${slugifyTr(title).slice(0, 60)}-taslak`;

  const { data: page, error: insertError } = await options.client
    .from("store_pages")
    .insert({
      store_id: options.storeId,
      page_kind: "page",
      title,
      slug,
      body: String(draft.content ?? ""),
      status: "draft",
      is_published: false,
      show_in_footer: false,
    })
    .select("id, slug")
    .single();
  if (insertError) throw new Error(insertError.message);

  await (options.client as unknown as Any)
    .from("ai_content_drafts")
    .update({ status: "applied", applied_at: new Date().toISOString(), entity_id: page.id })
    .eq("id", options.draftId)
    .eq("store_id", options.storeId);

  return { ok: true as const, pageId: String(page.id), slug: String(page.slug) };
}

/* ------------------------------------------------------------ rakip analizi */

export type CompetitorInput = {
  id?: string | null | undefined;
  productId?: string | null | undefined;
  name: string;
  url?: string | null | undefined;
  source?: string | null | undefined;
  competitorTitle?: string | null | undefined;
  competitorDescription?: string | null | undefined;
  competitorCategory?: string | null | undefined;
  competitorPrice?: number | null | undefined;
  currency?: string | null | undefined;
  visibilityScore?: number | null | undefined;
  serpPosition?: number | null | undefined;
  alertThresholdPct?: number | null | undefined;
  isActive?: boolean | undefined;
};

/** Rakip ürün kaydı ekler/güncelleyip fiyat değişimini geçmişe yazar. */
export async function saveCompetitor(options: {
  client: Client;
  storeId: string;
  input: CompetitorInput;
}) {
  const db = options.client as unknown as Any;
  const { input } = options;

  let previous: { competitor_price: number | null; product_id: string | null } | null = null;
  if (input.id) {
    const { data } = await db
      .from("competitor_products")
      .select("competitor_price, product_id")
      .eq("id", input.id)
      .eq("store_id", options.storeId)
      .maybeSingle();
    previous = data ?? null;
  }

  const priceChanged =
    input.competitorPrice != null &&
    previous?.competitor_price != null &&
    Number(previous.competitor_price) !== Number(input.competitorPrice);

  const row: Record<string, unknown> = {
    store_id: options.storeId,
    product_id: input.productId ?? null,
    name: input.name,
    url: input.url ?? null,
    source: input.source ?? "web",
    competitor_title: input.competitorTitle ?? null,
    competitor_description: input.competitorDescription ?? null,
    competitor_category: input.competitorCategory ?? null,
    competitor_price: input.competitorPrice ?? null,
    currency: input.currency ?? "TRY",
    visibility_score: input.visibilityScore ?? null,
    serp_position: input.serpPosition ?? null,
    alert_threshold_pct: input.alertThresholdPct ?? 0,
    is_active: input.isActive ?? true,
    last_checked_at: new Date().toISOString(),
  };
  if (priceChanged) {
    row["previous_price"] = previous?.competitor_price ?? null;
    row["last_price_change_at"] = new Date().toISOString();
  }
  if (input.id) row["id"] = input.id;

  const { data, error } = await db
    .from("competitor_products")
    .upsert(row, { onConflict: "id" })
    .select("id, product_id, competitor_price, currency, name, alert_threshold_pct")
    .single();
  if (error) throw new Error(error.message);

  if (input.competitorPrice != null) {
    await db.from("competitor_price_history").insert({
      store_id: options.storeId,
      competitor_id: data.id,
      price: input.competitorPrice,
      currency: input.currency ?? "TRY",
    });
  }

  const alert = await checkPriceAlert(options.client, options.storeId, String(data.id));
  return { id: String(data.id), priceChanged, alert };
}

export async function deleteCompetitor(options: { client: Client; storeId: string; id: string }) {
  const { error } = await (options.client as unknown as Any)
    .from("competitor_products")
    .delete()
    .eq("id", options.id)
    .eq("store_id", options.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/**
 * Rakip fiyatı bizim fiyatımızdan (eşiği aşacak kadar) düşükse mağaza
 * bildirimi oluşturur.
 */
export async function checkPriceAlert(client: Client, storeId: string, competitorId: string) {
  const db = client as unknown as Any;
  const { data: competitor } = await db
    .from("competitor_products")
    .select("id, name, competitor_price, currency, product_id, alert_threshold_pct")
    .eq("id", competitorId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!competitor?.product_id || competitor.competitor_price == null) return null;

  const { data: product } = await client
    .from("products")
    .select("id, title, base_price, currency")
    .eq("id", competitor.product_id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!product?.base_price) return null;

  const ours = Number(product.base_price);
  const theirs = Number(competitor.competitor_price);
  if (!(theirs < ours)) return null;

  const diffPct = ((ours - theirs) / ours) * 100;
  const threshold = Number(competitor.alert_threshold_pct ?? 0);
  if (diffPct < threshold) return null;

  const { createSystemNotification } = await import("@/lib/notifications.server");
  const message = `${competitor.name} ürününde rakip fiyatı ${theirs.toLocaleString("tr-TR")} ${competitor.currency}; sizin fiyatınız ${ours.toLocaleString("tr-TR")} ${product.currency}. Fark %${diffPct.toFixed(1)}.`;
  try {
    await createSystemNotification(client, {
      storeId,
      kind: "competitor_price_drop",
      title: `Rakip fiyatı daha düşük: ${product.title}`,
      message,
    } as never);
  } catch {
    /* bildirim gönderilemese de analiz sonucu döner */
  }
  return { productTitle: String(product.title), ourPrice: ours, competitorPrice: theirs, diffPct, message };
}

/** Rakip ürünü kendi ürünümüzle karşılaştırıp AI analizi üretir. */
export async function analyzeCompetitor(options: {
  client: Client;
  storeId: string;
  userId: string;
  competitorId: string;
}) {
  const db = options.client as unknown as Any;
  const { data: competitor, error } = await db
    .from("competitor_products")
    .select("*")
    .eq("id", options.competitorId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!competitor) throw new Error("Rakip kaydı bulunamadı");

  type OurProduct = { title: string; description: string | null; base_price: number; currency: string };
  let ours: OurProduct | null = null;
  if (competitor.product_id) {
    const { data } = await (options.client as unknown as Any)
      .from("products")
      .select("title, description, base_price, currency")
      .eq("id", competitor.product_id)
      .eq("store_id", options.storeId)
      .maybeSingle();
    ours = data ? (data as OurProduct) : null;
  }

  const { data: history } = await db
    .from("competitor_price_history")
    .select("price, checked_at")
    .eq("competitor_id", options.competitorId)
    .order("checked_at", { ascending: false })
    .limit(10);

  const prompt = [
    "RAKİP",
    `Ad: ${competitor.name}`,
    competitor.url ? `Bağlantı: ${competitor.url}` : "",
    competitor.source ? `Kaynak: ${competitor.source}` : "",
    competitor.competitor_title ? `Başlık: ${competitor.competitor_title}` : "",
    competitor.competitor_category ? `Kategori: ${competitor.competitor_category}` : "",
    competitor.competitor_price != null ? `Fiyat: ${competitor.competitor_price} ${competitor.currency}` : "Fiyat bilinmiyor",
    competitor.competitor_description
      ? `Açıklama: ${plainText(String(competitor.competitor_description)).slice(0, 1200)}`
      : "",
    competitor.visibility_score != null ? `Görünürlük puanı: ${competitor.visibility_score}` : "",
    competitor.serp_position != null ? `SERP sırası: ${competitor.serp_position}` : "",
    (history ?? []).length > 0
      ? `Fiyat geçmişi: ${(history ?? []).map((row: any) => `${row.price} (${String(row.checked_at).slice(0, 10)})`).join(", ")}`
      : "",
    "",
    "BİZİM ÜRÜNÜMÜZ",
    ours ? `Ad: ${ours.title}` : "Eşleştirilmiş ürün yok.",
    ours ? `Fiyat: ${ours.base_price} ${ours.currency}` : "",
    ours?.description ? `Açıklama: ${plainText(ours.description).slice(0, 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Sen e-ticaret rekabet analistisin.",
    BASE_RULES,
    'Yanıtı yalnızca şu JSON ile ver: {"analysis":"...","priceVerdict":"...","titleVerdict":"...","descriptionVerdict":"...","categoryVerdict":"...","visibilityVerdict":"...","serpVerdict":"...","contentVerdict":"...","contentScore":0,"actions":["..."]}',
    "analysis: 2 paragraf özet. Her *Verdict alanı tek cümle karşılaştırma.",
    "contentScore: bizim içeriğimizin rakibe göre 0-100 arası puanı.",
    "actions: 3-5 uygulanabilir aksiyon. Veri yoksa 'veri yok' yaz, tahmin üretme.",
  ].join(" ");

  const response = await ask({
    client: options.client,
    storeId: options.storeId,
    userId: options.userId,
    task: "competitor_analysis",
    system,
    user: prompt,
    maxTokens: 2400,
  });

  const parsed = (extractJson(response.text) ?? {}) as Record<string, any>;
  const analysis = typeof parsed["analysis"] === "string" ? String(parsed["analysis"]) : response.text.trim();
  const contentScore = Number(parsed["contentScore"]);

  await db
    .from("competitor_products")
    .update({
      ai_analysis: analysis,
      ai_summary: parsed,
      content_score: Number.isFinite(contentScore) ? Math.min(Math.max(Math.round(contentScore), 0), 100) : null,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", options.competitorId)
    .eq("store_id", options.storeId);

  const alert = await checkPriceAlert(options.client, options.storeId, options.competitorId);

  return { analysis, summary: parsed, tokens: response.tokens, alert };
}

/** Panel listesi: rakipler, eşleşen ürün fiyatı ve son fiyat hareketleri. */
export async function listCompetitors(client: Client, storeId: string) {
  const db = client as unknown as Any;
  const { data, error } = await db
    .from("competitor_products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))] as string[];
  let products = new Map<string, { title: string; price: number; currency: string }>();
  if (productIds.length > 0) {
    const { data: productRows } = await client
      .from("products")
      .select("id, title, base_price, currency")
      .eq("store_id", storeId)
      .in("id", productIds);
    products = new Map(
      ((productRows ?? []) as any[]).map((row) => [
        String(row.id),
        { title: String(row.title), price: Number(row.base_price ?? 0), currency: String(row.currency ?? "TRY") },
      ]),
    );
  }

  return rows.map((row) => {
    const ourProduct = row.product_id ? (products.get(String(row.product_id)) ?? null) : null;
    const theirs = row.competitor_price == null ? null : Number(row.competitor_price);
    const diffPct =
      ourProduct && ourProduct.price > 0 && theirs != null
        ? Math.round(((ourProduct.price - theirs) / ourProduct.price) * 1000) / 10
        : null;
    return {
      id: String(row.id),
      name: String(row.name),
      url: row.url ? String(row.url) : null,
      source: String(row.source ?? "web"),
      productId: row.product_id ? String(row.product_id) : null,
      productTitle: ourProduct?.title ?? null,
      ourPrice: ourProduct?.price ?? null,
      competitorTitle: row.competitor_title ? String(row.competitor_title) : null,
      competitorDescription: row.competitor_description ? String(row.competitor_description) : null,
      competitorCategory: row.competitor_category ? String(row.competitor_category) : null,
      competitorPrice: theirs,
      previousPrice: row.previous_price == null ? null : Number(row.previous_price),
      currency: String(row.currency ?? "TRY"),
      visibilityScore: row.visibility_score == null ? null : Number(row.visibility_score),
      serpPosition: row.serp_position == null ? null : Number(row.serp_position),
      contentScore: row.content_score == null ? null : Number(row.content_score),
      alertThresholdPct: Number(row.alert_threshold_pct ?? 0),
      aiAnalysis: row.ai_analysis ? String(row.ai_analysis) : null,
      aiSummary: (row.ai_summary ?? {}) as Record<string, any>,
      isActive: Boolean(row.is_active),
      lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
      lastPriceChangeAt: row.last_price_change_at ? String(row.last_price_change_at) : null,
      diffPct,
      cheaperThanUs: diffPct != null && diffPct > 0,
    };
  });
}

/** Taslak listesi (ürün, kategori, blog, hukuki). */
export async function listAiDrafts(client: Client, storeId: string, entityType?: string) {
  const db = client as unknown as Any;
  let query = db
    .from("ai_content_drafts")
    .select("id, entity_type, entity_id, kind, tone, title, content, fields, status, applied_at, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (entityType) query = query.eq("entity_type", entityType);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    kind: String(row.kind),
    tone: row.tone ? String(row.tone) : null,
    title: row.title ? String(row.title) : null,
    content: String(row.content ?? ""),
    fields: (row.fields ?? {}) as Record<string, any>,
    status: String(row.status),
    appliedAt: row.applied_at ? String(row.applied_at) : null,
    createdAt: String(row.created_at),
  }));
}
