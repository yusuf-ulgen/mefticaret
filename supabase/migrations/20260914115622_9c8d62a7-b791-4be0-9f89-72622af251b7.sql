ALTER TABLE public.einvoice_settings
  ADD COLUMN IF NOT EXISTS check_user_operation text NOT NULL DEFAULT 'efaturaKullaniciListesi',
  ADD COLUMN IF NOT EXISTS list_users_operation text NOT NULL DEFAULT 'kayitliKullaniciListeleExtended',
  ADD COLUMN IF NOT EXISTS resend_operation text NOT NULL DEFAULT 'belgeleriTekrarGonderOid';

UPDATE public.einvoice_settings
SET send_operation = 'belgeGonderExt'
WHERE send_operation IN ('sendInvoice', '');

UPDATE public.einvoice_settings
SET status_operation = 'gidenBelgeDurumSorgulaExt'
WHERE status_operation IN ('getInvoiceStatus', '');

ALTER TABLE public.einvoice_settings ALTER COLUMN send_operation SET DEFAULT 'belgeGonderExt';
ALTER TABLE public.einvoice_settings ALTER COLUMN status_operation SET DEFAULT 'gidenBelgeDurumSorgulaExt';

ALTER TABLE public.einvoice_documents
  ADD COLUMN IF NOT EXISTS belge_oid text,
  ADD COLUMN IF NOT EXISTS ulasti_mi boolean,
  ADD COLUMN IF NOT EXISTS durum_kodu integer,
  ADD COLUMN IF NOT EXISTS yanit_durum integer,
  ADD COLUMN IF NOT EXISTS yanit_durum_kodu integer,
  ADD COLUMN IF NOT EXISTS service_message text,
  ADD COLUMN IF NOT EXISTS resendable boolean,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS einvoice_documents_belge_oid_idx ON public.einvoice_documents (belge_oid);