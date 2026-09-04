/**
 * Yapay zekâ ile e-ticaret blog yazısı üretimi — yalnızca sunucu.
 * Model, mağazanın gerçek ürün/koleksiyon verisiyle temellendirilir; uydurma
 * ürün adı veya fiyat üretmemesi için bağlam bloğu zorunlu kılınır.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { callProvider, loadStoreAiSettings, monthlyTokenUsage } from "@/lib/ai.server";

type Client = SupabaseClient<Database>;

export const blogDraftSchema = z.object({
  storeId: z.string().uuid(),
  topic: z.string().trim().min(3).max(200),
  keywords: z.string().trim().max(300).optional().default(""),
  tone: z.enum(["premium", "samimi", "teknik", "minimal"]).default("premium"),
  length: z.enum(["kisa", "orta", "uzun"]).default("orta"),
  /** Ürünleri içerikte doğal biçimde önerelim mi? */
  includeProducts: z.boolean().default(true),
  audience: z.string().trim().max(200).optional().default(""),
});

export type BlogDraftInput = z.infer<typeof blogDraftSchema>;

export type BlogDraftResult = {
  title: string;
  slug: string;
  excerpt: string;
  seoDescription: string;
  body: string;
  tags: string[];
  outline: string[];
  totalTokens: number;
  model: string;
};

const SYSTEM_PROMPT = [
  "Sen kıdemli bir e-ticaret içerik stratejistisin: SEO, dönüşüm optimizasyonu, kategori/ürün içeriği ve online perakende operasyonlarını iyi bilirsin.",
  "Görev: verilen mağaza için yayına hazır, özgün, Türkçe bir blog yazısı üret.",
  "Kurallar: yalnızca MAĞAZA BAĞLAMI'ndaki gerçek ürün, koleksiyon ve fiyat bilgilerini kullan; bağlamda olmayan ürün adı, marka, kampanya veya istatistik uydurma.",
  "Yazı arama niyetini karşılamalı: net giriş, alt başlıklarla ilerleyen gövde, uygulanabilir öneriler ve kapanışta yumuşak bir eylem çağrısı.",
  "Anahtar kelimeleri doğal biçimde ve aşırıya kaçmadan kullan. Klişe AI ifadeleri (dijital dünyada, günümüzde) kullanma.",
  "Gövdeyi markdown olarak yaz: alt başlıklar için ##, listeler için -, vurgular için **. H1 kullanma (başlık ayrı alanda).",
  "SADECE geçerli JSON döndür, kod bloğu veya açıklama ekleme. Şema:",
  '{"title":string,"slug":string,"excerpt":string,"seoDescription":string,"body":string,"tags":string[],"outline":string[]}',
  "slug: küçük harf, Türkçe karakter yok, kelimeler tire ile. excerpt: 1-2 cümle. seoDescription: en fazla 155 karakter. tags: 3-6 kısa etiket.",
].join(" ");

const LENGTH_HINT: Record<BlogDraftInput["length"], string> = {
  kisa: "500-700 kelime, 3-4 alt başlık",
  orta: "900-1200 kelime, 5-6 alt başlık",
  uzun: "1500-1900 kelime, 7-9 alt başlık ve kısa bir SSS bölümü",
};

const MAX_TOKENS: Record<BlogDraftInput["length"], number> = {
  kisa: 2200,
  orta: 3200,
  uzun: 4600,
};

function money(value: number, currency: string) {
  return `${value.toLocaleString("tr-TR")} ${currency}`;
}

