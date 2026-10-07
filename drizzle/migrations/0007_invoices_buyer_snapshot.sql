CREATE OR REPLACE FUNCTION public.invoices_fill_buyer_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NEW.buyer_tax_id IS NULL AND NEW.store_id IS NOT NULL THEN
    SELECT ss.legal_name, ss.tax_number, ss.address, ss.city, ss.contact_email
      INTO s FROM public.store_settings ss WHERE ss.store_id = NEW.store_id;
    IF FOUND AND s.tax_number ~ '^\d{10,11}$' THEN
      NEW.buyer_tax_id := s.tax_number;
      NEW.buyer_title := COALESCE(NEW.buyer_title, s.legal_name);
      NEW.buyer_address := COALESCE(NEW.buyer_address,
        NULLIF(concat_ws(' ', s.address->>'line1', s.address->>'line2', s.address->>'address'), ''));
      NEW.buyer_district := COALESCE(NEW.buyer_district, s.address->>'district');
      NEW.buyer_city := COALESCE(NEW.buyer_city, s.city, s.address->>'city');
      NEW.buyer_tax_office := COALESCE(NEW.buyer_tax_office, s.address->>'tax_office');
      NEW.buyer_email := COALESCE(NEW.buyer_email, s.contact_email);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoices_fill_buyer_snapshot ON public.invoices;
CREATE TRIGGER invoices_fill_buyer_snapshot BEFORE INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_fill_buyer_snapshot();