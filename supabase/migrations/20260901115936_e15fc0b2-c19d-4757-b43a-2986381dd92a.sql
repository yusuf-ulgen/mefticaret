ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_payment' AFTER 'pending';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'paid' AFTER 'awaiting_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'packed' AFTER 'processing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'returned' AFTER 'cancelled';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoiced_at timestamp with time zone;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tax_total numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS orders_store_invoice_number_key
  ON public.orders (store_id, invoice_number)
  WHERE invoice_number IS NOT NULL;