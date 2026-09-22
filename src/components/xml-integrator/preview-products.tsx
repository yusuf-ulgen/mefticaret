/**
 * İlk 10 ürün önizlemesi — varyasyonlu ürünler açılır ağaç olarak gösterilir.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PreviewVariant = {
  sku: string | null;
  barcode: string | null;
  title: string;
  price: number;
  stock: number;
  options: Record<string, string>;
};

export type PreviewProduct = {
  sku: string | null;
  barcode: string | null;
  title: string;
  price: number;
  stock: number;
  currency: string;
  images: string[];
  options: Record<string, string>;
  variants: PreviewVariant[];
};

export type PreviewResult = {
  totalRows: number;
  format: string;
  errorCount: number;
  errors: Array<{ row: number; reason: string }>;
  products: PreviewProduct[];
};

export type PreviewConversion = { from: string; to: string; multiplier: number };

/** "10,00 USD → 342,50 TRY" biçiminde çevirim etiketi. */
function conversionLabel(price: number, conversion: PreviewConversion | null, currency: string) {
  const fmt = (value: number) =>
    value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!conversion || conversion.multiplier <= 0) return `${fmt(price)} ${currency}`;
  const source = price / conversion.multiplier;
  return `${fmt(source)} ${conversion.from} → ${fmt(price)} ${conversion.to}`;
}

export function PreviewProductsDialog({
  open,
  onOpenChange,
  result,
  conversion = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: PreviewResult | null;
  conversion?: PreviewConversion | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>İlk 10 ürün önizlemesi</DialogTitle>
          <DialogDescription>
            {result
              ? `${result.totalRows} satır okundu · ${result.format.toUpperCase()} · ${result.errorCount} hatalı satır`
              : "Kaynak okunuyor…"}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-2">
            {result.products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu eşleme ile ürün üretilemedi.</p>
            ) : (
              result.products.map((product, index) => (
                <ProductNode
                  key={`${product.sku ?? product.barcode ?? index}`}
                  product={product}
                  conversion={conversion}
                />
              ))
            )}
            {result.errors.length ? (
              <div className="rounded-lg border border-destructive/40 p-2 text-xs">
                <p className="font-medium text-destructive">Hatalı satırlar</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {result.errors.map((error) => (
                    <li key={`${error.row}-${error.reason}`}>
                      {error.row}. satır: {error.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductNode({ product }: { product: PreviewProduct }) {
  const [open, setOpen] = useState(false);
  const hasVariants = product.variants.length > 0;
  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        disabled={!hasVariants}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 p-2 text-left text-xs disabled:cursor-default"
      >
        {hasVariants ? (
          open ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{product.title || "(başlık yok)"}</span>
          <span className="block truncate text-muted-foreground">
            {product.sku || product.barcode || "kod yok"} ·{" "}
            {conversionLabel(product.price, conversion, product.currency)} · stok {product.stock}
          </span>
        </span>
        {hasVariants ? (
          <Badge variant="outline">{product.variants.length} varyant</Badge>
        ) : (
          <Badge variant="outline">Tekil</Badge>
        )}
      </button>

      {open && hasVariants ? (
        <ul className="space-y-1 border-t p-2">
          {product.variants.map((variant, index) => (
            <li
              key={`${variant.sku ?? variant.barcode ?? index}`}
              className="rounded-md border bg-muted/40 px-2 py-1.5 text-[11px]"
            >
              <p className="truncate font-medium">{variant.sku || variant.barcode || `Varyant ${index + 1}`}</p>
              <p className="text-muted-foreground">
                {Object.entries(variant.options)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" · ") || "seçenek yok"}
              </p>
              <p className="text-muted-foreground">
                {conversionLabel(variant.price, conversion, product.currency)} · stok {variant.stock}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
