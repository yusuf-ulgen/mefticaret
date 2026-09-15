/**
 * Ürün fotoğrafı için yapay zekâ destekli arka plan temizleme.
 * Görsel modeli Lovable AI Gateway üzerinden çağrılır; anahtar yalnızca sunucuda okunur.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-pro-image";

const PROMPT =
  "Bu ürün fotoğrafındaki arka planı tamamen kaldır ve ürünü düz, temiz beyaz bir arka plana yerleştir. " +
  "Ürünün rengini, dokusunu, oranlarını ve gölge detaylarını koru; ürüne hiçbir nesne ekleme, yazı yazma. " +
  "Sonucu yalnızca görsel olarak döndür.";

export type CleanPhotoResult = { dataUrl: string };

function gatewayMessage(status: number, detail: string): string {
  if (status === 401) return "Yapay zekâ servisi yapılandırılmamış.";
  if (status === 402) return "Yapay zekâ kredisi tükendi. Çalışma alanına kredi ekleyin.";
  if (status === 403) return "Yapay zekâ kullanımı kapalı veya limit dolu.";
  if (status === 429) return "Çok fazla istek gönderildi, kısa süre sonra tekrar deneyin.";
  if (status >= 500) return "Yapay zekâ servisi geçici olarak yanıt vermiyor.";
  return `Fotoğraf temizlenemedi (${status}): ${detail.slice(0, 160)}`;
}

/** Data URL biçimindeki fotoğrafın arka planını temizleyip yeni data URL döndürür. */
export async function cleanPhotoBackground(dataUrl: string): Promise<CleanPhotoResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Yapay zekâ servisi yapılandırılmamış.");

  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) {
    throw new Error("Yalnızca PNG, JPG veya WEBP fotoğraf temizlenebilir.");
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
            { type: "text", text: PROMPT },
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
