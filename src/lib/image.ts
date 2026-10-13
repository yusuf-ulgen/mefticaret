/**
 * Görsel optimizasyonu yardımcıları.
 *
 * Depodaki (Supabase Storage) görseller `render/image` dönüşüm ucuna
 * yönlendirilir; böylece sunucu tarafında yeniden boyutlandırma yapılır ve
 * tarayıcı destekliyorsa WebP döner. Harici adresler olduğu gibi bırakılır.
 */

const OBJECT_SIGN = "/storage/v1/object/sign/";
const OBJECT_PUBLIC = "/storage/v1/object/public/";
const RENDER_SIGN = "/storage/v1/render/image/sign/";
const RENDER_PUBLIC = "/storage/v1/render/image/public/";

/** Bu adres depo dönüşümünü destekliyor mu? */
export function isTransformable(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith(OBJECT_PUBLIC) || parsed.pathname.startsWith(RENDER_PUBLIC);
  } catch {
    return false;
  }
}

export type ImageTransform = {
  width?: number;
  height?: number;
  /** 20-100 arası; varsayılan 72 kalite/boyut dengesi için iyidir. */
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

/** Görsel adresine boyut/kalite parametreleri ekler (WebP pazarlığı otomatiktir). */
export function optimizedImageUrl(url: string | null | undefined, options: ImageTransform = {}) {
  if (!url) return null;
  if (!isTransformable(url)) return url;

  const rendered = url.replace(OBJECT_SIGN, RENDER_SIGN).replace(OBJECT_PUBLIC, RENDER_PUBLIC);
  const [base, query = ""] = rendered.split("?");
  const params = new URLSearchParams(query);
  if (options.width) params.set("width", String(Math.round(options.width)));
  if (options.height) params.set("height", String(Math.round(options.height)));
  params.set("quality", String(options.quality ?? 72));
  params.set("resize", options.resize ?? "cover");
  return `${base}?${params.toString()}`;
}

export const DEFAULT_IMAGE_WIDTHS = [240, 480, 720, 1080, 1440];

/** Responsive `srcset` değeri üretir; dönüşüm desteklenmiyorsa null döner. */
export function imageSrcSet(
  url: string | null | undefined,
  widths: number[] = DEFAULT_IMAGE_WIDTHS,
  options: Omit<ImageTransform, "width"> & { baseWidth?: number } = {},
) {
  if (!isTransformable(url)) return null;
  return widths
    .filter((width) => Number.isFinite(width) && width > 0 && width <= 2500)
    .map(
      (width) =>
        `${optimizedImageUrl(url, { ...options, width, ...(options.height && options.baseWidth ? { height: Math.round((options.height * width) / options.baseWidth) } : {}) })} ${width}w`,
    )
    .join(", ");
}