/** Modelin temellendirileceği gerçek mağaza verisini toplar. */
export async function collectBlogContext(client: Client, storeId: string) {
  const { data: store, error: storeError } = await client
    .from("stores")
    .select("id, name, slug, industry, currency, description")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

  const [products, collections, categories] = await Promise.all([
    client
      .from("products")
      .select("title, slug, base_price, short_description, vendor, status")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20),
    client.from("collections").select("title, description").eq("store_id", storeId).limit(12),
    client.from("categories").select("name").eq("store_id", storeId).limit(20),
  ]);

  const currency = store.currency ?? "TRY";
  const productLines = (products.data ?? []).map((row) => {
    const price = row.base_price != null ? ` — ${money(Number(row.base_price), currency)}` : "";
    const summary = row.short_description ? ` — ${String(row.short_description).slice(0, 140)}` : "";
    return `- ${row.title}${price}${summary}${row.slug ? ` (/p/${row.slug})` : ""}`;
  });

  const promptBlock = [
    "MAĞAZA BAĞLAMI",
    `Mağaza: ${store.name}${store.industry ? ` (${store.industry})` : ""}`,
    store.description ? `Tanım: ${String(store.description).slice(0, 300)}` : null,
    `Para birimi: ${currency}`,
    `Vitrin yolu: /s/${store.slug}`,
    productLines.length > 0 ? `Aktif ürünler:\n${productLines.join("\n")}` : "Aktif ürün yok.",
    (collections.data ?? []).length > 0
      ? `Koleksiyonlar: ${(collections.data ?? []).map((row) => row.title).join(", ")}`
      : "Koleksiyon yok.",
    (categories.data ?? []).length > 0
      ? `Kategoriler: ${(categories.data ?? []).map((row) => row.name).join(", ")}`
      : "Kategori yok.",
  ]
    .filter(Boolean)
    .join("\n");

  return { store, promptBlock, productCount: productLines.length };
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI yanıtı beklenen biçimde değil, tekrar deneyin.");
  }
}

const TR_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};

export function slugifyTr(value: string) {
  return value
    .toLowerCase()
    .replace(/[çğıİöşü]/g, (char) => TR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const responseSchema = z.object({
  title: z.string().trim().min(3),
  slug: z.string().trim().optional(),
  excerpt: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
  body: z.string().trim().min(50),
  tags: z.array(z.string().trim()).optional(),
  outline: z.array(z.string().trim()).optional(),
});

/** Blog taslağını üretir, kullanımı kaydeder ve panelde forma basılacak alanları döner. */
export async function generateBlogDraftContent(options: {
  client: Client;
  storeId: string;
  userId: string;
  input: BlogDraftInput;
}): Promise<BlogDraftResult> {
  const { client, storeId, userId, input } = options;

  const settings = await loadStoreAiSettings(client, storeId);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(client, storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu. Limiti AI ayarlarından yükseltebilirsiniz.");
  }

  const context = await collectBlogContext(client, storeId);

  const userPrompt = [
    context.promptBlock,
    "",
    "BRIEF",
    `Konu: ${input.topic}`,
    input.keywords ? `Hedef anahtar kelimeler: ${input.keywords}` : "Hedef anahtar kelime belirtilmedi.",
    input.audience ? `Hedef kitle: ${input.audience}` : null,
    `Marka tonu: ${input.tone}`,
    `Uzunluk: ${LENGTH_HINT[input.length]}`,
    input.includeProducts && context.productCount > 0
      ? "Yazının uygun yerlerinde mağazanın gerçek ürünlerinden 2-4 tanesini bağlamına uygun biçimde öner; ürün adlarını ve fiyatlarını bağlamdaki gibi kullan."
      : "Belirli ürün önerme; konuyu genel ve bilgilendirici tut.",
  ]
    .filter(Boolean)
    .join("\n");

  const started = Date.now();
  const result = await callProvider({
    providerCode: settings.providerCode,
    model: settings.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: settings.creativity,
    maxTokens: MAX_TOKENS[input.length],
  });

  const parsed = responseSchema.parse(extractJson(result.text));
  const totalTokens = result.inputTokens + result.outputTokens;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_generations").insert({
    store_id: storeId,
    user_id: userId,
    task: "blog_post",
    provider_code: settings.providerCode,
    model: settings.model,
    prompt: userPrompt.slice(0, 8000),
    output: result.text.slice(0, 20000),
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    total_tokens: totalTokens,
    duration_ms: Date.now() - started,
    status: "success",
  });

  const excerpt = parsed.excerpt?.slice(0, 300) ?? "";
  return {
    title: parsed.title.slice(0, 160),
    slug: slugifyTr(parsed.slug && parsed.slug.length > 2 ? parsed.slug : parsed.title),
    excerpt,
    seoDescription: (parsed.seoDescription ?? excerpt).slice(0, 158),
    body: parsed.body,
    tags: (parsed.tags ?? []).map((tag) => tag.slice(0, 40)).slice(0, 6),
    outline: (parsed.outline ?? []).slice(0, 12),
    totalTokens,
    model: settings.model,
  };
}
