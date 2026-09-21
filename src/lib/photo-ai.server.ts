/**
 * AI Foto Stüdyosu — ürün fotoğrafı arka plan değiştirme ve sahne üretimi.
 *
 * Tüm görsel işleri OpenAI üzerinden yapılır. Mevcut fotoğrafı koruyarak
 * düzenleme yapabilen görsel modeli (`gpt-image-1`) kullanılır; DALL·E 3
 * yalnızca fotoğraf girdisi olmadan sıfırdan üretimde kullanılabilir.
 * Kredi kontrolü çağrıdan önce, düşüm başarılı yanıttan sonra yapılır.
 */

import { consumeAiCredits, assertAiCredits } from "@/lib/ai-credits.server";

const IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits";
const IMAGES_GENERATE_URL = "https://api.openai.com/v1/images/generations";
/** Fotoğraf girdisini koruyarak düzenleme yapabilen OpenAI görsel modeli. */
const EDIT_MODEL = "gpt-image-1";

export type PhotoStudioMode = "background" | "studio" | "lifestyle" | "model";

export const PHOTO_STUDIO_LABELS: Record<PhotoStudioMode, string> = {
  background: "Arka planı temizle",
  studio: "Stüdyo ışığı",
  lifestyle: "Yaşam alanı sahnesi",
  model: "Sanal moda mankeni",
};

const KEEP_RULES =
  "Ürünün rengini, dokusunu, deseninin yönünü, oranlarını ve tüm detaylarını birebir koru. " +
  "Ürüne yazı, logo, filigran veya yeni nesne ekleme.";

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

export type CleanPhotoResult = { dataUrl: string; creditsUsed: number };

function openAiMessage(status: number, detail: string): string {
  if (status === 401) return "OpenAI anahtarı geçersiz veya tanımlı değil.";
  if (status === 402) return "OpenAI hesabında bakiye kalmadı.";
  if (status === 403) return "OpenAI bu görsel isteğini reddetti.";
  if (status === 429) return "Çok fazla istek gönderildi, kısa süre sonra tekrar deneyin.";
  if (status >= 500) return "OpenAI görsel servisi geçici olarak yanıt vermiyor.";
  return `Fotoğraf işlenemedi (${status}): ${detail.slice(0, 160)}`;
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; filename: string } {
  const match = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Yalnızca PNG, JPG veya WEBP fotoğraf işlenebilir.");
  const mime = match[1]!.toLowerCase();
  const base64 = match[3]!;
  // 8 MB'lık base64 ≈ 6 MB dosya; daha büyüğü reddedilir.
  if (base64.length > 8_000_000)
    throw new Error("Fotoğraf çok büyük. Daha küçük bir fotoğraf seçin.");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { blob: new Blob([bytes], { type: mime }), filename: `product.${ext}` };
}

/** Fotoğrafı seçilen moda göre yeniden üretir; kredi düşümü mağaza cüzdanından yapılır. */
export async function cleanPhotoBackground(
  dataUrl: string,
  mode: PhotoStudioMode = "background",
  charge?: { storeId: string; userId?: string | null },
): Promise<CleanPhotoResult> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OpenAI anahtarı tanımlı değil. Süper admin panelinden ekleyin.");

  const { blob, filename } = dataUrlToBlob(dataUrl);

  let credits = 0;
  if (charge) {
    const gate = await assertAiCredits(charge.storeId, "image");
    credits = gate.credits;
  }

  const form = new FormData();
  form.append("model", EDIT_MODEL);
  form.append("prompt", PROMPTS[mode] ?? PROMPTS.background);
  form.append("size", "1024x1024");
  form.append("image", blob, filename);

  const response = await fetch(IMAGES_EDIT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(openAiMessage(response.status, await response.text()));

  const payload = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
  const first = payload.data?.[0];
  let result: string | null = null;
  if (first?.b64_json) result = `data:image/png;base64,${first.b64_json}`;
  else if (first?.url) {
    const image = await fetch(first.url);
    if (image.ok) {
      const buffer = new Uint8Array(await image.arrayBuffer());
      let binary = "";
      for (const byte of buffer) binary += String.fromCharCode(byte);
      result = `data:image/png;base64,${btoa(binary)}`;
    }
  }
  if (!result) throw new Error("Yapay zekâ fotoğrafı işleyemedi. Lütfen tekrar deneyin.");

  if (charge && credits > 0) {
    await consumeAiCredits({
      storeId: charge.storeId,
      credits,
      purpose: "image",
      task: `photo_${mode}`,
      userId: charge.userId ?? null,
    });
  }

  return { dataUrl: result, creditsUsed: credits };
}

/** Fotoğraf girdisi olmadan sıfırdan görsel üretimi (DALL·E 3). */
export async function generateStudioImage(
  prompt: string,
  charge?: { storeId: string; userId?: string | null },
): Promise<CleanPhotoResult> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OpenAI anahtarı tanımlı değil. Süper admin panelinden ekleyin.");

  const { loadAiEngineSettings } = await import("@/lib/ai-credits.server");
  const engine = await loadAiEngineSettings();

  let credits = 0;
  if (charge) {
    const gate = await assertAiCredits(charge.storeId, "image");
    credits = gate.credits;
  }

  const response = await fetch(IMAGES_GENERATE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: engine.modelImage,
      prompt: prompt.slice(0, 3500),
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!response.ok) throw new Error(openAiMessage(response.status, await response.text()));

  const payload = (await response.json()) as { data?: { b64_json?: string }[] };
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error("Görsel üretilemedi. Lütfen tekrar deneyin.");

  if (charge && credits > 0) {
    await consumeAiCredits({
      storeId: charge.storeId,
      credits,
      purpose: "image",
      task: "studio_image",
      userId: charge.userId ?? null,
    });
  }

  return { dataUrl: `data:image/png;base64,${b64}`, creditsUsed: credits };
}
