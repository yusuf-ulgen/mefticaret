ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_options jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_id uuid REFERENCES public.product_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric;

CREATE INDEX IF NOT EXISTS product_variants_image_id_idx ON public.product_variants(image_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_store_sku_idx
  ON public.product_variants(store_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_variants_store_barcode_idx
  ON public.product_variants(store_id, barcode) WHERE barcode IS NOT NULL;