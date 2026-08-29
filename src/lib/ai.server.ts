/** Lovable AI Gateway yardımcıları — yalnızca sunucu tarafında çalışır. */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export type ChatMessage = { role: "system" | "user"; content: string };

export async function chatComplete(messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI servisi yapılandırılmamış");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (response.status === 429) throw new Error("AI kullanım limiti doldu, biraz sonra dene");
  if (response.status === 402) throw new Error("AI kredisi tükendi");
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI isteği başarısız (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI boş yanıt döndü");
  return text;
}

export const COPY_SYSTEM_PROMPT = [
  "Sen Türkiye pazarına odaklı bir e-ticaret metin yazarısın.",
  "Kısa, satış odaklı ve abartısız Türkçe metinler üret.",
  "Yanıtı şu başlıklarla ver: 'Açıklama', 'Öne çıkan özellikler' (3-5 madde), 'SEO başlığı' (60 karakter altı), 'SEO açıklaması' (155 karakter altı).",
  "Markdown başlıkları kullanma, sade metin ve tire ile maddeler kullan.",
].join(" ");

export const INSIGHT_SYSTEM_PROMPT = [
  "Sen bir e-ticaret büyüme analistisin.",
  "Verilen mağaza metriklerini yorumla ve uygulanabilir öneriler ver.",
  "Yanıtı 'Durum özeti', 'Riskler', 'Öncelikli 3 aksiyon' bölümleriyle, sade Türkçe metin olarak yaz.",
  "Veri yetersizse bunu açıkça belirt ve varsayım üretme.",
].join(" ");
