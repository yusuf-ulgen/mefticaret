ALTER TABLE public.einvoice_settings
  ADD COLUMN IF NOT EXISTS download_operation text NOT NULL DEFAULT 'gidenBelgeleriIndirExt',
  ADD COLUMN IF NOT EXISTS inbox_list_operation text NOT NULL DEFAULT 'gelenBelgeleriListeleExt',
  ADD COLUMN IF NOT EXISTS inbox_download_operation text NOT NULL DEFAULT 'gelenBelgeleriIndirExt',
  ADD COLUMN IF NOT EXISTS earsiv_service_url text,
  ADD COLUMN IF NOT EXISTS earsiv_namespace text NOT NULL DEFAULT 'http://service.earsiv.uut.cs.com.tr/',
  ADD COLUMN IF NOT EXISTS earsiv_operation text NOT NULL DEFAULT 'faturaOlusturExt',
  ADD COLUMN IF NOT EXISTS earsiv_branch text NOT NULL DEFAULT 'DFLT',
  ADD COLUMN IF NOT EXISTS earsiv_cashbox text NOT NULL DEFAULT 'DFLT',
  ADD COLUMN IF NOT EXISTS erp_code text,
  ADD COLUMN IF NOT EXISTS last_inbox_sequence text NOT NULL DEFAULT '0';

ALTER TABLE public.einvoice_documents
  ADD COLUMN IF NOT EXISTS earsiv_url text,
  ADD COLUMN IF NOT EXISTS earsiv_invoice_number text,
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'efatura';

CREATE TABLE IF NOT EXISTS public.einvoice_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL DEFAULT 'test',
  ettn text NOT NULL,
  document_number text,
  document_type text,
  document_date text,
  sender_tax_id text,
  sender_title text,
  sender_alias text,
  receiver_alias text,
  payable_amount numeric,
  currency text,
  sequence_no text,
  envelope_id text,
  arrived_at text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, ettn)
);

GRANT SELECT ON public.einvoice_inbox TO authenticated;
GRANT ALL ON public.einvoice_inbox TO service_role;

ALTER TABLE public.einvoice_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform yoneticileri gelen faturalari okur" ON public.einvoice_inbox;
CREATE POLICY "Platform yoneticileri gelen faturalari okur"
ON public.einvoice_inbox
FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

DROP TRIGGER IF EXISTS set_einvoice_inbox_updated_at ON public.einvoice_inbox;
CREATE TRIGGER set_einvoice_inbox_updated_at
BEFORE UPDATE ON public.einvoice_inbox
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();