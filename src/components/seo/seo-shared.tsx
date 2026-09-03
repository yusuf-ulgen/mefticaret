import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export type SeoTemplateKey = "product" | "collection" | "page" | "blog";

export const seoTemplateLabels: Record<SeoTemplateKey, string> = {
  product: "Ürün",
  collection: "Koleksiyon",
  page: "Sayfa",
  blog: "Blog",
};

export const seoTemplateDefaults: Record<SeoTemplateKey, { title: string; description: string }> = {
  product: {
    title: "{{product_name}} | {{store_name}}",
    description:
      "{{product_name}} ürününü {{store_name}} mağazasında keşfedin. Hızlı kargo ve güvenli ödeme.",
  },
  collection: {
    title: "{{collection_name}} | {{store_name}}",
    description: "{{store_name}} içindeki {{collection_name}} koleksiyonunu keşfedin.",
  },
  page: {
    title: "{{page_title}} | {{store_name}}",
    description: "{{page_excerpt}}",
  },
  blog: {
    title: "{{page_title}} | {{store_name}} Blog",
    description: "{{page_excerpt}}",
  },
};

export const seoTemplateVariables: Record<SeoTemplateKey, string[]> = {
  product: ["product_name", "product_type", "brand_name", "store_name", "price"],
  collection: ["collection_name", "store_name", "product_count"],
  page: ["page_title", "page_excerpt", "store_name"],
  blog: ["page_title", "page_excerpt", "author_name", "store_name"],
};

export function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {children}
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
