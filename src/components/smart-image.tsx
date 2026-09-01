import type { CSSProperties } from "react";

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
  if (!src) return null;
  const optimized = optimizedImageUrl(src, { width, height }) ?? src;
  const srcSet = imageSrcSet(src, widths, height ? { height } : {});

  return (
    <img
      src={optimized}
      {...(srcSet ? { srcSet, sizes } : {})}
      alt={alt}
      width={width}
      {...(height ? { height } : {})}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      style={style}
    />
  );
}
