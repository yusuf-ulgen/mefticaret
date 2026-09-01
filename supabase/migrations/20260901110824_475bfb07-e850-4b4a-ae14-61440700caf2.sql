ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS length_cm numeric(8,2),
  ADD COLUMN IF NOT EXISTS width_cm numeric(8,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(8,2);

CREATE INDEX IF NOT EXISTS products_store_sku_idx ON public.products (store_id, sku);
CREATE INDEX IF NOT EXISTS products_store_barcode_idx ON public.products (store_id, barcode);