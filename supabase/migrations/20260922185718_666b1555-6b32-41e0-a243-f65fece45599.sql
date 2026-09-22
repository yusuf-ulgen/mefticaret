ALTER TABLE public.xml_quarantine_items
  DROP CONSTRAINT IF EXISTS xml_quarantine_items_issue_type_check;
ALTER TABLE public.xml_quarantine_items
  ADD CONSTRAINT xml_quarantine_items_issue_type_check
  CHECK (issue_type IN ('ZERO_PRICE','ZERO_STOCK','PRICE_DROP_LIMIT','PRICE_INCREASE_LIMIT','INVALID_BARCODE'));