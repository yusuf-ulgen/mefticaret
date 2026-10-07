-- e-Arşiv ayrı giriş adresi ve gönderici GB etiketi
ALTER TABLE public.einvoice_settings
  ADD COLUMN IF NOT EXISTS earsiv_login_url text,
  ADD COLUMN IF NOT EXISTS sender_alias text,
  ADD COLUMN IF NOT EXISTS sender_tax_office text,
  ADD COLUMN IF NOT EXISTS sender_district text,
  ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false;

-- Faturanın gelir kaynağı ve alıcı bilgisi anlık görüntüsü
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS buyer_tax_id text,
  ADD COLUMN IF NOT EXISTS buyer_title text,
  ADD COLUMN IF NOT EXISTS buyer_tax_office text,
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS buyer_district text,
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS buyer_email text;

CREATE OR REPLACE FUNCTION public.invoices_validate_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_type NOT IN ('subscription','ai_credit','commission','app','theme') THEN
    RAISE EXCEPTION 'invalid invoice source_type %', NEW.source_type;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoices_validate_source ON public.invoices;
CREATE TRIGGER invoices_validate_source BEFORE INSERT OR UPDATE OF source_type ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_validate_source();

CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_unique
  ON public.invoices (source_type, source_id) WHERE source_id IS NOT NULL;

-- Belge denemeleri ve fatura başına tek etkin belge kilidi
ALTER TABLE public.einvoice_documents
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_checks integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS einvoice_documents_one_active_per_invoice
  ON public.einvoice_documents (invoice_id)
  WHERE invoice_id IS NOT NULL AND direction = 'outgoing' AND status IN ('queued','sent');

-- GİB biçimli ardışık belge numarası (3 harf + yıl + 9 hane)
CREATE TABLE IF NOT EXISTS public.einvoice_number_counters (
  prefix text NOT NULL,
  year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);
GRANT ALL ON public.einvoice_number_counters TO service_role;
ALTER TABLE public.einvoice_number_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_einvoice_number(_prefix text, _year integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v bigint;
BEGIN
  IF _prefix !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'prefix must be 3 uppercase letters'; END IF;
  INSERT INTO public.einvoice_number_counters(prefix, year, last_value) VALUES (_prefix, _year, 1)
  ON CONFLICT (prefix, year) DO UPDATE SET last_value = public.einvoice_number_counters.last_value + 1
  RETURNING last_value INTO _v;
  RETURN _prefix || _year::text || lpad(_v::text, 9, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_einvoice_number(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_einvoice_number(text, integer) TO service_role;

-- Fatura ödendiğinde e-belge işi kuyruğa girer (otomatik gönderim açıksa)
CREATE OR REPLACE FUNCTION public.invoices_enqueue_einvoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
     AND EXISTS (SELECT 1 FROM public.einvoice_settings WHERE is_enabled AND auto_send) THEN
    INSERT INTO public.job_queue (store_id, kind, payload, priority, max_attempts, dedupe_key)
    VALUES (NEW.store_id, 'invoice', jsonb_build_object('type','platform_einvoice','invoiceId',NEW.id), 3, 3,
            'einvoice:' || NEW.id::text)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoices_enqueue_einvoice ON public.invoices;
CREATE TRIGGER invoices_enqueue_einvoice AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_enqueue_einvoice();