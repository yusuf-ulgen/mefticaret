/**
 * Universal XML/Excel Integrator v2.0 — evrensel medya motoru (saf fonksiyonlar).
 * Tedarikçi beslemelerindeki görsel ve video bağlantılarını onarır, biçime göre
 * sınıflandırır, web'e uygun olmayan formatları dönüştürülebilir bağlantıya
 * çevirir ve video gömme (YouTube / Vimeo / Shorts) linklerini normalize eder.
 */

export const PLACEHOLDER_IMAGE = "/placeholder-product.svg";

/** Doğrudan tarayıcıda gösterilebilen görsel uzantıları. */
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"] as const;
/** Tarayıcı desteği sınırlı olan ve dönüştürülmesi gereken formatlar. */
const CONVERT_EXT = ["avif", "heic", "heif", "tif", "tiff"] as const;
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogv"] as const;

/** Görsel dönüştürme geçidi: HEIC/AVIF/TIFF → web uyumlu WEBP. */
const CONVERT_GATEWAY = "https://images.weserv.nl/";

export type MediaKind = "image" | "convertible-image" | "video" | "embed" | "unknown";

export type FeedVideo = {
  url: string;
  source: "file" | "youtube" | "vimeo";
  embedUrl: string;
  thumbnailUrl: string | null;
};

function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  const last = path.split("/").pop() ?? "";
  const dot = last.lastIndexOf(".");
  return dot > -1 ? last.slice(dot + 1).toLowerCase() : "";
}

/**
 * Bozuk/eksik bağlantıları onarır: protokolsüz (`//cdn/x.jpg`), tek eğik çizgili
 * (`http:/cdn`), köke göreli (`/img/x.jpg`) linkler ve Türkçe karakter içeren
 * yollar düzeltilip yüzde kodlamasıyla güvenli hale getirilir.
 */
export function repairMediaUrl(raw: string, baseUrl?: string | null): string | null {
  let value = String(raw ?? "")
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value.length > 2000) return null;
  if (/^data:/i.test(value)) return null;

  if (value.startsWith("//")) value = `https:${value}`;
  else if (/^https?:\/[^/]/i.test(value)) value = value.replace(/^(https?:)\/+/i, "$1//");
  else if (value.startsWith("/")) {
    if (!baseUrl) return null;
    try {
      value = new URL(value, baseUrl).toString();
    } catch {
      return null;
    }
  } else if (!/^https?:\/\//i.test(value)) {
    if (baseUrl) {
      try {
        value = new URL(value, baseUrl).toString();
      } catch {
        return null;
      }
    } else if (/^[\w.-]+\.[a-z]{2,}\//i.test(value)) value = `https://${value}`;
    else return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.pathname = url.pathname
      .split("/")
      .map((segment) => {
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch {
          decoded = segment;
        }
        return encodeURIComponent(decoded);
      })
      .join("/");
    return url.toString();
  } catch {
    return null;
  }
}

export function classifyMediaUrl(url: string): MediaKind {
  if (parseVideoUrl(url)) return extensionOf(url) ? "video" : "embed";
  const ext = extensionOf(url);
  if ((IMAGE_EXT as readonly string[]).includes(ext)) return "image";
  if ((CONVERT_EXT as readonly string[]).includes(ext)) return "convertible-image";
  if (!ext && /\/(image|img|photo|resim|gorsel)/i.test(url)) return "image";
  return "unknown";
}

export function imageNeedsConversion(url: string): boolean {
  return (CONVERT_EXT as readonly string[]).includes(extensionOf(url));
}

/**
 * Web'e uygun olmayan formatları (HEIC/AVIF/TIFF) optimize WEBP çıktısına
 * çevirir; desteklenen formatlar olduğu gibi döner.
 */
export function webSafeImageUrl(url: string, width = 1600): string {
  if (!imageNeedsConversion(url)) return url;
  const target = url.replace(/^https?:\/\//i, "");
  return `${CONVERT_GATEWAY}?url=${encodeURIComponent(target)}&output=webp&w=${width}&q=82&we`;
}

/** Video dosyası veya gömme bağlantısını normalize eder. */
export function parseVideoUrl(raw: string): FeedVideo | null {
  const url = raw.trim();
  if (!url) return null;
  const ext = extensionOf(url);
  if ((VIDEO_EXT as readonly string[]).includes(ext)) {
    return { url, source: "file", embedUrl: url, thumbnailUrl: null };
  }

  const youtube =
    url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([\w-]{6,20})/i) ??
    url.match(/youtu\.be\/([\w-]{6,20})/i);
  if (youtube?.[1]) {
    const id = youtube[1];
    return {
      url,
      source: "youtube",
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (vimeo?.[1]) {
    return {
      url,
      source: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`,
      thumbnailUrl: null,
    };
  }
  return null;
}

export type SplitMedia = {
  images: string[];
  videos: FeedVideo[];
  converted: number;
  invalid: string[];
};

/** Ham medya listesini görsel / video / geçersiz olarak ayırır ve onarır. */
export function splitFeedMedia(values: Array<string | null | undefined>, baseUrl?: string | null): SplitMedia {
  const images: string[] = [];
  const videos: FeedVideo[] = [];
  const invalid: string[] = [];
  let converted = 0;

  for (const value of values) {
    const raw = String(value ?? "").trim();
    if (!raw) continue;
    const repaired = repairMediaUrl(raw, baseUrl);
    if (!repaired) {
      invalid.push(raw.slice(0, 160));
      continue;
    }
    const video = parseVideoUrl(repaired);
    if (video) {
      if (!videos.some((item) => item.embedUrl === video.embedUrl)) videos.push(video);
      continue;
    }
    const kind = classifyMediaUrl(repaired);
    if (kind === "image" || kind === "convertible-image") {
      if (kind === "convertible-image") converted += 1;
      const safe = webSafeImageUrl(repaired);
      if (!images.includes(safe)) images.push(safe);
      continue;
    }
    invalid.push(raw.slice(0, 160));
  }

  return { images: images.slice(0, 20), videos: videos.slice(0, 6), converted, invalid: invalid.slice(0, 10) };
}

/** Virgül / boşluk / dikey çizgi ile ayrılmış medya alanını listeye çevirir. */
export function splitMediaField(value: string | null | undefined): string[] {
  const text = String(value ?? "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) =>
            typeof item === "string"
              ? item
              : typeof item === "object" && item
                ? String(
                    (item as Record<string, unknown>)["url"] ??
                      (item as Record<string, unknown>)["src"] ??
                      (item as Record<string, unknown>)["#text"] ??
                      "",
                  )
                : "",
          )
          .filter(Boolean);
      }
    } catch {
      /* düz metin olarak devam */
    }
  }
  return text
    .split(/[,|;\n\r\t]+|\s(?=https?:\/\/)/)
    .map((item) => item.trim())
    .filter(Boolean);
}
