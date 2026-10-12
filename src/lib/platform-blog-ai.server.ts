import { z } from "zod";

import { callProvider } from "@/lib/ai.server";
import { slugifyTr } from "@/lib/blog-ai.server";

/** Süper yönetici: mefticaret.com platform blogu için e-ticaret uzmanı AI yazar. */

export const platformBlogAiSchema = z.object({
  mode: z.enum(["new", "improve", "seo"]).default("new"),
  topic: z.string().trim().max(200).default(""),
  keywords: z.string().trim().max(300).default(""),
  audience: z.string().trim().max(200).default(""),
  tone: z.enum(["uzman", "samimi", "teknik", "rehber"]).default("uzman"),
  length: z.enum(["kisa", "orta", "uzun"]).default("orta"),
  currentTitle: z.string().max(200).default(""),
  currentBody: z.string().max(60_000).default(""),
});

const SYSTEM = [
  "Sen Mefticaret'in kıdemli e-ticaret içerik editörüsün. Türkiye e-ticaret pazarını, online mağaza kurulumunu, pazaryerlerini (Trendyol, Hepsiburada, n11, Amazon), dropshipping, XML entegrasyonu, ödeme (iyzico, PayTR), kargo, e-fatura, SEO, reklam ve dönüşüm optimizasyonunu iyi bilirsin.",
  "Mefticaret; online mağaza kurma, ürün/sipariş/ödeme/kargo yönetimi, pazaryeri entegrasyonu, tedarikçi paneli ve XML entegratör, ev hanımları için Kolay Panel ve yapay zekâ araçları sunan bir e-ticaret altyapısıdır.",
  "Kurallar: uydurma istatistik, fiyat, müşteri adı, yasal madde numarası veya kaynak yazma. Emin olmadığın sayısal veriyi verme. Klişe ifadeler (dijital dünyada, günümüzde) kullanma.",
  "Gövdeyi markdown yaz: ## ve ### alt başlıklar, listeler, **vurgu**; H1 kullanma. Sonda kısa SSS ve Mefticaret'e yumuşak eylem çağrısı olsun.",
  'SADECE geçerli JSON döndür: {"title":string,"metaTitle":string,"slug":string,"excerpt":string,"seoDescription":string,"body":string,"tags":string[],"category":string}',
  "metaTitle en fazla 60, seoDescription en fazla 155 karakter. slug Türkçe karakter içermez. tags 3-6 adet. category tek kelime/kısa ifade (Rehber, Pazaryeri, SEO, Pazarlama, Ödeme, Kargo, Duyuru).",
].join(" ");

const LENGTH = { kisa: "600-800 kelime", orta: "1100-1500 kelime", uzun: "2000-2600 kelime" } as const;

const out = z.object({
  title: z.string(),
  metaTitle: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  seoDescription: z.string().optional(),
  body: z.string(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI yanıtı okunamadı, tekrar deneyin");
  return JSON.parse(text.slice(start, end + 1));
}

export async function generatePlatformBlog(
  input: z.infer<typeof platformBlogAiSchema>,
  existingTitles: string[],
) {
  if (input.mode === "new" && input.topic.length < 3) throw new Error("Konu yazın");
  if (input.mode !== "new" && input.currentBody.trim().length < 50)
    throw new Error("İyileştirmek için önce yazı içeriği olmalı");

  const task =
    input.mode === "new"
      ? `Yeni yazı yaz. Konu: ${input.topic}`
      : input.mode === "improve"
        ? `Aşağıdaki yazıyı anlamını koruyarak daha kapsamlı, akıcı ve SEO uyumlu hâle getir.\nBaşlık: ${input.currentTitle}\n---\n${input.currentBody}`
        : `Aşağıdaki yazının gövdesini aynen koru (body alanına aynısını yaz); yalnız başlık, metaTitle, slug, excerpt, seoDescription, tags ve category üret.\nBaşlık: ${input.currentTitle}\n---\n${input.currentBody}`;

  const prompt = [
    task,
    input.keywords ? `Hedef anahtar kelimeler: ${input.keywords}` : "",
    input.audience ? `Hedef kitle: ${input.audience}` : "Hedef kitle: online satış yapmak isteyen işletmeler ve girişimciler",
    `Ton: ${input.tone}. Uzunluk: ${LENGTH[input.length]}.`,
    existingTitles.length
      ? `Blogda zaten olan yazılar (tekrar etme, uygunsa iç bağlantı önerisi olarak /blog/... adıyla bahset):\n- ${existingTitles.slice(0, 40).join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await callProvider({
    purpose: "text",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    maxTokens: input.length === "uzun" ? 7000 : input.length === "orta" ? 4500 : 3000,
  });

  const parsed = out.parse(extractJson(result.text));
  const body = input.mode === "seo" ? input.currentBody : parsed.body;
  return {
    title: parsed.title.slice(0, 200),
    metaTitle: (parsed.metaTitle ?? parsed.title).slice(0, 70),
    slug: slugifyTr(parsed.slug && parsed.slug.length > 2 ? parsed.slug : parsed.title),
    excerpt: (parsed.excerpt ?? "").slice(0, 600),
    seoDescription: (parsed.seoDescription ?? parsed.excerpt ?? "").slice(0, 160),
    body,
    tags: (parsed.tags ?? []).map((t) => t.slice(0, 40)).slice(0, 8),
    category: (parsed.category ?? "").slice(0, 60),
  };
}
