ALTER TABLE public.marketplace_returns
  ADD COLUMN IF NOT EXISTS staff_note text,
  ADD COLUMN IF NOT EXISTS restocked_at timestamp with time zone;