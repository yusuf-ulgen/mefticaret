import { supabase } from "@/integrations/supabase/client";

/**
 * Tema görselleri: tarayıcıdan mağaza klasörüne yüklenir (store-media kovası,
 * RLS ile mağaza klasörüne kısıtlı) ve uzun ömürlü imzalı adres döner.
 * Kova özel olduğu için tema ayarlarında imzalı adres saklanır.
 */

const BUCKET = "store-media";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadThemeAsset(storeId: string, file: File) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Yalnızca JPG, PNG, WEBP, AVIF, GIF veya SVG yükleyebilirsin.");
  }
  if (file.size > MAX_BYTES) throw new Error("Dosya boyutu en fazla 8 MB olabilir.");

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${storeId}/theme/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signError) throw new Error(signError.message);
  if (!data?.signedUrl) throw new Error("Görsel adresi oluşturulamadı.");
  return data.signedUrl;
}
