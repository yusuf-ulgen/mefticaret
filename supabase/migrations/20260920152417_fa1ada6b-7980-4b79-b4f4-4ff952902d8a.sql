ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'stock_low';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'customer_tagged';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'cart_subtotal_above';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'shipping_country_is';
ALTER TYPE public.automation_step_kind ADD VALUE IF NOT EXISTS 'vip_badge';
ALTER TYPE public.automation_step_kind ADD VALUE IF NOT EXISTS 'supplier_reorder';
ALTER TYPE public.automation_step_kind ADD VALUE IF NOT EXISTS 'pause_ads';