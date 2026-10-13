import { plainText, readSeo } from "@/lib/seo";

/** Aynı kaynak kayıt hem vitrinde hem denetimde aynı galeriye dahildir. */
export function hasProductImage(image: { url?: string | null; storage_path?: string | null }) {
  return Boolean(image.url?.trim() || image.storage_path?.trim());
}

export function productSeoData(product: {
  title: string;
  description: string | null;
  seo: unknown;
}) {
  const seo = readSeo(product.seo);
  return {
    seo,
    title: seo.title || product.title,
    description: seo.description || plainText(product.description),
    customTitle: seo.title ?? "",
    customDescription: seo.description ?? "",
    ogImage: seo.ogImage ?? "",
  };
}
