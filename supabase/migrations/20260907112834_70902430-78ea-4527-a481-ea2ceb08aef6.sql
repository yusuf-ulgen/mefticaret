INSERT INTO public.store_currencies (store_id, currency, is_active, is_base, rounding)
SELECT s.id, v.code, true, false, 'psych_99'::public.rounding_mode
FROM public.stores s
CROSS JOIN (VALUES ('EUR'), ('USD')) AS v(code)
WHERE s.slug = 'utebaylar-market'
ON CONFLICT (store_id, currency) DO NOTHING;