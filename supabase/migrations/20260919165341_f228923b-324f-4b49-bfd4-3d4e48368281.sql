ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'browse_abandoned';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'customer_inactive';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'ltv_threshold';
ALTER TYPE public.automation_trigger ADD VALUE IF NOT EXISTS 'newsletter_subscribed';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'ltv_above';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'order_count_above';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'spent_above';
ALTER TYPE public.automation_condition ADD VALUE IF NOT EXISTS 'category_interest';