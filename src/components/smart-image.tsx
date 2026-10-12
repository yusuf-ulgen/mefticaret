import { useState, type CSSProperties } from "react";

import { DEFAULT_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from "@/lib/image";

type SmartImageProps = {
  src: string | null | undefined;
  alt: string;
  /** Kart/ürün görselinin yaklaşık render genişliği (px). */
  width?: number;
  height?: number;
  /** Ekran üstündeki görseller için `eager` verilerek LCP iyileştirilir. */
  priority?: boolean;
  sizes?: string;
  widths?: number[];
  className?: string;
  style?: CSSProperties;
};

/**
 * Tembel yüklenen, responsive ve WebP'ye çevrilmiş görsel bileşeni.
 * Depodaki görseller sunucu tarafında yeniden boyutlandırılır.
 */
export function SmartImage({
  src,
  alt,
  width = 720,
  height,
  priority = false,
  sizes = "(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px",
  widths = DEFAULT_IMAGE_WIDTHS,
  className,
  style,
}: SmartImageProps) {
  const [failure, setFailure] = useState<{ source: typeof src; stage: number } | null>(null);
  const stage = failure && failure.source === src ? failure.stage : 0;
  const optimized = optimizedImageUrl(src, height ? { width, height } : { width }) ?? src;
  const displayed =
    !src || stage >= 2 ? "/placeholder-product.svg" : stage === 1 ? src : (optimized ?? src);
  const srcSet = stage === 0 ? imageSrcSet(src, widths, height ? { height } : {}) : null;

  return (
    <img
      src={displayed}
      {...(srcSet ? { srcSet, sizes } : {})}
      alt={alt}
      width={width}
      {...(height ? { height } : {})}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={style}
      onError={() => {
        if (!src || stage >= 2) return;
        // Dönüşüm servisi başarısızsa önce orijinal URL'yi, sonra yerel yedeği dene.
        setFailure({ source: src, stage: stage === 0 && optimized !== src ? 1 : 2 });
      }}
    />
  );
}
