/**
 * AI Anahtar Kelime Üreticisi — yalnız sunucu.
 * Tüm çağrılar merkezî AI motorundan (callProvider) geçer: kredi kontrolü önce,
 * başarılı yanıtta 1 kredi (metin işi) düşülür.
 */
import { z } from "zod";

import { KEYWORD_MARKETS, type KeywordMarket, type KeywordResult } from "@/lib/keyword-generator";

const MARKET_HINTS: Record<KeywordMarket, string> = {
  google: "Google SEO: arama hacmi yüksek, bilgi ve satın alma niyetli sorgular; meta başlık 60, açıklama 155 karakter.",
  trendyol: "Trendyol arama algoritması: marka + ürün tipi + özellik sıralaması, kısa ve sık aranan Türkçe ifadeler.",
  hepsiburada: "Hepsiburada arama: kategori + teknik özellik + kullanım amacı içeren başlıklar.",
  amazon: "Amazon A9/A10: başlıkta ana kelime önce, backend search terms için tekrarsız kelimeler.",
};

const intentEnum = z.enum(["informational", "commercial", "transactional"]);

const resultSchema = z.object({
  primary: z.array(z.string().trim().min(1).max(80)).max(20),
  longTail: z.array(z.string().trim().min(1).max(120)).max(25),
  lsi: z.array(z.string().trim().min(1).max(80)).max(25),
  intents: z
    .array(z.object({ keyword: z.string().trim().min(1).max(120), intent: intentEnum }))
    .max(30),
  negative: z.array(z.string().trim().min(1).max(80)).max(20),
  visualAttributes: z
    .object({
      color: z.array(z.string().max(40)).max(8).default([]),
      fabric: z.array(z.string().max(40)).max(8).default([]),
      style: z.array(z.string().max(40)).max(8).default([]),
    })
    .partial()
    .optional(),
  metaTitle: z.string().max(120).default(""),
  metaDescription: z.string().max(320).default(""),
});

function parseJson(text: string): KeywordResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI geçerli bir sonuç döndürmedi. Tekrar deneyin.");
  const parsed = resultSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
  if (!parsed.success) throw new Error("AI yanıtı beklenen biçimde değil. Tekrar deneyin.");
  const r = parsed.data;
  return {
    primary: r.primary,
    longTail: r.longTail,
    lsi: r.lsi,
    intents: r.intents,
    negative: r.negative,
    visualAttributes: {
      color: r.visualAttributes?.color ?? [],
      fabric: r.visualAttributes?.fabric ?? [],
      style: r.visualAttributes?.style ?? [],
    },
    metaTitle: r.metaTitle,
    metaDescription: r.metaDescription,
  };
}

const SYSTEM = `Sen Türkiye e-ticaret pazarı için kıdemli bir SEO ve pazaryeri arama uzmanısın.
Yalnız geçerli JSON döndür, açıklama yazma. Şema:
{"primary":[string],"longTail":[string],"lsi":[string],"intents":[{"keyword":string,"intent":"informational"|"commercial"|"transactional"}],"negative":[string],"visualAttributes":{"color":[string],"fabric":[string],"style":[string]},"metaTitle":string,"metaDescription":string}
Kurallar: Türkçe yaz; primary 6-10 yüksek hacimli odak kelime; longTail 8-12 dönüşüm odaklı uzun kuyruk; lsi 8-12 anlamsal ilişkili terim; intents primary+longTail kelimelerinin niyet sınıfı; negative 5-10 alakasız reklam harcamasını önleyecek negatif kelime; metaTitle en fazla 60 karakter; metaDescription en fazla 155 karakter. Arama hacmi rakamı UYDURMA, yalnız kelime listesi ver.`;

