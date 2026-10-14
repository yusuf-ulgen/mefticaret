import { useState, type CSSProperties } from "react";

import { DEFAULT_IMAGE_WIDTHS, imageSrcSet, optimizedImageUrl } from "@/lib/image";
import { imageFallbackState } from "@/lib/product-image-sources";

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
  sources?: Array<{ width: number; url: string }>;
  fallbackSrcs?: string[];
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
  sources,
  fallbackSrcs = [],
  className,
  style,
}: SmartImageProps) {
  const [failure, setFailure] = useState<{ key: string; index: number; original: boolean } | null>(
    null,
  );
  const state = imageFallbackState(src, fallbackSrcs, failure);
  const current = state.source;
  const signed =
    (state.index === 0 ? sources : undefined)
      ?.slice()
      .sort((a, b) => a.width - b.width)
      .find((source) => source.width >= width) ?? (state.index === 0 ? sources?.at(-1) : undefined);
  const optimized =
    signed?.url ?? optimizedImageUrl(current, height ? { width, height } : { width }) ?? current;
  const displayed = !current
    ? "/placeholder-product.svg"
    : state.original
      ? current
      : (optimized ?? current);
  const srcSet =
    !state.original && current
      ? state.index === 0 && sources?.length
        ? sources.map((source) => `${source.url} ${source.width}w`).join(", ")
        : imageSrcSet(current, widths, height ? { height, baseWidth: width } : {})
      : null;

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
        if (!current) return;
        // Try the original, then other images of this product, then the local placeholder.
        setFailure(
          !state.original && optimized !== current
            ? { key: state.key, index: state.index, original: true }
            : { key: state.key, index: state.index + 1, original: false },
        );
      }}
    />
  );
}
