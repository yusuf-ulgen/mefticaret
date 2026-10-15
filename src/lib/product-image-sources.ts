import { feedImageUrls } from "@/lib/feed-image-urls";

/** Recover only image fields belonging to this product, never another catalog row. */
export function productImageSources(images: unknown, raw?: Record<string, unknown> | null) {
  const candidates: string[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(add);
    if (typeof value !== "string") return;
    const url = value
      .trim()
      .replace(/&amp;/gi, "&")
      .replace(/&#0*38;|&#x0*26;/gi, "&");
    if (/^\/(?!\/)/.test(url)) candidates.push(url);
    else candidates.push(...feedImageUrls(url));
  };
  add(images);
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (
      /(?:^|[.[_])(?:images?|resim(?:ler)?|gorsel(?:ler)?|görsel(?:ler)?|picture)(?:url|ler|[0-9]*)?(?:$|[.[_])/i.test(
        key,
      )
    )
      add(value);
  }
  return [...new Set(candidates)].slice(0, 100);
}

export function imageFallbackState(
  src: string | null | undefined,
  alternatives: string[],
  failed: { key: string; index: number; original: boolean } | null,
) {
  const candidates = [...new Set([src, ...alternatives].filter((url): url is string => !!url))];
  const key = JSON.stringify(candidates);
  const current = failed?.key === key ? failed : { key, index: 0, original: false };
  return { ...current, source: candidates[current.index] ?? null };
}
