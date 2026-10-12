ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS city TEXT;

DROP POLICY IF EXISTS "promo_public_read" ON public.kolay_promo_settings;
REVOKE SELECT ON public.kolay_promo_settings FROM anon;
ALTER TABLE public.kolay_promo_settings
  ADD COLUMN IF NOT EXISTS production_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_message TEXT,
  ADD COLUMN IF NOT EXISTS gift_wrap_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_wrap_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gift_wrap BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gift_message TEXT;

CREATE TABLE public.kolay_order_notes (
  order_id UUID NOT NULL PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kolay_order_notes TO authenticated;
GRANT ALL ON public.kolay_order_notes TO service_role;
ALTER TABLE public.kolay_order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_notes_manage" ON public.kolay_order_notes FOR ALL TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(store_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id = kolay_order_notes.store_id));

CREATE TABLE public.kolay_order_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  to_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  share_note TEXT NOT NULL,
  share_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_store_id <> to_store_id)
);
CREATE INDEX kolay_order_splits_to_idx ON public.kolay_order_splits (to_store_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.kolay_order_splits TO authenticated;
GRANT ALL ON public.kolay_order_splits TO service_role;
ALTER TABLE public.kolay_order_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "splits_read" ON public.kolay_order_splits FOR SELECT TO authenticated
  USING (app_private.can_manage_store(from_store_id, auth.uid()) OR app_private.can_manage_store(to_store_id, auth.uid()));
CREATE POLICY "splits_create" ON public.kolay_order_splits FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(from_store_id, auth.uid()) AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.store_id = from_store_id));
CREATE POLICY "splits_update" ON public.kolay_order_splits FOR UPDATE TO authenticated
  USING (app_private.can_manage_store(from_store_id, auth.uid()) OR app_private.can_manage_store(to_store_id, auth.uid()))
  WITH CHECK (app_private.can_manage_store(from_store_id, auth.uid()) OR app_private.can_manage_store(to_store_id, auth.uid()));

CREATE TABLE public.kolay_mentorships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  mentee_store_id UUID NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (mentor_store_id <> mentee_store_id)
);
GRANT SELECT, INSERT ON public.kolay_mentorships TO authenticated;
GRANT ALL ON public.kolay_mentorships TO service_role;
ALTER TABLE public.kolay_mentorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentorships_read" ON public.kolay_mentorships FOR SELECT TO authenticated
  USING (app_private.can_manage_store(mentor_store_id, auth.uid()) OR app_private.can_manage_store(mentee_store_id, auth.uid()));
-- Yeni satıcı kendi mağazası için mentor seçer (henüz ödenmiş siparişi yoksa)
CREATE POLICY "mentorships_create" ON public.kolay_mentorships FOR INSERT TO authenticated
  WITH CHECK (app_private.can_manage_store(mentee_store_id, auth.uid()) AND rewarded_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.store_id = mentee_store_id AND o.payment_status = 'paid'));

CREATE TABLE public.kolay_mentor_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kolay_mentor_points_store_idx ON public.kolay_mentor_points (store_id);
GRANT SELECT ON public.kolay_mentor_points TO authenticated;
GRANT ALL ON public.kolay_mentor_points TO service_role;
ALTER TABLE public.kolay_mentor_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mentor_points_read" ON public.kolay_mentor_points FOR SELECT TO authenticated
  USING (app_private.can_manage_store(store_id, auth.uid()));

ALTER TABLE public.kolay_packaging_orders ADD COLUMN IF NOT EXISTS points_used INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION app_private.reward_mentor_on_first_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m RECORD;
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    SELECT * INTO m FROM public.kolay_mentorships WHERE mentee_store_id = NEW.store_id AND rewarded_at IS NULL FOR UPDATE;
    IF FOUND THEN
      UPDATE public.kolay_mentorships SET rewarded_at = now() WHERE id = m.id;
      INSERT INTO public.kolay_mentor_points (store_id, delta, reason, reference_id)
      VALUES (m.mentor_store_id, 100, 'mentee_first_sale', m.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_reward_mentor AFTER INSERT OR UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION app_private.reward_mentor_on_first_sale();

-- Ambalaj siparişinde puan kullanımı (1 puan = 1 TL, en fazla tutarın yarısı)
CREATE OR REPLACE FUNCTION public.kolay_order_packaging(_store_id UUID, _item_id UUID, _quantity INT, _note TEXT, _use_points BOOLEAN)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it RECORD; bal INT; total NUMERIC; used INT := 0;
BEGIN
  IF NOT app_private.can_manage_store(_store_id, auth.uid()) THEN RAISE EXCEPTION 'Yetkiniz yok'; END IF;
  IF _quantity < 1 OR _quantity > 50 THEN RAISE EXCEPTION 'Adet 1-50 arası olmalı'; END IF;
  SELECT id, sale_price, currency, is_active INTO it FROM public.kolay_packaging_items WHERE id = _item_id;
  IF NOT FOUND OR NOT it.is_active THEN RAISE EXCEPTION 'Bu ambalaj ürünü şu anda satışta değil'; END IF;
  total := round(it.sale_price * _quantity, 2);
  IF _use_points THEN
    PERFORM pg_advisory_xact_lock(hashtext('mentor_points:' || _store_id::text));
    SELECT COALESCE(sum(delta),0) INTO bal FROM public.kolay_mentor_points WHERE store_id = _store_id;
    used := LEAST(bal, floor(total / 2)::INT);
    IF used > 0 THEN
      INSERT INTO public.kolay_mentor_points (store_id, delta, reason) VALUES (_store_id, -used, 'packaging_discount');
    END IF;
  END IF;
  INSERT INTO public.kolay_packaging_orders (store_id, item_id, quantity, unit_price, total, currency, delivery_note, requested_by, points_used)
  VALUES (_store_id, it.id, _quantity, it.sale_price, total - used, it.currency, _note, auth.uid(), used);
  RETURN json_build_object('ok', true, 'pointsUsed', used, 'total', total - used);
END $$;
REVOKE ALL ON FUNCTION public.kolay_order_packaging(UUID, UUID, INT, TEXT, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.kolay_order_packaging(UUID, UUID, INT, TEXT, BOOLEAN) TO authenticated;