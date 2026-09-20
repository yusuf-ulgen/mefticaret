/**
 * Ürün fotoğrafı için yapay zekâ destekli görsel stüdyosu:
 * arka plan temizleme, stüdyo sahnesi, yaşam alanı sahnesi ve sanal moda mankeni.
 * Görsel modeli Lovable AI Gateway üzerinden çağrılır; anahtar yalnızca sunucuda okunur.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-pro-image";

export type PhotoStudioMode = "background" | "studio" | "lifestyle" | "model";

export const PHOTO_STUDIO_LABELS: Record<PhotoStudioMode, string> = {
  background: "Arka planı temizle",
  studio: "Stüdyo ışığı",
  lifestyle: "Yaşam alanı sahnesi",
  model: "Sanal moda mankeni",
};

const KEEP_RULES =
  "Ürünün rengini, dokusunu, deseninin yönünü, oranlarını ve tüm detaylarını birebir koru. " +
  "Ürüne yazı, logo, filigran veya yeni nesne ekleme. Sonucu yalnızca görsel olarak döndür.";

const PROMPTS: Record<PhotoStudioMode, string> = {
  background:
    "Bu ürün fotoğrafındaki arka planı tamamen kaldır ve ürünü düz, temiz beyaz bir arka plana yerleştir. " +
    KEEP_RULES,
  studio:
    "Bu ürünü profesyonel bir e-ticaret stüdyosunda çekilmiş gibi göster: yumuşak açık gri gradyan fon, " +
    "dengeli yumuşak ışık, ürünün altında hafif doğal gölge ve yansıma. " +
    KEEP_RULES,
  lifestyle:
    "Bu ürünü gerçekçi bir yaşam alanı sahnesine yerleştir: doğal gün ışığı alan sade ve modern bir iç mekân, " +
    "ürün net odakta, arka plan hafif bulanık. Sahnede dikkat dağıtan başka ürün olmasın. " +
    KEEP_RULES,
  model:
    "Bu giyim/aksesuar ürününü gerçekçi bir moda mankeni üzerinde göster: nötr duruşlu, yüzü sade, " +
    "stüdyo ışığında açık renk fon önünde duran yetişkin bir manken. Ürünün kesimi, bedeni ve tüm detayları " +
    "fotoğraftaki ürünle aynı kalsın; ünlü kişilere benzeyen yüz üretme. " +
    KEEP_RULES,
};

export type CleanPhotoResult = { dataUrl: string };

function gatewayMessage(status: number, detail: string): string {
  if (status === 401) return "Yapay zekâ servisi yapılandırılmamış.";
  if (status === 402) return "Yapay zekâ kredisi tükendi. Çalışma alanına kredi ekleyin.";
  if (status === 403) return "Yapay zekâ kullanımı kapalı veya limit dolu.";
  if (status === 429) return "Çok fazla istek gönderildi, kısa süre sonra tekrar deneyin.";
  if (status >= 500) return "Yapay zekâ servisi geçici olarak yanıt vermiyor.";
  return `Fotoğraf temizlenemedi (${status}): ${detail.slice(0, 160)}`;
}

/** Data URL biçimindeki fotoğrafı seçilen moda göre yeniden üretir. */
export async function cleanPhotoBackground(
  dataUrl: string,
  mode: PhotoStudioMode = "background",
): Promise<CleanPhotoResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Yapay zekâ servisi yapılandırılmamış.");

  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) {
    throw new Error("Yalnızca PNG, JPG veya WEBP fotoğraf işlenebilir.");
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  // 8 MB'lık base64 ≈ 6 MB dosya; daha büyüğü reddedilir.
  if (base64.length > 8_000_000) throw new Error("Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPTS[mode] ?? PROMPTS.background },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(gatewayMessage(response.status, await response.text()));

  const payload = (await response.json()) as {
    choices?: {
      message?: {
        images?: { image_url?: { url?: string } }[];
        content?: unknown;
      };
    }[];
  };

  const image = payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof image === "string" && image.startsWith("data:image/")) return { dataUrl: image };
  throw new Error("Yapay zekâ fotoğrafı temizleyemedi. Lütfen tekrar deneyin.");
}
