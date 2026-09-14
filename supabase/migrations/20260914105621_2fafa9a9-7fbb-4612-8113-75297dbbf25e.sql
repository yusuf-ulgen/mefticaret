CREATE TABLE public.einvoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test','live')),
  auth_mode text NOT NULL DEFAULT 'wsse' CHECK (auth_mode IN ('wsse','cookie')),
  login_url text,
  service_url text,
  login_operation text NOT NULL DEFAULT 'wsLogin',
  send_operation text NOT NULL DEFAULT 'sendInvoice',
  status_operation text NOT NULL DEFAULT 'getInvoiceStatus',
  service_namespace text NOT NULL DEFAULT 'http://service.connector.uut.cs.com.tr/',
  login_namespace text NOT NULL DEFAULT 'http://service.csap.cs.com.tr/',
  sender_tax_id text,
  sender_title text,
  sender_address text,
  sender_city text,
  sender_country text NOT NULL DEFAULT 'Türkiye',
  invoice_prefix text NOT NULL DEFAULT 'MEF',
  is_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.einvoice_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  store_id uuid,
  environment text NOT NULL DEFAULT 'test',
  direction text NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('outgoing','incoming')),
  document_number text,
  ettn uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','cancelled')),
  operation text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX einvoice_documents_invoice_idx ON public.einvoice_documents (invoice_id);
CREATE INDEX einvoice_documents_created_idx ON public.einvoice_documents (created_at DESC);

GRANT SELECT ON public.einvoice_settings TO authenticated;
GRANT ALL ON public.einvoice_settings TO service_role;
GRANT SELECT ON public.einvoice_documents TO authenticated;
GRANT ALL ON public.einvoice_documents TO service_role;

ALTER TABLE public.einvoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einvoice_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "einvoice_settings_admin_read" ON public.einvoice_settings
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "einvoice_documents_admin_read" ON public.einvoice_documents
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE TRIGGER einvoice_settings_updated_at BEFORE UPDATE ON public.einvoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER einvoice_documents_updated_at BEFORE UPDATE ON public.einvoice_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.einvoice_settings (environment) VALUES ('test');