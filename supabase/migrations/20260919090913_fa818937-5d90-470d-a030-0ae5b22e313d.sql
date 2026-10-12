ALTER TABLE public.global_shipments
  ADD COLUMN IF NOT EXISTS export_document_id uuid NULL REFERENCES public.export_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS global_shipments_export_document_idx
  ON public.global_shipments(export_document_id)
  WHERE export_document_id IS NOT NULL;