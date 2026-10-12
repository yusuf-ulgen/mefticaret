ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'mefpay',
  ADD COLUMN IF NOT EXISTS bank_iban text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text;

ALTER TABLE public.store_settings
  ADD CONSTRAINT store_settings_payment_mode_check
  CHECK (payment_mode IN ('mefpay', 'bank_transfer'));