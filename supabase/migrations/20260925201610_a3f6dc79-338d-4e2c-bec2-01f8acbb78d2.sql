ALTER TABLE public.sec_settings
  ADD COLUMN firewall_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN bot_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN country_block_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN rate_limit_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN fraud_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN max_body_bytes INTEGER NOT NULL DEFAULT 10485760;

CREATE UNIQUE INDEX idx_sec_settings_platform ON public.sec_settings ((store_id IS NULL)) WHERE store_id IS NULL;

INSERT INTO public.sec_settings (store_id) VALUES (NULL);
