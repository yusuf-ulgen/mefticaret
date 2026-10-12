-- Seçim ödeme hakkı vermez; aktif plan yalnız mevcut ödeme/onay yolunda değişir.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS requested_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS requested_billing_interval text NOT NULL DEFAULT 'monthly' CHECK(requested_billing_interval IN ('monthly','yearly'));
