UPDATE public.store_domains
SET hostname = replace(hostname, '.mefshop.com', '.mefticaret.com'),
    updated_at = now()
WHERE type = 'subdomain' AND hostname LIKE '%.mefshop.com';