/** Rakip sayfasını güvenli şekilde okur (yalnız https, özel ağ adresleri engelli). */
export async function readCompetitorPage(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Geçerli bir ürün linki girin.");
  }
  if (url.protocol !== "https:") throw new Error("Yalnız https:// ile başlayan linkler desteklenir.");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(":")
  ) {
    throw new Error("Bu adres okunamaz.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let html = "";
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MefticaretKeywordBot/1.0)", Accept: "text/html" },
    });
    if (!res.ok) throw new Error(`Sayfa okunamadı (${res.status}).`);
    const finalHost = new URL(res.url || url.toString()).hostname;
    if (finalHost === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(finalHost)) throw new Error("Bu adres okunamaz.");
    html = (await res.text()).slice(0, 600_000);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Sayfa zamanında yanıt vermedi.");
    throw error instanceof Error ? error : new Error("Sayfa okunamadı.");
  } finally {
    clearTimeout(timer);
  }
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? "";
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const kw = pick(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const headings = [...html.matchAll(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/gi)]
    .slice(0, 8)
    .map((m) => m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 2500);
  const summary = [
    `Başlık: ${title || ogTitle}`,
    desc && `Meta açıklama: ${desc}`,
    kw && `Meta anahtar kelimeler: ${kw}`,
    headings.length ? `Başlıklar: ${headings.join(" | ")}` : "",
    `Sayfa metni: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
  if (!title && !ogTitle && body.length < 50) throw new Error("Sayfadan içerik alınamadı.");
  return summary;
}

export async function generateKeywordSet(input: {
  storeId: string;
  userId: string;
  mode: "text" | "vision" | "url";
  markets: KeywordMarket[];
  productName?: string | undefined;
  category?: string | undefined;
  audience?: string | undefined;
  imageDataUrl?: string | undefined;
  url?: string | undefined;
}): Promise<{ result: KeywordResult; creditsUsed: number }> {
  const markets = input.markets.length ? input.markets : (["google"] as KeywordMarket[]);
  const marketText = markets.map((m) => `- ${KEYWORD_MARKETS[m]}: ${MARKET_HINTS[m]}`).join("\n");
  const base = [
    input.productName && `Ürün adı: ${input.productName}`,
    input.category && `Kategori: ${input.category}`,
    input.audience && `Hedef kitle: ${input.audience}`,
  ]
    .filter(Boolean)
    .join("\n");

  let userPrompt = "";
  const images: string[] = [];
  if (input.mode === "text") {
    if (!input.productName) throw new Error("Ürün adı gerekli.");
    userPrompt = `${base}\n\nOdak arama motorları/pazaryerleri:\n${marketText}\n\nBu ürün için anahtar kelime seti üret.`;
  } else if (input.mode === "vision") {
    if (!input.imageDataUrl) throw new Error("Ürün görseli gerekli.");
    images.push(input.imageDataUrl);
    userPrompt = `${base}\n\nGörseldeki ürünü incele; renk, kumaş/malzeme ve stil niteliklerini visualAttributes alanına yaz ve bunları kullanarak anahtar kelime seti üret.\n\nOdak:\n${marketText}`;
  } else {
    if (!input.url) throw new Error("Rakip ürün linki gerekli.");
    const page = await readCompetitorPage(input.url);
    userPrompt = `Rakip ürün sayfası özeti:\n${page}\n\n${base}\n\nRakibin SEO kelime stratejisini çıkar ve bizim mağazamız için geliştirilmiş bir anahtar kelime seti üret.\n\nOdak:\n${marketText}`;
  }

  const { callProvider } = await import("@/lib/ai.server");
  const out = await callProvider({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
    images,
    temperature: 0.4,
    maxTokens: 1800,
    purpose: "text",
    charge: { storeId: input.storeId, userId: input.userId, task: `keywords_${input.mode}` },
  });
  return { result: parseJson(out.text), creditsUsed: out.creditsUsed };
}

export async function generateSeoDescription(input: {
  storeId: string;
  userId: string;
  productName: string;
  category?: string | undefined;
  audience?: string | undefined;
  keywords: string[];
}): Promise<{ text: string; creditsUsed: number }> {
  const { callProvider } = await import("@/lib/ai.server");
  const out = await callProvider({
    messages: [
      {
        role: "system",
        content:
          "Türkçe e-ticaret metin yazarısın. Verilen anahtar kelimeleri doğal şekilde kullanan, abartısız, doğrulanamaz iddia (en iyi, %100 vb.) içermeyen SEO uyumlu ürün açıklaması yaz. Biçim: kısa giriş paragrafı, 4-6 maddelik öne çıkan özellikler listesi, kullanım/bakım paragrafı. Düz metin, madde işaretleri için '- ' kullan.",
      },
      {
        role: "user",
        content: `Ürün: ${input.productName}\n${input.category ? `Kategori: ${input.category}\n` : ""}${input.audience ? `Hedef kitle: ${input.audience}\n` : ""}Kullanılacak anahtar kelimeler: ${input.keywords.join(", ")}`,
      },
    ],
    temperature: 0.7,
    maxTokens: 1500,
    purpose: "text",
    charge: { storeId: input.storeId, userId: input.userId, task: "keywords_description" },
  });
  return { text: out.text, creditsUsed: out.creditsUsed };
}
