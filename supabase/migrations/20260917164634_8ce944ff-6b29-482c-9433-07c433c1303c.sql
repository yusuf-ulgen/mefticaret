ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS store_kind text NOT NULL DEFAULT 'corporate';

ALTER TABLE public.stores
DROP CONSTRAINT IF EXISTS stores_store_kind_check;

ALTER TABLE public.stores
ADD CONSTRAINT stores_store_kind_check
CHECK (store_kind IN ('corporate', 'micro'));

UPDATE public.stores s
SET store_kind = 'micro',
    plan_id = NULL,
    updated_at = now()
FROM public.home_maker_profiles h
WHERE h.store_id = s.id
  AND h.panel_mode = 'micro';

DELETE FROM public.subscriptions sub
USING public.stores s
WHERE sub.store_id = s.id
  AND s.store_kind = 'micro';

CREATE INDEX IF NOT EXISTS idx_stores_store_kind ON public.stores(store_kind);

CREATE OR REPLACE FUNCTION public.prevent_store_kind_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.store_kind IS DISTINCT FROM OLD.store_kind
     AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Mağaza türü yalnızca güvenli sunucu işlemiyle değiştirilebilir';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_prevent_store_kind_change ON public.stores;
CREATE TRIGGER stores_prevent_store_kind_change
BEFORE UPDATE OF store_kind ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.prevent_store_kind_change();

REVOKE ALL ON FUNCTION public.prevent_store_kind_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_store_kind_change() TO service_role;